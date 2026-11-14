# __PROJECT_NAME__

The Terraform layout uses separate roots for development and bootstrap, with reusable modules under `infra/modules/`.

```text
infra/
  bootstrap-dev/              State bootstrap planning
  bootstrap-dev-scan-access/  Access bootstrap planning
  envs/dev/                   Development root and Terraform tests
  modules/ingestion/          Ingestion inputs and outputs
  modules/private_network/    Network inputs and outputs
```

Install Terraform 1.9 or newer. From the project folder, run:

```sh
terraform fmt -check -recursive infra
terraform -chdir=infra/envs/dev init
terraform -chdir=infra/envs/dev validate
terraform -chdir=infra/envs/dev test
terraform -chdir=infra/envs/dev plan "-var-file=terraform.tfvars.example"
```

The development root plans a built-in `terraform_data` example with names and settings from both modules. You can run it locally without cloud credentials. Each bootstrap root has its own working directory and state. The example bootstrap files describe where state and access resources fit in the layout.

## Add an environment

Use `infra/envs/dev/` as the starting point and give the new environment distinct variable values and state. Add provider resources to the relevant module and call it from the environment root. Keep environment-specific names and inputs in that root.

## Configure Azure remote state

The example uses local state. To adopt an existing Azure Storage backend, copy `infra/envs/dev/backend.tf.example` to `backend.tf` and `backend.hcl.example` to `backend.hcl` in the same directory. Fill in your storage account, container, and unique state key. Authenticate using your Azure identity and run `terraform -chdir=infra/envs/dev init -backend-config=backend.hcl`. Use `-migrate-state` when moving existing local state. Each bootstrap root includes backend examples with its own state key. Configure remote state for the state bootstrap root after the backend exists.

[Terraform module structure](https://developer.hashicorp.com/terraform/language/modules/develop/structure) · [AzureRM backend](https://developer.hashicorp.com/terraform/language/backend/azurerm)
