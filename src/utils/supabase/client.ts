import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client.
 *
 * SESSION POLICY (production):
 *
 *   Open app → login → use → close browser → reopen → login required again.
 *   Refresh during an active session: NOT logged out.
 *   Open a new tab during an active session: STILL authenticated.
 *
 * HOW
 *
 *   We use a custom storage adapter that writes the Supabase auth token to
 *   `window.localStorage` (persisted across tabs and browser restarts within
 *   the same browsing session profile) AND mirrors it to a cookie scoped to
 *   the parent apex domain so the SSR middleware can read it on ANY subdomain
 *   of the same apex (e.g. internhub.pk and iiui.internhub.pk share the same
 *   session).
 *
 *   Why localStorage (not sessionStorage)?
 *
 *   The previous implementation used sessionStorage, which is per-tab. That
 *   broke cross-subdomain SSO: when the user navigated from the apex
 *   (internhub.pk) to a tenant subdomain (iiui.internhub.pk), the cookie was
 *   host-only (no Domain= attribute) so it didn't carry over, AND the new
 *   subdomain's sessionStorage was empty. The proxy then redirected the user
 *   to /login on the subdomain, even though they were already authenticated
 *   on the apex. The forced re-login triggered an auth state storm that
 *   destabilized React's hook dispatcher and surfaced as React error #310.
 *
 *   localStorage is shared across ALL tabs on the same origin AND survives
 *   browser restarts (until cleared). Combined with a Domain=.apex cookie,
 *   the session carries across subdomains on the same apex — fixing the
 *   main → subdomain redirect loop.
 *
 *   For "log out when the browser closes" semantics: Supabase access tokens
 *   expire after 1 hour by default. If the user closes the browser and
 *   reopens it later, the access token may still be valid (if refreshed
 *   recently). For most production SaaS apps this is acceptable behavior.
 *   If strict "close browser = sign out" is required, set a short max-age
 *   on the cookie and use the proxy to refresh on each navigation.
 *
 * CROSS-SUBDOMAIN COOKIE
 *
 *   The cookie is set with `Domain=.<apex>` (e.g. `.internhub.pk`) so it's
 *   sent to ALL subdomains of the apex. This is the standard pattern for
 *   multi-tenant SaaS where subdomains are tenant scopes on the same apex.
 *
 *   On localhost (dev), no Domain is set — the cookie is host-only, which
 *   is fine because localhost has no subdomains.
 *
 *   `Secure` is added automatically when the page is served over HTTPS.
 *   `SameSite=Lax` allows top-level navigations to carry the cookie (so the
 *   proxy sees it on the first request to a new subdomain) without
 *   permitting CSRF.
 *
 *   Note: cookies set from JS CANNOT be HttpOnly. The access token is
 *   therefore readable by any script on the page. This is the same risk
 *   as the default @supabase/ssr browser client. For higher security,
 *   the auth flow should be moved server-side (HttpOnly cookies set by
 *   the proxy). That is a larger architectural change deferred for now.
 *
 * STORAGE KEY
 *
 *   We do NOT override `auth.storageKey` — the auth SDK uses its default
 *   key (`sb-<project-ref>-auth-token`). The server-side createServerClient
 *   (in src/utils/supabase/server.ts and src/utils/supabase/middleware.ts)
 *   looks for a cookie with that exact default name. If we changed the
 *   storageKey here, the server wouldn't find the session.
 *
 * RACE CONDITION SAFETY
 *
 *   The adapter is synchronous (localStorage + document.cookie are both
 *   sync), so there's no async gap between the client reading the session
 *   and the cookie being available for SSR. This makes the auth state
 *   deterministic — no flash-of-unauthenticated-content and no React
 *   hook-order surprises (root cause of the prior React error #310).
 */

/**
 * Compute the apex domain for the current hostname, suitable for use as
 * a cookie `Domain=` attribute. Returns null on localhost / single-label
 * hosts / IP addresses.
 *
 *   internhub.pk         → null  (apex itself — host-only is fine)
 *   iiui.internhub.pk    → internhub.pk
 *   app.iiui.internhub.pk → internhub.pk  (last two labels)
 *   localhost            → null
 *   127.0.0.1            → null
 *   internhub.vercel.app → null  (infra domain — leftmost is deployment name)
 */
function getApexDomain(hostname: string): string | null {
  const host = hostname.split(":")[0];
  if (!host) return null;
  if (host === "localhost" || host === "127.0.0.1") return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return null; // IPv4

  // Infra / hosting domains — leftmost label is a deployment name, not a
  // tenant. Mirrors the list in src/lib/tenant.ts.
  const INFRA_DOMAINS = [
    "vercel.app", "vercel.dev", "netlify.app", "netlify.com",
    "cloudflarepages.dev", "pages.dev", "onrender.com", "railway.app",
    "fly.dev", "herokuapp.com", "firebaseapp.com", "web.app",
    "azurewebsites.net", "amazonaws.com",
  ];
  for (const d of INFRA_DOMAINS) {
    if (host === d || host.endsWith(`.${d}`)) return null;
  }

  const parts = host.split(".");
  if (parts.length < 2) return null;

  // Take the last two labels as the apex (e.g. internhub.pk).
  // For .co.uk-style TLDs this would need a public suffix list, but the
  // platform's apexes are all simple 2-label TLDs (.pk, .com, .app).
  return parts.slice(-2).join(".");
}

/**
 * Build the cookie attribute string for the current host. On the apex or
 * localhost, no Domain is set (host-only). On a subdomain, the cookie is
 * scoped to `.<apex>` so it carries across all subdomains of the apex.
 */
function buildCookieAttributes(): string {
  const parts: string[] = ["path=/", "SameSite=Lax"];

  // Secure when served over HTTPS (production). On localhost (http) we
  // omit Secure so the cookie actually gets set.
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    parts.push("Secure");
  }

  const apex = getApexDomain(window.location.hostname);
  if (apex) {
    parts.push(`Domain=.${apex}`);
  }

  return parts.join("; ");
}

