import { NextResponse } from "next/server";
import { createSupabaseAnonServerClient } from "@/lib/server/supabaseClients";
import { withCache, queryCacheKey } from "@/lib/cache/withCache";

export const runtime = "nodejs";

export type ServiceCategoryResponse = {
  id: string;
  name: string;
  slug: string;
  icon_slug: string;
  description: string;
  base_price_min: number;
  base_price_max: number;
  estimated_duration_mins: number;
  sort_order: number;
  provider_count?: number;
};

export type ServiceCategoriesApiResponse = {
  ok: boolean;
  categories?: ServiceCategoryResponse[];
  code?: string;
  message?: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const localityId = searchParams.get("locality_id");

  const supabase = createSupabaseAnonServerClient();

  if (!supabase) {
    return NextResponse.json(
      { ok: false, code: "CONFIG", message: "Supabase anon environment variables are missing." } satisfies ServiceCategoriesApiResponse,
      { status: 500 }
    );
  }

  try {
    const cacheKey = queryCacheKey("service-categories", localityId ?? "all");
    const categories = await withCache<ServiceCategoryResponse[]>(
      async () => {
        const { data, error } = await supabase
          .from("service_categories")
          .select("*")
          .eq("is_active", true)
          .order("sort_order", { ascending: true });

        if (error) throw new Error(error.message);

        let result = (data || []) as ServiceCategoryResponse[];

        if (localityId) {
          const enriched = await Promise.all(
            result.map(async (cat) => {
              const { count } = await supabase
                .from("profiles")
                .select("id", { count: "exact", head: true })
                .eq("role", "provider")
                .or(`locality_id.eq.${localityId},service_zone_ids.cs.{${localityId}}`)
                .contains("service_category_ids", [cat.id]);

              return { ...cat, provider_count: count ?? 0 };
            })
          );
          result = enriched;
        }

        return result;
      },
      { key: cacheKey, ttlSeconds: localityId ? 300 : 3600 },
    );

    return NextResponse.json({
      ok: true,
      categories,
    } satisfies ServiceCategoriesApiResponse);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "DB",
        message: error instanceof Error ? error.message : "Unable to load service categories.",
      } satisfies ServiceCategoriesApiResponse,
      { status: 500 }
    );
  }
}
