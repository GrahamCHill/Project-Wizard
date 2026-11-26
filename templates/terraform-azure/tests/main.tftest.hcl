# These tests plan against mock providers, so they need no Azure subscription or credentials.
mock_provider "azurerm" {}
mock_provider "random" {}

run "plans_network_and_storage" {
  command = plan

  assert {
    condition     = contains(azurerm_virtual_network.main.address_space, "10.20.0.0/16")
    error_message = "The virtual network should use the default CIDR block."
  }

  assert {
    condition     = azurerm_subnet.main["app"].address_prefixes[0] == "10.20.0.0/24" && azurerm_subnet.main["data"].address_prefixes[0] == "10.20.1.0/24"
    error_message = "Each subnet should be a /24 block selected by its index."
  }

  assert {
    condition     = azurerm_storage_account.artifacts.min_tls_version == "TLS1_2" && azurerm_storage_account.artifacts.allow_nested_items_to_be_public == false
    error_message = "The storage account must require TLS 1.2 and block public blobs."
  }

  assert {
    condition     = azurerm_storage_account.artifacts.blob_properties[0].versioning_enabled
    error_message = "The storage account must keep blob versions."
  }

  assert {
    condition     = azurerm_storage_container.artifacts.container_access_type == "private"
    error_message = "The artifacts container must be private."
  }
}

run "adds_a_subnet" {
  command = plan

  variables {
    subnets = {
      app  = 0
      data = 1
      jobs = 2
    }
  }

  assert {
    condition     = length(azurerm_subnet.main) == 3 && length(azurerm_subnet_network_security_group_association.main) == 3
    error_message = "Every subnet should be created and associated with the security group."
  }
}

run "rejects_invalid_cidr" {
  command = plan

  variables {
    vnet_cidr = "10.20.0.0/99"
  }

  expect_failures = [var.vnet_cidr]
}

run "rejects_subnet_index_out_of_range" {
  command = plan

  variables {
    subnets = {
      app = 256
    }
  }

  expect_failures = [var.subnets]
}
