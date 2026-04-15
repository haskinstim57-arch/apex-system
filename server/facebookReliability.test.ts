/**
 * Tests for Facebook Lead Reliability Layer
 *
 * Covers:
 * - Lead notification service (leadNotification.ts)
 * - Sequence auto-stop service (sequenceAutoStop.ts)
 * - Facebook token health monitor (facebookTokenHealthMonitor.ts)
 * - Facebook lead poller circuit breaker (facebookLeadPoller.ts)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────
// 1. Lead Notification Service
// ─────────────────────────────────────────────
describe("Lead Notification Service", () => {
  it("module exports notifyLeadRecipients function", async () => {
    const mod = await import("./services/leadNotification");
    expect(typeof mod.notifyLeadRecipients).toBe("function");
  });

  it("notifyLeadRecipients does not throw when called with valid params", async () => {
    const { notifyLeadRecipients } = await import("./services/leadNotification");
    // Should complete gracefully even if no account/contact exists
    await expect(
      notifyLeadRecipients({
        accountId: 999999,
        contactId: 999999,
        contactName: "Test Lead",
        leadSource: "facebook",
        pageOrFormName: "Test Page",
      })
    ).resolves.not.toThrow();
  });

  it("notifyLeadRecipients handles missing optional fields gracefully", async () => {
    const { notifyLeadRecipients } = await import("./services/leadNotification");
    await expect(
      notifyLeadRecipients({
        accountId: 999999,
        contactId: 999999,
        contactName: "Test Lead",
        leadSource: "facebook",
      })
    ).resolves.not.toThrow();
  });
});

// ─────────────────────────────────────────────
// 2. Sequence Auto-Stop Service
// ─────────────────────────────────────────────
describe("Sequence Auto-Stop Service", () => {
  it("module exports all hook functions", async () => {
    const mod = await import("./services/sequenceAutoStop");
    expect(typeof mod.unenrollContactOnEngagement).toBe("function");
    expect(typeof mod.onInboundSmsAutoStop).toBe("function");
    expect(typeof mod.onInboundEmailAutoStop).toBe("function");
    expect(typeof mod.onAppointmentBookedAutoStop).toBe("function");
    expect(typeof mod.onCallCompletedAutoStop).toBe("function");
    expect(typeof mod.onPipelineStageChangedAutoStop).toBe("function");
  });

  it("unenrollContactOnEngagement returns 0 when no active enrollments exist", async () => {
    const { unenrollContactOnEngagement } = await import("./services/sequenceAutoStop");
    const count = await unenrollContactOnEngagement(999999, 999999, "inbound_sms");
    expect(count).toBe(0);
  });

  it("onInboundSmsAutoStop does not throw for nonexistent contact", async () => {
    const { onInboundSmsAutoStop } = await import("./services/sequenceAutoStop");
    await expect(onInboundSmsAutoStop(999999, 999999)).resolves.not.toThrow();
  });

  it("onInboundEmailAutoStop does not throw for nonexistent contact", async () => {
    const { onInboundEmailAutoStop } = await import("./services/sequenceAutoStop");
    await expect(onInboundEmailAutoStop(999999, 999999)).resolves.not.toThrow();
  });

  it("onAppointmentBookedAutoStop does not throw for nonexistent contact", async () => {
    const { onAppointmentBookedAutoStop } = await import("./services/sequenceAutoStop");
    await expect(onAppointmentBookedAutoStop(999999, 999999, 123)).resolves.not.toThrow();
  });

  it("onCallCompletedAutoStop does not throw for nonexistent contact", async () => {
    const { onCallCompletedAutoStop } = await import("./services/sequenceAutoStop");
    await expect(onCallCompletedAutoStop(999999, 999999, 456)).resolves.not.toThrow();
  });

  it("onPipelineStageChangedAutoStop does not throw for nonexistent contact", async () => {
    const { onPipelineStageChangedAutoStop } = await import("./services/sequenceAutoStop");
    await expect(
      onPipelineStageChangedAutoStop(999999, 999999, "new", "qualified")
    ).resolves.not.toThrow();
  });

  it("EngagementReason type covers all 5 triggers", async () => {
    // Verify the type system accepts all 5 engagement reasons
    const { unenrollContactOnEngagement } = await import("./services/sequenceAutoStop");
    const reasons = [
      "inbound_sms",
      "inbound_email",
      "appointment_booked",
      "call_completed",
      "pipeline_stage_changed",
    ] as const;

    for (const reason of reasons) {
      const count = await unenrollContactOnEngagement(999999, 999999, reason);
      expect(typeof count).toBe("number");
    }
  });
});

// ─────────────────────────────────────────────
// 3. Facebook Token Health Monitor
// ─────────────────────────────────────────────
describe("Facebook Token Health Monitor", () => {
  it("module exports startFacebookTokenHealthMonitor and checkAllTokens", async () => {
    const mod = await import("./services/facebookTokenHealthMonitor");
    expect(typeof mod.startFacebookTokenHealthMonitor).toBe("function");
    expect(typeof mod.checkAllTokens).toBe("function");
    expect(typeof mod.stopFacebookTokenHealthMonitor).toBe("function");
  });

  it("checkAllTokens completes without throwing", async () => {
    const { checkAllTokens } = await import("./services/facebookTokenHealthMonitor");
    // Should complete gracefully even with no pages configured
    const results = await checkAllTokens();
    expect(Array.isArray(results)).toBe(true);
  });
});

// ─────────────────────────────────────────────
// 4. Facebook Lead Poller Circuit Breaker
// ─────────────────────────────────────────────
describe("Facebook Lead Poller — Circuit Breaker", () => {
  it("module exports resetPageCircuitBreaker", async () => {
    const mod = await import("./services/facebookLeadPoller");
    expect(typeof mod.resetPageCircuitBreaker).toBe("function");
  });

  it("resetPageCircuitBreaker does not throw for unknown page", async () => {
    const { resetPageCircuitBreaker } = await import("./services/facebookLeadPoller");
    expect(() => resetPageCircuitBreaker("unknown_page_123")).not.toThrow();
  });

  it("module exports startFacebookLeadPoller", async () => {
    const mod = await import("./services/facebookLeadPoller");
    expect(typeof mod.startFacebookLeadPoller).toBe("function");
  });
});

// ─────────────────────────────────────────────
// 5. Integration: Auto-enrollment in webhook handler
// ─────────────────────────────────────────────
describe("Facebook Leads Webhook — Integration", () => {
  it("facebookLeadsWebhookRouter is exported and is an Express router", async () => {
    const mod = await import("./webhooks/facebookLeads");
    expect(mod.facebookLeadsWebhookRouter).toBeDefined();
    // Express routers have a .stack property
    expect(Array.isArray((mod.facebookLeadsWebhookRouter as any).stack)).toBe(true);
  });
});

// ─────────────────────────────────────────────
// 6. Inbound Messages — Auto-stop wiring
// ─────────────────────────────────────────────
describe("Inbound Messages — Sequence Auto-Stop Wiring", () => {
  it("inboundMessageRouter is exported and is an Express router", async () => {
    const mod = await import("./webhooks/inboundMessages");
    expect(mod.inboundMessageRouter).toBeDefined();
    expect(Array.isArray((mod.inboundMessageRouter as any).stack)).toBe(true);
  });
});
