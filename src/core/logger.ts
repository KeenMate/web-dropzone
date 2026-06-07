/**
 * Logging configuration using loglevel with categorized loggers
 *
 * Categories:
 * - DROPZONE:INIT: Component initialization and configuration
 * - DROPZONE:FILE: File operations, validation, preview generation
 * - DROPZONE:UI: UI updates, rendering, popover operations
 * - DROPZONE:INTERACTION: User interactions, drag-drop, clicks
 *
 * Usage:
 * - By default, all logging is disabled (silent mode) for production
 * - Enable logging in browser console:
 *   ```javascript
 *   import { enableLogging, setLogLevel, setCategoryLevel } from './logger';
 *
 *   // Enable all logging at debug level
 *   enableLogging();
 *
 *   // Or set a specific log level for all categories
 *   setLogLevel('info');  // 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent'
 *
 *   // Or enable/disable specific categories
 *   disableLogging();  // First disable all
 *   setCategoryLevel('DROPZONE:UI', 'debug');  // Enable only UI logs
 *   setCategoryLevel('DROPZONE:FILE', 'info');  // Enable only FILE logs at info level
 *   setCategoryLevel('DROPZONE:INTERACTION', 'silent');  // Disable interaction logs
 *   ```
 */

// Import vendored libraries via ES module wrappers
// @ts-ignore - Vendored library without type definitions
import log from '../vendor/loglevel/index.js';
// @ts-ignore - Vendored library without type definitions
import prefix from '../vendor/loglevel/prefix.js';

// Define color scheme matching original logger
const COLORS = {
    debug: '#0ea5e9',  // Blue
    info: '#10b981',   // Green
    warn: '#f59e0b',   // Orange
    error: '#ef4444'   // Red
};

// Register prefix plugin with the root logger
prefix.reg(log);

// Configure prefix plugin with color-coded formatting
prefix.apply(log, {
    format(level: string, name: string | undefined, timestamp: string) {
        // Get color for the current log level
        const color = COLORS[level.toLowerCase() as keyof typeof COLORS] || '#666';

        // Return formatted prefix with color styling
        return `%c[${timestamp}]%c %c[${level}]%c ${name ? `%c[${name}]%c ` : ''}`;
    },
    timestampFormatter(date: Date) {
        // Format: HH:MM:SS.mmm
        return date.toTimeString().split(' ')[0] + '.' + date.getMilliseconds().toString().padStart(3, '0');
    }
});

// Apply color styling to console output using a custom method factory
const originalFactory = log.methodFactory;
log.methodFactory = function(methodName: string, logLevel: number, loggerName: string) {
    const rawMethod = originalFactory(methodName, logLevel, loggerName);

    return function(...args: any[]) {
        // If first arg contains %c color codes, inject the colors
        if (args.length > 0 && typeof args[0] === 'string' && args[0].includes('%c')) {
            const color = COLORS[methodName as keyof typeof COLORS] || '#666';
            const coloredArgs = [
                args[0],
                `color: ${color}; font-weight: bold;`,  // timestamp color
                'color: inherit;',                        // reset
                `color: ${color}; font-weight: bold;`,  // level color
                'color: inherit;',                        // reset
                ...(loggerName ? [
                    `color: ${color}; font-weight: bold;`,  // name color
                    'color: inherit;',                        // reset
                ] : []),
                ...args.slice(1)
            ];
            rawMethod(...coloredArgs);
        } else {
            rawMethod(...args);
        }
    };
};

// Set default log level to silent (production mode)
log.setLevel('silent');

// Create category-specific loggers with hierarchical naming
export const initLogger = log.getLogger('DROPZONE:INIT');
export const fileLogger = log.getLogger('DROPZONE:FILE');
export const uiLogger = log.getLogger('DROPZONE:UI');
export const interactionLogger = log.getLogger('DROPZONE:INTERACTION');

// Export the default logger
export default log;

/**
 * List of all logging categories for introspection
 */
export const LOGGING_CATEGORIES = [
    'DROPZONE:INIT',
    'DROPZONE:FILE',
    'DROPZONE:UI',
    'DROPZONE:INTERACTION'
];

/**
 * Enable all logging (set to debug level)
 */
export function enableLogging() {
    log.setLevel('debug');
}

/**
 * Disable all logging (set to silent level)
 */
export function disableLogging() {
    log.setLevel('silent');
}

/**
 * Set log level for all loggers
 * @param level Log level to set ('trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent')
 */
export function setLogLevel(level: string) {
    log.setLevel(level);
}

/**
 * Set log level for a specific category
 * @param category Category logger to configure (e.g., 'DROPZONE:UI')
 * @param level Log level to set ('trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent')
 */
export function setCategoryLevel(category: string, level: string) {
    log.getLogger(category).setLevel(level);
}
