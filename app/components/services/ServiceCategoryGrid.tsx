"use client";

import Link from "next/link";
import {
  Zap, Droplets, Filter, Wind, Flame, Wrench, Hammer, type LucideIcon,
} from "lucide-react";

type ServiceCategory = {
  id: string;
  name: string;
  slug: string;
  icon_slug: string;
  description: string;
  base_price_min: number | null;
  base_price_max: number | null;
  estimated_duration_mins: number | null;
  provider_count?: number;
};

const iconMap: Record<string, LucideIcon> = {
  zap: Zap,
  droplets: Droplets,
  filter: Filter,
  wind: Wind,
  flame: Flame,
  wrench: Wrench,
  hammer: Hammer,
};

export default function ServiceCategoryGrid({
  categories,
  localityId,
  zoneSlug,
}: {
  categories: ServiceCategory[];
  localityId?: string;
  zoneSlug?: string;
}) {
  const visibleCategories = categories.filter(
    (c) => c.base_price_min != null && c.base_price_max != null
  );

  if (visibleCategories.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--surface-border)] bg-[var(--surface-soft)]/50 p-8 text-center">
        <p className="text-sm font-semibold text-[var(--ink-500)]">No service categories available yet</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {visibleCategories.map((cat) => {
        const Icon = iconMap[cat.icon_slug] || Wrench;
        return (
          <Link
            key={cat.id}
            href={
              zoneSlug
                ? `/market/zone/${zoneSlug}?category=${cat.slug}`
                : localityId
                  ? `/?category=${cat.slug}&locality=${localityId}`
                  : `/?category=${cat.slug}`
            }
            className="nameplate-card group flex flex-col items-start gap-3 p-4 pt-6"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-50)] text-[var(--brand-700)]">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-[var(--ink-950)] group-hover:text-[var(--brand-700)]">
                {cat.name}
              </h3>
              <p className="mt-0.5 text-xs text-[var(--ink-500)] tabular-nums">
                ₹{cat.base_price_min}–{cat.base_price_max}
              </p>
              {cat.provider_count != null && (
                <p className="mt-1 text-[10px] font-medium text-[var(--brand-600)] tabular-nums">
                  {cat.provider_count} provider{cat.provider_count === 1 ? "" : "s"} nearby
                </p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
