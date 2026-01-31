# Modified for Railway deployment with TeX Live
# Use texlive base image then add Node.js

FROM texlive/texlive:latest AS texlive

FROM node:22.18.0-bookworm AS base

# Force cache invalidation - change this value to force rebuild
ARG CACHEBUST=2026-01-31-v6
RUN echo "Cache bust: $CACHEBUST at $(date)"

# Copy TeX Live from the texlive image
COPY --from=texlive /usr/local/texlive /usr/local/texlive

# Dynamically find and set the correct TeX Live path (handles any year version)
RUN TEXLIVE_BIN=$(find /usr/local/texlive -type d -name "x86_64-linux" -path "*/bin/*" 2>/dev/null | head -1) && \
    if [ -n "$TEXLIVE_BIN" ]; then \
        echo "Found TeX Live bin at: $TEXLIVE_BIN"; \
        echo "export PATH=$TEXLIVE_BIN:\$PATH" >> /etc/profile.d/texlive.sh; \
        ln -sf $TEXLIVE_BIN/* /usr/local/bin/ 2>/dev/null || true; \
    else \
        echo "ERROR: TeX Live bin directory not found!"; \
        ls -la /usr/local/texlive/; \
        exit 1; \
    fi

# Set PATH for subsequent RUN commands and container runtime
ENV PATH="/usr/local/bin:${PATH}"

# Verify TeX Live installation
RUN echo "Verifying TeX Live..." && \
    which latexmk && latexmk --version && \
    which pdflatex && pdflatex --version | head -3

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
