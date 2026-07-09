import { Metadata } from "next";
import MarketZonePageClient from "./MarketZonePageClient";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const name = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    title: `${name} Marketplace — ServiQ`,
    description: `Find trusted local service providers in ${name}. Browse electricians, plumbers, AC repair, and more near you.`,
  };
}

export default async function MarketZonePage({ params }: Props) {
  const { slug } = await params;
  return <MarketZonePageClient slug={slug} />;
}
