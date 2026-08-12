import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { CookieOptions } from "@supabase/ssr";

/**
 * Create a Supabase server client bound to the current request cookies.
 *
 * Returns `null` ONLY when Supabase environment variables are not configured.
 * In all other cases the returned client is a fully-initialized SupabaseClient
 * (NOT a Promise) — callers do NOT need to await it.
 *
 * Usage:
 *   const supabase = await createClient();           // recommended
 *   const supabase = await createClient(cookieStore); // pass pre-fetched cookies
 */
export async function createClient(
  cookieStore?: Awaited<ReturnType<typeof cookies>>
) {
  const store = cookieStore ?? (await cookies());

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase environment variables:", {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
    });
    return null;
  }

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            store.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}
