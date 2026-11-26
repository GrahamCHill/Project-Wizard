#include "world.h"

#include <math.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "yyjson.h"

#define MAX_DEPTH 64

typedef struct {
    unsigned char *data;
    size_t size;
} Buffer;

typedef struct {
    yyjson_val *root;
    const char *directory;
    Buffer *buffers;
    size_t buffer_count;
    World *world;
    char *error;
    size_t error_size;
} Loader;

static int fail(Loader *loader, const char *format, ...) {
    va_list arguments;
    va_start(arguments, format);
    if (loader->error && loader->error_size) vsnprintf(loader->error, loader->error_size, format, arguments);
    va_end(arguments);
    return 0;
}

static void copy_name(char *destination, const char *source) {
    snprintf(destination, WORLD_NAME_LENGTH, "%s", source ? source : "");
}

/* --- Small JSON helpers ------------------------------------------------------------------------------------------- */

static yyjson_val *member(yyjson_val *object, const char *key) {
    return yyjson_is_obj(object) ? yyjson_obj_get(object, key) : NULL;
}

static yyjson_val *element(yyjson_val *array, size_t index) {
    return yyjson_is_arr(array) && index < yyjson_arr_size(array) ? yyjson_arr_get(array, index) : NULL;
}

/* Reads a whole number that must be 0 or more. Returns 0 when the value is missing or not such a number. */
static int whole(yyjson_val *value, size_t *out) {
    if (!yyjson_is_num(value)) return 0;
    double number = yyjson_get_num(value);
    if (number < 0 || number != floor(number) || number > 4294967295.0 * 4096.0) return 0;
    *out = (size_t)number;
    return 1;
}

static size_t whole_or(yyjson_val *value, size_t fallback) {
    size_t out;
    return whole(value, &out) ? out : fallback;
}

static int floats(yyjson_val *array, float *out, size_t count) {
    if (!yyjson_is_arr(array) || yyjson_arr_size(array) != count) return 0;
    for (size_t i = 0; i < count; i++) {
        yyjson_val *item = yyjson_arr_get(array, i);
        if (!yyjson_is_num(item)) return 0;
        out[i] = (float)yyjson_get_num(item);
    }
    return 1;
}

/* --- Base64 and buffers ------------------------------------------------------------------------------------------- */

static int base64_value(unsigned char c) {
    if (c >= 'A' && c <= 'Z') return c - 'A';
    if (c >= 'a' && c <= 'z') return c - 'a' + 26;
    if (c >= '0' && c <= '9') return c - '0' + 52;
    if (c == '+') return 62;
    if (c == '/') return 63;
    return -1;
}

static unsigned char *decode_base64(const char *text, size_t length, size_t *out_size) {
    unsigned char *out = malloc(length / 4 * 3 + 3);
    if (!out) return NULL;
    size_t size = 0;
    unsigned bits = 0;
    int count = 0;
    for (size_t i = 0; i < length; i++) {
        if (text[i] == '=') break;
        int value = base64_value((unsigned char)text[i]);
        if (value < 0) {
            free(out);
            return NULL;
        }
        bits = (bits << 6) | (unsigned)value;
        if (++count == 4) {
            out[size++] = (unsigned char)(bits >> 16);
            out[size++] = (unsigned char)(bits >> 8);
            out[size++] = (unsigned char)bits;
            bits = 0;
            count = 0;
        }
    }
    if (count == 1) {
        free(out);
        return NULL;
    }
    if (count == 2) out[size++] = (unsigned char)(bits >> 4);
    if (count == 3) {
        out[size++] = (unsigned char)(bits >> 10);
        out[size++] = (unsigned char)(bits >> 2);
    }
    *out_size = size;
    return out;
}

/* A buffer file must sit next to the .gltf. Refusing paths that climb out keeps a downloaded model from reading other files. */
static int safe_relative_path(const char *uri) {
    if (!*uri || strstr(uri, "..") || strchr(uri, ':') || uri[0] == '/' || uri[0] == '\\') return 0;
    return 1;
}

