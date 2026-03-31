"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCart } from "./CartContext";
import { supabase } from "@/lib/supabase";
import { fetchAuthedJson } from "@/lib/clientApi";

const formatPrice = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

export function CartDrawer() {
  const { items, totalItems, totalPrice, removeItem, updateQuantity, clearCart, isOpen, closeCart } = useCart();
  const router = useRouter();
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [orderSuccess, setOrderSuccess] = useState(false);

  const handleCheckout = useCallback(async () => {
    if (!items.length) return;
    setPlacingOrder(true);
    setOrderError("");
    setOrderSuccess(false);

    try {
      const response = await fetchAuthedJson<{ ok: boolean; count: number }>(supabase, "/api/orders", {
        method: "POST",
        body: JSON.stringify({
          items: items.map((item) => ({
            providerId: item.providerId,
            itemType: item.itemType,
            itemId: item.itemId,
            price: item.price * item.quantity,
            quantity: item.quantity,
            title: item.title,
          })),
        }),
      });

      if (!response.ok || response.count <= 0) {
        setOrderError("Unable to place orders right now. Please try again.");
        return;
      }

      clearCart();
      setOrderSuccess(true);
      setTimeout(() => {
        closeCart();
        setOrderSuccess(false);
        router.push("/dashboard/tasks");
      }, 1500);
    } catch (error) {
      setOrderError(error instanceof Error ? error.message : "Unable to place order right now.");
    } finally {
      setPlacingOrder(false);
    }
  }, [clearCart, closeCart, items, router]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1400] bg-slate-950/40 backdrop-blur-sm"
            onClick={closeCart}
            aria-hidden
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-[1401] flex w-full max-w-sm flex-col bg-white shadow-2xl"
            aria-label="Shopping cart"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-[var(--brand-700)]" />
                <h2 className="text-base font-semibold text-slate-900">
                  Cart
                  {totalItems > 0 && (
                    <span className="ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--brand-900)] px-1.5 text-[11px] font-bold text-white">
                      {totalItems}
                    </span>
                  )}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeCart}
                aria-label="Close cart"
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <ShoppingCart className="h-12 w-12 text-slate-200" />
                  <p className="text-sm font-semibold text-slate-700">Your cart is empty</p>
                  <p className="text-xs text-slate-400">Browse provider profiles to add services or products.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {items.map((item) => (
                    <li
                      key={item.key}
                      className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 leading-snug">{item.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500 capitalize">{item.itemType} · {item.providerName}</p>
                        <p className="mt-1 text-sm font-semibold text-[var(--brand-700)]">
                          {formatPrice(item.price * item.quantity)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <button
                          type="button"
                          onClick={() => removeItem(item.key)}
                          aria-label={`Remove ${item.title}`}
                          className="text-slate-400 transition hover:text-rose-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-1.5 py-0.5">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.key, item.quantity - 1)}
                            aria-label="Decrease quantity"
                            className="text-slate-500 transition hover:text-slate-900"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-[1.25rem] text-center text-xs font-semibold text-slate-900">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.key, item.quantity + 1)}
                            aria-label="Increase quantity"
                            className="text-slate-500 transition hover:text-slate-900"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="border-t border-slate-200 px-5 py-4 space-y-3">
                {orderError && (
                  <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {orderError}
                  </p>
                )}
                {orderSuccess && (
                  <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                    Orders placed! Redirecting to tasks…
                  </p>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Total</span>
                  <span className="font-bold text-slate-900 text-base">{formatPrice(totalPrice)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCheckout()}
                  disabled={placingOrder || orderSuccess}
                  className="w-full rounded-xl bg-[var(--brand-900)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)] disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {placingOrder && <Loader2 className="h-4 w-4 animate-spin" />}
                  {placingOrder ? "Placing orders…" : `Place Order · ${formatPrice(totalPrice)}`}
                </button>
                <button
                  type="button"
                  onClick={clearCart}
                  disabled={placingOrder}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-50"
                >
                  Clear cart
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
