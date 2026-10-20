# Docs

How this repo runs locally: a small Kubernetes cluster on your machine, plus a feedback loop for building and deploying the microservices.

## Guides

| Doc | What it covers |
| --- | -------------- |
| [Architecture](./architecture.md) | Target architecture: events, outbox, gRPC, data isolation, tracing, K8s, … |
| [k3d and Skaffold](./k3d-and-skaffold.md) | What k3d is, why we use it, and why Skaffold sits on top |
| [Kubernetes](./kubernetes.md) | How this project uses Kubernetes (`k8s/` manifests, networking, data) |

For day-to-day commands (create the cluster, `skaffold dev`, curls), see the [root README](../README.md).
