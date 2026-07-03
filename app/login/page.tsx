import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/metadata";
import { appName } from "@/lib/branding";
import { LoginPageClient } from "@/app/components/login/LoginPageClient";

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    title: `Sign In | ${appName}`,
    description: "Sign in to ServiQ — your local marketplace & help app.",
  });
}

export default function LoginPage() {
  return <LoginPageClient />;
}
