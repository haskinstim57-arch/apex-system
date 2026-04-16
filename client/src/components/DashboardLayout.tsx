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
  Send,
  Settings,
  Users,
  Zap,
  Mail,
  ListOrdered,
  FileText,
  Clock,
  Bot,
  BookOpen,
  Sun,
  Moon,
  LifeBuoy,
} from "lucide-react";
import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { GlobalSearch } from "@/components/GlobalSearch";
import { trpc } from "@/lib/trpc";
import { AccountSwitcher } from "./AccountSwitcher";
import { useAccount } from "@/contexts/AccountContext";
import { useBranding } from "@/contexts/BrandingContext";
import { NotificationCenter } from "./NotificationCenter";
import { JarvisPanel } from "./JarvisPanel";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Sub-account pages — only shown when a specific account is selected.
 * These are the CLIENT PORTAL items.
 */
type NavItem = { icon: React.ComponentType<{ className?: string }>; label: string; path: string; placeholder?: boolean; jarvis?: boolean };
type NavGroup = { section: string; items: NavItem[] };

const subAccountNavGroups: NavGroup[] = [
  {
    section: "",
    items: [
      { icon: LayoutDashboard, label: "Overview", path: "/" },
      { icon: Bot, label: "Jarvis AI", path: "/jarvis", jarvis: true },
    ],
  },
  {
    section: "CRM",
    items: [
      { icon: Users, label: "Contacts", path: "/contacts" },
      { icon: Inbox, label: "Conversations", path: "/inbox" },
      { icon: Kanban, label: "Pipeline", path: "/pipeline" },
      { icon: CalendarDays, label: "Calendar", path: "/calendar" },
      { icon: ClipboardList, label: "Forms", path: "/forms" },
      { icon: Star, label: "Reputation", path: "/reputation" },
    ],
  },
  {
    section: "Outreach",
    items: [
      { icon: Phone, label: "AI Calls", path: "/ai-calls" },
      { icon: PhoneCall, label: "Power Dialer", path: "/power-dialer" },
      { icon: Send, label: "Campaigns", path: "/campaigns" },
      { icon: ListOrdered, label: "Sequences", path: "/sequences" },
      { icon: ShieldCheck, label: "SMS Compliance", path: "/sms-compliance" },
    ],
  },
  {
    section: "Content",
    items: [
      { icon: BookOpen, label: "Content Hub", path: "/content-hub" },
      { icon: FileText, label: "Pages & Funnels", path: "/pages" },
    ],
  },
  {
    section: "Automation",
    items: [
      { icon: Zap, label: "Automations", path: "/automations" },
      { icon: Clock, label: "Message Queue", path: "/message-queue" },
    ],
  },
  {
    section: "Insights",
    items: [
      { icon: BarChart3, label: "Analytics", path: "/analytics" },
      { icon: Activity, label: "Dialer Analytics", path: "/dialer-analytics" },
    ],
  },
];

// Flat list for route matching (backward compat)
const subAccountMenuItems: NavItem[] = subAccountNavGroups.flatMap(g => g.items);

// Add billing separately (shown in footer area)
const billingItem: NavItem = { icon: CreditCard, label: "Billing", path: "/billing" };

/**
 * Agency-level pages — only shown to agency_admin in Agency Overview mode
 * (no sub-account selected).
 */
const agencyMenuItems = [
  { icon: LayoutDashboard, label: "Overview", path: "/" },
  { icon: Building2, label: "Sub-Accounts", path: "/accounts" },
  { icon: Users, label: "Users", path: "/team" },
  { icon: CreditCard, label: "Billing", path: "/billing" },
];

/**
 * Admin section — Sub-Accounts link shown when admin has a sub-account selected.
 * This lets them jump back to the sub-accounts list.
 */
const adminMenuItems = [
  { icon: Building2, label: "Sub-Accounts", path: "/accounts" },
];

