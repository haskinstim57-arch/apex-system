import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
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
  getAccountById,
  logContactActivity,
} from "../db";
import {
  createVapiCall,
  getVapiCall,
  resolveAssistantId,
  mapVapiStatus,
  mapVapiEndedReason,
  VapiApiError,
} from "../services/vapi";
import { isWithinBusinessHours, getBusinessHoursBlockMessage, BUSINESS_HOURS, type BusinessHoursConfig } from "../utils/businessHours";

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
// AI Calls Router — VAPI Integration
// ─────────────────────────────────────────────
export const aiCallsRouter = router({
  /** Start a single AI call to a contact via VAPI */
  start: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        contactId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);

      // ── Fetch account for per-account business hours ──
      const account = await getAccountById(input.accountId);
      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found." });
      }
      const bhConfig = account.businessHoursConfig as BusinessHoursConfig | null;

      // ── Business hours enforcement ──
      if (!isWithinBusinessHours(bhConfig)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: getBusinessHoursBlockMessage(bhConfig),
        });
      }

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

      // Resolve which VAPI assistant to use based on lead source
      const assistantId = resolveAssistantId(contact.leadSource);
      const contactName = `${contact.firstName} ${contact.lastName}`.trim();

      // Create the call record first (status: queued)
      const { id } = await createAICall({
        accountId: input.accountId,
        contactId: input.contactId,
        initiatedById: ctx.user.id,
        phoneNumber: contact.phone,
        status: "queued",
        direction: "outbound",
        assistantId,
      });

      try {
        // Call the real VAPI API
        const vapiResponse = await createVapiCall({
          phoneNumber: contact.phone,
          customerName: contactName,
          assistantId,
          metadata: {
            apexAccountId: input.accountId,
            apexContactId: input.contactId,
            apexCallId: id,
            leadSource: contact.leadSource ?? undefined,
          },
        });

        // Update our record with the VAPI call ID and status
        const mappedStatus = mapVapiStatus(vapiResponse.status);
        await updateAICall(id, {
          status: mappedStatus,
          externalCallId: vapiResponse.id,
          startedAt: new Date(),
          metadata: JSON.stringify(vapiResponse),
        });

        // Log activity
        logContactActivity({
          contactId: input.contactId,
          accountId: input.accountId,
          activityType: "ai_call_made",
          description: `AI call initiated to ${contact.phone} (${contactName})`,
          metadata: JSON.stringify({ callId: id, externalCallId: vapiResponse.id, status: mappedStatus }),
        });

        return {
          id,
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
              : "Unknown error initiating VAPI call";

        await updateAICall(id, {
          status: "failed",
          errorMessage: errorMsg,
        });

        return { id, success: false, externalCallId: null, error: errorMsg };
      }
    }),

  /** Start bulk AI calls to multiple contacts via VAPI */
  bulkStart: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        contactIds: z.array(z.number()).min(1).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);

      // ── Fetch account for per-account business hours ──
      const account = await getAccountById(input.accountId);
      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found." });
      }
      const bhConfig = account.businessHoursConfig as BusinessHoursConfig | null;

      // ── Business hours enforcement ──
      if (!isWithinBusinessHours(bhConfig)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: getBusinessHoursBlockMessage(bhConfig),
        });
      }

      const results: Array<{
        contactId: number;
        callId: number;
        success: boolean;
        error?: string;
      }> = [];

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

        const assistantId = resolveAssistantId(contact.leadSource);
        const contactName = `${contact.firstName} ${contact.lastName}`.trim();

        const { id } = await createAICall({
          accountId: input.accountId,
          contactId,
          initiatedById: ctx.user.id,
          phoneNumber: contact.phone,
          status: "queued",
          direction: "outbound",
          assistantId,
        });

        try {
          const vapiResponse = await createVapiCall({
            phoneNumber: contact.phone,
            customerName: contactName,
            assistantId,
            metadata: {
              apexAccountId: input.accountId,
              apexContactId: contactId,
              apexCallId: id,
              leadSource: contact.leadSource ?? undefined,
            },
          });

          const mappedStatus = mapVapiStatus(vapiResponse.status);
          await updateAICall(id, {
            status: mappedStatus,
            externalCallId: vapiResponse.id,
            startedAt: new Date(),
            metadata: JSON.stringify(vapiResponse),
          });

          results.push({ contactId, callId: id, success: true });
        } catch (err) {
          const errorMsg =
            err instanceof VapiApiError
              ? `VAPI error (${err.statusCode}): ${err.responseBody}`
              : err instanceof Error
                ? err.message
                : "Unknown error";

          await updateAICall(id, {
            status: "failed",
            errorMessage: errorMsg,
          });

          results.push({ contactId, callId: id, success: false, error: errorMsg });
        }
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

  /**
   * Sync call status from VAPI.
   * Fetches the latest state from VAPI API and updates our DB.
   * Used for polling-based status updates.
   */
  syncStatus: protectedProcedure
    .input(z.object({ id: z.number(), accountId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);

      const call = await getAICallById(input.id);
      if (!call || call.accountId !== input.accountId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Call not found." });
      }
      if (!call.externalCallId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No VAPI call ID to sync." });
      }

      try {
        const vapiCall = await getVapiCall(call.externalCallId);

        const updateData: Record<string, any> = {};

        // Map status
        if (vapiCall.status === "ended") {
          updateData.status = mapVapiEndedReason(vapiCall.endedReason as string | undefined);
        } else {
          updateData.status = mapVapiStatus(vapiCall.status);
        }

        // Extract transcript from artifact or top-level
        const transcript =
          vapiCall.artifact?.transcript ?? vapiCall.transcript ?? null;
        if (transcript) updateData.transcript = transcript;

        // Extract recording URL from artifact or top-level
        const recordingUrl =
          vapiCall.artifact?.recordingUrl ?? vapiCall.recordingUrl ?? null;
        if (recordingUrl) updateData.recordingUrl = recordingUrl;

        // Extract summary from analysis or top-level
        const summary =
          vapiCall.analysis?.summary ?? vapiCall.summary ?? null;
        if (summary) updateData.summary = summary;

        // Calculate duration if startedAt and endedAt are available
        if (vapiCall.startedAt && vapiCall.endedAt) {
          const start = new Date(vapiCall.startedAt).getTime();
          const end = new Date(vapiCall.endedAt).getTime();
          if (start > 0 && end > start) {
            updateData.durationSeconds = Math.round((end - start) / 1000);
          }
          updateData.endedAt = new Date(vapiCall.endedAt);
        }

        // Store full VAPI response as metadata
        updateData.metadata = JSON.stringify(vapiCall);

        await updateAICall(input.id, updateData);

        return {
          success: true,
          status: updateData.status,
          hasTranscript: !!transcript,
          hasRecording: !!recordingUrl,
          durationSeconds: updateData.durationSeconds ?? 0,
        };
      } catch (err) {
        const errorMsg =
          err instanceof VapiApiError
            ? `VAPI sync error (${err.statusCode})`
            : "Failed to sync with VAPI";
        console.error(`[AI Calls] Sync failed for call ${input.id}:`, err);
        return { success: false, error: errorMsg };
      }
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

  /**
   * VAPI Webhook handler — public endpoint (no auth required).
   * VAPI sends POST requests with call status updates.
   */
  webhook: publicProcedure
    .input(
      z.object({
        message: z.object({
          type: z.string(),
          call: z.object({
            id: z.string(),
            status: z.string().optional(),
            endedReason: z.string().optional(),
            metadata: z
              .object({
                apex_call_id: z.string().optional(),
                apex_account_id: z.string().optional(),
                apex_contact_id: z.string().optional(),
              })
              .passthrough()
              .optional(),
          }).passthrough().optional(),
          transcript: z.string().optional(),
          artifact: z
            .object({
              transcript: z.string().optional(),
              recordingUrl: z.string().optional(),
            })
            .passthrough()
            .optional(),
          analysis: z
            .object({
              summary: z.string().optional(),
            })
            .passthrough()
            .optional(),
        }).passthrough(),
      }).passthrough()
    )
    .mutation(async ({ input }) => {
      const { message } = input;
      const vapiCallId = message.call?.id;
      const apexCallIdStr = message.call?.metadata?.apex_call_id;

      if (!vapiCallId && !apexCallIdStr) {
        console.warn("[VAPI Webhook] No call ID in webhook payload");
        return { success: false };
      }

      console.log(`[VAPI Webhook] type=${message.type} vapiCallId=${vapiCallId}`);

      // Find our internal call record
      let apexCallId = apexCallIdStr ? parseInt(apexCallIdStr, 10) : null;

      // If we don't have the apex call ID from metadata, we can't process
      if (!apexCallId || isNaN(apexCallId)) {
        console.warn("[VAPI Webhook] No apex_call_id in metadata, skipping");
        return { success: false };
      }

      const call = await getAICallById(apexCallId);
      if (!call) {
        console.warn(`[VAPI Webhook] Call ${apexCallId} not found in DB`);
        return { success: false };
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

          if (message.artifact?.transcript) {
            updateData.transcript = message.artifact.transcript;
          } else if (message.transcript) {
            updateData.transcript = message.transcript;
          }

          if (message.artifact?.recordingUrl) {
            updateData.recordingUrl = message.artifact.recordingUrl;
          }

          if (message.analysis?.summary) {
            updateData.summary = message.analysis.summary;
          }

          // Store full webhook payload as metadata
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
        await updateAICall(apexCallId, updateData);
      }

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

  /** Get call recording info by call ID */
  getRecording: protectedProcedure
    .input(z.object({ id: z.number(), accountId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      const call = await getAICallById(input.id);
      if (!call || call.accountId !== input.accountId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Call not found." });
      }
      return {
        id: call.id,
        recordingUrl: call.recordingUrl,
        transcript: call.transcript,
        summary: call.summary,
        durationSeconds: call.durationSeconds,
        status: call.status,
        sentiment: call.sentiment,
      };
    }),

  /** Get AI calls for a specific contact */
  byContact: protectedProcedure
    .input(z.object({ contactId: z.number(), accountId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      return getAICallsByContact(input.contactId, input.accountId);
    }),
});
