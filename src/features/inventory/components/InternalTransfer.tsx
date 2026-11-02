import { useState, useMemo } from "react";
import { inventoryService } from "@/features/inventory/services/inventoryService";
import { printAccountingDocument } from "@/shared/utils/printAccountingDocument";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  Info,
  CheckCircle,
  AlertCircle,
  Printer,
  Eye,
  Edit,
  Plus,
  Trash2,
} from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export function InternalTransfer() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // State for View/Print Dialog
  const [selectedTransfer, setSelectedTransfer] = useState<any>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  const [transferItems, setTransferItems] = useState<
    {
      inventory_id: string;
      quantity: number;
      name: string;
      unit: string;
      sourceStock: number;
    }[]
  >([]);

  const [form, setForm] = useState({
    inventory_id: "",
    quantity: "",
    source_warehouse_id: "wh-main-default",
    destination_warehouse_id: "wh-sub-kitchen",
    notes: "",
  });

  const warehousesQuery = useQuery({
    queryKey: ["admin", "warehouses"],
    queryFn: () => inventoryService.getWarehouses(),
  });

  const inventoryQuery = useQuery({
    queryKey: ["admin", "inventory"],
    queryFn: () => inventoryService.getInventory(),
  });

  const warehouseInventoryQuery = useQuery({
    queryKey: ["admin", "warehouse_inventory"],
    queryFn: () => inventoryService.getWarehouseInventory(),
  });

  const transfersQuery = useQuery({
    queryKey: ["admin", "warehouse_transfers"],
    queryFn: () => inventoryService.getWarehouseTransfers(),
  });

  const warehouses = useMemo(() => warehousesQuery.data ?? [], [warehousesQuery.data]);
  const inventory = useMemo(() => inventoryQuery.data ?? [], [inventoryQuery.data]);
  const whInventory = useMemo(
    () => warehouseInventoryQuery.data ?? [],
    [warehouseInventoryQuery.data],
  );
  const transfers = useMemo(() => transfersQuery.data ?? [], [transfersQuery.data]);

  const sourceStock = useMemo(() => {
    if (!form.inventory_id || !form.source_warehouse_id) return 0;
    const row = whInventory.find(
      (r) => r.warehouse_id === form.source_warehouse_id && r.inventory_id === form.inventory_id,
    );
    return Number(row?.quantity || 0);
  }, [form.inventory_id, form.source_warehouse_id, whInventory]);

  const selectedItem = useMemo(
    () => inventory.find((i) => i.id === form.inventory_id),
    [form.inventory_id, inventory],
  );

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.inventory_id || !form.quantity || Number(form.quantity) <= 0) return;

    const existing = transferItems.find((i) => i.inventory_id === form.inventory_id);
    if (existing) {
      toast({ title: "الصنف مضاف مسبقاً", variant: "destructive" });
      return;
    }

    setTransferItems((prev) => [
      ...prev,
      {
        inventory_id: form.inventory_id,
        quantity: Number(form.quantity),
        name: selectedItem?.name_ar || "",
        unit: selectedItem?.unit || "",
        sourceStock,
      },
    ]);

    setForm((s) => ({ ...s, inventory_id: "", quantity: "" }));
  };

  const handleRemoveItem = (inventory_id: string) => {
    setTransferItems((prev) => prev.filter((i) => i.inventory_id !== inventory_id));
  };

  const executeTransfer = async () => {
    setLoading(true);
    try {
      for (const item of transferItems) {
        await inventoryService.transferInventory({
          source_warehouse_id: form.source_warehouse_id,
          destination_warehouse_id: form.destination_warehouse_id,
          inventory_id: item.inventory_id,
          quantity: item.quantity,
          notes: form.notes,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "warehouse_inventory"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "warehouse_transfers"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory_transactions"] });

      setForm((prev) => ({ ...prev, inventory_id: "", quantity: "", notes: "" }));
      setTransferItems([]);
      setIsConfirmOpen(false);
      toast({
        title: "تم التحويل بنجاح ✅",
        description: `تم نقل ${transferItems.length} أصناف من ${warehouses.find((w) => w.id === form.source_warehouse_id)?.name} إلى ${warehouses.find((w) => w.id === form.destination_warehouse_id)?.name}`,
      });
    } catch (err: any) {
      toast({
        title: "فشل التحويل",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePrintTransfer = (t?: any) => {
    const target = t || selectedTransfer;
    if (!target) {
      window.print();
      return;
    }
    const srcWh = warehouses.find((w: any) => w.id === target.source_warehouse_id);
    const dstWh = warehouses.find((w: any) => w.id === target.destination_warehouse_id);
    const itemsList = target.items || [];
    printAccountingDocument({
      title: `سند تحويل مخزني داخلي — ${target.transfer_no || target.id}`,
      subtitle: `من: ${srcWh?.name || target.source_warehouse_id} ← إلى: ${dstWh?.name || target.destination_warehouse_id}`,
      metaItems: [
        { label: "رقم التحويل", value: target.transfer_no || target.id },
        { label: "التاريخ", value: (target.created_at || "").slice(0, 10) },
        { label: "من مستودع", value: srcWh?.name || "-" },
        { label: "إلى مستودع", value: dstWh?.name || "-" },
      ],
      columns: [
        { key: "idx", label: "م" },
        { key: "name", label: "الصنف" },
        { key: "unit", label: "الوحدة" },
        { key: "quantity", label: "الكمية" },
      ],
      rows: itemsList.map((item: any, idx: number) => {
        const inv = inventory.find((i: any) => i.id === item.inventory_id);
        return {
          idx: idx + 1,
          name: inv?.name_ar || (inv as any)?.name || item.inventory_id,
          unit: inv?.unit || "وحدة",
          quantity: item.quantity,
        };
      }),
      totals: [{ label: "إجمالي الأصناف", value: `${itemsList.length} صنف` }],
    });
  };

  const openViewDialog = (t: any) => {
    setSelectedTransfer(t);
    setIsViewOpen(false); // Close first to reset state if needed
    setTimeout(() => setIsViewOpen(true), 10);
  };

  return (
    <div className="space-y-6 text-right">
      <Card className="border border-border/60 shadow-sm rounded-2xl max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-xl font-black flex items-center gap-2">
            <ArrowRightLeft className="text-primary" size={24} />
            تحويل مخزني داخلي (إمداد التشغيل)
          </CardTitle>
          <CardDescription>
            نقل المواد الخام من المخازن الرئيسية إلى مخازن التشغيل والفرن
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold flex items-center gap-1">
                  <ArrowDownRight size={14} className="text-rose-500" />
                  من مخزن (المصدر)
                </Label>
                <select
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.source_warehouse_id}
                  onChange={(e) => setForm((s) => ({ ...s, source_warehouse_id: e.target.value }))}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="font-bold flex items-center gap-1">
                  <ArrowUpRight size={14} className="text-emerald-500" />
                  إلى مخزن (الوجهة)
                </Label>
                <select
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.destination_warehouse_id}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, destination_warehouse_id: e.target.value }))
                  }
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-bold">الصنف المراد تحويله</Label>
              <select
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-primary"
                value={form.inventory_id}
                onChange={(e) => setForm((s) => ({ ...s, inventory_id: e.target.value }))}
              >
                <option value="">اختر الصنف...</option>
                {inventory.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name_ar} ({i.unit})
                  </option>
                ))}
              </select>
              {form.inventory_id && (
                <div className="flex items-center gap-2 mt-1.5 px-3 py-2 bg-muted/40 rounded-lg text-xs">
                  <Info size={14} className="text-primary" />
                  <span>الرصيد المتاح حالياً في المصدر: </span>
                  <span className="font-black text-primary">
                    {sourceStock} {selectedItem?.unit}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold">الكمية المحولة</Label>
                <Input
                  type="number"
                  value={form.quantity}
                  onChange={(e) => setForm((s) => ({ ...s, quantity: e.target.value }))}
                  placeholder="0.00"
                  className="rounded-xl h-10"
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  className="w-full h-10 rounded-xl font-bold gap-2"
                  disabled={
                    !form.inventory_id ||
                    !form.quantity ||
                    Number(form.quantity) <= 0 ||
                    Number(form.quantity) > sourceStock
                  }
                  onClick={handleAddItem}
                >
                  <Plus size={16} />
                  إضافة الصنف للقائمة
                </Button>
              </div>
            </div>

            {form.quantity && Number(form.quantity) > sourceStock && (
              <p className="text-xs text-destructive font-bold flex items-center gap-1 justify-center">
                <AlertCircle size={12} />
                عذراً، الكمية المطلوبة أكبر من الرصيد المتاح في مخزن المصدر
              </p>
            )}

            {transferItems.length > 0 && (
              <div className="border rounded-xl mt-6 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2 text-right">الصنف</th>
                      <th className="px-3 py-2 text-center">الكمية</th>
                      <th className="px-3 py-2 text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transferItems.map((item) => (
                      <tr key={item.inventory_id} className="border-t">
                        <td className="px-3 py-2">{item.name}</td>
                        <td className="px-3 py-2 text-center font-bold text-primary">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="px-3 py-2 text-center flex justify-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemoveItem(item.inventory_id)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="space-y-2 pt-2 border-t mt-4">
              <Label className="font-bold">ملاحظات التحويل</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                placeholder="سبب التحويل..."
                className="rounded-xl h-10"
              />
            </div>

            <Button
              type="button"
              className="w-full h-12 rounded-xl font-black text-base gap-2 mt-4"
              disabled={loading || transferItems.length === 0}
              onClick={() => setIsConfirmOpen(true)}
            >
              <CheckCircle size={20} />
              تأكيد عملية التحويل الآن ({transferItems.length} أصناف)
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4 max-w-4xl mx-auto mt-8">
        <h3 className="font-bold flex items-center gap-2 px-2 text-lg">
          <Package size={20} />
          سجل التحويلات
        </h3>
        <div className="grid gap-3">
          {transfers.map((t) => {
            const item = inventory.find((i) => i.id === t.inventory_id);
            const source = warehouses.find((w) => w.id === t.source_warehouse_id);
            const dest = warehouses.find((w) => w.id === t.destination_warehouse_id);
            return (
              <div
                key={t.id}
                className="bg-card border border-border/50 p-4 rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 text-primary rounded-xl">
                    <ArrowRightLeft size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-base">{item?.name_ar || "صنف مجهول"}</h4>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <span className="text-rose-600 font-semibold">{source?.name}</span>
                      <ArrowRightLeft size={10} className="mx-1" />
                      <span className="text-emerald-600 font-semibold">{dest?.name}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-left">
                    <div className="font-black text-lg text-primary">
                      {t.quantity} {t.unit}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                      {new Date(t.created_at).toLocaleString("ar-EG")}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => openViewDialog(t)}
                      className="h-9 w-9 rounded-lg"
                    >
                      <Eye size={16} />
                    </Button>
                    <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg">
                      <Edit size={16} />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handlePrintTransfer(t)}
                      className="h-9 w-9 rounded-lg"
                    >
                      <Printer size={16} />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
          {transfers.length === 0 && (
            <div className="text-center py-12 bg-muted/20 rounded-2xl border border-border text-muted-foreground text-sm">
              لم يتم تسجيل أي تحويلات مخزنية بعد
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Alert Dialog */}
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent className="text-right">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="text-emerald-500" size={20} />
              تأكيد عملية التحويل
            </AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من تحويل هذه الأصناف؟ ({transferItems.length} صنف)
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="bg-muted p-4 rounded-xl space-y-2 text-sm mt-4">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">عدد الأصناف:</span>
              <span className="font-bold text-primary">{transferItems.length} صنف</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">إجمالي الكميات:</span>
              <span className="font-bold">
                {transferItems.reduce((acc, curr) => acc + curr.quantity, 0)}
              </span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">من مخزن:</span>
              <span className="font-bold text-rose-600">
                {warehouses.find((w) => w.id === form.source_warehouse_id)?.name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">إلى مخزن:</span>
              <span className="font-bold text-emerald-600">
                {warehouses.find((w) => w.id === form.destination_warehouse_id)?.name}
              </span>
            </div>
          </div>
          <AlertDialogFooter className="mt-6 gap-2">
            <AlertDialogCancel disabled={loading}>تراجع</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeTransfer}
              disabled={loading}
              className="bg-primary hover:bg-primary/90"
            >
              {loading ? "جاري التحويل..." : "تأكيد التحويل"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Document Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="sm:max-w-[600px] text-right print:max-w-none print:w-full print:h-full print:m-0 print:border-none print:shadow-none">
          <DialogHeader className="print:hidden">
            <DialogTitle>مستند تحويل مخزني</DialogTitle>
          </DialogHeader>

          {selectedTransfer && (
            <div className="p-6 bg-white space-y-6 rounded-lg print:p-0">
              <div className="flex justify-between items-start border-b pb-4">
                <div>
                  <h2 className="text-2xl font-black">مستند تحويل مخزني</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    رقم المرجع: {selectedTransfer.id.slice(0, 8)}
                  </p>
                </div>
                <div className="text-left font-mono text-sm">
                  {new Date(selectedTransfer.created_at).toLocaleString("ar-EG")}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 p-4 bg-muted/30 rounded-xl border">
                <div>
                  <span className="block text-xs text-muted-foreground mb-1">
                    جهة الإصدار (المصدر)
                  </span>
                  <p className="font-bold text-rose-700">
                    {warehouses.find((w) => w.id === selectedTransfer.source_warehouse_id)?.name}
                  </p>
                </div>
                <div>
                  <span className="block text-xs text-muted-foreground mb-1">
                    جهة الاستلام (الوجهة)
                  </span>
                  <p className="font-bold text-emerald-700">
                    {
                      warehouses.find((w) => w.id === selectedTransfer.destination_warehouse_id)
                        ?.name
                    }
                  </p>
                </div>
              </div>

              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-right font-bold">الصنف</th>
                      <th className="px-4 py-2 text-center font-bold">الكمية</th>
                      <th className="px-4 py-2 text-left font-bold">الوحدة</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t">
                      <td className="px-4 py-3 font-semibold">
                        {inventory.find((i) => i.id === selectedTransfer.inventory_id)?.name_ar}
                      </td>
                      <td className="px-4 py-3 text-center font-black text-lg">
                        {selectedTransfer.quantity}
                      </td>
                      <td className="px-4 py-3 text-left">
                        {selectedTransfer.unit ||
                          inventory.find((i) => i.id === selectedTransfer.inventory_id)?.unit}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {selectedTransfer.notes && (
                <div className="p-4 bg-muted/30 rounded-xl text-sm">
                  <span className="font-bold block mb-1">ملاحظات:</span>
                  <p>{selectedTransfer.notes}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-8 pt-12 mt-8 border-t text-center print:pt-24">
                <div>
                  <div className="border-b border-dashed border-gray-400 w-3/4 mx-auto mb-2"></div>
                  <span className="text-sm font-semibold">توقيع أمين المستودع (المصدر)</span>
                </div>
                <div>
                  <div className="border-b border-dashed border-gray-400 w-3/4 mx-auto mb-2"></div>
                  <span className="text-sm font-semibold">توقيع المستلم (الوجهة)</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="print:hidden">
            <Button variant="outline" onClick={() => setIsViewOpen(false)}>
              إغلاق
            </Button>
            <Button onClick={handlePrintTransfer} className="gap-2">
              <Printer size={16} />
              طباعة المستند
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
