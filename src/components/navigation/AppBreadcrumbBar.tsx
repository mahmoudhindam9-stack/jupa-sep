import React, { useMemo } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  ChevronLeft,
  ArrowRight,
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
  Coffee,
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
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbNode {
  label: string;
  to?: string;
  search?: Record<string, string>;
  icon?: LucideIcon;
  isLeaf?: boolean;
}

export interface AppBreadcrumbBarProps {
  /** Optional custom section override */
  customSection?: {
    label: string;
    to: string;
    icon?: LucideIcon;
  };
  /** Optional custom subsection override */
  customSubsection?: {
    label: string;
    icon?: LucideIcon;
  };
  className?: string;
}

export function AppBreadcrumbBar({
  customSection,
  customSubsection,
  className,
}: AppBreadcrumbBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const activeTab = searchParams.get("tab") || "";

  // Compute breadcrumb trail based on current path and search params
  const breadcrumbs = useMemo<BreadcrumbNode[] | null>(() => {
    // If we're at the root /admin and have no tab, do NOT show the breadcrumb bar
    if ((pathname === "/admin" || pathname === "/admin/" || pathname === "/") && !activeTab) {
      return null;
    }

    // Allow custom override if provided
    if (customSection) {
      const nodes: BreadcrumbNode[] = [
        {
          label: "لوحة الأقسام",
          to: "/admin",
          icon: Grid3X3,
        },
        {
          label: customSection.label,
          to: customSubsection ? customSection.to : undefined,
          icon: customSection.icon,
          isLeaf: !customSubsection,
        },
      ];
      if (customSubsection) {
        nodes.push({
          label: customSubsection.label,
          icon: customSubsection.icon,
          isLeaf: true,
        });
      }
      return nodes;
    }

    // 1. Restaurant Section (/admin/restaurant and related standalone screens)
    if (
      pathname.startsWith("/admin/restaurant") ||
      pathname === "/pos" ||
      pathname === "/captain" ||
      pathname === "/oven" ||
      pathname === "/cashier-treasury" ||
      pathname === "/admin/orders" ||
      pathname === "/admin/menu"
    ) {
      const baseNode: BreadcrumbNode = {
        label: "إدارة المطعم",
        to: "/admin/restaurant",
        icon: Store,
      };

      let subNode: BreadcrumbNode | null = null;

      if (pathname === "/pos") {
        subNode = {
          label: "نقطة بيع الكاشير (POS)",
          icon: CreditCard,
          isLeaf: true,
        };
      } else if (pathname === "/captain") {
        subNode = {
          label: "شاشة الكابتن والصالة",
          icon: Users,
          isLeaf: true,
        };
      } else if (pathname === "/oven") {
        subNode = {
          label: "شاشة المطبخ والفرن (KDS)",
          icon: Flame,
          isLeaf: true,
        };
      } else if (pathname === "/cashier-treasury") {
        subNode = {
          label: "شاشة الكاشير والخزينة",
          icon: Wallet,
          isLeaf: true,
        };
      } else if (pathname.startsWith("/admin/orders")) {
        subNode = {
          label: "سجل الطلبات والفواتير",
          icon: ClipboardList,
          isLeaf: true,
        };
      } else if (pathname.startsWith("/admin/menu")) {
        subNode = {
          label: "إدارة المنيو وقائمة الطعام والتكلفة",
          icon: Utensils,
          isLeaf: true,
        };
      } else if (activeTab === "vouchers") {
        subNode = {
          label: "سندات الصرف والقبض",
          icon: Receipt,
          isLeaf: true,
        };
      } else if (activeTab === "shifts") {
        subNode = {
          label: "ورديات كاشير المطعم",
          icon: Clock,
          isLeaf: true,
        };
      } else if (activeTab === "expenses") {
        subNode = {
          label: "مصروفات وتسويات المطعم",
          icon: DollarSign,
          isLeaf: true,
        };
      }

      return [
        { label: "لوحة الأقسام", to: "/admin", icon: Grid3X3 },
        subNode ? { ...baseNode, isLeaf: false } : { ...baseNode, to: undefined, isLeaf: true },
        ...(subNode ? [subNode] : []),
      ];
    }

    // 2. Mall Section (/admin/mall)
    if (pathname.startsWith("/admin/mall")) {
      const baseNode: BreadcrumbNode = {
        label: "إدارة المول",
        to: "/admin/mall",
        icon: Building2,
      };

      let subNode: BreadcrumbNode | null = null;
      if (activeTab === "shops") {
        subNode = {
          label: "دليل المحلات والمستأجرين",
          icon: Store,
          isLeaf: true,
        };
      } else if (activeTab === "payments") {
        subNode = {
          label: "متابعة عقود الإيجار والدفعات",
          icon: Calendar,
          isLeaf: true,
        };
      } else if (activeTab === "expenses") {
        subNode = {
          label: "مصروفات وتشغيل المول",
          icon: CreditCard,
          isLeaf: true,
        };
      } else if (activeTab === "reports") {
        subNode = {
          label: "التقارير المالية وإشغال المول",
          icon: TrendingUp,
          isLeaf: true,
        };
      } else if (activeTab === "garden") {
        subNode = {
          label: "الحديقة والمرافق الترفيهية",
          icon: Trees,
          isLeaf: true,
        };
      }

      return [
        { label: "لوحة الأقسام", to: "/admin", icon: Grid3X3 },
        subNode ? { ...baseNode, isLeaf: false } : { ...baseNode, to: undefined, isLeaf: true },
        ...(subNode ? [subNode] : []),
      ];
    }

    // 3. Park Section (/admin/park)
    if (pathname.startsWith("/admin/park")) {
      const baseNode: BreadcrumbNode = {
        label: "إدارة الحديقة",
        to: "/admin/park",
        icon: Trees,
      };

      let subNode: BreadcrumbNode | null = null;
      if (activeTab === "tickets") {
        subNode = {
          label: "نقطة بيع تذاكر الحديقة (POS)",
          icon: Ticket,
          isLeaf: true,
        };
      } else if (activeTab === "shifts") {
        subNode = {
          label: "ورديات كاشير الحديقة",
          icon: Clock,
          isLeaf: true,
        };
      } else if (activeTab === "treasury") {
        subNode = {
          label: "الخزائن التشغيلية الثمانية",
          icon: Landmark,
          isLeaf: true,
        };
      } else if (activeTab === "prices") {
        subNode = {
          label: "أسعار وتصنيفات التذاكر",
          icon: Settings,
          isLeaf: true,
        };
      } else if (activeTab === "customers") {
        subNode = {
          label: "دليل عملاء الحديقة",
          icon: Users,
          isLeaf: true,
        };
      } else if (activeTab === "reports") {
        subNode = {
          label: "تقارير مبيعات وإيرادات الحديقة",
          icon: TrendingUp,
          isLeaf: true,
        };
      } else if (activeTab === "overview") {
        subNode = {
          label: "لوحة المؤشرات والملخص",
          icon: LayoutDashboard,
          isLeaf: true,
        };
      }

      return [
        { label: "لوحة الأقسام", to: "/admin", icon: Grid3X3 },
        subNode ? { ...baseNode, isLeaf: false } : { ...baseNode, to: undefined, isLeaf: true },
        ...(subNode ? [subNode] : []),
      ];
    }

    // 4. Ledger & Financial Section (/admin/ledger, /admin/accounts, /admin/receipts, /admin/reports)
    if (
      pathname.startsWith("/admin/ledger") ||
      pathname.startsWith("/admin/accounts") ||
      pathname.startsWith("/admin/receipts") ||
      pathname.startsWith("/admin/reports")
    ) {
      const baseNode: BreadcrumbNode = {
        label: "الإدارة المالية",
        to: "/admin/ledger",
        icon: Landmark,
      };

      let subNode: BreadcrumbNode | null = null;
      if (pathname.startsWith("/admin/accounts") || activeTab === "accounts") {
        subNode = {
          label: "دليل وشجرة الحسابات",
          icon: Layers,
          isLeaf: true,
        };
      } else if (pathname.startsWith("/admin/receipts")) {
        subNode = {
          label: "تصميم وإدارة الإيصالات والسندات",
          icon: Receipt,
          isLeaf: true,
        };
      } else if (pathname.startsWith("/admin/reports") || activeTab === "reports") {
        subNode = {
          label: "التقارير والقوائم المالية",
          icon: BarChart3,
          isLeaf: true,
        };
      } else if (activeTab === "ledger") {
        subNode = {
          label: "كشف حساب الأستاذ العام",
          icon: BookOpen,
          isLeaf: true,
        };
      } else if (activeTab === "journal") {
        subNode = {
          label: "دفتر اليومية العامة",
          icon: FileText,
          isLeaf: true,
        };
      } else if (activeTab === "vouchers") {
        subNode = {
          label: "سندات الصرف والقبض",
          icon: DollarSign,
          isLeaf: true,
        };
      } else if (activeTab === "treasury") {
        subNode = {
          label: "إدارة الخزائن والصناديق",
          icon: Wallet,
          isLeaf: true,
        };
      } else if (activeTab === "trial") {
        subNode = {
          label: "ميزان المراجعة بالأرصدة والمجاميع",
          icon: Scale,
          isLeaf: true,
        };
      }

      return [
        { label: "لوحة الأقسام", to: "/admin", icon: Grid3X3 },
        subNode ? { ...baseNode, isLeaf: false } : { ...baseNode, to: undefined, isLeaf: true },
        ...(subNode ? [subNode] : []),
      ];
    }

    // 5. HR & Users Section (/admin/hr, /admin/users)
    if (pathname.startsWith("/admin/hr") || pathname.startsWith("/admin/users")) {
      const baseNode: BreadcrumbNode = {
        label: "الموارد البشرية والمستخدمين",
        to: "/admin/hr",
        icon: UserCheck,
      };

      let subNode: BreadcrumbNode | null = null;
      if (pathname.startsWith("/admin/users") || activeTab === "users") {
        subNode = {
          label: "المستخدمين والصلاحيات (ACL)",
          icon: ShieldCheck,
          isLeaf: true,
        };
      } else if (activeTab === "employees") {
        subNode = {
          label: "دليل الكادر والموظفين",
          icon: Users,
          isLeaf: true,
        };
      } else if (activeTab === "attendance") {
        subNode = {
          label: "حضور وانصراف اليوم",
          icon: CalendarDays,
          isLeaf: true,
        };
      } else if (activeTab === "payroll") {
        subNode = {
          label: "مسيرات الأجور والرواتب",
          icon: FileSpreadsheet,
          isLeaf: true,
        };
      } else if (activeTab === "loans") {
        subNode = {
          label: "القروض والسلف المالية",
          icon: Coins,
          isLeaf: true,
        };
      }

      return [
        { label: "لوحة الأقسام", to: "/admin", icon: Grid3X3 },
        subNode ? { ...baseNode, isLeaf: false } : { ...baseNode, to: undefined, isLeaf: true },
        ...(subNode ? [subNode] : []),
      ];
    }

    // 6. Inventory Section (/admin/inventory)
    if (pathname.startsWith("/admin/inventory")) {
      const baseNode: BreadcrumbNode = {
        label: "المخزون والمستودعات",
        to: "/admin/inventory",
        icon: Package,
      };

      let subNode: BreadcrumbNode | null = null;
      if (activeTab === "items") {
        subNode = {
          label: "الأصناف والمواد الخام",
          icon: Package,
          isLeaf: true,
        };
      } else if (activeTab === "transfers") {
        subNode = {
          label: "المستودعات وحركات التحويل",
          icon: ArrowLeftRight,
          isLeaf: true,
        };
      } else if (activeTab === "purchases") {
        subNode = {
          label: "فواتير المشتريات والموردين",
          icon: ShoppingCart,
          isLeaf: true,
        };
      } else if (activeTab === "waste") {
        subNode = {
          label: "محاضر الهالك والتسويات الجردية",
          icon: AlertCircle,
          isLeaf: true,
        };
      } else if (activeTab === "suppliers") {
        subNode = {
          label: "الموردين وحسابات الشراء",
          icon: Users,
          isLeaf: true,
        };
      }

      return [
        { label: "لوحة الأقسام", to: "/admin", icon: Grid3X3 },
        subNode ? { ...baseNode, isLeaf: false } : { ...baseNode, to: undefined, isLeaf: true },
        ...(subNode ? [subNode] : []),
      ];
    }

    // 7. System Update & Audit Section (/admin/system-update)
    if (pathname.startsWith("/admin/system-update")) {
      const baseNode: BreadcrumbNode = {
        label: "خيارات المطور والرقابة",
        to: "/admin/system-update",
        icon: Settings,
      };

      let subNode: BreadcrumbNode | null = null;
      if (activeTab === "audit") {
        subNode = {
          label: "سجل تدقيق ورقابة العمليات",
          icon: History,
          isLeaf: true,
        };
      } else if (activeTab === "sync") {
        subNode = {
          label: "مزامنة GitHub وتحديثات النظام",
          icon: RefreshCw,
          isLeaf: true,
        };
      } else if (activeTab === "status") {
        subNode = {
          label: "معلومات وحالة الخادم",
          icon: ShieldCheck,
          isLeaf: true,
        };
      }

      return [
        { label: "لوحة الأقسام", to: "/admin", icon: Grid3X3 },
        subNode ? { ...baseNode, isLeaf: false } : { ...baseNode, to: undefined, isLeaf: true },
        ...(subNode ? [subNode] : []),
      ];
    }

    // Developer Studio Pro (/admin/studio)
    if (pathname.startsWith("/admin/studio")) {
      return [
        { label: "لوحة الأقسام", to: "/admin", icon: Grid3X3 },
        { label: "خيارات النظام والمطور", to: "/admin/system-update", icon: Settings },
        { label: "استوديو المطور Pro (المحرر البصري)", isLeaf: true, icon: Sparkles },
      ];
    }

    // 8. Handle any other subpath or tab
    if (pathname.startsWith("/admin/")) {
      const segment = pathname.replace("/admin/", "").split("/")[0];
      const fallbackTitle = segment || "القسم الحالي";
      return [
        { label: "لوحة الأقسام", to: "/admin", icon: Grid3X3 },
        { label: fallbackTitle, isLeaf: true },
      ];
    }

    if (activeTab) {
      return [
        { label: "لوحة الأقسام", to: "/admin", icon: Grid3X3 },
        { label: `قسم: ${activeTab}`, isLeaf: true },
      ];
    }

    return null;
  }, [pathname, activeTab, customSection, customSubsection]);

  // If no breadcrumbs (e.g. root dashboard without tab), render nothing
  if (!breadcrumbs || breadcrumbs.length === 0) {
    return null;
  }

  // Handle quick back button
  const handleQuickBack = () => {
    // If we're on a subsection (length > 2) and have a parent section
    if (breadcrumbs.length >= 3 && breadcrumbs[1]?.to) {
      navigate({ to: breadcrumbs[1].to });
    } else {
      // Return to main dashboard
      navigate({ to: "/admin" });
    }
  };

  return (
    <nav
      aria-label="مسار التنقل الهرمي"
      className={cn(
        "shrink-0 z-25 bg-card/95 backdrop-blur border-b border-border/80 px-3 sm:px-6 py-2 shadow-xs transition-all",
        className,
      )}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs sm:text-sm">
        {/* Breadcrumb Hierarchy Trail with Directional Arrows */}
        <ol className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0" role="list">
          {breadcrumbs.map((node, index) => {
            const isLast = index === breadcrumbs.length - 1;
            const Icon = node.icon;

            return (
              <li
                key={`${node.label}-${index}`}
                className="flex items-center gap-1.5 sm:gap-2 shrink-0"
              >
                {/* Arrow separator showing the network / tree hierarchy between steps */}
                {index > 0 && (
                  <ChevronLeft
                    size={16}
                    className="text-muted-foreground/60 shrink-0 select-none rtl:rotate-0 ltr:rotate-180"
                    aria-hidden="true"
                  />
                )}

                {/* Breadcrumb item */}
                {isLast ? (
                  <span
                    aria-current="page"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-black text-primary bg-primary/10 border border-primary/20 shadow-2xs max-w-[240px] sm:max-w-none truncate"
                  >
                    {Icon && <Icon size={15} className="shrink-0 text-primary" />}
                    <span className="truncate">{node.label}</span>
                  </span>
                ) : node.to ? (
                  <Link
                    to={node.to}
                    search={node.search}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg font-bold text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer"
                  >
                    {Icon && (
                      <Icon
                        size={15}
                        className={cn(
                          "shrink-0",
                          index === 0 ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                    )}
                    <span>{node.label}</span>
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1.5 font-bold text-muted-foreground px-2 py-1">
                    {Icon && <Icon size={15} className="shrink-0" />}
                    <span>{node.label}</span>
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        {/* Quick Back Action Button */}
        <div className="shrink-0 flex items-center gap-2">
          <button
            type="button"
            onClick={handleQuickBack}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg border border-border/60 transition-colors cursor-pointer shadow-2xs"
            title={
              breadcrumbs.length >= 3
                ? `العودة إلى ${breadcrumbs[1]?.label || "القسم السابق"}`
                : "العودة إلى لوحة الأقسام"
            }
          >
            <ArrowRight size={14} className="shrink-0" />
            <span className="hidden sm:inline">
              {breadcrumbs.length >= 3 ? "العودة للقسم" : "العودة للرئيسية"}
            </span>
            <span className="sm:hidden">رجوع</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
