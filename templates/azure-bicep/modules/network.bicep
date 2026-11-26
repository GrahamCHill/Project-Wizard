@description('Prefix for resource names.')
param prefix string

param location string

@description('Address space of the virtual network.')
param addressPrefix string

@description('Subnets to create, each with a name and an addressPrefix.')
param subnets array

param tags object = {}

// Deny inbound traffic from the internet. Azure's default rules still allow traffic inside the virtual network.
// Add allow rules as workloads need them.
resource securityGroup 'Microsoft.Network/networkSecurityGroups@2024-05-01' = {
  name: 'nsg-${prefix}'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'deny-internet-inbound'
        properties: {
          priority: 4000
          direction: 'Inbound'
          access: 'Deny'
          protocol: '*'
          sourcePortRange: '*'
          destinationPortRange: '*'
          sourceAddressPrefix: 'Internet'
          destinationAddressPrefix: '*'
        }
      }
    ]
  }
}

resource virtualNetwork 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: 'vnet-${prefix}'
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [addressPrefix]
    }
    subnets: [for subnet in subnets: {
      name: 'snet-${subnet.name}'
      properties: {
        addressPrefix: subnet.addressPrefix
        networkSecurityGroup: {
          id: securityGroup.id
        }
      }
    }]
  }
}

output virtualNetworkId string = virtualNetwork.id
output subnetIds object = toObject(virtualNetwork.properties.subnets, subnet => subnet.name, subnet => subnet.id)
