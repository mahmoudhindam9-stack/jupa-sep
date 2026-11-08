import { describe, expect, it } from "vitest";
import {
  assertBalancedJournalLines,
  assertPositiveAmount,
  assertSameCurrency,
  assertValidExchangeRate,
} from "./financialGuards";

describe("financialGuards", () => {
  it("accepts positive monetary amounts", () => {
    expect(assertPositiveAmount("125.50")).toBe(125.5);
  });

  it("rejects zero, negative and non-finite amounts", () => {
    expect(() => assertPositiveAmount(0)).toThrow();
    expect(() => assertPositiveAmount(-1)).toThrow();
    expect(() => assertPositiveAmount("not-a-number")).toThrow();
  });

  it("accepts only positive finite exchange rates", () => {
    expect(assertValidExchangeRate("2.5")).toBe(2.5);
    expect(() => assertValidExchangeRate(0)).toThrow();
    expect(() => assertValidExchangeRate(-2)).toThrow();
  });

  it("rejects unbalanced or malformed journal lines", () => {
    expect(() =>
      assertBalancedJournalLines([
        { debit: 100, credit: 0 },
        { debit: 0, credit: 90 },
      ]),
    ).toThrow();

    expect(() => assertBalancedJournalLines([{ debit: 100, credit: 0 }])).toThrow();

    expect(() =>
      assertBalancedJournalLines([
        { debit: 100, credit: 20 },
        { debit: 0, credit: 80 },
      ]),
    ).toThrow();
  });

  it("accepts balanced journal entries", () => {
    expect(() =>
      assertBalancedJournalLines([
        { debit: 100, credit: 0 },
        { debit: 0, credit: 100 },
      ]),
    ).not.toThrow();
  });

  it("requires an explicit currency match", () => {
    expect(assertSameCurrency("usd", "USD")).toBe("USD");
    expect(() => assertSameCurrency("USD", "EGP")).toThrow();
  });

  it("ensures creating, editing, renewing, or terminating a mall contract never generates financial transactions or accounting entries", async () => {
    const { erpStore } = await import("./erpStore");
    const state = erpStore.getState();
    if (!state.mallShops || state.mallShops.length === 0) {
      erpStore.resetMallData();
    }
    const targetShop = erpStore.getState().mallShops[0];
    expect(targetShop).toBeDefined();

    const initialJournalCount = (erpStore.getState().journalEntries || []).length;
    const initialTreasuryTxCount = (erpStore.getState().treasuryTransactions || []).length;
    const initialTreasuryBalances = (erpStore.getState().treasuries || []).map((t) => ({
      id: t.id,
      balance: t.balance,
    }));

    const treasuryId = erpStore.getState().treasuries?.[0]?.id || "t-main";

    // 1. Create / renew contract with deposit & advance payment
    erpStore.createMallContract(
      targetShop.id,
      {
        tenant_name: "مستأجر تجريبي للعقود المستقلة",
        phone: "01099999999",
        monthly_rent: 2500,
        status: "rented",
        contract: {
          start_date: "2026-01-01",
          end_date: "2027-01-01",
          deposit_amount: 5000,
          advance_payment: 2500,
          nationality: "مصري",
          id_number: "123456789",
          terms: "شروط عقد مستقل",
          created_at: new Date().toISOString(),
        },
      },
      treasuryId,
    );

    expect((erpStore.getState().journalEntries || []).length).toBe(initialJournalCount);
    expect((erpStore.getState().treasuryTransactions || []).length).toBe(initialTreasuryTxCount);

    // 2. Edit contract / shop details
    erpStore.updateMallShop(targetShop.id, {
      monthly_rent: 3000,
      tenant_name: "مستأجر تجريبي معدل",
    });

    expect((erpStore.getState().journalEntries || []).length).toBe(initialJournalCount);
    expect((erpStore.getState().treasuryTransactions || []).length).toBe(initialTreasuryTxCount);

    // 3. Terminate contract
    erpStore.terminateMallContract(
      {
        shop_id: targetShop.id,
        shop_number: targetShop.shop_number,
        shop_name: targetShop.name_ar,
        tenant_name: "مستأجر تجريبي معدل",
        phone: "01099999999",
        monthly_rent: 3000,
        deposit_amount: 5000,
        refund_amount: 5000,
        start_date: "2026-01-01",
        end_date: "2027-01-01",
        termination_date: "2026-06-01",
        notes: "فسخ عقد بدون أثر مالي تلقائي",
      },
      treasuryId,
    );

    expect((erpStore.getState().journalEntries || []).length).toBe(initialJournalCount);
    expect((erpStore.getState().treasuryTransactions || []).length).toBe(initialTreasuryTxCount);
    expect(
      (erpStore.getState().treasuries || []).map((t) => ({ id: t.id, balance: t.balance })),
    ).toEqual(initialTreasuryBalances);

    const updatedShop = erpStore.getState().mallShops.find((s) => s.id === targetShop.id);
    expect(updatedShop?.status).toBe("vacant");
  });

  it("completes unified financial document workflow (create, edit, delete, custom category) with single journal entry and audit history", async () => {
    const { erpStore } = await import("./erpStore");
    const state = erpStore.getState();
    const treasury = state.treasuries.find((t) => !t.deleted) || state.treasuries[0];
    expect(treasury).toBeDefined();

    // 1. Add custom category for Mall receipt
    const customCat = erpStore.addCustomVoucherCategory({
      type: "receipt",
      department: "mall",
      name: "إيراد مساحات إعلانية بالمول",
      account_code: "43010100",
    });
    expect(customCat.name).toBe("إيراد مساحات إعلانية بالمول");

    const beforeJournalCount = erpStore.getState().journalEntries.length;
    const beforeTreasuryBal = Number(treasury.balance || 0);

    // 2. Create Receipt Voucher for Mall
    const created = erpStore.createVoucher(
      "receipt",
      customCat.name,
      1500,
      treasury.id,
      "تحصيل إيجار لوحة إعلانية بالمول",
      "المول التجاري (Mall)",
      undefined,
      "EGP",
      50,
      "43010100",
      {
        department: "mall",
        beneficiary: "شركة النور للإعلان",
      },
    );

    expect(created.reference_number).toBeDefined();
    expect(created.department).toBe("mall");
    expect(created.amount).toBe(1500);
    // Strictly ONE journal entry created (no duplicate from addTreasuryTransaction)
    expect(erpStore.getState().journalEntries.length).toBe(beforeJournalCount + 1);
    expect(Number(treasury.balance)).toBe(beforeTreasuryBal + 1500);
    expect(created.audit_history?.length).toBe(1);
    expect(created.audit_history?.[0].action).toBe("created");

    // 3. Edit Voucher amount and description
    const updated = erpStore.updateVoucher(created.id, {
      amount: 2200,
      description: "تحصيل إيجار لوحتين إعلانيتين بالمول بعد التعديل",
    });

    expect(updated.amount).toBe(2200);
    // Still strictly ONE journal entry (updated in-place, not duplicated)
    expect(erpStore.getState().journalEntries.length).toBe(beforeJournalCount + 1);
    const linkedJe = erpStore
      .getState()
      .journalEntries.find((je) => je.id === updated.journal_entry_id);
    expect(linkedJe?.lines[0].debit).toBe(2200);
    expect(linkedJe?.lines[1].credit).toBe(2200);
    expect(Number(treasury.balance)).toBe(beforeTreasuryBal + 2200);
    expect(updated.audit_history?.length).toBe(2);
    expect(updated.audit_history?.[1].action).toBe("updated");
    expect(updated.audit_history?.[1].previous_values?.amount).toBe(1500);

    // 4. Delete Voucher -> reverses treasury balance and posts reversal journal entry while preserving audit history
    const deletedOk = erpStore.deleteVoucher(created.id, "إلغاء العملية للاختبار");
    expect(deletedOk).toBe(true);
    expect(Number(treasury.balance)).toBe(beforeTreasuryBal);
    const deletedVch = erpStore.getState().vouchers.find((v) => v.id === created.id);
    expect(deletedVch?.deleted).toBe(true);
    expect(deletedVch?.reverted).toBe(true);
    expect(deletedVch?.audit_history?.some((a) => a.action === "deleted")).toBe(true);
  });

  it("integrates Restaurant -> Payment -> Purchase of Goods with supplier Level 4 account creation and multi-item inventory synchronization", async () => {
    const { erpStore } = await import("./erpStore");
    const { localWarehouseStore } = await import(
      "../../features/inventory/services/warehouseStore"
    );

    const treasury =
      erpStore.getState().treasuries.find((t) => !t.deleted) || erpStore.getState().treasuries[0];

    // 1. Create new supplier directly -> auto-assigns unique Level 4 account under 24010
    const supResult = erpStore.addSupplier("مؤسسة الوادي لتوريد الأغذية", "01012345678", 0, undefined, "EGP");
    expect(supResult.supplier.id).toBeDefined();
    expect(supResult.account_code.startsWith("24010")).toBe(true);
    const supAccount = erpStore
      .getState()
      .accounts.find((a) => a.code === supResult.account_code);
    expect(supAccount).toBeDefined();
    expect(supAccount?.level).toBe(4);
    expect(supAccount?.parent_code).toBe("24010");

    // 2. Create a new inventory item directly & get an existing one
    const newItem = localWarehouseStore.upsertInventoryItem(
      {
        name_ar: "جبنة موزاريلا فاخرة للمطعم",
        unit: "كجم",
        quantity: 10,
        min_level: 5,
        cost: 120,
      },
      undefined,
      "wh-main-default",
    );
    const secondItem = localWarehouseStore.upsertInventoryItem(
      {
        name_ar: "زيت طهي نباتي نقي",
        unit: "لتر",
        quantity: 20,
        min_level: 5,
        cost: 60,
      },
      undefined,
      "wh-main-default",
    );

    const initialQty1 = Number(newItem.quantity);
    const initialQty2 = Number(secondItem.quantity);

    // 3. Create Restaurant -> Payment -> Purchase of Goods voucher with multiple items
    const purchaseVoucher = erpStore.createVoucher(
      "payment",
      "شراء خامات ومواد",
      0, // auto-calculated from purchase_items
      treasury.id,
      "شراء خامات ومواد للمطعم",
      "المطعم (Restaurant)",
      undefined,
      "EGP",
      50,
      "31010100",
      {
        department: "restaurant",
        supplier_id: supResult.supplier.id,
        supplier_name: supResult.supplier.name_ar,
        supplier_account_code: supResult.account_code,
        purchase_items: [
          {
            inventory_id: newItem.id,
            name_ar: newItem.name_ar,
            unit: newItem.unit,
            quantity: 5,
            unit_price: 150,
          },
          {
            inventory_id: secondItem.id,
            name_ar: secondItem.name_ar,
            unit: secondItem.unit,
            quantity: 10,
            unit_price: 75,
          },
        ],
      },
    );

    // Total = (5 * 150) + (10 * 75) = 750 + 750 = 1500
    expect(purchaseVoucher.amount).toBe(1500);
    expect(purchaseVoucher.purchase_items?.length).toBe(2);

    const invAfterCreate1 = localWarehouseStore.getInventory().find((i) => i.id === newItem.id);
    const invAfterCreate2 = localWarehouseStore.getInventory().find((i) => i.id === secondItem.id);
    expect(invAfterCreate1?.quantity).toBe(initialQty1 + 5);
    expect(invAfterCreate1?.cost).toBe(150);
    expect(invAfterCreate2?.quantity).toBe(initialQty2 + 10);
    expect(invAfterCreate2?.cost).toBe(75);

    // 4. Edit purchase voucher quantities -> reverses old stock and applies new stock
    const updatedPurchase = erpStore.updateVoucher(purchaseVoucher.id, {
      purchase_items: [
        {
          inventory_id: newItem.id,
          name_ar: newItem.name_ar,
          unit: newItem.unit,
          quantity: 8,
          unit_price: 150,
        },
        {
          inventory_id: secondItem.id,
          name_ar: secondItem.name_ar,
          unit: secondItem.unit,
          quantity: 4,
          unit_price: 75,
        },
      ],
    });

    // New total = (8 * 150) + (4 * 75) = 1200 + 300 = 1500
    expect(updatedPurchase.amount).toBe(1500);
    const invAfterEdit1 = localWarehouseStore.getInventory().find((i) => i.id === newItem.id);
    const invAfterEdit2 = localWarehouseStore.getInventory().find((i) => i.id === secondItem.id);
    expect(invAfterEdit1?.quantity).toBe(initialQty1 + 8);
    expect(invAfterEdit2?.quantity).toBe(initialQty2 + 4);

    // 5. Delete purchase voucher -> reverses stock back to initial quantities
    erpStore.deleteVoucher(purchaseVoucher.id, "حذف فاتورة مشتريات تجريبية");
    const invAfterDelete1 = localWarehouseStore.getInventory().find((i) => i.id === newItem.id);
    const invAfterDelete2 = localWarehouseStore.getInventory().find((i) => i.id === secondItem.id);
    expect(invAfterDelete1?.quantity).toBe(initialQty1);
    expect(invAfterDelete2?.quantity).toBe(initialQty2);
  });
});

