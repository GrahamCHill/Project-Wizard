variable "project_id" {
  description = "ID of the existing Google Cloud project that receives the resources."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "Enter a Google Cloud project ID: 6 to 30 lowercase letters, numbers, or hyphens, starting with a letter."
  }
}

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
  description = "Region for the subnet and the storage bucket."
  type        = string
  default     = "us-central1"
}

variable "subnet_cidr" {
  description = "IPv4 CIDR block for the subnet."
  type        = string
  default     = "10.10.0.0/20"

  validation {
    condition     = can(cidrnetmask(var.subnet_cidr))
    error_message = "Enter a valid IPv4 CIDR block, such as 10.10.0.0/20."
  }
}

variable "bucket_force_destroy" {
  description = "Allow Terraform to delete the artifacts bucket even when it contains objects."
  type        = bool
  default     = false
}
