import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  createDialerSession,
  getDialerSessionById,
  listDialerSessions,
  updateDialerSession,
  deleteDialerSession,
  createDialerScript,
  getDialerScriptById,
  listDialerScripts,
  updateDialerScript,
  deleteDialerScript,
  getContactById,
  createAICall,
  updateAICall,
  logContactActivity,
  createContactNote,
  getMember,
  listContacts,
  getDialerAnalytics,
} from "../db";
import {
  createVapiCall,
  resolveAssistantId,
  mapVapiStatus,
  VapiApiError,
} from "../services/vapi";
import { isWithinBusinessHours, getBusinessHoursBlockMessage } from "../utils/businessHours";

// ─────────────────────────────────────────────
// Access control helper
// ─────────────────────────────────────────────
async function requireAccountAccess(userId: number, accountId: number, userRole: string) {
  if (userRole === "admin") return;
  const member = await getMember(accountId, userId);
  if (!member) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this account.",
    });
  }
}

// Disposition values
const dispositionEnum = z.enum([
  "answered",
  "no_answer",
  "left_voicemail",
  "not_interested",
  "callback_requested",
  "skipped",
  "failed",
]);

// ─────────────────────────────────────────────
// Power Dialer Router
// ─────────────────────────────────────────────
export const powerDialerRouter = router({
  // ─── SESSION MANAGEMENT ───

  /** Create a new dialer session from a list of contact IDs */
  createSession: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        contactIds: z.array(z.number()).min(1).max(1000),
        scriptId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);

      const { id } = await createDialerSession({
        accountId: input.accountId,
        userId: ctx.user.id,
        contactIds: JSON.stringify(input.contactIds),
        status: "active",
        currentIndex: 0,
        totalContacts: input.contactIds.length,
        scriptId: input.scriptId ?? null,
        results: JSON.stringify([]),
      });

      return { id, totalContacts: input.contactIds.length };
    }),

  /** Get a dialer session by ID */
  getSession: protectedProcedure
    .input(z.object({ id: z.number(), accountId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);

      const session = await getDialerSessionById(input.id);
      if (!session || session.accountId !== input.accountId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found." });
      }

      // Parse JSON fields
      const contactIds: number[] = JSON.parse(session.contactIds);
      const results: Array<{
        contactId: number;
        disposition: string;
        notes: string;
        callId?: number;
        calledAt?: string;
      }> = session.results ? JSON.parse(session.results) : [];

      return {
        ...session,
        contactIds,
        results,
      };
    }),

  /** List dialer sessions for an account */
  listSessions: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        status: z.enum(["active", "paused", "completed"]).optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      return listDialerSessions({
        ...input,
        userId: ctx.user.id,
      });
    }),

  /** Get the current contact details for the active session */
  getCurrentContact: protectedProcedure
    .input(z.object({ sessionId: z.number(), accountId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);

      const session = await getDialerSessionById(input.sessionId);
      if (!session || session.accountId !== input.accountId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found." });
      }

      const contactIds: number[] = JSON.parse(session.contactIds);
      if (session.currentIndex >= contactIds.length) {
        return null; // Session complete
      }

      const contactId = contactIds[session.currentIndex];
      const contact = await getContactById(contactId, input.accountId);

      return {
        contact,
        currentIndex: session.currentIndex,
        totalContacts: session.totalContacts,
      };
    }),

  /** Initiate a call to the current contact in the session */
  initiateCall: protectedProcedure
    .input(
      z.object({
        sessionId: z.number(),
        accountId: z.number(),
        contactId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);

      // ── Business hours enforcement ──
      if (!isWithinBusinessHours()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: getBusinessHoursBlockMessage(),
        });
      }

      const contact = await getContactById(input.contactId, input.accountId);
      if (!contact) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found." });
      }
      if (!contact.phone) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Contact has no phone number." });
      }

      const assistantId = resolveAssistantId(contact.leadSource);
      const contactName = `${contact.firstName} ${contact.lastName}`.trim();

      // Create AI call record
      const { id: callId } = await createAICall({
        contactId: input.contactId,
        initiatedById: ctx.user.id,
        phoneNumber: contact.phone,
        status: "queued",
        direction: "outbound",
        assistantId,
        accountId: input.accountId,
      });

      try {
        const vapiResponse = await createVapiCall({
          phoneNumber: contact.phone,
          customerName: contactName,
          assistantId,
          metadata: {
            apexAccountId: input.accountId,
            apexContactId: input.contactId,
            apexCallId: callId,
            leadSource: contact.leadSource ?? undefined,
          },
        });

        const mappedStatus = mapVapiStatus(vapiResponse.status);
        await updateAICall(callId, {
          status: mappedStatus,
          externalCallId: vapiResponse.id,
          startedAt: new Date(),
          metadata: JSON.stringify(vapiResponse),
        });

        logContactActivity({
          contactId: input.contactId,
          accountId: input.accountId,
          activityType: "ai_call_made",
          description: `Power Dialer call initiated to ${contact.phone} (${contactName})`,
          metadata: JSON.stringify({
            callId,
            externalCallId: vapiResponse.id,
            sessionId: input.sessionId,
            status: mappedStatus,
          }),
        });

        return {
          callId,
          success: true,
          externalCallId: vapiResponse.id,
          vapiStatus: vapiResponse.status,
        };
      } catch (err) {
        const errorMsg =
          err instanceof VapiApiError
            ? `VAPI error (${err.statusCode}): ${err.responseBody}`
            : err instanceof Error
              ? err.message
              : "Unknown error initiating call";

        await updateAICall(callId, {
          status: "failed",
          errorMessage: errorMsg,
        });

        return { callId, success: false, externalCallId: null, error: errorMsg };
      }
    }),

  /** Record disposition and advance to next contact */
  recordDisposition: protectedProcedure
    .input(
      z.object({
        sessionId: z.number(),
        accountId: z.number(),
        contactId: z.number(),
        disposition: dispositionEnum,
        notes: z.string().optional(),
        callId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);

      const session = await getDialerSessionById(input.sessionId);
      if (!session || session.accountId !== input.accountId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found." });
      }

      // Add result to session
      const results: Array<any> = session.results ? JSON.parse(session.results) : [];
      results.push({
        contactId: input.contactId,
        disposition: input.disposition,
        notes: input.notes || "",
        callId: input.callId,
        calledAt: new Date().toISOString(),
      });

      const contactIds: number[] = JSON.parse(session.contactIds);
      const nextIndex = session.currentIndex + 1;
      const isComplete = nextIndex >= contactIds.length;

      // Update session
      await updateDialerSession(session.id, {
        currentIndex: nextIndex,
        results: JSON.stringify(results),
        ...(isComplete
          ? { status: "completed" as const, completedAt: new Date() }
          : {}),
      });

      // Log activity on the contact
      logContactActivity({
        contactId: input.contactId,
        accountId: input.accountId,
        activityType: "note_added",
        description: `Power Dialer: ${input.disposition}${input.notes ? ` — ${input.notes}` : ""}`,
        metadata: JSON.stringify({
          sessionId: input.sessionId,
          disposition: input.disposition,
          callId: input.callId,
        }),
      });

      // If there are notes, also create a contact note
      if (input.notes && input.notes.trim()) {
        await createContactNote({
          contactId: input.contactId,
          content: `[Power Dialer] ${input.disposition}: ${input.notes}`,
          authorId: ctx.user.id,
        });
      }

      return {
        nextIndex,
        isComplete,
        totalProcessed: results.length,
        totalContacts: session.totalContacts,
      };
    }),

  /** Pause or resume a dialer session */
  pauseSession: protectedProcedure
    .input(z.object({ sessionId: z.number(), accountId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);

      const session = await getDialerSessionById(input.sessionId);
      if (!session || session.accountId !== input.accountId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found." });
      }

      const newStatus = session.status === "paused" ? "active" : "paused";
      await updateDialerSession(session.id, { status: newStatus as any });

      return { status: newStatus };
    }),

  /** Complete a session early */
  completeSession: protectedProcedure
    .input(z.object({ sessionId: z.number(), accountId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);

      const session = await getDialerSessionById(input.sessionId);
      if (!session || session.accountId !== input.accountId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found." });
      }

      await updateDialerSession(session.id, {
        status: "completed",
        completedAt: new Date(),
      });

      const results = session.results ? JSON.parse(session.results) : [];
      return { success: true, totalProcessed: results.length };
    }),

  /** Delete a session */
  deleteSession: protectedProcedure
    .input(z.object({ sessionId: z.number(), accountId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);

      const session = await getDialerSessionById(input.sessionId);
      if (!session || session.accountId !== input.accountId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found." });
      }

      await deleteDialerSession(session.id);
      return { success: true };
    }),

  /** Get contacts by tag for session setup */
  getContactsByTag: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        tag: z.string(),
        limit: z.number().optional().default(500),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      const result = await listContacts({
        accountId: input.accountId,
        tag: input.tag,
        limit: input.limit,
        offset: 0,
      });
      // Filter to only contacts with phone numbers
      return {
        contacts: result.data.filter((c: any) => c.phone),
        total: result.data.filter((c: any) => c.phone).length,
      };
    }),

  // ─── SCRIPT MANAGEMENT ───

  /** Create a call script */
  createScript: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        name: z.string().min(1).max(255),
        content: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);

      const { id } = await createDialerScript({
        accountId: input.accountId,
        name: input.name,
        content: input.content,
        createdById: ctx.user.id,
      });

      return { id };
    }),

  /** List call scripts for an account */
  listScripts: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      return listDialerScripts(input.accountId);
    }),

  /** Get a single script */
  getScript: protectedProcedure
    .input(z.object({ id: z.number(), accountId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      const script = await getDialerScriptById(input.id);
      if (!script || script.accountId !== input.accountId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Script not found." });
      }
      return script;
    }),

  /** Update a call script */
  updateScript: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        accountId: z.number(),
        name: z.string().min(1).max(255).optional(),
        content: z.string().min(1).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);

      const script = await getDialerScriptById(input.id);
      if (!script || script.accountId !== input.accountId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Script not found." });
      }

      const updateData: Record<string, any> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.content !== undefined) updateData.content = input.content;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;

      await updateDialerScript(input.id, updateData);
      return { success: true };
    }),

  /** Delete a call script */
  deleteScript: protectedProcedure
    .input(z.object({ id: z.number(), accountId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);

      const script = await getDialerScriptById(input.id);
      if (!script || script.accountId !== input.accountId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Script not found." });
      }

      await deleteDialerScript(input.id);
      return { success: true };
    }),

  // ─── ANALYTICS ───

  /** Get dialer analytics for an account */
  getAnalytics: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        userId: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);

      const result = await getDialerAnalytics({
        accountId: input.accountId,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        userId: input.userId,
      });

      if (!result) {
        return {
          summary: {
            totalSessions: 0,
            completedSessions: 0,
            activeSessions: 0,
            totalCalls: 0,
            answered: 0,
            noAnswer: 0,
            leftVoicemail: 0,
            notInterested: 0,
            callbackRequested: 0,
            skipped: 0,
            failed: 0,
            connectRate: 0,
          },
          perUser: [],
          daily: [],
        };
      }

      return result;
    }),
});
