import { createClient } from "@supabase/supabase-js";

const staticMagicLinkUrl = process.env.E2E_MAGIC_LINK_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const loginEmail = process.env.E2E_LOGIN_EMAIL;
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000").replace(/\/+$/u, "");
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

const generateMagicLink = async () => {
  if (!canGenerateMagicLink || !loginEmail) return null;

  const adminClient = getAdminClient();
  if (!adminClient) return null;

  const createLink = async () =>
    adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: loginEmail,
      options: { redirectTo },
    });

  let result = await createLink();

  if (result.error && isMissingUserError(result.error.message)) {
    const createUserResult = await adminClient.auth.admin.createUser({
      email: loginEmail,
      email_confirm: true,
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

  return actionLink;
};

export const resolveMagicLinkUrl = async () => {
  const generatedLink = await generateMagicLink();
  if (generatedLink) return generatedLink;

  if (staticMagicLinkUrl) return staticMagicLinkUrl;

  throw new Error(
    "Missing E2E auth config. Provide E2E_MAGIC_LINK_URL or NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + E2E_LOGIN_EMAIL."
  );
};
