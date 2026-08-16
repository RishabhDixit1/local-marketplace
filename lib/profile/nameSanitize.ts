/**
 * Conservative display-name sanitizer.
 *
 * Real-world data occasionally contains mangled person names produced by
 * client-side concatenation (e.g. `chaturvedChakori ChaturvediichakoriC`
 * instead of `Chaturvedi Chakori`). These values are stored verbatim in the
 * DB, so we sanitize defensively at read/display time.
 *
 * The transform is intentionally narrow: it only rewrites a value that shows
 * hard evidence of concatenation -- a camelCase boundary PLUS word tokens
 * that repeat with different casing or that are case-insensitive substrings of
 * one another across a casing boundary. Genuine names and business titles
 * (including camel-cased brands like `BrightFixIndia`, repeated words in
 * `AquaRepublik RO Service (Crossing Republik)`, or `ServiQ E2E User`) pass
 * through unchanged.
 */
export const cleanPersonName = (
  value: string | null | undefined,
): string => {
  const raw = (value || "").replace(/\s+/g, " ").trim();
  if (!raw || raw.length > 80) return raw;

  const tokens = raw
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter((token) => /[A-Za-z]/.test(token));
  if (tokens.length < 2) return raw;

  const lowered = tokens.map((token) => token.toLowerCase());
  const caseVariantDuplicate = lowered.some((token, index) => {
    const firstIndex = lowered.indexOf(token);
    return firstIndex !== index && tokens[firstIndex] !== tokens[index];
  });
  const substringAcrossCasing = lowered.some((token, index) =>
    lowered.some((other, otherIndex) => {
      if (otherIndex === index) return false;
      return (
        token.length >= 3 &&
        other.length > token.length &&
        other.includes(token) &&
        tokens[otherIndex] !== tokens[index]
      );
    }),
  );

  if (
    !/[a-z][A-Z]/.test(raw) ||
    (!caseVariantDuplicate && !substringAcrossCasing)
  ) {
    return raw;
  }

  const kept = tokens
    .map((token, index) => ({ token, low: lowered[index], index }))
    .filter(({ low }) => low.length >= 2)
    .filter(
      ({ low, index }, _, all) =>
        !all.some(
          (other) =>
            other.index !== index &&
            other.low !== low &&
            low.includes(other.low),
        ),
    )
    .filter(
      ({ low }, index, all) =>
        all.findIndex((other) => other.low === low) === index,
    )
    .sort((left, right) => left.index - right.index);

  const result = kept
    .map(({ token }) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");

  return result.length >= 2 ? result : raw;
};
