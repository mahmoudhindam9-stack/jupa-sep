// @ts-nocheck
import { erpStore } from "@/shared/services/erpStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeftRight, FileSpreadsheet, Printer, Sparkles } from "lucide-react";

export function getOrderCurrency(order: any, erpTransactions?: any[]): string {
  if (!order) return "EGP";
  const txs = erpTransactions || erpStore.getState().treasuryTransactions;
  if (order.order_number && Array.isArray(txs)) {
    const invTx = txs.find(
      (tx) =>
        tx.related_entity_id === `INV-${order.order_number}` ||
        (typeof tx.note === "string" && tx.note.includes(`طلب رقم #${order.order_number}`)),
    );
    if (invTx && invTx.currency) return invTx.currency;
  }
  if (order.currency) return order.currency;
  if (order.notes) {
    const match = String(order.notes).match(/العملة:\s*([A-Za-z]+)/);
    if (match && match[1]) return match[1];
  }
  return "EGP";
}

export function getOrderOriginalAmount(
  order: any,
  _rates?: Record<string, number>,
  erpTransactions?: any[],
): number {
  if (!order || order.total === undefined || order.total === null) return 0;
  const txs = erpTransactions || erpStore.getState().treasuryTransactions;
  if (order.order_number && Array.isArray(txs)) {
    const invTx = txs.find(
      (tx) =>
        tx.related_entity_id === `INV-${order.order_number}` ||
        (typeof tx.note === "string" && tx.note.includes(`طلب رقم #${order.order_number}`)),
    );
    if (invTx && Number(invTx.amount) > 0) {
      return Number(invTx.amount);
    }
  }
  return Number(order.total);
}

