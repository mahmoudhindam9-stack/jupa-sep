// @ts-nocheck
import { useState } from "react";
import * as XLSX from "xlsx";
import { erpStore, type Account, type JournalEntry } from "@/shared/services/erpStore";
import {
  printAccountingDocument,
  printImportReportDocument,
} from "@/shared/utils/printAccountingDocument";
import { AccountSearchSelect } from "@/components/AccountSearchSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  AlertTriangle,
  Briefcase,
  Check,
  CheckCircle2,
  Edit,
  FileText,
  Lock,
  PlusCircle,
  Printer,
  Scale,
  Trash2,
  X,
} from "lucide-react";

export const ACCOUNT_TYPE_LABELS: Record<Account["type"], string> = {
  asset: "أصول",
  liability: "التزامات",
  equity: "حقوق ملكية",
  revenue: "إيرادات",
  expense: "مصروفات",
};

export function buildLedgerPrintRows(entries: any[], accounts: any[]) {
  return (entries || []).map((entry) => ({
    date: entry.date || "-",
    reference: entry.reference || "-",
    description: entry.description || "-",
    currency: entry.currency || "EGP",
    debit: (entry.lines || []).reduce((n: number, l: any) => n + Number(l.debit || 0), 0),
    credit: (entry.lines || []).reduce((n: number, l: any) => n + Number(l.credit || 0), 0),
    accounts: (entry.lines || [])
      .map(
        (line: any) =>
          `${line.account_code || ""} — ${line.account_name || accounts.find((a: any) => a.code === line.account_code)?.name_ar || "حساب غير معرف"}`,
      )
      .join(" | "),
  }));
}

export function printLedgerDocument(rows: any[], accounting = false) {
  printAccountingDocument({
    title: accounting ? "مستند محاسبي — دفتر الأستاذ العام" : "تقرير القيود المحاسبية",
    subtitle: `عدد القيود: ${rows.length} | المصدر: دفتر الأستاذ العام الموحد`,
    documentNo: `LEDGER-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`,
    columns: [
      { key: "date", label: "التاريخ" },
      { key: "reference", label: "رقم القيد" },
      { key: "description", label: "البيان" },
      { key: "currency", label: "العملة", align: "center" },
      { key: "debit", label: "المدين", align: "left" },
      { key: "credit", label: "الدائن", align: "left" },
      { key: "accounts", label: "الحسابات وأكوادها" },
    ],
    rows,
    totals: [
      { label: "عدد القيود", value: String(rows.length) },
      {
        label: "إجمالي المدين",
        value: rows.reduce((n, r) => n + Number(r.debit || 0), 0).toLocaleString("en-US"),
      },
      {
        label: "إجمالي الدائن",
        value: rows.reduce((n, r) => n + Number(r.credit || 0), 0).toLocaleString("en-US"),
      },
    ],
  });
}

