import { useEffect } from "react";
import {
  Grid3X3,
  Store,
  Building2,
  Trees,
  Landmark,
  UserCheck,
  Package,
  Settings,
  CreditCard,
  Users,
  Flame,
  ClipboardList,
  Clock,
  DollarSign,
  Ticket,
  TrendingUp,
  Calendar,
  BookOpen,
  FileText,
  Layers,
  Wallet,
  BarChart3,
  Scale,
  Receipt,
  ShieldCheck,
  CalendarDays,
  FileSpreadsheet,
  Coins,
  ArrowLeftRight,
  ShoppingCart,
  AlertCircle,
  RefreshCw,
  History,
  LayoutDashboard,
  Utensils,
  Sparkles,
  Database,
  Truck,
  type LucideIcon,
} from "lucide-react";

export interface NavSubItem {
  id: string;
  label: string;
  to: string;
  search?: Record<string, string>;
  /** Local tab value used when the page manages tabs via React state */
  tabValue?: string;
  icon: LucideIcon;
  permissionKeys?: string[];
  matchPath?: (pathname: string, activeTab: string) => boolean;
}

export interface NavDepartment {
  id: string;
  label: string;
  to: string;
  search?: Record<string, string>;
  icon: LucideIcon;
  permissionKeys?: string[];
  children: NavSubItem[];
}

// ============================================================================
// Reactive Sub-Tab Sync Registry (bridges local page state <-> Breadcrumb Bar)
// ============================================================================

const activeSubTabByPath = new Map<string, string>();
const stateListeners = new Set<() => void>();
const commandListeners = new Set<(pathname: string, tab: string) => void>();

