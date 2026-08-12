import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { CookieOptions } from "@supabase/ssr";

/**
 * Create a Supabase server client bound to the current request cookies.
 *
 * Always returns a fully-initialized `SupabaseClient` (never `null`). If
 * Supabase environment variables are missing, this throws an Error — that
 * surfaces misconfiguration loudly instead of causing cascading
 * "supabase is possibly null" TypeScript errors at every call site.
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
    throw new Error(
      "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in your environment."
    );
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
