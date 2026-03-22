import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import * as googleCalService from "./services/googleCalendar";
import * as outlookCalService from "./services/outlookCalendar";

// ─── Helpers ───
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(overrides?: Partial<AuthenticatedUser>): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-calsync",
    email: "lo@example.com",
    name: "Test LO",
    loginMethod: "email",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── Mocks ───
vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof db>("./db");
  return {
    ...actual,
    getCalendarIntegrations: vi.fn(),
    getActiveCalendarIntegrations: vi.fn(),
    getCalendarIntegrationByProvider: vi.fn(),
    deleteCalendarIntegration: vi.fn(),
    decryptCalendarTokens: vi.fn(),
    updateCalendarIntegration: vi.fn(),
    getMember: vi.fn(),
    // Keep the rest from actual
  };
});

vi.mock("./services/googleCalendar", async () => {
  const actual = await vi.importActual<typeof googleCalService>("./services/googleCalendar");
  return {
    ...actual,
    getGoogleOAuthUrl: vi.fn(),
    listGoogleEvents: vi.fn(),
    getGoogleBusyTimes: vi.fn(),
    createGoogleEvent: vi.fn(),
    refreshGoogleToken: vi.fn(),
  };
});

vi.mock("./services/outlookCalendar", async () => {
  const actual = await vi.importActual<typeof outlookCalService>("./services/outlookCalendar");
  return {
    ...actual,
    getOutlookOAuthUrl: vi.fn(),
    listOutlookEvents: vi.fn(),
    getOutlookBusyTimes: vi.fn(),
    createOutlookEvent: vi.fn(),
    refreshOutlookToken: vi.fn(),
  };
});

const mockDb = db as unknown as {
  getCalendarIntegrations: ReturnType<typeof vi.fn>;
  getActiveCalendarIntegrations: ReturnType<typeof vi.fn>;
  getCalendarIntegrationByProvider: ReturnType<typeof vi.fn>;
  deleteCalendarIntegration: ReturnType<typeof vi.fn>;
  decryptCalendarTokens: ReturnType<typeof vi.fn>;
  updateCalendarIntegration: ReturnType<typeof vi.fn>;
  getMember: ReturnType<typeof vi.fn>;
};

const mockGoogle = googleCalService as unknown as {
  getGoogleOAuthUrl: ReturnType<typeof vi.fn>;
  listGoogleEvents: ReturnType<typeof vi.fn>;
  getGoogleBusyTimes: ReturnType<typeof vi.fn>;
  createGoogleEvent: ReturnType<typeof vi.fn>;
  refreshGoogleToken: ReturnType<typeof vi.fn>;
};

const mockOutlook = outlookCalService as unknown as {
  getOutlookOAuthUrl: ReturnType<typeof vi.fn>;
  listOutlookEvents: ReturnType<typeof vi.fn>;
  getOutlookBusyTimes: ReturnType<typeof vi.fn>;
  createOutlookEvent: ReturnType<typeof vi.fn>;
  refreshOutlookToken: ReturnType<typeof vi.fn>;
};

const ACCOUNT_ID = 10;

const mockGoogleIntegration = {
  id: 1,
  userId: 1,
  accountId: ACCOUNT_ID,
  provider: "google" as const,
  externalEmail: "user@gmail.com",
  externalCalendarId: "primary",
  accessToken: "encrypted-google-access-token",
  refreshToken: "encrypted-google-refresh-token",
  tokenExpiresAt: new Date(Date.now() + 3600 * 1000), // valid for 1 hour
  isActive: true,
  createdAt: new Date(),
};

