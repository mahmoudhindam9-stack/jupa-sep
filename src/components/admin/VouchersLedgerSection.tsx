import React, { useState, useMemo } from "react";
import {
  erpStore,
  isLevel4Account,
  type Voucher,
  type JournalEntry,
  type Treasury,
} from "@/shared/services/erpStore";
import { AccountSearchSelect } from "@/components/AccountSearchSelect";
import {
  printAccountingDocument,
  printJournalEntryDocument,
} from "@/shared/utils/printAccountingDocument";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  PlusCircle,
  Printer,
  RotateCcw,
  Trash2,
  Eye,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Layers,
  Sparkles,
  Calendar,
  Building2,
  CreditCard,
  Wallet,
  ShieldAlert,
  Save,
  Check,
  X,
  RefreshCw,
  ExternalLink,
  Landmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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

const CURRENCY_OPTIONS = [
  { code: "USD", name: "الدولار الأمريكي (USD)", symbol: "$" },
  { code: "EGP", name: "الجنيه المصري (EGP)", symbol: "ج.م" },
  { code: "SAR", name: "الريال السعودي (SAR)", symbol: "ر.س" },
  { code: "AED", name: "الدرهم الإماراتي (AED)", symbol: "د.إ" },
  { code: "EUR", name: "اليورو الأوروبي (EUR)", symbol: "€" },
  { code: "IQD", name: "الدينار العراقي (IQD)", symbol: "د.ع" },
  { code: "KWD", name: "الدينار الكويتي (KWD)", symbol: "د.ك" },
  { code: "GBP", name: "الجنيه الإسترليني (GBP)", symbol: "£" },
];

const PAYMENT_CATEGORIES = [
  "رواتب وأجور الموظفين",
  "إيجار العقارات والفروع",
  "كهرباء ومياه وطاقة",
  "دعاية، إعلانات وتسويق",
  "صيانة وتشغيل ومعدات",
  "مستلزمات هدر وتغليف",
  "مصروفات نثرية وإدارية",
  "ضيافة ونظافة",
  "شراء خامات ومواد",
  "أخرى (تحديد يدوي)",
];

const RECEIPT_CATEGORIES = [
  "إيرادات تشغيل بوفيهات وحفلات خارجية",
  "حقوق ملكية ورأسمال مضاف",
  "مبيعات فرعية وتدوير مخلفات",
  "تسوية عهد وأمانات",
  "إيرادات استثمارية وتمويلية",
  "أخرى (تحديد يدوي)",
];

const DEFAULT_CATEGORY_LEVEL4_ACCOUNTS: Record<string, string> = {
  // Expenses (Payments) - Level 4 Operational Accounts
  "رواتب وأجور الموظفين": "31010110", // اجور ومرتبات ومكافاءات
  "رواتب الموظفين": "31010110",
  "إيجار العقارات والفروع": "31010140", // ايجار معدات وعقارات
  "إيجار الفروع": "31010140",
  "كهرباء ومياه وطاقة": "31010145", // مصروفات شحن كهرباء
  "الكهرباء والمياه": "31010145",
  "الكهرباء والمياه والطاقة": "31010145",
  "دعاية، إعلانات وتسويق": "31020310", // دعاية واعلان
  "الدعاية والتسويق": "31020310",
  "صيانة وتشغيل ومعدات": "31010170", // صيانة عامة
  "صيانة وتشغيل": "31010170",
  "مستلزمات هدر وتغليف": "31010160", // متنوعة واكراميات
  "مصروفات نثرية وإدارية": "31010160",
  "ضيافة ونظافة": "31010160",
  "شراء خامات ومواد": "31010100", // سولار ومواد خام

  // Revenues (Receipts) - Level 4 Operational Accounts
  "إيرادات تشغيل بوفيهات وحفلات خارجية": "43020300", // ايرادات كافيتريا - سنترال بوب
  "إيراد تشغيل حفلات": "43020300",
  "حقوق ملكية ورأسمال مضاف": "41020100", // ايرادات تاجير محلات المول
  "رأسمال إضافي": "41020100",
  "مبيعات فرعية وتدوير مخلفات": "43020200", // ايرادات تذاكر ومبيعات فرعية
  "بيع مخلفات المطبخ": "43020200",
  "تسوية عهد وأمانات": "41010110", // ايراد ايجار ارض / تسويات
  "إيرادات استثمارية وتمويلية": "41010100", // فرق تحويل عملات
};

export interface VouchersLedgerSectionProps {
  onNavigateToJournal?: (reference?: string) => void;
}

