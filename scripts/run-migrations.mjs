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
import { createHash } from "crypto";
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

const SUPABASE_URL = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = env.DATABASE_URL;

if (!SUPABASE_URL) {
  console.error("❌  SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL missing from .env.local");
  process.exit(1);
}

const isSelfHosted = !SUPABASE_URL.includes(".supabase.co");

if (isSelfHosted) {
  if (!DATABASE_URL) {
    console.error("❌  DATABASE_URL is required for self-hosted Supabase instances.");
    console.error("    Add it to .env.local, e.g.: DATABASE_URL=postgresql://postgres:password@host:5432/postgres");
    process.exit(1);
  }
} else if (!SERVICE_ROLE_KEY) {
  console.error("❌  SUPABASE_SERVICE_ROLE_KEY missing from .env.local");
  process.exit(1);
}

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

console.log(`📂  Migrations  : ${MIGRATIONS_DIR}`);
if (isSelfHosted) {
  console.log(`🔧  Mode         : self-hosted (${SUPABASE_URL})`);
} else {
  const ref = SUPABASE_URL.replace("https://", "").split(".")[0].replace("http://", "");
  console.log(`☁️  Mode         : Supabase Cloud (project ref: ${ref})`);
}
console.log(`📋  Files to run (${migrationFiles.length}):`);
for (const f of migrationFiles) console.log(`     • ${f}`);

// ── Connect ───────────────────────────────────────────────────────────────────

async function getConnectedClient() {
  if (isSelfHosted) {
    console.log(`🔌  Connecting to self-hosted database ... `);
    const client = new Client({
      connectionString: DATABASE_URL,
      connectionTimeoutMillis: 8000,
      query_timeout: 60000,
    });
    try {
      await client.connect();
      console.log("✅ connected");
      return client;
    } catch (err) {
      console.log(`❌ ${err.message.split("\n")[0]}`);
      return null;
    }
  }

  // Cloud: try Supavisor session-mode pooler hosts
  const projectRef = SUPABASE_URL.replace("https://", "").split(".")[0].replace("http://", "");

  const poolerHosts = [
    `aws-0-ap-south-1.pooler.supabase.com`,  // Mumbai (most likely for Indian projects)
    `aws-0-us-east-1.pooler.supabase.com`,   // N. Virginia
    `aws-0-us-west-1.pooler.supabase.com`,   // California
    `aws-0-eu-central-1.pooler.supabase.com`, // Frankfurt
    `aws-0-ap-southeast-1.pooler.supabase.com`, // Singapore
  ];

  for (const host of poolerHosts) {
    try {
      process.stdout.write(`🔌  Trying ${host} ... `);
      const client = new Client({
        host,
        port: 5432,
        database: "postgres",
        user: `postgres.${projectRef}`,
        password: SERVICE_ROLE_KEY,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 8000,
        query_timeout: 60000,
      });
      await client.connect();
      console.log("✅ connected");
      return client;
    } catch (err) {
      console.log(`❌ ${err.message.split("\n")[0]}`);
    }
  }

  return null;
}

// ── Apply migrations ──────────────────────────────────────────────────────────

async function ensureMigrationsTable(client) {
  await client.query(`
    create table if not exists public._migrations (
      id          bigint generated always as identity primary key,
      filename    text not null unique,
      checksum    text not null,
      applied_at  timestamptz not null default now(),
      duration_ms int not null default 0,
      success     boolean not null default true,
      error_msg   text
    );
  `);
}

function computeChecksum(sql) {
  return createHash("md5").update(sql).digest("hex");
}

async function isMigrationApplied(client, file) {
  const { rows } = await client.query(
    "select count(*)::int as cnt from public._migrations where filename = $1 and success = true",
    [file],
  );
  return rows[0].cnt > 0;
}

async function recordMigration(client, file, checksum, durationMs, success, errorMsg) {
  await client.query(
    `insert into public._migrations (filename, checksum, duration_ms, success, error_msg)
     values ($1, $2, $3, $4, $5)
     on conflict (filename) do update set
       duration_ms = excluded.duration_ms,
       success = excluded.success,
       error_msg = excluded.error_msg`,
    [file, checksum, durationMs, success, errorMsg],
  );
}

async function applyMigrations(client) {
  await ensureMigrationsTable(client);

  let applied = 0;
  let failed = 0;
  let skipped = 0;

  for (const file of migrationFiles) {
    const filePath = join(MIGRATIONS_DIR, file);
    const sql = readFileSync(filePath, "utf8");
    const checksum = computeChecksum(sql);

    // Skip if already applied successfully
    const already = await isMigrationApplied(client, file);
    if (already) {
      console.log(`\n⏭️  ${file} ... already applied (skipping)`);
      skipped++;
      continue;
    }

    process.stdout.write(`\n⏳  ${file} ... `);
    const start = Date.now();
    try {
      await client.query(sql);
      const duration = Date.now() - start;
      console.log(`✅ applied (${duration}ms)`);
      await recordMigration(client, file, checksum, duration, true, null);
      applied++;
    } catch (err) {
      const duration = Date.now() - start;
      const msg = err.message;

      // Idempotent errors (already exists, duplicate policy) are warnings
      const isIdempotent =
        msg.includes("already exists") ||
        msg.includes("duplicate") ||
        err.code === "42710" ||
        err.code === "42P07" ||
        err.code === "42723";

      if (isIdempotent) {
        console.log(`⚠️  skipped (already applied: ${msg.split("\n")[0]})`);
        await recordMigration(client, file, checksum, duration, true, msg.split("\n")[0]);
        applied++;
      } else {
        console.log(`❌ FAILED`);
        console.error(`   Error: ${msg}`);
        await recordMigration(client, file, checksum, duration, false, msg);
        failed++;
      }
    }
  }

  console.log(`\n────────────────────────────────`);
  console.log(`✅  Applied : ${applied}`);
  if (skipped > 0) console.log(`⏭️  Skipped : ${skipped}`);
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
    if (isSelfHosted) {
      console.error("\n❌  Could not connect to self-hosted database. Check your DATABASE_URL in .env.local.");
      console.error("    Verify the database is reachable and the credentials are correct.");
    } else {
      console.error("\n❌  Could not connect to Supabase Cloud database via any pooler host.");
      console.error("    → Get the DB connection string from:");
      console.error("      Supabase Dashboard → Settings → Database → Connection string");
      console.error("    → Then run: PGPASSWORD=<password> psql <connection_string> -f supabase-migrations-bundle.sql\n");
    }
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
