import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Landmark, Printer, RotateCcw, Lock, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { erpStore } from "@/shared/services/erpStore";
import { canCurrentUserCloseShift } from "@/shared/services/userAuthorization";
import { printRawHtml } from "@/shared/utils/printAccountingDocument";

const formatTicketPrice = (usd: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(usd);
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenCloseShift?: () => void;
}

export function ParkCashierTreasuryModal({ isOpen, onClose, onOpenCloseShift }: Props) {
  const [refundTxId, setRefundTxId] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [voidTxId, setVoidTxId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("حذف تذكرة/إيصال بالخطأ أثناء الوردية المفتوحة (Void)");
  const [, setRefreshTick] = useState(0);
  const state = erpStore.getState();
  const activeShift = erpStore.getActiveParkShift();
  const canCloseShift = canCurrentUserCloseShift();

  const shiftTransactions = useMemo(() => {
    if (!activeShift) return [];
    return (state.parkTicketTransactions || []).filter((tx) => tx.shift_id === activeShift.id);
  }, [state.parkTicketTransactions, activeShift]);

  const totalUsd = useMemo(() => {
    return shiftTransactions
      .filter((tx) => tx.currency === "USD" && tx.status !== "refunded")
      .reduce((sum, tx) => sum + tx.total_paid_in_currency, 0);
  }, [shiftTransactions]);

  const totalSsp = useMemo(() => {
    return shiftTransactions
      .filter((tx) => tx.currency === "SSP" && tx.status !== "refunded")
      .reduce((sum, tx) => sum + tx.total_paid_in_currency, 0);
  }, [shiftTransactions]);

  const handlePrintReport = () => {
    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>تقرير خزينة الكاشير</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body { font-family: 'Tajawal', sans-serif, system-ui; padding: 20px; font-size: 12px; color: #000; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; text-align: right; }
          th, td { border: 1px solid #ccc; padding: 8px; }
          th { background: #f3f4f6; font-weight: bold; }
          .header { text-align: center; margin-bottom: 20px; }
          .header h2 { font-size: 18px; margin: 0 0 5px 0; }
          .summary { display: flex; justify-content: space-between; margin-bottom: 20px; font-weight: bold; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>تقرير خزينة الكاشير - وردية #${activeShift?.shift_number}</h2>
          <p>تاريخ الطباعة: ${new Date().toLocaleString("ar-EG")}</p>
        </div>
        <div class="summary">
          <div>إجمالي الخزينة (USD): ${formatTicketPrice(totalUsd)}</div>
          <div>إجمالي الخزينة (SSP): ${totalSsp.toLocaleString()} SSP</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>رقم الفاتورة</th>
              <th>الوقت</th>
              <th>طريقة الدفع</th>
              <th>المبلغ</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${shiftTransactions
              .map(
                (tx) => `
              <tr>
                <td>${tx.tx_number}</td>
                <td>${tx.transaction_time}</td>
                <td>${tx.payment_method === "cash" ? "نقدي" : tx.payment_method === "visa" ? "فيزا" : tx.payment_method === "bank_transfer" ? "تحويل" : "آجل"}</td>
                <td>${tx.currency === "USD" ? `${tx.total_paid_in_currency}` : `${tx.total_paid_in_currency.toLocaleString()} SSP`}</td>
                <td>${tx.status === "refunded" ? "مرتجع" : "مكتملة"}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </body>
      </html>
    `;
    printRawHtml(html);
  };

  const handleRefund = (txId: string) => {
    setRefundTxId(txId);
    setRefundReason("");
  };

  const confirmRefund = () => {
    if (!refundTxId || !refundReason.trim()) {
      toast.error("يرجى كتابة سبب الإرجاع");
      return;
    }
    try {
      erpStore.refundParkTicketTransaction(refundTxId, refundReason.trim());
      toast.success("تم إرجاع التذكرة وتسوية الخزينة بنجاح");
      setRefundTxId(null);
      setRefundReason("");
      setRefreshTick((t) => t + 1);
    } catch (e: any) {
      toast.error(e?.message || "تعذر تنفيذ الإرجاع");
    }
  };

  const handleVoid = (txId: string) => {
    setVoidTxId(txId);
    setVoidReason("حذف تذكرة/إيصال بالخطأ أثناء الوردية المفتوحة (Void)");
  };

  const confirmVoid = () => {
    if (!voidTxId || !voidReason.trim()) {
      toast.error("يرجى كتابة سبب الحذف (Void)");
      return;
    }
    try {
      erpStore.voidParkTicketTransaction(voidTxId, voidReason.trim());
      toast.success("تم حذف الإيصال/الفاتورة (Void) من الوردية المفتوحة مع حفظ العملية في سجل العمليات");
      setVoidTxId(null);
      setVoidReason("");
      setRefreshTick((t) => t + 1);
    } catch (e: any) {
      toast.error(e?.message || "تعذر حذف الفاتورة (Void)");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl p-4 sm:p-5 rounded-3xl">
        <DialogHeader className="pb-2 border-b border-border/60">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DialogTitle className="text-base font-black flex items-center gap-2 text-primary">
              <Landmark size={18} />
              <span>خزينة الكاشير - وردية #{activeShift?.shift_number}</span>
            </DialogTitle>

            {activeShift && (
              <div className="flex items-center gap-1.5">
                <Button
                  onClick={handlePrintReport}
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-xs font-bold gap-1.5 h-8 px-3"
                >
                  <Printer size={13} /> طباعة التقرير
                </Button>
                {canCloseShift && onOpenCloseShift && (
                  <Button
                    onClick={() => {
                      onClose();
                      onOpenCloseShift();
                    }}
                    variant="destructive"
                    size="sm"
                    className="rounded-xl text-xs font-bold gap-1.5 h-8 px-3"
                  >
                    <Lock size={13} /> إغلاق الوردية
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogHeader>

        {activeShift ? (
          <div className="space-y-3 mt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card border border-border p-3 rounded-2xl">
                <span className="text-[11px] text-muted-foreground font-bold block mb-0.5">
                  إجمالي الخزينة (USD)
                </span>
                <span className="text-lg font-black text-emerald-600">
                  {formatTicketPrice(totalUsd)}
                </span>
              </div>
              <div className="bg-card border border-border p-3 rounded-2xl">
                <span className="text-[11px] text-muted-foreground font-bold block mb-0.5">
                  إجمالي الخزينة (SSP)
                </span>
                <span className="text-lg font-black text-teal-600">
                  {totalSsp.toLocaleString()} SSP
                </span>
              </div>
            </div>

            <div className="border border-border rounded-2xl overflow-hidden bg-card">
              <div className="max-h-56 overflow-y-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-muted/50 border-b border-border sticky top-0">
                    <tr>
                      <th className="py-2 px-3 font-black text-muted-foreground">رقم الفاتورة</th>
                      <th className="py-2 px-3 font-black text-muted-foreground">الوقت</th>
                      <th className="py-2 px-3 font-black text-muted-foreground">طريقة الدفع</th>
                      <th className="py-2 px-3 font-black text-muted-foreground">المبلغ</th>
                      <th className="py-2 px-3 font-black text-muted-foreground text-center">
                        الحالة
                      </th>
                      <th className="py-2 px-3 font-black text-muted-foreground text-center">
                        إجراءات
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {shiftTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-muted/30 transition">
                        <td className="p-3 font-mono font-bold text-teal-600">{tx.tx_number}</td>
                        <td className="p-3 font-bold">{tx.transaction_time}</td>
                        <td className="p-3 font-bold">
                          {tx.payment_method === "cash"
                            ? "نقدي"
                            : tx.payment_method === "visa"
                              ? "فيزا"
                              : tx.payment_method === "bank_transfer"
                                ? "تحويل"
                                : "آجل"}
                        </td>
                        <td className="p-3 font-black">
                          {tx.currency === "USD"
                            ? `$${tx.total_paid_in_currency}`
                            : `${tx.total_paid_in_currency.toLocaleString()} SSP`}
                        </td>
                        <td className="p-3 text-center">
                          <Badge
                            variant="outline"
                            className={
                              tx.status === "refunded"
                                ? "text-rose-500 border-rose-500 bg-rose-500/10"
                                : "text-emerald-500 border-emerald-500 bg-emerald-500/10"
                            }
                          >
                            {tx.status === "refunded" ? "مرتجع" : "مكتملة"}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex justify-center gap-1">
                            {tx.status !== "refunded" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRefund(tx.id)}
                                  className="h-7 px-2 text-rose-600 hover:bg-rose-50 rounded-lg"
                                >
                                  <RotateCcw size={13} className="mr-1" /> إرجاع
                                </Button>
                                {activeShift?.status === "open" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleVoid(tx.id)}
                                    className="h-7 px-2 border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold rounded-lg"
                                    title="حذف الفاتورة والإيصال (Void) مع بقاء الإجراء مسجلاً في سجل العمليات"
                                  >
                                    <Trash2 size={13} className="mr-1" /> حذف Void
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {shiftTransactions.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center p-6 text-muted-foreground font-bold">
                          لا توجد حركات في هذه الوردية
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center p-10 font-bold text-muted-foreground">
            لا توجد وردية مفتوحة حالياً
          </div>
        )}
      </DialogContent>

      <Dialog open={Boolean(refundTxId)} onOpenChange={(open) => !open && setRefundTxId(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-black">تأكيد إرجاع التذكرة</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs font-bold">سبب الإرجاع</Label>
            <Input
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="اكتب سبب الإرجاع..."
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRefundTxId(null)}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={confirmRefund}>
              تأكيد الإرجاع
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(voidTxId)} onOpenChange={(open) => !open && setVoidTxId(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-amber-600">
              <Trash2 size={16} />
              <span>تأكيد حذف الفاتورة / الإيصال (Void)</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2.5 py-2 text-xs">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 font-bold">
              سيتم حذف الإيصال من الوردية المفتوحة وعكس أثره من الخزينة، مع بقاء العملية مسجلة بالكامل في سجل العمليات.
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold">سبب الحذف (Void)</Label>
              <Input
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="اكتب سبب حذف الإيصال..."
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setVoidTxId(null)}>
              إلغاء
            </Button>
            <Button
              onClick={confirmVoid}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
            >
              تأكيد الحذف (Void)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
