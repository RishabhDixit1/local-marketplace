import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { createBusinessSlug } from "@/lib/business";
import { Store, MapPin, Star } from "lucide-react";

export const metadata: Metadata = buildPageMetadata({
  title: "Business Directory",
  description: "Browse verified local service providers and businesses on ServiQ.",
  path: "/business",
});

type BusinessProfile = {
  id: string;
  name: string | null;
  role: string | null;
  location: string | null;
  services: string[] | null;
  average_rating: number | null;
};

async function getBusinesses(): Promise<BusinessProfile[]> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("profiles")
    .select("id, name, role, location, services, average_rating")
    .not("name", "is", null)
    .order("name", { ascending: true })
    .limit(50);

  return (data ?? []) as BusinessProfile[];
}

export default async function BusinessDirectoryPage() {
  const businesses = await getBusinesses();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Business Directory</h1>
        <p className="mt-2 text-slate-600">
          Browse verified local service providers and businesses on ServiQ.
        </p>
      </div>

      {businesses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-16 text-center">
          <Store className="mb-4 h-12 w-12 text-slate-300" />
          <h2 className="text-lg font-semibold text-slate-500">No businesses yet</h2>
          <p className="mt-1 text-sm text-slate-400">
            Businesses will appear here once they set up their profile.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {businesses.map((b) => (
            <Link
              key={b.id}
              href={`/business/${createBusinessSlug(b.name ?? "business", b.id)}`}
              className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
            >
              <div className="mb-2 flex items-start justify-between">
                <h3 className="font-semibold text-slate-900 group-hover:text-brand-600">
                  {b.name}
                </h3>
                {b.average_rating != null && (
                  <span className="flex items-center gap-1 text-sm text-amber-500">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    {b.average_rating.toFixed(1)}
                  </span>
                )}
              </div>
              {b.role && (
                <p className="mb-1 text-sm text-slate-500">{b.role}</p>
              )}
              {b.location && (
                <p className="mb-2 flex items-center gap-1 text-xs text-slate-400">
                  <MapPin className="h-3 w-3" />
                  {b.location}
                </p>
              )}
              {b.services && b.services.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {b.services.slice(0, 3).map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                    >
                      {s}
                    </span>
                  ))}
                  {b.services.length > 3 && (
                    <span className="text-xs text-slate-400">
                      +{b.services.length - 3} more
                    </span>
                  )}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
