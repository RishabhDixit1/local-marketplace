import https from "node:https";
import { Resolver } from "node:dns";
import { NextResponse } from "next/server";
import { cleanSiteUrl, resolveAuthCallbackUrl } from "@/lib/siteUrl";

export const runtime = "nodejs";

const REQUEST_TIMEOUT_MS = 20000;
const PUBLIC_DNS_SERVERS = ["1.1.1.1", "8.8.8.8"];

type SendLinkBody = {
  email?: string;
  redirectTo?: string;
};

const isEmailLike = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const resolveIpv4ViaPublicDns = (host: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const resolver = new Resolver();
    resolver.setServers(PUBLIC_DNS_SERVERS);
    resolver.resolve4(host, (error, addresses) => {
      if (error || !addresses?.length) {
        reject(error ?? new Error(`No IPv4 records found for ${host}.`));
        return;
      }
      resolve(addresses[0]);
    });
  });

const postOtpThroughResolvedIp = ({
  ip,
  host,
  anonKey,
  payload,
}: {
  ip: string;
  host: string;
  anonKey: string;
  payload: string;
}): Promise<{ status: number; body: string }> =>
  new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: ip,
        port: 443,
        method: "POST",
        path: "/auth/v1/otp",
        servername: host,
        headers: {
          Host: host,
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

export async function POST(request: Request) {
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

  const email = body.email?.trim() ?? "";
  if (!isEmailLike(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  }

  const redirectTo = resolveAuthCallbackUrl({
    request,
    requestedRedirectTo: body.redirectTo,
  });

  const payload = JSON.stringify({
    email,
    create_user: true,
    redirect_to: redirectTo,
  });

  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    "Content-Type": "application/json",
  };

  let status: number;
  let rawBody = "";

  try {
    const directResponse = await fetch(`${supabaseUrl.origin}/auth/v1/otp`, {
      method: "POST",
      headers,
      body: payload,
      cache: "no-store",
    });

    status = directResponse.status;
    rawBody = await directResponse.text();
  } catch {
    try {
      const resolvedIp = await resolveIpv4ViaPublicDns(supabaseUrl.hostname);
      const fallbackResponse = await postOtpThroughResolvedIp({
        ip: resolvedIp,
        host: supabaseUrl.hostname,
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
    return NextResponse.json({ ok: true });
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
