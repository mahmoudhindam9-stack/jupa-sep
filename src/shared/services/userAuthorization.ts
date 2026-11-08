import { supabase } from "@/integrations/supabase/client";
import { authService } from "@/features/auth/services/authService";
import { erpStore } from "@/shared/services/erpStore";
import { isAiStudioPreview, isHostedDeployment } from "@/shared/services/previewAccess";

export const PERMISSIONS_UPDATED_EVENT = "restocash:permissions-updated";

export function notifyPermissionsUpdated(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PERMISSIONS_UPDATED_EVENT));
  }
}

export function hasAnyEnabledPermission(
  permissions: Record<string, any> | null | undefined,
): boolean {
  if (!permissions || typeof permissions !== "object") return false;
  return Object.values(permissions).some((val) => val === true);
}

export const MAIN_SECTION_FALLBACKS: Record<string, string[]> = {
  page_restaurant: [
    "pos",
    "captain",
    "kitchen",
    "orders",
    "delivery",
    "restaurant_open_shift",
    "production",
  ],
  page_mall: ["mall_manage_shops", "mall_garden_finance"],
  page_park: [
    "manage_park_shifts",
    "park_open_shift",
    "park_reports",
    "mall_garden_finance",
    "delete_park_shifts",
  ],
  page_finance: ["accounting", "accounting_view", "treasury", "reports"],
  page_hr: [
    "hr",
    "hr_view_attendance",
    "hr_manage_payroll_loans",
    "users_roles",
    "system_manage_users",
  ],
  page_inventory: [
    "inventory",
    "inventory_view",
    "purchasing",
    "purchasing_view",
    "inventory_adjust_transfer",
    "inventory_waste_dispose",
  ],
  page_shift_audit: ["treasury_transfer_reconcile", "treasury", "accounting"],
  page_audit_logs: ["audit_logs", "system_audit_logs"],
  page_developer: ["system_backup_update", "developer_options", "branch_mgmt"],
};

export const SUB_SECTION_TO_MAIN_PAGE: Record<string, string> = {
  // 1. Restaurant
  pos: "page_restaurant",
  captain: "page_restaurant",
  kitchen: "page_restaurant",
  orders: "page_restaurant",
  delivery: "page_restaurant",
  page_restaurant_tables: "page_restaurant",
  page_restaurant_menu: "page_restaurant",
  page_restaurant_inventory: "page_restaurant",
  page_restaurant_vouchers: "page_restaurant",
  page_restaurant_cashier_treasury: "page_restaurant",
  restaurant_open_shift: "page_restaurant",
  // 2. Mall
  page_mall_shops: "page_mall",
  page_mall_payments: "page_mall",
  page_mall_expenses: "page_mall",
  page_mall_vouchers: "page_mall",
  page_mall_reports: "page_mall",
  // 3. Park
  page_park_pos: "page_park",
  page_park_shifts: "page_park",
  page_park_treasury: "page_park",
  page_park_tickets_log: "page_park",
  page_park_customers: "page_park",
  page_park_prices: "page_park",
  page_park_vouchers: "page_park",
  park_reports: "page_park",
  // 4. Finance
  page_finance_position: "page_finance",
  page_finance_ledger: "page_finance",
  page_finance_journal: "page_finance",
  page_finance_vouchers: "page_finance",
  page_finance_accounts: "page_finance",
  page_finance_treasury: "page_finance",
  page_finance_reports: "page_finance",
  page_finance_trial: "page_finance",
  page_finance_statements: "page_finance",
  page_finance_receipts: "page_finance",
  // 5. HR & Users
  page_hr_employees: "page_hr",
  page_hr_attendance: "page_hr",
  page_hr_payroll: "page_hr",
  page_hr_loans: "page_hr",
  users_roles: "page_hr",
  // 6. Inventory
  page_inventory_warehouses: "page_inventory",
  page_inventory_items: "page_inventory",
  page_inventory_transfers: "page_inventory",
  page_inventory_purchases: "page_inventory",
  page_inventory_suppliers: "page_inventory",
  page_inventory_transactions: "page_inventory",
  page_inventory_expiry: "page_inventory",
  page_inventory_waste: "page_inventory",
  page_inventory_reports: "page_inventory",
  page_inventory_settings: "page_inventory",
  // 7. Shift Audit
  page_shift_audit_matching: "page_shift_audit",
  page_shift_audit_variance: "page_shift_audit",
  // 8. Audit Logs
  system_audit_logs: "page_audit_logs",
  // 9. Developer & System
  developer_options: "page_developer",
  system_backup_update: "page_developer",
  page_system_github: "page_developer",
  page_system_access_db: "page_developer",
  page_system_status: "page_developer",
  branch_mgmt: "page_developer",
};

