import { expect, test } from "@playwright/test";

const adminRoutes = [
  "/admin",
  "/admin/users",
  "/admin/restaurant",
  "/admin/mall",
  "/admin/park",
  "/admin/ledger",
  "/admin/hr",
  "/admin/inventory",
  "/admin/orders",
  "/admin/receipts",
  "/admin/reports",
  "/admin/system-update",
  "/admin/accounts",
  "/pos",
  "/captain",
  "/oven",
  "/cashier-treasury",
  "/menu",
];

test.describe("Juba-SE​P authenticated browser smoke tests", () => {
  test("the bootstrapped staging administrator can open the Users page", async ({ page }) => {
    await page.goto("/admin/users", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/admin\/users(?:[?#].*)?$/);
    await expect(
      page.getByRole("heading", { name: "المستخدمين والصلاحيات" }),
    ).toBeVisible();
  });

  test("the Supabase admin session survives a hard page reload", async ({ page }) => {
    await page.goto("/admin/users", { waitUntil: "domcontentloaded" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/admin\/users(?:[?#].*)?$/);
    await expect(
      page.getByRole("heading", { name: "المستخدمين والصلاحيات" }),
    ).toBeVisible();
  });

  for (const route of adminRoutes) {
    test(`admin can open ${route} without a client-side crash`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));

      await page.goto(route, { waitUntil: "domcontentloaded" });
      const escapedRoute = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      await expect(page).toHaveURL(new RegExp(`${escapedRoute}(?:[?#].*)?$`));
      await expect(page.locator("body")).not.toContainText(
        /Application error|Internal Server Error|Unhandled Runtime Error/i,
      );
      expect(pageErrors, `Uncaught browser errors on ${route}`).toEqual([]);
    });
  }

  test("an unauthenticated visitor is redirected away from protected administration pages", async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://jupa-sep.test:3000",
      storageState: { cookies: [], origins: [] },
    });
    const guestPage = await context.newPage();

    try {
      await guestPage.goto("/admin/users", { waitUntil: "domcontentloaded" });
      await expect(guestPage).toHaveURL(/\/login(?:[?#].*)?$/, {
        timeout: 20_000,
      });
    } finally {
      await context.close();
    }
  });

  test("login shows the normal credential form after the staging admin exists", async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://jupa-sep.test:3000",
      storageState: { cookies: [], origins: [] },
    });
    const guestPage = await context.newPage();

    try {
      await guestPage.goto("/login", { waitUntil: "domcontentloaded" });
      await expect(guestPage.locator('input[autocomplete="username"]')).toBeVisible();
      await expect(
        guestPage.getByRole("heading", { name: "تسجيل الدخول للإدارة" }),
      ).toBeVisible();
      await expect(
        guestPage.getByRole("heading", { name: "تهيئة حساب المدير الأول" }),
      ).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("invalid credentials are rejected without granting a local or cached session", async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://jupa-sep.test:3000",
      storageState: { cookies: [], origins: [] },
    });
    const guestPage = await context.newPage();

    try {
      await guestPage.goto("/login", { waitUntil: "domcontentloaded" });
      await guestPage.locator('input[autocomplete="username"]').fill("pw-no-such-account");
      await guestPage.locator('input[autocomplete="current-password"]').fill("Wrong!Password2026");
      await guestPage.getByRole("button", { name: "تسجيل الدخول", exact: true }).click();

      await expect(
        guestPage.getByText(/اسم المستخدم أو كلمة المرور غير صحيحة/),
      ).toBeVisible({ timeout: 35_000 });
      await expect(guestPage).toHaveURL(/\/login(?:[?#].*)?$/);
      expect(
        await guestPage.evaluate(() => localStorage.getItem("restocash_auth_user")),
      ).toBeNull();
    } finally {
      await context.close();
    }
  });

  test("forgot-password opens the recovery form without sending an email", async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://jupa-sep.test:3000",
      storageState: { cookies: [], origins: [] },
    });
    const guestPage = await context.newPage();

    try {
      await guestPage.goto("/login", { waitUntil: "domcontentloaded" });
      await guestPage.getByRole("button", { name: "نسيت كلمة المرور؟" }).click();
      await expect(guestPage.locator('form input[type="email"]')).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("login remains usable on a narrow mobile viewport", async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://jupa-sep.test:3000",
      storageState: { cookies: [], origins: [] },
      viewport: { width: 375, height: 812 },
    });
    const mobilePage = await context.newPage();

    try {
      await mobilePage.goto("/login", { waitUntil: "domcontentloaded" });
      await expect(mobilePage.locator("div.min-h-screen").first()).toBeVisible();
      const hasHorizontalOverflow = await mobilePage.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(hasHorizontalOverflow).toBe(false);
    } finally {
      await context.close();
    }
  });
});
