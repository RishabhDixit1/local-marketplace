"use client";

import { useEffect, useRef, useState } from "react";

export function NavigationProgress() {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const stop = () => {
      if (timerRef.current !== undefined) clearInterval(timerRef.current);
      if (hideTimerRef.current !== undefined) clearTimeout(hideTimerRef.current);
      setProgress(100);
      hideTimerRef.current = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);
    };

    const start = () => {
      if (timerRef.current !== undefined) clearInterval(timerRef.current);
      if (hideTimerRef.current !== undefined) clearTimeout(hideTimerRef.current);
      setProgress(0);
      setVisible(true);
      let p = 0;
      timerRef.current = setInterval(() => {
        p += 2 + Math.random() * 4;
        if (p >= 85) {
          if (timerRef.current !== undefined) clearInterval(timerRef.current);
          timerRef.current = undefined;
          p = 85;
        }
        setProgress(p);
      }, 150);
      hideTimerRef.current = setTimeout(stop, 5000);
    };

    const handleClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest("a");
      if (!link || link.target || link.hasAttribute("download")) return;
      try {
        const url = new URL(link.href);
        if (url.origin === location.origin) {
          start();
        }
      } catch {
        /* ignore */
      }
    };
    const handleSubmit = () => start();
    document.addEventListener("click", handleClick);
    document.addEventListener("submit", handleSubmit);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("submit", handleSubmit);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current !== undefined) clearInterval(timerRef.current);
      if (hideTimerRef.current !== undefined) clearTimeout(hideTimerRef.current);
    };
  }, []);

  return (
    <div
      className={`fixed left-0 right-0 top-0 z-[200] transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
      aria-hidden={!visible}
    >
      <div
        className="h-0.5 bg-[var(--brand-500)] transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
