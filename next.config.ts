import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const supabaseHostname = (() => {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  if (!value) return "";

  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
})();

const images: NonNullable<NextConfig["images"]> = {
  remotePatterns: [
    {
      protocol: "https",
      hostname: "images.unsplash.com",
    },
    {
      protocol: "https",
      hostname: "i.pravatar.cc",
    },
    {
      protocol: "https",
      hostname: "*.supabase.co",
    },
    ...(supabaseHostname
      ? [
          {
            protocol: "https" as const,
            hostname: supabaseHostname,
          },
        ]
      : []),
    {
      protocol: "https",
      hostname: "picsum.photos",
    },
  ],
  minimumCacheTTL: 31536000,
  formats: ["image/avif", "image/webp"],
  deviceSizes: [320, 420, 640, 750, 828, 1080, 1200, 1600],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
};

const createNextConfig = (phase: string): NextConfig => ({
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  images,
  compress: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@supabase/supabase-js",
      "framer-motion",
    ],
  },
  staticPageGenerationTimeout: 120,
});

export default createNextConfig;
