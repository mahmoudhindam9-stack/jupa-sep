import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { useSettings, translations } from "@/hooks/use-settings";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle,
  Trash2,
  Eye,
  Clock,
  ChefHat,
  TrendingUp,
  CreditCard,
  Pencil,
  ArrowRight,
  ClipboardList,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { BackToRestaurantButton } from "@/components/admin/BackToRestaurantButton";

export const Route = createFileRoute("/admin/orders")({
  head: () => ({ meta: [{ title: "متابعة الطلبات" }] }),
  component: OrdersPage,
});

type Order = {
  id: string;
  order_number: number;
  created_at: string;
  status: string;
  order_type: string;
  payment_method: string;
  total: number;
  table_id: string | null;
  notes: string | null;
  items: { id: string; name_ar: string; price: number; quantity: number }[];
};

type Table = { id: string; number: number; name: string | null };

function ElapsedTimer({ createdAt, status }: { createdAt: string; status: string }) {
  const [minutes, setMinutes] = useState(0);

  useEffect(() => {
    if (["served", "cancelled"].includes(status)) return;
    const calculate = () => {
      const diff = Math.floor((new Date().getTime() - new Date(createdAt).getTime()) / 60000);
      setMinutes(diff >= 0 ? diff : 0);
    };
    calculate();
    const interval = setInterval(calculate, 30000);
    return () => clearInterval(interval);
  }, [createdAt, status]);

  if (["served", "cancelled"].includes(status)) return null;

  let colorClass = "text-muted-foreground bg-muted";
  if (status === "pending" && minutes > 10) {
    colorClass = "text-destructive bg-destructive/10 border-destructive/20 animate-pulse";
  } else if (status === "pending") {
    colorClass = "text-rose-500 bg-rose-500/10 border-rose-500/20";
  } else if (status === "preparing") {
    colorClass = "text-blue-500 bg-blue-500/10 border-blue-500/20";
  } else if (status === "ready") {
    colorClass = "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${colorClass}`}
    >
      <Clock size={11} />
      منذ {minutes} د
    </span>
  );
}

