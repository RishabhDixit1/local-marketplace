"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  Clock,
  MapPin,
  MessageCircle,
  Plus,
  Shield,
  Star,
  Timer,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

type FeedTab = "needs" | "offers";
type Radius = 1 | 3 | 5;
type Urgency = "now" | "today" | "flexible";

type Post = {
  id: string;
  type: FeedTab;
  title: string;
  name: string;
  rating: number;
  distanceKm: number;
  minutesAgo: number;
  priceLabel: string;
  urgency: Urgency;
};

type NotificationItem = {
  id: string;
  text: string;
  minutesAgo: number;
};

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export default function WelcomePage() {
  const router = useRouter();

  // --- Mocked data (replace with API later) ---
  const userName = "Rishabh";
  const profileStrength = 60;

  const notifications: NotificationItem[] = [
    { id: "n1", text: "New request posted near you: AC repair", minutesAgo: 6 },
    { id: "n2", text: "You received a message from Aman", minutesAgo: 18 },
    { id: "n3", text: "Task updated: Delivery • In progress", minutesAgo: 42 },
  ];

  const taskSummary = { pending: 2, inProgress: 1, completed: 5 };

  const allPosts = useMemo<Post[]>(
    () => [
      {
        id: "p1",
        type: "needs",
        title: "Need electrician for switch repair",
        name: "Ramesh",
        rating: 4.6,
        distanceKm: 1.2,
        minutesAgo: 5,
        priceLabel: "₹500",
        urgency: "now",
      },
      {
        id: "p2",
        type: "needs",
        title: "Need cook for dinner (today)",
        name: "Priya",
        rating: 4.3,
        distanceKm: 2.8,
        minutesAgo: 12,
        priceLabel: "₹800–₹1200",
        urgency: "today",
      },
      {
        id: "p3",
        type: "offers",
        title: "I can fix laptops & desktops",
        name: "Aman",
        rating: 4.8,
        distanceKm: 1.7,
        minutesAgo: 20,
        priceLabel: "From ₹399",
        urgency: "flexible",
      },
      {
        id: "p4",
        type: "offers",
        title: "Home cleaning service available",
        name: "Sana",
        rating: 4.5,
        distanceKm: 3.9,
        minutesAgo: 33,
        priceLabel: "From ₹699",
        urgency: "today",
      },
    ],
    []
  );

  // --- Feed state ---
  const [tab, setTab] = useState<FeedTab>("needs");
  const [radiusKm, setRadiusKm] = useState<Radius>(3);
  const [urgency, setUrgency] = useState<Urgency>("today");

  const filteredPosts = useMemo(() => {
    return allPosts
      .filter((p) => p.type === tab)
      .filter((p) => p.distanceKm <= radiusKm)
      .filter((p) => (urgency ? p.urgency === urgency : true))
      .sort((a, b) => a.minutesAgo - b.minutesAgo);
  }, [allPosts, tab, radiusKm, urgency]);

  const nearbyCount = useMemo(
    () => allPosts.filter((p) => p.distanceKm <= radiusKm).length,
    [allPosts, radiusKm]
  );

  // --- Actions ---
  const onCreatePost = () => router.push("/dashboard");
  const onChat = () => router.push("/dashboard/chat");
  const onAccept = () => router.push("/dashboard/tasks");

  const onViewNearby = () => {
    const el = document.getElementById("live-feed");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Checklist
  const checklist = [
    { id: "photo", label: "Add profile photo", done: false, points: 10, path: "/dashboard/profile" },
    { id: "category", label: "Add service category", done: false, points: 10, path: "/dashboard/profile" },
    { id: "phone", label: "Verify phone number", done: true, points: 15, path: "/dashboard/profile" },
    { id: "bio", label: "Write a short bio", done: false, points: 5, path: "/dashboard/profile" },
  ];

  const personalStats = [
    { label: "New nearby posts", value: `${nearbyCount}`, icon: MapPin },
    { label: "Unread messages", value: "1", icon: MessageCircle },
    { label: "Active tasks", value: `${taskSummary.pending + taskSummary.inProgress}`, icon: Clock },
    { label: "Trust score", value: "4.6", icon: Star },
  ];

  // --- UI tokens ---
  const pageBg = "bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-950";
  const card =
    "rounded-2xl bg-white/80 dark:bg-slate-900/70 backdrop-blur border border-slate-200/70 dark:border-slate-800/70 shadow-sm hover:shadow-md transition-shadow";
  const cardPad = "p-5 sm:p-6";
  const subtle = "text-slate-600 dark:text-slate-400";
  const title = "text-slate-900 dark:text-white";

  const primaryBtn =
    "h-10 px-4 rounded-xl bg-indigo-600 text-white font-medium shadow-sm hover:shadow-md hover:bg-indigo-700 transition flex items-center gap-2";
  const secondaryBtn =
    "h-10 px-4 rounded-xl bg-white/70 dark:bg-slate-900/40 border border-slate-200/70 dark:border-slate-800/70 text-slate-900 dark:text-white font-medium hover:bg-slate-50 dark:hover:bg-slate-900 transition flex items-center gap-2";

  const chipBase =
    "h-9 px-3 rounded-xl text-sm font-semibold border transition flex items-center gap-2";
  const chipOn =
    "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white shadow-sm";
  const chipOff =
    "bg-white/70 dark:bg-slate-900/40 text-slate-800 dark:text-slate-200 border-slate-200/70 dark:border-slate-800/70 hover:bg-slate-50 dark:hover:bg-slate-900";

  return (
    <div className={cn(pageBg, "min-h-screen")}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* CONTEXT BAR */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className={cn(card, cardPad)}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className={cn("text-xs uppercase tracking-wide", subtle)}>
                Dashboard
              </div>
              <div className={cn("text-2xl md:text-3xl font-semibold", title)}>
                Good evening, {userName} 👋
              </div>
              <div className={cn("text-sm flex items-center gap-2", subtle)}>
                <MapPin className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                {nearbyCount} new posts near you • within {radiusKm}km
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button onClick={onCreatePost} className={primaryBtn}>
                <Plus className="w-4 h-4" />
                Create Post
              </button>
              <button onClick={onViewNearby} className={secondaryBtn}>
                <MapPin className="w-4 h-4" />
                View Nearby
              </button>
              <button
                onClick={() => router.push("/dashboard/profile")}
                className={secondaryBtn}
              >
                <Shield className="w-4 h-4" />
                Profile
              </button>
            </div>
          </div>
        </motion.div>

        {/* PERSONAL STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {personalStats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i }}
              className={cn(card, "p-4 sm:p-5 hover:-translate-y-0.5 transition-transform")}
            >
              <div className="flex items-start justify-between">
                <div className={cn("text-sm font-medium", subtle)}>{s.label}</div>
                <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                  <s.icon className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                </div>
              </div>
              <div className={cn("mt-2 text-2xl font-semibold", title)}>{s.value}</div>
            </motion.div>
          ))}
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* FEED */}
          <motion.section
            id="live-feed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.08 }}
            className="lg:col-span-8 space-y-4"
          >
            {/* Feed header + filters */}
            <div className={cn(card, cardPad)}>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className={cn("text-lg font-semibold", title)}>Live Feed</div>
                  <div className={cn("text-sm", subtle)}>
                    Real-time requests & offers near you
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/60 dark:bg-slate-900/40 p-1">
                  <button
                    onClick={() => setTab("needs")}
                    className={cn(
                      "px-4 h-9 rounded-xl font-semibold text-sm transition",
                      tab === "needs"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-700 dark:text-slate-200 hover:bg-white/70 dark:hover:bg-slate-900/60"
                    )}
                  >
                    Needs
                  </button>
                  <button
                    onClick={() => setTab("offers")}
                    className={cn(
                      "px-4 h-9 rounded-xl font-semibold text-sm transition",
                      tab === "offers"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-700 dark:text-slate-200 hover:bg-white/70 dark:hover:bg-slate-900/60"
                    )}
                  >
                    Offers
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="mt-4 flex flex-wrap gap-2">
                {[1, 3, 5].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRadiusKm(r as Radius)}
                    className={cn(chipBase, radiusKm === r ? chipOn : chipOff)}
                  >
                    {r}km
                  </button>
                ))}

                {[
                  { key: "now", label: "Now", icon: Timer },
                  { key: "today", label: "Today", icon: Clock },
                  { key: "flexible", label: "Flexible", icon: Zap },
                ].map((u) => (
                  <button
                    key={u.key}
                    onClick={() => setUrgency(u.key as Urgency)}
                    className={cn(chipBase, urgency === u.key ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" : chipOff)}
                  >
                    <u.icon className="w-4 h-4" />
                    {u.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Posts */}
            <div className="space-y-4">
              {filteredPosts.length === 0 ? (
                <div className={cn(card, "p-8 text-center")}>
                  <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mb-3">
                    <Users className="w-6 h-6 text-indigo-600 dark:text-indigo-300" />
                  </div>
                  <div className={cn("text-lg font-semibold", title)}>
                    No posts found in {radiusKm}km
                  </div>
                  <div className={cn("text-sm mt-1", subtle)}>
                    Create a post to start getting responses instantly.
                  </div>
                  <button onClick={onCreatePost} className={cn(primaryBtn, "mt-4 mx-auto")}>
                    <Plus className="w-4 h-4" />
                    Create Post
                  </button>
                </div>
              ) : (
                filteredPosts.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.03 * i }}
                    className={cn(card, "p-5 hover:-translate-y-0.5 transition-transform")}
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* left */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          {/* avatar */}
                          <div className="h-10 w-10 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-center">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                              {p.name.slice(0, 1).toUpperCase()}
                            </span>
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className={cn("font-semibold truncate", title)}>{p.name}</div>
                              <div className="flex items-center gap-1 text-sm text-slate-700 dark:text-slate-300">
                                <Star className="w-4 h-4 text-amber-500" />
                                {p.rating.toFixed(1)}
                              </div>
                            </div>
                            <div className={cn("text-xs flex items-center gap-2 mt-0.5", subtle)}>
                              <MapPin className="w-3.5 h-3.5" />
                              {p.distanceKm}km • {p.minutesAgo} min ago
                            </div>
                          </div>
                        </div>

                        <div className={cn("mt-3 text-base font-semibold", title)}>{p.title}</div>

                        {/* chips */}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="px-2.5 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 text-slate-700 dark:text-slate-200">
                            {p.priceLabel}
                          </span>

                          <span className="px-2.5 py-1 text-xs rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200/70 dark:border-indigo-400/20 text-indigo-700 dark:text-indigo-200">
                            {p.urgency.toUpperCase()}
                          </span>

                          <span className="px-2.5 py-1 text-xs rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/70 dark:border-emerald-400/20 text-emerald-700 dark:text-emerald-200">
                            {p.type === "needs" ? "REQUEST" : "OFFER"}
                          </span>
                        </div>
                      </div>

                      {/* right actions */}
                      <div className="flex flex-col gap-2 shrink-0">
                        <button
                          onClick={() => onChat()}
                          className={cn(secondaryBtn, "w-28 justify-center")}
                        >
                          <MessageCircle className="w-4 h-4" />
                          Chat
                        </button>

                        <button
                          onClick={() => onAccept()}
                          className={cn(primaryBtn, "w-28 justify-center")}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {p.type === "needs" ? "Accept" : "Request"}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.section>

          {/* SIDEBAR */}
          <motion.aside
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.12 }}
            className="lg:col-span-4 space-y-4 lg:sticky lg:top-20"
          >
            {/* Notifications */}
            <div className={cn(card, cardPad)}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                    <Bell className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
                  </div>
                  <div>
                    <div className={cn("font-semibold", title)}>Notifications</div>
                    <div className={cn("text-xs", subtle)}>Latest updates</div>
                  </div>
                </div>

                <button
                  onClick={() => router.push("/dashboard/notifications")}
                  className="text-sm font-semibold text-indigo-600 dark:text-indigo-300 hover:underline"
                >
                  View all
                </button>
              </div>

              <div className="space-y-2">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className="rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-slate-50/70 dark:bg-slate-900/30 p-3"
                  >
                    <div className={cn("text-sm", title)}>{n.text}</div>
                    <div className={cn("text-xs mt-1", subtle)}>{n.minutesAgo} min ago</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Profile Strength */}
            <div className={cn(card, cardPad)}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                  </div>
                  <div>
                    <div className={cn("font-semibold", title)}>Profile Strength</div>
                    <div className={cn("text-xs", subtle)}>Improve trust & visibility</div>
                  </div>
                </div>

                <div className="text-lg font-semibold text-indigo-600 dark:text-indigo-300">
                  {profileStrength}%
                </div>
              </div>

              <div className="relative h-3 w-full rounded-full bg-slate-200/70 dark:bg-slate-800 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${profileStrength}%` }}
                  transition={{ duration: 0.7 }}
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 via-indigo-500 to-purple-500"
                />
              </div>

              <div className="mt-4 space-y-2">
                {checklist.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => router.push(c.path)}
                    className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-slate-50/70 dark:bg-slate-900/30 hover:bg-slate-100/70 dark:hover:bg-slate-900/50 transition text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={cn(
                          "h-6 w-6 rounded-full flex items-center justify-center shrink-0",
                          c.done
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                        )}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </span>

                      <div className="min-w-0">
                        <div className={cn("text-sm font-semibold truncate", title)}>
                          {c.label}
                        </div>
                        <div className={cn("text-xs", subtle)}>+{c.points}% strength</div>
                      </div>
                    </div>

                    <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                      Fix →
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-blue-50/70 dark:bg-blue-900/20 border border-blue-200/70 dark:border-blue-800/60">
                <Zap className="h-4 w-4 text-blue-700 dark:text-blue-300 mt-0.5" />
                <div className="text-xs text-blue-900 dark:text-blue-100">
                  Completing your profile increases visibility and improves trust.
                </div>
              </div>
            </div>

            {/* Tasks */}
            <div className={cn(card, cardPad)}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-2xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-purple-600 dark:text-purple-300" />
                  </div>
                  <div>
                    <div className={cn("font-semibold", title)}>My Tasks</div>
                    <div className={cn("text-xs", subtle)}>Track your work</div>
                  </div>
                </div>

                <button
                  onClick={() => router.push("/dashboard/tasks")}
                  className="text-sm font-semibold text-indigo-600 dark:text-indigo-300 hover:underline"
                >
                  Open
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Pending", value: taskSummary.pending },
                  { label: "In progress", value: taskSummary.inProgress },
                  { label: "Completed", value: taskSummary.completed },
                ].map((x) => (
                  <div
                    key={x.label}
                    className="rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-slate-50/70 dark:bg-slate-900/30 p-3"
                  >
                    <div className={cn("text-xs", subtle)}>{x.label}</div>
                    <div className={cn("text-xl font-semibold", title)}>{x.value}</div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => router.push("/dashboard/tasks")}
                className={cn(primaryBtn, "mt-4 w-full justify-center")}
              >
                View Tasks
              </button>
            </div>
          </motion.aside>
        </div>
      </div>
    </div>
  );
}
