/**
 * Hydration-safe date formatting utilities.
 *
 * WHY THIS EXISTS
 * ───────────────
 * React error #418 (hydration mismatch) is triggered whenever the server
 * and the client produce different HTML for the same React tree. Date
 * formatting is a textbook cause:
 *
 *   1. `new Date().toLocaleDateString()` with no explicit locale — Node's
 *      default ICU locale and the browser's `navigator.language` can
 *      differ (en-US vs en-GB vs de-DE), producing "1/15/2026" on the
 *      server and "15/01/2026" on the client for the same instant.
 *
 *   2. `new Date(iso).toLocaleDateString("en-US", { month: "short",
 *      day: "numeric" })` — locale is pinned but timezone is not. An ISO
 *      timestamp at UTC midnight renders "Jan 15" on a UTC server but
 *      "Jan 14" on a PST client.
 *
 *   3. `new Date()` (no argument) inside render — server clock vs client
 *      clock can disagree, especially around midnight UTC and across
 *      timezones.
 *
 * The formatters in this file pin both the locale (`en-US`) AND the
 * timezone (`UTC`). Use them anywhere a date is rendered during the
 * initial render (i.e., in JSX of a client component, not inside an
 * event handler or `useEffect`).
 *
 * For "time ago" / "relative time" displays that depend on `now`, the
 * caller should compute `now` inside a `useEffect` and pass it in as a
 * prop, OR guard the rendered output behind a `mounted` flag — see
 * `src/components/layout/theme-toggle.tsx` for the canonical pattern.
 */

const DEFAULT_LOCALE = "en-US";
const DEFAULT_TIMEZONE = "UTC";

/**
 * Format an ISO date string as a short date (e.g., "Jan 15, 2026").
 *
 * Hydration-safe: locale AND timezone are pinned.
 */
export function formatDate(
  isoDate: string | null | undefined,
  options: Intl.DateTimeFormatOptions = {},
): string {
  if (!isoDate) return "—";
  try {
    return new Date(isoDate).toLocaleDateString(DEFAULT_LOCALE, {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: DEFAULT_TIMEZONE,
      ...options,
    });
  } catch {
    return "—";
  }
}

/**
 * Format an ISO date string as a date+time string (e.g.,
 * "Jan 15, 2026, 3:30 PM").
 *
 * Hydration-safe: locale AND timezone are pinned.
 */
export function formatDateTime(
  isoDate: string | null | undefined,
  options: Intl.DateTimeFormatOptions = {},
): string {
  if (!isoDate) return "—";
  try {
    return new Date(isoDate).toLocaleString(DEFAULT_LOCALE, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: DEFAULT_TIMEZONE,
      ...options,
    });
  } catch {
    return "—";
  }
}

/**
 * Format an ISO date string as just a date with no year (e.g., "Jan 15").
 *
 * Hydration-safe: locale AND timezone are pinned.
 */
export function formatShortDate(
  isoDate: string | null | undefined,
  options: Intl.DateTimeFormatOptions = {},
): string {
  if (!isoDate) return "—";
  try {
    return new Date(isoDate).toLocaleDateString(DEFAULT_LOCALE, {
      month: "short",
      day: "numeric",
      timeZone: DEFAULT_TIMEZONE,
      ...options,
    });
  } catch {
    return "—";
  }
}

/**
 * Format an ISO date string as a time-only string (e.g., "3:30 PM").
 *
 * Hydration-safe: locale AND timezone are pinned.
 */
export function formatTime(
  isoDate: string | null | undefined,
  options: Intl.DateTimeFormatOptions = {},
): string {
  if (!isoDate) return "—";
  try {
    return new Date(isoDate).toLocaleTimeString(DEFAULT_LOCALE, {
      hour: "numeric",
      minute: "2-digit",
      timeZone: DEFAULT_TIMEZONE,
      ...options,
    });
  } catch {
    return "—";
  }
}

/**
 * Relative-time formatter (e.g., "5m ago", "3h ago", "2d ago").
 *
 * NOT hydration-safe by itself — it depends on `now`, and `now` differs
 * between the server render and the client hydration. Callers MUST
 * either:
 *   (a) call this only inside a `useEffect` / event handler (never
 *       during the initial render), or
 *   (b) compute `now` in a `useEffect` + `useState` and pass it in,
 *       guarding the first render with `if (!now) return null`.
 *
 * The function accepts an explicit `now` parameter to make this
 * contract obvious at the call site.
 */
export function formatRelativeTime(
  isoDate: string | null | undefined,
  now: Date,
): string {
  if (!isoDate) return "—";
  const date = new Date(isoDate);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  // For anything older than a week, fall back to the pinned-TZ date —
  // safe because it doesn't depend on `now`.
  return formatShortDate(isoDate);
}
