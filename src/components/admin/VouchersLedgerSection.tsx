import React, { useState, useEffect, useMemo } from "react";
import {
  erpStore,
  Voucher,
  Account,
  Treasury,
  Supplier,
  VoucherPurchaseItem,
  isLevel4Account,
} from "../../shared/services/erpStore";
import { localWarehouseStore } from "../../features/inventory/services/warehouseStore";
import { inventoryService } from "../../features/inventory/services/inventoryService";
import { InventoryItem } from "../../shared/types";
import {
  Receipt,
  Plus,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Wallet,
  Building2,
  FileText,
  Trash2,
  Printer,
  Filter,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  RotateCcw,
  BookOpen,
  Tag,
  Landmark,
  Edit3,
  History,
  Package,
  Truck,
  UserPlus,
  PackagePlus,
  ShoppingBag,
  Sparkles,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";
import { printAccountingDocument } from "../../shared/utils/printAccountingDocument";
import { ViewModeToggle, useViewMode } from "../ui/view-mode-toggle";

function printProfessionalReport(opts: {
  title: string;
  subtitle?: string;
  summaryCards?: Array<{ label: string; value: string }>;
  columns: string[];
  rows: string[][];
}) {
  const cols = opts.columns.map((label, idx) => ({
    key: `col_${idx}`,
    label,
    align: "right" as const,
  }));
  const mappedRows = opts.rows.map((r) => {
    const rec: Record<string, string> = {};
    r.forEach((cell, idx) => {
      rec[`col_${idx}`] = String(cell ?? "");
    });
    return rec;
  });
  printAccountingDocument({
    title: opts.title,
    subtitle: opts.subtitle,
    columns: cols,
    rows: mappedRows,
    metaItems: opts.summaryCards,
  });
}

export type VoucherDepartmentKey = "mall" | "park" | "restaurant" | "admin";

interface DepartmentPreset {
  key: VoucherDepartmentKey;
  label: string;
  costCenter: string;
  badgeClass: string;
  defaultPaymentCategories: Array<{ name: string; account_code: string }>;
  defaultReceiptCategories: Array<{ name: string; account_code: string }>;
}

const DEPARTMENT_PRESETS: Record<VoucherDepartmentKey, DepartmentPreset> = {
  restaurant: {
    key: "restaurant",
    label: "المطعم",
    costCenter: "المطعم (Restaurant)",
    badgeClass: "bg-orange-50 text-orange-700 border-orange-200",
    defaultPaymentCategories: [
      { name: "شراء خامات ومواد", account_code: "31010100" },
      { name: "رواتب وأجور الموظفين", account_code: "31010110" },
      { name: "كهرباء ومياه وطاقة", account_code: "31010145" },
      { name: "صيانة وتشغيل ومعدات", account_code: "31010170" },
      { name: "ضيافة ونظافة", account_code: "31010160" },
      { name: "دعاية، إعلانات وتسويق", account_code: "31020310" },
      { name: "مصروفات نثرية وإدارية", account_code: "31010160" },
    ],
    defaultReceiptCategories: [
      { name: "إيراد مبيعات المطعم", account_code: "43010000" },
      { name: "إيرادات تشغيل بوفيهات وحفلات خارجية", account_code: "43020300" },
      { name: "إيرادات تدوير ومبيعات فرعية", account_code: "43020200" },
      { name: "تسوية عهد وأمانات", account_code: "41010110" },
    ],
  },
  mall: {
    key: "mall",
    label: "المول التجاري",
    costCenter: "المول التجاري (Mall)",
    badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
    defaultPaymentCategories: [
      { name: "صيانة وتشغيل ومعدات", account_code: "31010170" },
      { name: "كهرباء ومياه وطاقة", account_code: "31010145" },
      { name: "رواتب وأجور الموظفين", account_code: "31010110" },
      { name: "ضيافة ونظافة", account_code: "31010160" },
      { name: "إيجار العقارات والفروع", account_code: "31010140" },
      { name: "مصروفات نثرية وإدارية", account_code: "31010160" },
    ],
    defaultReceiptCategories: [
      { name: "إيراد إيجارات المول", account_code: "43010100" },
      { name: "تسوية عهد وأمانات", account_code: "41010110" },
      { name: "إيرادات استثمارية وتمويلية", account_code: "41010100" },
    ],
  },
  park: {
    key: "park",
    label: "الحديقة والملاهي",
    costCenter: "الحديقة والملاهي (Garden & Park)",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    defaultPaymentCategories: [
      { name: "صيانة وتشغيل ومعدات", account_code: "31010170" },
      { name: "كهرباء ومياه وطاقة", account_code: "31010145" },
      { name: "رواتب وأجور الموظفين", account_code: "31010110" },
      { name: "ضيافة ونظافة", account_code: "31010160" },
      { name: "دعاية، إعلانات وتسويق", account_code: "31020310" },
      { name: "مصروفات نثرية وإدارية", account_code: "31010160" },
    ],
    defaultReceiptCategories: [
      { name: "إيراد تذاكر وألعاب الحديقة", account_code: "43020100" },
      { name: "إيرادات تشغيل بوفيهات وحفلات خارجية", account_code: "43020300" },
      { name: "تسوية عهد وأمانات", account_code: "41010110" },
    ],
  },
  admin: {
    key: "admin",
    label: "الإدارة العامة",
    costCenter: "الإدارة (Administration)",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    defaultPaymentCategories: [
      { name: "رواتب وأجور الموظفين", account_code: "31010110" },
      { name: "إيجار العقارات والفروع", account_code: "31010140" },
      { name: "كهرباء ومياه وطاقة", account_code: "31010145" },
      { name: "دعاية، إعلانات وتسويق", account_code: "31020310" },
      { name: "صيانة وتشغيل ومعدات", account_code: "31010170" },
      { name: "مصروفات نثرية وإدارية", account_code: "31010160" },
    ],
    defaultReceiptCategories: [
      { name: "حقوق ملكية ورأسمال مضاف", account_code: "41020100" },
      { name: "إيرادات استثمارية وتمويلية", account_code: "41010100" },
      { name: "تسوية عهد وأمانات", account_code: "41010110" },
    ],
  },
};

const isGoodsPurchaseCategory = (cat: string) => {
  const normalized = String(cat || "").trim();
  return (
    normalized === "شراء خامات ومواد" ||
    normalized === "شراء بضاعة" ||
    normalized === "شراء بضاعة / خامات ومواد" ||
    normalized.includes("شراء خامات") ||
    normalized.includes("شراء بضاعة")
  );
};

interface VouchersLedgerSectionProps {
  initialDepartmentFilter?: "all" | VoucherDepartmentKey;
  autoOpenNewModal?: boolean;
  onModalClosed?: () => void;
  onNavigateToJournal?: (ref?: string) => void;
  mode?: "operations" | "reports" | "full";
  onOpenReports?: () => void;
}

export function VouchersLedgerSection({
  initialDepartmentFilter = "all",
  autoOpenNewModal = false,
  onModalClosed,
  onNavigateToJournal,
  mode = "full",
  onOpenReports,
}: VouchersLedgerSectionProps = {}) {
  const [viewMode, setViewMode] = useViewMode("vouchers_ledger", "list");
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [treasuries, setTreasuries] = useState<Treasury[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({
    USD: 1,
    SSP: 1500,
    EGP: 50,
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "receipt" | "payment">("all");
  const [departmentFilter, setDepartmentFilter] = useState<"all" | VoucherDepartmentKey>(
    initialDepartmentFilter,
  );
  const [treasuryFilter, setTreasuryFilter] = useState<string>("all");
  const [currencyFilter, setCurrencyFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [showDeleted, setShowDeleted] = useState<boolean>(false);

  // Unified Document Modal State (Create & Edit)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [formType, setFormType] = useState<"receipt" | "payment">("payment");
  const [formDepartment, setFormDepartment] = useState<VoucherDepartmentKey>("restaurant");
  const [formCategory, setFormCategory] = useState("شراء خامات ومواد");
  const [formAccountCode, setFormAccountCode] = useState("31010100");
  const [formAmount, setFormAmount] = useState("");
  const [formCurrency, setFormCurrency] = useState("EGP");
  const [formExchangeRate, setFormExchangeRate] = useState("50");
  const [formTreasuryId, setFormTreasuryId] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formBeneficiary, setFormBeneficiary] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formAttachment, setFormAttachment] = useState("");

  // Inline New Category Creator & Search
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryAccountCode, setNewCategoryAccountCode] = useState("");

  // Restaurant Purchase & Inventory State
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");

  const [purchaseItems, setPurchaseItems] = useState<VoucherPurchaseItem[]>([]);
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  const [selectedInventoryIdToAdd, setSelectedInventoryIdToAdd] = useState("");
  const [isAddingInventoryItem, setIsAddingInventoryItem] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("كجم");
  const [newItemCost, setNewItemCost] = useState("");
  const [newItemMinQty, setNewItemMinQty] = useState("5");

  // View / Revert / Delete / Audit Modals
  const [selectedVoucherForJournal, setSelectedVoucherForJournal] = useState<Voucher | null>(null);
  const [selectedVoucherForAudit, setSelectedVoucherForAudit] = useState<Voucher | null>(null);
  const [voucherToRevert, setVoucherToRevert] = useState<Voucher | null>(null);
  const [revertReason, setRevertReason] = useState("");
  const [voucherToDelete, setVoucherToDelete] = useState<Voucher | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  const loadData = () => {
    const state = erpStore.getState();
    setVouchers([...(state.vouchers || [])]);
    const activeTreasuries = (state.treasuries || []).filter((t) => !t.deleted);
    setTreasuries(activeTreasuries);
    setAccounts([...(state.accounts || [])]);
    setSuppliers([...(state.suppliers || [])]);
    setJournalEntries([...(state.journalEntries || [])]);
    setInventoryItems([...(localWarehouseStore.getInventory() || [])]);

    const rates = {
      USD: 1,
      SSP: erpStore.getExchangeRate("SSP") || 1500,
      EGP: erpStore.getExchangeRate("EGP") || 50,
    };
    setExchangeRates(rates);

    if (!formTreasuryId && activeTreasuries.length > 0) {
      const defTr = activeTreasuries[0];
      setFormTreasuryId(defTr.id);
      const curr = defTr.currency === "MULTI" ? "EGP" : defTr.currency || "EGP";
      setFormCurrency(curr);
      setFormExchangeRate(String(rates[curr as keyof typeof rates] || 1));
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = erpStore.subscribe(loadData);
    const handleInvUpdate = () => {
      setInventoryItems([...(localWarehouseStore.getInventory() || [])]);
    };
    window.addEventListener("inventory_updated", handleInvUpdate);
    return () => {
      unsubscribe();
      window.removeEventListener("inventory_updated", handleInvUpdate);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const deptParam = params.get("dept");
      if (
        deptParam === "mall" ||
        deptParam === "park" ||
        deptParam === "restaurant" ||
        deptParam === "admin"
      ) {
        setDepartmentFilter(deptParam);
        return;
      }
    }
    if (initialDepartmentFilter) {
      setDepartmentFilter(initialDepartmentFilter);
    }
  }, [initialDepartmentFilter]);

  const level4Accounts = useMemo(
    () => accounts.filter((a) => isLevel4Account(a) && a.status !== "inactive"),
    [accounts],
  );

  // Categories available for the active (formType, formDepartment)
  const availableCategories = useMemo(() => {
    const preset = DEPARTMENT_PRESETS[formDepartment] || DEPARTMENT_PRESETS.admin;
    const baseList =
      formType === "payment"
        ? preset.defaultPaymentCategories
        : preset.defaultReceiptCategories;
    const customList = erpStore.getCustomVoucherCategories(formType, formDepartment);

    const mergedMap = new Map<string, { name: string; account_code: string; isCustom?: boolean }>();
    baseList.forEach((c) => mergedMap.set(c.name, { ...c }));
    customList.forEach((c: any) =>
      mergedMap.set(c.name, { name: c.name, account_code: c.account_code, isCustom: true }),
    );
    return Array.from(mergedMap.values());
  }, [formType, formDepartment, vouchers, accounts]);

  // Is this a Restaurant Purchase of Goods workflow?
  const isRestaurantPurchaseMode = useMemo(() => {
    return (
      formDepartment === "restaurant" &&
      formType === "payment" &&
      isGoodsPurchaseCategory(formCategory)
    );
  }, [formDepartment, formType, formCategory]);

  // Auto-calculate purchase items total & sync to formAmount when in Restaurant Purchase Mode
  const purchaseInvoiceTotal = useMemo(() => {
    return purchaseItems.reduce(
      (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
      0,
    );
  }, [purchaseItems]);

  useEffect(() => {
    if (isRestaurantPurchaseMode && purchaseItems.length > 0) {
      setFormAmount(String(Number(purchaseInvoiceTotal.toFixed(2))));
    }
  }, [isRestaurantPurchaseMode, purchaseInvoiceTotal, purchaseItems.length]);

  const resolveDefaultTreasuryForDepartment = (dept: VoucherDepartmentKey): Treasury | undefined => {
    if (treasuries.length === 0) return undefined;
    if (dept === "restaurant") {
      return (
        treasuries.find((t) => t.linked_to_restaurant || t.id === "tr-1" || t.name_ar.includes("مطعم")) ||
        treasuries[0]
      );
    }
    if (dept === "mall") {
      return (
        treasuries.find((t) => t.name_ar.includes("مول") || t.id === "tr-5") || treasuries[0]
      );
    }
    if (dept === "park") {
      return (
        treasuries.find((t) => t.name_ar.includes("حديقة") || t.name_ar.includes("ملاهي")) ||
        treasuries[0]
      );
    }
    return treasuries[0];
  };

  const handleOpenCreateModal = (
    defaultType: "receipt" | "payment" = "payment",
    defaultDept: VoucherDepartmentKey = departmentFilter !== "all" ? departmentFilter : "restaurant",
  ) => {
    setEditingVoucher(null);
    setFormType(defaultType);
    setFormDepartment(defaultDept);

    const preset = DEPARTMENT_PRESETS[defaultDept] || DEPARTMENT_PRESETS.restaurant;
    const cats =
      defaultType === "payment"
        ? preset.defaultPaymentCategories
        : preset.defaultReceiptCategories;
    const firstCat = cats[0] || {
      name: defaultType === "payment" ? "مصروفات نثرية وإدارية" : "تسوية عهد وأمانات",
      account_code: defaultType === "payment" ? "31010160" : "41010110",
    };

    setFormCategory(firstCat.name);
    setFormAccountCode(firstCat.account_code);
    setFormAmount("");
    setFormDescription("");
    setFormBeneficiary("");
    setFormNotes("");
    setFormAttachment("");

    const defTr = resolveDefaultTreasuryForDepartment(defaultDept);
    if (defTr) {
      setFormTreasuryId(defTr.id);
      const curr = defTr.currency === "MULTI" ? "EGP" : defTr.currency || "EGP";
      setFormCurrency(curr);
      setFormExchangeRate(String(exchangeRates[curr] || 1));
    }

    setSelectedSupplierId("");
    setIsAddingSupplier(false);
    setPurchaseItems([]);
    setIsAddingInventoryItem(false);
    setIsAddingCategory(false);
    setIsAddModalOpen(true);
  };

  useEffect(() => {
    if (autoOpenNewModal) {
      handleOpenCreateModal("payment");
      onModalClosed?.();
    }
  }, [autoOpenNewModal]);

  const handleOpenEditModal = (v: Voucher) => {
    setEditingVoucher(v);
    const vType = v.type === "receipt" ? "receipt" : "payment";
    const vDept: VoucherDepartmentKey =
      v.department ||
      (v.cost_center?.includes("المول")
        ? "mall"
        : v.cost_center?.includes("الحديقة")
          ? "park"
          : v.cost_center?.includes("المطعم")
            ? "restaurant"
            : "admin");

    setFormType(vType);
    setFormDepartment(vDept);
    setFormCategory(v.category);
    setFormAccountCode(
      v.account_code || (vType === "payment" ? "31010110" : "41020100"),
    );
    setFormAmount(String(v.amount || ""));
    setFormCurrency(v.currency || "EGP");
    setFormExchangeRate(String(v.exchange_rate || exchangeRates[v.currency] || 1));
    setFormTreasuryId(v.treasury_id || treasuries[0]?.id || "");
    setFormDescription(v.description || "");
    setFormBeneficiary(v.beneficiary || v.supplier_name || "");
    setFormNotes(v.notes || "");
    setFormAttachment(v.attachment || "");
    setSelectedSupplierId(v.supplier_id || "");
    setPurchaseItems(
      Array.isArray(v.purchase_items)
        ? v.purchase_items.map((it) => ({ ...it }))
        : [],
    );
    setIsAddingCategory(false);
    setIsAddingSupplier(false);
    setIsAddingInventoryItem(false);
    setIsAddModalOpen(true);
  };

  const handleTypeChange = (newType: "receipt" | "payment") => {
    setFormType(newType);
    const preset = DEPARTMENT_PRESETS[formDepartment] || DEPARTMENT_PRESETS.admin;
    const cats =
      newType === "payment" ? preset.defaultPaymentCategories : preset.defaultReceiptCategories;
    if (cats.length > 0) {
      setFormCategory(cats[0].name);
      setFormAccountCode(cats[0].account_code);
    }
  };

  const handleDepartmentChange = (newDept: VoucherDepartmentKey) => {
    setFormDepartment(newDept);
    const preset = DEPARTMENT_PRESETS[newDept] || DEPARTMENT_PRESETS.admin;
    const cats =
      formType === "payment" ? preset.defaultPaymentCategories : preset.defaultReceiptCategories;
    if (cats.length > 0) {
      setFormCategory(cats[0].name);
      setFormAccountCode(cats[0].account_code);
    }
    if (!editingVoucher) {
      const defTr = resolveDefaultTreasuryForDepartment(newDept);
      if (defTr) {
        setFormTreasuryId(defTr.id);
        const curr = defTr.currency === "MULTI" ? "EGP" : defTr.currency || "EGP";
        setFormCurrency(curr);
        setFormExchangeRate(String(exchangeRates[curr] || 1));
      }
    }
  };

  const handleCategoryChange = (catName: string) => {
    setFormCategory(catName);
    const matched = availableCategories.find((c) => c.name === catName);
    if (matched?.account_code) {
      setFormAccountCode(matched.account_code);
    }
  };

  const handleTreasuryChange = (trId: string) => {
    setFormTreasuryId(trId);
    const tr = treasuries.find((t) => t.id === trId);
    if (tr && tr.currency && tr.currency !== "MULTI") {
      setFormCurrency(tr.currency);
      setFormExchangeRate(String(exchangeRates[tr.currency] || 1));
    }
  };

  const handleCurrencyChange = (curr: string) => {
    setFormCurrency(curr);
    setFormExchangeRate(String(exchangeRates[curr] || 1));
  };

  // Inline Category Creation
  const handleCreateCustomCategory = () => {
    const cleanName = newCategoryName.trim();
    if (!cleanName) {
      toast.error("يرجى كتابة اسم البند الجديد");
      return;
    }
    const targetAcc =
      newCategoryAccountCode ||
      formAccountCode ||
      (formType === "payment" ? "31010160" : "41020100");
    try {
      const created = erpStore.addCustomVoucherCategory({
        type: formType,
        department: formDepartment,
        name: cleanName,
        account_code: targetAcc,
      });
      setFormCategory(created.name);
      setFormAccountCode(created.account_code);
      setNewCategoryName("");
      setIsAddingCategory(false);
      loadData();
      toast.success(`تمت إضافة البند "${created.name}" وربطه بالحساب #${created.account_code}`);
    } catch (err: any) {
      toast.error(err?.message || "تعذر إضافة البند");
    }
  };

  // Inline Supplier Creation (auto-assigns Level 4 account under 24010)
  const handleCreateInlineSupplier = () => {
    const cleanName = newSupplierName.trim();
    if (!cleanName) {
      toast.error("يرجى إدخال اسم المورد الجديد");
      return;
    }
    try {
      const result = erpStore.addSupplier(
        cleanName,
        newSupplierPhone.trim() || "—",
        0,
        undefined,
        formCurrency || "EGP",
      );
      loadData();
      setSelectedSupplierId(result.supplier.id);
      setFormBeneficiary(result.supplier.name_ar);
      setNewSupplierName("");
      setNewSupplierPhone("");
      setIsAddingSupplier(false);
      toast.success(
        `تم تسجيل المورد "${result.supplier.name_ar}" وإنشاء حسابه المحاسبي الفرعي (المستوى 4) رقم #${result.account_code}`,
      );
    } catch (err: any) {
      toast.error(err?.message || "تعذر إنشاء المورد الجديد");
    }
  };

  // Add Existing Inventory Item to Purchase Invoice
  const handleAddInventoryItemLine = (invId: string) => {
    if (!invId) return;
    const item = inventoryItems.find((i) => i.id === invId);
    if (!item) return;

    const existingIdx = purchaseItems.findIndex((p) => p.inventory_id === item.id);
    if (existingIdx !== -1) {
      const next = [...purchaseItems];
      next[existingIdx].quantity += 1;
      next[existingIdx].total = Number(
        (next[existingIdx].quantity * next[existingIdx].unit_price).toFixed(2),
      );
      setPurchaseItems(next);
    } else {
      const defaultPrice = Number(item.cost || 0);
      setPurchaseItems((prev) => [
        ...prev,
        {
          inventory_id: item.id,
          name_ar: item.name_ar,
          unit: item.unit || "كجم",
          quantity: 1,
          unit_price: defaultPrice,
          total: defaultPrice,
        },
      ]);
    }
    setSelectedInventoryIdToAdd("");
  };

  // Inline Create New Inventory Item & Add to Invoice
  const handleCreateInlineInventoryItem = async () => {
    const cleanName = newItemName.trim();
    if (!cleanName) {
      toast.error("يرجى إدخال اسم الصنف المخزني الجديد");
      return;
    }
    const unitCost = Number(newItemCost) || 0;
    const minQty = Number(newItemMinQty) || 5;

    try {
      const created = localWarehouseStore.upsertInventoryItem(
        {
          name_ar: cleanName,
          unit: newItemUnit || "كجم",
          quantity: 0,
          min_level: minQty,
          cost: unitCost,
        },
        undefined,
        "wh-main-default",
      );
      // Sync in background with Supabase inventory service if available
      inventoryService
        .upsertInventoryItem(
          {
            name_ar: cleanName,
            unit: newItemUnit || "كجم",
            quantity: 0,
            min_level: minQty,
            cost: unitCost,
          },
          created.id,
          "wh-main-default",
        )
        .catch(() => {});

      setInventoryItems([...localWarehouseStore.getInventory()]);
      setPurchaseItems((prev) => [
        ...prev,
        {
          inventory_id: created.id,
          name_ar: created.name_ar,
          unit: created.unit,
          quantity: 1,
          unit_price: unitCost,
          total: unitCost,
        },
      ]);
      setNewItemName("");
      setNewItemCost("");
      setIsAddingInventoryItem(false);
      toast.success(`تم تعريف الصنف "${created.name_ar}" في مخزون المطعم وإضافته للفاتورة`);
    } catch (err: any) {
      toast.error(err?.message || "تعذر إنشاء الصنف المخزني");
    }
  };

  const handleUpdatePurchaseItemRow = (
    idx: number,
    field: "quantity" | "unit_price",
    val: string,
  ) => {
    const num = Math.max(0, Number(val) || 0);
    setPurchaseItems((prev) => {
      const copy = [...prev];
      const row = { ...copy[idx], [field]: num };
      row.total = Number((Number(row.quantity) * Number(row.unit_price)).toFixed(2));
      copy[idx] = row;
      return copy;
    });
  };

  const handleRemovePurchaseItemRow = (idx: number) => {
    setPurchaseItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Filtered Vouchers
  const filteredVouchers = useMemo(() => {
    return vouchers.filter((v) => {
      if (!showDeleted && v.deleted) return false;
      if (typeFilter !== "all" && v.type !== typeFilter) return false;

      if (departmentFilter !== "all") {
        const vDept: VoucherDepartmentKey =
          v.department ||
          (v.cost_center?.includes("المول")
            ? "mall"
            : v.cost_center?.includes("الحديقة")
              ? "park"
              : v.cost_center?.includes("المطعم")
                ? "restaurant"
                : "admin");
        if (vDept !== departmentFilter) return false;
      }

      if (treasuryFilter !== "all" && v.treasury_id !== treasuryFilter) return false;
      if (currencyFilter !== "all" && v.currency !== currencyFilter) return false;

      if (dateFrom) {
        const vDate = v.created_at.split("T")[0];
        if (vDate < dateFrom) return false;
      }
      if (dateTo) {
        const vDate = v.created_at.split("T")[0];
        if (vDate > dateTo) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDesc = v.description?.toLowerCase().includes(q);
        const matchCat = v.category?.toLowerCase().includes(q);
        const matchId = v.id?.toLowerCase().includes(q);
        const matchRef = v.reference_number?.toLowerCase().includes(q);
        const matchJe = v.journal_reference?.toLowerCase().includes(q);
        const matchSup = v.supplier_name?.toLowerCase().includes(q);
        const matchBen = v.beneficiary?.toLowerCase().includes(q);
        return (
          matchDesc || matchCat || matchId || matchRef || matchJe || matchSup || matchBen
        );
      }

      return true;
    });
  }, [
    vouchers,
    showDeleted,
    typeFilter,
    departmentFilter,
    treasuryFilter,
    currencyFilter,
    dateFrom,
    dateTo,
    searchQuery,
  ]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const active = filteredVouchers.filter((v) => !v.deleted && !v.reverted);
    const receiptsByCurr: Record<string, number> = {};
    const paymentsByCurr: Record<string, number> = {};
    let totalBaseReceiptsUSD = 0;
    let totalBasePaymentsUSD = 0;

    active.forEach((v) => {
      const curr = v.currency || "USD";
      const rate = v.exchange_rate || exchangeRates[curr] || 1;
      const baseAmt = curr === "USD" ? v.amount : v.amount / rate;

      if (v.type === "receipt") {
        receiptsByCurr[curr] = (receiptsByCurr[curr] || 0) + v.amount;
        totalBaseReceiptsUSD += baseAmt;
      } else if (v.type === "payment") {
        paymentsByCurr[curr] = (paymentsByCurr[curr] || 0) + v.amount;
        totalBasePaymentsUSD += baseAmt;
      }
    });

    return {
      totalCount: active.length,
      receiptsCount: active.filter((v) => v.type === "receipt").length,
      paymentsCount: active.filter((v) => v.type === "payment").length,
      revertedCount: filteredVouchers.filter((v) => v.reverted).length,
      receiptsByCurr,
      paymentsByCurr,
      totalBaseReceiptsUSD,
      totalBasePaymentsUSD,
      netBaseUSD: totalBaseReceiptsUSD - totalBasePaymentsUSD,
    };
  }, [filteredVouchers, exchangeRates]);

  // Save Document (Create or Update)
  const handleSaveDocument = (shouldPrintAfterSave = false) => {
    const computedAmt = isRestaurantPurchaseMode
      ? Number(purchaseInvoiceTotal.toFixed(2))
      : Number(formAmount);

    if (!computedAmt || computedAmt <= 0) {
      toast.error(
        isRestaurantPurchaseMode
          ? "يرجى إضافة صنف واحد على الأقل بكمية وسعر أكبر من الصفر"
          : "يرجى إدخال مبلغ صحيح أكبر من الصفر",
      );
      return;
    }
    if (!formTreasuryId) {
      toast.error("يرجى اختيار الخزينة أو الحساب البنكي");
      return;
    }
    if (!formCategory.trim()) {
      toast.error("يرجى اختيار بند المصروف أو الإيراد");
      return;
    }
    if (isRestaurantPurchaseMode && !selectedSupplierId) {
      toast.error("يرجى اختيار المورد أو إنشاء مورد جديد لفاتورة شراء البضاعة");
      return;
    }
    if (isRestaurantPurchaseMode && purchaseItems.length === 0) {
      toast.error("يرجى إضافة الأصناف المشتراة إلى فاتورة الشراء");
      return;
    }

    const selectedAccount = accounts.find((a) => a.code === formAccountCode);
    if (!isLevel4Account(selectedAccount)) {
      toast.error("يجب اختيار حساب محاسبي تشغيلي من المستوى الرابع (Level 4)");
      return;
    }

    const supplierObj = selectedSupplierId
      ? suppliers.find((s) => s.id === selectedSupplierId)
      : undefined;

    const autoDescription =
      formDescription.trim() ||
      (isRestaurantPurchaseMode
        ? `فاتورة شراء خامات ومواد للمطعم من المورد (${supplierObj?.name_ar || ""}) بعدد ${purchaseItems.length} أصناف`
        : `${formType === "receipt" ? "سند قبض" : "سند صرف"} - ${formCategory} (${DEPARTMENT_PRESETS[formDepartment].label})`);

    const presetCostCenter = DEPARTMENT_PRESETS[formDepartment].costCenter;
    const rateNum = Number(formExchangeRate) || exchangeRates[formCurrency] || 1;

    try {
      if (editingVoucher) {
        const updated = erpStore.updateVoucher(editingVoucher.id, {
          type: formType,
          department: formDepartment,
          category: formCategory.trim(),
          amount: computedAmt,
          currency: formCurrency,
          exchange_rate: rateNum,
          treasury_id: formTreasuryId,
          account_code: formAccountCode,
          description: autoDescription,
          cost_center: presetCostCenter,
          beneficiary: formBeneficiary.trim() || supplierObj?.name_ar || undefined,
          notes: formNotes.trim() || undefined,
          attachment: formAttachment.trim() || undefined,
          supplier_id: isRestaurantPurchaseMode ? selectedSupplierId : undefined,
          supplier_name: isRestaurantPurchaseMode ? supplierObj?.name_ar : undefined,
          supplier_account_code: isRestaurantPurchaseMode
            ? supplierObj?.account_code
            : undefined,
          purchase_items: isRestaurantPurchaseMode ? purchaseItems : [],
        });

        toast.success(
          `تم تحديث السند #${updated.reference_number || updated.id.substring(4, 9)} وتحديث القيد المحاسبي والمخزون بنجاح`,
        );
        setIsAddModalOpen(false);
        setEditingVoucher(null);
        loadData();
        if (shouldPrintAfterSave) {
          handlePrintSingleVoucher(updated);
        }
      } else {
        const created = erpStore.createVoucher(
          formType,
          formCategory.trim(),
          computedAmt,
          formTreasuryId,
          autoDescription,
          presetCostCenter,
          formAttachment.trim() || undefined,
          formCurrency,
          rateNum,
          formAccountCode,
          {
            department: formDepartment,
            beneficiary: formBeneficiary.trim() || supplierObj?.name_ar || undefined,
            notes: formNotes.trim() || undefined,
            supplier_id: isRestaurantPurchaseMode ? selectedSupplierId : undefined,
            supplier_name: isRestaurantPurchaseMode ? supplierObj?.name_ar : undefined,
            supplier_account_code: isRestaurantPurchaseMode
              ? supplierObj?.account_code
              : undefined,
            purchase_items: isRestaurantPurchaseMode ? purchaseItems : undefined,
          },
        );

        toast.success(
          `تم إصدار ${formType === "receipt" ? "سند القبض" : "سند الصرف"} #${created.reference_number} وترحيل القيد #${created.journal_reference || ""}`,
        );
        setIsAddModalOpen(false);
        loadData();
        if (shouldPrintAfterSave) {
          handlePrintSingleVoucher(created);
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "حدث خطأ أثناء حفظ السند المالي");
    }
  };

  const handleConfirmRevert = () => {
    if (!voucherToRevert) return;
    if (!revertReason.trim()) {
      toast.error("يرجى كتابة سبب إرجاع / عكس السند المالي للتوثيق");
      return;
    }
    try {
      const res = erpStore.revertVoucher(voucherToRevert.id, revertReason.trim());
      toast.success(
        `تم عكس السند بنجاح وتوليد قيد عكسي رقم #${res.reversalEntry?.reference || "REV"}`,
      );
      setVoucherToRevert(null);
      setRevertReason("");
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "تعذر إرجاع السند");
    }
  };

  const handleConfirmDelete = () => {
    if (!voucherToDelete) return;
    if (!deleteReason.trim()) {
      toast.error("يرجى كتابة سبب حذف السند للتوثيق في سجل المراجعة");
      return;
    }
    const ok = erpStore.deleteVoucher(voucherToDelete.id, deleteReason.trim());
    if (ok) {
      toast.success("تم حذف السند وعكس أثره المالي والمحاسبي والمخزني بالكامل");
      setVoucherToDelete(null);
      setDeleteReason("");
      loadData();
    }
  };

  const getLinkedJournalEntry = (v: Voucher) => {
    return journalEntries.find(
      (je) =>
        je.id === v.journal_entry_id ||
        (v.journal_reference && je.reference === v.journal_reference) ||
        je.reference?.endsWith(v.id.substring(4, 9).toUpperCase()),
    );
  };

  const getAccountName = (code?: string) => {
    if (!code) return "غير محدد";
    const found = accounts.find((a) => a.code === code);
    return found ? `${found.name_ar} (${found.code})` : `حساب #${code}`;
  };

  const getTreasuryName = (id: string) => {
    const found = treasuries.find((t) => t.id === id);
    return found ? found.name_ar : id;
  };

  const getVoucherDepartmentPreset = (v: Voucher): DepartmentPreset => {
    const deptKey: VoucherDepartmentKey =
      v.department ||
      (v.cost_center?.includes("المول")
        ? "mall"
        : v.cost_center?.includes("الحديقة")
          ? "park"
          : v.cost_center?.includes("المطعم")
            ? "restaurant"
            : "admin");
    return DEPARTMENT_PRESETS[deptKey] || DEPARTMENT_PRESETS.admin;
  };

  const handlePrintSingleVoucher = (v: Voucher) => {
    const linkedJe = getLinkedJournalEntry(v);
    const deptPreset = getVoucherDepartmentPreset(v);
    const docRef = v.reference_number || v.id.substring(0, 10).toUpperCase();

    const summaryCards = [
      {
        label: "رقم السند المرجعي",
        value: docRef,
      },
      {
        label: "النوع والقسم",
        value: `${v.type === "receipt" ? "سند قبض" : "سند صرف"} - ${deptPreset.label}`,
      },
      {
        label: "المبلغ والعملة",
        value: `${Number(v.amount).toLocaleString()} ${v.currency} (سعر الصرف: ${v.exchange_rate || 1})`,
      },
      {
        label: "الخزينة والحساب",
        value: `${getTreasuryName(v.treasury_id)} | ${getAccountName(v.account_code)}`,
      },
    ];

    if (v.supplier_name || v.beneficiary) {
      summaryCards.push({
        label: v.supplier_name ? "المورد وحسابه المحاسبي" : "المستفيد / الجهة",
        value: v.supplier_name
          ? `${v.supplier_name} ${v.supplier_account_code ? `(حساب #${v.supplier_account_code})` : ""}`
          : String(v.beneficiary || "—"),
      });
    }

    const hasPurchaseItems = Array.isArray(v.purchase_items) && v.purchase_items.length > 0;

    if (hasPurchaseItems) {
      printProfessionalReport({
        title: `فاتورة وسند صرف مشتريات مطعم #${docRef}`,
        subtitle: `التاريخ: ${new Date(v.created_at).toLocaleString("ar-EG")} | القسم: ${deptPreset.label} | المورد: ${v.supplier_name || "—"} (${v.supplier_account_code || "—"})`,
        summaryCards,
        columns: [
          "#",
          "الصنف المخزني",
          "الوحدة",
          "الكمية المشتراة",
          `سعر الوحدة (${v.currency})`,
          `الإجمالي (${v.currency})`,
        ],
        rows: [
          ...v.purchase_items!.map((item, idx) => [
            String(idx + 1),
            item.name_ar,
            item.unit,
            String(item.quantity),
            Number(item.unit_price).toLocaleString(),
            Number(item.total).toLocaleString(),
          ]),
          [
            "—",
            "الإجمالي النهائي للفاتورة والسند",
            "—",
            String(v.purchase_items!.reduce((s, i) => s + Number(i.quantity || 0), 0)),
            "—",
            `${Number(v.amount).toLocaleString()} ${v.currency}`,
          ],
        ],
      });
      return;
    }

    printProfessionalReport({
      title: `${v.type === "receipt" ? "سند قبض نقدية / بنكي" : "سند صرف نقدية / بنكي"} #${docRef}`,
      subtitle: `التاريخ: ${new Date(v.created_at).toLocaleString("ar-EG")} | القسم: ${deptPreset.label} | الحالة: ${v.reverted ? "معكوس / ملغي" : "معتمد ومرحّل"}`,
      summaryCards,
      columns: ["البند / التصنيف", "الحساب المحاسبي", "البيان التفصيلي", "رقم القيد", "المبلغ"],
      rows: [
        [
          v.category,
          getAccountName(v.account_code),
          v.description,
          v.journal_reference || linkedJe?.reference || "—",
          `${Number(v.amount).toLocaleString()} ${v.currency}`,
        ],
      ],
    });
  };

  const handlePrintAllFiltered = () => {
    printProfessionalReport({
      title: "سجل السندات المالية الموحد (سندات القبض والصرف)",
      subtitle: `تاريخ التقرير: ${new Date().toLocaleString("ar-EG")} | إجمالي السندات: ${filteredVouchers.length}`,
      summaryCards: [
        { label: "إجمالي السندات النشطة", value: `${metrics.totalCount} سند` },
        {
          label: "إجمالي المقبوضات (مقوم بـ USD)",
          value: `$${metrics.totalBaseReceiptsUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        },
        {
          label: "إجمالي المدفوعات (مقوم بـ USD)",
          value: `$${metrics.totalBasePaymentsUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        },
        {
          label: "صافي التدفق (مقوم بـ USD)",
          value: `$${metrics.netBaseUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        },
      ],
      columns: [
        "رقم السند",
        "التاريخ",
        "النوع",
        "القسم",
        "البند / المورد",
        "الخزينة",
        "الحساب المحاسبي",
        "المبلغ",
        "العملة",
        "رقم القيد",
        "الحالة",
      ],
      rows: filteredVouchers.map((v) => {
        const dept = getVoucherDepartmentPreset(v);
        return [
          v.reference_number || v.id.substring(4, 10).toUpperCase(),
          new Date(v.created_at).toLocaleDateString("ar-EG"),
          v.type === "receipt" ? "سند قبض" : "سند صرف",
          dept.label,
          v.supplier_name ? `${v.category} (${v.supplier_name})` : v.category,
          getTreasuryName(v.treasury_id),
          getAccountName(v.account_code),
          Number(v.amount).toLocaleString(),
          v.currency,
          v.journal_reference || "—",
          v.deleted ? "محذوف" : v.reverted ? "معكوس" : "معتمد",
        ];
      }),
    });
  };

  return (
    <div className="space-y-4 font-['Tajawal']" dir="rtl">
      {mode === "operations" ? null : (
        <>
          {/* REPORTS / FULL MODE: Vouchers Inspection & Register Header */}
          <div className="bg-card rounded-2xl border border-border p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-foreground">
                  تفقد وسجل سندات الدفع والقبض ({filteredVouchers.length})
                </h2>
                <p className="text-xs text-muted-foreground font-semibold">
                  مراجعة، فلترة، طباعة، وتدقيق كافة سندات القبض والصرف والقيود المرتبطة بها
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ViewModeToggle mode={viewMode} onChange={setViewMode} />
              <button
                type="button"
                onClick={() => handleOpenCreateModal("receipt")}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <ArrowDownLeft className="w-4 h-4" />
                سند قبض جديد
              </button>
              <button
                type="button"
                onClick={() => handleOpenCreateModal("payment")}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <ArrowUpRight className="w-4 h-4" />
                سند صرف جديد
              </button>
              <button
                type="button"
                onClick={handlePrintAllFiltered}
                className="px-3.5 py-2 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                طباعة سجل السندات
              </button>
            </div>
          </div>

          {/* Compact KPI Summary Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-card rounded-xl p-3.5 border border-border shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-muted-foreground">السندات النشطة</p>
                <h3 className="text-xl font-black text-foreground mt-0.5">{metrics.totalCount}</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  قبض: <b className="text-emerald-600">{metrics.receiptsCount}</b> | صرف:{" "}
                  <b className="text-rose-600">{metrics.paymentsCount}</b>
                </p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-muted text-foreground flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-card rounded-xl p-3.5 border border-emerald-200 dark:border-emerald-800/50 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">إجمالي سندات القبض</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.entries(metrics.receiptsByCurr).length === 0 ? (
                    <span className="text-sm font-black text-muted-foreground">0.00</span>
                  ) : (
                    Object.entries(metrics.receiptsByCurr).map(([curr, val]) => (
                      <span
                        key={curr}
                        className="px-2 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 rounded text-xs font-black border border-emerald-500/20"
                      >
                        {val.toLocaleString()} {curr}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-card rounded-xl p-3.5 border border-rose-200 dark:border-rose-800/50 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-rose-700 dark:text-rose-400">إجمالي سندات الصرف</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.entries(metrics.paymentsByCurr).length === 0 ? (
                    <span className="text-sm font-black text-muted-foreground">0.00</span>
                  ) : (
                    Object.entries(metrics.paymentsByCurr).map(([curr, val]) => (
                      <span
                        key={curr}
                        className="px-2 py-0.5 bg-rose-500/10 text-rose-700 dark:text-rose-300 rounded text-xs font-black border border-rose-500/20"
                      >
                        {val.toLocaleString()} {curr}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-card rounded-xl p-3.5 border border-indigo-200 dark:border-indigo-800/50 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400">صافي التدفق (مقوم بالدولار)</p>
                <h3
                  className={`text-xl font-black mt-0.5 font-mono ${
                    metrics.netBaseUSD >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {metrics.netBaseUSD >= 0 ? "+" : ""}$
                  {metrics.netBaseUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </h3>
              </div>
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Department Quick Filter Pills + Search & Filters */}
          <div className="bg-card rounded-2xl border border-border p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: "all", label: "جميع الأقسام" },
                { id: "mall", label: "المول التجاري" },
                { id: "park", label: "الحديقة والملاهي" },
                { id: "restaurant", label: "المطعم والمشتريات" },
                { id: "admin", label: "الإدارة العامة" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDepartmentFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  departmentFilter === tab.id
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              إظهار السندات المحذوفة
            </label>
            {(typeFilter !== "all" ||
              departmentFilter !== "all" ||
              treasuryFilter !== "all" ||
              currencyFilter !== "all" ||
              dateFrom ||
              dateTo ||
              searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setTypeFilter("all");
                  setDepartmentFilter("all");
                  setTreasuryFilter("all");
                  setCurrencyFilter("all");
                  setDateFrom("");
                  setDateTo("");
                  setSearchQuery("");
                }}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 underline cursor-pointer"
              >
                مسح الفلاتر
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-2.5">
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث برقم السند، البيان، البند، المورد، رقم القيد..."
              className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
          >
            <option value="all">كل الأنواع (قبض وصرف)</option>
            <option value="receipt">سندات القبض فقط</option>
            <option value="payment">سندات الصرف فقط</option>
          </select>

          <select
            value={treasuryFilter}
            onChange={(e) => setTreasuryFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
          >
            <option value="all">جميع الخزائن والبنوك</option>
            {treasuries.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name_ar} ({t.currency})
              </option>
            ))}
          </select>

          <select
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
          >
            <option value="all">كل العملات</option>
            <option value="EGP">جنيه مصري (EGP)</option>
            <option value="USD">دولار أمريكي (USD)</option>
            <option value="SSP">جنيه جنوب سوداني (SSP)</option>
          </select>

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-1/2 px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700"
              title="من تاريخ"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-1/2 px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700"
              title="إلى تاريخ"
            />
          </div>
        </div>
      </div>

      {/* Vouchers Display: List (Table) or Grid (Cards) */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredVouchers.length === 0 ? (
            <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 font-bold">
              لا توجد سندات مالية مطابقة لمعايير البحث الحالية
            </div>
          ) : (
            filteredVouchers.map((v) => {
              const isReceipt = v.type === "receipt";
              const dept = getVoucherDepartmentPreset(v);
              const docRef = v.reference_number || `#${v.id.substring(4, 10).toUpperCase()}`;
              const hasPurchaseItems =
                Array.isArray(v.purchase_items) && v.purchase_items.length > 0;

              return (
                <div
                  key={v.id}
                  className={`bg-white rounded-2xl border p-4 shadow-sm flex flex-col justify-between gap-3 transition-all ${
                    v.deleted
                      ? "border-rose-200 bg-rose-50/20 opacity-75"
                      : v.reverted
                        ? "border-amber-200 bg-amber-50/20"
                        : "border-slate-200 hover:border-indigo-200"
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                          {docRef}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[11px] font-black border ${dept.badgeClass}`}
                        >
                          {dept.label}
                        </span>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black ${
                          isReceipt
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {isReceipt ? (
                          <ArrowDownLeft className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        )}
                        {isReceipt ? "سند قبض" : "سند صرف"}
                      </span>
                    </div>

                    <div>
                      <div className="text-sm font-black text-slate-900 flex items-center gap-1.5 flex-wrap">
                        <span>{v.category}</span>
                        {hasPurchaseItems && (
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded text-[10px] font-black">
                            فاتورة مشتريات ({v.purchase_items!.length} أصناف)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">{v.description}</p>
                    </div>

                    {v.supplier_name && (
                      <div className="text-xs font-bold text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 flex items-center justify-between">
                        <span>المورد: {v.supplier_name}</span>
                        {v.supplier_account_code && (
                          <span className="font-mono text-[11px] text-indigo-600">
                            #{v.supplier_account_code}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-slate-400 block">الخزينة:</span>
                        <span className="font-bold text-slate-700">
                          {getTreasuryName(v.treasury_id)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">الحساب المحاسبي:</span>
                        <span className="font-bold text-indigo-700">
                          {getAccountName(v.account_code)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div>
                      <span
                        className={`text-base font-black font-mono ${
                          v.reverted || v.deleted
                            ? "line-through text-slate-400"
                            : isReceipt
                              ? "text-emerald-600"
                              : "text-rose-600"
                        }`}
                      >
                        {isReceipt ? "+" : "-"}
                        {Number(v.amount).toLocaleString()} {v.currency}
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        {new Date(v.created_at).toLocaleDateString("ar-EG")}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSelectedVoucherForJournal(v)}
                        className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors cursor-pointer"
                        title="عرض القيد المحاسبي"
                      >
                        <BookOpen className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePrintSingleVoucher(v)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                        title="طباعة السند"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      {!v.deleted && !v.reverted && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(v)}
                          className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors cursor-pointer"
                          title="تعديل السند"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedVoucherForAudit(v)}
                        className="p-1.5 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-lg transition-colors cursor-pointer"
                        title="سجل التعديلات والمراجعة"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      {!v.deleted && (
                        <button
                          type="button"
                          onClick={() => {
                            setVoucherToDelete(v);
                            setDeleteReason("");
                          }}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors cursor-pointer"
                          title="حذف السند وعكس القيد"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-xs font-black uppercase">
                  <th className="py-3.5 px-4">رقم السند / التاريخ</th>
                  <th className="py-3.5 px-4">النوع والقسم</th>
                  <th className="py-3.5 px-4">البند والبيان</th>
                  <th className="py-3.5 px-4">الخزينة والحساب المحاسبي</th>
                  <th className="py-3.5 px-4">المبلغ والعملة</th>
                  <th className="py-3.5 px-4 text-center">القيد المحاسبي</th>
                  <th className="py-3.5 px-4 text-center">الحالة</th>
                  <th className="py-3.5 px-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">
                      لا توجد سندات مالية مطابقة لمعايير البحث الحالية
                    </td>
                  </tr>
                ) : (
                  filteredVouchers.map((v) => {
                    const isReceipt = v.type === "receipt";
                    const linkedJe = getLinkedJournalEntry(v);
                    const dept = getVoucherDepartmentPreset(v);
                    const docRef =
                      v.reference_number || `#${v.id.substring(4, 10).toUpperCase()}`;
                    const hasPurchaseItems =
                      Array.isArray(v.purchase_items) && v.purchase_items.length > 0;

                    return (
                      <tr
                        key={v.id}
                        className={`hover:bg-slate-50/90 transition-colors ${
                          v.deleted
                            ? "bg-rose-50/30 opacity-65"
                            : v.reverted
                              ? "bg-amber-50/40"
                              : ""
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-black text-slate-800 text-xs">
                            {docRef}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {new Date(v.created_at).toLocaleDateString("ar-EG")}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-col items-start gap-1">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-black border ${
                                isReceipt
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-rose-50 text-rose-700 border-rose-200"
                              }`}
                            >
                              {isReceipt ? (
                                <ArrowDownLeft className="w-3 h-3" />
                              ) : (
                                <ArrowUpRight className="w-3 h-3" />
                              )}
                              {isReceipt ? "سند قبض" : "سند صرف"}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black border ${dept.badgeClass}`}
                            >
                              {dept.label}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="font-black text-slate-900 flex items-center gap-1.5 flex-wrap">
                            <span>{v.category}</span>
                            {hasPurchaseItems && (
                              <span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded text-[10px] font-black">
                                {v.purchase_items!.length} أصناف مخزنية
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5 line-clamp-2">
                            {v.description}
                          </div>
                          {(v.supplier_name || v.beneficiary) && (
                            <div className="text-[11px] font-bold text-indigo-700 mt-1">
                              {v.supplier_name
                                ? `المورد: ${v.supplier_name} ${v.supplier_account_code ? `(#${v.supplier_account_code})` : ""}`
                                : `المستفيد: ${v.beneficiary}`}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                            <Wallet className="w-3.5 h-3.5 text-slate-400" />
                            {getTreasuryName(v.treasury_id)}
                          </div>
                          <div className="text-[11px] text-indigo-600 font-bold flex items-center gap-1 mt-1">
                            <Landmark className="w-3 h-3" />
                            {getAccountName(v.account_code)}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div
                            className={`text-sm font-black font-mono ${
                              v.reverted || v.deleted
                                ? "line-through text-slate-400"
                                : isReceipt
                                  ? "text-emerald-600"
                                  : "text-rose-600"
                            }`}
                          >
                            {isReceipt ? "+" : "-"}
                            {Number(v.amount).toLocaleString()} {v.currency}
                          </div>
                          {v.currency !== "USD" && (
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              الصرف: {v.exchange_rate || exchangeRates[v.currency] || 1}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {linkedJe || v.journal_reference ? (
                            <button
                              type="button"
                              onClick={() => setSelectedVoucherForJournal(v)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-black font-mono transition-colors cursor-pointer"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              {v.journal_reference || linkedJe?.reference || "عرض القيد"}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 font-bold">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {v.deleted ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800">
                              <XCircle className="w-3 h-3" />
                              محذوف
                            </span>
                          ) : v.reverted ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-800">
                              <RotateCcw className="w-3 h-3" />
                              معكوس
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              معتمد
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handlePrintSingleVoucher(v)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                              title="طباعة السند"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            {!v.deleted && !v.reverted && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(v)}
                                className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors cursor-pointer"
                                title="تعديل السند وتحديث القيد"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedVoucherForAudit(v)}
                              className="p-1.5 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-lg transition-colors cursor-pointer"
                              title="سجل التعديلات والمراجعة (Audit History)"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                            {!v.deleted && !v.reverted && (
                              <button
                                type="button"
                                onClick={() => {
                                  setVoucherToRevert(v);
                                  setRevertReason("");
                                }}
                                className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition-colors cursor-pointer"
                                title="عكس السند بقيد عكسي"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {!v.deleted && (
                              <button
                                type="button"
                                onClick={() => {
                                  setVoucherToDelete(v);
                                  setDeleteReason("");
                                }}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors cursor-pointer"
                                title="حذف السند وعكس الأثر المالي"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
        </>
      )}

      {/* UNIFIED FINANCIAL DOCUMENT MODAL (CREATE & EDIT) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-6">
            {/* Modal Header */}
            <div
              className={`px-6 py-4 text-white flex items-center justify-between ${
                formType === "receipt"
                  ? "bg-gradient-to-l from-emerald-700 to-teal-600"
                  : "bg-gradient-to-l from-rose-700 to-red-600"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                  {formType === "receipt" ? (
                    <ArrowDownLeft className="w-5 h-5" />
                  ) : (
                    <ArrowUpRight className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-black">
                    {editingVoucher
                      ? `تعديل مستند مالي #${editingVoucher.reference_number || editingVoucher.id.substring(4, 9)}`
                      : formType === "receipt"
                        ? "إصدار سند قبض مالي جديد"
                        : "إصدار سند صرف / فاتورة مشتريات"}
                  </h3>
                  <p className="text-xs text-white/85">
                    ترحيل فوري للخزينة وتوليد القيد المحاسبي المزدوج دون تكرار
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingVoucher(null);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 flex items-center gap-1.5 text-white text-xs font-black cursor-pointer"
              >
                <span>خروج</span>
                <span>✕</span>
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* STEP 1 & 2: Document Type + Department */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    1. نوع المستند المالي
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleTypeChange("payment")}
                      className={`py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                        formType === "payment"
                          ? "bg-rose-50 border-rose-500 text-rose-700 shadow-sm"
                          : "bg-slate-50 border-slate-200 text-slate-600"
                      }`}
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      سند صرف (مدفوعات / مشتريات)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTypeChange("receipt")}
                      className={`py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                        formType === "receipt"
                          ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm"
                          : "bg-slate-50 border-slate-200 text-slate-600"
                      }`}
                    >
                      <ArrowDownLeft className="w-4 h-4" />
                      سند قبض (مقبوضات / إيرادات)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    2. القسم المرتبط (مركز التكلفة)
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(
                      [
                        { key: "mall", label: "المول", icon: Building2 },
                        { key: "park", label: "الحديقة", icon: Sparkles },
                        { key: "restaurant", label: "المطعم", icon: Utensils },
                        { key: "admin", label: "الإدارة", icon: Landmark },
                      ] as const
                    ).map((dept) => {
                      const Icon = dept.icon;
                      const active = formDepartment === dept.key;
                      return (
                        <button
                          key={dept.key}
                          type="button"
                          onClick={() => handleDepartmentChange(dept.key)}
                          className={`py-2 px-2 rounded-xl font-black text-xs flex items-center justify-center gap-1 border transition-all cursor-pointer ${
                            active
                              ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                              : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {dept.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* STEP 3 & 4: Category Dropdown (with + Add Category) + Accounting Account & Treasury */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-black text-slate-700">
                      3. بند {formType === "payment" ? "المصروف / المشتريات" : "الإيراد"}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingCategory(!isAddingCategory);
                        setNewCategoryAccountCode(formAccountCode);
                      }}
                      className="text-[11px] font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {isAddingCategory ? "إلغاء" : "إضافة بند جديد"}
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={categorySearchQuery}
                        onChange={(e) => setCategorySearchQuery(e.target.value)}
                        placeholder="بحث سريع في البنود..."
                        className="w-full pr-8 pl-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700"
                      />
                    </div>
                    <select
                      value={formCategory}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                    >
                      {availableCategories
                        .filter(
                          (c) =>
                            !categorySearchQuery.trim() ||
                            c.name.toLowerCase().includes(categorySearchQuery.trim().toLowerCase()) ||
                            c.name === formCategory,
                        )
                        .map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  {isAddingCategory && (
                    <div className="mt-2 p-2.5 bg-white rounded-xl border border-indigo-200 space-y-2">
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="اسم البند الجديد..."
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                      />
                      <button
                        type="button"
                        onClick={handleCreateCustomCategory}
                        className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black cursor-pointer"
                      >
                        حفظ واعتماد البند
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    4. الحساب المحاسبي المقابل (المستوى 4)
                  </label>
                  <select
                    value={formAccountCode}
                    onChange={(e) => setFormAccountCode(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                  >
                    {level4Accounts.map((acc) => (
                      <option key={acc.code} value={acc.code}>
                        {acc.code} - {acc.name_ar}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    الخزينة / الحساب البنكي
                  </label>
                  <select
                    value={formTreasuryId}
                    onChange={(e) => handleTreasuryChange(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                  >
                    {treasuries.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name_ar} — الرصيد: {Number(t.balance).toLocaleString()} {t.currency}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* RESTAURANT -> PAYMENT -> PURCHASE OF GOODS WORKFLOW */}
              {isRestaurantPurchaseMode && (
                <div className="bg-orange-50/70 border-2 border-orange-200 rounded-2xl p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-orange-200 pb-3">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="w-5 h-5 text-orange-600" />
                      <div>
                        <h4 className="text-sm font-black text-slate-900">
                          فاتورة مشتريات بضاعة وخامات المطعم (مرتبطة بالمخزون والموردين)
                        </h4>
                        <p className="text-[11px] font-bold text-slate-600">
                          يتم تحديث أرصدة المخزون وحساب المورد والقيود المحاسبية تلقائياً كعملية واحدة
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Supplier Selection & Inline Supplier Creation */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-black text-slate-800 flex items-center gap-1">
                          <Truck className="w-3.5 h-3.5 text-orange-600" />
                          المورد (مرتبط بشجرة الحسابات - المستوى 4)
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsAddingSupplier(!isAddingSupplier)}
                          className="text-[11px] font-black text-orange-700 hover:text-orange-900 flex items-center gap-1 cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          {isAddingSupplier ? "إلغاء" : "+ مورد جديد"}
                        </button>
                      </div>
                      <select
                        value={selectedSupplierId}
                        onChange={(e) => {
                          setSelectedSupplierId(e.target.value);
                          const sup = suppliers.find((s) => s.id === e.target.value);
                          if (sup) setFormBeneficiary(sup.name_ar);
                        }}
                        className="w-full px-3 py-2.5 bg-white border border-orange-300 rounded-xl text-xs font-bold text-slate-900"
                      >
                        <option value="">-- اختر المورد --</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name_ar} {s.account_code ? `(حساب #${s.account_code})` : ""}
                          </option>
                        ))}
                      </select>

                      {isAddingSupplier && (
                        <div className="mt-2 p-3 bg-white rounded-xl border border-orange-300 space-y-2">
                          <div className="text-[11px] font-black text-orange-800">
                            تعريف مورد جديد (يتم توليد رقم حساب مستوى 4 تحت حساب الموردين 24010 تلقائياً)
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={newSupplierName}
                              onChange={(e) => setNewSupplierName(e.target.value)}
                              placeholder="اسم المورد..."
                              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                            />
                            <input
                              type="text"
                              value={newSupplierPhone}
                              onChange={(e) => setNewSupplierPhone(e.target.value)}
                              placeholder="رقم الهاتف..."
                              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleCreateInlineSupplier}
                            className="w-full py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-black cursor-pointer"
                          >
                            حفظ المورد وتوليد الحساب المحاسبي
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Inventory Item Selector & Inline New Item Creator */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-black text-slate-800 flex items-center gap-1">
                          <Package className="w-3.5 h-3.5 text-orange-600" />
                          إضافة أصناف المخزون للفاتورة
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsAddingInventoryItem(!isAddingInventoryItem)}
                          className="text-[11px] font-black text-orange-700 hover:text-orange-900 flex items-center gap-1 cursor-pointer"
                        >
                          <PackagePlus className="w-3.5 h-3.5" />
                          {isAddingInventoryItem ? "إلغاء" : "+ تعريف صنف جديد"}
                        </button>
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={itemSearchQuery}
                          onChange={(e) => setItemSearchQuery(e.target.value)}
                          placeholder="فلترة الأصناف..."
                          className="w-1/3 px-2.5 py-2 bg-white border border-orange-300 rounded-xl text-xs font-bold"
                        />
                        <select
                          value={selectedInventoryIdToAdd}
                          onChange={(e) => handleAddInventoryItemLine(e.target.value)}
                          className="w-2/3 px-3 py-2 bg-white border border-orange-300 rounded-xl text-xs font-bold text-slate-900"
                        >
                          <option value="">-- اختر صنفاً لإضافته للفاتورة --</option>
                          {inventoryItems
                            .filter(
                              (i) =>
                                !itemSearchQuery.trim() ||
                                i.name_ar
                                  .toLowerCase()
                                  .includes(itemSearchQuery.trim().toLowerCase()),
                            )
                            .map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name_ar} ({item.unit}) — الرصيد الحالي: {item.quantity}
                              </option>
                            ))}
                        </select>
                      </div>

                      {isAddingInventoryItem && (
                        <div className="mt-2 p-3 bg-white rounded-xl border border-orange-300 space-y-2">
                          <div className="text-[11px] font-black text-orange-800">
                            تعريف صنف مخزني جديد في مخازن المطعم وإدراجه في الفاتورة
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <input
                              type="text"
                              value={newItemName}
                              onChange={(e) => setNewItemName(e.target.value)}
                              placeholder="اسم الصنف..."
                              className="col-span-2 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                            />
                            <select
                              value={newItemUnit}
                              onChange={(e) => setNewItemUnit(e.target.value)}
                              className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                            >
                              <option value="كجم">كجم</option>
                              <option value="لتر">لتر</option>
                              <option value="قطعة">قطعة</option>
                              <option value="كرتونة">كرتونة</option>
                              <option value="عبوة">عبوة</option>
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={newItemCost}
                              onChange={(e) => setNewItemCost(e.target.value)}
                              placeholder="سعر الشراء للوحدة..."
                              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                            />
                            <input
                              type="number"
                              min="1"
                              value={newItemMinQty}
                              onChange={(e) => setNewItemMinQty(e.target.value)}
                              placeholder="الحد الأدنى للتنبيه..."
                              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleCreateInlineInventoryItem}
                            className="w-full py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-black cursor-pointer"
                          >
                            حفظ الصنف في المخزون وإضافته للفاتورة
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Multi-Item Purchase Invoice Table */}
                  <div className="bg-white rounded-xl border border-orange-200 overflow-hidden">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-orange-100/80 text-orange-950 font-black">
                        <tr>
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">الصنف المخزني</th>
                          <th className="py-2.5 px-3">الوحدة</th>
                          <th className="py-2.5 px-3">الكمية المشتراة</th>
                          <th className="py-2.5 px-3">سعر الوحدة ({formCurrency})</th>
                          <th className="py-2.5 px-3">الإجمالي الفرعي</th>
                          <th className="py-2.5 px-3 text-center">حذف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-orange-100">
                        {purchaseItems.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-6 text-center text-slate-400 font-bold">
                              لم يتم إضافة أصناف بعد — اختر صنفاً من القائمة أعلاه أو عرّف صنفاً جديداً
                            </td>
                          </tr>
                        ) : (
                          purchaseItems.map((row, idx) => (
                            <tr key={`${row.inventory_id}-${idx}`}>
                              <td className="py-2 px-3 font-mono font-bold">{idx + 1}</td>
                              <td className="py-2 px-3 font-black text-slate-900">
                                {row.name_ar}
                              </td>
                              <td className="py-2 px-3 font-bold text-slate-600">{row.unit}</td>
                              <td className="py-2 px-3 w-32">
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={row.quantity}
                                  onChange={(e) =>
                                    handleUpdatePurchaseItemRow(idx, "quantity", e.target.value)
                                  }
                                  className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg font-mono font-black text-center"
                                />
                              </td>
                              <td className="py-2 px-3 w-36">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={row.unit_price}
                                  onChange={(e) =>
                                    handleUpdatePurchaseItemRow(idx, "unit_price", e.target.value)
                                  }
                                  className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg font-mono font-black text-center"
                                />
                              </td>
                              <td className="py-2 px-3 font-mono font-black text-orange-700">
                                {Number(row.total).toLocaleString()} {formCurrency}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemovePurchaseItemRow(idx)}
                                  className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {purchaseItems.length > 0 && (
                        <tfoot className="bg-orange-50 font-black border-t border-orange-200">
                          <tr>
                            <td colSpan={5} className="py-2.5 px-3 text-left text-slate-800">
                              إجمالي فاتورة المشتريات (يرحل تلقائياً لمبلغ السند):
                            </td>
                            <td
                              colSpan={2}
                              className="py-2.5 px-3 font-mono text-base text-orange-800"
                            >
                              {Number(purchaseInvoiceTotal).toLocaleString()} {formCurrency}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              )}

              {/* STEP 5: Currency, Exchange Rate, Amount, Beneficiary & Description */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    5. المبلغ الإجمالي
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      isRestaurantPurchaseMode
                        ? Number(purchaseInvoiceTotal.toFixed(2))
                        : formAmount
                    }
                    readOnly={isRestaurantPurchaseMode && purchaseItems.length > 0}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="0.00"
                    className={`w-full px-3 py-2.5 border rounded-xl text-sm font-black font-mono ${
                      isRestaurantPurchaseMode && purchaseItems.length > 0
                        ? "bg-orange-50 border-orange-300 text-orange-900"
                        : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    العملة
                  </label>
                  <select
                    value={formCurrency}
                    onChange={(e) => handleCurrencyChange(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="EGP">جنيه مصري (EGP)</option>
                    <option value="USD">دولار أمريكي (USD)</option>
                    <option value="SSP">جنيه جنوب سوداني (SSP)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    سعر الصرف (مقابل USD)
                  </label>
                  <input
                    type="number"
                    min="0.0001"
                    step="0.01"
                    value={formExchangeRate}
                    disabled={formCurrency === "USD"}
                    onChange={(e) => setFormExchangeRate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black font-mono disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    المستفيد / الجهة
                  </label>
                  <input
                    type="text"
                    value={formBeneficiary}
                    onChange={(e) => setFormBeneficiary(e.target.value)}
                    placeholder="اسم المستلم أو الدافع..."
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  البيان التفصيلي للسند والقيد المحاسبي
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="اكتب شرحاً واضحاً للعملية المالية ليظهر في دفتر الأستاذ وسند الطباعة..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => handleSaveDocument(true)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  {editingVoucher ? "حفظ التعديلات وطباعة" : "حفظ وترحيل وطباعة السند"}
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveDocument(false)}
                  className={`px-6 py-2.5 text-white rounded-xl font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer ${
                    formType === "receipt"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {editingVoucher ? "حفظ التعديلات وتحديث القيد" : "حفظ واعتماد السند والقيد"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* JOURNAL ENTRY VIEWER MODAL */}
      {selectedVoucherForJournal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-base font-black">
                    تفاصيل القيد المحاسبي للسند #
                    {selectedVoucherForJournal.reference_number ||
                      selectedVoucherForJournal.id.substring(4, 10).toUpperCase()}
                  </h3>
                  <p className="text-xs text-slate-400">
                    رقم القيد: {selectedVoucherForJournal.journal_reference || "قيد تلقائي"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVoucherForJournal(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {(() => {
                const je = getLinkedJournalEntry(selectedVoucherForJournal);
                if (!je) {
                  return (
                    <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-sm font-bold flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      لم يتم العثور على تفاصيل القيد المرتبط في الذاكرة الحالية.
                    </div>
                  );
                }
                return (
                  <>
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-wrap justify-between gap-2 text-xs">
                      <div>
                        <span className="text-slate-500 font-bold">رقم القيد: </span>
                        <span className="font-mono font-black text-indigo-700">{je.reference}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-bold">التاريخ: </span>
                        <span className="font-bold text-slate-800">{je.date}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-bold">العملة: </span>
                        <span className="font-mono font-black text-slate-800">{je.currency}</span>
                      </div>
                    </div>

                    <div className="text-xs font-bold text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
                      {je.description}
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-black">
                          <tr>
                            <th className="py-2.5 px-3">كود واسم الحساب</th>
                            <th className="py-2.5 px-3">مدين (Debit)</th>
                            <th className="py-2.5 px-3">دائن (Credit)</th>
                            <th className="py-2.5 px-3">مركز التكلفة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(je.lines || []).map((line: any, idx: number) => (
                            <tr key={idx}>
                              <td className="py-2.5 px-3 font-bold text-slate-800">
                                {getAccountName(line.account_code)}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-black text-emerald-700">
                                {Number(line.debit || 0) > 0
                                  ? `${Number(line.debit).toLocaleString()} ${line.currency || je.currency}`
                                  : "—"}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-black text-rose-700">
                                {Number(line.credit || 0) > 0
                                  ? `${Number(line.credit).toLocaleString()} ${line.currency || je.currency}`
                                  : "—"}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 font-bold">
                                {line.cost_center || selectedVoucherForJournal.cost_center || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handlePrintSingleVoucher(selectedVoucherForJournal)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  طباعة السند
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedVoucherForJournal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AUDIT HISTORY MODAL */}
      {selectedVoucherForAudit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-4 bg-purple-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <History className="w-5 h-5 text-purple-300" />
                <div>
                  <h3 className="text-base font-black">
                    سجل المراجعة والتدقيق التاريخي للسند #
                    {selectedVoucherForAudit.reference_number ||
                      selectedVoucherForAudit.id.substring(4, 10).toUpperCase()}
                  </h3>
                  <p className="text-xs text-purple-200">
                    توثيق كامل للإنشاء والتعديلات والقيود العكسية والحذف
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVoucherForAudit(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-3 max-h-[70vh] overflow-y-auto">
              {Array.isArray(selectedVoucherForAudit.audit_history) &&
              selectedVoucherForAudit.audit_history.length > 0 ? (
                selectedVoucherForAudit.audit_history.map((entry, idx) => (
                  <div
                    key={entry.id || idx}
                    className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span
                        className={`px-2.5 py-0.5 rounded-lg font-black ${
                          entry.action === "created"
                            ? "bg-emerald-100 text-emerald-800"
                            : entry.action === "updated"
                              ? "bg-blue-100 text-blue-800"
                              : entry.action === "reverted"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {entry.action === "created"
                          ? "إنشاء واعتماد"
                          : entry.action === "updated"
                            ? "تعديل بيانات السند"
                            : entry.action === "reverted"
                              ? "عكس مالي ومحاسبي"
                              : "حذف مع عكس القيود"}
                      </span>
                      <span className="text-slate-500 font-bold">
                        بواسطة: <b>{entry.user}</b> —{" "}
                        {new Date(entry.timestamp).toLocaleString("ar-EG")}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-800">{entry.summary}</p>
                    {entry.previous_values && (
                      <div className="text-[11px] bg-white p-2 rounded-lg border border-slate-200 text-slate-600 font-mono">
                        القيم السابقة قبل الإجراء:{" "}
                        {JSON.stringify({
                          amount: entry.previous_values.amount,
                          currency: entry.previous_values.currency,
                          category: entry.previous_values.category,
                          account_code: entry.previous_values.account_code,
                        })}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-600">
                  تم إنشاء هذا السند بتاريخ{" "}
                  {new Date(selectedVoucherForAudit.created_at).toLocaleString("ar-EG")} ولم تطرأ
                  عليه تعديلات لاحقة.
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedVoucherForAudit(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REVERT CONFIRMATION MODAL */}
      {voucherToRevert && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3 text-amber-700">
              <RotateCcw className="w-6 h-6" />
              <h3 className="text-base font-black">
                عكس وإلغاء الأثر المالي للسند #
                {voucherToRevert.reference_number || voucherToRevert.id.substring(4, 9)}
              </h3>
            </div>
            <p className="text-xs text-slate-600 font-bold leading-relaxed">
              سيقوم النظام بتوليد قيد محاسبي عكسي، وعكس حركة الخزينة، وإرجاع أي كميات مخزنية مرتبطة
              بالسند مع الاحتفاظ بالسجل التاريخي للمراجعة.
            </p>
            <textarea
              rows={3}
              value={revertReason}
              onChange={(e) => setRevertReason(e.target.value)}
              placeholder="اكتب سبب عكس السند..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setVoucherToRevert(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={handleConfirmRevert}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black cursor-pointer"
              >
                تأكيد العكس المحاسبي
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {voucherToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-700">
              <Trash2 className="w-6 h-6" />
              <h3 className="text-base font-black">
                حذف السند المالي #
                {voucherToDelete.reference_number || voucherToDelete.id.substring(4, 9)}
              </h3>
            </div>
            <p className="text-xs text-slate-600 font-bold leading-relaxed">
              سيتم عكس القيد المحاسبي المرتبط وحركة الخزينة وأرصدة المخزون تلقائياً حتى لا تبقى أي
              قيود معلقة، مع حفظ العملية في سجل التدقيق.
            </p>
            <textarea
              rows={2}
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="اكتب سبب حذف السند..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setVoucherToDelete(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black cursor-pointer"
              >
                تأكيد الحذف وعكس القيد
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
