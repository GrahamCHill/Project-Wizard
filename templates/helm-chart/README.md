# __PROJECT_NAME__

A Helm chart for deploying a web application to Kubernetes.

```text
chart/
  Chart.yaml            Chart name, chart version, and application version
  values.yaml           Default configuration
  values.schema.json    Validates values on install, upgrade, lint, and template
  templates/            Deployment, Service, ServiceAccount, optional Ingress and HorizontalPodAutoscaler
  templates/tests/      Connection test run by `helm test`
```

The sample runs the unprivileged NGINX image on port 8080. Replace `image.repository` and `image.tag` in `chart/values.yaml` with your own image, then adjust `service.targetPort`, the probes in `templates/deployment.yaml`, and the resources. The pods run as a non-root user with all capabilities dropped, a read-only root file system, and a writable `/tmp`.

## Requirements

Helm 3.8 or newer. Linting and rendering need no cluster. Installing needs access to one, such as Docker Desktop, kind, minikube, or a managed cluster.

## Check the chart

```sh
helm lint chart
helm template demo chart
helm template demo chart --set ingress.enabled=true --set autoscaling.enabled=true
```

`helm lint` also validates `values.yaml` against `values.schema.json`. Pipe `helm template` to [kubeconform](https://github.com/yannh/kubeconform) to check the output against Kubernetes schemas without a cluster:

```sh
helm template demo chart | kubeconform -strict -summary
```

## Install

```sh
helm upgrade --install demo chart --namespace demo --create-namespace
helm test demo --namespace demo
kubectl --namespace demo port-forward service/demo-__PROJECT_SLUG__ 8080:80
```

Open http://127.0.0.1:8080. The release name `demo` and the chart name form the resource names. Set `fullnameOverride` to choose them yourself. Remove the release with `helm uninstall demo --namespace demo`.

## Configure environments

Keep one values file for each environment and pass it with `-f`:

```sh
helm upgrade --install demo chart -f values-prod.yaml --set image.tag=1.2.3
```

Turn on `ingress.enabled` and set `ingress.hosts` and `ingress.className` to expose the service. Turn on `autoscaling.enabled` for a HorizontalPodAutoscaler. The Deployment then omits `replicas`, and the autoscaler needs metrics-server.

## Package and publish

```sh
helm package chart
```

This creates `__PROJECT_SLUG__-0.1.0.tgz`. Increase `version` in `Chart.yaml` whenever the chart changes. Publish the package to an OCI registry with `helm push __PROJECT_SLUG__-0.1.0.tgz oci://registry.example.com/charts`.

[Helm chart best practices](https://helm.sh/docs/chart_best_practices/) · [Chart template guide](https://helm.sh/docs/chart_template_guide/)
