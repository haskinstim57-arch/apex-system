import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

// Force service worker update check on every page load
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(reg => reg.update());
  });
}

// Hardcoded build timestamp — updated at build time via Vite define
const FRONTEND_BUILD_VERSION = __BUILD_TIMESTAMP__;

// Version-check: compare frontend build version with server version
// If they differ, force a full reload to bust stale cache
async function checkVersion() {
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    if (!res.ok) return;
    const { version } = await res.json();
    const stored = sessionStorage.getItem("apex_server_version");
    if (stored && stored !== version) {
      // Server restarted with new build — force reload
      sessionStorage.setItem("apex_server_version", version);
      window.location.reload();
      return;
    }
    sessionStorage.setItem("apex_server_version", version);
  } catch {
    // Offline or network error — skip check
  }
}
checkVersion();

try {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,    // 30s — avoid refetching on every mount
        gcTime: 5 * 60_000,   // 5min — keep unused data in cache
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  const redirectToLoginIfUnauthorized = (error: unknown) => {
    if (!(error instanceof TRPCClientError)) return;
    if (typeof window === "undefined") return;

    const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

    if (!isUnauthorized) return;

    window.location.href = getLoginUrl();
  };

  queryClient.getQueryCache().subscribe(event => {
    if (event.type === "updated" && event.action.type === "error") {
      const error = event.query.state.error;
      redirectToLoginIfUnauthorized(error);
      console.error("[API Query Error]", error);
    }
  });

  queryClient.getMutationCache().subscribe(event => {
    if (event.type === "updated" && event.action.type === "error") {
      const error = event.mutation.state.error;
      redirectToLoginIfUnauthorized(error);
      console.error("[API Mutation Error]", error);
    }
  });

  const trpcClient = trpc.createClient({
    links: [
      httpBatchLink({
        url: "/api/trpc",
        transformer: superjson,
        fetch(input, init) {
          return globalThis.fetch(input, {
            ...(init ?? {}),
            credentials: "include",
          });
        },
      }),
    ],
  });

  const rootEl = document.getElementById("root");
  if (rootEl) {
    createRoot(rootEl).render(
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </trpc.Provider>
    );
  } else {
    console.error("[APEX] Root element not found");
  }
} catch (err) {
  console.error("[APEX] Fatal initialization error:", err);
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `<div style="padding:2rem;font-family:sans-serif;color:#333"><h2>Application Error</h2><p>Failed to initialize. Please try refreshing the page.</p><pre style="background:#f5f5f5;padding:1rem;border-radius:4px;overflow:auto">${String(err)}</pre></div>`;
  }
}
