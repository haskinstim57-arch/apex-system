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
import { messagingSettingsRouter } from "./routers/messagingSettings";
import { facebookOAuthRouter } from "./routers/facebookOAuth";
import { calendarRouter } from "./routers/calendar";
import { calendarSyncRouter } from "./routers/calendarSync";
import { inboxRouter } from "./routers/inbox";
import { missedCallTextBackRouter } from "./routers/missedCallTextBack";
import { emailTemplatesRouter } from "./routers/emailTemplates";
import { notificationsRouter } from "./routers/notifications";

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
  messagingSettings: messagingSettingsRouter,
  facebookOAuth: facebookOAuthRouter,
  calendar: calendarRouter,
  calendarSync: calendarSyncRouter,
  inbox: inboxRouter,
  missedCallTextBack: missedCallTextBackRouter,
  emailTemplates: emailTemplatesRouter,
  notifications: notificationsRouter,
});

export type AppRouter = typeof appRouter;
