import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderEmailTemplate, MERGE_TAGS } from "./utils/emailTemplateRenderer";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB helpers ───
vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    createEmailTemplate: vi.fn().mockResolvedValue({ id: 1 }),
    listEmailTemplates: vi.fn().mockResolvedValue([
      {
        id: 1,
        accountId: 10,
        name: "Welcome Email",
        subject: "Welcome {{contact.firstName}}!",
        htmlContent: "<h1>Hello</h1>",
        jsonBlocks: "[]",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        accountId: 10,
        name: "Follow-up",
        subject: "Following up",
        htmlContent: "<p>Hi there</p>",
        jsonBlocks: "[]",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]),
    getEmailTemplate: vi.fn().mockImplementation(async (id: number) => {
      if (id === 1) {
        return {
          id: 1,
          accountId: 10,
          name: "Welcome Email",
          subject: "Welcome {{contact.firstName}}!",
          htmlContent: "<h1>Hello {{contact.firstName}}</h1>",
          jsonBlocks: "[]",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      if (id === 999) return null;
      return null;
    }),
    updateEmailTemplate: vi.fn().mockResolvedValue(undefined),
    deleteEmailTemplate: vi.fn().mockResolvedValue(undefined),
    getMember: vi.fn().mockResolvedValue({ id: 1, role: "owner" }),
  };
});

// ─── Context helpers ───
function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-user",
      email: "admin@test.com",
      name: "Admin",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
  return {
    user: {
      id: 2,
      openId: "regular-user",
      email: "user@test.com",
      name: "User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ═══════════════════════════════════════════
// renderEmailTemplate unit tests
// ═══════════════════════════════════════════
describe("renderEmailTemplate", () => {
  const contact = {
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    phone: "+15551234567",
    company: "Acme Corp",
  };

  it("replaces {{contact.firstName}} merge tags", () => {
    const result = renderEmailTemplate("Hello {{contact.firstName}}!", contact);
    expect(result).toBe("Hello John!");
  });

  it("replaces {{contact.lastName}} merge tags", () => {
    const result = renderEmailTemplate("Dear {{contact.lastName}}", contact);
    expect(result).toBe("Dear Doe");
  });

  it("replaces {{contact.email}} merge tags", () => {
    const result = renderEmailTemplate("Email: {{contact.email}}", contact);
    expect(result).toBe("Email: john@example.com");
  });

  it("replaces {{contact.phone}} merge tags", () => {
    const result = renderEmailTemplate("Call: {{contact.phone}}", contact);
    expect(result).toBe("Call: +15551234567");
  });

  it("replaces {{contact.company}} merge tags", () => {
    const result = renderEmailTemplate("Company: {{contact.company}}", contact);
    expect(result).toBe("Company: Acme Corp");
  });

  it("replaces {{contact.fullName}} with first + last", () => {
    const result = renderEmailTemplate("Name: {{contact.fullName}}", contact);
    expect(result).toBe("Name: John Doe");
  });

  it("replaces shorthand {{firstName}} format", () => {
    const result = renderEmailTemplate("Hi {{firstName}}!", contact);
    expect(result).toBe("Hi John!");
  });

  it("replaces shorthand {{fullName}} format", () => {
    const result = renderEmailTemplate("Hi {{fullName}}!", contact);
    expect(result).toBe("Hi John Doe!");
  });

  it("replaces multiple merge tags in one template", () => {
    const template = "Hello {{contact.firstName}} {{contact.lastName}}, your email is {{contact.email}}";
    const result = renderEmailTemplate(template, contact);
    expect(result).toBe("Hello John Doe, your email is john@example.com");
  });

  it("handles missing contact fields gracefully (empty string)", () => {
    const result = renderEmailTemplate("Hello {{contact.firstName}}!", {});
    expect(result).toBe("Hello !");
  });

  it("handles null contact fields gracefully", () => {
    const result = renderEmailTemplate("Hello {{contact.firstName}}!", {
      firstName: null,
    });
    expect(result).toBe("Hello !");
  });

  it("returns empty string for empty template", () => {
    expect(renderEmailTemplate("", contact)).toBe("");
  });

  it("handles fullName when only firstName is provided", () => {
    const result = renderEmailTemplate("{{contact.fullName}}", { firstName: "Jane" });
    expect(result).toBe("Jane");
  });

  it("handles fullName when only lastName is provided", () => {
    const result = renderEmailTemplate("{{contact.fullName}}", { lastName: "Smith" });
    expect(result).toBe("Smith");
  });
});

// ═══════════════════════════════════════════
// MERGE_TAGS constant
// ═══════════════════════════════════════════
describe("MERGE_TAGS", () => {
  it("exports 6 merge tags", () => {
    expect(MERGE_TAGS).toHaveLength(6);
  });

  it("includes firstName, lastName, fullName, email, phone, company", () => {
    const labels = MERGE_TAGS.map((t) => t.label);
    expect(labels).toContain("First Name");
    expect(labels).toContain("Last Name");
    expect(labels).toContain("Full Name");
    expect(labels).toContain("Email");
    expect(labels).toContain("Phone");
    expect(labels).toContain("Company");
  });
});

// ═══════════════════════════════════════════
// emailTemplates tRPC procedures
// ═══════════════════════════════════════════
describe("emailTemplates router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("returns templates for an account (admin)", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const result = await caller.emailTemplates.list({ accountId: 10 });
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Welcome Email");
    });

    it("returns templates for an account (member)", async () => {
      const caller = appRouter.createCaller(createUserContext());
      const result = await caller.emailTemplates.list({ accountId: 10 });
      expect(result).toHaveLength(2);
    });

    it("rejects unauthenticated users", async () => {
      const caller = appRouter.createCaller(createUnauthContext());
      await expect(caller.emailTemplates.list({ accountId: 10 })).rejects.toThrow();
    });
  });

  describe("get", () => {
    it("returns a template by ID", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const result = await caller.emailTemplates.get({ id: 1 });
      expect(result.name).toBe("Welcome Email");
      expect(result.subject).toBe("Welcome {{contact.firstName}}!");
    });

    it("throws NOT_FOUND for non-existent template", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      await expect(caller.emailTemplates.get({ id: 999 })).rejects.toThrow("Template not found");
    });
  });

  describe("create", () => {
    it("creates a template and returns the ID", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const result = await caller.emailTemplates.create({
        accountId: 10,
        name: "New Template",
        subject: "Hello!",
        htmlContent: "<h1>Hi</h1>",
        jsonBlocks: "[]",
      });
      expect(result).toEqual({ id: 1 });
    });

    it("rejects empty name", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      await expect(
        caller.emailTemplates.create({
          accountId: 10,
          name: "",
          subject: "Hello!",
        })
      ).rejects.toThrow();
    });
  });

  describe("update", () => {
    it("updates a template successfully", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const result = await caller.emailTemplates.update({
        id: 1,
        name: "Updated Name",
        subject: "Updated Subject",
      });
      expect(result).toEqual({ success: true });
    });

    it("throws NOT_FOUND for non-existent template", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      await expect(
        caller.emailTemplates.update({ id: 999, name: "Test" })
      ).rejects.toThrow("Template not found");
    });
  });

  describe("delete", () => {
    it("deletes a template successfully", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const result = await caller.emailTemplates.delete({ id: 1 });
      expect(result).toEqual({ success: true });
    });

    it("throws NOT_FOUND for non-existent template", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      await expect(caller.emailTemplates.delete({ id: 999 })).rejects.toThrow(
        "Template not found"
      );
    });
  });
});
