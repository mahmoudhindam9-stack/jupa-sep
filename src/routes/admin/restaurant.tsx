import { createFileRoute, useNavigate, useLocation } from "@tanstack/react-router";
import { extractTabParam, useSyncedSubTab } from "@/components/navigation/navigationRegistry";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ClipboardList,
  Clock,
  Edit,
  Eye,
  FileBarChart,
  FileSpreadsheet,
  Grid3X3,
  History,
  Landmark,
  Lock,
  Package,
  Play,
  Plus,
  Receipt,
  Settings,
  ShoppingBag,
  Store,
  Trash2,
  UserCheck,
  Utensils,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ViewModeToggle, useViewMode } from "@/components/ui/view-mode-toggle";
import { erpStore, RestaurantShift } from "@/shared/services/erpStore";
import { shiftAuditService } from "@/features/shifts/services/shiftAuditService";
import { RestaurantShiftLauncherModal } from "@/components/restaurant/RestaurantShiftLauncherModal";
import { RestaurantShiftClosingReportModal } from "@/components/restaurant/RestaurantShiftClosingReportModal";
import { ShiftAuditLogViewerModal } from "@/components/admin/ShiftAuditLogViewerModal";
import { menuService } from "@/features/menu/services/menuService";
import { inventoryService } from "@/features/inventory/services/inventoryService";
import { tableOrdersStore } from "@/shared/services/tableOrdersStore";
import { supabase } from "@/integrations/supabase/client";
import {
  getActiveUserPermissionsSync,
  getCurrentUserIdentitySync,
  hasAnyRequestedPermission,
  PERMISSIONS_UPDATED_EVENT,
} from "@/shared/services/userAuthorization";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/restaurant")({
  head: () => ({ meta: [{ title: "إدارة المطعم" }] }),
  component: RestaurantHubPage,
});

type RestaurantCounts = {
  menu: number;
  inventory: number;
  orders: number;
};

type RestaurantSectionTab = "definitions" | "operations" | "reports";

