import { generate } from "./provider";
import { z } from "zod";

export type ParsedIntent = {
  action:
    | "find_service"
    | "buy_product"
    | "post_need"
    | "sell_product"
    | "manage_inventory"
    | "get_help"
    | "check_orders"
    | "list_services"
    | "manage_business"
    | "find_provider";
  category: string | null;
  subcategory: string | null;
  urgency: "now" | "today" | "this_week" | "flexible" | null;
  location: string | null;
  budget: { min: number | null; max: number | null };
  keywords: string[];
  originalQuery: string;
  response: string;
};

const CATEGORY_KEYWORDS: Record<string, { en: string[]; hi: string[] }> = {
  electrician: {
    en: ["electrician", "wiring", "switchboard", "electrical", "power cut", "circuit", "switch", "fan", "light", "mcb", "inverter", "ups"],
    hi: ["बिजली", "इलेक्ट्रीशियन", "वायरिंग", "स्विच", "फैन", "लाइट", "इन्वर्टर"],
  },
  plumber: {
    en: ["plumber", "plumbing", "pipe", "leak", "tap", "faucet", "bathroom", "toilet", "drain", "water", "geyser", "water heater", "tank"],
    hi: ["प्लंबर", "नल", "पाइप", "सीवर", "बाथरूम", "शौचालय", "पानी", "गीजर"],
  },
  "ac-repair": {
    en: ["ac", "air conditioner", "cooling", "gas refill", "ac service", "split ac", "window ac", "ac repair", "air cooler"],
    hi: ["एसी", "एसी रिपेयर", "कूलिंग", "गैस रिफिल", "एयर कूलर"],
  },
  "ro-repair": {
    en: ["ro", "water purifier", "filter", "aquaguard", "kent", "pureit", "water filter", "ro service"],
    hi: ["आरओ", "वॉटर प्यूरिफायर", "फिल्टर", "एक्वागार्ड", "केंट"],
  },
  carpenter: {
    en: ["carpenter", "furniture", "wood", "door", "cabinet", "shelf", "drilling", "wall mount", "kitchen", "modular"],
    hi: ["बढ़ई", "कारपेंटर", "फर्नीचर", "लकड़ी", "दरवाजा", "अलमारी", "शेल्फ"],
  },
  painter: {
    en: ["painter", "painting", "wall paint", "colour", "whitewash", "texture", "waterproofing"],
    hi: ["पेंटर", "पेंट", "रंग", "पुताई", "वॉल पेंट"],
  },
  cleaning: {
    en: ["cleaning", "house cleaning", "office cleaning", "sweeping", "deep cleaning", "bathroom cleaning", "kitchen cleaning", "sanitization", "fumigation"],
    hi: ["सफाई", "साफ-सफाई", "घर की सफाई", "डीप क्लीनिंग", "किचन क्लीनिंग"],
  },
  "appliance-repair": {
    en: ["appliance repair", "washing machine", "refrigerator", "fridge", "microwave", "oven", "geyser repair", "chimney", "dishwasher"],
    hi: ["वॉशिंग मशीन", "फ्रिज", "माइक्रोवेव", "गीजर रिपेयर", "चिमनी"],
  },
  "mobile-repair": {
    en: ["mobile repair", "phone", "smartphone", "iphone", "screen", "battery", "laptop", "computer repair", "tablet"],
    hi: ["मोबाइल", "फोन", "स्मार्टफोन", "स्क्रीन", "बैटरी", "लैपटॉप"],
  },
  "bike-repair": {
    en: ["bike repair", "scooter", "motorcycle", "tyre", "oil change", "service", "two wheeler", "car repair", "mechanic"],
    hi: ["बाइक", "स्कूटर", "मोटरसाइकिल", "टायर", "कार मैकेनिक", "गाड़ी"],
  },
  "computer-repair": {
    en: ["computer repair", "laptop repair", "desktop", "printer", "software", "virus", "data recovery", "cctv", "cctv installation"],
    hi: ["कंप्यूटर", "लैपटॉप", "प्रिंटर", "सीसीटीवी"],
  },
  tutor: {
    en: ["tutor", "tuition", "teacher", "coaching", "home tutor", "maths", "science", "english", "programming", "music", "dance"],
    hi: ["ट्यूटर", "ट्यूशन", "शिक्षक", "कोचिंग", "पढ़ाई", "होम ट्यूशन"],
  },
  tailor: {
    en: ["tailor", "stitching", "alteration", "custom clothes", "suit", "kurta", "dress"],
    hi: ["दर्जी", "सिलाई", "कपड़े", "सूट", "कुर्ता"],
  },
  beautician: {
    en: ["beautician", "salon", "parlour", "makeup", "facial", "haircut", "hair styling", "manicure", "pedicure", "bridal"],
    hi: ["ब्यूटीशियन", "सैलून", "पार्लर", "मेकअप", "फेशियल", "हेयरकट"],
  },
  photographer: {
    en: ["photographer", "photography", "photo shoot", "wedding", "event photography", "videographer"],
    hi: ["फोटोग्राफर", "फोटो", "वीडियोग्राफर", "शादी", "फोटोशूट"],
  },
  delivery: {
    en: ["delivery", "courier", "parcel", "food delivery", "package", "ship", "logistics", "transport"],
    hi: ["डिलीवरी", "कूरियर", "पार्सल", "भाड़ा"],
  },
  grocery: {
    en: ["grocery", "groceries", "vegetables", "fruits", "milk", "dairy", "provision", "kirana", "ration", "daily needs", "eggs", "bread"],
    hi: ["किराना", "सब्जी", "फल", "दूध", "अंडे", "राशन", "दैनिक ज़रूरतें"],
  },
  pharmacy: {
    en: ["pharmacy", "medical", "medicine", "drug", "chemist", "doctor", "clinic", "health", "ayurvedic"],
    hi: ["फार्मेसी", "दवा", "मेडिकल", "डॉक्टर", "क्लिनिक", "आयुर्वेदिक"],
  },
  electronics: {
    en: ["electronics", "tv", "mobile", "laptop", "speaker", "headphone", "home theatre", "smart watch", "gadget"],
    hi: ["इलेक्ट्रॉनिक्स", "टीवी", "मोबाइल", "लैपटॉप", "स्पीकर"],
  },
  furniture: {
    en: ["furniture", "sofa", "bed", "table", "chair", "almirah", "wardrobe", "dining", "desk", "mattress"],
    hi: ["फर्नीचर", "सोफा", "बेड", "टेबल", "कुर्सी", "अलमारी"],
  },
  salon: {
    en: ["salon", "haircut", "hair", "beard", "spa", "massage", "grooming", "salon at home"],
    hi: ["सैलून", "हेयरकट", "दाढ़ी", "स्पा", "ग्रूमिंग"],
  },
  gym: {
    en: ["gym", "fitness", "workout", "trainer", "yoga", "zumba", "personal trainer", "crossfit"],
    hi: ["जिम", "फिटनेस", "वर्कआउट", "योगा", "ट्रेनर"],
  },
  caterer: {
    en: ["caterer", "catering", "food", "party", "event", "wedding caterer", "home food", "tiffin"],
    hi: ["केटरिंग", "खाना", "पार्टी", "इवेंट", "टिफिन"],
  },
  "event-planner": {
    en: ["event planner", "event manager", "wedding planner", "decoration", "party organizer", "stage"],
    hi: ["इवेंट प्लानर", "सजावट", "पार्टी ऑर्गनाइज़र", "वेडिंग प्लानर"],
  },
  "packers-movers": {
    en: ["packers", "movers", "shifting", "relocation", "house shifting", "office shifting", "transport"],
    hi: ["पैकर्स", "मूवर्स", "शिफ्टिंग", "घर शिफ्ट", "ढुलाई"],
  },
  "pest-control": {
    en: ["pest control", "termite", "cockroach", "mosquito", "bed bugs", "fumigation", "anti-termite"],
    hi: ["पेस्ट कंट्रोल", "दीमक", "कॉकरोच", "मच्छर"],
  },
  laundry: {
    en: ["laundry", "wash", "iron", "dry clean", "dry cleaning", "dhobi"],
    hi: ["लॉन्ड्री", "धोबी", "इस्त्री", "ड्राई क्लीन"],
  },
  "hardware-store": {
    en: ["hardware shop", "hardware store", "paint", "tool", "fitting", "sanitary", "plywood"],
    hi: ["हार्डवेयर", "पेंट", "टूल", "सैनिटरी"],
  },
  "electrical-shop": {
    en: ["electrical shop", "wire", "switch", "mcb", "light", "fan shop", "electrical store"],
    hi: ["इलेक्ट्रिकल शॉप", "तार", "स्विच", "लाइट", "फैन"],
  },
  "medical-store": {
    en: ["medical store", "chemist", "pharmacy", "medico", "drug store"],
    hi: ["मेडिकल स्टोर", "दवा की दुकान", "फार्मेसी"],
  },
  "general-store": {
    en: ["general store", "provision store", "convenience", "kirana store", "stationary", "cosmetics"],
    hi: ["जनरल स्टोर", "पान की दुकान", "किराना"],
  },
};