const settingsMenuItems = [
  { icon: Users, label: "Team", path: "/settings/team" },
  { icon: LifeBuoy, label: "Support", path: "/support" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

const hiddenMenuItems = [
  { icon: MessageSquare, label: "Messages", path: "/messages" },
  { icon: Mail, label: "Email Templates", path: "/email-templates" },
  { icon: Globe, label: "Websites", path: "/websites", placeholder: true },
];

/**
 * SidebarLogo — renders the branded logo in the sidebar header.
 * Uses branding context to show custom logo/name or falls back to defaults.
 */
function SidebarLogo({ isCollapsed }: { isCollapsed: boolean }) {
  const { brandName, logoUrl } = useBranding();
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={brandName || "Logo"}
          className="h-8 w-8 rounded-lg object-contain shrink-0"
          onError={(e) => {
            // Fallback to default icon if image fails to load
            (e.target as HTMLImageElement).style.display = "none";
            (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
          }}
        />
      ) : null}
      <div className={`h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0 ${logoUrl ? "hidden" : ""}`}>
        <span className="text-sm font-bold text-primary-foreground">
          {(brandName || "S").charAt(0).toUpperCase()}
        </span>
      </div>
      {!isCollapsed && (
        <span className="text-[15px] font-bold tracking-tight text-foreground truncate">
          {brandName || "Sterling Marketing"}
        </span>
      )}
    </div>
  );
}

/**
 * MobileLogo — renders the branded logo in the mobile top bar.
 */
