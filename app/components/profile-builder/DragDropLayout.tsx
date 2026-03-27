"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Check, Loader2, Save, Shuffle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { ProfileSectionRecord } from "@/lib/profile/marketplace";
import { sortProfileSections } from "@/lib/profile/marketplace";
import SortableSection from "./SortableSection";
import { PROFILE_SECTION_LABELS } from "@/lib/profile/marketplace";

export default function DragDropLayout({
  profileId,
  initialSections,
}: {
  profileId: string;
  initialSections: ProfileSectionRecord[];
}) {
  const [sections, setSections] = useState<ProfileSectionRecord[]>(() => sortProfileSections(initialSections));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    setSections(sortProfileSections(initialSections));
  }, [initialSections]);

  useEffect(() => {
    if (!notice) return;
    const timerId = window.setTimeout(() => setNotice(null), 2500);
    return () => window.clearTimeout(timerId);
  }, [notice]);

  const sortedIds = useMemo(() => sections.map((section) => section.id), [sections]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setSections((current) => {
      const oldIndex = current.findIndex((section) => section.id === active.id);
      const newIndex = current.findIndex((section) => section.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return current;
      return arrayMove(current, oldIndex, newIndex).map((section, index) => ({
        ...section,
        section_order: index,
      }));
    });
  }, []);

  const handleToggleVisible = useCallback((sectionId: string) => {
    setSections((current) =>
      current.map((section) =>
        section.id === sectionId ? { ...section, is_visible: !section.is_visible } : section
      )
    );
  }, []);

  const handleReset = useCallback(() => {
    setSections(sortProfileSections(initialSections));
    setNotice("Layout reset to the current saved state.");
  }, [initialSections]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setNotice(null);

    try {
      const payload = sections.map((section, index) => ({
        profile_id: profileId,
        section_type: section.section_type,
        section_order: index,
        is_visible: section.is_visible,
      }));

      const { error } = await supabase
        .from("profile_sections")
        .upsert(payload, { onConflict: "profile_id,section_type" });

      if (error) {
        throw error;
      }

      setNotice("Profile layout saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save layout.");
    } finally {
      setSaving(false);
    }
  }, [profileId, sections]);

  return (
    <section className="space-y-5">
      <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-lg shadow-slate-200/50 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Layout</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Drag & drop profile sections</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Reorder what visitors see first, hide sections you do not want public, and save the result back to Supabase.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
            >
              <Shuffle className="h-4 w-4" />
              Reset
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving..." : "Save layout"}
            </button>
          </div>
        </div>

        {notice ? (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
            <Check className="h-4 w-4" />
            {notice}
          </div>
        ) : null}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortedIds} strategy={verticalListSortingStrategy}>
          <div className="grid gap-4">
            {sections.map((section) => (
              <SortableSection key={section.id} section={section} onToggleVisible={() => handleToggleVisible(section.id)}>
                <p className="text-sm leading-6 text-slate-600">
                  {PROFILE_SECTION_LABELS[section.section_type]} will render in this order on the public profile page.
                </p>
              </SortableSection>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}
