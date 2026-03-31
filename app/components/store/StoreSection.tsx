"use client";

import { useState } from "react";
import { Briefcase, Package, ShoppingCart, ShoppingBag, Zap } from "lucide-react";
import { useCart } from "./CartContext";

type ServiceRow = {
  id: string;
  title: string | null;
  category: string | null;
  price: number | null;
  availability: string | null;
};

type ProductRow = {
  id: string;
  title: string | null;
  category: string | null;
  price: number | null;
  stock: number | null;
};

type Props = {
  services: ServiceRow[];
  products: ProductRow[];
  providerId: string;
  providerName: string;
  providerAvailability: string;
};

type Tab = "services" | "products";

const formatPrice = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

function AvailabilityBadge({ status }: { status: string }) {
  const norm = status.toLowerCase();
  if (norm === "busy")
    return (
      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-300">Busy</span>
    );
  if (norm === "offline" || norm === "unavailable")
    return (
      <span className="rounded-full bg-slate-600/30 px-2 py-0.5 text-[11px] font-semibold text-slate-400">Offline</span>
    );
  return (
    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">Available</span>
  );
}

export function StoreSection({ services, products, providerId, providerName, providerAvailability }: Props) {
  const cart = useCart();
  const [tab, setTab] = useState<Tab>(services.length > 0 ? "services" : "products");
  const [added, setAdded] = useState<string | null>(null);

  const isOffline =
    providerAvailability.toLowerCase() === "offline" ||
    providerAvailability.toLowerCase() === "unavailable";

  if (services.length === 0 && products.length === 0) return null;

  const handleAddToCart = (key: string, itemType: "service" | "product", itemId: string, title: string, price: number) => {
    cart.addItem({ itemType, itemId, providerId, providerName, title, price });
    setAdded(key);
    setTimeout(() => setAdded(null), 1400);
  };

  const handleBuyNow = (itemType: "service" | "product", itemId: string, title: string, price: number) => {
    cart.addItem({ itemType, itemId, providerId, providerName, title, price });
    cart.openCart();
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Store</h2>
          <AvailabilityBadge status={providerAvailability} />
        </div>

        {/* Tabs */}
        {services.length > 0 && products.length > 0 && (
          <div className="flex rounded-xl border border-slate-700 bg-slate-950 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setTab("services")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                tab === "services"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Briefcase className="h-3.5 w-3.5" />
              Services ({services.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("products")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                tab === "products"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Package className="h-3.5 w-3.5" />
              Products ({products.length})
            </button>
          </div>
        )}
      </div>

      {isOffline && (
        <p className="mt-3 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-400">
          This provider is currently offline. You can still add items to your cart and place an order when they are back online.
        </p>
      )}

      {/* Services Grid */}
      {(tab === "services" || products.length === 0) && services.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {services.map((svc) => {
            const price = Number(svc.price || 0);
            const isSvcOffline =
              isOffline || svc.availability?.toLowerCase() === "offline" || svc.availability?.toLowerCase() === "unavailable";
            const key = `service:${svc.id}`;
            const justAdded = added === key;

            return (
              <div
                key={svc.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold leading-snug text-white">{svc.title || "Untitled Service"}</p>
                    <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{svc.category || "Service"}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="font-semibold text-indigo-300">{formatPrice(price)}</span>
                    {isSvcOffline && <span className="text-[11px] text-slate-500">Unavailable</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isSvcOffline}
                    onClick={() => handleAddToCart(key, "service", svc.id, svc.title || "Service", price)}
                    aria-label={`Add ${svc.title} to cart`}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-indigo-500 hover:text-white disabled:pointer-events-none disabled:opacity-50"
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    {justAdded ? "Added!" : "Add to Cart"}
                  </button>
                  <button
                    type="button"
                    disabled={isSvcOffline}
                    onClick={() => handleBuyNow("service", svc.id, svc.title || "Service", price)}
                    aria-label={`Hire ${svc.title}`}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:pointer-events-none disabled:opacity-50"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Hire Now
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Products Grid */}
      {(tab === "products" || services.length === 0) && products.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {products.map((prod) => {
            const price = Number(prod.price || 0);
            const outOfStock = (prod.stock ?? 0) <= 0;
            const isDisabled = isOffline || outOfStock;
            const key = `product:${prod.id}`;
            const justAdded = added === key;

            return (
              <div
                key={prod.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold leading-snug text-white">{prod.title || "Untitled Product"}</p>
                    <Package className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{prod.category || "Product"}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="font-semibold text-indigo-300">{formatPrice(price)}</span>
                    {outOfStock ? (
                      <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-400">
                        Out of stock
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                        In stock
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleAddToCart(key, "product", prod.id, prod.title || "Product", price)}
                    aria-label={`Add ${prod.title} to cart`}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-indigo-500 hover:text-white disabled:pointer-events-none disabled:opacity-50"
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    {justAdded ? "Added!" : "Add to Cart"}
                  </button>
                  <button
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleBuyNow("product", prod.id, prod.title || "Product", price)}
                    aria-label={`Buy ${prod.title}`}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:pointer-events-none disabled:opacity-50"
                  >
                    <ShoppingBag className="h-3.5 w-3.5" />
                    Buy Now
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
