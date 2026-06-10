import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { withSentryConfig } from "@sentry/nextjs";

const supabaseUrl = (() => {
  const value = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
})();

const supabasePublicUrl = (() => {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
})();

const supabaseApiOrigin = supabaseUrl ? `${supabaseUrl.protocol}//${supabaseUrl.host}` : null;
const supabaseHostname = supabaseUrl?.hostname || "";
const supabaseProtocol = (supabaseUrl?.protocol?.replace(":", "") || "https") as "http" | "https";
const supabasePublicHostname = supabasePublicUrl?.hostname || supabaseHostname;

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
            protocol: supabaseProtocol as "http" | "https",
            hostname: supabaseHostname,
          } as const,
        ]
      : []),
    ...(supabasePublicHostname && supabasePublicHostname !== supabaseHostname
      ? [
          {
            protocol: "https" as const,
            hostname: supabasePublicHostname,
          } as const,
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
  qualities: [60, 70, 72, 75],
  deviceSizes: [320, 420, 640, 750, 828, 1080, 1200, 1600],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
};

const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-eval' 'unsafe-inline' https://checkout.razorpay.com https://maps.googleapis.com https://www.googletagmanager.com`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `img-src 'self' data: blob: https: http:`,
  `font-src 'self' https://fonts.gstatic.com data:`,
  `connect-src 'self' http://54.253.40.174:8000 https://*.supabase.co wss://*.supabase.co https://api.razorpay.com https://o*.sentry.io https://maps.googleapis.com https://www.google-analytics.com`,
  `frame-src https://checkout.razorpay.com https://accounts.google.com`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
].join("; ");

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
  {
    key: "Content-Security-Policy",
    value: csp,
  },
];

const createNextConfig = (phase: string): NextConfig => ({
  ...(process.env.DOCKER_BUILD ? { output: "standalone" as const } : {}),
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
  async rewrites() {
    const origin = supabaseApiOrigin || "http://54.253.40.174:8000";
    return [
      {
        source: "/auth/v1/:path*",
        destination: `${origin}/auth/v1/:path*`,
      },
      {
        source: "/rest/v1/:path*",
        destination: `${origin}/rest/v1/:path*`,
      },
      {
        source: "/storage/v1/:path*",
        destination: `${origin}/storage/v1/:path*`,
      },
      {
        source: "/realtime/v1/:path*",
        destination: `${origin}/realtime/v1/:path*`,
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
