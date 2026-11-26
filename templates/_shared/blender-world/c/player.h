/* A first-person player that walks around a World. It knows nothing about any graphics library, so the same code runs
 * under Raylib and SDL, and tests can drive it without a window.
 *
 * The player is a box 0.6 m wide and 1.7 m tall. It falls under gravity, can jump, and cannot pass through colliders. */
#ifndef PLAYER_H
#define PLAYER_H

#include "world.h"

#define PLAYER_WIDTH 0.6f
#define PLAYER_HEIGHT 1.7f
#define PLAYER_EYE_HEIGHT 1.55f
#define PLAYER_SPEED 4.0f       /* meters per second */
#define PLAYER_JUMP_SPEED 5.0f  /* meters per second, which clears about 0.8 m */
#define PLAYER_GRAVITY 15.0f    /* meters per second squared */

typedef struct {
    float position[3];  /* the middle of the player's feet */
    float velocity[3];
    float yaw;          /* radians, like World.spawn_yaw */
    float pitch;        /* radians, up is positive, limited to just under straight up and down */
    int on_ground;
} Player;

/* Puts the player at the world's spawn point, or at the origin when it has none. */
void player_init(Player *player, const World *world);

/* Turns the view. Positive yaw turns left and positive pitch looks up. */
void player_look(Player *player, float yaw_change, float pitch_change);

/* Moves for dt seconds. strafe and forward run from -1 to 1 (right and forward are positive), and a nonzero jump asks for a
 * jump when the player is standing on something. */
void player_update(Player *player, const World *world, float dt, float strafe, float forward, int jump);

/* The position of the camera, and the direction it looks (a unit vector). */
void player_eye(const Player *player, float out[3]);
void player_direction(const Player *player, float out[3]);

#endif