function OrdersPage() {
  const { lang } = useSettings();
  const t = translations[lang] || translations["ar"];
  const { toast } = useToast();

  const statusLabels: Record<string, string> = {
    pending: t.status_pending || "قيد الانتظار",
    preparing: t.status_preparing || "جاري التحضير",
    ready: t.status_ready || "جاهز",
    served: t.status_served || "مكتمل",
    cancelled: "ملغي / مرتجع",
  };

  const orderTypeLabels: Record<string, string> = {
    dine_in: t.dine_in || "صالة",
    takeaway: t.takeaway || "تيك أواي",
    delivery: t.delivery || "توصيل",
  };

  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editTotal, setEditTotal] = useState("");

  const ordersQuery = useQuery({
    queryKey: ["admin", "orders", statusFilter],
    queryFn: async () => {
      let query = supabase.from("orders").select("*").order("created_at", { ascending: false });

      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as any as Order[];
    },
    refetchInterval: 5000,
  });

  const tablesQuery = useQuery({
    queryKey: ["admin", "tables"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tables").select("id, number, name");
      if (error) return [] as Table[];
      return (data || []) as Table[];
    },
  });

  const tables = tablesQuery.data || [];
  const tablesMap = new Map(tables.map((table) => [table.id, table]));

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      toast({ title: "تم التحديث", description: "تم تحديث حالة الطلب بنجاح." });
    },
    onError: (err: any) => {
      toast({
        title: "خطأ",
        description: err.message || "فشل تحديث الحالة",
        variant: "destructive",
      });
    },
  });

  const deleteOrder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      toast({ title: "تم الحذف", description: "تم حذف الطلب بنجاح." });
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message || "فشل حذف الطلب", variant: "destructive" });
    },
  });

  const deleteAllOrders = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("orders").delete().not("id", "is", null);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      toast({ title: "تم الحذف", description: "تم حذف جميع الطلبات نهائياً بنجاح." });
    },
    onError: (err: any) => {
      toast({
        title: "خطأ",
        description: err.message || "فشل حذف جميع الطلبات",
        variant: "destructive",
      });
    },
  });

  const updateOrder = useMutation({
    mutationFn: async ({ id, notes, total }: { id: string; notes: string; total: number }) => {
      const { error } = await supabase.from("orders").update({ notes, total }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      toast({ title: "تم التعديل", description: "تم تحديث الطلب بنجاح." });
      setEditingOrder(null);
    },
    onError: (err: any) => {
      toast({
        title: "خطأ",
        description: err.message || "فشل تعديل الطلب",
        variant: "destructive",
      });
    },
  });

  const getOrderCurrency = (notes: string | null) => {
    if (!notes) return "USD";
    if (notes.includes("العملة: EGP") || notes.includes("EGP")) return "EGP";
    if (notes.includes("العملة: SSP") || notes.includes("SSP")) return "SSP";
    if (notes.includes("العملة: USD") || notes.includes("USD")) return "USD";
    return "USD";
  };

  const formatOrderPrice = (amount: number, notes: string | null) => {
    const curr = getOrderCurrency(notes);
    const val = Number(amount || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    if (curr === "EGP") return `${val} ج.م`;
    if (curr === "SSP") return `${val} ج.ج.س`;
    return `${val} $`;
  };

  const orders = ordersQuery.data || [];

  const stats = (() => {
    const pending = orders.filter((o) => o.status === "pending").length;
    const preparing = orders.filter((o) => o.status === "preparing").length;
    const ready = orders.filter((o) => o.status === "ready").length;
    const completedCount = orders.filter((o) => ["served", "completed"].includes(o.status)).length;
    const revenue = orders
      .filter((o) => o.status !== "cancelled")
      .reduce((acc, o) => acc + (o.total || 0), 0);
    return { pending, preparing, ready, completedCount, revenue };
  })();

  return (
    <div className="p-6 space-y-6 font-cairo bg-slate-50 min-h-screen">
      {/* Top Bar - Frozen Sticky Header with Clear Department Title */}
      <div className="sticky top-0 z-20 bg-card/95 backdrop-blur py-3 px-4 border-b border-border/80 flex items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            to="/admin"
            className="p-2 bg-white dark:bg-slate-800 rounded-xl hover:bg-slate-200 transition border border-border/60 inline-flex items-center justify-center"
            title="العودة للإدارة"
          >
            <ArrowRight size={18} />
          </Link>
          <BackToRestaurantButton />
          <div className="h-5 w-px bg-border/80 hidden sm:block" />
          <div className="flex items-center gap-2">
            <ClipboardList size={18} className="text-primary shrink-0" />
            <h1 className="text-sm sm:text-base font-black text-foreground tracking-tight whitespace-nowrap">
              إدارة ومتابعة الطلبات
            </h1>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl shadow-xs border border-border/60">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            إدارة ومتابعة الطلبات
          </h1>
          <p className="text-xs text-muted-foreground font-medium">
            متابعة حالة الطلبات، التعديل، والحذف لحظياً
          </p>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-border/60 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-rose-50 text-rose-500 rounded-xl">
            <Clock size={20} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-bold">قيد الانتظار</div>
            <div className="text-xl font-black text-rose-600">{stats.pending}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-border/60 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-500 rounded-xl">
            <ChefHat size={20} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-bold">جاري التحضير</div>
            <div className="text-xl font-black text-blue-600">{stats.preparing}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-border/60 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-500 rounded-xl">
            <CheckCircle size={20} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-bold">جاهز للتسليم</div>
            <div className="text-xl font-black text-emerald-600">{stats.ready}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-border/60 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-purple-50 text-purple-500 rounded-xl">
            <CheckCircle size={20} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-bold">مكتمل</div>
            <div className="text-xl font-black text-purple-600">{stats.completedCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-border/60 shadow-xs flex items-center gap-3 col-span-2 md:col-span-1">
          <div className="p-3 bg-amber-50 text-amber-500 rounded-xl">
            <TrendingUp size={20} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-bold">إجمالي الإيرادات</div>
            <div className="text-xl font-black text-emerald-600">
              {stats.revenue.toLocaleString("en-US", { minimumFractionDigits: 2 })} $
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Bulk Delete */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-border/60 shadow-xs">
        <div className="flex items-center gap-3">
          <Label className="text-xs font-bold shrink-0">فلترة بالحالة:</Label>
          <select
            className="h-9 rounded-xl border border-input bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-right"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">جميع الحالات</option>
            {Object.entries(statusLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              className="gap-2 font-bold rounded-xl shadow-xs"
            >
              <Trash2 size={15} />
              حذف جميع الطلبات
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="text-right rounded-3xl font-cairo">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-black text-right">
                هل أنت متأكد من حذف جميع الطلبات؟
              </AlertDialogTitle>
              <AlertDialogDescription className="text-right">
                سيتم حذف كافة الطلبات من قاعدة البيانات نهائياً. لا يمكن التراجع عن هذا الإجراء.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteAllOrders.mutate()}
                className="bg-destructive hover:bg-destructive/90 rounded-xl text-white"
              >
                نعم، احذف الكل
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Orders Table / List */}
      <div className="bg-white rounded-3xl border border-border/60 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b bg-slate-50/75 text-xs text-muted-foreground font-bold">
                <th className="p-4">رقم الطلب</th>
                <th className="p-4">الوقت والمدة</th>
                <th className="p-4">نوع الطلب</th>
                <th className="p-4">الطاولة / العميل</th>
                <th className="p-4">الإجمالي</th>
                <th className="p-4">الحالة</th>
                <th className="p-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y text-xs font-semibold">
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-muted-foreground">
                    لا توجد طلبات مطابقة للبحث الحالي.
                  </td>
                </tr>
              )}
              {orders.map((o) => {
                const table = o.table_id ? tablesMap.get(o.table_id) : null;
                return (
                  <tr key={o.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-4 font-black text-slate-900">
                      #{String(o.order_number || o.id).slice(-6)}
                    </td>
                    <td className="p-4">
                      <div className="text-slate-800">
                        {o.created_at
                          ? new Date(o.created_at).toLocaleTimeString("ar-EG", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </div>
                      <div className="mt-1">
                        <ElapsedTimer createdAt={o.created_at} status={o.status} />
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className="font-bold">
                        {orderTypeLabels[o.order_type] || o.order_type}
                      </Badge>
                    </td>
                    <td className="p-4 font-bold text-slate-800">
                      {table ? table.name || `طاولة ${table.number}` : "-"}
                    </td>
                    <td className="p-4 font-black text-emerald-600">
                      {formatOrderPrice(o.total, o.notes)}
                    </td>
                    <td className="p-4">
                      <select
                        className="h-8 rounded-lg border border-input bg-background px-2 text-xs font-bold focus:ring-1 focus:ring-primary text-right"
                        value={o.status}
                        onChange={(e) => updateStatus.mutate({ id: o.id, status: e.target.value })}
                      >
                        {Object.entries(statusLabels).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-xl text-blue-600 hover:bg-blue-50"
                          onClick={() => setSelectedOrder(o)}
                          title="عرض التفاصيل"
                        >
                          <Eye size={15} />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-xl text-emerald-600 hover:bg-emerald-50"
                          onClick={() => {
                            setEditingOrder(o);
                            setEditNotes(o.notes || "");
                            setEditTotal(o.total ? o.total.toString() : "0");
                          }}
                          title="تعديل الطلب"
                        >
                          <Pencil size={15} />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="h-8 w-8 rounded-xl shadow-xs"
                          onClick={() => deleteOrder.mutate(o.id)}
                          title="حذف الطلب"
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {selectedOrder && (
        <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
          <DialogContent className="max-w-md text-right rounded-3xl font-cairo">
            <DialogHeader>
              <DialogTitle className="text-right text-lg font-black block border-b pb-2">
                تفاصيل الطلب #{String(selectedOrder.order_number || selectedOrder.id).slice(-6)}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2 text-xs font-medium">
              <div className="flex justify-between">
                <span className="text-muted-foreground">التاريخ والوقت:</span>
                <span className="font-bold">
                  {selectedOrder.created_at
                    ? new Date(selectedOrder.created_at).toLocaleString("ar-EG")
                    : "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">نوع الطلب:</span>
                <span className="font-bold">
                  {orderTypeLabels[selectedOrder.order_type] || selectedOrder.order_type}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">طريقة الدفع:</span>
                <span className="font-bold">{selectedOrder.payment_method || "كاش"}</span>
              </div>
              {selectedOrder.notes && (
                <div className="p-2.5 bg-amber-50 rounded-xl text-amber-900 border border-amber-200">
                  <span className="font-bold block mb-1">ملاحظات:</span>
                  {selectedOrder.notes}
                </div>
              )}
              <div className="border-t pt-3">
                <div className="font-bold text-slate-800 mb-2">الأصناف:</div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {Array.isArray(selectedOrder.items) &&
                    selectedOrder.items.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center bg-slate-50 p-2 rounded-xl"
                      >
                        <span>
                          {item.name_ar || item.name} (x{item.quantity})
                        </span>
                        <span className="font-black">
                          {Number((item.price || 0) * item.quantity).toFixed(2)} $
                        </span>
                      </div>
                    ))}
                </div>
              </div>
              <div className="border-t pt-3 flex justify-between items-center text-sm font-black">
                <span>الإجمالي الكلي:</span>
                <span className="text-emerald-600">
                  {formatOrderPrice(selectedOrder.total, selectedOrder.notes)}
                </span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Modal */}
      {editingOrder && (
        <Dialog open={!!editingOrder} onOpenChange={(open) => !open && setEditingOrder(null)}>
          <DialogContent className="max-w-md text-right rounded-3xl font-cairo">
            <DialogHeader>
              <DialogTitle className="text-right text-lg font-black block border-b pb-2">
                تعديل الطلب #{String(editingOrder.order_number || editingOrder.id).slice(-6)}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">ملاحظات الطلب</Label>
                <Input
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="ملاحظات..."
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">الإجمالي</Label>
                <Input
                  type="number"
                  value={editTotal}
                  onChange={(e) => setEditTotal(e.target.value)}
                  placeholder="0.00"
                  className="rounded-xl"
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
                <Button
                  onClick={() =>
                    updateOrder.mutate({
                      id: editingOrder.id,
                      notes: editNotes,
                      total: Number(editTotal) || 0,
                    })
                  }
                  className="rounded-xl"
                >
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
