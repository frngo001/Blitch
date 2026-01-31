#!/bin/bash
set -e

echo "Starting Overleaf Web with nginx proxy..."

# Railway sets PORT - nginx will listen on this
NGINX_PORT=${PORT:-3000}
NODE_PORT=3001

echo "Nginx will listen on port $NGINX_PORT"
echo "Node.js will listen on port $NODE_PORT"

# Update nginx config with the correct port
sed -i "s/listen 3000;/listen $NGINX_PORT;/" /overleaf/services/web/nginx-proxy.conf

# Start nginx in background
nginx -c /overleaf/services/web/nginx-proxy.conf &
NGINX_PID=$!

echo "Nginx started (PID: $NGINX_PID)"

# Start Node.js app on internal port
# Override WEB_PORT for Overleaf (it uses WEB_PORT, not PORT)
export WEB_PORT=$NODE_PORT
export LISTEN_ADDRESS=127.0.0.1
echo "Starting Node.js on $LISTEN_ADDRESS:$WEB_PORT..."

# Run node in foreground
exec node --expose-gc app.mjs
