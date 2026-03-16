import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { parseImpersonationCookie } from "../routers/impersonation";

export type ImpersonationContext = {
  isImpersonating: boolean;
  impersonatedAccountId: number | null;
  impersonatedAccountName: string | null;
  impersonatorUserId: number | null;
  impersonatorName: string | null;
};

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  impersonation: ImpersonationContext;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  // Parse impersonation cookie (only relevant for admin users)
  let impersonation: ImpersonationContext = {
    isImpersonating: false,
    impersonatedAccountId: null,
    impersonatedAccountName: null,
    impersonatorUserId: null,
    impersonatorName: null,
  };

  if (user && user.role === "admin") {
    const cookieHeader = opts.req.headers.cookie || "";
    const impersonationData = parseImpersonationCookie(cookieHeader);
    if (impersonationData) {
      impersonation = {
        isImpersonating: true,
        impersonatedAccountId: impersonationData.impersonatedAccountId,
        impersonatedAccountName: impersonationData.impersonatedAccountName,
        impersonatorUserId: impersonationData.impersonatorUserId,
        impersonatorName: impersonationData.impersonatorName,
      };
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    impersonation,
  };
}
