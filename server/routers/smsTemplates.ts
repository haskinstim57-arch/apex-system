import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  createSmsTemplate,
  listSmsTemplates,
  getSmsTemplate,
  updateSmsTemplate,
  deleteSmsTemplate,
  getMember,
} from "../db";

// ─────────────────────────────────────────────
// SMS Templates Router
// ─────────────────────────────────────────────

/** Ensure user has access to the account */
async function ensureAccountAccess(userId: number, accountId: number, role: string) {
  if (role === "admin") return;
  const member = await getMember(userId, accountId);
  if (!member) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this account" });
  }
}

export const smsTemplatesRouter = router({
  list: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ ctx, input }) => {
      await ensureAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      return listSmsTemplates(input.accountId);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const template = await getSmsTemplate(input.id);
      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "SMS template not found" });
      }
      await ensureAccountAccess(ctx.user.id, template.accountId, ctx.user.role);
      return template;
    }),

  create: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        name: z.string().min(1).max(255),
        body: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      const { id } = await createSmsTemplate({
        accountId: input.accountId,
        name: input.name,
        body: input.body,
      });
      return { id };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        body: z.string().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await getSmsTemplate(input.id);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "SMS template not found" });
      }
      await ensureAccountAccess(ctx.user.id, existing.accountId, ctx.user.role);
      const { id, ...updates } = input;
      await updateSmsTemplate(id, updates);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await getSmsTemplate(input.id);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "SMS template not found" });
      }
      await ensureAccountAccess(ctx.user.id, existing.accountId, ctx.user.role);
      await deleteSmsTemplate(input.id);
      return { success: true };
    }),
});
