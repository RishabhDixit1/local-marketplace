"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  ImagePlus,
  Loader2,
  MoreVertical,
  Package,
  Pencil,
  PauseCircle,
  PlayCircle,
  Plus,
  Save,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import ProviderControlNav from "@/app/components/provider/ProviderControlNav";
import { deleteProviderListing, fetchProviderListings, updateProviderListing } from "@/lib/provider/client";
import { supabase } from "@/lib/supabase";
import type { ProfileAvailability } from "@/lib/profile/types";
import { compressImageFile } from "@/lib/clientImageCompression";
import { LISTING_IMAGE_MAX_BYTES, STORAGE_CACHE_SECONDS, formatUploadLimit } from "@/lib/mediaLimits";
import type {
  ProductDeliveryMethod,
  ProviderProductListing,
  ProviderServiceListing,
  ServicePricingType,
} from "@/lib/provider/listings";
import {
  formatServicePriceLabel,
  formatServicePricingTypeLabel,
  resolveListingImageUrl,
  SERVICE_PRICING_TYPES,
} from "@/lib/provider/listings";

type EditingService = {
  id: string;
  title: string;
  price: number;
  category: string;
  description: string;
  availability: ProfileAvailability;
  pricingType: ServicePricingType;
};

type EditingProduct = {
  id: string;
  title: string;
  price: number;
  category: string;
  description: string;
  stock: number;
  deliveryMethod: ProductDeliveryMethod;
  imageUrl: string;
};

const INPUT = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[var(--brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-400)]/25";
const SELECT = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[var(--brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-400)]/25";
const PRICING_OPTIONS = SERVICE_PRICING_TYPES.map((value) => ({
  value,
  label: formatServicePricingTypeLabel(value),
}));

// ── Slide-in Edit Sheet ────────────────────────────────────────────────────────
function EditSheet({ title, onClose, children, footer }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[2000] bg-slate-950/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 340, damping: 32 }}
        className="fixed inset-y-0 right-0 z-[2001] flex w-full max-w-md flex-col bg-white shadow-2xl"
        role="dialog"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">{children}</div>
        <div className="border-t border-slate-100 p-5">{footer}</div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── 3-dot Listing Menu ────────────────────────────────────────────────────────
