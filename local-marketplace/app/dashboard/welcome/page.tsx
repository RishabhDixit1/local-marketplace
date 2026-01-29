"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { 
  Sparkles, 
  Users, 
  Star, 
  TrendingUp, 
  MessageCircle, 
  CheckCircle2,
  ArrowRight,
  Zap,
  Shield,
  Clock
} from "lucide-react";

const features = [
  {
    title: "Post a Request",
    desc: "Share your service needs or offer your skills to people nearby in real-time",
    icon: Sparkles,
    gradient: "from-blue-500 to-cyan-500",
    path: "/dashboard",
  },
  {
    title: "Discover People",
    desc: "Find trusted providers, collaborators, and businesses in your local area",
    icon: Users,
    gradient: "from-purple-500 to-pink-500",
    path: "/dashboard/people",
  },
  {
    title: "Build Trust",
    desc: "Earn ratings and grow your local reputation with every interaction",
    icon: Star,
    gradient: "from-orange-500 to-red-500",
    path: "/dashboard/ratings",
  },
];

const stats = [
  { value: "10K+", label: "Active Users", icon: Users },
  { value: "50K+", label: "Services Posted", icon: Sparkles },
  { value: "98%", label: "Satisfaction Rate", icon: Star },
  { value: "24/7", label: "Support", icon: Clock },
];

const benefits = [
  "Connect with verified local service providers",
  "Real-time messaging and notifications",
  "Secure payment and escrow system",
  "Review and rating system",
  "Community-driven quality assurance",
  "Mobile-friendly interface",
];

export default function WelcomePage() {
  const router = useRouter();
  const profileStrength = 60;

  return (
    <div className="space-y-8 lg:space-y-12">
      
      {/* HERO SECTION */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-8 lg:p-12 text-white shadow-2xl"
      >
        {/* Animated Background Elements */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-10 right-10 w-72 h-72 bg-white rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-10 left-10 w-96 h-96 bg-pink-500 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="relative z-10 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full mb-6 border border-white/30"
          >
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-semibold">Welcome to Your Local Marketplace</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6"
          >
            Your Local Network,
            <br />
            <span className="bg-gradient-to-r from-yellow-300 to-pink-300 bg-clip-text text-transparent">
              Powered in Real-Time
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-lg lg:text-xl text-white/90 mb-8 max-w-2xl"
          >
            A community-driven marketplace where neighbors connect to find
            services, offer skills, and build trusted local reputations — all in
            one seamless platform.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap gap-4"
          >
            <button
              onClick={() => router.push("/dashboard")}
              className="group px-8 py-4 bg-white text-indigo-700 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 flex items-center gap-2"
            >
              Explore Marketplace
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => router.push("/dashboard/profile")}
              className="px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-white/30 text-white rounded-xl font-bold hover:bg-white/20 transition-all duration-300 flex items-center gap-2"
            >
              <Shield className="w-5 h-5" />
              Complete Profile
            </button>
          </motion.div>
        </div>
      </motion.div>

      {/* STATS SECTION */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * i }}
            className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-700 text-center group hover:scale-105 transition-all duration-300"
          >
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center group-hover:rotate-12 transition-transform duration-300">
              <stat.icon className="w-6 h-6 text-white" />
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
              {stat.value}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              {stat.label}
            </div>
          </motion.div>
        ))}
      </div>

      {/* PROFILE STRENGTH */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-2xl p-6 lg:p-8 shadow-xl border border-slate-200 dark:border-slate-700"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Profile Strength
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Build trust with a complete profile
              </p>
            </div>
          </div>
          <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
            {profileStrength}%
          </div>
        </div>

        <div className="relative h-4 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${profileStrength}%` }}
            transition={{ duration: 1, delay: 0.3 }}
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-green-500 via-blue-500 to-purple-500"
          />
        </div>

        <div className="mt-4 flex items-start gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
          <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-900 dark:text-blue-100">
            Complete your profile to increase visibility and build trust in your
            local community. Add services, bio, and contact information.
          </p>
        </div>
      </motion.div>

      {/* FEATURES GRID */}
      <div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center mb-8"
        >
          <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white mb-3">
            Everything You Need
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Powerful features designed to help you connect, collaborate, and grow
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {features.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i + 0.4 }}
              onClick={() => router.push(item.path)}
              className="group relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800 p-8 shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer border border-slate-200 dark:border-slate-700 hover:scale-105"
            >
              {/* Gradient Background on Hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>

              <div className="relative z-10">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-lg`}>
                  <item.icon className="w-7 h-7 text-white" />
                </div>

                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                  {item.title}
                </h3>

                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  {item.desc}
                </p>

                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold group-hover:gap-3 transition-all duration-300">
                  <span>Explore</span>
                  <ArrowRight className="w-5 h-5" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* BENEFITS SECTION */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 rounded-3xl p-8 lg:p-12 text-white shadow-2xl border border-slate-700"
      >
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full mb-6 border border-white/20">
              <Shield className="w-4 h-4" />
              <span className="text-sm font-semibold">Why Choose Us</span>
            </div>

            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              Built for Your
              <br />
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Local Community
              </span>
            </h2>

            <p className="text-lg text-white/80 mb-8">
              We bring together the best features to help you connect with trusted
              service providers and grow your local network.
            </p>

            <div className="space-y-4">
              {benefits.map((benefit, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + i * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-white/90">{benefit}</span>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-3xl blur-3xl"></div>
            <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                    <MessageCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="font-bold text-lg">Real-Time Chat</div>
                    <div className="text-sm text-white/70">
                      Connect instantly with providers
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Star className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="font-bold text-lg">Trust System</div>
                    <div className="text-sm text-white/70">
                      Build reputation through reviews
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="font-bold text-lg">Secure Platform</div>
                    <div className="text-sm text-white/70">
                      Your data is always protected
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* CTA SECTION */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.8 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-8 lg:p-12 text-center text-white shadow-2xl"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,white,transparent_70%)] opacity-10"></div>

        <div className="relative z-10">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.9, type: "spring" }}
            className="w-20 h-20 mx-auto mb-6 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-4 border-white/30"
          >
            <Sparkles className="w-10 h-10" />
          </motion.div>

          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Ready to Activate Your Local Network?
          </h2>

          <p className="text-lg text-white/90 max-w-2xl mx-auto mb-8">
            The more you engage with your community, the stronger your presence
            becomes. Start posting, connecting, and building your local brand
            today.
          </p>

          <div className="flex justify-center gap-4 flex-wrap">
            <button
              onClick={() => router.push("/dashboard")}
              className="group px-8 py-4 bg-white text-indigo-700 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 flex items-center gap-2"
            >
              Start Posting
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => router.push("/dashboard/profile")}
              className="px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-white/30 text-white rounded-xl font-bold hover:bg-white/20 transition-all duration-300 flex items-center gap-2"
            >
              <Shield className="w-5 h-5" />
              Update Profile
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}