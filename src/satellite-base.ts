/**
 * Shared helpers for satellite renderers — `<web-dropzone-picker>`,
 * `<web-dropzone-list>`, `<web-dropzone-indicator>`. See ARCHITECTURE.md for
 * the store + satellite-renderers topology.
 *
 * Each satellite binds to exactly one `<web-dropzone>` store via its
 * `for="<store-id>"` attribute. The resolution race (satellite may upgrade
 * before, after, or alongside the store's `connectedCallback`) is the
 * trickiest part of the wiring; these helpers centralize it.
 */

import { WebDropzone } from './dropzone';
import type { DropzoneElement } from './web-component';

/**
 * Look up the `<web-dropzone>` element a satellite binds to via its `for=`
 * attribute. Returns null if the element is missing or isn't a
 * `<web-dropzone>` (e.g. `for="some-div"`). Does NOT wait for the store to
 * be upgraded or initialized — callers should pair this with
 * `whenStoreReady`, which handles both races.
 *
 * Note: we check by `tagName` rather than duck-typing on `getStore` because
 * the store custom element may not have upgraded yet (satellites can
 * register before `<web-dropzone>` does — see index.ts).
 */
export function resolveStoreElement(forId: string | null): DropzoneElement | null {
    if (!forId) return null;
    const el = document.getElementById(forId);
    if (!el) return null;
    if (el.tagName !== 'WEB-DROPZONE') return null;
    return el as DropzoneElement;
}

/**
 * Resolve a store's underlying `WebDropzone` instance, waiting if the store
 * hasn't upgraded or run its `connectedCallback` yet. Resolves with the
 * instance once available; calls `onResolved` exactly once. Returns a
 * teardown function that cancels the wait if the satellite is disconnected
 * before resolution.
 *
 * Race handling: a satellite can connect before the store does — either
 * because the store hasn't upgraded yet (custom element registration
 * order) or because its `connectedCallback` hasn't run yet. In both cases
 * `getStore` is either missing or returns undefined. We listen for
 * `store-ready` (dispatched at the end of `initializeDropzone()`) and
 * re-check then. The listener is attached even on the un-upgraded element —
 * `addEventListener` is inherited from `HTMLElement`, so the upgrade
 * preserves it.
 */
export function whenStoreReady(
    storeEl: DropzoneElement,
    onResolved: (store: WebDropzone) => void
): () => void {
    const immediate = typeof storeEl.getStore === 'function' ? storeEl.getStore() : undefined;
    if (immediate) {
        onResolved(immediate);
        return () => { /* nothing to tear down */ };
    }
    const handler = () => {
        const ready = typeof storeEl.getStore === 'function' ? storeEl.getStore() : undefined;
        if (ready) {
            storeEl.removeEventListener('store-ready', handler);
            onResolved(ready);
        }
    };
    storeEl.addEventListener('store-ready', handler);
    return () => storeEl.removeEventListener('store-ready', handler);
}

/**
 * Subscribe to one or more events on the store element. Returns a teardown
 * function that removes every listener. Each handler receives the live
 * CustomEvent so satellites can read `event.detail` directly.
 *
 * Events bubble + composed from the store, so listening on the store
 * element itself is sufficient — satellites in other shadow roots receive
 * the dispatch the same way the host page would.
 */
export function subscribeStoreEvents(
    storeEl: DropzoneElement,
    handlers: Record<string, (event: Event) => void>
): () => void {
    const entries = Object.entries(handlers);
    for (const [type, fn] of entries) {
        storeEl.addEventListener(type, fn);
    }
    return () => {
        for (const [type, fn] of entries) {
            storeEl.removeEventListener(type, fn);
        }
    };
}

/**
 * Read an HTML attribute and validate it against a closed set of allowed
 * values, returning the typed value or a fallback. Centralizes the
 * `attribute → enum` pattern used by every satellite for things like
 * `selector-appearance`, `list-appearance`, `position`, `drawer`.
 */
export function resolveEnumAttribute<T extends string>(
    el: HTMLElement,
    attr: string,
    allowed: readonly T[],
    fallback: T
): T {
    const raw = el.getAttribute(attr);
    return (allowed as readonly string[]).includes(raw ?? '')
        ? (raw as T)
        : fallback;
}

/**
 * Build a microtask-coalesced scheduler around `fn`. Multiple calls within
 * the same task collapse into a single deferred invocation; the next call
 * after the microtask flushes schedules a fresh one. Used by satellites to
 * debounce per-event refreshes so a burst of `file-progress` / `change` /
 * `file-status-changed` events in one frame results in exactly one render.
 */
export function createMicrotaskScheduler(fn: () => void): () => void {
    let scheduled = false;
    return () => {
        if (scheduled) return;
        scheduled = true;
        queueMicrotask(() => {
            scheduled = false;
            fn();
        });
    };
}

/**
 * Standard "the satellite couldn't find its store" warning. Every satellite
 * needs to emit the same diagnostic with its own tag — passing the satellite's
 * tag name (`web-dropzone-picker`, `web-dropzone-list`, …) is enough.
 */
