# __PROJECT_NAME__

Terraform for an Akamai Cloud (Linode) VPC, a firewalled server, and SSH-key access.

Start with [SETUP.md](SETUP.md) for the tools, accounts, permissions, remote state, and CI pipelines (GitHub Actions, GitLab CI, and Bitbucket Pipelines). This file covers the configuration itself.

| File | Purpose |
| --- | --- |
| `versions.tf` | Terraform and provider versions, and the Linode provider |
| `variables.tf` | Inputs with validation |
| `main.tf` | VPC and subnet, an Ubuntu server on the public network and the VPC, and a firewall that drops everything except SSH from your addresses |
| `outputs.tf` | The server address and an SSH command |
| `tests/main.tftest.hcl` | Plan-time tests that run against mock providers |
| `backend.tf.example`, `backend.hcl.example` | Object Storage (S3-compatible) remote state configuration |

## Requirements

- Terraform 1.9 or newer.
- For `plan` and `apply`: a [personal access token](https://techdocs.akamai.com/cloud-computing/docs/manage-personal-access-tokens) with read/write access to Linodes, Firewalls, and VPCs, exported as `LINODE_TOKEN`.

## Run the tests

The tests use mock providers, so they need no Linode account or token. `init` still downloads the providers.

```sh
terraform fmt -check -recursive
terraform init -backend=false
terraform validate
terraform test
```

## Plan and apply

Copy `terraform.tfvars.example` to `terraform.tfvars`, then set `authorized_keys` to your public SSH key and `ssh_allowed_cidrs` to your own address. Git ignores `*.tfvars`.

```sh
export LINODE_TOKEN=...
terraform init
terraform plan
terraform apply
```

On Windows PowerShell, set the token with `$env:LINODE_TOKEN = "..."`. After `apply`, run the command shown by `terraform output ssh_command`. The server bills hourly until you run `terraform destroy`.

The provider requires a root password when it creates a server from an image. Terraform generates one and stores it in state, so keep your state private, sign in with your SSH key, and rotate or lock the password after the first boot.

## Remote state

State is local by default. To store it in Linode Object Storage, create a bucket and access key first, then copy `backend.tf.example` to `backend.tf` and `backend.hcl.example` to `backend.hcl`. Set the bucket and your region's endpoint, export the access key as `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`, and run:

```sh
terraform init -backend-config=backend.hcl -migrate-state
```

Commit `.terraform.lock.hcl` so everyone uses the same provider builds. Do not commit state files or `backend.hcl`.

## Next steps

Configure the server with the **Ansible Playbook** starter, using the address from `terraform output instance_ipv4`. Add one `*.tfvars` file and one state key per environment when you need staging or production copies.

[Linode provider](https://registry.terraform.io/providers/linode/linode/latest/docs) · [Terraform tests](https://developer.hashicorp.com/terraform/language/tests) · [Akamai Cloud and Terraform](https://techdocs.akamai.com/cloud-computing/docs/terraform)