export const SUB_SECTION_FALLBACKS: Record<string, string[]> = {
  // 1. Restaurant
  pos: ["pos", "pos_access"],
  captain: ["captain", "captain_access"],
  kitchen: ["kitchen", "kitchen_view"],
  orders: ["orders", "orders_view"],
  delivery: ["delivery", "delivery_view"],
  page_restaurant_tables: ["orders_generate_qr", "orders", "captain"],
  page_restaurant_menu: ["production", "production_view", "orders", "pos"],
  page_restaurant_inventory: ["inventory", "inventory_view", "purchasing", "production"],
  page_restaurant_vouchers: ["treasury", "treasury_view", "accounting", "pos"],
  page_restaurant_cashier_treasury: ["treasury", "treasury_view", "pos"],
  restaurant_open_shift: ["restaurant_open_shift", "pos", "treasury_open_close"],
  // 2. Mall
  page_mall_shops: ["mall_manage_shops"],
  page_mall_payments: ["mall_manage_shops", "mall_garden_finance"],
  page_mall_expenses: ["mall_manage_shops", "mall_garden_finance"],
  page_mall_vouchers: ["mall_manage_shops", "mall_garden_finance", "treasury"],
  page_mall_reports: ["mall_manage_shops", "reports"],
  // 3. Park
  page_park_pos: ["manage_park_shifts", "park_open_shift"],
  page_park_shifts: ["manage_park_shifts", "park_open_shift"],
  page_park_treasury: ["mall_garden_finance", "manage_park_shifts", "treasury"],
  page_park_tickets_log: ["manage_park_shifts", "park_returns"],
  page_park_customers: ["manage_park_shifts"],
  page_park_prices: ["manage_park_shifts", "mall_garden_finance"],
  page_park_vouchers: ["mall_garden_finance", "manage_park_shifts"],
  park_reports: ["park_reports", "manage_park_shifts", "mall_garden_finance"],
  // 4. Finance
  page_finance_position: ["accounting", "accounting_view", "reports_view_financials"],
  page_finance_ledger: ["accounting_view", "accounting"],
  page_finance_journal: ["accounting", "accounting_post_journal", "journal_approval"],
  page_finance_vouchers: ["accounting", "treasury", "expense_approval", "revenue_approval"],
  page_finance_accounts: ["accounting", "accounting_view", "acc_create_account", "acc_edit_account", "acc_delete_account"],
  page_finance_treasury: ["treasury", "treasury_view"],
  page_finance_reports: ["reports", "reports_view_financials", "accounting"],
  page_finance_trial: ["accounting", "accounting_view", "reports_view_financials"],
  page_finance_statements: ["reports_view_financials", "reports", "accounting"],
  page_finance_receipts: ["accounting", "treasury"],
  // 5. HR & Users
  page_hr_employees: ["hr", "hr_view_attendance"],
  page_hr_attendance: ["hr_view_attendance", "hr"],
  page_hr_payroll: ["hr_manage_payroll_loans", "hr"],
  page_hr_loans: ["hr_manage_payroll_loans", "hr"],
  users_roles: ["users_roles", "system_manage_users"],
  // 6. Inventory
  page_inventory_warehouses: ["inventory", "inventory_view"],
  page_inventory_items: ["inventory_view", "inventory", "inv_print_smart_count"],
  page_inventory_transfers: ["inventory_adjust_transfer", "inventory"],
  page_inventory_purchases: ["purchasing", "purchasing_view", "purchasing_add_invoice"],
  page_inventory_suppliers: ["purchasing_view", "purchasing", "inv_manage_suppliers"],
  page_inventory_transactions: ["inventory", "inventory_view", "inventory_adjust_transfer"],
  page_inventory_expiry: ["inventory", "inventory_view", "inventory_waste_dispose", "inv_manage_waste"],
  page_inventory_waste: ["inventory_waste_dispose", "inv_manage_waste", "inventory"],
  page_inventory_reports: ["inventory", "inventory_view", "reports", "inv_print_smart_count"],
  page_inventory_settings: ["inventory", "branch_mgmt"],
  // 7. Shift Audit
  page_shift_audit_matching: ["treasury_transfer_reconcile", "treasury", "accounting"],
  page_shift_audit_variance: ["treasury_transfer_reconcile", "treasury", "accounting"],
  // 8. Audit Logs
  system_audit_logs: ["system_audit_logs", "audit_logs"],
  // 9. Developer & System
  developer_options: ["developer_options"],
  system_backup_update: ["system_backup_update"],
  page_system_github: ["system_backup_update", "developer_options"],
  page_system_access_db: ["system_backup_update", "developer_options"],
  page_system_status: ["system_backup_update", "developer_options"],
  branch_mgmt: ["branch_mgmt", "system_backup_update"],
};

