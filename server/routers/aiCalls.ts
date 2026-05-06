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
  getAccountMessagingSettings,
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
import { enqueueMessage } from "../services/messageQueue";
import { chargeBeforeSend, reverseCharge } from "../services/usageTracker";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { accounts } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const AI_CALL_DEPOSIT_MINUTES = 3;

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

      // ── Resolve per-account VAPI config (fallback to ENV globals) ──
      const msgSettings = await getAccountMessagingSettings(input.accountId);
      const vapiApiKey = msgSettings?.vapiApiKey || ENV.vapiApiKey;
      const vapiPhoneNumberId = msgSettings?.vapiPhoneNumberId || undefined;
      const vapiAssistantOverride = msgSettings?.vapiAssistantIdOverride || undefined;

      if (!vapiApiKey) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "VAPI API key is not configured for this account. Please set it in Settings → AI & Voice.",
        });
      }

      // Resolve which VAPI assistant to use: account override > lead-source-based > ENV default
      const assistantId = vapiAssistantOverride || resolveAssistantId(contact.leadSource);
      const contactName = `${contact.firstName} ${contact.lastName}`.trim();

      // ── Business hours enforcement — queue if outside hours ──
      if (!isWithinBusinessHours(bhConfig)) {
        const { id: queueId } = await enqueueMessage({
          accountId: input.accountId,
          contactId: input.contactId,
          type: "ai_call",
          payload: {
            contactId: input.contactId,
            phoneNumber: contact.phone,
            customerName: contactName,
            assistantId,
            initiatedById: ctx.user.id,
            metadata: { leadSource: contact.leadSource ?? undefined },
          },
          source: "ai_calls.start",
          initiatedById: ctx.user.id,
        });
        return {
          id: 0,
          success: true,
          queued: true,
          queueId,
          externalCallId: null,
          message: `Call queued — will be dispatched when business hours resume.`,
        };
      }

      // ── Billing: pre-charge 3-minute deposit ──
      let depositEventId: number | null = null;
      try {
        const chargeResult = await chargeBeforeSend(
          input.accountId,
          "ai_call_minute",
          AI_CALL_DEPOSIT_MINUTES,
          { type: "ai_call_deposit", contactId: input.contactId },
          ctx.user.id
        );
        depositEventId = chargeResult.usageEventId;
      } catch (billingErr: any) {
        throw new TRPCError({
          code: "PAYMENT_REQUIRED" as any,
          message: billingErr.message || "Insufficient balance to initiate AI call. Please add funds.",
        });
      }

      // Create the call record first (status: queued)
      const { id } = await createAICall({
        accountId: input.accountId,
        contactId: input.contactId,
        initiatedById: ctx.user.id,
        phoneNumber: contact.phone,
        status: "queued",
        direction: "outbound",
        assistantId,
        metadata: depositEventId ? JSON.stringify({ depositEventId }) : undefined,
      });

      try {
        // Call the real VAPI API with per-account config
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
          apiKey: vapiApiKey,
          phoneNumberId: vapiPhoneNumberId,
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
        // VAPI call failed — reverse the deposit charge
        if (depositEventId) {
          reverseCharge(depositEventId).catch((revErr) =>
            console.error(`[aiCalls] Failed to reverse deposit for event ${depositEventId}:`, revErr)
          );
        }

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

      // ── Resolve per-account VAPI config (fallback to ENV globals) ──
      const msgSettings = await getAccountMessagingSettings(input.accountId);
      const vapiApiKey = msgSettings?.vapiApiKey || ENV.vapiApiKey;
      const vapiPhoneNumberId = msgSettings?.vapiPhoneNumberId || undefined;
      const vapiAssistantOverride = msgSettings?.vapiAssistantIdOverride || undefined;

      if (!vapiApiKey) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "VAPI API key is not configured for this account. Please set it in Settings → AI & Voice.",
        });
      }

      // ── Business hours enforcement — queue all contacts if outside hours ──
      if (!isWithinBusinessHours(bhConfig)) {
        const queueResults: Array<{ contactId: number; queueId: number; success: boolean; error?: string }> = [];
        for (const contactId of input.contactIds) {
          const contact = await getContactById(contactId, input.accountId);
          if (!contact || !contact.phone) {
            queueResults.push({ contactId, queueId: 0, success: false, error: !contact ? "Contact not found" : "No phone number" });
            continue;
          }
          const assistantId = vapiAssistantOverride || resolveAssistantId(contact.leadSource);
          const contactName = `${contact.firstName} ${contact.lastName}`.trim();
          const { id: queueId } = await enqueueMessage({
            accountId: input.accountId,
            contactId,
            type: "ai_call",
            payload: {
              contactId,
              phoneNumber: contact.phone,
              customerName: contactName,
              assistantId,
              initiatedById: ctx.user.id,
              metadata: { leadSource: contact.leadSource ?? undefined },
            },
            source: "ai_calls.bulkStart",
            initiatedById: ctx.user.id,
          });
          queueResults.push({ contactId, queueId, success: true });
        }
        return {
          results: queueResults.map(r => ({ contactId: r.contactId, callId: 0, success: r.success, error: r.error })),
          queued: true,
          message: `${queueResults.filter(r => r.success).length} call(s) queued — will be dispatched when business hours resume.`,
        };
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

        const assistantId = vapiAssistantOverride || resolveAssistantId(contact.leadSource);
        const contactName = `${contact.firstName} ${contact.lastName}`.trim();

        // Billing: pre-charge 3-minute deposit per call
        let depositEventId: number | null = null;
        try {
          const chargeResult = await chargeBeforeSend(
            input.accountId,
            "ai_call_minute",
            AI_CALL_DEPOSIT_MINUTES,
            { type: "ai_call_deposit", contactId },
            ctx.user.id
          );
          depositEventId = chargeResult.usageEventId;
        } catch (billingErr: any) {
          results.push({
            contactId,
            callId: 0,
            success: false,
            error: billingErr.message || "Insufficient balance for AI call",
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
          assistantId,
          metadata: depositEventId ? JSON.stringify({ depositEventId }) : undefined,
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
            apiKey: vapiApiKey,
            phoneNumberId: vapiPhoneNumberId,
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
          // Reverse deposit on VAPI failure
          if (depositEventId) {
            reverseCharge(depositEventId).catch((revErr) =>
              console.error(`[aiCalls.bulkStart] Failed to reverse deposit ${depositEventId}:`, revErr)
            );
          }

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

      // Auto-update contact status based on call outcome
      if (message.type === "end-of-call-report" && call.contactId && call.accountId) {
        try {
          const reason = (message.call?.endedReason ?? "").toLowerCase();
          let nextContactStatus: string | null = null;
          if (reason.includes("customer-did-not-answer") || reason.includes("no-answer")) {
            nextContactStatus = "uncontacted";
          } else if (reason.includes("voicemail") || reason.includes("machine")) {
            nextContactStatus = "uncontacted";
          } else if (reason.includes("busy")) {
            nextContactStatus = "uncontacted";
          } else if (reason.includes("customer-ended-call") || reason.includes("assistant-ended-call") || reason.includes("silence-timed-out")) {
            nextContactStatus = "contacted";
          }

          const PROGRESS_RANK: Record<string, number> = {
            new: 0, uncontacted: 1, contacted: 2, engaged: 3, application_taken: 4,
            application_in_progress: 5, credit_repair: 5, callback_scheduled: 4,
            app_link_pending: 4, qualified: 6, proposal: 7, negotiation: 8, won: 9, lost: 9, nurture: 4
          };

          if (nextContactStatus) {
            const { getContactById, updateContact } = await import("../db");
            const contact = await getContactById(call.contactId, call.accountId);
            if (contact) {
              const currentRank = PROGRESS_RANK[contact.status ?? "new"] ?? 0;
              const nextRank = PROGRESS_RANK[nextContactStatus] ?? 0;
              if (nextRank > currentRank) {
                await updateContact(call.contactId, call.accountId, { status: nextContactStatus });
                console.log(`[VAPI Webhook] Contact ${call.contactId} status updated: ${contact.status} → ${nextContactStatus}`);
              }
            }
          }
        } catch (err) {
          console.error("[VAPI Webhook] Failed to update contact status:", err);
        }
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

  /** Get VAPI configuration status for an account */
  getVapiConfig: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      const account = await getAccountById(input.accountId);
      const hasGlobalKey = !!ENV.vapiApiKey;
      const hasAgentId = !!ENV.vapiAgentId;
      const phoneNumber = (account as any)?.vapiPhoneNumber ?? null;
      return {
        isConfigured: hasGlobalKey && hasAgentId,
        hasApiKey: hasGlobalKey,
        hasAgentId,
        phoneNumber,
        agentId: hasAgentId ? `${ENV.vapiAgentId.slice(0, 8)}...` : null,
      };
    }),

  /** Test VAPI connection by hitting the assistants endpoint */
  testConnection: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      if (!ENV.vapiApiKey) {
        return { success: false, message: "VAPI API key is not configured." };
      }
      try {
        const res = await fetch("https://api.vapi.ai/assistant", {
          method: "GET",
          headers: { Authorization: `Bearer ${ENV.vapiApiKey}` },
        });
        if (res.ok) {
          return { success: true, message: "Connected to VAPI successfully." };
        }
        return { success: false, message: `VAPI returned status ${res.status}` };
      } catch (err: any) {
        return { success: false, message: err.message || "Connection failed" };
      }
    }),

  /** Update per-account VAPI phone number */
  updateVapiPhone: protectedProcedure
    .input(z.object({ accountId: z.number(), phoneNumber: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      const db = await getDb();
      await db.update(accounts).set({ vapiPhoneNumber: input.phoneNumber }).where(eq(accounts.id, input.accountId));
      return { success: true };
    }),
});
