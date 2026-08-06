import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'path';
import { readFileSync, readdirSync } from 'fs';

// The renderer registers its satellite custom elements (<web-dropzone-picker>,
// -list, -progress, -indicator) as a side effect of index.ts importing their
// modules. The package's `sideEffects` allowlist only names the built dist/
// files, so building the examples FROM SOURCE makes Vite's resolver annotate
// those src modules as side-effect-free — and Rollup then tree-shakes the
// customElements.define() registrations away (satellites render empty, height 0).
// (The published library build is immune: lib mode preserves all public exports.)
// This plugin re-marks the renderer's own source modules as side-effectful so the
// registrations always survive. Scoped to the examples build; leaves the
// published package's sideEffects field untouched.
function keepRendererSideEffects(): Plugin {
  // Vite normalizes module ids to forward slashes; normalize our marker too so
  // the prefix test works on Windows (where resolve() yields backslashes).
  const rendererSrc = resolve(__dirname, 'packages/web-dropzone/src').replace(/\\/g, '/') + '/';
  return {
    name: 'keep-renderer-side-effects',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (resolved && resolved.id.replace(/\\/g, '/').startsWith(rendererSrc)) {
        return { ...resolved, moduleSideEffects: true };
      }
      return resolved;
    }
  };
}

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
  plugins: [keepRendererSideEffects()],
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
