/**
 * `<web-dropzone-list for="<store-id>">` — satellite renderer.
 *
 * A read-mostly view of a store's `FileState[]`, rendered in one of several
 * appearances (list / detailed / grid / badges / rolling). Subscribes to
 * the store's substrate events (file-added, file-removed, file-progress,
 * file-status-changed, change) so it stays in sync without polling. Action
 * buttons (remove, pause, resume, cancel, retry) call back through to the
 * store's public API.
 *
 * Rolling appearance shows a single "front" file (highest-priority active
 * one — see `getFrontFile`) with rotation animations. A queue badge button
 * sits in the top-right corner; clicking it dispatches a `dz-queue-open`
 * CustomEvent (bubbles + composed) — popover wiring is up to the consumer.
 * The convenience form (`<web-dropzone>`) listens for this event and opens
 * its built-in popover; standalone satellite consumers can wire any UI.
 *
 * The satellite never owns file state. The store is authoritative; the
 * satellite is a projection. See ARCHITECTURE.md.
 */

import styles from './css/main.css?inline';
import {
    resolveStoreElement,
    whenStoreReady,
    subscribeStoreEvents,
    resolveEnumAttribute,
    createMicrotaskScheduler,
    warnStoreMissing
} from './satellite-base';
import { escapeHtml, dispatchComposedEvent } from './dom-utils';
import { isImageFile, createImagePreview, formatFileSize } from './dropzone';
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
import { buildStatusSurfaceArgs, StatusSurface } from './status-surface';
import type { StatusSurfaceArgs } from './status-surface';
import type { WebDropzone } from './dropzone';
import type { DropzoneElement } from './web-component';
import type { FileState, ListAppearance, RollingRotation } from './types';

const BaseElement = (typeof HTMLElement !== 'undefined' ? HTMLElement : class {}) as typeof HTMLElement;

// Appearances this satellite implements. `none` deliberately omitted —
// it means "no list visible at all", which is best handled by simply
// not mounting the satellite. The popover wrapper (Floating UI, resize,
// persistence) still lives in `<web-dropzone>`'s in-class code; the
// satellite renders the summary anchor only.
const SUPPORTED_APPEARANCES: ReadonlyArray<ListAppearance> = [
    'list', 'detailed', 'grid', 'badges', 'rolling', 'popover'
];

const DEFAULT_SUMMARY_TEMPLATE = '{count} file(s), {size}';

