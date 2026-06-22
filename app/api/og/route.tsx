import { ImageResponse } from "next/og";
import { appName, appTagline } from "@/lib/branding";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get("title") || appName;
    const description = searchParams.get("description") || appTagline;

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0ea5e9 100%)",
            padding: "80px",
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: "#ffffff",
              textAlign: "center",
              marginBottom: 24,
              lineHeight: 1.1,
              maxWidth: "90%",
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 32,
              color: "#94a3b8",
              textAlign: "center",
              maxWidth: "80%",
              lineHeight: 1.4,
            }}
          >
            {description}
          </div>
          <div
            style={{
              marginTop: 48,
              fontSize: 24,
              color: "#38bdf8",
              textAlign: "center",
            }}
          >
            {appName}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
    );
  } catch {
    return new Response("Failed to generate OG image", { status: 500 });
  }
}
