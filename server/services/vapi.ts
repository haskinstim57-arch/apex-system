import { ENV } from "../_core/env";

// ─────────────────────────────────────────────
// VAPI API Service
// Handles outbound calls via VAPI REST API
// ─────────────────────────────────────────────

const VAPI_BASE_URL = "https://api.vapi.ai";

/** Map lead sources to the correct VAPI assistant ID */
export function resolveAssistantId(leadSource?: string | null): string {
  const src = (leadSource ?? "").toLowerCase().trim();
  if (src.includes("realtor") || src.includes("real estate") || src.includes("referral")) {
    return ENV.vapiAgentIdRealtor || ENV.vapiAgentId;
  }
  if (src.includes("instagram") || src.includes("ig")) {
    return ENV.vapiAgentIdInstagram || ENV.vapiAgentId;
  }
  // Default: Facebook / general leads
  return ENV.vapiAgentId;
}

/** Shape of the customer object sent to VAPI */
interface VapiCustomer {
  number: string;
  name?: string;
}

/** Metadata we attach to every VAPI call for traceability */
interface VapiCallMetadata {
  apexAccountId: number;
  apexContactId: number;
  apexCallId: number;
  leadSource?: string;
}

/** Response from VAPI Create Call endpoint */
export interface VapiCreateCallResponse {
  id: string;
  type: string;
  status: string;
  phoneCallProvider?: string;
  startedAt?: string;
  endedAt?: string;
  costs?: Array<{ type: string; cost: number }>;
  messages?: Array<{ role: string; message: string; time?: number }>;
  transcript?: string;
  recordingUrl?: string;
  summary?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

/** Response from VAPI Get Call endpoint */
export interface VapiGetCallResponse extends VapiCreateCallResponse {
  analysis?: {
    summary?: string;
    structuredData?: Record<string, unknown>;
    successEvaluation?: string;
  };
  artifact?: {
    messages?: Array<{ role: string; message: string; time?: number; endTime?: number; duration?: number }>;
    messagesOpenAIFormatted?: Array<{ role: string; content: string }>;
    recordingUrl?: string;
    stereoRecordingUrl?: string;
    transcript?: string;
  };
}

/** Error thrown when VAPI API returns an error */
export class VapiApiError extends Error {
  public statusCode: number;
  public responseBody: string;

  constructor(statusCode: number, responseBody: string) {
    super(`VAPI API error (${statusCode}): ${responseBody}`);
    this.name = "VapiApiError";
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

// ─────────────────────────────────────────────
// Core API functions
// ─────────────────────────────────────────────

/**
 * Start an outbound AI call via VAPI.
 * POST https://api.vapi.ai/call
 */
export async function createVapiCall(params: {
  phoneNumber: string;
  customerName: string;
  assistantId: string;
  metadata: VapiCallMetadata;
}): Promise<VapiCreateCallResponse> {
  const { phoneNumber, customerName, assistantId, metadata } = params;

  const body: Record<string, unknown> = {
    assistantId,
    customer: {
      number: phoneNumber,
      name: customerName,
    } as VapiCustomer,
    // Pass Apex metadata so we can correlate webhook callbacks
    metadata: {
      apex_account_id: String(metadata.apexAccountId),
      apex_contact_id: String(metadata.apexContactId),
      apex_call_id: String(metadata.apexCallId),
      lead_source: metadata.leadSource ?? "unknown",
    },
  };

  const res = await fetch(`${VAPI_BASE_URL}/call`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.vapiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[VAPI] Create call failed (${res.status}):`, text);
    throw new VapiApiError(res.status, text);
  }

  const data = (await res.json()) as VapiCreateCallResponse;
  console.log(`[VAPI] Call created: ${data.id} status=${data.status}`);
  return data;
}

/**
 * Fetch the current state of a VAPI call.
 * GET https://api.vapi.ai/call/{id}
 */
export async function getVapiCall(callId: string): Promise<VapiGetCallResponse> {
  const res = await fetch(`${VAPI_BASE_URL}/call/${callId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${ENV.vapiApiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[VAPI] Get call failed (${res.status}):`, text);
    throw new VapiApiError(res.status, text);
  }

  return (await res.json()) as VapiGetCallResponse;
}

// ─────────────────────────────────────────────
// Status mapping
// ─────────────────────────────────────────────

/** Map VAPI call status to our internal status enum */
export function mapVapiStatus(
  vapiStatus: string
): "queued" | "calling" | "completed" | "failed" | "no_answer" | "busy" | "cancelled" {
  switch (vapiStatus) {
    case "queued":
      return "queued";
    case "ringing":
    case "in-progress":
      return "calling";
    case "forwarding":
      return "calling";
    case "ended":
      return "completed";
    default:
      return "failed";
  }
}

/** Map VAPI endedReason to a more specific status when call ends */
export function mapVapiEndedReason(
  endedReason?: string
): "completed" | "failed" | "no_answer" | "busy" | "cancelled" {
  if (!endedReason) return "completed";
  const reason = endedReason.toLowerCase();
  if (reason.includes("no-answer") || reason.includes("machine")) return "no_answer";
  if (reason.includes("busy")) return "busy";
  if (reason.includes("customer-did-not-answer")) return "no_answer";
  if (reason.includes("cancelled") || reason.includes("canceled")) return "cancelled";
  if (
    reason.includes("error") ||
    reason.includes("failed") ||
    reason.includes("call-start-error")
  )
    return "failed";
  // assistant-ended, customer-ended, silence-timed-out, max-duration-reached → completed
  return "completed";
}
