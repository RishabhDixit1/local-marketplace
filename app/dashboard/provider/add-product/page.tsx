"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { Package, Loader2 } from "lucide-react";

const deliveryOptions = [
  { value: "pickup", label: "Store Pickup" },
  { value: "delivery", label: "Home Delivery" },
  { value: "both", label: "Both" },
];

export default function AddProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    stock: "",
    category: "",
    delivery_method: "pickup",
    image_url: "",
  });

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("User not logged in");
      setLoading(false);
      return;
    }

    const productDescription = [
      form.description.trim(),
      form.category.trim() ? `Category: ${form.category.trim()}` : "",
      form.image_url.trim() ? `Image: ${form.image_url.trim()}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    const { error } = await supabase.from("product_catalog").insert([
      {
        provider_id: user.id,
        name: form.title.trim(),
        description: productDescription || null,
        price: Number(form.price),
        stock: form.stock ? Number(form.stock) : 0,
        delivery_method: form.delivery_method,
      },
    ]);

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Product listed successfully.");
    router.push("/dashboard/provider/listings");
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
              onChange={handleChange}
              className={fieldClassName}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Category</label>
            <input
              name="category"
              placeholder="Tools"
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
              onChange={handleChange}
              className={fieldClassName}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Delivery Method</label>
            <select name="delivery_method" onChange={handleChange} className={fieldClassName}>
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
              name="image_url"
              placeholder="https://..."
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
            onChange={handleChange}
            className={fieldClassName}
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Tip: include clear product titles and real photos to improve conversion.
        </div>

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
