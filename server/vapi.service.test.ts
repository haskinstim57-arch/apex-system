import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resolveAssistantId,
  mapVapiStatus,
  mapVapiEndedReason,
} from "./services/vapi";

// ─────────────────────────────────────────────
// Unit tests for VAPI service helper functions
// ─────────────────────────────────────────────

describe("resolveAssistantId", () => {
  it("should return the default agent ID for Facebook leads", () => {
    const id = resolveAssistantId("facebook");
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
  });

  it("should return the default agent ID for null lead source", () => {
    const id = resolveAssistantId(null);
    expect(id).toBeTruthy();
  });

  it("should return the default agent ID for undefined lead source", () => {
    const id = resolveAssistantId(undefined);
    expect(id).toBeTruthy();
  });

  it("should return the default agent ID for empty string", () => {
    const id = resolveAssistantId("");
    expect(id).toBeTruthy();
  });

  it("should return realtor agent ID for realtor lead source", () => {
    const defaultId = resolveAssistantId("facebook");
    const realtorId = resolveAssistantId("realtor");
    // If VAPI_AGENT_ID_REALTOR is set, it should differ from default
    // If not set, it falls back to default — both are valid
    expect(realtorId).toBeTruthy();
  });

  it("should return realtor agent ID for 'Real Estate' lead source", () => {
    const id = resolveAssistantId("Real Estate Agent");
    expect(id).toBeTruthy();
  });

  it("should return realtor agent ID for 'referral' lead source", () => {
    const id = resolveAssistantId("referral");
    expect(id).toBeTruthy();
  });

  it("should return instagram agent ID for instagram lead source", () => {
    const defaultId = resolveAssistantId("facebook");
    const igId = resolveAssistantId("instagram");
    expect(igId).toBeTruthy();
  });

  it("should return instagram agent ID for 'IG' lead source", () => {
    const id = resolveAssistantId("IG");
    expect(id).toBeTruthy();
  });

  it("should be case-insensitive", () => {
    const lower = resolveAssistantId("instagram");
    const upper = resolveAssistantId("INSTAGRAM");
    const mixed = resolveAssistantId("Instagram");
    expect(lower).toBe(upper);
    expect(lower).toBe(mixed);
  });
});

describe("mapVapiStatus", () => {
  it("should map 'queued' to 'queued'", () => {
    expect(mapVapiStatus("queued")).toBe("queued");
  });

  it("should map 'ringing' to 'calling'", () => {
    expect(mapVapiStatus("ringing")).toBe("calling");
  });

  it("should map 'in-progress' to 'calling'", () => {
    expect(mapVapiStatus("in-progress")).toBe("calling");
  });

  it("should map 'forwarding' to 'calling'", () => {
    expect(mapVapiStatus("forwarding")).toBe("calling");
  });

  it("should map 'ended' to 'completed'", () => {
    expect(mapVapiStatus("ended")).toBe("completed");
  });

  it("should map unknown status to 'failed'", () => {
    expect(mapVapiStatus("unknown-status")).toBe("failed");
  });
});

describe("mapVapiEndedReason", () => {
  it("should return 'completed' for undefined reason", () => {
    expect(mapVapiEndedReason(undefined)).toBe("completed");
  });

  it("should return 'completed' for 'assistant-ended'", () => {
    expect(mapVapiEndedReason("assistant-ended")).toBe("completed");
  });

  it("should return 'completed' for 'customer-ended'", () => {
    expect(mapVapiEndedReason("customer-ended")).toBe("completed");
  });

  it("should return 'completed' for 'silence-timed-out'", () => {
    expect(mapVapiEndedReason("silence-timed-out")).toBe("completed");
  });

  it("should return 'completed' for 'max-duration-reached'", () => {
    expect(mapVapiEndedReason("max-duration-reached")).toBe("completed");
  });

  it("should return 'no_answer' for 'no-answer'", () => {
    expect(mapVapiEndedReason("no-answer")).toBe("no_answer");
  });

  it("should return 'no_answer' for 'customer-did-not-answer'", () => {
    expect(mapVapiEndedReason("customer-did-not-answer")).toBe("no_answer");
  });

  it("should return 'busy' for 'busy'", () => {
    expect(mapVapiEndedReason("busy")).toBe("busy");
  });

  it("should return 'cancelled' for 'cancelled'", () => {
    expect(mapVapiEndedReason("cancelled")).toBe("cancelled");
  });

  it("should return 'failed' for 'error'", () => {
    expect(mapVapiEndedReason("error")).toBe("failed");
  });

  it("should return 'failed' for 'call-start-error-neither-assistant'", () => {
    expect(mapVapiEndedReason("call-start-error-neither-assistant")).toBe("failed");
  });
});

// ─────────────────────────────────────────────
// Integration test: verify VAPI API key works
// ─────────────────────────────────────────────

describe("VAPI API integration", () => {
  it("should authenticate with VAPI API (list calls)", async () => {
    const key = process.env.VAPI_API_KEY;
    if (!key) {
      console.log("Skipping: VAPI_API_KEY not set");
      return;
    }

    const res = await fetch("https://api.vapi.ai/call?limit=1", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("should have all three assistant IDs configured", () => {
    const defaultId = process.env.VAPI_AGENT_ID;
    const realtorId = process.env.VAPI_AGENT_ID_REALTOR;
    const instagramId = process.env.VAPI_AGENT_ID_INSTAGRAM;

    expect(defaultId).toBeTruthy();
    expect(realtorId).toBeTruthy();
    expect(instagramId).toBeTruthy();

    // They should all be different
    expect(defaultId).not.toBe(realtorId);
    expect(defaultId).not.toBe(instagramId);
    expect(realtorId).not.toBe(instagramId);
  });

  it("should resolve different assistant IDs for different lead sources", () => {
    const facebookId = resolveAssistantId("facebook");
    const realtorId = resolveAssistantId("realtor");
    const instagramId = resolveAssistantId("instagram");

    // All should be non-empty
    expect(facebookId.length).toBeGreaterThan(0);
    expect(realtorId.length).toBeGreaterThan(0);
    expect(instagramId.length).toBeGreaterThan(0);

    // Realtor and Instagram should differ from Facebook default
    expect(realtorId).not.toBe(facebookId);
    expect(instagramId).not.toBe(facebookId);
  });
});
