import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Accounts from "./pages/Accounts";
import AccountDetail from "./pages/AccountDetail";
import TeamMembers from "./pages/TeamMembers";
import SettingsPage from "./pages/Settings";
import InviteAccept from "./pages/InviteAccept";
import Contacts from "./pages/Contacts";
import ContactDetail from "./pages/ContactDetail";
import Messages from "./pages/Messages";
import Campaigns from "./pages/Campaigns";
import CampaignDetail from "./pages/CampaignDetail";
import AICalls from "./pages/AICalls";
import Automations from "./pages/Automations";
import Pipeline from "./pages/Pipeline";
import SubAccountLogin from "./pages/SubAccountLogin";
import FacebookPages from "./pages/FacebookPages";
import MessagingSettings from "./pages/MessagingSettings";
import Onboarding from "./pages/Onboarding";
import AcceptInvite from "./pages/AcceptInvite";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import CalendarPage from "./pages/Calendar";
import Inbox from "./pages/Inbox";
import BookingPage from "./pages/BookingPage";
import EmailTemplates from "./pages/EmailTemplates";
import EmailTemplateEditor from "./pages/EmailTemplateEditor";
import Analytics from "./pages/Analytics";
import PowerDialer from "./pages/PowerDialer";
import DialerAnalytics from "./pages/DialerAnalytics";
import Forms from "./pages/Forms";
import FormBuilder from "./pages/FormBuilder";
import PublicForm from "./pages/PublicForm";
import Reputation from "./pages/Reputation";
import { ImpersonationBanner } from "./components/ImpersonationBanner";
import { AccountProvider } from "./contexts/AccountContext";
import { AiAdvisorProvider } from "./contexts/AiAdvisorContext";
import { AdminRoute } from "./components/AdminRoute";
import { RequireAccount } from "./components/RequireAccount";

function Router() {
  return (
    <Switch>
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

      {/* Sub-account-level routes — require an account to be selected */}
      <Route path="/contacts">
        <DashboardLayout>
          <RequireAccount>
            <Contacts />
          </RequireAccount>
        </DashboardLayout>
      </Route>
      <Route path="/messages">
        <DashboardLayout>
          <RequireAccount>
            <Messages />
          </RequireAccount>
        </DashboardLayout>
      </Route>
      <Route path="/inbox">
        <DashboardLayout>
          <RequireAccount>
            <Inbox />
          </RequireAccount>
        </DashboardLayout>
      </Route>
      <Route path="/campaigns">
        <DashboardLayout>
          <RequireAccount>
            <Campaigns />
          </RequireAccount>
        </DashboardLayout>
      </Route>
      <Route path="/campaigns/:id">
        {(params) => (
          <DashboardLayout>
            <RequireAccount>
              <CampaignDetail params={params} />
            </RequireAccount>
          </DashboardLayout>
        )}
      </Route>
      <Route path="/ai-calls">
        <DashboardLayout>
          <RequireAccount>
            <AICalls />
          </RequireAccount>
        </DashboardLayout>
      </Route>
      <Route path="/automations">
        <DashboardLayout>
          <RequireAccount>
            <Automations />
          </RequireAccount>
        </DashboardLayout>
      </Route>
      <Route path="/pipeline">
        <DashboardLayout>
          <RequireAccount>
            <Pipeline />
          </RequireAccount>
        </DashboardLayout>
      </Route>
      <Route path="/calendar">
        <DashboardLayout>
          <RequireAccount>
            <CalendarPage />
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
                <ContactDetail id={parseInt(params.id)} accountId={accountId} />
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
      <Route path="/analytics">
        <DashboardLayout>
          <RequireAccount>
            <Analytics />
          </RequireAccount>
        </DashboardLayout>
      </Route>
      <Route path="/power-dialer">
        <DashboardLayout>
          <RequireAccount>
            <PowerDialer />
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
            <Forms />
          </RequireAccount>
        </DashboardLayout>
      </Route>
      <Route path="/forms/:id">
        {(params) => (
          <DashboardLayout>
            <RequireAccount>
              <FormBuilder id={parseInt(params.id)} />
            </RequireAccount>
          </DashboardLayout>
        )}
      </Route>

      <Route path="/reputation">
        <DashboardLayout>
          <RequireAccount>
            <Reputation />
          </RequireAccount>
        </DashboardLayout>
      </Route>

      {/* Settings — accessible to all authenticated users */}
      <Route path="/settings">
        <DashboardLayout>
          <SettingsPage />
        </DashboardLayout>
      </Route>
      <Route path="/settings/messaging">
        <DashboardLayout>
          <RequireAccount>
            <MessagingSettings />
          </RequireAccount>
        </DashboardLayout>
      </Route>
      <Route path="/settings/facebook-pages">
        <DashboardLayout>
          <AdminRoute>
            <FacebookPages />
          </AdminRoute>
        </DashboardLayout>
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
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
          <AccountProvider>
            <AiAdvisorProvider>
              <Router />
            </AiAdvisorProvider>
          </AccountProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
