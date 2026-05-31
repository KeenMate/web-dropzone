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
import {
    formatFileSize,
    getFileIcon,
    isImageFile,
    createImagePreview
} from './dropzone';
import {
    STATUS_ICONS,
    STATUS_LABELS,
    ACTION_ICONS,
    ACTION_LABELS,
    actionForStatus
} from './icons';
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

        const containerClass = appearance === 'grid'
            ? 'dz__file-list dz__preview-grid'
            : appearance === 'badges'
                ? 'dz__file-list dz__file-list--badges'
                : 'dz__file-list';
        const rows = files.map(f => this.renderRow(f, appearance)).join('');
        this.container.innerHTML = `<div class="${containerClass}" data-list-appearance="${appearance}">${rows}</div>`;
        this.bindRowHandlers();
        this.attachPreviewLoaders(files);
    }

    private renderRow(file: FileState, appearance: ListAppearance): string {
        if (appearance === 'badges')   return this.renderBadgeRow(file);
        if (appearance === 'grid')     return this.renderGridRow(file);
        if (appearance === 'detailed') return this.renderDetailedRow(file);
        return this.renderListRow(file);
    }

    private renderListRow(file: FileState): string {
        const action = actionForStatus(file.status);
        const actionBtn = action
            ? `<button type="button" class="dz__file-item__action" data-file-action="${action}" data-file-id="${file.id}" aria-label="${ACTION_LABELS[action]}">${ACTION_ICONS[action]}</button>`
            : '';
        return `
            <div class="dz__file-item dz__file-item--list" data-file-id="${file.id}" data-status="${file.status}">
                <div class="dz__file-item__icon">${getFileIcon(file.file)}</div>
                <div class="dz__file-item__main">
                    <div class="dz__file-item__name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
                    <div class="dz__file-item__meta">${formatFileSize(file.size)}</div>
                    <div class="dz__file-item__progress">
                        <div class="dz__file-item__progress-fill" style="width:${file.progress}%"></div>
                    </div>
                </div>
                <span class="dz__file-item__progress-text">${file.progress.toFixed(1)}%</span>
                <span class="dz__file-item__status dz__file-item__status--${file.status}" title="${STATUS_LABELS[file.status]}" data-status="${file.status}">${STATUS_ICONS[file.status]}</span>
                ${actionBtn}
                <button type="button" class="dz__file-item__remove" data-file-id="${file.id}" aria-label="Remove">×</button>
            </div>
        `;
    }

    private renderDetailedRow(file: FileState): string {
        // Same DOM shape as list — that's what makes patchInlineRowInPlace
        // share a code path in the convenience renderer too. The only
        // visual difference is `--detailed` styling.
        const action = actionForStatus(file.status);
        const actionBtn = action
            ? `<button type="button" class="dz__file-item__action" data-file-action="${action}" data-file-id="${file.id}" aria-label="${ACTION_LABELS[action]}">${ACTION_ICONS[action]}</button>`
            : '';
        return `
            <div class="dz__file-item dz__file-item--detailed" data-file-id="${file.id}" data-status="${file.status}">
                <div class="dz__file-item__icon">${getFileIcon(file.file)}</div>
                <div class="dz__file-item__main">
                    <div class="dz__file-item__name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
                    <div class="dz__file-item__meta">${formatFileSize(file.size)} · ${escapeHtml(file.type || 'unknown')}</div>
                    <div class="dz__file-item__progress">
                        <div class="dz__file-item__progress-fill" style="width:${file.progress}%"></div>
                    </div>
                </div>
                <span class="dz__file-item__progress-text">${file.progress.toFixed(1)}%</span>
                <span class="dz__file-item__status dz__file-item__status--${file.status}" title="${STATUS_LABELS[file.status]}" data-status="${file.status}">${STATUS_ICONS[file.status]}</span>
                ${actionBtn}
                <button type="button" class="dz__file-item__remove" data-file-id="${file.id}" aria-label="Remove">×</button>
            </div>
        `;
    }

    private renderGridRow(file: FileState): string {
        const isImage = isImageFile(file.file);
        const action = actionForStatus(file.status);
        const actionBtn = action
            ? `<button type="button" class="dz__preview-item__action" data-file-action="${action}" data-file-id="${file.id}" aria-label="${ACTION_LABELS[action]}">${ACTION_ICONS[action]}</button>`
            : '';
        const thumb = isImage
            ? (file.previewUrl
                ? `<img class="dz__preview-item__image" src="${file.previewUrl}" alt="${escapeHtml(file.name)}">`
                : `<div class="dz__preview-item__placeholder">${getFileIcon(file.file)}</div>`)
            : `<div class="dz__preview-item__placeholder">${getFileIcon(file.file)}</div>`;
        return `
            <div class="dz__preview-item ${isImage ? 'dz__preview-item--image' : ''}" data-file-id="${file.id}" data-status="${file.status}">
                ${thumb}
                <div class="dz__preview-item__overlay">
                    <div class="dz__preview-item__name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
                </div>
                <div class="dz__preview-item__progress">
                    <div class="dz__preview-item__progress-fill" style="width:${file.progress}%"></div>
                </div>
                <span class="dz__preview-item__status dz__preview-item__status--${file.status}" title="${STATUS_LABELS[file.status]}" data-status="${file.status}">${STATUS_ICONS[file.status]}</span>
                ${actionBtn}
                <button type="button" class="dz__preview-item__remove" data-file-id="${file.id}" aria-label="Remove">×</button>
            </div>
        `;
    }

    private renderBadgeRow(file: FileState): string {
        const statusClass = `dz__badge--${file.status}`;
        return `
            <span class="dz__badge ${statusClass}" data-file-id="${file.id}" data-status="${file.status}">
                <span class="dz__badge-icon">${getFileIcon(file.file)}</span>
                <span class="dz__badge-text">
                    <span class="dz__badge-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
                    <span class="dz__badge-status dz__badge-status--${file.status}" title="${STATUS_LABELS[file.status]}" data-status="${file.status}">${STATUS_ICONS[file.status]}</span>
                </span>
                <button type="button" class="dz__badge-remove" data-file-id="${file.id}" aria-label="Remove">×</button>
            </span>
        `;
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

        // Action button (pause / resume / retry)
        const actionBtn = target.closest<HTMLElement>('[data-file-action]');
        if (actionBtn) {
            const id = actionBtn.getAttribute('data-file-id');
            const action = actionBtn.getAttribute('data-file-action');
            if (!id || !action) return;
            if (action === 'pause')  this.store.pauseFile(id);
            if (action === 'resume') this.store.resumeFile(id);
            if (action === 'retry')  this.store.retryFile(id);
            return;
        }

        // Remove button
        const removeBtn = target.closest<HTMLElement>(
            '.dz__file-item__remove, .dz__preview-item__remove, .dz__badge-remove'
        );
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
        const next = actionForStatus(file.status);
        const existing = row.querySelector<HTMLElement>('[data-file-action]');
        if (!next && existing) {
            existing.remove();
            return;
        }
        if (next && !existing) {
            // Insert a new action button before the remove button so the
            // tab order stays sensible.
            const removeBtn = row.querySelector<HTMLElement>(
                '.dz__file-item__remove, .dz__preview-item__remove, .dz__badge-remove'
            );
            const cls = row.classList.contains('dz__preview-item')
                ? 'dz__preview-item__action'
                : 'dz__file-item__action';
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = cls;
            btn.setAttribute('data-file-action', next);
            btn.setAttribute('data-file-id', file.id);
            btn.setAttribute('aria-label', ACTION_LABELS[next]);
            btn.innerHTML = ACTION_ICONS[next];
            if (removeBtn) row.insertBefore(btn, removeBtn);
            else row.appendChild(btn);
            return;
        }
        if (next && existing && existing.getAttribute('data-file-action') !== next) {
            existing.setAttribute('data-file-action', next);
            existing.setAttribute('aria-label', ACTION_LABELS[next]);
            existing.innerHTML = ACTION_ICONS[next];
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
