terraform {
  required_version = ">= 1.9.0"
}

module "private_network" {
  source = "../../modules/private_network"
  name   = "${local.prefix}-network"
  cidr   = var.network_cidr
}

module "ingestion" {
  source     = "../../modules/ingestion"
  name       = "${local.prefix}-ingestion"
  network    = module.private_network.network
  queue_name = var.queue_name
}

resource "terraform_data" "layout" {
  input = {
    network   = module.private_network.network
    ingestion = module.ingestion.settings
  }
}
