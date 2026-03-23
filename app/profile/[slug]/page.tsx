/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  BadgeCheck,
  BriefcaseBusiness,
  Clock3,
  Globe,
  LayoutDashboard,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  UserRound,
} from "lucide-react";
import PublicProfileActions from "@/app/components/profile/PublicProfileActions";
import PublicProfileRealtime from "@/app/components/profile/PublicProfileRealtime";
import { appName, withAppName } from "@/lib/branding";
import { verificationLabel } from "@/lib/business";
import { resolveProfileAvatarUrl } from "@/lib/mediaUrl";
import { loadPublicProfileBySlug } from "@/lib/profile/public";
import { getConfiguredSiteUrl } from "@/lib/siteUrl";

type Params = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

const formatPrice = (value: number | null) => (typeof value === "number" ? `₹ ${value.toLocaleString()}` : "Custom quote");

const formatJoinedDate = (value: string | null) => {
  if (!value) return "New member";

  try {
    return `Joined ${new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(value))}`;
  } catch {
    return "New member";
  }
};

const formatAvailability = (value: string | null) => {
  const normalized = (value || "").toLowerCase();
  if (normalized === "busy") return "Busy but reachable";
  if (normalized === "offline") return "Offline right now";
  return "Available now";
};

const getRoleLabel = (roleFamily: "provider" | "seeker") =>
  roleFamily === "provider" ? "Marketplace provider" : "Looking for services";

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

const formatPostTypeLabel = (value: "need" | "service" | "product") =>
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
  if (["open", "active", "live"].includes(normalized)) return "bg-emerald-50 text-emerald-700";
  if (["completed", "closed", "fulfilled"].includes(normalized)) return "bg-slate-100 text-slate-600";
  if (["cancelled", "canceled"].includes(normalized)) return "bg-rose-50 text-rose-700";
  return "bg-amber-50 text-amber-700";
};

