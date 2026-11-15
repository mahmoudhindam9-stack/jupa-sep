import { describe, expect, it, beforeEach } from "vitest";
import {
  buildCartLineKey,
  getLineUnitPrice,
  resolveProductCustomizationConfig,
  sanitizeKitchenNotes,
  isNonKitchenNotificationOrder,
} from "@/shared/utils/productOptions";
import { computeQualityControlSummary } from "@/shared/utils/qualityControlMetrics";
import {
  DEFAULT_MENU_RECIPES,
  NORMALIZED_RAW_MATERIALS,
  getRawMaterialSpec,
} from "@/shared/data/defaultRecipes";
import { localWarehouseStore } from "@/features/inventory/services/warehouseStore";

describe("Product-specific customization & cart line separation", () => {
  it("resolves tailored quick options for water, hot drinks, and pizzas", () => {
    const waterCfg = resolveProductCustomizationConfig({ name_ar: "مياه معدنية" }, "مشروبات");
    expect(waterCfg.quickOptions.some((o) => o.id === "water_cold")).toBe(true);
    expect(waterCfg.quickOptions.some((o) => o.id === "water_cup")).toBe(true);
    expect(waterCfg.additions).toHaveLength(0);

    const coffeeCfg = resolveProductCustomizationConfig({ name_ar: "قهوة تركي" }, "مشروبات");
    expect(coffeeCfg.quickOptions.some((o) => o.id === "sugar_medium")).toBe(true);

    const pizzaCfg = resolveProductCustomizationConfig({ name_ar: "بيتزا مارجريتا" }, "بيتزا");
    expect(pizzaCfg.quickOptions.some((o) => o.id === "no_onion")).toBe(true);
    expect(pizzaCfg.additions.some((a) => a.materialKey === "mozzarella")).toBe(true);
  });

  it("produces distinct lineKeys for identical menu items with different options or notes", () => {
    const k1 = buildCartLineKey({
      itemId: "item-water",
      selectedOptions: [{ id: "water_cold", label_ar: "بارد", label_en: "Cold" }],
    });
    const k2 = buildCartLineKey({
      itemId: "item-water",
      selectedOptions: [{ id: "water_room", label_ar: "درجة حرارة الغرفة", label_en: "Room Temp" }],
    });
    const k3 = buildCartLineKey({
      itemId: "item-water",
      selectedOptions: [{ id: "water_cold", label_ar: "بارد", label_en: "Cold" }],
      notes: "بدون ثلج",
    });
    const k1Dup = buildCartLineKey({
      itemId: "item-water",
      selectedOptions: [{ id: "water_cold", label_ar: "بارد", label_en: "Cold" }],
    });

    expect(k1).not.toBe(k2);
    expect(k1).not.toBe(k3);
    expect(k1).toBe(k1Dup);
  });

  it("adds paid addition prices accurately to unit price", () => {
    const unit = getLineUnitPrice(10, [
      { id: "extra_cheese", name_ar: "جبنة إضافية", price: 1.5 },
      { id: "extra_olive", name_ar: "زيتون إضافي", price: 0.6 },
    ]);
    expect(unit).toBeCloseTo(12.1, 2);
  });
});

describe("Kitchen display sanitization & non-food notification filtering", () => {
  it("strips exchange factor, currency, totals, and internal tags while keeping prep notes", () => {
    const raw =
      "[SENT_TO_KITCHEN] | العملة: EGP | المعامل: 49.5 | رسوم التوصيل: 25 | الإجمالي: 500 | بدون بصل، تسوية كاملة";
    const cleaned = sanitizeKitchenNotes(raw);
    expect(cleaned).not.toContain("EGP");
    expect(cleaned).not.toContain("49.5");
    expect(cleaned).not.toContain("500");
    expect(cleaned).not.toContain("[SENT_TO_KITCHEN]");
    expect(cleaned).toContain("بدون بصل");
  });

  it("filters out Captain calls and bill requests without hiding kitchen food orders", () => {
    expect(
      isNonKitchenNotificationOrder({
        notes: "[TABLE_ASSISTANCE_CALL] طاولة #2 تستدعي الكابتن",
        items: [{ is_assistance_call: true, request_type: "call_captain" }],
      }),
    ).toBe(true);

    expect(
      isNonKitchenNotificationOrder({
        request_type: "request_bill",
        notes: "طلب الفاتورة",
        items: [{ request_type: "request_bill" }],
      }),
    ).toBe(true);

    expect(
      isNonKitchenNotificationOrder({
        notes: "[SENT_TO_KITCHEN] طاولة #4",
        items: [{ id: "m1", name_ar: "بيتزا مارجريتا", quantity: 1 }],
      }),
    ).toBe(false);
  });
});

