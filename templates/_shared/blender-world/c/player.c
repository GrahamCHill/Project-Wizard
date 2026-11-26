#include "player.h"

#include <math.h>

#define EPSILON 1e-4f
#define MAX_STEP 0.05f  /* The longest slice of time simulated at once, so a slow frame cannot carry the player through a wall. */
#define MAX_PITCH 1.553f /* about 89 degrees */

void player_init(Player *player, const World *world) {
    *player = (Player){0};
    if (world && world->has_spawn) {
        for (int axis = 0; axis < 3; axis++) player->position[axis] = world->spawn_position[axis];
        player->yaw = world->spawn_yaw;
    }
}

void player_look(Player *player, float yaw_change, float pitch_change) {
    player->yaw += yaw_change;
    player->pitch += pitch_change;
    if (player->pitch > MAX_PITCH) player->pitch = MAX_PITCH;
    if (player->pitch < -MAX_PITCH) player->pitch = -MAX_PITCH;
}

void player_eye(const Player *player, float out[3]) {
    out[0] = player->position[0];
    out[1] = player->position[1] + PLAYER_EYE_HEIGHT;
    out[2] = player->position[2];
}

void player_direction(const Player *player, float out[3]) {
    float flat = cosf(player->pitch);
    out[0] = -sinf(player->yaw) * flat;
    out[1] = sinf(player->pitch);
    out[2] = -cosf(player->yaw) * flat;
}

/* The player's box, as its lowest and highest corner. */
static void player_box(const Player *player, float min[3], float max[3]) {
    const float half = PLAYER_WIDTH / 2;
    min[0] = player->position[0] - half;
    max[0] = player->position[0] + half;
    min[1] = player->position[1];
    max[1] = player->position[1] + PLAYER_HEIGHT;
    min[2] = player->position[2] - half;
    max[2] = player->position[2] + half;
}

static int overlaps(const float min[3], const float max[3], const WorldBox *box) {
    for (int axis = 0; axis < 3; axis++) {
        if (max[axis] <= box->min[axis] + EPSILON || min[axis] >= box->max[axis] - EPSILON) return 0;
    }
    return 1;
}

/* After moving along one axis, pushes the player back out of any box it entered, on the side it came from. */
static void resolve(Player *player, const World *world, int axis) {
    const float half = PLAYER_WIDTH / 2;
    for (size_t i = 0; i < world->collider_count; i++) {
        const WorldBox *box = &world->colliders[i];
        float min[3], max[3];
        player_box(player, min, max);
        if (!overlaps(min, max, box)) continue;
        float velocity = player->velocity[axis];
        if (axis == 1) {
            if (velocity <= 0) {
                player->position[1] = box->max[1];
                player->on_ground = 1;
            } else {
                player->position[1] = box->min[1] - PLAYER_HEIGHT;
            }
        } else if (velocity > 0) {
            player->position[axis] = box->min[axis] - half;
        } else if (velocity < 0) {
            player->position[axis] = box->max[axis] + half;
        } else {
            continue;
        }
        player->velocity[axis] = 0;
    }
}

void player_update(Player *player, const World *world, float dt, float strafe, float forward, int jump) {
    if (dt <= 0) return;
    if (dt > MAX_STEP) dt = MAX_STEP;

    /* The direction the player faces, and the direction to their right, both flat on the ground. */
    float sine = sinf(player->yaw), cosine = cosf(player->yaw);
    float wish_x = -sine * forward + cosine * strafe;
    float wish_z = -cosine * forward - sine * strafe;
    float length = sqrtf(wish_x * wish_x + wish_z * wish_z);
    if (length > 1) {
        wish_x /= length;
        wish_z /= length;
    }
    player->velocity[0] = wish_x * PLAYER_SPEED;
    player->velocity[2] = wish_z * PLAYER_SPEED;

    if (jump && player->on_ground) {
        player->velocity[1] = PLAYER_JUMP_SPEED;
    }
    player->velocity[1] -= PLAYER_GRAVITY * dt;
    player->on_ground = 0;

    /* One axis at a time, so the player slides along a wall instead of sticking to it. */
    for (int axis = 0; axis < 3; axis++) {
        int order = axis == 0 ? 0 : axis == 1 ? 2 : 1;  /* X, then Z, then Y */
        player->position[order] += player->velocity[order] * dt;
        resolve(player, world, order);
    }
}