const formatPostTiming = (post: {
  mode: "urgent" | "schedule" | null;
  neededWithin: string | null;
  scheduleDate: string | null;
  scheduleTime: string | null;
  flexibleTiming: boolean;
}) => {
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

const getAccessHref = (params: {
  roleFamily: "provider" | "seeker";
  hasOfferings: boolean;
  hasPosts: boolean;
}) => {
  if (params.roleFamily === "provider" && params.hasOfferings) {
    return "#offerings";
  }

  if (params.hasPosts) {
    return "#posts";
  }

  return "#details";
};

const getAccessLabel = (params: {
  roleFamily: "provider" | "seeker";
  hasOfferings: boolean;
  hasPosts: boolean;
}) => {
  if (params.roleFamily === "provider") {
    if (params.hasOfferings) return "Access offerings";
    if (params.hasPosts) return "Access posts";
    return "Access profile";
  }

  return params.hasPosts ? "Access posts" : "Access details";
};

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
    topics,
    services,
    products,
    offerings,
    posts,
    reviews,
    averageRating,
    reviewCount,
    serviceCount,
    productCount,
    postsCount,
    activeOrders,
    responseMinutes,
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
  const accessHref = getAccessHref({
    roleFamily,
    hasOfferings: offerings.length > 0,
    hasPosts: posts.length > 0,
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
  const heroMetrics =
    roleFamily === "provider"
      ? [
          { label: "Services", value: serviceCount },
          { label: "Products", value: productCount },
          { label: "Rating", value: averageRating ? `${averageRating}★` : "New" },
          { label: "Response", value: `~${responseMinutes} min` },
        ]
      : [
          { label: "Interests", value: topics.length },
          { label: "Need posts", value: postsCount },
          { label: "Active orders", value: activeOrders },
          { label: "Profile score", value: `${profile.profile_completion_percent}%` },
        ];
  const avatarFallback = displayName
    .split(" ")
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const profileAvatarUrl = resolveProfileAvatarUrl(profile.avatar_url);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef2ff_0%,#f8fafc_32%,#f8fafc_100%)] text-slate-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <section className="overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)]">
          <div className="relative h-48 bg-[linear-gradient(120deg,#0f172a_0%,#1d4ed8_38%,#7c3aed_68%,#ec4899_100%)] sm:h-52 lg:h-56">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.28),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.14),transparent_42%)]" />
            <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/90 sm:left-8 sm:top-7">
              <Sparkles className="h-3.5 w-3.5" />
              Public profile
            </div>
            <div className="absolute right-5 top-5 sm:right-8 sm:top-7">
              <Link
                href="/dashboard/welcome"
                className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold text-white/90 transition hover:bg-white/15"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                Dashboard
              </Link>
            </div>
          </div>

          <div className="relative px-5 pb-8 sm:px-8">
            <div className="-mt-16 grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_360px] xl:items-start">
              <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                  <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-[28px] border-[6px] border-white bg-slate-950 text-3xl font-semibold text-white shadow-lg shadow-slate-950/15">
                    {profileAvatarUrl ? (
                      <img src={profileAvatarUrl} alt={displayName} className="h-full w-full object-cover" />
                    ) : (
                      <span>{avatarFallback}</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        {getRoleLabel(roleFamily)}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                          verificationStatus === "verified"
                            ? "bg-emerald-50 text-emerald-700"
                            : verificationStatus === "pending"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        <BadgeCheck className="h-3.5 w-3.5" />
                        {verificationLabel(verificationStatus)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {formatJoinedDate(profile.created_at)}
                      </span>
                    </div>

                    <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-[2.75rem]">{displayName}</h1>
                    <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">{headline}</p>

                    <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2">
                        <MapPin className="h-4 w-4 text-slate-500" />
                        {profile.location || "Location not added"}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2">
                        <Clock3 className="h-4 w-4 text-slate-500" />
                        {formatAvailability(profile.availability)}
                      </span>
                      {roleFamily === "provider" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2">
                          <Star className="h-4 w-4 text-amber-500" />
                          {averageRating ? `${averageRating} from ${reviewCount} reviews` : "New provider profile"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {heroMetrics.map((metric) => (
                    <div key={metric.label} className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{metric.label}</p>
                      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{metric.value}</p>
                    </div>
                  ))}
                </div>
              </section>

              <aside className="space-y-6">
                <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Profile actions</p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Connect, message, and explore</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Everything important is reachable from here without leaving the profile.
                      </p>
                    </div>
                    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Public
                    </span>
                  </div>

                  <div className="mt-4">
                    <PublicProfileRealtime profileId={profile.id} roleFamily={roleFamily} />
                  </div>

                  <div className="mt-5">
                    <PublicProfileActions
                      profileUserId={profile.id}
                      accessHref={accessHref}
                      accessLabel={getAccessLabel({
                        roleFamily,
                        hasOfferings: offerings.length > 0,
                        hasPosts: posts.length > 0,
                      })}
                      contactHref="#contact"
                    />
                  </div>
                </section>
              </aside>
            </div>
          </div>
        </section>

        <div className="mt-8 space-y-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section id="details" className="flex h-full flex-col rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-slate-950">About</h2>
                  <p className="text-sm text-slate-600">Public summary taken directly from the saved profile.</p>
                </div>
              </div>

              <p className="mt-6 text-base leading-8 text-slate-700">
                {profile.bio || "This member has not added a longer public summary yet."}
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <MetaCard label="Profile mode" value={getRoleLabel(roleFamily)} />
                <MetaCard label="Member since" value={formatJoinedDate(profile.created_at)} />
                <MetaCard
                  label={roleFamily === "provider" ? "Discovery topics" : "Active interests"}
                  value={topics.length ? `${topics.length} tags live` : "Tags coming soon"}
                />
                <MetaCard label="Current status" value={formatAvailability(profile.availability)} />
              </div>
            </section>

            <section id="contact" className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-slate-950">Contact & access</h2>
                  <p className="text-sm text-slate-600">Everything this member has chosen to show publicly right now.</p>
                </div>
              </div>

              <div className="mt-6 space-y-4 text-sm">
                <ContactRow
                  icon={<Mail className="h-4 w-4" />}
                  label="Email"
                  value={profile.email || "Email not added"}
                  href={profile.email ? `mailto:${profile.email}` : undefined}
                />
                <ContactRow
                  icon={<Phone className="h-4 w-4" />}
                  label="Phone"
                  value={profile.phone || "Phone not added"}
                  href={profile.phone ? `tel:${profile.phone}` : undefined}
                />
                <ContactRow
                  icon={<Globe className="h-4 w-4" />}
                  label="Website"
                  value={profile.website || "Website not added"}
                  href={profile.website || undefined}
                />
                <ContactRow
                  icon={<MapPin className="h-4 w-4" />}
                  label="Location"
                  value={profile.location || "Location not added"}
                />
              </div>
            </section>
          </div>

          <section id="offerings" className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                {roleFamily === "provider" ? <BriefcaseBusiness className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                  {roleFamily === "provider" ? "Services & offerings" : "Needs & interests"}
                </h2>
                <p className="text-sm text-slate-600">
                  {roleFamily === "provider"
                    ? "These are the topics and listings this member is using for local discovery."
                    : "These are the interests and service categories this member wants others to notice."}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2.5">
              {topics.length > 0 ? (
                topics.map((topic) => (
                  <span
                    key={topic}
                    className="rounded-full border border-indigo-100 bg-indigo-50 px-3.5 py-2 text-sm font-medium text-indigo-700"
                  >
                    {topic}
                  </span>
                ))
              ) : (
                <p className="text-sm text-slate-500">No tags added yet.</p>
              )}
            </div>

            {roleFamily === "provider" ? (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {[...services, ...products].slice(0, 6).map((item) => (
                  <article key={`${item.type}-${item.id}`} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                        <p className="mt-1 text-sm text-slate-600">{item.category}</p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 shadow-sm">
                        {item.type}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-slate-950">{formatPrice(item.price)}</span>
                      <span className="capitalize text-slate-500">{item.status}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoCard label="Need posts" value={postsCount} helper="Signals posted in the marketplace" className="h-full" />
                <InfoCard label="Active orders" value={activeOrders} helper="Currently being coordinated" className="h-full" />
                <InfoCard
                  label="Profile score"
                  value={`${profile.profile_completion_percent}%`}
                  helper="How complete and discoverable this profile is right now."
                  className="h-full"
                />
              </div>
            )}

            {roleFamily === "provider" && offerings.length === 0 ? (
              <div className="mt-6 rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                No public listings yet. This profile still shows the saved summary, contact details, and discovery tags.
              </div>
            ) : null}
          </section>

          <section id="posts" className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">Public posts</h2>
                <p className="text-sm text-slate-600">
                  {roleFamily === "provider"
                    ? "Every public marketplace post this member has published from their profile."
                    : "Requests and marketplace posts this member has shared publicly."}
                </p>
              </div>
            </div>

            {posts.length > 0 ? (
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                {posts.map((post) => {
                  const timingLabel = formatPostTiming(post);

                  return (
                    <article
                      key={post.id}
                      className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50 shadow-sm"
                    >
                      {post.imageUrl ? (
                        <div className="relative aspect-[16/9] overflow-hidden bg-slate-100">
                          <img src={post.imageUrl} alt={post.title} className="h-full w-full object-cover" />
                        </div>
                      ) : null}

                      <div className="p-5">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">
                            {formatPostTypeLabel(post.type)}
                          </span>
                          <span className={`rounded-full px-3 py-1 ${getPostStatusClasses(post.status)}`}>
                            {formatPostStatusLabel(post.status)}
                          </span>
                          <span className="text-slate-500">{formatPostDate(post.createdAt)}</span>
                        </div>

                        <h3 className="mt-4 text-lg font-semibold tracking-tight text-slate-950">{post.title}</h3>
                        <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-600">{post.details}</p>

                        <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-slate-600">
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
                            {post.category}
                          </span>

                          {post.budget !== null ? (
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
                              {formatPrice(post.budget)}
                            </span>
                          ) : null}

                          {post.locationLabel ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5">
                              <MapPin className="h-3.5 w-3.5 text-slate-500" />
                              {post.locationLabel}
                            </span>
                          ) : null}

                          {timingLabel ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5">
                              <Clock3 className="h-3.5 w-3.5 text-slate-500" />
                              {timingLabel}
                            </span>
                          ) : null}

                          {post.attachmentCount > 0 ? (
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
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
              <div className="mt-6 rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                No public posts yet. When this member publishes marketplace posts, they will appear here automatically.
              </div>
            )}
          </section>

          {roleFamily === "provider" ? (
            <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                  <Star className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-slate-950">Recent reviews</h2>
                  <p className="text-sm text-slate-600">Visible trust signals from marketplace activity.</p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {reviews.length > 0 ? (
                  reviews.map((review, index) => (
                    <article key={`${review.createdAt || "review"}-${index}`} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-amber-500">
                        {"★".repeat(Math.max(1, Math.min(5, Math.round(review.rating || 0))))}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {review.comment || "A customer left a rating for this profile."}
                      </p>
                    </article>
                  ))
                ) : (
                  <div className="mt-6 rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    No public reviews yet. Connect or message to start working together.
                  </div>
                )}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ContactRow({
  icon,
  label,
  value,
  href,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <div className="flex items-start gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="mt-0.5 text-slate-500">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 break-all text-sm leading-6 text-slate-700">{value}</p>
      </div>
    </div>
  );

  if (!href) {
    return content;
  }

  const external = href.startsWith("http");

  return (
    <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className="block">
      {content}
    </a>
  );
}

function InfoCard({
  label,
  value,
  helper,
  className = "",
}: {
  label: string;
  value: string | number;
  helper: string;
  className?: string;
}) {
  return (
    <div className={`rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 ${className}`.trim()}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{helper}</p>
    </div>
  );
}

function MetaCard({
  label,
  value,
  helper,
  className = "",
  valueClassName = "text-sm font-semibold leading-6 text-slate-950",
}: {
  label: string;
  value: string;
  helper?: string;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={`rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 ${className}`.trim()}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 ${valueClassName}`.trim()}>{value}</p>
      {helper ? <p className="mt-2 text-sm leading-6 text-slate-600">{helper}</p> : null}
    </div>
  );
}
