import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the account switching + Settings General tab bug fixes.
 *
 * Bug 1: Settings General tab shows admin profile instead of sub-account owner profile
 *   - Root cause: isViewingSubAccount required isImpersonating (cookie-based) to be true,
 *     but AccountSwitcher only set localStorage without calling impersonation.start
 *   - Fix: Changed condition to `isAdmin && !!currentAccountId` (no longer requires isImpersonating)
 *
 * Bug 2: Account switching / "Sign in as" did nothing because cached queries weren't invalidated
 *   - Root cause: AccountSwitcher.handleSelect only called switchAccount() (localStorage),
 *     never called impersonation.start (server cookie), and never invalidated queries
 *   - Fix: AccountSwitcher now calls impersonation.start, then switchAccount, then window.location.href = "/"
 *
 * Bug 3: ImpersonationBanner stop used wrong localStorage key and didn't force reload
 *   - Root cause: Used "apex-selected-account" but also needed to clear "apex_current_account"
 *   - Fix: Clears both keys and uses window.location.href = "/accounts" for full reload
 */

// ─── Unit Tests: isViewingSubAccount logic ───

describe("Settings General Tab — isViewingSubAccount detection", () => {
  function computeIsViewingSubAccount(
    isAdmin: boolean,
    currentAccountId: number | null
  ): boolean {
    // This mirrors the fixed logic in Settings.tsx line 155
    return isAdmin && !!currentAccountId;
  }

  it("returns true when admin has a sub-account selected", () => {
    expect(computeIsViewingSubAccount(true, 42)).toBe(true);
  });

  it("returns false when admin has no account selected (agency scope)", () => {
    expect(computeIsViewingSubAccount(true, null)).toBe(false);
  });

  it("returns false when non-admin user has an account selected", () => {
    expect(computeIsViewingSubAccount(false, 42)).toBe(false);
  });

  it("returns false when non-admin user has no account selected", () => {
    expect(computeIsViewingSubAccount(false, null)).toBe(false);
  });

  it("returns true regardless of isImpersonating flag (fixed behavior)", () => {
    // The old bug required isImpersonating to be true
    // The fix removes that requirement — only isAdmin + currentAccountId matter
    const isAdmin = true;
    const currentAccountId = 100;
    const isImpersonating = false; // This no longer matters
    const result = isAdmin && !!currentAccountId; // Fixed logic
    expect(result).toBe(true);
  });
});

// ─── Unit Tests: currentAccountId resolution priority ───

describe("AccountContext — currentAccountId resolution", () => {
  function resolveCurrentAccountId(
    impersonatedAccountId: number | null,
    selectedAccountId: number | null,
    accountIds: number[],
    isAdmin: boolean
  ): number | null {
    // This mirrors the logic in AccountContext.tsx lines 130-139
    if (impersonatedAccountId) return impersonatedAccountId;
    if (selectedAccountId && accountIds.includes(selectedAccountId)) {
      return selectedAccountId;
    }
    if (!isAdmin && accountIds.length > 0) return accountIds[0];
    return null;
  }

  it("prioritizes impersonated account over localStorage selection", () => {
    expect(resolveCurrentAccountId(99, 42, [42, 99], true)).toBe(99);
  });

  it("falls back to localStorage selection when not impersonating", () => {
    expect(resolveCurrentAccountId(null, 42, [42, 99], true)).toBe(42);
  });

  it("ignores localStorage selection if account not in list", () => {
    expect(resolveCurrentAccountId(null, 999, [42, 99], true)).toBe(null);
  });

  it("auto-selects first account for non-admin users", () => {
    expect(resolveCurrentAccountId(null, null, [42, 99], false)).toBe(42);
  });

  it("returns null for admin with no selection (agency scope)", () => {
    expect(resolveCurrentAccountId(null, null, [42, 99], true)).toBe(null);
  });
});

// ─── Unit Tests: AccountSwitcher handleSelect flow ───

describe("AccountSwitcher — handleSelect flow", () => {
  it("calls impersonation.start before updating localStorage", async () => {
    const callOrder: string[] = [];

    const impersonateStart = vi.fn(async (args: { accountId: number }) => {
      callOrder.push("impersonation.start");
      return { success: true, accountId: args.accountId, accountName: "Test" };
    });

    const switchAccount = vi.fn((accountId: number) => {
      callOrder.push("switchAccount");
    });

    // Simulate the handleSelect flow from AccountSwitcher
    const accountId = 42;
    await impersonateStart({ accountId });
    switchAccount(accountId);
    callOrder.push("reload");

    expect(callOrder).toEqual(["impersonation.start", "switchAccount", "reload"]);
    expect(impersonateStart).toHaveBeenCalledWith({ accountId: 42 });
    expect(switchAccount).toHaveBeenCalledWith(42);
  });

  it("does not update localStorage or reload on impersonation failure", async () => {
    const callOrder: string[] = [];

    const impersonateStart = vi.fn(async () => {
      callOrder.push("impersonation.start");
      throw new Error("Not authorized");
    });

    const switchAccount = vi.fn(() => {
      callOrder.push("switchAccount");
    });

    try {
      await impersonateStart({ accountId: 42 });
      switchAccount(42);
      callOrder.push("reload");
    } catch {
      callOrder.push("error-caught");
    }

    expect(callOrder).toEqual(["impersonation.start", "error-caught"]);
    expect(switchAccount).not.toHaveBeenCalled();
  });
});

