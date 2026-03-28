import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { requireAccountMember } from "./contacts";
import {
  createReview,
  getReviewsByAccount,
  getReviewStats,
  createReviewRequest,
  getReviewRequestsByAccount,
  getReviewRequestStats,
  updateReviewRequestStatus,
  getReviewUrl,
  generateReplySuggestion,
} from "../services/googleMyBusiness";
import { getContactById } from "../db";
import { dispatchSMS, dispatchEmail } from "../services/messaging";
import { createMessage } from "../db";

const platformEnum = z.enum(["google", "facebook", "yelp", "zillow"]);
const channelEnum = z.enum(["sms", "email"]);

export const reputationRouter = router({
  // ─── Review Stats ────────────────────────────────────────────
  getStats: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId);
      const [reviewStats, requestStats] = await Promise.all([
        getReviewStats(input.accountId),
        getReviewRequestStats(input.accountId),
      ]);
      return { reviewStats, requestStats };
    }),

  // ─── List Reviews ────────────────────────────────────────────
  listReviews: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId);
      return getReviewsByAccount(input.accountId, input.limit, input.offset);
    }),

  // ─── Add Review (manual entry or import) ─────────────────────
  addReview: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        platform: platformEnum,
        rating: z.number().min(1).max(5),
        body: z.string().optional(),
        reviewerName: z.string().optional(),
        reviewUrl: z.string().optional(),
        externalId: z.string().optional(),
        postedAt: z.string().optional(),
        contactId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId);
      return createReview({
        accountId: input.accountId,
        platform: input.platform,
        rating: input.rating,
        body: input.body || null,
        reviewerName: input.reviewerName || null,
        reviewUrl: input.reviewUrl || null,
        externalId: input.externalId || null,
        postedAt: input.postedAt ? new Date(input.postedAt) : null,
        contactId: input.contactId || null,
      });
    }),

  // ─── Generate AI Reply Suggestion ────────────────────────────
  generateReply: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        reviewBody: z.string(),
        rating: z.number().min(1).max(5),
        reviewerName: z.string(),
        businessName: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId);
      const reply = await generateReplySuggestion(
        input.reviewBody,
        input.rating,
        input.reviewerName,
        input.businessName
      );
      return { reply };
    }),

  // ─── List Review Requests ────────────────────────────────────
  listRequests: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId);
      return getReviewRequestsByAccount(input.accountId, input.limit, input.offset);
    }),

  // ─── Send Review Request ─────────────────────────────────────
  sendRequest: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        contactId: z.number(),
        platform: platformEnum,
        channel: channelEnum,
        /** Platform-specific business ID (Google Place ID, Facebook Page ID, etc.) */
        businessId: z.string(),
        /** Custom message template (use {{reviewUrl}} placeholder) */
        messageTemplate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId);
      const contact = await getContactById(input.contactId, input.accountId);
      if (!contact) throw new Error("Contact not found");

      const reviewUrl = getReviewUrl(input.platform, input.businessId);
      const defaultMessage = `Hi ${contact.firstName}, we'd love to hear about your experience! Please leave us a review: ${reviewUrl}`;
      const message = input.messageTemplate
        ? input.messageTemplate.replace(/\{\{reviewUrl\}\}/g, reviewUrl).replace(/\{\{firstName\}\}/g, contact.firstName)
        : defaultMessage;

      // Create the review request record
      const { id: requestId } = await createReviewRequest({
        accountId: input.accountId,
        contactId: input.contactId,
        platform: input.platform,
        channel: input.channel,
        reviewUrl,
        status: "pending",
      });

      try {
        if (input.channel === "sms") {
          if (!contact.phone) throw new Error("Contact has no phone number");
          const { id: msgId } = await createMessage({
            accountId: input.accountId,
            contactId: input.contactId,
            userId: ctx.user.id,
            type: "sms",
            direction: "outbound",
            status: "pending",
            body: message,
            toAddress: contact.phone,
          });
          const result = await dispatchSMS({ to: contact.phone, body: message, accountId: input.accountId });
          const { updateMessageStatus } = await import("../db");
          if (result.success) {
            await updateMessageStatus(msgId, "sent", { externalId: result.externalId, sentAt: new Date() });
          } else {
            await updateMessageStatus(msgId, "failed", { errorMessage: result.error });
          }
        } else {
          if (!contact.email) throw new Error("Contact has no email address");
          const { id: msgId } = await createMessage({
            accountId: input.accountId,
            contactId: input.contactId,
            userId: ctx.user.id,
            type: "email",
            direction: "outbound",
            status: "pending",
            body: message,
            toAddress: contact.email,
            subject: "We'd love your feedback!",
          });
          const result = await dispatchEmail({
            to: contact.email,
            subject: "We'd love your feedback!",
            body: message,
            accountId: input.accountId,
          });
          const { updateMessageStatus } = await import("../db");
          if (result.success) {
            await updateMessageStatus(msgId, "sent", { externalId: result.externalId, sentAt: new Date() });
          } else {
            await updateMessageStatus(msgId, "failed", { errorMessage: result.error });
          }
        }
        await updateReviewRequestStatus(requestId, "sent", { sentAt: new Date() });
        return { success: true, requestId };
      } catch (error: unknown) {
        await updateReviewRequestStatus(requestId, "failed");
        throw error;
      }
    }),

  // ─── Get Review Request Stats ────────────────────────────────
  getRequestStats: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId);
      return getReviewRequestStats(input.accountId);
    }),

  // ─── Update Review Request Status (for tracking clicks) ──────
  trackClick: protectedProcedure
    .input(z.object({ requestId: z.number(), accountId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId);
      await updateReviewRequestStatus(input.requestId, "clicked", { clickedAt: new Date() });
      return { success: true };
    }),
});
