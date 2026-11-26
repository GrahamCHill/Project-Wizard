//! Walk around a world made in Blender, drawn with Bevy.
//!
//! `world.rs` reads the glTF file and `player.rs` moves the player. This file is the Bevy part: it turns the world into entities
//! (meshes, lights, a camera), and runs two systems that read the keyboard and mouse and move the camera.

mod player;
mod world;

use std::f32::consts::PI;
use std::path::PathBuf;

use bevy::{
    asset::RenderAssetUsages,
    input::mouse::AccumulatedMouseMotion,
    mesh::Indices,
    prelude::*,
    render::{
        render_resource::PrimitiveTopology,
        view::screenshot::{save_to_disk, Screenshot},
    },
    window::{CursorGrabMode, CursorOptions},
};

use player::Player;
use world::World;

const MOUSE_SENSITIVITY: f32 = 0.0025; // radians per pixel
const TURN_SPEED: f32 = 2.0; // radians per second, for the arrow keys
const FIELD_OF_VIEW: f32 = 70.0; // degrees, top to bottom

/// The loaded world and the player walking in it.
#[derive(Resource)]
struct Game {
    world: World,
    player: Player,
}

/// With `--screenshot file.png` the program draws a few frames, saves a picture of the first view, and quits.
#[derive(Resource)]
struct ScreenshotRequest {
    path: PathBuf,
}

fn main() {
    let mut requested: Option<PathBuf> = None;
    let mut screenshot: Option<PathBuf> = None;
    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        if arg == "--screenshot" {
            screenshot = args.next().map(PathBuf::from);
        } else {
            requested = Some(PathBuf::from(arg));
        }
    }

    let path = find_world(requested);
    let world = match world::load(&path) {
        Ok(world) => world,
        Err(error) => {
            eprintln!("Cannot load {}: {error}", path.display());
            std::process::exit(1);
        }
    };
    let player = match world.spawn {
        Some(spawn) => Player::new(spawn.position, spawn.yaw),
        None => Player::default(),
    };

    let mut app = App::new();
    app.add_plugins(DefaultPlugins.set(WindowPlugin {
        primary_window: Some(Window { title: "__PROJECT_NAME__".into(), ..default() }),
        ..default()
    }))
    .insert_resource(ClearColor(Color::srgb(0.09, 0.11, 0.14)))
    .insert_resource(Game { world, player })
    .add_systems(Startup, setup)
    .add_systems(Update, (walk, quit_on_escape));
    if let Some(path) = screenshot {
        app.insert_resource(ScreenshotRequest { path }).add_systems(Update, take_screenshot);
    } else {
        app.add_systems(Startup, capture_mouse);
    }
    app.run();
}

/// The world file may be given on the command line. Otherwise look in the folder you started from, then next to the program,
/// then in the project folder this was built from.
fn find_world(requested: Option<PathBuf>) -> PathBuf {
    if let Some(path) = requested {
        return path;
    }
    let mut candidates = vec![PathBuf::from("assets/world.gltf")];
    if let Some(folder) = std::env::current_exe().ok().and_then(|exe| exe.parent().map(PathBuf::from)) {
        candidates.push(folder.join("assets/world.gltf"));
    }
    candidates.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("assets/world.gltf"));
    candidates.iter().find(|path| path.exists()).cloned().unwrap_or_else(|| candidates[0].clone())
}

