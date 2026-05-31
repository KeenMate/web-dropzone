/**
 * `<web-dropzone-list for="<store-id>">` — satellite renderer.
 *
 * A read-mostly view of a store's `FileState[]`, rendered in one of several
 * appearances (list / detailed / grid / badges). Subscribes to the store's
 * substrate events (file-added, file-removed, file-progress,
 * file-status-changed, change) so it stays in sync without polling. Action
 * buttons (remove, pause, resume, cancel, retry) call back through to the
 * store's public API.
 *
 * The satellite never owns file state. The store is authoritative; the
 * satellite is a projection. See ARCHITECTURE.md.
 */

import styles from './css/main.css?inline';
import {
    resolveStoreElement,
    whenStoreReady,
    subscribeStoreEvents
} from './satellite-base';
import { isImageFile, createImagePreview } from './dropzone';
import {
    STATUS_ICONS,
    STATUS_LABELS,
    ACTION_ICONS,
    ACTION_LABELS,
    actionForStatus
} from './icons';
import {
    renderListItem,
    renderDetailedItem,
    renderGridItem,
    renderBadgeItem
} from './row-templates';
import type { WebDropzone } from './dropzone';
import type { FileState, ListAppearance } from './types';

const BaseElement = (typeof HTMLElement !== 'undefined' ? HTMLElement : class {}) as typeof HTMLElement;

// Subset of ListAppearance this satellite implements. The remaining
// appearances (rolling, popover, none) are intentionally deferred — they
// require front-file animation / modal scaffolding that's better added once
// the simpler cases are proven.
const SUPPORTED_APPEARANCES: ReadonlyArray<ListAppearance> = [
    'list', 'detailed', 'grid', 'badges'
];

