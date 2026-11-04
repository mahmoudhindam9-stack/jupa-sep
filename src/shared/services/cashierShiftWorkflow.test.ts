import { describe, it, expect, beforeEach } from "vitest";
import { erpStore } from "@/shared/services/erpStore";
import {
  getCurrentUserIdentitySync,
  isCurrentUserCashier,
  canCurrentUserCloseShift,
  getDefaultPermissionsForRole,
} from "@/shared/services/userAuthorization";

describe("Cashier Shift Opening & Access Workflow (Restaurant & Garden)", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    // Reset open shifts in erpStore
    const state = erpStore.getState();
    state.restaurantShifts = [];
    state.restaurantActiveShift = null;
    state.parkShifts = [];
    state.parkActiveShift = null;
    state.currentUserEmail = "";
  });

  it("1 & 2. Detects cashier role dynamically for both newly created and existing cashier accounts without hardcoded usernames", () => {
    // Existing cashier account in local_system_users
    const existingCashier = {
      id: "usr-cashier-existing-1",
      username: "sara_pos_2026",
      full_name: "سارة كاشير",
      role: "cashier",
      permissions: getDefaultPermissionsForRole("cashier"),
      is_active: true,
    };
    // Newly created cashier account
    const newCashier = {
      id: "usr-cashier-new-99",
      username: "omar_garden_cashier",
      full_name: "عمر كاشير الحديقة",
      role: "cashier",
      permissions: getDefaultPermissionsForRole("cashier"),
      is_active: true,
    };

    localStorage.setItem("local_system_users", JSON.stringify([existingCashier, newCashier]));

    // Login as existing cashier
    localStorage.setItem("restocash_auth_user", "sara_pos_2026");
    erpStore.setCurrentUser("sara_pos_2026");
    const id1 = getCurrentUserIdentitySync();
    expect(id1.isCashier).toBe(true);
    expect(id1.canCloseShifts).toBe(false);
    expect(id1.userId).toBe("usr-cashier-existing-1");
    expect(isCurrentUserCashier()).toBe(true);
    expect(canCurrentUserCloseShift()).toBe(false);

    // Login as newly created cashier
    localStorage.setItem("restocash_auth_user", "omar_garden_cashier");
    erpStore.setCurrentUser("omar_garden_cashier");
    const id2 = getCurrentUserIdentitySync();
    expect(id2.isCashier).toBe(true);
    expect(id2.canCloseShifts).toBe(false);
    expect(id2.userId).toBe("usr-cashier-new-99");
  });

  it("3 & 4. Allows Restaurant and Garden cashiers to open shifts with the 4 required fields and background auto_shift_number", () => {
    const cashier = {
      id: "usr-cashier-both-1",
      username: "cashier_ali",
      full_name: "علي الكاشير",
      role: "cashier",
      permissions: getDefaultPermissionsForRole("cashier"),
      is_active: true,
    };
    localStorage.setItem("local_system_users", JSON.stringify([cashier]));
    localStorage.setItem("restocash_auth_user", "cashier_ali");
    erpStore.setCurrentUser("cashier_ali");

    // Open Restaurant Shift with the 4 fields
    const restShift = erpStore.startNewRestaurantShift({
      shift_number: "وردية مطعم صباحية - علي",
      cashier_name: cashier.full_name,
      currency: "EGP",
      exchange_rate: 1,
      opening_balance: 1500,
      opening_notes: "بداية الوردية الصباحية بالمطعم",
    });

    expect(restShift.status).toBe("open");
    expect(restShift.shift_number).toBe("وردية مطعم صباحية - علي");
    expect(restShift.currency).toBe("EGP");
    expect(restShift.exchange_rate).toBe(1);
    expect(restShift.opening_balance).toBe(1500);
    expect(restShift.opening_notes).toBe("بداية الوردية الصباحية بالمطعم");
    expect(restShift.cashier_id).toBe("usr-cashier-both-1");
    expect(restShift.cashier_username).toBe("cashier_ali");
    expect(restShift.auto_shift_number).toMatch(/^RST-/);

    // Open Garden (Park) Shift independently with the 4 fields
    const parkShift = erpStore.startNewParkShift({
      shift_number: "وردية تذاكر الحديقة - علي",
      cashier_name: cashier.full_name,
      currency: "SSP",
      exchange_rate: 3000,
      opening_balance: 50000,
      opening_notes: "رصيد فكة شباك التذاكر",
    });

    expect(parkShift.status).toBe("open");
    expect(parkShift.shift_number).toBe("وردية تذاكر الحديقة - علي");
    expect(parkShift.currency).toBe("SSP");
    expect(parkShift.exchange_rate).toBe(3000);
    expect(parkShift.opening_balance).toBe(50000);
    expect(parkShift.opening_notes).toBe("رصيد فكة شباك التذاكر");
    expect(parkShift.cashier_id).toBe("usr-cashier-both-1");
    expect(parkShift.cashier_username).toBe("cashier_ali");
    expect(parkShift.auto_shift_number).toMatch(/^PSH-/);
  });

  it("5 & 6. Prevents cashiers from closing or deleting shifts, while allowing managers/admins to close them", () => {
    const cashier = {
      id: "usr-cashier-5",
      username: "cashier_nour",
      full_name: "نور كاشير",
      role: "cashier",
      permissions: getDefaultPermissionsForRole("cashier"),
      is_active: true,
    };
    const manager = {
      id: "usr-manager-1",
      username: "manager_hassan",
      full_name: "حسن المدير",
      role: "manager",
      permissions: getDefaultPermissionsForRole("manager"),
      is_active: true,
    };
    localStorage.setItem("local_system_users", JSON.stringify([cashier, manager]));

    // Login as cashier and open shifts
    localStorage.setItem("restocash_auth_user", "cashier_nour");
    erpStore.setCurrentUser("cashier_nour");

    const restShift = erpStore.startNewRestaurantShift({
      shift_number: "وردية نور مطعم",
      cashier_name: cashier.full_name,
      currency: "EGP",
      exchange_rate: 1,
      opening_balance: 500,
    });

    const parkShift = erpStore.startNewParkShift({
      shift_number: "وردية نور حديقة",
      cashier_name: cashier.full_name,
      currency: "USD",
      exchange_rate: 1,
      opening_balance: 100,
    });

    // Cashier attempts to close or delete shifts -> MUST THROW
    expect(() => erpStore.closeRestaurantShift(restShift.id)).toThrow(/غير مصرح للكاشير/);
    expect(() => erpStore.closeParkShift(parkShift.id)).toThrow(/غير مصرح للكاشير/);
    expect(() => erpStore.deleteRestaurantShift(restShift.id)).toThrow(/غير مصرح للكاشير/);
    expect(() => erpStore.deleteParkShift(parkShift.id)).toThrow(/غير مصرح للكاشير/);

    // Switch to Manager -> CAN close both shifts
    localStorage.setItem("restocash_auth_user", "manager_hassan");
    erpStore.setCurrentUser("manager_hassan");
    expect(canCurrentUserCloseShift()).toBe(true);

    const closedRest = erpStore.closeRestaurantShift(restShift.id);
    expect(closedRest.status).toBe("closed");

    const closedPark = erpStore.closeParkShift(parkShift.id);
    expect(closedPark.status).toBe("closed");
  });

  it("7, 8 & 9. Persists active shift across logout/login linked to cashier user ID and prevents duplicate active shifts in the same department", () => {
    const cashier1 = {
      id: "usr-cashier-101",
      username: "cashier_tarek",
      full_name: "طارق كاشير",
      role: "cashier",
      permissions: getDefaultPermissionsForRole("cashier"),
      is_active: true,
    };
    const cashier2 = {
      id: "usr-cashier-102",
      username: "cashier_mona",
      full_name: "منى كاشير",
      role: "cashier",
      permissions: getDefaultPermissionsForRole("cashier"),
      is_active: true,
    };
    localStorage.setItem("local_system_users", JSON.stringify([cashier1, cashier2]));

    // 1. Cashier 1 logs in and opens a Restaurant shift and a Park shift
    localStorage.setItem("restocash_auth_user", "cashier_tarek");
    erpStore.setCurrentUser("cashier_tarek");

    const tarekRestShift = erpStore.startNewRestaurantShift({
      shift_number: "وردية طارق الصباحية",
      cashier_name: cashier1.full_name,
      currency: "EGP",
      exchange_rate: 1,
      opening_balance: 1000,
    });

    const tarekParkShift = erpStore.startNewParkShift({
      shift_number: "وردية تذاكر طارق",
      cashier_name: cashier1.full_name,
      currency: "USD",
      exchange_rate: 1,
      opening_balance: 200,
    });

    // Attempting to open a second active shift in the same department for Cashier 1 MUST fail
    expect(() =>
      erpStore.startNewRestaurantShift({
        shift_number: "وردية مكررة",
        cashier_name: cashier1.full_name,
      }),
    ).toThrow(/وردية مطعم مفتوحة بالفعل/);

    expect(() =>
      erpStore.startNewParkShift({
        shift_number: "وردية حديقة مكررة",
        cashier_name: cashier1.full_name,
      }),
    ).toThrow(/وردية حديقة مفتوحة بالفعل/);

    // 2. Cashier 1 logs out
    localStorage.removeItem("restocash_auth_user");
    erpStore.setCurrentUser("");
    expect(erpStore.getState().restaurantActiveShift).toBeNull();
    expect(erpStore.getState().parkActiveShift).toBeNull();

    // 3. Cashier 2 logs in -> should NOT see Cashier 1's active shift as their own
    localStorage.setItem("restocash_auth_user", "cashier_mona");
    erpStore.setCurrentUser("cashier_mona");
    expect(erpStore.getCashierOpenRestaurantShift()).toBeNull();
    expect(erpStore.getActiveRestaurantShift()).toBeNull();
    expect(erpStore.getCashierOpenParkShift()).toBeNull();
    expect(erpStore.getActiveParkShift()).toBeNull();

    // 4. Cashier 1 logs back in -> system automatically detects and restores their open shifts
    localStorage.setItem("restocash_auth_user", "cashier_tarek");
    erpStore.setCurrentUser("cashier_tarek");

    const restoredRestShift = erpStore.getActiveRestaurantShift();
    expect(restoredRestShift).not.toBeNull();
    expect(restoredRestShift?.id).toBe(tarekRestShift.id);
    expect(restoredRestShift?.cashier_id).toBe("usr-cashier-101");

    const restoredParkShift = erpStore.getActiveParkShift();
    expect(restoredParkShift).not.toBeNull();
    expect(restoredParkShift?.id).toBe(tarekParkShift.id);
    expect(restoredParkShift?.cashier_id).toBe("usr-cashier-101");
  });
});
