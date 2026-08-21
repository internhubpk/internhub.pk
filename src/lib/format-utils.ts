/**
 * Safe formatting utilities for dashboard display.
 *
 * These helpers guard against the most common display bugs:
 *   - "Invalid Date" from `new Date(null).toLocaleString()`
 *   - "NaN%" from `Math.round(x / 0 * 100)`
 *   - "NaN" from arithmetic on undefined values
 *   - "0" shown as a real value when the underlying data is missing
 *
 * Convention: when the input is missing/invalid, return a dash ("—") —
 * never a fake number. This makes it visually clear to the user that
 * the data is unavailable, rather than misleading them with a 0 they
 * might interpret as "actually zero".
 */

/**
 * Format a number for display. Returns "—" if the value is null, undefined,
 * NaN, or Infinity. Otherwise returns the locale-formatted number.
 *
 * @param value The number to format
 * @param options Intl.NumberFormatOptions (e.g., { style: 'percent' })
 */
export function formatNumber(
  value: number | null | undefined,
  options?: Intl.NumberFormatOptions
): string {
  if (value === null || value === undefined) return "—";
  if (typeof value !== "number") return "—";
  if (Number.isNaN(value) || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", options);
}

/**
 * Format a percentage. Returns "—" if input is invalid.
 * Returns "X%" (no decimals) for whole numbers, "X.X%" for fractions.
 *
 * @param value 0-100 (NOT 0-1). Multiply by 100 before calling.
 */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (typeof value !== "number") return "—";
  if (Number.isNaN(value) || !Number.isFinite(value)) return "—";
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

/**
 * Format a date string / Date object for display. Returns "—" if the input
 * is null, undefined, empty, or invalid (NaN date).
 *
 * @param date ISO date string or Date object
 * @param options Intl.DateTimeFormatOptions
 */
export function formatDate(
  date: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  }
): string {
  if (!date) return "—";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", options);
}

/**
 * Format a date+time for display. Returns "—" if invalid.
 */
export function formatDateTime(
  date: string | Date | null | undefined
): string {
  if (!date) return "—";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format a "time ago" string (e.g., "5m ago", "2h ago", "3d ago").
 * Returns "—" if the input is invalid.
 *
 * @param timestamp ISO date string
 */
export function formatTimeAgo(timestamp: string | null | undefined): string {
  if (!timestamp) return "—";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  if (Number.isNaN(diffMs)) return "—";
  if (diffMs < 0) {
    // Future date — show the actual date instead of a negative "ago".
    return formatDate(date);
  }
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

/**
 * Safely compute a percentage from numerator/denominator.
 * Returns 0 if denominator is 0 (instead of NaN/Infinity).
 */
export function safePercent(numerator: number, denominator: number): number {
  if (!denominator || denominator === 0) return 0;
  const num = typeof numerator === "number" && !Number.isNaN(numerator) ? numerator : 0;
  return Math.round((num / denominator) * 100);
}

/**
 * Safely compute an average. Returns 0 for empty arrays.
 */
export function safeAverage(values: number[]): number {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const valid = values.filter((v) => typeof v === "number" && !Number.isNaN(v) && Number.isFinite(v));
  if (valid.length === 0) return 0;
  const sum = valid.reduce((acc, v) => acc + v, 0);
  return Math.round((sum / valid.length) * 100) / 100;
}
