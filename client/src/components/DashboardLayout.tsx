import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  BarChart3,
  ShieldCheck,
  Activity,
  Building2,
  CalendarDays,
  ChevronDown,
  CreditCard,
  Globe,
  Inbox,
  Kanban,
  ClipboardList,
  Star,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  PanelLeft,
  Phone,
  PhoneCall,
  Search,
  Send,
  Settings,
  Users,
  Zap,
  Mail,
  ListOrdered,
  FileText,
  Clock,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { AccountSwitcher } from "./AccountSwitcher";
import { useAccount } from "@/contexts/AccountContext";
import { NotificationCenter } from "./NotificationCenter";
import { useAiAdvisor } from "@/contexts/AiAdvisorContext";
import { AiAdvisorCard } from "./AiAdvisorCard";
import { AiAdvisorMobileDrawer } from "./AiAdvisorMobileDrawer";

/**
 * Sub-account pages — only shown when a specific account is selected.
 * These are the CLIENT PORTAL items.
 */
const subAccountMenuItems = [
  { icon: LayoutDashboard, label: "Overview", path: "/" },
  { icon: Users, label: "Contacts", path: "/contacts" },
  { icon: Inbox, label: "Conversations", path: "/inbox" },
  { icon: Phone, label: "AI Calls", path: "/ai-calls" },
  { icon: PhoneCall, label: "Power Dialer", path: "/power-dialer" },
  { icon: Activity, label: "Dialer Analytics", path: "/dialer-analytics" },
  { icon: CalendarDays, label: "Calendar", path: "/calendar" },
  { icon: Send, label: "Campaigns", path: "/campaigns" },
  { icon: Zap, label: "Automations", path: "/automations" },
  { icon: ListOrdered, label: "Sequences", path: "/sequences" },
  { icon: FileText, label: "Pages & Funnels", path: "/pages" },
  { icon: BarChart3, label: "Analytics", path: "/analytics" },
  { icon: ShieldCheck, label: "SMS Compliance", path: "/sms-compliance" },
  { icon: Kanban, label: "Pipeline", path: "/pipeline" },
  { icon: ClipboardList, label: "Forms", path: "/forms" },
  { icon: Star, label: "Reputation", path: "/reputation" },
  { icon: Clock, label: "Message Queue", path: "/message-queue" },
];

/**
 * Agency-level pages — only shown to agency_admin in Agency Overview mode
 * (no sub-account selected).
 */
const agencyMenuItems = [
  { icon: LayoutDashboard, label: "Overview", path: "/" },
  { icon: Building2, label: "Sub-Accounts", path: "/accounts" },
  { icon: Users, label: "Users", path: "/team", placeholder: true },
  { icon: CreditCard, label: "Billing", path: "/billing", placeholder: true },
];

/**
 * Admin section — Sub-Accounts link shown when admin has a sub-account selected.
 * This lets them jump back to the sub-accounts list.
 */
const adminMenuItems = [
  { icon: Building2, label: "Sub-Accounts", path: "/accounts" },
];

const settingsMenuItems = [
  { icon: Settings, label: "Settings", path: "/settings" },
];

