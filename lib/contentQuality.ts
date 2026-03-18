const PLACEHOLDER_TEXT_PATTERN =
  /\b(demo|sample|seed(?:ed)?|placeholder|dummy|fake|mock|test|temp|lorem|ipsum)\b/i;

const KEYBOARD_MASH_PATTERN = /(asdf|qwer|zxcv|hjkl|sdfg|dsaf|sdfs|xcad|tmynr|hbtgr|fvcg|gaewg|sdga)/i;

const normalizeText = (value: string | null | undefined) => value?.replace(/\s+/g, " ").trim() || "";

const countVowels = (value: string) => (value.match(/[aeiou]/gi) || []).length;

const looksLikeGarbageToken = (value: string) => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return false;
  if (PLACEHOLDER_TEXT_PATTERN.test(normalized) || KEYBOARD_MASH_PATTERN.test(normalized)) return true;
  if (normalized.length < 5 || normalized.includes(" ")) return false;

  const vowelRatio = countVowels(normalized) / normalized.length;
  return vowelRatio < 0.2;
};

export const looksLikePlaceholderText = (value: string | null | undefined) => {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  if (PLACEHOLDER_TEXT_PATTERN.test(normalized) || KEYBOARD_MASH_PATTERN.test(normalized)) return true;
  if (/^[a-z0-9]{10,}$/i.test(normalized)) return true;
  if (/^(.)\1{4,}$/i.test(normalized)) return true;

  const tokens = normalized.toLowerCase().match(/[a-z]+/g) || [];
  if (!tokens.length) return false;

  const suspiciousTokens = tokens.filter(looksLikeGarbageToken).length;
  return suspiciousTokens >= Math.max(2, Math.ceil(tokens.length * 0.6));
};

export const toDisplayText = (value: string | null | undefined, fallback: string) => {
  const normalized = normalizeText(value);
  if (!normalized) return normalizeText(fallback);
  if (looksLikePlaceholderText(normalized)) return normalizeText(fallback);
  return normalized;
};

export const normalizeDisplayText = normalizeText;
