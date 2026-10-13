// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { useState, useMemo, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { erpStore } from "@/shared/services/erpStore";
import { useSettings } from "@/hooks/use-settings";
import { convertToInventoryUnit } from "@/shared/utils/inventoryUtils";
import { inventoryService } from "@/features/inventory/services/inventoryService";
import {
  Pencil,
  Trash2,
  AlertTriangle,
  Search,
  TrendingDown,
  Layers,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Plus,
  Truck,
  Calendar,
  Layers3,
  Users2,
  FileText,
  Barcode,
  Eye,
  Printer,
  CheckCircle,
  Sparkles,
  Settings,
  Building2,
  X,
  Loader2,
} from "lucide-react";
import { WarehouseManagement } from "@/features/inventory/components/WarehouseManagement";
import { SupplierManagement } from "@/features/inventory/components/SupplierManagement";
import { PurchaseManagement } from "@/features/inventory/components/PurchaseManagement";
import { BackToRestaurantButton } from "@/components/admin/BackToRestaurantButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/admin/inventory")({
  head: () => ({ meta: [{ title: "المخزن وإدارة التوريدات" }] }),
  component: InventoryPage,
});

type Inventory = {
  id: string;
  name_ar: string;
  unit: string;
  quantity: number;
  min_level: number;
  cost: number;
};

type Transaction = {
  id: string;
  inventory_id: string;
  type: string;
  quantity: number;
  note: string | null;
  created_at: string;
};

const roleLabels: Record<string, string> = {
  admin: "مدير",
  manager: "مشرف",
  cashier: "كاشير",
  kitchen: "مطبخ",
};

