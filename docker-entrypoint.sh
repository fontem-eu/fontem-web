#!/usr/local/bin/busybox sh
set -e
# Only the busybox BINARY is baked in (no applet symlinks), so every
# coreutil must be invoked as `busybox <applet>`.
busybox mkdir -p /tmp/conf.d /tmp/nginx
# Substitute the per-env vars the config templates on. MINIO_BUCKET appears
# in a location path (parse-time), so this must happen before nginx starts.
# SSR is optional. Unset means "no SSR service in this environment" and
# the story routes keep serving the static shell, which is exactly what
# they did before SSR existed. Never leave it empty in the config: an
# empty proxy_pass is a parse error and nginx would not start at all.
: "${SSR_UPSTREAM:=}"
busybox sed \
  -e "s|\${POD_NAMESPACE}|${POD_NAMESPACE}|g" \
  -e "s|\${MINIO_NAMESPACE}|${MINIO_NAMESPACE}|g" \
  -e "s|\${MINIO_BUCKET}|${MINIO_BUCKET}|g" \
  -e "s|\${SSR_UPSTREAM}|${SSR_UPSTREAM}|g" \
  /etc/nginx/templates/default.conf.template > /tmp/conf.d/default.conf
exec nginx -c /etc/nginx/nginx.conf -g "daemon off;"
