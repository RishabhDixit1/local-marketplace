import https from "node:https";
import { Resolver, promises as dnsPromises } from "node:dns";
import { NextResponse } from "next/server";
import { cleanSiteUrl, resolveAuthCallbackUrl } from "@/lib/siteUrl";
import {
  getLastMagicLinkRequestAt,
  MAGIC_LINK_COOLDOWN_MS,
  pruneExpiredMagicLinkCooldowns,
  recordMagicLinkRequest,
} from "./cooldown";

export const runtime = "nodejs";

const REQUEST_TIMEOUT_MS = 8000;
const PUBLIC_DNS_SERVERS = ["1.1.1.1", "8.8.8.8"];
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

type SendLinkBody = {
  email?: string;
  redirectTo?: string;
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

const resolveIpv4ViaPublicDns = (host: string): Promise<string[]> =>
  new Promise((resolve, reject) => {
    const resolver = new Resolver();
    resolver.setServers(PUBLIC_DNS_SERVERS);
    resolver.resolve4(host, (error, addresses) => {
      if (error || !addresses?.length) {
        reject(error ?? new Error(`No IPv4 records found for ${host}.`));
        return;
      }
      resolve(addresses);
    });
  });

const resolveIpv4Candidates = async (host: string): Promise<string[]> => {
  const candidates = new Set<string>();

  try {
    const systemResolved = await dnsPromises.lookup(host, { all: true, family: 4 });
    for (const entry of systemResolved) {
      if (entry.address) {
        candidates.add(entry.address);
      }
    }
  } catch {
    // Continue to public resolvers below.
  }

  try {
    const publicResolved = await resolveIpv4ViaPublicDns(host);
    for (const address of publicResolved) {
      if (address) {
        candidates.add(address);
      }
    }
  } catch {
    // Keep the system DNS results if we have them.
  }

  return Array.from(candidates);
};

const postOtpRequest = ({
  hostname,
  hostHeader,
  path,
  anonKey,
  payload,
  servername = hostHeader,
}: {
  hostname: string;
  hostHeader: string;
  path: string;
  anonKey: string;
  payload: string;
  servername?: string;
}): Promise<{ status: number; body: string }> =>
  new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname,
        port: 443,
        family: 4,
        method: "POST",
        path,
        servername,
        headers: {
          Host: hostHeader,
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload).toString(),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => {
          resolve({
            status: response.statusCode ?? 502,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );

    const timeoutId = setTimeout(() => {
      request.destroy(new Error("Supabase auth request timed out."));
    }, REQUEST_TIMEOUT_MS);

    request.on("error", (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });

    request.on("close", () => {
      clearTimeout(timeoutId);
    });

    request.write(payload);
    request.end();
  });

const postOtpThroughResolvedIps = async ({
  ips,
  host,
  path,
  anonKey,
  payload,
}: {
  ips: string[];
  host: string;
  path: string;
  anonKey: string;
  payload: string;
}): Promise<{ status: number; body: string }> => {
  let lastError: Error | null = null;

  for (const ip of ips) {
    try {
      return await postOtpRequest({
        hostname: ip,
        hostHeader: host,
        path,
        anonKey,
        payload,
        servername: host,
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Resolved IP auth request failed.");
    }
  }

  throw lastError ?? new Error(`No reachable IPv4 addresses found for ${host}.`);
};

const extractAuthErrorMessage = (rawBody: string, fallback: string): string => {
  try {
    const parsed = JSON.parse(rawBody) as {
      message?: string;
      msg?: string;
      error?: string;
      error_description?: string;
    };
    const message =
      parsed.message || parsed.msg || parsed.error_description || (typeof parsed.error === "string" ? parsed.error : "");

    return message?.trim() || fallback;
  } catch {
    return rawBody.trim() || fallback;
  }
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

export async function POST(request: Request) {
  const isDevelopment = process.env.NODE_ENV !== "production";
  const supabaseUrlValue = cleanSiteUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

  if (!supabaseUrlValue || !anonKey) {
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
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
        },
      }
    );
  }

  const redirectTo = resolveAuthCallbackUrl({
    request,
    requestedRedirectTo: body.redirectTo,
  });
  const otpUrl = new URL("/auth/v1/otp", supabaseUrl.origin);
  otpUrl.searchParams.set("redirect_to", redirectTo);

  if (isDevelopment) {
    console.info(`[auth/send-link] redirect_to=${redirectTo}`);
  }

  const payload = JSON.stringify({
    email,
    create_user: true,
  });

  let status: number;
  let rawBody = "";

  try {
    const directResponse = await postOtpRequest({
      hostname: supabaseUrl.hostname,
      hostHeader: supabaseUrl.hostname,
      path: `${otpUrl.pathname}${otpUrl.search}`,
      anonKey,
      payload,
    });
    status = directResponse.status;
    rawBody = directResponse.body;
  } catch {
    try {
      const resolvedIps = await resolveIpv4Candidates(supabaseUrl.hostname);
      const fallbackResponse = await postOtpThroughResolvedIps({
        ips: resolvedIps,
        host: supabaseUrl.hostname,
        path: `${otpUrl.pathname}${otpUrl.search}`,
        anonKey,
        payload,
      });
      status = fallbackResponse.status;
      rawBody = fallbackResponse.body;
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: `Supabase auth network request failed for ${supabaseUrl.hostname}. Check DNS, VPN, firewall, and retry.`,
        },
        { status: 503 }
      );
    }
  }

  if (status >= 200 && status < 300) {
    recordMagicLinkRequest(email);
    return NextResponse.json(isDevelopment ? { ok: true, redirectTo } : { ok: true });
  }

  const message = extractAuthErrorMessage(rawBody, `Unable to send login link right now (${status}).`);
  const responseStatus = status >= 400 && status <= 599 ? status : 502;

  return NextResponse.json(
    {
      ok: false,
      error: message,
    },
    { status: responseStatus }
  );
}
