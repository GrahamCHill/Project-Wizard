const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { promisify } = require('node:util');
const { test } = require('node:test');
const { starters } = require('../src/starters');
const { readProjectOptions } = require('../src/project-options');
const { writeProjectFiles } = require('../src/generate-project');

const exec = promisify(execFile);

async function fixture(t) {
  const temp = await fs.realpath(os.tmpdir());
  const root = await fs.mkdtemp(path.join(temp, 'project-wizard-shaders-'));
  t.after(async () => {
    assert.equal(path.dirname(root), temp);
    await fs.rm(root, { recursive: true, force: true });
  });
  return root;
}

test('generates working shader build inputs for SDL 2 and 3 in both native languages', async t => {
  const root = await fixture(t);
  const template = starters.find(template => template.id === 'sdl');
  for (const build of ['sdl2', 'sdl3']) for (const language of ['c', 'cpp']) for (const renderer of ['opengl', 'vulkan']) {
    const name = `${build}-${renderer}-${language}`;
    const project = path.join(root, name);
    await fs.mkdir(project);
    const options = readProjectOptions(template, { build, language, renderer });
    await writeProjectFiles(project, root, { template, name, options, initializeGit: false });
    const main = await fs.readFile(path.join(project, 'src/main.' + language), 'utf8');
    const vertex = await fs.readFile(path.join(project, 'shaders/triangle.vert'), 'utf8');
    const fragment = await fs.readFile(path.join(project, 'shaders/triangle.frag'), 'utf8');
    const cmake = await fs.readFile(path.join(project, 'CMakeLists.txt'), 'utf8');
    const readme = await fs.readFile(path.join(project, 'README.md'), 'utf8');
    assert.match(vertex, /vertexColor = colors\[gl_Vertex(?:ID|Index)\]/);
    assert.match(fragment, /fragmentColor = vec4\(vertexColor, 1.0\)/);
    assert.match(main, /#include "triangle_vert.h"/);
    assert.match(main, /#include "triangle_frag.h"/);
    assert.match(cmake, /add_custom_command\(OUTPUT "\$\{header\}"/);
    assert.match(cmake, /DEPENDS "\$\{shader\}"/);
    assert.match(readme, /Edit these files and rebuild/);
    assert.match(readme, /No external shader files/);
    assert.ok(await fs.stat(path.join(project, 'cmake/EmbedShader.cmake')));
    if (renderer === 'vulkan') {
      assert.match(main, /createRenderPass\(app, format.format\) && createPipeline\(app\)/);
      assert.match(main, /vkCmdDraw\(app->commands, 3, 1, 0, 0\)/);
      assert.match(main, /vkDestroyPipeline\(app->device, app->pipeline/);
      assert.match(cmake, /Vulkan::glslangValidator/);
    } else {
      assert.match(main, /SDL_GL_GetProcAddress\("gl" #name\)/);
      assert.match(main, /glDrawArrays\(GL_TRIANGLES, 0, 3\)/);
      assert.match(main, /GL_COMPILE_STATUS/);
      assert.match(main, /GL_LINK_STATUS/);
      assert.match(vertex, /#version 330 core/);
    }
  }
});

test('embeds exact GLSL bytes and aligned SPIR-V words, and rejects invalid modules', async t => {
  if (!await exec('cmake', ['--version']).catch(() => undefined)) { t.skip('CMake is unavailable'); return; }
  const root = await fixture(t);
  const script = path.resolve(__dirname, '../templates/_shared/shaders/EmbedShader.cmake');
  const input = path.join(root, 'shader input');
  const output = path.join(root, 'shader output.h');
  const embed = mode => exec('cmake', [`-DINPUT=${input}`, `-DOUTPUT=${output}`, '-DSYMBOL=example', `-DMODE=${mode}`, '-P', script]);
  const glsl = '#version 330 core\n// "quoted" and \\ characters\nvoid main() {}\n';
  await fs.writeFile(input, glsl);
  await embed('TEXT');
  const text = await fs.readFile(output, 'utf8');
  const bytes = [...text.matchAll(/0x([\da-f]{2})/g)].map(match => parseInt(match[1], 16));
  assert.deepEqual(Buffer.from(bytes), Buffer.concat([Buffer.from(glsl), Buffer.from([0])]));
  const spirv = Buffer.from([3, 2, 35, 7, 0, 0, 1, 0]);
  await fs.writeFile(input, spirv);
  await embed('SPIRV');
  const header = await fs.readFile(output, 'utf8');
  assert.match(header, /uint32_t example\[\]/);
  assert.match(header, /0x07230203u/);
  assert.match(header, /0x00010000u/);
  await fs.writeFile(input, spirv.subarray(0, 7));
  await assert.rejects(embed('SPIRV'), /not a little-endian SPIR-V module/);
});
