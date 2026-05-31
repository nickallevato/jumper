# syntax=docker/dockerfile:1.7

# ---- builder ----
FROM node:20-alpine AS builder
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY client/package.json ./client/
COPY server/package.json ./server/

RUN pnpm install --frozen-lockfile

COPY shared ./shared
COPY client ./client

RUN pnpm --filter @jumper/shared build \
 && pnpm --filter @jumper/client build

# ---- runtime ----
FROM nginx:1.27-alpine AS runtime

RUN addgroup -S app && adduser -S -G app app

COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /repo/client/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/ >/dev/null || exit 1
