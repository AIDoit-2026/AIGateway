FROM node:26.5.0-trixie-slim AS builder

WORKDIR /app

ARG HTTPS_PROXY
ARG https_proxy

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

ENV PYTHON=/usr/bin/python3

COPY package.json package-lock.json ./
RUN export HTTPS_PROXY="${HTTPS_PROXY:-$https_proxy}" \
  && export https_proxy="${https_proxy:-$HTTPS_PROXY}" \
  && npm ci --ignore-scripts --no-audit --no-fund
RUN export HTTPS_PROXY="${HTTPS_PROXY:-$https_proxy}" \
  && export https_proxy="${https_proxy:-$HTTPS_PROXY}" \
  && npm rebuild esbuild sharp better-sqlite3 --no-audit --no-fund

COPY . .
RUN npm run build:web && npm run build:server
RUN npm prune --omit=dev --no-audit --no-fund

FROM node:26.5.0-trixie-slim

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/drizzle ./drizzle

RUN mkdir -p /app/data

EXPOSE 4000

ENV NODE_ENV=production
ENV DATA_DIR=/app/data

CMD ["sh", "-c", "node dist/server/db/migrate.js && node dist/server/index.js"]
