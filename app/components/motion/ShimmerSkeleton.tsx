"use client";

import { motion } from "framer-motion";

export function ShimmerSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`relative isolate overflow-hidden rounded-xl bg-slate-200 dark:bg-slate-800 ${className}`}>
      <motion.div
        className="absolute inset-0 -translate-x-full"
        animate={{ x: ["0%", "100%"] }}
        transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
      >
        <div className="h-full w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </motion.div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-4">
      <div className="flex items-center gap-3">
        <ShimmerSkeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <ShimmerSkeleton className="h-4 w-3/5" />
          <ShimmerSkeleton className="h-3 w-2/5" />
        </div>
      </div>
      <ShimmerSkeleton className="mt-3 h-3 w-full" />
      <ShimmerSkeleton className="mt-2 h-3 w-4/5" />
      <div className="mt-4 flex gap-2">
        <ShimmerSkeleton className="h-8 w-20 rounded-lg" />
        <ShimmerSkeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
