/**
 * Canonical public URL helper for InternHub.
 *
 * Used to generate STABLE, PUBLIC, CANONICAL URLs to the certificate
 * verification page (`/verify/<code>`) that are safe to share on
 * LinkedIn, with employers, and in printed certificates.
 *
 * WHY THIS EXISTS
 * ---------------
 * Before this helper, the verification URL was built like this:
 *
 *   const APP_PUBLIC_URL =
 *     process.env.NEXT_PUBLIC_APP_URL ||
 *     process.env.NEXT_PUBLIC_SITE_URL ||
 *     (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
 *
 * That had three problems:
 *
 *   1. `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL` were never set in
 *      any environment (no `.env.local` entry, no Vercel project env).
 *      So `APP_PUBLIC_URL` always fell through to the `VERCEL_URL`
 *      branch on Vercel deployments.
 *
 *   2. `VERCEL_URL` is the auto-injected deployment hostname for the
 *      CURRENT deployment — it changes on every preview deployment
 *      and is a long, ugly, deployment-specific URL like
 *      `internhub-ommxwuglg-intern-hub1.vercel.app`. Baking it into
 *      the `verification_url` column of a `certificates` row made
 *      every issued certificate's URL rot as soon as a new deployment
 *      was created. It also leaked deployment identifiers publicly.
 *
 *   3. Even when the env vars were unset (local dev, fresh preview),
 *      the fallback was an empty string — which produced a relative
 *      `/verify/<code>` URL stored in the DB. The student's LinkedIn
 *      "Add to Profile" link then had `certUrl=%2Fverify%2F...` which
 *      LinkedIn rejects (it requires an absolute https URL).
 *
 * THE FIX
 * -------
 * This helper resolves the canonical public URL with this priority:
 *
 *   1. `NEXT_PUBLIC_APP_URL`  (canonical production domain, e.g.
 *                              `https://internhub.pk`)
 *   2. `NEXT_PUBLIC_SITE_URL` (legacy alias, same purpose)
 *
 * It NEVER falls back to `VERCEL_URL` — that was the root cause of
 * the rotting-preview-URL bug. If neither env var is set, callers
 * must pass a request-derived origin (`new URL(request.url).origin`)
 * so the helper can produce an absolute URL in server contexts, or
 * accept a relative URL for client-side navigation.
 *
 * The env var must be set in production — see `env.example` and the
 * `NEXT_PUBLIC_APP_URL` entry in `.env.local`.
 */

/**
 * The canonical production URL, e.g. "https://internhub.pk".
 * Returns `null` if neither `NEXT_PUBLIC_APP_URL` nor
 * `NEXT_PUBLIC_SITE_URL` is configured.
 *
 * Deliberately does NOT consult `VERCEL_URL` — that was the source
 * of the rotting-preview-URL bug.
 */
export function getCanonicalBaseUrl(): string | null {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "";
  const trimmed = fromEnv.trim().replace(/\/+$/, "");
  return trimmed || null;
}

/**
 * Build a public verification URL for a certificate.
 *
 * Usage:
 *   buildVerificationUrl("IH-VKSC-LIFT")
 *   // → "https://internhub.pk/verify/IH-VKSC-LIFT"
 *
 * If the canonical env var is unset, returns a RELATIVE URL
 * (`/verify/<code>`). Callers in server contexts that need an
 * absolute URL should use `buildVerificationUrlFromRequest` instead
 * — relative URLs silently fail in `fetch()` server-side.
 */
export function buildVerificationUrl(verificationCode: string): string {
  const base = getCanonicalBaseUrl();
  const path = `/verify/${verificationCode}`;
  return base ? `${base}${path}` : path;
}

/**
 * Build a public verification URL using the request's origin as a
 * fallback when the canonical env var is unset.
 *
 * Use this in server components / API routes where you have access
 * to the incoming request and need an ABSOLUTE URL (e.g. when
 * storing into the `verification_url` column, or when calling
 * another internal API endpoint via `fetch()`).
 *
 * Priority:
 *   1. `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL` (canonical)
 *   2. `requestOrigin` (derived from the incoming request)
 *
 * The `requestOrigin` fallback only ever runs on a real deployment
 * — it will be `http://localhost:3000` in local dev, which is fine
 * for development but should NEVER make it into the production DB
 * because production sets `NEXT_PUBLIC_APP_URL`.
 */
export function buildVerificationUrlFromRequest(
  verificationCode: string,
  requestOrigin: string
): string {
  const base = getCanonicalBaseUrl();
  const path = `/verify/${verificationCode}`;
  if (base) return `${base}${path}`;
  const trimmedOrigin = requestOrigin.replace(/\/+$/, "");
  return `${trimmedOrigin}${path}`;
}

/**
 * Resolve a fetch URL for an internal API endpoint, preferring the
 * canonical env var and falling back to the request's origin.
 *
 * Use this in server components that need to call their own API
 * routes via `fetch()`. Relative URLs (`/api/...`) silently fail
 * server-side because `fetch()` requires an absolute URL when
 * invoked from a server component.
 */
export function buildInternalApiUrl(
  path: string,
  requestOrigin: string
): string {
  if (!path.startsWith("/")) {
    throw new Error(
      `buildInternalApiUrl: path must start with "/", got ${JSON.stringify(path)}`
    );
  }
  const base = getCanonicalBaseUrl();
  if (base) return `${base}${path}`;
  const trimmedOrigin = requestOrigin.replace(/\/+$/, "");
  return `${trimmedOrigin}${path}`;
}
