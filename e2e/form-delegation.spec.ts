import { test, expect, Page, Locator } from '@playwright/test';

/**
 * Section 5b — host-framework form delegation (`el.form` / `event.target.form`).
 *
 * `<web-dropzone>` is a form-associated custom element, so — via core's
 * `BlissElement` — it exposes a real `el.form`, and a composed `change` event
 * retargets to the host so a delegated ancestor listener can read
 * `event.target.form`. This is exactly what Phoenix LiveView's `phx-change`
 * delegation depends on (it dropped changes when a v2 regression removed `.form`).
 * jsdom/happy-dom can't wire real `ElementInternals.form`, so this REAL-browser
 * check complements the unit test in
 * `packages/web-dropzone/test/unit/form-association.test.ts`.
 *
 * Fixture: test/form.html — a body-level `change` listener writes
 * `"<dropzone-id> -> <form-id|null>"` into `#delegation-log`.
 */

const PAGE = '/test/form.html';

function dz(page: Page, id: string): Locator {
    return page.locator(`#${id}`);
}

async function stage(page: Page, id: string, names: string[]): Promise<void> {
    await page.evaluate(({ id, names }) => (window as any).__stage(id, names), { id, names });
}

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
});

test.describe('el.form / event.target.form (host-framework delegation)', () => {
    test('a delegated change listener resolves the owning <form> via event.target.form', async ({ page }) => {
        // Add a file → the store dispatches a composed `change`; the body-level
        // listener reads `event.target.form` (the LiveView phx-change shape).
        await stage(page, 'named', ['a.txt']);
        await expect(page.locator('#delegation-log')).toHaveText('named -> named-form');
    });

    test('el.form resolves the owning <form> — even without a name attribute', async ({ page }) => {
        // Named dropzone associates with its <form>.
        expect(await dz(page, 'named').evaluate((el: any) => el.form?.id ?? null)).toBe('named-form');
        // The unnamed dropzone associates too — `name` only affects submission,
        // not form association — so el.form still resolves.
        expect(await dz(page, 'unnamed').evaluate((el: any) => el.form?.id ?? null)).toBe('unnamed-form');
    });

    test('a dropzone outside any <form> has el.form === null', async ({ page }) => {
        const formId = await page.evaluate(() => {
            const el = document.createElement('web-dropzone') as any;
            document.body.appendChild(el); // connected, but not inside a <form>
            const id = el.form ? el.form.id : null;
            el.remove();
            return id;
        });
        expect(formId).toBeNull();
    });
});
