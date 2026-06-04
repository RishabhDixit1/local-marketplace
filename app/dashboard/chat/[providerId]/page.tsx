"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ChatWithProviderRedirect() {
  const router = useRouter();
  const params = useParams();
  const providerId = params.providerId as string;

  useEffect(() => {
    router.replace(`/dashboard/chat?providerId=${encodeURIComponent(providerId)}`);
  }, [router, providerId]);

  return (
    <div className="flex items-center justify-center py-20 text-sm text-slate-400">
      Opening chat...
    </div>
  );
}
