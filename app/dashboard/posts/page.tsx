"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { MapPin, Package, Wrench } from "lucide-react";

// ---------------- TYPES ----------------

type Listing = {
  id: string;
  title: string;
  price: number;
  provider_id: string;
  category: string;
  description: string;
  type: "service" | "product" | "demand";
  distance: number;
};

type DemandPost = {
  id: string;
  text: string;
  type: string;
  status: string;
  user_id: string;
  created_at: string;
};

// ---------------- PAGE ----------------

export default function PostsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  // ---------------- FETCH DATA ----------------

  const fetchListings = async () => {
    setLoading(true);

    // 🔹 SERVICES
    const { data: services } = await supabase
      .from("service_listings")
      .select("*");

    const formattedServices: Listing[] =
      services?.map((s: any) => ({
        id: s.id,
        title: s.title,
        price: s.price,
        provider_id: s.provider_id,
        category: s.category,
        description: s.description,
        type: "service" as "service",
        distance: Math.floor(Math.random() * 10) + 1,
      })) || [];

    // 🔹 PRODUCTS
    const { data: products } = await supabase
      .from("product_catalog")
      .select("*");

    const formattedProducts: Listing[] =
      products?.map((p: any) => ({
        id: p.id,
        title: p.title,
        price: p.price,
        provider_id: p.provider_id,
        category: p.category,
        description: p.description,
        type: "product" as "product",
        distance: Math.floor(Math.random() * 10) + 1,
      })) || [];

    // 🔹 DEMAND POSTS (USER NEEDS)
    const { data: demandPosts } = await supabase
      .from("posts")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false });

    const formattedDemandPosts: Listing[] =
      demandPosts?.map((post: DemandPost) => ({
        id: post.id,
        title: post.text,
        price: 0,
        provider_id: post.user_id,
        category: "Need",
        description: post.text,
        type: "demand",
        distance: Math.floor(Math.random() * 10) + 1,
      })) || [];

    // 🔹 MERGE ALL
    setListings([
      ...formattedDemandPosts,
      ...formattedServices,
      ...formattedProducts,
    ]);

    setLoading(false);
  };

  useEffect(() => {
    fetchListings();
  }, []);

  // ---------------- UI ----------------

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-black text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* HEADER */}
        <div>
          <h1 className="text-3xl font-bold">
            Marketplace Feed
          </h1>
          <p className="text-slate-400">
            Discover needs, services & products near you.
          </p>
        </div>

        {/* LOADING */}
        {loading && (
          <div className="text-center py-20 text-slate-400">
            Loading marketplace...
          </div>
        )}

        {/* LISTINGS */}
        <div className="grid md:grid-cols-2 gap-4">
          {listings.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800"
            >
              {/* TYPE BADGE */}
              <div className="flex items-center gap-2 mb-2 text-sm">

                {item.type === "service" && (
                  <>
                    <Wrench size={14} />
                    Service
                  </>
                )}

                {item.type === "product" && (
                  <>
                    <Package size={14} />
                    Product
                  </>
                )}

                {item.type === "demand" && (
                  <>
                    <MapPin size={14} />
                    Need Posted
                  </>
                )}
              </div>

              {/* TITLE */}
              <h3 className="font-semibold text-lg">
                {item.title}
              </h3>

              {/* DESCRIPTION */}
              <p className="text-sm text-slate-400 mt-1">
                {item.description}
              </p>

              {/* FOOTER */}
              <div className="flex justify-between items-center mt-4">

                <span className="text-indigo-400 font-semibold">
                  {item.price === 0
                    ? "Open Budget"
                    : `₹${item.price}`}
                </span>

                <span className="text-xs text-slate-500">
                  {item.distance} km away
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {!loading && listings.length === 0 && (
          <div className="text-center py-20 text-slate-500">
            No listings yet.
          </div>
        )}
      </div>
    </div>
  );
}
