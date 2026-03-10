"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { CommunityPeopleResponse } from "@/lib/api/community";
import { fetchAuthedJson } from "@/lib/clientApi";
import { ensureClientProfile } from "@/lib/clientProfile";
import ProviderTrustPanel from "@/app/components/ProviderTrustPanel";
import {
  createConnectionBuckets,
  createConnectionStateMap,
  deriveConnectionState,
  listCurrentUserConnectionRows,
  respondToConnectionRequest,
  sendConnectionRequest,
  type ConnectionRequestRow,
} from "@/lib/connections";
import { getOrCreateDirectConversationId, sendDirectMessage } from "@/lib/directMessages";
import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  Check,
  ChevronsDown,
  Clock3,
  ExternalLink,
  Filter,
  Gauge,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Target,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import {
  calculateLocalRankScore,
  calculateProfileCompletion,
  calculateVerificationStatus,
  createBusinessSlug,
  estimateResponseMinutes,
} from "@/lib/business";
import {
  defaultMarketCoordinates,
  distanceBetweenCoordinatesKm,
  getBrowserCoordinates,
  resolveCoordinates,
} from "@/lib/geo";
import { extractPresenceUserIds, GLOBAL_PRESENCE_CHANNEL } from "@/lib/realtime";

type ProfileRow = {
  id: string;
  name?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  bio?: string | null;
  location?: string | null;
  availability?: string | null;
  services?: string[] | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type ServiceRow = {
  provider_id: string;
  category?: string | null;
  price?: number | null;
};

type ProductRow = {
  provider_id: string;
  category?: string | null;
  price?: number | null;
};

type PostRow = {
  user_id: string;
  category: string;
};

type HelpRequestRow = {
  requester_id: string;
  category: string;
  budget: number;
};

type ReviewRow = {
  provider_id: string;
  rating: number;
};

type ProviderPresenceRow = {
  provider_id: string;
  is_online?: boolean | null;
  availability?: string | null;
  response_sla_minutes?: number | string | null;
  rolling_response_minutes?: number | string | null;
  last_seen?: string | null;
};

type ProviderOrderStatsRow = {
  provider_id: string;
  completed_jobs: number | string;
  open_leads: number | string;
};

type ConnectionNotice = {
  kind: "success" | "error";
  message: string;
};

type ProviderCard = {
  id: string;
  name: string;
  businessSlug: string;
  avatar: string;
  coverImage: string;
  mediaGallery: string[];
  role: string;
  bio: string;
  location: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  distanceKm: number;
  rating: number;
  reviews: number;
  verified: boolean;
  online: boolean;
  serviceCount: number;
  productCount: number;
  demandCount?: number;
  completedJobs: number;
  openLeads: number;
  responseMinutes: number;
  startingPrice: number;
  tags: string[];
  serviceTags: string[];
  productTags: string[];
  profileCompletion: number;
  rankScore: number;
  verificationStatus: "verified" | "pending" | "unclaimed";
  latitude: number;
  longitude: number;
};

type FlexibleRow = Record<string, unknown>;

const stringFromRow = (row: FlexibleRow, keys: string[], fallback = "") => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return fallback;
};

