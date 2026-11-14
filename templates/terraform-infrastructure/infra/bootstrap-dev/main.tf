terraform {
  required_version = ">= 1.9.0"
}

variable "state_container" {
  description = "Container name for development Terraform state."
  type        = string
  default     = "terraform-state"
}

output "state_container" {
  description = "Planned state container name. Add your provider resources here to provision it."
  value       = var.state_container
}
