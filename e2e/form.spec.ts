import { test, expect, Page, Locator } from '@playwright/test';

/**
 * Section 5 — form integration.
 *
 * Fixture: test/form.html. Two forms — one with a named dropzone, one
 * without. Submit handlers dump FormData into an inline event-log as
 * `key:filename:size` for File entries or `key:value` for plain inputs.
 * The dropzone is form-associated via ElementInternals; its `name`
 * attribute drives the FormData key.
 */

const PAGE = '/test/form.html';

function dz(page: Page, id: string): Locator {
    return page.locator(`#${id}`);
}

function log(page: Page, id: string): Locator {
    return page.locator(`#${id}-log`);
}

async function stage(page: Page, id: string, names: string[]): Promise<void> {
    await page.evaluate(
        ({ id, names }) => (window as any).__stage(id, names),
        { id, names }
    );
}

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
});

test.describe('named dropzone in a form', () => {
    test('submits real File blobs under the configured name', async ({ page }) => {
        await stage(page, 'named', ['report.pdf', 'photo.jpg']);
        await page.locator('#submit-named').click();
        const text = await log(page, 'named').textContent();
        // Other form inputs survive alongside the dropzone files
        expect(text).toContain('title:quarterly');
        // Each File arrives under the configured key with name + size
        expect(text).toContain('attachments:report.pdf');
        expect(text).toContain('attachments:photo.jpg');
    });

    test('zero files → no attachments entries in FormData', async ({ page }) => {
        await page.locator('#submit-named').click();
        const text = await log(page, 'named').textContent();
        expect(text).toBe('title:quarterly');
    });

    test('form.reset() clears the dropzone selection via formResetCallback', async ({ page }) => {
        await stage(page, 'named', ['a.txt']);
        expect(await dz(page, 'named').evaluate((el: any) => el.files.length)).toBe(1);

        await page.locator('#reset-named').click();
        // formResetCallback fires clear() on the dropzone
        expect(await dz(page, 'named').evaluate((el: any) => el.files.length)).toBe(0);
        // And the text input goes back to its default value
        await expect(page.locator('#title')).toHaveValue('quarterly');
    });
});

test.describe('unnamed dropzone', () => {
    test('files are not submitted (no FormData entry)', async ({ page }) => {
        await stage(page, 'unnamed', ['ghost.txt']);
        await page.locator('#submit-unnamed').click();
        const text = await log(page, 'unnamed').textContent();
        // Only the text input shows up; no key for the dropzone
        expect(text).toContain('title:anon');
        expect(text).not.toContain('ghost.txt');
    });
});
