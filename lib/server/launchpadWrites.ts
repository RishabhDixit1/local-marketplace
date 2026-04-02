import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  LaunchpadAnswers,
  LaunchpadDraftRecord,
  LaunchpadGeneratedProfile,
  LaunchpadInputSource,
  LaunchpadProductDraft,
  LaunchpadServiceDraft,
  LaunchpadWorkspaceSummary,
} from "@/lib/api/launchpad";
import { createBusinessSlug } from "@/lib/business";
import { generateLaunchpadDraftOutput } from "@/lib/launchpad/generate";
import {
  inferLaunchpadInputSource,
  normalizeLaunchpadAnswers,
  normalizeLaunchpadDraftStatus,
  normalizeLaunchpadFaqList,
  normalizeLaunchpadGeneratedProfile,
  normalizeLaunchpadInputSource,
  normalizeLaunchpadProductDraft,
  normalizeLaunchpadServiceAreas,
  normalizeLaunchpadServiceDraft,
  validateLaunchpadAnswers,
} from "@/lib/launchpad/validation";
import type { ProfileFormValues } from "@/lib/profile/types";
import { buildPublicProfilePath, normalizeProfileRecord } from "@/lib/profile/utils";
import { saveProfileRow } from "@/lib/server/profileWrites";

type LaunchpadDraftRow = {
  id: string;
  owner_id: string;
  status: string | null;
  input_source: string | null;
  answers: Record<string, unknown> | null;
  import_payload: Record<string, unknown> | null;
  generated_profile: Record<string, unknown> | null;
  generated_services: Record<string, unknown>[] | null;
  generated_products: Record<string, unknown>[] | null;
  generated_faq: Record<string, unknown>[] | null;
  generated_service_areas: string[] | null;
  approved_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type LaunchpadMutationError = {
  ok: false;
  code?: string | null;
  details?: string | null;
  message: string;
  missingTable?: boolean;
};

type LaunchpadDraftSuccess = {
  ok: true;
  draft: LaunchpadDraftRecord;
};

type LaunchpadPublishSuccess = {
  ok: true;
  draft: LaunchpadDraftRecord;
  publishedServices: number;
  publishedProducts: number;
  profilePath: string;
  businessPath: string;
};

type IdRow = { id: string };
type LiveListingRow = {
  title: string | null;
  category: string | null;
  price: number | null;
  metadata: Record<string, unknown> | null;
};

const launchpadMissingTablePattern =
  /relation .*business_launchpad_drafts.* does not exist|could not find the table '.*business_launchpad_drafts.*' in the schema cache/i;
const launchpadPolicyPattern = /row-level security|permission denied|new row violates row-level security/i;

const trim = (value: string | null | undefined) => value?.trim() ?? "";
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const dedupeStrings = (values: Array<string | null | undefined>, limit = 12) => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = trim(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= limit) break;
  }

  return result;
};
const readLaunchpadMetadata = (metadata: unknown) => {
  const metadataRecord = isRecord(metadata) ? metadata : null;
  const launchpad = isRecord(metadataRecord?.launchpad) ? metadataRecord.launchpad : null;
  const serviceAreas = Array.isArray(launchpad?.serviceAreas)
    ? dedupeStrings(
        launchpad.serviceAreas.map((item) => (typeof item === "string" ? item : "")),
        8
      )
    : [];
  const faqCount = Array.isArray(launchpad?.faq) ? launchpad.faq.length : 0;
  const publishedAt = typeof launchpad?.publishedAt === "string" ? launchpad.publishedAt : null;

  return {
    serviceAreas,
    faqCount,
    publishedAt,
  };
};
const buildCatalogLine = (row: LiveListingRow) => {
  const title = trim(row.title);
  if (!title) return "";

  const category = trim(row.category);
  const price = typeof row.price === "number" && Number.isFinite(row.price) && row.price > 0 ? row.price : null;
  const detail = [category || null, price ? `INR ${Math.round(row.price as number)}` : null].filter(Boolean).join(" - ");
  return detail ? `${title} - ${detail}` : title;
};

