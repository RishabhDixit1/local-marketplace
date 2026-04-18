import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { ensureProfileBootstrapRow } from "@/lib/server/profileWrites";
import { loadMarketplaceProfileBundleByProfileId } from "@/lib/profile/marketplaceData";

export const runtime = "nodejs";

const getLinkedProviders = (user: User) => {
  const providers = new Set<string>();

  if ((user.email || "").trim()) {
    providers.add("email");
  }

  const appProviders = user.app_metadata?.providers;
  if (Array.isArray(appProviders)) {
    for (const provider of appProviders) {
      if (typeof provider === "string" && provider.trim()) {
        providers.add(provider.trim().toLowerCase());
      }
    }
  }

  for (const identity of user.identities || []) {
    const provider = identity.provider?.trim().toLowerCase();
    if (provider) {
      providers.add(provider);
    }
  }

  return Array.from(providers).sort((left, right) => {
    const rank = (value: string) => {
      if (value === "email") return 0;
      if (value === "google") return 1;
      return 9;
    };

    const leftRank = rank(left);
    const rightRank = rank(right);
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return left.localeCompare(right);
  });
};

export async function GET(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: "UNAUTHORIZED",
        message: authResult.message,
      },
      { status: authResult.status }
    );
  }

  const admin = createSupabaseAdminClient();
  const dbClient = admin || createSupabaseUserServerClient(authResult.auth.accessToken);

  if (!dbClient) {
    return NextResponse.json(
      {
        ok: false,
        code: "CONFIG",
        message: "Supabase server credentials are missing.",
      },
      { status: 500 }
    );
  }

  try {
    await ensureProfileBootstrapRow({
      db: dbClient,
      user: authResult.auth.user,
    });

    const bundle = await loadMarketplaceProfileBundleByProfileId(authResult.auth.userId, {
      dbClient,
    });

    if (!bundle) {
      return NextResponse.json(
        {
          ok: false,
          code: "NOT_FOUND",
          message: "Profile bundle is not ready yet.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        account: {
          userId: authResult.auth.userId,
          email: authResult.auth.email,
          linkedProviders: getLinkedProviders(authResult.auth.user),
          publicPath: bundle.publicPath,
          displayName: bundle.displayName,
        },
        profile: bundle.profile,
        roleFamily: bundle.roleFamily,
        sections: bundle.sections,
        services: bundle.services,
        products: bundle.products,
        portfolio: bundle.portfolio,
        workHistory: bundle.workHistory,
        availability: bundle.availability,
        paymentMethods: bundle.paymentMethods,
        reviews: bundle.reviews,
        averageRating: bundle.averageRating,
        reviewCount: bundle.reviewCount,
        serviceCount: bundle.serviceCount,
        productCount: bundle.productCount,
        portfolioCount: bundle.portfolioCount,
        workHistoryCount: bundle.workHistoryCount,
        availabilityCount: bundle.availabilityCount,
        paymentMethodCount: bundle.paymentMethodCount,
        completionPercent: bundle.completionPercent,
        trustScore: bundle.trustScore?.trust_score ?? bundle.profile.trust_score ?? null,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "DB",
        message: error instanceof Error ? error.message : "Unable to load the mobile account bundle.",
      },
      { status: 500 }
    );
  }
}
