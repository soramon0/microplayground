FROM golang:1.26-alpine AS base

WORKDIR /app

FROM base AS dev

RUN go install github.com/air-verse/air@latest

COPY go.mod go.sum* ./
RUN go mod download
COPY . .

EXPOSE 8080

CMD ["air"]

FROM base AS prod-builder

COPY go.mod go.sum* ./
RUN go mod download
COPY . .
# Compile a static, dependency-free binary
RUN CGO_ENABLED=0 GOOS=linux go build -o order-api main.go

# --- Production Runtime Stage ---
FROM alpine:latest AS prod

WORKDIR /app
COPY --from=prod-builder /app/order-api .

EXPOSE 8080

CMD ["./order-api"]
