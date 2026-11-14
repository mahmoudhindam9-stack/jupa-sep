import { useEffect } from "react";
import {
  Activity,
  BarChart3,
  Building2,
  ClipboardCheck,
  FileBarChart,
  FolderCog,
  Landmark,
  Package,
  RefreshCw,
  Trees,
  Users,
  Utensils,
  type LucideIcon,
} from "lucide-react";

export interface NavSubsection {
  id: string;
  labelAr: string;
  labelEn: string;
  to: string;
  search?: Record<string, string>;
  icon?: LucideIcon;
  matchPath?: (pathname: string, searchStr: string) => boolean;
}

export interface NavDepartment {
  id: string;
  labelAr: string;
  labelEn: string;
  to: string;
  search?: Record<string, string>;
  icon: LucideIcon;
  permissionKeys: string[];
  matchDepartment: (pathname: string, searchStr: string) => boolean;
  children: NavSubsection[];
}

export function extractTabParam(
  search: unknown,
  searchStr?: string,
): string | undefined {
  if (search && typeof search === "object" && "tab" in (search as Record<string, unknown>)) {
    const val = (search as Record<string, unknown>).tab;
    if (typeof val === "string" && val.trim().length > 0) {
      return val.trim();
    }
  }
  const raw =
    typeof searchStr === "string" && searchStr.length > 0
      ? searchStr
      : typeof window !== "undefined"
        ? window.location.search
        : "";
  if (raw) {
    const params = new URLSearchParams(raw.startsWith("?") ? raw : `?${raw}`);
    const t = params.get("tab");
    if (t && t.trim().length > 0) return t.trim();
  }
  return undefined;
}

export function useSyncedSubTab(
  basePath: string,
  currentTab: string,
  setTab: (tab: string) => void,
  defaultTab = "operations",
): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePopState = () => {
      if (!window.location.pathname.startsWith(basePath)) return;
      const t = extractTabParam(undefined, window.location.search);
      setTab(t || defaultTab);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [basePath, defaultTab, setTab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.location.pathname.startsWith(basePath)) return;
    const url = new URL(window.location.href);
    const existingTab = url.searchParams.get("tab");
    if (currentTab === defaultTab && !existingTab) return;
    // If existingTab is a subpage belonging to currentTab, keep existingTab in the URL
    if (existingTab) {
      const subInfo = getActiveSubpageInfo(url.pathname, url.search);
      if (subInfo && subInfo.parentTab === currentTab) {
        return;
      }
    }
    if (existingTab !== currentTab) {
      const timerId = window.setTimeout(() => {
        if (!window.location.pathname.startsWith(basePath)) return;
        const latestUrl = new URL(window.location.href);
        latestUrl.searchParams.set("tab", currentTab);
        window.history.replaceState(
          window.history.state,
          "",
          `${latestUrl.pathname}${latestUrl.search}`,
        );
      }, 0);
      return () => window.clearTimeout(timerId);
    }
  }, [basePath, currentTab, defaultTab]);
}

export function isRestaurantScreenPath(pathname?: string): boolean {
  const p =
    pathname ?? (typeof window !== "undefined" ? window.location.pathname : "");
  const s = typeof window !== "undefined" ? window.location.search : "";
  return (
    p.startsWith("/admin/restaurant") ||
    p.startsWith("/pos") ||
    p.startsWith("/cashier-treasury") ||
    p.startsWith("/captain") ||
    p.startsWith("/oven") ||
    p.startsWith("/admin/menu") ||
    p.startsWith("/admin/tables") ||
    p.startsWith("/admin/kitchen") ||
    p.startsWith("/admin/delivery") ||
    (p === "/admin" &&
      (s.includes("tab=orders_Waiter") ||
        s.includes("tab=Previous_orders") ||
        s.includes("tab=Cancelled_orders")))
  );
}

