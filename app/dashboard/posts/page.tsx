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

type ServiceListingRow = {
id: string;
title: string | null;
price: number | null;
provider_id: string;
category: string | null;
description: string | null;
};

type ProductListingRow = {
id: string;
title: string | null;
price: number | null;
provider_id: string;
category: string | null;
description: string | null;
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

const serviceRows = (services as ServiceListingRow[] | null) || [];

const formattedServices: Listing[] =
  serviceRows.map((s) => ({
    id: s.id,
    title: s.title || "Local service",
    price: s.price || 0,
    provider_id: s.provider_id,
    category: s.category || "Service",
    description: s.description || "Service listing",
    type: "service",
    distance: Math.floor(Math.random() * 10) + 1,
  }));

// 🔹 PRODUCTS
const { data: products } = await supabase
  .from("product_catalog")
  .select("*");

const productRows = (products as ProductListingRow[] | null) || [];

const formattedProducts: Listing[] =
  productRows.map((p) => ({
    id: p.id,
    title: p.title || "Local product",
    price: p.price || 0,
    provider_id: p.provider_id,
    category: p.category || "Product",
    description: p.description || "Product listing",
    type: "product",
    distance: Math.floor(Math.random() * 10) + 1,
  }));

// 🔹 DEMAND POSTS
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

// 🔹 MERGE
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

// ---------------- BOOK / CHAT FUNCTION ----------------

const bookNow = async (item: Listing) => {
try {
// 🔐 Get logged in user
const {
data: { user },
} = await supabase.auth.getUser();


  if (!user) {
    alert("Please login first");
    return;
  }

  // 1️⃣ Create conversation
  const { data: conversation, error } = await supabase
    .from("conversations")
    .insert({
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;

  // 2️⃣ Add participants
  await supabase.from("conversation_participants").insert([
    {
      conversation_id: conversation.id,
      user_id: user.id,
    },
    {
      conversation_id: conversation.id,
      user_id: item.provider_id,
    },
  ]);

  // 3️⃣ Redirect to chat page
  window.location.href = `/dashboard/chat/${conversation.id}`;
} catch (err) {
  console.error("Booking error:", err);
  alert("Failed to start chat");
}


};

// ---------------- UI ----------------

return ( <div className="min-h-screen bg-gradient-to-b from-slate-950 to-black text-white p-6"> <div className="max-w-6xl mx-auto space-y-6">


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

            <button
              onClick={() => bookNow(item)}
              className="px-3 py-1 text-sm bg-indigo-600 hover:bg-indigo-700 rounded-lg"
            >
              {item.type === "demand"
                ? "Respond"
                : "Book Now"}
            </button>

          </div>

          {/* DISTANCE */}
          <div className="text-xs text-slate-500 mt-2">
            {item.distance} km away
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