export function hydratePagePermissions(
  rawPermissions: Record<string, any> | null | undefined,
): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  if (!rawPermissions || typeof rawPermissions !== "object") return result;

  const isSuper = rawPermissions.super_admin_full_access === true;

  for (const [k, v] of Object.entries(rawPermissions)) {
    if (typeof v === "boolean") {
      result[k] = v;
    }
  }

  for (const [mainKey, fallbacks] of Object.entries(MAIN_SECTION_FALLBACKS)) {
    if (typeof result[mainKey] !== "boolean") {
      result[mainKey] = isSuper || fallbacks.some((fk) => rawPermissions[fk] === true);
    }
  }

  for (const [subKey, fallbacks] of Object.entries(SUB_SECTION_FALLBACKS)) {
    const mainKey = SUB_SECTION_TO_MAIN_PAGE[subKey];
    if (mainKey && result[mainKey] === false && !isSuper) {
      result[subKey] = false;
    } else if (typeof result[subKey] !== "boolean") {
      result[subKey] = isSuper || fallbacks.some((fk) => rawPermissions[fk] === true);
    }
  }

  return result;
}

export function getDefaultPermissionsForRole(role: string): Record<string, boolean> {
  const normalizedRole = String(role || "cashier").trim().toLowerCase();
  if (normalizedRole === "admin" || normalizedRole === "super_admin") {
    return hydratePagePermissions({
      super_admin_full_access: true,
      orders: true,
      orders_view: true,
      orders_create_custom: true,
      orders_cancel_modify: true,
      orders_manage_carts: true,
      orders_generate_qr: true,
      pos: true,
      pos_access: true,
      pos_create_custom_order: true,
      pos_apply_discounts: true,
      pos_void_items: true,
      captain: true,
      captain_access: true,
      captain_create_order: true,
      captain_transfer_tables: true,
      captain_modify_items: true,
      kitchen: true,
      kitchen_view: true,
      kitchen_change_status: true,
      kitchen_modify_order: true,
      delivery: true,
      delivery_view: true,
      delivery_update_status: true,
      inventory: true,
      inventory_view: true,
      inventory_adjust_transfer: true,
      inventory_waste_dispose: true,
      purchasing: true,
      purchasing_view: true,
      purchasing_add_invoice: true,
      purchasing_returns: true,
      production: true,
      production_view: true,
      production_execute: true,
      hr: true,
      hr_view_attendance: true,
      hr_manage_payroll_loans: true,
      messenger_broadcast: true,
      treasury: true,
      treasury_view: true,
      treasury_open_close: true,
      treasury_transfer_reconcile: true,
      accounting: true,
      accounting_view: true,
      accounting_post_journal: true,
      accounting_lock_period: true,
      journal_approval: true,
      expense_approval: true,
      revenue_approval: true,
      cost_centers: true,
      mall_manage_shops: true,
      mall_garden_finance: true,
      reports: true,
      reports_view_sales: true,
      reports_view_financials: true,
      users_roles: true,
      system_manage_users: true,
      branch_mgmt: true,
      developer_options: true,
      system_backup_update: true,
      audit_logs: true,
      system_audit_logs: true,
      manage_park_shifts: true,
      delete_park_shifts: true,
      park_reports: true,
      restaurant_open_shift: true,
      restaurant_returns: true,
      park_open_shift: true,
      park_returns: true,
      acc_create_account: true,
      acc_edit_account: true,
      acc_delete_account: true,
      inv_manage_suppliers: true,
      inv_manage_waste: true,
      inv_print_smart_count: true,
    });
  }

  const roleDefaults: Record<string, string[]> = {
    manager: [
      "page_restaurant",
      "orders",
      "orders_view",
      "orders_create_custom",
      "orders_manage_carts",
      "orders_generate_qr",
      "page_restaurant_tables",
      "page_restaurant_menu",
      "page_inventory",
      "inventory",
      "inventory_view",
      "page_inventory_warehouses",
      "page_inventory_items",
      "page_inventory_transfers",
      "page_inventory_waste",
      "page_inventory_expiry",
      "page_inventory_transactions",
      "page_inventory_reports",
      "purchasing",
      "purchasing_view",
      "page_inventory_purchases",
      "page_inventory_suppliers",
      "inv_manage_suppliers",
      "inv_manage_waste",
      "inv_print_smart_count",
      "production",
      "production_view",
      "page_finance",
      "accounting",
      "accounting_view",
      "acc_create_account",
      "acc_edit_account",
      "page_finance_position",
      "page_finance_ledger",
      "page_finance_journal",
      "page_finance_vouchers",
      "page_finance_accounts",
      "page_finance_reports",
      "journal_approval",
      "expense_approval",
      "revenue_approval",
      "cost_centers",
      "reports",
      "reports_view_sales",
      "reports_view_financials",
      "page_hr",
      "hr",
      "page_hr_employees",
      "page_hr_attendance",
      "hr_view_attendance",
    ],
    cashier: [
      "page_restaurant",
      "orders",
      "orders_view",
      "orders_create_custom",
      "orders_manage_carts",
      "orders_generate_qr",
      "pos",
      "pos_access",
      "pos_apply_discounts",
      "page_restaurant_cashier_treasury",
      "restaurant_open_shift",
      "treasury_view",
      "delivery",
      "delivery_view",
      "delivery_update_status",
      "page_park",
      "page_park_pos",
      "page_park_shifts",
      "page_park_treasury",
      "page_park_tickets_log",
      "park_open_shift",
    ],
    captain: [
      "page_restaurant",
      "captain",
      "captain_access",
      "captain_create_order",
      "captain_transfer_tables",
      "captain_modify_items",
      "orders",
      "orders_view",
      "page_restaurant_tables",
    ],
    waiter: [
      "page_restaurant",
      "captain",
      "captain_access",
      "captain_create_order",
      "captain_transfer_tables",
      "captain_modify_items",
      "orders",
      "orders_view",
      "page_restaurant_tables",
    ],
    kitchen: [
      "page_restaurant",
      "kitchen",
      "kitchen_view",
      "kitchen_change_status",
      "kitchen_modify_order",
    ],
  };

  const keys = roleDefaults[normalizedRole] || roleDefaults.cashier;
  return Object.fromEntries(keys.map((k) => [k, true]));
}