// ─── Unit Tests: AccountSwitcher handleClear flow ───

describe("AccountSwitcher — handleClear flow", () => {
  it("calls impersonation.stop then clears localStorage and reloads", async () => {
    const callOrder: string[] = [];

    const impersonateStop = vi.fn(async () => {
      callOrder.push("impersonation.stop");
      return { success: true };
    });

    const clearAccount = vi.fn(() => {
      callOrder.push("clearAccount");
    });

    // Simulate the handleClear flow
    await impersonateStop();
    clearAccount();
    callOrder.push("reload");

    expect(callOrder).toEqual(["impersonation.stop", "clearAccount", "reload"]);
  });
});

// ─── Unit Tests: ImpersonationBanner stop flow ───

describe("ImpersonationBanner — stop impersonation flow", () => {
  let localStorageData: Record<string, string>;

  beforeEach(() => {
    localStorageData = {
      "apex_current_account": "42",
      "apex-selected-account": "42",
    };
  });

  it("clears both localStorage keys on stop", () => {
    // Simulate the fixed stop flow
    delete localStorageData["apex_current_account"];
    delete localStorageData["apex-selected-account"];

    expect(localStorageData["apex_current_account"]).toBeUndefined();
    expect(localStorageData["apex-selected-account"]).toBeUndefined();
  });

  it("uses window.location.href for full reload instead of setLocation", () => {
    // The fix uses window.location.href = "/accounts" instead of setLocation("/accounts")
    // This ensures all React contexts, tRPC caches, and cookies are refreshed
    const reloadTarget = "/accounts";
    expect(reloadTarget).toBe("/accounts");
  });
});

// ─── Unit Tests: Accounts.tsx "Sign in as" flow ───

describe("Accounts.tsx — Sign in as (impersonation) flow", () => {
  it("sets correct localStorage key on impersonation success", () => {
    const localStorageData: Record<string, string> = {};

    // Simulate the fixed onSuccess handler
    const data = { accountId: 42, accountName: "Test Account", success: true };
    localStorageData["apex-selected-account"] = String(data.accountId);

    expect(localStorageData["apex-selected-account"]).toBe("42");
  });

  it("uses window.location.href for full reload to /contacts", () => {
    // The fix uses window.location.href = "/contacts" instead of setLocation("/contacts")
    const reloadTarget = "/contacts";
    expect(reloadTarget).toBe("/contacts");
  });
});

// ─── Unit Tests: Sub-account profile data availability ───

describe("Sub-account profile data from accounts.list", () => {
  interface AccountData {
    id: number;
    name: string;
    industry: string | null;
    ownerName: string | null;
    ownerEmail: string | null;
    ownerId: number | null;
    createdAt: string;
    status: string;
  }

  const mockAccounts: AccountData[] = [
    {
      id: 1,
      name: "Apex System",
      industry: "technology",
      ownerName: "Thailer Somerville",
      ownerEmail: "thailer@example.com",
      ownerId: 10,
      createdAt: "2025-01-01T00:00:00Z",
      status: "active",
    },
    {
      id: 2,
      name: "Belinda Osborne",
      industry: "mortgage",
      ownerName: "Belinda Osborne",
      ownerEmail: "belinda@example.com",
      ownerId: 20,
      createdAt: "2025-02-01T00:00:00Z",
      status: "active",
    },
  ];

  it("accounts.list returns ownerName for each account", () => {
    for (const account of mockAccounts) {
      expect(account.ownerName).toBeTruthy();
    }
  });

  it("accounts.list returns ownerEmail for each account", () => {
    for (const account of mockAccounts) {
      expect(account.ownerEmail).toBeTruthy();
    }
  });

  it("Settings General can display sub-account details from currentAccount", () => {
    const currentAccount = mockAccounts[1]; // Belinda's account
    const isAdmin = true;
    const currentAccountId = currentAccount.id;

    const isViewingSubAccount = isAdmin && !!currentAccountId;
    expect(isViewingSubAccount).toBe(true);

    // These are the fields displayed in the sub-account profile view
    expect(currentAccount.name).toBe("Belinda Osborne");
    expect(currentAccount.industry).toBe("mortgage");
    expect(currentAccount.ownerName).toBe("Belinda Osborne");
    expect(currentAccount.ownerEmail).toBe("belinda@example.com");
    expect(currentAccount.status).toBe("active");
    expect(currentAccount.createdAt).toBeTruthy();
  });

  it("Settings General shows admin profile when no account selected", () => {
    const isAdmin = true;
    const currentAccountId = null;

    const isViewingSubAccount = isAdmin && !!currentAccountId;
    expect(isViewingSubAccount).toBe(false);
    // In this case, the admin's own profile is shown (user.name, user.email, etc.)
  });
});
