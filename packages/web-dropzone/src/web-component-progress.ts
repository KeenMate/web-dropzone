/**
 * `<web-dropzone-progress for="<store-id>">` — satellite renderer.
 *
 * Aggregate progress strip — bar + counts + percent + bulk-action buttons
 * (Pause all / Resume all / Retry all). Same surface the convenience form
 * used to render inline inside `<web-dropzone>`; promoted to a standalone
 * element so decoupled layouts (headless store + custom HTML) can drop it
 * anywhere on the page.
 *
 * The strip auto-hides when there's no upload activity (pure pending
 * selections, an empty queue, or everything cleared). That's why this
 * satellite is safe to leave in flow — it collapses to zero height when
 * idle and re-appears once the first byte transfers.
 *
 * Customization surfaces:
 *  - `data-status` attribute on the host element exposes the aggregate
 *    state (uploading / paused / error / complete) — `::part(bar)` /
 *    `::part(fill)` are styled accordingly from main.css.
 *  - Action buttons are auto-shown based on aggregate state — there's no
 *    knob to override them piecemeal. Set `uploadFileCallback` on the
 *    store to enable Pause / Resume buttons (Retry shows whenever any
 *    file is in `error` state, callback or not).
 */

import styles from './css/main.css?inline';
import {
    SatelliteElement,
    subscribeStoreEvents,
    createMicrotaskScheduler
} from './satellite-base';
import { escapeHtml, formatFileSize } from '@keenmate/web-dropzone-core';
import type { DropzoneStoreAPI } from '@keenmate/web-dropzone-core';
import type { DropzoneElement } from './web-component';
import type { OverallProgress } from '@keenmate/web-dropzone-core';

export class DropzoneProgressElement extends SatelliteElement {
    protected readonly satelliteTagName = 'web-dropzone-progress';
    private shadow: ShadowRoot;
    private container: HTMLElement;
    /**
     * Coalesce per-tick refreshes. The store fires file-progress at 50ms
     * intervals across every active upload; a 20-file burst would
     * otherwise re-aggregate 400×/sec — overkill for a single bar.
     */
    private scheduleRefresh = createMicrotaskScheduler(() => this.refresh());

    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        this.shadow.appendChild(styleSheet);

