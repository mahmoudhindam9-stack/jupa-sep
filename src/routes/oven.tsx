// @ts-nocheck
import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { currentUserHasPermission, signOutCurrentUser } from "@/shared/services/userAuthorization";
import { tableOrdersStore } from "@/shared/services/tableOrdersStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { CheckCircle2, UtensilsCrossed, Trash2, Flame, Pencil, ChefHat, AlertTriangle, BookOpen } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { OrderTimer } from "@/components/OrderTimer";
import { useToast } from "@/hooks/use-toast";
import { AppMainNavbar } from "@/components/navigation/AppMainNavbar";
import { AppBreadcrumbBar } from "@/components/navigation/AppBreadcrumbBar";
import { menuService } from "@/features/menu/services/menuService";
import { inventoryService } from "@/features/inventory/services/inventoryService";
import { erpStore } from "@/shared/services/erpStore";
import { getDefaultRecipeSpecByName, getRawMaterialSpec } from "@/shared/data/defaultRecipes";
import { isNonKitchenNotificationOrder, sanitizeKitchenNotes } from "@/shared/utils/productOptions";
import { MenuItem, InventoryItem } from "@/shared/types";

export const Route = createFileRoute("/oven")({
  head: () => ({ meta: [{ title: "شاشة الفرن والمطبخ (KDS)" }] }),
  component: OvenPage,
});

function OvenPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [filterOvenOnly, setFilterOvenOnly] = useState<boolean>(false);
  const [editingOrder, setEditingOrder] = useState<any | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [recipeModalData, setRecipeModalData] = useState<{
    orderItem: any;
    menuItem: MenuItem | null;
    defaultSpec: ReturnType<typeof getDefaultRecipeSpecByName>;
    qualitySpecs: ReturnType<typeof erpStore.getMenuItemQualitySpecs>;
  } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        const [mItems, iItems] = await Promise.all([
          menuService.getMenuItems(),
          inventoryService.getInventory(),
        ]);
        setMenuItems(mItems);
        setInventoryItems(iItems);
      } catch {
        // non-blocking
      }
    };
    void loadReferenceData();
  }, []);

  useEffect(() => {
    fetchPendingOrders();
    const pollInterval = setInterval(fetchPendingOrders, 3000);

    const unsubscribeStore = tableOrdersStore.subscribe(() => {
      fetchPendingOrders();
    });

    const channel = supabase
      .channel("oven_orders_channel")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        fetchPendingOrders();
      })
      .on("broadcast", { event: "NEW_OVEN_ORDER" }, () => {
        fetchPendingOrders();
      })
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      unsubscribeStore();
      supabase.removeChannel(channel);
    };
  }, []);

  const extractTableNumber = (row: any): number | null => {
    if (row?.table_number && Number(row.table_number) > 0 && Number(row.table_number) !== 999) {
      return Number(row.table_number);
    }
    const itemsArr = Array.isArray(row?.items) ? row.items : [];
    const metaNum = itemsArr[0]?.meta?.table_number;
    if (metaNum && Number(metaNum) > 0 && Number(metaNum) !== 999) {
      return Number(metaNum);
    }
    const notesStr = String(row?.notes || "");
    const matchBracket = notesStr.match(/\[طاولة:\s*(\d+)\]/);
    if (matchBracket && Number(matchBracket[1]) > 0) {
      return Number(matchBracket[1]);
    }
    const matchHash = notesStr.match(/طاولة\s*#?(\d+)/);
    if (matchHash && Number(matchHash[1]) > 0) {
      return Number(matchHash[1]);
    }
    return null;
  };

  const getKitchenNotes = (rawNotes: string | null | undefined): string => {
    return sanitizeKitchenNotes(rawNotes);
  };

  const resolveOrderItemRecipe = (item: any) => {
    const itemId = item?.menu_item_id || item?.id;
    const itemName = String(item?.name_ar || item?.name || "").trim();
    const matchedMenu =
      menuItems.find((m) => m.id === itemId) ||
      menuItems.find((m) => m.name_ar.trim() === itemName) ||
      null;
    const defaultSpec = getDefaultRecipeSpecByName(matchedMenu?.name_ar || itemName);
    const qualitySpecs = matchedMenu ? erpStore.getMenuItemQualitySpecs(matchedMenu.id) : null;
    return {
      orderItem: item,
      menuItem: matchedMenu,
      defaultSpec,
      qualitySpecs,
    };
  };

  const fetchPendingOrders = async () => {
    try {
      let dbOrders: any[] = [];
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, table_id, order_type, status, notes, items, created_at, kitchen_started_at")
        .in("status", ["pending", "preparing", "in_kitchen"])
        .order("created_at", { ascending: true });

      if (!error && Array.isArray(data)) {
        dbOrders = data
          .filter((row) => {
            if (tableOrdersStore.shouldIgnoreRemoteOrder(row.id, row.created_at)) {
              return false;
            }
            if (isNonKitchenNotificationOrder(row)) {
              return false;
            }
            const notesStr = String(row.notes || "");
            if (
              notesStr.includes("[SELF_ORDER_ACTIVE]") &&
              !notesStr.includes("[SENT_TO_KITCHEN]") &&
              row.status !== "preparing"
            ) {
              return false;
            }
            return true;
          })
          .map((row) => {
            const notesStr = String(row.notes || "");
            const kitchenStartMatch = notesStr.match(/\[KITCHEN_START:([^\]]+)\]/);
            const kitchenStartedAt =
              row.kitchen_started_at ||
              kitchenStartMatch?.[1] ||
              row.created_at ||
              new Date().toISOString();
            return {
              ...row,
              table_number: extractTableNumber(row),
              created_at: kitchenStartedAt,
            };
          });
      }

      const allLocal = tableOrdersStore.getAllOrders();
      const localStoreOrders = allLocal
        .filter(
          (o) =>
            (o.status === "draft" || o.status === "sent_to_cashier" || o.status === "in_checkout") &&
            o.sentToKitchen &&
            !o.kitchenCompleted &&
            !isNonKitchenNotificationOrder(o),
        )
        .map((lo) => ({
          id: lo.kitchenOrderId || lo.id,
          table_id: lo.table_id,
          table_number: lo.table_number || extractTableNumber(lo),
          order_type: lo.order_type || "dine_in",
          status: "preparing",
          notes: lo.notes || `طاولة #${lo.table_number}`,
          created_at: lo.kitchen_started_at || lo.created_at || new Date().toISOString(),
          items: Array.isArray(lo.items)
            ? lo.items.map((i) => ({
                id: i?.item?.id || i?.id || Math.random().toString(),
                menu_item_id: i?.item?.id || i?.menu_item_id || i?.id,
                name_ar: i?.item?.name_ar || i?.name_ar || i?.name || "عنصر غير معروف",
                quantity: i?.quantity || 1,
                notes: i?.notes || i?.note || "",
                selectedOptions: i?.selectedOptions || i?.item?.selectedOptions || [],
                selectedAdditions: i?.selectedAdditions || i?.item?.selectedAdditions || [],
                requires_oven: i?.item?.requires_oven || i?.requires_oven || false,
              }))
            : [],
          isLocalStore: true,
          localStoreId: lo.id,
        }));

      const dbOrderIds = new Set(dbOrders.map((o) => o.id));
      const extraLocal = localStoreOrders.filter((l) => !dbOrderIds.has(l.id));

      const combined = [...dbOrders, ...extraLocal].sort(
        (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(),
      );

      setOrders(combined);
    } catch (err) {
      console.error("fetchPendingOrders error:", err);
    }
  };

  const markAsCompleted = async (order: any) => {
    try {
      const nowIso = new Date().toISOString();
      if (order.id && !order.isLocalStore) {
        const notesStr = String(order.notes || "");
        const isUnpaidTableOrSelfOrder =
          (notesStr.includes("[SELF_ORDER_ACTIVE]") ||
            notesStr.includes("[SENT_TO_KITCHEN]") ||
            notesStr.includes("[SENT_TO_CASHIER]")) &&
          !notesStr.includes("[CASHIER_PAID]");
        const targetStatus = isUnpaidTableOrSelfOrder ? "ready" : "ready";
        const { error } = await supabase
          .from("orders")
          .update({ status: targetStatus, ready_at: nowIso } as any)
          .eq("id", order.id);
        if (error) {
          const fallbackRes = await supabase
            .from("orders")
            .update({ status: targetStatus })
            .eq("id", order.id);
          if (fallbackRes.error) throw fallbackRes.error;
        }
      }
      tableOrdersStore.markKitchenCompletedByTableId(
        order.table_id,
        order.table_number || extractTableNumber(order),
        order.id,
      );
      toast({ title: "الطلب جاهز! 👨‍🍳", description: "تم تحديث حالة الطلب إلى جاهز للتسليم." });
      fetchPendingOrders();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message || "فشل تحديث الطلب", variant: "destructive" });
    }
  };

  const deleteSingleOrder = async (order: any) => {
    try {
      await tableOrdersStore.cancelTableOrder({
        tableId: order.table_id,
        tableNumber: order.table_number || extractTableNumber(order),
        orderId: order.localStoreId || order.id,
        kitchenOrderId: order.id,
      });
      toast({ title: "تم الحذف", description: "تم حذف الطلب وإلغاؤه نهائياً بنجاح." });
      fetchPendingOrders();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message || "فشل حذف الطلب", variant: "destructive" });
    }
  };

  const clearAllOrders = async () => {
    try {
      await tableOrdersStore.clearAllPendingOrders();
      toast({
        title: "تم حذف كافة الطلبات",
        description: "تم مسح وإلغاء جميع الطلبات المعلقة نهائياً بنجاح.",
      });
      fetchPendingOrders();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message || "فشل حذف الطلبات", variant: "destructive" });
    }
  };

  const updateOrder = async () => {
    if (!editingOrder) return;
    try {
      if (!editingOrder.isLocalStore && editingOrder.id) {
        const { error } = await supabase
          .from("orders")
          .update({ notes: editNotes })
          .eq("id", editingOrder.id);
        if (error) throw error;
      }
      toast({ title: "تم التعديل", description: "تم تحديث بيانات الطلب بنجاح." });
      setEditingOrder(null);
      fetchPendingOrders();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message || "فشل تعديل الطلب", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-cairo flex flex-col">
      {/* 1. Permanent Fixed Main Top Bar */}
      <AppMainNavbar />

      {/* 2. Contextual Breadcrumb Bar */}
      <AppBreadcrumbBar />

      <div className="bg-card/95 backdrop-blur border-b border-border px-4 sm:px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Flame size={18} className="text-orange-500 shrink-0" />
            <div>
              <h1 className="text-sm sm:text-base font-black text-foreground leading-tight">
                شاشة الفرن والمطبخ المباشرة (KDS)
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-muted/60 px-3 py-1 rounded-lg border border-border">
              <Switch
                id="filter-oven"
                checked={filterOvenOnly}
                onCheckedChange={setFilterOvenOnly}
              />
              <Label
                htmlFor="filter-oven"
                className="text-xs font-bold text-foreground cursor-pointer"
              >
                أصناف الفرن فقط
              </Label>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-1.5 text-xs font-bold h-8 shadow-2xs">
                  <Trash2 size={14} />
                  حذف جميع الطلبات
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-3xl font-cairo text-right">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-black text-right">
                    هل أنت متأكد من حذف جميع الطلبات؟
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-right">
                    سيتم حذف كافة الطلبات من قاعدة البيانات والفرن نهائياً. لا يمكن التراجع عن هذا
                    الإجراء.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2">
                  <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={clearAllOrders}
                    className="bg-destructive hover:bg-destructive/90 rounded-xl text-white"
                  >
                    نعم، احذف الكل
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      <main className="p-4 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {orders.length === 0 && (
          <div className="col-span-full py-20 text-center text-slate-500 font-bold bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <UtensilsCrossed size={48} className="mx-auto mb-3 text-slate-300" />
            <p className="text-base">لا توجد طلبات معلقة في الفرن حالياً</p>
          </div>
        )}

        {orders.map((order) => {
          const rawItems = Array.isArray(order.items)
            ? order.items
            : typeof order.items === "string"
              ? (() => {
                  try {
                    return JSON.parse(order.items);
                  } catch {
                    return [];
                  }
                })()
              : [];

          const displayItems = filterOvenOnly
            ? rawItems.filter((i: any) => i.requires_oven)
            : rawItems;

          if (filterOvenOnly && displayItems.length === 0) return null;

          return (
            <div
              key={order.id}
              className="bg-white rounded-2xl shadow-sm border-2 border-orange-200 overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow"
            >
              <div className="bg-orange-50 p-3.5 border-b border-orange-200 flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-black text-lg text-slate-900">
                      طلب #{String(order.order_number || order.id).slice(-6)}
                    </div>
                    <div className="text-xs text-slate-500 font-bold">
                      {order.created_at ? format(new Date(order.created_at), "hh:mm a") : ""}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge
                      variant="outline"
                      className="bg-orange-100 text-orange-800 border-orange-300 font-bold"
                    >
                      {order.order_type === "dine_in"
                        ? `صالة ${order.table_number ? `(#${order.table_number})` : ""}`
                        : order.order_type === "takeaway"
                          ? "تيك أواي"
                          : "توصيل"}
                    </Badge>
                    <OrderTimer createdAt={order.created_at} />
                  </div>
                </div>
              </div>

              <div className="p-4 flex-1">
                {(() => {
                  const kitchenNotes = getKitchenNotes(order.notes);
                  if (!kitchenNotes) return null;
                  return (
                    <div className="mb-3 p-2 bg-amber-50 rounded-lg text-xs font-bold border border-amber-200 text-amber-900">
                      {kitchenNotes}
                    </div>
                  );
                })()}

                <div className="space-y-2.5">
                  {displayItems.map((item: any, idx: number) => {
                    const itemNote = sanitizeKitchenNotes(item.notes || item.note || "");
                    const options = Array.isArray(item.selectedOptions) ? item.selectedOptions : [];
                    const additions = Array.isArray(item.selectedAdditions)
                      ? item.selectedAdditions
                      : [];

                    return (
                      <div
                        key={idx}
                        className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-2.5 transition-colors"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0 font-bold text-sm text-slate-900">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {item.requires_oven && (
                                <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-black border border-orange-200">
                                  فرن
                                </span>
                              )}
                              <span className="text-sm font-black text-slate-900">
                                {item.name_ar || item.name}
                              </span>
                            </div>

                            {options.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {options.map((opt: any, oIdx: number) => (
                                  <span
                                    key={oIdx}
                                    className="text-[11px] font-bold text-sky-900 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded-md"
                                  >
                                    {typeof opt === "string"
                                      ? opt
                                      : opt.label_ar || opt.label_en || opt.id}
                                  </span>
                                ))}
                              </div>
                            )}

                            {additions.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {additions.map((add: any, aIdx: number) => (
                                  <span
                                    key={aIdx}
                                    className="text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 px-1.5 py-0.5 rounded-md"
                                  >
                                    +
                                    {typeof add === "string"
                                      ? add
                                      : `${add.icon || ""} ${add.name_ar || add.name || ""}`}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="font-black bg-slate-900 text-white px-2 py-0.5 rounded-md text-xs shrink-0 tabular-nums">
                            ×{item.quantity}
                          </div>
                        </div>

                        {itemNote && (
                          <div className="mt-2 text-xs font-bold text-amber-950 bg-amber-100/95 border border-amber-300 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5 shadow-2xs">
                            <span className="text-amber-600 shrink-0 mt-0.5">⚠️</span>
                            <div className="flex-1 min-w-0 leading-relaxed">
                              <span className="text-amber-800 font-extrabold ml-1">ملاحظة:</span>
                              <span className="font-bold">{itemNote}</span>
                            </div>
                          </div>
                        )}

                        <div className="mt-2 pt-1.5 border-t border-slate-200/70 flex justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setRecipeModalData(resolveOrderItemRecipe(item))}
                            className="h-7 px-2.5 text-[11px] font-bold gap-1 text-orange-800 border-orange-200 bg-orange-50/70 hover:bg-orange-100 cursor-pointer"
                          >
                            <ChefHat size={13} />
                            المكونات والوصفة
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-100 mt-auto flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Button
                    onClick={() => {
                      setEditingOrder(order);
                      setEditNotes(getKitchenNotes(order.notes));
                    }}
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 text-blue-600 hover:bg-blue-50"
                    title="تعديل الطلب"
                  >
                    <Pencil size={16} />
                  </Button>
                  <Button
                    onClick={() => deleteSingleOrder(order)}
                    variant="destructive"
                    size="icon"
                    className="h-9 w-9 shadow-xs"
                    title="حذف الطلب"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
              <div className="px-3 pb-3 bg-slate-50">
                <Button
                  onClick={() => markAsCompleted(order)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 font-bold gap-2 text-white shadow-xs"
                >
                  <CheckCircle2 size={18} />
                  الطلب جاهز
                </Button>
              </div>
            </div>
          );
        })}
      </main>

      {/* Edit Order Modal */}
      {editingOrder && (
        <Dialog open={!!editingOrder} onOpenChange={(open) => !open && setEditingOrder(null)}>
          <DialogContent className="max-w-md text-right rounded-3xl font-cairo">
            <DialogHeader>
              <DialogTitle className="text-right text-lg font-black block border-b border-border/40 pb-2">
                تعديل الطلب #{String(editingOrder.order_number || editingOrder.id).slice(-6)}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">ملاحظات الطلب</Label>
                <Input
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="ملاحظات أو تعليمات خاصة..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button
                  variant="outline"
                  onClick={() => setEditingOrder(null)}
                  className="rounded-xl"
                >
                  إلغاء
                </Button>
                <Button onClick={updateOrder} className="rounded-xl">
                  حفظ التعديلات
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Ingredients & Recipe Modal */}
      {recipeModalData && (
        <Dialog open={!!recipeModalData} onOpenChange={(open) => !open && setRecipeModalData(null)}>
          <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto text-right rounded-3xl font-cairo">
            <DialogHeader className="border-b border-border/50 pb-3">
              <DialogTitle className="text-right text-lg font-black flex items-center gap-2 text-orange-700">
                <ChefHat size={20} />
                المكونات والوصفة: {recipeModalData.orderItem?.name_ar || recipeModalData.orderItem?.name}
              </DialogTitle>
            </DialogHeader>

            {(() => {
              const { orderItem, menuItem, defaultSpec, qualitySpecs } = recipeModalData;
              const qty = Number(orderItem?.quantity || 1);
              const invById = Object.fromEntries(inventoryItems.map((i) => [i.id, i]));
              const dbIngredients = Array.isArray(menuItem?.ingredients) ? menuItem!.ingredients : [];
              const displayIngredients =
                dbIngredients.length > 0
                  ? dbIngredients.map((ing) => {
                      const inv = invById[ing.inventory_id];
                      return {
                        name: inv?.name_ar || ing.notes || "مكون",
                        perServing: Number(ing.weight || 0),
                        totalNeeded: Number(ing.weight || 0) * qty,
                        unit: ing.unit || inv?.unit || "",
                        optional: Boolean(ing.optional),
                      };
                    })
                  : (defaultSpec?.ingredients || []).map((spec) => {
                      const rawSpec = getRawMaterialSpec(spec.materialKey);
                      return {
                        name: rawSpec?.name_ar || spec.materialKey,
                        perServing: Number(spec.weight || 0),
                        totalNeeded: Number(spec.weight || 0) * qty,
                        unit: spec.unit,
                        optional: Boolean(spec.optional),
                      };
                    });

              const prepText =
                (menuItem?.prep_instructions && String(menuItem.prep_instructions).trim()) ||
                defaultSpec?.prep_instructions ||
                "لا توجد تعليمات تحضير مسجلة لهذا الصنف.";

              const allergensList = Array.from(
                new Set([
                  ...(Array.isArray(menuItem?.allergens) ? menuItem!.allergens : []),
                  ...(Array.isArray(qualitySpecs?.allergens) ? qualitySpecs!.allergens : []),
                  ...(Array.isArray(defaultSpec?.allergens) ? defaultSpec.allergens : []),
                ]),
              ).filter(Boolean);

              const itemAdds = Array.isArray(orderItem?.selectedAdditions)
                ? orderItem.selectedAdditions
                : [];
              const itemOpts = Array.isArray(orderItem?.selectedOptions)
                ? orderItem.selectedOptions
                : [];

              return (
                <div className="space-y-4 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold">
                    <span>الكمية المطلوبة بالطلب:</span>
                    <Badge className="bg-slate-900 text-white tabular-nums">×{qty}</Badge>
                  </div>

                  {(itemOpts.length > 0 || itemAdds.length > 0) && (
                    <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-3 space-y-2">
                      <div className="text-xs font-black text-sky-900">تخصيصات العميل على هذا الطلب</div>
                      <div className="flex flex-wrap gap-1.5">
                        {itemOpts.map((opt: any, idx: number) => (
                          <Badge key={`opt-${idx}`} variant="outline" className="bg-white border-sky-300 text-sky-900 font-bold">
                            {typeof opt === "string" ? opt : opt.label_ar || opt.label_en}
                          </Badge>
                        ))}
                        {itemAdds.map((add: any, idx: number) => (
                          <Badge key={`add-${idx}`} variant="outline" className="bg-white border-emerald-300 text-emerald-900 font-bold">
                            + {typeof add === "string" ? add : add.name_ar || add.name}
                            {add?.deduct_qty
                              ? ` (${Number(add.deduct_qty) * qty} ${add.deduct_unit || ""})`
                              : ""}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <BookOpen size={14} className="text-orange-600" />
                      المكونات والكميات المطلوبة
                    </div>
                    {displayIngredients.length > 0 ? (
                      <div className="divide-y divide-border rounded-xl border border-border overflow-hidden bg-card">
                        {displayIngredients.map((row, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between px-3 py-2 text-xs"
                          >
                            <div className="flex items-center gap-1.5 font-bold text-foreground">
                              <span>{row.name}</span>
                              {row.optional && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                  اختياري
                                </span>
                              )}
                            </div>
                            <div className="text-left font-black text-orange-700 tabular-nums">
                              {row.totalNeeded} {row.unit}
                              {qty > 1 && (
                                <span className="text-[10px] text-muted-foreground font-medium mr-1.5">
                                  ({row.perServing} / حصة)
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground bg-muted/40 rounded-xl p-3 border border-dashed">
                        لا توجد مكونات مسجلة لهذا الصنف حتى الآن.
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 bg-amber-50/70 border border-amber-200 rounded-xl p-3">
                    <div className="text-xs font-black text-amber-900">طريقة وخطوات التحضير</div>
                    <p className="text-xs leading-relaxed text-amber-950 font-medium">{prepText}</p>
                  </div>

                  <div className="space-y-1.5 bg-rose-50/60 border border-rose-200 rounded-xl p-3">
                    <div className="text-xs font-black text-rose-800 flex items-center gap-1.5">
                      <AlertTriangle size={14} />
                      مسببات الحساسية (Allergens)
                    </div>
                    {allergensList.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {allergensList.map((al, i) => (
                          <Badge key={i} variant="destructive" className="text-[11px] font-bold">
                            {al}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-emerald-700 font-bold">لا توجد مسببات حساسية مسجلة</p>
                    )}
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
