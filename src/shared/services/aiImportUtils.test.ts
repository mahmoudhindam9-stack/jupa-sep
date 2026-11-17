import { describe, expect, it } from "vitest";
import {
  DISH_IMAGE_PRESETS,
  buildBatchEmployeeDrafts,
  matchInventoryItemByName,
  normalizeUnit,
  resolveDishImageUrl,
} from "./aiImportUtils";

describe("aiImportUtils", () => {
  it("resolves matching local dish images by preset or Arabic dish name", () => {
    expect(resolveDishImageUrl("pizza")).toBe(DISH_IMAGE_PRESETS.pizza.url);
    expect(resolveDishImageUrl("تشيز برجر دبل", "سندويتشات")).toBe(
      DISH_IMAGE_PRESETS.burger.url,
    );
    expect(resolveDishImageUrl("كباب مشوي على الفحم")).toBe(DISH_IMAGE_PRESETS.grill.url);
    expect(resolveDishImageUrl("عصير مانجو طازج")).toBe(DISH_IMAGE_PRESETS.drink.url);
    expect(resolveDishImageUrl("كنافة بالقشطة")).toBe(DISH_IMAGE_PRESETS.dessert.url);
  });

  it("normalizes units and matches warehouse items across Arabic forms", () => {
    expect(normalizeUnit("كيلو")).toBe("كجم");
    expect(normalizeUnit("kg")).toBe("كجم");
    expect(normalizeUnit("حبة")).toBe("pcs");

    const inventory = [
      { id: "inv-1", name_ar: "اللحم المفروم الطازج", unit: "كجم", quantity: 10, min_level: 2, cost: 300 },
      { id: "inv-2", name_ar: "جبنة موتزاريلا", unit: "كجم", quantity: 5, min_level: 1, cost: 220 },
    ] as any[];

    expect(matchInventoryItemByName("لحم مفروم", inventory)?.id).toBe("inv-1");
    expect(matchInventoryItemByName("الجبنة موتزاريلا", inventory)?.id).toBe("inv-2");
    expect(matchInventoryItemByName("صنف غير موجود", inventory)).toBeUndefined();
  });

  it("builds unique usernames and emails across batch HR drafts without collisions", () => {
    const existingUsers = [
      {
        id: "u-1",
        username: "ahmed.ali",
        email: "ahmed.ali@restocash.com",
        full_name: "أحمد علي",
        role: "cashier",
        permissions: {},
      },
    ] as any[];

    const drafts = buildBatchEmployeeDrafts(
      [
        { name: "أحمد علي", job_title: "كاشير", salary: 6000 },
        { name: "أحمد علي", job_title: "شيف مطبخ", salary: 9500 },
        { name: "سارة محمود", job_title: "محاسبة", salary: 8000, currency: "USD" },
      ],
      existingUsers,
      1005,
    );

    expect(drafts).toHaveLength(3);
    const usernames = drafts.map((d) => d.username);
    expect(new Set(usernames).size).toBe(3);
    expect(usernames).not.toContain("ahmed.ali");
    expect(drafts[0].role).toBe("cashier");
    expect(drafts[1].role).toBe("kitchen");
    expect(drafts[2].role).toBe("accountant");
    expect(drafts[2].currency).toBe("USD");
    expect(drafts.every((d) => d.createUser && d.email.endsWith("@restocash.com"))).toBe(true);
  });
});