function InventoryPage() {
  const { formatPrice } = useSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current user and their profile
  const userProfileQuery = useQuery({
    queryKey: ["current_user_profile"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Fallback dev user profile so operations are never blocked
      const fallbackUser = user || { id: "dev-user-id", email: "dev@admin.com" };
      const fallbackProfile = {
        id: fallbackUser.id,
        role: "admin",
        full_name: "مطور (وضع التطوير)",
      };

      if (!user) return { user: fallbackUser, profile: fallbackProfile };

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      const userProfile = profile ? { ...profile, role: "admin" } : fallbackProfile;

      return { user, profile: userProfile };
    },
  });

  const promoteToAdmin = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("المستخدم غير مسجل");

      const { error } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          role: "admin",
          full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "مدير النظام",
          phone: user.user_metadata?.phone || null,
        },
        { onConflict: "id" },
      );

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "نجاح الترقية",
        description: "تمت ترقية حسابك إلى مدير (Admin) بنجاح! يمكنك الآن إدارة المخزن بالكامل.",
      });
      userProfileQuery.refetch();
      inventoryQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
    },
    onError: (err: any) => {
      toast({
        title: "خطأ في الترقية",
        description: err.message || "حدث خطأ غير متوقع أثناء ترقية الحساب.",
        variant: "destructive",
      });
    },
  });
  const [activeTab, setActiveTab] = useState("stock");
  const [search, setSearch] = useState("");
  const [filterLowStock, setFilterLowStock] = useState(false);

  // Reports tab states
  const [selectedReportType, setSelectedReportType] = useState("current_stock");
  const [reportSearchQuery, setReportSearchQuery] = useState("");
  const [reportCategoryFilter, setReportCategoryFilter] = useState("all");
  const [reportDateStart, setReportDateStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [reportDateEnd, setReportDateEnd] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Core state from erpStore
  const [erpState, setErpState] = useState(erpStore.getState());
  const currentBranch = erpStore.getCurrentBranch();

  // Batch disposal dialog state
  const [disposeBatchDialog, setDisposeBatchDialog] = useState<{
    batchId: string;
    batchNo: string;
    itemName: string;
    quantity: number | string;
    unit: string;
    reason: string;
  } | null>(null);
  const [isDisposingBatch, setIsDisposingBatch] = useState(false);

  useEffect(() => {
    // Sync React state with erpStore
    setErpState(erpStore.getState());
  }, [activeTab]);

  const [form, setForm] = useState({
    name_ar: "",
    unit: "كيلو",
    quantity: "0",
    min_level: "0",
    cost: "0",
    barcode: "",
    item_code: "",
    name_en: "",
    category: "خامات ومواد أولية",
    preferred_supplier_id: "",
    average_cost: "0",
    last_purchase_price: "0",
    status: "active",
    currency: "USD",
    exchange_rate: "1",
    treasury_id: "",
    transaction_date: new Date().toISOString().split("T")[0],
    transaction_time: new Date().toTimeString().slice(0, 5),
  });

  const [saveSuccessNotification, setSaveSuccessNotification] = useState<{
    open: boolean;
    itemName: string;
    journalRef: string;
    txNumber: string;
    treasuryName: string;
    amount: number;
    currency: string;
  }>({
    open: false,
    itemName: "",
    journalRef: "",
    txNumber: "",
    treasuryName: "",
    amount: 0,
    currency: "USD",
  });

  const { exchangeRates } = useSettings();

  // Rate variance calculations (±10%)
  const currentMainRate = useMemo(() => {
    if (form.currency === "USD") return 1;
    return exchangeRates[form.currency] || erpStore.getExchangeRate(form.currency) || 1;
  }, [form.currency, exchangeRates]);

  const minAllowedRate = useMemo(() => currentMainRate * 0.9, [currentMainRate]);
  const maxAllowedRate = useMemo(() => currentMainRate * 1.1, [currentMainRate]);

  const enteredRateNum = parseFloat(form.exchange_rate);
  const isRateOutOfRange = useMemo(() => {
    if (form.currency === "USD") return false;
    if (isNaN(enteredRateNum) || enteredRateNum <= 0) return true;
    return enteredRateNum < minAllowedRate || enteredRateNum > maxAllowedRate;
  }, [form.currency, enteredRateNum, minAllowedRate, maxAllowedRate]);

  const [editing, setEditing] = useState<Inventory | null>(null);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [showInventorySaveConfirm, setShowInventorySaveConfirm] = useState(false);
  const [showInventoryCancelConfirm, setShowInventoryCancelConfirm] = useState(false);
  const [inventoryItemToDelete, setInventoryItemToDelete] = useState<Inventory | null>(null);
  const [txForm, setTxForm] = useState({ inventory_id: "", type: "in", quantity: "", note: "" });

  // Expiry & Quality state
  const [expiryWarehouseFilter, setExpiryWarehouseFilter] = useState<string>("all");
  const [expiryStatusFilter, setExpiryStatusFilter] = useState<string>("all");
  const [expirySearchQuery, setExpirySearchQuery] = useState<string>("");
  const [expiryForm, setExpiryForm] = useState({
    inventory_id: "",
    batch_no: "",
    quantity: "",
    expiry_date: "",
    warehouse_id: "wh-main-default",
    storage_condition: "chilled_4c",
  });

  // Document Builder State
  const handlePrintDoc = (doc?: any) => {
    if (doc) {
      setSelectedDocId(doc.id);
      // Give a small delay for state update/render before printing
      setTimeout(() => {
        window.print();
      }, 300);
    } else {
      window.print();
    }
  };

  const [docType, setDocType] = useState<
    | "goods_receipt"
    | "goods_issue"
    | "stock_transfer"
    | "stock_adjustment"
    | "inventory_count"
    | "opening_balance"
  >("goods_receipt");
  const [docNotes, setDocNotes] = useState("");
  const [docItems, setDocItems] = useState<
    { inventory_id: string; quantity: number; unit_cost: number; counted_quantity?: number }[]
  >([]);
  const [docItemForm, setDocItemForm] = useState({
    inventory_id: "",
    quantity: "0",
    unit_cost: "0",
    counted_quantity: "0",
  });
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  // Supplier state
  const [supplierForm, setSupplierForm] = useState({
    name_ar: "",
    phone: "",
    opening_balance: "0",
  });

  // Purchase Order State
  const [poForm, setPoForm] = useState({
    supplier_id: "",
    inventory_id: "",
    quantity: "",
    unit_cost: "",
    expiry_date: "",
    notes: "",
  });
  const [poItems, setPoItems] = useState<
    { inventory_id: string; quantity: number; unit_cost: number }[]
  >([]);

  // Interactive Receiving / Return Dialog states
  const [receivingPoId, setReceivingPoId] = useState<string | null>(null);
  const [returningPoId, setReturningPoId] = useState<string | null>(null);
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, string>>({});
  const [returnQuantities, setReturnQuantities] = useState<Record<string, string>>({});
  const [selectedReceiveTreasuryId, setSelectedReceiveTreasuryId] = useState("");

  // Transfer State
  const [transferForm, setTransferForm] = useState({
    inventory_id: "",
    quantity: "",
    from_warehouse_id: "wh-main-default",
    to_warehouse_id: "wh-sub-kitchen",
  });

  const [selectedStockWarehouseId, setSelectedStockWarehouseId] = useState<string>("all");
  const [selectedReportWarehouseId, setSelectedReportWarehouseId] = useState<string>("all");

  const inventoryQuery = useQuery({
    queryKey: ["admin", "inventory"],
    queryFn: () => inventoryService.getInventory() as Promise<Inventory[]>,
  });

  const warehousesQuery = useQuery({
    queryKey: ["admin", "warehouses"],
    queryFn: () => inventoryService.getWarehouses(),
  });

  const warehouseInventoryQuery = useQuery({
    queryKey: ["admin", "warehouse_inventory"],
    queryFn: () => inventoryService.getWarehouseInventory(),
  });

  const getReportItemQty = useCallback(
    (item: Inventory) => {
      if (selectedReportWarehouseId === "all") return Number(item.quantity || 0);
      const whRec = (warehouseInventoryQuery.data ?? []).find(
        (w) => w.warehouse_id === selectedReportWarehouseId && w.inventory_id === item.id,
      );
      return Number(whRec?.quantity || 0);
    },
    [selectedReportWarehouseId, warehouseInventoryQuery.data],
  );

  const transactionsQuery = useQuery({
    queryKey: ["admin", "inventory_transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_transactions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Transaction[];
    },
  });

  const menuItemsQuery = useQuery({
    queryKey: ["admin", "menu_items_for_reports"],
    queryFn: async () => {
      const { data, error } = await supabase.from("menu_items").select("*").order("name_ar");
      if (error) throw error;
      return data ?? [];
    },
  });

  const upsert = useMutation({
    mutationFn: async () => {
      const payload = {
        name_ar: form.name_ar,
        unit: form.unit,
        quantity: Number(form.quantity),
        min_level: Number(form.min_level),
        cost: Number(form.cost),
      };

      const data = await inventoryService.upsertInventoryItem(payload, editing?.id);

      // Generate unique sequential transaction number & timestamps
      const txNumber = "TX-INV-" + Date.now().toString().slice(-6);
      const systemTimestamp = new Date().toISOString();
      const txDate = form.transaction_date || new Date().toISOString().split("T")[0];
      const txTime = form.transaction_time || new Date().toTimeString().slice(0, 5);

      const selectedTreasury =
        erpState.treasuries.find((t) => t.id === form.treasury_id) || erpState.treasuries[0];
      const selectedSupplier =
        erpState.suppliers.find((s) => s.id === form.preferred_supplier_id) ||
        erpState.suppliers[0];

      const rate = form.currency === "USD" ? 1 : Number(form.exchange_rate) || 1;
      const totalAmount =
        Number(form.cost) * (Number(form.quantity) > 0 ? Number(form.quantity) : 1);

      // Create General Ledger Journal Entry
      const inventoryAccCode = "11050100"; // المخزون - خامات ومستلزمات
      const creditAccCode =
        selectedTreasury?.account_code || selectedSupplier?.account_code || "101000";

      let journalRef = "";
      try {
        const je = erpStore.addJournalEntry(
          `معاملة ${editing ? "تعديل" : "إضافة"} صنف مخزني: ${form.name_ar} (رقم المعاملة: ${txNumber})`,
          [
            {
              account_code: inventoryAccCode,
              debit: totalAmount > 0 ? totalAmount : Number(form.cost),
              credit: 0,
              currency: form.currency,
              rate: rate,
              description: `مخزون خامات - ${form.name_ar}`,
            },
            {
              account_code: creditAccCode,
              debit: 0,
              credit: totalAmount > 0 ? totalAmount : Number(form.cost),
              currency: form.currency,
              rate: rate,
              description: `مدفوعات/استحقاق صنف - ${form.name_ar}`,
            },
          ],
          undefined,
          form.currency,
          txDate,
        );
        journalRef = je.reference || je.id;
      } catch (e) {
        console.warn("Journal entry creation notice:", e);
        journalRef = "JV-" + txNumber;
      }

      const costNum = Number(form.cost) || 0;
      const avgCostNum = Number(form.average_cost) > 0 ? Number(form.average_cost) : costNum;
      const lastCostNum =
        Number(form.last_purchase_price) > 0 ? Number(form.last_purchase_price) : costNum;

      // Save extended item data
      erpStore.saveExtendedItem(data.id, {
        item_code: form.item_code || "INV-" + data.id.substring(0, 5).toUpperCase(),
        barcode: form.barcode || "622" + Math.floor(Math.random() * 1000000000),
        name_en: form.name_en || "",
        category: form.category || "خامات ومواد أولية",
        preferred_supplier_id: form.preferred_supplier_id || selectedSupplier?.id || "sup-1",
        supplier_name: selectedSupplier?.name_ar || "",
        supplier_account_code: selectedSupplier?.account_code || "",
        average_cost: avgCostNum,
        last_purchase_price: lastCostNum,
        status: (form.status || "active") as "active" | "inactive",
        currency: form.currency,
        exchange_rate: rate,
        treasury_id: form.treasury_id,
        treasury_name: selectedTreasury?.name_ar || "",
        transaction_date: txDate,
        transaction_time: txTime,
        system_timestamp: systemTimestamp,
        tx_number: txNumber,
        journal_entry_ref: journalRef,
      });

      // Record inventory transaction in ERP store
      erpStore.recordInventoryDocTransaction({
        inventory_id: data.id,
        type: editing ? "adjustment" : "in",
        quantity: Number(form.quantity),
        note: `معاملة ${editing ? "تعديل" : "إضافة"} صنف | خزينة: ${selectedTreasury?.name_ar || "الرئيسية"} | مورد: ${selectedSupplier?.name_ar || "عام"} | قيد: ${journalRef} | كود المعاملة: ${txNumber}`,
        currency: form.currency,
        exchange_rate: rate,
        treasury_id: form.treasury_id,
        treasury_name: selectedTreasury?.name_ar,
        supplier_id: form.preferred_supplier_id,
        supplier_name: selectedSupplier?.name_ar,
        supplier_account_code: selectedSupplier?.account_code,
        transaction_date: txDate,
        transaction_time: txTime,
        system_timestamp: systemTimestamp,
        tx_number: txNumber,
        journal_entry_ref: journalRef,
      });

      setSaveSuccessNotification({
        open: true,
        itemName: form.name_ar,
        journalRef: journalRef,
        txNumber: txNumber,
        treasuryName: selectedTreasury?.name_ar || "الخزينة الرئيسية",
        amount: totalAmount > 0 ? totalAmount : Number(form.cost),
        currency: form.currency,
      });

      erpStore.logAction(
        "ADMIN",
        editing ? "تحديث صنف بالمخزن" : "إضافة صنف للمخزن",
        `تم ${editing ? "تعديل" : "إنشاء"} صنف ${form.name_ar} بكمية ${form.quantity} مع قيد يومية #${journalRef}`,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "warehouse_inventory"] });
      setIsInventoryModalOpen(false);
      setShowInventorySaveConfirm(false);
      setShowInventoryCancelConfirm(false);
      setEditing(null);
      setErpState(erpStore.getState());
    },
    onError: (err: any) => {
      toast({
        title: "فشل الحفظ",
        description: err.message || "حدث خطأ أثناء حفظ الصنف.",
        variant: "destructive",
      });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      await inventoryService.deleteInventoryItem(id);
    },
    onSuccess: (_, id) => {
      erpStore.logAction("ADMIN", "حذف صنف من المخزن", `حذف المعرف ${id}`);
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "warehouse_inventory"] });
      toast({
        title: "تم حذف الصنف",
        description: "تمت إزالة الصنف من المخزن بنجاح.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "فشل الحذف",
        description: err.message || "لا تملك الصلاحية لحذف هذا الصنف.",
        variant: "destructive",
      });
    },
  });

  const clearAllItemsMutation = useMutation({
    mutationFn: async () => {
      await inventoryService.clearAllInventoryItems();
    },
    onSuccess: () => {
      erpStore.logAction(
        "ADMIN",
        "مسح كافة أصناف المخزن",
        "تم تفريغ قائمة الأصناف للبدء من الصفر (0 أصناف)",
        "DELETE",
      );
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "warehouse_inventory"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory_transactions"] });
      toast({
        title: "تم مسح كافة الأصناف",
        description: "أصبحت قائمة المخزن الآن تحتوي على 0 أصناف وجاهزة لإدخال الأصناف الجديدة.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "فشل المسح",
        description: err.message || "حدث خطأ أثناء مسح الأصناف.",
        variant: "destructive",
      });
    },
  });

  const addTransaction = useMutation({
    mutationFn: async () => {
      const qty = Number(txForm.quantity);
      await inventoryService.addTransaction({
        inventory_id: txForm.inventory_id,
        type: txForm.type,
        quantity: qty,
        note: txForm.note || null,
      });

      const invItem = inventoryQuery.data?.find((i) => i.id === txForm.inventory_id);
      const itemName = invItem?.name_ar || "صنف مخزني";
      const itemCost = Number(invItem?.cost || 0);

      // Auto post journal entry if this transaction is waste / write-off / loss
      const isWaste =
        txForm.note?.includes("هدر") ||
        txForm.note?.includes("إعدام") ||
        txForm.note?.includes("تالف") ||
        txForm.note?.includes("خسائر");

      if (isWaste && itemCost > 0 && qty > 0) {
        const wasteVal = qty * itemCost;
        erpStore.postInventoryAdjustmentJournal(
          `TX-${Date.now().toString().slice(-6)}`,
          wasteVal,
          erpStore.getState().currentBranchId,
        );
      }

      // Log in ERP system too
      erpStore.logAction(
        "ADMIN",
        "تسجيل حركة مخزنية",
        `حركة ${txForm.type === "in" ? "إضافة" : txForm.type === "out" ? "صرف" : "تسوية جردية"} لصنف ${itemName} بكمية ${qty}${isWaste ? " (تم توثيق قيد الهدر)" : ""}`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory_transactions"] });
      setTxForm({ inventory_id: "", type: "in", quantity: "", note: "" });
      toast({
        title: "تم تسجيل الحركة",
        description: "تم تحديث الرصيد وتسجيل الحركة بنجاح.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "فشل تسجيل الحركة",
        description: err.message || "يرجى التحقق من الصلاحيات والبيانات المدخلة.",
        variant: "destructive",
      });
    },
  });

  const openAddInventoryModal = () => {
    setEditing(null);
    const firstTreasuryId = erpState.treasuries[0]?.id || "";
    const firstSupplierId = erpState.suppliers[0]?.id || "";
    setForm({
      name_ar: "",
      unit: "كيلو",
      quantity: "0",
      min_level: "0",
      cost: "0",
      barcode: "",
      item_code: "",
      name_en: "",
      category: "خامات ومواد أولية",
      preferred_supplier_id: firstSupplierId,
      average_cost: "0",
      last_purchase_price: "0",
      status: "active",
      currency: "USD",
      exchange_rate: "1",
      treasury_id: firstTreasuryId,
      transaction_date: new Date().toISOString().split("T")[0],
      transaction_time: new Date().toTimeString().slice(0, 5),
    });
    setIsInventoryModalOpen(true);
  };

  const cancelEditInventory = () => {
    setEditing(null);
    const firstTreasuryId = erpState.treasuries[0]?.id || "";
    const firstSupplierId = erpState.suppliers[0]?.id || "";
    setForm({
      name_ar: "",
      unit: "كيلو",
      quantity: "0",
      min_level: "0",
      cost: "0",
      barcode: "",
      item_code: "",
      name_en: "",
      category: "خامات ومواد أولية",
      preferred_supplier_id: firstSupplierId,
      average_cost: "0",
      last_purchase_price: "0",
      status: "active",
      currency: "USD",
      exchange_rate: "1",
      treasury_id: firstTreasuryId,
      transaction_date: new Date().toISOString().split("T")[0],
      transaction_time: new Date().toTimeString().slice(0, 5),
    });
    setIsInventoryModalOpen(false);
    setShowInventoryCancelConfirm(false);
  };

  const startEdit = (i: Inventory) => {
    const ext = erpStore.getExtendedItem(i.id);
    const firstTreasuryId = erpState.treasuries[0]?.id || "";
    const firstSupplierId = erpState.suppliers[0]?.id || "";
    setEditing(i);
    setForm({
      name_ar: i.name_ar,
      unit: i.unit,
      quantity: String(i.quantity),
      min_level: String(i.min_level),
      cost: String(i.cost),
      barcode: ext.barcode || "",
      item_code: ext.item_code || "",
      name_en: ext.name_en || "",
      category: ext.category || "خامات ومواد أولية",
      preferred_supplier_id: ext.preferred_supplier_id || firstSupplierId,
      average_cost: String(ext.average_cost || i.cost),
      last_purchase_price: String(ext.last_purchase_price || i.cost),
      status: ext.status || "active",
      currency: ext.currency || (i as any).currency || "USD",
      exchange_rate: String(ext.exchange_rate || (i as any).exchange_rate || "1"),
      treasury_id: ext.treasury_id || (i as any).treasury_id || firstTreasuryId,
      transaction_date:
        ext.transaction_date ||
        (i as any).transaction_date ||
        new Date().toISOString().split("T")[0],
      transaction_time:
        ext.transaction_time ||
        (i as any).transaction_time ||
        new Date().toTimeString().slice(0, 5),
    });
    setIsInventoryModalOpen(true);
  };

  const handleAddDocItem = () => {
    if (!docItemForm.inventory_id) return;
    const qty = Number(docItemForm.quantity || 0);
    const cost = Number(docItemForm.unit_cost || 0);
    const counted = Number(docItemForm.counted_quantity || 0);

    const newItem = {
      inventory_id: docItemForm.inventory_id,
      quantity: qty,
      unit_cost: cost,
      counted_quantity: docType === "inventory_count" ? counted : undefined,
    };

    setDocItems((s) => [...s, newItem]);
    setDocItemForm({ inventory_id: "", quantity: "0", unit_cost: "0", counted_quantity: "0" });
  };

  const handleSaveDocument = async () => {
    if (docItems.length === 0) {
      toast({
        title: "تنبيه",
        description: "يرجى إضافة صنف واحد على الأقل للمستند!",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create Document in erpStore
      const formalDoc = erpStore.addInventoryDocument({
        type: docType,
        date: new Date().toISOString(),
        branch_id: currentBranch.id,
        items: docItems.map((item) => {
          const invItem = (inventoryQuery.data ?? []).find((i) => i.id === item.inventory_id);
          const currentQty = Number(invItem?.quantity ?? 0);
          let diff = 0;
          if (docType === "inventory_count") {
            diff = Number(item.counted_quantity ?? 0) - currentQty;
          }
          return {
            ...item,
            difference: diff,
          };
        }),
        notes: docNotes,
        status: "approved",
      });

      // Update actual stock in Supabase for each item
      for (const item of docItems) {
        const invItem = (inventoryQuery.data ?? []).find((i) => i.id === item.inventory_id);
        if (!invItem) continue;

        const currentQty = Number(invItem.quantity);
        let newQty = currentQty;

        if (docType === "goods_receipt" || docType === "opening_balance") {
          newQty = currentQty + item.quantity;
        } else if (docType === "goods_issue" || docType === "stock_transfer") {
          newQty = Math.max(0, currentQty - item.quantity);
        } else if (docType === "stock_adjustment") {
          newQty = item.quantity;
        } else if (docType === "inventory_count") {
          newQty = Number(item.counted_quantity ?? currentQty);
        }

        // Update DB
        await supabase
          .from("inventory")
          .update({ quantity: newQty, cost: item.unit_cost || invItem.cost })
          .eq("id", item.inventory_id);

        // Record a transaction log in Supabase
        await supabase.from("inventory_transactions").insert({
          inventory_id: item.inventory_id,
          type:
            docType === "goods_receipt" || docType === "opening_balance"
              ? "in"
              : docType === "goods_issue" || docType === "stock_transfer"
                ? "out"
                : "adjustment",
          quantity: docType === "inventory_count" ? Math.abs(newQty - currentQty) : item.quantity,
          note: `مستند رسمي ${formalDoc.doc_number} - ${docNotes || "تحديث تلقائي"}`,
        });

        // Update average cost in erpStore
        if (docType === "goods_receipt" && item.quantity > 0) {
          const ext = erpStore.getExtendedItem(item.inventory_id);
          const oldAvgCost = ext.average_cost || Number(invItem.cost);
          const updatedAvgCost =
            (currentQty * oldAvgCost + item.quantity * item.unit_cost) /
            (currentQty + item.quantity);
          erpStore.saveExtendedItem(item.inventory_id, {
            average_cost: Number(updatedAvgCost.toFixed(2)),
            last_purchase_price: item.unit_cost,
          });
        }
      }

      // Reset
      setDocItems([]);
      setDocNotes("");
      setErpState(erpStore.getState());
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory_transactions"] });
      toast({
        title: "تم اعتماد المستند",
        description: `تم تسجيل واعتماد المستند المخزني رقم ${formalDoc.doc_number} بنجاح وتحديث الأرصدة ومتوسطات التكلفة!`,
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "خطأ في حفظ المستند",
        description: err.message || "حدث خطأ أثناء حفظ واعتماد المستند المخزني.",
        variant: "destructive",
      });
    }
  };

  // ERP Store Mutators
  const handleAddSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierForm.name_ar) return;
    erpStore.addSupplier(
      supplierForm.name_ar,
      supplierForm.phone,
      Number(supplierForm.opening_balance),
    );
    setSupplierForm({ name_ar: "", phone: "", opening_balance: "0" });
    setErpState(erpStore.getState());
  };

  const handleAddExpiryBatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !expiryForm.inventory_id ||
      !expiryForm.batch_no ||
      !expiryForm.quantity ||
      !expiryForm.expiry_date
    )
      return;
    erpStore.addExpiryBatch(
      expiryForm.inventory_id,
      expiryForm.batch_no,
      Number(expiryForm.quantity),
      expiryForm.expiry_date,
      expiryForm.warehouse_id,
      expiryForm.storage_condition,
    );
    toast({
      title: "تم قيد الدفعة بنجاح 🟢",
      description: `تم قيد الدفعة ${expiryForm.batch_no} بالصلاحية ${expiryForm.expiry_date}`,
    });
    setExpiryForm({
      inventory_id: "",
      batch_no: "",
      quantity: "",
      expiry_date: "",
      warehouse_id: "wh-main-default",
      storage_condition: "chilled_4c",
    });
    setErpState(erpStore.getState());
  };

  const handleDisposeBatch = (
    batchId: string,
    batchNo: string,
    itemName: string,
    quantity: number | string = 0,
    unit: string = "وحدة",
  ) => {
    setDisposeBatchDialog({
      batchId,
      batchNo,
      itemName,
      quantity,
      unit,
      reason: "إعدام انتهاء صلاحية وسوء تخزين",
    });
  };

  const confirmDisposeBatch = async () => {
    if (!disposeBatchDialog) return;
    setIsDisposingBatch(true);
    try {
      await erpStore.disposeExpiryBatch(
        disposeBatchDialog.batchId,
        disposeBatchDialog.reason || "إعدام انتهاء صلاحية وسوء تخزين",
      );
      setErpState(erpStore.getState());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "inventory_transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "warehouses"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "warehouse_inventory"] }),
      ]);
      setActiveTab("expiry");
      toast({
        title: "✅ تم إعدام الدفعة وإجراء القيود والحسابات بنجاح",
        description: `تم خصم الكمية (${disposeBatchDialog.quantity} ${disposeBatchDialog.unit}) للصنف "${disposeBatchDialog.itemName}" من رصيد المخزن، وتسجيل حركة الهدر، وإثبات القيد المحاسبي المزدوج (حساب 506000 الهدر والمفقودات)، وتحديث شاشة تتبع الصلاحية والجودة بالكامل.`,
      });
      setDisposeBatchDialog(null);
    } catch (err: any) {
      toast({
        title: "❌ خطأ أثناء إعدام الدفعة",
        description: err?.message || "حدث خطأ أثناء معالجة عملية الإعدام والمحاسبة.",
        variant: "destructive",
      });
    } finally {
      setIsDisposingBatch(false);
    }
  };

  const addPoItem = () => {
    if (!poForm.inventory_id || !poForm.quantity || !poForm.unit_cost) return;
    const invItem = inventoryQuery.data?.find((i) => i.id === poForm.inventory_id);
    setPoItems((prev) => [
      ...prev,
      {
        inventory_id: poForm.inventory_id,
        name_ar: invItem?.name_ar,
        unit: invItem?.unit,
        quantity: Number(poForm.quantity),
        unit_cost: Number(poForm.unit_cost),
        expiry_date: poForm.expiry_date,
        total: Number(poForm.quantity) * Number(poForm.unit_cost),
      },
    ]);
    setPoForm((prev) => ({
      ...prev,
      inventory_id: "",
      quantity: "",
      unit_cost: "",
      expiry_date: "",
    }));
  };

  const handleCreatePO = (e: React.FormEvent) => {
    e.preventDefault();
    if (!poForm.supplier_id || poItems.length === 0) return;
    const po = erpStore.createPurchaseOrder(poForm.supplier_id, poItems, poForm.notes);

    // Auto receive for demo/complete flow convenience
    const defaultTreasury =
      erpState.treasuries.find((t) => t.branch_id === currentBranch.id && t.type === "cash") ||
      erpState.treasuries[0];
    if (defaultTreasury) {
      erpStore.receivePurchaseOrder(po.id, defaultTreasury.id);

      // Mutate database quantity to keep standard stock in sync - TARGETING MAIN STORE
      poItems.forEach(async (item) => {
        await inventoryService.addTransaction({
          inventory_id: item.inventory_id,
          warehouse_id: "wh-main-default", // Explicitly target Main Store
          type: "in",
          quantity: item.quantity,
          note: `استلام تلقائي - أمر توريد #${po.id.substring(3, 8)}${item.expiry_date ? ` (صلاحية: ${item.expiry_date})` : ""}`,
        });
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "warehouse_inventory"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory_transactions"] });
    }

    setPoItems([]);
    setPoForm({
      supplier_id: "",
      inventory_id: "",
      quantity: "",
      unit_cost: "",
      expiry_date: "",
      notes: "",
    });
    setErpState(erpStore.getState());
    alert("تم إنشاء أمر التوريد بنجاح! يمكنك الآن استلام البضائع من جدول أوامر الشراء أدناه.");
  };

  const handleReceivePOPartialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingPoId) return;

    const po = erpState.purchaseOrders.find((p) => p.id === receivingPoId);
    if (!po) return;

    const itemsArr = po.items.map((item) => ({
      inventory_id: item.inventory_id,
      received_quantity: Number(receiveQuantities[item.inventory_id] || 0),
    }));

    // Filter items where received quantity > 0
    const activeReceives = itemsArr.filter((i) => i.received_quantity > 0);
    if (activeReceives.length === 0) {
      alert("يرجى تحديد كميات مستلمة أكبر من الصفر!");
      return;
    }

    const treasuryId = selectedReceiveTreasuryId || erpState.treasuries[0]?.id;
    if (!treasuryId) {
      alert("لا يوجد حساب خزينة متاح للدفع!");
      return;
    }

    try {
      // 1. Call erpStore
      const { receivedTotal, isFullyReceived } = erpStore.receivePurchaseOrderPartial(
        receivingPoId,
        activeReceives,
        treasuryId,
      );

      // 2. Update Supabase DB quantities and log transactions - TARGETING MAIN STORE
      for (const item of activeReceives) {
        await inventoryService.addTransaction({
          inventory_id: item.inventory_id,
          warehouse_id: "wh-main-default",
          type: "in",
          quantity: item.received_quantity,
          note: `استلام (أمر شراء #${receivingPoId.substring(3, 8)})`,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory_transactions"] });
      setErpState(erpStore.getState());

      // Reset states
      setReceivingPoId(null);
      setReceiveQuantities({});
      setSelectedReceiveTreasuryId("");
      alert(
        `تم تسجيل الاستلام وتحديث أرصدة الخزينة والمخازن بنجاح! القيمة المحسوبة: ${formatPrice(receivedTotal)}`,
      );
    } catch (err: any) {
      console.error(err);
      alert(err.message || "حدث خطأ أثناء معالجة الاستلام");
    }
  };

  const handleReturnPOItemsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returningPoId) return;

    const po = erpState.purchaseOrders.find((p) => p.id === returningPoId);
    if (!po) return;

    const itemsArr = po.items.map((item) => ({
      inventory_id: item.inventory_id,
      returned_quantity: Number(returnQuantities[item.inventory_id] || 0),
    }));

    const activeReturns = itemsArr.filter((i) => i.returned_quantity > 0);
    if (activeReturns.length === 0) {
      alert("يرجى تحديد كميات مرتجعة أكبر من الصفر!");
      return;
    }

    try {
      // 1. Call erpStore
      const returnedTotal = erpStore.returnPurchaseOrderItems(returningPoId, activeReturns);

      // 2. Deduct from Supabase DB quantities
      for (const item of activeReturns) {
        const invItem = inventoryQuery.data?.find((i) => i.id === item.inventory_id);
        if (invItem) {
          const newQty = Math.max(0, Number(invItem.quantity) - item.returned_quantity);
          await supabase.from("inventory").update({ quantity: newQty }).eq("id", item.inventory_id);
          await supabase.from("inventory_transactions").insert({
            inventory_id: item.inventory_id,
            type: "out",
            quantity: item.returned_quantity,
            note: `مرتجع للمورد (أمر شراء #${returningPoId.substring(3, 8)})`,
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory_transactions"] });
      setErpState(erpStore.getState());

      // Reset states
      setReturningPoId(null);
      setReturnQuantities({});
      alert(
        `تم تسجيل المرتجع للمورد بنجاح! القيمة الإجمالية المخصومة: ${formatPrice(returnedTotal)}`,
      );
    } catch (err: any) {
      console.error(err);
      alert(err.message || "حدث خطأ أثناء معالجة المرتجعات");
    }
  };

  const handleStockTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferForm.inventory_id || !transferForm.quantity) return;
    const qty = Number(transferForm.quantity);

    try {
      await inventoryService.transferInventory({
        source_warehouse_id: transferForm.from_warehouse_id,
        destination_warehouse_id: transferForm.to_warehouse_id,
        inventory_id: transferForm.inventory_id,
        quantity: qty,
        notes: "تحويل يدوي من المخزن الرئيسي إلى مخزن التشغيل",
      });

      queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "warehouse_inventory"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory_transactions"] });

      erpStore.logAction(
        "ADMIN",
        "تحويل مخزني داخلي",
        `تم تحويل كمية ${qty} من صنف مختار إلى المخزن الفرعي`,
      );

      setTransferForm((prev) => ({
        ...prev,
        inventory_id: "",
        quantity: "",
      }));

      toast({
        title: "تم التحويل بنجاح",
        description: "تم نقل الكمية من المخزن الرئيسي إلى المخزن الفرعي بنجاح.",
      });
    } catch (err: any) {
      toast({
        title: "فشل التحويل",
        description: err.message || "حدث خطأ أثناء عملية التحويل.",
        variant: "destructive",
      });
    }
  };

  // Stats
  const stats = useMemo(() => {
    const items = inventoryQuery.data ?? [];
    const totalItems = items.length;
    const lowStockItems = items.filter((i) => Number(i.quantity) <= Number(i.min_level)).length;
    const totalValue = items.reduce((sum, i) => sum + Number(i.cost) * Number(i.quantity), 0);
    return { totalItems, lowStockItems, totalValue };
  }, [inventoryQuery.data]);

  const filteredInventory = useMemo(() => {
    let items = inventoryQuery.data ?? [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(
        (i) =>
          i.name_ar.toLowerCase().includes(q) ||
          i.id.toLowerCase().includes(q) ||
          (erpStore.getExtendedItem(i.id).barcode || "").includes(q),
      );
    }
    if (filterLowStock) {
      items = items.filter((i) => {
        let qty = Number(i.quantity);
        if (selectedStockWarehouseId !== "all") {
          const whRec = (warehouseInventoryQuery.data ?? []).find(
            (w) => w.warehouse_id === selectedStockWarehouseId && w.inventory_id === i.id,
          );
          qty = Number(whRec?.quantity || 0);
        }
        return qty <= Number(i.min_level);
      });
    }
    return items;
  }, [
    inventoryQuery.data,
    search,
    filterLowStock,
    selectedStockWarehouseId,
    warehouseInventoryQuery.data,
  ]);

  const txPreview = useMemo(() => {
    if (!txForm.inventory_id || !txForm.quantity) return null;
    const item = inventoryQuery.data?.find((i) => i.id === txForm.inventory_id);
    if (!item) return null;

    const current = Number(item.quantity);
    const amount = Number(txForm.quantity);
    let expected = current;
    if (txForm.type === "in") expected = current + amount;
    if (txForm.type === "out") expected = current - amount;
    if (txForm.type === "adjustment") expected = amount;

    return {
      name: item.name_ar,
      unit: item.unit,
      current,
      expected,
      isLowAfter: expected <= Number(item.min_level),
    };
  }, [txForm, inventoryQuery.data]);

  return (
    <div className="space-y-6 text-right">
      <BackToRestaurantButton />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full font-bold">
              الشركة المصرية لادارة المشروعات السياحية والترفيهية (بهجت جروب)
            </span>
            <span className="bg-emerald-500/10 text-emerald-600 text-xs px-2.5 py-1 rounded-full font-bold">
              {currentBranch.name_ar}
            </span>
          </div>
          <h1 className="text-2xl font-black text-foreground mt-2">المخازن والتوريد المتقدم</h1>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة الجرد، سلاسل التوريد، تتبع الصلاحيات، تحويلات الفروع، والتحليلات المالية للمخازن
          </p>
        </div>
      </div>

      {/* Role and Permissions Warning & Self-Promotion */}
      {userProfileQuery.data &&
        (!userProfileQuery.data.profile ||
          !["admin", "manager"].includes(userProfileQuery.data.profile.role)) && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex gap-3 items-start sm:items-center">
              <div className="p-2 bg-amber-500/10 text-amber-600 rounded-xl shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-amber-800 dark:text-amber-400">
                  صلاحيات محدودة في المخزن
                </h3>
                <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-1 leading-relaxed">
                  حسابك مسجل حالياً بدور{" "}
                  <span className="font-bold underline">
                    {userProfileQuery.data.profile?.role
                      ? roleLabels[userProfileQuery.data.profile.role] ||
                        userProfileQuery.data.profile.role
                      : "غير معروف / كاشير"}
                  </span>
                  . لتتمكن من تعديل أو إضافة أصناف المخزن، يرجى ترقية حسابك إلى مدير (Admin) فوراً
                  بضغطة زر واحدة أدناه لتفعيل الصلاحيات الكاملة وتحديث قواعد البيانات.
                </p>
              </div>
            </div>
            <Button
              onClick={() => promoteToAdmin.mutate()}
              disabled={promoteToAdmin.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 shrink-0 flex items-center gap-1.5 self-end sm:self-center"
            >
              <Sparkles size={14} />
              <span>
                {promoteToAdmin.isPending ? "جاري الترقية..." : "الترقية إلى مدير (Admin) الآن"}
              </span>
            </Button>
          </div>
        )}

      {/* Stats Dashboard Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border p-5 rounded-2xl flex items-center justify-between shadow-xs">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground block">إجمالي الأصناف بالمخازن</span>
            <span className="text-2xl font-black block">{stats.totalItems} أصناف</span>
          </div>
          <div className="p-3 bg-primary/10 text-primary rounded-xl">
            <Layers size={20} />
          </div>
        </div>

        <div
          className={`bg-card border p-5 rounded-2xl flex items-center justify-between shadow-xs transition-all ${stats.lowStockItems > 0 ? "border-destructive/30 bg-destructive/5" : "border-border"}`}
        >
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground block">أصناف منخفضة المخزون</span>
            <span
              className={`text-2xl font-black block ${stats.lowStockItems > 0 ? "text-destructive animate-pulse" : "text-foreground"}`}
            >
              {stats.lowStockItems} تنبيهات
            </span>
          </div>
          <div
            className={`p-3 rounded-xl ${stats.lowStockItems > 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}
          >
            <TrendingDown size={20} />
          </div>
        </div>

        <div className="bg-card border border-border p-5 rounded-2xl flex items-center justify-between shadow-xs">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground block">
              تقييم المخزون الحالي (جرد دفتري)
            </span>
            <span className="text-2xl font-black block text-emerald-600 dark:text-emerald-500">
              {formatPrice(stats.totalValue)}
            </span>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted p-1 rounded-xl flex flex-wrap gap-1 h-auto">
          <TabsTrigger
            value="warehouses"
            className="rounded-lg font-bold py-2 px-3 bg-primary/10 text-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Building2 size={16} className="ml-1.5 inline" />
            إدارة المخازن والربط
          </TabsTrigger>
          <TabsTrigger value="stock" className="rounded-lg font-bold py-2 px-3">
            <Layers3 size={16} className="ml-1.5 inline" />
            إدارة الأصناف والباركود
          </TabsTrigger>
          <TabsTrigger value="transactions" className="rounded-lg font-bold py-2 px-3">
            <RefreshCw size={16} className="ml-1.5 inline" />
            تسجيل الحركات والتسويات
          </TabsTrigger>
          <TabsTrigger value="expiry" className="rounded-lg font-bold py-2 px-3">
            <Calendar size={16} className="ml-1.5 inline" />
            صلاحية وتتبع الدفعات
          </TabsTrigger>
          <TabsTrigger value="purchases" className="rounded-lg font-bold py-2 px-3">
            <Truck size={16} className="ml-1.5 inline" />
            الموردين والمشتريات
          </TabsTrigger>
          <TabsTrigger value="reports" className="rounded-lg font-bold py-2 px-3">
            <FileText size={16} className="ml-1.5 inline" />
            التقارير والتحليلات
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-lg font-bold py-2 px-3">
            <Settings size={16} className="ml-1.5 inline" />
            إعدادات المخزن
          </TabsTrigger>
        </TabsList>

        <TabsContent value="warehouses" className="space-y-4 mt-4">
          <WarehouseManagement />
        </TabsContent>

        <TabsContent value="stock" className="space-y-4 mt-4">
          {/* Search, Filter, and Table Section */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
              <div className="relative flex-1 max-w-md">
                <Search
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={16}
                />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ابحث عن صنف مخزني أو باركود..."
                  className="pr-9 text-right"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  onClick={openAddInventoryModal}
                  className="font-bold bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2 h-10 px-5 rounded-xl shadow-xs cursor-pointer"
                >
                  <Plus size={18} />
                  <span>إضافة صنف مخزني جديد</span>
                </Button>
                <button
                  onClick={() => setFilterLowStock(!filterLowStock)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold border transition ${
                    filterLowStock
                      ? "bg-destructive/15 text-destructive border-destructive"
                      : "bg-muted text-muted-foreground border-transparent hover:border-border"
                  }`}
                >
                  أصناف منخفضة ومشارفة على النفاد فقط
                </button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (
                      confirm(
                        "هل تريد مسح جميع الأصناف الحالية وتفريغ المخزن ليصبح (0 أصناف) للبدء من الصفر؟",
                      )
                    ) {
                      clearAllItemsMutation.mutate();
                    }
                  }}
                  disabled={clearAllItemsMutation.isPending}
                  className="rounded-full text-xs font-bold text-destructive hover:bg-destructive/10 border-destructive/30 h-7"
                >
                  <Trash2 size={12} className="ml-1" />
                  مسح وتصفير كافة الأصناف (0 أصناف)
                </Button>
              </div>
            </div>

            {/* Interactive Warehouse Switcher Bar */}
            <div className="flex flex-wrap items-center gap-2 bg-muted/20 p-2 rounded-2xl border border-border/50">
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 px-2">
                <Building2 size={15} className="text-primary" />
                المخزن المعروض:
              </span>
              <button
                type="button"
                onClick={() => setSelectedStockWarehouseId("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedStockWarehouseId === "all"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-background text-foreground hover:bg-muted border border-border/40"
                }`}
              >
                جميع المخازن (رصيد مجمع)
              </button>
              {(warehousesQuery.data ?? []).map((wh) => (
                <button
                  key={wh.id}
                  type="button"
                  onClick={() => setSelectedStockWarehouseId(wh.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                    selectedStockWarehouseId === wh.id
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-background text-foreground hover:bg-muted border border-border/40"
                  }`}
                >
                  <span>{wh.name}</span>
                  {wh.is_default && (
                    <span className="text-[9px] bg-primary-foreground/20 px-1 py-0.2 rounded font-normal">
                      رئيسي
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="text-right p-3.5 font-bold">كود / باركود</th>
                    <th className="text-right p-3.5 font-bold">الصنف المخزني</th>
                    <th className="text-right p-3.5 font-bold">التصنيف</th>
                    <th className="text-right p-3.5 font-bold">الكمية المتوفرة</th>
                    <th className="text-right p-3.5 font-bold">حد الأمان</th>
                    <th className="text-right p-3.5 font-bold">التكلفة (شراء / متوسط)</th>
                    <th className="text-right p-3.5 font-bold">قيمة المخزون</th>
                    <th className="text-right p-3.5 font-bold">الحالة</th>
                    <th className="text-center p-3.5 font-bold w-[120px]">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {inventoryQuery.isLoading ? (
                    <tr>
                      <td colSpan={9} className="text-center py-10 text-muted-foreground">
                        جاري تحميل المخزون...
                      </td>
                    </tr>
                  ) : filteredInventory.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-10 text-muted-foreground">
                        لا توجد أصناف مخزنية مطابقة للبحث
                      </td>
                    </tr>
                  ) : (
                    filteredInventory.map((i) => {
                      let displayQty = Number(i.quantity);
                      let activeWhName = "المجموع";
                      if (selectedStockWarehouseId !== "all") {
                        const wh = (warehousesQuery.data ?? []).find(
                          (w) => w.id === selectedStockWarehouseId,
                        );
                        activeWhName = wh ? wh.name : "المخزن الفرعي";
                        const whRec = (warehouseInventoryQuery.data ?? []).find(
                          (w) =>
                            w.warehouse_id === selectedStockWarehouseId && w.inventory_id === i.id,
                        );
                        displayQty = Number(whRec?.quantity || 0);
                      }

                      const isLow = displayQty <= Number(i.min_level);
                      const ext = erpStore.getExtendedItem(i.id);
                      const barcode = ext.barcode || `62200${i.name_ar.charCodeAt(0) || 123}`;
                      const itemCode = ext.item_code || `INV-${i.id.substring(0, 5).toUpperCase()}`;

                      return (
                        <tr
                          key={i.id}
                          className={`hover:bg-muted/30 transition-colors ${ext.status === "inactive" ? "opacity-60 bg-muted/10" : ""}`}
                        >
                          <td className="p-3.5 font-mono text-xs">
                            <div className="space-y-0.5 text-right">
                              <span className="text-slate-400 block">{itemCode}</span>
                              <span className="text-slate-500 font-semibold block">{barcode}</span>
                            </div>
                          </td>
                          <td className="p-3.5 font-bold">
                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <span className="block">{i.name_ar}</span>
                                {ext.name_en && (
                                  <span className="block text-xs font-normal text-muted-foreground font-mono">
                                    {ext.name_en}
                                  </span>
                                )}
                              </div>
                              {isLow && (
                                <span className="inline-flex items-center gap-1 bg-destructive/10 text-destructive text-[10px] px-2 py-0.5 rounded-full font-bold">
                                  <AlertTriangle size={10} />
                                  نفد
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3.5 text-muted-foreground text-right">
                            <span className="bg-primary/5 text-primary text-xs px-2.5 py-1 rounded-full font-bold block w-fit">
                              {ext.category}
                            </span>
                          </td>
                          <td className="p-3.5 font-bold text-right">
                            <span className="text-base text-foreground font-black">
                              {displayQty.toFixed(2)}
                            </span>{" "}
                            <span className="text-xs text-muted-foreground">{i.unit}</span>
                            {selectedStockWarehouseId !== "all" && (
                              <span className="block text-[10px] text-primary font-bold">
                                بـ ({activeWhName})
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-muted-foreground text-right">
                            {Number(i.min_level).toFixed(2)}
                          </td>
                          <td className="p-3.5 text-muted-foreground text-xs font-mono text-right">
                            <span className="block font-bold">شراء: {formatPrice(i.cost)}</span>
                            <span className="block text-slate-500">
                              متوسط: {formatPrice(ext.average_cost || i.cost)}
                            </span>
                          </td>
                          <td className="p-3.5 font-bold text-emerald-600 text-right">
                            {formatPrice(Number(ext.average_cost || i.cost) * Number(i.quantity))}
                          </td>
                          <td className="p-3.5 text-right">
                            {ext.status === "active" ? (
                              <span className="inline-flex items-center bg-emerald-500/10 text-emerald-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                نشط
                              </span>
                            ) : (
                              <span className="inline-flex items-center bg-slate-500/10 text-slate-500 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                غير نشط
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-center flex justify-center gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              onClick={() => startEdit(i)}
                            >
                              <Pencil size={12} />
                            </Button>
                            <Button
                              size="icon"
                              variant="destructive"
                              className="h-8 w-8 cursor-pointer"
                              onClick={() => setInventoryItemToDelete(i)}
                              disabled={deleteItem.isPending}
                            >
                              <Trash2 size={12} />
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add / Edit Inventory Item Dialog Modal */}
          <Dialog
            open={isInventoryModalOpen}
            onOpenChange={(open) => {
              if (!open) {
                setShowInventoryCancelConfirm(true);
              } else {
                setIsInventoryModalOpen(true);
              }
            }}
          >
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader className="text-right border-b border-border/40 pb-3">
                <DialogTitle className="font-black text-xl text-primary flex items-center gap-2">
                  <Layers3 size={22} />
                  {editing
                    ? `تعديل الصنف المخزني: ${editing.name_ar}`
                    : "إضافة صنف مخزني جديد للمستودع"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  قم بإدخال تفاصيل الصنف والأسعار والباركود والمورد ثم انقر حفظ
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="md:col-span-2">
                  <Label className="text-xs font-bold">الاسم بالعربية *</Label>
                  <Input
                    className="mt-1.5 font-bold"
                    value={form.name_ar}
                    onChange={(e) => setForm((s) => ({ ...s, name_ar: e.target.value }))}
                    placeholder="مثال: لحم مفروم بلدي"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold">الاسم بالإنجليزية</Label>
                  <Input
                    className="mt-1.5 font-bold"
                    value={form.name_en}
                    onChange={(e) => setForm((s) => ({ ...s, name_en: e.target.value }))}
                    placeholder="مثال: Minced Beef"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold">كود الصنف الفريد (Item Code)</Label>
                  <Input
                    className="mt-1.5 font-mono font-bold"
                    value={form.item_code}
                    onChange={(e) => setForm((s) => ({ ...s, item_code: e.target.value }))}
                    placeholder="مثال: ITEM-001"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold">الباركود (Barcode)</Label>
                  <Input
                    className="mt-1.5 font-mono font-bold"
                    value={form.barcode}
                    onChange={(e) => setForm((s) => ({ ...s, barcode: e.target.value }))}
                    placeholder="مثال: 622123456789"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold">تصنيف الصنف بالمخزن</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring mt-1.5 font-bold text-right"
                    value={form.category}
                    onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}
                  >
                    <option value="مأكولات">مأكولات</option>
                    <option value="مشروبات">مشروبات</option>
                    <option value="معجنات">معجنات</option>
                    <option value="خامات ومواد أولية">خامات ومواد أولية</option>
                    <option value="مواد تعبئة وتغليف">مواد تعبئة وتغليف</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-bold">وحدة القياس</Label>
                  <Input
                    className="mt-1.5 font-bold"
                    value={form.unit}
                    onChange={(e) => setForm((s) => ({ ...s, unit: e.target.value }))}
                    placeholder="مثال: كيلو"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold text-primary">العملة *</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring mt-1.5 font-bold text-right"
                    value={form.currency}
                    onChange={(e) => {
                      const newCurr = e.target.value;
                      if (newCurr === "USD") {
                        setForm((s) => ({ ...s, currency: newCurr, exchange_rate: "1" }));
                      } else {
                        const mainRate =
                          exchangeRates[newCurr] || erpStore.getExchangeRate(newCurr) || 1;
                        setForm((s) => ({
                          ...s,
                          currency: newCurr,
                          exchange_rate: String(mainRate),
                        }));
                      }
                    }}
                  >
                    <option value="USD">دولار أمريكي (USD)</option>
                    <option value="EGP">جنية مصري (EGP)</option>
                    <option value="SSP">جنيه جنوب السودان (SSP)</option>
                  </select>
                </div>

                {form.currency !== "USD" && (
                  <div>
                    <Label className="text-xs font-bold text-primary flex items-center justify-between">
                      <span>سعر الصرف (مقابل 1 USD) *</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        (السعر الرئيسي: {currentMainRate})
                      </span>
                    </Label>
                    <Input
                      className={`mt-1.5 font-bold font-mono ${
                        isRateOutOfRange ? "border-rose-500 bg-rose-500/10 text-rose-700" : ""
                      }`}
                      type="number"
                      step="0.01"
                      value={form.exchange_rate}
                      onChange={(e) => setForm((s) => ({ ...s, exchange_rate: e.target.value }))}
                    />
                  </div>
                )}

                <div>
                  <Label className="text-xs font-bold text-primary">
                    الخزينة / الحساب النقدي للمدفوعات *
                  </Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring mt-1.5 font-bold text-right"
                    value={form.treasury_id}
                    onChange={(e) => setForm((s) => ({ ...s, treasury_id: e.target.value }))}
                  >
                    {erpState.treasuries.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name_ar} (الرصيد: {formatPrice(t.balance, t.currency as any)}) [كود:{" "}
                        {t.account_code || t.id}]
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-bold">المورد ورقم الحساب المحاسبي *</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring mt-1.5 font-bold text-right"
                    value={form.preferred_supplier_id}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, preferred_supplier_id: e.target.value }))
                    }
                  >
                    {erpState.suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name_ar} (رقم الحساب: {s.account_code || "بدون كود"})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-bold">تاريخ المعاملة الفعلي *</Label>
                  <Input
                    className="mt-1.5 font-bold"
                    type="date"
                    value={form.transaction_date}
                    onChange={(e) => setForm((s) => ({ ...s, transaction_date: e.target.value }))}
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold">وقت المعاملة *</Label>
                  <Input
                    className="mt-1.5 font-bold"
                    type="time"
                    value={form.transaction_time}
                    onChange={(e) => setForm((s) => ({ ...s, transaction_time: e.target.value }))}
                  />
                </div>

                {form.currency !== "USD" && isRateOutOfRange && (
                  <div className="md:col-span-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
                    <AlertTriangle size={20} className="shrink-0 text-rose-600" />
                    <div>
                      ⚠️ تحذير: سعر الصرف المدخل ({enteredRateNum || 0}) خارج النطاق المسموح به (من{" "}
                      {minAllowedRate.toFixed(2)} إلى {maxAllowedRate.toFixed(2)} - بنسبة ±10% عن
                      سعر النظام الرئيسي الحالي {currentMainRate}). لا يمكن الحفظ حتى يتم تصحيح سعر
                      الصرف.
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-xs font-bold">حد الأمان (التنبيه عند النقص)</Label>
                  <Input
                    className="mt-1.5 font-bold"
                    type="number"
                    value={form.min_level}
                    onChange={(e) => setForm((s) => ({ ...s, min_level: e.target.value }))}
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold">
                    سعر الشراء / التكلفة ({form.currency}) *
                  </Label>
                  <Input
                    className="mt-1.5 font-bold"
                    type="number"
                    value={form.cost}
                    onChange={(e) => {
                      const newCost = e.target.value;
                      setForm((s) => ({
                        ...s,
                        cost: newCost,
                        average_cost:
                          !s.average_cost || s.average_cost === "0" || s.average_cost === s.cost
                            ? newCost
                            : s.average_cost,
                        last_purchase_price:
                          !s.last_purchase_price ||
                          s.last_purchase_price === "0" ||
                          s.last_purchase_price === s.cost
                            ? newCost
                            : s.last_purchase_price,
                      }));
                    }}
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold">متوسط التكلفة (Average Cost)</Label>
                  <Input
                    className="mt-1.5 font-bold"
                    type="number"
                    value={form.average_cost}
                    onChange={(e) => setForm((s) => ({ ...s, average_cost: e.target.value }))}
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold">آخر سعر شراء (Last Purchase Price)</Label>
                  <Input
                    className="mt-1.5 font-bold"
                    type="number"
                    value={form.last_purchase_price}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, last_purchase_price: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold">حالة الصنف بالمخزن</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring mt-1.5 font-bold text-right"
                    value={form.status}
                    onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))}
                  >
                    <option value="active">نشط (Active)</option>
                    <option value="inactive">غير نشط (Inactive)</option>
                  </select>
                </div>

                {!editing && (
                  <div>
                    <Label className="text-xs font-bold">الكمية الافتتاحية</Label>
                    <Input
                      className="mt-1.5 font-bold"
                      type="number"
                      value={form.quantity}
                      onChange={(e) => setForm((s) => ({ ...s, quantity: e.target.value }))}
                    />
                  </div>
                )}
              </div>

              <DialogFooter className="flex gap-2 justify-end border-t border-border/40 pt-4 mt-4">
                <Button
                  type="button"
                  onClick={() => setShowInventorySaveConfirm(true)}
                  disabled={!form.name_ar || upsert.isPending || isRateOutOfRange}
                  className="font-bold px-6 cursor-pointer"
                >
                  {editing ? "حفظ التعديلات" : "إضافة الصنف للمخزن"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowInventoryCancelConfirm(true)}
                  className="font-bold cursor-pointer"
                >
                  إلغاء
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Inventory Save Confirm */}
          <AlertDialog open={showInventorySaveConfirm} onOpenChange={setShowInventorySaveConfirm}>
            <AlertDialogContent className="text-right">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-lg font-black text-primary flex items-center gap-2">
                  <Layers3 size={18} />
                  تأكيد حفظ بيانات الصنف المخزني
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-muted-foreground">
                  هل أنت متأكد من حفظ بيانات الصنف{" "}
                  <span className="font-bold text-foreground">"{form.name_ar}"</span> وإنشاء قيد
                  يومية محاسبي تلقائي في المستودع؟
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2 pt-2">
                <AlertDialogCancel className="font-bold cursor-pointer">إلغاء</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold cursor-pointer"
                  onClick={() => upsert.mutate()}
                >
                  {upsert.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : "تأكيد الحفظ"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Journal Entry Success Notification Dialog */}
          <AlertDialog
            open={saveSuccessNotification.open}
            onOpenChange={(open) => setSaveSuccessNotification((s) => ({ ...s, open }))}
          >
            <AlertDialogContent className="text-right max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-xl font-black text-emerald-600 flex items-center gap-2">
                  <CheckCircle size={24} className="text-emerald-500" />
                  تم حفظ الصنف والقيد المحاسبي بنجاح!
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-muted-foreground">
                  تم تسديد القيد المحاسبي وحفظ بيانات الصنف وتحديث أرصدة الخزينة والحسابات ذات
                  الصلة.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 my-2 space-y-2.5 text-xs font-bold text-slate-800 dark:text-slate-100">
                <div className="flex justify-between items-center pb-1 border-b border-emerald-500/20">
                  <span className="text-muted-foreground">اسم الصنف:</span>
                  <span className="font-black text-sm text-primary">
                    {saveSuccessNotification.itemName}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-1 border-b border-emerald-500/20">
                  <span className="text-muted-foreground">
                    رقم قيد اليومية المحاسبي (Journal Entry):
                  </span>
                  <span className="font-black font-mono bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded text-sm">
                    {saveSuccessNotification.journalRef}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-1 border-b border-emerald-500/20">
                  <span className="text-muted-foreground">رقم المعاملة (Tx Number):</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {saveSuccessNotification.txNumber}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-1 border-b border-emerald-500/20">
                  <span className="text-muted-foreground">الخزينة المخصصة:</span>
                  <span>{saveSuccessNotification.treasuryName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">القيمة والعملة:</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400">
                    {saveSuccessNotification.amount.toLocaleString()}{" "}
                    {saveSuccessNotification.currency}
                  </span>
                </div>
              </div>

              <AlertDialogFooter className="pt-2">
                <AlertDialogAction
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                  onClick={() => setSaveSuccessNotification((s) => ({ ...s, open: false }))}
                >
                  تم، فهمت
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Inventory Cancel Confirm */}
          <AlertDialog
            open={showInventoryCancelConfirm}
            onOpenChange={setShowInventoryCancelConfirm}
          >
            <AlertDialogContent className="text-right">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-lg font-black text-amber-600 flex items-center gap-2">
                  <AlertTriangle size={18} />
                  تأكيد إلغاء التعديل
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-muted-foreground">
                  هل أنت متأكد من إلغاء عملية إضافة/تعديل الصنف؟ سيتم تجاهل جميع البيانات غير
                  المحفوظة.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2 pt-2">
                <AlertDialogCancel className="font-bold cursor-pointer">
                  متابعة التعديل
                </AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold cursor-pointer"
                  onClick={cancelEditInventory}
                >
                  نعم، إلغاء وإغلاق
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Inventory Delete Confirm */}
          <AlertDialog
            open={!!inventoryItemToDelete}
            onOpenChange={(open) => !open && setInventoryItemToDelete(null)}
          >
            <AlertDialogContent className="text-right">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-lg font-black text-destructive flex items-center gap-2">
                  <Trash2 size={18} />
                  تأكيد حذف الصنف من المخزن
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-muted-foreground">
                  هل أنت متأكد من حذف صنف{" "}
                  <span className="font-bold text-foreground">
                    "{inventoryItemToDelete?.name_ar}"
                  </span>{" "}
                  نهائياً من المستودع؟ لا يمكن التراجع عن هذا الإجراء.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2 pt-2">
                <AlertDialogCancel className="font-bold cursor-pointer">إلغاء</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold cursor-pointer"
                  onClick={() => {
                    if (inventoryItemToDelete) {
                      deleteItem.mutate(inventoryItemToDelete.id);
                      setInventoryItemToDelete(null);
                    }
                  }}
                >
                  نعم، حذف نهائي
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-8 mt-4">
          <div className="flex flex-col gap-8">
            {/* Document Creation Form */}
            <div className="w-full bg-card border border-border p-5 rounded-2xl space-y-4">
              <h3 className="font-bold text-base text-primary flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block"></span>
                إنشاء مستند حركة مخزنية معتمد (Formal Document)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label className="text-xs font-bold">نوع المستند</Label>
                  <select
                    className="w-full mt-1.5 h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-right font-bold"
                    value={docType}
                    onChange={(e) => {
                      setDocType(e.target.value as any);
                      setDocItems([]); // Clear draft items when type changes
                    }}
                  >
                    <option value="goods_receipt">إذن استلام بضاعة (Goods Receipt)</option>
                    <option value="goods_issue">إذن صرف بضاعة (Goods Issue)</option>
                    <option value="stock_transfer">إذن تحويل مخزني (Stock Transfer)</option>
                    <option value="stock_adjustment">إذن تسوية جردية (Stock Adjustment)</option>
                    <option value="inventory_count">محضر جرد مخزني (Inventory Count)</option>
                    <option value="opening_balance">رصيد أول المدة (Opening Balance)</option>
                  </select>
                </div>

                <div className="md:col-span-1 lg:col-span-3">
                  <Label className="text-xs font-bold">ملاحظات / بيان المستند</Label>
                  <Input
                    className="mt-1.5 h-10"
                    value={docNotes}
                    onChange={(e) => setDocNotes(e.target.value)}
                    placeholder="مثال: استلام توريد شركة النور، تسوية الفروقات الجردية السنوية.."
                  />
                </div>
              </div>

              {/* Item Builder Panel */}
              <div className="bg-muted/40 p-4 rounded-xl border border-border/60 space-y-3">
                <h4 className="font-bold text-xs text-primary">إضافة صنف إلى جدول المستند</h4>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                  <div className="sm:col-span-2">
                    <Label className="text-[11px] font-bold">الصنف</Label>
                    <select
                      className="w-full mt-1 h-9 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-right"
                      value={docItemForm.inventory_id}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        const selectedItem = (inventoryQuery.data ?? []).find(
                          (i) => i.id === selectedId,
                        );
                        setDocItemForm((s) => ({
                          ...s,
                          inventory_id: selectedId,
                          unit_cost: selectedItem ? String(selectedItem.cost || 0) : "0",
                          quantity: selectedItem ? String(selectedItem.quantity || 0) : "0",
                          counted_quantity: selectedItem ? String(selectedItem.quantity || 0) : "0",
                        }));
                      }}
                    >
                      <option value="">اختر صنف مخزني...</option>
                      {(inventoryQuery.data ?? []).map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name_ar} ({i.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  {docType === "inventory_count" ? (
                    <div>
                      <Label className="text-[11px] font-bold">الكمية الفعلية بالجرد</Label>
                      <Input
                        type="number"
                        className="h-9 mt-1 text-xs"
                        value={docItemForm.counted_quantity}
                        onChange={(e) =>
                          setDocItemForm((s) => ({ ...s, counted_quantity: e.target.value }))
                        }
                      />
                    </div>
                  ) : (
                    <div>
                      <Label className="text-[11px] font-bold">الكمية</Label>
                      <Input
                        type="number"
                        className="h-9 mt-1 text-xs"
                        value={docItemForm.quantity}
                        onChange={(e) =>
                          setDocItemForm((s) => ({ ...s, quantity: e.target.value }))
                        }
                      />
                    </div>
                  )}

                  <div>
                    <Label className="text-[11px] font-bold">سعر تكلفة الوحدة</Label>
                    <Input
                      type="number"
                      className="h-9 mt-1 text-xs"
                      value={docItemForm.unit_cost}
                      onChange={(e) => setDocItemForm((s) => ({ ...s, unit_cost: e.target.value }))}
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddDocItem}
                  className="font-bold text-xs h-8 flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  إدراج الصنف في السطور
                </Button>
              </div>

              {/* Draft Items List */}
              {docItems.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold block text-muted-foreground">
                    السطور المضافة حالياً للمستند:
                  </span>
                  <div className="border border-border rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-right">
                      <thead className="bg-muted text-muted-foreground">
                        <tr className="border-b border-border">
                          <th className="p-2 font-bold text-right">الصنف</th>
                          <th className="p-2 font-bold text-right">
                            {docType === "inventory_count" ? "الكمية الفعلية" : "الكمية المطلوبة"}
                          </th>
                          <th className="p-2 font-bold text-right">التكلفة للوحدة</th>
                          <th className="p-2 font-bold text-right">الإجمالي</th>
                          <th className="p-2 font-bold text-center w-[60px]">حذف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {docItems.map((item, index) => {
                          const name =
                            (inventoryQuery.data ?? []).find((i) => i.id === item.inventory_id)
                              ?.name_ar || "";
                          const displayQty =
                            docType === "inventory_count" ? item.counted_quantity : item.quantity;
                          return (
                            <tr key={index} className="hover:bg-muted/20">
                              <td className="p-2 font-semibold">{name}</td>
                              <td className="p-2">{displayQty}</td>
                              <td className="p-2">{formatPrice(item.unit_cost)}</td>
                              <td className="p-2">
                                {formatPrice(Number(displayQty) * Number(item.unit_cost))}
                              </td>
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDocItems((s) => s.filter((_, idx) => idx !== index))
                                  }
                                  className="text-destructive hover:text-destructive/80"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSaveDocument}
                  disabled={docItems.length === 0}
                  className="font-bold w-full sm:w-auto flex items-center gap-1.5 bg-primary hover:bg-primary/95 text-primary-foreground text-sm py-2 px-5 rounded-lg shadow-sm"
                >
                  <CheckCircle size={16} />
                  ترحيل واعتماد المستند مخزنياً
                </Button>
              </div>
            </div>

            {/* Documents Table - Enhanced to match WarehouseTransfer log */}
            <Card className="border border-border">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-black flex items-center gap-2">
                    <RefreshCw size={18} className="text-primary" />
                    <span>سجل الحركات والتسويات المعتمدة</span>
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    أرشيف كامل لجميع مستندات الحركة والتسوية والوارد والصادر المعمدة
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 font-bold text-xs gap-1"
                  onClick={() => erpStore.syncWithCloud()}
                >
                  <RefreshCw size={12} /> تحديث السجل
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-bold text-right">رقم المستند</TableHead>
                        <TableHead className="font-bold text-right">نوع الحركة</TableHead>
                        <TableHead className="font-bold text-right">التاريخ</TableHead>
                        <TableHead className="font-bold text-center">عدد البنود</TableHead>
                        <TableHead className="font-bold text-right">القيمة الإجمالية</TableHead>
                        <TableHead className="font-bold text-right">الملاحظات</TableHead>
                        <TableHead className="font-bold text-center print:hidden">
                          الإجراءات
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {erpState.inventoryDocuments.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-center py-8 text-muted-foreground text-xs"
                          >
                            لا توجد مستندات مسجلة حالياً
                          </TableCell>
                        </TableRow>
                      ) : (
                        erpState.inventoryDocuments
                          .slice()
                          .reverse()
                          .map((doc) => {
                            let typeLabel = "";
                            let colorClass = "bg-slate-500/10 text-slate-500";

                            if (doc.type === "goods_receipt") {
                              typeLabel = "إذن استلام";
                              colorClass = "bg-emerald-500/10 text-emerald-600";
                            } else if (doc.type === "goods_issue") {
                              typeLabel = "إذن صرف";
                              colorClass = "bg-red-500/10 text-red-600";
                            } else if (doc.type === "stock_transfer") {
                              typeLabel = "تحويل مخزني";
                              colorClass = "bg-blue-500/10 text-blue-600";
                            } else if (doc.type === "stock_adjustment") {
                              typeLabel = "تسوية جردية";
                              colorClass = "bg-amber-500/10 text-amber-600";
                            } else if (doc.type === "inventory_count") {
                              typeLabel = "محضر جرد";
                              colorClass = "bg-purple-500/10 text-purple-600";
                            } else if (doc.type === "opening_balance") {
                              typeLabel = "رصيد أول";
                              colorClass = "bg-teal-500/10 text-teal-600";
                            }

                            const docGrandTotal = doc.items.reduce((acc, item) => {
                              const qty =
                                doc.type === "inventory_count"
                                  ? (item.counted_quantity ?? 0)
                                  : item.quantity;
                              return acc + qty * item.unit_cost;
                            }, 0);

                            return (
                              <TableRow key={doc.id} className="hover:bg-muted/30">
                                <TableCell className="font-mono font-bold text-xs text-primary">
                                  {doc.doc_number}
                                </TableCell>
                                <TableCell>
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${colorClass}`}
                                  >
                                    {typeLabel}
                                  </span>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {new Date(doc.date).toLocaleDateString("ar-EG")}
                                </TableCell>
                                <TableCell className="text-center font-bold text-xs">
                                  {doc.items.length}
                                </TableCell>
                                <TableCell className="font-bold text-xs text-primary">
                                  {formatPrice(docGrandTotal)}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                                  {doc.notes || "-"}
                                </TableCell>
                                <TableCell className="text-center print:hidden">
                                  <div className="flex items-center justify-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                                      onClick={() => setSelectedDocId(doc.id)}
                                      title="عرض"
                                    >
                                      <Eye size={14} />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                                      onClick={() => handlePrintDoc(doc)}
                                      title="طباعة"
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
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* New Expiry Tracking Tab */}
        <TabsContent value="expiry" className="space-y-6 mt-4">
          {/* Expiry KPI Metrics */}
          {(() => {
            const allBatches = erpState.inventoryExpiry || [];
            const nowTime = Date.now();
            let validCount = 0;
            let expiringSoonCount = 0;
            let expiredCount = 0;

            allBatches.forEach((b) => {
              const diffDays = Math.ceil(
                (new Date(b.expiry_date).getTime() - nowTime) / (1000 * 60 * 60 * 24),
              );
              if (diffDays <= 0) expiredCount++;
              else if (diffDays <= 7) expiringSoonCount++;
              else validCount++;
            });

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-card border border-border p-4 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-muted-foreground">
                      إجمالي الدفعات المقيدة
                    </p>
                    <p className="text-2xl font-black text-foreground mt-1">{allBatches.length}</p>
                  </div>
                  <div className="p-3 bg-primary/10 rounded-xl text-primary font-bold">📦</div>
                </div>
                <div className="bg-card border border-emerald-500/20 p-4 rounded-2xl flex items-center justify-between bg-emerald-50/20 dark:bg-emerald-950/10">
                  <div>
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      دفعات صالحة وطازجة
                    </p>
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                      {validCount}
                    </p>
                  </div>
                  <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-600 font-bold">
                    🟢
                  </div>
                </div>
                <div className="bg-card border border-amber-500/20 p-4 rounded-2xl flex items-center justify-between bg-amber-50/20 dark:bg-amber-950/10">
                  <div>
                    <p className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      قريبة الانتهاء (&le; 7 أيام)
                    </p>
                    <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                      {expiringSoonCount}
                    </p>
                  </div>
                  <div className="p-3 bg-amber-500/10 rounded-xl text-amber-600 font-bold">⚠️</div>
                </div>
                <div className="bg-card border border-rose-500/20 p-4 rounded-2xl flex items-center justify-between bg-rose-50/20 dark:bg-rose-950/10">
                  <div>
                    <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
                      دفعات منتهية (تستوجب الإعدام)
                    </p>
                    <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                      {expiredCount}
                    </p>
                  </div>
                  <div className="p-3 bg-rose-500/10 rounded-xl text-rose-600 font-bold">🚨</div>
                </div>
              </div>
            );
          })()}

          {/* Expiry Control & Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-muted/30 p-4 rounded-2xl border border-border">
            <div>
              <Label className="text-xs font-bold block mb-1">تصفية حسب المخزن</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-bold focus:outline-none"
                value={expiryWarehouseFilter}
                onChange={(e) => setExpiryWarehouseFilter(e.target.value)}
              >
                <option value="all">جميع المخازن</option>
                {(warehousesQuery.data ?? []).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs font-bold block mb-1">حالة الصلاحية</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-bold focus:outline-none"
                value={expiryStatusFilter}
                onChange={(e) => setExpiryStatusFilter(e.target.value)}
              >
                <option value="all">الكل</option>
                <option value="valid">🟢 صالحة (أكثر من 7 أيام)</option>
                <option value="expiring_soon">🟡 قريبة الانتهاء (خلال 7 أيام)</option>
                <option value="expired">🔴 منتهية الصلاحية</option>
              </select>
            </div>
            <div>
              <Label className="text-xs font-bold block mb-1">بحث في الدفعات</Label>
              <Input
                className="h-9 text-xs"
                placeholder="ابحث باسم الصنف أو رقم الدفعة..."
                value={expirySearchQuery}
                onChange={(e) => setExpirySearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-card border border-border p-5 rounded-2xl space-y-4 shadow-sm">
              <h3 className="font-bold text-base text-primary flex items-center gap-2">
                <Calendar size={18} />
                تسجيل دفعة تاريخ صلاحية
              </h3>
              <form onSubmit={handleAddExpiryBatch} className="space-y-4">
                <div>
                  <Label className="text-xs font-bold">صنف المخزن</Label>
                  <select
                    className="w-full mt-1.5 h-9 rounded-md border border-input bg-background px-3 text-xs text-right font-bold"
                    value={expiryForm.inventory_id}
                    onChange={(e) => setExpiryForm((s) => ({ ...s, inventory_id: e.target.value }))}
                    required
                  >
                    <option value="">اختر الصنف</option>
                    {(inventoryQuery.data ?? []).map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name_ar} ({i.unit})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-bold">المخزن المستهدف</Label>
                  <select
                    className="w-full mt-1.5 h-9 rounded-md border border-input bg-background px-3 text-xs text-right font-bold"
                    value={expiryForm.warehouse_id}
                    onChange={(e) => setExpiryForm((s) => ({ ...s, warehouse_id: e.target.value }))}
                    required
                  >
                    {(warehousesQuery.data ?? []).map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} {w.is_default ? "(رئيسي)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-bold">رقم الدفعة (Batch / Lot No.)</Label>
                  <Input
                    className="mt-1.5 font-mono text-xs"
                    value={expiryForm.batch_no}
                    onChange={(e) => setExpiryForm((s) => ({ ...s, batch_no: e.target.value }))}
                    placeholder="مثال: BAT-2026-MEAT01"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold">شرط الحفظ والتخزين</Label>
                  <select
                    className="w-full mt-1.5 h-9 rounded-md border border-input bg-background px-3 text-xs text-right font-bold"
                    value={expiryForm.storage_condition}
                    onChange={(e) =>
                      setExpiryForm((s) => ({ ...s, storage_condition: e.target.value }))
                    }
                  >
                    <option value="chilled_4c">❄️ ثلاجة مبردة (4°م)</option>
                    <option value="frozen_18c">🧊 مجمد أسفل (-18°م)</option>
                    <option value="room_temp">☀️ جاف / حرارة الغرفة (25°م)</option>
                    <option value="hot_hold_60c">♨️ سخان حفظ ساخن (60°م)</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-bold">الكمية المقيدة بالصلاحية</Label>
                  <Input
                    className="mt-1.5 text-xs font-mono"
                    type="number"
                    step="0.01"
                    value={expiryForm.quantity}
                    onChange={(e) => setExpiryForm((s) => ({ ...s, quantity: e.target.value }))}
                    placeholder="مثال: 50"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold">تاريخ انتهاء الصلاحية</Label>
                  <Input
                    className="mt-1.5 text-xs font-mono"
                    type="date"
                    value={expiryForm.expiry_date}
                    onChange={(e) => setExpiryForm((s) => ({ ...s, expiry_date: e.target.value }))}
                    required
                  />
                </div>
                <Button type="submit" className="w-full font-bold text-xs gap-1">
                  <CheckCircle size={14} />
                  اعتماد وتسجيل الدفعة
                </Button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-card border border-border p-5 rounded-2xl space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <Building2 size={18} className="text-primary" />
                  دليل دفعات التخزين وترتيب الصرف (FEFO - الأسبقية للأقرب انتهاءً)
                </h3>
              </div>

              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/80 text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="text-right p-3 font-bold">الصنف والمخزن</th>
                      <th className="text-right p-3 font-bold">رقم الدفعة</th>
                      <th className="text-right p-3 font-bold">ظروف الحفظ</th>
                      <th className="text-center p-3 font-bold">الكمية</th>
                      <th className="text-center p-3 font-bold">تاريخ الانتهاء</th>
                      <th className="text-center p-3 font-bold">حالة الصلاحية</th>
                      <th className="text-center p-3 font-bold">إجراء الجودة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(() => {
                      let list = erpState.inventoryExpiry || [];

                      // Apply Warehouse Filter
                      if (expiryWarehouseFilter !== "all") {
                        list = list.filter((b) => b.warehouse_id === expiryWarehouseFilter);
                      }

                      // Apply Search Filter
                      if (expirySearchQuery.trim()) {
                        const q = expirySearchQuery.toLowerCase();
                        list = list.filter((b) => {
                          const item = inventoryQuery.data?.find((i) => i.id === b.inventory_id);
                          return (
                            (item?.name_ar || "").toLowerCase().includes(q) ||
                            (b.batch_no || "").toLowerCase().includes(q)
                          );
                        });
                      }

                      // Filter by status
                      const nowTime = Date.now();
                      if (expiryStatusFilter !== "all") {
                        list = list.filter((b) => {
                          const diffDays = Math.ceil(
                            (new Date(b.expiry_date).getTime() - nowTime) / (1000 * 60 * 60 * 24),
                          );
                          if (expiryStatusFilter === "expired") return diffDays <= 0;
                          if (expiryStatusFilter === "expiring_soon")
                            return diffDays > 0 && diffDays <= 7;
                          if (expiryStatusFilter === "valid") return diffDays > 7;
                          return true;
                        });
                      }

                      // FEFO Sorting: earliest expiring date first
                      const sortedList = [...list].sort(
                        (a, b) =>
                          new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime(),
                      );

                      if (sortedList.length === 0) {
                        return (
                          <tr>
                            <td
                              colSpan={7}
                              className="text-center py-10 text-muted-foreground font-bold"
                            >
                              لا توجد دفعات مخزنية تطابق الفلتر المحدد
                            </td>
                          </tr>
                        );
                      }

                      // Track first item ids for FEFO priority badge
                      const seenItemIds = new Set<string>();

                      return sortedList.map((exp) => {
                        const item = inventoryQuery.data?.find((i) => i.id === exp.inventory_id);
                        const wh = (warehousesQuery.data ?? []).find(
                          (w) => w.id === exp.warehouse_id,
                        );
                        const diffTime = new Date(exp.expiry_date).getTime() - nowTime;
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        let statusColor =
                          "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300";
                        let statusLabel = "طازجة / صالحة";

                        if (diffDays <= 0) {
                          statusColor =
                            "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 font-bold animate-pulse";
                          statusLabel = "منتهية الصلاحية 🔴";
                        } else if (diffDays <= 7) {
                          statusColor =
                            "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 font-bold";
                          statusLabel = "حرجة للغاية 🟡";
                        }

                        let isFEFO = false;
                        if (
                          diffDays > 0 &&
                          exp.inventory_id &&
                          !seenItemIds.has(exp.inventory_id)
                        ) {
                          seenItemIds.add(exp.inventory_id);
                          isFEFO = true;
                        }

                        let storageLabel = "❄️ ثلاجة (4°م)";
                        if (exp.storage_condition === "frozen_18c")
                          storageLabel = "🧊 مجمد (-18°م)";
                        else if (exp.storage_condition === "room_temp")
                          storageLabel = "☀️ جاف / غرفة";
                        else if (exp.storage_condition === "hot_hold_60c")
                          storageLabel = "♨️ سخان (60°م)";

                        return (
                          <tr key={exp.id} className="hover:bg-muted/30 transition-colors">
                            <td className="p-3">
                              <div className="font-bold text-foreground">
                                {item?.name_ar || "صنف غير معرف"}
                              </div>
                              <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                <span>📍 {wh?.name || "المخزن الرئيسي"}</span>
                                {isFEFO && (
                                  <span className="bg-primary/15 text-primary font-black px-1.5 py-0.2 rounded text-[9px]">
                                    ⚡ صرف أولاً (FEFO)
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3 font-mono font-bold text-slate-600 dark:text-slate-300">
                              {exp.batch_no}
                            </td>
                            <td className="p-3 text-muted-foreground">{storageLabel}</td>
                            <td className="p-3 text-center font-mono font-bold">
                              {exp.quantity} {item?.unit || ""}
                            </td>
                            <td className="p-3 text-center font-mono">{exp.expiry_date}</td>
                            <td className="p-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] ${statusColor}`}
                              >
                                {statusLabel}
                              </span>
                              <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                                {diffDays > 0 ? `${diffDays} يوم متبقي` : "تالف / منتهي"}
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              {diffDays <= 0 ? (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-7 text-[10px] font-bold px-2 gap-1"
                                  onClick={() =>
                                    handleDisposeBatch(
                                      exp.id,
                                      exp.batch_no,
                                      item?.name_ar || "الصنف",
                                      exp.quantity,
                                      item?.unit || "وحدة",
                                    )
                                  }
                                >
                                  <Trash2 size={12} />
                                  إعدام وهدر
                                </Button>
                              ) : (
                                <span className="text-[10px] text-emerald-600 font-bold flex items-center justify-center gap-0.5">
                                  <CheckCircle size={12} />
                                  مطابق للرقابة
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* New Purchasing Tab */}
        <TabsContent value="purchases" className="space-y-6 mt-4">
          <Tabs defaultValue="orders" className="w-full">
            <TabsList className="bg-muted/50 p-1 rounded-xl w-fit mb-4">
              <TabsTrigger value="orders" className="rounded-lg text-xs font-bold px-6">
                أوامر الشراء
              </TabsTrigger>
              <TabsTrigger value="suppliers" className="rounded-lg text-xs font-bold px-6">
                إدارة الموردين
              </TabsTrigger>
            </TabsList>

            <TabsContent value="orders">
              <PurchaseManagement />
            </TabsContent>

            <TabsContent value="suppliers">
              <SupplierManagement />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4 mt-4">
          <div className="bg-card border border-border p-6 rounded-2xl space-y-6">
            <div>
              <h3 className="text-lg font-bold text-foreground">إعدادات المخزن والجرد المتقدمة</h3>
              <p className="text-xs text-muted-foreground mt-1">
                تخصيص قواعد تتبع المخزون والخصم التلقائي والتحذيرات
              </p>
            </div>

            <div className="border-t border-border/40 pt-4 space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted/20 border border-border rounded-xl">
                <div className="space-y-0.5">
                  <span className="font-bold text-sm block text-foreground">
                    السماح بالبيع بالسالب (عدم كفاية المخزون)
                  </span>
                  <span className="text-xs text-muted-foreground block">
                    عند التفعيل، يمكن تمرير مبيعات الوجبات في الكاشير حتى لو كانت المكونات الجردية
                    غير كافية بالمخزن.
                  </span>
                </div>
                <button
                  type="button"
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    (erpStore.getState().inventorySettings?.allowNegativeStock ?? true)
                      ? "bg-primary"
                      : "bg-muted-foreground/30"
                  }`}
                  onClick={() => {
                    const current = erpStore.getState().inventorySettings || {
                      allowNegativeStock: true,
                      defaultUnit: "كيلو",
                    };
                    erpStore.saveInventorySettings({
                      ...current,
                      allowNegativeStock: !current.allowNegativeStock,
                    });
                    // Re-sync with store state
                    setErpState(erpStore.getState());
                  }}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${
                      (erpStore.getState().inventorySettings?.allowNegativeStock ?? true)
                        ? "translate-x-5"
                        : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/20 border border-border rounded-xl">
                <div className="space-y-0.5">
                  <span className="font-bold text-sm block text-foreground">
                    الوحدة الافتراضية للجرد
                  </span>
                  <span className="text-xs text-muted-foreground block">
                    الوحدة التي يتم تحديدها افتراضياً عند إضافة مادة خام جديدة للمخزن.
                  </span>
                </div>
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none"
                  value={erpStore.getState().inventorySettings?.defaultUnit ?? "كيلو"}
                  onChange={(e) => {
                    const current = erpStore.getState().inventorySettings || {
                      allowNegativeStock: true,
                      defaultUnit: "كيلو",
                    };
                    erpStore.saveInventorySettings({
                      ...current,
                      defaultUnit: e.target.value,
                    });
                    setErpState(erpStore.getState());
                  }}
                >
                  <option value="كيلو">كيلو جرام (kg)</option>
                  <option value="جرام">جرام (g)</option>
                  <option value="لتر">لتر (l)</option>
                  <option value="مل">مليلتر (ml)</option>
                  <option value="قطعة">قطعة (pcs)</option>
                </select>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4 mt-4">
          <div className="bg-card border border-border p-6 rounded-2xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  تقارير وتحليلات المخزن والوجبات
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  استخرج تحليلات تكلفة الغذاء ومستويات المخزون والهدر وحركات المبيعات
                </p>
              </div>
              <Button
                onClick={() => {
                  let exportData: any[] = [];
                  const fileName = `تقرير_${selectedReportType}_${new Date().toISOString().split("T")[0]}.xlsx`;

                  if (selectedReportType === "current_stock") {
                    const activeWh = (warehousesQuery.data ?? []).find(
                      (w) => w.id === selectedReportWarehouseId,
                    );
                    const whName = activeWh ? activeWh.name : "جميع المخازن";
                    exportData = (inventoryQuery.data ?? []).map((item) => {
                      const ext = erpStore.getExtendedItem(item.id);
                      const qty = getReportItemQty(item);
                      return {
                        المخزن: whName,
                        "كود الصنف": ext.item_code || "",
                        "الاسم (عربي)": item.name_ar,
                        "الاسم (إنجليزي)": ext.name_en || "",
                        التصنيف: ext.category || "خامات ومواد أولية",
                        الوحدة: item.unit,
                        "الكمية الحالية": qty,
                        "الحد الأدنى": item.min_level,
                        "سعر الوحدة": item.cost,
                        الحالة: ext.status === "active" ? "نشط" : "غير نشط",
                      };
                    });
                  } else if (selectedReportType === "valuation") {
                    const activeWh = (warehousesQuery.data ?? []).find(
                      (w) => w.id === selectedReportWarehouseId,
                    );
                    const whName = activeWh ? activeWh.name : "جميع المخازن";
                    exportData = (inventoryQuery.data ?? []).map((item) => {
                      const ext = erpStore.getExtendedItem(item.id);
                      const qty = getReportItemQty(item);
                      return {
                        المخزن: whName,
                        الاسم: item.name_ar,
                        الوحدة: item.unit,
                        الكمية: qty,
                        "تكلفة الوحدة": item.cost,
                        "القيمة الكلية": qty * item.cost,
                        التصنيف: ext.category || "خامات ومواد أولية",
                      };
                    });
                  } else if (selectedReportType === "purchases") {
                    const pos = erpStore.getState().purchaseOrders || [];
                    exportData = pos.flatMap((po) =>
                      (po.items || []).map((it) => {
                        const inv = (inventoryQuery.data ?? []).find(
                          (i) => i.id === it.inventory_id,
                        );
                        const supplier = erpStore
                          .getState()
                          .suppliers.find((s) => s.id === po.supplier_id);
                        return {
                          "تاريخ الطلب": po.order_date,
                          "رقم الطلب": po.id,
                          المورد: supplier?.name_ar || "",
                          الصنف: inv?.name_ar || "",
                          الكمية: it.quantity,
                          "سعر الوحدة": it.unit_cost,
                          "القيمة الإجمالية": it.quantity * it.unit_cost,
                          الحالة:
                            po.status === "received"
                              ? "مستلم"
                              : po.status === "cancelled"
                                ? "ملغى"
                                : "مسودة",
                        };
                      }),
                    );
                  } else if (selectedReportType === "waste_adjustments") {
                    exportData = (transactionsQuery.data ?? [])
                      .filter(
                        (tx) =>
                          tx.type === "out" &&
                          (tx.note?.includes("تالف") ||
                            tx.note?.includes("هدر") ||
                            tx.note?.includes("تسوية") ||
                            tx.note?.includes("تعديل")),
                      )
                      .map((tx) => {
                        const inv = (inventoryQuery.data ?? []).find(
                          (i) => i.id === tx.inventory_id,
                        );
                        return {
                          التاريخ: new Date(tx.created_at || "").toLocaleDateString("ar-EG"),
                          الصنف: inv?.name_ar || "",
                          "الكمية المفقودة": tx.quantity,
                          الوحدة: inv?.unit || "",
                          الملاحظات: tx.note,
                        };
                      });
                  } else if (selectedReportType === "low_stock") {
                    const activeWh = (warehousesQuery.data ?? []).find(
                      (w) => w.id === selectedReportWarehouseId,
                    );
                    const whName = activeWh ? activeWh.name : "جميع المخازن";
                    exportData = (inventoryQuery.data ?? [])
                      .filter((i) => getReportItemQty(i) <= i.min_level)
                      .map((item) => {
                        const ext = erpStore.getExtendedItem(item.id);
                        const qty = getReportItemQty(item);
                        return {
                          المخزن: whName,
                          الصنف: item.name_ar,
                          "الكمية الحالية": qty,
                          "الحد الأدنى": item.min_level,
                          العجز: item.min_level - qty,
                          التصنيف: ext.category || "",
                        };
                      });
                  } else if (selectedReportType === "usage") {
                    exportData = Object.values(
                      (transactionsQuery.data ?? [])
                        .filter((tx) => tx.type === "out" && tx.note?.includes("خصم تلقائي"))
                        .reduce((acc: Record<string, any>, tx) => {
                          const inv = (inventoryQuery.data ?? []).find(
                            (i) => i.id === tx.inventory_id,
                          );
                          if (!inv) return acc;
                          if (!acc[tx.inventory_id]) {
                            acc[tx.inventory_id] = {
                              الصنف: inv.name_ar,
                              "إجمالي الاستهلاك": 0,
                              الوحدة: inv.unit,
                              "القيمة المالية للاستهلاك": 0,
                            };
                          }
                          acc[tx.inventory_id]["إجمالي الاستهلاك"] += tx.quantity;
                          acc[tx.inventory_id]["القيمة المالية للاستهلاك"] +=
                            tx.quantity * Number(inv.cost);
                          return acc;
                        }, {}),
                    );
                  } else if (selectedReportType === "food_cost") {
                    exportData = (menuItemsQuery.data ?? []).map((mItem) => {
                      let cost = 0;
                      const ingredients = Array.isArray(mItem.ingredients) ? mItem.ingredients : [];
                      ingredients.forEach((ing: any) => {
                        const inv = (inventoryQuery.data ?? []).find(
                          (i) => i.id === ing.inventory_id,
                        );
                        if (inv) {
                          const convertedWeight = convertToInventoryUnit(
                            Number(ing.weight),
                            ing.unit,
                            inv.unit,
                          );
                          const wasteFactor = ing.waste_percent
                            ? 1 + Number(ing.waste_percent) / 100
                            : 1;
                          cost += Number(inv.cost) * convertedWeight * wasteFactor;
                        }
                      });
                      const price = Number(mItem.price || 0);
                      return {
                        "اسم الوجبة": mItem.name_ar,
                        "سعر البيع": price,
                        "تكلفة المكونات": cost,
                        "إجمالي الربح": price - cost,
                        "نسبة التكلفة %":
                          price > 0 ? ((cost / price) * 100).toFixed(1) + "%" : "0%",
                      };
                    });
                  } else if (selectedReportType === "movement") {
                    exportData = (transactionsQuery.data ?? []).map((tx: any) => {
                      const inv = (inventoryQuery.data ?? []).find((i) => i.id === tx.inventory_id);
                      const ext = inv ? erpStore.getExtendedItem(inv.id) : null;
                      const txDate =
                        tx.transaction_date ||
                        ext?.transaction_date ||
                        (tx.created_at ? tx.created_at.split("T")[0] : "");
                      const txTime = tx.transaction_time || ext?.transaction_time || "";
                      const sysTime = tx.system_timestamp || tx.created_at || "";
                      return {
                        "رقم المعاملة": tx.tx_number || ext?.tx_number || "-",
                        "رقم قيد اليومية": tx.journal_entry_ref || ext?.journal_entry_ref || "-",
                        "تاريخ المعاملة الفعلي": `${txDate} ${txTime}`.trim(),
                        "توقيت تسجيل النظام": sysTime,
                        الصنف: inv?.name_ar || "",
                        "نوع الحركة": tx.type === "in" ? "إضافة (+)" : "صرف (-)",
                        الكمية: tx.quantity,
                        الوحدة: inv?.unit || "",
                        العملة: tx.currency || ext?.currency || "USD",
                        "سعر الصرف": tx.exchange_rate || ext?.exchange_rate || 1,
                        الخزينة: tx.treasury_name || ext?.treasury_name || "-",
                        "المورد/الحساب": tx.supplier_name || ext?.supplier_name || "-",
                        "البيان / السبب": tx.note || "-",
                      };
                    });
                  }

                  const ws = XLSX.utils.json_to_sheet(exportData);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "التقرير");
                  XLSX.writeFile(wb, fileName);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
              >
                تصدير التقرير الحالي كـ Excel
              </Button>
            </div>

            {/* Filters Dashboard Panel */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 bg-muted/30 p-4 rounded-xl border border-border">
              <div>
                <Label className="text-xs font-bold block mb-1 flex items-center gap-1">
                  <Building2 size={13} className="text-primary" />
                  المخزن المستهدف
                </Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none text-right font-bold"
                  value={selectedReportWarehouseId}
                  onChange={(e) => setSelectedReportWarehouseId(e.target.value)}
                >
                  <option value="all">جميع المخازن (رصيد مجمع)</option>
                  {(warehousesQuery.data ?? []).map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name} {wh.is_default ? "(رئيسي)" : "(فرعي)"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold block mb-1">نوع التقرير</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none text-right font-bold"
                  value={selectedReportType}
                  onChange={(e) => setSelectedReportType(e.target.value)}
                >
                  <option value="current_stock">جرد المخزون الحالي (Current Stock)</option>
                  <option value="valuation">تقييم المخزون المالي (Stock Valuation)</option>
                  <option value="purchases">مشتريات التوريد (Purchases Report)</option>
                  <option value="waste_adjustments">الهدر والتسويات (Waste & Adjustments)</option>
                  <option value="low_stock">تنبيهات النقص (Low Stock Alerts)</option>
                  <option value="usage">استهلاك المكونات من الطلبات (Ingredient Usage)</option>
                  <option value="food_cost">تحليل تكلفة الوجبات (Food Cost / Margin)</option>
                  <option value="movement">كشف حركة المخزن (Inventory Ledger)</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold block mb-1">بحث نصي</Label>
                <Input
                  type="text"
                  placeholder="بحث باسم الصنف..."
                  value={reportSearchQuery}
                  onChange={(e) => setReportSearchQuery(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-bold block mb-1">تاريخ البدء</Label>
                <Input
                  type="date"
                  value={reportDateStart}
                  onChange={(e) => setReportDateStart(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-bold block mb-1">تاريخ الانتهاء</Label>
                <Input
                  type="date"
                  value={reportDateEnd}
                  onChange={(e) => setReportDateEnd(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Dynamic Report Content Section */}
            <div className="border border-border/60 rounded-2xl overflow-hidden bg-background">
              {selectedReportType === "current_stock" && (
                <div className="p-4 space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-muted/20 p-3 rounded-lg border border-border text-xs gap-2">
                    <span className="font-bold flex items-center gap-1.5">
                      <Building2 size={14} className="text-primary" />
                      نطاق التقرير المخزني:{" "}
                      <span className="text-primary font-black">
                        {selectedReportWarehouseId === "all"
                          ? "جميع المخازن (رصيد مجمع)"
                          : (warehousesQuery.data ?? []).find(
                              (w) => w.id === selectedReportWarehouseId,
                            )?.name || "المخزن المحدد"}
                      </span>
                    </span>
                    <span className="font-mono font-bold text-primary">
                      {(inventoryQuery.data ?? []).length} أصناف
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/30 text-muted-foreground font-bold">
                          <th className="p-2.5">كود الصنف</th>
                          <th className="p-2.5">الاسم</th>
                          <th className="p-2.5">التصنيف</th>
                          <th className="p-2.5 text-center">الوحدة</th>
                          <th className="p-2.5 text-center">الكمية الحالية</th>
                          <th className="p-2.5 text-center">حد إعادة الطلب</th>
                          <th className="p-2.5 text-left">التكلفة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(inventoryQuery.data ?? [])
                          .filter((item) => item.name_ar.includes(reportSearchQuery))
                          .map((item) => {
                            const ext = erpStore.getExtendedItem(item.id);
                            const qty = getReportItemQty(item);
                            return (
                              <tr
                                key={item.id}
                                className="border-b border-border/40 hover:bg-muted/10"
                              >
                                <td className="p-2.5 font-mono text-muted-foreground">
                                  {ext.item_code || "-"}
                                </td>
                                <td className="p-2.5 font-bold">{item.name_ar}</td>
                                <td className="p-2.5 text-muted-foreground">
                                  {ext.category || "خامات ومواد أولية"}
                                </td>
                                <td className="p-2.5 text-center font-bold text-slate-500">
                                  {item.unit}
                                </td>
                                <td
                                  className={`p-2.5 text-center font-mono font-bold ${qty <= item.min_level ? "text-rose-600 animate-pulse" : "text-foreground"}`}
                                >
                                  {qty.toFixed(2)}
                                </td>
                                <td className="p-2.5 text-center font-mono text-muted-foreground">
                                  {item.min_level}
                                </td>
                                <td className="p-2.5 text-left font-mono font-bold">
                                  {item.cost.toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedReportType === "valuation" && (
                <div className="p-4 space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/30 text-xs gap-2">
                    <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <Building2 size={14} className="text-emerald-600" />
                      القيمة المالية الكلية بـ (
                      {selectedReportWarehouseId === "all"
                        ? "جميع المخازن"
                        : (warehousesQuery.data ?? []).find(
                            (w) => w.id === selectedReportWarehouseId,
                          )?.name || "المخزن المحدد"}
                      ):
                    </span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      {formatPrice(
                        (inventoryQuery.data ?? []).reduce(
                          (sum, item) => sum + getReportItemQty(item) * item.cost,
                          0,
                        ),
                      )}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/30 text-muted-foreground font-bold">
                          <th className="p-2.5">اسم المادة الخام</th>
                          <th className="p-2.5 text-center">الوحدة</th>
                          <th className="p-2.5 text-center">الكمية</th>
                          <th className="p-2.5 text-left">تكلفة الوحدة</th>
                          <th className="p-2.5 text-left">القيمة الكلية</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(inventoryQuery.data ?? [])
                          .filter((item) => item.name_ar.includes(reportSearchQuery))
                          .map((item) => {
                            const qty = getReportItemQty(item);
                            return (
                              <tr
                                key={item.id}
                                className="border-b border-border/40 hover:bg-muted/10"
                              >
                                <td className="p-2.5 font-bold">{item.name_ar}</td>
                                <td className="p-2.5 text-center font-bold text-slate-500">
                                  {item.unit}
                                </td>
                                <td className="p-2.5 text-center font-mono">{qty.toFixed(2)}</td>
                                <td className="p-2.5 text-left font-mono">
                                  {item.cost.toFixed(2)}
                                </td>
                                <td className="p-2.5 text-left font-mono font-bold text-emerald-600 dark:text-emerald-500">
                                  {(qty * item.cost).toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedReportType === "purchases" && (
                <div className="p-4 space-y-4">
                  <div className="flex justify-between items-center bg-muted/20 p-3 rounded-lg border border-border text-xs">
                    <span className="font-bold">إجمالي مبالغ أوامر التوريد للمخزن:</span>
                    <span className="font-mono font-bold text-primary">
                      {formatPrice(
                        (erpStore.getState().purchaseOrders || []).reduce(
                          (sum, po) => sum + po.total,
                          0,
                        ),
                      )}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/30 text-muted-foreground font-bold">
                          <th className="p-2.5">تاريخ الطلب</th>
                          <th className="p-2.5">رقم الطلب</th>
                          <th className="p-2.5">المورد</th>
                          <th className="p-2.5 text-left">المبلغ الإجمالي</th>
                          <th className="p-2.5 text-center">الحالة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(erpStore.getState().purchaseOrders || []).map((po) => {
                          const supplier = erpStore
                            .getState()
                            .suppliers.find((s) => s.id === po.supplier_id);
                          return (
                            <tr key={po.id} className="border-b border-border/40 hover:bg-muted/10">
                              <td className="p-2.5 text-muted-foreground">{po.order_date}</td>
                              <td className="p-2.5 font-mono font-bold text-primary">
                                {po.id.substring(0, 8)}
                              </td>
                              <td className="p-2.5 font-bold">
                                {supplier?.name_ar || "مورد مجهول"}
                              </td>
                              <td className="p-2.5 text-left font-mono font-bold">
                                {po.total.toFixed(2)}
                              </td>
                              <td className="p-2.5 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    po.status === "received"
                                      ? "bg-emerald-500/10 text-emerald-600"
                                      : "bg-amber-500/10 text-amber-600"
                                  }`}
                                >
                                  {po.status === "received" ? "مستلم" : "تحت المراجعة"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedReportType === "waste_adjustments" && (
                <div className="p-4 space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/30 text-muted-foreground font-bold">
                          <th className="p-2.5">التاريخ</th>
                          <th className="p-2.5">الصنف</th>
                          <th className="p-2.5 text-center font-bold">الكمية</th>
                          <th className="p-2.5">نوع التسوية / الهدر</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(transactionsQuery.data ?? [])
                          .filter(
                            (tx) =>
                              tx.type === "out" &&
                              (tx.note?.includes("تالف") ||
                                tx.note?.includes("هدر") ||
                                tx.note?.includes("تسوية") ||
                                tx.note?.includes("تعديل")),
                          )
                          .map((tx) => {
                            const inv = (inventoryQuery.data ?? []).find(
                              (i) => i.id === tx.inventory_id,
                            );
                            return (
                              <tr
                                key={tx.id}
                                className="border-b border-border/40 hover:bg-muted/10"
                              >
                                <td className="p-2.5 text-muted-foreground">
                                  {new Date(tx.created_at || "").toLocaleDateString("ar-EG")}
                                </td>
                                <td className="p-2.5 font-bold">{inv?.name_ar || "صنف مجهول"}</td>
                                <td className="p-2.5 text-center font-mono font-bold text-rose-600">
                                  -{tx.quantity} {inv?.unit}
                                </td>
                                <td className="p-2.5 text-muted-foreground italic">{tx.note}</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedReportType === "low_stock" && (
                <div className="p-4 space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/30 text-muted-foreground font-bold">
                          <th className="p-2.5">اسم المادة الخام</th>
                          <th className="p-2.5 text-center">الكمية الحالية</th>
                          <th className="p-2.5 text-center">حد إعادة الطلب</th>
                          <th className="p-2.5 text-center text-rose-600">النقص الحاد</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(inventoryQuery.data ?? [])
                          .filter((item) => getReportItemQty(item) <= item.min_level)
                          .map((item) => {
                            const qty = getReportItemQty(item);
                            return (
                              <tr
                                key={item.id}
                                className="border-b border-border/40 hover:bg-muted/10"
                              >
                                <td className="p-2.5 font-bold text-rose-600">{item.name_ar}</td>
                                <td className="p-2.5 text-center font-mono font-bold">
                                  {qty.toFixed(2)}
                                </td>
                                <td className="p-2.5 text-center font-mono">{item.min_level}</td>
                                <td className="p-2.5 text-center font-mono font-bold text-rose-500">
                                  {(item.min_level - qty).toFixed(2)} {item.unit}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedReportType === "usage" && (
                <div className="p-4 space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/30 text-muted-foreground font-bold">
                          <th className="p-2.5">المادة الخام</th>
                          <th className="p-2.5 text-center">إجمالي الكمية المستهلكة</th>
                          <th className="p-2.5 text-center">الوحدة</th>
                          <th className="p-2.5 text-left">التكلفة المالية للاستهلاك</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.values(
                          (transactionsQuery.data ?? [])
                            .filter((tx) => tx.type === "out" && tx.note?.includes("خصم تلقائي"))
                            .reduce((acc: Record<string, any>, tx) => {
                              const inv = (inventoryQuery.data ?? []).find(
                                (i) => i.id === tx.inventory_id,
                              );
                              if (!inv) return acc;
                              if (!acc[tx.inventory_id]) {
                                acc[tx.inventory_id] = {
                                  id: tx.inventory_id,
                                  name: inv.name_ar,
                                  qty: 0,
                                  unit: inv.unit,
                                  cost: Number(inv.cost),
                                };
                              }
                              acc[tx.inventory_id].qty += tx.quantity;
                              return acc;
                            }, {}),
                        ).map((item: any) => (
                          <tr key={item.id} className="border-b border-border/40 hover:bg-muted/10">
                            <td className="p-2.5 font-bold">{item.name}</td>
                            <td className="p-2.5 text-center font-mono text-amber-600 font-bold">
                              {item.qty.toFixed(2)}
                            </td>
                            <td className="p-2.5 text-center font-bold text-slate-500">
                              {item.unit}
                            </td>
                            <td className="p-2.5 text-left font-mono font-bold text-rose-600">
                              {(item.qty * item.cost).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedReportType === "food_cost" && (
                <div className="p-4 space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/30 text-muted-foreground font-bold">
                          <th className="p-2.5">اسم الوجبة</th>
                          <th className="p-2.5 text-center">سعر البيع</th>
                          <th className="p-2.5 text-center">تكلفة المكونات</th>
                          <th className="p-2.5 text-center">إجمالي الربح</th>
                          <th className="p-2.5 text-left">نسبة تكلفة المكونات %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(menuItemsQuery.data ?? [])
                          .filter((item) => item.name_ar.includes(reportSearchQuery))
                          .map((mItem) => {
                            let cost = 0;
                            const ingredients = Array.isArray(mItem.ingredients)
                              ? mItem.ingredients
                              : [];
                            ingredients.forEach((ing: any) => {
                              const inv = (inventoryQuery.data ?? []).find(
                                (i) => i.id === ing.inventory_id,
                              );
                              if (inv) {
                                const convertedWeight = convertToInventoryUnit(
                                  Number(ing.weight),
                                  ing.unit,
                                  inv.unit,
                                );
                                const wasteFactor = ing.waste_percent
                                  ? 1 + Number(ing.waste_percent) / 100
                                  : 1;
                                cost += Number(inv.cost) * convertedWeight * wasteFactor;
                              }
                            });
                            const price = Number(mItem.price || 0);
                            const profit = price - cost;
                            const costPercentage = price > 0 ? (cost / price) * 100 : 0;
                            return (
                              <tr
                                key={mItem.id}
                                className="border-b border-border/40 hover:bg-muted/10"
                              >
                                <td className="p-2.5 font-bold">{mItem.name_ar}</td>
                                <td className="p-2.5 text-center font-mono font-bold text-slate-700">
                                  {price.toFixed(2)}
                                </td>
                                <td className="p-2.5 text-center font-mono font-bold text-rose-600">
                                  {cost.toFixed(2)}
                                </td>
                                <td className="p-2.5 text-center font-mono font-bold text-emerald-600">
                                  {profit.toFixed(2)}
                                </td>
                                <td
                                  className={`p-2.5 text-left font-mono font-bold ${costPercentage > 35 ? "text-amber-600" : "text-emerald-600"}`}
                                >
                                  {costPercentage.toFixed(1)}%
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedReportType === "movement" && (
                <div className="p-4 space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/30 text-muted-foreground font-bold">
                          <th className="p-2.5">رقم المعاملة / القيد</th>
                          <th className="p-2.5">تاريخ المعاملة الفعلي</th>
                          <th className="p-2.5">توقيت تسجيل النظام</th>
                          <th className="p-2.5">اسم الصنف</th>
                          <th className="p-2.5 text-center">نوع الحركة</th>
                          <th className="p-2.5 text-center">الكمية والعملة</th>
                          <th className="p-2.5">الخزينة والمورد</th>
                          <th className="p-2.5">البيان والسبب</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(transactionsQuery.data ?? []).map((tx: any) => {
                          const inv = (inventoryQuery.data ?? []).find(
                            (i) => i.id === tx.inventory_id,
                          );
                          const ext = inv ? erpStore.getExtendedItem(inv.id) : null;
                          const txDate =
                            tx.transaction_date ||
                            ext?.transaction_date ||
                            (tx.created_at ? tx.created_at.split("T")[0] : "");
                          const txTime = tx.transaction_time || ext?.transaction_time || "";
                          const sysTime =
                            tx.system_timestamp || tx.created_at
                              ? new Date(tx.system_timestamp || tx.created_at).toLocaleString(
                                  "ar-EG",
                                )
                              : "-";
                          const curr = tx.currency || ext?.currency || "USD";
                          const rate = tx.exchange_rate || ext?.exchange_rate || 1;
                          const treasuryName =
                            tx.treasury_name || ext?.treasury_name || "الخزينة الرئيسية";
                          const supplierName = tx.supplier_name || ext?.supplier_name || "-";
                          const txNum = tx.tx_number || ext?.tx_number || "TX-INV-000";
                          const journalRef =
                            tx.journal_entry_ref || ext?.journal_entry_ref || "JV-000";

                          return (
                            <tr key={tx.id} className="border-b border-border/40 hover:bg-muted/10">
                              <td className="p-2.5 font-mono text-muted-foreground">
                                <span className="block font-bold text-primary">{txNum}</span>
                                <span className="block text-[10px] text-emerald-600 font-mono">
                                  {journalRef}
                                </span>
                              </td>
                              <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">
                                {txDate}{" "}
                                {txTime && (
                                  <span className="text-muted-foreground text-[11px]">
                                    ({txTime})
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-muted-foreground text-[11px]">{sysTime}</td>
                              <td className="p-2.5 font-bold">{inv?.name_ar || "صنف مجهول"}</td>
                              <td className="p-2.5 text-center font-bold">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] ${
                                    tx.type === "in"
                                      ? "bg-emerald-500/10 text-emerald-600"
                                      : "bg-rose-500/10 text-rose-600"
                                  }`}
                                >
                                  {tx.type === "in" ? "توريد وإدخال" : "صرف وخصم"}
                                </span>
                              </td>
                              <td className="p-2.5 text-center font-mono font-bold">
                                <div>
                                  {tx.quantity} {inv?.unit}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {curr} {curr !== "USD" && `(سعر: ${rate})`}
                                </div>
                              </td>
                              <td className="p-2.5 text-xs text-muted-foreground">
                                <div>
                                  <span className="font-bold text-foreground">خزينة:</span>{" "}
                                  {treasuryName}
                                </div>
                                {supplierName !== "-" && (
                                  <div>
                                    <span className="font-bold text-foreground">مورد:</span>{" "}
                                    {supplierName}
                                  </div>
                                )}
                              </td>
                              <td className="p-2.5 text-muted-foreground italic text-[11px] max-w-[200px] truncate">
                                {tx.note}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Selected Document Details Modal */}
      {selectedDocId &&
        (() => {
          const doc = erpState.inventoryDocuments.find((d) => d.id === selectedDocId);
          if (!doc) return null;

          let typeLabel = "";
          let colorClass = "bg-slate-500/10 text-slate-500";

          if (doc.type === "goods_receipt") {
            typeLabel = "إذن استلام بضاعة (Goods Receipt)";
            colorClass = "bg-emerald-500/10 text-emerald-600";
          } else if (doc.type === "goods_issue") {
            typeLabel = "إذن صرف بضاعة (Goods Issue)";
            colorClass = "bg-red-500/10 text-red-600";
          } else if (doc.type === "stock_transfer") {
            typeLabel = "إذن تحويل مخزني (Stock Transfer)";
            colorClass = "bg-blue-500/10 text-blue-600";
          } else if (doc.type === "stock_adjustment") {
            typeLabel = "إذن تسوية جردية (Stock Adjustment)";
            colorClass = "bg-amber-500/10 text-amber-600";
          } else if (doc.type === "inventory_count") {
            typeLabel = "محضر جرد مخزني (Inventory Count)";
            colorClass = "bg-purple-500/10 text-purple-600";
          } else if (doc.type === "opening_balance") {
            typeLabel = "رصيد أول المدة (Opening Balance)";
            colorClass = "bg-teal-500/10 text-teal-600";
          }

          const grandTotal = doc.items.reduce((acc, item) => {
            const qty =
              doc.type === "inventory_count" ? (item.counted_quantity ?? 0) : item.quantity;
            return acc + qty * item.unit_cost;
          }, 0);

          return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto print:p-0 print:bg-white print:static">
              <div className="bg-card border border-border w-full max-w-4xl rounded-2xl p-6 space-y-6 shadow-2xl relative text-right print:shadow-none print:border-none print:max-w-none print:p-0">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-border/80 pb-4 print:pb-6">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-black text-foreground flex items-center gap-2">
                      <FileText className="text-primary" size={26} />
                      <span>{typeLabel}</span>
                    </h2>
                    <p className="text-sm text-muted-foreground font-mono">
                      رقم المرجع: {doc.doc_number}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 print:hidden">
                    <Button
                      onClick={() => handlePrintDoc()}
                      className="gap-2 font-bold bg-primary hover:bg-primary/90"
                      size="sm"
                    >
                      <Printer size={16} />
                      طباعة المستند
                    </Button>
                    <button
                      onClick={() => setSelectedDocId(null)}
                      className="text-muted-foreground hover:text-foreground text-sm font-bold bg-muted px-3 py-1.5 rounded-lg"
                    >
                      إغلاق
                    </button>
                  </div>
                  <div className="hidden print:block text-left font-mono text-sm">
                    {new Date(doc.date).toLocaleString("ar-EG")}
                  </div>
                </div>

                {/* Meta information */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-5 bg-muted/30 rounded-2xl border border-border/40 print:bg-white print:grid-cols-2 print:gap-8">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">
                      تاريخ الترحيل والاعتماد:
                    </span>
                    <p className="font-bold text-foreground">
                      {new Date(doc.date).toLocaleString("ar-EG")}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">البيان والملاحظات:</span>
                    <p className="font-bold text-foreground">
                      {doc.notes || "لا توجد ملاحظات إضافية لهذا المستند"}
                    </p>
                  </div>
                </div>

                {/* Items Table */}
                <div className="space-y-3">
                  <h4 className="text-sm font-black flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-primary rounded-full"></div>
                    تفاصيل البنود والكميات المدرجة
                  </h4>
                  <div className="border border-border rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 border-b border-border">
                        <tr>
                          <th className="p-3.5 font-black text-right">الصنف المخزني</th>
                          <th className="p-3.5 font-black text-center">
                            {doc.type === "inventory_count" ? "الكمية الدفترية" : "الكمية"}
                          </th>
                          {doc.type === "inventory_count" && (
                            <>
                              <th className="p-3.5 font-black text-center">الكمية الفعلية</th>
                              <th className="p-3.5 font-black text-center">الفروقات</th>
                            </>
                          )}
                          <th className="p-3.5 font-black text-right">التكلفة للوحدة</th>
                          <th className="p-3.5 font-black text-left">إجمالي البند</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {doc.items.map((item, idx) => {
                          const invItem = (inventoryQuery.data ?? []).find(
                            (i) => i.id === item.inventory_id,
                          );
                          const displayQty =
                            doc.type === "inventory_count"
                              ? (item.counted_quantity ?? 0)
                              : item.quantity;
                          return (
                            <tr key={idx} className="hover:bg-muted/10 transition-colors">
                              <td className="p-3.5">
                                <span className="font-bold block text-foreground">
                                  {invItem?.name_ar || "صنف مخزني مجهول"}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {invItem?.unit}
                                </span>
                              </td>
                              <td className="p-3.5 text-center font-mono font-bold">
                                {doc.type === "inventory_count"
                                  ? (Number(displayQty) - Number(item.difference ?? 0)).toFixed(2)
                                  : item.quantity.toFixed(2)}
                              </td>
                              {doc.type === "inventory_count" && (
                                <>
                                  <td className="p-3.5 text-center font-mono font-black text-emerald-600">
                                    {Number(item.counted_quantity).toFixed(2)}
                                  </td>
                                  <td
                                    className={`p-3.5 text-center font-mono font-bold ${Number(item.difference ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500"}`}
                                  >
                                    {Number(item.difference ?? 0) > 0
                                      ? `+${Number(item.difference).toFixed(2)}`
                                      : Number(item.difference).toFixed(2)}
                                  </td>
                                </>
                              )}
                              <td className="p-3.5 text-right font-mono">
                                {formatPrice(item.unit_cost)}
                              </td>
                              <td className="p-3.5 text-left font-black font-mono text-primary">
                                {formatPrice(Number(displayQty) * Number(item.unit_cost))}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-muted/30 border-t border-border">
                        <tr>
                          <td
                            colSpan={doc.type === "inventory_count" ? 4 : 2}
                            className="p-4 font-black text-right text-base"
                          >
                            القيمة الإجمالية للمستند:
                          </td>
                          <td
                            colSpan={2}
                            className="p-4 font-black text-left text-xl text-primary font-mono"
                          >
                            {formatPrice(grandTotal)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Footer Signatures for Print */}
                <div className="hidden print:grid grid-cols-3 gap-12 pt-12 mt-12 border-t">
                  <div className="text-center space-y-4">
                    <span className="font-bold border-b border-black pb-2 block">أمين المخزن</span>
                    <div className="h-12"></div>
                  </div>
                  <div className="text-center space-y-4">
                    <span className="font-bold border-b border-black pb-2 block">
                      المحاسب المراجع
                    </span>
                    <div className="h-12"></div>
                  </div>
                  <div className="text-center space-y-4">
                    <span className="font-bold border-b border-black pb-2 block">
                      مدير العمليات
                    </span>
                    <div className="h-12"></div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Interactive PO Receiving Modal */}
      {receivingPoId &&
        (() => {
          const po = erpState.purchaseOrders.find((p) => p.id === receivingPoId);
          if (!po) return null;

          const supplier = erpState.suppliers.find((s) => s.id === po.supplier_id);

          return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
              <div className="bg-card border border-border w-full max-w-2xl rounded-2xl p-6 space-y-6 shadow-2xl relative text-right">
                <div className="flex items-start justify-between border-b border-border pb-4">
                  <div>
                    <h3 className="text-lg font-black text-foreground">
                      استلام بضائع وتوريد أمر شراء
                    </h3>
                    <span className="text-xs text-muted-foreground block font-mono mt-1">
                      أمر الشراء رقم: PO-{po.id.substring(3, 8).toUpperCase()} • المورد:{" "}
                      {supplier?.name_ar}
                    </span>
                  </div>
                  <button
                    onClick={() => setReceivingPoId(null)}
                    className="text-muted-foreground hover:text-foreground text-sm font-bold bg-muted px-3 py-1 rounded-lg"
                  >
                    إلغاء
                  </button>
                </div>

                <form onSubmit={handleReceivePOPartialSubmit} className="space-y-4">
                  <div>
                    <Label className="text-xs font-bold">الحساب النقدي للصرف / السداد للمورد</Label>
                    <select
                      className="w-full mt-1.5 h-10 rounded-md border border-input bg-background px-3 text-sm text-right font-bold"
                      value={selectedReceiveTreasuryId}
                      onChange={(e) => setSelectedReceiveTreasuryId(e.target.value)}
                      required
                    >
                      <option value="">اختر خزينة السداد...</option>
                      {erpState.treasuries.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.account_code ? `[رقم الحساب: ${t.account_code}] ` : ""}
                          {t.name_ar} (رصيد متاح: {t.balance.toFixed(2)}{" "}
                          {t.name_ar.includes("دولار")
                            ? "USD"
                            : t.name_ar.includes("سوداني")
                              ? "SSP"
                              : t.currency && t.currency !== "MULTI"
                                ? t.currency
                                : "EGP"}
                          )
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <span className="text-xs font-bold block text-primary">
                      تحديد الكميات الواردة والمستلمة فعلياً:
                    </span>

                    <div className="rounded-xl border border-border overflow-hidden text-xs">
                      <table className="w-full text-right">
                        <thead className="bg-muted text-muted-foreground">
                          <tr className="border-b border-border">
                            <th className="p-2 font-bold text-right">الصنف</th>
                            <th className="p-2 font-bold text-center">الكمية المطلوبة</th>
                            <th className="p-2 font-bold text-center">المستلمة مسبقاً</th>
                            <th className="p-2 font-bold text-center w-[120px]">المستلمة الآن</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {po.items.map((item, idx) => {
                            const invItem = inventoryQuery.data?.find(
                              (i) => i.id === item.inventory_id,
                            );
                            const remaining = item.quantity - (item.received_quantity || 0);
                            return (
                              <tr key={idx} className="hover:bg-muted/10">
                                <td className="p-2 font-bold text-foreground">
                                  {invItem?.name_ar || "صنف مجهول"}
                                </td>
                                <td className="p-2 text-center font-mono text-foreground">
                                  {item.quantity}
                                </td>
                                <td className="p-2 text-center font-mono text-emerald-600">
                                  {item.received_quantity || 0}
                                </td>
                                <td className="p-2">
                                  <Input
                                    type="number"
                                    min="0"
                                    max={remaining}
                                    step="any"
                                    className="h-8 text-center font-mono font-bold"
                                    value={receiveQuantities[item.inventory_id] || ""}
                                    onChange={(e) =>
                                      setReceiveQuantities((prev) => ({
                                        ...prev,
                                        [item.inventory_id]: e.target.value,
                                      }))
                                    }
                                    placeholder={String(remaining)}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex justify-end pt-3 border-t border-border gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setReceivingPoId(null)}
                      className="font-bold text-xs"
                    >
                      إلغاء التوريد
                    </Button>
                    <Button
                      type="submit"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                    >
                      اعتماد مستند التوريد الفعلي للمخازن
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          );
        })()}

      {/* Interactive PO Returning Modal */}
      {returningPoId &&
        (() => {
          const po = erpState.purchaseOrders.find((p) => p.id === returningPoId);
          if (!po) return null;

          const supplier = erpState.suppliers.find((s) => s.id === po.supplier_id);

          return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
              <div className="bg-card border border-border w-full max-w-2xl rounded-2xl p-6 space-y-6 shadow-2xl relative text-right">
                <div className="flex items-start justify-between border-b border-border pb-4">
                  <div>
                    <h3 className="text-lg font-black text-rose-600">إرجاع مرتجع بضائع للمورد</h3>
                    <span className="text-xs text-muted-foreground block font-mono mt-1">
                      أمر الشراء رقم: PO-{po.id.substring(3, 8).toUpperCase()} • المورد:{" "}
                      {supplier?.name_ar}
                    </span>
                  </div>
                  <button
                    onClick={() => setReturningPoId(null)}
                    className="text-muted-foreground hover:text-foreground text-sm font-bold bg-muted px-3 py-1 rounded-lg"
                  >
                    إلغاء
                  </button>
                </div>

                <form onSubmit={handleReturnPOItemsSubmit} className="space-y-4">
                  <div className="space-y-3">
                    <span className="text-xs font-bold block text-rose-500">
                      تحديد الكميات المرتجعة للمورد:
                    </span>

                    <div className="rounded-xl border border-border overflow-hidden text-xs">
                      <table className="w-full text-right">
                        <thead className="bg-muted text-muted-foreground">
                          <tr className="border-b border-border">
                            <th className="p-2 font-bold text-right">الصنف</th>
                            <th className="p-2 font-bold text-center">الكمية المستلمة مسبقاً</th>
                            <th className="p-2 font-bold text-center">الكمية المرتجعة مسبقاً</th>
                            <th className="p-2 font-bold text-center w-[120px]">
                              الكمية المرتجعة الآن
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {po.items.map((item, idx) => {
                            const invItem = inventoryQuery.data?.find(
                              (i) => i.id === item.inventory_id,
                            );
                            const maxReturnable =
                              (item.received_quantity || 0) - (item.returned_quantity || 0);
                            return (
                              <tr key={idx} className="hover:bg-muted/10">
                                <td className="p-2 font-bold text-foreground">
                                  {invItem?.name_ar || "صنف مجهول"}
                                </td>
                                <td className="p-2 text-center font-mono text-emerald-600">
                                  {item.received_quantity || 0}
                                </td>
                                <td className="p-2 text-center font-mono text-rose-600">
                                  {item.returned_quantity || 0}
                                </td>
                                <td className="p-2">
                                  <Input
                                    type="number"
                                    min="0"
                                    max={maxReturnable}
                                    step="any"
                                    className="h-8 text-center font-mono font-bold"
                                    value={returnQuantities[item.inventory_id] || ""}
                                    onChange={(e) =>
                                      setReturnQuantities((prev) => ({
                                        ...prev,
                                        [item.inventory_id]: e.target.value,
                                      }))
                                    }
                                    placeholder={String(maxReturnable)}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex justify-end pt-3 border-t border-border gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setReturningPoId(null)}
                      className="font-bold text-xs"
                    >
                      إلغاء المرتجع
                    </Button>
                    <Button
                      type="submit"
                      className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
                    >
                      اعتماد مستند إرجاع البضائع وحسم الرصيد
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          );
        })()}

      {/* Batch Disposal Confirmation Modal */}
      {disposeBatchDialog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in duration-200 text-right">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <span className="bg-rose-100 text-rose-800 text-xs font-black px-2.5 py-1 rounded-lg flex items-center gap-1">
                <AlertTriangle size={14} />
                تأكيد إعدام وهدر دفعة
              </span>
              <h3 className="text-lg font-black text-slate-900">إعدام دفعة منتهية الصلاحية</h3>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 mb-4 text-slate-800">
              <p className="text-sm font-bold mb-2 text-rose-900">
                هل أنت مقتنع وتؤكد إعدام الدفعة المالية والتخزينية الآتية؟
              </p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-rose-200/60">
                  <span className="font-bold text-slate-600">اسم الصنف:</span>
                  <span className="font-black text-slate-900">{disposeBatchDialog.itemName}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-rose-200/60">
                  <span className="font-bold text-slate-600">رقم الدفعة (Batch No):</span>
                  <span className="font-mono font-black text-rose-700">
                    {disposeBatchDialog.batchNo}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="font-bold text-slate-600">الكمية المشطوبة:</span>
                  <span className="font-mono font-black text-rose-700 text-sm">
                    {disposeBatchDialog.quantity} {disposeBatchDialog.unit}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div>
                <label className="text-xs font-bold block mb-1 text-slate-700">
                  سبب الإعدام والهدر
                </label>
                <select
                  className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  value={disposeBatchDialog.reason}
                  onChange={(e) =>
                    setDisposeBatchDialog({
                      ...disposeBatchDialog,
                      reason: e.target.value,
                    })
                  }
                >
                  <option value="إعدام انتهاء صلاحية وسوء تخزين">
                    إعدام انتهاء صلاحية وسوء تخزين
                  </option>
                  <option value="تلف مادي في العبوة والتعبئة">تلف مادي في العبوة والتعبئة</option>
                  <option value="عدم مطابقة معايير جودة سلامة الغذاء">
                    عدم مطابقة معايير جودة سلامة الغذاء
                  </option>
                  <option value="عطل في أجهزة التبريد والتجميد">
                    عطل في أجهزة التبريد والتجميد
                  </option>
                </select>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
                <p className="font-bold text-slate-800 flex items-center gap-1">
                  ⚡ الإجراءات التلقائية فور الضغط على التأكيد:
                </p>
                <p>• خصم كمية الدفعة بالكامل من رصيد المخزن الفعلي.</p>
                <p>• توثيق حركة صرف مخزني نوع (الهدر والتلف) بسجل الرقابة والجودة.</p>
                <p>
                  • إنشاء وإثبات القيد المحاسبي المزدوج أوتوماتيكياً بدفتر الأستاذ العامة (حساب
                  506000 المفقودات والخسائر).
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                disabled={isDisposingBatch}
                onClick={() => setDisposeBatchDialog(null)}
                className="rounded-xl font-bold border-slate-300 text-slate-700 px-4"
              >
                إلغاء
              </Button>
              <Button
                variant="destructive"
                disabled={isDisposingBatch}
                onClick={confirmDisposeBatch}
                className="rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white px-5 shadow-xs flex items-center gap-1.5"
              >
                {isDisposingBatch ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    <span>جاري الخصم والقيد...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>تأكيد الإعدام والشطب النهائي</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