export function exportLedgerDocumentToExcel(rows: any[]) {
  const flat = rows.map((r) => ({
    التاريخ: r.date,
    "رقم القيد": r.reference,
    البيان: r.description,
    العملة: r.currency,
    المدين: r.debit,
    الدائن: r.credit,
    "الحسابات وأكوادها": r.accounts,
  }));
  if (!flat.length) {
    return;
  }
  const ws = XLSX.utils.json_to_sheet(flat);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "القيود");
  XLSX.writeFile(wb, `القيود_المحاسبية_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function LedgerBottomDialogs({
  isSaveReportOpen,
  setIsSaveReportOpen,
  saveReportData,
  checkIsEntryBalanced,
  isClearConfirmOpen,
  setIsClearConfirmOpen,
  handleClearAllJournals,
  isDeleteSingleOpen,
  setIsDeleteSingleOpen,
  entryToDelete,
  handleConfirmDeleteSingle,
  isClosedYearAlertOpen,
  setIsClosedYearAlertOpen,
  closedYearAlertMessage,
  isEditEntryOpen,
  setIsEditEntryOpen,
  editEntryRef,
  setEditEntryRef,
  editEntryDate,
  setEditEntryDate,
  editEntryDesc,
  setEditEntryDesc,
  editEntryLines,
  setEditEntryLines,
  level4Accounts,
  editEntryTotals,
  handleSaveEditEntry,
}: any) {
  const [isEditExitConfirmOpen, setIsEditExitConfirmOpen] = useState(false);
  const [isEditSaveConfirmOpen, setIsEditSaveConfirmOpen] = useState(false);

  const handleAutoBalanceEditEntry = () => {
    const diffBase = Number(editEntryTotals?.difference || 0);
    if (diffBase <= 0.001) return;
    const needDebit = Number(editEntryTotals.credits) > Number(editEntryTotals.debits);
    const updated = [...editEntryLines];
    const emptyIdx = updated.findIndex(
      (l: any) => (Number(l.debit) || 0) === 0 && (Number(l.credit) || 0) === 0,
    );

    if (emptyIdx !== -1) {
      const rate = Number(updated[emptyIdx].rate) || 1;
      const curr = updated[emptyIdx].currency || "USD";
      const targetAmount = Number((curr === "USD" ? diffBase : diffBase * rate).toFixed(2));
      updated[emptyIdx] = {
        ...updated[emptyIdx],
        side: needDebit ? "debit" : "credit",
        debit: needDebit ? targetAmount : 0,
        credit: needDebit ? 0 : targetAmount,
      };
    } else {
      updated.push({
        account_code: "",
        side: needDebit ? "debit" : "credit",
        debit: needDebit ? Number(diffBase.toFixed(2)) : 0,
        credit: needDebit ? 0 : Number(diffBase.toFixed(2)),
        description: editEntryDesc || "",
        currency: "USD",
        rate: 1,
      });
    }
    setEditEntryLines(updated);
  };

  return (
    <>
      {/* Save Success and Detailed Report Dialog */}
      <Dialog open={isSaveReportOpen} onOpenChange={setIsSaveReportOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader className="text-right">
            <DialogTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xl font-bold">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              تقرير حفظ وتثبيت القيود في قاعدة البيانات
            </DialogTitle>
            <DialogDescription className="text-sm">
              تم حفظ كافة القيود ومزامنة شجرة الحسابات بنجاح في قاعدة البيانات والتخزين الدائم.
            </DialogDescription>
          </DialogHeader>

          {saveReportData && (
            <div className="space-y-4 my-2">
              {/* KPI Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/50 text-center">
                  <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium block">
                    القيود المحفوظة
                  </span>
                  <span className="text-2xl font-black font-mono text-emerald-800 dark:text-emerald-200">
                    {saveReportData.savedEntriesCount}
                  </span>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block mt-0.5 font-medium">
                    ({saveReportData.balancedEntriesCount} متزن -{" "}
                    {saveReportData.unbalancedEntriesCount} غير متزن)
                  </span>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950/30 p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/50 text-center">
                  <span className="text-xs text-blue-700 dark:text-blue-300 font-medium block">
                    الحسابات الجديدة المضافة
                  </span>
                  <span className="text-2xl font-black font-mono text-blue-800 dark:text-blue-200">
                    {saveReportData.newAccountsCreated}
                  </span>
                  <span className="text-[11px] text-blue-600 dark:text-blue-400 block mt-0.5 font-medium">
                    إجمالي الحسابات: {saveReportData.totalAccountsCount}
                  </span>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/30 p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/50 text-center">
                  <span className="text-xs text-amber-700 dark:text-amber-300 font-medium block">
                    حركات الخزائن المربوطة
                  </span>
                  <span className="text-2xl font-black font-mono text-amber-800 dark:text-amber-200">
                    {saveReportData.linkedTreasuryTransactions}
                  </span>
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 block mt-0.5 font-medium">
                    حركة خزينة فورية
                  </span>
                </div>

                <div className="bg-indigo-50 dark:bg-indigo-950/30 p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-900/50 text-center">
                  <span className="text-xs text-indigo-700 dark:text-indigo-300 font-medium block">
                    الإجمالي بالدولار (USD)
                  </span>
                  <span className="text-2xl font-black font-mono text-indigo-800 dark:text-indigo-200">
                    $
                    {saveReportData.totalBaseUSD?.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <span className="text-[11px] text-indigo-600 dark:text-indigo-400 block mt-0.5 font-medium">
                    توقيت الحفظ: {saveReportData.savedAt}
                  </span>
                </div>
              </div>

              {/* Tabbed Report Details */}
              <Tabs
                defaultValue={saveReportData.newAccountsCreated > 0 ? "accounts" : "entries"}
                className="w-full"
              >
                <TabsList className="grid grid-cols-2 w-full max-w-md">
                  <TabsTrigger value="entries" className="gap-2">
                    <FileText className="h-4 w-4" />
                    تقرير القيود ({saveReportData.savedEntriesCount})
                  </TabsTrigger>
                  <TabsTrigger value="accounts" className="gap-2">
                    <Briefcase className="h-4 w-4" />
                    الحسابات المضافة ({saveReportData.newAccountsCreated})
                  </TabsTrigger>
                </TabsList>

                {/* Tab 1: Saved Entries Report */}
                <TabsContent value="entries" className="space-y-3 pt-2">
                  <div className="border rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full text-xs text-right">
                      <thead className="bg-muted/60 font-bold border-b sticky top-0">
                        <tr>
                          <th className="p-2.5 pr-4">#</th>
                          <th className="p-2.5">رقم القيد / المرجع</th>
                          <th className="p-2.5">التاريخ</th>
                          <th className="p-2.5">شرح القيد المحاسبي</th>
                          <th className="p-2.5">العملات</th>
                          <th className="p-2.5 text-center">الإجمالي (USD)</th>
                          <th className="p-2.5 text-center">حالة الاتزان</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {saveReportData.savedEntries.map((je: JournalEntry, i: number) => {
                          const isB = checkIsEntryBalanced(je);
                          const currList = Array.from(
                            new Set(
                              (je.lines || []).map((l) => l.currency || je.currency || "USD"),
                            ),
                          );
                          const baseTotal = (je.lines || []).reduce((s, l) => {
                            return (
                              s +
                              erpStore.getLineBaseValue(
                                l.debit,
                                l.rate || 1,
                                l.currency || je.currency || "USD",
                              )
                            );
                          }, 0);

                          return (
                            <tr key={je.id ? `${je.id}-${i}` : i} className="hover:bg-muted/20">
                              <td className="p-2.5 pr-4 font-mono text-muted-foreground">
                                {i + 1}
                              </td>
                              <td className="p-2.5 font-black font-mono text-indigo-700 dark:text-indigo-400">
                                {je.reference || je.id}
                              </td>
                              <td className="p-2.5 font-mono text-muted-foreground">{je.date}</td>
                              <td className="p-2.5 font-medium max-w-xs truncate">
                                {je.description}
                              </td>
                              <td className="p-2.5">
                                <div className="flex gap-1 flex-wrap">
                                  {currList.map((c) => (
                                    <Badge
                                      key={c}
                                      variant="outline"
                                      className="text-[10px] px-1 py-0 font-mono"
                                    >
                                      {c}
                                    </Badge>
                                  ))}
                                </div>
                              </td>
                              <td className="p-2.5 text-center font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                $
                                {baseTotal.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              <td className="p-2.5 text-center">
                                <Badge
                                  className={`text-[10px] ${
                                    isB
                                      ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300"
                                      : "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300"
                                  }`}
                                >
                                  {isB ? "متزن ✓" : "غير متزن ⚠️"}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                {/* Tab 2: New Accounts Report */}
                <TabsContent value="accounts" className="space-y-3 pt-2">
                  {saveReportData.newlyCreatedAccounts &&
                  saveReportData.newlyCreatedAccounts.length > 0 ? (
                    <div className="border rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                      <table className="w-full text-xs text-right">
                        <thead className="bg-muted/60 font-bold border-b sticky top-0">
                          <tr>
                            <th className="p-2.5 pr-4">كود الحساب</th>
                            <th className="p-2.5">اسم الحساب المحاسبي</th>
                            <th className="p-2.5">نوع وتصنيف الحساب</th>
                            <th className="p-2.5">العملة</th>
                            <th className="p-2.5 text-center">الحالة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {saveReportData.newlyCreatedAccounts.map((acc: Account, i: number) => (
                            <tr key={acc.code || i} className="hover:bg-muted/20">
                              <td className="p-2.5 pr-4 font-mono font-bold text-primary">
                                {acc.code}
                              </td>
                              <td className="p-2.5 font-semibold text-foreground">{acc.name_ar}</td>
                              <td className="p-2.5">
                                <Badge variant="outline" className="text-[10px]">
                                  {ACCOUNT_TYPE_LABELS[acc.type] || acc.type}
                                </Badge>
                              </td>
                              <td className="p-2.5 font-mono text-muted-foreground">
                                {acc.currency || "USD"}
                              </td>
                              <td className="p-2.5 text-center">
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                                  حساب جديد مضاف ✓
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-muted-foreground border rounded-xl bg-muted/20">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                      <p className="font-semibold text-sm">
                        كافة حسابات القيود مسجلة بالفعل في دليل الحسابات.
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        تم ربط أسطر القيود بالحسابات المالية المعنية ومطابقتها بنجاح.
                      </p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}

          <DialogFooter className="gap-2 justify-between sm:justify-between items-center w-full pt-2">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  printImportReportDocument(saveReportData);
                }}
                className="gap-1.5 rounded-xl text-xs font-semibold"
              >
                <Printer className="h-4 w-4" />
                طباعة التقرير
              </Button>
            </div>
            <Button
              onClick={() => setIsSaveReportOpen(false)}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              <Check className="h-4 w-4 mr-1.5" />
              تم الإغلاق والمتابعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear All Journal Entries Confirmation Dialog */}
      <AlertDialog open={isClearConfirmOpen} onOpenChange={setIsClearConfirmOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right flex items-center gap-2 text-rose-600">
              <AlertCircle className="h-5 w-5 text-rose-600" />
              تأكيد مسح جميع القيود المحاسبية
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right leading-relaxed">
              هل أنت متأكد من رغبتك في مسح وتفريغ جميع القيود من دفتر اليومية العامة والذاكرة
              بالكامل؟
              <br />
              <span className="font-semibold text-rose-600 dark:text-rose-400">
                ⚠️ تنبيه: هذه العملية ستفرغ دفتر اليومية وتصفر الحركات الناتجة عنها. لن تتمكن من
                التراجع عن هذه الخطوة.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-start gap-2 pt-2">
            <AlertDialogAction
              onClick={handleClearAllJournals}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl"
            >
              نعم، امسح كل القيود الآن
            </AlertDialogAction>
            <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Single Journal Entry Confirmation Dialog */}
      <AlertDialog open={isDeleteSingleOpen} onOpenChange={setIsDeleteSingleOpen}>
        <AlertDialogContent className="rounded-2xl text-right">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle className="text-right flex items-center gap-2 text-rose-600">
              <Trash2 className="h-5 w-5 text-rose-600" />
              تأكيد حذف القيد المحاسبي
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right leading-relaxed">
              هل أنت متأكد من رغبتك في حذف هذا القيد المحاسبي رقم{" "}
              <strong className="font-mono text-foreground font-bold">
                {entryToDelete?.reference || entryToDelete?.id}
              </strong>
              ؟
              <br />
              <span className="text-muted-foreground block mt-1">
                البيان: {entryToDelete?.description}
              </span>
              <span className="text-xs text-rose-600 dark:text-rose-400 font-semibold block mt-1">
                ⚠️ سيتم حذف القيد من الدفاتر وإعادة احتساب وتحديث أرصدة الحسابات وميزان المراجعة
                فوراً.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-start gap-2 pt-2">
            <AlertDialogAction
              onClick={handleConfirmDeleteSingle}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl"
            >
              نعم، احذف القيد
            </AlertDialogAction>
            <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Closed Year / Period Alert Dialog */}
      <AlertDialog open={isClosedYearAlertOpen} onOpenChange={setIsClosedYearAlertOpen}>
        <AlertDialogContent className="rounded-2xl text-right max-w-lg border-amber-300 dark:border-amber-700">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle className="text-right flex items-center gap-2 text-amber-600 dark:text-amber-400 text-lg font-bold">
              <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              تنبيه: السنة / الفترة المالية مقفلة
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-right text-sm leading-relaxed text-foreground/90 pt-2 space-y-2">
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900/50">
                  <p className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                    {closedYearAlertMessage || "You cannot edit restrictions in a closed year."}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  لحماية سلامة السجلات المالية ومطابقتها للمعايير المحاسبية، يتم منع إضافة أو تعديل
                  أو حذف القيود التي تقع في فترات أو سنوات مالية مقفلة.
                </p>
                <p className="text-xs text-muted-foreground">
                  إذا كنت مديراً للنظام وترغب في فتح السنة للتعديل، يمكنك ذلك عبر صفحة إدارة
                  المستخدمين والصلاحيات.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end gap-2 pt-2">
            <AlertDialogAction
              onClick={() => setIsClosedYearAlertOpen(false)}
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold"
            >
              حسناً، فهمت ذلك
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Journal Entry Dialog — Unified Accounting Voucher */}
      <Dialog
        open={isEditEntryOpen}
        onOpenChange={(open) => {
          if (open) {
            setIsEditEntryOpen(true);
          } else {
            setIsEditExitConfirmOpen(true);
          }
        }}
      >
        <DialogContent
          className="w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] lg:w-[calc(100vw-4rem)] max-w-6xl max-h-[92vh] overflow-y-auto overflow-x-hidden p-0 gap-0 border-2 border-primary/20 shadow-2xl rounded-2xl"
          dir="rtl"
        >
          <div className="bg-card text-card-foreground flex flex-col min-w-0 w-full">
            <DialogHeader className="text-right px-4 sm:px-6 py-3.5 sm:py-4 bg-gradient-to-l from-primary/10 via-primary/5 to-transparent border-b border-border">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pl-8">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="p-1.5 sm:p-2 rounded-xl bg-primary/15 text-primary shrink-0">
                      <Edit className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <DialogTitle className="text-base sm:text-xl font-black tracking-tight text-foreground">
                      تعديل سند القيد اليومي الموحد
                    </DialogTitle>
                    <Badge
                      variant="outline"
                      className="font-mono font-bold text-[11px] sm:text-xs bg-background border-primary/30 text-primary px-2 py-0.5"
                    >
                      مرجع السند: {editEntryRef || "تلقائي"}
                    </Badge>
                    <Badge
                      className={`text-[11px] sm:text-xs font-bold px-2 py-0.5 ${
                        editEntryTotals.isBalanced
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                          : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                      }`}
                    >
                      {editEntryTotals.isBalanced
                        ? `متزن ✓ (${editEntryLines.length} أسطر)`
                        : `غير متزن — فرق ${editEntryTotals.difference.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`}
                    </Badge>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsEditExitConfirmOpen(true)}
                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 self-end sm:self-auto"
                  title="إغلاق النافذة"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </DialogHeader>

            <div className="p-3 sm:p-5 space-y-4 min-w-0">
              <div className="rounded-2xl border-2 border-border bg-background shadow-sm overflow-hidden min-w-0">
                {/* Metadata Strip */}
                <div className="p-3 sm:p-4 bg-muted/30 border-b border-border">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-start">
                    <div className="sm:col-span-1 lg:col-span-3 space-y-1 min-w-0">
                      <Label className="font-bold text-xs flex items-center gap-1">
                        رقم القيد (المرجع) <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        value={editEntryRef}
                        onChange={(e) => setEditEntryRef(e.target.value)}
                        className="h-9 font-mono font-bold text-primary bg-card text-xs w-full"
                        placeholder="01/02"
                      />
                    </div>

                    <div className="sm:col-span-1 lg:col-span-3 space-y-1 min-w-0">
                      <Label className="font-bold text-xs flex items-center gap-1">
                        تاريخ القيد <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        type="date"
                        value={editEntryDate}
                        onChange={(e) => setEditEntryDate(e.target.value)}
                        className="h-9 font-mono bg-card text-xs w-full"
                      />
                    </div>

                    <div className="sm:col-span-2 lg:col-span-6 space-y-1 min-w-0">
                      <Label className="font-bold text-xs flex items-center gap-1">
                        البيان والشرح العام للقيد <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        value={editEntryDesc}
                        onChange={(e) => setEditEntryDesc(e.target.value)}
                        placeholder="شرح القيد..."
                        className="h-9 bg-card text-xs font-medium w-full"
                      />
                    </div>
                  </div>
                </div>

                {/* A. Mobile & Small Tablet Unified Lines List (< md) */}
                <div className="block md:hidden divide-y divide-border">
                  {editEntryLines.map((line: any, index: number) => {
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
                    const lineBaseUsd = erpStore.getLineBaseValue(
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
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-muted font-mono font-bold text-xs text-muted-foreground">
                              #{index + 1}
                            </span>
                            <Select
                              value={lineSide}
                              onValueChange={(val) => {
                                const lines = [...editEntryLines];
                                const nextSide = val === "credit" ? "credit" : "debit";
                                const currentAmt =
                                  Number(lines[index].debit) || Number(lines[index].credit) || 0;
                                lines[index] = {
                                  ...lines[index],
                                  side: nextSide,
                                  debit: nextSide === "debit" ? currentAmt : 0,
                                  credit: nextSide === "credit" ? currentAmt : 0,
                                };
                                setEditEntryLines(lines);
                              }}
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
                              disabled={editEntryLines.length <= 2}
                              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                              onClick={() => {
                                const lines = [...editEntryLines];
                                lines.splice(index, 1);
                                setEditEntryLines(lines);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        <div>
                          <AccountSearchSelect
                            value={line.account_code}
                            onChange={(code, acc) => {
                              const lines = [...editEntryLines];
                              lines[index].account_code = code;
                              if (acc) {
                                let detectedCurrency = acc.currency || "USD";
                                if (acc.name_ar.includes("دولار") || acc.name_ar.includes("USD")) {
                                  detectedCurrency = "USD";
                                } else if (
                                  acc.name_ar.includes("سوداني") ||
                                  acc.name_ar.includes("SSP")
                                ) {
                                  detectedCurrency = "SSP";
                                } else if (
                                  acc.name_ar.includes("مصري") ||
                                  acc.name_ar.includes("EGP")
                                ) {
                                  detectedCurrency = "EGP";
                                }
                                lines[index].currency = detectedCurrency;
                              }
                              setEditEntryLines(lines);
                            }}
                            accounts={level4Accounts}
                            level4Only={true}
                            placeholder={`اختر حساب السطر #${index + 1}...`}
                          />
                        </div>

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
                              onChange={(e) => {
                                const lines = [...editEntryLines];
                                const amt = Math.max(0, Number(e.target.value) || 0);
                                lines[index] = {
                                  ...lines[index],
                                  side: lineSide,
                                  debit: lineSide === "debit" ? amt : 0,
                                  credit: lineSide === "credit" ? amt : 0,
                                };
                                setEditEntryLines(lines);
                              }}
                            />
                          </div>

                          <div className="col-span-3 space-y-0.5">
                            <Label className="text-[10px] text-muted-foreground">العملة</Label>
                            <Select
                              value={line.currency || "USD"}
                              onValueChange={(val) => {
                                const lines = [...editEntryLines];
                                lines[index].currency = val;
                                if (val === "USD") lines[index].rate = 1;
                                setEditEntryLines(lines);
                              }}
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
                              onChange={(e) => {
                                const lines = [...editEntryLines];
                                lines[index].rate = Number(e.target.value) || 1;
                                setEditEntryLines(lines);
                              }}
                            />
                          </div>
                        </div>

                        <div>
                          <Input
                            placeholder={`بيان / ملاحظة السطر #${index + 1}...`}
                            value={line.description || ""}
                            onChange={(e) => {
                              const lines = [...editEntryLines];
                              lines[index].description = e.target.value;
                              setEditEntryLines(lines);
                            }}
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
                          الحساب المحاسبي (الدرجة الرابعة) <span className="text-rose-500">*</span>
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
                          بيان السطر
                        </th>
                        <th className="py-2.5 px-1.5 w-10 text-center">حذف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70 text-xs">
                      {editEntryLines.map((line: any, index: number) => {
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
                        const lineBaseUsd = erpStore.getLineBaseValue(
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
                            <td className="py-2 px-1.5 text-center font-mono font-bold text-muted-foreground border-l border-border/50 bg-muted/20">
                              {index + 1}
                            </td>

                            <td className="py-2 px-1.5 border-l border-border/50 align-middle">
                              <Select
                                value={lineSide}
                                onValueChange={(val) => {
                                  const lines = [...editEntryLines];
                                  const nextSide = val === "credit" ? "credit" : "debit";
                                  const currentAmt =
                                    Number(lines[index].debit) || Number(lines[index].credit) || 0;
                                  lines[index] = {
                                    ...lines[index],
                                    side: nextSide,
                                    debit: nextSide === "debit" ? currentAmt : 0,
                                    credit: nextSide === "credit" ? currentAmt : 0,
                                  };
                                  setEditEntryLines(lines);
                                }}
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

                            <td className="py-2 px-2 border-l border-border/50 align-middle">
                              <AccountSearchSelect
                                value={line.account_code}
                                onChange={(code, acc) => {
                                  const lines = [...editEntryLines];
                                  lines[index].account_code = code;
                                  if (acc) {
                                    let detectedCurrency = acc.currency || "USD";
                                    if (
                                      acc.name_ar.includes("دولار") ||
                                      acc.name_ar.includes("USD")
                                    ) {
                                      detectedCurrency = "USD";
                                    } else if (
                                      acc.name_ar.includes("سوداني") ||
                                      acc.name_ar.includes("SSP")
                                    ) {
                                      detectedCurrency = "SSP";
                                    } else if (
                                      acc.name_ar.includes("مصري") ||
                                      acc.name_ar.includes("EGP")
                                    ) {
                                      detectedCurrency = "EGP";
                                    }
                                    lines[index].currency = detectedCurrency;
                                  }
                                  setEditEntryLines(lines);
                                }}
                                accounts={level4Accounts}
                                level4Only={true}
                                placeholder={`اختر حساب السطر #${index + 1}...`}
                              />
                            </td>

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
                                  onChange={(e) => {
                                    const lines = [...editEntryLines];
                                    const amt = Math.max(0, Number(e.target.value) || 0);
                                    lines[index] = {
                                      ...lines[index],
                                      side: lineSide,
                                      debit: lineSide === "debit" ? amt : 0,
                                      credit: lineSide === "credit" ? amt : 0,
                                    };
                                    setEditEntryLines(lines);
                                  }}
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

                            <td className="py-2 px-1.5 border-l border-border/50 align-middle">
                              <Select
                                value={line.currency || "USD"}
                                onValueChange={(val) => {
                                  const lines = [...editEntryLines];
                                  lines[index].currency = val;
                                  if (val === "USD") lines[index].rate = 1;
                                  setEditEntryLines(lines);
                                }}
                              >
                                <SelectTrigger className="bg-card h-9 w-[66px] text-xs font-mono font-bold px-1.5 justify-center">
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
                            </td>

                            <td className="py-2 px-1.5 border-l border-border/50 align-middle">
                              <Input
                                type="number"
                                min="0.0001"
                                step="any"
                                placeholder="1"
                                disabled={(line.currency || "USD") === "USD"}
                                className="bg-card h-9 text-xs font-mono text-center px-1"
                                value={line.rate !== undefined ? line.rate : 1}
                                onChange={(e) => {
                                  const lines = [...editEntryLines];
                                  lines[index].rate = Number(e.target.value) || 1;
                                  setEditEntryLines(lines);
                                }}
                              />
                            </td>

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

                            <td className="py-2 px-2 border-l border-border/50 align-middle">
                              <Input
                                placeholder={`ملاحظة السطر #${index + 1}...`}
                                value={line.description || ""}
                                onChange={(e) => {
                                  const lines = [...editEntryLines];
                                  lines[index].description = e.target.value;
                                  setEditEntryLines(lines);
                                }}
                                className="bg-card h-9 text-xs px-2"
                              />
                            </td>

                            <td className="py-2 px-1 text-center align-middle">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={editEntryLines.length <= 2}
                                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                                onClick={() => {
                                  const lines = [...editEntryLines];
                                  lines.splice(index, 1);
                                  setEditEntryLines(lines);
                                }}
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

                {/* Attached Action Strip */}
                <div className="bg-muted/25 border-t border-border px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const lastLine = editEntryLines[editEntryLines.length - 1];
                        const suggestedSide =
                          Number(editEntryTotals.debits) > Number(editEntryTotals.credits)
                            ? "credit"
                            : "debit";
                        setEditEntryLines([
                          ...editEntryLines,
                          {
                            account_code: "",
                            side: suggestedSide,
                            debit: 0,
                            credit: 0,
                            description: "",
                            currency: lastLine?.currency || "USD",
                            rate: lastLine?.rate || 1,
                          },
                        ]);
                      }}
                      className="gap-1.5 rounded-xl border-primary/40 text-primary hover:bg-primary/10 font-bold text-xs h-8"
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      إضافة سطر جديد في نفس القيد
                    </Button>

                    {!editEntryTotals.isBalanced && editEntryTotals.difference > 0 && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleAutoBalanceEditEntry}
                        className="gap-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/30 font-bold text-xs h-8"
                      >
                        <Scale className="h-3.5 w-3.5" />
                        موازنة الفرق تلقائياً (
                        {editEntryTotals.difference.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        USD)
                      </Button>
                    )}
                  </div>

                  <span className="text-[11px] text-muted-foreground">
                    عدد أسطر السند:{" "}
                    <strong className="text-foreground font-mono">
                      {editEntryLines.length}
                    </strong>{" "}
                    أسطر مترابطة
                  </span>
                </div>

                {/* Integrated Totals Strip */}
                <div
                  className={`border-t-2 border-border px-3 sm:px-4 py-3 text-xs ${
                    editEntryTotals.isBalanced
                      ? "bg-emerald-500/[0.06]"
                      : "bg-amber-500/[0.08]"
                  }`}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
                    <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground">إجمالي سند القيد (USD):</span>
                      <Badge
                        className={`text-[11px] font-bold ${
                          editEntryTotals.isBalanced
                            ? "bg-emerald-600 text-white"
                            : "bg-rose-600 text-white"
                        }`}
                      >
                        {editEntryTotals.isBalanced ? "متزن ✓" : "غير متزن ⚠️"}
                      </Badge>
                    </div>

                    <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-around gap-3 bg-background/60 rounded-xl px-3 py-2 border border-border/60 font-mono">
                      <div>
                        <span className="font-sans text-[11px] text-muted-foreground block">
                          إجمالي المدين (USD):
                        </span>
                        <span className="font-black text-sm text-emerald-700 dark:text-emerald-400">
                          {editEntryTotals.debits.toLocaleString(undefined, {
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
                          {editEntryTotals.credits.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          <span className="text-[10px] font-sans">USD</span>
                        </span>
                      </div>
                    </div>

                    <div className="sm:col-span-2 lg:col-span-4">
                      {editEntryTotals.isBalanced ? (
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                          ✓ الجانبان المدين والدائن متساويان
                        </span>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-300 font-bold text-xs">
                          ⚠️ فرق التوازن:{" "}
                          {editEntryTotals.difference.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          USD
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 px-4 sm:px-6 py-3.5 sm:py-4 bg-muted/30 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditExitConfirmOpen(true)}
                className="w-full sm:w-auto rounded-xl text-xs font-bold text-rose-600 border-rose-200 hover:bg-rose-50"
              >
                إلغاء / خروج
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (editEntryTotals.isBalanced) {
                    handleSaveEditEntry(false);
                  } else {
                    setIsEditSaveConfirmOpen(true);
                  }
                }}
                className={`w-full sm:w-auto rounded-xl font-black text-xs sm:text-sm px-5 py-2.5 text-white shadow-md gap-2 ${
                  editEntryTotals.isBalanced
                    ? "bg-primary hover:bg-primary/90"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {editEntryTotals.isBalanced
                  ? "✓ حفظ وتثبيت التعديلات"
                  : "⚠️ حفظ التعديلات (غير متزن)"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Entry Unbalanced Save Confirmation */}
      <AlertDialog open={isEditSaveConfirmOpen} onOpenChange={setIsEditSaveConfirmOpen}>
        <AlertDialogContent
          className="w-[calc(100vw-1.5rem)] sm:w-full max-w-md text-right rounded-2xl border-2 border-amber-500/40 p-5 sm:p-6"
          dir="rtl"
        >
          <AlertDialogHeader className="text-right space-y-2">
            <AlertDialogTitle className="text-base font-black flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              <span>تنبيه: القيد المعدل غير متزن!</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed text-right">
              يوجد فرق قدره{" "}
              <strong className="font-mono text-rose-600">
                {editEntryTotals.difference.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                USD
              </strong>{" "}
              بين المدين والدائن. ماذا تريد أن تفعل؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full pt-3">
            <Button
              type="button"
              onClick={() => {
                setIsEditSaveConfirmOpen(false);
                handleSaveEditEntry(true);
              }}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl h-10"
            >
              تأكيد الحفظ
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsEditSaveConfirmOpen(false);
                handleAutoBalanceEditEntry();
              }}
              className="w-full border-primary/40 text-primary font-bold text-xs rounded-xl h-10"
            >
              موازنة تلقائية
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditSaveConfirmOpen(false)}
              className="w-full rounded-xl font-bold text-xs h-10"
            >
              رجوع للتعديل
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Entry Exit Confirmation */}
      <AlertDialog open={isEditExitConfirmOpen} onOpenChange={setIsEditExitConfirmOpen}>
        <AlertDialogContent
          className="w-[calc(100vw-1.5rem)] sm:w-full max-w-md text-right rounded-2xl border-2 border-amber-500/30 p-5 sm:p-6"
          dir="rtl"
        >
          <AlertDialogHeader className="text-right space-y-2">
            <AlertDialogTitle className="text-base font-black flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              <span>تأكيد الخروج من تعديل القيد</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed text-right">
              هل تريد تجاهل التعديلات الحالية والخروج أم متابعة التحرير؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsEditExitConfirmOpen(false);
                setIsEditEntryOpen(false);
              }}
              className="w-full text-rose-600 border-rose-300 hover:bg-rose-50 font-bold text-xs rounded-xl h-10 gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5 shrink-0" />
              <span>تجاهل التعديلات</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditExitConfirmOpen(false)}
              className="w-full rounded-xl font-bold text-xs h-10"
            >
              إلغاء الأمر
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
