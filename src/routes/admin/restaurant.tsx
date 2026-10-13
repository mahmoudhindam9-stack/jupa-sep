import { createFileRoute, useNavigate, useLocation } from "@tanstack/react-router";
import { DepartmentSubpagesGrid } from "@/components/admin/DepartmentsGridHub";
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
      const localMenuRaw = localStorage.getItem("local_custom_menu_items");
      const localDeletedItemsRaw = localStorage.getItem("local_deleted_menu_items");
      const localDeletedItems = new Set<string>(
        localDeletedItemsRaw ? JSON.parse(localDeletedItemsRaw) : [],
      );

      if (localMenuRaw) {
        const parsed = JSON.parse(localMenuRaw);
        if (parsed && typeof parsed === "object") {
          const items = Array.isArray(parsed) ? parsed : Object.values(parsed);
          const activeItems = items.filter(
            (item: any) => item?.id && !localDeletedItems.has(item.id),
          );
          if (activeItems.length > 0) {
            menu = activeItems.length;
          } else if (localDeletedItems.size > 0) {
            menu = 0;
          }
        }
      }
    } catch (err) {
      console.warn("Local menu parse notice:", err);
    }

    try {
      const localInv = localStorage.getItem("ydb_inventory_items_v2");
      if (localInv) {
        const parsed = JSON.parse(localInv);
        if (Array.isArray(parsed)) {
          inventory = parsed.length;
        }
      }
    } catch (err) {
      console.warn("Local inventory parse notice:", err);
    }

    try {
      const localOrders = localStorage.getItem("restocash_table_orders_v1");
      if (localOrders) {
        const parsed = JSON.parse(localOrders);
        if (Array.isArray(parsed)) {
          orders = parsed.length;
        }
      }
    } catch (err) {
      console.warn("Local orders parse notice:", err);
    }
  }

  return { menu, inventory, orders };
}

function RestaurantHubPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeTab = new URLSearchParams(location.search).get("tab");
  const [counts, setCounts] = useState<RestaurantCounts>({ menu: 8, inventory: 6, orders: 0 });
  const [isLauncherOpen, setIsLauncherOpen] = useState(false);
  const [closingShift, setClosingShift] = useState<RestaurantShift | null>(null);

  useEffect(() => {
    if (routeTab === "shifts") setIsLauncherOpen(true);
  }, [routeTab]);

  useEffect(() => {
    let active = true;
    setCounts(getSyncCounts());

    async function fetchLiveCounts() {
      if (!active) return;

      const [menuRes, invRes, ordersRes] = await Promise.allSettled([
        menuService.getMenuItems(),
        inventoryService.getInventory(),
        (async () => {
          try {
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error("orders timeout")), 1500),
            );
            const queryPromise = supabase
              .from("orders")
              .select("id", { count: "exact", head: true });
            const { count } = (await Promise.race([queryPromise, timeoutPromise])) as any;
            return count ?? 0;
          } catch {
            return 0;
          }
        })(),
      ]);

      const sync = getSyncCounts();

      const menuCount =
        menuRes.status === "fulfilled" && Array.isArray(menuRes.value)
          ? menuRes.value.length
          : sync.menu;

      const invCount =
        invRes.status === "fulfilled" && Array.isArray(invRes.value)
          ? invRes.value.length
          : sync.inventory;

      const dbOrders = ordersRes.status === "fulfilled" ? ordersRes.value : 0;
      const localOrders = tableOrdersStore.getAllOrders().length;
      const totalOrders = Math.max(dbOrders + localOrders, sync.orders);

      if (active) {
        setCounts({
          menu: menuCount,
          inventory: invCount,
          orders: totalOrders,
        });
      }
    }

    fetchLiveCounts();

    const handleUpdate = () => {
      fetchLiveCounts();
    };

    window.addEventListener("menu_updated", handleUpdate);
    window.addEventListener("inventory_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    window.addEventListener("focus", handleUpdate);

    const unsubscribeTableOrders = tableOrdersStore.subscribe(() => {
      handleUpdate();
    });

    const unsubscribeErp = erpStore.subscribe(() => {
      handleUpdate();
    });

    if (routeTab === "grid") return <DepartmentSubpagesGrid departmentId="restaurant" />;

  return () => {
      active = false;
      window.removeEventListener("menu_updated", handleUpdate);
      window.removeEventListener("inventory_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
      window.removeEventListener("focus", handleUpdate);
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
