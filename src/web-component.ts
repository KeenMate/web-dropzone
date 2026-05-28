/**
 * DropzoneElement - Custom element wrapper for WebDropzone
 *
 * Provides a web component interface with Shadow DOM encapsulation,
 * attribute observation via ATTRIBUTE_TABLE, form-association via
 * ElementInternals, and event dispatching.
 */

import { WebDropzone } from './dropzone';
import { initLogger } from './logger';
import type {
    DropzoneConfig,
    DisplayMode,
    SelectorAppearance,
    ListAppearance,
    CardSize,
    ValueFormat,
    FileState
} from './types';

// Import CSS as inline string for Shadow DOM injection
import styles from './css/main.css?inline';

// Type declarations for build-time constants
declare const __VERSION__: string;

// SSR compatibility: provide stub HTMLElement if not in browser
const BaseElement = (typeof HTMLElement !== 'undefined' ? HTMLElement : class {}) as typeof HTMLElement;

// ============================================================================
// ATTRIBUTE TABLE — single source of truth for HTML attribute → config option
// ============================================================================
// Drives:
//   - static get observedAttributes()
//   - initial parsing in parseAttributesFromTable()
//   - attributeChangedCallback (to compute the partial config update)
//
// Boolean parser semantics:
//   - 'bool-default-true':  attribute absent → true. Only the literal string
//                           'false' makes it false. Present-but-empty = true.
//   - 'bool-default-false': attribute absent → false. Present (any value
//                           including '') makes it true, unless the value is
//                           the literal 'false'. Matches HTML's standard
//                           "boolean attribute" convention (e.g. <input disabled>).

type AttrParser =
    | 'string'
    | 'string-or-undefined'
    | 'enum'
    | 'int'
    | 'bool-default-true'
    | 'bool-default-false'
    // Missing → undefined (so the component can decide an "auto" default per
    // mode rather than committing to a global true/false at parse time).
    // Present → true unless the value is the literal 'false'.
    | 'bool-optional';

interface AttrSpec {
    /** External (kebab-case) attribute name */
    attr: string;
    /** Internal DropzoneConfig key */
    key: keyof DropzoneConfig;
    parser: AttrParser;
    /** Used when attribute is missing/empty/unparseable. */
    default?: any;
    /** Allowed values for 'enum' parser. */
    enumValues?: readonly string[];
}

const PLACEMENTS = [
    'top', 'top-start', 'top-end',
    'bottom', 'bottom-start', 'bottom-end',
    'left', 'left-start', 'left-end',
    'right', 'right-start', 'right-end'
] as const;

