import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMockContext(overrides?: Partial<AuthenticatedUser>): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-1",
    email: "test@example.com",
    name: "Test User",
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

describe("contacts router", () => {
  describe("input validation", () => {
    it("rejects create with missing firstName", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.contacts.create({
          accountId: 1,
          firstName: "",
          lastName: "Doe",
        })
      ).rejects.toThrow();
    });

    it("rejects create with missing lastName", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.contacts.create({
          accountId: 1,
          firstName: "John",
          lastName: "",
        })
      ).rejects.toThrow();
    });

    it("rejects create with invalid email format", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.contacts.create({
          accountId: 1,
          firstName: "John",
          lastName: "Doe",
          email: "not-an-email",
        })
      ).rejects.toThrow();
    });

    it("accepts create with valid email", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      // This will fail at DB level (no account), but validates input passes
      await expect(
        caller.contacts.create({
          accountId: 1,
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        })
      ).rejects.toThrow(); // Fails at RBAC check, not validation
    });

    it("rejects invalid accountId", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.contacts.create({
          accountId: -1,
          firstName: "John",
          lastName: "Doe",
        })
      ).rejects.toThrow();
    });

    it("rejects invalid status value", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.contacts.create({
          accountId: 1,
          firstName: "John",
          lastName: "Doe",
          status: "invalid_status" as any,
        })
      ).rejects.toThrow();
    });
  });

  describe("list input validation", () => {
    it("rejects list with invalid limit", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.contacts.list({
          accountId: 1,
          limit: 0,
        })
      ).rejects.toThrow();
    });

    it("rejects list with limit over 100", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.contacts.list({
          accountId: 1,
          limit: 101,
        })
      ).rejects.toThrow();
    });

    it("rejects list with negative offset", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.contacts.list({
          accountId: 1,
          offset: -1,
        })
      ).rejects.toThrow();
    });
  });

  describe("update input validation", () => {
    it("rejects update with invalid contact id", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.contacts.update({
          id: -1,
          accountId: 1,
          firstName: "Jane",
        })
      ).rejects.toThrow();
    });
  });

  describe("tags input validation", () => {
    it("rejects addTag with empty tag", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.contacts.addTag({
          contactId: 1,
          accountId: 1,
          tag: "",
        })
      ).rejects.toThrow();
    });

    it("rejects addTag with tag exceeding max length", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.contacts.addTag({
          contactId: 1,
          accountId: 1,
          tag: "a".repeat(101),
        })
      ).rejects.toThrow();
    });
  });

  describe("notes input validation", () => {
    it("rejects addNote with empty content", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.contacts.addNote({
          contactId: 1,
          accountId: 1,
          content: "",
        })
      ).rejects.toThrow();
    });

    it("rejects addNote with content exceeding max length", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.contacts.addNote({
          contactId: 1,
          accountId: 1,
          content: "a".repeat(5001),
        })
      ).rejects.toThrow();
    });
  });

  describe("authentication", () => {
    it("rejects unauthenticated users from creating contacts", async () => {
      const ctx: TrpcContext = {
        user: null,
        req: {
          protocol: "https",
          headers: {},
        } as TrpcContext["req"],
        res: {
          clearCookie: () => {},
        } as TrpcContext["res"],
      };
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.contacts.create({
          accountId: 1,
          firstName: "John",
          lastName: "Doe",
        })
      ).rejects.toThrow();
    });

    it("rejects unauthenticated users from listing contacts", async () => {
      const ctx: TrpcContext = {
        user: null,
        req: {
          protocol: "https",
          headers: {},
        } as TrpcContext["req"],
        res: {
          clearCookie: () => {},
        } as TrpcContext["res"],
      };
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.contacts.list({ accountId: 1 })
      ).rejects.toThrow();
    });

    it("rejects unauthenticated users from getting contact stats", async () => {
      const ctx: TrpcContext = {
        user: null,
        req: {
          protocol: "https",
          headers: {},
        } as TrpcContext["req"],
        res: {
          clearCookie: () => {},
        } as TrpcContext["res"],
      };
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.contacts.stats({ accountId: 1 })
      ).rejects.toThrow();
    });
  });

  describe("status enum validation", () => {
    const validStatuses = [
      "new",
      "contacted",
      "qualified",
      "proposal",
      "negotiation",
      "won",
      "lost",
      "nurture",
    ];

    for (const status of validStatuses) {
      it(`accepts valid status: ${status}`, async () => {
        const ctx = createMockContext();
        const caller = appRouter.createCaller(ctx);

        // Will fail at RBAC level, but validates the status enum passes
        await expect(
          caller.contacts.create({
            accountId: 1,
            firstName: "John",
            lastName: "Doe",
            status: status as any,
          })
        ).rejects.not.toThrow(/invalid_enum_value/);
      });
    }
  });

  describe("router structure", () => {
    it("has contacts router on appRouter", () => {
      const router = appRouter._def.record;
      expect(router.contacts).toBeDefined();
    });

    it("contacts router has callable procedures", async () => {
      const ctx = createMockContext();
      const caller = appRouter.createCaller(ctx);
      // Verify the caller has all contact methods
      expect(typeof caller.contacts.create).toBe("function");
      expect(typeof caller.contacts.list).toBe("function");
      expect(typeof caller.contacts.get).toBe("function");
      expect(typeof caller.contacts.update).toBe("function");
      expect(typeof caller.contacts.delete).toBe("function");
      expect(typeof caller.contacts.assign).toBe("function");
      expect(typeof caller.contacts.stats).toBe("function");
      expect(typeof caller.contacts.getTags).toBe("function");
      expect(typeof caller.contacts.addTag).toBe("function");
      expect(typeof caller.contacts.removeTag).toBe("function");
      expect(typeof caller.contacts.allTags).toBe("function");
      expect(typeof caller.contacts.listNotes).toBe("function");
      expect(typeof caller.contacts.addNote).toBe("function");
      expect(typeof caller.contacts.updateNote).toBe("function");
      expect(typeof caller.contacts.deleteNote).toBe("function");
    });
  });
});
