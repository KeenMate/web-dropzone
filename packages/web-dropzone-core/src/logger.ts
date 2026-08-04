/**
 * Categorized loggers for the dropzone family, built on
 * `@keenmate/web-components-core`'s `/logging` (`createLoggers`) — the shared,
 * color-prefixed `loglevel` wrapper (web-components-core SPEC §12.1). This
 * replaces the previously vendored `loglevel` + prefix-plugin copy: the ordering
 * bug that vendored copy hand-worked-around in a `methodFactory` is exactly what
 * core's implementation avoids, so the workaround is gone.
 *
 * The public surface is unchanged — `initLogger` / `fileLogger` / `uiLogger` /
 * `interactionLogger`, the `LOGGING_CATEGORIES` list, and the four control
 * functions all keep their names and behaviour, so the renderer's global API
 * (`window.components['web-dropzone'].logging`) and every `import { … } from
 * '@keenmate/web-dropzone-core'` keep working.
 *
 * Categories: DROPZONE:INIT / FILE / UI / INTERACTION.
 *
 * Logging is silent by default (production). Enable it from the console via the
 * global API or the exported helpers:
 *   window.components['web-dropzone'].logging.enableLogging();
 *   window.components['web-dropzone'].logging.setCategoryLevel('DROPZONE:UI', 'debug');
 */

import { createLoggers, type LogLevelDesc } from '@keenmate/web-components-core';

const NAMESPACE = 'DROPZONE';
const CATEGORIES = ['INIT', 'FILE', 'UI', 'INTERACTION'] as const;
type Category = (typeof CATEGORIES)[number];

const bundle = createLoggers(NAMESPACE, CATEGORIES);

// Core's createLoggers leaves each logger at loglevel's default; dropzone ships
// quiet in production, so silence everything on load.
bundle.disableLogging();

// Category-specific loggers (real loglevel Loggers: .trace/.debug/.info/.warn/.error).
export const initLogger = bundle.loggers.INIT;
export const fileLogger = bundle.loggers.FILE;
export const uiLogger = bundle.loggers.UI;
export const interactionLogger = bundle.loggers.INTERACTION;

/**
 * All logging categories, kept as the full `NAMESPACE:CATEGORY` names so
 * `loglevel` routes them independently from any other consumer that imports
 * `loglevel`, and so `getCategories()` / `setCategoryLevel()` accept the same
 * strings they always did.
 */
export const LOGGING_CATEGORIES = CATEGORIES.map((c) => `${NAMESPACE}:${c}`);

/** Enable all logging (debug level). */
export function enableLogging(): void {
    bundle.enableLogging();
}

/** Disable all logging (silent). */
export function disableLogging(): void {
    bundle.disableLogging();
}

/**
 * Set the log level for every category.
 * @param level 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent'
 */
export function setLogLevel(level: string): void {
    bundle.setLogLevel(level as LogLevelDesc);
}

/**
 * Set the log level for a single category. Accepts either the full
 * `DROPZONE:UI` name or the bare `UI` category.
 * @param level 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent'
 */
export function setCategoryLevel(category: string, level: string): void {
    const short = (
        category.startsWith(`${NAMESPACE}:`) ? category.slice(NAMESPACE.length + 1) : category
    ) as Category;
    bundle.setCategoryLevel(short, level as LogLevelDesc);
}
