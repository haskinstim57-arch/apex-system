import { eq, and, inArray } from "drizzle-orm";
import { contacts } from "../../drizzle/schema";
import { getDb } from "../db";

/**
 * Promotes a contact from new/uncontacted → contacted when an outbound
 * message has been sent to them. No-op if their status is already further
 * along the funnel (e.g. qualified, appointment_set, etc.).
 *
 * Safe to call from every send path — the inArray guard ensures we never
 * regress a contact that has already progressed past "contacted".
 */
export async function autoPromoteOnOutbound(contactId: number): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db
      .update(contacts)
      .set({ status: "contacted" })
      .where(
        and(
          eq(contacts.id, contactId),
          inArray(contacts.status, ["new", "uncontacted"])
        )
      );
  } catch (err) {
    // Non-critical — log but never let a status update failure
    // break the send path that called us.
    console.error("[autoPromoteOnOutbound] Failed to update contact status:", err);
  }
}
