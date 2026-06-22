"use client";

export function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-1 px-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--brand-500)]" style={{ animationDelay: "0ms" }} />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--brand-500)]" style={{ animationDelay: "150ms" }} />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--brand-500)]" style={{ animationDelay: "300ms" }} />
    </span>
  );
}
