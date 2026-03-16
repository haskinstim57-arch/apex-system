import { Router, Request, Response } from "express";
import {
  getAICallById,
  getAICallByExternalId,
  updateAICall,
} from "../db";
import { mapVapiStatus, mapVapiEndedReason } from "../services/vapi";

// ─────────────────────────────────────────────
// Public REST webhook endpoint for VAPI via n8n
// POST /api/webhooks/vapi
//
// n8n forwards VAPI webhook payloads to this endpoint.
// Accepts both VAPI's native format and a simplified format.
// ─────────────────────────────────────────────

export const vapiWebhookRouter = Router();

/**
 * Accepted payload formats:
 *
 * 1. VAPI native format (forwarded as-is from n8n):
 * {
 *   "message": {
 *     "type": "end-of-call-report" | "status-update" | "transcript",
 *     "call": { "id": "vapi-call-id", "status": "ended", "endedReason": "...", "metadata": { "apex_call_id": "123" } },
 *     "artifact": { "transcript": "...", "recordingUrl": "..." },
 *     "analysis": { "summary": "..." }
 *   }
 * }
 *
 * 2. Simplified/flat format (n8n can reshape before forwarding):
 * {
 *   "callId": "vapi-call-id",           // VAPI external call ID
 *   "apexCallId": 123,                   // OR our internal call ID
 *   "status": "ended",
 *   "endedReason": "assistant-ended",
 *   "transcript": "...",
 *   "recordingUrl": "...",
 *   "summary": "...",
 *   "startedAt": "2026-03-16T...",
 *   "endedAt": "2026-03-16T...",
 *   "durationSeconds": 120
 * }
 */