        this.container = document.createElement('div');
        this.container.className = 'dz__overall-progress';
        // `part="root"` so consumers can reach the strip wrapper from
        // outside the shadow root — useful for tweaking margins / hiding
        // behavior without re-implementing the whole bar.
        this.container.setAttribute('part', 'root');
        this.shadow.appendChild(this.container);
    }

    static get observedAttributes(): string[] {
        return ['for'];
    }

    attributeChangedCallback(): void {
        if (this.store) this.refresh();
    }

    protected attachStoreSubscriptions(storeEl: DropzoneElement): () => void {
        // Every event that can move the aggregate triggers a refresh.
        // The microtask coalescer below drops bursts to one refresh.
        return subscribeStoreEvents(storeEl, {
            'file-added':          () => this.scheduleRefresh(),
            'file-removed':        () => this.scheduleRefresh(),
            'change':              () => this.scheduleRefresh(),
            'file-progress':       () => this.scheduleRefresh(),
            'file-status-changed': () => this.scheduleRefresh()
        });
    }

    protected onStoreReady(): void {
        this.refresh();
    }

    // ========================================================================
    // RENDERING
    // ========================================================================

    /**
     * Refresh the strip in place. Always-changing bits (fill width, counts,
     * percent) are patched on every call. The action button group is only
     * rebuilt when its signature changes (uploading > 0, paused > 0,
     * failed > 0 — three bits) so a tick refresh doesn't tear down
     * mid-click. Empty state collapses the wrapper via `innerHTML = ''`
     * paired with `.dz__overall-progress:empty { display: none }`.
     */
    private refresh(): void {
        if (!this.store) return;
        const overall = this.store.getOverallProgress();

        // Reflect aggregate state on the host element AND the container —
        // both `:host([data-status=…])` and `.dz__overall-progress[data-status=…]`
        // selectors live in the main stylesheet, so either path lights up.
        if (!overall.hasActivity) {
            this.container.innerHTML = '';
            delete this.container.dataset.dzButtonsSig;
            delete this.container.dataset.status;
            this.removeAttribute('data-status');
            this.removeAttribute('data-empty');
            this.setAttribute('data-empty', 'true');
            return;
        }
        this.removeAttribute('data-empty');

        if (this.container.dataset.status !== overall.aggregateStatus) {
            this.container.dataset.status = overall.aggregateStatus;
        }
        if (this.getAttribute('data-status') !== overall.aggregateStatus) {
            this.setAttribute('data-status', overall.aggregateStatus);
        }

        const totalFileCount = this.store.getFiles().length;
        const pipelineActive = !!this.store.getConfig().uploadFileCallback;
        const sig = this.overallActionsSignature(overall, pipelineActive);

        const fillEl = this.container.querySelector('.dz__overall-progress__fill') as HTMLElement | null;
        const barEl = this.container.querySelector('.dz__overall-progress__bar') as HTMLElement | null;
        const countsEl = this.container.querySelector('.dz__overall-progress__counts') as HTMLElement | null;
        const percentEl = this.container.querySelector('.dz__overall-progress__percent') as HTMLElement | null;
        const actionsEl = this.container.querySelector('.dz__overall-progress__actions') as HTMLElement | null;

        // First render — install the whole structure.
        if (!fillEl || !countsEl || !percentEl || !actionsEl) {
            this.container.innerHTML = this.renderMarkup(overall, totalFileCount, pipelineActive);
            this.bindActionHandlers(this.container);
            this.container.dataset.dzButtonsSig = sig;
            return;
        }

        const pct = Math.round(overall.percent);
        fillEl.style.width = `${overall.percent}%`;
        barEl?.setAttribute('aria-valuenow', String(pct));
        countsEl.innerHTML = this.renderCountsInner(overall, totalFileCount);
        percentEl.textContent = `${pct}%`;

        // Only rebuild the actions group when the visible button set
        // crosses a threshold. Otherwise tick churn would unmount a
        // button while the user's finger was on it.
        if (this.container.dataset.dzButtonsSig !== sig) {
            actionsEl.innerHTML = this.renderActions(overall, pipelineActive);
            this.bindActionHandlers(actionsEl);
            this.container.dataset.dzButtonsSig = sig;
        }
    }

    private renderMarkup(o: OverallProgress, totalFileCount: number, pipelineActive: boolean): string {
        const pct = Math.round(o.percent);
        return `
            <div class="dz__overall-progress__bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
                <div class="dz__overall-progress__fill" style="width: ${o.percent}%"></div>
            </div>
            <div class="dz__overall-progress__stats">
                <span class="dz__overall-progress__counts">${this.renderCountsInner(o, totalFileCount)}</span>
                <div class="dz__overall-progress__actions">${this.renderActions(o, pipelineActive)}</div>
                <span class="dz__overall-progress__percent">${pct}%</span>
            </div>
        `;
    }

    private renderCountsInner(o: OverallProgress, totalFileCount: number): string {
        const pausedSegment = o.pausedCount > 0
            ? ` · <span class="dz__overall-progress__paused">${o.pausedCount} paused</span>`
            : '';
        const failedSegment = o.failedCount > 0
            ? ` · <span class="dz__overall-progress__failed">${o.failedCount} failed</span>`
            : '';
        return `${o.completedCount} of ${totalFileCount} · ${escapeHtml(formatFileSize(o.uploadedBytes))} / ${escapeHtml(formatFileSize(o.totalBytes))}${pausedSegment}${failedSegment}`;
    }

    private renderActions(o: OverallProgress, pipelineActive: boolean): string {
        const out: string[] = [];
        if (pipelineActive && o.uploadingCount > 0) {
            out.push(`<button type="button" class="dz__overall-progress__action" data-action="pause-all">Pause all</button>`);
        }
        if (pipelineActive && o.pausedCount > 0) {
            out.push(`<button type="button" class="dz__overall-progress__action" data-action="resume-all">Resume all</button>`);
        }
        if (o.failedCount > 0) {
            out.push(`<button type="button" class="dz__overall-progress__action" data-action="retry-all">Retry all</button>`);
        }
        return out.join('');
    }

    private overallActionsSignature(o: OverallProgress, pipelineActive: boolean): string {
        const p = pipelineActive && o.uploadingCount > 0 ? '1' : '0';
        const r = pipelineActive && o.pausedCount > 0 ? '1' : '0';
        const e = o.failedCount > 0 ? '1' : '0';
        return `${p}${r}${e}`;
    }

    private bindActionHandlers(root: ParentNode): void {
        if (!this.store) return;
        const store = this.store;
        root.querySelectorAll('[data-action="retry-all"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                store.retryAll();
            });
        });
        root.querySelectorAll('[data-action="pause-all"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                store.pauseAll();
            });
        });
        root.querySelectorAll('[data-action="resume-all"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                void store.resumeAll();
            });
        });
    }
}

if (typeof customElements !== 'undefined' && !customElements.get('web-dropzone-progress')) {
    customElements.define('web-dropzone-progress', DropzoneProgressElement);
}
