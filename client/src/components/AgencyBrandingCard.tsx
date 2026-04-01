import React, { useState, useEffect, useRef, useCallback } from "react";
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
  RotateCcw,
  X,
  ImagePlus,
} from "lucide-react";
import { toast } from "sonner";

/** Quick luminance check for contrast in preview */
function luminance(hex: string): number {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  } catch {
    return 0;
  }
}

interface AgencyBrandingCardProps {
  accountId: number;
}

export function AgencyBrandingCard({ accountId }: AgencyBrandingCardProps) {
  const utils = trpc.useUtils();
  const { data: branding, isLoading } = trpc.accounts.getBranding.useQuery({ accountId });

  // Local form state
  const [brandName, setBrandName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#d4a843");
  const [secondaryColor, setSecondaryColor] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [customDomain, setCustomDomain] = useState("");

  // Email domain state
  const [emailDomain, setEmailDomain] = useState("");
  const [showDnsDialog, setShowDnsDialog] = useState(false);
  const [dnsRecords, setDnsRecords] = useState<Array<{ type: string; host: string; data: string }>>([]);
  const [sendgridDomainId, setSendgridDomainId] = useState<string | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [faviconUploading, setFaviconUploading] = useState(false);
  const [logoDragOver, setLogoDragOver] = useState(false);
  const [faviconDragOver, setFaviconDragOver] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  // Sync branding data to form
  useEffect(() => {
    if (branding) {
      setBrandName(branding.brandName ?? "");
      setPrimaryColor(branding.primaryColor ?? "#d4a843");
      setSecondaryColor(branding.secondaryColor ?? "");
      setLogoUrl(branding.logoUrl ?? "");
      setFaviconUrl(branding.faviconUrl ?? "");
      setCustomDomain(branding.customDomain ?? "");
      setEmailDomain(branding.fromEmailDomain ?? "");
    }
  }, [branding]);

  const uploadAsset = trpc.accounts.uploadBrandingAsset.useMutation({
    onSuccess: () => {
      utils.accounts.getBranding.invalidate({ accountId });
    },
    onError: (err) => toast.error(err.message),
  });

  const ALLOWED_IMAGE_TYPES = [
    "image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp",
  ] as const;
  const ALLOWED_FAVICON_TYPES = [
    ...ALLOWED_IMAGE_TYPES, "image/x-icon", "image/vnd.microsoft.icon",
  ] as const;
  const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

  const handleFileUpload = useCallback(async (
    file: File,
    assetType: "logo" | "favicon",
  ) => {
    const allowedTypes = assetType === "logo" ? ALLOWED_IMAGE_TYPES : ALLOWED_FAVICON_TYPES;
    if (!allowedTypes.includes(file.type as any)) {
      toast.error(`Invalid file type. Allowed: ${assetType === "logo" ? "PNG, JPG, SVG, WebP" : "PNG, JPG, SVG, WebP, ICO"}`);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File too large. Maximum size is 2MB.");
      return;
    }

    const setUploading = assetType === "logo" ? setLogoUploading : setFaviconUploading;
    setUploading(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );

      const result = await uploadAsset.mutateAsync({
        accountId,
        fileBase64: base64,
        fileName: file.name,
        mimeType: file.type as any,
        assetType,
      });

      if (assetType === "logo") {
        setLogoUrl(result.url);
      } else {
        setFaviconUrl(result.url);
      }
      toast.success(`${assetType === "logo" ? "Logo" : "Favicon"} uploaded successfully`);
    } catch {
      // Error already handled by mutation onError
    } finally {
      setUploading(false);
    }
  }, [accountId, uploadAsset]);

  const handleDrop = useCallback((e: React.DragEvent, assetType: "logo" | "favicon") => {
    e.preventDefault();
    e.stopPropagation();
    if (assetType === "logo") setLogoDragOver(false);
    else setFaviconDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file, assetType);
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

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
      secondaryColor: secondaryColor || null,
      logoUrl: logoUrl || null,
      faviconUrl: faviconUrl || null,
      customDomain: customDomain || null,
    });
  };

  const handleResetToDefaults = () => {
    updateBranding.mutate(
      {
        accountId,
        brandName: null,
        primaryColor: "#d4a843",
        secondaryColor: null,
        logoUrl: null,
        faviconUrl: null,
        customDomain: null,
      },
      {
        onSuccess: () => {
          setBrandName("");
          setPrimaryColor("#d4a843");
          setSecondaryColor("");
          setLogoUrl("");
          setFaviconUrl("");
          setCustomDomain("");
          setShowResetDialog(false);
          toast.success("Branding reset to defaults");
          utils.accounts.getBranding.invalidate({ accountId });
        },
      }
    );
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
                <p className="text-[11px] text-muted-foreground">
                  Used for buttons, links, and navigation highlights.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="secondaryColor" className="text-xs">Secondary Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    id="secondaryColor"
                    value={secondaryColor || "#f1f5f9"}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="h-9 w-9 rounded border border-border cursor-pointer p-0.5"
                  />
                  <Input
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    placeholder="Optional — leave blank for default"
                    className="h-9 text-sm font-mono flex-1"
                    maxLength={20}
                  />
                </div>
                <div className="flex gap-1 mt-1.5">
                  {presetColors.map((c) => (
                    <button
                      key={`sec-${c}`}
                      onClick={() => setSecondaryColor(c)}
                      className={`h-5 w-5 rounded-full border-2 transition-all ${
                        secondaryColor === c ? "border-foreground scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                  {secondaryColor && (
                    <button
                      onClick={() => setSecondaryColor("")}
                      className="h-5 px-1.5 rounded-full border border-border text-[9px] text-muted-foreground hover:bg-muted transition-colors"
                      title="Clear secondary color"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Used for badges, hover states, and accent backgrounds. Leave blank to use the system default.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Logo Upload */}
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <Image className="h-3 w-3" /> Logo
                </Label>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, "logo");
                    e.target.value = "";
                  }}
                />
                {logoUrl ? (
                  <div className="relative rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex items-center justify-center">
                      <img
                        src={logoUrl}
                        alt="Logo preview"
                        className="max-h-16 max-w-[180px] object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).src = ""; }}
                      />
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] flex-1"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={logoUploading}
                      >
                        {logoUploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
                        Replace
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] text-muted-foreground hover:text-destructive hover:border-destructive"
                        onClick={() => setLogoUrl("")}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onDrop={(e) => handleDrop(e, "logo")}
                    onDragOver={handleDragOver}
                    onDragEnter={() => setLogoDragOver(true)}
                    onDragLeave={() => setLogoDragOver(false)}
                    onClick={() => logoInputRef.current?.click()}
                    className={`relative rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${
                      logoDragOver
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/30"
                    }`}
                  >
                    {logoUploading ? (
                      <div className="flex flex-col items-center gap-1.5">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="text-[11px] text-muted-foreground">Uploading...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5">
                        <ImagePlus className="h-6 w-6 text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground">
                          <span className="font-medium text-foreground">Click to upload</span> or drag & drop
                        </span>
                        <span className="text-[10px] text-muted-foreground">PNG, JPG, SVG, WebP (max 2MB)</span>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-1.5 mt-1">
                  <Input
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="Or paste a URL..."
                    className="h-7 text-[11px] flex-1"
                  />
                </div>
              </div>

              {/* Favicon Upload */}
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <Image className="h-3 w-3" /> Favicon
                </Label>
                <input
                  ref={faviconInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon,image/vnd.microsoft.icon"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, "favicon");
                    e.target.value = "";
                  }}
                />
                {faviconUrl ? (
                  <div className="relative rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex items-center justify-center">
                      <img
                        src={faviconUrl}
                        alt="Favicon preview"
                        className="h-10 w-10 object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).src = ""; }}
                      />
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] flex-1"
                        onClick={() => faviconInputRef.current?.click()}
                        disabled={faviconUploading}
                      >
                        {faviconUploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
                        Replace
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] text-muted-foreground hover:text-destructive hover:border-destructive"
                        onClick={() => setFaviconUrl("")}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onDrop={(e) => handleDrop(e, "favicon")}
                    onDragOver={handleDragOver}
                    onDragEnter={() => setFaviconDragOver(true)}
                    onDragLeave={() => setFaviconDragOver(false)}
                    onClick={() => faviconInputRef.current?.click()}
                    className={`relative rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${
                      faviconDragOver
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/30"
                    }`}
                  >
                    {faviconUploading ? (
                      <div className="flex flex-col items-center gap-1.5">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="text-[11px] text-muted-foreground">Uploading...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5">
                        <ImagePlus className="h-5 w-5 text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground">
                          <span className="font-medium text-foreground">Click to upload</span> or drag & drop
                        </span>
                        <span className="text-[10px] text-muted-foreground">PNG, JPG, SVG, WebP, ICO (max 2MB)</span>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-1.5 mt-1">
                  <Input
                    value={faviconUrl}
                    onChange={(e) => setFaviconUrl(e.target.value)}
                    placeholder="Or paste a URL..."
                    className="h-7 text-[11px] flex-1"
                  />
                </div>
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

          {/* Save / Reset Buttons */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSaveBranding}
              disabled={updateBranding.isPending}
              size="sm"
            >
              {updateBranding.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Branding
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResetDialog(true)}
              disabled={updateBranding.isPending}
              className="text-muted-foreground hover:text-destructive hover:border-destructive"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Defaults
            </Button>
          </div>

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
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className="inline-block text-[10px] text-white px-2 py-0.5 rounded font-medium"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Primary Button
                  </span>
                  {secondaryColor && (
                    <span
                      className="inline-block text-[10px] px-2 py-0.5 rounded font-medium"
                      style={{
                        backgroundColor: secondaryColor,
                        color: luminance(secondaryColor) > 0.55 ? "#1a1a1a" : "#ffffff",
                      }}
                    >
                      Secondary
                    </span>
                  )}
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

      {/* Reset Confirmation Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Reset Branding to Defaults
            </DialogTitle>
            <DialogDescription>
              This will clear all branding customizations (brand name, colors, logo, favicon, and custom domain) and revert to the Sterling Marketing defaults. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowResetDialog(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleResetToDefaults}
              disabled={updateBranding.isPending}
            >
              {updateBranding.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              Reset Everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