function MobileLogo() {
  const { brandName, logoUrl } = useBranding();
  return (
    <div className="flex items-center gap-1.5">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={brandName || "Logo"}
          className="h-7 w-7 rounded-md object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
            (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
          }}
        />
      ) : null}
      <div className={`h-7 w-7 rounded-md bg-primary flex items-center justify-center ${logoUrl ? "hidden" : ""}`}>
        <span className="text-xs font-bold text-primary-foreground">
          {(brandName || "S").charAt(0).toUpperCase()}
        </span>
      </div>
      <span className="text-sm font-bold tracking-tight text-foreground truncate">
        {brandName || "Sterling Marketing"}
      </span>
    </div>
  );
}

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
  const [location, navigate] = useLocation();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  // Onboarding enforcement
  useEffect(() => {
    if (loading || accountLoading) return;
    if (!user || !currentAccount) return;
    if (isAdmin && !isImpersonating) return;
    // Don't redirect if already on the onboarding page
    if (location.startsWith("/onboarding")) return;
    if ((currentAccount as any).onboardingComplete === false || (currentAccount as any).onboardingComplete === 0) {
      navigate("/onboarding");
    }
  }, [loading, accountLoading, user, currentAccount, isAdmin, isImpersonating, navigate, location]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 mb-4">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663346016577/KNXKWFANWEUxWWEfuwT2Hr/SterlingLogo_4a16d233.png"
                alt="Sterling Marketing"
                className="h-12 w-12 rounded-lg object-contain"
              />
              <span className="text-2xl font-bold tracking-tight text-foreground">
                Sterling <span className="font-extrabold">Marketing</span>
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
  const [currentLocation, setLocation] = useLocation();
  const { state, toggleSidebar, setOpenMobile } = useSidebar();
  const { currentAccountId, isAdmin, isImpersonating, isAgencyScope, isLoading: accountLoading } = useAccount();
  const { theme, toggleTheme, switchable } = useTheme();
  // ── Page context for Jarvis panel ──
  const pageContext = useMemo(() => {
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
    if (exactPageMap[currentLocation]) return exactPageMap[currentLocation];
    const prefixMap: Array<[string, string]> = [
      ["/campaigns/", "campaigns"],
      ["/contacts/", "contacts"],
      ["/automations/", "automations"],
      ["/settings/", "settings"],
      ["/ai-calls/", "ai-calls"],
      ["/pipeline/", "pipeline"],
    ];
    for (const [prefix, ctx] of prefixMap) {
      if (currentLocation.startsWith(prefix)) return ctx;
    }
    return currentLocation.replace(/^\//, "") || "dashboard";
  }, [currentLocation]);

  // Show Jarvis floating widget on sub-account pages only (not agency-level or settings)
  const showJarvisWidget = !!currentAccountId && !isAgencyScope;

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
    (item) => item.path === currentLocation
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
            {/* Logo row — uses branding if available, collapses to icon when sidebar is collapsed */}
            <SidebarLogo isCollapsed={isCollapsed} />
            {/* Account switcher below logo */}
            {!isCollapsed && (
              <div className="px-2 pb-2">
                <AccountSwitcher />
              </div>
            )}
          </SidebarHeader>

          <SidebarContent>
            {(isAdmin && isAgencyScope) ? (
              /* Agency scope — flat list */
              <div className="px-2 py-2">
                {!isCollapsed && (
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-2 mb-1">
                    Agency
                  </p>
                )}
                <SidebarMenu>
                  {agencyMenuItems.map((item) => (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        isActive={item.path === currentLocation}
                        onClick={() => handleNavClick(item)}
                        tooltip={item.label}
                        className="cursor-pointer touch-manipulation min-h-[44px]"
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </div>
            ) : (
              /* Sub-account scope — grouped sections */
              <>
                {subAccountNavGroups.map((group) => (
                  <div key={group.section || "_top"} className={`px-2 ${group.section ? "py-1" : "pt-2 pb-1"}`}>
                    {group.section && !isCollapsed && (
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-2 mb-0.5 mt-1">
                        {group.section}
                      </p>
                    )}
                    {group.section && isCollapsed && (
                      <div className="border-t border-sidebar-border my-1" />
                    )}
                    <SidebarMenu>
                      {group.items.map((item) => {
                        const isActive = item.path === currentLocation;
                        const showBadge = item.path === "/inbox" && unreadCount > 0;
                        const isJarvis = !!(item as NavItem).jarvis;
                        return (
                          <SidebarMenuItem key={item.path}>
                            <SidebarMenuButton
                              isActive={isActive}
                              onClick={() => {
                                if (isJarvis) {
                                  setLocation("/jarvis");
                                  if (isMobile) setOpenMobile(false);
                                  return;
                                }
                                handleNavClick(item);
                              }}
                              tooltip={item.label}
                              className="cursor-pointer touch-manipulation min-h-[40px]"
                            >
                              <div className="relative">
                                <item.icon className="h-4 w-4 shrink-0" />
                                {isJarvis && (
                                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-sidebar" />
                                )}
                              </div>
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
                ))}

                {/* Admin shortcut section */}
                {showAdminSection && (
                  <div className="px-2 py-1">
                    {!isCollapsed && (
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-2 mb-0.5 mt-1">
                        Admin
                      </p>
                    )}
                    {isCollapsed && (
                      <div className="border-t border-sidebar-border my-1" />
                    )}
                    <SidebarMenu>
                      {adminMenuItems.map((item) => (
                        <SidebarMenuItem key={item.path}>
                          <SidebarMenuButton
                            isActive={item.path === currentLocation}
                            onClick={() => handleNavClick(item)}
                            tooltip={item.label}
                            className="cursor-pointer touch-manipulation min-h-[40px]"
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span>{item.label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </div>
                )}
              </>
            )}
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border">
            <div className="px-2 py-2">
              {/* Theme toggle row */}
              {switchable && !isCollapsed && (
                <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground mb-1">
                  <span>{theme === "dark" ? "Dark Mode" : "Light Mode"}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleTheme}>
                    {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </Button>
                </div>
              )}
              {switchable && isCollapsed && (
                <div className="flex justify-center py-1 mb-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleTheme} title="Toggle theme">
                    {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </Button>
                </div>
              )}
              <SidebarMenu>
                {/* Billing link */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={currentLocation === "/billing"}
                    onClick={() => handleNavClick(billingItem)}
                    tooltip="Billing"
                    className="cursor-pointer touch-manipulation min-h-[40px]"
                  >
                    <CreditCard className="h-4 w-4 shrink-0" />
                    <span>Billing</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {settingsMenuItems.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={currentLocation.startsWith("/settings")}
                      onClick={() => handleNavClick(item)}
                      tooltip={item.label}
                      className="cursor-pointer touch-manipulation min-h-[40px]"
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

      <SidebarInset className="min-h-0 overflow-hidden">
        {/* Top bar */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 gap-3">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="-ml-1 min-h-[44px] min-w-[44px] touch-manipulation" />

            {/* Mobile: centered logo */}
            {isMobile && <MobileLogo />}

            {/* Desktop: Breadcrumb / page title */}
            {!isMobile && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {activeMenuItem?.label || "Dashboard"}
                </span>
              </div>
            )}

            {/* Global search bar */}
            <div className="hidden md:flex items-center">
              <GlobalSearch />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification bell */}
            <NotificationCenter />

            {/* Dark mode toggle */}
            {switchable && (
              <Button variant="ghost" size="icon" onClick={toggleTheme} title="Toggle theme" className="h-9 w-9">
                {theme === "dark"
                  ? <Sun className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                  : <Moon className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                }
              </Button>
            )}

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
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <main className="flex-1 min-w-0 overflow-y-auto">
            {accountLoading ? (
              <div className="flex items-center justify-center min-h-[50vh]">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
              </div>
            ) : (
              <div className="p-4 md:p-6">{children}</div>
            )}
          </main>
        </div>
        {/* Floating Jarvis Widget — always available */}
        {showJarvisWidget && (
          <JarvisPanel pageContext={pageContext} mode="widget" />
        )}
      </SidebarInset>
    </>
  );
}


