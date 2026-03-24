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
const E2E_PEER_EMAIL = "serviq-e2e-peer@example.com";
const SEEDED_IDS = {
  connection: "5f4d6f4b-8eb2-4e6d-a5a0-e2e000000001",
  service: "5f4d6f4b-8eb2-4e6d-a5a0-e2e000000002",
  product: "5f4d6f4b-8eb2-4e6d-a5a0-e2e000000003",
  post: "5f4d6f4b-8eb2-4e6d-a5a0-e2e000000004",
  helpRequest: "5f4d6f4b-8eb2-4e6d-a5a0-e2e000000005",
};

const formatError = (value) => {
  if (value instanceof Error) return value.message;
  return String(value);
};

const isSeededE2EProfile = (profile) => {
  const metadata =
    profile?.metadata && typeof profile.metadata === "object" && !Array.isArray(profile.metadata)
      ? profile.metadata
      : null;
  return metadata?.seed === "e2e";
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isTransientNetworkError = (message) =>
  /fetch failed|tls|ssl|bad record mac|econnreset|socket hang up|network|timeout|temporarily unavailable/i.test(message);

const withRetry = async (label, fn, attempts = 4) => {
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = formatError(error);
      if (attempt === attempts - 1 || !isTransientNetworkError(message)) {
        throw error;
      }

      await wait(1200 * (attempt + 1));
    }
  }

  throw lastError;
};

const listUsers = async (adminClient) => {
  const { data, error } = await withRetry("list auth users", async () => {
    const result = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 500,
    });

    if (result.error && isTransientNetworkError(result.error.message)) {
      throw new Error(result.error.message);
    }

    return result;
  });

  if (error) {
    throw new Error(`Failed to list auth users: ${error.message}`);
  }

  return data.users || [];
};

const resolveUserId = async (adminClient, email) => {
  const users = await listUsers(adminClient);
  return users.find((user) => user.email?.toLowerCase() === email.toLowerCase())?.id || null;
};

const ensureAuthUser = async (adminClient, { email, userMetadata = {} }) => {
  const existingUserId = await resolveUserId(adminClient, email);
  if (existingUserId) return existingUserId;

  const createUserResult = await withRetry("create auth user", async () => {
    const result = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: userMetadata,
    });

    if (result.error && isTransientNetworkError(result.error.message)) {
      throw new Error(result.error.message);
    }

    return result;
  });

  if (createUserResult.error) {
    throw new Error(`Failed to create auth user ${email}: ${createUserResult.error.message}`);
  }

  return createUserResult.data.user?.id || (await resolveUserId(adminClient, email));
};

const upsertProfile = async (adminClient, profile) => {
  const { error } = await withRetry("upsert E2E profile", async () => {
    const result = await adminClient.from("profiles").upsert(profile, { onConflict: "id" });
    if (result.error && isTransientNetworkError(result.error.message)) {
      throw new Error(result.error.message);
    }
    return result;
  });
  if (error) {
    throw new Error(`Failed to seed profile ${profile.id}: ${error.message}`);
  }
};

const loadExistingProfile = async (adminClient, userId) => {
  const { data, error } = await withRetry("load existing profile", async () => {
    const result = await adminClient.from("profiles").select("id,metadata").eq("id", userId).maybeSingle();
    if (result.error && isTransientNetworkError(result.error.message)) {
      throw new Error(result.error.message);
    }
    return result;
  });

  if (error) {
    throw new Error(`Failed to load existing profile ${userId}: ${error.message}`);
  }

  return data || null;
};