const isMissingLaunchpadTableError = (message: string) => launchpadMissingTablePattern.test(message);
const isDraftRowResult = (
  value: Awaited<ReturnType<typeof getLatestLaunchpadDraftRow>>
): value is { row: LaunchpadDraftRow | null } => "row" in value;
const isWorkspaceSummaryError = (
  value: LaunchpadWorkspaceSummary | LaunchpadMutationError
): value is LaunchpadMutationError => "ok" in value && value.ok === false;

const toDraftRecord = (row: LaunchpadDraftRow): LaunchpadDraftRecord => ({
  id: row.id,
  ownerId: row.owner_id,
  status: normalizeLaunchpadDraftStatus(row.status),
  inputSource: normalizeLaunchpadInputSource(row.input_source),
  answers: normalizeLaunchpadAnswers(row.answers || {}),
  importPayload: row.import_payload && typeof row.import_payload === "object" ? row.import_payload : {},
  generatedProfile: normalizeLaunchpadGeneratedProfile(row.generated_profile),
  generatedServices: (Array.isArray(row.generated_services) ? row.generated_services : [])
    .map((item) => normalizeLaunchpadServiceDraft(item))
    .filter((item): item is LaunchpadServiceDraft => !!item),
  generatedProducts: (Array.isArray(row.generated_products) ? row.generated_products : [])
    .map((item) => normalizeLaunchpadProductDraft(item))
    .filter((item): item is LaunchpadProductDraft => !!item),
  generatedFaq: normalizeLaunchpadFaqList(row.generated_faq),
  generatedServiceAreas: normalizeLaunchpadServiceAreas(row.generated_service_areas),
  approvedAt: row.approved_at || null,
  createdAt: row.created_at || null,
  updatedAt: row.updated_at || null,
});

const loadWorkspaceSummary = async (params: {
  db: SupabaseClient;
  userId: string;
  userEmail: string;
}): Promise<LaunchpadWorkspaceSummary | LaunchpadMutationError> => {
  const [profileResult, servicesResult, productsResult] = await Promise.all([
    params.db.from("profiles").select("*").eq("id", params.userId).maybeSingle(),
    params.db.from("service_listings").select("title,category,price,metadata").eq("provider_id", params.userId).limit(100),
    params.db.from("product_catalog").select("title,category,price,metadata").eq("provider_id", params.userId).limit(100),
  ]);

  if (profileResult.error) {
    return {
      ok: false,
      code: profileResult.error.code,
      details: profileResult.error.details || null,
      message: profileResult.error.message || "Unable to load current Launchpad profile state.",
    };
  }

  if (servicesResult.error) {
    return {
      ok: false,
      code: servicesResult.error.code,
      details: servicesResult.error.details || null,
      message: servicesResult.error.message || "Unable to load current service listings.",
    };
  }

  if (productsResult.error) {
    return {
      ok: false,
      code: productsResult.error.code,
      details: productsResult.error.details || null,
      message: productsResult.error.message || "Unable to load current product listings.",
    };
  }

  const profile = normalizeProfileRecord((profileResult.data as Record<string, unknown> | null) || null, {
    id: params.userId,
    email: params.userEmail,
  });
  const services = ((servicesResult.data as LiveListingRow[] | null) || []).filter(Boolean);
  const products = ((productsResult.data as LiveListingRow[] | null) || []).filter(Boolean);
  const launchpadMeta = readLaunchpadMetadata(profile?.metadata);
  const totalServices = services.length;
  const totalProducts = products.length;
  const launchpadServices = services.filter((row) => trim(String((row.metadata || {}).source || "")) === "launchpad").length;
  const launchpadProducts = products.filter((row) => trim(String((row.metadata || {}).source || "")) === "launchpad").length;
  const liveCategories = dedupeStrings(
    [...services.map((row) => row.category), ...products.map((row) => row.category), ...(profile?.interests || [])],
    8
  );
  const liveOfferings = dedupeStrings(
    [...services.map((row) => row.title), ...products.map((row) => row.title), ...(profile?.interests || [])],
    12
  );
  const liveCatalogLines = dedupeStrings(
    [...services.map((row) => buildCatalogLine(row)), ...products.map((row) => buildCatalogLine(row))],
    16
  );

  return {
    profileExists: Boolean(profile),
    profilePath: buildPublicProfilePath(profile) || null,
    businessPath: profile
      ? `/business/${createBusinessSlug(profile.full_name || profile.name, params.userId)}`
      : null,
    totalServices,
    totalProducts,
    launchpadServices,
    launchpadProducts,
    faqCount: launchpadMeta.faqCount,
    serviceAreaCount: launchpadMeta.serviceAreas.length,
    lastPublishedAt: launchpadMeta.publishedAt,
    liveCategories,
    liveOfferings,
    liveCatalogLines,
    liveServiceAreas: launchpadMeta.serviceAreas,
  };
};

