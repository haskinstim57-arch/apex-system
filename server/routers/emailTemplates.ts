import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  createEmailTemplate,
  listEmailTemplates,
  getEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  getMember,
} from "../db";

// ─────────────────────────────────────────────
// Email Templates Router
// ─────────────────────────────────────────────

/** Ensure user has access to the account */
async function ensureAccountAccess(userId: number, accountId: number, role: string) {
  if (role === "admin") return; // admins can access all accounts
  const member = await getMember(userId, accountId);
  if (!member) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this account" });
  }
}

export const emailTemplatesRouter = router({
  list: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ ctx, input }) => {
      await ensureAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      return listEmailTemplates(input.accountId);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const template = await getEmailTemplate(input.id);
      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }
      await ensureAccountAccess(ctx.user.id, template.accountId, ctx.user.role);
      return template;
    }),

  create: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        name: z.string().min(1).max(255),
        subject: z.string().max(500).default(""),
        htmlContent: z.string().optional(),
        jsonBlocks: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureAccountAccess(ctx.user.id, input.accountId, ctx.user.role);
      const { id } = await createEmailTemplate({
        accountId: input.accountId,
        name: input.name,
        subject: input.subject,
        htmlContent: input.htmlContent ?? null,
        jsonBlocks: input.jsonBlocks ?? null,
      });
      return { id };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        subject: z.string().max(500).optional(),
        htmlContent: z.string().optional(),
        jsonBlocks: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await getEmailTemplate(input.id);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }
      await ensureAccountAccess(ctx.user.id, existing.accountId, ctx.user.role);
      const { id, ...updates } = input;
      await updateEmailTemplate(id, updates);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await getEmailTemplate(input.id);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }
      await ensureAccountAccess(ctx.user.id, existing.accountId, ctx.user.role);
      await deleteEmailTemplate(input.id);
      return { success: true };
    }),
});
