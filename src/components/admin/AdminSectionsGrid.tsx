// @ts-nocheck
import React, { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  UtensilsCrossed,
  Trees,
  Building2,
  Landmark,
  UserCheck,
  Package,
  Settings,
  ChevronDown,
  ArrowUpRight,
  CreditCard,
  Users,
  Flame,
  ClipboardList,
  Coffee,
  Clock,
  DollarSign,
  Ticket,
  TrendingUp,
  Store,
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
  LayoutGrid,
  Sparkles,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { hasAnyRequestedPermission } from "@/shared/services/userAuthorization";

export interface SectionItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ElementType;
  to: string;
  search?: Record<string, string>;
  colorTheme: {
    bgLight: string;
    border: string;
    badgeBg: string;
    badgeText: string;
    iconBg: string;
    iconColor: string;
    accentHover: string;
  };
  permissionKeys: string[];
  subsections: {
    title: string;
    description?: string;
    icon: React.ElementType;
    to: string;
    search?: Record<string, string>;
    permissionKeys?: string[];
  }[];
}

export const ADMIN_SECTIONS: SectionItem[] = [
  {
    id: "restaurant",
    title: "إدارة المطعم (البرنامج الشامل)",
    subtitle: "المطعم ونقاط البيع",
    description:
      "إدارة الصالة، الطاولات، نقاط البيع والكاشير، شاشة الكابتن، المطبخ والفرن، والورديات اليومية.",
    icon: UtensilsCrossed,
    to: "/admin/restaurant",
    colorTheme: {
      bgLight: "bg-amber-500/5 hover:bg-amber-500/10",
      border: "border-amber-500/20 hover:border-amber-500/50",
      badgeBg: "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20",
      badgeText: "text-amber-700 dark:text-amber-300",
      iconBg: "bg-amber-500 text-white",
      iconColor: "text-amber-600",
      accentHover: "hover:text-amber-600",
    },
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
    subsections: [
      {
        title: "نقاط البيع والكاشير (POS)",
        description: "شاشة إصدار الفواتير وتحصيل الطلبات",
        icon: CreditCard,
        to: "/pos",
        permissionKeys: ["pos", "pos_access", "orders"],
      },
      {
        title: "شاشة الكابتن والطاولات",
        description: "فتح الطاولات وإرسال طلبات الصالة",
        icon: Users,
        to: "/captain",
        permissionKeys: ["captain", "captain_access"],
      },
      {
        title: "شاشة المطبخ والفرن (KDS)",
        description: "عرض طلبات الطهي وتحضير الوجبات",
        icon: Flame,
        to: "/oven",
        permissionKeys: ["kitchen", "kitchen_view"],
      },
      {
        title: "سجل الطلبات والفواتير",
        description: "كشف المبيعات والطلبات المكتملة والمعلقة",
        icon: ClipboardList,
        to: "/admin/orders",
        permissionKeys: ["orders", "orders_view"],
      },
      {
        title: "قائمة الطعام والوجبات",
        description: "إدارة أسعار وتصنيفات المنيو",
        icon: Coffee,
        to: "/admin/menu",
        permissionKeys: ["page_restaurant_menu", "pos", "inventory"],
      },
      {
        title: "ورديات المطعم وتقارير الإغلاق",
        description: "فتح وإغلاق ورديات كاشير المطعم",
        icon: Clock,
        to: "/admin/restaurant",
        search: { tab: "shifts" },
        permissionKeys: ["restaurant_open_shift", "pos"],
      },
      {
        title: "مصروفات وتسويات المطعم",
        description: "مصروفات التشغيل اليومية للصالة",
        icon: DollarSign,
        to: "/admin/restaurant",
        search: { tab: "expenses" },
        permissionKeys: ["page_restaurant_vouchers", "treasury"],
      },
    ],
  },
  {
    id: "park",
    title: "إدارة الحديقة",
    subtitle: "تذاكر الدخول والمرافق",
    description:
      "إدارة تذاكر دخول الحديقة، كاشير التذاكر (POS)، ورديات الكاشير، والخزائن التشغيلية الثمانية.",
    icon: Trees,
    to: "/admin/park",
    colorTheme: {
      bgLight: "bg-teal-500/5 hover:bg-teal-500/10",
      border: "border-teal-500/20 hover:border-teal-500/50",
      badgeBg: "bg-teal-500/10 text-teal-800 dark:text-teal-300 border-teal-500/20",
      badgeText: "text-teal-700 dark:text-teal-300",
      iconBg: "bg-teal-600 text-white",
      iconColor: "text-teal-600",
      accentHover: "hover:text-teal-600",
    },
    permissionKeys: ["page_park", "manage_park_shifts", "mall_garden_finance", "park_reports", "treasury"],
    subsections: [
      {
        title: "نقطة بيع تذاكر الحديقة (POS)",
        description: "قطع تذاكر الدخول الفردية والعائلية",
        icon: Ticket,
        to: "/admin/park",
        search: { tab: "tickets" },
        permissionKeys: ["page_park_pos", "manage_park_shifts"],
      },
      {
        title: "ورديات كاشير الحديقة",
        description: "فتح وإغلاق ورديات التذاكر ومطابقة الصناديق",
        icon: Clock,
        to: "/admin/park",
        search: { tab: "shifts" },
        permissionKeys: ["page_park_shifts", "manage_park_shifts"],
      },
      {
        title: "الخزائن التشغيلية الثمانية",
        description: "أرصدة الصناديق ومتابعة العملات الأجنبية",
        icon: Landmark,
        to: "/admin/park",
        search: { tab: "treasury" },
        permissionKeys: ["page_park_treasury", "manage_park_shifts"],
      },
      {
        title: "أسعار وتصنيفات التذاكر",
        description: "ضبط أسعار الدخول والألعاب والمرافق",
        icon: Settings,
        to: "/admin/park",
        search: { tab: "prices" },
        permissionKeys: ["page_park_prices", "manage_park_shifts"],
      },
      {
        title: "دليل عملاء الحديقة",
        description: "سجلات العملاء والاشتراكات العائلية",
        icon: Users,
        to: "/admin/park",
        search: { tab: "customers" },
        permissionKeys: ["page_park_customers", "manage_park_shifts"],
      },
      {
        title: "تقارير مبيعات وإيرادات الحديقة",
        description: "كشوفات الإيرادات اليومية وتصدير Excel",
        icon: TrendingUp,
        to: "/admin/park",
        search: { tab: "reports" },
        permissionKeys: ["park_reports", "manage_park_shifts"],
      },
    ],
  },
  {
    id: "mall",
    title: "إدارة المول",
    subtitle: "المحلات وعقود الإيجار",
    description:
      "إدارة المحلات والمستأجرين، عقود الإيجار، مقبوضات وسندات الإيجارات، ومصروفات تشغيل المول.",
    icon: Building2,
    to: "/admin/mall",
    colorTheme: {
      bgLight: "bg-sky-500/5 hover:bg-sky-500/10",
      border: "border-sky-500/20 hover:border-sky-500/50",
      badgeBg: "bg-sky-500/10 text-sky-800 dark:text-sky-300 border-sky-500/20",
      badgeText: "text-sky-700 dark:text-sky-300",
      iconBg: "bg-sky-600 text-white",
      iconColor: "text-sky-600",
      accentHover: "hover:text-sky-600",
    },
    permissionKeys: ["page_mall", "mall_manage_shops", "accounting", "treasury"],
    subsections: [
      {
        title: "قائمة المحلات والمستأجرين",
        description: "دليل المتاجر والمساحات وأرقام الحسابات",
        icon: Store,
        to: "/admin/mall",
        search: { tab: "shops" },
        permissionKeys: ["page_mall_shops", "mall_manage_shops"],
      },
      {
        title: "متابعة عقود الإيجار والدفعات",
        description: "الأقساط الشهرية وتواريخ الاستحقاق",
        icon: Calendar,
        to: "/admin/mall",
        search: { tab: "payments" },
        permissionKeys: ["page_mall_payments", "mall_manage_shops"],
      },
      {
        title: "مصروفات وتشغيل المول",
        description: "مصروفات الصيانة والنظافة والكهرباء",
        icon: CreditCard,
        to: "/admin/mall",
        search: { tab: "expenses" },
        permissionKeys: ["page_mall_expenses", "mall_manage_shops"],
      },
      {
        title: "التقارير المالية وإشغال المول",
        description: "معدلات الإشغال والإيرادات السنوية",
        icon: TrendingUp,
        to: "/admin/mall",
        search: { tab: "reports" },
        permissionKeys: ["page_mall_reports", "mall_manage_shops", "reports"],
      },
    ],
  },
  {
    id: "ledger",
    title: "الإدارة المالية",
    subtitle: "الحسابات والخزائن والتقارير",
    description:
      "حساب الأستاذ العام، دفتر اليومية، سندات الصرف والقبض، دليل الحسابات، إدارة الخزائن، والتقارير المالية.",
    icon: Landmark,
    to: "/admin/ledger",
    colorTheme: {
      bgLight: "bg-indigo-500/5 hover:bg-indigo-500/10",
      border: "border-indigo-500/20 hover:border-indigo-500/50",
      badgeBg: "bg-indigo-500/10 text-indigo-800 dark:text-indigo-300 border-indigo-500/20",
      badgeText: "text-indigo-700 dark:text-indigo-300",
      iconBg: "bg-indigo-600 text-white",
      iconColor: "text-indigo-600",
      accentHover: "hover:text-indigo-600",
    },
    permissionKeys: ["page_finance", "accounting", "accounting_view", "treasury", "reports"],
    subsections: [
      {
        title: "كشف حساب الأستاذ العام",
        description: "حركات الحسابات المالية والأرصدة التفصيلية",
        icon: BookOpen,
        to: "/admin/ledger",
        search: { tab: "ledger" },
        permissionKeys: ["page_finance_ledger", "accounting_view"],
      },
      {
        title: "دفتر اليومية العامة",
        description: "سجل القيود المزدوجة اليومية والترحيل",
        icon: FileText,
        to: "/admin/ledger",
        search: { tab: "journal" },
        permissionKeys: ["page_finance_journal", "accounting"],
      },
      {
        title: "سندات الصرف والقبض",
        description: "إصدار وتوثيق سندات الإيراد والمصروف",
        icon: DollarSign,
        to: "/admin/ledger",
        search: { tab: "vouchers" },
        permissionKeys: ["page_finance_vouchers", "accounting", "treasury"],
      },
      {
        title: "دليل وشجرة الحسابات",
        description: "إدارة وتصنيف الحسابات الخمسة في الدليل",
        icon: Layers,
        to: "/admin/ledger",
        search: { tab: "accounts" },
        permissionKeys: ["page_finance_accounts", "accounting"],
      },
      {
        title: "إدارة الخزائن والصناديق",
        description: "فتح وإغلاق الخزائن والمناقلات النقدية",
        icon: Wallet,
        to: "/admin/ledger",
        search: { tab: "treasury" },
        permissionKeys: ["page_finance_treasury", "treasury"],
      },
      {
        title: "التقارير والقوائم المالية",
        description: "الأرباح والخسائر والتدفقات النقدية",
        icon: BarChart3,
        to: "/admin/ledger",
        search: { tab: "reports" },
        permissionKeys: ["page_finance_reports", "reports"],
      },
      {
        title: "ميزان المراجعة",
        description: "ميزان المراجعة بالأرصدة والمجاميع",
        icon: Scale,
        to: "/admin/ledger",
        search: { tab: "trial" },
        permissionKeys: ["page_finance_trial", "accounting"],
      },
      {
        title: "تصميم وإدارة الإيصالات",
        description: "تنسيق وطباعة قوالب السندات الرسمية",
        icon: Receipt,
        to: "/admin/receipts",
        permissionKeys: ["page_finance_receipts", "accounting"],
      },
    ],
  },
  {
    id: "hr",
    title: "إدارة الموارد البشرية",
    subtitle: "الموظفين والمستخدمين والصلاحيات",
    description:
      "إدارة الكادر الوظيفي، حسابات المستخدمين والصلاحيات (ACL)، الحضور والانصراف، والرواتب والسلف.",
    icon: UserCheck,
    to: "/admin/hr",
    colorTheme: {
      bgLight: "bg-rose-500/5 hover:bg-rose-500/10",
      border: "border-rose-500/20 hover:border-rose-500/50",
      badgeBg: "bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-500/20",
      badgeText: "text-rose-700 dark:text-rose-300",
      iconBg: "bg-rose-600 text-white",
      iconColor: "text-rose-600",
      accentHover: "hover:text-rose-600",
    },
    permissionKeys: [
      "page_hr",
      "hr",
      "hr_view_attendance",
      "hr_manage_payroll_loans",
      "users_roles",
      "system_manage_users",
    ],
    subsections: [
      {
        title: "دليل الكادر والموظفين",
        description: "سجلات الموظفين والبيانات الوظيفية",
        icon: Users,
        to: "/admin/hr",
        search: { tab: "employees" },
        permissionKeys: ["page_hr_employees", "hr"],
      },
      {
        title: "المستخدمين والصلاحيات (ACL)",
        description: "إدارة الحسابات، كلمات المرور، وجدول الصلاحيات",
        icon: ShieldCheck,
        to: "/admin/hr",
        search: { tab: "users" },
        permissionKeys: ["users_roles", "system_manage_users"],
      },
      {
        title: "حضور وانصراف اليوم",
        description: "تسجيل الدوام وساعات العمل الإضافية",
        icon: CalendarDays,
        to: "/admin/hr",
        search: { tab: "attendance" },
        permissionKeys: ["page_hr_attendance", "hr_view_attendance"],
      },
      {
        title: "مسيرات الأجور والرواتب",
        description: "احتساب الرواتب الشهرية والخصومات والبدلات",
        icon: FileSpreadsheet,
        to: "/admin/hr",
        search: { tab: "payroll" },
        permissionKeys: ["page_hr_payroll", "hr_manage_payroll_loans"],
      },
      {
        title: "القروض والسلف المالية",
        description: "سجلات السلف وسدادها على الأقساط",
        icon: Coins,
        to: "/admin/hr",
        search: { tab: "loans" },
        permissionKeys: ["page_hr_loans", "hr_manage_payroll_loans"],
      },
    ],
  },
  {
    id: "inventory",
    title: "إدارة المخزون والمستودعات",
    subtitle: "المستودعات والمشتريات والموردين",
    description:
      "إدارة الأصناف، حركات التحويل الداخلي، فواتير المشتريات، الموردين، ومحاضر الجرد والهالك.",
    icon: Package,
    to: "/admin/inventory",
    colorTheme: {
      bgLight: "bg-cyan-500/5 hover:bg-cyan-500/10",
      border: "border-cyan-500/20 hover:border-cyan-500/50",
      badgeBg: "bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 border-cyan-500/20",
      badgeText: "text-cyan-700 dark:text-cyan-300",
      iconBg: "bg-cyan-600 text-white",
      iconColor: "text-cyan-600",
      accentHover: "hover:text-cyan-600",
    },
    permissionKeys: ["page_inventory", "inventory", "inventory_view", "purchasing", "purchasing_view"],
    subsections: [
      {
        title: "الأصناف والمواد الخام",
        description: "دليل الأصناف والمستويات والحد الأدنى للمخزون",
        icon: Package,
        to: "/admin/inventory",
        search: { tab: "items" },
        permissionKeys: ["page_inventory_items", "inventory"],
      },
      {
        title: "المستودعات وحركات التحويل",
        description: "التحويل بين المستودعات المركزية والفرعية",
        icon: ArrowLeftRight,
        to: "/admin/inventory",
        search: { tab: "transfers" },
        permissionKeys: ["page_inventory_transfers", "inventory"],
      },
      {
        title: "فواتير المشتريات والموردين",
        description: "إدخال فواتير الشراء وأرصدة الموردين",
        icon: ShoppingCart,
        to: "/admin/inventory",
        search: { tab: "purchases" },
        permissionKeys: ["page_inventory_purchases", "purchasing"],
      },
      {
        title: "محاضر الهالك والتسويات",
        description: "تسجيل المواد التالفة وإجراء التسويات الجردية",
        icon: AlertCircle,
        to: "/admin/inventory",
        search: { tab: "waste" },
        permissionKeys: ["page_inventory_waste", "inventory"],
      },
    ],
  },
  {
    id: "system-update",
    title: "خيارات النظام والمطور",
    subtitle: "المزامنة والرقابة والتدقيق",
    description: "مزامنة GitHub، حالة النظام، النسخ الاحتياطي، وسجل تدقيق العمليات الرقابية.",
    icon: Settings,
    to: "/admin/system-update",
    colorTheme: {
      bgLight: "bg-slate-500/5 hover:bg-slate-500/10",
      border: "border-slate-500/20 hover:border-slate-500/50",
      badgeBg: "bg-slate-500/10 text-slate-800 dark:text-slate-300 border-slate-500/20",
      badgeText: "text-slate-700 dark:text-slate-300",
      iconBg: "bg-slate-700 text-white",
      iconColor: "text-slate-700",
      accentHover: "hover:text-slate-700",
    },
    permissionKeys: ["page_developer", "system_backup_update", "developer_options", "super_admin_full_access"],
    subsections: [
      {
        title: "استوديو المطور Pro (المحرر البصري)",
        description: "محرر بصري متقدم لتصميم الواجهات وإدارة المسودات والنشر الآمن",
        icon: Sparkles,
        to: "/admin/studio",
        permissionKeys: ["developer_options", "super_admin_full_access"],
      },
      {
        title: "تحديثات ومزامنة GitHub",
        description: "رفع التعديلات واستلام التحديثات البرمجية",
        icon: RefreshCw,
        to: "/admin/system-update",
        permissionKeys: ["page_system_github", "system_backup_update"],
      },
      {
        title: "سجل تدقيق ورقابة العمليات",
        description: "كشف تاريخ حركات الموظفين والعمليات الحساسة",
        icon: History,
        to: "/admin/system-update",
        search: { tab: "audit" },
        permissionKeys: ["page_audit_logs", "audit_logs"],
      },
      {
        title: "معلومات وحالة الخادم",
        description: "بيانات بيئة التشغيل والإصدار الحالي",
        icon: ShieldCheck,
        to: "/admin/system-update",
        permissionKeys: ["page_system_status", "system_backup_update"],
      },
    ],
  },
];

