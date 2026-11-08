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
    if (existingTab !== currentTab) {
      url.searchParams.set("tab", currentTab);
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
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
          (p.startsWith("/admin/restaurant") && s.includes("tab=reports")),
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
            s.includes("tab=tickets")),
      },
      {
        id: "park-reports",
        labelAr: "التقارير",
        labelEn: "Reports",
        to: "/admin/park",
        search: { tab: "reports" },
        icon: FileBarChart,
        matchPath: (p, s) =>
          p.startsWith("/admin/park") && s.includes("tab=reports"),
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
          p.startsWith("/admin/mall") && s.includes("tab=reports"),
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
      pathname.startsWith("/cashier-treasury") ||
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
          p.startsWith("/cashier-treasury") ||
          p.startsWith("/admin/expenses") ||
          (p === "/admin" &&
            (s.includes("tab=treasury_control") ||
              s.includes("tab=vouchers_entry"))) ||
          (p.startsWith("/admin/ledger") &&
            (!s.includes("tab=") ||
              s.includes("tab=hub") ||
              s.includes("tab=operations") ||
              s.includes("tab=vouchers") ||
              s.includes("tab=journal") ||
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
            s.includes("tab=financial_position") ||
            s.includes("tab=ledger") ||
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
          p.startsWith("/admin/inventory") && s.includes("tab=reports"),
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
          p.startsWith("/admin/hr") && s.includes("tab=reports"),
      },
    ],
  },
  {
    id: "shift_audit",
    labelAr: "تدقيق الورديات",
    labelEn: "Shift Audit",
    to: "/admin",
    search: { tab: "shift_audit" },
    icon: ClipboardCheck,
    permissionKeys: [
      "page_shift_audit",
      "shift_audit",
      "manage_park_shifts",
      "restaurant_open_shift",
      "super_admin_full_access",
    ],
    matchDepartment: (pathname, searchStr) =>
      pathname.startsWith("/admin/shifts") ||
      (pathname === "/admin" &&
        (searchStr.includes("tab=shift_audit") ||
          searchStr.includes("tab=shifts"))),
    children: [
      {
        id: "shift-definitions",
        labelAr: "التعريفات",
        labelEn: "Definitions",
        to: "/admin/shifts",
        search: { tab: "definitions" },
        icon: FolderCog,
        matchPath: (p, s) =>
          p.startsWith("/admin/shifts") && s.includes("tab=definitions"),
      },
      {
        id: "shift-operations",
        labelAr: "العمليات",
        labelEn: "Operations",
        to: "/admin",
        search: { tab: "shift_audit" },
        icon: Activity,
        matchPath: (p, s) =>
          (p === "/admin" &&
            (s.includes("tab=shift_audit") || s.includes("tab=shifts"))) ||
          (p.startsWith("/admin/shifts") &&
            (!s.includes("tab=") || s.includes("tab=operations"))),
      },
      {
        id: "shift-reports",
        labelAr: "التقارير",
        labelEn: "Reports",
        to: "/admin/shifts",
        search: { tab: "reports" },
        icon: FileBarChart,
        matchPath: (p, s) =>
          p.startsWith("/admin/shifts") && s.includes("tab=reports"),
      },
    ],
  },
  {
    id: "audit_logs",
    labelAr: "سجل العمليات",
    labelEn: "Audit Logs",
    to: "/admin",
    search: { tab: "audit_logs" },
    icon: BarChart3,
    permissionKeys: ["page_audit_logs", "audit_logs", "system_audit_logs"],
    matchDepartment: (pathname, searchStr) =>
      pathname.startsWith("/admin/audit") ||
      (pathname === "/admin" && searchStr.includes("tab=audit_logs")),
    children: [
      {
        id: "audit-definitions",
        labelAr: "التعريفات",
        labelEn: "Definitions",
        to: "/admin/system-update",
        search: { tab: "access" },
        icon: FolderCog,
        matchPath: (p, s) =>
          p.startsWith("/admin/system-update") && s.includes("tab=access"),
      },
      {
        id: "audit-operations",
        labelAr: "العمليات",
        labelEn: "Operations",
        to: "/admin",
        search: { tab: "audit_logs" },
        icon: Activity,
        matchPath: (p, s) =>
          p === "/admin" && s.includes("tab=audit_logs"),
      },
      {
        id: "audit-reports",
        labelAr: "التقارير",
        labelEn: "Reports",
        to: "/admin/audit",
        icon: FileBarChart,
        matchPath: (p) => p.startsWith("/admin/audit"),
      },
    ],
  },
  {
    id: "system",
    labelAr: "المطور والنسخ الاحتياطي",
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
      pathname.startsWith("/admin/studio"),
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
            s.includes("tab=system") ||
            s.includes("tab=access")),
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
          (p.startsWith("/admin/system-update") &&
            (!s.includes("tab=") ||
              s.includes("tab=operations") ||
              s.includes("tab=sync"))),
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
            s.includes("tab=status")),
      },
    ],
  },
];

export function getActiveDepartment(
  pathname: string,
  searchStr: string,
): NavDepartment | undefined {
  return NAVIGATION_DEPARTMENTS.find((dept) =>
    dept.matchDepartment(pathname, searchStr),
  );
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