const buildImportPayload = (answers: LaunchpadAnswers) => ({
  catalogText: answers.catalogText,
  coreOfferings: answers.coreOfferings,
  website: answers.website,
  phone: answers.phone,
});

const getLatestLaunchpadDraftRow = async (
  db: SupabaseClient,
  userId: string
): Promise<{ row: LaunchpadDraftRow | null } | LaunchpadMutationError> => {
  const result = await db
    .from("business_launchpad_drafts")
    .select("*")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (result.error) {
    return {
      ok: false,
      code: result.error.code,
      details: result.error.details || null,
      message: result.error.message || "Unable to load launchpad draft.",
      missingTable: isMissingLaunchpadTableError(result.error.message || ""),
    };
  }

  const row = ((result.data as LaunchpadDraftRow[] | null) || [])[0] || null;
  return { row };
};

const updateDraftRow = async (params: {
  db: SupabaseClient;
  draftId: string;
  payload: Record<string, unknown>;
}): Promise<LaunchpadDraftSuccess | LaunchpadMutationError> => {
  const result = await params.db
    .from("business_launchpad_drafts")
    .update(params.payload)
    .eq("id", params.draftId)
    .select("*")
    .single();

  if (result.error || !result.data) {
    const message = result.error?.message || "Unable to update launchpad draft.";
    return {
      ok: false,
      code: result.error?.code || null,
      details: result.error?.details || null,
      message:
        launchpadPolicyPattern.test(message)
          ? "Launchpad draft update is blocked by Supabase permissions."
          : message,
      missingTable: isMissingLaunchpadTableError(message),
    };
  }

  return {
    ok: true,
    draft: toDraftRecord(result.data as LaunchpadDraftRow),
  };
};

const insertDraftRow = async (params: {
  db: SupabaseClient;
  payload: Record<string, unknown>;
}): Promise<LaunchpadDraftSuccess | LaunchpadMutationError> => {
  const result = await params.db.from("business_launchpad_drafts").insert(params.payload).select("*").single();

  if (result.error || !result.data) {
    const message = result.error?.message || "Unable to create launchpad draft.";
    return {
      ok: false,
      code: result.error?.code || null,
      details: result.error?.details || null,
      message:
        launchpadPolicyPattern.test(message)
          ? "Launchpad draft creation is blocked by Supabase permissions."
          : message,
      missingTable: isMissingLaunchpadTableError(message),
    };
  }

  return {
    ok: true,
    draft: toDraftRecord(result.data as LaunchpadDraftRow),
  };
};

const resolveDraftForPublish = (draft: LaunchpadDraftRecord) => {
  if (draft.generatedProfile && draft.generatedServices.length + draft.generatedProducts.length > 0) {
    return draft;
  }

  const generated = generateLaunchpadDraftOutput(draft.answers);
  return {
    ...draft,
    status: "generated" as const,
    generatedProfile: generated.generatedProfile,
    generatedServices: generated.generatedServices,
    generatedProducts: generated.generatedProducts,
    generatedFaq: generated.generatedFaq,
    generatedServiceAreas: generated.generatedServiceAreas,
  };
};

