#!/usr/bin/env node

/**
 * Smoke test for AI fixes in ServiQ marketplace.
 *
 * Tests:
 *   A) AI search / intent parsing (Bug 1 — env var mismatch)
 *   B) AI Launchpad generation   (Bug 2 — dead code wiring)
 *
 * Prerequisites:
 *   - The Next.js dev server is running on API_BASE_URL (default localhost:3000)
 *   - .env.local has NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *   - Migration 20260629120000 has been applied to the DB
 *
 * Usage:
 *   node scripts/smoke-test-ai-fixes.mjs
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

// ── Env loading ─────────────────────────────────────────────────────────

const projectRoot = process.cwd();

const parseEnvValue = (rawValue) => {
  const value = rawValue.trim();
  if (!value) return "";
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  const hashIndex = value.indexOf(" #");
  if (hashIndex >= 0) return value.slice(0, hashIndex).trim();
  return value;
};

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const withoutExport = trimmed.startsWith("export ")
      ? trimmed.slice(7).trim()
      : trimmed;
    const equalsIndex = withoutExport.indexOf("=");
    if (equalsIndex <= 0) continue;
    const key = withoutExport.slice(0, equalsIndex).trim();
    const rawValue = withoutExport.slice(equalsIndex + 1);
    if (!key || process.env[key]) continue;
    process.env[key] = parseEnvValue(rawValue);
  }
};

for (const file of [".env", ".env.local"]) {
  loadEnvFile(path.join(projectRoot, file));
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";

const TEST_USER_EMAIL = "smoke-test-ai@serviq.local";
const TEST_USER_PASSWORD = "SmokeTestAI2026!";

// ── Log helpers ─────────────────────────────────────────────────────────

const logPass = (msg) => console.log(`  ✅  ${msg}`);
const logWarn = (msg) => console.log(`  ⚠️  ${msg}`);
const logFail = (msg) => console.log(`  ❌  ${msg}`);
const logInfo = (msg) => console.log(`  ℹ️  ${msg}`);

// ── HTTP helper ─────────────────────────────────────────────────────────

async function apiPost(urlPath, body, accessToken) {
  const headers = { "Content-Type": "application/json" };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const res = await fetch(`${API_BASE_URL}${urlPath}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  return { status: res.status, ok: res.ok, data, text };
}

async function apiGet(urlPath, accessToken) {
  const headers = { "Content-Type": "application/json" };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const res = await fetch(`${API_BASE_URL}${urlPath}`, {
    method: "GET",
    headers,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  return { status: res.status, ok: res.ok, data, text };
}

// ── Setup: ensure test user exists ──────────────────────────────────────

async function setupTestUser() {
  console.log("\n── Setup: Test user ───────────────────────────────────");

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: createData, error: createError } =
    await adminClient.auth.admin.createUser({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
      email_confirm: true,
    });

  if (createError && !createError.message.includes("already exists") && !createError.message.includes("already been registered")) {
    console.error("  Failed to create test user:", createError.message);
    process.exit(1);
  }

  if (createData?.user) {
    logPass(`Test user created: ${TEST_USER_EMAIL}`);
  } else {
    logInfo(`Test user already exists: ${TEST_USER_EMAIL}`);
  }

  const { data: signInData, error: signInError } =
    await adminClient.auth.signInWithPassword({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });

  if (signInError || !signInData?.session) {
    console.error(
      "  Failed to sign in test user:",
      signInError?.message || "no session returned",
    );
    process.exit(1);
  }

  logPass(`Got access token for test user`);
  return { accessToken: signInData.session.access_token };
}

// ── Test A: AI search / intent parsing ──────────────────────────────────

async function testAiSearch() {
  console.log("\n── Test A: AI Search / Intent Parsing ──────────────────");

  const query = "need a plumber near Crossing Republik urgently";
  const { status, data } = await apiPost("/api/ai/prompt", { query });

  console.log(`  Query:    "${query}"`);
  console.log(`  Status:   ${status}`);
  console.log(`  Response:`);
  console.log(`    action:     ${data?.action}`);
  console.log(`    response:   ${(data?.response || "").slice(0, 160)}`);
  console.log(`    data:       ${JSON.stringify(data?.data)}`);
  console.log(`    redirect:   ${data?.redirect}`);
  console.log(`    suggestions: ${JSON.stringify(data?.suggestions)}`);

  if (!data || data.error) {
    logFail(`Request failed: ${data?.error || "no response"}`);
    return false;
  }

  /*
   * Heuristic: the keyword fallback (matchKeywords in intentParser.ts)
   * matches /\b(need)\b/ as isBuyIntent, setting action = "buy_product".
   * The LLM correctly interprets "need a plumber" as find_service.
   * If action is "buy_product", the LLM likely didn't run.
   */
  if (data.action === "buy_product") {
    logWarn(
      `Action is "buy_product" — matches keyword fallback behavior. ` +
        `LLM path may not be active. Check server logs for [intentParser] warnings.`,
    );
    return false;
  }

  if (data.action === "find_service") {
    logPass(
      `Action is "find_service" — AI path appears active ` +
        `(keyword fallback would set "buy_product" for this query)`,
    );
    return true;
  }

  logInfo(
    `Got action "${data.action}" — unclear whether LLM or fallback was used.`,
  );
  return true;
}

