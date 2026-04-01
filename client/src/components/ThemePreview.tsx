import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Eye,
  Bell,
  Check,
  Star,
  ArrowRight,
  Mail,
  User,
  Search,
} from "lucide-react";

/** Quick luminance check for contrast */
function contrastColor(hex: string): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.55 ? "#1a1a1a" : "#ffffff";
  } catch {
    return "#ffffff";
  }
}

interface ThemePreviewProps {
  primaryColor: string;
  secondaryColor: string;
  brandName: string;
}

export function ThemePreview({ primaryColor, secondaryColor, brandName }: ThemePreviewProps) {
  const primary = primaryColor || "#0c5ab0";
  const secondary = secondaryColor || "#f1f5f9";
  const name = brandName || "Your Agency";
  const primaryFg = contrastColor(primary);
  const secondaryFg = contrastColor(secondary);

  return (
    <Card className="bg-white border-0 card-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          Theme Preview
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          See how your primary and secondary colors appear across different UI elements.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Color Swatches */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className="h-8 w-8 rounded-lg shadow-sm border border-black/5"
              style={{ backgroundColor: primary }}
            />
            <div className="text-xs">
              <p className="font-medium">Primary</p>
              <p className="text-muted-foreground font-mono">{primary}</p>
            </div>
          </div>
          <Separator orientation="vertical" className="h-8" />
          <div className="flex items-center gap-2">
            <div
              className="h-8 w-8 rounded-lg shadow-sm border border-black/5"
              style={{ backgroundColor: secondary }}
            />
            <div className="text-xs">
              <p className="font-medium">Secondary</p>
              <p className="text-muted-foreground font-mono">{secondaryColor ? secondary : "Default"}</p>
            </div>
          </div>
        </div>

        <Separator className="bg-border/50" />

        {/* Buttons */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Buttons</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium shadow-sm transition-colors"
              style={{ backgroundColor: primary, color: primaryFg }}
            >
              <Mail className="h-3 w-3" /> Send Email
            </button>
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium shadow-sm transition-colors"
              style={{ backgroundColor: secondary, color: secondaryFg }}
            >
              <Star className="h-3 w-3" /> Favorite
            </button>
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors"
              style={{ borderColor: primary, color: primary }}
            >
              <ArrowRight className="h-3 w-3" /> View Details
            </button>
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>

        <Separator className="bg-border/50" />

        {/* Badges */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Badges &amp; Tags</p>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={{ backgroundColor: primary, color: primaryFg }}
            >
              <Check className="h-2.5 w-2.5" /> Active
            </span>
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={{ backgroundColor: secondary, color: secondaryFg }}
            >
              <Bell className="h-2.5 w-2.5" /> 3 New
            </span>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border"
              style={{ borderColor: primary, color: primary }}
            >
              Mortgage
            </span>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border"
              style={{ borderColor: secondary, color: secondaryFg, backgroundColor: `${secondary}33` }}
            >
              Real Estate
            </span>
          </div>
        </div>

        <Separator className="bg-border/50" />

        {/* Navigation / Sidebar Preview */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Navigation</p>
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <div className="flex">
              {/* Mini sidebar */}
              <div className="w-36 bg-[#1a1a2e] p-2 space-y-0.5">
                <div
                  className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium"
                  style={{ backgroundColor: primary, color: primaryFg }}
                >
                  <User className="h-3 w-3" /> Contacts
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] text-gray-400 hover:text-white">
                  <Mail className="h-3 w-3" /> Campaigns
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] text-gray-400 hover:text-white">
                  <Star className="h-3 w-3" /> Pipeline
                </div>
              </div>
              {/* Mini content */}
              <div className="flex-1 p-3 bg-muted/20">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="h-5 w-5 rounded flex items-center justify-center text-[8px] font-bold"
                    style={{ backgroundColor: primary, color: primaryFg }}
                  >
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-[10px] font-semibold">{name}</span>
                </div>
                <div className="space-y-1">
                  <div className="h-1.5 w-3/4 rounded bg-muted" />
                  <div className="h-1.5 w-1/2 rounded bg-muted" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <Separator className="bg-border/50" />

        {/* Form Elements */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Form Elements</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-[10px]">Search Contacts</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <input
                  readOnly
                  placeholder="Search..."
                  className="w-full h-7 pl-7 pr-2 text-[10px] rounded-md border border-border bg-background focus:outline-none"
                  style={{ borderColor: "transparent", boxShadow: `0 0 0 2px ${primary}40` }}
                />
              </div>
              <p className="text-[9px] text-muted-foreground">Focus ring uses primary color</p>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Toggle Selection</Label>
              <div className="flex items-center gap-2">
                <div
                  className="h-4 w-7 rounded-full relative cursor-pointer"
                  style={{ backgroundColor: primary }}
                >
                  <div
                    className="absolute top-0.5 right-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-all"
                  />
                </div>
                <span className="text-[10px]">Enabled</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-7 rounded-full relative cursor-pointer bg-muted">
                  <div className="absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-all" />
                </div>
                <span className="text-[10px] text-muted-foreground">Disabled</span>
              </div>
            </div>
          </div>
        </div>

        <Separator className="bg-border/50" />

        {/* Alerts / Notifications */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Alerts &amp; Notifications</p>
          <div className="space-y-2">
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-md text-[10px]"
              style={{ backgroundColor: `${primary}15`, borderLeft: `3px solid ${primary}`, color: primary }}
            >
              <Check className="h-3 w-3 flex-shrink-0" />
              <span>Lead successfully assigned to pipeline stage.</span>
            </div>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-md text-[10px]"
              style={{ backgroundColor: `${secondary}30`, borderLeft: `3px solid ${secondary}`, color: secondaryFg }}
            >
              <Bell className="h-3 w-3 flex-shrink-0" />
              <span>3 new contacts added from your landing page.</span>
            </div>
          </div>
        </div>

        <Separator className="bg-border/50" />

        {/* Data Table Row Preview */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Table Row</p>
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <div className="grid grid-cols-[1fr_80px_80px_60px] gap-2 px-3 py-1.5 bg-muted/50 text-[9px] font-semibold text-muted-foreground uppercase">
              <span>Contact</span>
              <span>Status</span>
              <span>Source</span>
              <span></span>
            </div>
            <div className="grid grid-cols-[1fr_80px_80px_60px] gap-2 px-3 py-2 items-center border-t border-border/30">
              <div className="flex items-center gap-2">
                <div
                  className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold"
                  style={{ backgroundColor: primary, color: primaryFg }}
                >
                  JD
                </div>
                <span className="text-[10px] font-medium">John Doe</span>
              </div>
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-medium w-fit"
                style={{ backgroundColor: `${primary}20`, color: primary }}
              >
                Qualified
              </span>
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-medium w-fit"
                style={{ backgroundColor: `${secondary}40`, color: secondaryFg }}
              >
                Website
              </span>
              <button
                className="text-[9px] font-medium"
                style={{ color: primary }}
              >
                View &rarr;
              </button>
            </div>
            <div className="grid grid-cols-[1fr_80px_80px_60px] gap-2 px-3 py-2 items-center border-t border-border/30 bg-muted/20">
              <div className="flex items-center gap-2">
                <div
                  className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold"
                  style={{ backgroundColor: secondary, color: secondaryFg }}
                >
                  AS
                </div>
                <span className="text-[10px] font-medium">Alice Smith</span>
              </div>
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-medium w-fit"
                style={{ backgroundColor: `${secondary}40`, color: secondaryFg }}
              >
                New Lead
              </span>
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-medium w-fit"
                style={{ backgroundColor: `${primary}15`, color: primary }}
              >
                Referral
              </span>
              <button
                className="text-[9px] font-medium"
                style={{ color: primary }}
              >
                View &rarr;
              </button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
