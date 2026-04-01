import { createContext, useContext, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAccount } from "./AccountContext";

/**
 * BrandingContext — applies white-label branding globally.
 *
 * Fetches branding for the current account (with parent cascade on the server)
 * and injects:
 *   - CSS custom property `--primary` (and related) so Tailwind `bg-primary`, `text-primary` etc. respond
 *   - Sidebar logo URL + brand name (consumed by DashboardLayout)
 *   - Favicon link element
 *   - Document title
 */

type BrandingValue = {
  brandName: string | null;
  primaryColor: string;
  secondaryColor: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  customDomain: string | null;
  isLoading: boolean;
};

const defaultBranding: BrandingValue = {
  brandName: null,
  primaryColor: "#d4a843",
  secondaryColor: null,
  logoUrl: null,
  faviconUrl: null,
  customDomain: null,
  isLoading: true,
};

const BrandingContext = createContext<BrandingValue>(defaultBranding);

/**
 * Convert a hex color to OKLCH CSS string.
 * Falls back to the hex value if conversion fails.
 */
function hexToOklch(hex: string): string {
  // For dynamic branding we set the CSS variable directly as a hex value.
  // Tailwind 4's @theme maps --color-primary → var(--primary), so we
  // override --primary at runtime. Since CSS custom properties accept any
  // valid color, hex works fine here.
  return hex;
}

/**
 * Compute a contrasting foreground color (white or dark) for a given hex background.
 */
function contrastForeground(hex: string): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    // Relative luminance (simplified)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.55 ? "#1a1a1a" : "#ffffff";
  } catch {
    return "#ffffff";
  }
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { currentAccountId } = useAccount();

  const { data: branding, isLoading } = trpc.accounts.getBranding.useQuery(
    { accountId: currentAccountId! },
    {
      enabled: !!currentAccountId,
      staleTime: 60_000, // Cache for 1 minute
      refetchOnWindowFocus: false,
    }
  );

  // Apply primary color as CSS variable
  useEffect(() => {
    const color = branding?.primaryColor || "#d4a843";
    const fg = contrastForeground(color);
    const root = document.documentElement;

    // Override the CSS custom properties that Tailwind reads
    root.style.setProperty("--primary", color);
    root.style.setProperty("--primary-foreground", fg);
    // Also override ring and sidebar-primary to match
    root.style.setProperty("--ring", color);
    root.style.setProperty("--sidebar-primary", color);
    root.style.setProperty("--sidebar-primary-foreground", fg);

    return () => {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--primary-foreground");
      root.style.removeProperty("--ring");
      root.style.removeProperty("--sidebar-primary");
      root.style.removeProperty("--sidebar-primary-foreground");
    };
  }, [branding?.primaryColor]);

  // Apply secondary color as CSS variable
  useEffect(() => {
    const secondary = branding?.secondaryColor;
    if (!secondary) return;

    const fg = contrastForeground(secondary);
    const root = document.documentElement;

    root.style.setProperty("--secondary", secondary);
    root.style.setProperty("--secondary-foreground", fg);
    // Also map to accent so badges, hover states, and muted accents respond
    root.style.setProperty("--accent", secondary);
    root.style.setProperty("--accent-foreground", fg);

    return () => {
      root.style.removeProperty("--secondary");
      root.style.removeProperty("--secondary-foreground");
      root.style.removeProperty("--accent");
      root.style.removeProperty("--accent-foreground");
    };
  }, [branding?.secondaryColor]);

  // Apply favicon
  useEffect(() => {
    const faviconUrl = branding?.faviconUrl;
    if (!faviconUrl) return;

    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    const originalHref = link?.href;

    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = faviconUrl;

    return () => {
      if (link && originalHref) {
        link.href = originalHref;
      }
    };
  }, [branding?.faviconUrl]);

  // Apply page title
  useEffect(() => {
    const name = branding?.brandName;
    if (name) {
      document.title = name;
    } else {
      document.title = "Sterling Marketing";
    }
    return () => {
      document.title = "Sterling Marketing";
    };
  }, [branding?.brandName]);

  const value = useMemo<BrandingValue>(
    () => ({
      brandName: branding?.brandName ?? null,
      primaryColor: branding?.primaryColor ?? "#d4a843",
      secondaryColor: branding?.secondaryColor ?? null,
      logoUrl: branding?.logoUrl ?? null,
      faviconUrl: branding?.faviconUrl ?? null,
      customDomain: branding?.customDomain ?? null,
      isLoading,
    }),
    [branding, isLoading]
  );

  return (
    <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
