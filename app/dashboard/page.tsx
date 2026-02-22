"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import ProviderPopup from "@/app/components/ProviderPopup";
import dynamic from "next/dynamic";
import ProviderTrustPanel from "@/app/components/ProviderTrustPanel";

const MarketplaceMap = dynamic(
() => import("@/app/components/MarketplaceMap").then((mod) => mod.default),
{ ssr: false }
);

import {
Search,
MapPin,
MessageCircle,
Filter,
TrendingUp,
} from "lucide-react";

/* ================= TYPES ================= */

type Listing = {
id: string;
title: string;
description: string;
price: number;
category: string;
provider_id: string;
type: "service" | "product" | "demand";
avatar: string;
distance: number;
lat: number;
lng: number;
urgent?: boolean;
};

/* ================= PAGE ================= */

export default function MarketplacePage() {
const [feed, setFeed] = useState<Listing[]>([]);
const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
const [search, setSearch] = useState("");
const [category, setCategory] = useState("all");
const [sortBy, setSortBy] = useState<"distance" | "price">("distance");
const [showTrendingOnly, setShowTrendingOnly] = useState(false);

useEffect(() => {
fetchFeed();
}, []);

/* ================= FETCH ================= */

const fetchFeed = async () => {
const { data: services } = await supabase
.from("service_listings")
.select("*");

const { data: products } = await supabase
  .from("product_catalog")
  .select("*");

const { data: posts } = await supabase
  .from("posts")
  .select("*");


/* ---------- FORMAT ---------- */

const formattedServices: Listing[] =
  services?.map((s: any) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    price: s.price,
    category: s.category,
    provider_id: s.provider_id,
    type: "service",
    avatar: "https://i.pravatar.cc/150?img=12",
    distance: Math.floor(Math.random() * 5) + 1,
    lat: 28.61 + Math.random() * 0.05,
    lng: 77.2 + Math.random() * 0.05,
  })) || [];

const formattedProducts: Listing[] =
  products?.map((p: any) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    price: p.price,
    category: p.category,
    provider_id: p.provider_id,
    type: "product",
    avatar: "https://i.pravatar.cc/150?img=32",
    distance: Math.floor(Math.random() * 5) + 1,
    lat: 28.61 + Math.random() * 0.05,
    lng: 77.2 + Math.random() * 0.05,
  })) || [];

const formattedPosts: Listing[] =
  posts?.map((post: any) => ({
    id: post.id,
    title: post.text,
    description: post.text,
    price: 0,
    category: "Need",
    provider_id: post.user_id,
    type: "demand",
    avatar: "https://i.pravatar.cc/150?img=5",
    distance: Math.floor(Math.random() * 5) + 1,
    urgent: true,
    lat: 28.61 + Math.random() * 0.05,
    lng: 77.2 + Math.random() * 0.05,
  })) || [];

/* ---------- SEED ---------- */

const demoSeed: Listing[] = [
  {
    id: "demo1",
    title: "Looking for an Electrician",
    description: "Power outage at home. Need urgent electrician.",
    price: 800,
    category: "Electrician",
    provider_id: "1",
    type: "demand",
    avatar: "https://i.pravatar.cc/150?img=11",
    distance: 2.2,
    urgent: true,
    lat: 28.62,
    lng: 77.21,
  },
  {
    id: "demo2",
    title: "Professional Home Cleaning",
    description: "Full house deep cleaning service.",
    price: 350,
    category: "Cleaning",
    provider_id: "2",
    type: "service",
    avatar: "https://i.pravatar.cc/150?img=21",
    distance: 1.5,
    lat: 28.63,
    lng: 77.22,
  },
  {
    id: "demo3",
    title: "Cordless Drill for Sale",
    description: "Almost new drill machine with battery.",
    price: 1500,
    category: "Tools",
    provider_id: "3",
    type: "product",
    avatar: "https://i.pravatar.cc/150?img=30",
    distance: 3.1,
    lat: 28.6,
    lng: 77.19,
  },
];

const combined = [
  ...formattedPosts,
  ...formattedServices,
  ...formattedProducts,
];

setFeed(combined.length ? combined : demoSeed);


};

/* ================= FILTER + SORT ================= */

const filtered = feed
.filter((item) => {
const matchesSearch = item.title
.toLowerCase()
.includes(search.toLowerCase());


  const matchesCategory =
    category === "all" ||
    item.category === category ||
    item.type === category;

  const matchesTrending = showTrendingOnly
    ? item.type === "demand"
    : true;

  return matchesSearch && matchesCategory && matchesTrending;
})
.sort((a, b) => {
  if (sortBy === "distance") {
    return a.distance - b.distance;
  }
  return a.price - b.price;
});


/* ================= BOOK ================= */

const bookNow = async (item: Listing) => {
const {
data: { user },
} = await supabase.auth.getUser();


if (!user) return alert("Login required");

await supabase.from("orders").insert({
  listing_id: item.id,
  listing_type: item.type,
  consumer_id: user.id,
  provider_id: item.provider_id,
  price: item.price,
  status: "pending",
});

alert("Booking request sent 🚀");


};

const categories = ["all", "demand", "service", "product"];

/* ================= UI ================= */

