// @ts-nocheck
import {
  createFileRoute,
  useNavigate,
  useBlocker,
  useLocation,
  Link,
} from "@tanstack/react-router";
import { extractTabParam, useSyncedSubTab } from "@/components/navigation/navigationRegistry";
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
import { TreasuryManagementView } from "@/components/admin/TreasuryManagementView";
import { TreasuryReportModal } from "@/components/admin/TreasuryReportModal";
import { AdvancedFinancialReportsSuite } from "@/components/admin/AdvancedFinancialReportsSuite";
import { ViewModeToggle, useViewMode } from "@/components/ui/view-mode-toggle";
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
  Vault,
  ArrowUpLeft,
  X,
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

  // UI state — Unified 3-Section Architecture (definitions | operations | reports)
  const location = useLocation();
  const [viewMode, setViewMode] = useViewMode("ledger", "grid");
  const [activeDefTool, setActiveDefTool] = useState<null | "accounts" | "treasury">(null);
  const [activeOperationTool, setActiveOperationTool] = useState<
    null | "vouchers" | "transfers" | "journal" | "general_ledger"
  >(null);
  const [activeReportTool, setActiveReportTool] = useState<
    null | "vouchers_register" | "unified_reports" | "treasury_report"
  >(null);
  const [isTreasuryReportModalOpen, setIsTreasuryReportModalOpen] = useState(false);

  const navigateToLedgerSubpage = (tabKey: string) => {
    navigate({
      to: "/admin/ledger" as any,
      search: { tab: tabKey } as any,
    });
  };

  // Treasury Transfer State (عمليات التحويل بين الخزائن)
  const [transferSourceId, setTransferSourceId] = useState("");
  const [transferTargetId, setTransferTargetId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferCurrency, setTransferCurrency] = useState<"EGP" | "USD" | "SSP">("EGP");
  const [transferNote, setTransferNote] = useState("");

  const handleExecuteTreasuryTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(String(transferAmount).replace(/,/g, "").trim());
    if (!transferSourceId || !transferTargetId || !amountNum || amountNum <= 0) {
      toast({
        title: "بيانات غير مكتملة",
        description: "يرجى اختيار الخزينة المحول منها والخزينة المستلمة وإدخال مبلغ صحيح.",
        variant: "destructive",
      });
      return;
    }
    if (transferSourceId === transferTargetId) {
      toast({
        title: "تنبيه",
        description: "لا يمكن التحويل إلى نفس الخزينة المصدر.",
        variant: "destructive",
      });
      return;
    }
    try {
      erpStore.transferBetweenTreasuries(
        transferSourceId,
        transferTargetId,
        amountNum,
        transferCurrency,
        transferNote.trim() || "تحويل نقدي داخلي بين الخزائن",
        "المسؤول المالي",
      );
      setErpState({ ...erpStore.getState() });
      setTransferAmount("");
      setTransferNote("");
      toast({
        title: "تم التحويل بين الخزائن بنجاح",
        description: `تم تحويل ${amountNum.toLocaleString()} ${transferCurrency} وتوليد قيد المناقلة المحاسبي تلقائياً.`,
      });
    } catch (err: any) {
      toast({
        title: "تعذر إتمام التحويل",
        description: err?.message || "حدث خطأ أثناء تنفيذ التحويل بين الخزائن",
        variant: "destructive",
      });
    }
  };

  const normalizeLedgerTab = (
    tabParam?: string | null,
  ): "definitions" | "operations" | "reports" => {
    if (!tabParam) return "operations";
    if (tabParam === "definitions" || tabParam === "accounts" || tabParam === "treasury") {
      return "definitions";
    }
    if (
      tabParam === "reports" ||
      tabParam === "vouchers_register" ||
      tabParam === "unified_reports" ||
      tabParam === "treasury_report" ||
      tabParam === "financial_position" ||
      tabParam === "trial" ||
      tabParam === "statements"
    ) {
      return "reports";
    }
    return "operations";
  };

  const [selectedTab, setSelectedTab] = useState<"definitions" | "operations" | "reports">(() => {
    const tabParam = extractTabParam(location.search, (location as any).searchStr);
    return normalizeLedgerTab(tabParam);
  });

  useEffect(() => {
    const tabParam = extractTabParam(location.search, (location as any).searchStr);
    if (tabParam === "definitions") {
      setActiveDefTool(null);
    } else if (tabParam === "accounts") {
      setActiveDefTool("accounts");
    } else if (tabParam === "treasury") {
      setActiveDefTool("treasury");
    } else if (
      tabParam === "vouchers" ||
      tabParam === "payments" ||
      tabParam === "expenses" ||
      tabParam === "mall_finance"
    ) {
      setActiveOperationTool("vouchers");
    } else if (tabParam === "transfers") {
      setActiveOperationTool("transfers");
    } else if (tabParam === "journal") {
      setActiveOperationTool("journal");
    } else if (tabParam === "general_ledger" || tabParam === "ledger") {
      setActiveOperationTool("general_ledger");
    } else if (!tabParam || tabParam === "operations" || tabParam === "hub") {
      setActiveOperationTool(null);
    } else if (tabParam === "reports") {
      setActiveReportTool(null);
    } else if (tabParam === "vouchers_register") {
      setActiveReportTool("vouchers_register");
    } else if (
      tabParam === "unified_reports" ||
      tabParam === "financial_position" ||
      tabParam === "trial" ||
      tabParam === "statements"
    ) {
      setActiveReportTool("unified_reports");
    } else if (tabParam === "treasury_report") {
      setActiveReportTool("treasury_report");
    }
    setSelectedTab(normalizeLedgerTab(tabParam));
  }, [location.search, (location as any).searchStr]);

  useSyncedSubTab("/admin/ledger", selectedTab, setSelectedTab as any, "operations");

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
    (JournalLine & { currency?: string; rate?: number; side?: "debit" | "credit" })[]
  >([
    { account_code: "", debit: 0, credit: 0, side: "debit", currency: "USD", rate: 1 },
    { account_code: "", debit: 0, credit: 0, side: "credit", currency: "SSP", rate: 1 },
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
    const newDraft = {
      id: `draft-je-${Date.now()}`,
      newEntryDate,
      newEntryRef: newEntryRef || erpStore.generateJournalReference(newEntryDate),
      newEntryDesc: newEntryDesc.trim() || `مسودة قيد يومية (${newEntryDate})`,
      newEntryId,
      newEntryAttachments,
      newEntryLines,
      savedAt: new Date().toISOString(),
    };
    try {
      const existing = [newDraft, ...journalDrafts.filter((d) => d.id !== newDraft.id)].slice(
        0,
        15,
      );
      localStorage.setItem("restocash_journal_drafts", JSON.stringify(existing));
      setJournalDrafts(existing);
      toast({
        title: "💾 تم حفظ القيد كمسودة مؤقتة",
        description: `تم حفظ المسودة بنجاح (مرجع: ${newDraft.newEntryRef}). يمكنك استعادتها واستكمالها في أي وقت.`,
      });
      setIsConfirmPostOpen(false);
      setIsExitEntryConfirmOpen(false);
      setIsNewEntryOpen(false);
    } catch {
      toast({ title: "خطأ", description: "تعذر حفظ مسودة القيد.", variant: "destructive" });
    }
  };

  const handleDiscardNewEntry = () => {
    const today = new Date().toISOString().split("T")[0];
    setNewEntryDate(today);
    setNewEntryRef(erpStore.generateJournalReference(today));
    setNewEntryId("");
    setNewEntryDesc("");
    setNewEntryAttachments([]);
    setNewEntryLines([
      {
        account_code: "",
        debit: 0,
        credit: 0,
        side: "debit",
        description: "",
        currency: "USD",
        rate: 1,
      },
      {
        account_code: "",
        debit: 0,
        credit: 0,
        side: "credit",
        description: "",
        currency: "SSP",
        rate: 1,
      },
    ]);
    setIsExitEntryConfirmOpen(false);
    setIsConfirmPostOpen(false);
    setIsNewEntryOpen(false);
    toast({
      title: "تم تجاهل القيد",
      description: "تم إغلاق نافذة القيد وتجاهل البيانات غير المحفوظة.",
    });
  };

  const handleLoadJournalDraft = (draft: any) => {
    setNewEntryDate(draft.newEntryDate || new Date().toISOString().split("T")[0]);
    setNewEntryRef(draft.newEntryRef || erpStore.generateJournalReference(draft.newEntryDate));
    setNewEntryDesc(draft.newEntryDesc || "");
    setNewEntryId(draft.newEntryId || "");
    setNewEntryAttachments(draft.newEntryAttachments || []);
    setNewEntryLines(
      draft.newEntryLines || [
        { account_code: "", debit: 0, credit: 0, description: "", currency: "USD", rate: 1 },
        { account_code: "", debit: 0, credit: 0, description: "", currency: "SSP", rate: 1 },
      ],
    );
    setIsNewEntryOpen(true);
    toast({
      title: "تم استعادة مسودة القيد",
      description: `تم تحميل بيانات القيد المسودة (${draft.newEntryRef || ""}) بنجاح.`,
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
    setIsExitEntryConfirmOpen(true);
  };

  // Edit Journal Entry State
  const [isEditEntryOpen, setIsEditEntryOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editEntryDesc, setEditEntryDesc] = useState("");
  const [editEntryRef, setEditEntryRef] = useState("");
  const [editEntryDate, setEditEntryDate] = useState("");
  const [editEntryLines, setEditEntryLines] = useState<
    (JournalLine & { currency?: string; rate?: number; side?: "debit" | "credit" })[]
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
    const totalAssets = assetAccounts.reduce(
      (sum, r) => sum + (r.balanceType === "Dr" ? r.endingBalance : -r.endingBalance),
      0,
    );

    // Liabilities
    const liabilityAccounts = trialBalance.rows.filter((r) => r.type === "liability");
    const totalLiabilities = liabilityAccounts.reduce(
      (sum, r) => sum + (r.balanceType === "Cr" ? r.endingBalance : -r.endingBalance),
      0,
    );

    // Equity
    const equityAccounts = trialBalance.rows.filter((r) => r.type === "equity");
    const totalEquity = equityAccounts.reduce((sum, r) => {
      const val = r.balanceType === "Cr" ? r.endingBalance : -r.endingBalance;
      return sum + val;
    }, 0);

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
      { account_code: "", debit: 0, credit: 0, side: "debit", currency: "USD", rate: 1 },
      { account_code: "", debit: 0, credit: 0, side: "credit", currency: "SSP", rate: 1 },
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
    const lastLine = newEntryLines[newEntryLines.length - 1];
    const lastCurrency = lastLine?.currency || "USD";
    const lastRate =
      lastLine?.rate || (lastCurrency === "USD" ? 1 : erpStore.getExchangeRate(lastCurrency) || 1);
    const debitsBase = newEntryLines.reduce(
      (sum, l) => sum + getLineBaseValue(l.debit, l.rate || 1, l.currency || "USD"),
      0,
    );
    const creditsBase = newEntryLines.reduce(
      (sum, l) => sum + getLineBaseValue(l.credit, l.rate || 1, l.currency || "USD"),
      0,
    );
    const suggestedSide: "debit" | "credit" = debitsBase > creditsBase ? "credit" : "debit";
    setNewEntryLines([
      ...newEntryLines,
      {
        account_code: "",
        debit: 0,
        credit: 0,
        side: suggestedSide,
        description: "",
        currency: lastCurrency,
        rate: lastRate,
      },
    ]);
  };

  // Auto-balance the current manual entry by filling the empty line or appending a balancing row
  const handleAutoBalanceNewEntry = () => {
    const debitsBase = newEntryLines.reduce(
      (sum, l) => sum + getLineBaseValue(l.debit, l.rate || 1, l.currency || "USD"),
      0,
    );
    const creditsBase = newEntryLines.reduce(
      (sum, l) => sum + getLineBaseValue(l.credit, l.rate || 1, l.currency || "USD"),
      0,
    );
    const diffBase = Math.abs(debitsBase - creditsBase);
    if (diffBase < 0.01) {
      toast({ title: "القيد متزن بالفعل ✓", description: "مجموع المدين يساوي مجموع الدائن." });
      return;
    }

    const needDebit = debitsBase < creditsBase;
    const lines = [...newEntryLines];
    const emptyIdx = lines.findIndex(
      (l) => (Number(l.debit) || 0) === 0 && (Number(l.credit) || 0) === 0,
    );

    if (emptyIdx !== -1) {
      const targetLine = { ...lines[emptyIdx] };
      const curr = targetLine.currency || "USD";
      const rate = Number(targetLine.rate) > 0 ? Number(targetLine.rate) : 1;
      const convertedAmt =
        curr === "USD" ? Number(diffBase.toFixed(2)) : Number((diffBase * rate).toFixed(2));
      targetLine.side = needDebit ? "debit" : "credit";
      targetLine.debit = needDebit ? convertedAmt : 0;
      targetLine.credit = needDebit ? 0 : convertedAmt;
      if (!targetLine.description) {
        targetLine.description = "موازنة القيد المحاسبي";
      }
      lines[emptyIdx] = targetLine;
      setNewEntryLines(lines);
      toast({
        title: "⚖️ تم تعبئة فرق الاتزان في السطر #" + (emptyIdx + 1),
        description: `تم إدراج مبلغ (${convertedAmt.toLocaleString()} ${curr}) في جانب ${needDebit ? "المدين" : "الدائن"} ليصبح القيد متزناً.`,
      });
    } else {
      const defaultAcc =
        level4Accounts.find((a) => a.code === "509")?.code || level4Accounts[0]?.code || "";
      const balancingRow = {
        account_code: defaultAcc,
        side: (needDebit ? "debit" : "credit") as "debit" | "credit",
        debit: needDebit ? Number(diffBase.toFixed(2)) : 0,
        credit: needDebit ? 0 : Number(diffBase.toFixed(2)),
        currency: "USD",
        rate: 1,
        description: "سطر موازنة القيد المحاسبي",
      };
      setNewEntryLines([...lines, balancingRow]);
      toast({
        title: "⚖️ تم إدراج سطر الموازنة داخل القيد",
        description: `تم إضافة السطر رقم #${lines.length + 1} بقيمة (${diffBase.toFixed(2)} USD) في جانب ${needDebit ? "المدين" : "الدائن"}.`,
      });
    }
  };

  // Remove line from manual journal entry
  const removeEntryLine = (index: number) => {
    if (newEntryLines.length <= 2) {
      toast({
        title: "تنبيه حدود القيد المزدوج",
        description: "يجب أن يحتوي القيد المحاسبي الواحد على سطرين (مدين ودائن) على الأقل.",
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
      let detectedCurrency = account.currency || "USD";
      if (account.name_ar.includes("دولار") || account.name_ar.includes("USD")) {
        detectedCurrency = "USD";
      } else if (account.name_ar.includes("سوداني") || account.name_ar.includes("SSP")) {
        detectedCurrency = "SSP";
      } else if (account.name_ar.includes("مصري") || account.name_ar.includes("EGP")) {
        detectedCurrency = "EGP";
      }
      lines[index].currency = detectedCurrency;
      if (!lines[index].rate || lines[index].rate === 1) {
        lines[index].rate =
          detectedCurrency === "USD" ? 1.0 : erpStore.getExchangeRate(detectedCurrency) || 1.0;
      }
    }
    setNewEntryLines(lines);
  };

  // Update line field
  const updateLine = (index: number, field: string, value: any) => {
    const lines = [...newEntryLines];
    const currentSide: "debit" | "credit" =
      lines[index].side ||
      (Number(lines[index].credit) > 0
        ? "credit"
        : Number(lines[index].debit) > 0
          ? "debit"
          : index === 1
            ? "credit"
            : "debit");

    if (field === "side") {
      const nextSide: "debit" | "credit" = value === "credit" ? "credit" : "debit";
      const currentAmt = Number(lines[index].debit) || Number(lines[index].credit) || 0;
      lines[index].side = nextSide;
      lines[index].debit = nextSide === "debit" ? currentAmt : 0;
      lines[index].credit = nextSide === "credit" ? currentAmt : 0;
    } else if (field === "amount") {
      const amt = Math.max(0, Number(value) || 0);
      lines[index].side = currentSide;
      lines[index].debit = currentSide === "debit" ? amt : 0;
      lines[index].credit = currentSide === "credit" ? amt : 0;
    } else if (field === "debit") {
      lines[index].debit = Number(value) || 0;
      if (lines[index].debit > 0) {
        lines[index].credit = 0;
        lines[index].side = "debit";
      }
    } else if (field === "credit") {
      lines[index].credit = Number(value) || 0;
      if (lines[index].credit > 0) {
        lines[index].debit = 0;
        lines[index].side = "credit";
      }
    } else if (field === "rate") {
      lines[index].rate = Number(value) || 1;
    } else if (field === "currency") {
      lines[index].currency = value;
      if (value === "USD") {
        lines[index].rate = 1;
      } else if (!lines[index].rate || lines[index].rate === 1) {
        lines[index].rate = erpStore.getExchangeRate(value) || 1;
      }
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
      isBalanced: difference < 0.05 && (debitsBase > 0 || creditsBase > 0),
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
      isBalanced: difference < 0.05 && (debitsBase > 0 || creditsBase > 0),
    };
  }, [editEntryLines]);

  // Handle opening confirmation dialog for manual journal entry (supports both balanced and unbalanced entries)
  const handlePostEntry = () => {
    if (!newEntryDesc.trim()) {
      toast({
        title: "⚠️ بيان القيد مطلوب",
        description: "يرجى كتابة الشرح والبيان العام للقيد المحاسبي في أعلى السند قبل الحفظ.",
        variant: "destructive",
      });
      return;
    }

    const missingAccountIdx = newEntryLines.findIndex((l) => !l.account_code);
    if (missingAccountIdx !== -1) {
      toast({
        title: `⚠️ حساب غير محدد في السطر #${missingAccountIdx + 1}`,
        description: `يرجى اختيار الحساب المحاسبي للسطر رقم (${missingAccountIdx + 1}) داخل جدول القيد.`,
        variant: "destructive",
      });
      return;
    }

    const invalidLevel4Idx = newEntryLines.findIndex((l) => {
      const acc = accounts.find((a) => a.code === l.account_code);
      return !acc || !isLevel4Account(acc);
    });
    if (invalidLevel4Idx !== -1) {
      const badCode = newEntryLines[invalidLevel4Idx].account_code;
      toast({
        title: `⚠️ حساب غير تشغيلي في السطر #${invalidLevel4Idx + 1}`,
        description: `الحساب (${badCode}) ليس من الدرجة الرابعة. القيود المحاسبية تُسجّل على حسابات الدرجة الرابعة التشغيلية فقط.`,
        variant: "destructive",
      });
      return;
    }

    const zeroAmountIdx = newEntryLines.findIndex(
      (l) => (Number(l.debit) || 0) <= 0 && (Number(l.credit) || 0) <= 0,
    );
    if (zeroAmountIdx !== -1) {
      toast({
        title: `⚠️ مبلغ السطر #${zeroAmountIdx + 1} فارغ`,
        description: `يرجى إدخال قيمة في خانة (مدين) أو (دائن) للسطر رقم (${zeroAmountIdx + 1}) أو حذف السطر الزائد.`,
        variant: "destructive",
      });
      return;
    }

    if (newEntryTotals.debits <= 0 && newEntryTotals.credits <= 0) {
      toast({
        title: "⚠️ خطأ في إجمالي القيد",
        description: "يجب أن يحتوي القيد على مبالغ أكبر من صفر قبل الحفظ.",
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

    // If unbalanced, notify the user immediately and open the confirmation dialog where they can confirm saving unbalanced
    if (!newEntryTotals.isBalanced) {
      toast({
        title: "⚠️ تنبيه: القيد غير متزن محاسبياً",
        description: `يوجد فارق قدره (${newEntryTotals.difference.toFixed(2)} USD) بين المدين والدائن. يمكنك مراجعة التنبيه وتأكيد حفظه وهو غير متزن أو موازنته.`,
      });
    }

    // Open confirmation dialog (handles both balanced and unbalanced confirmation)
    setIsConfirmPostOpen(true);
  };

  // Execute actual entry posting and update account balances (allows unbalanced when confirmed)
  const handleExecutePost = (allowUnbalanced = false) => {
    try {
      const preparedLines: JournalLine[] = newEntryLines.map((l) => ({
        account_code: l.account_code,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        currency: l.currency || "USD",
        rate: Number(l.rate) || 1,
        description: l.description || "",
      }));

      // Call state store to register entry & update accounts
      const createdEntry = erpStore.addJournalEntry(
        newEntryDesc,
        preparedLines,
        newEntryRef || undefined,
        preparedLines[0]?.currency || "USD",
        newEntryDate,
        newEntryId || undefined,
        newEntryAttachments,
        allowUnbalanced || !newEntryTotals.isBalanced,
      );

      setErpState({ ...erpStore.getState() });

      if (newEntryTotals.isBalanced) {
        toast({
          title: "✅ تم حفظ وترحيل القيد المحاسبي بنجاح",
          description: `تم إدراج القيد المتزن رقم (${createdEntry.reference}) بمبلغ (${newEntryTotals.debits.toFixed(2)} USD) وتحديث أرصدة الحسابات فوراً.`,
        });
      } else {
        toast({
          title: "⚠️ تم حفظ القيد (غير متزن) بناءً على تأكيدك",
          description: `تم حفظ القيد رقم (${createdEntry.reference}) مع وجود فرق اتزان (${newEntryTotals.difference.toFixed(2)} USD). يمكنك تسويته أو تعديله في أي وقت من جدول اليومية.`,
        });
      }

      // Reset Form & Close Modal
      setNewEntryId("");
      setNewEntryAttachments([]);
      setNewEntryDesc("");
      setNewEntryRef("");
      setNewEntryLines([
        { account_code: "", debit: 0, credit: 0, description: "", currency: "USD", rate: 1 },
        { account_code: "", debit: 0, credit: 0, description: "", currency: "SSP", rate: 1 },
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
      (entry.lines || []).map((l, idx) => ({
        account_code: l.account_code,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        side:
          Number(l.credit) > 0
            ? "credit"
            : Number(l.debit) > 0
              ? "debit"
              : idx === 1
                ? "credit"
                : "debit",
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

  // Save changes to edited entry (supports balanced and unbalanced when confirmed)
  const handleSaveEditEntry = (allowUnbalanced = false) => {
    if (!editingEntryId) return;
    if (!editEntryDesc.trim()) {
      toast({
        title: "⚠️ بيان القيد مطلوب",
        description: "يرجى كتابة الشرح والبيان العام للقيد اليومي قبل الحفظ.",
        variant: "destructive",
      });
      return;
    }

    const missingAccountIdx = editEntryLines.findIndex((l) => !l.account_code);
    if (missingAccountIdx !== -1) {
      toast({
        title: `⚠️ حساب غير محدد في السطر #${missingAccountIdx + 1}`,
        description: `يرجى اختيار الحساب المحاسبي للسطر رقم (${missingAccountIdx + 1}).`,
        variant: "destructive",
      });
      return;
    }

    const invalidEditLevel4Idx = editEntryLines.findIndex((l) => {
      const acc = accounts.find((a) => a.code === l.account_code);
      return !acc || !isLevel4Account(acc);
    });
    if (invalidEditLevel4Idx !== -1) {
      const badCode = editEntryLines[invalidEditLevel4Idx].account_code;
      toast({
        title: `⚠️ حساب غير تشغيلي في السطر #${invalidEditLevel4Idx + 1}`,
        description: `الحساب (${badCode}) ليس من الدرجة الرابعة. العمليات والقيود المحاسبية مسموحة حصراً على حسابات الدرجة الرابعة التشغيلية والفرعية.`,
        variant: "destructive",
      });
      return;
    }

    const zeroAmountIdx = editEntryLines.findIndex(
      (l) => (Number(l.debit) || 0) <= 0 && (Number(l.credit) || 0) <= 0,
    );
    if (zeroAmountIdx !== -1) {
      toast({
        title: `⚠️ مبلغ السطر #${zeroAmountIdx + 1} فارغ`,
        description: `يرجى إدخال مبلغ أكبر من صفر في المدين أو الدائن للسطر رقم (${zeroAmountIdx + 1}).`,
        variant: "destructive",
      });
      return;
    }

    if (!editEntryTotals.isBalanced && !allowUnbalanced) {
      toast({
        title: "⚠️ القيد غير متزن",
        description: `يوجد فارق (${editEntryTotals.difference.toFixed(2)} USD). يرجى تأكيد حفظ القيد وهو غير متزن من نافذة التأكيد.`,
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
      if (editEntryTotals.isBalanced) {
        toast({
          title: "✅ تم حفظ وتثبيت تعديلات القيد المتزن بنجاح",
          description: `تم تحديث القيد رقم (${editEntryRef}) وتحديث موازين الحسابات المعنية فوراً.`,
        });
      } else {
        toast({
          title: "⚠️ تم حفظ تعديلات القيد (غير متزن)",
          description: `تم حفظ القيد رقم (${editEntryRef}) مع وجود فرق اتزان (${editEntryTotals.difference.toFixed(2)} USD).`,
        });
      }
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

  const renderCards = (
    cards: Array<{
      id: string;
      title: string;
      icon: any;
      badge?: string;
      toneClass: string;
      active?: boolean;
      onClick: () => void;
    }>,
  ) => {
    if (viewMode === "list") {
      return (
        <div className="space-y-2.5 print:hidden">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                onClick={card.onClick}
                className={`group flex items-center justify-between gap-4 rounded-2xl border bg-card p-4 shadow-xs transition hover:border-primary/50 hover:shadow-md cursor-pointer ${
                  card.active
                    ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                    : "border-border/80"
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${card.toneClass}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-black text-foreground group-hover:text-primary transition-colors">
                        {card.title}
                      </h3>
                      {card.badge && (
                        <Badge variant="secondary" className="text-[11px] font-bold">
                          {card.badge}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <ArrowUpLeft className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 shrink-0" />
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 print:hidden">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              onClick={card.onClick}
              className={`group flex items-center justify-between gap-4 rounded-2xl border bg-card p-5 shadow-xs transition-all duration-200 hover:border-primary/50 hover:shadow-md cursor-pointer ${
                card.active
                  ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                  : "border-border/80"
              }`}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${card.toneClass}`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-black text-foreground group-hover:text-primary transition-colors">
                    {card.title}
                  </h3>
                  {card.badge && (
                    <Badge variant="secondary" className="mt-1 text-[11px] font-bold">
                      {card.badge}
                    </Badge>
                  )}
                </div>
              </div>
              <ArrowUpLeft className="h-5 w-5 text-muted-foreground opacity-60 transition-transform group-hover:opacity-100 group-hover:text-primary group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 shrink-0" />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4 font-['Tajawal']" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-xs print:hidden">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/12 text-primary border border-primary/25">
            <Landmark size={18} />
          </div>
          <h1 className="text-lg sm:text-xl font-black text-foreground">
            الإدارة المالية
          </h1>
          {hasUnsavedChanges && (
            <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-2 py-0.5 animate-pulse">
              {unsavedEntries.length} قيد بحاجة للحفظ
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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

          <ViewModeToggle mode={viewMode} onChange={setViewMode} />

          {/* Add Manual Entry Dialog — Unified Accounting Voucher (Opened via القيد المزدوج card) */}
          <Dialog
            open={isNewEntryOpen}
            onOpenChange={(open) => {
              if (open) {
                handleOpenNewEntry();
              } else {
                handleRequestCloseNewEntry();
              }
            }}
          >
            <DialogContent
              className="w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] lg:w-[calc(100vw-4rem)] max-w-6xl max-h-[92vh] overflow-y-auto overflow-x-hidden p-0 gap-0 border-2 border-primary/20 shadow-2xl rounded-2xl [&>button]:hidden"
              dir="rtl"
            >
              {/* Unified Accounting Voucher Sheet Container */}
              <div className="bg-card text-card-foreground flex flex-col min-w-0 w-full">
                {/* 1. Voucher Top Banner Header */}
                <DialogHeader className="text-right px-4 sm:px-6 py-3.5 sm:py-4 bg-muted/30 border-b border-border">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="p-1.5 sm:p-2 rounded-xl bg-primary/15 text-primary shrink-0">
                          <Scale className="h-4 w-4 sm:h-5 sm:w-5" />
                        </div>
                        <DialogTitle className="text-base sm:text-xl font-black tracking-tight text-foreground">
                          سند قيد يومية مزدوج موحد
                        </DialogTitle>
                        <Badge
                          variant="outline"
                          className="font-mono font-bold text-[11px] sm:text-xs bg-background border-primary/30 text-primary px-2 py-0.5"
                        >
                          مرجع السند: {newEntryRef || "تلقائي"}
                        </Badge>
                        <Badge
                          className={`text-[11px] sm:text-xs font-bold px-2 py-0.5 ${
                            newEntryTotals.isBalanced
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                              : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          {newEntryTotals.isBalanced
                            ? `متزن ✓ (${newEntryLines.length} أسطر)`
                            : newEntryTotals.debits === 0 && newEntryTotals.credits === 0
                              ? `قيد الإدخال (${newEntryLines.length} أسطر)`
                              : `غير متزن — فرق ${newEntryTotals.difference.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end lg:self-auto shrink-0">
                      {/* Saved Drafts Quick Bar */}
                      {journalDrafts.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap bg-amber-500/10 border border-amber-500/30 rounded-xl px-2.5 py-1.5 max-w-full">
                          <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 shrink-0">
                            مسودات ({journalDrafts.length}):
                          </span>
                          <div className="flex items-center gap-1 overflow-x-auto max-w-full">
                            {journalDrafts.slice(0, 3).map((draft) => (
                              <div
                                key={draft.id}
                                className="inline-flex items-center gap-1 bg-background border border-amber-500/30 rounded-lg px-2 py-0.5 text-[11px] shrink-0"
                              >
                                <button
                                  type="button"
                                  onClick={() => handleLoadJournalDraft(draft)}
                                  className="font-mono font-bold text-primary hover:underline truncate max-w-[90px]"
                                  title={draft.newEntryDesc}
                                >
                                  {draft.newEntryRef || "مسودة"}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteJournalDraft(draft.id, e)}
                                  className="text-rose-500 hover:text-rose-700 font-bold px-0.5"
                                  title="حذف المسودة"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleRequestCloseNewEntry}
                        className="h-8 px-3 rounded-xl font-bold text-xs gap-1.5 text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/40 shrink-0"
                        title="خروج"
                      >
                        <X className="h-4 w-4" />
                        <span>خروج</span>
                      </Button>
                    </div>
                  </div>
                </DialogHeader>

                {/* 2. Unified Voucher Body (Metadata + Single Accounting Table + Integrated Totals) */}
                <div className="p-3 sm:p-5 space-y-4 min-w-0">
                  {/* Unified Voucher Document Frame */}
                  <div className="rounded-2xl border-2 border-border bg-background shadow-sm overflow-hidden min-w-0">
                    {/* Voucher Metadata Strip (Part of the same document) */}
                    <div className="p-3 sm:p-4 bg-muted/30 border-b border-border">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-start">
                        {/* Journal Reference */}
                        <div className="sm:col-span-1 lg:col-span-2 space-y-1 min-w-0">
                          <Label className="font-bold text-xs flex items-center gap-1 text-foreground">
                            رقم القيد (الفترة/القيد)
                            <span className="text-rose-500">*</span>
                          </Label>
                          <Input
                            placeholder="01/02"
                            value={newEntryRef}
                            onChange={(e) => setNewEntryRef(e.target.value)}
                            className="h-9 font-mono font-bold text-primary bg-card text-xs w-full"
                          />
                        </div>

                        {/* Entry Date */}
                        <div className="sm:col-span-1 lg:col-span-2 space-y-1 min-w-0">
                          <Label className="font-bold text-xs flex items-center gap-1 text-foreground">
                            تاريخ القيد
                            <span className="text-rose-500">*</span>
                          </Label>
                          <Input
                            type="date"
                            value={newEntryDate}
                            onChange={(e) => handleEntryDateChange(e.target.value)}
                            className="h-9 font-mono bg-card text-xs w-full"
                          />
                        </div>

                        {/* General Voucher Description */}
                        <div className="sm:col-span-2 lg:col-span-5 space-y-1 min-w-0">
                          <Label className="font-bold text-xs flex items-center gap-1 text-foreground">
                            البيان والشرح العام للسند المحاسبي
                            <span className="text-rose-500">*</span>
                          </Label>
                          <Input
                            placeholder="مثال: إثبات إيراد مبيعات نقدية أو سداد مصروفات تشغيلية..."
                            value={newEntryDesc}
                            onChange={(e) => setNewEntryDesc(e.target.value)}
                            className="h-9 bg-card text-xs font-medium w-full"
                          />
                        </div>

                        {/* Optional Custom ID + Compact Attachment Button */}
                        <div className="sm:col-span-2 lg:col-span-3 space-y-1 min-w-0">
                          <Label className="text-xs font-semibold text-muted-foreground block truncate">
                            معرف السند / مرفق مستندي
                          </Label>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Input
                              placeholder="معرف (تلقائي)"
                              value={newEntryId}
                              onChange={(e) => setNewEntryId(e.target.value)}
                              className="h-9 font-mono text-xs bg-card flex-1 min-w-0"
                            />
                            <label className="inline-flex items-center justify-center gap-1 h-9 px-2.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-bold cursor-pointer shrink-0 transition-colors">
                              <Paperclip className="h-3.5 w-3.5 text-primary" />
                              <span>مرفق</span>
                              {newEntryAttachments.length > 0 && (
                                <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-[10px] font-mono">
                                  {newEntryAttachments.length}
                                </span>
                              )}
                              <input
                                type="file"
                                accept="image/*,.pdf"
                                className="hidden"
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
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* A. Mobile & Small Tablet Unified Lines List (< md) */}
                    <div className="block md:hidden divide-y divide-border">
                      {newEntryLines.map((line, index) => {
                        const lineSide: "debit" | "credit" =
                          line.side ||
                          (Number(line.credit) > 0
                            ? "credit"
                            : Number(line.debit) > 0
                              ? "debit"
                              : index === 1
                                ? "credit"
                                : "debit");
                        const isDebitRow = lineSide === "debit";
                        const lineAmount =
                          lineSide === "credit"
                            ? Number(line.credit) || 0
                            : Number(line.debit) || 0;
                        const lineBaseUsd = getLineBaseValue(
                          lineAmount,
                          Number(line.rate) || 1,
                          line.currency || "USD",
                        );

                        return (
                          <div
                            key={index}
                            className={`p-3 space-y-2.5 ${
                              isDebitRow ? "bg-emerald-500/[0.03]" : "bg-rose-500/[0.03]"
                            }`}
                          >
                            {/* Row 1: Line # + Side Select + Delete */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-muted font-mono font-bold text-xs text-muted-foreground">
                                  #{index + 1}
                                </span>
                                <Select
                                  value={lineSide}
                                  onValueChange={(val) => updateLine(index, "side", val)}
                                >
                                  <SelectTrigger
                                    className={`h-8 w-32 text-xs font-black px-2.5 rounded-lg border ${
                                      isDebitRow
                                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                        : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30"
                                    }`}
                                  >
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem
                                      value="debit"
                                      className="font-bold text-emerald-700 dark:text-emerald-300"
                                    >
                                      مدين (منه)
                                    </SelectItem>
                                    <SelectItem
                                      value="credit"
                                      className="font-bold text-rose-700 dark:text-rose-300"
                                    >
                                      دائن (له)
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-mono text-muted-foreground">
                                  المعادل:{" "}
                                  <strong className="text-foreground">
                                    {lineBaseUsd.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}{" "}
                                    USD
                                  </strong>
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeEntryLine(index)}
                                  disabled={newEntryLines.length <= 2}
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>

                            {/* Row 2: Account Selector */}
                            <div>
                              <AccountSearchSelect
                                value={line.account_code}
                                onChange={(code, acc) =>
                                  handleAccountSelectForLine(index, code, acc)
                                }
                                accounts={level4Accounts}
                                level4Only={true}
                                placeholder={`اختر حساب السطر #${index + 1}...`}
                              />
                            </div>

                            {/* Row 3: Amount + Currency + Rate */}
                            <div className="grid grid-cols-12 gap-2 items-start">
                              <div className="col-span-6 space-y-0.5">
                                <Label className="text-[10px] text-muted-foreground">المبلغ</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="any"
                                  placeholder="0.00"
                                  dir="ltr"
                                  className={`bg-card h-9 text-sm font-mono font-black text-left px-2.5 w-full ${
                                    isDebitRow
                                      ? "text-emerald-700 dark:text-emerald-400 border-emerald-500/40"
                                      : "text-rose-700 dark:text-rose-400 border-rose-500/40"
                                  }`}
                                  value={lineAmount || ""}
                                  onChange={(e) => updateLine(index, "amount", e.target.value)}
                                />
                              </div>

                              <div className="col-span-3 space-y-0.5">
                                <Label className="text-[10px] text-muted-foreground">العملة</Label>
                                <Select
                                  value={line.currency || "USD"}
                                  onValueChange={(val) => updateLine(index, "currency", val)}
                                >
                                  <SelectTrigger className="bg-card h-9 w-full text-xs font-mono font-bold px-1.5 justify-center">
                                    <SelectValue placeholder="USD" />
                                  </SelectTrigger>
                                  <SelectContent className="min-w-[70px]">
                                    <SelectItem value="USD" className="font-mono font-bold text-xs">
                                      USD
                                    </SelectItem>
                                    <SelectItem value="EGP" className="font-mono font-bold text-xs">
                                      EGP
                                    </SelectItem>
                                    <SelectItem value="SSP" className="font-mono font-bold text-xs">
                                      SSP
                                    </SelectItem>
                                    <SelectItem value="SAR" className="font-mono font-bold text-xs">
                                      SAR
                                    </SelectItem>
                                    <SelectItem value="EUR" className="font-mono font-bold text-xs">
                                      EUR
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="col-span-3 space-y-0.5">
                                <Label className="text-[10px] text-muted-foreground">المعامل</Label>
                                <Input
                                  type="number"
                                  min="0.0001"
                                  step="any"
                                  placeholder="1"
                                  disabled={(line.currency || "USD") === "USD"}
                                  className="bg-card h-9 text-xs font-mono text-center px-1 w-full"
                                  value={line.rate !== undefined ? line.rate : 1}
                                  onChange={(e) => updateLine(index, "rate", e.target.value)}
                                />
                              </div>
                            </div>

                            {/* Row 4: Line Note */}
                            <div>
                              <Input
                                placeholder={
                                  newEntryDesc
                                    ? `ملاحظة السطر (افتراضي: ${newEntryDesc.slice(0, 22)}...)`
                                    : `بيان / ملاحظة السطر #${index + 1} (اختياري)...`
                                }
                                value={line.description || ""}
                                onChange={(e) => updateLine(index, "description", e.target.value)}
                                className="bg-card h-8 text-xs px-2.5 w-full"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* B. Tablet & Desktop Unified Lines Table (md+) */}
                    <div className="hidden md:block overflow-x-auto w-full">
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr className="bg-muted/70 border-b border-border text-[11px] font-black text-muted-foreground select-none">
                            <th className="py-2.5 px-2 text-center w-9 border-l border-border/60">
                              #
                            </th>
                            <th className="py-2.5 px-2 w-28 border-l border-border/60 text-center">
                              الطرف (مدين/دائن)
                            </th>
                            <th className="py-2.5 px-2.5 min-w-[190px] border-l border-border/60">
                              الحساب المحاسبي (الدرجة الرابعة){" "}
                              <span className="text-rose-500">*</span>
                            </th>
                            <th className="py-2.5 px-2.5 min-w-[175px] w-48 border-l border-border/60 text-primary bg-primary/[0.03]">
                              المبلغ <span className="text-rose-500">*</span>
                            </th>
                            <th className="py-2.5 px-1.5 w-[72px] border-l border-border/60 text-center">
                              العملة
                            </th>
                            <th className="py-2.5 px-1.5 w-20 border-l border-border/60 text-center">
                              المعامل
                            </th>
                            <th className="py-2.5 px-2 w-28 border-l border-border/60 text-center">
                              المعادل (USD)
                            </th>
                            <th className="py-2.5 px-2 min-w-[130px] border-l border-border/60">
                              بيان السطر (اختياري)
                            </th>
                            <th className="py-2.5 px-1.5 w-10 text-center">حذف</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/70 text-xs">
                          {newEntryLines.map((line, index) => {
                            const lineSide: "debit" | "credit" =
                              line.side ||
                              (Number(line.credit) > 0
                                ? "credit"
                                : Number(line.debit) > 0
                                  ? "debit"
                                  : index === 1
                                    ? "credit"
                                    : "debit");
                            const isDebitRow = lineSide === "debit";
                            const lineAmount =
                              lineSide === "credit"
                                ? Number(line.credit) || 0
                                : Number(line.debit) || 0;
                            const lineBaseUsd = getLineBaseValue(
                              lineAmount,
                              Number(line.rate) || 1,
                              line.currency || "USD",
                            );

                            return (
                              <tr
                                key={index}
                                className={`transition-colors ${
                                  isDebitRow
                                    ? "bg-emerald-500/[0.03] hover:bg-emerald-500/[0.07]"
                                    : "bg-rose-500/[0.03] hover:bg-rose-500/[0.07]"
                                }`}
                              >
                                {/* Row Number */}
                                <td className="py-2 px-1.5 text-center font-mono font-bold text-muted-foreground border-l border-border/50 bg-muted/20">
                                  {index + 1}
                                </td>

                                {/* Side Dropdown (مدين / دائن) */}
                                <td className="py-2 px-1.5 border-l border-border/50 align-middle">
                                  <Select
                                    value={lineSide}
                                    onValueChange={(val) => updateLine(index, "side", val)}
                                  >
                                    <SelectTrigger
                                      className={`h-9 text-xs font-black px-2 rounded-lg border ${
                                        isDebitRow
                                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                          : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30"
                                      }`}
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem
                                        value="debit"
                                        className="font-bold text-emerald-700 dark:text-emerald-300"
                                      >
                                        مدين (منه)
                                      </SelectItem>
                                      <SelectItem
                                        value="credit"
                                        className="font-bold text-rose-700 dark:text-rose-300"
                                      >
                                        دائن (له)
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </td>

                                {/* Account Selector */}
                                <td className="py-2 px-2 border-l border-border/50 align-middle">
                                  <AccountSearchSelect
                                    value={line.account_code}
                                    onChange={(code, acc) =>
                                      handleAccountSelectForLine(index, code, acc)
                                    }
                                    accounts={level4Accounts}
                                    level4Only={true}
                                    placeholder={`اختر حساب السطر #${index + 1}...`}
                                  />
                                </td>

                                {/* Wide Single Amount Input (Supports Millions) */}
                                <td className="py-2 px-2 border-l border-border/50 align-middle">
                                  <div className="space-y-0.5">
                                    <Input
                                      type="number"
                                      min="0"
                                      step="any"
                                      placeholder="0.00"
                                      dir="ltr"
                                      className={`bg-card h-9 text-sm font-mono font-black tracking-wide text-left px-2.5 w-full min-w-[160px] ${
                                        isDebitRow
                                          ? "text-emerald-700 dark:text-emerald-400 border-emerald-500/40 focus-visible:ring-emerald-500"
                                          : "text-rose-700 dark:text-rose-400 border-rose-500/40 focus-visible:ring-rose-500"
                                      }`}
                                      value={lineAmount || ""}
                                      onChange={(e) => updateLine(index, "amount", e.target.value)}
                                    />
                                    {lineAmount >= 1000 && (
                                      <div
                                        dir="ltr"
                                        className="text-[10px] font-mono text-muted-foreground text-left px-1 truncate"
                                      >
                                        {lineAmount.toLocaleString("en-US", {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}{" "}
                                        {line.currency || "USD"}
                                      </div>
                                    )}
                                  </div>
                                </td>

                                {/* Compact Currency Symbol/Code Only */}
                                <td className="py-2 px-1.5 border-l border-border/50 align-middle">
                                  <Select
                                    value={line.currency || "USD"}
                                    onValueChange={(val) => updateLine(index, "currency", val)}
                                  >
                                    <SelectTrigger className="bg-card h-9 w-[66px] text-xs font-mono font-bold px-1.5 justify-center">
                                      <SelectValue placeholder="USD" />
                                    </SelectTrigger>
                                    <SelectContent className="min-w-[70px]">
                                      <SelectItem
                                        value="USD"
                                        className="font-mono font-bold text-xs"
                                      >
                                        USD
                                      </SelectItem>
                                      <SelectItem
                                        value="EGP"
                                        className="font-mono font-bold text-xs"
                                      >
                                        EGP
                                      </SelectItem>
                                      <SelectItem
                                        value="SSP"
                                        className="font-mono font-bold text-xs"
                                      >
                                        SSP
                                      </SelectItem>
                                      <SelectItem
                                        value="SAR"
                                        className="font-mono font-bold text-xs"
                                      >
                                        SAR
                                      </SelectItem>
                                      <SelectItem
                                        value="EUR"
                                        className="font-mono font-bold text-xs"
                                      >
                                        EUR
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </td>

                                {/* Rate */}
                                <td className="py-2 px-1.5 border-l border-border/50 align-middle">
                                  <Input
                                    type="number"
                                    min="0.0001"
                                    step="any"
                                    placeholder="1"
                                    disabled={(line.currency || "USD") === "USD"}
                                    className="bg-card h-9 text-xs font-mono text-center px-1"
                                    value={line.rate !== undefined ? line.rate : 1}
                                    onChange={(e) => updateLine(index, "rate", e.target.value)}
                                  />
                                </td>

                                {/* Equivalent in Base USD */}
                                <td className="py-2 px-2 border-l border-border/50 align-middle text-center font-mono">
                                  {lineBaseUsd > 0 ? (
                                    <span
                                      className={`font-bold text-[11px] px-1.5 py-0.5 rounded inline-block ${
                                        isDebitRow
                                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                          : "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                                      }`}
                                    >
                                      {lineBaseUsd.toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground/50">0.00</span>
                                  )}
                                </td>

                                {/* Line Note / Description */}
                                <td className="py-2 px-2 border-l border-border/50 align-middle">
                                  <Input
                                    placeholder={
                                      newEntryDesc
                                        ? `افتراضي: ${newEntryDesc.slice(0, 18)}...`
                                        : `ملاحظة السطر #${index + 1}...`
                                    }
                                    value={line.description || ""}
                                    onChange={(e) =>
                                      updateLine(index, "description", e.target.value)
                                    }
                                    className="bg-card h-9 text-xs px-2"
                                  />
                                </td>

                                {/* Delete Row */}
                                <td className="py-2 px-1 text-center align-middle">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeEntryLine(index)}
                                    disabled={newEntryLines.length <= 2}
                                    title={
                                      newEntryLines.length <= 2
                                        ? "يجب أن يحتوي القيد على سطرين على الأقل"
                                        : "حذف هذا السطر من القيد"
                                    }
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Attached Voucher Action Strip (Always fits 100% container width on Mobile/Tablet/Desktop) */}
                    <div className="bg-muted/25 border-t border-border px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addEntryLine}
                          className="gap-1.5 rounded-xl border-primary/40 text-primary hover:bg-primary/10 font-bold text-xs h-8"
                        >
                          <PlusCircle className="h-3.5 w-3.5" />
                          إضافة سطر جديد في نفس القيد
                        </Button>

                        {!newEntryTotals.isBalanced && newEntryTotals.difference > 0 && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={handleAutoBalanceNewEntry}
                            className="gap-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/30 font-bold text-xs h-8"
                          >
                            <Scale className="h-3.5 w-3.5" />
                            موازنة الفرق تلقائياً (
                            {newEntryTotals.difference.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            USD)
                          </Button>
                        )}
                      </div>

                      <span className="text-[11px] text-muted-foreground">
                        إجمالي عدد أسطر هذا السند:{" "}
                        <strong className="text-foreground font-mono">
                          {newEntryLines.length}
                        </strong>{" "}
                        أسطر مترابطة
                      </span>
                    </div>

                    {/* Integrated Totals & Balance Status Strip (Responsive Grid across Mobile, Tablet, Desktop) */}
                    <div
                      className={`border-t-2 border-border px-3 sm:px-4 py-3 text-xs ${
                        newEntryTotals.isBalanced ? "bg-emerald-500/[0.06]" : "bg-amber-500/[0.08]"
                      }`}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
                        <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-foreground">إجمالي سند القيد (USD):</span>
                          <Badge
                            className={`text-[11px] font-bold ${
                              newEntryTotals.isBalanced
                                ? "bg-emerald-600 text-white"
                                : "bg-rose-600 text-white"
                            }`}
                          >
                            {newEntryTotals.isBalanced ? "القيد متزن ✓" : "القيد غير متزن ⚠️"}
                          </Badge>
                        </div>

                        <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-around gap-3 bg-background/60 rounded-xl px-3 py-2 border border-border/60 font-mono">
                          <div>
                            <span className="font-sans text-[11px] text-muted-foreground block">
                              إجمالي المدين (USD):
                            </span>
                            <span className="font-black text-sm text-emerald-700 dark:text-emerald-400">
                              {newEntryTotals.debits.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{" "}
                              <span className="text-[10px] font-sans">USD</span>
                            </span>
                          </div>
                          <div className="h-7 w-px bg-border" />
                          <div>
                            <span className="font-sans text-[11px] text-muted-foreground block">
                              إجمالي الدائن (USD):
                            </span>
                            <span className="font-black text-sm text-rose-700 dark:text-rose-400">
                              {newEntryTotals.credits.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{" "}
                              <span className="text-[10px] font-sans">USD</span>
                            </span>
                          </div>
                        </div>

                        <div className="sm:col-span-2 lg:col-span-4">
                          {newEntryTotals.isBalanced ? (
                            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                              <CheckCircle2 className="h-4 w-4 shrink-0" />
                              <span>الجانبان المدين والدائن متساويان تماماً (0.00 USD)</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-bold text-xs flex-wrap">
                              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                              <span>
                                فرق التوازن:{" "}
                                <strong className="font-mono text-rose-600 dark:text-rose-400">
                                  {newEntryTotals.difference.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}{" "}
                                  USD
                                </strong>{" "}
                                (
                                {newEntryTotals.debits > newEntryTotals.credits
                                  ? "المدين أكبر"
                                  : "الدائن أكبر"}
                                )
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Unified Voucher Footer Actions */}
                <DialogFooter className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 px-4 sm:px-6 py-3.5 sm:py-4 bg-muted/30 border-t border-border">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSaveJournalAsDraft}
                      className="flex-1 sm:flex-initial gap-1.5 border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-xl font-bold text-xs"
                    >
                      <Save size={15} />
                      <span>حفظ كمسودة</span>
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <Button
                      type="button"
                      onClick={handlePostEntry}
                      className={`w-full sm:w-auto rounded-xl font-black text-xs sm:text-sm px-5 py-2.5 text-white shadow-md gap-2 ${
                        newEntryTotals.isBalanced
                          ? "bg-primary hover:bg-primary/90"
                          : "bg-amber-600 hover:bg-amber-700"
                      }`}
                    >
                      {newEntryTotals.isBalanced ? (
                        <>
                          <CheckCircle2 size={16} />
                          <span>مراجعة وتأكيد حفظ القيد المتزن</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={16} />
                          <span>مراجعة وحفظ القيد (غير متزن)</span>
                        </>
                      )}
                    </Button>
                  </div>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>

          {/* Exit Confirmation Dialog for Journal Entry (Clean, Concise, Responsive — No Button Explanations) */}
          <AlertDialog open={isExitEntryConfirmOpen} onOpenChange={setIsExitEntryConfirmOpen}>
            <AlertDialogContent
              className="w-[calc(100vw-1.5rem)] sm:w-full max-w-md text-right rounded-2xl border-2 border-amber-500/30 p-5 sm:p-6"
              dir="rtl"
            >
              <AlertDialogHeader className="text-right space-y-2">
                <AlertDialogTitle className="text-base sm:text-lg font-black flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                  <span>تنبيه قبل الخروج من نافذة القيد</span>
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed text-right">
                  أنت على وشك إغلاق سند القيد اليومي ({newEntryRef || "جديد"}). ماذا تريد أن تفعل؟
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full pt-3">
                <Button
                  type="button"
                  onClick={handleSaveJournalAsDraft}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs h-10 gap-1.5"
                >
                  <Save className="h-3.5 w-3.5 shrink-0" />
                  <span>حفظ كمسودة</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDiscardNewEntry}
                  className="w-full text-rose-600 border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl font-bold text-xs h-10 gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5 shrink-0" />
                  <span>تجاهل القيد</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsExitEntryConfirmOpen(false)}
                  className="w-full rounded-xl font-bold text-xs h-10"
                >
                  إلغاء الأمر
                </Button>
              </div>
            </AlertDialogContent>
          </AlertDialog>

          {/* Save & Post Confirmation Alert Dialog (Supports Balanced & Unbalanced with Explicit Warning) */}
          <AlertDialog open={isConfirmPostOpen} onOpenChange={setIsConfirmPostOpen}>
            <AlertDialogContent
              className={`w-[calc(100vw-1.5rem)] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto text-right rounded-2xl border-2 p-5 sm:p-6 ${
                newEntryTotals.isBalanced ? "border-emerald-500/30" : "border-amber-500/50"
              }`}
              dir="rtl"
            >
              <AlertDialogHeader className="text-right space-y-2">
                <AlertDialogTitle
                  className={`text-base sm:text-lg font-black flex items-center gap-2 ${
                    newEntryTotals.isBalanced
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {newEntryTotals.isBalanced ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                      <span>تأكيد حفظ وترحيل سند القيد اليومي المتزن</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                      <span>تنبيه: القيد المحاسبي غير متزن — هل ترغب في حفظه؟</span>
                    </>
                  )}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed text-right">
                  {newEntryTotals.isBalanced
                    ? "تم التحقق من توازن طرفي القيد (المدين والدائن). عند التأكيد سيتم إدراج القيد في دفتر اليومية وتحديث أرصدة الحسابات."
                    : "إجمالي الجانب المدين لا يساوي إجمالي الجانب الدائن في هذا القيد. يمكنك حفظ القيد على وضعه الحالي (غير متزن) أو موازنته تلقائياً."}
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="space-y-3.5 my-2 text-sm min-w-0">
                {/* Unbalanced Warning Banner inside Confirmation */}
                {!newEntryTotals.isBalanced && (
                  <div className="p-3 sm:p-3.5 rounded-xl bg-amber-500/10 border-2 border-amber-500/40 text-amber-900 dark:text-amber-200 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-black text-xs flex items-center gap-1.5">
                        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                        تفاصيل عدم اتزان القيد الحالي:
                      </span>
                      <Badge className="bg-rose-600 text-white font-mono text-xs">
                        الفرق:{" "}
                        {newEntryTotals.difference.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        USD
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono bg-background/80 p-2.5 rounded-lg border border-amber-500/20">
                      <div>
                        <span className="text-muted-foreground font-sans block text-[11px]">
                          إجمالي المدين:
                        </span>
                        <strong className="text-emerald-600 dark:text-emerald-400">
                          {newEntryTotals.debits.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          USD
                        </strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground font-sans block text-[11px]">
                          إجمالي الدائن:
                        </span>
                        <strong className="text-rose-600 dark:text-rose-400">
                          {newEntryTotals.credits.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          USD
                        </strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground font-sans block text-[11px]">
                          الطرف الأعلى:
                        </span>
                        <strong className="font-sans text-amber-700 dark:text-amber-300">
                          {newEntryTotals.debits > newEntryTotals.credits
                            ? "الجانب المدين"
                            : "الجانب الدائن"}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* Entry Metadata Box */}
                <div className="p-3 sm:p-3.5 rounded-xl bg-muted/60 border space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
                    <div>
                      <span className="text-xs text-muted-foreground">رقم السند: </span>
                      <strong className="font-mono font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-300 dark:border-indigo-700 px-2 py-0.5 rounded-md inline-block">
                        {newEntryId || "تلقائي"} {newEntryRef ? `(${newEntryRef})` : ""}
                      </strong>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">التاريخ: </span>
                      <strong className="font-mono text-foreground">{newEntryDate}</strong>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">عدد الأسطر: </span>
                      <strong className="font-mono text-foreground">
                        {newEntryLines.filter((l) => l.account_code).length} أسطر
                      </strong>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">البيان العام: </span>
                    <span className="font-bold text-foreground">{newEntryDesc}</span>
                  </div>
                </div>

                {/* Affected Accounts Breakdown */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">
                    ملخص أسطر سند القيد ({newEntryLines.filter((l) => l.account_code).length}):
                  </Label>
                  <div className="border rounded-xl divide-y max-h-48 overflow-y-auto bg-card">
                    {newEntryLines
                      .filter((l) => l.account_code)
                      .map((line, idx) => {
                        const acc = (accounts || []).find((a) => a.code === line.account_code);
                        const isDebit = (line.debit || 0) > 0;
                        const origAmt = isDebit ? line.debit : line.credit;
                        const baseVal = getLineBaseValue(
                          origAmt || 0,
                          line.rate || 1,
                          line.currency || "USD",
                        );
                        return (
                          <div
                            key={idx}
                            className="p-2.5 flex items-center justify-between gap-2 text-xs flex-wrap"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-muted-foreground font-bold">
                                #{idx + 1}
                              </span>
                              <Badge
                                variant="outline"
                                className={`font-mono text-[11px] shrink-0 ${
                                  isDebit
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                                    : "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950 dark:text-rose-300"
                                }`}
                              >
                                {isDebit ? "مدين" : "دائن"}
                              </Badge>
                              <div className="truncate">
                                <span className="font-semibold text-foreground">
                                  {acc ? acc.name_ar || acc.name : line.account_code}
                                </span>
                                <span className="text-muted-foreground font-mono mr-1">
                                  ({line.account_code})
                                </span>
                              </div>
                            </div>
                            <div className="text-left font-mono shrink-0">
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

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-3">
                <Button
                  type="button"
                  onClick={() => handleExecutePost(!newEntryTotals.isBalanced)}
                  className={`rounded-xl font-black text-xs text-white h-10 px-4 ${
                    newEntryTotals.isBalanced
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-amber-600 hover:bg-amber-700"
                  }`}
                >
                  {newEntryTotals.isBalanced
                    ? "✓ تأكيد وحفظ القيد النهائي"
                    : "⚠️ تأكيد حفظ القيد (غير متزن)"}
                </Button>

                {!newEntryTotals.isBalanced && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsConfirmPostOpen(false);
                        handleAutoBalanceNewEntry();
                      }}
                      className="rounded-xl font-bold text-xs border-primary/40 text-primary hover:bg-primary/10 h-10"
                    >
                      ⚖️ موازنة الفرق تلقائياً
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSaveJournalAsDraft}
                      className="rounded-xl font-bold text-xs border-amber-500/40 text-amber-700 dark:text-amber-300 h-10"
                    >
                      💾 حفظ كمسودة
                    </Button>
                  </>
                )}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsConfirmPostOpen(false)}
                  className="rounded-xl font-bold text-xs h-10"
                >
                  رجوع للتعديل
                </Button>
              </div>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SECTION 1: DEFINITIONS (التعريفات) — الحسابات والخزائن                 */}
      {/* ===================================================================== */}
      {selectedTab === "definitions" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {activeDefTool === null &&
            renderCards([
              {
                id: "def-accounts",
                title: "دليل وشجرة الحسابات",
                icon: Layers,
                badge: `${accounts.length} حساب`,
                toneClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
                active: false,
                onClick: () => {
                  setActiveDefTool("accounts");
                  navigateToLedgerSubpage("accounts");
                },
              },
              {
                id: "def-treasury",
                title: "إدارة الخزائن النقدية والبنكية",
                icon: Wallet,
                badge: `${treasuries.length} خزينة`,
                toneClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                active: false,
                onClick: () => {
                  setActiveDefTool("treasury");
                  navigateToLedgerSubpage("treasury");
                },
              },
            ])}

          {activeDefTool === "accounts" && (
            <div className="bg-card rounded-2xl border border-border p-3 sm:p-4">
              <AccountsPage />
            </div>
          )}
          {activeDefTool === "treasury" && (
            <div className="bg-card rounded-2xl border border-border p-3 sm:p-4">
              <TreasuryManagementView />
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 2: OPERATIONS (العمليات) — 4 مربعات: سند جديد / تحويل / قيد مزدوج / دفتر الأستاذ */}
      {/* ===================================================================== */}
      {selectedTab === "operations" && (
        <div className="space-y-4 animate-in fade-in duration-200 min-w-0 w-full">
          {activeOperationTool === null && (
            <>
              {renderCards([
                {
                  id: "op-new-voucher",
                  title: "إصدار سند جديد",
                  icon: Receipt,
                  toneClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                  active: false,
                  onClick: () => {
                    setActiveOperationTool("vouchers");
                    navigateToLedgerSubpage("vouchers");
                  },
                },
                {
                  id: "op-treasury-transfer",
                  title: "عملية تحويل بين الخزائن",
                  icon: ArrowUpDown,
                  toneClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                  active: false,
                  onClick: () => {
                    setActiveOperationTool("transfers");
                    navigateToLedgerSubpage("transfers");
                  },
                },
                {
                  id: "op-double-entry",
                  title: "القيد المزدوج",
                  icon: Scale,
                  badge: `${journalEntries.length} قيد`,
                  toneClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
                  active: false,
                  onClick: () => {
                    setActiveOperationTool("journal");
                    navigateToLedgerSubpage("journal");
                    handleOpenNewEntry();
                  },
                },
                {
                  id: "op-general-ledger",
                  title: "دفتر الأستاذ العام",
                  icon: BookOpen,
                  badge: `${accounts.length} حساب`,
                  toneClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
                  active: false,
                  onClick: () => {
                    setActiveOperationTool("general_ledger");
                    navigateToLedgerSubpage("general_ledger");
                  },
                },
              ])}

              {journalDrafts.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap rounded-2xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 print:hidden">
                  <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                    مسودات قيود محفوظة ({journalDrafts.length}):
                  </span>
                  {journalDrafts.slice(0, 3).map((draft) => (
                    <Button
                      key={draft.id}
                      size="sm"
                      variant="outline"
                      onClick={() => handleLoadJournalDraft(draft)}
                      className="h-7 text-[11px] font-bold border-amber-500/40 text-amber-800 dark:text-amber-300 rounded-lg px-2"
                    >
                      {draft.newEntryDesc || draft.newEntryRef}
                    </Button>
                  ))}
                </div>
              )}
            </>
          )}

          {activeOperationTool === "vouchers" && (
            <VouchersLedgerSection
              mode="operations"
              autoOpenNewModal={true}
              onModalClosed={() => {
                setAutoOpenVoucherModal(false);
                setActiveOperationTool(null);
                navigateToLedgerSubpage("operations");
              }}
              onOpenReports={() => {
                setSelectedTab("reports");
                setActiveReportTool("vouchers_register");
                navigateToLedgerSubpage("vouchers_register");
              }}
              onNavigateToJournal={(ref) => {
                if (ref) setJournalSearch(ref);
                setActiveOperationTool("journal");
                navigateToLedgerSubpage("journal");
              }}
            />
          )}

          {activeOperationTool === "transfers" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <Card className="lg:col-span-5 rounded-2xl border border-border shadow-sm">
                <CardHeader className="pb-3 border-b border-border/60">
                  <CardTitle className="text-base font-black flex items-center gap-2">
                    <ArrowUpDown className="h-4 w-4 text-primary" />
                    <span>تحويل نقدي بين الخزائن والحسابات البنكية</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <form onSubmit={handleExecuteTreasuryTransfer} className="space-y-4">
                    <div>
                      <Label className="text-xs font-bold">من الخزينة / الحساب البنكي (المصدر) *</Label>
                      <select
                        className="w-full mt-1.5 h-10 rounded-xl border border-input bg-background px-3 text-xs font-bold text-right"
                        value={transferSourceId}
                        onChange={(e) => setTransferSourceId(e.target.value)}
                        required
                      >
                        <option value="">-- اختر الخزينة المحول منها --</option>
                        {erpState.treasuries
                          .filter((t) => !t.deleted && t.is_open)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name_ar} (الرصيد: {t.balance.toLocaleString()} {t.currency}) [حساب:{" "}
                              {t.account_code || "130101"}]
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <Label className="text-xs font-bold">إلى الخزينة / الحساب البنكي (المستلم) *</Label>
                      <select
                        className="w-full mt-1.5 h-10 rounded-xl border border-input bg-background px-3 text-xs font-bold text-right"
                        value={transferTargetId}
                        onChange={(e) => setTransferTargetId(e.target.value)}
                        required
                      >
                        <option value="">-- اختر الخزينة المستلمة --</option>
                        {erpState.treasuries
                          .filter((t) => !t.deleted && t.id !== transferSourceId)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name_ar} (الرصيد: {t.balance.toLocaleString()} {t.currency}) [حساب:{" "}
                              {t.account_code || "130101"}]
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <Label className="text-xs font-bold">المبلغ المحول *</Label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          className="mt-1.5 h-10 rounded-xl font-mono font-black text-sm"
                          value={transferAmount}
                          onChange={(e) => setTransferAmount(e.target.value)}
                          placeholder="0.00"
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-bold">العملة *</Label>
                        <select
                          className="w-full mt-1.5 h-10 rounded-xl border border-input bg-background px-2 text-xs font-black text-right"
                          value={transferCurrency}
                          onChange={(e) =>
                            setTransferCurrency(e.target.value as "EGP" | "USD" | "SSP")
                          }
                        >
                          <option value="EGP">EGP</option>
                          <option value="USD">USD</option>
                          <option value="SSP">SSP</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs font-bold">البيان / سبب التحويل</Label>
                      <Input
                        className="mt-1.5 h-10 rounded-xl text-xs font-bold"
                        value={transferNote}
                        onChange={(e) => setTransferNote(e.target.value)}
                        placeholder="مثال: تغذية خزينة المصروفات اليومية أو توريد للبنك..."
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-10 rounded-xl font-black text-xs gap-2 shadow-sm"
                    >
                      <ArrowUpDown className="h-4 w-4" />
                      <span>اعتماد التحويل وترحيل القيد المحاسبي</span>
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="lg:col-span-7 rounded-2xl border border-border shadow-sm overflow-hidden">
                <CardHeader className="pb-3 border-b border-border/60 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-black">
                      سجل عمليات التحويل والمناقلات بين الخزائن
                    </CardTitle>
                    <CardDescription className="text-xs font-semibold">
                      أحدث التحويلات النقدية الداخلية المرحلة في دفتر اليومية
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedTab("reports");
                      setActiveReportTool("treasury_report");
                    }}
                    className="h-8 rounded-xl text-xs font-bold gap-1.5"
                  >
                    <Vault className="h-3.5 w-3.5" />
                    <span>تقرير الخزائن الشامل</span>
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto max-h-[420px]">
                    <table className="w-full text-xs text-right">
                      <thead className="bg-muted/60 text-muted-foreground font-bold border-b border-border">
                        <tr>
                          <th className="p-3">التاريخ</th>
                          <th className="p-3">الخزينة</th>
                          <th className="p-3">النوع</th>
                          <th className="p-3">المبلغ</th>
                          <th className="p-3">البيان</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {(erpState.treasuryTransactions || [])
                          .filter(
                            (tx) =>
                              tx.type === "transfer_in" ||
                              tx.type === "transfer_out" ||
                              (tx.note && tx.note.includes("تحويل")),
                          )
                          .slice(0, 25)
                          .map((tx) => {
                            const tr = erpState.treasuries.find((t) => t.id === tx.treasury_id);
                            const isOut = tx.type === "transfer_out" || tx.type === "withdrawal";
                            return (
                              <tr key={tx.id} className="hover:bg-muted/30">
                                <td className="p-3 font-mono text-[11px] text-muted-foreground">
                                  {new Date(tx.created_at).toLocaleString("ar-EG")}
                                </td>
                                <td className="p-3 font-bold">{tr?.name_ar || tx.treasury_id}</td>
                                <td className="p-3">
                                  <Badge
                                    variant="outline"
                                    className={
                                      isOut
                                        ? "border-rose-500/30 bg-rose-500/10 text-rose-600 font-bold text-[10px]"
                                        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 font-bold text-[10px]"
                                    }
                                  >
                                    {isOut ? "تحويل صادر (-)" : "تحويل وارد (+)"}
                                  </Badge>
                                </td>
                                <td className="p-3 font-mono font-black">
                                  {Number(tx.amount).toLocaleString()} {tx.currency || tr?.currency || "EGP"}
                                </td>
                                <td className="p-3 text-muted-foreground">{tx.note}</td>
                              </tr>
                            );
                          })}
                        {(erpState.treasuryTransactions || []).filter(
                          (tx) =>
                            tx.type === "transfer_in" ||
                            tx.type === "transfer_out" ||
                            (tx.note && tx.note.includes("تحويل")),
                        ).length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-muted-foreground font-semibold">
                              لا توجد عمليات تحويل بين الخزائن مسجلة بعد.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeOperationTool === "journal" && (
            <Card className="rounded-2xl w-full min-w-0 overflow-hidden">
              <CardHeader className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 w-full min-w-0">
                <div>
                  <CardTitle className="text-base font-bold">
                    دفتر اليومية العامة والقيود المزدوجة
                  </CardTitle>
                </div>
                <div className="flex flex-wrap items-center gap-2 max-w-full">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      printLedgerDocument(
                        buildLedgerPrintRows(
                          erpState?.journalEntries || [],
                          erpState?.accounts || [],
                        ),
                        false,
                      )
                    }
                    className="gap-1.5 rounded-xl text-xs font-bold"
                    title="طباعة القيود"
                  >
                    <Printer className="h-4 w-4" />
                    طباعة القيود
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      printLedgerDocument(
                        buildLedgerPrintRows(
                          erpState?.journalEntries || [],
                          erpState?.accounts || [],
                        ),
                        true,
                      )
                    }
                    className="gap-1.5 rounded-xl text-xs font-bold"
                    title="طباعة مستند محاسبي"
                  >
                    <FileText className="h-4 w-4" />
                    مستند محاسبي
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportJournal}
                    className="gap-1.5 rounded-xl text-xs font-bold"
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
                      className="gap-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white pointer-events-none text-xs font-bold"
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
          )}

          {/* 4. General Ledger Account Statement (دفتر الأستاذ العام — داخل العمليات) */}
          {activeOperationTool === "general_ledger" && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <Card className="lg:col-span-1 rounded-2xl">
                <CardHeader className="pb-4">
                  <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                    اختيار الحساب المحاسبي
                  </CardTitle>
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
                        <span className="text-xs text-muted-foreground block">
                          الرصيد الافتتاحي:
                        </span>
                        <span className="text-sm font-bold font-mono text-foreground">
                          {formatCurrency(
                            currentAccount.initial_balance || 0,
                            ledgerSummary.currency,
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="lg:col-span-3 space-y-6">
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

                <Card className="rounded-2xl">
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <div>
                      <CardTitle className="text-base font-bold">
                        الحركات القييدية المفصلة (دفتر حساب الأستاذ)
                      </CardTitle>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!currentAccount) return;
                          printAccountingDocument({
                            title: `كشف حساب الأستاذ العام — ${currentAccount.name_ar || currentAccount.name}`,
                            subtitle: `كود الحساب: ${currentAccount.code} | التصنيف: ${ACCOUNT_TYPE_LABELS[currentAccount.type]}`,
                            metaItems: [
                              { label: "كود الحساب", value: currentAccount.code },
                              {
                                label: "اسم الحساب",
                                value: currentAccount.name_ar || currentAccount.name,
                              },
                              {
                                label: "الرصيد الافتتاحي",
                                value: formatCurrency(
                                  currentAccount.initial_balance || 0,
                                  ledgerSummary.currency,
                                ),
                              },
                              { label: "عدد الحركات", value: `${ledgerLines.length} حركة` },
                            ],
                            columns: [
                              { key: "date", label: "التاريخ" },
                              { key: "reference", label: "المرجع" },
                              { key: "description", label: "شرح وتفاصيل الحركة" },
                              { key: "debit", label: "مدين (Debit)" },
                              { key: "credit", label: "دائن (Credit)" },
                              { key: "runningBalance", label: "الرصيد التراكمي" },
                            ],
                            rows: ledgerLines.map((line) => ({
                              date: line.date,
                              reference: line.reference,
                              description: line.description,
                              debit:
                                line.debit > 0 ? formatCurrency(line.debit, line.currency) : "-",
                              credit:
                                line.credit > 0 ? formatCurrency(line.credit, line.currency) : "-",
                              runningBalance: formatCurrency(line.runningBalance, line.currency),
                            })),
                            totals: [
                              {
                                label: "إجمالي المدين",
                                value: formatCurrency(
                                  ledgerSummary.totalDebit,
                                  ledgerSummary.currency,
                                ),
                              },
                              {
                                label: "إجمالي الدائن",
                                value: formatCurrency(
                                  ledgerSummary.totalCredit,
                                  ledgerSummary.currency,
                                ),
                              },
                              {
                                label: "صافي الرصيد النهائي",
                                value: formatCurrency(
                                  ledgerSummary.netBalance,
                                  ledgerSummary.currency,
                                ),
                              },
                            ],
                          });
                        }}
                        className="gap-1.5 rounded-xl bg-primary text-primary-foreground font-bold"
                      >
                        <Printer className="h-4 w-4" />
                        طباعة كشف الحساب
                      </Button>
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
                                لا توجد حركات مسجلة لهذا الحساب.
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
                                  {line.credit > 0
                                    ? formatCurrency(line.credit, line.currency)
                                    : "-"}
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
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 3: REPORTS (التقارير) — السندات، منظومة التقارير، الخزائن         */}
      {/* ===================================================================== */}
      {selectedTab === "reports" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {activeReportTool === null &&
            renderCards([
              {
                id: "rep-vouchers",
                title: "تفقد وسجل سندات الدفع والقبض",
                icon: Receipt,
                toneClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
                active: false,
                onClick: () => {
                  setActiveReportTool("vouchers_register");
                  navigateToLedgerSubpage("vouchers_register");
                },
              },
              {
                id: "rep-unified",
                title: "المركز المالي والقوائم وميزان المراجعة",
                icon: BarChart3,
                toneClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                active: false,
                onClick: () => {
                  setActiveReportTool("unified_reports");
                  navigateToLedgerSubpage("unified_reports");
                },
              },
              {
                id: "rep-treasury",
                title: "تقرير وحركة الخزائن",
                icon: Wallet,
                toneClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                active: false,
                onClick: () => {
                  setActiveReportTool("treasury_report");
                  navigateToLedgerSubpage("treasury_report");
                  setIsTreasuryReportModalOpen(true);
                },
              },
            ])}

          {/* 1. Vouchers Inspection & Register (تفقد وسجل سندات الدفع والقبض) */}
          {activeReportTool === "vouchers_register" && (
            <VouchersLedgerSection
              mode="reports"
              onNavigateToJournal={(ref) => {
                if (ref) setJournalSearch(ref);
                setSelectedTab("operations");
                setActiveOperationTool("journal");
                navigateToLedgerSubpage("journal");
              }}
            />
          )}

          {/* 2. Unified Financial Reports & Financial Position (دمج المركز المالي الشامل ومنظومة التقارير) */}
          {activeReportTool === "unified_reports" && (
            <div className="space-y-6">
              <ComprehensiveFinancialPositionCard />
              <AdvancedFinancialReportsSuite initialSection="account_status" />
            </div>
          )}

          {/* 3. Treasury Report Launcher & Modal (تقرير وحركة الخزائن) */}
          {activeReportTool === "treasury_report" && (
            <Card className="rounded-2xl border-border">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-black">
                      تقرير وحركة الخزائن النقدية والبنكية
                    </CardTitle>
                  </div>
                </div>
                <Button
                  onClick={() => setIsTreasuryReportModalOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl gap-2"
                >
                  <FileText className="h-4 w-4" />
                  فتح نافذة تقرير الخزائن المفصل
                </Button>
              </CardHeader>
            </Card>
          )}

          <TreasuryReportModal
            isOpen={isTreasuryReportModalOpen}
            onClose={() => setIsTreasuryReportModalOpen(false)}
          />
        </div>
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
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAttachmentOpen(false)}
              className="rounded-xl font-bold text-xs"
            >
              إغلاق
            </Button>
          </DialogFooter>
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
              لصق ومعالجة بيانات القيود نصياً
            </DialogTitle>
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

      {/* Unsaved Exit Dialog */}
      <AlertDialog open={isUnsavedExitDialogOpen} onOpenChange={setIsUnsavedExitDialogOpen}>
        <AlertDialogContent className="rounded-2xl max-w-md text-right" dir="rtl">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle className="text-right flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              تنبيه: قيود محاسبية غير محفوظة
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right text-xs text-muted-foreground pt-1.5 leading-relaxed">
              يوجد لديك قيود محاسبية مسجلة لم يتم تثبيتها في قاعدة البيانات بعد ({unsavedEntries.length} قيد). ماذا تريد أن تفعل قبل المغادرة؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 pt-3">
            <Button
              type="button"
              variant="default"
              onClick={handleSaveAndExit}
              disabled={isSavingToDb}
              className="rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              حفظ القيود والخروج
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDiscardAndExit}
              className="rounded-xl font-bold text-xs"
            >
              تجاهل والخروج
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleReturnToEntries}
              className="rounded-xl text-xs font-semibold"
            >
              البقاء في الصفحة
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
