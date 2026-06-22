import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/metadata";
import { appName, appDescription } from "@/lib/branding";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: appName,
    description: appDescription,
  });
}

export default function MarketLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
