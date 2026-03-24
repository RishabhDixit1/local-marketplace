/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { BadgeCheck, LayoutDashboard } from "lucide-react";
import PublicProfileAvatarEdit from "@/app/components/profile/PublicProfileAvatarEdit";
import PublicProfileAbout from "@/app/components/profile/PublicProfileAbout";
import PublicConnectionsTrigger from "@/app/components/profile/PublicConnectionsTrigger";
import PublicContactInfoTrigger from "@/app/components/profile/PublicContactInfoTrigger";
import PublicProfileActions from "@/app/components/profile/PublicProfileActions";
import PublicProfilePostsGrid from "@/app/components/profile/PublicProfilePostsGrid";
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
  const sectionCardClassName =
    "rounded-[22px] border border-slate-200 bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] sm:px-6 sm:py-6";

  return (
    <div className="min-h-screen bg-[#f4f2ee] text-slate-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[24px] border border-slate-300/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
          <div className="relative h-[180px] bg-[linear-gradient(90deg,#9fb2b6_0%,#aec0c5_52%,#bed0d5_100%)] sm:h-[220px]">
            <div className="absolute left-[12%] top-[-70%] h-[420px] w-[420px] rounded-full border-[84px] border-white/28" />
            <div className="absolute right-[32%] top-0 h-full w-10 bg-white/30 sm:w-16" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0))]" />
            <Link
              href="/dashboard/welcome"
              className="absolute right-5 top-5 inline-flex items-center gap-2 rounded-full bg-white/92 px-4 py-2 text-sm font-semibold text-slate-900 shadow-[0_12px_30px_-20px_rgba(15,23,42,0.45)] transition hover:bg-white sm:right-6 sm:top-6"
            >
              <LayoutDashboard className="h-4 w-4 text-[#0a66c2]" />
              Dashboard
            </Link>
          </div>

          <div className="relative px-5 pb-7 sm:px-8 lg:px-10">
            <div className="-mt-24 min-w-0">
              <div className="relative w-fit">
                <div className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-full border-[7px] border-white bg-slate-950 text-4xl font-semibold text-white shadow-[0_22px_40px_-26px_rgba(15,23,42,0.48)] sm:h-40 sm:w-40">
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

              <div className="mt-6 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[clamp(2.25rem,5vw,3.45rem)] font-bold tracking-tight text-slate-950">{displayName}</h1>
                  {verificationStatus === "verified" ? <BadgeCheck className="h-8 w-8 text-[#4b5563]" /> : null}
                </div>

                <p className="mt-2 text-xl text-slate-600 sm:text-[1.7rem]">
                  {getRoleLabel(roleFamily)} <span className="px-1.5 text-slate-400">•</span> {joinedShortLabel}
                </p>

                <p className="mt-3 text-[clamp(1.35rem,2.6vw,1.7rem)] leading-[1.28] text-slate-900">{summaryText}</p>

                <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-lg text-slate-500">
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

                <div className="mt-6">
                  <PublicProfileActions profileUserId={profile.id} displayName={displayName} initialValues={initialProfileValues} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-4 space-y-4">
          <section id="details" className={sectionCardClassName}>
            <PublicProfileAbout bio={profile.bio} />
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Marketplace posts</h2>
              <p className="mt-1 text-sm text-slate-600">Latest posts this member has published in the marketplace.</p>
            </div>

            {posts.length > 0 ? (
              <PublicProfilePostsGrid
                posts={posts}
                profileUserId={profile.id}
                displayName={displayName}
                avatarUrl={profileAvatarUrl}
                verificationStatus={verificationStatus}
                locationLabel={profile.location || "Nearby"}
                responseMinutes={publicProfile.responseMinutes}
                publicPath={publicPath}
              />
            ) : (
              <div className="mt-6 rounded-[20px] border border-dashed border-slate-200 bg-[#f8fafc] p-4 text-sm text-slate-500">
                No public posts yet. When this member shares marketplace updates, they will appear here.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