export const NAVIGATION_DEPARTMENTS: NavDepartment[] = [
  {
    id: "restaurant",
    labelAr: "إدارة المطعم",
    labelEn: "Restaurant Management",
    to: "/admin/restaurant",
    icon: Utensils,
    permissionKeys: [
      "page_restaurant",
      "orders",
      "pos",
      "captain",
      "kitchen",
      "delivery",
      "restaurant_open_shift",
      "production",
    ],
    matchDepartment: (pathname, searchStr) =>
      pathname.startsWith("/admin/restaurant") ||
      pathname.startsWith("/pos") ||
      pathname.startsWith("/cashier-treasury") ||
      pathname.startsWith("/captain") ||
      pathname.startsWith("/oven") ||
      pathname.startsWith("/admin/menu") ||
      pathname.startsWith("/admin/tables") ||
      pathname.startsWith("/admin/kitchen") ||
      pathname.startsWith("/admin/delivery") ||
      pathname.startsWith("/admin/crm") ||
      (pathname === "/admin" &&
        (searchStr.includes("tab=orders_Waiter") ||
          searchStr.includes("tab=Previous_orders") ||
          searchStr.includes("tab=Cancelled_orders") ||
          searchStr.includes("tab=reports"))),
    children: [
      {
        id: "rest-definitions",
        labelAr: "التعريفات",
        labelEn: "Definitions",
        to: "/admin/restaurant",
        search: { tab: "definitions" },
        icon: FolderCog,
        matchPath: (p, s) =>
          p.startsWith("/admin/menu") ||
          p.startsWith("/admin/tables") ||
          p.startsWith("/admin/kitchen") ||
          p.startsWith("/admin/crm") ||
          (p.startsWith("/admin/restaurant") &&
            (s.includes("tab=definitions") ||
              s.includes("tab=menu") ||
              s.includes("tab=tables") ||
              s.includes("tab=inventory"))),
      },
      {
        id: "rest-operations",
        labelAr: "العمليات",
        labelEn: "Operations",
        to: "/admin/restaurant",
        search: { tab: "operations" },
        icon: Activity,
        matchPath: (p, s) =>
          p.startsWith("/pos") ||
          p.startsWith("/cashier-treasury") ||
          p.startsWith("/captain") ||
          p.startsWith("/oven") ||
          p.startsWith("/admin/delivery") ||
          (p === "/admin" &&
            (s.includes("tab=orders_Waiter") ||
              s.includes("tab=Previous_orders") ||
              s.includes("tab=Cancelled_orders"))) ||
          (p.startsWith("/admin/restaurant") &&
            (!s.includes("tab=") || s.includes("tab=operations"))),
      },
      {
        id: "rest-reports",
        labelAr: "التقارير",
        labelEn: "Reports",
        to: "/admin/restaurant",
        search: { tab: "reports" },
        icon: FileBarChart,
        matchPath: (p, s) =>
          (p === "/admin" && s.includes("tab=reports")) ||
          (p.startsWith("/admin/restaurant") &&
            (s.includes("tab=reports") ||
              s.includes("tab=rep_") ||
              s.includes("tab=daily_summary"))),
      },
    ],
  },
  {
    id: "park",
    labelAr: "إدارة الحديقة",
    labelEn: "Garden Management",
    to: "/admin/park",
    icon: Trees,
    permissionKeys: [
      "page_park",
      "manage_park_shifts",
      "delete_park_shifts",
      "park_reports",
      "mall_garden_finance",
    ],
    matchDepartment: (pathname) => pathname.startsWith("/admin/park"),
    children: [
      {
        id: "park-definitions",
        labelAr: "التعريفات",
        labelEn: "Definitions",
        to: "/admin/park",
        search: { tab: "definitions" },
        icon: FolderCog,
        matchPath: (p, s) =>
          p.startsWith("/admin/park") &&
          (s.includes("tab=definitions") ||
            s.includes("tab=games") ||
            s.includes("tab=prices") ||
            s.includes("tab=customers") ||
            s.includes("tab=treasury")),
      },
      {
        id: "park-operations",
        labelAr: "العمليات",
        labelEn: "Operations",
        to: "/admin/park",
        search: { tab: "operations" },
        icon: Activity,
        matchPath: (p, s) =>
          p.startsWith("/admin/park") &&
          (!s.includes("tab=") ||
            s.includes("tab=operations") ||
            s.includes("tab=tickets") ||
            s.includes("tab=cashier_treasury")),
      },
      {
        id: "park-reports",
        labelAr: "التقارير",
        labelEn: "Reports",
        to: "/admin/park",
        search: { tab: "reports" },
        icon: FileBarChart,
        matchPath: (p, s) =>
          p.startsWith("/admin/park") &&
          (s.includes("tab=reports") || s.includes("tab=rep_")),
      },
    ],
  },
  {
    id: "mall",
    labelAr: "إدارة المول",
    labelEn: "Mall Management",
    to: "/admin/mall",
    icon: Building2,
    permissionKeys: ["page_mall", "mall_manage_shops", "mall_garden_finance"],
    matchDepartment: (pathname) => pathname.startsWith("/admin/mall"),
    children: [
      {
        id: "mall-definitions",
        labelAr: "التعريفات",
        labelEn: "Definitions",
        to: "/admin/mall",
        search: { tab: "definitions" },
        icon: FolderCog,
        matchPath: (p, s) =>
          p.startsWith("/admin/mall") &&
          (s.includes("tab=definitions") ||
            s.includes("tab=shops") ||
            s.includes("tab=edit_shops") ||
            s.includes("tab=units") ||
            s.includes("tab=tenants") ||
            s.includes("tab=readings")),
      },
      {
        id: "mall-operations",
        labelAr: "العمليات",
        labelEn: "Operations",
        to: "/admin/mall",
        search: { tab: "operations" },
        icon: Activity,
        matchPath: (p, s) =>
          p.startsWith("/admin/mall") &&
          (!s.includes("tab=") ||
            s.includes("tab=operations") ||
            s.includes("tab=overview") ||
            s.includes("tab=contracts") ||
            s.includes("tab=collections") ||
            s.includes("tab=arrears")),
      },
      {
        id: "mall-reports",
        labelAr: "التقارير",
        labelEn: "Reports",
        to: "/admin/mall",
        search: { tab: "reports" },
        icon: FileBarChart,
        matchPath: (p, s) =>
          p.startsWith("/admin/mall") &&
          (s.includes("tab=reports") || s.includes("tab=rep_")),
      },
    ],
  },
  {
    id: "financial",
    labelAr: "الإدارة المالية",
    labelEn: "Financial Management",
    to: "/admin/ledger",
    icon: Landmark,
    permissionKeys: [
      "page_finance",
      "accounting",
      "accounting_view",
      "treasury",
      "reports",
    ],
    matchDepartment: (pathname, searchStr) =>
      pathname.startsWith("/admin/ledger") ||
      pathname.startsWith("/admin/expenses") ||
      pathname.startsWith("/admin/receipts") ||
      (pathname === "/admin" &&
        (searchStr.includes("tab=treasury_control") ||
          searchStr.includes("tab=vouchers_entry"))),
    children: [
      {
        id: "fin-definitions",
        labelAr: "التعريفات",
        labelEn: "Definitions",
        to: "/admin/ledger",
        search: { tab: "definitions" },
        icon: FolderCog,
        matchPath: (p, s) =>
          p.startsWith("/admin/receipts") ||
          (p.startsWith("/admin/ledger") &&
            (s.includes("tab=definitions") ||
              s.includes("tab=accounts") ||
              s.includes("tab=treasury"))),
      },
      {
        id: "fin-operations",
        labelAr: "العمليات",
        labelEn: "Operations",
        to: "/admin/ledger",
        search: { tab: "operations" },
        icon: Activity,
        matchPath: (p, s) =>
          p.startsWith("/admin/expenses") ||
          (p === "/admin" &&
            (s.includes("tab=treasury_control") ||
              s.includes("tab=vouchers_entry"))) ||
          (p.startsWith("/admin/ledger") &&
            (!s.includes("tab=") ||
              s.includes("tab=hub") ||
              s.includes("tab=operations") ||
              s.includes("tab=vouchers") ||
              s.includes("tab=transfers") ||
              s.includes("tab=journal") ||
              s.includes("tab=general_ledger") ||
              s.includes("tab=ledger") ||
              s.includes("tab=mall_finance"))),
      },
      {
        id: "fin-reports",
        labelAr: "التقارير",
        labelEn: "Reports",
        to: "/admin/ledger",
        search: { tab: "reports" },
        icon: FileBarChart,
        matchPath: (p, s) =>
          p.startsWith("/admin/ledger") &&
          (s.includes("tab=reports") ||
            s.includes("tab=vouchers_register") ||
            s.includes("tab=unified_reports") ||
            s.includes("tab=treasury_report") ||
            s.includes("tab=financial_position") ||
            s.includes("tab=trial") ||
            s.includes("tab=statements")),
      },
    ],
  },
  {
    id: "inventory",
    labelAr: "المخزون والمستودعات",
    labelEn: "Inventory & Warehouses",
    to: "/admin/inventory",
    icon: Package,
    permissionKeys: [
      "page_inventory",
      "inventory",
      "inventory_view",
      "purchasing",
      "purchasing_view",
    ],
    matchDepartment: (pathname) => pathname.startsWith("/admin/inventory"),
    children: [
      {
        id: "inv-definitions",
        labelAr: "التعريفات",
        labelEn: "Definitions",
        to: "/admin/inventory",
        search: { tab: "definitions" },
        icon: FolderCog,
        matchPath: (p, s) =>
          p.startsWith("/admin/inventory") &&
          (s.includes("tab=definitions") ||
            s.includes("tab=stock") ||
            s.includes("tab=warehouses") ||
            s.includes("tab=suppliers") ||
            s.includes("tab=settings")),
      },
      {
        id: "inv-operations",
        labelAr: "العمليات",
        labelEn: "Operations",
        to: "/admin/inventory",
        search: { tab: "operations" },
        icon: Activity,
        matchPath: (p, s) =>
          p.startsWith("/admin/inventory") &&
          (!s.includes("tab=") ||
            s.includes("tab=grid") ||
            s.includes("tab=operations") ||
            s.includes("tab=overview") ||
            s.includes("tab=transactions") ||
            s.includes("tab=transfers") ||
            s.includes("tab=expiry") ||
            s.includes("tab=waste") ||
            s.includes("tab=purchases")),
      },
      {
        id: "inv-reports",
        labelAr: "التقارير",
        labelEn: "Reports",
        to: "/admin/inventory",
        search: { tab: "reports" },
        icon: FileBarChart,
        matchPath: (p, s) =>
          p.startsWith("/admin/inventory") &&
          (s.includes("tab=reports") || s.includes("tab=rep_")),
      },
    ],
  },
  {
    id: "hr",
    labelAr: "الموارد البشرية والمستخدمين",
    labelEn: "HR & Users",
    to: "/admin/hr",
    icon: Users,
    permissionKeys: [
      "page_hr",
      "hr",
      "hr_view_attendance",
      "hr_manage_payroll_loans",
      "users_roles",
      "system_manage_users",
    ],
    matchDepartment: (pathname) =>
      pathname.startsWith("/admin/hr") || pathname.startsWith("/admin/users"),
    children: [
      {
        id: "hr-definitions",
        labelAr: "التعريفات",
        labelEn: "Definitions",
        to: "/admin/hr",
        search: { tab: "definitions" },
        icon: FolderCog,
        matchPath: (p, s) =>
          p.startsWith("/admin/users") ||
          (p.startsWith("/admin/hr") &&
            (s.includes("tab=definitions") ||
              s.includes("tab=employees") ||
              s.includes("tab=users"))),
      },
      {
        id: "hr-operations",
        labelAr: "العمليات",
        labelEn: "Operations",
        to: "/admin/hr",
        search: { tab: "operations" },
        icon: Activity,
        matchPath: (p, s) =>
          p.startsWith("/admin/hr") &&
          (!s.includes("tab=") ||
            s.includes("tab=grid") ||
            s.includes("tab=operations") ||
            s.includes("tab=overview") ||
            s.includes("tab=attendance") ||
            s.includes("tab=payroll") ||
            s.includes("tab=loans")),
      },
      {
        id: "hr-reports",
        labelAr: "التقارير",
        labelEn: "Reports",
        to: "/admin/hr",
        search: { tab: "reports" },
        icon: FileBarChart,
        matchPath: (p, s) =>
          p.startsWith("/admin/hr") &&
          (s.includes("tab=reports") || s.includes("tab=rep_")),
      },
    ],
  },
  {
    id: "shift_audit",
    labelAr: "تدقيق الورديات وسجل العمليات",
    labelEn: "Shift Audit & Operations Log",
    to: "/admin",
    search: { tab: "shift_audit" },
    icon: ClipboardCheck,
    permissionKeys: [
      "page_shift_audit",
      "shift_audit",
      "manage_park_shifts",
      "restaurant_open_shift",
      "page_audit_logs",
      "audit_logs",
      "system_audit_logs",
      "super_admin_full_access",
    ],
    matchDepartment: (pathname, searchStr) =>
      pathname.startsWith("/admin/shifts") ||
      pathname.startsWith("/admin/audit") ||
      (pathname === "/admin" &&
        (searchStr.includes("tab=shift_audit") ||
          searchStr.includes("tab=audit_logs") ||
          searchStr.includes("tab=shifts"))),
    children: [
      {
        id: "shift-definitions",
        labelAr: "التعريفات",
        labelEn: "Definitions",
        to: "/admin",
        search: { tab: "shift_audit", section: "definitions" },
        icon: FolderCog,
        matchPath: (p, s) =>
          p === "/admin" &&
          (s.includes("tab=shift_audit") || s.includes("tab=audit_logs")) &&
          s.includes("section=definitions"),
      },
      {
        id: "shift-operations",
        labelAr: "العمليات",
        labelEn: "Operations",
        to: "/admin",
        search: { tab: "shift_audit", section: "operations" },
        icon: Activity,
        matchPath: (p, s) =>
          p === "/admin" &&
          (s.includes("tab=shift_audit") ||
            s.includes("tab=audit_logs") ||
            s.includes("tab=shifts")) &&
          !s.includes("section=definitions") &&
          !s.includes("section=reports"),
      },
      {
        id: "shift-reports",
        labelAr: "التقارير",
        labelEn: "Reports",
        to: "/admin",
        search: { tab: "shift_audit", section: "reports" },
        icon: FileBarChart,
        matchPath: (p, s) =>
          p === "/admin" &&
          (s.includes("tab=shift_audit") || s.includes("tab=audit_logs")) &&
          s.includes("section=reports"),
      },
    ],
  },
  {
    id: "system",
    labelAr: "خيارات المطور والنسخ الاحتياطي",
    labelEn: "Developer & System",
    to: "/admin/system-update",
    icon: RefreshCw,
    permissionKeys: [
      "page_developer",
      "system_backup_update",
      "developer_options",
      "branch_mgmt",
    ],
    matchDepartment: (pathname) =>
      pathname.startsWith("/admin/system-update") ||
      pathname.startsWith("/admin/studio") ||
      pathname.startsWith("/admin/developer-studio"),
    children: [
      {
        id: "sys-definitions",
        labelAr: "التعريفات",
        labelEn: "Definitions",
        to: "/admin/system-update",
        search: { tab: "definitions" },
        icon: FolderCog,
        matchPath: (p, s) =>
          p.startsWith("/admin/system-update") &&
          (s.includes("tab=definitions") ||
            s.includes("tab=access") ||
            s.includes("tab=access_package") ||
            s.includes("tab=github_vercel_config")),
      },
      {
        id: "sys-operations",
        labelAr: "العمليات",
        labelEn: "Operations",
        to: "/admin/system-update",
        search: { tab: "operations" },
        icon: Activity,
        matchPath: (p, s) =>
          p.startsWith("/admin/studio") ||
          p.startsWith("/admin/developer-studio") ||
          (p.startsWith("/admin/system-update") &&
            (!s.includes("tab=") ||
              s.includes("tab=operations") ||
              s.includes("tab=system") ||
              s.includes("tab=sync") ||
              s.includes("tab=github_sync") ||
              s.includes("tab=backup_restore"))),
      },
      {
        id: "sys-reports",
        labelAr: "التقارير",
        labelEn: "Reports",
        to: "/admin/system-update",
        search: { tab: "reports" },
        icon: FileBarChart,
        matchPath: (p, s) =>
          p.startsWith("/admin/system-update") &&
          (s.includes("tab=reports") ||
            s.includes("tab=audit") ||
            s.includes("tab=status") ||
            s.includes("tab=tables_report") ||
            s.includes("tab=release_status")),
      },
    ],
  },
];

