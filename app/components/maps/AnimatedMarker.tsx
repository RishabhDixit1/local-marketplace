"use client";

import { memo } from "react";
import type { RealtimePinPhase } from "@/app/components/maps/types";

type AnimatedMarkerProps = {
  active: boolean;
  selected: boolean;
  phase: RealtimePinPhase;
  urgent: boolean;
};

function AnimatedMarker({ active, selected, phase, urgent }: AnimatedMarkerProps) {
  return (
    <span
      aria-hidden="true"
      className={`command-center-marker ${active ? "is-active" : ""} ${selected ? "is-selected" : ""} ${
        urgent ? "is-urgent" : ""
      }`}
      data-phase={phase}
    >
      <span className="command-center-marker__anchor">
        <span className="command-center-marker__ripple command-center-marker__ripple--one" />
        <span className="command-center-marker__ripple command-center-marker__ripple--two" />
        <span className="command-center-marker__ripple command-center-marker__ripple--three" />
        <span className="command-center-marker__glow" />
        <span className="command-center-marker__core" />
      </span>
    </span>
  );
}

export default memo(AnimatedMarker);
