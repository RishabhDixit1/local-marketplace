"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Package,
  Pencil,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  Zap,
} from "lucide-react";
import { useCart } from "./CartContext";
import { supabase } from "@/lib/supabase";
import { deleteProviderListing, updateProviderListing } from "@/lib/provider/client";
import { resolveListingImageUrl } from "@/lib/provider/listings";
import type { ProductDeliveryMethod, ServicePricingType } from "@/lib/provider/listings";

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
  image_url?: string | null;
  image_path?: string | null;
};

type Props = {
  services: ServiceRow[];
  products: ProductRow[];
  providerId: string;
  providerName: string;
  providerAvailability: string;
};

type Tab = "services" | "products";

type ToastState = {
  kind: "success" | "error";
  message: string;
} | null;

const formatPrice = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

function AvailabilityBadge({ status }: { status: string }) {
  const norm = status.toLowerCase();
  if (norm === "busy") {
    return <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-300">Busy</span>;
  }
  if (norm === "offline" || norm === "unavailable") {
    return <span className="rounded-full bg-slate-600/30 px-2 py-0.5 text-[11px] font-semibold text-slate-400">Offline</span>;
  }
  return <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">Available</span>;
}

export function StoreSection({ services, products, providerId, providerName, providerAvailability }: Props) {
  const cart = useCart();
  const [tab, setTab] = useState<Tab>(services.length > 0 ? "services" : "products");
  const [added, setAdded] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [localServices, setLocalServices] = useState<ServiceRow[]>(services);
  const [localProducts, setLocalProducts] = useState<ProductRow[]>(products);

  const [deleteTarget, setDeleteTarget] = useState<
    | {
        type: "service" | "product";
        id: string;
        title: string;
      }
    | null
  >(null);

  const [editService, setEditService] = useState<
    | {
        id: string;
        title: string;
        category: string;
        description: string;
        price: number;
        availability: "available" | "busy" | "offline";
        pricingType: ServicePricingType;
      }
    | null
  >(null);

  const [editProduct, setEditProduct] = useState<
    | {
        id: string;
        title: string;
        category: string;
        description: string;
        price: number;
        stock: number;
        deliveryMethod: ProductDeliveryMethod;
        imageUrl: string;
      }
    | null
  >(null);

  const isOffline =
    providerAvailability.toLowerCase() === "offline" || providerAvailability.toLowerCase() === "unavailable";

  const isOwner = currentUserId === providerId;

  useEffect(() => {
    let active = true;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      setCurrentUserId(user?.id || null);
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setLocalServices(services);
  }, [services]);

  useEffect(() => {
    setLocalProducts(products);
  }, [products]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const totalItems = useMemo(() => localServices.length + localProducts.length, [localProducts.length, localServices.length]);

  if (totalItems === 0) return null;

  const handleAddToCart = (key: string, itemType: "service" | "product", itemId: string, title: string, price: number) => {
    cart.addItem({ itemType, itemId, providerId, providerName, title, price });
    setAdded(key);
    setTimeout(() => setAdded(null), 1400);
  };

  const handleBuyNow = (itemType: "service" | "product", itemId: string, title: string, price: number) => {
    cart.addItem({ itemType, itemId, providerId, providerName, title, price });
    cart.openCart();
  };

  const toggleServiceStock = async (service: ServiceRow) => {
    const nextAvailability = service.availability === "offline" ? "available" : "offline";
    setBusyId(service.id);
    try {
      await updateProviderListing({
        listingType: "service",
        listingId: service.id,
        values: {
          title: service.title || "Service",
          category: service.category || "Service",
          description: "",
          price: Number(service.price || 0),
          availability: nextAvailability,
          pricingType: "fixed",
        },
      });
      setLocalServices((current) =>
        current.map((row) => (row.id === service.id ? { ...row, availability: nextAvailability } : row))
      );
      setToast({ kind: "success", message: `Service marked ${nextAvailability === "offline" ? "offline" : "in stock"}.` });
    } catch (error) {
      setToast({ kind: "error", message: error instanceof Error ? error.message : "Could not update service status." });
    } finally {
      setBusyId(null);
    }
  };

  const toggleProductStock = async (product: ProductRow) => {
    const nextStock = (product.stock || 0) > 0 ? 0 : 1;
    setBusyId(product.id);
    try {
      await updateProviderListing({
        listingType: "product",
        listingId: product.id,
        values: {
          title: product.title || "Product",
          category: product.category || "Product",
          description: "",
          price: Number(product.price || 0),
          stock: nextStock,
          deliveryMethod: "pickup",
          imageUrl: product.image_path || product.image_url || "",
        },
      });
      setLocalProducts((current) => current.map((row) => (row.id === product.id ? { ...row, stock: nextStock } : row)));
      setToast({ kind: "success", message: nextStock > 0 ? "Product marked in stock." : "Product marked out of stock." });
    } catch (error) {
      setToast({ kind: "error", message: error instanceof Error ? error.message : "Could not update product stock." });
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await deleteProviderListing({ listingType: deleteTarget.type, listingId: deleteTarget.id });
      if (deleteTarget.type === "service") {
        setLocalServices((current) => current.filter((item) => item.id !== deleteTarget.id));
      } else {
        setLocalProducts((current) => current.filter((item) => item.id !== deleteTarget.id));
      }
      setToast({ kind: "success", message: "Listing deleted." });
      setDeleteTarget(null);
    } catch (error) {
      setToast({ kind: "error", message: error instanceof Error ? error.message : "Unable to delete listing." });
    } finally {
      setBusyId(null);
    }
  };

  const saveServiceEdit = async () => {
    if (!editService) return;
    setBusyId(editService.id);
    try {
      await updateProviderListing({
        listingType: "service",
        listingId: editService.id,
        values: {
          title: editService.title,
          category: editService.category,
          description: editService.description,
          price: Number(editService.price),
          availability: editService.availability,
          pricingType: editService.pricingType,
        },
      });
      setLocalServices((current) =>
        current.map((item) =>
          item.id === editService.id
            ? {
                ...item,
                title: editService.title,
                category: editService.category,
                price: Number(editService.price),
                availability: editService.availability,
              }
            : item
        )
      );
      setToast({ kind: "success", message: "Service updated." });
      setEditService(null);
    } catch (error) {
      setToast({ kind: "error", message: error instanceof Error ? error.message : "Unable to update service." });
    } finally {
      setBusyId(null);
    }
  };

  const saveProductEdit = async () => {
    if (!editProduct) return;
    setBusyId(editProduct.id);
    try {
      await updateProviderListing({
        listingType: "product",
        listingId: editProduct.id,
        values: {
          title: editProduct.title,
          category: editProduct.category,
          description: editProduct.description,
          price: Number(editProduct.price),
          stock: Number(editProduct.stock),
          deliveryMethod: editProduct.deliveryMethod,
          imageUrl: editProduct.imageUrl,
        },
      });
      setLocalProducts((current) =>
        current.map((item) =>
          item.id === editProduct.id
            ? {
                ...item,
                title: editProduct.title,
                category: editProduct.category,
                price: Number(editProduct.price),
                stock: Number(editProduct.stock),
                image_path: editProduct.imageUrl,
              image_url: null,
              }
            : item
        )
      );
      setToast({ kind: "success", message: "Product updated." });
      setEditProduct(null);
    } catch (error) {
      setToast({ kind: "error", message: error instanceof Error ? error.message : "Unable to update product." });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Store</h2>
          <AvailabilityBadge status={providerAvailability} />
        </div>

        {localServices.length > 0 && localProducts.length > 0 && (
          <div className="flex rounded-xl border border-slate-700 bg-slate-950 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setTab("services")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                tab === "services" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Briefcase className="h-3.5 w-3.5" />
              Services ({localServices.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("products")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                tab === "products" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Package className="h-3.5 w-3.5" />
              Products ({localProducts.length})
            </button>
          </div>
        )}
      </div>

      {isOffline && !isOwner && (
        <p className="mt-3 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-400">
          This provider is currently offline. You can still add items to your cart and place an order when they are back online.
        </p>
      )}

      {(tab === "services" || localProducts.length === 0) && localServices.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {localServices.map((svc) => {
            const price = Number(svc.price || 0);
            const isSvcOffline =
              isOffline || svc.availability?.toLowerCase() === "offline" || svc.availability?.toLowerCase() === "unavailable";
            const key = `service:${svc.id}`;
            const justAdded = added === key;

            return (
              <div key={svc.id} className="flex flex-col justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
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
                  {isOwner ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setEditService({
                            id: svc.id,
                            title: svc.title || "",
                            category: svc.category || "",
                            description: "",
                            price,
                            availability: (svc.availability as "available" | "busy" | "offline") || "available",
                            pricingType: "fixed",
                          })
                        }
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs font-semibold text-slate-200 transition hover:border-indigo-500"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        disabled={busyId === svc.id}
                        onClick={() => void toggleServiceStock(svc)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-2 py-2 text-xs font-semibold text-white transition hover:bg-amber-500 disabled:opacity-60"
                      >
                        {svc.availability === "offline" ? "In Stock" : "Out of Stock"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ type: "service", id: svc.id, title: svc.title || "Service" })}
                        className="inline-flex items-center justify-center rounded-lg border border-rose-600 px-2 py-2 text-rose-300 transition hover:bg-rose-600/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(tab === "products" || localServices.length === 0) && localProducts.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {localProducts.map((prod) => {
            const price = Number(prod.price || 0);
            const outOfStock = (prod.stock ?? 0) <= 0;
            const isDisabled = isOffline || outOfStock;
            const key = `product:${prod.id}`;
            const justAdded = added === key;
            const imageUrl = resolveListingImageUrl(prod.image_path || prod.image_url);

            return (
              <div key={prod.id} className="flex flex-col justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
                <div>
                  {imageUrl ? (
                    <div className="mb-3 h-28 overflow-hidden rounded-lg border border-slate-800">
                      <img src={imageUrl} alt={prod.title || "Product image"} className="h-full w-full object-cover" />
                    </div>
                  ) : null}
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold leading-snug text-white">{prod.title || "Untitled Product"}</p>
                    <Package className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{prod.category || "Product"}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="font-semibold text-indigo-300">{formatPrice(price)}</span>
                    {outOfStock ? (
                      <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-400">Out of stock</span>
                    ) : (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">In stock</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {isOwner ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setEditProduct({
                            id: prod.id,
                            title: prod.title || "",
                            category: prod.category || "",
                            description: "",
                            price,
                            stock: Number(prod.stock || 0),
                            deliveryMethod: "pickup",
                            imageUrl: prod.image_path || prod.image_url || "",
                          })
                        }
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs font-semibold text-slate-200 transition hover:border-indigo-500"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        disabled={busyId === prod.id}
                        onClick={() => void toggleProductStock(prod)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-2 py-2 text-xs font-semibold text-white transition hover:bg-amber-500 disabled:opacity-60"
                      >
                        {outOfStock ? "In Stock" : "Out of Stock"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ type: "product", id: prod.id, title: prod.title || "Product" })}
                        className="inline-flex items-center justify-center rounded-lg border border-rose-600 px-2 py-2 text-rose-300 transition hover:bg-rose-600/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {deleteTarget ? (
        <div className="fixed inset-0 z-[1450] grid place-items-center bg-slate-950/55 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl">
            <h3 className="text-base font-semibold">Delete listing?</h3>
            <p className="mt-2 text-sm text-slate-600">{deleteTarget.title} will be removed from your store.</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={busyId === deleteTarget.id}
                className="flex-1 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editService ? (
        <div className="fixed inset-0 z-[1450] grid place-items-center bg-slate-950/55 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl">
            <h3 className="text-base font-semibold">Edit service</h3>
            <div className="mt-3 grid gap-2">
              <input
                value={editService.title}
                onChange={(event) => setEditService({ ...editService, title: event.target.value })}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Title"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={editService.price}
                  onChange={(event) => setEditService({ ...editService, price: Number(event.target.value) })}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Price"
                />
                <select
                  value={editService.availability}
                  onChange={(event) =>
                    setEditService({
                      ...editService,
                      availability: event.target.value as "available" | "busy" | "offline",
                    })
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="available">available</option>
                  <option value="busy">busy</option>
                  <option value="offline">offline</option>
                </select>
              </div>
              <input
                value={editService.category}
                onChange={(event) => setEditService({ ...editService, category: event.target.value })}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Category"
              />
              <textarea
                value={editService.description}
                onChange={(event) => setEditService({ ...editService, description: event.target.value })}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Description"
                rows={4}
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setEditService(null)}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveServiceEdit()}
                disabled={busyId === editService.id}
                className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editProduct ? (
        <div className="fixed inset-0 z-[1450] grid place-items-center bg-slate-950/55 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl">
            <h3 className="text-base font-semibold">Edit product</h3>
            <div className="mt-3 grid gap-2">
              <input
                value={editProduct.title}
                onChange={(event) => setEditProduct({ ...editProduct, title: event.target.value })}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Title"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={editProduct.price}
                  onChange={(event) => setEditProduct({ ...editProduct, price: Number(event.target.value) })}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Price"
                />
                <input
                  type="number"
                  value={editProduct.stock}
                  onChange={(event) => setEditProduct({ ...editProduct, stock: Number(event.target.value) })}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Stock"
                />
              </div>
              <input
                value={editProduct.category}
                onChange={(event) => setEditProduct({ ...editProduct, category: event.target.value })}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Category"
              />
              <textarea
                value={editProduct.description}
                onChange={(event) => setEditProduct({ ...editProduct, description: event.target.value })}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Description"
                rows={3}
              />
              <input
                value={editProduct.imageUrl}
                onChange={(event) => setEditProduct({ ...editProduct, imageUrl: event.target.value })}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="listing-images path"
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setEditProduct(null)}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveProductEdit()}
                disabled={busyId === editProduct.id}
                className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-4 left-1/2 z-[1500] -translate-x-1/2 px-4">
          <div
            className={`rounded-full px-4 py-2 text-xs font-semibold shadow-lg ${
              toast.kind === "success" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
            }`}
          >
            {toast.message}
          </div>
        </div>
      ) : null}
    </section>
  );
}
