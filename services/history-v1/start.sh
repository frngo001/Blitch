#!/bin/sh
set -e

# Ensure /data directory exists and has correct permissions
# This handles the case where Railway mounts a volume at /data
if [ -d /data ]; then
    echo "Setting permissions for /data..."
    chown -R node:node /data 2>/dev/null || true
fi

# Create all required bucket subdirectories if they don't exist
echo "Creating bucket directories..."
mkdir -p /data/analytics 2>/dev/null || true
mkdir -p /data/blobs 2>/dev/null || true
mkdir -p /data/chunks 2>/dev/null || true
mkdir -p /data/project_blobs 2>/dev/null || true
mkdir -p /data/zips 2>/dev/null || true

# Ensure subdirectories have correct ownership
chown -R node:node /data 2>/dev/null || true

echo "Bucket directories ready. Starting history-v1..."

# Switch to node user and start the app
exec gosu node node --expose-gc app.js
