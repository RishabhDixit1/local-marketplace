import type { QuoteLineItemInput, QuoteLineItemRecord } from "@/lib/api/quotes";

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

const trim = (value: string | null | undefined) => value?.trim() ?? "";

export const normalizeQuoteLineItems = (items: QuoteLineItemInput[]) =>
  items
    .map((item, index) => {
      const label = trim(item.label);
      const quantity = Math.max(1, roundCurrency(toFiniteNumber(item.quantity, 1)));
      const unitPrice = Math.max(0, roundCurrency(toFiniteNumber(item.unitPrice, 0)));

      if (!label) return null;

      return {
        id: `draft-${index}`,
        label,
        description: trim(item.description),
        quantity,
        unitPrice,
        amount: roundCurrency(quantity * unitPrice),
        sortOrder: index,
      } satisfies QuoteLineItemRecord;
    })
    .filter((item): item is QuoteLineItemRecord => !!item);

export const calculateQuoteTotals = (params: {
  lineItems: QuoteLineItemInput[];
  taxAmount?: number;
}) => {
  const normalizedLineItems = normalizeQuoteLineItems(params.lineItems);
  const subtotal = roundCurrency(
    normalizedLineItems.reduce((sum, item) => sum + roundCurrency(item.amount), 0)
  );
  const taxAmount = Math.max(0, roundCurrency(toFiniteNumber(params.taxAmount, 0)));
  const total = roundCurrency(subtotal + taxAmount);

  return {
    lineItems: normalizedLineItems,
    subtotal,
    taxAmount,
    total,
  };
};

export const toDateInputValue = (value: string | null | undefined) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};
