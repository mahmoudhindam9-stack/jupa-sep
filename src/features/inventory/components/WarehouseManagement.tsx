import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { inventoryService } from "../services/inventoryService";
import { printAccountingDocument } from "@/shared/utils/printAccountingDocument";
import { Warehouse, InventoryItem, WarehouseInventory, WarehouseTransfer } from "@/shared/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Plus,
  ArrowLeftRight,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Edit,
  MapPin,
  Package,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  Printer,
  Eye,
} from "lucide-react";

export const WarehouseManagement: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Dialog States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);

  // Print & View Transfer State
  const [selectedTransfer, setSelectedTransfer] = useState<WarehouseTransfer | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  // Add Warehouse Form State
  const [addForm, setAddForm] = useState({
    name: "",
    description: "",
    location: "",
    is_default: false,
    auto_populate_ingredients: true,
  });

  // Edit Warehouse Form State
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    location: "",
    is_active: true,
    is_default: false,
  });

  // Transfer Form State
  const [transferForm, setTransferForm] = useState({
    source_warehouse_id: "",
    destination_warehouse_id: "",
    notes: "",
  });
  const [transferItems, setTransferItems] = useState<{ inventory_id: string; quantity: string }[]>(
    [],
  );
  const [transferItemInput, setTransferItemInput] = useState({
    inventory_id: "",
    quantity: "1",
  });

  // Data Queries
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

  const warehouses = warehousesQuery.data ?? [];
  const inventoryItems = inventoryQuery.data ?? [];
  const warehouseStock = warehouseInventoryQuery.data ?? [];
  const transfers = transfersQuery.data ?? [];

  // Mutations
  const createWarehouseMutation = useMutation({
    mutationFn: (payload: typeof addForm) => inventoryService.createWarehouse(payload),
    onSuccess: () => {
      toast({
        title: "تم إنشاء المخزن",
        description: "تم إنشاء المخزن وتجهيز المكونات المطلوبة للمنيو بنجاح",
      });
      setIsAddOpen(false);
      setAddForm({
        name: "",
        description: "",
        location: "",
        is_default: false,
        auto_populate_ingredients: true,
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "warehouse_inventory"] });
    },
    onError: (err: any) => {
      toast({
        title: "خطأ",
        description: err.message || "حدث خطأ أثناء إنشاء المخزن",
        variant: "destructive",
      });
    },
  });

  const updateWarehouseMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Warehouse> }) =>
      inventoryService.updateWarehouse(id, payload),
    onSuccess: () => {
      toast({
        title: "تم تحديث المخزن",
        description: "تمت تعديل بيانات المخزن بنجاح",
      });
      setIsEditOpen(false);
      setSelectedWarehouse(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "warehouses"] });
    },
    onError: (err: any) => {
      toast({
        title: "خطأ",
        description: err.message || "فشل في تحديث المخزن",
        variant: "destructive",
      });
    },
  });

  const deleteWarehouseMutation = useMutation({
    mutationFn: (id: string) => inventoryService.deleteWarehouse(id),
    onSuccess: () => {
      toast({
        title: "تم حذف المخزن",
        description: "تم حذف المخزن من النظام بنجاح",
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "warehouse_inventory"] });
    },
    onError: (err: any) => {
      toast({
        title: "تعذر الحذف",
        description: err.message || "لا يمكن حذف المخزن لوجود حركات أو ارتبطات سابقة به",
        variant: "destructive",
      });
    },
  });

  const transferMutation = useMutation({
    mutationFn: async (payload: {
      source_warehouse_id: string;
      destination_warehouse_id: string;
      items: { inventory_id: string; quantity: number }[];
      notes?: string;
    }) => {
      for (const item of payload.items) {
        await inventoryService.transferInventory({
          source_warehouse_id: payload.source_warehouse_id,
          destination_warehouse_id: payload.destination_warehouse_id,
          inventory_id: item.inventory_id,
          quantity: item.quantity,
          notes: payload.notes,
        });
      }
    },
    onSuccess: () => {
      toast({
        title: "تم نقل المخزون بنجاح",
        description: "تمت العملية الذرية وتم خصم وإضافة الكميات وإنشاء سجل التحويل بنجاح",
      });
      setIsTransferOpen(false);
      setTransferForm({
        source_warehouse_id: "",
        destination_warehouse_id: "",
        notes: "",
      });
      setTransferItems([]);
      setTransferItemInput({ inventory_id: "", quantity: "1" });
      queryClient.invalidateQueries({ queryKey: ["admin", "warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "warehouse_inventory"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "warehouse_transfers"] });
    },
    onError: (err: any) => {
      toast({
        title: "فشلت عملية النقل",
        description: err.message || "حدث خطأ أثناء إجراء عملية التحويل",
        variant: "destructive",
      });
    },
  });

  const handleOpenEdit = (wh: Warehouse) => {
    setSelectedWarehouse(wh);
    setEditForm({
      name: wh.name,
      description: wh.description || "",
      location: wh.location || "",
      is_active: wh.is_active,
      is_default: wh.is_default,
    });
    setIsEditOpen(true);
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !transferForm.source_warehouse_id ||
      !transferForm.destination_warehouse_id ||
      transferItems.length === 0
    ) {
      toast({
        title: "بيانات ناقصة",
        description: "يرجى تحديد مخزن المصدر والهدف والأصناف المراد تحويلها",
        variant: "destructive",
      });
      return;
    }

    transferMutation.mutate({
      source_warehouse_id: transferForm.source_warehouse_id,
      destination_warehouse_id: transferForm.destination_warehouse_id,
      items: transferItems.map((i) => ({
        inventory_id: i.inventory_id,
        quantity: parseFloat(i.quantity),
      })),
      notes: transferForm.notes,
    });
  };

  const handleAddTransferItem = () => {
    if (!transferItemInput.inventory_id || !transferItemInput.quantity) return;
    const qty = parseFloat(transferItemInput.quantity);
    if (isNaN(qty) || qty <= 0) return;

    setTransferItems((s) => [...s, transferItemInput]);
    setTransferItemInput({ inventory_id: "", quantity: "1" });
  };

  const handlePrintTransfer = (t?: WarehouseTransfer) => {
    const target = t || selectedTransfer;
    if (!target) {
      window.print();
      return;
    }
    const srcWh = warehouses.find((w) => w.id === target.source_warehouse_id);
    const dstWh = warehouses.find((w) => w.id === target.destination_warehouse_id);
    const rawItems = (target as any).items;
    const itemsList =
      Array.isArray(rawItems) && rawItems.length > 0
        ? rawItems
        : [{ inventory_id: target.inventory_id, quantity: target.quantity }];
    const transferRef = (target as any).transfer_no || target.transfer_number || target.id;
    printAccountingDocument({
      title: `سند تحويل مخزني — ${transferRef}`,
      subtitle: `من: ${srcWh?.name || target.source_warehouse_id} ← إلى: ${dstWh?.name || target.destination_warehouse_id}`,
      metaItems: [
        { label: "رقم السند", value: transferRef },
        { label: "التاريخ", value: (target.created_at || "").slice(0, 10) },
        { label: "المستودع المصدر", value: srcWh?.name || "-" },
        { label: "المستودع المستلم", value: dstWh?.name || "-" },
      ],
      columns: [
        { key: "idx", label: "م" },
        { key: "name", label: "الصنف المخزني" },
        { key: "unit", label: "الوحدة" },
        { key: "quantity", label: "الكمية المحولة" },
      ],
      rows: itemsList.map((item: any, idx: number) => {
        const inv = inventoryItems.find((i) => i.id === item.inventory_id);
        return {
          idx: idx + 1,
          name: inv?.name_ar || (inv as any)?.name || item.inventory_id,
          unit: inv?.unit || target.unit || "وحدة",
          quantity: item.quantity,
        };
      }),
      totals: [{ label: "إجمالي عدد الأصناف المحولة", value: `${itemsList.length} صنف` }],
    });
  };

  const openViewDialog = (t: WarehouseTransfer) => {
    setSelectedTransfer(t);
    setIsViewOpen(false);
    setTimeout(() => setIsViewOpen(true), 10);
  };

  // Helper to get source stock level for selected item in transfer dialog
  const sourceStockItem = warehouseStock.find(
    (ws) =>
      ws.warehouse_id === transferForm.source_warehouse_id &&
      ws.inventory_id === transferItemInput.inventory_id,
  );

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border border-border p-5 rounded-2xl shadow-xs">
        <div>
          <h2 className="text-xl font-black text-foreground flex items-center gap-2">
            <Building2 className="text-primary" size={24} />
            <span>إدارة المخازن والربط المتعدد</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            إنشاء وإدارة المخازن، الربط بالفرع والمنيو، وإجراء عمليات التحويل المخزني الذري
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => {
              // Pre-fill source warehouse if available
              if (warehouses.length >= 2) {
                setTransferForm((s) => ({
                  ...s,
                  source_warehouse_id: warehouses[0].id,
                  destination_warehouse_id: warehouses[1].id,
                }));
              }
              setIsTransferOpen(true);
            }}
            variant="outline"
            className="font-bold border-primary text-primary hover:bg-primary/10 gap-1.5"
          >
            <ArrowLeftRight size={16} />
            <span>تحويل بين المخازن</span>
          </Button>

          <Button
            onClick={() => setIsAddOpen(true)}
            className="font-bold bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
          >
            <Plus size={16} />
            <span>إضافة مخزن جديد</span>
          </Button>
        </div>
      </div>

      {/* Warehouses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {warehousesQuery.isLoading ? (
          <div className="col-span-full py-12 text-center text-muted-foreground font-medium">
            جاري تحميل المخازن...
          </div>
        ) : warehouses.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-card border border-dashed rounded-2xl p-8">
            <Building2 className="mx-auto text-muted-foreground mb-3" size={40} />
            <h3 className="font-bold text-base">لا توجد مخازن مضافة بعد</h3>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              اضغط على زر إضافة مخزن جديد لبدء إدارة المخازن المتعددة
            </p>
            <Button onClick={() => setIsAddOpen(true)} className="font-bold text-xs">
              <Plus size={14} className="ml-1" /> إضافة مخزن جديد
            </Button>
          </div>
        ) : (
          warehouses.map((wh) => {
            // Calculate total stock items and total quantity in this warehouse
            const itemsInWh = warehouseStock.filter((s) => s.warehouse_id === wh.id);
            const totalQtyInWh = itemsInWh.reduce((sum, i) => sum + Number(i.quantity || 0), 0);

            return (
              <Card
                key={wh.id}
                className={`relative overflow-hidden border transition-all ${
                  wh.is_default ? "border-primary bg-primary/5 shadow-xs" : "border-border bg-card"
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-black text-foreground">
                          {wh.name}
                        </CardTitle>
                        {wh.is_default && (
                          <Badge className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5 font-bold">
                            افتراضي
                          </Badge>
                        )}
                        <Badge
                          variant={wh.is_active ? "default" : "secondary"}
                          className={`text-[10px] px-2 py-0.5 font-bold ${
                            wh.is_active
                              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                              : ""
                          }`}
                        >
                          {wh.is_active ? "نشط" : "معطل"}
                        </Badge>
                      </div>
                      {wh.location && (
                        <CardDescription className="text-xs flex items-center gap-1 mt-1 text-muted-foreground">
                          <MapPin size={12} /> {wh.location}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-0">
                  {wh.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{wh.description}</p>
                  )}

                  <div className="bg-background/80 border border-border/60 rounded-xl p-3 flex items-center justify-between text-xs font-bold">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Package size={14} /> الأصناف المسجلة بالمخزن:
                    </span>
                    <span className="font-black text-foreground">{itemsInWh.length} صنف</span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                    <div className="flex items-center gap-1">
                      <Button
                        onClick={() => handleOpenEdit(wh)}
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 font-bold text-muted-foreground hover:text-foreground"
                      >
                        <Edit size={14} className="ml-1" /> تعديل
                      </Button>

                      {!wh.is_default && (
                        <Button
                          onClick={() =>
                            updateWarehouseMutation.mutate({
                              id: wh.id,
                              payload: { is_default: true },
                            })
                          }
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2.5 font-bold text-primary hover:bg-primary/10"
                        >
                          جعله افتراضي
                        </Button>
                      )}
                    </div>

                    {!wh.is_default && (
                      <Button
                        onClick={() => {
                          if (confirm(`هل أنت أصل ومتحقق من حذف المخزن "${wh.name}"؟`)) {
                            deleteWarehouseMutation.mutate(wh.id);
                          }
                        }}
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 font-bold text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Inter-Warehouse Transfer Audit Logs Table */}
      <Card className="border border-border">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-black flex items-center gap-2">
              <ArrowUpRight size={18} className="text-primary" />
              <span>سجل التحويلات المخزنية المتبادلة</span>
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              تتبع جميع عمليات نقل البضائع والمكونات بين المخازن مع سجل المراجعة
            </CardDescription>
          </div>
          <Button
            onClick={() => transfersQuery.refetch()}
            variant="outline"
            size="sm"
            className="h-8 font-bold text-xs gap-1"
          >
            <RefreshCw size={12} /> تحديث
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-bold text-right">رقم التحويل</TableHead>
                <TableHead className="font-bold text-right">المححول منه (المصدر)</TableHead>
                <TableHead className="font-bold text-right">المحول إليه (الهدف)</TableHead>
                <TableHead className="font-bold text-right">الصنف</TableHead>
                <TableHead className="font-bold text-center">الكمية</TableHead>
                <TableHead className="font-bold text-right">التاريخ والوقت</TableHead>
                <TableHead className="font-bold text-right">الملاحظات</TableHead>
                <TableHead className="font-bold text-center print:hidden">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-muted-foreground text-xs font-medium"
                  >
                    لا توجد تحويلات مخزنية سابقة حتى الآن
                  </TableCell>
                </TableRow>
              ) : (
                transfers.map((tr) => {
                  const sourceWh = warehouses.find((w) => w.id === tr.source_warehouse_id);
                  const destWh = warehouses.find((w) => w.id === tr.destination_warehouse_id);
                  const item = inventoryItems.find((i) => i.id === tr.inventory_id);

                  return (
                    <TableRow key={tr.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono font-bold text-xs text-primary">
                        {tr.transfer_number}
                      </TableCell>
                      <TableCell className="font-bold text-xs">
                        {sourceWh?.name || "مخزن محذوف"}
                      </TableCell>
                      <TableCell className="font-bold text-xs text-emerald-600 dark:text-emerald-500">
                        {destWh?.name || "مخزن محذوف"}
                      </TableCell>
                      <TableCell className="font-bold text-xs">
                        {item?.name_ar || "صنف محذوف"}
                      </TableCell>
                      <TableCell className="font-black text-center text-xs">
                        {tr.quantity} {tr.unit}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(tr.created_at).toLocaleString("ar-EG")}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {tr.notes || "-"}
                      </TableCell>
                      <TableCell className="text-center print:hidden">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="عرض المستند"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => openViewDialog(tr)}
                          >
                            <Eye size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="طباعة"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => handlePrintTransfer(tr)}
                          >
                            <Printer size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Warehouse Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-black text-lg flex items-center gap-2">
              <Building2 className="text-primary" size={20} />
              إضافة مخزن جديد للنظام
            </DialogTitle>
            <DialogDescription className="text-xs">
              سيتم إنشاء المخزن وتجهيزه تلقائياً بالمكونات المطلوبة لأصناف المنيو.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!addForm.name.trim()) {
                toast({ title: "خطأ", description: "اسم المخزن مطلوب", variant: "destructive" });
                return;
              }
              createWarehouseMutation.mutate(addForm);
            }}
            className="space-y-4 py-2"
          >
            <div>
              <Label className="text-xs font-bold">اسم المخزن *</Label>
              <Input
                className="mt-1"
                placeholder="مثال: مخزن المواد الخام الرئيسي"
                value={addForm.name}
                onChange={(e) => setAddForm((s) => ({ ...s, name: e.target.value }))}
                required
              />
            </div>

            <div>
              <Label className="text-xs font-bold">الموقع / الفرع</Label>
              <Input
                className="mt-1"
                placeholder="مثال: الفرع الثاني - الطابق السفلي"
                value={addForm.location}
                onChange={(e) => setAddForm((s) => ({ ...s, location: e.target.value }))}
              />
            </div>

            <div>
              <Label className="text-xs font-bold">وصف المخزن</Label>
              <Textarea
                className="mt-1 text-xs"
                placeholder="ملاحظات أو وصف توضيحي للمخزن..."
                value={addForm.description}
                onChange={(e) => setAddForm((s) => ({ ...s, description: e.target.value }))}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl border border-border">
              <div>
                <Label className="text-xs font-bold block">تعيين كمخزن افتراضي</Label>
                <span className="text-[11px] text-muted-foreground block">
                  سيتم سحب خصومات الطلبات والتسويات من هذا المخزن بشكل تلقائي
                </span>
              </div>
              <Switch
                checked={addForm.is_default}
                onCheckedChange={(val) => setAddForm((s) => ({ ...s, is_default: val }))}
              />
            </div>

            <div className="flex items-start space-x-2 space-x-reverse p-3 bg-primary/5 rounded-xl border border-primary/20">
              <Checkbox
                id="autoPopulate"
                checked={addForm.auto_populate_ingredients}
                onCheckedChange={(val) =>
                  setAddForm((s) => ({ ...s, auto_populate_ingredients: !!val }))
                }
              />
              <div className="grid gap-1 leading-none">
                <label
                  htmlFor="autoPopulate"
                  className="text-xs font-bold text-primary cursor-pointer leading-tight"
                >
                  إضافة مكونات أصناف المنيو تلقائياً لهذا المخزن (موصى به)
                </label>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  يقوم النظام تلقائياً بربط وتهيئة جميع خامات ومكونات المنيو داخل المخزن الجديد بقدر
                  كمية صفرية لتكون جاهزة لاستلام المشتريات والتحويلات.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddOpen(false)}
                className="font-bold"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={createWarehouseMutation.isPending}
                className="font-bold bg-primary text-primary-foreground"
              >
                {createWarehouseMutation.isPending ? "جاري الإنشاء..." : "حفظ وإنشاء المخزن"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Warehouse Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-black text-lg">تعديل بيانات المخزن</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!selectedWarehouse) return;
              updateWarehouseMutation.mutate({
                id: selectedWarehouse.id,
                payload: editForm,
              });
            }}
            className="space-y-4 py-2"
          >
            <div>
              <Label className="text-xs font-bold">اسم المخزن *</Label>
              <Input
                className="mt-1"
                value={editForm.name}
                onChange={(e) => setEditForm((s) => ({ ...s, name: e.target.value }))}
                required
              />
            </div>

            <div>
              <Label className="text-xs font-bold">الموقع / الفرع</Label>
              <Input
                className="mt-1"
                value={editForm.location}
                onChange={(e) => setEditForm((s) => ({ ...s, location: e.target.value }))}
              />
            </div>

            <div>
              <Label className="text-xs font-bold">الوصف</Label>
              <Textarea
                className="mt-1 text-xs"
                value={editForm.description}
                onChange={(e) => setEditForm((s) => ({ ...s, description: e.target.value }))}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl border border-border">
              <div>
                <Label className="text-xs font-bold block">حالة المخزن</Label>
                <span className="text-[11px] text-muted-foreground block">
                  تعطيل المخزن يمنع اختيار تحويل الكميات إليه
                </span>
              </div>
              <Switch
                checked={editForm.is_active}
                onCheckedChange={(val) => setEditForm((s) => ({ ...s, is_active: val }))}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                className="font-bold"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={updateWarehouseMutation.isPending}
                className="font-bold bg-primary text-primary-foreground"
              >
                {updateWarehouseMutation.isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Transfer Stock Between Warehouses Dialog */}
      <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-black text-lg flex items-center gap-2">
              <ArrowLeftRight className="text-primary" size={20} />
              تحويل كميات مخزنية ذرية
            </DialogTitle>
            <DialogDescription className="text-xs">
              سيتم خصم الكمية من مخزن المصدر وإضافتها لمخزن الهدف في معاملة قاعدة بيانات واحدة
              ذرياً.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleTransferSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">مخزن المصدر (المحول منه) *</Label>
                <select
                  className="mt-1 w-full text-xs font-bold h-10 px-3 bg-background border border-input rounded-xl"
                  value={transferForm.source_warehouse_id}
                  onChange={(e) =>
                    setTransferForm((s) => ({ ...s, source_warehouse_id: e.target.value }))
                  }
                  required
                >
                  <option value="">اختر مخزن المصدر...</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} {w.is_default ? "(الافتراضي)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold">مخزن الهدف (المحول إليه) *</Label>
                <select
                  className="mt-1 w-full text-xs font-bold h-10 px-3 bg-background border border-input rounded-xl"
                  value={transferForm.destination_warehouse_id}
                  onChange={(e) =>
                    setTransferForm((s) => ({ ...s, destination_warehouse_id: e.target.value }))
                  }
                  required
                >
                  <option value="">اختر مخزن الهدف...</option>
                  {warehouses
                    .filter((w) => w.id !== transferForm.source_warehouse_id)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold">الصنف المراد تحويله</Label>
              <div className="flex items-end gap-2 mt-1">
                <div className="flex-1">
                  <select
                    className="w-full text-xs font-bold h-10 px-3 bg-background border border-input rounded-xl"
                    value={transferItemInput.inventory_id}
                    onChange={(e) =>
                      setTransferItemInput((s) => ({ ...s, inventory_id: e.target.value }))
                    }
                  >
                    <option value="">اختر الصنف المخزني...</option>
                    {inventoryItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name_ar} ({item.unit})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-[100px]">
                  <Input
                    type="number"
                    step="any"
                    min="0.001"
                    placeholder="الكمية"
                    className="font-mono font-bold h-10 text-xs"
                    value={transferItemInput.quantity}
                    onChange={(e) =>
                      setTransferItemInput((s) => ({ ...s, quantity: e.target.value }))
                    }
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleAddTransferItem}
                  disabled={!transferItemInput.inventory_id || !transferItemInput.quantity}
                  className="h-10 px-3 font-bold text-xs"
                >
                  <Plus size={16} />
                </Button>
              </div>
            </div>

            {sourceStockItem && (
              <div className="p-3 bg-muted/60 border rounded-xl flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-bold">
                  المتاح حالياً في مخزن المصدر من الصنف المحدد:
                </span>
                <span className="font-black text-primary text-sm">
                  {sourceStockItem.quantity}{" "}
                  {inventoryItems.find((i) => i.id === transferItemInput.inventory_id)?.unit}
                </span>
              </div>
            )}

            {transferItems.length > 0 && (
              <div className="border rounded-xl p-3 bg-muted/20">
                <Label className="text-xs font-bold mb-2 block">الأصناف المضافة للتحويل:</Label>
                <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                  {transferItems.map((item, idx) => {
                    const inv = inventoryItems.find((i) => i.id === item.inventory_id);
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-background p-2 rounded-lg border text-xs"
                      >
                        <span className="font-bold">{inv?.name_ar}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-mono bg-muted px-2 py-1 rounded-md">
                            {item.quantity} {inv?.unit}
                          </span>
                          <button
                            type="button"
                            onClick={() => setTransferItems((s) => s.filter((_, i) => i !== idx))}
                            className="text-destructive hover:bg-destructive/10 p-1 rounded-md"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs font-bold">ملاحظات / سبب التحويل</Label>
              <Input
                className="mt-1 text-xs"
                placeholder="مثال: تغطية نقص في فرع المطبخ"
                value={transferForm.notes}
                onChange={(e) => setTransferForm((s) => ({ ...s, notes: e.target.value }))}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTransferOpen(false)}
                className="font-bold"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={transferMutation.isPending}
                className="font-bold bg-primary text-primary-foreground gap-1"
              >
                {transferMutation.isPending ? "جاري إجراء التحويل..." : "إجراء التحويل الآن"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Document Dialog for Printing */}
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
                    رقم المرجع: {selectedTransfer.transfer_number}
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
                        {
                          inventoryItems.find((i) => i.id === selectedTransfer.inventory_id)
                            ?.name_ar
                        }
                      </td>
                      <td className="px-4 py-3 text-center font-black text-lg">
                        {selectedTransfer.quantity}
                      </td>
                      <td className="px-4 py-3 text-left">{selectedTransfer.unit}</td>
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
            <Button onClick={() => handlePrintTransfer()} className="gap-2">
              <Printer size={16} />
              طباعة المستند
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
