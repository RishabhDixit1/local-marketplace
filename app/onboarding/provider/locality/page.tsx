"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchAuthedJson } from "@/lib/clientApi";

type Locality = {
  id: string;
  name: string;
  slug: string;
  zone_type: string;
  phase: number;
};

type ServiceCategory = {
  id: string;
  name: string;
  slug: string;
  icon_slug: string;
  description: string;
  base_price_min: number;
  base_price_max: number;
};

export default function ProviderLocalityOnboarding() {
  const router = useRouter();
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [search, setSearch] = useState("");
  const [zoneSearch, setZoneSearch] = useState("");

  const [localityId, setLocalityId] = useState("");
  const [serviceZoneIds, setServiceZoneIds] = useState<string[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [radius, setRadius] = useState(3);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/localities?phase=1").then((r) => r.json()),
      fetch("/api/service-categories").then((r) => r.json()),
    ]).then(([locData, catData]) => {
      if (locData.ok) setLocalities(locData.localities || []);
      if (catData.ok) setCategories(catData.categories || []);
    });
  }, []);

  const filteredLocalities = localities.filter((l) =>
    l.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredZones = localities.filter((l) =>
    l.name.toLowerCase().includes(zoneSearch.toLowerCase()) && l.id !== localityId
  );

  const toggleZone = (id: string) => {
    setServiceZoneIds((prev) =>
      prev.includes(id) ? prev.filter((z) => z !== id) : [...prev, id]
    );
  };

  const toggleCategory = (id: string) => {
    setCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleSubmit = useCallback(async () => {
    if (!localityId) return;
    setSaving(true);
    setError("");
    try {
      const result = await fetchAuthedJson<{ ok: boolean; code?: string; message?: string }>(
        supabase,
        "/api/providers/onboard-locality",
        {
          method: "POST",
          body: JSON.stringify({
            locality_id: localityId,
            service_zone_ids: serviceZoneIds,
            service_category_ids: categoryIds,
            service_area_radius_km: radius,
          }),
        }
      );
      if (result?.ok) {
        router.push("/dashboard/launchpad");
      } else {
        setError(result?.message || "Failed to save");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }, [localityId, serviceZoneIds, categoryIds, radius, router]);

  return (
    <div className="mx-auto min-h-screen w-full max-w-xl px-4 py-10">
      <div className="mb-8">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-100)]">
          <MapPin className="h-6 w-6 text-[var(--brand-700)]" />
        </div>
        <h1 className="text-center text-xl font-bold text-slate-900">Where do you work?</h1>
        <p className="mt-1 text-center text-sm text-slate-500">
          Set your primary service area so customers can find you
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600">
            Primary Locality
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search localities..."
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-[var(--brand-400)] focus:ring-1 focus:ring-[var(--brand-400)]"
          />
          <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-100 bg-white p-1">
            {filteredLocalities.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-slate-400">No localities found</p>
            ) : (
              filteredLocalities.map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => {
                    setLocalityId(loc.id);
                    setSearch(loc.name);
                  }}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                    localityId === loc.id
                      ? "bg-[var(--brand-50)] text-[var(--brand-700)] font-semibold"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {loc.name}
                  <span className="ml-1.5 text-[10px] text-slate-400">
                    {loc.zone_type === "society" ? "Society" : loc.zone_type === "market" ? "Market" : "Area"}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600">
            Other Areas You Serve <span className="text-slate-400">(optional)</span>
          </label>
          <input
            type="text"
            value={zoneSearch}
            onChange={(e) => setZoneSearch(e.target.value)}
            placeholder="Search additional zones..."
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-[var(--brand-400)] focus:ring-1 focus:ring-[var(--brand-400)]"
          />
          <div className="mt-2 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-slate-100 bg-white p-2">
            {filteredZones.length === 0 ? (
              <p className="w-full px-2 py-3 text-center text-xs text-slate-400">
                {zoneSearch ? "No matches" : "Select zones above"}
              </p>
            ) : (
              filteredZones.slice(0, 20).map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => toggleZone(loc.id)}
                  className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-semibold transition ${
                    serviceZoneIds.includes(loc.id)
                      ? "border-[var(--brand-300)] bg-[var(--brand-50)] text-[var(--brand-700)]"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {loc.name}
                </button>
              ))
            )}
          </div>
          {serviceZoneIds.length > 0 && (
            <p className="mt-1 text-[10px] text-slate-400">
              {serviceZoneIds.length} area{serviceZoneIds.length === 1 ? "" : "s"} selected
            </p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600">
            Service Categories
          </label>
          <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto rounded-xl border border-slate-100 bg-white p-3">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggleCategory(cat.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                  categoryIds.includes(cat.id)
                    ? "border-[var(--brand-300)] bg-[var(--brand-50)] text-[var(--brand-700)]"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <span className="text-sm">
                  {cat.icon_slug === "zap" ? "⚡" : cat.icon_slug === "droplets" ? "💧" : cat.icon_slug === "filter" ? "🔍" : cat.icon_slug === "wind" ? "💨" : cat.icon_slug === "flame" ? "🔥" : cat.icon_slug === "wrench" ? "🔧" : "🔨"}
                </span>
                {cat.name}
                <span className="text-[10px] text-slate-400">
                  ₹{cat.base_price_min}–{cat.base_price_max}
                </span>
              </button>
            ))}
          </div>
          {categoryIds.length === 0 && (
            <p className="mt-1 text-[10px] text-slate-400">
              Select at least one service category
            </p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600">
            Service Radius: <span className="text-[var(--brand-700)]">{radius} km</span>
          </label>
          <input
            type="range"
            min={1}
            max={10}
            step={0.5}
            value={radius}
            onChange={(e) => setRadius(parseFloat(e.target.value))}
            className="w-full accent-[var(--brand-900)]"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>1 km</span>
            <span>10 km</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!localityId || categoryIds.length === 0 || saving}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand-900)] px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[var(--brand-800)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Continue"
          )}
        </button>
      </div>
    </div>
  );
}
