"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { Package, Wrench } from "lucide-react";

type Service = {
  id: string;
  title: string;
  price: number;
  provider_id: string;
};

type Product = {
  id: string;
  name: string;
  price: number;
  provider_id: string;
};

export default function ListingsPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // ---------------- FETCH SERVICES ----------------
  const fetchServices = async () => {
    const { data, error } = await supabase
      .from("service_listings")
      .select("*");

    if (!error && data) setServices(data);
  };

  // ---------------- FETCH PRODUCTS ----------------
  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("product_catalog")
      .select("*");

    if (!error && data) setProducts(data);
  };

  useEffect(() => {
    fetchServices();
    fetchProducts();
  }, []);

  // ---------------- BOOKING FUNCTION ----------------
  const bookNow = async (
    listingId: string,
    price: number,
    providerId: string,
    type: "service" | "product"
  ) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Please login first");
      return;
    }

    const { error } = await supabase.from("orders").insert({
      listing_id: listingId,
      listing_type: type,
      consumer_id: user.id,
      provider_id: providerId,
      price,
      status: "pending",
    });

    if (error) {
      console.error(error);
      alert("Booking failed ❌");
    } else {
      alert("Booking request sent 🚀");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-black text-white p-6">
      <h1 className="text-2xl font-bold mb-6">
        My Marketplace Listings
      </h1>

      {/* ---------------- SERVICES ---------------- */}
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Wrench size={18} /> Services
      </h2>

      <div className="grid md:grid-cols-3 gap-4 mb-10">
        {services.map((service) => (
          <motion.div
            key={service.id}
            whileHover={{ scale: 1.02 }}
            className="p-5 bg-slate-900 border border-slate-800 rounded-2xl"
          >
            <h3 className="font-semibold text-lg">
              {service.title}
            </h3>

            <p className="text-indigo-400 font-bold mt-2">
              ₹ {service.price}
            </p>

            <button
              onClick={() =>
                bookNow(
                  service.id,
                  service.price,
                  service.provider_id,
                  "service"
                )
              }
              className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 py-2 rounded-xl"
            >
              Book Service
            </button>
          </motion.div>
        ))}
      </div>

      {/* ---------------- PRODUCTS ---------------- */}
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Package size={18} /> Products
      </h2>

      <div className="grid md:grid-cols-3 gap-4">
        {products.map((product) => (
          <motion.div
            key={product.id}
            whileHover={{ scale: 1.02 }}
            className="p-5 bg-slate-900 border border-slate-800 rounded-2xl"
          >
            <h3 className="font-semibold text-lg">
              {product.name}
            </h3>

            <p className="text-emerald-400 font-bold mt-2">
              ₹ {product.price}
            </p>

            <button
              onClick={() =>
                bookNow(
                  product.id,
                  product.price,
                  product.provider_id,
                  "product"
                )
              }
              className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 py-2 rounded-xl"
            >
              Buy Product
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
