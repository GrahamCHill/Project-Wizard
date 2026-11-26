# __PROJECT_NAME__

Kubernetes manifests managed with Kustomize. The base describes one web workload, and the overlays adapt it for each environment.

```text
k8s/
  base/                 Deployment, Service, ServiceAccount, PodDisruptionBudget, NetworkPolicy
  overlays/dev/         Namespace "dev", 1 replica
  overlays/prod/        Namespace "prod", 3 replicas, a HorizontalPodAutoscaler, and a pinned image tag
```

The sample runs the unprivileged NGINX image on port 8080. Replace the image in `k8s/base/deployment.yaml` with your own, then adjust the port, probes, and resources to match. The pod already follows the restricted Pod Security Standard: it runs as a non-root user, drops all capabilities, uses a read-only root file system with a writable `/tmp`, and does not mount a service account token.

## Requirements

kubectl 1.27 or newer. Rendering the manifests needs no cluster. Applying them needs access to one, such as Docker Desktop, kind, minikube, or a managed cluster.

## Render and review

```sh
kubectl kustomize k8s/overlays/dev
kubectl kustomize k8s/overlays/prod
```

Pipe the output to [kubeconform](https://github.com/yannh/kubeconform) to validate it against the Kubernetes schemas without a cluster:

```sh
kubectl kustomize k8s/overlays/prod | kubeconform -strict -summary
```

## Deploy

```sh
kubectl apply -k k8s/overlays/dev
kubectl -n dev rollout status deployment/web
kubectl -n dev port-forward service/web 8080:80
```

Open http://127.0.0.1:8080. Remove the environment with `kubectl delete -k k8s/overlays/dev`. Preview changes against a live cluster first with `kubectl diff -k k8s/overlays/prod`.

## Add an environment

Copy `k8s/overlays/dev` to `k8s/overlays/staging`, then change the namespace, labels, and replica count in its `kustomization.yaml` and `namespace.yaml`. Use `images`, `replicas`, and patches in the overlay for anything that differs by environment, and keep the base free of environment-specific values.

## Network policy and scaling

`k8s/base/networkpolicy.yaml` allows traffic to the pods from the same namespace and from a namespace named `ingress-nginx`. Change the namespace selector to match your ingress controller. A policy only takes effect on clusters whose network plugin enforces them. The production autoscaler needs metrics-server. It manages the replica count once it starts, so tune `minReplicas` there instead of `count` in the overlay.

[Kustomize](https://kubectl.docs.kubernetes.io/guides/introduction/kustomize/) · [Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
