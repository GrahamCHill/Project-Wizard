//! Reads a glTF 2.0 file exported from Blender and turns it into a world a game can use.
//!
//! Everything is flattened into world space, so the game needs no scene graph:
//!   - meshes     triangles with positions, normals, and a base color
//!   - colliders  axis-aligned boxes for every object that has the custom property `collider = "box"`
//!   - spawn      the empty named `spawn_player`: where the player starts and which way they face
//!   - lamps      point lights (KHR_lights_punctual)
//!
//! The `gltf` crate does the parsing and finds the buffers. This file walks the node tree, applies each node's transform, and
//! keeps what a first-person game needs. Textures, animation, and skinning are ignored. Coordinates are glTF's: Y is up, and an
//! object faces -Z until it is rotated. The same rules, tests, and sample file are used by the Raylib and SDL versions of this
//! example, so the three behave the same.

use std::path::Path;

use bevy::math::{Mat3, Mat4, Vec3};

/// How deep the node tree may go. glTF files are trees, so this only stops a damaged file from looping forever.
const MAX_DEPTH: usize = 256;

#[derive(Debug, Clone)]
pub struct WorldMesh {
    pub name: String,
    /// Red, green, blue, alpha from 0 to 1, in linear color, as glTF stores it.
    pub color: [f32; 4],
    pub positions: Vec<[f32; 3]>,
    /// One unit-length normal per position.
    pub normals: Vec<[f32; 3]>,
    /// Three per triangle, counter-clockwise when seen from the front.
    pub indices: Vec<u32>,
}

#[derive(Debug, Clone)]
pub struct Collider {
    pub name: String,
    pub min: Vec3,
    pub max: Vec3,
}

#[derive(Debug, Clone, Copy)]
pub struct Lamp {
    pub position: Vec3,
    pub color: Vec3,
    /// Candela, as Blender exports it.
    pub intensity: f32,
}

#[derive(Debug, Clone, Copy)]
pub struct Spawn {
    pub position: Vec3,
    /// Radians. 0 faces -Z, and a positive angle turns left (toward -X).
    pub yaw: f32,
}

#[derive(Debug, Default, Clone)]
pub struct World {
    pub meshes: Vec<WorldMesh>,
    pub colliders: Vec<Collider>,
    pub lamps: Vec<Lamp>,
    pub spawn: Option<Spawn>,
}

/// Reads a world from a `.gltf` or `.glb` file. The error says what is wrong in words a person can act on.
pub fn load(path: &Path) -> Result<World, String> {
    let (document, buffers, _images) =
        gltf::import(path).map_err(|error| format!("cannot read {}: {error}", path.display()))?;
    let scene = document
        .default_scene()
        .or_else(|| document.scenes().next())
        .ok_or("the file has no scene.")?;

    let mut world = World::default();
    for node in scene.nodes() {
        visit(&node, Mat4::IDENTITY, 0, &buffers, &mut world)?;
    }
    Ok(world)
}

fn visit(
    node: &gltf::Node,
    parent: Mat4,
    depth: usize,
    buffers: &[gltf::buffer::Data],
    world: &mut World,
) -> Result<(), String> {
    if depth > MAX_DEPTH {
        return Err("the node hierarchy is too deep, or it loops.".into());
    }
    let matrix = parent * Mat4::from_cols_array_2d(&node.transform().matrix());
    let name = node.name().unwrap_or("").to_string();

    if let Some(mesh) = node.mesh() {
        let wants_collider = collider_kind(node).as_deref() == Some("box");
        let mut bounds: Option<(Vec3, Vec3)> = None;
        for primitive in mesh.primitives() {
            let built = build_mesh(&name, &primitive, &matrix, buffers)?;
            for position in &built.positions {
                let point = Vec3::from_array(*position);
                bounds = Some(match bounds {
                    None => (point, point),
                    Some((low, high)) => (low.min(point), high.max(point)),
                });
            }
            world.meshes.push(built);
        }
        if let (true, Some((min, max))) = (wants_collider, bounds) {
            world.colliders.push(Collider { name: name.clone(), min, max });
        }
    }

    if name == "spawn_player" && world.spawn.is_none() {
        // A node faces -Z, so "forward" is the opposite of its Z axis. Yaw is measured from -Z toward -X.
        let z_axis = matrix.z_axis.truncate();
        world.spawn = Some(Spawn {
            position: matrix.w_axis.truncate(),
            yaw: z_axis.x.atan2(z_axis.z),
        });
    }

    if let Some(light) = node.light() {
        // Directional lights (the sun) have no position, and this example uses point lights only. Spot lights count as points.
        if !matches!(light.kind(), gltf::khr_lights_punctual::Kind::Directional) {
            world.lamps.push(Lamp {
                position: matrix.w_axis.truncate(),
                color: Vec3::from_array(light.color()),
                intensity: light.intensity(),
            });
        }
    }

    for child in node.children() {
        visit(&child, matrix, depth + 1, buffers, world)?;
    }
    Ok(())
}