function ListingMenu({ onEdit, onToggle, onDelete, paused, busy }: {
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  paused: boolean;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        disabled={busy}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
        aria-label="Listing options"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <MoreVertical size={14} />}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-2xl">
          <button
            type="button"
            onClick={() => { setOpen(false); onEdit(); }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Pencil size={13} className="text-slate-400" /> Edit
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); onToggle(); }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {paused
              ? <><PlayCircle size={13} className="text-emerald-500" /> Resume</>
              : <><PauseCircle size={13} className="text-amber-500" /> Pause</>
            }
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button
            type="button"
            onClick={() => { setOpen(false); onDelete(); }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default function ListingsPage() {
  const router = useRouter();
  const [providerId, setProviderId] = useState<string | null>(null);
  const [services, setServices] = useState<ProviderServiceListing[]>([]);
  const [products, setProducts] = useState<ProviderProductListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [compatibilityNotice, setCompatibilityNotice] = useState("");
  const [editingService, setEditingService] = useState<EditingService | null>(null);
  const [editingProduct, setEditingProduct] = useState<EditingProduct | null>(null);
  const [activeTab, setActiveTab] = useState<"services" | "products">("services");

  const activeServices = useMemo(
    () => services.filter((service) => service.availability !== "offline").length,
    [services]
  );
  const activeProducts = useMemo(() => products.filter((product) => product.stock > 0).length, [products]);

  const loadListings = useCallback(async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const payload = await fetchProviderListings();
      setServices(payload.services);
      setProducts(payload.products);
      setErrorMessage("");
      setCompatibilityNotice(
        payload.compatibilityMode
          ? "Some optional listing fields were skipped to match your current schema."
          : ""
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load listings.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) { setProviderId(null); setLoading(false); return; }
      setProviderId(user.id);
      await loadListings();
    };
    void init();
    return () => { active = false; };
  }, [loadListings]);

  useEffect(() => {
    if (!providerId) return;
    let refreshTimerId: number | null = null;
    const queueRefresh = () => {
      if (refreshTimerId) window.clearTimeout(refreshTimerId);
      refreshTimerId = window.setTimeout(() => void loadListings({ silent: true }), 180);
    };
    const channel = supabase
      .channel(`provider-listings-live-${providerId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "service_listings", filter: `provider_id=eq.${providerId}` }, queueRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "product_catalog", filter: `provider_id=eq.${providerId}` }, queueRefresh)
      .subscribe();
    return () => {
      if (refreshTimerId) window.clearTimeout(refreshTimerId);
      void supabase.removeChannel(channel);
    };
  }, [loadListings, providerId]);

  const removeService = async (id: string) => {
    if (!window.confirm("Delete this service listing?")) return;
    setBusyId(id);
    try {
      await deleteProviderListing({ listingType: "service", listingId: id });
      await loadListings({ silent: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete service listing.");
    } finally { setBusyId(null); }
  };

  const removeProduct = async (id: string) => {
    if (!window.confirm("Delete this product listing?")) return;
    setBusyId(id);
    try {
      await deleteProviderListing({ listingType: "product", listingId: id });
      await loadListings({ silent: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete product listing.");
    } finally { setBusyId(null); }
  };

  const toggleServicePaused = async (service: ProviderServiceListing) => {
    const nextAvailability: ProfileAvailability = service.availability === "offline" ? "available" : "offline";
    setBusyId(service.id);
    try {
      await updateProviderListing({
        listingType: "service", listingId: service.id,
        values: { title: service.title, price: service.price, category: service.category, description: service.description, availability: nextAvailability, pricingType: service.pricingType },
      });
      await loadListings({ silent: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update service availability.");
    } finally { setBusyId(null); }
  };

  const toggleProductPaused = async (product: ProviderProductListing) => {
    const nextStock = product.stock > 0 ? 0 : 1;
    setBusyId(product.id);
    try {
      await updateProviderListing({
        listingType: "product", listingId: product.id,
        values: { title: product.title, price: product.price, category: product.category, description: product.description, stock: nextStock, deliveryMethod: product.deliveryMethod, imageUrl: product.imageUrl },
      });
      await loadListings({ silent: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update product stock.");
    } finally { setBusyId(null); }
  };

  const saveServiceEdit = async () => {
    if (!editingService) return;
    setBusyId(editingService.id);
    try {
      await updateProviderListing({
        listingType: "service", listingId: editingService.id,
        values: { title: editingService.title, price: Number(editingService.price), category: editingService.category, description: editingService.description, availability: editingService.availability, pricingType: editingService.pricingType },
      });
      setEditingService(null);
      await loadListings({ silent: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save service edits.");
    } finally { setBusyId(null); }
  };

  const saveProductEdit = async () => {
    if (!editingProduct) return;
    setBusyId(editingProduct.id);
    try {
      await updateProviderListing({
        listingType: "product", listingId: editingProduct.id,
        values: { title: editingProduct.title, price: Number(editingProduct.price), category: editingProduct.category, description: editingProduct.description, stock: Number(editingProduct.stock), deliveryMethod: editingProduct.deliveryMethod, imageUrl: editingProduct.imageUrl },
      });
      setEditingProduct(null);
      await loadListings({ silent: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save product edits.");
    } finally { setBusyId(null); }
  };

  const uploadEditProductImage = async (file: File) => {
    if (!editingProduct || !providerId) return;
    setBusyId(editingProduct.id);
    try {
      const preparedImage = (await compressImageFile(file, { maxBytes: LISTING_IMAGE_MAX_BYTES })).file;
      if (preparedImage.size > LISTING_IMAGE_MAX_BYTES) {
        throw new Error(`Image must be ${formatUploadLimit(LISTING_IMAGE_MAX_BYTES)} or smaller after compression.`);
      }
      const ext = preparedImage.name.split(".").pop() || "jpg";
      const filePath = `${providerId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage
        .from("listing-images")
        .upload(filePath, preparedImage, { contentType: preparedImage.type || "image/jpeg", cacheControl: STORAGE_CACHE_SECONDS, upsert: false });
      if (error) throw new Error(error.message || "Unable to upload image.");
      setEditingProduct((current) => (current ? { ...current, imageUrl: filePath } : current));
    } catch (uploadError) {
      setErrorMessage(uploadError instanceof Error ? uploadError.message : "Unable to upload image.");
    } finally { setBusyId(null); }
  };

  if (!providerId && !loading) {
    return (
      <div className="w-full max-w-[1200px] mx-auto">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-700">
          Please log in to manage listings.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1240px] space-y-4">
      <ProviderControlNav />

      {/* ── Edit Service Sheet ─────────────────────────────────────── */}
      {editingService && (
        <EditSheet
          title="Edit Service"
          onClose={() => setEditingService(null)}
          footer={
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void saveServiceEdit()}
                disabled={busyId === editingService.id}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--brand-900)] py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)] disabled:opacity-60"
              >
                {busyId === editingService.id ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                Save service
              </button>
              <button type="button" onClick={() => setEditingService(null)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cancel</button>
            </div>
          }
        >
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Title</label>
            <input value={editingService.title} onChange={(e) => setEditingService({ ...editingService, title: e.target.value })} className={INPUT} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Price (₹)</label>
              <input type="number" value={editingService.price} onChange={(e) => setEditingService({ ...editingService, price: Number(e.target.value) })} className={INPUT} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Category</label>
              <input value={editingService.category} onChange={(e) => setEditingService({ ...editingService, category: e.target.value })} className={INPUT} />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Description</label>
            <textarea rows={4} value={editingService.description} onChange={(e) => setEditingService({ ...editingService, description: e.target.value })} className={INPUT} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Availability</label>
              <select value={editingService.availability} onChange={(e) => setEditingService({ ...editingService, availability: e.target.value as ProfileAvailability })} className={SELECT}>
                <option value="available">Available</option>
                <option value="busy">Busy</option>
                <option value="offline">Offline (paused)</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Pricing</label>
              <select value={editingService.pricingType} onChange={(e) => setEditingService({ ...editingService, pricingType: e.target.value as ServicePricingType })} className={SELECT}>
                {PRICING_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </EditSheet>
      )}

      {/* ── Edit Product Sheet ─────────────────────────────────────── */}
      {editingProduct && (
        <EditSheet
          title="Edit Product"
          onClose={() => setEditingProduct(null)}
          footer={
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void saveProductEdit()}
                disabled={busyId === editingProduct.id}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--brand-900)] py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)] disabled:opacity-60"
              >
                {busyId === editingProduct.id ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                Save product
              </button>
              <button type="button" onClick={() => setEditingProduct(null)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cancel</button>
            </div>
          }
        >
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Title</label>
            <input value={editingProduct.title} onChange={(e) => setEditingProduct({ ...editingProduct, title: e.target.value })} className={INPUT} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Price (₹)</label>
              <input type="number" value={editingProduct.price} onChange={(e) => setEditingProduct({ ...editingProduct, price: Number(e.target.value) })} className={INPUT} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Stock</label>
              <input type="number" min={0} value={editingProduct.stock} onChange={(e) => setEditingProduct({ ...editingProduct, stock: Number(e.target.value) })} className={INPUT} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Category</label>
              <input value={editingProduct.category} onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })} className={INPUT} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Delivery</label>
              <select value={editingProduct.deliveryMethod} onChange={(e) => setEditingProduct({ ...editingProduct, deliveryMethod: e.target.value as ProductDeliveryMethod })} className={SELECT}>
                <option value="pickup">Pickup only</option>
                <option value="delivery">Delivery only</option>
                <option value="both">Pickup & Delivery</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Description</label>
            <textarea rows={3} value={editingProduct.description} onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })} className={INPUT} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Product image</label>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border-2 border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500 transition hover:border-[var(--brand-500)]/40 hover:text-slate-700">
              <ImagePlus size={16} className="shrink-0 text-slate-400" />
              <span>Click to upload image</span>
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadEditProductImage(f); }} />
            </label>
            {resolveListingImageUrl(editingProduct.imageUrl) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolveListingImageUrl(editingProduct.imageUrl) || ""} alt="Product preview" className="mt-2 h-20 w-20 rounded-xl border border-slate-200 object-cover" />
            )}
          </div>
        </EditSheet>
      )}

      {/* ── Empty state onboarding ─────────────────────────────────── */}
      {!loading && services.length + products.length === 0 && (
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Store setup</h2>
          <p className="mt-1 text-sm text-slate-500">Finish the basics to go live.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <button onClick={() => router.push("/dashboard/profile")} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:border-[var(--brand-500)]/35 hover:bg-white">
              <div><p className="text-sm font-semibold text-slate-900">Profile</p><p className="mt-0.5 text-[11px] text-slate-500">Trust</p></div>
              <ChevronRight size={14} className="shrink-0 text-slate-400" />
            </button>
            <button onClick={() => router.push("/dashboard/provider/add-service")} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:border-[var(--brand-500)]/35 hover:bg-white">
              <div><p className="text-sm font-semibold text-slate-900">Service</p><p className="mt-0.5 text-[11px] text-slate-500">Offer</p></div>
              <ChevronRight size={14} className="shrink-0 text-slate-400" />
            </button>
            <button onClick={() => router.push("/dashboard/provider/add-product")} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:border-[var(--brand-500)]/35 hover:bg-white">
              <div><p className="text-sm font-semibold text-slate-900">Product</p><p className="mt-0.5 text-[11px] text-slate-500">Catalog</p></div>
              <ChevronRight size={14} className="shrink-0 text-slate-400" />
            </button>
          </div>
        </div>
      )}

      {/* ── Page header ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Listings</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {services.length} service{services.length !== 1 ? "s" : ""} · {products.length} product{products.length !== 1 ? "s" : ""}
            {refreshing ? " · syncing…" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push("/dashboard/provider/add-service")} className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-[var(--brand-500)]/40 hover:text-[var(--brand-700)]">
            <Plus size={15} /><Wrench size={14} /> <span className="hidden md:inline">Service</span>
          </button>
          <button onClick={() => router.push("/dashboard/provider/add-product")} className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--brand-900)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]">
            <Plus size={15} /><Package size={14} /> <span className="hidden md:inline">Product</span>
          </button>
        </div>
      </div>

      {/* ── Stats row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Total Services", value: services.length, color: "text-indigo-600" },
          { label: "Active Services", value: activeServices, color: "text-emerald-600" },
          { label: "Total Products", value: products.length, color: "text-violet-600" },
          { label: "In Stock", value: activeProducts, color: "text-cyan-600" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-[1.25rem] border border-slate-200 bg-white px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{stat.label}</p>
            <p className={`mt-1 text-xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {(compatibilityNotice || errorMessage) && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${errorMessage ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
          {errorMessage || compatibilityNotice}
        </div>
      )}

      {/* ── Tab switcher ──────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
        {(["services", "products"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex h-9 flex-1 items-center justify-center gap-2 rounded-lg px-2 text-sm font-semibold transition-all ${
              activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab === "services" ? <Wrench size={14} /> : <Package size={14} />}
            {tab === "services" ? "Services" : "Products"}
            <span className={`inline-flex min-w-[1.4rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              activeTab === tab ? "bg-[var(--brand-900)] text-white" : "bg-slate-200 text-slate-600"
            }`}>
              {tab === "services" ? services.length : products.length}
            </span>
          </button>
        ))}
      </div>

      {/* ── Services list ─────────────────────────────────────────── */}
      {activeTab === "services" && (
        loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2].map((key) => (
              <div key={key} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-100" />
                  <div className="flex-1 space-y-2"><div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" /><div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" /></div>
                </div>
              </div>
            ))}
          </div>
        ) : services.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-6 text-center">
            <Wrench className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">No services yet</p>
            <p className="mt-1 text-xs text-slate-500">Add a service to start getting booked by nearby customers.</p>
            <button onClick={() => router.push("/dashboard/provider/add-service")} className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[var(--brand-900)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]">
              <Plus size={14} /> Add your first service
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {services.map((service) => {
              const paused = service.availability === "offline";
              return (
                <motion.div
                  key={service.id}
                  layout
                  className={`group relative rounded-2xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${paused ? "border-amber-200 bg-amber-50/30" : "border-slate-200"}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                      <Wrench size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold text-slate-900">{service.title}</h3>
                          <p className="mt-0.5 text-xs text-slate-500">{service.category || "General"} - {formatServicePricingTypeLabel(service.pricingType)}</p>
                        </div>
                        <ListingMenu
                          paused={paused}
                          busy={busyId === service.id}
                          onEdit={() => setEditingService({ id: service.id, title: service.title, price: service.price, category: service.category || "", description: service.description || "", availability: service.availability, pricingType: service.pricingType })}
                          onToggle={() => void toggleServicePaused(service)}
                          onDelete={() => void removeService(service.id)}
                        />
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{service.description || "No description"}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-sm font-bold text-indigo-600">{formatServicePriceLabel(service.price, service.pricingType)}</p>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${paused ? "bg-amber-100 text-amber-700" : service.availability === "busy" ? "bg-orange-100 text-orange-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {paused ? "Paused" : service.availability === "busy" ? "Busy" : "Active"}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )
      )}

      {/* ── Products list ─────────────────────────────────────────── */}
      {activeTab === "products" && (
        loading ? null : products.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-6 text-center">
            <Package className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">No products yet</p>
            <p className="mt-1 text-xs text-slate-500">Add products to sell to nearby buyers.</p>
            <button onClick={() => router.push("/dashboard/provider/add-product")} className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[var(--brand-900)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]">
              <Plus size={14} /> Add your first product
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {products.map((product) => {
              const paused = product.stock <= 0;
              const imageUrl = resolveListingImageUrl(product.imageUrl);
              return (
                <motion.div
                  key={product.id}
                  layout
                  className={`rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md ${paused ? "border-amber-200 bg-amber-50/30" : "border-slate-200"}`}
                >
                  {imageUrl && (
                    <div className="relative h-28 w-full overflow-hidden rounded-t-2xl bg-slate-100">
                      <Image
                        src={imageUrl}
                        alt={product.title}
                        fill
                        sizes="(max-width: 640px) 92vw, 420px"
                        quality={72}
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-slate-900">{product.title}</h3>
                        <p className="mt-0.5 text-xs text-slate-500">{product.category || "General"} · {product.deliveryMethod}</p>
                      </div>
                      <ListingMenu
                        paused={paused}
                        busy={busyId === product.id}
                        onEdit={() => setEditingProduct({ id: product.id, title: product.title, price: product.price, category: product.category || "", description: product.description || "", stock: product.stock, deliveryMethod: product.deliveryMethod, imageUrl: product.imageUrl })}
                        onToggle={() => void toggleProductPaused(product)}
                        onDelete={() => void removeProduct(product.id)}
                      />
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{product.description || "No description"}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-sm font-bold text-emerald-600">₹{product.price.toLocaleString("en-IN")}</p>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${paused ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {paused ? "Out of stock" : `Stock: ${product.stock}`}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}


