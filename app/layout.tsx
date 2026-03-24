import "./globals.css";
import "leaflet/dist/leaflet.css";
import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { appName, appTagline } from "@/lib/branding";

export const metadata: Metadata = {
  title: {
    default: appName,
    template: `%s | ${appName}`,
  },
  applicationName: appName,
  description: appTagline,
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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[var(--surface-app)] text-[var(--ink-950)] antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
