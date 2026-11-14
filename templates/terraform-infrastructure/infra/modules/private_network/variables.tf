variable "name" {
  description = "Private network name."
  type        = string
}

variable "cidr" {
  description = "Private network CIDR block."
  type        = string

  validation {
    condition     = can(cidrhost(var.cidr, 0))
    error_message = "Provide a valid CIDR block."
  }
}
