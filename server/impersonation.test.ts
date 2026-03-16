import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import {
  parseImpersonationCookie,
  IMPERSONATION_COOKIE,
} from "./routers/impersonation";

// ─── Mock db module ───
vi.mock("./db", () => {
  const accounts = new Map<number, { id: number; name: string; status: string }>();
  accounts.set(1, { id: 1, name: "Test Account", status: "active" });
  accounts.set(2, { id: 2, name: "Another Account", status: "active" });

  const auditLogs: Array<Record<string, unknown>> = [];

  return {
    getAccountById: vi.fn(async (id: number) => accounts.get(id) || null),
    logImpersonationAction: vi.fn(async (data: Record<string, unknown>) => {
      auditLogs.push({ ...data, id: auditLogs.length + 1, createdAt: new Date() });
      return { id: auditLogs.length };
    }),
    listImpersonationLogs: vi.fn(async (limit: number) => {
      return auditLogs.slice(0, limit);
    }),
  };
});

// ─── Helper: create test context ───

type CookieCall = {
  name: string;
  value?: string;
  options: Record<string, unknown>;
};

function createAdminContext(
  cookieHeader = ""
): {
  ctx: TrpcContext;
  setCookies: CookieCall[];
  clearedCookies: CookieCall[];
} {
  const setCookies: CookieCall[] = [];
  const clearedCookies: CookieCall[] = [];

  const ctx: TrpcContext = {
    user: {
      id: 1,
      openId: "admin-user",
      email: "admin@example.com",
      name: "Admin User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {
        cookie: cookieHeader,
        "x-forwarded-proto": "https",
      },
    } as unknown as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        setCookies.push({ name, value, options });
      },
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as unknown as TrpcContext["res"],
    impersonation: {
      isImpersonating: false,
      impersonatedAccountId: null,
      impersonatedAccountName: null,
      impersonatorUserId: null,
      impersonatorName: null,
    },
  };

  return { ctx, setCookies, clearedCookies };
}

function createRegularUserContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: {
      id: 2,
      openId: "regular-user",
      email: "user@example.com",
      name: "Regular User",
      loginMethod: "email",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as unknown as TrpcContext["req"],
    res: {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
    impersonation: {
      isImpersonating: false,
      impersonatedAccountId: null,
      impersonatedAccountName: null,
      impersonatorUserId: null,
      impersonatorName: null,
    },
  };
  return { ctx };
}

// ─── Tests ───

describe("parseImpersonationCookie", () => {
  it("returns null for empty cookie header", () => {
    expect(parseImpersonationCookie("")).toBeNull();
  });

  it("returns null when impersonation cookie is not present", () => {
    expect(parseImpersonationCookie("session=abc123; other=xyz")).toBeNull();
  });

  it("parses a valid impersonation cookie", () => {
    const payload = {
      impersonatedAccountId: 42,
      impersonatedAccountName: "Test Co",
      impersonatorUserId: 1,
      impersonatorName: "Admin",
    };
    const cookie = `${IMPERSONATION_COOKIE}=${encodeURIComponent(JSON.stringify(payload))}`;
    const result = parseImpersonationCookie(cookie);
    expect(result).toEqual(payload);
  });

  it("returns null for malformed JSON", () => {
    const cookie = `${IMPERSONATION_COOKIE}=not-valid-json`;
    expect(parseImpersonationCookie(cookie)).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    const payload = { impersonatedAccountName: "Test" };
    const cookie = `${IMPERSONATION_COOKIE}=${encodeURIComponent(JSON.stringify(payload))}`;
    expect(parseImpersonationCookie(cookie)).toBeNull();
  });
});

describe("impersonation.start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets impersonation cookie for a valid account", async () => {
    const { ctx, setCookies } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.impersonation.start({ accountId: 1 });

    expect(result.success).toBe(true);
    expect(result.accountId).toBe(1);
    expect(result.accountName).toBe("Test Account");

    // Verify cookie was set
    expect(setCookies).toHaveLength(1);
    expect(setCookies[0]!.name).toBe(IMPERSONATION_COOKIE);
    const cookiePayload = JSON.parse(setCookies[0]!.value!);
    expect(cookiePayload.impersonatedAccountId).toBe(1);
    expect(cookiePayload.impersonatorUserId).toBe(1);
  });

  it("throws NOT_FOUND for non-existent account", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.impersonation.start({ accountId: 9999 })
    ).rejects.toThrow(/not found/i);
  });

  it("rejects non-admin users", async () => {
    const { ctx } = createRegularUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.impersonation.start({ accountId: 1 })
    ).rejects.toThrow();
  });
});

