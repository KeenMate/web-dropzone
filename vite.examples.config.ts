import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync, readdirSync } from 'fs';

// Static multi-page build of the examples-*.html demos + index.html landing page.
// Produces `dist-examples/` for serving behind a plain static file server (see
// Dockerfile — Caddy runtime stage). Mirrors the alias + define blocks of the
// dev-only root vite.config.ts so the built output matches what `make dev` serves.
const rendererPkg = JSON.parse(
  readFileSync('./packages/web-dropzone/package.json', 'utf-8')
);
const corePkg = JSON.parse(
  readFileSync('./packages/web-dropzone-core/package.json', 'utf-8')
);

// Every root *.html file is its own entry point (multi-page build).
const htmlInputs = Object.fromEntries(
  readdirSync('.')
    .filter((f) => f.endsWith('.html'))
    .map((f) => [f.replace(/\.html$/, ''), resolve(__dirname, f)])
);

export default defineConfig({
  define: {
    '__VERSION__': JSON.stringify(rendererPkg.version),
    '__PACKAGE_NAME__': JSON.stringify(rendererPkg.name),
    '__AUTHOR__': JSON.stringify(rendererPkg.author ?? 'Keenmate'),
    '__LICENSE__': JSON.stringify(rendererPkg.license ?? 'MIT'),
    '__REPOSITORY__': JSON.stringify(rendererPkg.repository?.url ?? ''),
    '__HOMEPAGE__': JSON.stringify(rendererPkg.homepage ?? ''),
    '__CORE_VERSION__': JSON.stringify(corePkg.version),
    '__CORE_PACKAGE_NAME__': JSON.stringify(corePkg.name)
  },
  resolve: {
    alias: {
      // Examples reference `/src/index.ts` directly — map it to the renderer
      // source, and resolve core to its TS source (same as the dev config).
      '/src/index.ts': resolve(__dirname, 'packages/web-dropzone/src/index.ts'),
      '@keenmate/web-dropzone-core': resolve(__dirname, 'packages/web-dropzone-core/src/index.ts')
    }
  },
  build: {
    outDir: 'dist-examples',
    emptyOutDir: true,
    rollupOptions: { input: htmlInputs }
  }
});
