# Setup requirements: __PROJECT_NAME__ on Azure

Everything you need before the first `terraform apply`, and before turning on the CI pipelines. `README.md` explains what the configuration creates.

## Tools

| Tool | Version | Used for |
| --- | --- | --- |
| [Terraform](https://developer.hashicorp.com/terraform/install) | 1.9 or newer | Every command. Check with `terraform version`. |
| [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) (`az`) | current | Signing in and creating the state storage. |
| Git | any | Version control and CI. |

You do not need any cloud tool to run `terraform test`. The tests use mock providers.

## Azure subscription and permissions

You need an Azure subscription. The identity that runs Terraform needs:

| Role | Scope | Why |
| --- | --- | --- |
| `Contributor` | The subscription | Creates the resource group, virtual network, security group, and storage account. |
| `Storage Blob Data Contributor` | The state storage account or container | Reads and writes state with Azure AD sign-in. |

If your organization pre-creates the resource group and denies subscription-level rights, ask for Contributor on that group and change `azurerm_resource_group.main` into a `data` source.

Resource providers register on first use for most subscriptions. If you see a `MissingSubscriptionRegistration` error, register them once:

```sh
az provider register --namespace Microsoft.Network
az provider register --namespace Microsoft.Storage
```

## Sign in on your computer

```sh
az login
az account list --output table
az account set --subscription "YOUR_SUBSCRIPTION_NAME_OR_ID"
az account show --query id --output tsv
```

Terraform uses the Azure CLI's active subscription. To pin one, set `subscription_id` in your `terraform.tfvars`, or set `ARM_SUBSCRIPTION_ID`. In PowerShell, use `$env:ARM_SUBSCRIPTION_ID = "..."`.

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

Role assignments take a few minutes to apply. Then switch the project to the storage:

1. Copy `backend.tf.example` to `backend.tf`. Commit it.
2. Copy `backend.hcl.example` to `backend.hcl` and fill in the resource group, storage account, container, and key. Git ignores this file.
3. Run `terraform init -backend-config=backend.hcl -migrate-state`.

The Azure Storage backend locks state with a blob lease automatically.

## First run

```sh
terraform init
terraform plan -var-file=terraform.tfvars.example
terraform apply -var-file=terraform.tfvars.example
```

This creates a resource group, a virtual network with two subnets, a network security group, and a storage account. A storage account costs a small amount per GB. Run `terraform destroy` when you finish experimenting.

## Continuous integration

The project includes three ready-to-use pipelines. Each one runs **Check** on every pull request: `terraform fmt -check`, `init -backend=false`, `validate`, and `test`. Check needs no Azure subscription. Each also has **Plan** and **Apply** jobs that do nothing until you turn them on.

| Host | File | How to use it |
| --- | --- | --- |
| GitHub Actions | `.github/workflows/terraform.yml` | Active as soon as you push to GitHub. |
| GitLab CI | `ci/gitlab-ci.yml` | Copy to `.gitlab-ci.yml`. |
| Bitbucket Pipelines | `ci/bitbucket-pipelines.yml` | Copy to `bitbucket-pipelines.yml`. |

Each file starts with comments that list its variables. Before you turn Plan and Apply on:

1. Create the state storage and commit `backend.tf`, as described above. The pipeline stops with a message when `backend.tf` is missing, so CI never applies with state it would lose.
2. Set the variable **TF_BACKEND_CONFIG** to the full contents of your `backend.hcl`, and **TF_VARS** to your non-secret inputs as JSON, for example `{"name": "my-app", "environment": "prod"}`. The pipeline writes them to `backend.hcl` and `ci.auto.tfvars.json`.
3. Give the pipeline Azure access, as below.
4. Set **TERRAFORM_DEPLOY** to `true`.

### GitHub Actions: federated credentials (no stored secrets)

Create an app registration and service principal for CI, and trust your repository. Replace `OWNER/REPO` and the IDs.

```sh
APP_ID=$(az ad app create --display-name terraform-ci --query appId --output tsv)
az ad sp create --id "$APP_ID"
SUBSCRIPTION_ID=$(az account show --query id --output tsv)
az role assignment create --assignee "$APP_ID" --role Contributor --scope "/subscriptions/$SUBSCRIPTION_ID"
az role assignment create --assignee "$APP_ID" --role "Storage Blob Data Contributor" \
  --scope "$(az storage account show --name mytfstate1234 --resource-group rg-tfstate --query id -o tsv)"
```

Azure checks the token's subject exactly, so create one federated credential for each way the workflow runs. Save each JSON as a file and pass it with `--parameters @file.json`:

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

```sh
az ad app federated-credential create --id "$APP_ID" --parameters @github-production.json
```

Then add these **repository variables** in *Settings → Secrets and variables → Actions → Variables*:

| Variable | Value |
| --- | --- |
| `AZURE_CLIENT_ID` | The app's `APP_ID` |
| `AZURE_TENANT_ID` | `az account show --query tenantId --output tsv` |
| `AZURE_SUBSCRIPTION_ID` | The subscription ID |
| `TF_BACKEND_CONFIG` | Contents of `backend.hcl` |
| `TF_VARS` | Inputs as JSON |
| `TERRAFORM_DEPLOY` | `true` |

For an approval step before Apply, open *Settings → Environments*, create **production**, and add required reviewers.

### GitLab CI and Bitbucket Pipelines

Add the variables listed at the top of the file in *Settings → CI/CD → Variables* (GitLab) or *Repository settings → Repository variables* (Bitbucket), and mark credentials as masked or secured: `ARM_CLIENT_ID`, `ARM_CLIENT_SECRET`, `ARM_TENANT_ID`, and `ARM_SUBSCRIPTION_ID`. Create the secret with `az ad app credential reset --id "$APP_ID"`. It expires, so note the date. Use your host's OIDC support with a federated credential when it is available.

## Troubleshooting

| Message | Cause and fix |
| --- | --- |
| `subscription ID could not be determined` | Run `az account set`, or set `subscription_id` or `ARM_SUBSCRIPTION_ID`. |
| `MissingSubscriptionRegistration` | Register the resource provider with `az provider register`, as above. |
| `AuthorizationFailed` | The identity lacks Contributor on the subscription. |
| `Failed to get existing workspaces` or `403` from the backend | Assign **Storage Blob Data Contributor** on the storage account and wait a few minutes. |
| `StorageAccountAlreadyTaken` | Storage account names are global. Choose another for the state account. |
| `AADSTS70021: No matching federated identity record found` | No federated credential matches the token's subject. Add the one for the event that failed, as in the table above. |
| `Error acquiring the state lock` | Another run is using the state, or one was interrupted. Wait, or run `terraform force-unlock <ID>` when you are sure nothing is running. |
