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
import { ImpersonationBanner } from "./components/ImpersonationBanner";
import { AccountProvider } from "./contexts/AccountContext";
import { AdminRoute } from "./components/AdminRoute";

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
        {(params) => <BookingPage slug={params.slug} />}
      </Route>

      {/* Onboarding wizard (full-screen, no sidebar) */}
      <Route path="/onboarding" component={Onboarding} />

      {/* Dashboard routes wrapped in layout */}
      <Route path="/">
        <DashboardLayout>
          <Home />
        </DashboardLayout>
      </Route>
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
          <TeamMembers />
        </DashboardLayout>
      </Route>
      <Route path="/contacts">
        <DashboardLayout>
          <Contacts />
        </DashboardLayout>
      </Route>
      <Route path="/messages">
        <DashboardLayout>
          <Messages />
        </DashboardLayout>
      </Route>
      <Route path="/inbox">
        <DashboardLayout>
          <Inbox />
        </DashboardLayout>
      </Route>
      <Route path="/campaigns">
        <DashboardLayout>
          <Campaigns />
        </DashboardLayout>
      </Route>
      <Route path="/campaigns/:id">
        {(params) => (
          <DashboardLayout>
            <CampaignDetail params={params} />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/ai-calls">
        <DashboardLayout>
          <AICalls />
        </DashboardLayout>
      </Route>
      <Route path="/automations">
        <DashboardLayout>
          <Automations />
        </DashboardLayout>
      </Route>
      <Route path="/pipeline">
        <DashboardLayout>
          <Pipeline />
        </DashboardLayout>
      </Route>
      <Route path="/calendar">
        <DashboardLayout>
          <CalendarPage />
        </DashboardLayout>
      </Route>
      <Route path="/contacts/:id">
        {(params) => {
          const searchParams = new URLSearchParams(window.location.search);
          const accountId = parseInt(searchParams.get("account") || "0");
          return (
            <DashboardLayout>
              <ContactDetail id={parseInt(params.id)} accountId={accountId} />
            </DashboardLayout>
          );
        }}
      </Route>
      <Route path="/email-templates">
        <DashboardLayout>
          <EmailTemplates />
        </DashboardLayout>
      </Route>
      <Route path="/email-templates/:id">
        {(params) => (
          <DashboardLayout>
            <EmailTemplateEditor id={parseInt(params.id)} />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/analytics">
        <DashboardLayout>
          <Analytics />
        </DashboardLayout>
      </Route>
      <Route path="/settings">
        <DashboardLayout>
          <SettingsPage />
        </DashboardLayout>
      </Route>
      <Route path="/settings/messaging">
        <DashboardLayout>
          <MessagingSettings />
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
      <ThemeProvider defaultTheme="dark">
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
            <Router />
          </AccountProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
