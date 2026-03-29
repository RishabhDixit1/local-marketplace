import { describe, expect, it } from "vitest";
import {
  buildCancelledTrackerSteps,
  canCancelTrackedTaskAtStage,
  normalizeHelpRequestProgressStage,
} from "../../lib/helpRequestProgress";

describe("help request progress helpers", () => {
  it("normalizes tracker stages from metadata or task status", () => {
    expect(normalizeHelpRequestProgressStage("accepted", "accepted")).toBe("accepted");
    expect(normalizeHelpRequestProgressStage(null, "accepted")).toBe("pending_acceptance");
    expect(normalizeHelpRequestProgressStage(undefined, "in_progress")).toBe("work_started");
    expect(normalizeHelpRequestProgressStage(undefined, "completed")).toBe("completed");
  });

  it("builds the cancelled tracker based on the last completed stage", () => {
    expect(buildCancelledTrackerSteps("pending_acceptance")).toEqual([
      { key: "accepted", label: "Task accepted", state: "cancelled" },
    ]);
    expect(buildCancelledTrackerSteps("accepted")).toEqual([
      { key: "accepted", label: "Task accepted", state: "done" },
      { key: "travel_started", label: "Travel started", state: "cancelled" },
    ]);
    expect(buildCancelledTrackerSteps("travel_started")).toEqual([
      { key: "accepted", label: "Task accepted", state: "done" },
      { key: "travel_started", label: "Travel started", state: "done" },
      { key: "work_started", label: "Work started", state: "cancelled" },
    ]);
  });

  it("blocks cancellation once work has started", () => {
    expect(canCancelTrackedTaskAtStage("pending_acceptance")).toBe(true);
    expect(canCancelTrackedTaskAtStage("accepted")).toBe(true);
    expect(canCancelTrackedTaskAtStage("travel_started")).toBe(true);
    expect(canCancelTrackedTaskAtStage("work_started")).toBe(false);
    expect(canCancelTrackedTaskAtStage("completed")).toBe(false);
  });
});
