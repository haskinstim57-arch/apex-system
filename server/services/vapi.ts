import { ENV } from "../_core/env";

// ─────────────────────────────────────────────
// VAPI API Service
// Handles outbound calls via VAPI REST API
// ─────────────────────────────────────────────

const VAPI_BASE_URL = "https://api.vapi.ai";
/** @deprecated Hardcoded fallback — use per-account vapiPhoneNumberId instead */
const VAPI_PHONE_NUMBER_ID_FALLBACK = "c9eaefc4-9227-439d-bb16-a79c2797ab58";

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
  /** Per-account overrides — when set, these take priority over ENV globals */
  apiKey?: string;
  phoneNumberId?: string;
}): Promise<VapiCreateCallResponse> {
  const { phoneNumber, customerName, assistantId, metadata, apiKey, phoneNumberId } = params;
  const effectiveApiKey = apiKey || ENV.vapiApiKey;
  const effectivePhoneNumberId = phoneNumberId || VAPI_PHONE_NUMBER_ID_FALLBACK;

  // Build current date/time string in Pacific Time for the AI's awareness
  const now = new Date();
  const ptFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const currentDateTimeStr = ptFormatter.format(now);

  const body: Record<string, unknown> = {
    assistantId,
    phoneNumberId: effectivePhoneNumberId,
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
    // Override the assistant's first message context with current date/time
    assistantOverrides: {
      variableValues: {
        currentDateTime: currentDateTimeStr,
        customerName: customerName,
      },
      model: {
        messages: [
          {
            role: "system" as const,
            content: `IMPORTANT CONTEXT: Today's date and time is ${currentDateTimeStr} (Pacific Time). The customer's name is ${customerName}. When booking appointments or discussing dates, ALWAYS use dates relative to today. Never suggest dates in the past. Available appointment days are Monday through Friday, 9:00 AM to 5:00 PM Pacific Time.`,
          },
        ],
      },
    },
  };

  const res = await fetch(`${VAPI_BASE_URL}/call`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${effectiveApiKey}`,
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
export async function getVapiCall(callId: string, apiKey?: string): Promise<VapiGetCallResponse> {
  const effectiveApiKey = apiKey || ENV.vapiApiKey;
  const res = await fetch(`${VAPI_BASE_URL}/call/${callId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${effectiveApiKey}`,
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

// ─────────────────────────────────────────────
// Assistant Management
// ─────────────────────────────────────────────

/** Response from VAPI Create Assistant endpoint */
export interface VapiAssistantResponse {
  id: string;
  name: string;
  voice?: Record<string, unknown>;
  model?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

/** Response from VAPI Phone Number endpoint */
export interface VapiPhoneNumberResponse {
  id: string;
  number?: string;
  assistantId?: string;
  provider?: string;
  createdAt?: string;
  [key: string]: unknown;
}

/**
 * Create a new VAPI assistant with custom voice and system prompt.
 * POST https://api.vapi.ai/assistant
 */
export async function createVapiAssistant(opts: {
  name: string;
  firstMessage: string;
  systemPrompt: string;
  voiceProvider?: string;
  voiceId: string;
  modelProvider?: string;
  model?: string;
  endCallMessage?: string;
  metadata?: Record<string, string>;
}): Promise<VapiAssistantResponse> {
  const body: Record<string, unknown> = {
    name: opts.name,
    firstMessage: opts.firstMessage,
    model: {
      provider: opts.modelProvider || "openai",
      model: opts.model || "gpt-4o",
      messages: [
        {
          role: "system",
          content: opts.systemPrompt,
        },
      ],
    },
    voice: {
      provider: "11labs",
      voiceId: opts.voiceId,
      stability: 0.5,
      similarityBoost: 0.75,
    },
    endCallMessage: opts.endCallMessage || "Thank you for your time. Have a great day!",
    recordingEnabled: true,
    hipaaEnabled: false,
    silenceTimeoutSeconds: 30,
    maxDurationSeconds: 600,
    backgroundSound: "office",
    metadata: opts.metadata || {},
  };

  const res = await fetch(`${VAPI_BASE_URL}/assistant`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.vapiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[VAPI] Create assistant failed (${res.status}):`, text);
    throw new VapiApiError(res.status, text);
  }

  const data = (await res.json()) as VapiAssistantResponse;
  console.log(`[VAPI] Assistant created: ${data.id} name=${data.name}`);
  return data;
}

/**
 * Update an existing VAPI assistant.
 * PATCH https://api.vapi.ai/assistant/{id}
 */
export async function updateVapiAssistant(
  assistantId: string,
  updates: Record<string, unknown>
): Promise<VapiAssistantResponse> {
  const res = await fetch(`${VAPI_BASE_URL}/assistant/${assistantId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${ENV.vapiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[VAPI] Update assistant failed (${res.status}):`, text);
    throw new VapiApiError(res.status, text);
  }

  return (await res.json()) as VapiAssistantResponse;
}

/**
 * Get a VAPI assistant by ID.
 * GET https://api.vapi.ai/assistant/{id}
 */
export async function getVapiAssistant(assistantId: string): Promise<VapiAssistantResponse> {
  const res = await fetch(`${VAPI_BASE_URL}/assistant/${assistantId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${ENV.vapiApiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[VAPI] Get assistant failed (${res.status}):`, text);
    throw new VapiApiError(res.status, text);
  }

  return (await res.json()) as VapiAssistantResponse;
}

/**
 * Purchase and attach a phone number to a VAPI assistant.
 * POST https://api.vapi.ai/phone-number
 */
export async function provisionVapiPhoneNumber(opts: {
  assistantId: string;
  areaCode?: string;
}): Promise<VapiPhoneNumberResponse> {
  const body: Record<string, unknown> = {
    provider: "blooio",
    assistantId: opts.assistantId,
  };
  if (opts.areaCode) {
    body.numberDesiredAreaCode = opts.areaCode;
  }

  const res = await fetch(`${VAPI_BASE_URL}/phone-number`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.vapiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[VAPI] Provision phone number failed (${res.status}):`, text);
    throw new VapiApiError(res.status, text);
  }

  const data = (await res.json()) as VapiPhoneNumberResponse;
  console.log(`[VAPI] Phone number provisioned: ${data.number} for assistant ${opts.assistantId}`);
  return data;
}

// ─────────────────────────────────────────────
// Status mapping
// ─────────────────────────────────────────────

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
