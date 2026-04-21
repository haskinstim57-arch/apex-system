import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { requireAccountMember } from "./contacts";
import {
  createSession,
  getSession,
  listSessions,
  deleteSession,
  chat,
} from "../services/jarvisService";
import { transcribeAudio } from "../_core/voiceTranscription";
import { storagePut } from "../storage";
import { invokeGeminiWithRetry } from "../services/gemini";
import {
  getAccountDashboardStats,
  getContactStats,
  getMessageStats,
  listCampaigns,
  getGeminiUsageStats,
  getDb,
} from "../db";
import { jarvisToolUsage, jarvisScheduledTasks, jarvisTaskQueue, contacts } from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export const jarvisRouter = router({
  /** List all conversation sessions for the current user */
  listSessions: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      return listSessions(input.accountId, ctx.user.id);
    }),

  /** Create a new conversation session */
  createSession: protectedProcedure
    .input(z.object({ accountId: z.number(), title: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      return createSession(input.accountId, ctx.user.id, input.title);
    }),

  /** Get a session with full message history */
  getSession: protectedProcedure
    .input(z.object({ accountId: z.number(), sessionId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const session = await getSession(input.sessionId, input.accountId);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      if (session.userId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your session" });
      }
      return session;
    }),

  /** Send a message and get AI response */
  chat: protectedProcedure
    .input(z.object({
      accountId: z.number(),
      sessionId: z.number(),
      message: z.string().min(1).max(4000),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      return chat(input.sessionId, input.message, {
        accountId: input.accountId,
        userId: ctx.user.id,
        userName: ctx.user.name || "User",
      });
    }),

  /** Delete a conversation session */
  deleteSession: protectedProcedure
    .input(z.object({ accountId: z.number(), sessionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const session = await getSession(input.sessionId, input.accountId);
      if (session && session.userId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your session" });
      }
      await deleteSession(input.sessionId, input.accountId);
      return { success: true };
    }),

  /** Get page-context-aware recommendations powered by LLM + real CRM data */
  getRecommendations: protectedProcedure
    .input(z.object({
      accountId: z.number(),
      pageContext: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      type Suggestion = {
        title: string;
        description: string;
        prompt: string;
        priority: "high" | "medium" | "low";
      };

      // ── Gather real CRM data snapshot for context ──
      let dataSnapshot = "";
      try {
        const [dashStats, contactStats, messageStats, campaigns] = await Promise.allSettled([
          getAccountDashboardStats(input.accountId),
          getContactStats(input.accountId),
          getMessageStats(input.accountId),
          listCampaigns(input.accountId, {}),
        ]);

        const ds = dashStats.status === "fulfilled" ? dashStats.value : null;
        const cs = contactStats.status === "fulfilled" ? contactStats.value : null;
        const ms = messageStats.status === "fulfilled" ? messageStats.value : null;
        const cp = campaigns?.status === "fulfilled" ? campaigns.value : null;

        const parts: string[] = [];
        if (ds) parts.push(`Dashboard: ${JSON.stringify(ds)}`);
        if (cs) parts.push(`Contacts: total=${cs.total}, new=${cs.new}, qualified=${cs.qualified}, won=${cs.won}`);
        if (ms) parts.push(`Messages: total=${ms.total}, sent=${ms.sent}, delivered=${ms.delivered}, failed=${ms.failed}, emails=${ms.emails}, sms=${ms.sms}`);

        if (cp) {
          const campList = Array.isArray(cp) ? cp : (cp as any).data || [];
          parts.push(`Campaigns (${campList.length}): ${JSON.stringify(campList.slice(0, 5).map((c: any) => ({
            name: c.name,
            status: c.status,
            type: c.type,
          })))}`);
        }
        dataSnapshot = parts.join("\n");
      } catch {
        dataSnapshot = "Unable to fetch CRM data snapshot.";
      }

      // ── Ask LLM to generate personalized suggestions ──
      try {
        const result = await invokeGeminiWithRetry({
          messages: [
            {
              role: "system",
              content: `You are Jarvis, an AI assistant for a CRM platform used by loan officers. Generate exactly 4 personalized, actionable suggestions based on the user's real CRM data and the page they are currently viewing.

Each suggestion must be something the user can execute RIGHT NOW through Jarvis's CRM tools (search contacts, send SMS/email, check pipeline, manage workflows, view stats, schedule appointments, etc.).

Rules:
- Be specific and data-driven. Reference actual numbers from the data snapshot.
- Prioritize high-impact actions (follow-ups, stale deals, uncontacted leads).
- The "prompt" field should be a natural language instruction that Jarvis can execute.
- Priority: "high" = urgent/impactful, "medium" = useful, "low" = nice to have.
- Keep titles under 30 chars, descriptions under 80 chars.
- Do NOT suggest actions outside Jarvis's capabilities.`,
            },
            {
              role: "user",
              content: `Current page: ${input.pageContext}
User: ${ctx.user.name || "User"}

CRM Data Snapshot:
${dataSnapshot || "No data available yet — this is a new or empty account."}

Generate 4 suggestions as JSON array.`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "suggestions",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Short action title (under 30 chars)" },
                        description: { type: "string", description: "Brief description (under 80 chars)" },
                        prompt: { type: "string", description: "Natural language instruction for Jarvis to execute" },
                        priority: { type: "string", enum: ["high", "medium", "low"], description: "Priority level" },
                      },
                      required: ["title", "description", "prompt", "priority"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["suggestions"],
                additionalProperties: false,
              },
            },
          },
          _tracking: { accountId: input.accountId, userId: ctx.user.id, endpoint: "recommendations" },
        });

        const content = result?.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(typeof content === "string" ? content : "");
          if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
            return parsed.suggestions.slice(0, 4) as Suggestion[];
          }
        }
      } catch (err) {
        console.error("[Jarvis] LLM suggestions failed, falling back to static:", err);
      }

      // ── Fallback: static context-based suggestions ──
      const fallbacks: Record<string, Suggestion[]> = {
        dashboard: [
          { title: "Pipeline Summary", description: "Get a quick overview of your deals and conversion rates", prompt: "Show me my pipeline summary with deal counts per stage", priority: "high" },
          { title: "Today's Follow-ups", description: "See which contacts need attention today", prompt: "Which contacts should I follow up with today?", priority: "high" },
          { title: "Campaign Performance", description: "Review how your active campaigns are performing", prompt: "Show me the performance stats for my active campaigns", priority: "medium" },
        ],
        contacts: [
          { title: "Uncontacted Leads", description: "Find leads that haven't been reached out to yet", prompt: "Find contacts created in the last 7 days with no messages sent", priority: "high" },
          { title: "Hot Leads", description: "Identify your highest-scoring leads", prompt: "Show me my top 10 contacts sorted by lead score", priority: "high" },
          { title: "Contact Cleanup", description: "Find incomplete contact records", prompt: "Find contacts missing email or phone numbers", priority: "medium" },
        ],
        inbox: [
          { title: "Unread Messages", description: "Check for messages that need a response", prompt: "Show me the latest messages that haven't been responded to", priority: "high" },
          { title: "Message Stats", description: "See your messaging activity and delivery rates", prompt: "Show me my message stats", priority: "medium" },
        ],
        pipeline: [
          { title: "Deal Overview", description: "See all deals organized by pipeline stage", prompt: "Show me a pipeline overview with deal counts per stage", priority: "high" },
          { title: "Stale Deals", description: "Find deals stuck in the same stage", prompt: "Find deals that haven't moved in over 14 days", priority: "high" },
        ],
        campaigns: [
          { title: "Campaign Stats", description: "Review performance of your campaigns", prompt: "Show me detailed stats for all my campaigns", priority: "high" },
          { title: "Sequence Overview", description: "Check active sequences and enrollment", prompt: "Show me all active sequences and enrollment counts", priority: "medium" },
        ],
        automations: [
          { title: "Active Workflows", description: "See which automations are currently running", prompt: "List all active workflows and their triggers", priority: "high" },
        ],
        calendar: [
          { title: "Today's Appointments", description: "See what's on your calendar today", prompt: "Show me all appointments scheduled for today", priority: "high" },
          { title: "Available Slots", description: "Check your availability for scheduling", prompt: "What are my available time slots for the next 3 days?", priority: "medium" },
        ],
      };

      return fallbacks[input.pageContext] || [
        { title: "Quick Stats", description: "Get an overview of your account", prompt: "Show me my dashboard stats", priority: "high" as const },
        { title: "Recent Contacts", description: "See your newest leads", prompt: "Show me the 5 most recently created contacts", priority: "medium" as const },
        { title: "Send a Message", description: "Reach out to a contact", prompt: "Help me send a message to a contact", priority: "medium" as const },
      ];
    }),

  // ── Gemini API Usage Stats (admin only) ──
  getUsageStats: protectedProcedure
    .input(z.object({
      accountId: z.number().optional(),
      days: z.number().optional().default(30),
    }))
    .query(async ({ ctx, input }) => {
      // Only admin can view usage stats
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      return getGeminiUsageStats({
        accountId: input.accountId,
        days: input.days,
      });
    }),

  /** Transcribe voice audio to text */
  transcribeVoice: protectedProcedure
    .input(z.object({
      audioBase64: z.string().min(1),
      mimeType: z.string().default("audio/webm"),
      language: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Decode base64 to buffer
      const audioBuffer = Buffer.from(input.audioBase64, "base64");

      // Check size (16MB limit)
      const sizeMB = audioBuffer.length / (1024 * 1024);
      if (sizeMB > 16) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Audio file is ${sizeMB.toFixed(1)}MB — maximum is 16MB`,
        });
      }

      // Upload to S3 with a unique key
      const ext = input.mimeType === "audio/webm" ? "webm" : input.mimeType === "audio/mp4" ? "m4a" : "webm";
      const fileKey = `voice-transcriptions/${ctx.user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { url: audioUrl } = await storagePut(fileKey, audioBuffer, input.mimeType);

      // Transcribe
      const result = await transcribeAudio({
        audioUrl,
        language: input.language,
        prompt: "Transcribe the user's voice message for a CRM assistant",
      });

      if ("error" in result) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error,
        });
      }

      return { text: result.text, language: result.language, duration: result.duration };
    }),

  // ═══════════════════════════════════════════════
  // TOOL USAGE ANALYTICS
  // ═══════════════════════════════════════════════

  /** Track a tool usage event (called from jarvisService after tool execution) */
  trackToolUsage: protectedProcedure
    .input(z.object({ accountId: z.number(), toolName: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = (await getDb())!;
      // Upsert: increment count or insert new row
      const existing = await db.select().from(jarvisToolUsage)
        .where(and(
          eq(jarvisToolUsage.accountId, input.accountId),
          eq(jarvisToolUsage.toolName, input.toolName)
        ));
      if (existing.length > 0) {
        await db.update(jarvisToolUsage)
          .set({
            usageCount: sql`${jarvisToolUsage.usageCount} + 1`,
            lastUsedAt: new Date(),
          })
          .where(eq(jarvisToolUsage.id, existing[0].id));
      } else {
        await db.insert(jarvisToolUsage).values({
          accountId: input.accountId,
          toolName: input.toolName,
          usageCount: 1,
          lastUsedAt: new Date(),
        });
      }
      return { success: true };
    }),

  /** Get tool usage analytics for the account */
  getToolUsageStats: protectedProcedure
    .input(z.object({ accountId: z.number(), limit: z.number().min(1).max(50).default(10) }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = (await getDb())!;
      const stats = await db.select().from(jarvisToolUsage)
        .where(eq(jarvisToolUsage.accountId, input.accountId))
        .orderBy(desc(jarvisToolUsage.usageCount))
        .limit(input.limit);
      const totalUsage = stats.reduce((sum: number, s: typeof stats[number]) => sum + s.usageCount, 0);
      return { stats, totalUsage };
    }),

  // ═══════════════════════════════════════════════
  // SCHEDULED TASKS
  // ═══════════════════════════════════════════════

  /** List all scheduled tasks for the account */
  listScheduledTasks: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = (await getDb())!;
      return db.select().from(jarvisScheduledTasks)
        .where(eq(jarvisScheduledTasks.accountId, input.accountId))
        .orderBy(desc(jarvisScheduledTasks.createdAt));
    }),

  /** Create a scheduled task */
  createScheduledTask: protectedProcedure
    .input(z.object({
      accountId: z.number(),
      name: z.string().min(1).max(255),
      prompt: z.string().min(1),
      scheduleDescription: z.string().min(1).max(255),
      cronExpression: z.string().min(1).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = (await getDb())!;
      const [result] = await db.insert(jarvisScheduledTasks).values({
        accountId: input.accountId,
        userId: ctx.user.id,
        name: input.name,
        prompt: input.prompt,
        scheduleDescription: input.scheduleDescription,
        cronExpression: input.cronExpression,
        isActive: true,
      });
      return { id: result.insertId };
    }),

  /** Toggle a scheduled task active/inactive */
  toggleScheduledTask: protectedProcedure
    .input(z.object({ accountId: z.number(), taskId: z.number(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = (await getDb())!;
      await db.update(jarvisScheduledTasks)
        .set({ isActive: input.isActive })
        .where(and(
          eq(jarvisScheduledTasks.id, input.taskId),
          eq(jarvisScheduledTasks.accountId, input.accountId)
        ));
      return { success: true };
    }),

  /** Delete a scheduled task */
  deleteScheduledTask: protectedProcedure
    .input(z.object({ accountId: z.number(), taskId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = (await getDb())!;
      await db.delete(jarvisScheduledTasks)
        .where(and(
          eq(jarvisScheduledTasks.id, input.taskId),
          eq(jarvisScheduledTasks.accountId, input.accountId)
        ));
      return { success: true };
    }),

  // ── Jarvis Task Queue (auto-enqueued tasks) ──

  /** List pending tasks for the account */
  listPendingTasks: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = (await getDb())!;
      const tasks = await db
        .select({
          id: jarvisTaskQueue.id,
          accountId: jarvisTaskQueue.accountId,
          contactId: jarvisTaskQueue.contactId,
          taskType: jarvisTaskQueue.taskType,
          status: jarvisTaskQueue.status,
          payload: jarvisTaskQueue.payload,
          createdAt: jarvisTaskQueue.createdAt,
          contactFirstName: contacts.firstName,
          contactLastName: contacts.lastName,
          contactEmail: contacts.email,
          contactPhone: contacts.phone,
        })
        .from(jarvisTaskQueue)
        .leftJoin(contacts, eq(jarvisTaskQueue.contactId, contacts.id))
        .where(
          and(
            eq(jarvisTaskQueue.accountId, input.accountId),
            eq(jarvisTaskQueue.status, "pending")
          )
        )
        .orderBy(desc(jarvisTaskQueue.createdAt))
        .limit(50);
      return tasks;
    }),

  /** Execute a pending task */
  executeTask: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive(), taskId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = (await getDb())!;
      const [task] = await db
        .select()
        .from(jarvisTaskQueue)
        .where(
          and(
            eq(jarvisTaskQueue.id, input.taskId),
            eq(jarvisTaskQueue.accountId, input.accountId),
            eq(jarvisTaskQueue.status, "pending")
          )
        )
        .limit(1);
      if (!task) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found or already processed" });
      }
      // Execute based on task type
      if (task.taskType === "send_application_link") {
        const { executeJarvisTool } = await import("../services/jarvisTools");
        await executeJarvisTool(
          "send_application_link",
          { contactId: task.contactId },
          { accountId: input.accountId, userId: ctx.user.id }
        );
      }
      // Mark as completed
      await db
        .update(jarvisTaskQueue)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(jarvisTaskQueue.id, input.taskId));
      return { success: true };
    }),

  /** Dismiss a pending task */
  dismissTask: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive(), taskId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const db = (await getDb())!;
      await db
        .update(jarvisTaskQueue)
        .set({ status: "dismissed", completedAt: new Date() })
        .where(
          and(
            eq(jarvisTaskQueue.id, input.taskId),
            eq(jarvisTaskQueue.accountId, input.accountId)
          )
        );
      return { success: true };
    }),
});
