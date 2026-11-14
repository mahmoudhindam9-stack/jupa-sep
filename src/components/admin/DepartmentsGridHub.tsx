// @ts-nocheck
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  UtensilsCrossed,
  Building2,
  Trees,
  Landmark,
  UserCheck,
  Package,
  Settings,
  ChevronDown,
  Store,
  Users,
  ClipboardList,
  History,
  TrendingUp,
  FileBarChart,
  BookOpen,
  FileText,
  Wallet,
  Receipt,
  Scale,
  CalendarDays,
  DollarSign,
  Coins,
  ShieldCheck,
  ArrowLeftRight,
  FileSpreadsheet,
  Trash2,
  RefreshCw,
  Database,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Search,
  Layers,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { ViewModeToggle, useViewMode } from "@/components/ui/view-mode-toggle";
import { cn } from "@/lib/utils";
import { erpStore } from "@/shared/services/erpStore";
import { useSettings } from "@/hooks/use-settings";
import {
  getActiveUserPermissionsSync,
  isDepartmentPermitted,
  PERMISSIONS_UPDATED_EVENT,
} from "@/shared/services/userAuthorization";

interface DepartmentCardItem {
  id: string;
  code: string;
  title: string;
  to: string;
  search?: Record<string, string>;
  icon: any;
  permissionKeys: string[];
  colorScheme: {
    bgLight: string;
    border: string;
    iconBg: string;
    iconText: string;
    hoverBorder: string;
    badgeBg: string;
    accentGlow: string;
    dotColor: string;
  };
  subSections: {
    title: string;
    to: string;
    search?: Record<string, string>;
    icon: any;
    permissionKeys?: string[];
  }[];
}

