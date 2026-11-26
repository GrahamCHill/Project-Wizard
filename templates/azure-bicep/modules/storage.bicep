@description('Prefix for resource names.')
param prefix string

param location string

param tags object = {}

// Storage account names allow only 3 to 24 lowercase letters and numbers, and they are unique across Azure.
// The suffix comes from the resource group, so redeploying to the same group keeps the same name.
var accountName = 'st${take(replace(prefix, '-', ''), 14)}${take(uniqueString(resourceGroup().id), 6)}'

resource account 'Microsoft.Storage/storageAccounts@2024-01-01' = {
  name: accountName
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2024-01-01' = {
  parent: account
  name: 'default'
  properties: {
    isVersioningEnabled: true
    deleteRetentionPolicy: {
      enabled: true
      days: 7
    }
  }
}

resource artifacts 'Microsoft.Storage/storageAccounts/blobServices/containers@2024-01-01' = {
  parent: blobService
  name: 'artifacts'
  properties: {
    publicAccess: 'None'
  }
}

output storageAccountName string = account.name
