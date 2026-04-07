/**
 * Jarvis Scheduled Task Worker
 *
 * Background worker that runs every 60 seconds, checks for due scheduled tasks,
 * and executes them via the Jarvis chat engine.
 */
import { getDb } from "../db";
import { jarvisScheduledTasks } from "../../drizzle/schema";
import { eq, and, lte, isNotNull } from "drizzle-orm";
import { CronExpressionParser } from "cron-parser";
import { chat, createSession } from "./jarvisService";
import { getUserById } from "../db";

const WORKER_INTERVAL_MS = 60_000; // 60 seconds

/**
 * Compute the next run time from a cron expression.
 * Returns null if the expression is invalid.
 */
function computeNextRunAt(cronExpression: string): Date | null {
  try {
    const interval = CronExpressionParser.parse(cronExpression);
    const next = interval.next();
    return next.toDate();
  } catch {
    return null;
  }
}

/**
 * Query for all active tasks whose nextRunAt <= now, execute them,
 * and update their rows with results.
 */
export async function runDueJarvisTasks(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const now = new Date();

  // Find all active tasks that are due
  const dueTasks = await db
    .select()
    .from(jarvisScheduledTasks)
    .where(
      and(
        eq(jarvisScheduledTasks.isActive, true),
        isNotNull(jarvisScheduledTasks.nextRunAt),
        lte(jarvisScheduledTasks.nextRunAt, now)
      )
    );

  if (dueTasks.length === 0) {
    return 0;
  }

  console.log(`[JarvisWorker] Found ${dueTasks.length} due task(s)`);

  let executed = 0;

  for (const task of dueTasks) {
    try {
      // Look up the user for the ChatContext
      const user = await getUserById(task.userId);
      const userName = user?.name || "Scheduled Task";

      // Create a temporary session for this task execution
      const session = await createSession(
        task.accountId,
        task.userId,
        `Scheduled: ${task.name}`
      );

      // Execute the task prompt via Jarvis chat
      const result = await chat(session.id, task.prompt, {
        accountId: task.accountId,
        userId: task.userId,
        userName,
      });

      // Compute the next run time
      const nextRunAt = computeNextRunAt(task.cronExpression);

      // Truncate result to 1000 chars
      const resultSummary = result.reply.length > 1000
        ? result.reply.substring(0, 997) + "..."
        : result.reply;

      // Update the task row
      await db
        .update(jarvisScheduledTasks)
        .set({
          lastRunAt: now,
          nextRunAt,
          lastRunResult: resultSummary,
          runCount: (task.runCount ?? 0) + 1,
        })
        .where(eq(jarvisScheduledTasks.id, task.id));

      console.log(
        `[JarvisWorker] ✅ Executed task "${task.name}" (ID ${task.id}) — tools: ${result.toolsUsed.join(", ") || "none"}`
      );
      executed++;
    } catch (err: any) {
      console.error(
        `[JarvisWorker] ❌ Failed task "${task.name}" (ID ${task.id}):`,
        err?.message || err
      );

      // Still update the task so it doesn't retry immediately
      const nextRunAt = computeNextRunAt(task.cronExpression);
      try {
        await db
          .update(jarvisScheduledTasks)
          .set({
            lastRunAt: now,
            nextRunAt,
            lastRunResult: `ERROR: ${(err?.message || "Unknown error").substring(0, 980)}`,
            runCount: (task.runCount ?? 0) + 1,
          })
          .where(eq(jarvisScheduledTasks.id, task.id));
      } catch {
        // Swallow DB update errors to not break the loop
      }
    }
  }

  return executed;
}

/**
 * Start the Jarvis task worker.
 * Runs immediately once, then every 60 seconds.
 */
export function startJarvisTaskWorker(): void {
  console.log("[JarvisWorker] Starting scheduled task worker (interval: 60s)");

  // Run immediately on startup
  runDueJarvisTasks()
    .then((count) => {
      console.log(`[JarvisWorker] Initial check — executed ${count} task(s)`);
    })
    .catch((err) => {
      console.error("[JarvisWorker] Initial check failed:", err?.message || err);
    });

  // Then run every 60 seconds
  setInterval(() => {
    runDueJarvisTasks()
      .then((count) => {
        if (count > 0) {
          console.log(`[JarvisWorker] Checked for due tasks — executed ${count}`);
        }
      })
      .catch((err) => {
        console.error("[JarvisWorker] Check failed:", err?.message || err);
      });
  }, WORKER_INTERVAL_MS);
}
