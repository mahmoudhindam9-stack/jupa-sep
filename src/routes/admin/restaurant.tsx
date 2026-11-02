import { createFileRoute, useNavigate, useLocation, Link } from "@tanstack/react-router";
import {
  extractTabParam,
  useSyncedSubTab,
} from "@/components/navigation/navigationRegistry";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  ClipboardList,
  Clock,
  Edit,
  Eye,
  FileSpreadsheet,
  Grid3X3,
  History,
  Lock,
  Package,
  Play,
  Plus,
  Receipt,
  ShoppingBag,
  Store,
  Trash2,
  UserCheck,
  Utensils,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { erpStore, RestaurantShift } from "@/shared/services/erpStore";
import { RestaurantShiftLauncherModal } from "@/components/restaurant/RestaurantShiftLauncherModal";
import { RestaurantShiftClosingReportModal } from "@/components/restaurant/RestaurantShiftClosingReportModal";
import { ShiftAuditLogViewerModal } from "@/components/admin/ShiftAuditLogViewerModal";
import { menuService } from "@/features/menu/services/menuService";
import { inventoryService } from "@/features/inventory/services/inventoryService";
import { tableOrdersStore } from "@/shared/services/tableOrdersStore";
import { supabase } from "@/integrations/supabase/client";
import { VouchersLedgerSection } from "@/components/admin/VouchersLedgerSection";
import {
  getActiveUserPermissionsSync,
  hasAnyRequestedPermission,
  PERMISSIONS_UPDATED_EVENT,
} from "@/shared/services/userAuthorization";
import { toast } from "sonner";

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
  const tabParam = extractTabParam(location.search, (location as any).searchStr);
  const [counts, setCounts] = useState<RestaurantCounts>({ menu: 8, inventory: 6, orders: 0 });
  const [erpState, setErpState] = useState(() => erpStore.getState());
  const [isLauncherOpen, setIsLauncherOpen] = useState(false);
  const [closingShift, setClosingShift] = useState<RestaurantShift | null>(null);
  const [viewingClosedShift, setViewingClosedShift] = useState<RestaurantShift | null>(null);
  const [selectedShiftForAudit, setSelectedShiftForAudit] = useState<RestaurantShift | null>(null);
  const [isShiftAuditLogOpen, setIsShiftAuditLogOpen] = useState(false);

  // Edit & Delete Shift Dialog states (matching Park page)
  const [editingShift, setEditingShift] = useState<RestaurantShift | null>(null);
  const [editShiftNumber, setEditShiftNumber] = useState("");
  const [editCashierName, setEditCashierName] = useState("");
  const [editOpeningBalance, setEditOpeningBalance] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [deletingShift, setDeletingShift] = useState<RestaurantShift | null>(null);

  const [activeTab, setActiveTab] = useState<"grid" | "vouchers" | "shifts">(
    tabParam === "vouchers" ? "vouchers" : tabParam === "shifts" ? "shifts" : "grid",
  );
  const [activePerms, setActivePerms] = useState<Record<string, boolean>>(() =>
    getActiveUserPermissionsSync(),
  );

  useEffect(() => {
    const refreshStateAndPerms = () => {
      setErpState({ ...erpStore.getState() });
      setActivePerms(getActiveUserPermissionsSync());
    };
    refreshStateAndPerms();
    const unsub = erpStore.subscribe(refreshStateAndPerms);
    window.addEventListener(PERMISSIONS_UPDATED_EVENT, refreshStateAndPerms);
    return () => {
      unsub();
      window.removeEventListener(PERMISSIONS_UPDATED_EVENT, refreshStateAndPerms);
    };
  }, []);

  useEffect(() => {
    setActiveTab(
      tabParam === "vouchers" ? "vouchers" : tabParam === "shifts" ? "shifts" : "grid",
    );
  }, [tabParam]);

  useSyncedSubTab("/admin/restaurant", activeTab, setActiveTab as any, "grid");

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

  const restaurantShifts: RestaurantShift[] = erpState.restaurantShifts || [];
  const openShifts = restaurantShifts.filter((s) => s.status === "open");
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

  const allModules = [
    {
      title: "نقطة البيع (POS)",
      description: "شاشة البيع السريعة لإدخال الطلبات، الدفع، طباعة الفواتير، أو المعاينة المباشرة",
      to: "/pos",
      icon: Grid3X3,
      color: "from-blue-500/20 to-indigo-500/20 text-blue-600 dark:text-blue-400",
      badge: openShifts.length > 0 ? `${openShifts.length} وردية نشطة` : "معاينة / بيع",
      stats: openShifts.length > 0 ? "الوردية جاهزة للبيع" : "متاح للمعاينة والفتح",
      permissionKeys: ["pos", "pos_access", "orders", "orders_create_custom"],
    },
    {
      title: "ورديات كاشير المطعم",
      description: "إدارة ورديات الكاشير المفتوحة والمغلقة، تقارير الإغلاق، وسجل تدقيق الورديات",
      action: () => setActiveTab("shifts"),
      icon: History,
      color: "from-teal-500/20 to-emerald-500/20 text-teal-600 dark:text-teal-400",
      badge: "الورديات",
      stats: `${openShifts.length} مفتوحة | ${closedShifts.length} مغلقة`,
      permissionKeys: ["pos", "pos_access", "treasury", "treasury_open_close", "accounting"],
    },
    {
      title: "سندات الصرف والقبض",
      description: "إصدار وتسجيل سندات الصرف والقبض الخاصة بإدارة المطعم وتوليد القيود",
      action: () => setActiveTab("vouchers"),
      icon: Receipt,
      color: "from-emerald-500/25 to-teal-500/25 text-emerald-600 dark:text-emerald-400",
      badge: "سندات مالية",
      stats: "إدارة السندات",
      permissionKeys: ["accounting", "treasury", "expense_approval", "revenue_approval", "pos"],
    },
    {
      title: "شاشة الكاشير والخزينة",
      description: "إدارة النقدية اليومية، فتح وإغلاق الشيفتات، وحركات الخزينة",
      to: "/cashier-treasury",
      icon: Wallet,
      color: "from-emerald-500/25 to-teal-500/25 text-emerald-600 dark:text-emerald-400",
      badge: "مالي",
      stats: "الخزينة والشيفتات",
      permissionKeys: ["treasury", "treasury_view", "treasury_open_close", "pos", "pos_access"],
    },
    {
      title: "شاشة المطبخ (الفرن)",
      description: "متابعة الطلبات الواردة للمطبخ والفرن وأوقات التجهيز الفعلي",
      to: "/oven",
      icon: UtensilsCrossed,
      color: "from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-400",
      badge: "تشغيل",
      stats: "المطبخ والفرن",
      permissionKeys: ["kitchen", "kitchen_view", "kitchen_change_status"],
    },
    {
      title: "شاشة طلبات العملاء (Captain)",
      description: "تسجيل طلبات الطاولات والصالة بواسطة الكابتن والويتر",
      to: "/captain",
      icon: ClipboardList,
      color: "from-purple-500/20 to-pink-500/20 text-purple-600 dark:text-purple-400",
      badge: "الصالة",
      stats: "طلبات الكابتن",
      permissionKeys: ["captain", "captain_access", "captain_create_order"],
    },
    {
      title: "إدارة الطلبات والفواتير",
      description: "سجل كامل للطلبات، متابعة الحالات، وتعديل أو إلغاء الطلبات",
      to: "/admin/orders",
      icon: Receipt,
      color: "from-cyan-500/20 to-blue-500/20 text-cyan-600 dark:text-cyan-400",
      badge: "متابعة",
      stats: `${counts.orders} طلب مسجل`,
      permissionKeys: ["orders", "orders_view", "delivery", "delivery_view"],
    },
    {
      title: "إدارة المنيو والأصناف",
      description: "إضافة وتعديل الأقسام، الأسعار، الشعارات، والمكونات",
      to: "/admin/menu",
      icon: Utensils,
      color: "from-rose-500/20 to-red-500/20 text-rose-600 dark:text-rose-400",
      badge: "القائمة",
      stats: `${counts.menu} صنف في المنيو`,
      permissionKeys: ["pos", "pos_access", "inventory", "orders"],
    },
    {
      title: "المخزن والمستودع",
      description: "متابعة أرصدة المواد الخام، الوارد والصادر، وجرد المستودع",
      to: "/admin/inventory",
      icon: Package,
      color: "from-amber-600/20 to-yellow-600/20 text-amber-700 dark:text-amber-400",
      badge: "المخزون",
      stats: `${counts.inventory} صنف مخزني`,
      permissionKeys: ["inventory", "inventory_view", "production", "production_view"],
    },
  ];

  const modules = allModules.filter((m) =>
    hasAnyRequestedPermission(activePerms, m.permissionKeys),
  );
  const hasPosAccess = hasAnyRequestedPermission(activePerms, [
    "pos",
    "pos_access",
    "orders",
    "orders_create_custom",
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12" dir="rtl">
      {/* Page Header & Quick Launch Actions (Modeled after Park Management) */}
      {activeTab === "grid" ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground">إدارة وتشغيل المطعم</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              نظام تشغيل المطعم، نقاط البيع، المطبخ، الصالة، والورديات اليومية
            </p>
          </div>
          {hasPosAccess && (
            <div className="flex items-center gap-2.5 flex-wrap">
              <Button
                onClick={() => navigate({ to: "/pos" })}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs h-9 px-4 rounded-xl gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
              >
                <Grid3X3 size={16} />
                <span>نقطة بيع المطعم (POS)</span>
              </Button>
              <Button
                onClick={() => setIsLauncherOpen(true)}
                variant="outline"
                className="font-bold text-xs h-9 px-3.5 rounded-xl gap-1.5 cursor-pointer"
              >
                <Plus size={15} />
                <span>فتح وردية جديدة</span>
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="sticky top-0 z-20 bg-card/95 backdrop-blur py-3 px-3 sm:px-5 -mx-2 sm:-mx-4 border-b border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              onClick={() => setActiveTab("grid")}
              className="gap-2 font-black rounded-xl text-xs py-2 px-4 border-teal-500/30 text-teal-700 dark:text-teal-400 hover:bg-teal-500/10 w-fit cursor-pointer"
            >
              <ArrowRight size={16} />
              العودة إلى أقسام المطعم
            </Button>
            <div className="h-5 w-px bg-border/80 hidden sm:block" />
            <div className="flex items-center gap-2">
              <Store size={18} className="text-teal-600 shrink-0" />
              <h1 className="text-sm sm:text-base font-black text-foreground tracking-tight whitespace-nowrap">
                إدارة وتشغيل المطعم
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            <Button
              size="sm"
              variant={activeTab === "shifts" ? "default" : "outline"}
              onClick={() => setActiveTab("shifts")}
              className="rounded-xl font-bold text-xs h-8 cursor-pointer"
            >
              الورديات ({restaurantShifts.length})
            </Button>
            <Button
              size="sm"
              variant={activeTab === "vouchers" ? "default" : "outline"}
              onClick={() => setActiveTab("vouchers")}
              className="rounded-xl font-bold text-xs h-8 cursor-pointer"
            >
              السندات المالية
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate({ to: "/pos" })}
              className="rounded-xl font-bold text-xs h-8 gap-1 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 cursor-pointer"
            >
              <Grid3X3 size={13} />
              شاشة الكاشير (POS)
            </Button>
          </div>
        </div>
      )}

      {/* TAB: VOUCHERS */}
      {activeTab === "vouchers" && (
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
      )}

      {/* TAB: SHIFTS */}
      {activeTab === "shifts" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <Card className="border border-border shadow-xs rounded-2xl">
            <CardHeader className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60">
              <div>
                <CardTitle className="text-base font-black">
                  ورديات وجلسات كاشير المطعم
                </CardTitle>
                <CardDescription className="text-xs">
                  سجل الورديات المفتوحة والمغلقة، تقارير الإغلاق، ومطابقة مبيعات الكاشير
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
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
                  سجل التدقيق وفحص الورديات
                </Button>
                <Button
                  onClick={() => setIsLauncherOpen(true)}
                  size="sm"
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs gap-1.5 cursor-pointer"
                >
                  <Plus size={14} />
                  فتح وردية جديدة
                </Button>
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
                        <td className="p-3">
                          <div className="font-black text-foreground">{s.shift_number}</div>
                          {s.auto_shift_number && (
                            <div className="text-[10px] font-mono text-muted-foreground">
                              {s.auto_shift_number}
                            </div>
                          )}
                        </td>
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
                          ج.م)
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
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setClosingShift(s)}
                                  className="h-7 px-2 text-xs font-bold text-rose-600 border-rose-200 hover:bg-rose-50 cursor-pointer"
                                >
                                  <Lock size={12} className="ml-1" />
                                  إغلاق
                                </Button>
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
                              onClick={() => {
                                setSelectedShiftForAudit(s);
                                setIsShiftAuditLogOpen(true);
                              }}
                              className="h-7 px-2 text-xs font-bold text-indigo-600 cursor-pointer"
                            >
                              سجل التدقيق
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

      {/* TAB: GRID (Open Shifts Card + Modules Grid — Modeled after Park Management) */}
      {activeTab === "grid" && (
        <div className="space-y-6">
          {/* Open Shifts Section (مطابق لصفحة الحديقة) */}
          {openShifts.length > 0 ? (
            <div className="space-y-3">
              {openShifts.map((shift) => {
                const isSessionActive = activeRestaurantShift?.id === shift.id;
                return (
                  <div
                    key={shift.id}
                    className="p-4 sm:p-5 rounded-3xl border border-border/80 bg-card shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:border-teal-500/40"
                  >
                    {/* Information (Right side in RTL) */}
                    <div className="space-y-1.5 text-right flex-1 min-w-0">
                      {/* Row 1: Title and Auto Shift Number badge */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-black text-sm text-foreground">
                          {shift.shift_number || `وردية مطعم #${shift.auto_shift_number || "1"}`}
                        </h3>
                        {shift.auto_shift_number && (
                          <span className="border border-border/80 bg-muted/40 text-muted-foreground text-[11px] font-mono px-2.5 py-0.5 rounded-full">
                            رقم النظام: {shift.auto_shift_number}
                          </span>
                        )}
                      </div>

                      {/* Row 2: "وردية مفتوحة" badge */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700/60 text-xs font-bold px-2.5 py-0.5 rounded-full">
                          وردية مفتوحة
                        </span>
                        {isSessionActive && (
                          <span className="inline-flex items-center bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-700/60 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                            متصلة بشاشة الكاشير الآن
                          </span>
                        )}
                      </div>

                      {/* Row 3: Cashier and start time */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1 font-bold text-foreground">
                          <UserCheck size={14} className="text-teal-600" />
                          الكاشير: {shift.cashier_name}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-mono">
                          <Clock size={13} className="text-muted-foreground" />
                          بدأت:{" "}
                          {new Date(shift.start_at || Date.now()).toLocaleTimeString("ar-EG")}
                        </span>
                        {Number(shift.opening_balance || 0) > 0 && (
                          <>
                            <span>•</span>
                            <span className="font-mono font-bold text-foreground">
                              عهدة البداية: {Number(shift.opening_balance || 0).toLocaleString()} ج.م
                            </span>
                          </>
                        )}
                      </div>

                      {/* Row 4: Sales count and revenue */}
                      <div className="flex items-center gap-1 text-teal-600 dark:text-teal-400 font-black text-xs">
                        <ShoppingBag size={14} />
                        <span>
                          {shift.orders_count || 0} مبيعات (
                          {Number(shift.total_sales || 0).toLocaleString()} ج.م)
                        </span>
                        {(shift.refunds_count || 0) > 0 && (
                          <span className="text-rose-600 font-bold mr-1">
                            ({shift.refunds_count} مرتجع)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons (Left side in RTL) */}
                    <div className="flex flex-col items-start md:items-end gap-2.5 shrink-0">
                      {/* Enter shift button */}
                      <Button
                        size="sm"
                        onClick={() => {
                          erpStore.resumeRestaurantShift(shift.id);
                          toast.success(`تم الدخول إلى ${shift.shift_number}`);
                          navigate({ to: "/pos" });
                        }}
                        className="bg-[#00897b] hover:bg-[#00796b] text-white rounded-full font-black text-xs px-5 py-2 shadow-xs flex items-center gap-1.5 cursor-pointer h-9 transition active:scale-95"
                      >
                        <Play size={13} className="fill-white" />
                        <span>دخول الوردية (بيع / مرتجع)</span>
                      </Button>

                      {/* Edit, Close, and Delete buttons */}
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
                          className="border border-amber-200/90 bg-amber-50/50 hover:bg-amber-100/60 dark:bg-amber-950/20 dark:border-amber-900/50 text-foreground rounded-full text-xs font-bold px-3 py-1 flex items-center gap-1 cursor-pointer h-7"
                          title="تعديل بيانات الوردية"
                        >
                          <Edit size={13} className="text-blue-600" />
                          <span>تعديل</span>
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setClosingShift(shift)}
                          className="border border-rose-200/90 bg-rose-50/50 hover:bg-rose-100/60 dark:bg-rose-950/20 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 rounded-full text-xs font-bold px-3 py-1 flex items-center gap-1 cursor-pointer h-7"
                          title="إغلاق الوردية وإصدار التقرير"
                        >
                          <Lock size={12} className="text-rose-600" />
                          <span>إغلاق الوردية</span>
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeletingShift(shift)}
                          className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 p-1.5 h-7 w-7 rounded-full cursor-pointer transition flex items-center justify-center"
                          title="حذف الوردية"
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 sm:p-5 rounded-3xl border border-dashed border-teal-500/30 bg-card shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-right">
                <h3 className="font-black text-sm text-foreground">لا توجد وردية مفتوحة حالياً</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  اضغط على زر فتح وردية جديدة لبدء جلسة بيع واستلام طلبات المطعم، أو يمكنك معاينة
                  شاشة الكاشير بدون فتح وردية
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <Button
                  variant="outline"
                  onClick={() => navigate({ to: "/pos" })}
                  className="rounded-full font-bold text-xs px-4 py-2 flex items-center gap-1.5 cursor-pointer h-9 border-teal-500/30 text-teal-700 dark:text-teal-300 hover:bg-teal-500/10"
                >
                  <Eye size={15} />
                  <span>معاينة الكاشير (بدون وردية)</span>
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

          {/* Restaurant Modules Cards Grid */}
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

                return (
                  <div
                    key={module.title}
                    className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    <Card
                      onClick={() => {
                        if (module.action) {
                          module.action();
                        } else if (module.to) {
                          navigate({ to: module.to as any });
                        }
                      }}
                      className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm transition-all duration-300 group-hover:border-primary/50 group-hover:bg-accent/30 group-hover:shadow-xl cursor-pointer"
                    >
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
                    </Card>
                  </div>
                );
              })}
            </div>
          </section>
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

      {/* Edit Shift Modal (Modeled after Park Management) */}
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

      {/* Delete Shift Confirmation Modal */}
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

