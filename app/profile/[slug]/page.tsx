import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import dynamicImport from "next/dynamic";
import { notFound, permanentRedirect } from "next/navigation";
import { BadgeCheck, LayoutDashboard, MapPin, ArrowLeft } from "lucide-react";
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
import { CartProvider } from "@/app/components/store/CartContext";

const ProviderQuickAddFAB = dynamicImport(
  () => import("@/app/components/profile/ProviderQuickAddFAB").then((m) => ({ default: m.ProviderQuickAddFAB }))
);
const CartDrawer = dynamicImport(
  () => import("@/app/components/store/CartDrawer").then((m) => ({ default: m.CartDrawer }))
);

type Params = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const pickFirst = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const normalizeInitialTab = (value: string | undefined) => {
  if (value === "store" || value === "reviews" || value === "about") return value;
  return "marketplace";
};
const isTruthyQueryValue = (value: string | undefined) =>
  typeof value === "string" && ["1", "true", "yes"].includes(value.trim().toLowerCase());

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

export default async function PublicProfilePage({ params, searchParams }: Params) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
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
  const initialTab = normalizeInitialTab(pickFirst(resolvedSearchParams.tab));
  const requestReviewComposer = isTruthyQueryValue(pickFirst(resolvedSearchParams.writeReview));
  return (
    <CartProvider>
      <div className="min-h-screen bg-[var(--surface-app)] text-[var(--ink-950)]">
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

        <div className="mb-4 flex items-center gap-3">
          <Link
            href="/market"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--surface-border)]/60 bg-[var(--surface-elevated)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-600)] transition hover:border-[var(--brand-300)] hover:text-[var(--brand-700)]"
          >
            <ArrowLeft className="h-3 w-3" /> Back
          </Link>
          <Link
            href="/dashboard"
            className="public-profile-header-action inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-900)] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--brand-800)]"
          >
            <LayoutDashboard className="h-3 w-3" /> Dashboard
          </Link>
        </div>

        <section className="nameplate-hero -mx-4 mb-6 rounded-b-[28px] px-4 pt-10 pb-8 sm:-mx-6 sm:px-6">
          <div className="relative z-10">
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-[var(--brand-900)] shadow-lg ring-2 ring-[var(--surface-border)]/30 sm:h-24 sm:w-24">
                  {profileAvatarUrl ? (
                    <Image src={profileAvatarUrl} alt={displayName} width={96} height={96} quality={70} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-2xl font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>{avatarFallback}</span>
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

              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-normal text-[var(--ink-950)] sm:text-3xl" style={{ fontFamily: "var(--font-display)" }}>{displayName}</h1>
                {verificationStatus === "verified" && (
                  <BadgeCheck className="h-5 w-5 shrink-0 text-[var(--brand-600)]" />
                )}
              </div>

              <p className="mt-1.5 text-sm text-[var(--ink-500)]">
                {getRoleLabel(roleFamily)} <span className="text-[var(--ink-400)]">&middot;</span> {joinedShortLabel}
              </p>

              <p className="mt-2 max-w-lg text-xs leading-relaxed text-[var(--ink-500)]">
                {summaryText}
              </p>

              <div className="nameplate-stat-bar mx-auto mt-5">
                <div className="nameplate-stat-item min-w-0">
                  <MapPin className="h-4 w-4 shrink-0 text-[var(--brand-600)]" />
                  <span className="truncate font-bold text-[var(--ink-950)]">{profile.location || "Nearby"}</span>
                </div>
                <div className="nameplate-stat-item">
                  <BadgeCheck className="h-4 w-4 text-[var(--brand-600)]" />
                  <span className="font-bold text-[var(--ink-950)]">{roleFamily === "provider" ? "Provider" : "Seeker"}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
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
                  className="text-xs font-semibold text-[var(--ink-600)] transition hover:text-[var(--brand-700)]"
                />
              </div>

              <div className="mt-4 public-profile-primary-actions">
                <PublicProfileActions profileUserId={profile.id} displayName={displayName} initialValues={initialProfileValues} />
              </div>
            </div>
          </div>
          <PublicProfileCoverEdit
            profileUserId={profile.id}
            displayName={displayName}
            coverImageUrl={coverImageUrl}
            initialValues={initialProfileValues}
          />
        </section>
        </div>

        <div className="mt-4">
          <div className="mt-6">
            <PublicProfileContentTabs
              bio={profile.bio}
              reviews={publicProfile.reviews}
              averageRating={publicProfile.averageRating}
              reviewCount={publicProfile.reviewCount}
              posts={posts}
              profileUserId={profile.id}
              displayName={displayName}
              avatarUrl={profileAvatarUrl}
              verificationStatus={verificationStatus}
              locationLabel={profile.location || "Nearby"}
              responseMinutes={publicProfile.responseMinutes}
              publicPath={publicPath}
              initialTab={requestReviewComposer ? "reviews" : initialTab}
              requestReviewComposer={requestReviewComposer}
              paymentMethods={publicProfile.paymentMethods}
              workHistory={publicProfile.workHistory}
            />
          </div>
        </div>

        <CartDrawer />
        <ProviderQuickAddFAB show={roleFamily === "provider"} />
      </div>
    </CartProvider>
  );
}
