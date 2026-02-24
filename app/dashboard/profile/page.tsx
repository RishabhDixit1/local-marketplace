"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { 
  User, 
  Briefcase, 
  Plus, 
  X, 
  Save, 
  Award,
  Clock,
  Mail,
  Phone,
  Globe,
  CheckCircle2,
  AlertCircle,
  Store,
  ShoppingBag,
  ArrowRight,
  Copy,
  ExternalLink,
  BadgeCheck,
} from "lucide-react";
import {
  calculateProfileCompletion,
  calculateVerificationStatus,
  createBusinessSlug,
  isClaimedBusiness,
  normalizeRole,
  verificationLabel,
} from "@/lib/business";

interface ProfileData {
  name: string;
  location: string;
  bio: string;
  role: string;
  services: string[];
  availability: string;
  email?: string;
  phone?: string;
  website?: string;
}

type ServiceInsightRow = {
  id: string;
  title: string | null;
  category: string | null;
  price: number | null;
  availability: string | null;
};

type ProductInsightRow = {
  id: string;
  title: string | null;
  category: string | null;
  price: number | null;
  stock: number | null;
};

type ReviewRow = {
  rating: number | null;
};

type OrderStatusRow = {
  status: string | null;
};

type FeaturedListing = {
  id: string;
  type: "service" | "product";
  title: string;
  category: string;
  price: number;
  status: string;
};

type ProviderInsight = {
  servicesCount: number;
  productsCount: number;
  averageRating: number;
  reviewCount: number;
  activeOrders: number;
};

