import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const digest = scryptSync(password, salt, KEY_LENGTH).toString("base64url");
  return `scrypt$${salt}$${digest}`;
}

export async function verifyPassword(password: string, storedHash: string | null) {
  if (!storedHash) return { valid: false, needsUpgrade: false };

  if (storedHash.startsWith("scrypt$")) {
    const [, salt, expectedText] = storedHash.split("$");
    if (!salt || !expectedText) return { valid: false, needsUpgrade: false };
    const expected = Buffer.from(expectedText, "base64url");
    const actual = scryptSync(password, salt, expected.length);
    return {
      valid: actual.length === expected.length && timingSafeEqual(actual, expected),
      needsUpgrade: false,
    };
  }

  // Compatibility for accounts created by the original application. Successful
  // logins are immediately re-hashed with scrypt by the caller.
  if (/^[a-f0-9]{64}$/i.test(storedHash)) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
    const actual = Buffer.from(digest);
    const expected = Buffer.from(storedHash, "hex");
    return {
      valid: actual.length === expected.length && timingSafeEqual(actual, expected),
      needsUpgrade: true,
    };
  }

  return { valid: false, needsUpgrade: false };
}
