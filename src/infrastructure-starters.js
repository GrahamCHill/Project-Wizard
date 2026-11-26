const { starter } = require('./standard-templates');

const terraformRequirement = 'Terraform 1.9 or newer. The tests use mock providers and need no cloud account. Planning and applying need that provider’s credentials.';

// The GitHub Actions workflow is stored without its dot folder so packaging cannot drop it.
function terraformWorkflow(id) {
  return { ['terraform/' + id + '-github.yml']: '.github/workflows/terraform.yml' };
}

function terraformStarter(id, label, description) {
  return starter(id, 'infrastructure', 'Terraform', label, description, ['terraform'], [
    'README.md', 'SETUP.md', 'gitignore', 'versions.tf', 'variables.tf', 'main.tf', 'outputs.tf', 'terraform.tfvars.example',
    'backend.tf.example', 'backend.hcl.example', 'tests/main.tftest.hcl', 'ci/gitlab-ci.yml', 'ci/bitbucket-pipelines.yml'
  ], undefined, { requirement: terraformRequirement, sharedFiles: terraformWorkflow(id) });
}

const infrastructureStarters = [
  terraformStarter('terraform-aws', 'Terraform on AWS',
    'A VPC with public and private subnets and a versioned, encrypted S3 bucket, with plan-time tests.'),
  terraformStarter('terraform-gcp', 'Terraform on Google Cloud',
    'A custom VPC network with IAP-only SSH and a versioned Cloud Storage bucket, with plan-time tests.'),
  terraformStarter('terraform-azure', 'Terraform on Azure',
    'A resource group, virtual network with subnets, and a TLS 1.2 storage account, with plan-time tests.'),
  terraformStarter('terraform-linode', 'Terraform on Linode (Akamai Cloud)',
    'A VPC, an SSH-key server behind a default-deny firewall, and an Object Storage backend example, with plan-time tests.'),
  starter('kubernetes-kustomize', 'infrastructure', 'Kubernetes', 'Kubernetes with Kustomize',
    'A hardened web workload with a base and dev and prod overlays that render without a cluster.',
    ['kubectl'], [
      'README.md',
      'k8s/base/kustomization.yaml', 'k8s/base/serviceaccount.yaml', 'k8s/base/deployment.yaml', 'k8s/base/service.yaml',
      'k8s/base/poddisruptionbudget.yaml', 'k8s/base/networkpolicy.yaml',
      'k8s/overlays/dev/kustomization.yaml', 'k8s/overlays/dev/namespace.yaml',
      'k8s/overlays/prod/kustomization.yaml', 'k8s/overlays/prod/namespace.yaml',
      'k8s/overlays/prod/horizontalpodautoscaler.yaml'
    ], undefined, {
      requirement: 'kubectl 1.27 or newer. Rendering the manifests needs no cluster; deploying needs one.'
    }),
  starter('helm-chart', 'infrastructure', 'Helm', 'Helm Chart',
    'A Kubernetes application chart with a values schema, optional Ingress and autoscaling, and a connection test.',
    ['helm'], [
      'README.md',
      'chart/Chart.yaml', 'chart/.helmignore', 'chart/values.yaml', 'chart/values.schema.json',
      'chart/templates/_helpers.tpl', 'chart/templates/deployment.yaml', 'chart/templates/service.yaml',
      'chart/templates/serviceaccount.yaml', 'chart/templates/ingress.yaml', 'chart/templates/hpa.yaml',
      'chart/templates/NOTES.txt', 'chart/templates/tests/test-connection.yaml'
    ], undefined, {
      requirement: 'Helm 3.8 or newer. Linting and rendering need no cluster; installing needs one.'
    }),
  starter('ansible-playbook', 'infrastructure', 'Ansible', 'Ansible Playbook',
    'A playbook with common and NGINX roles that configure Debian or Ubuntu servers behind a firewall.',
    ['ansible'], [
      'README.md', 'gitignore', 'ansible.cfg', 'requirements.yml', 'site.yml', 'inventory/hosts.yml',
      'inventory/group_vars/all.yml', 'roles/common/defaults/main.yml', 'roles/common/tasks/main.yml',
      'roles/webserver/defaults/main.yml', 'roles/webserver/tasks/main.yml', 'roles/webserver/templates/index.html.j2'
    ], undefined, {
      platforms: ['darwin', 'linux'],
      requirement: 'ansible-core 2.15 or newer on Linux, macOS, or WSL, and Debian or Ubuntu servers reachable over SSH.'
    })
];

infrastructureStarters.push(
  starter('aws-sam-app', 'infrastructure', 'AWS SAM', 'AWS SAM Serverless API',
    'A Lambda function behind an HTTP API with a DynamoDB table, local invoke events, and unit tests.',
    ['sam'], [
      'gitignore', 'template.yaml', 'samconfig.toml', 'src/app.py', 'src/requirements.txt', 'tests/test_app.py',
      'events/create-item.json', 'events/list-items.json'
    ], ['sam validate --lint', 'python3 -m unittest discover -s tests', 'sam build', 'sam local invoke ItemsFunction --event events/list-items.json', 'sam deploy --guided'], {
      requirement: 'AWS SAM CLI 1.100 or newer. The unit tests need only Python 3.11 or newer. Local invoke and building in a container need Docker, and deploying needs AWS credentials.',
      note: [
        'The Python handler serves `GET /items`, `POST /items`, and `GET /items/{id}` for an API Gateway HTTP API. The function runs on arm64 with permissions limited to its own table, logs are kept 14 days, and the table is encrypted with point-in-time recovery on.',
        '',
        'The unit tests replace DynamoDB with a fake, so they need no AWS account and no boto3. `sam validate --lint` checks the template. `sam local invoke` runs the function in Docker, and `sam deploy --guided` deploys it and saves your answers in `samconfig.toml`. `sam delete` removes the stack.',
        '',
        'The table uses `DeletionPolicy: Delete` so cleanup is easy. Change it to `Retain` before the table holds real data. The SAM CLI sends anonymous usage data to AWS. Set `SAM_CLI_TELEMETRY=0` to turn that off.'
      ].join('\n')
    }),
  starter('cloudformation-aws', 'infrastructure', 'CloudFormation', 'AWS CloudFormation',
    'A VPC with public and private subnets and a private, encrypted S3 bucket, linted by cfn-lint in GitHub Actions.',
    [], ['README.md', 'gitignore', 'template.yaml'], undefined, {
      requirement: 'No tools are needed to create it. Linting uses cfn-lint (pip), and deploying uses the AWS CLI and AWS credentials.',
      sharedFiles: { 'iac/cloudformation-aws-github.yml': '.github/workflows/cloudformation.yml' }
    }),
  starter('azure-bicep', 'infrastructure', 'Bicep', 'Azure Bicep',
    'A virtual network with subnets and a private storage account in two modules, with a GitHub Actions what-if and deploy workflow.',
    ['bicep'], [
      'README.md', 'gitignore', 'main.bicep', 'main.bicepparam', 'bicepconfig.json', 'modules/network.bicep', 'modules/storage.bicep'
    ], undefined, {
      requirement: 'Bicep CLI 0.24 or newer, or the Azure CLI, which installs Bicep with az bicep install. Deploying needs an Azure subscription.',
      sharedFiles: { 'iac/azure-bicep-github.yml': '.github/workflows/bicep.yml' }
    })
);

module.exports = { infrastructureStarters, terraformWorkflow };
