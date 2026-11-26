/* Loads a glTF 2.0 file exported from Blender and turns it into a world a game can use.
 *
 * Everything is flattened into world space, so a renderer needs no scene graph:
 *   - meshes     triangles with positions, normals, and a base color
 *   - colliders  axis-aligned boxes for every object that has the custom property collider = "box"
 *   - spawn      the empty named "spawn_player": where the player starts and which way they face
 *   - lights     point lights (KHR_lights_punctual)
 *
 * Supported: .gltf files with embedded (base64) or external .bin buffers, float positions and normals, 8, 16, and 32-bit
 * indices, node transforms and hierarchies, and PBR base color factors. Not supported: textures, animation, skinning,
 * sparse accessors, and Draco or meshopt compression. world_load reports a clear error for what it cannot read.
 * Coordinates are glTF's: Y is up, and an object faces -Z until it is rotated.
 */
#ifndef WORLD_H
#define WORLD_H

#include <stddef.h>

#define WORLD_NAME_LENGTH 64

/* The candela of a 100 W Blender point lamp, which the examples treat as one unit of light. Their shading divides by it. */
#define WORLD_LAMP_UNIT 5435.0f

typedef struct {
    char name[WORLD_NAME_LENGTH];
    float min[3];
    float max[3];
} WorldBox;

typedef struct {
    char name[WORLD_NAME_LENGTH];
    float color[4];       /* red, green, blue, alpha from 0 to 1 */
    size_t vertex_count;
    size_t index_count;   /* a multiple of 3 */
    float *positions;     /* vertex_count * 3 */
    float *normals;       /* vertex_count * 3, unit length */
    unsigned *indices;    /* index_count */
} WorldMesh;

typedef struct {
    float position[3];
    float color[3];
    float intensity;      /* in candela, as Blender exports it: every watt of a Blender point lamp is 54.35 cd. See WORLD_LAMP_UNIT. */
} WorldLight;

typedef struct {
    WorldMesh *meshes;
    size_t mesh_count;
    WorldBox *colliders;
    size_t collider_count;
    WorldLight *lights;
    size_t light_count;
    int has_spawn;
    float spawn_position[3];
    float spawn_yaw;      /* radians. 0 faces -Z, and a positive angle turns left (toward -X) */
    float bounds_min[3];  /* a box around every mesh */
    float bounds_max[3];
} World;

/* Reads a world. Returns 1 on success. On failure it returns 0, leaves *world empty, and writes a message to error. */
int world_load(const char *path, World *world, char *error, size_t error_size);

/* Frees everything world_load allocated. It is safe to call on a world that failed to load, and more than once. */
void world_free(World *world);

#endif
