import { Suspense } from "react";
import type { Metadata } from "next";
import { LandingPageClient } from "./components/landing/LandingPageClient";
import { buildPageMetadata } from "@/lib/metadata";
import { appName } from "@/lib/branding";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: appName,
    description: "Connecting people with Human-Centered Services Near You! Find trusted local plumbers, electricians, repair services, and more in your neighborhood.",
  });
}

function LandingSkeleton() {
  return (
    <div className="relative min-h-screen bg-white">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="h-8 w-24 animate-pulse rounded-lg bg-slate-200" />
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden h-10 w-24 animate-pulse rounded-xl bg-slate-200 sm:block" />
            <div className="h-10 w-24 animate-pulse rounded-xl bg-slate-200" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mt-8 text-center sm:mt-12">
          <div className="mx-auto h-10 w-64 animate-pulse rounded-lg bg-slate-200" />
          <div className="mx-auto mt-3 h-5 w-80 animate-pulse rounded bg-slate-100" />
          <div className="mx-auto mt-6 h-14 max-w-2xl animate-pulse rounded-2xl bg-slate-100" />
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-24 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      </main>
    </div>
  );
}

export default async function PublicLandingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const initialSignIn = params.signin === "true";
  const initialCategory = typeof params.category === "string" ? params.category : null;

  return (
    <Suspense fallback={<LandingSkeleton />}>
      <LandingPageClient
        initialSignIn={initialSignIn}
        initialCategory={initialCategory}
      />
    </Suspense>
  );
}
