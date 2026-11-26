//! A first-person player that walks around a world. It knows nothing about Bevy's ECS or rendering, so tests can drive it
//! without a window.
//!
//! The player is a box 0.6 m wide and 1.7 m tall. It falls under gravity, can jump, and cannot pass through colliders.

use bevy::math::Vec3;

use crate::world::Collider;

pub const WIDTH: f32 = 0.6;
pub const HEIGHT: f32 = 1.7;
pub const EYE_HEIGHT: f32 = 1.55;
/// Meters per second.
pub const SPEED: f32 = 4.0;
/// Meters per second, which clears about 0.8 m.
pub const JUMP_SPEED: f32 = 5.0;
/// Meters per second squared.
pub const GRAVITY: f32 = 15.0;

const EPSILON: f32 = 1e-4;
/// The longest slice of time simulated at once, so a slow frame cannot carry the player through a wall.
const MAX_STEP: f32 = 0.05;
/// About 89 degrees.
const MAX_PITCH: f32 = 1.553;

#[derive(Debug, Clone, Copy, Default)]
pub struct Player {
    /// The middle of the player's feet.
    pub position: Vec3,
    pub velocity: Vec3,
    /// Radians. Positive turns left, and 0 faces -Z.
    pub yaw: f32,
    /// Radians. Up is positive.
    pub pitch: f32,
    pub on_ground: bool,
}

impl Player {
    pub fn new(position: Vec3, yaw: f32) -> Self {
        Player { position, yaw, ..Default::default() }
    }

    /// Turns the view. Positive yaw turns left and positive pitch looks up. Looking up and down is limited to just under straight.
    pub fn look(&mut self, yaw_change: f32, pitch_change: f32) {
        self.yaw += yaw_change;
        self.pitch = (self.pitch + pitch_change).clamp(-MAX_PITCH, MAX_PITCH);
    }

    /// Where the camera is.
    pub fn eye(&self) -> Vec3 {
        self.position + Vec3::Y * EYE_HEIGHT
    }

    /// The direction the camera looks, as a unit vector. The Bevy camera is turned with a rotation instead, so only tests and
    /// code that wants to aim (a ray, a shot) call this.
    #[allow(dead_code)]
    pub fn direction(&self) -> Vec3 {
        let flat = self.pitch.cos();
        Vec3::new(-self.yaw.sin() * flat, self.pitch.sin(), -self.yaw.cos() * flat)
    }

    /// Moves for `dt` seconds. `strafe` and `forward` run from -1 to 1 (right and forward are positive), and `jump` asks for a
    /// jump when the player is standing on something.
    pub fn update(&mut self, colliders: &[Collider], dt: f32, strafe: f32, forward: f32, jump: bool) {
        if dt <= 0.0 {
            return;
        }
        let dt = dt.min(MAX_STEP);

        // The direction the player faces, and the direction to their right, both flat on the ground.
        let (sine, cosine) = self.yaw.sin_cos();
        let mut wish = Vec3::new(-sine * forward + cosine * strafe, 0.0, -cosine * forward - sine * strafe);
        if wish.length() > 1.0 {
            wish = wish.normalize();
        }
        self.velocity.x = wish.x * SPEED;
        self.velocity.z = wish.z * SPEED;

        if jump && self.on_ground {
            self.velocity.y = JUMP_SPEED;
        }
        self.velocity.y -= GRAVITY * dt;
        self.on_ground = false;

        // One axis at a time, so the player slides along a wall instead of sticking to it. X, then Z, then Y.
        for axis in [0, 2, 1] {
            self.position[axis] += self.velocity[axis] * dt;
            self.resolve(colliders, axis);
        }
    }

    /// The player's box, as its lowest and highest corner.
    fn bounds(&self) -> (Vec3, Vec3) {
        let half = Vec3::new(WIDTH / 2.0, 0.0, WIDTH / 2.0);
        (self.position - half, self.position + half + Vec3::Y * HEIGHT)
    }

