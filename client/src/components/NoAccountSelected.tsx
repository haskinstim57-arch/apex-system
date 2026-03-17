import { Building2, Loader2 } from "lucide-react";
import { useAccount } from "@/contexts/AccountContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * NoAccountSelected — shown when no account is active.
 *
 * For admins in agency scope: shows an inline account picker so they can select immediately.
 * For clients with no accounts: tells them to ask an admin for access.
 * While loading: shows a spinner.
 */
export function NoAccountSelected() {
  const { isAdmin, isLoading, accounts, switchAccount } = useAccount();

  // While accounts are still loading, show a spinner — not the "no access" message
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4">
          <Building2 className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium mb-1">No account selected</p>
        <p className="text-xs text-muted-foreground max-w-sm mb-4">
          Select a sub-account to view its data.
        </p>
        {accounts.length > 0 && (
          <Select
            onValueChange={(val) => switchAccount(parseInt(val, 10))}
          >
            <SelectTrigger className="w-64 h-9 text-xs">
              <SelectValue placeholder="Choose a sub-account..." />
            </SelectTrigger>
            <SelectContent>
              {accounts
                .filter((a) => a.status !== "suspended")
                .slice(0, 50)
                .map((account) => (
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
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4">
        <Building2 className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium mb-1">No account access</p>
      <p className="text-xs text-muted-foreground max-w-sm">
        You don't have access to any accounts yet. Ask an administrator to
        invite you to a sub-account.
      </p>
    </div>
  );
}
