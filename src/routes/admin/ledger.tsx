// @ts-nocheck
import { createFileRoute, useNavigate, useBlocker, useLocation, Link } from "@tanstack/react-router";
import {
  extractTabParam,
  useSyncedSubTab,
} from "@/components/navigation/navigationRegistry";
import React, { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  erpStore,
  isLevel4Account,
  type Account,
  type JournalEntry,
  type JournalLine,
} from "@/shared/services/erpStore";
import {
  parseOracleSheetRows,
  parseOracleTextToRows,
  groupOracleRowsIntoJournalEntries,
  type ParsedOracleRow,
} from "@/shared/utils/oracleParser";
import { groupOracleRowsIntoJournalEntriesOrdered } from "@/shared/utils/oracleJournalGrouping";

const getLineBaseValue = (
  amount: number | string,
  rate: number | string,
  currency = "USD",
): number => {
  return erpStore.getLineBaseValue(amount, rate, currency);
};
import { AccountSearchSelect } from "@/components/AccountSearchSelect";
import { VouchersLedgerSection } from "@/components/admin/VouchersLedgerSection";
import { ComprehensiveFinancialPositionCard } from "@/components/admin/ComprehensiveFinancialPositionCard";
import { AccountsPage } from "@/components/admin/AccountsPageView";
import { ReportsPage } from "@/components/admin/ReportsPageView";
import { TreasuryManagementView } from "@/components/admin/TreasuryManagementView";
import {
  printAccountingDocument,
  printJournalEntryDocument,
  printImportReportDocument,
} from "@/shared/utils/printAccountingDocument";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/hooks/use-settings";
import {
  BookOpen,
  Plus,
  Search,
  ArrowRight,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  Briefcase,
  Layers,
  Scale,
  Printer,
  Calendar,
  AlertCircle,
  AlertTriangle,
  HelpCircle,
  Trash2,
  PlusCircle,
  ArrowUpDown,
  Filter,
  Check,
  TrendingUp,
  Percent,
  Eye,
  Edit,
  RefreshCw,
  Lock,
  Unlock,
  Paperclip,
  ClipboardPaste,
  Copy,
  Sparkles,
  Save,
  Database,
  ShieldCheck,
  CheckCheck,
  Landmark,
  Wallet,
  Building2,
  Store,
  BarChart3,
  Receipt,
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
  DialogTrigger,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { JournalEntryCurrencyGroups } from "@/components/JournalEntryCurrencyGroups";

export const Route = createFileRoute("/admin/ledger")({
  head: () => ({
    meta: [{ title: "الإدارة المالية - حساب الأستاذ ودليل الحسابات والخزائن والتقارير" }],
  }),
  component: LedgerPage,
});

import {
  ACCOUNT_TYPE_LABELS,
  buildLedgerPrintRows,
  exportLedgerDocumentToExcel,
  LedgerBottomDialogs,
  printLedgerDocument,
} from "@/components/admin/LedgerDialogsAndHelpers";

function LedgerPage() {
  const { toast } = useToast();
  const settings = useSettings();
  const formatCurrency =
    settings.formatCurrency || ((val: number, cur = "EGP") => `${val.toLocaleString()} ${cur}`);

  // ERP Store subscription
  const [erpState, setErpState] = useState(() => erpStore.getState());
  useEffect(() => {
    return erpStore.subscribe(() => {
      const state = erpStore.getState();
      if (state) setErpState({ ...state });
    });
  }, []);

  // Track saved snapshot IDs to detect unsaved entries
  const [savedEntryIds, setSavedEntryIds] = useState<Set<string>>(() => {
    const current = erpStore.getState().journalEntries || [];
    return new Set(current.map((e) => e.id));
  });

  // Calculate unpersisted/unsaved entries
  const unsavedEntries = useMemo(() => {
    const current = erpState?.journalEntries || [];
    return current.filter((e) => !savedEntryIds.has(e.id));
  }, [erpState?.journalEntries, savedEntryIds]);

  const hasUnsavedChanges = unsavedEntries.length > 0;

  // Unsaved Exit Dialog State & Navigation Interception
  const navigate = useNavigate();
  const [isUnsavedExitDialogOpen, setIsUnsavedExitDialogOpen] = useState(false);
  const [pendingNavigationPath, setPendingNavigationPath] = useState<string | null>(null);

  // TanStack Router Blocker
  const blocker = useBlocker({
    shouldBlockFn: () => hasUnsavedChanges,
    withResolver: true,
    enableBeforeUnload: false,
  });

  useEffect(() => {
    if (blocker?.status === "blocked") {
      setIsUnsavedExitDialogOpen(true);
    }
  }, [blocker?.status]);

  // Document Link Click Interceptor for external and admin sidebar navigation
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      if (!hasUnsavedChanges) return;
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (
        href &&
        !href.startsWith("#") &&
        !href.startsWith("javascript:") &&
        href !== window.location.pathname &&
        !href.startsWith("/admin/ledger")
      ) {
        e.preventDefault();
        e.stopPropagation();
        setPendingNavigationPath(href);
        setIsUnsavedExitDialogOpen(true);
      }
    };

    document.addEventListener("click", handleAnchorClick, true);
    return () => document.removeEventListener("click", handleAnchorClick, true);
  }, [hasUnsavedChanges]);

  // Window beforeunload (browser tab close or reload)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "يوجد لديك قيود محاسبية غير محفوظة. هل أنت متأكد من الخروج وتجاهلها؟";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Handler 1: Return to entries (Cancel exit)
  const handleReturnToEntries = () => {
    setIsUnsavedExitDialogOpen(false);
    setPendingNavigationPath(null);
    if (blocker?.status === "blocked" && typeof blocker.reset === "function") {
      blocker.reset();
    }
  };

  // Handler 2: Save entries and exit
  const handleSaveAndExit = () => {
    try {
      setIsSavingToDb(true);
      const res = erpStore.persistAllJournalsToDatabase();
      setErpState({ ...erpStore.getState() });
      setSavedEntryIds(new Set((erpStore.getState().journalEntries || []).map((e) => e.id)));
      setIsUnsavedExitDialogOpen(false);
      toast({
        title: "✅ تم حفظ القيود في قاعدة البيانات بنجاح",
        description: `تم حفظ وتثبيت ${res.savedEntriesCount} قيد قبل المغادرة.`,
      });
      const dest = pendingNavigationPath;
      setPendingNavigationPath(null);
      if (blocker?.status === "blocked" && typeof blocker.proceed === "function") {
        blocker.proceed();
      } else if (dest) {
        navigate({ to: dest });
      }
    } catch (err: any) {
      toast({
        title: "خطأ أثناء حفظ القيود",
        description: err?.message || "تعذر حفظ القيود قبل المغادرة",
        variant: "destructive",
      });
    } finally {
      setIsSavingToDb(false);
    }
  };

  // Handler 3: Exit and discard unsaved entries
  const handleDiscardAndExit = () => {
    // Revert in-memory entries back to saved snapshot
    const current = erpStore.getState().journalEntries || [];
    const reverted = current.filter((e) => savedEntryIds.has(e.id));
    erpStore.state.journalEntries = reverted;
    erpStore.recalculateAccountBalances();
    erpStore.saveState();
    setErpState({ ...erpStore.getState() });

    setIsUnsavedExitDialogOpen(false);
    const dest = pendingNavigationPath;
    setPendingNavigationPath(null);
    if (blocker?.status === "blocked" && typeof blocker.proceed === "function") {
      blocker.proceed();
    } else if (dest) {
      navigate({ to: dest });
    }
  };

  // UI state
  const location = useLocation();
  const [selectedTab, setSelectedTab] = useState(() => {
    const tabParam = extractTabParam(location.search, (location as any).searchStr);
    if (
      tabParam &&
      [
        "hub",
        "financial_position",
        "ledger",
        "journal",
        "vouchers",
        "trial",
        "statements",
        "accounts",
        "treasury",
        "reports",
      ].includes(tabParam)
    ) {
      return tabParam;
    }
    return "hub";
  });

  useEffect(() => {
    const tabParam = extractTabParam(location.search, (location as any).searchStr);
    if (
      tabParam &&
      [
        "hub",
        "financial_position",
        "ledger",
        "journal",
        "vouchers",
        "trial",
        "statements",
        "accounts",
        "treasury",
        "reports",
      ].includes(tabParam)
    ) {
      setSelectedTab(tabParam);
    } else if (!tabParam) {
      setSelectedTab("hub");
    }
  }, [location.search]);

  useSyncedSubTab("/admin/ledger", selectedTab, setSelectedTab, "hub");

  const [isImportingOracle, setIsImportingOracle] = useState(false);
  const [isSavingToDb, setIsSavingToDb] = useState(false);
  const [isSaveConfirmOpen, setIsSaveConfirmOpen] = useState(false);
  const [isSaveReportOpen, setIsSaveReportOpen] = useState(false);
  const [saveReportData, setSaveReportData] = useState<any>(null);
  const [balanceAdjustmentEntry, setBalanceAdjustmentEntry] = useState<JournalEntry | null>(null);

  const handleSaveAndPersistJournals = () => {
    try {
      setIsSavingToDb(true);
      const invalidEntries = (erpStore.getState().journalEntries || []).filter((entry) => {
        // Validate using the SAME balance computation as the on-screen indicator
        // (getEntryBalanceInfo / checkIsEntryBalanced). Using a separate
        // "getLineBaseValue" path here was the source of the display-vs-save
        // mismatch: an entry looked balanced on screen but failed validation on
        // save, especially when a line carried a currency coefficient < 1.
        return !checkIsEntryBalanced(entry);
      });

      if (invalidEntries.length > 0) {
        const examples = invalidEntries
          .slice(0, 5)
          .map((entry) => entry.reference || entry.description || entry.id)
          .join(", ");
        throw new Error(
          `لا يمكن حفظ ${invalidEntries.length} قيد غير متزن. راجع القيود: ${examples}`,
        );
      }
      const res = erpStore.persistAllJournalsToDatabase();
      setErpState({ ...erpStore.getState() });
      setSavedEntryIds(new Set((erpStore.getState().journalEntries || []).map((e) => e.id)));
      setSaveReportData(res);
      setIsSaveConfirmOpen(false);
      setIsSaveReportOpen(true);
      toast({
        title: "✅ تم حفظ القيود في قاعدة البيانات بنجاح",
        description: `تم حفظ وتثبيت ${res.savedEntriesCount} قيد و ${res.newAccountsCreated} حساب جديد ومزامنة الخزائن بشكل دائم.`,
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "خطأ أثناء حفظ القيود",
        description: err?.message || "حدث خطأ أثناء حفظ وتثبيت القيود في قاعدة البيانات",
        variant: "destructive",
      });
    } finally {
      setIsSavingToDb(false);
    }
  };

  const showImportReport = (
    result: any,
    importedEntries: JournalEntry[],
    newlyCreatedAccounts: Account[],
  ) => {
    const balancedEntriesCount = importedEntries.filter((entry) =>
      checkIsEntryBalanced(entry),
    ).length;
    const totalBaseUSD = importedEntries.reduce(
      (sum, entry) =>
        sum +
        (entry.lines || []).reduce(
          (s, l) =>
            s + getLineBaseValue(l.debit, l.rate || 1, l.currency || entry.currency || "USD"),
          0,
        ),
      0,
    );
    setSaveReportData({
      savedEntriesCount: result.insertedEntries,
      savedEntries: importedEntries,
      balancedEntriesCount,
      unbalancedEntriesCount: importedEntries.length - balancedEntriesCount,
      newAccountsCreated: newlyCreatedAccounts.length,
      newlyCreatedAccounts,
      totalAccountsCount: erpStore.getState().accounts.length,
      linkedTreasuryTransactions: result.linkedTreasuryTransactions,
      totalBaseUSD,
      savedAt: new Date().toLocaleTimeString("ar-EG", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    });
    setIsSaveReportOpen(true);
  };
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImportingOracle(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          // Read as an ArrayBuffer and parse with type "array" — this preserves the
          // exact binary content of .xlsx/.xls files. Using readAsBinaryString +
          // type "binary" corrupts compressed cell data and silently garbles amounts,
          // which makes balanced journal entries appear unbalanced after import.
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

          const parsedRows = parseOracleSheetRows(rawRows);
          if (parsedRows.length === 0) {
            toast({
              title: "تنبيه",
              description: "لم يتم العثور على أسطر قيود أو مبالغ صالحة في ملف الإكسيل المرفوع.",
              variant: "destructive",
            });
            return;
          }

          const newEntries = groupOracleRowsIntoJournalEntriesOrdered(parsedRows);

          // Insert journal entries and link with treasuries & chart of accounts
          const accountsBeforeImport = new Set(
            (erpStore.getState().accounts || []).map((a) => a.code),
          );
          const result = erpStore.importJournalEntriesAndSyncTreasuries(newEntries, {
            sourceName: file.name,
          });
          const newlyCreatedAccounts = (erpStore.getState().accounts || []).filter(
            (a) => !accountsBeforeImport.has(a.code),
          );

          // Re-sync and update state
          showImportReport(result, newEntries, newlyCreatedAccounts);
          setErpState({ ...erpStore.getState() });

          toast({
            title: "✅ تم استيراد القيود بنجاح",
            description: `تم إدراج ${result.insertedEntries} قيد في دفتر اليومية، وإنشاء ${result.newAccountsCreated} حساب جديد في الدليل العام، وربط ${result.linkedTreasuryTransactions} حركة مالية بالخزائن الصحيحة.`,
          });
        } catch (err: any) {
          console.error(err);
          toast({
            title: "خطأ في معالجة الملف",
            description:
              err?.message || "حدث خطأ أثناء معالجة الملف. تأكد من أن الملف بنفس صيغة أوراكل.",
            variant: "destructive",
          });
        } finally {
          setIsImportingOracle(false);
          if (e.target) e.target.value = "";
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      console.error(err);
      toast({
        title: "خطأ في الاستيراد",
        description: err?.message || "حدث خطأ أثناء استيراد الملف.",
        variant: "destructive",
      });
      setIsImportingOracle(false);
      if (e.target) e.target.value = "";
    }
  };

  // Direct Text Paste & Import State
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteRawText, setPasteRawText] = useState("");
  const [parsedEntriesPreview, setParsedEntriesPreview] = useState<JournalEntry[]>([]);
  const [parsedRowsCount, setParsedRowsCount] = useState(0);
  const [isProcessingPaste, setIsProcessingPaste] = useState(false);

  const handleProcessPasteText = (textToProcess?: string) => {
    const text = textToProcess !== undefined ? textToProcess : pasteRawText;
    if (!text.trim()) {
      toast({
        title: "تنبيه",
        description: "يرجى لصق نص الجدول أولاً في الحقل المخصص.",
        variant: "destructive",
      });
      return;
    }
    try {
      setIsProcessingPaste(true);
      const rows = parseOracleTextToRows(text);
      if (rows.length === 0) {
        toast({
          title: "خطأ في قراءة البيانات",
          description: "لم يتم التعرف على أسطر قيود صالحة. يرجى التأكد من نسخ الجدول كاملاً.",
          variant: "destructive",
        });
        return;
      }
      const entries = groupOracleRowsIntoJournalEntriesOrdered(rows);
      setParsedEntriesPreview(entries);
      setParsedRowsCount(rows.length);
      toast({
        title: "✅ تم تحليل ومعالجة البيانات",
        description: `تم استخراج ${rows.length} سطر محاسبي وتجميعها في ${entries.length} قيد محاسبي مرتب ومنظم.`,
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تحليل البيانات الملصوقة.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingPaste(false);
    }
  };

  const handleConfirmPasteImport = () => {
    if (parsedEntriesPreview.length === 0) return;
    const pasteAccountsBeforeImport = new Set(
      (erpStore.getState().accounts || []).map((a) => a.code),
    );
    const result = erpStore.importJournalEntriesAndSyncTreasuries(parsedEntriesPreview, {
      sourceName: "معالجة واستيراد جدول القيود",
    });
    const pasteNewlyCreatedAccounts = (erpStore.getState().accounts || []).filter(
      (a) => !pasteAccountsBeforeImport.has(a.code),
    );
    showImportReport(result, parsedEntriesPreview, pasteNewlyCreatedAccounts);
    setErpState({ ...erpStore.getState() });
    setIsPasteModalOpen(false);
    setPasteRawText("");
    setParsedEntriesPreview([]);
    setParsedRowsCount(0);
    toast({
      title: "🎉 تم استيراد القيود بنجاح",
      description: `تم إدراج ${result.insertedEntries} قيد في دفتر اليومية، وإنشاء ${result.newAccountsCreated} حساب جديد في الدليل العام، وربط ${result.linkedTreasuryTransactions} حركة بالخزائن الصحيحة.`,
    });
  };
  const [selectedAccountCode, setSelectedAccountCode] = useState<string>("15010100"); // default to Admin USD treasury
  const [journalSearch, setJournalSearch] = useState("");
  const [journalCurrencyFilter, setJournalCurrencyFilter] = useState("ALL");
  const [journalBalanceFilter, setJournalBalanceFilter] = useState<
    "ALL" | "BALANCED" | "UNBALANCED"
  >("ALL");
  const [journalSortOrder, setJournalSortOrder] = useState<
    "oldest" | "newest" | "ref_asc" | "ref_desc"
  >("newest");
  const [journalStartDate, setJournalStartDate] = useState("");
  // Find imports and state section to add new states for viewing journal entries
  const [journalEndDate, setJournalEndDate] = useState("");

  const getEntryBalanceInfo = (je: JournalEntry) => {
    const currencies = Array.from(
      new Set((je.lines || []).map((l) => l.currency || je.currency || "USD")),
    );
    const single = currencies.length <= 1;
    const baseDebit = (je.lines || []).reduce((sum, l) => {
      return sum + getLineBaseValue(l.debit, l.rate || 1, l.currency || je.currency || "USD");
    }, 0);
    const baseCredit = (je.lines || []).reduce((sum, l) => {
      return sum + getLineBaseValue(l.credit, l.rate || 1, l.currency || je.currency || "USD");
    }, 0);
    const difference = Math.abs(baseDebit - baseCredit);
    return {
      difference,
      isBalanced: difference < 0.05,
      isSingleCurrency: single,
      currency: currencies[0] || je.currency || "USD",
      side: baseDebit < baseCredit ? ("debit" as const) : ("credit" as const),
    };
  };

  const checkIsEntryBalanced = (je: JournalEntry) => {
    return getEntryBalanceInfo(je).isBalanced;
  };

  const confirmBalanceAdjustment = () => {
    const entry = balanceAdjustmentEntry;
    if (!entry) return;

    try {
      const info = getEntryBalanceInfo(entry);
      if (info.isBalanced) {
        setBalanceAdjustmentEntry(null);
        return;
      }

      const diff = info.difference;
      const currency = info.isSingleCurrency ? info.currency : entry.currency || "USD";

      // Update the existing entry with a new line to balance it
      const balancingLine = {
        account_code: "509",
        account_name: "حساب فروق التسوية والتوجيه المحاسبي",
        debit: info.side === "debit" ? diff : 0,
        credit: info.side === "credit" ? diff : 0,
        currency,
        rate: 1,
        description: `تسوية أوتوماتيكية لمعالجة عجز جانب الاتزان`,
      };

      const updatedEntry = {
        ...entry,
        lines: [...(entry.lines || []), balancingLine as any],
      };

      const entryIndex = (erpStore.state.journalEntries || []).findIndex((e) => e.id === entry.id);

      if (entryIndex !== -1) {
        erpStore.state.journalEntries[entryIndex] = updatedEntry;
      } else {
        erpStore.state.journalEntries = [updatedEntry, ...(erpStore.state.journalEntries || [])];
      }

      erpStore.recalculateAccountBalances();
      erpStore.saveState();
      setErpState({ ...erpStore.getState() });
      setBalanceAdjustmentEntry(null);

      toast({
        title: "✨ تم تسوية القيد أوتوماتيكياً بنجاح",
        description: `تم إضافة سطر التسوية بقيمة (${diff.toLocaleString()} ${currency}) داخل نفس القيد رقم (${entry.reference || entry.id}).`,
      });
    } catch (err) {
      console.error("[تسوية القيد]", err);
      setErpState({ ...erpStore.getState() });
      setBalanceAdjustmentEntry(null);
      toast({
        title: "خطأ أثناء تسوية القيد",
        description: (err as any)?.message || "حدث خطأ غير متوقع أثناء محاولة تسوية القيد.",
        variant: "destructive",
      });
    }
  };

  // Journal Entry View/Print Dialog State
  const [selectedJournal, setSelectedJournal] = useState<JournalEntry | null>(null);
  const [isViewJournalOpen, setIsViewJournalOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  const handleClearAllJournals = () => {
    erpStore.clearAllJournalEntries();
    setErpState({ ...erpStore.getState() });
    setIsClearConfirmOpen(false);
    toast({
      title: "🗑️ تم مسح جميع القيود من الذاكرة",
      description: "تم تفريغ دفتر اليومية العامة وإعادة ضبط أرصدة الحسابات بنجاح.",
    });
  };

  // Attachment Dialog State
  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
  const [attachmentJournalId, setAttachmentJournalId] = useState("");
  const [currentAttachments, setCurrentAttachments] = useState<string[]>([]);

  // Manual Journal Entry Dialog state
  const [isNewEntryOpen, setIsNewEntryOpen] = useState(false);
  const [isConfirmPostOpen, setIsConfirmPostOpen] = useState(false);
  const [newEntryDesc, setNewEntryDesc] = useState("");
  const [newEntryRef, setNewEntryRef] = useState("");
  const [newEntryId, setNewEntryId] = useState("");
  const [newEntryDate, setNewEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const [newEntryAttachments, setNewEntryAttachments] = useState<string[]>([]);
  const [newEntryLines, setNewEntryLines] = useState<
    (JournalLine & { currency?: string; rate?: number })[]
  >([
    { account_code: "", debit: 0, credit: 0, currency: "USD", rate: 1 },
    { account_code: "", debit: 0, credit: 0, currency: "SSP", rate: 1 },
  ]);

  // Journal Entry Drafts & Exit Confirmation State
  const [isExitEntryConfirmOpen, setIsExitEntryConfirmOpen] = useState(false);
  const [autoOpenVoucherModal, setAutoOpenVoucherModal] = useState(false);
  const [journalDrafts, setJournalDrafts] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("restocash_journal_drafts") || "[]");
    } catch {
      return [];
    }
  });

  const handleSaveJournalAsDraft = () => {
    if (!newEntryDesc.trim() && newEntryLines.every((l) => !l.debit && !l.credit)) {
      toast({
        title: "تنبيه المسودة",
        description: "يرجى كتابة البيان المحاسبي أو إدخال مبالغ على الأقل لحفظ القيد كمسودة.",
        variant: "destructive",
      });
      return;
    }
    const newDraft = {
      id: `draft-je-${Date.now()}`,
      newEntryDate,
      newEntryRef,
      newEntryDesc: newEntryDesc.trim() || "مسودة قيد يومية",
      newEntryAttachments,
      newEntryLines,
      savedAt: new Date().toISOString(),
    };
    try {
      const existing = [newDraft, ...journalDrafts.filter((d) => d.id !== newDraft.id)].slice(0, 15);
      localStorage.setItem("restocash_journal_drafts", JSON.stringify(existing));
      setJournalDrafts(existing);
      toast({
        title: "💾 تم حفظ القيد كمسودة مؤقتة",
        description: `تم حفظ المسودة بنجاح (مرجع: ${newEntryRef}). يمكنك استعادتها في أي وقت.`,
      });
      setIsNewEntryOpen(false);
      setIsExitEntryConfirmOpen(false);
    } catch {
      toast({ title: "خطأ", description: "تعذر حفظ مسودة القيد.", variant: "destructive" });
    }
  };

  const handleLoadJournalDraft = (draft: any) => {
    setNewEntryDate(draft.newEntryDate || new Date().toISOString().split("T")[0]);
    setNewEntryRef(draft.newEntryRef || erpStore.generateJournalReference(draft.newEntryDate));
    setNewEntryDesc(draft.newEntryDesc || "");
    setNewEntryAttachments(draft.newEntryAttachments || []);
    setNewEntryLines(
      draft.newEntryLines || [
        { account_code: "", debit: 0, credit: 0, currency: "USD", rate: 1 },
        { account_code: "", debit: 0, credit: 0, currency: "SSP", rate: 1 },
      ],
    );
    setIsNewEntryOpen(true);
    toast({
      title: "تم استعادة مسودة القيد",
      description: `تم تحميل بيانات القيد المسودة بنجاح.`,
    });
  };

  const handleDeleteJournalDraft = (draftId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const updated = journalDrafts.filter((d) => d.id !== draftId);
    setJournalDrafts(updated);
    localStorage.setItem("restocash_journal_drafts", JSON.stringify(updated));
    toast({ title: "تم حذف المسودة" });
  };

  const handleRequestCloseNewEntry = () => {
    if (
      newEntryDesc.trim() ||
      newEntryLines.some((l) => l.debit > 0 || l.credit > 0 || l.account_code)
    ) {
      setIsExitEntryConfirmOpen(true);
    } else {
      setIsNewEntryOpen(false);
    }
  };

  // Edit Journal Entry State
  const [isEditEntryOpen, setIsEditEntryOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editEntryDesc, setEditEntryDesc] = useState("");
  const [editEntryRef, setEditEntryRef] = useState("");
  const [editEntryDate, setEditEntryDate] = useState("");
  const [editEntryLines, setEditEntryLines] = useState<
    (JournalLine & { currency?: string; rate?: number })[]
  >([]);

  // Delete Single Journal Entry State
  const [isDeleteSingleOpen, setIsDeleteSingleOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<JournalEntry | null>(null);

  // Closed Year / Period Alert Dialog State
  const [isClosedYearAlertOpen, setIsClosedYearAlertOpen] = useState(false);
  const [closedYearAlertMessage, setClosedYearAlertMessage] = useState("");

  const accounts = erpState?.accounts || [];
  const treasuries = erpState?.treasuries || [];
  const level4Accounts = useMemo(() => {
    return (accounts || []).filter(isLevel4Account);
  }, [accounts]);
  const journalEntries = erpState?.journalEntries || [];

  // Selected account details
  const currentAccount = useMemo(() => {
    return accounts.find((a) => a.code === selectedAccountCode);
  }, [accounts, selectedAccountCode]);

  // Compute ledger lines for the selected account
  const ledgerLines = useMemo(() => {
    if (!selectedAccountCode) return [];

    // Filter journal entries containing this account
    const matchingEntries: { entry: JournalEntry; line: JournalLine }[] = [];

    journalEntries.forEach((entry) => {
      entry.lines.forEach((line) => {
        if (line.account_code === selectedAccountCode) {
          matchingEntries.push({ entry, line });
        }
      });
    });

    // Sort matching entries oldest first for cumulative balance calculation
    matchingEntries.sort(
      (a, b) => new Date(a.entry.date).getTime() - new Date(b.entry.date).getTime(),
    );

    let balance = currentAccount?.initial_balance || 0;
    const isAssetOrExpense = currentAccount?.type === "asset" || currentAccount?.type === "expense";

    return matchingEntries
      .map(({ entry, line }, lineIdx) => {
        const debit = Number(line.debit) || 0;
        const credit = Number(line.credit) || 0;

        if (isAssetOrExpense) {
          balance += debit - credit;
        } else {
          balance += credit - debit;
        }

        return {
          id: `${entry.id}-${line.account_code}-${lineIdx}`,
          date: entry.date,
          description: entry.description,
          reference: entry.reference,
          currency: entry.currency || "USD",
          debit,
          credit,
          runningBalance: balance,
        };
      })
      .reverse(); // Display newest first in the UI
  }, [journalEntries, selectedAccountCode, currentAccount]);

  // Compute summaries
  const ledgerSummary = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;

    ledgerLines.forEach((l) => {
      totalDebit += l.debit;
      totalCredit += l.credit;
    });

    const isAssetOrExpense = currentAccount?.type === "asset" || currentAccount?.type === "expense";
    const netBalance = isAssetOrExpense
      ? (currentAccount?.initial_balance || 0) + totalDebit - totalCredit
      : (currentAccount?.initial_balance || 0) + totalCredit - totalDebit;

    return {
      totalDebit,
      totalCredit,
      netBalance,
      currency:
        currentAccount?.name_ar.includes("دولار") || currentAccount?.name_ar.includes("USD")
          ? "USD"
          : "EGP",
    };
  }, [ledgerLines, currentAccount]);

  // General Journal filtered entries
  const filteredJournal = useMemo(() => {
    const filtered = journalEntries.filter((je) => {
      // Search text
      const searchMatch =
        journalSearch === "" ||
        String(je.description || "")
          .toLowerCase()
          .includes(journalSearch.toLowerCase()) ||
        String(je.reference || "")
          .toLowerCase()
          .includes(journalSearch.toLowerCase()) ||
        String(je.id || "")
          .toLowerCase()
          .includes(journalSearch.toLowerCase()) ||
        je.lines.some((l) => {
          const accName = accounts.find((a) => a.code === l.account_code)?.name_ar || "";
          return (
            String(l.account_code || "").includes(journalSearch) ||
            accName.toLowerCase().includes(journalSearch.toLowerCase())
          );
        });

      // Currency filter
      const currencyMatch =
        journalCurrencyFilter === "ALL" || (je.currency || "USD") === journalCurrencyFilter;

      // Date match
      const dateMatch =
        (!journalStartDate || je.date >= journalStartDate) &&
        (!journalEndDate || je.date <= journalEndDate);

      // Balance filter
      const isBalanced = checkIsEntryBalanced(je);
      const balanceMatch =
        journalBalanceFilter === "ALL" ||
        (journalBalanceFilter === "BALANCED" && isBalanced) ||
        (journalBalanceFilter === "UNBALANCED" && !isBalanced);

      return searchMatch && currencyMatch && dateMatch && balanceMatch;
    });

    const parseRefNumber = (ref?: string) => {
      if (!ref) return 0;
      const parts = String(ref).split("/");
      if (parts.length === 2) {
        const p = Number(parts[0]) || 0;
        const j = Number(parts[1]) || 0;
        return p * 100000 + j;
      }
      return Number(String(ref).replace(/\D/g, "")) || 0;
    };

    return filtered.sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      const refA = parseRefNumber(a.reference);
      const refB = parseRefNumber(b.reference);
      const seqA = a.sequence ?? 0;
      const seqB = b.sequence ?? 0;

      const yearA = Number(String(a.date || "").slice(0, 4)) || 0;
      const yearB = Number(String(b.date || "").slice(0, 4)) || 0;
      if (journalSortOrder === "oldest") {
        if (yearA !== yearB) return yearA - yearB;
        if (refA !== refB) return refA - refB;
        if (seqA !== seqB) return seqA - seqB;
        if (dateA !== dateB) return dateA - dateB;
        return a.id.localeCompare(b.id);
      } else if (journalSortOrder === "newest") {
        if (yearA !== yearB) return yearB - yearA;
        if (refA !== refB) return refB - refA;
        if (seqA !== seqB) return seqB - seqA;
        if (dateA !== dateB) return dateB - dateA;
        return b.id.localeCompare(a.id);
      } else if (journalSortOrder === "ref_asc") {
        if (yearA !== yearB) return yearA - yearB;
        if (refA !== refB) return refA - refB;
        if (seqA !== seqB) return seqA - seqB;
        return dateA - dateB;
      } else if (journalSortOrder === "ref_desc") {
        if (yearA !== yearB) return yearB - yearA;
        if (refA !== refB) return refB - refA;
        if (seqA !== seqB) return seqB - seqA;
        return dateB - dateA;
      }
      return dateA - dateB;
    });
  }, [
    journalEntries,
    journalSearch,
    journalCurrencyFilter,
    journalBalanceFilter,
    journalStartDate,
    journalEndDate,
    journalSortOrder,
    accounts,
  ]);

  const [journalPage, setJournalPage] = useState(1);
  const ITEMS_PER_PAGE = 25;

  useEffect(() => {
    setJournalPage(1);
  }, [
    journalSearch,
    journalCurrencyFilter,
    journalBalanceFilter,
    journalStartDate,
    journalEndDate,
    journalSortOrder,
  ]);

  const journalStats = useMemo(() => {
    let balanced = 0;
    let unbalanced = 0;
    let usd = 0;
    let ssp = 0;
    let egp = 0;

    (journalEntries || []).forEach((j) => {
      if (checkIsEntryBalanced(j)) {
        balanced++;
      } else {
        unbalanced++;
      }
      const curr = j.currency || "USD";
      if (curr === "USD") usd++;
      else if (curr === "SSP") ssp++;
      else if (curr === "EGP") egp++;
    });

    return {
      total: journalEntries.length,
      balanced,
      unbalanced,
      usd,
      ssp,
      egp,
    };
  }, [journalEntries]);

  const totalPages = Math.max(1, Math.ceil(filteredJournal.length / ITEMS_PER_PAGE));

  const paginatedJournal = useMemo(() => {
    const start = (journalPage - 1) * ITEMS_PER_PAGE;
    return filteredJournal.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredJournal, journalPage]);

  // Trial Balance calculation
  const trialBalance = useMemo(() => {
    const rows = accounts.map((acc) => {
      let totalDebit = 0;
      let totalCredit = 0;

      // Scan journal entries
      journalEntries.forEach((je) => {
        je.lines.forEach((l) => {
          if (l.account_code === acc.code) {
            totalDebit += Number(l.debit) || 0;
            totalCredit += Number(l.credit) || 0;
          }
        });
      });

      const isAssetOrExpense = acc.type === "asset" || acc.type === "expense";
      const initial = Number(acc.initial_balance) || 0;

      let endingBalance = 0;
      let balanceType: "Dr" | "Cr" = "Dr";

      if (isAssetOrExpense) {
        endingBalance = initial + totalDebit - totalCredit;
        balanceType = endingBalance >= 0 ? "Dr" : "Cr";
        if (endingBalance < 0) endingBalance = Math.abs(endingBalance);
      } else {
        endingBalance = initial + totalCredit - totalDebit;
        balanceType = endingBalance >= 0 ? "Cr" : "Dr";
        if (endingBalance < 0) endingBalance = Math.abs(endingBalance);
      }

      return {
        code: acc.code,
        name: acc.name_ar,
        type: acc.type,
        initial,
        debitSum: totalDebit,
        creditSum: totalCredit,
        endingBalance,
        balanceType,
        currency: acc.name_ar.includes("دولار") ? "USD" : "EGP",
      };
    });

    const totalDebits = rows.reduce(
      (sum, r) => sum + (r.balanceType === "Dr" ? r.endingBalance : 0),
      0,
    );
    const totalCredits = rows.reduce(
      (sum, r) => sum + (r.balanceType === "Cr" ? r.endingBalance : 0),
      0,
    );

    return {
      rows,
      totalDebits,
      totalCredits,
      isBalanced: Math.abs(totalDebits - totalCredits) < 0.1,
    };
  }, [accounts, journalEntries]);

  // Income Statement
  const financialStatements = useMemo(() => {
    // Revenues
    const revenueAccounts = trialBalance.rows.filter((r) => r.type === "revenue");
    const totalRevenue = revenueAccounts.reduce(
      (sum, r) => sum + (r.balanceType === "Cr" ? r.endingBalance : -r.endingBalance),
      0,
    );

    // Expenses
    const expenseAccounts = trialBalance.rows.filter((r) => r.type === "expense");
    const totalExpense = expenseAccounts.reduce(
      (sum, r) => sum + (r.balanceType === "Dr" ? r.endingBalance : -r.endingBalance),
      0,
    );

    const netIncome = totalRevenue - totalExpense;

    // Assets
    const assetAccounts = trialBalance.rows.filter((r) => r.type === "asset");
    console.log("DEBUG: assetAccounts", assetAccounts);
    const totalAssets = assetAccounts.reduce(
      (sum, r) => sum + (r.balanceType === "Dr" ? r.endingBalance : -r.endingBalance),
      0,
    );
    console.log("DEBUG: totalAssets", totalAssets);

    // Liabilities
    const liabilityAccounts = trialBalance.rows.filter((r) => r.type === "liability");
    const totalLiabilities = liabilityAccounts.reduce(
      (sum, r) => sum + (r.balanceType === "Cr" ? r.endingBalance : -r.endingBalance),
      0,
    );

    // Equity
    const equityAccounts = trialBalance.rows.filter((r) => r.type === "equity");
    console.log("DEBUG: equityAccounts", equityAccounts);
    const totalEquity = equityAccounts.reduce((sum, r) => {
      const val = r.balanceType === "Cr" ? r.endingBalance : -r.endingBalance;
      console.log(
        `DEBUG: Equity Account ${r.code} (${r.name_ar}): Type=${r.balanceType}, Bal=${r.endingBalance}, Contribution=${val}`,
      );
      return sum + val;
    }, 0);
    console.log("DEBUG: totalEquity", totalEquity);

    return {
      revenueAccounts,
      totalRevenue,
      expenseAccounts,
      totalExpense,
      netIncome,
      assetAccounts,
      totalAssets,
      liabilityAccounts,
      totalLiabilities,
      equityAccounts,
      totalEquity,
      isBalanceSheetBalanced:
        Math.abs(totalAssets - (totalLiabilities + totalEquity + netIncome)) < 1.0,
    };
  }, [trialBalance]);

  // Open and initialize manual entry form with smart MM/NN reference and current date
  const handleOpenNewEntry = () => {
    const today = new Date().toISOString().split("T")[0];
    setNewEntryDate(today);
    setNewEntryRef(erpStore.generateJournalReference(today));
    setNewEntryId("");
    setNewEntryDesc("");
    setNewEntryAttachments([]);
    setNewEntryLines([
      { account_code: "", debit: 0, credit: 0, currency: "USD", rate: 1 },
      { account_code: "", debit: 0, credit: 0, currency: "SSP", rate: 1 },
    ]);
    setIsNewEntryOpen(true);
  };

  // When date changes, update date and auto-recalculate MM/NN journal sequence for that month
  const handleEntryDateChange = (dateVal: string) => {
    setNewEntryDate(dateVal);
    // If the reference was empty or matches standard MM/NN pattern, auto-sync to newly selected month
    if (!newEntryRef || /^\d{2}\/\d{2,}$/.test(newEntryRef.trim())) {
      setNewEntryRef(erpStore.generateJournalReference(dateVal));
    }
  };

  // Add line to manual journal entry
  const addEntryLine = () => {
    const lastCurrency = newEntryLines[newEntryLines.length - 1]?.currency || "USD";
    setNewEntryLines([
      ...newEntryLines,
      { account_code: "", debit: 0, credit: 0, currency: lastCurrency, rate: 1 },
    ]);
  };

  // Remove line from manual journal entry
  const removeEntryLine = (index: number) => {
    if (newEntryLines.length <= 2) {
      toast({
        title: "خطأ في التعديل",
        description: "يجب أن يحتوي القيد المحاسبي على سطرين على الأقل",
        variant: "destructive",
      });
      return;
    }
    const lines = [...newEntryLines];
    lines.splice(index, 1);
    setNewEntryLines(lines);
  };

  // Smart handle account selection for line
  const handleAccountSelectForLine = (index: number, accountCode: string, account?: Account) => {
    const lines = [...newEntryLines];
    lines[index].account_code = accountCode;
    if (account) {
      let detectedCurrency = account.currency || "EGP";
      if (account.name_ar.includes("دولار") || account.name_ar.includes("USD")) {
        detectedCurrency = "USD";
      } else if (account.name_ar.includes("سوداني") || account.name_ar.includes("SSP")) {
        detectedCurrency = "SSP";
      } else if (account.name_ar.includes("مصري") || account.name_ar.includes("EGP")) {
        detectedCurrency = "EGP";
      }
      lines[index].currency = detectedCurrency;
      if (!lines[index].rate) {
        lines[index].rate = 1.0;
      }
    }
    setNewEntryLines(lines);
  };

  // Update line field
  const updateLine = (index: number, field: string, value: any) => {
    const lines = [...newEntryLines];
    if (field === "debit") {
      lines[index].debit = Number(value) || 0;
      if (lines[index].debit > 0) lines[index].credit = 0; // standard accounting
    } else if (field === "credit") {
      lines[index].credit = Number(value) || 0;
      if (lines[index].credit > 0) lines[index].debit = 0; // standard accounting
    } else if (field === "rate") {
      lines[index].rate = Number(value) || 1;
    } else if (field === "currency") {
      lines[index].currency = value;
    } else {
      (lines[index] as any)[field] = value;
    }
    setNewEntryLines(lines);
  };

  // Compute manual entry balance details with multi-currency exchange rates
  const newEntryTotals = useMemo(() => {
    const debitsBase = newEntryLines.reduce(
      (sum, l) => sum + getLineBaseValue(l.debit, l.rate || 1, l.currency || "USD"),
      0,
    );
    const creditsBase = newEntryLines.reduce(
      (sum, l) => sum + getLineBaseValue(l.credit, l.rate || 1, l.currency || "USD"),
      0,
    );
    const difference = Math.abs(debitsBase - creditsBase);
    return {
      debits: debitsBase,
      credits: creditsBase,
      difference,
      isBalanced: difference < 0.05,
    };
  }, [newEntryLines]);

  // Compute edit entry balance details
  const editEntryTotals = useMemo(() => {
    const debitsBase = editEntryLines.reduce(
      (sum, l) => sum + getLineBaseValue(l.debit, l.rate || 1, l.currency || "USD"),
      0,
    );
    const creditsBase = editEntryLines.reduce(
      (sum, l) => sum + getLineBaseValue(l.credit, l.rate || 1, l.currency || "USD"),
      0,
    );
    const difference = Math.abs(debitsBase - creditsBase);
    return {
      debits: debitsBase,
      credits: creditsBase,
      difference,
      isBalanced: difference < 0.05,
    };
  }, [editEntryLines]);

  // Handle opening confirmation dialog for manual journal entry
  const handlePostEntry = () => {
    if (!newEntryDesc.trim()) {
      toast({
        title: "خطأ في الإدخال",
        description: "يرجى كتابة شرح توضيحي للقيد اليومي",
        variant: "destructive",
      });
      return;
    }

    if (newEntryLines.some((l) => !l.account_code)) {
      toast({
        title: "خطأ في الحسابات",
        description: "يرجى تحديد حساب محاسبي صالح لجميع الأسطر",
        variant: "destructive",
      });
      return;
    }

    const invalidLevel4Line = newEntryLines.find((l) => {
      const acc = accounts.find((a) => a.code === l.account_code);
      return !acc || !isLevel4Account(acc);
    });
    if (invalidLevel4Line) {
      toast({
        title: "حساب غير مصرح به للقيود",
        description: `الحساب (${invalidLevel4Line.account_code}) ليس من الدرجة الرابعة. العمليات والقيود المحاسبية مسموحة حصراً على حسابات الدرجة الرابعة التشغيلية والفرعية.`,
        variant: "destructive",
      });
      return;
    }

    if (newEntryTotals.debits <= 0) {
      toast({
        title: "خطأ في المبالغ",
        description: "يجب أن تكون قيمة القيد المحاسبي أكبر من صفر",
        variant: "destructive",
      });
      return;
    }

    if (!newEntryTotals.isBalanced) {
      toast({
        title: "القيد غير متزن",
        description: "مجموع الجانب المدين المعادل يجب أن يساوي تماماً مجموع الجانب الدائن المعادل",
        variant: "destructive",
      });
      return;
    }

    // Check fiscal year locking
    const check = erpStore.checkCanModifyJournalEntry(newEntryDate);
    if (!check.allowed) {
      setClosedYearAlertMessage(
        check.reason || "لا يمكن إضافة أو تعديل القيود في فترة مالية مغلقة.",
      );
      setIsClosedYearAlertOpen(true);
      toast({
        title: "فترة مالية مقفلة 🔒",
        description: check.reason,
        variant: "destructive",
      });
      return;
    }

    // Everything is valid -> open confirmation dialog
    setIsConfirmPostOpen(true);
  };

  // Execute actual entry posting and update account balances
  const handleExecutePost = () => {
    try {
      const preparedLines: JournalLine[] = newEntryLines.map((l) => ({
        account_code: l.account_code,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        currency: l.currency || "USD",
        rate: Number(l.rate) || 1,
      }));

      // Call state store to register entry & update accounts
      erpStore.addJournalEntry(
        newEntryDesc,
        preparedLines,
        newEntryRef || undefined,
        preparedLines[0]?.currency || "USD",
        newEntryDate,
        newEntryId || undefined,
        newEntryAttachments,
      );

      toast({
        title: "تم حفظ القيد وترحيله بنجاح",
        description: "تم إدراج القيد المزدوج في دفتر القيود وتحديث أرصدة الحسابات المعنية فوراً",
      });

      // Reset Form & Close Modal
      setNewEntryId("");
      setNewEntryAttachments([]);
      setNewEntryDesc("");
      setNewEntryRef("");
      setNewEntryLines([
        { account_code: "", debit: 0, credit: 0, currency: "USD", rate: 1 },
        { account_code: "", debit: 0, credit: 0, currency: "SSP", rate: 1 },
      ]);
      setIsConfirmPostOpen(false);
      setIsNewEntryOpen(false);
    } catch (err: any) {
      setClosedYearAlertMessage(err?.message || "حدث خطأ أثناء حفظ القيد.");
      setIsClosedYearAlertOpen(true);
      toast({
        title: "تعذر حفظ القيد",
        description: err?.message,
        variant: "destructive",
      });
    }
  };

  // Handler for Requesting Entry Edit
  const handleRequestEditEntry = (entry: JournalEntry) => {
    const check = erpStore.checkCanModifyJournalEntry(entry.date);
    if (!check.allowed) {
      setClosedYearAlertMessage(
        check.reason ||
          "You cannot edit restrictions in a closed year. (لا يمكنك تعديل أو حذف القيود في سنة أو فترة مالية مغلقة)",
      );
      setIsClosedYearAlertOpen(true);
      toast({
        title: "فترة مالية مقفلة 🔒",
        description: check.reason || "You cannot edit restrictions in a closed year.",
        variant: "destructive",
      });
      return;
    }

    setEditingEntryId(entry.id);
    setEditEntryDesc(entry.description || "");
    setEditEntryRef(entry.reference || "");
    setEditEntryDate(entry.date || new Date().toISOString().split("T")[0]);
    setEditEntryLines(
      (entry.lines || []).map((l) => ({
        account_code: l.account_code,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        currency: l.currency || entry.currency || "USD",
        rate: Number(l.rate) || 1,
        description: l.description || "",
      })),
    );
    setIsEditEntryOpen(true);
  };

  // Handler for Requesting Entry Deletion
  const handleRequestDeleteEntry = (entry: JournalEntry) => {
    const check = erpStore.checkCanModifyJournalEntry(entry.date);
    if (!check.allowed) {
      setClosedYearAlertMessage(
        check.reason ||
          "You cannot edit restrictions in a closed year. (لا يمكنك تعديل أو حذف القيود في سنة أو فترة مالية مغلقة)",
      );
      setIsClosedYearAlertOpen(true);
      toast({
        title: "فترة مالية مقفلة 🔒",
        description: check.reason || "You cannot edit restrictions in a closed year.",
        variant: "destructive",
      });
      return;
    }

    setEntryToDelete(entry);
    setIsDeleteSingleOpen(true);
  };

  // Confirm Single Journal Entry Deletion
  const handleConfirmDeleteSingle = () => {
    if (!entryToDelete) return;
    const res = erpStore.deleteSingleJournalEntry(entryToDelete.id);
    if (res.success) {
      setErpState({ ...erpStore.getState() });
      setIsDeleteSingleOpen(false);
      setEntryToDelete(null);
      toast({
        title: "تم حذف القيد بنجاح 🗑️",
        description: `تم حذف القيد رقم ${entryToDelete.reference || entryToDelete.id} وإعادة احتساب الأرصدة.`,
      });
    } else {
      setClosedYearAlertMessage(res.error || "لا يمكن حذف هذا القيد.");
      setIsClosedYearAlertOpen(true);
      toast({
        title: "فشل حذف القيد",
        description: res.error || "حدث خطأ أثناء محاولة حذف القيد",
        variant: "destructive",
      });
    }
  };

  // Save changes to edited entry
  const handleSaveEditEntry = () => {
    if (!editingEntryId) return;
    if (!editEntryDesc.trim()) {
      toast({
        title: "خطأ في الإدخال",
        description: "يرجى كتابة شرح توضيحي للقيد اليومي",
        variant: "destructive",
      });
      return;
    }

    if (editEntryLines.some((l) => !l.account_code)) {
      toast({
        title: "خطأ في الحسابات",
        description: "يرجى تحديد حساب محاسبي صالح لجميع الأسطر",
        variant: "destructive",
      });
      return;
    }

    const invalidEditLevel4Line = editEntryLines.find((l) => {
      const acc = accounts.find((a) => a.code === l.account_code);
      return !acc || !isLevel4Account(acc);
    });
    if (invalidEditLevel4Line) {
      toast({
        title: "حساب غير مصرح به للقيود",
        description: `الحساب (${invalidEditLevel4Line.account_code}) ليس من الدرجة الرابعة. العمليات والقيود المحاسبية مسموحة حصراً على حسابات الدرجة الرابعة التشغيلية والفرعية.`,
        variant: "destructive",
      });
      return;
    }

    if (!editEntryTotals.isBalanced) {
      toast({
        title: "القيد غير متزن",
        description: "مجموع الجانب المدين المعادل يجب أن يساوي تماماً مجموع الجانب الدائن المعادل",
        variant: "destructive",
      });
      return;
    }

    const preparedLines: JournalLine[] = editEntryLines.map((l) => ({
      account_code: l.account_code,
      debit: Number(l.debit) || 0,
      credit: Number(l.credit) || 0,
      currency: l.currency || "USD",
      rate: Number(l.rate) || 1,
      description: l.description,
    }));

    const res = erpStore.updateExistingJournalEntry(editingEntryId, {
      description: editEntryDesc,
      date: editEntryDate,
      reference: editEntryRef,
      currency: preparedLines[0]?.currency || "USD",
      lines: preparedLines,
    });

    if (res.success) {
      setErpState({ ...erpStore.getState() });
      setIsEditEntryOpen(false);
      setEditingEntryId(null);
      toast({
        title: "تم تعديل القيد بنجاح ✓",
        description: `تم تحديث القيد وتعديل موازين الحسابات المعنية فوراً.`,
      });
    } else {
      setClosedYearAlertMessage(res.error || "لا يمكن تعديل القيد.");
      setIsClosedYearAlertOpen(true);
      toast({
        title: "فشل التعديل",
        description: res.error || "لا يمكن تعديل القيد",
        variant: "destructive",
      });
    }
  };

  // Exports
  const handleExportLedger = () => {
    const formatted = ledgerLines.map((l) => ({
      التاريخ: l.date,
      "رقم القيد": l.reference,
      "شرح الحركة / البيان": l.description,
      العملة: l.currency,
      "مدين (Debit)": l.debit || "",
      "دائن (Credit)": l.credit || "",
      "الرصيد التراكمي": l.runningBalance,
    }));

    const worksheet = XLSX.utils.json_to_sheet(formatted);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, currentAccount?.name_ar || "حساب الأستاذ");
    XLSX.writeFile(workbook, `كشف_حساب_${currentAccount?.name_ar}_${selectedAccountCode}.xlsx`);
    toast({ title: "تم التصدير بنجاح", description: "تم تحميل كشف الحساب بصيغة Excel" });
  };

  const handleExportJournal = () => {
    const rows: any[] = [];
    filteredJournal.forEach((je) => {
      je.lines.forEach((l, idx) => {
        const acc = accounts.find((a) => a.code === l.account_code);
        rows.push({
          "رقم القيد": je.reference || je.id,
          التاريخ: je.date,
          "بيان القيد العام": idx === 0 ? je.description : "",
          "كود الحساب": l.account_code,
          "اسم الحساب": acc?.name_ar || "",
          العملة: je.currency,
          مدين: l.debit || "",
          دائن: l.credit || "",
          "المعرف الداخلي": je.id,
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "دفتر اليومية العامة");
    XLSX.writeFile(workbook, `اليومية_العامة_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast({ title: "تم التصدير بنجاح", description: "تم تحميل دفتر اليومية العامة بصيغة Excel" });
  };

  const handleExportTrialBalance = () => {
    const formatted = trialBalance.rows.map((r) => ({
      "كود الحساب": r.code,
      "اسم الحساب": r.name,
      النوع: ACCOUNT_TYPE_LABELS[r.type],
      الافتتاحي: r.initial || 0,
      "مجموع المدين": r.debitSum,
      "مجموع الدائن": r.creditSum,
      "الرصيد النهائي": r.endingBalance,
      "طبيعة الرصيد": r.balanceType === "Dr" ? "مدين" : "دائن",
      "العملة الأساسية": r.currency,
    }));

    const worksheet = XLSX.utils.json_to_sheet(formatted);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ميزان المراجعة");
    XLSX.writeFile(workbook, `ميزان_المراجعة_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast({ title: "تم التصدير بنجاح", description: "تم تحميل ميزان المراجعة بصيغة Excel" });
  };

  return (
    <div className="p-3 sm:p-6 space-y-5 sm:space-y-6 max-w-7xl mx-auto w-full min-w-0">


      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Landmark className="h-6 w-6 text-primary shrink-0" />
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
              الإدارة المالية
            </h1>
            <Badge className="bg-primary/10 text-primary text-xs font-bold px-2.5 py-0.5 rounded-lg">
              حساب الأستاذ · دليل الحسابات · الخزائن · التقارير
            </Badge>
            {hasUnsavedChanges && (
              <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-2 py-0.5 animate-pulse">
                {unsavedEntries.length} قيد بحاجة للحفظ
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            الإدارة المالية والمحاسبية الموحدة: حساب الأستاذ العام، دفتر اليومية، سندات الصرف
            والقبض، شجرة الحسابات، إدارة الخزائن، والتقارير والقوائم الختامية.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          {/* Save & Persist All Data */}
          <Button
            onClick={() => setIsSaveConfirmOpen(true)}
            disabled={isSavingToDb || !hasUnsavedChanges}
            className={`gap-2 rounded-xl text-white font-bold shadow-sm ${
              hasUnsavedChanges
                ? "bg-amber-600 hover:bg-amber-700 ring-2 ring-amber-400"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            <Save className={`h-4 w-4 ${isSavingToDb ? "animate-spin" : ""}`} />
            {isSavingToDb ? "جاري الحفظ في قاعدة البيانات..." : "حفظ القيود في قاعدة البيانات"}
            <Badge
              variant="secondary"
              className="mr-1 bg-black/30 text-white text-[11px] px-1.5 py-0 font-mono"
            >
              {unsavedEntries.length} قيد بحاجة للحفظ
            </Badge>
          </Button>

          {/* Add Manual Entry Dialog */}
          <Dialog
            open={isNewEntryOpen}
            onOpenChange={(open) => {
              if (open) {
                handleOpenNewEntry();
              } else {
                setIsNewEntryOpen(false);
              }
            }}
          >
            <Button onClick={handleOpenNewEntry} className="gap-2 rounded-xl">
              <Plus className="h-4 w-4" />
              إضافة قيد يومي مزدوج
            </Button>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader className="text-right">
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <Scale className="h-5 w-5 text-primary" />
                  تسجيل قيد يومي يدوي مزدوج
                </DialogTitle>
                <DialogDescription>
                  أدخل أسطر الجانبين المدين والدائن مع الحسابات الصحيحة لإنشاء قيد مزدوج متزن ومرحّل
                  تلقائياً مع ترقيم (الفترة/رقم القيد مثل 01/02).
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 my-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Journal Number / Sequence (Period/JournalNum) */}
                  <div className="space-y-1.5">
                    <Label className="font-bold text-sm flex items-center gap-1">
                      رقم القيد (الفترة/القيد: 01/02)
                      <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      placeholder="مثال: 01/02"
                      value={newEntryRef}
                      onChange={(e) => setNewEntryRef(e.target.value)}
                      className="font-mono font-bold text-primary"
                    />
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      رقم الفترة / رقم القيد (مثال: 01/02). يتم التحديث تلقائياً مع حرية التعديل.
                    </p>
                  </div>

                  {/* Date Picker */}
                  <div className="space-y-1.5">
                    <Label className="font-bold text-sm flex items-center gap-1">
                      تاريخ القيد
                      <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      type="date"
                      value={newEntryDate}
                      onChange={(e) => handleEntryDateChange(e.target.value)}
                    />
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      تغيير التاريخ يحدّث الشهر تلقائياً مع حرية تعديله.
                    </p>
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5 col-span-1 md:col-span-2">
                    <Label className="font-bold text-sm flex items-center gap-1">
                      شرح وتوضيح القيد المحاسبي
                      <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      placeholder="مثال: إثبات إيراد مبيعات أو سداد مصروف الضيافة..."
                      value={newEntryDesc}
                      onChange={(e) => setNewEntryDesc(e.target.value)}
                    />
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      البيان العام للقيد الذي يظهر في اليومية وسندات الصرف.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {/* Internal ID (Optional) */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      معرف داخلي للنظام (اختياري)
                    </Label>
                    <Input
                      placeholder="تلقائي (مثال: JV-1001)"
                      value={newEntryId}
                      onChange={(e) => setNewEntryId(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>

                  {/* Attachments */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      مرفقات القيد (مستند / فاتورة)
                    </Label>
                    <Input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const result = event.target?.result as string;
                            if (result) {
                              setNewEntryAttachments([...newEntryAttachments, result]);
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    {newEntryAttachments.length > 0 && (
                      <div className="text-xs text-primary font-bold mt-0.5">
                        تم إرفاق {newEntryAttachments.length} مستند
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">
                      أسطر الحركة المالية (Double-Entry lines)
                    </h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setNewEntryLines([
                          ...newEntryLines,
                          {
                            account_code: "",
                            debit: 0,
                            credit: 0,
                            description: "",
                            currency: "USD",
                            rate: 1,
                          },
                        ])
                      }
                      className="gap-1.5 rounded-xl border-dashed"
                    >
                      <PlusCircle className="h-4 w-4" />
                      إضافة سطر
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {newEntryLines.map((line, index) => (
                      <div
                        key={index}
                        className="space-y-2 bg-muted/40 p-3.5 rounded-xl border border-border shadow-2xs transition hover:border-primary/40"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
                          {/* Account Search Selector */}
                          <div className="md:col-span-4 space-y-1">
                            <Label className="text-xs font-semibold">
                              اختر الحساب (بحث بالاسم أو الرقم) *
                            </Label>
                            <AccountSearchSelect
                              value={line.account_code}
                              onChange={(code, acc) => handleAccountSelectForLine(index, code, acc)}
                              accounts={level4Accounts}
                              level4Only={true}
                              placeholder="اختر حساب تشغيلي من الدرجة الرابعة..."
                            />
                          </div>

                          {/* Line Currency */}
                          <div className="md:col-span-2 space-y-1">
                            <Label className="text-xs font-semibold">العملة</Label>
                            <Select
                              value={line.currency || "USD"}
                              onValueChange={(val) => updateLine(index, "currency", val)}
                            >
                              <SelectTrigger className="bg-card h-9 text-xs">
                                <SelectValue placeholder="العملة" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="USD">USD ($)</SelectItem>
                                <SelectItem value="EGP">EGP (ج.م)</SelectItem>
                                <SelectItem value="SSP">SSP (ج.س)</SelectItem>
                                <SelectItem value="SAR">SAR (ر.س)</SelectItem>
                                <SelectItem value="EUR">EUR (€)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Exchange Rate / Factor */}
                          <div className="md:col-span-2 space-y-1">
                            <Label className="text-xs font-semibold">Rate (المعامل)</Label>
                            <Input
                              type="number"
                              min="0.0001"
                              step="any"
                              placeholder="1.00"
                              className="bg-card h-9 text-xs font-mono"
                              value={line.rate !== undefined ? line.rate : 1}
                              onChange={(e) => updateLine(index, "rate", e.target.value)}
                            />
                          </div>

                          {/* Debit */}
                          <div className="md:col-span-2 space-y-1">
                            <Label className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                              مدين (Debit)
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0.00"
                              className="bg-card h-9 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400"
                              value={line.debit || ""}
                              onChange={(e) => updateLine(index, "debit", e.target.value)}
                              disabled={line.credit > 0}
                            />
                          </div>

                          {/* Credit */}
                          <div className="md:col-span-2 space-y-1">
                            <Label className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                              دائن (Credit)
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0.00"
                              className="bg-card h-9 text-xs font-mono font-bold text-rose-600 dark:text-rose-400"
                              value={line.credit || ""}
                              onChange={(e) => updateLine(index, "credit", e.target.value)}
                              disabled={line.debit > 0}
                            />
                          </div>
                        </div>

                        {/* Equivalents and line summary row */}
                        <div className="flex items-center justify-between text-[11px] pt-1.5 text-muted-foreground border-t border-border/50">
                          <div className="flex items-center gap-2">
                            {(line.debit > 0 || line.credit > 0) && (
                              <Badge
                                variant="secondary"
                                className="font-mono text-[10px] bg-primary/10 text-primary border-primary/20"
                              >
                                المعادل بالعملة الأساسية (USD):{" "}
                                {getLineBaseValue(
                                  line.debit || line.credit || 0,
                                  line.rate || 1,
                                  line.currency || "USD",
                                ).toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </Badge>
                            )}
                            <span className="text-[11px]">
                              عملة السطر:{" "}
                              <strong className="font-mono text-foreground font-semibold">
                                {line.currency || "USD"}
                              </strong>
                            </span>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeEntryLine(index)}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive h-7 px-2 text-[11px] gap-1 rounded-md"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            حذف السطر
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Balancer indicator */}
                <div className="p-4 rounded-xl border flex flex-col md:flex-row items-center justify-between gap-4 bg-muted/60 dark:bg-muted/30">
                  <div className="flex flex-wrap items-center gap-6">
                    <div>
                      <span className="text-xs text-muted-foreground block">
                        إجمالي المدين (المعادل):
                      </span>
                      <p className="text-sm font-semibold font-mono text-emerald-600 dark:text-emerald-400">
                        {newEntryTotals.debits.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        <span className="text-xs text-muted-foreground font-sans">USD</span>
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">
                        إجمالي الدائن (المعادل):
                      </span>
                      <p className="text-sm font-semibold font-mono text-emerald-600 dark:text-emerald-400">
                        {newEntryTotals.credits.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        <span className="text-xs text-muted-foreground font-sans">USD</span>
                      </p>
                    </div>
                    <div className="border-r pr-6 border-border">
                      <span className="text-xs text-muted-foreground block">الصافي / الفرق:</span>
                      <p
                        className={`text-sm font-bold font-mono ${
                          newEntryTotals.isBalanced
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {newEntryTotals.difference.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        <span className="text-xs font-sans">USD</span>
                      </p>
                    </div>
                    <div className="border-r pr-6 border-border">
                      <span className="text-xs text-muted-foreground block">حالة القيد:</span>
                      <Badge
                        className={`mt-0.5 text-xs font-semibold ${
                          newEntryTotals.isBalanced
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300"
                        }`}
                      >
                        {newEntryTotals.isBalanced ? "متزن ✓" : "غير متزن ✗"}
                      </Badge>
                    </div>
                  </div>

                  {!newEntryTotals.isBalanced && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200 dark:border-amber-800">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>تنبيه: يجب توازن أطراف الحركة بالعملة الأساسية لترحيل القيد.</span>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-4 border-t border-border/70">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveJournalAsDraft}
                    className="gap-1.5 border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-xl font-bold text-xs"
                  >
                    <Save size={15} />
                    <span>حفظ كمسودة مؤقتة</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleRequestCloseNewEntry}
                    className="rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted"
                  >
                    إلغاء وخروج
                  </Button>
                </div>

                <Button
                  type="button"
                  onClick={() => setIsConfirmPostOpen(true)}
                  disabled={
                    !newEntryTotals.isBalanced || newEntryTotals.debits <= 0 || !newEntryDesc.trim()
                  }
                  className="w-full sm:w-auto rounded-xl font-black text-xs sm:text-sm px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md gap-2"
                >
                  <CheckCircle2 size={16} />
                  <span>مراجعة وتأكيد ترحيل القيد 🚀</span>
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Exit Confirmation Dialog for Journal Entry */}
          <AlertDialog open={isExitEntryConfirmOpen} onOpenChange={setIsExitEntryConfirmOpen}>
            <AlertDialogContent className="max-w-md text-right rounded-3xl" dir="rtl">
              <AlertDialogHeader className="text-right space-y-2">
                <AlertDialogTitle className="text-base font-black flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  خروج بدون حفظ القيد المحاسبي؟
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
                  لديك بيانات تم إدخالها في هذا القيد المحاسبي. هل تريد حفظ القيد كمسودة مؤقتة لاستعادتها لاحقاً أم التجاهل والخروج؟
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2 mt-4 flex-wrap">
                <AlertDialogCancel onClick={() => setIsExitEntryConfirmOpen(false)}>
                  متابعة التعديل
                </AlertDialogCancel>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsExitEntryConfirmOpen(false);
                    setIsNewEntryOpen(false);
                  }}
                  className="text-rose-600 border-rose-200 hover:bg-rose-50"
                >
                  تجاهل والخروج
                </Button>
                <Button
                  onClick={handleSaveJournalAsDraft}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                >
                  💾 حفظ كمسودة مؤقتة
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Confirmation Alert Dialog */}
          <AlertDialog open={isConfirmPostOpen} onOpenChange={setIsConfirmPostOpen}>
            <AlertDialogContent className="max-w-2xl text-right">
              <AlertDialogHeader className="text-right space-y-2">
                <AlertDialogTitle className="text-lg font-bold flex items-center gap-2 text-primary">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  تأكيد حفظ وترحيل القيد المحاسبي
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-muted-foreground">
                  هل أنت تأكد من ترحيل القيد المزدوج وحفظه نهائياً؟ سيتم إدراج الحركة في دفتر
                  اليومية وتعديل أرصدة الحسابات المعنية تلقائياً.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="space-y-4 my-2 text-sm">
                {/* Entry Metadata Box */}
                <div className="p-3.5 rounded-xl bg-muted/60 border space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
                    <div>
                      <span className="text-xs text-muted-foreground">رقم القيد: </span>
                      <strong className="font-mono font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-300 dark:border-indigo-700 px-2 py-0.5 rounded-md inline-block">
                        {newEntryId || "تلقائي"} {newEntryRef ? `(${newEntryRef})` : ""}
                      </strong>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">التاريخ: </span>
                      <strong className="font-mono text-foreground">{newEntryDate}</strong>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">إجمالي القيد المعادل: </span>
                      <strong className="font-mono text-emerald-600 dark:text-emerald-400">
                        {newEntryTotals.debits.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        USD
                      </strong>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">الشرح التوضيحي: </span>
                    <span className="font-medium text-foreground">{newEntryDesc}</span>
                  </div>
                </div>

                {/* Affected Accounts Breakdown */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    الحسابات والأرصدة المتأثرة بالقيد:
                  </Label>
                  <div className="border rounded-xl divide-y max-h-56 overflow-y-auto bg-card">
                    {newEntryLines.map((line, idx) => {
                      const acc = (accounts || []).find((a) => a.code === line.account_code);
                      const isDebit = (line.debit || 0) > 0;
                      const origAmt = isDebit ? line.debit : line.credit;
                      const baseVal = getLineBaseValue(
                        origAmt || 0,
                        line.rate || 1,
                        line.currency || "USD",
                      );
                      return (
                        <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`font-mono text-[11px] ${isDebit ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300" : "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300"}`}
                            >
                              {isDebit ? "مدين" : "دائن"}
                            </Badge>
                            <div>
                              <span className="font-semibold text-foreground">
                                {acc ? acc.name : line.account_code}
                              </span>
                              <span className="text-muted-foreground font-mono mr-1">
                                ({line.account_code})
                              </span>
                            </div>
                          </div>
                          <div className="text-left font-mono">
                            <span className="font-bold text-foreground">
                              {Number(origAmt).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                              })}{" "}
                              {line.currency || "USD"}
                            </span>
                            {line.currency && line.currency !== "USD" && (
                              <div className="text-[10px] text-muted-foreground">
                                المعادل:{" "}
                                {baseVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}{" "}
                                USD (معامل {line.rate})
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <AlertDialogFooter className="gap-2 sm:gap-0 mt-4">
                <AlertDialogCancel onClick={() => setIsConfirmPostOpen(false)}>
                  رجوع للتعديل
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleExecutePost}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  تأكيد وحفظ القيد
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex flex-wrap items-center gap-2 mb-4 print:hidden">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            printLedgerDocument(
              buildLedgerPrintRows(erpState?.journalEntries || [], erpState?.accounts || []),
              false,
            )
          }
          className="font-bold gap-2"
          title="طباعة القيود"
        >
          <Printer size={15} /> طباعة القيود
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            printLedgerDocument(
              buildLedgerPrintRows(erpState?.journalEntries || [], erpState?.accounts || []),
              true,
            )
          }
          className="font-bold gap-2"
          title="طباعة مستند محاسبي"
        >
          <FileText size={15} /> مستند محاسبي
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            exportLedgerDocumentToExcel(
              buildLedgerPrintRows(erpState?.journalEntries || [], erpState?.accounts || []),
            )
          }
          className="font-bold gap-2"
          title="تصدير القيود إلى Excel"
        >
          <FileSpreadsheet size={15} /> Excel
        </Button>
      </div>

      {/* MAIN FINANCIAL HUB VIEW (When selectedTab === 'hub') */}
      {selectedTab === "hub" && (
        <section aria-labelledby="financial-modules-heading" className="space-y-6">
          <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-3">
            <div>
              <h2
                id="financial-modules-heading"
                className="flex items-center gap-2 text-lg font-black text-foreground"
              >
                <Landmark size={22} className="text-primary" aria-hidden="true" />
                أقسام ووظائف الإدارة المالية والمحاسبية
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                اضغط على أي قسم مالي لفتحه في صفحة كاملة مستقلة
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => handleOpenNewEntry()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl gap-1.5 shadow-sm"
              >
                <Plus size={15} />
                <span>إضافة قيد يومي</span>
              </Button>
              <Button
                onClick={() => {
                  setSelectedTab("vouchers");
                  setAutoOpenVoucherModal(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl gap-1.5 shadow-sm"
              >
                <Receipt size={15} />
                <span>تسجيل سند مالي</span>
              </Button>
            </div>
          </div>

          {/* Square Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card
              onClick={() => setSelectedTab("financial_position")}
              className="group cursor-pointer rounded-2xl border border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500 hover:shadow-xl transition-all duration-200"
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 p-4">
                <div className="rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400 p-2.5 shadow-xs">
                  <TrendingUp size={22} />
                </div>
                <span className="rounded-full border border-emerald-500/40 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                  الميزانية ⭐
                </span>
              </CardHeader>
              <CardContent className="space-y-1.5 p-4 pt-0">
                <h3 className="font-black text-sm text-foreground group-hover:text-emerald-600 transition-colors">
                  المركز المالي الشامل
                </h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                  الميزانية الموحدة وقائمة الدخل الحية المتزامنة مع المول، الحديقة، المطعم والسندات
                </p>
                <div className="pt-2 flex items-center justify-between border-t border-border/50 text-[11px] font-bold">
                  <span className="text-emerald-600 dark:text-emerald-400">تقرير الموقف المالي</span>
                  <span className="text-emerald-600 text-xs transition-transform group-hover:translate-x-[-2px]">
                    فتح التقرير الشامل ←
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card
              onClick={() => setSelectedTab("ledger")}
              className="group cursor-pointer rounded-2xl border border-border/80 bg-card hover:border-primary/50 hover:shadow-xl transition-all duration-200"
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 p-4">
                <div className="rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-blue-600 dark:text-blue-400 p-2.5 shadow-xs">
                  <BookOpen size={22} />
                </div>
                <span className="rounded-full border border-border/60 bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                  الأستاذ
                </span>
              </CardHeader>
              <CardContent className="space-y-1.5 p-4 pt-0">
                <h3 className="font-black text-sm text-foreground group-hover:text-primary transition-colors">
                  حساب الأستاذ العام
                </h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                  كشوفات الحسابات التفصيلية، الأرصدة الافتتاحية والحركات الدائنة والمدينة
                </p>
                <div className="pt-2 flex items-center justify-between border-t border-border/50 text-[11px] font-bold">
                  <span className="text-primary">{accounts.length} حساب مسجل</span>
                  <span className="text-muted-foreground group-hover:text-primary text-xs transition-transform group-hover:translate-x-[-2px]">
                    فتح الكشف ←
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card
              onClick={() => setSelectedTab("journal")}
              className="group cursor-pointer rounded-2xl border border-border/80 bg-card hover:border-indigo-500/50 hover:shadow-xl transition-all duration-200"
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 p-4">
                <div className="rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-600 dark:text-indigo-400 p-2.5 shadow-xs">
                  <FileText size={22} />
                </div>
                <span className="rounded-full border border-border/60 bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                  اليومية
                </span>
              </CardHeader>
              <CardContent className="space-y-1.5 p-4 pt-0">
                <h3 className="font-black text-sm text-foreground group-hover:text-indigo-600 transition-colors">
                  دفتر اليومية والقيود المزدوجة
                </h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                  متابعة القيود اليومية المرحلة، ترقيم الفترات، وتدقيق التوازن المحاسبي
                </p>
                <div className="pt-2 flex items-center justify-between border-t border-border/50 text-[11px] font-bold">
                  <span className="text-indigo-600 dark:text-indigo-400">
                    {journalEntries.length} قيد مسجل
                  </span>
                  <span className="text-muted-foreground group-hover:text-indigo-600 text-xs transition-transform group-hover:translate-x-[-2px]">
                    عرض القيود ←
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card
              onClick={() => {
                setSelectedTab("vouchers");
                setAutoOpenVoucherModal(true);
              }}
              className="group cursor-pointer rounded-2xl border border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500 hover:shadow-xl transition-all duration-200"
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 p-4">
                <div className="rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400 p-2.5 shadow-xs">
                  <Receipt size={22} />
                </div>
                <span className="rounded-full border border-emerald-500/40 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                  سند منبثق
                </span>
              </CardHeader>
              <CardContent className="space-y-1.5 p-4 pt-0">
                <h3 className="font-black text-sm text-foreground group-hover:text-emerald-600 transition-colors">
                  سندات الصرف والقبض
                </h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                  إصدار سندات القبض والصرف في نافذة منبثقة مع الترحيل الفوري والطباعة
                </p>
                <div className="pt-2 flex items-center justify-between border-t border-border/50 text-[11px] font-bold">
                  <span className="text-emerald-600 dark:text-emerald-400">نافذة منبثقة +</span>
                  <span className="text-emerald-600 text-xs transition-transform group-hover:translate-x-[-2px]">
                    تسجيل سند ←
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card
              onClick={() => setSelectedTab("accounts")}
              className="group cursor-pointer rounded-2xl border border-border/80 bg-card hover:border-blue-500/50 hover:shadow-xl transition-all duration-200"
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 p-4">
                <div className="rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-blue-600 dark:text-blue-400 p-2.5 shadow-xs">
                  <Layers size={22} />
                </div>
                <span className="rounded-full border border-border/60 bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                  الشجرة
                </span>
              </CardHeader>
              <CardContent className="space-y-1.5 p-4 pt-0">
                <h3 className="font-black text-sm text-foreground group-hover:text-blue-600 transition-colors">
                  دليل وشجرة الحسابات
                </h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                  شجرة الحسابات الرباعية (أصول، التزامات، حقوق ملكية، إيرادات ومصروفات)
                </p>
                <div className="pt-2 flex items-center justify-between border-t border-border/50 text-[11px] font-bold">
                  <span className="text-blue-600 dark:text-blue-400">4 مستويات</span>
                  <span className="text-muted-foreground group-hover:text-blue-600 text-xs transition-transform group-hover:translate-x-[-2px]">
                    شجرة الحسابات ←
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card
              onClick={() => setSelectedTab("treasury")}
              className="group cursor-pointer rounded-2xl border border-border/80 bg-card hover:border-amber-500/50 hover:shadow-xl transition-all duration-200"
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 p-4">
                <div className="rounded-xl bg-gradient-to-br from-amber-500/20 to-yellow-500/20 text-amber-600 dark:text-amber-400 p-2.5 shadow-xs">
                  <Wallet size={22} />
                </div>
                <span className="rounded-full border border-border/60 bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                  الخزائن
                </span>
              </CardHeader>
              <CardContent className="space-y-1.5 p-4 pt-0">
                <h3 className="font-black text-sm text-foreground group-hover:text-amber-600 transition-colors">
                  إدارة الخزائن النقدية
                </h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                  أرصدة الخزائن، إيداعات وسحوبات النقدية، تحويلات بين الخزائن وكشوف الحساب
                </p>
                <div className="pt-2 flex items-center justify-between border-t border-border/50 text-[11px] font-bold">
                  <span className="text-amber-600 dark:text-amber-400">
                    {treasuries.length} خزائن نشطة
                  </span>
                  <span className="text-muted-foreground group-hover:text-amber-600 text-xs transition-transform group-hover:translate-x-[-2px]">
                    فتح الخزائن ←
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card
              onClick={() => setSelectedTab("reports")}
              className="group cursor-pointer rounded-2xl border border-border/80 bg-card hover:border-emerald-500/50 hover:shadow-xl transition-all duration-200"
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 p-4">
                <div className="rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400 p-2.5 shadow-xs">
                  <BarChart3 size={22} />
                </div>
                <span className="rounded-full border border-border/60 bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                  التقارير
                </span>
              </CardHeader>
              <CardContent className="space-y-1.5 p-4 pt-0">
                <h3 className="font-black text-sm text-foreground group-hover:text-emerald-600 transition-colors">
                  التقارير المالية والميزانية
                </h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                  قائمة الدخل، الأرباح والخسائر، الميزانية العمومية والتدفقات النقدية
                </p>
                <div className="pt-2 flex items-center justify-between border-t border-border/50 text-[11px] font-bold">
                  <span className="text-emerald-600 dark:text-emerald-400">تقارير ختامية</span>
                  <span className="text-muted-foreground group-hover:text-emerald-600 text-xs transition-transform group-hover:translate-x-[-2px]">
                    عرض التقارير ←
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card
              onClick={() => setSelectedTab("trial")}
              className="group cursor-pointer rounded-2xl border border-border/80 bg-card hover:border-purple-500/50 hover:shadow-xl transition-all duration-200"
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 p-4">
                <div className="rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 text-purple-600 dark:text-purple-400 p-2.5 shadow-xs">
                  <Scale size={22} />
                </div>
                <span className="rounded-full border border-border/60 bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                  الميزان
                </span>
              </CardHeader>
              <CardContent className="space-y-1.5 p-4 pt-0">
                <h3 className="font-black text-sm text-foreground group-hover:text-purple-600 transition-colors">
                  ميزان المراجعة بالأرصدة
                </h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                  فحص اتزان الأرصدة المدينة والدائنة مع خيارات تصدير Excel والطباعة
                </p>
                <div className="pt-2 flex items-center justify-between border-t border-border/50 text-[11px] font-bold">
                  <span className="text-purple-600 dark:text-purple-400">فحص فوري</span>
                  <span className="text-muted-foreground group-hover:text-purple-600 text-xs transition-transform group-hover:translate-x-[-2px]">
                    فتح الميزان ←
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card
              onClick={() => handleOpenNewEntry()}
              className="group cursor-pointer rounded-2xl border border-primary/30 bg-primary/5 hover:border-primary hover:bg-primary/10 transition-all duration-200 hover:shadow-xl"
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 p-4">
                <div className="rounded-xl bg-primary text-primary-foreground p-2.5 shadow-xs">
                  <Plus size={22} />
                </div>
                <span className="rounded-full border border-primary/30 bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                  قيد منبثق
                </span>
              </CardHeader>
              <CardContent className="space-y-1.5 p-4 pt-0">
                <h3 className="font-black text-sm text-primary transition-colors">
                  إضافة قيد مزدوج يدوي
                </h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                  نافذة إدخال القيود المحاسبية اليدوية مع التحقق الآلي من الاتزان وتأكيد الحفظ
                </p>
                <div className="pt-2 flex items-center justify-between border-t border-border/50 text-[11px] font-bold">
                  <span className="text-primary font-bold">نافذة منبثقة +</span>
                  <span className="text-primary text-xs transition-transform group-hover:translate-x-[-2px]">
                    فتح النافذة +
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Saved Journal Drafts Banner if any */}
          {journalDrafts.length > 0 && (
            <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Save className="h-5 w-5 text-amber-600" />
                <div>
                  <h4 className="text-xs font-black text-foreground">
                    توجد مسودات قيود يومية محفوظة ({journalDrafts.length})
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    يمكنك استعادة أي مسودة واستكمال تسجيلها دون فقدان البيانات
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {journalDrafts.slice(0, 3).map((draft) => (
                  <Button
                    key={draft.id}
                    size="sm"
                    variant="outline"
                    onClick={() => handleLoadJournalDraft(draft)}
                    className="text-xs font-bold border-amber-500/40 text-amber-800 dark:text-amber-300 rounded-xl gap-1.5"
                  >
                    <span>{draft.newEntryDesc || draft.newEntryRef}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      ({draft.savedAt ? draft.savedAt.slice(0, 10) : ""})
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* DEDICATED SUBPAGE VIEW HEADER (When selectedTab !== 'hub') */}
      {selectedTab !== "hub" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-card border border-border shadow-sm">
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setSelectedTab("hub")}
                variant="default"
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-black rounded-xl px-4 py-2 text-xs md:text-sm shadow-md transition-all hover:scale-105"
              >
                <ArrowRight size={18} />
                <span>الرجوع للأقسام المالية الرئيسية</span>
              </Button>
              <div className="h-6 w-px bg-border hidden sm:block" />
              <div>
                <span className="text-[10px] font-bold text-muted-foreground block">
                  الرئيسية المالية / صفحة مستقلة
                </span>
                <h3 className="text-base font-black text-foreground flex items-center gap-2">
                  {selectedTab === "vouchers" && "💳 سندات الصرف والقبض الرسمية"}
                  {selectedTab === "ledger" && "📖 كشف حساب الأستاذ العام"}
                  {selectedTab === "journal" && "📝 دفتر اليومية والقيود المزدوجة"}
                  {selectedTab === "accounts" && "🏛️ دليل وشجرة الحسابات الرباعية"}
                  {selectedTab === "treasury" && "💰 إدارة الخزائن والمحافط النقدية"}
                  {selectedTab === "reports" && "📊 التقارير المالية والقوائم الختامية"}
                  {selectedTab === "trial" && "⚖️ ميزان المراجعة بالمجاميع والأرصدة"}
                  {selectedTab === "statements" && "📑 القوائم المالية الختامية"}
                </h3>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={() => handleOpenNewEntry()}
                className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-bold text-xs rounded-xl gap-1.5"
              >
                <Plus size={14} />
                <span>إضافة قيد يومي</span>
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setSelectedTab("vouchers");
                  setAutoOpenVoucherModal(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl gap-1.5 shadow-xs"
              >
                <Receipt size={14} />
                <span>تسجيل سند مالي جديد</span>
              </Button>
            </div>
          </div>

          {/* Subpage Switcher Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 print:hidden">
            {[
              { id: "financial_position", label: "المركز المالي الشامل ⭐" },
              { id: "ledger", label: "كشف الأستاذ" },
              { id: "journal", label: "اليومية العامة" },
              { id: "vouchers", label: "سندات الصرف والقبض" },
              { id: "accounts", label: "دليل الحسابات" },
              { id: "treasury", label: "إدارة الخزائن" },
              { id: "reports", label: "التقارير المالية" },
              { id: "trial", label: "ميزان المراجعة" },
              { id: "statements", label: "القوائم المالية" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap border ${
                  selectedTab === tab.id
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-card border-border/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* SUBPAGE CONTENT RENDERING */}
      {selectedTab !== "hub" && (
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
          {/* Tab Standalone: Comprehensive Financial Position */}
          <TabsContent value="financial_position" className="space-y-6">
            <ComprehensiveFinancialPositionCard />
          </TabsContent>

          {/* Tab 0: Vouchers Entry & Management */}
          <TabsContent value="vouchers" className="space-y-6">
            <VouchersLedgerSection
              autoOpenNewModal={autoOpenVoucherModal}
              onModalClosed={() => setAutoOpenVoucherModal(false)}
              onNavigateToJournal={(ref) => {
                if (ref) setJournalSearch(ref);
                setSelectedTab("journal");
              }}
            />
          </TabsContent>

        {/* Tab 1: General Ledger Account Details */}
        <TabsContent value="ledger" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Account selector and metadata */}
            <Card className="lg:col-span-1 rounded-2xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                  اختيار الحساب المحاسبي
                </CardTitle>
                <CardDescription>
                  عرض كشف التحليلي ودفتر الأستاذ الخاص بالحساب المختار
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>الحساب المالي (البحث الذكي)</Label>
                  <AccountSearchSelect
                    value={selectedAccountCode}
                    onChange={(code) => setSelectedAccountCode(code)}
                    accounts={accounts}
                    placeholder="ابحث برقم أو اسم الحساب..."
                  />
                </div>

                <div className="h-px bg-border my-2" />

                {currentAccount && (
                  <div className="space-y-3">
                    <div>
                      <span className="text-xs text-muted-foreground block">
                        كود الحساب المحاسبي:
                      </span>
                      <span className="text-sm font-mono font-bold text-foreground">
                        {currentAccount.code}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">نوع الحساب:</span>
                      <Badge variant="outline" className="mt-1">
                        {ACCOUNT_TYPE_LABELS[currentAccount.type]}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">الرصيد الافتتاحي:</span>
                      <span className="text-sm font-bold font-mono text-foreground">
                        {formatCurrency(
                          currentAccount.initial_balance || 0,
                          ledgerSummary.currency,
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">الحالة الحالية:</span>
                      <Badge className="mt-1 bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                        نشط ومرحل
                      </Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stats Cards and Movements Ledger Table */}
            <div className="lg:col-span-3 space-y-6">
              {/* Ledger Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="rounded-2xl bg-gradient-to-br from-background to-muted/20">
                  <CardContent className="p-5 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-muted-foreground font-medium">
                        إجمالي الجانب المدين (Dr)
                      </span>
                      <h3 className="text-xl font-bold font-mono mt-1 text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(ledgerSummary.totalDebit, ledgerSummary.currency)}
                      </h3>
                    </div>
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl">
                      <ArrowUpRight className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl bg-gradient-to-br from-background to-muted/20">
                  <CardContent className="p-5 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-muted-foreground font-medium">
                        إجمالي الجانب الدائن (Cr)
                      </span>
                      <h3 className="text-xl font-bold font-mono mt-1 text-rose-600 dark:text-rose-400">
                        {formatCurrency(ledgerSummary.totalCredit, ledgerSummary.currency)}
                      </h3>
                    </div>
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl">
                      <ArrowDownLeft className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-primary/20 bg-primary/5">
                  <CardContent className="p-5 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-muted-foreground font-medium">
                        صافي الرصيد النهائي للأستاذ
                      </span>
                      <h3 className="text-xl font-extrabold font-mono mt-1 text-primary">
                        {formatCurrency(ledgerSummary.netBalance, ledgerSummary.currency)}
                      </h3>
                    </div>
                    <div className="p-3 bg-primary/10 rounded-xl">
                      <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Transactions Table */}
              <Card className="rounded-2xl">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-base font-bold">
                      الحركات القييدية المفصلة (دفتر حساب الأستاذ)
                    </CardTitle>
                    <CardDescription>
                      الحركات والقيود التي تمت على هذا الحساب بالتسلسل الزمني
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportLedger}
                      className="gap-1.5 rounded-xl"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      تصدير Excel
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                      <thead className="bg-muted/50 text-muted-foreground text-xs font-semibold uppercase border-y">
                        <tr>
                          <th className="p-4">التاريخ</th>
                          <th className="p-4">المرجع</th>
                          <th className="p-4">شرح وتفاصيل الحركة</th>
                          <th className="p-4 text-emerald-600 dark:text-emerald-400">
                            مدين (Debit)
                          </th>
                          <th className="p-4 text-rose-600 dark:text-rose-400">دائن (Credit)</th>
                          <th className="p-4 text-primary">الرصيد التراكمي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y border-b">
                        {ledgerLines.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-muted-foreground">
                              لا توجد حركات مسجلة لهذا الحساب. يمكنك إضافة قيد يدوي بالأعلى.
                            </td>
                          </tr>
                        ) : (
                          ledgerLines.map((line) => (
                            <tr key={line.id} className="hover:bg-muted/20 transition">
                              <td className="p-4 font-mono">{line.date}</td>
                              <td className="p-4 font-mono">
                                <Badge variant="secondary" className="font-mono">
                                  {line.reference}
                                </Badge>
                              </td>
                              <td className="p-4 max-w-sm font-medium">{line.description}</td>
                              <td className="p-4 font-mono text-emerald-600 dark:text-emerald-400">
                                {line.debit > 0 ? formatCurrency(line.debit, line.currency) : "-"}
                              </td>
                              <td className="p-4 font-mono text-rose-600 dark:text-rose-400">
                                {line.credit > 0 ? formatCurrency(line.credit, line.currency) : "-"}
                              </td>
                              <td className="p-4 font-bold font-mono text-foreground">
                                {formatCurrency(line.runningBalance, line.currency)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: General Journal Ledger */}
        <TabsContent value="journal" className="space-y-6 min-w-0 w-full">
          <Card className="rounded-2xl w-full min-w-0 overflow-hidden">
            <CardHeader className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 w-full min-w-0">
              <div>
                <CardTitle className="text-base font-bold">
                  دفتر اليومية العامة (General Journal)
                </CardTitle>
                <CardDescription>
                  سجل كامل لجميع القيود المحاسبية المزدوجة التي تمت في النظام
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2 max-w-full">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportJournal}
                  className="gap-1.5 rounded-xl text-xs"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  تصدير Excel
                </Button>

                <div className="relative inline-block">
                  <input
                    type="file"
                    accept=".xls,.xlsx,.csv"
                    onChange={handleFileUpload}
                    disabled={isImportingOracle}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    title="اختر ملف إكسيل لرفعه"
                  />
                  <Button
                    variant="default"
                    size="sm"
                    disabled={isImportingOracle}
                    className="gap-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white pointer-events-none text-xs"
                  >
                    <ArrowUpDown className="h-4 w-4" />
                    {isImportingOracle ? "جاري الاستيراد..." : "رفع قيود Excel"}
                  </Button>
                </div>

                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    setIsPasteModalOpen(true);
                  }}
                  className="gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm text-xs"
                >
                  <ClipboardPaste className="h-4 w-4" />
                  لصق نصي للقيود
                </Button>

                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setIsSaveConfirmOpen(true)}
                  disabled={isSavingToDb || !hasUnsavedChanges}
                  className={`gap-1.5 rounded-xl text-white font-bold shadow-sm text-xs ${
                    hasUnsavedChanges
                      ? "bg-amber-600 hover:bg-amber-700 ring-2 ring-amber-400"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  <Save className={`h-4 w-4 ${isSavingToDb ? "animate-spin" : ""}`} />
                  {isSavingToDb ? "جاري الحفظ..." : "حفظ في قاعدة البيانات"}
                  <Badge
                    variant="secondary"
                    className="mr-1 bg-black/30 text-white text-[10px] px-1.5 py-0 font-mono"
                  >
                    {journalEntries.length}
                  </Badge>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsClearConfirmOpen(true)}
                  className="gap-1.5 rounded-xl border-rose-500/30 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-semibold text-xs"
                >
                  <Trash2 className="h-4 w-4" />
                  مسح القيود
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 w-full min-w-0">
              {/* Search and Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-3 bg-muted/30 p-3 sm:p-4 rounded-xl border border-border w-full min-w-0">
                <div className="space-y-1.5 sm:col-span-2 md:col-span-1 xl:col-span-1 min-w-0">
                  <Label className="text-xs font-semibold truncate block">
                    بحث بالبيان أو المرجع
                  </Label>
                  <div className="relative">
                    <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="ابحث بالرقم أو البيان..."
                      className="pr-9 h-9 text-xs"
                      value={journalSearch}
                      onChange={(e) => setJournalSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs font-semibold truncate block">حالة اتزان القيد</Label>
                  <Select
                    value={journalBalanceFilter}
                    onValueChange={(val: any) => setJournalBalanceFilter(val)}
                  >
                    <SelectTrigger className="h-9 text-xs font-medium">
                      <SelectValue placeholder="حالة الاتزان" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">جميع القيود (الكل)</SelectItem>
                      <SelectItem value="BALANCED">متزن فقط (✓ متزن)</SelectItem>
                      <SelectItem value="UNBALANCED">غير متزن فقط (⚠️ غير متزن)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs font-semibold truncate block">الفلترة بالعملة</Label>
                  <Select value={journalCurrencyFilter} onValueChange={setJournalCurrencyFilter}>
                    <SelectTrigger className="h-9 text-xs font-medium">
                      <SelectValue placeholder="اختر العملة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">جميع العملات</SelectItem>
                      <SelectItem value="USD">USD - دولار أمريكي</SelectItem>
                      <SelectItem value="SSP">SSP - جنيه سوداني</SelectItem>
                      <SelectItem value="EGP">EGP - جنيه مصري</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs font-semibold truncate block">ترتيب عرض القيود</Label>
                  <Select
                    value={journalSortOrder}
                    onValueChange={(val: any) => setJournalSortOrder(val)}
                  >
                    <SelectTrigger className="h-9 text-xs font-medium">
                      <SelectValue placeholder="اختر الترتيب" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="oldest">الأقدم أولاً (تصاعدي 📅)</SelectItem>
                      <SelectItem value="newest">الأحدث أولاً (تنازلي 📅)</SelectItem>
                      <SelectItem value="ref_asc">رقم القيد (01 ⟵ 99)</SelectItem>
                      <SelectItem value="ref_desc">رقم القيد (99 ⟵ 01)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs font-semibold truncate block">تاريخ البدء</Label>
                  <Input
                    type="date"
                    className="h-9 text-xs"
                    value={journalStartDate}
                    onChange={(e) => setJournalStartDate(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5 min-w-0">
                  <Label className="text-xs font-semibold truncate block">تاريخ الانتهاء</Label>
                  <Input
                    type="date"
                    className="h-9 text-xs"
                    value={journalEndDate}
                    onChange={(e) => setJournalEndDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Journal Summary Overview Cards (Flexible Responsive Squares) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-2.5 bg-muted/20 p-2.5 sm:p-3 rounded-xl border border-border/60 w-full min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setJournalBalanceFilter("ALL");
                    setJournalCurrencyFilter("ALL");
                  }}
                  className={`p-2 sm:p-2.5 rounded-xl border text-center transition-all cursor-pointer min-w-0 flex flex-col justify-center items-center ${
                    journalBalanceFilter === "ALL" && journalCurrencyFilter === "ALL"
                      ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary"
                      : "bg-card hover:bg-muted/40 border-border"
                  }`}
                >
                  <span className="text-[11px] sm:text-xs text-muted-foreground truncate w-full block">
                    إجمالي القيود
                  </span>
                  <span className="text-sm sm:text-base font-bold font-mono text-foreground truncate w-full block mt-0.5">
                    {journalStats.total}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setJournalBalanceFilter(
                      journalBalanceFilter === "BALANCED" ? "ALL" : "BALANCED",
                    )
                  }
                  className={`p-2 sm:p-2.5 rounded-xl border text-center transition-all cursor-pointer min-w-0 flex flex-col justify-center items-center ${
                    journalBalanceFilter === "BALANCED"
                      ? "bg-emerald-500/20 border-emerald-500 shadow-xs ring-1 ring-emerald-500"
                      : "bg-emerald-500/10 hover:bg-emerald-500/15 border-emerald-500/20"
                  }`}
                >
                  <span className="text-[11px] sm:text-xs text-emerald-700 dark:text-emerald-300 truncate w-full block font-medium">
                    قيود متزنة ✓
                  </span>
                  <span className="text-sm sm:text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 truncate w-full block mt-0.5">
                    {journalStats.balanced}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setJournalBalanceFilter(
                      journalBalanceFilter === "UNBALANCED" ? "ALL" : "UNBALANCED",
                    )
                  }
                  className={`p-2 sm:p-2.5 rounded-xl border text-center transition-all cursor-pointer min-w-0 flex flex-col justify-center items-center ${
                    journalBalanceFilter === "UNBALANCED"
                      ? "bg-rose-500/20 border-rose-500 shadow-xs ring-1 ring-rose-500"
                      : "bg-rose-500/10 hover:bg-rose-500/15 border-rose-500/20"
                  }`}
                >
                  <span className="text-[11px] sm:text-xs text-rose-700 dark:text-rose-300 truncate w-full block font-medium">
                    غير متزنة ⚠️
                  </span>
                  <span className="text-sm sm:text-base font-bold font-mono text-rose-600 dark:text-rose-400 truncate w-full block mt-0.5">
                    {journalStats.unbalanced}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setJournalCurrencyFilter(journalCurrencyFilter === "USD" ? "ALL" : "USD")
                  }
                  className={`p-2 sm:p-2.5 rounded-xl border text-center transition-all cursor-pointer min-w-0 flex flex-col justify-center items-center ${
                    journalCurrencyFilter === "USD"
                      ? "bg-emerald-500/20 border-emerald-500 shadow-xs ring-1 ring-emerald-500"
                      : "bg-emerald-500/10 hover:bg-emerald-500/15 border-emerald-500/20"
                  }`}
                >
                  <span className="text-[11px] sm:text-xs text-emerald-700 dark:text-emerald-300 truncate w-full block font-medium">
                    قيود USD
                  </span>
                  <span className="text-sm sm:text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 truncate w-full block mt-0.5">
                    {journalStats.usd}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setJournalCurrencyFilter(journalCurrencyFilter === "SSP" ? "ALL" : "SSP")
                  }
                  className={`p-2 sm:p-2.5 rounded-xl border text-center transition-all cursor-pointer min-w-0 flex flex-col justify-center items-center ${
                    journalCurrencyFilter === "SSP"
                      ? "bg-blue-500/20 border-blue-500 shadow-xs ring-1 ring-blue-500"
                      : "bg-blue-500/10 hover:bg-blue-500/15 border-blue-500/20"
                  }`}
                >
                  <span className="text-[11px] sm:text-xs text-blue-700 dark:text-blue-300 truncate w-full block font-medium">
                    قيود SSP
                  </span>
                  <span className="text-sm sm:text-base font-bold font-mono text-blue-600 dark:text-blue-400 truncate w-full block mt-0.5">
                    {journalStats.ssp}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setJournalCurrencyFilter(journalCurrencyFilter === "EGP" ? "ALL" : "EGP")
                  }
                  className={`p-2 sm:p-2.5 rounded-xl border text-center transition-all cursor-pointer min-w-0 flex flex-col justify-center items-center ${
                    journalCurrencyFilter === "EGP"
                      ? "bg-amber-500/20 border-amber-500 shadow-xs ring-1 ring-amber-500"
                      : "bg-amber-500/10 hover:bg-amber-500/15 border-amber-500/20"
                  }`}
                >
                  <span className="text-[11px] sm:text-xs text-amber-700 dark:text-amber-300 truncate w-full block font-medium">
                    قيود EGP
                  </span>
                  <span className="text-sm sm:text-base font-bold font-mono text-amber-600 dark:text-amber-400 truncate w-full block mt-0.5">
                    {journalStats.egp}
                  </span>
                </button>
              </div>

              {/* Journal entries explorer list */}
              <div className="space-y-4">
                {filteredJournal.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground border border-dashed rounded-xl">
                    لا توجد قيود يومية تطابق معايير البحث والفلترة المحددة.
                  </div>
                ) : (
                  paginatedJournal.map((entry, entryIndex) => {
                    const realIndex = (journalPage - 1) * ITEMS_PER_PAGE + entryIndex + 1;
                    const totalDebit = entry.lines.reduce(
                      (sum, l) => sum + (Number(l.debit) || 0),
                      0,
                    );
                    const totalCredit = entry.lines.reduce(
                      (sum, l) => sum + (Number(l.credit) || 0),
                      0,
                    );

                    const entryCurrencies = Array.from(
                      new Set(entry.lines.map((l) => l.currency || entry.currency || "USD")),
                    );

                    const totalBaseDebit = entry.lines.reduce((sum, l) => {
                      return (
                        sum +
                        getLineBaseValue(
                          l.debit,
                          l.rate || 1,
                          l.currency || entry.currency || "USD",
                        )
                      );
                    }, 0);

                    const totalBaseCredit = entry.lines.reduce((sum, l) => {
                      return (
                        sum +
                        getLineBaseValue(
                          l.credit,
                          l.rate || 1,
                          l.currency || entry.currency || "USD",
                        )
                      );
                    }, 0);

                    const balanceInfo = getEntryBalanceInfo(entry);
                    const balanceDiff = balanceInfo.difference;
                    const isBalanced = balanceInfo.isBalanced;

                    return (
                      <div
                        key={entry.id ? `${entry.id}-${entryIndex}` : `je-${realIndex}`}
                        className={`border rounded-xl overflow-hidden bg-card shadow-sm hover:shadow-md transition duration-200 ${
                          isBalanced ? "border-border/80" : "border-rose-400 dark:border-rose-700"
                        }`}
                      >
                        {/* Entry Header */}
                        <div className="bg-muted/50 px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-bold text-xs bg-primary text-primary-foreground px-2.5 py-1 rounded-md shadow-sm">
                              #{realIndex}
                            </span>
                            <Badge
                              variant="outline"
                              className="font-mono text-xs font-black px-2.5 py-1 border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 shadow-xs"
                            >
                              قيد رقم: {entry.reference}
                            </Badge>
                            {entryCurrencies.map((c) => (
                              <Badge
                                key={c}
                                className={`font-mono text-xs font-bold border ${
                                  c === "USD"
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300"
                                    : c === "SSP"
                                      ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300"
                                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300"
                                }`}
                              >
                                {c === "USD" ? "💵 USD" : c === "SSP" ? "🇸🇸 SSP" : "🇪🇬 EGP"}
                              </Badge>
                            ))}
                            <span className="font-bold text-sm text-foreground mr-1">
                              {entry.description}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground flex-wrap justify-between md:justify-end">
                            <span className="bg-muted px-2 py-1 rounded">📅 {entry.date}</span>
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 rounded-md"
                                title="عرض القيد"
                                onClick={() => {
                                  setSelectedJournal(entry);
                                  setIsViewJournalOpen(true);
                                }}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 rounded-md text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
                                title="تعديل القيد"
                                onClick={() => handleRequestEditEntry(entry)}
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 rounded-md text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                                title="حذف القيد"
                                onClick={() => handleRequestDeleteEntry(entry)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                              {!isBalanced && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 rounded-md px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
                                  title={`تسوية فرق القيد ${formatCurrency(balanceDiff, "USD")}`}
                                  onClick={() => setBalanceAdjustmentEntry(entry)}
                                >
                                  <PlusCircle className="h-3.5 w-3.5" />
                                  <span className="mr-1 text-[11px] font-semibold">
                                    تسوية الفرق
                                  </span>
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 rounded-md"
                                title="طباعة القيد"
                                onClick={() => {
                                  printJournalEntryDocument(entry, accounts, formatCurrency);
                                }}
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 rounded-md"
                                title="المرفقات"
                                onClick={() => {
                                  setAttachmentJournalId(entry.id);
                                  setCurrentAttachments(entry.attachments || []);
                                  setIsAttachmentOpen(true);
                                }}
                              >
                                <Paperclip className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Entry Lines - grouped by currency */}
                        <JournalEntryCurrencyGroups
                          entry={entry}
                          accounts={accounts}
                          formatCurrency={formatCurrency}
                          getLineBaseValue={getLineBaseValue}
                          totalBaseDebit={totalBaseDebit}
                          totalBaseCredit={totalBaseCredit}
                          isBalanced={isBalanced}
                        />

                        {/* Bottom Balance Difference Bar */}
                        <div
                          className={`px-4 py-2 text-xs font-semibold flex items-center justify-between border-t ${
                            isBalanced
                              ? "bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 border-emerald-200/50"
                              : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-300"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {isBalanced ? (
                              <span>✓ القيد متزن ومطابق محاسبياً بالمعادل العام.</span>
                            ) : (
                              <span>
                                ⚠️ فارق عدم التوازن في القيد:{" "}
                                <strong className="font-mono">
                                  {formatCurrency(balanceDiff, "USD")}
                                </strong>{" "}
                                (مدين: {formatCurrency(totalBaseDebit, "USD")} | دائن:{" "}
                                {formatCurrency(totalBaseCredit, "USD")})
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[11px] opacity-80">
                            إجمالي المعادل: {formatCurrency(totalBaseDebit, "USD")}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border mt-4">
                    <div className="text-xs text-muted-foreground font-medium">
                      عرض الصفحة <span className="font-bold font-mono">{journalPage}</span> من أصل{" "}
                      <span className="font-bold font-mono">{totalPages}</span> (إجمالي القيود
                      المطابقة: {filteredJournal.length})
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={journalPage <= 1}
                        onClick={() => setJournalPage((p) => Math.max(1, p - 1))}
                        className="h-8 text-xs font-semibold"
                      >
                        السابقة
                      </Button>
                      <div className="text-xs font-mono font-bold px-2">
                        {journalPage} / {totalPages}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={journalPage >= totalPages}
                        onClick={() => setJournalPage((p) => Math.min(totalPages, p + 1))}
                        className="h-8 text-xs font-semibold"
                      >
                        التالية
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Trial Balance */}
        <TabsContent value="trial" className="space-y-6">
          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-bold">
                  ميزان المراجعة بالأرصدة (Trial Balance Sheet)
                </CardTitle>
                <CardDescription>
                  عرض لجميع أرصدة الحسابات للتأكد من صحة وتوازن الجانبين الدائن والمدين للدفاتر
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportTrialBalance}
                  className="gap-1.5 rounded-xl"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  تصدير ميزان المراجعة
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Trial Balance Table */}
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm text-right">
                  <thead className="bg-muted/50 text-muted-foreground text-xs font-semibold border-b">
                    <tr>
                      <th className="p-4">كود الحساب</th>
                      <th className="p-4">اسم الحساب</th>
                      <th className="p-4">نوع الحساب</th>
                      <th className="p-4 text-emerald-600 dark:text-emerald-400">
                        الحركات المدينة (Dr)
                      </th>
                      <th className="p-4 text-rose-600 dark:text-rose-400">الحركات الدائنة (Cr)</th>
                      <th className="p-4 text-primary">الرصيد النهائي (مدين)</th>
                      <th className="p-4 text-primary">الرصيد النهائي (دائن)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {trialBalance.rows.map((row) => (
                      <tr key={row.code} className="hover:bg-muted/20 transition">
                        <td className="p-4 font-mono text-xs">{row.code}</td>
                        <td className="p-4 font-bold">{row.name}</td>
                        <td className="p-4 text-xs text-muted-foreground">
                          {ACCOUNT_TYPE_LABELS[row.type]}
                        </td>
                        <td className="p-4 font-mono text-muted-foreground">
                          {row.debitSum > 0 ? formatCurrency(row.debitSum, row.currency) : "-"}
                        </td>
                        <td className="p-4 font-mono text-muted-foreground">
                          {row.creditSum > 0 ? formatCurrency(row.creditSum, row.currency) : "-"}
                        </td>
                        <td className="p-4 font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                          {row.balanceType === "Dr" && row.endingBalance > 0
                            ? formatCurrency(row.endingBalance, row.currency)
                            : "-"}
                        </td>
                        <td className="p-4 font-mono text-rose-600 dark:text-rose-400 font-semibold">
                          {row.balanceType === "Cr" && row.endingBalance > 0
                            ? formatCurrency(row.endingBalance, row.currency)
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/60 font-bold border-t">
                    <tr>
                      <td colSpan={3} className="p-4 text-left">
                        إجمالي ميزان المراجعة بالأرصدة النهائية
                      </td>
                      <td className="p-4 font-mono text-xs text-muted-foreground"></td>
                      <td className="p-4 font-mono text-xs text-muted-foreground"></td>
                      <td className="p-4 font-mono text-emerald-600 dark:text-emerald-400 text-base">
                        {formatCurrency(trialBalance.totalDebits, "USD")}
                      </td>
                      <td className="p-4 font-mono text-emerald-600 dark:text-emerald-400 text-base">
                        {formatCurrency(trialBalance.totalCredits, "USD")}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Balancing Alert block */}
              {trialBalance.isBalanced ? (
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800/60 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold text-sm text-emerald-800 dark:text-emerald-300">
                      ميزان المراجعة متوازن تماماً
                    </span>
                    <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
                      مجموع أرصدة الحسابات المدينة مساوي تماماً لأرصدة الحسابات الدائنة (
                      {formatCurrency(trialBalance.totalDebits, "USD")}). الدفاتر المالية صحيحة
                      دفترياً.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-800/60 flex items-center gap-3">
                  <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
                  <div>
                    <span className="font-bold text-sm text-rose-800 dark:text-rose-300">
                      انتبه! ميزان المراجعة غير متوازن
                    </span>
                    <p className="text-xs text-rose-700/80 dark:text-rose-400/80 mt-0.5">
                      هناك فرق بين إجمالي الأرصدة المدينة والدائنة بقيمة{" "}
                      {formatCurrency(
                        Math.abs(trialBalance.totalDebits - trialBalance.totalCredits),
                        "USD",
                      )}
                      . يرجى مراجعة توازن القيود السابقة.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Financial Statements */}
        <TabsContent value="statements" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Income Statement (قائمة الدخل) */}
            <Card className="rounded-2xl">
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base font-bold">
                      قائمة الدخل التقديرية (Income Statement)
                    </CardTitle>
                  </div>
                  <Badge variant="outline" className="font-mono">
                    سنة 2026
                  </Badge>
                </div>
                <CardDescription>
                  الملخص المالي للإيرادات والتكاليف وصافي الأرباح أو الخسائر
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <span>1. الإيرادات والمبيعات (Revenues)</span>
                  </h4>
                  <div className="bg-muted/40 p-3 rounded-lg divide-y text-sm">
                    {financialStatements.revenueAccounts.map((r) => (
                      <div key={r.code} className="flex justify-between py-2">
                        <span className="text-muted-foreground">{r.name}</span>
                        <span className="font-mono font-semibold">
                          {formatCurrency(r.endingBalance, r.currency)}
                        </span>
                      </div>
                    ))}
                    {financialStatements.revenueAccounts.length === 0 && (
                      <p className="py-2 text-xs text-center text-muted-foreground">
                        لا توجد حسابات مبيعات نشطة حالياً
                      </p>
                    )}
                    <div className="flex justify-between py-2 font-bold text-foreground pt-3">
                      <span>إجمالي الإيرادات والتشغيل</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(financialStatements.totalRevenue, "USD")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <span>2. المصروفات التشغيلية والعمومية (Expenses)</span>
                  </h4>
                  <div className="bg-muted/40 p-3 rounded-lg divide-y text-sm max-h-[300px] overflow-y-auto">
                    {financialStatements.expenseAccounts.map((e) => (
                      <div key={e.code} className="flex justify-between py-2">
                        <span className="text-muted-foreground">{e.name}</span>
                        <span className="font-mono font-semibold">
                          {formatCurrency(e.endingBalance, e.currency)}
                        </span>
                      </div>
                    ))}
                    {financialStatements.expenseAccounts.length === 0 && (
                      <p className="py-2 text-xs text-center text-muted-foreground">
                        لا توجد حسابات مصروفات مسجلة حالياً
                      </p>
                    )}
                    <div className="flex justify-between py-2 font-bold text-foreground pt-3">
                      <span>إجمالي المصروفات التشغيلية</span>
                      <span className="font-mono text-rose-600 dark:text-rose-400">
                        {formatCurrency(financialStatements.totalExpense, "USD")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t flex items-center justify-between">
                  <span className="font-extrabold text-base">
                    صافي الأرباح / الخسائر (Net Income)
                  </span>
                  <span
                    className={`text-xl font-black font-mono ${financialStatements.netIncome >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
                  >
                    {formatCurrency(financialStatements.netIncome, "USD")}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Balance Sheet Summary (الميزانية العمومية) */}
            <Card className="rounded-2xl">
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scale className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base font-bold">
                      الميزانية العمومية (Balance Sheet)
                    </CardTitle>
                  </div>
                  <Badge variant="outline" className="font-mono">
                    المركز المالي
                  </Badge>
                </div>
                <CardDescription>
                  عرض لموجودات الشركة (الأصول) ومطالباتها (الخصوم وحقوق الملكية)
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-primary flex items-center gap-1.5">
                    <span>1. الأصول والموجودات (Assets)</span>
                  </h4>
                  <div className="bg-muted/40 p-3 rounded-lg divide-y text-sm max-h-[160px] overflow-y-auto">
                    {financialStatements.assetAccounts.map((a) => (
                      <div key={a.code} className="flex justify-between py-2">
                        <span className="text-muted-foreground">{a.name}</span>
                        <span className="font-mono font-semibold">
                          {formatCurrency(a.endingBalance, a.currency)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between py-2 font-bold text-foreground pt-3">
                      <span>إجمالي الأصول</span>
                      <span className="font-mono text-primary">
                        {formatCurrency(financialStatements.totalAssets, "USD")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-1">
                    <h4 className="text-sm font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                      <span>2. الالتزامات (Liabilities)</span>
                    </h4>
                    <div className="bg-muted/40 p-3 rounded-lg divide-y text-sm h-[130px] overflow-y-auto">
                      {financialStatements.liabilityAccounts.map((l) => (
                        <div key={l.code} className="flex justify-between py-1 text-xs">
                          <span className="text-muted-foreground truncate">{l.name}</span>
                          <span className="font-mono font-semibold">
                            {formatCurrency(l.endingBalance, l.currency)}
                          </span>
                        </div>
                      ))}
                      {financialStatements.liabilityAccounts.length === 0 && (
                        <p className="py-1 text-xs text-center text-muted-foreground">
                          لا توجد التزامات
                        </p>
                      )}
                      <div className="flex justify-between py-1 font-bold text-foreground text-xs pt-2">
                        <span>إجمالي الالتزامات</span>
                        <span className="font-mono">
                          {formatCurrency(financialStatements.totalLiabilities, "USD")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 col-span-1">
                    <h4 className="text-sm font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                      <span>3. حقوق الملكية (Equity)</span>
                    </h4>
                    <div className="bg-muted/40 p-3 rounded-lg divide-y text-sm h-[130px] overflow-y-auto">
                      {financialStatements.equityAccounts.map((eq) => (
                        <div key={eq.code} className="flex justify-between py-1 text-xs">
                          <span className="text-muted-foreground truncate">
                            {eq.name} ({eq.balanceType})
                          </span>
                          <span className="font-mono font-semibold">
                            {formatCurrency(eq.endingBalance, eq.currency)}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between py-1 text-xs text-emerald-600 dark:text-emerald-400">
                        <span>صافي أرباح الفترة الحالية</span>
                        <span className="font-mono font-semibold">
                          {formatCurrency(financialStatements.netIncome, "USD")}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 font-bold text-foreground text-xs pt-2">
                        <span>إجمالي حقوق الملكية</span>
                        <span className="font-mono">
                          {formatCurrency(
                            financialStatements.totalEquity + financialStatements.netIncome,
                            "USD",
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex flex-col">
                    <span className="font-extrabold text-sm">مجموع الالتزامات وحقوق الملكية</span>
                    <span className="text-xs text-muted-foreground">
                      الخصوم + رأس المال + الأرباح
                    </span>
                  </div>
                  <span className="text-lg font-bold font-mono text-foreground">
                    {formatCurrency(
                      financialStatements.totalLiabilities +
                        financialStatements.totalEquity +
                        financialStatements.netIncome,
                      "USD",
                    )}
                  </span>
                </div>

                {/* Equation Verification Check */}
                <div className="p-3.5 rounded-xl border flex items-center gap-2 text-xs bg-muted/60">
                  <Percent className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-medium text-muted-foreground">
                    معادلة الميزانية (المركز المالي): الأصول (
                    {formatCurrency(financialStatements.totalAssets, "USD")}) = الخصوم والملكية (
                    {formatCurrency(
                      financialStatements.totalLiabilities +
                        financialStatements.totalEquity +
                        financialStatements.netIncome,
                      "USD",
                    )}
                    )
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 6: Chart of Accounts (دليل وشجرة الحسابات) */}
        <TabsContent value="accounts" className="space-y-6">
          <div className="bg-card rounded-2xl border border-border p-2 sm:p-4">
            <AccountsPage />
          </div>
        </TabsContent>

        {/* Tab 7: Treasury Management (إدارة الخزائن والصناديق) */}
        <TabsContent value="treasury" className="space-y-6">
          <div className="bg-card rounded-2xl border border-border p-2 sm:p-4">
            <TreasuryManagementView />
          </div>
        </TabsContent>

        {/* Tab 8: Financial Reports (التقارير المالية) */}
        <TabsContent value="reports" className="space-y-6">
          <div className="bg-card rounded-2xl border border-border p-2 sm:p-4">
            <ReportsPage />
          </div>
        </TabsContent>
      </Tabs>
      )}

      {/* Attachment Dialog */}
      <Dialog open={isAttachmentOpen} onOpenChange={setIsAttachmentOpen}>
        <DialogContent className="sm:max-w-[500px] text-right">
          <DialogHeader>
            <DialogTitle>
              مرفقات القيد {attachmentJournalId.substring(3, 10).toUpperCase()}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>إضافة مرفق جديد (صورة أو ملف)</Label>
              <Input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const result = event.target?.result as string;
                      if (result) {
                        erpStore.updateJournalEntryAttachments(attachmentJournalId, [result]);
                        setCurrentAttachments([...currentAttachments, result]);
                        toast({
                          title: "تم الإرفاق",
                          description: "تم رفع وإرفاق المستند بالقيد بنجاح",
                        });
                      }
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
            </div>

            <div className="space-y-2 mt-4">
              <Label>المرفقات الحالية ({currentAttachments.length})</Label>
              {currentAttachments.length === 0 ? (
                <div className="text-sm text-muted-foreground p-4 bg-muted/20 text-center rounded-lg border border-dashed">
                  لا توجد مرفقات لهذا القيد حالياً.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {currentAttachments.map((att, idx) => (
                    <div
                      key={idx}
                      className="border rounded-md overflow-hidden relative group h-32 flex items-center justify-center bg-muted/20"
                    >
                      {att.startsWith("data:image") ? (
                        <img
                          src={att}
                          alt={`Attachment ${idx + 1}`}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="text-sm text-center flex flex-col items-center">
                          <Paperclip className="h-6 w-6 text-primary mb-2" />
                          <span>مستند {idx + 1}</span>
                        </div>
                      )}
                      <a
                        href={att}
                        download={`attachment_${attachmentJournalId}_${idx + 1}`}
                        className="absolute inset-0 bg-black/60 hidden group-hover:flex items-center justify-center text-white transition-all text-xs font-bold"
                      >
                        تحميل المستند
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Document Dialog */}
      <Dialog open={isViewJournalOpen} onOpenChange={setIsViewJournalOpen}>
        <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto text-right print:max-w-none print:w-full print:h-full print:m-0 print:border-none print:shadow-none bg-card">
          <DialogHeader className="print:hidden">
            <DialogTitle className="text-lg font-bold text-right">
              سند قيد يومية عامة (محاسبي)
            </DialogTitle>
          </DialogHeader>

          {selectedJournal &&
            (() => {
              const totalDebit = selectedJournal.lines.reduce(
                (s, l) => s + (Number(l.debit) || 0),
                0,
              );
              const totalCredit = selectedJournal.lines.reduce(
                (s, l) => s + (Number(l.credit) || 0),
                0,
              );
              const jCurr = selectedJournal.currency || "USD";

              const isSingleCurrency = selectedJournal.lines.every(
                (l) => (l.currency || jCurr) === (selectedJournal.lines[0]?.currency || jCurr),
              );

              const totalBaseDebit = selectedJournal.lines.reduce((sum, l) => {
                return sum + getLineBaseValue(l.debit, l.rate || 1, l.currency || jCurr || "USD");
              }, 0);

              const totalBaseCredit = selectedJournal.lines.reduce((sum, l) => {
                return sum + getLineBaseValue(l.credit, l.rate || 1, l.currency || jCurr || "USD");
              }, 0);

              const isBalanced = isSingleCurrency
                ? Math.abs(totalDebit - totalCredit) < 0.01
                : Math.abs(totalBaseDebit - totalBaseCredit) < 0.05;

              const balanceDiff = isSingleCurrency
                ? Math.abs(totalDebit - totalCredit)
                : Math.abs(totalBaseDebit - totalBaseCredit);

              return (
                <div className="p-6 bg-white dark:bg-zinc-900 text-foreground space-y-6 rounded-xl border print:border-none print:p-0">
                  {/* Header */}
                  <div className="flex flex-row justify-between items-start border-b pb-4">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-primary block">
                        نظام الإدارة المالية والمحاسبية
                      </span>
                      <h2 className="text-2xl font-black tracking-tight text-foreground">
                        سند قيد يومية عامة
                      </h2>
                      <div className="flex items-center gap-2 pt-1">
                        <Badge
                          variant="outline"
                          className="font-mono font-black text-xs bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700 px-3 py-1 shadow-xs"
                        >
                          قيد رقم: {selectedJournal.reference}
                        </Badge>
                        <Badge className="font-mono text-xs">عملة القيد: {jCurr}</Badge>
                      </div>
                    </div>
                    <div className="text-left font-mono text-xs space-y-1 text-muted-foreground">
                      <span className="block font-bold text-foreground">
                        رقم المعرف: {selectedJournal.id.substring(0, 18)}
                      </span>
                      <span className="block">📅 تاريخ القيد: {selectedJournal.date}</span>
                      <span className="block">
                        بواسطة: {selectedJournal.created_by || "النظام الآلي"}
                      </span>
                      {isBalanced ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 font-bold">
                          مرحل ومتزن ✓
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 font-bold">
                          غير متزن (فارق: {balanceDiff.toLocaleString()}) ⚠️
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Main description */}
                  <div className="p-3.5 bg-muted/40 rounded-xl border">
                    <span className="block text-xs font-semibold text-muted-foreground mb-1">
                      شرح وبيان القيد المحاسبي:
                    </span>
                    <p className="font-bold text-base text-foreground">
                      {selectedJournal.description}
                    </p>
                  </div>

                  {/* Voucher Table RTL */}
                  <div className="border rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-sm text-right border-collapse">
                      <thead className="bg-muted/60 text-muted-foreground text-xs font-bold border-b">
                        <tr>
                          <th className="px-4 py-3 text-right">طرف القيد / الحساب</th>
                          <th className="px-3 py-3 text-right">كود الحساب</th>
                          <th className="px-3 py-3 text-right">البيان التفصيلي</th>
                          <th className="px-4 py-3 text-center text-emerald-700 dark:text-emerald-400 bg-emerald-500/5">
                            مدين ({jCurr})
                          </th>
                          <th className="px-4 py-3 text-center text-rose-700 dark:text-rose-400 bg-rose-500/5">
                            دائن ({jCurr})
                          </th>
                          <th className="px-3 py-3 text-center">العملة / المعامل</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedJournal.lines.map((l, i) => {
                          const acc = accounts.find((a) => a.code === l.account_code);
                          const isDebit = Number(l.debit) > 0;
                          const lineCurr = l.currency || jCurr;
                          const rate = l.rate || 1;
                          const isForeign = lineCurr !== "USD" || rate !== 1;

                          return (
                            <tr key={i} className="hover:bg-muted/10 transition">
                              <td className="px-4 py-3 font-medium">
                                <div className="flex items-center gap-2">
                                  {isDebit ? (
                                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 shrink-0">
                                      من حـ/
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 shrink-0 mr-3">
                                      إلى حـ/
                                    </span>
                                  )}
                                  <span
                                    className={`font-semibold ${isDebit ? "text-emerald-900 dark:text-emerald-200" : "text-rose-900 dark:text-rose-200"}`}
                                  >
                                    {acc?.name_ar || l.description || "حساب محاسبي"}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-3 font-mono text-xs text-muted-foreground font-semibold">
                                {l.account_code}
                              </td>
                              <td className="px-3 py-3 text-xs text-foreground/80">
                                {l.description || selectedJournal.description || "-"}
                              </td>
                              <td className="px-4 py-3 font-mono font-bold text-center text-emerald-700 dark:text-emerald-400 bg-emerald-500/5">
                                {Number(l.debit) > 0 ? (
                                  <div>
                                    <span>{formatCurrency(Number(l.debit), lineCurr)}</span>
                                    {lineCurr !== "USD" && (
                                      <span className="block text-[10px] text-muted-foreground font-normal">
                                        (={" "}
                                        {formatCurrency(
                                          rate > 0 ? Number(l.debit) * rate : Number(l.debit),
                                          "USD",
                                        )}
                                        )
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/30">-</span>
                                )}
                              </td>
                              <td className="px-4 py-3 font-mono font-bold text-center text-rose-700 dark:text-rose-400 bg-rose-500/5">
                                {Number(l.credit) > 0 ? (
                                  <div>
                                    <span>{formatCurrency(Number(l.credit), lineCurr)}</span>
                                    {lineCurr !== "USD" && (
                                      <span className="block text-[10px] text-muted-foreground font-normal">
                                        (={" "}
                                        {formatCurrency(
                                          rate > 0 ? Number(l.credit) * rate : Number(l.credit),
                                          "USD",
                                        )}
                                        )
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/30">-</span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-center">
                                <Badge
                                  variant="outline"
                                  className="font-mono text-[10px] px-1.5 py-0"
                                >
                                  {lineCurr} {rate !== 1 ? `@ ${rate}` : ""}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="divide-y border-t bg-muted/20">
                        {Array.from(
                          new Set(selectedJournal.lines.map((l) => l.currency || jCurr)),
                        ).map((curr) => {
                          const currLines = selectedJournal.lines.filter(
                            (l) => (l.currency || jCurr) === curr,
                          );
                          const cDebit = currLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
                          const cCredit = currLines.reduce(
                            (s, l) => s + (Number(l.credit) || 0),
                            0,
                          );

                          const cBaseDebit = currLines.reduce((s, l) => {
                            return (
                              s +
                              getLineBaseValue(l.debit, l.rate || 1, l.currency || curr || "USD")
                            );
                          }, 0);

                          const cBaseCredit = currLines.reduce((s, l) => {
                            return (
                              s +
                              getLineBaseValue(l.credit, l.rate || 1, l.currency || curr || "USD")
                            );
                          }, 0);

                          return (
                            <tr key={curr} className="text-xs font-semibold bg-muted/10">
                              <td
                                colSpan={3}
                                className="px-4 py-2.5 text-right text-muted-foreground"
                              >
                                <span className="font-bold text-foreground">
                                  مجموع حركة عملة ({curr}):
                                </span>
                              </td>
                              <td className="px-4 py-2.5 font-mono text-center font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/5">
                                <div>
                                  <span>{formatCurrency(cDebit, curr)}</span>
                                  {curr !== "USD" && (
                                    <span className="block text-[10px] text-emerald-600/80 font-normal">
                                      (= {formatCurrency(cBaseDebit, "USD")})
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-2.5 font-mono text-center font-bold text-rose-700 dark:text-rose-400 bg-rose-500/5">
                                <div>
                                  <span>{formatCurrency(cCredit, curr)}</span>
                                  {curr !== "USD" && (
                                    <span className="block text-[10px] text-rose-600/80 font-normal">
                                      (= {formatCurrency(cBaseCredit, "USD")})
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <Badge variant="secondary" className="font-mono text-[10px]">
                                  {curr}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}

                        {/* Net USD row */}
                        <tr className="bg-primary/5 dark:bg-primary/10 font-bold border-t-2 border-primary/30 text-sm">
                          <td
                            colSpan={3}
                            className="px-4 py-3 text-right text-foreground font-black"
                          >
                            الصافي / الإجمالي النهائي للقيد بالدولار (USD):
                          </td>
                          <td className="px-4 py-3 font-mono text-center font-black text-emerald-700 dark:text-emerald-400 bg-emerald-500/15">
                            {formatCurrency(totalBaseDebit, "USD")}
                          </td>
                          <td className="px-4 py-3 font-mono text-center font-black text-rose-700 dark:text-rose-400 bg-rose-500/15">
                            {formatCurrency(totalBaseCredit, "USD")}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <Badge
                              className={`font-mono text-xs font-bold ${
                                isBalanced
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300"
                                  : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300"
                              }`}
                            >
                              {isBalanced ? "متزن ✓" : "غير متزن ⚠️"}
                            </Badge>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Signatures */}
                  <div className="grid grid-cols-3 gap-6 pt-8 mt-6 border-t text-center print:pt-16">
                    <div>
                      <div className="border-b border-dashed border-gray-400 w-3/4 mx-auto mb-2"></div>
                      <span className="text-xs font-semibold text-muted-foreground">
                        إعداد المحاسب
                      </span>
                    </div>
                    <div>
                      <div className="border-b border-dashed border-gray-400 w-3/4 mx-auto mb-2"></div>
                      <span className="text-xs font-semibold text-muted-foreground">
                        المراجعة والتدقيق
                      </span>
                    </div>
                    <div>
                      <div className="border-b border-dashed border-gray-400 w-3/4 mx-auto mb-2"></div>
                      <span className="text-xs font-semibold text-muted-foreground">
                        اعتماد المدير المالي
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

          <DialogFooter className="print:hidden flex justify-between sm:justify-between items-center w-full gap-2">
            <Button variant="outline" onClick={() => setIsViewJournalOpen(false)}>
              إغلاق
            </Button>
            <Button
              onClick={() => {
                if (selectedJournal) {
                  printJournalEntryDocument(selectedJournal, accounts, formatCurrency);
                }
              }}
              className="gap-2 bg-primary text-primary-foreground font-bold"
            >
              <Printer size={16} />
              طباعة سند القيد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Paste & Process Oracle Text Modal */}
      <Dialog open={isPasteModalOpen} onOpenChange={setIsPasteModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
              <ClipboardPaste className="h-6 w-6" />
              لصق ومعالجة بيانات القيود نصياً (معالجة ذكية وسريعة)
            </DialogTitle>
            <DialogDescription>
              يمكنك نسخ جدول البيانات من ملف Excel أو أوراكل أو المحادثة ولصقه هنا مباشرة. سيقوم
              النظام بتحليله، والتعرف على التواريخ والعملات، وتجميع الأسطر إلى قيود متوازنة بدقة.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">نص الجدول المنسوخ (Raw Table Data)</Label>
                {pasteRawText && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPasteRawText("");
                      setParsedEntriesPreview([]);
                      setParsedRowsCount(0);
                    }}
                    className="text-xs text-rose-500 h-7"
                  >
                    مسح النص
                  </Button>
                )}
              </div>
              <textarea
                value={pasteRawText}
                onChange={(e) => setPasteRawText(e.target.value)}
                placeholder={`انسخ الأسطر والصقها هنا...\nمثال:\n1 13010111 ص س / بنك الخرطوم 0 100000000 ايداع 18/08/2026 1 1 1 1 0 100000000`}
                className="w-full h-44 p-3 font-mono text-xs rounded-xl border border-border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                dir="ltr"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => handleProcessPasteText()}
                disabled={!pasteRawText.trim() || isProcessingPaste}
                className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex-1"
              >
                <Sparkles className="h-4 w-4" />
                {isProcessingPaste ? "جاري التحليل والمعالجة..." : "تحليل ومعاينة القيود"}
              </Button>
            </div>

            {/* Preview Results */}
            {parsedEntriesPreview.length > 0 && (
              <div className="space-y-3 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <span className="font-bold text-sm text-foreground">
                      نتيجة المعالجة: {parsedEntriesPreview.length} قيد متوازن (من أصل{" "}
                      {parsedRowsCount} سطر)
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-background text-indigo-700 dark:text-indigo-400 border-indigo-300"
                  >
                    جاهز للاستيراد
                  </Badge>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {parsedEntriesPreview.map((entry, idx) => {
                    const totalDebit = entry.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
                    const totalCredit = entry.lines.reduce(
                      (s, l) => s + (Number(l.credit) || 0),
                      0,
                    );
                    const entryCurrencies = Array.from(
                      new Set(entry.lines.map((l) => l.currency || entry.currency || "USD")),
                    );
                    const isSingleCurrency = entryCurrencies.length <= 1;

                    const totalBaseDebit = entry.lines.reduce((sum, l) => {
                      return (
                        sum +
                        getLineBaseValue(
                          l.debit,
                          l.rate || 1,
                          l.currency || entry.currency || "USD",
                        )
                      );
                    }, 0);

                    const totalBaseCredit = entry.lines.reduce((sum, l) => {
                      return (
                        sum +
                        getLineBaseValue(
                          l.credit,
                          l.rate || 1,
                          l.currency || entry.currency || "USD",
                        )
                      );
                    }, 0);

                    const isBalanced = isSingleCurrency
                      ? Math.abs(totalDebit - totalCredit) < 0.01
                      : Math.abs(totalBaseDebit - totalBaseCredit) < 0.05;

                    return (
                      <div
                        key={entry.id ? `${entry.id}-${idx}` : idx}
                        className="bg-card p-3 rounded-lg border border-border text-xs space-y-1.5 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="font-mono font-black text-[11px] bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700 px-2 py-0.5"
                            >
                              #{entry.reference || idx + 1}
                            </Badge>
                            {entryCurrencies.map((c) => (
                              <Badge
                                key={c}
                                className={`font-mono text-[10px] font-bold border ${
                                  c === "USD"
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300"
                                    : c === "SSP"
                                      ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300"
                                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300"
                                }`}
                              >
                                {c === "USD" ? "💵 USD" : c === "SSP" ? "🇸🇸 SSP" : "🇪🇬 EGP"}
                              </Badge>
                            ))}
                            <span className="font-medium text-foreground">{entry.description}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground font-mono">{entry.date}</span>
                            <Badge
                              variant="outline"
                              className={
                                isBalanced
                                  ? "text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20"
                                  : "text-rose-600 border-rose-300 bg-rose-50 dark:bg-rose-950/20"
                              }
                            >
                              {isBalanced ? "متزن ✓" : "غير متزن ⚠️"}
                            </Badge>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1 pt-1 text-[11px] text-muted-foreground">
                          {entry.lines.map((line, lIdx) => (
                            <div
                              key={lIdx}
                              className="flex justify-between bg-muted/40 px-2 py-1 rounded"
                            >
                              <span className="truncate max-w-[200px]">
                                {line.account_code} - {line.description || line.account_name}
                              </span>
                              <span className="font-mono font-semibold text-foreground">
                                {line.debit > 0
                                  ? `مدين: ${line.debit.toLocaleString()}`
                                  : `دائن: ${line.credit.toLocaleString()}`}{" "}
                                {line.currency}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsPasteModalOpen(false)}
              className="rounded-xl"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleConfirmPasteImport}
              disabled={parsedEntriesPreview.length === 0}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
            >
              <Check className="h-4 w-4" />
              تأكيد واستيراد {parsedEntriesPreview.length} قيد إلى دفتر اليومية
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(balanceAdjustmentEntry)}
        onOpenChange={(open) => !open && setBalanceAdjustmentEntry(null)}
      >
        <AlertDialogContent className="rounded-2xl max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Scale className="h-5 w-5" />
              تأكيد تسوية فرق القيد
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-right text-sm space-y-3 pt-2">
                {balanceAdjustmentEntry &&
                  (() => {
                    const info = getEntryBalanceInfo(balanceAdjustmentEntry);
                    const sideLabel = info.side === "debit" ? "المدين" : "الدائن";
                    return (
                      <>
                        <p>
                          القيد <strong>{balanceAdjustmentEntry.reference}</strong> غير متزن بفارق:
                        </p>
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 font-bold">
                          {formatCurrency(
                            info.difference,
                            info.isSingleCurrency ? info.currency : "USD",
                          )}
                        </div>
                        <p>
                          هل أنت متأكد من تسوية فارق الاتزان بإضافة سطر تسوية أوتوماتيكي لهذا القيد؟
                        </p>
                        <p className="text-xs text-muted-foreground">
                          سيتم إدراج سطر تسوية بقيمة الفارق في نهاية القيد الحالي لتحقيق الاتزان
                          الكامل بنفس رقم وتاريخ القيد.
                        </p>
                      </>
                    );
                  })()}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-start gap-2">
            <AlertDialogAction
              onClick={confirmBalanceAdjustment}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl"
            >
              نعم، أضف الفرق وسوِّ القيد
            </AlertDialogAction>
            <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Save Confirmation Dialog */}
      <AlertDialog open={isSaveConfirmOpen} onOpenChange={setIsSaveConfirmOpen}>
        <AlertDialogContent className="rounded-2xl max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-lg font-bold">
              <Database className="h-5 w-5 text-emerald-600" />
              تأكيد حفظ وتثبيت القيود في قاعدة البيانات
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-right text-sm space-y-3 pt-2 text-foreground/80 leading-relaxed">
                <p>
                  هل أنت متأكد من حفظ وتثبيت عدد{" "}
                  <strong className="text-emerald-700 dark:text-emerald-400 font-bold font-mono text-base">
                    {unsavedEntries.length} قيد بحاجة للحفظ محاسبي
                  </strong>{" "}
                  في قاعدة البيانات والتخزين الدائم للنظام؟
                </p>
                <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-900 dark:text-emerald-200 space-y-2">
                  <p className="font-bold flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    ما هي العمليات التي سيتم تثبيتها؟
                  </p>
                  <ul className="list-disc list-inside space-y-1 mr-1 text-[12px] text-muted-foreground dark:text-emerald-200/90">
                    <li>حفظ وتثبيت كافة أسطر القيود المحاسبية في قاعدة البيانات.</li>
                    <li>إنشاء أي حسابات جديدة تلقائياً في دليل الحسابات العام.</li>
                    <li>مزامنة وتحديث أرصدة الخزائن والحسابات البنكية فوراً.</li>
                    <li>
                      <strong className="text-foreground font-semibold">
                        لن تفقد أي بيانات عند تحديث الصفحة أو تسجيل الخروج.
                      </strong>
                    </li>
                  </ul>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-start gap-2 pt-3">
            <AlertDialogAction
              onClick={handleSaveAndPersistJournals}
              disabled={isSavingToDb}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl gap-2"
            >
              <Save className="h-4 w-4" />
              {isSavingToDb ? "جاري الحفظ والتثبيت..." : "نعم، تأكيد وحفظ القيود الآن"}
            </AlertDialogAction>
            <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <LedgerBottomDialogs
        isSaveReportOpen={isSaveReportOpen}
        setIsSaveReportOpen={setIsSaveReportOpen}
        saveReportData={saveReportData}
        checkIsEntryBalanced={checkIsEntryBalanced}
        isClearConfirmOpen={isClearConfirmOpen}
        setIsClearConfirmOpen={setIsClearConfirmOpen}
        handleClearAllJournals={handleClearAllJournals}
        isDeleteSingleOpen={isDeleteSingleOpen}
        setIsDeleteSingleOpen={setIsDeleteSingleOpen}
        entryToDelete={entryToDelete}
        handleConfirmDeleteSingle={handleConfirmDeleteSingle}
        isClosedYearAlertOpen={isClosedYearAlertOpen}
        setIsClosedYearAlertOpen={setIsClosedYearAlertOpen}
        closedYearAlertMessage={closedYearAlertMessage}
        isEditEntryOpen={isEditEntryOpen}
        setIsEditEntryOpen={setIsEditEntryOpen}
        editEntryRef={editEntryRef}
        setEditEntryRef={setEditEntryRef}
        editEntryDate={editEntryDate}
        setEditEntryDate={setEditEntryDate}
        editEntryDesc={editEntryDesc}
        setEditEntryDesc={setEditEntryDesc}
        editEntryLines={editEntryLines}
        setEditEntryLines={setEditEntryLines}
        level4Accounts={level4Accounts}
        editEntryTotals={editEntryTotals}
        handleSaveEditEntry={handleSaveEditEntry}
      />
    </div>
  );
}
