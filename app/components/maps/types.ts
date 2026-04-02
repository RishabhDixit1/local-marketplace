import type { CoordinateAccuracy } from "@/lib/geo";

export type MarketplaceMapItem = {
  id: string;
  title: string;
  lat: number;
  lng: number;
  creatorName?: string;
  locationLabel?: string;
  category?: string;
  timeLabel?: string;
  priceLabel?: string;
  urgent?: boolean;
  coordinateAccuracy?: CoordinateAccuracy;
  detailPath?: string | null;
  detailLabel?: string | null;
};

export type RealtimePinPhase = "entering" | "stable" | "exiting";

export type RealtimeMarketplacePin = MarketplaceMapItem & {
  phase: RealtimePinPhase;
  firstSeenAt: number;
  lastSeenAt: number;
  isNew: boolean;
  order: number;
};
