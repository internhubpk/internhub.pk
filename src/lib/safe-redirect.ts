/**
 * Same-origin redirect validation.
 *
 * SECURITY (2026-08-23 audit): auth routes accepted a `redirect_to` / `next`
 * query parameter and passed it to `new URL(value, origin)` or string
 * concatenation. An absolute value ("https://evil.com") or
 * protocol-relative value ("//evil.com") produced an open redirect,
 * usable for phishing/token-capture flows after login.
 */

/**
 * Return a safe, same-origin path for a user-supplied redirect target.
 * Accepts only site-relative, single-slash paths ("/student", "/dashboard?x=1").
 * Returns the provided fallback for anything else (absolute URLs, "//",
 * backslash tricks, non-path values).
 */
export function safeRedirectPath(
  value: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (!value) return fallback;
  // Must start with exactly one "/" (not "//" or "/\"), and must not be
  // protocol-relative or absolute. Keep it a path (+optional query/hash).
  if (!/^\/(?!\/|\\)[^\s]*$/.test(value)) return fallback;
  // Reject embedded control chars / CR-LF header tricks
  if (/[\r\n\t]/.test(value)) return fallback;
  return value;
}

/**
 * Resolve a user-supplied redirect target against an origin, guaranteeing
 * the result stays on that origin.
 */
export function resolveSameOrigin(
  value: string | null | undefined,
  origin: string,
  fallback = "/dashboard"
): URL {
  const path = safeRedirectPath(value, fallback);
  return new URL(path, origin);
}
