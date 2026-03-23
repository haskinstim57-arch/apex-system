import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock db functions
vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getNotifications: vi.fn(),
    getUnreadNotificationCount: vi.fn(),
    markNotificationAsRead: vi.fn(),
    markAllNotificationsAsRead: vi.fn(),
    dismissNotification: vi.fn(),
    getMember: vi.fn(),
  };
});

import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  dismissNotification,
  getMember,
} from "./db";

const mockGetNotifications = getNotifications as ReturnType<typeof vi.fn>;
const mockGetUnreadNotificationCount = getUnreadNotificationCount as ReturnType<typeof vi.fn>;
const mockMarkAsRead = markNotificationAsRead as ReturnType<typeof vi.fn>;
const mockMarkAllAsRead = markAllNotificationsAsRead as ReturnType<typeof vi.fn>;
const mockDismiss = dismissNotification as ReturnType<typeof vi.fn>;
const mockGetMember = getMember as ReturnType<typeof vi.fn>;

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(role: "admin" | "user" = "user"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

const ACCOUNT_ID = 100;

describe("notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: user is a member of the account
    mockGetMember.mockResolvedValue({
      userId: 1,
      accountId: ACCOUNT_ID,
      role: "owner",
      isActive: true,
    });
  });

  describe("list", () => {
    it("returns notifications for the user", async () => {
      const mockNotifs = [
        {
          id: 1,
          accountId: ACCOUNT_ID,
          userId: null,
          type: "inbound_message",
          title: "New SMS from John",
          body: "Hey there",
          link: "/inbox",
          isRead: false,
          dismissed: false,
          createdAt: new Date(),
        },
        {
          id: 2,
          accountId: ACCOUNT_ID,
          userId: 1,
          type: "appointment_booked",
          title: "New appointment",
          body: "Jane booked on Main Calendar",
          link: "/calendar",
          isRead: true,
          dismissed: false,
          createdAt: new Date(),
        },
      ];
      mockGetNotifications.mockResolvedValue(mockNotifs);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.notifications.list({ accountId: ACCOUNT_ID });

      expect(result).toEqual(mockNotifs);
      expect(mockGetNotifications).toHaveBeenCalledWith(ACCOUNT_ID, 1, 20);
    });

    it("respects custom limit", async () => {
      mockGetNotifications.mockResolvedValue([]);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      await caller.notifications.list({ accountId: ACCOUNT_ID, limit: 5 });

      expect(mockGetNotifications).toHaveBeenCalledWith(ACCOUNT_ID, 1, 5);
    });

    it("rejects unauthenticated users", async () => {
      const ctx: TrpcContext = {
        user: null,
        req: { protocol: "https", headers: {} } as TrpcContext["req"],
        res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
      };
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.notifications.list({ accountId: ACCOUNT_ID })
      ).rejects.toThrow();
    });
  });

  describe("unreadCount", () => {
    it("returns the unread count", async () => {
      mockGetUnreadNotificationCount.mockResolvedValue(7);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.notifications.unreadCount({ accountId: ACCOUNT_ID });

      expect(result).toEqual({ count: 7 });
      expect(mockGetUnreadNotificationCount).toHaveBeenCalledWith(ACCOUNT_ID, 1);
    });
  });

  describe("markAsRead", () => {
    it("marks a notification as read", async () => {
      mockMarkAsRead.mockResolvedValue(undefined);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.notifications.markAsRead({ id: 1, accountId: ACCOUNT_ID });

      expect(result).toEqual({ success: true });
      expect(mockMarkAsRead).toHaveBeenCalledWith(1, ACCOUNT_ID);
    });
  });

  describe("markAllAsRead", () => {
    it("marks all notifications as read", async () => {
      mockMarkAllAsRead.mockResolvedValue(undefined);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.notifications.markAllAsRead({ accountId: ACCOUNT_ID });

      expect(result).toEqual({ success: true });
      expect(mockMarkAllAsRead).toHaveBeenCalledWith(ACCOUNT_ID, 1);
    });
  });

  describe("dismiss", () => {
    it("dismisses a notification", async () => {
      mockDismiss.mockResolvedValue(undefined);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.notifications.dismiss({ id: 1, accountId: ACCOUNT_ID });

      expect(result).toEqual({ success: true });
      expect(mockDismiss).toHaveBeenCalledWith(1, ACCOUNT_ID);
    });
  });

  describe("access control", () => {
    it("allows admin access to any account", async () => {
      mockGetMember.mockResolvedValue(null); // Not a member
      mockGetNotifications.mockResolvedValue([]);

      const ctx = createAuthContext("admin");
      const caller = appRouter.createCaller(ctx);
      const result = await caller.notifications.list({ accountId: ACCOUNT_ID });

      expect(result).toEqual([]);
    });

    it("rejects non-member access", async () => {
      mockGetMember.mockResolvedValue(null); // Not a member

      const ctx = createAuthContext("user");
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.notifications.list({ accountId: ACCOUNT_ID })
      ).rejects.toThrow("You do not have access to this account");
    });
  });
});
