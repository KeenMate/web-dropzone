# syntax=docker/dockerfile:1

# Two-stage build: Vite compiles the examples to static files, nginx serves them.
# No Node runtime and no node_modules ship in the final image.
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

# ---- serve: static file server, no Node ----
FROM nginx:alpine AS serve

# Replace the stock server block with one that serves the static examples and
# silently drops vulnerability-scanner traffic (see nginx.conf).
COPY nginx.conf /etc/nginx/conf.d/default.conf

# The examples build is fully static (HTML + hashed asset bundles). Serve it
# straight from nginx's web root — vite.examples.config.ts already rewrote the
# dev `/src/index.ts` entry to the compiled bundle, so no post-copy patching is
# needed (unlike the raw-HTML sibling components).
COPY --from=build /app/dist-examples /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
