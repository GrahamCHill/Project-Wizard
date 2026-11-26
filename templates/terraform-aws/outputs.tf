output "vpc_id" {
  description = "ID of the VPC."
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets, one per availability zone."
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets, one per availability zone."
  value       = aws_subnet.private[*].id
}

output "artifacts_bucket" {
  description = "Name of the versioned, encrypted S3 bucket."
  value       = aws_s3_bucket.artifacts.bucket
}
