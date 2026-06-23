"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  fetchProviderListings,
  createProviderListing,
  updateProviderListing,
  deleteProviderListing,
} from "@/lib/provider/client";
import type {
  ProviderServiceListing,
  ProviderProductListing,
  ProviderServiceDraft,
  ProviderProductDraft,
  ProviderListingsStats,
  ServicePricingType,
  ProductDeliveryMethod,
} from "@/lib/provider/listings";
import { PROVIDER_SERVICE_CATEGORIES, SERVICE_PRICING_TYPES, PRODUCT_DELIVERY_METHODS } from "@/lib/provider/listings";
import type { ProfileAvailability } from "@/lib/profile/types";

const INITIAL_SERVICE_DRAFT: ProviderServiceDraft = {
  title: "",
  description: "",
  category: "",
  price: 0,
  availability: "available",
  pricingType: "fixed",
};

const INITIAL_PRODUCT_DRAFT: ProviderProductDraft = {
  title: "",
  description: "",
  category: "",
  price: 0,
  stock: 0,
  deliveryMethod: "pickup",
  imageUrl: "",
};

export default function ListingsPage() {
  const [listings, setListings] = useState<{
    services: ProviderServiceListing[];
    products: ProviderProductListing[];
    stats: ProviderListingsStats;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"services" | "products">("services");

  const [modalMode, setModalMode] = useState<"closed" | "create" | "edit">("closed");
  const [modalType, setModalType] = useState<"service" | "product">("service");
  const [editId, setEditId] = useState<string | null>(null);
  const [serviceDraft, setServiceDraft] = useState<ProviderServiceDraft>(INITIAL_SERVICE_DRAFT);
  const [productDraft, setProductDraft] = useState<ProviderProductDraft>(INITIAL_PRODUCT_DRAFT);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchProviderListings();
      setListings({ services: payload.services, products: payload.products, stats: payload.stats });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load listings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openCreate = (type: "service" | "product") => {
    setModalType(type);
    setServiceDraft(INITIAL_SERVICE_DRAFT);
    setProductDraft(INITIAL_PRODUCT_DRAFT);
    setEditId(null);
    setActionError(null);
    setModalMode("create");
  };

  const openEdit = (type: "service" | "product", id: string) => {
    if (!listings) return;
    setModalType(type);
    setEditId(id);
    setActionError(null);
    if (type === "service") {
      const item = listings.services.find((s) => s.id === id);
      if (item) setServiceDraft({ ...item });
    } else {
      const item = listings.products.find((p) => p.id === id);
      if (item) setProductDraft({ ...item });
    }
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode("closed");
    setActionError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setActionError(null);
    try {
      if (modalMode === "create") {
        const request = modalType === "service"
          ? { listingType: "service" as const, values: serviceDraft }
          : { listingType: "product" as const, values: productDraft };
        await createProviderListing(request);
      } else if (editId) {
        const request = modalType === "service"
          ? { listingType: "service" as const, listingId: editId, values: serviceDraft }
          : { listingType: "product" as const, listingId: editId, values: productDraft };
        await updateProviderListing(request);
      }
      closeModal();
      void load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (type: "service" | "product", id: string) => {
    setDeleting(true);
    try {
      await deleteProviderListing({ listingType: type, listingId: id });
      setDeleteConfirm(null);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusToggle = async (type: "service" | "product", id: string, current: string) => {
    const next: ProfileAvailability = current === "available" ? "offline" : "available";
    try {
      if (type === "service") {
        const item = listings?.services.find((s) => s.id === id);
        if (!item) return;
        await updateProviderListing({ listingType: "service", listingId: id, values: { ...item, availability: next } });
      } else {
        const item = listings?.products.find((p) => p.id === id);
        if (!item) return;
        await updateProviderListing({ listingType: "product", listingId: id, values: { ...item, stock: next === "available" ? 1 : 0 } });
      }
      void load();
    } catch {
      // silently fail — will retry on next load
    }
  };

  const items = useMemo(() => {
    if (!listings) return [];
    return tab === "services" ? listings.services : listings.products;
  }, [listings, tab]);

  if (loading && !listings) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error && !listings) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-red-600">
        <AlertCircle className="h-8 w-8" />
        <p className="text-sm">{error}</p>
        <button type="button" onClick={() => void load()} className="text-sm font-semibold text-indigo-600 hover:underline">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Listings</h1>
          {listings?.stats && (
            <p className="mt-1 text-sm text-slate-500">
              {listings.stats.activeServices} active services, {listings.stats.activeProducts} active products
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => openCreate("service")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            New Service
          </button>
          <button
            type="button"
            onClick={() => openCreate("product")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Plus className="h-4 w-4" />
            New Product
          </button>
        </div>
      </div>

      <div className="mb-4 flex gap-4 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab("services")}
          className={`pb-2 text-sm font-semibold ${tab === "services" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-slate-500 hover:text-slate-700"}`}
        >
          Services ({listings?.stats.totalServices ?? 0})
        </button>
        <button
          type="button"
          onClick={() => setTab("products")}
          className={`pb-2 text-sm font-semibold ${tab === "products" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-slate-500 hover:text-slate-700"}`}
        >
          Products ({listings?.stats.totalProducts ?? 0})
        </button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 py-16 text-slate-400">
          <Plus className="h-10 w-10" />
          <p className="text-sm font-medium">No {tab} yet</p>
          <button
            type="button"
            onClick={() => openCreate(tab === "services" ? "service" : "product")}
            className="text-sm font-semibold text-indigo-600 hover:underline"
          >
            Create your first {tab === "services" ? "service" : "product"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const isService = tab === "services";
            const service = item as ProviderServiceListing;
            const product = item as ProviderProductListing;
            const status = isService ? service.availability : (product.stock > 0 ? "available" : "offline");
            return (
              <div key={item.id} className="relative flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-slate-900">{item.title}</h3>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        status === "available"
                          ? "bg-emerald-50 text-emerald-700"
                          : status === "busy"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {status}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                    <span>{item.category}</span>
                    <span>·</span>
                    <span>₹{item.price.toLocaleString("en-IN")}</span>
                    {isService && (
                      <>
                        <span>·</span>
                        <span className="capitalize">{(service as ProviderServiceListing).pricingType}</span>
                      </>
                    )}
                    {!isService && (
                      <>
                        <span>·</span>
                        <span>Stock: {(product as ProviderProductListing).stock}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleStatusToggle(tab === "services" ? "service" : "product", item.id, status)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                      status === "available"
                        ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                        : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    }`}
                  >
                    {status === "available" ? "Deactivate" : "Activate"}
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setMenuOpen(menuOpen === item.id ? null : item.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {menuOpen === item.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                        <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                          <button
                            type="button"
                            onClick={() => { setMenuOpen(null); openEdit(isService ? "service" : "product", item.id); }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          {deleteConfirm === item.id ? (
                            <div className="px-3 py-1.5">
                              <p className="mb-1 text-[11px] text-red-600">Delete?</p>
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => { void handleDelete(isService ? "service" : "product", item.id); }}
                                  disabled={deleting}
                                  className="rounded bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                                >
                                  {deleting ? "..." : "Yes"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirm(null)}
                                  className="rounded bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-300"
                                >
                                  No
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => { setMenuOpen(null); setDeleteConfirm(item.id); }}
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalMode !== "closed" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">
              {modalMode === "create" ? `New ${modalType === "service" ? "Service" : "Product"}` : "Edit Listing"}
            </h2>

            {actionError && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {actionError}
              </div>
            )}

            <div className="mt-4 space-y-4">
              {modalType === "service" ? (
                <>
                  <Field label="Title" value={serviceDraft.title} onChange={(v) => setServiceDraft((p) => ({ ...p, title: v }))} />
                  <Field label="Description" value={serviceDraft.description} onChange={(v) => setServiceDraft((p) => ({ ...p, description: v }))} multiline />
                  <SelectField label="Category" value={serviceDraft.category} options={PROVIDER_SERVICE_CATEGORIES} onChange={(v) => setServiceDraft((p) => ({ ...p, category: v }))} />
                  <Field label="Price (₹)" type="number" value={String(serviceDraft.price)} onChange={(v) => setServiceDraft((p) => ({ ...p, price: Number(v) }))} />
                  <SelectField label="Pricing Type" value={serviceDraft.pricingType} options={SERVICE_PRICING_TYPES} onChange={(v) => setServiceDraft((p) => ({ ...p, pricingType: v as ServicePricingType }))} />
                  <SelectField label="Availability" value={serviceDraft.availability} options={["available", "busy", "offline"]} onChange={(v) => setServiceDraft((p) => ({ ...p, availability: v as ProfileAvailability }))} />
                </>
              ) : (
                <>
                  <Field label="Title" value={productDraft.title} onChange={(v) => setProductDraft((p) => ({ ...p, title: v }))} />
                  <Field label="Description" value={productDraft.description} onChange={(v) => setProductDraft((p) => ({ ...p, description: v }))} multiline />
                  <SelectField label="Category" value={productDraft.category} options={PROVIDER_SERVICE_CATEGORIES} onChange={(v) => setProductDraft((p) => ({ ...p, category: v }))} />
                  <Field label="Price (₹)" type="number" value={String(productDraft.price)} onChange={(v) => setProductDraft((p) => ({ ...p, price: Number(v) }))} />
                  <Field label="Stock" type="number" value={String(productDraft.stock)} onChange={(v) => setProductDraft((p) => ({ ...p, stock: Number(v) }))} />
                  <SelectField label="Delivery Method" value={productDraft.deliveryMethod} options={PRODUCT_DELIVERY_METHODS} onChange={(v) => setProductDraft((p) => ({ ...p, deliveryMethod: v as ProductDeliveryMethod }))} />
                  <Field label="Image URL" value={productDraft.imageUrl} onChange={(v) => setProductDraft((p) => ({ ...p, imageUrl: v }))} />
                </>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {modalMode === "create" ? "Create" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", multiline }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  multiline?: boolean;
}) {
  const cls = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-700">{label}</label>
      {multiline ? (
        <textarea className={cls} rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className={cls} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function SelectField({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-700">{label}</label>
      <div className="relative">
        <select
          className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2 pr-8 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select...</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  );
}
