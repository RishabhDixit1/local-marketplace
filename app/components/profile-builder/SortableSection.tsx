"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";
import SectionCard from "./SectionCard";
import type { ProfileSectionRecord } from "@/lib/profile/marketplace";
import { PROFILE_SECTION_LABELS } from "@/lib/profile/marketplace";

export default function SortableSection({
  section,
  onToggleVisible,
  children,
}: {
  section: ProfileSectionRecord;
  onToggleVisible: () => void;
  children?: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: section.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <SectionCard
        title={PROFILE_SECTION_LABELS[section.section_type]}
        sectionType={section.section_type}
        visible={section.is_visible}
        onToggleVisible={onToggleVisible}
      >
        {children}
      </SectionCard>
    </div>
  );
}
