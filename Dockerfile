# ── Stage 1: build + generate coverage matrix ────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Generate coverage matrix (requires python3 + pyyaml)
RUN apk add --no-cache python3 py3-yaml && \
    python3 scripts/coverage_matrix.py > public/coverage-matrix.json

RUN npm run build

# ── Stage 2: serve ────────────────────────────────────────────────────────────
FROM nginx:1.29
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
