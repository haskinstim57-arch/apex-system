import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  createAICall,
  getAICallById,
  listAICalls,
  updateAICall,
  deleteAICall,
  getAICallStats,
  getAICallsByContact,
  getMember,
  getContactById,
} from "../db";

// ─────────────────────────────────────────────
// Placeholder VAPI integration
// These functions will be replaced with actual VAPI API calls
// ─────────────────────────────────────────────

/**
 * Placeholder function for starting an AI call via VAPI.
 * Will be replaced with actual VAPI API integration.
 * @returns simulated external call ID
 */
async function startAICall(contactId: number, phoneNumber: string, accountId: number): Promise<{
  success: boolean;
  externalCallId: string;
  error?: string;
}> {
  // Simulate VAPI call initiation
  // In production, this will:
  // 1. Call VAPI API to start an outbound call
  // 2. Use the appropriate VAPI assistant for the lead source
  // 3. Return the VAPI call ID for tracking
  const externalCallId = `vapi_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  console.log(`[AI Call Placeholder] Starting call to ${phoneNumber} for contact ${contactId} in account ${accountId}`);
  console.log(`[AI Call Placeholder] External call ID: ${externalCallId}`);

  // Simulate a brief delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  return {
    success: true,
    externalCallId,
  };
}

/**
 * Placeholder for sending a bulk batch of AI calls.
 */
async function startBulkAICalls(
  contacts: Array<{ contactId: number; phoneNumber: string }>,
  accountId: number
): Promise<Array<{ contactId: number; success: boolean; externalCallId?: string; error?: string }>> {
  const results = [];
  for (const contact of contacts) {
    const result = await startAICall(contact.contactId, contact.phoneNumber, accountId);
    results.push({
      contactId: contact.contactId,
      success: result.success,
      externalCallId: result.externalCallId,
      error: result.error,
    });
  }
  return results;
}

// ─────────────────────────────────────────────
// Access control helper
// ─────────────────────────────────────────────
async function requireAccountAccess(userId: number, accountId: number, userRole: string) {
  if (userRole === "admin") return; // Platform admins bypass
  const member = await getMember(accountId, userId);
  if (!member) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this account.",
    });
  }
}

// ─────────────────────────────────────────────
// AI Calls Router
// ─────────────────────────────────────────────
export const aiCallsRouter = router({
  /** Start a single AI call to a contact */
  start: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        contactId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);

      // Get the contact to verify it exists and get phone number
      const contact = await getContactById(input.contactId, input.accountId);
      if (!contact) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contact not found in this account.",
        });
      }
      if (!contact.phone) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Contact does not have a phone number.",
        });
      }

      // Create the call record
      const { id } = await createAICall({
        accountId: input.accountId,
        contactId: input.contactId,
        initiatedById: ctx.user.id,
        phoneNumber: contact.phone,
        status: "queued",
        direction: "outbound",
      });

      // Start the AI call via placeholder
      const result = await startAICall(input.contactId, contact.phone, input.accountId);

      if (result.success) {
        await updateAICall(id, {
          status: "calling",
          externalCallId: result.externalCallId,
          startedAt: new Date(),
        });
      } else {
        await updateAICall(id, {
          status: "failed",
          errorMessage: result.error || "Failed to initiate call",
        });
      }

      return { id, success: result.success, externalCallId: result.externalCallId };
    }),

  /** Start bulk AI calls to multiple contacts */
  bulkStart: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        contactIds: z.array(z.number()).min(1).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);

      const results: Array<{
        contactId: number;
        callId: number;
        success: boolean;
        error?: string;
      }> = [];

      // Create call records and initiate calls for each contact
      for (const contactId of input.contactIds) {
        const contact = await getContactById(contactId, input.accountId);
        if (!contact || !contact.phone) {
          results.push({
            contactId,
            callId: 0,
            success: false,
            error: !contact ? "Contact not found" : "No phone number",
          });
          continue;
        }

        const { id } = await createAICall({
          accountId: input.accountId,
          contactId,
          initiatedById: ctx.user.id,
          phoneNumber: contact.phone,
          status: "queued",
          direction: "outbound",
        });

        const callResult = await startAICall(contactId, contact.phone, input.accountId);

        if (callResult.success) {
          await updateAICall(id, {
            status: "calling",
            externalCallId: callResult.externalCallId,
            startedAt: new Date(),
          });
        } else {
          await updateAICall(id, {
            status: "failed",
            errorMessage: callResult.error || "Failed to initiate call",
          });
        }

        results.push({
          contactId,
          callId: id,
          success: callResult.success,
          error: callResult.error,
        });
      }

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      return { results, successCount, failCount, total: input.contactIds.length };
    }),

  /** List AI calls for an account */
  list: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        page: z.number().optional(),
        limit: z.number().optional(),
        status: z.string().optional(),
        contactId: z.number().optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      return listAICalls(input);
    }),

  /** Get a single AI call by ID */
  get: protectedProcedure
    .input(z.object({ id: z.number(), accountId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      const call = await getAICallById(input.id);
      if (!call || call.accountId !== input.accountId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Call not found." });
      }
      return call;
    }),

  /** Update AI call status (for webhook callbacks from VAPI) */
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        accountId: z.number(),
        status: z.enum(["queued", "calling", "completed", "failed", "no_answer", "busy", "cancelled"]),
        durationSeconds: z.number().optional(),
        transcript: z.string().optional(),
        summary: z.string().optional(),
        recordingUrl: z.string().optional(),
        sentiment: z.enum(["positive", "neutral", "negative"]).optional(),
        errorMessage: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);

      const call = await getAICallById(input.id);
      if (!call || call.accountId !== input.accountId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Call not found." });
      }

      const updateData: Record<string, any> = { status: input.status };
      if (input.durationSeconds !== undefined) updateData.durationSeconds = input.durationSeconds;
      if (input.transcript) updateData.transcript = input.transcript;
      if (input.summary) updateData.summary = input.summary;
      if (input.recordingUrl) updateData.recordingUrl = input.recordingUrl;
      if (input.sentiment) updateData.sentiment = input.sentiment;
      if (input.errorMessage) updateData.errorMessage = input.errorMessage;

      if (input.status === "completed" || input.status === "failed" || input.status === "no_answer" || input.status === "busy") {
        updateData.endedAt = new Date();
      }

      await updateAICall(input.id, updateData);
      return { success: true };
    }),

  /** Delete an AI call record */
  delete: protectedProcedure
    .input(z.object({ id: z.number(), accountId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);

      const call = await getAICallById(input.id);
      if (!call || call.accountId !== input.accountId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Call not found." });
      }

      await deleteAICall(input.id);
      return { success: true };
    }),

  /** Get AI call stats for an account */
  stats: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      return getAICallStats(input.accountId);
    }),

  /** Get AI calls for a specific contact */
  byContact: protectedProcedure
    .input(z.object({ contactId: z.number(), accountId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      return getAICallsByContact(input.contactId, input.accountId);
    }),
});
