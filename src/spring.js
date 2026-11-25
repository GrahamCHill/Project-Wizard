const fs = require('node:fs/promises');
const path = require('node:path');

const springPlugins = [
  { id: 'actuator', label: 'Actuator', description: 'Health and monitoring endpoints.' },
  { id: 'validation', label: 'Validation', description: 'Jakarta Bean Validation for request and model fields.' },
  { id: 'security', label: 'Spring Security', description: 'Require authentication; keep health checks public.' },
  { id: 'data-jpa', label: 'Spring Data JPA', description: 'Hibernate and repository support. Uses H2 unless another database is chosen.' },
  { id: 'jdbc', label: 'JDBC', description: 'SQL access with JdbcTemplate. Uses H2 unless another database is chosen.' },
  { id: 'thymeleaf', label: 'Thymeleaf', description: 'Server-rendered HTML views.', web: true },
  { id: 'cache', label: 'Cache', description: 'Spring caching support.' },
  { id: 'mail', label: 'Mail', description: 'Email support; configure spring.mail properties before sending.' },
  { id: 'devtools', label: 'DevTools', description: 'Development restart support; excluded from the packaged JAR.' }
];
const springDatabases = [
  { id: 'auto', label: 'Automatic (H2 when SQL support is selected)' },
  { id: 'h2', label: 'H2 (in-memory)' },
  { id: 'postgresql', label: 'PostgreSQL (external database)' },
  { id: 'mysql', label: 'MySQL (external database)' }
];

const springStarters = ['Java', 'Kotlin'].flatMap(language => ['api', 'web', 'cli'].map(mode => {
  const extension = language === 'Java' ? 'java' : 'kt';
  const folder = language.toLowerCase();
  const labels = { api: 'JSON API', web: 'Thymeleaf Web App', cli: 'Command Line' };
  const application = `src/main/${folder}/example/app/Application.${extension}`;
  return {
    id: `spring-${mode}-${folder}`, kind: 'starter', spring: true, springMode: mode,
    group: mode === 'cli' ? 'cli' : 'server', language,
    label: `Spring Boot ${labels[mode]} (${language})`,
    description: mode === 'api' ? 'A Spring MVC JSON API with health and greeting endpoints.' :
      mode === 'web' ? 'A Spring MVC web application with a Thymeleaf home page.' :
        'A Spring Boot command-line application using CommandLineRunner.',
    tools: ['java-17', 'maven'], requirement: 'Maven 3.9+ and JDK 17 or newer. Maven downloads the Kotlin compiler when needed.',
    sourceDirectory: `docker-spring/${folder}`, files: ['pom.xml', ...(mode === 'api' ? [application] : [])],
    sharedFiles: {
      'spring/gitignore': '.gitignore',
      ...(mode === 'api' ? {} : { [`spring/${mode}/${folder}/Application.${extension}`]: application }),
      ...(mode === 'web' ? { 'spring/index.html': 'src/main/resources/templates/index.html' } : {})
    },
    commands: ['mvn package', 'java -jar target/app.jar'],
    note: mode === 'cli' ? 'The application prints a greeting and exits. Pass a name after target/app.jar to customize it.' :
      'For development, run `mvn spring-boot:run`. Open http://127.0.0.1:8080' + (mode === 'api' ? '/hello and /healthz.' : '/.'),
    next: 'Follow the Maven build and run commands in README.md.'
  };
}));

function springOptions(template) {
  const includedPlugins = template.springMode === 'web' ? ['thymeleaf'] : [];
  return { spring: {
    plugins: springPlugins.filter(plugin => !plugin.web || template.springMode !== 'cli'),
    includedPlugins, databases: springDatabases
  }, test: 'Add a Spring Boot context test', frameworks: [{ id: 'spring-test', label: 'Spring Boot Test (JUnit)' }] };
}

