/**
 * API error sanitization helpers
 * --------------------------------
 * Server-side utilities for sanitizing Supabase / PostgREST errors
 * before they reach the client. The raw error is always logged to
 * console.error for developer diagnostics; the client receives a
 * generic, user-friendly message.
 *
 * Usage in an API route:
 *   if (dbErr) {
 *     return NextResponse.json(
 *       { success: false, error: sanitizeApiError(dbErr, "fetch tasks") },
 *       { status: sanitizeApiStatus(dbErr) }
 *     );
 *   }
 *
 * The client's toast utility (src/components/shared/toast.ts) does
 * additional sanitization on its side as a defense-in-depth.
 */

export interface SanitizedError {
  message: string;
  status: number;
}

/**
 * Sanitize a raw Supabase/PostgREST/Postgres error into a user-facing
 * message + HTTP status. The raw error is logged to console.error.
 *
 * Recognized patterns:
 *   - "infinite recursion detected in policy for relation"
 *       → 500, "Unable to load this data. Please try again."
 *   - "row-level security policy" / "42501"
 *       → 403, "You are not authorized to perform this action."
 *   - "JWT expired" / "JWT invalid"
 *       → 401, "Your session has expired. Please log in again."
 *   - "duplicate key value violates unique constraint"
 *       → 409, "This record already exists."
 *   - "violates foreign key constraint"
 *       → 400, "Referenced record not found."
 *   - Network errors → 502
 *   - Unknown → 500, generic message
 */
export function sanitizeApiError(
  err: unknown,
  context: string = "complete this action"
): SanitizedError {
  // Always log the raw error for developer diagnostics
  console.error(`[API error] ${context}:`, err);

  if (!err) {
    return { message: `Unable to ${context}. Please try again.`, status: 500 };
  }

  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : (err as any)?.message || (err as any)?.error || String(err);

  const code = (err as any)?.code;
  const lower = raw.toLowerCase();

  // RLS recursion — server-side issue, never expose the table name
  if (lower.includes("infinite recursion")) {
    return {
      message: `Unable to ${context}. Please try again.`,
      status: 500,
    };
  }

  // RLS denial — authorization issue
  if (
    lower.includes("row-level security") ||
    lower.includes("rls") ||
    lower.includes("new row violates row-level security") ||
    code === "42501"
  ) {
    return {
      message: "You are not authorized to perform this action.",
      status: 403,
    };
  }

  // Auth errors
  if (lower.includes("jwt expired") || lower.includes("jwt invalid")) {
    return {
      message: "Your session has expired. Please log in again.",
      status: 401,
    };
  }
  if (lower.includes("unauthorized") || lower.includes("not authenticated")) {
    return {
      message: "You need to be signed in to perform this action.",
      status: 401,
    };
  }

  // Database constraint violations
  if (lower.includes("duplicate key value violates unique constraint")) {
    return {
      message: "This record already exists.",
      status: 409,
    };
  }
  if (lower.includes("violates foreign key constraint")) {
    return {
      message: "A referenced record could not be found.",
      status: 400,
    };
  }
  if (lower.includes("violates not-null constraint")) {
    return {
      message: "A required field is missing.",
      status: 400,
    };
  }
  if (lower.includes("invalid input syntax")) {
    return {
      message: "One of the submitted values is invalid.",
      status: 400,
    };
  }

  // Network errors
  if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
    return {
      message: "Network error. Please check your connection and try again.",
      status: 502,
    };
  }

  // PostgREST "no rows" / "JSON object requested" — usually 406
  if (lower.includes("json object requested") || lower.includes("multiple (or no) rows returned")) {
    return {
      message: `Unable to ${context}. The record may not exist.`,
      status: 404,
    };
  }

  // Postgres internal errors
  if (code && String(code).startsWith("42")) {
    // SQL syntax error — server bug
    return {
      message: `Something went wrong on our end. Please try again.`,
      status: 500,
    };
  }
  if (code && String(code).startsWith("23")) {
    // Integrity constraint violation
    return {
      message: `Unable to ${context}. The data didn't pass validation.`,
      status: 400,
    };
  }

  // Fallback: if the message is short and looks user-friendly (no SQL
  // identifiers, no internal codes), keep it. Otherwise generic.
  if (raw.length <= 160 && !/[a-z_]+\([a-z_]+\)/i.test(raw) && !lower.includes("error:")) {
    return { message: raw, status: 500 };
  }

  return {
    message: `Unable to ${context}. Please try again.`,
    status: 500,
  };
}

/**
 * Helper for the common API-route pattern:
 *
 *   const { message, status } = sanitizeApiError(err, "fetch tasks");
 *   return NextResponse.json({ success: false, error: message }, { status });
 */
export function sanitizeApiResponse(err: unknown, context: string) {
  const { message, status } = sanitizeApiError(err, context);
  return { error: message, status };
}