/// The text of the node's custom property `collider`, if it has one.
fn collider_kind(node: &gltf::Node) -> Option<String> {
    let extras = node.extras().as_ref()?;
    let value: serde_json::Value = serde_json::from_str(extras.get()).ok()?;
    value.get("collider")?.as_str().map(str::to_string)
}

fn build_mesh(
    name: &str,
    primitive: &gltf::Primitive,
    matrix: &Mat4,
    buffers: &[gltf::buffer::Data],
) -> Result<WorldMesh, String> {
    if primitive.mode() != gltf::mesh::Mode::Triangles {
        return Err(format!("'{name}' uses a primitive other than triangles, such as lines or points."));
    }
    let reader = primitive.reader(|buffer| buffers.get(buffer.index()).map(|data| &data.0[..]));
    let local: Vec<[f32; 3]> = reader
        .read_positions()
        .ok_or_else(|| format!("'{name}' has no POSITION data."))?
        .collect();
    let mut indices: Vec<u32> = match reader.read_indices() {
        Some(read) => read.into_u32().collect(),
        None => (0..local.len() as u32).collect(),
    };
    if indices.len() % 3 != 0 {
        return Err(format!("'{name}' has {} indices, which is not a whole number of triangles.", indices.len()));
    }
    if let Some(bad) = indices.iter().find(|&&index| index as usize >= local.len()) {
        return Err(format!("'{name}' has an index {bad} past the end of its {} vertices.", local.len()));
    }

    let positions: Vec<[f32; 3]> = local
        .iter()
        .map(|point| matrix.transform_point3(Vec3::from_array(*point)).to_array())
        .collect();

    // A mirrored object (a negative scale) turns triangles inside out. Reversing each one keeps its front facing the same way.
    if matrix.determinant() < 0.0 {
        for triangle in indices.chunks_exact_mut(3) {
            triangle.swap(1, 2);
        }
    }

    let normals = match reader.read_normals() {
        Some(read) => {
            // Normals do not move like points: they use the inverse transpose of the transform's rotation and scale.
            let normal_matrix = Mat3::from_mat4(*matrix).inverse().transpose();
            let mut normals = Vec::with_capacity(local.len());
            for normal in read {
                normals.push((normal_matrix * Vec3::from_array(normal)).normalize_or_zero().to_array());
            }
            if normals.len() != local.len() {
                return Err(format!("'{name}' has {} normals for {} vertices.", normals.len(), local.len()));
            }
            normals
        }
        None => face_normals(&positions, &indices),
    };

    let color = primitive.material().pbr_metallic_roughness().base_color_factor();
    Ok(WorldMesh { name: name.to_string(), color, positions, normals, indices })
}

