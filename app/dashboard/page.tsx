"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import {
  Search,
  MapPin,
  Star,
  MessageCircle,
  Bookmark,
  Filter,
  TrendingUp,
} from "lucide-react";

type Listing = {
  id: string;
  title: string;
  price: number;
  category: string;
  provider_id: string;
  type: "service" | "product";
};

export default function MarketplacePage() {
  const [feed, setFeed] = useState<Listing[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    fetchFeed();
  }, []);

  const fetchFeed = async () => {
    const { data: services } = await supabase
      .from("service_listings")
      .select("*");

    const { data: products } = await supabase
      .from("product_catalog")
      .select("*");

    const combined = [
      ...(services || []).map((s) => ({
        ...s,
        type: "service",
      })),
      ...(products || []).map((p) => ({
        ...p,
        type: "product",
      })),
    ];

    setFeed(combined);
  };

  const filtered = feed.filter((item) => {
    const matchesSearch = item.title
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesCategory =
      category === "all" ||
      item.category === category;

    return matchesSearch && matchesCategory;
  });

  const bookNow = async (
    listingId: string,
    price: number,
    providerId: string,
    type: string
  ) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return alert("Login required");

    await supabase.from("orders").insert({
      listing_id: listingId,
      listing_type: type,
      consumer_id: user.id,
      provider_id: providerId,
      price,
      status: "pending",
    });

    alert("Booking request sent 🚀");
  };

  const categories = [
    "all",
    "Cleaning",
    "Repair",
    "Delivery",
    "Food",
    "Electrician",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-black text-white">

      {/* ================= HERO ================= */}
      <div className="max-w-7xl mx-auto px-6 pt-8 pb-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-3xl p-8 shadow-xl"
        >
          <h1 className="text-3xl font-bold">
            Discover Local Services & Products
          </h1>
          <p className="mt-2 text-white/90">
            Find trusted providers near you in real-time.
          </p>

          <div className="flex gap-6 mt-6 text-sm">
            <div>
              <div className="font-bold text-lg">
                {feed.length}
              </div>
              <div>Active Listings</div>
            </div>
            <div>
              <div className="font-bold text-lg">4.8</div>
              <div>Avg Rating</div>
            </div>
            <div>
              <div className="font-bold text-lg">24/7</div>
              <div>Availability</div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ================= FILTER BAR ================= */}
      <div className="max-w-7xl mx-auto px-6 mb-6">

        {/* Search */}
        <div className="flex items-center gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800 mb-4">
          <Search size={18} />
          <input
            placeholder="Search services or products..."
            className="bg-transparent outline-none flex-1"
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />
          <Filter size={18} />
        </div>

        {/* Categories */}
        <div className="flex gap-3 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm transition ${
                category === cat
                  ? "bg-indigo-600 shadow-lg"
                  : "bg-slate-800 hover:bg-slate-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ================= MAIN LAYOUT ================= */}
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-6 pb-12">

        {/* ---------- FEED COLUMN ---------- */}
        <div className="md:col-span-2 space-y-5">

          {/* Trending strip */}
          <div className="flex items-center gap-2 text-indigo-400 mb-2">
            <TrendingUp size={16} />
            Trending Near You
          </div>

          {filtered.map((item) => (
            <motion.div
              key={item.id}
              whileHover={{ scale: 1.02 }}
              className="p-6 bg-slate-900 border border-slate-800 rounded-2xl hover:border-indigo-500 transition"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs text-slate-400 uppercase mb-1">
                    {item.type}
                  </div>

                  <h3 className="text-lg font-semibold">
                    {item.title}
                  </h3>

                  <div className="flex items-center gap-3 text-sm text-slate-400 mt-2">
                    <Star size={14} /> 4.8
                    <MapPin size={14} /> 2.3 km
                  </div>

                  <div className="mt-3 text-indigo-400 font-bold">
                    ₹ {item.price}
                  </div>
                </div>

                <Bookmark className="opacity-60 hover:opacity-100 cursor-pointer" />
              </div>

              <div className="flex gap-3 mt-5">
                <button
                  onClick={() =>
                    bookNow(
                      item.id,
                      item.price,
                      item.provider_id,
                      item.type
                    )
                  }
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 py-2 rounded-xl"
                >
                  Book Now
                </button>

                <button className="px-4 bg-slate-800 rounded-xl hover:bg-slate-700">
                  <MessageCircle size={16} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ---------- MAP COLUMN ---------- */}
        <div className="sticky top-24 h-fit">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <MapPin size={18} /> Nearby Map
            </h2>

            <div className="h-72 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400">
              Live Map Coming Soon 🚀
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
