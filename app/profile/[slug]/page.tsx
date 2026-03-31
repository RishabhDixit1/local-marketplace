/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import dynamicImport from "next/dynamic";
import { notFound, permanentRedirect } from "next/navigation";
import { BadgeCheck, LayoutDashboard, MapPin } from "lucide-react";
import PublicProfileAvatarEdit from "@/app/components/profile/PublicProfileAvatarEdit";
import PublicProfileCoverEdit from "@/app/components/profile/PublicProfileCoverEdit";
import PublicProfileContentTabs from "@/app/components/profile/PublicProfileContentTabs";
import PublicConnectionsTrigger from "@/app/components/profile/PublicConnectionsTrigger";
import PublicContactInfoTrigger from "@/app/components/profile/PublicContactInfoTrigger";
import PublicProfileActions from "@/app/components/profile/PublicProfileActions";
import { appName, withAppName } from "@/lib/branding";
import { resolveProfileAvatarUrl } from "@/lib/mediaUrl";
import { loadPublicProfileBySlug } from "@/lib/profile/public";
import { toProfileFormValues } from "@/lib/profile/utils";
import { getConfiguredSiteUrl } from "@/lib/siteUrl";
import { getServerSupabase } from "@/lib/supabaseServer";
import { CartProvider } from "@/app/components/store/CartContext";

const StoreSection = dynamicImport(
  () => import("@/app/components/store/StoreSection").then((m) => ({ default: m.StoreSection }))
);
const ProviderQuickAddFAB = dynamicImport(
  () => import("@/app/components/profile/ProviderQuickAddFAB").then((m) => ({ default: m.ProviderQuickAddFAB }))
);
const CartDrawer = dynamicImport(
  () => import("@/app/components/store/CartDrawer").then((m) => ({ default: m.CartDrawer }))
);

type Params = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

const formatJoinedDate = (value: string | null) => {
  if (!value) return "New member";

  try {
    return `Joined ${new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(value))}`;
  } catch {
    return "New member";
  }
};

const formatConnectionsCount = (value: number) => {
  if (value >= 500) return "500+ connections";
  if (value > 0) return `${value.toLocaleString("en-IN")} connection${value === 1 ? "" : "s"}`;
  return "Open to new connections";
};

const getRoleLabel = (roleFamily: "provider" | "seeker") =>
  roleFamily === "provider" ? "Marketplace provider" : "Looking for services";

const getHeadline = (params: {
  roleFamily: "provider" | "seeker";
  topics: string[];
  bio: string | null;
}) => {
  if (params.roleFamily === "provider") {
    return params.topics.length
      ? `${params.topics.slice(0, 3).join(" • ")}`
      : "Open for local discovery, direct messages, and nearby work.";
  }

  if (params.topics.length) {
    return `Looking for ${params.topics.slice(0, 3).join(", ")} nearby.`;
  }

  return params.bio || "Open to local providers, recommendations, and direct coordination.";
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const publicProfile = await loadPublicProfileBySlug(slug);

  if (!publicProfile) {
    return {
      title: withAppName("Profile Not Found"),
      description: "The requested member profile is not available.",
    };
  }

  const siteUrl = getConfiguredSiteUrl();
  const profileUrl = `${siteUrl}${publicProfile.publicPath}`;
  const title = withAppName(publicProfile.displayName);
  const profileAvatarUrl = resolveProfileAvatarUrl(publicProfile.profile.avatar_url);
  const description =
    publicProfile.profile.bio?.slice(0, 160) ||
    `${publicProfile.displayName} is active on ${appName}. View profile details, contact info, and marketplace activity.`;

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
      type: "profile",
      images: profileAvatarUrl ? [{ url: profileAvatarUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: profileAvatarUrl ? [profileAvatarUrl] : undefined,
    },
  };
}

