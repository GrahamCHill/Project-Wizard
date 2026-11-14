terraform {
  required_version = ">= 1.9.0"
}

variable "access_scope" {
  description = "Scope for the scanner's read access once you add provider resources."
  type        = string
  default     = "development"
}

output "access_scope" {
  description = "Planned scanner access scope."
  value       = var.access_scope
}
