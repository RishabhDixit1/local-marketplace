import { createClient } from "@supabase/supabase-js";

const staticMagicLinkUrl = process.env.E2E_MAGIC_LINK_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const loginEmail = process.env.E2E_LOGIN_EMAIL;
const siteUrl = (process.env.PLAYWRIGHT_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000").replace(
  /\/+$/u,
  ""
);
const redirectTo = `${siteUrl}/auth/callback`;

const canGenerateMagicLink = Boolean(supabaseUrl && serviceRoleKey && loginEmail);

export const hasE2EAuthConfig = Boolean(staticMagicLinkUrl || canGenerateMagicLink);

const getAdminClient = () => {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

const isMissingUserError = (message: string) => /user not found|email not found|no user/i.test(message);
const isTransientNetworkError = (message: string) =>
  /fetch failed|tls|ssl|bad record mac|econnreset|socket hang up|network|timeout|temporarily unavailable/i.test(message);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async <T>(fn: () => Promise<T>, attempts = 4) => {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === attempts - 1 || !isTransientNetworkError(message)) {
        throw error;
      }

      await wait(1200 * (attempt + 1));
    }
  }

  throw lastError;
};

const resolveUserId = async (email: string) => {
  const adminClient = getAdminClient();
  if (!adminClient) return null;

  const { data, error } = await withRetry(async () => {
    const result = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });

    if (result.error && isTransientNetworkError(result.error.message)) {
      throw new Error(result.error.message);
    }

    return result;
  });

  if (error) {
    throw new Error(`Failed to list auth users: ${error.message}`);
  }

  return data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())?.id || null;
};

const seedE2EProfile = async (userId: string, email: string) => {
  const adminClient = getAdminClient();
  if (!adminClient) return;

  const { error } = await withRetry(async () => {
    const result = await adminClient.from("profiles").upsert(
      {
        id: userId,
        full_name: "ServiQ E2E User",
        name: "ServiQ E2E User",
        location: "Bengaluru",
        role: "seeker",
        bio: "E2E account ready for marketplace discovery, welcome feed flows, chat, and task regression coverage.",
        interests: ["Local services", "Home help", "Food delivery"],
        services: ["Local services", "Home help", "Food delivery"],
        email,
        availability: "available",
        onboarding_completed: true,
        profile_completion_percent: 100,
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

  if (error) {
    throw new Error(`Failed to seed E2E profile: ${error.message}`);
  }
};

const generateMagicLink = async () => {
  if (!canGenerateMagicLink || !loginEmail) return null;

  const adminClient = getAdminClient();
  if (!adminClient) return null;

  const createLink = async () =>
    withRetry(async () => {
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

  let result = await createLink();

  if (result.error && isMissingUserError(result.error.message)) {
    const createUserResult = await withRetry(async () => {
      const result = await adminClient.auth.admin.createUser({
        email: loginEmail,
        email_confirm: true,
      });

      if (result.error && isTransientNetworkError(result.error.message)) {
        throw new Error(result.error.message);
      }

      return result;
    });

    if (!createUserResult.error) {
      result = await createLink();
    }
  }

  if (result.error) {
    throw new Error(`Failed to generate E2E magic link: ${result.error.message}`);
  }

  const actionLink = result.data?.properties?.action_link;
  if (!actionLink) {
    throw new Error("E2E magic-link generation returned no action_link");
  }

  const userId = result.data?.user?.id || (await resolveUserId(loginEmail));
  if (userId) {
    await seedE2EProfile(userId, loginEmail);
  }

  return actionLink;
};

export const resolveMagicLinkUrl = async () => {
  if (staticMagicLinkUrl) return staticMagicLinkUrl;

  const generatedLink = await generateMagicLink();
  if (generatedLink) return generatedLink;

  throw new Error(
    "Missing E2E auth config. Provide E2E_MAGIC_LINK_URL or NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + E2E_LOGIN_EMAIL."
  );
};
