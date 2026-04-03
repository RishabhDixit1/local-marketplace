"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Loader2, Package, Pencil, Plus, ShoppingBag, ShoppingCart, Trash2, X, Zap } from "lucide-react";
import { useCart } from "@/app/components/store/CartContext";
import ImageUploadField from "@/app/components/ImageUploadField";
import { createProviderListing, deleteProviderListing, updateProviderListing } from "@/lib/provider/client";
import type { ProductDeliveryMethod, ServicePricingType } from "@/lib/provider/listings";
import { resolveListingImageUrl } from "@/lib/provider/listings";
import { supabase } from "@/lib/supabase";

type ServiceRow = {
  id: string;
  title: string | null;
  description: string | null;
  category: string | null;
  price: number | null;
  availability: string | null;
};

type ProductRow = {
  id: string;
  title: string | null;
  description: string | null;
  category: string | null;
  price: number | null;
  stock: number | null;
  image_url: string | null;
  image_path: string | null;
};

type EditServiceState = {
  id: string;
  title: string;
  category: string;
  description: string;
  price: number;
  availability: "available" | "busy" | "offline";
  pricingType: ServicePricingType;
};

type EditProductState = {
  id: string;
  title: string;
  category: string;
  description: string;
  price: number;
  stock: number;
  deliveryMethod: ProductDeliveryMethod;
  imageUrl: string;
};

type DeleteTarget = { type: "service" | "product"; id: string; title: string };

type Props = {
  profileUserId: string;
  displayName: string;
};

const INR = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

const INPUT_CLS =
  "min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#0a66c2] focus:ring-4 focus:ring-[#0a66c2]/10";
const TEXTAREA_CLS =
  "w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-[#0a66c2] focus:ring-4 focus:ring-[#0a66c2]/10";
const SELECT_CLS =
  "min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#0a66c2] focus:ring-4 focus:ring-[#0a66c2]/10";

