import type { Metadata } from "next";
import { getConfiguredSiteUrl } from "./siteUrl";
import { appName, appTagline } from "./branding";

export const buildPageMetadata = ({
  title,
  description,
  path,
  imageUrl,
  type = "website",
}: {
  title: string;
  description?: string;
  path?: string;
  imageUrl?: string | null;
  type?: "website" | "profile";
}): Metadata => {
  const siteUrl = getConfiguredSiteUrl();
  const url = path ? `${siteUrl}${path}` : undefined;
  const desc = description || appTagline;
  const ogImage = imageUrl
    ? [{ url: imageUrl }]
    : [{ url: `${siteUrl}/api/og?title=${encodeURIComponent(title)}` }];

  return {
    title,
    description: desc,
    ...(url && {
      alternates: { canonical: url },
    }),
    openGraph: {
      title,
      description: desc,
      url,
      siteName: appName,
      type,
      images: ogImage,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      images: ogImage,
    },
  };
};

export const rootMetadata: Metadata = {
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
    images: [{ url: `${getConfiguredSiteUrl()}/api/og?title=${encodeURIComponent(appName)}` }],
  },
  twitter: {
    card: "summary_large_image",
    title: appName,
    description: appTagline,
    images: [{ url: `${getConfiguredSiteUrl()}/api/og?title=${encodeURIComponent(appName)}` }],
  },
};