export function isDepartmentPermitted(
  perms: Record<string, boolean> | undefined,
  dept: { permissionKeys?: string[] } | null | undefined,
): boolean {
  if (!dept || !dept.permissionKeys || dept.permissionKeys.length === 0) return true;
  if (!perms || typeof perms !== "object") return true;

  // 1. Primary department page key (e.g. "page_restaurant", "page_mall", "page_park", etc.)
  const primaryKey =
    dept.permissionKeys.find((k) => k.startsWith("page_")) || dept.permissionKeys[0];
  if (primaryKey && perms[primaryKey] === false) {
    return false;
  }

  // 2. If any page_ key in permissionKeys is explicitly false, hide it
  for (const k of dept.permissionKeys) {
    if (k.startsWith("page_") && perms[k] === false) {
      return false;
    }
  }

  // 3. If super_admin and not explicitly disabled, allow access
  if (perms.super_admin_full_access === true) return true;

  // 4. If primary page key is explicitly true, allow access
  if (primaryKey && perms[primaryKey] === true) return true;

  // 5. Fallback: check if ANY requested key is true
  return dept.permissionKeys.some((k) => perms[k] === true);
}

export function hasAnyRequestedPermission(
  permissions: Record<string, any> | null | undefined,
  keys: string[],
): boolean {
  if (!keys || keys.length === 0) return true;
  if (!permissions) return false;

  // 1. If any primary page key or parent section is explicitly FALSE, it MUST be hidden!
  const pageKey = keys.find((k) => k.startsWith("page_")) || keys[0];
  if (pageKey) {
    if (permissions[pageKey] === false) {
      return false;
    }
    const parentMainKey = SUB_SECTION_TO_MAIN_PAGE[pageKey];
    if (parentMainKey && permissions[parentMainKey] === false) {
      return false;
    }
  }

  // Check if any page_ key is explicitly disabled
  for (const k of keys) {
    if (k.startsWith("page_") && permissions[k] === false) {
      return false;
    }
  }

  // 2. If the user has super_admin_full_access and this section was not explicitly set to false, grant access
  if (permissions.super_admin_full_access === true) return true;

  // 3. If the primary page/sub-section key is explicitly true, allow access
  if (pageKey && permissions[pageKey] === true) {
    return true;
  }

  // 4. Fallback: check if any of the keys is explicitly true
  return keys.some((key) => permissions[key] === true);
}

