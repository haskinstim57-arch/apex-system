import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  createCampaignTemplate,
  listCampaignTemplates,
  getCampaignTemplate,
  updateCampaignTemplate,
  deleteCampaignTemplate,
  createCampaign,
  listCampaigns,
  getCampaign,
  updateCampaign,
  deleteCampaign,
  addCampaignRecipients,
  listCampaignRecipients,
  updateCampaignRecipientStatus,
  getCampaignRecipientStats,
  removeCampaignRecipient,
  getCampaignStats,
  getMember,
  getSegmentById,
  resolveSegmentContacts,
  listContacts,
  type SegmentFilterConfig,
} from "../db";

// ─────────────────────────────────────────────
// REAL PROVIDER SEND FUNCTIONS
// Routes through Twilio (SMS) and SendGrid (Email)
// Falls back to placeholder when providers are not configured
// ─────────────────────────────────────────────
import { dispatchSMS, dispatchEmail } from "../services/messaging";

interface SendResult {
  success: boolean;
  externalId?: string;
  error?: string;
}

/**
 * Send a campaign email via SendGrid (or placeholder fallback).
 */
export async function sendCampaignEmail(params: {
  to: string;
  from: string;
  subject: string;
  body: string;
  contactFirstName?: string;
  contactLastName?: string;
}): Promise<SendResult> {
  const result = await dispatchEmail({
    to: params.to,
    subject: params.subject,
    body: params.body,
    from: params.from,
  });
  return {
    success: result.success,
    externalId: result.externalId,
    error: result.error,
  };
}

/**
 * Send a campaign SMS via Twilio (or placeholder fallback).
 */
export async function sendCampaignSMS(params: {
  to: string;
  from: string;
  body: string;
  contactFirstName?: string;
  contactLastName?: string;
}): Promise<SendResult> {
  const result = await dispatchSMS({
    to: params.to,
    body: params.body,
    from: params.from,
  });
  return {
    success: result.success,
    externalId: result.externalId,
    error: result.error,
  };
}

// ─────────────────────────────────────────────
// HELPER: Check account membership (admin bypass)
// ─────────────────────────────────────────────

async function requireAccountAccess(
  userId: number,
  accountId: number,
  platformRole: string
) {
  if (platformRole === "admin") return; // admin bypass
  const member = await getMember(accountId, userId);
  if (!member || !member.isActive) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this account.",
    });
  }
}

// ─────────────────────────────────────────────
// TEMPLATE VARIABLES — merge tags for personalization
// ─────────────────────────────────────────────

function mergeTemplateVars(
  body: string,
  contact: { firstName?: string; lastName?: string; email?: string; phone?: string; company?: string }
): string {
  return body
    .replace(/\{\{firstName\}\}/g, contact.firstName || "")
    .replace(/\{\{lastName\}\}/g, contact.lastName || "")
    .replace(/\{\{email\}\}/g, contact.email || "")
    .replace(/\{\{phone\}\}/g, contact.phone || "")
    .replace(/\{\{company\}\}/g, contact.company || "");
}

// ─────────────────────────────────────────────
// TEMPLATES ROUTER
// ─────────────────────────────────────────────

const templatesRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        name: z.string().min(1).max(255),
        type: z.enum(["email", "sms"]),
        subject: z.string().max(500).optional(),
        body: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      return createCampaignTemplate({
        accountId: input.accountId,
        name: input.name,
        type: input.type,
        subject: input.subject || null,
        body: input.body,
        createdById: ctx.user.id,
      });
    }),

  list: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        type: z.enum(["email", "sms"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      return listCampaignTemplates(input.accountId, { type: input.type });
    }),

  get: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      const template = await getCampaignTemplate(input.id, input.accountId);
      if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      return template;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
        name: z.string().min(1).max(255).optional(),
        type: z.enum(["email", "sms"]).optional(),
        subject: z.string().max(500).optional(),
        body: z.string().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      const { id, accountId, ...data } = input;
      await updateCampaignTemplate(id, accountId, data);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      await deleteCampaignTemplate(input.id, input.accountId);
      return { success: true };
    }),
});

// ─────────────────────────────────────────────
// CAMPAIGNS ROUTER
// ─────────────────────────────────────────────

