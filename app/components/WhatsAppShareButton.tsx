"use client";

import { useState } from "react";
import { MessageCircle, Check, Copy } from "lucide-react";

interface WhatsAppShareButtonProps {
  href: string;
  label?: string;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "outline";
}

export function WhatsAppShareButton({
  href,
  label = "Share on WhatsApp",
  size = "sm",
  variant = "outline",
}: WhatsAppShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const sizeClasses = {
    sm: "gap-1.5 px-2.5 py-1.5 text-xs",
    md: "gap-2 px-3.5 py-2 text-sm",
    lg: "gap-2.5 px-5 py-3 text-base",
  };

  const variantClasses = {
    primary:
      "bg-[#25D366] text-white hover:bg-[#20BD5A] border border-transparent",
    outline:
      "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300",
  };

  const handleClick = () => {
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const handleCopyLink = async () => {
    try {
      const url = new URL(href);
      const text = url.searchParams.get("text") || href;
      await navigator.clipboard.writeText(decodeURIComponent(text));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      handleClick();
    }
  };

  return (
    <div className="inline-flex overflow-hidden rounded-xl border border-slate-200">
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center ${sizeClasses[size]} ${variantClasses[variant]} rounded-none transition`}
      >
        <MessageCircle className={`${size === "sm" ? "h-3.5 w-3.5" : size === "md" ? "h-4 w-4" : "h-5 w-5"}`} />
        <span>{label}</span>
      </button>
      <button
        type="button"
        onClick={handleCopyLink}
        className="inline-flex items-center border-l border-slate-200 px-2.5 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
        aria-label="Copy share text"
        title="Copy share text"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
