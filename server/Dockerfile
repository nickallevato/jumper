# syntax=docker/dockerfile:1.7

# One image for all of Jumper: the express server serves the built client,
# the /api routes, and the socket.io endpoint on a single port (matches how
# `npm start` runs in production).

# ---- builder: install all deps, build the client bundle ----
FROM node:20-alpine AS builder
WORKDIR /app

# better-sqlite3 is a native module — it needs a toolchain to compile.
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build \
 && npm prune --omit=dev

# ---- runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app

RUN addgroup -S app && adduser -S -G app app

ENV NODE_ENV=production
ENV PORT=3002
ENV DB_PATH=/data/jumper.db

# Built client, server + shared sources, and the pruned production deps
# (including the compiled better-sqlite3 binding) from the builder stage.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/package.json ./

# SQLite lives on a mounted volume so progress survives redeploys.
RUN mkdir -p /data && chown -R app:app /data
VOLUME ["/data"]
USER app

EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3002/ >/dev/null 2>&1 || exit 1

CMD ["node", "server/index.js"]
