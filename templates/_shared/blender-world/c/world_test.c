/* Tests for the world loader and the player. Run through CTest, or by hand: world_test path/to/world.gltf */
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "player.h"
#include "world.h"

static int failures = 0;
static int checks = 0;

#define CHECK(condition)                                                                                  \
    do {                                                                                                  \
        checks++;                                                                                         \
        if (!(condition)) {                                                                               \
            failures++;                                                                                   \
            printf("FAILED %s:%d: %s\n", __FILE__, __LINE__, #condition);                                 \
        }                                                                                                 \
    } while (0)

#define NEAR(a, b, tolerance) (fabsf((float)(a) - (float)(b)) <= (float)(tolerance))
#define CHECK_NEAR(a, b, tolerance)                                                                       \
    do {                                                                                                  \
        checks++;                                                                                         \
        if (!NEAR(a, b, tolerance)) {                                                                     \
            failures++;                                                                                   \
            printf("FAILED %s:%d: %s = %f, expected %f\n", __FILE__, __LINE__, #a, (double)(a), (double)(b)); \
        }                                                                                                 \
    } while (0)

static const WorldBox *find_box(const World *world, const char *name) {
    for (size_t i = 0; i < world->collider_count; i++) {
        if (strcmp(world->colliders[i].name, name) == 0) return &world->colliders[i];
    }
    return NULL;
}

/* --- The sample world ----------------------------------------------------------------------------------------------- */

static void test_sample_world(const char *path) {
    World world;
    char error[256];
    CHECK(world_load(path, &world, error, sizeof error));
    CHECK(world.mesh_count == 9);
    CHECK(world.collider_count == 9);
    CHECK(world.light_count == 1);
    CHECK(world.has_spawn);
    CHECK_NEAR(world.spawn_position[0], 0, 1e-5);
    CHECK_NEAR(world.spawn_position[1], 0, 1e-5);
    CHECK_NEAR(world.spawn_position[2], 4.5, 1e-5);
    CHECK_NEAR(world.spawn_yaw, 0, 1e-5);

    size_t triangles = 0;
    for (size_t m = 0; m < world.mesh_count; m++) {
        const WorldMesh *mesh = &world.meshes[m];
        triangles += mesh->index_count / 3;
        CHECK(mesh->index_count % 3 == 0 && mesh->vertex_count == 24 && mesh->index_count == 36);
        for (size_t i = 0; i < mesh->index_count; i++) CHECK(mesh->indices[i] < mesh->vertex_count);
        for (size_t v = 0; v < mesh->vertex_count; v++) {
            const float *n = mesh->normals + v * 3;
            CHECK_NEAR(sqrtf(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]), 1, 1e-4);
        }
    }
    CHECK(triangles == 108);

    /* A mesh's color comes from its material. */
    const WorldMesh *floor_mesh = &world.meshes[0];
    CHECK(strcmp(floor_mesh->name, "Floor") == 0);
    CHECK_NEAR(floor_mesh->color[0], 0.36f, 1e-5);
    CHECK_NEAR(floor_mesh->color[3], 1, 1e-5);

    /* Colliders are boxes in world space: the node's scale and position applied to the unit cube. */
    const WorldBox *floor_box = find_box(&world, "Floor");
    CHECK(floor_box != NULL);
    if (floor_box) {
        CHECK_NEAR(floor_box->min[0], -6, 1e-5);
        CHECK_NEAR(floor_box->max[0], 6, 1e-5);
        CHECK_NEAR(floor_box->min[1], -0.2f, 1e-5);
        CHECK_NEAR(floor_box->max[1], 0, 1e-5);
    }
    /* A crate turned 45 degrees needs a bigger box: half of its diagonal, 0.6 * sqrt(2), on each side. */
    const WorldBox *turned = find_box(&world, "Crate_B");
    CHECK(turned != NULL);
    if (turned) {
        const float half = 0.6f * sqrtf(2.0f);
        CHECK_NEAR(turned->min[0], 2.5f - half, 1e-4);
        CHECK_NEAR(turned->max[0], 2.5f + half, 1e-4);
        CHECK_NEAR(turned->min[2], -3 - half, 1e-4);
        CHECK_NEAR(turned->min[1], 0, 1e-4);
        CHECK_NEAR(turned->max[1], 1.2f, 1e-4);
    }
    /* The spawn empty and the lamp have no mesh, so they are not colliders. */
    CHECK(find_box(&world, "spawn_player") == NULL && find_box(&world, "Lamp") == NULL);

    CHECK_NEAR(world.lights[0].position[1], 2.8f, 1e-5);
    CHECK_NEAR(world.lights[0].color[1], 0.93f, 1e-5);
    CHECK_NEAR(world.lights[0].intensity, 120, 1e-3);
    CHECK_NEAR(world.bounds_min[0], -6.15f, 1e-4);
    CHECK_NEAR(world.bounds_max[1], 3.0f, 1e-4);
    CHECK_NEAR(world.bounds_min[1], -0.2f, 1e-4);

    world_free(&world);
    CHECK(world.mesh_count == 0 && world.meshes == NULL);
    world_free(&world); /* freeing twice is harmless */
}

/* --- Small hand-written files --------------------------------------------------------------------------------------- */

static const char *TRIANGLE = "AAAAAAAAAAAAAAAAAACAPwAAAAAAAAAAAAAAAAAAgD8AAAAA"; /* (0,0,0) (1,0,0) (0,1,0) */

static void write_file(const char *name, const char *text) {
    FILE *file = fopen(name, "wb");
    if (file) {
        fputs(text, file);
        fclose(file);
    }
}

/* A glTF file with one triangle. The arguments change the node list, the primitive, the number of vertices, and the buffer. */
static int load_triangle(const char *nodes, const char *primitive_extra, int count, const char *uri, World *world, char *error) {
    char text[4096];
    snprintf(text, sizeof text,
             "{\"asset\":{\"version\":\"2.0\"},\"scene\":0,\"scenes\":[{\"nodes\":[0]}],\"nodes\":%s,"
             "\"meshes\":[{\"primitives\":[{\"attributes\":{\"POSITION\":0}%s}]}],"
             "\"accessors\":[{\"bufferView\":0,\"componentType\":5126,\"count\":%d,\"type\":\"VEC3\"}],"
             "\"bufferViews\":[{\"buffer\":0,\"byteLength\":36}],\"buffers\":[{\"byteLength\":36,\"uri\":\"%s\"}]}",
             nodes, primitive_extra, count, uri);
    write_file("test_tmp.gltf", text);
    return world_load("test_tmp.gltf", world, error, 256);
}

static void test_a_triangle_without_indices_or_normals(void) {
    World world;
    char error[256], uri[256];
    snprintf(uri, sizeof uri, "data:application/octet-stream;base64,%s", TRIANGLE);
    CHECK(load_triangle("[{\"mesh\":0,\"name\":\"Tri\",\"extras\":{\"collider\":\"box\"}}]", "", 3, uri, &world, error));
    CHECK(world.mesh_count == 1 && world.meshes[0].index_count == 3 && world.meshes[0].indices[2] == 2);
    /* With no NORMAL data, normals come from the faces. A counter-clockwise triangle in the XY plane faces +Z. */
    CHECK_NEAR(world.meshes[0].normals[2], 1, 1e-5);
    CHECK_NEAR(world.meshes[0].normals[0], 0, 1e-5);
    CHECK(world.collider_count == 1);
    CHECK_NEAR(world.colliders[0].max[0], 1, 1e-5);
    CHECK_NEAR(world.colliders[0].max[2], 0, 1e-5);
    world_free(&world);
}

static void test_child_objects_inherit_their_parent_transform(void) {
    World world;
    char error[256], uri[256];
    snprintf(uri, sizeof uri, "data:application/octet-stream;base64,%s", TRIANGLE);
    /* The parent is moved 10 along X and doubled in size. The child is 5 above it, which is 10 up once the scale applies. */
    const char *nodes =
        "[{\"name\":\"Parent\",\"translation\":[10,0,0],\"scale\":[2,2,2],\"children\":[1]},"
        "{\"name\":\"Child\",\"translation\":[0,5,0],\"mesh\":0,\"extras\":{\"collider\":\"box\"}}]";
    CHECK(load_triangle(nodes, "", 3, uri, &world, error));
    CHECK(world.collider_count == 1);
    CHECK_NEAR(world.colliders[0].min[0], 10, 1e-5);
    CHECK_NEAR(world.colliders[0].max[0], 12, 1e-5);
    CHECK_NEAR(world.colliders[0].min[1], 10, 1e-5);
    CHECK_NEAR(world.colliders[0].max[1], 12, 1e-5);
    world_free(&world);
}

static void test_a_mirrored_object_keeps_its_faces_outward(void) {
    World world;
    char error[256], uri[256];
    snprintf(uri, sizeof uri, "data:application/octet-stream;base64,%s", TRIANGLE);
    CHECK(load_triangle("[{\"mesh\":0,\"scale\":[-1,1,1]}]", "", 3, uri, &world, error));
    /* Mirroring flips the triangle, so its winding is reversed to keep the face looking the same way: +Z. */
    CHECK(world.meshes[0].indices[1] == 2 && world.meshes[0].indices[2] == 1);
    CHECK_NEAR(world.meshes[0].normals[2], 1, 1e-5);
    CHECK_NEAR(world.meshes[0].positions[3], -1, 1e-5);
    world_free(&world);
}

static void test_the_spawn_direction(void) {
    World world;
    char error[256], uri[256];
    snprintf(uri, sizeof uri, "data:application/octet-stream;base64,%s", TRIANGLE);
    /* A quarter turn around Y, written as a quaternion, turns a -Z-facing object to face -X. */
    CHECK(load_triangle("[{\"name\":\"spawn_player\",\"translation\":[1,2,3],\"rotation\":[0,0.70710678,0,0.70710678]}]", "", 3, uri, &world, error));
    CHECK(world.has_spawn);
    CHECK_NEAR(world.spawn_position[1], 2, 1e-5);
    CHECK_NEAR(world.spawn_yaw, 1.5707963f, 1e-4);
    world_free(&world);
}

static void test_files_that_cannot_be_read_give_clear_errors(void) {
    World world;
    char error[256], uri[256];
    snprintf(uri, sizeof uri, "data:application/octet-stream;base64,%s", TRIANGLE);
    const char *one_node = "[{\"mesh\":0}]";

    CHECK(!world_load("does_not_exist.gltf", &world, error, sizeof error));
    CHECK(strstr(error, "cannot read") != NULL && world.mesh_count == 0);
    write_file("test_tmp.gltf", "{ this is not json");
    CHECK(!world_load("test_tmp.gltf", &world, error, sizeof error));
    write_file("test_tmp.gltf", "{\"hello\":1}");
    CHECK(!world_load("test_tmp.gltf", &world, error, sizeof error) && strstr(error, "not a glTF") != NULL);
    write_file("test_tmp.gltf", "{\"asset\":{\"version\":\"2.0\"}}");
    CHECK(!world_load("test_tmp.gltf", &world, error, sizeof error) && strstr(error, "no scene") != NULL);

    CHECK(!load_triangle(one_node, "", 3, "data:application/octet-stream;base64,@@@@", &world, error) && strstr(error, "invalid base64") != NULL);
    CHECK(!load_triangle(one_node, "", 3, "data:text/plain,hello", &world, error) && strstr(error, "not base64") != NULL);
    CHECK(!load_triangle(one_node, "", 3, "model.glb", &world, error));
    CHECK(!load_triangle(one_node, "", 4, uri, &world, error) && strstr(error, "past the end") != NULL);
    CHECK(!load_triangle(one_node, ",\"mode\":1", 3, uri, &world, error) && strstr(error, "other than triangles") != NULL);
    CHECK(!load_triangle(one_node, ",\"extensions\":{\"KHR_draco_mesh_compression\":{}}", 3, uri, &world, error) && strstr(error, "compression") != NULL);
    CHECK(!load_triangle("[{\"mesh\":5}]", "", 3, uri, &world, error) && strstr(error, "mesh that does not exist") != NULL);
    CHECK(!load_triangle("[{\"children\":[7]}]", "", 3, uri, &world, error));
    CHECK(!load_triangle("[{\"children\":[0]}]", "", 3, uri, &world, error) && strstr(error, "loop") != NULL);
    /* The model cannot ask for a file outside its own folder. */
    CHECK(!load_triangle(one_node, "", 3, "../secret.bin", &world, error) && strstr(error, "unsafe") != NULL);
    CHECK(!load_triangle(one_node, "", 3, "/etc/passwd", &world, error) && strstr(error, "unsafe") != NULL);
    CHECK(!load_triangle(one_node, "", 3, "C:/Windows/win.ini", &world, error) && strstr(error, "unsafe") != NULL);
    CHECK(world.mesh_count == 0 && world.meshes == NULL);
    remove("test_tmp.gltf");
}

/* --- The player ------------------------------------------------------------------------------------------------------ */

/* A floor, a wall, and a low step, built by hand so these tests do not depend on a file. */
static World test_room(void) {
    static WorldBox boxes[3] = {
        {"Floor", {-10, -1, -10}, {10, 0, 10}},
        {"Wall", {-10, 0, -3}, {10, 3, -2.5f}},
        {"Step", {-1, 0, 0}, {1, 0.4f, 1}},
    };
    World world = {0};
    world.colliders = boxes;
    world.collider_count = 3;
    return world;
}

static void settle(Player *player, const World *world) {
    for (int i = 0; i < 120; i++) player_update(player, world, 1.0f / 60, 0, 0, 0);
}

static void test_standing_and_falling(void) {
    World world = test_room();
    Player player;
    player_init(&player, &world);
    player.position[0] = -5; /* away from the step in the middle of the room */
    player.position[2] = 5;
    settle(&player, &world);
    CHECK_NEAR(player.position[1], 0, 1e-4);
    CHECK(player.on_ground);

    player.position[0] = 5;
    player.position[1] = 8;
    player.position[2] = 5;
    CHECK(!player.on_ground || player.position[1] == 8);
    player_update(&player, &world, 1.0f / 60, 0, 0, 0);
    CHECK(!player.on_ground);
    settle(&player, &world);
    settle(&player, &world);
    CHECK_NEAR(player.position[1], 0, 1e-4);
    CHECK(player.on_ground);
}

static void test_walls_stop_the_player_and_they_slide_along_them(void) {
    World world = test_room();
    Player player;
    player_init(&player, &world);
    player.position[0] = 5; /* to the side of the step */
    player.position[2] = 2;
    /* Facing -Z, walk into the wall whose near face is at z = -2.5. The player stops 0.3 short of it. */
    for (int i = 0; i < 600; i++) player_update(&player, &world, 1.0f / 60, 0, 1, 0);
    CHECK_NEAR(player.position[2], -2.5f + 0.3f, 0.01);
    /* Pushing diagonally keeps the sideways part of the movement. */
    float start_x = player.position[0];
    for (int i = 0; i < 60; i++) player_update(&player, &world, 1.0f / 60, 1, 1, 0);
    CHECK(player.position[0] > start_x + 1.0f);
    CHECK_NEAR(player.position[2], -2.5f + 0.3f, 0.01);
}

static void test_the_step_blocks_walking_but_not_jumping(void) {
    World world = test_room();
    Player player;
    player_init(&player, &world);
    player.position[2] = 3;
    for (int i = 0; i < 300; i++) player_update(&player, &world, 1.0f / 60, 0, 1, 0);
    /* The step is 0.4 high, so walking into it stops the player at its edge: z = 1 + 0.3. */
    CHECK_NEAR(player.position[2], 1.3f, 0.02);
    CHECK_NEAR(player.position[1], 0, 1e-4);

    /* Jump while walking forward for a quarter of a second, then stand still. The player lands on top of the step. */
    player_update(&player, &world, 1.0f / 60, 0, 1, 1);
    for (int i = 0; i < 14; i++) player_update(&player, &world, 1.0f / 60, 0, 1, 0);
    for (int i = 0; i < 90; i++) player_update(&player, &world, 1.0f / 60, 0, 0, 0);
    CHECK_NEAR(player.position[1], 0.4f, 1e-3);
    CHECK(player.on_ground);
    CHECK(player.position[2] < 1.0f && player.position[2] > 0.0f);
}

static void test_a_long_frame_cannot_carry_the_player_through_the_floor(void) {
    World world = test_room();
    Player player;
    player_init(&player, &world);
    player.velocity[1] = -50;
    player_update(&player, &world, 10.0f, 0, 0, 0);
    CHECK(player.position[1] >= -1e-3f);
    player_update(&player, &world, -1.0f, 0, 0, 0); /* a negative time does nothing */
    CHECK(player.position[1] >= -1e-3f);
}

static void test_looking_and_moving_in_the_direction_faced(void) {
    World world = test_room();
    Player player;
    player_init(&player, &world);
    float direction[3];
    player_direction(&player, direction);
    CHECK_NEAR(direction[2], -1, 1e-5);
    player_look(&player, 1.5707963f, 0); /* turn left a quarter */
    player_direction(&player, direction);
    CHECK_NEAR(direction[0], -1, 1e-4);
    player_look(&player, 0, 100); /* looking up is limited */
    CHECK(player.pitch < 1.56f);
    player_look(&player, 0, -100);
    CHECK(player.pitch > -1.56f);
    player_direction(&player, direction);
    CHECK_NEAR(sqrtf(direction[0] * direction[0] + direction[1] * direction[1] + direction[2] * direction[2]), 1, 1e-4);

    player_init(&player, &world);
    settle(&player, &world);
    player_look(&player, 1.5707963f, 0);
    for (int i = 0; i < 30; i++) player_update(&player, &world, 1.0f / 60, 0, 1, 0);
    CHECK(player.position[0] < -1.5f && fabsf(player.position[2]) < 0.1f); /* forward is now toward -X */
    float eye[3];
    player_eye(&player, eye);
    CHECK_NEAR(eye[1], player.position[1] + PLAYER_EYE_HEIGHT, 1e-6);
}

static void test_the_sample_world_is_playable(const char *path) {
    World world;
    char error[256];
    CHECK(world_load(path, &world, error, sizeof error));
    Player player;
    player_init(&player, &world);
    CHECK_NEAR(player.position[2], 4.5, 1e-5);
    settle(&player, &world);
    CHECK_NEAR(player.position[1], 0, 1e-4);
    CHECK(player.on_ground);
    /* From the spawn point, walk straight ahead. The pillar in the middle of the room stops the player, 0.3 from its face. */
    for (int i = 0; i < 400; i++) player_update(&player, &world, 1.0f / 60, 0, 1, 0);
    CHECK_NEAR(player.position[2], -0.2f + 0.3f, 0.02);
    CHECK_NEAR(player.position[0], 0, 1e-3);
    /* Walk left until the west wall stops the player. Its inner face is at x = -5.85. */
    player_init(&player, &world);
    for (int i = 0; i < 600; i++) player_update(&player, &world, 1.0f / 60, -1, 0, 0);
    CHECK_NEAR(player.position[0], -5.85f + 0.3f, 0.02);
    world_free(&world);
}

int main(int argc, char **argv) {
    if (argc < 2) {
        printf("usage: world_test path/to/world.gltf\n");
        return 2;
    }
    test_sample_world(argv[1]);
    test_a_triangle_without_indices_or_normals();
    test_child_objects_inherit_their_parent_transform();
    test_a_mirrored_object_keeps_its_faces_outward();
    test_the_spawn_direction();
    test_files_that_cannot_be_read_give_clear_errors();
    test_standing_and_falling();
    test_walls_stop_the_player_and_they_slide_along_them();
    test_the_step_blocks_walking_but_not_jumping();
    test_a_long_frame_cannot_carry_the_player_through_the_floor();
    test_looking_and_moving_in_the_direction_faced();
    test_the_sample_world_is_playable(argv[1]);
    printf("%d checks, %d failed\n", checks, failures);
    return failures ? 1 : 0;
}
