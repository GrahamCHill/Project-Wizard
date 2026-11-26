# These tests plan against mock providers, so they need no Google Cloud credentials.
mock_provider "google" {}
mock_provider "random" {}

variables {
  project_id = "sample-project-123"
}

run "plans_network_and_bucket" {
  command = plan

  assert {
    condition     = google_compute_network.main.auto_create_subnetworks == false
    error_message = "The VPC should use custom subnets only."
  }

  assert {
    condition     = google_compute_subnetwork.main.ip_cidr_range == "10.10.0.0/20" && google_compute_subnetwork.main.private_ip_google_access
    error_message = "The subnet should use the default CIDR and enable private Google access."
  }

  assert {
    condition     = google_storage_bucket.artifacts.uniform_bucket_level_access && google_storage_bucket.artifacts.public_access_prevention == "enforced"
    error_message = "The artifacts bucket must use uniform access and prevent public access."
  }

  assert {
    condition     = google_storage_bucket.artifacts.versioning[0].enabled
    error_message = "The artifacts bucket must keep object versions."
  }
}

run "limits_ssh_to_identity_aware_proxy" {
  command = plan

  assert {
    condition     = contains(google_compute_firewall.allow_iap_ssh.source_ranges, "35.235.240.0/20") && length(google_compute_firewall.allow_iap_ssh.source_ranges) == 1
    error_message = "SSH should only be reachable from the Identity-Aware Proxy range."
  }
}

run "prefixes_names_that_start_with_a_digit" {
  command = plan

  variables {
    name = "9-app"
  }

  assert {
    condition     = google_compute_network.main.name == "p-9-app-dev-network"
    error_message = "Resource names must start with a letter, so a leading digit needs a prefix."
  }
}

run "rejects_invalid_project_id" {
  command = plan

  variables {
    project_id = "Bad_ID"
  }

  expect_failures = [var.project_id]
}

run "rejects_invalid_cidr" {
  command = plan

  variables {
    subnet_cidr = "10.10.0.0"
  }

  expect_failures = [var.subnet_cidr]
}
