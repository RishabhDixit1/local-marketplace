"use client";

import { useEffect } from "react";
import { appName } from "@/lib/branding";

type PageMetaProps = {
  title: string;
  description?: string;
  path?: string;
};

export function PageMeta({ title, description, path }: PageMetaProps) {
  const fullTitle = `${title} | ${appName}`;

  useEffect(() => {
    document.title = fullTitle;

    let descEl = document.querySelector('meta[name="description"]');
    if (description) {
      if (!descEl) {
        descEl = document.createElement("meta");
        descEl.setAttribute("name", "description");
        document.head.appendChild(descEl);
      }
      descEl.setAttribute("content", description);
    }

    let ogTitleEl = document.querySelector('meta[property="og:title"]');
    if (!ogTitleEl) {
      ogTitleEl = document.createElement("meta");
      ogTitleEl.setAttribute("property", "og:title");
      document.head.appendChild(ogTitleEl);
    }
    ogTitleEl.setAttribute("content", fullTitle);

    if (description) {
      let ogDescEl = document.querySelector('meta[property="og:description"]');
      if (!ogDescEl) {
        ogDescEl = document.createElement("meta");
        ogDescEl.setAttribute("property", "og:description");
        document.head.appendChild(ogDescEl);
      }
      ogDescEl.setAttribute("content", description);
    }

    if (path) {
      let canonicalEl = document.querySelector('link[rel="canonical"]');
      if (!canonicalEl) {
        canonicalEl = document.createElement("link");
        canonicalEl.setAttribute("rel", "canonical");
        document.head.appendChild(canonicalEl);
      }
      canonicalEl.setAttribute("href", `${window.location.origin}${path}`);
    }
  }, [fullTitle, description, path]);

  return null;
}
