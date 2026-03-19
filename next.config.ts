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
};

const createNextConfig = (phase: string): NextConfig => ({
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  images,
});

export default createNextConfig;
