import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client.
 *
 * SESSION POLICY (production):
 *
 *   Open app → login → use → close tab/browser/shutdown → reopen →
 *   login required again.
 *
 *   Refresh during an active session: NOT logged out.
 *
 * HOW
 *
 *   We use a custom storage adapter that writes the Supabase auth
 *   tokens (access + refresh) to `window.sessionStorage`. sessionStorage
 *   is:
 *
 *     • per-tab             → closing the tab clears it
 *     • cleared on browser close (in all major browsers, including
 *       when the OS is shut down while the browser is still running)
 *     • preserved across page refreshes IN THE SAME TAB
 *
 *   This meets every requirement in the user's session-policy brief
 *   without relying on fragile `beforeunload` signOut calls.
 *
 * SSR COMPATIBILITY
 *
 *   The Next.js middleware (`src/proxy.ts`) and server components read
 *   the auth session from cookies via `@supabase/ssr`'s server client.
 *   To keep SSR working, our custom storage adapter ALSO mirrors the
 *   session to a cookie. The cookie is set WITHOUT an explicit expiry
 *   (a "session cookie"), which means the browser clears it when the
 *   BROWSER closes — but NOT when an individual tab closes.
 *
 *   To handle the "new tab in the same browser session" case (where
 *   the cookie still exists but sessionStorage is empty), we run a
 *   one-shot check on client load: if sessionStorage has no session
 *   but the cookie does, we wipe the cookie. This guarantees a new
 *   tab is always unauthenticated, matching the user's "close tab →
 *   require login" requirement.
 *
 * STORAGE KEY
 *
 *   We do NOT override `auth.storageKey` — the auth SDK uses its
 *   default key (`sb-<project-ref>-auth-token`). This is important
 *   because the server-side `createServerClient` (in
 *   `src/utils/supabase/server.ts` and `src/utils/supabase/middleware.ts`)
 *   looks for a cookie with that exact default name. If we changed
 *   the storageKey here, the server wouldn't find the session.
 *
 * RACE CONDITION SAFETY
 *
 *   The adapter is synchronous (sessionStorage + document.cookie are
 *   both sync), so there's no async gap between the client reading
 *   the session and the cookie being available for SSR. This makes
 *   the auth state deterministic — no flash-of-unauthenticated-content
 *   and no React hook-order surprises (root cause of the prior
 *   React error #310).
 */

/**
 * Custom storage adapter.
 *
 * - `getItem` reads ONLY from sessionStorage. This is critical: if it
 *   also read from the cookie, then opening a new tab (which has
 *   empty sessionStorage) would still see the cookie-based session
 *   and treat the user as logged in. By reading only from
 *   sessionStorage, a new tab starts unauthenticated — exactly what
 *   the user's "close tab → require login" policy requires.
 *
 * - `setItem` writes to BOTH sessionStorage (primary, per-tab) AND a
 *   session cookie (so the SSR middleware can detect the session on
 *   the next request).
 *
 * - `removeItem` clears both.
 */
const hybridStorage = {
  getItem(key: string): string | null {
    if (typeof window === "undefined") return null;
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): void {
    if (typeof window === "undefined") return;
    // Primary store: sessionStorage (per-tab, cleared on tab close).
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // sessionStorage can throw in private mode or when full. Fail
      // silently — the in-memory session will still work for this tab.
    }

    // Mirror to a session cookie for SSR. No `max-age` or `expires`
    // makes it a session cookie (cleared on browser close). Use
    // SameSite=Lax so it's sent on top-level navigations and same-site
    // requests, but not cross-site (CSRF protection).
    if (typeof document !== "undefined") {
      try {
        document.cookie = `${key}=${encodeURIComponent(
          value
        )}; path=/; SameSite=Lax`;
      } catch {
        // Cookies can be disabled — fail silently.
      }
    }
  },

  removeItem(key: string): void {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
    // Clear the cookie by setting it with an expired date.
    if (typeof document !== "undefined") {
      try {
        document.cookie = `${key}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
        // Also clear for the parent domain (e.g. .internhub.pk) so a
        // signOut on a tenant subdomain clears the cookie for the apex
        // too — otherwise the next apex request would still see a
        // session.
        const host = window.location.hostname;
        const parts = host.split(".");
        if (parts.length >= 2) {
          const parent = parts.slice(1).join(".");
          document.cookie = `${key}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; domain=.${parent}`;
        }
      } catch {
        // ignore
      }
    }
  },
};

/**
 * One-shot "new-tab detection" guard. Runs ONCE per client load,
 * BEFORE the Supabase client is handed out, so the very first
 * `getSession()` call already sees the correct state.
 *
 * If sessionStorage has no session entry but the cookie does, we're
 * in a fresh tab within the same browser session — wipe the cookie
 * so SSR and the client agree that the user is unauthenticated.
 *
 * This is the ONLY way to handle the "close tab → reopen" case
 * robustly, without relying on `beforeunload` (which the user
 * explicitly forbade).
 *
 * Cookie name pattern: the auth SDK uses `sb-<project-ref>-auth-token`
 * as the default storageKey. We don't know the exact project ref here
 * (it's in env), so we wipe ANY cookie starting with `sb-` that ends
 * in `-auth-token`. This is safe — those are Supabase auth cookies.
 */
function enforceTabScopedSession(): void {
  if (typeof window === "undefined") return;
  try {
    // Check if ANY Supabase auth token exists in sessionStorage.
    // The default key is `sb-<project-ref>-auth-token`.
    let hasSession = false;
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i);
      if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) {
        hasSession = true;
        break;
      }
    }

    if (!hasSession) {
      // No session in sessionStorage. Wipe any lingering Supabase auth
      // cookies so the server doesn't think we're still logged in.
      // This is the "new tab" case.
      const cookies = document.cookie.split(";");
      for (const c of cookies) {
        const name = c.split("=")[0].trim();
        if (name.startsWith("sb-") && name.endsWith("-auth-token")) {
          // Clear for the current host.
          document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
          // Clear for the parent domain too.
          const host = window.location.hostname;
          const parts = host.split(".");
          if (parts.length >= 2) {
            const parent = parts.slice(1).join(".");
            document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; domain=.${parent}`;
          }
        }
      }
    }
  } catch {
    // sessionStorage / cookies can be disabled — fail silently.
  }
}

// Run the guard ONCE at module load (client-side only). This runs
// before any React component mounts, so the very first getSession()
// call sees a clean state.
if (typeof window !== "undefined") {
  enforceTabScopedSession();
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        // Use our hybrid storage adapter — sessionStorage (per-tab)
        // + session cookie (for SSR).
        storage: hybridStorage,
        // Don't override storageKey — let the SDK use its default
        // (`sb-<project-ref>-auth-token`) so the server client finds
        // the same cookie.
        // Auto-refresh the access token in the background before it
        // expires. Safe with sessionStorage — the refreshed token is
        // written back to sessionStorage (and the cookie).
        autoRefreshToken: true,
        // Persist the session to storage so refresh keeps you logged
        // in (sessionStorage survives refresh in the same tab).
        persistSession: true,
        // Detect ?access_token=... in the URL after OAuth redirects.
        detectSessionInUrl: true,
        // Use the implicit OAuth flow.
        flowType: "implicit",
      },
    }
  );
}
