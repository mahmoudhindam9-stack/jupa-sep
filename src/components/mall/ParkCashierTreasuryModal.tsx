import React, { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Landmark, Printer, RotateCcw, Lock, Eye } from "lucide-react";
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
    const reason = prompt("يرجى كتابة سبب الإرجاع:");
    if (!reason) return;
    try {
      erpStore.refundParkTicketTransaction(txId, reason);
    } catch (e: any) {
      alert(e.message);
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
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRefund(tx.id)}
                                className="h-7 px-2 text-rose-600 hover:bg-rose-50 rounded-lg"
                              >
                                <RotateCcw size={13} className="mr-1" /> إرجاع
                              </Button>
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
    </Dialog>
  );
}
