// Writes assets/world.gltf, a small room that follows the Blender conventions in README.md, with no Blender and no
// dependencies:  node blender/make_sample_world.mjs [output.gltf]
//
// The file has the same shape as Blender's glTF exporter produces with "Custom Properties" turned on:
//   * Y is up. Blender's Z-up scene is converted on export.
//   * Each object is a node with a transform, and meshes keep their own local coordinates.
//   * Custom properties become "extras" on the node. A "collider": "box" property makes an object solid.
//   * An empty named "spawn_player" marks where the player starts, and its rotation sets the direction they face.
//   * Lights use the KHR_lights_punctual extension.
import { writeFileSync } from 'node:fs';

const output = process.argv[2] ?? 'assets/world.gltf';

// One unit cube with 24 vertices (4 per face, so each face has a flat normal) and 36 indices.
const faces = [
  { normal: [0, 0, 1], corners: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
  { normal: [0, 0, -1], corners: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
  { normal: [1, 0, 0], corners: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
  { normal: [-1, 0, 0], corners: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
  { normal: [0, 1, 0], corners: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
  { normal: [0, -1, 0], corners: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] }
];
const positions = [];
const normals = [];
const indices = [];
faces.forEach((face, index) => {
  for (const corner of face.corners) {
    positions.push(...corner.map(value => value * 0.5));
    normals.push(...face.normal);
  }
  const base = index * 4;
  indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
});

const positionBytes = Buffer.from(new Float32Array(positions).buffer);
const normalBytes = Buffer.from(new Float32Array(normals).buffer);
const indexBytes = Buffer.from(new Uint16Array(indices).buffer);
const buffer = Buffer.concat([positionBytes, normalBytes, indexBytes]);

const materials = [
  ['Floor', [0.36, 0.42, 0.34, 1]],
  ['Wall', [0.82, 0.80, 0.74, 1]],
  ['Crate', [0.80, 0.48, 0.16, 1]],
  ['Pillar', [0.25, 0.42, 0.72, 1]],
  ['Step', [0.58, 0.58, 0.62, 1]]
];

// A yaw is a rotation around the Y axis, written as a glTF quaternion [x, y, z, w].
const yaw = degrees => [0, Math.sin((degrees * Math.PI) / 360), 0, Math.cos((degrees * Math.PI) / 360)];

// Every solid object is the unit cube, moved and scaled. [name, material, translation, scale, yaw in degrees]
const objects = [
  ['Floor', 0, [0, -0.1, 0], [12, 0.2, 12], 0],
  ['Wall_North', 1, [0, 1.5, -6], [12, 3, 0.3], 0],
  ['Wall_South', 1, [0, 1.5, 6], [12, 3, 0.3], 0],
  ['Wall_East', 1, [6, 1.5, 0], [0.3, 3, 12], 0],
  ['Wall_West', 1, [-6, 1.5, 0], [0.3, 3, 12], 0],
  ['Crate_A', 2, [-2, 0.5, -2], [1, 1, 1], 0],
  ['Crate_B', 2, [2.5, 0.6, -3], [1.2, 1.2, 1.2], 45],
  ['Pillar', 3, [0, 1.5, -0.5], [0.6, 3, 0.6], 0],
  ['Step', 4, [3, 0.2, 2], [2, 0.4, 1], 0]
];

const nodes = objects.map(([name, material, translation, scale, degrees]) => ({
  name, mesh: material, translation, scale, ...(degrees ? { rotation: yaw(degrees) } : {}),
  // The custom property that Blender writes as "extras" when Include > Custom Properties is on.
  extras: { collider: 'box' }
}));
nodes.push({ name: 'spawn_player', translation: [0, 0, 4.5], rotation: yaw(0), extras: { note: 'An empty. Its position is where the player starts.' } });
nodes.push({ name: 'Lamp', translation: [0, 2.8, 0], extensions: { KHR_lights_punctual: { light: 0 } } });

const gltf = {
  asset: { version: '2.0', generator: 'Project Wizard sample world (same layout as the Blender exporter)' },
  extensionsUsed: ['KHR_lights_punctual'],
  extensions: { KHR_lights_punctual: { lights: [{ type: 'point', name: 'Lamp', color: [1, 0.93, 0.8], intensity: 120 }] } },
  scene: 0,
  scenes: [{ name: 'Scene', nodes: nodes.map((_, index) => index) }],
  nodes,
  // Every mesh shares the same geometry. Only the material differs, because glTF sets a material per mesh.
  meshes: materials.map(([name], material) => ({
    name, primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material, mode: 4 }]
  })),
  materials: materials.map(([name, baseColorFactor]) => ({
    name, pbrMetallicRoughness: { baseColorFactor, metallicFactor: 0, roughnessFactor: 0.9 }
  })),
  accessors: [
    { bufferView: 0, componentType: 5126, count: 24, type: 'VEC3', min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] },
    { bufferView: 1, componentType: 5126, count: 24, type: 'VEC3' },
    { bufferView: 2, componentType: 5123, count: 36, type: 'SCALAR' }
  ],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: positionBytes.length, target: 34962 },
    { buffer: 0, byteOffset: positionBytes.length, byteLength: normalBytes.length, target: 34962 },
    { buffer: 0, byteOffset: positionBytes.length + normalBytes.length, byteLength: indexBytes.length, target: 34963 }
  ],
  buffers: [{ byteLength: buffer.length, uri: 'data:application/octet-stream;base64,' + buffer.toString('base64') }]
};

writeFileSync(output, JSON.stringify(gltf, null, 2) + '\n');
console.log(`Wrote ${output}: ${objects.length} solid objects, a spawn point, and a light.`);
