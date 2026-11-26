output "vpc_id" {
  description = "ID of the VPC."
  value       = linode_vpc.main.id
}

output "instance_ipv4" {
  description = "Public IPv4 addresses of the server."
  value       = linode_instance.main.ipv4
}

output "ssh_command" {
  description = "Command that connects to the server over SSH."
  value       = "ssh root@${linode_instance.main.ip_address}"
}
