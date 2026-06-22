import "./globals.css";
import type { Metadata, Viewport } from "next";
import dynamic from "next/dynamic";
import { Analytics } from "@vercel/analytics/next";

const CookieConsentBanner = dynamic(
  () => import("@/app/components/CookieConsentBanner"),
);
import { appName, appTagline } from "@/lib/branding";
import { AppFooter } from "@/components/AppFooter";
import { NavigationProgress } from "@/app/components/NavigationProgress";
import { getConfiguredSiteUrl } from "@/lib/siteUrl";

const siteUrl = getConfiguredSiteUrl();
const ogImage = [{ url: `${siteUrl}/api/og?title=${encodeURIComponent(appName)}` }];

export const metadata: Metadata = {
  title: {
    default: appName,
    template: `%s | ${appName}`,
  },
  applicationName: appName,
  description: appTagline,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: appName,
  },
  openGraph: {
    title: appName,
    description: appTagline,
    siteName: appName,
    type: "website",
    images: ogImage,
  },
  twitter: {
    card: "summary_large_image",
    title: appName,
    description: appTagline,
    images: ogImage,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){try{var t=localStorage.getItem("serviq-theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme:dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})();
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){try{var l=localStorage.getItem("serviq-locale");if(l){document.documentElement.lang=l}}catch(e){}})();
            `,
          }}
        />
      </head>
      <body className="flex min-h-screen flex-col bg-[var(--surface-app)] text-[var(--ink-950)] antialiased">
        <NavigationProgress />
        <div className="flex-1">{children}</div>
        <AppFooter />
        <Analytics />
        <CookieConsentBanner />
        {process.env.NODE_ENV === "production" && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                if ("serviceWorker" in navigator) {
                  window.addEventListener("load", () => {
                    navigator.serviceWorker.register("/sw.js");
                  });
                }
              `,
            }}
          />
        )}
      </body>
    </html>
  );
}
