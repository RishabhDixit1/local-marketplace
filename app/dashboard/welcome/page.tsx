"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Plus,
  MapPin,
  Users,
  Wrench,
  Store,
  Package,
  Star,
  MessageCircle,
  ClipboardList,
  TrendingUp,
  ShieldCheck,
  Zap,
} from "lucide-react";

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export default function WelcomePage() {
  const router = useRouter();

  // --- MOCK USER STATE (Later from Supabase profile.role) ---
  const userName = "Rishabh";
  const isProvider = true; // change dynamically later

  // --- ROUTE MAP (centralized for scaling) ---
  const routes = {
    posts: "/dashboard/posts",
    people: "/dashboard/people",
    profile: "/dashboard/profile",
    tasks: "/dashboard/tasks",

    // Provider routes
    addService: "/dashboard/provider/add-service",
    addProduct: "/dashboard/provider/add-product",
    listings: "/dashboard/provider/listings",
    orders: "/dashboard/tasks", // will become /provider/orders later
  };

  // --- STATS ---
  const stats = [
    { label: "Nearby Posts", value: "12", icon: MapPin },
    { label: "Active Tasks", value: "3", icon: ClipboardList },
    { label: "Unread Messages", value: "5", icon: MessageCircle },
    { label: "Trust Score", value: "4.7", icon: Star },
  ];

  // --- CORE FEATURES ---
  const features = [
    {
      title: "Real-time Needs",
      desc: "Post requests & get instant responses nearby.",
      icon: Zap,
    },
    {
      title: "Hyperlocal Discovery",
      desc: "Find services & products within your radius.",
      icon: MapPin,
    },
    {
      title: "Trust & Ratings",
      desc: "Build reputation through verified work.",
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-black text-white">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* ---------------- HERO ---------------- */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-8 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 shadow-xl"
        >
          <h1 className="text-3xl font-bold">
            Welcome back, {userName} 👋
          </h1>

          <p className="text-white/90 mt-2 max-w-xl">
            Connect with nearby providers, sell services, post needs,
            and build your local reputation — all in real time.
          </p>

          {/* HERO ACTIONS */}
          <div className="flex flex-wrap gap-3 mt-6">
            <button
              onClick={() => router.push(routes.posts)}
              className="px-5 py-2.5 rounded-xl bg-white text-indigo-600 font-semibold hover:opacity-90 flex items-center gap-2"
            >
              <Plus size={16} />
              Create Post
            </button>

            <button
              onClick={() => router.push(routes.people)}
              className="px-5 py-2.5 rounded-xl border border-white/40 hover:bg-white/10 flex items-center gap-2"
            >
              <Users size={16} />
              Explore Nearby
            </button>

            <button
              onClick={() => router.push(routes.profile)}
              className="px-5 py-2.5 rounded-xl border border-white/40 hover:bg-white/10 flex items-center gap-2"
            >
              <ShieldCheck size={16} />
              Complete Profile
            </button>
          </div>
        </motion.div>

        {/* ---------------- QUICK ACTIONS ---------------- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              title: "Post a Need",
              icon: Plus,
              path: routes.posts,
            },
            {
              title: "Offer a Service",
              icon: Wrench,
              path: routes.addService,
            },
            {
              title: "Find People",
              icon: Users,
              path: routes.people,
            },
            {
              title: "My Tasks",
              icon: ClipboardList,
              path: routes.tasks,
            },
          ].map((item, i) => (
            <motion.button
              key={i}
              whileHover={{ scale: 1.03 }}
              onClick={() => router.push(item.path)}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500 text-left"
            >
              <item.icon className="mb-3 text-indigo-400" />
              <div className="font-semibold">{item.title}</div>
            </motion.button>
          ))}
        </div>

        {/* ---------------- STATS ---------------- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s, i) => (
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

        {/* ---------------- PROVIDER HUB ---------------- */}
        {isProvider && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-3xl p-6 bg-gradient-to-r from-emerald-600/20 to-indigo-600/20 border border-emerald-500/20"
          >
            <h2 className="text-xl font-semibold mb-4">
              Provider Hub 🛠️
            </h2>

            <p className="text-slate-300 mb-6">
              Manage your services, products, pricing, and incoming
              requests from nearby customers.
            </p>

            <div className="grid md:grid-cols-4 gap-4">

              {/* Add Service */}
              <button
                onClick={() => router.push(routes.addService)}
                className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500"
              >
                <Wrench className="mb-2 text-emerald-400" />
                Add Service
              </button>

              {/* Add Product */}
              <button
                onClick={() => router.push(routes.addProduct)}
                className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500"
              >
                <Package className="mb-2 text-indigo-400" />
                Add Product
              </button>

              {/* Listings */}
              <button
                onClick={() => router.push(routes.listings)}
                className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-purple-500"
              >
                <Store className="mb-2 text-purple-400" />
                My Listings
              </button>

              {/* Orders / Jobs */}
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

        {/* ---------------- CORE FEATURES ---------------- */}
        <div className="rounded-3xl p-6 bg-slate-900 border border-slate-800">
          <h2 className="font-semibold mb-4">
            Core Platform Features
          </h2>

          <div className="grid md:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <div
                key={i}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800"
              >
                <f.icon className="text-indigo-400 mb-2" />
                <div className="font-semibold">{f.title}</div>
                <div className="text-sm text-slate-400">
                  {f.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ---------------- PROFILE STRENGTH ---------------- */}
        <div className="rounded-3xl p-6 bg-slate-900 border border-slate-800">
          <div className="flex justify-between mb-2">
            <span>Profile Strength</span>
            <span className="text-indigo-400 font-semibold">
              60%
            </span>
          </div>

          <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full w-[60%] bg-gradient-to-r from-indigo-500 to-pink-500" />
          </div>

          <button
            onClick={() => router.push(routes.profile)}
            className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm"
          >
            Improve Profile
          </button>
        </div>

      </div>
    </div>
  );
}
