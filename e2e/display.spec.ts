import { test, expect, Page, Locator } from '@playwright/test';

/**
 * Section 1 — selector-appearance.
 *
 * Fixture: test/display.html. Five dropzones, one per appearance variant
 * (plus a localized native to verify no-file-chosen-text + select-files-text).
 */

const PAGE = '/test/display.html';

function dz(page: Page, id: string): Locator {
    return page.locator(`#${id}`);
}

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
});

test.describe('selector-appearance="card" (default)', () => {
    test('renders the bordered drop-zone card', async ({ page }) => {
        const card = dz(page, 'card');
        await expect(card.locator('.dz__dropzone--card')).toBeVisible();
    });

    test('exposes a hidden <input type="file"> for the click fallback', async ({ page }) => {
        const card = dz(page, 'card');
        await expect(card.locator('input[type="file"].dz__dropzone__input')).toHaveCount(1);
    });
});

test.describe('selector-appearance="button"', () => {
    test('renders the accent button with the select-files-text label', async ({ page }) => {
        const btn = dz(page, 'button');
        await expect(btn.locator('.dz__button')).toBeVisible();
        await expect(btn.locator('.dz__button__label')).toHaveText('Pick files');
    });

    test('does NOT render the card drop-zone surface', async ({ page }) => {
        const btn = dz(page, 'button');
        await expect(btn.locator('.dz__dropzone--card')).toHaveCount(0);
    });
});

test.describe('selector-appearance="minimal"', () => {
    test('renders the icon-only button', async ({ page }) => {
        const min = dz(page, 'minimal');
        await expect(min.locator('.dz__minimal')).toBeVisible();
        await expect(min.locator('.dz__minimal__icon')).toHaveText('📎');
    });

    test('badge is hidden when no files', async ({ page }) => {
        const min = dz(page, 'minimal');
        await expect(min.locator('.dz__minimal__badge')).toHaveCount(0);
    });
});

test.describe('selector-appearance="native"', () => {
    test('renders button + plain-text label', async ({ page }) => {
        const nat = dz(page, 'native');
        await expect(nat.locator('.dz__dropzone--native')).toBeVisible();
        await expect(nat.locator('.dz__native__button')).toHaveText('Choose Files');
        await expect(nat.locator('.dz__native__label')).toHaveText('No file chosen');
    });

    test('label updates after programmatic add', async ({ page }) => {
        const nat = dz(page, 'native');
        await nat.evaluate((el: any) => {
            el.addFiles([new File(['x'], 'report.pdf', { type: 'application/pdf' })]);
        });
        await expect(nat.locator('.dz__native__label')).toHaveText('report.pdf');
    });

    test('multi-file label uses "N files chosen"', async ({ page }) => {
        const nat = dz(page, 'native');
        await nat.evaluate((el: any) => {
            el.addFiles([
                new File(['x'], 'a.txt'),
                new File(['y'], 'b.txt'),
                new File(['z'], 'c.txt')
            ]);
        });
        await expect(nat.locator('.dz__native__label')).toHaveText('3 files chosen');
    });
});

test.describe('native + custom no-file-chosen-text', () => {
    test('renders the localized empty-state label', async ({ page }) => {
        const i18n = dz(page, 'native-i18n');
        await expect(i18n.locator('.dz__native__button')).toHaveText('Vybrat soubory');
        await expect(i18n.locator('.dz__native__label')).toHaveText('Žádný soubor');
    });
});
