run "connects_ingestion_to_private_network" {
  command = plan

  variables {
    project_name = "sample"
    environment  = "test"
    network_cidr = "10.50.0.0/16"
  }

  assert {
    condition     = output.layout.ingestion.network_name == "sample-test-network"
    error_message = "The ingestion module should use the private network's name."
  }

  assert {
    condition     = output.layout.network.cidr == "10.50.0.0/16"
    error_message = "The root should pass the configured CIDR to the network module."
  }
}