export interface ActiveSubpageInfo {
  labelAr: string;
  labelEn: string;
  parentTab: "definitions" | "operations" | "reports";
  parentPath: string;
  parentSearch?: Record<string, string>;
}

const SHIFT_AUDIT_SUBPAGES: Record<
  string,
  { labelAr: string; labelEn: string; parentTab: "definitions" | "operations" | "reports" }
> = {
  shift_rules: {
    labelAr: "قنوات وضوابط تدقيق الورديات",
    labelEn: "Shift Audit Channels & Rules",
    parentTab: "definitions",
  },
  audit_rules: {
    labelAr: "إعدادات وقواعد سجل العمليات",
    labelEn: "Operations Log Rules",
    parentTab: "definitions",
  },
  shifts: {
    labelAr: "تدقيق ومطابقة الورديات",
    labelEn: "Shift Audit & Reconciliation",
    parentTab: "operations",
  },
  operations_log: {
    labelAr: "سجل العمليات والرقابة المباشر",
    labelEn: "Live Operations Audit Log",
    parentTab: "operations",
  },
  shift_summary: {
    labelAr: "تقرير وسجل تدقيق الورديات الشامل",
    labelEn: "Comprehensive Shift Audit Report",
    parentTab: "reports",
  },
  audit_summary: {
    labelAr: "تقرير وطباعة سجل العمليات الرقابي",
    labelEn: "Operations Audit Log Report",
    parentTab: "reports",
  },
};

