"use client";

import { useEffect } from "react";

type Shortcut = {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  handler: () => void;
  enabled?: boolean;
};

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      for (const s of shortcuts) {
        if (s.enabled === false) continue;

        const keyMatch = e.key.toLowerCase() === s.key.toLowerCase();
        const ctrlMatch = s.ctrl ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey;
        const metaMatch = s.meta ? e.metaKey : true;

        if (keyMatch && ctrlMatch && metaMatch) {
          // Don't fire unmodified single-character shortcuts when typing in inputs
          if (!s.ctrl && !s.meta) {
            const target = e.target as HTMLElement;
            const isInput =
              target.tagName === "INPUT" ||
              target.tagName === "TEXTAREA" ||
              target.isContentEditable;
            if (isInput) continue;
          }
          e.preventDefault();
          s.handler();
          return;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);
}
