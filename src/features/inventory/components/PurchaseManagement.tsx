// @ts-nocheck
import { useState, useMemo, useEffect } from "react";
import { erpStore, PurchaseOrder, Supplier } from "@/shared/services/erpStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { inventoryService } from "@/features/inventory/services/inventoryService";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  ShoppingCart,
  Truck,
  Calendar,
  FileText,
  CheckCircle,
  Clock,
  ChevronDown,
  AlertCircle,
  Printer,
  DollarSign,
  ArrowRightLeft,
  BookOpen,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { printerService } from "@/shared/services/printerService";

export function PurchaseManagement() {
  const [erpState, setErpState] = useState(erpStore.getState());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    return erpStore.subscribe(() => {
      setErpState(erpStore.getState());
    });
  }, []);

  const [poForm, setPoForm] = useState({
    supplier_id: "",
    notes: "",
    currency: "USD", // "USD" | "SSP"
    exchange_rate: "2800",
  });

  const [itemForm, setItemForm] = useState({
    inventory_id: "",
    quantity: "",
    unit_cost: "",
  });

  const [poItems, setPoItems] = useState<
    {
      inventory_id: string;
      quantity: number;
      unit_cost: number;
      name_ar?: string;
      unit?: string;
    }[]
  >([]);

  const inventoryQuery = useQuery({
    queryKey: ["admin", "inventory"],
    queryFn: () => inventoryService.getInventory(),
  });

  const suppliers = useMemo(
    () => erpState.suppliers.filter((s) => !s.deleted),
    [erpState.suppliers],
  );
  const inventory = useMemo(() => inventoryQuery.data ?? [], [inventoryQuery.data]);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const selectedSupplier = useMemo(() => {
    return suppliers.find((s) => s.id === poForm.supplier_id);
  }, [suppliers, poForm.supplier_id]);

  const addPoItem = () => {
    if (!itemForm.inventory_id || !itemForm.quantity || !itemForm.unit_cost) return;

    const invItem = inventory.find((i) => i.id === itemForm.inventory_id);
    if (!invItem) return;

    setPoItems((prev) => [
      ...prev,
      {
        inventory_id: itemForm.inventory_id,
        name_ar: invItem.name_ar,
        unit: invItem.unit,
        quantity: Number(itemForm.quantity),
        unit_cost: Number(itemForm.unit_cost),
      },
    ]);

    setItemForm({ inventory_id: "", quantity: "", unit_cost: "" });
  };

  const calculateTotal = useMemo(() => {
    const rawSum = poItems.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);
    const tax = rawSum * 0.14;
    return {
      subtotal: rawSum,
      tax,
      total: rawSum + tax,
    };
  }, [poItems]);

  const calculateTotalUsd = useMemo(() => {
    if (poForm.currency === "USD") return calculateTotal.total;
    const rate = Number(poForm.exchange_rate) || 1;
    return rate > 0 ? calculateTotal.total / rate : calculateTotal.total;
  }, [calculateTotal, poForm.currency, poForm.exchange_rate]);

  const attemptCreatePO = (e: React.FormEvent) => {
    e.preventDefault();
    if (!poForm.supplier_id || poItems.length === 0) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار مورد وإضافة صنف واحد على الأقل",
        variant: "destructive",
      });
      return;
    }
    setIsConfirmOpen(true);
  };

  const handleCreateAndReceivePO = async () => {
    setIsConfirmOpen(false);

    // 1. Create PO with multi-currency
    const newPo = erpStore.createPurchaseOrder(
      poForm.supplier_id,
      poItems,
      poForm.notes,
      poForm.currency,
      Number(poForm.exchange_rate) || 1,
    );

    // 2. Immediately try to receive it
    const treasury =
      erpStore.getState().treasuries.find((t) => t.type === "cash") ||
      erpStore.getState().treasuries[0];

    if (!treasury) {
      toast({
        title: "تم حفظ المسودة",
        description: "تم إنشاء أمر الشراء كمسودة لعدم وجود خزينة دفع نشطة.",
        variant: "destructive",
      });
    } else {
      try {
        erpStore.receivePurchaseOrder(newPo.id, treasury.id);

        for (const item of newPo.items) {
          await inventoryService.addTransaction({
            inventory_id: item.inventory_id,
            warehouse_id: "wh-main-default",
            type: "in",
            quantity: item.quantity,
            note: `استلام أمر شراء #${newPo.id.substring(3, 8)}`,
          });
        }

        queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "warehouse_inventory"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "inventory_transactions"] });

        const supAcc = selectedSupplier?.account_code || "24010";
        toast({
          title: "تم حفظ واعتماد أمر الشراء بنجاح ✅",
          description: `تم تحديث رصيد المورد بحساب (${supAcc}) وخصم الخزينة وإيداع البضاعة بالمخزن الرئيسي.`,
        });
      } catch (err: any) {
        toast({
          title: "تم إنشاء الأمر لكن فشل الاستلام",
          description: err.message,
          variant: "destructive",
        });
      }
    }

    setPoItems([]);
    setPoForm({
      supplier_id: "",
      notes: "",
      currency: "USD",
      exchange_rate: "2800",
    });
    setErpState(erpStore.getState());
  };

  const handleDeletePO = async (poId: string) => {
    if (!window.confirm("هل أنت متأكد من حذف حركة المشتريات هذه واسترجاع المخزون والخزينة؟"))
      return;
    try {
      const po = erpState.purchaseOrders.find((p) => p.id === poId);
      if (!po) return;

      // Reverse inventory if received
      if (po.status === "received") {
        for (const item of po.items) {
          await inventoryService.addTransaction({
            inventory_id: item.inventory_id,
            warehouse_id: "wh-main-default",
            type: "out",
            quantity: item.quantity,
            note: `استرجاع وحذف أمر شراء #${po.id.substring(3, 8)}`,
          });
        }
      }

      const storeState = erpStore.getState();
      storeState.purchaseOrders = storeState.purchaseOrders.filter((p) => p.id !== poId);
      erpStore.saveState();

      queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "warehouse_inventory"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory_transactions"] });

      toast({ title: "تم حذف أمر الشراء بنجاح", description: "تم استرجاع الكميات" });
      setErpState(erpStore.getState());
    } catch (err: any) {
      toast({ title: "خطأ في الحذف", description: err.message, variant: "destructive" });
    }
  };

  const handleReceivePO = async (poId: string) => {
    const po = erpState.purchaseOrders.find((p) => p.id === poId);
    if (!po || po.status === "received") return;

    const treasury = erpState.treasuries.find((t) => t.type === "cash") || erpState.treasuries[0];
    if (!treasury) {
      toast({ title: "خطأ", description: "لا يوجد حساب خزينة متاح للدفع", variant: "destructive" });
      return;
    }

    try {
      erpStore.receivePurchaseOrder(poId, treasury.id);

      for (const item of po.items) {
        await inventoryService.addTransaction({
          inventory_id: item.inventory_id,
          warehouse_id: "wh-main-default",
          type: "in",
          quantity: item.quantity,
          note: `استلام أمر شراء #${poId.substring(3, 8)}`,
        });
      }

      setErpState(erpStore.getState());
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "warehouse_inventory"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory_transactions"] });

      const supplier = suppliers.find((s) => s.id === po.supplier_id);
      toast({
        title: "تم استلام الطلبية بنجاح ✅",
        description: `تمت إضافة الكميات للمخزن وقيد ${po.total.toLocaleString()} ${po.currency || "USD"} على حساب المورد (${supplier?.account_code || "24010"}).`,
      });
    } catch (err: any) {
      toast({ title: "فشل الاستلام", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 text-right">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PO Creation Form */}
        <Card className="lg:col-span-2 border border-border/60 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="text-xl font-black flex items-center gap-2">
              <ShoppingCart className="text-primary" size={24} />
              إنشاء أمر شراء وتوريد (Purchase Order)
            </CardTitle>
            <CardDescription>
              يدعم فواتير التوريد بالدولار (USD $) أو الجنيه السوداني (SSP) مع التحويل المحاسبي
              التلقائي.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold text-xs flex items-center justify-between">
                  <span>المورد *</span>
                  {selectedSupplier?.account_code && (
                    <span className="text-[11px] font-mono text-primary font-bold">
                      حساب #{selectedSupplier.account_code}
                    </span>
                  )}
                </Label>
                <select
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-primary"
                  value={poForm.supplier_id}
                  onChange={(e) => setPoForm((s) => ({ ...s, supplier_id: e.target.value }))}
                >
                  <option value="">اختر المورد...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name_ar} {s.account_code ? `(#${s.account_code})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label className="font-bold text-xs">ملاحظات / رقم الفاتورة الورقية</Label>
                <Input
                  value={poForm.notes}
                  onChange={(e) => setPoForm((s) => ({ ...s, notes: e.target.value }))}
                  placeholder="رقم الفاتورة أو أي تفاصيل..."
                  className="rounded-xl h-10"
                />
              </div>
            </div>

            {/* Currency and Exchange Rate Section */}
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/70 grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
              <div className="space-y-1">
                <Label className="text-xs font-bold flex items-center gap-1">
                  <DollarSign size={14} className="text-primary" />
                  عملة الفاتورة
                </Label>
                <select
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-xs font-bold ring-offset-background focus:outline-none focus:ring-2 focus:ring-primary"
                  value={poForm.currency}
                  onChange={(e) =>
                    setPoForm((s) => ({
                      ...s,
                      currency: e.target.value,
                    }))
                  }
                >
                  <option value="USD">دولار أمريكي (USD $)</option>
                  <option value="SSP">جنيه سوداني (SSP)</option>
                </select>
              </div>

              {poForm.currency === "SSP" ? (
                <div className="space-y-1">
                  <Label className="text-xs font-bold flex items-center gap-1">
                    <ArrowRightLeft size={14} className="text-primary" />
                    سعر الصرف (1$ = كم SSP؟)
                  </Label>
                  <Input
                    type="number"
                    value={poForm.exchange_rate}
                    onChange={(e) => setPoForm((s) => ({ ...s, exchange_rate: e.target.value }))}
                    placeholder="2800"
                    className="h-9 rounded-lg bg-background font-mono font-bold text-xs"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-muted-foreground">سعر التحويل</Label>
                  <div className="h-9 flex items-center px-3 rounded-lg bg-background border border-border text-xs text-muted-foreground">
                    1.00 (العملة الأساسية للنظام)
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs font-bold text-muted-foreground">
                  المعادل التقديري بالدولار:
                </Label>
                <div className="h-9 flex items-center px-3 rounded-lg bg-primary/10 border border-primary/20 text-xs font-mono font-black text-primary">
                  $ {calculateTotalUsd.toFixed(2)} USD
                </div>
              </div>
            </div>

            {/* Add Items Sub-form */}
            <div className="border-t border-border pt-4">
              <h4 className="font-bold mb-3 flex items-center gap-2 text-sm text-primary">
                <Plus size={16} />
                إضافة أصناف لأمر الشراء
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div className="md:col-span-2 space-y-1.5">
                  <Label className="text-xs">الصنف من قائمة الخامات / المنتجات</Label>
                  <select
                    className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-primary"
                    value={itemForm.inventory_id}
                    onChange={(e) => setItemForm((s) => ({ ...s, inventory_id: e.target.value }))}
                  >
                    <option value="">اختر الصنف...</option>
                    {inventory.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name_ar} ({i.unit})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">الكمية</Label>
                  <Input
                    type="number"
                    value={itemForm.quantity}
                    onChange={(e) => setItemForm((s) => ({ ...s, quantity: e.target.value }))}
                    className="h-9 rounded-lg"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    سعر الوحدة ({poForm.currency === "SSP" ? "SSP" : "$"})
                  </Label>
                  <Input
                    type="number"
                    value={itemForm.unit_cost}
                    onChange={(e) => setItemForm((s) => ({ ...s, unit_cost: e.target.value }))}
                    className="h-9 rounded-lg"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={addPoItem}
                  className="h-9 px-6 rounded-lg font-bold"
                >
                  <Plus size={14} className="ml-1" />
                  إدراج الصنف في الجدول
                </Button>
              </div>
            </div>

            {poItems.length > 0 && (
              <div className="bg-muted/30 rounded-xl overflow-hidden border border-border/50">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 font-bold text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-right">الصنف</th>
                      <th className="px-3 py-2 text-center">الكمية</th>
                      <th className="px-3 py-2 text-center">
                        سعر الوحدة ({poForm.currency === "SSP" ? "SSP" : "$"})
                      </th>
                      <th className="px-3 py-2 text-center">الإجمالي</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30 text-xs">
                    {poItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 font-bold">{item.name_ar}</td>
                        <td className="px-3 py-2 text-center font-mono">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="px-3 py-2 text-center font-mono">
                          {item.unit_cost.toLocaleString()}{" "}
                          {poForm.currency === "SSP" ? "SSP" : "$"}
                        </td>
                        <td className="px-3 py-2 text-center font-mono font-bold">
                          {(item.quantity * item.unit_cost).toLocaleString()}{" "}
                          {poForm.currency === "SSP" ? "SSP" : "$"}
                        </td>
                        <td className="px-3 py-2 text-left">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => setPoItems((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            <Trash2 size={12} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-primary/5 font-black border-t border-primary/20 text-xs">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-left">
                        إجمالي أمر الشراء (شامل ضريبة 14%):
                      </td>
                      <td className="px-3 py-2 text-center text-primary font-mono text-sm">
                        {calculateTotal.total.toLocaleString()}{" "}
                        {poForm.currency === "SSP" ? "SSP" : "$"}
                        {poForm.currency === "SSP" && (
                          <span className="block text-[10px] text-muted-foreground font-normal">
                            (يعادل: ${calculateTotalUsd.toFixed(2)} USD)
                          </span>
                        )}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            <Button
              className="w-full h-11 rounded-xl font-black text-base shadow-sm"
              onClick={attemptCreatePO}
              disabled={poItems.length === 0}
            >
              حفظ واعتماد أمر الشراء
            </Button>
          </CardContent>
        </Card>

        {/* PO List / Status */}
        <div className="space-y-4">
          <h3 className="font-bold flex items-center gap-2 px-2 text-sm">
            <Clock size={18} />
            سجل المشتريات (أوامر الشراء)
          </h3>
          {erpState.purchaseOrders.map((po) => {
            const supplier = suppliers.find((s) => s.id === po.supplier_id);
            const currencyLabel = po.currency === "SSP" ? "SSP" : "USD $";
            return (
              <Card
                key={po.id}
                className="border border-border/50 shadow-xs overflow-hidden rounded-2xl transition-all hover:shadow-md"
              >
                <CardHeader className="p-4 bg-muted/20 border-b border-border/30">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono bg-background px-2 py-0.5 rounded border border-border text-muted-foreground uppercase">
                          #{po.id.substring(3, 8)}
                        </span>
                        {po.status === "received" ? (
                          <span className="bg-emerald-500/10 text-emerald-600 text-[10px] px-1.5 py-0.5 rounded-full font-black flex items-center gap-1">
                            <CheckCircle size={10} /> تم الاستلام بالخزينة والمخزن
                          </span>
                        ) : (
                          <span className="bg-amber-500/10 text-amber-600 text-[10px] px-1.5 py-0.5 rounded-full font-black flex items-center gap-1">
                            <Clock size={10} /> مسودة
                          </span>
                        )}
                      </div>
                      <h4 className="font-black text-sm mt-1">
                        {supplier?.name_ar || "مورد مجهول"}
                      </h4>
                      {supplier?.account_code && (
                        <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1 mt-0.5">
                          <BookOpen size={10} className="text-primary" />
                          حساب: {supplier.account_code}
                        </div>
                      )}
                    </div>
                    <div className="text-left flex flex-col items-end">
                      <div className="text-[10px] text-muted-foreground">{po.order_date}</div>
                      <div className="font-black text-sm text-primary font-mono">
                        {po.total.toLocaleString()} {currencyLabel}
                      </div>
                      {po.currency === "SSP" && po.total_base_usd && (
                        <div className="text-[10px] text-muted-foreground font-mono">
                          (${po.total_base_usd.toFixed(2)} USD)
                        </div>
                      )}
                      <div className="flex items-center gap-1 mt-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleDeletePO(po.id)}
                        >
                          إلغاء التوريد (حذف)
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => {
                            printerService.printReceipt(
                              {
                                id: po.id,
                                order_number: parseInt(po.id.substring(3, 8), 16) || 0,
                                items: po.items.map((i) => ({
                                  name_ar: i.name_ar || "صنف",
                                  quantity: i.quantity,
                                  price: i.unit_cost,
                                })),
                                subtotal: po.subtotal,
                                tax: po.tax,
                                total: po.total,
                                order_type: "takeaway",
                                payment_method: "cash",
                                status: "completed",
                                created_at: po.order_date,
                                table_id: null,
                              },
                              "print",
                            );
                            toast({ title: "تم إرسال أمر الشراء للطباعة" });
                          }}
                        >
                          <Printer size={12} className="ml-1" /> طباعة
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="text-[11px] text-muted-foreground mb-3">
                    {po.items.length} أصناف | {po.notes || "لا توجد ملاحظات"}
                  </div>
                  {po.status !== "received" && (
                    <Button
                      className="w-full h-8 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => handleReceivePO(po.id)}
                    >
                      استلام وتأكيد الشراء (ربط بالمخزن)
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent className="max-w-md text-right rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-black flex items-center gap-2">
              <CheckCircle className="text-emerald-500" size={20} />
              تأكيد أمر الشراء والتوريد
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs space-y-2">
              <p>
                أنت على وشك اعتماد أمر شراء للمورد{" "}
                <span className="font-bold text-foreground">{selectedSupplier?.name_ar}</span>.
              </p>
              <div className="p-3 rounded-xl bg-muted/40 border border-border/80 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span>المبلغ الإجمالي:</span>
                  <span className="font-mono font-bold text-foreground">
                    {calculateTotal.total.toLocaleString()}{" "}
                    {poForm.currency === "SSP" ? "SSP" : "$"}
                  </span>
                </div>
                {poForm.currency === "SSP" && (
                  <div className="flex justify-between">
                    <span>المعادل بالدولار الأساسي:</span>
                    <span className="font-mono font-bold text-primary">
                      $ {calculateTotalUsd.toFixed(2)} USD
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>الحساب المحاسبي المتأثر:</span>
                  <span className="font-mono font-bold text-primary">
                    {selectedSupplier?.account_code || "24010 (الموردون)"}
                  </span>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-start gap-2">
            <AlertDialogCancel className="rounded-xl font-bold">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl font-black bg-primary"
              onClick={handleCreateAndReceivePO}
            >
              تأكيد وترحيل القيد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