/// Normals for a mesh that has none: each vertex gets the average of the triangles that touch it, weighted by their size.
fn face_normals(positions: &[[f32; 3]], indices: &[u32]) -> Vec<[f32; 3]> {
    let mut sums = vec![Vec3::ZERO; positions.len()];
    for triangle in indices.chunks_exact(3) {
        let [a, b, c] = [triangle[0], triangle[1], triangle[2]].map(|i| Vec3::from_array(positions[i as usize]));
        let normal = (b - a).cross(c - a);
        for &i in triangle {
            sums[i as usize] += normal;
        }
    }
    sums.into_iter()
        .map(|sum| if sum.length_squared() > 0.0 { sum.normalize() } else { Vec3::Y }.to_array())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    fn sample() -> World {
        load(&Path::new(env!("CARGO_MANIFEST_DIR")).join("assets/world.gltf")).expect("the sample world loads")
    }

    fn near(a: f32, b: f32) -> bool {
        (a - b).abs() < 1e-4
    }

    /// A unique file in the temp folder that is removed when the test ends.
    struct TempFile(PathBuf);
    impl TempFile {
        fn new(name: &str, text: &str) -> Self {
            let path = std::env::temp_dir().join(format!("world-test-{}-{name}", std::process::id()));
            fs::write(&path, text).unwrap();
            TempFile(path)
        }
    }
    impl Drop for TempFile {
        fn drop(&mut self) {
            let _ = fs::remove_file(&self.0);
        }
    }

    // One triangle: (0,0,0) (1,0,0) (0,1,0), as base64.
    const TRIANGLE: &str = "AAAAAAAAAAAAAAAAAACAPwAAAAAAAAAAAAAAAAAAgD8AAAAA";

    /// A glTF file with one triangle. The arguments change the node list, the primitive, the vertex count, and the buffer.
    fn triangle_file(name: &str, nodes: &str, primitive_extra: &str, count: u32, uri: &str) -> TempFile {
        TempFile::new(
            name,
            &format!(
                r#"{{"asset":{{"version":"2.0"}},"scene":0,"scenes":[{{"nodes":[0]}}],"nodes":{nodes},
                "meshes":[{{"primitives":[{{"attributes":{{"POSITION":0}}{primitive_extra}}}]}}],
                "accessors":[{{"bufferView":0,"componentType":5126,"count":{count},"type":"VEC3","min":[0,0,0],"max":[1,1,0]}}],
                "bufferViews":[{{"buffer":0,"byteLength":36}}],"buffers":[{{"byteLength":36,"uri":"{uri}"}}]}}"#
            ),
        )
    }

    fn data_uri() -> String {
        format!("data:application/octet-stream;base64,{TRIANGLE}")
    }

    #[test]
    fn the_sample_world_has_what_blender_put_in_it() {
        let world = sample();
        assert_eq!(world.meshes.len(), 9);
        assert_eq!(world.colliders.len(), 9);
        assert_eq!(world.lamps.len(), 1);
        let spawn = world.spawn.expect("a spawn point");
        assert!(spawn.position.abs_diff_eq(Vec3::new(0.0, 0.0, 4.5), 1e-5));
        assert!(near(spawn.yaw, 0.0));
        assert_eq!(world.meshes.iter().map(|m| m.indices.len() / 3).sum::<usize>(), 108);
        for mesh in &world.meshes {
            assert_eq!(mesh.positions.len(), mesh.normals.len());
            assert!(mesh.indices.iter().all(|&i| (i as usize) < mesh.positions.len()));
            for normal in &mesh.normals {
                assert!(near(Vec3::from_array(*normal).length(), 1.0));
            }
        }
    }

    #[test]
    fn colliders_are_boxes_in_world_space() {
        let world = sample();
        let find = |name: &str| world.colliders.iter().find(|c| c.name == name).unwrap();
        let floor = find("Floor");
        assert!(near(floor.min.x, -6.0) && near(floor.max.x, 6.0));
        assert!(near(floor.min.y, -0.2) && near(floor.max.y, 0.0));
        // A crate turned 45 degrees needs a bigger box: half of its diagonal, 0.6 * sqrt(2), on each side.
        let turned = find("Crate_B");
        let half = 0.6 * 2.0_f32.sqrt();
        assert!(near(turned.min.x, 2.5 - half) && near(turned.max.x, 2.5 + half));
        assert!(near(turned.min.y, 0.0) && near(turned.max.y, 1.2));
        // The spawn empty and the lamp have no mesh, so they are not colliders.
        assert!(world.colliders.iter().all(|c| c.name != "spawn_player" && c.name != "Lamp"));
    }

    #[test]
    fn the_lamp_keeps_its_position_color_and_strength() {
        let lamp = sample().lamps[0];
        assert!(near(lamp.position.y, 2.8));
        assert!(near(lamp.color.y, 0.93));
        assert!(near(lamp.intensity, 120.0));
    }

    #[test]
    fn a_triangle_without_indices_or_normals_gets_both() {
        let file = triangle_file("plain.gltf", r#"[{"mesh":0,"name":"Tri","extras":{"collider":"box"}}]"#, "", 3, &data_uri());
        let world = load(&file.0).unwrap();
        assert_eq!(world.meshes[0].indices, vec![0, 1, 2]);
        // A counter-clockwise triangle in the XY plane faces +Z.
        assert!(near(world.meshes[0].normals[0][2], 1.0));
        assert_eq!(world.colliders.len(), 1);
        assert!(near(world.colliders[0].max.x, 1.0) && near(world.colliders[0].max.z, 0.0));
    }

    #[test]
    fn children_inherit_their_parents_transform() {
        // The parent moves 10 along X and doubles in size. The child is 5 above it, which is 10 up once the scale applies.
        let nodes = r#"[{"name":"Parent","translation":[10,0,0],"scale":[2,2,2],"children":[1]},
            {"name":"Child","translation":[0,5,0],"mesh":0,"extras":{"collider":"box"}}]"#;
        let file = triangle_file("nested.gltf", nodes, "", 3, &data_uri());
        let world = load(&file.0).unwrap();
        let collider = &world.colliders[0];
        assert!(near(collider.min.x, 10.0) && near(collider.max.x, 12.0));
        assert!(near(collider.min.y, 10.0) && near(collider.max.y, 12.0));
    }

    #[test]
    fn a_mirrored_object_keeps_its_faces_outward() {
        let file = triangle_file("mirror.gltf", r#"[{"mesh":0,"scale":[-1,1,1]}]"#, "", 3, &data_uri());
        let mesh = &load(&file.0).unwrap().meshes[0];
        assert_eq!(mesh.indices, vec![0, 2, 1]);
        assert!(near(mesh.normals[0][2], 1.0));
        assert!(near(mesh.positions[1][0], -1.0));
    }

    #[test]
    fn the_spawn_direction_comes_from_the_nodes_rotation() {
        // A quarter turn around Y, written as a quaternion, turns a -Z-facing object to face -X.
        let nodes = r#"[{"name":"spawn_player","translation":[1,2,3],"rotation":[0,0.70710678,0,0.70710678]}]"#;
        let file = triangle_file("spawn.gltf", nodes, "", 3, &data_uri());
        let spawn = load(&file.0).unwrap().spawn.unwrap();
        assert!(near(spawn.position.y, 2.0));
        assert!(near(spawn.yaw, std::f32::consts::FRAC_PI_2));
    }

    #[test]
    fn a_damaged_or_unsupported_file_gives_an_error_not_a_crash() {
        assert!(load(Path::new("does-not-exist.gltf")).is_err());
        let broken = TempFile::new("broken.gltf", "{ this is not json");
        assert!(load(&broken.0).is_err());
        let one_node = r#"[{"mesh":0}]"#;
        // The file asks for more vertices than its buffer holds.
        let short = triangle_file("short.gltf", one_node, "", 4, &data_uri());
        assert!(load(&short.0).is_err());
        // Lines instead of triangles.
        let lines = triangle_file("lines.gltf", one_node, r#","mode":1"#, 3, &data_uri());
        assert!(load(&lines.0).unwrap_err().contains("other than triangles"));
        // An index that points past the end.
        let bad_index = triangle_file("index.gltf", one_node, r#","indices":1"#, 3, &data_uri());
        assert!(load(&bad_index.0).is_err());
    }
}
