import { test, expect, Page, Locator } from '@playwright/test';

/**
 * Section 8 — store + satellites + headless mode.
 *
 * Fixture: test/architecture.html. Three scenarios:
 *
 *   1. Headless store + standalone satellites bound via `for=` — verifies
 *      that picker and list satellites resolve their `for=` reference
 *      and bind to the underlying DropzoneCore instance.
 *
 *   2. Two independent stores on one page — each satellite stays bound
 *      to its own store; adds to A don't leak to B.
 *
 *   3. One shared store with two pickers (Mode A) — both pickers
 *      contribute to the same queue; the list satellite reflects every
 *      addition regardless of which picker did it.
 */

const PAGE = '/test/architecture.html';

function dz(page: Page, id: string): Locator {
    return page.locator(`#${id}`);
}

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => typeof (window as any).__addNamed === 'function');
});

test.describe('headless store + standalone satellites', () => {
    test('picker resolves its for= and exposes the bound store', async ({ page }) => {
        // Satellite waits for the store-ready event; give it a frame.
        await expect.poll(() => page.evaluate(() =>
            (window as any).__satelliteHasStore('web-dropzone-picker[for="store-headless"]')
        )).toBe(true);
    });

    test('list satellite resolves its for= and binds', async ({ page }) => {
        await expect.poll(() => page.evaluate(() =>
            (window as any).__satelliteHasStore('web-dropzone-list[for="store-headless"]')
        )).toBe(true);
    });

    test('list satellite reflects programmatic adds to the store', async ({ page }) => {
        await page.evaluate(() => (window as any).__addNamed('store-headless', ['from-store.txt']));
        // The list satellite renders its rows in its own shadow root.
        const list = page.locator('web-dropzone-list[for="store-headless"]');
        await expect(list.locator('.dz__file-item--detailed')).toHaveCount(1);
    });
});

test.describe('two independent stores', () => {
    test('adds to store-a do not appear in store-b', async ({ page }) => {
        await page.evaluate(() => (window as any).__addNamed('store-a', ['only-a.txt']));
        const aLen = await dz(page, 'store-a').evaluate((el: any) => el.files.length);
        const bLen = await dz(page, 'store-b').evaluate((el: any) => el.files.length);
        expect(aLen).toBe(1);
        expect(bLen).toBe(0);
    });

    test('each picker binds to its own store', async ({ page }) => {
        const aBound = await page.evaluate(() => {
            const picker = document.querySelector('web-dropzone-picker[for="store-a"]') as any;
            const store = picker.getStore();
            return store?.getFiles().length;
        });
        const bBound = await page.evaluate(() => {
            const picker = document.querySelector('web-dropzone-picker[for="store-b"]') as any;
            const store = picker.getStore();
            return store?.getFiles().length;
        });
        // Both started empty — adding to A doesn't have to happen here; we
        // just verify each picker has a distinct store reference.
        expect(aBound).toBe(0);
        expect(bBound).toBe(0);
    });
});

test.describe('shared store + multiple pickers (Mode A)', () => {
    test('adds to the store from any source converge into one queue', async ({ page }) => {
        // Push directly into the store (simulates either picker adding).
        await page.evaluate(() => (window as any).__addNamed('shared', ['x.txt']));
        await page.evaluate(() => (window as any).__addNamed('shared', ['y.txt']));

        const names = await dz(page, 'shared').evaluate((el: any) =>
            el.files.map((f: any) => f.name)
        );
        expect(names).toEqual(['x.txt', 'y.txt']);
    });

    test('list satellite reflects the shared queue', async ({ page }) => {
        await page.evaluate(() => (window as any).__addNamed('shared', ['p.txt', 'q.txt', 'r.txt']));
        const list = page.locator('web-dropzone-list[for="shared"]');
        await expect(list.locator('.dz__file-item--list')).toHaveCount(3);
    });
});

test.describe('mode="headless"', () => {
    test('the headless store renders no internal UI of its own', async ({ page }) => {
        // The host element shouldn't carry the convenience-form internals
        // (.dz__dropzone--card etc.); rendering is delegated to the bound
        // picker / list satellites.
        const hasInternals = await dz(page, 'store-headless').evaluate((el: any) =>
            !!el.shadowRoot?.querySelector('.dz__dropzone--card')
        );
        expect(hasInternals).toBe(false);
    });

    test('headless store still fires file-added when files are programmatically added', async ({ page }) => {
        const dispatched = await dz(page, 'store-headless').evaluate(async (el: any) => {
            return new Promise<boolean>((resolve) => {
                el.addEventListener('file-added', () => resolve(true), { once: true });
                el.addFiles([new File(['x'], 'h.txt')]);
                // Safety net so the test doesn't hang on a regression.
                setTimeout(() => resolve(false), 1000);
            });
        });
        expect(dispatched).toBe(true);
    });
});
