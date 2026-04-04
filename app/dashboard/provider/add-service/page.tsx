"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BadgeIndianRupee, Clock3, LayoutGrid, Loader2, PlusCircle, Sparkles } from "lucide-react";
import ProviderControlNav from "@/app/components/provider/ProviderControlNav";
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
    "mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-400)]/20";

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-4">
      <ProviderControlNav />

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[1.75rem] border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
              <PlusCircle className="h-3.5 w-3.5" />
              Add service
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">New service listing</h1>
            <p className="mt-1 text-sm text-slate-500">Compact, local, bookable.</p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {[
              { icon: Sparkles, label: "Discover" },
              { icon: BadgeIndianRupee, label: "Price" },
              { icon: Clock3, label: "Availability" },
              { icon: LayoutGrid, label: "Category" },
            ].map((chip) => (
              <div
                key={chip.label}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600"
              >
                <chip.icon className="h-3.5 w-3.5" />
                {chip.label}
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.72fr)]">
          <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Basics</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Service title</label>
                <input
                  name="title"
                  required
                  value={form.title}
                  onChange={handleChange}
                  className={fieldClassName}
                  placeholder="Electrician for home wiring"
                />
              </div>

              <div className="sm:col-span-2">
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

              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Description</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={7}
                  className={fieldClassName}
                  placeholder="Scope, tools, turnaround."
                />
              </div>
            </div>
          </section>

          <div className="space-y-4">
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Pricing</p>
              <div className="mt-3 grid gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Pricing type</label>
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
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Checks</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">Specific title</span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">Clear price</span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">Ready today</span>
              </div>
            </section>
          </div>
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-xs font-medium text-slate-500">Publishes directly to your storefront.</p>
          <button
            disabled={loading}
            className="inline-flex min-w-[190px] items-center justify-center gap-2 rounded-2xl bg-[var(--brand-900)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Saving..." : "Publish service"}
          </button>
        </div>
      </motion.form>
    </div>
  );
}
