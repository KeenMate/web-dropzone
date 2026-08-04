import { describe, it, expect, afterEach } from 'vitest';
import '../../src/web-component'; // registers <web-dropzone>

/**
 * Guards the `BlissElement` input-table wiring that replaced the hand-rolled
 * ATTRIBUTE_TABLE in the core migration: attribute → typed config (via the
 * converters), the historical camelCase public getters/setters (the 7
 * `is*`-renamed booleans + the tristate `showThumbnails`), property→attribute
 * reflection, and the coalesced-write settle signal.
 *
 * All detached (no connect) — `#stage` updates the merged config synchronously,
 * so the public getters read the new value immediately; this avoids building the
 * store in happy-dom (that path is covered by the Playwright e2e suite).
 */

let el: any;

afterEach(() => {
    el?.remove();
    el = undefined;
});

describe('<web-dropzone> input table (BlissElement)', () => {
    it('seeds converter defaults', () => {
        el = document.createElement('web-dropzone');
        expect(el.maxVisibleFiles).toBe(7);   // toInt({ default: 7 })
        expect(el.maxFileCount).toBe(0);       // toInt({ default: 0 })
        expect(el.displayMode).toBe('list');   // toEnum default 'list'
        expect(el.valueFormat).toBe('json');   // toEnum default 'json'
        expect(el.multiple).toBe(true);        // toBool('default-true')
        expect(el.disabled).toBe(false);       // toBool('default-false')
        expect(el.showThumbnails).toBeUndefined(); // toBool('tristate') → unset
    });

    it('parses attributes through their converters', () => {
        el = document.createElement('web-dropzone');
        el.setAttribute('max-file-count', '5');
        expect(el.maxFileCount).toBe(5);       // toInt
        el.setAttribute('max-file-size', '5MB');
        expect(el.maxFileSize).toBe(5 * 1024 * 1024); // toCustom(parseBytes) — binary units + aliases
        el.setAttribute('display-mode', 'grid');
        expect(el.displayMode).toBe('grid');   // toEnum
        el.setAttribute('display-mode', 'bogus');
        expect(el.displayMode).toBe('list');   // invalid enum → default
    });

    it('maps the renamed boolean attributes to their public camelCase getters', () => {
        el = document.createElement('web-dropzone');
        el.setAttribute('multiple', 'false');
        expect(el.multiple).toBe(false);          // isMultipleEnabled, default-true
        el.setAttribute('disabled', '');
        expect(el.disabled).toBe(true);           // isDisabled, default-false
        el.setAttribute('show-thumbnails', 'false');
        expect(el.showThumbnails).toBe(false);    // isShowThumbnailsEnabled, tristate
        el.setAttribute('show-thumbnails', '');
        expect(el.showThumbnails).toBe(true);
    });

    it('reflects a property write back to its attribute', () => {
        el = document.createElement('web-dropzone');
        el.maxFileCount = 3;
        expect(el.getAttribute('max-file-count')).toBe('3'); // reflect: true
        expect(el.maxFileCount).toBe(3);
    });

    it('the boolean alias setters write the attribute (and read back)', () => {
        el = document.createElement('web-dropzone');
        el.multiple = false;
        expect(el.getAttribute('multiple')).toBe('false');
        expect(el.multiple).toBe(false);
        el.disabled = true;
        expect(el.hasAttribute('disabled')).toBe(true);
        expect(el.disabled).toBe(true);
        el.showThumbnails = undefined;
        expect(el.hasAttribute('show-thumbnails')).toBe(false); // tristate unset → removed
        expect(el.showThumbnails).toBeUndefined();
    });

    it('coalesces a property write and settles (connected)', async () => {
        // whenSettled() only resolves once a flush runs, and flushes are HELD
        // while detached — so connect first (this builds the store), then the
        // coalesced update flush resolves the settle promise.
        el = document.createElement('web-dropzone');
        document.body.appendChild(el);
        el.promptText = 'Drop here';
        expect(el.promptText).toBe('Drop here'); // merged config updates synchronously
        await expect(el.whenSettled()).resolves.toBeUndefined();
    });
});
