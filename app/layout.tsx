import "./globals.css";
import type { Metadata, Viewport } from "next";
import dynamic from "next/dynamic";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import { manrope, sora } from "@/lib/fonts";

const CookieConsentBanner = dynamic(
  () => import("@/app/components/CookieConsentBanner"),
);
import { appName, appTagline } from "@/lib/branding";
import { AppFooter } from "@/components/AppFooter";
import { NavigationProgress } from "@/app/components/NavigationProgress";
import { ToastProvider } from "@/app/components/toast/ToastProvider";
import { AnimatedPage } from "@/app/components/motion/AnimatedPage";
import { OfflineBanner } from "@/app/components/OfflineBanner";
import { getConfiguredSiteUrl } from "@/lib/siteUrl";
import { getServerLocale } from "@/lib/i18n-server";
import { LocaleProvider } from "@/lib/i18n-context";

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getServerLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <Script id="theme-script" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem("serviq-theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme:dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})();`}
        </Script>
        <Script id="locale-script" strategy="beforeInteractive">
          {`(function(){try{var l=localStorage.getItem("serviq-locale");if(l){document.documentElement.lang=l}}catch(e){}})();`}
        </Script>
      </head>
      <body className={`${manrope.variable} ${sora.variable} flex min-h-screen flex-col bg-[var(--surface-app)] text-[var(--ink-950)] antialiased`}>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[var(--layer-tooltip)] focus:rounded-xl focus:bg-[var(--surface-elevated)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--ink-950)] focus:shadow-lg focus:outline-none">
          Skip to main content
        </a>
        <NavigationProgress />
        <OfflineBanner />
        <LocaleProvider defaultLocale={locale}>
          <ToastProvider>
            <main id="main-content" className="flex-1"><AnimatedPage>{children}</AnimatedPage></main>
            <AppFooter />
          </ToastProvider>
        </LocaleProvider>
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
