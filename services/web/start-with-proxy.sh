#!/bin/bash
set -e

echo "Starting Overleaf Web with nginx proxy..."

# Start nginx in background
nginx -c /overleaf/services/web/nginx-proxy.conf &
NGINX_PID=$!

echo "Nginx started (PID: $NGINX_PID)"

# Start Node.js app on internal port
export PORT=3001
echo "Starting Node.js on port $PORT..."

# Run node in foreground
exec node --expose-gc app.mjs