/**
 * Resolves the active user's permissions synchronously from erpStore.
 * Used by UI grids, navbars, and action buttons for instant RBAC filtering.
 */
export function getActiveUserPermissionsSync(): Record<string, boolean> {
  if (typeof window === "undefined" || isHostedDeployment()) return {};

  const state: any = erpStore.getState();
  const activeStored = (
    localStorage.getItem("restocash_auth_user") ||
    sessionStorage.getItem("restocash_auth_user") ||
    state.currentUser ||
    ""
  ).trim().toLowerCase();

  if (!activeStored) {
    return isAiStudioPreview() ? getDefaultPermissionsForRole("admin") : {};
  }

  const base = activeStored.split("@")[0];
  const users = erpStore.getUsers() as any[];
  const matchedUser = users.find((candidate) => {
    if (!String(candidate.password || "")) return false;
    const username = String(candidate.username || "").trim().toLowerCase();
    const email = String(candidate.email || "").trim().toLowerCase();
    return (!!email && email === activeStored) || username === activeStored || username === base;
  });

  if (!matchedUser) {
    return isAiStudioPreview() ? getDefaultPermissionsForRole("admin") : {};
  }

  const normalizedRole = String(matchedUser.role || "cashier").trim().toLowerCase();
  const isAdminIdentity = normalizedRole === "admin" || normalizedRole === "super_admin";
  const candidatePerms =
    (hasAnyEnabledPermission(matchedUser.permissions) ? matchedUser.permissions : null) ||
    (hasAnyEnabledPermission(state.userPermissions?.[matchedUser.username])
      ? state.userPermissions[matchedUser.username]
      : null) ||
    (hasAnyEnabledPermission(state.userPermissions?.[base])
      ? state.userPermissions[base]
      : null);

  if (candidatePerms) {
    if (isAdminIdentity) {
      return {
        ...getDefaultPermissionsForRole("admin"),
        ...candidatePerms,
        super_admin_full_access: candidatePerms.super_admin_full_access ?? true,
        users_roles: true,
        system_manage_users: true,
      } as Record<string, boolean>;
    }
    return candidatePerms as Record<string, boolean>;
  }

  return isAdminIdentity
    ? getDefaultPermissionsForRole("admin")
    : getDefaultPermissionsForRole(normalizedRole);
}

