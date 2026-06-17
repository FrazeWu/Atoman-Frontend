/// <reference types="vite/client" />

export {};

declare global {
  interface ImportMetaEnv {
    readonly VITE_API_URL: string;
    readonly VITE_TURNSTILE_SITE_KEY?: string;
    readonly VITE_APP_VERSION?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  const __APP_VERSION__: string;
}

declare module 'vue-router' {
  interface RouteMeta {
    authLayout?: boolean;
    hasSidebar?: boolean;
    requiresAuth?: boolean;
    requiresAdmin?: boolean;
    featureGate?: {
      module: import('@/config/moduleRooms').ModuleRoomKey;
      feature: import('@/config/siteAccess').ModuleFeatureKey;
    };
  }
}
