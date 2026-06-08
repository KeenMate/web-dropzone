import { test, expect, Page, Locator } from '@playwright/test';

/**
 * Section 15 — card-size + display-mode shorthand + button badge.
 *
 * Fixture: test/appearance.html.
 *   - Three card-size variants (minimal / compact / big).
 *   - display-mode shorthand expansions (list / detailed / grid / compact).
 *   - Orthogonal attribute override precedence (display-mode loses).
 *   - Button selector with a post-add count badge.
 */

const PAGE = '/test/appearance.html';

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

test.describe('card-size variants', () => {
    test('minimal carries the dz__dropzone--card-minimal modifier', async ({ page }) => {
        await expect(dz(page, 'card-mini').locator('.dz__dropzone--card-minimal')).toBeVisible();
    });

    test('compact carries dz__dropzone--card-compact', async ({ page }) => {
        await expect(dz(page, 'card-compact').locator('.dz__dropzone--card-compact')).toBeVisible();
    });

    test('big carries dz__dropzone--card-big AND renders the Browse button', async ({ page }) => {
        const big = dz(page, 'card-big');
        await expect(big.locator('.dz__dropzone--card-big')).toBeVisible();
        await expect(big.locator('.dz__card__action')).toHaveText('Browse');
    });
});

test.describe('display-mode shorthand', () => {
    test('list → card + list', async ({ page }) => {
        const d = dz(page, 'dm-list');
        await addNamed(page, 'dm-list', ['a.txt']);
        await expect(d.locator('.dz__dropzone--card')).toBeVisible();
        await expect(d.locator('.dz__file-item--list')).toHaveCount(1);
    });

    test('detailed → card + detailed', async ({ page }) => {
        const d = dz(page, 'dm-detailed');
        await addNamed(page, 'dm-detailed', ['a.txt']);
        await expect(d.locator('.dz__file-item--detailed')).toHaveCount(1);
    });

    test('grid → card + grid (image preview tiles)', async ({ page }) => {
        const d = dz(page, 'dm-grid');
        await page.evaluate(() => {
            const dz = document.getElementById('dm-grid') as any;
            dz.addFiles([new File([new Uint8Array(8)], 'p.png', { type: 'image/png' })]);
        });
        await expect(d.locator('.dz__preview-item')).toHaveCount(1);
    });

    test('compact → card + popover (summary line)', async ({ page }) => {
        const d = dz(page, 'dm-compact');
        await addNamed(page, 'dm-compact', ['a.txt', 'b.txt']);
        await expect(d.locator('.dz__summary__line')).toBeVisible();
    });
});

test.describe('orthogonal attr wins over display-mode shorthand', () => {
    test('display-mode="grid" + list-appearance="badges" → renders badges, not grid', async ({ page }) => {
        const d = dz(page, 'override');
        await addNamed(page, 'override', ['a.txt', 'b.txt']);
        // The explicit list-appearance wins
        await expect(d.locator('.dz__badge')).toHaveCount(2);
        // ...and grid does NOT render
        await expect(d.locator('.dz__preview-item')).toHaveCount(0);
    });
});

test.describe('button selector count badge', () => {
    test('badge appears after files are added and reflects the count', async ({ page }) => {
        const b = dz(page, 'button-badge');
        // Empty state: no badge
        await expect(b.locator('.dz__button__badge')).toHaveCount(0);

        await addNamed(page, 'button-badge', ['a.txt', 'b.txt', 'c.txt']);
        await expect(b.locator('.dz__button__badge')).toHaveText('3');
    });
});