const SUBPAGE_REGISTRY: Record<
  string,
  Record<
    string,
    { labelAr: string; labelEn: string; parentTab: "definitions" | "operations" | "reports" }
  >
> = {
  "/admin/ledger": {
    accounts: { labelAr: "شجرة ودليل الحسابات", labelEn: "Chart of Accounts", parentTab: "definitions" },
    treasury: { labelAr: "تعريف الخزائن والبنوك", labelEn: "Treasuries & Banks", parentTab: "definitions" },
    vouchers: { labelAr: "إصدار سند مالي جديد", labelEn: "Issue Financial Voucher", parentTab: "operations" },
    transfers: { labelAr: "التحويل بين الخزائن", labelEn: "Treasury Transfers", parentTab: "operations" },
    journal: { labelAr: "قيود اليومية المحاسبية", labelEn: "Journal Entries", parentTab: "operations" },
    general_ledger: { labelAr: "دفتر الأستاذ العام", labelEn: "General Ledger", parentTab: "operations" },
    ledger: { labelAr: "دفتر الأستاذ العام", labelEn: "General Ledger", parentTab: "operations" },
    vouchers_register: { labelAr: "تفقد وسجل سندات القبض والصرف", labelEn: "Vouchers Register", parentTab: "reports" },
    unified_reports: { labelAr: "النظام المحاسبي والتقارير المالية الشاملة", labelEn: "Comprehensive Financial Reports", parentTab: "reports" },
    financial_position: { labelAr: "النظام المحاسبي والتقارير المالية الشاملة", labelEn: "Comprehensive Financial Reports", parentTab: "reports" },
    trial: { labelAr: "النظام المحاسبي والتقارير المالية الشاملة", labelEn: "Comprehensive Financial Reports", parentTab: "reports" },
    statements: { labelAr: "النظام المحاسبي والتقارير المالية الشاملة", labelEn: "Comprehensive Financial Reports", parentTab: "reports" },
    treasury_report: { labelAr: "تقرير أرصدة وحركة الخزائن", labelEn: "Treasury Movement Report", parentTab: "reports" },
  },
  "/admin/inventory": {
    stock: { labelAr: "دليل الأصناف والمواد الخام", labelEn: "Items & Raw Materials", parentTab: "definitions" },
    warehouses: { labelAr: "تعريف المستودعات والمخازن", labelEn: "Warehouses Definition", parentTab: "definitions" },
    suppliers: { labelAr: "دليل الموردين والشركات", labelEn: "Suppliers Directory", parentTab: "definitions" },
    settings: { labelAr: "ربط الحسابات وسياسات المخزون", labelEn: "Inventory Settings", parentTab: "definitions" },
    purchases: { labelAr: "فواتير المشتريات والتوريد", labelEn: "Purchase Invoices", parentTab: "operations" },
    transfers: { labelAr: "التحويلات المخزنية والصرف", labelEn: "Warehouse Transfers", parentTab: "operations" },
    transactions: { labelAr: "سجل الحركات والأذون المخزنية", labelEn: "Inventory Transactions", parentTab: "operations" },
    waste: { labelAr: "تسجيل الهالك والتسويات الجردية", labelEn: "Waste & Adjustments", parentTab: "operations" },
    expiry: { labelAr: "متابعة تواريخ الصلاحية", labelEn: "Expiry Tracking", parentTab: "operations" },
    rep_current_stock: { labelAr: "تقرير أرصدة المخزون الحالية", labelEn: "Current Stock Report", parentTab: "reports" },
    rep_valuation: { labelAr: "تقييم المخزون المالي", labelEn: "Inventory Valuation Report", parentTab: "reports" },
    rep_movement: { labelAr: "تقرير حركة الأصناف والتوريد", labelEn: "Item Movement Report", parentTab: "reports" },
    rep_low_stock: { labelAr: "تقرير النواقص وحد الطلب", labelEn: "Low Stock Report", parentTab: "reports" },
    rep_waste: { labelAr: "تقرير الهالك والتالف", labelEn: "Waste Report", parentTab: "reports" },
    rep_food_cost: { labelAr: "تقرير تكلفة الأغذية (Food Cost)", labelEn: "Food Cost Report", parentTab: "reports" },
  },
  "/admin/hr": {
    employees: { labelAr: "سجل وبيانات الموظفين", labelEn: "Employees Directory", parentTab: "definitions" },
    users: { labelAr: "حسابات المستخدمين والصلاحيات", labelEn: "Users & Permissions", parentTab: "definitions" },
    attendance: { labelAr: "تسجيل الحضور والانصراف", labelEn: "Attendance Tracking", parentTab: "operations" },
    payroll: { labelAr: "مسير الرواتب والأجور", labelEn: "Payroll Management", parentTab: "operations" },
    loans: { labelAr: "السلف والخصومات", labelEn: "Loans & Deductions", parentTab: "operations" },
    rep_payroll: { labelAr: "تقرير مسير الرواتب", labelEn: "Payroll Report", parentTab: "reports" },
    rep_attendance: { labelAr: "تقرير الحضور والغياب", labelEn: "Attendance Report", parentTab: "reports" },
    rep_loans: { labelAr: "تقرير السلف والخصومات", labelEn: "Loans Report", parentTab: "reports" },
  },
  "/admin/mall": {
    shops: { labelAr: "دليل المحلات والوحدات", labelEn: "Shops & Units", parentTab: "definitions" },
    edit_shops: {
      labelAr: "تعديل بيانات المحلات والحقول المخصصة",
      labelEn: "Edit Shop Data & Custom Fields",
      parentTab: "definitions",
    },
    units: { labelAr: "دليل المحلات والوحدات", labelEn: "Shops & Units", parentTab: "definitions" },
    tenants: { labelAr: "سجل المستأجرين", labelEn: "Tenants Directory", parentTab: "definitions" },
    readings: { labelAr: "قراءات العدادات والمرافق", labelEn: "Meter Readings", parentTab: "definitions" },
    contracts: { labelAr: "عقود الإيجار النشطة", labelEn: "Active Lease Contracts", parentTab: "operations" },
    collections: { labelAr: "تحصيل الإيجارات والمرافق", labelEn: "Rent & Utility Collections", parentTab: "operations" },
    arrears: { labelAr: "متابعة المتأخرات والمديونيات", labelEn: "Arrears & Dues", parentTab: "operations" },
    rep_revenue: { labelAr: "تقرير إيرادات وتحصيلات المول", labelEn: "Mall Revenue Report", parentTab: "reports" },
    rep_arrears: { labelAr: "تقرير المتأخرات والمديونيات", labelEn: "Mall Arrears Report", parentTab: "reports" },
    rep_occupancy: { labelAr: "تقرير نسب الإشغال والوحدات", labelEn: "Occupancy Report", parentTab: "reports" },
  },
  "/admin/park": {
    games: { labelAr: "تعريف الألعاب والأنشطة", labelEn: "Games & Activities", parentTab: "definitions" },
    prices: { labelAr: "فئات وأسعار التذاكر", labelEn: "Ticket Categories & Prices", parentTab: "definitions" },
    customers: { labelAr: "سجل عملاء الحديقة", labelEn: "Park Customers", parentTab: "definitions" },
    treasury: { labelAr: "ربط خزينة وحسابات الحديقة", labelEn: "Park Treasury Settings", parentTab: "definitions" },
    tickets: { labelAr: "نقطة بيع التذاكر والورديات", labelEn: "Tickets POS & Shifts", parentTab: "operations" },
    cashier_treasury: { labelAr: "شاشة الكاشير والخزينة", labelEn: "Cashier & Treasury", parentTab: "operations" },
    rep_sales: { labelAr: "سجل تذاكر الدخول والمبيعات", labelEn: "Tickets Sales Report", parentTab: "reports" },
    rep_shifts: { labelAr: "تقارير ورديات الحديقة", labelEn: "Park Shifts Report", parentTab: "reports" },
    rep_games: { labelAr: "تقرير أداء الألعاب", labelEn: "Games Performance Report", parentTab: "reports" },
  },
  "/admin/restaurant": {
    menu: { labelAr: "قائمة الطعام والأصناف", labelEn: "Menu & Categories", parentTab: "definitions" },
    tables: { labelAr: "إدارة الطاولات والصالات", labelEn: "Tables & Dining Areas", parentTab: "definitions" },
    inventory: { labelAr: "الريسبي ومكونات الأصناف", labelEn: "Recipes & Ingredients", parentTab: "definitions" },
    rep_sales: { labelAr: "تقرير مبيعات المطعم التفصيلي", labelEn: "Restaurant Sales Report", parentTab: "reports" },
    rep_shifts: { labelAr: "سجل وتقارير ورديات المطعم", labelEn: "Restaurant Shifts Report", parentTab: "reports" },
    rep_items: { labelAr: "تقرير الأصناف الأكثر مبيعاً", labelEn: "Top Selling Items Report", parentTab: "reports" },
    daily_summary: { labelAr: "ملخص المبيعات اليومي", labelEn: "Daily Sales Summary", parentTab: "reports" },
  },
  "/admin/system-update": {
    access: { labelAr: "إعدادات الفروع وقواعد البيانات", labelEn: "Branches & Access DB", parentTab: "definitions" },
    access_package: { labelAr: "حزمة وجداول قاعدة بيانات أكسس", labelEn: "Access DB Package", parentTab: "definitions" },
    github_vercel_config: { labelAr: "إعدادات مستودع GitHub والربط السحابي", labelEn: "GitHub & Vercel Config", parentTab: "definitions" },
    system: { labelAr: "النسخ الاحتياطي والتحديثات", labelEn: "Backups & System Updates", parentTab: "operations" },
    github_sync: { labelAr: "تحديث ومزامنة النظام و GitHub", labelEn: "GitHub Sync & Updates", parentTab: "operations" },
    backup_restore: { labelAr: "النسخ الاحتياطي واستعادة البيانات", labelEn: "Backup & Restore", parentTab: "operations" },
    sync: { labelAr: "المزامنة السحابية والربط", labelEn: "Cloud Sync & Integration", parentTab: "operations" },
    audit: { labelAr: "سجل التدقيق والعمليات", labelEn: "System Audit Logs", parentTab: "reports" },
    status: { labelAr: "حالة النظام والفحص الذاتي", labelEn: "System Health & Diagnostics", parentTab: "reports" },
    tables_report: { labelAr: "تقرير إحصائيات جداول النظام والسجلات", labelEn: "System Tables Report", parentTab: "reports" },
    release_status: { labelAr: "تقرير حالة الإصدارات والربط السحابي", labelEn: "Release & Cloud Status", parentTab: "reports" },
  },
  "/admin": {
    shift_audit: { labelAr: "تدقيق الورديات وسجل العمليات", labelEn: "Shift Audit & Operations Log", parentTab: "operations" },
    audit_logs: { labelAr: "سجل العمليات والرقابة الشاملة", labelEn: "System Audit & Operations Log", parentTab: "reports" },
    shifts: { labelAr: "تدقيق الورديات وسجل العمليات", labelEn: "Shift Audit & Operations Log", parentTab: "operations" },
  },
};

