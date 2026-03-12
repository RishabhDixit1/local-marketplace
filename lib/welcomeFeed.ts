import type {
  CommunityFeedResponse,
  CommunityPostRecord,
  CommunityProfileRecord,
} from "@/lib/api/community";
import { distanceBetweenCoordinatesKm } from "@/lib/geo";

export type WelcomeFeedCardType = "demand" | "service" | "product";

export type WelcomeFeedCard = {
  id: string;
  focusId: string;
  type: WelcomeFeedCardType;
  ownerId?: string;
  ownerName?: string;
  title: string;
  subtitle: string;
  priceLabel: string;
  distanceKm: number;
  etaLabel: string;
  signalLabel: string;
  momentumLabel: string;
  image: string;
  actionLabel: string;
  actionPath: string;
  createdAt: string;
  isDemo?: boolean;
};

export type WelcomeFeedBuildResult = {
  cards: WelcomeFeedCard[];
  acceptedConnectionIds: string[];
  emptyReason: "no_connections" | "no_connected_content" | null;
};

type CommunityFeedSnapshot = Extract<CommunityFeedResponse, { ok: true }>;

type Coordinate = {
  latitude: number;
  longitude: number;
};

const routes = {
  posts: "/dashboard",
} as const;

const trim = (value: string | null | undefined) => value?.trim() ?? "";

const demandImages = [
  "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200&q=80",
  "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80",
  "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200&q=80",
];

const serviceImages = [
  "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1200&q=80",
  "https://images.unsplash.com/photo-1582719471384-894fbb16e074?w=1200&q=80",
  "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80",
];

const productImages = [
  "https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=1200&q=80",
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1200&q=80",
  "https://images.unsplash.com/photo-1526178613552-2b45c6c302f0?w=1200&q=80",
];

const normalizeMarketplaceCardType = (value?: string | null): WelcomeFeedCardType => {
  const normalized = trim(value).toLowerCase();
  if (normalized === "service" || normalized === "product") return normalized;
  return "demand";
};

const parseMarketplacePostPreview = (rawText: string) => {
  const fallback = {
    title: rawText.trim() || "New local post",
    kind: "demand" as WelcomeFeedCardType,
    category: "",
    budget: 0,
  };

  if (!rawText.includes(" | ")) return fallback;

  const parts = rawText.split(" | ");
  const title = parts[0]?.trim() || fallback.title;
  const typePart = parts.find((item) => item.startsWith("Type:"));
  const categoryPart = parts.find((item) => item.startsWith("Category:"));
  const budgetPart = parts.find((item) => item.startsWith("Budget:"));
  const budgetMatch = budgetPart?.match(/(\d+(\.\d+)?)/);

  return {
    title,
    kind: normalizeMarketplaceCardType(typePart?.replace("Type:", "").trim()),
    category: categoryPart?.replace("Category:", "").trim() || "",
    budget: budgetMatch ? Number(budgetMatch[1]) : 0,
  };
};

const getOwnerId = (
  value: Pick<CommunityPostRecord, "user_id" | "author_id" | "created_by" | "requester_id" | "owner_id" | "provider_id">
): string =>
  trim(value.user_id || value.author_id || value.created_by || value.requester_id || value.owner_id || value.provider_id || "");

const getCoordinatesFromProfile = (profile: CommunityProfileRecord | undefined | null): Coordinate | null => {
  if (
    profile &&
    typeof profile.latitude === "number" &&
    Number.isFinite(profile.latitude) &&
    typeof profile.longitude === "number" &&
    Number.isFinite(profile.longitude)
  ) {
    return {
      latitude: profile.latitude,
      longitude: profile.longitude,
    };
  }

  return null;
};

const getDistanceKm = (
  viewerProfile: CommunityProfileRecord | null,
  ownerProfile: CommunityProfileRecord | undefined,
  fallbackSeed: number
) => {
  const viewerCoordinates = getCoordinatesFromProfile(viewerProfile);
  const ownerCoordinates = getCoordinatesFromProfile(ownerProfile);

  if (viewerCoordinates && ownerCoordinates) {
    return Number(distanceBetweenCoordinatesKm(viewerCoordinates, ownerCoordinates).toFixed(1));
  }

  return Number((1 + (fallbackSeed % 5) * 0.8).toFixed(1));
};

