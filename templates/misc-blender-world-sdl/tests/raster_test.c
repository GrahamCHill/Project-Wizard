/* Tests for the software renderer. They draw into memory, so they need no window. Run through CTest, or by hand:
 * raster_test path/to/world.gltf */
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "raster.h"

static int failures = 0;
static int checks = 0;

#define CHECK(condition)                                                                 \
    do {                                                                                 \
        checks++;                                                                        \
        if (!(condition)) {                                                              \
            failures++;                                                                  \
            printf("FAILED %s:%d: %s\n", __FILE__, __LINE__, #condition);                \
        }                                                                                \
    } while (0)

#define RED(pixel) (((pixel) >> 16) & 0xFF)
#define GREEN(pixel) (((pixel) >> 8) & 0xFF)
#define BLUE(pixel) ((pixel) & 0xFF)
#define BACKGROUND 0xFF181C24u

static const float FORWARD_MINUS_Z[3] = {0, 0, -1};
static const float ORIGIN[3] = {0, 0, 0};

static uint32_t pixel_at(const Frame *frame, int x, int y) {
    return frame->pixels[(size_t)y * (size_t)frame->width + (size_t)x];
}

/* One triangle, as a world, with no lights. */
typedef struct {
    float positions[9];
    float normals[9];
    unsigned indices[3];
    WorldMesh mesh;
    World world;
} Single;

static void make_single(Single *s, const float corners[9], const float color[4]) {
    memcpy(s->positions, corners, sizeof s->positions);
    for (int i = 0; i < 3; i++) {
        s->normals[i * 3 + 0] = 0;
        s->normals[i * 3 + 1] = 0;
        s->normals[i * 3 + 2] = 1;
    }
    s->indices[0] = 0;
    s->indices[1] = 1;
    s->indices[2] = 2;
    memset(&s->mesh, 0, sizeof s->mesh);
    s->mesh.vertex_count = 3;
    s->mesh.index_count = 3;
    s->mesh.positions = s->positions;
    s->mesh.normals = s->normals;
    s->mesh.indices = s->indices;
    memcpy(s->mesh.color, color, sizeof s->mesh.color);
    memset(&s->world, 0, sizeof s->world);
    s->world.meshes = &s->mesh;
    s->world.mesh_count = 1;
}

static int count_drawn(const Frame *frame) {
    int drawn = 0;
    for (int i = 0; i < frame->width * frame->height; i++) {
        if (frame->pixels[i] != BACKGROUND) drawn++;
    }
    return drawn;
}

static void test_frames(void) {
    Frame frame;
    CHECK(!frame_init(&frame, 0, 10) && frame.pixels == NULL);
    CHECK(!frame_init(&frame, 10, -1));
    CHECK(frame_init(&frame, 8, 6));
    frame_clear(&frame, 0x18, 0x1C, 0x24);
    CHECK(pixel_at(&frame, 7, 5) == BACKGROUND && frame.inverse_depth[0] == 0);
    frame_free(&frame);
    CHECK(frame.pixels == NULL && frame.width == 0);
    frame_free(&frame); /* freeing twice is harmless */
    World empty = {0};
    render_world(&frame, &empty, ORIGIN, FORWARD_MINUS_Z, 70); /* nothing to draw into, nothing happens */
}

static void test_a_triangle_facing_the_camera_is_drawn(void) {
    /* Counter-clockwise as the camera sees it: bottom left, bottom right, top. */
    const float corners[9] = {-1, -1, -5, 1, -1, -5, 0, 1, -5};
    const float white[4] = {1, 1, 1, 1};
    Single s;
    make_single(&s, corners, white);
    Frame frame;
    CHECK(frame_init(&frame, 64, 64));
    frame_clear(&frame, 0x18, 0x1C, 0x24);
    render_world(&frame, &s.world, ORIGIN, FORWARD_MINUS_Z, 90);
    /* With no lamps the only light is the flat ambient 0.25, so white comes out as 64. */
    CHECK(pixel_at(&frame, 32, 36) == 0xFF404040u);
    CHECK(pixel_at(&frame, 0, 0) == BACKGROUND && pixel_at(&frame, 63, 63) == BACKGROUND);
    /* At 90 degrees, a 64 pixel picture shows 2 * 5 = 10 meters at that distance, so 6.4 pixels per meter. A triangle 2 meters
     * wide and 2 meters tall is then 12.8 pixels each way, and half of that square is 82 pixels. */
    int drawn = count_drawn(&frame);
    CHECK(drawn > 70 && drawn < 95);
    CHECK(frame.inverse_depth[36 * 64 + 32] > 0.19f && frame.inverse_depth[36 * 64 + 32] < 0.21f);  /* 1 / 5 */
    frame_free(&frame);
}

static void test_the_back_of_a_triangle_is_not_drawn(void) {
    const float reversed[9] = {-1, -1, -5, 0, 1, -5, 1, -1, -5};
    const float white[4] = {1, 1, 1, 1};
    Single s;
    make_single(&s, reversed, white);
    Frame frame;
    CHECK(frame_init(&frame, 64, 64));
    frame_clear(&frame, 0x18, 0x1C, 0x24);
    render_world(&frame, &s.world, ORIGIN, FORWARD_MINUS_Z, 90);
    CHECK(count_drawn(&frame) == 0);
    frame_free(&frame);
}

static void test_things_behind_the_camera_are_not_drawn(void) {
    const float behind[9] = {-1, -1, 5, 1, -1, 5, 0, 1, 5};
    const float white[4] = {1, 1, 1, 1};
    Single s;
    make_single(&s, behind, white);
    Frame frame;
    CHECK(frame_init(&frame, 64, 64));
    frame_clear(&frame, 0x18, 0x1C, 0x24);
    render_world(&frame, &s.world, ORIGIN, FORWARD_MINUS_Z, 90);
    CHECK(count_drawn(&frame) == 0);
    /* Turn around, and it is in front. */
    const float backward[3] = {0, 0, 1};
    /* Seen from the other side its winding is reversed, so it is still culled. Flip it to check the turn itself. */
    const float flipped[9] = {-1, -1, 5, 0, 1, 5, 1, -1, 5};
    make_single(&s, flipped, white);
    render_world(&frame, &s.world, ORIGIN, backward, 90);
    CHECK(count_drawn(&frame) > 70);
    frame_free(&frame);
}

static void test_a_triangle_crossing_the_camera_plane_is_cut_not_broken(void) {
    /* One corner is 5 m behind the camera. A renderer that divides by depth without cutting first would smear the screen. */
    const float corners[9] = {-3, -1, -4, 0, -1, 5, 3, -1, -4};
    const float white[4] = {1, 1, 1, 1};
    Single s;
    make_single(&s, corners, white);
    /* A floor triangle seen from above it, so its winding faces the camera: look at it from y = 2, which sees its top (+Y). */
    for (int i = 0; i < 3; i++) {
        s.normals[i * 3 + 1] = 1;
        s.normals[i * 3 + 2] = 0;
    }
    const float eye[3] = {0, 2, 0};
    const float down_forward[3] = {0, -0.5f, -0.866f};
    Frame frame;
    CHECK(frame_init(&frame, 96, 64));
    frame_clear(&frame, 0x18, 0x1C, 0x24);
    render_world(&frame, &s.world, eye, down_forward, 70);
    int drawn = count_drawn(&frame);
    CHECK(drawn > 100 && drawn < 96 * 64);
    for (int i = 0; i < frame.width * frame.height; i++) CHECK(frame.inverse_depth[i] >= 0 && isfinite(frame.inverse_depth[i]));
    frame_free(&frame);
}

static void test_the_nearer_surface_wins(void) {
    const float near_corners[9] = {-1, -1, -2, 1, -1, -2, 0, 1, -2};
    const float far_corners[9] = {-6, -6, -8, 6, -6, -8, 0, 6, -8};
    const float red[4] = {1, 0, 0, 1};
    const float blue[4] = {0, 0, 1, 1};
    Single near_triangle, far_triangle;
    make_single(&near_triangle, near_corners, red);
    make_single(&far_triangle, far_corners, blue);
    WorldMesh meshes[2];
    for (int order = 0; order < 2; order++) {
        /* The result must not depend on which is drawn first. */
        meshes[order] = order == 0 ? near_triangle.mesh : far_triangle.mesh;
        meshes[1 - order] = order == 0 ? far_triangle.mesh : near_triangle.mesh;
        World world = {0};
        world.meshes = meshes;
        world.mesh_count = 2;
        Frame frame;
        CHECK(frame_init(&frame, 64, 64));
        frame_clear(&frame, 0x18, 0x1C, 0x24);
        render_world(&frame, &world, ORIGIN, FORWARD_MINUS_Z, 70);
        uint32_t middle = pixel_at(&frame, 32, 34);
        CHECK(RED(middle) > 60 && BLUE(middle) == 0);
        uint32_t beyond = pixel_at(&frame, 32, 5);  /* above the near triangle, where only the far one is */
        CHECK(BLUE(beyond) > 60 && RED(beyond) == 0);
        frame_free(&frame);
    }
}

static void test_light_weakens_with_distance_and_angle(void) {
    World world = {0};
    WorldLight lamp = {{0, 3, 0}, {1, 1, 1}, 100};
    world.lights = &lamp;
    world.light_count = 1;
    const float up[3] = {0, 1, 0}, down[3] = {0, -1, 0};
    float under[3], near_edge[3], far_edge[3], away[3];
    const float here[3] = {0, 0, 0}, nearby[3] = {1, 0, 0}, far_away[3] = {6, 0, 0};
    light_at(&world, here, up, under);
    light_at(&world, nearby, up, near_edge);
    light_at(&world, far_away, up, far_edge);
    light_at(&world, here, down, away);
    CHECK(under[0] > near_edge[0] && near_edge[0] > far_edge[0]);
    CHECK(away[0] == 0.25f && away[1] == 0.25f);  /* a surface facing away from the lamp gets only ambient light */
    CHECK(far_edge[0] > 0.25f);
    CHECK(under[0] <= 1.0f);
    World dark = {0};
    float unlit[3];
    light_at(&dark, here, up, unlit);
    CHECK(unlit[0] == 0.25f && unlit[2] == 0.25f);
}

static void test_the_sample_world(const char *path) {
    World world;
    char error[256];
    CHECK(world_load(path, &world, error, sizeof error));
    Frame frame;
    CHECK(frame_init(&frame, 640, 360));
    frame_clear(&frame, 0x18, 0x1C, 0x24);
    /* The player starts at (0, 0, 4.5), and their eyes are 1.55 m up. */
    const float eye[3] = {0, 1.55f, 4.5f};
    render_world(&frame, &world, eye, FORWARD_MINUS_Z, 70);
    CHECK(pixel_at(&frame, 320, 4) == BACKGROUND);       /* above the walls there is only the background */
    uint32_t pillar = pixel_at(&frame, 320, 200);        /* the blue pillar is straight ahead */
    CHECK(BLUE(pillar) > RED(pillar) + 10 && BLUE(pillar) > GREEN(pillar));
    uint32_t crate = pixel_at(&frame, 237, 225);         /* the orange crate to its left */
    CHECK(RED(crate) > BLUE(crate) + 20 && RED(crate) > GREEN(crate));
    uint32_t floor = pixel_at(&frame, 320, 340);
    CHECK(floor != BACKGROUND && GREEN(floor) > BLUE(floor));
    CHECK(count_drawn(&frame) > 640 * 360 * 6 / 10);

    /* Every pixel in the picture comes from a surface, so rendering the same view twice gives the same picture. */
    uint32_t *first = malloc(sizeof(uint32_t) * 640 * 360);
    memcpy(first, frame.pixels, sizeof(uint32_t) * 640 * 360);
    frame_clear(&frame, 0x18, 0x1C, 0x24);
    render_world(&frame, &world, eye, FORWARD_MINUS_Z, 70);
    CHECK(memcmp(first, frame.pixels, sizeof(uint32_t) * 640 * 360) == 0);
    free(first);

    /* Stand with a nose against a wall, and look in every direction. Nothing may crash or read outside the buffers. */
    const float close_to_wall[3] = {0, 1.0f, -5.84f};
    for (int step = 0; step < 24; step++) {
        float angle = step * 3.14159265f / 12;
        float direction[3] = {sinf(angle), step % 3 == 0 ? 0.6f : -0.3f, cosf(angle)};
        float length = sqrtf(direction[0] * direction[0] + direction[1] * direction[1] + direction[2] * direction[2]);
        for (int i = 0; i < 3; i++) direction[i] /= length;
        frame_clear(&frame, 0x18, 0x1C, 0x24);
        render_world(&frame, &world, close_to_wall, direction, 70);
    }
    /* Straight up and straight down, where "right" has no direction of its own. */
    const float up[3] = {0, 1, 0}, down[3] = {0, -1, 0};
    render_world(&frame, &world, eye, up, 70);
    render_world(&frame, &world, eye, down, 70);
    CHECK(count_drawn(&frame) > 0);
    frame_free(&frame);
    world_free(&world);
}

int main(int argc, char **argv) {
    if (argc < 2) {
        printf("usage: raster_test path/to/world.gltf\n");
        return 2;
    }
    test_frames();
    test_a_triangle_facing_the_camera_is_drawn();
    test_the_back_of_a_triangle_is_not_drawn();
    test_things_behind_the_camera_are_not_drawn();
    test_a_triangle_crossing_the_camera_plane_is_cut_not_broken();
    test_the_nearer_surface_wins();
    test_light_weakens_with_distance_and_angle();
    test_the_sample_world(argv[1]);
    printf("%d checks, %d failed\n", checks, failures);
    return failures ? 1 : 0;
}
