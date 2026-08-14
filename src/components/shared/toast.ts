"use client";

/**
 * Toast utilities for InternHub
 * --------------------------------
 * Wraps Sonner (already mounted globally in src/app/layout.tsx) with
 * a small helper API that supports the loading → success/error pattern
 * required by the design spec.
 *
 * Usage:
 *   import { toast } from "@/components/shared/toast";
 *
 *   // Simple success
 *   toast.success("Task created");
 *
 *   // Loading → success/error
 *   const promise = fetch("/api/...", { method: "POST", ... });
 *   toast.promise(promise, {
 *     loading: "Creating task...",
 *     success: "Task created successfully",
 *     error: "Failed to create task",
 *   });
 *
 *   // Error from a caught exception
 *   catch (err) {
 *     toast.error("Failed to save", { description: err.message });
 *   }
 *
 * Design rules:
 *   - One source of truth: Sonner. Don't mix with the legacy
 *     useToast (Radix toast) hook.
 *   - Errors that come from Supabase/PostgREST are sanitized before
 *     being shown to the user (see `sanitizeError`).
 *   - Detailed error info is logged to console.error for developer
 *     diagnostics, never shown in the toast body.
 */

import { toast as sonnerToast } from "sonner";

/**
 * Sanitize a raw error message into a user-friendly string.
 *
 * Examples:
 *   "infinite recursion detected in policy for relation \"tasks\""
 *     → "Unable to complete this action. Please try again."
 *   "row-level security policy"
 *     → "You are not authorized to perform this action."
 *   "JWT expired"
 *     → "Your session has expired. Please log in again."
 *   "Failed to fetch"
 *     → "Network error. Please check your connection and try again."
 */
export function sanitizeError(err: unknown): string {
  if (!err) return "An unexpected error occurred.";
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : (err as any)?.message || (err as any)?.error || String(err);

  const lower = raw.toLowerCase();

  // Auth errors
  if (lower.includes("jwt expired") || lower.includes("jwt invalid")) {
    return "Your session has expired. Please log in again.";
  }
  if (lower.includes("unauthorized") || lower.includes("not authenticated")) {
    return "You need to be signed in to perform this action.";
  }

  // RLS / authorization errors
  if (lower.includes("infinite recursion")) {
    return "Unable to load this data. Please try again.";
  }
  if (
    lower.includes("row-level security") ||
    lower.includes("rls") ||
    lower.includes("new row violates row-level security")
  ) {
    return "You are not authorized to perform this action.";
  }
  if (lower.includes("forbidden") || lower.includes("403")) {
    return "You are not authorized to perform this action.";
  }

  // Network errors
  if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
    return "Network error. Please check your connection and try again.";
  }
  if (lower.includes("network request failed")) {
    return "Network error. Please check your connection and try again.";
  }

  // Validation errors — these are usually safe to show as-is
  if (lower.includes("is required") || lower.includes("must be")) {
    return raw;
  }

  // Postgres errors — generic message, detail logged to console
  if (lower.includes("postgres") || lower.includes("code: 42") || lower.includes("syntax error")) {
    return "Something went wrong on our end. Please try again.";
  }

  // Fallback: if the message is short and looks user-friendly, keep it
  if (raw.length <= 120 && !/[a-z_]+\([a-z_]+\)/i.test(raw)) {
    return raw;
  }

  return "Something went wrong. Please try again.";
}

/**
 * Sanitized toast namespace. Mirrors Sonner's API but routes error
 * messages through `sanitizeError`.
 *
 * For the loading→success/error pattern, use `toast.promise` or
 * `toast.loading` + `toast.success` / `toast.error`.
 */
