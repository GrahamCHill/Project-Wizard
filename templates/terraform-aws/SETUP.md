# Setup requirements: __PROJECT_NAME__ on AWS

Everything you need before the first `terraform apply`, and before turning on the CI pipelines. `README.md` explains what the configuration creates.

## Tools

| Tool | Version | Used for |
| --- | --- | --- |
| [Terraform](https://developer.hashicorp.com/terraform/install) | 1.9 or newer | Every command. Check with `terraform version`. |
| [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) | 2.x | Signing in and creating the state bucket. Terraform itself does not need it. |
| Git | any | Version control and CI. |

You do not need any cloud tool to run `terraform test`. The tests use mock providers.

## AWS account and permissions

You need an AWS account and an identity (an SSO user, an IAM user, or an assumed role) that may create what this configuration creates:

- **Network:** `ec2:CreateVpc`, `ModifyVpcAttribute`, `CreateSubnet`, `CreateInternetGateway`, `AttachInternetGateway`, `CreateRouteTable`, `CreateRoute`, `AssociateRouteTable`, `CreateTags`, `Describe*`, and the matching `Delete*`, `Detach*`, and `Disassociate*` actions for `terraform destroy`.
- **Bucket:** `s3:CreateBucket`, `DeleteBucket`, `PutBucketVersioning`, `PutEncryptionConfiguration`, `PutBucketPublicAccessBlock`, `PutBucketTagging`, and the matching `Get*` actions.
- **State:** `s3:ListBucket` on the state bucket and `s3:GetObject`, `PutObject`, and `DeleteObject` on your state key.

For a sandbox account, the managed policies `AmazonVPCFullAccess` and `AmazonS3FullAccess` cover all of it. Write a narrower policy before you use a shared or production account.

## Sign in on your computer

Use IAM Identity Center (SSO) when your organization has it:

```sh
aws configure sso
aws sso login --profile my-profile
export AWS_PROFILE=my-profile
```

Otherwise run `aws configure` with an access key. In PowerShell, set the profile with `$env:AWS_PROFILE = "my-profile"`. Confirm the identity before you apply:

```sh
aws sts get-caller-identity
```

## Choose a region and zones

`variables.tf` defaults to `us-east-1` with zones `us-east-1a` and `us-east-1b`. If you change `region`, change `availability_zones` to zones in that region. List them with:

```sh
aws ec2 describe-availability-zones --region eu-west-1 --query "AvailabilityZones[].ZoneName"
```

## Create the state bucket (once)

Local state is fine while you experiment. Create a bucket before you share the project or turn on CI, because CI cannot keep local state between runs. Bucket names are global, so pick a unique one:

```sh
aws s3api create-bucket --bucket my-terraform-state-1234 --region us-east-1
aws s3api put-bucket-versioning --bucket my-terraform-state-1234 --versioning-configuration Status=Enabled
aws s3api put-public-access-block --bucket my-terraform-state-1234 \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

Outside `us-east-1`, add `--create-bucket-configuration LocationConstraint=<region>` to the first command. Turn on default encryption with `aws s3api put-bucket-encryption`, or leave the AWS default of SSE-S3, which is on for every new bucket.

Then switch the project to the bucket:

1. Copy `backend.tf.example` to `backend.tf`. Commit it.
2. Copy `backend.hcl.example` to `backend.hcl` and fill in the bucket, key, and region. Git ignores this file.
3. Run `terraform init -backend-config=backend.hcl -migrate-state`.

State locking uses a lock file in the bucket and needs Terraform 1.10 or newer. On Terraform 1.9, remove `use_lockfile` and set `dynamodb_table` to an existing table whose partition key is `LockID`.

## First run

```sh
terraform init
terraform plan -var-file=terraform.tfvars.example
terraform apply -var-file=terraform.tfvars.example
```

This creates a VPC, subnets, an internet gateway, and an S3 bucket. None of them has an hourly charge, because there is no NAT gateway. Run `terraform destroy` when you finish experimenting.

## Continuous integration

The project includes three ready-to-use pipelines. Each one runs **Check** on every pull request: `terraform fmt -check`, `init -backend=false`, `validate`, and `test`. Check needs no AWS account. Each also has **Plan** and **Apply** jobs that do nothing until you turn them on.

| Host | File | How to use it |
| --- | --- | --- |
| GitHub Actions | `.github/workflows/terraform.yml` | Active as soon as you push to GitHub. |
| GitLab CI | `ci/gitlab-ci.yml` | Copy to `.gitlab-ci.yml`. |
| Bitbucket Pipelines | `ci/bitbucket-pipelines.yml` | Copy to `bitbucket-pipelines.yml`. |

Each file starts with comments that list its variables. Before you turn Plan and Apply on:

1. Create the state bucket and commit `backend.tf`, as described above. The pipeline stops with a message when `backend.tf` is missing, so CI never applies with state it would lose.
2. Set the variable **TF_BACKEND_CONFIG** to the full contents of your `backend.hcl`, and **TF_VARS** to your non-secret inputs as JSON, for example `{"name": "my-app", "environment": "prod"}`. The pipeline writes them to `backend.hcl` and `ci.auto.tfvars.json`.
3. Give the pipeline AWS access, as below.
4. Set **TERRAFORM_DEPLOY** to `true`.

### GitHub Actions: sign in with OIDC (no stored keys)

Run these once per AWS account. Replace `OWNER/REPO` with your repository.

```sh
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com --client-id-list sts.amazonaws.com
```

Create a role whose trust policy lets only your repository assume it. Save this as `trust.json`, with your account ID and repository:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
      "StringLike": { "token.actions.githubusercontent.com:sub": "repo:OWNER/REPO:*" }
    }
  }]
}
```

```sh
aws iam create-role --role-name terraform-ci --assume-role-policy-document file://trust.json
aws iam attach-role-policy --role-name terraform-ci --policy-arn arn:aws:iam::aws:policy/AmazonVPCFullAccess
aws iam attach-role-policy --role-name terraform-ci --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
```

The `repo:OWNER/REPO:*` pattern accepts pull requests, branches, and environments of that repository. To tighten it, list the exact subjects instead: `repo:OWNER/REPO:pull_request`, `repo:OWNER/REPO:ref:refs/heads/main`, and `repo:OWNER/REPO:environment:production`. Then add these **repository variables** in *Settings → Secrets and variables → Actions → Variables*:

| Variable | Value |
| --- | --- |
| `AWS_ROLE_ARN` | ARN of the `terraform-ci` role |
| `AWS_REGION` | Region of the state bucket and resources |
| `TF_BACKEND_CONFIG` | Contents of `backend.hcl` |
| `TF_VARS` | Inputs as JSON |
| `TERRAFORM_DEPLOY` | `true` |

For an approval step before Apply, open *Settings → Environments*, create **production**, and add required reviewers.

### GitLab CI and Bitbucket Pipelines

Add the variables listed at the top of the file in *Settings → CI/CD → Variables* (GitLab) or *Repository settings → Repository variables* (Bitbucket), and mark credentials as masked or secured: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_DEFAULT_REGION`. Create a dedicated IAM user for CI with the permissions above. Long-lived keys are less safe than OIDC, so use your host's OIDC support with an IAM role when it is available.

## Troubleshooting

| Message | Cause and fix |
| --- | --- |
| `No valid credential sources found` | Sign in again, and check `AWS_PROFILE` and `aws sts get-caller-identity`. |
| `InvalidParameterValue` for an availability zone | The zones do not belong to `region`. Update `availability_zones`. |
| `BucketAlreadyExists` | Bucket names are global. The artifacts bucket adds a random suffix, but your state bucket name must be unique. |
| `Error acquiring the state lock` | Another run is using the state, or one was interrupted. Wait, or run `terraform force-unlock <ID>` when you are sure nothing is running. |
| `Not authorized to perform sts:AssumeRoleWithWebIdentity` | The trust policy's `sub` does not match the workflow. Compare it with `repo:OWNER/REPO:...` for the event that failed. |
| `Backend configuration changed` | Run `terraform init -reconfigure`, or add `-migrate-state` to move existing state. |
