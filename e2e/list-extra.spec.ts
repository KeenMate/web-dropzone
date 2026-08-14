import { test, expect, Page, Locator } from '@playwright/test';

/**
 * Section 19 — remaining list-appearance variants.
 *
 * Fixture: test/list-extra.html. Covers:
 *   - badges + show-thumbnails (image badges with thumbnail slot)
 *   - rolling (single "front file" row + queue button)
 *   - --dz-file-list-max-height (internal scroll cap)
 *   - popover content interaction (click summary → list visible)
 */

const PAGE = '/test/list-extra.html';

function dz(page: Page, id: string): Locator {
    return page.locator(`#${id}`);
}

async function addNamed(page: Page, id: string, names: string[]): Promise<void> {
    await page.evaluate(({ id, names }) => (window as any).__addNamed(id, names), { id, names });
}

async function addPng(page: Page, id: string, count: number): Promise<void> {
    await page.evaluate(({ id, count }) => (window as any).__addPng(id, count), { id, count });
}

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => typeof (window as any).__addNamed === 'function');
});

test.describe('badges + show-thumbnails', () => {
    test('image badges render a thumbnail <img> in the icon slot', async ({ page }) => {
        await addPng(page, 'badges-thumb', 2);
        const d = dz(page, 'badges-thumb');
        await expect(d.locator('.dz__badge')).toHaveCount(2);
        await expect(d.locator('.dz__badge-icon')).toHaveCount(2);
        // Regression: `show-thumbnails` must produce an actual <img> preview,
        // not the file-type icon fallback. The previewUrl lands asynchronously
        // (FileReader → data URL → store `file-updated`), so wait for the swap.
        const imgs = d.locator('.dz__badge-icon img');
        await expect(imgs).toHaveCount(2);
        // And the <img> points at a decoded data URL, not an empty src.
        await expect(imgs.first()).toHaveAttribute('src', /^data:image\//);
    });
});

test.describe('list-appearance="rolling"', () => {
    test('renders a single front-file slot + a queue indicator', async ({ page }) => {
        await addNamed(page, 'rolling', ['a.txt', 'b.txt', 'c.txt']);
        const r = dz(page, 'rolling');
        // Single "front file" surface
        await expect(r.locator('.dz__rolling__current')).toBeVisible();
        // Queue indicator (button + count)
        await expect(r.locator('.dz__rolling__queue')).toBeVisible();
        await expect(r.locator('.dz__rolling__queue-count')).toBeVisible();
    });
});

test.describe('--dz-file-list-max-height', () => {
    test('list container caps its height; scrollHeight exceeds visible height', async ({ page }) => {
        await addNamed(page, 'height-cap', ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
        const list = dz(page, 'height-cap').locator('.dz__file-list');
        const heights = await list.evaluate((el: any) => ({
            client: el.clientHeight,
            scroll: el.scrollHeight
        }));
        expect(heights.client).toBeLessThan(heights.scroll);
        expect(heights.client).toBeLessThanOrEqual(120);
    });
});

test.describe('popover content', () => {
    test('clicking the summary opens the popover with one row per file', async ({ page }) => {
        await addNamed(page, 'popover-open', ['p1.txt', 'p2.txt', 'p3.txt']);
        const p = dz(page, 'popover-open');
        await p.locator('.dz__summary__line').click();

        // Popover container becomes visible; row elements are
        // .dz__popover__row inside the popover body.
        await expect(p.locator('.dz__popover')).toBeVisible();
        await expect(p.locator('.dz__popover__row')).toHaveCount(3);
    });
});
