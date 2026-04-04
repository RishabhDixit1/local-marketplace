"use client";

import {
  ArrowRightLeft,
  ClipboardList,
  MapPinned,
  MessageSquareText,
  Store,
  type LucideIcon,
} from "lucide-react";

export type MarketplaceJourneyMode = "user" | "provider" | "both";

type JourneyStep = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  iconClassName: string;
};

type JourneyCard = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  iconClassName: string;
};

type JourneyContent = {
  eyebrow: string;
  title: string;
  description: string;
  steps: JourneyStep[];
  roleCards: JourneyCard[];
};

const contentByMode: Record<MarketplaceJourneyMode, JourneyContent> = {
  user: {
    eyebrow: "How ServiQ works",
    title: "Post what you need and get help from people nearby.",
    description:
      "Use ServiQ when you need a repair, delivery, errand runner, local product, or same-day support without juggling scattered chats.",
    steps: [
      {
        id: "post",
        title: "Post your need",
        description: "Share the task, location, and timing in one clear request.",
        icon: ClipboardList,
        iconClassName: "bg-cyan-100 text-cyan-700",
      },
      {
        id: "match",
        title: "See nearby replies",
        description: "Local providers can respond, quote, or accept based on fit.",
        icon: MapPinned,
        iconClassName: "bg-emerald-100 text-emerald-700",
      },
      {
        id: "complete",
        title: "Track it to completion",
        description: "Chat, confirm, pay, and follow progress in one workflow.",
        icon: MessageSquareText,
        iconClassName: "bg-amber-100 text-amber-700",
      },
    ],
    roleCards: [
      {
        id: "need-help",
        title: "Need help",
        description: "Post once, compare replies, and keep status updates in one place.",
        icon: ClipboardList,
        iconClassName: "bg-slate-900 text-white",
      },
      {
        id: "earn-nearby",
        title: "Earn nearby",
        description: "You can still switch later and start offering services or products too.",
        icon: Store,
        iconClassName: "bg-white text-slate-900 ring-1 ring-slate-200",
      },
    ],
  },
  provider: {
    eyebrow: "How ServiQ works",
    title: "Turn nearby demand into paid work you can manage clearly.",
    description:
      "Use ServiQ to publish what you offer, reply faster than informal chats, and keep active orders, trust signals, and follow-through in one place.",
    steps: [
      {
        id: "publish",
        title: "Add what you offer",
        description: "Create a service or product listing so people can discover you.",
        icon: Store,
        iconClassName: "bg-indigo-100 text-indigo-700",
      },
      {
        id: "reply",
        title: "Reply to local demand",
        description: "See nearby needs, send quotes, and respond before the lead goes cold.",
        icon: ArrowRightLeft,
        iconClassName: "bg-cyan-100 text-cyan-700",
      },
      {
        id: "manage",
        title: "Run the job in-app",
        description: "Track chats, orders, and completion instead of scattered follow-ups.",
        icon: MessageSquareText,
        iconClassName: "bg-emerald-100 text-emerald-700",
      },
    ],
    roleCards: [
      {
        id: "need-help",
        title: "Need help",
        description: "You can post your own needs too if you want help from the network.",
        icon: ClipboardList,
        iconClassName: "bg-white text-slate-900 ring-1 ring-slate-200",
      },
      {
        id: "earn-nearby",
        title: "Earn nearby",
        description: "Publish a clear offer, build trust, and turn fast replies into bookings.",
        icon: Store,
        iconClassName: "bg-slate-900 text-white",
      },
    ],
  },
  both: {
    eyebrow: "What ServiQ is",
    title: "A local marketplace where you can ask for help, earn nearby, or do both.",
    description:
      "Instead of bouncing between calls, chat apps, and spreadsheets, ServiQ keeps the request, response, and order flow in one shared system.",
    steps: [
      {
        id: "start",
        title: "Start with a real request or offer",
        description: "Post a need or publish a service or product to enter the live marketplace.",
        icon: ClipboardList,
        iconClassName: "bg-cyan-100 text-cyan-700",
      },
      {
        id: "connect",
        title: "Connect with nearby people",
        description: "Discover providers, reply to demand, and move from browse to conversation fast.",
        icon: MapPinned,
        iconClassName: "bg-emerald-100 text-emerald-700",
      },
      {
        id: "run",
        title: "Track the full job flow",
        description: "Use chat, status tracking, payment, and support as one system.",
        icon: MessageSquareText,
        iconClassName: "bg-amber-100 text-amber-700",
      },
    ],
    roleCards: [
      {
        id: "need-help",
        title: "Need help",
        description: "Post local tasks, compare replies, and keep the job moving clearly.",
        icon: ClipboardList,
        iconClassName: "bg-slate-900 text-white",
      },
      {
        id: "earn-nearby",
        title: "Earn nearby",
        description: "List your services or products, reply fast, and build repeat trust.",
        icon: Store,
        iconClassName: "bg-slate-900 text-white",
      },
    ],
  },
};

type MarketplaceJourneyGuideProps = {
  mode: MarketplaceJourneyMode;
  compact?: boolean;
  className?: string;
  showRoleCards?: boolean;
};

export default function MarketplaceJourneyGuide({
  mode,
  compact = false,
  className = "",
  showRoleCards = true,
}: MarketplaceJourneyGuideProps) {
  const content = contentByMode[mode];
  const rootClassName = [
    "rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_50px_-38px_rgba(15,23,42,0.55)]",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={rootClassName}>
      <div className={compact ? "p-4 sm:p-5" : "p-5 sm:p-6"}>
        <span className="inline-flex items-center rounded-full bg-[var(--brand-50)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-700)]">
          {content.eyebrow}
        </span>
        <h2 className={compact ? "mt-3 text-lg font-semibold text-slate-900" : "mt-4 text-[1.65rem] font-semibold text-slate-900"}>
          {content.title}
        </h2>
        <p className={compact ? "mt-2 text-sm leading-6 text-slate-600" : "mt-2.5 text-sm leading-6 text-slate-600 sm:text-[0.95rem]"}>
          {content.description}
        </p>

        <div className={compact ? "mt-4 grid gap-3 sm:grid-cols-3" : "mt-5 grid gap-3 sm:grid-cols-3"}>
          {content.steps.map((step, index) => {
            const StepIcon = step.icon;

            return (
              <article
                key={step.id}
                className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${step.iconClassName}`}>
                    <StepIcon className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400">0{index + 1}</span>
                </div>
                <h3 className="mt-4 text-sm font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-1.5 text-xs leading-5 text-slate-600">{step.description}</p>
              </article>
            );
          })}
        </div>

        {showRoleCards ? (
          <div className={compact ? "mt-4 grid gap-3 sm:grid-cols-2" : "mt-5 grid gap-3 sm:grid-cols-2"}>
            {content.roleCards.map((card) => {
              const CardIcon = card.icon;

              return (
                <article
                  key={card.id}
                  className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${card.iconClassName}`}>
                      <CardIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900">{card.title}</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{card.description}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