type SeekerInsight = {
  postsCount: number;
  activeOrders: number;
};

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const [profileData, setProfileData] = useState<ProfileData>({
    name: "",
    location: "",
    bio: "",
    role: "provider",
    services: [],
    availability: "available",
    email: "",
    phone: "",
    website: "",
  });

  const [serviceInput, setServiceInput] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [providerInsight, setProviderInsight] = useState<ProviderInsight>({
    servicesCount: 0,
    productsCount: 0,
    averageRating: 0,
    reviewCount: 0,
    activeOrders: 0,
  });
  const [seekerInsight, setSeekerInsight] = useState<SeekerInsight>({
    postsCount: 0,
    activeOrders: 0,
  });
  const [featuredListings, setFeaturedListings] = useState<FeaturedListing[]>([]);
  const [copiedBusinessLink, setCopiedBusinessLink] = useState(false);

  const isProvider = profileData.role === "provider" || profileData.role === "business";
  const businessClaimed = isClaimedBusiness(profileData.role);
  const profileCompletion = calculateProfileCompletion({
    name: profileData.name,
    location: profileData.location,
    bio: profileData.bio,
    services: profileData.services,
    email: profileData.email,
    phone: profileData.phone,
    website: profileData.website,
  });
  const verificationStatus = calculateVerificationStatus({
    role: profileData.role,
    profileCompletion,
    listingsCount: providerInsight.servicesCount + providerInsight.productsCount,
    averageRating: providerInsight.averageRating,
    reviewCount: providerInsight.reviewCount,
  });
  const businessSlug = currentUserId ? createBusinessSlug(profileData.name, currentUserId) : "";
  const businessProfileUrl = businessSlug ? `/business/${businessSlug}` : "";

  const loadRoleInsights = useCallback(async (userId: string, role: string) => {
    setLoadingInsights(true);

    if (normalizeRole(role) !== "seeker") {
      const [{ data: services, count: servicesCount }, { data: products, count: productsCount }, { data: reviews }, { data: orders }] =
        await Promise.all([
          supabase
            .from("service_listings")
            .select("id,title,category,price,availability", { count: "exact" })
            .eq("provider_id", userId)
            .limit(4),
          supabase
            .from("product_catalog")
            .select("id,title,category,price,stock", { count: "exact" })
            .eq("provider_id", userId)
            .limit(4),
          supabase.from("reviews").select("rating").eq("provider_id", userId),
          supabase.from("orders").select("status").eq("provider_id", userId),
        ]);

      const reviewRows = (reviews as ReviewRow[] | null) || [];
      const ratingValues = reviewRows
        .map((row) => Number(row.rating))
        .filter((rating) => Number.isFinite(rating) && rating > 0);

      const averageRating = ratingValues.length
        ? Number((ratingValues.reduce((sum, rating) => sum + rating, 0) / ratingValues.length).toFixed(1))
        : 0;

      const orderRows = (orders as OrderStatusRow[] | null) || [];
      const activeOrders = orderRows.filter(
        (order) => !["completed", "cancelled", "closed", "rejected"].includes((order.status || "").toLowerCase())
      ).length;

      const serviceCards: FeaturedListing[] = ((services as ServiceInsightRow[] | null) || []).map((service) => ({
        id: service.id,
        type: "service",
        title: service.title || "Untitled service",
        category: service.category || "Service",
        price: Number(service.price || 0),
        status: (service.availability || "available").toLowerCase(),
      }));

      const productCards: FeaturedListing[] = ((products as ProductInsightRow[] | null) || []).map((product) => ({
        id: product.id,
        type: "product",
        title: product.title || "Untitled product",
        category: product.category || "Product",
        price: Number(product.price || 0),
        status: (product.stock || 0) > 0 ? "in stock" : "out of stock",
      }));

      setProviderInsight({
        servicesCount: servicesCount || 0,
        productsCount: productsCount || 0,
        averageRating,
        reviewCount: reviewRows.length,
        activeOrders,
      });
      setSeekerInsight({
        postsCount: 0,
        activeOrders: 0,
      });
      setFeaturedListings([...serviceCards, ...productCards].slice(0, 6));
      setLoadingInsights(false);
      return;
    }

    const [{ count: postsCount }, { data: orders }] = await Promise.all([
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("orders").select("status").eq("consumer_id", userId),
    ]);

    const orderRows = (orders as OrderStatusRow[] | null) || [];
    const activeOrders = orderRows.filter(
      (order) => !["completed", "cancelled", "closed", "rejected"].includes((order.status || "").toLowerCase())
    ).length;

    setSeekerInsight({
      postsCount: postsCount || 0,
      activeOrders,
    });
    setProviderInsight({
      servicesCount: 0,
      productsCount: 0,
      averageRating: 0,
      reviewCount: 0,
      activeOrders: 0,
    });
    setFeaturedListings([]);
    setLoadingInsights(false);
  }, []);

  // Load profile
  useEffect(() => {
    const loadProfile = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push("/");
        return;
      }

      const userId = sessionData.session.user.id;
      setCurrentUserId(userId);

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      let nextRole: "provider" | "business" | "seeker" = "provider";
      if (data) {
        nextRole = normalizeRole(data.role);
        setProfileData({
          name: data.name || "",
          location: data.location || "",
          bio: data.bio || "",
          role: nextRole,
          services: data.services || [],
          availability: data.availability || "available",
          email: data.email || "",
          phone: data.phone || "",
          website: data.website || "",
        });
      }

      setLoading(false);
    };

    loadProfile();
  }, [router]);

  useEffect(() => {
    if (!currentUserId) return;
    loadRoleInsights(currentUserId, profileData.role);
  }, [currentUserId, loadRoleInsights, profileData.role]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setProfileData((prev) => ({
      ...prev,
      [name]: value,
    }));
    
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateProfile = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!profileData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!profileData.location.trim()) {
      newErrors.location = "Location is required";
    }

    if (profileData.bio.trim().length < 20) {
      newErrors.bio = "Bio should be at least 20 characters";
    }

    if (profileData.services.length === 0) {
      newErrors.services =
        isProvider
          ? "Add at least one service or product category"
          : "Add at least one interest so providers can match you faster";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const saveProfile = async () => {
    if (!validateProfile()) {
      return;
    }

    setSaving(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;

    if (!userId) return;

    try {
      await supabase.from("profiles").upsert({
        id: userId,
        ...profileData,
      });

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving profile:", error);
      setErrors({ submit: "Failed to save profile. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const claimBusiness = async () => {
    if (!currentUserId) return;

    setProfileData((prev) => ({ ...prev, role: "business" }));
    setSaving(true);

    try {
      await supabase.from("profiles").upsert({
        id: currentUserId,
        ...profileData,
        role: "business",
      });

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error("Error claiming business:", error);
      setErrors({ submit: "Could not claim business right now. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const copyBusinessLink = async () => {
    if (!businessProfileUrl) return;
    const absoluteUrl = `${window.location.origin}${businessProfileUrl}`;
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopiedBusinessLink(true);
      setTimeout(() => setCopiedBusinessLink(false), 2200);
    } catch {
      setErrors({ submit: "Unable to copy link. Please copy the URL manually." });
    }
  };

  const addService = () => {
    const trimmedService = serviceInput.trim();
    if (!trimmedService) return;
    if (profileData.services.includes(trimmedService)) {
      setErrors({ services: "Service already added" });
      return;
    }
    if (profileData.services.length >= 15) {
      setErrors({ services: "Maximum 15 services allowed" });
      return;
    }

    setProfileData((prev) => ({
      ...prev,
      services: [...prev.services, trimmedService],
    }));
    setServiceInput("");
    setErrors({ ...errors, services: "" });
  };

  const removeService = (service: string) => {
    setProfileData((prev) => ({
      ...prev,
      services: prev.services.filter((s) => s !== service),
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addService();
    }
  };

  const availabilityOptions = [
    { value: "available", label: "Available", emoji: "🟢", color: "text-green-600" },
    { value: "busy", label: "Busy", emoji: "🟡", color: "text-yellow-600" },
    { value: "offline", label: "Offline", emoji: "🔴", color: "text-red-600" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-100 via-indigo-50 to-slate-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading Profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-indigo-50 to-slate-100">
      <div className="max-w-[2200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
        
        {/* Success Message */}
        {showSuccess && (
          <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top">
            <div className="bg-green-500 text-white px-6 py-4 rounded-xl shadow-lg flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6" />
              <span className="font-semibold">Profile saved successfully!</span>
            </div>
          </div>
        )}

        {/* Header with Profile Completion */}
        <div className="mb-8 lg:mb-12">
          <div className="bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 rounded-3xl p-8 lg:p-10 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50"></div>
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-4xl border-4 border-white/30 shadow-xl">
                    <User className="w-10 h-10 lg:w-12 lg:h-12" />
                  </div>
                  <div>
                    <h1 className="text-3xl lg:text-4xl font-bold mb-2">
                      {isProvider ? (businessClaimed ? "Business Profile" : "Provider Profile") : "Seeker Profile"}
                    </h1>
                    <p className="text-white/90 text-sm lg:text-base">
                      {isProvider
                        ? "Showcase your business, build trust, and win nearby customers."
                        : "Share what you need and get matched with nearby providers faster."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Profile Completion Bar */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold">Profile Completion</span>
                  <span className="text-xl font-bold">{profileCompletion}%</span>
                </div>
                <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-500 rounded-full"
                    style={{ width: `${profileCompletion}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Form */}
        <div className="space-y-6">
          {/* Basic Information */}
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6 lg:p-8 border border-slate-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">
                Basic Information
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Full Name *
                </label>
                <input
                  name="name"
                  placeholder="John Doe"
                  className={`w-full px-4 py-3 rounded-xl border-2 bg-white text-slate-900 placeholder-slate-400 transition-all duration-200 focus:outline-none focus:ring-4 ${
                    errors.name
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "border-slate-200 focus:border-blue-500 focus:ring-blue-500/20"
                  }`}
                  value={profileData.name}
                  onChange={handleInputChange}
                />
                {errors.name && (
                  <p className="mt-2 text-sm text-red-600">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Location *
                </label>
                <input
                  name="location"
                  placeholder="New York, NY"
                  className={`w-full px-4 py-3 rounded-xl border-2 bg-white text-slate-900 placeholder-slate-400 transition-all duration-200 focus:outline-none focus:ring-4 ${
                    errors.location
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                      : "border-slate-200 focus:border-blue-500 focus:ring-blue-500/20"
                  }`}
                  value={profileData.location}
                  onChange={handleInputChange}
                />
                {errors.location && (
                  <p className="mt-2 text-sm text-red-600">{errors.location}</p>
                )}
              </div>
            </div>
          </div>

          {/* Role Selection */}
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6 lg:p-8 border border-slate-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">
                Your Role
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setProfileData({ ...profileData, role: "provider" })}
                className={`relative overflow-hidden rounded-xl px-6 py-5 font-semibold transition-all duration-300 ${
                  isProvider
                    ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 scale-105"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <div className="flex items-center justify-center gap-3">
                  <Award className="w-5 h-5" />
                  <span>{businessClaimed ? "Business Owner" : "Service Provider"}</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setProfileData({ ...profileData, role: "seeker" })}
                className={`relative overflow-hidden rounded-xl px-6 py-5 font-semibold transition-all duration-300 ${
                  profileData.role === "seeker"
                    ? "bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-lg shadow-purple-500/30 scale-105"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <div className="flex items-center justify-center gap-3">
                  <User className="w-5 h-5" />
                  <span>Looking for Services</span>
                </div>
              </button>
            </div>
          </div>

          {/* Role Specific Experience */}
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6 lg:p-8 border border-slate-200">
            {isProvider ? (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                      <Store className="w-6 h-6 text-indigo-600" />
                      Business Showcase
                    </h2>
                    <p className="text-sm text-slate-600 mt-1">
                      Treat this like your local LinkedIn page: prove trust, highlight offerings, and convert nearby demand.
                    </p>
                    <div className="mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold bg-slate-100 text-slate-700">
                      <BadgeCheck className="w-3.5 h-3.5" />
                      {verificationLabel(verificationStatus)}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => router.push("/dashboard/provider/listings")}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-800 hover:bg-slate-200 font-semibold transition-colors"
                    >
                      Manage Listings
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/dashboard/provider/orders")}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-800 hover:bg-slate-200 font-semibold transition-colors"
                    >
                      Lead Pipeline
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <button
                    type="button"
                    onClick={claimBusiness}
                    disabled={businessClaimed || saving}
                    className={`rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                      businessClaimed
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-70"
                    }`}
                  >
                    {businessClaimed ? "Business Claimed" : "Claim Your Business"}
                  </button>
                  <button
                    type="button"
                    onClick={copyBusinessLink}
                    disabled={!businessProfileUrl}
                    className="rounded-xl px-4 py-3 text-sm font-semibold bg-slate-100 text-slate-800 hover:bg-slate-200 inline-flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    <Copy className="w-4 h-4" />
                    {copiedBusinessLink ? "Copied" : "Copy Public Link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => businessProfileUrl && window.open(businessProfileUrl, "_blank")}
                    disabled={!businessProfileUrl}
                    className="rounded-xl px-4 py-3 text-sm font-semibold bg-slate-100 text-slate-800 hover:bg-slate-200 inline-flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View Public Profile
                  </button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Services</p>
                    <p className="text-2xl font-bold text-slate-900">{providerInsight.servicesCount}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Products</p>
                    <p className="text-2xl font-bold text-slate-900">{providerInsight.productsCount}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Rating</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {providerInsight.averageRating ? providerInsight.averageRating.toFixed(1) : "New"}
                    </p>
                    <p className="text-xs text-slate-500">{providerInsight.reviewCount} reviews</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Active Orders</p>
                    <p className="text-2xl font-bold text-slate-900">{providerInsight.activeOrders}</p>
                  </div>
                </div>

                {loadingInsights ? (
                  <p className="text-sm text-slate-500">Loading business insights...</p>
                ) : featuredListings.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                    No offerings published yet. Add services/products to make your business discoverable in nearby search.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-slate-700">Featured Offerings</p>
                    <div className="grid md:grid-cols-2 gap-3">
                      {featuredListings.map((listing) => (
                        <div
                          key={`${listing.type}-${listing.id}`}
                          className="rounded-xl border border-slate-200 p-4 bg-slate-50"
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <p className="font-semibold text-slate-900 truncate">{listing.title}</p>
                            <span className="text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-700">
                              {listing.type}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500">{listing.category}</p>
                          <div className="mt-2 flex items-center justify-between text-sm">
                            <span className="font-semibold text-slate-900">₹ {listing.price.toLocaleString()}</span>
                            <span className="text-slate-500 capitalize">{listing.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <ShoppingBag className="w-6 h-6 text-purple-600" />
                    Seeker Profile Strategy
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Share your needs clearly so local businesses can discover and respond quickly.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Need Posts</p>
                    <p className="text-2xl font-bold text-slate-900">{seekerInsight.postsCount}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Active Orders</p>
                    <p className="text-2xl font-bold text-slate-900">{seekerInsight.activeOrders}</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/people")}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-100 text-slate-800 hover:bg-slate-200 font-semibold transition-colors"
                  >
                    Discover Providers
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/create_post")}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 font-semibold transition-colors"
                  >
                    Post a Need
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                  Tip: Add interests below (e.g., &quot;Pastry Catering&quot;, &quot;Custom Cakes&quot;, &quot;Event Decor&quot;) so nearby SMBs can match you faster.
                </div>
              </div>
            )}
          </div>

          {/* About/Bio */}
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6 lg:p-8 border border-slate-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">
                About You
              </h2>
            </div>

            <textarea
              name="bio"
              placeholder="Tell people about yourself, your experience, skills, and why they should trust you. Share what makes you unique and how you can help..."
              className={`w-full px-4 py-3 rounded-xl border-2 bg-white text-slate-900 placeholder-slate-400 transition-all duration-200 focus:outline-none focus:ring-4 resize-none ${
                errors.bio
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                  : "border-slate-200 focus:border-blue-500 focus:ring-blue-500/20"
              }`}
              rows={5}
              value={profileData.bio}
              onChange={handleInputChange}
            />
            {errors.bio && (
              <p className="mt-2 text-sm text-red-600">{errors.bio}</p>
            )}
            <p className="mt-2 text-xs text-slate-500">
              {profileData.bio.length} characters (minimum 20 characters)
            </p>
          </div>

          {/* Services/Skills */}
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6 lg:p-8 border border-slate-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                <Award className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">
                {isProvider ? "Services & Offerings" : "Needs & Interests"}
              </h2>
            </div>

            <div className="flex gap-2 mb-4">
              <input
                placeholder={
                  isProvider
                    ? "e.g., Plumbing, Cake Design, Home Cleaning"
                    : "e.g., Pastry Catering, Birthday Cakes, Weekend Delivery"
                }
                className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-200 bg-white text-slate-900 placeholder-slate-400 transition-all duration-200 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                value={serviceInput}
                onChange={(e) => setServiceInput(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <button
                onClick={addService}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Add</span>
              </button>
            </div>

            {errors.services && (
              <p className="mb-3 text-sm text-red-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {errors.services}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {profileData.services.map((service) => (
                <span
                  key={service}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full px-4 py-2 text-sm font-medium shadow-md hover:shadow-lg transition-all duration-200"
                >
                  {service}
                  <button
                    onClick={() => removeService(service)}
                    className="hover:bg-white/20 rounded-full p-0.5 transition-colors duration-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </span>
              ))}
            </div>

            <p className="mt-3 text-xs text-slate-500">
              {profileData.services.length}/15 {isProvider ? "offerings" : "interests"} added
            </p>
          </div>

          {/* Contact Information (Optional) */}
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6 lg:p-8 border border-slate-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">
                Contact Information <span className="text-sm font-normal text-slate-500">(Optional)</span>
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  placeholder="john@example.com"
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-white text-slate-900 placeholder-slate-400 transition-all duration-200 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                  value={profileData.email}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Phone
                </label>
                <input
                  name="phone"
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-white text-slate-900 placeholder-slate-400 transition-all duration-200 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                  value={profileData.phone}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Website
                </label>
                <input
                  name="website"
                  type="url"
                  placeholder="www.yourwebsite.com"
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-white text-slate-900 placeholder-slate-400 transition-all duration-200 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                  value={profileData.website}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>

          {/* Availability */}
          {isProvider && (
            <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6 lg:p-8 border border-slate-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Availability Status
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {availabilityOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setProfileData({ ...profileData, availability: option.value })}
                    className={`relative overflow-hidden rounded-xl px-6 py-5 font-semibold transition-all duration-300 ${
                      profileData.availability === option.value
                        ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 scale-105"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-2xl">{option.emoji}</span>
                      <span>{option.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error Message */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm text-red-600 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                {errors.submit}
              </p>
            </div>
          )}

          {/* Save Button */}
          <div className="sticky bottom-6 z-10">
            <button
              onClick={saveProfile}
              disabled={saving}
              className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-600 hover:from-blue-600 hover:via-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold text-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl hover:shadow-3xl hover:scale-[1.02] flex items-center justify-center gap-3"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Profile...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Save Profile</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