const sortByCreatedAt = <T extends { created_at?: string | null }>(items: T[]) =>
  [...items].sort((a, b) => trim(b.created_at).localeCompare(trim(a.created_at)));

const isoMinutesAgo = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();

export const buildWelcomeDemoFeedCards = (): WelcomeFeedCard[] => [
  {
    id: "welcome-demo-story-1",
    focusId: "welcome-demo-story-1",
    type: "demand",
    ownerId: "demo-welcome-neha",
    ownerName: "Neha Arora",
    title: "Need a plumber for a kitchen sink leak",
    subtitle: "Neha from Maple Residency posted this neighborhood preview • Plumbing",
    priceLabel: "Budget ₹900",
    distanceKm: 1.2,
    etaLabel: "Needs help this evening",
    signalLabel: "Preview request",
    momentumLabel: "Demo visualization while your real network fills in",
    image: demandImages[0],
    actionLabel: "Preview",
    actionPath: routes.posts,
    createdAt: isoMinutesAgo(6),
    isDemo: true,
  },
  {
    id: "welcome-demo-story-2",
    focusId: "welcome-demo-story-2",
    type: "service",
    ownerId: "demo-welcome-arjun",
    ownerName: "Arjun Tech Care",
    title: "Same-day laptop diagnostics and repair",
    subtitle: "Arjun Tech Care is advertising a trusted service preview • Electronics",
    priceLabel: "From ₹699",
    distanceKm: 2.4,
    etaLabel: "Available in the next 2 hours",
    signalLabel: "Preview provider",
    momentumLabel: "Shows how connected providers will appear in your welcome feed",
    image: serviceImages[1],
    actionLabel: "Preview",
    actionPath: routes.posts,
    createdAt: isoMinutesAgo(12),
    isDemo: true,
  },
  {
    id: "welcome-demo-story-3",
    focusId: "welcome-demo-story-3",
    type: "product",
    ownerId: "demo-welcome-kavya",
    ownerName: "Kavya Home Finds",
    title: "Ergonomic office chair with pickup nearby",
    subtitle: "Kavya Home Finds shared a sample product card • Furniture",
    priceLabel: "₹2,800",
    distanceKm: 1.8,
    etaLabel: "Pickup today",
    signalLabel: "Preview seller",
    momentumLabel: "Preview of how local inventory surfaces in the live feed",
    image: productImages[0],
    actionLabel: "Preview",
    actionPath: routes.posts,
    createdAt: isoMinutesAgo(18),
    isDemo: true,
  },
  {
    id: "welcome-demo-story-4",
    focusId: "welcome-demo-story-4",
    type: "demand",
    ownerId: "demo-welcome-manav",
    ownerName: "Manav Kapoor",
    title: "Need help assembling a wardrobe tonight",
    subtitle: "Manav in Cedar Block posted a sample urgent task • Home setup",
    priceLabel: "Budget ₹1,200",
    distanceKm: 3.1,
    etaLabel: "Open for nearby responses",
    signalLabel: "Preview demand",
    momentumLabel: "Useful for visualization until connected members publish",
    image: demandImages[2],
    actionLabel: "Preview",
    actionPath: routes.posts,
    createdAt: isoMinutesAgo(23),
    isDemo: true,
  },
  {
    id: "welcome-demo-story-5",
    focusId: "welcome-demo-story-5",
    type: "service",
    ownerId: "demo-welcome-zoya",
    ownerName: "Zoya Clean Living",
    title: "Balcony deep-clean with plant setup add-on",
    subtitle: "Zoya Clean Living posted a demo service card • Home care",
    priceLabel: "From ₹1,499",
    distanceKm: 2.7,
    etaLabel: "Morning slots available",
    signalLabel: "Preview provider",
    momentumLabel: "Demo cards stay visible until more real feed items arrive",
    image: serviceImages[0],
    actionLabel: "Preview",
    actionPath: routes.posts,
    createdAt: isoMinutesAgo(31),
    isDemo: true,
  },
  {
    id: "welcome-demo-story-6",
    focusId: "welcome-demo-story-6",
    type: "product",
    ownerId: "demo-welcome-ritu",
    ownerName: "Ritu Local Goods",
    title: "Induction cooktop with two extra pans",
    subtitle: "Ritu Local Goods added a preview resale listing • Kitchen",
    priceLabel: "₹1,650",
    distanceKm: 1.4,
    etaLabel: "Ready for pickup",
    signalLabel: "Preview product",
    momentumLabel: "Represents what connected sellers will add to your feed",
    image: productImages[2],
    actionLabel: "Preview",
    actionPath: routes.posts,
    createdAt: isoMinutesAgo(36),
    isDemo: true,
  },
  {
    id: "welcome-demo-story-7",
    focusId: "welcome-demo-story-7",
    type: "service",
    ownerId: "demo-welcome-kabir",
    ownerName: "Kabir Cooling Works",
    title: "Weekend AC servicing slots still open",
    subtitle: "Kabir Cooling Works added a sample seasonal service • AC repair",
    priceLabel: "From ₹899",
    distanceKm: 3.6,
    etaLabel: "Weekend bookings open",
    signalLabel: "Preview listing",
    momentumLabel: "Keeps the Welcome feed visually populated alongside live content",
    image: serviceImages[2],
    actionLabel: "Preview",
    actionPath: routes.posts,
    createdAt: isoMinutesAgo(44),
    isDemo: true,
  },
  {
    id: "welcome-demo-story-8",
    focusId: "welcome-demo-story-8",
    type: "demand",
    ownerId: "demo-welcome-simran",
    ownerName: "Simran Malhotra",
    title: "Looking for a reliable pet sitter on Sunday",
    subtitle: "Simran shared a preview neighborhood request • Pet care",
    priceLabel: "Budget ₹1,500",
    distanceKm: 2.1,
    etaLabel: "Needs confirmation by tomorrow",
    signalLabel: "Preview request",
    momentumLabel: "Demo stories rotate until your connections add real local posts",
    image: demandImages[1],
    actionLabel: "Preview",
    actionPath: routes.posts,
    createdAt: isoMinutesAgo(52),
    isDemo: true,
  },
];

