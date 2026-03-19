import type {
  LaunchpadAnswers,
  LaunchpadFaqItem,
  LaunchpadGeneratedProfile,
  LaunchpadProductDraft,
  LaunchpadServiceDraft,
} from "@/lib/api/launchpad";
import { normalizeTopics } from "@/lib/profile/utils";

type ParsedCatalogEntry = {
  title: string;
  description: string;
  price: number | null;
};

const PRICE_PATTERN = /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d+)?)/i;
const FALLBACK_PRICE_PATTERN = /\b(\d[\d,]{2,})(?:\s*(?:\/|per)\s*(?:job|visit|hour|hr|item))?\b/i;

const trim = (value: string | null | undefined) => value?.trim() ?? "";

const titleCase = (value: string) =>
  trim(value)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const dedupeStrings = (values: string[], limit: number) => {
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

const splitList = (value: string) =>
  dedupeStrings(
    value
      .split(/\r?\n|,|;/g)
      .map((item) => item.replace(/^[-*•\d.)\s]+/, "").trim())
      .filter(Boolean),
    12
  );

const extractPrice = (value: string) => {
  const normalized = trim(value);
  if (!normalized) return null;

  const firstMatch = normalized.match(PRICE_PATTERN) || normalized.match(FALLBACK_PRICE_PATTERN);
  if (!firstMatch?.[1]) return null;

  const parsed = Number(firstMatch[1].replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
};

const stripPrice = (value: string) =>
  trim(value)
    .replace(PRICE_PATTERN, "")
    .replace(FALLBACK_PRICE_PATTERN, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+[-:|]\s*$/, "")
    .trim();

const parseCatalogEntries = (value: string): ParsedCatalogEntry[] =>
  splitList(
    value
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n")
  )
    .map((line) => {
      const price = extractPrice(line);
      const withoutPrice = stripPrice(line);
      const parts = withoutPrice.split(/\s[-|:]\s/).map((part) => trim(part));
      const title = titleCase(parts[0] || withoutPrice);
      const description = trim(parts.slice(1).join(". "));

      if (!title) return null;
      return {
        title,
        description,
        price,
      };
    })
    .filter((entry): entry is ParsedCatalogEntry => !!entry)
    .slice(0, 10);

const resolveOfferings = (answers: LaunchpadAnswers, catalogEntries: ParsedCatalogEntry[]) => {
  const sourceItems = splitList(answers.coreOfferings);
  const catalogTitles = catalogEntries.map((entry) => entry.title);
  const merged = dedupeStrings([...sourceItems, ...catalogTitles], 10);
  if (merged.length > 0) return merged;
  return [`${answers.primaryCategory} support`];
};

const buildToneSentence = (tone: LaunchpadAnswers["brandTone"]) => {
  if (tone === "friendly") return "Expect a warm, approachable experience with clear updates.";
  if (tone === "premium") return "Work is positioned around polished delivery and high-trust service.";
  if (tone === "fast") return "The focus is on quick replies, quick quotes, and quick turnaround.";
  if (tone === "community") return "The brand leans into neighborhood trust and repeat local relationships.";
  return "Customers get clear communication, dependable timing, and practical next steps.";
};

const buildPricingSentence = (answers: LaunchpadAnswers, fallbackPrice: number | null) => {
  if (answers.pricingNotes) return answers.pricingNotes;
  if (fallbackPrice && fallbackPrice > 0) return `Most work starts around INR ${fallbackPrice.toLocaleString("en-IN")}.`;
  return "Pricing is shared clearly before work starts.";
};

const buildServiceAreas = (answers: LaunchpadAnswers) => {
  const rawAreas = splitList(answers.serviceArea);
  const fallback = trim(answers.location);
  return dedupeStrings([...rawAreas, ...(fallback ? [fallback] : [])], 6);
};

const createServiceDescription = (params: {
  businessName: string;
  offering: string;
  summary: string;
  serviceArea: string;
  pricingSentence: string;
  toneSentence: string;
}) =>
  `${params.businessName} handles ${params.offering.toLowerCase()} for customers in ${params.serviceArea}. ${params.summary} ${params.pricingSentence} ${params.toneSentence}`.trim();

const createProductDescription = (params: {
  businessName: string;
  title: string;
  summary: string;
  serviceArea: string;
  toneSentence: string;
}) =>
  `${params.businessName} offers ${params.title.toLowerCase()} for local buyers in ${params.serviceArea}. ${params.summary} ${params.toneSentence}`.trim();

export const generateLaunchpadProfile = (answers: LaunchpadAnswers): LaunchpadGeneratedProfile => {
  const catalogEntries = parseCatalogEntries(answers.catalogText);
  const offerings = resolveOfferings(answers, catalogEntries);
  const serviceAreas = buildServiceAreas(answers);
  const serviceAreaLabel = serviceAreas.join(", ") || answers.location || "nearby neighborhoods";
  const offeringSnippet = offerings.slice(0, 3).join(", ");
  const fallbackPrice = extractPrice(answers.pricingNotes) || catalogEntries[0]?.price || null;
  const pricingSentence = buildPricingSentence(answers, fallbackPrice);
  const toneSentence = buildToneSentence(answers.brandTone);

  return {
    fullName: answers.businessName,
    location: answers.location,
    bio: `${answers.businessName} is a local ${answers.businessType.toLowerCase()} business serving ${serviceAreaLabel}. We help with ${offeringSnippet}. ${answers.shortDescription} ${pricingSentence} ${toneSentence}`.replace(
      /\s+/g,
      " "
    ),
    interests: normalizeTopics([answers.primaryCategory, ...offerings, answers.businessType]),
    phone: answers.phone,
    website: answers.website,
    availability: "available",
    metadata: {
      launchpad: {
        businessType: answers.businessType,
        offeringType: answers.offeringType,
        hours: answers.hours,
        pricingNotes: answers.pricingNotes,
        serviceAreas,
      },
    },
  };
};

export const generateLaunchpadServices = (answers: LaunchpadAnswers): LaunchpadServiceDraft[] => {
  if (answers.offeringType === "products") return [];

  const catalogEntries = parseCatalogEntries(answers.catalogText);
  const offerings = resolveOfferings(answers, catalogEntries);
  const serviceAreas = buildServiceAreas(answers);
  const serviceAreaLabel = serviceAreas.join(", ") || answers.location || "nearby neighborhoods";
  const toneSentence = buildToneSentence(answers.brandTone);
  const fallbackPrice = extractPrice(answers.pricingNotes);
  const pricingSentence = buildPricingSentence(answers, fallbackPrice);

  return offerings.slice(0, 6).map((offering, index) => {
    const catalogMatch = catalogEntries.find((entry) => entry.title.toLowerCase() === offering.toLowerCase());
    const price = catalogMatch?.price || fallbackPrice || null;

    return {
      title: titleCase(offering),
      description: createServiceDescription({
        businessName: answers.businessName,
        offering,
        summary: answers.shortDescription,
        serviceArea: serviceAreaLabel,
        pricingSentence,
        toneSentence,
      }),
      category: answers.primaryCategory,
      price,
      availability: "available",
      metadata: {
        source: "launchpad",
        launchpad_type: "service",
        business_type: answers.businessType,
        service_area: serviceAreaLabel,
        service_index: index,
      },
    };
  });
};

export const generateLaunchpadProducts = (answers: LaunchpadAnswers): LaunchpadProductDraft[] => {
  if (answers.offeringType === "services") return [];

  const catalogEntries = parseCatalogEntries(answers.catalogText);
  const offerings = resolveOfferings(answers, catalogEntries);
  const toneSentence = buildToneSentence(answers.brandTone);
  const serviceAreaLabel = buildServiceAreas(answers).join(", ") || answers.location || "nearby neighborhoods";
  const fallbackPrice = extractPrice(answers.pricingNotes);

  const productSeed =
    catalogEntries.length > 0
      ? catalogEntries
      : offerings.map((offering) => ({
          title: titleCase(offering),
          description: "",
          price: fallbackPrice,
        }));

  return productSeed.slice(0, 8).map((entry, index) => ({
    title: titleCase(entry.title),
    description:
      trim(entry.description) ||
      createProductDescription({
        businessName: answers.businessName,
        title: entry.title,
        summary: answers.shortDescription,
        serviceArea: serviceAreaLabel,
        toneSentence,
      }),
    category: answers.primaryCategory,
    price: entry.price || fallbackPrice || null,
    stock: 1,
    metadata: {
      source: "launchpad",
      launchpad_type: "product",
      business_type: answers.businessType,
      product_index: index,
    },
  }));
};

export const generateLaunchpadFaq = (answers: LaunchpadAnswers): LaunchpadFaqItem[] => {
  const serviceAreas = buildServiceAreas(answers);
  const fallbackPrice = extractPrice(answers.pricingNotes);

  return [
    {
      question: `What does ${answers.businessName} help with?`,
      answer: `${answers.businessName} focuses on ${answers.coreOfferings || answers.primaryCategory} for nearby customers.`,
    },
    {
      question: "Which areas do you serve?",
      answer: serviceAreas.length > 0 ? serviceAreas.join(", ") : answers.location || "Nearby areas",
    },
    {
      question: "How does pricing work?",
      answer: buildPricingSentence(answers, fallbackPrice),
    },
    {
      question: "What are your working hours?",
      answer: answers.hours || "Hours can be shared directly when confirming the booking.",
    },
  ];
};

export const generateLaunchpadDraftOutput = (answers: LaunchpadAnswers) => {
  const generatedProfile = generateLaunchpadProfile(answers);
  const generatedServices = generateLaunchpadServices(answers);
  const generatedProducts = generateLaunchpadProducts(answers);
  const generatedFaq = generateLaunchpadFaq(answers);
  const generatedServiceAreas = buildServiceAreas(answers);

  return {
    generatedProfile,
    generatedServices,
    generatedProducts,
    generatedFaq,
    generatedServiceAreas,
  };
};