const numberFromRow = (row: FlexibleRow, keys: string[], fallback = 0) => {
  for (const key of keys) {
    const value = row[key];
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const TABS = ["All", "Nearby", "Active Now", "Verified"] as const;
const DEFAULT_RADIUS_KM = 5;
const RADIUS_OPTIONS = [1, 5, 10, 15, 25];
const SORT_OPTIONS = ["Best Match", "Nearest", "Top Rated", "Most Listings", "Fast Response"] as const;
const FAST_RESPONSE_THRESHOLD_MINUTES = 15;
const PEOPLE_PREFERENCES_STORAGE_KEY = "local-marketplace-people-preferences-v1";
const GEO_LOOKUP_TIMEOUT_MS = 1200;
const PROVIDERS_BATCH_SIZE = 8;
const MAX_DISCOVERABLE_PROFILES = 120;
const DEMO_CHAT_PREFERRED_NAMES = ["User", "Test User 2"] as const;

const demoPeople: ProviderCard[] = [
  {
    id: "demo-1",
    name: "Test Electrician",
    businessSlug: "test-electrician-demo-1",
    avatar: "https://i.pravatar.cc/200?img=12",
    coverImage: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1600&q=80",
    mediaGallery: [
      "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1456613820599-bfe244172af5?auto=format&fit=crop&w=600&q=80",
    ],
    role: "Electrician",
    bio: "Home electrical repair and emergency support.",
    location: "Nearby",
    email: "electrician.demo@localmarket.test",
    phone: "+91 90100 22110",
    website: "https://services.localmarket.test/electrician",
    distanceKm: 1.2,
    rating: 4.8,
    reviews: 22,
    verified: true,
    online: true,
    serviceCount: 4,
    productCount: 0,
    completedJobs: 48,
    openLeads: 3,
    responseMinutes: 6,
    startingPrice: 299,
    tags: ["Electrician", "Repair", "Urgent"],
    serviceTags: ["Wiring", "Switchboard", "Power Backup"],
    productTags: ["MCB", "LED Lights"],
    profileCompletion: 88,
    rankScore: 91,
    verificationStatus: "verified",
    latitude: 12.9726,
    longitude: 77.6003,
  },
  {
    id: "demo-2",
    name: "Test Cleaning Team",
    businessSlug: "test-cleaning-team-demo-2",
    avatar: "https://i.pravatar.cc/200?img=32",
    coverImage: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1600&q=80",
    mediaGallery: [
      "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1527515862127-a4fc05baf7a5?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=600&q=80",
    ],
    role: "Cleaning Service",
    bio: "Residential deep cleaning and move-in cleaning.",
    location: "West Side",
    email: "cleaning.demo@localmarket.test",
    phone: "+91 90100 88221",
    website: "https://services.localmarket.test/cleaning",
    distanceKm: 2.7,
    rating: 4.6,
    reviews: 14,
    verified: true,
    online: true,
    serviceCount: 3,
    productCount: 0,
    completedJobs: 36,
    openLeads: 2,
    responseMinutes: 11,
    startingPrice: 399,
    tags: ["Cleaning", "Home", "Office"],
    serviceTags: ["Deep Clean", "Move-in Clean", "Office Sanitization"],
    productTags: ["Eco Liquids"],
    profileCompletion: 82,
    rankScore: 84,
    verificationStatus: "verified",
    latitude: 12.9681,
    longitude: 77.6124,
  },
  {
    id: "demo-3",
    name: "Test Plumbing Pro",
    businessSlug: "test-plumbing-pro-demo-3",
    avatar: "https://i.pravatar.cc/200?img=19",
    coverImage: "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=1600&q=80",
    mediaGallery: [
      "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1523419409543-0a4d5f7c3f77?auto=format&fit=crop&w=600&q=80",
    ],
    role: "Plumber",
    bio: "Leakage, fittings, bathroom pipeline and kitchen sink fixes.",
    location: "East End",
    email: "plumbing.demo@localmarket.test",
    phone: "+91 90100 55440",
    website: "https://services.localmarket.test/plumbing",
    distanceKm: 3.1,
    rating: 4.9,
    reviews: 31,
    verified: true,
    online: true,
    serviceCount: 5,
    productCount: 1,
    completedJobs: 72,
    openLeads: 4,
    responseMinutes: 5,
    startingPrice: 349,
    tags: ["Plumbing", "Fittings", "Emergency"],
    serviceTags: ["Leak Fix", "Bathroom Fittings", "Emergency Visit"],
    productTags: ["Pipes", "Faucets"],
    profileCompletion: 92,
    rankScore: 95,
    verificationStatus: "verified",
    latitude: 12.9789,
    longitude: 77.5886,
  },
  {
    id: "demo-4",
    name: "Rapid AC Care",
    businessSlug: "rapid-ac-care-demo-4",
    avatar: "https://i.pravatar.cc/200?img=24",
    coverImage: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1600&q=80",
    mediaGallery: [
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=600&q=80",
    ],
    role: "AC Technician",
    bio: "Split and central AC installation, gas refill, and urgent cooling support.",
    location: "North Block",
    email: "ac.demo@localmarket.test",
    phone: "+91 90100 44551",
    website: "https://services.localmarket.test/ac-care",
    distanceKm: 4.4,
    rating: 4.7,
    reviews: 19,
    verified: true,
    online: true,
    serviceCount: 6,
    productCount: 1,
    completedJobs: 63,
    openLeads: 5,
    responseMinutes: 9,
    startingPrice: 599,
    tags: ["AC", "Cooling", "Repair"],
    serviceTags: ["AC Install", "Gas Refill", "Cooling Fix"],
    productTags: ["AC Filters"],
    profileCompletion: 90,
    rankScore: 89,
    verificationStatus: "verified",
    latitude: 12.9999,
    longitude: 77.5922,
  },
  {
    id: "demo-5",
    name: "MarketFresh Vendor",
    businessSlug: "marketfresh-vendor-demo-5",
    avatar: "https://i.pravatar.cc/200?img=41",
    coverImage: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1600&q=80",
    mediaGallery: [
      "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=600&q=80",
    ],
    role: "Local Vendor",
    bio: "Daily essentials, groceries, and quick neighborhood fulfillment.",
    location: "Central Market",
    email: "marketfresh.demo@localmarket.test",
    phone: "+91 90100 66431",
    website: "https://services.localmarket.test/marketfresh",
    distanceKm: 1.8,
    rating: 4.7,
    reviews: 41,
    verified: true,
    online: true,
    serviceCount: 2,
    productCount: 12,
    completedJobs: 104,
    openLeads: 6,
    responseMinutes: 7,
    startingPrice: 99,
    tags: ["Vendor", "Groceries", "Delivery"],
    serviceTags: ["Same Day Delivery", "Bulk Supply"],
    productTags: ["Groceries", "Dairy", "Fresh Produce"],
    profileCompletion: 93,
    rankScore: 94,
    verificationStatus: "verified",
    latitude: 12.9711,
    longitude: 77.6047,
  },
  {
    id: "demo-6",
    name: "Prime Carpentry Studio",
    businessSlug: "prime-carpentry-studio-demo-6",
    avatar: "https://i.pravatar.cc/200?img=46",
    coverImage: "https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=1600&q=80",
    mediaGallery: [
      "https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=600&q=80",
    ],
    role: "Carpenter",
    bio: "Custom furniture repair, modular fitting, and interior woodwork.",
    location: "South Avenue",
    email: "carpentry.demo@localmarket.test",
    phone: "+91 90100 77214",
    website: "https://services.localmarket.test/carpentry",
    distanceKm: 4.9,
    rating: 4.5,
    reviews: 16,
    verified: false,
    online: false,
    serviceCount: 5,
    productCount: 3,
    completedJobs: 44,
    openLeads: 3,
    responseMinutes: 24,
    startingPrice: 799,
    tags: ["Carpentry", "Furniture", "Interior"],
    serviceTags: ["Furniture Repair", "Wardrobe Fit", "Door Install"],
    productTags: ["Cabinet Panels", "Wood Boards"],
    profileCompletion: 79,
    rankScore: 78,
    verificationStatus: "pending",
    latitude: 12.9418,
    longitude: 77.6087,
  },
  {
    id: "demo-7",
    name: "QuickFix Laptop Lab",
    businessSlug: "quickfix-laptop-lab-demo-7",
    avatar: "https://i.pravatar.cc/200?img=55",
    coverImage: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1600&q=80",
    mediaGallery: [
      "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=600&q=80",
    ],
    role: "Electronics Repair",
    bio: "Laptop diagnostics, SSD upgrades, motherboard checks, and home pickup.",
    location: "IT Corridor",
    email: "laptop.demo@localmarket.test",
    phone: "+91 90100 11336",
    website: "https://services.localmarket.test/laptop-lab",
    distanceKm: 4.7,
    rating: 4.8,
    reviews: 27,
    verified: true,
    online: true,
    serviceCount: 7,
    productCount: 4,
    completedJobs: 88,
    openLeads: 4,
    responseMinutes: 13,
    startingPrice: 699,
    tags: ["Repair", "Laptop", "IT"],
    serviceTags: ["Laptop Repair", "Data Recovery", "Home Pickup"],
    productTags: ["SSD", "Laptop Battery", "Adapters"],
    profileCompletion: 91,
    rankScore: 90,
    verificationStatus: "verified",
    latitude: 12.9352,
    longitude: 77.6245,
  },
  {
    id: "demo-8",
    name: "Aqua RO Service Hub",
    businessSlug: "aqua-ro-service-hub-demo-8",
    avatar: "https://i.pravatar.cc/200?img=61",
    coverImage: "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=1600&q=80",
    mediaGallery: [
      "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=600&q=80",
    ],
    role: "Water Purifier Technician",
    bio: "RO maintenance, filter replacement, and water quality checks.",
    location: "Lake View",
    email: "aqua.demo@localmarket.test",
    phone: "+91 90100 90422",
    website: "https://services.localmarket.test/aqua-ro",
    distanceKm: 4.3,
    rating: 4.4,
    reviews: 12,
    verified: false,
    online: true,
    serviceCount: 4,
    productCount: 4,
    completedJobs: 38,
    openLeads: 2,
    responseMinutes: 18,
    startingPrice: 449,
    tags: ["RO", "Water", "Maintenance"],
    serviceTags: ["RO Service", "Filter Change", "Pipeline Check"],
    productTags: ["RO Filters", "UV Lamp"],
    profileCompletion: 74,
    rankScore: 73,
    verificationStatus: "pending",
    latitude: 12.9504,
    longitude: 77.5753,
  },
  {
    id: "demo-9",
    name: "GreenLeaf Nursery Vendor",
    businessSlug: "greenleaf-nursery-vendor-demo-9",
    avatar: "https://i.pravatar.cc/200?img=36",
    coverImage: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1600&q=80",
    mediaGallery: [
      "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=600&q=80",
    ],
    role: "Plant Vendor",
    bio: "Indoor plants, soil supplies, and balcony garden setup.",
    location: "Garden Lane",
    email: "greenleaf.demo@localmarket.test",
    phone: "+91 90100 44127",
    website: "https://services.localmarket.test/greenleaf",
    distanceKm: 2.2,
    rating: 4.9,
    reviews: 33,
    verified: true,
    online: true,
    serviceCount: 3,
    productCount: 10,
    completedJobs: 70,
    openLeads: 3,
    responseMinutes: 8,
    startingPrice: 149,
    tags: ["Vendor", "Plants", "Garden"],
    serviceTags: ["Garden Setup", "Plant Care Visits"],
    productTags: ["Indoor Plants", "Pots", "Compost"],
    profileCompletion: 94,
    rankScore: 92,
    verificationStatus: "verified",
    latitude: 12.9678,
    longitude: 77.6319,
  },
  {
    id: "demo-10",
    name: "Swift Bike Mechanic",
    businessSlug: "swift-bike-mechanic-demo-10",
    avatar: "https://i.pravatar.cc/200?img=49",
    coverImage: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1600&q=80",
    mediaGallery: [
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=600&q=80",
    ],
    role: "Bike Mechanic",
    bio: "Doorstep bike servicing, puncture support, and chain tuneups.",
    location: "East Circle",
    email: "bike.demo@localmarket.test",
    phone: "+91 90100 77233",
    website: "https://services.localmarket.test/bike-mechanic",
    distanceKm: 4.8,
    rating: 4.3,
    reviews: 18,
    verified: false,
    online: false,
    serviceCount: 6,
    productCount: 2,
    completedJobs: 46,
    openLeads: 2,
    responseMinutes: 28,
    startingPrice: 299,
    tags: ["Mechanic", "Bike", "Doorstep"],
    serviceTags: ["Bike Service", "Puncture Fix", "Brake Tune"],
    productTags: ["Chain Oil", "Brake Pads"],
    profileCompletion: 71,
    rankScore: 69,
    verificationStatus: "unclaimed",
    latitude: 12.9872,
    longitude: 77.6431,
  },
  {
    id: "demo-11",
    name: "HomeChef Tiffin Vendor",
    businessSlug: "homechef-tiffin-vendor-demo-11",
    avatar: "https://i.pravatar.cc/200?img=9",
    coverImage: "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1600&q=80",
    mediaGallery: [
      "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=600&q=80",
    ],
    role: "Food Vendor",
    bio: "Healthy tiffin subscriptions and office meal box delivery.",
    location: "Office District",
    email: "homechef.demo@localmarket.test",
    phone: "+91 90100 50110",
    website: "https://services.localmarket.test/homechef",
    distanceKm: 3.4,
    rating: 4.8,
    reviews: 57,
    verified: true,
    online: true,
    serviceCount: 4,
    productCount: 9,
    completedJobs: 126,
    openLeads: 8,
    responseMinutes: 6,
    startingPrice: 129,
    tags: ["Food", "Vendor", "Delivery"],
    serviceTags: ["Tiffin Subscription", "Corporate Meals"],
    productTags: ["Meal Box", "Snacks", "Beverages"],
    profileCompletion: 95,
    rankScore: 96,
    verificationStatus: "verified",
    latitude: 12.9563,
    longitude: 77.6133,
  },
  {
    id: "demo-12",
    name: "Event Decor & Lights",
    businessSlug: "event-decor-lights-demo-12",
    avatar: "https://i.pravatar.cc/200?img=53",
    coverImage: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80",
    mediaGallery: [
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=600&q=80",
    ],
    role: "Decor Vendor",
    bio: "Birthday, wedding, and office decor setup with custom lighting.",
    location: "West Point",
    email: "decor.demo@localmarket.test",
    phone: "+91 90100 66287",
    website: "https://services.localmarket.test/decor",
    distanceKm: 4.6,
    rating: 4.6,
    reviews: 21,
    verified: true,
    online: false,
    serviceCount: 5,
    productCount: 6,
    completedJobs: 59,
    openLeads: 3,
    responseMinutes: 19,
    startingPrice: 1499,
    tags: ["Decor", "Lights", "Events"],
    serviceTags: ["Event Setup", "Light Design", "On-site Team"],
    productTags: ["Backdrop", "Party Lights", "Props"],
    profileCompletion: 85,
    rankScore: 82,
    verificationStatus: "verified",
    latitude: 12.9307,
    longitude: 77.5968,
  },
];

const hashNumber = (seed: string, min: number, max: number) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 33 + seed.charCodeAt(i)) % 10000;
  }
  return min + (hash % (max - min + 1));
};

const buildFallbackMemberProfile = (params: {
  memberId: string;
  serviceCount: number;
  productCount: number;
  demandCount: number;
  tags: string[];
}) => {
  const { memberId, serviceCount, productCount, demandCount, tags } = params;
  const role =
    serviceCount + productCount > 0
      ? "Service Provider"
      : demandCount > 0
      ? "Marketplace Member"
      : "Local Member";

  const bio =
    serviceCount + productCount > 0
      ? "Available for nearby requests, quotes, and realtime marketplace chat."
      : demandCount > 0
      ? "Active local member posting requests and collaborating with nearby providers."
      : "Available for nearby marketplace collaboration.";

  return {
    id: memberId,
    name: `Local Member ${memberId.slice(0, 4).toUpperCase()}`,
    avatar_url: `https://i.pravatar.cc/200?u=${encodeURIComponent(memberId)}`,
    role,
    bio,
    location: "Nearby",
    availability: "available",
    services: tags.slice(0, 4),
    email: null,
    phone: null,
    website: null,
    latitude: null,
    longitude: null,
  } satisfies ProfileRow;
};

const ROLE_MEDIA_LIBRARY = {
  electrician: [
    "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1456613820599-bfe244172af5?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1600&q=80",
  ],
  plumbing: [
    "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1523419409543-0a4d5f7c3f77?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=1600&q=80",
  ],
  cleaning: [
    "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1527515862127-a4fc05baf7a5?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1511551203524-9a24350a5771?auto=format&fit=crop&w=1600&q=80",
  ],
  vendor: [
    "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1600&q=80",
  ],
  carpentry: [
    "https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1560185007-c5ca9d2c014d?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=1600&q=80",
  ],
  default: [
    "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80",
    "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1600&q=80",
  ],
} as const;

const resolveMediaPool = (role: string, tags: string[]) => {
  const context = `${role} ${tags.join(" ")}`.toLowerCase();
  if (/(electric|wire|power|ac|hvac)/.test(context)) return ROLE_MEDIA_LIBRARY.electrician;
  if (/(plumb|pipe|tap|bathroom)/.test(context)) return ROLE_MEDIA_LIBRARY.plumbing;
  if (/(clean|housekeep|sanitize|laundry)/.test(context)) return ROLE_MEDIA_LIBRARY.cleaning;
  if (/(vendor|seller|retail|shop|market|supply|delivery)/.test(context)) return ROLE_MEDIA_LIBRARY.vendor;
  if (/(carpen|wood|furniture|interior|fabrication)/.test(context)) return ROLE_MEDIA_LIBRARY.carpentry;
  return ROLE_MEDIA_LIBRARY.default;
};

const buildProviderMediaGallery = (seed: string, role: string, tags: string[]) => {
  const pool = resolveMediaPool(role, tags);
  const start = hashNumber(seed, 0, pool.length - 1);
  return [pool[start], pool[(start + 1) % pool.length], pool[(start + 2) % pool.length]];
};

