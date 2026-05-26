import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { NextResponse } from "next/server";
import { cleanSiteUrl, resolveAuthCallbackUrl } from "@/lib/siteUrl";
import { applyRateLimit, AUTH_ROUTE_CONFIG } from "@/lib/server/rateLimit";
import {
  getLastMagicLinkRequestAt,
  MAGIC_LINK_COOLDOWN_MS,
  pruneExpiredMagicLinkCooldowns,
  recordMagicLinkRequest,
} from "./cooldown";

export const runtime = "nodejs";

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

type GenerateLinkResponse = {
  action_link?: string;
  email_otp?: string;
  hashed_token?: string;
  id?: string;
  error?: string;
  msg?: string;
};

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

const buildMagicLinkEmailHtml = ({
  appName,
  actionLink,
  otpCode,
}: {
  appName: string;
  actionLink: string;
  otpCode: string;
}) => `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
<tr><td style="padding:32px 32px 0">
<h1 style="margin:0;font-size:20px;color:#1a1a2e">Sign in to ${appName}</h1>
<p style="margin:12px 0 0;font-size:14px;color:#666;line-height:1.5">Click the button below to sign in instantly.</p>
</td></tr>
<tr><td style="padding:24px 32px">
<a href="${actionLink}" style="display:inline-block;padding:14px 32px;background:#1a1a2e;color:#ffffff;text-decoration:none;border-radius:12px;font-size:15px;font-weight:600">Sign In to ${appName}</a>
</td></tr>
<tr><td style="padding:0 32px 24px;border-bottom:1px solid #eee">
<p style="margin:0;font-size:13px;color:#999">Or enter this code on the sign-in page:</p>
<p style="margin:8px 0 0;font-size:28px;font-weight:700;color:#1a1a2e;letter-spacing:6px">${otpCode}</p>
</td></tr>
<tr><td style="padding:16px 32px">
<p style="margin:0;font-size:12px;color:#aaa;line-height:1.4">This link and code expire in 24 hours. If you didn't request this, you can ignore this email.</p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`;

export async function POST(request: Request) {
  const supabaseUrlValue = cleanSiteUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

  if (!supabaseUrlValue || !serviceRoleKey) {
    return NextResponse.json(
      { ok: false, error: "Supabase environment variables are missing." },
      { status: 500 }
    );
  }

  let supabaseUrl: URL;
  try {
    supabaseUrl = new URL(supabaseUrlValue);
  } catch {
    return NextResponse.json({ ok: false, error: "NEXT_PUBLIC_SUPABASE_URL is invalid." }, { status: 500 });
  }

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

  const now = Date.now();
  pruneExpiredMagicLinkCooldowns(now);
  const previousRequestAt = getLastMagicLinkRequestAt(email);
  const retryAfterMs = MAGIC_LINK_COOLDOWN_MS - (now - previousRequestAt);
  if (retryAfterMs > 0) {
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    return NextResponse.json(
      {
        ok: false,
        error: `Please wait ${retryAfterSeconds} seconds before requesting another login link.`,
      },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const redirectTo = resolveAuthCallbackUrl({ request, requestedRedirectTo: body.redirectTo });

  const adminUrl = new URL("/auth/v1/admin/generate_link", supabaseUrl.origin);
  let generateResult: GenerateLinkResponse;
    try {
      const res = await fetch(adminUrl.toString(), {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: "magiclink", email, redirect_to: redirectTo }),
      });
      generateResult = (await res.json()) as GenerateLinkResponse;
      if (!res.ok || !generateResult.hashed_token) {
        throw new Error(generateResult.msg || generateResult.error || `GoTrue admin API error (${res.status})`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to generate magic link.";
      return NextResponse.json({ ok: false, error: message }, { status: 502 });
    }

    const actionLink = `${supabaseUrl.origin}/auth/v1/verify?${new URLSearchParams({
      token: generateResult.hashed_token,
      type: "magiclink",
      redirect_to: redirectTo,
    })}`;

    try {
      const appName = "ServiQ";
      const ses = new SESClient({ region: "ap-southeast-2" });
      await ses.send(
        new SendEmailCommand({
          Source: `"${appName}" <info@serviqapp.com>`,
          Destination: { ToAddresses: [email] },
          ReplyToAddresses: ["info@serviqapp.com"],
          Message: {
            Subject: { Data: `Your Magic Link to Sign In to ${appName}` },
            Body: {
              Html: {
                Data: buildMagicLinkEmailHtml({
                  appName,
                  actionLink,
                  otpCode: generateResult.email_otp!,
                }),
              },
            },
          },
        })
      );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send email.";
    if (/rate|throttl/i.test(message)) {
      return NextResponse.json({ ok: false, error: "Too many requests. Please try again later." }, { status: 429 });
    }
    if (/not.verified|sandbox|not.authorized|could not load credentials/i.test(message)) {
      return NextResponse.json({
        ok: true,
        emailSent: false,
        actionLink,
        emailOtp: generateResult.email_otp,
        message: "Email delivery unavailable. Use the link or code below to sign in.",
      });
    }
    return NextResponse.json(
      { ok: false, error: `Failed to send email. ${message}` },
      { status: 502 }
    );
  }

  recordMagicLinkRequest(email);
  return NextResponse.json({ ok: true, emailSent: true });
}
