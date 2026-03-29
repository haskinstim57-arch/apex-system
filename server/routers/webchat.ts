import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import {
  createChatWidget,
  listChatWidgets,
  getChatWidgetById,
  updateChatWidget,
  deleteChatWidget,
  listWebchatSessions,
  getWebchatSessionById,
  listWebchatMessages,
  markWebchatMessagesAsRead,
  getUnreadWebchatCount,
  updateWebchatSession,
  createWebchatMessage,
  getMember,
  logContactActivity,
} from "../db";
import crypto from "crypto";

// ─── Tenant guard ───
async function requireAccountMember(
  userId: number,
  accountId: number,
  userRole?: string
) {
  if (userRole === "admin") {
    const member = await getMember(accountId, userId);
    if (member) return member;
    return { userId, accountId, role: "owner" as const, isActive: true };
  }
  const member = await getMember(accountId, userId);
  if (!member || !member.isActive) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this account",
    });
  }
  return member;
}

export const webchatRouter = router({
  // ─── Widget CRUD ───
  createWidget: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        name: z.string().min(1).max(255),
        greeting: z.string().max(2000).optional(),
        aiEnabled: z.boolean().optional().default(true),
        aiSystemPrompt: z.string().max(5000).optional(),
        handoffKeywords: z.string().max(1000).optional(),
        brandColor: z.string().max(20).optional().default("#6366f1"),
        position: z.enum(["bottom-right", "bottom-left"]).optional().default("bottom-right"),
        allowedDomains: z.string().max(2000).optional(),
        collectVisitorInfo: z.boolean().optional().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const widgetKey = crypto.randomBytes(16).toString("hex");
      const { id } = await createChatWidget({
        accountId: input.accountId,
        name: input.name,
        widgetKey,
        greeting: input.greeting ?? "Hi there! How can we help you today?",
        aiEnabled: input.aiEnabled,
        aiSystemPrompt: input.aiSystemPrompt ?? null,
        handoffKeywords: input.handoffKeywords ?? "agent,human,help,speak to someone,real person,representative",
        brandColor: input.brandColor,
        position: input.position,
        allowedDomains: input.allowedDomains ?? null,
        collectVisitorInfo: input.collectVisitorInfo,
        isActive: true,
        createdById: ctx.user.id,
      });
      return { id, widgetKey };
    }),

  listWidgets: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      return listChatWidgets(input.accountId);
    }),

  getWidget: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        widgetId: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const widget = await getChatWidgetById(input.widgetId, input.accountId);
      if (!widget) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Widget not found" });
      }
      return widget;
    }),

  updateWidget: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        widgetId: z.number().int().positive(),
        name: z.string().min(1).max(255).optional(),
        greeting: z.string().max(2000).optional(),
        aiEnabled: z.boolean().optional(),
        aiSystemPrompt: z.string().max(5000).nullish(),
        handoffKeywords: z.string().max(1000).optional(),
        brandColor: z.string().max(20).optional(),
        position: z.enum(["bottom-right", "bottom-left"]).optional(),
        allowedDomains: z.string().max(2000).nullish(),
        collectVisitorInfo: z.boolean().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const { accountId, widgetId, ...data } = input;
      await updateChatWidget(widgetId, accountId, data as any);
      return { success: true };
    }),

  deleteWidget: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        widgetId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      await deleteChatWidget(input.widgetId, input.accountId);
      return { success: true };
    }),

  // ─── Webchat Sessions (Inbox integration) ───
  listSessions: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        status: z.enum(["active", "closed"]).optional(),
        handoffOnly: z.boolean().optional(),
        limit: z.number().int().min(1).max(100).optional().default(50),
        offset: z.number().int().min(0).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      return listWebchatSessions(input.accountId, {
        status: input.status,
        handoffOnly: input.handoffOnly,
        limit: input.limit,
        offset: input.offset,
      });
    }),

  getSessionMessages: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        sessionId: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const session = await getWebchatSessionById(input.sessionId);
      if (!session || session.accountId !== input.accountId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }
      const messages = await listWebchatMessages(input.sessionId, input.accountId);
      return { session, messages };
    }),

  markSessionRead: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        sessionId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      await markWebchatMessagesAsRead(input.sessionId, input.accountId);
      return { success: true };
    }),

  getUnreadCount: protectedProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const count = await getUnreadWebchatCount(input.accountId);
      return { count };
    }),

  // ─── Agent takes over a webchat session ───
  takeOverSession: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        sessionId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const session = await getWebchatSessionById(input.sessionId);
      if (!session || session.accountId !== input.accountId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }
      await updateWebchatSession(input.sessionId, {
        agentTakenOver: true,
        agentUserId: ctx.user.id,
      });
      // Add a system message
      await createWebchatMessage({
        sessionId: input.sessionId,
        accountId: input.accountId,
        sender: "agent",
        content: "A human agent has joined the conversation.",
        isRead: true,
      });
      if (session.contactId) {
        logContactActivity({
          contactId: session.contactId,
          accountId: input.accountId,
          activityType: "webchat_handoff",
          description: "Human agent took over webchat conversation",
          metadata: JSON.stringify({
            sessionId: input.sessionId,
            agentUserId: ctx.user.id,
          }),
        });
      }
      return { success: true };
    }),

  // ─── Agent sends a reply in a webchat session ───
  sendAgentReply: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        sessionId: z.number().int().positive(),
        content: z.string().min(1).max(5000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      const session = await getWebchatSessionById(input.sessionId);
      if (!session || session.accountId !== input.accountId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }
      const { id } = await createWebchatMessage({
        sessionId: input.sessionId,
        accountId: input.accountId,
        sender: "agent",
        content: input.content,
        isRead: true,
      });
      return { id };
    }),

  // ─── Close a webchat session ───
  closeSession: protectedProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        sessionId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAccountMember(ctx.user.id, input.accountId, ctx.user.role);
      await updateWebchatSession(input.sessionId, { status: "closed" });
      return { success: true };
    }),
});
