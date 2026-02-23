"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import CreatePostModal from "../../components/CreatePostModal";
import {
  CheckCircle2,
  Circle,
  ClipboardList,
  MapPin,
  MessageCircle,
  Package,
  Plus,
  ShieldCheck,
  Star,
  Store,
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
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-black text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl sm:rounded-3xl p-5 sm:p-8 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 shadow-xl"
          >
            <h1 className="text-2xl sm:text-3xl font-bold">Welcome back, {loading ? "..." : userName} 👋</h1>
            <p className="text-white/90 mt-2 max-w-xl">
              Connect with nearby providers, sell services, post needs, and build your local reputation in real time.
            </p>

            <div className="flex flex-wrap gap-3 mt-6">
              <button
                onClick={primaryHeroAction.action}
                className="px-5 py-3 bg-indigo-600 rounded-xl"
              >
                {primaryHeroAction.label}
              </button>
              <button
                onClick={() => router.push(routes.people)}
                className="px-5 py-2.5 rounded-xl border border-white/40 hover:bg-white/10 flex items-center gap-2"
              >
                <Users size={16} />
                Explore Nearby
              </button>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { title: "Post a Need", icon: Plus, action: () => setOpenPostModal(true) },
              { title: "Offer a Service", icon: Wrench, action: () => router.push(routes.addService) },
              { title: "Find People", icon: Users, action: () => router.push(routes.people) },
              { title: "My Tasks", icon: ClipboardList, action: () => router.push(routes.tasks) },
            ].map((item, i) => (
              <motion.button
                key={i}
                whileHover={{ scale: 1.03 }}
                onClick={item.action}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500 text-left"
              >
                <item.icon className="mb-3 text-indigo-400" />
                <div className="font-semibold">{item.title}</div>
              </motion.button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {statCards.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800"
              >
                <s.icon className="text-indigo-400 mb-2" />
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-sm text-slate-400">{s.label}</div>
              </motion.div>
            ))}
          </div>

          <div className="rounded-3xl p-6 bg-gradient-to-r from-blue-600/15 to-purple-600/15 border border-blue-500/20">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-xl font-semibold">{isProvider ? "Provider Launchpad" : "Customer Launchpad"}</h2>
              <span className="text-sm text-slate-300">
                {onboardingSteps.filter((step) => step.done).length}/{onboardingSteps.length} completed
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {onboardingSteps.map((step) => (
                <div key={step.id} className="rounded-xl bg-slate-900/80 border border-slate-700 p-4">
                  <div className="flex items-start gap-2">
                    {step.done ? (
                      <CheckCircle2 className="text-emerald-400 mt-0.5" size={18} />
                    ) : (
                      <Circle className="text-slate-500 mt-0.5" size={18} />
                    )}
                    <div>
                      <p className="font-medium text-sm">{step.title}</p>
                      <p className="text-xs text-slate-400 mt-1">{step.hint}</p>
                    </div>
                  </div>

                  {!step.done && (
                    <button
                      onClick={() => router.push(step.path)}
                      className="mt-3 text-xs bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg"
                    >
                      {step.cta}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {isProvider && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-3xl p-6 bg-gradient-to-r from-emerald-600/20 to-indigo-600/20 border border-emerald-500/20"
            >
              <h2 className="text-xl font-semibold mb-4">Provider Hub 🛠️</h2>
              <p className="text-slate-300 mb-6">
                Manage your services, products, pricing, and incoming requests from nearby customers.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="rounded-xl bg-slate-900 border border-slate-700 p-3">
                  <p className="text-xs text-slate-400">Services</p>
                  <p className="text-lg font-semibold">{providerSnapshot.services}</p>
                </div>
                <div className="rounded-xl bg-slate-900 border border-slate-700 p-3">
                  <p className="text-xs text-slate-400">Products</p>
                  <p className="text-lg font-semibold">{providerSnapshot.products}</p>
                </div>
                <div className="rounded-xl bg-slate-900 border border-slate-700 p-3">
                  <p className="text-xs text-slate-400">Open Orders</p>
                  <p className="text-lg font-semibold">{providerSnapshot.openOrders}</p>
                </div>
                <div className="rounded-xl bg-slate-900 border border-slate-700 p-3">
                  <p className="text-xs text-slate-400">Profile</p>
                  <p className="text-sm font-semibold text-emerald-300">
                    {providerSnapshot.profileReady ? "Ready" : "Needs Update"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button
                  onClick={() => router.push(routes.addService)}
                  className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500"
                >
                  <Wrench className="mb-2 text-emerald-400" />
                  Add Service
                </button>
                <button
                  onClick={() => router.push(routes.addProduct)}
                  className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500"
                >
                  <Package className="mb-2 text-indigo-400" />
                  Add Product
                </button>
                <button
                  onClick={() => router.push(routes.listings)}
                  className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-purple-500"
                >
                  <Store className="mb-2 text-purple-400" />
                  My Listings
                </button>
                <button
                  onClick={() => router.push(routes.orders)}
                  className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-pink-500"
                >
                  <ClipboardList className="mb-2 text-pink-400" />
                  Orders / Jobs
                </button>
              </div>
            </motion.div>
          )}

          <div className="rounded-3xl p-6 bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-xl font-semibold">What&apos;s Happening Nearby</h2>
              <button onClick={() => router.push(routes.posts)} className="text-sm text-indigo-300 hover:text-indigo-200">
                Explore all
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {nearbyCards.map((card) => (
                <div key={card.id} className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden">
                  <div className="relative h-36">
                    <Image src={card.image} alt={card.title} fill className="object-cover" />
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] uppercase tracking-wide text-indigo-300">{card.type}</span>
                      <span className="text-xs text-slate-400">{card.distanceKm} km away</span>
                    </div>
                    <h3 className="font-semibold leading-tight">{card.title}</h3>
                    <p className="text-xs text-slate-400 mt-1">{card.subtitle}</p>
                    <p className="text-sm text-emerald-300 mt-2">{card.priceLabel}</p>
                    <button
                      onClick={() =>
                        router.push(
                          `${card.actionPath}?focus=${encodeURIComponent(card.focusId)}&type=${encodeURIComponent(card.type)}`
                        )
                      }
                      className="mt-3 w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 py-2 text-sm"
                    >
                      {card.actionLabel}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl p-6 bg-slate-900 border border-slate-800">
            <h2 className="font-semibold mb-4">Core Platform Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {features.map((f, i) => (
                <div key={i} className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <f.icon className="text-indigo-400 mb-2" />
                  <div className="font-semibold">{f.title}</div>
                  <div className="text-sm text-slate-400">{f.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl p-6 bg-slate-900 border border-slate-800">
            <div className="flex justify-between mb-2">
              <span>Profile Strength</span>
              <span className="text-indigo-400 font-semibold">{profileStrength}%</span>
            </div>

            <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-pink-500" style={{ width: `${profileStrength}%` }} />
            </div>

            <button
              onClick={() => router.push(routes.profile)}
              className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm"
            >
              Improve Profile
            </button>

            <button
              onClick={() => setOpenPostModal(true)}
              className="mt-3 w-full px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 text-sm"
            >
              Create Post
            </button>
          </div>
        </div>
      </div>

      <CreatePostModal open={openPostModal} onClose={() => setOpenPostModal(false)} />
    </>
  );
}
