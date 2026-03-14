import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { ReactNode } from "react";
import { BadgeCheck, Briefcase, Clock3, Globe, MapPin, Phone, Star } from "lucide-react";
import {
  calculateProfileCompletion,
  calculateVerificationStatus,
  createBusinessSlug,
  estimateResponseMinutes,
  extractBusinessIdFromSlug,
  verificationLabel,
} from "@/lib/business";
import { resolveProfileAvatarUrl } from "@/lib/mediaUrl";
import { getConfiguredSiteUrl } from "@/lib/siteUrl";
import { getServerSupabase } from "@/lib/supabaseServer";

type Params = {
  params: Promise<{ slug: string }>;
};

type ProfileRow = {
  id: string;
  name: string | null;
  role: string | null;
  location: string | null;
  bio: string | null;
  services: string[] | null;
  availability: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  avatar_url: string | null;
};

type ServiceRow = {
  id: string;
  title: string | null;
  category: string | null;
  price: number | null;
  availability: string | null;
};

type ProductRow = {
  id: string;
  title: string | null;
  category: string | null;
  price: number | null;
  stock: number | null;
};

type ReviewRow = {
  rating: number | null;
  comment: string | null;
};

type ProviderOrderStatsRow = {
  provider_id: string;
  completed_jobs: number | string;
  open_leads: number | string;
};

