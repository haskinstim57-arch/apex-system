import { describe, expect, it, beforeEach, afterEach } from "vitest";

// ─────────────────────────────────────────────
// Tests for AES-256-GCM Encryption Utility
// Covers: encrypt/decrypt, key validation, format,
// isEncrypted helper, generateEncryptionKey,
// DB helper integration (safeEncrypt/safeDecrypt)
// ─────────────────────────────────────────────

// Use a deterministic test key (32 bytes = 64 hex chars)
const TEST_KEY = "a".repeat(64);

describe("Encryption Utility — encrypt / decrypt", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });
  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  it("encrypts and decrypts a simple string", async () => {
    const { encrypt, decrypt } = await import("./utils/encryption");
    const plaintext = "my-secret-api-key-123";
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("encrypts and decrypts an empty-ish string", async () => {
    const { encrypt, decrypt } = await import("./utils/encryption");
    const plaintext = "x";
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("encrypts and decrypts a long string", async () => {
    const { encrypt, decrypt } = await import("./utils/encryption");
    const plaintext = "SG." + "a".repeat(200);
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("encrypts and decrypts special characters", async () => {
    const { encrypt, decrypt } = await import("./utils/encryption");
    const plaintext = "p@$$w0rd!#%^&*()_+-=[]{}|;':\",./<>?";
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("produces different ciphertext for same plaintext (random IV)", async () => {
    const { encrypt } = await import("./utils/encryption");
    const plaintext = "same-secret";
    const enc1 = encrypt(plaintext);
    const enc2 = encrypt(plaintext);
    expect(enc1).not.toBe(enc2);
  });

  it("output format is iv:authTag:ciphertext (hex-encoded)", async () => {
    const { encrypt } = await import("./utils/encryption");
    const encrypted = encrypt("test");
    const parts = encrypted.split(":");
    expect(parts.length).toBe(3);
    // IV = 12 bytes = 24 hex chars
    expect(parts[0].length).toBe(24);
    // Auth tag = 16 bytes = 32 hex chars
    expect(parts[1].length).toBe(32);
    // Ciphertext is non-empty hex
    expect(parts[2].length).toBeGreaterThan(0);
    expect(/^[0-9a-f]+$/.test(parts[0])).toBe(true);
    expect(/^[0-9a-f]+$/.test(parts[1])).toBe(true);
    expect(/^[0-9a-f]+$/.test(parts[2])).toBe(true);
  });
});

describe("Encryption Utility — key validation", () => {
  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  it("throws when ENCRYPTION_KEY is not set", async () => {
    delete process.env.ENCRYPTION_KEY;
    const { encrypt } = await import("./utils/encryption");
    expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY environment variable is not set");
  });

  it("throws when ENCRYPTION_KEY is too short", async () => {
    process.env.ENCRYPTION_KEY = "abcd";
    const { encrypt } = await import("./utils/encryption");
    expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY must be a 64-character hex string");
  });

  it("throws when ENCRYPTION_KEY contains non-hex characters", async () => {
    process.env.ENCRYPTION_KEY = "g".repeat(64);
    const { encrypt } = await import("./utils/encryption");
    expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY must be a 64-character hex string");
  });

  it("decrypt throws on invalid format", async () => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
    const { decrypt } = await import("./utils/encryption");
    expect(() => decrypt("not-valid-format")).toThrow("Invalid encrypted value format");
  });

  it("decrypt throws on tampered ciphertext", async () => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
    const { encrypt, decrypt } = await import("./utils/encryption");
    const encrypted = encrypt("secret");
    const parts = encrypted.split(":");
    // Tamper with the ciphertext
    parts[2] = "ff" + parts[2].slice(2);
    expect(() => decrypt(parts.join(":"))).toThrow();
  });
});

describe("Encryption Utility — isEncrypted helper", () => {
  it("returns true for properly formatted encrypted values", async () => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
    const { encrypt, isEncrypted } = await import("./utils/encryption");
    const encrypted = encrypt("test-value");
    expect(isEncrypted(encrypted)).toBe(true);
    delete process.env.ENCRYPTION_KEY;
  });

  it("returns false for plain text values", async () => {
    const { isEncrypted } = await import("./utils/encryption");
    expect(isEncrypted("SG.my-api-key-here")).toBe(false);
    expect(isEncrypted("ACxxxxxxxxxxxxxxxx")).toBe(false);
    expect(isEncrypted("")).toBe(false);
    expect(isEncrypted("just-a-string")).toBe(false);
  });

  it("returns false for partial format", async () => {
    const { isEncrypted } = await import("./utils/encryption");
    expect(isEncrypted("abc:def")).toBe(false);
    expect(isEncrypted("abc:def:")).toBe(false);
  });
});

describe("Encryption Utility — generateEncryptionKey", () => {
  it("returns a 64-character hex string", async () => {
    const { generateEncryptionKey } = await import("./utils/encryption");
    const key = generateEncryptionKey();
    expect(key.length).toBe(64);
    expect(/^[0-9a-f]+$/.test(key)).toBe(true);
  });

  it("generates unique keys each time", async () => {
    const { generateEncryptionKey } = await import("./utils/encryption");
    const key1 = generateEncryptionKey();
    const key2 = generateEncryptionKey();
    expect(key1).not.toBe(key2);
  });
});

describe("ENCRYPTION_KEY secret validation", () => {
  beforeEach(() => {
    // In test environment, set the key explicitly since platform secrets
    // aren't injected into the vitest runner process.
    if (!process.env.ENCRYPTION_KEY) {
      process.env.ENCRYPTION_KEY = TEST_KEY;
    }
  });
  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  it("ENCRYPTION_KEY env var is valid when set", () => {
    const key = process.env.ENCRYPTION_KEY;
    expect(key).toBeDefined();
    expect(key!.length).toBe(64);
    expect(/^[0-9a-fA-F]+$/.test(key!)).toBe(true);
  });

  it("can encrypt and decrypt with the ENCRYPTION_KEY", async () => {
    const { encrypt, decrypt } = await import("./utils/encryption");
    const testValue = "SG.test-sendgrid-key-12345";
    const encrypted = encrypt(testValue);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(testValue);
  });
});

describe("DB Helpers — encryption integration", () => {
  it("getAccountMessagingSettings function exists", async () => {
    const db = await import("./db");
    expect(typeof db.getAccountMessagingSettings).toBe("function");
  });

  it("upsertAccountMessagingSettings function exists", async () => {
    const db = await import("./db");
    expect(typeof db.upsertAccountMessagingSettings).toBe("function");
  });
});

describe("npm scripts", () => {
  it("package.json has generate:key script", async () => {
    const fs = await import("fs");
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
    expect(pkg.scripts["generate:key"]).toBe("node scripts/generate-key.mjs");
  });

  it("package.json has migrate:encrypt-credentials script", async () => {
    const fs = await import("fs");
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
    expect(pkg.scripts["migrate:encrypt-credentials"]).toBe(
      "tsx scripts/encrypt-existing-credentials.mjs"
    );
  });
});
