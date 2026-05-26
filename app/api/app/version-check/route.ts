import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const buildAbsoluteUrl = (request: Request, relativePath: string) => {
  try {
    const url = new URL(relativePath, request.url);
    return url.toString();
  } catch {
    return "";
  }
};

export async function GET(request: Request) {
  const currentVersion = process.env.APP_VERSION || "0.0.0";
  const downloadUrl = process.env.APP_DOWNLOAD_URL || "";

  const releasesDir = path.join(process.cwd(), "public", "app", "releases");
  let latestVersion = currentVersion;
  let updateUrl = downloadUrl;
  const releaseNotes = process.env.APP_RELEASE_NOTES || "";

  try {
    if (fs.existsSync(releasesDir)) {
      const files = fs
        .readdirSync(releasesDir)
        .filter((f) => f.endsWith(".apk"))
        .sort()
        .reverse();

      if (files.length > 0) {
        const latestFile = files[0];
        const match = latestFile.match(/serviq-v?([\d.]+)\.apk/i);
        if (match) {
          latestVersion = match[1];
        }
        updateUrl = buildAbsoluteUrl(request, `/app/releases/${latestFile}`);
      }
    }
  } catch {
    // fall back to env vars
  }

  const updateAvailable = latestVersion !== currentVersion;

  return NextResponse.json({
    updateAvailable,
    isCritical: process.env.APP_UPDATE_CRITICAL === "true",
    currentVersion,
    latestVersion,
    updateUrl,
    releaseNotes,
  });
}
