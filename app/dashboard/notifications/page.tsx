"use client";

import { useMemo, useState } from "react";
import NotificationCenter from "@/app/components/NotificationCenter";
import PageContextStrip from "@/app/components/PageContextStrip";
import RouteObservability from "@/app/components/RouteObservability";
import type { DashboardPromptConfig } from "@/app/components/prompt/DashboardPromptContext";
import { useDashboardPrompt } from "@/app/components/prompt/DashboardPromptContext";
import { useProfileContext } from "@/app/components/profile/ProfileContext";

export default function NotificationsPage() {
  const { user } = useProfileContext();
  const [searchQuery, setSearchQuery] = useState("");

  const notificationPromptConfig = useMemo<DashboardPromptConfig>(
    () => ({
      placeholder: "Search notifications by title, message, type, or action",
      value: searchQuery,
      onValueChange: setSearchQuery,
    }),
    [searchQuery]
  );

  useDashboardPrompt(notificationPromptConfig);

  return (
    <div className="mx-auto w-full max-w-[1040px] space-y-4">
      <RouteObservability route="notifications" />

      <PageContextStrip
        label="Notifications"
        description="Track chat replies, quotes, connection requests, and task updates in one live inbox."
        action={{ label: "Open Chat", href: "/dashboard/chat" }}
        switchAction={{ label: "Open Tasks", href: "/dashboard/tasks" }}
      />

      <NotificationCenter
        enabled={Boolean(user?.id)}
        userId={user?.id ?? null}
        renderMode="page"
        filterQuery={searchQuery}
      />
    </div>
  );
}
