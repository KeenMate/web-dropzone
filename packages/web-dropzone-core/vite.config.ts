import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'WebDropzoneCore',
      formats: ['es', 'umd'],
      fileName: (format) => `core.${format === 'es' ? 'js' : 'umd.js'}`
    },
    rollupOptions: {
      external: [],
      output: { globals: {} }
    }
  }
});