    /// After moving along one axis, pushes the player back out of any box it entered, on the side it came from.
    fn resolve(&mut self, colliders: &[Collider], axis: usize) {
        let half = WIDTH / 2.0;
        for collider in colliders {
            let (low, high) = self.bounds();
            let overlaps = (0..3).all(|i| high[i] > collider.min[i] + EPSILON && low[i] < collider.max[i] - EPSILON);
            if !overlaps {
                continue;
            }
            let velocity = self.velocity[axis];
            if axis == 1 {
                if velocity <= 0.0 {
                    self.position.y = collider.max.y;
                    self.on_ground = true;
                } else {
                    self.position.y = collider.min.y - HEIGHT;
                }
            } else if velocity > 0.0 {
                self.position[axis] = collider.min[axis] - half;
            } else if velocity < 0.0 {
                self.position[axis] = collider.max[axis] + half;
            } else {
                continue;
            }
            self.velocity[axis] = 0.0;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::world;
    use std::path::Path;

    fn near(a: f32, b: f32, tolerance: f32) -> bool {
        (a - b).abs() <= tolerance
    }

    fn collider(name: &str, min: [f32; 3], max: [f32; 3]) -> Collider {
        Collider { name: name.into(), min: Vec3::from_array(min), max: Vec3::from_array(max) }
    }

    /// A floor, a wall, and a low step, built by hand so these tests do not depend on a file.
    fn room() -> Vec<Collider> {
        vec![
            collider("Floor", [-10.0, -1.0, -10.0], [10.0, 0.0, 10.0]),
            collider("Wall", [-10.0, 0.0, -3.0], [10.0, 3.0, -2.5]),
            collider("Step", [-1.0, 0.0, 0.0], [1.0, 0.4, 1.0]),
        ]
    }

    fn run(player: &mut Player, colliders: &[Collider], frames: usize, strafe: f32, forward: f32, jump: bool) {
        for _ in 0..frames {
            player.update(colliders, 1.0 / 60.0, strafe, forward, jump);
        }
    }

    #[test]
    fn it_stands_on_the_floor_and_falls_back_to_it() {
        let room = room();
        let mut player = Player::new(Vec3::new(-5.0, 0.0, 5.0), 0.0);
        run(&mut player, &room, 120, 0.0, 0.0, false);
        assert!(near(player.position.y, 0.0, 1e-4) && player.on_ground);

        player.position = Vec3::new(5.0, 8.0, 5.0);
        run(&mut player, &room, 1, 0.0, 0.0, false);
        assert!(!player.on_ground);
        run(&mut player, &room, 240, 0.0, 0.0, false);
        assert!(near(player.position.y, 0.0, 1e-4) && player.on_ground);
    }

    #[test]
    fn walls_stop_the_player_and_they_slide_along_them() {
        let room = room();
        let mut player = Player::new(Vec3::new(5.0, 0.0, 2.0), 0.0);
        // Facing -Z, walk into the wall whose near face is at z = -2.5. The player stops 0.3 short of it.
        run(&mut player, &room, 600, 0.0, 1.0, false);
        assert!(near(player.position.z, -2.5 + 0.3, 0.01));
        // Pushing diagonally keeps the sideways part of the movement.
        let start_x = player.position.x;
        run(&mut player, &room, 60, 1.0, 1.0, false);
        assert!(player.position.x > start_x + 1.0);
        assert!(near(player.position.z, -2.5 + 0.3, 0.01));
    }

    #[test]
    fn the_step_blocks_walking_but_not_jumping() {
        let room = room();
        let mut player = Player::new(Vec3::new(0.0, 0.0, 3.0), 0.0);
        run(&mut player, &room, 300, 0.0, 1.0, false);
        // The step is 0.4 high, so walking into it stops the player at its edge: z = 1 + 0.3.
        assert!(near(player.position.z, 1.3, 0.02) && near(player.position.y, 0.0, 1e-4));
        // Jump while walking forward for a quarter of a second, then stand still. The player lands on top of the step.
        run(&mut player, &room, 1, 0.0, 1.0, true);
        run(&mut player, &room, 14, 0.0, 1.0, false);
        run(&mut player, &room, 90, 0.0, 0.0, false);
        assert!(near(player.position.y, 0.4, 1e-3) && player.on_ground);
        assert!(player.position.z < 1.0 && player.position.z > 0.0);
    }

    #[test]
    fn a_long_frame_cannot_carry_the_player_through_the_floor() {
        let room = room();
        let mut player = Player::new(Vec3::new(-5.0, 0.0, 5.0), 0.0);
        player.velocity.y = -50.0;
        player.update(&room, 10.0, 0.0, 0.0, false);
        assert!(player.position.y >= -1e-3);
        player.update(&room, -1.0, 0.0, 0.0, false); // a negative time does nothing
        assert!(player.position.y >= -1e-3);
    }

    #[test]
    fn it_looks_and_moves_in_the_direction_it_faces() {
        let room = room();
        let mut player = Player::new(Vec3::new(-5.0, 0.0, 5.0), 0.0);
        assert!(near(player.direction().z, -1.0, 1e-5));
        player.look(std::f32::consts::FRAC_PI_2, 0.0); // turn left a quarter
        assert!(near(player.direction().x, -1.0, 1e-4));
        player.look(0.0, 100.0); // looking up is limited
        assert!(player.pitch < 1.56);
        player.look(0.0, -200.0);
        assert!(player.pitch > -1.56);
        assert!(near(player.direction().length(), 1.0, 1e-4));

        let mut player = Player::new(Vec3::new(5.0, 0.0, 5.0), std::f32::consts::FRAC_PI_2);
        run(&mut player, &room, 30, 0.0, 1.0, false);
        // Forward is now toward -X.
        assert!(player.position.x < 3.5 && near(player.position.z, 5.0, 0.1));
        assert!(near(player.eye().y, player.position.y + EYE_HEIGHT, 1e-6));
    }

    #[test]
    fn the_sample_world_is_playable() {
        let world = world::load(&Path::new(env!("CARGO_MANIFEST_DIR")).join("assets/world.gltf")).unwrap();
        let spawn = world.spawn.unwrap();
        let mut player = Player::new(spawn.position, spawn.yaw);
        run(&mut player, &world.colliders, 120, 0.0, 0.0, false);
        assert!(near(player.position.y, 0.0, 1e-4) && player.on_ground);
        // From the spawn point, walk straight ahead. The pillar in the middle of the room stops the player, 0.3 from its face.
        run(&mut player, &world.colliders, 400, 0.0, 1.0, false);
        assert!(near(player.position.z, -0.2 + 0.3, 0.02) && near(player.position.x, 0.0, 1e-3));
        // Walk left until the west wall stops the player. Its inner face is at x = -5.85.
        let mut player = Player::new(spawn.position, spawn.yaw);
        run(&mut player, &world.colliders, 600, -1.0, 0.0, false);
        assert!(near(player.position.x, -5.85 + 0.3, 0.02));
    }
}
