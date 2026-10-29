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
  return pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
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
        id: "restaurant-hub",
        label: "لوحة إدارة المطعم",
        to: "/admin/restaurant",
        tabValue: "grid",
        icon: Store,
        permissionKeys: ["page_restaurant"],
        matchPath: (p, tab) =>
          p === "/admin/restaurant" && (!tab || tab === "grid"),
      },
      {
        id: "pos",
        label: "نقطة بيع الكاشير (POS)",
        to: "/pos",
        icon: CreditCard,
        permissionKeys: ["pos", "pos_access", "orders", "orders_create_custom"],
        matchPath: (p) => p === "/pos",
      },
      {
        id: "captain",
        label: "شاشة الكابتن والصالة",
        to: "/captain",
        icon: Users,
        permissionKeys: ["captain", "captain_access", "captain_create_order"],
        matchPath: (p) => p === "/captain",
      },
      {
        id: "oven",
        label: "شاشة المطبخ والفرن (KDS)",
        to: "/oven",
        icon: Flame,
        permissionKeys: ["kitchen", "kitchen_view", "kitchen_change_status"],
        matchPath: (p) => p === "/oven",
      },
      {
        id: "cashier-treasury",
        label: "شاشة الكاشير والخزينة",
        to: "/cashier-treasury",
        icon: Wallet,
        permissionKeys: ["page_restaurant_cashier_treasury", "treasury", "treasury_view", "treasury_open_close", "pos", "pos_access"],
        matchPath: (p) => p === "/cashier-treasury",
      },
      {
        id: "orders",
        label: "سجل الطلبات والفواتير",
        to: "/admin/orders",
        icon: ClipboardList,
        permissionKeys: ["orders", "orders_view", "delivery", "delivery_view"],
        matchPath: (p) => p.startsWith("/admin/orders"),
      },
      {
        id: "menu",
        label: "إدارة المنيو وقائمة الطعام",
        to: "/admin/menu",
        icon: Utensils,
        permissionKeys: ["page_restaurant_menu", "pos", "pos_access", "inventory", "orders"],
        matchPath: (p) => p.startsWith("/admin/menu"),
      },
      {
        id: "restaurant-vouchers",
        label: "سندات الصرف والقبض",
        to: "/admin/restaurant",
        search: { tab: "vouchers" },
        tabValue: "vouchers",
        icon: Receipt,
        permissionKeys: ["page_restaurant_vouchers", "treasury", "accounting"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/restaurant") && tab === "vouchers",
      },
      {
        id: "restaurant-shifts",
        label: "ورديات كاشير المطعم",
        to: "/admin/restaurant",
        search: { tab: "shifts" },
        tabValue: "shifts",
        icon: Clock,
        permissionKeys: ["restaurant_open_shift", "pos", "pos_access"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/restaurant") && tab === "shifts",
      },
      {
        id: "restaurant-expenses",
        label: "مصروفات وتسويات المطعم",
        to: "/admin/restaurant",
        search: { tab: "expenses" },
        tabValue: "expenses",
        icon: DollarSign,
        permissionKeys: ["page_restaurant_vouchers", "treasury", "accounting"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/restaurant") && tab === "expenses",
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
        id: "mall-hub",
        label: "لوحة إدارة المول",
        to: "/admin/mall",
        tabValue: "grid",
        icon: Building2,
        permissionKeys: ["page_mall"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/mall") && (!tab || tab === "grid"),
      },
      {
        id: "mall-shops",
        label: "دليل المحلات والمستأجرين",
        to: "/admin/mall",
        search: { tab: "shops" },
        tabValue: "shops",
        icon: Store,
        permissionKeys: ["page_mall_shops", "mall_manage_shops"],
        matchPath: (p, tab) => p.startsWith("/admin/mall") && tab === "shops",
      },
      {
        id: "mall-payments",
        label: "متابعة عقود الإيجار والدفعات",
        to: "/admin/mall",
        search: { tab: "payments" },
        tabValue: "payments",
        icon: Calendar,
        permissionKeys: ["page_mall_payments", "mall_manage_shops", "accounting"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/mall") && tab === "payments",
      },
      {
        id: "mall-expenses",
        label: "مصروفات وتشغيل المول",
        to: "/admin/mall",
        search: { tab: "expenses" },
        tabValue: "expenses",
        icon: CreditCard,
        permissionKeys: ["page_mall_expenses", "mall_manage_shops", "mall_garden_finance"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/mall") && tab === "expenses",
      },
      {
        id: "mall-vouchers",
        label: "سندات الصرف والقبض للمول",
        to: "/admin/mall",
        search: { tab: "vouchers" },
        tabValue: "vouchers",
        icon: Receipt,
        permissionKeys: ["page_mall_vouchers", "mall_manage_shops", "treasury"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/mall") && tab === "vouchers",
      },
      {
        id: "mall-reports",
        label: "التقارير المالية وإشغال المول",
        to: "/admin/mall",
        search: { tab: "reports" },
        tabValue: "reports",
        icon: TrendingUp,
        permissionKeys: ["page_mall_reports", "mall_manage_shops", "reports"],
        matchPath: (p, tab) => p.startsWith("/admin/mall") && tab === "reports",
      },
      {
        id: "mall-garden",
        label: "الحديقة والمرافق الترفيهية",
        to: "/admin/mall",
        search: { tab: "garden" },
        tabValue: "garden",
        icon: Trees,
        permissionKeys: ["page_park", "mall_garden_finance"],
        matchPath: (p, tab) => p.startsWith("/admin/mall") && tab === "garden",
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
        id: "park-overview",
        label: "لوحة إدارة الحديقة",
        to: "/admin/park",
        tabValue: "grid",
        icon: LayoutDashboard,
        permissionKeys: ["page_park"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/park") &&
          (!tab || tab === "grid" || tab === "overview"),
      },
      {
        id: "park-tickets",
        label: "نقطة بيع تذاكر الحديقة (POS)",
        to: "/admin/park",
        search: { tab: "tickets" },
        tabValue: "tickets",
        icon: Ticket,
        permissionKeys: ["page_park_pos", "manage_park_shifts", "mall_garden_finance"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/park") && (tab === "tickets" || tab === "pos"),
      },
      {
        id: "park-shifts",
        label: "ورديات كاشير الحديقة",
        to: "/admin/park",
        search: { tab: "shifts" },
        tabValue: "shifts",
        icon: Clock,
        permissionKeys: ["page_park_shifts", "manage_park_shifts"],
        matchPath: (p, tab) => p.startsWith("/admin/park") && tab === "shifts",
      },
      {
        id: "park-treasury",
        label: "الخزائن التشغيلية الثمانية",
        to: "/admin/park",
        search: { tab: "treasury" },
        tabValue: "treasury",
        icon: Landmark,
        permissionKeys: ["page_park_treasury", "manage_park_shifts", "treasury"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/park") && tab === "treasury",
      },
      {
        id: "park-vouchers",
        label: "سندات الصرف والقبض للحديقة",
        to: "/admin/park",
        search: { tab: "vouchers" },
        tabValue: "vouchers",
        icon: Receipt,
        permissionKeys: ["page_park_vouchers", "mall_garden_finance"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/park") && tab === "vouchers",
      },
      {
        id: "park-prices",
        label: "أسعار وتصنيفات التذاكر",
        to: "/admin/park",
        search: { tab: "prices" },
        tabValue: "prices",
        icon: Settings,
        permissionKeys: ["page_park_prices", "manage_park_shifts"],
        matchPath: (p, tab) => p.startsWith("/admin/park") && tab === "prices",
      },
      {
        id: "park-customers",
        label: "دليل عملاء الحديقة",
        to: "/admin/park",
        search: { tab: "customers" },
        tabValue: "customers",
        icon: Users,
        permissionKeys: ["page_park_customers", "manage_park_shifts"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/park") && tab === "customers",
      },
      {
        id: "park-reports",
        label: "تقارير مبيعات وإيرادات الحديقة",
        to: "/admin/park",
        search: { tab: "reports" },
        tabValue: "reports",
        icon: TrendingUp,
        permissionKeys: ["park_reports", "manage_park_shifts"],
        matchPath: (p, tab) => p.startsWith("/admin/park") && tab === "reports",
      },
    ],
  },
  {
    id: "financial",
    label: "الإدارة المالية",
    to: "/admin/ledger",
    icon: Landmark,
    permissionKeys: ["page_finance", "accounting", "accounting_view", "treasury"],
    children: [
      {
        id: "financial-hub",
        label: "المركز المالي ولوحة المحاسبة",
        to: "/admin/ledger",
        tabValue: "hub",
        icon: Landmark,
        permissionKeys: ["page_finance"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/ledger") && (!tab || tab === "hub"),
      },
      {
        id: "financial-position",
        label: "قائمة المركز المالي الشامل",
        to: "/admin/ledger",
        search: { tab: "financial_position" },
        tabValue: "financial_position",
        icon: TrendingUp,
        permissionKeys: ["page_finance_position", "accounting", "accounting_view"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/ledger") && tab === "financial_position",
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
        matchPath: (p, tab) =>
          p.startsWith("/admin/ledger") && tab === "journal",
      },
      {
        id: "financial-vouchers",
        label: "سندات الصرف والقبض",
        to: "/admin/ledger",
        search: { tab: "vouchers" },
        tabValue: "vouchers",
        icon: Receipt,
        permissionKeys: ["page_finance_vouchers", "accounting", "treasury"],
        matchPath: (p, tab) =>
          (p.startsWith("/admin/ledger") && tab === "vouchers") ||
          ((p === "/admin" || p === "/admin/") && tab === "vouchers_entry"),
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
        label: "ميزان المراجعة بالأرصدة والمجاميع",
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
        matchPath: (p, tab) =>
          p.startsWith("/admin/ledger") && tab === "statements",
      },
      {
        id: "financial-reports",
        label: "التقارير والتحليلات المالية",
        to: "/admin/reports",
        tabValue: "reports",
        icon: BarChart3,
        permissionKeys: ["page_finance_reports", "reports"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/reports") ||
          (p.startsWith("/admin/ledger") && tab === "reports"),
      },
      {
        id: "financial-receipts",
        label: "تصميم وإدارة الإيصالات والسندات",
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
        matchPath: (p, tab) =>
          p.startsWith("/admin/hr") && (!tab || tab === "grid"),
      },
      {
        id: "hr-employees",
        label: "دليل الكادر والموظفين",
        to: "/admin/hr",
        search: { tab: "employees" },
        tabValue: "employees",
        icon: Users,
        permissionKeys: ["page_hr_employees", "hr"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/hr") && tab === "employees",
      },
      {
        id: "hr-attendance",
        label: "حضور وانصراف اليوم",
        to: "/admin/hr",
        search: { tab: "attendance" },
        tabValue: "attendance",
        icon: CalendarDays,
        permissionKeys: ["page_hr_attendance", "hr_view_attendance"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/hr") && tab === "attendance",
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
          p.startsWith("/admin/users") ||
          (p.startsWith("/admin/hr") && tab === "users"),
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
        matchPath: (p, tab) =>
          p.startsWith("/admin/inventory") && (!tab || tab === "grid"),
      },
      {
        id: "inventory-warehouses",
        label: "إدارة المخازن والفروع",
        to: "/admin/inventory",
        search: { tab: "warehouses" },
        tabValue: "warehouses",
        icon: Building2,
        permissionKeys: ["page_inventory_warehouses", "inventory"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/inventory") && tab === "warehouses",
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
          p.startsWith("/admin/inventory") &&
          (tab === "items" || tab === "stock"),
      },
      {
        id: "inventory-transfers",
        label: "التحويلات بين المخازن",
        to: "/admin/inventory",
        search: { tab: "transfers" },
        tabValue: "transfers",
        icon: Truck,
        permissionKeys: ["page_inventory_transfers", "inventory_adjust_transfer"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/inventory") && tab === "transfers",
      },
      {
        id: "inventory-transactions",
        label: "سجل حركات المخزن والتسويات",
        to: "/admin/inventory",
        search: { tab: "transactions" },
        tabValue: "transactions",
        icon: ArrowLeftRight,
        permissionKeys: ["page_inventory_transactions", "inventory"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/inventory") && tab === "transactions",
      },
      {
        id: "inventory-expiry",
        label: "صلاحية وتتبع الدفعات",
        to: "/admin/inventory",
        search: { tab: "expiry" },
        tabValue: "expiry",
        icon: Calendar,
        permissionKeys: ["page_inventory_expiry", "inventory"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/inventory") && tab === "expiry",
      },
      {
        id: "inventory-purchases",
        label: "فواتير وأوامر الشراء",
        to: "/admin/inventory",
        search: { tab: "purchases" },
        tabValue: "purchases",
        icon: ShoppingCart,
        permissionKeys: ["page_inventory_purchases", "purchasing"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/inventory") && tab === "purchases",
      },
      {
        id: "inventory-suppliers",
        label: "إدارة الشركات والموردين",
        to: "/admin/inventory",
        search: { tab: "suppliers" },
        tabValue: "suppliers",
        icon: Users,
        permissionKeys: ["page_inventory_suppliers", "purchasing_view"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/inventory") && tab === "suppliers",
      },
      {
        id: "inventory-waste",
        label: "الهالك والفاقد والتسويات الجردية",
        to: "/admin/inventory",
        search: { tab: "waste" },
        tabValue: "waste",
        icon: AlertCircle,
        permissionKeys: ["page_inventory_waste", "inventory_waste_dispose"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/inventory") && tab === "waste",
      },
      {
        id: "inventory-reports",
        label: "تقارير وتحليلات المخزون",
        to: "/admin/inventory",
        search: { tab: "reports" },
        tabValue: "reports",
        icon: FileText,
        permissionKeys: ["page_inventory_reports", "reports"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/inventory") && tab === "reports",
      },
      {
        id: "inventory-settings",
        label: "إعدادات المخزن",
        to: "/admin/inventory",
        search: { tab: "settings" },
        tabValue: "settings",
        icon: Settings,
        permissionKeys: ["page_inventory_settings", "inventory"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/inventory") && tab === "settings",
      },
    ],
  },
  {
    id: "system",
    label: "خيارات المطور والرقابة",
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
        matchPath: (p, tab) =>
          p.startsWith("/admin/system-update") &&
          (!tab || tab === "system"),
      },
      {
        id: "system-access",
        label: "حزمة قاعدة بيانات أكسس (MS Access)",
        to: "/admin/system-update",
        search: { tab: "access" },
        tabValue: "access",
        icon: Database,
        permissionKeys: ["page_system_access_db", "system_backup_update"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/system-update") && tab === "access",
      },
      {
        id: "system-audit",
        label: "سجل تدقيق ورقابة العمليات",
        to: "/admin/system-update",
        search: { tab: "audit" },
        tabValue: "audit",
        icon: History,
        permissionKeys: ["page_audit_logs", "audit_logs", "system_audit_logs"],
        matchPath: (p, tab) =>
          (p.startsWith("/admin/system-update") &&
            (tab === "audit" || tab === "audit_logs")) ||
          ((p === "/admin" || p === "/admin/") &&
            (tab === "audit_logs" || tab === "shift_audit")),
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
          p.startsWith("/admin/system-update") &&
          (tab === "sync" || tab === "updates"),
      },
      {
        id: "system-status",
        label: "معلومات وحالة الخادم",
        to: "/admin/system-update",
        search: { tab: "status" },
        tabValue: "status",
        icon: ShieldCheck,
        permissionKeys: ["page_system_status", "system_backup_update"],
        matchPath: (p, tab) =>
          p.startsWith("/admin/system-update") && tab === "status",
      },
      {
        id: "system-studio",
        label: "استوديو المطور Pro (المحرر البصري)",
        to: "/admin/studio",
        icon: Sparkles,
        permissionKeys: ["developer_options", "super_admin_full_access"],
        matchPath: (p) =>
          p.startsWith("/admin/studio") ||
          p.startsWith("/admin/developer-studio"),
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
  if (
    (normPath === "/admin" || normPath === "/") &&
    (!activeTab || activeTab === "grid")
  ) {
    return {
      isRootDashboard: true,
      department: null,
      subItem: null,
    };
  }

  // Match department & subItem (always resolving a subItem so the 3-level path is complete)
  for (const dept of NAVIGATION_DEPARTMENTS) {
    // 1. Check all children for an exact match (including index 0)
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

    // 2. If on the department root path itself, always fall back to the first child (index 0)
    // so the 3rd breadcrumb item (اسم القسم الفرعي) is ALWAYS rendered.
    const deptNorm = normalizePathname(dept.to);
    if (normPath === deptNorm || normPath.startsWith(`${deptNorm}/`)) {
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
  const rawPath =
    pathname || (typeof window !== "undefined" ? window.location.pathname : "/");
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

