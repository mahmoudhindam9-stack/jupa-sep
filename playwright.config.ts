import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://jupa-sep.test:3000";
const supabaseURL = process.env.VITE_SUPABASE_URL ?? "";
const authStatePath = path.resolve("playwright/.auth/admin.json");

const parsedBaseURL = new URL(baseURL);
const parsedSupabaseURL = new URL(supabaseURL);

if (parsedBaseURL.origin !== "http://jupa-sep.test:3000") {
  throw new Error(
    "Playwright is restricted to the local Juba-SE​P test host http://jupa-sep.test:3000.",
  );
}

if (
  process.env.VITE_E2E_ISOLATED !== "true" ||
  parsedSupabaseURL.protocol !== "http:" ||
  parsedSupabaseURL.hostname !== "127.0.0.1" ||
  parsedSupabaseURL.port !== "54321"
) {
  throw new Error(
    "Playwright stopped: use VITE_E2E_ISOLATED=true and the disposable local Supabase API at http://127.0.0.1:54321. Production and hosted databases are not allowed.",
  );
}

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 12_000,
  },
  reporter: process.env.CI
    ? [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : "list",
  outputDir: "test-results",
  use: {
    baseURL,
    storageState: authStatePath,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 12_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --host 0.0.0.0 --port 3000",
    url: "http://127.0.0.1:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
