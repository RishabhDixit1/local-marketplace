import Link from "next/link";
import Image from "next/image";
import { MapPin, Store, Users, ArrowRight } from "lucide-react";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { notFound } from "next/navigation";
import { getConfiguredSiteUrl } from "@/lib/siteUrl";
import { appName } from "@/lib/branding";

interface PageProps {
  params: Promise<{ society: string; category: string }>;
}

const CATEGORY_LABELS: Record<string, string> = {
  electrician: "Electrician",
  plumber: "Plumber",
  "ro-water-purifier-repair": "RO / Water Purifier Repair",
  "ac-repair-service": "AC Repair & Service",
  "geyser-repair": "Geyser Repair",
  "appliance-repair": "Appliance Repair",
  "carpenter-minor-fitting": "Carpenter / Minor Fitting",
  "tailoring-and-alterations": "Tailoring & Alterations",
  "clothing-and-fashion": "Clothing & Fashion",
};

async function getData(societySlug: string, categorySlug: string) {
  const db = createSupabaseAdminClient();
  if (!db) return null;

  const [localityRes, categoryRes] = await Promise.all([
    db.from("localities").select("*, market_zones(name)").eq("slug", societySlug).eq("zone_type", "society").maybeSingle(),
    db.from("service_categories").select("*").eq("slug", categorySlug).maybeSingle(),
  ]);

  const locality = localityRes.data;
  const category = categoryRes.data;
  if (!locality || !category) return null;

  const zoneName = (locality as Record<string, unknown> & { market_zones?: { name: string } | null }).market_zones?.name || null;

  const { data: providers } = await db
    .from("profiles")
    .select("id, full_name, name, location, avatar_url, bio")
    .eq("role", "provider")
    .eq("locality_id", locality.id)
    .contains("services", [category.name])
    .limit(20);

  const { data: allLocalities } = await db
    .from("localities")
    .select("*")
    .eq("zone_type", "society")
    .order("name");

  return { locality, category, zoneName, providers: providers || [], allLocalities: allLocalities || [] };
}

export async function generateMetadata({ params }: PageProps) {
  const { society, category } = await params;
  const data = await getData(society, category);
  const catName = CATEGORY_LABELS[category] || category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const siteUrl = getConfiguredSiteUrl();

  if (!data) {
    return {
      title: `${catName} - ${appName}`,
      openGraph: { title: `${catName} - ${appName}`, description: `Find trusted ${catName.toLowerCase()} service providers near you.` },
      twitter: { card: "summary_large_image", title: `${catName} - ${appName}`, description: `Find trusted ${catName.toLowerCase()} service providers near you.` },
    };
  }

  const areaName = data.zoneName || data.locality.name;
  const title = `${catName} in ${data.locality.name}, ${areaName} - ${appName}`;
  const description = `Find trusted ${catName.toLowerCase()} service providers in ${data.locality.name}, ${areaName}. Book verified local professionals near you.`;
  const url = `${siteUrl}/market/${society}/${category}`;
  const ogImage = [{ url: `${siteUrl}/api/og?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description.slice(0, 100))}` }];

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: appName, type: "website", images: ogImage },
    twitter: { card: "summary_large_image", title, description, images: ogImage },
  };
}

