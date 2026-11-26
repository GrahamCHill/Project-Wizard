/* A small software renderer: it draws a World into a block of pixels using only the CPU.
 *
 * SDL is a window and input library, not a 3D one, so this example draws the 3D scene itself. It shows the whole path from
 * triangles to pixels: move each corner into the camera's space, cut off what is behind the camera, project it onto the screen,
 * fill the triangle, keep only the nearest surface at each pixel (a depth buffer), and light each pixel.
 * It knows nothing about SDL, so tests can render a frame without a window. */
#ifndef RASTER_H
#define RASTER_H

#include <stdint.h>

#include "world.h"

typedef struct {
    int width;
    int height;
    uint32_t *pixels;  /* width * height, one 0xAARRGGBB pixel each, row by row from the top */
    float *inverse_depth;  /* 1 / distance along the view direction. 0 means nothing has been drawn there yet. */
} Frame;

/* Allocates a frame. Returns 1 on success. */
int frame_init(Frame *frame, int width, int height);
void frame_free(Frame *frame);

/* Fills the frame with one color and forgets all depth. */
void frame_clear(Frame *frame, uint8_t red, uint8_t green, uint8_t blue);

/* Draws every mesh in the world as seen from eye, looking along direction (a unit vector, with y up), with the given vertical
 * field of view in degrees. Lights the surfaces with the world's lamps. */
void render_world(Frame *frame, const World *world, const float eye[3], const float direction[3], float fov_degrees);

/* The light that reaches a point. Returns red, green, and blue, each 0 to 1. A flat ambient light plus every lamp, which
 * weakens with distance and with the angle of the surface. The Raylib example's shader does the same calculation. */
void light_at(const World *world, const float position[3], const float normal[3], float out[3]);

#endif
