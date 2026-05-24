#!/usr/bin/env node

/**
 * Import Google Places API data into ServiQ profiles + service listings.
 *
 * Usage:
 *   node scripts/import-google-places.mjs --file ./places.json [--dry-run]
 *
 * The JSON file should be the response body from Google Places API (New)
 * with a top-level "places" array.  Each place object must have at least
 * an "id" (googlePlaceId) and a "displayName" with a "text" field.
 *
 * Environment variables (from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (admin client — create users + write rows)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USAGE = `Usage: node scripts/import-google-places.mjs --file <path> [--dry-run]`;

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
  if (!filePath) {
    console.error(USAGE);
    process.exit(1);
  }
  if (!existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  return { filePath, dryRun };
}

function randomPassword() {
  return randomBytes(24).toString("hex");
}

function sanitizeEmail(placeId) {
  const safe = placeId.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
  return `place_${safe}@import.serviqapp.com`;
}

function normalizePhone(raw) {
  if (!raw) return null;
  return raw.replace(/[\s-]/g, "");
}

function clampText(value, max) {
  if (!value) return null;
  const s = String(value).trim();
  return s.length > max ? s.slice(0, max) : s;
}

const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function buildOpeningHoursJson(periods) {
  if (!periods || !Array.isArray(periods) || periods.length === 0) return null;
  try {
    return periods.map((p) => {
      const open = p.open || {};
      const close = p.close || {};
      const openDay = DAY_KEYS[open.day] ?? `day_${open.day}`;
      const closeDay = DAY_KEYS[close.day] ?? `day_${close.day}`;
      return {
        open_day: openDay,
        open_time: `${String(open.hour ?? 0).padStart(2, "0")}:${String(open.minute ?? 0).padStart(2, "0")}`,
        close_day: closeDay,
        close_time: `${String(close.hour ?? 0).padStart(2, "0")}:${String(close.minute ?? 0).padStart(2, "0")}`,
      };
    });
  } catch {
    return null;
  }
}

// Map Google Place primary types to our service categories
function mapCategory(primaryType, types) {
  const all = [primaryType, ...(types || [])].filter(Boolean);
  for (const t of all) {
    const key = t.toLowerCase().replace(/[^a-z]/g, "_");
    const map = {
      tailor: "Tailoring & Alterations",
      clothing_store: "Clothing & Fashion",
      womens_clothing_store: "Clothing & Fashion",
      boutique: "Clothing & Fashion",
      electrician: "Electrical Services",
      plumber: "Plumbing Services",
      carpenter: "Carpentry & Woodwork",
      painter: "Painting Services",
      cleaner: "Cleaning Services",
      home_improvement: "Home Improvement",
      salon: "Salon & Grooming",
      hair_salon: "Salon & Grooming",
      beauty_salon: "Beauty & Spa",
      spa: "Beauty & Spa",
      gym: "Fitness & Wellness",
      fitness_center: "Fitness & Wellness",
      doctor: "Healthcare",
      hospital: "Healthcare",
      dentist: "Healthcare",
      pharmacy: "Healthcare",
      restaurant: "Food & Dining",
      cafe: "Food & Dining",
      bakery: "Food & Dining",
      grocery: "Groceries & Essentials",
      supermarket: "Groceries & Essentials",
      hardware_store: "Hardware & Tools",
      electronics_store: "Electronics & Gadgets",
      furniture_store: "Furniture & Decor",
      moving_company: "Packing & Moving",
      locksmith: "Security & Locks",
      pest_control: "Pest Control",
      real_estate_agency: "Real Estate",
      travel_agency: "Travel & Tours",
      photographer: "Photography",
      accountant: "Accounting & Tax",
      lawyer: "Legal Services",
      tutor: "Tutoring & Classes",
      repair: "Repair Services",
      service: "Other Services",
    };
    if (map[key]) return map[key];
  }
  return "Other Services";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { filePath, dryRun } = parseArgs();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Missing environment variables. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set."
    );
    console.error("Tip: source .env.local or run: dotenv -- node scripts/import-google-places.mjs ...");
    process.exit(1);
  }

  const sb = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const raw = readFileSync(filePath, "utf-8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    console.error("Invalid JSON file.");
    process.exit(1);
  }

  const places = data.places || data.results || [];
  if (!Array.isArray(places) || places.length === 0) {
    console.error("No 'places' array found in JSON. Expected { places: [...] }");
    process.exit(1);
  }

  console.log(`\n📦  Found ${places.length} place(s) to process.${dryRun ? "  [DRY RUN]" : ""}\n`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const [i, place] of places.entries()) {
    const googlePlaceId = place.id;
    const name = place.displayName?.text || place.name;
    if (!googlePlaceId || !name) {
      console.warn(`  ⚠  [${i + 1}] Skipping — missing id or name`);
      skipped++;
      continue;
    }

    const email = sanitizeEmail(googlePlaceId);

    // ---- check for existing profile by google_place_id ----
    const { data: existing } = await sb
      .from("profiles")
      .select("id")
      .eq("metadata->>google_place_id", googlePlaceId)
      .maybeSingle();

    if (existing) {
      console.log(`  · [${i + 1}] Skipped — already imported: ${name}`);
      skipped++;
      continue;
    }

    // ---- prepare data ----
    const phone = normalizePhone(place.nationalPhoneNumber);
    const lat = place.location?.latitude ?? null;
    const lng = place.location?.longitude ?? null;
    const shortAddress = clampText(place.shortFormattedAddress, 200);
    const fullAddress = clampText(place.formattedAddress, 500);
    const category = mapCategory(place.primaryType, place.types);
    const openingHours = buildOpeningHoursJson(place.regularOpeningHours?.periods);

    const metadata = {
      import_source: "google_maps",
      google_place_id: googlePlaceId,
      google_maps_uri: place.googleMapsUri,
      rating: place.rating ?? null,
      user_rating_count: place.userRatingCount ?? null,
      business_status: place.businessStatus ?? null,
      primary_type: place.primaryType ?? null,
      types: place.types ?? [],
      formatted_address: fullAddress,
      opening_hours: openingHours,
      import_notes: `Imported from Google Places on ${new Date().toISOString().split("T")[0]}`,
    };

    if (dryRun) {
      console.log(`  · [${i + 1}] Would import: ${name} (${email})`);
      created++;
      continue;
    }

    try {
      // ---- Step 1: Create auth user ----
      const { data: authUser, error: authError } = await sb.auth.admin.createUser({
        email,
        password: randomPassword(),
        email_confirm: true,
        user_metadata: {
          full_name: name,
          import_source: "google_maps",
          google_place_id: googlePlaceId,
        },
      });

      if (authError || !authUser?.user) {
        console.error(`  ✗ [${i + 1}] Auth create failed for ${name}:`, authError?.message ?? "No user returned");
        errors++;
        continue;
      }

      const userId = authUser.user.id;

      // ---- Step 2: Create profile ----
      const { error: profileError } = await sb.from("profiles").insert({
        id: userId,
        full_name: name,
        phone,
        location: shortAddress,
        latitude: lat,
        longitude: lng,
        role: "provider",
        metadata,
      });

      if (profileError) {
        // Roll back auth user
        await sb.auth.admin.deleteUser(userId).catch(() => {});
        console.error(`  ✗ [${i + 1}] Profile insert failed for ${name}:`, profileError.message);
        errors++;
        continue;
      }

      // ---- Step 3: Create service listing ----
      const listingTitle = clampText(
        `${name} — ${category}`,
        200
      );
      const { error: listingError } = await sb.from("service_listings").insert({
        provider_id: userId,
        title: listingTitle,
        description: `Local ${category.toLowerCase()} business serving the community. ${fullAddress ? `Located at ${fullAddress}.` : ""}${phone ? ` Call ${phone}.` : ""}`,
        category,
        availability: "available",
        metadata: {
          source: "google_maps_import",
          google_place_id: googlePlaceId,
          google_maps_uri: place.googleMapsUri,
        },
      });

      if (listingError) {
        console.warn(`  ⚠  [${i + 1}] Service listing create failed for ${name} (profile created):`, listingError.message);
      }

      console.log(`  ✓ [${i + 1}] Created: ${name} → ${category}`);
      created++;
    } catch (err) {
      console.error(`  ✗ [${i + 1}] Unexpected error for ${name}:`, err instanceof Error ? err.message : err);
      errors++;
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Created: ${created}  |  Skipped: ${skipped}  |  Errors: ${errors}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