// ── Test B: AI Launchpad generation ─────────────────────────────────────

async function testAiLaunchpad(accessToken) {
  console.log("\n── Test B: AI Launchpad Generation ─────────────────────");

  const answers = {
    businessName: "Ramesh Plumbing Works",
    businessType: "individual",
    offeringType: "services",
    primaryCategory: "plumber",
    location: "Crossing Republik, Ghaziabad",
    latitude: null,
    longitude: null,
    serviceArea: "Crossing Republik, Vaishali, Indirapuram",
    serviceRadiusKm: 10,
    shortDescription:
      "Expert plumbing services for homes and offices with 15 years of experience in fixing leaks, installing fixtures, and water heater maintenance.",
    coreOfferings:
      "Leak repair, tap installation, bathroom fitting, geyser repair, pipe replacement",
    catalogText: "",
    pricingNotes: "Charges start from INR 299 for basic repairs",
    hours: "Mon-Sat 9:00 AM to 7:00 PM",
    phone: "+91-9876543210",
    website: "",
    brandTone: "friendly",
  };

  console.log(`  Creating draft for: ${answers.businessName}`);
  const postResult = await apiPost(
    "/api/launchpad/draft",
    { answers },
    accessToken,
  );

  console.log(`  POST status: ${postResult.status}`);

  if (!postResult.ok || !postResult.data?.ok) {
    logFail(`Draft creation failed: ${JSON.stringify(postResult.data)}`);
    return false;
  }

  const draft = postResult.data.draft;
  const draftId = draft.id;
  logPass(`Draft created with id: ${draftId}`);

  // GET the latest draft for this user
  console.log(`  Fetching draft...`);
  const getResult = await apiGet("/api/launchpad/draft", accessToken);

  if (!getResult.ok || !getResult.data?.ok) {
    logFail(`Draft fetch failed: ${JSON.stringify(getResult.data)}`);
    return false;
  }

  const fetchedDraft = getResult.data.draft;
  const generationSource = fetchedDraft?.generationSource;

  console.log(`  generationSource: ${generationSource}`);

  if (generationSource === "ai") {
    logPass(
      `Draft was AI-generated! Profile has real AI copy.`,
    );
  } else if (generationSource === "template") {
    logWarn(
      `Draft was template-generated (generationSource = "template"). ` +
        `The AI path fell back. Check:\n` +
        `    1. Migration 20260629120000 has been applied\n` +
        `    2. GOOGLE_GEMINI_API_KEY is set correctly in .env.local\n` +
        `    3. Server logs for [launchpad] AI generation failure warnings`,
    );
    return false;
  } else {
    logWarn(
      `generationSource is missing or unexpected: ${generationSource}. ` +
        `The migration may not have been applied yet.`,
    );
    return false;
  }

  // Print generated content for manual review
  console.log(`  ── Generated Content ──`);
  console.log(
    `  Bio: ${(fetchedDraft?.generatedProfile?.bio || "").slice(0, 300)}...`,
  );
  console.log(
    `  Interests: ${JSON.stringify(fetchedDraft?.generatedProfile?.interests)}`,
  );
  console.log(`  Services:`);
  for (const s of (fetchedDraft?.generatedServices || []).slice(0, 3)) {
    console.log(`    - ${s.title}: ${(s.description || "").slice(0, 120)}`);
  }
  console.log(`  FAQ:`);
  for (const faq of (fetchedDraft?.generatedFaq || []).slice(0, 3)) {
    console.log(`    Q: ${faq.question}`);
    console.log(`    A: ${(faq.answer || "").slice(0, 120)}`);
  }

  return true;
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log("══════════════════════════════════════════════════════");
  console.log("  ServiQ — AI Fixes Smoke Test");
  console.log("══════════════════════════════════════════════════════");
  console.log(`  API base URL: ${API_BASE_URL}`);
  console.log(`  Supabase URL: ${SUPABASE_URL}`);

  if (!SUPABASE_URL) {
    console.error(
      "\n❌  NEXT_PUBLIC_SUPABASE_URL is not set in .env.local",
    );
    process.exit(1);
  }
  if (!SERVICE_ROLE_KEY) {
    console.error(
      "\n❌  SUPABASE_SERVICE_ROLE_KEY is not set in .env.local",
    );
    process.exit(1);
  }

  const { accessToken } = await setupTestUser();

  const testAPassed = await testAiSearch();
  const testBPassed = await testAiLaunchpad(accessToken);

  console.log("\n══════════════════════════════════════════════════════");
  console.log("  Results");
  console.log("══════════════════════════════════════════════════════");
  console.log(`  Test A (AI Search):     ${testAPassed ? "✅ PASS" : "⚠️  WARN"}`);
  console.log(`  Test B (AI Launchpad):  ${testBPassed ? "✅ PASS" : "⚠️  WARN"}`);

  const exitCode = testAPassed && testBPassed ? 0 : 1;
  if (exitCode === 0) {
    console.log("\n  All smoke tests passed!");
  } else {
    console.log(
      "\n  Some tests produced warnings — review server logs for details.",
    );
  }
  console.log("══════════════════════════════════════════════════════\n");
  process.exit(exitCode);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
