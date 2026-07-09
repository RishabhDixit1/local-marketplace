#!/usr/bin/env node

/**
 * Import sample CSV provider data for new market zones.
 *
 * Usage:
 *   node scripts/import_new_zone_providers.mjs [--file ./sample.csv] [--dry-run]
 *
 * Environment (loaded from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * CSV columns:
 *   zone,zone_slug,society_name,provider_name,phone,email,category,service_description,price_min,price_max
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

const USAGE = `Usage: node scripts/import_new_zone_providers.mjs [--file <path>] [--dry-run]`;

function parseArgs() {
  const args = process.argv.slice(2);
  let filePath = null;
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file" && args[i + 1]) {
      filePath = resolve(args[++i]);
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }
  return { filePath: filePath || resolve(__dirname, "sample_new_zones_import.csv"), dryRun };
}

function parseCsv(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] || ""; });
    return row;
  });
}

async function main() {
  const { filePath, dryRun } = parseArgs();

  if (!existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const rows = parseCsv(readFileSync(filePath, "utf-8"));

  console.log(`Loaded ${rows.length} provider rows from ${filePath}`);
  if (dryRun) console.log("DRY RUN — no changes will be made\n");

  // Fetch zone info from DB
  const { data: zones, error: zoneErr } = await supabase
    .from("market_zones")
    .select("slug, city, state")
    .eq("is_active", true);
  if (zoneErr) {
    console.error("Failed to fetch market zones:", zoneErr.message);
    process.exit(1);
  }

  const zoneInfo = {};
  for (const zone of zones || []) {
    zoneInfo[zone.slug] = { city: zone.city, state: zone.state };
  }

  // Pre-fetch localities to map society slugs to IDs
  const { data: allLocalities, error: locErr } = await supabase
    .from("localities")
    .select("id, name, slug, city, state");
  if (locErr) {
    console.error("Failed to fetch localities:", locErr.message);
    process.exit(1);
  }

  const localityBySlug = {};
  for (const loc of allLocalities || []) {
    const key = `${loc.city?.toLowerCase()}|${loc.slug}`;
    localityBySlug[key] = loc;
  }

  // Pre-fetch service categories
  const { data: categories, error: catErr } = await supabase
    .from("service_categories")
    .select("id, name, slug")
    .eq("is_active", true);
  if (catErr) {
    console.error("Failed to fetch categories:", catErr.message);
    process.exit(1);
  }

  const categoryByName = {};
  for (const cat of categories || []) {
    categoryByName[cat.name.toLowerCase()] = cat;
  }

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const zoneSlug = row.zone_slug;
    const societyName = row.society_name;
    const categoryName = row.category;
    const providerName = row.provider_name;
    const phone = row.phone;
    const email = row.email || `${phone}@import.local`;

    const info = zoneInfo[zoneSlug];
    if (!info) {
      console.warn(`  ⚠ Unknown zone "${zoneSlug}", skipping`);
      skipped++;
      continue;
    }

    // Find locality
    const societySlug = societyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const locKey = `${info.city.toLowerCase()}|${societySlug}`;
    const locality = localityBySlug[locKey];

    if (!locality) {
      console.warn(`  ⚠ Locality not found: ${societyName} in ${info.city} (key: ${locKey})`);
      console.warn(`    Available keys: ${Object.keys(localityBySlug).slice(0, 5).join(", ")}...`);
      skipped++;
      continue;
    }

    // Find category
    const catKey = categoryName.toLowerCase();
    const category = categoryByName[catKey];
    if (!category) {
      console.warn(`  ⚠ Category "${categoryName}" not found in DB`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`  [DRY] Would create provider: ${providerName} in ${societyName} (${categoryName})`);
      created++;
      continue;
    }

    // Create auth user
    const pwd = randomBytes(12).toString("hex");
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password: pwd,
      email_confirm: true,
      user_metadata: { name: providerName, phone, role: "provider" },
    });

    if (authErr) {
      console.error(`  ✗ Failed to create auth user for ${providerName}: ${authErr.message}`);
      skipped++;
      continue;
    }

    const userId = authUser.user.id;

    // Create profile
    const { error: profileErr } = await supabase.from("profiles").insert({
      id: userId,
      full_name: providerName,
      name: providerName,
      username: providerName.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30),
      phone,
      email,
      role: "provider",
      locality_id: locality.id,
      city: info.city,
      state: info.state,
      bio: `${categoryName} services in ${societyName}, ${info.city}`,
      onboarding_completed: true,
      profile_completion_percent: 60,
    });

    if (profileErr) {
      console.error(`  ✗ Failed to create profile for ${providerName}: ${profileErr.message}`);
      // Clean up auth user
      await supabase.auth.admin.deleteUser(userId);
      skipped++;
      continue;
    }

    // Create service listing
    const description = row.service_description || `${categoryName} services available in ${societyName} and nearby areas.`;
    const priceMin = parseInt(row.price_min, 10) || 0;
    const priceMax = parseInt(row.price_max, 10) || 0;

    const { error: listingErr } = await supabase.from("service_listings").insert({
      provider_id: userId,
      title: `${categoryName} Services`,
      description,
      category: categoryName,
      price: priceMin > 0 ? priceMin : null,
      metadata: {
        price_range: { min: priceMin, max: priceMax },
        service_area: locality.name,
        zone: zoneSlug,
      },
    });

    if (listingErr) {
      console.warn(`  ⚠ Created profile but listing failed for ${providerName}: ${listingErr.message}`);
    }

    console.log(`  ✓ ${providerName} → ${locality.name} (${categoryName}) [user: ${userId.slice(0, 8)}...]`);
    created++;
  }

  console.log(`\nDone. ${dryRun ? "[DRY RUN] " : ""}Created: ${created}, Skipped: ${skipped}`);
  process.exit(0);
}

main();
