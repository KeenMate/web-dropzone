import { test, expect, Page, Locator } from '@playwright/test';

/**
 * Section 12 — CSS variable theming.
 *
 * Fixture: test/theming.html. Each dropzone applies a different theming
 * vector — --dz-rem scaling, individual --dz-* overrides, --base-*
 * integration, disabled state, RTL. Specs assert via getComputedStyle
 * on the shadow-DOM nodes rather than poking at internal class names.
 */

const PAGE = '/test/theming.html';

function dz(page: Page, id: string): Locator {
    return page.locator(`#${id}`);
}

async function cssvar(page: Page, id: string, name: string): Promise<string> {
    return page.evaluate(
        ({ id, name }) => (window as any).__cssvar(id, name),
        { id, name }
    );
}

test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForFunction(() => typeof (window as any).__cssvar === 'function');
});

test.describe('--dz-rem scaling', () => {
    test('small / default / big set --dz-rem to 8 / 10 / 14 px', async ({ page }) => {
        expect(await cssvar(page, 'scaled-small', '--dz-rem')).toBe('8px');
        // Default leaves it unset on the host (resolves via :host default rule)
        // — we just verify it's NOT 8 or 14.
        const def = await cssvar(page, 'scaled-default', '--dz-rem');
        expect(['', '10px']).toContain(def);
        expect(await cssvar(page, 'scaled-big', '--dz-rem')).toBe('14px');
    });

    // The satellite picker's own CSS carries `:host { --dz-rem: 10px }` in
    // its shadow root, which masks any value set on the parent <web-dropzone>
    // host element. Real-world theming via `--dz-rem` therefore only takes
    // effect when set at a SCOPE ABOVE the satellite (e.g. body, a wrapper
    // div). This is a known gap, tracked in COVERAGE §10. The cssvar set on
    // the host IS confirmed by the earlier test in this block — only the
    // propagation through the satellite is broken.
    test.fixme('icon size scales with --dz-rem (satellite :host override gap)', async () => {});
});

test.describe('individual --dz-* override', () => {
    test('overrides apply to the host element', async ({ page }) => {
        expect(await cssvar(page, 'dz-override', '--dz-dropzone-padding')).toBe('48px');
        expect(await cssvar(page, 'dz-override', '--dz-dropzone-icon-size')).toBe('64px');
    });
});

test.describe('--base-* integration', () => {
    test('base-* variables are readable on the host', async ({ page }) => {
        expect(await cssvar(page, 'base-themed', '--base-accent-color')).toBe('rgb(20, 184, 166)');
        expect(await cssvar(page, 'base-themed', '--base-text-color-1')).toBe('rgb(15, 23, 42)');
        expect(await cssvar(page, 'base-themed', '--base-border-color')).toBe('rgb(125, 211, 252)');
        expect(await cssvar(page, 'base-themed', '--base-input-background')).toBe('rgb(240, 253, 250)');
    });
});

test.describe('disabled state', () => {
    test('disabled host renders the dz__dropzone--disabled modifier class', async ({ page }) => {
        // The class lives in the picker satellite's shadow root; Playwright's
        // locator auto-pierces both shadow boundaries.
        await expect(dz(page, 'disabled-dz').locator('.dz__dropzone--disabled')).toHaveCount(1);
    });

    test('disabled element ignores programmatic addFiles? No — programmatic still works (disabled blocks UI only)', async ({ page }) => {
        // Verifying the documented behavior: `disabled` is a UI gate, not a
        // store gate. addFiles called from JS still populates the queue.
        await dz(page, 'disabled-dz').evaluate((el: any) =>
            el.addFiles([new File(['x'], 'p.txt')])
        );
        const count = await dz(page, 'disabled-dz').evaluate((el: any) => el.files.length);
        expect(count).toBe(1);
    });
});

test.describe('RTL layout', () => {
    test('host inside dir="rtl" parent inherits the direction', async ({ page }) => {
        const dir = await dz(page, 'rtl-dz').evaluate((el: any) =>
            getComputedStyle(el).direction
        );
        expect(dir).toBe('rtl');
    });
});