static int load_buffer(Loader *loader, size_t index, yyjson_val *entry, Buffer *buffer) {
    const char *uri = yyjson_get_str(member(entry, "uri"));
    size_t declared = whole_or(member(entry, "byteLength"), 0);
    if (!uri) return fail(loader, "buffer %zu has no uri. A .glb file is not supported, so export glTF Embedded or glTF Separate.", index);
    if (strncmp(uri, "data:", 5) == 0) {
        const char *marker = strstr(uri, ";base64,");
        if (!marker) return fail(loader, "buffer %zu is a data URI that is not base64.", index);
        marker += 8;
        buffer->data = decode_base64(marker, strlen(marker), &buffer->size);
        if (!buffer->data) return fail(loader, "buffer %zu has invalid base64 data.", index);
    } else {
        if (!safe_relative_path(uri)) return fail(loader, "buffer %zu uses an unsafe file name.", index);
        char path[1024];
        snprintf(path, sizeof path, "%s%s", loader->directory, uri);
        FILE *file = fopen(path, "rb");
        if (!file) return fail(loader, "cannot open buffer file %s.", path);
        fseek(file, 0, SEEK_END);
        long length = ftell(file);
        fseek(file, 0, SEEK_SET);
        buffer->data = length > 0 ? malloc((size_t)length) : NULL;
        buffer->size = buffer->data && fread(buffer->data, 1, (size_t)length, file) == (size_t)length ? (size_t)length : 0;
        fclose(file);
        if (!buffer->size) {
            free(buffer->data);
            buffer->data = NULL;
            return fail(loader, "cannot read buffer file %s.", path);
        }
    }
    if (buffer->size < declared) return fail(loader, "buffer %zu is %zu bytes but declares %zu.", index, buffer->size, declared);
    return 1;
}

/* --- Accessors ---------------------------------------------------------------------------------------------------- */

/* Finds the bytes of an accessor and checks that all of them lie inside the buffer. */
static int accessor_bytes(Loader *loader, size_t index, size_t component_size, size_t components, const unsigned char **start,
                          size_t *stride, size_t *count) {
    yyjson_val *accessor = element(member(loader->root, "accessors"), index);
    if (!accessor) return fail(loader, "accessor %zu does not exist.", index);
    if (member(accessor, "sparse")) return fail(loader, "accessor %zu is sparse, which is not supported.", index);
    size_t view_index;
    if (!whole(member(accessor, "bufferView"), &view_index)) return fail(loader, "accessor %zu has no bufferView.", index);
    yyjson_val *view = element(member(loader->root, "bufferViews"), view_index);
    if (!view) return fail(loader, "bufferView %zu does not exist.", view_index);
    size_t buffer_index = whole_or(member(view, "buffer"), (size_t)-1);
    if (buffer_index >= loader->buffer_count) return fail(loader, "bufferView %zu uses a missing buffer.", view_index);
    *count = whole_or(member(accessor, "count"), 0);
    size_t view_offset = whole_or(member(view, "byteOffset"), 0), accessor_offset = whole_or(member(accessor, "byteOffset"), 0);
    size_t view_length = whole_or(member(view, "byteLength"), 0);
    size_t element_size = component_size * components;
    *stride = whole_or(member(view, "byteStride"), element_size);
    if (*stride < element_size) return fail(loader, "accessor %zu has a byteStride that is too small.", index);
    size_t used = *count ? accessor_offset + (*count - 1) * *stride + element_size : 0;
    const Buffer *buffer = &loader->buffers[buffer_index];
    if (used > view_length || view_offset + view_length > buffer->size) {
        return fail(loader, "accessor %zu reads past the end of its buffer.", index);
    }
    *start = buffer->data + view_offset + accessor_offset;
    return 1;
}

static float read_float(const unsigned char *bytes) {
    float value;
    memcpy(&value, bytes, sizeof value);
    return value;
}

static float *read_vec3(Loader *loader, size_t index, size_t *count) {
    yyjson_val *accessor = element(member(loader->root, "accessors"), index);
    if (whole_or(member(accessor, "componentType"), 0) != 5126 || !yyjson_get_str(member(accessor, "type")) ||
        strcmp(yyjson_get_str(member(accessor, "type")), "VEC3") != 0) {
        fail(loader, "accessor %zu must hold float VEC3 values.", index);
        return NULL;
    }
    const unsigned char *start;
    size_t stride;
    if (!accessor_bytes(loader, index, 4, 3, &start, &stride, count)) return NULL;
    float *out = malloc((*count ? *count : 1) * 3 * sizeof(float));
    if (!out) {
        fail(loader, "out of memory.");
        return NULL;
    }
    for (size_t i = 0; i < *count; i++) {
        for (size_t axis = 0; axis < 3; axis++) out[i * 3 + axis] = read_float(start + i * stride + axis * 4);
    }
    return out;
}

