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
});
