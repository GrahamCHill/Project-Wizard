// Deploys a virtual network with subnets and a private storage account into an existing resource group.
// Create the group first: az group create --name rg-__PROJECT_SLUG__-dev --location eastus
targetScope = 'resourceGroup'

@description('Short lowercase name used as a prefix for resources. Names use the first 30 characters of the name and environment together.')
param name string = '__PROJECT_SLUG__'

@description('Deployment environment. It becomes part of resource names and tags.')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'dev'

@description('Azure region. Defaults to the resource group\'s region.')
param location string = resourceGroup().location

@description('IPv4 range for the virtual network. Each subnet is a /24 inside it.')
param vnetAddressPrefix string = '10.20.0.0/16'

@description('Subnets to create. "index" selects which /24 block of the virtual network each one uses.')
param subnets array = [
  { name: 'app', index: 0 }
  { name: 'data', index: 1 }
]

var prefix = take('${toLower(name)}-${environment}', 30)
var tags = {
  project: name
  environment: environment
  managedBy: 'bicep'
}

module network 'modules/network.bicep' = {
  name: 'network'
  params: {
    prefix: prefix
    location: location
    addressPrefix: vnetAddressPrefix
    subnets: [for subnet in subnets: {
      name: subnet.name
      addressPrefix: cidrSubnet(vnetAddressPrefix, 24, subnet.index)
    }]
    tags: tags
  }
}

module storage 'modules/storage.bicep' = {
  name: 'storage'
  params: {
    prefix: prefix
    location: location
    tags: tags
  }
}

output virtualNetworkId string = network.outputs.virtualNetworkId
output subnetIds object = network.outputs.subnetIds
output storageAccountName string = storage.outputs.storageAccountName
