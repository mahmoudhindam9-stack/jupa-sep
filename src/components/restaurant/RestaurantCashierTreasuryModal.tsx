import React, { useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, DollarSign, Coins, Lock, Printer, X } from "lucide-react";
import { erpStore, RestaurantShift } from "@/shared/services/erpStore";
import { canCurrentUserCloseShift } from "@/shared/services/userAuthorization";
import { useSettings } from "@/hooks/use-settings";
import { printRawHtml } from "@/shared/utils/printAccountingDocument";
import {
  getOrderCurrency,
  getOrderOriginalAmount,
} from "@/components/treasury/CashierTreasuryModals";

interface RestaurantCashierTreasuryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenShiftClose?: () => void;
  orders?: any[];
}

export function RestaurantCashierTreasuryModal({
  isOpen,
  onClose,
  onOpenShiftClose,
  orders = [],
}: RestaurantCashierTreasuryModalProps) {
  const { exchangeRates } = useSettings();
  const erpState = erpStore.getState();
  const activeShift: RestaurantShift | null =
    erpStore.getActiveRestaurantShift() ||
    (erpState.restaurantShifts || []).find((s) => s.status === "open") ||
    null;
  const canCloseShift = canCurrentUserCloseShift();

  const shiftOrders = useMemo(() => {
    const allOrders =
      orders && orders.length > 0
        ? orders
        : typeof window !== "undefined"
          ? (() => {
              try {
                return JSON.parse(localStorage.getItem("pos_local_orders") || "[]");
              } catch {
                return [];
              }
            })()
          : [];

    if (!activeShift) return [];
    const shiftStart = new Date(activeShift.start_at || Date.now()).getTime();
    return allOrders.filter((o: any) => {
      if (o.shift_id && o.shift_id === activeShift.id) return true;
      if (o.shift_number && o.shift_number === activeShift.shift_number) return true;
      const orderTime = new Date(o.created_at || Date.now()).getTime();
      return orderTime >= shiftStart - 60000;
    });
  }, [orders, activeShift, isOpen]);

  const totals = useMemo(() => {
    let usd = 0;
    let ssp = 0;
    let egp = 0;
    let count = 0;

    for (const order of shiftOrders) {
      if (order.status === "cancelled" || order.status === "refunded") continue;
      count++;
      const curr = String(
        getOrderCurrency(order, erpState.treasuryTransactions) || "USD",
      ).toUpperCase();
      const amt = Number(
        getOrderOriginalAmount(order, exchangeRates, erpState.treasuryTransactions) || 0,
      );

      if (curr === "SSP") {
        ssp += amt;
      } else if (curr === "EGP") {
        egp += amt;
      } else {
        usd += amt;
      }
    }

    return { usd, ssp, egp, count };
  }, [shiftOrders, erpState.treasuryTransactions, exchangeRates]);

  const handlePrintShiftSummary = () => {
    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8" />
        <title>بيان رصيد خزينة كاشير المطعم</title>
        <style>
          body { font-family: 'Cairo', 'Tajawal', sans-serif; padding: 20px; color: #0f172a; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 16px; }
          .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; }
          th { background: #f1f5f9; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>بيان رصيد خزينة كاشير المطعم</h2>
          <div>${activeShift ? `وردية: ${activeShift.shift_number} — الكاشير: ${activeShift.cashier_name}` : "بدون وردية نشطة"}</div>
          <div>${new Date().toLocaleString("ar-EG")}</div>
        </div>
        <div class="grid">
          <div class="box"><strong>الرصيد الافتتاحي:</strong> $${Number(activeShift?.opening_balance || 0).toLocaleString()} USD</div>
          <div class="box"><strong>مبيعات الدولار (USD):</strong> $${totals.usd.toLocaleString()} USD</div>
          <div class="box"><strong>مبيعات الجنيه الجنوبي (SSP):</strong> ${totals.ssp.toLocaleString()} SSP</div>
          <div class="box"><strong>مبيعات الجنيه المصري (EGP):</strong> ${totals.egp.toLocaleString()} EGP</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>رقم الطلب</th>
              <th>الوقت</th>
              <th>طريقة الدفع</th>
              <th>المبلغ</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${shiftOrders
              .map((o: any) => {
                const curr = getOrderCurrency(o, erpState.treasuryTransactions);
                const amt = getOrderOriginalAmount(
                  o,
                  exchangeRates,
                  erpState.treasuryTransactions,
                );
                return `<tr>
                  <td>#${o.order_number || o.id}</td>
                  <td>${o.created_at ? new Date(o.created_at).toLocaleTimeString("ar-EG") : "-"}</td>
                  <td>${o.payment_method === "card" ? "بطاقة بنكية" : o.payment_method === "wallet" ? "محفظة إلكترونية" : "نقدي"}</td>
                  <td>${Number(amt || 0).toLocaleString()} ${curr}</td>
                  <td>${o.status === "cancelled" ? "مرتجع" : "مكتمل"}</td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </body>
      </html>
    `;
    printRawHtml(html, "بيان رصيد خزينة الكاشير");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-3xl p-4 sm:p-5 overflow-hidden bg-background border-border shadow-2xl rounded-3xl"
        dir="rtl"
      >
        {/* Compact Header */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600">
              <Wallet size={18} />
            </div>
            <h2 className="text-base font-black flex items-center gap-2">
              <span>خزينة الكاشير الحالية</span>
              {activeShift ? (
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-xs">
                  وردية #{activeShift.shift_number} ({activeShift.cashier_name})
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-xs">
                  لا توجد وردية مفتوحة
                </Badge>
              )}
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintShiftSummary}
              className="rounded-xl gap-1.5 text-xs font-bold h-8 px-3 cursor-pointer"
            >
              <Printer size={13} />
              طباعة تقرير
            </Button>
            {canCloseShift && activeShift && onOpenShiftClose && (
              <Button
                size="sm"
                onClick={() => {
                  onClose();
                  onOpenShiftClose();
                }}
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl gap-1.5 text-xs font-bold h-8 px-3 cursor-pointer"
              >
                <Lock size={13} />
                إغلاق الوردية
              </Button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-3 pt-2">
          {/* Balance Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-2.5 rounded-xl bg-muted/40 border border-border">
              <div className="flex items-center justify-between text-muted-foreground mb-0.5">
                <span className="text-[11px] font-bold">الرصيد الافتتاحي</span>
                <Wallet size={13} className="text-slate-500" />
              </div>
              <div className="text-base font-black text-foreground font-mono">
                ${Number(activeShift?.opening_balance || 0).toLocaleString()}{" "}
                <span className="text-[10px] font-normal">USD</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
              <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 mb-0.5">
                <span className="text-[11px] font-bold">نقدي بالدولار (USD)</span>
                <DollarSign size={13} />
              </div>
              <div className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                ${totals.usd.toLocaleString()} <span className="text-[10px] font-normal">USD</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/25">
              <div className="flex items-center justify-between text-blue-700 dark:text-blue-400 mb-0.5">
                <span className="text-[11px] font-bold">بالعملة المحلية (SSP)</span>
                <Coins size={13} />
              </div>
              <div className="text-base font-black text-blue-600 dark:text-blue-400 font-mono">
                {totals.ssp.toLocaleString()} <span className="text-[10px] font-normal">SSP</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25">
              <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 mb-0.5">
                <span className="text-[11px] font-bold">بالجنيه المصري (EGP)</span>
                <Coins size={13} />
              </div>
              <div className="text-base font-black text-amber-600 dark:text-amber-400 font-mono">
                {totals.egp.toLocaleString()} <span className="text-[10px] font-normal">EGP</span>
              </div>
            </div>
          </div>

          {/* Shift Transactions List */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-xs font-black text-foreground">
                حركات ومبيعات الوردية الحالية ({shiftOrders.length})
              </h3>
            </div>

            <div className="border border-border rounded-2xl overflow-hidden">
              <div className="max-h-52 overflow-y-auto divide-y divide-border">
                {shiftOrders.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-sm font-bold">
                    لا توجد مبيعات مسجلة في هذه الوردية حتى الآن
                  </div>
                ) : (
                  shiftOrders.map((order: any) => {
                    const isCancelled =
                      order.status === "cancelled" || order.status === "refunded";
                    const orderCurr = getOrderCurrency(order, erpState.treasuryTransactions);
                    const orderAmt = getOrderOriginalAmount(
                      order,
                      exchangeRates,
                      erpState.treasuryTransactions,
                    );

                    return (
                      <div
                        key={order.id}
                        className="px-4 py-3 flex items-center justify-between hover:bg-muted/40 transition text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-black text-primary">
                            #{order.order_number || order.id}
                          </span>
                          <span className="font-bold text-foreground">
                            {order.customer_name ||
                              (order.order_type === "dine-in"
                                ? `طاولة ${order.table_number || ""}`
                                : "عميل نقدي")}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {order.payment_method === "card"
                              ? "بطاقة بنكية"
                              : order.payment_method === "wallet"
                                ? "محفظة إلكترونية"
                                : "نقدي"}
                          </Badge>
                          {isCancelled && (
                            <Badge variant="destructive" className="text-[10px]">
                              مرتجع
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`font-black font-mono ${
                              isCancelled
                                ? "line-through text-muted-foreground"
                                : "text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {Number(orderAmt || 0).toLocaleString()} {orderCurr}
                          </span>
                          <span className="text-muted-foreground font-mono">
                            {order.created_at
                              ? new Date(order.created_at).toLocaleTimeString("ar-EG", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