function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export class DropzoneListElement extends BaseElement {
    private shadow: ShadowRoot;
    private container: HTMLElement;
    private store: WebDropzone | null = null;
    private storeEl: HTMLElement | null = null;
    private cleanupStoreWait: (() => void) | null = null;
    private cleanupSubscriptions: (() => void) | null = null;
    /**
     * Coalesces structural re-render requests within the same microtask.
     * Adding N files at once dispatches N × file-added plus one change —
     * without coalescing we'd rebuild the list N+1 times (and destroy the
     * row a user might be mid-click on). With it: one rebuild per burst.
     */
    private renderScheduled = false;

    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        this.shadow.appendChild(styleSheet);
        this.container = document.createElement('div');
        this.container.className = 'dz__host dz__host--list-only';
        this.shadow.appendChild(this.container);
    }

    static get observedAttributes(): string[] {
        return ['for', 'list-appearance', 'empty-message'];
    }

    attributeChangedCallback(): void {
        if (this.store) this.renderAll();
    }

    connectedCallback(): void {
        const forId = this.getAttribute('for');
        this.storeEl = resolveStoreElement(forId);
        if (!this.storeEl) {
            // eslint-disable-next-line no-console
            console.warn(
                `<web-dropzone-list for="${forId ?? ''}"> — store not found. ` +
                `Make sure a <web-dropzone id="${forId ?? ''}"> exists on the page.`
            );
            return;
        }
        this.cleanupStoreWait = whenStoreReady(this.storeEl as any, (store) => {
            this.store = store;
            this.attachStoreSubscriptions();
            this.renderAll();
        });
    }

    disconnectedCallback(): void {
        if (this.cleanupStoreWait) {
            this.cleanupStoreWait();
            this.cleanupStoreWait = null;
        }
        if (this.cleanupSubscriptions) {
            this.cleanupSubscriptions();
            this.cleanupSubscriptions = null;
        }
        this.store = null;
        this.storeEl = null;
    }

    // ========================================================================
    // STORE SUBSCRIPTIONS
    // ========================================================================

    private attachStoreSubscriptions(): void {
        if (!this.storeEl) return;
        this.cleanupSubscriptions = subscribeStoreEvents(this.storeEl as any, {
            // add / remove / change → structural; coalesce burst events
            // (one re-render per microtask) so a bulk drop doesn't churn
            // DOM rows while the user is mid-click on an existing row.
            'file-added':   () => this.scheduleRenderAll(),
            'file-removed': () => this.scheduleRenderAll(),
            'change':       () => this.scheduleRenderAll(),
            // progress / status changes → patch the affected row in place
            // (rendering at 50ms ticks across 20 files would burn DOM otherwise).
            'file-progress': (e) => this.patchRow((e as CustomEvent).detail.id),
            'file-status-changed': (e) => this.patchRow((e as CustomEvent).detail.id)
        });
    }

    // ========================================================================
    // RENDERING
    // ========================================================================

    private resolveAppearance(): ListAppearance {
        const raw = this.getAttribute('list-appearance');
        return (SUPPORTED_APPEARANCES as readonly string[]).includes(raw ?? '')
            ? (raw as ListAppearance)
            : 'list';
    }

    private scheduleRenderAll(): void {
        if (this.renderScheduled) return;
        this.renderScheduled = true;
        queueMicrotask(() => {
            this.renderScheduled = false;
            this.renderAll();
        });
    }

    private renderAll(): void {
        if (!this.store) return;
        const files = this.store.getFiles();
        const appearance = this.resolveAppearance();

        if (files.length === 0) {
            const emptyMessage = this.getAttribute('empty-message')
                ?? this.store.getConfig().emptyMessage
                ?? 'No files selected';
            this.container.innerHTML = `<div class="dz__empty">${escapeHtml(emptyMessage)}</div>`;
            return;
        }

        // Mirrors the classic renderer's container class so the BEM
        // appearance-modifier rules in `_file-list.css` apply identically
        // (`.dz__file-list--grid` sets up `display: grid` etc.).
        const containerClass = `dz__file-list dz__file-list--${appearance}`;
        const rows = files.map(f => this.renderRow(f, appearance)).join('');
        this.container.innerHTML = `<div class="${containerClass}" data-list-appearance="${appearance}">${rows}</div>`;
        this.bindRowHandlers();
        this.attachPreviewLoaders(files);
    }

    private renderRow(file: FileState, appearance: ListAppearance): string {
        if (appearance === 'badges')   return renderBadgeItem(file);
        if (appearance === 'grid')     return renderGridItem(file);
        if (appearance === 'detailed') return renderDetailedItem(file);
        return renderListItem(file);
    }

    // ========================================================================
    // ROW EVENTS
    // ========================================================================

    private bindRowHandlers(): void {
        // Single delegated click handler — cheaper than wiring per-row,
        // and survives DOM patches without rebinding.
        this.container.addEventListener('click', this.handleListClick);
    }

    private handleListClick = (e: Event): void => {
        if (!this.store) return;
        const target = e.target as HTMLElement | null;
        if (!target) return;

        // Action button (pause / resume / retry). Slot is always in the DOM;
        // only react when `data-row-action` is set (i.e. not the hidden /
        // inert placeholder shape).
        const actionBtn = target.closest<HTMLElement>('[data-action="row-action"]');
        if (actionBtn) {
            const id = actionBtn.getAttribute('data-file-id');
            const action = actionBtn.getAttribute('data-row-action');
            if (!id || !action) return;
            if (action === 'pause')  this.store.pauseFile(id);
            if (action === 'resume') this.store.resumeFile(id);
            if (action === 'retry')  this.store.retryFile(id);
            return;
        }

        // Remove button (also always in the DOM).
        const removeBtn = target.closest<HTMLElement>('[data-action="remove"]');
        if (removeBtn) {
            const id = removeBtn.getAttribute('data-file-id');
            if (id) this.store.removeFile(id);
        }
    };

    // ========================================================================
    // ROW PATCHING — for progress / status ticks
    // ========================================================================

    private patchRow(id: string): void {
        if (!this.store) return;
        const file = this.store.getFile(id);
        if (!file) return;
        const row = this.container.querySelector<HTMLElement>(`[data-file-id="${id}"]`);
        if (!row) return;

        const appearance = this.resolveAppearance();
        if (appearance === 'badges') {
            // Badges have no progress bar — just status icon + dataset.
            if (row.dataset.status !== file.status) {
                row.dataset.status = file.status;
                row.className = `dz__badge dz__badge--${file.status}`;
            }
            const statusEl = row.querySelector<HTMLElement>('.dz__badge-status');
            if (statusEl && statusEl.dataset.status !== file.status) {
                statusEl.dataset.status = file.status;
                statusEl.className = `dz__badge-status dz__badge-status--${file.status}`;
                statusEl.setAttribute('title', STATUS_LABELS[file.status]);
                statusEl.innerHTML = STATUS_ICONS[file.status];
            }
            return;
        }

        // list / detailed / grid all have progress fill + status icon. The
        // primary action button transitions across states (uploading→pause,
        // paused→resume, error→retry, …) so we may need to swap its glyph
        // or add/remove it entirely.
        row.dataset.status = file.status;
        if (appearance === 'grid') {
            const fill = row.querySelector<HTMLElement>('.dz__preview-item__progress-fill');
            if (fill) fill.style.width = `${file.progress}%`;
            const statusEl = row.querySelector<HTMLElement>('.dz__preview-item__status');
            if (statusEl && statusEl.dataset.status !== file.status) {
                statusEl.dataset.status = file.status;
                statusEl.className = `dz__preview-item__status dz__preview-item__status--${file.status}`;
                statusEl.setAttribute('title', STATUS_LABELS[file.status]);
                statusEl.innerHTML = STATUS_ICONS[file.status];
            }
        } else {
            const fill = row.querySelector<HTMLElement>('.dz__file-item__progress-fill');
            if (fill) fill.style.width = `${file.progress}%`;
            const pct = row.querySelector<HTMLElement>('.dz__file-item__progress-text');
            if (pct) pct.textContent = `${file.progress.toFixed(1)}%`;
            const statusEl = row.querySelector<HTMLElement>('.dz__file-item__status');
            if (statusEl && statusEl.dataset.status !== file.status) {
                statusEl.dataset.status = file.status;
                statusEl.className = `dz__file-item__status dz__file-item__status--${file.status}`;
                statusEl.setAttribute('title', STATUS_LABELS[file.status]);
                statusEl.innerHTML = STATUS_ICONS[file.status];
            }
        }
        this.patchActionButton(row, file);
    }

    private patchActionButton(row: HTMLElement, file: FileState): void {
        // The action button is ALWAYS in the DOM (slot is reserved). We just
        // toggle the `--hidden` modifier + swap the glyph as state changes,
        // so column widths stay stable across uploading → paused → complete.
        const btn = row.querySelector<HTMLElement>('[data-action="row-action"]');
        if (!btn) return;

        const next = actionForStatus(file.status);
        const current = btn.dataset.rowAction || '';
        const target = next ?? '';
        if (current === target) return;

        const baseClass = row.classList.contains('dz__preview-item')
            ? 'dz__preview-item__action'
            : row.classList.contains('dz__badge')
                ? 'dz__badge-action'
                : 'dz__file-item__action';

        btn.dataset.rowAction = target;
        const hidden = !next;
        btn.className = hidden ? `${baseClass} ${baseClass}--hidden` : baseClass;
        btn.innerHTML = next ? ACTION_ICONS[next] : '';

        if (next) {
            btn.setAttribute('aria-label', `${ACTION_LABELS[next]} ${file.name}`);
            btn.title = ACTION_LABELS[next];
            btn.removeAttribute('tabindex');
            btn.removeAttribute('aria-hidden');
        } else {
            btn.setAttribute('aria-label', '');
            btn.title = '';
            btn.tabIndex = -1;
            btn.setAttribute('aria-hidden', 'true');
        }
    }

    // ========================================================================
    // IMAGE PREVIEW BACKFILL — for grid appearance
    // ========================================================================

    private attachPreviewLoaders(files: FileState[]): void {
        if (this.resolveAppearance() !== 'grid') return;
        // Generate previews for images that don't have one yet. The store
        // also does this in its own renderer, but since the satellite is
        // independent, we duplicate the work here so a satellite-only setup
        // (store has list-appearance="none") still gets thumbnails.
        for (const file of files) {
            if (file.previewUrl) continue;
            if (!isImageFile(file.file)) continue;
            createImagePreview(file.file).then(url => {
                file.previewUrl = url;
                const row = this.container.querySelector<HTMLElement>(`[data-file-id="${file.id}"]`);
                if (!row) return;
                const placeholder = row.querySelector('.dz__preview-item__placeholder');
                if (placeholder) {
                    const img = document.createElement('img');
                    img.className = 'dz__preview-item__image';
                    img.src = url;
                    img.alt = file.name;
                    placeholder.replaceWith(img);
                }
            }).catch(() => { /* swallow — preview is best-effort */ });
        }
    }
}

if (typeof customElements !== 'undefined' && !customElements.get('web-dropzone-list')) {
    customElements.define('web-dropzone-list', DropzoneListElement);
}
