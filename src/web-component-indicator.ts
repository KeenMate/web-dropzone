/**
 * `<web-dropzone-indicator for="<store-id>">` — satellite renderer.
 *
 * Status surface that summarizes the bound store's activity. Three
 * flexibility hooks make one element cover a wide range of UX:
 *
 *   - `position="right|left|top|bottom|inline"` — viewport-edge fixed
 *     (default) or inline flow.
 *   - `drawer="auto|off"` — `auto` (default) → chip is a button that
 *     opens a slide-out drawer with the full file list (embedded
 *     `<web-dropzone-list>`); `off` → non-interactive `<div role="status">`,
 *     no drawer DOM. Suits a "rotating indicator that something is
 *     happening" widget.
 *   - Structural render callbacks (`renderBodyCallback`,
 *     `renderFileInfoCallback`, `renderProgressCallback`) — replace any
 *     of the three default parts piecemeal. See `./status-surface.ts`
 *     for the shared contract; the same callback shape is reused by the
 *     rolling list block in `dropzone.ts`.
 *
 * The default rendering is the library calling its own polished defaults
 * through the same hooks: Lucide SVG glyphs + a WAAPI-driven spinner for
 * active uploads + a thin progress bar under the label. Each default part
 * is replaceable independently — you can override progress but keep the
 * built-in file info, or vice versa.
 *
 * Memoization is consistent across all three callbacks (see
 * `applyStatusSurfaceResult`): string returns are skipped when equal to
 * the previous string; element returns are skipped when the returned
 * node is already mounted as the only child. That's what lets a cached
 * spinner survive across 50ms progress ticks without restarting.
 */

import styles from './css/main.css?inline';
import indicatorStyles from './css/_indicator.css?inline';
import {
    SatelliteElement,
    subscribeStoreEvents,
    resolveEnumAttribute,
    createMicrotaskScheduler
} from './satellite-base';
import { escapeHtml } from './dom-utils';
import {
    buildStatusSurfaceArgs,
    StatusSurface
} from './status-surface';
import type {
    StatusSurfaceArgs,
    StatusSurfaceCallback
} from './status-surface';
import {
    STATUS_ICONS,
    STATUS_LABELS,
    createDropzoneSpinner
} from './icons';
import { formatFileSize } from './dropzone';
import type { WebDropzone } from './dropzone';
import type { DropzoneElement } from './web-component';
import type { FileState, FileStatus } from './types';

const POSITIONS = ['right', 'left', 'top', 'bottom', 'inline'] as const;
type IndicatorPosition = typeof POSITIONS[number];

const DRAWER_MODES = ['auto', 'off'] as const;
type DrawerMode = typeof DRAWER_MODES[number];

/**
 * Builds the default chip label. Used internally when the consumer hasn't
 * overridden the body/fileInfo/progress trio. Exposed via the shared
 * status-surface contract — see [status-surface.ts](./status-surface.ts).
 */
function defaultChipLabel(args: StatusSurfaceArgs, fallback: string): string {
    const a = args.aggregate;
    if (a.total === 0) return fallback;
    if (a.error > 0)     return `${a.error} failed`;
    if (a.uploading > 0) return `${a.uploading} uploading`;
    if (a.paused > 0)    return `${a.paused} paused`;
    if (a.pending > 0)   return `${a.pending} queued`;
    return `${a.complete} done`;
}

export class DropzoneIndicatorElement extends SatelliteElement {
    protected readonly satelliteTagName = 'web-dropzone-indicator';
    private shadow: ShadowRoot;
    /**
     * Chip element. `<button>` when the drawer is enabled (it toggles the
     * drawer), `<div role="status">` when `drawer="off"`. Stored as
     * `HTMLElement` so both cases share one field.
     */
    private chipEl: HTMLElement;

    /**
     * Default-path sub-containers. Built by the body default when the
     * consumer hasn't supplied `renderBodyCallback`. Each one is the
     * mount point for the corresponding fileInfo / progress callback;
     * surgical patching writes into these without disturbing the chip's
     * outer button + click handler.
     */
    private fileInfoSlotEl: HTMLElement | null = null;
    private progressSlotEl: HTMLElement | null = null;

