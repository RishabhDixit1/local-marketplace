/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { BadgeCheck, Briefcase, Clock3, Globe, MapPin, Phone, Sparkles, Star } from "lucide-react";
import { appName, withAppName } from "@/lib/branding";
import {
  calculateProfileCompletion,
  calculateVerificationStatus,
  createBusinessSlug,
  estimateResponseMinutes,
  extractBusinessIdFromSlug,
  verificationLabel,
} from "@/lib/business";
import { readMarketplaceComposerMetadata } from "@/lib/marketplaceMetadata";
import { resolvePostMediaUrl, resolveProfileAvatarUrl } from "@/lib/mediaUrl";
import type { ProductDeliveryMethod } from "@/lib/provider/listings";
import { getConfiguredSiteUrl } from "@/lib/siteUrl";
import { getServerSupabase } from "@/lib/supabaseServer";
import { CartProvider } from "@/app/components/store/CartContext";

const StoreSection = dynamic(
  () => import("@/app/components/store/StoreSection").then((m) => ({ default: m.StoreSection }))
);
const CartDrawer = dynamic(
  () => import("@/app/components/store/CartDrawer").then((m) => ({ default: m.CartDrawer }))
);

type Params = {
  params: Promise<{ slug: string }>;
};

type ProfileRow = {
  id: string;
  name: string | null;
  role: string | null;
  verification_level?: string | null;
  location: string | null;
  bio: string | null;
  services: string[] | null;
  availability: string | null;
  email: string | null;
  phone: string | null;
  image_url?: string | null;
  website: string | null;
  avatar_url: string | null;
  metadata: Record<string, unknown> | null;
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
  delivery_method?: ProductDeliveryMethod | null;
};

type PostRow = {
  id: string | null;
  title: string | null;
  name: string | null;
  text: string | null;
  content: string | null;
  description: string | null;
  category: string | null;
  type: string | null;
  post_type: string | null;
  status: string | null;
  state: string | null;
  visibility: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  user_id: string | null;
  author_id: string | null;
  created_by: string | null;
  requester_id: string | null;
  owner_id: string | null;
  provider_id: string | null;
};

type ReviewRow = {
  rating: number | null;
  comment: string | null;
};

type RelatedProfileRow = {
  id: string | null;
};

type ProviderOrderStatsRow = {
  provider_id: string;
  completed_jobs: number | string;
  open_leads: number | string;
};

type LaunchpadFaq = {
  question: string;
  answer: string;
};

type LaunchpadMeta = {
  faq: LaunchpadFaq[];
  hours: string | null;
  serviceAreas: string[];
};

type BusinessPost = {
  id: string;
  title: string;
  details: string;
  category: string;
  type: "need" | "service" | "product";
  status: string;
  createdAt: string | null;
  locationLabel: string | null;
  budget: number | null;
  mode: "urgent" | "schedule" | null;
  neededWithin: string | null;
  scheduleDate: string | null;
  scheduleTime: string | null;
  flexibleTiming: boolean;
  imageUrl: string | null;
  attachmentCount: number;
};

const trim = (value: string | null | undefined) => value?.trim() ?? "";
const POST_OWNER_FIELDS = ["user_id", "author_id", "created_by", "requester_id", "owner_id", "provider_id"] as const;

const normalizeBusinessPostType = (value: string | null | undefined): BusinessPost["type"] => {
  const normalized = trim(value).toLowerCase();
  if (normalized === "service") return "service";
  if (normalized === "product") return "product";
  return "need";
};

const readBusinessPostOwnerId = (row: PostRow) =>
  trim(row.user_id || row.author_id || row.created_by || row.requester_id || row.owner_id || row.provider_id);

const readComposedPostParts = (row: PostRow) => {
  const raw = trim(row.text) || trim(row.content) || trim(row.description);
  if (!raw) return [];
  return raw
    .split(" | ")
    .map((part) => part.trim())
    .filter(Boolean);
};

const readComposedValue = (parts: string[], prefix: string) => {
  const match = parts.find((part) => part.toLowerCase().startsWith(prefix.toLowerCase()));
  return match ? match.slice(prefix.length).trim() : "";
};

const isComposedMetaPart = (value: string) =>
  /^(type|mode|needed|budget|category|location|timing|media):/i.test(value.trim());

