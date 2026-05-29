import type { MetadataRoute } from "next";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.serviqapp.com";

const STATIC_ROUTES = [
  { url: "/", changeFrequency: "weekly" as const, priority: 1.0 },
  { url: "/dashboard", changeFrequency: "weekly" as const, priority: 0.8 },
  { url: "/dashboard/people", changeFrequency: "weekly" as const, priority: 0.7 },
  { url: "/dashboard/providers", changeFrequency: "weekly" as const, priority: 0.7 },
  { url: "/dashboard/referrals", changeFrequency: "monthly" as const, priority: 0.5 },
  { url: "/market/crossing-republik", changeFrequency: "weekly" as const, priority: 0.9 },
  { url: "/referral", changeFrequency: "monthly" as const, priority: 0.3 },
];

const CATEGORY_SLUGS = [
  "electrician", "plumber", "ro-water-purifier-repair", "ac-repair-service",
  "geyser-repair", "appliance-repair", "carpenter-minor-fitting",
  "tailoring-and-alterations", "clothing-and-fashion",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${SITE_URL}${r.url}`,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  const db = createSupabaseAdminClient();

  if (db) {
    const { data: localities } = await db
      .from("localities")
      .select("slug")
      .eq("zone_type", "society");

    if (localities) {
      for (const loc of localities) {
        for (const cat of CATEGORY_SLUGS) {
          entries.push({
            url: `${SITE_URL}/market/${loc.slug}/${cat}`,
            changeFrequency: "weekly",
            priority: 0.6,
          });
        }
      }
    }
  }

  return entries;
}
