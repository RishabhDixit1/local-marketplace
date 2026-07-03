"use client";

import { AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { PageTransition } from "./PageTransition";

export function AnimatedPage({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <AnimatePresence mode="wait">
      <PageTransition key={pathname}>{children}</PageTransition>
    </AnimatePresence>
  );
}
