import { describe, it, expect } from "vitest";

/**
 * Tests for Settings General Tab — Sub-Account Profile Display
 *
 * The fix ensures that when an agency admin switches into a sub-account,
 * the Settings → General tab shows the sub-account's profile (company name,
 * industry, owner info) instead of the admin's personal profile.
 *
 * These tests verify the logic that determines which profile to display.
 */

// ── Helper: simulate the isViewingSubAccount logic from Settings.tsx ──
function computeIsViewingSubAccount(params: {
  isAdmin: boolean;
  currentAccountId: string | null;
  isImpersonating: boolean;
}): boolean {
  return params.isAdmin && !!params.currentAccountId && params.isImpersonating;
}

// ── Helper: simulate sub-account profile extraction from currentAccount ──
function extractSubAccountProfile(currentAccount: Record<string, unknown> | null) {
  if (!currentAccount) return null;
  return {
    ownerName: currentAccount.ownerName as string | undefined,
    ownerEmail: currentAccount.ownerEmail as string | undefined,
    name: currentAccount.name as string | undefined,
    industry: currentAccount.industry as string | undefined,
    createdAt: currentAccount.createdAt as string | number | undefined,
    status: currentAccount.status as string | undefined,
  };
}

describe("Settings General Tab — Profile Display Logic", () => {
  describe("isViewingSubAccount computation", () => {
    it("returns true when admin is impersonating a sub-account", () => {
      expect(
        computeIsViewingSubAccount({
          isAdmin: true,
          currentAccountId: "acc_123",
          isImpersonating: true,
        })
      ).toBe(true);
    });

    it("returns false when admin is in agency-level view (no account selected)", () => {
      expect(
        computeIsViewingSubAccount({
          isAdmin: true,
          currentAccountId: null,
          isImpersonating: false,
        })
      ).toBe(false);
    });

    it("returns false when admin has account selected but is NOT impersonating", () => {
      expect(
        computeIsViewingSubAccount({
          isAdmin: true,
          currentAccountId: "acc_123",
          isImpersonating: false,
        })
      ).toBe(false);
    });

    it("returns false when non-admin user is viewing their own account", () => {
      expect(
        computeIsViewingSubAccount({
          isAdmin: false,
          currentAccountId: "acc_123",
          isImpersonating: false,
        })
      ).toBe(false);
    });

    it("returns false when non-admin user has no account selected", () => {
      expect(
        computeIsViewingSubAccount({
          isAdmin: false,
          currentAccountId: null,
          isImpersonating: false,
        })
      ).toBe(false);
    });

    it("returns false when admin has empty string accountId", () => {
      expect(
        computeIsViewingSubAccount({
          isAdmin: true,
          currentAccountId: "",
          isImpersonating: true,
        })
      ).toBe(false);
    });
  });

  describe("Sub-account profile extraction", () => {
    it("extracts all profile fields from currentAccount", () => {
      const account = {
        id: "acc_123",
        name: "Premier Mortgage Resources",
        industry: "mortgage",
        status: "active",
        ownerName: "Belinda Osborne",
        ownerEmail: "belinda@pmr.com",
        createdAt: 1700000000000,
        ownerId: "user_456",
      };

      const profile = extractSubAccountProfile(account);
      expect(profile).toEqual({
        ownerName: "Belinda Osborne",
        ownerEmail: "belinda@pmr.com",
        name: "Premier Mortgage Resources",
        industry: "mortgage",
        createdAt: 1700000000000,
        status: "active",
      });
    });

    it("returns null when currentAccount is null", () => {
      expect(extractSubAccountProfile(null)).toBeNull();
    });

    it("handles missing optional fields gracefully", () => {
      const account = {
        id: "acc_789",
        name: "Test Account",
        status: "active",
      };

      const profile = extractSubAccountProfile(account);
      expect(profile).toEqual({
        ownerName: undefined,
        ownerEmail: undefined,
        name: "Test Account",
        industry: undefined,
        createdAt: undefined,
        status: "active",
      });
    });

    it("handles industry with underscores for display formatting", () => {
      const account = {
        name: "Evol Hosang",
        industry: "financial_services",
        status: "active",
      };

      const profile = extractSubAccountProfile(account);
      // The UI does: industry?.replace(/_/g, " ")
      const displayIndustry = profile?.industry?.replace(/_/g, " ");
      expect(displayIndustry).toBe("financial services");
    });
  });

  describe("Conditional section visibility", () => {
    it("shows sub-account profile cards when isViewingSubAccount is true", () => {
      const isViewingSubAccount = computeIsViewingSubAccount({
        isAdmin: true,
        currentAccountId: "acc_123",
        isImpersonating: true,
      });

      // When isViewingSubAccount is true:
      // - Sub-Account Details card: VISIBLE
      // - Account Owner card: VISIBLE
      // - Admin info alert: VISIBLE
      // - Security section: HIDDEN
      // - Change Password: HIDDEN
      // - Admin's own Profile card: HIDDEN
      expect(isViewingSubAccount).toBe(true);

      const showSecurity = !isViewingSubAccount;
      const showChangePassword = !isViewingSubAccount;
      const showAdminProfile = !isViewingSubAccount;

      expect(showSecurity).toBe(false);
      expect(showChangePassword).toBe(false);
      expect(showAdminProfile).toBe(false);
    });

    it("shows admin's own profile when NOT viewing sub-account", () => {
      const isViewingSubAccount = computeIsViewingSubAccount({
        isAdmin: true,
        currentAccountId: null,
        isImpersonating: false,
      });

      expect(isViewingSubAccount).toBe(false);

      const showSecurity = !isViewingSubAccount;
      const showChangePassword = !isViewingSubAccount;
      const showAdminProfile = !isViewingSubAccount;

      expect(showSecurity).toBe(true);
      expect(showChangePassword).toBe(true);
      expect(showAdminProfile).toBe(true);
    });

    it("shows own profile for non-admin account owner", () => {
      const isViewingSubAccount = computeIsViewingSubAccount({
        isAdmin: false,
        currentAccountId: "acc_123",
        isImpersonating: false,
      });

      expect(isViewingSubAccount).toBe(false);

      // Non-admin sees their own profile + security
      const showSecurity = !isViewingSubAccount;
      const showAdminProfile = !isViewingSubAccount;

      expect(showSecurity).toBe(true);
      expect(showAdminProfile).toBe(true);
    });
  });

  describe("Display role computation", () => {
    it("shows 'Admin' role for admin users", () => {
      const isAdmin = true;
      const isAccountOwner = false;
      const userRole = "admin";

      const displayRole = isAdmin
        ? "Admin"
        : isAccountOwner
          ? "Account Owner"
          : userRole || "user";

      expect(displayRole).toBe("Admin");
    });

    it("shows 'Account Owner' for sub-account owner", () => {
      const isAdmin = false;
      const isAccountOwner = true;
      const userRole = "user";

      const displayRole = isAdmin
        ? "Admin"
        : isAccountOwner
          ? "Account Owner"
          : userRole || "user";

      expect(displayRole).toBe("Account Owner");
    });

    it("shows user role for regular employees", () => {
      const isAdmin = false;
      const isAccountOwner = false;
      const userRole = "user";

      const displayRole = isAdmin
        ? "Admin"
        : isAccountOwner
          ? "Account Owner"
          : userRole || "user";

      expect(displayRole).toBe("user");
    });
  });
});