const DEPARTMENTS: DepartmentCardItem[] = [
  {
    id: "restaurant",
    code: "MOD-01",
    title: "إدارة المطعم",
    to: "/admin/restaurant",
    icon: UtensilsCrossed,
    permissionKeys: [
      "page_restaurant",
      "orders",
      "orders_view",
      "pos",
      "pos_access",
      "captain",
      "captain_access",
      "kitchen",
      "kitchen_view",
      "delivery",
      "delivery_view",
      "inventory",
      "purchasing",
      "production",
      "restaurant_open_shift",
      "restaurant_returns",
    ],
    colorScheme: {
      bgLight: "bg-amber-500/5",
      border: "border-border/80",
      iconBg: "bg-amber-500/12 text-amber-600 dark:text-amber-400 border-amber-500/25",
      iconText: "text-amber-600 dark:text-amber-400",
      hoverBorder: "hover:border-amber-500/45",
      badgeBg: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20",
      accentGlow: "from-amber-500 via-amber-400/50 to-transparent",
      dotColor: "bg-amber-500",
    },
    subSections: [
      {
        title: "التعريفات",
        to: "/admin/restaurant",
        search: { tab: "definitions" },
        icon: Settings,
        permissionKeys: [
          "page_restaurant",
          "page_restaurant_menu",
          "page_restaurant_tables",
          "page_restaurant_inventory",
          "pos",
          "inventory",
          "orders",
        ],
      },
      {
        title: "العمليات",
        to: "/admin/restaurant",
        search: { tab: "operations" },
        icon: Store,
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
      },
      {
        title: "التقارير",
        to: "/admin/restaurant",
        search: { tab: "reports" },
        icon: FileBarChart,
        permissionKeys: [
          "page_restaurant",
          "reports",
          "pos",
          "pos_access",
          "orders",
          "orders_view",
          "treasury",
        ],
      },
    ],
  },
  {
    id: "mall",
    code: "MOD-02",
    title: "إدارة المول",
    to: "/admin/mall",
    icon: Building2,
    permissionKeys: ["page_mall", "mall_manage_shops", "mall_garden_finance", "accounting"],
    colorScheme: {
      bgLight: "bg-blue-500/5",
      border: "border-border/80",
      iconBg: "bg-blue-500/12 text-blue-600 dark:text-blue-400 border-blue-500/25",
      iconText: "text-blue-600 dark:text-blue-400",
      hoverBorder: "hover:border-blue-500/45",
      badgeBg: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20",
      accentGlow: "from-blue-500 via-blue-400/50 to-transparent",
      dotColor: "bg-blue-500",
    },
    subSections: [
      {
        title: "التعريفات",
        to: "/admin/mall",
        search: { tab: "definitions" },
        icon: Store,
        permissionKeys: ["page_mall", "page_mall_shops", "mall_manage_shops"],
      },
      {
        title: "العمليات",
        to: "/admin/mall",
        search: { tab: "operations" },
        icon: ClipboardList,
        permissionKeys: ["page_mall", "page_mall_shops", "mall_manage_shops"],
      },
      {
        title: "التقارير",
        to: "/admin/mall",
        search: { tab: "reports" },
        icon: TrendingUp,
        permissionKeys: ["page_mall", "page_mall_reports", "mall_manage_shops", "reports"],
      },
    ],
  },
  {
    id: "park",
    code: "MOD-03",
    title: "إدارة الحديقة",
    to: "/admin/park",
    icon: Trees,
    permissionKeys: [
      "page_park",
      "manage_park_shifts",
      "delete_park_shifts",
      "park_reports",
      "park_open_shift",
      "park_returns",
      "mall_garden_finance",
    ],
    colorScheme: {
      bgLight: "bg-emerald-500/5",
      border: "border-border/80",
      iconBg: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
      iconText: "text-emerald-600 dark:text-emerald-400",
      hoverBorder: "hover:border-emerald-500/45",
      badgeBg:
        "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20",
      accentGlow: "from-emerald-500 via-teal-400/50 to-transparent",
      dotColor: "bg-emerald-500",
    },
    subSections: [
      {
        title: "التعريفات",
        to: "/admin/park",
        search: { tab: "definitions" },
        icon: Settings,
        permissionKeys: [
          "page_park",
          "page_park_prices",
          "page_park_customers",
          "page_park_treasury",
          "manage_park_shifts",
          "mall_garden_finance",
        ],
      },
      {
        title: "العمليات",
        to: "/admin/park",
        search: { tab: "operations" },
        icon: Store,
        permissionKeys: [
          "page_park",
          "page_park_pos",
          "page_park_shifts",
          "manage_park_shifts",
          "park_open_shift",
          "park_returns",
        ],
      },
      {
        title: "التقارير",
        to: "/admin/park",
        search: { tab: "reports" },
        icon: FileBarChart,
        permissionKeys: ["page_park", "park_reports", "manage_park_shifts", "mall_garden_finance"],
      },
    ],
  },
  {
    id: "finance",
    code: "MOD-04",
    title: "الإدارة المالية",
    to: "/admin/ledger",
    icon: Landmark,
    permissionKeys: [
      "page_finance",
      "accounting",
      "accounting_view",
      "accounting_post_journal",
      "treasury",
      "treasury_view",
      "reports",
      "reports_view_financials",
    ],
    colorScheme: {
      bgLight: "bg-indigo-500/5",
      border: "border-border/80",
      iconBg: "bg-indigo-500/12 text-indigo-600 dark:text-indigo-400 border-indigo-500/25",
      iconText: "text-indigo-600 dark:text-indigo-400",
      hoverBorder: "hover:border-indigo-500/45",
      badgeBg: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20",
      accentGlow: "from-indigo-500 via-indigo-400/50 to-transparent",
      dotColor: "bg-indigo-500",
    },
    subSections: [
      {
        title: "التعريفات",
        to: "/admin/ledger",
        search: { tab: "definitions" },
        icon: Settings,
        permissionKeys: ["page_finance", "page_finance_accounts", "page_finance_treasury", "accounting", "treasury"],
      },
      {
        title: "العمليات",
        to: "/admin/ledger",
        search: { tab: "operations" },
        icon: Receipt,
        permissionKeys: [
          "page_finance",
          "page_finance_vouchers",
          "page_finance_journal",
          "accounting",
          "treasury",
          "expense_approval",
          "revenue_approval",
        ],
      },
      {
        title: "التقارير",
        to: "/admin/ledger",
        search: { tab: "reports" },
        icon: FileBarChart,
        permissionKeys: [
          "page_finance",
          "page_finance_reports",
          "page_finance_position",
          "page_finance_ledger",
          "page_finance_trial",
          "reports",
          "reports_view_financials",
          "accounting",
        ],
      },
    ],
  },
  {
    id: "hr",
    code: "MOD-05",
    title: "الموارد البشرية والمستخدمين",
    to: "/admin/hr",
    icon: UserCheck,
    permissionKeys: [
      "page_hr",
      "hr",
      "hr_view_attendance",
      "hr_manage_payroll_loans",
      "users_roles",
      "system_manage_users",
    ],
    colorScheme: {
      bgLight: "bg-rose-500/5",
      border: "border-border/80",
      iconBg: "bg-rose-500/12 text-rose-600 dark:text-rose-400 border-rose-500/25",
      iconText: "text-rose-600 dark:text-rose-400",
      hoverBorder: "hover:border-rose-500/45",
      badgeBg: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20",
      accentGlow: "from-rose-500 via-rose-400/50 to-transparent",
      dotColor: "bg-rose-500",
    },
    subSections: [
      {
        title: "التعريفات",
        to: "/admin/hr",
        search: { tab: "definitions" },
        icon: Users,
        permissionKeys: [
          "page_hr",
          "page_hr_employees",
          "page_hr_users",
          "hr",
          "users_roles",
          "system_manage_users",
        ],
      },
      {
        title: "العمليات",
        to: "/admin/hr",
        search: { tab: "operations" },
        icon: CalendarDays,
        permissionKeys: [
          "page_hr",
          "page_hr_attendance",
          "page_hr_payroll",
          "page_hr_loans",
          "hr",
          "hr_view_attendance",
          "hr_manage_payroll_loans",
        ],
      },
      {
        title: "التقارير",
        to: "/admin/hr",
        search: { tab: "reports" },
        icon: FileBarChart,
        permissionKeys: [
          "page_hr",
          "hr",
          "hr_view_attendance",
          "hr_manage_payroll_loans",
          "reports",
        ],
      },
    ],
  },
  {
    id: "inventory",
    code: "MOD-06",
    title: "إدارة المخزون والمستودعات",
    to: "/admin/inventory",
    icon: Package,
    permissionKeys: [
      "page_inventory",
      "inventory",
      "inventory_view",
      "inventory_adjust_transfer",
      "inventory_waste_dispose",
      "purchasing",
      "purchasing_view",
      "purchasing_add_invoice",
      "purchasing_returns",
    ],
    colorScheme: {
      bgLight: "bg-sky-500/5",
      border: "border-border/80",
      iconBg: "bg-sky-500/12 text-sky-600 dark:text-sky-400 border-sky-500/25",
      iconText: "text-sky-600 dark:text-sky-400",
      hoverBorder: "hover:border-sky-500/45",
      badgeBg: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20",
      accentGlow: "from-sky-500 via-sky-400/50 to-transparent",
      dotColor: "bg-sky-500",
    },
    subSections: [
      {
        title: "التعريفات",
        to: "/admin/inventory",
        search: { tab: "definitions" },
        icon: Package,
        permissionKeys: [
          "page_inventory",
          "page_inventory_items",
          "page_inventory_suppliers",
          "inventory",
          "inventory_view",
          "purchasing",
        ],
      },
      {
        title: "العمليات",
        to: "/admin/inventory",
        search: { tab: "operations" },
        icon: ArrowLeftRight,
        permissionKeys: [
          "page_inventory",
          "page_inventory_transfers",
          "page_inventory_purchases",
          "page_inventory_waste",
          "inventory",
          "inventory_adjust_transfer",
          "purchasing",
        ],
      },
      {
        title: "التقارير",
        to: "/admin/inventory",
        search: { tab: "reports" },
        icon: FileBarChart,
        permissionKeys: ["page_inventory", "inventory", "inventory_view", "reports"],
      },
    ],
  },
  {
    id: "shift_audit",
    code: "MOD-07",
    title: "تدقيق الورديات وسجل العمليات",
    to: "/admin",
    search: { tab: "shift_audit" },
    icon: ShieldCheck,
    permissionKeys: [
      "page_shift_audit",
      "page_audit_logs",
      "treasury",
      "treasury_view",
      "treasury_open_close",
      "accounting",
      "accounting_view",
      "reports",
      "manage_park_shifts",
      "audit_logs",
      "system_audit_logs",
      "super_admin_full_access",
    ],
    colorScheme: {
      bgLight: "bg-teal-500/5",
      border: "border-border/80",
      iconBg: "bg-teal-500/12 text-teal-600 dark:text-teal-400 border-teal-500/25",
      iconText: "text-teal-600 dark:text-teal-400",
      hoverBorder: "hover:border-teal-500/45",
      badgeBg: "bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20",
      accentGlow: "from-teal-500 via-teal-400/50 to-transparent",
      dotColor: "bg-teal-500",
    },
    subSections: [
      {
        title: "التعريفات",
        to: "/admin",
        search: { tab: "shift_audit", section: "definitions" },
        icon: Settings,
        permissionKeys: [
          "page_shift_audit",
          "page_audit_logs",
          "treasury",
          "accounting",
          "audit_logs",
        ],
      },
      {
        title: "العمليات",
        to: "/admin",
        search: { tab: "shift_audit", section: "operations" },
        icon: History,
        permissionKeys: [
          "page_shift_audit",
          "page_shift_audit_matching",
          "page_audit_logs",
          "treasury_transfer_reconcile",
          "treasury",
          "accounting",
          "audit_logs",
          "system_audit_logs",
        ],
      },
      {
        title: "التقارير",
        to: "/admin",
        search: { tab: "shift_audit", section: "reports" },
        icon: FileBarChart,
        permissionKeys: [
          "page_shift_audit",
          "page_shift_audit_variance",
          "page_audit_logs",
          "treasury",
          "accounting",
          "audit_logs",
          "reports",
        ],
      },
    ],
  },
  {
    id: "system",
    code: "MOD-08",
    title: "خيارات المطور والنسخ الاحتياطي",
    to: "/admin/system-update",
    icon: Settings,
    permissionKeys: [
      "page_developer",
      "system_backup_update",
      "developer_options",
      "super_admin_full_access",
    ],
    colorScheme: {
      bgLight: "bg-slate-500/5",
      border: "border-border/80",
      iconBg: "bg-slate-500/12 text-slate-700 dark:text-slate-300 border-slate-500/25",
      iconText: "text-slate-700 dark:text-slate-300",
      hoverBorder: "hover:border-slate-500/45",
      badgeBg: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20",
      accentGlow: "from-slate-500 via-slate-400/50 to-transparent",
      dotColor: "bg-slate-500",
    },
    subSections: [
      {
        title: "التعريفات",
        to: "/admin/system-update",
        search: { tab: "definitions" },
        icon: Database,
        permissionKeys: [
          "page_developer",
          "system_backup_update",
          "developer_options",
          "super_admin_full_access",
        ],
      },
      {
        title: "العمليات",
        to: "/admin/system-update",
        search: { tab: "operations" },
        icon: RefreshCw,
        permissionKeys: [
          "page_developer",
          "page_system_github",
          "system_backup_update",
          "developer_options",
          "super_admin_full_access",
        ],
      },
      {
        title: "التقارير",
        to: "/admin/system-update",
        search: { tab: "reports" },
        icon: FileBarChart,
        permissionKeys: [
          "page_developer",
          "page_system_status",
          "system_backup_update",
          "developer_options",
          "super_admin_full_access",
        ],
      },
    ],
  },
];

