"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Command,
  HelpCircle,
  Package,
  Search,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";

const STORAGE_KEY = "serviq-recent-searches";
const MAX_RECENT = 5;

type AiResponse = {
  response: string;
  action: string;
  redirect: string | null;
  data: Record<string, unknown> | null;
  suggestions: string[];
};

type SuggestionItem = {
  type: "recent" | "suggestion" | "ai" | "command";
  label: string;
  subtitle?: string;
  icon?: React.ReactNode;
};

const quickActions: SuggestionItem[] = [
  { type: "command", label: "Find a plumber near me", icon: <Search size={14} /> },
  { type: "command", label: "Buy groceries with delivery", icon: <ShoppingCart size={14} /> },
  { type: "command", label: "Post: need AC repair urgently", icon: <Sparkles size={14} /> },
  { type: "command", label: "Sell my old phone", icon: <Package size={14} /> },
  { type: "command", label: "Help me get started", icon: <HelpCircle size={14} /> },
  { type: "command", label: "Show my orders", icon: <Command size={14} /> },
];

const actionIcons: Record<string, React.ReactNode> = {
  find_service: <Search size={14} />,
  find_provider: <Search size={14} />,
  buy_product: <ShoppingCart size={14} />,
  post_need: <Sparkles size={14} />,
  sell_product: <Package size={14} />,
  manage_inventory: <Package size={14} />,
  get_help: <HelpCircle size={14} />,
  check_orders: <Command size={14} />,
  list_services: <Command size={14} />,
  manage_business: <Command size={14} />,
};

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecent(query: string) {
  const recent = loadRecent().filter((s) => s !== query);
  recent.unshift(query);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

export function AiPromptBar({
  placeholder = "Ask ServiQ to find, post, buy, sell or manage...",
  onSearch,
}: {
  placeholder?: string;
  onSearch?: (query: string) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [recent] = useState<string[]>(() => loadRecent());
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<AiResponse | null>(null);
  const [showAiResult, setShowAiResult] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const listboxId = useId();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowAiResult(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fetchAiResponse = useCallback(async (q: string) => {
    if (q.trim().length < 3) {
      setAiResponse(null);
      setShowAiResult(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/ai/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      if (!res.ok) throw new Error("API error");
      const data: AiResponse = await res.json();
      setAiResponse(data);
      setShowAiResult(true);
    } catch {
      setAiResponse(null);
      setShowAiResult(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length >= 3) {
      debounceRef.current = setTimeout(() => fetchAiResponse(query), 300);
    } else {
      setShowAiResult(false);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchAiResponse]);

  const handleSelect = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      setQuery(trimmed);
      saveRecent(trimmed);
      setIsOpen(false);
      setShowAiResult(false);

      if (onSearch) {
        onSearch(trimmed);
        return;
      }

      if (aiResponse?.redirect) {
        router.push(aiResponse.redirect);
      } else {
        router.push(`/search?q=${encodeURIComponent(trimmed)}`);
      }
    },
    [router, onSearch, aiResponse],
  );

  const handleQuickAction = useCallback(
    (action: string) => {
      setQuery(action);
      saveRecent(action);
      setIsOpen(false);
      setShowAiResult(false);
      if (onSearch) {
        onSearch(action);
      } else {
        router.push(`/search?q=${encodeURIComponent(action)}`);
      }
    },
    [router, onSearch],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (activeIndex >= 0) {
      const items = getDisplayItems();
      if (activeIndex < items.length) {
        handleSelect(items[activeIndex].label);
        return;
      }
    }

    if (aiResponse?.redirect) {
      saveRecent(query);
      router.push(aiResponse.redirect);
      setIsOpen(false);
      setShowAiResult(false);
    } else if (query.trim()) {
      handleSelect(query);
    }
  };

  const getDisplayItems = (): SuggestionItem[] => {
    if (showAiResult && aiResponse) {
      return aiResponse.suggestions.map((s) => ({
        type: "suggestion" as const,
        label: s,
        icon: actionIcons[aiResponse.action] || <TrendingUp size={14} />,
      }));
    }

    if (query.trim()) return [];

    if (recent.length > 0) {
      return recent.map((r) => ({
        type: "recent" as const,
        label: r,
        icon: <Clock size={14} />,
      }));
    }

    return quickActions;
  };

  const displayItems = getDisplayItems();
  const showDropdown = isOpen && !loading && !showAiResult && (query.trim() ? displayItems.length > 0 : displayItems.length > 0);
  const showAiDropdown = !!(isOpen && showAiResult && aiResponse);

  return (
    <div ref={ref} className="relative w-full">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2">
            {loading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              >
                <Sparkles size={18} className="text-[var(--brand-500)]" />
              </motion.div>
            ) : (
              <Sparkles size={18} className="text-[var(--ink-500)]" />
            )}
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
              setActiveIndex(-1);
              setShowAiResult(false);
            }}
            onFocus={() => {
              setIsOpen(true);
              if (query.trim().length >= 3) setShowAiResult(true);
            }}
            onKeyDown={(e) => {
              const items = showAiResult ? (aiResponse?.suggestions || []) : displayItems;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
              } else if (e.key === "Escape") {
                setIsOpen(false);
                setShowAiResult(false);
              }
            }}
            placeholder={placeholder}
            className="w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] py-3 pl-11 pr-10 text-sm text-[var(--ink-950)] outline-none transition focus:border-[var(--brand-500)] focus:ring-4 focus:ring-[var(--brand-ring)]"
            role="combobox"
            aria-expanded={showDropdown || showAiDropdown}
            aria-controls={listboxId}
            aria-autocomplete="list"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setActiveIndex(-1);
                setShowAiResult(false);
                setAiResponse(null);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-500)] hover:text-[var(--ink-700)]"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </form>

      <AnimatePresence>
        {showAiDropdown && aiResponse && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            id={listboxId}
            className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] shadow-lg"
            role="listbox"
          >
            <div className="border-b border-[var(--surface-border)] bg-gradient-to-r from-[var(--brand-50)] to-[var(--surface-elevated)] p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0 rounded-full bg-[var(--brand-100)] p-1.5 text-[var(--brand-600)]">
                  <Sparkles size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--ink-900)]">
                    {aiResponse.response}
                  </p>
                  {aiResponse.redirect && (
                    <button
                      type="button"
                      onClick={() => {
                        saveRecent(query);
                        router.push(aiResponse.redirect!);
                        setIsOpen(false);
                        setShowAiResult(false);
                      }}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-500)] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--brand-600)]"
                    >
                      {actionIcons[aiResponse.action] || <Search size={12} />}
                      {aiResponse.action === "find_service" || aiResponse.action === "find_provider"
                        ? "Browse results"
                        : aiResponse.action === "buy_product"
                          ? "View products"
                          : aiResponse.action === "post_need"
                            ? "Create post"
                            : aiResponse.action === "sell_product"
                              ? "List product"
                              : "Go"}
                    </button>
                  )}
                </div>
              </div>
            </div>
            {aiResponse.suggestions.length > 0 && (
              <>
                <div className="flex items-center gap-2 border-b border-[var(--surface-border)] px-4 py-2">
                  <TrendingUp size={14} className="text-[var(--ink-500)]" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-500)]">
                    Try asking
                  </span>
                </div>
                {aiResponse.suggestions.map((s, i) => (
                  <button
                    key={s}
                    type="button"
                    role="option"
                    aria-selected={activeIndex === i}
                    onClick={() => handleQuickAction(s)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition ${
                      activeIndex === i
                        ? "bg-[var(--brand-50)] text-[var(--brand-700)]"
                        : "text-[var(--ink-700)] hover:bg-[var(--surface-soft)]"
                    }`}
                  >
                    <TrendingUp size={14} className="shrink-0 text-[var(--ink-500)]" />
                    <span className="font-medium">{s}</span>
                  </button>
                ))}
              </>
            )}
          </motion.div>
        )}

        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            id={listboxId}
            className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] shadow-lg"
            role="listbox"
          >
            {query.trim() ? (
              <>
                <div className="flex items-center gap-2 border-b border-[var(--surface-border)] px-4 py-2">
                  <TrendingUp size={14} className="text-[var(--ink-500)]" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-500)]">
                    Suggestions
                  </span>
                </div>
                {displayItems.map((item, i) => (
                  <button
                    key={item.label}
                    type="button"
                    role="option"
                    aria-selected={activeIndex === i}
                    onClick={() => handleSelect(item.label)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition ${
                      activeIndex === i
                        ? "bg-[var(--brand-50)] text-[var(--brand-700)]"
                        : "text-[var(--ink-700)] hover:bg-[var(--surface-soft)]"
                    }`}
                  >
                    <Search size={14} className="shrink-0 text-[var(--ink-500)]" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                ))}
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 border-b border-[var(--surface-border)] px-4 py-2">
                  <Sparkles size={14} className="text-[var(--brand-500)]" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-500)]">
                    Try asking
                  </span>
                </div>
                {displayItems.map((item, i) => (
                  <button
                    key={item.label}
                    type="button"
                    role="option"
                    aria-selected={activeIndex === i}
                    onClick={() => {
                      handleQuickAction(item.label);
                    }}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition ${
                      activeIndex === i
                        ? "bg-[var(--brand-50)] text-[var(--brand-700)]"
                        : "text-[var(--ink-700)] hover:bg-[var(--surface-soft)]"
                    }`}
                  >
                    {item.icon || <Command size={14} className="shrink-0 text-[var(--ink-500)]" />}
                    <span className="font-medium">{item.label}</span>
                  </button>
                ))}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