const URGENCY_KEYWORDS: Record<string, string[]> = {
  now: ["now", "immediately", "asap", "urgent", "emergency", "right now", "quick", "at the earliest", "लगभग", "तुरंत", "जल्दी", "आपातकालीन"],
  today: ["today", "this evening", "by evening", "by tonight", "tonight", "आज", "आज शाम"],
  this_week: ["this week", "within this week", "tomorrow", "by tomorrow", "कल", "इस हफ्ते"],
};

const KNOWN_LOCATIONS = [
  "crossings republik", "indirapuram", "vaishali", "kaushambi", "ghaziabad", "noida",
  "greater noida", "delhi", "gurgaon", "gurugram", "faridabad", "sector 62", "sector 63",
  "sector 15", "sector 18", "sector 29", "sector 44", "connaught place", "karol bagh",
  "lajpat nagar", "saket", "dwarka", "rohini", "pitampura", "janakpuri", "rajouri garden",
  "vasant kunj", "malviya nagar", "greater kailash", "hauz khas", "green park",
  "munirka", "mayur vihar", "vasundhara", "laxmi nagar", "preet vihar", "karkardooma",
  "dilshad garden", "shahdara", "model town", "kamla nagar", "civil lines",
  "chandigarh", "mohali", "panchkula", "zirakpur", "derabassi", "banur",
  "lucknow", "kanpur", "agra", "meerut", "haridwar", "rishikesh", "dehradun",
  "jaipur", "jodhpur", "udaipur", "mumbai", "thane", "navi mumbai", "pune",
  "bangalore", "bengaluru", "hyderabad", "chennai", "kolkata", "ahmedabad",
  "surat", "vadodara", "bhopal", "indore", "chandigarh", "patna", "ranchi",
];

