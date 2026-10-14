// @ts-nocheck
import React from "react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  Grid3X3,
  ChevronLeft,
  ChevronDown,
  Landmark,
  Store,
  Building2,
  Trees,
  UserCheck,
  Package,
  Settings,
  Users,
  BarChart3,
  Receipt,
  ClipboardList,
  Utensils,
  Wallet,
  TrendingUp,
  BookOpen,
  FileText,
  Scale,
  Flame,
  FileBarChart,
  Layers,
  Briefcase,
  History,
  ShieldCheck,
  Ticket,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbNode {
  label: string;
  to?: string;
  search?: Record<string, string>;
  icon?: any;
}

export function resolveBreadcrumbs(pathname: string, searchStr: string): {
  isRoot: boolean;
  parentDept: BreadcrumbNode | null;
  subPage: BreadcrumbNode | null;
} {
  const searchParams = new URLSearchParams(searchStr);
  const tab = searchParams.get("tab") || "";

  // 1. Root: /admin with no sub-tab or tab=grid
  if ((pathname === "/admin" || pathname === "/admin/") && (!tab || tab === "grid")) {
    return {
      isRoot: true,
      parentDept: null,
      subPage: null,
    };
  }

  // 2. Financial Management & Ledger (/admin/ledger, /admin/accounts, /admin/receipts)
  if (pathname.startsWith("/admin/ledger")) {
    const parentDept: BreadcrumbNode = {
      label: "الإدارة المالية",
      to: "/admin/ledger",
      search: { tab: "hub" },
      icon: Landmark,
    };

    if (tab === "vouchers") {
      return { isRoot: false, parentDept, subPage: { label: "سندات الصرف والقبض", icon: Receipt } };
    }
    if (tab === "financial_position") {
      return { isRoot: false, parentDept, subPage: { label: "المركز المالي الشامل والميزانية", icon: TrendingUp } };
    }
    if (tab === "ledger") {
      return { isRoot: false, parentDept, subPage: { label: "كشف حساب الأستاذ العام", icon: BookOpen } };
    }
    if (tab === "journal") {
      return { isRoot: false, parentDept, subPage: { label: "دفتر اليومية العامة والقيود", icon: FileText } };
    }
    if (tab === "treasury") {
      return { isRoot: false, parentDept, subPage: { label: "إدارة الخزائن والحسابات البنكية", icon: Wallet } };
    }
    if (tab === "accounts") {
      return { isRoot: false, parentDept, subPage: { label: "دليل وشجرة الحسابات", icon: FileBarChart } };
    }
    if (tab === "trial") {
      return { isRoot: false, parentDept, subPage: { label: "ميزان المراجعة المحاسبي", icon: Scale } };
    }
    if (tab === "statements") {
      return { isRoot: false, parentDept, subPage: { label: "القوائم المالية والختامية", icon: Layers } };
    }
    if (tab === "reports") {
      return { isRoot: false, parentDept, subPage: { label: "التقارير والميزانية العمومية", icon: BarChart3 } };
    }
    if (tab === "cost_centers") {
      return { isRoot: false, parentDept, subPage: { label: "مراكز التكلفة المحاسبية", icon: Briefcase } };
    }

    // Default main page of ledger (hub)
    return { isRoot: false, parentDept: { ...parentDept, search: undefined }, subPage: null };
  }

  if (pathname.startsWith("/admin/accounts")) {
    return {
      isRoot: false,
      parentDept: { label: "الإدارة المالية", to: "/admin/ledger", icon: Landmark },
      subPage: { label: "دليل وشجرة الحسابات (Oracle)", icon: FileBarChart },
    };
  }

  if (pathname.startsWith("/admin/receipts")) {
    const parentDept: BreadcrumbNode = {
      label: "الإدارة المالية",
      to: "/admin/ledger",
      icon: Landmark,
    };
    if (tab === "designer") {
      return { isRoot: false, parentDept, subPage: { label: "المصمم المرئي للسندات", icon: Receipt } };
    }
    return {
      isRoot: false,
      parentDept,
      subPage: { label: "تصميم وإدارة السندات والإيصالات", icon: Receipt },
    };
  }

  // 3. /admin with legacy or direct financial tabs
  if (pathname === "/admin" || pathname === "/admin/") {
    if (tab === "vouchers_entry") {
      return {
        isRoot: false,
        parentDept: { label: "الإدارة المالية", to: "/admin/ledger", icon: Landmark },
        subPage: { label: "سندات الصرف والقبض", icon: Receipt },
      };
    }
    if (tab === "treasury") {
      return {
        isRoot: false,
        parentDept: { label: "الإدارة المالية", to: "/admin/ledger", icon: Landmark },
        subPage: { label: "إدارة الخزائن والحسابات", icon: Wallet },
      };
    }
    if (tab === "chart_of_accounts") {
      return {
        isRoot: false,
        parentDept: { label: "الإدارة المالية", to: "/admin/ledger", icon: Landmark },
        subPage: { label: "دليل وشجرة الحسابات", icon: FileBarChart },
      };
    }
    if (tab === "dashboard") {
      return {
        isRoot: false,
        parentDept: { label: "الإدارة المالية", to: "/admin/ledger", icon: Landmark },
        subPage: { label: "المركز المالي الشامل", icon: TrendingUp },
      };
    }
    if (tab === "shift_audit") {
      return {
        isRoot: false,
        parentDept: { label: "خيارات المطور والرقابة", to: "/admin/system-update", icon: Settings },
        subPage: { label: "تدقيق ومطابقة الورديات", icon: ShieldCheck },
      };
    }
    if (tab === "audit_logs") {
      return {
        isRoot: false,
        parentDept: { label: "خيارات المطور والرقابة", to: "/admin/system-update", icon: Settings },
        subPage: { label: "سجل العمليات والأنشطة", icon: History },
      };
    }
  }

  // 4. Restaurant Department (/admin/restaurant, /pos, /captain, /oven, /cashier-treasury, /admin/menu, /admin/orders)
  if (pathname.startsWith("/admin/restaurant")) {
    const parentDept: BreadcrumbNode = {
      label: "إدارة المطعم",
      to: "/admin/restaurant",
      icon: Store,
    };
    if (tab === "vouchers") {
      return { isRoot: false, parentDept, subPage: { label: "سندات إيراد ومصروف المطعم", icon: Receipt } };
    }
    if (tab === "shifts") {
      return { isRoot: false, parentDept, subPage: { label: "ورديات المطعم والكاشير", icon: Calendar } };
    }
    if (tab === "shift_audit") {
      return { isRoot: false, parentDept, subPage: { label: "تدقيق ومطابقة الورديات", icon: ShieldCheck } };
    }
    if (tab === "reports") {
      return { isRoot: false, parentDept, subPage: { label: "تقارير مبيعات المطعم", icon: BarChart3 } };
    }
    if (tab === "tables") {
      return { isRoot: false, parentDept, subPage: { label: "إدارة الصالة والطاولات", icon: Users } };
    }
    return { isRoot: false, parentDept, subPage: null };
  }

  if (pathname === "/pos") {
    return {
      isRoot: false,
      parentDept: { label: "إدارة المطعم", to: "/admin/restaurant", icon: Store },
      subPage: { label: "نقطة البيع (POS) الكاشير", icon: Store },
    };
  }

  if (pathname === "/captain") {
    return {
      isRoot: false,
      parentDept: { label: "إدارة المطعم", to: "/admin/restaurant", icon: Store },
      subPage: { label: "شاشة الكابتن أوردر للطاولات", icon: Users },
    };
  }

  if (pathname === "/oven") {
    return {
      isRoot: false,
      parentDept: { label: "إدارة المطعم", to: "/admin/restaurant", icon: Store },
      subPage: { label: "شاشة المطبخ والفرن الذكية", icon: Flame },
    };
  }

  if (pathname === "/cashier-treasury") {
    return {
      isRoot: false,
      parentDept: { label: "إدارة المطعم", to: "/admin/restaurant", icon: Store },
      subPage: { label: "تسليم وإغلاق وردية الكاشير", icon: Wallet },
    };
  }

  if (pathname.startsWith("/admin/menu")) {
    return {
      isRoot: false,
      parentDept: { label: "إدارة المطعم", to: "/admin/restaurant", icon: Store },
      subPage: { label: "قائمة الطعام والمنيو", icon: Utensils },
    };
  }

  if (pathname.startsWith("/admin/orders")) {
    return {
      isRoot: false,
      parentDept: { label: "إدارة المطعم", to: "/admin/restaurant", icon: Store },
      subPage: { label: "سجل الطلبات والمبيعات", icon: ClipboardList },
    };
  }

  // 5. Mall Management (/admin/mall)
  if (pathname.startsWith("/admin/mall")) {
    const parentDept: BreadcrumbNode = {
      label: "إدارة المول والوحدات",
      to: "/admin/mall",
      icon: Building2,
    };
    if (tab === "shops") {
      return { isRoot: false, parentDept, subPage: { label: "إدارة المحلات والوحدات", icon: Building2 } };
    }
    if (tab === "payments") {
      return { isRoot: false, parentDept, subPage: { label: "عقود الإيجار والتحصيل", icon: Receipt } };
    }
    if (tab === "expenses") {
      return { isRoot: false, parentDept, subPage: { label: "مصروفات التشغيل والصيانة", icon: Wallet } };
    }
    if (tab === "reports") {
      return { isRoot: false, parentDept, subPage: { label: "التقارير المالية وإيرادات المول", icon: BarChart3 } };
    }
    return { isRoot: false, parentDept, subPage: null };
  }

  // 6. Park & Facilities Management (/admin/park)
  if (pathname.startsWith("/admin/park")) {
    const parentDept: BreadcrumbNode = {
      label: "إدارة الحديقة والمرافق",
      to: "/admin/park",
      icon: Trees,
    };
    if (tab === "pos") {
      return { isRoot: false, parentDept, subPage: { label: "نقطة بيع تذاكر الألعاب والكاشير", icon: Ticket } };
    }
    if (tab === "shifts") {
      return { isRoot: false, parentDept, subPage: { label: "ورديات كاشير الحديقة وإغلاق الصناديق", icon: Calendar } };
    }
    if (tab === "treasury") {
      return { isRoot: false, parentDept, subPage: { label: "الخزائن التشغيلية للحديقة", icon: Wallet } };
    }
    if (tab === "customers") {
      return { isRoot: false, parentDept, subPage: { label: "إدارة العملاء واشتراكات الزوار", icon: Users } };
    }
    if (tab === "prices") {
      return { isRoot: false, parentDept, subPage: { label: "أسعار التذاكر وفئات الألعاب", icon: Settings } };
    }
    if (tab === "reports") {
      return { isRoot: false, parentDept, subPage: { label: "تقارير إيرادات الحديقة والورديات", icon: BarChart3 } };
    }
    return { isRoot: false, parentDept, subPage: null };
  }

  // 7. Human Resources (/admin/hr)
  if (pathname.startsWith("/admin/hr")) {
    const parentDept: BreadcrumbNode = {
      label: "الموارد البشرية والموظفين",
      to: "/admin/hr",
      icon: UserCheck,
    };
    if (tab === "employees") {
      return { isRoot: false, parentDept, subPage: { label: "سجل وملفات الموظفين", icon: Users } };
    }
    if (tab === "attendance") {
      return { isRoot: false, parentDept, subPage: { label: "الحضور والانصراف والدوام", icon: Calendar } };
    }
    if (tab === "payroll") {
      return { isRoot: false, parentDept, subPage: { label: "مسيرات الرواتب والمستحقات", icon: Wallet } };
    }
    if (tab === "loans") {
      return { isRoot: false, parentDept, subPage: { label: "السلف والعهد المالية", icon: Receipt } };
    }
    if (tab === "shifts") {
      return { isRoot: false, parentDept, subPage: { label: "مواعيد العمل والورديات", icon: Calendar } };
    }
    if (tab === "reports") {
      return { isRoot: false, parentDept, subPage: { label: "تقارير شؤون الموظفين", icon: BarChart3 } };
    }
    return { isRoot: false, parentDept, subPage: null };
  }

  // 8. Inventory Management (/admin/inventory)
  if (pathname.startsWith("/admin/inventory")) {
    const parentDept: BreadcrumbNode = {
      label: "إدارة المخزون والمستودعات",
      to: "/admin/inventory",
      icon: Package,
    };
    if (tab === "stock" || tab === "items") {
      return { isRoot: false, parentDept, subPage: { label: "دليل الأصناف والمنتجات", icon: Package } };
    }
    if (tab === "transactions") {
      return { isRoot: false, parentDept, subPage: { label: "حركات وأذون المخزن", icon: ClipboardList } };
    }
    if (tab === "expiry") {
      return { isRoot: false, parentDept, subPage: { label: "تواريخ الصلاحية والتحذيرات", icon: Calendar } };
    }
    if (tab === "purchases") {
      return { isRoot: false, parentDept, subPage: { label: "فواتير المشتريات والتوريد", icon: Receipt } };
    }
    if (tab === "suppliers") {
      return { isRoot: false, parentDept, subPage: { label: "سجل الموردين والحسابات", icon: Users } };
    }
    if (tab === "reports") {
      return { isRoot: false, parentDept, subPage: { label: "تقارير حركة المخزون", icon: BarChart3 } };
    }
    if (tab === "settings") {
      return { isRoot: false, parentDept, subPage: { label: "المستودعات والمخازن", icon: Settings } };
    }
    return { isRoot: false, parentDept, subPage: null };
  }

  // 9. System Updates & Security (/admin/system-update)
  if (pathname.startsWith("/admin/system-update")) {
    const parentDept: BreadcrumbNode = {
      label: "خيارات المطور والرقابة",
      to: "/admin/system-update",
      icon: Settings,
    };
    if (tab === "system" || tab === "updates") {
      return { isRoot: false, parentDept, subPage: { label: "تحديثات ومزامنة GitHub", icon: Settings } };
    }
    if (tab === "access") {
      return { isRoot: false, parentDept, subPage: { label: "حزمة أكسس وقواعد البيانات", icon: FileText } };
    }
    if (tab === "audit_logs") {
      return { isRoot: false, parentDept, subPage: { label: "سجل العمليات والرقابة الأمنية", icon: History } };
    }
    if (tab === "backup") {
      return { isRoot: false, parentDept, subPage: { label: "النسخ الاحتياطي واستعادة البيانات", icon: ShieldCheck } };
    }
    return { isRoot: false, parentDept, subPage: null };
  }

  // 10. Users & Roles (/admin/users)
  if (pathname.startsWith("/admin/users")) {
    const parentDept: BreadcrumbNode = {
      label: "المستخدمين والصلاحيات",
      to: "/admin/users",
      icon: Users,
    };
    if (tab === "users") {
      return { isRoot: false, parentDept, subPage: { label: "سجل المستخدمين والحسابات", icon: Users } };
    }
    if (tab === "roles") {
      return { isRoot: false, parentDept, subPage: { label: "الأدوار ومجموعات العمل", icon: ShieldCheck } };
    }
    if (tab === "permissions") {
      return { isRoot: false, parentDept, subPage: { label: "مصفوفة الصلاحيات والوصول", icon: Settings } };
    }
    return { isRoot: false, parentDept, subPage: null };
  }

  // 11. Reports (/admin/reports)
  if (pathname.startsWith("/admin/reports")) {
    const parentDept: BreadcrumbNode = {
      label: "التقارير والميزانية العمومية",
      to: "/admin/reports",
      icon: BarChart3,
    };
    if (tab === "sales") {
      return { isRoot: false, parentDept, subPage: { label: "تقارير المبيعات اليومية", icon: BarChart3 } };
    }
    if (tab === "pl") {
      return { isRoot: false, parentDept, subPage: { label: "قائمة الأرباح والخسائر", icon: TrendingUp } };
    }
    if (tab === "balance_sheet") {
      return { isRoot: false, parentDept, subPage: { label: "الميزانية العمومية الموحدة", icon: Scale } };
    }
    if (tab === "cashflow") {
      return { isRoot: false, parentDept, subPage: { label: "التدفقات النقدية", icon: Wallet } };
    }
    if (tab === "vouchers") {
      return { isRoot: false, parentDept, subPage: { label: "تقارير السندات المالية", icon: Receipt } };
    }
    if (tab === "ledger") {
      return { isRoot: false, parentDept, subPage: { label: "كشوفات الحسابات المجمعة", icon: BookOpen } };
    }
    return { isRoot: false, parentDept, subPage: null };
  }

  return {
    isRoot: false,
    parentDept: { label: "لوحة التحكم", to: "/admin", icon: Grid3X3 },
    subPage: null,
  };
}

