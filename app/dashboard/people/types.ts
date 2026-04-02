import type { ConnectionState } from "@/lib/connectionState";

export type PresenceTone = "online" | "away" | "offline";

export type ProviderOfferingKind = "service" | "product";

export type ProviderOffering = {
  id: string;
  kind: ProviderOfferingKind;
  title: string;
  description: string;
  category: string;
  price: number | null;
  priceLabel: string | null;
  availability: string | null;
  imageUrl: string | null;
  deliveryMethod: string | null;
  createdAt: string | null;
};

export type ProviderMedia = {
  id: string;
  url: string;
  title: string;
  origin: "product";
};

export type ProviderCard = {
  id: string;
  name: string;
  businessSlug: string;
  fullProfilePath: string;
  publicProfilePath: string;
  avatar: string;
  role: string;
  bio: string;
  location: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  distanceKm: number;
  rating: number | null;
  reviews: number;
  verified: boolean;
  online: boolean;
  availability: string;
  responseMinutes: number;
  primarySkill: string;
  tags: string[];
  completedJobs: number | null;
  openLeads: number | null;
  profileCompletion: number;
  rankScore: number;
  joinedAt: string | null;
  latitude: number | null;
  longitude: number | null;
  coordinateAccuracy: "precise" | "approximate";
  listingCount: number;
  serviceCount: number;
  productCount: number;
  demandCount: number;
  minPrice: number | null;
  minPriceLabel: string | null;
  offerings: ProviderOffering[];
  media: ProviderMedia[];
  recentActivityLabel: string;
  trustBlurb: string;
  searchDocument: string;
};

export type ProviderCardConnectionState = ConnectionState;

export type ProviderPreview = {
  id: string;
  name: string;
  avatar: string;
  role: string;
  presenceTone: PresenceTone;
  distanceLabel: string;
  ratingLabel: string;
  tagline: string;
};

export type PeopleBanner = {
  kind: "success" | "error" | "info";
  message: string;
};

export type RealtimeToast = {
  id: number;
  message: string;
};
