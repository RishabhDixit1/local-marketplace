"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { PlusCircle, Loader2 } from "lucide-react";

const serviceCategories = ["Electrician", "Plumber", "Cleaning", "Delivery", "Tutor", "Repair"];

const pricingOptions = [
  { value: "fixed", label: "Fixed" },
  { value: "hourly", label: "Hourly" },
  { value: "negotiable", label: "Negotiable" },
];

const availabilityOptions = [
  { value: "available", label: "Available" },
  { value: "busy", label: "Busy" },
  { value: "offline", label: "Offline" },
];

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

    alert("Service added successfully.");

    router.push("/dashboard/provider/listings");
  };

  const fieldClassName =
    "w-full mt-1.5 rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

  return (
    <div className="w-full max-w-[2200px] mx-auto space-y-5 sm:space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 p-5 sm:p-7 text-white shadow-lg"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <PlusCircle className="h-7 w-7" /> Add New Service
            </h1>
            <p className="mt-2 text-white/90">
              Publish your expertise so nearby customers can discover and book you quickly.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
            <div className="rounded-xl border border-white/30 bg-white/15 px-3 py-2">Faster local discovery</div>
            <div className="rounded-xl border border-white/30 bg-white/15 px-3 py-2">Trust-first profile</div>
            <div className="rounded-xl border border-white/30 bg-white/15 px-3 py-2">Clear pricing</div>
            <div className="rounded-xl border border-white/30 bg-white/15 px-3 py-2">Lead-ready listing</div>
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
            <label className="text-sm font-medium text-slate-700">Service Title</label>
            <input
              name="title"
              required
              onChange={handleChange}
              className={fieldClassName}
              placeholder="Electrician for home wiring"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Category</label>
            <select name="category" required onChange={handleChange} className={fieldClassName}>
              <option value="">Select category</option>
              {serviceCategories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Pricing Type</label>
            <select name="pricing_type" onChange={handleChange} className={fieldClassName}>
              {pricingOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Price (INR)</label>
            <input
              name="price"
              required
              type="number"
              onChange={handleChange}
              className={fieldClassName}
              placeholder="500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Availability</label>
            <select name="availability" onChange={handleChange} className={fieldClassName}>
              {availabilityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Description</label>
          <textarea
            name="description"
            onChange={handleChange}
            rows={4}
            className={fieldClassName}
            placeholder="Explain your service scope, experience, tools, and expected turnaround."
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Tip: specific titles and clear pricing improve match quality and response speed.
        </div>

        <button
          disabled={loading}
          className="w-full sm:w-auto min-w-[220px] px-6 py-3 bg-indigo-600 hover:bg-indigo-500 transition-colors rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="animate-spin" /> : "Add Service"}
        </button>
      </motion.form>
    </div>
  );
}
