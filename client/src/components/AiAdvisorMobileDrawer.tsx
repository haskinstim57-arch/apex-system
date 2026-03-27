import { useAiAdvisor } from "@/contexts/AiAdvisorContext";
import { useAccount } from "@/contexts/AccountContext";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { AiAdvisorInlinePanel } from "./AiAdvisorInlinePanel";

/**
 * Mobile-only floating AI Advisor button + slide-up drawer.
 * Visible on screens < xl (1280px) where the inline card is hidden.
 * Uses the Sheet component (bottom side) to create a slide-up drawer experience.
 */
export function AiAdvisorMobileDrawer() {
  const { isOpen, setIsOpen, toggle } = useAiAdvisor();
  const { currentAccountId } = useAccount();

  // Only show when a sub-account is selected
  if (!currentAccountId) return null;

  return (
    <>
      {/* Floating action button — only visible below xl breakpoint */}
      <button
        onClick={toggle}
        className={cn(
          "xl:hidden fixed bottom-5 right-5 z-50",
          "flex items-center gap-2 px-4 py-3 rounded-full",
          "bg-primary text-primary-foreground shadow-lg",
          "hover:shadow-xl hover:scale-105 active:scale-95",
          "transition-all duration-200",
          isOpen && "hidden"
        )}
        aria-label="Open AI Advisor"
      >
        <Sparkles className="h-4 w-4" />
        <span className="text-sm font-semibold">AI Advisor</span>
      </button>

      {/* Slide-up drawer */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="bottom"
          className="xl:hidden h-[85vh] rounded-t-2xl p-0 flex flex-col"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>AI Advisor</SheetTitle>
          </SheetHeader>
          {/* Drag handle indicator */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
          {/* Reuse the full inline panel inside the drawer */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <AiAdvisorInlinePanel />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