export function warnStoreMissing(elementName: string, forId: string | null): void {
    // eslint-disable-next-line no-console
    console.warn(
        `<${elementName} for="${forId ?? ''}"> — store not found. ` +
        `Make sure a <web-dropzone id="${forId ?? ''}"> exists on the page.`
    );
}

/**
 * SSR-safe HTMLElement base — the satellite class extends this so the
 * module can still be imported in a Node test runner without crashing
 * on `class extends undefined`. Matches the pattern every satellite file
 * uses locally; centralizing means subclasses don't need their own copy.
 */
const SatelliteBaseElement = (typeof HTMLElement !== 'undefined' ? HTMLElement : class {}) as typeof HTMLElement;

/**
 * Base class for `<web-dropzone-picker>`, `<web-dropzone-list>`,
 * `<web-dropzone-indicator>`, `<web-dropzone-progress>`. Owns the
 * connection lifecycle (`connectedCallback` / `disconnectedCallback` /
 * `bindToStore` / `teardownStoreBinding`) so the race-resolution logic
 * lives in one place and can be tested once — subclasses provide just
 * their event subscription + first-render hooks.
 *
 * Two abstract members:
 *  - `attachStoreSubscriptions(storeEl, store)` — wire up event listeners,
 *    return the cleanup function. Called exactly once per resolved store.
 *  - `onStoreReady(storeEl, store)` — fire the first render + any one-time
 *    bind work (e.g. mounting an embedded satellite).
 *
 * Two optional hooks:
 *  - `setupBeforeBind()` — runs at the top of `connectedCallback`, before
 *    the `for=` resolution. Use for DOM mutations that must apply
 *    regardless of whether the store resolves (the indicator pushes its
 *    `data-position` / `data-drawer` attributes here so the chip renders
 *    even when bound asynchronously).
 *  - `satelliteTagName` — used in the "store not found" warning so the
 *    diagnostic names the specific element type.
 */
export abstract class SatelliteElement extends SatelliteBaseElement {
    protected store: WebDropzone | null = null;
    protected storeEl: DropzoneElement | null = null;
    /**
     * Set by `bindToStore()` for satellites mounted inside another shadow
     * root (the convenience-form `<web-dropzone display-mode=…>` mounts its
     * own picker / list / indicator internally, where `document.getElementById`
     * lookups can't reach across the shadow boundary). When set, the
     * `connectedCallback` consults this directly instead of resolving the
     * `for=` attribute.
     */
    protected programmaticStoreEl: DropzoneElement | null = null;
    private cleanupStoreWait: (() => void) | null = null;
    private cleanupSubscriptions: (() => void) | null = null;

    protected abstract readonly satelliteTagName: string;

    protected abstract attachStoreSubscriptions(
        storeEl: DropzoneElement,
        store: WebDropzone
    ): () => void;

    protected abstract onStoreReady(
        storeEl: DropzoneElement,
        store: WebDropzone
    ): void;

    /** Optional pre-bind DOM setup. Default no-op. */
    protected setupBeforeBind(): void { /* override in subclasses if needed */ }

    connectedCallback(): void {
        this.setupBeforeBind();
        if (this.programmaticStoreEl) {
            this.storeEl = this.programmaticStoreEl;
        } else {
            const forId = this.getAttribute('for');
            this.storeEl = resolveStoreElement(forId);
            if (!this.storeEl) {
                warnStoreMissing(this.satelliteTagName, forId);
                return;
            }
        }
        this.waitForStore();
    }

    disconnectedCallback(): void {
        this.teardownStoreBinding();
    }

    /**
     * Programmatically bind to a `<web-dropzone>` element, bypassing the
     * `for=` attribute. Use when mounting the satellite inside another
     * shadow root (where `document.getElementById` can't reach the store).
     *
     * Safe to call before `connectedCallback` — the binding is consulted
     * when the element connects. Calling after connection tears down the
     * current wiring and re-binds.
     */
    bindToStore(storeEl: DropzoneElement): void {
        if (this.programmaticStoreEl === storeEl && this.store) return;
        this.programmaticStoreEl = storeEl;
        if (this.isConnected) {
            this.teardownStoreBinding();
            this.storeEl = storeEl;
            this.waitForStore();
        }
    }

    protected teardownStoreBinding(): void {
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

    /**
     * Resolved store, or `null` until the store has connected. Public so
     * consumer code (e.g. a callback set on the host) can reach the bound
     * store without going through the original element reference.
     */
    getStore(): WebDropzone | null {
        return this.store;
    }

    private waitForStore(): void {
        if (!this.storeEl) return;
        const storeEl = this.storeEl;
        this.cleanupStoreWait = whenStoreReady(storeEl, (store) => {
            this.store = store;
            this.cleanupSubscriptions = this.attachStoreSubscriptions(storeEl, store);
            this.onStoreReady(storeEl, store);
        });
    }
}