export default async function PublicProfilePage({ params }: Params) {
  const { slug } = await params;
  const publicProfile = await loadPublicProfileBySlug(slug);

  if (!publicProfile) {
    notFound();
  }

  if (slug !== publicProfile.canonicalSlug) {
    permanentRedirect(publicProfile.publicPath);
  }

  const {
    profile,
    displayName,
    roleFamily,
    acceptedConnectionCount,
    acceptedConnections,
    topics,
    posts,
    verificationStatus,
    publicPath,
  } = publicProfile;

  // Fetch services and products for store section
  let services: Array<{ id: string; title: string | null; category: string | null; price: number | null; availability: string | null }> = [];
  let products: Array<{ id: string; title: string | null; category: string | null; price: number | null; stock: number | null }> = [];
  
  if (roleFamily === "provider") {
    const supabase = getServerSupabase();
    if (supabase) {
      const [{ data: svcData }, { data: prodData }] = await Promise.all([
        supabase
          .from("service_listings")
          .select("id,title,category,price,availability")
          .eq("provider_id", profile.id)
          .limit(8),
        supabase
          .from("product_catalog")
          .select("id,title,category,price,stock")
          .eq("provider_id", profile.id)
          .limit(8),
      ]);
      services = (svcData as typeof services) || [];
      products = (prodData as typeof products) || [];
    }
  }

  const siteUrl = getConfiguredSiteUrl();
  const profileUrl = `${siteUrl}${publicPath}`;
  const headline = getHeadline({
    roleFamily,
    topics,
    bio: profile.bio,
  });
  const structuredData =
    roleFamily === "provider"
      ? {
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          name: displayName,
          description: profile.bio || headline,
          address: profile.location || undefined,
          url: profileUrl,
          email: profile.email || undefined,
          telephone: profile.phone || undefined,
        }
      : {
          "@context": "https://schema.org",
          "@type": "Person",
          name: displayName,
          description: profile.bio || headline,
          address: profile.location || undefined,
          url: profileUrl,
          email: profile.email || undefined,
        };
  const avatarFallback = displayName
    .split(" ")
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const profileAvatarUrl = resolveProfileAvatarUrl(profile.avatar_url);
  const initialProfileValues = toProfileFormValues(profile);
  const coverImageUrl = initialProfileValues.backgroundImageUrl;
  const connectionLabel = formatConnectionsCount(acceptedConnectionCount);
  const joinedShortLabel = formatJoinedDate(profile.created_at).replace(/^Joined\s+/, "");
  const summaryText = headline;
  return (
    <CartProvider>
      <div className="min-h-screen bg-[#f4f2ee] text-slate-950">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

        <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8">
        <style>{`
          @keyframes profile-cover-drift {
            0% { transform: scale(1.04) translate3d(0%, 0%, 0); }
            50% { transform: scale(1.08) translate3d(-1.2%, -1%, 0); }
            100% { transform: scale(1.05) translate3d(1.2%, 1%, 0); }
          }
          body[data-public-profile-modal-open="true"] .public-profile-header-action,
          body[data-public-profile-modal-open="true"] .public-profile-avatar-trigger,
          body[data-public-profile-modal-open="true"] .public-profile-primary-actions {
            opacity: 0 !important;
            pointer-events: none !important;
          }
        `}</style>
        <section className="relative h-[25svh] min-h-[240px] max-h-[320px] overflow-hidden rounded-[28px] border border-slate-300/30 bg-[linear-gradient(125deg,#eff6ff_0%,#dbeafe_24%,#c7d2fe_58%,#e0e7ff_100%)] text-white shadow-[0_24px_70px_-35px_rgba(15,23,42,0.55)]">
          {coverImageUrl ? (
            <img
              src={coverImageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover will-change-transform motion-safe:[animation:profile-cover-drift_18s_ease-in-out_infinite]"
            />
          ) : null}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(125,211,252,0.55),transparent_28%),radial-gradient(circle_at_82%_14%,rgba(99,102,241,0.45),transparent_28%),radial-gradient(circle_at_74%_82%,rgba(148,163,184,0.28),transparent_26%),linear-gradient(140deg,rgba(255,255,255,0.22),transparent_24%,rgba(255,255,255,0.12)_24%,transparent_38%,rgba(255,255,255,0.08)_38%,transparent)]" />
          <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(15,23,42,0.28),rgba(30,41,59,0.08),rgba(15,23,42,0.62))]" />
          <div className="absolute inset-y-0 left-[30%] w-[28%] rotate-[16deg] bg-white/14 blur-[2px]" />
          <div className="absolute inset-y-0 right-[16%] w-[32%] -rotate-[20deg] bg-sky-200/12 blur-[2px]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(15,23,42,0.8),rgba(15,23,42,0.16),transparent)]" />

          <Link
            href="/dashboard"
            className="public-profile-header-action absolute right-3 top-3 z-20 inline-flex h-7 max-w-[calc(50%-1rem)] items-center gap-1 rounded-full border border-white/20 bg-white/12 px-2.5 text-[10px] font-semibold text-white shadow-[0_12px_30px_-20px_rgba(15,23,42,0.45)] backdrop-blur-md transition hover:bg-white/20 sm:right-5 sm:top-4 sm:h-9 sm:max-w-none sm:gap-1.5 sm:px-3.5 sm:text-xs"
          >
            <LayoutDashboard className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span className="truncate">Dashboard</span>
          </Link>
          <PublicProfileCoverEdit
            profileUserId={profile.id}
            displayName={displayName}
            coverImageUrl={coverImageUrl}
            initialValues={initialProfileValues}
          />

          <div className="relative z-10 h-full p-4 sm:p-5 lg:p-6">
            <div className="relative flex h-full flex-col justify-end">
              <div className="absolute left-0 top-11 sm:top-12">
                <div className="relative w-fit shrink-0">
                  <div className="flex h-18 w-18 items-center justify-center overflow-hidden rounded-full border-[4px] border-white/90 bg-slate-950 text-xl font-semibold text-white shadow-[0_20px_32px_-24px_rgba(15,23,42,0.48)] sm:h-20 sm:w-20 sm:text-2xl">
                    {profileAvatarUrl ? (
                      <img src={profileAvatarUrl} alt={displayName} className="h-full w-full object-cover" />
                    ) : (
                      <span>{avatarFallback}</span>
                    )}
                  </div>
                  <PublicProfileAvatarEdit
                    profileUserId={profile.id}
                    displayName={displayName}
                    avatarUrl={profileAvatarUrl || ""}
                    initialValues={initialProfileValues}
                    triggerMode="image"
                  />
                </div>
              </div>

              <div className="min-w-0 pl-[4.75rem] pt-2 sm:pl-[5.5rem] sm:pt-3">
                <div className="mt-1 flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <h1 className="max-w-full truncate text-[clamp(1rem,2.8vw,1.6rem)] font-bold tracking-tight text-white">{displayName}</h1>
                  {verificationStatus === "verified" ? <BadgeCheck className="h-4.5 w-4.5 shrink-0 text-sky-200 sm:h-5 sm:w-5" /> : null}
                </div>

                <p className="mt-0.5 text-[11px] text-white/82 sm:text-xs">
                  {getRoleLabel(roleFamily)} <span className="px-1 text-white/45">•</span> {joinedShortLabel}
                </p>

                <p className="mt-1 line-clamp-1 text-[11px] leading-[1.3] text-white/92 sm:text-xs">
                  {summaryText}
                </p>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/78 sm:text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-white/60" />
                    {profile.location || "Location not added"}
                  </span>
                  <PublicContactInfoTrigger
                    displayName={displayName}
                    email={profile.email}
                    phone={profile.phone}
                    website={profile.website}
                    location={profile.location}
                  />
                  <PublicConnectionsTrigger
                    profileUserId={profile.id}
                    label={connectionLabel}
                    connections={acceptedConnections}
                    className="text-[11px] text-white/78 transition hover:text-white sm:text-xs"
                  />
                </div>

                <div className="mt-2">
                  <PublicProfileActions profileUserId={profile.id} displayName={displayName} initialValues={initialProfileValues} />
                </div>
              </div>
            </div>
          </div>
        </section>
        </div>

        <div className="mt-4">
          {roleFamily === "provider" && (services.length > 0 || products.length > 0) && (
            <StoreSection
              services={services}
              products={products}
              providerId={profile.id}
              providerName={displayName}
              providerAvailability={profile.availability || "available"}
            />
          )}

          <div className="mt-6">
            <PublicProfileContentTabs
              bio={profile.bio}
              reviews={publicProfile.reviews}
              averageRating={publicProfile.averageRating}
              reviewCount={publicProfile.reviewCount}
              posts={posts}
              manualOfferings={publicProfile.manualOfferings}
              profileUserId={profile.id}
              displayName={displayName}
              avatarUrl={profileAvatarUrl}
              verificationStatus={verificationStatus}
              locationLabel={profile.location || "Nearby"}
              responseMinutes={publicProfile.responseMinutes}
              publicPath={publicPath}
            />
          </div>
        </div>

        <CartDrawer />
        <ProviderQuickAddFAB />
      </div>
    </CartProvider>
  );
}
