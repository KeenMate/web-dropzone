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
    test('image badges render with the show-thumbnails slot present', async ({ page }) => {
        await addPng(page, 'badges-thumb', 2);
        const badges = dz(page, 'badges-thumb').locator('.dz__badge');
        await expect(badges).toHaveCount(2);
        // The thumbnail/icon slot is part of every badge — the test just
        // verifies the slot element exists for image rows (the inner img
        // comes after FileReader resolves; we don't depend on that here).
        await expect(dz(page, 'badges-thumb').locator('.dz__badge-icon')).toHaveCount(2);
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
    // The host's `--dz-file-list-max-height` inline-style doesn't reach the
    // satellite renderer for the same reason --dz-rem doesn't — the
    // `<web-dropzone-list>` satellite's :host rule masks values set on the
    // parent. Real gap, tracked in COVERAGE §2 / §10.
    test.fixme('list container caps height via --dz-file-list-max-height (satellite propagation gap)', async () => {});
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
