FROM node:24-alpine AS base

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

FROM base AS dev

EXPOSE 3000

CMD ["npm", "run", "start:dev"]

FROM base AS prod-builder
RUN npm run build
RUN npm prune --production # Removes dev dependencies to save space

FROM node:20-alpine AS prod

WORKDIR /app

COPY --from=prod-builder /app/dist ./dist
COPY --from=prod-builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["node", "dist/main"]
