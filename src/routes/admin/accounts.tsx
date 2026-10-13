// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { erpStore, type Account } from "@/shared/services/erpStore";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/hooks/use-settings";
import {
  Landmark,
  Plus,
  Pencil,
  Trash2,
  Search,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  TrendingUp,
  DollarSign,
  ShieldAlert,
  SlidersHorizontal,
  ChevronRight,
  BookOpen,
  PieChart as PieChartIcon,
  Layers,
  ArrowUpDown,
  Printer,
  X,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OracleAccountsViewer } from "@/components/admin/OracleAccountsViewer";
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

export const Route = createFileRoute("/admin/accounts")({
  head: () => ({ meta: [{ title: "إدارة الحسابات - شجرة ودليل الحسابات المالي" }] }),
  component: AccountsPage,
});

const ACCOUNT_TYPES: {
  key: Account["type"];
  label: string;
  bg: string;
  text: string;
  border: string;
}[] = [
  {
    key: "asset",
    label: "أصول (Assets)",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  {
    key: "liability",
    label: "التزامات (Liabilities)",
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-800",
  },
  {
    key: "equity",
    label: "حقوق ملكية (Equity)",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
  },
  {
    key: "revenue",
    label: "إيرادات (Revenues)",
    bg: "bg-teal-50 dark:bg-teal-950/40",
    text: "text-teal-700 dark:text-teal-300",
    border: "border-teal-200 dark:border-teal-800",
  },
  {
    key: "expense",
    label: "مصروفات (Expenses)",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
  },
];

function AccountsPage() {
  const { toast } = useToast();
  const { formatPrice, currency, formatTreasuryCurrency } = useSettings();

  // Reactive state synced with erpStore - deep copy accounts list to guarantee fresh React references
  const [erpState, setErpState] = useState(() => {
    const s = erpStore.getState();
    return {
      ...s,
      accounts: s.accounts.map((a) => ({ ...a })),
    };
  });

  useEffect(() => {
    // Recalculate balances on mount to ensure linked system balances are fully synchronized
    erpStore.recalculateAccountBalances();

    // Subscribe to instant changes anywhere in the system
    const unsubscribe = erpStore.subscribe(() => {
      const s = erpStore.getState();
      setErpState({
        ...s,
        accounts: s.accounts.map((a) => ({ ...a })),
      });
    });
    return unsubscribe;
  }, []);

  // Filtering & View state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"tree" | "table">("tree");

  // Dialogs state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
  const [selectedAccountForLedger, setSelectedAccountForLedger] = useState<Account | null>(null);

  // New Account Form State
  const [accountForm, setAccountForm] = useState({
    code: "",
    name_ar: "",
    type: "asset" as Account["type"],
    parent_code: "",
    initial_balance: 0,
    status: "active" as "active" | "inactive",
    system_binding: "none" as Account["system_binding"],
    currency: "EGP",
  });

  // Oracle Import State & Handler
  const [isOracleImportOpen, setIsOracleImportOpen] = useState(false);
  const [oracleFiles, setOracleFiles] = useState<{
    level1?: File;
    level2?: File;
    level3?: File;
    level4?: File;
    transactions?: File;
  }>({});
  const [importingOracle, setImportingOracle] = useState(false);
  const [importLog, setImportLog] = useState("");

  const handleOracleImportSubmit = async () => {
    setImportingOracle(true);
    setImportLog("جاري قراءة وتحليل ملفات أوراكل...");
    try {
      const allAccounts: Account[] = [];
      const allEntries: any[] = [];

      const parseFileToJson = async (file: File): Promise<any[]> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const data = new Uint8Array(e.target?.result as ArrayBuffer);
              const workbook = XLSX.read(data, { type: "array" });
              const firstSheetName = workbook.SheetNames[0];
              const worksheet = workbook.Sheets[firstSheetName];
              const json = XLSX.utils.sheet_to_json(worksheet);
              resolve(json);
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = reject;
          reader.readAsArrayBuffer(file);
        });
      };

      const levelFiles = [
        { file: oracleFiles.level1, level: 1 },
        { file: oracleFiles.level2, level: 2 },
        { file: oracleFiles.level3, level: 3 },
        { file: oracleFiles.level4, level: 4 },
      ];

      for (const lf of levelFiles) {
        if (lf.file) {
          setImportLog(`جاري معالجة المستوى ${lf.level}...`);
          const rows = await parseFileToJson(lf.file);
          rows.forEach((row: any) => {
            const code = String(
              row["كود الحساب"] ||
                row["Account Code"] ||
                row["CODE"] ||
                row["code"] ||
                row["Account"] ||
                Object.values(row)[0] ||
                "",
            ).trim();
            const name = String(
              row["اسم الحساب"] ||
                row["Account Name"] ||
                row["NAME"] ||
                row["name"] ||
                row["Description"] ||
                Object.values(row)[1] ||
                "",
            ).trim();
            const initialBalance = Number(
              row["الرصيد الافتتاحي"] ||
                row["Opening Balance"] ||
                row["Balance"] ||
                row["balance"] ||
                0,
            );

            if (code && name) {
              let type: Account["type"] = "asset";
              const firstDigit = code.charAt(0);
              if (firstDigit === "1") type = "asset";
              else if (firstDigit === "2") type = "liability";
              else if (firstDigit === "3") type = "equity";
              else if (firstDigit === "4") type = "revenue";
              else if (firstDigit === "5" || firstDigit === "6") type = "expense";

              let parent_code = String(
                row["الحساب الأب"] || row["Parent Code"] || row["parent_code"] || "",
              );
              if (!parent_code && code.length > 1) {
                parent_code = code.substring(0, code.length - 2);
                if (parent_code.length === 0) parent_code = code.substring(0, 1);
              }

              const rowCurrency = String(
                row["العملة"] || row["Currency"] || row["currency"] || row["curr"] || "EGP",
              )
                .trim()
                .toUpperCase();

              allAccounts.push({
                code,
                name_ar: name,
                type,
                parent_code: parent_code && parent_code !== code ? parent_code : undefined,
                level: lf.level,
                balance: initialBalance,
                initial_balance: initialBalance,
                status: "active",
                currency: rowCurrency || "EGP",
              });
            }
          });
        }
      }

      if (oracleFiles.transactions) {
        setImportLog("جاري معالجة حركات القيود والسندات المالية لسنة 2026...");
        const txRows = await parseFileToJson(oracleFiles.transactions);
        txRows.forEach((row: any, index: number) => {
          const date = String(row["التاريخ"] || row["Date"] || row["date"] || "2026-01-01");
          const desc = String(
            row["البيان"] || row["Description"] || row["desc"] || "حركة أوراكل مرحلة",
          );
          const ref = String(
            row["رقم القيد"] || row["Reference"] || row["ref"] || `ORCL-${index + 1}`,
          );
          const debitAcc = String(
            row["حساب المدين"] || row["Debit Account"] || row["debit_code"] || "101000",
          );
          const creditAcc = String(
            row["حساب الدائن"] || row["Credit Account"] || row["credit_code"] || "201000",
          );
          const amount = Number(row["المبلغ"] || row["Amount"] || row["amount"] || 0);
          const txCurrency = String(row["العملة"] || row["Currency"] || row["currency"] || "EGP")
            .trim()
            .toUpperCase();

          if (amount > 0) {
            allEntries.push({
              id: "je-orcl-" + Date.now() + "-" + index,
              branch_id: "branch-1",
              date: date.includes("2026") ? date : "2026-01-01",
              description: desc,
              reference: ref,
              currency: txCurrency || "EGP",
              created_by: "أوراكل ERP",
              is_approved: true,
              created_at: new Date().toISOString(),
              lines: [
                { account_code: debitAcc, debit: amount, credit: 0, currency: txCurrency || "EGP" },
                {
                  account_code: creditAcc,
                  debit: 0,
                  credit: amount,
                  currency: txCurrency || "EGP",
                },
              ],
            });
          }
        });
      }

      if (allAccounts.length === 0) {
        throw new Error("لم يتم العثور على أي حسابات في الملفات. يرجى التحقق من الملفات المرفوعة.");
      }

      erpStore.importOracleBatchData(allAccounts, allEntries);

      toast({
        title: "✨ تم استيراد بيانات أوراكل وشجرة الحسابات بنجاح!",
        description: `تم استيراد ${allAccounts.length} حساب عبر المستويات المربعة و ${allEntries.length} قيد مالي بنجاح.`,
      });

      setIsOracleImportOpen(false);
      setOracleFiles({});
    } catch (err: any) {
      toast({
        title: "فشل استيراد أوراكل",
        description: err.message || "حدث خطأ أثناء قراءة ملفات Excel",
        variant: "destructive",
      });
    } finally {
      setImportingOracle(false);
      setImportLog("");
    }
  };

  // Calculate Summary Totals
  const summary = useMemo(() => {
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let totalRevenues = 0;
    let totalExpenses = 0;

    erpState.accounts.forEach((acc) => {
      // Aggregate root and level 2 accounts or all leaf accounts
      const b = acc.balance || 0;
      if (acc.type === "asset") totalAssets += b;
      if (acc.type === "liability") totalLiabilities += b;
      if (acc.type === "equity") totalEquity += b;
      if (acc.type === "revenue") totalRevenues += b;
      if (acc.type === "expense") totalExpenses += b;
    });

    return {
      totalAccounts: erpState.accounts.length,
      activeAccounts: erpState.accounts.filter((a) => a.status === "active").length,
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalRevenues,
      totalExpenses,
    };
  }, [erpState.accounts]);

  // Filtered Accounts
  const filteredAccounts = useMemo(() => {
    return erpState.accounts
      .filter((acc) => {
        const matchesSearch =
          acc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          acc.name_ar.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = selectedType === "all" || acc.type === selectedType;
        const matchesStatus = selectedStatus === "all" || acc.status === selectedStatus;
        const matchesLevel = selectedLevel === "all" || String(acc.level) === selectedLevel;
        return matchesSearch && matchesType && matchesStatus && matchesLevel;
      })
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [erpState.accounts, searchTerm, selectedType, selectedStatus, selectedLevel]);

  // Handle Recalculate Balances
  const handleRecalculate = () => {
    erpStore.recalculateAccountBalances();
    toast({
      title: "⚡ تم تحديث الأرصدة لحظياً",
      description: "تمت مراجعة جميع القيود المحاسبية وسندات الخزينة واحتساب الأرصدة الحالية بدقة.",
    });
  };

  const handleClearAndExportTemplate = () => {
    erpStore.clearAllAccountsAndTransactions();

    const templateData = [
      {
        "كود الحساب": "11010100",
        "اسم الحساب": "ارض المول",
        "الحساب الأب": "110101",
        المستوى: 4,
        "الرصيد الافتتاحي": 0,
        "نوع الحساب": "asset",
      },
      {
        "كود الحساب": "110101",
        "اسم الحساب": "الأصول الثابتة - أراضي",
        "الحساب الأب": "1101",
        المستوى: 3,
        "الرصيد الافتتاحي": 0,
        "نوع الحساب": "asset",
      },
      {
        "كود الحساب": "1101",
        "اسم الحساب": "الأصول الثابتة",
        "الحساب الأب": "11",
        المستوى: 2,
        "الرصيد الافتتاحي": 0,
        "نوع الحساب": "asset",
      },
      {
        "كود الحساب": "1",
        "اسم الحساب": "الأصول",
        "الحساب الأب": "",
        المستوى: 1,
        "الرصيد الافتتاحي": 0,
        "نوع الحساب": "asset",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "نموذج شجرة الحسابات");
    XLSX.writeFile(workbook, `نموذج_شجرة_الحسابات_المنظم.xlsx`);

    toast({
      title: "🧹 تم تفريغ النظام وتصدير النموذج القياسي",
      description: "تم مسح جميع الحسابات القديمة وتنزيل نموذج Excel منظم وجاهز للملء.",
    });
  };

  // Export Chart of Accounts to Excel
  const handleExportExcel = () => {
    const data = filteredAccounts.map((acc) => ({
      "كود الحساب": acc.code,
      "اسم الحساب (عربي)": acc.name_ar,
      "نوع الحساب": ACCOUNT_TYPES.find((t) => t.key === acc.type)?.label || acc.type,
      "الحساب الرئيسي الأب": acc.parent_code || "حساب رئيسي (Root)",
      المستوى: acc.level,
      "الرصيد الجاري": acc.balance,
      "الرصيد الافتتاحي": acc.initial_balance || 0,
      الحالة: acc.status === "active" ? "نشط" : "معطل",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "دليل الحسابات");
    XLSX.writeFile(workbook, `دليل_الحسابات_${new Date().toISOString().split("T")[0]}.xlsx`);

    toast({
      title: "تم تصدير الدليل بنجاح",
      description: `تم حفظ ${filteredAccounts.length} حساب في ملف Excel.`,
    });
  };

  // Handle Create Account
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountForm.code || !accountForm.name_ar) {
      toast({
        title: "خطأ",
        description: "يرجى تعبئة كود الحساب واسم الحساب",
        variant: "destructive",
      });
      return;
    }

    try {
      const parentAcc = erpState.accounts.find((a) => a.code === accountForm.parent_code);
      const level = parentAcc ? parentAcc.level + 1 : 1;
      erpStore.addAccount(
        accountForm.code,
        accountForm.name_ar,
        accountForm.type,
        accountForm.parent_code || undefined,
        level,
        Number(accountForm.initial_balance || 0),
        accountForm.system_binding,
        accountForm.currency,
      );

      toast({
        title: "✅ تم إضافة الحساب بنجاح",
        description: `تم ربط الحساب ${accountForm.name_ar} (${accountForm.code}) بدليل الحسابات المالي.`,
      });

      setIsAddOpen(false);
      setAccountForm({
        code: "",
        name_ar: "",
        type: "asset",
        parent_code: "",
        initial_balance: 0,
        status: "active",
        system_binding: "none",
        currency: "EGP",
      });
    } catch (err: any) {
      toast({
        title: "فشلت عملية الإضافة",
        description: err.message || "حدث خطأ أثناء إضافة الحساب",
        variant: "destructive",
      });
    }
  };

  // Handle Edit Submit
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;

    try {
      const parentAcc = erpState.accounts.find((a) => a.code === editingAccount.parent_code);
      const level = parentAcc ? parentAcc.level + 1 : 1;
      erpStore.updateAccount(editingAccount.code, {
        name_ar: editingAccount.name_ar,
        type: editingAccount.type,
        parent_code: editingAccount.parent_code || undefined,
        level,
        initial_balance: Number(editingAccount.initial_balance || 0),
        status: editingAccount.status,
        system_binding: editingAccount.system_binding,
        currency: editingAccount.currency,
      });

      toast({
        title: "✅ تم تحديث بيانات الحساب",
        description: `تم حفظ التعديلات على حساب ${editingAccount.name_ar} بنجاح.`,
      });

      setEditingAccount(null);
    } catch (err: any) {
      toast({
        title: "خطأ في التعديل",
        description: err.message || "تعذر حفظ التعديلات",
        variant: "destructive",
      });
    }
  };

  // Handle Delete Account
  const ConfirmDelete = () => {
    if (!accountToDelete) return;
    try {
      const res = erpStore.deleteAccount(accountToDelete.code);
      toast({
        title: res.softDeleted ? "⚠️ تم تعطيل الحساب" : "🗑️ تم حذف الحساب",
        description: res.message,
      });
      setAccountToDelete(null);
    } catch (err: any) {
      toast({
        title: "تعذر الحذف",
        description: err.message || "حدث خطأ أثناء محاولة حذف الحساب",
        variant: "destructive",
      });
    }
  };

  // Ledger details data for selected account
  const ledgerData = useMemo(() => {
    if (!selectedAccountForLedger) return { account: null, entries: [] };
    return erpStore.getAccountLedgerEntries(selectedAccountForLedger.code);
  }, [selectedAccountForLedger]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute -left-10 -top-10 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1.5 backdrop-blur">
                <Landmark size={14} />
                النظام المالي والمحاسبي الموحد ERP
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                ربط لحظي نشط
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              إدارة دليل الحسابات والشجرة المالية
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl font-medium leading-relaxed">
              عرض شامل لجميع أصول وخصوم وحقوق ملكية وإيرادات ومصروفات الشركة. يمكنك إضافة، تعديل، أو
              حذف الحسابات ومراقبة أرصدتها اللحظية المرتبطة تلقائياً بفواتير المبيعات وسندات الخزينة
              وجرد المخزون.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Button
              onClick={handleRecalculate}
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-bold text-xs h-10 rounded-2xl backdrop-blur transition active:scale-95"
            >
              <RefreshCw size={16} className="ml-1.5" />
              مزامنة وتحديث الأرصدة
            </Button>
            <Button
              onClick={handleExportExcel}
              variant="outline"
              className="bg-emerald-600/80 hover:bg-emerald-600 text-white border-emerald-500 font-bold text-xs h-10 rounded-2xl backdrop-blur transition active:scale-95"
            >
              <FileSpreadsheet size={16} className="ml-1.5" />
              تصدير الدليل (Excel)
            </Button>
            <Button
              onClick={handleClearAndExportTemplate}
              variant="outline"
              className="bg-rose-600/80 hover:bg-rose-600 text-white border-rose-500 font-bold text-xs h-10 rounded-2xl backdrop-blur transition active:scale-95 flex items-center gap-1.5"
            >
              <Trash2 size={16} />
              تفريغ وتصدير نموذج Excel القياسي
            </Button>
            <Button
              onClick={() => setIsOracleImportOpen(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-10 rounded-2xl px-4 shadow-lg shadow-amber-600/30 transition active:scale-95 flex items-center gap-1.5"
            >
              <FileSpreadsheet size={16} />
              استيراد أوراكل (4 مستويات والحركات)
            </Button>
            <Button
              onClick={() => setIsAddOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs h-10 rounded-2xl px-5 shadow-lg shadow-primary/30 transition active:scale-95"
            >
              <Plus size={18} className="ml-1.5" />
              إضافة حساب جديد
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="oracle_tree" className="space-y-6">
        <TabsList className="bg-muted p-1 rounded-xl flex w-full max-w-xl mx-auto mb-6">
          <TabsTrigger value="oracle_tree" className="flex-1 rounded-lg font-bold">
            <Layers size={16} className="ml-2 inline" />
            دليل الحسابات (شجرة أوراكل)
          </TabsTrigger>
          <TabsTrigger value="system_accounts" className="flex-1 rounded-lg font-bold">
            <SlidersHorizontal size={16} className="ml-2 inline" />
            إدارة الحسابات النشطة (قائمة النظام)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="oracle_tree" className="mt-4">
          <OracleAccountsViewer />
        </TabsContent>

        <TabsContent value="system_accounts" className="space-y-6 mt-4">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card className="border-border bg-card shadow-sm hover:shadow-md transition">
              <CardContent className="p-4 space-y-1">
                <p className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                  <Layers size={13} className="text-primary" />
                  إجمالي الحسابات
                </p>
                <h3 className="text-xl font-black text-foreground">{summary.totalAccounts}</h3>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                  {summary.activeAccounts} حساب نشط
                </p>
              </CardContent>
            </Card>

            <Card className="border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-sm">
              <CardContent className="p-4 space-y-1">
                <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                  <TrendingUp size={13} />
                  الأصول (Assets)
                </p>
                <h3 className="text-lg font-black text-emerald-800 dark:text-emerald-200">
                  {formatPrice(summary.totalAssets)}
                </h3>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  الخزينة + البنوك + المخزون
                </p>
              </CardContent>
            </Card>

            <Card className="border-rose-200 dark:border-rose-800/60 bg-rose-50/40 dark:bg-rose-950/20 shadow-sm">
              <CardContent className="p-4 space-y-1">
                <p className="text-[11px] font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1">
                  <ShieldAlert size={13} />
                  الالتزامات (Liabilities)
                </p>
                <h3 className="text-lg font-black text-rose-800 dark:text-rose-200">
                  {formatPrice(summary.totalLiabilities)}
                </h3>
                <p className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">
                  مستحقات الموردين والدائنين
                </p>
              </CardContent>
            </Card>

            <Card className="border-blue-200 dark:border-blue-800/60 bg-blue-50/40 dark:bg-blue-950/20 shadow-sm">
              <CardContent className="p-4 space-y-1">
                <p className="text-[11px] font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1">
                  <Landmark size={13} />
                  حقوق الملكية (Equity)
                </p>
                <h3 className="text-lg font-black text-blue-800 dark:text-blue-200">
                  {formatPrice(summary.totalEquity)}
                </h3>
                <p className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                  رأس المال والأرباح المبقاة
                </p>
              </CardContent>
            </Card>

            <Card className="border-teal-200 dark:border-teal-800/60 bg-teal-50/40 dark:bg-teal-950/20 shadow-sm">
              <CardContent className="p-4 space-y-1">
                <p className="text-[11px] font-bold text-teal-700 dark:text-teal-300 flex items-center gap-1">
                  <DollarSign size={13} />
                  الإيرادات (Revenues)
                </p>
                <h3 className="text-lg font-black text-teal-800 dark:text-teal-200">
                  {formatPrice(summary.totalRevenues)}
                </h3>
                <p className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold">
                  إجمالي مبيعات وروافد النظام
                </p>
              </CardContent>
            </Card>

            <Card className="border-amber-200 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/20 shadow-sm">
              <CardContent className="p-4 space-y-1">
                <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                  <PieChartIcon size={13} />
                  المصروفات (Expenses)
                </p>
                <h3 className="text-lg font-black text-amber-800 dark:text-amber-200">
                  {formatPrice(summary.totalExpenses)}
                </h3>
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                  مصاريف التشغيل والمشتريات
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Filter Toolbar */}
          <Card className="border-border bg-card shadow-sm">
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search
                    size={16}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="ابحث بكود الحساب أو الاسم (مثال: 101000 أو الخزينة)..."
                    className="pr-9 h-10 text-xs font-bold rounded-xl border-border"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Type Selector */}
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="h-10 px-3 py-1.5 rounded-xl text-xs font-bold bg-background border border-border text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="all">جميع أنواع الحسابات</option>
                    <option value="asset">أصول (Asset)</option>
                    <option value="liability">التزامات (Liability)</option>
                    <option value="equity">حقوق ملكية (Equity)</option>
                    <option value="revenue">إيرادات (Revenue)</option>
                    <option value="expense">مصروفات (Expense)</option>
                  </select>

                  <select
                    value={selectedLevel}
                    onChange={(e) => setSelectedLevel(e.target.value)}
                    className="h-10 px-3 py-1.5 rounded-xl text-xs font-bold bg-background border border-border text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="all">جميع المستويات</option>
                    <option value="1">المستوى 1 (رئيسي Root)</option>
                    <option value="2">المستوى 2 (فرعي Sub)</option>
                    <option value="3">المستوى 3 (تحليلي Detail)</option>
                  </select>

                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="h-10 px-3 py-1.5 rounded-xl text-xs font-bold bg-background border border-border text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="all">جميع الحالات</option>
                    <option value="active">الحسابات النشطة فقط</option>
                    <option value="inactive">الحسابات المعطلة فقط</option>
                  </select>

                  {/* View Switcher Buttons */}
                  <div className="flex items-center bg-muted p-1 rounded-xl border border-border">
                    <button
                      onClick={() => setViewMode("tree")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        viewMode === "tree"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      عرض الشجرة
                    </button>
                    <button
                      onClick={() => setViewMode("table")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        viewMode === "table"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      جدول تفصيلي
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Content Area */}
          <Card className="border-border bg-card shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/40 pb-4 border-b border-border flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-black text-foreground flex items-center gap-2">
                  <BookOpen size={18} className="text-primary" />
                  قائمة الحسابات المالية بالدليل ({filteredAccounts.length})
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  تصفح الهيكل المالي، تعديل بيانات الحسابات، حذف الحسابات غير المستخدمة، واستعراض
                  كشوفات الحساب.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {filteredAccounts.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                    <Search size={24} />
                  </div>
                  <h3 className="font-black text-base text-foreground">
                    لا توجد حسابات مطابقة للبحث
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    لم يتم العثور على أي حساب يطابق خيارات البحث أو التصفية الحالية. جرب تغيير كلمة
                    البحث أو إعادة الفلترة.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchTerm("");
                      setSelectedType("all");
                      setSelectedStatus("all");
                      setSelectedLevel("all");
                    }}
                    className="font-bold text-xs"
                  >
                    إعادة ضبط الفلاتر
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-muted/70 text-muted-foreground text-xs border-b border-border font-bold">
                      <tr>
                        <th className="p-3.5 pr-6">كود الحساب</th>
                        <th className="p-3.5">اسم الحساب المحاسبي</th>
                        <th className="p-3.5">النوع</th>
                        <th className="p-3.5">الحساب الأب</th>
                        <th className="p-3.5">المستوى</th>
                        <th className="p-3.5">الرصيد الجاري اللحظي</th>
                        <th className="p-3.5">الحالة</th>
                        <th className="p-3.5 text-center pl-6">الإجراءات والعمليات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-xs font-medium">
                      {filteredAccounts.map((acc) => {
                        const isRoot = acc.level === 1;
                        const typeConfig =
                          ACCOUNT_TYPES.find((t) => t.key === acc.type) || ACCOUNT_TYPES[0];

                        return (
                          <tr
                            key={acc.code}
                            className={`hover:bg-muted/40 transition ${
                              isRoot ? "bg-muted/20 font-black border-r-4 border-r-primary" : ""
                            }`}
                          >
                            {/* Code */}
                            <td className="p-3.5 pr-6 font-mono font-black text-primary text-sm">
                              {acc.code}
                            </td>

                            {/* Name with tree indent */}
                            <td className="p-3.5">
                              <div
                                style={{
                                  paddingRight:
                                    viewMode === "tree" ? `${(acc.level - 1) * 1.5}rem` : "0rem",
                                }}
                                className="flex items-center gap-1.5"
                              >
                                {viewMode === "tree" && !isRoot && (
                                  <span className="text-muted-foreground/60 font-mono text-sm">
                                    ↳
                                  </span>
                                )}
                                <span
                                  className={`font-bold ${isRoot ? "text-foreground text-sm" : "text-foreground"}`}
                                >
                                  {acc.name_ar}
                                </span>
                                {acc.system_binding && acc.system_binding !== "none" && (
                                  <div className="flex flex-col gap-1 items-start mt-1">
                                    <span
                                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black border mr-1.5 whitespace-nowrap ${
                                        acc.sync_status === "pending"
                                          ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-900/60"
                                          : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/60"
                                      }`}
                                    >
                                      <span
                                        className={`w-1.5 h-1.5 rounded-full ${acc.sync_status === "pending" ? "bg-amber-500 animate-pulse" : "bg-indigo-500 animate-pulse"}`}
                                      />
                                      {acc.sync_status === "pending"
                                        ? "مزامنة معلقة (انتظار التحديث)"
                                        : "ربط لحظي"}
                                      :{" "}
                                      {acc.system_binding === "treasury_main"
                                        ? "خزينة الكاشير"
                                        : acc.system_binding === "treasury_cib"
                                          ? "البنك الرئيسي (CIB)"
                                          : acc.system_binding === "treasury_extra"
                                            ? "الخزينة الإضافية"
                                            : acc.system_binding === "treasury_usd"
                                              ? "خزينة الدولار"
                                              : acc.system_binding === "suppliers_payable"
                                                ? "مديونيات الموردين"
                                                : acc.system_binding === "sales_revenue"
                                                  ? "المقبوضات والإيرادات"
                                                  : acc.system_binding === "operating_expenses"
                                                    ? "المصروفات والمدفوعات"
                                                    : acc.system_binding === "warehouse_main_value"
                                                      ? "قيمة المخزن الرئيسي"
                                                      : acc.system_binding ===
                                                          "warehouse_kitchen_value"
                                                        ? "قيمة مخزن الفرن والمطبخ"
                                                        : acc.system_binding ===
                                                            "expired_inventory_value"
                                                          ? "قيمة منتهيات الصلاحية"
                                                          : acc.system_binding ===
                                                              "disposed_waste_value"
                                                            ? "إجمالي الهدر والإعدامات"
                                                            : acc.system_binding.startsWith(
                                                                  "treasury_",
                                                                )
                                                              ? erpState.treasuries.find(
                                                                  (t) =>
                                                                    t.id ===
                                                                    acc.system_binding?.replace(
                                                                      "treasury_",
                                                                      "",
                                                                    ),
                                                                )?.name_ar ||
                                                                (acc.system_binding.replace(
                                                                  "treasury_",
                                                                  "",
                                                                ) === "management_egp"
                                                                  ? "خزينة الإدارة مصري"
                                                                  : acc.system_binding)
                                                              : acc.system_binding}
                                    </span>
                                    {acc.sync_status === "pending" && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          erpStore.activateAccountSync(acc.code);
                                          toast({
                                            title: "✅ تم تنشيط الربط لحظياً",
                                            description: `تم تحديث رصيد ${acc.name_ar} برصيد النظام الفعلي بنجاح.`,
                                          });
                                        }}
                                        className="text-[9px] text-amber-600 dark:text-amber-400 underline font-bold hover:text-amber-800 dark:hover:text-amber-300 transition mr-1.5"
                                      >
                                        تنشيط ومزامنة الرصيد الآن ⚡
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Type Badge */}
                            <td className="p-3.5">
                              <span
                                className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black border ${typeConfig.bg} ${typeConfig.text} ${typeConfig.border}`}
                              >
                                {typeConfig.label.split(" ")[0]}
                              </span>
                            </td>

                            {/* Parent Account */}
                            <td className="p-3.5 text-muted-foreground font-mono">
                              {acc.parent_code ? (
                                <span className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded text-[11px]">
                                  {acc.parent_code}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/50 text-[10px]">
                                  حساب رئيسي
                                </span>
                              )}
                            </td>

                            {/* Level */}
                            <td className="p-3.5">
                              <Badge variant="outline" className="text-[10px] font-bold">
                                مستوى {acc.level}
                              </Badge>
                            </td>

                            {/* Live Balance */}
                            <td className="p-3.5 font-mono font-black text-sm dir-ltr text-left">
                              <span
                                className={
                                  acc.balance < 0
                                    ? "text-rose-600 dark:text-rose-400"
                                    : "text-emerald-600 dark:text-emerald-400"
                                }
                              >
                                {formatTreasuryCurrency(acc.balance, acc.currency)}
                              </span>
                            </td>

                            {/* Status Toggle */}
                            <td className="p-3.5">
                              <button
                                onClick={() => {
                                  const nextStatus =
                                    acc.status === "active" ? "inactive" : "active";
                                  erpStore.updateAccountStatus(acc.code, nextStatus);
                                  toast({
                                    title: "تم تحديث الحالة",
                                    description: `تم تغيير حالة حساب ${acc.name_ar} إلى ${nextStatus === "active" ? "نشط" : "معطل"}.`,
                                  });
                                }}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-black cursor-pointer transition active:scale-95 ${
                                  acc.status === "active"
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                    : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                }`}
                              >
                                {acc.status === "active" ? "● نشط" : "■ معطل"}
                              </button>
                            </td>

                            {/* Actions */}
                            <td className="p-3.5 pl-6 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {/* View Ledger */}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelectedAccountForLedger(acc)}
                                  className="h-8 px-2.5 text-xs font-bold rounded-lg bg-background hover:bg-muted text-primary border-primary/30"
                                  title="استعراض كشف الحساب والقيود"
                                >
                                  <FileText size={14} className="ml-1" />
                                  كشف حساب
                                </Button>

                                {/* Edit */}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingAccount({ ...acc })}
                                  className="h-8 px-2 text-xs font-bold rounded-lg text-slate-700 dark:text-slate-200 hover:bg-muted"
                                  title="تعديل الحساب"
                                >
                                  <Pencil size={14} />
                                </Button>

                                {/* Delete */}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setAccountToDelete(acc)}
                                  className="h-8 px-2 text-xs font-bold rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                                  title="حذف الحساب"
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* DIALOG 1: ADD ACCOUNT */}
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogContent className="max-w-md text-right rounded-2xl">
              <DialogHeader className="text-right">
                <DialogTitle className="text-lg font-black text-foreground flex items-center gap-2">
                  <Plus className="text-primary" size={20} />
                  إضافة حساب جديد بالدليل المالي
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  قم بإدخال بيانات الحساب المحاسبي الجديد وربطه بالحساب الأب المناسب في الشجرة
                  المحاسبية.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleAddSubmit} className="space-y-4 py-2">
                <div>
                  <Label className="text-xs font-bold">كود الحساب الفريد *</Label>
                  <Input
                    value={accountForm.code}
                    onChange={(e) => setAccountForm({ ...accountForm, code: e.target.value })}
                    placeholder="مثال: 101005 أو 502010"
                    className="mt-1 font-mono font-bold text-xs"
                    required
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold">اسم الحساب المحاسبي (بالعربي) *</Label>
                  <Input
                    value={accountForm.name_ar}
                    onChange={(e) => setAccountForm({ ...accountForm, name_ar: e.target.value })}
                    placeholder="مثال: خزينة المشروبات والفرع الفرعي"
                    className="mt-1 text-xs font-bold"
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs font-bold">نوع الحساب *</Label>
                    <select
                      value={accountForm.type}
                      onChange={(e) =>
                        setAccountForm({ ...accountForm, type: e.target.value as Account["type"] })
                      }
                      className="w-full mt-1 h-9 px-2 rounded-xl text-xs font-bold bg-background border border-border text-foreground"
                    >
                      <option value="asset">أصول (Asset)</option>
                      <option value="liability">التزامات (Liability)</option>
                      <option value="equity">حقوق ملكية (Equity)</option>
                      <option value="revenue">إيرادات (Revenue)</option>
                      <option value="expense">مصروفات (Expense)</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs font-bold">عملة الحساب *</Label>
                    <select
                      value={accountForm.currency || "EGP"}
                      onChange={(e) => setAccountForm({ ...accountForm, currency: e.target.value })}
                      className="w-full mt-1 h-9 px-2 rounded-xl text-xs font-bold bg-background border border-border text-foreground"
                    >
                      <option value="EGP">جنيه مصري (EGP)</option>
                      <option value="USD">دولار أمريكي (USD)</option>
                      <option value="SSP">جنيه سوداني (SSP)</option>
                      <option value="MULTI">متعدد (MULTI)</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs font-bold">الحساب الأب</Label>
                    <select
                      value={accountForm.parent_code}
                      onChange={(e) =>
                        setAccountForm({ ...accountForm, parent_code: e.target.value })
                      }
                      className="w-full mt-1 h-9 px-2 rounded-xl text-xs font-bold bg-background border border-border text-foreground"
                    >
                      <option value="">-- رئيسي --</option>
                      {erpState.accounts
                        .filter((a) => a.level < 3)
                        .map((a) => (
                          <option key={a.code} value={a.code}>
                            {a.code} - {a.name_ar}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-bold">الرصيد الافتتاحي</Label>
                    <Input
                      type="number"
                      value={accountForm.initial_balance}
                      onChange={(e) =>
                        setAccountForm({ ...accountForm, initial_balance: Number(e.target.value) })
                      }
                      className="mt-1 font-mono text-xs font-bold"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-bold">حالة الحساب</Label>
                    <select
                      value={accountForm.status}
                      onChange={(e) =>
                        setAccountForm({
                          ...accountForm,
                          status: e.target.value as "active" | "inactive",
                        })
                      }
                      className="w-full mt-1 h-9 px-3 rounded-xl text-xs font-bold bg-background border border-border text-foreground"
                    >
                      <option value="active">نشط (مفعل للاستخدام)</option>
                      <option value="inactive">معطل</option>
                    </select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                    <RefreshCw
                      size={14}
                      className="animate-spin"
                      style={{ animationDuration: "3s" }}
                    />
                    ربط الرصيد بالنظام تلقائياً (اختياري)
                  </Label>
                  <select
                    value={accountForm.system_binding || "none"}
                    onChange={(e) =>
                      setAccountForm({
                        ...accountForm,
                        system_binding: e.target.value as Account["system_binding"],
                      })
                    }
                    className="w-full mt-1 h-9 px-3 rounded-xl text-xs font-bold bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900 text-foreground"
                  >
                    <option value="none">بدون ربط (رصيد محاسبي يدوي من القيود)</option>
                    {/* Dynamic Treasuries from erpStore state */}
                    {erpState.treasuries.map((t) => (
                      <option key={t.id} value={`treasury_${t.id}`}>
                        🔗 {t.account_code ? `[رقم الحساب: ${t.account_code}] ` : ""}ربط لحظي برصيد
                        خزينة: {t.name_ar} ({t.currency})
                      </option>
                    ))}
                    <option value="suppliers_payable">ربط لحظي بإجمالي مديونيات الموردين</option>
                    <option value="sales_revenue">
                      ربط تلقائي بإجمالي المقبوضات/الإيرادات (Receipts)
                    </option>
                    <option value="operating_expenses">
                      ربط تلقائي بإجمالي المدفوعات/المصروفات (Payments)
                    </option>
                    <option value="warehouse_main_value">
                      📦 ربط لحظي بقيمة بضاعة المخزن الرئيسي
                    </option>
                    <option value="warehouse_kitchen_value">
                      🍳 ربط لحظي بقيمة بضاعة مخزن الفرن والمطبخ
                    </option>
                    <option value="expired_inventory_value">
                      ⚠️ ربط لحظي بقيمة بضاعة الصلاحية المنتهية (التالف الحالي)
                    </option>
                    <option value="disposed_waste_value">
                      🚨 ربط لحظي بإجمالي الهدر والإعدامات المتراكمة
                    </option>
                  </select>
                  <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                    عند التفعيل، سيتم تحديث وتثبيت رصيد هذا الحساب تلقائياً ومزامنته لحظياً مع الجزء
                    المرتبط به في النظام دون الحاجة لقيود يدوية.
                  </p>
                </div>

                <DialogFooter className="gap-2 pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddOpen(false)}
                    className="font-bold text-xs"
                  >
                    إلغاء
                  </Button>
                  <Button
                    type="submit"
                    className="font-black text-xs bg-primary text-primary-foreground px-5"
                  >
                    حفظ وإنشاء الحساب
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* DIALOG 2: EDIT ACCOUNT */}
          <Dialog open={!!editingAccount} onOpenChange={(open) => !open && setEditingAccount(null)}>
            <DialogContent className="max-w-md text-right rounded-2xl">
              <DialogHeader className="text-right">
                <DialogTitle className="text-lg font-black text-foreground flex items-center gap-2">
                  <Pencil className="text-primary" size={20} />
                  تعديل بيانات الحساب المحاسبي
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  تحديث الكود أو المسمى العربي أو التصنيف المالي لهذا الحساب في الشجرة.
                </DialogDescription>
              </DialogHeader>

              {editingAccount && (
                <form onSubmit={handleEditSubmit} className="space-y-4 py-2">
                  <div>
                    <Label className="text-xs font-bold">كود الحساب *</Label>
                    <Input
                      value={editingAccount.code}
                      onChange={(e) =>
                        setEditingAccount({ ...editingAccount, code: e.target.value })
                      }
                      className="mt-1 font-mono font-bold text-xs"
                      required
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-bold">اسم الحساب (عربي) *</Label>
                    <Input
                      value={editingAccount.name_ar}
                      onChange={(e) =>
                        setEditingAccount({ ...editingAccount, name_ar: e.target.value })
                      }
                      className="mt-1 text-xs font-bold"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs font-bold">نوع الحساب *</Label>
                      <select
                        value={editingAccount.type}
                        onChange={(e) =>
                          setEditingAccount({
                            ...editingAccount,
                            type: e.target.value as Account["type"],
                          })
                        }
                        className="w-full mt-1 h-9 px-2 rounded-xl text-xs font-bold bg-background border border-border text-foreground"
                      >
                        <option value="asset">أصول (Asset)</option>
                        <option value="liability">التزامات (Liability)</option>
                        <option value="equity">حقوق ملكية (Equity)</option>
                        <option value="revenue">إيرادات (Revenue)</option>
                        <option value="expense">مصروفات (Expense)</option>
                      </select>
                    </div>

                    <div>
                      <Label className="text-xs font-bold">عملة الحساب *</Label>
                      <select
                        value={editingAccount.currency || "EGP"}
                        onChange={(e) =>
                          setEditingAccount({ ...editingAccount, currency: e.target.value })
                        }
                        className="w-full mt-1 h-9 px-2 rounded-xl text-xs font-bold bg-background border border-border text-foreground"
                      >
                        <option value="EGP">جنيه مصري (EGP)</option>
                        <option value="USD">دولار أمريكي (USD)</option>
                        <option value="SSP">جنيه سوداني (SSP)</option>
                        <option value="MULTI">متعدد (MULTI)</option>
                      </select>
                    </div>

                    <div>
                      <Label className="text-xs font-bold">الحساب الأب</Label>
                      <select
                        value={editingAccount.parent_code || ""}
                        onChange={(e) =>
                          setEditingAccount({ ...editingAccount, parent_code: e.target.value })
                        }
                        className="w-full mt-1 h-9 px-2 rounded-xl text-xs font-bold bg-background border border-border text-foreground"
                      >
                        <option value="">-- رئيسي --</option>
                        {erpState.accounts
                          .filter((a) => a.code !== editingAccount.code && a.level < 3)
                          .map((a) => (
                            <option key={a.code} value={a.code}>
                              {a.code} - {a.name_ar}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-bold">الرصيد الافتتاحي</Label>
                      <Input
                        type="number"
                        value={editingAccount.initial_balance || 0}
                        onChange={(e) =>
                          setEditingAccount({
                            ...editingAccount,
                            initial_balance: Number(e.target.value),
                          })
                        }
                        className="mt-1 font-mono text-xs font-bold"
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-bold">الحالة</Label>
                      <select
                        value={editingAccount.status}
                        onChange={(e) =>
                          setEditingAccount({
                            ...editingAccount,
                            status: e.target.value as "active" | "inactive",
                          })
                        }
                        className="w-full mt-1 h-9 px-3 rounded-xl text-xs font-bold bg-background border border-border text-foreground"
                      >
                        <option value="active">نشط</option>
                        <option value="inactive">معطل</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                      <RefreshCw
                        size={14}
                        className="animate-spin"
                        style={{ animationDuration: "3s" }}
                      />
                      ربط الرصيد بالنظام تلقائياً (اختياري)
                    </Label>
                    <select
                      value={editingAccount.system_binding || "none"}
                      onChange={(e) =>
                        setEditingAccount({
                          ...editingAccount,
                          system_binding: e.target.value as Account["system_binding"],
                        })
                      }
                      className="w-full mt-1 h-9 px-3 rounded-xl text-xs font-bold bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900 text-foreground"
                    >
                      <option value="none">بدون ربط (رصيد محاسبي يدوي من القيود)</option>
                      {/* Dynamic Treasuries from erpStore state */}
                      {erpState.treasuries.map((t) => (
                        <option key={t.id} value={`treasury_${t.id}`}>
                          🔗 {t.account_code ? `[رقم الحساب: ${t.account_code}] ` : ""}ربط لحظي
                          برصيد خزينة: {t.name_ar} ({t.currency})
                        </option>
                      ))}
                      <option value="suppliers_payable">ربط لحظي بإجمالي مديونيات الموردين</option>
                      <option value="sales_revenue">
                        ربط تلقائي بإجمالي المقبوضات/الإيرادات (Receipts)
                      </option>
                      <option value="operating_expenses">
                        ربط تلقائي بإجمالي المدفوعات/المصروفات (Payments)
                      </option>
                      <option value="warehouse_main_value">
                        📦 ربط لحظي بقيمة بضاعة المخزن الرئيسي
                      </option>
                      <option value="warehouse_kitchen_value">
                        🍳 ربط لحظي بقيمة بضاعة مخزن الفرن والمطبخ
                      </option>
                      <option value="expired_inventory_value">
                        ⚠️ ربط لحظي بقيمة بضاعة الصلاحية المنتهية (التالف الحالي)
                      </option>
                      <option value="disposed_waste_value">
                        🚨 ربط لحظي بإجمالي الهدر والإعدامات المتراكمة
                      </option>
                    </select>
                    <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                      عند التفعيل، سيتم تحديث وتثبيت رصيد هذا الحساب تلقائياً ومزامنته لحظياً مع
                      الجزء المرتبط به في النظام دون الحاجة لقيود يدوية.
                    </p>
                  </div>

                  <DialogFooter className="gap-2 pt-2 border-t border-border">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditingAccount(null)}
                      className="font-bold text-xs"
                    >
                      إلغاء
                    </Button>
                    <Button
                      type="submit"
                      className="font-black text-xs bg-primary text-primary-foreground px-5"
                    >
                      حفظ التغييرات
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>

          {/* DIALOG 3: DELETE ACCOUNT CONFIRMATION */}
          <Dialog
            open={!!accountToDelete}
            onOpenChange={(open) => !open && setAccountToDelete(null)}
          >
            <DialogContent className="max-w-md text-right rounded-2xl">
              <DialogHeader className="text-right">
                <DialogTitle className="text-lg font-black text-rose-600 flex items-center gap-2">
                  <Trash2 size={20} />
                  تأكيد حذف الحساب المحاسبي
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  هل أنت تأكد من رغبتك في حذف الحساب:{" "}
                  <strong className="text-foreground font-black">
                    {accountToDelete?.name_ar} ({accountToDelete?.code})
                  </strong>
                  ؟
                </DialogDescription>
              </DialogHeader>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-medium">
                💡 ملاحظة أمان محاسبي: إذا كان هذا الحساب مرتبطاً بقيود سابقة في الدفتر العام، فسيتم
                تحويل حالته تلقائياً إلى (معطل) لحماية شجرة الحسابات والاتزان المالي للميزانية.
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setAccountToDelete(null)}
                  className="font-bold text-xs"
                >
                  إلغاء
                </Button>
                <Button
                  onClick={ConfirmDelete}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-black text-xs px-5"
                >
                  تأكيد الحذف
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* DIALOG 4: VIEW ACCOUNT LEDGER STATEMENT */}
          <Dialog
            open={!!selectedAccountForLedger}
            onOpenChange={(open) => !open && setSelectedAccountForLedger(null)}
          >
            <DialogContent className="max-w-3xl text-right rounded-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader className="text-right border-b border-border pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-lg font-black text-foreground flex items-center gap-2">
                      <FileText className="text-primary" size={20} />
                      كشف حساب الدفتر العام (General Ledger Statement)
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                      حساب:{" "}
                      <strong className="text-primary font-mono">{ledgerData.account?.code}</strong>{" "}
                      - <strong className="text-foreground">{ledgerData.account?.name_ar}</strong>
                    </DialogDescription>
                  </div>
                  <Badge variant="outline" className="text-xs font-bold font-mono px-3 py-1">
                    الرصيد الحالي: {formatPrice(ledgerData.account?.balance || 0)}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {ledgerData.entries.length === 0 ? (
                  <div className="p-8 text-center space-y-2">
                    <FileText size={32} className="mx-auto text-muted-foreground/60" />
                    <h4 className="font-bold text-sm text-foreground">
                      لا توجد قيود أو حركات سابقة لهذا الحساب
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      لم يتم تسجيل أي سندات أو فواتير مبيعات مرتبطة بهذا الحساب بعد.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-xs text-right">
                      <thead className="bg-muted text-muted-foreground font-bold border-b border-border">
                        <tr>
                          <th className="p-2.5">التاريخ</th>
                          <th className="p-2.5">البيان / البيان المحاسبي</th>
                          <th className="p-2.5">رقم المرجع</th>
                          <th className="p-2.5 text-emerald-600">مدين (Debit)</th>
                          <th className="p-2.5 text-rose-600">دائن (Credit)</th>
                          <th className="p-2.5">الرصيد التراكمي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border font-medium">
                        {ledgerData.entries.map((entry, idx) => (
                          <tr key={idx} className="hover:bg-muted/30 font-mono">
                            <td className="p-2.5 text-muted-foreground">{entry.date}</td>
                            <td className="p-2.5 font-sans font-bold text-foreground">
                              {entry.description}
                            </td>
                            <td className="p-2.5 text-primary font-bold">
                              {entry.reference || entry.id}
                            </td>
                            <td className="p-2.5 text-emerald-600 font-bold">
                              {entry.debit > 0 ? entry.debit.toLocaleString() : "-"}
                            </td>
                            <td className="p-2.5 text-rose-600 font-bold">
                              {entry.credit > 0 ? entry.credit.toLocaleString() : "-"}
                            </td>
                            <td className="p-2.5 font-black text-foreground">
                              {entry.runningBalance.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 border-t border-border pt-3">
                <Button
                  variant="outline"
                  onClick={() => window.print()}
                  className="font-bold text-xs gap-1.5"
                >
                  <Printer size={14} />
                  طباعة كشف الحساب
                </Button>
                <Button
                  onClick={() => setSelectedAccountForLedger(null)}
                  className="font-bold text-xs px-5"
                >
                  إغلاق
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ORACLE MIGRATION IMPORT DIALOG */}
          <Dialog open={isOracleImportOpen} onOpenChange={setIsOracleImportOpen}>
            <DialogContent className="max-w-2xl text-right rounded-2xl">
              <DialogHeader className="text-right border-b border-border pb-3">
                <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2">
                  <FileSpreadsheet className="text-amber-600" size={24} />
                  استيراد شجرة حسابات أوراكل (4 مستويات وحركات الخزينة)
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  قم برفع ملفات الـ Excel الخاصة بمستويات الشجرة الأربعة وحركات القيود المالية
                  وسندات الخزينة لنقلها بذكاء وربطها بالكامل للبدء في عام 2026.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">
                      ملف المستوى الأول (Level 1)
                    </Label>
                    <Input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={(e) =>
                        setOracleFiles({ ...oracleFiles, level1: e.target.files?.[0] })
                      }
                      className="text-xs h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">
                      ملف المستوى الثاني (Level 2)
                    </Label>
                    <Input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={(e) =>
                        setOracleFiles({ ...oracleFiles, level2: e.target.files?.[0] })
                      }
                      className="text-xs h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">
                      ملف المستوى الثالث (Level 3)
                    </Label>
                    <Input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={(e) =>
                        setOracleFiles({ ...oracleFiles, level3: e.target.files?.[0] })
                      }
                      className="text-xs h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">
                      ملف المستوى الرابع التحليلي (Level 4)
                    </Label>
                    <Input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={(e) =>
                        setOracleFiles({ ...oracleFiles, level4: e.target.files?.[0] })
                      }
                      className="text-xs h-10"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-border">
                  <Label className="text-xs font-bold text-foreground">
                    ملف حركات الخزينة والقيود المحاسبية (2026)
                  </Label>
                  <Input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={(e) =>
                      setOracleFiles({ ...oracleFiles, transactions: e.target.files?.[0] })
                    }
                    className="text-xs h-10"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    يحتوي على تفاصيل القيود، أرقام السندات، الحسابات المدينة والدائنة، والمبالغ.
                  </p>
                </div>

                {importingOracle && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-center space-y-2">
                    <RefreshCw className="animate-spin mx-auto text-amber-600" size={24} />
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                      {importLog}
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 border-t border-border pt-3">
                <Button
                  variant="outline"
                  onClick={() => setIsOracleImportOpen(false)}
                  disabled={importingOracle}
                  className="font-bold text-xs"
                >
                  إلغاء
                </Button>
                <Button
                  onClick={handleOracleImportSubmit}
                  disabled={importingOracle}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-6 gap-1.5"
                >
                  {importingOracle ? "جاري الاستيراد..." : "بدء الاستيراد والربط الذكي"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
