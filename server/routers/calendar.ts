import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import {
  getCalendars,
  getCalendar,
  getCalendarBySlug,
  createCalendar,
  updateCalendar,
  deleteCalendar,
  getAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  cancelAppointment,
  getAvailableSlots,
  getAppointmentsByContact,
  getMember,
  createAuditLog,
  getAccountById,
  getActiveCalendarIntegrations,
  getCalendarIntegrations,
  decryptCalendarTokens,
  updateCalendarIntegration,
  logContactActivity,
  createNotification,
  getExternalCalendarEventsByAccount,
} from "../db";
import { dispatchEmail, dispatchSMS } from "../services/messaging";
import { generateICSBase64 } from "../utils/icsGenerator";
import { getGoogleBusyTimes, refreshGoogleToken, createGoogleEvent } from "../services/googleCalendar";
import { getOutlookBusyTimes, refreshOutlookToken, createOutlookEvent } from "../services/outlookCalendar";

// ─── External calendar busy time helper ───
async function getExternalBusyTimes(
  accountId: number,
  timeMin: string,
  timeMax: string
): Promise<{ start: string; end: string }[]> {
  const integrations = await getActiveCalendarIntegrations(accountId);
  const busyBlocks: { start: string; end: string }[] = [];

  for (const integration of integrations) {
    try {
      const tokens = decryptCalendarTokens(integration);

      // Get a valid access token, refreshing if needed
      let accessToken = tokens.accessToken;
      if (integration.tokenExpiresAt) {
        const expiresAt = new Date(integration.tokenExpiresAt).getTime();
        if (expiresAt <= Date.now() + 5 * 60 * 1000 && tokens.refreshToken) {
          try {
            if (integration.provider === "google") {
              const result = await refreshGoogleToken(tokens.refreshToken);
              accessToken = result.accessToken;
              await updateCalendarIntegration(integration.id, integration.userId, {
                accessToken: result.accessToken,
                tokenExpiresAt: new Date(Date.now() + result.expiresIn * 1000),
              });
            } else {
              const result = await refreshOutlookToken(tokens.refreshToken);
              accessToken = result.accessToken;
              const updateData: Record<string, unknown> = {
                accessToken: result.accessToken,
                tokenExpiresAt: new Date(Date.now() + result.expiresIn * 1000),
              };
              if (result.refreshToken) {
                (updateData as any).refreshToken = result.refreshToken;
              }
              await updateCalendarIntegration(integration.id, integration.userId, updateData as any);
            }
          } catch (refreshErr: any) {
            console.error(`[Calendar] Token refresh failed for ${integration.provider}:`, refreshErr.message);
            continue;
          }
        }
      }

      if (integration.provider === "google") {
        const busy = await getGoogleBusyTimes(
          accessToken,
          integration.externalCalendarId,
          timeMin,
          timeMax
        );
        busyBlocks.push(...busy);
      } else if (integration.provider === "outlook") {
        const busy = await getOutlookBusyTimes(
          accessToken,
          integration.externalEmail || "",
          timeMin,
          timeMax
        );
        busyBlocks.push(...busy);
      }
    } catch (err: any) {
      console.error(`[Calendar] Failed to fetch busy times from ${integration.provider}:`, err.message);
      // Don't fail the whole request if one integration fails
    }
  }

  return busyBlocks;
}

