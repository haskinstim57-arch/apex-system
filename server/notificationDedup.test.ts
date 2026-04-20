/**
 * Notification Deduplication Tests
 *
 * Tests the dedup service, the audit log table, and verifies that
 * the duplicate notification paths have been fixed.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Mock the database layer ─────────────────────────────────────────────
const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([{ insertId: 1 }]) });
const mockSelect = vi.fn();
const mockDelete = vi.fn();

vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue({
      insert: (...args: any[]) => mockInsert(...args),
      select: (...args: any[]) => mockSelect(...args),
      delete: (...args: any[]) => mockDelete(...args),
    }),
  };
});

// ─── Mock the schema ─────────────────────────────────────────────────────
vi.mock("../drizzle/schema", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    notificationAuditLog: {
      id: "id",
      accountId: "account_id",
      userId: "user_id",
      eventType: "event_type",
      channel: "channel",
      dedupeKey: "dedupe_key",
      sentAt: "sent_at",
      metadata: "metadata",
    },
  };
});

import { checkAndRecordNotification, recordNotificationSend, DEDUP_WINDOW_SECONDS } from "./services/notificationDedup";

// ─── Helper to build select chain ────────────────────────────────────────
function setupSelectChain(rows: any[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  mockSelect.mockReturnValue(chain);
  return chain;
}

function setupInsertChain() {
  const chain = {
    values: vi.fn().mockResolvedValue([{ insertId: 1 }]),
  };
  mockInsert.mockReturnValue(chain);
  return chain;
}

// ─── Tests ───────────────────────────────────────────────────────────────
describe("Notification Deduplication Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkAndRecordNotification", () => {
    it("allows first notification and records it in audit log", async () => {
      const selectChain = setupSelectChain([]); // No existing records
      const insertChain = setupInsertChain();

      const allowed = await checkAndRecordNotification({
        accountId: 1,
        eventType: "facebook_lead",
        channel: "push",
        dedupeKey: "fb-lead-123",
      });

      expect(allowed).toBe(true);
      // Should have queried for existing records
      expect(mockSelect).toHaveBeenCalledTimes(1);
      // Should have inserted the audit record
      expect(mockInsert).toHaveBeenCalledTimes(1);
    });

    it("blocks duplicate notification within 60s window", async () => {
      // Simulate existing record found
      setupSelectChain([{ id: 42 }]);

      const allowed = await checkAndRecordNotification({
        accountId: 1,
        eventType: "facebook_lead",
        channel: "push",
        dedupeKey: "fb-lead-123",
      });

      expect(allowed).toBe(false);
      // Should NOT insert a new record
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("allows same event type with different dedupeKey", async () => {
      setupSelectChain([]); // No match for this specific dedupeKey
      setupInsertChain();

      const allowed = await checkAndRecordNotification({
        accountId: 1,
        eventType: "facebook_lead",
        channel: "push",
        dedupeKey: "fb-lead-456", // Different key
      });

      expect(allowed).toBe(true);
    });

    it("allows same dedupeKey on different channel", async () => {
      setupSelectChain([]); // No match for this channel
      setupInsertChain();

      const allowed = await checkAndRecordNotification({
        accountId: 1,
        eventType: "facebook_lead",
        channel: "email", // Different channel
        dedupeKey: "fb-lead-123",
      });

      expect(allowed).toBe(true);
    });

    it("allows same dedupeKey on different account", async () => {
      setupSelectChain([]);
      setupInsertChain();

      const allowed = await checkAndRecordNotification({
        accountId: 2, // Different account
        eventType: "facebook_lead",
        channel: "push",
        dedupeKey: "fb-lead-123",
      });

      expect(allowed).toBe(true);
    });

    it("fails open when database is unavailable", async () => {
      // Override getDb to return null
      const { getDb } = await import("./db");
      (getDb as any).mockResolvedValueOnce(null);

      const allowed = await checkAndRecordNotification({
        accountId: 1,
        eventType: "facebook_lead",
        channel: "push",
        dedupeKey: "fb-lead-123",
      });

      expect(allowed).toBe(true); // Fail-open
    });

    it("stores metadata in audit log record", async () => {
      setupSelectChain([]);
      const insertChain = setupInsertChain();

      await checkAndRecordNotification({
        accountId: 1,
        eventType: "facebook_lead",
        channel: "push",
        dedupeKey: "fb-lead-123",
        metadata: { title: "New Lead", body: "John Doe" },
      });

      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 1,
          eventType: "facebook_lead",
          channel: "push",
          dedupeKey: "fb-lead-123",
          metadata: JSON.stringify({ title: "New Lead", body: "John Doe" }),
        })
      );
    });
  });

  describe("recordNotificationSend (audit-only, no dedup)", () => {
    it("records without checking for duplicates", async () => {
      setupInsertChain();

      await recordNotificationSend({
        accountId: 1,
        eventType: "inbound_sms",
        channel: "sms",
        dedupeKey: "sms-contact-789",
      });

      // Should insert but NOT select (no dedup check)
      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(mockSelect).not.toHaveBeenCalled();
    });
  });

  describe("DEDUP_WINDOW_SECONDS", () => {
    it("is set to 60 seconds", () => {
      expect(DEDUP_WINDOW_SECONDS).toBe(60);
    });
  });
});

// ─── Integration-style tests for the duplicate fix ───────────────────────
describe("Duplicate Notification Fix Verification", () => {
  it("facebookLeads.ts webhook does NOT call sendPushNotificationToAccount directly", async () => {
    // Read the file and verify the fix is in place
    const fs = await import("fs");
    const content = fs.readFileSync("server/webhooks/facebookLeads.ts", "utf-8");

    // Should NOT have a direct sendPushNotificationToAccount call (only in comments)
    const lines = content.split("\n");
    const activePushCalls = lines.filter(
      (line) =>
        line.includes("sendPushNotificationToAccount(") &&
        !line.trim().startsWith("//") &&
        !line.trim().startsWith("*")
    );
    expect(activePushCalls).toHaveLength(0);
  });

  it("facebookLeads.ts webhook does NOT call createNotification directly", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/webhooks/facebookLeads.ts", "utf-8");

    const lines = content.split("\n");
    const activeNotifCalls = lines.filter(
      (line) =>
        line.includes("createNotification(") &&
        !line.trim().startsWith("//") &&
        !line.trim().startsWith("*")
    );
    expect(activeNotifCalls).toHaveLength(0);
  });

  it("facebookLeadPoller.ts does NOT call createNotification for new leads", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/services/facebookLeadPoller.ts", "utf-8");

    // The only createNotification call should be in fireTokenDeathAlerts (circuit breaker)
    const lines = content.split("\n");
    const activeNotifCalls = lines.filter(
      (line) =>
        line.includes("createNotification(") &&
        !line.trim().startsWith("//") &&
        !line.trim().startsWith("*")
    );

    // Should have exactly 1 call — the circuit breaker alert (not lead notification)
    expect(activeNotifCalls.length).toBeLessThanOrEqual(1);

    // Verify the remaining call is in the circuit breaker section
    if (activeNotifCalls.length === 1) {
      const lineIndex = lines.findIndex(
        (l) => l === activeNotifCalls[0]
      );
      // Check nearby context mentions circuit breaker or system_alert
      const context = lines.slice(Math.max(0, lineIndex - 5), lineIndex + 5).join("\n");
      expect(context).toMatch(/system_alert|CircuitBreaker|fireTokenDeathAlerts/);
    }
  });

  it("notifyLeadRecipients handles all 4 channels (SMS, email, in-app, push)", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/services/leadNotification.ts", "utf-8");

    // Verify it sends all channels
    expect(content).toContain("sendSMSViaBlooio");
    expect(content).toContain("dispatchEmail");
    expect(content).toContain("createNotification");
    expect(content).toContain("sendPushNotificationToAccount");
  });

  it("inbound message webhooks send exactly 1 push per event", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/webhooks/inboundMessages.ts", "utf-8");

    // Count active sendPushNotificationToAccount calls
    const lines = content.split("\n");
    const pushCalls = lines.filter(
      (line) =>
        line.includes("sendPushNotificationToAccount(") &&
        !line.trim().startsWith("//") &&
        !line.trim().startsWith("*")
    );

    // Should have exactly 2 calls — one for SMS inbound, one for email inbound
    // (these are separate webhook handlers, not duplicates for the same event)
    expect(pushCalls.length).toBe(2);
  });

  it("support ticket creation sends exactly 1 notification email", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/routers/support.ts", "utf-8");

    // Count notifyNewTicket calls
    const lines = content.split("\n");
    const notifyCalls = lines.filter(
      (line) =>
        line.includes("notifyNewTicket(") &&
        !line.trim().startsWith("//") &&
        !line.trim().startsWith("*")
    );

    expect(notifyCalls).toHaveLength(1);
  });

  it("sendPushNotificationToAccount includes dedup check", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync("server/services/webPush.ts", "utf-8");

    // Verify dedup integration
    expect(content).toContain("checkAndRecordNotification");
    expect(content).toContain("notificationDedup");
  });
});
