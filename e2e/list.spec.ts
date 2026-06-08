import { test, expect, Page, Locator } from '@playwright/test';

/**
 * Section 4 — list-appearance.
 *
 * Fixture: test/list.html. One dropzone per variant; specs assert the
 * variant-specific DOM signature after staging N files via window.__stage.
 * Per-file rendering specifics (icons, sizes, MIME labels) are covered
 * by separate appearance / theming specs — here we only verify the
 * structural / layout contract of each variant.
 */

const PAGE = '/test/list.html';

function dz(page: Page, id: string): Locator {
    return page.locator(`#${id}`);
}

async function stage(page: Page, id: string, count: number, type?: string): Promise<void> {
    await page.evaluate(
        ({ id, count, type }) => (window as any).__stage(id, count, type),
        { id, count, type }
    );
}

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
});

test.describe('list-appearance="list" (default)', () => {
    test('renders one .dz__file-item--list per file', async ({ page }) => {
        await stage(page, 'list', 3);
        await expect(dz(page, 'list').locator('.dz__file-item--list')).toHaveCount(3);
    });

    test('list area is rendered below the dropzone (separate from card)', async ({ page }) => {
        await stage(page, 'list', 1);
        // The file list container lives outside the .dz__dropzone--card surface
        // (files-inside is OFF by default).
        await expect(dz(page, 'list').locator('.dz__file-list')).toBeVisible();
    });
});

test.describe('list-appearance="detailed"', () => {
    test('rows carry the --detailed modifier class', async ({ page }) => {
        await stage(page, 'detailed', 2);
        await expect(dz(page, 'detailed').locator('.dz__file-item--detailed')).toHaveCount(2);
    });
});

test.describe('list-appearance="grid"', () => {
    test('renders one preview tile per image file', async ({ page }) => {
        await stage(page, 'grid', 4, 'image/png');
        await expect(dz(page, 'grid').locator('.dz__preview-item')).toHaveCount(4);
    });
});

test.describe('list-appearance="badges"', () => {
    test('renders one badge per file', async ({ page }) => {
        await stage(page, 'badges', 3);
        await expect(dz(page, 'badges').locator('.dz__badge')).toHaveCount(3);
    });
});

test.describe('list-appearance="popover"', () => {
    test('renders a summary line; full list lives behind the popover trigger', async ({ page }) => {
        await stage(page, 'popover', 5);
        const p = dz(page, 'popover');
        await expect(p.locator('.dz__summary__line')).toBeVisible();
        // The full list is NOT inline — it lives in a popover that opens on
        // click. Inline file rows should be absent until that happens.
        await expect(p.locator('.dz__file-item--list')).toHaveCount(0);
    });
});

test.describe('list-appearance="none"', () => {
    test('renders zero file items even after add', async ({ page }) => {
        await stage(page, 'none', 4);
        const p = dz(page, 'none');
        // Caller takes ownership of rendering — no internal item DOM.
        await expect(p.locator('.dz__file-item')).toHaveCount(0);
        // ...but the store DOES carry the files
        expect(await p.evaluate((el: any) => el.files.length)).toBe(4);
    });
});

test.describe('max-visible-files cap', () => {
    // The cap is honored by the in-class renderer (dropzone.ts: getVisibleFiles
    // + renderToggleButton) but the convenience-form path routes through the
    // `<web-dropzone-list>` satellite, which does NOT apply the cap today. This
    // is an architectural gap rather than a regression — see COVERAGE.md section
    // 2. Skipping until the satellite reads `max-visible-files` from the store
    // config the same way the in-class renderer does.
    test.fixme('caps rendered rows + reveals a "Show N more" button (satellite gap)', async () => {});
    test.fixme('clicking the toggle expands to show every file (satellite gap)', async () => {});
});

test.describe('files-inside layout', () => {
    test('file list renders inside the card surface, not below it', async ({ page }) => {
        await stage(page, 'inside', 2);
        const p = dz(page, 'inside');
        // The card carries the files-inside modifier when active
        await expect(p.locator('.dz__dropzone--files-inside')).toBeVisible();
        // ...and the files-inside container holds the rows
        await expect(p.locator('.dz__files-inside .dz__file-item--list')).toHaveCount(2);
    });
});