export default async function SocietyCategoryPage({ params }: PageProps) {
  const { society, category } = await params;
  const data = await getData(society, category);

  if (!data) { notFound(); }

  const areaName = data.zoneName || data.locality.name;
  const catName = CATEGORY_LABELS[category] || category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-20 pt-6 sm:px-6 sm:pt-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Service",
            name: `${catName} in ${data.locality.name}`,
            areaServed: {
              "@type": "City",
              name: `${data.locality.name}, ${areaName}`,
            },
            provider: {
              "@type": "LocalBusiness",
              name: "ServiQ",
              url: "https://www.serviqapp.com",
            },
          }),
        }}
      />

      <section className="text-center mb-10">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand-100)]">
          <Store className="h-8 w-8 text-[var(--brand-700)]" />
        </div>
        <h1 className="text-3xl font-normal text-[var(--ink-950)] sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
          {catName} in{" "}
          <span className="text-[var(--brand-700)]">{data.locality.name}</span>
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-[var(--ink-500)]">
          Find trusted {catName.toLowerCase()} service providers in {data.locality.name}, {areaName}.
        </p>

        <div className="mx-auto mt-6 inline-flex items-center gap-4 divide-x divide-[var(--surface-border)] rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-2.5 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-700)] tabular-nums">
            <Users className="h-3.5 w-3.5 text-[var(--brand-600)]" />
            {data.providers.length} {catName} providers
          </div>
          <div className="flex items-center gap-1.5 pl-4 text-xs font-semibold text-[var(--ink-700)]">
            <MapPin className="h-3.5 w-3.5 text-[var(--brand-600)]" />
            {data.locality.name}, {areaName}
          </div>
        </div>

        <div className="mx-auto mt-6 flex max-w-md gap-3">
          <a
            href="#providers"
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--brand-900)] px-5 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[var(--brand-800)]"
          >
            <Users className="h-4 w-4" />
            Browse Providers
          </a>
          <Link
            href={`/market/${society}`}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-3 text-sm font-bold text-[var(--ink-700)] transition hover:border-[var(--border-strong)]"
          >
            <ArrowRight className="h-4 w-4" />
            Back to Society
          </Link>
        </div>
      </section>

      {data.providers.length > 0 ? (
        <section id="providers">
          <h2 className="mb-4 text-xl font-normal text-[var(--ink-950)]" style={{ fontFamily: "var(--font-display)" }}>
            {catName} Providers in {data.locality.name}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.providers.map((p) => (
              <Link
                key={p.id}
                href={`/profile/${p.id}`}
                className="nameplate-card flex flex-col overflow-hidden p-4 pt-6"
              >
                <div className="flex items-center gap-3">
                  {p.avatar_url ? (
                    <Image
                      src={p.avatar_url}
                      alt={p.full_name || p.name || "Provider"}
                      width={40}
                      height={40}
                      className="h-10 w-10 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand-100)] text-sm font-semibold text-[var(--brand-700)]">
                      {(p.full_name || p.name || "?")[0]}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-[var(--ink-950)]">{p.full_name || p.name}</h3>
                    <p className="truncate text-xs text-[var(--ink-500)]">{p.location || data.locality.name}</p>
                  </div>
                </div>
                {p.bio && <p className="mt-2 line-clamp-2 text-xs text-[var(--ink-700)]">{p.bio}</p>}
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-[var(--surface-border)] bg-[var(--surface-soft)]/50 p-10 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-[var(--ink-500)]" />
          <p className="text-sm font-semibold text-[var(--ink-700)]">No {catName.toLowerCase()} providers in {data.locality.name} yet</p>
          <p className="mt-1 text-xs text-[var(--ink-500)]">Check back soon or browse other societies.</p>
        </section>
      )}

      <section className="mt-10">
        <div className="mb-4">
          <h2 className="text-xl font-normal text-[var(--ink-950)]" style={{ fontFamily: "var(--font-display)" }}>Other Societies in {areaName}</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.allLocalities.filter((l) => l.id !== data.locality.id).slice(0, 6).map((l) => (
            <Link
              key={l.id}
              href={`/market/${l.slug}/${category}`}
              className="nameplate-card block p-4 pt-6"
            >
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[var(--ink-500)]" />
                <span className="text-sm font-semibold text-[var(--ink-950)]">{l.name}</span>
              </div>
              <span className="mt-1.5 inline-flex items-center text-xs text-[var(--brand-700)]">
                Find {catName.toLowerCase()} <ArrowRight className="ml-1 h-3 w-3" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <footer className="mt-12 border-t border-[var(--surface-border)] pt-8 text-center">
        <p className="text-xs text-[var(--ink-500)]">
          ServiQ — {areaName}&apos;s local marketplace &middot; {catName} in {data.locality.name}
        </p>
      </footer>
    </div>
  );
}
