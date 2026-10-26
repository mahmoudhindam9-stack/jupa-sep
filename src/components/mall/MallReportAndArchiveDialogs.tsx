// @ts-nocheck
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Archive, FileText, Printer, Upload } from "lucide-react";

const MONTHS_AR = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

export function MallReportAndArchiveDialogs({
  shops,
  treasuries,
  isTerminationModalOpen,
  setIsTerminationModalOpen,
  terminationForm,
  setTerminationForm,
  selectedShopForTermination,
  printTerminationContent,
  handleSaveTermination,
  isArchiveModalOpen,
  setIsArchiveModalOpen,
  terminatedArchive,
  isStatusReportModalOpen,
  setIsStatusReportModalOpen,
  reportShopId,
  setReportShopId,
  reportDate,
  setReportDate,
  reportData,
  handlePrintStatusReport,
}: any) {
  return (
    <>
      {/* TERMINATION MODAL */}
      <Dialog open={isTerminationModalOpen} onOpenChange={setIsTerminationModalOpen}>
        <DialogContent className="max-w-2xl text-right max-h-[90vh] overflow-y-auto">
          <DialogHeader className="text-right">
            <DialogTitle className="flex items-center gap-2 text-rose-600 text-lg font-black">
              <FileText size={20} />
              طباعة وفسخ عقد إيجار وتسليم المحل
            </DialogTitle>
            <DialogDescription className="text-xs">
              اختر المحل المرغوب فسخ تعاقده، حدد مبلغ التأمين المسترد، وارفع وثيقة الفسخ الموقعة
              لإتمام الأرشفة وتسوية القيود المحاسبية.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">
                اختر المحل / الوحدة (المؤجرة) *
              </label>
              <Select
                value={terminationForm.shop_id}
                onValueChange={(val) => {
                  const s = shops.find((sh: any) => sh.id === val);
                  setTerminationForm({
                    ...terminationForm,
                    shop_id: val,
                    refund_amount: s?.contract?.deposit_amount || 0,
                  });
                }}
              >
                <SelectTrigger className="rounded-xl font-bold">
                  <SelectValue placeholder="-- اختر المحل --" />
                </SelectTrigger>
                <SelectContent>
                  {shops
                    .filter((s: any) => s.status === "rented")
                    .map((shop: any) => (
                      <SelectItem key={shop.id} value={shop.id}>
                        #{shop.shop_number} - {shop.name_ar} (المستأجر:{" "}
                        {shop.tenant_name || "غير محدد"})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {selectedShopForTermination && (
              <div className="bg-muted/50 p-4 rounded-2xl border border-border space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2 font-bold">
                  <div>
                    اسم المستأجر:{" "}
                    <span className="font-black text-foreground">
                      {selectedShopForTermination.tenant_name}
                    </span>
                  </div>
                  <div>
                    رقم الهاتف:{" "}
                    <span className="font-mono">{selectedShopForTermination.phone || "---"}</span>
                  </div>
                  <div>
                    الإيجار الشهري:{" "}
                    <span className="font-mono text-emerald-600">
                      ${selectedShopForTermination.monthly_rent} USD
                    </span>
                  </div>
                  <div>
                    تأمين العقد الأصلي:{" "}
                    <span className="font-mono text-blue-600">
                      ${selectedShopForTermination.contract?.deposit_amount || 0} USD
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">
                مبلغ التأمين المسترد للعميل ($) *
              </label>
              <Input
                type="number"
                value={terminationForm.refund_amount}
                onChange={(e) =>
                  setTerminationForm({ ...terminationForm, refund_amount: Number(e.target.value) })
                }
                className="rounded-xl font-black text-rose-600 text-base"
              />
            </div>

            <div className="space-y-1.5 pt-2 border-t border-border">
              <label className="text-xs font-black text-foreground">
                خزينة / حساب صرف التأمين المرتجع:
              </label>
              <Select
                value={terminationForm.treasury_account_id}
                onValueChange={(v) =>
                  setTerminationForm({ ...terminationForm, treasury_account_id: v })
                }
              >
                <SelectTrigger className="rounded-xl font-bold bg-background">
                  <SelectValue placeholder="اختر الخزينة/الحساب..." />
                </SelectTrigger>
                <SelectContent>
                  {treasuries.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.account_code ? `[رقم الحساب: ${t.account_code}] ` : ""}
                      {t.name_ar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">
                ملاحظات تسليم المحل والفسخ:
              </label>
              <Textarea
                value={terminationForm.notes}
                onChange={(e) => setTerminationForm({ ...terminationForm, notes: e.target.value })}
                placeholder="أدخل أي ملاحظات تسليم (تسليم المفاتيح، فحص المرافق، خلو المحل من المديونيات)..."
                className="rounded-xl text-xs"
                rows={2}
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <label className="text-xs font-black text-foreground flex items-center gap-1.5">
                <Upload size={14} className="text-rose-600" />
                صورة محضر الفسخ وتوقيع المستأجر على استلام التأمين وتسليم المحل (مطلوب بشدة لإتمام
                الحفظ) *
                {terminationForm.termination_image && (
                  <span className="text-emerald-600 font-bold">✓ تم الرفع</span>
                )}
              </label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    const reader = new FileReader();
                    reader.onload = (ev) =>
                      setTerminationForm({
                        ...terminationForm,
                        termination_image: ev.target?.result as string,
                      });
                    reader.readAsDataURL(f);
                  }
                }}
                className="rounded-xl text-xs bg-background cursor-pointer"
              />
              {terminationForm.termination_image && (
                <div className="w-24 h-24 rounded-xl overflow-hidden border border-border mt-1">
                  <img
                    src={terminationForm.termination_image}
                    alt="Termination Signed Doc"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border flex-wrap">
            <Button
              variant="outline"
              className="rounded-xl font-bold cursor-pointer"
              onClick={() => setIsTerminationModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              variant="outline"
              disabled={!selectedShopForTermination}
              onClick={printTerminationContent}
              className="rounded-xl font-bold text-blue-600 border-blue-200 hover:bg-blue-50 gap-1.5 cursor-pointer"
            >
              <Printer size={15} />
              طباعة محضر الفسخ الرسمي
            </Button>
            <Button
              disabled={!terminationForm.shop_id || !terminationForm.termination_image}
              className="rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white gap-2 cursor-pointer disabled:opacity-50"
              onClick={handleSaveTermination}
            >
              حفظ الفسخ، الأرشفة، وتحويل المحل لفارغ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ARCHIVE MODAL */}
      <Dialog open={isArchiveModalOpen} onOpenChange={setIsArchiveModalOpen}>
        <DialogContent className="max-w-4xl text-right max-h-[90vh] overflow-y-auto">
          <DialogHeader className="text-right">
            <DialogTitle className="flex items-center gap-2 text-primary text-lg font-black">
              <Archive size={20} />
              أرشيف العقود وفسخ التعاقدات للمحلات
            </DialogTitle>
            <DialogDescription className="text-xs">
              سجل كامل للعقود المنتهية والمفسوخة، بيانات التأمين المسترد، ومحاضر التسليم الموقعة
              ومستنداتها.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {terminatedArchive.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground font-medium">
                لا توجد عقود مؤرشفة أو مفسوخة حتى الآن.
              </div>
            ) : (
              <div className="space-y-3">
                {terminatedArchive.map((item: any) => (
                  <div
                    key={item.id}
                    className="bg-card border border-border p-4 rounded-2xl shadow-sm space-y-3 text-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-2">
                      <div>
                        <h4 className="font-black text-sm text-foreground">
                          محل #{item.shop_number} - {item.shop_name}
                        </h4>
                        <p className="text-muted-foreground">
                          المستأجر:{" "}
                          <span className="font-bold text-foreground">{item.tenant_name}</span> |
                          الهاتف: {item.phone || "---"}
                        </p>
                      </div>
                      <div className="text-left font-mono">
                        <span className="bg-rose-50 text-rose-600 font-bold px-2.5 py-1 rounded-full text-[11px] border border-rose-200">
                          تاريخ الفسخ: {item.termination_date}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-bold text-foreground">
                      <div>
                        الإيجار الشهري: <span className="font-mono">${item.monthly_rent}</span>
                      </div>
                      <div>
                        التأمين الأصلي: <span className="font-mono">${item.deposit_amount}</span>
                      </div>
                      <div>
                        التأمين المسترد:{" "}
                        <span className="font-mono text-emerald-600">${item.refund_amount}</span>
                      </div>
                      <div>
                        فترة العقد:{" "}
                        <span className="font-mono text-[11px]">
                          {item.start_date} الى {item.end_date}
                        </span>
                      </div>
                    </div>
                    {item.notes && (
                      <p className="bg-muted/30 p-2.5 rounded-xl font-medium">
                        ملاحظات الفسخ: {item.notes}
                      </p>
                    )}
                    {item.termination_image && (
                      <div className="flex items-center gap-3 pt-2">
                        <span className="font-bold">مستند الفسخ والتسليم الموقع:</span>
                        <div className="w-16 h-16 rounded-xl overflow-hidden border border-border">
                          <img
                            src={item.termination_image}
                            alt="Termination Doc"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 border-t border-border">
            <Button
              className="rounded-xl font-bold cursor-pointer"
              onClick={() => setIsArchiveModalOpen(false)}
            >
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* STATUS REPORT MODAL */}
      <Dialog open={isStatusReportModalOpen} onOpenChange={setIsStatusReportModalOpen}>
        <DialogContent className="max-w-5xl text-right max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader className="text-right pb-2 border-b border-border/60">
            <DialogTitle className="flex items-center gap-2 text-emerald-600 text-lg font-black">
              <Printer size={20} />
              معاينة وطباعة تقرير حالة المول وعقود الإيجار
            </DialogTitle>
            <DialogDescription className="text-xs">
              قم بمراجعة تقرير سداد إيجارات المحلات وحالة العقود وتفاصيل المبالغ المتبقية قبل
              طباعتها أو تصديرها.
            </DialogDescription>
          </DialogHeader>

          {/* FILTERS SECTION */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-muted/40 p-4 rounded-2xl border border-border/80">
            <div className="space-y-1.5 text-xs">
              <label className="font-bold text-foreground">تصفية حسب المحل:</label>
              <Select value={reportShopId} onValueChange={setReportShopId}>
                <SelectTrigger className="w-full rounded-xl font-bold bg-background">
                  <SelectValue placeholder="اختر المحل..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل المحلات (تقرير عام)</SelectItem>
                  {shops.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      محل #{s.shop_number} - {s.name_ar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="font-bold text-foreground">
                تحديد تاريخ التقرير (الشهر/السنة):
              </label>
              <Input
                type="month"
                value={reportDate.substring(0, 7)}
                onChange={(e) => {
                  if (e.target.value) {
                    setReportDate(`${e.target.value}-01`);
                  }
                }}
                className="w-full rounded-xl bg-background font-bold text-xs"
              />
            </div>

            <div className="flex items-end justify-end">
              <Button
                onClick={handlePrintStatusReport}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black gap-2 rounded-xl h-10 shadow-sm cursor-pointer"
              >
                <Printer size={16} />
                طباعة هذا التقرير الآن
              </Button>
            </div>
          </div>

          {/* REPORT PREVIEW BODY */}
          <div className="border border-border rounded-2xl bg-white text-black p-6 space-y-6 shadow-inner overflow-x-auto select-none font-sans">
            {/* Document Header */}
            <div className="text-center border-b-2 border-emerald-600 pb-4">
              <h2 className="text-xl font-black text-emerald-800">
                {reportShopId === "all"
                  ? "تقرير حالة المول وعقود الإيجار العام"
                  : "تقرير حالة المحل وعقود الإيجار التفصيلي"}
              </h2>
              <p className="text-xs text-muted-foreground mt-1 font-bold">
                مركز التسوق التجاري والحديقة الترفيهية - قسم إدارة الأملاك
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 font-bold">
                لشهر: {MONTHS_AR[reportData.reportMonth - 1]} {reportData.reportYear} | تاريخ
                التقرير: {new Date().toLocaleDateString("ar-EG")}
              </p>
            </div>

            {reportShopId === "all" ? (
              <div className="space-y-4">
                <table className="w-full text-right border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-emerald-600 text-white border border-emerald-600">
                      <th className="p-2 border border-emerald-600">رقم المحل</th>
                      <th className="p-2 border border-emerald-600">النشاط والمستأجر</th>
                      <th className="p-2 border border-emerald-600 text-center">الحالة</th>
                      <th className="p-2 border border-emerald-600 text-left">قيمة الإيجار</th>
                      <th className="p-2 border border-emerald-600 text-left">المدفوع للشهر</th>
                      <th className="p-2 border border-emerald-600 text-left">المتبقي/المستحق</th>
                      <th className="p-2 border border-emerald-600">تفاصيل وسداد الدفعة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.rows.map((row: any) => (
                      <tr key={row.id} className="border-b border-gray-200 hover:bg-gray-50/50">
                        <td className="p-2 border border-gray-200 font-bold">#{row.shopNumber}</td>
                        <td className="p-2 border border-gray-200">
                          <div className="font-bold text-gray-900">{row.shopName}</div>
                          <div className="text-[10px] text-gray-500">{row.tenant}</div>
                        </td>
                        <td
                          className={`p-2 border border-gray-200 text-center font-bold text-[10px] ${
                            row.status === "rented"
                              ? "text-emerald-700"
                              : row.status === "vacant"
                                ? "text-amber-700"
                                : "text-rose-700"
                          }`}
                        >
                          {row.statusText}
                        </td>
                        <td className="p-2 border border-gray-200 text-left font-bold font-mono">
                          ${row.monthlyRent.toLocaleString()}
                        </td>
                        <td className="p-2 border border-gray-200 text-left text-emerald-700 font-bold font-mono">
                          ${row.amountPaid.toLocaleString()}
                        </td>
                        <td
                          className={`p-2 border border-gray-200 text-left font-bold font-mono ${row.outstanding > 0 ? "text-rose-600" : "text-gray-900"}`}
                        >
                          ${row.outstanding.toLocaleString()}
                        </td>
                        <td className="p-2 border border-gray-200 text-gray-600 text-[10px]">
                          {row.paymentDetails}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals Summary */}
                <div className="grid grid-cols-3 gap-4 bg-gray-100 p-4 rounded-xl border border-gray-200 text-center font-sans">
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold">
                      إجمالي المطالبات لشهر {MONTHS_AR[reportData.reportMonth - 1]}:
                    </span>
                    <h3 className="text-base font-black text-gray-900 font-mono">
                      ${reportData.totalRent.toLocaleString()}
                    </h3>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold">
                      إجمالي المحصل لشهر {MONTHS_AR[reportData.reportMonth - 1]}:
                    </span>
                    <h3 className="text-base font-black text-emerald-700 font-mono">
                      ${reportData.totalPaid.toLocaleString()}
                    </h3>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold">
                      إجمالي المتأخرات والمتبقي:
                    </span>
                    <h3 className="text-base font-black text-rose-600 font-mono">
                      ${reportData.totalOutstanding.toLocaleString()}
                    </h3>
                  </div>
                </div>
              </div>
            ) : (
              reportData.rows[0] && (
                <div className="space-y-4 text-xs text-gray-800">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-gray-200 p-4 rounded-xl bg-gray-50/50 space-y-1">
                      <h4 className="font-black text-emerald-800 text-sm border-b pb-1 mb-2">
                        بيانات المحل العامة
                      </h4>
                      <p>
                        <strong>رقم المحل والوحدة:</strong> #{reportData.rows[0].shopNumber}
                      </p>
                      <p>
                        <strong>اسم النشاط والوحدة:</strong> {reportData.rows[0].shopName}
                      </p>
                      <p>
                        <strong>حساب الأستاذ العام:</strong> {reportData.rows[0].accountNumber}
                      </p>
                      <p>
                        <strong>مساحة المحل:</strong> {reportData.rows[0].space} متر مربع
                      </p>
                      <p>
                        <strong>الحالة الحالية:</strong>{" "}
                        <span className="font-bold text-emerald-700">
                          {reportData.rows[0].statusText}
                        </span>
                      </p>
                    </div>

                    <div className="border border-gray-200 p-4 rounded-xl bg-gray-50/50 space-y-1">
                      <h4 className="font-black text-emerald-800 text-sm border-b pb-1 mb-2">
                        بيانات التعاقد والمستأجر
                      </h4>
                      <p>
                        <strong>اسم المستأجر:</strong> {reportData.rows[0].tenant}
                      </p>
                      <p>
                        <strong>رقم هاتف المستأجر:</strong> {reportData.rows[0].phone}
                      </p>
                      <p>
                        <strong>فترة سريان العقد:</strong> {reportData.rows[0].contractDates}
                      </p>
                      <p>
                        <strong>الإيجار الشهري المطلوب:</strong> $
                        {reportData.rows[0].monthlyRent.toLocaleString()} USD
                      </p>
                      {reportData.rows[0].contractInfo && (
                        <>
                          <p>
                            <strong>قيمة مبلغ التأمين:</strong> $
                            {(reportData.rows[0].contractInfo.deposit_amount || 0).toLocaleString()}{" "}
                            USD
                          </p>
                          <p>
                            <strong>شروط إضافية:</strong>{" "}
                            {reportData.rows[0].contractInfo.terms || "لا توجد"}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Selected Month Status */}
                  <div className="border border-emerald-100 bg-emerald-50/30 p-4 rounded-xl space-y-2">
                    <h4 className="font-black text-emerald-800 text-sm border-b border-emerald-100 pb-1">
                      حالة السداد والالتزام للدفعة المحددة ({MONTHS_AR[reportData.reportMonth - 1]}{" "}
                      {reportData.reportYear})
                    </h4>
                    <div className="grid grid-cols-3 gap-2 text-center py-1">
                      <div>
                        <span className="text-[10px] text-gray-500 font-bold">
                          الإيجار المستحق:
                        </span>
                        <p className="text-sm font-black font-mono text-gray-800">
                          ${reportData.rows[0].monthlyRent.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 font-bold">المبلغ المدفوع:</span>
                        <p className="text-sm font-black font-mono text-emerald-700">
                          ${reportData.rows[0].amountPaid.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 font-bold">
                          القيمة المتأخرة:
                        </span>
                        <p
                          className={`text-sm font-black font-mono ${reportData.rows[0].outstanding > 0 ? "text-rose-600" : "text-emerald-700"}`}
                        >
                          {reportData.rows[0].outstanding.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-500 border-t border-emerald-100/50 pt-1">
                      <strong>تفاصيل الدفعة:</strong> {reportData.rows[0].paymentDetails}
                    </div>
                  </div>

                  {/* Historical Payments Statement */}
                  <div className="space-y-2">
                    <h4 className="font-black text-gray-800 text-xs border-b pb-1">
                      كشف الحساب التاريخي لجميع الدفعات المسجلة للوحدة
                    </h4>
                    <table className="w-full text-right border-collapse text-[10px]">
                      <thead>
                        <tr className="bg-gray-100 border border-gray-200">
                          <th className="p-2 border border-gray-200">السنة / الشهر</th>
                          <th className="p-2 border border-gray-200 text-left">قيمة المستحق</th>
                          <th className="p-2 border border-gray-200 text-left">المبلغ المسدد</th>
                          <th className="p-2 border border-gray-200 text-center">الحالة</th>
                          <th className="p-2 border border-gray-200">رقم الإيصال</th>
                          <th className="p-2 border border-gray-200">تاريخ الدفع</th>
                          <th className="p-2 border border-gray-200">طريقة الدفع وملاحظات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.rows[0].allShopPayments.length === 0 ? (
                          <tr>
                            <td
                              colSpan={7}
                              className="p-4 border border-gray-200 text-center text-gray-400 italic"
                            >
                              لا توجد أي مبالغ سداد مسجلة مسبقاً لهذا المحل.
                            </td>
                          </tr>
                        ) : (
                          reportData.rows[0].allShopPayments.map((p: any) => (
                            <tr key={p.id} className="border-b border-gray-200">
                              <td className="p-2 border border-gray-200 font-bold">
                                {p.year} / {MONTHS_AR[p.month - 1]}
                              </td>
                              <td className="p-2 border border-gray-200 text-left font-bold font-mono">
                                ${(p.amount_due || reportData.rows[0].monthlyRent).toLocaleString()}
                              </td>
                              <td className="p-2 border border-gray-200 text-left text-emerald-700 font-bold font-mono">
                                ${(p.amount_paid || 0).toLocaleString()}
                              </td>
                              <td className="p-2 border border-gray-200 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
                                    p.status === "paid"
                                      ? "bg-emerald-50 text-emerald-700"
                                      : p.status === "partial"
                                        ? "bg-amber-50 text-amber-700"
                                        : "bg-rose-50 text-rose-700"
                                  }`}
                                >
                                  {p.status === "paid"
                                    ? "مسدد"
                                    : p.status === "partial"
                                      ? "جزئي"
                                      : "غير مسدد"}
                                </span>
                              </td>
                              <td className="p-2 border border-gray-200 font-mono">
                                {p.receipt_number || "-"}
                              </td>
                              <td className="p-2 border border-gray-200">
                                {p.payment_date || "-"}
                              </td>
                              <td className="p-2 border border-gray-200 text-gray-500 font-mono text-[9px]">
                                {p.payment_method === "cash" ? "نقدي" : "تحويل"}{" "}
                                {p.notes ? `[${p.notes}]` : ""}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            )}

            {/* Document Footer */}
            <div className="pt-8 flex justify-between px-10 text-[10px] text-gray-500 font-bold">
              <div>
                <p>توقيع المسؤول المالي</p>
                <div className="border-b border-dotted border-gray-400 w-32 mt-6"></div>
              </div>
              <div>
                <p>توقيع مدير إدارة الأملاك</p>
                <div className="border-b border-dotted border-gray-400 w-32 mt-6"></div>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-border flex justify-end gap-2">
            <Button
              className="rounded-xl font-bold cursor-pointer"
              variant="outline"
              onClick={() => setIsStatusReportModalOpen(false)}
            >
              إغلاق المعاينة
            </Button>
            <Button
              className="rounded-xl font-bold cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handlePrintStatusReport}
            >
              <Printer size={16} />
              طباعة التقرير
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
