type Strictness = "strict" | "relaxed";

interface ModerationResult {
  safe: boolean;
  reason?: string;
  sanitized?: string;
}

const PROFANITY_LIST = [
  "fuck",
  "shit",
  "ass",
  "bitch",
  "damn",
  "cunt",
  "dick",
  "bastard",
  "piss",
  "slut",
  "whore",
  "cock",
];

const PHONE_PATTERN = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const URL_ONLY_PATTERN = /^https?:\/\/\S+$/i;
const REPETITIVE_SPAM_PATTERN = /(.+?)\1{4,}/;

function hasProfanity(query: string, strictness: Strictness): string | null {
  const lower = query.toLowerCase();
  const list = strictness === "strict" ? PROFANITY_LIST : PROFANITY_LIST.slice(0, 6);
  for (const word of list) {
    const regex = strictness === "strict"
      ? new RegExp(`\\b${word}\\w*\\b`, "i")
      : new RegExp(`\\b${word}\\b`, "i");
    if (regex.test(lower)) return word;
  }
  return null;
}

function hasPhoneNumber(query: string): string | null {
  const match = query.match(PHONE_PATTERN);
  if (match) {
    const stripped = match[0].replace(/[\s.-]/g, "");
    const digits = stripped.replace(/\D/g, "");
    if (digits.length >= 7 && digits.length <= 15) return match[0];
  }
  return null;
}

function hasEmail(query: string): string | null {
  const match = query.match(EMAIL_PATTERN);
  return match ? match[0] : null;
}

function isUrlOnly(query: string): boolean {
  return URL_ONLY_PATTERN.test(query.trim());
}

function isRepetitiveSpam(query: string): boolean {
  return REPETITIVE_SPAM_PATTERN.test(query);
}

function redactAll(query: string, patterns: RegExp[]): string {
  let result = query;
  for (const pattern of patterns) {
    result = result.replace(pattern, "[redacted]");
  }
  return result;
}

export function moderatePrompt(
  query: string,
  strictness: Strictness = "strict",
): ModerationResult {
  if (!query || typeof query !== "string") {
    return { safe: false, reason: "Empty or invalid query" };
  }

  if (isUrlOnly(query)) {
    return { safe: false, reason: "Message contains only a URL" };
  }

  if (isRepetitiveSpam(query)) {
    return { safe: false, reason: "Repetitive spam detected" };
  }

  if (strictness === "strict") {
    if (query.length > 1000) {
      return { safe: false, reason: "Query exceeds maximum length" };
    }
  }

  const profanity = hasProfanity(query, strictness);
  const phone = hasPhoneNumber(query);
  const email = hasEmail(query);

  const issues: string[] = [];
  if (profanity) issues.push("profanity");
  if (phone) issues.push("phone number");
  if (email) issues.push("email address");

  if (issues.length > 0) {
    const redacted = redactAll(query, [PHONE_PATTERN, EMAIL_PATTERN]);
    const profanityList = strictness === "strict" ? PROFANITY_LIST : PROFANITY_LIST.slice(0, 6);
    const profanityPatterns = profanityList.map((w) => new RegExp(`\\b${w}\\w*\\b`, "gi"));
    const finalRedacted = redactAll(redacted, profanityPatterns);

    return {
      safe: true,
      sanitized: finalRedacted,
      reason: `Content redacted: ${issues.join(", ")}`,
    };
  }

  return { safe: true };
}
