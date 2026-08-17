#!/usr/local/bin/busybox sh
set -e
# Only the busybox BINARY is baked in (no applet symlinks), so every
# coreutil must be invoked as `busybox <applet>`.
busybox mkdir -p /tmp/conf.d /tmp/nginx
# Substitute the per-env vars the config templates on. MINIO_BUCKET appears
# in a location path (parse-time), so this must happen before nginx starts.
busybox sed \
  -e "s|\${POD_NAMESPACE}|${POD_NAMESPACE}|g" \
  -e "s|\${MINIO_NAMESPACE}|${MINIO_NAMESPACE}|g" \
  -e "s|\${MINIO_BUCKET}|${MINIO_BUCKET}|g" \
  /etc/nginx/templates/default.conf.template > /tmp/conf.d/default.conf
exec nginx -c /etc/nginx/nginx.conf -g "daemon off;"
