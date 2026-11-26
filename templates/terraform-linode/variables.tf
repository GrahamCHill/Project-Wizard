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
  description = "Akamai Cloud (Linode) region ID, such as us-ord or eu-west."
  type        = string
  default     = "us-ord"
}

variable "instance_type" {
  description = "Plan for the server. g6-nanode-1 is the smallest shared CPU plan."
  type        = string
  default     = "g6-nanode-1"
}

variable "image" {
  description = "Image for the server."
  type        = string
  default     = "linode/ubuntu24.04"
}

variable "subnet_cidr" {
  description = "IPv4 CIDR block for the VPC subnet."
  type        = string
  default     = "10.30.0.0/24"

  validation {
    condition     = can(cidrnetmask(var.subnet_cidr))
    error_message = "Enter a valid IPv4 CIDR block, such as 10.30.0.0/24."
  }
}

variable "authorized_keys" {
  description = "Public SSH keys installed for the root user. Provide at least one."
  type        = list(string)

  validation {
    condition     = length(var.authorized_keys) > 0
    error_message = "Provide at least one public SSH key."
  }
}

variable "ssh_allowed_cidrs" {
  description = "IPv4 CIDR blocks that may connect to SSH. Restrict this to your own address."
  type        = list(string)

  validation {
    condition     = length(var.ssh_allowed_cidrs) > 0 && alltrue([for cidr in var.ssh_allowed_cidrs : can(cidrnetmask(cidr))])
    error_message = "Provide at least one valid IPv4 CIDR block, such as 203.0.113.10/32."
  }
}
