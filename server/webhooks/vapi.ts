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
  getCalendar,
  getAppointments,
  getAccountMessagingSettings,
  findContactByPhone,
  logContactActivity,
} from "../db";
import { mapVapiStatus, mapVapiEndedReason } from "../services/vapi";
import { sendPushNotificationToAccount } from "../services/webPush";
import {
  parseBusinessHoursJson,
  resolveBusinessHoursSchedule,
  getTimeInTimezone,
  isWithinBusinessHoursSchedule,
  type BusinessHoursSchedule,
} from "../utils/businessHours";

// ─────────────────────────────────────────────
// Public REST webhook endpoint for VAPI
// POST /api/webhooks/vapi
//
// Handles VAPI's native format, simplified format, and tool-calls.
// ─────────────────────────────────────────────

export const vapiWebhookRouter = Router();

// Account → Calendar mapping (loaded lazily)
const accountCalendarCache = new Map<number, number>();

/** Clear the calendar cache (used in tests) */
export function clearCalendarCache() {
  accountCalendarCache.clear();
}

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

/**
 * Resolve the effective timezone for an account.
 * Priority: calendar timezone > businessHours timezone > default "America/New_York"
 */
async function getAccountTimezone(accountId: number, calendarId?: number | null): Promise<string> {
  // Try calendar timezone first (most specific)
  if (calendarId) {
    const cal = await getCalendar(calendarId, accountId);
    if (cal?.timezone) return cal.timezone;
  }
  // Fall back to business hours timezone from messaging settings
  const settings = await getAccountMessagingSettings(accountId);
  if (settings?.businessHours) {
    const parsed = parseBusinessHoursJson(settings.businessHours);
    if (parsed?.timezone) return parsed.timezone;
  }
  return "America/New_York";
}

/**
 * Get the business hours schedule for an account.
 */
async function getAccountBusinessHoursSchedule(accountId: number): Promise<BusinessHoursSchedule> {
  const settings = await getAccountMessagingSettings(accountId);
  const parsed = settings?.businessHours ? parseBusinessHoursJson(settings.businessHours) : null;
  return resolveBusinessHoursSchedule(parsed);
}

/**
 * Convert a date string + time string in a given timezone to a UTC Date.
 * e.g. convertToUTC("2026-03-30", "14:00", "America/New_York") → Date in UTC
 */
function convertToUTC(dateStr: string, timeStr: string, timezone: string): Date {
  // Build a date in the target timezone using Intl to find the offset
  const localStr = `${dateStr}T${timeStr}:00`;
  const naive = new Date(localStr + "Z"); // treat as UTC temporarily
  
  // Get the timezone offset by comparing formatted output
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  
  // Binary search for the correct UTC time that maps to the desired local time
  // Start with an estimate based on a rough offset
  const parts = formatter.formatToParts(naive);
  const tzHour = parseInt(parts.find(p => p.type === "hour")?.value ?? "0", 10);
  const tzMinute = parseInt(parts.find(p => p.type === "minute")?.value ?? "0", 10);
  const [wantH, wantM] = timeStr.split(":").map(Number);
  
  // Calculate offset: naive is UTC, tzHour:tzMinute is what that UTC maps to in the timezone
  const naiveMinutes = naive.getUTCHours() * 60 + naive.getUTCMinutes();
  const tzMinutes = tzHour * 60 + tzMinute;
  let offsetMinutes = tzMinutes - naiveMinutes;
  
  // Handle day boundary wrap
  if (offsetMinutes > 720) offsetMinutes -= 1440;
  if (offsetMinutes < -720) offsetMinutes += 1440;
  
  // The UTC time = local time - offset
  const result = new Date(naive.getTime() - offsetMinutes * 60 * 1000);
  return result;
}

/**
 * Check for overlapping appointments on a calendar within a time range.
 * Returns conflicting appointments (excluding cancelled ones).
 */
