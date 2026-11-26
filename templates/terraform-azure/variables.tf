variable "subscription_id" {
  description = "Azure subscription ID. Leave null to use ARM_SUBSCRIPTION_ID or the Azure CLI's active subscription."
  type        = string
  default     = null
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

variable "location" {
  description = "Azure region for all resources."
  type        = string
  default     = "eastus"
}

variable "vnet_cidr" {
  description = "IPv4 CIDR block for the virtual network."
  type        = string
  default     = "10.20.0.0/16"

  validation {
    condition     = can(cidrnetmask(var.vnet_cidr))
    error_message = "Enter a valid IPv4 CIDR block, such as 10.20.0.0/16."
  }
}

variable "subnets" {
  description = "Subnets to create, keyed by name. Each value is the index of a /24 block inside the virtual network."
  type        = map(number)

  default = {
    app  = 0
    data = 1
  }

  validation {
    condition     = alltrue([for index in values(var.subnets) : index >= 0 && index <= 255 && floor(index) == index])
    error_message = "Each subnet index must be a whole number from 0 to 255."
  }
}
