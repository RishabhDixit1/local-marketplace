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
};

export type RealtimePinPhase = "entering" | "stable" | "exiting";

export type RealtimeMarketplacePin = MarketplaceMapItem & {
  phase: RealtimePinPhase;
  firstSeenAt: number;
  lastSeenAt: number;
  isNew: boolean;
  order: number;
};
