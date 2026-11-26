#include "raster.h"

#include <math.h>
#include <stdlib.h>
#include <string.h>

#define NEAR_PLANE 0.05f
#define AMBIENT 0.25f
#define MAX_CLIPPED 4  /* a triangle cut by one plane has at most 4 corners */

int frame_init(Frame *frame, int width, int height) {
    *frame = (Frame){0};
    if (width <= 0 || height <= 0) return 0;
    frame->pixels = malloc((size_t)width * (size_t)height * sizeof *frame->pixels);
    frame->inverse_depth = malloc((size_t)width * (size_t)height * sizeof *frame->inverse_depth);
    if (!frame->pixels || !frame->inverse_depth) {
        frame_free(frame);
        return 0;
    }
    frame->width = width;
    frame->height = height;
    return 1;
}

void frame_free(Frame *frame) {
    free(frame->pixels);
    free(frame->inverse_depth);
    *frame = (Frame){0};
}

void frame_clear(Frame *frame, uint8_t red, uint8_t green, uint8_t blue) {
    size_t count = (size_t)frame->width * (size_t)frame->height;
    uint32_t color = 0xFF000000u | ((uint32_t)red << 16) | ((uint32_t)green << 8) | blue;
    for (size_t i = 0; i < count; i++) {
        frame->pixels[i] = color;
        frame->inverse_depth[i] = 0;
    }
}

void light_at(const World *world, const float position[3], const float normal[3], float out[3]) {
    out[0] = out[1] = out[2] = AMBIENT;
    for (size_t i = 0; i < world->light_count; i++) {
        const WorldLight *lamp = &world->lights[i];
        float to_light[3] = {lamp->position[0] - position[0], lamp->position[1] - position[1], lamp->position[2] - position[2]};
        float distance_squared = to_light[0] * to_light[0] + to_light[1] * to_light[1] + to_light[2] * to_light[2];
        float distance = sqrtf(distance_squared);
        if (distance < 1e-6f) continue;
        float facing = (normal[0] * to_light[0] + normal[1] * to_light[1] + normal[2] * to_light[2]) / distance;
        if (facing <= 0) continue;
        float strength = (lamp->intensity / 100.0f) * facing / (1.0f + 0.1f * distance_squared);
        for (int channel = 0; channel < 3; channel++) out[channel] += lamp->color[channel] * strength;
    }
    for (int channel = 0; channel < 3; channel++) {
        if (out[channel] > 1) out[channel] = 1;
    }
}

/* A triangle corner while it is being drawn. "view" is its position in the camera's space: x right, y up, z straight ahead. */
typedef struct {
    float view[3];
    float world[3];
    float normal[3];
} Corner;

typedef struct {
    float right[3], up[3], forward[3];
    float eye[3];
} View;

static float dot(const float a[3], const float b[3]) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

static void normalize(float v[3]) {
    float length = sqrtf(dot(v, v));
    if (length > 1e-8f) {
        v[0] /= length;
        v[1] /= length;
        v[2] /= length;
    }
}

static View make_view(const float eye[3], const float direction[3]) {
    View view;
    memcpy(view.eye, eye, sizeof view.eye);
    memcpy(view.forward, direction, sizeof view.forward);
    normalize(view.forward);
    /* Right is perpendicular to forward and to world up. Looking straight up or down leaves it undefined, so fall back to -Z's side. */
    view.right[0] = -view.forward[2];
    view.right[1] = 0;
    view.right[2] = view.forward[0];
    if (dot(view.right, view.right) < 1e-8f) {
        view.right[0] = 1;
        view.right[2] = 0;
    }
    normalize(view.right);
    view.up[0] = view.right[1] * view.forward[2] - view.right[2] * view.forward[1];
    view.up[1] = view.right[2] * view.forward[0] - view.right[0] * view.forward[2];
    view.up[2] = view.right[0] * view.forward[1] - view.right[1] * view.forward[0];
    return view;
}

static Corner make_corner(const View *view, const float position[3], const float normal[3]) {
    Corner corner;
    float offset[3] = {position[0] - view->eye[0], position[1] - view->eye[1], position[2] - view->eye[2]};
    corner.view[0] = dot(offset, view->right);
    corner.view[1] = dot(offset, view->up);
    corner.view[2] = dot(offset, view->forward);
    memcpy(corner.world, position, sizeof corner.world);
    memcpy(corner.normal, normal, sizeof corner.normal);
    return corner;
}

static Corner mix(const Corner *a, const Corner *b, float t) {
    Corner out;
    for (int i = 0; i < 3; i++) {
        out.view[i] = a->view[i] + (b->view[i] - a->view[i]) * t;
        out.world[i] = a->world[i] + (b->world[i] - a->world[i]) * t;
        out.normal[i] = a->normal[i] + (b->normal[i] - a->normal[i]) * t;
    }
    return out;
}

/* Cuts a triangle to the part in front of the near plane. Returns the number of corners left, 0 to 4. */
static int clip_to_near_plane(const Corner in[3], Corner out[MAX_CLIPPED]) {
    int count = 0;
    for (int i = 0; i < 3; i++) {
        const Corner *current = &in[i];
        const Corner *next = &in[(i + 1) % 3];
        int current_inside = current->view[2] >= NEAR_PLANE;
        int next_inside = next->view[2] >= NEAR_PLANE;
        if (current_inside) out[count++] = *current;
        if (current_inside != next_inside) {
            float t = (NEAR_PLANE - current->view[2]) / (next->view[2] - current->view[2]);
            out[count++] = mix(current, next, t);
        }
    }
    return count;
}

