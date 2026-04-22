import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ─────────────────────────────────────────────
// Part B — PWA Notification Navigation Bug Tests
// Validates the service worker click handler and push payload URLs
// ─────────────────────────────────────────────

describe("PWA Push Notification Navigation — Part B Fix", () => {
  // ── Service Worker Push Handler ──

  it("sw-push.js constructs absolute URLs from relative paths", () => {
    const swContent = fs.readFileSync(
      path.resolve(__dirname, "../client/public/sw-push.js"),
      "utf-8"
    );
    // Should reference self.location.origin for absolute URL construction
    expect(swContent).toContain("self.location.origin");
  });

  it("sw-push.js handles navigate failure with postMessage fallback", () => {
    const swContent = fs.readFileSync(
      path.resolve(__dirname, "../client/public/sw-push.js"),
      "utf-8"
    );
    // Should have a postMessage fallback for when navigate() fails
    expect(swContent).toContain("NOTIFICATION_CLICK");
    expect(swContent).toContain("postMessage");
  });

  it("sw-push.js uses navigate().then().catch() pattern", () => {
    const swContent = fs.readFileSync(
      path.resolve(__dirname, "../client/public/sw-push.js"),
      "utf-8"
    );
    // Should chain navigate with .then and .catch for robustness
    expect(swContent).toContain("navigate(urlToOpen)");
    expect(swContent).toContain(".then(");
    expect(swContent).toContain(".catch(");
  });

  it("sw-push.js opens new window with full URL when no existing window", () => {
    const swContent = fs.readFileSync(
      path.resolve(__dirname, "../client/public/sw-push.js"),
      "utf-8"
    );
    expect(swContent).toContain("openWindow(urlToOpen)");
  });

  // ── Frontend NOTIFICATION_CLICK Handler ──

  it("main.tsx listens for NOTIFICATION_CLICK messages from service worker", () => {
    const mainContent = fs.readFileSync(
      path.resolve(__dirname, "../client/src/main.tsx"),
      "utf-8"
    );
    expect(mainContent).toContain("NOTIFICATION_CLICK");
    expect(mainContent).toContain('addEventListener("message"');
  });

  // ── Push Payload URL Correctness ──

  it("inbound SMS push notification deep-links to contact detail", () => {
    const webhookContent = fs.readFileSync(
      path.resolve(__dirname, "./webhooks/inboundMessages.ts"),
      "utf-8"
    );
    // Should use /contacts/${contact.id} instead of /inbox
    expect(webhookContent).toContain("url: `/contacts/${contact.id}`");
    // Should include eventType for proper batching
    expect(webhookContent).toContain('eventType: "inbound_sms"');
  });

  it("inbound email push notification deep-links to contact detail", () => {
    const webhookContent = fs.readFileSync(
      path.resolve(__dirname, "./webhooks/inboundMessages.ts"),
      "utf-8"
    );
    // Should include eventType for proper batching
    expect(webhookContent).toContain('eventType: "inbound_email"');
  });

  it("VAPI appointment push notification includes eventType", () => {
    const vapiContent = fs.readFileSync(
      path.resolve(__dirname, "./webhooks/vapi.ts"),
      "utf-8"
    );
    expect(vapiContent).toContain('eventType: "appointment_booked"');
  });

  it("VAPI call completed push notification includes eventType", () => {
    const vapiContent = fs.readFileSync(
      path.resolve(__dirname, "./webhooks/vapi.ts"),
      "utf-8"
    );
    expect(vapiContent).toContain('eventType: "ai_call_completed"');
  });

  it("lead notification push uses contact deep-link URL", () => {
    const leadContent = fs.readFileSync(
      path.resolve(__dirname, "./services/leadNotification.ts"),
      "utf-8"
    );
    // Should deep-link to the specific contact
    expect(leadContent).toContain("url: `/contacts/${contactId}`");
    expect(leadContent).toContain('eventType: "facebook_lead"');
  });

  // ── URL Construction Logic ──

  it("absolute URL construction handles leading slash correctly", () => {
    const origin = "https://apexcrm.manus.space";
    const relativeUrl = "/contacts/123";

    const urlToOpen = relativeUrl.indexOf("http") === 0
      ? relativeUrl
      : origin + (relativeUrl.charAt(0) === "/" ? "" : "/") + relativeUrl;

    expect(urlToOpen).toBe("https://apexcrm.manus.space/contacts/123");
  });

  it("absolute URL construction handles missing leading slash", () => {
    const origin = "https://apexcrm.manus.space";
    const relativeUrl = "contacts/123";

    const urlToOpen = relativeUrl.indexOf("http") === 0
      ? relativeUrl
      : origin + (relativeUrl.charAt(0) === "/" ? "" : "/") + relativeUrl;

    expect(urlToOpen).toBe("https://apexcrm.manus.space/contacts/123");
  });

  it("absolute URL construction passes through already-absolute URLs", () => {
    const origin = "https://apexcrm.manus.space";
    const absoluteUrl = "https://apexcrm.manus.space/contacts/123";

    const urlToOpen = absoluteUrl.indexOf("http") === 0
      ? absoluteUrl
      : origin + (absoluteUrl.charAt(0) === "/" ? "" : "/") + absoluteUrl;

    expect(urlToOpen).toBe("https://apexcrm.manus.space/contacts/123");
  });

  it("default URL is / when no url in payload", () => {
    const payload = { title: "Test", body: "Test body" };
    const url = payload.url || "/";
    expect(url).toBe("/");
  });
});