export default function PublicProfileStoreTab({ profileUserId, displayName }: Props) {
  const router = useRouter();
  const cart = useCart();

  // Auth
  const [isOwner, setIsOwner] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  // Data
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeTab, setStoreTab] = useState<"services" | "products">("services");

  // Interaction state
  const [added, setAdded] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  // Edit modals
  const [editService, setEditService] = useState<EditServiceState | null>(null);
  const [editProduct, setEditProduct] = useState<EditProductState | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Add modals
  const [addModal, setAddModal] = useState<"service" | "product" | null>(null);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSvcTitle, setAddSvcTitle] = useState("");
  const [addSvcCategory, setAddSvcCategory] = useState("");
  const [addSvcPrice, setAddSvcPrice] = useState("");
  const [addSvcDescription, setAddSvcDescription] = useState("");
  const [addProdTitle, setAddProdTitle] = useState("");
  const [addProdCategory, setAddProdCategory] = useState("");
  const [addProdPrice, setAddProdPrice] = useState("");
  const [addProdStock, setAddProdStock] = useState("1");
  const [addProdImageUrl, setAddProdImageUrl] = useState("");
  const [addProdDescription, setAddProdDescription] = useState("");

  const addSvcTitleRef = useRef<HTMLInputElement>(null);
  const addProdTitleRef = useRef<HTMLInputElement>(null);

  // Auth check
  useEffect(() => {
    let active = true;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      setIsOwner(user?.id === profileUserId);
      setAuthReady(true);
    })();
    return () => {
      active = false;
    };
  }, [profileUserId]);

  // Fetch services + products
  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      const [svcRes, prodRes] = await Promise.all([
        supabase
          .from("service_listings")
          .select("id,title,description,category,price,availability")
          .eq("provider_id", profileUserId)
          .order("created_at", { ascending: false }),
        supabase
          .from("product_catalog")
          .select("id,title,description,category,price,stock,image_url,image_path")
          .eq("provider_id", profileUserId)
          .order("created_at", { ascending: false }),
      ]);
      if (!active) return;
      setServices((svcRes.data as ServiceRow[] | null) ?? []);
      setProducts((prodRes.data as ProductRow[] | null) ?? []);
      setLoading(false);
    };
    void fetchData();
    return () => {
      active = false;
    };
  }, [profileUserId]);

  // Auto-switch sub-tab when data loads
  useEffect(() => {
    if (loading) return;
    if (services.length === 0 && products.length > 0) setStoreTab("products");
  }, [loading, services.length, products.length]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`public-store:${profileUserId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_listings", filter: `provider_id=eq.${profileUserId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setServices((prev) => [payload.new as ServiceRow, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setServices((prev) =>
              prev.map((s) => (s.id === (payload.new as ServiceRow).id ? (payload.new as ServiceRow) : s))
            );
          } else if (payload.eventType === "DELETE") {
            setServices((prev) => prev.filter((s) => s.id !== (payload.old as { id: string }).id));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_catalog", filter: `provider_id=eq.${profileUserId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setProducts((prev) => [payload.new as ProductRow, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setProducts((prev) =>
              prev.map((p) => (p.id === (payload.new as ProductRow).id ? (payload.new as ProductRow) : p))
            );
          } else if (payload.eventType === "DELETE") {
            setProducts((prev) => prev.filter((p) => p.id !== (payload.old as { id: string }).id));
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profileUserId]);

  // Body scroll lock for any open modal
  const anyModalOpen = Boolean(addModal || editService || editProduct || deleteTarget);
  useEffect(() => {
    if (!anyModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [anyModalOpen]);

  // Focus first input when add modal opens
  useEffect(() => {
    if (addModal === "service") setTimeout(() => addSvcTitleRef.current?.focus(), 60);
    if (addModal === "product") setTimeout(() => addProdTitleRef.current?.focus(), 60);
  }, [addModal]);

  // ── Cart actions ──────────────────────────────────────────────────────────
  const handleAddToCart = useCallback(
    (key: string, itemType: "service" | "product", itemId: string, title: string, price: number) => {
      cart.addItem({ itemType, itemId, providerId: profileUserId, providerName: displayName, title, price });
      setAdded(key);
      setTimeout(() => setAdded(null), 1400);
    },
    [cart, displayName, profileUserId]
  );

  const handleBuyNow = useCallback(
    (itemType: "service" | "product", itemId: string, title: string, price: number) => {
      cart.addItem({ itemType, itemId, providerId: profileUserId, providerName: displayName, title, price });
      cart.closeCart();
      router.push("/checkout");
    },
    [cart, displayName, profileUserId, router]
  );

  // ── Owner: stock / availability toggles ──────────────────────────────────
  const toggleServiceAvailability = useCallback(
    async (svc: ServiceRow) => {
      const next = svc.availability === "offline" ? "available" : "offline";
      setBusyId(svc.id);
      try {
        await updateProviderListing({
          listingType: "service",
          listingId: svc.id,
          values: {
            title: svc.title ?? "",
            category: svc.category ?? "",
            description: svc.description ?? "",
            price: Number(svc.price ?? 0),
            availability: next,
            pricingType: "fixed",
          },
        });
        setServices((prev) => prev.map((s) => (s.id === svc.id ? { ...s, availability: next } : s)));
      } finally {
        setBusyId(null);
      }
    },
    []
  );

  const toggleProductStock = useCallback(async (prod: ProductRow) => {
    const nextStock = (prod.stock ?? 0) > 0 ? 0 : 1;
    setBusyId(prod.id);
    try {
      await updateProviderListing({
        listingType: "product",
        listingId: prod.id,
        values: {
          title: prod.title ?? "",
          category: prod.category ?? "",
          description: prod.description ?? "",
          price: Number(prod.price ?? 0),
          stock: nextStock,
          deliveryMethod: "pickup",
          imageUrl: prod.image_path ?? prod.image_url ?? "",
        },
      });
      setProducts((prev) => prev.map((p) => (p.id === prod.id ? { ...p, stock: nextStock } : p)));
    } finally {
      setBusyId(null);
    }
  }, []);

  // ── Owner: delete ─────────────────────────────────────────────────────────
  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await deleteProviderListing({ listingType: deleteTarget.type, listingId: deleteTarget.id });
      if (deleteTarget.type === "service") setServices((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      else setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } finally {
      setBusyId(null);
    }
  }, [deleteTarget]);

  // ── Owner: edit ───────────────────────────────────────────────────────────
  const saveServiceEdit = useCallback(async () => {
    if (!editService) return;
    setEditBusy(true);
    setEditError(null);
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
      setServices((prev) =>
        prev.map((s) =>
          s.id === editService.id
            ? { ...s, title: editService.title, category: editService.category, description: editService.description, price: editService.price, availability: editService.availability }
            : s
        )
      );
      setEditService(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Unable to save changes.");
    } finally {
      setEditBusy(false);
    }
  }, [editService]);

  const saveProductEdit = useCallback(async () => {
    if (!editProduct) return;
    setEditBusy(true);
    setEditError(null);
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
      setProducts((prev) =>
        prev.map((p) =>
          p.id === editProduct.id
            ? { ...p, title: editProduct.title, category: editProduct.category, description: editProduct.description, price: editProduct.price, stock: editProduct.stock, image_path: editProduct.imageUrl, image_url: null }
            : p
        )
      );
      setEditProduct(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Unable to save changes.");
    } finally {
      setEditBusy(false);
    }
  }, [editProduct]);

  // ── Owner: add ────────────────────────────────────────────────────────────
  const handleAddService = useCallback(async () => {
    const title = addSvcTitle.trim();
    if (!title) return;
    setAddBusy(true);
    setAddError(null);
    try {
      await createProviderListing({
        listingType: "service",
        values: {
          title,
          category: addSvcCategory.trim() || "Service",
          description: addSvcDescription.trim(),
          price: Number(addSvcPrice) || 0,
          availability: "available",
          pricingType: "fixed",
        },
      });
      setAddModal(null);
      setAddSvcTitle("");
      setAddSvcCategory("");
      setAddSvcPrice("");
      setAddSvcDescription("");
      router.refresh();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Unable to add service.");
    } finally {
      setAddBusy(false);
    }
  }, [addSvcCategory, addSvcDescription, addSvcPrice, addSvcTitle, router]);

  const handleAddProduct = useCallback(async () => {
    const title = addProdTitle.trim();
    if (!title) return;
    setAddBusy(true);
    setAddError(null);
    try {
      await createProviderListing({
        listingType: "product",
        values: {
          title,
          category: addProdCategory.trim() || "Product",
          description: addProdDescription.trim(),
          price: Number(addProdPrice) || 0,
          stock: Number(addProdStock) || 1,
          deliveryMethod: "pickup",
          imageUrl: addProdImageUrl.trim(),
        },
      });
      setAddModal(null);
      setAddProdTitle("");
      setAddProdCategory("");
      setAddProdPrice("");
      setAddProdStock("1");
      setAddProdImageUrl("");
      setAddProdDescription("");
      router.refresh();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Unable to add product.");
    } finally {
      setAddBusy(false);
    }
  }, [addProdCategory, addProdDescription, addProdImageUrl, addProdPrice, addProdStock, addProdTitle, router]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-14">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  const totalItems = services.length + products.length;

  return (
    <>
      {/* Header */}
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[2rem] font-semibold tracking-tight text-slate-950">Store</h2>
            <p className="mt-2 text-sm text-slate-600">
              {isOwner ? "Manage your services and products." : `Browse and buy from ${displayName}.`}
            </p>
          </div>
          {authReady && isOwner && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setAddError(null);
                  setAddModal("service");
                }}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                <Plus className="h-3.5 w-3.5" />
                <Briefcase className="h-3.5 w-3.5" />
                Add Service
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddError(null);
                  setAddModal("product");
                }}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[#0a66c2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0959aa]"
              >
                <Plus className="h-3.5 w-3.5" />
                <Package className="h-3.5 w-3.5" />
                Add Product
              </button>
            </div>
          )}
        </div>

        {/* Empty state */}
        {totalItems === 0 && (
          <div className="rounded-[24px] border border-dashed border-slate-200 bg-[#f8fafc] p-8 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf3f8] text-[#0a66c2]">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <p className="font-semibold text-slate-800">
              {isOwner ? "Your store is empty" : "No listings yet"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {isOwner
                ? "Add your first service or product to start selling."
                : `${displayName} hasn't listed any services or products yet.`}
            </p>
          </div>
        )}

        {/* Sub-tabs */}
        {services.length > 0 && products.length > 0 && (
          <div className="flex gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1">
            {(["services", "products"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setStoreTab(t)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold capitalize transition ${
                  storeTab === t ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {t === "services" ? <Briefcase className="h-3.5 w-3.5" /> : <Package className="h-3.5 w-3.5" />}
                {t} ({t === "services" ? services.length : products.length})
              </button>
            ))}
          </div>
        )}

        {/* Services grid */}
        {(storeTab === "services" || products.length === 0) && services.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {services.map((svc) => {
              const price = Number(svc.price ?? 0);
              const offline =
                svc.availability?.toLowerCase() === "offline" ||
                svc.availability?.toLowerCase() === "unavailable";
              const key = `service:${svc.id}`;
              return (
                <article
                  key={svc.id}
                  className="flex flex-col justify-between gap-3 overflow-hidden rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
                >
                  <div>
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#edf3f8] text-[#0a66c2]">
                        <Briefcase className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-950">{svc.title ?? "Untitled Service"}</p>
                        <p className="text-xs text-slate-500">{svc.category ?? "Service"}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          offline ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {offline ? "Unavailable" : "Available"}
                      </span>
                    </div>
                    {svc.description ? (
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{svc.description}</p>
                    ) : null}
                    <p className="mt-2 text-base font-semibold text-[#0a66c2]">{INR(price)}</p>
                  </div>

                  <div className="flex gap-2">
                    {isOwner ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setEditService({
                              id: svc.id,
                              title: svc.title ?? "",
                              category: svc.category ?? "",
                              description: svc.description ?? "",
                              price,
                              availability: (svc.availability as "available" | "busy" | "offline") ?? "available",
                              pricingType: "fixed",
                            })
                          }
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          disabled={busyId === svc.id}
                          onClick={() => void toggleServiceAvailability(svc)}
                          className={`flex flex-1 items-center justify-center rounded-xl py-2 text-sm font-semibold text-white transition disabled:opacity-60 ${
                            offline ? "bg-emerald-600 hover:bg-emerald-500" : "bg-amber-500 hover:bg-amber-400"
                          }`}
                        >
                          {busyId === svc.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : offline ? (
                            "Go Live"
                          ) : (
                            "Pause"
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ type: "service", id: svc.id, title: svc.title ?? "Service" })}
                          className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-3 py-2 text-rose-500 transition hover:bg-rose-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={offline}
                          onClick={() => handleAddToCart(key, "service", svc.id, svc.title ?? "Service", price)}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-[#0a66c2] hover:text-[#0a66c2] disabled:pointer-events-none disabled:opacity-50"
                        >
                          <ShoppingCart className="h-3.5 w-3.5" />
                          {added === key ? "Added ✓" : "Add to Cart"}
                        </button>
                        <button
                          type="button"
                          disabled={offline}
                          onClick={() => handleBuyNow("service", svc.id, svc.title ?? "Service", price)}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0a66c2] py-2.5 text-sm font-semibold text-white transition hover:bg-[#0959aa] disabled:pointer-events-none disabled:opacity-50"
                        >
                          <Zap className="h-3.5 w-3.5" /> Hire Now
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Products grid */}
        {(storeTab === "products" || services.length === 0) && products.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {products.map((prod) => {
              const price = Number(prod.price ?? 0);
              const outOfStock = (prod.stock ?? 0) <= 0;
              const key = `product:${prod.id}`;
              const imgUrl = resolveListingImageUrl(prod.image_path ?? prod.image_url);
              return (
                <article
                  key={prod.id}
                  className="flex flex-col justify-between overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
                >
                  {imgUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <div className="h-44 w-full overflow-hidden">
                      <img
                        src={imgUrl}
                        alt={prod.title ?? "Product"}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-36 items-center justify-center bg-[#f0f4f8]">
                      <Package className="h-8 w-8 text-slate-300" />
                    </div>
                  )}

                  <div className="flex flex-col gap-3 p-4">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-slate-950">{prod.title ?? "Untitled Product"}</p>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            outOfStock ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {outOfStock ? "Out of stock" : "In stock"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{prod.category ?? "Product"}</p>
                      {prod.description ? (
                        <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-slate-600">{prod.description}</p>
                      ) : null}
                      <p className="mt-2 text-base font-semibold text-[#0a66c2]">{INR(price)}</p>
                    </div>

                    <div className="flex gap-2">
                      {isOwner ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setEditProduct({
                                id: prod.id,
                                title: prod.title ?? "",
                                category: prod.category ?? "",
                                description: prod.description ?? "",
                                price,
                                stock: Number(prod.stock ?? 0),
                                deliveryMethod: "pickup",
                                imageUrl: prod.image_path ?? prod.image_url ?? "",
                              })
                            }
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </button>
                          <button
                            type="button"
                            disabled={busyId === prod.id}
                            onClick={() => void toggleProductStock(prod)}
                            className={`flex flex-1 items-center justify-center rounded-xl py-2 text-sm font-semibold text-white transition disabled:opacity-60 ${
                              outOfStock ? "bg-emerald-600 hover:bg-emerald-500" : "bg-amber-500 hover:bg-amber-400"
                            }`}
                          >
                            {busyId === prod.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : outOfStock ? (
                              "Mark In Stock"
                            ) : (
                              "Mark Out"
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({ type: "product", id: prod.id, title: prod.title ?? "Product" })
                            }
                            className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-3 py-2 text-rose-500 transition hover:bg-rose-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={outOfStock}
                            onClick={() => handleAddToCart(key, "product", prod.id, prod.title ?? "Product", price)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-[#0a66c2] hover:text-[#0a66c2] disabled:pointer-events-none disabled:opacity-50"
                          >
                            <ShoppingCart className="h-3.5 w-3.5" />
                            {added === key ? "Added ✓" : "Add to Cart"}
                          </button>
                          <button
                            type="button"
                            disabled={outOfStock}
                            onClick={() => handleBuyNow("product", prod.id, prod.title ?? "Product", price)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0a66c2] py-2.5 text-sm font-semibold text-white transition hover:bg-[#0959aa] disabled:pointer-events-none disabled:opacity-50"
                          >
                            <ShoppingBag className="h-3.5 w-3.5" /> Buy Now
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Delete confirm ──────────────────────────────────────────────────── */}
      {deleteTarget ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setDeleteTarget(null)} />
          <div className="relative z-[1] w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-950">Remove listing?</h3>
            <p className="mt-2 text-sm text-slate-600">
              &ldquo;{deleteTarget.title}&rdquo; will be permanently removed from your store.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-full border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={busyId === deleteTarget.id}
                className="flex-1 rounded-full bg-rose-600 py-2.5 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
              >
                {busyId === deleteTarget.id ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : (
                  "Remove"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Edit service modal ──────────────────────────────────────────────── */}
      {editService ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => !editBusy && setEditService(null)} />
          <div className="relative z-[1] flex max-h-[88vh] w-full max-w-lg flex-col overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Service</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-950">Edit listing</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditService(null)}
                disabled={editBusy}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-800">Title</label>
                <input
                  value={editService.title}
                  onChange={(e) => setEditService((s) => s ? { ...s, title: e.target.value } : s)}
                  className={INPUT_CLS}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-800">Category</label>
                <input
                  value={editService.category}
                  onChange={(e) => setEditService((s) => s ? { ...s, category: e.target.value } : s)}
                  className={INPUT_CLS}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-800">Description</label>
                <textarea
                  value={editService.description}
                  onChange={(e) => setEditService((s) => s ? { ...s, description: e.target.value } : s)}
                  rows={3}
                  className={TEXTAREA_CLS}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-800">Price (INR)</label>
                  <input
                    type="number"
                    min="0"
                    value={editService.price}
                    onChange={(e) => setEditService((s) => s ? { ...s, price: Number(e.target.value) } : s)}
                    className={INPUT_CLS}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-800">Availability</label>
                  <select
                    value={editService.availability}
                    onChange={(e) => setEditService((s) => s ? { ...s, availability: e.target.value as "available" | "busy" | "offline" } : s)}
                    className={SELECT_CLS}
                  >
                    <option value="available">Available</option>
                    <option value="busy">Busy</option>
                    <option value="offline">Offline</option>
                  </select>
                </div>
              </div>
              {editError ? <p className="text-sm text-rose-600">{editError}</p> : null}
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setEditService(null)}
                disabled={editBusy}
                className="flex-1 rounded-full border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveServiceEdit()}
                disabled={editBusy}
                className="flex-1 rounded-full bg-[#0a66c2] py-2.5 text-sm font-semibold text-white hover:bg-[#0959aa] disabled:opacity-60"
              >
                {editBusy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Edit product modal ──────────────────────────────────────────────── */}
      {editProduct ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => !editBusy && setEditProduct(null)} />
          <div className="relative z-[1] flex max-h-[88vh] w-full max-w-lg flex-col overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Product</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-950">Edit listing</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditProduct(null)}
                disabled={editBusy}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-800">Title</label>
                <input
                  value={editProduct.title}
                  onChange={(e) => setEditProduct((p) => p ? { ...p, title: e.target.value } : p)}
                  className={INPUT_CLS}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-800">Category</label>
                <input
                  value={editProduct.category}
                  onChange={(e) => setEditProduct((p) => p ? { ...p, category: e.target.value } : p)}
                  className={INPUT_CLS}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-800">Description</label>
                <textarea
                  value={editProduct.description}
                  onChange={(e) => setEditProduct((p) => p ? { ...p, description: e.target.value } : p)}
                  rows={3}
                  className={TEXTAREA_CLS}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-800">Price (INR)</label>
                  <input
                    type="number"
                    min="0"
                    value={editProduct.price}
                    onChange={(e) => setEditProduct((p) => p ? { ...p, price: Number(e.target.value) } : p)}
                    className={INPUT_CLS}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-800">Stock quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={editProduct.stock}
                    onChange={(e) => setEditProduct((p) => p ? { ...p, stock: Number(e.target.value) } : p)}
                    className={INPUT_CLS}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-800">Product Image</label>
                <ImageUploadField
                  value={editProduct.imageUrl}
                  onChange={(url) => setEditProduct((p) => p ? { ...p, imageUrl: url } : p)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-800">Delivery method</label>
                <select
                  value={editProduct.deliveryMethod}
                  onChange={(e) => setEditProduct((p) => p ? { ...p, deliveryMethod: e.target.value as ProductDeliveryMethod } : p)}
                  className={SELECT_CLS}
                >
                  <option value="pickup">Pickup only</option>
                  <option value="delivery">Delivery only</option>
                  <option value="both">Pickup &amp; Delivery</option>
                </select>
              </div>
              {editError ? <p className="text-sm text-rose-600">{editError}</p> : null}
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setEditProduct(null)}
                disabled={editBusy}
                className="flex-1 rounded-full border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveProductEdit()}
                disabled={editBusy}
                className="flex-1 rounded-full bg-[#0a66c2] py-2.5 text-sm font-semibold text-white hover:bg-[#0959aa] disabled:opacity-60"
              >
                {editBusy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Add service modal ───────────────────────────────────────────────── */}
      {addModal === "service" ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => !addBusy && setAddModal(null)} />
          <div className="relative z-[1] flex max-h-[88vh] w-full max-w-lg flex-col overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">New listing</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-950">Add a service</h3>
              </div>
              <button
                type="button"
                onClick={() => setAddModal(null)}
                disabled={addBusy}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-800">Service title *</label>
                <input
                  ref={addSvcTitleRef}
                  value={addSvcTitle}
                  onChange={(e) => setAddSvcTitle(e.target.value)}
                  placeholder="e.g. Home cleaning, AC repair, Tutoring"
                  className={INPUT_CLS}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-800">Category</label>
                <input
                  value={addSvcCategory}
                  onChange={(e) => setAddSvcCategory(e.target.value)}
                  placeholder="e.g. Cleaning, Repair, Education"
                  className={INPUT_CLS}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-800">Description</label>
                <textarea
                  value={addSvcDescription}
                  onChange={(e) => setAddSvcDescription(e.target.value)}
                  rows={3}
                  placeholder="What's included, coverage area, timing..."
                  className={TEXTAREA_CLS}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-800">Price (INR)</label>
                <input
                  type="number"
                  min="0"
                  value={addSvcPrice}
                  onChange={(e) => setAddSvcPrice(e.target.value)}
                  placeholder="0"
                  className={INPUT_CLS}
                />
              </div>
              {addError ? <p className="text-sm text-rose-600">{addError}</p> : null}
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setAddModal(null)}
                disabled={addBusy}
                className="flex-1 rounded-full border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleAddService()}
                disabled={addBusy || !addSvcTitle.trim()}
                className="flex-1 rounded-full bg-[#0a66c2] py-2.5 text-sm font-semibold text-white hover:bg-[#0959aa] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {addBusy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Add service"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Add product modal ───────────────────────────────────────────────── */}
      {addModal === "product" ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => !addBusy && setAddModal(null)} />
          <div className="relative z-[1] flex max-h-[88vh] w-full max-w-lg flex-col overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">New listing</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-950">Add a product</h3>
              </div>
              <button
                type="button"
                onClick={() => setAddModal(null)}
                disabled={addBusy}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-800">Product name *</label>
                <input
                  ref={addProdTitleRef}
                  value={addProdTitle}
                  onChange={(e) => setAddProdTitle(e.target.value)}
                  placeholder="e.g. Original Ittar, Handmade soap"
                  className={INPUT_CLS}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-800">Category</label>
                <input
                  value={addProdCategory}
                  onChange={(e) => setAddProdCategory(e.target.value)}
                  placeholder="e.g. Fragrance, Grocery, Clothing"
                  className={INPUT_CLS}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-800">Description</label>
                <textarea
                  value={addProdDescription}
                  onChange={(e) => setAddProdDescription(e.target.value)}
                  rows={3}
                  placeholder="Product details, ingredients, dimensions..."
                  className={TEXTAREA_CLS}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-800">Price (INR)</label>
                  <input
                    type="number"
                    min="0"
                    value={addProdPrice}
                    onChange={(e) => setAddProdPrice(e.target.value)}
                    placeholder="0"
                    className={INPUT_CLS}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-800">Initial stock</label>
                  <input
                    type="number"
                    min="0"
                    value={addProdStock}
                    onChange={(e) => setAddProdStock(e.target.value)}
                    className={INPUT_CLS}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-800">Product Image</label>
                <ImageUploadField
                  value={addProdImageUrl}
                  onChange={setAddProdImageUrl}
                />
              </div>
              {addError ? <p className="text-sm text-rose-600">{addError}</p> : null}
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setAddModal(null)}
                disabled={addBusy}
                className="flex-1 rounded-full border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleAddProduct()}
                disabled={addBusy || !addProdTitle.trim()}
                className="flex-1 rounded-full bg-[#0a66c2] py-2.5 text-sm font-semibold text-white hover:bg-[#0959aa] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {addBusy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Add product"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
