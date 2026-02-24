"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { PlusCircle, Loader2 } from "lucide-react";

export default function AddServicePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    title: "",
    category: "",
    pricing_type: "fixed",
    price: "",
    availability: "available",
    description: "",
  });

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // 🔐 Get logged in provider
  const getUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user;
  };

  // 🚀 Submit Service
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setLoading(true);

    const user = await getUser();

    if (!user) {
      alert("You must be logged in");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("service_listings").insert([
      {
        provider_id: user.id,
        title: form.title,
        category: form.category,
        pricing_type: form.pricing_type,
        price: Number(form.price),
        availability: form.availability,
        description: form.description,
      },
    ]);

    setLoading(false);

    if (error) {
      alert("Error adding service");
      console.log(error);
      return;
    }

    alert("Service Added Successfully 🎉");

    router.push("/dashboard/provider/listings");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6">
      <div className="max-w-3xl mx-auto">

        {/* HEADER */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <PlusCircle /> Add New Service
          </h1>
          <p className="text-slate-400">
            List services you provide to customers nearby.
          </p>
        </motion.div>

        {/* FORM CARD */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 space-y-5"
        >

          {/* TITLE */}
          <div>
            <label className="text-sm text-slate-300">Service Title</label>
            <input
              name="title"
              required
              onChange={handleChange}
              className="w-full mt-1 p-3 rounded-xl bg-slate-900 border border-slate-700 text-white"
              placeholder="Electrician for home wiring"
            />
          </div>

          {/* CATEGORY */}
          <div>
            <label className="text-sm text-slate-300">Category</label>
            <select
              name="category"
              required
              onChange={handleChange}
              className="w-full mt-1 p-3 rounded-xl bg-slate-900 border border-slate-700 text-white"
            >
              <option value="">Select category</option>
              <option>Electrician</option>
              <option>Plumber</option>
              <option>Cleaning</option>
              <option>Delivery</option>
              <option>Tutor</option>
              <option>Repair</option>
            </select>
          </div>

          {/* PRICING */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-300">Pricing Type</label>
              <select
                name="pricing_type"
                onChange={handleChange}
                className="w-full mt-1 p-3 rounded-xl bg-slate-900 border border-slate-700 text-white"
              >
                <option value="fixed">Fixed</option>
                <option value="hourly">Hourly</option>
                <option value="negotiable">Negotiable</option>
              </select>
            </div>

            <div>
              <label className="text-sm text-slate-300">Price (₹)</label>
              <input
                name="price"
                required
                type="number"
                onChange={handleChange}
                className="w-full mt-1 p-3 rounded-xl bg-slate-900 border border-slate-700 text-white"
                placeholder="500"
              />
            </div>
          </div>

          {/* AVAILABILITY */}
          <div>
            <label className="text-sm text-slate-300">Availability</label>
            <select
              name="availability"
              onChange={handleChange}
              className="w-full mt-1 p-3 rounded-xl bg-slate-900 border border-slate-700 text-white"
            >
              <option value="available">Available</option>
              <option value="busy">Busy</option>
              <option value="offline">Offline</option>
            </select>
          </div>

          {/* DESCRIPTION */}
          <div>
            <label className="text-sm text-slate-300">Description</label>
            <textarea
              name="description"
              onChange={handleChange}
              rows={4}
              className="w-full mt-1 p-3 rounded-xl bg-slate-900 border border-slate-700 text-white"
              placeholder="Explain your service, experience, tools, etc."
            />
          </div>

          {/* SUBMIT */}
          <button
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 transition rounded-xl text-white font-semibold flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" /> : "Add Service"}
          </button>
        </motion.form>
      </div>
    </div>
  );
}
