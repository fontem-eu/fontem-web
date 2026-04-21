# ── Stage 1: build ───────────────────────────────────────────────────────────
# Produces two bundles:
#   dist/client/  — browser JS, CSS, assets, hashed + long-cacheable
#   dist/server/  — SSR entry consumed by server/index.js at runtime
FROM node:22-slim AS build
WORKDIR /app

COPY void42-ca.crt /usr/local/share/ca-certificates/void42-ca.crt
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && \
    update-ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/void42-ca.crt

COPY package*.json .npmrc ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: serve ────────────────────────────────────────────────────────────
# Fastify-based SSR server replaces the old nginx static container.
# It handles SSR, static assets, and the proxy rules that nginx used to
# own (/api, /capi, /uploads, /umami, /sitemap*.xml). nginx is now only
# at the ingress layer, outside the pod.
FROM node:22-slim AS runtime
WORKDIR /app

COPY void42-ca.crt /usr/local/share/ca-certificates/void42-ca.crt
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates tini && \
    update-ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/void42-ca.crt

# Only what the runtime needs: server code + prod deps + both build
# outputs. Dev deps (vite, playwright, etc.) stay out.
COPY package*.json .npmrc ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server ./server
COPY --from=build /app/dist ./dist
COPY --from=build /app/index.html ./index.html

ENV NODE_ENV=production
ENV PORT=8080
ENV POD_NAMESPACE=gmr
EXPOSE 8080

# tini as PID 1 so Node gets clean SIGTERM signals on rolling restarts.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server/index.js"]