const hiddenMenuItems = [
  { icon: MessageSquare, label: "Messages", path: "/messages" },
  { icon: Mail, label: "Email Templates", path: "/email-templates" },
  { icon: Globe, label: "Websites", path: "/websites", placeholder: true },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 220;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  const { currentAccount, isAdmin, isImpersonating, isLoading: accountLoading } = useAccount();
  const [, navigate] = useLocation();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  // Onboarding enforcement
  useEffect(() => {
    if (loading || accountLoading) return;
    if (!user || !currentAccount) return;
    if (isAdmin && !isImpersonating) return;
    if ((currentAccount as any).onboardingComplete === false || (currentAccount as any).onboardingComplete === 0) {
      navigate("/onboarding");
    }
  }, [loading, accountLoading, user, currentAccount, isAdmin, isImpersonating, navigate]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-lg font-bold text-primary-foreground">A</span>
              </div>
              <span className="text-2xl font-bold tracking-tight text-foreground">
                Apex<span className="font-extrabold">System</span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Sign in to access your CRM dashboard and manage your mortgage
              pipeline.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Admin Sign In
          </Button>
          <div className="flex items-center gap-3 w-full">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <Button
            variant="outline"
            onClick={() => {
              window.location.href = "/login";
            }}
            size="lg"
            className="w-full"
          >
            Sub-Account Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar, setOpenMobile } = useSidebar();
  const { currentAccountId, isAdmin, isImpersonating, isAgencyScope } = useAccount();
  const { setPageContext, pageContext } = useAiAdvisor();

  // Sync current route to AI Advisor so it can give page-relevant suggestions.
  // Each entry maps an exact route path to a stable context key that the server
  // uses to focus its system prompt on the right page.
  useEffect(() => {
    const exactPageMap: Record<string, string> = {
      "/": "dashboard",
      "/contacts": "contacts",
      "/inbox": "inbox",
      "/messages": "messages",
      "/campaigns": "campaigns",
      "/ai-calls": "ai-calls",
      "/automations": "automations",
      "/pipeline": "pipeline",
      "/calendar": "calendar",
      "/analytics": "analytics",
      "/sms-compliance": "sms-compliance",
      "/power-dialer": "power-dialer",
      "/dialer-analytics": "dialer-analytics",
      "/email-templates": "email-templates",
      "/settings": "settings",
      "/settings/messaging": "settings",
      "/settings/facebook-pages": "settings",
      "/accounts": "accounts",
    };

    if (exactPageMap[location]) {
      setPageContext(exactPageMap[location]);
      return;
    }

    // Handle dynamic sub-paths (e.g. /campaigns/123, /contacts/456)
    const prefixMap: Array<[string, string]> = [
      ["/campaigns/", "campaigns"],
      ["/contacts/", "contacts"],
      ["/automations/", "automations"],
      ["/settings/", "settings"],
      ["/ai-calls/", "ai-calls"],
      ["/pipeline/", "pipeline"],
    ];

    for (const [prefix, ctx] of prefixMap) {
      if (location.startsWith(prefix)) {
        setPageContext(ctx);
        return;
      }
    }

    // Final fallback: strip leading slash and use as-is
    const fallback = location.replace(/^\//, "") || "dashboard";
    setPageContext(fallback);
  }, [location, setPageContext]);

  // Unread message count for inbox badge
  const { data: unreadData } = trpc.inbox.getUnreadCount.useQuery(
    { accountId: currentAccountId! },
    { enabled: !!currentAccountId, refetchInterval: 15000 }
  );
  const unreadCount = unreadData?.count ?? 0;
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Determine which menu items to show based on role + scope
  const mainMenuItems = (isAdmin && isAgencyScope) ? agencyMenuItems : subAccountMenuItems;
  const showAdminSection = isAdmin && !isAgencyScope; // Show "Sub-Accounts" shortcut when admin has an account selected

  const allNavItems = [...subAccountMenuItems, ...agencyMenuItems, ...adminMenuItems, ...settingsMenuItems, ...hiddenMenuItems];
  const activeMenuItem = allNavItems.find(
    (item) => item.path === location
  );
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft =
        sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const handleNavClick = (item: { label: string; path: string; placeholder?: boolean }) => {
    if (item.placeholder) {
      toast.info("Coming soon", {
        description: `${item.label} module will be available in a future update.`,
      });
      return;
    }
    setLocation(item.path);
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // Section label for the main nav
  const sectionLabel = (isAdmin && isAgencyScope) ? "Agency" : "Client Portal";

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon">
          <SidebarHeader className="border-b border-sidebar-border">
            {/* Logo row — always visible, collapses to icon when sidebar is collapsed */}
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary-foreground">A</span>
              </div>
              {!isCollapsed && (
                <span className="text-[15px] font-bold tracking-tight text-foreground">
                  Apex<span className="font-extrabold">System</span>
                </span>
              )}
            </div>
            {/* Account switcher below logo */}
            {!isCollapsed && (
              <div className="px-2 pb-2">
                <AccountSwitcher />
              </div>
            )}
          </SidebarHeader>

          <SidebarContent>
            {/* Main nav section */}
            <div className="px-2 py-2">
              {!isCollapsed && (
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-2 mb-1">
                  {sectionLabel}
                </p>
              )}
              <SidebarMenu>
                {mainMenuItems.map((item) => {
                  const isActive = item.path === location;
                  const showBadge = item.path === "/inbox" && unreadCount > 0;
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => handleNavClick(item)}
                        tooltip={item.label}
                        className="cursor-pointer"
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                        {showBadge && (
                          <Badge
                            variant="destructive"
                            className="ml-auto h-5 min-w-5 px-1 text-[10px] font-bold"
                          >
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </Badge>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </div>

            {/* Admin shortcut section */}
            {showAdminSection && (
              <div className="px-2 py-2 border-t border-sidebar-border">
                {!isCollapsed && (
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-2 mb-1">
                    Admin
                  </p>
                )}
                <SidebarMenu>
                  {adminMenuItems.map((item) => (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        isActive={item.path === location}
                        onClick={() => handleNavClick(item)}
                        tooltip={item.label}
                        className="cursor-pointer"
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </div>
            )}
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border">
            <div className="px-2 py-2">
              <SidebarMenu>
                {settingsMenuItems.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={location.startsWith("/settings")}
                      onClick={() => handleNavClick(item)}
                      tooltip={item.label}
                      className="cursor-pointer"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </div>
          </SidebarFooter>
        </Sidebar>

        {/* Resize handle */}
        {!isCollapsed && (
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors z-10"
            onMouseDown={() => setIsResizing(true)}
          />
        )}
      </div>

      <SidebarInset>
        {/* Top bar */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 gap-3">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="-ml-1" />
            {/* Breadcrumb / page title */}
            <div className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {activeMenuItem?.label || "Dashboard"}
              </span>
            </div>

            {/* Global search bar */}
            <div className="relative hidden md:flex items-center">
              <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search leads, campaigns..."
                className="h-9 w-64 rounded-lg border border-border bg-accent/50 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
                onFocus={(e) => {
                  toast.info("Search coming soon", {
                    description: "Global search will be available in a future update.",
                  });
                  e.target.blur();
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification bell */}
            <NotificationCenter />

            {/* User profile dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-8 w-8 border border-border shrink-0">
                    <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:flex flex-col items-start min-w-0">
                    <span className="text-sm font-medium text-foreground leading-none truncate max-w-[120px]">
                      {user?.name || "User"}
                    </span>
                    <span className="text-[11px] text-muted-foreground leading-none mt-0.5">
                      {isAdmin ? "Admin" : "User"}
                    </span>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden md:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium text-foreground">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setLocation("/settings")}
                  className="cursor-pointer"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex flex-1 min-h-0">
          <main className="flex-1 min-w-0 overflow-y-auto">
            {/* Wrap page content + advisor card side-by-side at the top */}
            {currentAccountId && !location.startsWith("/settings") ? (
              <div className="p-4 md:p-6">
                <div className="flex items-start gap-4">
                  {/* Page content takes all remaining space */}
                  <div className="flex-1 min-w-0">{children}</div>
                  {/* AI Advisor — small card, top-aligned, does not stretch */}
                  <div className="hidden xl:block w-48 shrink-0 self-start">
                    <AiAdvisorCard pageContext={pageContext} title="AI Advisor" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 md:p-6">{children}</div>
            )}
          </main>
        </div>
      </SidebarInset>
      <AiAdvisorMobileDrawer />
    </>
  );
}
