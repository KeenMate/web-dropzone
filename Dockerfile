# Two-stage build: Vite compiles the examples to static files, Caddy serves them.
# Result is a ~50 MB image (vs ~290 MB for the dev-server approach) with no Node
# runtime and no node_modules shipped.
#
# The examples-*.html demos import `/src/index.ts` (raw TS); vite.examples.config.ts
# aliases that to the renderer source and emits a static multi-page bundle into
# dist-examples/. See `npm run build:examples`.

# ---- build: compile examples to static assets ----
FROM node:24-alpine AS build

WORKDIR /app

# Manifests + lockfile first so the install layer caches across source-only
# changes. All deps resolve from the public npm registry (npm ci = reproducible).
COPY package.json package-lock.json ./
COPY packages/web-dropzone/package.json packages/web-dropzone/
COPY packages/web-dropzone-core/package.json packages/web-dropzone-core/
RUN npm ci

# Source + configs, then produce dist-examples/.
COPY . .
RUN npm run build:examples

# ---- runtime: static file server, no Node ----
FROM caddy:2-alpine

COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist-examples /srv

EXPOSE 12200
