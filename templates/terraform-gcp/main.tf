locals {
  # Keep the prefix short enough for the longest resource name that uses it.
  short_prefix = trim(substr("${var.name}-${var.environment}", 0, 40), "-")

  # Google Cloud resource names must start with a letter.
  prefix = can(regex("^[a-z]", local.short_prefix)) ? local.short_prefix : "p-${local.short_prefix}"

  labels = {
    project     = var.name
    environment = var.environment
    managed-by  = "terraform"
  }
}

# --- Network -----------------------------------------------------------------

resource "google_compute_network" "main" {
  name                    = "${local.prefix}-network"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "main" {
  name                     = "${local.prefix}-subnet"
  network                  = google_compute_network.main.id
  region                   = var.region
  ip_cidr_range            = var.subnet_cidr
  private_ip_google_access = true
}

resource "google_compute_firewall" "allow_internal" {
  name          = "${local.prefix}-allow-internal"
  network       = google_compute_network.main.name
  direction     = "INGRESS"
  priority      = 1000
  source_ranges = [var.subnet_cidr]

  allow {
    protocol = "tcp"
  }

  allow {
    protocol = "udp"
  }

  allow {
    protocol = "icmp"
  }
}

# SSH only through Identity-Aware Proxy (gcloud compute ssh --tunnel-through-iap).
resource "google_compute_firewall" "allow_iap_ssh" {
  name          = "${local.prefix}-allow-iap-ssh"
  network       = google_compute_network.main.name
  direction     = "INGRESS"
  priority      = 1000
  source_ranges = ["35.235.240.0/20"]

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }
}

# --- Artifact storage --------------------------------------------------------

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "google_storage_bucket" "artifacts" {
  name                        = "${local.prefix}-artifacts-${random_id.bucket_suffix.hex}"
  location                    = var.region
  force_destroy               = var.bucket_force_destroy
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  labels                      = local.labels

  versioning {
    enabled = true
  }
}
