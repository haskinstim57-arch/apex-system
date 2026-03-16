import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { accountsRouter } from "./routers/accounts";
import { membersRouter } from "./routers/members";
import { invitationsRouter } from "./routers/invitations";
import { contactsRouter } from "./routers/contacts";
import { messagesRouter } from "./routers/messages";
import { campaignsRouter } from "./routers/campaigns";
import { aiCallsRouter } from "./routers/aiCalls";
import { automationsRouter } from "./routers/automations";
import { pipelineRouter } from "./routers/pipeline";
import { subAccountAuthRouter } from "./routers/subAccountAuth";
import { facebookPagesRouter } from "./routers/facebookPages";
import { impersonationRouter } from "./routers/impersonation";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  accounts: accountsRouter,
  members: membersRouter,
  invitations: invitationsRouter,
  contacts: contactsRouter,
  messages: messagesRouter,
  campaigns: campaignsRouter,
  aiCalls: aiCallsRouter,
  automations: automationsRouter,
  pipeline: pipelineRouter,
  subAccountAuth: subAccountAuthRouter,
  facebookPages: facebookPagesRouter,
  impersonation: impersonationRouter,
});

export type AppRouter = typeof appRouter;
