output "network_name" {
  description = "Name of the VPC network."
  value       = google_compute_network.main.name
}

output "subnet_self_link" {
  description = "Self link of the subnet."
  value       = google_compute_subnetwork.main.self_link
}

output "artifacts_bucket" {
  description = "Name of the versioned Cloud Storage bucket."
  value       = google_storage_bucket.artifacts.name
}
