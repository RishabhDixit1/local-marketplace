"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Search, TrendingUp, X } from "lucide-react";
import { Input } from "@/app/components/ui/Input";

const STORAGE_KEY = "serviq-recent-searches";
const MAX_RECENT = 5;

const suggestions = [
  "AC repair",
  "Plumber",
  "Electrician",
  "Carpenter",
  "RO repair",
  "Appliance repair",
  "Mobile repair",
  "Bike repair",
  "Hardware shop",
  "Painter",
];

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

export function AutocompleteSearch({
  placeholder = "What do you need done?",
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
  const ref = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredSuggestions = query.trim()
    ? suggestions.filter((s) => s.toLowerCase().includes(query.toLowerCase()))
    : suggestions;

  const handleSelect = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      setQuery(trimmed);
      setIsOpen(false);
      saveRecent(trimmed);
      if (onSearch) {
        onSearch(trimmed);
      } else {
        router.push(`/search?q=${encodeURIComponent(trimmed)}`);
      }
    },
    [router, onSearch],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeIndex >= 0 && activeIndex < filteredSuggestions.length) {
      handleSelect(filteredSuggestions[activeIndex]);
    } else if (query.trim()) {
      handleSelect(query);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const items = query.trim() ? filteredSuggestions : recent;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const showDropdown = isOpen && (query.trim() ? filteredSuggestions.length > 0 : recent.length > 0);

  return (
    <div ref={ref} className="relative w-full">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
              setActiveIndex(-1);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            leftIcon={<Search size={18} />}
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls={listboxId}
            aria-autocomplete="list"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setActiveIndex(-1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-500)] hover:text-[var(--ink-700)]"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </form>

      <AnimatePresence>
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
                {filteredSuggestions.map((s, i) => (
                  <button
                    key={s}
                    type="button"
                    role="option"
                    aria-selected={activeIndex === i}
                    onClick={() => handleSelect(s)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition ${
                      activeIndex === i
                        ? "bg-[var(--brand-50)] text-[var(--brand-700)]"
                        : "text-[var(--ink-700)] hover:bg-[var(--surface-soft)]"
                    }`}
                  >
                    <Search size={14} className="shrink-0 text-[var(--ink-500)]" />
                    <span className="font-medium">{s}</span>
                  </button>
                ))}
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 border-b border-[var(--surface-border)] px-4 py-2">
                  <Clock size={14} className="text-[var(--ink-500)]" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-500)]">
                    Recent
                  </span>
                </div>
                {recent.map((s, i) => (
                  <button
                    key={s}
                    type="button"
                    role="option"
                    aria-selected={activeIndex === i}
                    onClick={() => handleSelect(s)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition ${
                      activeIndex === i
                        ? "bg-[var(--brand-50)] text-[var(--brand-700)]"
                        : "text-[var(--ink-700)] hover:bg-[var(--surface-soft)]"
                    }`}
                  >
                    <Clock size={14} className="shrink-0 text-[var(--ink-500)]" />
                    <span className="font-medium">{s}</span>
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