export function CashierTreasuryModals({
  lang,
  exchangeRates,
  erpState,
  cashierTreasuryId,
  refundOrderDialog,
  setRefundOrderDialog,
  refundReason,
  setRefundReason,
  refundTreasury,
  setRefundTreasury,
  refundContainer,
  setRefundContainer,
  customRefundAmount,
  customRefundCurrency,
  customRefundPaymentMethod,
  refundMutation,
  transferDialogOpen,
  setTransferDialogOpen,
  transferTargetTreasury,
  setTransferTargetTreasury,
  transferAmount,
  setTransferAmount,
  shiftSalesAmount,
  transferCurrency,
  setTransferCurrency,
  transferPaymentMethod,
  setTransferPaymentMethod,
  handleTransferMoney,
  exportDialogOpen,
  setExportDialogOpen,
  activePreset,
  setActivePreset,
  applyQuickDate,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  filteredTransactionsCount,
  exportToExcel,
  showReportPreview,
  setShowReportPreview,
  reportData,
  handleConfirmPrint,
}: any) {
  return (
    <>
      {/* Rebuilt Refund Confirmation Dialog Linked directly to Order Currency */}
      {refundOrderDialog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in duration-200 text-right">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <span className="bg-rose-100 text-rose-800 text-xs font-black px-2.5 py-1 rounded-lg">
                مرتجع مالي
              </span>
              <h3 className="text-lg font-black text-slate-900">
                مرتجع الطلب #{refundOrderDialog.order_number}
              </h3>
            </div>

            {/* Order Currency Banner */}
            <div className="bg-slate-900 text-white p-4 rounded-2xl mb-4 border border-slate-800 shadow-inner">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-400 font-bold">المبلغ الكلي المسترجع</span>
                <span className="text-xs bg-emerald-500/20 text-emerald-300 font-mono font-bold px-2 py-0.5 rounded border border-emerald-500/30">
                  عملة رسمية للطلب:{" "}
                  {getOrderCurrency(refundOrderDialog, erpState.treasuryTransactions)}
                </span>
              </div>
              <div className="text-2xl font-black font-mono text-emerald-400 flex items-center gap-2">
                <span>
                  {getOrderOriginalAmount(
                    refundOrderDialog,
                    exchangeRates,
                    erpState.treasuryTransactions,
                  ).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className="text-sm text-slate-300 font-sans font-bold">
                  {getOrderCurrency(refundOrderDialog, erpState.treasuryTransactions)}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2 border-t border-slate-800 pt-2 flex items-center gap-1">
                <span>🔒</span>
                <span>
                  يتم إجراء المرتجع وحسم الخزينة وعكس القيد بنفس عملة الطلب دون تأثر بالتغيير بين
                  العملات.
                </span>
              </p>
            </div>

            {/* Order Items Breakdown */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 mb-4 max-h-36 overflow-y-auto">
              <span className="text-xs font-black text-slate-700 block mb-2">
                اصناف الطلب المراد إرجاعها للمخزن:
              </span>
              <div className="space-y-1 text-xs text-slate-800">
                {(() => {
                  const rawItems = refundOrderDialog.items;
                  const itemsList = Array.isArray(rawItems)
                    ? rawItems
                    : typeof rawItems === "string"
                      ? (() => {
                          try {
                            return JSON.parse(rawItems);
                          } catch {
                            return [];
                          }
                        })()
                      : [];
                  return itemsList.map((it: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-1 border-b border-slate-200/60 last:border-0"
                    >
                      <span className="font-bold">{it.name_ar || it.name || "صنف"}</span>
                      <span className="font-mono text-emerald-700 font-black">
                        x{it.quantity || 1}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {/* Reason for Return */}
              <div>
                <label className="text-xs font-bold block mb-1 text-slate-700">سبب المرتجع</label>
                <select
                  className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                >
                  <option value="طلب العميل إلغاء الوجبة">طلب العميل إلغاء الوجبة</option>
                  <option value="خطأ في اختيار الاصناف">خطأ في اختيار الاصناف</option>
                  <option value="تأخير في تقديم الخدمة">تأخير في تقديم الخدمة</option>
                  <option value="عيوب في جودة الطعام">عيوب في جودة الطعام</option>
                  <option value="أخرى">سبب آخر</option>
                </select>
              </div>

              {/* Target Treasury */}
              <div>
                <label className="text-xs font-bold block mb-1 text-slate-700">
                  الخزينة المستهدفة
                </label>
                <select
                  className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={refundTreasury}
                  onChange={(e) => {
                    setRefundTreasury(e.target.value);
                    setRefundContainer("");
                  }}
                >
                  {erpState.treasuries
                    .filter((t: any) => !t.deleted && t.is_open && t.linked_to_restaurant)
                    .map((tr: any) => (
                      <option key={tr.id} value={tr.id}>
                        {tr.name_ar}
                      </option>
                    ))}
                </select>
              </div>

              {/* Matching Container */}
              {erpState.treasuries.find((t: any) => t.id === refundTreasury)?.containers?.length ? (
                <div>
                  <label className="text-xs font-bold block mb-1 text-emerald-800 flex items-center justify-between">
                    <span>وعاء الخزينة (Container)</span>
                    <span className="text-[10px] text-emerald-600 font-mono">
                      عملة الطلب:{" "}
                      {getOrderCurrency(refundOrderDialog, erpState.treasuryTransactions)}
                    </span>
                  </label>
                  <select
                    className="w-full h-10 rounded-xl border border-emerald-300 bg-emerald-50/70 px-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={refundContainer}
                    onChange={(e) => setRefundContainer(e.target.value)}
                  >
                    <option value="">-- اختر وعاء الخزينة --</option>
                    {erpState.treasuries
                      .find((t: any) => t.id === refundTreasury)
                      ?.containers?.map((cnt: any) => (
                        <option key={cnt.id} value={cnt.id}>
                          {cnt.name} ({cnt.currency}){" "}
                          {cnt.currency === getOrderCurrency(refundOrderDialog)
                            ? "⭐ العملة المطابقة للطلب"
                            : ""}
                        </option>
                      ))}
                  </select>
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => setRefundOrderDialog(null)}
                className="rounded-xl font-bold border-slate-300 text-slate-700 px-5"
              >
                إلغاء
              </Button>
              <Button
                variant="destructive"
                className="rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white px-5 shadow-xs"
                disabled={
                  refundMutation.isPending ||
                  (erpState.treasuries.find((t: any) => t.id === refundTreasury)?.containers
                    ?.length > 0 &&
                    !refundContainer)
                }
                onClick={() => {
                  refundMutation.mutate({
                    order: refundOrderDialog,
                    treasuryId: refundTreasury,
                    containerId: refundContainer,
                    reason: refundReason,
                    amount: customRefundAmount,
                    currency: customRefundCurrency,
                    paymentMethod: customRefundPaymentMethod,
                  });
                }}
              >
                {refundMutation.isPending ? "جاري الاسترجاع..." : "تأكيد وإتمام المرتجع المالي"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer / End Shift Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent
          className="max-w-lg w-full bg-white text-slate-900 border-slate-200 rounded-2xl p-6"
          dir={lang === "ar" ? "rtl" : "ltr"}
        >
          <DialogHeader className={lang === "ar" ? "text-right" : "text-left"}>
            <DialogTitle className="text-xl font-black text-slate-800 flex items-center gap-2">
              <ArrowLeftRight className="text-purple-600" />
              {lang === "ar" ? "تحويل نقدية / إنهاء الشيفت" : "Transfer Money / End Shift"}
            </DialogTitle>
            <DialogDescription className="text-slate-500 font-semibold text-sm">
              {lang === "ar"
                ? "قم بتحديد الخزينة المستهدفة والمبلغ لتحويل العهدة وإقفال الشيفت."
                : "Select target treasury and amount to transfer funds and end shift."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-xs font-bold block mb-1 text-slate-700">
                {lang === "ar" ? "الخزينة المستهدفة (محول إليها)" : "Target Treasury"}
              </label>
              <select
                className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                value={transferTargetTreasury}
                onChange={(e) => setTransferTargetTreasury(e.target.value)}
              >
                <option value="">
                  {lang === "ar" ? "-- اختر الخزينة --" : "-- Select Treasury --"}
                </option>
                {erpState.treasuries
                  .filter((t: any) => !t.deleted && t.id !== cashierTreasuryId)
                  .map((tr: any) => (
                    <option key={tr.id} value={tr.id}>
                      {tr.name_ar} (الرصيد: {tr.balance.toLocaleString()} {tr.currency})
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold block mb-1 text-slate-700">
                  {lang === "ar" ? "المبلغ" : "Amount"}
                </label>
                <Input
                  type="number"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(Number(e.target.value))}
                  className="w-full h-10 rounded-xl font-bold"
                  min={0}
                />
                <button
                  type="button"
                  onClick={() => setTransferAmount(shiftSalesAmount)}
                  className="mt-1 text-[11px] font-black text-purple-700 hover:text-purple-900 underline underline-offset-2"
                >
                  ملء من إجمالي مبيعات الشيفت: {shiftSalesAmount.toLocaleString()}{" "}
                  {transferCurrency}
                </button>
              </div>
              <div>
                <label className="text-xs font-bold block mb-1 text-slate-700">
                  {lang === "ar" ? "العملة" : "Currency"}
                </label>
                <select
                  value={transferCurrency}
                  onChange={(e) => setTransferCurrency(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="EGP">جنيه مصري (EGP)</option>
                  <option value="USD">دولار أمريكي (USD)</option>
                  <option value="SSP">جنيه ج.س (SSP)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold block mb-1 text-slate-700">
                {lang === "ar" ? "طريقة الدفع" : "Payment Method"}
              </label>
              <select
                value={transferPaymentMethod}
                onChange={(e) => setTransferPaymentMethod(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="cash">كاش (نقدي)</option>
                <option value="card">بطاقة بنكية (فيزا)</option>
                <option value="wallet">محفظة إلكترونية</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => setTransferDialogOpen(false)}
              className="rounded-xl font-bold border-slate-300 text-slate-700 px-5"
            >
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              className="rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white px-5 shadow-xs"
              onClick={handleTransferMoney}
            >
              {lang === "ar" ? "تأكيد التحويل" : "Confirm Transfer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Report & Date Filter Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-lg w-full bg-white text-slate-900 border-slate-200 rounded-2xl p-6">
          <DialogHeader className="text-right">
            <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="text-emerald-600" size={22} />
              {lang === "ar" ? "تصدير تقرير الخزينة إلى Excel" : "Export Treasury Report"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">
              {lang === "ar"
                ? "حدد النطاق الزمني واضغط تصدير لتحميل ملف الحركات المالية المخصصة."
                : "Select date range and click export to download your custom transaction report."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Sparkles size={14} className="text-indigo-600" />
                {lang === "ar" ? "خيارات الملئ السريع لـ التاريخ:" : "Quick Date Presets:"}
              </label>

              <div className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  type="button"
                  variant={activePreset === "today" ? "default" : "outline"}
                  onClick={() => applyQuickDate("today")}
                  className={`text-xs h-8 px-3 font-bold rounded-lg ${
                    activePreset === "today"
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                      : "bg-slate-50 border-slate-200 text-slate-700"
                  }`}
                >
                  اليوم
                </Button>

                <Button
                  size="sm"
                  type="button"
                  variant={activePreset === "yesterday" ? "default" : "outline"}
                  onClick={() => applyQuickDate("yesterday")}
                  className={`text-xs h-8 px-3 font-bold rounded-lg ${
                    activePreset === "yesterday"
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                      : "bg-slate-50 border-slate-200 text-slate-700"
                  }`}
                >
                  الأمس
                </Button>

                <Button
                  size="sm"
                  type="button"
                  variant={activePreset === "last7" ? "default" : "outline"}
                  onClick={() => applyQuickDate("last7")}
                  className={`text-xs h-8 px-3 font-bold rounded-lg ${
                    activePreset === "last7"
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                      : "bg-slate-50 border-slate-200 text-slate-700"
                  }`}
                >
                  آخر 7 أيام
                </Button>

                <Button
                  size="sm"
                  type="button"
                  variant={activePreset === "thisMonth" ? "default" : "outline"}
                  onClick={() => applyQuickDate("thisMonth")}
                  className={`text-xs h-8 px-3 font-bold rounded-lg ${
                    activePreset === "thisMonth"
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                      : "bg-slate-50 border-slate-200 text-slate-700"
                  }`}
                >
                  هذا الشهر
                </Button>

                <Button
                  size="sm"
                  type="button"
                  variant={activePreset === "lastMonth" ? "default" : "outline"}
                  onClick={() => applyQuickDate("lastMonth")}
                  className={`text-xs h-8 px-3 font-bold rounded-lg ${
                    activePreset === "lastMonth"
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                      : "bg-slate-50 border-slate-200 text-slate-700"
                  }`}
                >
                  الشهر السابق
                </Button>

                <Button
                  size="sm"
                  type="button"
                  variant={activePreset === "all" ? "default" : "outline"}
                  onClick={() => applyQuickDate("all")}
                  className={`text-xs h-8 px-3 font-bold rounded-lg ${
                    activePreset === "all"
                      ? "bg-slate-800 text-white"
                      : "bg-slate-50 border-slate-200 text-slate-700"
                  }`}
                >
                  كل الحركات
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {lang === "ar" ? "من تاريخ" : "From Date"}
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setActivePreset("custom");
                  }}
                  className="bg-slate-50 border-slate-300 text-slate-900 text-xs h-9 rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {lang === "ar" ? "إلى تاريخ" : "To Date"}
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setActivePreset("custom");
                  }}
                  className="bg-slate-50 border-slate-300 text-slate-900 text-xs h-9 rounded-xl"
                />
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-xs font-bold text-emerald-800 flex justify-between items-center">
              <span>{lang === "ar" ? "عدد الحركات المشمولة:" : "Included Transactions:"}</span>
              <span className="font-mono text-sm font-black text-emerald-900">
                {filteredTransactionsCount} حركة
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => setExportDialogOpen(false)}
              className="rounded-xl font-bold border-slate-300 text-slate-700"
            >
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={() => {
                exportToExcel();
                setExportDialogOpen(false);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl gap-2 shadow-xs"
            >
              <FileSpreadsheet size={16} />
              <span>{lang === "ar" ? "تحميل التقرير الأن" : "Download Excel"}</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showReportPreview} onOpenChange={setShowReportPreview}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{lang === "ar" ? "معاينة التقرير" : "Report Preview"}</DialogTitle>
          </DialogHeader>
          {reportData && (
            <div className="space-y-6 text-sm">
              <div className="text-center space-y-1 border-b pb-4">
                <h2 className="text-xl font-bold">{reportData.title}</h2>
                <p className="text-muted-foreground">{reportData.subtitle}</p>
                <p className="text-xs text-muted-foreground">
                  رقم المستند: {reportData.documentNo}
                </p>
              </div>

              {reportData.totals && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {reportData.totals.map((t: any, i: number) => (
                    <div
                      key={i}
                      className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center"
                    >
                      <div className="text-xs text-slate-500 mb-1">{t.label}</div>
                      <div className="text-lg font-bold text-slate-900">{t.value}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 border-b">
                    <tr>
                      {reportData.columns?.map((col: any) => (
                        <th
                          key={col.key}
                          className="p-2 font-semibold text-slate-700"
                          style={{ textAlign: col.align || "right" }}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {reportData.rows?.length > 0 ? (
                      reportData.rows.map((row: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50">
                          {reportData.columns?.map((col: any) => (
                            <td
                              key={col.key}
                              className="p-2"
                              style={{ textAlign: col.align || "right" }}
                            >
                              {row[col.key]}
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={reportData.columns?.length || 1}
                          className="p-4 text-center text-slate-500"
                        >
                          لا توجد حركات
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {reportData.categorizedSales &&
                Object.keys(reportData.categorizedSales).length > 0 && (
                  <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                    <h3 className="font-bold text-emerald-800 mb-3 border-b border-emerald-200 pb-2">
                      المبيعات حسب الفئة
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(reportData.categorizedSales).map(
                        ([cat, data]: [string, any]) => (
                          <div
                            key={cat}
                            className="flex justify-between items-center text-emerald-900"
                          >
                            <span className="font-medium">{cat}</span>
                            <div className="flex gap-4 text-xs">
                              <span className="bg-white px-2 py-1 rounded shadow-sm">
                                {data.qty} قطعة
                              </span>
                              <span className="bg-white px-2 py-1 rounded shadow-sm font-bold">
                                {data.total.toFixed(2)} EGP
                              </span>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}

              <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-white p-2">
                <Button variant="outline" onClick={() => setShowReportPreview(false)}>
                  إلغاء
                </Button>
                <Button
                  onClick={handleConfirmPrint}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                >
                  <Printer size={16} />
                  طباعة التقرير
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
