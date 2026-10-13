// @ts-nocheck
import React from "react";
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
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

export interface DepartmentCardItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  to: string;
  icon: any;
  colorScheme: {
    bgLight: string;
    border: string;
    iconBg: string;
    iconText: string;
    hoverBorder: string;
    badgeBg: string;
    badgeText: string;
    accentGlow: string;
  };
  badgeText: string;
  subSections: {
    title: string;
    to: string;
    search?: Record<string, string>;
    icon: any;
    desc?: string;
  }[];
}

export const DEPARTMENTS: DepartmentCardItem[] = [
  {
    id: "restaurant",
    title: "إدارة المطعم",
    subtitle: "المنظومة التشغيلية الشاملة",
    description:
      "نقطة البيع السريعة POS، الكابتن أوردر للطاولات، شاشة المطبخ والفرن، وتتبع الطلبات وإغلاق وردية الكاشير.",
    to: "/admin/restaurant",
    icon: UtensilsCrossed,
    colorScheme: {
      bgLight: "bg-amber-500/5",
      border: "border-amber-500/20",
      iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      iconText: "text-amber-600 dark:text-amber-400",
      hoverBorder: "hover:border-amber-500/50 hover:shadow-amber-500/5",
      badgeBg: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
      badgeText: "مطعم وصالة",
      accentGlow: "from-amber-500/10 to-transparent",
    },
    badgeText: "8 وظائف تشغيلية",
    subSections: [
      { title: "نقطة البيع (POS)", to: "/pos", icon: Store, desc: "شاشة البيع والفواتير والتحصيل" },
      { title: "شاشة الكاشير والخزينة", to: "/cashier-treasury", icon: Wallet, desc: "النقدية وورديات الكاشير" },
      { title: "شاشة الكابتن والطاولات", to: "/captain", icon: Users, desc: "طلبات الصالة وإدارة الطاولات" },
      { title: "شاشة المطبخ والفرن", to: "/oven", icon: Flame, desc: "تحضير الطلبات ومتابعتها" },
      { title: "سجل الطلبات والفواتير", to: "/admin/orders", icon: ClipboardList, desc: "الطلبات الحالية والسابقة" },
      { title: "قائمة الطعام والمنيو", to: "/admin/menu", icon: Coffee, desc: "إدارة الأصناف والأسعار" },
      { title: "المخزون والمستودعات", to: "/admin/inventory", search: { tab: "stock" }, icon: Package, desc: "الخامات والأصناف" },
      { title: "إدارة ورديات المطعم", to: "/admin/restaurant", search: { tab: "shifts" }, icon: Clock, desc: "فتح وإغلاق الورديات" },
    ],
  },
  {
    id: "mall",
    title: "إدارة المول",
    subtitle: "المحلات والوحدات الاستثمارية",
    description:
      "دليل المحلات والمستأجرين، عقود الإيجار السنوية والشهرية، متابعة التحصيل والدفعات، ومصروفات وتشغيل المول.",
    to: "/admin/mall",
    icon: Building2,
    colorScheme: {
      bgLight: "bg-blue-500/5",
      border: "border-blue-500/20",
      iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      iconText: "text-blue-600 dark:text-blue-400",
      hoverBorder: "hover:border-blue-500/50 hover:shadow-blue-500/5",
      badgeBg: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
      badgeText: "عقود وإيجارات",
      accentGlow: "from-blue-500/10 to-transparent",
    },
    badgeText: "4 أقسام فرعية",
    subSections: [
      { title: "المحلات والمستأجرون", to: "/admin/mall", search: { tab: "shops" }, icon: Store, desc: "المحلات والعقود والحسابات" },
      { title: "الإيجارات والدفعات", to: "/admin/mall", search: { tab: "payments" }, icon: Calendar, desc: "الأقساط والاستحقاقات" },
      { title: "إيرادات الحديقة والتذاكر", to: "/admin/mall", search: { tab: "garden" }, icon: Trees, desc: "التذاكر والإيرادات التشغيلية" },
      { title: "مصروفات التشغيل والصيانة", to: "/admin/mall", search: { tab: "expenses" }, icon: CreditCard, desc: "مصروفات المول والحديقة" },
      { title: "التقارير المالية والإشغال", to: "/admin/mall", search: { tab: "reports" }, icon: TrendingUp, desc: "ملخص الإيرادات والإشغال" },
    ],
  },
  {
    id: "park",
    title: "إدارة الحديقة",
    subtitle: "المرافق الترفيهية والتذاكر",
    description:
      "نقطة بيع تذاكر الدخول والألعاب (POS)، فتح وإغلاق ورديات الكاشير، الخزائن التشغيلية الثمانية، وتقارير الإيرادات.",
    to: "/admin/park",
    icon: Trees,
    colorScheme: {
      bgLight: "bg-teal-500/5",
      border: "border-teal-500/20",
      iconBg: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
      iconText: "text-teal-600 dark:text-teal-400",
      hoverBorder: "hover:border-teal-500/50 hover:shadow-teal-500/5",
      badgeBg: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
      badgeText: "تذاكر وألعاب",
      accentGlow: "from-teal-500/10 to-transparent",
    },
    badgeText: "قسم الحديقة المستقل",
    subSections: [
      { title: "بيع التذاكر والدخول", to: "/admin/park", search: { tab: "tickets" }, icon: Ticket, desc: "مبيعات التذاكر والألعاب" },
      { title: "ورديات الكاشير", to: "/admin/park", search: { tab: "shifts" }, icon: Clock, desc: "فتح ومراجعة الورديات" },
      { title: "الخزائن التشغيلية", to: "/admin/park", search: { tab: "treasury" }, icon: Wallet, desc: "الصناديق والأرصدة" },
      { title: "تقارير الإيرادات", to: "/admin/park", search: { tab: "reports" }, icon: TrendingUp, desc: "الإيرادات وحركة التذاكر" },
    ],
  },
  {
    id: "finance",
    title: "الإدارة المالية",
    subtitle: "المنظومة المحاسبية الموحدة",
    description:
      "كشف حساب الأستاذ العام، دفتر اليومية العامة، دليل وشجرة الحسابات، إدارة الخزائن، والتقارير المالية والميزانية.",
    to: "/admin/ledger",
    icon: Landmark,
    colorScheme: {
      bgLight: "bg-indigo-500/5",
      border: "border-indigo-500/20",
      iconBg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
      iconText: "text-indigo-600 dark:text-indigo-400",
      hoverBorder: "hover:border-indigo-500/50 hover:shadow-indigo-500/5",
      badgeBg: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
      badgeText: "حسابات موحدة",
      accentGlow: "from-indigo-500/10 to-transparent",
    },
    badgeText: "ضم الحسابات والخزائن والتقارير",
    subSections: [
      { title: "حساب الأستاذ العام", to: "/admin/ledger", search: { tab: "ledger" }, icon: BookOpen, desc: "الأرصدة وحركات الحسابات" },
      { title: "دفتر اليومية العامة", to: "/admin/ledger", search: { tab: "journal" }, icon: FileText, desc: "القيود المحاسبية" },
      { title: "سندات الصرف والقبض", to: "/admin/ledger", search: { tab: "vouchers" }, icon: Receipt, desc: "تسجيل ومراجعة السندات" },
      { title: "ميزان المراجعة", to: "/admin/ledger", search: { tab: "trial" }, icon: Scale, desc: "مراجعة الأرصدة" },
      { title: "القوائم المالية", to: "/admin/ledger", search: { tab: "statements" }, icon: FileBarChart, desc: "النتائج والقوائم المالية" },
      { title: "دليل الحسابات", to: "/admin/accounts", icon: Layers, desc: "شجرة الحسابات والأكواد" },
      { title: "الإيصالات والسندات", to: "/admin/receipts", icon: Receipt, desc: "قوالب وطباعة المستندات" },
      { title: "التقارير والميزانية", to: "/admin/reports", icon: TrendingUp, desc: "تقارير الأداء المالي" },
    ],
  },
  {
    id: "hr",
    title: "الموارد البشرية والمستخدمين",
    subtitle: "شؤون الموظفين والصلاحيات",
    description:
      "دليل الموظفين، الحضور والانصراف، مسيرات الرواتب والسلف، وإدارة حسابات المستخدمين وتحديد أدوار الصلاحيات.",
    to: "/admin/hr",
    icon: UserCheck,
    colorScheme: {
      bgLight: "bg-rose-500/5",
      border: "border-rose-500/20",
      iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      iconText: "text-rose-600 dark:text-rose-400",
      hoverBorder: "hover:border-rose-500/50 hover:shadow-rose-500/5",
      badgeBg: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
      badgeText: "موارد ومستخدمين",
      accentGlow: "from-rose-500/10 to-transparent",
    },
    badgeText: "ضم إدارة المستخدمين",
    subSections: [
      { title: "دليل الموظفين", to: "/admin/hr", search: { tab: "employees" }, icon: Users, desc: "بيانات الكادر الوظيفي" },
      { title: "الحضور والانصراف", to: "/admin/hr", search: { tab: "attendance" }, icon: CalendarDays, desc: "متابعة الدوام اليومي" },
      { title: "الرواتب ومسيرات الأجور", to: "/admin/hr", search: { tab: "payroll" }, icon: DollarSign, desc: "احتساب الرواتب والمستحقات" },
      { title: "السلف والخصومات", to: "/admin/hr", search: { tab: "loans" }, icon: Coins, desc: "السلف وأقساط السداد" },
      { title: "المستخدمون والصلاحيات", to: "/admin/users", icon: ShieldCheck, desc: "حسابات الدخول ومستويات الوصول" },
    ],
  },
  {
    id: "inventory",
    title: "إدارة المخزون والمستودعات",
    subtitle: "سلاسل الإمداد والمشتريات",
    description:
      "إدارة المستودعات، أصناف المخزون، التحويلات الداخلية، فواتير المشتريات والموردين، وتسويات الهالك والتوالف.",
    to: "/admin/inventory",
    icon: Package,
    colorScheme: {
      bgLight: "bg-sky-500/5",
      border: "border-sky-500/20",
      iconBg: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
      iconText: "text-sky-600 dark:text-sky-400",
      hoverBorder: "hover:border-sky-500/50 hover:shadow-sky-500/5",
      badgeBg: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
      badgeText: "مستودعات وتوريد",
      accentGlow: "from-sky-500/10 to-transparent",
    },
    badgeText: "5 أقسام فرعية",
    subSections: [
      { title: "المخازن وربط المستودعات", to: "/admin/inventory", search: { tab: "warehouses" }, icon: Building2, desc: "تعريف المستودعات وربطها" },
      { title: "الأصناف والمخزون", to: "/admin/inventory", search: { tab: "stock" }, icon: Package, desc: "الأصناف والكميات والباركود" },
      { title: "الحركات والتحويلات", to: "/admin/inventory", search: { tab: "transactions" }, icon: ArrowLeftRight, desc: "التسويات والتحويلات الداخلية" },
      { title: "الصلاحية وتتبع الدفعات", to: "/admin/inventory", search: { tab: "expiry" }, icon: Calendar, desc: "تواريخ الصلاحية والهالك" },
      { title: "المشتريات والموردون", to: "/admin/inventory", search: { tab: "purchases" }, icon: ShoppingCart, desc: "فواتير التوريد والموردين" },
      { title: "تقارير المخزون", to: "/admin/inventory", search: { tab: "reports" }, icon: FileBarChart, desc: "الحركة والتقييم والتنبيهات" },
      { title: "إعدادات المخزن", to: "/admin/inventory", search: { tab: "settings" }, icon: Settings, desc: "إعدادات الوحدات والتخزين" },
    ],
  },
  {
    id: "system",
    title: "خيارات المطور والرقابة",
    subtitle: "الرقابة وتحديثات النظام",
    description:
      "سجل تدقيق العمليات، تدقيق الورديات في Supabase، فحص المزامنة، وتحديثات النظام التلقائية عبر GitHub.",
    to: "/admin/system-update",
    icon: Settings,
    colorScheme: {
      bgLight: "bg-slate-500/5",
      border: "border-slate-500/20",
      iconBg: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
      iconText: "text-slate-700 dark:text-slate-300",
      hoverBorder: "hover:border-slate-500/50 hover:shadow-slate-500/5",
      badgeBg: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300",
      badgeText: "نظام وتدقيق",
      accentGlow: "from-slate-500/10 to-transparent",
    },
    badgeText: "رقابة وأمان",
    subSections: [
      { title: "تحديث النظام", to: "/admin/system-update", search: { tab: "system" }, icon: RefreshCw, desc: "الإصدار والمزامنة" },
      { title: "حزمة قاعدة البيانات", to: "/admin/system-update", search: { tab: "access" }, icon: FileSpreadsheet, desc: "تصدير واستيراد البيانات" },
      { title: "سجل العمليات", to: "/admin", search: { tab: "audit_logs" }, icon: History, desc: "مراجعة الأنشطة الإدارية" },
      { title: "تدقيق الورديات", to: "/admin", search: { tab: "shift_audit" }, icon: Database, desc: "فحص ومطابقة الورديات" },
    ],
  },
];

