import { defineConfig, devices } from "@playwright/test";

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || DEFAULT_BASE_URL;
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === "1";

const localWebServer = (() => {
  try {
    const url = new URL(baseURL);
    const isLocalHost = url.hostname === "127.0.0.1" || url.hostname === "localhost";
    if (!isLocalHost || (url.protocol !== "http:" && url.protocol !== "https:")) return null;

    return {
      url: url.origin,
      port: url.port || (url.protocol === "https:" ? "443" : "80"),
    };
  } catch {
    const fallbackUrl = new URL(DEFAULT_BASE_URL);
    return {
      url: fallbackUrl.origin,
      port: fallbackUrl.port,
    };
  }
})();

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "tests/e2e/global-setup.ts",
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    storageState: "tests/e2e/.auth/user.json",
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: skipWebServer || !localWebServer
    ? undefined
    : {
        command: `npm run dev -- --port ${localWebServer.port}`,
        url: localWebServer.url,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