export class DropzoneListElement extends BaseElement {
    private shadow: ShadowRoot;
    private container: HTMLElement;
    private store: WebDropzone | null = null;
    private storeEl: DropzoneElement | null = null;
    /** See `bindToStore()` — set when mounted inside another shadow root. */
    private programmaticStoreEl: DropzoneElement | null = null;
    private cleanupStoreWait: (() => void) | null = null;
    private cleanupSubscriptions: (() => void) | null = null;
    /**
     * Coalesces structural re-render requests within the same microtask.
     * Adding N files at once dispatches N × file-added plus one change —
     * without coalescing we'd rebuild the list N+1 times (and destroy the
     * row a user might be mid-click on). With it: one rebuild per burst.
     */
    private scheduleRenderAll = createMicrotaskScheduler(() => this.renderAll());
    /**
     * Memoization snapshots for the rolling appearance's three callback
     * slots (body / file-info / progress). Lets cached WAAPI spinners
     * survive across ticks the same way the indicator satellite does.
     */
    private rollingSurface = new StatusSurface();

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
        return ['for', 'list-appearance', 'empty-message', 'nested'];
    }

    attributeChangedCallback(): void {
        if (this.store) this.renderAll();
    }

    connectedCallback(): void {
        if (this.programmaticStoreEl) {
            this.storeEl = this.programmaticStoreEl;
        } else {
            const forId = this.getAttribute('for');
            this.storeEl = resolveStoreElement(forId);
            if (!this.storeEl) {
                warnStoreMissing('web-dropzone-list', forId);
                return;
            }
        }
        this.cleanupStoreWait = whenStoreReady(this.storeEl, (store) => {
            this.store = store;
            this.attachStoreSubscriptions();
            this.renderAll();
        });
    }

    disconnectedCallback(): void {
        this.teardownStoreBinding();
    }

    /**
     * Programmatically bind this list to a `<web-dropzone>` store element,
     * bypassing the `for=` attribute. See picker's `bindToStore` for the
     * full rationale; the same wiring applies here.
     */
    bindToStore(storeEl: DropzoneElement): void {
        if (this.programmaticStoreEl === storeEl && this.store) return;
        this.programmaticStoreEl = storeEl;
        if (this.isConnected) {
            this.teardownStoreBinding();
            this.storeEl = storeEl;
            this.cleanupStoreWait = whenStoreReady(this.storeEl, (store) => {
                this.store = store;
                this.attachStoreSubscriptions();
                this.renderAll();
            });
        }
    }

    private teardownStoreBinding(): void {
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
        this.cleanupSubscriptions = subscribeStoreEvents(this.storeEl, {
            // add / remove / change → structural; coalesce burst events
            // (one re-render per microtask) so a bulk drop doesn't churn
            // DOM rows while the user is mid-click on an existing row.
            'file-added':   () => this.scheduleRenderAll(),
            'file-removed': () => this.scheduleRenderAll(),
            'change':       () => this.scheduleRenderAll(),
            // progress / status changes → patch the affected row in place
            // (rendering at 50ms ticks across 20 files would burn DOM otherwise).
            'file-progress': (e) => this.patchRow((e as CustomEvent).detail.id),
            // Status changes need extra handling for rolling (front-file
            // pick may shift — patchRow alone can't reflect that) and for
            // popover (the summary's status icon depends on aggregate
            // state, not the per-file row).
            'file-status-changed': (e) => {
                this.patchRow((e as CustomEvent).detail.id);
                const appearance = this.resolveAppearance();
                if (appearance === 'rolling' && this.store) {
                    this.renderRolling(this.store.getFiles());
                } else if (appearance === 'popover' && this.store) {
                    this.renderSummary(this.store.getFiles());
                }
            }
        });
    }

    // ========================================================================
    // RENDERING
    // ========================================================================

    private resolveAppearance(): ListAppearance {
        return resolveEnumAttribute(this, 'list-appearance', SUPPORTED_APPEARANCES, 'list');
    }

    private renderAll(): void {
        if (!this.store) return;
        const files = this.store.getFiles();
        const appearance = this.resolveAppearance();

        if (files.length === 0) {
            // Popover renders nothing when empty — the summary line only
            // appears once there are files, matching the in-class
            // behavior; if we showed an empty-state message the popover
            // anchor would also need an entire empty-state click handler
            // path. Easier to just keep the surface invisible.
            if (appearance === 'popover') {
                this.container.innerHTML = '';
                return;
            }
            const emptyMessage = this.getAttribute('empty-message')
                ?? this.store.getConfig().emptyMessage
                ?? 'No files selected';
            // Rolling memoization snapshots are stale once the list empties
            // out — drop them so the next non-empty render starts fresh.
            if (appearance === 'rolling') this.rollingSurface.reset();
            this.container.innerHTML = `<div class="dz__empty">${escapeHtml(emptyMessage)}</div>`;
            return;
        }

        if (appearance === 'rolling') {
            this.renderRolling(files);
            return;
        }
        if (appearance === 'popover') {
            this.renderSummary(files);
            return;
        }

        // `nested="true"` swaps the container class family to
        // `.dz__files-inside--*` — that's the family the
        // in-class files-inside layout uses, and the corresponding
        // styles in `_dropzone.css` only differ for nested rows. We
        // already inline that stylesheet inside the satellite shadow,
        // so the rules apply unchanged.
        const isNested = this.getAttribute('nested') === 'true';
        const base = isNested ? 'dz__files-inside' : 'dz__file-list';
        const containerClass = `${base} ${base}--${appearance}`;
        const rows = files.map(f => this.renderRow(f, appearance)).join('');
        this.container.innerHTML = `<div class="${containerClass}" data-list-appearance="${appearance}">${rows}</div>`;
        this.bindRowHandlers();
        this.attachPreviewLoaders(files);
    }

    // ========================================================================
    // POPOVER APPEARANCE — summary anchor only
    // ========================================================================

    /**
     * Render a single summary line ("{count} files · {size}") that acts as
     * the click target for the popover. The actual popover wrapper is
     * external to this satellite — the convenience form's `<web-dropzone>`
     * renders it in-class, and standalone consumers wire any UI they want
     * by listening for `dz-summary-click` (bubbles + composed).
     *
     * The summary subtree is re-rendered on every store change. That's
     * cheap (one line of DOM) and avoids the per-tick patching dance the
     * in-class summary does — there's no nested resize / focus state to
     * preserve here, just the icon + text.
     */
    private renderSummary(files: FileState[]): void {
        if (!this.store) return;
        const cfg = this.store.getConfig();
        const args = buildStatusSurfaceArgs(files, this.store);
        const status = args.overallStatus === 'idle' ? 'pending' : args.overallStatus;
        const icon = status === 'pending'
            ? '📎'
            : STATUS_ICONS[status];
        const iconClass = status === 'pending'
            ? 'dz__summary__icon'
            : `dz__summary__icon dz__summary__icon--${status}`;
        const statusLabel = STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? '';

        const totalSize = files.reduce((sum, f) => sum + f.size, 0);
        const template = cfg.summaryTemplate || DEFAULT_SUMMARY_TEMPLATE;
        const text = template
            .replace('{count}', String(files.length))
            .replace('{size}', formatFileSize(totalSize));

        this.container.innerHTML = `
            <div class="dz__summary">
                <div class="dz__summary__line" tabindex="0" role="button" aria-label="Click to view files">
                    <span class="${iconClass}" data-status="${status}" aria-label="Status: ${escapeHtml(statusLabel)}">${icon}</span>
                    <span class="dz__summary__text">${escapeHtml(text)}</span>
                </div>
            </div>
        `;

        const line = this.container.querySelector('.dz__summary__line');
        if (!line) return;
        const fire = () => dispatchComposedEvent(this, 'dz-summary-click');
        line.addEventListener('click', fire);
        line.addEventListener('keydown', (e) => {
            const ke = e as KeyboardEvent;
            if (ke.key === 'Enter' || ke.key === ' ') {
                ke.preventDefault();
                fire();
            }
        });
    }

    private renderRow(file: FileState, appearance: ListAppearance): string {
        if (appearance === 'badges')   return renderBadgeItem(file);
        if (appearance === 'grid')     return renderGridItem(file);
        if (appearance === 'detailed') return renderDetailedItem(file);
        // 'rolling' uses the list-item template for the front-file row.
        return renderListItem(file);
    }

    // ========================================================================
    // ROLLING APPEARANCE
    // ========================================================================

    /**
     * Pick the file currently occupying the "front" slot. Priority order:
     * first uploading → first pending → first paused/error/cancelled
     * (needs attention) → last completed (so the slot doesn't go empty the
     * instant a final upload hits 100%). Returns null only when `files`
     * is empty.
     */
    private getFrontFile(files: FileState[]): FileState | null {
        if (files.length === 0) return null;
        const uploading = files.find(f => f.status === 'uploading');
        if (uploading) return uploading;
        const pending = files.find(f => f.status === 'pending');
        if (pending) return pending;
        const needsAction = files.find(f =>
            f.status === 'paused' || f.status === 'error' || f.status === 'cancelled'
        );
        if (needsAction) return needsAction;
        for (let i = files.length - 1; i >= 0; i--) {
            if (files[i].status === 'complete') return files[i];
        }
        return files[0];
    }

    /**
     * Resolve the rolling rotation mode from the store's config. The
     * satellite doesn't take its own `rolling-rotation` attribute — the
     * store is the single source of truth (matches the in-class renderer's
     * behavior). Falls back to 'slide-in' which is the cheapest variant.
     */
    private resolveRollingRotation(): RollingRotation {
        const cfg = this.store?.getConfig();
        return (cfg?.rollingRotation ?? 'slide-in') as RollingRotation;
    }

    /**
     * Render the rolling block. Same call serves first-render and front-
     * changed re-render — `previousCurrent` is detected from the DOM. When
     * the front file hasn't shifted, the existing slot is left in place and
     * we just refresh the queue count + any callback-driven slot content
     * (tick patching is handled by `patchRow` elsewhere).
     */
    private renderRolling(files: FileState[]): void {
        if (!this.store) return;
        const rotation = this.resolveRollingRotation();
        const cfg = this.store.getConfig();

        // Ensure the wrapper exists once and survives across renders — we
        // never reassign the container's innerHTML in rolling mode after
        // the first non-empty render, so callback-mounted nodes (custom
        // body, custom slots) keep their identity across ticks.
        let wrapper = this.container.querySelector<HTMLElement>('.dz__file-list--rolling');
        if (!wrapper) {
            this.container.innerHTML = '';
            wrapper = document.createElement('div');
            wrapper.className = 'dz__file-list dz__file-list--rolling';
            wrapper.setAttribute('data-list-appearance', 'rolling');
            this.container.appendChild(wrapper);
            // Single delegated click handler — covers any current/future row
            // inside the wrapper without rebinding on each rotation.
            this.bindRowHandlers();
        }
        wrapper.dataset.rotation = rotation;

        // Status-surface body callback — when set, the user owns the entire
        // rolling container (no animation slots, no queue badge). Returning
        // `false` hides the surface; `null` falls through to the default.
        const args = buildStatusSurfaceArgs(files, this.store);
        const bodyResult = cfg.renderRollingBodyCallback
            ? cfg.renderRollingBodyCallback(args)
            : null;
        const { current, previous } = this.rollingSurface.applyBody(wrapper, bodyResult);
        if (current === 'hidden') return;
        if (current === 'custom') {
            wrapper.hidden = false;
            this.rollingSurface.resetSlots();
            return;
        }
        if (previous === 'custom') {
            // We were rendering a custom body; switch back to default by
            // wiping whatever the callback put inside.
            wrapper.innerHTML = '';
        }
        wrapper.hidden = false;

        const front = this.getFrontFile(files);
        if (!front) {
            wrapper.innerHTML = '';
            this.rollingSurface.resetSlots();
            return;
        }

        const queueCount = files.length;
        const showQueueBtn = queueCount > 1;

        // The "settled" current slot — not one mid-rotation-out. That's
        // the right thing to compare against to decide whether the front
        // actually changed.
        const previousCurrent = wrapper.querySelector<HTMLElement>(
            '.dz__rolling__current:not(.dz__rolling__current--leaving)'
        );
        const previousFrontId = previousCurrent?.dataset.frontId;

        if (previousCurrent && previousFrontId === front.id) {
            // Same front file. Per-row ticks land via patchRow; here we
            // just refresh the queue count + re-apply slot callbacks so
            // a render driven by file-status-changed picks up the new
            // status / progress numbers inside the slot subtrees.
            this.applyRollingSlots(previousCurrent, args);
            this.updateRollingQueueButton(wrapper, queueCount, showQueueBtn);
            return;
        }

        const newCurrentEl = document.createElement('div');
        newCurrentEl.className = 'dz__rolling__current';
        newCurrentEl.dataset.frontId = front.id;
        newCurrentEl.innerHTML = renderListItem(front);
        // Slot memoization is stale — the new slot's DOM is fresh; the
        // prev snapshots came from the OUTGOING row's subtrees.
        this.rollingSurface.resetSlots();
        this.applyRollingSlots(newCurrentEl, args);

        if (previousCurrent && rotation !== 'slide-in') {
            // True rotation — outgoing slot keeps mounted so its keyframe
            // (translateX/Y out) plays in parallel with the incoming one.
            previousCurrent.classList.add('dz__rolling__current--leaving');
            wrapper.insertBefore(newCurrentEl, previousCurrent);
            const toRemove = previousCurrent;
            // ~150ms over the typical 350ms animation; spare margin so we
            // never yank a node mid-keyframe.
            setTimeout(() => { toRemove.remove(); }, 500);
        } else if (previousCurrent) {
            previousCurrent.replaceWith(newCurrentEl);
        } else {
            wrapper.insertBefore(newCurrentEl, wrapper.firstChild);
        }
        this.updateRollingQueueButton(wrapper, queueCount, showQueueBtn);
    }

    /**
     * Apply the rolling file-info + progress callbacks (if set) into the
     * row inside `currentEl`. The list-item template's `.dz__file-item__name`
     * span hosts the file-info slot; `.dz__file-item__progress` hosts the
     * progress slot. Routed through the shared memoizer so cached element
     * returns (e.g. WAAPI spinners) survive across ticks.
     */
    private applyRollingSlots(currentEl: HTMLElement, args: StatusSurfaceArgs): void {
        const cfg = this.store?.getConfig();
        if (!cfg) return;

        const fileInfoCb = cfg.renderRollingFileInfoCallback;
        const fileInfoSlot = currentEl.querySelector<HTMLElement>('.dz__file-item__name');
        if (fileInfoCb && fileInfoSlot) {
            this.rollingSurface.applyFileInfo(fileInfoSlot, fileInfoCb(args));
        }

        const progressCb = cfg.renderRollingProgressCallback;
        const progressSlot = currentEl.querySelector<HTMLElement>('.dz__file-item__progress');
        if (progressCb && progressSlot) {
            this.rollingSurface.applyProgress(progressSlot, progressCb(args));
        }
    }

    /**
     * Ensure the rolling queue badge exists inside `wrapper` and reflects
     * the current file count. Created once and reused across re-renders so
     * its click handler isn't repeatedly rebound (and so the badge doesn't
     * flicker during a front-file swap). On click, dispatches a
     * `dz-queue-open` CustomEvent (bubbles + composed) — popover wiring
     * happens externally (convenience form listens; standalone users wire
     * their own).
     */
    private updateRollingQueueButton(wrapper: HTMLElement, queueCount: number, showQueueBtn: boolean): void {
        let queueBtn = wrapper.querySelector<HTMLButtonElement>('.dz__rolling__queue');
        if (!queueBtn) {
            queueBtn = document.createElement('button');
            queueBtn.type = 'button';
            queueBtn.className = 'dz__rolling__queue';
            queueBtn.dataset.action = 'open-queue';
            queueBtn.innerHTML = '<span class="dz__rolling__queue-count"></span>';
            queueBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                dispatchComposedEvent(this, 'dz-queue-open');
            });
            wrapper.appendChild(queueBtn);
        }
        const countEl = queueBtn.querySelector('.dz__rolling__queue-count');
        if (countEl) countEl.textContent = String(queueCount);
        queueBtn.classList.toggle('dz__rolling__queue--hidden', !showQueueBtn);
        queueBtn.setAttribute('aria-label', `Show full queue (${queueCount} files)`);
        queueBtn.setAttribute('title', `Show all ${queueCount} files`);
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
