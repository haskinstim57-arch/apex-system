import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Offline() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4">
      <div className="flex flex-col items-center gap-6 max-w-sm text-center">
        {/* Icon */}
        <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
          <WifiOff className="h-10 w-10 text-muted-foreground" />
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            You're offline
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Please check your internet connection and try again. Some previously
            viewed pages may still be available from cache.
          </p>
        </div>

        {/* Retry button */}
        <Button
          onClick={() => window.location.reload()}
          className="gap-2 touch-manipulation min-h-[44px]"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </Button>

        {/* Branding */}
        <div className="flex items-center gap-2 mt-4 opacity-50">
          <div className="h-6 w-6 rounded bg-primary flex items-center justify-center">
            <span className="text-[10px] font-bold text-primary-foreground">A</span>
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            Sterling Marketing
          </span>
        </div>
      </div>
    </div>
  );
}
