import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ClipboardList,
  Clock,
  Grid3X3,
  Package,
  Receipt,
  Sparkles,
  Store,
  Utensils,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { erpStore, RestaurantShift } from "@/shared/services/erpStore";
import { RestaurantShiftLauncherModal } from "@/components/restaurant/RestaurantShiftLauncherModal";
import { RestaurantShiftClosingReportModal } from "@/components/restaurant/RestaurantShiftClosingReportModal";
import { menuService } from "@/features/menu/services/menuService";
import { inventoryService } from "@/features/inventory/services/inventoryService";
import { tableOrdersStore } from "@/shared/services/tableOrdersStore";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/restaurant")({
  head: () => ({ meta: [{ title: "إدارة المطعم - النظام الشامل" }] }),
  component: RestaurantHubPage,
});

type RestaurantCounts = {
  menu: number;
  inventory: number;
  orders: number;
};

function getSyncCounts(): RestaurantCounts {
  let menu = 8;
  let inventory = 6;
  let orders = 0;

  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    try {
      const localMenu = localStorage.getItem("local_custom_menu_items");
      if (localMenu) {
        const parsed = JSON.parse(localMenu);
        menu = Object.keys(parsed).length;
      }
    } catch {}

    try {
      const localInv = localStorage.getItem("ydb_inventory_items_v2");
      if (localInv) {
        const parsed = JSON.parse(localInv);
        if (Array.isArray(parsed)) {
          inventory = parsed.length;
        }
      }
    } catch {}

    try {
      const localOrders = localStorage.getItem("restocash_table_orders_v1");
      if (localOrders) {
        const parsed = JSON.parse(localOrders);
        if (Array.isArray(parsed)) {
          orders = parsed.length;
        }
      }
    } catch {}
  }

  return { menu, inventory, orders };
}