const readBudgetFromText = (value: string) => {
  const match = value.match(/(\d+(\.\d+)?)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const readBusinessPostImageUrl = (metadata: Record<string, unknown> | null | undefined) => {
  const composerMetadata = readMarketplaceComposerMetadata(metadata);
  if (composerMetadata?.media?.length) {
    return resolvePostMediaUrl(composerMetadata.media[0]?.url || null);
  }

  const gallery = Array.isArray(metadata?.media)
    ? metadata.media
        .map((entry) => {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
          const record = entry as Record<string, unknown>;
          return typeof record.url === "string" ? record.url : null;
        })
        .filter((entry): entry is string => Boolean(entry))
    : [];

  return (
    resolvePostMediaUrl(typeof metadata?.image === "string" ? metadata.image : null) ||
    resolvePostMediaUrl(typeof metadata?.image_url === "string" ? metadata.image_url : null) ||
    resolvePostMediaUrl(gallery[0] || null)
  );
};

const buildPostOwnerFilter = (profileIds: string[]) =>
  profileIds.flatMap((profileId) => POST_OWNER_FIELDS.map((field) => `${field}.eq.${profileId}`)).join(",");

const isPublicBusinessPostVisible = (row: PostRow, profileIds: Set<string>) => {
  const ownerId = readBusinessPostOwnerId(row);
  if (!ownerId || !profileIds.has(ownerId)) return false;

  const visibility = trim(row.visibility).toLowerCase();
  if (["private", "connections", "network", "contacts"].includes(visibility)) return false;

  const status = trim(row.status || row.state).toLowerCase();
  if (["draft", "hidden", "deleted", "archived"].includes(status)) return false;

  return true;
};

const normalizeBusinessPost = (row: PostRow): BusinessPost | null => {
  if (!row.id) return null;

  const parts = readComposedPostParts(row);
  const composerMetadata = readMarketplaceComposerMetadata(row.metadata);
  const title =
    trim(row.title) ||
    trim(row.name) ||
    trim(composerMetadata?.title) ||
    parts[0] ||
    "Marketplace post";
  const detailsFromParts = parts.length > 1 && !isComposedMetaPart(parts[1]) ? parts[1] : "";
  const details =
    trim(composerMetadata?.details) ||
    detailsFromParts ||
    (parts.length === 1 ? parts[0] : "") ||
    "This business shared a public marketplace update.";
  const type = normalizeBusinessPostType(composerMetadata?.postType || row.post_type || row.type);
  const category =
    trim(composerMetadata?.category) ||
    trim(row.category) ||
    readComposedValue(parts, "Category:") ||
    (type === "need" ? "Need" : type === "service" ? "Service" : "Product");
  const budget = composerMetadata?.budget ?? readBudgetFromText(readComposedValue(parts, "Budget:"));
  const locationLabel = trim(composerMetadata?.locationLabel) || readComposedValue(parts, "Location:") || null;
  const rawMode = trim(readComposedValue(parts, "Mode:")).toLowerCase();
  const mode = composerMetadata?.mode || (rawMode === "urgent" || rawMode === "schedule" ? rawMode : null);
  const neededWithin = trim(composerMetadata?.neededWithin) || readComposedValue(parts, "Needed:") || null;

  return {
    id: row.id,
    title,
    details,
    category,
    type,
    status: trim(row.status || row.state).toLowerCase() || "open",
    createdAt: row.created_at || null,
    locationLabel,
    budget,
    mode,
    neededWithin,
    scheduleDate: trim(composerMetadata?.scheduleDate) || null,
    scheduleTime: trim(composerMetadata?.scheduleTime) || null,
    flexibleTiming: Boolean(composerMetadata?.flexibleTiming),
    imageUrl: readBusinessPostImageUrl(row.metadata),
    attachmentCount: Number.isFinite(Number(composerMetadata?.attachmentCount))
      ? Number(composerMetadata?.attachmentCount)
      : composerMetadata?.media?.length || 0,
  };
};

const formatPostDate = (value: string | null) => {
  if (!value) return "Recently posted";

  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: new Date(value).getFullYear() === new Date().getFullYear() ? undefined : "numeric",
    }).format(new Date(value));
  } catch {
    return "Recently posted";
  }
};

const formatPostTypeLabel = (value: BusinessPost["type"]) =>
  value === "need" ? "Need post" : value === "service" ? "Service post" : "Product post";

