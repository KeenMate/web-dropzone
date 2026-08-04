import { describe, it, expect, afterEach, vi } from 'vitest';
import '../../src/web-component'; // registers <web-dropzone>

/**
 * Element-level form association. `<web-dropzone>` is a form-associated custom
 * element (`static formAssociated = true`); core's `BlissElement` exposes the
 * associated <form> via the public `el.form` getter (lazily attaching, and
 * memoizing, `ElementInternals`). This is the surface host frameworks depend on:
 * Phoenix LiveView's `phx-change` delegation resolves the parent form through
 * `event.target.form`, which is `undefined` on a custom element without this
 * getter. The core migration (dropping this element's own `attachInternals` for
 * core's) must not regress it.
 *
 * happy-dom does not wire real form association (`ElementInternals.form` is
 * undefined / unavailable), so the happy path is modelled by shadowing
 * `attachInternals`. The REAL browser wiring — `event.target.form` resolving an
 * actual `<form>` — is covered in `e2e/form-delegation.spec.ts` (Chromium).
 *
 * NOTE: dropzone reads `this.internals` during connect (its `syncFormValue`
 * stamps the FormData via `setFormValue`), so a connected element attaches
 * internals as part of building its store — hence the mock also stubs
 * `setFormValue` / `setValidity`.
 */

let el: any;

afterEach(() => {
    el?.remove();
    el = undefined;
    vi.restoreAllMocks();
});

/** A minimal ElementInternals stand-in that dropzone's syncFormValue can call. */
function fakeInternals(form: HTMLFormElement | null): Partial<ElementInternals> {
    return { form, setFormValue() {}, setValidity() {} } as Partial<ElementInternals>;
}

describe('<web-dropzone> form association', () => {
    it('exposes a public `form` getter (inherited from core)', () => {
        el = document.createElement('web-dropzone');
        expect('form' in el).toBe(true);
        // No <form> + happy-dom's unwired internals → null, but the read must not throw.
        expect(el.form).toBeNull();
    });

    it('resolves the associated <form> through ElementInternals (event.target.form)', () => {
        el = document.createElement('web-dropzone');
        const form = document.createElement('form');
        // happy-dom leaves ElementInternals.form undefined; shadow attachInternals to model it.
        (el as any).attachInternals = () => fakeInternals(form);
        expect(el.form).toBe(form);
        // event.target.form — the exact shape LiveView's phx-change reads — resolves too.
        const evt = { target: el } as unknown as { target: { form: HTMLFormElement | null } };
        expect(evt.target.form).toBe(form);
    });

    it('attaches ElementInternals at most once (core owns the single, lazy attach)', () => {
        el = document.createElement('web-dropzone');
        let calls = 0;
        const form = document.createElement('form');
        (el as any).attachInternals = () => {
            calls += 1;
            return fakeInternals(form);
        };
        // Connecting builds the store, whose syncFormValue reads `this.internals`
        // once — the single attach. Reading `el.form` afterwards must not re-attach.
        document.body.appendChild(el);
        void el.form;
        void el.form;
        expect(calls).toBe(1); // memoized — attached at most once
    });
});