const mockOutlookIntegration = {
  id: 2,
  userId: 1,
  accountId: ACCOUNT_ID,
  provider: "outlook" as const,
  externalEmail: "user@outlook.com",
  externalCalendarId: "default",
  accessToken: "encrypted-outlook-access-token",
  refreshToken: "encrypted-outlook-refresh-token",
  tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
  isActive: true,
  createdAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();

  // Default: user is a member
  mockDb.getMember.mockResolvedValue({
    userId: 1,
    accountId: ACCOUNT_ID,
    role: "owner",
    isActive: true,
  });

  // Default: decrypt returns plain tokens
  mockDb.decryptCalendarTokens.mockImplementation((integration: any) => ({
    accessToken: `decrypted-${integration.provider}-access`,
    refreshToken: `decrypted-${integration.provider}-refresh`,
  }));
});

// ═══════════════════════════════════════════
// calendarSync.getGoogleOAuthUrl
// ═══════════════════════════════════════════
describe("calendarSync.getGoogleOAuthUrl", () => {
  it("returns a Google OAuth URL", async () => {
    mockGoogle.getGoogleOAuthUrl.mockReturnValue("https://accounts.google.com/o/oauth2/v2/auth?...");
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.calendarSync.getGoogleOAuthUrl({
      accountId: ACCOUNT_ID,
      origin: "https://example.com",
    });
    expect(result.url).toContain("accounts.google.com");
    expect(mockGoogle.getGoogleOAuthUrl).toHaveBeenCalledWith({
      accountId: ACCOUNT_ID,
      userId: 1,
      origin: "https://example.com",
    });
  });

  it("requires authentication", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.calendarSync.getGoogleOAuthUrl({
        accountId: ACCOUNT_ID,
        origin: "https://example.com",
      })
    ).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════
// calendarSync.getOutlookOAuthUrl
// ═══════════════════════════════════════════
describe("calendarSync.getOutlookOAuthUrl", () => {
  it("returns an Outlook OAuth URL", async () => {
    mockOutlook.getOutlookOAuthUrl.mockReturnValue("https://login.microsoftonline.com/common/oauth2/v2.0/authorize?...");
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.calendarSync.getOutlookOAuthUrl({
      accountId: ACCOUNT_ID,
      origin: "https://example.com",
    });
    expect(result.url).toContain("microsoftonline.com");
    expect(mockOutlook.getOutlookOAuthUrl).toHaveBeenCalledWith({
      accountId: ACCOUNT_ID,
      userId: 1,
      origin: "https://example.com",
    });
  });
});

// ═══════════════════════════════════════════
// calendarSync.listIntegrations
// ═══════════════════════════════════════════
describe("calendarSync.listIntegrations", () => {
  it("returns integrations without tokens", async () => {
    mockDb.getCalendarIntegrations.mockResolvedValue([mockGoogleIntegration, mockOutlookIntegration]);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.calendarSync.listIntegrations({ accountId: ACCOUNT_ID });

    expect(result).toHaveLength(2);
    expect(result[0].provider).toBe("google");
    expect(result[0].externalEmail).toBe("user@gmail.com");
    // Should NOT expose tokens
    expect((result[0] as any).accessToken).toBeUndefined();
    expect((result[0] as any).refreshToken).toBeUndefined();
  });

  it("returns empty array when no integrations", async () => {
    mockDb.getCalendarIntegrations.mockResolvedValue([]);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.calendarSync.listIntegrations({ accountId: ACCOUNT_ID });
    expect(result).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════
// calendarSync.disconnect
// ═══════════════════════════════════════════
describe("calendarSync.disconnect", () => {
  it("deletes the integration", async () => {
    mockDb.deleteCalendarIntegration.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.calendarSync.disconnect({ id: 1 });
    expect(result.success).toBe(true);
    expect(mockDb.deleteCalendarIntegration).toHaveBeenCalledWith(1, 1); // id, userId
  });

  it("requires authentication", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.calendarSync.disconnect({ id: 1 })).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════
// calendarSync.listExternalEvents
// ═══════════════════════════════════════════
describe("calendarSync.listExternalEvents", () => {
  it("fetches and merges Google and Outlook events", async () => {
    mockDb.getCalendarIntegrations.mockResolvedValue([mockGoogleIntegration, mockOutlookIntegration]);

    mockGoogle.listGoogleEvents.mockResolvedValue([
      {
        id: "g1",
        summary: "Google Meeting",
        status: "confirmed",
        start: { dateTime: "2026-03-25T10:00:00Z" },
        end: { dateTime: "2026-03-25T11:00:00Z" },
      },
    ]);

    mockOutlook.listOutlookEvents.mockResolvedValue([
      {
        id: "o1",
        subject: "Outlook Meeting",
        isCancelled: false,
        start: { dateTime: "2026-03-25T14:00:00Z" },
        end: { dateTime: "2026-03-25T15:00:00Z" },
      },
    ]);

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.calendarSync.listExternalEvents({
      accountId: ACCOUNT_ID,
      timeMin: "2026-03-24T00:00:00Z",
      timeMax: "2026-03-30T00:00:00Z",
    });

    expect(result).toHaveLength(2);
    expect(result[0].provider).toBe("google");
    expect(result[0].title).toBe("Google Meeting");
    expect(result[1].provider).toBe("outlook");
    expect(result[1].title).toBe("Outlook Meeting");
  });

  it("skips cancelled Google events", async () => {
    mockDb.getCalendarIntegrations.mockResolvedValue([mockGoogleIntegration]);
    mockGoogle.listGoogleEvents.mockResolvedValue([
      {
        id: "g1",
        summary: "Cancelled",
        status: "cancelled",
        start: { dateTime: "2026-03-25T10:00:00Z" },
        end: { dateTime: "2026-03-25T11:00:00Z" },
      },
    ]);

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.calendarSync.listExternalEvents({
      accountId: ACCOUNT_ID,
      timeMin: "2026-03-24T00:00:00Z",
      timeMax: "2026-03-30T00:00:00Z",
    });

    expect(result).toHaveLength(0);
  });

  it("skips inactive integrations", async () => {
    mockDb.getCalendarIntegrations.mockResolvedValue([
      { ...mockGoogleIntegration, isActive: false },
    ]);

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.calendarSync.listExternalEvents({
      accountId: ACCOUNT_ID,
      timeMin: "2026-03-24T00:00:00Z",
      timeMax: "2026-03-30T00:00:00Z",
    });

    expect(result).toHaveLength(0);
    expect(mockGoogle.listGoogleEvents).not.toHaveBeenCalled();
  });

  it("gracefully handles API errors from one provider", async () => {
    mockDb.getCalendarIntegrations.mockResolvedValue([mockGoogleIntegration, mockOutlookIntegration]);
    mockGoogle.listGoogleEvents.mockRejectedValue(new Error("Google API error"));
    mockOutlook.listOutlookEvents.mockResolvedValue([
      {
        id: "o1",
        subject: "Outlook Meeting",
        isCancelled: false,
        start: { dateTime: "2026-03-25T14:00:00Z" },
        end: { dateTime: "2026-03-25T15:00:00Z" },
      },
    ]);

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.calendarSync.listExternalEvents({
      accountId: ACCOUNT_ID,
      timeMin: "2026-03-24T00:00:00Z",
      timeMax: "2026-03-30T00:00:00Z",
    });

    // Should still return Outlook events even though Google failed
    expect(result).toHaveLength(1);
    expect(result[0].provider).toBe("outlook");
  });
});

// ═══════════════════════════════════════════
// calendarSync.getBusyTimes (public procedure)
// ═══════════════════════════════════════════
describe("calendarSync.getBusyTimes", () => {
  it("returns merged busy times from all active integrations", async () => {
    mockDb.getActiveCalendarIntegrations.mockResolvedValue([mockGoogleIntegration, mockOutlookIntegration]);

    mockGoogle.getGoogleBusyTimes.mockResolvedValue([
      { start: "2026-03-25T10:00:00Z", end: "2026-03-25T11:00:00Z" },
    ]);

    mockOutlook.getOutlookBusyTimes.mockResolvedValue([
      { start: "2026-03-25T14:00:00Z", end: "2026-03-25T15:00:00Z" },
    ]);

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.calendarSync.getBusyTimes({
      accountId: ACCOUNT_ID,
      timeMin: "2026-03-25T00:00:00Z",
      timeMax: "2026-03-26T00:00:00Z",
    });

    expect(result).toHaveLength(2);
    expect(result[0].start).toBe("2026-03-25T10:00:00Z");
    expect(result[1].start).toBe("2026-03-25T14:00:00Z");
  });

  it("returns empty array when no integrations", async () => {
    mockDb.getActiveCalendarIntegrations.mockResolvedValue([]);
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.calendarSync.getBusyTimes({
      accountId: ACCOUNT_ID,
      timeMin: "2026-03-25T00:00:00Z",
      timeMax: "2026-03-26T00:00:00Z",
    });
    expect(result).toHaveLength(0);
  });

  it("gracefully handles API errors", async () => {
    mockDb.getActiveCalendarIntegrations.mockResolvedValue([mockGoogleIntegration]);
    mockGoogle.getGoogleBusyTimes.mockRejectedValue(new Error("API down"));

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.calendarSync.getBusyTimes({
      accountId: ACCOUNT_ID,
      timeMin: "2026-03-25T00:00:00Z",
      timeMax: "2026-03-26T00:00:00Z",
    });

    // Should return empty array, not throw
    expect(result).toHaveLength(0);
  });

  it("is accessible without authentication (public procedure)", async () => {
    mockDb.getActiveCalendarIntegrations.mockResolvedValue([]);
    const caller = appRouter.createCaller(createPublicContext());
    // Should not throw
    const result = await caller.calendarSync.getBusyTimes({
      accountId: ACCOUNT_ID,
      timeMin: "2026-03-25T00:00:00Z",
      timeMax: "2026-03-26T00:00:00Z",
    });
    expect(result).toBeDefined();
  });
});

// ═══════════════════════════════════════════
// calendarSync.syncAppointmentToExternal
// ═══════════════════════════════════════════
describe("calendarSync.syncAppointmentToExternal", () => {
  it("creates events on both Google and Outlook", async () => {
    mockDb.getCalendarIntegrations.mockResolvedValue([mockGoogleIntegration, mockOutlookIntegration]);
    mockGoogle.createGoogleEvent.mockResolvedValue({ id: "g-new" });
    mockOutlook.createOutlookEvent.mockResolvedValue({ id: "o-new" });

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.calendarSync.syncAppointmentToExternal({
      accountId: ACCOUNT_ID,
      summary: "Appointment: 30-Min Consultation",
      description: "Meeting with John",
      startDateTime: "2026-03-25T14:00:00Z",
      endDateTime: "2026-03-25T14:30:00Z",
      guestEmail: "john@example.com",
      guestName: "John Doe",
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ provider: "google", success: true });
    expect(result[1]).toEqual({ provider: "outlook", success: true });
    expect(mockGoogle.createGoogleEvent).toHaveBeenCalled();
    expect(mockOutlook.createOutlookEvent).toHaveBeenCalled();
  });

  it("reports failure for one provider without failing the other", async () => {
    mockDb.getCalendarIntegrations.mockResolvedValue([mockGoogleIntegration, mockOutlookIntegration]);
    mockGoogle.createGoogleEvent.mockRejectedValue(new Error("Google API error"));
    mockOutlook.createOutlookEvent.mockResolvedValue({ id: "o-new" });

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.calendarSync.syncAppointmentToExternal({
      accountId: ACCOUNT_ID,
      summary: "Test Appointment",
      startDateTime: "2026-03-25T14:00:00Z",
      endDateTime: "2026-03-25T14:30:00Z",
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      provider: "google",
      success: false,
      error: "Google API error",
    });
    expect(result[1]).toEqual({ provider: "outlook", success: true });
  });

  it("skips inactive integrations", async () => {
    mockDb.getCalendarIntegrations.mockResolvedValue([
      { ...mockGoogleIntegration, isActive: false },
    ]);

    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.calendarSync.syncAppointmentToExternal({
      accountId: ACCOUNT_ID,
      summary: "Test",
      startDateTime: "2026-03-25T14:00:00Z",
      endDateTime: "2026-03-25T14:30:00Z",
    });

    expect(result).toHaveLength(0);
    expect(mockGoogle.createGoogleEvent).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════
// Token refresh flow
// ═══════════════════════════════════════════
describe("calendarSync token refresh", () => {
  it("refreshes expired Google token before fetching events", async () => {
    const expiredIntegration = {
      ...mockGoogleIntegration,
      tokenExpiresAt: new Date(Date.now() - 60000), // expired 1 minute ago
    };
    mockDb.getCalendarIntegrations.mockResolvedValue([expiredIntegration]);
    mockDb.decryptCalendarTokens.mockReturnValue({
      accessToken: "old-token",
      refreshToken: "refresh-token",
    });
    mockGoogle.refreshGoogleToken.mockResolvedValue({
      accessToken: "new-google-token",
      expiresIn: 3600,
    });
    mockDb.updateCalendarIntegration.mockResolvedValue(undefined);
    mockGoogle.listGoogleEvents.mockResolvedValue([]);

    const caller = appRouter.createCaller(createAuthContext());
    await caller.calendarSync.listExternalEvents({
      accountId: ACCOUNT_ID,
      timeMin: "2026-03-24T00:00:00Z",
      timeMax: "2026-03-30T00:00:00Z",
    });

    expect(mockGoogle.refreshGoogleToken).toHaveBeenCalledWith("refresh-token");
    expect(mockDb.updateCalendarIntegration).toHaveBeenCalledWith(
      expiredIntegration.id,
      expiredIntegration.userId,
      expect.objectContaining({
        accessToken: "new-google-token",
      })
    );
    expect(mockGoogle.listGoogleEvents).toHaveBeenCalledWith(
      "new-google-token",
      expect.any(String),
      expect.any(String),
      expect.any(String)
    );
  });

  it("refreshes expired Outlook token before fetching busy times", async () => {
    const expiredIntegration = {
      ...mockOutlookIntegration,
      tokenExpiresAt: new Date(Date.now() - 60000),
    };
    mockDb.getActiveCalendarIntegrations.mockResolvedValue([expiredIntegration]);
    mockDb.decryptCalendarTokens.mockReturnValue({
      accessToken: "old-outlook-token",
      refreshToken: "outlook-refresh-token",
    });
    mockOutlook.refreshOutlookToken.mockResolvedValue({
      accessToken: "new-outlook-token",
      expiresIn: 3600,
      refreshToken: "new-outlook-refresh",
    });
    mockDb.updateCalendarIntegration.mockResolvedValue(undefined);
    mockOutlook.getOutlookBusyTimes.mockResolvedValue([]);

    const caller = appRouter.createCaller(createPublicContext());
    await caller.calendarSync.getBusyTimes({
      accountId: ACCOUNT_ID,
      timeMin: "2026-03-25T00:00:00Z",
      timeMax: "2026-03-26T00:00:00Z",
    });

    expect(mockOutlook.refreshOutlookToken).toHaveBeenCalledWith("outlook-refresh-token");
    expect(mockDb.updateCalendarIntegration).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════
// Router structure
// ═══════════════════════════════════════════
describe("calendarSync router structure", () => {
  it("has all expected procedures", () => {
    const caller = appRouter.createCaller(createAuthContext());
    expect(typeof caller.calendarSync.getGoogleOAuthUrl).toBe("function");
    expect(typeof caller.calendarSync.getOutlookOAuthUrl).toBe("function");
    expect(typeof caller.calendarSync.listIntegrations).toBe("function");
    expect(typeof caller.calendarSync.disconnect).toBe("function");
    expect(typeof caller.calendarSync.listExternalEvents).toBe("function");
    expect(typeof caller.calendarSync.getBusyTimes).toBe("function");
    expect(typeof caller.calendarSync.syncAppointmentToExternal).toBe("function");
  });
});
