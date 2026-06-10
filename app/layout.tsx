import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { appName, appTagline } from "@/lib/branding";
import { AppFooter } from "@/components/AppFooter";
import { NavigationProgress } from "@/app/components/NavigationProgress";

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
  },
  twitter: {
    card: "summary_large_image",
    title: appName,
    description: appTagline,
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
      </head>
      <body className="flex min-h-screen flex-col bg-[var(--surface-app)] text-[var(--ink-950)] antialiased">
        <NavigationProgress />
        <div className="flex-1">{children}</div>
        <AppFooter />
        <Analytics />
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
