import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Search,
  User,
  Megaphone,
  GitBranch,
  FileText,
  DollarSign,
  X,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useDebounce } from "@/hooks/useDebounce";
import { useAccount } from "@/contexts/AccountContext";
import { cn } from "@/lib/utils";

const CATEGORY_CONFIG = {
  contacts: { label: "Contacts", icon: User, color: "text-blue-500" },
  campaigns: { label: "Campaigns", icon: Megaphone, color: "text-purple-500" },
  sequences: { label: "Sequences", icon: GitBranch, color: "text-orange-500" },
  content: { label: "Content", icon: FileText, color: "text-green-500" },
  deals: { label: "Deals", icon: DollarSign, color: "text-yellow-500" },
} as const;

type CategoryKey = keyof typeof CATEGORY_CONFIG;

const CATEGORIES: CategoryKey[] = [
  "contacts",
  "campaigns",
  "sequences",
  "content",
  "deals",
];

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();
  const { currentAccountId } = useAccount();

  const debouncedQuery = useDebounce(query, 300);

  const { data, isFetching } = trpc.search.global.useQuery(
    { query: debouncedQuery, accountId: currentAccountId! },
    {
      enabled: debouncedQuery.length >= 2 && !!currentAccountId,
      keepPreviousData: true,
    }
  );

  // Flatten all results for keyboard navigation
  const allResults = useMemo(() => {
    if (!data) return [];
    return [
      ...data.contacts,
      ...data.campaigns,
      ...data.sequences,
      ...data.content,
      ...data.deals,
    ];
  }, [data]);

  const hasResults = allResults.length > 0;

  const handleSelect = useCallback(
    (path: string) => {
      setLocation(path);
      setQuery("");
      setIsOpen(false);
      inputRef.current?.blur();
    },
    [setLocation]
  );

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, allResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && allResults[selectedIndex]) {
      e.preventDefault();
      handleSelect(allResults[selectedIndex].path);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [data]);

  // Global keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="relative w-full max-w-md" ref={dropdownRef}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search leads, campaigns... ⌘K"
          className="w-full h-9 pl-9 pr-8 rounded-lg bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setIsOpen(false);
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-popover border border-border rounded-xl shadow-xl overflow-hidden max-h-[480px] overflow-y-auto">
          {isFetching && !data && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching...
            </div>
          )}

          {!isFetching && !hasResults && debouncedQuery.length >= 2 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No results for &ldquo;
              <span className="font-medium text-foreground">{query}</span>
              &rdquo;
            </div>
          )}

          {hasResults &&
            CATEGORIES.map((key) => {
              const config = CATEGORY_CONFIG[key];
              const results = data?.[key] ?? [];
              if (results.length === 0) return null;
              const Icon = config.icon;

              // Calculate global offset for keyboard navigation
              let globalOffset = 0;
              for (const k of CATEGORIES) {
                if (k === key) break;
                globalOffset += data?.[k]?.length ?? 0;
              }

              return (
                <div key={key}>
                  {/* Category header */}
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30 border-b border-border">
                    {config.label}
                  </div>
                  {results.map((result, i) => {
                    const absoluteIndex = globalOffset + i;
                    return (
                      <button
                        key={result.id}
                        onClick={() => handleSelect(result.path)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                          selectedIndex === absoluteIndex
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-muted/50 text-foreground"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 flex-shrink-0",
                            config.color
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {result.title}
                          </div>
                          {result.subtitle && (
                            <div className="text-xs text-muted-foreground truncate">
                              {result.subtitle}
                            </div>
                          )}
                        </div>
                        {result.extra && (
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {result.extra}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}

          {/* Footer */}
          {hasResults && (
            <div className="px-4 py-2 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {data?.total} result{data?.total !== 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono">
                  ↑↓
                </kbd>{" "}
                navigate
                <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono">
                  ↵
                </kbd>{" "}
                select
                <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono">
                  Esc
                </kbd>{" "}
                close
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
