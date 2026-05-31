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
 * DropzoneElement (e.g. `for="some-div"`). Does NOT wait for the store to be
 * initialized — callers should pair this with `whenStoreReady`.
 */
export function resolveStoreElement(forId: string | null): DropzoneElement | null {
    if (!forId) return null;
    const el = document.getElementById(forId);
    if (!el) return null;
    // Avoid a hard `instanceof` check that would fail across bundles/HMR.
    // Duck-type on `getStore` instead — DropzoneElement is the only thing
    // with that method.
    if (typeof (el as DropzoneElement).getStore !== 'function') return null;
    return el as DropzoneElement;
}

/**
 * Resolve a store's underlying `WebDropzone` instance, waiting if the store
 * hasn't run its `connectedCallback` yet. Resolves with the instance once
 * available; calls `onResolved` exactly once. Returns a teardown function
 * that cancels the wait if the satellite is disconnected before resolution.
 *
 * Race handling: when the satellite connects before the store, `getStore()`
 * returns undefined. We then listen for the store's `store-ready` event and
 * re-call `getStore()`. The store dispatches `store-ready` synchronously at
 * the end of its `initializeDropzone()`, so this is reliable.
 */
export function whenStoreReady(
    storeEl: DropzoneElement,
    onResolved: (store: WebDropzone) => void
): () => void {
    const immediate = storeEl.getStore();
    if (immediate) {
        onResolved(immediate);
        return () => { /* nothing to tear down */ };
    }
    const handler = () => {
        const ready = storeEl.getStore();
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