// ─── Sync appointment to external calendars helper ───
async function syncAppointmentToExternalCalendars(params: {
  accountId: number;
  summary: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  guestEmail?: string;
  guestName?: string;
}): Promise<void> {
  // Get all active integrations for this account (across all users)
  const integrations = await getActiveCalendarIntegrations(params.accountId);

  for (const integration of integrations) {
    try {
      const tokens = decryptCalendarTokens(integration);

      // Get a valid access token, refreshing if needed
      let accessToken = tokens.accessToken;
      if (integration.tokenExpiresAt) {
        const expiresAt = new Date(integration.tokenExpiresAt).getTime();
        if (expiresAt <= Date.now() + 5 * 60 * 1000 && tokens.refreshToken) {
          if (integration.provider === "google") {
            const result = await refreshGoogleToken(tokens.refreshToken);
            accessToken = result.accessToken;
            await updateCalendarIntegration(integration.id, integration.userId, {
              accessToken: result.accessToken,
              tokenExpiresAt: new Date(Date.now() + result.expiresIn * 1000),
            });
          } else {
            const result = await refreshOutlookToken(tokens.refreshToken);
            accessToken = result.accessToken;
            await updateCalendarIntegration(integration.id, integration.userId, {
              accessToken: result.accessToken,
              tokenExpiresAt: new Date(Date.now() + result.expiresIn * 1000),
              ...(result.refreshToken ? { refreshToken: result.refreshToken } : {}),
            } as any);
          }
        }
      }

      if (integration.provider === "google") {
        await createGoogleEvent(accessToken, integration.externalCalendarId, {
          summary: params.summary,
          description: params.description,
          start: { dateTime: params.startDateTime, timeZone: "UTC" },
          end: { dateTime: params.endDateTime, timeZone: "UTC" },
          attendees: params.guestEmail ? [{ email: params.guestEmail }] : undefined,
        });
        console.log(`[Calendar] Synced appointment to Google Calendar for account ${params.accountId}`);
      } else if (integration.provider === "outlook") {
        await createOutlookEvent(accessToken, {
          subject: params.summary,
          body: params.description
            ? { contentType: "Text", content: params.description }
            : undefined,
          start: { dateTime: params.startDateTime, timeZone: "UTC" },
          end: { dateTime: params.endDateTime, timeZone: "UTC" },
          attendees: params.guestEmail
            ? [
                {
                  emailAddress: {
                    address: params.guestEmail,
                    name: params.guestName,
                  },
                  type: "required",
                },
              ]
            : undefined,
        });
        console.log(`[Calendar] Synced appointment to Outlook Calendar for account ${params.accountId}`);
      }
    } catch (err: any) {
      console.error(`[Calendar] Failed to sync to ${integration.provider}:`, err.message);
      // Don't fail the whole booking if external sync fails
    }
  }
}

// ─── Cached external calendar events as busy blocks ───
async function getCachedExternalBusyBlocks(
  accountId: number,
  dateStr: string,
  bufferMinutes: number
): Promise<{ start: number; end: number }[]> {
  const dayStart = new Date(`${dateStr}T00:00:00Z`);
  const dayEnd = new Date(`${dateStr}T23:59:59Z`);
  const events = await getExternalCalendarEventsByAccount(accountId, dayStart, dayEnd);

  return events.map((evt) => {
    let evtStart: number;
    let evtEnd: number;

    if (evt.allDay) {
      // All-day events block the entire day
      evtStart = dayStart.getTime();
      evtEnd = dayEnd.getTime() + 1000; // include full day
    } else {
      evtStart = new Date(evt.startTime).getTime();
      evtEnd = new Date(evt.endTime).getTime();
    }

    // Apply buffer around external events
    return {
      start: evtStart - bufferMinutes * 60 * 1000,
      end: evtEnd + bufferMinutes * 60 * 1000,
    };
  });
}

// ─── Unified conflict checker ───
function hasTimeConflict(
  slotStartMs: number,
  slotEndMs: number,
  busyBlocks: { start: number; end: number }[]
): boolean {
  return busyBlocks.some((busy) => slotStartMs < busy.end && slotEndMs > busy.start);
}

// ─── Tenant guard ───
async function requireAccountMember(userId: number, accountId: number, userRole?: string) {
  if (userRole === "admin") {
    const member = await getMember(accountId, userId);
    if (member) return member;
    return { userId, accountId, role: "owner" as const, isActive: true };
  }
  const member = await getMember(accountId, userId);
  if (!member || !member.isActive) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this account",
    });
  }
  return member;
}

