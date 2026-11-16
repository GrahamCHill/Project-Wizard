const { createDotnetProject } = require('./projects');
const { writeStarter } = require('./starters');
const { applyProjectOptions } = require('./project-options');
const { createReactNativeProject } = require('./react-native');
const { createNpmProject } = require('./npm-generators');
const { createExternalProject } = require('./external-generators');
const { createWailsProject } = require('./wails');
const { extractZipTemplate } = require('./zip-templates');
const { initializeProjectGit } = require('./git-project');

async function writeProjectFiles(project, parent, { template, name, tools, options, initializeGit }, log) {
  switch (template.kind) {
    case 'dotnet': await createDotnetProject(template, name, project, parent, log); break;
    case 'starter': await writeStarter(template, name, project, parent, log, tools, options); break;
    case 'react-native': await createReactNativeProject(name, project, tools, log); break;
    case 'npm-generator': await createNpmProject(template, name, project, tools, log); break;
    case 'external-generator': await createExternalProject(template, name, project, tools, log); break;
    case 'wails': await createWailsProject(name, project, tools, options.build, log); break;
    case 'zip': await extractZipTemplate(template.archive, project, name); break;
    case 'empty': break;
    default: throw new Error('Unknown project template type.');
  }
  await applyProjectOptions(project, template, name, options, parent, log);
  await initializeProjectGit(project, parent, tools?.git?.file, initializeGit, log);
}

module.exports = { writeProjectFiles };
