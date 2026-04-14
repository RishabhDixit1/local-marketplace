"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BadgeIndianRupee, Boxes, ImagePlus, Loader2, Package, Truck } from "lucide-react";
import ProviderControlNav from "@/app/components/provider/ProviderControlNav";
import { createProviderListing } from "@/lib/provider/client";
import {
  PRODUCT_DELIVERY_METHODS,
  resolveListingImageUrl,
  type ProductDeliveryMethod,
} from "@/lib/provider/listings";
import { supabase } from "@/lib/supabase";
import { compressImageFile } from "@/lib/clientImageCompression";
import { LISTING_IMAGE_MAX_BYTES, STORAGE_CACHE_SECONDS, formatUploadLimit } from "@/lib/mediaLimits";

const deliveryOptions = PRODUCT_DELIVERY_METHODS.map((value) => ({
  value,
  label: value === "pickup" ? "Store Pickup" : value === "delivery" ? "Home Delivery" : "Both",
}));

export default function AddProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

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
      let imagePath = form.imageUrl;
      if (imageFile) {
        setUploadingImage(true);
        const preparedImage = (await compressImageFile(imageFile, { maxBytes: LISTING_IMAGE_MAX_BYTES })).file;
        if (preparedImage.size > LISTING_IMAGE_MAX_BYTES) {
          throw new Error(`Image must be ${formatUploadLimit(LISTING_IMAGE_MAX_BYTES)} or smaller after compression.`);
        }
        const ext = preparedImage.name.split(".").pop() || "jpg";
        const filePath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("listing-images")
          .upload(filePath, preparedImage, { contentType: preparedImage.type || "image/jpeg", cacheControl: STORAGE_CACHE_SECONDS, upsert: false });
        if (uploadError) {
          throw new Error(uploadError.message || "Unable to upload image.");
        }
        imagePath = filePath;
      }

      await createProviderListing({
        listingType: "product",
        values: {
          title: form.title,
          description: form.description,
          price: parsedPrice,
          stock: Math.round(parsedStock),
          category: form.category,
          deliveryMethod: form.deliveryMethod,
          imageUrl: imagePath,
        },
      });

      router.push("/dashboard/provider/listings");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to add product right now.");
    } finally {
      setUploadingImage(false);
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
              <Package className="h-3.5 w-3.5" />
              Add product
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">New product listing</h1>
            <p className="mt-1 text-sm text-slate-500">Compact, priced, in stock.</p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {[
              { icon: BadgeIndianRupee, label: "Price" },
              { icon: Boxes, label: "Stock" },
              { icon: Truck, label: "Delivery" },
              { icon: ImagePlus, label: "Image" },
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
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)]">
          <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Basics</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Product title</label>
                <input
                  name="title"
                  placeholder="Cordless Drill Kit"
                  required
                  value={form.title}
                  onChange={handleChange}
                  className={fieldClassName}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Category</label>
                <input
                  name="category"
                  placeholder="Tools"
                  value={form.category}
                  onChange={handleChange}
                  className={fieldClassName}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Description</label>
                <textarea
                  name="description"
                  rows={7}
                  placeholder="Features, condition, warranty, included items."
                  value={form.description}
                  onChange={handleChange}
                  className={fieldClassName}
                />
              </div>
            </div>
          </section>

          <div className="space-y-4">
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Stock + delivery</p>
              <div className="mt-3 grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
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
                    <label className="text-sm font-medium text-slate-700">Stock quantity</label>
                    <input
                      name="stock"
                      type="number"
                      placeholder="10"
                      value={form.stock}
                      onChange={handleChange}
                      className={fieldClassName}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Delivery method</label>
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
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Image</p>
              <div className="mt-3 space-y-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-600 transition hover:border-[var(--brand-500)]/40 hover:text-slate-900">
                  <ImagePlus className="h-4 w-4 shrink-0" />
                  <span>{imageFile ? imageFile.name : "Upload image"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => setImageFile(event.target.files?.[0] || null)}
                    className="sr-only"
                  />
                </label>
                <input
                  name="imageUrl"
                  placeholder="Existing listing-images path"
                  value={form.imageUrl}
                  onChange={handleChange}
                  className={fieldClassName}
                />
                {resolveListingImageUrl(form.imageUrl) ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolveListingImageUrl(form.imageUrl) || ""}
                      alt="Product preview"
                      className="h-20 w-20 rounded-2xl border border-slate-200 object-cover"
                    />
                  </>
                ) : null}
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
          <p className="text-xs font-medium text-slate-500">Image upload stays optional.</p>
          <button
            type="submit"
            disabled={loading || uploadingImage}
            className="inline-flex min-w-[190px] items-center justify-center gap-2 rounded-2xl bg-[var(--brand-900)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {(loading || uploadingImage) ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {uploadingImage ? "Uploading..." : loading ? "Saving..." : "Publish product"}
          </button>
        </div>
      </motion.form>
    </div>
  );
}
