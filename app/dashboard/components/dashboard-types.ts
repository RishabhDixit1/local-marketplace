export interface ProviderCardData {
  id: string;
  name: string;
  location: string;
  avatarUrl: string;
  bio: string;
  avgRating: number | null;
  reviewCount: number;
  serviceCount: number;
  completedJobs: number;
  responseMinutes: number | null;
  isOnline: boolean;
  priceMin: number | null;
  priceMax: number | null;
  distanceKm: number | null;
  listings: { id: string; title: string; category: string; price: number | null }[];
  verified: boolean;
}
