import { defineConfig } from 'vite';
import { resolve } from 'path';

// Root vite config — dev server only.
//
// The examples HTML files at the repo root still reference `/src/index.ts`
// (the pre-monorepo location of the renderer barrel). We alias that path
// to the renderer package's `src/index.ts` so the examples keep working
// without touching every HTML file. The aliasing is dev-server scoped;
// production builds happen inside each package via `npm run build -ws`.
export default defineConfig({
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
