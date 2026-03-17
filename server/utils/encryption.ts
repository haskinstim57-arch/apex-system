/**
 * AES-256-GCM Encryption Utility
 *
 * Encrypts and decrypts sensitive credential fields at rest.
 * Uses Node.js built-in crypto module with AES-256-GCM.
 *
 * Encrypted values are stored as a single string in the format:
 *   iv:authTag:ciphertext   (all hex-encoded)
 *
 * The encryption key is read from the ENCRYPTION_KEY environment variable,
 * which must be a 64-character hex string representing 32 bytes.
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag

/**
 * Returns the 32-byte encryption key from the ENCRYPTION_KEY env var.
 * Throws a clear error if the variable is missing or malformed.
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is not set. " +
        "Generate one with: pnpm generate:key"
    );
  }
  if (keyHex.length !== 64 || !/^[0-9a-fA-F]+$/.test(keyHex)) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string (32 bytes). " +
        "Generate one with: pnpm generate:key"
    );
  }
  return Buffer.from(keyHex, "hex");
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * @param plaintext - The string to encrypt
 * @returns A single string in the format "iv:authTag:ciphertext" (hex-encoded)
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts a ciphertext string produced by encrypt().
 *
 * @param ciphertext - A string in the format "iv:authTag:encryptedData" (hex-encoded)
 * @returns The original plaintext string
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const parts = ciphertext.split(":");

  if (parts.length !== 3) {
    throw new Error(
      "Invalid encrypted value format. Expected 'iv:authTag:ciphertext'."
    );
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Checks whether a string looks like an encrypted value (iv:authTag:ciphertext format).
 * Useful for detecting whether a field has already been encrypted.
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split(":");
  if (parts.length !== 3) return false;
  const [ivHex, authTagHex, encryptedHex] = parts;
  // IV should be 24 hex chars (12 bytes), authTag 32 hex chars (16 bytes)
  return (
    ivHex.length === 24 &&
    authTagHex.length === 32 &&
    encryptedHex.length > 0 &&
    /^[0-9a-fA-F]+$/.test(ivHex) &&
    /^[0-9a-fA-F]+$/.test(authTagHex) &&
    /^[0-9a-fA-F]+$/.test(encryptedHex)
  );
}

/**
 * Generates a random 32-byte hex encryption key.
 * Run via: pnpm generate:key
 */
export function generateEncryptionKey(): string {
  const key = crypto.randomBytes(32).toString("hex");
  console.log("──────────────────────────────────────────────────────────");
  console.log("  Generated AES-256 Encryption Key (32 bytes, hex):");
  console.log(`  ${key}`);
  console.log("");
  console.log("  Add this to your environment variables:");
  console.log(`  ENCRYPTION_KEY=${key}`);
  console.log("");
  console.log("  ⚠️  Store this key securely. If you lose it, all");
  console.log("  encrypted credentials will become unreadable.");
  console.log("──────────────────────────────────────────────────────────");
  return key;
}
