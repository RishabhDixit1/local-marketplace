"use client";

import MarketZonePage from "@/app/components/market/MarketZonePage";

interface Props {
  slug: string;
}

export default function MarketZonePageClient({ slug }: Props) {
  return <MarketZonePage slug={slug} />;
}
