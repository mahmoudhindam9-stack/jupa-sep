import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { currentUserHasPermission, signOutCurrentUser } from "@/shared/services/userAuthorization";
import { CaptainSelfOrderPanel } from "@/components/CaptainSelfOrderPanel";
import { useSettings } from "@/hooks/use-settings";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, UtensilsCrossed, Plus, Settings2, Trash2, Save, X } from "lucide-react";
import { TableOrderModal } from "@/components/TableOrderModal";
import { BackToRestaurantButton } from "@/components/admin/BackToRestaurantButton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { tableOrdersStore, TableOrder } from "@/shared/services/tableOrdersStore";
import { OrderTimer } from "@/components/OrderTimer";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, Printer } from "lucide-react";
import { useSyncExternalStore } from "react";

export const Route = createFileRoute("/captain")({
  head: () => ({ meta: [{ title: "Captain Order" }] }),
  component: CaptainAccessGate,
});

function CaptainAccessGate() {
  const navigate = useNavigate();
  const [accessState, setAccessState] = useState<"checking" | "allowed" | "denied">("checking");
  useEffect(() => {
    let active = true;
    currentUserHasPermission(["captain", "captain_access"])
      .then((allowed) => { if (active) setAccessState(allowed ? "allowed" : "denied"); })
      .catch((error) => {
        console.error("Captain route authorization failed.", error);
        if (active) setAccessState("denied");
      });
    return () => { active = false; };
  }, []);

  if (accessState === "allowed") return <CaptainPage />;
  if (accessState === "checking") {
    return <div className="min-h-screen flex items-center justify-center text-sm font-bold text-muted-foreground">جاري التحقق من صلاحيات حسابك…</div>;
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6" dir="rtl">
      <div role="alert" className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm space-y-4">
        <h1 className="text-xl font-black text-foreground">ليس لديك صلاحية شاشة الكابتن</h1>
        <p className="text-sm text-muted-foreground">يجب تفعيل صلاحية الكابتن من صفحة المستخدمين قبل فتح هذه الشاشة.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => navigate({ to: "/admin" })}>العودة إلى لوحة الإدارة</Button>
          <Button variant="outline" onClick={async () => { await signOutCurrentUser(); navigate({ to: "/login" }); }}>تسجيل الخروج</Button>
        </div>
      </div>
    </div>
  );
}

type Table = {
  id: string;
  number: number;
  name: string | null;
  capacity: number;
  status: "available" | "occupied" | "reserved" | "cleaning";
};

const statusLabels: Record<string, string> = {
  available: "متاح",
  occupied: "مشغول",
  reserved: "محجوز",
  cleaning: "تنظيف",
};

const statusColors: Record<string, string> = {
  available: "bg-emerald-100 text-emerald-700 border-emerald-200",
  occupied: "bg-rose-100 text-rose-700 border-rose-200",
  reserved: "bg-amber-100 text-amber-700 border-amber-200",
  cleaning: "bg-sky-100 text-sky-700 border-sky-200",
};

const LOCAL_TABLES_KEY = "restocash_tables_v1";

