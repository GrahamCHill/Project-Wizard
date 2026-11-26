# __PROJECT_NAME__

Azure Bicep for a virtual network with subnets and a private storage account. It is the Bicep version of the Terraform Azure starter, with the same layout.

```text
main.bicep                 Entry point: parameters, the two modules, and outputs
modules/network.bicep      Network security group, virtual network, and subnets
modules/storage.bicep      Storage account with versioning and a private container
main.bicepparam            Values for a deployment
bicepconfig.json           Linter rules
```

| Resource | Details |
| --- | --- |
| Virtual network | One `/16` split into `/24` subnets with the `cidrSubnet` function. Add entries to the `subnets` parameter for more. |
| Network security group | Attached to every subnet. It denies inbound traffic from the internet. |
| Storage account | TLS 1.2 only, HTTPS only, no public blob access, no shared-key access, blob versioning, 7-day soft delete, and a private `artifacts` container |

## Requirements

- The [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli), signed in with `az login`. It installs and updates Bicep for you: `az bicep install`. You can also use the standalone [Bicep CLI](https://learn.microsoft.com/azure/azure-resource-manager/bicep/install).
- Permission to create resources in a resource group, such as **Contributor** on it.
- The **Bicep** extension for VS Code gives completion, validation, and a visualizer.

## Build, check, and deploy

```sh
az bicep build --file main.bicep
az bicep lint --file main.bicep

az group create --name rg-__PROJECT_SLUG__-dev --location eastus
az deployment group what-if --resource-group rg-__PROJECT_SLUG__-dev --parameters main.bicepparam
az deployment group create  --resource-group rg-__PROJECT_SLUG__-dev --parameters main.bicepparam
```

`what-if` shows what would be created, changed, or deleted without touching anything. Review it before `create`. Show the outputs afterwards with:

```sh
az deployment group show --resource-group rg-__PROJECT_SLUG__-dev --name main --query properties.outputs
```

Select the subscription first when you have more than one: `az account set --subscription "NAME_OR_ID"`.

## Parameters

| Parameter | Default | Purpose |
| --- | --- | --- |
| `name` | `__PROJECT_SLUG__` | Prefix for resource names. Names use the first 30 characters of the name and environment together. |
| `environment` | `dev` | `dev`, `staging`, or `prod`. Part of names and tags. |
| `location` | The resource group's region | Where the resources go |
| `vnetAddressPrefix` | `10.20.0.0/16` | Address space of the virtual network |
| `subnets` | `app` and `data` | Subnet names and which `/24` block each uses |

Use one resource group and one `.bicepparam` file per environment, for example `prod.bicepparam`.

## Remove everything

```sh
az group delete --name rg-__PROJECT_SLUG__-dev
```

## Deploy from GitHub Actions

`.github/workflows/bicep.yml` compiles and lints the files on every pull request, with no Azure subscription. What-if and Deploy stay off until you turn them on. Pull requests from forks never get credentials, and Deploy waits for an approval where you require one. The workflow signs in with OpenID Connect, so no secret is stored.

1. Create an app registration and service principal, and give it access to the resource group. Replace the names and IDs:

   ```sh
   APP_ID=$(az ad app create --display-name bicep-ci --query appId --output tsv)
   az ad sp create --id "$APP_ID"
   az role assignment create --assignee "$APP_ID" --role Contributor \
     --scope "$(az group show --name rg-__PROJECT_SLUG__-dev --query id --output tsv)"
   ```

2. Azure checks the token's subject exactly, so create one federated credential for each way the workflow runs. Save each JSON file and pass it with `az ad app federated-credential create --id "$APP_ID" --parameters @file.json`:

   | Name | Subject | Used by |
   | --- | --- | --- |
   | `github-pr` | `repo:OWNER/REPO:pull_request` | What-if on pull requests |
   | `github-production` | `repo:OWNER/REPO:environment:production` | Deploy, which runs in the `production` environment |

   ```json
   {
     "name": "github-production",
     "issuer": "https://token.actions.githubusercontent.com",
     "subject": "repo:OWNER/REPO:environment:production",
     "audiences": ["api://AzureADTokenExchange"]
   }
   ```

3. In *Settings → Secrets and variables → Actions → Variables*, add `AZURE_CLIENT_ID` (the `APP_ID`), `AZURE_TENANT_ID` (`az account show --query tenantId -o tsv`), `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`, and finally `BICEP_DEPLOY` set to `true`.
4. For a manual approval before Deploy, open *Settings → Environments*, create **production**, and add required reviewers.

[Bicep documentation](https://learn.microsoft.com/azure/azure-resource-manager/bicep/) · [Resource reference](https://learn.microsoft.com/azure/templates/) · [What-if](https://learn.microsoft.com/azure/azure-resource-manager/bicep/deploy-what-if)
