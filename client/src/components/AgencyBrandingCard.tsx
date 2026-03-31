import React, { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Palette,
  Globe,
  Mail,
  Image,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Upload,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

interface AgencyBrandingCardProps {
  accountId: number;
}

export function AgencyBrandingCard({ accountId }: AgencyBrandingCardProps) {
  const utils = trpc.useUtils();
  const { data: branding, isLoading } = trpc.accounts.getBranding.useQuery({ accountId });

  // Local form state
  const [brandName, setBrandName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#d4a843");
  const [logoUrl, setLogoUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [customDomain, setCustomDomain] = useState("");

  // Email domain state
  const [emailDomain, setEmailDomain] = useState("");
  const [showDnsDialog, setShowDnsDialog] = useState(false);
  const [dnsRecords, setDnsRecords] = useState<Array<{ type: string; host: string; data: string }>>([]);
  const [sendgridDomainId, setSendgridDomainId] = useState<string | null>(null);

  // Sync branding data to form
  useEffect(() => {
    if (branding) {
      setBrandName(branding.brandName ?? "");
      setPrimaryColor(branding.primaryColor ?? "#d4a843");
      setLogoUrl(branding.logoUrl ?? "");
      setFaviconUrl(branding.faviconUrl ?? "");
      setCustomDomain(branding.customDomain ?? "");
      setEmailDomain(branding.fromEmailDomain ?? "");
    }
  }, [branding]);

  const updateBranding = trpc.accounts.updateBranding.useMutation({
    onSuccess: () => {
      toast.success("Branding settings saved");
      utils.accounts.getBranding.invalidate({ accountId });
    },
    onError: (err) => toast.error(err.message),
  });

  const setEmailDomainMut = trpc.accounts.setEmailDomain.useMutation({
    onSuccess: (result) => {
      if (result.dnsRecords && result.dnsRecords.length > 0) {
        setDnsRecords(result.dnsRecords);
        setSendgridDomainId(result.sendgridDomainId ?? null);
        setShowDnsDialog(true);
      } else {
        toast.success(result.message);
      }
      utils.accounts.getBranding.invalidate({ accountId });
    },
    onError: (err) => toast.error(err.message),
  });

  const verifyEmailDomain = trpc.accounts.verifyEmailDomain.useMutation({
    onSuccess: (result) => {
      if (result.verified) {
        toast.success("Domain verified successfully!");
        setShowDnsDialog(false);
      } else {
        toast.error(result.message);
      }
      utils.accounts.getBranding.invalidate({ accountId });
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSaveBranding = () => {
    updateBranding.mutate({
      accountId,
      brandName: brandName || null,
      primaryColor: primaryColor || "#d4a843",
      logoUrl: logoUrl || null,
      faviconUrl: faviconUrl || null,
      customDomain: customDomain || null,
    });
  };

  const handleSetEmailDomain = () => {
    if (!emailDomain.trim()) {
      toast.error("Enter a domain name");
      return;
    }
    setEmailDomainMut.mutate({ accountId, fromEmailDomain: emailDomain.trim() });
  };

  const handleVerifyDomain = () => {
    verifyEmailDomain.mutate({ accountId, sendgridDomainId: sendgridDomainId ?? undefined });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  // Preset color palette
  const presetColors = [
    "#d4a843", "#3b82f6", "#10b981", "#ef4444", "#8b5cf6",
    "#f59e0b", "#ec4899", "#06b6d4", "#6366f1", "#14b8a6",
  ];

  if (isLoading) {
    return (
      <Card className="bg-white border-0 card-shadow">
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-white border-0 card-shadow">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Palette className="h-4 w-4 text-muted-foreground" />
            Agency Branding
          </CardTitle>
          <CardDescription className="text-xs">
            Customize your white-label appearance, colors, and email sender domain.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Brand Identity Section */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Brand Identity
            </h4>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="brandName" className="text-xs">Brand Name</Label>
                <Input
                  id="brandName"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="e.g. Sterling Marketing"
                  className="h-9 text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  Shown in emails, portal footer, and client-facing pages.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="primaryColor" className="text-xs">Primary Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    id="primaryColor"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-9 w-9 rounded border border-border cursor-pointer p-0.5"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#d4a843"
                    className="h-9 text-sm font-mono flex-1"
                    maxLength={20}
                  />
                </div>
                <div className="flex gap-1 mt-1.5">
                  {presetColors.map((c) => (
                    <button
                      key={c}
                      onClick={() => setPrimaryColor(c)}
                      className={`h-5 w-5 rounded-full border-2 transition-all ${
                        primaryColor === c ? "border-foreground scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="logoUrl" className="text-xs flex items-center gap-1.5">
                  <Image className="h-3 w-3" /> Logo URL
                </Label>
                <Input
                  id="logoUrl"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://cdn.example.com/logo.png"
                  className="h-9 text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  Use a direct image URL ending in .png, .jpg, or .svg. Google Drive links won't work — try Imgur or Cloudinary for free hosting.
                </p>
                {logoUrl && (
                  <div className="mt-2 p-2 bg-muted rounded-lg flex items-center justify-center">
                    <img
                      src={logoUrl}
                      alt="Logo preview"
                      className="max-h-12 max-w-[160px] object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="faviconUrl" className="text-xs flex items-center gap-1.5">
                  <Image className="h-3 w-3" /> Favicon URL
                </Label>
                <Input
                  id="faviconUrl"
                  value={faviconUrl}
                  onChange={(e) => setFaviconUrl(e.target.value)}
                  placeholder="https://cdn.example.com/favicon.ico"
                  className="h-9 text-sm"
                />
                {faviconUrl && (
                  <div className="mt-2 p-2 bg-muted rounded-lg flex items-center gap-2">
                    <img
                      src={faviconUrl}
                      alt="Favicon preview"
                      className="h-6 w-6 object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <span className="text-xs text-muted-foreground">Favicon preview</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Separator className="bg-border/50" />

          {/* Custom Domain Section */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Custom Domain
            </h4>
            <div className="space-y-1.5">
              <Label htmlFor="customDomain" className="text-xs flex items-center gap-1.5">
                <Globe className="h-3 w-3" /> Custom Domain
              </Label>
              <Input
                id="customDomain"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="app.youragency.com"
                className="h-9 text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Point a CNAME record from your domain to the platform. Contact support for SSL setup.
              </p>
            </div>
          </div>

          {/* Save Branding Button */}
          <Button
            onClick={handleSaveBranding}
            disabled={updateBranding.isPending}
            className="w-full sm:w-auto"
            size="sm"
          >
            {updateBranding.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Branding
          </Button>

          <Separator className="bg-border/50" />

          {/* Email Sender Domain Section */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Email Sender Domain
            </h4>
            <p className="text-xs text-muted-foreground">
              Authenticate a custom email domain via SendGrid so outbound emails come from your domain
              (e.g. <span className="font-mono">noreply@youragency.com</span>) instead of the default.
            </p>

            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="emailDomain" className="text-xs flex items-center gap-1.5">
                  <Mail className="h-3 w-3" /> Domain
                </Label>
                <Input
                  id="emailDomain"
                  value={emailDomain}
                  onChange={(e) => setEmailDomain(e.target.value)}
                  placeholder="youragency.com"
                  className="h-9 text-sm"
                />
              </div>
              <Button
                onClick={handleSetEmailDomain}
                disabled={setEmailDomainMut.isPending}
                size="sm"
                variant="outline"
              >
                {setEmailDomainMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ShieldCheck className="h-4 w-4 mr-2" />
                )}
                Authenticate
              </Button>
            </div>

            {branding?.fromEmailDomain && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Current:</span>
                <span className="font-mono">{branding.fromEmailDomain}</span>
                {branding.emailDomainVerified ? (
                  <Badge variant="outline" className="text-[10px] h-4 border-green-300 text-green-600 bg-green-50">
                    <CheckCircle2 className="h-3 w-3 mr-0.5" /> Verified
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] h-4 border-amber-300 text-amber-600 bg-amber-50">
                    <AlertCircle className="h-3 w-3 mr-0.5" /> Pending
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Live Preview */}
          <Separator className="bg-border/50" />
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Preview
            </h4>
            <div className="rounded-lg border border-border/50 overflow-hidden">
              {/* Mini header preview */}
              <div
                className="px-4 py-3 flex items-center gap-3"
                style={{ backgroundColor: primaryColor }}
              >
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="h-7 max-w-[120px] object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="h-7 w-7 rounded bg-white/20 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">
                      {(brandName || "A").charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="text-white text-sm font-semibold">
                  {brandName || "Your Agency"}
                </span>
              </div>
              {/* Mini body preview */}
              <div className="px-4 py-3 bg-muted/30 space-y-1.5">
                <div className="h-2 w-3/4 rounded bg-muted" />
                <div className="h-2 w-1/2 rounded bg-muted" />
                <div className="mt-2">
                  <span
                    className="inline-block text-[10px] text-white px-2 py-0.5 rounded font-medium"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Call to Action
                  </span>
                </div>
              </div>
              {/* Mini footer preview */}
              <div className="px-4 py-2 bg-muted/50 text-center">
                <span className="text-[10px] text-muted-foreground">
                  Powered by {brandName || "Your Agency"}
                  {customDomain && (
                    <> &middot; <span className="font-mono">{customDomain}</span></>
                  )}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DNS Records Dialog */}
      <Dialog open={showDnsDialog} onOpenChange={setShowDnsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              DNS Records Required
            </DialogTitle>
            <DialogDescription>
              Add these DNS records to your domain registrar to authenticate{" "}
              <span className="font-mono font-semibold">{emailDomain}</span> with SendGrid.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {dnsRecords.map((rec, i) => (
              <div key={i} className="rounded-lg border border-border p-3 space-y-2 bg-muted/30">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] font-mono uppercase">
                    {rec.type}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    onClick={() => copyToClipboard(rec.data)}
                  >
                    <Copy className="h-3 w-3 mr-1" /> Copy Value
                  </Button>
                </div>
                <div className="space-y-1">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase">Host</span>
                    <p className="text-xs font-mono break-all">{rec.host}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase">Value</span>
                    <p className="text-xs font-mono break-all">{rec.data}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              DNS propagation can take up to 48 hours. After adding the records, click Verify below.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowDnsDialog(false)}>
              Close
            </Button>
            <Button
              size="sm"
              onClick={handleVerifyDomain}
              disabled={verifyEmailDomain.isPending}
            >
              {verifyEmailDomain.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Verify Domain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
