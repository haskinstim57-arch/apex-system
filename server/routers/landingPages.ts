import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  createLandingPage,
  listLandingPages,
  getLandingPage,
  updateLandingPage,
  deleteLandingPage,
} from "../db";

export const landingPagesRouter = router({
  list: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ input }) => {
      return listLandingPages(input.accountId);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number(), accountId: z.number() }))
    .query(async ({ input }) => {
      const page = await getLandingPage(input.id, input.accountId);
      if (!page) throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });
      return page;
    }),

  create: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        title: z.string().min(1),
        slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
        metaDescription: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const id = await createLandingPage({
        accountId: input.accountId,
        title: input.title,
        slug: input.slug,
        metaDescription: input.metaDescription ?? null,
        htmlContent: "",
        cssContent: "",
        gjsData: {},
        status: "draft",
      });
      return { id };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        accountId: z.number(),
        title: z.string().min(1).optional(),
        slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
        metaDescription: z.string().optional(),
        htmlContent: z.string().optional(),
        cssContent: z.string().optional(),
        gjsData: z.any().optional(),
        headerCode: z.string().optional(),
        footerCode: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, accountId, ...data } = input;
      await updateLandingPage(id, accountId, data);
      return { success: true };
    }),

  /** Save editor content (HTML + CSS + GrapesJS project data) */
  saveContent: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        accountId: z.number(),
        htmlContent: z.string(),
        cssContent: z.string(),
        gjsData: z.any(),
      })
    )
    .mutation(async ({ input }) => {
      await updateLandingPage(input.id, input.accountId, {
        htmlContent: input.htmlContent,
        cssContent: input.cssContent,
        gjsData: input.gjsData,
      });
      return { success: true };
    }),

  publish: protectedProcedure
    .input(z.object({ id: z.number(), accountId: z.number() }))
    .mutation(async ({ input }) => {
      const page = await getLandingPage(input.id, input.accountId);
      if (!page) throw new TRPCError({ code: "NOT_FOUND" });
      if (!page.htmlContent || page.htmlContent.trim() === "") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot publish a page with no content. Open the editor and add some content first.",
        });
      }
      await updateLandingPage(input.id, input.accountId, {
        status: "published",
        publishedAt: new Date(),
      });
      return { success: true };
    }),

  unpublish: protectedProcedure
    .input(z.object({ id: z.number(), accountId: z.number() }))
    .mutation(async ({ input }) => {
      await updateLandingPage(input.id, input.accountId, {
        status: "draft",
        publishedAt: null,
      });
      return { success: true };
    }),

  duplicate: protectedProcedure
    .input(z.object({ id: z.number(), accountId: z.number() }))
    .mutation(async ({ input }) => {
      const page = await getLandingPage(input.id, input.accountId);
      if (!page) throw new TRPCError({ code: "NOT_FOUND" });
      const newId = await createLandingPage({
        accountId: input.accountId,
        title: `${page.title} (Copy)`,
        slug: `${page.slug}-copy-${Date.now()}`,
        metaDescription: page.metaDescription,
        htmlContent: page.htmlContent,
        cssContent: page.cssContent,
        gjsData: page.gjsData,
        headerCode: page.headerCode,
        footerCode: page.footerCode,
        status: "draft",
      });
      return { id: newId };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number(), accountId: z.number() }))
    .mutation(async ({ input }) => {
      await deleteLandingPage(input.id, input.accountId);
      return { success: true };
    }),
});