export function hasActivePermissionSync(keys: string[]): boolean {
  const perms = getActiveUserPermissionsSync();
  return hasAnyRequestedPermission(perms, keys);
}

/**
 * Verifies the current user's permissions against Supabase `public.profiles` first
 * (whenever a Supabase Auth session is active), or against the active user profile
 * in `erpStore` when operating in a local/preview session.
 */
export async function currentUserHasPermission(keys: string[]): Promise<boolean> {
  if (!keys || keys.length === 0) return true;

  // 1. Always check Supabase Auth session first on ANY host so database permissions are authoritative
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user?.id) {
      const profile: any = await authService.getProfile(session.user.id);
      if (!profile?.id || !profile?.username) return false;

      const username = String(profile.username).trim().toLowerCase();
      const permissions = (profile.permissions || {}) as Record<string, boolean>;
      erpStore.updateUserPermission(username, permissions);
      return hasAnyRequestedPermission(permissions, keys);
    }
  } catch (error) {
    console.warn("Supabase session permission check failed:", error);
  }

  // A deployed app must fail closed when there is no valid Supabase session.
  if (isHostedDeployment()) return false;

  const activeStored =
    (typeof window !== "undefined" &&
      (localStorage.getItem("restocash_auth_user") ||
        sessionStorage.getItem("restocash_auth_user"))) ||
    "";
  const active = activeStored.trim().toLowerCase();

  if (!active) {
    if (isAiStudioPreview()) {
      const perms = getActiveUserPermissionsSync();
      return hasAnyRequestedPermission(perms, keys);
    }
    return false;
  }

  const base = active.split("@")[0];
  const users = erpStore.getUsers() as any[];
  const user = users.find((candidate) => {
    const username = String(candidate.username || "")
      .trim()
      .toLowerCase();
    const email = String(candidate.email || "")
      .trim()
      .toLowerCase();
    if (!username && !email) return false;
    if (!String(candidate.password || "")) return false;
    return (
      (!!email && email === active) ||
      username === active ||
      username === base ||
      username.split("@")[0] === base
    );
  });

  if (!user) return false;

  const state: any = erpStore.getState();
  const permissions =
    (user.permissions && Object.keys(user.permissions).length > 0 ? user.permissions : null) ||
    state.userPermissions?.[user.username] ||
    state.userPermissions?.[base] ||
    state.userPermissions?.[user.role] ||
    (user.role === "admin" || user.role === "super_admin"
      ? { super_admin_full_access: true }
      : {});

  return hasAnyRequestedPermission(permissions, keys);
}

export interface ActiveUserIdentity {
  userId: string;
  username: string;
  email: string;
  fullName: string;
  role: string;
  isCashier: boolean;
  canCloseShifts: boolean;
  canManageAllShifts: boolean;
}

/**
 * Synchronously resolves the currently authenticated user's identity, role,
 * and cashier-shift permissions without relying on hardcoded usernames.
 */
