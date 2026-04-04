import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

function createContext(
  overrides: Partial<AuthenticatedUser> = {}
): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-admin",
    email: "admin@test.com",
    name: "Test Admin",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("campaigns module", () => {
  describe("authentication", () => {
    it("requires authentication for campaigns.list", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.campaigns.list({ accountId: 1 })
      ).rejects.toThrow();
    });

    it("requires authentication for campaigns.create", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.campaigns.create({
          accountId: 1,
          name: "Test",
          type: "email",
          body: "Hello",
        })
      ).rejects.toThrow();
    });

    it("requires authentication for campaigns.stats", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.campaigns.stats({ accountId: 1 })
      ).rejects.toThrow();
    });

    it("requires authentication for campaigns.send", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.campaigns.send({ id: 1, accountId: 1 })
      ).rejects.toThrow();
    });

    it("requires authentication for templates.list", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.campaigns.templates.list({ accountId: 1 })
      ).rejects.toThrow();
    });

    it("requires authentication for templates.create", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.campaigns.templates.create({
          accountId: 1,
          name: "Test Template",
          type: "email",
          body: "Hello {{firstName}}",
        })
      ).rejects.toThrow();
    });
  });

  describe("input validation", () => {
    it("rejects campaign creation with empty name", async () => {
      const { ctx } = createContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.campaigns.create({
          accountId: 1,
          name: "",
          type: "email",
          body: "Hello",
        })
      ).rejects.toThrow();
    });

    it("rejects campaign creation with empty body", async () => {
      const { ctx } = createContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.campaigns.create({
          accountId: 1,
          name: "Test Campaign",
          type: "email",
          body: "",
        })
      ).rejects.toThrow();
    });

    it("rejects campaign creation with invalid type", async () => {
      const { ctx } = createContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.campaigns.create({
          accountId: 1,
          name: "Test",
          type: "fax" as any,
          body: "Hello",
        })
      ).rejects.toThrow();
    });

    it("rejects template creation with empty name", async () => {
      const { ctx } = createContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.campaigns.templates.create({
          accountId: 1,
          name: "",
          type: "email",
          body: "Hello",
        })
      ).rejects.toThrow();
    });

    it("rejects template creation with empty body", async () => {
      const { ctx } = createContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.campaigns.templates.create({
          accountId: 1,
          name: "Test",
          type: "email",
          body: "",
        })
      ).rejects.toThrow();
    });

    it("rejects campaign list with invalid accountId", async () => {
      const { ctx } = createContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.campaigns.list({ accountId: -1 })
      ).rejects.toThrow();
    });

    it("rejects addRecipients with empty recipients array", async () => {
      const { ctx } = createContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.campaigns.addRecipients({
          campaignId: 1,
          accountId: 1,
          recipients: [],
        })
      ).rejects.toThrow();
    });
  });

  describe("router structure", () => {
    it("has campaigns.create procedure", () => {
      expect(appRouter.campaigns.create).toBeDefined();
    });

    it("has campaigns.list procedure", () => {
      expect(appRouter.campaigns.list).toBeDefined();
    });

    it("has campaigns.get procedure", () => {
      expect(appRouter.campaigns.get).toBeDefined();
    });

    it("has campaigns.update procedure", () => {
      expect(appRouter.campaigns.update).toBeDefined();
    });

    it("has campaigns.delete procedure", () => {
      expect(appRouter.campaigns.delete).toBeDefined();
    });

    it("has campaigns.send procedure", () => {
      expect(appRouter.campaigns.send).toBeDefined();
    });

    it("has campaigns.schedule procedure", () => {
      expect(appRouter.campaigns.schedule).toBeDefined();
    });

    it("has campaigns.pause procedure", () => {
      expect(appRouter.campaigns.pause).toBeDefined();
    });

    it("has campaigns.cancel procedure", () => {
      expect(appRouter.campaigns.cancel).toBeDefined();
    });

    it("has campaigns.addRecipients procedure", () => {
      expect(appRouter.campaigns.addRecipients).toBeDefined();
    });

    it("has campaigns.removeRecipient procedure", () => {
      expect(appRouter.campaigns.removeRecipient).toBeDefined();
    });

    it("has campaigns.recipients procedure", () => {
      expect(appRouter.campaigns.recipients).toBeDefined();
    });

    it("has campaigns.recipientStats procedure", () => {
      expect(appRouter.campaigns.recipientStats).toBeDefined();
    });

    it("has campaigns.stats procedure", () => {
      expect(appRouter.campaigns.stats).toBeDefined();
    });

    it("has campaigns.templates.create procedure", () => {
      expect(appRouter.campaigns.templates.create).toBeDefined();
    });

    it("has campaigns.templates.list procedure", () => {
      expect(appRouter.campaigns.templates.list).toBeDefined();
    });

    it("has campaigns.templates.get procedure", () => {
      expect(appRouter.campaigns.templates.get).toBeDefined();
    });

    it("has campaigns.templates.update procedure", () => {
      expect(appRouter.campaigns.templates.update).toBeDefined();
    });

    it("has campaigns.templates.delete procedure", () => {
      expect(appRouter.campaigns.templates.delete).toBeDefined();
    });
  });

  describe("placeholder send functions", () => {
    it("sendCampaignEmail is exported from campaigns router", async () => {
      const { sendCampaignEmail } = await import("./routers/campaigns");
      expect(sendCampaignEmail).toBeDefined();
      expect(typeof sendCampaignEmail).toBe("function");
    });

    it("sendCampaignSMS is exported from campaigns router", async () => {
      const { sendCampaignSMS } = await import("./routers/campaigns");
      expect(sendCampaignSMS).toBeDefined();
      expect(typeof sendCampaignSMS).toBe("function");
    });

    it("sendCampaignEmail returns a result with success field", async () => {
      const { sendCampaignEmail } = await import("./routers/campaigns");
      const result = await sendCampaignEmail({
        to: "test@example.com",
        from: "noreply@test.com",
        subject: "Test",
        body: "Hello",
      });
      expect(result).toHaveProperty("success");
      expect(typeof result.success).toBe("boolean");
    });

    it("sendCampaignSMS returns a result with success field", async () => {
      const { sendCampaignSMS } = await import("./routers/campaigns");
      const result = await sendCampaignSMS({
        to: "+15551234567",
        from: "+10000000000",
        body: "Hello",
      });
      expect(result).toHaveProperty("success");
      expect(typeof result.success).toBe("boolean");
    }, 15000);
  });
});