function RestaurantHubPage() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState<RestaurantCounts>(getSyncCounts);
  const [isLauncherOpen, setIsLauncherOpen] = useState(false);
  const [closingShift, setClosingShift] = useState<RestaurantShift | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchLiveCounts() {
      try {
        // Fetch Menu Items count
        const menuItems = await menuService.getMenuItems();
        
        // Fetch Inventory Items count
        const inventoryItems = await inventoryService.getInventory();

        // Fetch Orders Count from Supabase
        const { count: dbOrdersCount } = await supabase
          .from("orders")
          .select("id", { count: "exact", head: true });

        // Fetch Local Orders Count
        const localOrdersCount = tableOrdersStore.getAllOrders().length;

        const totalOrders = (dbOrdersCount ?? 0) + localOrdersCount;

        if (active) {
          setCounts({
            menu: menuItems.length,
            inventory: inventoryItems.length,
            orders: totalOrders,
          });
        }
      } catch (err) {
        console.error("Error fetching live restaurant counts:", err);
      }
    }

    fetchLiveCounts();

    // Subscribe to local order updates to live-update counts
    const unsubscribeTableOrders = tableOrdersStore.subscribe(() => {
      fetchLiveCounts();
    });

    // Subscribe to ERP store changes to keep sync
    const unsubscribeErp = erpStore.subscribe(() => {
      fetchLiveCounts();
    });

    return () => {
      active = false;
      unsubscribeTableOrders();
      unsubscribeErp();
    };
  }, []);

  const modules = [
    {
      title: "نقطة البيع (POS)",
      description: "شاشة البيع السريعة لإدخال الطلبات، الدفع، وطباعة الفواتير",
      action: () => setIsLauncherOpen(true),
      icon: Grid3X3,
      color: "from-blue-500/20 to-indigo-500/20 text-blue-600 dark:text-blue-400",
      badge: "الرئيسية",
      stats: "مبيعات سريعة",
    },
    {
      title: "شاشة الكاشير والخزينة",
      description: "إدارة النقدية اليومية، فتح وإغلاق الشيفتات، وحركات الخزينة",
      to: "/cashier-treasury",
      icon: Wallet,
      color: "from-emerald-500/25 to-teal-500/25 text-emerald-600 dark:text-emerald-400",
      badge: "مالي",
      stats: "الخزينة والشيفتات",
    },
    {
      title: "شاشة المطبخ (الفرن)",
      description: "متابعة الطلبات الواردة للمطبخ والفرن وأوقات التجهيز الفعلي",
      to: "/oven",
      icon: UtensilsCrossed,
      color: "from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-400",
      badge: "تشغيل",
      stats: "المطبخ والفرن",
    },
    {
      title: "شاشة طلبات العملاء (Captain)",
      description: "تسجيل طلبات الطاولات والصالة بواسطة الكابتن والويتر",
      to: "/captain",
      icon: ClipboardList,
      color: "from-purple-500/20 to-pink-500/20 text-purple-600 dark:text-purple-400",
      badge: "الصالة",
      stats: "طلبات الكابتن",
    },
    {
      title: "إدارة الطلبات والفواتير",
      description: "سجل كامل للطلبات، متابعة الحالات، وتعديل أو إلغاء الطلبات",
      to: "/admin/orders",
      icon: Receipt,
      color: "from-cyan-500/20 to-blue-500/20 text-cyan-600 dark:text-cyan-400",
      badge: "متابعة",
      stats: `${counts.orders} طلب مسجل`,
    },
    {
      title: "إدارة المنيو والأصناف",
      description: "إضافة وتعديل الأقسام، الأسعار، الشعارات، والمكونات",
      to: "/admin/menu",
      icon: Utensils,
      color: "from-rose-500/20 to-red-500/20 text-rose-600 dark:text-rose-400",
      badge: "القائمة",
      stats: `${counts.menu} صنف في المنيو`,
    },
    {
      title: "المخزن والمستودع",
      description: "متابعة أرصدة المواد الخام، الوارد والصادر، وجرد المستودع",
      to: "/admin/inventory",
      icon: Package,
      color: "from-amber-600/20 to-yellow-600/20 text-amber-700 dark:text-amber-400",
      badge: "المخزون",
      stats: `${counts.inventory} صنف مخزني`,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-l from-slate-900 via-slate-800 to-indigo-950 p-6 text-white shadow-xl sm:p-8">
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-amber-300 backdrop-blur-md">
              <Sparkles size={14} aria-hidden="true" />
              <span>نظام إدارة المطاعم المتقدم</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              إدارة تشغيل المطعم بالكامل
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-300">
              منصة مركزية متكاملة للكاشير، نقاط البيع، المطبخ، المنيو والمخزن. اختر القسم الذي تريد
              فتحه مباشرة.
            </p>
          </div>
          <Button
            onClick={() => setIsLauncherOpen(true)}
            className="w-full gap-2 bg-primary font-black text-primary-foreground shadow-lg hover:bg-primary/90 sm:w-auto"
          >
            <Grid3X3 size={18} aria-hidden="true" />
            فتح نقطة البيع الآن
          </Button>
        </div>
      </section>

      <section aria-labelledby="restaurant-modules-heading">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2
            id="restaurant-modules-heading"
            className="flex items-center gap-2 text-lg font-black text-foreground"
          >
            <Store size={20} className="text-primary" aria-hidden="true" />
            أقسام نظام تشغيل المطعم
          </h2>
          <span className="text-xs font-bold text-muted-foreground">
            {modules.length} أقسام أساسية
          </span>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => {
            const Icon = module.icon;
            const Component = module.action ? "button" : "a";
            const props = module.action
              ? { onClick: module.action, type: "button" }
              : { href: module.to };

            return (
              <div
                key={module.title}
                className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Card
                  onClick={module.action}
                  className={`flex h-full flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm transition-all duration-300 group-hover:border-primary/50 group-hover:bg-accent/30 group-hover:shadow-xl ${module.action ? "cursor-pointer" : ""}`}
                >
                  {!module.action && (
                    // @ts-ignore
                    <a href={module.to} className="contents">
                      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                        <div
                          className={`rounded-2xl bg-gradient-to-br p-3 shadow-inner ${module.color}`}
                        >
                          <Icon size={24} aria-hidden="true" />
                        </div>
                        <span className="rounded-full border border-border/60 bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                          {module.badge}
                        </span>
                      </CardHeader>
                      <CardContent className="flex flex-1 flex-col justify-between space-y-4 pt-1">
                        <div className="space-y-1.5">
                          <h3 className="flex items-center justify-between gap-3 text-lg font-black text-foreground transition group-hover:text-primary">
                            <span>{module.title}</span>
                            <ArrowUpRight
                              size={18}
                              className="shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100"
                              aria-hidden="true"
                            />
                          </h3>
                          <CardDescription className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {module.description}
                          </CardDescription>
                        </div>
                        <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs font-bold text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5 font-black text-primary">
                            <Clock size={13} aria-hidden="true" />
                            {module.stats}
                          </span>
                          <span className="inline-flex items-center gap-1 text-primary">
                            فتح الواجهة
                            <ArrowUpRight size={14} aria-hidden="true" />
                          </span>
                        </div>
                      </CardContent>
                    </a>
                  )}
                  {module.action && (
                    <>
                      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                        <div
                          className={`rounded-2xl bg-gradient-to-br p-3 shadow-inner ${module.color}`}
                        >
                          <Icon size={24} aria-hidden="true" />
                        </div>
                        <span className="rounded-full border border-border/60 bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                          {module.badge}
                        </span>
                      </CardHeader>
                      <CardContent className="flex flex-1 flex-col justify-between space-y-4 pt-1">
                        <div className="space-y-1.5">
                          <h3 className="flex items-center justify-between gap-3 text-lg font-black text-foreground transition group-hover:text-primary">
                            <span>{module.title}</span>
                            <ArrowUpRight
                              size={18}
                              className="shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100"
                              aria-hidden="true"
                            />
                          </h3>
                          <CardDescription className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {module.description}
                          </CardDescription>
                        </div>
                        <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs font-bold text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5 font-black text-primary">
                            <Clock size={13} aria-hidden="true" />
                            {module.stats}
                          </span>
                          <span className="inline-flex items-center gap-1 text-primary">
                            فتح الواجهة
                            <ArrowUpRight size={14} aria-hidden="true" />
                          </span>
                        </div>
                      </CardContent>
                    </>
                  )}
                </Card>
              </div>
            );
          })}
        </div>
      </section>

      <RestaurantShiftLauncherModal
        isOpen={isLauncherOpen}
        onClose={() => setIsLauncherOpen(false)}
        onRequestCloseShift={(shift) => {
          setIsLauncherOpen(false);
          setClosingShift(shift);
        }}
      />

      {closingShift && (
        <RestaurantShiftClosingReportModal
          isOpen={!!closingShift}
          onClose={() => setClosingShift(null)}
          shift={closingShift}
          onReportCompleted={() => {
            setClosingShift(null);
            // Return to restaurant hub is automatic if it closes the modal,
            // and we aren't opening a new shift automatically.
          }}
        />
      )}
    </div>
  );
}
