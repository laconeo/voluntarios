/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly MODE: string;
    readonly BASE_URL: string;
    readonly PROD: boolean;
    readonly DEV: boolean;
    readonly SSR: boolean;
    readonly VITE_APP_TITLE?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
