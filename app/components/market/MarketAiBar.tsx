"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Loader2,
  Search,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";

const STORAGE_KEY = "serviq-market-recent";
const MAX_RECENT = 5;

type AiResponse = {
  response: string;
  action: string;
  redirect: string | null;
  data: Record<string, unknown> | null;
  suggestions: string[];
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

const MARKET_QUICK_ACTIONS = [
  "Find a plumber near me",
  "AC repair with best rating",
  "Electrician available now",
  "Carpenter nearby",
  "Top rated providers",
];

/** Floating AI action button that expands into a query bar */
export function MarketAiFloating() {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<AiResponse | null>(null);
  const [showAiResult, setShowAiResult] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [expanded]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setExpanded(false);
        setShowAiResult(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fetchAiResponse = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
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
    if (query.trim().length >= 2) {
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
      setExpanded(false);
      setShowAiResult(false);
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    },
    [router],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (aiResponse?.redirect) {
      saveRecent(query);
      router.push(aiResponse.redirect);
      setExpanded(false);
      setShowAiResult(false);
    } else if (query.trim()) {
      handleSelect(query);
    }
  };

  const displayItems = showAiResult
    ? (aiResponse?.suggestions || []).slice(0, 5)
    : query.trim().length === 0
      ? MARKET_QUICK_ACTIONS
      : [];

  return (
    <div ref={ref} className="fixed bottom-[calc(9.25rem+env(safe-area-inset-bottom))] right-4 z-[var(--layer-ai-panel)] flex flex-col items-end gap-2 md:bottom-[5.5rem] md:right-6">
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ duration: 0.15 }}
            className="w-[340px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:w-[420px]"
          >
            <form onSubmit={handleSubmit}>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                  {loading ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    >
                      <Sparkles size={16} className="text-[var(--brand-500)]" />
                    </motion.div>
                  ) : (
                    <Sparkles size={16} className="text-slate-400" />
                  )}
                </div>
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActiveIndex(-1);
                    setShowAiResult(false);
                  }}
                  onKeyDown={(e) => {
                    const items = showAiResult
                      ? (aiResponse?.suggestions || [])
                      : displayItems;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setActiveIndex((prev) =>
                        prev < items.length - 1 ? prev + 1 : 0,
                      );
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setActiveIndex((prev) =>
                        prev > 0 ? prev - 1 : items.length - 1,
                      );
                    } else if (e.key === "Escape") {
                      setExpanded(false);
                      setShowAiResult(false);
                    } else if (
                      e.key === "Enter" &&
                      activeIndex >= 0 &&
                      activeIndex < items.length
                    ) {
                      e.preventDefault();
                      handleSelect(items[activeIndex]);
                    }
                  }}
                  placeholder="Ask AI to find services..."
                  className="w-full rounded-2xl border-0 bg-transparent py-3.5 pl-10 pr-10 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setActiveIndex(-1);
                    setShowAiResult(false);
                    setAiResponse(null);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={15} />
                </button>
              </div>
            </form>

            <AnimatePresence>
              {!loading && showAiResult && aiResponse && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: "auto" }}
                  exit={{ height: 0 }}
                  className="border-t border-slate-100"
                >
                  <div className="bg-gradient-to-r from-[var(--brand-50)] to-white p-3.5">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 shrink-0 rounded-full bg-[var(--brand-100)] p-1.5 text-[var(--brand-600)]">
                        <Sparkles size={13} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800">
                          {aiResponse.response}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {aiResponse.redirect && (
                            <button
                              type="button"
                              onClick={() => {
                                saveRecent(query);
                                router.push(aiResponse.redirect!);
                                setExpanded(false);
                                setShowAiResult(false);
                              }}
                              className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-500)] px-3 py-1 text-xs font-semibold text-white hover:bg-[var(--brand-600)]"
                            >
                              <Search size={11} />
                              Browse results
                              <ArrowRight size={11} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleSelect(query)}
                            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            <Search size={11} />
                            Search market
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  {aiResponse.suggestions.length > 0 && (
                    <>
                      <div className="flex items-center gap-1.5 border-b border-slate-100 px-3.5 py-1.5">
                        <TrendingUp size={12} className="text-slate-400" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Try asking
                        </span>
                      </div>
                      {aiResponse.suggestions.slice(0, 5).map((s, i) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => handleSelect(s)}
                          onMouseEnter={() => setActiveIndex(i)}
                          className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition ${
                            activeIndex === i
                              ? "bg-[var(--brand-50)] text-[var(--brand-700)]"
                              : "text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <TrendingUp size={13} className="shrink-0 text-slate-400" />
                          <span className="font-medium">{s}</span>
                        </button>
                      ))}
                    </>
                  )}
                </motion.div>
              )}

              {!loading && !showAiResult && displayItems.length > 0 && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: "auto" }}
                  exit={{ height: 0 }}
                  className="border-t border-slate-100"
                >
                  <div className="flex items-center gap-1.5 border-b border-slate-100 px-3.5 py-1.5">
                    <Sparkles size={12} className="text-[var(--brand-500)]" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Try asking
                    </span>
                  </div>
                  {displayItems.map((item, i) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setActiveIndex(i)}
                      className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition ${
                        activeIndex === i
                          ? "bg-[var(--brand-50)] text-[var(--brand-700)]"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Search size={13} className="shrink-0 text-slate-400" />
                      <span className="font-medium">{item}</span>
                    </button>
                  ))}
                </motion.div>
              )}

              {loading && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: "auto" }}
                  exit={{ height: 0 }}
                  className="border-t border-slate-100 p-4 text-center"
                >
                  <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Thinking...
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setExpanded(!expanded)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-900)] text-white shadow-lg transition hover:bg-[var(--brand-800)]"
        aria-label={expanded ? "Close AI assistant" : "Open AI assistant"}
      >
        {expanded ? <X size={20} /> : <Sparkles size={22} />}
      </motion.button>
    </div>
  );
}
