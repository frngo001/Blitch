#!/bin/sh
set -e

# Ensure /data directory exists and has correct permissions
# This handles the case where Railway mounts a volume at /data
if [ -d /data ]; then
    echo "Setting permissions for /data..."
    chown -R node:node /data 2>/dev/null || true
fi

# Create required subdirectories if they don't exist
mkdir -p /data/chunks 2>/dev/null || true
mkdir -p /data/blobs 2>/dev/null || true

# Switch to node user and start the app
exec gosu node node --expose-gc app.js
