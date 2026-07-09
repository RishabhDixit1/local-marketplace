"use client";

import { PageMeta } from "@/app/components/PageMeta";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ReferralHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      localStorage.setItem("referral_code", code);
    }
    router.replace("/");
  }, [router, searchParams]);

  return null;
}

export default function ReferralPage() {
  return (
    <>
      <PageMeta title="Referral" description="Join ServiQ and earn rewards" />
      <Suspense>
        <ReferralHandler />
      </Suspense>
    </>
  );
}
