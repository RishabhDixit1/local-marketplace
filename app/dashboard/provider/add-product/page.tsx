"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Package, Loader2 } from "lucide-react";
import { createProviderListing } from "@/lib/provider/client";
import {
  PRODUCT_DELIVERY_METHODS,
  type ProductDeliveryMethod,
} from "@/lib/provider/listings";

const deliveryOptions = PRODUCT_DELIVERY_METHODS.map((value) => ({
  value,
  label: value === "pickup" ? "Store Pickup" : value === "delivery" ? "Home Delivery" : "Both",
}));

export default function AddProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    stock: "",
    category: "",
    deliveryMethod: "pickup" as ProductDeliveryMethod,
    imageUrl: "",
  });

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setErrorMessage("");

    const parsedPrice = Number(form.price);
    const parsedStock = Number(form.stock || 0);

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setErrorMessage("Price must be a valid non-negative number.");
      setLoading(false);
      return;
    }

    if (!Number.isFinite(parsedStock) || parsedStock < 0) {
      setErrorMessage("Stock must be a valid non-negative number.");
      setLoading(false);
      return;
    }

    try {
      await createProviderListing({
        listingType: "product",
        values: {
          title: form.title,
          description: form.description,
          price: parsedPrice,
          stock: Math.round(parsedStock),
          category: form.category,
          deliveryMethod: form.deliveryMethod,
          imageUrl: form.imageUrl,
        },
      });

      router.push("/dashboard/provider/listings");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to add product right now.");
    } finally {
      setLoading(false);
    }
  };

  const fieldClassName =
    "w-full mt-1.5 rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

  return (
    <div className="w-full max-w-[2200px] mx-auto space-y-5 sm:space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-600 p-5 sm:p-7 text-white shadow-lg"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Package className="h-7 w-7" /> Add Product Listing
            </h1>
            <p className="mt-2 text-white/90">
              Showcase products with clear pricing and stock so nearby buyers can discover them quickly.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
            <div className="rounded-xl border border-white/30 bg-white/15 px-3 py-2">Higher visibility</div>
            <div className="rounded-xl border border-white/30 bg-white/15 px-3 py-2">Clear inventory</div>
            <div className="rounded-xl border border-white/30 bg-white/15 px-3 py-2">Delivery choices</div>
            <div className="rounded-xl border border-white/30 bg-white/15 px-3 py-2">Fast local reach</div>
          </div>
        </div>
      </motion.section>

      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm space-y-5"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Product Title</label>
            <input
              name="title"
              placeholder="Cordless Drill Kit"
              required
              value={form.title}
              onChange={handleChange}
              className={fieldClassName}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Category</label>
            <input
              name="category"
              placeholder="Tools"
              value={form.category}
              onChange={handleChange}
              className={fieldClassName}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Price (INR)</label>
            <input
              name="price"
              type="number"
              placeholder="1499"
              required
              value={form.price}
              onChange={handleChange}
              className={fieldClassName}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Stock Quantity</label>
            <input
              name="stock"
              type="number"
              placeholder="10"
              value={form.stock}
              onChange={handleChange}
              className={fieldClassName}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Delivery Method</label>
            <select
              name="deliveryMethod"
              value={form.deliveryMethod}
              onChange={handleChange}
              className={fieldClassName}
            >
              {deliveryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Product Image URL</label>
            <input
              name="imageUrl"
              placeholder="https://..."
              value={form.imageUrl}
              onChange={handleChange}
              className={fieldClassName}
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Description</label>
          <textarea
            name="description"
            rows={4}
            placeholder="Describe features, condition, warranty, and what is included."
            value={form.description}
            onChange={handleChange}
            className={fieldClassName}
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Tip: include clear product titles and real photos to improve conversion.
        </div>

        {errorMessage ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full sm:w-auto min-w-[220px] px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-colors text-white font-semibold flex justify-center items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading && <Loader2 className="animate-spin" />}
          List Product
        </button>
      </motion.form>
    </div>
  );
}
