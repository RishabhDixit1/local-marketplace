import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { withSentryConfig } from "@sentry/nextjs";

const supabaseUrl = (() => {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
})();

const supabaseHostname = supabaseUrl?.hostname || "";
const supabaseProtocol = (supabaseUrl?.protocol?.replace(":", "") || "https") as "http" | "https";

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
    ...(supabaseHostname
      ? [
          {
            protocol: supabaseProtocol,
            hostname: supabaseHostname,
          },
        ]
      : []),
    {
      protocol: "https",
      hostname: "picsum.photos",
    },
    {
      protocol: "https",
      hostname: "*.supabase.co",
    },
  ],
  minimumCacheTTL: 31536000,
  formats: ["image/avif", "image/webp"],
  qualities: [70, 72, 75],
  deviceSizes: [320, 420, 640, 750, 828, 1080, 1200, 1600],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
};

const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const createNextConfig = (phase: string): NextConfig => ({
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  images: {
    ...images,
    dangerouslyAllowLocalIP: phase === PHASE_DEVELOPMENT_SERVER,
  },
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
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
});

const sentryOptions: Parameters<typeof withSentryConfig>[1] = {
  org: "serviq",
  project: "serviq-web",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  automaticVercelMonitors: true,
};

export default withSentryConfig(createNextConfig, sentryOptions);
