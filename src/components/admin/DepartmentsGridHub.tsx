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
  Flame,
  ClipboardList,
  Grid3X3,
  Coffee,
  History,
  Calendar,
  CreditCard,
  TrendingUp,
  Ticket,
  Plus,
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
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
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
  subtitle: string;
  description: string;
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
    badgeText: string;
    accentGlow: string;
    dotColor: string;
  };
  badgeText: string;
  subSections: {
    title: string;
    to: string;
    search?: Record<string, string>;
    icon: any;
    desc?: string;
    permissionKeys?: string[];
  }[];
}

const DEPARTMENTS: DepartmentCardItem[] = [
  {
    id: "restaurant",
    code: "MOD-01",
    title: "إدارة المطعم",
    subtitle: "المنظومة التشغيلية الشاملة",
    description:
      "نقطة البيع السريعة POS، الكابتن أوردر للطاولات، شاشة المطبخ والفرن، وتتبع الطلبات وإغلاق وردية الكاشير.",
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
      badgeText: "مطعم وصالة",
      accentGlow: "from-amber-500 via-amber-400/50 to-transparent",
      dotColor: "bg-amber-500",
    },
    badgeText: "8 وظائف تشغيلية",
    subSections: [
      {
        title: "نقطة البيع (POS) الكاشير",
        to: "/pos",
        icon: Store,
        desc: "تسجيل المبيعات والفواتير السريعة",
        permissionKeys: ["pos", "pos_access", "orders", "orders_create_custom"],
      },
      {
        title: "شاشة الكابتن أوردر للطاولات",
        to: "/captain",
        icon: Users,
        desc: "أوردرات الصالة وخدمة الطاولات",
        permissionKeys: ["captain", "captain_access", "captain_create_order"],
      },
      {
        title: "شاشة المطبخ والفرن الذكية",
        to: "/oven",
        icon: Flame,
        desc: "متابعة تجهيز الأطباق والطلبات",
        permissionKeys: ["kitchen", "kitchen_view", "kitchen_change_status"],
      },
      {
        title: "متابعة الطلبات والديليفري",
        to: "/admin/restaurant",
        search: { tab: "orders" },
        icon: ClipboardList,
        desc: "الطلبات الجارية والتوصيل",
        permissionKeys: ["orders", "orders_view", "delivery", "delivery_view"],
      },
      {
        title: "إدارة الطاولات والباركود QR",
        to: "/admin/restaurant",
        search: { tab: "tables" },
        icon: Grid3X3,
        desc: "تخطيط الصالة والباركود الذكي",
        permissionKeys: [
          "page_restaurant_tables",
          "orders",
          "orders_generate_qr",
          "captain",
          "captain_transfer_tables",
        ],
      },
      {
        title: "قائمة الطعام والوجبات (المنيو)",
        to: "/admin/menu",
        icon: Coffee,
        desc: "تعديل الأصناف والأسعار",
        permissionKeys: ["page_restaurant_menu", "pos", "inventory", "orders"],
      },
      {
        title: "مستودع وخامات المطعم",
        to: "/admin/restaurant",
        search: { tab: "inventory" },
        icon: Package,
        desc: "المخزون الداخلي السريع",
        permissionKeys: [
          "page_restaurant_inventory",
          "inventory",
          "inventory_view",
          "production",
          "production_view",
        ],
      },
      {
        title: "إغلاق وردية كاشير المطعم",
        to: "/admin/restaurant",
        search: { tab: "shifts" },
        icon: History,
        desc: "تقارير وتصفية وردية الكاشير",
        permissionKeys: [
          "page_restaurant_cashier_treasury",
          "restaurant_open_shift",
          "pos",
          "pos_access",
          "treasury_open_close",
        ],
      },
    ],
  },
  {
    id: "mall",
    code: "MOD-02",
    title: "إدارة المول",
    subtitle: "المحلات والوحدات الاستثمارية",
    description:
      "دليل المحلات والمستأجرين، عقود الإيجار السنوية والشهرية، متابعة التحصيل والدفعات، ومصروفات وتشغيل المول.",
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
      badgeText: "عقود وإيجارات",
      accentGlow: "from-blue-500 via-blue-400/50 to-transparent",
      dotColor: "bg-blue-500",
    },
    badgeText: "4 أقسام فرعية",
    subSections: [
      {
        title: "دليل المحلات والمستأجرين والعقود",
        to: "/admin/mall",
        search: { tab: "shops" },
        icon: Store,
        desc: "قائمة الوحدات والمستأجرين والعقود",
        permissionKeys: ["page_mall_shops", "mall_manage_shops"],
      },
      {
        title: "متابعة الإيجارات والدفعات الشهرية",
        to: "/admin/mall",
        search: { tab: "payments" },
        icon: Calendar,
        desc: "سجل التحصيل الشهري والمستحقات",
        permissionKeys: ["page_mall_payments", "mall_manage_shops", "accounting"],
      },
      {
        title: "مصروفات وتشغيل وصيانة المول",
        to: "/admin/mall",
        search: { tab: "expenses" },
        icon: CreditCard,
        desc: "تكاليف التشغيل والصيانة والأمن",
        permissionKeys: ["page_mall_expenses", "mall_manage_shops", "mall_garden_finance", "accounting"],
      },
      {
        title: "التقارير المالية ونسب الإشغال",
        to: "/admin/mall",
        search: { tab: "reports" },
        icon: TrendingUp,
        desc: "الملخص الإحصائي والمالي للمول",
        permissionKeys: ["page_mall_reports", "mall_manage_shops", "reports", "accounting"],
      },
    ],
  },
  {
    id: "park",
    code: "MOD-03",
    title: "إدارة الحديقة",
    subtitle: "المرافق الترفيهية والتذاكر",
    description:
      "نقطة بيع تذاكر الدخول والألعاب (POS)، فتح وإغلاق ورديات الكاشير، الخزائن التشغيلية الثمانية، وتقارير الإيرادات.",
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
      badgeBg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20",
      badgeText: "تذاكر وألعاب",
      accentGlow: "from-emerald-500 via-teal-400/50 to-transparent",
      dotColor: "bg-emerald-500",
    },
    badgeText: "قسم الحديقة المستقل",
    subSections: [
      {
        title: "نقطة بيع تذاكر الدخول والألعاب (POS)",
        to: "/admin/park",
        search: { tab: "tickets" },
        icon: Ticket,
        desc: "إصدار تذاكر الدخول والباركود",
        permissionKeys: ["page_park_pos", "manage_park_shifts", "park_open_shift", "mall_garden_finance"],
      },
      {
        title: "فتح وردية كاشير جديدة",
        to: "/admin/park",
        search: { tab: "shifts" },
        icon: Plus,
        desc: "إطلاق وردية كاشير مع العهدة النقدية",
        permissionKeys: ["page_park_shifts", "manage_park_shifts", "park_open_shift"],
      },
      {
        title: "إغلاق وتسوية وردية الكاشير",
        to: "/admin/park",
        search: { tab: "closing" },
        icon: History,
        desc: "تقارير الوردية والتسوية المالية",
        permissionKeys: ["page_park_shifts", "manage_park_shifts", "delete_park_shifts", "park_open_shift"],
      },
      {
        title: "الخزائن التشغيلية الثمانية (8)",
        to: "/admin/park",
        search: { tab: "treasury" },
        icon: Landmark,
        desc: "متابعة أرصدة صناديق الحديقة",
        permissionKeys: ["page_park_treasury", "manage_park_shifts", "mall_garden_finance", "treasury"],
      },
      {
        title: "إدارة العملاء واشتراكات الزوار",
        to: "/admin/park",
        search: { tab: "customers" },
        icon: Users,
        desc: "سجل الزوار والعملاء الدائمين",
        permissionKeys: ["page_park_customers", "manage_park_shifts", "park_open_shift", "mall_garden_finance"],
      },
      {
        title: "أسعار التذاكر وفئات الألعاب",
        to: "/admin/park",
        search: { tab: "prices" },
        icon: Settings,
        desc: "تحديد تعرفة الدخول والألعاب",
        permissionKeys: ["page_park_prices", "manage_park_shifts", "mall_garden_finance"],
      },
      {
        title: "تقارير إيرادات الحديقة والورديات",
        to: "/admin/park",
        search: { tab: "reports" },
        icon: FileBarChart,
        desc: "إحصائيات المبيعات والتحصيل",
        permissionKeys: ["page_park_vouchers", "park_reports", "manage_park_shifts", "mall_garden_finance"],
      },
    ],
  },
  {
    id: "finance",
    code: "MOD-04",
    title: "الإدارة المالية",
    subtitle: "المنظومة المحاسبية الموحدة",
    description:
      "كشف حساب الأستاذ العام، دفتر اليومية العامة، دليل وشجرة الحسابات، إدارة الخزائن، والتقارير المالية والميزانية.",
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
      badgeText: "حسابات موحدة",
      accentGlow: "from-indigo-500 via-indigo-400/50 to-transparent",
      dotColor: "bg-indigo-500",
    },
    badgeText: "ضم الحسابات والخزائن والتقارير",
    subSections: [
      {
        title: "المركز المالي الشامل والميزانية",
        to: "/admin/ledger",
        search: { tab: "financial_position" },
        icon: TrendingUp,
        desc: "عرض الأصول والخصوم وقائمة الدخل الموحدة",
        permissionKeys: ["page_finance_position", "accounting", "accounting_view", "reports_view_financials"],
      },
      {
        title: "كشف حساب الأستاذ العام",
        to: "/admin/ledger",
        search: { tab: "ledger" },
        icon: BookOpen,
        desc: "كشف حساب مفصل وأرصدة الحسابات",
        permissionKeys: ["page_finance_ledger", "accounting", "accounting_view"],
      },
      {
        title: "دفتر اليومية العامة والقيود المزدوجة",
        to: "/admin/ledger",
        search: { tab: "journal" },
        icon: FileText,
        desc: "تسجيل وترحيل قيود اليومية",
        permissionKeys: ["page_finance_journal", "accounting", "accounting_view", "accounting_post_journal"],
      },
      {
        title: "إدارة الخزائن والحسابات البنكية",
        to: "/admin/ledger",
        search: { tab: "treasury" },
        icon: Wallet,
        desc: "الصناديق النقدية وحركات الخزينة",
        permissionKeys: ["page_finance_treasury", "treasury", "treasury_view", "accounting"],
      },
      {
        title: "دليل وشجرة الحسابات (Oracle)",
        to: "/admin/ledger",
        search: { tab: "accounts" },
        icon: FileBarChart,
        desc: "شجرة الحسابات بالأصول والخصوم",
        permissionKeys: ["page_finance_accounts", "accounting", "accounting_view"],
      },
      {
        title: "سندات الصرف والقبض المرحّلة",
        to: "/admin/ledger",
        search: { tab: "vouchers" },
        icon: Receipt,
        desc: "سندات الإيرادات والمصروفات",
        permissionKeys: ["page_finance_vouchers", "accounting", "treasury", "expense_approval", "revenue_approval"],
      },
      {
        title: "ميزان المراجعة المحاسبي",
        to: "/admin/ledger",
        search: { tab: "trial" },
        icon: Scale,
        desc: "توازن الأرصدة والمجاميع",
        permissionKeys: ["page_finance_trial", "accounting", "accounting_view", "reports_view_financials"],
      },
      {
        title: "التقارير والميزانية العمومية",
        to: "/admin/ledger",
        search: { tab: "reports" },
        icon: TrendingUp,
        desc: "قائمة الدخل والمركز المالي",
        permissionKeys: ["page_finance_reports", "page_finance_statements", "reports", "reports_view_financials", "accounting"],
      },
      {
        title: "تصميم وإدارة الإيصالات والسندات",
        to: "/admin/receipts",
        icon: Receipt,
        desc: "نماذج الطباعة الرسمية",
        permissionKeys: ["page_finance_receipts", "accounting", "treasury", "orders", "pos"],
      },
    ],
  },
  {
    id: "hr",
    code: "MOD-05",
    title: "الموارد البشرية والمستخدمين",
    subtitle: "شؤون الموظفين والصلاحيات",
    description:
      "دليل الموظفين، الحضور والانصراف، مسيرات الرواتب والسلف، وإدارة حسابات المستخدمين وتحديد أدوار الصلاحيات.",
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
      badgeText: "موارد ومستخدمين",
      accentGlow: "from-rose-500 via-rose-400/50 to-transparent",
      dotColor: "bg-rose-500",
    },
    badgeText: "ضم إدارة المستخدمين",
    subSections: [
      {
        title: "سجل وبيانات الموظفين",
        to: "/admin/hr",
        search: { tab: "employees" },
        icon: Users,
        desc: "الملفات الشخصية والوظائف",
        permissionKeys: ["page_hr_employees", "hr", "hr_view_attendance"],
      },
      {
        title: "تسجيل الحضور والانصراف",
        to: "/admin/hr",
        search: { tab: "attendance" },
        icon: CalendarDays,
        desc: "متابعة أوقات العمل والورديات",
        permissionKeys: ["page_hr_attendance", "hr", "hr_view_attendance"],
      },
      {
        title: "مسيرات الرواتب الشهرية والبدلات",
        to: "/admin/hr",
        search: { tab: "payroll" },
        icon: DollarSign,
        desc: "احتساب المستحقات الشهرية",
        permissionKeys: ["page_hr_payroll", "hr", "hr_manage_payroll_loans"],
      },
      {
        title: "السلف والخصومات والمكافآت",
        to: "/admin/hr",
        search: { tab: "loans" },
        icon: Coins,
        desc: "حركات السلف والاستقطاعات",
        permissionKeys: ["page_hr_loans", "hr", "hr_manage_payroll_loans"],
      },
      {
        title: "إدارة مستخدمي النظام والصلاحيات",
        to: "/admin/hr",
        search: { tab: "users" },
        icon: ShieldCheck,
        desc: "تحديد أدوار الوصول وحسابات الدخول",
        permissionKeys: ["users_roles", "system_manage_users", "super_admin_full_access"],
      },
    ],
  },
  {
    id: "inventory",
    code: "MOD-06",
    title: "إدارة المخزون والمستودعات",
    subtitle: "سلاسل الإمداد والمشتريات",
    description:
      "إدارة المستودعات، أصناف المخزون، التحويلات الداخلية، فواتير المشتريات والموردين، وتسويات الهالك والتوالف.",
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
      badgeText: "مستودعات وتوريد",
      accentGlow: "from-sky-500 via-sky-400/50 to-transparent",
      dotColor: "bg-sky-500",
    },
    badgeText: "5 أقسام فرعية",
    subSections: [
      {
        title: "أصناف المخزون وجرد المستودع",
        to: "/admin/inventory",
        search: { tab: "items" },
        icon: Package,
        desc: "متابعة أرصدة المواد وتنبيهات النواقص",
        permissionKeys: ["page_inventory_items", "inventory", "inventory_view"],
      },
      {
        title: "التحويلات الداخلية بين المستودعات",
        to: "/admin/inventory",
        search: { tab: "transfers" },
        icon: ArrowLeftRight,
        desc: "نقل الخامات بين الفروع والمخازن",
        permissionKeys: ["page_inventory_transfers", "inventory", "inventory_adjust_transfer"],
      },
      {
        title: "فواتير المشتريات وسندات الاستلام",
        to: "/admin/inventory",
        search: { tab: "purchases" },
        icon: FileSpreadsheet,
        desc: "تسجيل فواتير الشراء الواردة",
        permissionKeys: ["page_inventory_purchases", "purchasing", "purchasing_view", "purchasing_add_invoice"],
      },
      {
        title: "إدارة الموردين والشركات",
        to: "/admin/inventory",
        search: { tab: "suppliers" },
        icon: Users,
        desc: "بيانات وحسابات الموردين",
        permissionKeys: ["page_inventory_suppliers", "purchasing", "purchasing_view", "purchasing_returns"],
      },
      {
        title: "تسويات الهالك والتوالف",
        to: "/admin/inventory",
        search: { tab: "waste" },
        icon: Trash2,
        desc: "إثبات الفاقد وتكلفة الهدر",
        permissionKeys: ["page_inventory_waste", "inventory", "inventory_waste_dispose"],
      },
    ],
  },
  {
    id: "shift_audit",
    code: "MOD-07",
    title: "تدقيق الورديات",
    subtitle: "مطابقة ورديات الكاشير والتحصيل",
    description:
      "فحص ومطابقة جميع ورديات المطعم والحديقة والكاشير، تدقيق العجز والزيادة النقدية، ومراجعة سجلات الإغلاق في قاعدة البيانات.",
    to: "/admin",
    search: { tab: "shift_audit" },
    icon: Database,
    permissionKeys: [
      "page_shift_audit",
      "treasury",
      "treasury_view",
      "treasury_open_close",
      "accounting",
      "accounting_view",
      "reports",
      "manage_park_shifts",
      "audit_logs",
    ],
    colorScheme: {
      bgLight: "bg-teal-500/5",
      border: "border-border/80",
      iconBg: "bg-teal-500/12 text-teal-600 dark:text-teal-400 border-teal-500/25",
      iconText: "text-teal-600 dark:text-teal-400",
      hoverBorder: "hover:border-teal-500/45",
      badgeBg: "bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20",
      badgeText: "رقابة الورديات",
      accentGlow: "from-teal-500 via-teal-400/50 to-transparent",
      dotColor: "bg-teal-500",
    },
    badgeText: "مطابقة سحابية ومحلية",
    subSections: [
      {
        title: "عرض ومطابقة الورديات المسجلة",
        to: "/admin",
        search: { tab: "shift_audit" },
        icon: Database,
        desc: "فحص تقارير الإغلاق وحالات الترحيل",
        permissionKeys: ["page_shift_audit_matching", "treasury_transfer_reconcile", "treasury", "accounting"],
      },
      {
        title: "فحص العجز والزيادة النقدية",
        to: "/admin",
        search: { tab: "shift_audit" },
        icon: Scale,
        desc: "مقارنة المبيعات المسجلة مع النقد الفعلي",
        permissionKeys: ["page_shift_audit_variance", "treasury_transfer_reconcile", "treasury", "accounting"],
      },
    ],
  },
  {
    id: "audit_logs",
    code: "MOD-08",
    title: "سجل العمليات",
    subtitle: "الرقابة وتتبع الأنشطة الشاملة",
    description:
      "السجل الرقابي الموثق لكافة العمليات المالية، فواتير المبيعات، حركات الخزائن، وتعديلات المستخدمين والصلاحيات لحظياً.",
    to: "/admin",
    search: { tab: "audit_logs" },
    icon: History,
    permissionKeys: ["page_audit_logs", "audit_logs", "system_audit_logs", "super_admin_full_access"],
    colorScheme: {
      bgLight: "bg-violet-500/5",
      border: "border-border/80",
      iconBg: "bg-violet-500/12 text-violet-600 dark:text-violet-400 border-violet-500/25",
      iconText: "text-violet-600 dark:text-violet-400",
      hoverBorder: "hover:border-violet-500/45",
      badgeBg: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20",
      badgeText: "سجل رقابي وأمني",
      accentGlow: "from-violet-500 via-violet-400/50 to-transparent",
      dotColor: "bg-violet-500",
    },
    badgeText: "تتبع لحظي موثق",
    subSections: [
      {
        title: "استعراض سجل الأحداث والأنشطة",
        to: "/admin",
        search: { tab: "audit_logs" },
        icon: History,
        desc: "سجل زمني لجميع الحركات والتعديلات",
        permissionKeys: ["page_audit_logs", "audit_logs", "system_audit_logs"],
      },
      {
        title: "تصفية الحركات والرقابة الأمنية",
        to: "/admin",
        search: { tab: "audit_logs" },
        icon: ShieldCheck,
        desc: "تتبع دقيق لكشف التلاعب ومطابقة التغييرات",
        permissionKeys: ["system_audit_logs", "audit_logs"],
      },
    ],
  },
  {
    id: "system",
    code: "MOD-09",
    title: "خيارات المطور والنسخ الاحتياطي",
    subtitle: "تحديثات النظام وإدارة الإصدارات",
    description:
      "فحص المزامنة مع GitHub، سجل التحديثات التلقائية للنظام، والتحكم في إعدادات التطوير والنسخ الاحتياطي.",
    to: "/admin/system-update",
    icon: Settings,
    permissionKeys: ["page_developer", "system_backup_update", "developer_options", "super_admin_full_access"],
    colorScheme: {
      bgLight: "bg-slate-500/5",
      border: "border-border/80",
      iconBg: "bg-slate-500/12 text-slate-700 dark:text-slate-300 border-slate-500/25",
      iconText: "text-slate-700 dark:text-slate-300",
      hoverBorder: "hover:border-slate-500/45",
      badgeBg: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20",
      badgeText: "تحديثات ونسخ",
      accentGlow: "from-slate-500 via-slate-400/50 to-transparent",
      dotColor: "bg-slate-500",
    },
    badgeText: "تحديث وتطوير",
    subSections: [
      {
        title: "استوديو المطور Pro (المحرر البصري)",
        to: "/admin/studio",
        icon: Sparkles,
        desc: "تصميم الواجهات والمسودات والنشر الآمن",
        permissionKeys: ["developer_options", "super_admin_full_access"],
      },
      {
        title: "تحديثات النظام ومزامنة GitHub",
        to: "/admin/system-update",
        icon: RefreshCw,
        desc: "الإصدار والتحديثات التلقائية",
        permissionKeys: ["page_system_github", "system_backup_update", "developer_options", "super_admin_full_access"],
      },
      {
        title: "فحص الاتصال والنسخ الاحتياطي",
        to: "/admin/system-update",
        icon: Database,
        desc: "فحص حالة قاعدة البيانات والتخزين",
        permissionKeys: ["page_system_status", "system_backup_update", "developer_options", "super_admin_full_access"],
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
  const [activePermissions, setActivePermissions] = useState<Record<string, boolean>>(() =>
    propPermissions && Object.keys(propPermissions).length > 0
      ? propPermissions
      : { super_admin_full_access: true },
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
        dept.subtitle.toLowerCase().includes(q) ||
        dept.description.toLowerCase().includes(q) ||
        dept.subSections.some(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            (s.desc && s.desc.toLowerCase().includes(q)),
        ),
    );
  }, [activePermissions, searchQuery]);

  const ActionArrow = isEn ? ArrowRight : ArrowLeft;

  return (
    <div className="space-y-6 pt-4" dir={isEn ? "ltr" : "rtl"} data-studio-id="admin-departments-hub-root">
      {/* 4K Executive Workspace Command Header */}
      <div
        data-studio-id="admin-welcome-banner"
        className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-7 shadow-xs"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-lg">
              <Layers size={14} />
              <span>نظام الإدارة المتكامل</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
              لوحة الأقسام الرئيسية
            </h1>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <div className="relative min-w-[250px] sm:min-w-[290px]">
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
                  "w-full h-11 rounded-xl border border-border bg-muted/50 focus:bg-background text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
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

            <div className="hidden sm:flex items-center gap-2 px-4 h-11 rounded-xl border border-border bg-muted/50 text-sm font-bold text-foreground tabular-nums">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span>{visibleDepartments.length}</span>
              <span>أقسام أساسية</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4K Grid of Department Cards — Spacious, High-Contrast, Zero Clutter */}
      <div
        data-studio-id="admin-departments-grid"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
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
                "group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-card p-6 transition-all duration-200 cursor-pointer hover:-translate-y-1 hover:shadow-xl",
                dept.colorScheme.border,
                dept.colorScheme.hoverBorder,
              )}
            >
              {/* Subtle Top Accent Bar */}
              <div
                className={cn(
                  "absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-l opacity-85 group-hover:opacity-100 transition-opacity",
                  dept.colorScheme.accentGlow,
                )}
              />

              <div>
                {/* Card Top Header: Crisp 4K Icon + Title + Sub-modules Dropdown */}
                <div className="flex items-start justify-between gap-3 pt-1">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={cn(
                        "flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl border transition-transform duration-200 group-hover:scale-105",
                        dept.colorScheme.iconBg,
                      )}
                    >
                      <Icon size={25} strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg sm:text-xl font-extrabold text-foreground group-hover:text-primary transition-colors truncate">
                        {dept.title}
                      </h3>
                      <p className="text-xs sm:text-sm font-semibold text-primary/90 truncate mt-0.5">
                        {dept.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Clean Sub-Modules Dropdown Menu */}
                  <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 gap-1.5 rounded-xl border-border bg-muted/50 hover:bg-muted text-xs font-bold text-foreground px-3"
                          title="عرض الأقسام والوظائف الداخلية"
                        >
                          <span>الأقسام</span>
                          <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-md bg-primary/15 text-primary text-[11px] font-extrabold tabular-nums">
                            {dept.subSections.length}
                          </span>
                          <ChevronDown size={14} className="text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className={cn(
                          "w-72 p-2 rounded-2xl shadow-2xl border-border bg-popover",
                          isEn ? "text-left" : "text-right",
                        )}
                      >
                        <DropdownMenuLabel className="px-3 py-1.5 text-xs font-extrabold text-muted-foreground">
                          {dept.title}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {dept.subSections.map((sub) => {
                          const SubIcon = sub.icon;
                          return (
                            <DropdownMenuItem
                              key={sub.title}
                              onClick={() =>
                                navigate({
                                  to: sub.to,
                                  search: sub.search,
                                })
                              }
                              className="flex items-start gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-muted transition group/item"
                            >
                              <div className="mt-0.5 p-1.5 rounded-lg bg-muted text-primary shrink-0 group-hover/item:bg-primary group-hover/item:text-primary-foreground transition">
                                <SubIcon size={15} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs sm:text-sm font-bold text-foreground leading-snug">
                                  {sub.title}
                                </p>
                                {sub.desc && (
                                  <p className="text-xs text-muted-foreground mt-0.5 truncate leading-snug">
                                    {sub.desc}
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

                {/* Uniform, Structured Quick Sub-Module List (Up to 4 items) */}
                <div
                  className="mt-4 pt-4 border-t border-border/70 grid grid-cols-1 sm:grid-cols-2 gap-2"
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

              {/* Card Footer CTA */}
              <div className="mt-5 pt-3.5 border-t border-border/70 flex items-center justify-between text-xs sm:text-sm font-bold">
                <span className="inline-flex items-center gap-2 text-xs text-muted-foreground font-bold">
                  <span className={cn("h-2 w-2 rounded-full", dept.colorScheme.dotColor)} />
                  <span>{dept.colorScheme.badgeText}</span>
                </span>

                <span className="inline-flex items-center gap-1.5 text-primary font-extrabold group-hover:gap-2 transition-all">
                  <span>فتح القسم</span>
                  <ActionArrow size={16} />
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      {visibleDepartments.length === 0 && (
        <Card className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 mb-4">
            <ShieldCheck size={28} />
          </div>
          <h3 className="text-lg font-black text-foreground">
            لم يتم تفعيل أقسام لهذا الحساب بعد
          </h3>
          <p className="mt-2 text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
            يرجى مراجعة مدير النظام لتفعيل الصلاحيات والأقسام المسموح بها لهذا الحساب، أو إعادة تسجيل الدخول بحساب مدير النظام.
          </p>
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
