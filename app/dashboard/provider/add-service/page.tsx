"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { PlusCircle, Loader2 } from "lucide-react";
import type { ProfileAvailability } from "@/lib/profile/types";
import { createProviderListing } from "@/lib/provider/client";
import {
  PROVIDER_SERVICE_CATEGORIES,
  SERVICE_PRICING_TYPES,
  type ServicePricingType,
} from "@/lib/provider/listings";

const pricingOptions = SERVICE_PRICING_TYPES.map((value) => ({
  value,
  label: `${value[0]?.toUpperCase() || ""}${value.slice(1)}`,
}));

const availabilityOptions: Array<{ value: ProfileAvailability; label: string }> = [
  { value: "available", label: "Available" },
  { value: "busy", label: "Busy" },
  { value: "offline", label: "Offline" },
];

export default function AddServicePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [form, setForm] = useState({
    title: "",
    category: "",
    pricingType: "fixed" as ServicePricingType,
    price: "",
    availability: "available" as ProfileAvailability,
    description: "",
  });

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setLoading(true);

    const parsedPrice = Number(form.price);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setErrorMessage("Price must be a valid non-negative number.");
      setLoading(false);
      return;
    }

    try {
      await createProviderListing({
        listingType: "service",
        values: {
          title: form.title,
          category: form.category,
          pricingType: form.pricingType,
          price: parsedPrice,
          availability: form.availability,
          description: form.description,
        },
      });

      router.push("/dashboard/provider/listings");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to add service right now.");
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
              value={form.title}
              onChange={handleChange}
              className={fieldClassName}
              placeholder="Electrician for home wiring"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Category</label>
            <select name="category" required value={form.category} onChange={handleChange} className={fieldClassName}>
              <option value="">Select category</option>
              {PROVIDER_SERVICE_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Pricing Type</label>
            <select name="pricingType" value={form.pricingType} onChange={handleChange} className={fieldClassName}>
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
              value={form.price}
              onChange={handleChange}
              className={fieldClassName}
              placeholder="500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Availability</label>
            <select name="availability" value={form.availability} onChange={handleChange} className={fieldClassName}>
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
            value={form.description}
            onChange={handleChange}
            rows={4}
            className={fieldClassName}
            placeholder="Explain your service scope, experience, tools, and expected turnaround."
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Tip: specific titles and clear pricing improve match quality and response speed.
        </div>

        {errorMessage ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

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