    /**
     * Per-callback memoization snapshots. See `applyStatusSurfaceResult`.
     * One entry per slot — when a callback returns the same value two
     * ticks in a row the slot's DOM is left untouched.
     */
    private surface = new StatusSurface();
    /** Snapshot of the last default-body state, used to skip rebuilds. */
    private bodyDefaultMounted = false;

    /**
     * Drawer + close button. Both null when `drawer="off"`.
     */
    private drawerEl: HTMLElement | null = null;
    private drawerCloseBtn: HTMLButtonElement | null = null;
    private drawerOpen = false;

    /**
     * Coalesces aggregate recomputation. A bulk drop with N files
     * uploading at 50ms ticks fires N × file-progress per tick — each
     * would otherwise iterate every file to recompute totals. With this,
     * we recompute once per microtask (≈ once per paint frame).
     */
    private scheduleRefresh = createMicrotaskScheduler(() => this.refresh());

    // ========================================================================
    // RENDER CALLBACKS — JS-only properties, no HTML attribute equivalent
    // ========================================================================

    private _renderBodyCallback: StatusSurfaceCallback | null = null;
    /**
     * Body / shell renderer. Owns the outer chip contents; can return
     * `false` to hide the surface entirely (solves the "empty pill hangs
     * around" problem). When this is set, the default fileInfo + progress
     * slots are NOT mounted automatically — the body callback decides
     * whether to call them itself (via the standalone helpers exported
     * from the package) or assemble its own DOM.
     */
    get renderBodyCallback(): StatusSurfaceCallback | null {
        return this._renderBodyCallback;
    }
    set renderBodyCallback(value: StatusSurfaceCallback | null) {
        this._renderBodyCallback = value;
        this.resetMemoization();
        if (this.store) this.refresh();
    }

    private _renderFileInfoCallback: StatusSurfaceCallback | null = null;
    /**
     * File-info renderer. Only invoked when the default body is in use
     * (no `renderBodyCallback` set or the body callback returned `null`).
     * Receives `args.currentFile`, `currentFilePercent`, `currentFileStatus`.
     */
    get renderFileInfoCallback(): StatusSurfaceCallback | null {
        return this._renderFileInfoCallback;
    }
    set renderFileInfoCallback(value: StatusSurfaceCallback | null) {
        this._renderFileInfoCallback = value;
        this.surface.resetFileInfo();
        if (this.store) this.refresh();
    }

    private _renderProgressCallback: StatusSurfaceCallback | null = null;
    /**
     * Progress renderer. Only invoked when the default body is in use.
     * Receives both per-file (`currentFilePercent`/`currentFileStatus`) and
     * overall (`overallPercent`/`overallStatus`) slices so templates can
     * combine them ("xyz.zip 47% — 3 / 10 done").
     */
    get renderProgressCallback(): StatusSurfaceCallback | null {
        return this._renderProgressCallback;
    }
    set renderProgressCallback(value: StatusSurfaceCallback | null) {
        this._renderProgressCallback = value;
        this.surface.resetProgress();
        if (this.store) this.refresh();
    }

