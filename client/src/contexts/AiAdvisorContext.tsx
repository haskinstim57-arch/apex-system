import { createContext, useContext, useState, type ReactNode } from "react";

type AiAdvisorState = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggle: () => void;
  pageContext: string;
  setPageContext: (page: string) => void;
  mode: "suggestions" | "chat";
  setMode: (mode: "suggestions" | "chat") => void;
};

const AiAdvisorContext = createContext<AiAdvisorState | null>(null);

export function AiAdvisorProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pageContext, setPageContext] = useState("dashboard");
  const [mode, setMode] = useState<"suggestions" | "chat">("suggestions");

  return (
    <AiAdvisorContext.Provider
      value={{
        isOpen,
        setIsOpen,
        toggle: () => setIsOpen((prev) => !prev),
        pageContext,
        setPageContext,
        mode,
        setMode,
      }}
    >
      {children}
    </AiAdvisorContext.Provider>
  );
}

export function useAiAdvisor() {
  const ctx = useContext(AiAdvisorContext);
  if (!ctx) throw new Error("useAiAdvisor must be used within AiAdvisorProvider");
  return ctx;
}
