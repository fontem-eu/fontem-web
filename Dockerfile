# ── Stage 1: build ───────────────────────────────────────────────────────────
# Produces:
#   dist/client/ — browser bundle, hashed assets, per-route prerendered
#                  index.html files (/privacy/index.html, /feed/index.html,
#                  etc.) for the routes crawlers care about
#   dist/server/ — SSR bundle used only by scripts/prerender.js at build
#                  time; never ships in the runtime image
FROM node:24-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS build
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
FROM dockerhub.void42.internal/library/busybox:musl@sha256:ea2b9914a16a4ac1981994af97b318f7c7d4db76b580c56177f08bf76f4a0be8 AS busybox

# ── Stage 3: serve — hardened distroless Chainguard nginx (nonroot uid 65532) ─
FROM cgr.void42.internal/chainguard/nginx:latest@sha256:51048009c0db8c584a3746a98368295fa2c13ad1b29e5c846a5d3da9dd9b35c4
COPY --from=busybox /bin/busybox /usr/local/bin/busybox
COPY --from=build /app/dist/client /usr/share/nginx/html
COPY nginx.conf            /etc/nginx/templates/default.conf.template
COPY rate-limit.conf       /etc/nginx/templates/rate-limit.conf.template
COPY security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY nginx-main.conf       /etc/nginx/nginx.conf
COPY docker-entrypoint.sh  /usr/local/bin/docker-entrypoint.sh
# Same env contract as before (per-env overrides via k8s); rendered at start.
ENV POD_NAMESPACE=fontem-prod \
    MINIO_NAMESPACE=fontem-prod \
    MINIO_BUCKET=fontem-uploads
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/busybox", "sh", "/usr/local/bin/docker-entrypoint.sh"]
