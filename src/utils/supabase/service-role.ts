/**
 * Service Role Supabase Client
 *
 * This client uses the SERVICE_ROLE_KEY which BYPASSES all RLS (Row Level Security)
 * policies. Use this ONLY for:
 *
 * 1. Public API endpoints that serve data to unauthenticated users
 *    (e.g., /api/universities, /api/companies for public pages)
 * 2. Server-side operations that need full database access
 * 3. Admin operations that must bypass RLS
 *
 * ⚠️ SECURITY WARNING: Never expose this client or its responses to
 * client-side code in a way that could allow privilege escalation.
 * Only use in API routes (server-side).
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Create a Supabase client with service role privileges (bypasses RLS).
 *
 * This is necessary for public pages (/universities, /companies) because:
 * - The anon key is subject to RLS policies
 * - If no RLS policy allows anon SELECT, queries return empty
 * - Service role bypasses RLS entirely
 *
 * Usage in API routes:
 *   import { createServiceRoleClient } from "@/utils/supabase/service-role";
 *   const supabase = await createServiceRoleClient();
 */
export async function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable");
  }

  if (!serviceRoleKey) {
    // Fall back to regular server client if service role not available
    // This allows development without service role configured
    console.warn(
      "SUPABASE_SERVICE_ROLE_KEY not set. Falling back to anon key (subject to RLS). " +
      "Public endpoints may return empty data if RLS blocks anon access."
    );
    
    // Import dynamically to avoid circular dependency
    const { createClient: createAnonClient } = await import("./server");
    return createAnonClient();
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, serviceRoleKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Ignore cookie errors in service role context
        }
      },
    },
  });
}
