/**
 * Canonical public URL helper for CareerStep.
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
 *                              `https://careerstep.tech`)
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
 *
 * Resolution priority:
 *   1. `NEXT_PUBLIC_APP_URL`      (canonical production domain)
 *   2. `NEXT_PUBLIC_SITE_URL`     (legacy alias, same purpose)
 *   3. `DEFAULT_PRODUCTION_URL`   (see below — platform default)
 *
 * IMPORTANT — why we have a hardcoded platform default at all:
 *
 * The previous version of this helper returned `null` when neither env
 * var was set. That was "cleaner" in principle but caused real-world
 * bugs: on Vercel, env vars are NOT inherited from `.env.local` — they
 * must be set in the Vercel project dashboard. If a developer forgets
 * to set `NEXT_PUBLIC_APP_URL` on Vercel, the build inlines `""` and
 * every certificate verification URL falls back to a relative path
 * (`/verify/<code>`), which on a Vercel preview deployment still
 * resolves to the deployment URL — re-introducing the exact bug this
 * helper was created to fix.
 *
 * The canonical production domain of the CareerStep platform is
 * `careerstep.tech` (declared in `PLATFORM_DEFAULT_TENANT.domain` in
 * `src/lib/tenant.ts`). Using it as a last-resort fallback is NOT
 * "hardcoding a URL in the frontend" — it's a platform-level constant
 * that any `NEXT_PUBLIC_APP_URL` override (staging, custom tenant
 * domain, local dev) takes precedence over.
 *
 * This default NEVER participates in storing the wrong URL into the
 * database — when `NEXT_PUBLIC_APP_URL` is unset on a Vercel build,
 * the URL stored in `certificates.verification_url` will now be
 * `https://internhub.pk/verify/<code>` instead of either a relative
 * path or a Vercel deployment URL. That is the desired behavior.
 */
const DEFAULT_PRODUCTION_URL = "https://careerstep.tech";

export function getCanonicalBaseUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "";
  const trimmed = fromEnv.trim().replace(/\/+$/, "");
  return trimmed || DEFAULT_PRODUCTION_URL;
}

/**
 * Build a public verification URL for a certificate.
 *
 * Usage:
 *   buildVerificationUrl("IH-VKSC-LIFT")
 *   // → "https://careerstep.tech/verify/IH-VKSC-LIFT"
 *
 * Always returns an ABSOLUTE URL — uses the canonical env var if set,
 * otherwise the platform default `https://careerstep.tech`. Callers in
 * server contexts that want to honor the request origin (e.g. for
 * internal API fetches on a staging deployment) should use
 * `buildVerificationUrlFromRequest` instead.
 *
 * This is the function the DISPLAY layer (student / company-hr /
 * faculty-supervisor pages) should use to render the verification URL
 * — never read `certificates.verification_url` directly from the DB,
 * because rows issued before this fix may still contain stale Vercel
 * deployment URLs.
 */
export function buildVerificationUrl(verificationCode: string): string {
  const base = getCanonicalBaseUrl();
  const path = `/verify/${verificationCode}`;
  return `${base}${path}`;
}

/**
 * Build a public verification URL using the request's origin as a
 * LAST-RESORT fallback.
 *
 * Use this in server components / API routes that store the URL into
 * the `certificates.verification_url` column.
 *
 * Priority:
 *   1. `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL` (canonical)
 *   2. `DEFAULT_PRODUCTION_URL` (platform default: https://careerstep.tech)
 *   3. `requestOrigin` (only when both env vars AND the platform
 *      default are somehow unset — should never happen in practice)
 *
 * WHY we now prefer the platform default over the request origin:
 *
 * The previous version fell back to `requestOrigin` whenever the env
 * var was unset. On Vercel preview deployments (where the env var is
 * often not set), `requestOrigin` was the Vercel deployment URL
 * (e.g. `https://internhub-ommxwuglg-intern-hub1.vercel.app`), and
 * that URL got baked into the `verification_url` column. When a
 * student later clicked the verify link, Vercel's "Vercel
 * Authentication" deployment-protection intercepted the request and
 * redirected to `https://vercel.com/sso/access/request?...` — a
 * Vercel SSO login wall. That broke public verification entirely.
 *
 * The platform default `https://careerstep.tech` is the correct
 * canonical production domain (declared in
 * `PLATFORM_DEFAULT_TENANT.domain`). Certificates generated on a
 * preview deployment should still point to production — they're
 * real certificates that students share on LinkedIn, and the
 * verification page is publicly accessible.
 *
 * The `requestOrigin` parameter is retained for backward compat
 * but is effectively dead code now — it only runs if both the env
 * var AND the platform default are unset, which is impossible.
 */
export function buildVerificationUrlFromRequest(
  verificationCode: string,
  requestOrigin: string
): string {
  const base = getCanonicalBaseUrl(); // env var > platform default
  const path = `/verify/${verificationCode}`;
  if (base) return `${base}${path}`;
  // Dead branch — getCanonicalBaseUrl() always returns a value.
  const trimmedOrigin = requestOrigin.replace(/\/+$/, "");
  return `${trimmedOrigin}${path}`;
}

/**
 * Resolve a fetch URL for an internal API endpoint, falling back to
 * the request's origin when no canonical env var is set.
 *
 * Use this in server components that need to call their own API
 * routes via `fetch()`. Relative URLs (`/api/...`) silently fail
 * server-side because `fetch()` requires an absolute URL when
 * invoked from a server component.
 *
 * NOTE: This deliberately does NOT use `DEFAULT_PRODUCTION_URL` —
 * server-to-server `fetch()` calls must hit the SAME origin the
 * request came in on (localhost in dev, the deployment URL on
 * Vercel). Defaulting to `https://careerstep.tech` would route internal
 * API calls to production even from a local dev server, which would
 * break auth (cookies don't cross domains) and confuse debugging.
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
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "";
  const trimmedEnv = fromEnv.trim().replace(/\/+$/, "");
  if (trimmedEnv) return `${trimmedEnv}${path}`;
  const trimmedOrigin = requestOrigin.replace(/\/+$/, "");
  return `${trimmedOrigin}${path}`;
}
