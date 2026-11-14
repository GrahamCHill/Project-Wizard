variable "name" {
  description = "Ingestion service name."
  type        = string
}

variable "network" {
  description = "Network configuration from the private network module."
  type        = object({ name = string, cidr = string })
}

variable "queue_name" {
  description = "Ingestion queue name."
  type        = string
}
