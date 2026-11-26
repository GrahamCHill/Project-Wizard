locals {
  # Linode firewall labels are limited to 32 characters, so keep room for the suffix.
  prefix = trim(substr("${var.name}-${var.environment}", 0, 24), "-")

  tags = [substr(var.name, 0, 40), var.environment, "terraform"]
}

# --- Network -----------------------------------------------------------------

resource "linode_vpc" "main" {
  label       = "${local.prefix}-vpc"
  region      = var.region
  description = "Private network for ${local.prefix}."
}

resource "linode_vpc_subnet" "main" {
  vpc_id = linode_vpc.main.id
  label  = "${local.prefix}-subnet"
  ipv4   = var.subnet_cidr
}

# --- Server ------------------------------------------------------------------

# Linode requires a root password with an image. Terraform generates one and
# keeps it in state, so sign in with your SSH key and rotate or disable it.
resource "random_password" "root" {
  length  = 32
  special = true
}

resource "linode_instance" "main" {
  label           = "${local.prefix}-server"
  region          = var.region
  type            = var.instance_type
  image           = var.image
  root_pass       = random_password.root.result
  authorized_keys = var.authorized_keys
  tags            = local.tags

  interface {
    purpose = "public"
  }

  interface {
    purpose   = "vpc"
    subnet_id = linode_vpc_subnet.main.id
  }
}

# Drop all inbound traffic except SSH from the allowed addresses.
resource "linode_firewall" "main" {
  label           = "${local.prefix}-fw"
  inbound_policy  = "DROP"
  outbound_policy = "ACCEPT"
  tags            = local.tags
  linodes         = [linode_instance.main.id]

  inbound {
    label    = "allow-ssh"
    action   = "ACCEPT"
    protocol = "TCP"
    ports    = "22"
    ipv4     = var.ssh_allowed_cidrs
  }
}