describe("Quality Control metrics aggregation", () => {
  it("computes real stage durations, bottleneck stage, ratings, CSAT, and recommendations", () => {
    const base = new Date("2026-11-15T12:00:00Z").getTime();
    const t = (offsetSec: number) => new Date(base + offsetSec * 1000).toISOString();

    const orders = [
      {
        id: "ord-1",
        order_number: 101,
        is_qr_order: true,
        status: "delivered",
        submitted_at: t(0),
        captain_confirmed_at: t(60), // 1m
        kitchen_started_at: t(90),
        ready_at: t(450), // 6m kitchen prep
        delivered_at: t(690), // 4m wait -> total 11m30s (690s)
        customer_name: "أحمد",
        items: [{ name_ar: "بيتزا مارجريتا", quantity: 1 }],
      },
      {
        id: "ord-2",
        order_number: 102,
        is_qr_order: true,
        status: "preparing",
        submitted_at: t(0),
        captain_confirmed_at: t(30),
        kitchen_started_at: t(45),
        items: [{ name_ar: "تشيز برجر", quantity: 2 }],
      },
      {
        id: "call-1",
        notes: "[TABLE_ASSISTANCE_CALL]",
        items: [{ is_assistance_call: true }],
      },
    ];

    const feedbacks = [
      {
        order_id: "ord-1",
        rating: 2,
        comment: "الأكل وصل بارد وتأخر في التسليم",
        customer_name: "أحمد",
        customer_phone: "01000000001",
      },
    ];

    const summary = computeQualityControlSummary(orders, feedbacks);
    expect(summary.totalQrOrders).toBe(2);
    expect(summary.deliveredCount).toBe(1);
    expect(summary.activeCount).toBe(1);
    expect(summary.deliveryRatePercent).toBe(50);
    expect(summary.averageRating).toBe(2);
    expect(summary.csatPercent).toBe(0);
    expect(summary.bottleneckStage?.key).toBe("kitchen_prep");
    expect(summary.complaintCategories.length).toBeGreaterThan(0);
    expect(summary.recommendations.length).toBeGreaterThan(0);
  });
});

describe("Default Recipes & Inventory Deduction Lock", () => {
  it("defines 21+ menu recipes mapped to valid normalized raw materials with shared ingredients", () => {
    expect(DEFAULT_MENU_RECIPES.length).toBeGreaterThanOrEqual(21);
    expect(NORMALIZED_RAW_MATERIALS.length).toBeGreaterThanOrEqual(30);

    for (const recipe of DEFAULT_MENU_RECIPES) {
      expect(recipe.ingredients.length).toBeGreaterThan(0);
      expect(recipe.prep_instructions.length).toBeGreaterThan(10);
      for (const ing of recipe.ingredients) {
        expect(ing.weight).toBeGreaterThan(0);
        expect(getRawMaterialSpec(ing.materialKey)).toBeDefined();
      }
    }

    const mozzarellaConsumers = DEFAULT_MENU_RECIPES.filter((r) =>
      r.ingredients.some((i) => i.materialKey === "mozzarella"),
    );
    expect(mozzarellaConsumers.length).toBeGreaterThanOrEqual(3);
  });

  it("enforces single-deduction lock and reversal on localWarehouseStore", () => {
    localWarehouseStore.unmarkOrderDeducted("order-lock-test");
    expect(localWarehouseStore.isOrderDeducted("order-lock-test")).toBe(false);
    localWarehouseStore.markOrderDeducted("order-lock-test");
    expect(localWarehouseStore.isOrderDeducted("order-lock-test")).toBe(true);
    localWarehouseStore.unmarkOrderDeducted("order-lock-test");
    expect(localWarehouseStore.isOrderDeducted("order-lock-test")).toBe(false);
  });
});
