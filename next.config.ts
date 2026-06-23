import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { withSentryConfig } from "@sentry/nextjs";

// Bundle analyzer — uncomment to use (requires @next/bundle-analyzer):
//   npm install -D @next/bundle-analyzer
// Then run: ANALYZE=true npm run build
// import withBundleAnalyzer from "@next/bundle-analyzer";
//
// Usage — replace the default export at the bottom of this file:
//   export default withBundleAnalyzer({ enabled: process.env.ANALYZE === "true" })(
//     withSentryConfig(createNextConfig, sentryOptions),
//   );

const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL?.trim() || "";
const cdnHostname = cdnUrl ? new URL(cdnUrl).hostname : null;

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
const supabaseStorageOrigin = process.env.SUPABASE_STORAGE_URL?.trim() || supabaseApiOrigin;
const supabaseWsOrigin = supabaseApiOrigin ? supabaseApiOrigin.replace(/^http/, "ws") : null;
const supabaseHostname = supabaseUrl?.hostname || "";
const supabaseProtocol = (supabaseUrl?.protocol?.replace(":", "") || "https") as "http" | "https";
const supabasePublicHostname = supabasePublicUrl?.hostname || supabaseHostname;

// Derive non-www variant so both www.serviqapp.com and serviqapp.com work
const rootHostname = supabasePublicHostname.startsWith("www.")
  ? supabasePublicHostname.slice(4)
  : null;

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
            protocol: (supabasePublicUrl?.protocol?.replace(":", "") || "https") as "http" | "https",
            hostname: supabasePublicHostname,
          } as const,
          ...(rootHostname
            ? [{
                protocol: (supabasePublicUrl?.protocol?.replace(":", "") || "https") as "http" | "https",
                hostname: rootHostname,
              } as const]
            : []),
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
    ...(cdnHostname
      ? [{
          protocol: (cdnUrl.startsWith("https") ? "https" : "http") as "http" | "https",
          hostname: cdnHostname,
        } as const]
      : []),
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
  `media-src 'self' ${supabaseApiOrigin}`,
  `connect-src 'self' ${supabaseApiOrigin}${supabaseWsOrigin ? ` ${supabaseWsOrigin}` : ""} https://*.supabase.co wss://*.supabase.co https://api.razorpay.com https://o*.sentry.io https://maps.googleapis.com https://www.google-analytics.com`,
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
    remotePatterns: [
      ...images.remotePatterns!,
      ...(phase === PHASE_DEVELOPMENT_SERVER
        ? [
            { protocol: "http" as const, hostname: "localhost" },
          ]
        : []),
    ],
    dangerouslyAllowLocalIP: phase === PHASE_DEVELOPMENT_SERVER,
    unoptimized: true,
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
    const origin = supabaseApiOrigin;
    if (!origin) {
      console.warn("Supabase API origin not configured; auth, storage, and API rewrites are disabled.");
      return [];
    }
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
        destination: `${supabaseStorageOrigin || origin}/storage/v1/:path*`,
      },
      {
        source: "/realtime/v1/:path*",
        destination: `${origin}/realtime/v1/:path*`,
      },
      ...(cdnUrl
        ? [{
            source: "/cdn/:path*",
            destination: `${cdnUrl}/:path*`,
          }]
        : []),
    ];
  },
});

const sentryOptions: Parameters<typeof withSentryConfig>[1] = {
  org: "serviq",
  project: "serviq-web",
  silent: !process.env.CI,
  widenClientFileUpload: true,

};

export default withSentryConfig(createNextConfig, sentryOptions);
