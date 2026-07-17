import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Symmetric encrypt/decrypt for short-lived secrets stored at rest (currently
 * the forwarded session cookie used by the PDF render worker). Storing a live
 * session credential in plaintext in the DB is a data-at-rest exposure; we
 * AES-256-GCM it with a key derived from BETTER_AUTH_SECRET so a DB dump alone
 * can't replay sessions. The value is still cleared once the render completes.
 *
 * Format (base64): [12-byte iv][16-byte auth tag][ciphertext], prefixed "enc:v1:".
 */

const PREFIX = "enc:v1:";

function key(): Buffer {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is required to encrypt/decrypt secrets");
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString("base64");
}

/**
 * Decrypt a value produced by encryptSecret. Values without the prefix are
 * returned unchanged so pre-existing plaintext rows (written before this landed)
 * still work during the transition.
 */
export function decryptSecret(value: string): string {
  if (!value.startsWith(PREFIX)) return value;
  const raw = Buffer.from(value.slice(PREFIX.length), "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
