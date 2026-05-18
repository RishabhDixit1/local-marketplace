"use client";

import { CheckCircle2, MessageCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

type WhatHappensNextStep = {
  icon: typeof CheckCircle2;
  label: string;
  description: string;
};

type WhatHappensNextProps = {
  kind: "connect" | "accept" | "quote" | "notification" | "post_need";
  className?: string;
};

const actionConfigs: Record<WhatHappensNextProps["kind"], { title: string; steps: WhatHappensNextStep[]; cta?: { label: string; href: string } }> = {
  connect: {
    title: "What happens after you connect",
    steps: [
      { icon: CheckCircle2, label: "Request sent", description: "The provider gets your connection request immediately." },
      { icon: CheckCircle2, label: "They review", description: "They can accept, schedule, or decline based on availability." },
      { icon: MessageCircle, label: "Chat opens", description: "Once accepted, you can message them directly and share details." },
    ],
    cta: { label: "Go to Inbox", href: "/dashboard/chat" },
  },
  accept: {
    title: "What happens after you accept",
    steps: [
      { icon: CheckCircle2, label: "Provider notified", description: "They know you're interested and will follow up." },
      { icon: CheckCircle2, label: "Quote or confirm", description: "They may send a quote or confirm the next steps." },
      { icon: ArrowRight, label: "Track progress", description: "The task moves to your work board for full visibility." },
    ],
    cta: { label: "View Tasks", href: "/dashboard/tasks" },
  },
  quote: {
    title: "What happens with quotes",
    steps: [
      { icon: CheckCircle2, label: "Quote drafted", description: "The provider prepares a custom quote based on your request." },
      { icon: CheckCircle2, label: "Review & decide", description: "You can accept, negotiate, or decline the quote." },
      { icon: ArrowRight, label: "Order created", description: "Once accepted, it becomes an order you can track." },
    ],
    cta: { label: "Open Tasks", href: "/dashboard/tasks" },
  },
  notification: {
    title: "Where this notification takes you",
    steps: [
      { icon: CheckCircle2, label: "Focused view", description: "You'll land on the exact item that needs your attention." },
      { icon: CheckCircle2, label: "Take action", description: "Each notification has a clear next action button." },
      { icon: ArrowRight, label: "Return anytime", description: "Use the nav to go back to your previous screen." },
    ],
  },
  post_need: {
    title: "What happens after you post",
    steps: [
      { icon: CheckCircle2, label: "Listed on marketplace", description: "Your need appears in the feed for nearby providers." },
      { icon: CheckCircle2, label: "Providers respond", description: "They can express interest, send quotes, or message you." },
      { icon: ArrowRight, label: "Track responses", description: "Manage all interest and quotes from your Tasks board." },
    ],
    cta: { label: "Track Responses", href: "/dashboard/tasks" },
  },
};

export default function WhatHappensNext({ kind, className = "" }: WhatHappensNextProps) {
  const config = actionConfigs[kind];
  if (!config) return null;

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm ${className}`}>
      <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--brand-700)]">
        {config.title}
      </p>
      <div className="space-y-2">
        {config.steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={step.label} className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--brand-50)]">
                <Icon className="h-3.5 w-3.5 text-[var(--brand-700)]" />
              </span>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-slate-900">
                  {index + 1}. {step.label}
                </span>
                <p className="text-xs leading-5 text-slate-500">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>
      {config.cta && (
        <Link
          href={config.cta.href}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-900)] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[var(--brand-700)]"
        >
          {config.cta.label}
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}