export function VouchersLedgerSection({ onNavigateToJournal }: VouchersLedgerSectionProps) {
  const { toast } = useToast();
  const [erpState, setErpState] = useState(() => erpStore.getState());

  // Listen to store updates
  React.useEffect(() => {
    return erpStore.subscribe(() => {
      setErpState(erpStore.getState());
    });
  }, []);

  const currentBranch = erpState.branches.find((b) => b.id === erpState.currentBranchId) ||
    erpState.branches[0] || { id: "branch-1", name_ar: "الفرع الرئيسي" };

  // Form State
  const [voucherType, setVoucherType] = useState<"payment" | "receipt">("payment");
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [exchangeRate, setExchangeRate] = useState<string>("1");
  const [amount, setAmount] = useState<string>("");
  const [accountCode, setAccountCode] = useState<string>("31010110");
  const [categorySelect, setCategorySelect] = useState<string>("رواتب وأجور الموظفين");
  const [customCategory, setCustomCategory] = useState<string>("");
  const [costCenterSelect, setCostCenterSelect] = useState<string>("الإدارة (Administration)");
  const [customCostCenter, setCustomCostCenter] = useState<string>("");
  const [treasuryId, setTreasuryId] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [beneficiary, setBeneficiary] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Level 4 Accounts Only (Operational / Transactional)
  const level4Accounts = useMemo(() => {
    return (erpState.accounts || []).filter(isLevel4Account);
  }, [erpState.accounts]);

  // Selected Level 4 Account details
  const selectedAccount = useMemo(() => {
    return (erpState.accounts || []).find((a) => a.code === accountCode);
  }, [erpState.accounts, accountCode]);

  // Auto-sync rate when currency changes
  React.useEffect(() => {
    if (selectedCurrency === "USD") {
      setExchangeRate("1");
    } else {
      const defaultRate = erpStore.getExchangeRate(selectedCurrency);
      setExchangeRate(defaultRate ? String(defaultRate) : "1");
    }
  }, [selectedCurrency]);

  // Adjust default category and level 4 account when voucher type toggles
  React.useEffect(() => {
    if (voucherType === "payment") {
      setCategorySelect("رواتب وأجور الموظفين");
      setAccountCode("31010110");
    } else {
      setCategorySelect("إيرادات تشغيل بوفيهات وحفلات خارجية");
      setAccountCode("43020300");
    }
  }, [voucherType]);

  // When category changes, auto-suggest level 4 account
  const handleCategoryChange = (newCat: string) => {
    setCategorySelect(newCat);
    if (DEFAULT_CATEGORY_LEVEL4_ACCOUNTS[newCat]) {
      setAccountCode(DEFAULT_CATEGORY_LEVEL4_ACCOUNTS[newCat]);
    }
  };

  // Table filters & search
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "payment" | "receipt">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "reverted" | "deleted">(
    "all",
  );
  const [showDeletedAudit, setShowDeletedAudit] = useState(false);

  // Modals
  const [isConfirmPostOpen, setIsConfirmPostOpen] = useState(false);
  const [postedEntryModalData, setPostedEntryModalData] = useState<{
    voucher: Voucher;
    journalEntry?: JournalEntry | null;
  } | null>(null);

  const [viewEntryModalData, setViewEntryModalData] = useState<{
    voucher: Voucher;
    journalEntry?: JournalEntry | null;
  } | null>(null);

  // Revert Modal
  const [voucherToRevert, setVoucherToRevert] = useState<Voucher | null>(null);
  const [revertReason, setRevertReason] = useState("");

  // Delete Modal
  const [voucherToDelete, setVoucherToDelete] = useState<Voucher | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  // Filtered treasuries for branch
  const activeTreasuries = useMemo(() => {
    return erpState.treasuries.filter(
      (t) => (t.branch_id === currentBranch.id || !t.branch_id) && !t.deleted,
    );
  }, [erpState.treasuries, currentBranch.id]);

  // Set default treasury if not selected
  React.useEffect(() => {
    if (!treasuryId && activeTreasuries.length > 0) {
      setTreasuryId(activeTreasuries[0].id);
    }
  }, [activeTreasuries, treasuryId]);

  // Computed Vouchers
  const allVouchers = useMemo(() => erpState.vouchers || [], [erpState.vouchers]);

  const filteredVouchers = useMemo(() => {
    return allVouchers.filter((v) => {
      // Branch filter
      if (v.branch_id && v.branch_id !== currentBranch.id) return false;

      // Deleted toggle
      if (!showDeletedAudit && v.deleted) return false;
      if (showDeletedAudit && statusFilter === "deleted" && !v.deleted) return false;

      // Type filter
      if (typeFilter !== "all" && v.type !== typeFilter) return false;

      // Status filter
      if (statusFilter === "active" && (v.deleted || v.reverted)) return false;
      if (statusFilter === "reverted" && !v.reverted) return false;
      if (statusFilter === "deleted" && !v.deleted) return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchId = v.id.toLowerCase().includes(q);
        const matchDesc = (v.description || "").toLowerCase().includes(q);
        const matchCat = (v.category || "").toLowerCase().includes(q);
        const matchCc = (v.cost_center || "").toLowerCase().includes(q);
        const matchRef = (v.journal_reference || "").toLowerCase().includes(q);
        if (!matchId && !matchDesc && !matchCat && !matchCc && !matchRef) return false;
      }

      return true;
    });
  }, [allVouchers, currentBranch.id, showDeletedAudit, typeFilter, statusFilter, searchQuery]);

  // Summary Metrics
  const metrics = useMemo(() => {
    let totalPaymentsUSD = 0;
    let totalReceiptsUSD = 0;
    let paymentsCount = 0;
    let receiptsCount = 0;
    let revertedCount = 0;
    let deletedCount = 0;

    for (const v of allVouchers) {
      if (v.branch_id && v.branch_id !== currentBranch.id) continue;
      if (v.deleted) {
        deletedCount++;
        continue;
      }
      if (v.reverted) {
        revertedCount++;
        continue;
      }
      const baseVal =
        v.base_amount || (v.currency === "USD" ? v.amount : v.amount / (v.exchange_rate || 1));
      if (v.type === "payment") {
        totalPaymentsUSD += baseVal;
        paymentsCount++;
      } else if (v.type === "receipt") {
        totalReceiptsUSD += baseVal;
        receiptsCount++;
      }
    }

    return {
      totalPaymentsUSD,
      totalReceiptsUSD,
      netUSD: totalReceiptsUSD - totalPaymentsUSD,
      paymentsCount,
      receiptsCount,
      revertedCount,
      deletedCount,
      activeCount: paymentsCount + receiptsCount,
    };
  }, [allVouchers, currentBranch.id]);

  // Form final values
  const effectiveCategory =
    categorySelect === "أخرى (تحديد يدوي)" ? customCategory.trim() : categorySelect;
  const effectiveCostCenter =
    costCenterSelect === "أخرى (تحديد يدوي)" ? customCostCenter.trim() : costCenterSelect;
  const numAmount = Number(amount) || 0;
  const numRate = Number(exchangeRate) || 1;
  const equivalentUSD =
    selectedCurrency === "USD" ? numAmount : numRate > 0 ? numAmount / numRate : 0;

  // Validate and open confirmation
  const handleInitiateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!numAmount || numAmount <= 0) {
      toast({
        title: "خطأ في المبلغ",
        description: "يرجى إدخال مبلغ مالي صحيح أكبر من الصفر.",
        variant: "destructive",
      });
      return;
    }
    if (!treasuryId) {
      toast({
        title: "اختر الخزينة",
        description: "يرجى اختيار خزينة الصرف أو القبض.",
        variant: "destructive",
      });
      return;
    }
    if (!effectiveCategory) {
      toast({
        title: "حدد التصنيف",
        description: "يرجى اختيار أو كتابة التصنيف المالي.",
        variant: "destructive",
      });
      return;
    }
    if (!effectiveCostCenter) {
      toast({
        title: "حدد مركز التكلفة",
        description: "يرجى تحديد أو كتابة مركز التكلفة المسؤول.",
        variant: "destructive",
      });
      return;
    }
    if (!accountCode) {
      toast({
        title: "حدد الحساب المحاسبي",
        description: "يرجى اختيار رقم الحساب المحاسبي المتأثر من حسابات الدرجة الرابعة.",
        variant: "destructive",
      });
      return;
    }

    const accObj = (erpState.accounts || []).find((a) => a.code === accountCode);
    if (!accObj || !isLevel4Account(accObj)) {
      toast({
        title: "حساب غير مصرح به",
        description:
          "يجب اختيار حساب تشغيلي من الدرجة الرابعة حصراً لإنشاء السند والترحيل المحاسبي.",
        variant: "destructive",
      });
      return;
    }

    if (!description.trim()) {
      toast({
        title: "أدخل البيان",
        description: "يرجى كتابة شرح وبيان تفصيلي للسند المالي.",
        variant: "destructive",
      });
      return;
    }

    setIsConfirmPostOpen(true);
  };

  // Confirm Save & Post to General Ledger
  const handleConfirmSaveAndPost = () => {
    try {
      const fullDescription = beneficiary.trim()
        ? `[المستفيد/المستلم: ${beneficiary.trim()}] - ${description.trim()}`
        : description.trim();

      const result = erpStore.createVoucher(
        voucherType,
        effectiveCategory,
        numAmount,
        treasuryId,
        fullDescription,
        effectiveCostCenter,
        notes.trim() || undefined,
        selectedCurrency,
        selectedCurrency === "USD" ? 1 : numRate,
        accountCode,
      );

      setIsConfirmPostOpen(false);

      // Find the created entry if any
      const createdEntry =
        (result as any)?.journal_entry ||
        erpStore
          .getState()
          .journalEntries.find(
            (je) =>
              je.id === (result as any).journal_entry_id ||
              je.reference === (result as any).journal_reference,
          );

      setPostedEntryModalData({
        voucher: result as Voucher,
        journalEntry: createdEntry,
      });

      // Reset form
      setAmount("");
      setDescription("");
      setBeneficiary("");
      setNotes("");
      setCustomCategory("");
      setCustomCostCenter("");

      toast({
        title: "تم حفظ وترحيل السند بنجاح!",
        description: `تم توليد السند وقيد اليومية العام رقم (${(result as any).journal_reference || "المتولد"}) وترحيله فوراً إلى دفتر الأستاذ.`,
      });
    } catch (err: any) {
      toast({
        title: "تعذر حفظ وترحيل السند",
        description: err?.message || "حدث خطأ غير متوقع أثناء ترحيل القيد المحاسبي.",
        variant: "destructive",
      });
    }
  };

  // Handle Revert Voucher
  const handleConfirmRevert = () => {
    if (!voucherToRevert) return;
    if (!revertReason.trim()) {
      toast({
        title: "سبب الإرجاع مطلوب",
        description: "يرجى تدوين سبب إرجاع وعكس السند المالي.",
        variant: "destructive",
      });
      return;
    }

    try {
      erpStore.revertVoucher(voucherToRevert.id, revertReason.trim());
      setVoucherToRevert(null);
      setRevertReason("");
      toast({
        title: "تم إرجاع وعكس السند بنجاح",
        description: "تم إنشاء قيد عكسي تسوية في دفتر الأستاذ وتحديث أرصدة الخزينة والحسابات.",
      });
    } catch (err: any) {
      toast({
        title: "تعذر إرجاع السند",
        description: err?.message || "حدث خطأ أثناء إجراء عملية العكس.",
        variant: "destructive",
      });
    }
  };

  // Handle Delete Voucher
  const handleConfirmDelete = () => {
    if (!voucherToDelete) return;
    if (!deleteReason.trim()) {
      toast({
        title: "سبب الحذف إلزامي",
        description: "لأغراض التدقيق المالي، يجب تدوين سبب الحذف ليتم حفظه في سجل العمليات.",
        variant: "destructive",
      });
      return;
    }

    try {
      erpStore.deleteVoucher(voucherToDelete.id, deleteReason.trim());
      setVoucherToDelete(null);
      setDeleteReason("");
      toast({
        title: "تم حذف السند المالي وتسجيل الحركة",
        description:
          "تم نقل السند إلى سجل المحذوفات وتوثيق العملية في سجل التدقيق والرقابة المالية.",
      });
    } catch (err: any) {
      toast({
        title: "تعذر حذف السند",
        description: err?.message || "حدث خطأ أثناء الحذف.",
        variant: "destructive",
      });
    }
  };

  // Find related journal entry for viewing
  const handleViewJournalEntry = (voucher: Voucher) => {
    const entry = erpStore
      .getState()
      .journalEntries.find(
        (je) =>
          je.id === voucher.journal_entry_id ||
          je.reference === voucher.journal_reference ||
          (voucher.journal_reference && je.reference?.endsWith(voucher.journal_reference)) ||
          je.reference?.endsWith(voucher.id.substring(4, 9).toUpperCase()),
      );
    setViewEntryModalData({
      voucher,
      journalEntry: entry || null,
    });
  };

  // Print Official Voucher
  const handlePrintVoucher = (voucher: Voucher) => {
    const treasury = erpState.treasuries.find((t) => t.id === voucher.treasury_id);
    const dateFormatted = voucher.created_at
      ? voucher.created_at.replace("T", " ").slice(0, 19)
      : "-";
    const isPayment = voucher.type === "payment";

    printAccountingDocument({
      title: isPayment ? "سند صرف نقدية ومصروفات رسمي" : "سند قبض إيرادات وتحصيل رسمي",
      subtitle: `فرع: ${currentBranch.name_ar} | رقم السند: ${voucher.id.toUpperCase()} | رقم القيد: ${voucher.journal_reference || "آلي"}`,
      documentNo: voucher.journal_reference || voucher.id.toUpperCase(),
      columns: [
        { key: "field", label: "البيان المحاسبي", align: "right" },
        { key: "value", label: "التفاصيل والقيم", align: "right" },
      ],
      rows: [
        { field: "نوع المستند", value: isPayment ? "سند صرف (-)" : "سند قبض (+)" },
        {
          field: "الحساب المحاسبي (درجة رابعة)",
          value: voucher.account_code
            ? `${voucher.account_code} - ${erpStore.getAccountName(voucher.account_code)}`
            : "حساب تشغيلي",
        },
        { field: "التصنيف والتبويب المالي", value: voucher.category },
        { field: "مركز التكلفة", value: voucher.cost_center || "الإدارة العامة" },
        {
          field: "المبلغ المعتمد",
          value: `${Number(voucher.amount).toLocaleString()} ${voucher.currency} ${
            voucher.currency !== "USD" && voucher.exchange_rate
              ? `(سعر الصرف: ${voucher.exchange_rate} | المعادل: $${Number(voucher.base_amount || voucher.amount / voucher.exchange_rate).toFixed(2)} USD)`
              : ""
          }`,
        },
        {
          field: "الخزينة والحساب المالي",
          value: treasury
            ? `${treasury.name_ar} [${treasury.account_code || "101000"}]`
            : "الخزينة المعتمدة",
        },
        { field: "البيان والشرح", value: voucher.description || "-" },
        { field: "تاريخ ووقت القيد", value: dateFormatted },
        {
          field: "حالة الترحيل",
          value: voucher.reverted
            ? "معكوس ومسوى"
            : voucher.deleted
              ? "محذوف"
              : "مرحل للأستاذ العام ومطابق",
        },
      ],
      totals: [
        {
          label: "صافي المبلغ النهائي:",
          value: `${Number(voucher.amount).toLocaleString()} ${voucher.currency}`,
        },
        {
          label: "حالة السند المحاسبية:",
          value: voucher.reverted ? "معكوس (Reverted)" : "معتمد ومرحل (Posted)",
        },
      ],
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="rounded-3xl border border-primary/20 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="p-2 rounded-xl bg-primary/20 text-primary-foreground border border-primary/30">
                <FileText size={22} className="text-emerald-400" />
              </span>
              <h2 className="text-xl md:text-2xl font-black tracking-tight">
                تسجيل وإدارة سندات الإيراد والمصروف (حساب الأستاذ)
              </h2>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs px-2.5 py-0.5 font-bold">
                ترحيل مباشر للأستاذ العام
              </Badge>
            </div>
            <p className="mt-2 text-xs md:text-sm text-slate-300 max-w-2xl leading-relaxed">
              تسجيل قيود السندات النقدية والبنكية، ترحيلها آلياً لدفتر اليومية العامة وحساب الأستاذ،
              دعم العملات المتعددة وسعر الصرف، مع توثيق كامل لعمليات العكس وسجل الحذف للرقابة
              المالية.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigateToJournal?.()}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-bold text-xs rounded-xl"
            >
              <ExternalLink size={14} className="ml-1.5" />
              فتح دفتر اليومية العامة
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeletedAudit(!showDeletedAudit)}
              className={`${
                showDeletedAudit
                  ? "bg-rose-500 text-white border-rose-400 hover:bg-rose-600"
                  : "bg-white/10 text-white border-white/20 hover:bg-white/20"
              } font-bold text-xs rounded-xl transition`}
            >
              <ShieldAlert size={14} className="ml-1.5" />
              {showDeletedAudit ? "إخفاء سجل المحذوفات" : "عرض سجل المحذوفات"}
              {metrics.deletedCount > 0 && (
                <span className="mr-1 px-1.5 py-0.2 text-[10px] bg-rose-600 rounded-full font-mono">
                  {metrics.deletedCount}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Quick KPI Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/10 text-slate-200">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs text-emerald-400 font-bold mb-1">
              <span>إجمالي سندات القبض (+)</span>
              <ArrowDownLeft size={16} />
            </div>
            <div className="text-lg md:text-xl font-black text-white font-mono">
              $
              {metrics.totalReceiptsUSD.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">{metrics.receiptsCount} سند معتمد</div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs text-rose-400 font-bold mb-1">
              <span>إجمالي سندات الصرف (-)</span>
              <ArrowUpRight size={16} />
            </div>
            <div className="text-lg md:text-xl font-black text-white font-mono">
              $
              {metrics.totalPaymentsUSD.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {metrics.paymentsCount} سند مصروفات
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs text-sky-400 font-bold mb-1">
              <span>صافي حركة السندات</span>
              <Wallet size={16} />
            </div>
            <div
              className={`text-lg md:text-xl font-black font-mono ${
                metrics.netUSD >= 0 ? "text-emerald-300" : "text-rose-300"
              }`}
            >
              $
              {metrics.netUSD.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">الرصيد التراكمي بالأستاذ</div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs text-amber-400 font-bold mb-1">
              <span>السندات المعكوسة / المحذوفة</span>
              <RotateCcw size={16} />
            </div>
            <div className="text-lg md:text-xl font-black text-white font-mono">
              {metrics.revertedCount + metrics.deletedCount}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {metrics.revertedCount} معكوس | {metrics.deletedCount} محذوف
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Form on right, Table on left */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Right Column: Voucher Creation Form (5 Cols) */}
        <div className="lg:col-span-5 bg-card border border-border shadow-md rounded-3xl p-5 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <PlusCircle size={18} />
              </div>
              <div>
                <h3 className="font-black text-base text-foreground">تسجيل سند مالي جديد</h3>
                <p className="text-[11px] text-muted-foreground font-semibold">
                  ترحيل فوري إلى دفتر اليومية العامة وحساب الأستاذ
                </p>
              </div>
            </div>
            <Badge
              className={
                voucherType === "receipt"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
              }
            >
              {voucherType === "receipt" ? "قبض إيراد (+)" : "صرف مصروف (-)"}
            </Badge>
          </div>

          <form onSubmit={handleInitiateSubmit} className="space-y-4">
            {/* 1. Voucher Type Toggle */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">نوع السند المالي</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVoucherType("payment")}
                  className={`py-2 px-3 rounded-xl text-xs font-black transition border flex items-center justify-center gap-1.5 ${
                    voucherType === "payment"
                      ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                      : "bg-background border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <ArrowUpRight size={14} />
                  <span>سند صرف مصروفات (-)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVoucherType("receipt")}
                  className={`py-2 px-3 rounded-xl text-xs font-black transition border flex items-center justify-center gap-1.5 ${
                    voucherType === "receipt"
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                      : "bg-background border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <ArrowDownLeft size={14} />
                  <span>سند قبض إيرادات (+)</span>
                </button>
              </div>
            </div>

            {/* 2. Currency Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold flex items-center justify-between">
                <span>عملة السند</span>
                <span className="text-[11px] text-muted-foreground font-normal">
                  العملة الأساسية: USD ($)
                </span>
              </Label>
              <select
                className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm text-right font-bold focus:ring-2 focus:ring-primary/20"
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Conditional Exchange Rate Multiplier (يظهر عند اختيار عملة غير الدولار) */}
            {selectedCurrency !== "USD" && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-2 animate-in fade-in duration-300">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-black text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-amber-600" />
                    <span>معامل التحويل مقابل الدولار (سعر الصرف)</span>
                  </Label>
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-md font-mono">
                    1 USD = {exchangeRate || "1"} {selectedCurrency}
                  </span>
                </div>
                <Input
                  type="number"
                  step="any"
                  min="0.000001"
                  className="bg-white dark:bg-slate-900 font-mono font-bold text-sm h-9 border-amber-300 dark:border-amber-800"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  placeholder="أدخل معامل التحويل / سعر الصرف"
                  required
                />
                {numAmount > 0 && numRate > 0 && (
                  <div className="text-[11px] font-bold text-amber-800 dark:text-amber-300 flex items-center justify-between pt-1">
                    <span>المعادل بالدولار الأمريكي:</span>
                    <span className="font-mono bg-amber-200/50 dark:bg-amber-900/40 px-2 py-0.5 rounded">
                      $
                      {equivalentUSD.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      USD
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* 4. Amount */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold flex items-center justify-between">
                <span>المبلغ المعتمد للسند</span>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {selectedCurrency}
                </span>
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  step="any"
                  min="0.01"
                  className="h-10 text-sm font-black font-mono pl-14"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="مثال: 1500"
                  required
                />
                <span className="absolute left-3 top-2.5 text-xs font-black text-muted-foreground">
                  {selectedCurrency}
                </span>
              </div>
            </div>

            {/* 5. Account Number with Smart Search (Level 4 Only) */}
            <div className="space-y-1.5 p-3 rounded-2xl bg-primary/5 border border-primary/20">
              <Label className="text-xs font-bold flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-foreground">
                  <Landmark size={15} className="text-primary" />
                  <span>رقم الحساب المحاسبي (البحث الذكي)</span>
                  <span className="text-rose-500">*</span>
                </span>
                <Badge
                  variant="secondary"
                  className="text-[10px] bg-primary/10 text-primary border-primary/20"
                >
                  حسابات الدرجة الرابعة فقط
                </Badge>
              </Label>
              <AccountSearchSelect
                value={accountCode}
                onChange={(code) => {
                  setAccountCode(code);
                }}
                accounts={level4Accounts}
                level4Only={true}
                placeholder="ابحث برقم الحساب أو الاسم (مثال: 31010110 أجور ومرتبات)..."
              />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 flex-wrap gap-1">
                <span>توليد قيد اليومية المزدوج إلى هذا الحساب الفرعي بالدفتر العام.</span>
                {selectedAccount && (
                  <span className="font-mono text-primary font-bold truncate max-w-[220px]">
                    {selectedAccount.code} - {selectedAccount.name_ar}
                  </span>
                )}
              </div>
            </div>

            {/* 6. Category (with "أخرى" text box trigger) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">التصنيف والتبويب المالي</Label>
              <select
                className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm text-right font-medium"
                value={categorySelect}
                onChange={(e) => handleCategoryChange(e.target.value)}
              >
                {(voucherType === "payment" ? PAYMENT_CATEGORIES : RECEIPT_CATEGORIES).map(
                  (cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ),
                )}
              </select>

              {/* Conditional text input for Custom Category */}
              {categorySelect === "أخرى (تحديد يدوي)" && (
                <div className="pt-1 animate-in fade-in duration-200">
                  <Input
                    className="h-9 text-xs font-semibold bg-muted/40 border-primary/40 focus:border-primary"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="اكتب اسم التصنيف المالي المخصص هنا..."
                    required
                  />
                </div>
              )}
            </div>

            {/* 6. Cost Center (with "أخرى" text box trigger) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">مركز التكلفة المسؤول (Cost Center)</Label>
              <select
                className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm text-right font-medium"
                value={costCenterSelect}
                onChange={(e) => setCostCenterSelect(e.target.value)}
              >
                {Array.from(
                  new Set(["الإدارة (Administration)", ...(erpState.costCenters || [])]),
                ).map((cc) => (
                  <option key={cc} value={cc}>
                    {cc}
                  </option>
                ))}
                <option value="أخرى (تحديد يدوي)">أخرى (تحديد مركز تكلفة مخصص)...</option>
              </select>

              {/* Conditional text input for Custom Cost Center */}
              {costCenterSelect === "أخرى (تحديد يدوي)" && (
                <div className="pt-1 animate-in fade-in duration-200">
                  <Input
                    className="h-9 text-xs font-semibold bg-muted/40 border-primary/40 focus:border-primary"
                    value={customCostCenter}
                    onChange={(e) => setCustomCostCenter(e.target.value)}
                    placeholder="اكتب اسم مركز التكلفة المخصص هنا..."
                    required
                  />
                </div>
              )}
            </div>

            {/* 7. Treasury Account */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">خزينة الصرف / القبض المتأثرة</Label>
              <select
                className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm text-right font-medium"
                value={treasuryId}
                onChange={(e) => setTreasuryId(e.target.value)}
                required
              >
                <option value="">-- اختر الخزينة أو الحساب المالي --</option>
                {activeTreasuries.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name_ar} {t.account_code ? `[كود: ${t.account_code}]` : ""} (رصيد:{" "}
                    {Number(t.balance).toLocaleString()} {t.currency})
                  </option>
                ))}
              </select>
            </div>

            {/* 8. Beneficiary / Receiver */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">اسم المستفيد / المستلم أو جهة الصرف</Label>
              <Input
                className="h-10 text-sm"
                value={beneficiary}
                onChange={(e) => setBeneficiary(e.target.value)}
                placeholder="اسم الشخص أو المورد أو الموظف المستلم"
              />
            </div>

            {/* 9. Description / Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">البيان والشرح التفصيلي (شرح القيد)</Label>
              <Input
                className="h-10 text-sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="تفاصيل الفاتورة أو سبب السند"
                required
              />
            </div>

            {/* 10. Attachment reference */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">
                ملاحظات المستند الورقي أو رقم الإيصال اليدوي
              </Label>
              <Input
                className="h-9 text-xs"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="رقم الفاتورة الورقية أو مستند الإثبات (اختياري)"
              />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className={`w-full h-11 text-sm font-black rounded-xl shadow-md transition ${
                voucherType === "receipt"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20"
                  : "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20"
              }`}
            >
              <Save size={16} className="ml-2" />
              حفظ وترحيل السند لحساب الأستاذ 💾
            </Button>
          </form>
        </div>

        {/* Left Column: Vouchers Log Table (7 Cols) */}
        <div className="lg:col-span-7 bg-card border border-border shadow-md rounded-3xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
            <div>
              <h3 className="font-black text-base text-foreground flex items-center gap-2">
                <span>سجل السندات والقيود المرحلة</span>
                <Badge variant="outline" className="text-xs font-mono">
                  {filteredVouchers.length} سند
                </Badge>
              </h3>
              <p className="text-[11px] text-muted-foreground font-semibold">
                عرض السندات المحاسبية المعتمدة والمعكوسة وسجل العمليات المحذوفة
              </p>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                className="h-8 rounded-lg border border-input bg-background px-2 text-xs font-bold"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
              >
                <option value="all">كل الأنواع</option>
                <option value="receipt">سندات قبض (+)</option>
                <option value="payment">سندات صرف (-)</option>
              </select>

              <select
                className="h-8 rounded-lg border border-input bg-background px-2 text-xs font-bold"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="all">كل الحالات</option>
                <option value="active">النشطة المعتمدة</option>
                <option value="reverted">المعكوسة (تسوية)</option>
                {showDeletedAudit && <option value="deleted">المحذوفة فقط</option>}
              </select>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search size={16} className="absolute right-3 top-2.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="البحث برقم السند، رقم القيد، التصنيف، مركز التكلفة، أو البيان..."
              className="h-9 pr-9 text-xs"
            />
          </div>

          {/* Vouchers Table */}
          <div className="rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-xs">
                <thead className="bg-muted/80 text-muted-foreground sticky top-0 z-10 backdrop-blur-sm">
                  <tr className="border-b border-border text-right font-bold">
                    <th className="p-3">رقم السند</th>
                    <th className="p-3">النوع</th>
                    <th className="p-3">التصنيف & المركز</th>
                    <th className="p-3">المبلغ المعتمد</th>
                    <th className="p-3">القيد المرحل</th>
                    <th className="p-3">البيان والتفاصيل</th>
                    <th className="p-3 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredVouchers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-muted-foreground">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <FileText size={32} className="text-muted-foreground/40" />
                          <span className="font-bold text-sm">
                            لا توجد سندات مطابقة لمعايير البحث
                          </span>
                          <span className="text-xs">
                            سجل سنداً جديداً باستخدام النموذج أعلاه للبدء بالترحيل
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredVouchers.map((v) => {
                      const isPayment = v.type === "payment";
                      const isReverted = v.reverted === true;
                      const isDeleted = v.deleted === true;

                      return (
                        <tr
                          key={v.id}
                          className={`hover:bg-muted/40 transition ${
                            isDeleted
                              ? "bg-rose-50/40 dark:bg-rose-950/20 line-through opacity-70"
                              : isReverted
                                ? "bg-amber-50/30 dark:bg-amber-950/20"
                                : ""
                          }`}
                        >
                          {/* Voucher ID */}
                          <td className="p-3 font-mono font-bold text-[11px] text-primary">
                            <div>{v.id.substring(4, 9).toUpperCase()}</div>
                            <div className="text-[10px] text-muted-foreground font-normal">
                              {v.created_at ? v.created_at.slice(0, 10) : "-"}
                            </div>
                          </td>

                          {/* Type */}
                          <td className="p-3">
                            <Badge
                              className={`text-[10px] font-bold ${
                                isDeleted
                                  ? "bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-200"
                                  : isReverted
                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300"
                                    : isPayment
                                      ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              }`}
                            >
                              {isDeleted
                                ? "محذوف"
                                : isReverted
                                  ? "معكوس"
                                  : isPayment
                                    ? "صرف (-)"
                                    : "قبض (+)"}
                            </Badge>
                          </td>

                          {/* Category & Cost Center & Account */}
                          <td className="p-3">
                            <div className="font-bold text-foreground">{v.category}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {v.cost_center || "الإدارة العامة"}
                            </div>
                            {v.account_code && (
                              <div className="text-[10px] font-mono text-primary font-bold flex items-center gap-1 mt-0.5">
                                <Landmark size={11} className="text-primary/70 shrink-0" />
                                <span>{v.account_code}</span>
                                <span className="font-sans font-normal text-muted-foreground truncate max-w-[110px]">
                                  {erpStore.getAccountName(v.account_code)}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Amount & Currency */}
                          <td className="p-3 font-mono font-black">
                            <div
                              className={
                                isPayment
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-emerald-600 dark:text-emerald-400"
                              }
                            >
                              {Number(v.amount).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                              })}{" "}
                              {v.currency}
                            </div>
                            {v.currency !== "USD" && v.exchange_rate && (
                              <div className="text-[10px] text-muted-foreground font-normal">
                                المعامل: {v.exchange_rate} (≈ $
                                {Number(v.base_amount || v.amount / v.exchange_rate).toFixed(2)})
                              </div>
                            )}
                          </td>

                          {/* Journal Ref */}
                          <td className="p-3 font-mono text-[10px]">
                            {v.journal_reference ? (
                              <button
                                onClick={() => handleViewJournalEntry(v)}
                                className="text-primary hover:underline font-bold flex items-center gap-1"
                              >
                                <span>{v.journal_reference}</span>
                                <Eye size={12} />
                              </button>
                            ) : (
                              <span className="text-muted-foreground">مرحل آلياً</span>
                            )}
                          </td>

                          {/* Description */}
                          <td
                            className="p-3 text-muted-foreground max-w-[180px] truncate"
                            title={v.description}
                          >
                            {v.description}
                            {isReverted && v.reverted_reason && (
                              <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold truncate">
                                سبب العكس: {v.reverted_reason}
                              </div>
                            )}
                            {isDeleted && v.deleted_reason && (
                              <div className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold truncate">
                                سبب الحذف: {v.deleted_reason}
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {/* View Journal Entry */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-lg text-slate-600 hover:text-primary hover:bg-primary/10"
                                title="عرض القيد المحاسبي المتولد"
                                onClick={() => handleViewJournalEntry(v)}
                              >
                                <Eye size={14} />
                              </Button>

                              {/* Print Voucher */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-lg text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                title="طباعة السند الرسمي"
                                onClick={() => handlePrintVoucher(v)}
                              >
                                <Printer size={14} />
                              </Button>

                              {/* Revert Voucher (if not reverted & not deleted) */}
                              {!isReverted && !isDeleted && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                  title="إرجاع أو عكس السند المالي"
                                  onClick={() => {
                                    setVoucherToRevert(v);
                                    setRevertReason("");
                                  }}
                                >
                                  <RotateCcw size={14} />
                                </Button>
                              )}

                              {/* Delete Voucher (if not deleted) */}
                              {!isDeleted && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                  title="حذف السند (مع التوثيق بالرقابة)"
                                  onClick={() => {
                                    setVoucherToDelete(v);
                                    setDeleteReason("");
                                  }}
                                >
                                  <Trash2 size={14} />
                                </Button>
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
        </div>
      </div>

      {/* MODAL 1: Confirmation Dialog for Save & Post */}
      <Dialog open={isConfirmPostOpen} onOpenChange={setIsConfirmPostOpen}>
        <DialogContent className="max-w-md text-right rounded-3xl" dir="rtl">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary">
              <CheckCircle2 size={22} className="text-emerald-500" />
              <DialogTitle className="text-base font-black">
                تأكيد حفظ وترحيل السند لحساب الأستاذ
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              يرجى مراجعة بيانات السند بعناية قبل الترحيل النهائي وتوليد قيد اليومية العامة.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-muted/40 p-4 rounded-2xl border border-border space-y-2.5 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-border/60">
              <span className="text-muted-foreground font-bold">نوع السند:</span>
              <Badge
                className={
                  voucherType === "receipt"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-rose-100 text-rose-800"
                }
              >
                {voucherType === "receipt" ? "سند قبض إيرادات (+)" : "سند صرف مصروفات (-)"}
              </Badge>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-border/60">
              <span className="text-muted-foreground font-bold">المبلغ والعملة:</span>
              <span className="font-mono font-black text-sm text-foreground">
                {numAmount.toLocaleString()} {selectedCurrency}
                {selectedCurrency !== "USD" && (
                  <span className="text-[11px] text-muted-foreground font-normal block text-left">
                    سعر الصرف: {numRate} (≈ ${equivalentUSD.toFixed(2)} USD)
                  </span>
                )}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-border/60">
              <span className="text-muted-foreground font-bold">الحساب المحاسبي (درجة 4):</span>
              <span className="font-bold text-primary font-mono flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] font-mono font-bold bg-muted">
                  {accountCode}
                </Badge>
                <span className="font-sans text-xs">{selectedAccount?.name_ar || accountCode}</span>
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-border/60">
              <span className="text-muted-foreground font-bold">التصنيف المالي:</span>
              <span className="font-bold text-foreground">{effectiveCategory}</span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-border/60">
              <span className="text-muted-foreground font-bold">مركز التكلفة:</span>
              <span className="font-bold text-foreground">{effectiveCostCenter}</span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-border/60">
              <span className="text-muted-foreground font-bold">الخزينة المتأثرة:</span>
              <span className="font-bold text-foreground">
                {activeTreasuries.find((t) => t.id === treasuryId)?.name_ar || "الخزينة المختارة"}
              </span>
            </div>

            {beneficiary && (
              <div className="flex justify-between items-center py-1 border-b border-border/60">
                <span className="text-muted-foreground font-bold">المستفيد / المستلم:</span>
                <span className="font-bold text-foreground">{beneficiary}</span>
              </div>
            )}

            <div className="py-1">
              <span className="text-muted-foreground font-bold block mb-1">البيان:</span>
              <p className="font-semibold text-foreground bg-background p-2 rounded-lg border border-border">
                {description}
              </p>
            </div>
          </div>

          <div className="text-[11px] bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 p-2.5 rounded-xl font-medium">
            💡 سيتم تحديث رصيد الخزينة فوراً وتوليد قيد محاسبي مزدوج متوازن وإضافته لدفتر اليومية
            العامة وحساب الأستاذ العام.
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsConfirmPostOpen(false)}
              className="font-bold text-xs rounded-xl"
            >
              إلغاء الترحيل
            </Button>
            <Button
              onClick={handleConfirmSaveAndPost}
              className={`font-black text-xs rounded-xl text-white ${
                voucherType === "receipt"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-rose-600 hover:bg-rose-700"
              }`}
            >
              تأكيد الحفظ والترحيل الآن ✓
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Created Voucher & Generated Journal Entry Display */}
      <Dialog open={!!postedEntryModalData} onOpenChange={() => setPostedEntryModalData(null)}>
        <DialogContent className="max-w-2xl text-right rounded-3xl" dir="rtl">
          <DialogHeader>
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 size={24} />
              <DialogTitle className="text-base font-black">
                تم إنشاء السند وترحيل القيد المحاسبي بنجاح!
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              القيد المحاسبي المتولد آلياً في دفتر الأستاذ العام ودفتر اليومية
            </DialogDescription>
          </DialogHeader>

          {postedEntryModalData && (
            <div className="space-y-4">
              {/* Summary Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-muted/40 p-3 rounded-2xl border border-border text-xs">
                <div>
                  <span className="text-muted-foreground font-bold block text-[10px]">
                    رقم السند:
                  </span>
                  <span className="font-mono font-black text-primary">
                    {postedEntryModalData.voucher.id.toUpperCase()}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground font-bold block text-[10px]">
                    رقم القيد في اليومية:
                  </span>
                  <span className="font-mono font-black text-emerald-600">
                    {postedEntryModalData.voucher.journal_reference || "EXP/REV-NEW"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground font-bold block text-[10px]">
                    الحساب المحاسبي (درجة 4):
                  </span>
                  <span className="font-mono font-bold text-primary truncate block">
                    {postedEntryModalData.voucher.account_code || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground font-bold block text-[10px]">
                    المبلغ والعملة:
                  </span>
                  <span className="font-mono font-black text-foreground">
                    {Number(postedEntryModalData.voucher.amount).toLocaleString()}{" "}
                    {postedEntryModalData.voucher.currency}
                  </span>
                </div>
              </div>

              {/* Journal Entry Lines Table */}
              {postedEntryModalData.journalEntry?.lines && (
                <div className="rounded-2xl border border-border overflow-hidden">
                  <div className="bg-primary/10 px-3 py-2 border-b border-border font-bold text-xs text-primary flex items-center justify-between">
                    <span>أطراف القيد المحاسبي المزدوج (Double-Entry Journal)</span>
                    <Badge variant="outline" className="text-[10px] bg-background">
                      متزن 100% ✓
                    </Badge>
                  </div>
                  <table className="w-full text-xs">
                    <thead className="bg-muted text-muted-foreground font-bold">
                      <tr className="border-b border-border text-right">
                        <th className="p-2.5">كود الحساب</th>
                        <th className="p-2.5">اسم الحساب</th>
                        <th className="p-2.5">مركز التكلفة</th>
                        <th className="p-2.5">مدين (Debit)</th>
                        <th className="p-2.5">دائن (Credit)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border font-mono">
                      {postedEntryModalData.journalEntry.lines.map((line, idx) => {
                        const acc = erpState.accounts.find((a) => a.code === line.account_code);
                        return (
                          <tr key={idx} className="hover:bg-muted/30">
                            <td className="p-2.5 font-bold text-primary">{line.account_code}</td>
                            <td className="p-2.5 font-sans font-bold text-foreground">
                              {acc
                                ? acc.name_ar
                                : line.account_code === "101000"
                                  ? "الخزينة الرئيسية"
                                  : "حساب الأستاذ"}
                            </td>
                            <td className="p-2.5 font-sans text-muted-foreground">
                              {line.cost_center || "-"}
                            </td>
                            <td className="p-2.5 font-black text-emerald-600">
                              {Number(line.debit) > 0
                                ? `${Number(line.debit).toLocaleString()} ${line.currency || postedEntryModalData.voucher.currency}`
                                : "-"}
                            </td>
                            <td className="p-2.5 font-black text-rose-600">
                              {Number(line.credit) > 0
                                ? `${Number(line.credit).toLocaleString()} ${line.currency || postedEntryModalData.voucher.currency}`
                                : "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => handlePrintVoucher(postedEntryModalData.voucher)}
                  className="font-bold text-xs rounded-xl"
                >
                  <Printer size={14} className="ml-1.5" />
                  طباعة السند الرسمي
                </Button>
                {postedEntryModalData.journalEntry && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      printJournalEntryDocument(
                        postedEntryModalData.journalEntry!,
                        erpState.accounts,
                      )
                    }
                    className="font-bold text-xs rounded-xl"
                  >
                    <FileText size={14} className="ml-1.5" />
                    طباعة قيد اليومية
                  </Button>
                )}
                <Button
                  onClick={() => {
                    setPostedEntryModalData(null);
                    if (onNavigateToJournal) {
                      onNavigateToJournal(postedEntryModalData.voucher.journal_reference);
                    }
                  }}
                  className="bg-primary hover:bg-primary/90 text-white font-black text-xs rounded-xl"
                >
                  عرض في دفتر اليومية 📖
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL 3: View Existing Journal Entry for Voucher */}
      <Dialog open={!!viewEntryModalData} onOpenChange={() => setViewEntryModalData(null)}>
        <DialogContent className="max-w-2xl text-right rounded-3xl" dir="rtl">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary">
              <Eye size={22} />
              <DialogTitle className="text-base font-black">
                تفاصيل القيد المحاسبي المولد للسند
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              سند رقم: {viewEntryModalData?.voucher.id.toUpperCase()} | البيان:{" "}
              {viewEntryModalData?.voucher.description}
            </DialogDescription>
          </DialogHeader>

          {viewEntryModalData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-muted/40 p-3 rounded-2xl border border-border text-xs">
                <div>
                  <span className="text-muted-foreground font-bold block text-[10px]">
                    نوع السند:
                  </span>
                  <Badge
                    className={
                      viewEntryModalData.voucher.type === "receipt"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800"
                    }
                  >
                    {viewEntryModalData.voucher.type === "receipt" ? "قبض (+)" : "صرف (-)"}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground font-bold block text-[10px]">
                    رقم القيد في اليومية:
                  </span>
                  <span className="font-mono font-black text-emerald-600">
                    {viewEntryModalData.voucher.journal_reference || "مرحل آلياً"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground font-bold block text-[10px]">
                    الحساب المحاسبي (درجة 4):
                  </span>
                  <span className="font-mono font-bold text-primary truncate block">
                    {viewEntryModalData.voucher.account_code || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground font-bold block text-[10px]">
                    المبلغ والعملة:
                  </span>
                  <span className="font-mono font-black text-foreground">
                    {Number(viewEntryModalData.voucher.amount).toLocaleString()}{" "}
                    {viewEntryModalData.voucher.currency}
                  </span>
                </div>
              </div>

              {viewEntryModalData.journalEntry?.lines ? (
                <div className="rounded-2xl border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted text-muted-foreground font-bold">
                      <tr className="border-b border-border text-right">
                        <th className="p-2.5">كود الحساب</th>
                        <th className="p-2.5">اسم الحساب</th>
                        <th className="p-2.5">مركز التكلفة</th>
                        <th className="p-2.5">مدين</th>
                        <th className="p-2.5">دائن</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border font-mono">
                      {viewEntryModalData.journalEntry.lines.map((line, idx) => {
                        const acc = erpState.accounts.find((a) => a.code === line.account_code);
                        return (
                          <tr key={idx} className="hover:bg-muted/30">
                            <td className="p-2.5 font-bold text-primary">{line.account_code}</td>
                            <td className="p-2.5 font-sans font-bold text-foreground">
                              {acc
                                ? acc.name_ar
                                : line.account_code === "101000"
                                  ? "الخزينة النقدية"
                                  : "حساب مالي"}
                            </td>
                            <td className="p-2.5 font-sans text-muted-foreground">
                              {line.cost_center || "-"}
                            </td>
                            <td className="p-2.5 font-black text-emerald-600">
                              {Number(line.debit) > 0
                                ? `${Number(line.debit).toLocaleString()} ${line.currency || viewEntryModalData.voucher.currency}`
                                : "-"}
                            </td>
                            <td className="p-2.5 font-black text-rose-600">
                              {Number(line.credit) > 0
                                ? `${Number(line.credit).toLocaleString()} ${line.currency || viewEntryModalData.voucher.currency}`
                                : "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground border rounded-2xl bg-muted/20">
                  <AlertCircle size={28} className="mx-auto mb-2 text-amber-500" />
                  <p className="font-bold text-xs">
                    تم ترحيل القيد المحاسبي في حسابات الأستاذ لهذا السند
                  </p>
                  <p className="text-[11px]">
                    يمكنك البحث عنه برقم{" "}
                    {viewEntryModalData.voucher.journal_reference ||
                      viewEntryModalData.voucher.id.substring(4, 9)}{" "}
                    في دفتر اليومية العامة
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  onClick={() => handlePrintVoucher(viewEntryModalData.voucher)}
                  className="font-bold text-xs rounded-xl"
                >
                  <Printer size={14} className="ml-1.5" />
                  طباعة السند
                </Button>
                <Button
                  onClick={() => setViewEntryModalData(null)}
                  className="font-bold text-xs rounded-xl"
                >
                  إغلاق
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL 4: Revert Voucher Modal (إرجاع وعكس السند) */}
      <Dialog open={!!voucherToRevert} onOpenChange={() => setVoucherToRevert(null)}>
        <DialogContent className="max-w-md text-right rounded-3xl" dir="rtl">
          <DialogHeader>
            <div className="flex items-center gap-2 text-amber-600">
              <RotateCcw size={22} />
              <DialogTitle className="text-base font-black">
                إرجاع وعكس السند المالي المحاسبي
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              سيتم إنشاء قيد محاسبي عكسي تسوية لإلغاء أثر هذا السند في الخزينة وحساب الأستاذ العام.
            </DialogDescription>
          </DialogHeader>

          {voucherToRevert && (
            <div className="space-y-3">
              <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-2xl border border-amber-200 dark:border-amber-900 text-xs space-y-1">
                <div className="flex justify-between font-bold text-amber-900 dark:text-amber-200">
                  <span>رقم السند:</span>
                  <span className="font-mono">{voucherToRevert.id.toUpperCase()}</span>
                </div>
                <div className="flex justify-between font-bold text-amber-900 dark:text-amber-200">
                  <span>المبلغ والعملة:</span>
                  <span className="font-mono">
                    {Number(voucherToRevert.amount).toLocaleString()} {voucherToRevert.currency}
                  </span>
                </div>
                <div className="flex justify-between text-amber-800 dark:text-amber-300">
                  <span>البيان:</span>
                  <span className="truncate max-w-[200px]">{voucherToRevert.description}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">
                  سبب الإرجاع / العكس (إلزامي للرقابة المالية)
                </Label>
                <Input
                  value={revertReason}
                  onChange={(e) => setRevertReason(e.target.value)}
                  placeholder="مثال: إلغاء المعاملة لعدم استيفاء الفاتورة / تسوية محاسبية"
                  className="text-xs h-9"
                  required
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setVoucherToRevert(null)}
                  className="font-bold text-xs rounded-xl"
                >
                  إلغاء
                </Button>
                <Button
                  onClick={handleConfirmRevert}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl"
                >
                  تأكيد إرجاع وعكس السند ✓
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL 5: Delete Voucher Modal with Audit Log (حذف السند مع تسجيل عملية الحذف) */}
      <Dialog open={!!voucherToDelete} onOpenChange={() => setVoucherToDelete(null)}>
        <DialogContent className="max-w-md text-right rounded-3xl" dir="rtl">
          <DialogHeader>
            <div className="flex items-center gap-2 text-rose-600">
              <Trash2 size={22} />
              <DialogTitle className="text-base font-black">
                حذف السند المالي وتوثيقه في سجل الرقابة
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              تحذير: سيتم حذف هذا السند ونقله إلى سجل المحذوفات مع تسجيل سبب الحذف بالكامل في سجل
              التدقيق المالي.
            </DialogDescription>
          </DialogHeader>

          {voucherToDelete && (
            <div className="space-y-3">
              <div className="bg-rose-50 dark:bg-rose-950/40 p-3 rounded-2xl border border-rose-200 dark:border-rose-900 text-xs space-y-1">
                <div className="flex justify-between font-bold text-rose-900 dark:text-rose-200">
                  <span>رقم السند:</span>
                  <span className="font-mono">{voucherToDelete.id.toUpperCase()}</span>
                </div>
                <div className="flex justify-between font-bold text-rose-900 dark:text-rose-200">
                  <span>المبلغ:</span>
                  <span className="font-mono">
                    {Number(voucherToDelete.amount).toLocaleString()} {voucherToDelete.currency}
                  </span>
                </div>
                <div className="flex justify-between text-rose-800 dark:text-rose-300">
                  <span>البيان:</span>
                  <span className="truncate max-w-[200px]">{voucherToDelete.description}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">
                  سبب الحذف الإلزامي (لأغراض التدقيق المحاسبي)
                </Label>
                <Input
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="مثال: إدخال خاطئ مكرر / تم تصحيح القيد"
                  className="text-xs h-9"
                  required
                />
              </div>

              <div className="text-[11px] text-muted-foreground bg-muted/40 p-2.5 rounded-xl border border-border">
                🛡️ سيتم توثيق اسم المستخدم وتاريخ وساعة الحذف وسبب الحذف نهائياً في سجل التدقيق
                والرقابة (Audit Operations).
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setVoucherToDelete(null)}
                  className="font-bold text-xs rounded-xl"
                >
                  إلغاء
                </Button>
                <Button
                  onClick={handleConfirmDelete}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl"
                >
                  تأكيد الحذف وتسجيل العملية 🗑️
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
