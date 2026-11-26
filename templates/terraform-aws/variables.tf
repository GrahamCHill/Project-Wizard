variable "name" {
  description = "Short lowercase name used as a prefix for resources."
  type        = string
  default     = "__PROJECT_SLUG__"

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]*$", var.name))
    error_message = "Use lowercase letters, numbers, and hyphens, starting with a letter or number."
  }
}

variable "environment" {
  description = "Deployment environment name, such as dev, staging, or prod."
  type        = string
  default     = "dev"

  validation {
    condition     = can(regex("^[a-z][a-z0-9]{1,11}$", var.environment))
    error_message = "Use 2 to 12 lowercase letters or numbers, starting with a letter."
  }
}

variable "region" {
  description = "AWS region for all resources."
  type        = string
  default     = "us-east-1"
}

variable "availability_zones" {
  description = "Availability zones that receive one public and one private subnet each. Keep them inside the selected region."
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]

  validation {
    condition     = length(var.availability_zones) >= 1 && length(var.availability_zones) <= 6
    error_message = "Choose between 1 and 6 availability zones."
  }
}

variable "vpc_cidr" {
  description = "IPv4 CIDR block for the VPC. Each subnet is a /24 inside it."
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrnetmask(var.vpc_cidr))
    error_message = "Enter a valid IPv4 CIDR block, such as 10.0.0.0/16."
  }
}

variable "bucket_force_destroy" {
  description = "Allow Terraform to delete the artifacts bucket even when it contains objects."
  type        = bool
  default     = false
}
