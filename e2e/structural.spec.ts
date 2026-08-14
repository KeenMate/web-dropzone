import { test, expect, Page, Locator } from '@playwright/test';

/**
 * Section 9 — structural mode (mode="structural").
 *
 * Fixture: test/structural.html. Five dropzones cover the four
 * render callbacks plus the hard-switch contract (callbacks are
 * ignored when mode != "structural").
 */

const PAGE = '/test/structural.html';

function dz(page: Page, id: string): Locator {
    return page.locator(`#${id}`);
}

async function addNamed(page: Page, id: string, names: string[]): Promise<void> {
    await page.evaluate(({ id, names }) => (window as any).__addNamed(id, names), { id, names });
}

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => typeof (window as any).__addNamed === 'function');
});

test.describe('renderPromptCallback', () => {
    test('replaces the card prompt with the callback HTML', async ({ page }) => {
        await expect(dz(page, 'prompt-cb').locator('.custom-prompt')).toBeVisible();
        await expect(dz(page, 'prompt-cb').locator('.custom-prompt')).toHaveText('CUSTOM PROMPT');
    });
});

test.describe('renderFileItemCallback (string return)', () => {
    test('renders the callback markup per file', async ({ page }) => {
        await addNamed(page, 'item-str', ['a.txt', 'b.txt']);
        const rows = dz(page, 'item-str').locator('.my-row');
        await expect(rows).toHaveCount(2);
        await expect(rows.first()).toHaveText('STR:a.txt');
    });
});

test.describe('renderFileItemCallback (HTMLElement return)', () => {
    test('renders the returned element directly', async ({ page }) => {
        await addNamed(page, 'item-el', ['x.txt']);
        const rows = dz(page, 'item-el').locator('.my-row-el');
        await expect(rows).toHaveCount(1);
        await expect(rows.first()).toContainText('EL:x.txt');
    });

    test('file-row-update fires on the cached element (listener survives)', async ({ page }) => {
        await addNamed(page, 'item-el', ['y.txt']);
        // Trigger something that re-emits a row update: setting status via
        // a force-progress flush works. For now we just nudge progress.
        await dz(page, 'item-el').evaluate((el: any) => {
            const f = el.files[0];
            el.updateFileProgress(f.id, 50);
        });
        const updates = await page.evaluate(() =>
            Array.from((window as any).__updateCounts.values()).reduce((a: any, b: any) => a + b, 0)
        );
        expect(updates).toBeGreaterThanOrEqual(1);
    });
});

test.describe('renderListWrapperCallback', () => {
    test('wraps rows in the callback markup (table layout)', async ({ page }) => {
        await addNamed(page, 'wrapper', ['p.txt', 'q.txt']);
        const wrap = dz(page, 'wrapper');
        await expect(wrap.locator('table.my-table')).toBeVisible();
        await expect(wrap.locator('table.my-table tbody tr')).toHaveCount(2);
        await expect(wrap.locator('table.my-table tbody tr').first()).toContainText('WRAP:p.txt');
    });
});

test.describe('callbacks ignored when mode != "structural"', () => {
    test('renderFileItemCallback set on a non-structural dropzone is a no-op', async ({ page }) => {
        await addNamed(page, 'ignored', ['z.txt']);
        const ig = dz(page, 'ignored');
        // The custom .should-be-ignored class must not exist
        await expect(ig.locator('.should-be-ignored')).toHaveCount(0);
        // The framework default rendering produces .dz__file-item--list rows
        await expect(ig.locator('.dz__file-item--list')).toHaveCount(1);
    });
});

test.describe('structural + badges + show-thumbnails (built-in inline template)', () => {
    test('previewUrl swaps the badge icon to an <img> via the inline patch path', async ({ page }) => {
        await page.waitForFunction(() => typeof (window as any).__addPng === 'function');
        await page.evaluate(() => (window as any).__addPng('str-badge-thumb', 2));
        const d = dz(page, 'str-badge-thumb');
        await expect(d.locator('.dz__badge')).toHaveCount(2);
        // Regression: the structural inline path (patchInlineRowInPlace) must
        // swap the badge icon slot to a real <img> when the async previewUrl
        // lands — not leave the file-type icon fallback.
        const imgs = d.locator('.dz__badge-icon img');
        await expect(imgs).toHaveCount(2);
        await expect(imgs.first()).toHaveAttribute('src', /^data:image\//);
    });
});
