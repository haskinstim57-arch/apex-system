import React, { createContext, useContext, useState, useCallback } from "react";

type AiAdvisorState = {
  isOpen: boolean;
  activeTab: "suggestions" | "chat";
  pageContext: string;
};

type AiAdvisorContextValue = AiAdvisorState & {
  open: () => void;
  close: () => void;
  toggle: () => void;
  setActiveTab: (tab: "suggestions" | "chat") => void;
  setPageContext: (context: string) => void;
};

const AiAdvisorContext = createContext<AiAdvisorContextValue | null>(null);

export function AiAdvisorProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AiAdvisorState>({
    isOpen: false,
    activeTab: "suggestions",
    pageContext: "dashboard",
  });

  const open = useCallback(() => setState((s) => ({ ...s, isOpen: true })), []);
  const close = useCallback(() => setState((s) => ({ ...s, isOpen: false })), []);
  const toggle = useCallback(() => setState((s) => ({ ...s, isOpen: !s.isOpen })), []);
  const setActiveTab = useCallback(
    (tab: "suggestions" | "chat") => setState((s) => ({ ...s, activeTab: tab })),
    []
  );
  const setPageContext = useCallback(
    (context: string) => setState((s) => ({ ...s, pageContext: context })),
    []
  );

  return (
    <AiAdvisorContext.Provider
      value={{ ...state, open, close, toggle, setActiveTab, setPageContext }}
    >
      {children}
    </AiAdvisorContext.Provider>
  );
}

export function useAiAdvisor() {
  const ctx = useContext(AiAdvisorContext);
  if (!ctx) {
    throw new Error("useAiAdvisor must be used within AiAdvisorProvider");
  }
  return ctx;
}