export const blendWelcomeFeedCards = (
  liveCards: WelcomeFeedCard[],
  options: {
    minimumCardCount?: number;
    demoCards?: WelcomeFeedCard[];
  } = {}
) => {
  const { minimumCardCount = 6, demoCards = buildWelcomeDemoFeedCards() } = options;
  if (liveCards.length >= minimumCardCount) {
    return liveCards;
  }

  const seen = new Set(liveCards.map((card) => card.id));
  const fillerCards = demoCards.filter((card) => !seen.has(card.id));

  return [...liveCards, ...fillerCards].slice(0, Math.max(minimumCardCount, liveCards.length));
};

export const buildWelcomeFeedCards = (snapshot: CommunityFeedSnapshot): WelcomeFeedBuildResult => {
  const acceptedConnectionIds = snapshot.acceptedConnectionIds || [];
  if (!acceptedConnectionIds.length) {
    return {
      cards: [],
      acceptedConnectionIds,
      emptyReason: "no_connections",
    };
  }

  const connectedPeerSet = new Set(acceptedConnectionIds);
  const profileMap = new Map(snapshot.profiles.map((profile) => [profile.id, profile]));
  const viewerProfile = snapshot.currentUserProfile;

  const cards: WelcomeFeedCard[] = [];

  sortByCreatedAt(snapshot.helpRequests).forEach((request, index) => {
    const ownerId = trim(request.requester_id);
    if (!connectedPeerSet.has(ownerId)) return;

    const ownerProfile = profileMap.get(ownerId);
    const budget = Math.max(Number(request.budget_max || 0), Number(request.budget_min || 0));
    const urgency = trim(request.urgency).toLowerCase();

    cards.push({
      id: `welcome-help-${request.id}`,
      focusId: request.id,
      type: "demand",
      ownerId,
      ownerName: ownerProfile?.name || undefined,
      title: trim(request.title) || trim(request.details) || "Need local support",
      subtitle: `${ownerProfile?.name || "A connection"} shared a local request${request.category ? ` • ${request.category}` : ""}`,
      priceLabel: budget > 0 ? `Budget ₹${budget}` : "Budget shared in chat",
      distanceKm: getDistanceKm(viewerProfile, ownerProfile, index),
      etaLabel: urgency === "urgent" || urgency === "today" ? "Needs help today" : "Open for nearby responses",
      signalLabel: urgency === "urgent" ? "High urgency" : "Connected neighbor",
      momentumLabel: `${ownerProfile?.name || "Connection"} is in your local network`,
      image: demandImages[index % demandImages.length],
      actionLabel: "Respond",
      actionPath: routes.posts,
      createdAt: trim(request.created_at) || new Date().toISOString(),
    });
  });

  sortByCreatedAt(snapshot.posts).forEach((post, index) => {
    const ownerId = getOwnerId(post);
    if (!connectedPeerSet.has(ownerId)) return;

    const parsed = parseMarketplacePostPreview(
      trim(post.text) || trim(post.content) || trim(post.description) || trim(post.title) || "New local post"
    );
    const cardType = normalizeMarketplaceCardType(post.type || post.post_type || parsed.kind);
    const ownerProfile = profileMap.get(ownerId);
    const imagePool = cardType === "service" ? serviceImages : cardType === "product" ? productImages : demandImages;

    cards.push({
      id: `welcome-post-${post.id}`,
      focusId: post.id,
      type: cardType,
      ownerId,
      ownerName: ownerProfile?.name || undefined,
      title: parsed.title,
      subtitle: `${ownerProfile?.name || "A connection"} posted this in your connected feed${parsed.category ? ` • ${parsed.category}` : ""}`,
      priceLabel:
        parsed.budget > 0
          ? `₹${parsed.budget}`
          : cardType === "demand"
          ? "Budget shared in chat"
          : cardType === "service"
          ? "Service post"
          : "Product post",
      distanceKm: getDistanceKm(viewerProfile, ownerProfile, index + 2),
      etaLabel:
        cardType === "demand"
          ? "Open for nearby responses"
          : cardType === "service"
          ? "Available in your network"
          : "Shared with connections",
      signalLabel:
        cardType === "demand" ? "Connected requester" : cardType === "service" ? "Trusted provider" : "Local seller",
      momentumLabel: `${ownerProfile?.name || "Connection"} is visible because you are connected`,
      image: imagePool[index % imagePool.length],
      actionLabel: cardType === "demand" ? "Respond" : cardType === "service" ? "Connect" : "View",
      actionPath: routes.posts,
      createdAt: trim(post.created_at) || new Date().toISOString(),
    });
  });

  sortByCreatedAt(snapshot.services).forEach((service, index) => {
    const ownerId = trim(service.provider_id);
    if (!connectedPeerSet.has(ownerId)) return;

    const ownerProfile = profileMap.get(ownerId);

    cards.push({
      id: `welcome-service-${service.id}`,
      focusId: service.id,
      type: "service",
      ownerId,
      ownerName: ownerProfile?.name || undefined,
      title: service.title || "Local service",
      subtitle: `${ownerProfile?.name || "A connection"} shared this service${service.category ? ` • ${service.category}` : ""}`,
      priceLabel: service.price ? `From ₹${service.price}` : "Price on request",
      distanceKm: getDistanceKm(viewerProfile, ownerProfile, index + 4),
      etaLabel: "Available in your network",
      signalLabel: "Connected provider",
      momentumLabel: `${ownerProfile?.name || "Connection"} is one connection away`,
      image: serviceImages[index % serviceImages.length],
      actionLabel: "Book",
      actionPath: routes.posts,
      createdAt: trim(service.created_at) || new Date().toISOString(),
    });
  });

  sortByCreatedAt(snapshot.products).forEach((product, index) => {
    const ownerId = trim(product.provider_id);
    if (!connectedPeerSet.has(ownerId)) return;

    const ownerProfile = profileMap.get(ownerId);

    cards.push({
      id: `welcome-product-${product.id}`,
      focusId: product.id,
      type: "product",
      ownerId,
      ownerName: ownerProfile?.name || undefined,
      title: product.title || "Local product",
      subtitle: `${ownerProfile?.name || "A connection"} shared this product${product.category ? ` • ${product.category}` : ""}`,
      priceLabel: product.price ? `₹${product.price}` : "Price on request",
      distanceKm: getDistanceKm(viewerProfile, ownerProfile, index + 6),
      etaLabel: "Shared with connections",
      signalLabel: "Connected seller",
      momentumLabel: `${ownerProfile?.name || "Connection"} is active nearby`,
      image: productImages[index % productImages.length],
      actionLabel: "View",
      actionPath: routes.posts,
      createdAt: trim(product.created_at) || new Date().toISOString(),
    });
  });

  const uniqueCards = Array.from(new Map(cards.map((card) => [card.id, card])).values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );

  return {
    cards: uniqueCards,
    acceptedConnectionIds,
    emptyReason: uniqueCards.length === 0 ? "no_connected_content" : null,
  };
};
