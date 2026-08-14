/**
 * `<web-dropzone>` — the custom element, now built on
 * `@keenmate/web-components-core` (`BlissElement`).
 *
 * All the custom-element plumbing that used to live here by hand — the
 * `ATTRIBUTE_TABLE`, `parseAttrValue`, `observedAttributes`,
 * `attributeChangedCallback`, the pre-upgrade `upgradeProperties` rescue, and
 * the ~40 property/callback getters/setters — is now declared ONCE as a core
 * input table (`static inputs`). Core owns parsing, validation, reactivity
 * coalescing, reflection, pre-upgrade property lifting, and form association
 * (`this.internals` / `el.form`). This file keeps only what is genuinely
 * dropzone-specific: the bridge from the merged `config` to the headless store
 * (`WebDropzone` in `dropzone.ts`), the operating-mode resolution, form-value
 * sync (real `File` blobs via `setFormValue`), custom-style injection, and the
 * `store-ready` handshake the satellites depend on.
 *
 * Reactivity: the store applies EVERY config change in place (`updateConfig`
 * always returns true), so almost every input is `on: 'update'`. The single
 * exception is a change to the operating mode — toggling `mode` /
 * `display-mode` / `selector-appearance` / `list-appearance` can flip which
 * render path the store uses, which `updateConfig` can't express; `update()`
 * detects that flip and does a full rebuild (a fresh `WebDropzone`, matching the
 * pre-core behaviour). First connect is always a rebuild via `reinit()`.
 */

import {
    BlissElement,
    toBool,
    toEnum,
    toInt,
    toText,
    toValue,
    toFunction,
    toCustom,
    type InputDef,
    type Converter,
} from '@keenmate/web-components-core';
import { WebDropzone } from './dropzone';
import { initLogger, dispatchComposedEvent } from '@keenmate/web-dropzone-core';
import type { DropzoneStoreAPI } from '@keenmate/web-dropzone-core';
import type {
    DropzoneConfig,
    DisplayMode,
    DropzoneMode,
    SelectorAppearance,
    ListAppearance,
    GridLayout,
    RollingRotation,
    CardSize,
    ValueFormat,
    FileState
} from '@keenmate/web-dropzone-core';

// Import CSS as inline string for Shadow DOM injection
import styles from './css/main.css?inline';

/**
 * Parse a byte count from a string. Accepts plain integers ("5242880") and
 * human-readable forms with case-insensitive unit suffixes and optional
 * whitespace ("5MB", "300 kB", "1.5GB", "1024B"). Returns null if the input
 * doesn't match; the converter falls back to the spec's default in that case.
 *
 * Binary units (1024-based) — matches the display side in formatFileSize().
 * Aliases: K/KB, M/MB, G/GB, T/TB (no SI variants — `5MB` always means
 * 5 × 1024 × 1024). This is intentionally wider than core's `toBytes`, which
 * doesn't accept the single-letter aliases; that's why the size inputs wrap
 * `parseBytes` in `toCustom` rather than using `toBytes` directly.
 */
const BYTE_UNIT_MULTIPLIERS: Record<string, number> = {
    '':   1,
    'b':  1,
    'k':  1024,
    'kb': 1024,
    'm':  1024 ** 2,
    'mb': 1024 ** 2,
    'g':  1024 ** 3,
    'gb': 1024 ** 3,
    't':  1024 ** 4,
    'tb': 1024 ** 4
};

export function parseBytes(raw: string): number | null {
    const m = raw.trim().match(/^(\d+(?:\.\d+)?)\s*([a-z]*)$/i);
    if (!m) return null;
    const value = parseFloat(m[1]);
    const mult = BYTE_UNIT_MULTIPLIERS[m[2].toLowerCase()];
    if (mult === undefined) return null;
    return Math.round(value * mult);
}

const PLACEMENTS = [
    'top', 'top-start', 'top-end',
    'bottom', 'bottom-start', 'bottom-end',
    'left', 'left-start', 'left-end',
    'right', 'right-start', 'right-end'
] as const;

