import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X, Bell } from "lucide-react";
import { useAccount } from "@/contexts/AccountContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { toast } from "sonner";

const DISMISS_KEY = "pwa-install-dismissed";
const NOTIFY_DISMISS_KEY = "pwa-notify-dismissed";
const DISMISS_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showNotifyBanner, setShowNotifyBanner] = useState(false);

  const { currentAccountId, accounts } = useAccount();
  // Use currentAccountId if available, otherwise fall back to first account
  const pushAccountId = currentAccountId ?? accounts?.[0]?.id ?? undefined;
  const { subscribe } = usePushNotifications(pushAccountId);

  // Install prompt listener
  useEffect(() => {
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const elapsed = Date.now() - parseInt(dismissedAt, 10);
      if (elapsed < DISMISS_DURATION_MS) return;
      localStorage.removeItem(DISMISS_KEY);
    }

    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Notification prompt — show after install or if already installed
  useEffect(() => {
    if (!("Notification" in window) || !("PushManager" in window)) return;
    if (Notification.permission !== "default") return;

    const dismissedAt = localStorage.getItem(NOTIFY_DISMISS_KEY);
    if (dismissedAt) {
      const elapsed = Date.now() - parseInt(dismissedAt, 10);
      if (elapsed < DISMISS_DURATION_MS) return;
      localStorage.removeItem(NOTIFY_DISMISS_KEY);
    }

    // Show notification prompt after a delay if install banner is not showing
    const timer = setTimeout(() => {
      if (!showInstallBanner) {
        setShowNotifyBanner(true);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [showInstallBanner]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowInstallBanner(false);
      // After install, show notification prompt
      if ("Notification" in window && Notification.permission === "default") {
        setTimeout(() => setShowNotifyBanner(true), 2000);
      }
    }
    setDeferredPrompt(null);
  };

  const handleDismissInstall = () => {
    setShowInstallBanner(false);
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    // Show notification prompt after dismissing install
    if ("Notification" in window && Notification.permission === "default") {
      setTimeout(() => setShowNotifyBanner(true), 1000);
    }
  };

  const handleEnableNotifications = async () => {
    try {
      const result = await subscribe();
      if (result) {
        // Successfully registered push subscription with backend
        setShowNotifyBanner(false);
        toast.success("Push notifications enabled! You'll receive alerts for new leads, messages, and appointments.");
      }
    } catch (err) {
      // subscribe() throws on failure — hide banner and dismiss so it doesn't keep popping up
      console.error("[PwaInstallPrompt] Push subscribe failed:", err);
      setShowNotifyBanner(false);
      localStorage.setItem(NOTIFY_DISMISS_KEY, Date.now().toString());
    }
  };

  const handleDismissNotify = () => {
    setShowNotifyBanner(false);
    localStorage.setItem(NOTIFY_DISMISS_KEY, Date.now().toString());
  };

  // Install banner
  if (showInstallBanner) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-[9999] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-lg rounded-xl border border-border bg-card shadow-2xl p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Download className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-card-foreground leading-tight">
              Add Sterling Marketing to your home screen
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              For the best experience on mobile
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={handleInstall}
              className="touch-manipulation min-h-[44px] px-4"
            >
              Install
            </Button>
            <button
              onClick={handleDismissInstall}
              className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors touch-manipulation"
              aria-label="Dismiss install prompt"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Notification permission banner
  if (showNotifyBanner) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-[9999] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-lg rounded-xl border border-border bg-card shadow-2xl p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <Bell className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-card-foreground leading-tight">
              Enable push notifications
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Get alerts for new leads, messages, and appointments
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={handleEnableNotifications}
              className="touch-manipulation min-h-[44px] px-4"
            >
              Enable
            </Button>
            <button
              onClick={handleDismissNotify}
              className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors touch-manipulation"
              aria-label="Dismiss notification prompt"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
