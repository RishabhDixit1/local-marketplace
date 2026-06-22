"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Loader2, MessageCircle, Star, Store, TrendingUp, UserPlus,
} from "lucide-react";
import { buildPublicProfilePath } from "@/lib/profile/utils";
import type { ProviderCardData } from "@/app/dashboard/components/dashboard-types";

interface DashboardProviderScrollProps {
  providers: ProviderCardData[];
  loading: boolean;
  connectedProviderIds: Set<string>;
  connectingProviderId: string | null;
  onConnect: (providerId: string, providerName: string) => void;
}

function ProviderSkeleton() {
  return (
    <div className="group flex min-w-[200px] sm:min-w-[240px] max-w-[280px] shrink-0 flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 animate-pulse items-center justify-center rounded-full bg-slate-200" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-32 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
      <div className="space-y-1">
        <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="flex items-center gap-3">
        <div className="h-3 w-16 animate-pulse rounded bg-slate-100" />
        <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="flex items-center gap-1.5 border-t border-slate-100 pt-2">
        <div className="h-6 w-16 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-6 w-20 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-6 w-16 animate-pulse rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}

function ProviderCard({
  provider,
  isConnected,
  isConnecting,
  onConnect,
}: {
  provider: ProviderCardData;
  isConnected: boolean;
  isConnecting: boolean;
  onConnect: (providerId: string, providerName: string) => void;
}) {
  return (
    <div className="group flex min-w-[200px] sm:min-w-[250px] max-w-[290px] shrink-0 flex-col gap-2.5 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-[var(--brand-300)] hover:shadow-lg hover:shadow-slate-200/50">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[var(--brand-100)] to-[var(--brand-200)] text-sm font-bold text-[var(--brand-700)]">
            {provider.avatarUrl ? (
              <Image
                src={provider.avatarUrl}
                alt={provider.name}
                fill
                sizes="44px"
                className="object-cover"
              />
            ) : (
              provider.name.charAt(0).toUpperCase()
            )}
          </div>
          {provider.isOnline && (
            <span className="absolute -right-0.5 bottom-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500 shadow-sm" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-bold text-slate-900">{provider.name}</p>
            {provider.verified && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                <TrendingUp className="h-2.5 w-2.5" />
                Verified
              </span>
            )}
          </div>
          <p className="truncate text-xs text-slate-500">{provider.location || "Crossings Republik"}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs">
        {provider.avgRating ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5">
            <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
            <span className="font-semibold text-amber-700">{provider.avgRating.toFixed(1)}</span>
            {provider.reviewCount > 0 && (
              <span className="text-amber-600">({provider.reviewCount})</span>
            )}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-slate-500">
            <Star className="h-3 w-3 text-slate-300" />
            No reviews
          </span>
        )}
        {provider.completedJobs > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-slate-600">
            <span className="font-semibold">{provider.completedJobs}</span>
            <span>job{provider.completedJobs === 1 ? "" : "s"}</span>
          </span>
        )}
        {provider.responseMinutes != null && (
          <span className="inline-flex items-center gap-1 text-slate-500">
            ~{provider.responseMinutes}m
          </span>
        )}
      </div>

      {provider.bio && (
        <p className="line-clamp-2 text-xs leading-relaxed text-slate-600">{provider.bio}</p>
      )}

      {provider.listings.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {provider.listings.slice(0, 3).map((l) => (
            <span
              key={l.id}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700"
            >
              <Store className="h-2.5 w-2.5 text-slate-400" />
              {l.title}
              {l.price != null && (
                <span className="font-semibold text-[var(--brand-700)]">₹{l.price.toLocaleString("en-IN")}</span>
              )}
            </span>
          ))}
          {provider.listings.length > 3 && (
            <span className="inline-flex items-center rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
              +{provider.listings.length - 3} more
            </span>
          )}
        </div>
      )}

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2.5">
        <Link
          href={`/dashboard/chat?recipientId=${encodeURIComponent(provider.id)}`}
          className="inline-flex items-center gap-1 rounded-xl bg-[var(--brand-900)] px-3 min-h-9 py-2 text-xs font-semibold text-white transition hover:bg-[var(--brand-800)] hover:shadow-md"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Chat
        </Link>

        {buildPublicProfilePath(provider) && (
          <Link
            href={buildPublicProfilePath(provider)!}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 min-h-9 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Store className="h-3.5 w-3.5" />
            Storefront
          </Link>
        )}

        {isConnected ? (
          <span className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 min-h-9 py-2 text-xs font-semibold text-emerald-700">
            <Star className="h-3.5 w-3.5 fill-emerald-500 text-emerald-500" />
            Connected
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onConnect(provider.id, provider.name)}
            disabled={isConnecting}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 min-h-9 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isConnecting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <UserPlus className="h-3.5 w-3.5" />
            )}
            {isConnecting ? "..." : "Connect"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function DashboardProviderScroll({
  providers,
  loading,
  connectedProviderIds,
  connectingProviderId,
  onConnect,
}: DashboardProviderScrollProps) {
  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {Array.from({ length: 4 }).map((_, index) => (
          <ProviderSkeleton key={`skeleton-${index}`} />
        ))}
      </div>
    );
  }

  if (providers.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {providers.map((p) => (
          <ProviderCard
            key={p.id}
            provider={p}
            isConnected={connectedProviderIds.has(p.id)}
            isConnecting={connectingProviderId === p.id}
            onConnect={onConnect}
          />
        ))}
      </div>
    </div>
  );
}
