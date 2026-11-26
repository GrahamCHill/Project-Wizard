# __PROJECT_NAME__

An AWS CloudFormation template for a VPC with public and private subnets and a private, encrypted S3 bucket. It is the CloudFormation version of the Terraform AWS starter, and it uses the same layout.

| Resource | Details |
| --- | --- |
| VPC | DNS support and hostnames on, split into four subnets with `!Cidr` |
| Subnets | Two public subnets with a route to an internet gateway, and two private subnets with no internet route, in the first two zones of the region |
| S3 bucket | Versioning, SSE-S3 encryption, all public access blocked, owner-enforced ownership, and a policy that denies requests over plain HTTP |

There is no NAT gateway, so the network has no hourly charge. Add one when workloads in the private subnets need outbound internet access.

## Requirements

- The [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) version 2, signed in with `aws configure sso` or `aws configure`. Confirm with `aws sts get-caller-identity`.
- Permission to create VPC and S3 resources and CloudFormation stacks. The managed policies `AmazonVPCFullAccess`, `AmazonS3FullAccess`, and `AWSCloudFormationFullAccess` cover a sandbox account.
- For linting, [cfn-lint](https://github.com/aws-cloudformation/cfn-lint): `python -m pip install cfn-lint`.

## Check, then deploy

```sh
cfn-lint template.yaml
aws cloudformation validate-template --template-body file://template.yaml
aws cloudformation deploy --template-file template.yaml --stack-name __PROJECT_SLUG__ \
  --parameter-overrides Environment=dev VpcCidr=10.0.0.0/16
```

`deploy` creates a change set, runs it, and waits. To review before anything changes, add `--no-execute-changeset`, then open the change set in the CloudFormation console. See the result with:

```sh
aws cloudformation describe-stacks --stack-name __PROJECT_SLUG__ --query "Stacks[0].Outputs"
```

## Parameters

| Parameter | Default | Purpose |
| --- | --- | --- |
| `Environment` | `dev` | `dev`, `staging`, or `prod`. Used in tags. |
| `VpcCidr` | `10.0.0.0/16` | IPv4 range for the VPC, between /16 and /24 |

Use a different stack name for each environment, for example `__PROJECT_SLUG__-prod`.

## Remove everything

The bucket must be empty before CloudFormation can delete it. Remove its objects and versions, then delete the stack:

```sh
aws cloudformation delete-stack --stack-name __PROJECT_SLUG__
aws cloudformation wait stack-delete-complete --stack-name __PROJECT_SLUG__
```

If the delete fails on the bucket, empty it in the S3 console, which also removes versions, and run the delete again. For a bucket that holds data you must keep, change `DeletionPolicy` and `UpdateReplacePolicy` to `Retain` in the template.

## Deploy from GitHub Actions

`.github/workflows/cloudformation.yml` lints the template on every pull request, with no AWS account. Preview and Deploy stay off until you turn them on. Pull requests from forks never get credentials, and Deploy waits for an approval where you require one.

1. Create an OpenID Connect provider and a role that only your repository can assume. Replace `OWNER/REPO` and the account ID:

   ```sh
   aws iam create-open-id-connect-provider --url https://token.actions.githubusercontent.com --client-id-list sts.amazonaws.com
   ```

   Save this as `trust.json`, then create the role and give it permission to manage this stack:

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
   aws iam create-role --role-name cloudformation-ci --assume-role-policy-document file://trust.json
   aws iam attach-role-policy --role-name cloudformation-ci --policy-arn arn:aws:iam::aws:policy/AWSCloudFormationFullAccess
   aws iam attach-role-policy --role-name cloudformation-ci --policy-arn arn:aws:iam::aws:policy/AmazonVPCFullAccess
   aws iam attach-role-policy --role-name cloudformation-ci --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
   ```

   Narrow `repo:OWNER/REPO:*` to the exact subjects once it works: `repo:OWNER/REPO:pull_request`, `repo:OWNER/REPO:ref:refs/heads/main`, and `repo:OWNER/REPO:environment:production`.

2. In *Settings → Secrets and variables → Actions → Variables*, add `AWS_ROLE_ARN`, `AWS_REGION`, `CFN_STACK_NAME`, `CFN_PARAMETERS` (such as `Environment=dev VpcCidr=10.0.0.0/16`, pairs separated by spaces), and finally `CFN_DEPLOY` set to `true`.
3. For a manual approval before Deploy, open *Settings → Environments*, create **production**, and add required reviewers.

[CloudFormation template reference](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/template-reference.html) · [cfn-lint](https://github.com/aws-cloudformation/cfn-lint)
