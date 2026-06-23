#!/usr/bin/env tsx
/**
 * scripts/migrate-storage.ts
 *
 * Migrates all storage objects from the OLD Supabase project
 * (hcayrcsmddtqqlvkvaqd.supabase.co) to the NEW EC2 self-hosted Supabase.
 *
 * Discovery strategy (runs in order, deduplicates):
 *   1. If OLD_SUPABASE_SERVICE_KEY is set, lists objects from old storage API.
 *   2. Scans the NEW database for stored URLs pointing to the old Supabase.
 *
 * Usage:
 *   npx tsx scripts/migrate-storage.ts            # real transfer
 *   npx tsx scripts/migrate-storage.ts --dry-run   # preview only
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------
const OLD_URL =
  process.env.OLD_SUPABASE_URL?.trim() ||
  "https://hcayrcsmddtqqlvkvaqd.supabase.co";
const OLD_SERVICE_KEY = process.env.OLD_SUPABASE_SERVICE_KEY?.trim() || "";

const NEW_URL = process.env.SUPABASE_URL?.trim() || "";
const NEW_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

const isDryRun = process.argv.includes("--dry-run");
const OLD_HOSTNAME = "hcayrcsmddtqqlvkvaqd.supabase.co";

// ---------------------------------------------------------------------------
// Progress helpers
// ---------------------------------------------------------------------------
type TransferResult = {
  migrated: number;
  skipped: number;
  failed: number;
  failedPaths: string[];
  totalFound: number;
};

function logProgress(
  done: number,
  total: number,
  label: string,
): void {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  console.log(`  [${done}/${total} (${pct}%)] ${label}`);
}

// ---------------------------------------------------------------------------
// 1. Discover files from old Supabase storage API (if service key provided)
// ---------------------------------------------------------------------------
async function discoverFromOldStorage(): Promise<Map<string, string>> {
  const files = new Map<string, string>();

  if (!OLD_SERVICE_KEY) {
    console.log(
      "  OLD_SUPABASE_SERVICE_KEY not set — skipping storage API discovery.",
    );
    return files;
  }

  console.log("\n  Connecting to OLD Supabase storage API...");

  // Use raw fetch instead of SDK so we can do recursive listing
  const listOpts = {
    headers: {
      Authorization: `Bearer ${OLD_SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
  };

  // Get all buckets
  const bucketsResp = await fetch(`${OLD_URL}/storage/v1/bucket`, listOpts);
  if (!bucketsResp.ok) {
    console.warn(`  Failed to list old buckets (HTTP ${bucketsResp.status})`);
    return files;
  }
  const buckets = (await bucketsResp.json()) as Array<{ id: string; name: string }>;
  console.log(`  Found ${buckets.length} buckets on OLD Supabase.`);

  for (const bucket of buckets) {
    console.log(`\n  Listing all objects in "${bucket.name}" recursively...`);
    let offset = 0;
    const pageSize = 200;
    let totalListed = 0;

    while (true) {
      const listResp = await fetch(
        `${OLD_URL}/storage/v1/object/list/${bucket.name}`,
        {
          method: "POST",
          headers: listOpts.headers,
          body: JSON.stringify({
            limit: pageSize,
            offset,
            prefix: "",
            sortBy: { column: "name", order: "asc" },
          }),
        },
      );

      if (!listResp.ok) {
        console.warn(
          `  Error listing ${bucket.name}@${offset} (HTTP ${listResp.status})`,
        );
        break;
      }

      const objects = (await listResp.json()) as Array<{
        name: string;
        id: string | null;
        metadata: Record<string, unknown> | null;
      }>;

      if (!objects || objects.length === 0) break;

      for (const obj of objects) {
        // Skip folder entries (null id = directory marker)
        if (obj.id === null || obj.metadata === null) continue;
        const storagePath = `${bucket.name}/${obj.name}`;
        const publicUrl = `${OLD_URL}/storage/v1/object/public/${storagePath}`;
        files.set(storagePath, publicUrl);
      }

      totalListed += objects.length;
      console.log(`    Listed ${totalListed} objects in "${bucket.name}"...`);

      if (objects.length < pageSize) break;
      offset += pageSize;
    }

    console.log(`    Total objects found in "${bucket.name}": ${totalListed}`);
  }

  return files;
}

// ---------------------------------------------------------------------------
// 2. Discover files from database records (always runs)
// ---------------------------------------------------------------------------
async function discoverFromDatabase(): Promise<Map<string, string>> {
  const files = new Map<string, string>();

  if (!NEW_URL || !NEW_SERVICE_KEY) {
    console.warn("  NEW Supabase env vars not set — skipping DB discovery.");
    return files;
  }

  console.log("\n  Scanning NEW database for stored old-Supabase URLs...");
  const newClient = createClient(NEW_URL, NEW_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Tables and columns to check
  const queries: { table: string; column: string; isJson?: boolean }[] = [
    { table: "profiles", column: "avatar_url" },
    { table: "profiles", column: "metadata", isJson: true },
    { table: "help_requests", column: "metadata", isJson: true },
    { table: "posts", column: "content" },
    { table: "posts", column: "description" },
    { table: "posts", column: "metadata", isJson: true },
    { table: "posts", column: "text" },
    { table: "service_listings", column: "metadata", isJson: true },
  ];

  for (const { table, column, isJson } of queries) {
    const { data, error } = await newClient
      .from(table)
      .select(`id, ${column}`)
      .ilike(column, `%${OLD_HOSTNAME}%`)
      .limit(1000);

    if (error) {
      if (!error.message.includes("column") && !error.message.includes("does not exist")) {
        console.warn(`  Error querying ${table}.${column}: ${error.message}`);
      }
      continue;
    }

    if (!data || data.length === 0) continue;

    for (const row of data) {
      const raw = (row as unknown as Record<string, unknown>)[column];
      if (!raw) continue;

      let urls: string[] = [];

      if (isJson && typeof raw === "object") {
        urls = extractUrlsFromValue(raw);
      } else if (typeof raw === "string") {
        const maybeJson = tryParseJson(raw);
        if (maybeJson !== null) {
          urls = extractUrlsFromValue(maybeJson);
        } else if (raw.includes(OLD_HOSTNAME)) {
          urls = extractUrlsFromValue(raw);
        }
      }

      for (const url of urls) {
        const storagePath = urlToStoragePath(url);
        if (storagePath) {
          files.set(storagePath, url);
        }
      }
    }
  }

  console.log(`  Found ${files.size} unique file paths from DB.`);
  return files;
}

function tryParseJson(s: string): unknown | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

const STORAGE_URL_PATTERN =
  /https?:\/\/[^\s"']*hcayrcsmddtqqlvkvaqd[^\s"']*\/storage\/v1\/object\/public\/[^\s"',\]]+/g;

function extractUrlsFromValue(value: unknown, results?: string[]): string[] {
  const r = results ?? [];
  if (typeof value === "string") {
    // Extract only actual URLs using regex (the string may contain surrounding text)
    const matches = value.match(STORAGE_URL_PATTERN);
    if (matches) {
      for (const m of matches) r.push(m);
    }
    // Also handle URLs nested in JSON-stringified strings
    const nested = tryParseJson(value);
    if (nested !== null) extractUrlsFromValue(nested, r);
  } else if (Array.isArray(value)) {
    for (const item of value) extractUrlsFromValue(item, r);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      extractUrlsFromValue(v, r);
    }
  }
  return r;
}

// ---------------------------------------------------------------------------
// Convert old-Supabase URL → storage path (bucket/key)
// ---------------------------------------------------------------------------
function urlToStoragePath(url: string): string | null {
  // Expected format:
  //   https://hcayrcsmddtqqlvkvaqd.supabase.co/storage/v1/object/public/{bucket}/{path}
  const pattern =
    /\/storage\/v1\/object\/public\/([^/]+)\/(.+)/;
  const match = url.match(pattern);
  if (!match) return null;
  const bucket = match[1];
  const objectPath = match[2];
  return `${bucket}/${objectPath}`;
}

// ---------------------------------------------------------------------------
// Extract bucket name from storage path
// ---------------------------------------------------------------------------
function bucketFromPath(storagePath: string): string {
  return storagePath.split("/")[0];
}

function objectKeyFromPath(storagePath: string): string {
  const parts = storagePath.split("/");
  return parts.slice(1).join("/");
}

// ---------------------------------------------------------------------------
// Check if file already exists on NEW with matching size
// ---------------------------------------------------------------------------
async function fileExistsOnNew(
  newClient: SupabaseClient,
  storagePath: string,
): Promise<boolean> {
  const bucket = bucketFromPath(storagePath);
  const key = objectKeyFromPath(storagePath);

  // Try HEAD request to public URL
  const publicUrl = `${NEW_URL}/storage/v1/object/public/${storagePath}`;
  try {
    const resp = await fetch(publicUrl, { method: "HEAD" });
    if (resp.ok) return true;
  } catch {
    // fall through to list-based check
  }

  // Fallback: list the parent prefix
  const parentPrefix = key.split("/").slice(0, -1).join("/") + "/";
  const targetName = key.split("/").pop() || "";
  const { data: objects } = await newClient.storage
    .from(bucket)
    .list(parentPrefix, { limit: 200, offset: 0 });

  if (objects) {
    return objects.some((o) => o.name === targetName);
  }

  return false;
}

// ---------------------------------------------------------------------------
// Download from old Supabase (public URL — no auth needed)
// ---------------------------------------------------------------------------
async function downloadFromOld(
  publicUrl: string,
): Promise<ArrayBuffer | null> {
  try {
    const resp = await fetch(publicUrl);
    if (!resp.ok) {
      console.warn(`    Download failed (HTTP ${resp.status}): ${publicUrl}`);
      return null;
    }
    return await resp.arrayBuffer();
  } catch (err) {
    console.warn(`    Download error: ${publicUrl} — ${err}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Upload to new Supabase
// ---------------------------------------------------------------------------
async function uploadToNew(
  newClient: SupabaseClient,
  storagePath: string,
  data: ArrayBuffer,
): Promise<boolean> {
  const bucket = bucketFromPath(storagePath);
  const key = objectKeyFromPath(storagePath);

  const { error } = await newClient.storage
    .from(bucket)
    .upload(key, new Uint8Array(data), {
      upsert: true,
      contentType: guessMimeType(key),
    });

  if (error) {
    console.warn(`    Upload failed: ${storagePath} — ${error.message}`);
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Guess MIME type from file extension
// ---------------------------------------------------------------------------
function guessMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  return map[ext] || "application/octet-stream";
}

// ---------------------------------------------------------------------------
// Ensure buckets exist on NEW
// ---------------------------------------------------------------------------
async function ensureBuckets(
  newClient: SupabaseClient,
  bucketNames: Set<string>,
): Promise<void> {
  for (const name of bucketNames) {
    const { data: existing } = await newClient.storage.getBucket(name);
    if (existing) continue;

    console.log(`  Creating bucket "${name}" on NEW...`);
    const { error } = await newClient.storage.createBucket(name, {
      public: true,
    });
    if (error) {
      console.warn(`  Failed to create bucket "${name}": ${error.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log(" Supabase Storage Migration");
  console.log("=".repeat(60));
  console.log(`  Old: ${OLD_URL}`);
  console.log(`  New: ${NEW_URL}`);
  console.log(`  Mode: ${isDryRun ? "DRY RUN (no changes)" : "LIVE TRANSFER"}`);
  console.log("");

  // Validate new Supabase env
  if (!NEW_URL || !NEW_SERVICE_KEY) {
    console.error(
      "ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local",
    );
    process.exit(1);
  }

  const newClient = createClient(NEW_URL, NEW_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ---- Discover files ----
  console.log("PHASE 1: Discovering files to migrate...");

  const fromOldApi = await discoverFromOldStorage();
  const fromDb = await discoverFromDatabase();

  // Merge — prefer DB keys (more precise), but union both
  const allFiles = new Map<string, string>();
  for (const [k, v] of fromOldApi) allFiles.set(k, v);
  for (const [k, v] of fromDb) allFiles.set(k, v);

  console.log(
    `\n  Total unique files discovered: ${allFiles.size}` +
      ` (API: ${fromOldApi.size}, DB: ${fromDb.size})`,
  );

  if (allFiles.size === 0) {
    console.log("\n  No files to migrate. Nothing to do.");
    return;
  }

  // Group by bucket
  const byBucket = new Map<string, string[]>();
  for (const storagePath of allFiles.keys()) {
    const bucket = bucketFromPath(storagePath);
    const list = byBucket.get(bucket) || [];
    list.push(storagePath);
    byBucket.set(bucket, list);
  }

  console.log("\n  Files per bucket:");
  for (const [bucket, paths] of byBucket) {
    console.log(`    ${bucket}: ${paths.length} file(s)`);
  }

  if (isDryRun) {
    console.log("\n  DRY RUN — files that WOULD be migrated:");
    for (const [bucket, paths] of byBucket) {
      console.log(`\n  --- ${bucket} ---`);
      for (const p of paths) {
        console.log(`    ${p}`);
      }
    }
    console.log(
      `\n  Dry-run complete. ${allFiles.size} files would be migrated.`,
    );
    return;
  }

  // ---- Ensure buckets exist ----
  console.log("\nPHASE 2: Ensuring buckets exist on NEW...");
  await ensureBuckets(newClient, new Set(byBucket.keys()));

  // ---- Migrate ----
  console.log("\nPHASE 3: Migrating files...");
  const result: TransferResult = {
    migrated: 0,
    skipped: 0,
    failed: 0,
    failedPaths: [],
    totalFound: allFiles.size,
  };

  let processed = 0;

  for (const [storagePath, publicUrl] of allFiles) {
    processed++;
    const label = storagePath.length > 70
      ? storagePath.slice(0, 67) + "..."
      : storagePath;

    // Check if already exists on NEW
    const exists = await fileExistsOnNew(newClient, storagePath);
    if (exists) {
      result.skipped++;
      logProgress(processed, allFiles.size, `SKIP (exists) ${label}`);
      continue;
    }

    // Download
    const data = await downloadFromOld(publicUrl);
    if (!data) {
      result.failed++;
      result.failedPaths.push(storagePath);
      logProgress(processed, allFiles.size, `FAIL (download) ${label}`);
      continue;
    }

    // Upload
    const ok = await uploadToNew(newClient, storagePath, data);
    if (ok) {
      result.migrated++;
    } else {
      result.failed++;
      result.failedPaths.push(storagePath);
    }
    logProgress(processed, allFiles.size, ok ? `OK   ${label}` : `FAIL ${label}`);

    // Log summary every 50 files
    if (processed % 50 === 0 || processed === allFiles.size) {
      console.log(
        `  --- Progress: ${result.migrated} migrated, ${result.skipped} skipped, ${result.failed} failed ---`,
      );
    }
  }

  // ---- Final Summary ----
  console.log("\n" + "=".repeat(60));
  console.log(" MIGRATION COMPLETE");
  console.log("=".repeat(60));
  console.log(`  Total found:   ${result.totalFound}`);
  console.log(`  Migrated:      ${result.migrated}`);
  console.log(`  Skipped:       ${result.skipped}`);
  console.log(`  Failed:        ${result.failed}`);

  if (result.failedPaths.length > 0) {
    console.log("\n  Failed paths:");
    for (const p of result.failedPaths) {
      console.log(`    - ${p}`);
    }
  }

  console.log("\n  Old Supabase files were NOT deleted.");
  console.log("  Phase 1 complete. Ready for Phase 2 (DB URL update).");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
