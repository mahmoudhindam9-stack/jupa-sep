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
import { CheckCircle2, UtensilsCrossed, ArrowRight, Trash2, Flame, Pencil } from "lucide-react";
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
import { BackToRestaurantButton } from "@/components/admin/BackToRestaurantButton";

export const Route = createFileRoute("/oven")({
  head: () => ({ meta: [{ title: "شاشة الفرن والمطبخ (KDS)" }] }),
  component: OvenAccessGate,
});

function OvenAccessGate() {
  const navigate = useNavigate();
  const [accessState, setAccessState] = useState<"checking" | "allowed" | "denied">("checking");
  useEffect(() => {
    let active = true;
    currentUserHasPermission(["kitchen", "kitchen_view"])
      .then((allowed) => { if (active) setAccessState(allowed ? "allowed" : "denied"); })
      .catch((error) => {
        console.error("Kitchen route authorization failed.", error);
        if (active) setAccessState("denied");
      });
    return () => { active = false; };
  }, []);

  if (accessState === "allowed") return <OvenPage />;
  if (accessState === "checking") {
    return <div className="min-h-screen flex items-center justify-center text-sm font-bold text-muted-foreground">جاري التحقق من صلاحيات حسابك…</div>;
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6" dir="rtl">
      <div role="alert" className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm space-y-4">
        <h1 className="text-xl font-black text-foreground">ليس لديك صلاحية شاشة المطبخ</h1>
        <p className="text-sm text-muted-foreground">يجب تفعيل صلاحية المطبخ من صفحة المستخدمين قبل فتح هذه الشاشة.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => navigate({ to: "/admin" })}>العودة إلى لوحة الإدارة</Button>
          <Button variant="outline" onClick={async () => { await signOutCurrentUser(); navigate({ to: "/login" }); }}>تسجيل الخروج</Button>
        </div>
      </div>
    </div>
  );
}

function OvenPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [filterOvenOnly, setFilterOvenOnly] = useState<boolean>(false);
  const [editingOrder, setEditingOrder] = useState<any | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editTotal, setEditTotal] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchPendingOrders();

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
      unsubscribeStore();
      supabase.removeChannel(channel);
    };
  }, []);

  const getKitchenNotes = (rawNotes: string | null | undefined): string => {
    if (!rawNotes) return "";
    const cleaned = String(rawNotes)
      .split("|")
      .map((part) => part.trim())
      .filter((part) => {
        if (!part) return false;
        // Filter out currency mentions (e.g. "العملة: USD", "Currency: USD")
        if (/^(العملة|currency)\s*:/i.test(part)) return false;
        // Filter out delivery fee mentions (e.g. "رسوم توصيل: 20.00", "رسوم التوصيل: 20")
        if (/^(رسوم\s*(ال)?توصيل|delivery\s*fee)\s*:/i.test(part)) return false;
        // Filter out other cashier financial metadata
        if (/^(الخصم|discount)\s*:/i.test(part)) return false;
        if (/^(خدمة\s*صالة|service\s*fee)\s*:/i.test(part)) return false;
        if (/^AUTH#\s*:/i.test(part)) return false;
        return true;
      })
      .join(" | ")
      .trim();

    return cleaned;
  };

  const fetchPendingOrders = async () => {
    try {
      let dbOrders: any[] = [];
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .or("status.eq.pending,status.eq.in_kitchen")
        .order("created_at", { ascending: true });

      if (!error && data) {
        dbOrders = data;
      }

      const allLocal = tableOrdersStore.getAllOrders();
      const localStoreOrders = allLocal
        .filter(
          (o) =>
            (o.status === "draft" || o.status === "sent_to_cashier") &&
            o.sentToKitchen &&
            !o.kitchenCompleted,
        )
        .map((lo) => ({
          id: lo.kitchenOrderId || lo.id,
          table_id: lo.table_id,
          table_number: lo.table_number,
          order_type: lo.order_type || "dine_in",
          status: "pending",
          notes: lo.notes || `طاولة #${lo.table_number}`,
          created_at: lo.created_at || new Date().toISOString(),
          total: lo.total || 0,
          items: Array.isArray(lo.items)
            ? lo.items.map((i) => ({
                id: i?.item?.id || i?.id || Math.random().toString(),
                name_ar: i?.item?.name_ar || i?.name_ar || i?.name || "عنصر غير معروف",
                quantity: i?.quantity || 1,
                notes: i?.notes || i?.note || "",
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
      if (order.id && !order.isLocalStore) {
        const { error } = await supabase
          .from("orders")
          .update({ status: "served" })
          .eq("id", order.id);
        if (error) throw error;
      }
      if (order.table_id) {
        tableOrdersStore.markKitchenCompletedByTableId(order.table_id);
      }
      toast({ title: "الطلب جاهز! 👨‍🍳", description: "تم تحديث حالة الطلب إلى جاهز/مكتمل." });
      fetchPendingOrders();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message || "فشل تحديث الطلب", variant: "destructive" });
    }
  };

  const deleteSingleOrder = async (order: any) => {
    try {
      if (!order.isLocalStore && order.id) {
        const { error } = await supabase.from("orders").delete().eq("id", order.id);
        if (error) throw error;
      }
      if (order.table_id) {
        tableOrdersStore.markKitchenCompletedByTableId(order.table_id);
      }
      toast({ title: "تم الحذف", description: "تم حذف الطلب بنجاح." });
      fetchPendingOrders();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message || "فشل حذف الطلب", variant: "destructive" });
    }
  };

  const clearAllOrders = async () => {
    try {
      const { error } = await supabase.from("orders").delete().not("id", "is", null);
      if (error) throw error;

      const localOrders = tableOrdersStore.getAllOrders();
      localOrders.forEach((o) => {
        if (o.table_id) {
          tableOrdersStore.markKitchenCompletedByTableId(o.table_id);
        }
      });

      toast({
        title: "تم حذف كافة الطلبات",
        description: "تم حذف جميع الطلبات نهائياً بنجاح.",
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
    <div className="min-h-screen bg-slate-50 font-cairo">
      <div className="max-w-7xl mx-auto w-full px-4 pt-4">
        <BackToRestaurantButton />
      </div>
      <header className="bg-slate-900 text-white p-4 shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition">
              <ArrowRight size={20} className="rotate-180" />
            </Link>
            <div>
              <h1 className="text-xl font-black flex items-center gap-2">
                <Flame className="text-orange-500 fill-orange-500 animate-pulse" />
                شاشة الفرن المباشرة (Oven KDS)
              </h1>
              <p className="text-xs text-slate-400">إدارة ومتابعة تحضير وجبات الفرن</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
              <Switch
                id="filter-oven"
                checked={filterOvenOnly}
                onCheckedChange={setFilterOvenOnly}
              />
              <Label
                htmlFor="filter-oven"
                className="text-xs font-bold text-slate-200 cursor-pointer"
              >
                أصناف الفرن فقط 🍕
              </Label>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2 text-xs font-bold h-9 shadow-xs">
                  <Trash2 size={16} />
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
      </header>

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
                    const itemNote = (item.notes || item.note || "").trim();
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
                                  فرن 🍕
                                </span>
                              )}
                              <span className="text-sm font-black text-slate-900">
                                {item.name_ar || item.name}
                              </span>
                            </div>

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

                          <div className="font-black bg-slate-900 text-white px-2 py-0.5 rounded-md text-xs shrink-0">
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
    </div>
  );
}