const ATTRIBUTE_TABLE: ReadonlyArray<AttrSpec> = [
    // Core
    { attr: 'accept',              key: 'accept',                parser: 'string-or-undefined' },
    { attr: 'multiple',            key: 'isMultipleEnabled',     parser: 'bool-default-true' },
    { attr: 'max-file-size',       key: 'maxFileSize',           parser: 'int', default: 0 },
    { attr: 'min-file-size',       key: 'minFileSize',           parser: 'int', default: 0 },
    { attr: 'max-total-size',      key: 'maxTotalSize',          parser: 'int', default: 0 },
    { attr: 'max-file-count',      key: 'maxFileCount',          parser: 'int', default: 0 },
    { attr: 'min-file-count',      key: 'minFileCount',          parser: 'int', default: 0 },
    { attr: 'max-visible-files',   key: 'maxVisibleFiles',       parser: 'int', default: 7 },
    { attr: 'dedupe-mode',         key: 'dedupeMode',            parser: 'enum',
      enumValues: ['name', 'name-size', 'none'], default: 'name' },
    { attr: 'disabled',            key: 'isDisabled',            parser: 'bool-default-false' },

    // Display — single-axis shorthand (defaults to 'list' when nothing else is set)
    { attr: 'display-mode',        key: 'displayMode',           parser: 'enum',
      enumValues: ['list', 'detailed', 'grid', 'compact'], default: 'list' },

    // Display — orthogonal axes (override the shorthand when set explicitly)
    { attr: 'selector-appearance', key: 'selectorAppearance',    parser: 'enum',
      enumValues: ['card', 'button', 'minimal'] },
    { attr: 'list-appearance',     key: 'listAppearance',        parser: 'enum',
      enumValues: ['list', 'detailed', 'grid', 'badges', 'popover', 'none'] },
    { attr: 'card-size',           key: 'cardSize',              parser: 'enum',
      enumValues: ['minimal', 'compact', 'big'] },

    // Missing → undefined; the renderer resolves to "auto" (on for grid, off
    // otherwise). Set explicitly to opt in/out for any list-appearance.
    { attr: 'show-thumbnails',     key: 'isShowThumbnailsEnabled', parser: 'bool-optional' },

    { attr: 'files-inside',        key: 'isFilesInsideEnabled',  parser: 'bool-default-false' },
    { attr: 'icon',                key: 'icon',                  parser: 'string-or-undefined' },
    { attr: 'prompt-text',         key: 'promptText',            parser: 'string-or-undefined' },
    { attr: 'select-files-text',   key: 'selectFilesText',       parser: 'string-or-undefined' },
    { attr: 'hint-text',           key: 'hintText',              parser: 'string-or-undefined' },
    { attr: 'drag-active-text',    key: 'dragActiveText',        parser: 'string-or-undefined' },
    { attr: 'empty-message',       key: 'emptyMessage',          parser: 'string-or-undefined' },

    // Compact mode
    { attr: 'summary-template',    key: 'summaryTemplate',       parser: 'string-or-undefined' },
    { attr: 'popover-placement',   key: 'popoverPlacement',      parser: 'enum',
      enumValues: PLACEMENTS, default: 'bottom-start' },

    // Drag overlay
    { attr: 'overlay-target',      key: 'overlayTarget',         parser: 'string-or-undefined' },
    { attr: 'overlay-text',        key: 'overlayText',           parser: 'string-or-undefined' },
    { attr: 'overlay-icon',        key: 'overlayIcon',           parser: 'string-or-undefined' },

    // Form integration
    { attr: 'name',                key: 'name',                  parser: 'string-or-undefined' },
    { attr: 'value-format',        key: 'valueFormat',           parser: 'enum',
      enumValues: ['json', 'csv', 'array'], default: 'json' }
];

const ATTRIBUTE_TABLE_BY_ATTR = new Map(ATTRIBUTE_TABLE.map(s => [s.attr, s]));

/** Parse a single attribute value through its spec. Used by both initial parse and live updates. */
function parseAttrValue(spec: AttrSpec, raw: string | null): any {
    // Missing attribute → fall back to the default-or-typed-zero for the parser.
    if (raw === null) {
        switch (spec.parser) {
            case 'bool-default-true': return true;
            case 'bool-default-false': return false;
            case 'bool-optional': return undefined;
            default: return spec.default;
        }
    }
    switch (spec.parser) {
        case 'string':
        case 'string-or-undefined':
            // Empty string is treated as "attribute reset" → fall back to default.
            return raw === '' ? spec.default : raw;
        case 'enum':
            return spec.enumValues!.includes(raw) ? raw : spec.default;
        case 'int': {
            const n = parseInt(raw, 10);
            return isNaN(n) ? spec.default : n;
        }
        // For all boolean variants: only the literal 'false' negates. Present
        // (including empty string from `<el disabled>`) means true. This matches
        // HTML's standard boolean-attribute behavior on native form controls.
        case 'bool-default-true':  return raw !== 'false';
        case 'bool-default-false': return raw !== 'false';
        case 'bool-optional':      return raw !== 'false';
    }
}

// Track instances for global API
const instances = new Set<DropzoneElement>();

export function getAllInstances(): DropzoneElement[] {
    return Array.from(instances);
}

/**
 * DropzoneElement - <web-dropzone> custom element
 */
export class DropzoneElement extends BaseElement {
    // Opt into the form-associated custom element lifecycle so the surrounding
    // <form> sees this element in form.elements, form.reset(), and FormData
    // submissions.
    static formAssociated = true;

    private dropzone?: WebDropzone;
    private container: HTMLElement | null = null;
    private shadow: ShadowRoot;
    private internals?: ElementInternals;
    private customStyleSheet?: HTMLStyleElement;

