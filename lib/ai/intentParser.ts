export type ParsedIntent = {
  action: "find_service" | "buy_product" | "post_need" | "find_provider" | "help";
  category: string | null;
  subcategory: string | null;
  urgency: "now" | "today" | "this_week" | "flexible" | null;
  location: string | null;
  budget: { min: number | null; max: number | null };
  keywords: string[];
  originalQuery: string;
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  electrician: ["electrician", "wiring", "switchboard", "electrical", "power cut", "circuit", "switch", "fan", "light"],
  plumber: ["plumber", "plumbing", "pipe", "leak", "tap", "faucet", "bathroom", "toilet", "drain", "water"],
  "ac repair": ["ac", "air conditioner", "cooling", "gas refill", "ac service", "split ac", "window ac"],
  "ro repair": ["ro", "water purifier", "filter", "aquaguard", "kent", "pureit", "water filter"],
  carpenter: ["carpenter", "furniture", "wood", "door", "cabinet", "shelf", "drilling", "wall mount"],
  "appliance repair": ["appliance", "washing machine", "refrigerator", "fridge", "microwave", "oven", "geyser"],
  "mobile repair": ["mobile", "phone", "smartphone", "iphone", "screen", "battery", "laptop", "computer"],
  "bike repair": ["bike", "scooter", "motorcycle", "tyre", "oil change", "service", "two wheeler"],
  "hardware shop": ["hardware", "pipe", "paint", "tool", "fitting", "sanitary"],
  "electrical shop": ["electrical shop", "wire", "switch", "mcb", "light", "fan shop"],
};

const URGENCY_KEYWORDS: Record<string, string[]> = {
  now: ["now", "immediately", "asap", "urgent", "emergency", "right now", "quick"],
  today: ["today", "this evening", "by evening", "by tonight"],
  this_week: ["this week", "within this week", "tomorrow"],
};

const PRODUCT_CATEGORIES = ["mobile", "phone", "laptop", "tv", "fridge", "washing machine", "fan", "light", "pipe", "wire", "paint", "tool"];

function matchKeywords(query: string): ParsedIntent {
  const lower = query.toLowerCase().trim();
  const tokens = lower.split(/\s+/);

  let category: string | null = null;
  let urgency: "now" | "today" | "this_week" | "flexible" | null = null;
  let action: ParsedIntent["action"] = "find_service";
  const budget: { min: number | null; max: number | null } = { min: null, max: null };

  // Extract budget
  const budgetMatch = lower.match(/(?:under|below|less than|upto|up to)\s*(?:rs\.?\s*)?(\d+)/i);
  if (budgetMatch) {
    budget.max = parseInt(budgetMatch[1], 10);
  }
  const budgetMinMatch = lower.match(/(?:above|over|more than|min)\s*(?:rs\.?\s*)?(\d+)/i);
  if (budgetMinMatch) {
    budget.min = parseInt(budgetMinMatch[1], 10);
  }
  const rangeMatch = lower.match(/(?:rs\.?\s*)?(\d+)\s*(?:-|to)\s*(?:rs\.?\s*)?(\d+)/i);
  if (rangeMatch) {
    budget.min = parseInt(rangeMatch[1], 10);
    budget.max = parseInt(rangeMatch[2], 10);
  }

  // Extract urgency
  for (const [key, patterns] of Object.entries(URGENCY_KEYWORDS)) {
    if (patterns.some((p) => lower.includes(p))) {
      urgency = key as ParsedIntent["urgency"];
      break;
    }
  }

  // Determine if it's a product request
  const isProductQuery = tokens.some((t) => PRODUCT_CATEGORIES.includes(t)) ||
    /\b(buy|purchase|price|cost)\b/.test(lower);

  if (isProductQuery) {
    action = "buy_product";
  }

  // Extract "I need" / "I want" patterns
  if (/need help|help me|how do i|how to/i.test(lower)) {
    action = "help";
  }

  // If posting intent
  if (/\b(post|create|list|offer|sell)\b/.test(lower) && !isProductQuery) {
    action = "post_need";
  }

  // Match category
  for (const [cat, patterns] of Object.entries(CATEGORY_KEYWORDS)) {
    if (patterns.some((p) => lower.includes(p))) {
      category = cat;
      break;
    }
  }

  return {
    action,
    category,
    subcategory: null,
    urgency,
    location: null,
    budget,
    keywords: tokens.filter((t) => t.length > 2),
    originalQuery: query,
  };
}

function buildResponse(intent: ParsedIntent): string {
  const prefix = intent.urgency === "now" ? "🔴 Urgent! " : "";

  if (intent.category) {
    const categoryLabel = intent.category.charAt(0).toUpperCase() + intent.category.slice(1);
    if (intent.action === "buy_product") {
      return `${prefix}Showing ${categoryLabel} products available near Crossings Republik.`;
    }
    return `${prefix}Showing ${categoryLabel} providers near Crossings Republik.`;
  }

  if (intent.action === "buy_product") {
    return `${prefix}Browsing products available in Crossings Republik marketplaces.`;
  }

  if (intent.action === "post_need") {
    return `Ready to post your need. Providers in Crossings Republik will respond.`;
  }

  if (intent.action === "help") {
    return `How can we help? You can browse providers, post a need, or visit the marketplace.`;
  }

  return `Showing providers and services near Crossings Republik.`;
}

export function parseIntent(query: string): ParsedIntent & { response: string } {
  const intent = matchKeywords(query);
  const response = buildResponse(intent);
  return { ...intent, response };
}
