import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

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
      hostname: "**.supabase.co",
    },
    {
      protocol: "https",
      hostname: "picsum.photos",
    },
  ],
};

export default (phase: string): NextConfig => ({
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  images,
});