export function DepartmentsGridHub() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Grid of Department Squares */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-5 sm:gap-6">
        {DEPARTMENTS.map((dept) => {
          const Icon = dept.icon;
          return (
            <Card
              key={dept.id}
              onClick={() => navigate({ to: dept.to as any, search: { tab: "grid" } as any })}
              className={cn(
                "group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-card p-5 sm:p-6 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md",
                dept.colorScheme.border,
                dept.colorScheme.hoverBorder,
              )}
            >
              {/* Top Accent Gradient line */}
              <div
                className={cn(
                  "absolute top-0 right-0 left-0 h-1 bg-gradient-to-l opacity-70 group-hover:opacity-100 transition",
                  dept.colorScheme.accentGlow,
                )}
              />

              {/* Card Header: Icon, Badge, and Dedicated Dropdown Trigger */}
              <div className="flex items-start justify-between gap-3">
                <div
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border/50 shadow-2xs transition group-hover:scale-105",
                    dept.colorScheme.iconBg,
                  )}
                >
                  <Icon size={24} />
                </div>

                {/* Dropdown Menu Trigger - Dedicated button as requested */}
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 rounded-xl border-border/80 bg-background/80 hover:bg-muted text-xs font-bold text-foreground px-2.5 shadow-2xs"
                        title="عرض الأقسام والوظائف الداخلية"
                      >
                        <span>الأقسام</span>
                        <ChevronDown size={13} className="text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-64 p-1.5 rounded-2xl shadow-xl border-border bg-popover"
                    >
                      <DropdownMenuLabel className="text-right px-2.5 py-1.5 text-[11px] font-black text-muted-foreground">
                        {dept.title} - الأقسام الفرعية:
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
                            className="flex items-start gap-2.5 px-2.5 py-2 rounded-xl text-right cursor-pointer hover:bg-muted transition group/item"
                          >
                            <div className="mt-0.5 p-1 rounded-lg bg-muted text-primary shrink-0 group-hover/item:bg-primary group-hover/item:text-primary-foreground transition">
                              <SubIcon size={14} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-foreground leading-tight">
                                {sub.title}
                              </p>
                              {sub.desc && (
                                <p className="text-[10px] text-muted-foreground mt-0.5 truncate leading-tight">
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

              {/* Card Body: Title, Subtitle & Description */}
              <div className="my-4 space-y-1.5 text-right">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-foreground group-hover:text-primary transition">
                    {dept.title}
                  </h3>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-lg",
                      dept.colorScheme.badgeBg,
                    )}
                  >
                    {dept.badgeText}
                  </Badge>
                </div>
                <p className="text-[11px] font-bold text-muted-foreground">{dept.subtitle}</p>
                <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed pt-1">
                  {dept.description}
                </p>
              </div>

              {/* Card Footer: Quick Actions */}
              <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs font-bold">
                <span className="text-[11px] text-muted-foreground font-semibold">
                  {dept.subSections.length} أقسام وتفاصيل
                </span>

                <span className="inline-flex items-center gap-1 text-primary group-hover:translate-x-[-3px] transition-transform font-black">
                  <span>فتح القسم</span>
                  <ArrowLeft size={14} />
                </span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}


/** Displays the second-level square navigation for one department. */
export function DepartmentSubpagesGrid({ departmentId }: { departmentId: string }) {
  const navigate = useNavigate();
  const department = DEPARTMENTS.find((item) => item.id === departmentId);

  if (!department) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        القسم المطلوب غير موجود.
      </div>
    );
  }

  const DepartmentIcon = department.icon;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2">
            <DepartmentIcon className={department.colorScheme.iconText} size={25} />
            <span>{department.title}</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            اختر الشاشة المطلوبة من المربعات التالية.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate({ to: "/admin" as any, search: { tab: "grid" } as any })}
          className="shrink-0 gap-2 rounded-xl font-bold"
        >
          <ArrowLeft size={15} />
          لوحة الأقسام الرئيسية
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {department.subSections.map((sub, index) => {
          const Icon = sub.icon;
          return (
            <Card
              key={`${department.id}-sub-${index}`}
              onClick={() =>
                navigate({
                  to: sub.to as any,
                  ...(sub.search ? { search: sub.search as any } : {}),
                } as any)
              }
              className={cn(
                "group relative flex min-h-[150px] flex-col justify-between overflow-hidden rounded-2xl border bg-card p-5 sm:p-6 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5",
                department.colorScheme.border,
                department.colorScheme.hoverBorder,
              )}
            >
              <div
                className={cn(
                  "absolute top-0 right-0 left-0 h-1 bg-gradient-to-l opacity-70 group-hover:opacity-100 transition",
                  department.colorScheme.accentGlow,
                )}
              />
              <CardContent className="p-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border/50 shadow-2xs transition group-hover:scale-105",
                      department.colorScheme.iconBg,
                    )}
                  >
                    <Icon size={23} />
                  </div>
                  <Badge
                    variant="outline"
                    className="rounded-lg text-[10px] font-bold border-border/70 bg-background/70"
                  >
                    شاشة فرعية
                  </Badge>
                </div>
                <h3 className="mt-4 text-base font-black text-foreground leading-snug group-hover:text-primary transition">
                  {sub.title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {sub.desc || "فتح وإدارة هذا القسم."}
                </p>
              </CardContent>
              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs font-bold">
                <span className="text-[11px] text-muted-foreground">فتح الشاشة</span>
                <span className="inline-flex items-center gap-1 text-primary font-black">
                  فتح
                  <ArrowLeft size={14} />
                </span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
