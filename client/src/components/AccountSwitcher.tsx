import { useAccount } from "@/contexts/AccountContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";

/**
 * AccountSwitcher — admin-only dropdown to switch between sub-accounts.
 * Clients never see this component.
 * When impersonating, the impersonated account is shown and the selector is disabled.
 */
export function AccountSwitcher({ collapsed }: { collapsed?: boolean }) {
  const {
    currentAccountId,
    accounts,
    isAdmin,
    isImpersonating,
    switchAccount,
  } = useAccount();

  // Only admins see the account switcher
  if (!isAdmin) return null;

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

  return (
    <div className="px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-1.5 px-0.5">
        Active Account
      </p>
      <Select
        value={currentAccountId?.toString() ?? ""}
        onValueChange={(val) => switchAccount(parseInt(val, 10))}
        disabled={isImpersonating}
      >
        <SelectTrigger className="h-8 text-xs bg-sidebar-accent/30 border-sidebar-border/50">
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
            <SelectValue placeholder="Select account" />
          </div>
        </SelectTrigger>
        <SelectContent>
          {accounts.map((account) => (
            <SelectItem
              key={account.id}
              value={account.id.toString()}
              className="text-xs"
            >
              {account.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
