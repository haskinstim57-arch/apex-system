/**
 * Google My Business / Google Business Profile API integration
 *
 * This service handles:
 * 1. Fetching reviews from Google Business Profile
 * 2. Generating review request URLs
 * 3. Generating AI-powered reply suggestions
 *
 * NOTE: Full GMB API integration requires OAuth2 credentials from the
 * Google Cloud Console. For now, this provides a structured service layer
 * that can be connected to the live API when credentials are configured.
 * Reviews can also be manually added or imported via CSV.
 */

import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../db";
import { reviews, reviewRequests, type InsertReview, type InsertReviewRequest } from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";

// ─── Review URL Generators ───────────────────────────────────────

/**
 * Generate a Google review URL for a business
 * Format: https://search.google.com/local/writereview?placeid=PLACE_ID
 */
export function getGoogleReviewUrl(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

/**
 * Generate a Facebook review URL for a business page
 * Format: https://www.facebook.com/PAGE_ID/reviews
 */
export function getFacebookReviewUrl(pageId: string): string {
  return `https://www.facebook.com/${encodeURIComponent(pageId)}/reviews`;
}

/**
 * Generate a Yelp review URL
 * Format: https://www.yelp.com/writeareview/biz/BUSINESS_ID
 */
export function getYelpReviewUrl(businessId: string): string {
  return `https://www.yelp.com/writeareview/biz/${encodeURIComponent(businessId)}`;
}

/**
 * Generate a Zillow review URL
 * Format: https://www.zillow.com/reviews/write/?screenname=SCREEN_NAME
 */
export function getZillowReviewUrl(screenName: string): string {
  return `https://www.zillow.com/reviews/write/?screenname=${encodeURIComponent(screenName)}`;
}

/**
 * Get the review URL for a given platform and business identifier
 */
export function getReviewUrl(platform: string, businessId: string): string {
  switch (platform) {
    case "google":
      return getGoogleReviewUrl(businessId);
    case "facebook":
      return getFacebookReviewUrl(businessId);
    case "yelp":
      return getYelpReviewUrl(businessId);
    case "zillow":
      return getZillowReviewUrl(businessId);
    default:
      return "";
  }
}

// ─── Review CRUD ─────────────────────────────────────────────────

/**
 * Create a new review record
 */
export async function createReview(data: InsertReview) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(reviews).values(data);
  return { id: result.insertId };
}

/**
 * Get all reviews for an account, ordered by most recent
 */
export async function getReviewsByAccount(accountId: number, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(reviews)
    .where(eq(reviews.accountId, accountId))
    .orderBy(desc(reviews.postedAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get review stats for an account
 */
export async function getReviewStats(accountId: number) {
  const db = await getDb();
  if (!db) return { total: 0, avgRating: 0, byPlatform: {}, byRating: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
  const allReviews = await db
    .select({ rating: reviews.rating, platform: reviews.platform })
    .from(reviews)
    .where(eq(reviews.accountId, accountId));

  const total = allReviews.length;
  const avgRating = total > 0
    ? Math.round((allReviews.reduce((sum, r) => sum + r.rating, 0) / total) * 10) / 10
    : 0;

  // Count by platform
  const byPlatform: Record<string, { count: number; avgRating: number }> = {};
  for (const r of allReviews) {
    if (!byPlatform[r.platform]) {
      byPlatform[r.platform] = { count: 0, avgRating: 0 };
    }
    byPlatform[r.platform].count++;
  }
  // Calculate per-platform averages
  for (const platform of Object.keys(byPlatform)) {
    const platformReviews = allReviews.filter((r: { rating: number; platform: string }) => r.platform === platform);
    byPlatform[platform].avgRating =
      Math.round(
        (platformReviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / platformReviews.length) * 10
      ) / 10;
  }

  // Count by rating
  const byRating: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of allReviews) {
    byRating[r.rating] = (byRating[r.rating] || 0) + 1;
  }

  return { total, avgRating, byPlatform, byRating };
}

// ─── Review Requests ─────────────────────────────────────────────

/**
 * Create a review request record
 */
export async function createReviewRequest(data: InsertReviewRequest) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(reviewRequests).values(data);
  return { id: result.insertId };
}

/**
 * Get review requests for an account
 */
export async function getReviewRequestsByAccount(accountId: number, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(reviewRequests)
    .where(eq(reviewRequests.accountId, accountId))
    .orderBy(desc(reviewRequests.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Update review request status
 */
export async function updateReviewRequestStatus(
  id: number,
  status: "pending" | "sent" | "clicked" | "completed" | "failed",
  extra?: { sentAt?: Date; clickedAt?: Date; completedAt?: Date }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(reviewRequests)
    .set({ status, ...extra })
    .where(eq(reviewRequests.id, id));
}

/**
 * Get review request stats for an account
 */
export async function getReviewRequestStats(accountId: number) {
  const db = await getDb();
  if (!db) return { total: 0, sent: 0, clicked: 0, completed: 0, failed: 0, clickRate: 0, completionRate: 0 };
  const allRequests = await db
    .select({ status: reviewRequests.status, platform: reviewRequests.platform })
    .from(reviewRequests)
    .where(eq(reviewRequests.accountId, accountId));

  const total = allRequests.length;
  type ReqRow = { status: string; platform: string };
  const sent = allRequests.filter((r: ReqRow) => r.status !== "pending" && r.status !== "failed").length;
  const clicked = allRequests.filter((r: ReqRow) => r.status === "clicked" || r.status === "completed").length;
  const completed = allRequests.filter((r: ReqRow) => r.status === "completed").length;
  const failed = allRequests.filter((r: ReqRow) => r.status === "failed").length;
  const clickRate = sent > 0 ? Math.round((clicked / sent) * 100) : 0;
  const completionRate = sent > 0 ? Math.round((completed / sent) * 100) : 0;

  return { total, sent, clicked, completed, failed, clickRate, completionRate };
}

// ─── AI Reply Suggestions ────────────────────────────────────────

/**
 * Generate an AI-powered reply suggestion for a review
 */
export async function generateReplySuggestion(
  reviewBody: string,
  rating: number,
  reviewerName: string,
  businessName: string
): Promise<string> {
  try {
    const sentiment = rating >= 4 ? "positive" : rating >= 3 ? "neutral" : "negative";
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a professional reputation manager for "${businessName}". Generate a concise, warm, and professional reply to a ${sentiment} review. Keep it under 100 words. Be genuine and specific to what the reviewer mentioned. For negative reviews, acknowledge concerns, apologize, and offer to make it right. Never be defensive.`,
        },
        {
          role: "user",
          content: `Review from ${reviewerName} (${rating}/5 stars):\n"${reviewBody}"\n\nWrite a professional reply:`,
        },
      ],
    });
    const content = response.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : "Thank you for your review!";
  } catch {
    return "Thank you for taking the time to leave a review. We appreciate your feedback!";
  }
}
