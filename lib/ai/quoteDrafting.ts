import type { QuoteContextRecord, QuoteLineItemInput } from "@/lib/api/quotes";
import { generate } from "./provider";
import { z } from "zod";

export type GeneratedQuoteDraft = {
  summary: string;
  notes: string;
  lineItems: QuoteLineItemInput[];
  expiresAt: string;
};

const trim = (value: string | null | undefined) => value?.trim() ?? "";

const toFinitePositive = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
};

const isoDatePlusDays = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const distributeAmount = (total: number, count: number): number[] => {
  if (count <= 1) return [total];
  const base = Math.floor((total / count) * 100) / 100;
  const remainder = Math.round((total - base * count) * 100) / 100;
  const shares = Array.from({ length: count }, () => base);
  if (remainder > 0) shares[0] = Math.round((shares[0] + remainder) * 100) / 100;
  return shares;
};

const quoteDraftSchema = z.object({
  summary: z.string(),
  notes: z.string(),
  lineItems: z.array(z.object({
    label: z.string(),
    description: z.string().optional().default(""),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative(),
  })),
  expiresAt: z.string(),
});

export async function generateQuoteDraftWithLLM(
  context: QuoteContextRecord,
  catalogLines?: string[]
): Promise<GeneratedQuoteDraft> {
  try {
    const catalogContext = catalogLines?.length
      ? `\nProvider catalog items: ${catalogLines.join(", ")}`
      : "";

    const result = await generate({
      prompt: `Generate a quote draft from this context:
- Task: ${context.taskTitle}
- Description: ${context.taskDescription ?? "N/A"}
- Client: ${context.counterpartyName ?? "Client"}
- Location: ${context.locationLabel ?? "N/A"}
- Suggested amount: ${context.suggestedAmount ? `₹${context.suggestedAmount}` : "Not specified"}${catalogContext}

Generate 1-3 line items with realistic local-market prices for Crossings Republik, Ghaziabad.`,
      schema: quoteDraftSchema,
      system: "You are a quote generator for a hyperlocal services marketplace. Generate professional quotes with local pricing.",
    });

    return result;
  } catch {
    return generateQuoteDraft(context, catalogLines);
  }
}

export function generateQuoteDraft(
  context: QuoteContextRecord,
  catalogLines?: string[]
): GeneratedQuoteDraft {
  const taskTitle = trim(context.taskTitle) || "Scope item";
  const taskDescription = trim(context.taskDescription);
  const locationLabel = trim(context.locationLabel);
  const counterpartyName = trim(context.counterpartyName) || "Client";
  const suggestedAmount = toFinitePositive(context.suggestedAmount);

  const descriptionItems = taskDescription
    ? taskDescription.split(/,|;|\r?\n/)
        .map((part) => part.replace(/^[-*•\d.)\s]+/, "").trim())
        .filter((part) => part.length > 2 && part.length < 100)
        .slice(0, 4)
    : [];

  const taskKeywords = new Set(
    `${taskTitle} ${taskDescription}`
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 3)
  );

  const catalogMatches = (catalogLines ?? [])
    .filter((line) => {
      const lineLower = line.toLowerCase();
      return [...taskKeywords].some((keyword) => lineLower.includes(keyword));
    })
    .slice(0, 2);

  const titleCase = (value: string) =>
    value
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

  let lineItemLabels: string[];
  if (catalogMatches.length > 0) {
    lineItemLabels = [titleCase(taskTitle), ...catalogMatches.map(titleCase)].slice(0, 3);
  } else if (descriptionItems.length >= 2) {
    lineItemLabels = descriptionItems.slice(0, 3).map(titleCase);
  } else {
    lineItemLabels = [titleCase(taskTitle)];
  }

  const amounts =
    suggestedAmount && suggestedAmount > 0
      ? distributeAmount(suggestedAmount, lineItemLabels.length)
      : lineItemLabels.map(() => 0);

  const lineItems: QuoteLineItemInput[] = lineItemLabels.map((label, index) => ({
    label,
    description:
      index === 0 && taskDescription && descriptionItems.length < 2
        ? taskDescription.slice(0, 160).trim()
        : "",
    quantity: 1,
    unitPrice: amounts[index] ?? 0,
  }));

  const summary = `Quote for ${counterpartyName} — ${taskTitle}`;

  const notesParts: string[] = [];
  if (locationLabel) notesParts.push(`Location: ${locationLabel}.`);
  notesParts.push("Pricing is indicative. Please confirm scope before work begins.");
  if (!suggestedAmount) notesParts.push("Update line item prices to match your actual rates.");
  const notes = notesParts.join(" ");

  return {
    summary,
    notes,
    lineItems,
    expiresAt: isoDatePlusDays(7),
  };
}
