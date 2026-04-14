import { useState, useMemo, useRef, useEffect } from "react";
import { useAccount } from "@/contexts/AccountContext";
import { trpc } from "@/lib/trpc";
import { Building2, Search, Clock, ChevronDown, ChevronUp, Check, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/useMobile";
import { toast } from "sonner";

/**
 * AccountSwitcher — admin-only dropdown to switch between sub-accounts.
 * Features: search/filter, recently viewed accounts, Agency Overview toggle.
 * On mobile/PWA: expands inline within the sidebar (no portal/overlay)
 * to avoid z-index conflicts with the sidebar Sheet.
 * On desktop: uses a Popover dropdown.
 * Clients never see this component.
 *
 * When switching accounts, this component:
 * 1. Calls impersonation.start to set the server-side cookie
 * 2. Invalidates ALL cached tRPC queries
 * 3. Forces a full page reload so all contexts pick up the new account
 */
export function AccountSwitcher({ collapsed }: { collapsed?: boolean }) {
  const {
    currentAccountId,
    currentAccount,
    accounts,
    recentAccounts,
    isAdmin,
    isImpersonating,
    switchAccount,
    clearAccount,
  } = useAccount();

  const utils = trpc.useUtils();
  const impersonateStart = trpc.impersonation.start.useMutation();
  const impersonateStop = trpc.impersonation.stop.useMutation();

  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  // Only admins see the account switcher
  if (!isAdmin) return null;

  // Filter accounts by search query
  const filteredAccounts = useMemo(() => {
    if (!search.trim()) return accounts;
    const q = search.toLowerCase();
    return accounts.filter((a) => a.name.toLowerCase().includes(q));
  }, [accounts, search]);

  // Recent accounts that match the search (if searching)
  const filteredRecent = useMemo(() => {
    if (!search.trim()) return recentAccounts;
    const q = search.toLowerCase();
    return recentAccounts.filter((a) => a.name.toLowerCase().includes(q));
  }, [recentAccounts, search]);

  // Focus search input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        if (isMobile) {
          mobileSearchRef.current?.focus();
        } else {
          searchRef.current?.focus();
        }
      }, 100);
    }
    if (!open) {
      setSearch("");
    }
  }, [open, isMobile]);

  // When collapsed, show just an icon
  if (collapsed) {
    return (
      <div className="flex items-center justify-center px-2 py-1.5">
        <div className="h-7 w-7 rounded-md bg-accent flex items-center justify-center">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>
    );
  }

  const displayName = currentAccount?.name ?? "Agency Overview";

  const handleSelect = async (accountId: number) => {
    if (switching) return;
    setSwitching(true);
    setOpen(false);

    try {
      // 1. Start server-side impersonation (sets cookie)
      await impersonateStart.mutateAsync({ accountId });

      // 2. Update localStorage for client-side state
      switchAccount(accountId);

      // 3. Invalidate ALL cached queries so everything refetches with new account context
      await utils.invalidate();

      // 4. Force full page reload to ensure all contexts pick up the new cookie
      window.location.href = "/";
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("Failed to switch account", { description: message });
      setSwitching(false);
    }
  };

  const handleClear = async () => {
    if (switching) return;
    setSwitching(true);
    setOpen(false);

    try {
      // Stop impersonation on the server (clears cookie)
      await impersonateStop.mutateAsync();

      // Clear localStorage selection
      clearAccount();

      // Invalidate all queries and reload
      await utils.invalidate();
      window.location.href = "/";
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("Failed to return to agency view", { description: message });
      setSwitching(false);
    }
  };

  const accountListContent = (
    <>
      {/* Search input */}
      <div className="p-2 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            ref={isMobile ? mobileSearchRef : searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search accounts..."
            className="h-8 text-xs pl-8 bg-muted/30 border-border/50"
          />
        </div>
      </div>

      <div className="overflow-y-auto max-h-80">
        {/* Agency Overview option */}
        {!search.trim() && (
          <div className="p-1">
            <button
              className={`w-full text-left text-xs px-2.5 py-2.5 rounded-md flex items-center gap-2 transition-colors touch-manipulation min-h-[40px] ${
                !currentAccountId
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-accent active:bg-accent"
              }`}
              onClick={handleClear}
              disabled={switching}
            >
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium">Agency Overview</span>
              {!currentAccountId && (
                <Check className="h-3.5 w-3.5 ml-auto shrink-0" />
              )}
            </button>
          </div>
        )}

        {/* Recent accounts section */}
        {filteredRecent.length > 0 && (
          <div className="p-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 px-2.5 py-1 flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              Recent
            </p>
            {filteredRecent.map((account) => (
              <AccountItem
                key={`recent-${account.id}`}
                account={account}
                isSelected={currentAccountId === account.id}
                onSelect={() => handleSelect(account.id)}
                disabled={switching}
              />
            ))}
          </div>
        )}

        {/* All accounts section */}
        <div className="p-1">
          {(filteredRecent.length > 0 || !search.trim()) && (
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 px-2.5 py-1">
              {search.trim()
                ? `Results (${filteredAccounts.length})`
                : `All Accounts (${accounts.length})`}
            </p>
          )}
          {filteredAccounts.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2.5 py-3 text-center">
              No accounts match &ldquo;{search}&rdquo;
            </p>
          ) : (
            filteredAccounts.map((account) => (
              <AccountItem
                key={account.id}
                account={account}
                isSelected={currentAccountId === account.id}
                onSelect={() => handleSelect(account.id)}
                disabled={switching}
              />
            ))
          )}
        </div>
      </div>
    </>
  );

  // Mobile: expand inline within the sidebar (no portal/overlay to avoid z-index conflicts with Sheet)
  if (isMobile) {
    return (
      <div className="px-3 py-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-1.5 px-0.5">
          Active Account
        </p>
        <button
          className="w-full h-8 text-xs bg-sidebar-accent/30 border border-sidebar-border/50 rounded-md px-2.5 flex items-center gap-2 hover:bg-sidebar-accent/50 active:bg-sidebar-accent/60 transition-colors text-left touch-manipulation"
          onClick={() => setOpen(!open)}
          disabled={switching}
        >
          <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="truncate flex-1">
            {switching ? "Switching..." : displayName}
          </span>
          {open ? (
            <ChevronUp className="h-3 w-3 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
        </button>

        {/* Inline expandable account list */}
        {open && (
          <div className="mt-1 rounded-md border border-sidebar-border/50 bg-sidebar overflow-hidden animate-in slide-in-from-top-2 duration-200">
            {/* Close button header */}
            <div className="flex items-center justify-between px-2.5 pt-2 pb-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Switch Account
              </span>
              <button
                className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-accent active:bg-accent transition-colors touch-manipulation"
                onClick={() => setOpen(false)}
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
            {accountListContent}
          </div>
        )}
      </div>
    );
  }

  // Desktop: use Popover
  return (
    <div className="px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-1.5 px-0.5">
        Active Account
      </p>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild disabled={switching}>
          <button className="w-full h-8 text-xs bg-sidebar-accent/30 border border-sidebar-border/50 rounded-md px-2.5 flex items-center gap-2 hover:bg-sidebar-accent/50 transition-colors text-left">
            <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="truncate flex-1">
              {switching ? "Switching..." : displayName}
            </span>
            <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-72 p-0"
          align="start"
          side="bottom"
          sideOffset={4}
        >
          {accountListContent}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function AccountItem({
  account,
  isSelected,
  onSelect,
  disabled,
}: {
  account: { id: number; name: string; industry?: string | null; status?: string | null };
  isSelected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className={`w-full text-left text-xs px-2.5 py-2 rounded-md flex items-center gap-2 transition-colors touch-manipulation min-h-[40px] ${
        isSelected ? "bg-primary/10 text-primary" : "hover:bg-accent active:bg-accent"
      } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
      onClick={onSelect}
      disabled={disabled}
    >
      <span className="truncate flex-1">{account.name}</span>
      {account.industry && (
        <span className="text-[10px] text-muted-foreground/60 shrink-0">
          {account.industry}
        </span>
      )}
      {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
    </button>
  );
}
