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

test.describe('CSS-var relay into managed satellites', () => {
    // Regression: the internal <web-dropzone-list> has its own shadow root that
    // injects the same variables.css. A plain `:host { --dz-*: … }` there would
    // mask tokens set on the store host, so `--dz-preview-grid-*` on
    // <web-dropzone> never reached the grid. The fix marks auto-mounted
    // satellites `managed` and scopes the token block to :host(:not([managed]))
    // so they inherit from the store host instead. This asserts the cascade.
    test('store-host --dz-preview-grid-* reaches the internal grid container', async ({ page }) => {
        await addPng(page, 'grid-relay', 6);
        const props = await dz(page, 'grid-relay').evaluate((el: any) => {
            const list = el.shadowRoot.querySelector('web-dropzone-list');
            const grid = list.shadowRoot.querySelector('.dz__file-list--grid');
            const cs = getComputedStyle(grid);
            return { gap: cs.gap, tracks: cs.gridTemplateColumns.split(' ').length };
        });
        // Host inline sets gap:40px and columns:repeat(3,1fr). If the satellite
        // re-declared its own :host defaults these would be 12px / 4-ish tracks.
        expect(props.gap).toBe('40px');
        expect(props.tracks).toBe(3);
    });
});

test.describe('grid-layout="natural" (equal-height justified gallery)', () => {
    test('rows share one height; tiles keep each image aspect ratio (no crop/stretch)', async ({ page }) => {
        // A landscape (200×100) and a portrait (100×200) image.
        await page.waitForFunction(() => typeof (window as any).__addSizedImages === 'function');
        await page.evaluate(() => (window as any).__addSizedImages('grid-natural', [[200, 100], [100, 200]]));
        const info = await dz(page, 'grid-natural').evaluate((el: any) => {
            const list = el.shadowRoot.querySelector('web-dropzone-list');
            const grid = list.shadowRoot.querySelector('.dz__file-list--grid');
            const tiles = [...grid.querySelectorAll('.dz__preview-item')];
            return {
                layoutAttr: grid.getAttribute('data-grid-layout'),
                display: getComputedStyle(grid).display,
                rects: tiles.map((t: any) => {
                    const r = t.getBoundingClientRect();
                    return { w: Math.round(r.width), h: Math.round(r.height) };
                }),
            };
        });
        expect(info.layoutAttr).toBe('natural');
        expect(info.display).toBe('flex');
        expect(info.rects).toHaveLength(2);
        // Equal height (the row height = 120px), different widths matching the
        // 2:1 and 1:2 ratios → landscape tile is wider than the portrait tile.
        expect(info.rects[0].h).toBe(info.rects[1].h);
        expect(info.rects[0].h).toBe(120);
        expect(info.rects[0].w).toBeGreaterThan(info.rects[1].w);   // landscape wider
        expect(info.rects[0].w).toBeCloseTo(240, -1);               // 120 × 2:1
        expect(info.rects[1].w).toBeCloseTo(60, -1);                // 120 × 1:2
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
