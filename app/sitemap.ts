import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://serviqapp.com";

const staticRoutes = [
  "/",
  "/dashboard",
  "/dashboard/admin",
  "/dashboard/people",
  "/dashboard/tasks",
  "/dashboard/chat",
  "/dashboard/profile",
  "/dashboard/orders",
  "/dashboard/notifications",
  "/dashboard/providers",
  "/dashboard/referrals",
  "/dashboard/launchpad",
  "/dashboard/workspaces",
  "/onboarding/provider/locality",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...staticRoutes.map((route) => ({
      url: `${baseUrl}${route}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: route === "/" ? 1.0 : 0.8,
    })),
  ];
}