static unsigned *read_indices(Loader *loader, size_t index, size_t *count) {
    yyjson_val *accessor = element(member(loader->root, "accessors"), index);
    size_t kind = whole_or(member(accessor, "componentType"), 0);
    size_t size = kind == 5121 ? 1 : kind == 5123 ? 2 : kind == 5125 ? 4 : 0;
    const char *type = yyjson_get_str(member(accessor, "type"));
    if (!size || !type || strcmp(type, "SCALAR") != 0) {
        fail(loader, "accessor %zu must hold unsigned byte, short, or int indices.", index);
        return NULL;
    }
    const unsigned char *start;
    size_t stride;
    if (!accessor_bytes(loader, index, size, 1, &start, &stride, count)) return NULL;
    unsigned *out = malloc((*count ? *count : 1) * sizeof(unsigned));
    if (!out) {
        fail(loader, "out of memory.");
        return NULL;
    }
    for (size_t i = 0; i < *count; i++) {
        const unsigned char *at = start + i * stride;
        unsigned value = 0;
        if (size == 1) value = at[0];
        if (size == 2) value = (unsigned)at[0] | ((unsigned)at[1] << 8);
        if (size == 4) value = (unsigned)at[0] | ((unsigned)at[1] << 8) | ((unsigned)at[2] << 16) | ((unsigned)at[3] << 24);
        out[i] = value;
    }
    return out;
}

/* --- Matrices (column-major, like glTF) --------------------------------------------------------------------------- */

typedef struct {
    float m[16];
} Matrix;

static Matrix identity(void) {
    Matrix out = {{1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1}};
    return out;
}

static Matrix multiply(Matrix a, Matrix b) {
    Matrix out;
    for (int column = 0; column < 4; column++) {
        for (int row = 0; row < 4; row++) {
            float sum = 0;
            for (int k = 0; k < 4; k++) sum += a.m[k * 4 + row] * b.m[column * 4 + k];
            out.m[column * 4 + row] = sum;
        }
    }
    return out;
}

static Matrix from_translation_rotation_scale(const float t[3], const float q[4], const float s[3]) {
    float x = q[0], y = q[1], z = q[2], w = q[3];
    float length = sqrtf(x * x + y * y + z * z + w * w);
    if (length > 0) {
        x /= length;
        y /= length;
        z /= length;
        w /= length;
    }
    Matrix out = {{
        (1 - 2 * (y * y + z * z)) * s[0], (2 * (x * y + z * w)) * s[0], (2 * (x * z - y * w)) * s[0], 0,
        (2 * (x * y - z * w)) * s[1], (1 - 2 * (x * x + z * z)) * s[1], (2 * (y * z + x * w)) * s[1], 0,
        (2 * (x * z + y * w)) * s[2], (2 * (y * z - x * w)) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0,
        t[0], t[1], t[2], 1}};
    return out;
}

static void transform_point(const Matrix *matrix, const float in[3], float out[3]) {
    const float *m = matrix->m;
    for (int row = 0; row < 3; row++) out[row] = m[row] * in[0] + m[4 + row] * in[1] + m[8 + row] * in[2] + m[12 + row];
}

/* The normal matrix is the cofactor matrix of the upper 3x3. Unlike the inverse transpose, it needs no division, and it
 * stays correct for scaled and stretched objects. The determinant's sign says whether the object is mirrored. */
static float transform_normal(const Matrix *matrix, const float in[3], float out[3]) {
    const float *m = matrix->m;
    float a = m[0], b = m[4], c = m[8], d = m[1], e = m[5], f = m[9], g = m[2], h = m[6], i = m[10];
    float cofactor[9] = {e * i - f * h, f * g - d * i, d * h - e * g, c * h - b * i, a * i - c * g, b * g - a * h,
                         b * f - c * e, c * d - a * f, a * e - b * d};
    for (int row = 0; row < 3; row++) out[row] = cofactor[row * 3] * in[0] + cofactor[row * 3 + 1] * in[1] + cofactor[row * 3 + 2] * in[2];
    float length = sqrtf(out[0] * out[0] + out[1] * out[1] + out[2] * out[2]);
    if (length > 0) {
        for (int row = 0; row < 3; row++) out[row] /= length;
    }
    return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}

/* --- Building the world ------------------------------------------------------------------------------------------- */

