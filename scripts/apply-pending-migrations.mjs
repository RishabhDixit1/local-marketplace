/**
 * Applies pending Supabase migrations, specifically the cart_sync migration.
 *
 * Usage:
 *   node scripts/apply-pending-migrations.mjs
 *
 * Reads env vars from .env.local. Uses SUPABASE_SERVICE_ROLE_KEY to connect
 * via Supavisor session-mode pooler. Will skip migrations that already exist.
 */

import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Client } = pg;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Load .env.local
const envLines = readFileSync(join(ROOT, ".env.local"), "utf8").split(/\r?\n/);
const env = {};
for (const line of envLines) {
  const eqIdx = line.indexOf("=");
  if (eqIdx > 0) {
    const key = line.slice(0, eqIdx).trim();
    const val = line.slice(eqIdx + 1).trim();
    if (/^[A-Z_][A-Z0-9_]*$/.test(key)) env[key] = val;
  }
}

const SUPABASE_URL = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing Supabase credentials. Ensure SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are in .env.local");
  process.exit(1);
}

let projectRef;
try {
  const url = new URL(SUPABASE_URL);
  // Extract project ref from hostname: hcayrcsmddtqqlvkvaqd.supabase.co -> hcayrcsmddtqqlvkvaqd
  const hostParts = url.hostname.split(".");
  projectRef = hostParts[0];
} catch {
  // For self-hosted/localhost URLs, try the alternative connection approach
  projectRef = null;
}

const POOLER_HOSTS = projectRef
  ? [
      `aws-0-ap-south-1.pooler.supabase.com`,
      `aws-0-us-east-1.pooler.supabase.com`,
      `aws-0-us-west-1.pooler.supabase.com`,
      `aws-0-eu-central-1.pooler.supabase.com`,
      `aws-0-ap-southeast-1.pooler.supabase.com`,
    ]
  : [];

const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");
const migrationFiles = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

console.log(`Supabase URL: ${SUPABASE_URL}`);
console.log(`Project ref: ${projectRef || "N/A (self-hosted/localhost)"}`);
console.log(`Found ${migrationFiles.length} migration files`);

async function tryConnect(host) {
  const client = new Client({
    host,
    port: 6543, // Supavisor session mode
    database: "postgres",
    user: `postgres.${projectRef}`,
    password: SERVICE_ROLE_KEY,
    port: 6543, // Supavisor session mode
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
    query_timeout: 60000,
  });
  await client.connect();
  return client;
}

async function getConnectedClient() {
  for (const host of POOLER_HOSTS) {
    try {
      process.stdout.write(`Trying ${host} ... `);
      const client = await tryConnect(host);
      console.log("connected");
      return client;
    } catch (err) {
      console.log(`failed: ${err.message.split("\n")[0]}`);
    }
  }

  // Fallback: try connecting directly if SUPABASE_URL is a direct DB URL
  if (SUPABASE_URL.startsWith("postgres")) {
    try {
      console.log("Trying direct connection...");
      const client = new Client({ connectionString: `${SUPABASE_URL.replace(":5432", ":6543")}`, ssl: { rejectUnauthorized: false } });
      await client.connect();
      return client;
    } catch (err) {
      console.log(`direct connect failed: ${err.message.split("\n")[0]}`);
    }
  }

  return null;
}

async function main() {
  const client = await getConnectedClient();
  if (!client) {
    console.error("\nCould not connect to Supabase database via any pooler host.");
    console.error("To apply the cart migration manually:\n");
    console.error("  1. Go to Supabase Dashboard -> SQL Editor");
    console.error("  2. Open supabase/migrations/20260616000000_cart_sync.sql");
    console.error("  3. Paste and run the SQL\n");
    console.error("Or set SUPABASE_DB_URL directly:\n");
    console.error("  export SUPABASE_DB_URL='postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres'");
    console.error("  node scripts/run-migrations.mjs --only 20260616000000_cart_sync.sql\n");
    process.exit(1);
  }

  try {
    let applied = 0;
    for (const file of migrationFiles) {
      const filePath = join(MIGRATIONS_DIR, file);
      const sql = readFileSync(filePath, "utf8");
      process.stdout.write(`${file} ... `);
      try {
        await client.query(sql);
        console.log("applied");
        applied++;
      } catch (err) {
        const msg = err.message;
        if (msg.includes("already exists") || msg.includes("duplicate") || err.code === "42710" || err.code === "42P07" || err.code === "42723") {
          console.log("skipped (already applied)");
          applied++;
        } else {
          console.log(`FAILED: ${msg.split("\n")[0]}`);
        }
      }
    }
    console.log(`\nDone. ${applied}/${migrationFiles.length} migrations processed.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
