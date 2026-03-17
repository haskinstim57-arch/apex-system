import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

const IMPERSONATION_COOKIE = "apex_impersonation";

export { IMPERSONATION_COOKIE };

export const impersonationRouter = router({
  /**
   * Start impersonating a sub-account.
   * Only admins can impersonate. Sets a separate cookie so the admin's
   * real session stays intact.
   */
  start: adminProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the target account exists
      const account = await db.getAccountById(input.accountId);
      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found",
        });
      }

      // Build impersonation payload
      const payload = {
        impersonatedAccountId: input.accountId,
        impersonatedAccountName: account.name,
        impersonatorUserId: ctx.user.id,
        impersonatorName: ctx.user.name || "Admin",
      };

      // Set impersonation cookie (JSON-encoded, httpOnly)
      // secure: true is required whenever sameSite: 'none' or browsers silently reject the cookie
      ctx.res.cookie(IMPERSONATION_COOKIE, JSON.stringify(payload), {
        httpOnly: true,
        path: "/",
        sameSite: "none" as const,
        secure: true,
        maxAge: 1000 * 60 * 60 * 4, // 4 hours max
      });

      // Log the impersonation action
      await db.logImpersonationAction({
        adminId: ctx.user.id,
        adminName: ctx.user.name || null,
        targetAccountId: input.accountId,
        targetAccountName: account.name,
        action: "start",
      });

      console.log(
        `[Impersonation] Admin ${ctx.user.id} (${ctx.user.name}) started impersonating account ${input.accountId} (${account.name})`
      );

      return {
        success: true,
        accountId: input.accountId,
        accountName: account.name,
      };
    }),

  /**
   * Stop impersonation and restore normal admin session.
   * Clears the impersonation cookie.
   */
  stop: protectedProcedure.mutation(async ({ ctx }) => {
    // Read impersonation cookie to get details for audit log
    const cookieHeader = ctx.req.headers.cookie || "";
    const impersonationData = parseImpersonationCookie(cookieHeader);

    // Clear the impersonation cookie — options must match the set call exactly
    ctx.res.clearCookie(IMPERSONATION_COOKIE, {
      httpOnly: true,
      path: "/",
      sameSite: "none" as const,
      secure: true,
    });

    // Log the stop action if we have impersonation data
    if (impersonationData) {
      await db.logImpersonationAction({
        adminId: impersonationData.impersonatorUserId,
        adminName: impersonationData.impersonatorName || null,
        targetAccountId: impersonationData.impersonatedAccountId,
        targetAccountName: impersonationData.impersonatedAccountName || null,
        action: "stop",
      });

      console.log(
        `[Impersonation] Admin ${impersonationData.impersonatorUserId} stopped impersonating account ${impersonationData.impersonatedAccountId}`
      );
    }

    return { success: true };
  }),

  /**
   * Get current impersonation status.
   * Returns null if not impersonating, or the impersonation details.
   */
  status: protectedProcedure.query(({ ctx }) => {
    const cookieHeader = ctx.req.headers.cookie || "";
    const data = parseImpersonationCookie(cookieHeader);

    if (!data) {
      return { isImpersonating: false as const };
    }

    return {
      isImpersonating: true as const,
      impersonatedAccountId: data.impersonatedAccountId,
      impersonatedAccountName: data.impersonatedAccountName,
      impersonatorUserId: data.impersonatorUserId,
      impersonatorName: data.impersonatorName,
    };
  }),

  /**
   * List recent impersonation audit logs (admin only).
   */
  auditLogs: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit ?? 50;
      return db.listImpersonationLogs(limit);
    }),
});

// ─── Helper: parse impersonation cookie ───

interface ImpersonationPayload {
  impersonatedAccountId: number;
  impersonatedAccountName: string;
  impersonatorUserId: number;
  impersonatorName: string;
}

export function parseImpersonationCookie(
  cookieHeader: string
): ImpersonationPayload | null {
  try {
    // Simple cookie parsing for the impersonation cookie
    const cookies = cookieHeader.split(";").reduce(
      (acc, cookie) => {
        const [key, ...rest] = cookie.trim().split("=");
        if (key) acc[key.trim()] = rest.join("=");
        return acc;
      },
      {} as Record<string, string>
    );

    const raw = cookies[IMPERSONATION_COOKIE];
    if (!raw) return null;

    const decoded = decodeURIComponent(raw);
    const parsed = JSON.parse(decoded);

    if (
      typeof parsed.impersonatedAccountId !== "number" ||
      typeof parsed.impersonatorUserId !== "number"
    ) {
      return null;
    }

    return {
      impersonatedAccountId: parsed.impersonatedAccountId,
      impersonatedAccountName: parsed.impersonatedAccountName || "",
      impersonatorUserId: parsed.impersonatorUserId,
      impersonatorName: parsed.impersonatorName || "",
    };
  } catch {
    return null;
  }
}
