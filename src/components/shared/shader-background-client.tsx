"use client";

/**
 * ShaderBackgroundClient
 * ----------------------
 * Client-only wrapper around <ShaderBackground />.
 *
 * Why this exists
 * ---------------
 * The shader relies on WebGPU, which only exists in browsers, so the
 * underlying component must be skipped during SSR. The idiomatic Next.js
 * tool for that is `next/dynamic({ ssr: false })`.
 *
 * Next.js 16 disallows `dynamic(..., { ssr: false })` directly inside a
 * Server Component — the call must live in a Client Component. Several
 * callers want to render the shader:
 *
 *   - src/app/(auth)/layout.tsx        (Server Component — auth pages)
 *   - src/app/page.tsx                 (Client Component — landing hero)
 *   - src/app/support/page.tsx         (Client Component — support hero)
 *
 * Centralizing the `dynamic()` call here means:
 *   - Server Components can import this wrapper directly. The `"use client"`
 *     directive at the top of this file marks the server/client boundary
 *     correctly: the wrapper itself becomes client JS, while the importing
 *     layout stays server-side (no SVG / decorative markup shipped as
 *     client JS just to host a shader).
 *   - Client Components can also import it as a normal client import.
 *   - The `dynamic()` configuration (and any future loading skeleton /
 *     error boundary tweaks) lives in exactly one place.
 *
 * Architectural choice — why not just put `"use client"` on the auth
 * layout (PR #2's approach)?
 *   - The auth layout is purely presentational: static SVG logo, decorative
 *     orbs, a grid pattern, and a glass card wrapper. None of it needs to
 *     be client-side rendered. Making the whole layout a Client Component
 *     ships that JSX as client JS for no benefit and forces the layout
 *     itself (which renders for every /login, /register, /forgot-password
 *     route) to opt out of server features like `generateMetadata` if we
 *     ever add them. Keeping it a Server Component and isolating only the
 *     browser-only shader code is the smallest correct architectural
 *     change.
 */

import dynamic from "next/dynamic";

export const ShaderBackgroundClient = dynamic(
  () =>
    import("@/components/shared/shader-background").then(
      (m) => m.ShaderBackground
    ),
  { ssr: false }
);

export default ShaderBackgroundClient;