function readSpringOptions(template, input) {
  const config = springOptions(template).spring;
  const selected = input.springPlugins ?? [];
  if (!Array.isArray(selected) || !selected.every(id => config.plugins.some(plugin => plugin.id === id))) {
    throw new Error('Choose supported Spring plugins.');
  }
  const plugins = [...new Set([...config.includedPlugins, ...selected])];
  let database = input.springDatabase ?? 'auto';
  if (!springDatabases.some(option => option.id === database)) throw new Error('Choose a supported Spring database.');
  if (database === 'auto') database = plugins.some(id => ['data-jpa', 'jdbc'].includes(id)) ? 'h2' : undefined;
  if (database && !plugins.some(id => ['data-jpa', 'jdbc'].includes(id))) plugins.push('jdbc');
  return { plugins, database };
}

function renderSpring(text, template) {
  if (!template.spring || template.docker) return text;
  return text.replaceAll('<java.version>21</java.version>', '<java.version>17</java.version>')
    .replaceAll('<jvmTarget>21</jvmTarget>', '<jvmTarget>17</jvmTarget>')
    .replaceAll('spring-boot-starter-webmvc', template.springMode === 'cli' ? 'spring-boot-starter' : 'spring-boot-starter-webmvc');
}

async function configureSpring(project, template, options) {
  const kotlin = template.language === 'Kotlin' || (template.docker && options.build === 'kotlin');
  const folder = kotlin ? 'kotlin' : 'java';
  const extension = kotlin ? 'kt' : 'java';
  const plugins = options.plugins || [];
  const database = options.database;
  const external = database === 'postgresql' || database === 'mysql';
  const dependencies = [];
  const dependency = (group, artifact, scope, optional) => dependencies.push(
    `    <dependency>\n      <groupId>${group}</groupId>\n      <artifactId>${artifact}</artifactId>\n` +
    (scope ? `      <scope>${scope}</scope>\n` : '') + (optional ? '      <optional>true</optional>\n' : '') + '    </dependency>');
  for (const id of plugins) dependency('org.springframework.boot', 'spring-boot-' + (id === 'devtools' ? id : 'starter-' + id),
    id === 'devtools' ? 'runtime' : undefined, id === 'devtools');
  if (database === 'h2') dependency('com.h2database', 'h2', 'runtime');
  if (database === 'postgresql') dependency('org.postgresql', 'postgresql', 'runtime');
  if (database === 'mysql') dependency('com.mysql', 'mysql-connector-j', 'runtime');
  if (options.framework) {
    dependency('org.springframework.boot', 'spring-boot-starter-test', 'test');
    if (external) dependency('com.h2database', 'h2', 'test');
  }
  const pomPath = path.join(project, 'pom.xml');
  let pom = await fs.readFile(pomPath, 'utf8');
  pom = pom.replace('  </dependencies>', dependencies.join('\n') + (dependencies.length ? '\n' : '') + '  </dependencies>');
  if (kotlin && options.framework) {
    pom = pom.replace('    <sourceDirectory>src/main/kotlin</sourceDirectory>',
      '    <sourceDirectory>src/main/kotlin</sourceDirectory>\n    <testSourceDirectory>src/test/kotlin</testSourceDirectory>')
      .replace('        </executions>', '          <execution>\n            <id>test-compile</id>\n            <phase>test-compile</phase>\n' +
        '            <goals><goal>test-compile</goal></goals>\n          </execution>\n        </executions>');
  }
  await fs.writeFile(pomPath, pom);
  const write = async (file, source) => {
    const destination = path.join(project, file);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, source, { flag: 'wx' });
  };
  let properties = '';
  if (external) {
    properties += 'spring.datasource.url=${DATABASE_URL}\nspring.datasource.username=${DATABASE_USERNAME}\nspring.datasource.password=${DATABASE_PASSWORD}\n';
    const url = database === 'postgresql' ? 'jdbc:postgresql://db.example:5432/app' : 'jdbc:mysql://db.example:3306/app';
    await write('.env.example', `DATABASE_URL=${url}\nDATABASE_USERNAME=app\nDATABASE_PASSWORD=change-me\n`);
    if (template.docker) await write('compose.override.yaml', 'services:\n  app:\n    environment:\n' +
      '      DATABASE_URL: ${DATABASE_URL:?Set DATABASE_URL in .env}\n' +
      '      DATABASE_USERNAME: ${DATABASE_USERNAME:?Set DATABASE_USERNAME in .env}\n' +
      '      DATABASE_PASSWORD: ${DATABASE_PASSWORD:?Set DATABASE_PASSWORD in .env}\n');
  }
  if (plugins.includes('data-jpa')) properties += 'spring.jpa.open-in-view=false\nspring.jpa.hibernate.ddl-auto=none\n';
  if (properties) await write('src/main/resources/application.properties', properties);
  const web = template.springMode !== 'cli';
  if (plugins.includes('security') && web) {
    const source = await fs.readFile(path.join(__dirname, '..', 'templates', '_shared', 'spring', `SecurityConfig.${extension}`), 'utf8');
    await write(`src/main/${folder}/example/app/SecurityConfig.${extension}`, source);
  }
  if (options.framework) {
    const source = await fs.readFile(path.join(__dirname, '..', 'templates', '_shared', 'spring', `ApplicationTest.${extension}`), 'utf8');
    await write(`src/test/${folder}/example/app/ApplicationTest.${extension}`, source);
    if (external) await write('src/test/resources/application.properties',
      'spring.datasource.url=jdbc:h2:mem:testdb\nspring.datasource.driver-class-name=org.h2.Driver\nspring.datasource.username=sa\nspring.datasource.password=\n');
  }
  const notes = ['\n## Spring plugins\n', 'Selected: ' + (plugins.map(id => springPlugins.find(plugin => plugin.id === id).label).join(', ') || 'core starter only') + '.'];
  if (database === 'h2') notes.push('H2 runs in memory; data is discarded when the process exits.');
  if (external) notes.push('Provide a running ' + (database === 'postgresql' ? 'PostgreSQL' : 'MySQL') + ' database. ' +
    (template.docker ? 'Copy `.env.example` to `.env` and set the connection values. Use a hostname reachable from inside the container; localhost refers to the app container.' :
      'Export DATABASE_URL, DATABASE_USERNAME, and DATABASE_PASSWORD before running. `.env.example` lists them; Spring does not load this file automatically.'));
  if (plugins.includes('data-jpa')) notes.push('Add entities, repositories, and schema migrations. Automatic schema changes are disabled. Kotlin JPA entities need the Kotlin JPA/no-arg and all-open plugins or explicit open classes and no-arg constructors.');
  if (plugins.includes('security') && web) notes.push('Use HTTP Basic with username `user` and the generated password printed in the application log. `/healthz` and `/actuator/health` remain public. CSRF protection is enabled for state-changing requests.');
  if (plugins.includes('actuator') && web) notes.push('Actuator health: http://127.0.0.1:8080/actuator/health.');
  if (plugins.includes('cache')) notes.push('Add `@EnableCaching` and `@Cacheable` to enable application caching.');
  if (plugins.includes('mail')) notes.push('Configure `spring.mail.host`, port, and credentials before using JavaMailSender.');
  if (plugins.includes('devtools')) notes.push('DevTools supports local development with `mvn spring-boot:run` and is excluded from the packaged JAR.');
  if (options.framework) notes.push('\n## Tests\n\nRun `mvn test`' + (template.docker ? ', or `docker build --target build -t spring-tests .` to run Maven verification inside Docker' : '') + '. External database selections use an isolated H2 database for the context test.');
  await fs.appendFile(path.join(project, 'README.md'), notes.join('\n\n') + '\n');
}

module.exports = { springStarters, springOptions, readSpringOptions, renderSpring, configureSpring };