export function getCurrentUserIdentitySync(): ActiveUserIdentity {
  const state: any = erpStore.getState();
  const storedAuthRaw =
    typeof window !== "undefined"
      ? (
          localStorage.getItem("restocash_auth_user") ||
          sessionStorage.getItem("restocash_auth_user") ||
          ""
        ).trim()
      : "";


  const currentStoreUser = String(state?.currentUser || "")
    .trim()
    .toLowerCase();
  const activeIdentifier = (storedAuthRaw || currentStoreUser).trim().toLowerCase();
  const activeBase = activeIdentifier.includes("@")
    ? activeIdentifier.split("@")[0]
    : activeIdentifier;

  const users: any[] = erpStore.getUsers() || [];
  const matchedUser =
    users.find((candidate) => {
      if (!isHostedDeployment() && !String(candidate.password || "")) return false;
      if (!activeIdentifier && !currentStoreUser) return false;
      const uname = String(candidate.username || "")
        .trim()
        .toLowerCase();
      const uemail = String(candidate.email || "")
        .trim()
        .toLowerCase();
      const uid = String(candidate.id || "")
        .trim()
        .toLowerCase();
      return (
        (Boolean(activeIdentifier) &&
          (uname === activeIdentifier ||
            uemail === activeIdentifier ||
            uid === activeIdentifier ||
            (Boolean(activeBase) &&
              (uname === activeBase || uemail.split("@")[0] === activeBase)))) ||
        (Boolean(currentStoreUser) &&
          (uname === currentStoreUser || uemail === currentStoreUser || uid === currentStoreUser))
      );
    }) || null;

  const resolvedUsername = String(
    matchedUser?.username || currentStoreUser || activeBase || "",
  )
    .trim()
    .toLowerCase();
  const resolvedUserId = String(matchedUser?.id || resolvedUsername || "").trim();
  const resolvedEmail = String(
    matchedUser?.email || (activeIdentifier.includes("@") ? activeIdentifier : ""),
  )
    .trim()
    .toLowerCase();
  const resolvedFullName = String(
    matchedUser?.full_name || matchedUser?.username || resolvedUsername || "كاشير",
  ).trim();

  let resolvedRole = String(matchedUser?.role || "").trim().toLowerCase();

  if (!resolvedRole) {
    resolvedRole = !activeIdentifier && isAiStudioPreview() ? "super_admin" : "cashier";
  }

  const perms = getActiveUserPermissionsSync();
  const isManagerOrAdminRole =
    resolvedRole === "admin" ||
    resolvedRole === "super_admin" ||
    resolvedRole === "manager";

  // Any user assigned the "cashier" role automatically follows the cashier shift workflow
  const isCashier = resolvedRole === "cashier" && !isManagerOrAdminRole;

  const canCloseShifts =
    !isCashier &&
    (isManagerOrAdminRole ||
      Boolean(perms?.super_admin_full_access) ||
      Boolean(perms?.manage_park_shifts) ||
      Boolean(perms?.treasury_open_close));

  return {
    userId: resolvedUserId,
    username: resolvedUsername,
    email: resolvedEmail,
    fullName: resolvedFullName,
    role: resolvedRole,
    isCashier,
    canCloseShifts,
    canManageAllShifts: canCloseShifts,
  };
}

export function isCurrentUserCashier(): boolean {
  return getCurrentUserIdentitySync().isCashier;
}

export function canCurrentUserCloseShift(): boolean {
  return getCurrentUserIdentitySync().canCloseShifts;
}

export async function signOutCurrentUser(): Promise<void> {
  if (typeof window !== "undefined") {
    localStorage.removeItem("restocash_auth_user");
    localStorage.removeItem("restocash_user_role");
    sessionStorage.removeItem("restocash_auth_user");
    sessionStorage.removeItem("restocash_user_role");
  }
  erpStore.setCurrentUser("");
  await supabase.auth.signOut().catch(() => undefined);
}



