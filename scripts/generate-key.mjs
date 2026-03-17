/**
 * Generate a secure AES-256 encryption key.
 * Usage: pnpm generate:key
 */
import crypto from "crypto";

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
