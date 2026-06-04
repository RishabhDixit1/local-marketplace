import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname) || !isProtected(pathname)) {
    return NextResponse.next();
  }

  const hasAuthCookie = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  if (!hasAuthCookie) {
    const signInUrl = new URL("/", request.url);
    signInUrl.searchParams.set("signin", "true");
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets (images, manifests, service workers)
     */
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|robots.txt|sitemap.xml|images/|app/releases/).*)",
  ],
};
