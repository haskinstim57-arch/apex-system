import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

/**
 * AccountContext — single source of truth for the current account.
 *
 * Resolution priority:
 * 1. impersonated_account_id (admin impersonating a client)
 * 2. user-selected account (admin switching between accounts)
 * 3. For CLIENTS: first account from user's memberships (auto-select)
 * 4. For ADMINS: null (agency scope — must explicitly choose an account)
 *
 * Clients only ever see their own accounts.
 * Admins see all accounts and can switch freely.
 * Admins start in "agency scope" (no account selected) and must pick one.
 */

type Account = {
  id: number;
  name: string;
  status?: string | null;
  industry?: string | null;
  [key: string]: unknown;
};

type AccountContextValue = {
  /** The currently active account ID (null if none resolved yet or admin in agency scope) */
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
  /** Whether admin is in agency scope (no account selected) */
  isAgencyScope: boolean;
  /** Switch to a different account (admin only) */
  switchAccount: (accountId: number) => void;
  /** Return to agency scope (admin only — deselect account) */
  clearAccount: () => void;
};

const AccountContext = createContext<AccountContextValue>({
  currentAccountId: null,
  currentAccount: null,
  accounts: [],
  isLoading: true,
  isAdmin: false,
  isImpersonating: false,
  impersonatedAccountName: null,
  isAgencyScope: false,
  switchAccount: () => {},
  clearAccount: () => {},
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
  // 2. User-selected account (persisted in localStorage)
  // 3. For CLIENTS: first available account (auto-select)
  // 4. For ADMINS: null (agency scope — no auto-select)
  const currentAccountId = useMemo(() => {
    if (impersonatedAccountId) return impersonatedAccountId;
    if (selectedAccountId && accounts.some((a) => a.id === selectedAccountId)) {
      return selectedAccountId;
    }
    // Clients auto-select their first account; admins stay in agency scope
    if (!isAdmin && accounts.length > 0) return accounts[0].id;
    return null;
  }, [impersonatedAccountId, selectedAccountId, accounts, isAdmin]);

  const currentAccount = useMemo(() => {
    if (!currentAccountId) return null;
    return accounts.find((a) => a.id === currentAccountId) ?? null;
  }, [currentAccountId, accounts]);

  // Whether admin is in agency scope (no specific account selected)
  const isAgencyScope = isAdmin && !currentAccountId;

  // Persist selection
  useEffect(() => {
    if (selectedAccountId) {
      localStorage.setItem(SELECTED_ACCOUNT_KEY, selectedAccountId.toString());
    } else {
      localStorage.removeItem(SELECTED_ACCOUNT_KEY);
    }
  }, [selectedAccountId]);

  const switchAccount = useCallback((accountId: number) => {
    setSelectedAccountId(accountId);
  }, []);

  const clearAccount = useCallback(() => {
    setSelectedAccountId(null);
    localStorage.removeItem(SELECTED_ACCOUNT_KEY);
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
      isAgencyScope,
      switchAccount,
      clearAccount,
    }),
    [
      currentAccountId,
      currentAccount,
      accounts,
      isLoading,
      isAdmin,
      isImpersonating,
      impersonatedAccountName,
      isAgencyScope,
      switchAccount,
      clearAccount,
    ]
  );

  return (
    <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
  );
}

export function useAccount() {
  return useContext(AccountContext);
}
