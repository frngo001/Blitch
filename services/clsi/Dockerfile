# Modified for Railway deployment with TeX Live
# Use texlive base image then add Node.js
# Cache bust: 2026-01-31-v3

FROM texlive/texlive:latest AS texlive

FROM node:22.18.0-bookworm AS base

# Copy TeX Live from the texlive image
COPY --from=texlive /usr/local/texlive /usr/local/texlive
ENV PATH="/usr/local/texlive/2024/bin/x86_64-linux:${PATH}"

WORKDIR /overleaf/services/clsi
COPY services/clsi/install_deps.sh /overleaf/services/clsi/
RUN chmod 0755 ./install_deps.sh && ./install_deps.sh

ENTRYPOINT ["/bin/sh", "/entrypoint.sh"]
COPY services/clsi/entrypoint.sh /

# Google Cloud Storage needs a writable $HOME/.config for resumable uploads
# (see https://googleapis.dev/nodejs/storage/latest/File.html#createWriteStream)
RUN mkdir /home/node/.config && chown node:node /home/node/.config

FROM base AS app

COPY package.json package-lock.json /overleaf/
COPY libraries/fetch-utils/package.json /overleaf/libraries/fetch-utils/package.json
COPY libraries/logger/package.json /overleaf/libraries/logger/package.json
COPY libraries/metrics/package.json /overleaf/libraries/metrics/package.json
COPY libraries/o-error/package.json /overleaf/libraries/o-error/package.json
COPY libraries/promise-utils/package.json /overleaf/libraries/promise-utils/package.json
COPY libraries/settings/package.json /overleaf/libraries/settings/package.json
COPY libraries/stream-utils/package.json /overleaf/libraries/stream-utils/package.json
COPY services/clsi/package.json /overleaf/services/clsi/package.json
COPY patches/ /overleaf/patches/

RUN cd /overleaf && npm ci --quiet --legacy-peer-deps --force
COPY libraries/fetch-utils/ /overleaf/libraries/fetch-utils/
COPY libraries/logger/ /overleaf/libraries/logger/
COPY libraries/metrics/ /overleaf/libraries/metrics/
COPY libraries/o-error/ /overleaf/libraries/o-error/
COPY libraries/promise-utils/ /overleaf/libraries/promise-utils/
COPY libraries/settings/ /overleaf/libraries/settings/
COPY libraries/stream-utils/ /overleaf/libraries/stream-utils/
COPY services/clsi/ /overleaf/services/clsi/

FROM app
RUN mkdir -p cache compiles output \
&&  chown node:node cache compiles output

CMD ["node", "--expose-gc", "app.js"]