async function findConflictingAppointments(
  calendarId: number,
  accountId: number,
  startTime: Date,
  endTime: Date,
  bufferMinutes: number = 0
): Promise<Array<{ id: number; startTime: Date; endTime: Date; guestName: string }>> {
  const bufferedStart = new Date(startTime.getTime() - bufferMinutes * 60 * 1000);
  const bufferedEnd = new Date(endTime.getTime() + bufferMinutes * 60 * 1000);
  
  const existing = await getAppointments(accountId, {
    calendarId,
    startDate: new Date(startTime.getTime() - 24 * 60 * 60 * 1000), // day before for safety
    endDate: new Date(endTime.getTime() + 24 * 60 * 60 * 1000),     // day after for safety
  });
  
  return existing.filter(appt => {
    if (appt.status === "cancelled") return false;
    const apptStart = new Date(appt.startTime).getTime();
    const apptEnd = new Date(appt.endTime).getTime();
    // Check overlap with buffer
    return (startTime.getTime() < apptEnd + bufferMinutes * 60 * 1000) &&
           (endTime.getTime() > apptStart - bufferMinutes * 60 * 1000);
  });
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
// bookAppointment tool handler (hardened)
// ─────────────────────────────────────────────
async function handleBookAppointment(
  accountId: number,
  args: {
    guestName: string;
    guestEmail?: string;
    guestPhone?: string;
    date: string;
    time: string;
    notes?: string;
  },
  vapiCallId?: string
): Promise<string> {
  try {
    const { guestName, guestEmail, guestPhone, date, time, notes } = args;

    if (!guestName || !date || !time) {
      return JSON.stringify({ success: false, reason: "I need the guest's name, date, and time to book an appointment. Could you provide those?" });
    }

    // Get the calendar for this account
    const calendarId = await getCalendarForAccount(accountId);
    if (!calendarId) {
      console.error(`[VAPI Webhook] No calendar found for account ${accountId}`);
      return JSON.stringify({ success: false, reason: "I'm sorry, I'm having trouble accessing the scheduling system right now. Let me have someone call you back to schedule." });
    }

    // Get the calendar to read slot duration and buffer
    const calendar = await getCalendar(calendarId, accountId);
    const slotDuration = calendar?.slotDurationMinutes ?? 30;
    const bufferMinutes = calendar?.bufferMinutes ?? 15;

    // ── Timezone handling ──
    // Use the account's configured timezone (from calendar or business hours)
    const timezone = await getAccountTimezone(accountId, calendarId);
    console.log(`[VAPI Webhook] Using timezone ${timezone} for account ${accountId}`);

    // Convert the date/time from the account's timezone to UTC
    const startTime = convertToUTC(date, time, timezone);
    const endTime = new Date(startTime.getTime() + slotDuration * 60 * 1000);

    if (isNaN(startTime.getTime())) {
      return JSON.stringify({ success: false, reason: `I couldn't understand the date and time "${date} ${time}". Could you give me a specific date like March 28th at 2 PM?` });
    }

    // Check if the slot is in the past
    if (startTime.getTime() < Date.now()) {
      return JSON.stringify({ success: false, reason: "That time has already passed. Could you suggest a future date and time?" });
    }

    // ── Double-booking check ──
    const conflicts = await findConflictingAppointments(calendarId, accountId, startTime, endTime, bufferMinutes);
    if (conflicts.length > 0) {
      console.log(`[VAPI Webhook] Double-booking detected: ${conflicts.length} conflict(s) for ${date} ${time}`);
      // Get next 3 available slots to suggest alternatives
      const availableSlots = await getAvailableSlots(calendarId, date);
      const requestedMinutes = parseInt(time.split(":")[0]) * 60 + parseInt(time.split(":")[1]);
      // Filter to slots after the requested time
      const laterSlots = availableSlots.filter((s: { start: string }) => {
        const [h, m] = s.start.split(":").map(Number);
        return h * 60 + m > requestedMinutes;
      }).slice(0, 3);

      let suggestion = "";
      if (laterSlots.length > 0) {
        const slotStrs = laterSlots.map((s: { start: string }) => formatTime12h(s.start));
        suggestion = ` Here are available times: ${slotStrs.join(", ")}.`;
      } else {
        suggestion = " Would you like to try a different date?";
      }

      return JSON.stringify({ success: false, reason: `That time is already booked.${suggestion}` });
    }

    // ── Contact linkage ──
    // Priority: 1) from AI call session, 2) by phone number lookup
    let contactId: number | null = null;
    if (vapiCallId) {
      const call = await getAICallByExternalId(vapiCallId);
      if (call?.contactId && call.contactId > 0) {
        contactId = call.contactId;
      }
    }
    // Fallback: look up contact by phone number
    if (!contactId && guestPhone && accountId) {
      const contact = await findContactByPhone(guestPhone, accountId);
      if (contact) contactId = contact.id;
    }

    // Create the appointment
    const appointment = await createAppointment({
      calendarId,
      accountId,
      contactId,
      guestName,
      guestEmail: guestEmail || "not-provided@placeholder.com",
      guestPhone: guestPhone || "",
      startTime,
      endTime,
      status: "confirmed",
      notes: notes || `Booked via AI voice agent. VAPI Call: ${vapiCallId || "unknown"}`,
    });

    const humanDate = formatDateForHuman(date, time);
    console.log(`[VAPI Webhook] ✅ Appointment created: ID=${appointment.id}, account=${accountId}, contact=${contactId}, guest=${guestName}, ${date} ${time} (${timezone})`);

    // ── Activity logging ──
    logContactActivity({
      contactId: contactId || 0,
      accountId,
      activityType: "appointment_booked",
      description: `Appointment booked via AI call for ${guestName} on ${humanDate}`,
      metadata: JSON.stringify({
        appointmentId: appointment.id,
        calendarId,
        guestName,
        guestEmail,
        guestPhone,
        vapiCallId,
        timezone,
      }),
    });

    // ── Notification for account owner ──
    createNotification({
      accountId,
      userId: null,
      type: "appointment_booked",
      title: "New appointment booked via AI",
      body: `${guestName} booked for ${humanDate}`,
      link: "/calendar",
    }).catch((err) => console.error("[VAPI Webhook] Notification error:", err));

    // ── Push notification for appointment booked ──
    sendPushNotificationToAccount(accountId, {
      title: "New appointment booked via AI",
      body: `${guestName} booked for ${humanDate}`,
      url: "/calendar",
      tag: `appointment-${appointment.id}`,
    }).catch((err) => console.error("[VAPI Webhook] Push notification error:", err));

    // ── Fire appointment_booked automation trigger (non-blocking) ──
    if (contactId) {
      import("../services/workflowTriggers")
        .then(({ onAppointmentBooked }) =>
          onAppointmentBooked(accountId, contactId!, appointment.id, calendarId!)
        )
        .catch((err) =>
          console.error("[VAPI Webhook] appointment_booked trigger error:", err)
        );
    }

    return JSON.stringify({
      success: true,
      appointmentId: appointment.id,
      message: `Appointment confirmed for ${guestName} on ${humanDate}. They will receive a confirmation shortly.`,
    });
  } catch (err: any) {
    console.error(`[VAPI Webhook] bookAppointment error:`, err);
    return JSON.stringify({ success: false, reason: "System error, please try again" });
  }
}

// ─────────────────────────────────────────────
// checkAvailability tool handler (hardened)
// ─────────────────────────────────────────────
async function handleCheckAvailability(
  accountId: number,
  args: { date?: string }
): Promise<string> {
  try {
    const { date } = args;

    if (!date) {
      return JSON.stringify({ success: false, reason: "I need a date to check availability. What date were you thinking?" });
    }

    const calendarId = await getCalendarForAccount(accountId);
    if (!calendarId) {
      return JSON.stringify({ success: false, reason: "I'm having trouble accessing the schedule. Let me suggest some general availability — we're typically available Monday through Friday, 9 AM to 5 PM." });
    }

    // Get calendar config for buffer time
    const calendar = await getCalendar(calendarId, accountId);
    const timezone = await getAccountTimezone(accountId, calendarId);

    // Get business hours schedule to cross-check
    const businessHours = await getAccountBusinessHoursSchedule(accountId);

    // Get available slots for the requested date
    let slots = await getAvailableSlots(calendarId, date);

    // Cross-check with business hours: filter out slots outside business hours
    if (businessHours.enabled && slots.length > 0) {
      const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const dateObj = new Date(date + "T12:00:00Z");
      const dayName = dayNames[dateObj.getUTCDay()];
      const dayConfig = businessHours.schedule[dayName];

      if (!dayConfig || !dayConfig.open) {
        slots = []; // Business is closed this day
      } else {
        const bhStart = dayConfig.start || "07:00";
        const bhEnd = dayConfig.end || "22:00";
        const [bhStartH, bhStartM] = bhStart.split(":").map(Number);
        const [bhEndH, bhEndM] = bhEnd.split(":").map(Number);
        const bhStartMin = bhStartH * 60 + bhStartM;
        const bhEndMin = bhEndH * 60 + bhEndM;

        slots = slots.filter((s: { start: string; end: string }) => {
          const [h, m] = s.start.split(":").map(Number);
          const slotMin = h * 60 + m;
          return slotMin >= bhStartMin && slotMin < bhEndMin;
        });
      }
    }

    // If no slots on this date, try the next 2 days to find alternatives
    if (!slots || slots.length === 0) {
      const altSlots: Array<{ date: string; dateLabel: string; slots: string[] }> = [];
      for (let i = 1; i <= 5 && altSlots.length < 2; i++) {
        const nextDate = new Date(date + "T12:00:00Z");
        nextDate.setUTCDate(nextDate.getUTCDate() + i);
        const nextDateStr = nextDate.toISOString().split("T")[0];
        let nextSlots = await getAvailableSlots(calendarId, nextDateStr);

        // Cross-check with business hours
        if (businessHours.enabled && nextSlots.length > 0) {
          const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
          const dayName = dayNames[nextDate.getUTCDay()];
          const dayConfig = businessHours.schedule[dayName];
          if (!dayConfig || !dayConfig.open) {
            nextSlots = [];
          } else {
            const bhStart = dayConfig.start || "07:00";
            const bhEnd = dayConfig.end || "22:00";
            const [bhStartH, bhStartM] = bhStart.split(":").map(Number);
            const [bhEndH, bhEndM] = bhEnd.split(":").map(Number);
            const bhStartMin = bhStartH * 60 + bhStartM;
            const bhEndMin = bhEndH * 60 + bhEndM;
            nextSlots = nextSlots.filter((s: { start: string; end: string }) => {
              const [h, m] = s.start.split(":").map(Number);
              return h * 60 + m >= bhStartMin && h * 60 + m < bhEndMin;
            });
          }
        }

        if (nextSlots.length > 0) {
          altSlots.push({
            date: nextDateStr,
            dateLabel: formatDateOnly(nextDateStr),
            slots: nextSlots.slice(0, 3).map((s: { start: string }) => formatTime12h(s.start)),
          });
        }
      }

      if (altSlots.length > 0) {
        const altText = altSlots.map(a => `${a.dateLabel}: ${a.slots.join(", ")}`).join(". ");
        return JSON.stringify({
          success: true,
          available: false,
          message: `There are no available slots on ${formatDateOnly(date)}. Here are some upcoming options: ${altText}`,
        });
      }

      return JSON.stringify({
        success: true,
        available: false,
        message: `There are no available slots on ${formatDateOnly(date)} or the next few days. Would you like to try a different week?`,
      });
    }

    // Return up to 5 slots
    const displaySlots = slots.slice(0, 5).map((s: { start: string }) => formatTime12h(s.start));
    const moreCount = slots.length - displaySlots.length;

    let message = `Available times on ${formatDateOnly(date)}: ${displaySlots.join(", ")}`;
    if (moreCount > 0) {
      message += ` and ${moreCount} more slots`;
    }

    return JSON.stringify({
      success: true,
      available: true,
      message,
      slots: displaySlots,
      timezone,
    });
  } catch (err: any) {
    console.error(`[VAPI Webhook] checkAvailability error:`, err);
    return JSON.stringify({ success: false, reason: "System error, please try again" });
  }
}

// ─────────────────────────────────────────────
// Date formatting helpers
// ─────────────────────────────────────────────
function formatTime12h(timeStr: string): string {
  const h = parseInt(timeStr.split(":")[0]);
  const m = timeStr.split(":")[1];
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${m} ${ampm}`;
}

function formatDateForHuman(date: string, time: string): string {
  const dateObj = new Date(`${date}T${time}:00`);
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayName = days[dateObj.getDay()];
  const monthName = months[dateObj.getMonth()];
  const dayNum = dateObj.getDate();

  return `${dayName}, ${monthName} ${dayNum} at ${formatTime12h(time)}`;
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

    // Push notification for call completed
    sendPushNotificationToAccount(call.accountId, {
      title: "AI call completed",
      body: summary.substring(0, 100),
      url: "/ai-calls",
      tag: `call-${call.id}`,
    }).catch((err) => console.error("[VAPI Webhook] Push notification error:", err));
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

    // Push notification for call completed (simplified format)
    sendPushNotificationToAccount(call.accountId, {
      title: "AI call completed",
      body: summary.substring(0, 100),
      url: "/ai-calls",
      tag: `call-${call.id}`,
    }).catch((err) => console.error("[VAPI Webhook] Push notification error:", err));
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