interface AdminSectionsGridProps {
  userPermissions?: Record<string, boolean>;
}

export function AdminSectionsGrid({ userPermissions = {} }: AdminSectionsGridProps) {
  const navigate = useNavigate();

  const hasAccess = (permissionKeys: string[]) => {
    return hasAnyRequestedPermission(userPermissions, permissionKeys);
  };

  const handleOpenSection = (section: SectionItem) => {
    navigate({ to: section.to, search: section.search });
  };

  const handleOpenSubsection = (sub: SectionItem["subsections"][0]) => {
    navigate({ to: sub.to, search: sub.search });
  };

  const permittedSections = ADMIN_SECTIONS.map((section) => {
    const mainKey = section.permissionKeys[0];
    if (userPermissions.super_admin_full_access !== true && userPermissions[mainKey] === false) {
      return null;
    }
    const filteredSubs = section.subsections.filter((sub) =>
      hasAnyRequestedPermission(userPermissions, sub.permissionKeys || section.permissionKeys),
    );
    const hasSecAccess =
      filteredSubs.length > 0 || hasAnyRequestedPermission(userPermissions, section.permissionKeys);
    if (!hasSecAccess || filteredSubs.length === 0) return null;
    return {
      ...section,
      subsections: filteredSubs,
    };
  }).filter((s): s is NonNullable<typeof s> => !!s);

  return (
    <div className="space-y-6">
      {/* Title & Introduction */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2">
            <LayoutGrid className="text-primary" size={24} />
            <span>لوحة الأقسام والمنظومة الرئيسية</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            اختر القسم المطلوب للدخول إليه مباشرة، أو اضغط على قائمة الأقسام الفرعية للانتقال الفوري
            إلى أي عنوان فرعي.
          </p>
        </div>
        <Badge
          variant="outline"
          className="self-start sm:self-auto font-mono text-xs px-3 py-1 bg-muted/40"
        >
          {permittedSections.length} أقسام رئيسية
        </Badge>
      </div>

      {/* Grid of Section Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-5">
        {permittedSections.map((section) => {
          const Icon = section.icon;

          return (
            <div
              key={section.id}
              onClick={() => handleOpenSection(section)}
              className={`group relative rounded-3xl border ${section.colorTheme.border} ${section.colorTheme.bgLight} p-5 sm:p-6 transition-all duration-200 hover:shadow-lg cursor-pointer flex flex-col justify-between overflow-hidden bg-card`}
            >
              <div className="space-y-4">
                {/* Top Row: Icon + Badge + Dropdown Trigger */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-2xl ${section.colorTheme.iconBg} flex items-center justify-center shadow-md transition-transform group-hover:scale-105 shrink-0`}
                    >
                      <Icon size={24} />
                    </div>
                    <div>
                      <span
                        className={`text-[11px] font-bold ${section.colorTheme.badgeText} block`}
                      >
                        {section.subtitle}
                      </span>
                      <h3 className="text-base sm:text-lg font-black text-foreground leading-tight mt-0.5 group-hover:text-primary transition-colors">
                        {section.title}
                      </h3>
                    </div>
                  </div>

                  {/* SUBSECTIONS DROPDOWN TRIGGER (مطلوب بالشرط رقم 2) */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5 rounded-xl text-xs font-bold gap-1 border-border bg-card/90 hover:bg-accent shrink-0 shadow-xs"
                          title="عرض الأقسام والعناوين الفرعية"
                        >
                          <span className="hidden sm:inline text-[11px]">الأقسام الفرعية</span>
                          <ChevronDown size={14} className="opacity-70" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-64 p-1.5 rounded-2xl shadow-xl border-border"
                      >
                        <DropdownMenuLabel className="text-xs font-black px-2.5 py-1.5 text-muted-foreground">
                          عناوين وأقسام {section.title}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {section.subsections.map((sub, idx) => {
                          const SubIcon = sub.icon;
                          return (
                            <DropdownMenuItem
                              key={idx}
                              onClick={() => handleOpenSubsection(sub)}
                              className="flex items-center gap-2.5 p-2 rounded-xl cursor-pointer text-xs font-semibold hover:bg-muted focus:bg-muted"
                            >
                              <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0 text-foreground">
                                <SubIcon size={14} />
                              </div>
                              <div className="flex-1 min-w-0 text-right">
                                <p className="font-bold text-foreground truncate">{sub.title}</p>
                                {sub.description && (
                                  <p className="text-[10px] text-muted-foreground truncate">
                                    {sub.description}
                                  </p>
                                )}
                              </div>
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                  {section.description}
                </p>

                {/* Quick Chips preview of top sub-items */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {section.subsections.slice(0, 3).map((sub, i) => (
                    <span
                      key={i}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenSubsection(sub);
                      }}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border/40"
                    >
                      {sub.title}
                    </span>
                  ))}
                  {section.subsections.length > 3 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg text-muted-foreground/70">
                      +{section.subsections.length - 3} أخرى
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom Row Action */}
              <div className="pt-4 mt-4 border-t border-border/50 flex items-center justify-between">
                <span className="text-xs font-bold text-primary flex items-center gap-1 group-hover:underline">
                  <span>فتح القسم</span>
                  <ArrowUpRight
                    size={14}
                    className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </span>
                <span className="text-[11px] font-bold text-muted-foreground">
                  {section.subsections.length} شاشات فرعية
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default AdminSectionsGrid;
