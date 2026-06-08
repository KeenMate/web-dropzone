import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const corePkg = JSON.parse(readFileSync('../web-dropzone-core/package.json', 'utf-8'));

export default defineConfig({
  define: {
    '__VERSION__': JSON.stringify(pkg.version),
    '__PACKAGE_NAME__': JSON.stringify(pkg.name),
    '__AUTHOR__': JSON.stringify(pkg.author ?? 'Keenmate'),
    '__LICENSE__': JSON.stringify(pkg.license ?? 'MIT'),
    '__REPOSITORY__': JSON.stringify(pkg.repository?.url ?? ''),
    '__HOMEPAGE__': JSON.stringify(pkg.homepage ?? ''),
    '__CORE_VERSION__': JSON.stringify(corePkg.version),
    '__CORE_PACKAGE_NAME__': JSON.stringify(corePkg.name)
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'WebDropzone',
      formats: ['es', 'umd'],
      fileName: (format) => `dropzone.${format === 'es' ? 'js' : 'umd.js'}`
    },
    rollupOptions: {
      // Core is bundled into the renderer for now — easier for end-users.
      // Future: mark as external to force separate import.
      external: [],
      output: { globals: {} }
    }
  }
});