static int grow(void **array, size_t *count, size_t size) {
    void *bigger = realloc(*array, (*count + 1) * size);
    if (!bigger) return 0;
    *array = bigger;
    (*count)++;
    return 1;
}

static void widen(float min[3], float max[3], const float point[3], int *empty) {
    for (int axis = 0; axis < 3; axis++) {
        if (*empty || point[axis] < min[axis]) min[axis] = point[axis];
        if (*empty || point[axis] > max[axis]) max[axis] = point[axis];
    }
    *empty = 0;
}

static void add_normals_from_faces(float *normals, const float *positions, const unsigned *indices, size_t index_count, size_t vertex_count) {
    memset(normals, 0, vertex_count * 3 * sizeof(float));
    for (size_t t = 0; t + 2 < index_count; t += 3) {
        const float *p0 = positions + indices[t] * 3, *p1 = positions + indices[t + 1] * 3, *p2 = positions + indices[t + 2] * 3;
        float u[3] = {p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]}, v[3] = {p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]};
        float n[3] = {u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]};
        for (int corner = 0; corner < 3; corner++) {
            for (int axis = 0; axis < 3; axis++) normals[indices[t + corner] * 3 + axis] += n[axis];
        }
    }
    for (size_t i = 0; i < vertex_count; i++) {
        float *n = normals + i * 3;
        float length = sqrtf(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
        if (length > 0) {
            n[0] /= length;
            n[1] /= length;
            n[2] /= length;
        } else {
            n[1] = 1;
        }
    }
}

/* Adds one primitive in world space. `box_min` and `box_max` grow to include it. */
static int add_primitive(Loader *loader, yyjson_val *primitive, const Matrix *matrix, const char *name, float box_min[3], float box_max[3],
                         int *box_empty) {
    yyjson_val *mode = member(primitive, "mode");
    if (mode && whole_or(mode, 99) != 4) return fail(loader, "'%s' uses a primitive mode other than triangles.", name);
    if (member(member(primitive, "extensions"), "KHR_draco_mesh_compression") || member(member(primitive, "extensions"), "EXT_meshopt_compression")) {
        return fail(loader, "'%s' uses mesh compression, which is not supported. Turn compression off when you export.", name);
    }
    yyjson_val *attributes = member(primitive, "attributes");
    size_t position_index;
    if (!whole(member(attributes, "POSITION"), &position_index)) return fail(loader, "'%s' has no POSITION data.", name);

    size_t vertex_count = 0, index_count = 0;
    float *positions = read_vec3(loader, position_index, &vertex_count);
    if (!positions) return 0;
    unsigned *indices = NULL;
    size_t indices_index;
    if (whole(member(primitive, "indices"), &indices_index)) {
        indices = read_indices(loader, indices_index, &index_count);
    } else {
        index_count = vertex_count;
        indices = malloc((index_count ? index_count : 1) * sizeof(unsigned));
        if (indices) {
            for (size_t i = 0; i < index_count; i++) indices[i] = (unsigned)i;
        } else {
            fail(loader, "out of memory.");
        }
    }
    float *normals = malloc((vertex_count ? vertex_count : 1) * 3 * sizeof(float));
    if (!indices || !normals || index_count % 3 != 0) {
        if (indices && !normals) fail(loader, "out of memory.");
        if (indices && normals) fail(loader, "'%s' has %zu indices, which is not a multiple of 3.", name, index_count);
        free(positions);
        free(indices);
        free(normals);
        return 0;
    }
    for (size_t i = 0; i < index_count; i++) {
        if (indices[i] >= vertex_count) {
            free(positions);
            free(indices);
            free(normals);
            return fail(loader, "'%s' has an index past its last vertex.", name);
        }
    }

    /* Use the file's normals when it has them and they match the vertices. Otherwise work them out from the faces. */
    size_t normal_index, normal_count = 0;
    float *source_normals = NULL;
    if (whole(member(attributes, "NORMAL"), &normal_index)) {
        source_normals = read_vec3(loader, normal_index, &normal_count);
        if (!source_normals) {
            free(positions);
            free(indices);
            free(normals);
            return 0;
        }
        if (normal_count != vertex_count) {
            free(source_normals);
            source_normals = NULL;
        }
    }
    float probe[3] = {1, 0, 0}, scratch[3];
    float determinant = transform_normal(matrix, probe, scratch);  /* negative when the object is mirrored */
    const int has_normals = source_normals != NULL;
    if (source_normals) {
        for (size_t i = 0; i < vertex_count; i++) transform_normal(matrix, source_normals + i * 3, normals + i * 3);
        free(source_normals);
    }
    for (size_t i = 0; i < vertex_count; i++) {
        float point[3];
        transform_point(matrix, positions + i * 3, point);
        memcpy(positions + i * 3, point, sizeof point);
    }
    /* A mirrored object (a negative scale) would turn its triangles inside out, so reverse their winding. */
    if (determinant < 0) {
        for (size_t t = 0; t + 2 < index_count; t += 3) {
            unsigned swap = indices[t + 1];
            indices[t + 1] = indices[t + 2];
            indices[t + 2] = swap;
        }
    }
    if (!has_normals) add_normals_from_faces(normals, positions, indices, index_count, vertex_count);

    World *world = loader->world;
    if (!grow((void **)&world->meshes, &world->mesh_count, sizeof(WorldMesh))) {
        free(positions);
        free(indices);
        free(normals);
        return fail(loader, "out of memory.");
    }
    WorldMesh *mesh = &world->meshes[world->mesh_count - 1];
    memset(mesh, 0, sizeof *mesh);
    copy_name(mesh->name, name);
    mesh->color[0] = mesh->color[1] = mesh->color[2] = mesh->color[3] = 1;
    size_t material_index;
    if (whole(member(primitive, "material"), &material_index)) {
        yyjson_val *material = element(member(loader->root, "materials"), material_index);
        floats(member(member(material, "pbrMetallicRoughness"), "baseColorFactor"), mesh->color, 4);
    }
    mesh->vertex_count = vertex_count;
    mesh->index_count = index_count;
    mesh->positions = positions;
    mesh->normals = normals;
    mesh->indices = indices;

    for (size_t i = 0; i < vertex_count; i++) {
        widen(box_min, box_max, positions + i * 3, box_empty);
        int bounds_empty = world->mesh_count == 1 && i == 0;
        widen(world->bounds_min, world->bounds_max, positions + i * 3, &bounds_empty);
    }
    return 1;
}

