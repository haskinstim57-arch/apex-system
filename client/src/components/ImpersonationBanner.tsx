import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Shield, X } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export function ImpersonationBanner() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  // Check impersonation status for all authenticated users
  const { data: status } = trpc.impersonation.status.useQuery(undefined, {
    enabled: !!user,
    refetchOnWindowFocus: false,
  });

  const stopMutation = trpc.impersonation.stop.useMutation({
    onSuccess: () => {
      utils.impersonation.status.invalidate();
      toast.success("Impersonation ended. Returning to admin view.");
      setLocation("/accounts");
    },
    onError: (err) => {
      toast.error("Failed to stop impersonation", { description: err.message });
    },
  });

  if (!status?.isImpersonating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-amber-950">
      <div className="flex items-center justify-between px-4 py-2 max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Shield className="h-4 w-4" />
          <span>
            You are viewing{" "}
            <strong>{status.impersonatedAccountName}</strong>{" "}
            as an administrator.
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 bg-amber-600 border-amber-700 text-white hover:bg-amber-700 hover:text-white gap-1.5 text-xs"
          onClick={() => stopMutation.mutate()}
          disabled={stopMutation.isPending}
        >
          <X className="h-3 w-3" />
          {stopMutation.isPending ? "Stopping..." : "Stop Impersonation"}
        </Button>
      </div>
    </div>
  );
}
