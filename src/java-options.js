const fs = require('node:fs/promises');
const path = require('node:path');
const { addJvmTests, junitVersion, testInstructions } = require('./extra-tests');
const { replaceTokens } = require('./projects');
const { starterReadme } = require('./starters');

function parseJavaDependencies(lines) {
  const dependencies = new Map();
  for (const line of lines) {
    const match = line.match(/^([A-Za-z0-9_.-]+):([A-Za-z0-9_.-]+):([A-Za-z0-9][A-Za-z0-9_.+-]*)$/);
    if (!match) throw new Error('Use one Java dependency per line as group:artifact:version.');
    const [, group, artifact, version] = match;
    const coordinate = group + ':' + artifact;
    if (dependencies.has(coordinate)) throw new Error('Duplicate Java dependency: ' + coordinate);
    dependencies.set(coordinate, { group, artifact, version });
  }
  return [...dependencies.values()];
}

function mavenManifest(slug, dependencies, testing) {
  const entries = [...dependencies];
  if (testing) entries.push({
    group: 'org.junit.jupiter', artifact: 'junit-jupiter', version: junitVersion, scope: 'test'
  });
  const blocks = entries.flatMap(({ group, artifact, version, scope }) => [
    '    <dependency>',
    '      <groupId>' + group + '</groupId>',
    '      <artifactId>' + artifact + '</artifactId>',
    '      <version>' + version + '</version>',
    ...(scope ? ['      <scope>' + scope + '</scope>'] : []),
    '    </dependency>'
  ]);
  return [
    '<project xmlns="http://maven.apache.org/POM/4.0.0">',
    '  <modelVersion>4.0.0</modelVersion>',
    '  <groupId>example</groupId>',
    '  <artifactId>' + slug + '</artifactId>',
    '  <version>0.1.0</version>',
    '  <properties>',
    '    <maven.compiler.release>17</maven.compiler.release>',
    '    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>',
    '  </properties>',
    ...(blocks.length ? ['  <dependencies>', ...blocks, '  </dependencies>'] : []),
    '  <build>',
    '    <plugins>',
    '      <plugin>',
    '        <groupId>org.apache.maven.plugins</groupId>',
    '        <artifactId>maven-compiler-plugin</artifactId>',
    '        <version>3.15.0</version>',
    '      </plugin>',
    '      <plugin>',
    '        <groupId>org.codehaus.mojo</groupId>',
    '        <artifactId>exec-maven-plugin</artifactId>',
    '        <version>3.6.3</version>',
    '        <configuration><mainClass>Main</mainClass></configuration>',
    '      </plugin>',
    ...(testing ? [
      '      <plugin>',
      '        <groupId>org.apache.maven.plugins</groupId>',
      '        <artifactId>maven-surefire-plugin</artifactId>',
      '        <version>3.5.5</version>',
      '      </plugin>'
    ] : []),
    '    </plugins>',
    '  </build>',
    '</project>',
    ''
  ].join('\n');
}

function gradleBuild(dependencies, testing) {
  const entries = dependencies.map(({ group, artifact, version }) => "    implementation '" + group + ':' + artifact + ':' + version + "'");
  if (testing) entries.push("    testImplementation 'org.junit.jupiter:junit-jupiter:" + junitVersion + "'",
    "    testRuntimeOnly 'org.junit.platform:junit-platform-launcher:" + junitVersion + "'");
  return [
    'plugins {',
    "    id 'application'",
    '}',
    '',
    "group = 'example'",
    "version = '0.1.0'",
    '',
    'application {',
    "    mainClass = 'Main'",
    '}',
    '',
    'tasks.withType(JavaCompile).configureEach {',
    "    options.encoding = 'UTF-8'",
    '    options.release = 17',
    '}',
    ...(entries.length ? ['', 'repositories {', '    mavenCentral()', '}', '', 'dependencies {', ...entries, '}'] : []),
    ...(testing ? ['', "tasks.named('test') {", '    useJUnitPlatform()', '}'] : []),
    ''
  ].join('\n');
}

async function configureJava(project, template, name, { build, packages, framework }) {
  if (build === 'jdk') {
    if (framework) await addJvmTests(project, false);
    return;
  }
  const source = path.join(project, 'src', 'main', 'java');
  await fs.mkdir(source, { recursive: true });
  await fs.rename(path.join(project, 'Main.java'), path.join(source, 'Main.java'));
  const slug = replaceTokens('__PROJECT_SLUG__', name);
  const testing = framework === 'junit';
  const maven = build === 'maven';
  if (maven) {
    await fs.writeFile(path.join(project, 'pom.xml'), mavenManifest(slug, packages, testing), { flag: 'wx' });
  } else {
    await fs.writeFile(path.join(project, 'settings.gradle'), "rootProject.name = '" + slug + "'\n", { flag: 'wx' });
    await fs.writeFile(path.join(project, 'build.gradle'), gradleBuild(packages, testing), { flag: 'wx' });
  }
  await fs.appendFile(path.join(project, '.gitignore'), maven ? '\ntarget/\n' : '\n.gradle/\nbuild/\n');
  const commands = maven ? ['mvn package', 'mvn compile exec:java'] : ['gradle build', 'gradle run'];
  const requirement = maven ? 'Use Maven 3.9 or newer and JDK 17 or newer.' :
    'Use Gradle 8.5 or newer and a compatible JDK 17 or newer.';
  const note = [requirement, template.note].filter(Boolean).join(' ');
  await fs.writeFile(path.join(project, 'README.md'), starterReadme(name, template.description, commands, note));
  if (testing) {
    const tests = path.join(project, 'src', 'test', 'java');
    await fs.mkdir(tests, { recursive: true });
    const example = [
      'import org.junit.jupiter.api.Test;',
      'import static org.junit.jupiter.api.Assertions.assertEquals;',
      '',
      'class GreetingTest {',
      '    @Test',
      '    void greetsFromTheApplication() {',
      '        assertEquals("Hello from ' + name + '!", Main.greeting());',
      '    }',
      '}',
      ''
    ].join('\n');
    await fs.writeFile(path.join(tests, 'GreetingTest.java'), example, { flag: 'wx' });
    await testInstructions(project, 'JUnit tests the greeting used by the application.', maven ? 'mvn test' : 'gradle test');
  }
}

module.exports = { configureJava, parseJavaDependencies };
