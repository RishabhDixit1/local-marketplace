import "server-only";

import { parseIntentBest, type ParsedIntent } from "./intentParser";

export type AgentContext = {
  userId?: string;
  userRole?: string;
  location?: string;
};

export type ActionResult = {
  response: string;
  action: ParsedIntent["action"];
  redirect?: string;
  data?: Record<string, unknown>;
  suggestions?: string[];
};

function buildSearchUrl(intent: ParsedIntent): string {
  const queryParts: string[] = [];

  if (intent.category) {
    const label = intent.category.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    queryParts.push(label);
  }

  if (intent.location) queryParts.push(`near ${intent.location}`);

  if (intent.urgency === "now") queryParts.push("urgent");
  if (intent.budget.max) queryParts.push(`under ${intent.budget.max}`);
  if (intent.budget.min) queryParts.push(`above ${intent.budget.min}`);

  const query = queryParts.length > 0
    ? queryParts.join(" ")
    : intent.keywords.slice(0, 5).join(" ");

  return `/search?q=${encodeURIComponent(query)}`;
}

function handleSearch(intent: ParsedIntent, _context: AgentContext): ActionResult {
  const url = buildSearchUrl(intent);
  const suggestions = intent.category
    ? [
        `Find ${intent.category} with best rating`,
        `Compare ${intent.category} providers`,
        `Read reviews for ${intent.category}`,
      ]
    : [
        "Show top-rated providers",
        "Find available now",
        "Browse all categories",
      ];

  return { response: intent.response, action: intent.action, redirect: url, suggestions };
}

function handleBuy(intent: ParsedIntent, _context: AgentContext): ActionResult {
  const url = buildSearchUrl(intent);
  const suggestions = intent.category
    ? [
        `${intent.category} with delivery`,
        `${intent.category} under budget`,
        `${intent.category} near me`,
      ]
    : [
        "Grocery delivery",
        "Electronics near me",
        "Daily needs with home delivery",
      ];

  return { response: intent.response, action: intent.action, redirect: url, suggestions };
}

function handlePostNeed(intent: ParsedIntent, _context: AgentContext): ActionResult {
  const params = new URLSearchParams();
  if (intent.category) params.set("category", intent.category);
  if (intent.urgency) params.set("urgency", intent.urgency);
  if (intent.budget.max) params.set("maxBudget", String(intent.budget.max));
  const url = `/?compose=1&postType=need${params.toString() ? `&${params.toString()}` : ""}`;

  return {
    response: intent.response,
    action: intent.action,
    redirect: url,
    suggestions: [
      "Add location details",
      "Set urgency",
      "Describe in detail",
    ],
  };
}

function handleSell(intent: ParsedIntent, _context: AgentContext): ActionResult {
  const url = intent.category
    ? `/?compose=1&postType=product&category=${encodeURIComponent(intent.category)}`
    : "/?compose=1&postType=product";

  return {
    response: intent.response,
    action: intent.action,
    redirect: url,
    suggestions: [
      "List with photo",
      "Set competitive price",
      "Add delivery options",
    ],
  };
}

function handleInventory(_intent: ParsedIntent, _context: AgentContext): ActionResult {
  return {
    response: "Opening your inventory manager.",
    action: "manage_inventory",
    redirect: "/dashboard/launchpad",
    suggestions: [
      "Add new product",
      "Update stock",
      "View low stock items",
    ],
  };
}

function handleCheckOrders(_intent: ParsedIntent, context: AgentContext): ActionResult {
  if (!context.userId) {
    return {
      response: "Please sign in to view your orders.",
      action: "check_orders",
      redirect: "/?signin=true",
      suggestions: ["Sign in", "Browse marketplace"],
    };
  }
  return {
    response: "Fetching your orders.",
    action: "check_orders",
    redirect: "/dashboard/orders",
    suggestions: [
      "View pending orders",
      "Track current order",
      "View order history",
    ],
  };
}

function handleListServices(_intent: ParsedIntent, _context: AgentContext): ActionResult {
  return {
    response: "Showing your current service listings.",
    action: "list_services",
    redirect: "/dashboard/launchpad",
    suggestions: [
      "Add new service",
      "Update pricing",
      "Set availability",
    ],
  };
}

function handleManageBusiness(_intent: ParsedIntent, _context: AgentContext): ActionResult {
  return {
    response: "Opening your business dashboard.",
    action: "manage_business",
    redirect: "/dashboard",
    suggestions: [
      "View analytics",
      "Update profile",
      "Manage listings",
    ],
  };
}

function handleHelp(intent: ParsedIntent, _context: AgentContext): ActionResult {
  return {
    response: intent.response,
    action: "get_help",
    suggestions: [
      "How to find a service provider",
      "How to post a need",
      "How to sell products",
      "How delivery works",
      "Contact support",
    ],
  };
}

function routeAction(intent: ParsedIntent, context: AgentContext): ActionResult {
  switch (intent.action) {
    case "find_service":
    case "find_provider":
      return handleSearch(intent, context);
    case "buy_product":
      return handleBuy(intent, context);
    case "post_need":
      return handlePostNeed(intent, context);
    case "sell_product":
      return handleSell(intent, context);
    case "manage_inventory":
      return handleInventory(intent, context);
    case "check_orders":
      return handleCheckOrders(intent, context);
    case "list_services":
      return handleListServices(intent, context);
    case "manage_business":
      return handleManageBusiness(intent, context);
    case "get_help":
      return handleHelp(intent, context);
  }
}

export async function executeQuery(
  query: string,
  context: AgentContext = {},
): Promise<ActionResult> {
  const intent = await parseIntentBest(query);

  return routeAction(intent, context);
}