static int visit(Loader *loader, size_t node_index, Matrix parent, int depth) {
    if (depth > MAX_DEPTH) return fail(loader, "the scene is nested more than %d levels deep, or contains a loop.", MAX_DEPTH);
    yyjson_val *node = element(member(loader->root, "nodes"), node_index);
    if (!node) return fail(loader, "node %zu does not exist.", node_index);
    const char *name = yyjson_get_str(member(node, "name"));
    if (!name) name = "";

    Matrix local = identity();
    float matrix[16];
    if (floats(member(node, "matrix"), matrix, 16)) {
        memcpy(local.m, matrix, sizeof matrix);
    } else {
        float t[3] = {0, 0, 0}, q[4] = {0, 0, 0, 1}, s[3] = {1, 1, 1};
        floats(member(node, "translation"), t, 3);
        floats(member(node, "rotation"), q, 4);
        floats(member(node, "scale"), s, 3);
        local = from_translation_rotation_scale(t, q, s);
    }
    Matrix world_matrix = multiply(parent, local);
    World *world = loader->world;

    size_t mesh_index;
    if (whole(member(node, "mesh"), &mesh_index)) {
        yyjson_val *mesh = element(member(loader->root, "meshes"), mesh_index);
        if (!mesh) return fail(loader, "'%s' uses a mesh that does not exist.", name);
        float box_min[3] = {0, 0, 0}, box_max[3] = {0, 0, 0};
        int box_empty = 1;
        yyjson_val *primitives = member(mesh, "primitives");
        for (size_t p = 0; p < yyjson_arr_size(primitives); p++) {
            if (!add_primitive(loader, yyjson_arr_get(primitives, p), &world_matrix, name, box_min, box_max, &box_empty)) return 0;
        }
        const char *collider = yyjson_get_str(member(member(node, "extras"), "collider"));
        if (collider && strcmp(collider, "box") == 0 && !box_empty) {
            if (!grow((void **)&world->colliders, &world->collider_count, sizeof(WorldBox))) return fail(loader, "out of memory.");
            WorldBox *box = &world->colliders[world->collider_count - 1];
            copy_name(box->name, name);
            memcpy(box->min, box_min, sizeof box_min);
            memcpy(box->max, box_max, sizeof box_max);
        }
    }

    if (strcmp(name, "spawn_player") == 0 && !world->has_spawn) {
        world->has_spawn = 1;
        memcpy(world->spawn_position, world_matrix.m + 12, 3 * sizeof(float));
        /* The node's -Z axis is the way it faces. */
        world->spawn_yaw = atan2f(world_matrix.m[8], world_matrix.m[10]);
    }

    size_t light_index;
    if (whole(member(member(member(node, "extensions"), "KHR_lights_punctual"), "light"), &light_index)) {
        yyjson_val *light = element(member(member(member(loader->root, "extensions"), "KHR_lights_punctual"), "lights"), light_index);
        const char *type = yyjson_get_str(member(light, "type"));
        if (light && type && strcmp(type, "directional") != 0) {
            if (!grow((void **)&world->lights, &world->light_count, sizeof(WorldLight))) return fail(loader, "out of memory.");
            WorldLight *out = &world->lights[world->light_count - 1];
            memcpy(out->position, world_matrix.m + 12, 3 * sizeof(float));
            out->color[0] = out->color[1] = out->color[2] = 1;
            floats(member(light, "color"), out->color, 3);
            out->intensity = yyjson_is_num(member(light, "intensity")) ? (float)yyjson_get_num(member(light, "intensity")) : 1;
        }
    }

    yyjson_val *children = member(node, "children");
    for (size_t c = 0; c < yyjson_arr_size(children); c++) {
        size_t child;
        if (!whole(yyjson_arr_get(children, c), &child)) return fail(loader, "'%s' has a child that is not a node index.", name);
        if (!visit(loader, child, world_matrix, depth + 1)) return 0;
    }
    return 1;
}

