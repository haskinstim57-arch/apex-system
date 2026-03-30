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
import { invokeLLM } from "../_core/llm";

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

  /** Get page-context-aware recommendations for the Suggestions tab */
  getRecommendations: protectedProcedure
    .input(z.object({
      accountId: z.number(),
      pageContext: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);

      const contextPrompts: Record<string, { suggestions: Array<{ title: string; description: string; prompt: string; priority: "high" | "medium" | "low" }> }> = {
        dashboard: {
          suggestions: [
            { title: "Pipeline Summary", description: "Get a quick overview of your deals and conversion rates", prompt: "Show me my pipeline summary with deal counts per stage and overall conversion rate", priority: "high" },
            { title: "Today's Follow-ups", description: "See which contacts need attention today", prompt: "Which contacts should I follow up with today? Check for any overdue tasks or recent leads", priority: "high" },
            { title: "Campaign Performance", description: "Review how your active campaigns are performing", prompt: "Show me the performance stats for my active campaigns", priority: "medium" },
            { title: "Weekly Activity Report", description: "Summarize messages sent, calls made, and deals moved this week", prompt: "Give me a weekly activity report: messages sent, contacts created, and deals moved", priority: "low" },
          ],
        },
        contacts: {
          suggestions: [
            { title: "Uncontacted Leads", description: "Find leads that haven't been reached out to yet", prompt: "Find contacts that were created in the last 7 days but have no messages sent to them", priority: "high" },
            { title: "Hot Leads", description: "Identify your highest-scoring leads", prompt: "Show me my top 10 contacts sorted by lead score", priority: "high" },
            { title: "Bulk Tag Contacts", description: "Organize contacts by adding tags to groups", prompt: "What tags are currently in use? Show me a summary of contacts per tag", priority: "medium" },
            { title: "Contact Cleanup", description: "Find duplicate or incomplete contact records", prompt: "Find contacts that are missing email addresses or phone numbers", priority: "low" },
          ],
        },
        inbox: {
          suggestions: [
            { title: "Unread Messages", description: "Check for messages that need a response", prompt: "Show me the latest messages that haven't been responded to", priority: "high" },
            { title: "Quick Reply Templates", description: "Send a follow-up message to a recent lead", prompt: "Draft a follow-up SMS for my most recent inbound lead", priority: "medium" },
            { title: "Message Stats", description: "See your messaging activity and delivery rates", prompt: "Show me my message stats: total sent, delivered, and response rates", priority: "low" },
          ],
        },
        campaigns: {
          suggestions: [
            { title: "Campaign Stats", description: "Review performance of your campaigns", prompt: "Show me detailed stats for all my campaigns including open rates and click rates", priority: "high" },
            { title: "Audience Segments", description: "Review your contact segments for targeting", prompt: "List all my contact segments with their sizes", priority: "medium" },
            { title: "Sequence Overview", description: "Check the status of your active sequences", prompt: "Show me all active sequences and how many contacts are enrolled in each", priority: "medium" },
          ],
        },
        pipeline: {
          suggestions: [
            { title: "Deal Overview", description: "See all deals organized by pipeline stage", prompt: "Show me a pipeline overview with deal counts and values per stage", priority: "high" },
            { title: "Stale Deals", description: "Find deals that haven't moved in a while", prompt: "Find deals that have been in the same stage for more than 14 days", priority: "high" },
            { title: "Move Deals", description: "Advance deals to the next stage", prompt: "Show me deals in the first stage that are ready to move forward", priority: "medium" },
          ],
        },
        automations: {
          suggestions: [
            { title: "Active Workflows", description: "See which automations are currently running", prompt: "List all active workflows and their trigger conditions", priority: "high" },
            { title: "Trigger a Workflow", description: "Manually trigger a workflow for a specific contact", prompt: "Show me available workflows I can trigger manually", priority: "medium" },
          ],
        },
        calendar: {
          suggestions: [
            { title: "Today's Appointments", description: "See what's on your calendar today", prompt: "Show me all appointments scheduled for today", priority: "high" },
            { title: "Available Slots", description: "Check your availability for scheduling", prompt: "What are my available time slots for the next 3 days?", priority: "medium" },
            { title: "Schedule a Meeting", description: "Book an appointment with a contact", prompt: "Help me schedule a meeting with a contact", priority: "medium" },
          ],
        },
        analytics: {
          suggestions: [
            { title: "Dashboard Stats", description: "Get a comprehensive overview of your account metrics", prompt: "Show me my dashboard stats: total contacts, messages, deals, and campaigns", priority: "high" },
            { title: "Contact Growth", description: "See how your contact list is growing", prompt: "Show me contact stats including total contacts and recent additions", priority: "medium" },
          ],
        },
        "ai-calls": {
          suggestions: [
            { title: "Call Summary", description: "Review recent AI call activity", prompt: "Show me a summary of recent AI calls and their outcomes", priority: "high" },
          ],
        },
        "power-dialer": {
          suggestions: [
            { title: "Dialer Queue", description: "Check contacts queued for power dialing", prompt: "Show me contacts that are ready for power dialing", priority: "high" },
          ],
        },
      };

      const pageData = contextPrompts[input.pageContext];
      if (pageData) return pageData.suggestions;

      // Fallback: generic suggestions
      return [
        { title: "Quick Stats", description: "Get an overview of your account", prompt: "Show me my dashboard stats", priority: "high" as const },
        { title: "Recent Contacts", description: "See your newest leads", prompt: "Show me the 5 most recently created contacts", priority: "medium" as const },
        { title: "Send a Message", description: "Reach out to a contact", prompt: "Help me send a message to a contact", priority: "medium" as const },
      ];
    }),
});