return ( <div className="min-h-screen bg-gradient-to-b from-slate-950 to-black text-white">


  {/* HERO */}
  <div className="max-w-7xl mx-auto px-6 pt-8">
    <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-3xl p-8">
      <h1 className="text-3xl font-bold">
        Discover Local Services & Products
      </h1>
      <p className="text-white/90 mt-2">
        Book trusted providers near you in real-time.
      </p>
    </div>
  </div>

  {/* SEARCH + SORT */}
  <div className="max-w-7xl mx-auto px-6 mt-6">

    <div className="flex flex-col md:flex-row gap-3 mb-6">

      <div className="flex items-center gap-2 bg-slate-900 p-3 rounded-xl flex-1 border border-slate-800">
        <Search size={16} />
        <input
          placeholder="Search services, products, needs..."
          className="bg-transparent outline-none flex-1"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <select
        value={sortBy}
        onChange={(e) =>
          setSortBy(e.target.value as any)
        }
        className="bg-slate-900 border border-slate-800 px-4 rounded-xl text-sm"
      >
        <option value="distance">Sort: Distance</option>
        <option value="price">Sort: Price</option>
      </select>

      <button
        onClick={() =>
          setShowTrendingOnly(!showTrendingOnly)
        }
        className="bg-slate-900 border border-slate-800 px-4 rounded-xl flex items-center gap-2 text-sm"
      >
        <Filter size={16} />
        Trending
      </button>
    </div>

    {/* CATEGORY FILTER */}
    <div className="flex gap-3 mb-6">
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => setCategory(cat)}
          className={`px-4 py-2 rounded-full text-sm ${
            category === cat
              ? "bg-indigo-600"
              : "bg-slate-800"
          }`}
        >
          {cat.toUpperCase()}
        </button>
      ))}
    </div>

    {/* QUICK CHIPS */}
    <div className="flex gap-3 overflow-x-auto mb-6">
      {[
        "Cleaning",
        "Repair",
        "Delivery",
        "Food",
        "Electrician",
      ].map((chip) => (
        <button
          key={chip}
          onClick={() => setCategory(chip)}
          className="px-4 py-2 bg-slate-800 rounded-xl text-sm whitespace-nowrap hover:bg-indigo-600 transition"
        >
          {chip}
        </button>
      ))}
    </div>
  </div>

  {/* MAIN GRID */}
  <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-6 pb-16">

    {/* FEED */}
    <div className="md:col-span-2 space-y-5">

      {/* TRENDING */}
      <div>
        <h2 className="flex items-center gap-2 text-indigo-400 mb-3">
          <TrendingUp size={16} />
          Trending Near You
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {feed
            .filter((i) => i.type === "demand")
            .slice(0, 2)
            .map((item) => (
              <div
                key={"trend-" + item.id}
                className="bg-slate-900 p-4 rounded-xl border border-slate-800"
              >
                <div className="text-sm text-slate-400">
                  {item.distance} km away
                </div>
                <div className="font-semibold">
                  {item.title}
                </div>
                <div className="text-indigo-400 font-bold">
                  ₹ {item.price}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* LIST */}
      {filtered.map((item) => (
        <motion.div
          key={item.id}
          whileHover={{ scale: 1.02 }}
          className="p-6 bg-slate-900 border border-slate-800 rounded-2xl"
        >
          <div className="flex gap-4">

            <ProviderPopup userId={item.provider_id}>
  <img
  src={item.avatar}
  onClick={() =>
    setSelectedProvider(item.provider_id)
  }
  className="w-12 h-12 rounded-full cursor-pointer hover:scale-110 transition"
/>
</ProviderPopup>

            <div className="flex-1">

              <div className="flex gap-2 mb-1">
                <span className="text-xs bg-slate-800 px-2 py-1 rounded">
                  {item.type}
                </span>

                {item.urgent && (
                  <span className="text-xs bg-red-500 px-2 py-1 rounded">
                    URGENT
                  </span>
                )}

                <span className="text-xs text-emerald-400 bg-emerald-900/30 px-2 py-1 rounded">
                  Recently Posted
                </span>
              </div>

              <h3 className="font-semibold text-lg">
                {item.title}
              </h3>

              <p className="text-sm text-slate-400 mt-1">
                {item.description}
              </p>

              <div className="flex items-center gap-4 text-sm mt-3 text-slate-400">
                <MapPin size={14} />
                {item.distance} km
              </div>

              {item.price > 0 && (
                <div className="text-indigo-400 font-bold mt-2">
                  ₹ {item.price}
                </div>
              )}

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() =>
                    bookNow(item)
                  }
                  className="bg-indigo-600 px-4 py-2 rounded-xl"
                >
                  {item.type === "demand"
                    ? "Accept Job"
                    : "Book Now"}
                </button>

                <button className="bg-slate-800 px-4 py-2 rounded-xl">
                  <MessageCircle size={16} />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>

    {/* SIDEBAR */}
    <div className="space-y-6">

      {/* MAP */}
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
        <h2 className="flex items-center gap-2 mb-3">
          <MapPin size={18} />
          Nearby Map
        </h2>

        <div className="h-60 bg-slate-800 rounded-xl overflow-hidden">
          <MarketplaceMap
            items={feed.map((item) => ({
              id: item.id,
              title: item.title,
              lat: item.lat,
              lng: item.lng,
            }))}
          />
        </div>
      </div>

      {/* CREATE POST */}
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
        <h3 className="font-semibold mb-4">
          Create Post
        </h3>

        <div className="space-y-2 text-sm">
          <label className="flex gap-2">
            <input type="radio" />
            Need something
          </label>

          <label className="flex gap-2">
            Offer a service
          </label>

          <label className="flex gap-2">
            Sell a product
          </label>
        </div>

        <button className="w-full mt-4 bg-indigo-600 py-2 rounded-xl">
          Continue →
        </button>
      </div>
    </div>
  </div>

  {/* FLOATING CTA */}
  <button className="fixed bottom-6 right-6 bg-gradient-to-r from-indigo-600 to-pink-600 w-14 h-14 rounded-full text-2xl shadow-2xl hover:scale-110 transition">
    +
  </button>
  <ProviderTrustPanel
  userId={selectedProvider || ""}
  open={!!selectedProvider}
  onClose={() => setSelectedProvider(null)}
/>
</div>


);
}