export function resolveStudioLinkedLabel(defaultLabel: string): string {
  if (!defaultLabel || typeof window === "undefined") return defaultLabel;
  try {
    const raw = window.localStorage.getItem("restocash_studio_linked_renames_v1");
    if (!raw) return defaultLabel;
    const map = JSON.parse(raw) as Record<string, string>;
    const trimmed = defaultLabel.trim();
    if (map && typeof map[trimmed] === "string" && map[trimmed].trim().length > 0) {
      return map[trimmed].trim();
    }
  } catch {
    // ignore storage errors
  }
  return defaultLabel;
}

export function getResolvedNavigationDepartments(): NavDepartment[] {
  return NAVIGATION_DEPARTMENTS.map((dept) => ({
    ...dept,
    labelAr: resolveStudioLinkedLabel(dept.labelAr),
    children: dept.children.map((sub) => ({
      ...sub,
      labelAr: resolveStudioLinkedLabel(sub.labelAr),
    })),
  }));
}

export function getActiveSubpageInfo(
  pathname: string,
  searchStr: string,
): ActiveSubpageInfo | undefined {
  const tab = extractTabParam(undefined, searchStr);
  if (
    pathname === "/admin" &&
    (tab === "shift_audit" || tab === "audit_logs" || tab === "shifts")
  ) {
    try {
      const sp = new URLSearchParams(searchStr.startsWith("?") ? searchStr.slice(1) : searchStr);
      const tool = sp.get("tool");
      if (tool && SHIFT_AUDIT_SUBPAGES[tool]) {
        const sub = SHIFT_AUDIT_SUBPAGES[tool];
        return {
          ...sub,
          parentPath: "/admin",
          parentSearch: { tab: "shift_audit", section: sub.parentTab },
        };
      }
    } catch {
      // ignore
    }
    return undefined;
  }

  if (!tab || tab === "definitions" || tab === "operations" || tab === "reports" || tab === "hub" || tab === "grid" || tab === "overview") {
    return undefined;
  }

  for (const [basePath, map] of Object.entries(SUBPAGE_REGISTRY)) {
    const matchesBase =
      basePath === "/admin"
        ? pathname === "/admin" || pathname === "/admin/"
        : pathname.startsWith(basePath);
    if (matchesBase && map[tab]) {
      return {
        ...map[tab],
        labelAr: resolveStudioLinkedLabel(map[tab].labelAr),
        parentPath: basePath,
      };
    }
  }
  return undefined;
}

export function getActiveDepartment(
  pathname: string,
  searchStr: string,
): NavDepartment | undefined {
  const found = NAVIGATION_DEPARTMENTS.find((dept) =>
    dept.matchDepartment(pathname, searchStr),
  );
  if (!found) return undefined;
  return {
    ...found,
    labelAr: resolveStudioLinkedLabel(found.labelAr),
    children: found.children.map((sub) => ({
      ...sub,
      labelAr: resolveStudioLinkedLabel(sub.labelAr),
    })),
  };
}

export function getActiveSubsection(
  dept: NavDepartment | undefined,
  pathname: string,
  searchStr: string,
): NavSubsection | undefined {
  if (!dept) return undefined;
  return dept.children.find((sub) =>
    sub.matchPath ? sub.matchPath(pathname, searchStr) : pathname === sub.to,
  );
}
