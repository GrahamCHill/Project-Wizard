# Setup requirements: __PROJECT_NAME__ on Linode (Akamai Cloud)

Everything you need before the first `terraform apply`, and before turning on the CI pipelines. `README.md` explains what the configuration creates.

## Tools

| Tool | Version | Used for |
| --- | --- | --- |
| [Terraform](https://developer.hashicorp.com/terraform/install) | 1.9 or newer | Every command. Check with `terraform version`. |
| An SSH client and key pair | any | Signing in to the server. `ssh-keygen -t ed25519` creates a key pair. |
| Git | any | Version control and CI. |
| [Linode CLI](https://www.linode.com/docs/products/tools/cli/get-started/) | optional | Looking up regions and plans. |

You do not need an account to run `terraform test`. The tests use mock providers.

## Account, API token, and SSH key

1. Create an Akamai Cloud (Linode) account and add a payment method.
2. In Cloud Manager, open *Profile → API Tokens* and create a **personal access token** with **Read/Write** access to **Linodes**, **Firewalls**, and **VPCs**. Set an expiry date, and copy the token once. It is not shown again.
3. Export it. Terraform's Linode provider reads `LINODE_TOKEN`:

```sh
export LINODE_TOKEN=your-token
```

In PowerShell, use `$env:LINODE_TOKEN = "your-token"`. Never put the token in a `.tf` or `.tfvars` file, and never commit it.

4. Copy your **public** key, which ends in `.pub`, into `authorized_keys` in your `terraform.tfvars`. Terraform refuses to plan without at least one key.
5. Set `ssh_allowed_cidrs` to your own address, such as `["203.0.113.10/32"]`. Find your public IPv4 address with your ISP's or router's status page. The firewall drops all other inbound traffic, so a wrong address locks you out of SSH until you fix the value and apply again. Do not use `0.0.0.0/0`.

Check region IDs and plan names before you change them. With the Linode CLI:

```sh
linode-cli regions list
linode-cli linodes types
```

## Create the state bucket (once)

Local state is fine while you experiment. Create a bucket before you share the project or turn on CI, because CI cannot keep local state between runs. Linode Object Storage speaks the S3 API:

1. In Cloud Manager, open *Object Storage* and create a bucket in your region. Bucket names are unique per region.
2. Create an **access key** limited to that bucket with read/write access.
3. Export the key pair. The S3 backend reads the AWS variable names:

```sh
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
```

Then switch the project to the bucket:

1. Copy `backend.tf.example` to `backend.tf`. Commit it.
2. Copy `backend.hcl.example` to `backend.hcl`. Fill in the bucket, key, region, and the endpoint for your region, such as `https://us-ord-1.linodeobjects.com`. Git ignores this file.
3. Run `terraform init -backend-config=backend.hcl -migrate-state`.

**This backend does not lock state.** Run Terraform from one place at a time. The GitHub workflow queues all runs in one group for this reason, and the GitLab file serializes its jobs.

## First run

```sh
terraform init
terraform plan
terraform apply
```

This creates a VPC, a subnet, a server, and a firewall. **The server bills hourly** until you run `terraform destroy`. After `apply`, connect with the command from `terraform output ssh_command`. Terraform also generates a root password because the provider requires one with an image. It is stored in state, so keep state private and sign in with your key.

## Continuous integration

The project includes three ready-to-use pipelines. Each one runs **Check** on every pull request: `terraform fmt -check`, `init -backend=false`, `validate`, and `test`. Check needs no Linode account. Each also has **Plan** and **Apply** jobs that do nothing until you turn them on.

| Host | File | How to use it |
| --- | --- | --- |
| GitHub Actions | `.github/workflows/terraform.yml` | Active as soon as you push to GitHub. |
| GitLab CI | `ci/gitlab-ci.yml` | Copy to `.gitlab-ci.yml`. |
| Bitbucket Pipelines | `ci/bitbucket-pipelines.yml` | Copy to `bitbucket-pipelines.yml`. |

Each file starts with comments that list its variables. Linode has no OIDC sign-in for CI, so pipelines use secrets. Before you turn Plan and Apply on:

1. Create the state bucket and commit `backend.tf`, as described above. The pipeline stops with a message when `backend.tf` is missing, so CI never applies with state it would lose.
2. Create a separate API token for CI with the same scopes, and an Object Storage key for the state bucket.
3. Add these **secrets**. In GitHub, use *Settings → Secrets and variables → Actions → Secrets*. In GitLab and Bitbucket, add masked or secured variables with the names from the top of the file.

| GitHub secret | GitLab or Bitbucket variable | Value |
| --- | --- | --- |
| `LINODE_TOKEN` | `LINODE_TOKEN` | The CI API token |
| `LINODE_OBJECT_STORAGE_ACCESS_KEY` | `AWS_ACCESS_KEY_ID` | The Object Storage access key |
| `LINODE_OBJECT_STORAGE_SECRET_KEY` | `AWS_SECRET_ACCESS_KEY` | The Object Storage secret key |

4. Set the variable **TF_BACKEND_CONFIG** to the full contents of your `backend.hcl`, and **TF_VARS** to your inputs as JSON. The SSH key and allowed addresses have no defaults, so include them:

```json
{
  "name": "my-app",
  "authorized_keys": ["ssh-ed25519 AAAA... you@example.com"],
  "ssh_allowed_cidrs": ["203.0.113.10/32"]
}
```

The pipeline writes these to `backend.hcl` and `ci.auto.tfvars.json`. A public key and an address are not secrets, but keep the file out of public logs.

5. Set **TERRAFORM_DEPLOY** to `true`. For an approval step before Apply on GitHub, open *Settings → Environments*, create **production**, and add required reviewers.

## Troubleshooting

| Message | Cause and fix |
| --- | --- |
| `Invalid Token` or `401` | `LINODE_TOKEN` is missing, expired, or lacks a scope. Create a new token. |
| `Provide at least one public SSH key` | Set `authorized_keys` in `terraform.tfvars`. |
| `Provide at least one valid IPv4 CIDR block` | Set `ssh_allowed_cidrs`, for example `["203.0.113.10/32"]`. |
| An error about an invalid label | Labels use letters, numbers, dashes, and underscores, and Linode limits their length. Shorten `name`. |
| `Connection timed out` over SSH | Your address changed. Update `ssh_allowed_cidrs` and apply again. |
| `error loading state: ... SignatureDoesNotMatch` | Wrong Object Storage keys, or the endpoint does not match the bucket's region. |
| `Backend configuration changed` | Run `terraform init -reconfigure`, or add `-migrate-state` to move existing state. |
