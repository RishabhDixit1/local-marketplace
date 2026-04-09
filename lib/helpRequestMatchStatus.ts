export type CanonicalHelpRequestMatchStatus =
  | "interested"
  | "accepted"
  | "in_progress"
  | "completed"
  | "withdrawn"
  | "rejected"
  | "cancelled";

export type HelpRequestMatchWriteTarget = "interested" | "active_pool" | "withdrawn" | "rejected";

const HELP_REQUEST_MATCH_STATUS_WRITE_CANDIDATES: Record<HelpRequestMatchWriteTarget, readonly string[]> = {
  interested: ["interested", "open", "suggested"],
  active_pool: ["open", "suggested"],
  withdrawn: ["withdrawn", "cancelled", "expired", "declined"],
  rejected: ["rejected", "declined", "cancelled"],
};

export const getHelpRequestMatchStatusWriteCandidates = (target: HelpRequestMatchWriteTarget) =>
  HELP_REQUEST_MATCH_STATUS_WRITE_CANDIDATES[target];

export const isHelpRequestMatchStatusConstraintError = (message?: string | null) => {
  const normalized = (message || "").toLowerCase();
  return (
    normalized.includes("help_request_matches_status_check") ||
    (normalized.includes("help_request_matches") && normalized.includes("check constraint")) ||
    normalized.includes("violates check constraint")
  );
};

export const canonicalizeStoredHelpRequestMatchStatus = (
  value?: string | null
): CanonicalHelpRequestMatchStatus | null => {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return null;

  switch (normalized) {
    case "interested":
    case "open":
    case "suggested":
      return "interested";
    case "accepted":
      return "accepted";
    case "in_progress":
      return "in_progress";
    case "completed":
      return "completed";
    case "withdrawn":
    case "expired":
      return "withdrawn";
    case "rejected":
    case "declined":
      return "rejected";
    case "cancelled":
    case "canceled":
      return "cancelled";
    default:
      return null;
  }
};
