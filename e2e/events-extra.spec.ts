import { test, expect, Page, Locator } from '@playwright/test';

/**
 * Section 17 — file-updated, file-row-update, renderSummaryCallback.
 *
 * Fixture: test/events-extra.html.
 *
 *   - file-updated covers any FileState field write OTHER than
 *     progress/status (which have their own events). Fires from
 *     generatePreview (previewUrl) and the upload handler's post-success
 *     merge (metadata / downloadUrl / name).
 *
 *   - file-row-update is the bridge for element-returning row callbacks:
 *     the framework caches the element across state ticks and dispatches
 *     this event on it instead of replacing the node. Listeners attached
 *     during initial render survive every tick.
 *
 *   - renderSummaryCallback (mode="structural" + list-appearance="popover")
 *     replaces the inline summary line that opens the popover.
 */

const PAGE = '/test/events-extra.html';

function dz(page: Page, id: string): Locator {
    return page.locator(`#${id}`);
}

async function addNamed(page: Page, id: string, names: string[]): Promise<void> {
    await page.evaluate(({ id, names }) => (window as any).__addNamed(id, names), { id, names });
}

async function pendingNames(page: Page): Promise<string[]> {
    return page.evaluate(() => (window as any).__pendingNames());
}

async function resolveUpload(page: Page, name: string, value?: any): Promise<void> {
    await page.evaluate(({ name, value }) => (window as any).__resolve(name, value), { name, value });
}

async function pumpProgress(page: Page, name: string, pct: number): Promise<void> {
    await page.evaluate(({ name, pct }) => (window as any).__progress(name, pct), { name, pct });
}

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => typeof (window as any).__addNamed === 'function');
});

test.describe('file-updated', () => {
    test('fires when the upload handler post-merges metadata onto the FileState', async ({ page }) => {
        await addNamed(page, 'updated', ['m.txt']);
        await expect.poll(() => pendingNames(page)).toContain('m.txt');
        // Handler resolves with { metadata } — the store merges and fires
        // file-updated.
        await resolveUpload(page, 'm.txt', { metadata: { uploadId: 'abc' } });
        await expect(page.locator('#updated-log')).toContainText('updated m.txt');
    });
});

test.describe('file-row-update', () => {
    test('progress ticks dispatch file-row-update on the cached element', async ({ page }) => {
        await addNamed(page, 'row-update', ['p.txt']);
        await expect.poll(() => pendingNames(page)).toContain('p.txt');

        await pumpProgress(page, 'p.txt', 30);
        await pumpProgress(page, 'p.txt', 60);

        const events = await page.evaluate(() => (window as any).__rowUpdateLog);
        // The listener attached at first render received at least 2 ticks.
        expect(events.length).toBeGreaterThanOrEqual(2);
        const lastProgress = events[events.length - 1].progress;
        expect(lastProgress).toBe(60);
    });
});

test.describe('renderSummaryCallback', () => {
    test('replaces the popover summary line with the callback markup', async ({ page }) => {
        await addNamed(page, 'summary-cb', ['a.txt', 'b.txt']);
        const sum = dz(page, 'summary-cb').locator('.custom-summary');
        await expect(sum).toBeVisible();
        await expect(sum).toContainText('★ 2 pinned');
    });
});
