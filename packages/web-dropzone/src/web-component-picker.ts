/**
 * `<web-dropzone-picker for="<store-id>">` — satellite renderer.
 *
 * The picker is a file selector (card / button / minimal appearance) that
 * pushes files into a separate `<web-dropzone>` store via `addFiles`. It
 * never stores files itself; it only collects them from user interaction
 * (drag-drop, click → native file dialog) and routes them.
 *
 * Mode B per-picker upload binding (see ARCHITECTURE.md): if the picker has
 * `uploadCallback` and/or `uploadMetadata` JS properties set, those are
 * stamped onto every FileState the picker contributes. The store's upload
 * loop then uses each file's stamped handler instead of the store-level
 * one — so two pickers bound to the same store can route to different
 * endpoints / buckets / tenants while sharing a single queue + list.
 */

import styles from './css/main.css?inline';
import {
    SatelliteElement,
    subscribeStoreEvents,
    resolveEnumAttribute
} from './satellite-base';
import { escapeHtml, UI_ICONS } from '@keenmate/web-dropzone-core';
import type { DropzoneStoreAPI } from '@keenmate/web-dropzone-core';
import type { DropzoneElement } from './web-component';
import type {
    SelectorAppearance,
    CardSize,
    FileUploadHandler
} from '@keenmate/web-dropzone-core';

const SELECTOR_APPEARANCES = ['card', 'button', 'minimal', 'native'] as const;
const CARD_SIZES = ['minimal', 'compact', 'big'] as const;

const DEFAULT_ICON = UI_ICONS.cloudUpload;
const DEFAULT_PROMPT = 'Drop files here or click to browse';
const DEFAULT_DRAG_ACTIVE = 'Drop files here';
const DEFAULT_SELECT_TEXT = 'Select files';
const DEFAULT_NO_FILE_TEXT = 'No file chosen';

export class DropzonePickerElement extends SatelliteElement {
    protected readonly satelliteTagName = 'web-dropzone-picker';
    private shadow: ShadowRoot;
    private container: HTMLElement;
    private inputEl: HTMLInputElement | null = null;
    private dragActive = false;
    private dragCounter = 0;

