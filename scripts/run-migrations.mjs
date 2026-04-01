/**
 * Supabase Migration Runner (Node.js / pg)
 * ----------------------------------------
 * Applies all pending migration files to the hosted Supabase database.
 * Uses Supabase's Supavisor session-mode pooler which accepts the
 * service_role JWT as the password (no separate DB password needed).
 *
 * Usage:
 *   node scripts/run-migrations.mjs
 *   node scripts/run-migrations.mjs --only 20260401120000_public_listings_anon_select.sql
 *   node scripts/run-migrations.mjs --from 20260329000000
 */

import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Client } = pg;

// ── Config ───────────────────────────────────────────────────────────────────

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Load .env.local manually — handle CRLF (Windows) and LF (Unix)
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

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL; // https://xxx.supabase.co
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌  NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from .env.local");
  process.exit(1);
}

// Extract project ref from URL: https://hcayrcsmddtqqlvkvaqd.supabase.co → hcayrcsmddtqqlvkvaqd
const PROJECT_REF = SUPABASE_URL.replace("https://", "").split(".")[0];

// Supavisor session-mode pooler hosts to try (different AWS regions)
const POOLER_HOSTS = [
  `aws-0-ap-south-1.pooler.supabase.com`,  // Mumbai (most likely for Indian projects)
  `aws-0-us-east-1.pooler.supabase.com`,   // N. Virginia
  `aws-0-us-west-1.pooler.supabase.com`,   // California
  `aws-0-eu-central-1.pooler.supabase.com`, // Frankfurt
  `aws-0-ap-southeast-1.pooler.supabase.com`, // Singapore
];

// ── Migration discovery ───────────────────────────────────────────────────────

const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");

const args = process.argv.slice(2);
const onlyFlag = args.indexOf("--only");
const fromFlag = args.indexOf("--from");

let migrationFiles = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (onlyFlag !== -1) {
  const target = args[onlyFlag + 1];
  migrationFiles = migrationFiles.filter((f) => f === target || f.includes(target));
} else if (fromFlag !== -1) {
  const from = args[fromFlag + 1];
  migrationFiles = migrationFiles.filter((f) => f >= from);
}

console.log(`\n📦  Project ref : ${PROJECT_REF}`);
console.log(`📂  Migrations  : ${MIGRATIONS_DIR}`);
console.log(`📋  Files to run (${migrationFiles.length}):`);
for (const f of migrationFiles) console.log(`     • ${f}`);

// ── Connect ───────────────────────────────────────────────────────────────────

async function tryConnect(host) {
  const client = new Client({
    host,
    port: 5432,
    database: "postgres",
    user: `postgres.${PROJECT_REF}`,
    password: SERVICE_ROLE_KEY,
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
      process.stdout.write(`🔌  Trying ${host} ... `);
      const client = await tryConnect(host);
      console.log("✅ connected");
      return client;
    } catch (err) {
      console.log(`❌ ${err.message.split("\n")[0]}`);
    }
  }
  return null;
}

// ── Apply migrations ──────────────────────────────────────────────────────────

async function applyMigrations(client) {
  let applied = 0;
  let failed = 0;

  for (const file of migrationFiles) {
    const filePath = join(MIGRATIONS_DIR, file);
    const sql = readFileSync(filePath, "utf8");

    process.stdout.write(`\n⏳  ${file} ... `);
    try {
      await client.query(sql);
      console.log("✅ applied");
      applied++;
    } catch (err) {
      // Idempotent errors (already exists, duplicate policy) are warnings, not failures
      const msg = err.message;
      const isIdempotent =
        msg.includes("already exists") ||
        msg.includes("duplicate") ||
        err.code === "42710" || // duplicate_object
        err.code === "42P07" || // duplicate_table
        err.code === "42723";   // duplicate_function

      if (isIdempotent) {
        console.log(`⚠️  skipped (already applied: ${msg.split("\n")[0]})`);
        applied++;
      } else {
        console.log(`❌ FAILED`);
        console.error(`   Error: ${msg}`);
        failed++;
      }
    }
  }

  console.log(`\n────────────────────────────────`);
  console.log(`✅  Applied : ${applied}`);
  if (failed > 0) console.log(`❌  Failed  : ${failed}`);
  console.log(`────────────────────────────────\n`);
  return failed === 0;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (migrationFiles.length === 0) {
    console.log("\n✅  No migration files matched. Nothing to do.\n");
    process.exit(0);
  }

  const client = await getConnectedClient();
  if (!client) {
    console.error("\n❌  Could not connect to Supabase database via any pooler host.");
    console.error("    → Get the DB connection string from:");
    console.error("      Supabase Dashboard → Settings → Database → Connection string");
    console.error("    → Then run: PGPASSWORD=<password> psql <connection_string> -f supabase-migrations-bundle.sql\n");
    process.exit(1);
  }

  try {
    const success = await applyMigrations(client);
    process.exit(success ? 0 : 1);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
