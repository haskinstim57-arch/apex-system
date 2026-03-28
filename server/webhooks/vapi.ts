import { Router, Request, Response } from "express";
import {
  getAICallById,
  getAICallByExternalId,
  updateAICall,
  createAICall,
  createNotification,
  createAppointment,
  getAvailableSlots,
  getCalendars,
  findContactByPhone,
} from "../db";
import { mapVapiStatus, mapVapiEndedReason } from "../services/vapi";

// ─────────────────────────────────────────────
// Public REST webhook endpoint for VAPI
// POST /api/webhooks/vapi
//
// Handles VAPI's native format, simplified format, and tool-calls.
// ─────────────────────────────────────────────

export const vapiWebhookRouter = Router();

// Account → Calendar mapping (loaded lazily)
const accountCalendarCache = new Map<number, number>();

async function getCalendarForAccount(accountId: number): Promise<number | null> {
  if (accountCalendarCache.has(accountId)) {
    return accountCalendarCache.get(accountId)!;
  }
  const cals = await getCalendars(accountId);
  if (cals.length > 0) {
    accountCalendarCache.set(accountId, cals[0].id);
    return cals[0].id;
  }
  return null;
}

vapiWebhookRouter.post("/api/webhooks/vapi", async (req: Request, res: Response) => {
  try {
    const body = req.body;

    if (!body || typeof body !== "object") {
      console.warn("[VAPI Webhook] Empty or invalid body");
      return res.status(400).json({ success: false, error: "Invalid payload" });
    }

    // Detect format: VAPI native (has "message" wrapper) vs simplified/flat
    if (body.message && typeof body.message === "object") {
      const message = body.message;

      // ─── tool-calls require a special response format ───
      if (message.type === "tool-calls") {
        const result = await handleToolCalls(message);
        return res.json(result);
      }

      // ─── All other VAPI native messages ───
      const result = await handleNativeVapiPayload(message);
      return res.json(result);
    } else {
      // ─── Simplified/flat format ───
      const result = await handleSimplifiedPayload(body);
      return res.json(result);
    }
  } catch (err) {
    console.error("[VAPI Webhook] Error processing webhook:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────
// Handle VAPI tool-calls (function calling)
// ─────────────────────────────────────────────
async function handleToolCalls(message: any): Promise<any> {
  const toolCallList = message.toolCallList || [];
  const callMetadata = message.call?.metadata || {};
  const accountId = parseInt(callMetadata.apex_account_id || "0", 10);
  const vapiCallId = message.call?.id;

  console.log(`[VAPI Webhook] tool-calls received: ${toolCallList.length} calls, account=${accountId}, vapiCall=${vapiCallId}`);

  const results: any[] = [];

  for (const toolCall of toolCallList) {
    const fnName = toolCall.function?.name;
    let args: any = {};
    try {
      args = typeof toolCall.function?.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function?.arguments || {};
    } catch {
      args = {};
    }

    console.log(`[VAPI Webhook] Tool call: ${fnName}(${JSON.stringify(args)})`);

    try {
      if (fnName === "bookAppointment") {
        const result = await handleBookAppointment(accountId, args, vapiCallId);
        results.push({ toolCallId: toolCall.id, result });
      } else if (fnName === "checkAvailability") {
        const result = await handleCheckAvailability(accountId, args);
        results.push({ toolCallId: toolCall.id, result });
      } else {
        console.warn(`[VAPI Webhook] Unknown tool: ${fnName}`);
        results.push({
          toolCallId: toolCall.id,
          result: `Unknown function: ${fnName}`,
        });
      }
    } catch (err: any) {
      console.error(`[VAPI Webhook] Tool call error for ${fnName}:`, err);
      results.push({
        toolCallId: toolCall.id,
        result: `Error executing ${fnName}: ${err.message}`,
      });
    }
  }

  return { results };
}

// ─────────────────────────────────────────────
// bookAppointment tool handler
// ─────────────────────────────────────────────
async function handleBookAppointment(
  accountId: number,
  args: {
    guestName: string;
    guestEmail?: string;
    guestPhone: string;
    date: string;
    time: string;
    notes?: string;
  },
  vapiCallId?: string
): Promise<string> {
  const { guestName, guestEmail, guestPhone, date, time, notes } = args;

  if (!guestName || !date || !time) {
    return "I need the guest's name, date, and time to book an appointment. Could you provide those?";
  }

  // Get the calendar for this account
  const calendarId = await getCalendarForAccount(accountId);
  if (!calendarId) {
    console.error(`[VAPI Webhook] No calendar found for account ${accountId}`);
    return "I'm sorry, I'm having trouble accessing the scheduling system right now. Let me have someone call you back to schedule.";
  }

  // Parse date and time into UTC timestamps
  // Determine correct Pacific Time offset (PDT = -07:00, PST = -08:00)
  // Use a temp date to check if the target date is in DST
  const tempDate = new Date(`${date}T12:00:00Z`);
  const janOffset = new Date(tempDate.getFullYear(), 0, 1).getTimezoneOffset();
  const julOffset = new Date(tempDate.getFullYear(), 6, 1).getTimezoneOffset();
  // Pacific Time: PST = UTC-8, PDT = UTC-7
  // DST in US: second Sunday of March to first Sunday of November
  const month = tempDate.getUTCMonth(); // 0-indexed
  const isPDT = month >= 2 && month <= 9; // Rough: March-October
  const ptOffset = isPDT ? "-07:00" : "-08:00";
  const startTime = new Date(`${date}T${time}:00${ptOffset}`);
  const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30-min slot

  if (isNaN(startTime.getTime())) {
    return `I couldn't understand the date and time "${date} ${time}". Could you give me a specific date like March 28th at 2 PM?`;
  }

  // Check if the slot is in the past
  if (startTime.getTime() < Date.now()) {
    return "That time has already passed. Could you suggest a future date and time?";
  }

  // Try to find the contact from the call
  let contactId: number | undefined;
  if (vapiCallId) {
    const call = await getAICallByExternalId(vapiCallId);
    if (call?.contactId) {
      contactId = call.contactId;
    }
  }

  // Create the appointment
  const appointment = await createAppointment({
    calendarId,
    accountId,
    contactId: contactId || null,
    guestName,
    guestEmail: guestEmail || "not-provided@placeholder.com",
    guestPhone: guestPhone || "",
    startTime,
    endTime,
    status: "confirmed",
    notes: notes || `Booked via AI voice agent. VAPI Call: ${vapiCallId || "unknown"}`,
  });

  console.log(`[VAPI Webhook] ✅ Appointment created: ID=${appointment.id}, account=${accountId}, guest=${guestName}, ${date} ${time}`);

  // Create notification for the account owner
  createNotification({
    accountId,
    userId: null,
    type: "appointment_booked",
    title: "New appointment booked via AI",
    body: `${guestName} booked for ${formatDateForHuman(date, time)}`,
    link: "/calendar",
  }).catch((err) => console.error("[VAPI Webhook] Notification error:", err));

  // Fire appointment_booked automation trigger (non-blocking)
  if (contactId) {
    import("../services/workflowTriggers")
      .then(({ onAppointmentBooked }) =>
        onAppointmentBooked(accountId, contactId!, appointment.id, calendarId!)
      )
      .catch((err) =>
        console.error("[VAPI Webhook] appointment_booked trigger error:", err)
      );
  }

  return `Appointment confirmed for ${guestName} on ${formatDateForHuman(date, time)}. They will receive a confirmation shortly.`;
}

// ─────────────────────────────────────────────
// checkAvailability tool handler
// ─────────────────────────────────────────────
async function handleCheckAvailability(
  accountId: number,
  args: { date: string }
): Promise<string> {
  const { date } = args;

  if (!date) {
    return "I need a date to check availability. What date were you thinking?";
  }

  const calendarId = await getCalendarForAccount(accountId);
  if (!calendarId) {
    return "I'm having trouble accessing the schedule. Let me suggest some general availability — we're typically available Monday through Friday, 9 AM to 5 PM Pacific Time.";
  }

  const slots = await getAvailableSlots(calendarId, date);

  if (!slots || slots.length === 0) {
    // Check if it's a weekend
    const dateObj = new Date(date + "T12:00:00Z");
    const day = dateObj.getUTCDay();
    if (day === 0 || day === 6) {
      return `We don't have availability on weekends. Would you like to check a weekday instead?`;
    }
    return `There are no available slots on ${formatDateOnly(date)}. Would you like to try a different date?`;
  }

  // Format slots for the AI to read
  const slotStrings = slots.map((s: { start: string; end: string }) => {
    const h = parseInt(s.start.split(":")[0]);
    const m = s.start.split(":")[1];
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${h12}:${m} ${ampm}`;
  });

  // Limit to first 6 slots to keep it concise for the AI
  const displaySlots = slotStrings.slice(0, 6);
  const moreCount = slotStrings.length - displaySlots.length;

  let response = `Available times on ${formatDateOnly(date)}: ${displaySlots.join(", ")}`;
  if (moreCount > 0) {
    response += ` and ${moreCount} more slots`;
  }
  return response;
}

// ─────────────────────────────────────────────
// Date formatting helpers
// ─────────────────────────────────────────────
function formatDateForHuman(date: string, time: string): string {
  const dateObj = new Date(`${date}T${time}:00`);
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayName = days[dateObj.getDay()];
  const monthName = months[dateObj.getMonth()];
  const dayNum = dateObj.getDate();

  const h = parseInt(time.split(":")[0]);
  const m = time.split(":")[1];
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;

  return `${dayName}, ${monthName} ${dayNum} at ${h12}:${m} ${ampm}`;
}

function formatDateOnly(date: string): string {
  const dateObj = new Date(date + "T12:00:00Z");
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${days[dateObj.getUTCDay()]}, ${months[dateObj.getUTCMonth()]} ${dateObj.getUTCDate()}`;
}

// ─────────────────────────────────────────────
// Handle VAPI native payload (non-tool-calls)
// ─────────────────────────────────────────────
async function handleNativeVapiPayload(message: any): Promise<{ success: boolean; error?: string }> {
  const vapiCallId = message.call?.id;
  const apexCallIdStr = message.call?.metadata?.apex_call_id;

  // Find our internal call record by apex_call_id or externalCallId
  let call = await resolveCall(apexCallIdStr, vapiCallId);

  // Auto-create internal call record if none exists (e.g., direct VAPI calls, workflow-initiated calls)
  if (!call && vapiCallId) {
    const accountId = parseInt(message.call?.metadata?.apex_account_id || "0", 10);
    const customerPhone = message.call?.customer?.number || "";
    const customerName = message.call?.customer?.name || "Unknown";

    if (accountId > 0) {
      // Try to find the contact by phone number in this account
      let contactId = 0;
      if (customerPhone) {
        const contact = await findContactByPhone(customerPhone, accountId);
        if (contact) contactId = contact.id;
      }

      try {
        const newCall = await createAICall({
          accountId,
          contactId: contactId || 0,
          initiatedById: 0, // System-initiated
          phoneNumber: customerPhone,
          status: "calling",
          direction: "outbound",
          externalCallId: vapiCallId,
          assistantId: message.call?.assistantId || null,
          startedAt: new Date(),
        });
        call = (await getAICallById(newCall.id)) ?? null;
        console.log(`[VAPI Webhook] Auto-created internal call record: id=${newCall.id} vapiId=${vapiCallId} account=${accountId} contact=${contactId}`);
      } catch (err) {
        console.error(`[VAPI Webhook] Failed to auto-create call record:`, err);
      }
    }
  }

  if (!call) {
    console.warn(`[VAPI Webhook] Could not find or create call: apex=${apexCallIdStr} vapi=${vapiCallId}`);
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
      console.log(`[VAPI Webhook] Unhandled type: ${message.type}`);
  }

  if (Object.keys(updateData).length > 0) {
    await updateAICall(call.id, updateData);
    console.log(`[VAPI Webhook] Updated call ${call.id}: type=${message.type}`);
  }

  // Fire call_completed automation trigger when call ends
  if (message.type === "end-of-call-report" && call.contactId && call.accountId) {
    fireCallCompletedTrigger(call.accountId, call.contactId);
  }

  // Create in-app notification when call ends
  if (message.type === "end-of-call-report" && call.accountId) {
    const summary = message.analysis?.summary ?? message.summary ?? "Call completed";
    createNotification({
      accountId: call.accountId,
      userId: null,
      type: "ai_call_completed",
      title: `AI call completed`,
      body: summary.substring(0, 200),
      link: `/ai-calls`,
    }).catch((err) => console.error("[VAPI Webhook] Notification error:", err));
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
    console.warn(`[VAPI Webhook] Could not find call: apex=${apexCallId} vapi=${vapiCallId}`);
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
    console.log(`[VAPI Webhook] Updated call ${call.id} (simplified format)`);
  }

  // Fire call_completed trigger when status is ended/completed
  const isEnded = body.status === "ended" || body.status === "completed";
  if (isEnded && call.contactId && call.accountId) {
    fireCallCompletedTrigger(call.accountId, call.contactId);
  }

  // Create in-app notification when call ends (simplified format)
  if (isEnded && call.accountId) {
    const summary = body.summary || body.transcript?.substring(0, 100) || "Call completed";
    createNotification({
      accountId: call.accountId,
      userId: null,
      type: "ai_call_completed",
      title: `AI call completed`,
      body: summary.substring(0, 200),
      link: `/ai-calls`,
    }).catch((err) => console.error("[VAPI Webhook] Notification error:", err));
  }

  return { success: true };
}

// ─────────────────────────────────────────────
// Fire call_completed automation trigger (non-blocking)
// ─────────────────────────────────────────────
function fireCallCompletedTrigger(accountId: number, contactId: number) {
  import("../services/workflowTriggers")
    .then(({ onCallCompleted }) => onCallCompleted(accountId, contactId))
    .catch((err) =>
      console.error(`[VAPI Webhook] Error firing call_completed trigger:`, err)
    );
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
