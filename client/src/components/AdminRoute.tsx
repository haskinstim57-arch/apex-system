import { useAccount } from "@/contexts/AccountContext";
import { useLocation } from "wouter";
import { useEffect } from "react";

/**
 * AdminRoute — wraps children and redirects non-admin users to home.
 * Used to protect admin-only routes like /accounts, /settings/facebook-pages.
 */
export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading } = useAccount();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      setLocation("/");
    }
  }, [isAdmin, isLoading, setLocation]);

  if (isLoading) return null;
  if (!isAdmin) return null;

  return <>{children}</>;
}
