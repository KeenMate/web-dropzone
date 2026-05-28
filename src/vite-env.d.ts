/// <reference types="vite/client" />

// Declare module for CSS imports with ?inline query
declare module '*.css?inline' {
    const content: string;
    export default content;
}
