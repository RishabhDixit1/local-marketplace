#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const projectRoot = process.cwd();
const envFiles = [".env", ".env.local", ".env.e2e.local"];

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

    const withoutExport = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
    const equalsIndex = withoutExport.indexOf("=");
    if (equalsIndex <= 0) continue;

    const key = withoutExport.slice(0, equalsIndex).trim();
    const rawValue = withoutExport.slice(equalsIndex + 1);
    if (!key || process.env[key]) continue;
    process.env[key] = parseEnvValue(rawValue);
  }
};

for (const file of envFiles) {
  loadEnvFile(path.join(projectRoot, file));
}

const getRequiredEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
};

const isUserMissingError = (message) => /user not found|email not found|no user/i.test(message);

const formatError = (value) => {
  if (value instanceof Error) return value.message;
  return String(value);
};

const main = async () => {
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const loginEmail = getRequiredEnv("E2E_LOGIN_EMAIL");

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/u, "");
  const redirectTo = `${siteUrl}/auth/callback`;

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const generateLink = async () =>
    adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: loginEmail,
      options: { redirectTo },
    });

  let result = await generateLink();

  if (result.error && isUserMissingError(result.error.message)) {
    const createUserResult = await adminClient.auth.admin.createUser({
      email: loginEmail,
      email_confirm: true,
    });

    if (createUserResult.error) {
      throw new Error(`Failed to create E2E user: ${createUserResult.error.message}`);
    }

    result = await generateLink();
  }

  if (result.error) {
    throw new Error(`Failed to generate magic link: ${result.error.message}`);
  }

  const actionLink = result.data?.properties?.action_link;
  if (!actionLink) {
    throw new Error("Magic link response did not include properties.action_link");
  }

  process.stdout.write(actionLink);
};

main().catch((error) => {
  console.error(`[generate_e2e_magic_link] ${formatError(error)}`);
  process.exit(1);
});