const INDIA_CITY_PATTERN = /(?:in|at|near|around|@|के|में)\s*([A-Za-z\s]+?)(?:\s*(?:area|locality|sector|phase)?(?:\s*\d)?)?\s*(?:budget|under|within|urgent|immediately|today|for|\.|$)/i;

function extractLocation(query: string): string | null {
  const lower = query.toLowerCase().trim();

  for (const loc of KNOWN_LOCATIONS) {
    if (lower.includes(loc)) {
      const words = loc.split(" ");
      return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
  }

  const match = lower.match(INDIA_CITY_PATTERN);
  if (match) {
    const candidate = match[1].trim()
      .replace(/\s+/g, " ")
      .replace(/area$/i, "")
      .replace(/locality$/i, "")
      .trim();
    if (candidate.length > 1 && !candidate.includes("budget") && !candidate.includes("under")) {
      return candidate.charAt(0).toUpperCase() + candidate.slice(1);
    }
  }

  return null;
}

function matchKeywords(query: string): ParsedIntent {
  const lower = query.toLowerCase().trim();
  const tokens = lower.split(/\s+/);

  let category: string | null = null;
  let urgency: ParsedIntent["urgency"] = null;
  let action: ParsedIntent["action"] = "find_service";
  const budget: { min: number | null; max: number | null } = { min: null, max: null };

  const budgetMatch = lower.match(/(?:under|below|less than|upto|up to|budget|के अंदर|से कम)\s*(?:rs\.?\s*|₹)?\s*(\d+)/i);
  if (budgetMatch) {
    budget.max = parseInt(budgetMatch[1], 10);
  }
  const budgetMinMatch = lower.match(/(?:above|over|more than|min|start from|से ऊपर)\s*(?:rs\.?\s*|₹)?\s*(\d+)/i);
  if (budgetMinMatch) {
    budget.min = parseInt(budgetMinMatch[1], 10);
  }
  const rangeMatch = lower.match(/(?:rs\.?\s*|₹)?(\d+)\s*(?:-|to|से)\s*(?:rs\.?\s*|₹)?(\d+)/i);
  if (rangeMatch) {
    budget.min = parseInt(rangeMatch[1], 10);
    budget.max = parseInt(rangeMatch[2], 10);
  }

  for (const [key, patterns] of Object.entries(URGENCY_KEYWORDS)) {
    if (patterns.some((p) => lower.includes(p))) {
      urgency = key as ParsedIntent["urgency"];
      break;
    }
  }

  const isSellIntent = /\b(sell|selling|list|offer for sale)\b/.test(lower);
  const isBuyIntent = /\b(buy|purchase|need|want)\b/.test(lower) || tokens.some((t) => ["buy", "purchase"].includes(t));
  const isPostIntent = /\b(post|create|list|offer|need help)\b/.test(lower) && !isSellIntent;
  const isOrderCheck = /\b(my orders|order status|my purchases|track order)\b/.test(lower);
  const isInventory = /\b(inventory|stock|add.*stock|update.*stock|my products|my catalog)\b/.test(lower);
  const isBusiness = /\b(my business|my profile|my listing|my services|dashboard)\b/.test(lower);
  const isHelp = /\b(help|how do i|how to|guide|support)\b/.test(lower);
  const isServiceList = /\b(my services|my offerings|what i offer)\b/.test(lower);

  if (isOrderCheck) action = "check_orders";
  else if (isInventory) action = "manage_inventory";
  else if (isBusiness) action = "manage_business";
  else if (isServiceList) action = "list_services";
  else if (isSellIntent) action = "sell_product";
  else if (isPostIntent) action = "post_need";
  else if (isBuyIntent) action = "buy_product";
  else if (isHelp) action = "get_help";

  for (const [cat, langs] of Object.entries(CATEGORY_KEYWORDS)) {
    const allKeywords = [...langs.en, ...langs.hi];
    if (allKeywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      category = cat;
      break;
    }
  }

  const location = extractLocation(lower);

  const parsed: ParsedIntent = {
    action,
    category,
    subcategory: null,
    urgency,
    location,
    budget,
    keywords: tokens.filter((t) => t.length > 2),
    originalQuery: query,
    response: "",
  };
  parsed.response = buildResponse(parsed);
  return parsed;
}

function buildResponse(intent: ParsedIntent): string {
  const prefix = intent.urgency === "now" ? "⚡ Urgent! " : "";
  const locationSuffix = intent.location ? ` near **${intent.location}**` : " near you";
  const budgetSuffix = intent.budget.max ? ` within ₹${intent.budget.max}` : intent.budget.min ? ` starting from ₹${intent.budget.min}` : "";

  const categoryLabel = intent.category
    ? intent.category.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
    : null;

  switch (intent.action) {
    case "find_service":
    case "find_provider":
      if (categoryLabel) {
        return `${prefix}Showing **${categoryLabel}** providers${locationSuffix}${budgetSuffix}. Tap to browse available services.`;
      }
      return `${prefix}Showing service providers${locationSuffix}${budgetSuffix}.`;

    case "buy_product":
      if (categoryLabel) {
        return `${prefix}Showing **${categoryLabel}** products${locationSuffix}${budgetSuffix}. Browse and order with delivery available.`;
      }
      return `${prefix}Showing products available${locationSuffix}${budgetSuffix}.`;

    case "post_need":
      return `${prefix}Ready to post your need. Describe what you need and nearby providers will respond.`;

    case "sell_product":
      return `Ready to list your product. Tell us what you're selling and at what price.`;

    case "manage_inventory":
      return `Opening your inventory manager. You can add stock, update prices, or manage your catalog.`;

    case "check_orders":
      return `Fetching your orders and their current status.`;

    case "list_services":
      return `Showing your current service listings. You can update prices, availability, or add new ones.`;

    case "manage_business":
      return `Taking you to your business dashboard where you can manage your profile, listings, and analytics.`;

    case "get_help":
      return "How can we help you? You can browse services, post a need, buy products, or manage your business.";
  }

  return `How can we help you${locationSuffix}?`;
}

const intentSchema = z.object({
  action: z.enum([
    "find_service", "buy_product", "post_need", "sell_product",
    "manage_inventory", "get_help", "check_orders", "list_services",
    "manage_business", "find_provider",
  ]),
  category: z.string().nullable(),
  subcategory: z.string().nullable(),
  urgency: z.enum(["now", "today", "this_week", "flexible"]).nullable(),
  location: z.string().nullable(),
  budget: z.object({ min: z.number().nullable(), max: z.number().nullable() }),
  keywords: z.array(z.string()),
});

export async function parseIntentWithLLM(query: string): Promise<ParsedIntent | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const result = await generate({
      prompt: `Parse this user query from an Indian hyperlocal marketplace: "${query}"

Identify:
- action: what the user wants
- category: the service/product category (pick from: electrician, plumber, ac-repair, ro-repair, carpenter, painter, cleaning, appliance-repair, mobile-repair, bike-repair, computer-repair, tutor, tailor, beautician, photographer, delivery, grocery, pharmacy, electronics, furniture, salon, gym, caterer, event-planner, packers-movers, pest-control, laundry, hardware-store, electrical-shop, medical-store, general-store, or null)
- subcategory: more specific (or null)
- urgency: how urgent (now, today, this_week, flexible)
- location: any Indian city/locality mentioned (or null)
- budget: min/max in INR (or null)
- keywords: important search keywords`,
      schema: intentSchema,
      system: "You are a hyperlocal marketplace intent parser for India. Extract structured intent from natural language queries. Support Hinglish and colloquial Indian English.",
    });
    return { ...result, originalQuery: query, response: "" };
  } catch {
    return null;
  }
}

function parseIntent(query: string): ParsedIntent {
  const intent = matchKeywords(query);
  const response = buildResponse(intent);
  return { ...intent, response };
}

export async function parseIntentBest(query: string): Promise<ParsedIntent> {
  const llmResult = await parseIntentWithLLM(query);
  if (llmResult) {
    return { ...llmResult, response: buildResponse(llmResult) };
  }
  return parseIntent(query);
}

export { parseIntent };
