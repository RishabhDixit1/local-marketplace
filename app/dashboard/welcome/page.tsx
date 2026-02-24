"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import CreatePostModal from "../../components/CreatePostModal";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Circle,
  ClipboardList,
  Clock3,
  MapPin,
  MessageCircle,
  Plus,
  ShieldCheck,
  Star,
  TrendingUp,
  Users,
  Wrench,
  Zap,
} from "lucide-react";

type WelcomeStats = {
  nearbyPosts: number;
  activeTasks: number;
  unreadMessages: number;
  trustScore: number;
};

type ProviderSnapshot = {
  services: number;
  products: number;
  openOrders: number;
  profileReady: boolean;
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
  image: string;
  actionLabel: string;
  actionPath: string;
};

type OnboardingStep = {
  id: string;
  title: string;
  hint: string;
  done: boolean;
  path: string;
  cta: string;
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

const routes = {
  posts: "/dashboard",
  people: "/dashboard/people",
  profile: "/dashboard/profile",
  tasks: "/dashboard/tasks",
  chat: "/dashboard/chat",
  addService: "/dashboard/provider/add-service",
  addProduct: "/dashboard/provider/add-product",
  listings: "/dashboard/provider/listings",
  orders: "/dashboard/tasks",
} as const;

const providerRoles = new Set(["provider", "seller", "service_provider", "business"]);

export default function WelcomePage() {
  const router = useRouter();

  const [openPostModal, setOpenPostModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("Neighbor");
  const [isProvider, setIsProvider] = useState(false);
  const [profileStrength, setProfileStrength] = useState(40);
  const [stats, setStats] = useState<WelcomeStats>({
    nearbyPosts: 0,
    activeTasks: 0,
    unreadMessages: 0,
    trustScore: 4.7,
  });
  const [nearbyCards, setNearbyCards] = useState<NearbyCard[]>([]);
  const [onboardingSteps, setOnboardingSteps] = useState<OnboardingStep[]>([]);
  const [providerSnapshot, setProviderSnapshot] = useState<ProviderSnapshot>({
    services: 0,
    products: 0,
    openOrders: 0,
    profileReady: false,
  });

  const features = [
    {
      title: "Real-time Needs",
      desc: "Post requests and get instant responses nearby.",
      icon: Zap,
    },
    {
      title: "Hyperlocal Discovery",
      desc: "Find services and products within your radius.",
      icon: MapPin,
    },
    {
      title: "Trust and Ratings",
      desc: "Build reputation through verified work.",
      icon: ShieldCheck,
    },
  ];

  const statCards = useMemo(
    () => [
      { label: "Nearby Posts", value: String(stats.nearbyPosts), icon: MapPin },
      { label: "Active Tasks", value: String(stats.activeTasks), icon: ClipboardList },
      { label: "Unread Messages", value: String(stats.unreadMessages), icon: MessageCircle },
      { label: "Trust Score", value: stats.trustScore.toFixed(1), icon: Star },
    ],
    [stats]
  );

  const primaryHeroAction = isProvider
    ? {
        label: "Add Service",
        action: () => router.push(routes.addService),
      }
    : {
        label: "Post a Need",
        action: () => setOpenPostModal(true),
      };

  const completedOnboarding = onboardingSteps.filter((step) => step.done).length;

  const storyItems = useMemo(
    () =>
      nearbyCards.slice(0, 8).map((card) => ({
        ...card,
        badge: card.type === "demand" ? "Need" : card.type === "service" ? "Service" : "Product",
      })),
    [nearbyCards]
  );

  const marketSignals = useMemo(
    () => [
      {
        label: "Open Needs",
        value: nearbyCards.filter((card) => card.type === "demand").length,
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
    [nearbyCards, stats.activeTasks, stats.unreadMessages, stats.trustScore]
  );

  useEffect(() => {
    const loadWelcome = async () => {
      setLoading(true);

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        setLoading(false);
        return;
      }

      const currentUser = authData.user;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("name, role, location, bio, services, availability, email, phone, website")
        .eq("id", currentUser.id)
        .maybeSingle<UserProfile>();

      const role = (profileData?.role || "").toLowerCase();
      const isProviderRole = providerRoles.has(role);

      setUserName(profileData?.name || currentUser.email?.split("@")[0] || "Neighbor");
      setIsProvider(isProviderRole);

      const profilePoints =
        (profileData?.name ? 15 : 0) +
        (profileData?.location ? 15 : 0) +
        ((profileData?.bio || "").trim().length >= 20 ? 20 : 0) +
        ((profileData?.services?.length || 0) > 0 ? 20 : 0) +
        (profileData?.email ? 10 : 0) +
        (profileData?.phone ? 10 : 0) +
        (profileData?.website ? 10 : 0);

      const profileCompletion = Math.min(100, profilePoints);
      setProfileStrength(profileCompletion);

      const [{ count: nearbyPostsCount }, { data: myOrders }, { data: myConversations }, { data: reviewsData }] =
        await Promise.all([
          supabase.from("posts").select("*", { count: "exact", head: true }).eq("status", "open"),
          supabase
            .from("orders")
            .select("status")
            .or(`consumer_id.eq.${currentUser.id},provider_id.eq.${currentUser.id}`),
          supabase.from("conversation_participants").select("conversation_id").eq("user_id", currentUser.id),
          supabase.from("reviews").select("rating").eq("provider_id", currentUser.id),
        ]);

      const activeTasks =
        myOrders?.filter(
          (order) => !["completed", "cancelled", "closed"].includes((order.status || "").toLowerCase())
        ).length || 0;

      const conversationIds = myConversations?.map((row) => row.conversation_id) || [];
      let unreadMessages = 0;

      if (conversationIds.length > 0) {
        const { count } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .in("conversation_id", conversationIds)
          .neq("sender_id", currentUser.id);
        unreadMessages = count || 0;
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
        supabase.from("posts").select("id, text").eq("status", "open").limit(3),
        supabase.from("service_listings").select("id, title, category, price").limit(3),
        supabase.from("product_catalog").select("id, title, category, price").limit(3),
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

      const mappedPosts: NearbyCard[] =
        (recentPosts as RawPost[] | null)?.map((post, index) => ({
          id: `post-${post.id}`,
          focusId: post.id,
          type: "demand",
          title: post.text || "New local need",
          subtitle: "Demand posted by nearby customer",
          priceLabel: "Budget shared in chat",
          distanceKm: Number((0.8 + index * 0.9).toFixed(1)),
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
          image: productImages[index % productImages.length],
          actionLabel: "View",
          actionPath: routes.posts,
        })) || [];

      const allCards = [...mappedPosts, ...mappedServices, ...mappedProducts].slice(0, 6);

      setNearbyCards(
        allCards.length
          ? allCards
          : [
              {
                id: "demo-demand",
                focusId: "demo1",
                type: "demand",
                title: "Need urgent electrician nearby",
                subtitle: "Power issue at home",
                priceLabel: "Budget shared in chat",
                distanceKm: 1.1,
                image: demandImages[0],
                actionLabel: "Respond",
                actionPath: routes.posts,
              },
              {
                id: "demo-service",
                focusId: "demo2",
                type: "service",
                title: "Home cleaning by verified provider",
                subtitle: "Cleaning service",
                priceLabel: "From ₹399",
                distanceKm: 1.9,
                image: serviceImages[0],
                actionLabel: "Book",
                actionPath: routes.posts,
              },
              {
                id: "demo-product",
                focusId: "demo3",
                type: "product",
                title: "Local seller: power tools",
                subtitle: "Tools and hardware",
                priceLabel: "₹1499",
                distanceKm: 2.6,
                image: productImages[0],
                actionLabel: "View",
                actionPath: routes.posts,
              },
            ]
      );

      const [{ count: myPostsCount }, { count: myServicesCount }, { count: myProductsCount }] = await Promise.all([
        supabase.from("posts").select("*", { count: "exact", head: true }).eq("user_id", currentUser.id),
        supabase.from("service_listings").select("*", { count: "exact", head: true }).eq("provider_id", currentUser.id),
        supabase.from("product_catalog").select("*", { count: "exact", head: true }).eq("provider_id", currentUser.id),
      ]);

      if (isProviderRole) {
        const { count: openOrdersCount } = await supabase
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("provider_id", currentUser.id)
          .in("status", ["pending", "active", "in-progress"]);

        setProviderSnapshot({
          services: myServicesCount || 0,
          products: myProductsCount || 0,
          openOrders: openOrdersCount || 0,
          profileReady: profileCompletion >= 70,
        });
      }

      if (isProviderRole) {
        setOnboardingSteps([
          {
            id: "provider-1",
            title: "Complete provider profile",
            hint: "Add bio, services and contact details",
            done: profileCompletion >= 70,
            path: routes.profile,
            cta: "Update Profile",
          },
          {
            id: "provider-2",
            title: "Add your first offering",
            hint: "Publish at least one service or product",
            done: (myServicesCount || 0) + (myProductsCount || 0) > 0,
            path: routes.addService,
            cta: "Add Offering",
          },
          {
            id: "provider-3",
            title: "Start local conversations",
            hint: "Respond to nearby demand posts",
            done: conversationIds.length > 0,
            path: routes.chat,
            cta: "Open Chat",
          },
        ]);
      } else {
        setOnboardingSteps([
          {
            id: "customer-1",
            title: "Complete profile",
            hint: "Help local providers trust your requests",
            done: profileCompletion >= 60,
            path: routes.profile,
            cta: "Update Profile",
          },
          {
            id: "customer-2",
            title: "Post your first need",
            hint: "Tell nearby sellers/providers what you need",
            done: (myPostsCount || 0) > 0,
            path: routes.posts,
            cta: "Post Need",
          },
          {
            id: "customer-3",
            title: "Connect with a provider",
            hint: "Start a chat to compare options",
            done: conversationIds.length > 0,
            path: routes.people,
            cta: "Find Providers",
          },
        ]);
      }

      setLoading(false);
    };

    loadWelcome();
  }, []);

  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-slate-100 via-indigo-50 to-slate-100 text-slate-900">
        <div className="w-full max-w-[2200px] mx-auto py-2 sm:py-4 space-y-5 sm:space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl p-5 sm:p-7 bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 shadow-lg"
          >
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Welcome back, {loading ? "..." : userName} 👋</h1>
            <p className="text-white/90 mt-2 max-w-2xl text-sm sm:text-base">
              Your local marketplace pulse in one place: stories, live posts, trusted providers, and quick actions.
            </p>

            <div className="flex flex-wrap gap-3 mt-5">
              <button
                onClick={primaryHeroAction.action}
                className="px-5 py-2.5 rounded-xl bg-white text-indigo-700 font-semibold hover:bg-indigo-50 transition-colors"
              >
                {primaryHeroAction.label}
              </button>
              <button
                onClick={() => router.push(routes.people)}
                className="px-5 py-2.5 rounded-xl border border-white/50 text-white hover:bg-white/10 flex items-center gap-2 transition-colors"
              >
                <Users size={16} />
                Explore Nearby
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2">
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
          </motion.div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.95fr] gap-4">
            <section className="rounded-2xl border border-slate-200 bg-white/85 backdrop-blur p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold">Neighborhood Stories</h2>
                  <p className="text-xs text-slate-500">Tap a story card to jump directly into the related post or listing.</p>
                </div>
                <button
                  onClick={() => router.push(routes.posts)}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                >
                  View feed
                </button>
              </div>

              <div className="mt-4 overflow-x-auto pb-1">
                <div className="flex min-w-max gap-3">
                  {storyItems.map((story) => (
                    <button
                      key={`story-${story.id}`}
                      onClick={() =>
                        router.push(
                          `${story.actionPath}?focus=${encodeURIComponent(story.focusId)}&type=${encodeURIComponent(story.type)}`
                        )
                      }
                      className="w-24 shrink-0 text-left"
                    >
                      <div
                        className={`rounded-2xl p-[2px] ${
                          story.type === "demand"
                            ? "bg-gradient-to-br from-rose-400 to-orange-400"
                            : story.type === "service"
                            ? "bg-gradient-to-br from-indigo-400 to-sky-400"
                            : "bg-gradient-to-br from-emerald-400 to-teal-400"
                        }`}
                      >
                        <div className="relative h-28 w-full overflow-hidden rounded-[14px] bg-slate-200">
                          <Image src={story.image} alt={story.title} fill className="object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
                          <span className="absolute left-2 top-2 rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-semibold text-slate-900">
                            {story.badge}
                          </span>
                          <p className="absolute bottom-2 left-2 right-2 text-[10px] leading-tight font-medium text-white line-clamp-2">
                            {story.title}
                          </p>
                        </div>
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-600 line-clamp-1">{story.distanceKm} km away</p>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white/85 backdrop-blur p-4 sm:p-5 shadow-sm">
              <h2 className="text-base sm:text-lg font-semibold">Quick Actions</h2>
              <p className="text-xs text-slate-500 mt-1">Shortcuts built for fast local execution.</p>

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                {[
                  { title: "Post Need", icon: Plus, action: () => setOpenPostModal(true) },
                  { title: "Offer Service", icon: Wrench, action: () => router.push(routes.addService) },
                  { title: "Find People", icon: Users, action: () => router.push(routes.people) },
                  { title: "My Tasks", icon: ClipboardList, action: () => router.push(routes.tasks) },
                ].map((item, index) => (
                  <button
                    key={`quick-${index}`}
                    onClick={item.action}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-left hover:border-indigo-300 hover:bg-indigo-50/60 transition-colors"
                  >
                    <item.icon className="text-indigo-500 mb-2" size={16} />
                    <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                  </button>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                {statCards.map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-500">{stat.label}</p>
                      <stat.icon size={13} className="text-indigo-500" />
                    </div>
                    <p className="text-base font-semibold text-slate-900 mt-1">{stat.value}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4">
            <section className="rounded-2xl border border-slate-200 bg-white/85 backdrop-blur p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold">Live Local Feed</h2>
                  <p className="text-xs text-slate-500">Compact stream of nearby needs, services, and products.</p>
                </div>
                <button
                  onClick={() => router.push(routes.posts)}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                >
                  Explore all
                </button>
              </div>

              <div className="mt-3 divide-y divide-slate-200">
                {nearbyCards.map((card) => (
                  <div key={`feed-${card.id}`} className="py-3 flex items-center gap-3">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-200">
                      <Image src={card.image} alt={card.title} fill className="object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
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
                      </div>
                      <p className="text-sm font-semibold text-slate-900 mt-1 line-clamp-1">{card.title}</p>
                      <p className="text-xs text-slate-500 line-clamp-1">{card.subtitle}</p>
                    </div>
                    <button
                      onClick={() =>
                        router.push(
                          `${card.actionPath}?focus=${encodeURIComponent(card.focusId)}&type=${encodeURIComponent(card.type)}`
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                    >
                      {card.actionLabel}
                      <ArrowRight size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <div className="space-y-4">
              <section className="rounded-2xl border border-slate-200 bg-white/85 backdrop-blur p-4 sm:p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base sm:text-lg font-semibold">{isProvider ? "Provider Launchpad" : "Customer Launchpad"}</h2>
                  <span className="text-xs text-slate-500">
                    {completedOnboarding}/{onboardingSteps.length} completed
                  </span>
                </div>

                <div className="mt-3 space-y-2.5">
                  {onboardingSteps.map((step) => (
                    <div key={step.id} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex items-start gap-2">
                        {step.done ? (
                          <CheckCircle2 className="text-emerald-500 mt-0.5" size={17} />
                        ) : (
                          <Circle className="text-slate-400 mt-0.5" size={17} />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800">{step.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{step.hint}</p>
                        </div>
                      </div>
                      {!step.done && (
                        <button
                          onClick={() => router.push(step.path)}
                          className="mt-2.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-white"
                        >
                          {step.cta}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {isProvider && (
                <section className="rounded-2xl border border-slate-200 bg-white/85 backdrop-blur p-4 sm:p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">Provider Hub</h3>
                    <span className="text-xs text-slate-500 inline-flex items-center gap-1">
                      <TrendingUp size={12} />
                      Live snapshot
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                      <p className="text-xs text-slate-500">Services</p>
                      <p className="text-sm font-semibold">{providerSnapshot.services}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                      <p className="text-xs text-slate-500">Products</p>
                      <p className="text-sm font-semibold">{providerSnapshot.products}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                      <p className="text-xs text-slate-500">Open Orders</p>
                      <p className="text-sm font-semibold">{providerSnapshot.openOrders}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                      <p className="text-xs text-slate-500">Status</p>
                      <p className="text-sm font-semibold text-emerald-600">
                        {providerSnapshot.profileReady ? "Ready" : "Needs Update"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => router.push(routes.addService)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium hover:border-indigo-300 hover:text-indigo-600"
                    >
                      Add Service
                    </button>
                    <button
                      onClick={() => router.push(routes.addProduct)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium hover:border-indigo-300 hover:text-indigo-600"
                    >
                      Add Product
                    </button>
                    <button
                      onClick={() => router.push(routes.listings)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium hover:border-indigo-300 hover:text-indigo-600"
                    >
                      My Listings
                    </button>
                    <button
                      onClick={() => router.push(routes.orders)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium hover:border-indigo-300 hover:text-indigo-600"
                    >
                      Orders
                    </button>
                  </div>
                </section>
              )}

              <section className="rounded-2xl border border-slate-200 bg-white/85 backdrop-blur p-4 sm:p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Profile Strength</span>
                  <span className="text-sm font-semibold text-indigo-600">{profileStrength}%</span>
                </div>
                <div className="mt-2 h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500" style={{ width: `${profileStrength}%` }} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => router.push(routes.profile)}
                    className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Improve Profile
                  </button>
                  <button
                    onClick={() => setOpenPostModal(true)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-indigo-300 hover:text-indigo-600"
                  >
                    Create Post
                  </button>
                </div>
              </section>
            </div>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white/85 backdrop-blur p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Core Platform Features</h2>
                <p className="text-xs text-slate-500">Startup-grade essentials, optimized for local commerce velocity.</p>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1 text-xs text-slate-500">
                <Clock3 size={12} />
                Real-time updates
              </span>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {features.map((feature, index) => (
                <div
                  key={`feature-${index}`}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 flex items-start gap-3"
                >
                  <div className="mt-0.5 rounded-lg bg-indigo-100 p-2">
                    <feature.icon className="text-indigo-600" size={16} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-slate-900">{feature.title}</p>
                    <p className="text-xs text-slate-500 mt-1">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <CreatePostModal open={openPostModal} onClose={() => setOpenPostModal(false)} />
    </>
  );
}