/** Byte-size input: preserves dropzone's `parseBytes` (single-letter aliases). */
const bytes = (def: number): Converter<number> =>
    toCustom<number>(
        (raw) => (raw == null ? def : parseBytes(raw) ?? def),
        {
            validate: (v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0,
            toAttribute: (v) => (v == null ? null : String(v)),
        },
    );

/** Optional string: absent / empty → null (normalized to "absent" for the store). */
const text = (): Converter<string | null> => toText({ isNullable: true });

/** Any callback input (property-only). */
const cb = (): ReturnType<typeof toFunction> => toFunction();

/**
 * Comma-separated allowlist input (Plyr-style `controls`). Parses
 * `"a, b ,c"` → `['a','b','c']`, lower-cased, de-duplicated, and filtered to
 * the supplied valid tokens (unknown tokens are dropped). Absent / empty →
 * null, which the store reads as "unset" (render everything). Reflects back as
 * the joined string.
 */
const list = <T extends string>(valid: readonly T[]): Converter<T[] | null> =>
    toCustom<T[] | null>(
        (raw) => {
            if (raw == null) return null;
            const allowed = new Set<string>(valid);
            const seen = new Set<string>();
            const tokens = raw
                .split(',')
                .map((s) => s.trim().toLowerCase())
                .filter((t) => t && allowed.has(t) && !seen.has(t) && seen.add(t)) as T[];
            return tokens.length ? tokens : null;
        },
        {
            validate: (v): v is T[] | null =>
                v == null || (Array.isArray(v) && v.every((x) => typeof x === 'string')),
            toAttribute: (v) => (Array.isArray(v) && v.length ? v.join(',') : null),
        },
    );

const CONTROL_TOKENS = ['picker', 'list', 'overall-progress'] as const;
const ITEM_PART_TOKENS = ['icon', 'name', 'size', 'type', 'progress', 'status', 'action', 'remove'] as const;

// ============================================================================
// INPUT TABLE — the whole <web-dropzone> public surface, one row each.
// `configKey` is the DropzoneConfig key, so the merged `config` bridges to the
// store almost verbatim (see #assembleConfig). Everything is `on: 'update'`;
// the store applies changes in place, and #update handles the mode-flip rebuild.
// ============================================================================
const INPUTS: readonly InputDef[] = [
    // ── Core ──────────────────────────────────────────────────────────────────
    { configKey: 'accept',                  attribute: 'accept',              converter: text(),                                                                       reflect: true, on: 'update', description: 'Accepted file types (MIME types / extensions), comma-separated.' },
    { configKey: 'isMultipleEnabled',       attribute: 'multiple',            converter: toBool('default-true'),                                                       on: 'update', type: 'boolean', description: 'Allow selecting multiple files. Public property: `el.multiple`.' },
    { configKey: 'maxFileSize',             attribute: 'max-file-size',       converter: bytes(0),                                                                     reflect: true, on: 'update', description: 'Maximum size per file in bytes (accepts "5MB", "1.5GB", …). 0 = unlimited.' },
    { configKey: 'minFileSize',             attribute: 'min-file-size',       converter: bytes(0),                                                                     reflect: true, on: 'update', description: 'Minimum size per file in bytes. 0 = no minimum.' },
    { configKey: 'maxTotalSize',            attribute: 'max-total-size',      converter: bytes(0),                                                                     reflect: true, on: 'update', description: 'Maximum combined size of all files in bytes. 0 = unlimited.' },
    { configKey: 'maxFileCount',            attribute: 'max-file-count',      converter: toInt({ default: 0 }),                                                        reflect: true, on: 'update', description: 'Maximum number of files. 0 = unlimited.' },
    { configKey: 'minFileCount',            attribute: 'min-file-count',      converter: toInt({ default: 0 }),                                                        reflect: true, on: 'update', description: 'Minimum number of files; reflected into the form validity (valueMissing).' },
    { configKey: 'maxVisibleFiles',         attribute: 'max-visible-files',   converter: toInt({ default: 7 }),                                                        reflect: true, on: 'update', description: 'How many file rows are visible before the list scrolls.' },
    { configKey: 'dedupeMode',              attribute: 'dedupe-mode',         converter: toEnum(['name', 'name-size', 'none'] as const, { default: 'name' }),          reflect: true, on: 'update', description: 'How duplicate files are detected: by name, name+size, or not at all.' },
    { configKey: 'isDisabled',              attribute: 'disabled',            converter: toBool('default-false'),                                                      on: 'update', type: 'boolean', description: 'Disable the dropzone. Public property: `el.disabled`.' },

    // ── Operating mode ────────────────────────────────────────────────────────
    { configKey: 'mode',                    attribute: 'mode',                converter: toEnum(['bulk', 'structural', 'headless'] as const),                          on: 'update', description: 'Operating mode. When absent it is inferred from the presence of renderer-trigger attributes (display-mode / selector-appearance / list-appearance → bulk; none → headless). `structural` is the only way to opt into render callbacks.' },
    { configKey: 'progressThrottle',        attribute: 'progress-throttle',   converter: toInt({ default: 0 }),                                                        reflect: true, on: 'update', description: 'Throttle interval in ms for file-progress events. 0 = every tick.' },

    // ── Display ───────────────────────────────────────────────────────────────
    { configKey: 'displayMode',             attribute: 'display-mode',        converter: toEnum(['list', 'detailed', 'grid', 'compact'] as const, { default: 'list' }), reflect: true, on: 'update', description: 'Single-axis display shorthand.' },
    { configKey: 'selectorAppearance',      attribute: 'selector-appearance', converter: toEnum(['card', 'button', 'minimal', 'native'] as const),                    reflect: true, on: 'update', description: 'File-selector appearance (overrides the display shorthand when set).' },
    { configKey: 'listAppearance',          attribute: 'list-appearance',     converter: toEnum(['list', 'detailed', 'grid', 'badges', 'rolling', 'popover', 'none'] as const), reflect: true, on: 'update', description: 'File-list appearance (overrides the display shorthand when set).' },
    { configKey: 'gridLayout',              attribute: 'grid-layout',         converter: toEnum(['uniform', 'natural'] as const, { default: 'uniform' }),               reflect: true, on: 'update', description: 'Tile layout for list-appearance="grid": uniform equal-size tiles, or natural (equal-height rows that keep each image aspect ratio).' },
    { configKey: 'controls',                attribute: 'controls',            converter: list(CONTROL_TOKENS),                                                         reflect: true, on: 'update', type: 'DropzoneControl[]', description: 'Plyr-style allowlist of top-level surfaces (comma-separated): picker, list, overall-progress. Unset = render all.' },
    { configKey: 'itemControls',            attribute: 'item-controls',       converter: list(ITEM_PART_TOKENS),                                                       reflect: true, on: 'update', type: 'FileItemPart[]', description: 'Plyr-style allowlist of per-row parts (comma-separated): icon, name, size, type, progress, status, action, remove. Unset = render all.' },
    { configKey: 'rollingRotation',         attribute: 'rolling-rotation',    converter: toEnum(['horizontal', 'vertical', 'slide-in'] as const, { default: 'slide-in' }), reflect: true, on: 'update', description: 'Rotation style for the rolling list appearance.' },
    { configKey: 'cardSize',                attribute: 'card-size',           converter: toEnum(['minimal', 'compact', 'big'] as const),                               reflect: true, on: 'update', description: 'Card size for the card selector appearance.' },
    { configKey: 'isShowThumbnailsEnabled', attribute: 'show-thumbnails',     converter: toBool('tristate'),                                                           on: 'update', type: 'boolean', description: 'Force image thumbnails on/off. Property-only tristate: unset (undefined) means auto (on for grid, icons elsewhere). Public property: `el.showThumbnails`.' },
    { configKey: 'isFilesInsideEnabled',    attribute: 'files-inside',        converter: toBool('default-false'),                                                      on: 'update', type: 'boolean', description: 'Render the file list inside the drop area. Public property: `el.filesInside`.' },
    { configKey: 'icon',                    attribute: 'icon',                converter: text(),                                                                       reflect: true, on: 'update', description: 'Prompt icon (emoji or markup).' },
    { configKey: 'promptText',              attribute: 'prompt-text',         converter: text(),                                                                       reflect: true, on: 'update', description: 'Primary prompt text shown in the drop area.' },
    { configKey: 'selectFilesText',         attribute: 'select-files-text',   converter: text(),                                                                       reflect: true, on: 'update', description: 'Label for the browse/select-files action.' },
    { configKey: 'noFileChosenText',        attribute: 'no-file-chosen-text', converter: text(),                                                                       reflect: true, on: 'update', description: 'Text shown when no file has been chosen.' },
    { configKey: 'hintText',                attribute: 'hint-text',           converter: text(),                                                                       reflect: true, on: 'update', description: 'Secondary hint text under the prompt.' },
    { configKey: 'dragActiveText',          attribute: 'drag-active-text',    converter: text(),                                                                       reflect: true, on: 'update', description: 'Text shown while a drag is over the drop area.' },
    { configKey: 'emptyMessage',            attribute: 'empty-message',       converter: text(),                                                                       reflect: true, on: 'update', description: 'Message shown when the file list is empty.' },

    // ── Compact mode ──────────────────────────────────────────────────────────
    { configKey: 'summaryTemplate',         attribute: 'summary-template',    converter: text(),                                                                       reflect: true, on: 'update', description: 'Template string for the compact-mode summary line.' },
    { configKey: 'popoverPlacement',        attribute: 'popover-placement',   converter: toEnum(PLACEMENTS, { default: 'bottom-start' }),                              reflect: true, on: 'update', description: 'Placement of the compact-mode popover relative to the summary (floating-ui placement).' },

    // ── Drag overlay ──────────────────────────────────────────────────────────
    { configKey: 'overlayTarget',           attribute: 'overlay-target',      converter: toCustom<HTMLElement | string | null>(
        (raw) => raw,
        {
            validate: (v): v is HTMLElement | string | null =>
                v == null || typeof v === 'string' || (typeof HTMLElement !== 'undefined' && v instanceof HTMLElement),
            // An HTMLElement can't live in an attribute — reflecting one removes
            // the (now stale) string attribute so the store resolves the element.
            toAttribute: (v) => (typeof v === 'string' && v !== '' ? v : null),
        },
    ), reflect: true, on: 'update', type: 'HTMLElement | string', description: 'Element (or selector string) that acts as the full-viewport drag-overlay target. Assign an HTMLElement via the property; a selector string via the `overlay-target` attribute.' },
    { configKey: 'overlayText',             attribute: 'overlay-text',        converter: text(),                                                                       reflect: true, on: 'update', description: 'Text shown in the drag overlay.' },
    { configKey: 'overlayIcon',             attribute: 'overlay-icon',        converter: text(),                                                                       reflect: true, on: 'update', description: 'Icon shown in the drag overlay.' },

    // ── Form integration ──────────────────────────────────────────────────────
    { configKey: 'name',                    attribute: 'name',                converter: text(),                                                                       reflect: true, on: 'update', description: 'Form field name. Files submit as real FormData blobs under this name.' },
    { configKey: 'valueFormat',             attribute: 'value-format',        converter: toEnum(['json', 'csv', 'array'] as const, { default: 'json' }),               reflect: true, on: 'update', description: 'Fallback hidden-input serialization format hint (FormData blobs are always submitted for files).' },

    // ── Upload pipeline (meaningful once uploadFileCallback is set) ────────────
    { configKey: 'concurrency',             attribute: 'concurrency',         converter: toInt({ default: 1 }),                                                        reflect: true, on: 'update', description: 'Maximum concurrent uploads through the worker pool.' },
    { configKey: 'isAutoUploadEnabled',     attribute: 'auto-upload',         converter: toBool('default-true'),                                                       on: 'update', type: 'boolean', description: 'Auto-upload newly added files. Public property: `el.autoUpload`.' },
    { configKey: 'isUploadedFileDeletable',  attribute: 'uploaded-deletable',  converter: toBool('default-true'),                                                       on: 'update', type: 'boolean', description: 'Whether already-uploaded files can be removed. Public property: `el.uploadedDeletable`.' },
    { configKey: 'isReorderCompletedEnabled', attribute: 'reorder-completed', converter: toBool('default-false'),                                                      on: 'update', type: 'boolean', description: 'Slide completed files to the bottom of the list. Public property: `el.reorderCompleted`.' },
    { configKey: 'reorderCompletedDelay',   attribute: 'reorder-completed-delay', converter: toInt({ default: 1500 }),                                                 reflect: true, on: 'update', description: 'Delay in ms before a completed file reorders. Only meaningful when reorder-completed is on.' },
    { configKey: 'progressMode',            attribute: 'progress-mode',       converter: toEnum(['optimistic', 'pessimistic'] as const, { default: 'optimistic' }),   reflect: true, on: 'update', description: 'Progress reporting contract: optimistic (tick before ACK, snap back on failure) or pessimistic (tick only after ACK).' },

    // ── Persistence ───────────────────────────────────────────────────────────
    { configKey: 'storageKey',              attribute: 'storage-key',         converter: text(),                                                                       reflect: true, on: 'update', description: 'Opaque key scoping persisted UI state. Unset disables persistence.' },

    // ── Callbacks (property-only) ─────────────────────────────────────────────
    { configKey: 'validateCallback',            converter: cb(),      on: 'update', type: '(file: File, existingFiles: FileState[]) => ValidationResult', description: 'Custom per-file validation.' },
    { configKey: 'beforeFilesAddedCallback',    converter: cb(),      on: 'update', type: '(files: File[]) => boolean | File[] | Promise<boolean | File[]>', description: 'Async confirmation / transform gate before files are added.' },
    { configKey: 'beforeFilesRemovedCallback',  converter: cb(),      on: 'update', type: '(files: FileState[]) => boolean | Promise<boolean>', description: 'Async confirmation gate before files are removed.' },
    { configKey: 'uploadFileCallback',          converter: cb(),      on: 'update', type: 'FileUploadHandler', description: 'Component-driven upload handler. When set, added files run through the worker pool.' },
    { configKey: 'retryPolicy',                 converter: toValue(), on: 'update', type: 'RetryPolicy', description: 'Retry policy applied when uploadFileCallback rejects. Property-only object.' },
    { configKey: 'renderFileItemCallback',      converter: cb(),      on: 'update', type: '(file: FileState, context: FileItemRenderContext) => string | HTMLElement', description: 'Custom render for a single file row (structural mode).' },
    { configKey: 'renderListWrapperCallback',   converter: cb(),      on: 'update', type: '(rowsHtml: string, files: FileState[]) => string | HTMLElement', description: 'Custom wrapper around the rendered file rows.' },
    { configKey: 'renderPromptCallback',        converter: cb(),      on: 'update', type: '() => string | HTMLElement', description: 'Custom render for the drop-area prompt.' },
    { configKey: 'renderSummaryCallback',       converter: cb(),      on: 'update', type: '(files: FileState[]) => string | HTMLElement', description: 'Custom render for the compact-mode summary.' },
    { configKey: 'customStylesCallback',        converter: cb(),      on: 'update', type: '() => string', description: 'Returns a CSS string injected into the shadow root (prepended so @import/@font-face work).' },
    { configKey: 'persistStateCallback',        converter: cb(),      on: 'update', type: '(key: string, state: DropzoneState) => void | Promise<void>', description: 'Custom persistence sink (defaults to localStorage).' },
    { configKey: 'loadStateCallback',           converter: cb(),      on: 'update', type: '(key: string) => DropzoneState | null | Promise<DropzoneState | null>', description: 'Custom persistence source paired with persistStateCallback.' },
];

// Track instances for the global API (window.components['web-dropzone']).
const instances = new Set<DropzoneElement>();

export function getAllInstances(): DropzoneElement[] {
    return Array.from(instances);
}

/**
 * DropzoneElement - <web-dropzone> custom element
 */
export class DropzoneElement extends BlissElement {
    // Opt into the form-associated custom element lifecycle so the surrounding
    // <form> sees this element in form.elements, form.reset(), and FormData
    // submissions. Core owns the single attachInternals() (exposed lazily via
    // the protected `internals` getter and the public `el.form`).
    static formAssociated = true;

    protected static override inputs = INPUTS;

    #shadow: ShadowRoot;
    #dropzone?: WebDropzone;
    #container: HTMLElement;
    #customStyleSheet?: HTMLStyleElement;
    #boundSyncFormValue = (): void => this.#syncFormValue();

    constructor() {
        super();

        // Shadow DOM + base stylesheet
        this.#shadow = this.attachShadow({ mode: 'open' });
        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        this.#shadow.appendChild(styleSheet);

        // Container the core store renders into.
        this.#container = document.createElement('div');
        this.#container.className = 'dz__host';
        this.#shadow.appendChild(this.#container);
    }

    /**
     * Underlying store — exposed as the `DropzoneStoreAPI` contract so consumers
     * stay decoupled from the concrete implementation. Used by satellite
     * renderers (`<web-dropzone-picker>`, `<web-dropzone-list>`, …) to resolve
     * their `for="<store-id>"` reference. Returns undefined before the store is
     * built; satellites handle the timing race via `store-ready` re-resolution.
     */
    getStore(): DropzoneStoreAPI | undefined {
        return this.#dropzone;
    }

    /**
     * Called by the browser when the surrounding <form> is reset. Clears the
     * dropzone selection so the component participates in the standard reset.
     */
    formResetCallback(): void {
        this.#dropzone?.clear();
    }

    // ── core lifecycle hooks ──────────────────────────────────────────────────

    /** Structural change (or first connect): rebuild the store from scratch. */
    protected override reinit(): void {
        this.#rebuildStore();
    }

    /**
     * In-place change: patch the live store via `updateConfig`. A change to any
     * of the four mode-determining inputs can flip the operating mode, which the
     * store can't apply in place — detect that and do a full rebuild instead
     * (matching the pre-core behaviour, where a mode flip reset the selection).
     */
    protected override update(partial: Record<string, unknown>): void {
        if (
            'mode' in partial ||
            'displayMode' in partial ||
            'selectorAppearance' in partial ||
            'listAppearance' in partial
        ) {
            const next = this.#resolveMode();
            if (this.#dropzone && this.#dropzone.getConfig().mode !== next) {
                this.#rebuildStore();
                return;
            }
        }

        // Custom styles are a shadow-root concern, not a store rebuild.
        if ('customStylesCallback' in partial) this.#injectCustomStyles();

        const storePartial: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(partial)) {
            if (key === 'customStylesCallback') continue; // handled above
            storePartial[key] = value === null ? undefined : value;
        }
        if (this.#dropzone && Object.keys(storePartial).length > 0) {
            this.#dropzone.updateConfig(storePartial as Partial<DropzoneConfig>);
        }

        // Form-relevant changes re-stamp the FormData; minFileCount alone only
        // affects validity.
        if ('name' in partial || 'valueFormat' in partial) {
            this.#syncFormValue();
        } else if ('minFileCount' in partial) {
            this.#syncValidity(this.#dropzone?.getFiles().length ?? 0);
        }
    }

    /** Activate: ensure the store exists (a DOM move destroyed it), start listeners. */
    protected override connect(): void {
        instances.add(this);
        if (!this.#dropzone) this.#buildStore();

        // The store dispatches a composed `change` event after every mutation
        // (add / remove / clear); we re-stamp the form value off it.
        this.addEventListener('change', this.#boundSyncFormValue);

        // FOUC prevention — expose [data-ready] once initialized.
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => this.setAttribute('data-ready', ''));
        } else {
            this.setAttribute('data-ready', '');
        }

        initLogger.debug('DropzoneElement connected');
    }

    /** Deactivate: stop listeners and tear the store down (rebuilt on next connect). */
    protected override disconnect(): void {
        instances.delete(this);
        this.removeEventListener('change', this.#boundSyncFormValue);
        this.#dropzone?.destroy();
        this.#dropzone = undefined;
        initLogger.debug('DropzoneElement disconnected');
    }

    // ── store lifecycle ───────────────────────────────────────────────────────

    #rebuildStore(): void {
        this.#dropzone?.destroy();
        this.#dropzone = undefined;
        this.#buildStore();
    }

    #buildStore(): void {
        const config = this.#assembleConfig();
        this.#injectCustomStyles();

        this.#dropzone = new WebDropzone(this.#container, config);
        this.#syncFormValue();

        // Notify satellite renderers (`<web-dropzone-picker for=>`, …) that the
        // store is now resolvable via `getStore()`. Bubbles + composed so
        // listeners in other shadow roots pick it up.
        dispatchComposedEvent(this, 'store-ready');

        initLogger.debug('Dropzone initialized', { config });
    }

    /**
     * Resolve the effective `mode` from explicit attribute + implicit detection.
     * Explicit `mode="…"` always wins. Otherwise: presence of any
     * renderer-trigger attribute → 'bulk'; absence → 'headless'. The implicit
     * path never lands on 'structural' — that requires an explicit
     * `mode="structural"`.
     */
    #resolveMode(): DropzoneMode {
        const raw = this.getAttribute('mode');
        if (raw === 'bulk' || raw === 'structural' || raw === 'headless') return raw;
        const hasRendererAttr = this.hasAttribute('display-mode')
            || this.hasAttribute('selector-appearance')
            || this.hasAttribute('list-appearance');
        return hasRendererAttr ? 'bulk' : 'headless';
    }

    /**
     * Build the store config from the merged `this.config`: strip "unset" (null)
     * keys so the store sees them as absent (it applies its own defaults), then
     * add the runtime wiring (resolved mode, container, host element).
     */
    #assembleConfig(): DropzoneConfig {
        const cfg: Record<string, unknown> = { ...this.config };
        for (const key of Object.keys(cfg)) {
            if (cfg[key] === null) delete cfg[key];
        }

        const mode = this.#resolveMode();
        cfg.mode = mode;
        cfg.isHeadless = mode === 'headless';

        // Shadow DOM container for popover anchoring + form-element host.
        cfg.container = this.#container;
        cfg.hostElement = this;
        return cfg as DropzoneConfig;
    }

    /**
     * Inject styles from `customStylesCallback` into the shadow root. The
     * stylesheet is *prepended* (before the base stylesheet) so `@import` /
     * `@font-face` rules — which must appear at the top of a stylesheet — take
     * effect. Replaces the previous custom-styles element if one was injected.
     */
    #injectCustomStyles(): void {
        if (this.#customStyleSheet) {
            this.#customStyleSheet.remove();
            this.#customStyleSheet = undefined;
        }
        const callback = this.config.customStylesCallback as (() => string) | null | undefined;
        if (typeof callback !== 'function') return;

        const css = callback();
        if (!css) return;

        const sheet = document.createElement('style');
        sheet.id = 'dz-custom-styles';
        sheet.textContent = css;
        this.#shadow.insertBefore(sheet, this.#shadow.firstChild);
        this.#customStyleSheet = sheet;
    }

    // ── form value ────────────────────────────────────────────────────────────

    /**
     * Build a FormData containing every selected File under the configured
     * `name`, and hand it to `internals.setFormValue()`. This is what makes the
     * surrounding <form> submit real file blobs the same way `<input type="file">`
     * would. If `internals` is unavailable (older browser, jsdom), this is a
     * no-op and consumers can still read `this.files` programmatically.
     */
    #syncFormValue(): void {
        const internals = this.internals;
        if (!internals) return;
        const files = this.#dropzone?.getFiles() ?? [];
        const name = this.getAttribute('name');

        if (!name || files.length === 0) {
            internals.setFormValue(null);
        } else {
            const formData = new FormData();
            for (const f of files) {
                formData.append(name, f.file, f.name);
            }
            internals.setFormValue(formData);
        }

        this.#syncValidity(files.length);
    }

    /**
     * Reflect `minFileCount` into the form's native validity. When the selection
     * is short, the surrounding form's submit refuses with the native validation
     * message instead of silently submitting an incomplete payload.
     */
    #syncValidity(fileCount: number): void {
        const internals = this.internals;
        if (!internals) return;
        const min = this.#dropzone?.getConfig().minFileCount ?? 0;
        if (min > 0 && fileCount < min) {
            internals.setValidity(
                { valueMissing: true },
                `At least ${min} file${min === 1 ? '' : 's'} required`
            );
        } else {
            internals.setValidity({});
        }
    }

    // ── back-compat property aliases ──────────────────────────────────────────
    // Core installs accessors named after each `configKey` (e.g.
    // `el.isMultipleEnabled`). These hand-written camelCase accessors preserve
    // the historical public property names, operating on the attribute (which
    // core observes) so the value still flows through the reactive pipeline.

    get multiple(): boolean {
        return this.config.isMultipleEnabled as boolean;
    }
    set multiple(value: boolean) {
        if (value) this.setAttribute('multiple', '');
        else this.setAttribute('multiple', 'false');
    }

    get disabled(): boolean {
        return this.config.isDisabled as boolean;
    }
    set disabled(value: boolean) {
        if (value) this.setAttribute('disabled', '');
        else this.removeAttribute('disabled');
    }

    /**
     * Three-state: `undefined` (unset → auto), `true`, or `false`. Auto means
     * thumbnails for `list-appearance="grid"`, icons everywhere else.
     */
    get showThumbnails(): boolean | undefined {
        const value = this.config.isShowThumbnailsEnabled as boolean | null;
        return value == null ? undefined : value;
    }
    set showThumbnails(value: boolean | undefined) {
        if (value === undefined) this.removeAttribute('show-thumbnails');
        else this.setAttribute('show-thumbnails', value ? '' : 'false');
    }

    get filesInside(): boolean {
        return this.config.isFilesInsideEnabled as boolean;
    }
    set filesInside(value: boolean) {
        if (value) this.setAttribute('files-inside', '');
        else this.removeAttribute('files-inside');
    }

    get autoUpload(): boolean {
        return this.config.isAutoUploadEnabled as boolean;
    }
    set autoUpload(value: boolean) {
        if (value) this.setAttribute('auto-upload', '');
        else this.setAttribute('auto-upload', 'false');
    }

    get uploadedDeletable(): boolean {
        return this.config.isUploadedFileDeletable as boolean;
    }
    set uploadedDeletable(value: boolean) {
        if (value) this.setAttribute('uploaded-deletable', '');
        else this.setAttribute('uploaded-deletable', 'false');
    }

    get reorderCompleted(): boolean {
        return this.config.isReorderCompletedEnabled as boolean;
    }
    set reorderCompleted(value: boolean) {
        if (value) this.setAttribute('reorder-completed', '');
        else this.removeAttribute('reorder-completed');
    }

    // Typed views of the reflected enum inputs (core installs the accessors;
    // these `declare`s only surface the precise TS types to consumers).
    declare displayMode: DisplayMode;
    declare selectorAppearance: SelectorAppearance | null;
    declare listAppearance: ListAppearance | null;
    declare gridLayout: GridLayout | null;
    declare rollingRotation: RollingRotation;
    declare cardSize: CardSize | null;
    declare valueFormat: ValueFormat;
    declare overlayTarget: HTMLElement | string | null;

    // ── public API ────────────────────────────────────────────────────────────

    /** Get all current files. */
    get files(): FileState[] {
        this.flush();
        return this.#dropzone?.getFiles() || [];
    }

    /** Add files programmatically. */
    addFiles(files: FileList | File[]): Promise<void> {
        this.flush();
        return this.#dropzone?.addFiles(files) ?? Promise.resolve();
    }

    /** Remove a file by ID. Skips the removal gate unless `opts.confirm` is set. */
    removeFile(id: string, opts?: { confirm?: boolean }): Promise<void> {
        this.flush();
        return this.#dropzone?.removeFile(id, opts) ?? Promise.resolve();
    }

    /** Clear all files. Same gate semantics as `removeFile`. */
    clear(opts?: { confirm?: boolean }): Promise<void> {
        this.flush();
        return this.#dropzone?.clear(opts) ?? Promise.resolve();
    }

    /** Update file progress (for upload tracking). */
    updateFileProgress(id: string, progress: number): void {
        this.flush();
        this.#dropzone?.updateFileProgress(id, progress);
    }

    /** Set file status (pending, uploading, complete, error). */
    setFileStatus(id: string, status: FileState['status'], error?: string): void {
        this.flush();
        this.#dropzone?.setFileStatus(id, status, error);
    }

    /** Get a file by ID. */
    getFile(id: string): FileState | undefined {
        this.flush();
        return this.#dropzone?.getFile(id);
    }

    // ── upload pipeline — only meaningful when uploadFileCallback is set ───────

    /** Drain the queue of pending files through the worker pool. */
    uploadAll(): Promise<void> {
        this.flush();
        return this.#dropzone?.uploadAll() ?? Promise.resolve();
    }

    /** Upload a single file immediately, bypassing the queue. */
    uploadFile(id: string): Promise<void> {
        this.flush();
        return this.#dropzone?.uploadFile(id) ?? Promise.resolve();
    }

    /** Pause an in-flight upload. */
    pauseFile(id: string): void { this.flush(); this.#dropzone?.pauseFile(id); }

    /** Resume a paused file and re-queue it. */
    resumeFile(id: string): Promise<void> {
        this.flush();
        return this.#dropzone?.resumeFile(id) ?? Promise.resolve();
    }

    /** Cancel an in-flight upload. */
    cancelFile(id: string): void { this.flush(); this.#dropzone?.cancelFile(id); }

    /** Pause every uploading / pending file. */
    pauseAll(): void { this.flush(); this.#dropzone?.pauseAll(); }

    /** Resume every paused file. */
    resumeAll(): Promise<void> {
        this.flush();
        return this.#dropzone?.resumeAll() ?? Promise.resolve();
    }

    /** Retry every errored / cancelled file. */
    retryAll(): void { this.flush(); this.#dropzone?.retryAll(); }

    /** Retry a single file. */
    retryFile(id: string): void { this.flush(); this.#dropzone?.retryFile(id); }

    /** Destroy the component. */
    destroy(): void {
        this.#dropzone?.destroy();
        this.#dropzone = undefined;
    }
}

// Auto-register the custom element (browser only)
if (typeof window !== 'undefined' && typeof customElements !== 'undefined') {
    if (!customElements.get('web-dropzone')) {
        customElements.define('web-dropzone', DropzoneElement);
    }
}

// NOTE: do NOT statically `import './web-component-picker'` etc. from here.
// Satellite registration order is owned by index.ts, which registers
// satellites BEFORE this module so that the synchronous upgrade of
// `<web-dropzone>` elements (triggered by the define call above) can construct
// satellite instances that already have their `bindToStore` method. The reverse
// race (satellites parsed in HTML upgrade before the store) is handled by
// `whenStoreReady` — satellites tolerate an un-upgraded store and wait for
// `store-ready`.
