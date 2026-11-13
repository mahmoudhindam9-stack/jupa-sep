import React, { useState, useEffect, useMemo } from "react";
import {
  erpStore,
  Voucher,
  Account,
  Treasury,
  Supplier,
  ParkCustomer,
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
  FileSpreadsheet,
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
  Users,
  PackagePlus,
  ShoppingBag,
  Sparkles,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";
import { printAccountingDocument } from "../../shared/utils/printAccountingDocument";
import { ViewModeToggle, useViewMode } from "../ui/view-mode-toggle";

function exportRowsToExcelCsv(filename: string, headers: string[], rows: string[][]) {
  const escapeCsvCell = (val: string) => {
    const str = String(val ?? "").replace(/"/g, '""');
    return `"${str}"`;
  };
  const csvContent =
    "\uFEFF" +
    [headers.map(escapeCsvCell).join(","), ...rows.map((r) => r.map(escapeCsvCell).join(","))].join(
      "\r\n",
    );
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

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
  entityTitle: string;
  costCenter: string;
  badgeClass: string;
  defaultPaymentCategories: Array<{ name: string; account_code: string }>;
  defaultReceiptCategories: Array<{ name: string; account_code: string }>;
}

const DEPARTMENT_PRESETS: Record<VoucherDepartmentKey, DepartmentPreset> = {
  restaurant: {
    key: "restaurant",
    label: "المطعم",
    entityTitle: "مطعم جوبا",
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
    entityTitle: "جوبا مول",
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
    entityTitle: "حديقة جوبا",
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
    entityTitle: "إدارة جوبا",
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
  const [customers, setCustomers] = useState<ParkCustomer[]>([]);
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
  const [formInvoiceTotal, setFormInvoiceTotal] = useState("");
  const [userEditedPaidAmount, setUserEditedPaidAmount] = useState(false);
  const [formCurrency, setFormCurrency] = useState("EGP");
  const [formExchangeRate, setFormExchangeRate] = useState("50");
  const [formTreasuryId, setFormTreasuryId] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formBeneficiary, setFormBeneficiary] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formAttachment, setFormAttachment] = useState("");

  // Inline New Category Creator & Search
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryAccountCode, setNewCategoryAccountCode] = useState("");

  // Supplier & Customer Counterparty State (Supports Credit Purchases & Credit Sales)
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  // Counterparty Account Statement Modal State (Supplier or Customer)
  const [statementTarget, setStatementTarget] = useState<{
    kind: "supplier" | "customer";
    id: string;
    name_ar: string;
    phone?: string;
    account_code: string;
    opening_balance?: number;
  } | null>(null);

  const [purchaseItems, setPurchaseItems] = useState<VoucherPurchaseItem[]>([]);
  const [selectedInventoryIdToAdd, setSelectedInventoryIdToAdd] = useState("");
  const [isAddingInventoryItem, setIsAddingInventoryItem] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("كجم");
  const [newItemCost, setNewItemCost] = useState("");
  const [newItemMinQty, setNewItemMinQty] = useState("5");

  // Step-by-Step Voucher Wizard State (1: Type -> 2: Department -> 3: Form -> 4: Print Preview)
  const [wizardStep, setWizardStep] = useState<
    "select_type" | "select_dept" | "entry_form" | "print_preview"
  >("select_type");
  const [confirmAction, setConfirmAction] = useState<"cancel" | "draft" | "post" | null>(null);
  const [printedVoucherAfterPost, setPrintedVoucherAfterPost] = useState<Voucher | null>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [voucherDrafts, setVoucherDrafts] = useState<
    Array<{
      id: string;
      saved_at: string;
      type: "receipt" | "payment";
      department: VoucherDepartmentKey;
      category: string;
      account_code: string;
      amount: string;
      invoice_total?: string;
      currency: string;
      exchange_rate: string;
      treasury_id: string;
      description: string;
      beneficiary: string;
      supplier_id?: string;
      customer_id?: string;
      purchase_items?: VoucherPurchaseItem[];
    }>
  >(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("restocash_voucher_drafts_v1");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const saveVoucherDraftsList = (nextDrafts: typeof voucherDrafts) => {
    setVoucherDrafts(nextDrafts);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("restocash_voucher_drafts_v1", JSON.stringify(nextDrafts));
      } catch {}
    }
  };

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
    setSuppliers([...(erpStore.getSuppliers() || [])]);
    setCustomers([...(erpStore.getParkCustomers() || [])]);
    setAccounts([...(erpStore.getState().accounts || [])]);
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

  // Auto-calculate purchase items total & sync to formInvoiceTotal / formAmount
  const purchaseInvoiceTotal = useMemo(() => {
    return purchaseItems.reduce(
      (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
      0,
    );
  }, [purchaseItems]);

  useEffect(() => {
    if (isRestaurantPurchaseMode && purchaseItems.length > 0) {
      const totalStr = String(Number(purchaseInvoiceTotal.toFixed(2)));
      setFormInvoiceTotal(totalStr);
      if (!userEditedPaidAmount) {
        setFormAmount(totalStr);
      }
    }
  }, [isRestaurantPurchaseMode, purchaseInvoiceTotal, purchaseItems.length, userEditedPaidAmount]);

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

  const resetWizardToStart = () => {
    setEditingVoucher(null);
    setActiveDraftId(null);
    setConfirmAction(null);
    setPrintedVoucherAfterPost(null);
    setFormAmount("");
    setFormInvoiceTotal("");
    setUserEditedPaidAmount(false);
    setFormDescription("");
    setFormBeneficiary("");
    setFormNotes("");
    setFormAttachment("");
    setSelectedSupplierId("");
    setIsAddingSupplier(false);
    setSelectedCustomerId("");
    setIsAddingCustomer(false);
    setPurchaseItems([]);
    setIsAddingInventoryItem(false);
    setIsAddingCategory(false);
    setWizardStep("select_type");
  };

  const handleSelectWizardType = (chosenType: "receipt" | "payment") => {
    setEditingVoucher(null);
    setActiveDraftId(null);
    setFormType(chosenType);
    setFormAmount("");
    setFormInvoiceTotal("");
    setUserEditedPaidAmount(false);
    setFormDescription("");
    setFormBeneficiary("");
    setFormNotes("");
    setFormAttachment("");
    setSelectedSupplierId("");
    setSelectedCustomerId("");
    setPurchaseItems([]);
    setWizardStep("select_dept");
  };

  const handleSelectWizardDepartment = (chosenDept: VoucherDepartmentKey) => {
    setFormDepartment(chosenDept);
    const preset = DEPARTMENT_PRESETS[chosenDept] || DEPARTMENT_PRESETS.restaurant;
    const cats =
      formType === "payment"
        ? preset.defaultPaymentCategories
        : preset.defaultReceiptCategories;
    const firstCat = cats[0] || {
      name: formType === "payment" ? "مصروفات نثرية وإدارية" : "تسوية عهد وأمانات",
      account_code: formType === "payment" ? "31010160" : "41010110",
    };
    setFormCategory(firstCat.name);
    setFormAccountCode(firstCat.account_code);

    const defTr = resolveDefaultTreasuryForDepartment(chosenDept);
    if (defTr) {
      setFormTreasuryId(defTr.id);
      const curr = defTr.currency === "MULTI" ? "EGP" : defTr.currency || "EGP";
      setFormCurrency(curr);
      setFormExchangeRate(String(exchangeRates[curr] || 1));
    }
    setWizardStep("entry_form");
  };

  const handleLoadVoucherDraft = (draft: (typeof voucherDrafts)[number]) => {
    setEditingVoucher(null);
    setActiveDraftId(draft.id);
    setFormType(draft.type);
    setFormDepartment(draft.department);
    setFormCategory(draft.category);
    setFormAccountCode(draft.account_code);
    setFormAmount(draft.amount);
    setFormInvoiceTotal(draft.invoice_total || draft.amount);
    setUserEditedPaidAmount(Boolean(draft.invoice_total && draft.invoice_total !== draft.amount));
    setFormCurrency(draft.currency);
    setFormExchangeRate(draft.exchange_rate);
    setFormTreasuryId(draft.treasury_id);
    setFormDescription(draft.description);
    setFormBeneficiary(draft.beneficiary);
    setSelectedSupplierId(draft.supplier_id || "");
    setSelectedCustomerId(draft.customer_id || "");
    setPurchaseItems(Array.isArray(draft.purchase_items) ? draft.purchase_items : []);
    setWizardStep("entry_form");
    toast.success("تم استرجاع مسودة السند لاستكمالها");
  };

  const handleDeleteVoucherDraft = (draftId: string) => {
    const next = voucherDrafts.filter((d) => d.id !== draftId);
    saveVoucherDraftsList(next);
    if (activeDraftId === draftId) setActiveDraftId(null);
    toast.success("تم حذف المسودة");
  };

  const handleOpenCreateModal = (
    defaultType: "receipt" | "payment" = "payment",
    defaultDept: VoucherDepartmentKey = departmentFilter !== "all" ? departmentFilter : "restaurant",
  ) => {
    setEditingVoucher(null);
    setActiveDraftId(null);
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
    setFormInvoiceTotal("");
    setUserEditedPaidAmount(false);
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
    setSelectedCustomerId("");
    setIsAddingCustomer(false);
    setPurchaseItems([]);
    setIsAddingInventoryItem(false);
    setIsAddingCategory(false);
    setWizardStep("select_type");
    if (mode !== "operations") {
      setIsAddModalOpen(true);
    }
  };

  useEffect(() => {
    if (autoOpenNewModal && mode === "operations") {
      resetWizardToStart();
    } else if (autoOpenNewModal) {
      handleOpenCreateModal("payment");
      onModalClosed?.();
    }
  }, [autoOpenNewModal, mode]);

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
    const paidVal = v.paid_amount !== undefined ? v.paid_amount : v.amount;
    const invTotalVal = v.invoice_total !== undefined ? v.invoice_total : v.amount;
    setFormAmount(String(paidVal ?? ""));
    setFormInvoiceTotal(String(invTotalVal ?? ""));
    setUserEditedPaidAmount(invTotalVal !== paidVal);
    setFormCurrency(v.currency || "EGP");
    setFormExchangeRate(String(v.exchange_rate || exchangeRates[v.currency] || 1));
    setFormTreasuryId(v.treasury_id || treasuries[0]?.id || "");
    setFormDescription(v.description || "");
    setFormBeneficiary(v.beneficiary || v.supplier_name || v.customer_name || "");
    setFormNotes(v.notes || "");
    setFormAttachment(v.attachment || "");
    setSelectedSupplierId(v.supplier_id || "");
    setSelectedCustomerId(v.customer_id || "");
    setPurchaseItems(
      Array.isArray(v.purchase_items)
        ? v.purchase_items.map((it) => ({ ...it }))
        : [],
    );
    setIsAddingCategory(false);
    setIsAddingSupplier(false);
    setIsAddingCustomer(false);
    setIsAddingInventoryItem(false);
    setWizardStep("entry_form");
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
      setSelectedCustomerId("");
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

  // Inline Customer Creation (auto-assigns Level 4 account under 13020)
  const handleCreateInlineCustomer = () => {
    const cleanName = newCustomerName.trim();
    if (!cleanName) {
      toast.error("يرجى إدخال اسم العميل الجديد");
      return;
    }
    try {
      const result = erpStore.addCustomer(cleanName, newCustomerPhone.trim() || "");
      loadData();
      setSelectedCustomerId(result.customer.id);
      setSelectedSupplierId("");
      setFormBeneficiary(result.customer.name_ar);
      setNewCustomerName("");
      setNewCustomerPhone("");
      setIsAddingCustomer(false);
      toast.success(
        `تم تسجيل العميل "${result.customer.name_ar}" وإنشاء حسابه المحاسبي الفرعي (المستوى 4) رقم #${result.account_code}`,
      );
    } catch (err: any) {
      toast.error(err?.message || "تعذر إنشاء العميل الجديد");
    }
  };

  const openSupplierStatement = (sup: Supplier) => {
    setStatementTarget({
      kind: "supplier",
      id: sup.id,
      name_ar: sup.name_ar,
      phone: sup.phone,
      account_code: sup.account_code || "24010391",
      opening_balance: Number(sup.opening_balance || 0),
    });
  };

  const openCustomerStatement = (cust: ParkCustomer) => {
    setStatementTarget({
      kind: "customer",
      id: cust.id,
      name_ar: cust.name_ar,
      phone: cust.phone,
      account_code: cust.account_code || "13020101",
      opening_balance: 0,
    });
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
        const matchCust = v.customer_name?.toLowerCase().includes(q);
        const matchBen = v.beneficiary?.toLowerCase().includes(q);
        return (
          matchDesc ||
          matchCat ||
          matchId ||
          matchRef ||
          matchJe ||
          matchSup ||
          matchCust ||
          matchBen
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

  const selectedTreasuryObj = useMemo(
    () => treasuries.find((t) => t.id === formTreasuryId),
    [treasuries, formTreasuryId],
  );

  const selectedSupplierObj = useMemo(
    () => (selectedSupplierId ? suppliers.find((s) => s.id === selectedSupplierId) : undefined),
    [suppliers, selectedSupplierId],
  );

  const selectedCustomerObj = useMemo(
    () => (selectedCustomerId ? customers.find((c) => c.id === selectedCustomerId) : undefined),
    [customers, selectedCustomerId],
  );

  // Paid / Received Cash Amount vs Total Invoice Amount (for Credit Purchase / Credit Sale)
  const computedPaidAmount = useMemo(() => {
    if (formAmount === "" && isRestaurantPurchaseMode && !userEditedPaidAmount) {
      return Number(purchaseInvoiceTotal.toFixed(2));
    }
    return Math.max(0, Number(formAmount) || 0);
  }, [formAmount, isRestaurantPurchaseMode, userEditedPaidAmount, purchaseInvoiceTotal]);

  const computedInvoiceTotal = useMemo(() => {
    if (isRestaurantPurchaseMode && purchaseItems.length > 0) {
      return Number(purchaseInvoiceTotal.toFixed(2));
    }
    const explicitInv = Number(formInvoiceTotal);
    if (!isNaN(explicitInv) && explicitInv > computedPaidAmount) {
      return Number(explicitInv.toFixed(2));
    }
    return computedPaidAmount;
  }, [isRestaurantPurchaseMode, purchaseItems.length, purchaseInvoiceTotal, formInvoiceTotal, computedPaidAmount]);

  const computedRemainingCredit = useMemo(() => {
    return Math.max(0, Number((computedInvoiceTotal - computedPaidAmount).toFixed(2)));
  }, [computedInvoiceTotal, computedPaidAmount]);

  const computedVoucherAmount = computedPaidAmount;

  const isExceedingTreasuryBalance = useMemo(() => {
    if (formType !== "payment" || !selectedTreasuryObj) return false;
    return computedPaidAmount > Number(selectedTreasuryObj.balance || 0);
  }, [formType, selectedTreasuryObj, computedPaidAmount]);

  const handleRequestCancel = () => {
    const hasEnteredData =
      Number(formAmount) > 0 ||
      Number(formInvoiceTotal) > 0 ||
      formDescription.trim().length > 0 ||
      formBeneficiary.trim().length > 0 ||
      purchaseItems.length > 0;
    if (hasEnteredData) {
      setConfirmAction("cancel");
    } else {
      if (editingVoucher) {
        setIsAddModalOpen(false);
        setEditingVoucher(null);
      } else {
        resetWizardToStart();
      }
    }
  };

  const handleExecuteCancel = () => {
    setConfirmAction(null);
    if (editingVoucher) {
      setIsAddModalOpen(false);
      setEditingVoucher(null);
    } else {
      resetWizardToStart();
    }
  };

  const handleRequestSaveDraft = () => {
    setConfirmAction("draft");
  };

  const handleExecuteSaveDraft = () => {
    const draftItem = {
      id: activeDraftId || "vdraft-" + Date.now(),
      saved_at: new Date().toISOString(),
      type: formType,
      department: formDepartment,
      category: formCategory.trim() || "مصروفات نثرية وإدارية",
      account_code: formAccountCode,
      amount: String(computedPaidAmount || formAmount || ""),
      invoice_total: String(computedInvoiceTotal || ""),
      currency: formCurrency,
      exchange_rate: formExchangeRate,
      treasury_id: formTreasuryId,
      description: formDescription.trim(),
      beneficiary: formBeneficiary.trim(),
      supplier_id: selectedSupplierId || undefined,
      customer_id: selectedCustomerId || undefined,
      purchase_items: isRestaurantPurchaseMode ? purchaseItems : undefined,
    };

    const filtered = voucherDrafts.filter((d) => d.id !== draftItem.id);
    saveVoucherDraftsList([draftItem, ...filtered]);
    setConfirmAction(null);
    setIsAddModalOpen(false);
    resetWizardToStart();
    toast.success("تم حفظ السند كمسودة بنجاح ويمكنك استكماله في أي وقت");
  };

  const validateVoucherBeforePost = (): boolean => {
    if (computedInvoiceTotal <= 0 && computedPaidAmount <= 0) {
      toast.error(
        isRestaurantPurchaseMode
          ? "يرجى إضافة صنف واحد على الأقل بكمية وسعر أكبر من الصفر"
          : "يرجى إدخال مبلغ صحيح أكبر من الصفر",
      );
      return false;
    }
    if (computedPaidAmount > computedInvoiceTotal && Number(formInvoiceTotal) > 0) {
      toast.error("المبلغ المدفوع لا يمكن أن يتجاوز إجمالي قيمة الفاتورة");
      return false;
    }
    if (!formTreasuryId) {
      toast.error("يرجى اختيار الخزينة أو الحساب البنكي");
      return false;
    }
    if (!formCategory.trim()) {
      toast.error("يرجى اختيار بند السند");
      return false;
    }
    if (isRestaurantPurchaseMode && !selectedSupplierId) {
      toast.error("يرجى اختيار المورد لفاتورة المشتريات");
      return false;
    }
    if (isRestaurantPurchaseMode && purchaseItems.length === 0) {
      toast.error("يرجى إضافة الأصناف المشتراة");
      return false;
    }
    if (computedRemainingCredit > 0 && !selectedSupplierId && !selectedCustomerId) {
      toast.error(
        "عند وجود مبلغ متبقٍ بالآجل يجب تحديد المورد أو العميل لترحيل المبلغ الآجل على حسابه",
      );
      return false;
    }
    const selectedAccount = accounts.find((a) => a.code === formAccountCode);
    if (!isLevel4Account(selectedAccount)) {
      toast.error("يجب اختيار حساب محاسبي تشغيلي من المستوى الرابع");
      return false;
    }
    return true;
  };

  const handleRequestPost = () => {
    if (!validateVoucherBeforePost()) return;
    setConfirmAction("post");
  };

  // Save Document (Create or Update) and Transition to Print View
  const handleSaveDocument = (shouldPrintAfterSave = true) => {
    if (!validateVoucherBeforePost()) return;
    const paidAmt = computedPaidAmount;
    const invTotalAmt = computedInvoiceTotal;
    const remCreditAmt = computedRemainingCredit;

    const supplierObj = selectedSupplierObj;
    const customerObj = selectedCustomerObj;
    const preset = DEPARTMENT_PRESETS[formDepartment];
    const trName = getTreasuryName(formTreasuryId);
    const counterpartyLabel =
      supplierObj?.name_ar || customerObj?.name_ar || formBeneficiary.trim() || formCategory;

    const narrativePrefix =
      formType === "payment"
        ? `دفعنا نحن ${preset.entityTitle} مبلغ ${paidAmt.toLocaleString()} ${formCurrency}${remCreditAmt > 0 ? ` (من أصل فاتورة ${invTotalAmt.toLocaleString()} ${formCurrency} والباقي آجل ${remCreditAmt.toLocaleString()} ${formCurrency})` : ""} من خزينة ${trName} بمعامل ${formExchangeRate || 1} لـ ${counterpartyLabel} حساب #${formAccountCode}`
        : `قبضنا نحن ${preset.entityTitle} مبلغ ${paidAmt.toLocaleString()} ${formCurrency}${remCreditAmt > 0 ? ` (من أصل فاتورة ${invTotalAmt.toLocaleString()} ${formCurrency} والباقي آجل ${remCreditAmt.toLocaleString()} ${formCurrency})` : ""} إلى خزينة ${trName} بمعامل ${formExchangeRate || 1} من ${counterpartyLabel} حساب #${formAccountCode}`;

    const autoDescription = formDescription.trim()
      ? `${narrativePrefix} — ${formDescription.trim()}`
      : isRestaurantPurchaseMode
        ? `${narrativePrefix} — فاتورة شراء خامات ومواد للمطعم (${purchaseItems.length} أصناف)`
        : narrativePrefix;

    const presetCostCenter = preset.costCenter;
    const rateNum = Number(formExchangeRate) || exchangeRates[formCurrency] || 1;

    try {
      if (editingVoucher) {
        const updated = erpStore.updateVoucher(editingVoucher.id, {
          type: formType,
          department: formDepartment,
          category: formCategory.trim(),
          amount: paidAmt,
          invoice_total: invTotalAmt,
          paid_amount: paidAmt,
          remaining_credit: remCreditAmt,
          currency: formCurrency,
          exchange_rate: rateNum,
          treasury_id: formTreasuryId,
          account_code: formAccountCode,
          description: autoDescription,
          cost_center: presetCostCenter,
          beneficiary:
            formBeneficiary.trim() || supplierObj?.name_ar || customerObj?.name_ar || undefined,
          notes: formNotes.trim() || undefined,
          attachment: formAttachment.trim() || undefined,
          supplier_id: selectedSupplierId || undefined,
          supplier_name: supplierObj?.name_ar || undefined,
          supplier_account_code: supplierObj?.account_code || undefined,
          customer_id: selectedCustomerId || undefined,
          customer_name: customerObj?.name_ar || undefined,
          customer_account_code: customerObj?.account_code || undefined,
          purchase_items: isRestaurantPurchaseMode ? purchaseItems : [],
        });

        toast.success(
          `تم تحديث وترحيل السند #${updated.reference_number || updated.id.substring(4, 9)} بنجاح`,
        );
        setConfirmAction(null);
        setEditingVoucher(null);
        loadData();
        if (shouldPrintAfterSave) {
          setPrintedVoucherAfterPost(updated);
          setWizardStep("print_preview");
        } else {
          setIsAddModalOpen(false);
        }
      } else {
        const created = erpStore.createVoucher(
          formType,
          formCategory.trim(),
          paidAmt,
          formTreasuryId,
          autoDescription,
          presetCostCenter,
          formAttachment.trim() || undefined,
          formCurrency,
          rateNum,
          formAccountCode,
          {
            department: formDepartment,
            beneficiary:
              formBeneficiary.trim() || supplierObj?.name_ar || customerObj?.name_ar || undefined,
            notes: formNotes.trim() || undefined,
            supplier_id: selectedSupplierId || undefined,
            supplier_name: supplierObj?.name_ar || undefined,
            supplier_account_code: supplierObj?.account_code || undefined,
            customer_id: selectedCustomerId || undefined,
            customer_name: customerObj?.name_ar || undefined,
            customer_account_code: customerObj?.account_code || undefined,
            invoice_total: invTotalAmt,
            paid_amount: paidAmt,
            remaining_credit: remCreditAmt,
            purchase_items: isRestaurantPurchaseMode ? purchaseItems : undefined,
          },
        );

        if (activeDraftId) {
          saveVoucherDraftsList(voucherDrafts.filter((d) => d.id !== activeDraftId));
          setActiveDraftId(null);
        }

        toast.success(
          `تم حفظ وترحيل ${formType === "receipt" ? "سند القبض" : "سند الصرف"} #${created.reference_number} بنجاح`,
        );
        setConfirmAction(null);
        loadData();
        if (shouldPrintAfterSave) {
          setPrintedVoucherAfterPost(created);
          setWizardStep("print_preview");
        } else {
          resetWizardToStart();
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
        label: "الجهة والقسم",
        value: `${deptPreset.entityTitle} (${v.type === "receipt" ? "سند قبض" : "سند صرف"})`,
      },
      {
        label: "المبلغ النقدي والعملة",
        value: `${Number(v.amount).toLocaleString()} ${v.currency} (معامل الصرف: ${v.exchange_rate || 1})`,
      },
      {
        label: "الخزينة والحساب",
        value: `${getTreasuryName(v.treasury_id)} | ${getAccountName(v.account_code)}`,
      },
    ];

    if (v.remaining_credit && v.remaining_credit > 0) {
      summaryCards.push({
        label: "إجمالي الفاتورة والمتبقي آجل",
        value: `الفاتورة: ${Number(v.invoice_total || v.amount).toLocaleString()} ${v.currency} | متبقي آجل: ${Number(v.remaining_credit).toLocaleString()} ${v.currency}`,
      });
    }

    if (v.supplier_name || v.customer_name || v.beneficiary) {
      summaryCards.push({
        label: v.supplier_name
          ? "المورد وحسابه المحاسبي"
          : v.customer_name
            ? "العميل وحسابه المحاسبي"
            : "المستفيد / الجهة",
        value: v.supplier_name
          ? `${v.supplier_name} ${v.supplier_account_code ? `(حساب #${v.supplier_account_code})` : ""}`
          : v.customer_name
            ? `${v.customer_name} ${v.customer_account_code ? `(حساب #${v.customer_account_code})` : ""}`
            : String(v.beneficiary || "—"),
      });
    }

    const hasPurchaseItems = Array.isArray(v.purchase_items) && v.purchase_items.length > 0;

    if (hasPurchaseItems) {
      printProfessionalReport({
        title: `فاتورة وسند صرف مشتريات (${deptPreset.entityTitle}) #${docRef}`,
        subtitle: `التاريخ: ${new Date(v.created_at).toLocaleString("ar-EG")} | المورد: ${v.supplier_name || "—"} (${v.supplier_account_code || "—"})`,
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
            "إجمالي الفاتورة / المدفوع نقداً / المتبقي آجل",
            "—",
            String(v.purchase_items!.reduce((s, i) => s + Number(i.quantity || 0), 0)),
            `المدفوع: ${Number(v.amount).toLocaleString()} ${v.currency}`,
            `الفاتورة: ${Number(v.invoice_total || v.amount).toLocaleString()} ${v.currency} (آجل: ${Number(v.remaining_credit || 0).toLocaleString()})`,
          ],
        ],
      });
      return;
    }

    printProfessionalReport({
      title: `${v.type === "receipt" ? `سند قبض — ${deptPreset.entityTitle}` : `سند صرف — ${deptPreset.entityTitle}`} #${docRef}`,
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
        "الجهة / القسم",
        "البند / المورد / العميل",
        "الخزينة",
        "الحساب المحاسبي",
        "المدفوع",
        "المتبقي آجل",
        "العملة",
        "رقم القيد",
        "الحالة",
      ],
      rows: filteredVouchers.map((v) => {
        const dept = getVoucherDepartmentPreset(v);
        const party = v.supplier_name || v.customer_name || v.beneficiary;
        return [
          v.reference_number || v.id.substring(4, 10).toUpperCase(),
          new Date(v.created_at).toLocaleDateString("ar-EG"),
          v.type === "receipt" ? "سند قبض" : "سند صرف",
          dept.entityTitle,
          party ? `${v.category} (${party})` : v.category,
          getTreasuryName(v.treasury_id),
          getAccountName(v.account_code),
          Number(v.amount).toLocaleString(),
          Number(v.remaining_credit || 0).toLocaleString(),
          v.currency,
          v.journal_reference || "—",
          v.deleted ? "محذوف" : v.reverted ? "معكوس" : "معتمد",
        ];
      }),
    });
  };

  const handleExportAllFilteredExcel = () => {
    const headers = [
      "رقم السند",
      "التاريخ",
      "النوع",
      "الجهة / القسم",
      "البند",
      "المورد / العميل / المستفيد",
      "الخزينة",
      "الحساب المحاسبي",
      "إجمالي الفاتورة",
      "المبلغ المدفوع / المقبوض",
      "المتبقي آجل",
      "العملة",
      "معامل الصرف",
      "رقم القيد",
      "البيان",
      "الحالة",
    ];
    const rows = filteredVouchers.map((v) => {
      const dept = getVoucherDepartmentPreset(v);
      return [
        v.reference_number || v.id.substring(4, 10).toUpperCase(),
        new Date(v.created_at).toLocaleDateString("ar-EG"),
        v.type === "receipt" ? "سند قبض" : "سند صرف",
        dept.entityTitle,
        v.category,
        v.supplier_name || v.customer_name || v.beneficiary || "—",
        getTreasuryName(v.treasury_id),
        getAccountName(v.account_code),
        String(v.invoice_total ?? v.amount ?? 0),
        String(v.amount ?? 0),
        String(v.remaining_credit ?? 0),
        v.currency,
        String(v.exchange_rate || 1),
        v.journal_reference || "—",
        v.description || "",
        v.deleted ? "محذوف" : v.reverted ? "معكوس" : "معتمد",
      ];
    });
    exportRowsToExcelCsv(`سجل_السندات_المالية_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    toast.success("تم تصدير سجل السندات إلى ملف إكسيل بنجاح");
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
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ViewModeToggle mode={viewMode} onChange={setViewMode} />
              <button
                type="button"
                onClick={() => handleOpenCreateModal("receipt")}
                className="btn-uniform-save px-3.5 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <ArrowDownLeft className="w-4 h-4" />
                سند قبض جديد
              </button>
              <button
                type="button"
                onClick={() => handleOpenCreateModal("payment")}
                className="btn-uniform-save px-3.5 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <ArrowUpRight className="w-4 h-4" />
                سند صرف جديد
              </button>
              <button
                type="button"
                onClick={handlePrintAllFiltered}
                className="btn-uniform-print px-3.5 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                طباعة سجل السندات
              </button>
              <button
                type="button"
                onClick={handleExportAllFilteredExcel}
                className="btn-uniform-excel px-3.5 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                طباعة إكسيل (Excel)
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

                    {(v.supplier_name || v.customer_name) && (
                      <div className="text-xs font-bold text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 flex items-center justify-between">
                        {v.supplier_name ? (
                          <button
                            type="button"
                            onClick={() => {
                              const sup = suppliers.find(
                                (s) => s.id === v.supplier_id || s.name_ar === v.supplier_name,
                              );
                              openSupplierStatement(
                                sup || {
                                  id: v.supplier_id || "sup",
                                  name_ar: v.supplier_name!,
                                  phone: "",
                                  account_code: v.supplier_account_code || "24010391",
                                  balance: 0,
                                },
                              );
                            }}
                            className="app-link text-indigo-700 hover:text-indigo-900 font-black text-xs"
                            title="اضغط لعرض كشف حساب المورد"
                          >
                            المورد: {v.supplier_name}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              const cust = customers.find(
                                (c) => c.id === v.customer_id || c.name_ar === v.customer_name,
                              );
                              openCustomerStatement(
                                cust || {
                                  id: v.customer_id || "cust",
                                  name_ar: v.customer_name!,
                                  phone: "",
                                  account_code: v.customer_account_code || "13020101",
                                },
                              );
                            }}
                            className="app-link text-teal-700 hover:text-teal-900 font-black text-xs"
                            title="اضغط لعرض كشف حساب العميل"
                          >
                            العميل: {v.customer_name}
                          </button>
                        )}
                        {(v.supplier_account_code || v.customer_account_code) && (
                          <span className="font-mono text-[11px] text-indigo-600">
                            #{v.supplier_account_code || v.customer_account_code}
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
                      {Number(v.remaining_credit || 0) > 0 && (
                        <span className="block text-[10px] font-black text-amber-700">
                          متبقي آجل: {Number(v.remaining_credit).toLocaleString()} {v.currency}
                        </span>
                      )}
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
                        className="btn-uniform-print p-1.5 rounded-lg transition-colors cursor-pointer"
                        title="طباعة السند"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      {!v.deleted && !v.reverted && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(v)}
                          className="btn-uniform-edit p-1.5 rounded-lg transition-colors cursor-pointer"
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
                          className="btn-uniform-delete p-1.5 rounded-lg transition-colors cursor-pointer"
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
                              {dept.entityTitle}
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
                          {v.supplier_name ? (
                            <button
                              type="button"
                              onClick={() => {
                                const sup = suppliers.find(
                                  (s) => s.id === v.supplier_id || s.name_ar === v.supplier_name,
                                );
                                openSupplierStatement(
                                  sup || {
                                    id: v.supplier_id || "sup",
                                    name_ar: v.supplier_name!,
                                    phone: "",
                                    account_code: v.supplier_account_code || "24010391",
                                    balance: 0,
                                  },
                                );
                              }}
                              className="app-link text-[11px] font-black text-indigo-700 hover:text-indigo-900 mt-1 inline-block"
                              title="اضغط لعرض كشف حساب المورد"
                            >
                              المورد: {v.supplier_name}{" "}
                              {v.supplier_account_code ? `(#${v.supplier_account_code})` : ""}
                            </button>
                          ) : v.customer_name ? (
                            <button
                              type="button"
                              onClick={() => {
                                const cust = customers.find(
                                  (c) => c.id === v.customer_id || c.name_ar === v.customer_name,
                                );
                                openCustomerStatement(
                                  cust || {
                                    id: v.customer_id || "cust",
                                    name_ar: v.customer_name!,
                                    phone: "",
                                    account_code: v.customer_account_code || "13020101",
                                  },
                                );
                              }}
                              className="app-link text-[11px] font-black text-teal-700 hover:text-teal-900 mt-1 inline-block"
                              title="اضغط لعرض كشف حساب العميل"
                            >
                              العميل: {v.customer_name}{" "}
                              {v.customer_account_code ? `(#${v.customer_account_code})` : ""}
                            </button>
                          ) : v.beneficiary ? (
                            <div className="text-[11px] font-bold text-slate-700 mt-1">
                              المستفيد: {v.beneficiary}
                            </div>
                          ) : null}
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
                          {Number(v.remaining_credit || 0) > 0 && (
                            <div className="text-[10px] font-black text-amber-700 mt-0.5">
                              آجل: {Number(v.remaining_credit).toLocaleString()} {v.currency}
                            </div>
                          )}
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
                              className="app-link inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-black font-mono transition-colors cursor-pointer"
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
                              className="btn-uniform-print p-1.5 rounded-lg transition-colors cursor-pointer"
                              title="طباعة السند"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            {!v.deleted && !v.reverted && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(v)}
                                className="btn-uniform-edit p-1.5 rounded-lg transition-colors cursor-pointer"
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
                                className="btn-uniform-delete p-1.5 rounded-lg transition-colors cursor-pointer"
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
                                className="btn-uniform-delete p-1.5 rounded-lg transition-colors cursor-pointer"
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

      {/* ===================================================================== */}
      {/* SINGLE-PAGE 3-STEP VOUCHER WIZARD (Operations Inline OR Reports Modal) */}
      {/* ===================================================================== */}
      {(mode === "operations" || isAddModalOpen) && (
        <div
          className={
            mode === "operations"
              ? "w-full max-w-5xl mx-auto"
              : "fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4"
          }
        >
          <div
            className={`bg-card rounded-2xl border border-border shadow-sm overflow-hidden w-full ${
              mode === "operations" ? "" : "max-w-4xl"
            }`}
          >
            {/* Compact Step Header Bar (No explanatory subtitles) */}
            <div className="px-4 py-2.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
                  {wizardStep === "select_type" ? (
                    <Receipt className="w-4 h-4" />
                  ) : formType === "receipt" ? (
                    <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4 text-amber-400" />
                  )}
                </div>
                <h3 className="text-sm sm:text-base font-black">
                  {editingVoucher
                    ? `تعديل سند #${editingVoucher.reference_number || editingVoucher.id.substring(4, 9)}`
                    : wizardStep === "select_type"
                      ? "إصدار سند مالي — الخطوة 1: اختر نوع السند"
                      : wizardStep === "select_dept"
                        ? `إصدار ${formType === "receipt" ? "سند قبض" : "سند صرف"} — الخطوة 2: اختر القسم المطلوب`
                        : wizardStep === "print_preview"
                          ? `تم الحفظ والترحيل بنجاح — طباعة السند #${printedVoucherAfterPost?.reference_number || ""}`
                          : `${formType === "receipt" ? "إيصال سند قبض" : "إيصال سند صرف"} — ${DEPARTMENT_PRESETS[formDepartment].entityTitle}`}
                </h3>
              </div>

              {/* Step Progress Badges */}
              <div className="flex items-center gap-1.5 text-[11px] font-black">
                <button
                  type="button"
                  onClick={() => setWizardStep("select_type")}
                  className={`px-2 py-0.5 rounded-md underline cursor-pointer ${
                    wizardStep === "select_type"
                      ? "bg-white text-slate-900"
                      : "bg-white/15 text-white/90 hover:bg-white/25"
                  }`}
                >
                  1. النوع
                </button>
                <span className="text-white/50">←</span>
                <button
                  type="button"
                  onClick={() => setWizardStep("select_dept")}
                  className={`px-2 py-0.5 rounded-md underline cursor-pointer ${
                    wizardStep === "select_dept"
                      ? "bg-white text-slate-900"
                      : "bg-white/15 text-white/90 hover:bg-white/25"
                  }`}
                >
                  2. القسم
                </button>
                <span className="text-white/50">←</span>
                <button
                  type="button"
                  onClick={() => setWizardStep("entry_form")}
                  className={`px-2 py-0.5 rounded-md underline cursor-pointer ${
                    wizardStep === "entry_form"
                      ? "bg-white text-slate-900"
                      : "bg-white/15 text-white/90 hover:bg-white/25"
                  }`}
                >
                  3. تحرير السند
                </button>

                {mode !== "operations" && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddModalOpen(false);
                      setEditingVoucher(null);
                    }}
                    className="btn-uniform-close mr-2 px-2.5 py-1 rounded-lg text-xs font-black cursor-pointer"
                  >
                    إغلاق ✕
                  </button>
                )}
              </div>
            </div>

            {/* =============================================================== */}
            {/* STEP 1: SELECT VOUCHER TYPE (صرف ولا قبض)                       */}
            {/* =============================================================== */}
            {wizardStep === "select_type" && (
              <div className="p-5 sm:p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => handleSelectWizardType("payment")}
                    className="group p-6 sm:p-8 rounded-2xl border-2 border-amber-500/40 bg-amber-500/[0.04] hover:bg-amber-500/[0.10] hover:border-amber-600 transition-all flex flex-col items-center justify-center gap-3 text-center cursor-pointer shadow-xs"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                      <ArrowUpRight className="w-7 h-7" />
                    </div>
                    <span className="text-xl font-black text-amber-800 dark:text-amber-300 underline">
                      سند صرف
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectWizardType("receipt")}
                    className="group p-6 sm:p-8 rounded-2xl border-2 border-teal-500/40 bg-teal-500/[0.04] hover:bg-teal-500/[0.10] hover:border-teal-600 transition-all flex flex-col items-center justify-center gap-3 text-center cursor-pointer shadow-xs"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-teal-700 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                      <ArrowDownLeft className="w-7 h-7" />
                    </div>
                    <span className="text-xl font-black text-teal-800 dark:text-teal-300 underline">
                      سند قبض
                    </span>
                  </button>
                </div>

                {/* Saved Drafts Bar (if any) */}
                {voucherDrafts.length > 0 && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                    <div className="text-xs font-black text-amber-800 dark:text-amber-300">
                      مسودات السندات المحفوظة ({voucherDrafts.length})
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {voucherDrafts.map((draft) => (
                        <div
                          key={draft.id}
                          className="inline-flex items-center gap-1.5 bg-card border border-amber-500/30 rounded-lg px-2.5 py-1.5 text-xs"
                        >
                          <button
                            type="button"
                            onClick={() => handleLoadVoucherDraft(draft)}
                            className="app-link underline font-bold text-foreground hover:text-primary cursor-pointer flex items-center gap-1.5"
                          >
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-black no-underline ${
                                draft.type === "receipt"
                                  ? "bg-teal-500/15 text-teal-700"
                                  : "bg-amber-500/15 text-amber-700"
                              }`}
                            >
                              {draft.type === "receipt" ? "قبض" : "صرف"}
                            </span>
                            <span>{DEPARTMENT_PRESETS[draft.department]?.entityTitle}</span>
                            <span>—</span>
                            <span>{draft.category}</span>
                            {Number(draft.amount) > 0 && (
                              <span className="font-mono font-black">
                                ({Number(draft.amount).toLocaleString()} {draft.currency})
                              </span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteVoucherDraft(draft.id)}
                            className="btn-uniform-delete px-1.5 py-0.5 rounded text-[10px] font-black cursor-pointer"
                            title="حذف المسودة"
                          >
                            حذف
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* =============================================================== */}
            {/* STEP 2: SELECT TARGET DEPARTMENT (القسم المطلوب)                */}
            {/* =============================================================== */}
            {wizardStep === "select_dept" && (
              <div className="p-5 sm:p-6 space-y-5">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground">النوع المختار:</span>
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-black ${
                        formType === "receipt"
                          ? "bg-teal-500/15 text-teal-800 dark:text-teal-300"
                          : "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                      }`}
                    >
                      {formType === "receipt" ? "سند قبض" : "سند صرف"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWizardStep("select_type")}
                    className="btn-uniform-close px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer"
                  >
                    تغيير نوع السند
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                  {(
                    [
                      {
                        key: "restaurant",
                        label: "مطعم جوبا",
                        icon: Utensils,
                        tone: "border-orange-500/30 bg-orange-500/[0.04] hover:bg-orange-500/[0.12] hover:border-orange-500 text-orange-700 dark:text-orange-400",
                        iconBg: "bg-orange-600 text-white",
                      },
                      {
                        key: "park",
                        label: "حديقة جوبا",
                        icon: Sparkles,
                        tone: "border-emerald-500/30 bg-emerald-500/[0.04] hover:bg-emerald-500/[0.12] hover:border-emerald-500 text-emerald-700 dark:text-emerald-400",
                        iconBg: "bg-emerald-600 text-white",
                      },
                      {
                        key: "mall",
                        label: "جوبا مول",
                        icon: Building2,
                        tone: "border-blue-500/30 bg-blue-500/[0.04] hover:bg-blue-500/[0.12] hover:border-blue-500 text-blue-700 dark:text-blue-400",
                        iconBg: "bg-blue-600 text-white",
                      },
                      {
                        key: "admin",
                        label: "إدارة جوبا",
                        icon: Landmark,
                        tone: "border-indigo-500/30 bg-indigo-500/[0.04] hover:bg-indigo-500/[0.12] hover:border-indigo-500 text-indigo-700 dark:text-indigo-400",
                        iconBg: "bg-indigo-600 text-white",
                      },
                    ] as const
                  ).map((dept) => {
                    const Icon = dept.icon;
                    return (
                      <button
                        key={dept.key}
                        type="button"
                        onClick={() => handleSelectWizardDepartment(dept.key)}
                        className={`p-5 sm:p-6 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-3 text-center cursor-pointer shadow-xs ${dept.tone}`}
                      >
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${dept.iconBg}`}
                        >
                          <Icon className="w-6 h-6" />
                        </div>
                        <span className="text-base font-black underline">{dept.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* =============================================================== */}
            {/* STEP 3: REAL PRINTED-VOUCHER ENTRY FORM (زي السند الحقيقي)     */}
            {/* =============================================================== */}
            {wizardStep === "entry_form" && (
              <div className="p-3.5 sm:p-4 space-y-2.5">
                {/* Printed Voucher Slip Frame */}
                <div className="rounded-2xl border-2 border-slate-300 dark:border-slate-700 bg-card p-3.5 space-y-3 shadow-xs">
                  {/* Top Slip Header: Voucher Type Switcher + Entity Switcher + Treasury Balance */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b-2 border-dashed border-slate-300 dark:border-slate-700">
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={formType}
                        onChange={(e) => handleTypeChange(e.target.value as "receipt" | "payment")}
                        className={`h-8 px-3 rounded-xl text-xs sm:text-sm font-black cursor-pointer border-0 ${
                          formType === "receipt"
                            ? "bg-teal-700 text-white"
                            : "bg-amber-700 text-white"
                        }`}
                      >
                        <option value="payment" className="bg-slate-900 text-white">
                          سند صرف — دفعنا نحن {DEPARTMENT_PRESETS[formDepartment].entityTitle}
                        </option>
                        <option value="receipt" className="bg-slate-900 text-white">
                          سند قبض — قبضنا نحن {DEPARTMENT_PRESETS[formDepartment].entityTitle}
                        </option>
                      </select>

                      <select
                        value={formDepartment}
                        onChange={(e) =>
                          handleDepartmentChange(e.target.value as VoucherDepartmentKey)
                        }
                        className="h-8 px-2.5 rounded-xl border border-input bg-background text-xs font-black text-foreground cursor-pointer"
                      >
                        <option value="restaurant">مطعم جوبا</option>
                        <option value="park">حديقة جوبا</option>
                        <option value="mall">جوبا مول</option>
                        <option value="admin">إدارة جوبا</option>
                      </select>

                      {!editingVoucher && (
                        <>
                          <button
                            type="button"
                            onClick={() => setWizardStep("select_type")}
                            className="app-link underline text-xs font-black text-indigo-700 dark:text-indigo-400 px-1.5 cursor-pointer"
                          >
                            تغيير النوع
                          </button>
                          <button
                            type="button"
                            onClick={() => setWizardStep("select_dept")}
                            className="app-link underline text-xs font-black text-indigo-700 dark:text-indigo-400 px-1.5 cursor-pointer"
                          >
                            تغيير القسم
                          </button>
                        </>
                      )}
                    </div>

                    {selectedTreasuryObj && (
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        <span className="text-muted-foreground">رصيد الخزينة:</span>
                        <span
                          className={`font-mono font-black px-2 py-0.5 rounded-md ${
                            isExceedingTreasuryBalance
                              ? "bg-red-500/15 text-red-600 border border-red-500/30"
                              : "bg-teal-500/10 text-teal-700 dark:text-teal-300"
                          }`}
                        >
                          {Number(selectedTreasuryObj.balance || 0).toLocaleString()}{" "}
                          {selectedTreasuryObj.currency}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* VERBATIM REAL PRINTED VOUCHER SENTENCE WITH INLINE INPUTS:
                      "دفعنا نحن / قبضنا نحن [الجهة] مبلغ [...] بالعملة [...] من/إلى خزينة [...] بمعامل [...] لـ/من [...] رقم حساب [...]" */}
                  <div className="rounded-xl border-2 border-teal-600/30 bg-teal-500/[0.03] dark:bg-slate-900/60 p-3 space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-black text-foreground leading-loose">
                      <span
                        className={`px-2.5 py-1 rounded-lg font-black ${
                          formType === "payment"
                            ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                            : "bg-teal-500/15 text-teal-800 dark:text-teal-300"
                        }`}
                      >
                        {formType === "payment" ? "دفعنا نحن" : "قبضنا نحن"}{" "}
                        {DEPARTMENT_PRESETS[formDepartment].entityTitle}
                      </span>

                      <span>مبلغ</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formAmount}
                        onChange={(e) => {
                          setUserEditedPaidAmount(true);
                          setFormAmount(e.target.value);
                        }}
                        placeholder="0.00"
                        dir="ltr"
                        aria-label="المبلغ المدفوع أو المقبوض"
                        className="w-28 sm:w-32 h-9 px-2.5 bg-background border-2 border-teal-600 rounded-xl text-sm font-black font-mono text-center text-foreground focus:outline-none focus:ring-2 focus:ring-teal-600"
                      />

                      <span>بالعملة</span>
                      <select
                        value={formCurrency}
                        onChange={(e) => handleCurrencyChange(e.target.value)}
                        aria-label="العملة"
                        className="h-9 px-2.5 bg-background border border-input rounded-xl text-xs font-mono font-black text-foreground"
                      >
                        <option value="EGP">EGP (جنيه)</option>
                        <option value="USD">USD (دولار)</option>
                        <option value="SSP">SSP (جنوب سوداني)</option>
                      </select>

                      <span>{formType === "payment" ? "من خزينة" : "إلى خزينة"}</span>
                      <select
                        value={formTreasuryId}
                        onChange={(e) => handleTreasuryChange(e.target.value)}
                        aria-label="الخزينة"
                        className="h-9 px-2.5 bg-background border border-input rounded-xl text-xs font-bold text-foreground"
                      >
                        {treasuries.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name_ar} ({t.currency})
                          </option>
                        ))}
                      </select>

                      <span>بمعامل</span>
                      <input
                        type="number"
                        min="0.0001"
                        step="0.01"
                        value={formExchangeRate}
                        disabled={formCurrency === "USD"}
                        onChange={(e) => setFormExchangeRate(e.target.value)}
                        aria-label="معامل الصرف"
                        className="w-20 h-9 px-2 bg-background border border-input rounded-xl text-xs font-black font-mono text-center"
                      />

                      <span>{formType === "payment" ? "لـ" : "من"}</span>
                      <select
                        value={formCategory}
                        onChange={(e) => handleCategoryChange(e.target.value)}
                        aria-label="البند"
                        className="h-9 px-2.5 bg-background border border-input rounded-xl text-xs font-bold text-foreground min-w-[150px]"
                      >
                        {availableCategories.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingCategory(!isAddingCategory);
                          setNewCategoryAccountCode(formAccountCode);
                        }}
                        className="app-link underline text-[11px] font-black text-indigo-600 dark:text-indigo-400 cursor-pointer"
                      >
                        {isAddingCategory ? "إغلاق" : "+ بند جديد"}
                      </button>

                      <span>رقم حساب</span>
                      <select
                        value={formAccountCode}
                        onChange={(e) => setFormAccountCode(e.target.value)}
                        aria-label="رقم الحساب المحاسبي"
                        className="h-9 px-2.5 bg-background border border-input rounded-xl text-xs font-mono font-bold text-foreground max-w-[230px]"
                      >
                        {level4Accounts.map((acc) => (
                          <option key={acc.code} value={acc.code}>
                            #{acc.code} - {acc.name_ar}
                          </option>
                        ))}
                      </select>
                    </div>

                    {isAddingCategory && (
                      <div className="flex items-center gap-1.5 pt-1">
                        <input
                          type="text"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="اسم البند الجديد..."
                          className="flex-1 max-w-xs h-8 px-2.5 bg-background border border-input rounded-lg text-xs font-bold"
                        />
                        <button
                          type="button"
                          onClick={handleCreateCustomCategory}
                          className="btn-uniform-save h-8 px-3 rounded-lg text-xs font-black shrink-0 cursor-pointer"
                        >
                          حفظ البند
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Row 2: Supplier + Customer + Credit Invoice Total (Side-by-side with instant creation & statement links) */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-start">
                    {/* Supplier Field + Instant Supplier Creation + Clickable Statement Link */}
                    <div className="sm:col-span-4 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <label className="text-[11px] font-black text-foreground flex items-center gap-1">
                          <Truck className="w-3 h-3 text-orange-600" />
                          <span>المورد</span>
                          {isRestaurantPurchaseMode && <span className="text-red-600">*</span>}
                        </label>
                        <div className="flex items-center gap-2">
                          {selectedSupplierObj && (
                            <button
                              type="button"
                              onClick={() => openSupplierStatement(selectedSupplierObj)}
                              className="app-link underline text-[11px] font-black text-indigo-700 dark:text-indigo-400 cursor-pointer"
                              title="فتح كشف حساب المورد"
                            >
                              كشف حساب: {selectedSupplierObj.name_ar} (#
                              {selectedSupplierObj.account_code || "24010"})
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setIsAddingSupplier(!isAddingSupplier)}
                            className="app-link underline text-[11px] font-black text-teal-700 dark:text-teal-400 cursor-pointer"
                          >
                            {isAddingSupplier ? "إغلاق" : "+ إضافة مورد فوري"}
                          </button>
                        </div>
                      </div>
                      <select
                        value={selectedSupplierId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedSupplierId(val);
                          if (val) {
                            setSelectedCustomerId("");
                            const sup = suppliers.find((s) => s.id === val);
                            if (sup) setFormBeneficiary(sup.name_ar);
                          }
                        }}
                        className="w-full h-9 px-2 bg-background border border-input rounded-xl text-xs font-bold text-foreground"
                      >
                        <option value="">-- بدون مورد / اختر المورد --</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name_ar} — حساب #{s.account_code || "24010"}
                          </option>
                        ))}
                      </select>
                      {isAddingSupplier && (
                        <div className="flex items-center gap-1 pt-1">
                          <input
                            type="text"
                            value={newSupplierName}
                            onChange={(e) => setNewSupplierName(e.target.value)}
                            placeholder="اسم المورد الفوري..."
                            className="flex-1 h-8 px-2 bg-background border border-input rounded-lg text-xs font-bold"
                          />
                          <button
                            type="button"
                            onClick={handleCreateInlineSupplier}
                            className="btn-uniform-save h-8 px-2.5 rounded-lg text-xs font-black shrink-0 cursor-pointer"
                          >
                            حفظ
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Customer Field + Instant Customer Creation (Auto Level-4 Account) + Statement Link */}
                    <div className="sm:col-span-4 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <label className="text-[11px] font-black text-foreground flex items-center gap-1">
                          <Users className="w-3 h-3 text-teal-600" />
                          <span>العميل (نقدي / آجل)</span>
                        </label>
                        <div className="flex items-center gap-2">
                          {selectedCustomerObj && (
                            <button
                              type="button"
                              onClick={() => openCustomerStatement(selectedCustomerObj)}
                              className="app-link underline text-[11px] font-black text-indigo-700 dark:text-indigo-400 cursor-pointer"
                              title="فتح كشف حساب العميل"
                            >
                              كشف حساب: {selectedCustomerObj.name_ar} (#
                              {selectedCustomerObj.account_code || "13020"})
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setIsAddingCustomer(!isAddingCustomer)}
                            className="app-link underline text-[11px] font-black text-teal-700 dark:text-teal-400 cursor-pointer"
                          >
                            {isAddingCustomer ? "إغلاق" : "+ إضافة عميل فوري"}
                          </button>
                        </div>
                      </div>
                      <select
                        value={selectedCustomerId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedCustomerId(val);
                          if (val) {
                            setSelectedSupplierId("");
                            const cust = customers.find((c) => c.id === val);
                            if (cust) setFormBeneficiary(cust.name_ar);
                          }
                        }}
                        className="w-full h-9 px-2 bg-background border border-input rounded-xl text-xs font-bold text-foreground"
                      >
                        <option value="">-- بدون عميل / اختر العميل --</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name_ar} — حساب #{c.account_code || "13020"}
                          </option>
                        ))}
                      </select>
                      {isAddingCustomer && (
                        <div className="flex items-center gap-1 pt-1">
                          <input
                            type="text"
                            value={newCustomerName}
                            onChange={(e) => setNewCustomerName(e.target.value)}
                            placeholder="اسم العميل الفوري..."
                            className="flex-1 h-8 px-2 bg-background border border-input rounded-lg text-xs font-bold"
                          />
                          <button
                            type="button"
                            onClick={handleCreateInlineCustomer}
                            className="btn-uniform-save h-8 px-2.5 rounded-lg text-xs font-black shrink-0 cursor-pointer"
                          >
                            حفظ
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Total Invoice Value (For Full or Partial Credit Purchase / Sale) */}
                    <div className="sm:col-span-4 space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-black text-foreground">
                          إجمالي الفاتورة (للشراء أو البيع الآجل)
                        </label>
                        {computedRemainingCredit > 0 && (
                          <span className="text-[10px] font-mono font-black text-amber-700 dark:text-amber-400">
                            المتبقي آجل: {computedRemainingCredit.toLocaleString()} {formCurrency}
                          </span>
                        )}
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          isRestaurantPurchaseMode && purchaseItems.length > 0
                            ? Number(purchaseInvoiceTotal.toFixed(2))
                            : formInvoiceTotal
                        }
                        readOnly={isRestaurantPurchaseMode && purchaseItems.length > 0}
                        onChange={(e) => setFormInvoiceTotal(e.target.value)}
                        placeholder={formAmount || "نفس المبلغ (نقدي بالكامل)"}
                        dir="ltr"
                        className="w-full h-9 px-2.5 bg-background border border-input rounded-xl text-xs font-black font-mono text-left"
                      />
                    </div>
                  </div>

                  {/* Compact Restaurant Purchase Items Section (Only when category is Goods Purchase) */}
                  {isRestaurantPurchaseMode && (
                    <div className="bg-orange-500/[0.04] border border-orange-500/30 rounded-xl p-2.5 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                          <Package className="w-4 h-4 text-orange-600 shrink-0" />
                          <select
                            value={selectedInventoryIdToAdd}
                            onChange={(e) => handleAddInventoryItemLine(e.target.value)}
                            className="flex-1 h-8 px-2.5 bg-background border border-orange-500/30 rounded-lg text-xs font-bold"
                          >
                            <option value="">-- اختر صنفاً مخزنياً لإضافته للفاتورة --</option>
                            {inventoryItems.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name_ar} ({item.unit}) — الرصيد: {item.quantity}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => setIsAddingInventoryItem(!isAddingInventoryItem)}
                            className="app-link text-xs font-black text-orange-700 shrink-0"
                          >
                            {isAddingInventoryItem ? "إغلاق" : "+ صنف مخزني فوري"}
                          </button>
                        </div>

                        <div className="flex items-center gap-2 text-xs font-black">
                          <span>
                            إجمالي الفاتورة:{" "}
                            <b className="font-mono text-orange-700">
                              {purchaseInvoiceTotal.toLocaleString()} {formCurrency}
                            </b>
                          </span>
                          {computedRemainingCredit > 0 && (
                            <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 font-mono">
                              متبقي آجل للمورد ({selectedSupplierObj?.name_ar || "اختر المورد"}):{" "}
                              {computedRemainingCredit.toLocaleString()} {formCurrency}
                            </span>
                          )}
                        </div>
                      </div>

                      {isAddingInventoryItem && (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            placeholder="اسم الصنف الجديد..."
                            className="flex-1 h-8 px-2 bg-background border border-input rounded-lg text-xs font-bold"
                          />
                          <input
                            type="number"
                            value={newItemCost}
                            onChange={(e) => setNewItemCost(e.target.value)}
                            placeholder="سعر الوحدة"
                            className="w-24 h-8 px-2 bg-background border border-input rounded-lg text-xs font-mono font-bold"
                          />
                          <button
                            type="button"
                            onClick={handleCreateInlineInventoryItem}
                            className="btn-uniform-save h-8 px-3 rounded-lg text-xs font-black"
                          >
                            إضافة الصنف
                          </button>
                        </div>
                      )}

                      {purchaseItems.length > 0 && (
                        <div className="bg-background rounded-lg border border-orange-500/20 max-h-24 overflow-y-auto">
                          <table className="w-full text-right text-xs">
                            <thead className="bg-orange-500/10 text-[11px] font-black sticky top-0">
                              <tr>
                                <th className="py-1 px-2">الصنف</th>
                                <th className="py-1 px-2">الكمية</th>
                                <th className="py-1 px-2">السعر</th>
                                <th className="py-1 px-2">الإجمالي</th>
                                <th className="py-1 px-2 text-center">حذف</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {purchaseItems.map((row, idx) => (
                                <tr key={`${row.inventory_id}-${idx}`}>
                                  <td className="py-1 px-2 font-bold">
                                    {row.name_ar} ({row.unit})
                                  </td>
                                  <td className="py-1 px-2 w-24">
                                    <input
                                      type="number"
                                      min="0.01"
                                      step="0.01"
                                      value={row.quantity}
                                      onChange={(e) =>
                                        handleUpdatePurchaseItemRow(idx, "quantity", e.target.value)
                                      }
                                      className="w-full h-6 px-1.5 bg-muted/40 border border-input rounded font-mono font-black text-center"
                                    />
                                  </td>
                                  <td className="py-1 px-2 w-24">
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={row.unit_price}
                                      onChange={(e) =>
                                        handleUpdatePurchaseItemRow(
                                          idx,
                                          "unit_price",
                                          e.target.value,
                                        )
                                      }
                                      className="w-full h-6 px-1.5 bg-muted/40 border border-input rounded font-mono font-black text-center"
                                    />
                                  </td>
                                  <td className="py-1 px-2 font-mono font-black text-orange-600">
                                    {Number(row.total).toLocaleString()} {formCurrency}
                                  </td>
                                  <td className="py-1 px-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleRemovePurchaseItemRow(idx)}
                                      className="btn-uniform-delete p-1 rounded cursor-pointer"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Real Voucher Narrative Row 3: Statement ("البيان") + Live Printed Preview Sentence */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center pt-1">
                    <div className="sm:col-span-8 flex items-center gap-2">
                      <label className="text-xs font-black text-foreground shrink-0">
                        البيان:
                      </label>
                      <input
                        type="text"
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        placeholder={`بيان ${formType === "receipt" ? "سند القبض" : "سند الصرف"} (${DEPARTMENT_PRESETS[formDepartment].entityTitle})...`}
                        className="w-full h-9 px-3 bg-background border border-input rounded-xl text-xs font-bold"
                      />
                    </div>
                    <div className="sm:col-span-4 flex items-center gap-2">
                      <label className="text-xs font-black text-foreground shrink-0">
                        المستلم/المودع:
                      </label>
                      <input
                        type="text"
                        value={formBeneficiary}
                        onChange={(e) => setFormBeneficiary(e.target.value)}
                        placeholder="الاسم على السند..."
                        className="w-full h-9 px-2.5 bg-background border border-input rounded-xl text-xs font-bold"
                      />
                    </div>
                  </div>

                  {/* Live Printed-Slip Summary Line */}
                  <div className="px-3 py-2 rounded-xl bg-muted/60 border border-border text-xs font-bold text-foreground flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span>صيغة السند المطبوع: </span>
                      <strong className="font-black text-teal-800 dark:text-teal-300">
                        {formType === "payment" ? "دفعنا نحن" : "قبضنا نحن"}{" "}
                        {DEPARTMENT_PRESETS[formDepartment].entityTitle} مبلغ{" "}
                        {computedPaidAmount.toLocaleString()} بالعملة {formCurrency}{" "}
                        {formType === "payment" ? "من خزينة" : "إلى خزينة"}{" "}
                        {getTreasuryName(formTreasuryId)} بمعامل {formExchangeRate || 1}{" "}
                        {formType === "payment" ? "لـ" : "من"}{" "}
                        {selectedSupplierObj?.name_ar ||
                          selectedCustomerObj?.name_ar ||
                          formBeneficiary.trim() ||
                          formCategory}{" "}
                        رقم حساب #
                        {selectedSupplierObj?.account_code ||
                          selectedCustomerObj?.account_code ||
                          formAccountCode}
                      </strong>
                    </div>
                    {computedRemainingCredit > 0 && (
                      <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-900 dark:text-amber-300 font-black text-[11px]">
                        + متبقي آجل: {computedRemainingCredit.toLocaleString()} {formCurrency} على حساب{" "}
                        {selectedSupplierObj
                          ? `المورد (${selectedSupplierObj.name_ar} #${selectedSupplierObj.account_code})`
                          : selectedCustomerObj
                            ? `العميل (${selectedCustomerObj.name_ar} #${selectedCustomerObj.account_code})`
                            : "اختر المورد أو العميل"}
                      </span>
                    )}
                  </div>
                </div>

                {/* =========================================================== */}
                {/* THE 3 BOTTOM ACTIONS: إلغاء | حفظ كمسودة | حفظ وترحيل       */}
                {/* =========================================================== */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2.5">
                  <button
                    type="button"
                    onClick={handleRequestCancel}
                    className="btn-uniform-close px-5 py-2.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>إلغاء</span>
                  </button>

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleRequestSaveDraft}
                      className="btn-uniform-draft px-5 py-2.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <FileText className="w-4 h-4" />
                      <span>حفظ كمسودة</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleRequestPost}
                      className="btn-uniform-save px-6 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>حفظ وترحيل</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* =============================================================== */}
            {/* STEP 4: PRINTABLE VOUCHER VIEW AFTER SAVE & POST                */}
            {/* =============================================================== */}
            {wizardStep === "print_preview" && printedVoucherAfterPost && (
              <div className="p-5 sm:p-6 space-y-4">
                <div className="rounded-2xl border-2 border-teal-600/30 bg-teal-500/[0.04] p-4 sm:p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-base font-black text-foreground">
                          {printedVoucherAfterPost.type === "receipt"
                            ? "سند قبض معتمد ومرحّل"
                            : "سند صرف معتمد ومرحّل"}{" "}
                          #{printedVoucherAfterPost.reference_number}
                        </h4>
                        <span className="text-xs font-bold text-muted-foreground">
                          {new Date(printedVoucherAfterPost.created_at).toLocaleString("ar-EG")}
                        </span>
                      </div>
                    </div>

                    <div className="text-left">
                      <span className="text-lg font-black font-mono px-3.5 py-1.5 rounded-xl bg-card border border-border inline-block">
                        {Number(printedVoucherAfterPost.amount).toLocaleString()}{" "}
                        {printedVoucherAfterPost.currency}
                      </span>
                      {Number(printedVoucherAfterPost.remaining_credit || 0) > 0 && (
                        <div className="text-xs font-black text-amber-700 mt-1">
                          + متبقي آجل:{" "}
                          {Number(printedVoucherAfterPost.remaining_credit).toLocaleString()}{" "}
                          {printedVoucherAfterPost.currency}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-card p-3 rounded-xl border border-border">
                      <span className="text-muted-foreground block">الجهة / القسم</span>
                      <strong className="font-black text-foreground">
                        {getVoucherDepartmentPreset(printedVoucherAfterPost).entityTitle}
                      </strong>
                    </div>
                    <div className="bg-card p-3 rounded-xl border border-border">
                      <span className="text-muted-foreground block">البند</span>
                      <strong className="font-black text-foreground">
                        {printedVoucherAfterPost.category}
                      </strong>
                    </div>
                    <div className="bg-card p-3 rounded-xl border border-border">
                      <span className="text-muted-foreground block">الخزينة</span>
                      <strong className="font-black text-foreground">
                        {getTreasuryName(printedVoucherAfterPost.treasury_id)}
                      </strong>
                    </div>
                    <div className="bg-card p-3 rounded-xl border border-border">
                      <span className="text-muted-foreground block">رقم القيد</span>
                      <strong className="font-mono font-black text-indigo-600">
                        {printedVoucherAfterPost.journal_reference || "مرحّل"}
                      </strong>
                    </div>
                  </div>

                  <div className="bg-card p-3 rounded-xl border border-border text-xs flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-muted-foreground">البيان: </span>
                      <strong className="text-foreground">
                        {printedVoucherAfterPost.description}
                      </strong>
                    </div>
                    {(printedVoucherAfterPost.supplier_name ||
                      printedVoucherAfterPost.customer_name ||
                      printedVoucherAfterPost.beneficiary) && (
                      <div>
                        <span className="text-muted-foreground">الطرف المقابل: </span>
                        <strong className="text-foreground">
                          {printedVoucherAfterPost.supplier_name ||
                            printedVoucherAfterPost.customer_name ||
                            printedVoucherAfterPost.beneficiary}
                        </strong>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      resetWizardToStart();
                      if (mode !== "operations") setIsAddModalOpen(false);
                    }}
                    className="btn-uniform-close px-5 py-2.5 rounded-xl font-black text-xs cursor-pointer"
                  >
                    إصدار سند جديد (العودة للبداية)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handlePrintSingleVoucher(printedVoucherAfterPost);
                      resetWizardToStart();
                      if (mode !== "operations") setIsAddModalOpen(false);
                    }}
                    className="btn-uniform-print px-6 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center gap-2 shadow-md cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>طباعة السند والبدء بسند جديد</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* CONFIRMATION DIALOG FOR CANCEL / DRAFT / SAVE & POST                  */}
      {/* ===================================================================== */}
      {confirmAction && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-md overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                {confirmAction === "cancel" ? (
                  <AlertCircle className="w-5 h-5 text-slate-600" />
                ) : confirmAction === "draft" ? (
                  <FileText className="w-5 h-5 text-amber-600" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-teal-600" />
                )}
                <h3 className="text-sm sm:text-base font-black text-foreground">
                  {confirmAction === "cancel"
                    ? "تأكيد إلغاء إدخال السند"
                    : confirmAction === "draft"
                      ? "تأكيد حفظ السند كمسودة"
                      : `تأكيد حفظ وترحيل ${formType === "receipt" ? "سند القبض" : "سند الصرف"}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="btn-uniform-close w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black cursor-pointer"
              >
                ✕
              </button>
            </div>

            {confirmAction === "cancel" ? (
              <p className="text-xs font-bold text-muted-foreground">
                هل تريد إلغاء البيانات المدخلة والعودة إلى بداية اختيار نوع السند؟
              </p>
            ) : (
              <div className="bg-muted/40 rounded-xl p-3.5 border border-border space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-bold">الجهة والنوع:</span>
                  <span className="font-black text-foreground">
                    {DEPARTMENT_PRESETS[formDepartment].entityTitle} —{" "}
                    {formType === "receipt" ? "سند قبض" : "سند صرف"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-bold">البند والحساب:</span>
                  <span className="font-black text-foreground">
                    {formCategory} (#{formAccountCode})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-bold">
                    {formType === "payment" ? "المبلغ المدفوع الآن:" : "المبلغ المقبوض الآن:"}
                  </span>
                  <span className="font-mono font-black text-sm text-teal-700 dark:text-teal-400">
                    {Number(computedPaidAmount || 0).toLocaleString()} {formCurrency}
                  </span>
                </div>
                {computedRemainingCredit > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground font-bold">إجمالي الفاتورة:</span>
                      <span className="font-mono font-black text-foreground">
                        {Number(computedInvoiceTotal).toLocaleString()} {formCurrency}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-900 dark:text-amber-200 font-black text-xs leading-relaxed">
                      تأكيد المعاملة الآجلة: هل المبلغ الباقي (
                      {computedRemainingCredit.toLocaleString()} {formCurrency}) سيكون{" "}
                      {formType === "payment" ? "شراء آجل" : "بيع آجل"} ينضم لحساب{" "}
                      {selectedSupplierObj
                        ? `المورد (${selectedSupplierObj.name_ar} - حساب #${selectedSupplierObj.account_code})`
                        : `العميل (${selectedCustomerObj?.name_ar} - حساب #${selectedCustomerObj?.account_code})`}
                      ؟
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-bold">الخزينة:</span>
                  <span className="font-black text-foreground">
                    {getTreasuryName(formTreasuryId)}
                  </span>
                </div>
                {(selectedSupplierObj || selectedCustomerObj || formBeneficiary.trim()) && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-bold">الطرف المقابل:</span>
                    <span className="font-black text-foreground">
                      {selectedSupplierObj?.name_ar ||
                        selectedCustomerObj?.name_ar ||
                        formBeneficiary}
                    </span>
                  </div>
                )}
                {confirmAction === "post" && isExceedingTreasuryBalance && (
                  <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 font-black text-[11px]">
                    تنبيه: مبلغ الصرف النقدي أكبر من الرصيد الحالي في الخزينة المختارة.
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="btn-uniform-close px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                تراجع
              </button>

              {confirmAction === "cancel" && (
                <button
                  type="button"
                  onClick={handleExecuteCancel}
                  className="btn-uniform-close px-5 py-2 rounded-xl text-xs font-black cursor-pointer"
                >
                  تأكيد الإلغاء
                </button>
              )}

              {confirmAction === "draft" && (
                <button
                  type="button"
                  onClick={handleExecuteSaveDraft}
                  className="btn-uniform-draft px-5 py-2 rounded-xl text-xs font-black cursor-pointer"
                >
                  تأكيد حفظ المسودة
                </button>
              )}

              {confirmAction === "post" && (
                <button
                  type="button"
                  onClick={() => handleSaveDocument(true)}
                  className="btn-uniform-save px-5 py-2 rounded-xl text-xs font-black cursor-pointer"
                >
                  تأكيد الحفظ والترحيل
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUPPLIER / CUSTOMER ACCOUNT STATEMENT MODAL (كشف حساب المورد / العميل) */}
      {/* ===================================================================== */}
      {statementTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-card rounded-3xl shadow-2xl border border-border w-full max-w-4xl overflow-hidden flex flex-col max-h-[88vh]">
            <div className="px-6 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  {statementTarget.kind === "supplier" ? (
                    <Truck className="w-5 h-5 text-orange-400" />
                  ) : (
                    <Users className="w-5 h-5 text-teal-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-black">
                    كشف حساب {statementTarget.kind === "supplier" ? "المورد" : "العميل"}:{" "}
                    {statementTarget.name_ar}
                  </h3>
                  <p className="text-xs text-slate-300 font-mono">
                    رقم الحساب المحاسبي (المستوى 4): #{statementTarget.account_code}
                    {statementTarget.phone ? ` | الهاتف: ${statementTarget.phone}` : ""}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStatementTarget(null)}
                className="btn-uniform-close px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer"
              >
                إغلاق ✕
              </button>
            </div>

            {(() => {
              const targetCode = statementTarget.account_code;
              const isSup = statementTarget.kind === "supplier";
              const openingBal = Number(statementTarget.opening_balance || 0);

              // Gather all journal lines that hit targetCode OR vouchers linked to this supplier/customer
              const statementRows: Array<{
                date: string;
                ref: string;
                description: string;
                debit: number;
                credit: number;
                currency: string;
              }> = [];

              if (openingBal !== 0) {
                statementRows.push({
                  date: "رصيد افتتاحي",
                  ref: "OPEN-BAL",
                  description: "الرصيد الافتتاحي المسجل للحساب",
                  debit: !isSup && openingBal > 0 ? openingBal : isSup && openingBal < 0 ? Math.abs(openingBal) : 0,
                  credit: isSup && openingBal > 0 ? openingBal : !isSup && openingBal < 0 ? Math.abs(openingBal) : 0,
                  currency: formCurrency || "EGP",
                });
              }

              const sortedEntries = [...journalEntries].sort((a, b) =>
                String(a.date || "").localeCompare(String(b.date || "")),
              );

              sortedEntries.forEach((je) => {
                (je.lines || []).forEach((line: any) => {
                  if (String(line.account_code) === String(targetCode)) {
                    statementRows.push({
                      date: je.date || "",
                      ref: je.reference || je.id,
                      description: line.description || je.description || "",
                      debit: Number(line.debit || 0),
                      credit: Number(line.credit || 0),
                      currency: line.currency || je.currency || "EGP",
                    });
                  }
                });
              });

              // Also include any direct vouchers linked by supplier_id/customer_id that didn't hit targetCode directly (e.g., 100% cash purchase where user still wants to see invoice in supplier history)
              vouchers
                .filter(
                  (v) =>
                    !v.deleted &&
                    !v.reverted &&
                    ((isSup &&
                      (v.supplier_id === statementTarget.id ||
                        v.supplier_name === statementTarget.name_ar)) ||
                      (!isSup &&
                        (v.customer_id === statementTarget.id ||
                          v.customer_name === statementTarget.name_ar))),
                )
                .forEach((v) => {
                  const alreadyInJe = statementRows.some(
                    (r) => r.ref === v.journal_reference || r.ref === v.reference_number,
                  );
                  if (!alreadyInJe) {
                    const invTotal = Number(v.invoice_total ?? v.amount ?? 0);
                    const paidNow = Number(v.amount ?? 0);
                    statementRows.push({
                      date: v.created_at.slice(0, 10),
                      ref: v.reference_number || v.id.substring(0, 8),
                      description: `${v.category} — ${v.description} (فاتورة نقدية مسددة بالكامل)`,
                      debit: isSup ? paidNow : invTotal,
                      credit: isSup ? invTotal : paidNow,
                      currency: v.currency || "EGP",
                    });
                  }
                });

              let runningBal = 0;
              let totalDebit = 0;
              let totalCredit = 0;

              const enrichedRows = statementRows.map((r) => {
                totalDebit += r.debit;
                totalCredit += r.credit;
                // For Supplier (Liability): Credit increases balance owed to supplier, Debit decreases it
                // For Customer (Asset): Debit increases balance owed by customer, Credit decreases it
                runningBal += isSup ? r.credit - r.debit : r.debit - r.credit;
                return {
                  ...r,
                  runningBalance: Number(runningBal.toFixed(2)),
                };
              });

              const handlePrintStatement = () => {
                printProfessionalReport({
                  title: `كشف حساب تفصيلي — ${isSup ? "المورد" : "العميل"}: ${statementTarget.name_ar}`,
                  subtitle: `رقم الحساب: #${statementTarget.account_code} | تاريخ الكشف: ${new Date().toLocaleString("ar-EG")}`,
                  summaryCards: [
                    { label: "إجمالي المدين (Debit)", value: totalDebit.toLocaleString() },
                    { label: "إجمالي الدائن (Credit)", value: totalCredit.toLocaleString() },
                    {
                      label: isSup ? "صافي المستحق للمورد" : "صافي المستحق على العميل",
                      value: runningBal.toLocaleString(),
                    },
                  ],
                  columns: [
                    "#",
                    "التاريخ",
                    "رقم المرجع / القيد",
                    "البيان التفصيلي",
                    "مدين (Debit)",
                    "دائن (Credit)",
                    "الرصيد التراكمي",
                    "العملة",
                  ],
                  rows: enrichedRows.map((r, i) => [
                    String(i + 1),
                    r.date,
                    r.ref,
                    r.description,
                    r.debit.toLocaleString(),
                    r.credit.toLocaleString(),
                    r.runningBalance.toLocaleString(),
                    r.currency,
                  ]),
                });
              };

              const handleExportStatementExcel = () => {
                exportRowsToExcelCsv(
                  `كشف_حساب_${statementTarget.name_ar}_${statementTarget.account_code}.csv`,
                  [
                    "التاريخ",
                    "رقم المرجع / القيد",
                    "البيان التفصيلي",
                    "مدين (Debit)",
                    "دائن (Credit)",
                    "الرصيد التراكمي",
                    "العملة",
                  ],
                  enrichedRows.map((r) => [
                    r.date,
                    r.ref,
                    r.description,
                    String(r.debit),
                    String(r.credit),
                    String(r.runningBalance),
                    r.currency,
                  ]),
                );
                toast.success("تم تصدير كشف الحساب إلى ملف إكسيل بنجاح");
              };

              return (
                <>
                  <div className="p-5 space-y-4 overflow-y-auto flex-1">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-muted/40 p-3.5 rounded-2xl border border-border">
                        <span className="text-xs font-bold text-muted-foreground block">
                          إجمالي المدين (Debit)
                        </span>
                        <strong className="text-lg font-black font-mono text-emerald-600">
                          {totalDebit.toLocaleString()}
                        </strong>
                      </div>
                      <div className="bg-muted/40 p-3.5 rounded-2xl border border-border">
                        <span className="text-xs font-bold text-muted-foreground block">
                          إجمالي الدائن (Credit)
                        </span>
                        <strong className="text-lg font-black font-mono text-amber-600">
                          {totalCredit.toLocaleString()}
                        </strong>
                      </div>
                      <div className="bg-indigo-500/10 p-3.5 rounded-2xl border border-indigo-500/30">
                        <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 block">
                          {isSup ? "صافي الرصيد المستحق للمورد" : "صافي الرصيد المستحق على العميل"}
                        </span>
                        <strong className="text-lg font-black font-mono text-indigo-700 dark:text-indigo-300">
                          {runningBal.toLocaleString()}
                        </strong>
                      </div>
                    </div>

                    <div className="border border-border rounded-2xl overflow-hidden">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-900 text-white font-black">
                          <tr>
                            <th className="py-2.5 px-3">التاريخ</th>
                            <th className="py-2.5 px-3">المرجع / القيد</th>
                            <th className="py-2.5 px-3">البيان التفصيلي</th>
                            <th className="py-2.5 px-3">مدين (Debit)</th>
                            <th className="py-2.5 px-3">دائن (Credit)</th>
                            <th className="py-2.5 px-3">الرصيد التراكمي</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {enrichedRows.length === 0 ? (
                            <tr>
                              <td
                                colSpan={6}
                                className="py-8 text-center text-muted-foreground font-bold"
                              >
                                لا توجد حركات مسجلة على هذا الحساب حتى الآن
                              </td>
                            </tr>
                          ) : (
                            enrichedRows.map((row, idx) => (
                              <tr key={idx} className="hover:bg-muted/40">
                                <td className="py-2 px-3 font-mono font-bold">{row.date}</td>
                                <td className="py-2 px-3 font-mono font-black text-indigo-600">
                                  {row.ref}
                                </td>
                                <td className="py-2 px-3 font-bold text-foreground">
                                  {row.description}
                                </td>
                                <td className="py-2 px-3 font-mono font-black text-emerald-600">
                                  {row.debit > 0 ? `${row.debit.toLocaleString()} ${row.currency}` : "—"}
                                </td>
                                <td className="py-2 px-3 font-mono font-black text-amber-600">
                                  {row.credit > 0
                                    ? `${row.credit.toLocaleString()} ${row.currency}`
                                    : "—"}
                                </td>
                                <td className="py-2 px-3 font-mono font-black text-foreground">
                                  {row.runningBalance.toLocaleString()} {row.currency}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="px-6 py-3.5 bg-muted/40 border-t border-border flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setStatementTarget(null)}
                      className="btn-uniform-close px-5 py-2 rounded-xl text-xs font-black cursor-pointer"
                    >
                      إغلاق
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleExportStatementExcel}
                        className="btn-uniform-excel px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>طباعة إكسيل (Excel)</span>
                      </button>
                      <button
                        type="button"
                        onClick={handlePrintStatement}
                        className="btn-uniform-print px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-4 h-4" />
                        <span>طباعة كشف الحساب</span>
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
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
                className="btn-uniform-close w-8 h-8 rounded-full flex items-center justify-center font-bold cursor-pointer"
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
                  className="btn-uniform-print px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  طباعة السند
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedVoucherForJournal(null)}
                  className="btn-uniform-close px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
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
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVoucherForAudit(null)}
                className="btn-uniform-close w-8 h-8 rounded-full flex items-center justify-center font-bold cursor-pointer"
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
                  className="btn-uniform-close px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
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
            <div className="flex items-center gap-3 text-red-700">
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
                className="btn-uniform-close px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={handleConfirmRevert}
                className="btn-uniform-delete px-4 py-2 rounded-xl text-xs font-black cursor-pointer"
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
            <div className="flex items-center gap-3 text-red-700">
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
                className="btn-uniform-close px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="btn-uniform-delete px-4 py-2 rounded-xl text-xs font-black cursor-pointer"
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