const loadBusiness = cache(async (slug: string) => {
  const businessId = extractBusinessIdFromSlug(slug);
  if (!businessId) return null;

  const supabase = getServerSupabase();
  if (!supabase) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,name,role,location,bio,services,availability,email,phone,website,avatar_url")
    .eq("id", businessId)
    .maybeSingle<ProfileRow>();

  if (!profile) return null;
  const normalizedProfile: ProfileRow = {
    ...profile,
    avatar_url: resolveProfileAvatarUrl(profile.avatar_url),
  };

  const [{ data: services }, { data: products }, { data: reviews }, { data: providerOrderStats }] = await Promise.all([
    supabase
      .from("service_listings")
      .select("id,title,category,price,availability")
      .eq("provider_id", businessId)
      .limit(8),
    supabase
      .from("product_catalog")
      .select("id,title,category,price,stock")
      .eq("provider_id", businessId)
      .limit(8),
    supabase.from("reviews").select("rating,comment").eq("provider_id", businessId).limit(10),
    supabase.rpc("get_provider_order_stats", { provider_ids: [businessId] }),
  ]);

  const safeServices = (services as ServiceRow[] | null) || [];
  const safeProducts = (products as ProductRow[] | null) || [];
  const safeReviews = (reviews as ReviewRow[] | null) || [];
  const providerStatsRows = (providerOrderStats as ProviderOrderStatsRow[] | null) || [];

  const ratingValues = safeReviews
    .map((review) => Number(review.rating))
    .filter((rating) => Number.isFinite(rating) && rating > 0);
  const averageRating = ratingValues.length
    ? Number((ratingValues.reduce((sum, rating) => sum + rating, 0) / ratingValues.length).toFixed(1))
    : 0;

  const profileCompletion = calculateProfileCompletion({
    name: normalizedProfile.name,
    location: normalizedProfile.location,
    bio: normalizedProfile.bio,
    services: normalizedProfile.services,
    email: normalizedProfile.email,
    phone: normalizedProfile.phone,
    website: normalizedProfile.website,
  });

  const responseMinutes = estimateResponseMinutes({
    availability: normalizedProfile.availability,
    providerId: normalizedProfile.id,
  });

  const verificationStatus = calculateVerificationStatus({
    role: normalizedProfile.role,
    profileCompletion,
    listingsCount: safeServices.length + safeProducts.length,
    averageRating,
    reviewCount: safeReviews.length,
  });

  const activeLeads = providerStatsRows.length > 0 ? Number(providerStatsRows[0].open_leads || 0) : 0;

  return {
    profile: normalizedProfile,
    services: safeServices,
    products: safeProducts,
    reviews: safeReviews,
    averageRating,
    profileCompletion,
    responseMinutes,
    verificationStatus,
    activeLeads,
    canonicalSlug: createBusinessSlug(normalizedProfile.name, normalizedProfile.id),
  };
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const business = await loadBusiness(slug);

  if (!business) {
    return {
      title: "Business Not Found | Local Marketplace",
      description: "The requested business profile is not available.",
    };
  }

  const siteUrl = getConfiguredSiteUrl();
  const profileUrl = `${siteUrl}/business/${business.canonicalSlug}`;
  const title = `${business.profile.name || "Local Business"} | Local Marketplace`;
  const description =
    business.profile.bio?.slice(0, 160) ||
    `Explore services and products from ${business.profile.name || "this local business"} on Local Marketplace.`;

  return {
    title,
    description,
    alternates: {
      canonical: profileUrl,
    },
    openGraph: {
      title,
      description,
      url: profileUrl,
      siteName: "Local Marketplace",
      type: "website",
      images: business.profile.avatar_url ? [{ url: business.profile.avatar_url }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: business.profile.avatar_url ? [business.profile.avatar_url] : undefined,
    },
  };
}

export default async function BusinessProfilePage({ params }: Params) {
  const { slug } = await params;
  const business = await loadBusiness(slug);

  if (!business) notFound();

  const {
    profile,
    services,
    products,
    reviews,
    averageRating,
    profileCompletion,
    responseMinutes,
    verificationStatus,
    activeLeads,
    canonicalSlug,
  } = business;

  const siteUrl = getConfiguredSiteUrl();
  const profileUrl = `${siteUrl}/business/${canonicalSlug}`;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: profile.name || "Local Business",
    description: profile.bio || "Local business profile",
    address: profile.location || undefined,
    url: profileUrl,
    telephone: profile.phone || undefined,
    email: profile.email || undefined,
    aggregateRating:
      reviews.length > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: averageRating,
            reviewCount: reviews.length,
          }
        : undefined,
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-black text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-indigo-500/30 bg-gradient-to-r from-indigo-600/30 via-fuchsia-600/20 to-cyan-600/20 p-6 sm:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-white/10 px-3 py-1 uppercase tracking-wide">
                  {profile.role || "provider"}
                </span>
                <span
                  className={`rounded-full px-3 py-1 ${
                    verificationStatus === "verified"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : verificationStatus === "pending"
                      ? "bg-amber-500/20 text-amber-300"
                      : "bg-slate-600/30 text-slate-200"
                  }`}
                >
                  {verificationLabel(verificationStatus)}
                </span>
              </div>

              <h1 className="text-3xl font-bold sm:text-4xl">{profile.name || "Local Business"}</h1>
              <p className="mt-2 text-sm text-slate-200 sm:text-base">
                {profile.bio || "Serving nearby customers with trusted local expertise."}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-200">
                <span className="inline-flex items-center gap-1">
                  <MapPin size={14} />
                  {profile.location || "Nearby"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock3 size={14} />
                  ~{responseMinutes} min response
                </span>
                <span className="inline-flex items-center gap-1">
                  <Star size={14} className="text-amber-400" />
                  {averageRating || "New"} ({reviews.length} reviews)
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/20 bg-black/30 p-4 text-sm">
              <p className="text-slate-300">Business Profile Score</p>
              <p className="text-3xl font-bold text-white">{profileCompletion}%</p>
              <p className="mt-2 text-slate-300">{verificationLabel(verificationStatus)}</p>
              <Link
                href="/dashboard"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500"
              >
                Explore Marketplace
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Services" value={services.length} icon={<Briefcase size={16} />} />
          <StatCard label="Products" value={products.length} icon={<BadgeCheck size={16} />} />
          <StatCard label="Active Leads" value={activeLeads} icon={<Clock3 size={16} />} />
          <StatCard label="Rating" value={averageRating || "New"} icon={<Star size={16} />} />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <h2 className="text-lg font-semibold">Services</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {services.length === 0 && <p className="text-sm text-slate-400">No services published yet.</p>}
                {services.map((service) => (
                  <div key={service.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <p className="font-semibold">{service.title || "Untitled Service"}</p>
                    <p className="mt-1 text-xs text-slate-400">{service.category || "Service"}</p>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="font-semibold text-indigo-300">₹ {Number(service.price || 0).toLocaleString()}</span>
                      <span className="text-slate-400 capitalize">{service.availability || "available"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <h2 className="text-lg font-semibold">Products</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {products.length === 0 && <p className="text-sm text-slate-400">No products published yet.</p>}
                {products.map((product) => (
                  <div key={product.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <p className="font-semibold">{product.title || "Untitled Product"}</p>
                    <p className="mt-1 text-xs text-slate-400">{product.category || "Product"}</p>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="font-semibold text-indigo-300">₹ {Number(product.price || 0).toLocaleString()}</span>
                      <span className="text-slate-400">{(product.stock || 0) > 0 ? "In stock" : "Out of stock"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <h2 className="text-lg font-semibold">Contact</h2>
              <div className="mt-3 space-y-3 text-sm text-slate-300">
                {profile.website ? (
                  <a href={profile.website} className="inline-flex items-center gap-2 text-indigo-300 hover:text-indigo-200">
                    <Globe size={14} /> {profile.website}
                  </a>
                ) : (
                  <p className="text-slate-400">Website not added</p>
                )}
                <p className="inline-flex items-center gap-2">
                  <Phone size={14} />
                  {profile.phone || "Phone not added"}
                </p>
                <p>{profile.email || "Email not added"}</p>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <h2 className="text-lg font-semibold">Recent Reviews</h2>
              <div className="mt-3 space-y-3">
                {reviews.length === 0 && <p className="text-sm text-slate-400">No reviews yet.</p>}
                {reviews.slice(0, 4).map((review, index) => (
                  <div key={`review-${index}`} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                    <p className="text-amber-300 text-sm">{"★".repeat(Math.max(1, Number(review.rating || 0)))}</p>
                    <p className="mt-1 text-sm text-slate-300">{review.comment || "Customer left a rating."}</p>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <p className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
        {icon}
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