const ensureAcceptedConnection = async (adminClient, viewerUserId, peerUserId) => {
  const { data, error } = await withRetry("load E2E connection", async () => {
    const result = await adminClient
      .from("connection_requests")
      .select("id")
      .or(
        `and(requester_id.eq.${viewerUserId},recipient_id.eq.${peerUserId}),and(requester_id.eq.${peerUserId},recipient_id.eq.${viewerUserId})`
      )
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (result.error && isTransientNetworkError(result.error.message)) {
      throw new Error(result.error.message);
    }

    return result;
  });

  if (error) {
    throw new Error(`Failed to seed E2E connection: ${error.message}`);
  }

  if (data?.id) {
    const { error: updateError } = await withRetry("update E2E connection", async () => {
      const result = await adminClient
        .from("connection_requests")
        .update({
          status: "accepted",
          metadata: {
            seed: "e2e",
          },
        })
        .eq("id", data.id);

      if (result.error && isTransientNetworkError(result.error.message)) {
        throw new Error(result.error.message);
      }

      return result;
    });

    if (updateError) {
      throw new Error(`Failed to update E2E connection: ${updateError.message}`);
    }

    return;
  }

  const { error: upsertError } = await withRetry("upsert E2E connection", async () => {
    const result = await adminClient.from("connection_requests").upsert(
      {
        id: SEEDED_IDS.connection,
        requester_id: peerUserId,
        recipient_id: viewerUserId,
        status: "accepted",
        metadata: {
          seed: "e2e",
        },
      },
      { onConflict: "id" }
    );

    if (result.error && isTransientNetworkError(result.error.message)) {
      throw new Error(result.error.message);
    }

    return result;
  });

  if (upsertError) {
    throw new Error(`Failed to upsert E2E connection: ${upsertError.message}`);
  }
};

const seedConnectedMarketplace = async (adminClient, viewerUserId, viewerEmail) => {
  const existingViewerProfile = await loadExistingProfile(adminClient, viewerUserId);
  if (existingViewerProfile && !isSeededE2EProfile(existingViewerProfile)) {
    console.warn(
      `[generate_e2e_magic_link] preserving existing marketplace graph for ${viewerEmail}; skipping seeded provider fixtures`
    );
    return;
  }

  const peerUserId = await ensureAuthUser(adminClient, {
    email: E2E_PEER_EMAIL,
    userMetadata: {
      full_name: "ServiQ Test Provider",
      role: "provider",
    },
  });

  if (!peerUserId) {
    throw new Error("Failed to resolve E2E peer user id.");
  }

  await upsertProfile(adminClient, {
    id: viewerUserId,
    full_name: "ServiQ E2E User",
    name: "ServiQ E2E User",
    location: "Bengaluru",
    role: "seeker",
    bio: "E2E account ready for marketplace discovery, welcome feed flows, chat, and task regression coverage.",
    interests: ["Local services", "Home help", "Food delivery"],
    services: ["Local services", "Home help", "Food delivery"],
    email: viewerEmail,
    availability: "available",
    onboarding_completed: true,
    profile_completion_percent: 100,
    metadata: {
      seed: "e2e",
    },
  });

  await upsertProfile(adminClient, {
    id: peerUserId,
    full_name: "ServiQ Test Provider",
    name: "ServiQ Test Provider",
    location: "Bengaluru",
    role: "provider",
    bio: "Fast local provider available for urgent repairs, home support, and same-day delivery requests.",
    interests: ["Electrical repair", "Home setup", "Urgent local help"],
    services: ["Electrical repair", "Home setup", "Urgent local help"],
    email: E2E_PEER_EMAIL,
    availability: "available",
    onboarding_completed: true,
    profile_completion_percent: 100,
    metadata: {
      seed: "e2e",
    },
  });

  await ensureAcceptedConnection(adminClient, viewerUserId, peerUserId);

  const { error: serviceError } = await withRetry("upsert E2E service listing", async () => {
    const result = await adminClient.from("service_listings").upsert(
      {
        id: SEEDED_IDS.service,
        provider_id: peerUserId,
        title: "Emergency electrician visit",
        description: "Same-day help for power faults, switches, and small home repair jobs.",
        category: "Home repair",
        price: 900,
        availability: "available",
        metadata: {
          seed: "e2e",
        },
      },
      { onConflict: "id" }
    );

    if (result.error && isTransientNetworkError(result.error.message)) {
      throw new Error(result.error.message);
    }

    return result;
  });

  if (serviceError) {
    throw new Error(`Failed to seed E2E service listing: ${serviceError.message}`);
  }

  const { error: productError } = await withRetry("upsert E2E product listing", async () => {
    const result = await adminClient.from("product_catalog").upsert(
      {
        id: SEEDED_IDS.product,
        provider_id: peerUserId,
        title: "Starter tool kit",
        description: "Compact repair kit for quick home fixes and installations.",
        category: "Tools",
        price: 1400,
        stock: 5,
        metadata: {
          seed: "e2e",
        },
      },
      { onConflict: "id" }
    );

    if (result.error && isTransientNetworkError(result.error.message)) {
      throw new Error(result.error.message);
    }

    return result;
  });

  if (productError) {
    throw new Error(`Failed to seed E2E product listing: ${productError.message}`);
  }

  const { error: postError } = await withRetry("upsert E2E marketplace post", async () => {
    const result = await adminClient.from("posts").upsert(
      {
        id: SEEDED_IDS.post,
        user_id: peerUserId,
        author_id: peerUserId,
        created_by: peerUserId,
        provider_id: peerUserId,
        title: "Emergency electrician slot open",
        text: "Emergency electrician slot open | Type: service | Category: Home repair | Budget: 900",
        description: "Connected provider slot available this evening for urgent home repair.",
        category: "Home repair",
        type: "service",
        post_type: "service",
        visibility: "connections",
        status: "open",
        state: "open",
        metadata: {
          seed: "e2e",
        },
      },
      { onConflict: "id" }
    );

    if (result.error && isTransientNetworkError(result.error.message)) {
      throw new Error(result.error.message);
    }

    return result;
  });

  if (postError) {
    throw new Error(`Failed to seed E2E marketplace post: ${postError.message}`);
  }

  const { error: helpRequestError } = await withRetry("upsert E2E help request", async () => {
    const result = await adminClient.from("help_requests").upsert(
      {
        id: SEEDED_IDS.helpRequest,
        requester_id: peerUserId,
        accepted_provider_id: null,
        title: "Need an electrician for a quick home repair",
        details: "Looking for a nearby provider to troubleshoot a small power issue and replace one faulty switch tonight.",
        category: "Home repair",
        urgency: "today",
        budget_min: 600,
        budget_max: 900,
        location_label: "Bengaluru",
        latitude: 12.9716,
        longitude: 77.5946,
        radius_km: 12,
        status: "open",
        metadata: {
          seed: "e2e",
          source: "e2e_help_request",
        },
      },
      { onConflict: "id" }
    );

    if (result.error && isTransientNetworkError(result.error.message)) {
      throw new Error(result.error.message);
    }

    return result;
  });

  if (helpRequestError) {
    throw new Error(`Failed to seed E2E help request: ${helpRequestError.message}`);
  }
};

