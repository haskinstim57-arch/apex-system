import { describe, it, expect } from "vitest";
import {
  validateSQLSafety,
  getProtectedTables,
  logMigrationSafety,
} from "./db-safety";

describe("Database Safety Guards", () => {
  describe("getProtectedTables", () => {
    it("should return a list of protected tables", () => {
      const tables = getProtectedTables();
      expect(tables.length).toBeGreaterThan(10);
      expect(tables).toContain("users");
      expect(tables).toContain("accounts");
      expect(tables).toContain("contacts");
      expect(tables).toContain("pipelines");
      expect(tables).toContain("deals");
      expect(tables).toContain("workflows");
      expect(tables).toContain("ai_calls");
      expect(tables).toContain("messages");
    });
  });

  describe("validateSQLSafety", () => {
    it("should allow safe ALTER TABLE statements", () => {
      expect(() =>
        validateSQLSafety("ALTER TABLE contacts ADD COLUMN notes TEXT;")
      ).not.toThrow();
    });

    it("should allow safe CREATE TABLE statements", () => {
      expect(() =>
        validateSQLSafety("CREATE TABLE new_feature (id INT PRIMARY KEY);")
      ).not.toThrow();
    });

    it("should allow safe INSERT statements", () => {
      expect(() =>
        validateSQLSafety(
          "INSERT INTO contacts (name, email) VALUES ('John', 'john@test.com');"
        )
      ).not.toThrow();
    });

    it("should allow DELETE with WHERE clause", () => {
      expect(() =>
        validateSQLSafety("DELETE FROM contacts WHERE id = 123;")
      ).not.toThrow();
    });

    it("should allow safe CREATE INDEX statements", () => {
      expect(() =>
        validateSQLSafety("CREATE INDEX idx_contacts_email ON contacts(email);")
      ).not.toThrow();
    });

    it("should BLOCK DROP TABLE on protected tables", () => {
      expect(() =>
        validateSQLSafety("DROP TABLE contacts;")
      ).toThrow(/BLOCKED.*DROP.*contacts/);
    });

    it("should BLOCK DROP TABLE IF EXISTS on protected tables", () => {
      expect(() =>
        validateSQLSafety("DROP TABLE IF EXISTS users;")
      ).toThrow(/BLOCKED.*DROP.*users/);
    });

    it("should BLOCK TRUNCATE on protected tables", () => {
      expect(() =>
        validateSQLSafety("TRUNCATE TABLE accounts;")
      ).toThrow(/BLOCKED.*TRUNCATE.*accounts/);
    });

    it("should BLOCK TRUNCATE on ai_calls", () => {
      expect(() =>
        validateSQLSafety("TRUNCATE ai_calls;")
      ).toThrow(/BLOCKED.*TRUNCATE.*ai_calls/);
    });

    it("should BLOCK DROP TABLE on pipelines", () => {
      expect(() =>
        validateSQLSafety("DROP TABLE pipelines;")
      ).toThrow(/BLOCKED.*DROP.*pipelines/);
    });

    it("should BLOCK DROP TABLE on deals", () => {
      expect(() =>
        validateSQLSafety("DROP TABLE deals;")
      ).toThrow(/BLOCKED.*DROP.*deals/);
    });

    it("should BLOCK DROP TABLE on workflows", () => {
      expect(() =>
        validateSQLSafety("DROP TABLE workflows;")
      ).toThrow(/BLOCKED.*DROP.*workflows/);
    });

    it("should BLOCK DELETE without WHERE clause", () => {
      expect(() =>
        validateSQLSafety("DELETE FROM contacts;")
      ).toThrow(/BLOCKED.*DELETE without WHERE/);
    });

    it("should handle case-insensitive detection", () => {
      expect(() =>
        validateSQLSafety("drop table CONTACTS;")
      ).toThrow(/BLOCKED/);
    });

    it("should allow DROP TABLE on non-protected tables", () => {
      expect(() =>
        validateSQLSafety("DROP TABLE temp_import_staging;")
      ).not.toThrow();
    });

    it("should allow TRUNCATE on non-protected tables", () => {
      expect(() =>
        validateSQLSafety("TRUNCATE temp_cache;")
      ).not.toThrow();
    });
  });

  describe("logMigrationSafety", () => {
    it("should not throw when logging", () => {
      expect(() => logMigrationSafety("0009_add_new_column")).not.toThrow();
    });
  });

  describe("package.json db:push script safety", () => {
    it("should use generate && migrate (not push)", async () => {
      const fs = await import("fs");
      const pkg = JSON.parse(
        fs.readFileSync("/home/ubuntu/apex-system/package.json", "utf-8")
      );
      const dbPush = pkg.scripts["db:push"];

      // Must use generate && migrate (safe additive approach)
      expect(dbPush).toContain("drizzle-kit generate");
      expect(dbPush).toContain("drizzle-kit migrate");

      // Must NOT use drizzle-kit push (destructive)
      expect(dbPush).not.toMatch(/drizzle-kit push(?!\s)/);
    });

    it("should not have any reset or drop scripts", async () => {
      const fs = await import("fs");
      const pkg = JSON.parse(
        fs.readFileSync("/home/ubuntu/apex-system/package.json", "utf-8")
      );
      const scripts = Object.entries(pkg.scripts) as [string, string][];

      for (const [name, cmd] of scripts) {
        expect(cmd.toLowerCase()).not.toContain("migrate reset");
        expect(cmd.toLowerCase()).not.toContain("db:reset");
        expect(cmd.toLowerCase()).not.toContain("drop database");
      }
    });

    it("should not have prestart or prebuild hooks that touch the database", async () => {
      const fs = await import("fs");
      const pkg = JSON.parse(
        fs.readFileSync("/home/ubuntu/apex-system/package.json", "utf-8")
      );

      expect(pkg.scripts.prestart).toBeUndefined();
      expect(pkg.scripts.prebuild).toBeUndefined();
      expect(pkg.scripts.postinstall).toBeUndefined();
    });
  });

  describe("migration files safety", () => {
    it("should not contain DROP TABLE in any migration file", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const drizzleDir = "/home/ubuntu/apex-system/drizzle";
      const files = fs.readdirSync(drizzleDir).filter((f: string) => f.endsWith(".sql"));

      for (const file of files) {
        const content = fs.readFileSync(path.join(drizzleDir, file), "utf-8");
        const upper = content.toUpperCase();
        expect(upper).not.toContain("DROP TABLE");
        expect(upper).not.toContain("TRUNCATE");
      }
    });
  });
});
