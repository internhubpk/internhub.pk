// Check which QA accounts exist + quick data sanity for each role
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim();
const db = createClient(url, key);
const { data, error } = await db.from('profiles').select('email, role, status').like('email', 'qa-%').order('email');
if (error) { console.error(error.message); process.exit(1); }
for (const p of data) console.log(`${p.email}  ${p.role}  ${p.status}`);
