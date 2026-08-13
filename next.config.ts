import type { NextConfig } from "next";
import pkg from "./package.json";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Expose the app version (from package.json) to the client bundle so
  // settings pages can display the real version instead of a hardcoded
  // "1.0.0" placeholder. NEXT_PUBLIC_* vars are inlined at build time.
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version || "0.0.0",
  },
};

export default nextConfig;