typedef struct {
    float x, y;       /* screen position in pixels */
    float inverse_z;  /* 1 / depth */
    float world[3];   /* each of these is divided by depth, so it can be interpolated across the screen correctly */
    float normal[3];
} Projected;

static Projected project(const Corner *corner, const Frame *frame, float scale_x, float scale_y) {
    Projected out;
    float inverse = 1.0f / corner->view[2];
    out.x = frame->width * 0.5f + corner->view[0] * inverse * scale_x;
    out.y = frame->height * 0.5f - corner->view[1] * inverse * scale_y;
    out.inverse_z = inverse;
    for (int i = 0; i < 3; i++) {
        out.world[i] = corner->world[i] * inverse;
        out.normal[i] = corner->normal[i] * inverse;
    }
    return out;
}

static float edge(const Projected *a, const Projected *b, float x, float y) {
    return (b->x - a->x) * (y - a->y) - (b->y - a->y) * (x - a->x);
}

static uint8_t to_byte(float value) {
    if (value < 0) value = 0;
    if (value > 1) value = 1;
    return (uint8_t)(value * 255.0f + 0.5f);
}

static void draw_triangle(Frame *frame, const World *world, const float color[4], const Projected *a, const Projected *b, const Projected *c) {
    /* Triangles are counter-clockwise when they face the camera. On screen, with y pointing down, that comes out as a negative area. */
    float area = edge(a, b, c->x, c->y);
    if (!(area < 0)) return;  /* facing away, or too thin to see */

    float min_x = fminf(a->x, fminf(b->x, c->x)), max_x = fmaxf(a->x, fmaxf(b->x, c->x));
    float min_y = fminf(a->y, fminf(b->y, c->y)), max_y = fmaxf(a->y, fmaxf(b->y, c->y));
    int x0 = (int)floorf(fmaxf(min_x, 0)), x1 = (int)ceilf(fminf(max_x, (float)frame->width - 1));
    int y0 = (int)floorf(fmaxf(min_y, 0)), y1 = (int)ceilf(fminf(max_y, (float)frame->height - 1));

    for (int y = y0; y <= y1; y++) {
        for (int x = x0; x <= x1; x++) {
            float px = x + 0.5f, py = y + 0.5f;
            /* How much of each corner this pixel is made of. All three are between 0 and 1 inside the triangle. */
            float wa = edge(b, c, px, py) / area;
            float wb = edge(c, a, px, py) / area;
            float wc = edge(a, b, px, py) / area;
            if (wa < 0 || wb < 0 || wc < 0) continue;

            float inverse_z = wa * a->inverse_z + wb * b->inverse_z + wc * c->inverse_z;
            size_t index = (size_t)y * (size_t)frame->width + (size_t)x;
            if (inverse_z <= frame->inverse_depth[index]) continue;  /* something nearer is already here */
            frame->inverse_depth[index] = inverse_z;

            float position[3], normal[3];
            for (int i = 0; i < 3; i++) {
                position[i] = (wa * a->world[i] + wb * b->world[i] + wc * c->world[i]) / inverse_z;
                normal[i] = (wa * a->normal[i] + wb * b->normal[i] + wc * c->normal[i]) / inverse_z;
            }
            normalize(normal);
            float light[3];
            light_at(world, position, normal, light);
            frame->pixels[index] = 0xFF000000u | ((uint32_t)to_byte(color[0] * light[0]) << 16) |
                                   ((uint32_t)to_byte(color[1] * light[1]) << 8) | to_byte(color[2] * light[2]);
        }
    }
}

void render_world(Frame *frame, const World *world, const float eye[3], const float direction[3], float fov_degrees) {
    if (!frame->pixels || !frame->width || !frame->height) return;
    View view = make_view(eye, direction);
    float tangent = tanf(fov_degrees * 3.14159265f / 360.0f);
    float scale_y = frame->height * 0.5f / tangent;
    float scale_x = scale_y;  /* square pixels, so the wider side simply sees more */

    for (size_t m = 0; m < world->mesh_count; m++) {
        const WorldMesh *mesh = &world->meshes[m];
        for (size_t i = 0; i + 2 < mesh->index_count; i += 3) {
            Corner corners[3];
            for (int k = 0; k < 3; k++) {
                size_t vertex = mesh->indices[i + k];
                corners[k] = make_corner(&view, mesh->positions + vertex * 3, mesh->normals + vertex * 3);
            }
            Corner clipped[MAX_CLIPPED];
            int count = clip_to_near_plane(corners, clipped);
            if (count < 3) continue;
            Projected projected[MAX_CLIPPED];
            for (int k = 0; k < count; k++) projected[k] = project(&clipped[k], frame, scale_x, scale_y);
            /* A cut triangle has 3 or 4 corners. Four make a fan of two triangles. */
            for (int k = 1; k + 1 < count; k++) {
                draw_triangle(frame, world, mesh->color, &projected[0], &projected[k], &projected[k + 1]);
            }
        }
    }
}
