import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  createFunnel,
  listFunnels,
  getFunnel,
  updateFunnel,
  deleteFunnel,
  listLandingPages,
} from "../db";

const funnelStepSchema = z.object({
  pageId: z.number(),
  label: z.string(),
  order: z.number(),
});

export const funnelsRouter = router({
  list: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ input }) => {
      return listFunnels(input.accountId);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number(), accountId: z.number() }))
    .query(async ({ input }) => {
      const funnel = await getFunnel(input.id, input.accountId);
      if (!funnel) throw new TRPCError({ code: "NOT_FOUND", message: "Funnel not found" });
      // Also fetch the pages for each step
      const pages = await listLandingPages(input.accountId);
      const steps = (funnel.steps as Array<{ pageId: number; label: string; order: number }>) || [];
      const stepsWithPages = steps.map((step) => {
        const page = pages.find((p) => p.id === step.pageId);
        return {
          ...step,
          page: page
            ? { id: page.id, title: page.title, slug: page.slug, status: page.status }
            : null,
        };
      });
      return { ...funnel, stepsWithPages };
    }),

  create: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        name: z.string().min(1),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const id = await createFunnel({
        accountId: input.accountId,
        name: input.name,
        description: input.description ?? null,
        steps: [],
        status: "draft",
      });
      return { id };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        accountId: z.number(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        steps: z.array(funnelStepSchema).optional(),
        status: z.enum(["draft", "active", "archived"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, accountId, ...data } = input;
      await updateFunnel(id, accountId, data);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number(), accountId: z.number() }))
    .mutation(async ({ input }) => {
      await deleteFunnel(input.id, input.accountId);
      return { success: true };
    }),
});
