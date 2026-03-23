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
  Building2,
  CalendarDays,
  ChevronDown,
  CreditCard,
  Globe,
  Inbox,
  Kanban,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  PanelLeft,
  Phone,
  Search,
  Send,
  Settings,
  Users,
  Zap,
  Mail,
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

/**
 * Sub-account pages — only shown when a specific account is selected.
 * These are the CLIENT PORTAL items.
 */
const subAccountMenuItems = [
  { icon: LayoutDashboard, label: "Overview", path: "/" },
  { icon: Users, label: "Contacts", path: "/contacts" },
  { icon: Inbox, label: "Conversations", path: "/inbox" },
  { icon: Phone, label: "AI Calls", path: "/ai-calls" },
  { icon: CalendarDays, label: "Calendar", path: "/calendar" },
  { icon: Send, label: "Campaigns", path: "/campaigns" },
  { icon: Zap, label: "Automations", path: "/automations" },
  { icon: BarChart3, label: "Analytics", path: "/analytics" },
  { icon: Kanban, label: "Pipeline", path: "/pipeline" },
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
        <Sidebar
          collapsible="icon"
          className="border-r border-border bg-white"
          disableTransition={isResizing}
        >
          {/* Logo area */}
          <SidebarHeader className="h-16 justify-center border-b border-border">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                {isCollapsed ? (
                  <PanelLeft className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-primary-foreground">A</span>
                  </div>
                )}
              </button>
              {!isCollapsed ? (
                <span className="font-semibold tracking-tight text-foreground text-sm">
                  Apex<span className="font-extrabold">System</span>
                </span>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            {/* Account Switcher — admin only */}
            <AccountSwitcher collapsed={isCollapsed} />

            {/* Main navigation section */}
            <SidebarMenu className="px-2 py-2">
              {!isCollapsed && (
                <div className="px-3 py-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {sectionLabel}
                  </span>
                </div>
              )}
              {mainMenuItems.map((item) => {
                const isActive = location === item.path;
                const showBadge = item.path === "/inbox" && unreadCount > 0;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => handleNavClick(item)}
                      tooltip={item.label}
                      className={`h-9 transition-all font-normal text-[13px] relative ${
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-foreground hover:bg-accent"
                      }`}
                    >
                      {/* Gold left border for active item */}
                      {isActive && !isCollapsed && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
                      )}
                      <div className="relative">
                        <item.icon
                          className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                        />
                        {showBadge && isCollapsed && (
                          <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500" />
                        )}
                      </div>
                      <span className="flex-1">{item.label}</span>
                      {showBadge && !isCollapsed && (
                        <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[10px] font-bold rounded-full bg-red-500 text-white ml-auto">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            {/* Admin section — only when admin has a sub-account selected */}
            {showAdminSection && (
              <SidebarMenu className="px-2 py-1">
                {!isCollapsed && (
                  <div className="px-3 py-1.5 mt-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Admin
                    </span>
                  </div>
                )}
                {adminMenuItems.map((item) => {
                  const isActive = location === item.path;
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => { setLocation(item.path); if (isMobile) setOpenMobile(false); }}
                        tooltip={item.label}
                        className={`h-9 transition-all font-normal text-[13px] relative ${
                          isActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-foreground hover:bg-accent"
                        }`}
                      >
                        {isActive && !isCollapsed && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
                        )}
                        <item.icon
                          className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                        />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            )}

            {/* SETTINGS section */}
            <div className="mt-auto">
              <SidebarMenu className="px-2 py-2">
                {!isCollapsed && (
                  <div className="px-3 py-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Settings
                    </span>
                  </div>
                )}
                {settingsMenuItems.map((item) => {
                  const isActive = location === item.path;
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => { setLocation(item.path); if (isMobile) setOpenMobile(false); }}
                        tooltip={item.label}
                        className={`h-9 transition-all font-normal text-[13px] relative ${
                          isActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-foreground hover:bg-accent"
                        }`}
                      >
                        {isActive && !isCollapsed && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
                        )}
                        <item.icon
                          className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                        />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
                {/* Log Out */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={logout}
                    tooltip="Log Out"
                    className="h-9 transition-all font-normal text-[13px] text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Log Out</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </div>
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-border" />
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className={isImpersonating ? "pt-10" : ""}>
        {/* Top navigation bar — white bg, search, notification bell, user avatar */}
        <div className="flex border-b border-border h-16 items-center justify-between bg-white px-4 md:px-6 sticky top-0 z-40">
          <div className="flex items-center gap-3">
            {isMobile && (
              <SidebarTrigger className="h-9 w-9 rounded-lg" />
            )}
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
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