void world_free(World *world) {
    if (!world) return;
    for (size_t i = 0; i < world->mesh_count; i++) {
        free(world->meshes[i].positions);
        free(world->meshes[i].normals);
        free(world->meshes[i].indices);
    }
    free(world->meshes);
    free(world->colliders);
    free(world->lights);
    memset(world, 0, sizeof *world);
}

int world_load(const char *path, World *world, char *error, size_t error_size) {
    memset(world, 0, sizeof *world);
    if (error && error_size) error[0] = '\0';
    Loader loader = {0};
    loader.world = world;
    loader.error = error;
    loader.error_size = error_size;

    yyjson_read_err read_error;
    yyjson_doc *document = yyjson_read_file(path, YYJSON_READ_NOFLAG, NULL, &read_error);
    if (!document) {
        fail(&loader, "cannot read %s: %s.", path, read_error.msg ? read_error.msg : "unknown error");
        return 0;
    }
    loader.root = yyjson_doc_get_root(document);
    if (!yyjson_is_obj(loader.root) || !member(loader.root, "asset")) {
        yyjson_doc_free(document);
        fail(&loader, "%s is not a glTF file.", path);
        return 0;
    }

    char directory[1024];
    snprintf(directory, sizeof directory, "%s", path);
    char *slash = strrchr(directory, '/');
    char *backslash = strrchr(directory, '\\');
    if (backslash && (!slash || backslash > slash)) slash = backslash;
    if (slash) slash[1] = '\0';
    else directory[0] = '\0';
    loader.directory = directory;

    int ok = 1;
    yyjson_val *buffers = member(loader.root, "buffers");
    loader.buffer_count = yyjson_arr_size(buffers);
    loader.buffers = calloc(loader.buffer_count ? loader.buffer_count : 1, sizeof(Buffer));
    if (!loader.buffers) ok = fail(&loader, "out of memory.");
    for (size_t i = 0; ok && i < loader.buffer_count; i++) ok = load_buffer(&loader, i, yyjson_arr_get(buffers, i), &loader.buffers[i]);

    if (ok) {
        yyjson_val *scenes = member(loader.root, "scenes");
        yyjson_val *scene = element(scenes, whole_or(member(loader.root, "scene"), 0));
        if (!scene) {
            ok = fail(&loader, "the file has no scene.");
        } else {
            yyjson_val *roots = member(scene, "nodes");
            for (size_t i = 0; ok && i < yyjson_arr_size(roots); i++) {
                size_t node;
                ok = whole(yyjson_arr_get(roots, i), &node) ? visit(&loader, node, identity(), 0) : fail(&loader, "the scene lists a node that is not an index.");
            }
        }
    }

    for (size_t i = 0; i < loader.buffer_count && loader.buffers; i++) free(loader.buffers[i].data);
    free(loader.buffers);
    yyjson_doc_free(document);
    if (!ok) {
        world_free(world);
        return 0;
    }
    return 1;
}
