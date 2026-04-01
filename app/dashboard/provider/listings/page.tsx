"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Package, Pencil, PauseCircle, PlayCircle, Trash2, Wrench } from "lucide-react";
import { deleteProviderListing, fetchProviderListings, updateProviderListing } from "@/lib/provider/client";
import { supabase } from "@/lib/supabase";
import type { ProfileAvailability } from "@/lib/profile/types";
import { resolveListingImageUrl } from "@/lib/provider/listings";
import type {
  ProductDeliveryMethod,
  ProviderProductListing,
  ProviderServiceListing,
  ServicePricingType,
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

  const activeServices = useMemo(
    () => services.filter((service) => service.availability !== "offline").length,
    [services]
  );

  const activeProducts = useMemo(() => products.filter((product) => product.stock > 0).length, [products]);

  const loadListings = useCallback(async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);

    if (!silent) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

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
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (!user) {
        setProviderId(null);
        setLoading(false);
        return;
      }

      setProviderId(user.id);
      await loadListings();
    };

    void init();

    return () => {
      active = false;
    };
  }, [loadListings]);

  useEffect(() => {
    if (!providerId) return;

    let refreshTimerId: number | null = null;
    const queueRefresh = () => {
      if (refreshTimerId) {
        window.clearTimeout(refreshTimerId);
      }

      refreshTimerId = window.setTimeout(() => {
        void loadListings({ silent: true });
      }, 180);
    };

    const channel = supabase
      .channel(`provider-listings-live-${providerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_listings", filter: `provider_id=eq.${providerId}` },
        queueRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_catalog", filter: `provider_id=eq.${providerId}` },
        queueRefresh
      )
      .subscribe();

    return () => {
      if (refreshTimerId) {
        window.clearTimeout(refreshTimerId);
      }
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
    } finally {
      setBusyId(null);
    }
  };

  const removeProduct = async (id: string) => {
    if (!window.confirm("Delete this product listing?")) return;

    setBusyId(id);
    try {
      await deleteProviderListing({ listingType: "product", listingId: id });
      await loadListings({ silent: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to delete product listing.");
    } finally {
      setBusyId(null);
    }
  };

  const toggleServicePaused = async (service: ProviderServiceListing) => {
    const nextAvailability: ProfileAvailability = service.availability === "offline" ? "available" : "offline";
    setBusyId(service.id);

    try {
      await updateProviderListing({
        listingType: "service",
        listingId: service.id,
        values: {
          title: service.title,
          price: service.price,
          category: service.category,
          description: service.description,
          availability: nextAvailability,
          pricingType: service.pricingType,
        },
      });
      await loadListings({ silent: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update service availability.");
    } finally {
      setBusyId(null);
    }
  };

  const toggleProductPaused = async (product: ProviderProductListing) => {
    const nextStock = product.stock > 0 ? 0 : 1;
    setBusyId(product.id);

    try {
      await updateProviderListing({
        listingType: "product",
        listingId: product.id,
        values: {
          title: product.title,
          price: product.price,
          category: product.category,
          description: product.description,
          stock: nextStock,
          deliveryMethod: product.deliveryMethod,
          imageUrl: product.imageUrl,
        },
      });
      await loadListings({ silent: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update product stock.");
    } finally {
      setBusyId(null);
    }
  };

  const saveServiceEdit = async () => {
    if (!editingService) return;

    setBusyId(editingService.id);
    try {
      await updateProviderListing({
        listingType: "service",
        listingId: editingService.id,
        values: {
          title: editingService.title,
          price: Number(editingService.price),
          category: editingService.category,
          description: editingService.description,
          availability: editingService.availability,
          pricingType: editingService.pricingType,
        },
      });
      setEditingService(null);
      await loadListings({ silent: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save service edits.");
    } finally {
      setBusyId(null);
    }
  };

  const saveProductEdit = async () => {
    if (!editingProduct) return;

    setBusyId(editingProduct.id);
    try {
      await updateProviderListing({
        listingType: "product",
        listingId: editingProduct.id,
        values: {
          title: editingProduct.title,
          price: Number(editingProduct.price),
          category: editingProduct.category,
          description: editingProduct.description,
          stock: Number(editingProduct.stock),
          deliveryMethod: editingProduct.deliveryMethod,
          imageUrl: editingProduct.imageUrl,
        },
      });
      setEditingProduct(null);
      await loadListings({ silent: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save product edits.");
    } finally {
      setBusyId(null);
    }
  };

  const uploadEditProductImage = async (file: File) => {
    if (!editingProduct) return;
    setBusyId(editingProduct.id);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage
        .from("listing-images")
        .upload(filePath, file, { contentType: file.type || "image/jpeg", upsert: false });

      if (error) {
        throw new Error(error.message || "Unable to upload image.");
      }

      setEditingProduct((current) => (current ? { ...current, imageUrl: filePath } : current));
    } catch (uploadError) {
      setErrorMessage(uploadError instanceof Error ? uploadError.message : "Unable to upload image.");
    } finally {
      setBusyId(null);
    }
  };

  if (!providerId && !loading) {
    return (
      <div className="w-full max-w-[2200px] mx-auto">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-700">
          Please log in to manage listings.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[2200px] mx-auto space-y-5 sm:space-y-6">
      {!loading && services.length + products.length === 0 && (
        <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-100 to-violet-100 p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-slate-900">Start your provider profile</h2>
          <p className="text-sm text-slate-600 mt-1">
            You have no listings yet. Complete these steps to start receiving local leads.
          </p>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              onClick={() => router.push("/dashboard/profile")}
              className="rounded-xl bg-white border border-slate-200 p-3 text-left hover:border-indigo-400 transition-colors"
            >
              <p className="font-medium text-slate-900">1. Complete Profile</p>
              <p className="text-xs text-slate-500 mt-1">Add bio, location, and details customers need to trust you.</p>
            </button>
            <button
              onClick={() => router.push("/dashboard/provider/add-service")}
              className="rounded-xl bg-white border border-slate-200 p-3 text-left hover:border-indigo-400 transition-colors"
            >
              <p className="font-medium text-slate-900">2. Add Service</p>
              <p className="text-xs text-slate-500 mt-1">Publish what you can do for customers.</p>
            </button>
            <button
              onClick={() => router.push("/dashboard/provider/add-product")}
              className="rounded-xl bg-white border border-slate-200 p-3 text-left hover:border-indigo-400 transition-colors"
            >
              <p className="font-medium text-slate-900">3. Add Product</p>
              <p className="text-xs text-slate-500 mt-1">List products for nearby buyers.</p>
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 text-white shadow-lg">
        <h1 className="text-xl sm:text-2xl font-bold">Manage Your Listings</h1>
        <p className="text-white/90 mt-1">Keep offerings updated so nearby customers can book with confidence.</p>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="rounded-xl bg-white/15 border border-white/30 p-3">
            <p className="text-white/75">Total Services</p>
            <p className="text-lg font-semibold">{services.length}</p>
          </div>
          <div className="rounded-xl bg-white/15 border border-white/30 p-3">
            <p className="text-white/75">Active Services</p>
            <p className="text-lg font-semibold">{activeServices}</p>
          </div>
          <div className="rounded-xl bg-white/15 border border-white/30 p-3">
            <p className="text-white/75">Total Products</p>
            <p className="text-lg font-semibold">{products.length}</p>
          </div>
          <div className="rounded-xl bg-white/15 border border-white/30 p-3">
            <p className="text-white/75">In Stock</p>
            <p className="text-lg font-semibold">{activeProducts}</p>
          </div>
        </div>
      </div>

      {refreshing ? (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
          Syncing latest listing changes...
        </div>
      ) : null}

      {compatibilityNotice ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {compatibilityNotice}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>
      ) : null}

      <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
        <Wrench size={18} /> Services
      </h2>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-500">Loading listings...</div>
      ) : services.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-500">No services listed yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {services.map((service) => {
            const paused = service.availability === "offline";
            const editing = editingService?.id === service.id;
            return (
              <motion.div
                key={service.id}
                whileHover={{ scale: 1.01 }}
                className="p-4 sm:p-5 bg-white border border-slate-200 rounded-2xl shadow-sm"
              >
                {editing ? (
                  <div className="space-y-3">
                    <input
                      value={editingService.title}
                      onChange={(event) => setEditingService({ ...editingService, title: event.target.value })}
                      className="w-full p-2 rounded-lg bg-white border border-slate-200 text-slate-900"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="number"
                        value={editingService.price}
                        onChange={(event) =>
                          setEditingService({ ...editingService, price: Number(event.target.value) })
                        }
                        className="w-full p-2 rounded-lg bg-white border border-slate-200 text-slate-900"
                      />
                      <input
                        value={editingService.category}
                        onChange={(event) => setEditingService({ ...editingService, category: event.target.value })}
                        className="w-full p-2 rounded-lg bg-white border border-slate-200 text-slate-900"
                      />
                    </div>
                    <textarea
                      value={editingService.description}
                      onChange={(event) => setEditingService({ ...editingService, description: event.target.value })}
                      className="w-full p-2 rounded-lg bg-white border border-slate-200 text-slate-900"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        value={editingService.availability}
                        onChange={(event) =>
                          setEditingService({
                            ...editingService,
                            availability: event.target.value as ProfileAvailability,
                          })
                        }
                        className="w-full p-2 rounded-lg bg-white border border-slate-200 text-slate-900"
                      >
                        <option value="available">available</option>
                        <option value="busy">busy</option>
                        <option value="offline">offline</option>
                      </select>
                      <div className="flex gap-2">
                        <button
                          onClick={saveServiceEdit}
                          className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm hover:bg-indigo-500 transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingService(null)}
                          className="flex-1 bg-slate-100 text-slate-700 rounded-lg py-2 text-sm hover:bg-slate-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-slate-900 text-lg">{service.title}</h3>
                        <p className="text-xs text-slate-500 mt-1">{service.category || "General"}</p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          paused ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {paused ? "Paused" : service.availability || "Active"}
                      </span>
                    </div>
                    <p className="text-slate-600 mt-2 text-sm">{service.description || "No description"}</p>
                    <p className="text-indigo-600 font-bold mt-3">INR {service.price.toLocaleString("en-IN")}</p>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                      <button
                        onClick={() =>
                          setEditingService({
                            id: service.id,
                            title: service.title,
                            price: service.price,
                            category: service.category || "",
                            description: service.description || "",
                            availability: service.availability,
                            pricingType: service.pricingType,
                          })
                        }
                        className="bg-slate-100 text-slate-700 hover:bg-slate-200 py-2 rounded-lg flex items-center justify-center gap-1 transition-colors"
                      >
                        <Pencil size={14} /> Edit
                      </button>
                      <button
                        disabled={busyId === service.id}
                        onClick={() => void toggleServicePaused(service)}
                        className="bg-amber-500 text-white hover:bg-amber-600 py-2 rounded-lg flex items-center justify-center gap-1 transition-colors"
                      >
                        {paused ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
                        {paused ? "Resume" : "Pause"}
                      </button>
                      <button
                        disabled={busyId === service.id}
                        onClick={() => void removeService(service.id)}
                        className="bg-rose-600 text-white hover:bg-rose-700 py-2 rounded-lg flex items-center justify-center gap-1 transition-colors"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2 mt-6">
        <Package size={18} /> Products
      </h2>

      {loading ? null : products.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-500">No products listed yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {products.map((product) => {
            const paused = product.stock <= 0;
            const editing = editingProduct?.id === product.id;
            return (
              <motion.div
                key={product.id}
                whileHover={{ scale: 1.01 }}
                className="p-4 sm:p-5 bg-white border border-slate-200 rounded-2xl shadow-sm"
              >
                {editing ? (
                  <div className="space-y-3">
                    <input
                      value={editingProduct.title}
                      onChange={(event) => setEditingProduct({ ...editingProduct, title: event.target.value })}
                      className="w-full p-2 rounded-lg bg-white border border-slate-200 text-slate-900"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="number"
                        value={editingProduct.price}
                        onChange={(event) =>
                          setEditingProduct({ ...editingProduct, price: Number(event.target.value) })
                        }
                        className="w-full p-2 rounded-lg bg-white border border-slate-200 text-slate-900"
                      />
                      <input
                        type="number"
                        value={editingProduct.stock}
                        onChange={(event) =>
                          setEditingProduct({ ...editingProduct, stock: Number(event.target.value) })
                        }
                        className="w-full p-2 rounded-lg bg-white border border-slate-200 text-slate-900"
                      />
                    </div>
                    <input
                      value={editingProduct.category}
                      onChange={(event) => setEditingProduct({ ...editingProduct, category: event.target.value })}
                      className="w-full p-2 rounded-lg bg-white border border-slate-200 text-slate-900"
                    />
                    <textarea
                      value={editingProduct.description}
                      onChange={(event) => setEditingProduct({ ...editingProduct, description: event.target.value })}
                      className="w-full p-2 rounded-lg bg-white border border-slate-200 text-slate-900"
                    />
                    <select
                      value={editingProduct.deliveryMethod}
                      onChange={(event) =>
                        setEditingProduct({
                          ...editingProduct,
                          deliveryMethod: event.target.value as ProductDeliveryMethod,
                        })
                      }
                      className="w-full p-2 rounded-lg bg-white border border-slate-200 text-slate-900"
                    >
                      <option value="pickup">pickup</option>
                      <option value="delivery">delivery</option>
                      <option value="both">both</option>
                    </select>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          void uploadEditProductImage(file);
                        }
                      }}
                      className="w-full p-2 rounded-lg bg-white border border-slate-200 text-slate-900"
                    />
                    {resolveListingImageUrl(editingProduct.imageUrl) ? (
                      <img
                        src={resolveListingImageUrl(editingProduct.imageUrl) || ""}
                        alt="Product"
                        className="h-20 w-20 rounded-lg object-cover"
                      />
                    ) : null}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={saveProductEdit}
                        className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm hover:bg-indigo-500 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingProduct(null)}
                        className="flex-1 bg-slate-100 text-slate-700 rounded-lg py-2 text-sm hover:bg-slate-200 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-slate-900 text-lg">{product.title}</h3>
                        <p className="text-xs text-slate-500 mt-1">{product.category || "General"}</p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          paused ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {paused ? "Paused" : `Stock ${product.stock}`}
                      </span>
                    </div>
                    <p className="text-slate-600 mt-2 text-sm">{product.description || "No description"}</p>
                    <p className="text-emerald-600 font-bold mt-3">INR {product.price.toLocaleString("en-IN")}</p>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                      <button
                        onClick={() =>
                          setEditingProduct({
                            id: product.id,
                            title: product.title,
                            price: product.price,
                            category: product.category || "",
                            description: product.description || "",
                            stock: product.stock,
                            deliveryMethod: product.deliveryMethod,
                            imageUrl: product.imageUrl,
                          })
                        }
                        className="bg-slate-100 text-slate-700 hover:bg-slate-200 py-2 rounded-lg flex items-center justify-center gap-1 transition-colors"
                      >
                        <Pencil size={14} /> Edit
                      </button>
                      <button
                        disabled={busyId === product.id}
                        onClick={() => void toggleProductPaused(product)}
                        className="bg-amber-500 text-white hover:bg-amber-600 py-2 rounded-lg flex items-center justify-center gap-1 transition-colors"
                      >
                        {paused ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
                        {paused ? "Resume" : "Pause"}
                      </button>
                      <button
                        disabled={busyId === product.id}
                        onClick={() => void removeProduct(product.id)}
                        className="bg-rose-600 text-white hover:bg-rose-700 py-2 rounded-lg flex items-center justify-center gap-1 transition-colors"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
