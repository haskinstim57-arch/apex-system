import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

/**
 * AccountContext — single source of truth for the current account.
 *
 * Resolution priority:
 * 1. impersonated_account_id (admin impersonating a client)
 * 2. user-selected account (admin switching between accounts)
 * 3. first account from user's memberships (client default)
 *
 * Clients only ever see their own accounts.
 * Admins see all accounts and can switch freely.
 */

type Account = {
  id: number;
  name: string;
  status?: string | null;
  industry?: string | null;
  [key: string]: unknown;
};

type AccountContextValue = {
  /** The currently active account ID (null if none resolved yet) */
  currentAccountId: number | null;
  /** The currently active account object */
  currentAccount: Account | null;
  /** All accounts available to the current user */
  accounts: Account[];
  /** Whether accounts are still loading */
  isLoading: boolean;
  /** Whether the current user is an admin */
  isAdmin: boolean;
  /** Whether the admin is currently impersonating */
  isImpersonating: boolean;
  /** The impersonated account name (if impersonating) */
  impersonatedAccountName: string | null;
  /** Switch to a different account (admin only) */
  switchAccount: (accountId: number) => void;
};

const AccountContext = createContext<AccountContextValue>({
  currentAccountId: null,
  currentAccount: null,
  accounts: [],
  isLoading: true,
  isAdmin: false,
  isImpersonating: false,
  impersonatedAccountName: null,
  switchAccount: () => {},
});

const SELECTED_ACCOUNT_KEY = "apex-selected-account";

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // Load persisted account selection
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(() => {
    const saved = localStorage.getItem(SELECTED_ACCOUNT_KEY);
    return saved ? parseInt(saved, 10) : null;
  });

  // Fetch accounts available to user
  const { data: accounts = [], isLoading: accountsLoading } =
    trpc.accounts.list.useQuery(undefined, {
      enabled: !!user,
    });

  // Fetch impersonation status (admin only)
  const { data: impersonationStatus, isLoading: impersonationLoading } =
    trpc.impersonation.status.useQuery(undefined, {
      enabled: !!isAdmin,
      refetchOnWindowFocus: false,
    });

  const isImpersonating = impersonationStatus?.isImpersonating ?? false;
  const impersonatedAccountId =
    isImpersonating && impersonationStatus?.isImpersonating
      ? impersonationStatus.impersonatedAccountId
      : null;
  const impersonatedAccountName =
    isImpersonating && impersonationStatus?.isImpersonating
      ? impersonationStatus.impersonatedAccountName
      : null;

  // Resolve the current account ID with priority:
  // 1. Impersonated account (admin impersonating)
  // 2. User-selected account (persisted)
  // 3. First available account
  const currentAccountId = useMemo(() => {
    if (impersonatedAccountId) return impersonatedAccountId;
    if (selectedAccountId && accounts.some((a) => a.id === selectedAccountId)) {
      return selectedAccountId;
    }
    if (accounts.length > 0) return accounts[0].id;
    return null;
  }, [impersonatedAccountId, selectedAccountId, accounts]);

  const currentAccount = useMemo(() => {
    if (!currentAccountId) return null;
    return accounts.find((a) => a.id === currentAccountId) ?? null;
  }, [currentAccountId, accounts]);

  // Persist selection
  useEffect(() => {
    if (selectedAccountId) {
      localStorage.setItem(SELECTED_ACCOUNT_KEY, selectedAccountId.toString());
    }
  }, [selectedAccountId]);

  const switchAccount = useCallback((accountId: number) => {
    setSelectedAccountId(accountId);
  }, []);

  const isLoading = accountsLoading || (isAdmin ? impersonationLoading : false);

  const value = useMemo<AccountContextValue>(
    () => ({
      currentAccountId,
      currentAccount,
      accounts,
      isLoading,
      isAdmin: !!isAdmin,
      isImpersonating,
      impersonatedAccountName: impersonatedAccountName ?? null,
      switchAccount,
    }),
    [
      currentAccountId,
      currentAccount,
      accounts,
      isLoading,
      isAdmin,
      isImpersonating,
      impersonatedAccountName,
      switchAccount,
    ]
  );

  return (
    <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
  );
}

export function useAccount() {
  return useContext(AccountContext);
}
