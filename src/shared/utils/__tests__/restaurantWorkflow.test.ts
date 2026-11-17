import { describe, expect, it } from "vitest";
import {
  buildCartLineKey,
  formatOrderAmount,
  getAdditionsUnitPrice,
  getLineUnitPrice,
  isNonKitchenNotificationOrder,
  resolveOrderCurrencySnapshot,
  resolveProductCustomizationConfig,
  sanitizeKitchenNotes,
  shouldOpenCustomizationOnAdd,
} from "@/shared/utils/productOptions";
import { computeQualityControlSummary } from "@/shared/utils/qualityControlMetrics";
import {
  DEFAULT_MENU_RECIPES,
  NORMALIZED_RAW_MATERIALS,
  getRawMaterialSpec,
} from "@/shared/data/defaultRecipes";
import { localWarehouseStore } from "@/features/inventory/services/warehouseStore";
import { tableOrdersStore } from "@/shared/services/tableOrdersStore";

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

  it("opens customization modal whenever quickOptions or additions exist", () => {
    expect(shouldOpenCustomizationOnAdd({ name_ar: "مياه معدنية" }, "مشروبات")).toBe(true);
    expect(shouldOpenCustomizationOnAdd({ name_ar: "بيتزا مارجريتا" }, "بيتزا")).toBe(true);
    expect(
      shouldOpenCustomizationOnAdd({
        name_ar: "قهوة تركي",
        quick_options: [{ id: "sugar_none", label_ar: "سادة", label_en: "No Sugar" }],
        additions: [],
      }),
    ).toBe(true);
    expect(shouldOpenCustomizationOnAdd(null)).toBe(false);
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

  it("adds paid addition prices accurately to unit price without double-counting on reconstruction", () => {
    const additions = [
      { id: "extra_cheese", name_ar: "جبنة إضافية", price: 1.5 },
      { id: "extra_olive", name_ar: "زيتون إضافي", price: 0.6 },
    ];
    const unit = getLineUnitPrice(10, additions);
    expect(unit).toBeCloseTo(12.1, 2);

    // Simulate loading serialized order line where line.price already equals unit price
    const addsSum = getAdditionsUnitPrice(additions);
    const inferredBase = Math.max(0, Number((unit - addsSum).toFixed(2)));
    expect(inferredBase).toBeCloseTo(10, 2);
    expect(getLineUnitPrice(inferredBase, additions) * 3).toBeCloseTo(36.3, 2);
  });
});

describe("Order-level transaction currency & exchange rate snapshots", () => {
  it("preserves distinct payment currencies and rates concurrently without system default overwrite", () => {
    const fallbackRates = { USD: 1, EGP: 49, SSP: 4200 };

    const sspOrder = resolveOrderCurrencySnapshot(
      {
        total: 10,
        pricing_currency: "USD",
        payment_currency: "SSP",
        payment_exchange_rate: 4500,
      },
      "EGP",
      fallbackRates,
    );
    expect(sspOrder.pricingCurrency).toBe("USD");
    expect(sspOrder.paymentCurrency).toBe("SSP");
    expect(sspOrder.paymentExchangeRate).toBe(4500);
    expect(sspOrder.paymentAmount).toBe(45000);
    expect(
      formatOrderAmount(10, sspOrder.paymentCurrency, sspOrder.paymentExchangeRate, "ar"),
    ).toBe("45,000.00 ج.ج.س");

    const egpOrder = resolveOrderCurrencySnapshot(
      {
        total: 12.5,
        pricing_currency: "USD",
        payment_currency: "EGP",
        payment_exchange_rate: 50.5,
      },
      "USD",
      fallbackRates,
    );
    expect(egpOrder.paymentCurrency).toBe("EGP");
    expect(egpOrder.paymentExchangeRate).toBe(50.5);
    expect(egpOrder.paymentAmount).toBe(631.25);

    const usdOrder = resolveOrderCurrencySnapshot(
      {
        total: 15,
        pricing_currency: "USD",
        payment_currency: "USD",
        payment_exchange_rate: 1,
        payment_amount: 15,
      },
      "SSP",
      fallbackRates,
    );
    expect(usdOrder.paymentCurrency).toBe("USD");
    expect(usdOrder.paymentExchangeRate).toBe(1);
    expect(usdOrder.paymentAmount).toBe(15);
    expect(formatOrderAmount(15, usdOrder.paymentCurrency, 1, "en")).toBe("$15.00");
  });
});

describe("Table payment notifications lifecycle", () => {
  it("tracks awaiting_payment -> paid -> cleared only on explicit clearTablePaymentStatus", () => {
    tableOrdersStore.clearTablePaymentStatus({ tableId: "tbl-9", tableNumber: 9 });
    expect(tableOrdersStore.getTablePaymentStatus("tbl-9", 9)).toBeNull();

    tableOrdersStore.saveOrder({
      id: "ord-test-t9",
      table_id: "tbl-9",
      table_number: 9,
      table_name: "طاولة 9",
      items: [],
      order_type: "dine_in",
      notes: "[SENT_TO_CASHIER]",
      selectedAdditions: [],
      subtotal: 10,
      tax: 0,
      total: 10,
      pricing_currency: "USD",
      payment_currency: "SSP",
      payment_exchange_rate: 4500,
      payment_amount: 45000,
      status: "sent_to_cashier",
      sentToCashier: true,
    });

    expect(tableOrdersStore.getTablePaymentStatus("tbl-9", 9)).toBe("awaiting_payment");

    tableOrdersStore.completeCashierOrder({
      orderId: "ord-test-t9",
      tableId: "tbl-9",
      tableNumber: 9,
    });

    // Persists as "paid" until explicitly cleared when table becomes available/occupied
    expect(tableOrdersStore.getTablePaymentStatus("tbl-9", 9)).toBe("paid");

    tableOrdersStore.clearTablePaymentStatus({ tableId: "tbl-9", tableNumber: 9 });
    expect(tableOrdersStore.getTablePaymentStatus("tbl-9", 9)).toBeNull();
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
