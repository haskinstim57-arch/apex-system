/**
 * Sequence Activation Worker — checks for draft sequences with a due activateAt
 * and activates them automatically. Runs every 5 minutes.
 */
import { getDb } from "../db";
import { sequences } from "../../drizzle/schema";
import { eq, and, lte, isNotNull, sql } from "drizzle-orm";

export async function activateDueSequences(): Promise<{ activated: number }> {
  const db = await getDb();
  if (!db) return { activated: 0 };

  try {
    const now = new Date();
    // Find all draft sequences with activateAt <= now
    const dueSequences = await db
      .select({ id: sequences.id, name: sequences.name })
      .from(sequences)
      .where(
        and(
          eq(sequences.status, "draft"),
          isNotNull(sequences.activateAt),
          lte(sequences.activateAt, now)
        )
      );

    if (dueSequences.length === 0) return { activated: 0 };

    // Activate them: set status = 'active', activateAt = null
    for (const seq of dueSequences) {
      await db
        .update(sequences)
        .set({ status: "active", activateAt: null })
        .where(eq(sequences.id, seq.id));
      console.log(`[SequenceActivation] Activated sequence "${seq.name}" (id=${seq.id})`);
    }

    console.log(`[SequenceActivation] Activated ${dueSequences.length} sequences`);
    return { activated: dueSequences.length };
  } catch (err: any) {
    console.error("[SequenceActivation] Error:", err.message);
    return { activated: 0 };
  }
}

export function startSequenceActivationWorker(): void {
  // Check every 5 minutes
  setInterval(activateDueSequences, 5 * 60 * 1000);
  // Run immediately on startup
  activateDueSequences();
  console.log("[SequenceActivation] Worker started (interval: 5 min)");
}
