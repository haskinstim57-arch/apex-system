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
import { twilioPhoneNumberRouter } from "./routers/twilioPhoneNumber";
import { analyticsRouter } from "./routers/analytics";
import { powerDialerRouter } from "./routers/powerDialer";
import { leadRoutingRouter } from "./routers/leadRouting";
import { formsRouter } from "./routers/forms";
import { reputationRouter } from "./routers/reputation";
import { webhooksRouter } from "./routers/webhooks";
import { apiKeysRouter } from "./routers/apiKeys";
import { customFieldsRouter } from "./routers/customFields";
import { customFieldTemplatesRouter } from "./routers/customFieldTemplates";
import { columnPreferencesRouter } from "./routers/columnPreferences";
import { customFieldAnalyticsRouter } from "./routers/customFieldAnalytics";
import { savedViewsRouter } from "./routers/savedViews";
import { contactMergeRouter } from "./routers/contactMerge";
import { leadScoringRouter } from "./routers/leadScoring";
import { segmentsRouter } from "./routers/segments";
import { sequencesRouter } from "./routers/sequences";
import { landingPagesRouter } from "./routers/landingPages";
import { funnelsRouter } from "./routers/funnels";
import { webchatRouter } from "./routers/webchat";
import { scheduledReportsRouter } from "./routers/scheduledReports";
import { smsComplianceRouter } from "./routers/smsCompliance";
import { messageQueueRouter } from "./routers/messageQueue";
import { jarvisRouter } from "./routers/jarvis";
import { billingRouter } from "./routers/billing";
import { socialContentRouter } from "./routers/socialContent";
import { leadMonitorRouter } from "./routers/leadMonitor";
import { longFormContentRouter } from "./routers/longFormContent";
import { emailContentRouter } from "./routers/emailContent";
import { recurringContentPlansRouter } from "./routers/recurringContentPlans";
import { dashboardRouter } from "./routers/dashboard";
import { searchRouter } from "./routers/search";

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
  twilioPhoneNumber: twilioPhoneNumberRouter,
  analytics: analyticsRouter,
  powerDialer: powerDialerRouter,
  leadRouting: leadRoutingRouter,
  forms: formsRouter,
  reputation: reputationRouter,
  webhooks: webhooksRouter,
  apiKeys: apiKeysRouter,
  customFields: customFieldsRouter,
  customFieldTemplates: customFieldTemplatesRouter,
  columnPreferences: columnPreferencesRouter,
  customFieldAnalytics: customFieldAnalyticsRouter,
  savedViews: savedViewsRouter,
  contactMerge: contactMergeRouter,
  leadScoring: leadScoringRouter,
  segments: segmentsRouter,
  sequences: sequencesRouter,
  landingPages: landingPagesRouter,
  funnels: funnelsRouter,
  webchat: webchatRouter,
  scheduledReports: scheduledReportsRouter,
  smsCompliance: smsComplianceRouter,
  messageQueue: messageQueueRouter,
  jarvis: jarvisRouter,
  billing: billingRouter,
  socialContent: socialContentRouter,
  leadMonitor: leadMonitorRouter,
  longFormContent: longFormContentRouter,
  emailContent: emailContentRouter,
  recurringContentPlans: recurringContentPlansRouter,
  dashboard: dashboardRouter,
  search: searchRouter,
});

export type AppRouter = typeof appRouter;
