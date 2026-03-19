import fs from "node:fs/promises";
import path from "node:path";
import { chromium, type FullConfig } from "@playwright/test";
import { hasE2EAuthConfig, resolveMagicLinkUrl } from "./helpers/auth";

const authDir = path.join(process.cwd(), "tests/e2e/.auth");
const authStatePath = path.join(authDir, "user.json");

const writeEmptyStorageState = async () => {
  await fs.mkdir(authDir, { recursive: true });
  await fs.writeFile(
    authStatePath,
    JSON.stringify(
      {
        cookies: [],
        origins: [],
      },
      null,
      2
    ),
    "utf8"
  );
};

export default async function globalSetup(config: FullConfig) {
  await writeEmptyStorageState();

  if (!hasE2EAuthConfig) {
    return;
  }

  const project = config.projects[0];
  const baseURL =
    (typeof project?.use?.baseURL === "string" && project.use.baseURL) || "http://127.0.0.1:3000";

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  try {
    const magicLinkUrl = await resolveMagicLinkUrl();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await page.goto(magicLinkUrl, { waitUntil: "domcontentloaded" });
        await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
        break;
      } catch (error) {
        if (attempt === 2) throw error;
        await page.waitForTimeout(1500 * (attempt + 1));
      }
    }
    await context.storageState({ path: authStatePath });
  } finally {
    await context.close();
    await browser.close();
  }
}
