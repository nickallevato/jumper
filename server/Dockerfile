# syntax=docker/dockerfile:1.7

# ---- builder ----
FROM node:20-alpine AS builder
WORKDIR /repo

RUN apk add --no-cache git \
 && corepack enable \
 && corepack prepare pnpm@10.33.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY client/package.json ./client/
COPY server/package.json ./server/

RUN pnpm install --frozen-lockfile

COPY shared ./shared
COPY server ./server

RUN pnpm --filter @jumper/shared build \
 && pnpm --filter @jumper/server build

# Prune to production deps for runtime image
RUN pnpm --filter @jumper/server --prod --legacy deploy /out

# ---- runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app

RUN addgroup -S app && adduser -S -G app app

COPY --from=builder /out/package.json ./
COPY --from=builder /out/node_modules ./node_modules
COPY --from=builder /repo/server/dist ./dist

ENV NODE_ENV=production
ENV PORT=2567
EXPOSE 2567

USER app

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:2567/matchmake/ >/dev/null 2>&1 || exit 0

CMD ["node", "dist/index.js"]