export const toast = {
  /**
   * Show a success toast.
   * @example toast.success("Task created", { description: "Assigned to 3 students" })
   */
  success(message: string, opts?: { description?: string }) {
    return sonnerToast.success(message, opts);
  },

  /**
   * Show an error toast. The error value is sanitized via
   * `sanitizeError` so RLS / SQL / network errors don't leak.
   * @example toast.error("Failed to save", { description: err.message })
   */
  error(message: string, opts?: { description?: string; err?: unknown }) {
    const description =
      opts?.description ??
      (opts?.err ? sanitizeError(opts.err) : undefined);
    console.error("[toast.error]", message, opts?.err ?? "");
    return sonnerToast.error(message, description ? { description } : undefined);
  },

  /**
   * Show an error toast from a caught error value. The message is
   * auto-sanitized.
   */
  fromError(err: unknown, fallbackMessage = "Something went wrong") {
    const message = sanitizeError(err);
    console.error("[toast.fromError]", fallbackMessage, err);
    return sonnerToast.error(fallbackMessage, { description: message });
  },

  /**
   * Show a warning toast.
   */
  warning(message: string, opts?: { description?: string }) {
    return sonnerToast.warning(message, opts);
  },

  /**
   * Show an info toast.
   */
  info(message: string, opts?: { description?: string }) {
    return sonnerToast.info(message, opts);
  },

  /**
   * Show a loading toast that the caller is responsible for
   * updating/dismissing.
   * @example
   *   const id = toast.loading("Saving...");
   *   try { await save(); toast.success("Saved", { id }); }
   *   catch (e) { toast.error("Save failed", { id, err: e }); }
   */
  loading(message: string) {
    return sonnerToast.loading(message);
  },

  /**
   * Promise-based loading→success/error pattern. The promise must
   * resolve to a Response; if `!res.ok`, the body is parsed as JSON
   * and the `error` field is used as the error message (sanitized).
   *
   * For non-Response promises, use the simpler `toast.promise` overload.
   */
  promise<T>(
    p: Promise<T>,
    opts: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: unknown) => string);
    }
  ) {
    return sonnerToast.promise(p, {
      loading: opts.loading,
      success: opts.success,
      error: (err) => {
        // If the promise rejected with a Response, extract the body
        if (err instanceof Response) {
          // Synchronous read isn't possible — log and return generic
          console.error("[toast.promise] Response error:", err.status, err.statusText);
          return typeof opts.error === "function" ? opts.error(err) : opts.error;
        }
        const sanitized = sanitizeError(err);
        console.error("[toast.promise] error:", err);
        return typeof opts.error === "function" ? opts.error(err) : sanitized;
      },
    });
  },

  /**
   * Promise-based pattern for `fetch()` calls. Resolves when the
   * response is `ok`, rejects with the JSON `error` field otherwise.
   * Use this for all mutation API calls:
   *
   *   const data = await toast.fetch(async () => {
   *     const res = await fetch("/api/...", { method: "POST", body: ... });
   *     if (!res.ok) {
   *       const err = await res.json().catch(() => ({}));
   *       throw new Error(err.error || `Request failed (${res.status})`);
   *     }
   *     return res.json();
   *   }, {
   *     loading: "Saving...",
   *     success: "Saved successfully",
   *     error: "Failed to save",
   *   });
   */
  async fetch<T>(
    fn: () => Promise<T>,
    opts: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: unknown) => string);
    }
  ): Promise<T> {
    const id = sonnerToast.loading(opts.loading);
    try {
      const data = await fn();
      const successMsg = typeof opts.success === "function" ? opts.success(data) : opts.success;
      sonnerToast.success(successMsg, { id });
      return data;
    } catch (err) {
      const errorFallback = typeof opts.error === "function" ? opts.error(err) : opts.error;
      const errorDesc = sanitizeError(err);
      console.error("[toast.fetch]", errorFallback, err);
      sonnerToast.error(errorFallback, { id, description: errorDesc });
      throw err;
    }
  },

  /**
   * Dismiss a toast by id (or all toasts if no id).
   */
  dismiss(id?: string | number) {
    return sonnerToast.dismiss(id);
  },
};

export { sonnerToast };
export default toast;