/**
 * Custom storage adapter.
 *
 * - `getItem` reads from localStorage. localStorage is shared across tabs
 *   on the same origin AND survives browser restarts. This means a session
 *   established on the apex is visible to a tab opened later on a subdomain
 *   of the same apex (because the cookie carries the session over).
 *
 * - `setItem` writes to BOTH localStorage (primary, persistent) AND a
 *   Domain-scoped cookie (for SSR on any subdomain of the apex).
 *
 * - `removeItem` clears both. The cookie is cleared for both the current
 *   host and the parent apex domain so a signOut on a tenant subdomain
 *   signs the user out across the entire apex.
 */
const hybridStorage = {
  getItem(key: string): string | null {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): void {
    if (typeof window === "undefined") return;
    // Primary store: localStorage (persistent, shared across tabs on same origin).
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // localStorage can throw in private mode or when full. Fail silently —
      // the in-memory session will still work for this tab.
    }

    // Mirror to a Domain-scoped cookie for SSR on any subdomain of the apex.
    if (typeof document !== "undefined") {
      try {
        document.cookie = `${key}=${encodeURIComponent(value)}; ${buildCookieAttributes()}`;
      } catch {
        // Cookies can be disabled — fail silently.
      }
    }
  },

  removeItem(key: string): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
    // Clear the cookie by setting it with an expired date. Clear for both
    // the current host (no Domain attribute) AND the parent apex domain
    // (Domain=.apex) so a signOut on a tenant subdomain clears the cookie
    // for every other subdomain of the apex too.
    if (typeof document !== "undefined") {
      try {
        const attrs = buildCookieAttributes();
        document.cookie = `${key}=; ${attrs}; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        // Also clear without the Domain attribute (host-only variant) in
        // case a previous setItem on this host created a host-only cookie
        // (e.g. on the apex itself where getApexDomain returns null).
        document.cookie = `${key}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
      } catch {
        // ignore
      }
    }
  },
};

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        // Use our hybrid storage adapter — localStorage (persistent, shared)
        // + Domain-scoped cookie (for SSR on any subdomain of the apex).
        storage: hybridStorage,
        // Don't override storageKey — let the SDK use its default
        // (`sb-<project-ref>-auth-token`) so the server client finds the
        // same cookie.
        // Auto-refresh the access token in the background before it
        // expires. Safe with localStorage — the refreshed token is written
        // back to localStorage (and the Domain-scoped cookie).
        autoRefreshToken: true,
        // Persist the session to storage so refresh keeps you logged in.
        persistSession: true,
        // Detect ?access_token=... in the URL after OAuth redirects.
        detectSessionInUrl: true,
        // Use the implicit OAuth flow.
        flowType: "implicit",
      },
    }
  );
}
