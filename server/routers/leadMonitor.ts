/**
 * Lead Routing Monitor Router
 * Admin-only endpoints for the real-time Facebook lead routing dashboard.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getRoutingOverview,
  getRecentEvents,
  getTimeSeries,
  getUnacknowledgedFailures,
  acknowledgeFailure,
  acknowledgeAllFailures,
  getRoutingMethodBreakdown,
} from "../services/leadRoutingMonitor";

/** Require admin role */
function requireAdmin(role: string) {
  if (role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Lead routing monitor is admin-only",
    });
  }
}

export const leadMonitorRouter = router({
  // ─── Overview stats for dashboard cards ───
  getOverview: protectedProcedure
    .input(
      z
        .object({
          hoursBack: z.number().int().min(1).max(720).default(168), // default 7 days
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role);
      return getRoutingOverview(input?.hoursBack ?? 168);
    }),

  // ─── Recent events (paginated) ───
  getRecentEvents: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
        status: z.enum(["success", "failure", "partial"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role);
      return getRecentEvents(input);
    }),

  // ─── Time-series data for charts ───
  getTimeSeries: protectedProcedure
    .input(
      z
        .object({
          hoursBack: z.number().int().min(1).max(720).default(48),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role);
      return getTimeSeries(input?.hoursBack ?? 48);
    }),

  // ─── Unacknowledged failures ───
  getFailures: protectedProcedure.query(async ({ ctx }) => {
    requireAdmin(ctx.user.role);
    return getUnacknowledgedFailures();
  }),

  // ─── Acknowledge a single failure ───
  acknowledgeFailure: protectedProcedure
    .input(z.object({ eventId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role);
      const ok = await acknowledgeFailure(input.eventId);
      if (!ok) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to acknowledge" });
      }
      return { success: true };
    }),

  // ─── Acknowledge all failures ───
  acknowledgeAll: protectedProcedure.mutation(async ({ ctx }) => {
    requireAdmin(ctx.user.role);
    const count = await acknowledgeAllFailures();
    return { acknowledged: count };
  }),

  // ─── Routing method breakdown ───
  getMethodBreakdown: protectedProcedure
    .input(
      z
        .object({
          hoursBack: z.number().int().min(1).max(720).default(168),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx.user.role);
      return getRoutingMethodBreakdown(input?.hoursBack ?? 168);
    }),
});