    // Callback properties (set via JavaScript only — no HTML attribute equivalent)
    private _validateCallback: DropzoneConfig['validateCallback'] = null;
    private _addCallback: DropzoneConfig['addCallback'] = null;
    private _removeCallback: DropzoneConfig['removeCallback'] = null;
    private _changeCallback: DropzoneConfig['changeCallback'] = null;
    private _rejectCallback: DropzoneConfig['rejectCallback'] = null;
    private _renderFileItemCallback: DropzoneConfig['renderFileItemCallback'] = null;
    private _renderPromptCallback: DropzoneConfig['renderPromptCallback'] = null;
    private _renderSummaryCallback: DropzoneConfig['renderSummaryCallback'] = null;
    private _customStylesCallback: DropzoneConfig['customStylesCallback'] = null;

    constructor() {
        super();

        // Shadow DOM + base stylesheet
        this.shadow = this.attachShadow({ mode: 'open' });
        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        this.shadow.appendChild(styleSheet);

        // attachInternals() is only available in form-associated elements; older
        // browsers (or jsdom) may lack it. Failing closed is better than throwing.
        if (typeof (this as any).attachInternals === 'function') {
            try {
                this.internals = (this as any).attachInternals();
            } catch {
                // jsdom or sandboxed environments may reject; ignore.
            }
        }

        // Container the core class renders into.
        this.container = document.createElement('div');
        this.container.className = 'dz__host';
        this.shadow.appendChild(this.container);
    }

    // ========================================================================
    // LIFECYCLE
    // ========================================================================

    connectedCallback(): void {
        instances.add(this);
        this.initializeDropzone();

        // FOUC prevention — once initialized, expose [data-ready] so authors
        // can target post-init styling without flashing default browser UA.
        requestAnimationFrame(() => {
            this.setAttribute('data-ready', '');
        });

        initLogger.debug('DropzoneElement connected');
    }

    disconnectedCallback(): void {
        instances.delete(this);
        this.dropzone?.destroy();
        this.dropzone = undefined;
        initLogger.debug('DropzoneElement disconnected');
    }

    /**
     * Called by the browser when the surrounding <form> is reset. Clears the
     * dropzone selection so the component actually participates in the standard
     * reset lifecycle.
     */
    formResetCallback() {
        this.dropzone?.clear();
    }

