import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';

// Root vite config — dev server only.
//
// The examples HTML files at the repo root still reference `/src/index.ts`
// (the pre-monorepo location of the renderer barrel). We alias that path
// to the renderer package's `src/index.ts` so the examples keep working
// without touching every HTML file. The aliasing is dev-server scoped;
// production builds happen inside each package via `npm run build -ws`.
//
// The `define` block mirrors `packages/web-dropzone/vite.config.ts` — the
// renderer's index.ts references `__VERSION__` / `__PACKAGE_NAME__` etc.
// for the `window.components['web-dropzone']` global API. At build time
// the per-package vite config injects them; at dev time we have to do
// the same here, otherwise the examples crash with `ReferenceError:
// __PACKAGE_NAME__ is not defined` on first load.
const rendererPkg = JSON.parse(
  readFileSync('./packages/web-dropzone/package.json', 'utf-8')
);

export default defineConfig({
  define: {
    '__VERSION__': JSON.stringify(rendererPkg.version),
    '__PACKAGE_NAME__': JSON.stringify(rendererPkg.name),
    '__AUTHOR__': JSON.stringify(rendererPkg.author ?? 'Keenmate'),
    '__LICENSE__': JSON.stringify(rendererPkg.license ?? 'MIT'),
    '__REPOSITORY__': JSON.stringify(rendererPkg.repository?.url ?? ''),
    '__HOMEPAGE__': JSON.stringify(rendererPkg.homepage ?? '')
  },
  resolve: {
    alias: {
      // Examples HTML files reference `/src/index.ts` directly.
      '/src/index.ts': resolve(__dirname, 'packages/web-dropzone/src/index.ts'),
      // During dev, resolve the core package to its TS source so edits in
      // core/ trigger HMR in the renderer instead of serving a stale built
      // dist/core.js. The exports map in core's package.json otherwise
      // resolves `@keenmate/web-dropzone-core` to its built artifact.
      '@keenmate/web-dropzone-core': resolve(__dirname, 'packages/web-dropzone-core/src/index.ts')
    }
  }
});
