"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeIndianRupee,
  BriefcaseBusiness,
  ClipboardList,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import PageContextStrip from "@/app/components/PageContextStrip";
import type { DashboardPromptConfig } from "@/app/components/prompt/DashboardPromptContext";
import { useDashboardPrompt } from "@/app/components/prompt/DashboardPromptContext";
import ProviderControlNav from "@/app/components/provider/ProviderControlNav";
import { fetchProviderListings } from "@/lib/provider/client";
import type { ProviderProductListing, ProviderServiceListing } from "@/lib/provider/listings";
import { formatServicePriceLabel } from "@/lib/provider/listings";
import {
  getOrderStatusLabel,
  getOrderStatusPillClass,
  normalizeOrderStatus,
} from "@/lib/orderWorkflow";
import { supabase } from "@/lib/supabase";

const INR = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

type ProviderOrder = {
  id: string;
  status: string;
  price: number | null;
  created_at: string;
  listing_type: string;
  metadata: Record<string, unknown> | null;
};

type ControlListing = {
  id: string;
  kind: "service" | "product";
  title: string;
  statusLabel: string;
  priceLabel: string;
  createdAt: string | null;
};

const formatRelativeDate = (value: string | null | undefined) => {
  if (!value) return "Just now";

  try {
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(value));
  } catch {
    return "Just now";
  }
};

