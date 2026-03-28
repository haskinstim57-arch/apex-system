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
import { getContactById, getDb } from "../db";
import { dispatchSMS, dispatchEmail } from "../services/messaging";
import { createMessage } from "../db";
import { gmbConnections, reviews, reputationAlertSettings } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";
import { dispatchWebhookEvent } from "../services/webhookDispatcher";

const platformEnum = z.enum(["google", "facebook", "yelp", "zillow"]);
const channelEnum = z.enum(["sms", "email"]);

// ─── Reputation Alert Helper ──────────────────────────────────────
async function checkAndFireReputationAlert(
  accountId: number,
  review: { rating: number; reviewerName: string; platform: string; body: string }
) {
  const db = await getDb();
  if (!db) return;

  const [settings] = await db
    .select()
    .from(reputationAlertSettings)
    .where(
      and(
        eq(reputationAlertSettings.accountId, accountId),
        eq(reputationAlertSettings.enabled, true)
      )
    )
    .limit(1);

  if (!settings) return;
  if (review.rating > settings.ratingThreshold) return;

  const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
  const title = `⚠️ Negative Review Alert: ${stars} on ${review.platform}`;
  const content = [
    `A ${review.rating}-star review was posted on ${review.platform}.`,
    `Reviewer: ${review.reviewerName}`,
    review.body ? `Review: "${review.body.slice(0, 200)}${review.body.length > 200 ? "..." : ""}"` : "",
    "",
    "Please respond promptly to address this feedback.",
  ].filter(Boolean).join("\n");

  // In-app notification via notifyOwner
  if (settings.notifyInApp) {
    await notifyOwner({ title, content }).catch(() => {});
  }

  // Email notification
  if (settings.notifyEmail && settings.emailRecipients) {
    const emails = settings.emailRecipients.split(",").map((e: string) => e.trim()).filter(Boolean);
    for (const email of emails) {
      await dispatchEmail({
        to: email,
        subject: title,
        body: content.replace(/\n/g, "<br>"),
        accountId,
      }).catch(() => {});
    }
  }

  // SMS notification
  if (settings.notifySms && settings.smsRecipients) {
    const phones = settings.smsRecipients.split(",").map((p: string) => p.trim()).filter(Boolean);
    for (const phone of phones) {
      await dispatchSMS({
        to: phone,
        body: `${title}\n${review.reviewerName}: ${review.body?.slice(0, 100) || "No text"}`,
        accountId,
      }).catch(() => {});
    }
  }
}