function resolveRestaurantTab(tabParam: string | undefined): RestaurantSectionTab {
  if (!tabParam) return "operations";
  if (
    tabParam === "definitions" ||
    tabParam === "menu" ||
    tabParam === "tables" ||
    tabParam === "inventory"
  ) {
    return "definitions";
  }
  if (tabParam === "reports") {
    return "reports";
  }
  return "operations";
}

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
  const tabParam = extractTabParam(location.search, (location as any).searchStr);
  const [counts, setCounts] = useState<RestaurantCounts>({ menu: 8, inventory: 6, orders: 0 });
  const [erpState, setErpState] = useState(() => erpStore.getState());
  const [isLauncherOpen, setIsLauncherOpen] = useState(false);
  const [closingShift, setClosingShift] = useState<RestaurantShift | null>(null);
  const [viewingClosedShift, setViewingClosedShift] = useState<RestaurantShift | null>(null);
  const [selectedShiftForAudit, setSelectedShiftForAudit] = useState<RestaurantShift | null>(null);
  const [isShiftAuditLogOpen, setIsShiftAuditLogOpen] = useState(false);

  const [editingShift, setEditingShift] = useState<RestaurantShift | null>(null);
  const [editShiftNumber, setEditShiftNumber] = useState("");
  const [editCashierName, setEditCashierName] = useState("");
  const [editOpeningBalance, setEditOpeningBalance] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [deletingShift, setDeletingShift] = useState<RestaurantShift | null>(null);

  const [activeTab, setActiveTab] = useState<RestaurantSectionTab>(() =>
    resolveRestaurantTab(tabParam),
  );
  const [viewMode, setViewMode] = useViewMode("restaurant", "grid");
  const [activePerms, setActivePerms] = useState<Record<string, boolean>>(() =>
    getActiveUserPermissionsSync(),
  );

  useEffect(() => {
    const refreshStateAndPerms = () => {
      setErpState({ ...erpStore.getState() });
      setActivePerms(getActiveUserPermissionsSync());
    };
    refreshStateAndPerms();
    shiftAuditService.syncOpenShiftsFromSupabase(erpStore).catch(() => {});
    const unsub = erpStore.subscribe(refreshStateAndPerms);
    window.addEventListener(PERMISSIONS_UPDATED_EVENT, refreshStateAndPerms);
    return () => {
      unsub();
      window.removeEventListener(PERMISSIONS_UPDATED_EVENT, refreshStateAndPerms);
    };
  }, []);

  useEffect(() => {
    if (tabParam === "vouchers" || tabParam === "expenses") {
      navigate({ to: "/admin/ledger", search: { tab: "vouchers", dept: "restaurant" } as any });
      return;
    }
    setActiveTab(resolveRestaurantTab(tabParam));
  }, [tabParam, navigate]);

  useSyncedSubTab("/admin/restaurant", activeTab, setActiveTab as any, "operations");

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

  const currentIdentity = getCurrentUserIdentitySync();
  const isCashier = currentIdentity.isCashier;
  const canCloseShifts = currentIdentity.canCloseShifts;

  const allRestaurantShifts: RestaurantShift[] = erpState.restaurantShifts || [];
  const restaurantShifts: RestaurantShift[] = isCashier
    ? allRestaurantShifts.filter((s) => erpStore.doesShiftBelongToUser(s, currentIdentity))
    : allRestaurantShifts;
  const cashierActiveShift = isCashier ? erpStore.getCashierOpenRestaurantShift() : null;
  const openShifts = isCashier
    ? cashierActiveShift
      ? [cashierActiveShift]
      : []
    : restaurantShifts.filter((s) => s.status === "open");
  const closedShifts = restaurantShifts.filter((s) => s.status === "closed");
  const activeRestaurantShift = erpStore.getActiveRestaurantShift();

  const handleSaveShiftEdit = () => {
    if (!editingShift) return;
    if (!editShiftNumber.trim() || !editCashierName.trim()) {
      toast.error("يرجى إدخال اسم/رقم الوردية واسم الكاشير");
      return;
    }
    try {
      erpStore.updateRestaurantShift(editingShift.id, {
        shift_number: editShiftNumber.trim(),
        cashier_name: editCashierName.trim(),
        opening_balance: Number(editOpeningBalance) || 0,
        notes: editNotes.trim(),
      });
      toast.success("تم تحديث بيانات وردية المطعم بنجاح");
      setEditingShift(null);
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء تعديل الوردية");
    }
  };

  const handleConfirmDeleteShift = () => {
    if (!deletingShift) return;
    try {
      erpStore.deleteRestaurantShift(deletingShift.id);
      toast.success(`تم حذف الوردية (${deletingShift.shift_number}) بنجاح`);
      setDeletingShift(null);
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء حذف الوردية");
    }
  };

  const definitionCards = [
    {
      title: "إدارة المنيو والأصناف",
      to: "/admin/menu",
      icon: Utensils,
      color: "from-rose-500/20 to-red-500/20 text-rose-600 dark:text-rose-400",
      badge: "الأصناف",
      stats: `${counts.menu} صنف`,
      permissionKeys: ["pos", "pos_access", "inventory", "orders", "page_restaurant_menu"],
    },
    {
      title: "إدارة الطاولات والباركود QR",
      to: "/captain",
      icon: Grid3X3,
      color: "from-purple-500/20 to-indigo-500/20 text-purple-600 dark:text-purple-400",
      badge: "الصالة",
      stats: "تخطيط الصالة والباركود",
      permissionKeys: [
        "page_restaurant_tables",
        "orders",
        "orders_generate_qr",
        "captain",
        "captain_access",
      ],
    },
    {
      title: "مستودع وخامات المطعم",
      to: "/admin/inventory",
      icon: Package,
      color: "from-amber-600/20 to-yellow-600/20 text-amber-700 dark:text-amber-400",
      badge: "المخزون",
      stats: `${counts.inventory} صنف مخزني`,
      permissionKeys: [
        "page_restaurant_inventory",
        "inventory",
        "inventory_view",
        "production",
        "production_view",
      ],
    },
  ].filter((m) => hasAnyRequestedPermission(activePerms, m.permissionKeys));

  const operationCards = [
    {
      title: "نقطة البيع (POS)",
      to: "/pos",
      icon: Grid3X3,
      color: "from-blue-500/20 to-indigo-500/20 text-blue-600 dark:text-blue-400",
      badge: openShifts.length > 0 ? `${openShifts.length} وردية نشطة` : "معاينة / بيع",
      stats: openShifts.length > 0 ? "الوردية جاهزة للبيع" : "متاح للمعاينة والفتح",
      permissionKeys: ["pos", "pos_access", "orders", "orders_create_custom"],
    },
    {
      title: "شاشة طلبات العملاء (Captain)",
      to: "/captain",
      icon: ClipboardList,
      color: "from-purple-500/20 to-pink-500/20 text-purple-600 dark:text-purple-400",
      badge: "الصالة",
      stats: "طلبات الطاولات",
      permissionKeys: ["captain", "captain_access", "captain_create_order"],
    },
    {
      title: "شاشة المطبخ والفرن",
      to: "/oven",
      icon: UtensilsCrossed,
      color: "from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-400",
      badge: "تشغيل",
      stats: "المطبخ والفرن",
      permissionKeys: ["kitchen", "kitchen_view", "kitchen_change_status"],
    },
    {
      title: "إدارة الطلبات والفواتير",
      to: "/admin/orders",
      icon: Receipt,
      color: "from-cyan-500/20 to-blue-500/20 text-cyan-600 dark:text-cyan-400",
      badge: "متابعة",
      stats: `${counts.orders} طلب مسجل`,
      permissionKeys: ["orders", "orders_view", "delivery", "delivery_view"],
    },
    {
      title: "شاشة الكاشير والخزينة",
      to: "/cashier-treasury",
      icon: Wallet,
      color: "from-emerald-500/25 to-teal-500/25 text-emerald-600 dark:text-emerald-400",
      badge: "تشغيل",
      stats: "الورديات النقدية",
      permissionKeys: ["treasury", "treasury_view", "treasury_open_close", "pos", "pos_access"],
    },
  ].filter((m) => hasAnyRequestedPermission(activePerms, m.permissionKeys));

  const hasPosAccess = hasAnyRequestedPermission(activePerms, [
    "pos",
    "pos_access",
    "orders",
    "orders_create_custom",
  ]);

  const totalRestaurantSales = restaurantShifts.reduce(
    (sum, s) => sum + Number(s.total_sales || 0),
    0,
  );
  const totalRestaurantOrders = restaurantShifts.reduce(
    (sum, s) => sum + Number(s.orders_count || 0),
    0,
  );

  const renderModuleItems = (items: typeof operationCards) => {
    if (viewMode === "list") {
      return (
        <div className="space-y-2.5">
          {items.map((module) => {
            const Icon = module.icon;
            return (
              <Card
                key={module.title}
                onClick={() => navigate({ to: module.to as any })}
                className="group flex items-center justify-between gap-4 rounded-2xl border border-border/80 bg-card p-4 shadow-xs transition hover:border-primary/50 hover:shadow-md cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`rounded-xl bg-gradient-to-br p-2.5 ${module.color}`}>
                    <Icon size={20} />
                  </div>
                  <span className="text-base font-black text-foreground group-hover:text-primary transition truncate">
                    {module.title}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="rounded-full border border-border/60 bg-muted px-2.5 py-1 text-xs font-bold text-primary">
                    {module.stats}
                  </span>
                  <ArrowUpRight size={16} className="text-primary" />
                </div>
              </Card>
            );
          })}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((module) => {
          const Icon = module.icon;
          return (
            <Card
              key={module.title}
              onClick={() => navigate({ to: module.to as any })}
              className="group flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all duration-200 hover:border-primary/50 hover:shadow-lg cursor-pointer"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`rounded-2xl bg-gradient-to-br p-3 shadow-inner ${module.color}`}>
                    <Icon size={22} />
                  </div>
                  <h3 className="text-base font-black text-foreground group-hover:text-primary transition truncate">
                    {module.title}
                  </h3>
                </div>
                <span className="rounded-full border border-border/60 bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground shrink-0">
                  {module.badge}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-xs font-bold">
                <span className="inline-flex items-center gap-1.5 font-black text-primary">
                  <Clock size={13} />
                  {module.stats}
                </span>
                <span className="inline-flex items-center gap-1 text-primary">
                  فتح
                  <ArrowUpRight size={14} />
                </span>
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12" dir="rtl">
      {/* Compact Single-Row Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/12 text-amber-600 dark:text-amber-400 border border-amber-500/25">
              <UtensilsCrossed size={18} />
            </div>
            <h1 className="text-lg sm:text-xl font-black text-foreground">إدارة المطعم</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <ViewModeToggle mode={viewMode} onChange={setViewMode} />
          {hasPosAccess && (
            <>
              <Button
                onClick={() => navigate({ to: "/pos" })}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs h-8 px-3.5 rounded-xl gap-1.5 shadow-xs cursor-pointer"
              >
                <Grid3X3 size={14} />
                <span>نقطة البيع (POS)</span>
              </Button>
              {(!isCashier || !cashierActiveShift) && (
                <Button
                  onClick={() => setIsLauncherOpen(true)}
                  variant="outline"
                  className="font-bold text-xs h-8 px-3 rounded-xl gap-1.5 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>فتح وردية</span>
                </Button>
              )}
            </>
          )}
          <Button
            variant="outline"
            onClick={() =>
              navigate({
                to: "/admin/ledger",
                search: { tab: "vouchers", dept: "restaurant" } as any,
              })
            }
            className="font-bold text-xs h-8 px-3 rounded-xl gap-1.5 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 cursor-pointer"
          >
            <Landmark size={14} />
            <span>الإدارة المالية</span>
          </Button>
        </div>
      </div>

      {/* SECTION 1: DEFINITIONS (التعريفات) */}
      {activeTab === "definitions" && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {renderModuleItems(definitionCards)}
        </div>
      )}

      {/* SECTION 2: OPERATIONS (العمليات) */}
      {activeTab === "operations" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Active Open Shifts Banner */}
          {openShifts.length > 0 ? (
            <div className="space-y-3">
              {openShifts.map((shift) => {
                const isSessionActive = activeRestaurantShift?.id === shift.id;
                return (
                  <div
                    key={shift.id}
                    className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:border-teal-500/40"
                  >
                    <div className="space-y-1.5 text-right flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-black text-sm text-foreground">
                          {shift.shift_number || `وردية مطعم #${shift.auto_shift_number || "1"}`}
                        </h3>
                        <span className="inline-flex items-center bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700/60 text-xs font-bold px-2.5 py-0.5 rounded-full">
                          وردية مفتوحة
                        </span>
                        {isSessionActive && (
                          <span className="inline-flex items-center bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-700/60 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                            متصلة بشاشة الكاشير الآن
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1 font-bold text-foreground">
                          <UserCheck size={14} className="text-teal-600" />
                          الكاشير: {shift.cashier_name}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-mono">
                          <Clock size={13} className="text-muted-foreground" />
                          {new Date(shift.start_at || Date.now()).toLocaleTimeString("ar-EG")}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-teal-600 dark:text-teal-400 font-black">
                          <ShoppingBag size={14} />
                          {shift.orders_count || 0} مبيعات (
                          {Number(shift.total_sales || 0).toLocaleString()}{" "}
                          {shift.currency || "ج.م"})
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-start md:items-end gap-2.5 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => {
                          erpStore.resumeRestaurantShift(shift.id);
                          toast.success(`تم الدخول إلى ${shift.shift_number}`);
                          navigate({ to: "/pos" });
                        }}
                        className="bg-[#00897b] hover:bg-[#00796b] text-white rounded-full font-black text-xs px-5 py-2 shadow-xs flex items-center gap-1.5 cursor-pointer h-9"
                      >
                        <Play size={13} className="fill-white" />
                        <span>دخول الوردية</span>
                      </Button>

                      {canCloseShifts && !isCashier && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingShift(shift);
                              setEditShiftNumber(shift.shift_number);
                              setEditCashierName(shift.cashier_name);
                              setEditOpeningBalance(String(shift.opening_balance || 0));
                              setEditNotes(shift.notes || shift.opening_notes || "");
                            }}
                            className="rounded-full text-xs font-bold px-3 py-1 flex items-center gap-1 cursor-pointer h-7"
                          >
                            <Edit size={13} className="text-blue-600" />
                            <span>تعديل</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setClosingShift(shift)}
                            className="text-rose-700 dark:text-rose-300 rounded-full text-xs font-bold px-3 py-1 flex items-center gap-1 cursor-pointer h-7"
                          >
                            <Lock size={12} className="text-rose-600" />
                            <span>إغلاق الوردية</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeletingShift(shift)}
                            className="text-rose-500 hover:text-rose-700 p-1.5 h-7 w-7 rounded-full cursor-pointer"
                            title="حذف الوردية"
                          >
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 sm:p-5 rounded-2xl border border-dashed border-teal-500/30 bg-card shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
              <h3 className="font-black text-sm text-foreground">لا توجد وردية مفتوحة حالياً</h3>
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <Button
                  variant="outline"
                  onClick={() => navigate({ to: "/pos" })}
                  className="rounded-full font-bold text-xs px-4 py-2 flex items-center gap-1.5 cursor-pointer h-9 border-teal-500/30 text-teal-700 dark:text-teal-300"
                >
                  <Eye size={15} />
                  <span>معاينة الكاشير</span>
                </Button>
                <Button
                  onClick={() => setIsLauncherOpen(true)}
                  className="bg-[#00897b] hover:bg-[#00796b] text-white rounded-full font-black text-xs px-5 py-2 shadow-xs flex items-center gap-1.5 cursor-pointer h-9 shrink-0"
                >
                  <Plus size={15} />
                  <span>فتح وردية جديدة</span>
                </Button>
              </div>
            </div>
          )}

          {/* Operational Screens */}
          {renderModuleItems(operationCards)}

          {/* Shifts Management Table */}
          <Card className="border border-border shadow-xs rounded-2xl">
            <CardHeader className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60">
              <CardTitle className="text-base font-black">
                ورديات كاشير المطعم ({restaurantShifts.length})
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                {(!isCashier || !cashierActiveShift) && (
                  <Button
                    onClick={() => setIsLauncherOpen(true)}
                    size="sm"
                    className="bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs gap-1.5 cursor-pointer"
                  >
                    <Plus size={14} />
                    فتح وردية جديدة
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold">
                  <tr>
                    <th className="p-3">رقم / مسمى الوردية</th>
                    <th className="p-3">الكاشير المسؤول</th>
                    <th className="p-3">وقت الفتح</th>
                    <th className="p-3">وقت الإغلاق</th>
                    <th className="p-3">الطلبات والمبيعات</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {restaurantShifts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-muted-foreground">
                        لا توجد ورديات مطعم مسجلة بعد
                      </td>
                    </tr>
                  ) : (
                    restaurantShifts.map((s) => (
                      <tr key={s.id} className="hover:bg-muted/30 transition">
                        <td className="p-3 font-black text-foreground">{s.shift_number}</td>
                        <td className="p-3 font-bold text-foreground">{s.cashier_name}</td>
                        <td className="p-3 text-muted-foreground font-mono">
                          {new Date(s.start_at).toLocaleString("ar-EG")}
                        </td>
                        <td className="p-3 text-muted-foreground font-mono">
                          {s.end_at
                            ? new Date(s.end_at).toLocaleString("ar-EG")
                            : "— نشطة حالياً —"}
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {s.orders_count || 0} طلب ({Number(s.total_sales || 0).toLocaleString()}{" "}
                          {s.currency || "ج.م"})
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              s.status === "open"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {s.status === "open" ? "مفتوحة" : "مغلقة"}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {s.status === "open" ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    erpStore.resumeRestaurantShift(s.id);
                                    toast.success(`تم الدخول إلى ${s.shift_number}`);
                                    navigate({ to: "/pos" });
                                  }}
                                  className="h-7 px-2.5 text-xs font-bold bg-[#00897b] hover:bg-[#00796b] text-white rounded-lg cursor-pointer"
                                >
                                  <Play size={12} className="ml-1 fill-white" />
                                  دخول الوردية
                                </Button>
                                {canCloseShifts && !isCashier && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setClosingShift(s)}
                                    className="h-7 px-2 text-xs font-bold text-rose-600 border-rose-200 hover:bg-rose-50 cursor-pointer"
                                  >
                                    <Lock size={12} className="ml-1" />
                                    إغلاق
                                  </Button>
                                )}
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setViewingClosedShift(s)}
                                className="h-7 px-2 text-xs font-bold cursor-pointer"
                              >
                                <FileSpreadsheet size={13} className="ml-1 text-emerald-600" />
                                تقرير الوردية
                              </Button>
                            )}
                            {canCloseShifts && !isCashier && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingShift(s);
                                    setEditShiftNumber(s.shift_number);
                                    setEditCashierName(s.cashier_name);
                                    setEditOpeningBalance(String(s.opening_balance || 0));
                                    setEditNotes(s.notes || s.opening_notes || "");
                                  }}
                                  className="h-7 px-2 text-xs font-bold text-blue-600 cursor-pointer"
                                >
                                  <Edit size={13} className="ml-1" />
                                  تعديل
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setDeletingShift(s)}
                                  className="h-7 w-7 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-full cursor-pointer"
                                  title="حذف الوردية"
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SECTION 3: REPORTS (التقارير) */}
      {activeTab === "reports" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 rounded-2xl border border-border">
              <div className="text-xs font-bold text-muted-foreground">إجمالي مبيعات الورديات</div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                {totalRestaurantSales.toLocaleString()} ج.م
              </div>
            </Card>
            <Card className="p-4 rounded-2xl border border-border">
              <div className="text-xs font-bold text-muted-foreground">إجمالي الطلبات المسجلة</div>
              <div className="text-2xl font-black text-foreground mt-1 font-mono">
                {Math.max(totalRestaurantOrders, counts.orders)}
              </div>
            </Card>
            <Card className="p-4 rounded-2xl border border-border">
              <div className="text-xs font-bold text-muted-foreground">الورديات المفتوحة</div>
              <div className="text-2xl font-black text-teal-600 mt-1 font-mono">
                {openShifts.length}
              </div>
            </Card>
            <Card className="p-4 rounded-2xl border border-border">
              <div className="text-xs font-bold text-muted-foreground">الورديات المغلقة</div>
              <div className="text-2xl font-black text-foreground mt-1 font-mono">
                {closedShifts.length}
              </div>
            </Card>
          </div>

          <Card className="border border-border shadow-xs rounded-2xl">
            <CardHeader className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60">
              <CardTitle className="text-base font-black">تقارير الورديات وسجل التدقيق</CardTitle>
              {!isCashier && (
                <Button
                  onClick={() => {
                    setSelectedShiftForAudit(null);
                    setIsShiftAuditLogOpen(true);
                  }}
                  variant="outline"
                  size="sm"
                  className="font-bold rounded-xl text-xs gap-1.5 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 cursor-pointer"
                >
                  <History size={14} />
                  سجل التدقيق الشامل للورديات
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold">
                  <tr>
                    <th className="p-3">رقم / مسمى الوردية</th>
                    <th className="p-3">الكاشير المسؤول</th>
                    <th className="p-3">وقت الفتح</th>
                    <th className="p-3">وقت الإغلاق</th>
                    <th className="p-3">المبيعات</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3 text-center">التقرير</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {restaurantShifts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-muted-foreground">
                        لا توجد تقارير ورديات مسجلة بعد
                      </td>
                    </tr>
                  ) : (
                    restaurantShifts.map((s) => (
                      <tr key={s.id} className="hover:bg-muted/30 transition">
                        <td className="p-3 font-black text-foreground">{s.shift_number}</td>
                        <td className="p-3 font-bold text-foreground">{s.cashier_name}</td>
                        <td className="p-3 text-muted-foreground font-mono">
                          {new Date(s.start_at).toLocaleString("ar-EG")}
                        </td>
                        <td className="p-3 text-muted-foreground font-mono">
                          {s.end_at
                            ? new Date(s.end_at).toLocaleString("ar-EG")
                            : "— نشطة حالياً —"}
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {s.orders_count || 0} طلب ({Number(s.total_sales || 0).toLocaleString()}{" "}
                          {s.currency || "ج.م"})
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              s.status === "open"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {s.status === "open" ? "مفتوحة" : "مغلقة"}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setViewingClosedShift(s)}
                              className="h-7 px-2 text-xs font-bold cursor-pointer"
                            >
                              <FileSpreadsheet size={13} className="ml-1 text-emerald-600" />
                              تقرير الوردية
                            </Button>
                            {canCloseShifts && !isCashier && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedShiftForAudit(s);
                                  setIsShiftAuditLogOpen(true);
                                }}
                                className="h-7 px-2 text-xs font-bold text-indigo-600 cursor-pointer"
                              >
                                سجل التدقيق
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      <RestaurantShiftLauncherModal
        isOpen={isLauncherOpen}
        onClose={() => setIsLauncherOpen(false)}
        onPreviewPOS={() => {
          setIsLauncherOpen(false);
          navigate({ to: "/pos" });
        }}
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
          }}
        />
      )}

      {viewingClosedShift && (
        <RestaurantShiftClosingReportModal
          isOpen={!!viewingClosedShift}
          onClose={() => setViewingClosedShift(null)}
          viewOnlyShift={viewingClosedShift}
        />
      )}

      <ShiftAuditLogViewerModal
        isOpen={isShiftAuditLogOpen}
        onClose={() => setIsShiftAuditLogOpen(false)}
        initialShiftId={selectedShiftForAudit?.id}
        initialShiftType="restaurant"
      />

      {editingShift && (
        <Dialog open={editingShift !== null} onOpenChange={() => setEditingShift(null)}>
          <DialogContent className="sm:max-w-[450px] rounded-3xl text-right" dir="rtl">
            <DialogHeader className="text-right">
              <DialogTitle className="text-base font-black flex items-center gap-2 text-foreground">
                <Edit size={18} className="text-blue-600" />
                تعديل بيانات جلسة وردية المطعم
              </DialogTitle>
              <DialogDescription className="text-xs">
                تعديل رقم ومسمى الوردية أو اسم الكاشير المسؤول أو عهدة البداية
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div>
                <Label className="font-bold mb-1 block">رقم / مسمى الوردية:</Label>
                <Input
                  value={editShiftNumber}
                  onChange={(e) => setEditShiftNumber(e.target.value)}
                  className="rounded-xl h-9 font-bold"
                />
              </div>

              <div>
                <Label className="font-bold mb-1 block">اسم الكاشير المسؤول:</Label>
                <Input
                  value={editCashierName}
                  onChange={(e) => setEditCashierName(e.target.value)}
                  className="rounded-xl h-9 font-bold"
                />
              </div>

              <div>
                <Label className="font-bold mb-1 block">رصيد عهدة بداية الوردية (ج.م):</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={editOpeningBalance}
                  onChange={(e) => setEditOpeningBalance(e.target.value)}
                  className="rounded-xl h-9 font-mono font-bold"
                />
              </div>

              <div>
                <Label className="font-bold mb-1 block">ملاحظات الوردية:</Label>
                <Input
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="rounded-xl h-9"
                  placeholder="ملاحظات..."
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingShift(null)}
                className="rounded-xl"
              >
                إلغاء
              </Button>
              <Button
                size="sm"
                onClick={handleSaveShiftEdit}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold"
              >
                حفظ التعديلات
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {deletingShift && (
        <Dialog open={deletingShift !== null} onOpenChange={() => setDeletingShift(null)}>
          <DialogContent className="sm:max-w-[450px] rounded-3xl text-right" dir="rtl">
            <DialogHeader className="text-right">
              <DialogTitle className="text-base font-black flex items-center gap-2 text-rose-600">
                <Trash2 size={18} />
                تأكيد حذف وردية المطعم
              </DialogTitle>
              <DialogDescription className="text-xs text-rose-600/80">
                هل أنت متأكد من حذف الوردية ({deletingShift.shift_number})؟ لا يمكن التراجع عن هذا
                الإجراء.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="gap-2 sm:justify-between pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeletingShift(null)}
                className="rounded-xl"
              >
                إلغاء
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmDeleteShift}
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold"
              >
                تأكيد الحذف
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
