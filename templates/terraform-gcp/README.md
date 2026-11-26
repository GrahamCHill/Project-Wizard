# __PROJECT_NAME__

Terraform for a Google Cloud VPC network and a private artifacts bucket.

Start with [SETUP.md](SETUP.md) for the tools, accounts, permissions, remote state, and CI pipelines (GitHub Actions, GitLab CI, and Bitbucket Pipelines). This file covers the configuration itself.

| File | Purpose |
| --- | --- |
| `versions.tf` | Terraform and provider versions, and the Google provider |
| `variables.tf` | Inputs with validation |
| `main.tf` | Custom-mode VPC, subnet, internal and IAP-only SSH firewall rules, and a versioned Cloud Storage bucket with public access prevented |
| `outputs.tf` | Names and links of what was created |
| `tests/main.tftest.hcl` | Plan-time tests that run against mock providers |
| `backend.tf.example`, `backend.hcl.example` | Cloud Storage remote state configuration |

## Requirements

- Terraform 1.9 or newer.
- An existing Google Cloud project with billing enabled and the Compute Engine API turned on.
- For `plan` and `apply`: Application Default Credentials from `gcloud auth application-default login`.

## Run the tests

The tests use mock providers, so they need no Google Cloud project or credentials. `init` still downloads the providers.

```sh
terraform fmt -check -recursive
terraform init -backend=false
terraform validate
terraform test
```

## Plan and apply

Copy `terraform.tfvars.example` to `terraform.tfvars` and set `project_id`. Git ignores `*.tfvars`.

```sh
terraform init
terraform plan
terraform apply
```

SSH to instances you add to this network through Identity-Aware Proxy, because the firewall only allows port 22 from Google's IAP range:

```sh
gcloud compute ssh INSTANCE --tunnel-through-iap
```

Run `terraform destroy` to remove everything. Set `bucket_force_destroy = true` first if the bucket contains objects.

## Remote state

State is local by default. To store it in Cloud Storage, create a bucket with versioning first, then copy `backend.tf.example` to `backend.tf` and `backend.hcl.example` to `backend.hcl`. Fill in the bucket and run:

```sh
terraform init -backend-config=backend.hcl -migrate-state
```

Commit `.terraform.lock.hcl` so everyone uses the same provider builds. Do not commit state files or `backend.hcl`.

## Add environments

Reuse this configuration with one `*.tfvars` file and one state prefix per environment, for example `-var-file=staging.tfvars` with `prefix = "__PROJECT_SLUG__/staging"`. Move the resources into modules when you need to share them across several roots.

[Google provider](https://registry.terraform.io/providers/hashicorp/google/latest/docs) · [Terraform tests](https://developer.hashicorp.com/terraform/language/tests) · [GCS backend](https://developer.hashicorp.com/terraform/language/backend/gcs)
