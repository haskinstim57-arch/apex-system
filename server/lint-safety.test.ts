import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

describe("ESLint Safety Rules", () => {
  it("should block direct process.env.VAPI_API_KEY reads outside env.ts", () => {
    // Create a temporary test file
    const testFile = path.join(process.cwd(), "server", "__test-vapi-bad.ts");
    const code = "const apiKey = process.env.VAPI_API_KEY;";
    fs.writeFileSync(testFile, code);

    try {
      execSync(`npx eslint "${testFile}" --max-warnings=0`, { stdio: "pipe" });
      expect.fail("ESLint should have blocked direct process.env.VAPI_API_KEY read");
    } catch (err: any) {
      const output = err.stdout?.toString() || err.stderr?.toString();
      expect(output).toContain("Direct integration env reads forbidden");
    } finally {
      fs.unlinkSync(testFile);
    }
  });

  it("should block hardcoded timezone literals like 'America/Los_Angeles'", () => {
    const testFile = path.join(process.cwd(), "server", "__test-tz-bad.ts");
    const code = 'const tz = "America/Los_Angeles";';
    fs.writeFileSync(testFile, code);

    try {
      execSync(`npx eslint "${testFile}" --max-warnings=0`, { stdio: "pipe" });
      expect.fail("ESLint should have blocked hardcoded timezone literal");
    } catch (err: any) {
      const output = err.stdout?.toString() || err.stderr?.toString();
      expect(output).toContain("Timezone literals must be imported");
    } finally {
      fs.unlinkSync(testFile);
    }
  });

  it("should allow process.env reads in server/_core/env.ts (exempt file)", () => {
    const envFile = path.join(process.cwd(), "server", "_core", "env.ts");
    if (fs.existsSync(envFile)) {
      try {
        execSync(`npx eslint "${envFile}" --max-warnings=0`, { stdio: "pipe" });
        expect(true).toBe(true);
      } catch (err: any) {
        const output = err.stdout?.toString() || err.stderr?.toString();
        expect(output).not.toContain("Direct integration env reads forbidden");
      }
    }
  });

  it("should allow timezone constants in server/utils/businessHours.ts (exempt file)", () => {
    const bhFile = path.join(process.cwd(), "server", "utils", "businessHours.ts");
    if (fs.existsSync(bhFile)) {
      try {
        execSync(`npx eslint "${bhFile}" --max-warnings=0`, { stdio: "pipe" });
        expect(true).toBe(true);
      } catch (err: any) {
        const output = err.stdout?.toString() || err.stderr?.toString();
        expect(output).not.toContain("Timezone literals must be imported");
      }
    }
  });
});