const buildProfileValues = (params: {
  generatedProfile: LaunchpadGeneratedProfile;
  userId: string;
  userEmail: string;
  existingProfile: ReturnType<typeof normalizeProfileRecord>;
}): ProfileFormValues => {
  const { generatedProfile, existingProfile, userEmail } = params;

  return {
    fullName: generatedProfile.fullName || trim(existingProfile?.full_name) || trim(existingProfile?.name),
    location: generatedProfile.location || trim(existingProfile?.location),
    latitude:
      typeof generatedProfile.latitude === "number" && Number.isFinite(generatedProfile.latitude)
        ? generatedProfile.latitude
        : existingProfile?.latitude ?? null,
    longitude:
      typeof generatedProfile.longitude === "number" && Number.isFinite(generatedProfile.longitude)
        ? generatedProfile.longitude
        : existingProfile?.longitude ?? null,
    role: "provider",
    bio: generatedProfile.bio || trim(existingProfile?.bio),
    interests: generatedProfile.interests.length > 0 ? generatedProfile.interests : existingProfile?.interests || [],
    email: trim(existingProfile?.email) || userEmail,
    phone: generatedProfile.phone || trim(existingProfile?.phone),
    website: generatedProfile.website || trim(existingProfile?.website),
    avatarUrl: trim(existingProfile?.avatar_url),
    backgroundImageUrl:
      trim(typeof existingProfile?.metadata?.coverImageUrl === "string" ? existingProfile.metadata.coverImageUrl : "") ||
      trim(typeof existingProfile?.metadata?.cover_image === "string" ? existingProfile.metadata.cover_image : "") ||
      trim(typeof existingProfile?.metadata?.backgroundImageUrl === "string" ? existingProfile.metadata.backgroundImageUrl : "") ||
      trim(typeof existingProfile?.metadata?.background_image === "string" ? existingProfile.metadata.background_image : ""),
    availability: generatedProfile.availability,
  };
};

const buildProfileLaunchpadMetadata = (draft: LaunchpadDraftRecord) => ({
  launchpad: {
    businessType: draft.answers.businessType,
    offeringType: draft.answers.offeringType,
    inputSource: draft.inputSource,
    hours: draft.answers.hours,
    pricingNotes: draft.answers.pricingNotes,
    serviceAreas: draft.generatedServiceAreas,
    faq: draft.generatedFaq,
    draftId: draft.id,
    publishedAt: new Date().toISOString(),
  },
});

const getExistingLaunchpadListingIds = async (params: {
  db: SupabaseClient;
  table: "service_listings" | "product_catalog";
  providerId: string;
}) => {
  const result = await params.db
    .from(params.table)
    .select("id")
    .eq("provider_id", params.providerId)
    .contains("metadata", { source: "launchpad" });

  if (result.error) {
    throw new Error(result.error.message || `Unable to load ${params.table}.`);
  }

  return (((result.data as IdRow[] | null) || []).map((row) => row.id).filter(Boolean) as string[]).slice(0, 100);
};

const publishGeneratedServices = async (params: {
  db: SupabaseClient;
  providerId: string;
  draftId: string;
  services: LaunchpadServiceDraft[];
}) => {
  const previousIds = await getExistingLaunchpadListingIds({
    db: params.db,
    table: "service_listings",
    providerId: params.providerId,
  });

  if (params.services.length > 0) {
    const publishBatchId = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const payload = params.services.map((service) => ({
      provider_id: params.providerId,
      title: service.title,
      description: service.description,
      category: service.category,
      price: service.price,
      availability: service.availability,
      metadata: {
        ...service.metadata,
        source: "launchpad",
        launchpad_draft_id: params.draftId,
        launchpad_batch_id: publishBatchId,
        published_at: nowIso,
      },
    }));

    const insertResult = await params.db.from("service_listings").insert(payload);
    if (insertResult.error) {
      throw new Error(insertResult.error.message || "Unable to publish generated services.");
    }
  }

  if (previousIds.length > 0) {
    const deleteResult = await params.db.from("service_listings").delete().in("id", previousIds);
    if (deleteResult.error) {
      throw new Error(deleteResult.error.message || "Unable to replace previous launchpad services.");
    }
  }

  return params.services.length;
};