const formatPostStatusLabel = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "Open";
  return normalized
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() || ""}${part.slice(1)}`)
    .join(" ");
};

const getPostStatusClasses = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (["open", "active", "live"].includes(normalized)) return "bg-emerald-500/15 text-emerald-300";
  if (["completed", "closed", "fulfilled"].includes(normalized)) return "bg-slate-700/60 text-slate-200";
  if (["cancelled", "canceled"].includes(normalized)) return "bg-rose-500/15 text-rose-300";
  return "bg-amber-500/15 text-amber-300";
};

const formatPostTiming = (post: Pick<BusinessPost, "mode" | "neededWithin" | "scheduleDate" | "scheduleTime" | "flexibleTiming">) => {
  if (post.mode === "schedule") {
    if (!post.scheduleDate) {
      return post.flexibleTiming ? "Scheduled, flexible timing" : "Scheduled";
    }

    const parts = [post.scheduleDate];
    if (post.flexibleTiming) {
      parts.push("Flexible time");
    } else if (post.scheduleTime) {
      parts.push(post.scheduleTime);
    }

    return parts.join(" | ");
  }

  return post.neededWithin || null;
};

const readLaunchpadMeta = (value: unknown): LaunchpadMeta => {
  const metadata = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const launchpad =
    metadata.launchpad && typeof metadata.launchpad === "object" && !Array.isArray(metadata.launchpad)
      ? (metadata.launchpad as Record<string, unknown>)
      : {};
  const faq = (Array.isArray(launchpad.faq) ? launchpad.faq : [])
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const question = typeof record.question === "string" ? record.question.trim() : "";
      const answer = typeof record.answer === "string" ? record.answer.trim() : "";
      if (!question || !answer) return null;
      return { question, answer };
    })
    .filter((item): item is LaunchpadFaq => !!item)
    .slice(0, 6);
  const serviceAreas = (Array.isArray(launchpad.serviceAreas) ? launchpad.serviceAreas : [])
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);

  return {
    faq,
    hours: typeof launchpad.hours === "string" && launchpad.hours.trim() ? launchpad.hours.trim() : null,
    serviceAreas,
  };
};

const loadBusiness = cache(async (slug: string) => {
  const businessId = extractBusinessIdFromSlug(slug);
  if (!businessId) return null;

  const supabase = getServerSupabase();
  if (!supabase) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,name,role,verification_level,location,bio,services,availability,email,phone,website,avatar_url,metadata")
    .eq("id", businessId)
    .maybeSingle<ProfileRow>();

  if (!profile) return null;
  const normalizedProfile: ProfileRow = {
    ...profile,
    avatar_url: resolveProfileAvatarUrl(profile.avatar_url),
  };
  const relatedProfileResults = await Promise.all(
    [normalizedProfile.phone ? supabase.from("profiles").select("id").eq("phone", normalizedProfile.phone) : null,
    normalizedProfile.email ? supabase.from("profiles").select("id").eq("email", normalizedProfile.email) : null].filter(Boolean)
  );
  const relatedProfileIds = Array.from(
    new Set([
      businessId,
      ...relatedProfileResults.flatMap((result) => ((result?.data as RelatedProfileRow[] | null) || []).map((row) => trim(row.id))),
    ].filter(Boolean))
  );
  const relatedProfileIdSet = new Set(relatedProfileIds);

  const [{ data: services }, { data: products }, { data: reviews }, { data: posts }, { data: providerOrderStats }] =
    await Promise.all([
      supabase
        .from("service_listings")
        .select("id,title,category,price,availability")
        .eq("provider_id", businessId)
        .limit(8),
      supabase
        .from("product_catalog")
        .select("id,title,category,price,stock,image_url,delivery_method")
        .eq("provider_id", businessId)
        .limit(8),
      supabase.from("reviews").select("rating,comment").eq("provider_id", businessId).limit(10),
      supabase
        .from("posts")
        .select(
          "id,title,name,text,content,description,category,type,post_type,status,state,visibility,metadata,created_at,user_id,author_id,created_by,requester_id,owner_id,provider_id"
        )
        .or(buildPostOwnerFilter(relatedProfileIds))
        .order("created_at", { ascending: false })
        .limit(12),
      supabase.rpc("get_provider_order_stats", { provider_ids: [businessId] }),
    ]);

  const safeServices = (services as ServiceRow[] | null) || [];
  const safeProducts = (products as ProductRow[] | null) || [];
  const safeReviews = (reviews as ReviewRow[] | null) || [];
  const safePosts = ((posts as PostRow[] | null) || [])
    .filter((row) => isPublicBusinessPostVisible(row, relatedProfileIdSet))
    .map((row) => normalizeBusinessPost(row))
    .filter((row): row is BusinessPost => !!row);
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
    verificationLevel: normalizedProfile.verification_level,
    profileCompletion,
    listingsCount: safeServices.length + safeProducts.length,
    averageRating,
    reviewCount: safeReviews.length,
    completedJobs: providerStatsRows.length > 0 ? Number(providerStatsRows[0].completed_jobs || 0) : 0,
  });

  const completedJobs = providerStatsRows.length > 0 ? Number(providerStatsRows[0].completed_jobs || 0) : 0;
  const launchpadMeta = readLaunchpadMeta(normalizedProfile.metadata);

  return {
    profile: normalizedProfile,
    services: safeServices,
    products: safeProducts,
    posts: safePosts,
    reviews: safeReviews,
    averageRating,
    profileCompletion,
    responseMinutes,
    verificationStatus,
    completedJobs,
    launchpadMeta,
    canonicalSlug: createBusinessSlug(normalizedProfile.name, normalizedProfile.id),
  };
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const business = await loadBusiness(slug);

  if (!business) {
    return {
      title: withAppName("Business Not Found"),
      description: "The requested business profile is not available.",
    };
  }

  const siteUrl = getConfiguredSiteUrl();
  const profileUrl = `${siteUrl}/business/${business.canonicalSlug}`;
  const title = withAppName(business.profile.name || "Local Business");
  const description =
    business.profile.bio?.slice(0, 160) ||
    `Explore services and products from ${business.profile.name || "this local business"} on ${appName}.`;

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
      siteName: appName,
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
    posts,
    reviews,
    averageRating,
    profileCompletion,
    responseMinutes,
    verificationStatus,
    completedJobs,
    launchpadMeta,
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
    <CartProvider>
      <CartDrawer />
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
          <StatCard label="Jobs Done" value={completedJobs} icon={<BadgeCheck size={16} />} />
          <StatCard label="Rating" value={averageRating || "New"} icon={<Star size={16} />} />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <StoreSection
              services={services}
              products={products}
              providerId={profile.id}
              providerName={profile.name || ""}
              providerAvailability={profile.availability || "available"}
            />

            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Public Posts</h2>
                  <p className="text-sm text-slate-400">
                    Public marketplace posts from this business and its linked public profile appear here automatically.
                  </p>
                </div>
              </div>

              {posts.length > 0 ? (
                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  {posts.map((post) => {
                    const timingLabel = formatPostTiming(post);

                    return (
                      <article
                        key={post.id}
                        className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950"
                      >
                        {post.imageUrl ? (
                          <div className="relative aspect-[16/9] overflow-hidden bg-slate-900">
                            <img src={post.imageUrl} alt={post.title} className="h-full w-full object-cover" />
                          </div>
                        ) : null}

                        <div className="p-4 sm:p-5">
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide">
                            <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-slate-300">
                              {formatPostTypeLabel(post.type)}
                            </span>
                            <span className={`rounded-full px-3 py-1 ${getPostStatusClasses(post.status)}`}>
                              {formatPostStatusLabel(post.status)}
                            </span>
                            <span className="text-slate-500">{formatPostDate(post.createdAt)}</span>
                          </div>

                          <h3 className="mt-4 text-lg font-semibold leading-7 text-white">{post.title}</h3>
                          <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-300">{post.details}</p>

                          <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-slate-300">
                            <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5">
                              {post.category}
                            </span>

                            {post.budget !== null ? (
                              <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5">
                                Rs. {post.budget.toLocaleString()}
                              </span>
                            ) : null}

                            {post.locationLabel ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5">
                                <MapPin size={12} className="text-slate-500" />
                                {post.locationLabel}
                              </span>
                            ) : null}

                            {timingLabel ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5">
                                <Clock3 size={12} className="text-slate-500" />
                                {timingLabel}
                              </span>
                            ) : null}

                            {post.attachmentCount > 0 ? (
                              <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5">
                                {post.attachmentCount} attachment{post.attachmentCount === 1 ? "" : "s"}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
                  No public posts published yet.
                </div>
              )}
            </section>

            {(launchpadMeta.serviceAreas.length > 0 || launchpadMeta.faq.length > 0) && (
              <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <h2 className="text-lg font-semibold">Business Details</h2>

                {launchpadMeta.serviceAreas.length > 0 ? (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Service Areas</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {launchpadMeta.serviceAreas.map((area) => (
                        <span key={area} className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-semibold text-slate-200">
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {launchpadMeta.faq.length > 0 ? (
                  <div className="mt-5 grid gap-3">
                    {launchpadMeta.faq.map((item) => (
                      <div key={item.question} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                        <p className="text-sm font-semibold text-white">{item.question}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">{item.answer}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            )}
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
                <p>{launchpadMeta.hours || "Hours shared on request"}</p>
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
    </CartProvider>
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
