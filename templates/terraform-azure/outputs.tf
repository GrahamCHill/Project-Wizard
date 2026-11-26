output "resource_group_name" {
  description = "Name of the resource group."
  value       = azurerm_resource_group.main.name
}

output "virtual_network_id" {
  description = "ID of the virtual network."
  value       = azurerm_virtual_network.main.id
}

output "subnet_ids" {
  description = "Subnet IDs keyed by subnet name."
  value       = { for name, subnet in azurerm_subnet.main : name => subnet.id }
}

output "storage_account_name" {
  description = "Name of the storage account that holds the artifacts container."
  value       = azurerm_storage_account.artifacts.name
}
