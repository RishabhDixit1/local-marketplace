"use client";

import { Package2, Tag } from "lucide-react";
import type { MarketplaceProductRecord } from "@/lib/profile/marketplace";

const formatMoney = (value: number | null) => {
  if (!Number.isFinite(Number(value)) || !value) return "Contact for pricing";
  return `INR ${Number(value).toLocaleString("en-IN")}`;
};

export default function ProductsSection({ products }: { products: MarketplaceProductRecord[] }) {
  return (
    <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-lg shadow-slate-200/50 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Store</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Products</h2>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
          <Package2 className="h-3.5 w-3.5" />
          {products.length} items
        </div>
      </div>

      {products.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <article key={product.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold tracking-tight text-slate-950">{product.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{product.category || "Product"}</p>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm">
                  {product.delivery_mode}
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">{product.description || "Product details will show here."}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {product.area ? (
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
                    {product.area}
                  </span>
                ) : null}
                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
                  <Tag className="mr-1 inline-block h-3 w-3 align-[-1px]" />
                  {formatMoney(product.price)}
                </span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
                  Stock {product.stock}
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
          No products added yet.
        </div>
      )}
    </section>
  );
}
