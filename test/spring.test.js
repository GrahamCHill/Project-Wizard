const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { starters } = require('../src/starters');
const { projectOptions, readProjectOptions } = require('../src/project-options');
const { createProject } = require('../src/projects');
const { writeProjectFiles } = require('../src/generate-project');
const { templateAvailability } = require('../src/toolchains');

async function fixture(t) {
  const temp = await fs.realpath(os.tmpdir());
  const root = await fs.mkdtemp(path.join(temp, 'project-wizard-spring-'));
  t.after(async () => {
    assert.equal(path.dirname(root), temp);
    await fs.rm(root, { recursive: true, force: true });
  });
  return root;
}

async function generate(root, id, input = {}, suffix = '') {
  const template = starters.find(item => item.id === id);
  const options = readProjectOptions(template, input);
  const name = id + suffix;
  return createProject(root, name, (project, parent) => writeProjectFiles(project, parent,
    { template, name, options, initializeGit: false }));
}

test('offers Spring plugins for Docker and six Maven starters with valid tool requirements', () => {
  const templates = starters.filter(template => template.spring && !template.docker);
  assert.equal(templates.length, 6);
  for (const template of templates) {
    assert.equal(templateAvailability(template, { 'java-17': {}, maven: {} }, 'win32').ready, true);
    assert.equal(templateAvailability(template, { 'java-17': {} }, 'win32').ready, false);
    const config = projectOptions(template);
    assert.equal(config.type, 'spring');
    assert.equal(config.spring.plugins.some(plugin => plugin.id === 'thymeleaf'), template.springMode !== 'cli');
  }
  const docker = projectOptions(starters.find(template => template.id === 'docker-spring'));
  assert.deepEqual(docker.buildChoice.options.map(option => option.id), ['java', 'kotlin']);
  assert.ok(docker.spring.plugins.some(plugin => plugin.id === 'security'));
});

test('validates plugin and database input, preserves template dependencies, and resolves SQL defaults', () => {
  const api = starters.find(template => template.id === 'spring-api-java');
  const web = starters.find(template => template.id === 'spring-web-kotlin');
  const cli = starters.find(template => template.id === 'spring-cli-java');
  assert.deepEqual(readProjectOptions(api).plugins, []);
  assert.deepEqual(readProjectOptions(web, { springPlugins: [] }).plugins, ['thymeleaf']);
  assert.deepEqual(readProjectOptions(api, { springPlugins: ['data-jpa', 'data-jpa'] }).plugins, ['data-jpa']);
  assert.equal(readProjectOptions(api, { springPlugins: ['data-jpa'] }).database, 'h2');
  assert.deepEqual(readProjectOptions(api, { springDatabase: 'postgresql' }).plugins, ['jdbc']);
  assert.throws(() => readProjectOptions(api, { springPlugins: 'actuator' }), /supported Spring plugins/);
  assert.throws(() => readProjectOptions(api, { springPlugins: ['unknown'] }), /supported Spring plugins/);
  assert.throws(() => readProjectOptions(cli, { springPlugins: ['thymeleaf'] }), /supported Spring plugins/);
  assert.throws(() => readProjectOptions(api, { springDatabase: 'unknown' }), /supported Spring database/);
  assert.throws(() => readProjectOptions(api, { testing: true, framework: 'junit' }), /supported test framework/);
});

