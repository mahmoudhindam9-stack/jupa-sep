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

interface DepartmentCardItem {
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

const DEPARTMENTS: DepartmentCardItem[] = [
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
      {
        title: "نقطة البيع (POS) الكاشير",
        to: "/pos",
        icon: Store,
        desc: "تسجيل المبيعات والفواتير السريعة",
      },
      {
        title: "شاشة الكابتن أوردر للطاولات",
        to: "/captain",
        icon: Users,
        desc: "أوردرات الصالة وخدمة الطاولات",
      },
      {
        title: "شاشة المطبخ والفرن الذكية",
        to: "/oven",
        icon: Flame,
        desc: "متابعة تجهيز الأطباق والطلبات",
      },
      {
        title: "متابعة الطلبات والديليفري",
        to: "/admin/restaurant",
        search: { tab: "orders" },
        icon: ClipboardList,
        desc: "الطلبات الجارية والتوصيل",
      },
      {
        title: "إدارة الطاولات والباركود QR",
        to: "/admin/restaurant",
        search: { tab: "tables" },
        icon: Grid3X3,
        desc: "تخطيط الصالة والباركود الذكي",
      },
      {
        title: "قائمة الطعام والوجبات (المنيو)",
        to: "/admin/menu",
        icon: Coffee,
        desc: "تعديل الأصناف والأسعار",
      },
      {
        title: "مستودع وخامات المطعم",
        to: "/admin/restaurant",
        search: { tab: "inventory" },
        icon: Package,
        desc: "المخزون الداخلي السريع",
      },
      {
        title: "إغلاق وردية كاشير المطعم",
        to: "/admin/restaurant",
        search: { tab: "shifts" },
        icon: History,
        desc: "تقارير وتصفية وردية الكاشير",
      },
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
      {
        title: "دليل المحلات والمستأجرين والعقود",
        to: "/admin/mall",
        search: { tab: "shops" },
        icon: Store,
        desc: "قائمة الوحدات والمستأجرين والعقود",
      },
      {
        title: "متابعة الإيجارات والدفعات الشهرية",
        to: "/admin/mall",
        search: { tab: "payments" },
        icon: Calendar,
        desc: "سجل التحصيل الشهري والمستحقات",
      },
      {
        title: "مصروفات وتشغيل وصيانة المول",
        to: "/admin/mall",
        search: { tab: "expenses" },
        icon: CreditCard,
        desc: "تكاليف التشغيل والصيانة والأمن",
      },
      {
        title: "التقارير المالية ونسب الإشغال",
        to: "/admin/mall",
        search: { tab: "reports" },
        icon: TrendingUp,
        desc: "الملخص الإحصائي والمالي للمول",
      },
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
      {
        title: "نقطة بيع تذاكر الدخول والألعاب (POS)",
        to: "/admin/park",
        search: { tab: "tickets" },
        icon: Ticket,
        desc: "إصدار تذاكر الدخول والباركود",
      },
      {
        title: "فتح وردية كاشير جديدة",
        to: "/admin/park",
        search: { tab: "shifts" },
        icon: Plus,
        desc: "إطلاق وردية كاشير مع العهدة النقدية",
      },
      {
        title: "إغلاق وتسوية وردية الكاشير",
        to: "/admin/park",
        search: { tab: "closing" },
        icon: History,
        desc: "تقارير الوردية والتسوية المالية",
      },
      {
        title: "الخزائن التشغيلية الثمانية (8)",
        to: "/admin/park",
        search: { tab: "treasury" },
        icon: Landmark,
        desc: "متابعة أرصدة صناديق الحديقة",
      },
      {
        title: "إدارة العملاء واشتراكات الزوار",
        to: "/admin/park",
        search: { tab: "customers" },
        icon: Users,
        desc: "سجل الزوار والعملاء الدائمين",
      },
      {
        title: "أسعار التذاكر وفئات الألعاب",
        to: "/admin/park",
        search: { tab: "prices" },
        icon: Settings,
        desc: "تحديد تعرفة الدخول والألعاب",
      },
      {
        title: "تقارير إيرادات الحديقة والورديات",
        to: "/admin/park",
        search: { tab: "reports" },
        icon: FileBarChart,
        desc: "إحصائيات المبيعات والتحصيل",
      },
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
      {
        title: "كشف حساب الأستاذ العام",
        to: "/admin/ledger",
        search: { tab: "ledger" },
        icon: BookOpen,
        desc: "كشف حساب مفصل وأرصدة الحسابات",
      },
      {
        title: "دفتر اليومية العامة والقيود المزدوجة",
        to: "/admin/ledger",
        search: { tab: "journal" },
        icon: FileText,
        desc: "تسجيل وترحيل قيود اليومية",
      },
      {
        title: "إدارة الخزائن والحسابات البنكية",
        to: "/admin/ledger",
        search: { tab: "treasury" },
        icon: Wallet,
        desc: "الصناديق النقدية وحركات الخزينة",
      },
      {
        title: "دليل وشجرة الحسابات (Oracle)",
        to: "/admin/ledger",
        search: { tab: "accounts" },
        icon: FileBarChart,
        desc: "شجرة الحسابات بالأصول والخصوم",
      },
      {
        title: "سندات الصرف والقبض المرحّلة",
        to: "/admin/ledger",
        search: { tab: "vouchers" },
        icon: Receipt,
        desc: "سندات الإيرادات والمصروفات",
      },
      {
        title: "ميزان المراجعة المحاسبي",
        to: "/admin/ledger",
        search: { tab: "trial" },
        icon: Scale,
        desc: "توازن الأرصدة والمجاميع",
      },
      {
        title: "التقارير والميزانية العمومية",
        to: "/admin/ledger",
        search: { tab: "reports" },
        icon: TrendingUp,
        desc: "قائمة الدخل والمركز المالي",
      },
      {
        title: "تصميم وإدارة الإيصالات والسندات",
        to: "/admin/receipts",
        icon: Receipt,
        desc: "نماذج الطباعة الرسمية",
      },
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
      {
        title: "سجل وبيانات الموظفين",
        to: "/admin/hr",
        search: { tab: "employees" },
        icon: Users,
        desc: "الملفات الشخصية والوظائف",
      },
      {
        title: "تسجيل الحضور والانصراف",
        to: "/admin/hr",
        search: { tab: "attendance" },
        icon: CalendarDays,
        desc: "متابعة أوقات العمل والورديات",
      },
      {
        title: "مسيرات الرواتب الشهرية والبدلات",
        to: "/admin/hr",
        search: { tab: "payroll" },
        icon: DollarSign,
        desc: "احتساب المستحقات الشهرية",
      },
      {
        title: "السلف والخصومات والمكافآت",
        to: "/admin/hr",
        search: { tab: "loans" },
        icon: Coins,
        desc: "حركات السلف والاستقطاعات",
      },
      {
        title: "إدارة مستخدمي النظام والصلاحيات",
        to: "/admin/hr",
        search: { tab: "users" },
        icon: ShieldCheck,
        desc: "تحديد أدوار الوصول وحسابات الدخول",
      },
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
      {
        title: "أصناف المخزون وجرد المستودع",
        to: "/admin/inventory",
        search: { tab: "items" },
        icon: Package,
        desc: "متابعة أرصدة المواد وتنبيهات النواقص",
      },
      {
        title: "التحويلات الداخلية بين المستودعات",
        to: "/admin/inventory",
        search: { tab: "transfers" },
        icon: ArrowLeftRight,
        desc: "نقل الخامات بين الفروع والمخازن",
      },
      {
        title: "فواتير المشتريات وسندات الاستلام",
        to: "/admin/inventory",
        search: { tab: "purchases" },
        icon: FileSpreadsheet,
        desc: "تسجيل فواتير الشراء الواردة",
      },
      {
        title: "إدارة الموردين والشركات",
        to: "/admin/inventory",
        search: { tab: "suppliers" },
        icon: Users,
        desc: "بيانات وحسابات الموردين",
      },
      {
        title: "تسويات الهالك والتوالف",
        to: "/admin/inventory",
        search: { tab: "waste" },
        icon: Trash2,
        desc: "إثبات الفاقد وتكلفة الهدر",
      },
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
      {
        title: "تحديثات النظام ومزامنة GitHub",
        to: "/admin/system-update",
        icon: RefreshCw,
        desc: "الإصدار والتحديثات التلقائية",
      },
      {
        title: "سجل تدقيق العمليات (Audit Logs)",
        to: "/admin",
        search: { tab: "audit_logs" },
        icon: History,
        desc: "تتبع كل الحركات المالية والإدارية",
      },
      {
        title: "تدقيق الورديات (Supabase Audit)",
        to: "/admin",
        search: { tab: "shift_audit" },
        icon: Database,
        desc: "فحص ومطابقة الورديات المسجلة",
      },
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
              onClick={() => navigate({ to: dept.to })}
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
