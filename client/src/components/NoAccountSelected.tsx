import { Building2 } from "lucide-react";
import { useAccount } from "@/contexts/AccountContext";

/**
 * NoAccountSelected — shown when no account is active.
 *
 * For admins in agency scope: prompts them to select an account from the sidebar.
 * For clients with no accounts: tells them to ask an admin for access.
 */
export function NoAccountSelected() {
  const { isAdmin } = useAccount();

  if (isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4">
          <Building2 className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium mb-1">No account selected</p>
        <p className="text-xs text-muted-foreground max-w-sm">
          Select a sub-account from the sidebar to view its data, or switch to a
          specific account using the account selector above.
        </p>
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