    static get observedAttributes(): string[] {
        return ATTRIBUTE_TABLE.map(s => s.attr);
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        if (oldValue === newValue) return;
        if (!this.dropzone) return; // Pre-init: connectedCallback's parse will pick it up.

        const spec = ATTRIBUTE_TABLE_BY_ATTR.get(name);
        if (!spec) return;

        const value = parseAttrValue(spec, newValue);
        const partial = { [spec.key]: value } as Partial<DropzoneConfig>;
        this.dropzone.updateConfig(partial);

        // Form-relevant changes need to re-stamp the FormData.
        if (spec.key === 'name' || spec.key === 'valueFormat') {
            this.syncFormValue();
        }

        // minFileCount changes only the validity calculation — re-sync without
        // rebuilding FormData.
        if (spec.key === 'minFileCount') {
            this.syncValidity(this.dropzone.getFiles().length);
        }
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /** Parse all observed attributes via ATTRIBUTE_TABLE into a partial config. */
    private parseAttributesFromTable(): Partial<DropzoneConfig> {
        const out: Partial<DropzoneConfig> = {};
        for (const spec of ATTRIBUTE_TABLE) {
            const value = parseAttrValue(spec, this.getAttribute(spec.attr));
            if (value !== undefined) (out as any)[spec.key] = value;
        }
        return out;
    }

    private buildConfig(): DropzoneConfig {
        return {
            ...this.parseAttributesFromTable(),

            // Callbacks (programmatic only — no HTML attribute equivalent)
            validateCallback: this._validateCallback,
            addCallback: this._addCallback,
            removeCallback: (file) => {
                this._removeCallback?.(file);
                this.syncFormValue();
            },
            changeCallback: (files) => {
                this._changeCallback?.(files);
                this.syncFormValue();
            },
            rejectCallback: this._rejectCallback,
            renderFileItemCallback: this._renderFileItemCallback,
            renderPromptCallback: this._renderPromptCallback,
            renderSummaryCallback: this._renderSummaryCallback,
            customStylesCallback: this._customStylesCallback,

            // Shadow DOM container for popover anchoring + form-element host
            container: this.container!,
            hostElement: this
        };
    }

    private initializeDropzone(): void {
        if (!this.container) return;

        if (this.dropzone) {
            this.dropzone.destroy();
        }

        const config = this.buildConfig();
        this.injectCustomStyles();

        this.dropzone = new WebDropzone(this.container, config);
        this.syncFormValue();

        initLogger.debug('Dropzone initialized', { config });
    }

    /**
     * Inject styles from customStylesCallback into the shadow root. The
     * stylesheet is *prepended* (inserted before the base stylesheet) so that
     * `@import` and `@font-face` rules — which must appear at the top of a
     * stylesheet — actually take effect. Replaces the previous custom-styles
     * element if one was already injected.
     */
    private injectCustomStyles(): void {
        if (this.customStyleSheet) {
            this.customStyleSheet.remove();
            this.customStyleSheet = undefined;
        }
        if (!this._customStylesCallback) return;

        const css = this._customStylesCallback();
        if (!css) return;

        const sheet = document.createElement('style');
        sheet.id = 'dz-custom-styles';
        sheet.textContent = css;
        // Insert at the beginning of the shadow root so @import / @font-face work.
        this.shadow.insertBefore(sheet, this.shadow.firstChild);
        this.customStyleSheet = sheet;
    }

    // ========================================================================
    // FORM VALUE
    // ========================================================================

    /**
     * Build a FormData containing every selected File under the configured
     * `name`, and hand it to `internals.setFormValue()`. This is what makes the
     * surrounding <form> submit real file blobs the same way `<input type="file">`
     * would. If `internals` is unavailable (older browser, jsdom), this is a no-op
     * and consumers can still read `this.files` programmatically.
     *
     * The `valueFormat` attribute (json/csv/array) is preserved as a state-only
     * hint for callers building their own non-multipart form payloads; it
     * doesn't affect what setFormValue submits because FormData with File
     * blobs is the canonical browser-compatible format for file inputs.
     */
    private syncFormValue(): void {
        if (!this.internals) return;
        const files = this.dropzone?.getFiles() ?? [];
        const name = this.getAttribute('name');

        if (!name || files.length === 0) {
            this.internals.setFormValue(null);
        } else {
            const formData = new FormData();
            for (const f of files) {
                formData.append(name, f.file, f.name);
            }
            this.internals.setFormValue(formData);
        }

        this.syncValidity(files.length);
    }

    /**
     * Reflect `minFileCount` into the form's native validity. When the
     * selection is short, the surrounding form's submit refuses with the
     * native validation message instead of silently submitting an incomplete
     * payload. Mirrors svelte-fluentui's `InputFile.minFiles` semantics — the
     * minimum is a form-validity signal, not an add-time rejection.
     */
    private syncValidity(fileCount: number): void {
        if (!this.internals) return;
        const min = this.dropzone?.getConfig().minFileCount ?? 0;
        if (min > 0 && fileCount < min) {
            this.internals.setValidity(
                { valueMissing: true },
                `At least ${min} file${min === 1 ? '' : 's'} required`
            );
        } else {
            this.internals.setValidity({});
        }
    }

    // ========================================================================
    // ATTRIBUTE PROPERTIES (HTML <-> JS reflection)
    // ========================================================================

    get accept(): string {
        return this.getAttribute('accept') || '';
    }
    set accept(value: string) {
        this.setAttribute('accept', value);
    }

    get multiple(): boolean {
        const attr = this.getAttribute('multiple');
        return attr !== 'false';
    }
    set multiple(value: boolean) {
        if (value) this.setAttribute('multiple', '');
        else this.setAttribute('multiple', 'false');
    }

    get maxFileSize(): number {
        const value = this.getAttribute('max-file-size');
        return value ? parseInt(value, 10) : 0;
    }
    set maxFileSize(value: number) {
        this.setAttribute('max-file-size', String(value));
    }

    get minFileSize(): number {
        const value = this.getAttribute('min-file-size');
        return value ? parseInt(value, 10) : 0;
    }
    set minFileSize(value: number) {
        this.setAttribute('min-file-size', String(value));
    }

    get maxTotalSize(): number {
        const value = this.getAttribute('max-total-size');
        return value ? parseInt(value, 10) : 0;
    }
    set maxTotalSize(value: number) {
        this.setAttribute('max-total-size', String(value));
    }

    get maxFileCount(): number {
        const value = this.getAttribute('max-file-count');
        return value ? parseInt(value, 10) : 0;
    }
    set maxFileCount(value: number) {
        this.setAttribute('max-file-count', String(value));
    }

    get minFileCount(): number {
        const value = this.getAttribute('min-file-count');
        return value ? parseInt(value, 10) : 0;
    }
    set minFileCount(value: number) {
        this.setAttribute('min-file-count', String(value));
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled') && this.getAttribute('disabled') !== 'false';
    }
    set disabled(value: boolean) {
        if (value) this.setAttribute('disabled', '');
        else this.removeAttribute('disabled');
    }

    get displayMode(): DisplayMode {
        return (this.getAttribute('display-mode') as DisplayMode) || 'list';
    }
    set displayMode(value: DisplayMode) {
        this.setAttribute('display-mode', value);
    }

    get selectorAppearance(): SelectorAppearance | '' {
        return (this.getAttribute('selector-appearance') as SelectorAppearance) || '';
    }
    set selectorAppearance(value: SelectorAppearance | '') {
        if (value) this.setAttribute('selector-appearance', value);
        else this.removeAttribute('selector-appearance');
    }

    get listAppearance(): ListAppearance | '' {
        return (this.getAttribute('list-appearance') as ListAppearance) || '';
    }
    set listAppearance(value: ListAppearance | '') {
        if (value) this.setAttribute('list-appearance', value);
        else this.removeAttribute('list-appearance');
    }

    get cardSize(): CardSize | '' {
        return (this.getAttribute('card-size') as CardSize) || '';
    }
    set cardSize(value: CardSize | '') {
        if (value) this.setAttribute('card-size', value);
        else this.removeAttribute('card-size');
    }

    get selectFilesText(): string { return this.getAttribute('select-files-text') || ''; }
    set selectFilesText(value: string) { this.setAttribute('select-files-text', value); }

    /**
     * Three-state reflection so JS can read "unset / explicit on / explicit off".
     * Unset (returning undefined) means the renderer applies the auto default:
     * thumbnails for `list-appearance="grid"`, icons everywhere else.
     */
    get showThumbnails(): boolean | undefined {
        const raw = this.getAttribute('show-thumbnails');
        if (raw === null) return undefined;
        return raw !== 'false';
    }
    set showThumbnails(value: boolean | undefined) {
        if (value === undefined) this.removeAttribute('show-thumbnails');
        else this.setAttribute('show-thumbnails', value ? '' : 'false');
    }

    get filesInside(): boolean {
        return this.hasAttribute('files-inside') && this.getAttribute('files-inside') !== 'false';
    }
    set filesInside(value: boolean) {
        if (value) this.setAttribute('files-inside', '');
        else this.removeAttribute('files-inside');
    }

    get icon(): string { return this.getAttribute('icon') || ''; }
    set icon(value: string) { this.setAttribute('icon', value); }

    get promptText(): string { return this.getAttribute('prompt-text') || ''; }
    set promptText(value: string) { this.setAttribute('prompt-text', value); }

    get hintText(): string { return this.getAttribute('hint-text') || ''; }
    set hintText(value: string) { this.setAttribute('hint-text', value); }

    get dragActiveText(): string { return this.getAttribute('drag-active-text') || ''; }
    set dragActiveText(value: string) { this.setAttribute('drag-active-text', value); }

    get emptyMessage(): string { return this.getAttribute('empty-message') || ''; }
    set emptyMessage(value: string) { this.setAttribute('empty-message', value); }

    get summaryTemplate(): string { return this.getAttribute('summary-template') || ''; }
    set summaryTemplate(value: string) { this.setAttribute('summary-template', value); }

    get popoverPlacement(): string { return this.getAttribute('popover-placement') || 'bottom-start'; }
    set popoverPlacement(value: string) { this.setAttribute('popover-placement', value); }

    get overlayTarget(): string { return this.getAttribute('overlay-target') || ''; }
    set overlayTarget(value: string) { this.setAttribute('overlay-target', value); }

    get overlayText(): string { return this.getAttribute('overlay-text') || ''; }
    set overlayText(value: string) { this.setAttribute('overlay-text', value); }

    get overlayIcon(): string { return this.getAttribute('overlay-icon') || ''; }
    set overlayIcon(value: string) { this.setAttribute('overlay-icon', value); }

    get name(): string { return this.getAttribute('name') || ''; }
    set name(value: string) { this.setAttribute('name', value); }

    get valueFormat(): ValueFormat { return (this.getAttribute('value-format') as ValueFormat) || 'json'; }
    set valueFormat(value: ValueFormat) { this.setAttribute('value-format', value); }

    // ========================================================================
    // CALLBACK PROPERTIES
    // ========================================================================

    get validateCallback(): DropzoneConfig['validateCallback'] { return this._validateCallback; }
    set validateCallback(value: DropzoneConfig['validateCallback']) {
        this._validateCallback = value;
        this.dropzone?.updateConfig({ validateCallback: value });
    }

    get addCallback(): DropzoneConfig['addCallback'] { return this._addCallback; }
    set addCallback(value: DropzoneConfig['addCallback']) {
        this._addCallback = value;
        this.dropzone?.updateConfig({ addCallback: value });
    }

    get removeCallback(): DropzoneConfig['removeCallback'] { return this._removeCallback; }
    set removeCallback(value: DropzoneConfig['removeCallback']) {
        this._removeCallback = value;
        // Don't rebuild — buildConfig wraps the callback to also syncFormValue,
        // and the live dropzone already holds that wrapper. Updating the
        // backing field is enough; the wrapper reads from `this._removeCallback`
        // via closure on next invocation.
    }

    get changeCallback(): DropzoneConfig['changeCallback'] { return this._changeCallback; }
    set changeCallback(value: DropzoneConfig['changeCallback']) {
        this._changeCallback = value;
        // Same reasoning as removeCallback above.
    }

    get rejectCallback(): DropzoneConfig['rejectCallback'] { return this._rejectCallback; }
    set rejectCallback(value: DropzoneConfig['rejectCallback']) {
        this._rejectCallback = value;
        this.dropzone?.updateConfig({ rejectCallback: value });
    }

    get renderFileItemCallback(): DropzoneConfig['renderFileItemCallback'] { return this._renderFileItemCallback; }
    set renderFileItemCallback(value: DropzoneConfig['renderFileItemCallback']) {
        this._renderFileItemCallback = value;
        this.dropzone?.updateConfig({ renderFileItemCallback: value });
    }

    get renderPromptCallback(): DropzoneConfig['renderPromptCallback'] { return this._renderPromptCallback; }
    set renderPromptCallback(value: DropzoneConfig['renderPromptCallback']) {
        this._renderPromptCallback = value;
        this.dropzone?.updateConfig({ renderPromptCallback: value });
    }

    get renderSummaryCallback(): DropzoneConfig['renderSummaryCallback'] { return this._renderSummaryCallback; }
    set renderSummaryCallback(value: DropzoneConfig['renderSummaryCallback']) {
        this._renderSummaryCallback = value;
        this.dropzone?.updateConfig({ renderSummaryCallback: value });
    }

    get customStylesCallback(): DropzoneConfig['customStylesCallback'] { return this._customStylesCallback; }
    set customStylesCallback(value: DropzoneConfig['customStylesCallback']) {
        this._customStylesCallback = value;
        // Style injection is a shadow-root concern, not a config update.
        this.injectCustomStyles();
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    /** Get all current files */
    get files(): FileState[] {
        return this.dropzone?.getFiles() || [];
    }

    /** Add files programmatically */
    addFiles(files: FileList | File[]): void {
        this.dropzone?.addFiles(files);
        this.syncFormValue();
    }

    /** Remove a file by ID */
    removeFile(id: string): void {
        this.dropzone?.removeFile(id);
        // syncFormValue runs via the wrapped removeCallback in buildConfig.
    }

    /** Clear all files */
    clear(): void {
        this.dropzone?.clear();
        this.syncFormValue();
    }

    /** Update file progress (for upload tracking) */
    updateFileProgress(id: string, progress: number): void {
        this.dropzone?.updateFileProgress(id, progress);
    }

    /** Set file status (pending, uploading, complete, error) */
    setFileStatus(id: string, status: FileState['status'], error?: string): void {
        this.dropzone?.setFileStatus(id, status, error);
    }

    /** Get a file by ID */
    getFile(id: string): FileState | undefined {
        return this.dropzone?.getFile(id);
    }

    /** Destroy the component */
    destroy(): void {
        this.dropzone?.destroy();
        this.dropzone = undefined;
    }
}

// Auto-register the custom element (browser only)
if (typeof window !== 'undefined' && typeof customElements !== 'undefined') {
    if (!customElements.get('web-dropzone')) {
        customElements.define('web-dropzone', DropzoneElement);
    }
}

// Global API is registered in index.ts
