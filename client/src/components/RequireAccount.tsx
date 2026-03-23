import { useAccount } from "@/contexts/AccountContext";
import { useLocation } from "wouter";
import { useEffect } from "react";

/**
 * RequireAccount — wraps children and redirects to home if no sub-account is selected.
 * Used to protect sub-account-level routes (contacts, campaigns, etc.)
 * from being accessed when in agency scope (no account selected).
 */
export function RequireAccount({ children }: { children: React.ReactNode }) {
  const { currentAccountId, isLoading, isAdmin, isAgencyScope } = useAccount();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && isAdmin && isAgencyScope) {
      setLocation("/");
    }
  }, [isLoading, isAdmin, isAgencyScope, setLocation]);

  if (isLoading) return null;
  if (isAdmin && isAgencyScope) return null;

  return <>{children}</>;
}
