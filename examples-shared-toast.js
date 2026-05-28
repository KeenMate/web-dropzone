/**
 * examples-shared-toast.js
 *
 * Minimal in-page toast service for the demo pages. Vanilla JS, no deps,
 * one file. Drop in via <script src="examples-shared-toast.js"></script>.
 *
 * API:
 *   toast.info(message, opts?)
 *   toast.success(message, opts?)
 *   toast.warn(message, opts?)
 *   toast.error(message, opts?)
 *
 *   opts.timeout — ms before auto-dismiss (default 4500; 0 = sticky)
 *   opts.title   — optional bold title above the body
 *
 * Toasts stack bottom-right and dismiss on click or after timeout.
 */
(function () {
    'use strict';

    const STYLE_ID = 'examples-shared-toast-style';
    const STACK_ID = 'examples-shared-toast-stack';
    const DEFAULT_TIMEOUT = 4500;

    const CSS = `
        #${STACK_ID} {
            position: fixed;
            right: 1.6rem;
            bottom: 1.6rem;
            display: flex;
            flex-direction: column-reverse;
            gap: 0.8rem;
            z-index: 10001;
            max-width: min(36rem, calc(100vw - 3.2rem));
            pointer-events: none;
        }
        .demo-toast {
            pointer-events: auto;
            display: grid;
            grid-template-columns: auto 1fr auto;
            gap: 0.8rem;
            align-items: start;
            padding: 1rem 1.2rem;
            background: #ffffff;
            border-left: 4px solid #6b7280;
            border-radius: 0.6rem;
            box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            font-size: 1.35rem;
            color: #111827;
            line-height: 1.4;
            opacity: 0;
            transform: translateY(8px);
            transition: opacity 180ms ease-out, transform 180ms ease-out;
        }
        .demo-toast--visible { opacity: 1; transform: translateY(0); }
        .demo-toast--leaving { opacity: 0; transform: translateY(8px); }
        .demo-toast--info    { border-left-color: #3b82f6; }
        .demo-toast--success { border-left-color: #10b981; }
        .demo-toast--warn    { border-left-color: #f59e0b; }
        .demo-toast--error   { border-left-color: #ef4444; }
        .demo-toast__icon { font-size: 1.8rem; line-height: 1; padding-top: 0.1rem; }
        .demo-toast__body { min-width: 0; word-wrap: break-word; }
        .demo-toast__title { font-weight: 600; margin-bottom: 0.2rem; }
        .demo-toast__close {
            background: transparent;
            border: none;
            cursor: pointer;
            color: #6b7280;
            font-size: 1.6rem;
            padding: 0 0.4rem;
            margin-top: -0.2rem;
            border-radius: 0.4rem;
        }
        .demo-toast__close:hover { background: #f3f4f6; color: #111827; }
    `;

    const ICONS = {
        info:    'ℹ️',
        success: '✅',
        warn:    '⚠️',
        error:   '⛔'
    };

    function ensureStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = CSS;
        document.head.appendChild(style);
    }

    function ensureStack() {
        let stack = document.getElementById(STACK_ID);
        if (!stack) {
            stack = document.createElement('div');
            stack.id = STACK_ID;
            document.body.appendChild(stack);
        }
        return stack;
    }

    function show(kind, message, opts) {
        ensureStyles();
        const stack = ensureStack();
        const timeout = opts && typeof opts.timeout === 'number' ? opts.timeout : DEFAULT_TIMEOUT;
        const title = opts && opts.title;

        const el = document.createElement('div');
        el.className = `demo-toast demo-toast--${kind}`;
        el.innerHTML = `
            <span class="demo-toast__icon" aria-hidden="true">${ICONS[kind] || ''}</span>
            <div class="demo-toast__body">
                ${title ? `<div class="demo-toast__title"></div>` : ''}
                <div class="demo-toast__message"></div>
            </div>
            <button type="button" class="demo-toast__close" aria-label="Dismiss">×</button>
        `;

        if (title) el.querySelector('.demo-toast__title').textContent = title;
        el.querySelector('.demo-toast__message').textContent = String(message);

        const dismiss = () => {
            el.classList.remove('demo-toast--visible');
            el.classList.add('demo-toast--leaving');
            setTimeout(() => el.remove(), 220);
        };

        el.querySelector('.demo-toast__close').addEventListener('click', dismiss);

        stack.appendChild(el);
        // Reflow so the transition runs.
        requestAnimationFrame(() => el.classList.add('demo-toast--visible'));

        if (timeout > 0) setTimeout(dismiss, timeout);

        return { dismiss };
    }

    window.toast = {
        info:    (message, opts) => show('info', message, opts),
        success: (message, opts) => show('success', message, opts),
        warn:    (message, opts) => show('warn', message, opts),
        error:   (message, opts) => show('error', message, opts)
    };
})();
