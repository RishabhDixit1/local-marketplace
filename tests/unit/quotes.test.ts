import { describe, expect, it } from "vitest";
import { calculateQuoteTotals, normalizeQuoteLineItems, toDateInputValue } from "../../lib/quotes/calculations";

describe("quote calculations", () => {
  it("normalizes line items and calculates totals", () => {
    const result = calculateQuoteTotals({
      lineItems: [
        {
          label: "  Site visit  ",
          description: "Initial scope review",
          quantity: 1,
          unitPrice: 799,
        },
        {
          label: "Repair work",
          description: "Labor and tools",
          quantity: 2,
          unitPrice: 1250.5,
        },
      ],
      taxAmount: 180.75,
    });

    expect(result.lineItems).toHaveLength(2);
    expect(result.lineItems[0]?.label).toBe("Site visit");
    expect(result.subtotal).toBe(3300);
    expect(result.taxAmount).toBe(180.75);
    expect(result.total).toBe(3480.75);
  });

  it("drops blank labels and coerces numeric fields", () => {
    const lineItems = normalizeQuoteLineItems([
      {
        label: "  ",
        description: "skip",
        quantity: 0,
        unitPrice: 200,
      },
      {
        label: "Polish",
        description: "",
        quantity: Number("2"),
        unitPrice: Number("450"),
      },
    ]);

    expect(lineItems).toHaveLength(1);
    expect(lineItems[0]?.quantity).toBe(2);
    expect(lineItems[0]?.amount).toBe(900);
  });

  it("formats ISO timestamps for date inputs", () => {
    expect(toDateInputValue("2026-03-28T12:30:00.000Z")).toBe("2026-03-28");
    expect(toDateInputValue("not-a-date")).toBe("");
  });
});