export function UnifiedBreadcrumbNav() {
  const location = useLocation();
  const { isRoot, parentDept, subPage } = resolveBreadcrumbs(location.pathname, location.search);

  return (
    <nav
      aria-label="مسار التنقل"
      className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-wrap"
    >
      {/* 1. Main Departments Hub Button */}
      <Link
        to="/admin"
        search={{ tab: "grid" }}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all shadow-2xs shrink-0",
          isRoot
            ? "bg-primary text-primary-foreground shadow-xs cursor-default"
            : "bg-muted/80 text-foreground hover:bg-muted border border-border/70 hover:border-primary/40",
        )}
        title="العودة إلى لوحة الأقسام الرئيسية"
      >
        <Grid3X3 size={15} className={isRoot ? "text-primary-foreground" : "text-primary"} />
        <span>لوحة الأقسام</span>
      </Link>

      {/* 2. Parent Department (Clickable if inside a subpage) */}
      {parentDept && (
        <>
          <ChevronLeft
            size={14}
            className="text-muted-foreground/60 shrink-0 select-none rtl:rotate-0"
          />

          {subPage ? (
            <Link
              to={parentDept.to}
              search={parentDept.search}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-card border border-border/80 text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-muted/70 transition-all shrink-0 group shadow-2xs"
              title={`العودة إلى ${parentDept.label}`}
            >
              {parentDept.icon && (
                <parentDept.icon
                  size={14}
                  className="text-primary group-hover:scale-110 transition-transform shrink-0"
                />
              )}
              <span className="group-hover:text-primary transition-colors">
                {parentDept.label}
              </span>
            </Link>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-primary text-primary-foreground border border-primary shadow-xs shrink-0">
              {parentDept.icon && <parentDept.icon size={15} className="shrink-0" />}
              <span>{parentDept.label}</span>
            </div>
          )}
        </>
      )}

      {/* 3. Sub-page / Active Branch */}
      {subPage && (
        <>
          <ChevronLeft
            size={14}
            className="text-primary/70 shrink-0 select-none animate-pulse rtl:rotate-0"
          />

          <div
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-black bg-primary text-primary-foreground shadow-xs shrink-0 max-w-[260px] sm:max-w-none truncate"
            title={subPage.label}
          >
            {subPage.icon && <subPage.icon size={15} className="shrink-0" />}
            <span className="truncate">{subPage.label}</span>
          </div>
        </>
      )}
    </nav>
  );
}
