const tools = ['docker', 'docker-compose', 'docker-linux'];
const requirement = 'Docker with the Compose plugin and a running Linux container engine.';
const apiFiles = {
  'docker/compose-api.yaml': 'compose.yaml',
  'docker/gitignore': '.gitignore',
  'docker/dockerignore': '.dockerignore'
};
const pythonFiles = { ...apiFiles, 'docker/Dockerfile.python': 'Dockerfile' };

function dockerStarter(id, label, language, description, options) {
  return {
    id: 'docker-' + id, kind: 'starter', group: 'docker', docker: true, label, language, description,
    tools, requirement, next: 'Follow the Docker Compose commands in README.md.', ...options
  };
}

function variant(id, label, sourceDirectory, files, language) {
  return { id, label, sourceDirectory, files, language };
}

const dockerStarters = [
  dockerStarter('python', 'Python Backend', 'Python',
    'A JSON API with health and greeting endpoints in FastAPI, Flask, or Django.', {
      choiceLabel: 'Python framework', sharedFiles: pythonFiles, files: [],
      variants: [
        variant('fastapi', 'FastAPI', 'docker-python/fastapi', ['app.py', 'requirements.txt']),
        variant('flask', 'Flask', 'docker-python/flask', ['app.py', 'requirements.txt']),
        variant('django', 'Django', 'docker-python/django', ['app.py', 'requirements.txt'])
      ]
    }),
  dockerStarter('spring', 'Spring Boot Backend', undefined,
    'A Maven-built Spring Boot JSON API in Java or Kotlin.', {
      choiceLabel: 'Spring Boot language', sharedFiles: { ...apiFiles, 'docker/Dockerfile.spring': 'Dockerfile' }, files: [],
      variants: [
        variant('java', 'Java', 'docker-spring/java', ['pom.xml', 'src/main/java/example/app/Application.java'], 'Java'),
        variant('kotlin', 'Kotlin', 'docker-spring/kotlin', ['pom.xml', 'src/main/kotlin/example/app/Application.kt'], 'Kotlin')
      ]
    }),
  dockerStarter('go', 'Go Backend', 'Go',
    'A small net/http JSON API compiled into a minimal container.', {
      files: ['Dockerfile', 'go.mod', 'main.go', 'main_test.go'], sharedFiles: apiFiles
    }),
  dockerStarter('rust', 'Rust Backend (Axum)', 'Rust',
    'A small async JSON API using Axum and Tokio.', {
      files: ['Dockerfile', 'Cargo.toml', 'Cargo.lock', 'src/main.rs'], sharedFiles: apiFiles
    }),
  dockerStarter('frontend', 'Node.js Frontend (Vite)', 'JavaScript',
    'A Vite counter app in React, Vue, or vanilla JavaScript, served from a container.', {
      choiceLabel: 'Frontend framework', files: [],
      variants: [
        variant('react', 'React', 'docker-frontend/react', ['package.json', 'package-lock.json', 'src/main.js', 'src/App.jsx']),
        variant('vue', 'Vue', 'docker-frontend/vue', ['package.json', 'package-lock.json', 'vite.config.js', 'src/main.js', 'src/App.vue']),
        variant('vanilla', 'Vanilla JavaScript', 'docker-frontend/vanilla', ['package.json', 'package-lock.json', 'src/main.js'])
      ],
      sharedFiles: {
        'docker/compose-frontend.yaml': 'compose.yaml', 'docker/Dockerfile.frontend': 'Dockerfile', 'docker/nginx.conf': 'nginx.conf',
        'docker/index.html': 'index.html', 'docker/style.css': 'src/style.css',
        'docker/gitignore': '.gitignore', 'docker/dockerignore': '.dockerignore'
      }
    }),
  dockerStarter('qdrant', 'Qdrant Vector Database', undefined,
    'A persistent Qdrant instance with a script that inserts example vectors and runs a similarity search.', {
      files: ['compose.yaml', 'demo.py', 'README.md']
    }),
  dockerStarter('rag', 'Local RAG (Ollama)', 'Python',
    'A FastAPI document Q&A service with Ollama, Qdrant or PostgreSQL with pgvector, and source excerpts.', {
      choiceLabel: 'Vector database', files: [],
      variants: [
        variant('qdrant', 'Qdrant', 'docker-rag/qdrant', ['compose.override.yaml', 'requirements.txt', 'vector_store.py']),
        variant('pgvector', 'PostgreSQL (pgvector)', 'docker-rag/pgvector',
          ['compose.override.yaml', 'requirements.txt', 'vector_store.py', 'db/init.sql'])
      ],
      sharedFiles: {
        'docker/Dockerfile.python': 'Dockerfile', 'docker/gitignore': '.gitignore', 'docker/dockerignore': '.dockerignore',
        'docker/rag/compose.yaml': 'compose.yaml', 'docker/rag/app.py': 'app.py', 'docker/rag/README.md': 'README.md',
        'docker/rag/docs/returns.md': 'docs/returns.md', 'docker/rag/docs/shipping.md': 'docs/shipping.md'
      }
    }),
  dockerStarter('onnx', 'Cloud ONNX Inference API', 'Python',
    'Serve a trained ONNX model over HTTP from the container, a mounted file, or an HTTPS model URL.', {
      files: ['Dockerfile', 'compose.override.yaml', 'app.py', 'train_sample.py', 'requirements.txt', 'predict.json', 'models/README.md', 'README.md'],
      sharedFiles: apiFiles
    })
];

function resolveDockerStarter(template, build) {
  const variant = template.variants?.find(choice => choice.id === build) || template.variants?.[0];
  const scaffold = variant ? { ...template, sourceDirectory: variant.sourceDirectory, files: variant.files } : template;
  if (scaffold.files.includes('README.md') || Object.values(scaffold.sharedFiles || {}).includes('README.md')) return scaffold;
  const frontend = template.id === 'docker-frontend';
  const note = frontend ?
    'Open http://127.0.0.1:8080. Node.js builds the app and Nginx serves the compiled files. For local development, run `npm ci` and `npm run dev`.' :
    'Open http://127.0.0.1:8080/healthz and http://127.0.0.1:8080/hello for example JSON responses.' +
      (variant?.id === 'fastapi' ? ' Interactive API docs are at http://127.0.0.1:8080/docs.' : '') +
      (template.id === 'docker-python' ? ' The Dockerfile installs dependencies into a container-local virtual environment.' : '');
  return {
    ...scaffold,
    commands: ['docker compose up --build -d --wait'],
    note: note + ' Run `docker compose down` to stop the project. Set `APP_PORT` in a local `.env` file to change the host port.'
  };
}

module.exports = { dockerStarters, resolveDockerStarter };
