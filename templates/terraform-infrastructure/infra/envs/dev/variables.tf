variable "project_name" {
  description = "Short name used as a prefix."
  type        = string
  default     = "__PROJECT_SLUG__"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "dev"
}

variable "network_cidr" {
  description = "CIDR block for the private network example."
  type        = string
  default     = "10.40.0.0/16"
}

variable "queue_name" {
  description = "Name of the ingestion queue."
  type        = string
  default     = "documents"
}
