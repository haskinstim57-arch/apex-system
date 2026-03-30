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
});
