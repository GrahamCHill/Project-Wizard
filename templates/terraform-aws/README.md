# __PROJECT_NAME__

Terraform for an AWS network and a private artifacts bucket.

Start with [SETUP.md](SETUP.md) for the tools, accounts, permissions, remote state, and CI pipelines (GitHub Actions, GitLab CI, and Bitbucket Pipelines). This file covers the configuration itself.

| File | Purpose |
| --- | --- |
| `versions.tf` | Terraform and provider versions, and the AWS provider with default tags |
| `variables.tf` | Inputs with validation |
| `main.tf` | VPC, public and private subnets, internet gateway, routing, and a versioned, encrypted S3 bucket with public access blocked |
| `outputs.tf` | IDs and names of what was created |
| `tests/main.tftest.hcl` | Plan-time tests that run against mock providers |
| `backend.tf.example`, `backend.hcl.example` | S3 remote state configuration |

## Requirements

- Terraform 1.9 or newer.
- For `plan` and `apply`: AWS credentials from `aws configure`, SSO, or the `AWS_*` environment variables.

## Run the tests

The tests use mock providers, so they need no AWS account or credentials. `init` still downloads the providers.

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

Copy `terraform.tfvars.example` to `terraform.tfvars` for your own values. Git ignores `*.tfvars`. Keep `availability_zones` inside the selected `region`.

The network has no NAT gateway, so private subnets cannot reach the internet and this starter has no hourly network charges. Add a NAT gateway and a private route table when your workloads need outbound access. Run `terraform destroy` to remove everything. Set `bucket_force_destroy = true` first if the bucket contains objects.

## Remote state

State is local by default. To store it in S3, create the bucket first, then copy `backend.tf.example` to `backend.tf` and `backend.hcl.example` to `backend.hcl`. Fill in the bucket and key and run:

```sh
terraform init -backend-config=backend.hcl -migrate-state
```

Commit `.terraform.lock.hcl` so everyone uses the same provider builds. Do not commit state files or `backend.hcl`.

## Add environments

Reuse this configuration with one `*.tfvars` file and one state key per environment, for example `-var-file=staging.tfvars` with `key = "__PROJECT_SLUG__/staging/terraform.tfstate"`. Move the resources into modules when you need to share them across several roots.

[AWS provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs) · [Terraform tests](https://developer.hashicorp.com/terraform/language/tests) · [S3 backend](https://developer.hashicorp.com/terraform/language/backend/s3)
