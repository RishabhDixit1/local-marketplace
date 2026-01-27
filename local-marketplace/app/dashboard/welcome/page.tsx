"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

const features = [
  {
    title: "Post a Request",
    desc: "Ask for services or offer your skills to people nearby in real-time.",
    icon: "📝",
    path: "/dashboard",
  },
  {
    title: "Discover People",
    desc: "Find trusted providers, collaborators, and businesses in your area.",
    icon: "🤝",
    path: "/dashboard/people",
  },
  {
    title: "Build Trust",
    desc: "Earn ratings and grow your local reputation with every interaction.",
    icon: "⭐",
    path: "/dashboard/ratings",
  },
];

export default function WelcomePage() {
  const router = useRouter();
  const profileStrength = 60;

  return (
    <div className="space-y-12">
      {/* HERO */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-10 text-white shadow-xl"
      >
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,white,transparent_40%)]" />

        <div className="relative z-10 max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-bold leading-tight">
            Your Local Network, <br /> Powered in Real Time
          </h1>

          <p className="mt-4 text-lg text-white/90">
            A community-driven marketplace where neighbors connect to find
            services, offer skills, and build trusted local reputations — all in
            one clean platform.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-xl bg-white px-6 py-3 font-semibold text-indigo-700 shadow hover:scale-105 transition"
            >
              Go to Marketplace
            </button>

            <button
              onClick={() => router.push("/dashboard/profile")}
              className="rounded-xl border border-white/40 px-6 py-3 font-semibold text-white backdrop-blur hover:bg-white/10 transition"
            >
              Complete Profile
            </button>
          </div>
        </div>
      </motion.div>

      {/* PROFILE STRENGTH */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl bg-white p-6 shadow"
      >
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold text-gray-800">Profile Strength</h2>
          <span className="text-indigo-600 font-bold">
            {profileStrength}%
          </span>
        </div>

        <div className="h-3 w-full rounded-full bg-gray-200 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${profileStrength}%` }}
            transition={{ duration: 1 }}
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
          />
        </div>

        <p className="mt-3 text-sm text-gray-500">
          Complete your profile to increase visibility and build trust in your
          local community.
        </p>
      </motion.div>

      {/* FEATURES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {features.map((item, i) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.15 }}
            className="group rounded-2xl bg-white p-6 shadow hover:shadow-xl transition cursor-pointer"
            onClick={() => router.push(item.path)}
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-100 text-2xl mb-4 group-hover:scale-110 transition">
              {item.icon}
            </div>

            <h3 className="font-semibold text-lg text-gray-800">
              {item.title}
            </h3>

            <p className="mt-2 text-gray-500 text-sm">
              {item.desc}
            </p>

            <div className="mt-4 text-indigo-600 font-semibold text-sm group-hover:translate-x-1 transition">
              Open →
            </div>
          </motion.div>
        ))}
      </div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="rounded-3xl bg-gray-900 text-white p-10 text-center shadow-xl"
      >
        <h2 className="text-3xl font-bold">
          Ready to Activate Your Local Network?
        </h2>

        <p className="mt-3 text-gray-300 max-w-2xl mx-auto">
          The more you engage with your community, the stronger your presence
          becomes. Start posting, connecting, and building your local brand
          today.
        </p>

        <div className="mt-6 flex justify-center gap-4 flex-wrap">
          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold hover:bg-indigo-500 transition"
          >
            Start Posting
          </button>

          <button
            onClick={() => router.push("/dashboard/profile")}
            className="rounded-xl border border-white/20 px-6 py-3 font-semibold hover:bg-white/10 transition"
          >
            Update Profile
          </button>
        </div>
      </motion.div>
    </div>
  );
}
