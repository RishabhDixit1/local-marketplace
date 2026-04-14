"use client";

import Image from "next/image";
import { ExternalLink, Image as ImageIcon, Sparkles } from "lucide-react";
import type { MarketplacePortfolioRecord } from "@/lib/profile/marketplace";

export default function PortfolioSection({ portfolio }: { portfolio: MarketplacePortfolioRecord[] }) {
  return (
    <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-lg shadow-slate-200/50 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Proof</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Portfolio</h2>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
          <Sparkles className="h-3.5 w-3.5" />
          {portfolio.length} items
        </div>
      </div>

      {portfolio.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {portfolio.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50">
              <div className="relative aspect-[16/10] bg-slate-200">
                {item.media_url ? (
                  <Image
                    src={item.media_url}
                    alt={item.title}
                    fill
                    sizes="(max-width: 768px) 92vw, 360px"
                    quality={72}
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-500">
                    <ImageIcon className="h-10 w-10" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold tracking-tight text-slate-950">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.category || "Portfolio item"}</p>
                  </div>
                  {item.link_url ? (
                    <a
                      href={item.link_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:text-slate-950"
                    >
                      Open
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.description || "Project details will show here."}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
          No portfolio items added yet.
        </div>
      )}
    </section>
  );
}
