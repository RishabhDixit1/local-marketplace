"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { Package, Loader2 } from "lucide-react";

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

// Handle Input
const handleChange = (
e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
) => {
setForm({ ...form, [e.target.name]: e.target.value });
};

// Submit
const handleSubmit = async (e: React.FormEvent) => {
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

const { error } = await supabase.from("product_catalog").insert([
  {
    provider_id: user.id,
    title: form.title,
    description: form.description,
    price: Number(form.price),
    stock: Number(form.stock),
    category: form.category,
    delivery_method: form.delivery_method,
    image_url: form.image_url,
  },
]);

setLoading(false);

if (error) {
  alert(error.message);
} else {
  alert("Product Listed Successfully 🚀");
  router.push("/dashboard/provider/listings");
}
};

return (
<div className="min-h-screen bg-gradient-to-b from-slate-950 to-black text-white p-6">
<motion.div
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl"
>
{/* Header */}
<div className="flex items-center gap-3 mb-6">
<Package className="text-indigo-400" />
<h1 className="text-2xl font-bold">Add Product Listing</h1>
</div>

{/* Form */}
<form onSubmit={handleSubmit} className="space-y-5">
{/* Title */}
<input
name="title"
placeholder="Product Title"
required
onChange={handleChange}
className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800"
/>

{/* Description */}
<textarea
name="description"
placeholder="Product Description"
onChange={handleChange}
className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800"
/>

{/* Price + Stock */}
<div className="grid grid-cols-2 gap-4">
<input
name="price"
type="number"
placeholder="Price ₹"
required
onChange={handleChange}
className="p-3 rounded-xl bg-slate-950 border border-slate-800"
/>

<input
name="stock"
type="number"
placeholder="Stock Qty"
onChange={handleChange}
className="p-3 rounded-xl bg-slate-950 border border-slate-800"
/>
</div>

{/* Category */}
<input
name="category"
placeholder="Category"
onChange={handleChange}
className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800"
/>

{/* Delivery */}
<select
name="delivery_method"
onChange={handleChange}
className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800"
>
<option value="pickup">Store Pickup</option>
<option value="delivery">Home Delivery</option>
<option value="both">Both</option>
</select>

{/* Image */}
<input
name="image_url"
placeholder="Product Image URL"
onChange={handleChange}
className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800"
/>

{/* Submit */}
<button
type="submit"
disabled={loading}
className="w-full p-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-semibold flex justify-center items-center gap-2"
>
{loading && <Loader2 className="animate-spin" />}
List Product
</button>
</form>
</motion.div>
</div>
);
}
