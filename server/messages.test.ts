import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMockContext(
  overrides: Partial<AuthenticatedUser> = {}
): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-1",
    email: "admin@test.com",
    name: "Test Admin",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
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

describe("messages router", () => {
  describe("router structure", () => {
    it("has a messages router with expected procedures", () => {
      const caller = appRouter.createCaller(createMockContext());
      expect(caller.messages).toBeDefined();
      expect(caller.messages.send).toBeDefined();
      expect(caller.messages.list).toBeDefined();
      expect(caller.messages.get).toBeDefined();
      expect(caller.messages.byContact).toBeDefined();
      expect(caller.messages.delete).toBeDefined();
      expect(caller.messages.stats).toBeDefined();
      expect(caller.messages.updateStatus).toBeDefined();
      expect(caller.messages.logInbound).toBeDefined();
    });
  });

  describe("authentication", () => {
    it("rejects unauthenticated users on send", async () => {
      const caller = appRouter.createCaller(createUnauthContext());
      await expect(
        caller.messages.send({
          accountId: 1,
          contactId: 1,
          type: "email",
          subject: "Test",
          body: "Hello",
          toAddress: "test@test.com",
        })
      ).rejects.toThrow();
    });

    it("rejects unauthenticated users on list", async () => {
      const caller = appRouter.createCaller(createUnauthContext());
      await expect(
        caller.messages.list({ accountId: 1 })
      ).rejects.toThrow();
    });

    it("rejects unauthenticated users on stats", async () => {
      const caller = appRouter.createCaller(createUnauthContext());
      await expect(
        caller.messages.stats({ accountId: 1 })
      ).rejects.toThrow();
    });
  });

  describe("input validation", () => {
    it("rejects send with empty body", async () => {
      const caller = appRouter.createCaller(createMockContext());
      await expect(
        caller.messages.send({
          accountId: 1,
          contactId: 1,
          type: "email",
          subject: "Test",
          body: "",
          toAddress: "test@test.com",
        })
      ).rejects.toThrow();
    });

    it("rejects send with empty toAddress", async () => {
      const caller = appRouter.createCaller(createMockContext());
      await expect(
        caller.messages.send({
          accountId: 1,
          contactId: 1,
          type: "sms",
          body: "Hello",
          toAddress: "",
        })
      ).rejects.toThrow();
    });

    it("rejects send with invalid type", async () => {
      const caller = appRouter.createCaller(createMockContext());
      await expect(
        caller.messages.send({
          accountId: 1,
          contactId: 1,
          type: "fax" as any,
          body: "Hello",
          toAddress: "test@test.com",
        })
      ).rejects.toThrow();
    });

    it("rejects list with invalid accountId", async () => {
      const caller = appRouter.createCaller(createMockContext());
      await expect(
        caller.messages.list({ accountId: -1 })
      ).rejects.toThrow();
    });

    it("rejects list with limit > 100", async () => {
      const caller = appRouter.createCaller(createMockContext());
      await expect(
        caller.messages.list({ accountId: 1, limit: 200 })
      ).rejects.toThrow();
    });

    it("rejects updateStatus with invalid status", async () => {
      const caller = appRouter.createCaller(createMockContext());
      await expect(
        caller.messages.updateStatus({
          id: 1,
          accountId: 1,
          status: "unknown" as any,
        })
      ).rejects.toThrow();
    });

    it("rejects logInbound with empty body", async () => {
      const caller = appRouter.createCaller(createMockContext());
      await expect(
        caller.messages.logInbound({
          accountId: 1,
          contactId: 1,
          type: "email",
          body: "",
          fromAddress: "sender@test.com",
        })
      ).rejects.toThrow();
    });

    it("rejects delete with invalid id", async () => {
      const caller = appRouter.createCaller(createMockContext());
      await expect(
        caller.messages.delete({ id: -1, accountId: 1 })
      ).rejects.toThrow();
    });
  });

  describe("message types", () => {
    it("accepts email type", async () => {
      const caller = appRouter.createCaller(createMockContext());
      // This will fail at DB level but validates the type is accepted
      try {
        await caller.messages.send({
          accountId: 999999,
          contactId: 1,
          type: "email",
          subject: "Test Subject",
          body: "Test body",
          toAddress: "test@test.com",
        });
      } catch (e: any) {
        // Expected to fail at DB/contact lookup level, not validation
        expect(e.message).not.toContain("invalid_enum_value");
      }
    });

    it("accepts sms type", async () => {
      const caller = appRouter.createCaller(createMockContext());
      try {
        await caller.messages.send({
          accountId: 999999,
          contactId: 1,
          type: "sms",
          body: "Test SMS",
          toAddress: "+1234567890",
        });
      } catch (e: any) {
        expect(e.message).not.toContain("invalid_enum_value");
      }
    });
  });

  describe("direction filters", () => {
    it("accepts outbound direction filter", async () => {
      const caller = appRouter.createCaller(createMockContext());
      try {
        await caller.messages.list({
          accountId: 999999,
          direction: "outbound",
        });
      } catch (e: any) {
        expect(e.message).not.toContain("invalid_enum_value");
      }
    });

    it("accepts inbound direction filter", async () => {
      const caller = appRouter.createCaller(createMockContext());
      try {
        await caller.messages.list({
          accountId: 999999,
          direction: "inbound",
        });
      } catch (e: any) {
        expect(e.message).not.toContain("invalid_enum_value");
      }
    });
  });

  describe("status values", () => {
    const validStatuses = [
      "pending",
      "sent",
      "delivered",
      "failed",
      "bounced",
    ] as const;

    validStatuses.forEach((status) => {
      it(`accepts ${status} status in updateStatus`, async () => {
        const caller = appRouter.createCaller(createMockContext());
        try {
          await caller.messages.updateStatus({
            id: 999999,
            accountId: 999999,
            status,
          });
        } catch (e: any) {
          // Should fail at DB level, not validation
          expect(e.message).not.toContain("invalid_enum_value");
        }
      });
    });
  });
});
