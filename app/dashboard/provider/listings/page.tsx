"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { Package, Pencil, PauseCircle, PlayCircle, Trash2, Wrench } from "lucide-react";

type ServiceListing = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  price: number;
  availability: string | null;
  provider_id: string;
};

type ProductListing = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  price: number;
  stock: number | null;
  delivery_method: string | null;
  provider_id: string;
};

type EditingService = {
  id: string;
  title: string;
  price: number;
  category: string;
  description: string;
  availability: string;
};

type EditingProduct = {
  id: string;
  title: string;
  price: number;
  category: string;
  description: string;
  stock: number;
  delivery_method: string;
};

export default function ListingsPage() {
  const router = useRouter();
  const [providerId, setProviderId] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceListing[]>([]);
  const [products, setProducts] = useState<ProductListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingService, setEditingService] = useState<EditingService | null>(null);
  const [editingProduct, setEditingProduct] = useState<EditingProduct | null>(null);

  const activeServices = useMemo(
    () => services.filter((service) => (service.availability || "").toLowerCase() !== "offline").length,
    [services]
  );

  const activeProducts = useMemo(() => products.filter((product) => (product.stock || 0) > 0).length, [products]);

  const loadListings = async (userId: string) => {
    setLoading(true);

    const [{ data: serviceRows }, { data: productRows }] = await Promise.all([
      supabase
        .from("service_listings")
        .select("id,title,description,category,price,availability,provider_id")
        .eq("provider_id", userId)
        .order("title"),
      supabase
        .from("product_catalog")
        .select("id,title,description,category,price,stock,delivery_method,provider_id")
        .eq("provider_id", userId)
        .order("title"),
    ]);

    setServices((serviceRows as ServiceListing[]) || []);
    setProducts((productRows as ProductListing[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      setProviderId(user.id);
      await loadListings(user.id);
    };

    init();
  }, []);

  const removeService = async (id: string) => {
    if (!confirm("Delete this service listing?")) return;
    setBusyId(id);
    await supabase.from("service_listings").delete().eq("id", id);
    setServices((prev) => prev.filter((item) => item.id !== id));
    setBusyId(null);
  };

  const removeProduct = async (id: string) => {
    if (!confirm("Delete this product listing?")) return;
    setBusyId(id);
    await supabase.from("product_catalog").delete().eq("id", id);
    setProducts((prev) => prev.filter((item) => item.id !== id));
    setBusyId(null);
  };

  const toggleServicePaused = async (service: ServiceListing) => {
    const nextAvailability = (service.availability || "available").toLowerCase() === "offline" ? "available" : "offline";
    setBusyId(service.id);
    await supabase.from("service_listings").update({ availability: nextAvailability }).eq("id", service.id);
    setServices((prev) =>
      prev.map((item) => (item.id === service.id ? { ...item, availability: nextAvailability } : item))
    );
    setBusyId(null);
  };

  const toggleProductPaused = async (product: ProductListing) => {
    const currentStock = product.stock || 0;
    const nextStock = currentStock > 0 ? 0 : 1;
    setBusyId(product.id);
    await supabase.from("product_catalog").update({ stock: nextStock }).eq("id", product.id);
    setProducts((prev) =>
      prev.map((item) => (item.id === product.id ? { ...item, stock: nextStock } : item))
    );
    setBusyId(null);
  };

  const saveServiceEdit = async () => {
    if (!editingService) return;
    setBusyId(editingService.id);
    await supabase
      .from("service_listings")
      .update({
        title: editingService.title,
        price: Number(editingService.price),
        category: editingService.category,
        description: editingService.description,
        availability: editingService.availability,
      })
      .eq("id", editingService.id);

    setServices((prev) =>
      prev.map((item) =>
        item.id === editingService.id
          ? {
              ...item,
              title: editingService.title,
              price: Number(editingService.price),
              category: editingService.category,
              description: editingService.description,
              availability: editingService.availability,
            }
          : item
      )
    );

    setEditingService(null);
    setBusyId(null);
  };

  const saveProductEdit = async () => {
    if (!editingProduct) return;
    setBusyId(editingProduct.id);
    await supabase
      .from("product_catalog")
      .update({
        title: editingProduct.title,
        price: Number(editingProduct.price),
        category: editingProduct.category,
        description: editingProduct.description,
        stock: Number(editingProduct.stock),
        delivery_method: editingProduct.delivery_method,
      })
      .eq("id", editingProduct.id);

    setProducts((prev) =>
      prev.map((item) =>
        item.id === editingProduct.id
          ? {
              ...item,
              title: editingProduct.title,
              price: Number(editingProduct.price),
              category: editingProduct.category,
              description: editingProduct.description,
              stock: Number(editingProduct.stock),
              delivery_method: editingProduct.delivery_method,
            }
          : item
      )
    );

    setEditingProduct(null);
    setBusyId(null);
  };

  if (!providerId && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 to-black text-white p-6">
        <p className="text-slate-300">Please log in to manage listings.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-black text-white p-6">
      <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6">
        {!loading && services.length + products.length === 0 && (
          <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 p-4 sm:p-5">
            <h2 className="text-lg font-semibold">Launch your provider profile</h2>
            <p className="text-sm text-slate-300 mt-1">
              You have no listings yet. Complete these steps to start receiving local leads.
            </p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                onClick={() => router.push("/dashboard/profile")}
                className="rounded-xl bg-slate-900 border border-slate-700 p-3 text-left hover:border-indigo-500"
              >
                <p className="font-medium">1. Complete Profile</p>
                <p className="text-xs text-slate-400 mt-1">Add bio, location, and services.</p>
              </button>
              <button
                onClick={() => router.push("/dashboard/provider/add-service")}
                className="rounded-xl bg-slate-900 border border-slate-700 p-3 text-left hover:border-indigo-500"
              >
                <p className="font-medium">2. Add Service</p>
                <p className="text-xs text-slate-400 mt-1">Publish what you can do for customers.</p>
              </button>
              <button
                onClick={() => router.push("/dashboard/provider/add-product")}
                className="rounded-xl bg-slate-900 border border-slate-700 p-3 text-left hover:border-indigo-500"
              >
                <p className="font-medium">3. Add Product</p>
                <p className="text-xs text-slate-400 mt-1">List products for nearby buyers.</p>
              </button>
            </div>
          </div>
        )}

        <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-6 bg-gradient-to-r from-indigo-600/30 to-pink-600/20 border border-indigo-500/30">
          <h1 className="text-xl sm:text-2xl font-bold">Manage Your Listings</h1>
          <p className="text-slate-200 mt-1">Keep offerings updated so nearby customers can book with confidence.</p>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="rounded-xl bg-slate-900/80 border border-slate-700 p-3">
              <p className="text-slate-400">Total Services</p>
              <p className="text-lg font-semibold">{services.length}</p>
            </div>
            <div className="rounded-xl bg-slate-900/80 border border-slate-700 p-3">
              <p className="text-slate-400">Active Services</p>
              <p className="text-lg font-semibold">{activeServices}</p>
            </div>
            <div className="rounded-xl bg-slate-900/80 border border-slate-700 p-3">
              <p className="text-slate-400">Total Products</p>
              <p className="text-lg font-semibold">{products.length}</p>
            </div>
            <div className="rounded-xl bg-slate-900/80 border border-slate-700 p-3">
              <p className="text-slate-400">In Stock</p>
              <p className="text-lg font-semibold">{activeProducts}</p>
            </div>
          </div>
        </div>

        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Wrench size={18} /> Services
        </h2>

        {loading ? (
          <p className="text-slate-400">Loading listings...</p>
        ) : services.length === 0 ? (
          <p className="text-slate-400">No services listed yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {services.map((service) => {
              const paused = (service.availability || "").toLowerCase() === "offline";
              const editing = editingService?.id === service.id;
              return (
                <motion.div
                  key={service.id}
                  whileHover={{ scale: 1.01 }}
                  className="p-4 sm:p-5 bg-slate-900 border border-slate-800 rounded-2xl"
                >
                  {editing ? (
                    <div className="space-y-3">
                      <input
                        value={editingService.title}
                        onChange={(e) => setEditingService({ ...editingService, title: e.target.value })}
                        className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="number"
                          value={editingService.price}
                          onChange={(e) => setEditingService({ ...editingService, price: Number(e.target.value) })}
                          className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700"
                        />
                        <input
                          value={editingService.category}
                          onChange={(e) => setEditingService({ ...editingService, category: e.target.value })}
                          className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700"
                        />
                      </div>
                      <textarea
                        value={editingService.description}
                        onChange={(e) => setEditingService({ ...editingService, description: e.target.value })}
                        className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <select
                          value={editingService.availability}
                          onChange={(e) => setEditingService({ ...editingService, availability: e.target.value })}
                          className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700"
                        >
                          <option value="available">available</option>
                          <option value="busy">busy</option>
                          <option value="offline">offline</option>
                        </select>
                        <div className="flex gap-2">
                          <button onClick={saveServiceEdit} className="flex-1 bg-indigo-600 rounded-lg py-2 text-sm">
                            Save
                          </button>
                          <button
                            onClick={() => setEditingService(null)}
                            className="flex-1 bg-slate-700 rounded-lg py-2 text-sm"
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
                          <h3 className="font-semibold text-lg">{service.title}</h3>
                          <p className="text-xs text-slate-400 mt-1">{service.category || "General"}</p>
                        </div>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            paused ? "bg-amber-900/40 text-amber-300" : "bg-emerald-900/40 text-emerald-300"
                          }`}
                        >
                          {paused ? "Paused" : service.availability || "Active"}
                        </span>
                      </div>
                      <p className="text-slate-400 mt-2 text-sm">{service.description || "No description"}</p>
                      <p className="text-indigo-400 font-bold mt-3">₹ {service.price}</p>

                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                        <button
                          onClick={() =>
                            setEditingService({
                              id: service.id,
                              title: service.title,
                              price: service.price,
                              category: service.category || "",
                              description: service.description || "",
                              availability: service.availability || "available",
                            })
                          }
                          className="bg-slate-800 hover:bg-slate-700 py-2 rounded-lg flex items-center justify-center gap-1"
                        >
                          <Pencil size={14} /> Edit
                        </button>
                        <button
                          disabled={busyId === service.id}
                          onClick={() => toggleServicePaused(service)}
                          className="bg-amber-600 hover:bg-amber-700 py-2 rounded-lg flex items-center justify-center gap-1"
                        >
                          {paused ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
                          {paused ? "Resume" : "Pause"}
                        </button>
                        <button
                          disabled={busyId === service.id}
                          onClick={() => removeService(service.id)}
                          className="bg-rose-600 hover:bg-rose-700 py-2 rounded-lg flex items-center justify-center gap-1"
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

        <h2 className="text-xl font-semibold flex items-center gap-2 mt-6">
          <Package size={18} /> Products
        </h2>

        {loading ? null : products.length === 0 ? (
          <p className="text-slate-400">No products listed yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {products.map((product) => {
              const paused = (product.stock || 0) <= 0;
              const editing = editingProduct?.id === product.id;
              return (
                <motion.div
                  key={product.id}
                  whileHover={{ scale: 1.01 }}
                  className="p-4 sm:p-5 bg-slate-900 border border-slate-800 rounded-2xl"
                >
                  {editing ? (
                    <div className="space-y-3">
                      <input
                        value={editingProduct.title}
                        onChange={(e) => setEditingProduct({ ...editingProduct, title: e.target.value })}
                        className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="number"
                          value={editingProduct.price}
                          onChange={(e) => setEditingProduct({ ...editingProduct, price: Number(e.target.value) })}
                          className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700"
                        />
                        <input
                          type="number"
                          value={editingProduct.stock}
                          onChange={(e) => setEditingProduct({ ...editingProduct, stock: Number(e.target.value) })}
                          className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700"
                        />
                      </div>
                      <input
                        value={editingProduct.category}
                        onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                        className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700"
                      />
                      <textarea
                        value={editingProduct.description}
                        onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                        className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700"
                      />
                      <select
                        value={editingProduct.delivery_method}
                        onChange={(e) => setEditingProduct({ ...editingProduct, delivery_method: e.target.value })}
                        className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700"
                      >
                        <option value="pickup">pickup</option>
                        <option value="delivery">delivery</option>
                        <option value="both">both</option>
                      </select>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button onClick={saveProductEdit} className="flex-1 bg-indigo-600 rounded-lg py-2 text-sm">
                          Save
                        </button>
                        <button
                          onClick={() => setEditingProduct(null)}
                          className="flex-1 bg-slate-700 rounded-lg py-2 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-lg">{product.title}</h3>
                          <p className="text-xs text-slate-400 mt-1">{product.category || "General"}</p>
                        </div>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            paused ? "bg-amber-900/40 text-amber-300" : "bg-emerald-900/40 text-emerald-300"
                          }`}
                        >
                          {paused ? "Paused" : `Stock ${product.stock || 0}`}
                        </span>
                      </div>
                      <p className="text-slate-400 mt-2 text-sm">{product.description || "No description"}</p>
                      <p className="text-emerald-400 font-bold mt-3">₹ {product.price}</p>

                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                        <button
                          onClick={() =>
                            setEditingProduct({
                              id: product.id,
                              title: product.title,
                              price: product.price,
                              category: product.category || "",
                              description: product.description || "",
                              stock: product.stock || 0,
                              delivery_method: product.delivery_method || "pickup",
                            })
                          }
                          className="bg-slate-800 hover:bg-slate-700 py-2 rounded-lg flex items-center justify-center gap-1"
                        >
                          <Pencil size={14} /> Edit
                        </button>
                        <button
                          disabled={busyId === product.id}
                          onClick={() => toggleProductPaused(product)}
                          className="bg-amber-600 hover:bg-amber-700 py-2 rounded-lg flex items-center justify-center gap-1"
                        >
                          {paused ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
                          {paused ? "Resume" : "Pause"}
                        </button>
                        <button
                          disabled={busyId === product.id}
                          onClick={() => removeProduct(product.id)}
                          className="bg-rose-600 hover:bg-rose-700 py-2 rounded-lg flex items-center justify-center gap-1"
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
    </div>
  );
}
