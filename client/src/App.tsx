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

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/invite/:token" component={InviteAccept} />
      <Route path="/login" component={SubAccountLogin} />

      {/* Dashboard routes wrapped in layout */}
      <Route path="/">
        <DashboardLayout>
          <Home />
        </DashboardLayout>
      </Route>
      <Route path="/accounts">
        <DashboardLayout>
          <Accounts />
        </DashboardLayout>
      </Route>
      <Route path="/accounts/:id">
        {(params) => (
          <DashboardLayout>
            <AccountDetail id={parseInt(params.id)} />
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
      <Route path="/settings">
        <DashboardLayout>
          <SettingsPage />
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
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