test('generates all Spring application modes and configures Kotlin test compilation through Maven', async t => {
  const root = await fixture(t);
  for (const language of ['java', 'kotlin']) {
    for (const mode of ['api', 'web', 'cli']) {
      const project = await generate(root, `spring-${mode}-${language}`, { testing: true });
      const extension = language === 'java' ? 'java' : 'kt';
      const pom = await fs.readFile(path.join(project, 'pom.xml'), 'utf8');
      const source = await fs.readFile(path.join(project, `src/main/${language}/example/app/Application.${extension}`), 'utf8');
      assert.match(pom, /<java.version>17<\/java.version>/);
      assert.match(pom, /spring-boot-starter-test/);
      assert.equal((pom.match(/<artifactId>spring-boot-starter-thymeleaf<\/artifactId>/g) || []).length, mode === 'web' ? 1 : 0);
      if (mode === 'cli') {
        assert.match(source, /CommandLineRunner/);
        assert.doesNotMatch(source, /org.springframework.web/);
        assert.doesNotMatch(pom, /spring-boot-starter-webmvc/);
      } else if (mode === 'web') {
        const html = await fs.readFile(path.join(project, 'src/main/resources/templates/index.html'), 'utf8');
        assert.match(html, /th:text/);
        assert.doesNotMatch(html, /__PROJECT_/);
      } else assert.match(source, /@RestController/);
      if (language === 'kotlin') {
        assert.match(pom, /<jvmTarget>17<\/jvmTarget>/);
        assert.equal((pom.match(/<testSourceDirectory>/g) || []).length, 1);
        assert.equal((pom.match(/<id>test-compile<\/id>/g) || []).length, 1);
      }
      assert.match(await fs.readFile(path.join(project, `src/test/${language}/example/app/ApplicationTest.${extension}`), 'utf8'), /@SpringBootTest/);
      assert.match(await fs.readFile(path.join(project, 'README.md'), 'utf8'), /mvn test/);
      assert.match(await fs.readFile(path.join(project, '.gitignore'), 'utf8'), /target\//);
    }
  }
});

test('wires Spring plugins, secure health checks, and isolated external database tests for both Docker languages', async t => {
  const root = await fixture(t);
  for (const build of ['java', 'kotlin']) {
    for (const springDatabase of ['auto', 'postgresql', 'mysql']) {
      const project = await generate(root, 'docker-spring', {
        build, springDatabase, testing: true,
        springPlugins: ['actuator', 'validation', 'security', 'data-jpa', 'cache', 'mail', 'devtools']
      }, `-${build}-${springDatabase}`);
      const extension = build === 'java' ? 'java' : 'kt';
      const pom = await fs.readFile(path.join(project, 'pom.xml'), 'utf8');
      assert.match(pom, /<java.version>21<\/java.version>/);
      assert.match(pom, /spring-boot-starter-actuator/);
      assert.match(pom, /spring-boot-starter-validation/);
      assert.match(pom, /spring-boot-starter-security/);
      assert.match(pom, /spring-boot-starter-data-jpa/);
      assert.match(pom, /spring-boot-devtools[\s\S]*?<scope>runtime<\/scope>\s*<optional>true<\/optional>/);
      const security = await fs.readFile(path.join(project, `src/main/${build}/example/app/SecurityConfig.${extension}`), 'utf8');
      assert.match(security, /"\/healthz".*permitAll/);
      assert.match(security, /authenticated\(\)/);
      assert.doesNotMatch(security, /csrf.*disable/i);
      const properties = await fs.readFile(path.join(project, 'src/main/resources/application.properties'), 'utf8');
      assert.match(properties, /spring.jpa.hibernate.ddl-auto=none/);
      if (springDatabase === 'auto') {
        assert.match(pom, /<artifactId>h2<\/artifactId>\s*<scope>runtime<\/scope>/);
        await assert.rejects(fs.access(path.join(project, 'compose.override.yaml')), { code: 'ENOENT' });
      } else {
        assert.match(pom, springDatabase === 'postgresql' ? /<artifactId>postgresql<\/artifactId>/ : /<artifactId>mysql-connector-j<\/artifactId>/);
        assert.match(pom, /<artifactId>h2<\/artifactId>\s*<scope>test<\/scope>/);
        assert.match(properties, /spring.datasource.url=\$\{DATABASE_URL\}/);
        assert.match(await fs.readFile(path.join(project, 'compose.override.yaml'), 'utf8'), /DATABASE_PASSWORD: \$\{DATABASE_PASSWORD:\?/);
        assert.match(await fs.readFile(path.join(project, '.env.example'), 'utf8'), /DATABASE_URL=jdbc:/);
        assert.match(await fs.readFile(path.join(project, 'src/test/resources/application.properties'), 'utf8'), /jdbc:h2:mem:testdb/);
      }
    }
  }
});
