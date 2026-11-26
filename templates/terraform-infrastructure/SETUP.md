# Setup requirements: __PROJECT_NAME__

Everything you need before sharing this project and before turning on the CI pipelines. `README.md` explains the layout and how to add environments.

## Tools

| Tool | Version | Used for |
| --- | --- | --- |
| [Terraform](https://developer.hashicorp.com/terraform/install) | 1.9 or newer | Every command. Check with `terraform version`. |
| [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) (`az`) | current | Signing in and creating state storage. Only needed for remote state. |
| Git | any | Version control and CI. |

## What works without an account

The sample uses only the built-in `terraform_data` resource, so it needs **no cloud account, credentials, or provider downloads** to run:

```sh
terraform fmt -check -recursive infra
terraform -chdir=infra/envs/dev init
terraform -chdir=infra/envs/dev validate
terraform -chdir=infra/envs/dev test
terraform -chdir=infra/envs/dev plan "-var-file=terraform.tfvars.example"
```

You only need Azure access when you add provider resources to the modules, or when you store state remotely.

## Plan your subscription and permissions

The backend example stores state in Azure Storage. The identity that runs Terraform needs **Storage Blob Data Contributor** on the state storage account or container. When you add Azure resources, it also needs permission to create them, such as **Contributor** on the target subscription or resource group.

```sh
az login
az account set --subscription "YOUR_SUBSCRIPTION_NAME_OR_ID"
```

## Create the state storage (once)

Local state is fine while you experiment. Create storage before you share the project or turn on CI, because CI cannot keep local state between runs. Storage account names are global, 3 to 24 lowercase letters and numbers:

```sh
az group create --name rg-tfstate --location eastus
az storage account create --name mytfstate1234 --resource-group rg-tfstate \
  --sku Standard_LRS --min-tls-version TLS1_2 --allow-blob-public-access false
az storage account blob-service-properties update \
  --account-name mytfstate1234 --resource-group rg-tfstate --enable-versioning true
az storage container create --name terraform-state --account-name mytfstate1234 --auth-mode login
az role assignment create --assignee "$(az ad signed-in-user show --query id -o tsv)" \
  --role "Storage Blob Data Contributor" \
  --scope "$(az storage account show --name mytfstate1234 --resource-group rg-tfstate --query id -o tsv)"
```

Role assignments take a few minutes to apply. Each root keeps its own state, so each uses a different `key`:

| Root | Example key |
| --- | --- |
| `infra/envs/dev` | `dev/terraform.tfstate` |
| `infra/bootstrap-dev` | `bootstrap/dev/terraform.tfstate` |
| `infra/bootstrap-dev-scan-access` | `bootstrap/dev-scan-access/terraform.tfstate` |

For each root you want in remote state:

1. Copy `backend.tf.example` to `backend.tf`. Commit it.
2. Copy `backend.hcl.example` to `backend.hcl` and fill in the storage account name. Git ignores this file.
3. Run `terraform init -backend-config=backend.hcl -migrate-state` in that root.

The Azure Storage backend locks state with a blob lease automatically.

## Continuous integration

The project includes three ready-to-use pipelines for the `infra/envs/dev` root. Each one runs **Check** on every pull request: `terraform fmt -check` for the whole `infra` folder, then `init -backend=false`, `validate`, and `test`. Check needs no Azure account. Each also has **Plan** and **Apply** jobs that do nothing until you turn them on.

| Host | File | How to use it |
| --- | --- | --- |
| GitHub Actions | `.github/workflows/terraform.yml` | Active as soon as you push to GitHub. |
| GitLab CI | `ci/gitlab-ci.yml` | Copy to `.gitlab-ci.yml`. |
| Bitbucket Pipelines | `ci/bitbucket-pipelines.yml` | Copy to `bitbucket-pipelines.yml`. |

To run another environment, copy the root and change the working directory at the top of each file (`defaults.run.working-directory` in GitHub, `TF_ROOT` in GitLab, and the `cd` lines in Bitbucket).

Each file starts with comments that list its variables. Before you turn Plan and Apply on:

1. Create the state storage and commit `infra/envs/dev/backend.tf`, as described above. The pipeline stops with a message when it is missing, so CI never applies with state it would lose.
2. Set the variable **TF_BACKEND_CONFIG** to the full contents of `infra/envs/dev/backend.hcl`, and **TF_VARS** to your inputs as JSON, for example `{"project_name": "my-app", "environment": "dev"}`. The pipeline writes them to `backend.hcl` and `ci.auto.tfvars.json` in that folder.
3. Give the pipeline Azure access, as below.
4. Set **TERRAFORM_DEPLOY** to `true`.

### GitHub Actions: federated credentials (no stored secrets)

```sh
APP_ID=$(az ad app create --display-name terraform-ci --query appId --output tsv)
az ad sp create --id "$APP_ID"
az role assignment create --assignee "$APP_ID" --role "Storage Blob Data Contributor" \
  --scope "$(az storage account show --name mytfstate1234 --resource-group rg-tfstate --query id -o tsv)"
```

Add `Contributor` on the subscription when your modules create Azure resources. Azure checks the token's subject exactly, so create one federated credential for each way the workflow runs. Save each JSON as a file and pass it with `az ad app federated-credential create --id "$APP_ID" --parameters @file.json`:

| Name | Subject | Used by |
| --- | --- | --- |
| `github-pr` | `repo:OWNER/REPO:pull_request` | Plan on pull requests |
| `github-main` | `repo:OWNER/REPO:ref:refs/heads/main` | Plan on pushes to `main` |
| `github-production` | `repo:OWNER/REPO:environment:production` | Apply, which runs in the `production` environment |

```json
{
  "name": "github-production",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:OWNER/REPO:environment:production",
  "audiences": ["api://AzureADTokenExchange"]
}
```

Then add these **repository variables** in *Settings → Secrets and variables → Actions → Variables*: `AZURE_CLIENT_ID` (the app's `APP_ID`), `AZURE_TENANT_ID` (`az account show --query tenantId --output tsv`), `AZURE_SUBSCRIPTION_ID`, `TF_BACKEND_CONFIG`, `TF_VARS`, and `TERRAFORM_DEPLOY` set to `true`. For an approval step before Apply, open *Settings → Environments*, create **production**, and add required reviewers.

### GitLab CI and Bitbucket Pipelines

Add the variables listed at the top of the file in *Settings → CI/CD → Variables* (GitLab) or *Repository settings → Repository variables* (Bitbucket), and mark credentials as masked or secured: `ARM_CLIENT_ID`, `ARM_CLIENT_SECRET`, `ARM_TENANT_ID`, and `ARM_SUBSCRIPTION_ID`. Create the secret with `az ad app credential reset --id "$APP_ID"`. It expires, so note the date. Use your host's OIDC support with a federated credential when it is available.

## Troubleshooting

| Message | Cause and fix |
| --- | --- |
| `Failed to get existing workspaces` or `403` from the backend | Assign **Storage Blob Data Contributor** on the storage account and wait a few minutes. |
| `StorageAccountAlreadyTaken` | Storage account names are global. Choose another for the state account. |
| `Error acquiring the state lock` | Another run is using the state, or one was interrupted. Wait, or run `terraform force-unlock <ID>` when you are sure nothing is running. |
| `Backend configuration changed` | Run `terraform init -reconfigure`, or add `-migrate-state` to move existing state. |
| `AADSTS70021: No matching federated identity record found` | No federated credential matches the token's subject. Add the one for the event that failed. |
