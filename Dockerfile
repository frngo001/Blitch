# AI-Agent Service Dockerfile
# Multi-Provider LLM Gateway for Scientific Writing

FROM node:22.18.0 AS base

WORKDIR /overleaf/services/ai-agent

# Google Cloud Storage needs a writable $HOME/.config for resumable uploads
RUN mkdir -p /home/node/.config && chown node:node /home/node/.config

# Install Python and uv for MCP server support
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install uv (fast Python package installer) - uvx is included automatically
RUN pip3 install --break-system-packages uv

FROM base AS app

# Copy package files for dependency installation
COPY package.json package-lock.json /overleaf/
COPY libraries/fetch-utils/package.json /overleaf/libraries/fetch-utils/package.json
COPY libraries/logger/package.json /overleaf/libraries/logger/package.json
COPY libraries/metrics/package.json /overleaf/libraries/metrics/package.json
COPY libraries/mongo-utils/package.json /overleaf/libraries/mongo-utils/package.json
COPY libraries/o-error/package.json /overleaf/libraries/o-error/package.json
COPY libraries/promise-utils/package.json /overleaf/libraries/promise-utils/package.json
COPY libraries/settings/package.json /overleaf/libraries/settings/package.json
COPY services/ai-agent/package.json /overleaf/services/ai-agent/package.json
COPY patches/ /overleaf/patches/

RUN cd /overleaf && npm ci --quiet --legacy-peer-deps --force

# Install MCP SDK for tool integration
RUN cd /overleaf && npm install @modelcontextprotocol/sdk --save --legacy-peer-deps

# Install Vercel AI SDK with native DeepSeek provider for tool calling support
RUN cd /overleaf && npm install ai @ai-sdk/deepseek @ai-sdk/anthropic @ai-sdk/google zod --save --legacy-peer-deps

# Copy libraries
COPY libraries/fetch-utils/ /overleaf/libraries/fetch-utils/
COPY libraries/logger/ /overleaf/libraries/logger/
COPY libraries/metrics/ /overleaf/libraries/metrics/
COPY libraries/mongo-utils/ /overleaf/libraries/mongo-utils/
COPY libraries/o-error/ /overleaf/libraries/o-error/
COPY libraries/promise-utils/ /overleaf/libraries/promise-utils/
COPY libraries/settings/ /overleaf/libraries/settings/

# Copy service code
COPY services/ai-agent/ /overleaf/services/ai-agent/

FROM app
USER node

CMD ["node", "--expose-gc", "app.js"]