function normalizePathname(pathname: string): string {
  if (!pathname) return "/";
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function setActivePageSubTab(pathname: string, tab: string) {
  const norm = normalizePathname(pathname);
  const cleanTab = tab || "";
  if (activeSubTabByPath.has(norm) && activeSubTabByPath.get(norm) === cleanTab) {
    return;
  }
  activeSubTabByPath.set(norm, cleanTab);
  stateListeners.forEach((fn) => fn());
}

export function clearActivePageSubTab(pathname: string) {
  const norm = normalizePathname(pathname);
  if (!activeSubTabByPath.has(norm)) return;
  activeSubTabByPath.delete(norm);
  stateListeners.forEach((fn) => fn());
}

export function getActivePageSubTab(pathname: string): string | undefined {
  return activeSubTabByPath.get(normalizePathname(pathname));
}

export function subscribeSubTabState(listener: () => void): () => void {
  stateListeners.add(listener);
  return () => {
    stateListeners.delete(listener);
  };
}

export function dispatchSubTabCommand(pathname: string, tab: string) {
  const norm = normalizePathname(pathname);
  setActivePageSubTab(norm, tab);
  commandListeners.forEach((fn) => fn(norm, tab));
}

export function subscribeSubTabCommand(
  listener: (pathname: string, tab: string) => void,
): () => void {
  commandListeners.add(listener);
  return () => {
    commandListeners.delete(listener);
  };
}

export function extractTabParam(search?: unknown, searchStr?: string): string {
  if (search && typeof search === "object" && "tab" in search) {
    const val = (search as Record<string, unknown>).tab;
    if (typeof val === "string") return val;
  }
  if (typeof search === "string" && search.length > 0) {
    const param = new URLSearchParams(search).get("tab");
    if (param) return param;
  }
  if (typeof searchStr === "string" && searchStr.length > 0) {
    const param = new URLSearchParams(searchStr).get("tab");
    if (param) return param;
  }
  if (typeof window !== "undefined" && window.location.search) {
    const param = new URLSearchParams(window.location.search).get("tab");
    if (param) return param;
  }
  return "";
}

/**
 * Hook used by department pages to keep their local activeTab/selectedTab state
 * synchronized two-ways with the secondary AppBreadcrumbBar.
 */
export function useSyncedSubTab(
  pathname: string,
  activeTab: string,
  setActiveTab: (tab: any) => void,
  defaultTab: string,
) {
  const normPath = normalizePathname(pathname);

  // 1. Whenever the page's local activeTab changes, update the registry for AppBreadcrumbBar
  useEffect(() => {
    setActivePageSubTab(normPath, activeTab || defaultTab);
  }, [normPath, activeTab, defaultTab]);

  // 2. Clear when leaving the page so stale tab state never persists across routes
  useEffect(() => {
    return () => {
      clearActivePageSubTab(normPath);
    };
  }, [normPath]);

  // 3. Listen for direct sub-tab selection commands from AppBreadcrumbBar
  useEffect(() => {
    return subscribeSubTabCommand((targetPath, targetTab) => {
      if (targetPath === normPath) {
        setActiveTab(targetTab || defaultTab);
      }
    });
  }, [normPath, setActiveTab, defaultTab]);
}

// ============================================================================
// Unified Navigation Hierarchy Registry
// ============================================================================

export const NAVIGATION_DEPARTMENTS: NavDepartment[] = [
  {
    id: "restaurant",
    label: "إدارة المطعم",
    to: "/admin/restaurant",
    icon: Store,
    permissionKeys: [
      "page_restaurant",
      "orders",
      "pos",
      "captain",
      "kitchen",
      "delivery",
      "inventory",
      "purchasing",
      "production",
    ],
    children: [
      {
        id: "restaurant-definitions",
        label: "التعريفات",
        to: "/admin/restaurant",
        search: { tab: "definitions" },
        tabValue: "definitions",
        icon: Settings,
        permissionKeys: [
          "page_restaurant",
          "page_restaurant_menu",
          "pos",
          "pos_access",
          "inventory",
          "orders",
        ],
        matchPath: (p, tab) =>
          p.startsWith("/admin/menu") ||
          (p.startsWith("/admin/restaurant") &&
            (tab === "definitions" || tab === "menu" || tab === "tables")),
      },
      {
        id: "restaurant-operations",
        label: "العمليات",
        to: "/admin/restaurant",
        search: { tab: "operations" },
        tabValue: "operations",
        icon: ClipboardList,
        permissionKeys: [
          "page_restaurant",
          "pos",
          "pos_access",
          "orders",
          "orders_view",
          "captain",
          "captain_access",
          "kitchen",
          "kitchen_view",
          "restaurant_open_shift",
        ],
        matchPath: (p, tab) =>
          p === "/pos" ||
          p === "/captain" ||
          p === "/oven" ||
          p.startsWith("/admin/orders") ||
          (p.startsWith("/admin/restaurant") &&
            (!tab || tab === "grid" || tab === "operations" || tab === "shifts")),
      },
      {
        id: "restaurant-reports",
        label: "التقارير",
        to: "/admin/restaurant",
        search: { tab: "reports" },
        tabValue: "reports",
        icon: TrendingUp,
        permissionKeys: ["page_restaurant", "reports", "orders", "pos"],
        matchPath: (p, tab) => p.startsWith("/admin/restaurant") && tab === "reports",
      },
    ],
  },
  {
    id: "park",
    label: "إدارة الحديقة",
    to: "/admin/park",
    icon: Trees,
    permissionKeys: [
      "page_park",
      "manage_park_shifts",
      "delete_park_shifts",
      "park_reports",
      "mall_garden_finance",
    ],
    children: [
      {
        id: "park-definitions",
        label: "التعريفات",
        to: "/admin/park",
        search: { tab: "definitions" },
        tabValue: "definitions",
        icon: Settings,
        permissionKeys: [
          "page_park",
          "page_park_prices",
          "page_park_customers",
          "page_park_treasury",
          "manage_park_shifts",
        ],
        matchPath: (p, tab) =>
          p.startsWith("/admin/park") &&
          (tab === "definitions" || tab === "prices" || tab === "customers" || tab === "treasury"),
      },
      {
        id: "park-operations",
        label: "العمليات",
        to: "/admin/park",
        search: { tab: "operations" },
        tabValue: "operations",
        icon: Ticket,
        permissionKeys: [
          "page_park",
          "page_park_pos",
          "page_park_shifts",
          "manage_park_shifts",
          "park_open_shift",
          "mall_garden_finance",
        ],
        matchPath: (p, tab) =>
          p.startsWith("/admin/park") &&
          (!tab ||
            tab === "grid" ||
            tab === "overview" ||
            tab === "operations" ||
            tab === "tickets" ||
            tab === "pos" ||
            tab === "shifts"),
      },
      {
        id: "park-reports",
        label: "التقارير",
        to: "/admin/park",
        search: { tab: "reports" },
        tabValue: "reports",
        icon: TrendingUp,
        permissionKeys: ["page_park", "park_reports", "manage_park_shifts"],
        matchPath: (p, tab) => p.startsWith("/admin/park") && tab === "reports",
      },
    ],
  },
  {
    id: "mall",
    label: "إدارة المول",
    to: "/admin/mall",
    icon: Building2,
    permissionKeys: ["page_mall", "mall_manage_shops", "mall_garden_finance"],
    children: [
      {
        id: "mall-definitions",
        label: "التعريفات",
        to: "/admin/mall",
        search: { tab: "definitions" },
        tabValue: "definitions",
        icon: Store,
        permissionKeys: ["page_mall", "page_mall_shops", "mall_manage_shops"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/mall") &&
          (!tab || tab === "grid" || tab === "definitions" || tab === "shops"),
      },
      {
        id: "mall-operations",
        label: "العمليات",
        to: "/admin/mall",
        search: { tab: "operations" },
        tabValue: "operations",
        icon: FileText,
        permissionKeys: ["page_mall", "page_mall_shops", "mall_manage_shops"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/mall") && (tab === "operations" || tab === "contracts"),
      },
      {
        id: "mall-reports",
        label: "التقارير",
        to: "/admin/mall",
        search: { tab: "reports" },
        tabValue: "reports",
        icon: TrendingUp,
        permissionKeys: ["page_mall", "page_mall_reports", "mall_manage_shops", "reports"],
        matchPath: (p, tab) => p.startsWith("/admin/mall") && tab === "reports",
      },
    ],
  },
  {
    id: "financial",
    label: "الإدارة المالية",
    to: "/admin/ledger",
    icon: Landmark,
    permissionKeys: [
      "page_finance",
      "accounting",
      "accounting_view",
      "treasury",
      "expense_approval",
      "revenue_approval",
      "purchasing",
      "mall_garden_finance",
    ],
    children: [
      {
        id: "financial-hub",
        label: "لوحة الإدارة المالية",
        to: "/admin/ledger",
        tabValue: "hub",
        icon: Landmark,
        permissionKeys: ["page_finance"],
        matchPath: (p, tab) => p.startsWith("/admin/ledger") && (!tab || tab === "hub"),
      },
      {
        id: "financial-vouchers",
        label: "السندات والمقبوضات والمصروفات",
        to: "/admin/ledger",
        search: { tab: "vouchers" },
        tabValue: "vouchers",
        icon: Receipt,
        permissionKeys: [
          "page_finance_vouchers",
          "accounting",
          "treasury",
          "expense_approval",
          "revenue_approval",
        ],
        matchPath: (p, tab) =>
          (p.startsWith("/admin/ledger") && tab === "vouchers") ||
          ((p === "/admin" || p === "/admin/") && tab === "vouchers_entry"),
      },
      {
        id: "financial-mall-garden",
        label: "تحصيلات ومصروفات المول والحديقة",
        to: "/admin/ledger",
        search: { tab: "mall_finance" },
        tabValue: "mall_finance",
        icon: Building2,
        permissionKeys: ["page_finance", "accounting", "treasury", "mall_garden_finance"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/ledger") &&
          (tab === "mall_finance" || tab === "payments" || tab === "expenses"),
      },
      {
        id: "financial-purchasing",
        label: "المشتريات وفواتير الموردين",
        to: "/admin/inventory",
        search: { tab: "purchases" },
        tabValue: "purchases",
        icon: ShoppingCart,
        permissionKeys: ["page_inventory_purchases", "purchasing", "accounting"],
        matchPath: (p, tab) => p.startsWith("/admin/inventory") && tab === "purchases",
      },
      {
        id: "financial-position",
        label: "قائمة المركز المالي الشامل",
        to: "/admin/ledger",
        search: { tab: "financial_position" },
        tabValue: "financial_position",
        icon: TrendingUp,
        permissionKeys: ["page_finance_position", "accounting", "accounting_view"],
        matchPath: (p, tab) => p.startsWith("/admin/ledger") && tab === "financial_position",
      },
      {
        id: "financial-ledger",
        label: "كشف حساب الأستاذ العام",
        to: "/admin/ledger",
        search: { tab: "ledger" },
        tabValue: "ledger",
        icon: BookOpen,
        permissionKeys: ["page_finance_ledger", "accounting_view"],
        matchPath: (p, tab) => p.startsWith("/admin/ledger") && tab === "ledger",
      },
      {
        id: "financial-journal",
        label: "دفتر اليومية العامة",
        to: "/admin/ledger",
        search: { tab: "journal" },
        tabValue: "journal",
        icon: FileText,
        permissionKeys: ["page_finance_journal", "accounting", "accounting_post_journal"],
        matchPath: (p, tab) => p.startsWith("/admin/ledger") && tab === "journal",
      },
      {
        id: "financial-treasury",
        label: "إدارة الخزائن والصناديق",
        to: "/admin/ledger",
        search: { tab: "treasury" },
        tabValue: "treasury",
        icon: Wallet,
        permissionKeys: ["page_finance_treasury", "treasury"],
        matchPath: (p, tab) =>
          p === "/cashier-treasury" ||
          (p.startsWith("/admin/ledger") && tab === "treasury") ||
          ((p === "/admin" || p === "/admin/") && tab === "treasury"),
      },
      {
        id: "financial-accounts",
        label: "دليل وشجرة الحسابات",
        to: "/admin/accounts",
        tabValue: "accounts",
        icon: Layers,
        permissionKeys: ["page_finance_accounts", "accounting"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/accounts") ||
          (p.startsWith("/admin/ledger") && tab === "accounts") ||
          ((p === "/admin" || p === "/admin/") && tab === "chart_of_accounts"),
      },
      {
        id: "financial-trial",
        label: "ميزان المراجعة",
        to: "/admin/ledger",
        search: { tab: "trial" },
        tabValue: "trial",
        icon: Scale,
        permissionKeys: ["page_finance_trial", "accounting"],
        matchPath: (p, tab) => p.startsWith("/admin/ledger") && tab === "trial",
      },
      {
        id: "financial-statements",
        label: "القوائم المالية الختامية",
        to: "/admin/ledger",
        search: { tab: "statements" },
        tabValue: "statements",
        icon: FileSpreadsheet,
        permissionKeys: ["page_finance_statements", "reports"],
        matchPath: (p, tab) => p.startsWith("/admin/ledger") && tab === "statements",
      },
      {
        id: "financial-reports",
        label: "التقارير والتحليلات المالية",
        to: "/admin/reports",
        tabValue: "reports",
        icon: BarChart3,
        permissionKeys: ["page_finance_reports", "reports"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/reports") || (p.startsWith("/admin/ledger") && tab === "reports"),
      },
      {
        id: "financial-receipts",
        label: "تصميم الإيصالات والسندات",
        to: "/admin/receipts",
        icon: Receipt,
        permissionKeys: ["page_finance_receipts", "accounting", "treasury"],
        matchPath: (p) => p.startsWith("/admin/receipts"),
      },
    ],
  },
  {
    id: "hr",
    label: "الموارد البشرية والمستخدمين",
    to: "/admin/hr",
    icon: UserCheck,
    permissionKeys: [
      "page_hr",
      "hr",
      "hr_view_attendance",
      "hr_manage_payroll_loans",
      "users_roles",
      "system_manage_users",
      "super_admin_full_access",
    ],
    children: [
      {
        id: "hr-hub",
        label: "لوحة الموارد البشرية",
        to: "/admin/hr",
        tabValue: "grid",
        icon: UserCheck,
        permissionKeys: ["page_hr"],
        matchPath: (p, tab) => p.startsWith("/admin/hr") && (!tab || tab === "grid"),
      },
      {
        id: "hr-employees",
        label: "دليل الكادر والموظفين",
        to: "/admin/hr",
        search: { tab: "employees" },
        tabValue: "employees",
        icon: Users,
        permissionKeys: ["page_hr_employees", "hr"],
        matchPath: (p, tab) => p.startsWith("/admin/hr") && tab === "employees",
      },
      {
        id: "hr-attendance",
        label: "حضور وانصراف اليوم",
        to: "/admin/hr",
        search: { tab: "attendance" },
        tabValue: "attendance",
        icon: CalendarDays,
        permissionKeys: ["page_hr_attendance", "hr_view_attendance"],
        matchPath: (p, tab) => p.startsWith("/admin/hr") && tab === "attendance",
      },
      {
        id: "hr-payroll",
        label: "مسيرات الأجور والرواتب",
        to: "/admin/hr",
        search: { tab: "payroll" },
        tabValue: "payroll",
        icon: FileSpreadsheet,
        permissionKeys: ["page_hr_payroll", "hr_manage_payroll_loans"],
        matchPath: (p, tab) => p.startsWith("/admin/hr") && tab === "payroll",
      },
      {
        id: "hr-loans",
        label: "القروض والسلف المالية",
        to: "/admin/hr",
        search: { tab: "loans" },
        tabValue: "loans",
        icon: Coins,
        permissionKeys: ["page_hr_loans", "hr_manage_payroll_loans"],
        matchPath: (p, tab) => p.startsWith("/admin/hr") && tab === "loans",
      },
      {
        id: "hr-users",
        label: "المستخدمين والصلاحيات (ACL)",
        to: "/admin/users",
        tabValue: "users",
        icon: ShieldCheck,
        permissionKeys: ["users_roles", "system_manage_users"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/users") || (p.startsWith("/admin/hr") && tab === "users"),
      },
    ],
  },
  {
    id: "inventory",
    label: "المخزون والمستودعات",
    to: "/admin/inventory",
    icon: Package,
    permissionKeys: [
      "page_inventory",
      "inventory",
      "inventory_view",
      "purchasing",
      "purchasing_view",
    ],
    children: [
      {
        id: "inventory-hub",
        label: "لوحة المخزون والمستودعات",
        to: "/admin/inventory",
        tabValue: "grid",
        icon: Package,
        permissionKeys: ["page_inventory"],
        matchPath: (p, tab) => p.startsWith("/admin/inventory") && (!tab || tab === "grid"),
      },
      {
        id: "inventory-warehouses",
        label: "إدارة المخازن والفروع",
        to: "/admin/inventory",
        search: { tab: "warehouses" },
        tabValue: "warehouses",
        icon: Building2,
        permissionKeys: ["page_inventory_warehouses", "inventory"],
        matchPath: (p, tab) => p.startsWith("/admin/inventory") && tab === "warehouses",
      },
      {
        id: "inventory-items",
        label: "الأصناف المخزنية والباركود",
        to: "/admin/inventory",
        search: { tab: "stock" },
        tabValue: "stock",
        icon: Package,
        permissionKeys: ["page_inventory_items", "inventory", "inventory_view"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/inventory") && (tab === "items" || tab === "stock"),
      },
      {
        id: "inventory-transfers",
        label: "التحويلات بين المخازن",
        to: "/admin/inventory",
        search: { tab: "transfers" },
        tabValue: "transfers",
        icon: Truck,
        permissionKeys: ["page_inventory_transfers", "inventory_adjust_transfer"],
        matchPath: (p, tab) => p.startsWith("/admin/inventory") && tab === "transfers",
      },
      {
        id: "inventory-transactions",
        label: "سجل حركات المخزن والتسويات",
        to: "/admin/inventory",
        search: { tab: "transactions" },
        tabValue: "transactions",
        icon: ArrowLeftRight,
        permissionKeys: ["page_inventory_transactions", "inventory"],
        matchPath: (p, tab) => p.startsWith("/admin/inventory") && tab === "transactions",
      },
      {
        id: "inventory-expiry",
        label: "صلاحية وتتبع الدفعات",
        to: "/admin/inventory",
        search: { tab: "expiry" },
        tabValue: "expiry",
        icon: Calendar,
        permissionKeys: ["page_inventory_expiry", "inventory"],
        matchPath: (p, tab) => p.startsWith("/admin/inventory") && tab === "expiry",
      },
      {
        id: "inventory-purchases",
        label: "فواتير وأوامر الشراء",
        to: "/admin/inventory",
        search: { tab: "purchases" },
        tabValue: "purchases",
        icon: ShoppingCart,
        permissionKeys: ["page_inventory_purchases", "purchasing"],
        matchPath: (p, tab) => p.startsWith("/admin/inventory") && tab === "purchases",
      },
      {
        id: "inventory-suppliers",
        label: "إدارة الشركات والموردين",
        to: "/admin/inventory",
        search: { tab: "suppliers" },
        tabValue: "suppliers",
        icon: Users,
        permissionKeys: ["page_inventory_suppliers", "purchasing_view"],
        matchPath: (p, tab) => p.startsWith("/admin/inventory") && tab === "suppliers",
      },
      {
        id: "inventory-waste",
        label: "الهالك والفاقد والتسويات الجردية",
        to: "/admin/inventory",
        search: { tab: "waste" },
        tabValue: "waste",
        icon: AlertCircle,
        permissionKeys: ["page_inventory_waste", "inventory_waste_dispose"],
        matchPath: (p, tab) => p.startsWith("/admin/inventory") && tab === "waste",
      },
      {
        id: "inventory-reports",
        label: "تقارير وتحليلات المخزون",
        to: "/admin/inventory",
        search: { tab: "reports" },
        tabValue: "reports",
        icon: FileText,
        permissionKeys: ["page_inventory_reports", "reports"],
        matchPath: (p, tab) => p.startsWith("/admin/inventory") && tab === "reports",
      },
      {
        id: "inventory-settings",
        label: "إعدادات المخزن",
        to: "/admin/inventory",
        search: { tab: "settings" },
        tabValue: "settings",
        icon: Settings,
        permissionKeys: ["page_inventory_settings", "inventory"],
        matchPath: (p, tab) => p.startsWith("/admin/inventory") && tab === "settings",
      },
    ],
  },
  {
    id: "shift_audit",
    label: "تدقيق الورديات",
    to: "/admin",
    search: { tab: "shift_audit" },
    icon: ShieldCheck,
    permissionKeys: [
      "page_shift_audit",
      "shift_audit",
      "manage_park_shifts",
      "restaurant_open_shift",
      "super_admin_full_access",
    ],
    children: [
      {
        id: "shift-audit-hub",
        label: "لوحة تدقيق ومزامنة الورديات (الحديقة والمطعم)",
        to: "/admin",
        search: { tab: "shift_audit" },
        tabValue: "shift_audit",
        icon: ShieldCheck,
        permissionKeys: [
          "page_shift_audit",
          "shift_audit",
          "manage_park_shifts",
          "restaurant_open_shift",
        ],
        matchPath: (p, tab) => (p === "/admin" || p === "/admin/") && tab === "shift_audit",
      },
      {
        id: "shift-audit-park",
        label: "ورديات كاشير الحديقة",
        to: "/admin/park",
        search: { tab: "shifts" },
        tabValue: "shifts",
        icon: Trees,
        permissionKeys: ["page_park_shifts", "manage_park_shifts"],
        matchPath: () => false,
      },
      {
        id: "shift-audit-restaurant",
        label: "ورديات كاشير المطعم",
        to: "/admin/restaurant",
        search: { tab: "shifts" },
        tabValue: "shifts",
        icon: Utensils,
        permissionKeys: ["restaurant_open_shift", "pos", "pos_access"],
        matchPath: () => false,
      },
    ],
  },
  {
    id: "audit_logs",
    label: "سجل العمليات",
    to: "/admin",
    search: { tab: "audit_logs" },
    icon: History,
    permissionKeys: ["page_audit_logs", "audit_logs", "system_audit_logs"],
    children: [
      {
        id: "audit-logs-hub",
        label: "سجل العمليات والرقابة الشاملة",
        to: "/admin",
        search: { tab: "audit_logs" },
        tabValue: "audit_logs",
        icon: History,
        permissionKeys: ["page_audit_logs", "audit_logs", "system_audit_logs"],
        matchPath: (p, tab) => (p === "/admin" || p === "/admin/") && tab === "audit_logs",
      },
    ],
  },
  {
    id: "system",
    label: "المطور والنسخ الاحتياطي",
    to: "/admin/system-update",
    icon: Settings,
    permissionKeys: ["page_developer", "system_backup_update", "developer_options"],
    children: [
      {
        id: "system-hub",
        label: "تحديث السيستم والنظام المباشر",
        to: "/admin/system-update",
        tabValue: "system",
        icon: Settings,
        permissionKeys: ["page_developer"],
        matchPath: (p, tab) => p.startsWith("/admin/system-update") && (!tab || tab === "system"),
      },
      {
        id: "system-access",
        label: "حزمة قاعدة بيانات أكسس (MS Access)",
        to: "/admin/system-update",
        search: { tab: "access" },
        tabValue: "access",
        icon: Database,
        permissionKeys: ["page_system_access_db", "system_backup_update"],
        matchPath: (p, tab) => p.startsWith("/admin/system-update") && tab === "access",
      },
      {
        id: "system-audit",
        label: "فحص سلامة قواعد البيانات",
        to: "/admin/system-update",
        search: { tab: "audit" },
        tabValue: "audit",
        icon: History,
        permissionKeys: ["page_developer", "system_backup_update"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/system-update") && (tab === "audit" || tab === "audit_logs"),
      },
      {
        id: "system-sync",
        label: "مزامنة GitHub وتحديثات النظام",
        to: "/admin/system-update",
        search: { tab: "sync" },
        tabValue: "sync",
        icon: RefreshCw,
        permissionKeys: ["page_system_github", "system_backup_update"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/system-update") && (tab === "sync" || tab === "updates"),
      },
      {
        id: "system-status",
        label: "معلومات وحالة الخادم",
        to: "/admin/system-update",
        search: { tab: "status" },
        tabValue: "status",
        icon: ShieldCheck,
        permissionKeys: ["page_system_status", "system_backup_update"],
        matchPath: (p, tab) => p.startsWith("/admin/system-update") && tab === "status",
      },
      {
        id: "system-studio",
        label: "استوديو المطور Pro (المحرر البصري)",
        to: "/admin/studio",
        icon: Sparkles,
        permissionKeys: ["developer_options", "super_admin_full_access"],
        matchPath: (p) => p.startsWith("/admin/studio") || p.startsWith("/admin/developer-studio"),
      },
    ],
  },
];

export interface ResolvedNavigationState {
  isRootDashboard: boolean;
  department: NavDepartment | null;
  subItem: NavSubItem | null;
  fallbackLabel?: string;
}

export function resolveNavigationState(
  pathname: string,
  search?: unknown,
  searchStr?: string,
): ResolvedNavigationState {
  const normPath = normalizePathname(pathname);
  const urlTab = extractTabParam(search, searchStr);
  const localTab = getActivePageSubTab(normPath);
  const activeTab = localTab !== undefined ? localTab : urlTab || "";

  // Check if at root dashboard (/admin with no tab or tab=grid)
  if ((normPath === "/admin" || normPath === "/") && (!activeTab || activeTab === "grid")) {
    return {
      isRootDashboard: true,
      department: null,
      subItem: null,
    };
  }

  // Pass 1: Check all departments' children for an exact match first
  for (const dept of NAVIGATION_DEPARTMENTS) {
    const matchedSub = dept.children.find((sub) =>
      sub.matchPath ? sub.matchPath(normPath, activeTab) : false,
    );

    if (matchedSub) {
      return {
        isRootDashboard: false,
        department: dept,
        subItem: matchedSub,
      };
    }
  }

  // Pass 2: If on a department root path itself, fall back to its first child
  for (const dept of NAVIGATION_DEPARTMENTS) {
    const deptNorm = normalizePathname(dept.to);
    const deptTab = dept.search?.tab || "";
    if (deptTab && deptTab !== activeTab) {
      continue;
    }
    if (deptNorm !== "/admin" && (normPath === deptNorm || normPath.startsWith(`${deptNorm}/`))) {
      return {
        isRootDashboard: false,
        department: dept,
        subItem: dept.children[0] || null,
      };
    }
  }

  // Fallback for any other /admin/* route
  if (normPath.startsWith("/admin/")) {
    const segment = normPath.replace("/admin/", "").split("/")[0];
    return {
      isRootDashboard: false,
      department: null,
      subItem: null,
      fallbackLabel: segment || "القسم الحالي",
    };
  }

  if (activeTab) {
    return {
      isRootDashboard: false,
      department: null,
      subItem: null,
      fallbackLabel: `قسم: ${activeTab}`,
    };
  }

  return {
    isRootDashboard: true,
    department: null,
    subItem: null,
  };
}

export function isRestaurantScreenPath(
  pathname?: string,
  search?: unknown,
  searchStr?: string,
): boolean {
  const rawPath = pathname || (typeof window !== "undefined" ? window.location.pathname : "/");
  const normPath = normalizePathname(rawPath);

  if (
    normPath === "/admin/restaurant" ||
    normPath.startsWith("/admin/restaurant/") ||
    normPath === "/pos" ||
    normPath.startsWith("/pos/") ||
    normPath === "/captain" ||
    normPath.startsWith("/captain/") ||
    normPath === "/oven" ||
    normPath.startsWith("/oven/") ||
    normPath === "/cashier-treasury" ||
    normPath.startsWith("/cashier-treasury/") ||
    normPath === "/admin/orders" ||
    normPath.startsWith("/admin/orders/") ||
    normPath === "/admin/menu" ||
    normPath.startsWith("/admin/menu/")
  ) {
    return true;
  }

  const resolved = resolveNavigationState(normPath, search, searchStr);
  return resolved.department?.id === "restaurant";
}

export { Grid3X3 };
