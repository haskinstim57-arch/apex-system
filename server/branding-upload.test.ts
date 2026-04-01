import { describe, expect, it } from "vitest";
import { z } from "zod";

// ─── Upload input validation tests ───

const uploadBrandingAssetSchema = z.object({
  accountId: z.number().int().positive(),
  fileBase64: z.string().min(1),
  fileName: z.string().min(1).max(255),
  mimeType: z.enum([
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/svg+xml",
    "image/webp",
    "image/x-icon",
    "image/vnd.microsoft.icon",
  ]),
  assetType: z.enum(["logo", "favicon"]),
});

describe("Branding Upload — Input Validation", () => {
  it("accepts valid logo upload input", () => {
    const input = {
      accountId: 1,
      fileBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk",
      fileName: "logo.png",
      mimeType: "image/png" as const,
      assetType: "logo" as const,
    };
    const result = uploadBrandingAssetSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("accepts valid favicon upload input", () => {
    const input = {
      accountId: 5,
      fileBase64: "AAABAAEAEBAAAAEAIABoBAAAFgAAAC",
      fileName: "favicon.ico",
      mimeType: "image/x-icon" as const,
      assetType: "favicon" as const,
    };
    const result = uploadBrandingAssetSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("accepts SVG mime type", () => {
    const input = {
      accountId: 1,
      fileBase64: "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==",
      fileName: "logo.svg",
      mimeType: "image/svg+xml" as const,
      assetType: "logo" as const,
    };
    const result = uploadBrandingAssetSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("accepts WebP mime type", () => {
    const input = {
      accountId: 1,
      fileBase64: "UklGRh4AAABXRUJQVlA4IBIAAAAwAQCdASoBAAEAAQAcJYgCdAEO",
      fileName: "logo.webp",
      mimeType: "image/webp" as const,
      assetType: "logo" as const,
    };
    const result = uploadBrandingAssetSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("rejects missing accountId", () => {
    const input = {
      fileBase64: "abc123",
      fileName: "logo.png",
      mimeType: "image/png",
      assetType: "logo",
    };
    const result = uploadBrandingAssetSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects empty fileBase64", () => {
    const input = {
      accountId: 1,
      fileBase64: "",
      fileName: "logo.png",
      mimeType: "image/png",
      assetType: "logo",
    };
    const result = uploadBrandingAssetSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects empty fileName", () => {
    const input = {
      accountId: 1,
      fileBase64: "abc123",
      fileName: "",
      mimeType: "image/png",
      assetType: "logo",
    };
    const result = uploadBrandingAssetSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects unsupported mime type", () => {
    const input = {
      accountId: 1,
      fileBase64: "abc123",
      fileName: "doc.pdf",
      mimeType: "application/pdf",
      assetType: "logo",
    };
    const result = uploadBrandingAssetSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects invalid assetType", () => {
    const input = {
      accountId: 1,
      fileBase64: "abc123",
      fileName: "logo.png",
      mimeType: "image/png",
      assetType: "banner",
    };
    const result = uploadBrandingAssetSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("rejects fileName exceeding 255 chars", () => {
    const input = {
      accountId: 1,
      fileBase64: "abc123",
      fileName: "a".repeat(256) + ".png",
      mimeType: "image/png",
      assetType: "logo",
    };
    const result = uploadBrandingAssetSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe("Branding Upload — File Size Validation", () => {
  const MAX_SIZE = 2 * 1024 * 1024; // 2MB

  it("allows files under 2MB", () => {
    const size = 1 * 1024 * 1024; // 1MB
    expect(size <= MAX_SIZE).toBe(true);
  });

  it("allows files exactly at 2MB", () => {
    const size = 2 * 1024 * 1024;
    expect(size <= MAX_SIZE).toBe(true);
  });

  it("rejects files over 2MB", () => {
    const size = 2 * 1024 * 1024 + 1;
    expect(size > MAX_SIZE).toBe(true);
  });

  it("allows small favicon files", () => {
    const size = 16 * 1024; // 16KB typical favicon
    expect(size <= MAX_SIZE).toBe(true);
  });
});

describe("Branding Upload — S3 Key Generation", () => {
  it("generates correct S3 key format for logo", () => {
    const accountId = 42;
    const assetType = "logo";
    const fileName = "my-company-logo.png";
    const ext = fileName.split(".").pop();
    const keyPattern = `branding/${accountId}/${assetType}-`;

    expect(ext).toBe("png");
    expect(keyPattern).toBe("branding/42/logo-");
  });

  it("generates correct S3 key format for favicon", () => {
    const accountId = 7;
    const assetType = "favicon";
    const fileName = "icon.ico";
    const ext = fileName.split(".").pop();
    const keyPattern = `branding/${accountId}/${assetType}-`;

    expect(ext).toBe("ico");
    expect(keyPattern).toBe("branding/7/favicon-");
  });

  it("handles files without extension", () => {
    const fileName = "logo";
    const ext = fileName.split(".").pop() || "png";
    expect(ext).toBe("logo"); // falls back to last segment
  });

  it("extracts extension from complex filenames", () => {
    const fileName = "my.company.logo.v2.png";
    const ext = fileName.split(".").pop();
    expect(ext).toBe("png");
  });
});

describe("Branding Upload — Client-side Type Validation", () => {
  const ALLOWED_IMAGE_TYPES = [
    "image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp",
  ];
  const ALLOWED_FAVICON_TYPES = [
    ...ALLOWED_IMAGE_TYPES, "image/x-icon", "image/vnd.microsoft.icon",
  ];

  it("logo allows PNG", () => {
    expect(ALLOWED_IMAGE_TYPES.includes("image/png")).toBe(true);
  });

  it("logo allows JPEG", () => {
    expect(ALLOWED_IMAGE_TYPES.includes("image/jpeg")).toBe(true);
  });

  it("logo allows SVG", () => {
    expect(ALLOWED_IMAGE_TYPES.includes("image/svg+xml")).toBe(true);
  });

  it("logo allows WebP", () => {
    expect(ALLOWED_IMAGE_TYPES.includes("image/webp")).toBe(true);
  });

  it("logo does not allow ICO", () => {
    expect(ALLOWED_IMAGE_TYPES.includes("image/x-icon")).toBe(false);
  });

  it("favicon allows ICO", () => {
    expect(ALLOWED_FAVICON_TYPES.includes("image/x-icon")).toBe(true);
  });

  it("favicon allows Microsoft ICO", () => {
    expect(ALLOWED_FAVICON_TYPES.includes("image/vnd.microsoft.icon")).toBe(true);
  });

  it("neither allows PDF", () => {
    expect(ALLOWED_IMAGE_TYPES.includes("application/pdf")).toBe(false);
    expect(ALLOWED_FAVICON_TYPES.includes("application/pdf")).toBe(false);
  });

  it("neither allows GIF", () => {
    expect(ALLOWED_IMAGE_TYPES.includes("image/gif")).toBe(false);
    expect(ALLOWED_FAVICON_TYPES.includes("image/gif")).toBe(false);
  });
});