// ─── Default weekly availability ───
const DEFAULT_AVAILABILITY = {
  monday: [{ start: "09:00", end: "17:00" }],
  tuesday: [{ start: "09:00", end: "17:00" }],
  wednesday: [{ start: "09:00", end: "17:00" }],
  thursday: [{ start: "09:00", end: "17:00" }],
  friday: [{ start: "09:00", end: "17:00" }],
  saturday: [],
  sunday: [],
};

// ─── Zod schemas ───
const availabilityBlockSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
});

const availabilitySchema = z.object({
  monday: z.array(availabilityBlockSchema),
  tuesday: z.array(availabilityBlockSchema),
  wednesday: z.array(availabilityBlockSchema),
  thursday: z.array(availabilityBlockSchema),
  friday: z.array(availabilityBlockSchema),
  saturday: z.array(availabilityBlockSchema),
  sunday: z.array(availabilityBlockSchema),
});

export const calendarRouter = router({
  // ═══════════════════════════════════════════
  // PROTECTED PROCEDURES (require auth)
  // ═══════════════════════════════════════════

  /** List all calendars for the current account */
  list: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      return getCalendars(input.accountId);
    }),

  /** Get a single calendar by ID */
  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), accountId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const calendar = await getCalendar(input.id, input.accountId);
      if (!calendar) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Calendar not found" });
      }
      return calendar;
    }),

  /** Create a new calendar */
  create: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        name: z.string().min(1).max(255),
        slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
        description: z.string().max(1000).optional(),
        timezone: z.string().max(100).optional(),
        bufferMinutes: z.number().int().min(0).max(120).optional(),
        minNoticeHours: z.number().int().min(0).max(168).optional(),
        maxDaysAhead: z.number().int().min(1).max(365).optional(),
        slotDurationMinutes: z.number().int().min(5).max(480).optional(),
        availability: availabilitySchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      if (member.role === "employee") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Employees cannot create calendars" });
      }

      // Check slug uniqueness
      const existing = await getCalendarBySlug(input.slug);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "A calendar with this slug already exists" });
      }

      const result = await createCalendar({
        accountId: input.accountId,
        name: input.name,
        slug: input.slug,
        description: input.description || null,
        timezone: input.timezone || "America/New_York",
        bufferMinutes: input.bufferMinutes ?? 15,
        minNoticeHours: input.minNoticeHours ?? 24,
        maxDaysAhead: input.maxDaysAhead ?? 30,
        slotDurationMinutes: input.slotDurationMinutes ?? 30,
        availabilityJson: JSON.stringify(input.availability || DEFAULT_AVAILABILITY),
      });

      await createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: "calendar.created",
        resourceType: "calendar",
        resourceId: result.id,
      });

      return result;
    }),

  /** Update an existing calendar */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
        name: z.string().min(1).max(255).optional(),
        slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
        description: z.string().max(1000).optional().nullable(),
        timezone: z.string().max(100).optional(),
        bufferMinutes: z.number().int().min(0).max(120).optional(),
        minNoticeHours: z.number().int().min(0).max(168).optional(),
        maxDaysAhead: z.number().int().min(1).max(365).optional(),
        slotDurationMinutes: z.number().int().min(5).max(480).optional(),
        availability: availabilitySchema.optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      if (member.role === "employee") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Employees cannot update calendars" });
      }

      const calendar = await getCalendar(input.id, input.accountId);
      if (!calendar) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Calendar not found" });
      }

      // Check slug uniqueness if changing
      if (input.slug && input.slug !== calendar.slug) {
        const existing = await getCalendarBySlug(input.slug);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "A calendar with this slug already exists" });
        }
      }

      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.slug !== undefined) updateData.slug = input.slug;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.timezone !== undefined) updateData.timezone = input.timezone;
      if (input.bufferMinutes !== undefined) updateData.bufferMinutes = input.bufferMinutes;
      if (input.minNoticeHours !== undefined) updateData.minNoticeHours = input.minNoticeHours;
      if (input.maxDaysAhead !== undefined) updateData.maxDaysAhead = input.maxDaysAhead;
      if (input.slotDurationMinutes !== undefined) updateData.slotDurationMinutes = input.slotDurationMinutes;
      if (input.availability !== undefined) updateData.availabilityJson = JSON.stringify(input.availability);
      if (input.isActive !== undefined) updateData.isActive = input.isActive;

      await updateCalendar(input.id, input.accountId, updateData as any);

      await createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: "calendar.updated",
        resourceType: "calendar",
        resourceId: input.id,
      });

      return { success: true };
    }),

  /** Delete a calendar */
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), accountId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const member = await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      if (member.role === "employee") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Employees cannot delete calendars" });
      }

      const calendar = await getCalendar(input.id, input.accountId);
      if (!calendar) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Calendar not found" });
      }

      await deleteCalendar(input.id, input.accountId);

      await createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: "calendar.deleted",
        resourceType: "calendar",
        resourceId: input.id,
      });

      return { success: true };
    }),

  /** List appointments for an account */
  listAppointments: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        calendarId: z.number().int().positive().optional(),
        status: z.enum(["pending", "confirmed", "cancelled"]).optional(),
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      return getAppointments(input.accountId, {
        calendarId: input.calendarId,
        status: input.status,
        limit: input.limit,
        offset: input.offset,
        startDate: input.startDate,
        endDate: input.endDate,
      });
    }),

  /** Get appointments by contact */
  appointmentsByContact: protectedProcedure
    .input(z.object({ contactId: z.number().int().positive(), accountId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      return getAppointmentsByContact(input.contactId, input.accountId);
    }),

  /** Update an appointment (confirm, reschedule, add notes) */
  updateAppointment: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
        status: z.enum(["pending", "confirmed", "cancelled"]).optional(),
        notes: z.string().max(2000).optional().nullable(),
        contactId: z.number().int().positive().optional().nullable(),
        startTime: z.date().optional(),
        endTime: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      const appt = await getAppointment(input.id, input.accountId);
      if (!appt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Appointment not found" });
      }

      // If rescheduling (changing start/end time), check for conflicts
      if (input.startTime && input.endTime) {
        const calendar = await getCalendar(appt.calendarId, input.accountId);
        const bufferMinutes = calendar?.bufferMinutes || 0;
        const dateStr = input.startTime.toISOString().split("T")[0];

        // Check CRM appointments (exclude the current appointment being rescheduled)
        const crmSlots = await getAvailableSlots(appt.calendarId, dateStr);
        const slotStartStr = `${String(input.startTime.getUTCHours()).padStart(2, "0")}:${String(input.startTime.getUTCMinutes()).padStart(2, "0")}`;
        const matchesAvailableSlot = crmSlots.some((s) => s.start === slotStartStr);
        // The slot might show as taken because the current appointment occupies it — that's OK
        // We need to check if the NEW time conflicts with OTHER appointments
        if (!matchesAvailableSlot) {
          // Check if the only conflict is with the appointment being rescheduled itself
          const existingAppts = await getAppointments(input.accountId, {
            calendarId: appt.calendarId,
            startDate: new Date(`${dateStr}T00:00:00Z`),
            endDate: new Date(`${dateStr}T23:59:59Z`),
          });
          const otherAppts = existingAppts.filter(
            (a) => a.id !== input.id && a.status !== "cancelled"
          );
          const newStart = input.startTime.getTime();
          const newEnd = input.endTime.getTime();
          const crmConflict = otherAppts.some((a) => {
            const aStart = new Date(a.startTime).getTime() - bufferMinutes * 60 * 1000;
            const aEnd = new Date(a.endTime).getTime() + bufferMinutes * 60 * 1000;
            return newStart < aEnd && newEnd > aStart;
          });
          if (crmConflict) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "This time slot is already booked. Please choose a different time.",
            });
          }
        }

        // Check external calendar events
        const [liveBusy, cachedBusy] = await Promise.all([
          getExternalBusyTimes(input.accountId, `${dateStr}T00:00:00Z`, `${dateStr}T23:59:59Z`),
          getCachedExternalBusyBlocks(input.accountId, dateStr, bufferMinutes),
        ]);
        const allBusy: { start: number; end: number }[] = [
          ...liveBusy.map((b) => ({
            start: new Date(b.start).getTime() - bufferMinutes * 60 * 1000,
            end: new Date(b.end).getTime() + bufferMinutes * 60 * 1000,
          })),
          ...cachedBusy,
        ];
        if (hasTimeConflict(input.startTime.getTime(), input.endTime.getTime(), allBusy)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This time slot is already booked. Please choose a different time.",
          });
        }
      }

      const updateData: Record<string, unknown> = {};
      if (input.status !== undefined) updateData.status = input.status;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.contactId !== undefined) updateData.contactId = input.contactId;
      if (input.startTime !== undefined) updateData.startTime = input.startTime;
      if (input.endTime !== undefined) updateData.endTime = input.endTime;

      await updateAppointment(input.id, input.accountId, updateData as any);

      // Log activity if status changed and appointment has a contactId
      if (input.status && input.status !== appt.status && appt.contactId) {
        const actType = input.status === "confirmed" ? "appointment_confirmed" as const : input.status === "cancelled" ? "appointment_cancelled" as const : null;
        if (actType) {
          logContactActivity({
            contactId: appt.contactId,
            accountId: input.accountId,
            activityType: actType,
            description: `Appointment ${input.status} for ${appt.guestName} on ${new Date(appt.startTime).toLocaleDateString()}`,
            metadata: JSON.stringify({ appointmentId: input.id, status: input.status }),
          });
        }
      }

      await createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: "appointment.updated",
        resourceType: "appointment",
        resourceId: input.id,
      });

      return { success: true };
    }),

  /** Cancel an appointment */
  cancelAppointment: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), accountId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      const appt = await getAppointment(input.id, input.accountId);
      if (!appt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Appointment not found" });
      }

      await cancelAppointment(input.id, input.accountId);

      // Log activity if appointment has a contactId
      if (appt.contactId) {
        logContactActivity({
          contactId: appt.contactId,
          accountId: input.accountId,
          activityType: "appointment_cancelled",
          description: `Appointment cancelled for ${appt.guestName} on ${new Date(appt.startTime).toLocaleDateString()}`,
          metadata: JSON.stringify({ appointmentId: input.id }),
        });
      }

      await createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: "appointment.cancelled",
        resourceType: "appointment",
        resourceId: input.id,
      });

      // Create in-app notification
      createNotification({
        accountId: input.accountId,
        userId: null,
        type: "appointment_cancelled",
        title: `Appointment cancelled`,
        body: `Appointment for ${appt.guestName} on ${new Date(appt.startTime).toLocaleDateString()} was cancelled`,
        link: `/calendar`,
      }).catch((err) => console.error("[Calendar] Cancel notification error:", err));

      // Fire appointment_cancelled automation trigger (non-blocking)
      if (appt.contactId) {
        import("../services/workflowTriggers")
          .then(({ onAppointmentCancelled }) =>
            onAppointmentCancelled(input.accountId, appt.contactId!, input.id)
          )
          .catch((err) =>
            console.error("[Calendar] appointment_cancelled trigger error:", err)
          );
      }

      return { success: true };
    }),

  // ═══════════════════════════════════════════
  // PUBLIC PROCEDURES (no auth required)
  // ═══════════════════════════════════════════

  /** Get a public calendar by slug (for booking page) */
  getPublicCalendar: publicProcedure
    .input(z.object({ slug: z.string().min(1).max(100) }))
    .query(async ({ input }) => {
      const calendar = await getCalendarBySlug(input.slug);
      if (!calendar) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Calendar not found" });
      }
      // Return only public-safe fields
      return {
        id: calendar.id,
        name: calendar.name,
        slug: calendar.slug,
        description: calendar.description,
        timezone: calendar.timezone,
        slotDurationMinutes: calendar.slotDurationMinutes,
        minNoticeHours: calendar.minNoticeHours,
        maxDaysAhead: calendar.maxDaysAhead,
        availabilityJson: calendar.availabilityJson,
      };
    }),

  /** Get available slots for a public calendar */
  getPublicSlots: publicProcedure
    .input(
      z.object({
        slug: z.string().min(1).max(100),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
      })
    )
    .query(async ({ input }) => {
      const calendar = await getCalendarBySlug(input.slug);
      if (!calendar) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Calendar not found" });
      }

      // Enforce minNoticeHours
      const now = new Date();
      const requestedDate = new Date(input.date + "T00:00:00Z");
      const minNoticeMs = calendar.minNoticeHours * 60 * 60 * 1000;
      if (requestedDate.getTime() < now.getTime() - 24 * 60 * 60 * 1000) {
        return []; // Past date
      }

      // Enforce maxDaysAhead
      const maxDate = new Date(now.getTime() + calendar.maxDaysAhead * 24 * 60 * 60 * 1000);
      if (requestedDate.getTime() > maxDate.getTime()) {
        return []; // Too far ahead
      }

      const slots = await getAvailableSlots(calendar.id, input.date);

      // Filter out slots that don't meet minNoticeHours
      const filteredSlots = slots.filter((slot) => {
        const slotTime = new Date(`${input.date}T${slot.start}:00Z`);
        return slotTime.getTime() > now.getTime() + minNoticeMs;
      });

      // Also filter out slots that conflict with external calendar busy times (live API)
      const busyBlocks = await getExternalBusyTimes(
        calendar.accountId,
        `${input.date}T00:00:00Z`,
        `${input.date}T23:59:59Z`
      );

      // Also check cached external calendar events (from push notifications)
      const cachedBusyBlocks = await getCachedExternalBusyBlocks(
        calendar.accountId,
        input.date,
        calendar.bufferMinutes
      );

      // Merge all busy blocks into a unified list
      const allBusyBlocks: { start: number; end: number }[] = [
        ...busyBlocks.map((b) => ({
          start: new Date(b.start).getTime() - calendar.bufferMinutes * 60 * 1000,
          end: new Date(b.end).getTime() + calendar.bufferMinutes * 60 * 1000,
        })),
        ...cachedBusyBlocks,
      ];

      if (allBusyBlocks.length === 0) return filteredSlots;

      return filteredSlots.filter((slot) => {
        const slotStart = new Date(`${input.date}T${slot.start}:00Z`).getTime();
        const slotEnd = new Date(`${input.date}T${slot.end}:00Z`).getTime();
        return !hasTimeConflict(slotStart, slotEnd, allBusyBlocks);
      });
    }),

  /** Book an appointment (public, no auth) */
  bookAppointment: publicProcedure
    .input(
      z.object({
        slug: z.string().min(1).max(100),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        guestName: z.string().min(1).max(255),
        guestEmail: z.string().email().max(320),
        guestPhone: z.string().max(30).optional(),
        notes: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const calendar = await getCalendarBySlug(input.slug);
      if (!calendar) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Calendar not found" });
      }

      // Verify the slot is still available (checks CRM appointments)
      const slots = await getAvailableSlots(calendar.id, input.date);
      const selectedSlot = slots.find((s) => s.start === input.startTime);
      if (!selectedSlot) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This time slot is already booked. Please choose a different time.",
        });
      }

      // Enforce minNoticeHours
      const now = new Date();
      const slotTime = new Date(`${input.date}T${input.startTime}:00Z`);
      const minNoticeMs = calendar.minNoticeHours * 60 * 60 * 1000;
      if (slotTime.getTime() < now.getTime() + minNoticeMs) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Appointments must be booked at least ${calendar.minNoticeHours} hours in advance.`,
        });
      }

      const startTimeDate = new Date(`${input.date}T${selectedSlot.start}:00Z`);
      const endTimeDate = new Date(`${input.date}T${selectedSlot.end}:00Z`);

      // Double-check against external calendar events (live API + cached push events)
      const [liveBusyBlocks, cachedBusyBlocks] = await Promise.all([
        getExternalBusyTimes(
          calendar.accountId,
          `${input.date}T00:00:00Z`,
          `${input.date}T23:59:59Z`
        ),
        getCachedExternalBusyBlocks(
          calendar.accountId,
          input.date,
          calendar.bufferMinutes
        ),
      ]);

      const allBusyBlocks: { start: number; end: number }[] = [
        ...liveBusyBlocks.map((b) => ({
          start: new Date(b.start).getTime() - calendar.bufferMinutes * 60 * 1000,
          end: new Date(b.end).getTime() + calendar.bufferMinutes * 60 * 1000,
        })),
        ...cachedBusyBlocks,
      ];

      if (hasTimeConflict(startTimeDate.getTime(), endTimeDate.getTime(), allBusyBlocks)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This time slot is already booked. Please choose a different time.",
        });
      }

      const result = await createAppointment({
        calendarId: calendar.id,
        accountId: calendar.accountId,
        guestName: input.guestName,
        guestEmail: input.guestEmail,
        guestPhone: input.guestPhone || null,
        startTime: startTimeDate,
        endTime: endTimeDate,
        status: "pending",
        notes: input.notes || null,
      });

      // Generate ICS calendar file for email attachments
      const icsBase64 = generateICSBase64({
        uid: `appointment-${result.id}@sterlingmarketing`,
        summary: `Appointment: ${calendar.name}`,
        description: `Appointment with ${input.guestName}${input.notes ? `. Notes: ${input.notes}` : ""}`,
        startTime: startTimeDate,
        endTime: endTimeDate,
        organizerEmail: undefined, // will be set per-email below
        attendeeName: input.guestName,
        attendeeEmail: input.guestEmail,
      });

      const icsAttachment = {
        content: icsBase64,
        filename: "appointment.ics",
        type: "text/calendar",
        disposition: "attachment",
      };

      // Send confirmation emails (fire-and-forget)
      const dateStr = startTimeDate.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const timeStr = startTimeDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const endTimeStr = endTimeDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });

      // Email to guest (with .ics attachment)
      dispatchEmail({
        to: input.guestEmail,
        subject: `Booking Confirmed: ${calendar.name} on ${dateStr}`,
        body: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#333;">Your Appointment is Confirmed!</h2>
          <p>Hi ${input.guestName},</p>
          <p>Your appointment has been scheduled:</p>
          <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="margin:4px 0;"><strong>Calendar:</strong> ${calendar.name}</p>
            <p style="margin:4px 0;"><strong>Date:</strong> ${dateStr}</p>
            <p style="margin:4px 0;"><strong>Time:</strong> ${timeStr} – ${endTimeStr}</p>
          </div>
          <p>A calendar invite (.ics file) is attached — open it to add this appointment to your calendar.</p>
          <p>If you need to make changes, please contact us directly.</p>
          <p style="color:#888;font-size:12px;margin-top:24px;">Powered by Sterling Marketing</p>
        </div>`,
        accountId: calendar.accountId,
        attachments: [icsAttachment],
      }).catch((err) => console.error("[Calendar] Guest confirmation email failed:", err));

      // Email to account owner (with .ics attachment)
      const account = await getAccountById(calendar.accountId);
      if (account?.email) {
        dispatchEmail({
          to: account.email,
          subject: `New Booking: ${input.guestName} — ${calendar.name}`,
          body: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#333;">New Appointment Booked</h2>
            <p>A new appointment has been booked on your calendar:</p>
            <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:16px 0;">
              <p style="margin:4px 0;"><strong>Guest:</strong> ${input.guestName}</p>
              <p style="margin:4px 0;"><strong>Email:</strong> ${input.guestEmail}</p>
              ${input.guestPhone ? `<p style="margin:4px 0;"><strong>Phone:</strong> ${input.guestPhone}</p>` : ""}
              <p style="margin:4px 0;"><strong>Calendar:</strong> ${calendar.name}</p>
              <p style="margin:4px 0;"><strong>Date:</strong> ${dateStr}</p>
              <p style="margin:4px 0;"><strong>Time:</strong> ${timeStr} – ${endTimeStr}</p>
              ${input.notes ? `<p style="margin:4px 0;"><strong>Notes:</strong> ${input.notes}</p>` : ""}
            </div>
            <p>A calendar invite (.ics file) is attached — open it to add this appointment to your calendar.</p>
            <p style="color:#888;font-size:12px;margin-top:24px;">Powered by Sterling Marketing</p>
          </div>`,
          accountId: calendar.accountId,
          attachments: [icsAttachment],
        }).catch((err) => console.error("[Calendar] Owner notification email failed:", err));
      }

      // Sync to external calendars (fire-and-forget)
      syncAppointmentToExternalCalendars({
        accountId: calendar.accountId,
        summary: `Appointment: ${calendar.name}`,
        description: `Appointment with ${input.guestName}${input.notes ? `. Notes: ${input.notes}` : ""}`,
        startDateTime: startTimeDate.toISOString(),
        endDateTime: endTimeDate.toISOString(),
        guestEmail: input.guestEmail,
        guestName: input.guestName,
      }).catch((err) => console.error("[Calendar] External calendar sync failed:", err));

      // Log activity (appointment booked is public, contactId may not exist yet)
      // We log with contactId=0 as a placeholder; the appointment is linked via guestEmail
      logContactActivity({
        contactId: 0, // public booking — no contact linked yet
        accountId: calendar.accountId,
        activityType: "appointment_booked",
        description: `Appointment booked by ${input.guestName} (${input.guestEmail}) on ${calendar.name} for ${dateStr} at ${timeStr}`,
        metadata: JSON.stringify({ appointmentId: result.id, calendarName: calendar.name, guestName: input.guestName, guestEmail: input.guestEmail }),
      });

      // Create in-app notification
      createNotification({
        accountId: calendar.accountId,
        userId: null,
        type: "appointment_booked",
        title: `New appointment booked`,
        body: `${input.guestName} booked on ${calendar.name} for ${dateStr} at ${timeStr}`,
        link: `/calendar`,
      }).catch((err) => console.error("[Calendar] Booking notification error:", err));

      // Fire appointment_booked automation trigger (non-blocking)
      // Try to find a matching contact by email for the trigger
      import("../db").then(async ({ findContactByEmail }) => {
        const contact = await findContactByEmail(input.guestEmail, calendar.accountId);
        if (contact) {
          const { onAppointmentBooked } = await import("../services/workflowTriggers");
          await onAppointmentBooked(calendar.accountId, contact.id, result.id, calendar.id);

          // Auto-stop nurture sequences when appointment is booked
          const { onAppointmentBookedAutoStop } = await import("../services/sequenceAutoStop");
          await onAppointmentBookedAutoStop(calendar.accountId, contact.id, result.id);
        }
      }).catch((err) => console.error("[Calendar] appointment_booked trigger error:", err));

      return {
        id: result.id,
        calendarName: calendar.name,
        startTime: startTimeDate.toISOString(),
        endTime: endTimeDate.toISOString(),
      };
    }),
});