const publishGeneratedProducts = async (params: {
  db: SupabaseClient;
  providerId: string;
  draftId: string;
  products: LaunchpadProductDraft[];
}) => {
  const previousIds = await getExistingLaunchpadListingIds({
    db: params.db,
    table: "product_catalog",
    providerId: params.providerId,
  });

  if (params.products.length > 0) {
    const publishBatchId = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const payload = params.products.map((product) => ({
      provider_id: params.providerId,
      title: product.title,
      description: product.description,
      category: product.category,
      price: product.price,
      stock: product.stock,
      metadata: {
        ...product.metadata,
        source: "launchpad",
        launchpad_draft_id: params.draftId,
        launchpad_batch_id: publishBatchId,
        published_at: nowIso,
      },
    }));

    const insertResult = await params.db.from("product_catalog").insert(payload);
    if (insertResult.error) {
      throw new Error(insertResult.error.message || "Unable to publish generated products.");
    }
  }

  if (previousIds.length > 0) {
    const deleteResult = await params.db.from("product_catalog").delete().in("id", previousIds);
    if (deleteResult.error) {
      throw new Error(deleteResult.error.message || "Unable to replace previous launchpad products.");
    }
  }

  return params.products.length;
};

export const loadLatestLaunchpadDraft = async (
  db: SupabaseClient,
  userId: string
): Promise<{ ok: true; draft: LaunchpadDraftRecord | null } | LaunchpadMutationError> => {
  const latest = await getLatestLaunchpadDraftRow(db, userId);
  if (!isDraftRowResult(latest)) return latest;
  return {
    ok: true,
    draft: latest.row ? toDraftRecord(latest.row) : null,
  };
};

export const loadLaunchpadWorkspace = async (params: {
  db: SupabaseClient;
  userId: string;
  userEmail: string;
}): Promise<{ ok: true; draft: LaunchpadDraftRecord | null; summary: LaunchpadWorkspaceSummary } | LaunchpadMutationError> => {
  const [latest, summary] = await Promise.all([
    getLatestLaunchpadDraftRow(params.db, params.userId),
    loadWorkspaceSummary(params),
  ]);

  if (isWorkspaceSummaryError(summary)) return summary;
  if (!isDraftRowResult(latest)) {
    if (latest.missingTable) {
      return {
        ok: true,
        draft: null,
        summary,
      };
    }

    return latest;
  }

  return {
    ok: true,
    draft: latest.row ? toDraftRecord(latest.row) : null,
    summary,
  };
};

export const saveLaunchpadDraft = async (params: {
  db: SupabaseClient;
  userId: string;
  answers: LaunchpadAnswers;
  inputSource?: LaunchpadInputSource;
}): Promise<LaunchpadDraftSuccess | LaunchpadMutationError> => {
  const normalizedAnswers = normalizeLaunchpadAnswers(params.answers);
  const validationErrors = validateLaunchpadAnswers(normalizedAnswers);

  if (Object.keys(validationErrors).length > 0) {
    return {
      ok: false,
      message: Object.values(validationErrors)[0] || "Launchpad answers are invalid.",
    };
  }

  const generated = generateLaunchpadDraftOutput(normalizedAnswers);
  const inputSource = inferLaunchpadInputSource(normalizedAnswers, params.inputSource);
  const payload = {
    owner_id: params.userId,
    status: "generated",
    input_source: inputSource,
    answers: normalizedAnswers,
    import_payload: buildImportPayload(normalizedAnswers),
    generated_profile: generated.generatedProfile,
    generated_services: generated.generatedServices,
    generated_products: generated.generatedProducts,
    generated_faq: generated.generatedFaq,
    generated_service_areas: generated.generatedServiceAreas,
  };

  const latest = await getLatestLaunchpadDraftRow(params.db, params.userId);
  if (!isDraftRowResult(latest)) return latest;

  if (latest.row?.id) {
    return updateDraftRow({
      db: params.db,
      draftId: latest.row.id,
      payload,
    });
  }

  return insertDraftRow({
    db: params.db,
    payload,
  });
};

