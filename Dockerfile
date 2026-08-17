# ── Stage 1: build ───────────────────────────────────────────────────────────
# Produces:
#   dist/client/ — browser bundle, hashed assets, per-route prerendered
#                  index.html files (/privacy/index.html, /feed/index.html,
#                  etc.) for the routes crawlers care about
#   dist/server/ — SSR bundle used only by scripts/prerender.js at build
#                  time; never ships in the runtime image
FROM node:24-slim AS build
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
# ── Stage 2: static busybox (render entrypoint; distroless has no shell) ──────
FROM dockerhub.void42.internal/library/busybox:musl AS busybox

# ── Stage 3: serve — hardened distroless Chainguard nginx (nonroot uid 65532) ─
FROM cgr.void42.internal/chainguard/nginx:latest
COPY --from=busybox /bin/busybox /usr/local/bin/busybox
COPY --from=build /app/dist/client /usr/share/nginx/html
COPY nginx.conf            /etc/nginx/templates/default.conf.template
COPY rate-limit.conf       /etc/nginx/rate-limit.conf
COPY security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY nginx-main.conf       /etc/nginx/nginx.conf
COPY docker-entrypoint.sh  /usr/local/bin/docker-entrypoint.sh
# Same env contract as before (per-env overrides via k8s); rendered at start.
ENV POD_NAMESPACE=fontem-prod \
    MINIO_NAMESPACE=fontem-prod \
    MINIO_BUCKET=fontem-uploads
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/busybox", "sh", "/usr/local/bin/docker-entrypoint.sh"]
