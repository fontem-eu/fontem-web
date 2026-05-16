# ── Stage 1: build ───────────────────────────────────────────────────────────
# Produces:
#   dist/client/ — browser bundle, hashed assets, per-route prerendered
#                  index.html files (/privacy/index.html, /feed/index.html,
#                  etc.) for the routes crawlers care about
#   dist/server/ — SSR bundle used only by scripts/prerender.js at build
#                  time; never ships in the runtime image
FROM node:22-slim AS build
WORKDIR /app

# Tailwind's oxide native binding needs glibc — Alpine/musl has a
# matching package but npm's optional-deps bug means a clean install
# on Alpine fails. Debian slim avoids the problem entirely.
COPY void42-ca.crt /usr/local/share/ca-certificates/void42-ca.crt
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && \
    update-ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/void42-ca.crt

COPY package*.json .npmrc ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: serve ────────────────────────────────────────────────────────────
# Plain nginx serving the prerendered HTML + client assets.  The
# SSR-era Fastify runtime is gone — every URL we index is baked into a
# static file at build time and cached hard by the CDN / Traefik edge.
FROM nginx:1.29
COPY --from=build /app/dist/client /usr/share/nginx/html
COPY rate-limit.conf /etc/nginx/conf.d/00-rate-limit.conf
COPY nginx.conf /etc/nginx/templates/default.conf.template
# nginx's image envsubst-templates only substitute vars listed in
# NGINX_ENVSUBST_FILTER; explicit defaults below double as the
# allowlist (nginx will only replace these — anything else like
# ${remote_addr} in nginx variables is left alone).
ENV POD_NAMESPACE=fontem-prod \
    MINIO_NAMESPACE=fontem-prod \
    MINIO_BUCKET=fontem-uploads
