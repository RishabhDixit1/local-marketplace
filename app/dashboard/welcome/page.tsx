"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { isFinalOrderStatus } from "@/lib/orderWorkflow";
import { isAbortLikeError, isFailedFetchError, toErrorMessage } from "@/lib/runtimeErrors";
import CreatePostModal from "../../components/CreatePostModal";
import {
  Activity,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  MessageCircle,
  ShieldCheck,
  Star,
  Users,
  Zap,
} from "lucide-react";

type WelcomeStats = {
  nearbyPosts: number;
  activeTasks: number;
  unreadMessages: number;
  trustScore: number;
};

type UserProfile = {
  name: string | null;
  role: string | null;
  location: string | null;
  bio: string | null;
  services: string[] | null;
  availability: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
};

type NearbyCard = {
  id: string;
  focusId: string;
  type: "demand" | "service" | "product";
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
};

type EnrichedNearbyCard = NearbyCard & {
  badge: string;
  pulse: string;
  ownerLabel: string;
  postedAgo: string;
  responseLabel: string;
  proofLabel: string;
  mediaLabel: string;
  mediaCount: number;
  mediaGallery: [string, string, string];
};

type RawPost = {
  id: string;
  text: string | null;
};

type RawService = {
  id: string;
  title: string | null;
  category: string | null;
  price: number | null;
};

type RawProduct = {
  id: string;
  title: string | null;
  category: string | null;
  price: number | null;
};

type ConversationUnreadRow = {
  conversation_id: string;
  last_read_at: string | null;
};

type MessageUnreadRow = {
  conversation_id: string;
  created_at: string;
};

const routes = {
  posts: "/dashboard",
  people: "/dashboard/people",
  tasks: "/dashboard/tasks",
  chat: "/dashboard/chat",
  addService: "/dashboard/provider/add-service",
} as const;

const providerRoles = new Set(["provider", "seller", "service_provider", "business"]);

type HeroTone = "rose" | "sky" | "emerald";

type HeroScene = {
  label: string;
  title: string;
  meta: string;
  eta: string;
  tone: HeroTone;
};

const defaultHeroScenes: HeroScene[] = [
  {
    label: "Urgent Need",
    title: "Electrical fault in 2.1 km radius",
    meta: "4 providers matched in 38s",
    eta: "ETA 12m",
    tone: "rose",
  },
  {
    label: "Service Match",
    title: "Deep cleaning request now covered",
    meta: "Top match score 93",
    eta: "ETA 45m",
    tone: "sky",
  },
  {
    label: "Fast Commerce",
    title: "Nearby product order accepted",
    meta: "Chat reply in 27s",
    eta: "ETA 22m",
    tone: "emerald",
  },
];

const heroToneBadgeClasses: Record<HeroTone, string> = {
  rose: "bg-rose-100 text-rose-700",
  sky: "bg-sky-100 text-sky-700",
  emerald: "bg-emerald-100 text-emerald-700",
};

const heroToneDotClasses: Record<HeroTone, string> = {
  rose: "bg-rose-300",
  sky: "bg-sky-300",
  emerald: "bg-emerald-300",
};

const heroToneGlowClasses: Record<HeroTone, string> = {
  rose: "bg-rose-300/35",
  sky: "bg-sky-300/35",
  emerald: "bg-emerald-300/35",
};

const heroToneRingClasses: Record<HeroTone, string> = {
  rose: "border-rose-200/85",
  sky: "border-sky-200/85",
  emerald: "border-emerald-200/85",
};

const heroToneTrackClasses: Record<HeroTone, string> = {
  rose: "from-rose-300/90 to-orange-200/70",
  sky: "from-sky-300/90 to-cyan-200/70",
  emerald: "from-emerald-300/90 to-lime-200/70",
};

const heroToneStrokeColors: Record<HeroTone, string> = {
  rose: "rgba(251, 113, 133, 0.9)",
  sky: "rgba(56, 189, 248, 0.9)",
  emerald: "rgba(52, 211, 153, 0.9)",
};

const heroFlowPaths = [
  { id: "flow-need-hub", d: "M16 72 Q31 57 46 52", delay: 0 },
  { id: "flow-hub-provider", d: "M46 52 Q62 36 79 30", delay: 0.25 },
  { id: "flow-hub-fulfill", d: "M46 52 Q64 67 82 74", delay: 0.5 },
  { id: "flow-provider-fulfill", d: "M79 30 Q84 50 82 74", delay: 0.75 },
] as const;

const heroNetworkNodes = [
  { id: "need", label: "Need", x: "16%", y: "72%", tone: "rose" as HeroTone },
  { id: "hub", label: "Marketplace", x: "46%", y: "52%", tone: "sky" as HeroTone },
  { id: "provider", label: "Provider", x: "79%", y: "30%", tone: "emerald" as HeroTone },
  { id: "fulfill", label: "Fulfillment", x: "82%", y: "74%", tone: "sky" as HeroTone },
] as const;

