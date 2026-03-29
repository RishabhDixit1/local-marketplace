export type HelpRequestProgressStage =
  | "pending_acceptance"
  | "accepted"
  | "travel_started"
  | "work_started"
  | "completed";

export type HelpRequestTrackerStepKey = "accepted" | "travel_started" | "work_started" | "completed";
export type HelpRequestTrackerStepState = "done" | "active" | "upcoming" | "cancelled";

export type HelpRequestTrackerStep = {
  key: HelpRequestTrackerStepKey;
  label: string;
  state: HelpRequestTrackerStepState;
};

const validProgressStages = new Set<HelpRequestProgressStage>([
  "pending_acceptance",
  "accepted",
  "travel_started",
  "work_started",
  "completed",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isHelpRequestProgressStage = (value: unknown): value is HelpRequestProgressStage =>
  typeof value === "string" && validProgressStages.has(value as HelpRequestProgressStage);

export const normalizeHelpRequestProgressStage = (
  value: unknown,
  status?: string | null
): HelpRequestProgressStage | null => {
  const normalizedValue = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (isHelpRequestProgressStage(normalizedValue)) {
    return normalizedValue;
  }

  const normalizedStatus = typeof status === "string" ? status.trim().toLowerCase() : "";
  if (normalizedStatus === "completed") return "completed";
  if (normalizedStatus === "in_progress") return "work_started";
  if (normalizedStatus === "accepted") return "pending_acceptance";
  return null;
};

export const canCancelTrackedTaskAtStage = (stage: HelpRequestProgressStage | null | undefined) =>
  stage !== "work_started" && stage !== "completed";

export const isRelistedHelpRequest = (metadata: unknown) =>
  Boolean(isRecord(metadata) && metadata.relist_after_decline === true);

export const buildCancelledTrackerSteps = (stage: HelpRequestProgressStage | null | undefined): HelpRequestTrackerStep[] => {
  if (stage === "accepted") {
    return [
      { key: "accepted", label: "Task accepted", state: "done" },
      { key: "travel_started", label: "Travel started", state: "cancelled" },
    ];
  }

  if (stage === "travel_started") {
    return [
      { key: "accepted", label: "Task accepted", state: "done" },
      { key: "travel_started", label: "Travel started", state: "done" },
      { key: "work_started", label: "Work started", state: "cancelled" },
    ];
  }

  if (stage === "work_started") {
    return [
      { key: "accepted", label: "Task accepted", state: "done" },
      { key: "travel_started", label: "Travel started", state: "done" },
      { key: "work_started", label: "Work started", state: "done" },
      { key: "completed", label: "Work completed", state: "cancelled" },
    ];
  }

  return [{ key: "accepted", label: "Task accepted", state: "cancelled" }];
};

export const describeCancelledTrackerStage = (stage: HelpRequestProgressStage | null | undefined) => {
  if (stage === "accepted") {
    return "This task was cancelled before travel started.";
  }

  if (stage === "travel_started") {
    return "This task was cancelled before work started.";
  }

  if (stage === "work_started") {
    return "This task was cancelled after work started and before completion.";
  }

  return "This task was cancelled before task acceptance was confirmed in the tracker.";
};
