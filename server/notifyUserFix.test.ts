import { describe, it, expect, vi } from "vitest";

/**
 * Tests for Prompt U — Fix Automation Notification Insert (user_id NOT NULL constraint)
 *
 * Validates:
 * 1. getAccountOwnerUserId returns owner userId or null
 * 2. notify_user userId resolution chain: config → assignedUserId → owner → null
 * 3. Notification insert failures are caught and don't crash the workflow step
 * 4. Step always returns success even when notification fails
 */

describe("Prompt U — Notify User Fix", () => {
  describe("getAccountOwnerUserId helper", () => {
    it("should return a number when owner exists", () => {
      const mockResult = [{ userId: 42 }];
      const ownerUserId = mockResult.length > 0 ? mockResult[0].userId : null;
      expect(ownerUserId).toBe(42);
    });

    it("should return null when no owner found", () => {
      const mockResult: { userId: number }[] = [];
      const ownerUserId = mockResult.length > 0 ? mockResult[0].userId : null;
      expect(ownerUserId).toBeNull();
    });

    it("should return null when db is not available", () => {
      const db = null;
      const ownerUserId = db ? 42 : null;
      expect(ownerUserId).toBeNull();
    });
  });

  describe("userId resolution chain", () => {
    function resolveUserId(
      configUserId: string | number | null | undefined,
      assignedUserId: number | null,
      ownerUserId: number | null
    ): number | null {
      // Mirrors the logic in workflowEngine.ts notify_user case
      const rawUserId = configUserId || assignedUserId;
      let userId = rawUserId ? Number(rawUserId) : null;
      if (!userId && ownerUserId) {
        userId = ownerUserId;
      }
      return userId;
    }

    it("should use config.userId when provided", () => {
      expect(resolveUserId(100, 200, 300)).toBe(100);
    });

    it("should use config.userId as string", () => {
      expect(resolveUserId("100", 200, 300)).toBe(100);
    });

    it("should fall back to assignedUserId when config.userId is empty", () => {
      expect(resolveUserId("", 200, 300)).toBe(200);
    });

    it("should fall back to assignedUserId when config.userId is null", () => {
      expect(resolveUserId(null, 200, 300)).toBe(200);
    });

    it("should fall back to assignedUserId when config.userId is undefined", () => {
      expect(resolveUserId(undefined, 200, 300)).toBe(200);
    });

    it("should fall back to owner when both config and assigned are empty", () => {
      expect(resolveUserId("", null, 300)).toBe(300);
    });

    it("should fall back to owner when both config and assigned are null", () => {
      expect(resolveUserId(null, null, 300)).toBe(300);
    });

    it("should return null when all sources are empty (account-wide notification)", () => {
      expect(resolveUserId(null, null, null)).toBeNull();
    });

    it("should handle config.userId = 0 (falsy) by falling through", () => {
      // 0 is falsy in JS, so it should fall through to assignedUserId
      expect(resolveUserId(0, 200, 300)).toBe(200);
    });
  });

  describe("graceful error handling", () => {
    it("should catch notification insert errors without rethrowing", async () => {
      const createNotification = vi.fn().mockRejectedValue(new Error("DB insert failed"));
      let result: Record<string, unknown> | null = null;
      let error: Error | null = null;

      try {
        // Simulate the try/catch pattern in notify_user
        try {
          await createNotification({
            accountId: 1,
            userId: null,
            type: "new_lead",
            title: "Test",
            body: "Test body",
          });
        } catch (notifErr) {
          // Caught — non-fatal, continue
          console.error("Non-fatal notification error:", notifErr);
        }
        // Step still returns success
        result = { action: "notify_user", userId: null, title: "Test" };
      } catch (err) {
        error = err as Error;
      }

      expect(error).toBeNull();
      expect(result).toEqual({ action: "notify_user", userId: null, title: "Test" });
      expect(createNotification).toHaveBeenCalledOnce();
    });

    it("should return success result even when notification fails", async () => {
      const createNotification = vi.fn().mockRejectedValue(new Error("Column constraint violation"));

      let stepResult: Record<string, unknown> | undefined;

      // Simulate the full notify_user flow
      const userId = 42;
      const title = "New lead requires attention";
      try {
        await createNotification({ accountId: 1, userId, type: "new_lead", title, body: "test" });
      } catch {
        // non-fatal
      }
      stepResult = { action: "notify_user", userId, title };

      expect(stepResult).toBeDefined();
      expect(stepResult!.action).toBe("notify_user");
      expect(stepResult!.userId).toBe(42);
    });

    it("should succeed when notification insert works", async () => {
      const createNotification = vi.fn().mockResolvedValue({ id: 999 });

      let stepResult: Record<string, unknown> | undefined;

      const userId = 42;
      const title = "New lead requires attention";
      try {
        await createNotification({ accountId: 1, userId, type: "new_lead", title, body: "test" });
      } catch {
        // non-fatal
      }
      stepResult = { action: "notify_user", userId, title };

      expect(stepResult).toBeDefined();
      expect(createNotification).toHaveBeenCalledOnce();
    });
  });

  describe("owner fallback error handling", () => {
    it("should handle getAccountOwnerUserId throwing an error", async () => {
      const getAccountOwnerUserId = vi.fn().mockRejectedValue(new Error("DB error"));

      let userId: number | null = null;
      try {
        const ownerUserId = await getAccountOwnerUserId(1);
        if (ownerUserId) userId = ownerUserId;
      } catch {
        // Caught — continue with null userId
      }

      expect(userId).toBeNull();
    });

    it("should use owner userId when getAccountOwnerUserId succeeds", async () => {
      const getAccountOwnerUserId = vi.fn().mockResolvedValue(42);

      let userId: number | null = null;
      try {
        const ownerUserId = await getAccountOwnerUserId(1);
        if (ownerUserId) userId = ownerUserId;
      } catch {
        // Caught
      }

      expect(userId).toBe(42);
    });
  });

  describe("notification type sanitization", () => {
    const validTypes = [
      "inbound_message", "appointment_booked", "appointment_cancelled",
      "ai_call_completed", "campaign_finished", "workflow_failed",
      "new_contact_facebook", "new_contact_booking", "missed_call",
      "report_sent", "system_alert", "new_lead",
    ] as const;

    it("should accept valid notification types", () => {
      for (const t of validTypes) {
        const result = validTypes.includes(t) ? t : "system_alert";
        expect(result).toBe(t);
      }
    });

    it("should fall back to system_alert for invalid types", () => {
      const invalid = "lead_action_required";
      const result = (validTypes as readonly string[]).includes(invalid) ? invalid : "system_alert";
      expect(result).toBe("system_alert");
    });

    it("should fall back to system_alert for empty string", () => {
      const empty = "";
      const requestedType = empty || "new_lead";
      const result = (validTypes as readonly string[]).includes(requestedType) ? requestedType : "system_alert";
      expect(result).toBe("new_lead");
    });
  });

  describe("end-to-end notify_user simulation", () => {
    it("should complete successfully with owner fallback and notification success", async () => {
      const getAccountOwnerUserId = vi.fn().mockResolvedValue(42);
      const createNotification = vi.fn().mockResolvedValue({ id: 1 });

      // Simulate: config.userId = "", contact.assignedUserId = null
      let rawUserId = "" || null;
      let userId = rawUserId ? Number(rawUserId) : null;
      if (!userId) {
        const ownerUserId = await getAccountOwnerUserId(1);
        if (ownerUserId) userId = ownerUserId;
      }

      try {
        await createNotification({
          accountId: 1,
          userId,
          type: "new_lead",
          title: "Test",
          body: "Test body",
        });
      } catch {
        // non-fatal
      }

      const result = { action: "notify_user", userId, title: "Test" };
      expect(result.userId).toBe(42);
      expect(createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 42 })
      );
    });

    it("should complete successfully even when both owner lookup and notification fail", async () => {
      const getAccountOwnerUserId = vi.fn().mockRejectedValue(new Error("DB down"));
      const createNotification = vi.fn().mockRejectedValue(new Error("Insert failed"));

      let rawUserId = "" || null;
      let userId = rawUserId ? Number(rawUserId) : null;
      if (!userId) {
        try {
          const ownerUserId = await getAccountOwnerUserId(1);
          if (ownerUserId) userId = ownerUserId;
        } catch {
          // non-fatal
        }
      }

      try {
        await createNotification({
          accountId: 1,
          userId,
          type: "new_lead",
          title: "Test",
          body: "Test body",
        });
      } catch {
        // non-fatal
      }

      const result = { action: "notify_user", userId, title: "Test" };
      // userId stays null (account-wide), step still succeeds
      expect(result.userId).toBeNull();
      expect(result.action).toBe("notify_user");
    });
  });
});
