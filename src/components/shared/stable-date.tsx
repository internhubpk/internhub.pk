"use client";

/**
 * Stable date/datetime components that avoid React #418 hydration errors.
 *
 * The classic cause of React error #418 is calling `new Date().toLocaleString()`
 * during render: the server produces one timestamp, the client hydrates with a
 * different one (the request took >0ms), and React throws because the HTML
 * doesn't match.
 *
 * These components render a stable placeholder during SSR + first paint, then
 * swap to the real date string in a useEffect. This guarantees server and
 * client initial render are identical.
 *
 * Usage:
 *   <StableLastUpdated />                              // "August 21, 2026"
 *   <StableTimestamp value={isoString} />              // "Aug 21, 2026, 4:30 PM"
 *   <StableNow prefix="Verified by InternHub at " />   // for verify pages
 */

import { useEffect, useState } from "react";

const PLACEHOLDER = "—";

function safeFormatDate(d: Date, options: Intl.DateTimeFormatOptions): string {
  if (Number.isNaN(d.getTime())) return PLACEHOLDER;
  return d.toLocaleDateString("en-US", options);
}

function safeFormatDateTime(d: Date, options: Intl.DateTimeFormatOptions): string {
  if (Number.isNaN(d.getTime())) return PLACEHOLDER;
  return d.toLocaleString("en-US", options);
}

/**
 * "Last updated" date — shows today's date.
 * Renders PLACEHOLDER on SSR, real date on client mount.
 */
export function StableLastUpdated() {
  const [text, setText] = useState<string>(PLACEHOLDER);
  useEffect(() => {
    setText(safeFormatDate(new Date(), {
      month: "long",
      day: "numeric",
      year: "numeric",
    }));
  }, []);
  return <>{text}</>;
}

/**
 * Format a specific ISO timestamp — renders PLACEHOLDER until mounted
 * (or "Loading..." if the value is null/undefined).
 */
export function StableTimestamp({
  value,
  options,
  fallback = PLACEHOLDER,
}: {
  value: string | number | Date | null | undefined;
  options?: Intl.DateTimeFormatOptions;
  fallback?: string;
}) {
  const [text, setText] = useState<string>(fallback);
  useEffect(() => {
    if (!value) {
      setText(fallback);
      return;
    }
    const d = value instanceof Date ? value : new Date(value);
    setText(
      options
        ? safeFormatDateTime(d, options)
        : safeFormatDateTime(d, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
    );
  }, [value, options, fallback]);
  return <>{text}</>;
}

/**
 * "Verified by X at <now>" — shows the current time.
 * Renders PLACEHOLDER on SSR, real timestamp on client mount.
 * Useful for certificate verification pages.
 */
export function StableNow({
  prefix = "",
  suffix = "",
  options,
}: {
  prefix?: string;
  suffix?: string;
  options?: Intl.DateTimeFormatOptions;
}) {
  const [text, setText] = useState<string>(PLACEHOLDER);
  useEffect(() => {
    setText(safeFormatDateTime(new Date(), options || {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short",
    }));
  }, [options]);
  return (
    <>
      {prefix}
      {text}
      {suffix}
    </>
  );
}
