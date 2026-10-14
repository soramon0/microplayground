FROM node:24-alpine AS base

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npx prisma contract emit

FROM base AS dev

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db init && npm run start:dev"]

FROM base AS prod-builder
RUN npm run build
RUN npm prune --production # Removes dev dependencies to save space

FROM node:24-alpine AS prod

WORKDIR /app

COPY --from=prod-builder /app/dist ./dist
COPY --from=prod-builder /app/node_modules ./node_modules
COPY --from=prod-builder /app/package*.json ./
COPY --from=prod-builder /app/prisma.config.ts ./
COPY --from=prod-builder /app/src/prisma ./src/prisma

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db init && node dist/main"]
