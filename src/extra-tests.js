const fs = require('node:fs/promises');
const path = require('node:path');
const { createDotnetProject } = require('./projects');
const junitVersion = '6.0.3';

async function testInstructions(project, note, command) {
  await fs.appendFile(path.join(project, 'README.md'), '\n## Tests\n\n' + note + '\n\n~~~sh\n' + command + '\n~~~\n');
}

async function addJvmTests(project, kotlin) {
  const directory = path.join(project, 'tests');
  const sourceDirectory = path.join(directory, 'src', 'test', kotlin ? 'kotlin' : 'java');
  await fs.mkdir(sourceDirectory, { recursive: true });
  const kotlinDependency = kotlin ? [
    '    <dependency>',
    '      <groupId>org.jetbrains.kotlin</groupId>',
    '      <artifactId>kotlin-stdlib</artifactId>',
    '      <version>2.4.21</version>',
    '      <scope>test</scope>',
    '    </dependency>'
  ] : [];
  const kotlinPlugin = kotlin ? [
    '      <plugin>',
    '        <groupId>org.jetbrains.kotlin</groupId>',
    '        <artifactId>kotlin-maven-plugin</artifactId>',
    '        <version>2.4.21</version>',
    '        <configuration>',
    '          <jvmTarget>17</jvmTarget>',
    '        </configuration>',
    '        <executions>',
    '          <execution>',
    '            <phase>test-compile</phase>',
    '            <goals><goal>test-compile</goal></goals>',
    '            <configuration>',
    '              <sourceDirs><sourceDir>${project.basedir}/src/test/kotlin</sourceDir></sourceDirs>',
    '            </configuration>',
    '          </execution>',
    '        </executions>',
    '      </plugin>'
  ] : [];
  const pom = [
    '<project xmlns="http://maven.apache.org/POM/4.0.0">',
    '  <modelVersion>4.0.0</modelVersion>',
    '  <groupId>example</groupId>',
    '  <artifactId>starter-tests</artifactId>',
    '  <version>0.1.0</version>',
    '  <properties>',
    '    <maven.compiler.release>17</maven.compiler.release>',
    '    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>',
    '  </properties>',
    '  <dependencies>',
    '    <dependency>',
    '      <groupId>org.junit.jupiter</groupId>',
    '      <artifactId>junit-jupiter</artifactId>',
    '      <version>' + junitVersion + '</version>',
    '      <scope>test</scope>',
    '    </dependency>',
    ...kotlinDependency,
    '  </dependencies>',
    '  <build>',
    '    <plugins>',
    '      <plugin>',
    '        <groupId>org.apache.maven.plugins</groupId>',
    '        <artifactId>maven-compiler-plugin</artifactId>',
    '        <version>3.15.0</version>',
    '      </plugin>',
    ...kotlinPlugin,
    '      <plugin>',
    '        <groupId>org.apache.maven.plugins</groupId>',
    '        <artifactId>maven-surefire-plugin</artifactId>',
    '        <version>3.5.5</version>',
    '      </plugin>',
    '    </plugins>',
    '  </build>',
    '</project>',
    ''
  ];
  const source = kotlin ?
    'import org.junit.jupiter.api.Assertions.assertEquals\nimport org.junit.jupiter.api.Test\n\nclass ExampleTest {\n    @Test\n    fun addsTwoNumbers() {\n        assertEquals(5, add(2, 3))\n    }\n\n    private fun add(left: Int, right: Int): Int = left + right\n}\n' :
    'import org.junit.jupiter.api.Test;\nimport static org.junit.jupiter.api.Assertions.assertEquals;\n\nclass ExampleTest {\n    @Test\n    void addsTwoNumbers() {\n        assertEquals(5, add(2, 3));\n    }\n\n    private int add(int left, int right) {\n        return left + right;\n    }\n}\n';
  await fs.writeFile(path.join(directory, 'pom.xml'), pom.join('\n'), { flag: 'wx' });
  await fs.writeFile(path.join(directory, '.gitignore'), 'target/\n', { flag: 'wx' });
  await fs.writeFile(path.join(sourceDirectory, kotlin ? 'ExampleTest.kt' : 'ExampleTest.java'), source, { flag: 'wx' });
  await testInstructions(project, 'Run the JUnit example with Maven 3 and JDK 17 or newer.', 'mvn -f tests/pom.xml test');
}

async function addSwiftTests(project) {
  const manifest = path.join(project, 'Package.swift');
  const source = await fs.readFile(manifest, 'utf8');
  const updated = source.replace(/targets: \[\.executableTarget\(name: "App"\)\]/,
    'targets: [\n        .executableTarget(name: "App"),\n        .testTarget(name: "ExampleTests")\n    ]');
  if (updated === source) throw new Error('The Swift package does not contain the expected App target.');
  const directory = path.join(project, 'Tests', 'ExampleTests');
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'ExampleTests.swift'),
    'import XCTest\n\nfinal class ExampleTests: XCTestCase {\n    func testAdd() {\n        XCTAssertEqual(add(2, 3), 5)\n    }\n\n    private func add(_ left: Int, _ right: Int) -> Int {\n        left + right\n    }\n}\n', { flag: 'wx' });
  await fs.writeFile(manifest, updated);
  await testInstructions(project, 'Swift Package Manager runs the XCTest example.', 'swift test');
}

async function addDotnetTests(project, parent, framework, log) {
  const directory = path.join(project, 'tests');
  const name = 'Example.Tests';
  const rootProjects = (await fs.readdir(project)).filter(file => file.endsWith('.csproj'));
  await fs.mkdir(directory);
  await createDotnetProject({ shortName: framework, language: 'C#' }, name, directory, parent, log);
  const testProject = path.join(directory, name + '.csproj');
  const testManifest = await fs.readFile(testProject, 'utf8');
  await fs.writeFile(testProject, testManifest.replace(/<PropertyGroup>/,
    '<PropertyGroup>\n    <ManagePackageVersionsCentrally>false</ManagePackageVersionsCentrally>'));
  const xunit = framework === 'xunit';
  const source = xunit ?
    'using Xunit;\n\nnamespace Example.Tests;\n\npublic class ExampleTests\n{\n    [Fact]\n    public void AddsTwoNumbers()\n    {\n        Assert.Equal(5, Add(2, 3));\n    }\n\n    private static int Add(int left, int right) => left + right;\n}\n' :
    'using NUnit.Framework;\n\nnamespace Example.Tests;\n\npublic class ExampleTests\n{\n    [Test]\n    public void AddsTwoNumbers()\n    {\n        Assert.That(Add(2, 3), Is.EqualTo(5));\n    }\n\n    private static int Add(int left, int right) => left + right;\n}\n';
  await fs.writeFile(path.join(directory, 'UnitTest1.cs'), source);
  for (const file of rootProjects) {
    const target = path.join(project, file);
    const original = await fs.readFile(target, 'utf8');
    const updated = original.replace(/<\/Project>\s*$/, '  <ItemGroup>\n    <Compile Remove="tests/**/*.cs" />\n  </ItemGroup>\n</Project>\n');
    if (updated === original) throw new Error('Could not exclude test sources from the application project.');
    await fs.writeFile(target, updated);
  }
  await testInstructions(project, (xunit ? 'xUnit' : 'NUnit') + ' runs as a separate test project.', 'dotnet test tests/' + name + '.csproj');
}

module.exports = { addDotnetTests, addJvmTests, addSwiftTests, junitVersion, testInstructions };
