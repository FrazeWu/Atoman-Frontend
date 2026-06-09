/// <reference types="vite/client" />

export {};

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
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
