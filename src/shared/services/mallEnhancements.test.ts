import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_MALL_SHOPS,
  detectMallShopLocationFromNumber,
  erpStore,
  formatMallShopSerial,
  resolveMallShopLocation,
} from "./erpStore";
import { getShopCustomFieldsDisplayList } from "@/components/mall/EditShopDataAdminPanel";

describe("Mall Management Targeted Enhancements", () => {
  beforeEach(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
    erpStore.state = erpStore.getDefaultState();
    erpStore.syncMallShops(false);
  });

  it("provides 51 canonical Mall shops with unique shop numbers and permanent serial numbers", () => {
    expect(DEFAULT_MALL_SHOPS.length).toBe(51);
    const shops = erpStore.getState().mallShops;
    expect(shops.length).toBe(51);

    const shopNumbers = new Set(shops.map((s) => s.shop_number.toUpperCase()));
    const serialNumbers = new Set(shops.map((s) => s.serial_number));
    expect(shopNumbers.size).toBe(51);
    expect(serialNumbers.size).toBe(51);
    expect(shops[0].serial_number).toBe("SHP-0001");
    expect(shops[50].serial_number).toBe("SHP-0051");
  });

  it("detects shop location automatically from shop number prefix and supports manual override", () => {
    expect(detectMallShopLocationFromNumber("D1")).toBe("central");
    expect(detectMallShopLocationFromNumber("d32")).toBe("central");
    expect(detectMallShopLocationFromNumber("B5")).toBe("park");
    expect(detectMallShopLocationFromNumber("G9")).toBe("ground_floor");
    expect(detectMallShopLocationFromNumber("F4")).toBe("first_floor");
    expect(detectMallShopLocationFromNumber("R1")).toBe("roof");
    expect(detectMallShopLocationFromNumber("X99")).toBe("other");
    expect(detectMallShopLocationFromNumber("")).toBe("other");

    // Auto mode follows prefix
    expect(
      resolveMallShopLocation({
        shop_number: "F2",
        location_override: false,
        location_zone: "park",
      }),
    ).toBe("first_floor");

    // Manual override overrides prefix
    expect(
      resolveMallShopLocation({
        shop_number: "F2",
        location_override: true,
        location_zone: "roof",
      }),
    ).toBe("roof");
  });

  it("preserves permanent serial_number and separates construction_status from rental status on shop add/update", () => {
    const created = erpStore.addMallShop({
      shop_number: "F20",
      name_ar: "معرض إلكترونيات حديث",
      account_number: "14010999",
      tenant_name: "شركة النور",
      phone: "0123456789",
      monthly_rent: 950,
      status: "rented",
      construction_status: "fitted",
      space_sqm: 75,
    });

    expect(created.serial_number).toBe(formatMallShopSerial(52));
    expect(created.location_zone).toBe("first_floor");
    expect(created.location_override).toBe(false);
    expect(created.construction_status).toBe("fitted");
    expect(created.status).toBe("rented");

    // Update shop_number to R20 and construction_status to red_brick; serial_number must remain permanent
    erpStore.updateMallShop(created.id, {
      shop_number: "R20",
      construction_status: "red_brick",
      status: "vacant",
    });

    const updated = erpStore.getState().mallShops.find((s) => s.id === created.id)!;
    expect(updated.serial_number).toBe("SHP-0052");
    expect(updated.shop_number).toBe("R20");
    expect(updated.location_zone).toBe("roof");
    expect(updated.construction_status).toBe("red_brick");
    expect(updated.status).toBe("vacant");

    // Enable manual location override
    erpStore.updateMallShop(created.id, {
      location_override: true,
      location_zone: "central",
    });
    const overridden = erpStore.getState().mallShops.find((s) => s.id === created.id)!;
    expect(overridden.location_override).toBe(true);
    expect(overridden.location_zone).toBe("central");
  });

  it("supports Dynamic Custom Fields CRUD, reordering, enabling/disabling, archiving, and shop value formatting", () => {
    const initialFields = erpStore.getMallCustomFields(true);
    expect(initialFields.length).toBeGreaterThanOrEqual(3);

    const multiField = erpStore.addMallCustomField({
      name_ar: "أنظمة الأمان المتوفرة",
      name_en: "Safety Systems",
      type: "multiple_choice",
      options: ["رشاشات مياه", "كاميرات مراقبة", "إنذار حريق"],
      required: true,
      enabled: true,
    });

    expect(multiField.type).toBe("multiple_choice");
    expect(multiField.options).toEqual(["رشاشات مياه", "كاميرات مراقبة", "إنذار حريق"]);

    // Update options
    erpStore.updateMallCustomField(multiField.id, {
      options: ["رشاشات مياه", "كاميرات مراقبة", "إنذار حريق", "مخرج طوارئ"],
    });
    const updatedDef = erpStore
      .getMallCustomFields(true)
      .find((f) => f.id === multiField.id)!;
    expect(updatedDef.options?.length).toBe(4);

    // Move field up
    const orderBefore = updatedDef.order;
    erpStore.moveMallCustomField(multiField.id, "up");
    const movedDef = erpStore.getMallCustomFields(true).find((f) => f.id === multiField.id)!;
    expect(movedDef.order).toBeLessThan(orderBefore);

    // Assign custom field values to shop D1
    const shopD1 = erpStore.getState().mallShops.find((s) => s.shop_number === "D1")!;
    erpStore.updateMallShop(shopD1.id, {
      custom_fields: {
        [multiField.key]: ["رشاشات مياه", "إنذار حريق"],
        electricity_meter_no: "EL-99881",
        has_water_connection: true,
      },
    });

    const refreshedD1 = erpStore.getState().mallShops.find((s) => s.id === shopD1.id)!;
    const activeFields = erpStore.getMallCustomFields(false);
    const displayList = getShopCustomFieldsDisplayList(refreshedD1, activeFields);

    const multiDisplay = displayList.find((d) => d.field.id === multiField.id);
    expect(multiDisplay?.hasValue).toBe(true);
    expect(multiDisplay?.value).toBe("رشاشات مياه ، إنذار حريق");

    // Archive field -> hidden from active list, but value remains safely stored on shop
    erpStore.archiveMallCustomField(multiField.id, true);
    expect(
      erpStore.getMallCustomFields(false).some((f) => f.id === multiField.id),
    ).toBe(false);
    expect(
      erpStore.getState().mallShops.find((s) => s.id === shopD1.id)?.custom_fields?.[
        multiField.key
      ],
    ).toEqual(["رشاشات مياه", "إنذار حريق"]);
  });

  it("reconciles 42 legacy shops into 51 shops non-destructively while preserving contracts, tenants, and payments", () => {
    // Simulate legacy 42-shop state (missing F1-F8 and R1) with an active contract and payment on D1
    const legacy42Shops = DEFAULT_MALL_SHOPS.slice(0, 42).map((s) =>
      s.shop_number === "D1"
        ? {
            ...s,
            tenant_name: "مستأجر معدل خاص",
            monthly_rent: 1500,
            construction_status: "fitted" as const,
            custom_fields: { electricity_meter_no: "MTR-777" },
            contract: {
              start_date: "2026-01-01",
              end_date: "2026-12-31",
              deposit_amount: 3000,
              advance_payment: 500,
              nationality: "Sudanese",
              id_number: "PASS-12345",
              terms: "شروط عقد خاصة محفوظة",
              language: "ar" as const,
              created_at: "2026-01-01T00:00:00.000Z",
            },
          }
        : s,
    );

    erpStore.state.mallShops = legacy42Shops;
    erpStore.state.mallPayments = [
      {
        id: "pay-test-1",
        shop_id: "shop-d1",
        year: 2026,
        month: 5,
        amount_due: 1500,
        amount_paid: 1500,
        status: "paid",
        payment_date: "2026-05-03",
        payment_method: "cash",
        receipt_number: "REC-5555",
      },
    ];

    expect(erpStore.getState().mallShops.length).toBe(42);

    // Run non-destructive sync (and test resetMallData alias)
    const report = erpStore.resetMallData();

    expect(report.previousCount).toBe(42);
    expect(report.finalCount).toBe(51);
    expect(report.recoveredFromOracle).toEqual([
      "F1",
      "F2",
      "F3",
      "F4",
      "F5",
      "F6",
      "F7",
      "F8",
      "R1",
    ]);
    expect(report.preservedContractsCount).toBe(1);
    expect(report.preservedPaymentsCount).toBe(1);

    const syncedD1 = erpStore.getState().mallShops.find((s) => s.shop_number === "D1")!;
    expect(syncedD1.id).toBe("shop-d1");
    expect(syncedD1.tenant_name).toBe("مستأجر معدل خاص");
    expect(syncedD1.monthly_rent).toBe(1500);
    expect(syncedD1.construction_status).toBe("fitted");
    expect(syncedD1.custom_fields?.electricity_meter_no).toBe("MTR-777");
    expect(syncedD1.contract?.id_number).toBe("PASS-12345");
    expect(erpStore.getState().mallPayments.length).toBe(1);
    expect(erpStore.getState().mallPayments[0].receipt_number).toBe("REC-5555");
  });
});