const normalizeWebsiteUrl = (website: string | null | undefined) => {
  if (!website) return null;
  if (/^https?:\/\//i.test(website)) return website;
  return `https://${website}`;
};

const normalizePhoneForHref = (phone: string | null | undefined) => {
  if (!phone) return null;
  const normalized = phone.replace(/[^\d+]/g, "");
  return normalized ? `tel:${normalized}` : null;
};

const formatSyncTime = (iso: string) => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const describeMatchReason = (person: ProviderCard, online: boolean) => {
  const reasons: string[] = [];
  if (online) reasons.push("Online now");
  if (person.distanceKm <= 2) reasons.push(`${person.distanceKm} km away`);
  if (person.responseMinutes <= FAST_RESPONSE_THRESHOLD_MINUTES) {
    reasons.push(`${person.responseMinutes} min response`);
  }
  if (person.rating >= 4.7 && person.reviews >= 3) reasons.push(`${person.rating}★ trusted`);
  if (person.verified) reasons.push("Verified business");
  if (person.completedJobs >= 40) reasons.push(`${person.completedJobs}+ jobs done`);
  return reasons.slice(0, 3);
};

export default function PeoplePage() {
  const router = useRouter();
  const reloadTimerRef = useRef<number | null>(null);
  const loadMoreTimerRef = useRef<number | null>(null);
  const infiniteSentinelRef = useRef<HTMLDivElement | null>(null);
  const connectionsSectionRef = useRef<HTMLElement | null>(null);
  const resultsSectionRef = useRef<HTMLElement | null>(null);
  const deepLinkProviderAppliedRef = useRef(false);
  const [deepLinkContext] = useState<{
    providerId: string | null;
    query: string;
    tab: (typeof TABS)[number] | null;
    intent: string | null;
  } | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const source = params.get("source");
    const providerId = params.get("provider");
    const query = params.get("q") || params.get("context_audience") || params.get("context_title") || "";
    const tabParam = params.get("tab");
    const tab = TABS.includes((tabParam as (typeof TABS)[number]) || "All")
      ? ((tabParam as (typeof TABS)[number]) || null)
      : null;
    const intent = params.get("intent");

    if (!providerId && !query && !tab && source !== "welcome_feed") {
      return null;
    }

    return {
      providerId,
      query,
      tab,
      intent,
    };
  });
  const [deepLinkApplied, setDeepLinkApplied] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [loadingChatId, setLoadingChatId] = useState<string | null>(null);
  const [inlineComposerProviderId, setInlineComposerProviderId] = useState<string | null>(null);
  const [inlineMessageDrafts, setInlineMessageDrafts] = useState<Record<string, string>>({});
  const [inlineSendingProviderId, setInlineSendingProviderId] = useState<string | null>(null);
  const [inlineConversationByProvider, setInlineConversationByProvider] = useState<Record<string, string>>({});
  const [inlineMessageStatusByProvider, setInlineMessageStatusByProvider] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("All");
  const [radiusKm, setRadiusKm] = useState<number>(DEFAULT_RADIUS_KM);
  const [sortBy, setSortBy] = useState<(typeof SORT_OPTIONS)[number]>("Best Match");
  const [minRating, setMinRating] = useState<number>(0);
  const [maxResponseMinutes, setMaxResponseMinutes] = useState<number>(0);
  const [minProfileCompletion, setMinProfileCompletion] = useState<number>(0);
  const [requireReviews, setRequireReviews] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [instantOnly, setInstantOnly] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [usingDemo, setUsingDemo] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [connectionRows, setConnectionRows] = useState<ConnectionRequestRow[]>([]);
  const [busyConnectionTargetId, setBusyConnectionTargetId] = useState<string | null>(null);
  const [busyConnectionRequestId, setBusyConnectionRequestId] = useState<string | null>(null);
  const [connectionNotice, setConnectionNotice] = useState<ConnectionNotice | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>("");
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(PROVIDERS_BATCH_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!connectionNotice) return;
    const timerId = window.setTimeout(() => {
      setConnectionNotice(null);
    }, 3200);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [connectionNotice]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(PEOPLE_PREFERENCES_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        search?: string;
        activeTab?: (typeof TABS)[number];
        radiusKm?: number;
        sortBy?: (typeof SORT_OPTIONS)[number];
        minRating?: number;
        maxResponseMinutes?: number;
        minProfileCompletion?: number;
        requireReviews?: boolean;
        verifiedOnly?: boolean;
        instantOnly?: boolean;
        showAdvancedFilters?: boolean;
      };

      if (typeof parsed.search === "string") setSearch(parsed.search);
      if (TABS.includes((parsed.activeTab as (typeof TABS)[number]) || "All")) {
        setActiveTab((parsed.activeTab as (typeof TABS)[number]) || "All");
      }
      if (Number.isFinite(parsed.radiusKm) && RADIUS_OPTIONS.includes(Number(parsed.radiusKm))) {
        setRadiusKm(Number(parsed.radiusKm));
      }
      if (SORT_OPTIONS.includes((parsed.sortBy as (typeof SORT_OPTIONS)[number]) || "Best Match")) {
        setSortBy((parsed.sortBy as (typeof SORT_OPTIONS)[number]) || "Best Match");
      }
      if (Number.isFinite(parsed.minRating)) setMinRating(Math.max(0, Number(parsed.minRating)));
      if (Number.isFinite(parsed.maxResponseMinutes)) {
        setMaxResponseMinutes(Math.max(0, Number(parsed.maxResponseMinutes)));
      }
      if (Number.isFinite(parsed.minProfileCompletion)) {
        setMinProfileCompletion(Math.max(0, Math.min(100, Number(parsed.minProfileCompletion))));
      }
      if (typeof parsed.requireReviews === "boolean") setRequireReviews(parsed.requireReviews);
      if (typeof parsed.verifiedOnly === "boolean") setVerifiedOnly(parsed.verifiedOnly);
      if (typeof parsed.instantOnly === "boolean") setInstantOnly(parsed.instantOnly);
      if (typeof parsed.showAdvancedFilters === "boolean") setShowAdvancedFilters(parsed.showAdvancedFilters);
    } catch {
      window.localStorage.removeItem(PEOPLE_PREFERENCES_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const payload = {
      search,
      activeTab,
      radiusKm,
      sortBy,
      minRating,
      maxResponseMinutes,
      minProfileCompletion,
      requireReviews,
      verifiedOnly,
      instantOnly,
      showAdvancedFilters,
    };

    window.localStorage.setItem(PEOPLE_PREFERENCES_STORAGE_KEY, JSON.stringify(payload));
  }, [
    activeTab,
    instantOnly,
    maxResponseMinutes,
    minProfileCompletion,
    minRating,
    radiusKm,
    requireReviews,
    search,
    showAdvancedFilters,
    sortBy,
    verifiedOnly,
  ]);

  useEffect(() => {
    if (!deepLinkContext || deepLinkApplied) return;

    if (deepLinkContext.query) {
      setSearch(deepLinkContext.query);
    }

    if (deepLinkContext.tab) {
      setActiveTab(deepLinkContext.tab);
    } else if (deepLinkContext.intent === "connections") {
      setActiveTab("Nearby");
    }

    setDeepLinkApplied(true);
  }, [deepLinkApplied, deepLinkContext]);

  const loadProviders = useCallback(async (soft = false) => {
    if (!soft) setLoading(true);
    if (soft) setSyncing(true);
    setErrorMessage("");

    try {
      const browserCoordinatesPromise = getBrowserCoordinates(GEO_LOOKUP_TIMEOUT_MS);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        setProviders(demoPeople);
        setUsingDemo(true);
        setConnectionRows([]);
        setErrorMessage(`Auth error: ${authError.message}`);
        return;
      }

      setCurrentUserId(user?.id || null);
      if (user) {
        await ensureClientProfile(user).catch(() => false);
      }

      let liveConnectionRows: ConnectionRequestRow[] = [];
      if (user?.id) {
        try {
          liveConnectionRows = await listCurrentUserConnectionRows(user.id);
        } catch (connectionError) {
          const message =
            connectionError instanceof Error ? connectionError.message : "Could not load connection requests.";
          console.warn("Unable to load connection requests:", message);
        }
      }
      setConnectionRows(liveConnectionRows);

      const normalizeProfileRows = (rows: FlexibleRow[]) => {
        const byId = new Map<string, ProfileRow>();

        rows.forEach((row) => {
          const profileId = stringFromRow(row, ["id", "user_id"], "");
          if (!profileId || byId.has(profileId)) return;

          const servicesValue = row.services;
          const normalizedServices = Array.isArray(servicesValue)
            ? servicesValue.filter((item): item is string => typeof item === "string" && !!item.trim())
            : null;

          byId.set(profileId, {
            id: profileId,
            name: stringFromRow(row, ["name", "full_name", "display_name"], ""),
            avatar_url: stringFromRow(row, ["avatar_url", "avatar", "image_url"], ""),
            role: stringFromRow(row, ["role", "account_type"], ""),
            bio: stringFromRow(row, ["bio", "about"], ""),
            location: stringFromRow(row, ["location", "city"], ""),
            availability: stringFromRow(row, ["availability", "status"], ""),
            services: normalizedServices,
            email: stringFromRow(row, ["email"], ""),
            phone: stringFromRow(row, ["phone", "phone_number"], ""),
            website: stringFromRow(row, ["website", "site_url"], ""),
            latitude: (() => {
              const value = numberFromRow(row, ["latitude", "lat"], Number.NaN);
              return Number.isFinite(value) ? value : null;
            })(),
            longitude: (() => {
              const value = numberFromRow(row, ["longitude", "lng", "long"], Number.NaN);
              return Number.isFinite(value) ? value : null;
            })(),
          });
        });

        return Array.from(byId.values());
      };

      const peoplePayload = await fetchAuthedJson<CommunityPeopleResponse>(supabase, "/api/community/people");
      if (!peoplePayload.ok) {
        throw new Error(peoplePayload.message || "Could not load people.");
      }

      const serviceRowsRaw = (peoplePayload.services as unknown as FlexibleRow[] | null) || [];
      const productRowsRaw = (peoplePayload.products as unknown as FlexibleRow[] | null) || [];
      const postRowsRaw = (peoplePayload.posts as unknown as FlexibleRow[] | null) || [];
      const helpRequestRowsRaw = (peoplePayload.helpRequests as unknown as FlexibleRow[] | null) || [];

      const serviceRows: ServiceRow[] = serviceRowsRaw
        .map((row) => ({
          provider_id: stringFromRow(row, ["provider_id", "user_id", "created_by", "owner_id"], ""),
          category: stringFromRow(row, ["category", "service_category", "type"], ""),
          price: numberFromRow(row, ["price", "amount", "rate"], Number.NaN),
        }))
        .filter((row) => !!row.provider_id);

      const productRows: ProductRow[] = productRowsRaw
        .map((row) => ({
          provider_id: stringFromRow(row, ["provider_id", "user_id", "created_by", "owner_id"], ""),
          category: stringFromRow(row, ["category", "product_category", "type"], ""),
          price: numberFromRow(row, ["price", "amount", "mrp"], Number.NaN),
        }))
        .filter((row) => !!row.provider_id);

      const postRows: PostRow[] = postRowsRaw
        .filter((row) => {
          const status = stringFromRow(row, ["status", "state"], "");
          return !status || status.toLowerCase() === "open";
        })
        .map((row) => ({
          user_id: stringFromRow(
            row,
            ["user_id", "author_id", "created_by", "requester_id", "owner_id", "provider_id"],
            ""
          ),
          category: stringFromRow(row, ["category", "post_type", "type"], "Need"),
        }))
        .filter((row) => !!row.user_id);

      const helpRequestRows: HelpRequestRow[] = helpRequestRowsRaw
        .filter((row) => {
          const status = stringFromRow(row, ["status", "state"], "");
          return !["completed", "fulfilled", "closed", "cancelled", "canceled"].includes(status.toLowerCase());
        })
        .map((row) => ({
          requester_id: stringFromRow(row, ["requester_id", "user_id", "created_by"], ""),
          category: stringFromRow(row, ["category"], "Need"),
          budget: Math.max(
            numberFromRow(row, ["budget_max"], 0),
            numberFromRow(row, ["budget_min", "budget"], 0)
          ),
        }))
        .filter((row) => !!row.requester_id);

      const activeMemberIds = Array.from(
        new Set(
          [
            ...serviceRows.map((row) => row.provider_id),
            ...productRows.map((row) => row.provider_id),
            ...postRows.map((row) => row.user_id),
            ...helpRequestRows.map((row) => row.requester_id),
          ].filter((id): id is string => Boolean(id))
        )
      );

      const serviceCountMap = new Map<string, number>();
      const productCountMap = new Map<string, number>();
      const demandCountMap = new Map<string, number>();
      const serviceTagMap = new Map<string, Set<string>>();
      const productTagMap = new Map<string, Set<string>>();
      const demandTagMap = new Map<string, Set<string>>();
      const combinedTagMap = new Map<string, Set<string>>();
      const ratingMap = new Map<string, { sum: number; count: number }>();
      const providerPriceMap = new Map<string, number[]>();

      serviceRows.forEach((row) => {
        serviceCountMap.set(row.provider_id, (serviceCountMap.get(row.provider_id) || 0) + 1);
        if (!serviceTagMap.has(row.provider_id)) serviceTagMap.set(row.provider_id, new Set());
        if (!combinedTagMap.has(row.provider_id)) combinedTagMap.set(row.provider_id, new Set());
        if (row.category) {
          serviceTagMap.get(row.provider_id)?.add(row.category);
          combinedTagMap.get(row.provider_id)?.add(row.category);
        }
        if (Number.isFinite(Number(row.price))) {
          const existing = providerPriceMap.get(row.provider_id) || [];
          providerPriceMap.set(row.provider_id, [...existing, Number(row.price)]);
        }
      });

      productRows.forEach((row) => {
        productCountMap.set(row.provider_id, (productCountMap.get(row.provider_id) || 0) + 1);
        if (!productTagMap.has(row.provider_id)) productTagMap.set(row.provider_id, new Set());
        if (!combinedTagMap.has(row.provider_id)) combinedTagMap.set(row.provider_id, new Set());
        if (row.category) {
          productTagMap.get(row.provider_id)?.add(row.category);
          combinedTagMap.get(row.provider_id)?.add(row.category);
        }
        if (Number.isFinite(Number(row.price))) {
          const existing = providerPriceMap.get(row.provider_id) || [];
          providerPriceMap.set(row.provider_id, [...existing, Number(row.price)]);
        }
      });

      postRows.forEach((row) => {
        demandCountMap.set(row.user_id, (demandCountMap.get(row.user_id) || 0) + 1);
        if (!demandTagMap.has(row.user_id)) demandTagMap.set(row.user_id, new Set());
        if (!combinedTagMap.has(row.user_id)) combinedTagMap.set(row.user_id, new Set());
        if (row.category) {
          demandTagMap.get(row.user_id)?.add(row.category);
          combinedTagMap.get(row.user_id)?.add(row.category);
        }
      });

      helpRequestRows.forEach((row) => {
        demandCountMap.set(row.requester_id, (demandCountMap.get(row.requester_id) || 0) + 1);
        if (!demandTagMap.has(row.requester_id)) demandTagMap.set(row.requester_id, new Set());
        if (!combinedTagMap.has(row.requester_id)) combinedTagMap.set(row.requester_id, new Set());
        if (row.category) {
          demandTagMap.get(row.requester_id)?.add(row.category);
          combinedTagMap.get(row.requester_id)?.add(row.category);
        }
        if (row.budget > 0) {
          const existing = providerPriceMap.get(row.requester_id) || [];
          providerPriceMap.set(row.requester_id, [...existing, row.budget]);
        }
      });

      const normalizedProfileRows = normalizeProfileRows(
        (((peoplePayload.profiles as unknown as FlexibleRow[] | null) || []).slice(0, MAX_DISCOVERABLE_PROFILES)) as FlexibleRow[]
      );
      const existingProfileIds = new Set(normalizedProfileRows.map((profile) => profile.id));
      const fallbackProfiles = activeMemberIds
        .filter((memberId) => memberId !== user?.id && !existingProfileIds.has(memberId))
        .map((memberId) =>
          buildFallbackMemberProfile({
            memberId,
            serviceCount: serviceCountMap.get(memberId) || 0,
            productCount: productCountMap.get(memberId) || 0,
            demandCount: demandCountMap.get(memberId) || 0,
            tags: Array.from(combinedTagMap.get(memberId) || []),
          })
        );

      const profileRows = [...normalizedProfileRows, ...fallbackProfiles];
      const currentUserProfile = profileRows.find((profile) => profile.id === user?.id) || null;
      const profileCoordinates = currentUserProfile
        ? resolveCoordinates({
            row: currentUserProfile as unknown as Record<string, unknown>,
            location: currentUserProfile.location,
            seed: currentUserProfile.id,
          })
        : null;
      const browserCoordinates = await browserCoordinatesPromise;
      const effectiveViewerCoordinates = browserCoordinates || profileCoordinates || defaultMarketCoordinates();

      const memberIds = Array.from(
        new Set(
          [
            ...profileRows.map((profile) => profile.id),
            ...activeMemberIds,
          ].filter((memberId) => !!memberId && memberId !== user?.id)
        )
      );

      const reviewRows = (((peoplePayload.reviews as ReviewRow[] | null) || []).filter((row) =>
        memberIds.includes(row.provider_id)
      ) || []) as ReviewRow[];
      const presenceRows = (((peoplePayload.presence as ProviderPresenceRow[] | null) || []).filter((row) =>
        memberIds.includes(row.provider_id)
      ) || []) as ProviderPresenceRow[];
      const providerOrderStatsRows = (((peoplePayload.orderStats as ProviderOrderStatsRow[] | null) || []).filter((row) =>
        memberIds.includes(row.provider_id)
      ) || []) as ProviderOrderStatsRow[];

      reviewRows.forEach((row) => {
        const previous = ratingMap.get(row.provider_id) || { sum: 0, count: 0 };
        ratingMap.set(row.provider_id, {
          sum: previous.sum + (row.rating || 0),
          count: previous.count + 1,
        });
      });

      const presenceMap = new Map(
        presenceRows.filter((row) => !!row.provider_id).map((row) => [row.provider_id, row])
      );

      const completedJobsMap = new Map<string, number>();
      const openLeadsMap = new Map<string, number>();

      providerOrderStatsRows.forEach((row) => {
        completedJobsMap.set(row.provider_id, Number(row.completed_jobs || 0));
        openLeadsMap.set(row.provider_id, Number(row.open_leads || 0));
      });

      const cards: ProviderCard[] = profileRows
        .filter((profile) => profile.id !== user?.id)
        .map((profile) => {
          const servicesCount = serviceCountMap.get(profile.id) || 0;
          const productsCount = productCountMap.get(profile.id) || 0;
          const demandsCount = demandCountMap.get(profile.id) || 0;
          const ratings = ratingMap.get(profile.id);
          const reviewCount = ratings?.count || 0;
          const avgRating = reviewCount > 0 ? Number((ratings!.sum / reviewCount).toFixed(1)) : 4.5;
          const presence = presenceMap.get(profile.id) || null;
          const providerCoordinates = resolveCoordinates({
            row: profile as unknown as Record<string, unknown>,
            location: profile.location,
            seed: profile.id,
          });
          const distanceKm = distanceBetweenCoordinatesKm(effectiveViewerCoordinates, providerCoordinates);
          const presenceAvailability = presence?.availability || profile.availability || "available";
          const presenceResponseMinutes = Number(
            presence?.rolling_response_minutes ?? presence?.response_sla_minutes ?? Number.NaN
          );
          const responseMinutes = Number.isFinite(presenceResponseMinutes)
            ? Math.max(1, Math.round(presenceResponseMinutes))
            : estimateResponseMinutes({
                availability: presenceAvailability,
                providerId: profile.id,
              });
          const profileCompletion = calculateProfileCompletion({
            name: profile.name,
            location: profile.location,
            bio: profile.bio,
            services: profile.services,
            email: profile.email,
            phone: profile.phone,
            website: profile.website,
          });
          const verificationStatus = calculateVerificationStatus({
            role: profile.role,
            profileCompletion,
            listingsCount: servicesCount + productsCount,
            averageRating: avgRating,
            reviewCount,
          });
          const rankBase = calculateLocalRankScore({
            distanceKm,
            responseMinutes,
            rating: avgRating,
            profileCompletion,
          });
          const online =
            typeof presence?.is_online === "boolean"
              ? presence.is_online
              : presenceAvailability.toLowerCase() !== "offline";
          const rankScore = Math.max(1, Math.min(100, rankBase + (online ? 4 : 0)));

          const prices = providerPriceMap.get(profile.id) || [];
          const startingPrice = prices.length
            ? Math.max(1, Math.min(...prices.map((value) => Math.floor(value))))
            : hashNumber(profile.id, 199, 1499);
          const profileServiceTags = Array.isArray(profile.services)
            ? profile.services.filter((tag): tag is string => typeof tag === "string" && !!tag.trim())
            : [];
          const serviceTags = Array.from(
            new Set([...Array.from(serviceTagMap.get(profile.id) || []), ...profileServiceTags])
          ).slice(0, 4);
          const productTags = Array.from(
            new Set([
              ...Array.from(productTagMap.get(profile.id) || []),
              ...Array.from(demandTagMap.get(profile.id) || []),
            ])
          ).slice(0, 4);
          const combinedTags = Array.from(
            new Set([
              ...Array.from(combinedTagMap.get(profile.id) || []),
              ...profileServiceTags,
              profile.role || "",
              profile.location || "",
              demandsCount > 0 && servicesCount + productsCount === 0 ? "Requests" : "",
            ])
          )
            .filter(Boolean)
            .slice(0, 6);
          const mediaGallery = buildProviderMediaGallery(profile.id, profile.role || "", [
            ...combinedTags,
            profile.role || "",
          ]);
          const defaultRole =
            servicesCount + productsCount > 0
              ? profile.role || "Service Provider"
              : profile.role || "Marketplace Member";
          const defaultBio =
            profile.bio ||
            (demandsCount > 0 && servicesCount + productsCount === 0
              ? "Active marketplace member posting local requests and collaborating with nearby providers."
              : servicesCount + productsCount > 0
              ? "Trusted neighborhood provider available for nearby requests and realtime chat."
              : "Visible to your local marketplace so nearby members can connect and start a chat.");
          const resolvedTags = combinedTags.length > 0 ? combinedTags : [defaultRole];

          return {
            id: profile.id,
            name: profile.name || "Local Member",
            businessSlug: createBusinessSlug(profile.name, profile.id),
            avatar: profile.avatar_url || `https://i.pravatar.cc/200?u=${profile.id}`,
            coverImage: mediaGallery[0],
            mediaGallery,
            role: defaultRole,
            bio: defaultBio,
            location: profile.location || "Nearby",
            email: profile.email || null,
            phone: profile.phone || null,
            website: profile.website || null,
            distanceKm,
            rating: avgRating,
            reviews: reviewCount,
            verified: verificationStatus === "verified",
            online,
            serviceCount: servicesCount,
            productCount: productsCount,
            demandCount: demandsCount,
            completedJobs: completedJobsMap.get(profile.id) ?? hashNumber(`done-${profile.id}`, 8, 140),
            openLeads: openLeadsMap.get(profile.id) ?? hashNumber(`open-${profile.id}`, 1, 6),
            responseMinutes,
            startingPrice,
            tags: resolvedTags,
            serviceTags,
            productTags,
            profileCompletion,
            rankScore,
            verificationStatus,
            latitude: providerCoordinates.latitude,
            longitude: providerCoordinates.longitude,
          };
        });

      if (cards.length === 0) {
        setProviders(demoPeople);
        setUsingDemo(true);
      } else {
        setProviders(cards);
        setUsingDemo(false);
      }

      setLastSyncedAt(new Date().toISOString());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch";
      console.warn("Unable to load providers:", message);
      setProviders(demoPeople);
      setUsingDemo(true);
      setConnectionRows([]);
      setErrorMessage(`Auth error: ${message}`);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  useEffect(() => {
    if (!deepLinkContext?.providerId || deepLinkProviderAppliedRef.current) return;
    if (!providers.some((provider) => provider.id === deepLinkContext.providerId)) return;

    setSelectedProvider(deepLinkContext.providerId);
    deepLinkProviderAppliedRef.current = true;
  }, [deepLinkContext?.providerId, providers]);

  useEffect(() => {
    if (!currentUserId) return;

    const presenceChannel = supabase.channel(GLOBAL_PRESENCE_CHANNEL, {
      config: {
        presence: {
          key: currentUserId,
        },
      },
    });
    presenceChannelRef.current = presenceChannel;

    const syncOnlineUsers = () => {
      setOnlineUserIds(extractPresenceUserIds(presenceChannel.presenceState()));
    };

    presenceChannel
      .on("presence", { event: "sync" }, syncOnlineUsers)
      .on("presence", { event: "join" }, syncOnlineUsers)
      .on("presence", { event: "leave" }, syncOnlineUsers)
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        await presenceChannel.track({
          user_id: currentUserId,
          page: "people",
          last_seen_at: new Date().toISOString(),
        });
      });

    const heartbeatTimer = window.setInterval(() => {
      void presenceChannel.track({
        user_id: currentUserId,
        page: "people",
        last_seen_at: new Date().toISOString(),
      });
    }, 30000);

    return () => {
      window.clearInterval(heartbeatTimer);
      if (presenceChannelRef.current) {
        void presenceChannelRef.current.untrack();
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
      setOnlineUserIds(new Set());
    };
  }, [currentUserId]);

  useEffect(() => {
    const scheduleReload = () => {
      if (reloadTimerRef.current) {
        window.clearTimeout(reloadTimerRef.current);
      }
      reloadTimerRef.current = window.setTimeout(() => {
        void loadProviders(true);
      }, 250);
    };

    const channel = supabase
      .channel("people-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "service_listings" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "product_catalog" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "help_requests" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "connection_requests" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "provider_presence" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, scheduleReload)
      .subscribe();

    return () => {
      if (reloadTimerRef.current) {
        window.clearTimeout(reloadTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [loadProviders]);

  useEffect(() => {
    if (!usingDemo || loading) return;

    const demoRealtimeTimer = window.setInterval(() => {
      const tick = Math.floor(Date.now() / 12000);
      setProviders((current) =>
        current.map((provider, index) => {
          if (!provider.id.startsWith("demo-")) return provider;
          const isOnline = (tick + index) % 3 !== 0;
          const leadDelta = (tick + index) % 4 === 0 ? 1 : (tick + index) % 5 === 0 ? -1 : 0;
          const responseDelta = isOnline ? -1 : 1;

          return {
            ...provider,
            online: isOnline,
            openLeads: Math.max(0, Math.min(18, provider.openLeads + leadDelta)),
            responseMinutes: Math.max(3, Math.min(40, provider.responseMinutes + responseDelta)),
            rankScore: Math.max(62, Math.min(99, provider.rankScore + (isOnline ? 1 : -1))),
          };
        })
      );
      setLastSyncedAt(new Date().toISOString());
    }, 12000);

    return () => {
      window.clearInterval(demoRealtimeTimer);
    };
  }, [loading, usingDemo]);

  const isProviderOnline = useCallback(
    (provider: ProviderCard) => onlineUserIds.has(provider.id) || provider.online,
    [onlineUserIds]
  );

  const filteredProviders = useMemo(() => {
    const query = search.toLowerCase().trim();
    const isWithinRadius = (person: ProviderCard) => person.distanceKm <= radiusKm;

    const filtered = providers
      .filter((person) => {
        if (!query) return true;
        return `${person.name} ${person.role} ${person.bio} ${person.location} ${person.tags.join(" ")}`
          .toLowerCase()
          .includes(query);
      })
      .filter((person) => person.rating >= minRating)
      .filter((person) => (maxResponseMinutes > 0 ? person.responseMinutes <= maxResponseMinutes : true))
      .filter((person) => person.profileCompletion >= minProfileCompletion)
      .filter((person) => (requireReviews ? person.reviews > 0 : true))
      .filter((person) => (verifiedOnly ? person.verified : true))
      .filter((person) => (instantOnly ? isProviderOnline(person) && person.responseMinutes <= FAST_RESPONSE_THRESHOLD_MINUTES : true))
      .filter((person) => {
        if (activeTab === "All") return true;
        if (activeTab === "Nearby") return isWithinRadius(person);
        if (activeTab === "Active Now") return isProviderOnline(person);
        if (activeTab === "Verified") return person.verified;
        return true;
      });

    if (sortBy === "Best Match") {
      filtered.sort((a, b) => b.rankScore - a.rankScore || a.distanceKm - b.distanceKm);
    } else if (sortBy === "Top Rated") {
      filtered.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === "Most Listings") {
      filtered.sort(
        (a, b) =>
          (b.serviceCount + b.productCount + (b.demandCount || 0)) -
          (a.serviceCount + a.productCount + (a.demandCount || 0))
      );
    } else if (sortBy === "Fast Response") {
      filtered.sort((a, b) => a.responseMinutes - b.responseMinutes);
    } else {
      filtered.sort((a, b) => a.distanceKm - b.distanceKm);
    }

    return filtered;
  }, [
    activeTab,
    instantOnly,
    isProviderOnline,
    maxResponseMinutes,
    minProfileCompletion,
    minRating,
    providers,
    radiusKm,
    requireReviews,
    search,
    sortBy,
    verifiedOnly,
  ]);

  const hasMoreProviders = visibleCount < filteredProviders.length;
  const visibleProviders = useMemo(
    () => filteredProviders.slice(0, Math.max(PROVIDERS_BATCH_SIZE, visibleCount)),
    [filteredProviders, visibleCount]
  );

  useEffect(() => {
    if (loadMoreTimerRef.current) {
      window.clearTimeout(loadMoreTimerRef.current);
      loadMoreTimerRef.current = null;
    }
    setVisibleCount(Math.min(PROVIDERS_BATCH_SIZE, filteredProviders.length));
    setLoadingMore(false);
  }, [filteredProviders.length]);

  useEffect(() => {
    return () => {
      if (loadMoreTimerRef.current) {
        window.clearTimeout(loadMoreTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (loading || !hasMoreProviders || !infiniteSentinelRef.current) return;

    const sentinel = infiniteSentinelRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || loadingMore || !hasMoreProviders) return;

        setLoadingMore(true);
        if (loadMoreTimerRef.current) {
          window.clearTimeout(loadMoreTimerRef.current);
        }
        loadMoreTimerRef.current = window.setTimeout(() => {
          setVisibleCount((current) => Math.min(current + PROVIDERS_BATCH_SIZE, filteredProviders.length));
          setLoadingMore(false);
          loadMoreTimerRef.current = null;
        }, 260);
      },
      {
        rootMargin: "260px 0px",
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filteredProviders.length, hasMoreProviders, loading, loadingMore]);

  const resolveDemoChatRecipientId = useCallback(async (providerId: string, viewerId: string) => {
    const pickCandidate = (rows: ProfileRow[] | null | undefined) => {
      const candidates = (rows || []).filter((row) => !!row?.id && row.id !== viewerId);
      if (!candidates.length) return null;
      return candidates[hashNumber(providerId, 0, candidates.length - 1)]?.id || null;
    };

    const { data: preferredRows, error: preferredError } = await supabase
      .from("profiles")
      .select("id,name")
      .in("name", [...DEMO_CHAT_PREFERRED_NAMES])
      .neq("id", viewerId)
      .limit(12);

    if (!preferredError) {
      const target = pickCandidate((preferredRows as ProfileRow[] | null) || []);
      if (target) return target;
    }

    const { data: fallbackRows, error: fallbackError } = await supabase
      .from("profiles")
      .select("id,name")
      .neq("id", viewerId)
      .limit(20);

    if (fallbackError) {
      throw new Error(`Could not load chat recipients: ${fallbackError.message}`);
    }

    return pickCandidate((fallbackRows as ProfileRow[] | null) || []);
  }, []);

  const ensureViewerId = useCallback(async () => {
    if (currentUserId) return currentUserId;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error(authError?.message || "Login required");
    }

    setCurrentUserId(user.id);
    return user.id;
  }, [currentUserId]);

  const refreshConnectionRows = useCallback(
    async (viewerIdOverride?: string | null) => {
      const viewerId = viewerIdOverride || currentUserId;
      if (!viewerId) return [];

      const nextRows = await listCurrentUserConnectionRows(viewerId);
      setConnectionRows(nextRows);
      return nextRows;
    },
    [currentUserId]
  );

  const handleConnect = useCallback(
    async (targetUserId: string) => {
      setBusyConnectionTargetId(targetUserId);
      setConnectionNotice(null);

      try {
        const viewerId = await ensureViewerId();
        if (viewerId === targetUserId) {
          throw new Error("This is your own profile.");
        }

        const previousState = deriveConnectionState(viewerId, targetUserId, connectionRows);
        await sendConnectionRequest(targetUserId);
        await refreshConnectionRows(viewerId);

        setConnectionNotice({
          kind: "success",
          message:
            previousState.kind === "incoming_pending"
              ? "Connection accepted. You can now coordinate directly."
              : "Connection request sent.",
        });
      } catch (error) {
        setConnectionNotice({
          kind: "error",
          message: error instanceof Error ? error.message : "Unable to send connection request.",
        });
      } finally {
        setBusyConnectionTargetId(null);
      }
    },
    [connectionRows, ensureViewerId, refreshConnectionRows]
  );

  const handleConnectionDecision = useCallback(
    async (requestId: string, decision: "accepted" | "rejected" | "cancelled") => {
      setBusyConnectionRequestId(requestId);
      setConnectionNotice(null);

      try {
        await respondToConnectionRequest({ requestId, decision });
        const viewerId = await ensureViewerId();
        await refreshConnectionRows(viewerId);
        setConnectionNotice({
          kind: "success",
          message:
            decision === "accepted"
              ? "Connection accepted."
              : decision === "rejected"
              ? "Connection request declined."
              : "Connection request cancelled.",
        });
      } catch (error) {
        setConnectionNotice({
          kind: "error",
          message: error instanceof Error ? error.message : "Unable to update connection request.",
        });
      } finally {
        setBusyConnectionRequestId(null);
      }
    },
    [ensureViewerId, refreshConnectionRows]
  );

  const resolveChatRecipientId = useCallback(
    async (providerId: string, viewerId: string) => {
      if (!providerId.startsWith("demo-")) return providerId;
      return resolveDemoChatRecipientId(providerId, viewerId);
    },
    [resolveDemoChatRecipientId]
  );

  const ensureConnectedMember = useCallback(
    async (providerId: string, intent: "chat" | "live_talk") => {
      const viewerId = await ensureViewerId();
      if (providerId === viewerId) {
        throw new Error("This is your own profile.");
      }

      const connectionState = deriveConnectionState(viewerId, providerId, connectionRows);
      if (connectionState.kind === "accepted") {
        return viewerId;
      }

      throw new Error(
        intent === "live_talk"
          ? "Connect with this member first to start Live Talk."
          : "Connect with this member first to open chat."
      );
    },
    [connectionRows, ensureViewerId]
  );

  const openChatThread = async (providerId: string, options?: { startLiveTalk?: boolean }) => {
    setLoadingChatId(providerId);

    try {
      const viewerId = await ensureConnectedMember(providerId, options?.startLiveTalk ? "live_talk" : "chat");

      let conversationId = inlineConversationByProvider[providerId] || null;
      if (!conversationId) {
        const recipientId = await resolveChatRecipientId(providerId, viewerId);
        if (!recipientId) {
          alert("No chat recipient is available for this card yet.");
          return;
        }
        conversationId = await getOrCreateDirectConversationId(supabase, viewerId, recipientId);
      }

      if (!conversationId) {
        throw new Error("Unable to resolve conversation");
      }

      setInlineConversationByProvider((previous) => ({ ...previous, [providerId]: conversationId }));
      const params = new URLSearchParams({ open: conversationId });
      if (options?.startLiveTalk) {
        params.set("liveTalk", "1");
      }
      router.push(`/dashboard/chat?${params.toString()}`);
    } catch (error) {
      setConnectionNotice({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to open chat.",
      });
    } finally {
      setLoadingChatId(null);
    }
  };

  const sendInlineMessage = async (provider: ProviderCard) => {
    const draft = (inlineMessageDrafts[provider.id] || "").trim();
    if (!draft) {
      setInlineMessageStatusByProvider((previous) => ({
        ...previous,
        [provider.id]: "Type a message before sending.",
      }));
      return;
    }

    setInlineSendingProviderId(provider.id);
    setInlineMessageStatusByProvider((previous) => ({ ...previous, [provider.id]: "" }));

    try {
      const viewerId = await ensureConnectedMember(provider.id, "chat");

      const recipientId = await resolveChatRecipientId(provider.id, viewerId);
      if (!recipientId) {
        setInlineMessageStatusByProvider((previous) => ({
          ...previous,
          [provider.id]: "No chat recipient is available for this profile yet.",
        }));
        return;
      }

      const { conversationId } = await sendDirectMessage(supabase, {
        viewerId,
        recipientId,
        content: draft,
      });

      setInlineConversationByProvider((previous) => ({ ...previous, [provider.id]: conversationId }));
      setInlineMessageDrafts((previous) => ({ ...previous, [provider.id]: "" }));
      setInlineMessageStatusByProvider((previous) => ({
        ...previous,
        [provider.id]: "Message sent. It is saved in Chat tab.",
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send message";
      setInlineMessageStatusByProvider((previous) => ({
        ...previous,
        [provider.id]: `Unable to send. ${message}`,
      }));
    } finally {
      setInlineSendingProviderId(null);
    }
  };

  const peopleNearby = providers.filter((provider) => provider.distanceKm <= 5).length;
  const activeNow = providers.filter((provider) => isProviderOnline(provider)).length;
  const fastResponders = providers.filter(
    (provider) => provider.responseMinutes <= FAST_RESPONSE_THRESHOLD_MINUTES
  ).length;
  const totalOpenLeads = providers.reduce((sum, provider) => sum + provider.openLeads, 0);
  const activeCoverage = providers.length ? Math.round((activeNow / providers.length) * 100) : 0;
  const verifiedLiveCount = providers.filter((provider) => provider.verified && isProviderOnline(provider)).length;
  const avgRating = providers.length
    ? (providers.reduce((sum, provider) => sum + provider.rating, 0) / providers.length).toFixed(1)
    : "0.0";
  const networkPulseLabel =
    activeCoverage >= 65 ? "High network activity" : activeCoverage >= 35 ? "Moderate network activity" : "Low network activity";
  const activeFilterCount =
    Number(minRating > 0) +
    Number(maxResponseMinutes > 0) +
    Number(minProfileCompletion > 0) +
    Number(requireReviews) +
    Number(verifiedOnly) +
    Number(instantOnly);

  const clearAdvancedFilters = () => {
    setMinRating(0);
    setMaxResponseMinutes(0);
    setMinProfileCompletion(0);
    setRequireReviews(false);
    setVerifiedOnly(false);
    setInstantOnly(false);
  };
  const resetAllFilters = () => {
    setSearch("");
    setActiveTab("All");
    setRadiusKm(DEFAULT_RADIUS_KM);
    setSortBy("Best Match");
    setShowAdvancedFilters(false);
    clearAdvancedFilters();
  };
  const scrollToSection = useCallback((ref: { current: HTMLElement | null }) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  const featuredProviders = [...filteredProviders].sort((a, b) => b.rankScore - a.rankScore).slice(0, 3);
  const liveProviders = filteredProviders.filter((provider) => isProviderOnline(provider)).slice(0, 8);
  const providerNameById = useMemo(
    () => new Map(providers.map((provider) => [provider.id, provider.name])),
    [providers]
  );
  const connectionStateByUserId = useMemo(
    () => createConnectionStateMap(currentUserId, connectionRows),
    [connectionRows, currentUserId]
  );
  const connectionBuckets = useMemo(
    () => createConnectionBuckets(currentUserId, connectionRows),
    [connectionRows, currentUserId]
  );

  return (
    <div className="w-full max-w-550 mx-auto space-y-5 sm:space-y-6 lg:space-y-7">
      <motion.section
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[1.3rem] border border-cyan-300/35 bg-linear-to-br from-slate-950 via-indigo-900 to-cyan-700 p-3 shadow-[0_20px_46px_-30px_rgba(14,116,144,0.75)] sm:p-4"
      >
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px)",
              backgroundSize: "30px 30px",
            }}
          />
          <div className="absolute inset-0 bg-linear-to-r from-slate-950/58 via-indigo-900/38 to-cyan-900/48" />
          <motion.div
            className="absolute -right-5 top-2 h-24 w-24 rounded-full bg-cyan-300/25 blur-3xl"
            animate={{ x: [0, -10, 0], y: [0, 8, 0] }}
            transition={{ duration: 6.6, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute left-6 bottom-0 h-20 w-20 rounded-full bg-indigo-300/20 blur-2xl"
            animate={{ x: [0, 10, 0], y: [0, -6, 0] }}
            transition={{ duration: 6.9, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        <div className="relative space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-white">People Network</p>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/14 px-2 py-0.5 text-[11px] font-medium text-cyan-50">
              {syncing ? <Loader2 size={12} className="animate-spin" /> : <Activity size={12} />}
              {syncing ? "Syncing live network..." : networkPulseLabel}
            </span>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-end">
            <div className="space-y-3">
              <div>
                <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-[34px]">
                  Discover trusted local providers and act on live availability.
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-cyan-50/88 sm:text-base">
                  Browse nearby people, filter the strongest matches, and move into connections or active providers
                  without leaving the dashboard.
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void loadProviders(true)}
                  disabled={syncing}
                  className="group rounded-xl border border-white/35 bg-white/16 px-3 py-2.5 text-left text-white backdrop-blur transition hover:bg-white/24 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/20 ring-1 ring-white/30">
                      <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
                    </span>
                    <p className="text-base font-semibold">Refresh Network</p>
                  </div>
                  <p className="mt-1 text-xs text-cyan-50/90">Pull the latest presence and ranking data.</p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("Active Now");
                    scrollToSection(resultsSectionRef);
                  }}
                  className="group rounded-xl border border-white/35 bg-white/16 px-3 py-2.5 text-left text-white backdrop-blur transition hover:bg-white/24"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/20 ring-1 ring-white/30">
                      <Users size={14} />
                    </span>
                    <p className="text-base font-semibold">Open Live Matches</p>
                  </div>
                  <p className="mt-1 text-xs text-cyan-50/90">Jump to providers who are available right now.</p>
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full border border-white/22 bg-white/12 px-2 py-0.5 text-[11px] font-medium text-white/95">
                  {providers.length} providers indexed
                </span>
                <span className="rounded-full border border-white/22 bg-white/12 px-2 py-0.5 text-[11px] font-medium text-white/95">
                  {activeNow} active now
                </span>
                <span className="rounded-full border border-white/22 bg-white/12 px-2 py-0.5 text-[11px] font-medium text-white/95">
                  {verifiedLiveCount} verified live
                </span>
                <span className="rounded-full border border-white/22 bg-white/12 px-2 py-0.5 text-[11px] font-medium text-white/95">
                  {avgRating} avg rating
                </span>
                <span className="rounded-full border border-white/22 bg-white/12 px-2 py-0.5 text-[11px] font-medium text-white/95">
                  {fastResponders} fast responders
                </span>
                <span className="rounded-full border border-white/22 bg-white/12 px-2 py-0.5 text-[11px] font-medium text-white/95">
                  {filteredProviders.length} matches
                </span>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-white/20 bg-white/12 p-3 text-white backdrop-blur">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Nearby</div>
                <div className="mt-1 text-2xl font-bold">{peopleNearby}</div>
                <div className="text-[11px] text-white/70">within {radiusKm} km</div>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/12 p-3 text-white backdrop-blur">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Coverage</div>
                <div className="mt-1 text-2xl font-bold">{activeCoverage}%</div>
                <div className="text-[11px] text-white/70">active network</div>
              </div>
              <button
                type="button"
                onClick={() =>
                  currentUserId && !usingDemo ? scrollToSection(connectionsSectionRef) : router.push("/dashboard/tasks")
                }
                className="rounded-xl border border-white/20 bg-white/12 p-3 text-left text-white backdrop-blur transition hover:bg-white/18"
              >
                <div className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Connections</div>
                <div className="mt-1 text-lg font-bold">
                  {currentUserId && !usingDemo ? connectionBuckets.accepted.length : totalOpenLeads}
                </div>
                <div className="text-[11px] text-white/70">
                  {currentUserId && !usingDemo ? "open connection hub" : "go to tasks"}
                </div>
              </button>
              <div className="rounded-xl border border-white/20 bg-white/12 p-3 text-white backdrop-blur">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Last sync</div>
                <div className="mt-1 text-lg font-bold">{lastSyncedAt ? formatSyncTime(lastSyncedAt) : "--"}</div>
                <div className="text-[11px] text-white/70">{sortBy}</div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {!!errorMessage && !usingDemo && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>
      )}

      {usingDemo && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Showing demo people because no live marketplace profiles were found in DB yet.
        </div>
      )}

      {currentUserId && !usingDemo && (
        <section ref={connectionsSectionRef} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Connections</h2>
              <p className="mt-1 text-sm text-slate-600">
                Real connection requests, accepted contacts, and network introductions for early testers.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs sm:min-w-[280px]">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                <p className="font-semibold text-emerald-700">Incoming</p>
                <p className="mt-1 text-lg font-bold text-emerald-900">{connectionBuckets.incoming.length}</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="font-semibold text-amber-700">Pending</p>
                <p className="mt-1 text-lg font-bold text-amber-900">{connectionBuckets.outgoing.length}</p>
              </div>
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2">
                <p className="font-semibold text-indigo-700">Connected</p>
                <p className="mt-1 text-lg font-bold text-indigo-900">{connectionBuckets.accepted.length}</p>
              </div>
            </div>
          </div>

          {connectionNotice && (
            <div
              className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                connectionNotice.kind === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {connectionNotice.message}
            </div>
          )}

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <UserPlus size={16} className="text-emerald-600" />
                Incoming requests
              </div>
              <div className="mt-3 space-y-2">
                {connectionBuckets.incoming.length === 0 && (
                  <p className="text-sm text-slate-500">No pending requests right now.</p>
                )}
                {connectionBuckets.incoming.slice(0, 4).map((entry) => {
                  const isBusy = busyConnectionRequestId === entry.requestId;
                  return (
                    <div key={entry.requestId} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {providerNameById.get(entry.userId) || "Local member"}
                          </p>
                          <p className="text-xs text-slate-500">Wants to connect with you.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedProvider(entry.userId)}
                          className="text-xs font-semibold text-indigo-700 hover:text-indigo-800"
                        >
                          View
                        </button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleConnectionDecision(entry.requestId, "accepted")}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-70"
                        >
                          <Check size={13} />
                          Accept
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleConnectionDecision(entry.requestId, "rejected")}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-70"
                        >
                          <XCircle size={13} />
                          Decline
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Activity size={16} className="text-amber-600" />
                Sent by you
              </div>
              <div className="mt-3 space-y-2">
                {connectionBuckets.outgoing.length === 0 && (
                  <p className="text-sm text-slate-500">No outgoing requests in flight.</p>
                )}
                {connectionBuckets.outgoing.slice(0, 4).map((entry) => {
                  const isBusy = busyConnectionRequestId === entry.requestId;
                  return (
                    <div key={entry.requestId} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {providerNameById.get(entry.userId) || "Local member"}
                          </p>
                          <p className="text-xs text-slate-500">Awaiting their response.</p>
                        </div>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleConnectionDecision(entry.requestId, "cancelled")}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-70"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <UserCheck size={16} className="text-indigo-600" />
                Accepted connections
              </div>
              <div className="mt-3 space-y-2">
                {connectionBuckets.accepted.length === 0 && (
                  <p className="text-sm text-slate-500">Accepted connections will appear here.</p>
                )}
                {connectionBuckets.accepted.slice(0, 4).map((entry) => (
                  <div key={entry.requestId} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {providerNameById.get(entry.userId) || "Connected member"}
                        </p>
                        <p className="text-xs text-slate-500">Ready for direct chat and coordination.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedProvider(entry.userId)}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          Profile
                        </button>
                        <button
                          type="button"
                          onClick={() => void openChatThread(entry.userId)}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
                        >
                          <MessageCircle size={13} />
                          Chat
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <section ref={resultsSectionRef} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100">
            <Search size={16} className="text-slate-500" />
            <input
              type="text"
              placeholder="Search by name, skill, bio, location..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full bg-transparent outline-none placeholder:text-slate-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <select
              value={String(radiusKm)}
              onChange={(event) => setRadiusKm(Number(event.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none"
            >
              {RADIUS_OPTIONS.map((radius) => (
                <option key={radius} value={radius}>
                  {radius} km
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as (typeof SORT_OPTIONS)[number])}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setShowAdvancedFilters((current) => !current)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-100"
            >
              <SlidersHorizontal size={15} />
              Filters
              {activeFilterCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1 text-[11px] font-semibold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
            <Filter size={12} />
            {filteredProviders.length} matches
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
            <Users size={12} />
            feed {visibleProviders.length}/{filteredProviders.length}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
            <Gauge size={12} />
            sorted by {sortBy}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
            <Target size={12} />
            {activeTab}
          </span>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearAdvancedFilters}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-700 transition hover:bg-slate-100"
            >
              <RotateCcw size={12} />
              clear advanced
            </button>
          )}
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                activeTab === tab
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {showAdvancedFilters && (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs text-slate-600">
                Minimum rating
                <select
                  value={String(minRating)}
                  onChange={(event) => setMinRating(Number(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  <option value="0">Any rating</option>
                  <option value="4">4.0+</option>
                  <option value="4.5">4.5+</option>
                  <option value="4.8">4.8+</option>
                </select>
              </label>

              <label className="text-xs text-slate-600">
                Max response time
                <select
                  value={String(maxResponseMinutes)}
                  onChange={(event) => setMaxResponseMinutes(Number(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  <option value="0">Any response time</option>
                  <option value="15">15 min or less</option>
                  <option value="30">30 min or less</option>
                  <option value="60">60 min or less</option>
                </select>
              </label>

              <label className="text-xs text-slate-600">
                Minimum profile completion
                <div className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={10}
                    value={minProfileCompletion}
                    onChange={(event) => setMinProfileCompletion(Number(event.target.value))}
                    className="w-full accent-indigo-600"
                  />
                  <div className="mt-1 text-[11px] text-slate-500">At least {minProfileCompletion}% complete</div>
                </div>
              </label>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={() => setRequireReviews((value) => !value)}
                className={`rounded-full border px-3 py-1.5 transition ${
                  requireReviews
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                {requireReviews ? "Reviews required" : "Allow unrated"}
              </button>
              <button
                type="button"
                onClick={() => setVerifiedOnly((value) => !value)}
                className={`rounded-full border px-3 py-1.5 transition ${
                  verifiedOnly
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck size={12} />
                  Verified only
                </span>
              </button>
              <button
                type="button"
                onClick={() => setInstantOnly((value) => !value)}
                className={`rounded-full border px-3 py-1.5 transition ${
                  instantOnly
                    ? "border-violet-200 bg-violet-50 text-violet-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  <Zap size={12} />
                  Online + fast response
                </span>
              </button>
            </div>
          </div>
        )}
      </section>

      {!!featuredProviders.length && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 sm:text-base">Top matches right now</h2>
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Sparkles size={12} />
              Ranked by local score
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {featuredProviders.map((person) => {
              const isOnline = isProviderOnline(person);
              return (
                <button
                  key={`featured-${person.id}`}
                  onClick={() => setSelectedProvider(person.id)}
                  className="relative overflow-hidden rounded-xl border border-slate-200 text-left transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <Image
                    src={person.coverImage}
                    alt={person.name}
                    width={900}
                    height={420}
                    className="h-32 w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-slate-950/85 via-slate-900/25 to-transparent" />
                  <div className="absolute bottom-0 w-full p-3 text-white">
                    <p className="truncate text-sm font-semibold">{person.name}</p>
                    <p className="truncate text-xs text-white/80">{person.role}</p>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-white/85">
                      <span>Match {person.rankScore}</span>
                      <span>•</span>
                      <span>{person.distanceKm} km</span>
                      {isOnline && <span className="text-emerald-300">• live</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {!!liveProviders.length && (
        <section className="rounded-2xl border border-emerald-100 bg-linear-to-r from-emerald-50 to-cyan-50 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
              Live providers now
            </p>
            <span className="text-xs text-slate-600">{liveProviders.length} active in current filters</span>
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {liveProviders.map((provider) => (
              <button
                key={`live-${provider.id}`}
                type="button"
                onClick={() => setSelectedProvider(provider.id)}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-emerald-200 bg-white px-2.5 py-1.5 text-left text-xs text-slate-700 transition hover:bg-emerald-50"
              >
                <Image
                  src={provider.avatar}
                  alt={provider.name}
                  width={24}
                  height={24}
                  className="h-6 w-6 rounded-full object-cover"
                />
                <span className="font-medium">{provider.name}</span>
                <span className="text-[11px] text-slate-500">{provider.responseMinutes}m</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((idx) => (
            <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
              <div className="mt-3 h-5 w-1/3 animate-pulse rounded bg-slate-200" />
              <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
          <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading nearby providers...
          </div>
        </div>
      ) : (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {visibleProviders.map((person) => {
            const isOnline = isProviderOnline(person);
            const matchReasons = describeMatchReason(person, isOnline);
            const websiteHref = normalizeWebsiteUrl(person.website);
            const phoneHref = normalizePhoneForHref(person.phone);
            const isInlineComposerOpen = inlineComposerProviderId === person.id;
            const inlineDraft = inlineMessageDrafts[person.id] || "";
            const inlineStatus = inlineMessageStatusByProvider[person.id] || "";
            const savedConversationId = inlineConversationByProvider[person.id] || null;
            const connectionState = connectionStateByUserId.get(person.id) || {
              kind: "none" as const,
              requestId: null,
              updatedAt: null,
              row: null,
            };
            const isDemoProfile = person.id.startsWith("demo-");
            const connectionBusy =
              busyConnectionTargetId === person.id ||
              (connectionState.requestId ? busyConnectionRequestId === connectionState.requestId : false);
            const canUseRealtimeActions = !isDemoProfile && connectionState.kind === "accepted";
            const listingCount = person.serviceCount + person.productCount;
            const demandCount = person.demandCount || 0;
            const activityCount = listingCount + demandCount;
            const primaryCountLabel = listingCount > 0 ? "listings" : "requests";
            const primaryCountValue = listingCount > 0 ? listingCount : demandCount;
            const openLeadsLabel = listingCount > 0 ? "open leads" : "active asks";
            const openLeadsValue = listingCount > 0 ? person.openLeads : demandCount;
            const activityHeading = listingCount > 0 ? "Available listings" : "Recent request themes";
            const activityTags = [...person.serviceTags, ...person.productTags].slice(0, 6);
            return (
              <article
                key={person.id}
                className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="relative">
                  <Image
                    src={person.coverImage}
                    alt={`${person.name} cover`}
                    width={900}
                    height={420}
                    className="h-32 w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-slate-950/65 via-transparent to-transparent" />
                  <span className="absolute right-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-white">
                    {person.distanceKm} km away
                  </span>
                </div>

                <div className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <button onClick={() => setSelectedProvider(person.id)} className="shrink-0">
                      <Image
                        src={person.avatar}
                        alt={person.name}
                        width={56}
                        height={56}
                        className="h-14 w-14 rounded-xl border border-slate-200 object-cover"
                      />
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-slate-900">{person.name}</h3>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            person.verificationStatus === "verified"
                              ? "bg-emerald-100 text-emerald-700"
                              : person.verificationStatus === "pending"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          <BadgeCheck size={11} />
                          {person.verificationStatus === "verified"
                            ? "Verified"
                            : person.verificationStatus === "pending"
                            ? "Pending"
                            : "Unclaimed"}
                        </span>
                        {isOnline && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Live</span>}
                      </div>
                      <p className="text-sm text-slate-500">{person.role}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">{person.bio}</p>
                    </div>
                  </div>

                  {person.mediaGallery.length > 1 && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {person.mediaGallery.slice(1, 3).map((imageUrl, index) => (
                        <Image
                          key={`${person.id}-gallery-${index}`}
                          src={imageUrl}
                          alt={`${person.name} preview ${index + 1}`}
                          width={500}
                          height={280}
                          className="h-20 w-full rounded-lg object-cover"
                        />
                      ))}
                    </div>
                  )}

                  <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-4">
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={12} />
                      {person.location}
                    </span>
                    <span>{primaryCountValue} {primaryCountLabel}</span>
                    <span>{openLeadsValue} {openLeadsLabel}</span>
                    <span>{person.completedJobs} jobs done</span>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 size={12} />
                        response {person.responseMinutes} min
                      </span>
                      <span>profile {person.profileCompletion}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-linear-to-r from-indigo-500 via-violet-500 to-fuchsia-500"
                        style={{ width: `${Math.max(8, Math.min(100, person.profileCompletion))}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">from INR {person.startingPrice}</span>
                    <span className="rounded-full bg-indigo-100 px-2 py-1 text-indigo-700">Match {person.rankScore}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-amber-700">
                      <Star size={11} className="fill-amber-500 text-amber-500" />
                      {person.rating} ({person.reviews})
                    </span>
                  </div>

                  {!!matchReasons.length && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {matchReasons.map((reason) => (
                        <span
                          key={`${person.id}-${reason}`}
                          className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-1 text-[11px] font-medium text-cyan-700"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{activityHeading}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {activityTags.slice(0, 6).map((tag) => (
                        <span
                          key={`${person.id}-activity-${tag}`}
                          className="rounded-full bg-indigo-100 px-2 py-1 text-[11px] font-medium text-indigo-700"
                        >
                          {tag}
                        </span>
                      ))}
                      {!activityTags.length && (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
                          {activityCount > 0 ? "General neighborhood support" : "No recent activity"}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {phoneHref && (
                      <a
                        href={phoneHref}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-slate-700 transition hover:bg-slate-100"
                      >
                        <Phone size={12} />
                        Call
                      </a>
                    )}
                    {person.email && (
                      <a
                        href={`mailto:${person.email}`}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-slate-700 transition hover:bg-slate-100"
                      >
                        <Mail size={12} />
                        Email
                      </a>
                    )}
                    {websiteHref && (
                      <a
                        href={websiteHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-slate-700 transition hover:bg-slate-100"
                      >
                        <ExternalLink size={12} />
                        Website
                      </a>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {isDemoProfile ? (
                      <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-600">
                        Demo preview
                      </span>
                    ) : connectionState.kind === "incoming_pending" && connectionState.requestId ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleConnectionDecision(connectionState.requestId!, "accepted")}
                          disabled={connectionBusy}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-70"
                        >
                          <Check size={14} />
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleConnectionDecision(connectionState.requestId!, "rejected")}
                          disabled={connectionBusy}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-70"
                        >
                          <XCircle size={14} />
                          Decline
                        </button>
                      </>
                    ) : connectionState.kind === "outgoing_pending" && connectionState.requestId ? (
                      <>
                        <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700">
                          <Activity size={14} />
                          Request sent
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleConnectionDecision(connectionState.requestId!, "cancelled")}
                          disabled={connectionBusy}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-70"
                        >
                          Cancel
                        </button>
                      </>
                    ) : connectionState.kind === "accepted" ? (
                      <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
                        <UserCheck size={14} />
                        Connected
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleConnect(person.id)}
                        disabled={connectionBusy}
                        className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-70"
                      >
                        <UserPlus size={14} />
                        {connectionState.kind === "rejected" || connectionState.kind === "cancelled" ? "Connect again" : "Connect"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (!canUseRealtimeActions) return;
                        setInlineComposerProviderId((current) => (current === person.id ? null : person.id));
                        setInlineMessageDrafts((previous) => {
                          if (previous[person.id]) return previous;
                          const quickContext = person.tags[0] || person.role;
                          return {
                            ...previous,
                            [person.id]: `Hi ${person.name}, I need help with ${quickContext}.`,
                          };
                        });
                        setInlineMessageStatusByProvider((previous) => ({ ...previous, [person.id]: "" }));
                      }}
                      disabled={!canUseRealtimeActions}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
                    >
                      <MessageCircle size={14} />
                      {canUseRealtimeActions ? (isInlineComposerOpen ? "Close Chat" : "Chat") : "Chat after connect"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void openChatThread(person.id, { startLiveTalk: true })}
                      disabled={!canUseRealtimeActions}
                      className="inline-flex items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                    >
                      <Zap size={14} />
                      Live Talk
                    </button>
                    <button
                      onClick={() => setSelectedProvider(person.id)}
                      className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
                    >
                      View Profile
                    </button>
                    {canUseRealtimeActions && (savedConversationId || loadingChatId === person.id) && (
                      <button
                        onClick={() => void openChatThread(person.id)}
                        disabled={loadingChatId === person.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-70"
                      >
                        {loadingChatId === person.id ? "Opening..." : "Open Chat Tab"}
                        <ArrowUpRight size={13} />
                      </button>
                    )}
                    {!usingDemo && (
                      <button
                        onClick={() => router.push(`/business/${person.businessSlug}`)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        Access Listings
                        <ArrowUpRight size={13} />
                      </button>
                    )}
                  </div>

                  {canUseRealtimeActions && isInlineComposerOpen && (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold text-slate-700">Message profile owner</p>
                      <textarea
                        value={inlineDraft}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setInlineMessageDrafts((previous) => ({ ...previous, [person.id]: nextValue }));
                          if (inlineStatus) {
                            setInlineMessageStatusByProvider((previous) => ({ ...previous, [person.id]: "" }));
                          }
                        }}
                        rows={3}
                        placeholder={`Write a message to ${person.name}...`}
                        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                      />
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => void sendInlineMessage(person)}
                          disabled={inlineSendingProviderId === person.id || !inlineDraft.trim()}
                          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {inlineSendingProviderId === person.id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                          {inlineSendingProviderId === person.id ? "Sending..." : "Send Message"}
                        </button>
                        {savedConversationId && (
                          <button
                            onClick={() => void openChatThread(person.id)}
                            disabled={loadingChatId === person.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-70"
                          >
                            {loadingChatId === person.id ? "Opening..." : "Open Thread"}
                            <ArrowUpRight size={13} />
                          </button>
                        )}
                      </div>
                      {!!inlineStatus && <p className="mt-2 text-xs text-slate-600">{inlineStatus}</p>}
                    </div>
                  )}
                </div>
              </article>
            );
          })}

          {!filteredProviders.length && (
            <div className="col-span-full rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <Users className="mx-auto mb-3 text-slate-400" />
              <p className="text-base font-semibold text-slate-800">No providers found for current filters.</p>
              <p className="mt-1 text-sm text-slate-500">Try widening radius, changing tab, or resetting filters.</p>
              <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
                >
                  Reset all filters
                </button>
                <button
                  type="button"
                  onClick={() => void loadProviders(true)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  Sync providers
                </button>
              </div>
            </div>
          )}

          {hasMoreProviders && !!visibleProviders.length && (
            <div ref={infiniteSentinelRef} className="col-span-full flex justify-center pt-1 pb-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm">
                {loadingMore ? <Loader2 size={14} className="animate-spin" /> : <ChevronsDown size={14} />}
                {loadingMore ? "Loading more providers..." : "Scroll for more providers"}
              </div>
            </div>
          )}

          {!hasMoreProviders && filteredProviders.length > PROVIDERS_BATCH_SIZE && (
            <p className="col-span-full text-center text-xs text-slate-500">You have reached the end of the local feed.</p>
          )}
        </section>
      )}

      <ProviderTrustPanel
        userId={selectedProvider || ""}
        open={!!selectedProvider}
        onClose={() => setSelectedProvider(null)}
      />
    </div>
  );
}
