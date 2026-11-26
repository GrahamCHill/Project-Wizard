# __PROJECT_NAME__

Terraform for an Azure virtual network and a private artifacts storage account.

Start with [SETUP.md](SETUP.md) for the tools, accounts, permissions, remote state, and CI pipelines (GitHub Actions, GitLab CI, and Bitbucket Pipelines). This file covers the configuration itself.

| File | Purpose |
| --- | --- |
| `versions.tf` | Terraform and provider versions, and the AzureRM provider |
| `variables.tf` | Inputs with validation |
| `main.tf` | Resource group, virtual network, subnets, a network security group that blocks inbound internet traffic, and a TLS 1.2 storage account with blob versioning and a private container |
| `outputs.tf` | Names and IDs of what was created |
| `tests/main.tftest.hcl` | Plan-time tests that run against mock providers |
| `backend.tf.example`, `backend.hcl.example` | Azure Storage remote state configuration |

## Requirements

- Terraform 1.9 or newer.
- For `plan` and `apply`: the Azure CLI signed in with `az login`, or a service principal in the `ARM_*` environment variables. Set `ARM_SUBSCRIPTION_ID` or the `subscription_id` variable when you have more than one subscription.

## Run the tests

The tests use mock providers, so they need no Azure subscription or credentials. `init` still downloads the providers.

```sh
terraform fmt -check -recursive
terraform init -backend=false
terraform validate
terraform test
```

## Plan and apply

```sh
terraform init
terraform plan -var-file=terraform.tfvars.example
terraform apply -var-file=terraform.tfvars.example
```

Copy `terraform.tfvars.example` to `terraform.tfvars` for your own values. Git ignores `*.tfvars`. Add entries to the `subnets` variable to create more `/24` subnets. Run `terraform destroy` to remove everything.

## Remote state

State is local by default. To store it in Azure Storage, create the storage account and container first, then copy `backend.tf.example` to `backend.tf` and `backend.hcl.example` to `backend.hcl`. Fill in your values and run:

```sh
terraform init -backend-config=backend.hcl -migrate-state
```

`use_azuread_auth` uses your Azure identity, so it needs the **Storage Blob Data Contributor** role on the container. Commit `.terraform.lock.hcl` so everyone uses the same provider builds. Do not commit state files or `backend.hcl`.

## Add environments

Reuse this configuration with one `*.tfvars` file and one state key per environment, for example `-var-file=staging.tfvars` with `key = "__PROJECT_SLUG__/staging/terraform.tfstate"`. Move the resources into modules when you need to share them across several roots. For a ready-made environment and bootstrap layout, see the **Terraform Infrastructure** starter.

[AzureRM provider](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs) · [Terraform tests](https://developer.hashicorp.com/terraform/language/tests) · [AzureRM backend](https://developer.hashicorp.com/terraform/language/backend/azurerm)
