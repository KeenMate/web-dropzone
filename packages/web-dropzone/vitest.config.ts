import { defineConfig } from 'vitest/config';

/**
 * Vitest config for the renderer package's unit tests.
 *
 * Unit specs live in `test/unit/*.test.ts` and exercise element-level logic in a
 * lightweight DOM (happy-dom) without a real browser — fast, isolated checks of
 * the `BlissElement` input-table wiring (attribute → config, property
 * reflection/coalescing) and form association (`el.form`). Broader
 * interaction/visual behaviour stays in the Playwright e2e suite at the repo root
 * (`e2e/`), which also covers what jsdom/happy-dom can't (real
 * `ElementInternals.form`, layout, drag-drop).
 *
 * Commands (from this package, or `-w @keenmate/web-dropzone` at the root):
 *   npm run test:unit        # run once
 *   npm run test:unit:watch  # watch mode
 */
export default defineConfig({
    test: {
        environment: 'happy-dom',
        include: ['test/unit/**/*.test.ts'],
        globals: true,
    },
});
