/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { BadgeCheck, LayoutDashboard } from "lucide-react";
import PublicProfileAvatarEdit from "@/app/components/profile/PublicProfileAvatarEdit";
import PublicProfileContentTabs from "@/app/components/profile/PublicProfileContentTabs";
import PublicConnectionsTrigger from "@/app/components/profile/PublicConnectionsTrigger";
import PublicContactInfoTrigger from "@/app/components/profile/PublicContactInfoTrigger";
import PublicProfileActions from "@/app/components/profile/PublicProfileActions";
import { appName, withAppName } from "@/lib/branding";
import { resolveProfileAvatarUrl } from "@/lib/mediaUrl";
import { loadPublicProfileBySlug } from "@/lib/profile/public";
import { toProfileFormValues } from "@/lib/profile/utils";
import { getConfiguredSiteUrl } from "@/lib/siteUrl";

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
  const connectionLabel = formatConnectionsCount(acceptedConnectionCount);
  const joinedShortLabel = formatJoinedDate(profile.created_at).replace(/^Joined\s+/, "");
  const summaryText = headline;
  return (
    <div className="min-h-screen bg-[#f4f2ee] text-slate-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[24px] border border-slate-300/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
          <div className="relative h-[88px] bg-[linear-gradient(90deg,#9fb2b6_0%,#aec0c5_52%,#bed0d5_100%)] sm:h-[132px] lg:h-[156px]">
            <div className="absolute left-[10%] top-[-135%] h-[250px] w-[250px] rounded-full border-[48px] border-white/28 sm:top-[-120%] sm:h-[320px] sm:w-[320px] sm:border-[60px]" />
            <div className="absolute right-[24%] top-0 h-full w-8 bg-white/30 sm:w-12" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0))]" />
            <Link
              href="/dashboard/welcome"
              className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-full bg-white/92 px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-[0_12px_30px_-20px_rgba(15,23,42,0.45)] transition hover:bg-white sm:right-5 sm:top-4 sm:px-4 sm:py-2 sm:text-sm"
            >
              <LayoutDashboard className="h-3.5 w-3.5 text-[#0a66c2] sm:h-4 sm:w-4" />
              Dashboard
            </Link>
          </div>

          <div className="relative px-4 pb-4 sm:px-6 sm:pb-5 lg:px-8 lg:pb-6">
            <div className="-mt-12 min-w-0 sm:-mt-14 lg:-mt-16">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-5">
                <div className="relative w-fit shrink-0">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-[5px] border-white bg-slate-950 text-2xl font-semibold text-white shadow-[0_20px_32px_-24px_rgba(15,23,42,0.48)] sm:h-24 sm:w-24 sm:text-3xl lg:h-28 lg:w-28">
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
                  />
                </div>

                <div className="min-w-0 flex-1 pt-0.5 sm:pt-4 lg:pt-6">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <h1 className="text-[clamp(1.5rem,5.4vw,2.8rem)] font-bold tracking-tight text-slate-950">{displayName}</h1>
                    {verificationStatus === "verified" ? <BadgeCheck className="h-5 w-5 text-[#4b5563] sm:h-6 sm:w-6" /> : null}
                  </div>

                  <p className="mt-1 text-sm text-slate-600 sm:text-base lg:text-[1.2rem]">
                    {getRoleLabel(roleFamily)} <span className="px-1 text-slate-400">•</span> {joinedShortLabel}
                  </p>

                  <p className="mt-1.5 line-clamp-1 text-[0.95rem] leading-[1.3] text-slate-900 sm:mt-2 sm:text-[1.05rem] lg:text-[1.2rem]">
                    {summaryText}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500 sm:text-base">
                    <span>{profile.location || "Location not added"}</span>
                    <span className="text-slate-400" aria-hidden="true">
                      •
                    </span>
                    <PublicContactInfoTrigger
                      displayName={displayName}
                      email={profile.email}
                      phone={profile.phone}
                      website={profile.website}
                      location={profile.location}
                    />
                  </div>

                  <PublicConnectionsTrigger
                    profileUserId={profile.id}
                    label={connectionLabel}
                    connections={acceptedConnections}
                  />

                  <div className="mt-3 sm:mt-4">
                    <PublicProfileActions profileUserId={profile.id} displayName={displayName} initialValues={initialProfileValues} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-4">
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
    </div>
  );
}