export default function ProviderControlPage() {
  const router = useRouter();
  const [providerId, setProviderId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("Provider");
  const [services, setServices] = useState<ProviderServiceListing[]>([]);
  const [products, setProducts] = useState<ProviderProductListing[]>([]);
  const [orders, setOrders] = useState<ProviderOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const loadControlCenter = useCallback(async (userId: string, options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [listingPayload, ordersResult] = await Promise.all([
        fetchProviderListings(),
        supabase
          .from("orders")
          .select("id,status,price,created_at,listing_type,metadata")
          .eq("provider_id", userId)
          .order("created_at", { ascending: false }),
      ]);

      setServices(listingPayload.services);
      setProducts(listingPayload.products);
      setOrders(((ordersResult.data as ProviderOrder[] | null) || []).map((order) => ({
        ...order,
        metadata:
          order.metadata && typeof order.metadata === "object" && !Array.isArray(order.metadata)
            ? order.metadata
            : null,
      })));
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load provider controls.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;
      if (!user) {
        setLoading(false);
        return;
      }

      setProviderId(user.id);
      setDisplayName(
        typeof user.user_metadata?.name === "string" && user.user_metadata.name.trim()
          ? user.user_metadata.name.trim()
          : user.email?.split("@")[0] || "Provider"
      );
      await loadControlCenter(user.id);
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, [loadControlCenter]);

  useEffect(() => {
    if (!providerId) return;

    let refreshTimerId: number | null = null;
    const queueRefresh = () => {
      if (refreshTimerId) window.clearTimeout(refreshTimerId);
      refreshTimerId = window.setTimeout(() => void loadControlCenter(providerId, { silent: true }), 180);
    };

    const channel = supabase
      .channel(`provider-control-${providerId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "service_listings", filter: `provider_id=eq.${providerId}` }, queueRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "product_catalog", filter: `provider_id=eq.${providerId}` }, queueRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `provider_id=eq.${providerId}` }, queueRefresh)
      .subscribe();

    return () => {
      if (refreshTimerId) window.clearTimeout(refreshTimerId);
      void supabase.removeChannel(channel);
    };
  }, [loadControlCenter, providerId]);

  const activeServices = useMemo(
    () => services.filter((service) => service.availability !== "offline").length,
    [services]
  );
  const activeProducts = useMemo(() => products.filter((product) => product.stock > 0).length, [products]);
  const liveListings = activeServices + activeProducts;
  const activeOrders = useMemo(
    () =>
      orders.filter((order) =>
        ["new_lead", "quoted", "accepted", "in_progress"].includes(normalizeOrderStatus(order.status))
      ).length,
    [orders]
  );
  const completedOrders = useMemo(
    () =>
      orders.filter((order) =>
        ["completed", "closed"].includes(normalizeOrderStatus(order.status))
      ),
    [orders]
  );
  const totalRevenue = completedOrders.reduce((sum, order) => sum + (order.price ?? 0), 0);

  const recentListings = useMemo<ControlListing[]>(() => {
    const merged: ControlListing[] = [
      ...services.map((service) => ({
        id: service.id,
        kind: "service" as const,
        title: service.title,
        statusLabel: service.availability === "offline" ? "Paused" : "Live",
        priceLabel: formatServicePriceLabel(service.price, service.pricingType),
        createdAt: service.createdAt,
      })),
      ...products.map((product) => ({
        id: product.id,
        kind: "product" as const,
        title: product.title,
        statusLabel: product.stock > 0 ? "In stock" : "Paused",
        priceLabel: product.price > 0 ? INR(product.price) : "Price on request",
        createdAt: product.createdAt,
      })),
    ];

    return merged
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 5);
  }, [products, services]);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const filteredRecentListings = useMemo(() => {
    if (!normalizedSearchQuery) return recentListings;

    return recentListings.filter((listing) =>
      [listing.title, listing.kind, listing.statusLabel, listing.priceLabel]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearchQuery)
    );
  }, [normalizedSearchQuery, recentListings]);

  const filteredOrders = useMemo(() => {
    if (!normalizedSearchQuery) return orders;

    return orders.filter((order) => {
      const title =
        typeof order.metadata?.title === "string" && order.metadata.title.trim()
          ? order.metadata.title.trim()
          : `${order.listing_type} order`;

      return [title, order.listing_type, normalizeOrderStatus(order.status), order.price ? INR(order.price) : "price tbd"]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearchQuery);
    });
  }, [normalizedSearchQuery, orders]);

  const controlPromptConfig = useMemo<DashboardPromptConfig>(
    () => ({
      placeholder: "Search listings, orders, inventory, pricing, or business setup",
      value: searchQuery,
      onValueChange: setSearchQuery,
      actions: [
        {
          id: "refresh",
          label: "Refresh",
          icon: RefreshCw,
          onClick: () =>
            providerId ? loadControlCenter(providerId, { silent: true }) : undefined,
          variant: "secondary",
          busy: refreshing,
        },
        {
          id: "business-ai",
          label: "Business AI",
          icon: Sparkles,
          onClick: () => router.push("/dashboard/launchpad"),
          variant: "primary",
        },
      ],
    }),
    [loadControlCenter, providerId, refreshing, router, searchQuery]
  );

  useDashboardPrompt(controlPromptConfig);

  const metricCards = [
    {
      label: "Live",
      value: String(liveListings),
      meta: `${services.length}s / ${products.length}p`,
      icon: BriefcaseBusiness,
      tone: "bg-sky-50 text-sky-700",
    },
    {
      label: "Pipeline",
      value: String(activeOrders),
      meta: "Open now",
      icon: ClipboardList,
      tone: "bg-indigo-50 text-indigo-700",
    },
    {
      label: "Completed",
      value: String(completedOrders.length),
      meta: "Done",
      icon: Sparkles,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Revenue",
      value: INR(totalRevenue),
      meta: "Settled",
      icon: BadgeIndianRupee,
      tone: "bg-amber-50 text-amber-700",
    },
  ] as const;

  if (!providerId && !loading) {
    return (
      <div className="mx-auto w-full max-w-[1240px] space-y-4">
        <ProviderControlNav />
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-700">
          Please log in as a provider to open your control center.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1240px] space-y-4">
      <ProviderControlNav />

      <PageContextStrip
        label="Control"
        description="Run listings, orders, inventory, and AI-assisted business setup from the same control center."
        action={{ label: "Open Business AI", href: "/dashboard/launchpad" }}
        switchAction={{ label: "Open Tasks", href: "/dashboard/tasks" }}
      />

      <section className="rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--brand-900)] text-white">
                <BriefcaseBusiness className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold tracking-tight text-slate-950">Control</h1>
                <p className="truncate text-sm text-slate-500">{displayName}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                {liveListings} live
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                {activeOrders} active
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                {completedOrders.length} done
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                {refreshing ? "Syncing" : "Realtime"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/provider/add-service"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-[var(--brand-500)]/40 hover:text-slate-950"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden md:inline">Add Service</span>
            </Link>
            <Link
              href="/dashboard/provider/add-product"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-[var(--brand-500)]/40 hover:text-slate-950"
            >
              <Package className="h-4 w-4" />
              <span className="hidden md:inline">Add Product</span>
            </Link>
            <Link
              href="/dashboard/launchpad"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[var(--brand-900)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden md:inline">Business AI</span>
            </Link>
            <button
              type="button"
              onClick={() => providerId ? void loadControlCenter(providerId, { silent: true }) : undefined}
              disabled={refreshing}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-[var(--brand-500)]/40 hover:text-slate-950 disabled:opacity-60"
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="hidden md:inline">Refresh</span>
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((metric) => (
          <div key={metric.label} className="flex items-center gap-3 rounded-[1.35rem] border border-slate-200 bg-white px-3 py-3 shadow-sm">
            <div className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${metric.tone}`}>
              <metric.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{metric.label}</p>
              <div className="flex items-end gap-2">
                <p className="truncate text-xl font-semibold tracking-tight text-slate-950">{metric.value}</p>
                <p className="truncate pb-0.5 text-[11px] font-medium text-slate-400">{metric.meta}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Storefront</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">Recent listings</h2>
          </div>
          <Link href="/dashboard/provider/listings" className="text-sm font-semibold text-[var(--brand-700)] hover:underline">
            Open all
          </Link>
        </div>

        {loading ? (
          <div className="mt-5 flex min-h-[220px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : filteredRecentListings.length === 0 ? (
          <div className="mt-4 rounded-[1.25rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            {searchQuery.trim() ? "No listings match this search yet." : "No listings yet."}
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {filteredRecentListings.map((listing) => (
              <div key={`${listing.kind}-${listing.id}`} className="flex items-center gap-3 rounded-[1.2rem] border border-slate-200 bg-slate-50 px-3.5 py-3">
                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${listing.kind === "service" ? "bg-indigo-50 text-indigo-600" : "bg-cyan-50 text-cyan-600"}`}>
                  {listing.kind === "service" ? <BriefcaseBusiness className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{listing.title}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {listing.kind}
                    </span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                      {listing.statusLabel}
                    </span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                      {formatRelativeDate(listing.createdAt)}
                    </span>
                  </div>
                </div>
                <p className="shrink-0 text-sm font-semibold text-slate-900">{listing.priceLabel}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Pipeline</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">Recent orders</h2>
          </div>
          <Link href="/dashboard/provider/orders" className="text-sm font-semibold text-[var(--brand-700)] hover:underline">
            View pipeline
          </Link>
        </div>

        {loading ? (
          <div className="mt-5 flex min-h-[220px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="mt-4 rounded-[1.25rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            {searchQuery.trim() ? "No orders match this search yet." : "No orders yet."}
          </div>
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {filteredOrders.slice(0, 6).map((order) => {
              const status = normalizeOrderStatus(order.status);
              const title =
                typeof order.metadata?.title === "string" && order.metadata.title.trim()
                  ? order.metadata.title.trim()
                  : `${order.listing_type} order`;

              return (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3.5 transition hover:border-[var(--brand-500)]/35 hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {order.listing_type} / {formatRelativeDate(order.created_at)}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${getOrderStatusPillClass(status)}`}>
                      {getOrderStatusLabel(status)}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Order value</p>
                    <p className="text-sm font-semibold text-slate-950">{order.price ? INR(order.price) : "Price TBD"}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