    // Mode B per-picker upload binding (see ARCHITECTURE.md). These are
    // JS-only properties — there's no HTML attribute equivalent because the
    // value is a function (uploadCallback) or an arbitrary object
    // (uploadMetadata). The store stamps both onto every contributed
    // FileState at add-time.
    private _uploadCallback: FileUploadHandler | null = null;
    private _uploadMetadata: Record<string, unknown> | null = null;

    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });

        // Reuse the store's CSS so picker chrome (`dz__dropzone--card`,
        // `dz__button`, `dz__minimal`) renders identically across both
        // the convenience-form picker (inside <web-dropzone>) and the
        // satellite. Cheap — same stylesheet object cached by the bundler.
        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        this.shadow.appendChild(styleSheet);

        this.container = document.createElement('div');
        this.container.className = 'dz__host';
        this.shadow.appendChild(this.container);

        // Pre-upgrade rescue for the two JS-only props.
        this.upgradeProperty('uploadCallback');
        this.upgradeProperty('uploadMetadata');
    }

    private upgradeProperty(prop: string): void {
        if (Object.prototype.hasOwnProperty.call(this, prop)) {
            const value = (this as any)[prop];
            delete (this as any)[prop];
            (this as any)[prop] = value;
        }
    }

    get uploadCallback(): FileUploadHandler | null {
        return this._uploadCallback;
    }
    set uploadCallback(value: FileUploadHandler | null) {
        this._uploadCallback = value;
    }

    get uploadMetadata(): Record<string, unknown> | null {
        return this._uploadMetadata;
    }
    set uploadMetadata(value: Record<string, unknown> | null) {
        this._uploadMetadata = value;
    }

    static get observedAttributes(): string[] {
        return [
            'for', 'selector-appearance', 'card-size', 'accept', 'multiple',
            'label', 'icon', 'hint', 'disabled', 'inside', 'no-file-chosen-text'
        ];
    }

    attributeChangedCallback(): void {
        // Cheap: re-render on any observed change. Picker DOM is small and
        // re-built on connect anyway; the store-level rendering it would
        // race against doesn't exist here.
        if (this.store) this.render();
    }

    /**
     * Subscribe to store events that affect the picker's surface — file
     * count changes drive the count badge on the button / minimal variants,
     * so we need to re-render when the underlying selection changes.
     * Card variant doesn't show a badge but still re-renders cheaply
     * (small DOM, debouncing isn't worth the complexity here).
     */
    protected attachStoreSubscriptions(storeEl: DropzoneElement): () => void {
        return subscribeStoreEvents(storeEl, {
            'file-added':   () => this.render(),
            'file-removed': () => this.render(),
            'change':       () => this.render(),
            // Config re-render (e.g. accept / multiple / disabled changed).
            'dz-config-changed': () => this.render()
        });
    }

    protected onStoreReady(): void {
        this.render();
        this.wireDragResetSafetyNet();
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        document.removeEventListener('drop', this.handleDocReset);
        document.removeEventListener('dragend', this.handleDocReset);
        this.dragActive = false;
        this.dragCounter = 0;
    }

    // ========================================================================
    // RENDERING
    // ========================================================================

    private render(): void {
        if (!this.store) return;

        const appearance = this.resolveSelectorAppearance();
        const cardSize = this.resolveCardSize();
        const disabled = this.isDisabled();
        const storeCfg = this.store.getConfig();

        const acceptAttr = this.getAttribute('accept') ?? storeCfg.accept ?? '';
        const multipleAttr = this.resolveMultiple(storeCfg.isMultipleEnabled);
        const label = this.getAttribute('label')
            ?? storeCfg.selectFilesText
            ?? DEFAULT_SELECT_TEXT;
        const icon = this.getAttribute('icon') ?? storeCfg.icon ?? DEFAULT_ICON;
        const hint = this.getAttribute('hint') ?? storeCfg.hintText ?? '';

        const inputHtml = `
            <input type="file"
                class="dz__dropzone__input"
                ${multipleAttr ? 'multiple' : ''}
                ${acceptAttr ? `accept="${escapeHtml(acceptAttr)}"` : ''}
                ${disabled ? 'disabled' : ''}
            >
        `;

        // File count drives the button / minimal count badge — mirrors the
        // legacy in-class renderer so the convenience form (which mounts
        // this satellite internally) keeps its count chip on those selectors.
        const fileCount = this.store.getFiles().length;
        const countBadge = fileCount > 0
            ? `<span class="dz__button__badge">${fileCount}</span>`
            : '';
        const minimalBadge = fileCount > 0
            ? `<span class="dz__minimal__badge">${fileCount}</span>`
            : '';

        let inner = '';
        if (appearance === 'button') {
            inner = `
                <div class="dz__dropzone dz__dropzone--button ${disabled ? 'dz__dropzone--disabled' : ''}">
                    ${inputHtml}
                    <button type="button" class="dz__button" ${disabled ? 'disabled' : ''}>
                        <span class="dz__button__label">${escapeHtml(label)}</span>
                        ${countBadge}
                    </button>
                </div>
            `;
        } else if (appearance === 'minimal') {
            const ariaLabel = this.getAttribute('label') ?? storeCfg.promptText ?? DEFAULT_PROMPT;
            inner = `
                <div class="dz__dropzone dz__dropzone--minimal ${disabled ? 'dz__dropzone--disabled' : ''}">
                    ${inputHtml}
                    <button type="button" class="dz__minimal" aria-label="${escapeHtml(ariaLabel)}" ${disabled ? 'disabled' : ''}>
                        <span class="dz__minimal__icon">${icon}</span>
                        ${minimalBadge}
                    </button>
                </div>
            `;
        } else if (appearance === 'native') {
            const noFileText = this.getAttribute('no-file-chosen-text')
                ?? storeCfg.noFileChosenText
                ?? DEFAULT_NO_FILE_TEXT;
            const files = this.store.getFiles();
            const labelText = files.length === 0
                ? noFileText
                : files.length === 1
                    ? files[0].name
                    : `${files.length} files chosen`;
            inner = `
                <div class="dz__dropzone dz__dropzone--native ${disabled ? 'dz__dropzone--disabled' : ''}">
                    ${inputHtml}
                    <button type="button" class="dz__native__button" ${disabled ? 'disabled' : ''}>${escapeHtml(label)}</button>
                    <span class="dz__native__label" title="${escapeHtml(labelText)}">${escapeHtml(labelText)}</span>
                </div>
            `;
        } else {
            // card
            const text = this.dragActive
                ? (storeCfg.dragActiveText ?? DEFAULT_DRAG_ACTIVE)
                : (this.getAttribute('label') ?? storeCfg.promptText ?? DEFAULT_PROMPT);
            const hintHtml = hint
                ? `<div class="dz__dropzone__hint">${escapeHtml(hint)}</div>`
                : '';
            const browseBtn = cardSize === 'big'
                ? `<button type="button" class="dz__card__action">${escapeHtml(label)}</button>`
                : '';
            // `inside="true"` enables the files-inside layout — the file
            // list satellite slots into the card via the `<slot>` below,
            // and `dz__dropzone--has-files` flips on so the picker's
            // existing CSS (margin between prompt and list) kicks in.
            const insideMode = this.getAttribute('inside') === 'true';
            const hasFiles = insideMode && fileCount > 0;
            const classes = [
                'dz__dropzone',
                'dz__dropzone--card',
                `dz__dropzone--card-${cardSize}`,
                disabled ? 'dz__dropzone--disabled' : '',
                this.dragActive ? 'dz__dropzone--active' : '',
                insideMode ? 'dz__dropzone--files-inside' : '',
                hasFiles ? 'dz__dropzone--has-files' : ''
            ].filter(Boolean).join(' ');
            const slotHtml = insideMode ? '<slot></slot>' : '';
            inner = `
                <div class="${classes}">
                    ${inputHtml}
                    <div class="dz__dropzone__content">
                        <div class="dz__dropzone__icon">${icon}</div>
                        <div class="dz__dropzone__text">${escapeHtml(text)}</div>
                        ${browseBtn}
                        ${hintHtml}
                    </div>
                    ${slotHtml}
                </div>
            `;
        }

        this.container.innerHTML = inner;
        this.inputEl = this.container.querySelector('input.dz__dropzone__input');
        this.attachInteractionHandlers();
    }

    // ========================================================================
    // ATTRIBUTE RESOLUTION
    // ========================================================================

    private resolveSelectorAppearance(): SelectorAppearance {
        return resolveEnumAttribute(this, 'selector-appearance', SELECTOR_APPEARANCES, 'card');
    }

    private resolveCardSize(): CardSize {
        return resolveEnumAttribute(this, 'card-size', CARD_SIZES, 'compact');
    }

    private resolveMultiple(storeDefault: boolean | undefined): boolean {
        const raw = this.getAttribute('multiple');
        if (raw === null) return storeDefault ?? true;
        return raw !== 'false';
    }

    private isDisabled(): boolean {
        if (this.hasAttribute('disabled')) {
            return this.getAttribute('disabled') !== 'false';
        }
        return !!this.store?.getConfig().isDisabled;
    }

    // ========================================================================
    // INTERACTION
    // ========================================================================

    private attachInteractionHandlers(): void {
        const dropZone = this.container.querySelector('.dz__dropzone') as HTMLElement | null;
        if (!dropZone) return;

        // File picker dialog opens for any click in the drop zone. Stop the
        // `input.change` from bubbling into the same handler twice — we
        // listen to it explicitly below.
        dropZone.addEventListener('click', (e) => {
            if (this.isDisabled()) return;
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT') return;
            this.inputEl?.click();
        });

        if (this.inputEl) {
            this.inputEl.addEventListener('change', () => {
                const files = this.inputEl?.files;
                if (files && files.length > 0) {
                    this.contributeFiles(Array.from(files));
                }
                // Reset the input so the same file can be picked again.
                if (this.inputEl) this.inputEl.value = '';
            });
        }

        // Drag/drop on the picker itself. The card surface visualizes
        // `dragActive`; button + minimal accept drops but don't show the
        // overlay (the existing `--active` modifier is card-only by design).
        dropZone.addEventListener('dragover', (e) => {
            if (this.isDisabled()) return;
            e.preventDefault();
            e.stopPropagation();
        });
        // The card highlight is scoped to THIS picker's surface via an
        // enter/leave depth counter (children fire their own enter/leave, so a
        // plain boolean would flicker). Previously the highlight was driven by
        // document-level drag events, which lit up EVERY picker on the page at
        // once — dragging over one bucket highlighted all of them.
        dropZone.addEventListener('dragenter', (e) => {
            if (this.isDisabled()) return;
            e.preventDefault();
            e.stopPropagation();
            if (!e.dataTransfer?.types.includes('Files')) return;
            this.dragCounter++;
            this.setDragActive(true);
        });
        dropZone.addEventListener('dragleave', (e) => {
            if (this.isDisabled()) return;
            e.stopPropagation();
            this.dragCounter = Math.max(0, this.dragCounter - 1);
            if (this.dragCounter === 0) this.setDragActive(false);
        });
        dropZone.addEventListener('drop', (e) => {
            if (this.isDisabled()) return;
            e.preventDefault();
            e.stopPropagation();
            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                this.contributeFiles(Array.from(files));
            }
            this.setDragActive(false);
            this.dragCounter = 0;
        });
    }

    /**
     * Safety net for the per-picker highlight: a drag that ends or is dropped
     * OUTSIDE this picker won't always fire our element-level `dragleave`
     * (browsers are inconsistent when the drag terminates off-target), so reset
     * defensively on any document-level drop / dragend. This does NOT activate
     * the highlight — that is scoped to the picker's own surface (see
     * `attachInteractionHandlers`); activating here is what used to light up
     * every picker on the page at once.
     */
    private wireDragResetSafetyNet(): void {
        document.addEventListener('drop', this.handleDocReset);
        document.addEventListener('dragend', this.handleDocReset);
    }

    private handleDocReset = (): void => {
        this.dragCounter = 0;
        this.setDragActive(false);
    };

    private setDragActive(active: boolean): void {
        if (this.dragActive === active) return;
        this.dragActive = active;
        // Only the card variant visualizes drag state (button / minimal don't).
        if (this.resolveSelectorAppearance() !== 'card') return;
        // Update the live DOM in place rather than re-rendering: rebuilding the
        // drop target mid-drag destroys the element the pointer is over, which
        // breaks the drag sequence and the enter/leave counter.
        const dz = this.container.querySelector('.dz__dropzone--card') as HTMLElement | null;
        if (!dz) { this.render(); return; }
        dz.classList.toggle('dz__dropzone--active', active);
        const textEl = dz.querySelector('.dz__dropzone__text');
        if (textEl) {
            const storeCfg = this.store?.getConfig() ?? {};
            textEl.textContent = active
                ? (storeCfg.dragActiveText ?? DEFAULT_DRAG_ACTIVE)
                : (this.getAttribute('label') ?? storeCfg.promptText ?? DEFAULT_PROMPT);
        }
    }

    /**
     * Push collected files into the bound store, stamping per-picker Mode B
     * routing (uploadCallback / uploadMetadata) if either was set on this
     * element. The store applies its own validation, dedupe, and caps —
     * the picker never rejects files itself.
     */
    private contributeFiles(files: File[]): void {
        if (!this.store) return;
        const opts: { uploadCallback?: FileUploadHandler; uploadMetadata?: Record<string, unknown> } = {};
        if (this._uploadCallback) opts.uploadCallback = this._uploadCallback;
        if (this._uploadMetadata) opts.uploadMetadata = this._uploadMetadata;
        this.store.addFiles(files, opts);
    }
}

if (typeof customElements !== 'undefined' && !customElements.get('web-dropzone-picker')) {
    customElements.define('web-dropzone-picker', DropzonePickerElement);
}
