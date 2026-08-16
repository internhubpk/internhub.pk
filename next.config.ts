import type { NextConfig } from "next";
import pkg from "./package.json";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: false,
  // Expose the app version (from package.json) to the client bundle so
  // settings pages can display the real version instead of a hardcoded
  // "1.0.0" placeholder. NEXT_PUBLIC_* vars are inlined at build time.
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version || "0.0.0",
  },
  // Local dev tenant subdomains (mapped to 127.0.0.1 via curl --resolve /
  // Playwright host-resolver-rules). Without this, Next.js dev server
  // treats requests to myu.xirea.tech:3000 as cross-origin and triggers
  // an infinite redirect loop on /university-admin.
  allowedDevOrigins: [
    "myu.xirea.tech",
    "iiui.xirea.tech",
    "internhub.pk",
    "myu.xirea.tech:3000",
    "iiui.xirea.tech:3000",
    "internhub.pk:3000",
  ],
};

export default nextConfig;
