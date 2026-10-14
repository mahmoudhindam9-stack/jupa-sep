import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
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
import { VouchersLedgerSection } from "@/components/admin/VouchersLedgerSection";

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
  const [counts, setCounts] = useState<RestaurantCounts>({ menu: 8, inventory: 6, orders: 0 });
  const [isLauncherOpen, setIsLauncherOpen] = useState(false);
  const [closingShift, setClosingShift] = useState<RestaurantShift | null>(null);
  const [activeTab, setActiveTab] = useState<"grid" | "vouchers">("grid");

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
      title: "سندات الصرف والقبض",
      description: "إصدار وتسجيل سندات الصرف والقبض الخاصة بإدارة المطعم وتوليد القيود",
      action: () => setActiveTab("vouchers"),
      icon: Receipt,
      color: "from-emerald-500/25 to-teal-500/25 text-emerald-600 dark:text-emerald-400",
      badge: "سندات مالية",
      stats: "إدارة السندات",
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
      {/* Page Header & Quick Launch Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground">إدارة وتشغيل المطعم</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            نظام تشغيل المطعم، نقاط البيع، المطبخ، الصالة، والورديات اليومية
          </p>
        </div>
        <Button
          onClick={() => setIsLauncherOpen(true)}
          className="gap-2 bg-primary font-black text-primary-foreground shadow-sm rounded-xl text-xs h-9 self-start sm:self-auto cursor-pointer"
        >
          <Grid3X3 size={16} />
          فتح نقطة البيع (POS)
        </Button>
      </div>

      {activeTab === "vouchers" ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between bg-card p-4 rounded-2xl border border-border shadow-xs">
            <Button
              onClick={() => setActiveTab("grid")}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs md:text-sm shadow-md cursor-pointer"
            >
              <ArrowRight size={18} />
              <span>الرجوع لأقسام المطعم الرئيسية</span>
            </Button>
            <h3 className="text-base font-black text-foreground flex items-center gap-2">
              <Receipt className="text-emerald-600" size={20} />
              <span>سندات الصرف والقبض الرسمية - إدارة المطعم</span>
            </h3>
          </div>
          <VouchersLedgerSection
            defaultCostCenter="إدارة المطعم (Restaurant Management)"
            departmentTitle="المطعم والمأكولات"
          />
        </div>
      ) : (
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
      )}

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
