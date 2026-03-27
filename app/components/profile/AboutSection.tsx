"use client";

import PublicProfileAbout from "@/app/components/profile/PublicProfileAbout";

export default function AboutSection({ bio }: { bio: string | null }) {
  return (
    <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-lg shadow-slate-200/50 sm:p-6">
      <PublicProfileAbout bio={bio} />
    </section>
  );
}
