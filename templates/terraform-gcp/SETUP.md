# Setup requirements: __PROJECT_NAME__ on Google Cloud

Everything you need before the first `terraform apply`, and before turning on the CI pipelines. `README.md` explains what the configuration creates.

## Tools

| Tool | Version | Used for |
| --- | --- | --- |
| [Terraform](https://developer.hashicorp.com/terraform/install) | 1.9 or newer | Every command. Check with `terraform version`. |
| [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) (`gcloud`) | current | Signing in, enabling APIs, and creating the state bucket. |
| Git | any | Version control and CI. |

You do not need any cloud tool to run `terraform test`. The tests use mock providers.

## Google Cloud project and permissions

You need an existing project with **billing enabled**. Copy its ID (not its name) into `project_id` in your `terraform.tfvars`. Then enable the APIs that the configuration and CI use:

```sh
gcloud config set project YOUR_PROJECT_ID
gcloud services enable compute.googleapis.com storage.googleapis.com \
  iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com cloudresourcemanager.googleapis.com
```

The identity that runs Terraform needs these roles on the project:

| Role | Why |
| --- | --- |
| `roles/compute.networkAdmin` | VPC network and subnet |
| `roles/compute.securityAdmin` | Firewall rules, which Network Admin can only read |
| `roles/storage.admin` | The artifacts bucket |

`roles/editor` or `roles/owner` also work in a sandbox project. Use the narrower roles on anything shared. The identity also needs `roles/storage.objectAdmin` on the state bucket.

## Sign in on your computer

Terraform uses Application Default Credentials:

```sh
gcloud auth login
gcloud auth application-default login
gcloud auth application-default set-quota-project YOUR_PROJECT_ID
```

On a shared machine, or to run as a service account, set `GOOGLE_APPLICATION_CREDENTIALS` to a key file or use `gcloud auth application-default login --impersonate-service-account=SERVICE_ACCOUNT_EMAIL`.

## Create the state bucket (once)

Local state is fine while you experiment. Create a bucket before you share the project or turn on CI, because CI cannot keep local state between runs. Bucket names are global, so pick a unique one:

```sh
gcloud storage buckets create gs://my-terraform-state-1234 \
  --location=us-central1 --uniform-bucket-level-access --public-access-prevention
gcloud storage buckets update gs://my-terraform-state-1234 --versioning
```

Then switch the project to the bucket:

1. Copy `backend.tf.example` to `backend.tf`. Commit it.
2. Copy `backend.hcl.example` to `backend.hcl` and fill in the bucket and prefix. Git ignores this file.
3. Run `terraform init -backend-config=backend.hcl -migrate-state`.

The Cloud Storage backend locks state automatically.

## First run

```sh
terraform init
terraform plan
terraform apply
```

This creates a VPC network, a subnet, two firewall rules, and a bucket. None of them has an hourly charge. SSH reaches instances you add later only through [Identity-Aware Proxy](https://cloud.google.com/iap/docs/using-tcp-forwarding), with `gcloud compute ssh INSTANCE --tunnel-through-iap`, and your user needs `roles/iap.tunnelResourceAccessor`. Run `terraform destroy` when you finish experimenting.

## Continuous integration

The project includes three ready-to-use pipelines. Each one runs **Check** on every pull request: `terraform fmt -check`, `init -backend=false`, `validate`, and `test`. Check needs no Google Cloud project. Each also has **Plan** and **Apply** jobs that do nothing until you turn them on.

| Host | File | How to use it |
| --- | --- | --- |
| GitHub Actions | `.github/workflows/terraform.yml` | Active as soon as you push to GitHub. |
| GitLab CI | `ci/gitlab-ci.yml` | Copy to `.gitlab-ci.yml`. |
| Bitbucket Pipelines | `ci/bitbucket-pipelines.yml` | Copy to `bitbucket-pipelines.yml`. |

Each file starts with comments that list its variables. Before you turn Plan and Apply on:

1. Create the state bucket and commit `backend.tf`, as described above. The pipeline stops with a message when `backend.tf` is missing, so CI never applies with state it would lose.
2. Set the variable **TF_BACKEND_CONFIG** to the full contents of your `backend.hcl`, and **TF_VARS** to your non-secret inputs as JSON. `project_id` has no default, so include it, for example `{"project_id": "my-project-123", "environment": "prod"}`. The pipeline writes them to `backend.hcl` and `ci.auto.tfvars.json`.
3. Give the pipeline Google Cloud access, as below.
4. Set **TERRAFORM_DEPLOY** to `true`.

### GitHub Actions: workload identity federation (no stored keys)

Run these once per project. Replace `PROJECT_ID`, `PROJECT_NUMBER` (find it with `gcloud projects describe PROJECT_ID --format="value(projectNumber)"`), and `OWNER/REPO`.

```sh
gcloud iam workload-identity-pools create github \
  --project=PROJECT_ID --location=global --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc github-provider \
  --project=PROJECT_ID --location=global --workload-identity-pool=github \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='OWNER/REPO'"

gcloud iam service-accounts create terraform-ci --project=PROJECT_ID

gcloud iam service-accounts add-iam-policy-binding \
  terraform-ci@PROJECT_ID.iam.gserviceaccount.com --project=PROJECT_ID \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/OWNER/REPO"
```

Give the `terraform-ci` service account the project roles in the table above, plus `roles/storage.objectAdmin` on the state bucket. Then add these **repository variables** in *Settings → Secrets and variables → Actions → Variables*:

| Variable | Value |
| --- | --- |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/github-provider` |
| `GCP_SERVICE_ACCOUNT` | `terraform-ci@PROJECT_ID.iam.gserviceaccount.com` |
| `TF_BACKEND_CONFIG` | Contents of `backend.hcl` |
| `TF_VARS` | Inputs as JSON, including `project_id` |
| `TERRAFORM_DEPLOY` | `true` |

The attribute condition limits the pool to your repository. For an approval step before Apply, open *Settings → Environments*, create **production**, and add required reviewers.

### GitLab CI and Bitbucket Pipelines

Add the variables listed at the top of the file in *Settings → CI/CD → Variables* (GitLab) or *Repository settings → Repository variables* (Bitbucket), and mark credentials as masked or secured. `GOOGLE_CREDENTIALS` holds the JSON key of the `terraform-ci` service account (`gcloud iam service-accounts keys create key.json --iam-account=...`). A key does not expire on its own, so rotate it and delete the file. Use workload identity federation with your host's OIDC support when it is available.

## Troubleshooting

| Message | Cause and fix |
| --- | --- |
| `could not find default credentials` | Run `gcloud auth application-default login`. |
| `Compute Engine API has not been used in project` | Run the `gcloud services enable` command above and wait a minute. |
| `Error 403: ... billing` | Link a billing account to the project. |
| `Invalid value for "project_id"` | Use the project ID, such as `my-project-123`, not its display name. |
| `Error 403: ... compute.firewalls.create` | Add `roles/compute.securityAdmin`. Network Admin cannot create firewall rules. |
| `The given name ... is not a valid name` for a network | Resource names must start with a letter. The configuration adds a `p-` prefix to names that start with a digit. |
| `Error acquiring the state lock` | Another run is using the state, or one was interrupted. Wait, or run `terraform force-unlock <ID>` when you are sure nothing is running. |
| `Unable to acquire impersonated credentials` in CI | The service account lacks `roles/iam.workloadIdentityUser` for your repository, or the attribute condition does not match `OWNER/REPO`. |
