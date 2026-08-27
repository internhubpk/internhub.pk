/**
 * Apply a SQL migration file to the live Supabase DB via the Management API
 * (the sandbox has no direct postgres access).
 * Usage: npx tsx scripts/apply-migration-live.ts <migration-file.sql>
 */
import * as fs from "fs";

const file = process.argv[2];
if (!file) { console.error("usage: apply-migration-live.ts <file.sql>"); process.exit(1); }
const sql = fs.readFileSync(file, "utf8");

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    console.error("Set SUPABASE_ACCESS_TOKEN (Supabase Management API personal access token) in the environment first.");
    process.exit(1);
  }
  const res = await fetch("https://api.supabase.com/v1/projects/wqvbmjlloxsrvwhtdskv/database/query", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  console.log("status:", res.status);
  console.log(text.slice(0, 2000));
}
main().catch(e => { console.error(e); process.exit(1); });
