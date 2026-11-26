# These tests plan against mock providers, so they need no AWS credentials.
mock_provider "aws" {}
mock_provider "random" {}

run "plans_network_and_bucket" {
  command = plan

  assert {
    condition     = aws_vpc.main.cidr_block == "10.0.0.0/16"
    error_message = "The VPC should use the default CIDR block."
  }

  assert {
    condition     = length(aws_subnet.public) == 2 && length(aws_subnet.private) == 2
    error_message = "Each availability zone should get one public and one private subnet."
  }

  assert {
    condition     = aws_subnet.public[0].cidr_block == "10.0.0.0/24" && aws_subnet.private[0].cidr_block == "10.0.100.0/24"
    error_message = "Subnets should be /24 blocks carved from the VPC CIDR."
  }

  assert {
    condition     = aws_s3_bucket_public_access_block.artifacts.block_public_acls && aws_s3_bucket_public_access_block.artifacts.restrict_public_buckets
    error_message = "The artifacts bucket must block public access."
  }

  assert {
    condition     = aws_s3_bucket_versioning.artifacts.versioning_configuration[0].status == "Enabled"
    error_message = "The artifacts bucket must keep object versions."
  }
}

run "scales_subnets_with_zones" {
  command = plan

  variables {
    availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
  }

  assert {
    condition     = length(aws_subnet.public) == 3 && length(aws_subnet.private) == 3
    error_message = "Subnet count should follow the number of availability zones."
  }
}

run "rejects_invalid_cidr" {
  command = plan

  variables {
    vpc_cidr = "not-a-cidr"
  }

  expect_failures = [var.vpc_cidr]
}

run "rejects_uppercase_name" {
  command = plan

  variables {
    name = "Not_Valid"
  }

  expect_failures = [var.name]
}
