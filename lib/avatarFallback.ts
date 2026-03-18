const svgToDataUri = (svg: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

const sanitizeLabel = (value: string) => value.replace(/[<>&"]/g, "");

const hashValue = (seed: string) => {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
};

const palette = [
  ["#0f766e", "#0f172a"],
  ["#0f766e", "#1d4ed8"],
  ["#334155", "#0f766e"],
  ["#1d4ed8", "#0f172a"],
  ["#0f172a", "#475569"],
] as const;

const getInitials = (value: string) => {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "SQ";

  const initials = parts.map((part) => part[0]?.toUpperCase() || "").join("");
  return initials || "SQ";
};

export const createAvatarFallback = (params: { label?: string | null; seed?: string | null }) => {
  const label = sanitizeLabel(params.label?.trim() || "ServiQ");
  const seed = `${params.seed || ""}:${label}`;
  const paletteIndex = hashValue(seed) % palette.length;
  const [startColor, endColor] = palette[paletteIndex];
  const initials = getInitials(label);

  return svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="${label}">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${startColor}" />
          <stop offset="100%" stop-color="${endColor}" />
        </linearGradient>
      </defs>
      <rect width="96" height="96" rx="24" fill="url(#g)" />
      <text
        x="50%"
        y="54%"
        text-anchor="middle"
        dominant-baseline="middle"
        font-family="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        font-size="34"
        font-weight="700"
        fill="#ffffff"
      >
        ${initials}
      </text>
    </svg>
  `);
};
