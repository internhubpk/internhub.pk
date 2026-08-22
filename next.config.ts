import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import pkg from "./package.json";

// ============================================================================
// CareerStep Next.js Configuration
// ----------------------------------------------------------------------------
// PWA support is provided by Serwist (@serwist/next) — the maintained
// successor to next-pwa. The service worker source is at src/sw.ts.
//
// SECURITY NOTE:
//   The service worker does NOT intercept /api/* or /auth/* requests —
//   authenticated data must never be cached in the SW. This is enforced
//   in src/sw.ts via the `deniedNavigationRoutes` config and the runtime
//   caching rules. See public/manifest.webmanifest for the PWA manifest.
// ============================================================================

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: true,
});

const nextConfig: NextConfig = {
  reactStrictMode: false,
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version || "0.0.0",
  },
  allowedDevOrigins: [
    "myu.xirea.tech",
    "iiui.xirea.tech",
    "careerstep.tech",
    "myu.xirea.tech:3000",
    "iiui.xirea.tech:3000",
    "careerstep.tech:3000",
  ],
  // PWA: add manifest headers so /manifest.webmanifest is served with the
  // correct MIME type (some browsers refuse to install the PWA otherwise).
  async headers() {
    return [
      {
        source: "/manifest.webmanifest",
        headers: [
          {
            key: "Content-Type",
            value: "application/manifest+json; charset=utf-8",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