function getLocalTables(): Table[] {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(LOCAL_TABLES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalTables(tables: Table[]) {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return;
    localStorage.setItem(LOCAL_TABLES_KEY, JSON.stringify(tables));
  } catch (e) {
    console.error("Failed to save local tables:", e);
  }
}

function CaptainPage() {
  const { lang, currency } = useSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const tableOrders = useSyncExternalStore(
    tableOrdersStore.subscribe.bind(tableOrdersStore),
    () => tableOrdersStore.getAllOrders(),
    () => [],
  );

  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Manage Table State
  const [manageTableOpen, setManageTableOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrTableId, setQrTableId] = useState("");
  const [qrWelcomeMessage, setQrWelcomeMessage] = useState("أهلاً بك! يمكنك الطلب الآن.");
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [form, setForm] = useState({ number: "", name: "", capacity: "" });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<Table | null>(null);

  const tablesQuery = useQuery({
    queryKey: ["tables"],
    queryFn: async () => {
      let dbTables: Table[] = [];
      try {
        const { data, error } = await supabase.from("tables").select("*").order("number");
        if (!error && data) {
          dbTables = data as Table[];
        }
      } catch (err) {
        console.warn("Could not fetch tables from Supabase, using local fallback:", err);
      }

      const localTables = getLocalTables();
      const dbIds = new Set(dbTables.map((t) => t.id));
      const uniqueLocal = localTables.filter((lt) => !dbIds.has(lt.id));
      const merged = [...dbTables, ...uniqueLocal].sort((a, b) => a.number - b.number);

      if (merged.length === 0) {
        const defaultTables: Table[] = [
          { id: "tbl-1", number: 1, name: "طاولة 1", capacity: 4, status: "available" },
          { id: "tbl-2", number: 2, name: "طاولة 2", capacity: 2, status: "available" },
          { id: "tbl-3", number: 3, name: "طاولة 3", capacity: 6, status: "available" },
          { id: "tbl-4", number: 4, name: "طاولة 4", capacity: 4, status: "available" },
        ];
        saveLocalTables(defaultTables);
        return defaultTables;
      }

      return merged;
    },
    refetchInterval: 5000,
  });

  const tablesList = tablesQuery.data || getLocalTables() || [];

  // Realtime Incoming Pending Orders

  // Load from local storage to survive reloads

  // Save to local storage whenever it changes

  useEffect(() => {
    const channel = supabase
      .channel("orders_channel")
      .on("broadcast", { event: "NEW_ORDER" }, (payload) => {
        const order = payload.payload;

        // Find table number
        const tblId = order.table_id || "tbl-999";
        const tblMatch = tablesList.find((t) => t.id === tblId);
        const tblNum = tblMatch ? tblMatch.number : parseInt(tblId.replace("tbl-", "")) || 999;
        const tblName = tblMatch ? tblMatch.name : null;

        // Save as a TableOrder directly
        tableOrdersStore.saveOrder({
          id: order.id,
          table_id: tblId,
          table_number: tblNum,
          table_name: tblName,
          items: order.items,
          order_type: order.order_type || "dine_in",
          notes: order.notes || "طلب ذاتي من العميل",
          selectedAdditions: [],
          subtotal: order.subtotal,
          tax: order.tax,
          total: order.total,
          status: "draft",
          is_self_order: true,
        });

        toast({
          title: "طلب ذاتي جديد!",
          description: `تم استلام طلب ذاتي جديد من طاولة ${tblNum}.`,
          variant: "default",
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tablesList]);

  const handleAcceptOrder = async (order: any) => {
    if (order?.id) {
      const { error } = await supabase
        .from("orders")
        .update({ status: "sent_to_cashier" })
        .eq("id", order.id);
      if (error) {
        toast({
          title: "تعذر إرسال الطلب للكاشير",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
    }

    tableOrdersStore.saveOrder({
      status: "sent_to_cashier",
      table_id: order.table_id,
      table_number: parseInt(order.table_id.replace("tbl-", "")) || 999,
      table_name: `طاولة ${order.table_id.replace("tbl-", "")}`,
      items: (order.items || []).map((item: any) => ({
        ...item,
        notes: item?.notes || item?.note || "",
        selectedAdditions: item?.selectedAdditions || [],
      })),
      order_type: "dine_in",
      notes: order.notes,
      selectedAdditions: order.selectedAdditions || [],
      subtotal: order.subtotal,
      tax: order.tax,
      total: order.total,
      sentToKitchen: Boolean(order.sentToKitchen),
      kitchenCompleted: Boolean(order.kitchenCompleted),
      kitchenOrderId: order.kitchenOrderId,
    });

    toast({ title: "تم قبول الطلب وإرساله للكاشير بنجاح." });
  };

  const handleEditOrder = async (order: any) => {
    tableOrdersStore.saveOrder({
      table_id: order.table_id,
      table_number: parseInt(order.table_id.replace("tbl-", "")) || 999,
      table_name: `طاولة ${order.table_id.replace("tbl-", "")}`,
      items: (order.items || []).map((item: any) => ({
        ...item,
        notes: item?.notes || item?.note || "",
        selectedAdditions: item?.selectedAdditions || [],
      })),
      order_type: "dine_in",
      notes: order.notes,
      selectedAdditions: order.selectedAdditions || [],
      subtotal: order.subtotal,
      tax: order.tax,
      total: order.total,
      status: "draft",
    });

    // We should also delete it from Supabase so it's not pending anymore

    // find the table in tablesQuery.data and set it
    let t = tablesList.find((t) => t.id === order.table_id);
    if (!t) {
      t = {
        id: order.table_id,
        number: parseInt(order.table_id.replace("tbl-", "")) || 999,
        name: `طاولة ${order.table_id.replace("tbl-", "")}`,
        capacity: 4,
        status: "available",
      };
    }
    setSelectedTable(t);
  };

  const handleRejectOrder = async (orderId: string) => {
    toast({ title: "تم رفض الطلب.", variant: "destructive" });
  };

  useEffect(() => {
    const channel = supabase
      .channel("tables_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tables" }, () => {
        queryClient.invalidateQueries({ queryKey: ["tables"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const saveTable = useMutation({
    mutationFn: async (values: {
      id?: string;
      number: number;
      name: string | null;
      capacity: number;
    }) => {
      const tableId = values.id || `tbl_local_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const newTableObj: Table = {
        id: tableId,
        number: values.number,
        name: values.name,
        capacity: values.capacity,
        status: "available",
      };

      try {
        if (values.id) {
          const { error } = await supabase
            .from("tables")
            .update({
              number: values.number,
              name: values.name,
              capacity: values.capacity,
            })
            .eq("id", values.id);
          if (error) console.warn("Supabase update table warning:", error);
        } else {
          const { error } = await supabase.from("tables").insert({
            id: tableId,
            number: values.number,
            name: values.name,
            capacity: values.capacity,
            status: "available",
          });
          if (error) console.warn("Supabase insert table warning:", error);
        }
      } catch (dbErr) {
        console.warn("Supabase connection failed, relying on local table storage:", dbErr);
      }

      const currentLocal = getLocalTables();
      const existingIdx = currentLocal.findIndex(
        (t) => t.id === tableId || t.number === values.number,
      );
      if (existingIdx >= 0) {
        currentLocal[existingIdx] = { ...currentLocal[existingIdx], ...newTableObj };
      } else {
        currentLocal.push(newTableObj);
      }
      saveLocalTables(currentLocal);
      return newTableObj;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      setManageTableOpen(false);
      setEditingTable(null);
      toast({
        title: "تم حفظ الطاولة بنجاح",
      });
    },
    onError: (err: any) => {
      toast({
        title: "خطأ",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const deleteTable = useMutation({
    mutationFn: async (id: string) => {
      try {
        await supabase.from("tables").delete().eq("id", id);
      } catch (e) {
        console.warn("Supabase delete table failed:", e);
      }
      const currentLocal = getLocalTables().filter((t) => t.id !== id);
      saveLocalTables(currentLocal);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      setDeleteConfirmOpen(false);
      setTableToDelete(null);
      setManageTableOpen(false);
      toast({
        title: "تم الحذف بنجاح",
      });
    },
    onError: (err: any) => {
      toast({
        title: "خطأ",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleOpenManage = (t?: Table) => {
    if (t) {
      setEditingTable(t);
      setForm({
        number: String(t.number),
        name: t.name || "",
        capacity: String(t.capacity),
      });
    } else {
      setEditingTable(null);
      setForm({ number: "", name: "", capacity: "" });
    }
    setManageTableOpen(true);
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.number) return;
    saveTable.mutate({
      id: editingTable?.id,
      number: Number(form.number),
      name: form.name || null,
      capacity: Number(form.capacity) || 4,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-cairo">
      <div className="max-w-7xl mx-auto w-full px-4 pt-4">
        <BackToRestaurantButton />
      </div>
      {/* Header */}
      <header className="bg-slate-900 text-white p-4 shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition">
              <ArrowRight size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-black flex items-center gap-2">
                <UtensilsCrossed className="text-amber-500" />
                {lang === "ar" ? "الكابتن (Captain Order)" : "Captain Order"}
              </h1>
              <p className="text-xs text-slate-400">
                {lang === "ar"
                  ? "إنشاء طلبات الطاولات وإرسالها وإدارتها"
                  : "Create, send, and manage table orders"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => setIsQrModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5 shadow-sm"
            >
              <QrCode size={16} />
              {lang === "ar" ? "باركود الطلب الذاتي" : "Self-Order QR"}
            </Button>
            <Button
              onClick={() => handleOpenManage()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 shadow-sm"
            >
              <Plus size={16} />
              {lang === "ar" ? "إضافة طاولة" : "Add Table"}
            </Button>
            <Link
              to="/oven"
              className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold transition flex items-center gap-2"
            >
              <UtensilsCrossed size={16} />
              {lang === "ar" ? "شاشة الفرن" : "Oven"}
            </Link>
            <Button
              variant={isEditMode ? "secondary" : "outline"}
              className={`gap-2 ${isEditMode ? "bg-amber-500 text-white hover:bg-amber-600 border-amber-500" : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"}`}
              onClick={() => setIsEditMode(!isEditMode)}
            >
              <Settings2 size={16} />
              {isEditMode
                ? lang === "ar"
                  ? "إنهاء التعديل"
                  : "Done Editing"
                : lang === "ar"
                  ? "تعديل الطاولات"
                  : "Edit Tables"}
            </Button>
          </div>
        </div>
      </header>
      <CaptainSelfOrderPanel />

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 overflow-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 mt-6">
          {(tablesQuery.data ?? []).map((t) => {
            const activeOrder = tableOrders.find(
              (o) =>
                o.table_id === t.id && (o.status === "draft" || o.status === "sent_to_cashier"),
            );
            return (
              <div
                key={t.id}
                className={`bg-white border-2 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col h-full cursor-pointer relative overflow-hidden group ${isEditMode ? "border-amber-400 ring-2 ring-amber-400/20" : statusColors[t.status]}`}
                onClick={() => {
                  if (isEditMode) {
                    handleOpenManage(t);
                  } else {
                    setSelectedTable(t);
                  }
                }}
              >
                <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform">
                  <UtensilsCrossed size={80} />
                </div>

                <div className="flex items-center justify-between mb-2 relative z-10">
                  <span className="font-black text-2xl text-slate-900">#{t.number}</span>
                  {isEditMode && (
                    <div className="bg-amber-100 text-amber-700 p-1.5 rounded-lg">
                      <Settings2 size={16} />
                    </div>
                  )}
                </div>

                <div className="mb-2 relative z-10">
                  <div className="font-bold text-slate-700">
                    {t.name || (lang === "ar" ? "طاولة" : "Table")}
                  </div>
                  {!isEditMode && (
                    <div className="text-xs font-semibold mt-1 bg-white/50 inline-block px-2 py-0.5 rounded-full border border-current">
                      {lang === "ar" ? statusLabels[t.status] : t.status}
                    </div>
                  )}
                </div>

                {activeOrder && (
                  <div className="relative z-10 mt-1 mb-2">
                    <div className="flex flex-col gap-1.5">
                      {activeOrder.sentToKitchen && !activeOrder.kitchenCompleted && (
                        <div className="flex justify-between items-center bg-orange-100/80 border border-orange-200 px-2 py-1 rounded-lg">
                          <span className="text-[10px] font-bold text-orange-800">
                            في المطبخ/الفرن 👨‍🍳
                          </span>
                          <OrderTimer
                            createdAt={activeOrder.updated_at || activeOrder.created_at}
                          />
                        </div>
                      )}
                      {activeOrder.status === "sent_to_cashier" && (
                        <div className="flex justify-between items-center bg-emerald-100/80 border border-emerald-200 px-2 py-1 rounded-lg">
                          <span className="text-[10px] font-bold text-emerald-800">
                            بانتظار الدفع 💰
                          </span>
                          <span className="font-bold text-xs text-emerald-900">
                            {Number(activeOrder.total ?? 0).toFixed(2)} {currency}
                          </span>
                        </div>
                      )}
                      {activeOrder.status === "draft" && !activeOrder.sentToKitchen && (
                        <div className="flex justify-between items-center bg-sky-100/80 border border-sky-200 px-2 py-1 rounded-lg">
                          <span className="text-[10px] font-bold text-sky-800">طلب جديد 🛒</span>
                          <span className="font-bold text-xs text-sky-900">
                            {Number(activeOrder.total ?? 0).toFixed(2)} {currency}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-auto relative z-10 flex items-center gap-1 text-xs font-bold text-slate-800">
                  {lang === "ar" ? "السعة:" : "Capacity:"} {t.capacity}{" "}
                  {lang === "ar" ? "أفراد" : "pax"}
                </div>
              </div>
            );
          })}

          {isEditMode && (
            <div
              className="bg-slate-100 border-2 border-dashed border-slate-300 rounded-2xl p-4 shadow-sm hover:shadow-md hover:bg-slate-200 hover:border-slate-400 transition-all flex flex-col items-center justify-center h-full cursor-pointer min-h-[140px]"
              onClick={() => handleOpenManage()}
            >
              <div className="bg-white p-3 rounded-full shadow-sm mb-2 text-slate-600">
                <Plus size={24} />
              </div>
              <span className="font-bold text-slate-700">
                {lang === "ar" ? "إضافة طاولة" : "Add Table"}
              </span>
            </div>
          )}

          {tablesQuery.data?.length === 0 && !isEditMode && (
            <div className="col-span-full py-12 text-center text-slate-500 font-bold">
              {lang === "ar"
                ? "لا توجد طاولات مضافة في النظام حالياً"
                : "No tables added to the system"}
            </div>
          )}
        </div>
      </main>

      {selectedTable && (
        <TableOrderModal
          table={selectedTable}
          isOpen={true}
          onClose={() => setSelectedTable(null)}
          onOrderSent={() => setSelectedTable(null)}
        />
      )}

      {/* Manage Table Dialog */}
      <Dialog open={manageTableOpen} onOpenChange={setManageTableOpen}>
        <DialogContent className="sm:max-w-[425px]" dir={lang === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>
              {editingTable
                ? lang === "ar"
                  ? "تعديل الطاولة"
                  : "Edit Table"
                : lang === "ar"
                  ? "إضافة طاولة جديدة"
                  : "Add New Table"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveSubmit} className="space-y-4 py-4">
            <div className="space-y-2 text-right">
              <Label className="font-bold">
                {lang === "ar" ? "رقم الطاولة *" : "Table Number *"}
              </Label>
              <Input
                type="number"
                required
                value={form.number}
                onChange={(e) => setForm((s) => ({ ...s, number: e.target.value }))}
                className="text-right"
              />
            </div>

            <div className="space-y-2 text-right">
              <Label className="font-bold">
                {lang === "ar" ? "اسم الطاولة (اختياري)" : "Table Name (Optional)"}
              </Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                placeholder={lang === "ar" ? "مثال: طاولة العائلات 1" : "e.g. Family Table 1"}
                className="text-right"
              />
            </div>

            <div className="space-y-2 text-right">
              <Label className="font-bold">
                {lang === "ar" ? "السعة (أفراد) *" : "Capacity (Pax) *"}
              </Label>
              <Input
                type="number"
                required
                value={form.capacity}
                onChange={(e) => setForm((s) => ({ ...s, capacity: e.target.value }))}
                className="text-right"
              />
            </div>

            <DialogFooter className="pt-4 flex items-center justify-between sm:justify-between w-full">
              {editingTable ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setTableToDelete(editingTable);
                    setDeleteConfirmOpen(true);
                  }}
                  className="gap-2"
                >
                  <Trash2 size={16} />
                  {lang === "ar" ? "حذف" : "Delete"}
                </Button>
              ) : (
                <div></div>
              )}

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setManageTableOpen(false)}>
                  {lang === "ar" ? "إلغاء" : "Cancel"}
                </Button>
                <Button type="submit" disabled={saveTable.isPending} className="gap-2">
                  <Save size={16} />
                  {lang === "ar" ? "حفظ" : "Save"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent dir={lang === "ar" ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">
              {lang === "ar" ? "تأكيد الحذف" : "Confirm Deletion"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              {lang === "ar"
                ? `هل أنت متأكد من حذف الطاولة رقم ${tableToDelete?.number}؟ لا يمكن التراجع عن هذا الإجراء.`
                : `Are you sure you want to delete table #${tableToDelete?.number}? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse sm:justify-start">
            <AlertDialogCancel>{lang === "ar" ? "تراجع" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white mr-2"
              disabled={deleteTable.isPending}
              onClick={() => {
                if (tableToDelete) deleteTable.mutate(tableToDelete.id);
              }}
            >
              {lang === "ar" ? "نعم، احذف" : "Yes, Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Self-Ordering QR Code Generator */}
      <Dialog open={isQrModalOpen} onOpenChange={setIsQrModalOpen}>
        <DialogContent
          dir={lang === "ar" ? "rtl" : "ltr"}
          className="sm:max-w-md bg-white p-4 sm:p-5 max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader className={lang === "ar" ? "text-right" : "text-left"}>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <QrCode className="text-indigo-600" />
              {lang === "ar" ? "باركود الطلب الذاتي" : "Self-Ordering QR Code"}
            </DialogTitle>
          </DialogHeader>

          {(() => {
            const selectedT = tablesList.find((t) => t.id === qrTableId);
            const displayedTableNumber = selectedT ? selectedT.number : "";
            const origin = typeof window !== "undefined" ? window.location.origin : "";
            const qrUrl = `${origin}/menu${qrTableId ? `?tableId=${qrTableId}&table=${displayedTableNumber}` : ""}`;

            return (
              <>
                <div className="space-y-3 py-1 print:hidden">
                  <div className="space-y-1.5">
                    <Label
                      className={
                        lang === "ar"
                          ? "text-right block text-xs font-bold text-slate-700"
                          : "text-left block text-xs font-bold text-slate-700"
                      }
                    >
                      {lang === "ar" ? "رقم الطاولة (اختياري)" : "Table Number (Optional)"}
                    </Label>
                    <select
                      value={qrTableId}
                      onChange={(e) => setQrTableId(e.target.value)}
                      className={`w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 ${lang === "ar" ? "text-right" : "text-left"}`}
                    >
                      <option value="">
                        {lang === "ar"
                          ? "-- بدون طاولة محددة (عام) --"
                          : "-- No specific table (General) --"}
                      </option>
                      {tablesList.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name || `طاولة ${t.number}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      className={
                        lang === "ar"
                          ? "text-right block text-xs font-bold text-slate-700"
                          : "text-left block text-xs font-bold text-slate-700"
                      }
                    >
                      {lang === "ar" ? "رسالة الترحيب" : "Welcome Message"}
                    </Label>
                    <Input
                      value={qrWelcomeMessage}
                      onChange={(e) => setQrWelcomeMessage(e.target.value)}
                      className={`h-10 text-sm ${lang === "ar" ? "text-right" : "text-left"}`}
                    />
                  </div>
                </div>

                <div
                  className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-100 my-1"
                  id="print-qr-area"
                >
                  <h3 className="text-base font-black text-slate-800 mb-1">
                    {qrWelcomeMessage || (lang === "ar" ? "أهلاً بك!" : "Welcome!")}
                  </h3>
                  {displayedTableNumber && (
                    <p className="text-sm font-bold text-slate-500 mb-3" id="print-table-number">
                      {lang === "ar"
                        ? `طاولة رقم ${displayedTableNumber}`
                        : `Table #${displayedTableNumber}`}
                    </p>
                  )}
                  {!displayedTableNumber && <div className="mb-3" />}

                  <div
                    className="bg-white p-2.5 rounded-xl shadow-xs border border-slate-200"
                    id="print-qr-svg"
                  >
                    <QRCodeSVG value={qrUrl} size={160} level={"H"} includeMargin={true} />
                  </div>
                  <p className="text-[11px] font-bold text-slate-400 mt-3 text-center">
                    {lang === "ar"
                      ? "قم بمسح الباركود للطلب المباشر"
                      : "Scan QR code to order directly"}
                  </p>
                </div>

                <DialogFooter className="sm:justify-between mt-2 pt-2 border-t border-slate-100 flex-row gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsQrModalOpen(false)}
                    className="print:hidden flex-1 sm:flex-none h-10 rounded-xl"
                  >
                    {lang === "ar" ? "إغلاق" : "Close"}
                  </Button>
                  <Button
                    className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 print:hidden flex-1 sm:flex-none h-10 rounded-xl"
                    onClick={() => {
                      const titleEl = document.querySelector("#print-qr-area h3");
                      const tableEl = document.getElementById("print-table-number");
                      const svgEl = document.getElementById("print-qr-svg");
                      const printWindow = window.open("", "", "width=600,height=600");
                      if (printWindow) {
                        printWindow.document.write(`
                            <html>
                              <head>
                                <title>Print QR Code</title>
                                <style>
                                  body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; flex-direction: column; background: #fff; }
                                  .qr-container { text-align: center; }
                                  h3 { margin-bottom: 4px; font-size: 24px; color: #0f172a; font-weight: 900; }
                                  p.table-num { margin-top: 0; color: #475569; font-size: 18px; margin-bottom: 24px; font-weight: bold; }
                                  .footer { font-size: 14px; color: #94a3b8; margin-top: 24px; font-weight: bold; }
                                </style>
                              </head>
                              <body>
                                <div class="qr-container">
                                  <h3>${titleEl ? titleEl.textContent : ""}</h3>
                                  <p class="table-num">${tableEl ? tableEl.textContent : ""}</p>
                                  ${svgEl ? svgEl.innerHTML : ""}
                                  <div class="footer">${lang === "ar" ? "قم بمسح الباركود للطلب المباشر" : "Scan QR code to order directly"}</div>
                                </div>
                              </body>
                            </html>
                          `);
                        printWindow.document.close();
                        printWindow.focus();
                        setTimeout(() => {
                          printWindow.print();
                          printWindow.close();
                        }, 250);
                      }
                    }}
                  >
                    <Printer size={16} />
                    {lang === "ar" ? "طباعة الباركود" : "Print QR Code"}
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
