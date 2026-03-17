/**
 * One-Time Migration: Encrypt Existing Messaging Credentials
 *
 * ⚠️  WARNING: This script should only be run ONCE after enabling encryption.
 *     Running it on already-encrypted rows will double-encrypt them and make
 *     the credentials unreadable.
 *
 * What it does:
 *   1. Reads all rows from account_messaging_settings
 *   2. For each row, encrypts twilioAuthToken and sendgridApiKey if they
 *      contain plain-text values (not already in iv:authTag:ciphertext format)
 *   3. Writes the encrypted values back to the database
 *
 * Prerequisites:
 *   - ENCRYPTION_KEY must be set in the environment
 *   - DATABASE_URL must be set in the environment
 *
 * Usage:
 *   pnpm migrate:encrypt-credentials
 */

import crypto from "crypto";
import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";

// ── Encryption helpers (duplicated here to keep the script self-contained) ──

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey() {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is not set. " +
        "Generate one with: pnpm generate:key"
    );
  }
  if (keyHex.length !== 64 || !/^[0-9a-fA-F]+$/.test(keyHex)) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string (32 bytes)."
    );
  }
  return Buffer.from(keyHex, "hex");
}

function encrypt(plaintext) {
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

function isEncrypted(value) {
  if (!value) return false;
  const parts = value.split(":");
  if (parts.length !== 3) return false;
  const [ivHex, authTagHex, encryptedHex] = parts;
  return (
    ivHex.length === 24 &&
    authTagHex.length === 32 &&
    encryptedHex.length > 0 &&
    /^[0-9a-fA-F]+$/.test(ivHex) &&
    /^[0-9a-fA-F]+$/.test(authTagHex) &&
    /^[0-9a-fA-F]+$/.test(encryptedHex)
  );
}

// ── Main migration ──

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  Encrypt Existing Messaging Credentials (One-Time)      ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("");

  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL is not set. Aborting.");
    process.exit(1);
  }

  // Validate encryption key before starting
  getEncryptionKey();
  console.log("✅ ENCRYPTION_KEY is valid.");

  const db = drizzle(process.env.DATABASE_URL);

  // Fetch all rows
  const rows = await db.execute(
    sql`SELECT id, twilio_auth_token, sendgrid_api_key FROM account_messaging_settings`
  );

  const allRows = rows[0] || rows;
  console.log(`📋 Found ${Array.isArray(allRows) ? allRows.length : 0} row(s) in account_messaging_settings.`);

  let encrypted = 0;
  let skipped = 0;

  for (const row of Array.isArray(allRows) ? allRows : []) {
    const updates = {};
    let needsUpdate = false;

    // Check twilioAuthToken
    if (row.twilio_auth_token && !isEncrypted(row.twilio_auth_token)) {
      updates.twilio_auth_token = encrypt(row.twilio_auth_token);
      needsUpdate = true;
    }

    // Check sendgridApiKey
    if (row.sendgrid_api_key && !isEncrypted(row.sendgrid_api_key)) {
      updates.sendgrid_api_key = encrypt(row.sendgrid_api_key);
      needsUpdate = true;
    }

    if (needsUpdate) {
      // Use parameterized query via template literal
      if (updates.twilio_auth_token && updates.sendgrid_api_key) {
        await db.execute(
          sql`UPDATE account_messaging_settings SET twilio_auth_token = ${updates.twilio_auth_token}, sendgrid_api_key = ${updates.sendgrid_api_key} WHERE id = ${row.id}`
        );
      } else if (updates.twilio_auth_token) {
        await db.execute(
          sql`UPDATE account_messaging_settings SET twilio_auth_token = ${updates.twilio_auth_token} WHERE id = ${row.id}`
        );
      } else if (updates.sendgrid_api_key) {
        await db.execute(
          sql`UPDATE account_messaging_settings SET sendgrid_api_key = ${updates.sendgrid_api_key} WHERE id = ${row.id}`
        );
      }

      encrypted++;
      console.log(`  🔒 Row ${row.id}: encrypted`);
    } else {
      skipped++;
      console.log(`  ⏭️  Row ${row.id}: skipped (already encrypted or empty)`);
    }
  }

  console.log("");
  console.log(`✅ Done. Encrypted: ${encrypted}, Skipped: ${skipped}`);
  console.log("");
  console.log("⚠️  Do NOT run this script again — it would double-encrypt values.");

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
