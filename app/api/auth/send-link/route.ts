import { NextResponse } from "next/server";
import { applyRateLimit, AUTH_ROUTE_CONFIG } from "@/lib/server/rateLimit";
import { withErrorHandling } from "@/lib/server/errorHandler";
import { createOtp } from "@/lib/server/otpStore";
import { FROM_EMAIL } from "@/lib/emailConfig";

export const runtime = "nodejs";

// ServiQ is open to all signups. The built-in blocked lists below prevent
// placeholder/abuse emails (example.com, disposable domains). The env-var
// overrides (AUTH_MAGIC_LINK_ALLOWED_RECIPIENTS / BLOCKED_DOMAINS /
// BLOCKED_RECIPIENTS) are additive / optional — when unset, signup remains
// unrestricted for all real email addresses. This is intentional.
const BUILTIN_BLOCKED_MAGIC_LINK_RECIPIENTS = new Set([
  "test@example.com",
  "user@example.com",
  "demo@example.com",
  "admin@example.com",
]);
const BUILTIN_BLOCKED_MAGIC_LINK_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "mailinator.com",
  "guerrillamail.com",
  "sharklasers.com",
  "tempmail.com",
  "temp-mail.org",
  "10minutemail.com",
  "yopmail.com",
  "discard.email",
]);

type SendLinkBody = { email?: string; redirectTo?: string };

const isEmailLike = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const normalizeRecipientEntry = (value: string) => value.trim().toLowerCase();
const parseRecipientList = (value: string | undefined | null) =>
  new Set(
    (value || "")
      .split(",")
      .map((entry) => normalizeRecipientEntry(entry))
      .filter(Boolean)
  );
const getEmailDomain = (email: string) => normalizeRecipientEntry(email.split("@")[1] || "");
const recipientMatchesSet = (email: string, entries: Set<string>) => {
  const normalizedEmail = normalizeRecipientEntry(email);
  const domain = getEmailDomain(normalizedEmail);
  return entries.has(normalizedEmail) || entries.has(domain) || entries.has(`@${domain}`);
};

const resolveMagicLinkRecipientError = (email: string) => {
  const blockedRecipients = new Set([
    ...BUILTIN_BLOCKED_MAGIC_LINK_RECIPIENTS,
    ...parseRecipientList(process.env.AUTH_MAGIC_LINK_BLOCKED_RECIPIENTS),
  ]);
  const blockedDomains = new Set([
    ...BUILTIN_BLOCKED_MAGIC_LINK_DOMAINS,
    ...parseRecipientList(process.env.AUTH_MAGIC_LINK_BLOCKED_DOMAINS),
  ]);
  const allowedRecipients = parseRecipientList(process.env.AUTH_MAGIC_LINK_ALLOWED_RECIPIENTS);

  if (blockedRecipients.has(email) || blockedDomains.has(getEmailDomain(email)) || recipientMatchesSet(email, blockedRecipients)) {
    return "Use a real inbox. Placeholder, disposable, or blocked email addresses cannot receive login links.";
  }
  if (allowedRecipients.size > 0 && !recipientMatchesSet(email, allowedRecipients)) {
    return "This email address is not approved for magic-link sign-in in this environment.";
  }
  return null;
};

async function postHandler(request: Request) {
  let body: SendLinkBody;
  try {
    body = (await request.json()) as SendLinkBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request payload." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  if (!isEmailLike(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  }

  const rateLimitCheck = await applyRateLimit(null, "auth:send-link", AUTH_ROUTE_CONFIG);
  if (rateLimitCheck.limited) {
    return rateLimitCheck.response as NextResponse;
  }

  const recipientError = resolveMagicLinkRecipientError(email);
  if (recipientError) {
    return NextResponse.json({ ok: false, error: recipientError }, { status: 400 });
  }

  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (!resendKey) {
    return NextResponse.json({ ok: false, error: "Email delivery unavailable. Resend is not configured." }, { status: 502 });
  }

  const { otp } = createOtp(email);

  const fromEmail = FROM_EMAIL;
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const html = `<div style="font-family:Inter,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#0f172a">
    <div style="margin-bottom:24px"><span style="font-size:20px;font-weight:700;color:#2563eb">ServiQ</span></div>
    <h2 style="font-size:18px;font-weight:700;margin:0 0 8px">Your Verification Code</h2>
    <p style="color:#475569">Use the code below to sign in:</p>
    <div style="background:#f1f5f9;border-radius:12px;padding:24px;text-align:center;margin:20px 0;font-size:32px;font-weight:700;letter-spacing:8px;color:#0f172a;font-family:monospace">${otp}</div>
    <p style="color:#475569;font-size:14px">This code expires in 10 minutes.</p>
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8">
      <a href="${appUrl}" style="color:#2563eb">ServiQ</a>
    </div>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: fromEmail, to: email, subject: "Your ServiQ verification code", html }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[send-link] Resend error:", res.status, body);
      return NextResponse.json({ ok: false, error: "Unable to send verification code via email." }, { status: 502 });
    }
  } catch (sendError) {
    console.error("[send-link] Resend fetch error:", sendError);
    return NextResponse.json({ ok: false, error: "Unable to send verification code. Check your network connection." }, { status: 502 });
  }

  return NextResponse.json({ ok: true, emailSent: true });
}

export const POST = withErrorHandling(postHandler, "auth:send-link");
