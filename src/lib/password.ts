/**
 * Password generation + validation utilities for account provisioning.
 *
 * SECURITY: passwords are generated/styled here but NEVER persisted in the
 * application database. They are passed directly to Supabase Auth
 * (`auth.admin.createUser({ password })`) via the service-role client on the
 * server. The browser only sees the generated value transiently so the
 * coordinator can share it with the user out-of-band.
 */

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{}";

/**
 * Generate a strong password that satisfies Supabase Auth's default policy
 * (min 8; the project config now enforces min 8 server-side) and includes
 * at least one lower, one upper, one digit, and one symbol so it also
 * passes stricter client-side zod validators.
 *
 * Uses crypto.getRandomValues — available in both browser and Node 20+
 * (via the Web Crypto API). Falls back to crypto.randomBytes on Node if
 * needed.
 */
export function generatePassword(length = 16): string {
  const all = LOWER + UPPER + DIGITS + SYMBOLS;
  const required = [LOWER, UPPER, DIGITS, SYMBOLS];

  const pick = (charset: string): string => {
    const buf = new Uint32Array(1);
    getRandomValues(buf);
    return charset[buf[0] % charset.length];
  };

  // Guarantee at least one of each required class.
  const chars: string[] = required.map((c) => pick(c));

  // Fill the rest randomly from the full alphabet.
  while (chars.length < length) {
    chars.push(pick(all));
  }

  // Fisher–Yates shuffle so the guaranteed chars aren't always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1);
    getRandomValues(buf);
    const j = buf[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

function getRandomValues(buf: Uint32Array): void {
  // Web Crypto API is available in all modern browsers and Node 20+.
  globalThis.crypto.getRandomValues(buf);
}

/**
 * Real-time password strength estimator for UI feedback.
 * Returns { score: 0-4, label, color }.
 */
export function passwordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "Empty", color: "muted" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ["Very weak", "Weak", "Fair", "Strong", "Very strong"];
  const colors = ["red", "red", "amber", "green", "green"];
  return { score, label: labels[score], color: colors[score] };
}