vapiWebhookRouter.post("/api/webhooks/vapi", async (req: Request, res: Response) => {
  try {
    const body = req.body;

    if (!body || typeof body !== "object") {
      console.warn("[VAPI Webhook REST] Empty or invalid body");
      return res.status(400).json({ success: false, error: "Invalid payload" });
    }

    // Detect format: VAPI native (has "message" wrapper) vs simplified/flat
    if (body.message && typeof body.message === "object") {
      // ─── VAPI native format ───
      const result = await handleNativeVapiPayload(body.message);
      return res.json(result);
    } else {
      // ─── Simplified/flat format ───
      const result = await handleSimplifiedPayload(body);
      return res.json(result);
    }
  } catch (err) {
    console.error("[VAPI Webhook REST] Error processing webhook:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────
// Handle VAPI native payload (forwarded from n8n as-is)
// ─────────────────────────────────────────────
async function handleNativeVapiPayload(message: any): Promise<{ success: boolean; error?: string }> {
  const vapiCallId = message.call?.id;
  const apexCallIdStr = message.call?.metadata?.apex_call_id;

  // Find our internal call record by apex_call_id or externalCallId
  const call = await resolveCall(apexCallIdStr, vapiCallId);
  if (!call) {
    console.warn(`[VAPI Webhook REST] Could not find call: apex=${apexCallIdStr} vapi=${vapiCallId}`);
    return { success: false, error: "Call not found" };
  }

  const updateData: Record<string, any> = {};

  switch (message.type) {
    case "status-update": {
      const vapiStatus = message.call?.status;
      if (vapiStatus) {
        updateData.status = mapVapiStatus(vapiStatus);
      }
      break;
    }
    case "end-of-call-report": {
      const endedReason = message.call?.endedReason;
      updateData.status = mapVapiEndedReason(endedReason);
      updateData.endedAt = new Date();

      // Extract transcript
      const transcript =
        message.artifact?.transcript ?? message.transcript ?? null;
      if (transcript) updateData.transcript = transcript;

      // Extract recording URL
      const recordingUrl =
        message.artifact?.recordingUrl ?? message.recordingUrl ?? null;
      if (recordingUrl) updateData.recordingUrl = recordingUrl;

      // Extract summary
      const summary =
        message.analysis?.summary ?? message.summary ?? null;
      if (summary) updateData.summary = summary;

      // Calculate duration from timestamps if available
      if (message.call?.startedAt && message.call?.endedAt) {
        const start = new Date(message.call.startedAt).getTime();
        const end = new Date(message.call.endedAt).getTime();
        if (start > 0 && end > start) {
          updateData.durationSeconds = Math.round((end - start) / 1000);
        }
      } else if (message.durationSeconds) {
        updateData.durationSeconds = message.durationSeconds;
      }

      // Store full payload as metadata
      updateData.metadata = JSON.stringify(message);
      break;
    }
    case "transcript": {
      if (message.transcript) {
        updateData.transcript = message.transcript;
      }
      break;
    }
    default:
      console.log(`[VAPI Webhook REST] Unhandled type: ${message.type}`);
  }

  if (Object.keys(updateData).length > 0) {
    await updateAICall(call.id, updateData);
    console.log(`[VAPI Webhook REST] Updated call ${call.id}: type=${message.type}`);
  }

  return { success: true };
}

// ─────────────────────────────────────────────
// Handle simplified/flat payload (n8n reshaped)
// ─────────────────────────────────────────────
async function handleSimplifiedPayload(body: any): Promise<{ success: boolean; error?: string }> {
  const vapiCallId = body.callId || body.call_id || body.vapiCallId;
  const apexCallId = body.apexCallId || body.apex_call_id;

  const call = await resolveCall(apexCallId, vapiCallId);
  if (!call) {
    console.warn(`[VAPI Webhook REST] Could not find call: apex=${apexCallId} vapi=${vapiCallId}`);
    return { success: false, error: "Call not found" };
  }

  const updateData: Record<string, any> = {};

  // Map status
  if (body.status) {
    if (body.status === "ended") {
      updateData.status = mapVapiEndedReason(body.endedReason);
      updateData.endedAt = body.endedAt ? new Date(body.endedAt) : new Date();
    } else {
      updateData.status = mapVapiStatus(body.status);
    }
  }

  // Direct field mapping
  if (body.transcript) updateData.transcript = body.transcript;
  if (body.recordingUrl || body.recording_url) {
    updateData.recordingUrl = body.recordingUrl || body.recording_url;
  }
  if (body.summary) updateData.summary = body.summary;
  if (body.durationSeconds || body.duration_seconds) {
    updateData.durationSeconds = body.durationSeconds || body.duration_seconds;
  }
  if (body.sentiment) updateData.sentiment = body.sentiment;

  // Calculate duration from timestamps if not provided directly
  if (!updateData.durationSeconds && body.startedAt && body.endedAt) {
    const start = new Date(body.startedAt).getTime();
    const end = new Date(body.endedAt).getTime();
    if (start > 0 && end > start) {
      updateData.durationSeconds = Math.round((end - start) / 1000);
    }
  }

  // Store raw payload as metadata
  updateData.metadata = JSON.stringify(body);

  if (Object.keys(updateData).length > 1) {
    // > 1 because metadata is always added
    await updateAICall(call.id, updateData);
    console.log(`[VAPI Webhook REST] Updated call ${call.id} (simplified format)`);
  }

  return { success: true };
}

// ─────────────────────────────────────────────
// Resolve internal call record from various IDs
// ─────────────────────────────────────────────
async function resolveCall(apexCallId: any, vapiCallId?: string) {
  // Try by our internal ID first
  if (apexCallId) {
    const id = typeof apexCallId === "string" ? parseInt(apexCallId, 10) : apexCallId;
    if (!isNaN(id)) {
      const call = await getAICallById(id);
      if (call) return call;
    }
  }

  // Fall back to looking up by VAPI external call ID
  if (vapiCallId) {
    const call = await getAICallByExternalId(vapiCallId);
    if (call) return call;
  }

  return null;
}
