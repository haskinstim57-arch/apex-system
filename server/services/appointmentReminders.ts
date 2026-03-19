import { getDb } from "../db";
import { appointments, calendars } from "../../drizzle/schema";
import { and, lte, gte, eq, inArray } from "drizzle-orm";
import { dispatchEmail, dispatchSMS } from "./messaging";

const INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes

/**
 * Background job that sends appointment reminders:
 * - 24 hours before: email + SMS reminder
 * - 1 hour before: email + SMS reminder
 * Skips cancelled appointments and already-sent reminders.
 */
export function startAppointmentReminders() {
  console.log("[AppointmentReminders] Starting reminder job (every 5 min)");

  const run = async () => {
    try {
      await sendReminders();
    } catch (err) {
      console.error("[AppointmentReminders] Error:", err);
    }
  };

  // Run immediately, then on interval
  run();
  setInterval(run, INTERVAL_MS);
}

async function sendReminders() {
  const db = await getDb();
  if (!db) return;

  const now = new Date();

  // 24h window: appointments starting between now and now + 24h that haven't had 24h reminder sent
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const appts24h = await db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.reminder24hSent, false),
        inArray(appointments.status, ["pending", "confirmed"]),
        gte(appointments.startTime, now),
        lte(appointments.startTime, in24h)
      )
    );

  for (const appt of appts24h) {
    await sendReminderForAppointment(appt, "24h");
    await db
      .update(appointments)
      .set({ reminder24hSent: true })
      .where(eq(appointments.id, appt.id));
  }

  // 1h window: appointments starting between now and now + 1h that haven't had 1h reminder sent
  const in1h = new Date(now.getTime() + 60 * 60 * 1000);
  const appts1h = await db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.reminder1hSent, false),
        inArray(appointments.status, ["pending", "confirmed"]),
        gte(appointments.startTime, now),
        lte(appointments.startTime, in1h)
      )
    );

  for (const appt of appts1h) {
    await sendReminderForAppointment(appt, "1h");
    await db
      .update(appointments)
      .set({ reminder1hSent: true })
      .where(eq(appointments.id, appt.id));
  }

  const total = appts24h.length + appts1h.length;
  if (total > 0) {
    console.log(
      `[AppointmentReminders] Sent ${appts24h.length} 24h reminders, ${appts1h.length} 1h reminders`
    );
  }
}

async function sendReminderForAppointment(
  appt: typeof appointments.$inferSelect,
  type: "24h" | "1h"
) {
  // Fetch calendar name
  const db = await getDb();
  const calResult = db
    ? await db
        .select({ name: calendars.name })
        .from(calendars)
        .where(eq(calendars.id, appt.calendarId))
        .limit(1)
    : [];
  const calendar = calResult[0];

  const calName = calendar?.name || "Your Appointment";
  const dateStr = appt.startTime.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = appt.startTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const endTimeStr = appt.endTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const urgency = type === "1h" ? "in 1 hour" : "tomorrow";
  const subject =
    type === "1h"
      ? `Reminder: Your appointment is in 1 hour`
      : `Reminder: Your appointment is tomorrow`;

  // Email reminder to guest
  await dispatchEmail({
    to: appt.guestEmail,
    subject,
    body: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#333;">Appointment Reminder</h2>
      <p>Hi ${appt.guestName},</p>
      <p>This is a friendly reminder that your appointment is <strong>${urgency}</strong>.</p>
      <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:4px 0;"><strong>Calendar:</strong> ${calName}</p>
        <p style="margin:4px 0;"><strong>Date:</strong> ${dateStr}</p>
        <p style="margin:4px 0;"><strong>Time:</strong> ${timeStr} – ${endTimeStr}</p>
      </div>
      <p>If you need to make changes, please contact us directly.</p>
      <p style="color:#888;font-size:12px;margin-top:24px;">Powered by Apex System</p>
    </div>`,
    accountId: appt.accountId,
  }).catch((err) =>
    console.error(`[AppointmentReminders] Email failed for appt ${appt.id}:`, err)
  );

  // SMS reminder to guest (if phone available)
  if (appt.guestPhone) {
    await dispatchSMS({
      to: appt.guestPhone,
      body: `Reminder: Your appointment "${calName}" is ${urgency} at ${timeStr}. ${dateStr}.`,
      accountId: appt.accountId,
    }).catch((err) =>
      console.error(`[AppointmentReminders] SMS failed for appt ${appt.id}:`, err)
    );
  }
}