fn setup(
    mut commands: Commands,
    game: Res<Game>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
) {
    for source in &game.world.meshes {
        let mesh = Mesh::new(PrimitiveTopology::TriangleList, RenderAssetUsages::default())
            .with_inserted_attribute(Mesh::ATTRIBUTE_POSITION, source.positions.clone())
            .with_inserted_attribute(Mesh::ATTRIBUTE_NORMAL, source.normals.clone())
            .with_inserted_indices(Indices::U32(source.indices.clone()));
        let [red, green, blue, alpha] = source.color;
        commands.spawn((
            Name::new(source.name.clone()),
            Mesh3d(meshes.add(mesh)),
            MeshMaterial3d(materials.add(StandardMaterial {
                base_color: Color::linear_rgba(red, green, blue, alpha),
                perceptual_roughness: 0.9,
                alpha_mode: if alpha < 1.0 { AlphaMode::Blend } else { AlphaMode::Opaque },
                ..default()
            })),
        ));
    }

    for lamp in &game.world.lamps {
        commands.spawn((
            PointLight {
                color: Color::linear_rgb(lamp.color.x, lamp.color.y, lamp.color.z),
                intensity: lamp_lumens(lamp.intensity),
                range: 40.0,
                shadow_maps_enabled: true,
                ..default()
            },
            Transform::from_translation(lamp.position),
        ));
    }
    commands.insert_resource(GlobalAmbientLight { color: Color::WHITE, brightness: 150.0, ..default() });

    commands.spawn((
        Camera3d::default(),
        Projection::Perspective(PerspectiveProjection { fov: FIELD_OF_VIEW.to_radians(), ..default() }),
        camera_transform(&game.player),
    ));

    commands.spawn((
        Text::new("WASD move   Mouse look   Space jump   Esc quit"),
        Node { position_type: PositionType::Absolute, top: px(12), left: px(12), ..default() },
    ));
}

/// glTF measures a point light in candela, which is light per direction. Bevy wants lumens, the light in every direction together,
/// so multiply by the 4 pi steradians around the lamp. Bevy's own glTF loader does the same.
fn lamp_lumens(candela: f32) -> f32 {
    candela * 4.0 * PI
}

fn camera_transform(player: &Player) -> Transform {
    // Yaw turns left around +Y, and pitch looks up around +X. The camera looks along its own -Z.
    Transform {
        translation: player.eye(),
        rotation: Quat::from_euler(EulerRot::YXZ, player.yaw, player.pitch, 0.0),
        ..default()
    }
}

fn capture_mouse(mut cursor: Single<&mut CursorOptions>) {
    cursor.visible = false;
    cursor.grab_mode = CursorGrabMode::Locked;
}

fn walk(
    time: Res<Time>,
    keys: Res<ButtonInput<KeyCode>>,
    mouse: Res<AccumulatedMouseMotion>,
    mut game: ResMut<Game>,
    mut camera: Single<&mut Transform, With<Camera3d>>,
) {
    let axis = |positive: KeyCode, negative: KeyCode| keys.pressed(positive) as i32 as f32 - keys.pressed(negative) as i32 as f32;
    let dt = time.delta_secs();
    let game = &mut *game;

    let turn = axis(KeyCode::ArrowLeft, KeyCode::ArrowRight);
    let look_up = axis(KeyCode::ArrowUp, KeyCode::ArrowDown);
    game.player.look(
        turn * TURN_SPEED * dt - mouse.delta.x * MOUSE_SENSITIVITY,
        look_up * TURN_SPEED * dt - mouse.delta.y * MOUSE_SENSITIVITY,
    );

    let forward = axis(KeyCode::KeyW, KeyCode::KeyS);
    let strafe = axis(KeyCode::KeyD, KeyCode::KeyA);
    game.player.update(&game.world.colliders, dt, strafe, forward, keys.pressed(KeyCode::Space));

    **camera = camera_transform(&game.player);
}

fn quit_on_escape(keys: Res<ButtonInput<KeyCode>>, mut exit: MessageWriter<AppExit>) {
    if keys.just_pressed(KeyCode::Escape) {
        exit.write(AppExit::Success);
    }
}

fn take_screenshot(
    mut commands: Commands,
    request: Res<ScreenshotRequest>,
    mut frames: Local<u32>,
    mut exit: MessageWriter<AppExit>,
) {
    *frames += 1;
    // Wait a few frames so the scene and its shadows are ready, ask for the picture once, and quit after it reaches the disk.
    if *frames == 20 {
        commands.spawn(Screenshot::primary_window()).observe(save_to_disk(request.path.clone()));
    }
    if *frames > 20 && request.path.exists() {
        exit.write(AppExit::Success);
    }
    if *frames > 600 {
        eprintln!("The screenshot was not saved.");
        exit.write(AppExit::error());
    }
}
