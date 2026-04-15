import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CreditCard, AlertCircle } from "lucide-react";
import { toast } from "sonner";

declare global {
  interface Window {
    Square?: any;
  }
}

interface SquareCardFormProps {
  accountId: number;
  onSuccess: () => void;
  onCancel?: () => void;
  /** If true, hides the cancel button (used in onboarding) */
  hideCancel?: boolean;
  /** Custom submit button text */
  submitText?: string;
}

export function SquareCardForm({
  accountId,
  onSuccess,
  onCancel,
  hideCancel = false,
  submitText,
}: SquareCardFormProps) {
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardholderName, setCardholderName] = useState("");

  const addPaymentMethod = trpc.billing.addPaymentMethod.useMutation({
    onSuccess: () => {
      toast.success("Card added successfully");
      onSuccess();
    },
    onError: (err) => {
      setCardError(`Server error: ${err.message}`);
      setSubmitting(false);
    },
  });

  // Dynamically load Square Web Payments SDK and initialize card form
  useEffect(() => {
    let mounted = true;

    const loadSquareSDK = async () => {
      // Remove any existing Square script to avoid duplicates
      const existing = document.getElementById("square-sdk");
      if (existing) existing.remove();

      const script = document.createElement("script");
      script.id = "square-sdk";

      // Always use production SDK — all Square credentials are production
      script.src = "https://web.squarecdn.com/v1/square.js";

      script.onload = async () => {
        if (!mounted) return;
        try {
          if (!window.Square) {
            setCardError("Square SDK failed to initialize");
            setLoading(false);
            return;
          }

          const appId = import.meta.env.VITE_SQUARE_APPLICATION_ID;
          const locationId = import.meta.env.VITE_SQUARE_LOCATION_ID;

          if (!appId || !locationId) {
            setCardError("Square configuration missing (Application ID or Location ID).");
            setLoading(false);
            return;
          }

          const payments = await window.Square.payments(appId, locationId);
          const card = await payments.card();

          if (mounted && cardContainerRef.current) {
            await card.attach(cardContainerRef.current);
            cardRef.current = card;
            setCardError(null);
            setLoading(false);
          }
        } catch (err: any) {
          if (mounted) {
            const msg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err));
            const envAppId = import.meta.env.VITE_SQUARE_APPLICATION_ID;
            const envLocId = import.meta.env.VITE_SQUARE_LOCATION_ID;
            const envEnv = import.meta.env.VITE_SQUARE_ENVIRONMENT;
            setCardError(`Failed to initialize card form: ${msg} [AppId: ${envAppId?.substring(0, 10)}..., Loc: ${envLocId}, Env: ${envEnv}]`);
            setLoading(false);
            console.error("[Square] Init error:", err);
          }
        }
      };

      script.onerror = (e) => {
        if (mounted) {
          setCardError(`Failed to load Square SDK: ${e?.toString() || 'Network error'}. Check your internet connection.`);
          setLoading(false);
          console.error("[Square] Script load error:", e);
        }
      };

      document.head.appendChild(script);
    };

    loadSquareSDK();

    return () => {
      mounted = false;
      if (cardRef.current) {
        try { cardRef.current.destroy(); } catch {}
      }
    };
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!cardRef.current) return;
    setSubmitting(true);
    setCardError(null);

    try {
      const result = await cardRef.current.tokenize();
      if (result.status === "OK" && result.token) {
        addPaymentMethod.mutate({
          accountId,
          sourceId: result.token,
          cardholderName: cardholderName || undefined,
          setAsDefault: true,
        });
      } else {
        setCardError(result.errors?.[0]?.message || "Card tokenization failed");
        setSubmitting(false);
      }
    } catch (err: any) {
      const msg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err));
      setCardError(`Failed to process card: ${msg}`);
      setSubmitting(false);
    }
  }, [accountId, cardholderName, addPaymentMethod]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Cardholder Name</Label>
        <Input
          value={cardholderName}
          onChange={(e) => setCardholderName(e.target.value)}
          placeholder="Name on card"
        />
      </div>

      <div className="space-y-2">
        <Label>Card Details</Label>
        <div
          ref={cardContainerRef}
          id="card-container"
          className="rounded-md border border-input bg-background p-2"
          style={{ minHeight: '89px', minWidth: '200px' }}
        />
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading card form...
          </div>
        )}
      </div>

      {cardError && (
        <div className="text-sm text-destructive flex items-center gap-1">
          <AlertCircle className="h-4 w-4" />
          {cardError}
        </div>
      )}

      <div className="flex justify-end gap-2">
        {!hideCancel && onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
        <Button onClick={handleSubmit} disabled={loading || submitting}>
          {submitting ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
          ) : (
            <><CreditCard className="h-4 w-4 mr-2" /> {submitText || "Save Card"}</>
          )}
        </Button>
      </div>
    </div>
  );
}
