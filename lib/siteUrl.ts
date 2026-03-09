const DEFAULT_LOCAL_SITE_URL = "http://localhost:3000";

export const cleanSiteUrl = (value: string | undefined | null): string => value?.trim().replace(/\/+$/u, "") ?? "";

const normalizeSiteUrl = (value: string | undefined | null): string | null => {
  const trimmed = cleanSiteUrl(value);
  if (!trimmed) return null;

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//iu.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return cleanSiteUrl(url.toString());
  } catch {
    return null;
  }
};

const normalizeAbsoluteUrl = (value: string | undefined | null): URL | null => {
  const trimmed = cleanSiteUrl(value);
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url;
  } catch {
    return null;
  }
};

export const getConfiguredSiteUrl = (): string =>
  normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
  normalizeSiteUrl(process.env.SITE_URL) ||
  normalizeSiteUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
  normalizeSiteUrl(process.env.VERCEL_URL) ||
  DEFAULT_LOCAL_SITE_URL;

export const resolveRequestOrigin = (request: Request): string | null => {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const requestProtocol = (() => {
    try {
      return new URL(request.url).protocol === "http:" ? "http" : "https";
    } catch {
      return "https";
    }
  })();

  if (forwardedHost) {
    const protocol = forwardedProto === "http" || forwardedProto === "https" ? forwardedProto : requestProtocol;
    return normalizeSiteUrl(`${protocol}://${forwardedHost}`);
  }

  try {
    return normalizeSiteUrl(new URL(request.url).origin);
  } catch {
    return null;
  }
};

export const buildAuthCallbackUrl = (origin: string): string => `${cleanSiteUrl(origin)}/auth/callback`;

export const resolveAuthCallbackUrl = ({
  request,
  requestedRedirectTo,
}: {
  request: Request;
  requestedRedirectTo?: string | null;
}): string => {
  const requestOrigin = resolveRequestOrigin(request) || getConfiguredSiteUrl();
  const fallbackRedirectTo = buildAuthCallbackUrl(requestOrigin);
  const requestedUrl = normalizeAbsoluteUrl(requestedRedirectTo);

  if (!requestedUrl) {
    return fallbackRedirectTo;
  }

  if (requestedUrl.origin !== requestOrigin || requestedUrl.pathname !== "/auth/callback") {
    return fallbackRedirectTo;
  }

  requestedUrl.hash = "";
  return requestedUrl.toString();
};
