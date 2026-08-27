/**
 * Verify hard_delete_user fails for super_admin targets (the `id` column bug),
 * then verify the fix works after the migration is applied.
 * Creates a throwaway super admin, calls the RPC as service role, cleans up.
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const URL_ = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)![1].trim();
const SERVICE = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)![1].trim();
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

async function main() {
  // 1. Throwaway super admin
  const email = `qa-sa2-${Date.now()}@internhub-test.pk`;
  const { data: created, error } = await admin.auth.admin.createUser({
    email, password: "SaTest!12345678", email_confirm: true,
    user_metadata: { full_name: "Throwaway SA" },
  });
  if (error) throw new Error("createUser: " + error.message);
  const uid = created.user!.id;
  await admin.from("profiles").upsert({
    user_id: uid, email, full_name: "Throwaway SA", role: "super_admin", status: "active", is_active: true,
  });
  console.log("throwaway super admin:", uid);

  // 2. Call the RPC (service role bypasses auth.uid guard, which is for direct SQL callers)
  const { data, error: rpcErr } = await admin.rpc("hard_delete_user", { p_user_id: uid });
  console.log("RPC error:", rpcErr ? JSON.stringify(rpcErr).slice(0, 300) : "none");
  console.log("RPC result:", JSON.stringify(data).slice(0, 300));

  // 3. Cleanup if it failed
  if (rpcErr || (data && (data as any).error)) {
    await admin.from("profiles").delete().eq("user_id", uid);
    await admin.auth.admin.deleteUser(uid);
    console.log("cleaned up throwaway (delete was blocked)");
  } else {
    const { data: p } = await admin.from("profiles").select("user_id").eq("user_id", uid).maybeSingle();
    console.log("profile gone?", !p ? "YES (deleted)" : "NO (still there)");
  }
}
main().catch(e => { console.error(e); process.exit(1); });
