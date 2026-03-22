import { PROFILE_ROUTE, type ProfileRoleFamily } from "@/lib/profile/types";
import {
  buildOnboardingProfileHref,
  calculateProfileCompletionPercent,
  getProfileRoleFamily,
  isProfileOnboardingComplete,
  normalizeTopics,
} from "@/lib/profile/utils";

type ReadinessProfileShape = {
  full_name?: string | null;
  name?: string | null;
  location?: string | null;
  role?: string | null;
  bio?: string | null;
  interests?: string[] | null;
  services?: string[] | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  avatar_url?: string | null;
};

export type MarketplaceReadinessAction = {
  id: string;
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
};

export type MarketplaceReadinessSummary = {
  role: ProfileRoleFamily;
  completionPercent: number;
  onboardingComplete: boolean;
  stage: "foundation" | "momentum" | "market-ready";
  stageLabel: string;
  headline: string;
  description: string;
  actions: MarketplaceReadinessAction[];
};

const trim = (value: string | null | undefined) => value?.trim() || "";

const pushAction = (actions: MarketplaceReadinessAction[], nextAction: MarketplaceReadinessAction) => {
  if (actions.some((action) => action.id === nextAction.id)) return;
  actions.push(nextAction);
};

export const createMarketplaceReadinessSummary = (params: {
  profile: ReadinessProfileShape | null | undefined;
  providerServicesCount?: number;
  providerProductsCount?: number;
  seekerPostsCount?: number;
  matchingProvidersCount?: number;
}): MarketplaceReadinessSummary => {
  const role = getProfileRoleFamily(params.profile?.role);
  const fullName = trim(params.profile?.full_name) || trim(params.profile?.name);
  const location = trim(params.profile?.location);
  const completionPercent = calculateProfileCompletionPercent(params.profile);
  const onboardingComplete = isProfileOnboardingComplete(params.profile);
  const listingCount = Math.max(0, params.providerServicesCount || 0) + Math.max(0, params.providerProductsCount || 0);
  const postsCount = Math.max(0, params.seekerPostsCount || 0);
  const matchingProvidersCount = Math.max(0, params.matchingProvidersCount || 0);
  const topics = normalizeTopics([...(params.profile?.interests || []), ...(params.profile?.services || [])]);
  const hasContact = Boolean(
    trim(params.profile?.email) || trim(params.profile?.phone) || trim(params.profile?.website)
  );
  const hasAvatar = Boolean(trim(params.profile?.avatar_url));
  const missingBasics = !fullName || !location || !hasContact;
  const profileHref = onboardingComplete ? PROFILE_ROUTE : buildOnboardingProfileHref();

  const actions: MarketplaceReadinessAction[] = [];

  if (!onboardingComplete) {
    pushAction(actions, {
      id: "essentials",
      title: "Add your core contact details",
      description: "Name, phone number, and location make it easier for nearby people to trust and reach you.",
      href: buildOnboardingProfileHref(),
      ctaLabel: "Add essentials",
    });
  }

  if (topics.length === 0) {
    pushAction(actions, {
      id: "topics",
      title: role === "provider" ? "Add service tags" : "Add needs and interest tags",
      description:
        role === "provider"
          ? "Specific tags help discovery surfaces understand what you offer."
          : "Specific tags help better provider matches rise to the top.",
      href: profileHref,
      ctaLabel: "Add tags",
    });
  }

  if (!hasContact) {
    pushAction(actions, {
      id: "contact",
      title: "Add contact details that reduce friction",
      description: "A phone number or website makes it easier to trust and reach you quickly.",
      href: profileHref,
      ctaLabel: "Add contact",
    });
  }

  if (!hasAvatar) {
    pushAction(actions, {
      id: "avatar",
      title: role === "provider" ? "Upload a face or brand mark" : "Upload a profile photo",
      description: "Profiles with a recognizable image feel more trustworthy at first glance.",
      href: profileHref,
      ctaLabel: "Add photo",
    });
  }

  if (role === "provider") {
    if (listingCount === 0) {
      pushAction(actions, {
        id: "first-listing",
        title: "Publish your first listing",
        description: "People can discover you faster when there is a concrete service or product to open.",
        href: "/dashboard/provider/add-service",
        ctaLabel: "Add service",
      });
    } else if (listingCount < 3) {
      pushAction(actions, {
        id: "grow-listings",
        title: "Expand your storefront",
        description: "A few focused listings create more entry points from discovery and feed surfaces.",
        href: "/dashboard/provider/listings",
        ctaLabel: "Manage listings",
      });
    }
  } else if (postsCount === 0) {
    pushAction(actions, {
      id: "first-need",
      title: "Post your first need",
      description:
        matchingProvidersCount > 0
          ? `${matchingProvidersCount} nearby providers already align with your tags. A live need post gives them a reason to reply now.`
          : "A live need post gives nearby providers the clearest reason to reach out.",
      href: "/dashboard?compose=1",
      ctaLabel: "Post a need",
    });
  } else if (matchingProvidersCount === 0 && topics.length > 0) {
    pushAction(actions, {
      id: "refine-tags",
      title: "Broaden the tags you discover with",
      description: "Add alternate service names or categories so stronger local matches surface faster.",
      href: profileHref,
      ctaLabel: "Refine tags",
    });
  }

  const stage =
    missingBasics || completionPercent < 55
      ? "foundation"
      : !hasAvatar || topics.length === 0 || (role === "provider" ? listingCount === 0 : postsCount === 0) || completionPercent < 85
      ? "momentum"
      : "market-ready";

  let headline = "";
  let description = "";

  if (role === "provider") {
    if (stage === "foundation") {
      headline = "Set the basics that make local outreach possible.";
      description = "Name, phone, and location are enough to start using ServiQ while you fill in the rest over time.";
    } else if (listingCount === 0) {
      headline = "Your profile is live. Turn it into a bookable storefront.";
      description = "The next lift is simple: publish one service or product so nearby buyers can act instead of just browsing.";
    } else if (stage === "momentum") {
      headline = "You have discovery momentum. Remove the last bits of buyer friction.";
      description = "Contact details, a recognizable avatar, and a tighter profile help People and Feed traffic convert faster.";
    } else {
      headline = "Your storefront is market-ready. Keep it active and easy to trust.";
      description = `${listingCount} live listing${listingCount === 1 ? "" : "s"} give nearby buyers multiple ways to start a conversation.`;
    }
  } else if (stage === "foundation") {
    headline = "Share the basics so nearby providers can reach you quickly.";
    description = "You can start with name, phone, and location, then improve the rest of the profile as you use the app.";
  } else if (postsCount === 0) {
    headline = "Your profile is ready. Post the first need that starts real replies.";
    description =
      matchingProvidersCount > 0
        ? `${matchingProvidersCount} nearby providers already match your tags, so one clear post can turn discovery into conversation.`
        : "Nearby providers can see you, but a live need post gives them the clearest reason to respond.";
  } else if (matchingProvidersCount > 0) {
    headline = `${matchingProvidersCount} nearby providers already match your tags.`;
    description = "Keep your needs specific and your profile current so the strongest local fits rise quickly.";
  } else {
    headline = "You have momentum. Sharpen your tags so better matches surface.";
    description = "A few more specific interests or service names will help discovery pull in stronger local options.";
  }

  if (actions.length === 0) {
    pushAction(
      actions,
      role === "provider"
        ? {
            id: "orders",
            title: "Stay responsive in your pipeline",
            description: "Fast replies and clear availability keep discovery momentum turning into bookings.",
            href: "/dashboard/provider/orders",
            ctaLabel: "Open orders",
          }
        : {
            id: "discover",
            title: "Work the live discovery feed",
            description:
              matchingProvidersCount > 0
                ? `${matchingProvidersCount} nearby providers already match what you are looking for.`
                : "Browse nearby providers and save the ones that feel like the right fit.",
            href: "/dashboard/people",
            ctaLabel: "Browse people",
          }
    );
  }

  return {
    role,
    completionPercent,
    onboardingComplete,
    stage,
    stageLabel:
      stage === "foundation" ? "Foundation" : stage === "momentum" ? "Momentum" : "Market ready",
    headline,
    description,
    actions: actions.slice(0, 3),
  };
};
