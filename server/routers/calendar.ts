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
} from "../db";
import { dispatchEmail, dispatchSMS } from "../services/messaging";
import { generateICSBase64 } from "../utils/icsGenerator";

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

      const updateData: Record<string, unknown> = {};
      if (input.status !== undefined) updateData.status = input.status;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.contactId !== undefined) updateData.contactId = input.contactId;
      if (input.startTime !== undefined) updateData.startTime = input.startTime;
      if (input.endTime !== undefined) updateData.endTime = input.endTime;

      await updateAppointment(input.id, input.accountId, updateData as any);

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

      await createAuditLog({
        accountId: input.accountId,
        userId: ctx.user.id,
        action: "appointment.cancelled",
        resourceType: "appointment",
        resourceId: input.id,
      });

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
      return slots.filter((slot) => {
        const slotTime = new Date(`${input.date}T${slot.start}:00Z`);
        return slotTime.getTime() > now.getTime() + minNoticeMs;
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

      // Verify the slot is still available
      const slots = await getAvailableSlots(calendar.id, input.date);
      const selectedSlot = slots.find((s) => s.start === input.startTime);
      if (!selectedSlot) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This time slot is no longer available. Please choose another time.",
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
        uid: `appointment-${result.id}@apexsystem`,
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
          <p style="color:#888;font-size:12px;margin-top:24px;">Powered by Apex System</p>
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
            <p style="color:#888;font-size:12px;margin-top:24px;">Powered by Apex System</p>
          </div>`,
          accountId: calendar.accountId,
          attachments: [icsAttachment],
        }).catch((err) => console.error("[Calendar] Owner notification email failed:", err));
      }

      return {
        id: result.id,
        calendarName: calendar.name,
        startTime: startTimeDate.toISOString(),
        endTime: endTimeDate.toISOString(),
      };
    }),
});
