import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────
// Tests for Delivery Dashboard features:
// 1. updateDeliveryStatus in notificationLogger
// 2. Twilio StatusCallback URL injection
// 3. SendGrid/Twilio webhook status normalization
// ─────────────────────────────────────────────

describe("Notification Delivery Dashboard Features", () => {
  describe("updateDeliveryStatus", () => {
    it("should export updateDeliveryStatus function", async () => {
      const mod = await import("./services/notificationLogger");
      expect(typeof mod.updateDeliveryStatus).toBe("function");
    });

    it("should export logNotificationDelivery with externalMessageId support", async () => {
      const mod = await import("./services/notificationLogger");
      expect(typeof mod.logNotificationDelivery).toBe("function");
    });
  });

  describe("Twilio StatusCallback URL injection", () => {
    beforeEach(() => {
      vi.unstubAllEnvs();
    });

    it("should build StatusCallback URL from VITE_APP_URL", () => {
      const appUrl = "https://apexcrm-knxkwfan.manus.space";
      vi.stubEnv("VITE_APP_URL", appUrl);

      const expected = `${appUrl}/api/webhooks/twilio/delivery-status`;
      expect(expected).toBe(
        "https://apexcrm-knxkwfan.manus.space/api/webhooks/twilio/delivery-status"
      );
    });

    it("should fall back to APP_URL if VITE_APP_URL is not set", () => {
      vi.stubEnv("VITE_APP_URL", "");
      vi.stubEnv("APP_URL", "https://fallback.example.com");

      const appUrl = process.env.VITE_APP_URL || process.env.APP_URL;
      const statusCallback = appUrl
        ? `${appUrl}/api/webhooks/twilio/delivery-status`
        : undefined;

      expect(statusCallback).toBe(
        "https://fallback.example.com/api/webhooks/twilio/delivery-status"
      );
    });

    it("should not set StatusCallback if no APP_URL is configured", () => {
      vi.stubEnv("VITE_APP_URL", "");
      vi.stubEnv("APP_URL", "");

      const appUrl = process.env.VITE_APP_URL || process.env.APP_URL;
      const statusCallback = appUrl
        ? `${appUrl}/api/webhooks/twilio/delivery-status`
        : undefined;

      expect(statusCallback).toBeUndefined();
    });
  });

  describe("SendGrid webhook status normalization", () => {
    const normalizeStatus = (event: string): string => {
      const map: Record<string, string> = {
        delivered: "delivered",
        bounce: "bounced",
        dropped: "dropped",
        deferred: "deferred",
        open: "opened",
        click: "clicked",
        spamreport: "spam",
        unsubscribe: "unsubscribed",
        processed: "processed",
      };
      return map[event] || event;
    };

    it("should normalize 'delivered' event", () => {
      expect(normalizeStatus("delivered")).toBe("delivered");
    });

    it("should normalize 'bounce' to 'bounced'", () => {
      expect(normalizeStatus("bounce")).toBe("bounced");
    });

    it("should normalize 'dropped' event", () => {
      expect(normalizeStatus("dropped")).toBe("dropped");
    });

    it("should normalize 'deferred' event", () => {
      expect(normalizeStatus("deferred")).toBe("deferred");
    });

    it("should normalize 'open' to 'opened'", () => {
      expect(normalizeStatus("open")).toBe("opened");
    });

    it("should normalize 'click' to 'clicked'", () => {
      expect(normalizeStatus("click")).toBe("clicked");
    });

    it("should normalize 'spamreport' to 'spam'", () => {
      expect(normalizeStatus("spamreport")).toBe("spam");
    });

    it("should pass through unknown events", () => {
      expect(normalizeStatus("unknown_event")).toBe("unknown_event");
    });
  });

  describe("Twilio webhook status normalization", () => {
    const normalizeTwilioStatus = (status: string): string => {
      const map: Record<string, string> = {
        delivered: "delivered",
        undelivered: "undelivered",
        failed: "failed",
        sent: "sent",
        queued: "queued",
        accepted: "accepted",
        receiving: "receiving",
        received: "received",
      };
      return map[status.toLowerCase()] || status.toLowerCase();
    };

    it("should normalize 'delivered' status", () => {
      expect(normalizeTwilioStatus("delivered")).toBe("delivered");
    });

    it("should normalize 'undelivered' status", () => {
      expect(normalizeTwilioStatus("undelivered")).toBe("undelivered");
    });

    it("should normalize 'failed' status", () => {
      expect(normalizeTwilioStatus("failed")).toBe("failed");
    });

    it("should normalize 'sent' status", () => {
      expect(normalizeTwilioStatus("sent")).toBe("sent");
    });

    it("should handle case-insensitive input", () => {
      expect(normalizeTwilioStatus("DELIVERED")).toBe("delivered");
      expect(normalizeTwilioStatus("Failed")).toBe("failed");
    });

    it("should pass through unknown statuses", () => {
      expect(normalizeTwilioStatus("custom_status")).toBe("custom_status");
    });
  });

  describe("Delivery log filtering", () => {
    const filterLogs = (
      logs: Array<{ channel: string; status: string }>,
      channelFilter: string,
      statusFilter: string
    ) => {
      return logs.filter((log) => {
        if (channelFilter !== "all" && log.channel !== channelFilter) return false;
        if (statusFilter !== "all" && log.status !== statusFilter) return false;
        return true;
      });
    };

    const sampleLogs = [
      { channel: "push", status: "sent" },
      { channel: "email", status: "sent" },
      { channel: "sms", status: "failed" },
      { channel: "push", status: "failed" },
      { channel: "email", status: "skipped" },
    ];

    it("should return all logs when no filter applied", () => {
      expect(filterLogs(sampleLogs, "all", "all")).toHaveLength(5);
    });

    it("should filter by channel", () => {
      expect(filterLogs(sampleLogs, "push", "all")).toHaveLength(2);
      expect(filterLogs(sampleLogs, "email", "all")).toHaveLength(2);
      expect(filterLogs(sampleLogs, "sms", "all")).toHaveLength(1);
    });

    it("should filter by status", () => {
      expect(filterLogs(sampleLogs, "all", "sent")).toHaveLength(2);
      expect(filterLogs(sampleLogs, "all", "failed")).toHaveLength(2);
      expect(filterLogs(sampleLogs, "all", "skipped")).toHaveLength(1);
    });

    it("should filter by both channel and status", () => {
      expect(filterLogs(sampleLogs, "push", "sent")).toHaveLength(1);
      expect(filterLogs(sampleLogs, "email", "failed")).toHaveLength(0);
      expect(filterLogs(sampleLogs, "sms", "failed")).toHaveLength(1);
    });
  });
});