    private resetMemoization(): void {
        this.surface.reset();
        this.bodyDefaultMounted = false;
    }

    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });

        const baseSheet = document.createElement('style');
        baseSheet.textContent = styles;
        this.shadow.appendChild(baseSheet);
        const indicatorSheet = document.createElement('style');
        indicatorSheet.textContent = indicatorStyles;
        this.shadow.appendChild(indicatorSheet);

        // Pre-upgrade rescue for the three callback properties.
        this.upgradeProperty('renderBodyCallback');
        this.upgradeProperty('renderFileInfoCallback');
        this.upgradeProperty('renderProgressCallback');

        // Chip is built on connect (and rebuilt on drawer flips) because
        // its element kind depends on attribute state.
        this.chipEl = document.createElement('button');
    }

    private upgradeProperty(prop: string): void {
        if (Object.prototype.hasOwnProperty.call(this, prop)) {
            const value = (this as any)[prop];
            delete (this as any)[prop];
            (this as any)[prop] = value;
        }
    }

    static get observedAttributes(): string[] {
        return ['for', 'position', 'label', 'drawer'];
    }

    attributeChangedCallback(name: string): void {
        if (name === 'position') this.applyPosition();
        if (name === 'drawer')   this.applyDrawerMode();
        if (this.store) this.scheduleRefresh();
    }

    protected setupBeforeBind(): void {
        this.applyPosition();
        this.applyDrawerMode();
    }

    protected onStoreReady(): void {
        this.bindEmbeddedList();
        this.refresh();
    }

    // ========================================================================
    // POSITION + DRAWER MODE
    // ========================================================================

    private resolvePosition(): IndicatorPosition {
        return resolveEnumAttribute(this, 'position', POSITIONS, 'right');
    }

    private resolveDrawerMode(): DrawerMode {
        return resolveEnumAttribute(this, 'drawer', DRAWER_MODES, 'auto');
    }

    private applyPosition(): void {
        this.shadow.host.setAttribute('data-position', this.resolvePosition());
    }

    private applyDrawerMode(): void {
        const mode = this.resolveDrawerMode();
        this.shadow.host.setAttribute('data-drawer', mode);

        // Tear down previous chip + drawer. We always rebuild on a drawer
        // flip because the chip's element kind (button vs div) differs.
        if (this.chipEl.parentNode) this.chipEl.parentNode.removeChild(this.chipEl);
        if (this.drawerEl?.parentNode) this.drawerEl.parentNode.removeChild(this.drawerEl);
        this.drawerEl = null;
        this.drawerCloseBtn = null;
        this.fileInfoSlotEl = null;
        this.progressSlotEl = null;
        this.resetMemoization();
        this.drawerOpen = false;
        this.shadow.host.setAttribute('data-drawer-open', 'false');

        if (mode === 'auto') {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.setAttribute('aria-label', 'Upload status');
            btn.addEventListener('click', () => this.toggleDrawer());
            this.chipEl = btn;
        } else {
            const div = document.createElement('div');
            div.setAttribute('role', 'status');
            div.setAttribute('aria-label', 'Upload status');
            this.chipEl = div;
        }
        this.chipEl.className = 'dz__indicator__chip';
        // `part="chip"` lets consumers reach the chip wrapper from outside the
        // shadow root via `::part(chip)` — needed when they want to strip the
        // pill (border / background / padding) and render plain inline text.
        this.chipEl.setAttribute('part', 'chip');
        this.shadow.appendChild(this.chipEl);

        if (mode === 'auto') {
            this.drawerEl = document.createElement('div');
            this.drawerEl.className = 'dz__indicator__drawer';
            this.drawerEl.setAttribute('part', 'drawer');
            this.drawerEl.setAttribute('role', 'dialog');
            this.drawerEl.setAttribute('aria-label', 'Upload queue');
            this.populateDrawer();
            this.shadow.appendChild(this.drawerEl);
        }
    }

    // ========================================================================
    // SUBSCRIPTIONS
    // ========================================================================

    protected attachStoreSubscriptions(storeEl: DropzoneElement): () => void {
        return subscribeStoreEvents(storeEl, {
            'file-added':           () => this.scheduleRefresh(),
            'file-removed':         () => this.scheduleRefresh(),
            'change':               () => this.scheduleRefresh(),
            'file-progress':        () => this.scheduleRefresh(),
            'file-status-changed':  () => this.scheduleRefresh()
        });
    }

    // ========================================================================
    // RENDERING
    // ========================================================================

    private populateDrawer(): void {
        if (!this.drawerEl) return;
        const labelAttr = this.getAttribute('label') ?? 'Uploads';
        // Body intentionally empty — the embedded `<web-dropzone-list>` is
        // mounted in `bindEmbeddedList` once `storeEl` is known, so we can
        // call `bindToStore` BEFORE the list is connected. Putting the
        // list in this innerHTML string would have its `connectedCallback`
        // fire mid-parse with no binding, logging "store not found".
        this.drawerEl.innerHTML = `
            <header class="dz__indicator__drawer-header">
                <span class="dz__indicator__drawer-title">${escapeHtml(labelAttr)}</span>
                <button type="button" class="dz__indicator__drawer-close" aria-label="Close">×</button>
            </header>
            <div class="dz__indicator__drawer-body"></div>
        `;
        this.drawerCloseBtn = this.drawerEl.querySelector('.dz__indicator__drawer-close');
        if (this.drawerCloseBtn) {
            this.drawerCloseBtn.addEventListener('click', () => this.setDrawerOpen(false));
        }
        // Try to mount immediately — no-op if storeEl isn't resolved yet
        // (populateDrawer runs during connectedCallback, before
        // whenStoreReady fires). The whenStoreReady callback re-invokes us.
        this.bindEmbeddedList();
    }

    /**
     * Mount + wire the drawer's embedded `<web-dropzone-list>` to the
     * same store this indicator is bound to. Idempotent: creates the
     * list element on the first call where both `drawerEl` and `storeEl`
     * exist, and re-binds (cheap) on subsequent calls. Safe to invoke
     * from both `populateDrawer` (which may run before the store
     * resolves) and the `whenStoreReady` callback (which runs once it
     * does).
     */
    private bindEmbeddedList(): void {
        if (!this.drawerEl || !this.storeEl) return;
        const body = this.drawerEl.querySelector('.dz__indicator__drawer-body');
        if (!body) return;
        type BindableList = HTMLElement & { bindToStore?: (el: DropzoneElement) => void };
        let embeddedList = body.querySelector('web-dropzone-list') as BindableList | null;
        if (!embeddedList) {
            embeddedList = document.createElement('web-dropzone-list') as BindableList;
            embeddedList.setAttribute('list-appearance', 'detailed');
            // bindToStore BEFORE appendChild — sets `programmaticStoreEl`
            // so the list's connectedCallback uses it instead of looking
            // up the `for=` attribute (which we don't set).
            embeddedList.bindToStore?.(this.storeEl);
            body.appendChild(embeddedList);
        } else {
            embeddedList.bindToStore?.(this.storeEl);
        }
    }

    private refresh(): void {
        if (!this.store) return;
        const files = this.store.getFiles();
        const args = buildStatusSurfaceArgs(files, this.store);

        // ---- Chip dataset (drives color + 'empty' state via CSS) --------
        const nextStatus = args.overallStatus;
        if (this.chipEl.dataset.status !== nextStatus) {
            this.chipEl.dataset.status = nextStatus;
        }
        const nextEmpty = args.aggregate.total === 0 ? 'true' : 'false';
        if (this.chipEl.dataset.empty !== nextEmpty) {
            this.chipEl.dataset.empty = nextEmpty;
        }

        // ---- Body callback (or default) ---------------------------------
        const bodyResult = this._renderBodyCallback
            ? this._renderBodyCallback(args)
            : null;

        const { current } = this.surface.applyBody(this.chipEl, bodyResult);
        if (current === 'hidden') {
            this.bodyDefaultMounted = false;
            return;
        }
        if (current === 'custom') {
            this.chipEl.hidden = false;
            this.bodyDefaultMounted = false;
            return;
        }

        // current === 'default' — render the polished OOB body. Build slots
        // once and patch in place from there.
        this.chipEl.hidden = false;
        if (!this.bodyDefaultMounted
            || !this.fileInfoSlotEl
            || !this.progressSlotEl
            || this.fileInfoSlotEl.parentNode !== this.chipEl) {
            this.buildDefaultBodyShell(args);
            // Reset slot memoization so the next callback call writes
            // fresh content into the just-built slots.
            this.surface.resetSlots();
        }
        this.refreshFileInfoSlot(args);
        this.refreshProgressSlot(args);
    }

    /**
     * Builds the polished OOB body once. Three slots inside the chip:
     * a leading status glyph (file-info default lives here), a middle
     * label, and a trailing progress block. The label is patched per
     * refresh; the two slots get filled by the file-info / progress
     * callbacks (or library defaults when those aren't set).
     */
    private buildDefaultBodyShell(_args: StatusSurfaceArgs): void {
        this.chipEl.innerHTML = '';

        this.fileInfoSlotEl = document.createElement('span');
        this.fileInfoSlotEl.className = 'dz__indicator__file-info';
        this.chipEl.appendChild(this.fileInfoSlotEl);

        const label = document.createElement('span');
        label.className = 'dz__indicator__label';
        this.chipEl.appendChild(label);

        this.progressSlotEl = document.createElement('span');
        this.progressSlotEl.className = 'dz__indicator__progress';
        this.chipEl.appendChild(this.progressSlotEl);

        this.bodyDefaultMounted = true;
    }

    private refreshFileInfoSlot(args: StatusSurfaceArgs): void {
        if (!this.fileInfoSlotEl) return;
        const result = this._renderFileInfoCallback
            ? this._renderFileInfoCallback(args)
            : null;
        this.surface.applyFileInfo(
            this.fileInfoSlotEl,
            result,
            () => this.defaultFileInfo(args)
        );
    }

    private refreshProgressSlot(args: StatusSurfaceArgs): void {
        if (!this.progressSlotEl) return;
        const result = this._renderProgressCallback
            ? this._renderProgressCallback(args)
            : null;
        this.surface.applyProgress(
            this.progressSlotEl,
            result,
            () => this.defaultProgress(args)
        );

        // The label sits between the two slots and reads from the
        // aggregate. Auto-hide it when the consumer has provided either a
        // fileInfo OR progress callback — once you're customizing those
        // structural slots, the OOB "1 uploading" / "3 done" summary
        // becomes visual noise sandwiched between your own template parts.
        // Templates that DO want a description alongside custom slots
        // should bake it into the fileInfo / progress return value, or
        // use `renderBodyCallback` to own the whole chip.
        const label = this.chipEl.querySelector<HTMLElement>('.dz__indicator__label');
        if (label) {
            const labelHidden = !!this._renderFileInfoCallback
                || !!this._renderProgressCallback;
            if (label.hidden !== labelHidden) label.hidden = labelHidden;
            if (!labelHidden) {
                const labelFallback = this.getAttribute('label') ?? 'No uploads';
                const nextLabel = defaultChipLabel(args, labelFallback);
                if (label.textContent !== nextLabel) label.textContent = nextLabel;
            }
        }
    }

    /**
     * Library default for the file-info slot. While idle: nothing (empty
     * string memoizes to a no-op). While there's a focal file: the
     * file's status glyph — swapped to the polished WAAPI spinner when
     * the focal file is actively uploading. Returns an HTMLElement so the
     * spinner instance survives across ticks (identity-checked memoization).
     */
    private defaultFileInfo(args: StatusSurfaceArgs): string | HTMLElement {
        if (!args.currentFile) return '';
        if (args.currentFile.status === 'uploading') {
            return this.getSharedSpinner();
        }
        const status = args.currentFile.status as FileStatus;
        // Static glyph for non-uploading focal states (paused / error /
        // complete). Returned as a string so it memoizes by equality.
        return `<span class="dz__indicator__file-info__icon" data-status="${status}" title="${STATUS_LABELS[status]}">${STATUS_ICONS[status]}</span>`;
    }

    /**
     * Library default for the progress slot. Shows the byte-weighted
     * overall percent when anything is uploading. Returned as a string so
     * adjacent ticks at the same percent are memoized away.
     */
    private defaultProgress(args: StatusSurfaceArgs): string {
        if (args.aggregate.uploading === 0) return '';
        return `<span class="dz__indicator__percent">${args.overallPercent}%</span>`;
    }

    /**
     * Lazy-cached spinner. Reused across refreshes so the WAAPI rotation
     * never restarts — `applyStatusSurfaceResult` short-circuits when
     * the returned element is already mounted.
     */
    private sharedSpinner: HTMLElement | null = null;
    private getSharedSpinner(): HTMLElement {
        if (!this.sharedSpinner) {
            this.sharedSpinner = createDropzoneSpinner({
                ariaLabel: 'Uploading',
                className: 'dz__indicator__spinner'
            });
        }
        return this.sharedSpinner;
    }

    // ========================================================================
    // DRAWER
    // ========================================================================

    private toggleDrawer(): void {
        this.setDrawerOpen(!this.drawerOpen);
    }

    private setDrawerOpen(open: boolean): void {
        if (!this.drawerEl) return;
        if (this.drawerOpen === open) return;
        this.drawerOpen = open;
        this.shadow.host.setAttribute('data-drawer-open', open ? 'true' : 'false');
    }
}

if (typeof customElements !== 'undefined' && !customElements.get('web-dropzone-indicator')) {
    customElements.define('web-dropzone-indicator', DropzoneIndicatorElement);
}

// Convenience re-exports so users writing callbacks have a single import
// path for everything: types + spinner + status icons.
export {
    formatFileSize
} from './dropzone';
export {
    createDropzoneSpinner,
    STATUS_ICONS,
    STATUS_LABELS
} from './icons';
export type {
    StatusSurfaceArgs,
    StatusSurfaceCallback,
    StatusSurfaceResult,
    StatusAggregate
} from './status-surface';
