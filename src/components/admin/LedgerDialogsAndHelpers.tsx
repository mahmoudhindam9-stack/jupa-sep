// @ts-nocheck
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
  Briefcase,
  Check,
  CheckCircle2,
  Edit,
  FileText,
  Lock,
  PlusCircle,
  Printer,
  Trash2,
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

      {/* Edit Journal Entry Dialog */}
      <Dialog open={isEditEntryOpen} onOpenChange={setIsEditEntryOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="text-right">
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-primary">
              <Edit className="h-5 w-5 text-primary" />
              تعديل القيد اليومي المحاسبي
            </DialogTitle>
            <DialogDescription>
              قم بتعديل بيانات القيد والأسطر مع التحقق الفوري من توازن أطراف القيد والعملات.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Journal Ref / Number */}
              <div className="space-y-1.5">
                <Label className="font-bold text-sm flex items-center gap-1">
                  رقم القيد (المرجع)
                  <span className="text-rose-500">*</span>
                </Label>
                <Input
                  value={editEntryRef}
                  onChange={(e) => setEditEntryRef(e.target.value)}
                  className="font-mono font-bold text-primary"
                  placeholder="01/02"
                />
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <Label className="font-bold text-sm flex items-center gap-1">
                  تاريخ القيد
                  <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={editEntryDate}
                  onChange={(e) => setEditEntryDate(e.target.value)}
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label className="font-bold text-sm flex items-center gap-1">
                  شرح وتوضيح القيد
                  <span className="text-rose-500">*</span>
                </Label>
                <Input
                  value={editEntryDesc}
                  onChange={(e) => setEditEntryDesc(e.target.value)}
                  placeholder="شرح القيد..."
                />
              </div>
            </div>

            <Separator />

            {/* Edit Entry Lines */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  أسطر الحركة المالية (أطراف القيد)
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setEditEntryLines([
                      ...editEntryLines,
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
                {editEntryLines.map((line: any, index: number) => (
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
                          placeholder="اختر حساب تشغيلي من الدرجة الرابعة..."
                        />
                      </div>

                      {/* Line Currency */}
                      <div className="md:col-span-2 space-y-1">
                        <Label className="text-xs font-semibold">العملة</Label>
                        <Select
                          value={line.currency || "USD"}
                          onValueChange={(val) => {
                            const lines = [...editEntryLines];
                            lines[index].currency = val;
                            setEditEntryLines(lines);
                          }}
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
                          onChange={(e) => {
                            const lines = [...editEntryLines];
                            lines[index].rate = Number(e.target.value) || 1;
                            setEditEntryLines(lines);
                          }}
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
                          className="bg-card h-9 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400"
                          value={line.debit || ""}
                          onChange={(e) => {
                            const lines = [...editEntryLines];
                            lines[index].debit = Number(e.target.value) || 0;
                            if (lines[index].debit > 0) lines[index].credit = 0;
                            setEditEntryLines(lines);
                          }}
                        />
                      </div>

                      {/* Credit */}
                      <div className="md:col-span-2 space-y-1">
                        <Label className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                          دائن (Credit)
                        </Label>
                        <div className="flex gap-1.5 items-center">
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0.00"
                            className="bg-card h-9 text-xs font-mono font-bold text-rose-700 dark:text-rose-400"
                            value={line.credit || ""}
                            onChange={(e) => {
                              const lines = [...editEntryLines];
                              lines[index].credit = Number(e.target.value) || 0;
                              if (lines[index].credit > 0) lines[index].debit = 0;
                              setEditEntryLines(lines);
                            }}
                          />
                          {editEntryLines.length > 2 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-destructive hover:bg-destructive/10 shrink-0"
                              onClick={() => {
                                const lines = [...editEntryLines];
                                lines.splice(index, 1);
                                setEditEntryLines(lines);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Edit Entry Totals Summary */}
              <div className="p-3.5 rounded-xl bg-card border shadow-xs space-y-2 mt-4">
                <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-medium">
                  <div>
                    <span className="text-muted-foreground block">إجمالي المدين (المعادل):</span>
                    <p className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      {editEntryTotals.debits.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      <span className="text-xs text-muted-foreground font-sans">USD</span>
                    </p>
                  </div>
                  <div className="border-r pr-6 border-border">
                    <span className="text-muted-foreground block">إجمالي الدائن (المعادل):</span>
                    <p className="text-sm font-bold font-mono text-rose-600 dark:text-rose-400">
                      {editEntryTotals.credits.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      <span className="text-xs text-muted-foreground font-sans">USD</span>
                    </p>
                  </div>
                  <div className="border-r pr-6 border-border">
                    <span className="text-muted-foreground block">الصافي / الفرق:</span>
                    <p
                      className={`text-sm font-bold font-mono ${
                        editEntryTotals.isBalanced
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {editEntryTotals.difference.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      <span className="text-xs font-sans">USD</span>
                    </p>
                  </div>
                  <div className="border-r pr-6 border-border">
                    <span className="text-muted-foreground block">حالة القيد:</span>
                    <Badge
                      className={`mt-0.5 text-xs font-semibold ${
                        editEntryTotals.isBalanced
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300"
                          : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300"
                      }`}
                    >
                      {editEntryTotals.isBalanced ? "متزن ✓" : "غير متزن ✗"}
                    </Badge>
                  </div>
                </div>

                {!editEntryTotals.isBalanced && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200 dark:border-amber-800">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>تنبيه: يجب توازن أطراف الحركة بالعملة الأساسية لحفظ التعديلات.</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsEditEntryOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleSaveEditEntry}
              disabled={
                !editEntryTotals.isBalanced || editEntryTotals.debits <= 0 || !editEntryDesc.trim()
              }
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
            >
              حفظ وتثبيت التعديلات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