export const publishLaunchpadDraft = async (params: {
  db: SupabaseClient;
  userId: string;
  userEmail: string;
  draftId?: string;
}): Promise<LaunchpadPublishSuccess | LaunchpadMutationError> => {
  const latest = await getLatestLaunchpadDraftRow(params.db, params.userId);
  if (!isDraftRowResult(latest)) return latest;

  const selectedRow =
    params.draftId && latest.row?.id !== params.draftId
      ? null
      : latest.row;

  let sourceDraft = selectedRow ? toDraftRecord(selectedRow) : null;

  if (!sourceDraft && params.draftId) {
    const result = await params.db
      .from("business_launchpad_drafts")
      .select("*")
      .eq("id", params.draftId)
      .eq("owner_id", params.userId)
      .maybeSingle();

    if (result.error) {
      return {
        ok: false,
        code: result.error.code,
        details: result.error.details || null,
        message: result.error.message || "Unable to load launchpad draft.",
        missingTable: isMissingLaunchpadTableError(result.error.message || ""),
      };
    }

    sourceDraft = result.data ? toDraftRecord(result.data as LaunchpadDraftRow) : null;
  }

  if (!sourceDraft) {
    return {
      ok: false,
      message: "No launchpad draft is ready to publish yet.",
    };
  }

  const draft = resolveDraftForPublish(sourceDraft);
  if (!draft.generatedProfile) {
    return {
      ok: false,
      message: "Launchpad draft is missing generated profile content.",
    };
  }

  const existingProfileResult = await params.db.from("profiles").select("*").eq("id", params.userId).maybeSingle();
  if (existingProfileResult.error) {
    return {
      ok: false,
      code: existingProfileResult.error.code,
      details: existingProfileResult.error.details || null,
      message: existingProfileResult.error.message || "Unable to load existing profile.",
    };
  }

  const existingProfile = normalizeProfileRecord(
    (existingProfileResult.data as Record<string, unknown> | null) || null,
    { id: params.userId, email: params.userEmail }
  );

  const profileValues = buildProfileValues({
    generatedProfile: draft.generatedProfile,
    userId: params.userId,
    userEmail: params.userEmail,
    existingProfile,
  });

  const profileSave = await saveProfileRow({
    db: params.db,
    userId: params.userId,
    email: params.userEmail,
    values: profileValues,
  });

  if (!profileSave.ok || !profileSave.profile) {
    return {
      ok: false,
      code: profileSave.code || null,
      details: profileSave.details || null,
      message: profileSave.message || "Unable to publish launchpad profile.",
    };
  }

  const metadataUpdate = await params.db
    .from("profiles")
    .update({
      metadata: {
        ...(profileSave.profile.metadata || {}),
        ...buildProfileLaunchpadMetadata(draft),
      },
    })
    .eq("id", params.userId);

  if (metadataUpdate.error) {
    return {
      ok: false,
      code: metadataUpdate.error.code,
      details: metadataUpdate.error.details || null,
      message: metadataUpdate.error.message || "Unable to store launchpad profile metadata.",
    };
  }

  try {
    const [publishedServices, publishedProducts] = await Promise.all([
      publishGeneratedServices({
        db: params.db,
        providerId: params.userId,
        draftId: draft.id,
        services: draft.generatedServices,
      }),
      publishGeneratedProducts({
        db: params.db,
        providerId: params.userId,
        draftId: draft.id,
        products: draft.generatedProducts,
      }),
    ]);

    const finalized = await updateDraftRow({
      db: params.db,
      draftId: draft.id,
      payload: {
        status: "published",
        approved_at: new Date().toISOString(),
        generated_profile: draft.generatedProfile,
        generated_services: draft.generatedServices,
        generated_products: draft.generatedProducts,
        generated_faq: draft.generatedFaq,
        generated_service_areas: draft.generatedServiceAreas,
      },
    });

    if (!finalized.ok) return finalized;

    const profilePath = buildPublicProfilePath(profileSave.profile) || "/dashboard/profile";
    const businessPath = `/business/${createBusinessSlug(
      draft.generatedProfile.fullName || profileSave.profile.full_name || profileSave.profile.name,
      params.userId
    )}`;

    return {
      ok: true,
      draft: finalized.draft,
      publishedServices,
      publishedProducts,
      profilePath,
      businessPath,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to publish launchpad listings.",
    };
  }
};