export function DepartmentsGridHub({
  userPermissions: propPermissions,
}: {
  userPermissions?: Record<string, boolean>;
} = {}) {
  const navigate = useNavigate();
  const { lang } = useSettings();
  const isEn = lang === "en";
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useViewMode("admin-hub", "grid");
  const [activePermissions, setActivePermissions] = useState<Record<string, boolean>>(() =>
    propPermissions && Object.keys(propPermissions).length > 0
      ? propPermissions
      : getActiveUserPermissionsSync(),
  );

  useEffect(() => {
    if (propPermissions && Object.keys(propPermissions).length > 0) {
      setActivePermissions(propPermissions);
      return;
    }
    const refresh = () => {
      setActivePermissions(getActiveUserPermissionsSync());
    };
    refresh();
    const unsub = erpStore.subscribe(refresh);
    window.addEventListener(PERMISSIONS_UPDATED_EVENT, refresh);
    return () => {
      unsub();
      window.removeEventListener(PERMISSIONS_UPDATED_EVENT, refresh);
    };
  }, [propPermissions]);

  const visibleDepartments = useMemo(() => {
    const permitted = DEPARTMENTS.map((dept) => {
      if (!isDepartmentPermitted(activePermissions, dept)) {
        return null;
      }

      const allowedSubSections = dept.subSections.filter((sub) =>
        isDepartmentPermitted(activePermissions, sub),
      );
      const hasDeptAccess =
        allowedSubSections.length > 0 || isDepartmentPermitted(activePermissions, dept);
      return {
        ...dept,
        subSections: allowedSubSections,
        hasDeptAccess,
      };
    }).filter(
      (dept): dept is NonNullable<typeof dept> =>
        !!dept && dept.hasDeptAccess && dept.subSections.length > 0,
    );

    if (!searchQuery.trim()) return permitted;
    const q = searchQuery.trim().toLowerCase();
    return permitted.filter(
      (dept) =>
        dept.title.toLowerCase().includes(q) ||
        dept.subSections.some((s) => s.title.toLowerCase().includes(q)),
    );
  }, [activePermissions, searchQuery]);

  const ActionArrow = isEn ? ArrowRight : ArrowLeft;

  return (
    <div
      className="space-y-6 pt-4"
      dir={isEn ? "ltr" : "rtl"}
      data-studio-id="admin-departments-hub-root"
    >
      {/* Executive Workspace Command Header */}
      <div
        data-studio-id="admin-welcome-banner"
        className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Layers size={20} />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-foreground">
              لوحة الأقسام الرئيسية
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="relative min-w-[220px] sm:min-w-[270px] flex-1 sm:flex-initial">
              <Search
                size={16}
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none",
                  isEn ? "left-3.5" : "right-3.5",
                )}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث سريع..."
                className={cn(
                  "w-full h-10 rounded-xl border border-border bg-muted/50 focus:bg-background text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
                  isEn ? "pl-10 pr-9" : "pr-10 pl-9",
                )}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer",
                    isEn ? "right-3" : "left-3",
                  )}
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <ViewModeToggle mode={viewMode} onChange={setViewMode} />
          </div>
        </div>
      </div>

      {/* Department Cards — Grid or List View */}
      {viewMode === "grid" ? (
        <div
          data-studio-id="admin-departments-grid"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {visibleDepartments.map((dept) => {
            const Icon = dept.icon;
            const previewSubs = dept.subSections.slice(0, 4);
            return (
              <Card
                key={dept.id}
                data-studio-id={`admin-department-card-${dept.id}`}
                onClick={() => navigate({ to: dept.to, search: dept.search })}
                className={cn(
                  "group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-card p-5 transition-all duration-200 cursor-pointer hover:-translate-y-1 hover:shadow-xl",
                  dept.colorScheme.border,
                  dept.colorScheme.hoverBorder,
                )}
              >
                <div
                  className={cn(
                    "absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-l opacity-85 group-hover:opacity-100 transition-opacity",
                    dept.colorScheme.accentGlow,
                  )}
                />

                <div>
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-transform duration-200 group-hover:scale-105",
                          dept.colorScheme.iconBg,
                        )}
                      >
                        <Icon size={23} strokeWidth={2.2} />
                      </div>
                      <h3 className="text-lg font-extrabold text-foreground group-hover:text-primary transition-colors truncate">
                        {dept.title}
                      </h3>
                    </div>
                  </div>

                  <div
                    className="mt-4 pt-4 border-t border-border/70 grid grid-cols-1 sm:grid-cols-3 gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {previewSubs.map((sub) => {
                      const SubIcon = sub.icon;
                      return (
                        <button
                          key={sub.title}
                          type="button"
                          onClick={() => navigate({ to: sub.to, search: sub.search })}
                          className="flex items-center gap-2 h-9 px-3 rounded-xl text-xs font-bold bg-muted/50 hover:bg-primary/12 hover:text-primary text-foreground border border-border/60 hover:border-primary/35 transition-colors cursor-pointer w-full min-w-0"
                        >
                          <SubIcon size={14} className="text-primary shrink-0" />
                          <span className="truncate">{sub.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border/70 flex items-center justify-end text-xs sm:text-sm font-bold">
                  <span className="inline-flex items-center gap-1.5 text-primary font-extrabold group-hover:gap-2 transition-all">
                    <span>فتح القسم</span>
                    <ActionArrow size={16} />
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div data-studio-id="admin-departments-list" className="space-y-3">
          {visibleDepartments.map((dept) => {
            const Icon = dept.icon;
            return (
              <Card
                key={dept.id}
                data-studio-id={`admin-department-row-${dept.id}`}
                onClick={() => navigate({ to: dept.to, search: dept.search })}
                className={cn(
                  "group flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border bg-card p-4 transition-all duration-150 cursor-pointer hover:shadow-md",
                  dept.colorScheme.border,
                  dept.colorScheme.hoverBorder,
                )}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border",
                      dept.colorScheme.iconBg,
                    )}
                  >
                    <Icon size={20} strokeWidth={2.2} />
                  </div>
                  <h3 className="text-base font-extrabold text-foreground group-hover:text-primary transition-colors truncate">
                    {dept.title}
                  </h3>
                </div>

                <div
                  className="flex flex-wrap items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  {dept.subSections.map((sub) => {
                    const SubIcon = sub.icon;
                    return (
                      <button
                        key={sub.title}
                        type="button"
                        onClick={() => navigate({ to: sub.to, search: sub.search })}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-bold bg-muted/60 hover:bg-primary/12 hover:text-primary text-foreground border border-border/60 hover:border-primary/35 transition-colors cursor-pointer"
                      >
                        <SubIcon size={13} className="text-primary shrink-0" />
                        <span>{sub.title}</span>
                      </button>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {visibleDepartments.length === 0 && (
        <Card className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 mb-4">
            <ShieldCheck size={28} />
          </div>
          <h3 className="text-lg font-black text-foreground">لم يتم تفعيل أقسام لهذا الحساب بعد</h3>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Button
              variant="default"
              size="sm"
              onClick={() => navigate({ to: "/login" })}
              className="rounded-xl font-bold text-xs px-4"
            >
              تبديل الحساب / تسجيل الدخول
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