const heroDataStreams: Array<{
  id: string;
  left: string[];
  top: string[];
  duration: number;
  delay: number;
}> = [
  {
    id: "stream-1",
    left: ["16%", "31%", "46%", "62%", "79%"],
    top: ["72%", "58%", "52%", "40%", "30%"],
    duration: 3.2,
    delay: 0.2,
  },
  {
    id: "stream-2",
    left: ["82%", "64%", "46%", "31%", "16%"],
    top: ["74%", "67%", "52%", "57%", "72%"],
    duration: 3.6,
    delay: 1,
  },
  {
    id: "stream-3",
    left: ["46%", "64%", "82%"],
    top: ["52%", "66%", "74%"],
    duration: 2.9,
    delay: 0.7,
  },
];

export default function WelcomePage() {
  const router = useRouter();
  const storiesScrollRef = useRef<HTMLDivElement | null>(null);
  const storiesDragRef = useRef({
    isDragging: false,
    startX: 0,
    startScrollLeft: 0,
  });

  const [openPostModal, setOpenPostModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeHeroScene, setActiveHeroScene] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [userName, setUserName] = useState("Neighbor");
  const [isProvider, setIsProvider] = useState(false);
  const [stats, setStats] = useState<WelcomeStats>({
    nearbyPosts: 0,
    activeTasks: 0,
    unreadMessages: 0,
    trustScore: 4.7,
  });
  const [nearbyCards, setNearbyCards] = useState<NearbyCard[]>([]);

  const enrichedCards = useMemo<EnrichedNearbyCard[]>(() => {
    const demandAltMedia = [
      "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?w=1200&q=80",
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200&q=80",
      "https://images.unsplash.com/photo-1486946255434-2466348c2166?w=1200&q=80",
      "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?w=1200&q=80",
      "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200&q=80",
    ];
    const serviceAltMedia = [
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80",
      "https://images.unsplash.com/photo-1616046229478-9901c5536a45?w=1200&q=80",
      "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=1200&q=80",
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1200&q=80",
      "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&q=80",
    ];
    const productAltMedia = [
      "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=1200&q=80",
      "https://images.unsplash.com/photo-1526178613552-2b45c6c302f0?w=1200&q=80",
      "https://images.unsplash.com/photo-1468495244123-6c6c332eeece?w=1200&q=80",
      "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?w=1200&q=80",
      "https://images.unsplash.com/photo-1503602642458-232111445657?w=1200&q=80",
    ];
    const demandOwners = ["Ananya R.", "Kunal S.", "Priya N.", "Rohit J.", "Megha D."];
    const serviceOwners = ["UrbanFix Crew", "SparkClean Pro", "HandyNest", "QuickCare Team", "FixRight Local"];
    const productOwners = ["ToolKart Local", "FreshStreet Market", "CityMart Seller", "HomePro Supply", "DailyBasket Hub"];

    return nearbyCards.map((card, index) => {
      const mediaPool = card.type === "demand" ? demandAltMedia : card.type === "service" ? serviceAltMedia : productAltMedia;
      const ownerPool = card.type === "demand" ? demandOwners : card.type === "service" ? serviceOwners : productOwners;
      const mediaGallery: [string, string, string] = [
        card.image,
        mediaPool[(index + 1) % mediaPool.length],
        mediaPool[(index + 3) % mediaPool.length],
      ];

      return {
        ...card,
        badge: card.type === "demand" ? "Need" : card.type === "service" ? "Service" : "Product",
        pulse: card.type === "demand" ? "Urgent" : card.type === "service" ? "Trusted" : "Fast deal",
        ownerLabel: ownerPool[index % ownerPool.length],
        postedAgo: `${2 + index * 3}m ago`,
        responseLabel:
          card.type === "demand"
            ? "Replies in ~4 min"
            : card.type === "service"
            ? "Provider replies in ~6 min"
            : "Seller replies in ~5 min",
        proofLabel:
          card.type === "demand"
            ? `${5 + index} local matches`
            : card.type === "service"
            ? `${14 + index} verified jobs`
            : `${9 + index} repeat buyers`,
        mediaLabel: card.type === "demand" ? "Issue photos" : card.type === "service" ? "Before/after media" : "Product gallery",
        mediaCount: 3 + (index % 5),
        mediaGallery,
      };
    });
  }, [nearbyCards]);

  const storyBaseItems = useMemo(() => {
    if (!enrichedCards.length) return [];

    const targetCount = 10;
    return Array.from({ length: targetCount }, (_, index) => enrichedCards[index % enrichedCards.length]);
  }, [enrichedCards]);

  const storyItems = useMemo(() => storyBaseItems, [storyBaseItems]);

  const formatStoryPriceLine = (story: EnrichedNearbyCard) => {
    if (story.type === "demand") {
      return /^budget/i.test(story.priceLabel) ? story.priceLabel : `Budget ${story.priceLabel}`;
    }
    return /^price/i.test(story.priceLabel) ? story.priceLabel : `Price ${story.priceLabel}`;
  };

  const scrollStories = (direction: "left" | "right") => {
    const container = storiesScrollRef.current;
    if (!container) return;

    const delta = Math.round(container.clientWidth * 0.55);
    container.scrollBy({
      left: direction === "left" ? -delta : delta,
      behavior: "smooth",
    });
  };

  const handleStoriesWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!storiesScrollRef.current) return;

    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      event.preventDefault();
      storiesScrollRef.current.scrollBy({
        left: event.deltaY,
      });
    }
  };

  const handleStoriesPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = storiesScrollRef.current;
    if (!container) return;

    storiesDragRef.current.isDragging = true;
    storiesDragRef.current.startX = event.clientX;
    storiesDragRef.current.startScrollLeft = container.scrollLeft;
    container.setPointerCapture(event.pointerId);
  };

  const handleStoriesPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = storiesScrollRef.current;
    if (!container || !storiesDragRef.current.isDragging) return;

    const dragDelta = event.clientX - storiesDragRef.current.startX;
    container.scrollLeft = storiesDragRef.current.startScrollLeft - dragDelta;
  };

  const handleStoriesPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = storiesScrollRef.current;
    if (!container) return;

    storiesDragRef.current.isDragging = false;
    if (container.hasPointerCapture(event.pointerId)) {
      container.releasePointerCapture(event.pointerId);
    }
  };

  const demandCards = useMemo(
    () => nearbyCards.filter((card) => card.type === "demand"),
    [nearbyCards]
  );

  const aboutCards = useMemo(
    () => [
      {
        title: "Realtime Matching Engine",
        desc: "Every post is routed by urgency, category, and local radius so nearby providers can respond fast.",
        metric: `${demandCards.length} live needs`,
        icon: Zap,
      },
      {
        title: "Trust Layer Built In",
        desc: "Profiles, reviews, and fulfillment history help customers choose reliable local providers quickly.",
        metric: `${stats.trustScore.toFixed(1)} trust index`,
        icon: ShieldCheck,
      },
      {
        title: "Conversation to Completion",
        desc: "From first message to final delivery, chat and task updates stay in one execution thread.",
        metric: `${stats.unreadMessages + 12} active threads`,
        icon: MessageCircle,
      },
      {
        title: "Neighborhood Supply Grid",
        desc: "Services and products from nearby sellers reduce wait time and increase successful local outcomes.",
        metric: `${stats.activeTasks} tasks in motion`,
        icon: Activity,
      },
    ],
    [demandCards.length, stats.activeTasks, stats.trustScore, stats.unreadMessages]
  );

  const heroScenes = useMemo<HeroScene[]>(() => {
    const topDemand = demandCards[0];
    const topService = nearbyCards.find((card) => card.type === "service");
    const topProduct = nearbyCards.find((card) => card.type === "product");

    return [
      {
        label: "Active Needs",
        title: topDemand?.title || defaultHeroScenes[0].title,
        meta: `${demandCards.length} demand posts are live nearby`,
        eta: stats.unreadMessages > 0 ? `${stats.unreadMessages} unread` : "ETA 12m",
        tone: "rose",
      },
      {
        label: "Service Supply",
        title: topService?.title || defaultHeroScenes[1].title,
        meta: `${stats.activeTasks} active tasks currently in progress`,
        eta: stats.activeTasks > 0 ? "Live now" : "ETA 45m",
        tone: "sky",
      },
      {
        label: "Trust Pulse",
        title: topProduct?.title || defaultHeroScenes[2].title,
        meta: `Local trust score ${stats.trustScore.toFixed(1)}`,
        eta: "ETA 22m",
        tone: "emerald",
      },
    ];
  }, [demandCards, nearbyCards, stats.activeTasks, stats.trustScore, stats.unreadMessages]);

  const heroQuickActions = useMemo(
    () =>
      isProvider
        ? [
            {
              title: "Respond to Needs",
              icon: Zap,
              action: () => router.push(`${routes.posts}?category=demand`),
            },
            {
              title: "Add Service",
              icon: ClipboardList,
              action: () => router.push(routes.addService),
            },
            {
              title: "Open Chat",
              icon: MessageCircle,
              action: () => router.push(routes.chat),
            },
            {
              title: "View Tasks",
              icon: Activity,
              action: () => router.push(routes.tasks),
            },
          ]
        : [
            {
              title: "Create Post",
              icon: Zap,
              action: () => setOpenPostModal(true),
            },
            {
              title: "Find People",
              icon: Users,
              action: () => router.push(routes.people),
            },
            {
              title: "Open Chat",
              icon: MessageCircle,
              action: () => router.push(routes.chat),
            },
            {
              title: "Browse Feed",
              icon: ArrowRight,
              action: () => router.push(routes.posts),
            },
          ],
    [isProvider, router]
  );

  const marketSignals = useMemo(
    () => [
      {
        label: "Open Needs",
        value: demandCards.length,
        icon: Activity,
      },
      {
        label: "Active Tasks",
        value: stats.activeTasks,
        icon: ClipboardList,
      },
      {
        label: "Unread",
        value: stats.unreadMessages,
        icon: MessageCircle,
      },
      {
        label: "Avg Trust",
        value: stats.trustScore.toFixed(1),
        icon: Star,
      },
    ],
    [demandCards.length, stats.activeTasks, stats.unreadMessages, stats.trustScore]
  );

  const currentHeroScene = heroScenes[activeHeroScene];

  useEffect(() => {
    const heroSceneTimer = window.setInterval(() => {
      setActiveHeroScene((prev) => (prev + 1) % heroScenes.length);
    }, 3200);

    return () => window.clearInterval(heroSceneTimer);
  }, [heroScenes.length]);

  useEffect(() => {
    let isActive = true;

    const loadWelcome = async () => {
      setLoading(true);
      setLoadError("");

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        let currentUser = sessionData.session?.user || null;

        if (!currentUser) {
          const { data: authData, error: authError } = await supabase.auth.getUser();
          if (authError) {
            throw authError;
          }
          currentUser = authData.user;
        }

        if (!currentUser) {
          return;
        }

        const { data: profileData } = await supabase
          .from("profiles")
          .select("name, role, location, bio, services, availability, email, phone, website")
          .eq("id", currentUser.id)
          .maybeSingle<UserProfile>();

        const role = (profileData?.role || "").toLowerCase();
        const isProviderRole = providerRoles.has(role);

        setUserName(profileData?.name || currentUser.email?.split("@")[0] || "Neighbor");
        setIsProvider(isProviderRole);

        const [{ count: nearbyPostsCount }, { data: myOrders }, { data: myConversations }, { data: reviewsData }] =
          await Promise.all([
            supabase.from("posts").select("*", { count: "exact", head: true }).eq("status", "open"),
            supabase
              .from("orders")
              .select("status")
              .or(`consumer_id.eq.${currentUser.id},provider_id.eq.${currentUser.id}`),
            supabase
              .from("conversation_participants")
              .select("conversation_id,last_read_at")
              .eq("user_id", currentUser.id),
            supabase.from("reviews").select("rating").eq("provider_id", currentUser.id),
          ]);

        const activeTasks =
          myOrders?.filter((order) => !isFinalOrderStatus(order.status)).length || 0;

        const conversationRows = (myConversations as ConversationUnreadRow[] | null) || [];
        const conversationIds = conversationRows.map((row) => row.conversation_id);
        const lastReadAtByConversation = new Map(conversationRows.map((row) => [row.conversation_id, row.last_read_at]));
        let unreadMessages = 0;

        if (conversationIds.length > 0) {
          const { data: unreadMessageRows } = await supabase
            .from("messages")
            .select("conversation_id,created_at")
            .in("conversation_id", conversationIds)
            .neq("sender_id", currentUser.id)
            .order("created_at", { ascending: false })
            .limit(2000);

          unreadMessages = ((unreadMessageRows as MessageUnreadRow[] | null) || []).reduce((count, message) => {
            const lastReadAt = lastReadAtByConversation.get(message.conversation_id) || null;
            if (!lastReadAt) return count + 1;
            return message.created_at > lastReadAt ? count + 1 : count;
          }, 0);
        }

        let trustScore = 4.7;
        if (reviewsData && reviewsData.length > 0) {
          const avg = reviewsData.reduce((sum, r) => sum + Number(r.rating || 0), 0) / reviewsData.length;
          trustScore = Number(avg.toFixed(1));
        }

        setStats({
          nearbyPosts: nearbyPostsCount || 0,
          activeTasks,
          unreadMessages,
          trustScore,
        });

        const [{ data: recentPosts }, { data: recentServices }, { data: recentProducts }] = await Promise.all([
          supabase.from("posts").select("id, text").eq("status", "open").limit(5),
          supabase.from("service_listings").select("id, title, category, price").limit(5),
          supabase.from("product_catalog").select("id, title, category, price").limit(5),
        ]);

      const demandImages = [
        "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200&q=80",
        "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80",
      ];
      const serviceImages = [
        "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1200&q=80",
        "https://images.unsplash.com/photo-1582719471384-894fbb16e074?w=1200&q=80",
      ];
      const productImages = [
        "https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=1200&q=80",
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1200&q=80",
      ];
      const demandSignals = ["High urgency", "Budget confirmed", "Frequent requester"];
      const serviceSignals = ["Verified provider", "4.9 avg rating", "Fast response"];
      const productSignals = ["Trusted seller", "Pickup in 30m", "Local warranty"];

      const mappedPosts: NearbyCard[] =
        (recentPosts as RawPost[] | null)?.map((post, index) => ({
          id: `post-${post.id}`,
          focusId: post.id,
          type: "demand",
          title: post.text || "New local need",
          subtitle: "Demand posted by nearby customer",
          priceLabel: "Budget shared in chat",
          distanceKm: Number((0.8 + index * 0.9).toFixed(1)),
          etaLabel: index === 0 ? "Starts in 15m" : `Starts in ${20 + index * 5}m`,
          signalLabel: demandSignals[index % demandSignals.length],
          momentumLabel: `${6 + index * 2} responders watching`,
          image: demandImages[index % demandImages.length],
          actionLabel: "Respond",
          actionPath: routes.posts,
        })) || [];

      const mappedServices: NearbyCard[] =
        (recentServices as RawService[] | null)?.map((service, index) => ({
          id: `service-${service.id}`,
          focusId: service.id,
          type: "service",
          title: service.title || "Local service",
          subtitle: service.category || "Provider offering",
          priceLabel: service.price ? `From ₹${service.price}` : "Price on request",
          distanceKm: Number((1.2 + index * 0.8).toFixed(1)),
          etaLabel: index === 0 ? "Available now" : `Available in ${15 + index * 10}m`,
          signalLabel: serviceSignals[index % serviceSignals.length],
          momentumLabel: `${3 + index} bookings in progress`,
          image: serviceImages[index % serviceImages.length],
          actionLabel: "Book",
          actionPath: routes.posts,
        })) || [];

      const mappedProducts: NearbyCard[] =
        (recentProducts as RawProduct[] | null)?.map((product, index) => ({
          id: `product-${product.id}`,
          focusId: product.id,
          type: "product",
          title: product.title || "Local product",
          subtitle: product.category || "Nearby seller",
          priceLabel: product.price ? `₹${product.price}` : "Price on request",
          distanceKm: Number((1.4 + index * 0.8).toFixed(1)),
          etaLabel: index === 0 ? "Same-day pickup" : `Pickup in ${30 + index * 15}m`,
          signalLabel: productSignals[index % productSignals.length],
          momentumLabel: `${4 + index} chats opened today`,
          image: productImages[index % productImages.length],
          actionLabel: "View",
          actionPath: routes.posts,
        })) || [];

      const allCards = [...mappedPosts, ...mappedServices, ...mappedProducts].slice(0, 9);
      const fallbackCards: NearbyCard[] = [
        {
          id: "demo-demand-electrician",
          focusId: "demo-demand-electrician",
          type: "demand",
          title: "Need urgent electrician nearby",
          subtitle: "Power issue in 2BHK apartment",
          priceLabel: "Budget ₹1200",
          distanceKm: 1.1,
          etaLabel: "Starts in 20m",
          signalLabel: "High urgency",
          momentumLabel: "11 responders watching",
          image: demandImages[0],
          actionLabel: "Respond",
          actionPath: routes.posts,
        },
        {
          id: "demo-service-cleaning",
          focusId: "demo-service-cleaning",
          type: "service",
          title: "Home deep cleaning by verified provider",
          subtitle: "Cleaning service",
          priceLabel: "From ₹399",
          distanceKm: 1.9,
          etaLabel: "Available now",
          signalLabel: "Verified provider",
          momentumLabel: "4 bookings in progress",
          image: serviceImages[0],
          actionLabel: "Book",
          actionPath: routes.posts,
        },
        {
          id: "demo-product-tools",
          focusId: "demo-product-tools",
          type: "product",
          title: "Local seller: power tools kit",
          subtitle: "Tools and hardware",
          priceLabel: "₹1499",
          distanceKm: 2.6,
          etaLabel: "Same-day pickup",
          signalLabel: "Trusted seller",
          momentumLabel: "7 chats opened today",
          image: productImages[0],
          actionLabel: "View",
          actionPath: routes.posts,
        },
        {
          id: "demo-demand-plumber",
          focusId: "demo-demand-plumber",
          type: "demand",
          title: "Plumber needed for kitchen leakage",
          subtitle: "Immediate fix requested",
          priceLabel: "Budget ₹850",
          distanceKm: 2.1,
          etaLabel: "Starts in 35m",
          signalLabel: "Budget confirmed",
          momentumLabel: "8 responders watching",
          image: demandImages[1],
          actionLabel: "Respond",
          actionPath: routes.posts,
        },
        {
          id: "demo-service-ac",
          focusId: "demo-service-ac",
          type: "service",
          title: "AC servicing with same-day slot",
          subtitle: "Appliance maintenance",
          priceLabel: "From ₹699",
          distanceKm: 3.0,
          etaLabel: "Available in 40m",
          signalLabel: "4.9 avg rating",
          momentumLabel: "6 bookings in progress",
          image: serviceImages[1],
          actionLabel: "Book",
          actionPath: routes.posts,
        },
        {
          id: "demo-product-bike",
          focusId: "demo-product-bikewash",
          type: "product",
          title: "Bike wash kit + polish combo",
          subtitle: "Automotive essentials",
          priceLabel: "₹799",
          distanceKm: 1.7,
          etaLabel: "Pickup in 45m",
          signalLabel: "Local warranty",
          momentumLabel: "5 chats opened today",
          image: productImages[1],
          actionLabel: "View",
          actionPath: routes.posts,
        },
        {
          id: "demo-demand-tutor",
          focusId: "demo-demand-tutor",
          type: "demand",
          title: "Math tutor for class 10 board prep",
          subtitle: "Weekend evening batches",
          priceLabel: "Budget ₹500/session",
          distanceKm: 2.4,
          etaLabel: "Starts in 60m",
          signalLabel: "Frequent requester",
          momentumLabel: "9 responders watching",
          image: demandImages[0],
          actionLabel: "Respond",
          actionPath: routes.posts,
        },
        {
          id: "demo-service-photo",
          focusId: "demo-service-photographer",
          type: "service",
          title: "Event photographer for small gatherings",
          subtitle: "Creative services",
          priceLabel: "From ₹2499",
          distanceKm: 3.3,
          etaLabel: "Available in 2h",
          signalLabel: "Fast response",
          momentumLabel: "3 bookings in progress",
          image: serviceImages[0],
          actionLabel: "Book",
          actionPath: routes.posts,
        },
        {
          id: "demo-product-organic",
          focusId: "demo-product-organic",
          type: "product",
          title: "Organic groceries starter basket",
          subtitle: "Fresh farm produce",
          priceLabel: "₹1299",
          distanceKm: 1.3,
          etaLabel: "Pickup in 30m",
          signalLabel: "Trusted seller",
          momentumLabel: "10 chats opened today",
          image: productImages[0],
          actionLabel: "View",
          actionPath: routes.posts,
        },
      ];

      setNearbyCards(
        allCards.length
          ? allCards
          : fallbackCards
      );
      } catch (error) {
        if (isAbortLikeError(error)) {
          return;
        }

        const message = isFailedFetchError(error)
          ? "Network issue while loading your welcome dashboard."
          : toErrorMessage(error, "Failed to load welcome dashboard.");
        console.warn("Welcome load failed:", message);
        if (isActive) {
          setLoadError(message);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    void loadWelcome();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-slate-100 via-indigo-50 to-slate-100 text-slate-900">
        <div className="w-full max-w-[2200px] mx-auto py-2 sm:py-4 space-y-5 sm:space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl p-5 sm:p-7 bg-gradient-to-br from-sky-600 via-indigo-600 to-fuchsia-600 shadow-xl"
          >
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.3),transparent_45%),radial-gradient(circle_at_85%_90%,rgba(255,255,255,0.18),transparent_42%)]" />
              <div className="absolute inset-0 opacity-25 [background-size:32px_32px] [background-image:linear-gradient(to_right,rgba(255,255,255,0.15)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.15)_1px,transparent_1px)]" />
              <motion.div
                className="absolute -left-16 top-8 h-40 w-40 rounded-full bg-cyan-300/35 blur-3xl"
                animate={{ x: [0, 28, 0], y: [0, -18, 0], opacity: [0.35, 0.7, 0.35] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="absolute right-0 top-0 h-36 w-36 rounded-full bg-fuchsia-300/30 blur-3xl"
                animate={{ x: [0, -20, 0], y: [0, 16, 0], opacity: [0.3, 0.55, 0.3] }}
                transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>

            <div className="relative grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">
                  Welcome back, {loading ? "..." : userName} 👋
                </h1>
                <p className="text-white/90 mt-2 max-w-2xl text-sm sm:text-base">
                  Take action fast: post needs, connect nearby, and move local tasks to completion.
                </p>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={`hero-inline-${currentHeroScene.title}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.28 }}
                    className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1.5 backdrop-blur"
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${heroToneDotClasses[currentHeroScene.tone]} animate-pulse`}
                    />
                    <span className="text-[10px] uppercase tracking-[0.14em] text-white/70">Live routing</span>
                    <span className="truncate text-xs font-medium text-white">{currentHeroScene.title}</span>
                  </motion.div>
                </AnimatePresence>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {heroQuickActions.map((item) => (
                    <button
                      key={item.title}
                      onClick={item.action}
                      className="rounded-xl border border-white/35 bg-white/15 px-3.5 py-3 text-left text-white backdrop-blur transition-colors hover:bg-white/25"
                    >
                      <item.icon size={15} className="mb-2 text-cyan-100" />
                      <p className="text-sm font-semibold">{item.title}</p>
                    </button>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {marketSignals.map((signal) => (
                    <div key={signal.label} className="rounded-xl bg-white/15 backdrop-blur px-3 py-2">
                      <div className="flex items-center gap-1.5 text-white/85 text-xs">
                        <signal.icon size={13} />
                        {signal.label}
                      </div>
                      <p className="mt-1 text-lg font-semibold text-white">{signal.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/35 bg-slate-950/30 p-3 backdrop-blur-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/85">
                    Live Marketplace Canvas
                  </p>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/40 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-100">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-200 animate-pulse" />
                    Realtime
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  {heroScenes.map((scene, index) => (
                    <div key={`scene-progress-${scene.title}`} className="h-1.5 overflow-hidden rounded-full bg-white/20">
                      <motion.div
                        key={`scene-progress-fill-${scene.title}-${index === activeHeroScene}`}
                        className={`h-full rounded-full bg-gradient-to-r ${heroToneTrackClasses[scene.tone]}`}
                        initial={{ width: "0%" }}
                        animate={{ width: index === activeHeroScene ? "100%" : "0%" }}
                        transition={{
                          duration: index === activeHeroScene ? 3.1 : 0.2,
                          ease: "linear",
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div className="relative mt-2 overflow-hidden rounded-xl border border-white/20 bg-slate-950/65 p-3">
                  <div className="pointer-events-none absolute inset-0">
                    <div className="absolute inset-0 opacity-25 [background-size:26px_26px] [background-image:linear-gradient(to_right,rgba(148,163,184,0.28)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.28)_1px,transparent_1px)]" />
                    <motion.div
                      className={`absolute -left-14 top-2 h-32 w-32 rounded-full blur-3xl ${heroToneGlowClasses[currentHeroScene.tone]}`}
                      animate={{ x: [0, 18, 0], y: [0, -10, 0], opacity: [0.35, 0.65, 0.35] }}
                      transition={{ duration: 5.4, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.div
                      className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/15 to-transparent"
                      animate={{ opacity: [0.2, 0.45, 0.2] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    />
                  </div>

                  <div className="relative h-40">
                    <div className="absolute left-1.5 top-1.5 rounded-md border border-white/20 bg-slate-900/65 px-2 py-1 text-[10px] text-white/80">
                      Radius 2.5 km
                    </div>
                    <div className="absolute right-1.5 top-1.5 rounded-md border border-white/20 bg-slate-900/65 px-2 py-1 text-[10px] text-white/80">
                      Match pulse {currentHeroScene.eta}
                    </div>

                    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      {heroFlowPaths.map((path) => (
                        <motion.path
                          key={path.id}
                          d={path.d}
                          fill="none"
                          stroke="rgba(148, 163, 184, 0.62)"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeDasharray="3.2 5.2"
                          animate={{ strokeDashoffset: [0, -36], opacity: [0.3, 0.75, 0.3] }}
                          transition={{
                            duration: 4.5,
                            repeat: Infinity,
                            ease: "linear",
                            delay: path.delay,
                          }}
                        />
                      ))}
                    </svg>

                    {heroDataStreams.map((stream) => (
                      <motion.span
                        key={stream.id}
                        className={`absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${heroToneDotClasses[currentHeroScene.tone]}`}
                        style={{
                          left: stream.left[0],
                          top: stream.top[0],
                          boxShadow: `0 0 18px ${heroToneStrokeColors[currentHeroScene.tone]}`,
                        }}
                        animate={{
                          left: stream.left,
                          top: stream.top,
                          opacity: [0, 1, 1, 1, 0],
                          scale: [0.75, 1, 1, 0.95, 0.75],
                        }}
                        transition={{
                          duration: stream.duration,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: stream.delay,
                        }}
                      />
                    ))}

                    {heroNetworkNodes.map((node, index) => (
                      <div
                        key={node.id}
                        className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
                        style={{ left: node.x, top: node.y }}
                      >
                        <div className="relative mx-auto h-3.5 w-3.5">
                          <span className={`absolute inset-0 rounded-full ${heroToneDotClasses[node.tone]}`} />
                          <motion.span
                            className={`absolute inset-0 rounded-full border ${heroToneRingClasses[node.tone]}`}
                            animate={{ scale: [1, 2.5], opacity: [0.75, 0] }}
                            transition={{
                              duration: 2.4,
                              repeat: Infinity,
                              ease: "easeOut",
                              delay: index * 0.3,
                            }}
                          />
                        </div>
                        <p className="mt-1 text-[10px] font-semibold text-white/90">{node.label}</p>
                      </div>
                    ))}

                    <div className="absolute bottom-0 left-0 right-0">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={`hero-scene-${currentHeroScene.title}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.28 }}
                          className="rounded-lg border border-white/20 bg-slate-900/72 px-3 py-2 backdrop-blur"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${heroToneBadgeClasses[currentHeroScene.tone]}`}>
                              {currentHeroScene.label}
                            </span>
                            <span className="text-[10px] text-white/75">{currentHeroScene.eta}</span>
                          </div>
                          <p className="mt-1 text-sm font-semibold text-white">{currentHeroScene.title}</p>
                          <p className="text-[11px] text-white/80">{currentHeroScene.meta}</p>
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-white/85">
                  <div className="rounded-lg border border-white/20 bg-white/10 px-2 py-1.5">
                    <p className="text-white/70">Live Requests</p>
                    <p className="font-semibold">{stats.nearbyPosts}</p>
                  </div>
                  <div className="rounded-lg border border-white/20 bg-white/10 px-2 py-1.5">
                    <p className="text-white/70">Active Threads</p>
                    <p className="font-semibold">{stats.unreadMessages + 12}</p>
                  </div>
                  <div className="rounded-lg border border-white/20 bg-white/10 px-2 py-1.5">
                    <p className="text-white/70">Trust Index</p>
                    <p className="font-semibold">{stats.trustScore.toFixed(1)}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {!!loadError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {loadError}
            </div>
          )}

          <div className="grid min-w-0 grid-cols-1 gap-4">
            <section className="min-w-0 rounded-2xl border border-slate-200 bg-white/85 backdrop-blur p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Stories
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => router.push(routes.posts)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    Open feed
                  </button>
                  <button
                    onClick={() => scrollStories("left")}
                    aria-label="Scroll stories left"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={() => scrollStories("right")}
                    aria-label="Scroll stories right"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <div
                  ref={storiesScrollRef}
                  onWheel={handleStoriesWheel}
                  onPointerDown={handleStoriesPointerDown}
                  onPointerMove={handleStoriesPointerMove}
                  onPointerUp={handleStoriesPointerUp}
                  onPointerCancel={handleStoriesPointerUp}
                  className="w-full max-w-full cursor-grab active:cursor-grabbing select-none overflow-x-auto overflow-y-hidden pb-1 overscroll-x-contain touch-pan-x [scrollbar-width:thin]"
                >
                  <div className="flex w-max gap-3 sm:gap-3.5">
                    {storyItems.map((story, storyIndex) => {
                      const focusPath = `${story.actionPath}?focus=${encodeURIComponent(story.focusId)}&type=${encodeURIComponent(story.type)}`;

                      return (
                        <article key={`story-${story.id}-${storyIndex}`} className="w-[170px] sm:w-[186px] shrink-0">
                          <button
                            onClick={() => router.push(focusPath)}
                            className="group w-full rounded-xl border border-slate-200 bg-white p-2.5 text-left transition-colors hover:border-indigo-300"
                          >
                            <div className="relative">
                              <div className="relative h-20 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                                <Image src={story.image} alt={story.title} fill sizes="180px" className="object-cover" />
                              </div>
                              <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border border-white bg-emerald-500 animate-pulse" />
                              <span className="absolute left-1.5 top-1.5 rounded-full bg-slate-900/80 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                                {story.badge}
                              </span>
                            </div>

                            <p className="mt-2 text-[11px] text-slate-600 line-clamp-1">{story.subtitle}</p>
                            <p className="mt-1 text-[12px] font-semibold text-slate-900 line-clamp-1">
                              {formatStoryPriceLine(story)}
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-500">Radius {story.distanceKm} km</p>
                            <p className="mt-0.5 text-[11px] text-emerald-700 font-medium line-clamp-1">
                              Availability: {story.etaLabel}
                            </p>
                            <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 group-hover:text-indigo-500">
                              <ArrowRight size={10} />
                            </span>
                          </button>
                        </article>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-200 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Live Local Feed</h3>
                      <p className="text-xs text-slate-500">Realtime list, scroll vertically for more.</p>
                    </div>
                    <button
                      onClick={() => router.push(routes.posts)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      Explore all
                    </button>
                  </div>

                  <div className="mt-3 space-y-3 min-h-[280px] max-h-[56vh] overflow-y-auto pr-1">
                    {enrichedCards.map((card) => {
                      const focusPath = `${card.actionPath}?focus=${encodeURIComponent(card.focusId)}&type=${encodeURIComponent(card.type)}`;

                      return (
                        <article key={`feed-inline-${card.id}`} className="rounded-xl border border-slate-200 bg-white p-3 sm:p-3.5">
                          <div className="flex items-start gap-3">
                            <div className="flex items-start gap-2 shrink-0">
                              <div className="relative h-14 w-14 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                                <Image src={card.mediaGallery[0]} alt={card.title} fill sizes="56px" className="object-cover" />
                              </div>
                              <div className="relative h-14 w-10 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                                <Image src={card.mediaGallery[1]} alt={`${card.title} preview`} fill sizes="40px" className="object-cover" />
                                <span className="absolute inset-0 bg-black/30 text-[10px] text-white font-semibold flex items-center justify-center">
                                  +{card.mediaCount}
                                </span>
                              </div>
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                    card.type === "demand"
                                      ? "bg-rose-100 text-rose-700"
                                      : card.type === "service"
                                      ? "bg-indigo-100 text-indigo-700"
                                      : "bg-emerald-100 text-emerald-700"
                                  }`}
                                >
                                  {card.type}
                                </span>
                                <span className="text-[11px] text-slate-500">{card.distanceKm} km</span>
                                <span className="text-[11px] text-slate-500">{card.postedAgo}</span>
                              </div>

                              <p className="mt-1 text-[15px] font-semibold text-slate-900 line-clamp-1">{card.title}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-1">
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">{card.priceLabel}</span>
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">{card.etaLabel}</span>
                              </div>

                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                <button
                                  onClick={() => router.push(focusPath)}
                                  className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
                                >
                                  {card.actionLabel}
                                  <ArrowRight size={11} />
                                </button>
                                <button
                                  onClick={() => router.push(routes.chat)}
                                  className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                                >
                                  Message
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

          </div>

          <section className="rounded-2xl border border-slate-200 bg-white/85 backdrop-blur p-4 sm:p-5 shadow-sm">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-4 sm:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-600">About Local Marketplace</p>
                <h2 className="mt-2 text-lg sm:text-xl font-semibold text-slate-900">
                  A realtime neighborhood network for needs, services, and products.
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  We help people post local needs quickly, match with nearby providers, and close tasks with trust, speed, and clarity.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-700">
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">Post</span>
                  <ArrowRight size={12} className="text-slate-400" />
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">Match</span>
                  <ArrowRight size={12} className="text-slate-400" />
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">Chat</span>
                  <ArrowRight size={12} className="text-slate-400" />
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">Complete</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {aboutCards.map((card, index) => (
                  <article
                    key={`about-card-${index}`}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="rounded-lg bg-indigo-100 p-2">
                        <card.icon className="text-indigo-600" size={16} />
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        {card.metric}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{card.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{card.desc}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>

      <CreatePostModal
        open={openPostModal}
        onClose={() => setOpenPostModal(false)}
        onPublished={(result) => {
          setOpenPostModal(false);
          if (result?.helpRequestId) {
            router.push(`/dashboard?help_request=${encodeURIComponent(result.helpRequestId)}`);
            return;
          }
          router.push("/dashboard");
        }}
      />
    </>
  );
}
