import { Toaster } from "@/components/ui/sonner";
import { Suspense, lazy } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
const Accounts = lazy(() => import("./pages/Accounts"));
const AccountDetail = lazy(() => import("./pages/AccountDetail"));
const TeamMembers = lazy(() => import("./pages/TeamMembers"));
const SubAccountTeamMembers = lazy(() => import("./pages/SubAccountTeamMembers"));
const Support = lazy(() => import("./pages/Support"));
const SettingsPage = lazy(() => import("./pages/Settings"));
import InviteAccept from "./pages/InviteAccept";
const Contacts = lazy(() => import("./pages/Contacts"));
const ContactDetail = lazy(() => import("./pages/ContactDetail"));
const Messages = lazy(() => import("./pages/Messages"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const CampaignDetail = lazy(() => import("./pages/CampaignDetail"));
const AICalls = lazy(() => import("./pages/AICalls"));
const Automations = lazy(() => import("./pages/Automations"));
const Pipeline = lazy(() => import("./pages/Pipeline"));
import SubAccountLogin from "./pages/SubAccountLogin";
const FacebookPages = lazy(() => import("./pages/FacebookPages"));
const MessagingSettings = lazy(() => import("./pages/MessagingSettings"));
const LeadScoringSettings = lazy(() => import("./pages/LeadScoringSettings"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const OnboardingV2 = lazy(() => import("./pages/OnboardingV2"));
import AcceptInvite from "./pages/AcceptInvite";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
const CalendarPage = lazy(() => import("./pages/Calendar"));
const Inbox = lazy(() => import("./pages/Inbox"));
const BookingPage = lazy(() => import("./pages/BookingPage"));
const EmailTemplates = lazy(() => import("./pages/EmailTemplates"));
const EmailTemplateEditor = lazy(() => import("./pages/EmailTemplateEditor"));
const Analytics = lazy(() => import("./pages/Analytics"));
const PowerDialer = lazy(() => import("./pages/PowerDialer"));
const DialerAnalytics = lazy(() => import("./pages/DialerAnalytics"));
const Forms = lazy(() => import("./pages/Forms"));
const FormBuilder = lazy(() => import("./pages/FormBuilder"));
import PublicForm from "./pages/PublicForm";
const Reputation = lazy(() => import("./pages/Reputation"));
const ContactMerge = lazy(() => import("./pages/ContactMerge"));
const Sequences = lazy(() => import("./pages/Sequences"));
const Jarvis = lazy(() => import("./pages/Jarvis"));
const LandingPages = lazy(() => import("./pages/LandingPages"));
const PageEditor = lazy(() => import("./pages/PageEditor"));
const FunnelsPage = lazy(() => import("./pages/Funnels"));
const SmsCompliance = lazy(() => import("./pages/SmsCompliance"));
const MessageQueue = lazy(() => import("./pages/MessageQueue"));
const GeminiUsage = lazy(() => import("./pages/GeminiUsage"));
const LeadMonitor = lazy(() => import("./pages/LeadMonitor"));
const NotificationLog = lazy(() => import("./pages/NotificationLog"));
const NotificationDeliveryDashboard = lazy(() => import("./pages/NotificationDeliveryDashboard"));
const Billing = lazy(() => import("./pages/Billing"));
const ContentHub = lazy(() => import("./pages/ContentHub"));
const ContentDetail = lazy(() => import("./pages/ContentDetail"));
const SupportAdmin = lazy(() => import("./pages/SupportAdmin"));
const Reports = lazy(() => import("./pages/Reports"));
import Offline from "./pages/Offline";
import { ImpersonationBanner } from "./components/ImpersonationBanner";
import { PwaInstallPrompt } from "./components/PwaInstallPrompt";
import { AccountProvider } from "./contexts/AccountContext";
import { BrandingProvider } from "./contexts/BrandingContext";
import { AdminRoute } from "./components/AdminRoute";
import { RequireAccount } from "./components/RequireAccount";

function LazyFallback() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

function Router() {
  return (
    <Switch>
      {/* Offline fallback */}
      <Route path="/offline" component={Offline} />

      {/* Public routes */}
      <Route path="/invite/:token" component={InviteAccept} />
      <Route path="/accept-invite" component={AcceptInvite} />
      <Route path="/login" component={SubAccountLogin} />
      <Route path="/sub-login" component={SubAccountLogin} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/book/:slug">
        {(params) => (
          <div className="dark">
            <BookingPage slug={params.slug} />
          </div>
        )}
      </Route>
      <Route path="/f/:slug">
        {(params) => <PublicForm slug={params.slug} />}
      </Route>

      {/* Onboarding wizard (full-screen, no sidebar) */}
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/onboarding-v2" component={OnboardingV2} />

      {/* Dashboard home — shows agency overview or sub-account overview depending on context */}
      <Route path="/">
        <DashboardLayout>
          <Home />
        </DashboardLayout>
      </Route>

      {/* Agency-level routes — admin only */}
      <Route path="/accounts">
        <DashboardLayout>
          <AdminRoute>
            <Accounts />
          </AdminRoute>
        </DashboardLayout>
      </Route>
      <Route path="/accounts/:id">
        {(params) => (
          <DashboardLayout>
            <AdminRoute>
              <AccountDetail id={parseInt(params.id)} />
            </AdminRoute>
          </DashboardLayout>
        )}
      </Route>
      <Route path="/team">
        <DashboardLayout>
          <AdminRoute>
            <TeamMembers />
          </AdminRoute>
        </DashboardLayout>
      </Route>
      <Route path="/settings/team">
        <DashboardLayout>
          <RequireAccount>
            <Suspense fallback={<LazyFallback />}><SubAccountTeamMembers /></Suspense>
          </RequireAccount>
        </DashboardLayout>
      </Route>

      {/* Sub-account-level routes — require an account to be selected */}
      <Route path="/contacts">
        <DashboardLayout>
          <RequireAccount>
            <Suspense fallback={<LazyFallback />}><Contacts /></Suspense>
          </RequireAccount>
        </DashboardLayout>
      </Route>
      <Route path="/messages">
        <DashboardLayout>
          <RequireAccount>
            <Suspense fallback={<LazyFallback />}><Messages /></Suspense>
          </RequireAccount>
        </DashboardLayout>
      </Route>
      <Route path="/inbox">
        <DashboardLayout>
          <RequireAccount>
            <Suspense fallback={<LazyFallback />}><Inbox /></Suspense>
          </RequireAccount>
        </DashboardLayout>
      </Route>
      <Route path="/campaigns">
        <DashboardLayout>
          <RequireAccount>
            <Suspense fallback={<LazyFallback />}><Campaigns /></Suspense>
          </RequireAccount>
        </DashboardLayout>
      </Route>
      <Route path="/campaigns/:id">
        {(params) => (
          <DashboardLayout>
            <RequireAccount>
              <Suspense fallback={<LazyFallback />}><CampaignDetail params={params} /></Suspense>
            </RequireAccount>
          </DashboardLayout>
        )}
      </Route>
      <Route path="/ai-calls">
        <DashboardLayout>
          <RequireAccount>
            <Suspense fallback={<LazyFallback />}><AICalls /></Suspense>
          </RequireAccount>
        </DashboardLayout>
      </Route>
      <Route path="/automations">
        <DashboardLayout>
          <RequireAccount>
            <Suspense fallback={<LazyFallback />}><Automations /></Suspense>
          </RequireAccount>
        </DashboardLayout>
      </Route>
      <Route path="/sequences">
        <DashboardLayout>
          <RequireAccount>
            <Suspense fallback={<LazyFallback />}><Sequences /></Suspense>
          </RequireAccount>
        </DashboardLayout>
      </Route>
      <Route path="/pages">
        <DashboardLayout>
          <RequireAccount>
            <Suspense fallback={<LazyFallback />}><LandingPages /></Suspense>
          </RequireAccount>
        </DashboardLayout>
      </Route>
      <Route path="/pages/:id/editor">
        <DashboardLayout>
          <RequireAccount>
            <Suspense fallback={<LazyFallback />}><PageEditor /></Suspense>
          </RequireAccount>
        </DashboardLayout>
      </Route>
      <Route path="/funnels">
        <DashboardLayout>
          <RequireAccount>
            <Suspense fallback={<LazyFallback />}><FunnelsPage /></Suspense>
          </RequireAccount>
        </DashboardLayout>
      </Route>
      <Route path="/pipeline">
        <DashboardLayout>
          <RequireAccount>
            <Suspense fallback={<LazyFallback />}><Pipeline /></Suspense>
          </RequireAccount>
        </DashboardLayout>
      </Route>
      <Route path="/calendar">
        <DashboardLayout>
          <RequireAccount>
            <Suspense fallback={<LazyFallback />}><CalendarPage /></Suspense>
          </RequireAccount>
        </DashboardLayout>
      </Route>
      <Route path="/contacts/merge">
        <DashboardLayout>
          <RequireAccount>
            <ContactMerge />
          </RequireAccount>
        </DashboardLayout>
      </Route>
      <Route path="/contacts/:id">
        {(params) => {
          const searchParams = new URLSearchParams(window.location.search);
          const accountId = parseInt(searchParams.get("account") || "0");
          return (
            <DashboardLayout>
              <RequireAccount>
                <Suspense fallback={<LazyFallback />}><ContactDetail id={parseInt(params.id)} accountId={accountId} /></Suspense>
              </RequireAccount>
            </DashboardLayout>
          );
        }}
      </Route>
      <Route path="/email-templates">
        <DashboardLayout>
          <RequireAccount>
            <EmailTemplates />
          </RequireAccount>
        </DashboardLayout>
      </Route>
      <Route path="/email-templates/:id">
        {(params) => (
          <DashboardLayout>
            <RequireAccount>
              <EmailTemplateEditor id={parseInt(params.id)} />
            </RequireAccount>
          </DashboardLayout>
        )}
      </Route>
      <Route path="/sms-compliance">
        <DashboardLayout>
          <RequireAccount>
            <SmsCompliance />
          </RequireAccount>
        </DashboardLayout>
      </Route>

      <Route path="/analytics">
        <DashboardLayout>
          <RequireAccount>
            <Suspense fallback={<LazyFallback />}><Analytics /></Suspense>
          </RequireAccount>
        </DashboardLayout>
      </Route>
      <Route path="/power-dialer">
        <DashboardLayout>
          <RequireAccount>
            <Suspense fallback={<LazyFallback />}><PowerDialer /></Suspense>
          </RequireAccount>
        </DashboardLayout>
      </Route>
      <Route path="/dialer-analytics">
        <DashboardLayout>
          <RequireAccount>
            <DialerAnalytics />
          </RequireAccount>
        </DashboardLayout>
      </Route>
      <Route path="/forms">
        <DashboardLayout>
          <RequireAccount>
            <Suspense fallback={<LazyFallback />}><Forms /></Suspense>
          </RequireAccount>
        </DashboardLayout>
      </Route>
      <Route path="/forms/:id">
        {(params) => (
          <DashboardLayout>
            <RequireAccount>
              <Suspense fallback={<LazyFallback />}><FormBuilder id={parseInt(params.id)} /></Suspense>
            </RequireAccount>
          </DashboardLayout>
        )}
      </Route>

      <Route path="/reputation">
        <DashboardLayout>
          <RequireAccount>
            <Suspense fallback={<LazyFallback />}><Reputation /></Suspense>
          </RequireAccount>
        </DashboardLayout>
      </Route>
      <Route path="/reports">
        <DashboardLayout>
          <Suspense fallback={<LazyFallback />}><Reports /></Suspense>
        </DashboardLayout>
      </Route>

      <Route path="/message-queue">
        <DashboardLayout>
          <RequireAccount>
            <MessageQueue />
          </RequireAccount>
        </DashboardLayout>
      </Route>

      <Route path="/content-hub">
        <DashboardLayout>
          <RequireAccount>
            <Suspense fallback={<LazyFallback />}><ContentHub /></Suspense>
          </RequireAccount>
        </DashboardLayout>
      </Route>
      <Route path="/content-hub/:id">
        <DashboardLayout>
          <RequireAccount>
            <Suspense fallback={<LazyFallback />}><ContentDetail /></Suspense>
          </RequireAccount>
        </DashboardLayout>
      </Route>

      {/* Jarvis AI — full-page chat */}
      <Route path="/jarvis">
        <DashboardLayout>
          <RequireAccount>
            <Suspense fallback={<LazyFallback />}><Jarvis /></Suspense>
          </RequireAccount>
        </DashboardLayout>
      </Route>

      {/* Billing — shows agency overview or sub-account billing depending on context */}
      <Route path="/billing">
        <DashboardLayout>
          <Suspense fallback={<LazyFallback />}><Billing /></Suspense>
        </DashboardLayout>
      </Route>

      {/* Settings — accessible to all authenticated users */}
      <Route path="/settings">
        <DashboardLayout>
          <Suspense fallback={<LazyFallback />}><SettingsPage /></Suspense>
        </DashboardLayout>
      </Route>
      <Route path="/settings/messaging">
        <DashboardLayout>
          <RequireAccount>
            <MessagingSettings />
          </RequireAccount>
        </DashboardLayout>
      </Route>
      <Route path="/settings/lead-scoring">
        <DashboardLayout>
          <RequireAccount>
            <LeadScoringSettings />
          </RequireAccount>
        </DashboardLayout>
      </Route>
      <Route path="/settings/notifications">
        <DashboardLayout>
          <NotificationSettings />
        </DashboardLayout>
      </Route>
      <Route path="/settings/notification-log">
        <DashboardLayout>
          <NotificationLog />
        </DashboardLayout>
      </Route>
      <Route path="/settings/delivery-dashboard">
        <DashboardLayout>
          <AdminRoute>
            <NotificationDeliveryDashboard />
          </AdminRoute>
        </DashboardLayout>
      </Route>
      <Route path="/settings/facebook-pages">
        <DashboardLayout>
          <AdminRoute>
            <FacebookPages />
          </AdminRoute>
        </DashboardLayout>
      </Route>
      <Route path="/settings/ai-usage">
        <DashboardLayout>
          <AdminRoute>
            <GeminiUsage />
          </AdminRoute>
        </DashboardLayout>
      </Route>
      <Route path="/settings/lead-monitor">
        <DashboardLayout>
          <AdminRoute>
            <LeadMonitor />
          </AdminRoute>
        </DashboardLayout>
      </Route>
      <Route path="/admin/support">
        <DashboardLayout>
          <AdminRoute>
            <Suspense fallback={<LazyFallback />}><SupportAdmin /></Suspense>
          </AdminRoute>
        </DashboardLayout>
      </Route>
      <Route path="/support">
        <DashboardLayout>
          <RequireAccount>
            <Suspense fallback={<LazyFallback />}><Support /></Suspense>
          </RequireAccount>
        </DashboardLayout>
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function PwaUpdater() {
  const { updateServiceWorker } = useRegisterSW({
    onNeedRefresh() {
      // Auto-update: activate new SW then reload so user always sees latest code
      updateServiceWorker(true).then(() => {
        window.location.reload();
      });
    },
    onOfflineReady() {
      console.log("App ready to work offline");
    },
  });
  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "var(--popover)",
                color: "var(--popover-foreground)",
                border: "1px solid var(--border)",
              },
            }}
          />
          <ImpersonationBanner />
          <PwaUpdater />
          <AccountProvider>
            <PwaInstallPrompt />
            <BrandingProvider>
              <Router />
            </BrandingProvider>
          </AccountProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
