import { test, expect, Page, Locator } from '@playwright/test';

/**
 * Section 18 — indicator + progress satellites.
 *
 * Fixture: test/satellites-extra.html. Two headless stores each
 * paired with one of the read-only satellites:
 *
 *   - <web-dropzone-indicator for=> renders a status chip driven by
 *     the store's per-status aggregate.
 *   - <web-dropzone-progress for=> reflects getOverallProgress
 *     (counts + percent).
 *
 * Both satellites should resolve their `for=` reference, bind to the
 * store on `store-ready`, and reflect every change as files are
 * added / progressed / completed.
 */

const PAGE = '/test/satellites-extra.html';

function dz(page: Page, id: string): Locator {
    return page.locator(`#${id}`);
}

async function addNamed(page: Page, id: string, names: string[]): Promise<void> {
    await page.evaluate(({ id, names }) => (window as any).__addNamed(id, names), { id, names });
}

async function pendingNames(page: Page): Promise<string[]> {
    return page.evaluate(() => (window as any).__pendingNames());
}

async function pumpProgress(page: Page, name: string, pct: number): Promise<void> {
    await page.evaluate(({ name, pct }) => (window as any).__progress(name, pct), { name, pct });
}

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => typeof (window as any).__addNamed === 'function');
});

test.describe('<web-dropzone-indicator>', () => {
    test('binds to its for= store after store-ready', async ({ page }) => {
        await expect.poll(() => page.evaluate(() => {
            const el = document.querySelector('web-dropzone-indicator') as any;
            return !!el?.getStore?.();
        })).toBe(true);
    });

    test('renders a chip surface inside its shadow root after binding', async ({ page }) => {
        await addNamed(page, 'store-ind', ['a.txt', 'b.txt']);
        // The indicator's shadow renders an inner chip surface; locate one
        // of its known structural classes.
        const chip = page.locator('web-dropzone-indicator').locator('.dz__indicator__chip');
        await expect(chip).toBeVisible();
    });
});

test.describe('<web-dropzone-progress>', () => {
    test('binds to its for= store after store-ready', async ({ page }) => {
        await expect.poll(() => page.evaluate(() => {
            const el = document.querySelector('web-dropzone-progress') as any;
            return !!el?.getStore?.();
        })).toBe(true);
    });

    test('renders a progress surface inside its shadow root after binding', async ({ page }) => {
        await addNamed(page, 'store-prog', ['p1.txt', 'p2.txt']);
        // The progress satellite renders an outer container after binding —
        // locate its top-level structural class.
        const surface = page.locator('web-dropzone-progress').locator('.dz__overall-progress');
        await expect(surface).toBeVisible();
    });
});
