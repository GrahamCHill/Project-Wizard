# These tests plan against mock providers, so they need no Linode account or API token.
mock_provider "linode" {}
mock_provider "random" {}

variables {
  authorized_keys   = ["ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAItest test@example.com"]
  ssh_allowed_cidrs = ["203.0.113.10/32"]
}

run "plans_vpc_server_and_firewall" {
  command = plan

  assert {
    condition     = linode_vpc_subnet.main.ipv4 == "10.30.0.0/24"
    error_message = "The VPC subnet should use the default CIDR block."
  }

  assert {
    condition     = linode_instance.main.image == "linode/ubuntu24.04" && linode_instance.main.type == "g6-nanode-1"
    error_message = "The server should use the default image and plan."
  }

  assert {
    condition     = linode_firewall.main.inbound_policy == "DROP"
    error_message = "The firewall must drop inbound traffic that no rule allows."
  }
}

run "allows_ssh_only_from_the_given_addresses" {
  command = plan

  variables {
    ssh_allowed_cidrs = ["198.51.100.7/32", "203.0.113.0/24"]
  }

  assert {
    condition     = length(linode_firewall.main.inbound) == 1 && one(linode_firewall.main.inbound).ports == "22"
    error_message = "Only SSH should be allowed inbound."
  }

  assert {
    condition     = toset(one(linode_firewall.main.inbound).ipv4) == toset(["198.51.100.7/32", "203.0.113.0/24"])
    error_message = "The SSH rule should use exactly the configured addresses."
  }
}

run "requires_an_ssh_key" {
  command = plan

  variables {
    authorized_keys = []
  }

  expect_failures = [var.authorized_keys]
}

run "rejects_invalid_ssh_cidr" {
  command = plan

  variables {
    ssh_allowed_cidrs = ["anywhere"]
  }

  expect_failures = [var.ssh_allowed_cidrs]
}