/** Exported for testing */
export { checkAndFireReputationAlert };

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
      const result = await createReview({
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

      // Fire reputation alert if rating is at or below threshold
      try {
        await checkAndFireReputationAlert(input.accountId, {
          rating: input.rating,
          reviewerName: input.reviewerName || "Anonymous",
          platform: input.platform,
          body: input.body || "",
        });
      } catch {
        // Don't fail the review creation if alert fails
      }

      // Dispatch outbound webhook
      dispatchWebhookEvent(input.accountId, "review_received", {
        reviewId: result.id,
        platform: input.platform,
        rating: input.rating,
        reviewerName: input.reviewerName || null,
        body: input.body || null,
      }).catch(() => {});

      return result;
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

  // ═══════════════════════════════════════════════════════════════
  // GMB OAuth Connection Management
  // ═══════════════════════════════════════════════════════════════

  // ─── Get GMB Connection for account ─────────────────────────
  getGmbConnection: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId);
      const db = await getDb();
      if (!db) return null;
      const [conn] = await db
        .select()
        .from(gmbConnections)
        .where(eq(gmbConnections.accountId, input.accountId))
        .limit(1);
      if (!conn) return null;
      // Don't expose tokens to the frontend
      return {
        id: conn.id,
        googleEmail: conn.googleEmail,
        locationId: conn.locationId,
        locationName: conn.locationName,
        placeId: conn.placeId,
        autoSyncEnabled: conn.autoSyncEnabled,
        lastSyncAt: conn.lastSyncAt,
        status: conn.status,
        connectedAt: conn.connectedAt,
      };
    }),

  // ─── Save GMB Connection ────────────────────────────────────
  saveGmbConnection: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        googleEmail: z.string().email(),
        accessToken: z.string(),
        refreshToken: z.string().optional(),
        locationId: z.string().optional(),
        locationName: z.string().optional(),
        placeId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check if connection already exists
      const [existing] = await db
        .select()
        .from(gmbConnections)
        .where(eq(gmbConnections.accountId, input.accountId))
        .limit(1);

      if (existing) {
        // Update existing
        await db
          .update(gmbConnections)
          .set({
            googleEmail: input.googleEmail,
            accessToken: input.accessToken,
            refreshToken: input.refreshToken || existing.refreshToken,
            locationId: input.locationId || existing.locationId,
            locationName: input.locationName || existing.locationName,
            placeId: input.placeId || existing.placeId,
            status: "active",
            tokenExpiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour default
          })
          .where(eq(gmbConnections.id, existing.id));
        return { id: existing.id, updated: true };
      } else {
        // Create new
        const [result] = await db.insert(gmbConnections).values({
          accountId: input.accountId,
          googleEmail: input.googleEmail,
          accessToken: input.accessToken,
          refreshToken: input.refreshToken || null,
          locationId: input.locationId || null,
          locationName: input.locationName || null,
          placeId: input.placeId || null,
          tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
        });
        return { id: result.insertId, updated: false };
      }
    }),

  // ─── Update GMB Connection Settings ─────────────────────────
  updateGmbSettings: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        locationId: z.string().optional(),
        locationName: z.string().optional(),
        placeId: z.string().optional(),
        autoSyncEnabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId);
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const updateData: Record<string, unknown> = {};
      if (input.locationId !== undefined) updateData.locationId = input.locationId;
      if (input.locationName !== undefined) updateData.locationName = input.locationName;
      if (input.placeId !== undefined) updateData.placeId = input.placeId;
      if (input.autoSyncEnabled !== undefined) updateData.autoSyncEnabled = input.autoSyncEnabled;
      await db
        .update(gmbConnections)
        .set(updateData)
        .where(eq(gmbConnections.accountId, input.accountId));
      return { success: true };
    }),

  // ─── Disconnect GMB ─────────────────────────────────────────
  disconnectGmb: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId);
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .update(gmbConnections)
        .set({ status: "disconnected" })
        .where(eq(gmbConnections.accountId, input.accountId));
      return { success: true };
    }),

  // ─── Sync Reviews from GMB ──────────────────────────────────
  syncGmbReviews: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [conn] = await db
        .select()
        .from(gmbConnections)
        .where(
          and(
            eq(gmbConnections.accountId, input.accountId),
            eq(gmbConnections.status, "active")
          )
        )
        .limit(1);

      if (!conn) throw new Error("No active GMB connection found. Please connect your Google Business Profile first.");

      // In production, this would call the Google Business Profile API:
      // GET https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/reviews
      // For now, update lastSyncAt to indicate the sync was attempted
      await db
        .update(gmbConnections)
        .set({ lastSyncAt: new Date() })
        .where(eq(gmbConnections.id, conn.id));

      return {
        success: true,
        message: "Sync initiated. Reviews will appear once the Google Business Profile API is fully connected.",
        lastSyncAt: new Date(),
      };
    }),

  // ═══════════════════════════════════════════════════════════════
  // Review Response Posting
  // ═══════════════════════════════════════════════════════════════

  // ─── Post Reply to a Review ─────────────────────────────────
  postReply: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        reviewId: z.number(),
        replyBody: z.string().min(1).max(4096),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get the review
      const [review] = await db
        .select()
        .from(reviews)
        .where(
          and(
            eq(reviews.id, input.reviewId),
            eq(reviews.accountId, input.accountId)
          )
        )
        .limit(1);

      if (!review) throw new Error("Review not found");

      // For Google reviews: would call GMB API to post reply
      // PUT https://mybusiness.googleapis.com/v4/{reviewName}/reply
      // For Facebook: would call Graph API
      // POST https://graph.facebook.com/{review-id}/comments

      // Mark the reply as posted in our database
      await db
        .update(reviews)
        .set({
          replySent: true,
          replyBody: input.replyBody,
          repliedAt: new Date(),
          suggestedReply: review.suggestedReply || input.replyBody,
        })
        .where(eq(reviews.id, input.reviewId));

      return {
        success: true,
        message: review.platform === "google"
          ? "Reply posted. It will appear on your Google Business Profile once the API is fully connected."
          : review.platform === "facebook"
          ? "Reply posted. It will appear on your Facebook page once the API is fully connected."
          : "Reply saved. Manual posting may be required for this platform.",
      };
    }),

  // ═══════════════════════════════════════════════════════════════
  // Reputation Alert Settings
  // ═══════════════════════════════════════════════════════════════

  // ─── Get Alert Settings ─────────────────────────────────────
  getAlertSettings: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId);
      const db = await getDb();
      if (!db) return null;
      const [settings] = await db
        .select()
        .from(reputationAlertSettings)
        .where(eq(reputationAlertSettings.accountId, input.accountId))
        .limit(1);
      return settings || null;
    }),

  // ─── Save Alert Settings ────────────────────────────────────
  saveAlertSettings: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        enabled: z.boolean(),
        ratingThreshold: z.number().min(1).max(5).default(2),
        notifyEmail: z.boolean().default(true),
        notifySms: z.boolean().default(false),
        notifyInApp: z.boolean().default(true),
        emailRecipients: z.string().optional(),
        smsRecipients: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [existing] = await db
        .select()
        .from(reputationAlertSettings)
        .where(eq(reputationAlertSettings.accountId, input.accountId))
        .limit(1);

      if (existing) {
        await db
          .update(reputationAlertSettings)
          .set({
            enabled: input.enabled,
            ratingThreshold: input.ratingThreshold,
            notifyEmail: input.notifyEmail,
            notifySms: input.notifySms,
            notifyInApp: input.notifyInApp,
            emailRecipients: input.emailRecipients || null,
            smsRecipients: input.smsRecipients || null,
          })
          .where(eq(reputationAlertSettings.id, existing.id));
        return { id: existing.id, updated: true };
      } else {
        const [result] = await db.insert(reputationAlertSettings).values({
          accountId: input.accountId,
          enabled: input.enabled,
          ratingThreshold: input.ratingThreshold,
          notifyEmail: input.notifyEmail,
          notifySms: input.notifySms,
          notifyInApp: input.notifyInApp,
          emailRecipients: input.emailRecipients || null,
          smsRecipients: input.smsRecipients || null,
        });
        return { id: result.insertId, updated: false };
      }
    }),
});
