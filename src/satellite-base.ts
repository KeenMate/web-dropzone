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
