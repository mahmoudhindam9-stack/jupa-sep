import { chromium, expect, type FullConfig } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const authStatePath = path.resolve("playwright/.auth/admin.json");

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = String(
    config.projects[0]?.use.baseURL ||
      process.env.PLAYWRIGHT_BASE_URL ||
      "http://jupa-sep.test:3000",
  );
  const parsedBaseURL = new URL(baseURL);
  const supabaseURL = new URL(process.env.VITE_SUPABASE_URL || "");

  if (
    parsedBaseURL.origin !== "http://jupa-sep.test:3000" ||
    supabaseURL.protocol !== "http:" ||
    supabaseURL.hostname !== "127.0.0.1" ||
    supabaseURL.port !== "54321" ||
    process.env.VITE_E2E_ISOLATED !== "true"
  ) {
    throw new Error(
      "Refusing to bootstrap an E2E account outside the isolated local Juba-SE​P test stack.",
    );
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  try {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    const bootstrapHeading = page.getByRole("heading", {
      name: "تهيئة حساب المدير الأول",
    });
    await expect(bootstrapHeading).toBeVisible({ timeout: 60_000 });

    const form = page.locator("form").first();
    const unique = randomUUID().replaceAll("-", "").slice(0, 16);
    const username = `pwadmin${unique}`;
    const email = `${username}@example.com`;
    const password = `Pw!${unique}Aa9`;

    await form.locator('input[autocomplete="name"]').fill("Playwright Isolated Admin");
    await form.locator('input[type="email"]').fill(email);
    await form.locator('input[autocomplete="username"]').fill(username);

    const passwordFields = form.locator('input[autocomplete="new-password"]');
    await expect(passwordFields).toHaveCount(2);
    await passwordFields.nth(0).fill(password);
    await passwordFields.nth(1).fill(password);

    await form
      .getByRole("button", { name: "إنشاء أول مدير في Supabase", exact: true })
      .click();

    await expect(page).toHaveURL(/\/admin\/users(?:[?#].*)?$/, {
      timeout: 60_000,
    });
    await expect(
      page.getByText("أنشأت Supabase حساب Auth، لكن لم يُنشأ ملف المدير الأول بصلاحياته."),
    ).toHaveCount(0);

    await mkdir(path.dirname(authStatePath), { recursive: true });
    await context.storageState({ path: authStatePath });
  } catch (error) {
    await mkdir(path.resolve("test-results"), { recursive: true });
    await page
      .screenshot({
        path: path.resolve("test-results/global-setup-failure.png"),
        fullPage: true,
      })
      .catch(() => undefined);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}