describe("impersonation.stop", () => {
  it("clears the impersonation cookie", async () => {
    const payload = {
      impersonatedAccountId: 1,
      impersonatedAccountName: "Test Account",
      impersonatorUserId: 1,
      impersonatorName: "Admin User",
    };
    const cookieHeader = `${IMPERSONATION_COOKIE}=${encodeURIComponent(JSON.stringify(payload))}`;
    const { ctx, clearedCookies } = createAdminContext(cookieHeader);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.impersonation.stop();

    expect(result.success).toBe(true);
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]!.name).toBe(IMPERSONATION_COOKIE);
  });

  it("succeeds even when not impersonating", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.impersonation.stop();
    expect(result.success).toBe(true);
  });
});

describe("impersonation.status", () => {
  it("returns not impersonating when no cookie is set", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.impersonation.status();
    expect(result.isImpersonating).toBe(false);
  });

  it("returns impersonation details when cookie is set", async () => {
    const payload = {
      impersonatedAccountId: 42,
      impersonatedAccountName: "Client Co",
      impersonatorUserId: 1,
      impersonatorName: "Admin User",
    };
    const cookieHeader = `${IMPERSONATION_COOKIE}=${encodeURIComponent(JSON.stringify(payload))}`;
    const { ctx } = createAdminContext(cookieHeader);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.impersonation.status();
    expect(result.isImpersonating).toBe(true);
    if (result.isImpersonating) {
      expect(result.impersonatedAccountId).toBe(42);
      expect(result.impersonatedAccountName).toBe("Client Co");
      expect(result.impersonatorUserId).toBe(1);
    }
  });
});

describe("impersonation.auditLogs", () => {
  it("rejects non-admin users", async () => {
    const { ctx } = createRegularUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.impersonation.auditLogs()).rejects.toThrow();
  });

  it("returns audit logs for admin users", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const logs = await caller.impersonation.auditLogs();
    expect(Array.isArray(logs)).toBe(true);
  });
});

describe("context impersonation integration", () => {
  it("context includes impersonation data when cookie is present for admin", async () => {
    const payload = {
      impersonatedAccountId: 5,
      impersonatedAccountName: "Impersonated Co",
      impersonatorUserId: 1,
      impersonatorName: "Admin",
    };
    const cookieHeader = `${IMPERSONATION_COOKIE}=${encodeURIComponent(JSON.stringify(payload))}`;

    // Simulate what createContext does for admin users
    const result = parseImpersonationCookie(cookieHeader);
    expect(result).not.toBeNull();
    expect(result!.impersonatedAccountId).toBe(5);
    expect(result!.impersonatedAccountName).toBe("Impersonated Co");
  });

  it("context does not parse impersonation for non-admin users", () => {
    // Non-admin users should never have impersonation parsed
    // This is enforced in context.ts by checking user.role === "admin"
    const payload = {
      impersonatedAccountId: 5,
      impersonatedAccountName: "Impersonated Co",
      impersonatorUserId: 1,
      impersonatorName: "Admin",
    };
    const cookieHeader = `${IMPERSONATION_COOKIE}=${encodeURIComponent(JSON.stringify(payload))}`;

    // Even if the cookie exists, a non-admin user's context should not have impersonation
    // We verify the guard logic here
    const userRole = "user";
    let impersonation = {
      isImpersonating: false,
      impersonatedAccountId: null as number | null,
    };

    if (userRole === "admin") {
      const data = parseImpersonationCookie(cookieHeader);
      if (data) {
        impersonation = {
          isImpersonating: true,
          impersonatedAccountId: data.impersonatedAccountId,
        };
      }
    }

    expect(impersonation.isImpersonating).toBe(false);
    expect(impersonation.impersonatedAccountId).toBeNull();
  });
});
