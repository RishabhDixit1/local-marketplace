import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAuthCookieName } from "@/lib/supabaseAuthCookie";

const protectedPaths = ["/dashboard", "/checkout", "/orders"];

const publicPathPrefixes = [
  "/_next",
  "/api",
  "/auth",
  "/business",
  "/market",
  "/profile",
  "/search",
  "/referral",
  "/favicon",
  "/images",
  "/storage",
  "/app",
];

const publicExactPaths = ["/", "/sitemap.xml", "/robots.txt", "/manifest.json", "/sw.js"];

function isProtected(pathname: string): boolean {
  return protectedPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isPublic(pathname: string): boolean {
  if (publicExactPaths.includes(pathname)) return true;
  return publicPathPrefixes.some((p) => pathname.startsWith(p));
}

function base64UrlDecode(str: string): string {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return atob(padded);
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(base64UrlDecode(parts[1]));
  } catch {
    return null;
  }
}

function parseLocalSessionCookieEdge(cookieValue: string): {
  access_token: string;
  user: { id: string; email: string };
} | null {
  try {
    if (!cookieValue.startsWith("base64-")) return null;
    const json = base64UrlDecode(cookieValue.replace("base64-", ""));
    const session = JSON.parse(json);
    if (!session.access_token || !session.user?.id) return null;
    return session;
  } catch {
    return null;
  }
}

function isLocalTokenValid(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.sub) return false;
  if (payload.exp && typeof payload.exp === "number") {
    if (payload.exp * 1000 < Date.now()) return false;
  }
  return true;
}

function getLocalSessionFromCookie(
  request: NextRequest,
): { access_token: string; user: { id: string; email: string } } | null {
  const cookieName = getSupabaseAuthCookieName();
  const cookie = request.cookies.get(cookieName);
  if (!cookie?.value) return null;
  const parsed = parseLocalSessionCookieEdge(cookie.value);
  if (!parsed) return null;
  if (!isLocalTokenValid(parsed.access_token)) return null;
  return parsed;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname) || !isProtected(pathname)) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: { name: getSupabaseAuthCookieName() },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const { data: { session } } = await supabase.auth.getSession();

  if (session?.user) {
    return supabaseResponse;
  }

  // GoTrue unreachable — check for locally-signed session cookie
  const localSession = getLocalSessionFromCookie(request);
  if (localSession) {
    return supabaseResponse;
  }

  const signInUrl = new URL("/", request.url);
  signInUrl.searchParams.set("signin", "true");
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|robots.txt|sitemap.xml|images/|app/releases/).*)",
  ],
};
