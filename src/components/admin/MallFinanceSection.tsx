// @ts-nocheck
import React, { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  Building2,
  CalendarCheck,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  Plus,
  Printer,
  Trash2,
  TrendingDown,
  Wallet,
} from "lucide-react";
import {
  erpStore,
  MallShop,
  MallRentalPayment,
  MallGardenExpense,
} from "@/shared/services/erpStore";
import { printRawHtml } from "@/shared/utils/printAccountingDocument";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ViewModeToggle, useViewMode } from "@/components/ui/view-mode-toggle";

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

export function MallFinanceSection() {
  const state = useSyncExternalStore(
    (cb) => erpStore.subscribe(cb),
    () => erpStore.getState(),
    () => erpStore.getState(),
  );

  const shops: MallShop[] = state.mallShops || [];
  const payments: MallRentalPayment[] = state.mallPayments || [];
  const gardenExpenses: MallGardenExpense[] = state.mallGardenExpenses || [];
  const treasuries = state.treasuries || [];

  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [activeSubSection, setActiveSubSection] = useState<"payments" | "expenses">("payments");
  const [viewMode, setViewMode] = useViewMode("ledger-mall-finance", "list");

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    shop_id: "",
    year: 2026,
    month: new Date().getMonth() + 1,
    amount_due: 0,
    amount_paid: 0,
    status: "paid" as "paid" | "partial" | "unpaid",
    payment_date: new Date().toISOString().split("T")[0],
    payment_method: "bank_transfer",
    receipt_number: "",
    notes: "",
    treasury_account_id: "",
  });

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    year: 2026,
    month: new Date().getMonth() + 1,
    category: "maintenance" as
      "maintenance" | "electricity" | "water" | "security" | "cleaning" | "salary" | "other",
    title: "",
    amount: 500,
    date: new Date().toISOString().split("T")[0],
    paid_to: "",
    notes: "",
    treasury_id: "",
  });
  const [expenseToDelete, setExpenseToDelete] = useState<MallGardenExpense | null>(null);

  const targetMonthStr = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
  const isAccrualGeneratedForMonth = (state.journalEntries || []).some(
    (je) =>
      je.reference === `MALL-RENT-ACCRUAL-${targetMonthStr}` ||
      je.reference?.startsWith(`MALL-RENT-ACCRUAL-${targetMonthStr}`) ||
      je.description?.includes(`قيد استحقاق إيجارات المحلات لشهر (${targetMonthStr})`) ||
      je.description?.includes(`قيد استحقاق إيجارات المحلات - شهر (${targetMonthStr})`) ||
      je.description?.includes(`MALL-RENT-ACCRUAL-${targetMonthStr}`),
  );

  const handleGenerateAccrual = () => {
    const result = erpStore.postMallRentAccrualJournal(targetMonthStr);
    if (result.alreadyGenerated) {
      toast.warning(result.message);
    } else if (!result.success) {
      toast.error(result.message);
    } else {
      toast.success(result.message);
    }
  };

  const handleOpenPayment = (shop: MallShop, monthNum?: number) => {
    const m = monthNum || selectedMonth;
    const existing = payments.find(
      (p) => p.shop_id === shop.id && p.year === selectedYear && p.month === m,
    );
    setPaymentForm({
      shop_id: shop.id,
      year: selectedYear,
      month: m,
      amount_due: shop.monthly_rent,
      amount_paid: existing ? existing.amount_paid : shop.monthly_rent,
      status: existing ? existing.status : "paid",
      payment_date: existing?.payment_date || new Date().toISOString().split("T")[0],
      payment_method: existing?.payment_method || "bank_transfer",
      receipt_number: existing?.receipt_number || `REC-${Math.floor(1000 + Math.random() * 9000)}`,
      notes: existing?.notes || "",
      treasury_account_id: "",
    });
    setIsPaymentModalOpen(true);
  };

  const handleSavePayment = () => {
    erpStore.recordMallPayment(paymentForm, paymentForm.treasury_account_id);
    toast.success("تم تسجيل الدفعة المالية وترحيل القيد المحاسبي بنجاح");
    setIsPaymentModalOpen(false);
  };

  const handleSaveAndPrintPayment = () => {
    erpStore.recordMallPayment(paymentForm, paymentForm.treasury_account_id);
    const shop = shops.find((s) => s.id === paymentForm.shop_id);
    if (shop) {
      const html = `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
          <head><meta charset="utf-8" /><title>سند قبض إيجار</title></head>
          <body style="font-family: system-ui, sans-serif; direction: rtl; padding: 24px;">
            <div style="max-width: 720px; margin: 0 auto; border: 1px solid #cbd5e1; padding: 24px; border-radius: 12px;">
              <h2 style="text-align: center;">${paymentForm.amount_paid < 0 ? "سند صرف (رد دفعة)" : "سند قبض إيجار ومستحقات"}</h2>
              <p><strong>رقم السند:</strong> ${paymentForm.receipt_number} | <strong>التاريخ:</strong> ${paymentForm.payment_date}</p>
              <p><strong>المستأجر:</strong> ${shop.tenant_name || "غير محدد"} | <strong>المحل:</strong> #${shop.shop_number} (${shop.name_ar})</p>
              <p><strong>المبلغ:</strong> $${Math.abs(paymentForm.amount_paid).toLocaleString()} USD</p>
            </div>
          </body>
        </html>
      `;
      printRawHtml(html);
    }
    setIsPaymentModalOpen(false);
  };

  const handleSaveExpense = () => {
    if (!expenseForm.title || expenseForm.amount <= 0) {
      toast.error("يرجى إدخال عنوان المصروف والمبلغ");
      return;
    }
    erpStore.addMallGardenExpense({
      ...expenseForm,
      year: selectedYear,
      month: selectedMonth,
    });
    toast.success("تم تسجيل المصروف وترحيل القيد المالي بنجاح");
    setIsExpenseModalOpen(false);
  };

  const currentMonthPayments = payments.filter(
    (p) => p.year === selectedYear && p.month === selectedMonth,
  );
  const totalCollectedThisMonth = currentMonthPayments.reduce((sum, p) => sum + p.amount_paid, 0);
  const totalDueThisMonth = shops
    .filter((s) => s.status === "rented")
    .reduce((sum, s) => sum + s.monthly_rent, 0);
  const monthGardenExpenses = gardenExpenses.filter(
    (e) => e.year === selectedYear && e.month === selectedMonth,
  );
  const totalGardenExpenseMonth = monthGardenExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netOperatingIncomeMonth = totalCollectedThisMonth - totalGardenExpenseMonth;

  const rentedShopsList = shops.filter((s) => s.status === "rented");

  return (
    <div className="space-y-6" dir="rtl">
      {/* Financial KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-border/80 bg-card shadow-xs rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">
              محصل الإيجارات ({MONTHS_AR[selectedMonth - 1]})
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
              <DollarSign size={18} />
            </div>
          </div>
          <h3 className="text-2xl font-black text-emerald-600 mt-2 font-mono">
            ${totalCollectedThisMonth.toLocaleString()}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-1">
            من إجمالي المستحق ${totalDueThisMonth.toLocaleString()}
          </p>
        </Card>

        <Card className="border border-border/80 bg-card shadow-xs rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">
              المصروفات التشغيلية ({MONTHS_AR[selectedMonth - 1]})
            </span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600">
              <TrendingDown size={18} />
            </div>
          </div>
          <h3 className="text-2xl font-black text-rose-600 mt-2 font-mono">
            ${totalGardenExpenseMonth.toLocaleString()}
          </h3>
        </Card>

        <Card className="border border-border/80 bg-card shadow-xs rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">صافي الدخل التشغيلي</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600">
              <Wallet size={18} />
            </div>
          </div>
          <h3
            className={`text-2xl font-black mt-2 font-mono ${
              netOperatingIncomeMonth >= 0 ? "text-indigo-600" : "text-rose-600"
            }`}
          >
            ${netOperatingIncomeMonth.toLocaleString()}
          </h3>
        </Card>
      </div>

      {/* Period Filter & Sub-navigation */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-card p-4 rounded-2xl border border-border">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant={activeSubSection === "payments" ? "default" : "outline"}
            onClick={() => setActiveSubSection("payments")}
            className="rounded-xl font-black text-xs h-9 px-4 cursor-pointer"
          >
            تحصيل الإيجارات والاستحقاق الشهري
          </Button>
          <Button
            size="sm"
            variant={activeSubSection === "expenses" ? "default" : "outline"}
            onClick={() => setActiveSubSection("expenses")}
            className="rounded-xl font-black text-xs h-9 px-4 cursor-pointer"
          >
            مصروفات المول والحديقة ({gardenExpenses.length})
          </Button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <ViewModeToggle mode={viewMode} onChange={setViewMode} />
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-[100px] h-9 rounded-xl font-bold text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2026">2026</SelectItem>
              <SelectItem value="2027">2027</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={selectedMonth.toString()}
            onValueChange={(v) => setSelectedMonth(Number(v))}
          >
            <SelectTrigger className="w-[120px] h-9 rounded-xl font-bold text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS_AR.map((m, idx) => (
                <SelectItem key={idx + 1} value={(idx + 1).toString()}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {activeSubSection === "payments" ? (
        <Card className="border border-border/80 bg-card rounded-2xl shadow-xs overflow-hidden">
          <CardHeader className="p-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <CardTitle className="text-base font-black text-foreground">
                تحصيل إيجارات شهر {MONTHS_AR[selectedMonth - 1]} {selectedYear}
              </CardTitle>
              {isAccrualGeneratedForMonth ? (
                <span className="text-[11px] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-3 py-1 rounded-full flex items-center gap-1 border border-emerald-500/30">
                  <CheckCircle2 size={13} />
                  قيود الاستحقاق مُولّدة
                </span>
              ) : (
                <span className="text-[11px] font-extrabold bg-amber-500/15 text-amber-700 dark:text-amber-300 px-3 py-1 rounded-full flex items-center gap-1 border border-amber-500/30">
                  <AlertCircle size={13} />
                  لم تُولد قيود الاستحقاق بعد
                </span>
              )}
            </div>

            <Button
              onClick={handleGenerateAccrual}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5 text-xs rounded-xl cursor-pointer"
            >
              <CalendarCheck size={15} />
              توليد قيود استحقاق الإيجار
            </Button>
          </CardHeader>

          <CardContent className="p-4">
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rentedShopsList.map((shop) => {
                  const payment = payments.find(
                    (p) =>
                      p.shop_id === shop.id && p.year === selectedYear && p.month === selectedMonth,
                  );
                  const status = payment ? payment.status : "unpaid";
                  const amountPaid = payment ? payment.amount_paid : 0;
                  return (
                    <Card
                      key={shop.id}
                      className="p-4 rounded-2xl border border-border/80 flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-sm text-foreground">
                          #{shop.shop_number} - {shop.name_ar}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                            status === "paid"
                              ? "bg-emerald-500/15 text-emerald-700"
                              : status === "partial"
                                ? "bg-amber-500/15 text-amber-700"
                                : "bg-rose-500/15 text-rose-700"
                          }`}
                        >
                          {status === "paid" ? "مسدد" : status === "partial" ? "جزئي" : "غير مسدد"}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        المستأجر:{" "}
                        <span className="font-bold text-foreground">{shop.tenant_name}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs border-t border-border/60 pt-2">
                        <span>المستحق: ${shop.monthly_rent.toLocaleString()}</span>
                        <span className="font-black text-emerald-600">
                          المدفوع: ${amountPaid.toLocaleString()}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleOpenPayment(shop, selectedMonth)}
                        className="w-full h-8 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                      >
                        {payment ? "تعديل الدفعة" : "تسجيل دفعة إيجار"}
                      </Button>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-x-auto -mx-4">
                <table className="w-full text-right text-xs">
                  <thead className="border-b border-border bg-muted/40 font-black text-muted-foreground">
                    <tr>
                      <th className="p-3">رقم المحل</th>
                      <th className="p-3">النشاط والمستأجر</th>
                      <th className="p-3">رقم الحساب</th>
                      <th className="p-3">القيمة المستحقة</th>
                      <th className="p-3">المبلغ المدفوع</th>
                      <th className="p-3 text-center">حالة السداد</th>
                      <th className="p-3 text-center">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rentedShopsList.map((shop) => {
                      const payment = payments.find(
                        (p) =>
                          p.shop_id === shop.id &&
                          p.year === selectedYear &&
                          p.month === selectedMonth,
                      );
                      const status = payment ? payment.status : "unpaid";
                      const amountPaid = payment ? payment.amount_paid : 0;
                      return (
                        <tr key={shop.id} className="hover:bg-muted/30 transition">
                          <td className="p-3 font-black text-foreground">#{shop.shop_number}</td>
                          <td className="p-3">
                            <div className="font-bold text-foreground">{shop.name_ar}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {shop.tenant_name}
                            </div>
                          </td>
                          <td className="p-3 font-mono font-bold text-primary">
                            {shop.account_number}
                          </td>
                          <td className="p-3 font-black text-foreground">
                            ${shop.monthly_rent.toLocaleString()}
                          </td>
                          <td className="p-3 font-black text-emerald-600">
                            ${amountPaid.toLocaleString()}
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                                status === "paid"
                                  ? "bg-emerald-500/15 text-emerald-700"
                                  : status === "partial"
                                    ? "bg-amber-500/15 text-amber-700"
                                    : "bg-rose-500/15 text-rose-700"
                              }`}
                            >
                              {status === "paid"
                                ? "مسدد"
                                : status === "partial"
                                  ? "جزئي"
                                  : "غير مسدد"}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs font-bold rounded-lg cursor-pointer"
                              onClick={() => handleOpenPayment(shop, selectedMonth)}
                            >
                              {payment ? "تعديل" : "تسجيل دفعة"}
                            </Button>
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
      ) : (
        <Card className="border border-border/80 bg-card rounded-2xl shadow-xs overflow-hidden">
          <CardHeader className="p-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base font-black text-foreground">
              مصروفات وتشغيل المول والحديقة
            </CardTitle>
            <Button
              onClick={() => {
                setExpenseForm({
                  year: selectedYear,
                  month: selectedMonth,
                  category: "maintenance",
                  title: "",
                  amount: 500,
                  date: new Date().toISOString().split("T")[0],
                  paid_to: "",
                  notes: "",
                  treasury_id: "",
                });
                setIsExpenseModalOpen(true);
              }}
              size="sm"
              className="bg-rose-600 hover:bg-rose-700 text-white font-black gap-1.5 rounded-xl text-xs cursor-pointer"
            >
              <Plus size={15} />
              إضافة مصروف جديد
            </Button>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="border-b border-border bg-muted/40 font-black text-muted-foreground">
                <tr>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">الشهر/السنة</th>
                  <th className="p-3">التصنيف</th>
                  <th className="p-3">البيان</th>
                  <th className="p-3">المستفيد</th>
                  <th className="p-3">المبلغ ($)</th>
                  <th className="p-3 text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {gardenExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-muted/30 transition">
                    <td className="p-3 font-bold text-foreground">{exp.date}</td>
                    <td className="p-3 text-muted-foreground">
                      {MONTHS_AR[exp.month - 1]} {exp.year}
                    </td>
                    <td className="p-3 font-bold">{exp.category}</td>
                    <td className="p-3 font-bold text-foreground">{exp.title}</td>
                    <td className="p-3 text-muted-foreground">{exp.paid_to || "-"}</td>
                    <td className="p-3 font-black text-rose-600">${exp.amount.toLocaleString()}</td>
                    <td className="p-3 text-center">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 text-destructive rounded-lg cursor-pointer"
                        onClick={() => setExpenseToDelete(exp)}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </td>
                  </tr>
                ))}
                {gardenExpenses.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-muted-foreground">
                      لا توجد مصروفات مسجلة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Payment Dialog */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="max-w-md text-right" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-lg font-black text-foreground">
              تسجيل تحصيل إيجار شهر {MONTHS_AR[paymentForm.month - 1]} {paymentForm.year}
            </DialogTitle>
            <DialogDescription className="text-xs">
              تسجيل دفعة الإيجار الشهرية وترحيل القيد المحاسبي.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-foreground">القيمة المستحقة للشهر ($)</label>
              <Input
                type="number"
                disabled
                value={paymentForm.amount_due}
                className="rounded-xl font-bold bg-muted"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-foreground">المبلغ المدفوع فعلياً ($) *</label>
              <Input
                type="number"
                value={paymentForm.amount_paid}
                onChange={(e) => {
                  const paid = Number(e.target.value);
                  const st =
                    paid >= paymentForm.amount_due ? "paid" : paid !== 0 ? "partial" : "unpaid";
                  setPaymentForm({ ...paymentForm, amount_paid: paid, status: st });
                }}
                className="rounded-xl font-black text-base text-emerald-600"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-foreground">خزينة / حساب التحصيل</label>
              <Select
                value={paymentForm.treasury_account_id}
                onValueChange={(v) => setPaymentForm({ ...paymentForm, treasury_account_id: v })}
              >
                <SelectTrigger className="rounded-xl font-bold bg-background">
                  <SelectValue placeholder="اختر الخزينة/الحساب..." />
                </SelectTrigger>
                <SelectContent>
                  {treasuries.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name_ar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-foreground">تاريخ السداد</label>
                <Input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-foreground">رقم سند الإيصال</label>
                <Input
                  value={paymentForm.receipt_number}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, receipt_number: e.target.value })
                  }
                  className="rounded-xl font-mono"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-xl font-bold"
              onClick={() => setIsPaymentModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              variant="outline"
              className="rounded-xl font-bold text-blue-600 gap-1.5 cursor-pointer"
              onClick={handleSaveAndPrintPayment}
            >
              <Printer size={15} />
              حفظ وطباعة السند
            </Button>
            <Button
              className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
              onClick={handleSavePayment}
            >
              حفظ وتأكيد السداد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expense Dialog */}
      <Dialog open={isExpenseModalOpen} onOpenChange={setIsExpenseModalOpen}>
        <DialogContent className="max-w-md text-right" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-lg font-black text-foreground">
              إضافة مصروف تشغيلي جديد
            </DialogTitle>
            <DialogDescription className="text-xs">
              تسجيل مصروفات الصيانة والتشغيل وترحيل القيد المحاسبي.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-foreground">عنوان المصروف / البيان *</label>
              <Input
                value={expenseForm.title}
                onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                placeholder="مثال: صيانة إنارة المول"
                className="rounded-xl font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-foreground">المبلغ ($) *</label>
                <Input
                  type="number"
                  value={expenseForm.amount}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, amount: Number(e.target.value) })
                  }
                  className="rounded-xl font-bold text-rose-600"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-foreground">التاريخ</label>
                <Input
                  type="date"
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-foreground">الخزينة / الحساب البنكي</label>
              <Select
                value={expenseForm.treasury_id}
                onValueChange={(v) => setExpenseForm({ ...expenseForm, treasury_id: v })}
              >
                <SelectTrigger className="rounded-xl font-bold bg-background">
                  <SelectValue placeholder="اختر الخزينة..." />
                </SelectTrigger>
                <SelectContent>
                  {treasuries.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name_ar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-xl font-bold"
              onClick={() => setIsExpenseModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              className="rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
              onClick={handleSaveExpense}
            >
              حفظ المصروف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Expense Confirmation */}
      <Dialog open={!!expenseToDelete} onOpenChange={(open) => !open && setExpenseToDelete(null)}>
        <DialogContent className="max-w-md text-right" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-destructive text-base font-black">
              تأكيد حذف المصروف
            </DialogTitle>
            <DialogDescription className="text-xs">
              هل أنت متأكد من حذف المصروف "{expenseToDelete?.title}"؟
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setExpenseToDelete(null)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (expenseToDelete) {
                  erpStore.deleteMallGardenExpense(expenseToDelete.id);
                  setExpenseToDelete(null);
                }
              }}
            >
              حذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