const main = async () => {
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const loginEmail = getRequiredEnv("E2E_LOGIN_EMAIL");

  const siteUrl = (process.env.PLAYWRIGHT_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000").replace(
    /\/+$/u,
    ""
  );
  const redirectTo = `${siteUrl}/auth/callback`;

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const generateLink = async () =>
    withRetry("generate E2E magic link", async () => {
      const result = await adminClient.auth.admin.generateLink({
        type: "magiclink",
        email: loginEmail,
        options: { redirectTo },
      });

      if (result.error && isTransientNetworkError(result.error.message)) {
        throw new Error(result.error.message);
      }

      return result;
    });

  let result = await generateLink();

  if (result.error && isUserMissingError(result.error.message)) {
    const createUserResult = await withRetry("create E2E viewer auth user", async () => {
      const result = await adminClient.auth.admin.createUser({
        email: loginEmail,
        email_confirm: true,
      });

      if (result.error && isTransientNetworkError(result.error.message)) {
        throw new Error(result.error.message);
      }

      return result;
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

  const userId = result.data?.user?.id || (await resolveUserId(adminClient, loginEmail));

  if (userId) {
    await seedConnectedMarketplace(adminClient, userId, loginEmail);
  }

  process.stdout.write(actionLink);
};

main().catch((error) => {
  console.error(`[generate_e2e_magic_link] ${formatError(error)}`);
  process.exit(1);
});