export const campaignsRouter = router({
  templates: templatesRouter,

  create: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        name: z.string().min(1).max(255),
        type: z.enum(["email", "sms"]),
        subject: z.string().max(500).optional(),
        body: z.string().min(1),
        fromAddress: z.string().max(320).optional(),
        templateId: z.number().int().positive().optional(),
        scheduledAt: z.date().optional(),
        /** Array of contact IDs to add as recipients */
        contactIds: z.array(z.number().int().positive()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      const status = input.scheduledAt ? "scheduled" : "draft";
      const result = await createCampaign({
        accountId: input.accountId,
        name: input.name,
        type: input.type,
        status,
        subject: input.subject || null,
        body: input.body,
        fromAddress: input.fromAddress || null,
        templateId: input.templateId || null,
        scheduledAt: input.scheduledAt || null,
        createdById: ctx.user.id,
      });
      return result;
    }),

  list: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        status: z.string().optional(),
        type: z.enum(["email", "sms"]).optional(),
        search: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      const result = await listCampaigns(input.accountId, input);
      // Enrich each campaign with progress data
      const enriched = result.data.map((c) => {
        const totalContacts = c.totalRecipients || 0;
        const contactsReached = (c.sentCount || 0) + (c.deliveredCount || 0);
        // Avoid double-counting: use the higher of sentCount or deliveredCount as "reached"
        const reached = Math.max(c.sentCount || 0, c.deliveredCount || 0);
        const progressPercent = totalContacts > 0 ? Math.round((reached / totalContacts) * 100) : 0;
        return { ...c, totalContacts, contactsReached: reached, progressPercent };
      });
      return { data: enriched, total: result.total };
    }),

  get: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      const campaign = await getCampaign(input.id, input.accountId);
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      const totalContacts = campaign.totalRecipients || 0;
      const contactsReached = Math.max(campaign.sentCount || 0, campaign.deliveredCount || 0);
      const progressPercent = totalContacts > 0 ? Math.round((contactsReached / totalContacts) * 100) : 0;
      return { ...campaign, totalContacts, contactsReached, progressPercent };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
        name: z.string().min(1).max(255).optional(),
        type: z.enum(["email", "sms"]).optional(),
        subject: z.string().max(500).optional(),
        body: z.string().min(1).optional(),
        fromAddress: z.string().max(320).optional(),
        scheduledAt: z.date().nullable().optional(),
        status: z
          .enum(["draft", "scheduled", "sending", "sent", "paused", "cancelled"])
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      const { id, accountId, ...data } = input;
      await updateCampaign(id, accountId, data as any);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      await deleteCampaign(input.id, input.accountId);
      return { success: true };
    }),

  /** Add contacts as recipients to a campaign */
  addRecipients: protectedProcedure
    .input(
      z.object({
        campaignId: z.number().int().positive(),
        accountId: z.number().int().positive(),
        /** Array of { contactId, toAddress } */
        recipients: z.array(
          z.object({
            contactId: z.number().int().positive(),
            toAddress: z.string().min(1),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      const campaign = await getCampaign(input.campaignId, input.accountId);
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      await addCampaignRecipients(input.campaignId, input.recipients);
      // Update total recipients count
      const stats = await getCampaignRecipientStats(input.campaignId);
      await updateCampaign(input.campaignId, input.accountId, {
        totalRecipients: stats.total,
      });
      return { success: true, added: input.recipients.length };
    }),

  /** Remove a recipient from a campaign */
  removeRecipient: protectedProcedure
    .input(
      z.object({
        recipientId: z.number().int().positive(),
        campaignId: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      await removeCampaignRecipient(input.recipientId);
      const stats = await getCampaignRecipientStats(input.campaignId);
      await updateCampaign(input.campaignId, input.accountId, {
        totalRecipients: stats.total,
      });
      return { success: true };
    }),

  /** List recipients for a campaign */
  recipients: protectedProcedure
    .input(
      z.object({
        campaignId: z.number().int().positive(),
        accountId: z.number().int().positive(),
        status: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      return listCampaignRecipients(input.campaignId, input);
    }),

  /** Get recipient delivery stats for a campaign */
  recipientStats: protectedProcedure
    .input(
      z.object({
        campaignId: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      return getCampaignRecipientStats(input.campaignId);
    }),

  /** Get campaign overview stats for an account */
  stats: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      return getCampaignStats(input.accountId);
    }),

  /** Send a campaign immediately (or process scheduled campaign) */
  send: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      const campaign = await getCampaign(input.id, input.accountId);
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      if (campaign.status !== "draft" && campaign.status !== "scheduled") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot send a campaign with status "${campaign.status}"`,
        });
      }

      // Mark as sending
      await updateCampaign(input.id, input.accountId, {
        status: "sending",
        sentAt: new Date(),
      });

      // Get all pending recipients
      const { data: recipients } = await listCampaignRecipients(input.id, {
        status: "pending",
        limit: 10000,
      });

      let sentCount = 0;
      let failedCount = 0;

      // Process each recipient
      for (const recipient of recipients) {
        const mergedBody = mergeTemplateVars(campaign.body, {
          firstName: recipient.contactFirstName || undefined,
          lastName: recipient.contactLastName || undefined,
          email: recipient.contactEmail || undefined,
          phone: recipient.contactPhone || undefined,
        });

        let result: SendResult;
        if (campaign.type === "email") {
          result = await sendCampaignEmail({
            to: recipient.toAddress,
            from: campaign.fromAddress || "noreply@sterlingmarketing.com",
            subject: campaign.subject || campaign.name,
            body: mergedBody,
            contactFirstName: recipient.contactFirstName || undefined,
            contactLastName: recipient.contactLastName || undefined,
          });
        } else {
          result = await sendCampaignSMS({
            to: recipient.toAddress,
            from: campaign.fromAddress || "+10000000000",
            body: mergedBody,
            contactFirstName: recipient.contactFirstName || undefined,
            contactLastName: recipient.contactLastName || undefined,
          });
        }

        if (result.success) {
          sentCount++;
          await updateCampaignRecipientStatus(recipient.id, "sent", {
            sentAt: new Date(),
          });
        } else {
          failedCount++;
          await updateCampaignRecipientStatus(recipient.id, "failed", {
            errorMessage: result.error,
          });
        }
      }

      // Mark campaign as sent
      await updateCampaign(input.id, input.accountId, {
        status: "sent",
        completedAt: new Date(),
        sentCount,
        failedCount,
        totalRecipients: recipients.length,
      });

      return { success: true, sentCount, failedCount, total: recipients.length };
    }),

  /** Schedule a campaign for future sending */
  schedule: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
        scheduledAt: z.date(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      const campaign = await getCampaign(input.id, input.accountId);
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      if (campaign.status !== "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only draft campaigns can be scheduled",
        });
      }
      await updateCampaign(input.id, input.accountId, {
        status: "scheduled",
        scheduledAt: input.scheduledAt,
      });
      return { success: true };
    }),

  /** Pause a sending or scheduled campaign */
  pause: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      await updateCampaign(input.id, input.accountId, { status: "paused" });
      return { success: true };
    }),

  /** Cancel a campaign */
  cancel: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        accountId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      await updateCampaign(input.id, input.accountId, { status: "cancelled" });
      return { success: true };
    }),

  /** Add recipients from a segment (Smart List) to a campaign */
  addRecipientsFromSegment: protectedProcedure
    .input(
      z.object({
        campaignId: z.number().int().positive(),
        accountId: z.number().int().positive(),
        segmentId: z.number().int().positive(),
        /** Campaign type determines which field to use as toAddress */
        type: z.enum(["email", "sms"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountAccess(ctx.user.id, input.accountId, ctx.user.role);

      const campaign = await getCampaign(input.campaignId, input.accountId);
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });

      const segment = await getSegmentById(input.segmentId, input.accountId);
      if (!segment) throw new TRPCError({ code: "NOT_FOUND", message: "Segment not found" });

      const filterConfig: SegmentFilterConfig = segment.filterConfig
        ? JSON.parse(segment.filterConfig)
        : {};

      // Get all matching contact IDs
      const { ids } = await resolveSegmentContacts(input.accountId, filterConfig);
      if (ids.length === 0) {
        return { success: true, added: 0, skipped: 0 };
      }

      // Fetch contact details to get email/phone
      const contactsResult = await listContacts({
        accountId: input.accountId,
        limit: ids.length,
        offset: 0,
      });

      const contactMap = new Map(contactsResult.data.map((c) => [c.id, c]));

      const recipients: Array<{ contactId: number; toAddress: string }> = [];
      let skipped = 0;

      for (const id of ids) {
        const contact = contactMap.get(id);
        if (!contact) { skipped++; continue; }

        const toAddress = input.type === "email" ? contact.email : contact.phone;
        if (!toAddress) { skipped++; continue; }

        recipients.push({ contactId: id, toAddress });
      }

      if (recipients.length > 0) {
        await addCampaignRecipients(input.campaignId, recipients);
        const stats = await getCampaignRecipientStats(input.campaignId);
        await updateCampaign(input.campaignId, input.accountId, {
          totalRecipients: stats.total,
        });
      }

      return { success: true, added: recipients.length, skipped };
    }),
});
