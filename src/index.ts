// Import styles
import './renderer/css/main.css';

// Import for export and global API.
//
// IMPORTANT — import ORDER matters. ES modules are evaluated on first
// import, so the textual order of these named imports determines which
// `customElements.define` call runs first. Satellites MUST be imported
// before `./renderer/web-component`; see the comment block on the
// side-effect imports below for the full rationale.
import { DropzonePickerElement } from './renderer/web-component-picker';
import { DropzoneListElement } from './renderer/web-component-list';
import { DropzoneIndicatorElement } from './renderer/web-component-indicator';
import { DropzoneProgressElement } from './renderer/web-component-progress';
import { getAllInstances, DropzoneElement } from './renderer/web-component';

// Export the web component + satellite renderers (see ARCHITECTURE.md)
export {
    DropzoneElement,
    DropzonePickerElement,
    DropzoneListElement,
    DropzoneIndicatorElement,
    DropzoneProgressElement
};

// Public surface for users writing custom status-surface templates
// (indicator + rolling block share this contract). See ARCHITECTURE.md.
export type {
    StatusSurfaceArgs,
    StatusSurfaceCallback,
    StatusSurfaceResult,
    StatusAggregate,
    DropzoneStoreAPI
} from './core/store-api';
export { createDropzoneSpinner, STATUS_ICONS, STATUS_LABELS, ACTION_ICONS, ACTION_LABELS, actionForStatus } from './core/icons';
export type { RowAction } from './core/icons';

// Export the base class if users want direct access
export { WebDropzone } from './renderer/dropzone';
export { formatFileSize, getFileTypeCategory, getFileIcon, isImageFile, createImagePreview } from './core/dropzone-shared';

// Export types
export type {
    DisplayMode,
    DropzoneMode,
    FileStatus,
    ValueFormat,
    FileState,
    ValidationResult,
    RejectedFile,
    FileItemRenderContext,
    DropzoneConfig,
    FileAddedEventDetail,
    FileRemovedEventDetail,
    FilesRejectedEventDetail,
    ChangeEventDetail,
    DropzoneEventDetail,
    FileTypeCategory,
    AddFilesOptions,
    OverallProgress,
    FileProgressEventDetail,
    FileStatusChangedEventDetail,
    FileUpdatedEventDetail,
    FileRowUpdateEventDetail,
    FilesChangedEventDetail
} from './core/types';

export { FILE_TYPE_ICONS } from './core/types';

// Export logging utilities for runtime control
export {
    setLogLevel,
    enableLogging,
    disableLogging,
    setCategoryLevel,
    LOGGING_CATEGORIES,
    initLogger,
    fileLogger,
    uiLogger,
    interactionLogger
} from './core/logger';

// Custom-element registration order is established by the NAMED imports
// at the top of this file. Each module's `customElements.define` runs as
// a side effect of being imported, and ES modules evaluate exactly once
// on first import. Adding side-effect imports here would be no-ops.
//
// Why satellites must register before `<web-dropzone>`:
// `mountSatellites()` runs inside the store's `connectedCallback`, which
// fires the instant `customElements.define('web-dropzone', ...)`
// upgrades any `<web-dropzone>` already in the parsed HTML. If satellites
// weren't defined yet, `document.createElement('web-dropzone-picker')`
// would return a plain HTMLElement (no `bindToStore` method),
// `bindToStore?.()` would silently no-op, and the picker would later
// upgrade with no programmatic binding — emitting a "store not found"
// warning. Satellites tolerate the reverse race (store not yet upgraded)
// via `resolveStoreElement` (tag-name check) + `whenStoreReady` (waits
// for the `store-ready` event).

// Type declarations for build-time constants
declare const __VERSION__: string;
declare const __PACKAGE_NAME__: string;
declare const __AUTHOR__: string;
declare const __LICENSE__: string;
declare const __REPOSITORY__: string;
declare const __HOMEPAGE__: string;

// Global API interface
export interface GlobalDropzoneAPI {
    version: () => string;
    config: {
        name: string;
        version: string;
        author: string;
        license: string;
        repository: string;
        homepage: string;
    };
    logging: {
        enableLogging: () => void;
        disableLogging: () => void;
        setLogLevel: (level: string) => void;
        setCategoryLevel: (category: string, level: string) => void;
        getCategories: () => string[];
    };
    register: () => void;
    getInstances: () => HTMLElement[];
}

// Declare global namespace
declare global {
    interface Window {
        components?: {
            'web-dropzone'?: GlobalDropzoneAPI;
        };
    }
}

// Import logging functions for global API
import {
    setLogLevel,
    enableLogging,
    disableLogging,
    setCategoryLevel,
    LOGGING_CATEGORIES
} from './core/logger';

// Initialize global API
if (typeof window !== 'undefined') {
    window.components = window.components || {};
    window.components['web-dropzone'] = {
        version: () => __VERSION__,
        config: {
            name: __PACKAGE_NAME__,
            version: __VERSION__,
            author: __AUTHOR__,
            license: __LICENSE__,
            repository: __REPOSITORY__,
            homepage: __HOMEPAGE__
        },
        logging: {
            enableLogging,
            disableLogging,
            setLogLevel,
            setCategoryLevel,
            getCategories: () => [...LOGGING_CATEGORIES]
        },
        register: () => {
            if (typeof customElements !== 'undefined' && !customElements.get('web-dropzone')) {
                customElements.define('web-dropzone', DropzoneElement);
            }
        },
        getInstances: () => getAllInstances()
    };
}
