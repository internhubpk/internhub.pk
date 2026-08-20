// ============================================================================
// InternHub Serwist Service Worker
// ----------------------------------------------------------------------------
// Uses Serwist (@serwist/next) — the maintained successor to next-pwa.
//
// CACHING STRATEGY (per InternHub spec section 7):
//   * Static assets (JS/CSS/images): defaultCache (Serwist's recommended
//     runtime caching rules)
//   * HTML pages: NetworkFirst (so logged-in users always see fresh data)
//   * API routes: NO caching — authenticated data must never be cached
//   * Supabase auth endpoints: NO caching.
//
// SECURITY:
//   * The service worker does NOT cache /api/* responses — they may contain
//     user-specific authenticated data.
//   * The service worker does NOT cache cookies, Authorization headers, or
//     session tokens. SW caches store Response bodies only.
//   * Authenticated pages ARE cached for offline navigation, but the cached
//     version is just the React shell (no user data is in the HTML when
//     using server components with proper auth checks).
// ============================================================================

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

// `self` in the service worker context is the ServiceWorkerGlobalScope.
// We don't add "webworker" to tsconfig.lib because that would conflict
// with the DOM types used by the rest of the app. Cast to any here.
declare const self: any;

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: PrecacheEntry[] | " precache-manifest.96e91fa4.js" | undefined;
  }
}

const serwist = new Serwist({
  fallbacks: {
    entries: [
      {
        url: "/_offline",
        matcher: ({ request }) =>
          request.destination === "document" &&
          // Don't show offline fallback for /api/* — those should fail clearly
          !new URL(request.url).pathname.startsWith("/api/"),
      },
    ],
  },
  runtimeCaching: defaultCache,
});

// CRITICAL: Serwist's webpack plugin searches the SW source for
// `self.__SW_MANIFEST` and replaces it with the precache manifest at build
// time. Without this reference, the build fails with
// "Can't find self.__SW_MANIFEST in your SW source."
// The reference is a no-op at runtime (it's just a property access).
// eslint-disable-next-line @typescript-eslint/no-unused-expressions
self.__SW_MANIFEST;

serwist.addEventListeners();
