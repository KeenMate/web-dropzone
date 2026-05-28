// Import styles
import './css/main.css';

// Import for export and global API
import { getAllInstances, DropzoneElement } from './web-component';

// Export the web component
export { DropzoneElement };

// Export the base class if users want direct access
export { WebDropzone, formatFileSize, getFileTypeCategory, getFileIcon, isImageFile, createImagePreview } from './dropzone';

// Export types
export type {
    DisplayMode,
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
    FileTypeCategory
} from './types';

export { FILE_TYPE_ICONS } from './types';

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
} from './logger';

// Auto-register the custom element
import './web-component';

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
} from './logger';

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
