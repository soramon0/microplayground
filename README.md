# Ecommerce Microservices — Tools

Overview of the tools and technologies used in this project.

Deeper background: [docs/](./docs/) ([k3d and Skaffold](./docs/k3d-and-skaffold.md), [Kubernetes](./docs/kubernetes.md)).

## Getting started

Prerequisites: [Docker](https://www.docker.com/), [k3d](https://k3d.io/), [Skaffold](https://skaffold.dev/), and [kubectl](https://kubernetes.io/docs/reference/kubectl/).

1. Create the local cluster (maps host `8080` to the Traefik load balancer on port `80`). This also configures kubectl to use the new cluster context:

```bash
k3d cluster create ecommerce-cluster -p "8080:80@loadbalancer"
```

1. From the repo root, build images, deploy manifests, and watch for changes:

```bash
skaffold dev --cleanup=false
```

Wait until **all** workloads are ready (including `user-db` and `auth-db`), then you can Ctrl+C. `--cleanup=false` keeps them running (by default Skaffold deletes everything on exit).

Once the DBs are already Running, iterate on apps only (does not rebuild or re-apply DB StatefulSets / NATS):

```bash
skaffold dev -p apps --cleanup=false
```

Skaffold file-syncs only the paths listed under each artifact’s `sync` in `skaffold.yaml` (e.g. `src/**/*.ts`, `src/prisma/**/*.{prisma,json}`, Go sources). Edits there hot-reload inside the running `dev` containers. Files outside sync (notably `contract.d.ts`, `package.json`, lockfiles, `Dockerfile`) need a manual copy or image rebuild — e.g. `kubectl cp svc/auth-service/src/prisma/contract.d.ts "$POD:/app/src/prisma/contract.d.ts" -c auth-service`, or `skaffold build -b auth-service --cache-artifacts=false`. With `--cleanup=false`, workloads keep running after you exit, so they can keep serving an older image across `skaffold dev` sessions until something actually rebuilds and redeploys.

1. Hit the ingress on localhost:

```bash
curl http://localhost:8080/users/verify
curl -X POST http://localhost:8080/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"password1"}'
curl http://localhost:8080/products/99
curl -X POST http://localhost:8080/orders/checkout
```

`POST /auth/register` stores credentials in `auth-db`, publishes `AUTH.userRegistered` on NATS JetStream, and `user-service` consumes that event to create a profile in `user-db`.

Useful checks:

```bash
kubectl get pods,svc,ingress,pvc
kubectl config current-context   # should be k3d-ecommerce-cluster
```

To tear down the cluster later:

```bash
k3d cluster delete ecommerce-cluster
```

### Disk pressure (k3d / Docker)

If the node taints with `node.kubernetes.io/disk-pressure`, new pods stay `Pending`. Free host space, then continue:

```bash
docker system df
docker builder prune -af          # build cache
docker system prune -af           # unused images/containers (destructive)
# optional: drop unused k3d clusters
k3d cluster list
k3d cluster delete <unused-name>
```

Before deploy, a Skaffold hook pulls `postgres:15-alpine` and `nats:alpine` and `k3d image import`s them into the cluster. Prefer `skaffold dev -p apps --cleanup=false` for day-to-day work so DB StatefulSets / NATS are left alone. Without `--cleanup=false`, Ctrl+C removes them and you need a full `skaffold dev` again.

## Without Skaffold

Same cluster and manifests, but you build, import, and apply by hand. Prerequisites: Docker, k3d, and kubectl (Skaffold is optional).

```bash
# 1. Create the cluster (skip if it already exists)
k3d cluster create ecommerce-cluster -p "8080:80@loadbalancer"

# 2. Build images (names must match k8s/*.yaml)
docker build -t user-service:latest --target dev svc/user-service
docker build -t auth-service:latest --target dev svc/auth-service
docker build -t product-service:latest --target dev svc/product-service
docker build -t order-service:latest --target dev svc/order-service
docker pull postgres:15-alpine
docker pull nats:alpine

# 3. Load images into the k3d node (avoids pulling from a registry)
k3d image import \
  user-service:latest \
  auth-service:latest \
  product-service:latest \
  order-service:latest \
  postgres:15-alpine \
  nats:alpine \
  -c ecommerce-cluster

# 4. Deploy
kubectl apply -f k8s/
```

After code changes, rebuild and re-import the affected image(s), then restart that workload, for example:

```bash
docker build -t user-service:latest --target dev svc/user-service
k3d image import user-service:latest -c ecommerce-cluster
kubectl rollout restart deployment/user-service
```

You do not get Skaffold’s file sync, auto rebuild, or image tag rewriting with this path.

## Tools reference

Catalog of the technologies used in this repo, grouped by layer.

### Local Kubernetes & delivery

How you build images and run them on a local cluster.

| Tool                                                         | Role                                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| **[Docker](https://www.docker.com/)**                        | Builds service images (`Dockerfile` multi-stage targets) and pulls Postgres/NATS for Skaffold. |
| **[k3d](https://k3d.io/)**                                   | Runs a local [k3s](https://k3s.io/) Kubernetes cluster in Docker (`k3d-ecommerce-cluster`). |
| **[Skaffold](https://skaffold.dev/)**                        | Builds images, deploys `k8s/*.yaml`, and file-syncs code during `skaffold dev`.             |
| **[kubectl](https://kubernetes.io/docs/reference/kubectl/)** | Applies manifests and inspects cluster state (used by Skaffold and for debugging).          |

### Cluster networking & storage

What routes traffic and persists data inside the cluster.

| Tool                                                                            | Role                                                                                  |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **[Kubernetes](https://kubernetes.io/)**                                        | Orchestrates Deployments, StatefulSets, Services, Ingress, ConfigMaps, Secrets, PVCs. |
| **[Traefik](https://traefik.io/)**                                              | Ingress controller (default in k3s/k3d); routes `/users`, `/auth`, `/products`, `/orders`. |
| **[local-path-provisioner](https://github.com/rancher/local-path-provisioner)** | Dynamic volumes for Postgres (`StorageClass: local-path`).                            |
| **[PostgreSQL](https://www.postgresql.org/)** (`postgres:15-alpine`)            | Databases for user-service and auth-service (`user-db`, `auth-db` StatefulSets).      |
| **[NATS](https://nats.io/)** (`nats:alpine`)                                    | Messaging (JetStream enabled via `-js` in `k8s/nats.yaml`).                           |

### Services

The microservices in `svc/` and the stacks they run on.

| Service             | Language / runtime                                                             | Framework & helpers                                                                           |
| ------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| **user-service**    | [Node.js](https://nodejs.org/) + [TypeScript](https://www.typescriptlang.org/) | NestJS, [Prisma](https://www.prisma.io/) 8, NATS JetStream consumer (`AUTH.userRegistered`) |
| **auth-service**    | Node.js + TypeScript                                                           | NestJS, Prisma 8, `class-validator`, NATS JetStream publisher (`POST /auth/register`)         |
| **product-service** | Node.js + TypeScript                                                           | NestJS (Express platform), [RxJS](https://rxjs.dev/)                                          |
| **order-service**   | [Go](https://go.dev/)                                                          | stdlib `net/http`; [Air](https://github.com/air-verse/air) for live reload in the `dev` image |

### Node / NestJS toolchain (user, auth & product services)

Dev tooling shared by the TypeScript NestJS services.

| Tool                                                      | Role                                                |
| --------------------------------------------------------- | --------------------------------------------------- |
| **[Nest CLI](https://docs.nestjs.com/cli/overview)**      | Build and run (`nest build`, `nest start --watch`). |
| **[class-validator](https://github.com/typestack/class-validator)** / **[class-transformer](https://github.com/typestack/class-transformer)** | Request DTOs + global `ValidationPipe` (auth-service). |
| **[npm](https://www.npmjs.com/)**                         | Package install and scripts.                        |
| **[Prettier](https://prettier.io/)**                      | Code formatting.                                    |
| **[Oxlint](https://oxc.rs/docs/guide/usage/linter.html)** | Linting (`oxlint --type-aware`).                    |
| **[Vitest](https://vitest.dev/)**                         | Unit and e2e tests.                                 |
| **[Vite](https://vite.dev/)**                             | Used with Vitest.                                   |
| **[Supertest](https://github.com/ladjs/supertest)**       | HTTP assertions in tests.                           |

### Container base images

Docker base images referenced by the service Dockerfiles.

| Image                | Used for                                                              |
| -------------------- | --------------------------------------------------------------------- |
| `node:24-alpine`     | NestJS `dev` / build stages                                           |
| `golang:*-alpine`    | Order-service build and `dev` (Air)                                   |
| `postgres:15-alpine` | `user-db` / `auth-db` StatefulSets + wait inits (imported via Skaffold deploy hook) |
| `nats:alpine`        | NATS with JetStream (imported via Skaffold deploy hook)                             |
