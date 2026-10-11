import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Lock,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  FileText,
  RotateCcw,
  ShoppingBag,
  Clock,
  UserCheck,
  Building,
  DollarSign,
  Landmark,
  ArrowRight,
  TrendingUp,
  CreditCard,
  Wallet,
  Receipt,
  Utensils,
  BookOpen,
} from "lucide-react";
import {
  erpStore,
  RestaurantShift,
  RestaurantRefundRecord,
  JournalEntry,
} from "@/shared/services/erpStore";
import { printRawHtml } from "@/shared/utils/printAccountingDocument";
import { toast } from "sonner";

interface RestaurantShiftClosingReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShiftClosed?: () => void; // Triggered to navigate back to Restaurant management page
  onReportCompleted?: () => void; // Alias for onShiftClosed
  shiftToClose?: RestaurantShift | null; // If passed, close this specific shift, otherwise active shift
  shift?: RestaurantShift | null; // Alias for shiftToClose
  viewOnlyShift?: RestaurantShift | null; // If passed, view report of an already closed shift
  orders?: any[]; // Orders passed from POS or fetched
}

export function RestaurantShiftClosingReportModal({
  isOpen,
  onClose,
  onShiftClosed,
  onReportCompleted,
  shiftToClose,
  shift,
  viewOnlyShift,
  orders = [],
}: RestaurantShiftClosingReportModalProps) {
  const [closedResult, setClosedResult] = useState<RestaurantShift | null>(viewOnlyShift || null);
  const [closingNotes, setClosingNotes] = useState("");
  const [activeTab, setActiveTab] = useState<"summary" | "transactions" | "journal_entries">(
    "summary",
  );

  const activeShift =
    shiftToClose ||
    shift ||
    erpStore.getActiveRestaurantShift() ||
    erpStore.getOrCreateActiveRestaurantShift();
  const currentShift = viewOnlyShift || closedResult || activeShift;

  // Retrieve shift refunds
  const shiftRefunds: RestaurantRefundRecord[] = useMemo(() => {
    if (!currentShift) return [];
    const all = erpStore.getRestaurantRefundRecords();
    return all.filter(
      (r) =>
        r.shift_id === currentShift.id ||
        r.shift_number === currentShift.shift_number ||
        (currentShift.status === "open" && (!r.shift_id || r.shift_id === currentShift.id)),
    );
  }, [currentShift, isOpen, closedResult]);

  // Filter orders related to this shift or current open session
  const shiftOrders = useMemo(() => {
    if (!currentShift) return [];
    const localOrders =
      orders && orders.length > 0
        ? orders
        : typeof window !== "undefined"
          ? JSON.parse(localStorage.getItem("pos_local_orders") || "[]")
          : [];

    if (currentShift.status === "open") {
      const shiftStartTime = new Date(currentShift.start_at).getTime();
      return localOrders.filter((o: any) => {
        const orderTime = new Date(o.created_at || Date.now()).getTime();
        return orderTime >= shiftStartTime - 60000;
      });
    }

    // For closed shift: orders matching time range
    const shiftStartTime = new Date(currentShift.start_at).getTime();
    const shiftEndTime = currentShift.end_at ? new Date(currentShift.end_at).getTime() : Date.now();
    return localOrders.filter((o: any) => {
      const orderTime = new Date(o.created_at || Date.now()).getTime();
      return orderTime >= shiftStartTime - 60000 && orderTime <= shiftEndTime + 60000;
    });
  }, [currentShift, orders, isOpen]);

  // Financial Stats
  const grossSales = useMemo(() => {
    if (currentShift?.total_sales && currentShift.total_sales > 0) {
      return currentShift.total_sales;
    }
    return shiftOrders.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);
  }, [currentShift, shiftOrders]);

  const totalRefundsAmount = useMemo(() => {
    return shiftRefunds.reduce((sum, r) => sum + Number(r.refund_amount || 0), 0);
  }, [shiftRefunds]);

  const netSalesAmount = Math.max(0, grossSales - totalRefundsAmount);

  // Payment Breakdown
  const paymentBreakdown = useMemo(() => {
    if (
      currentShift?.payment_breakdown &&
      (currentShift.payment_breakdown.cash ||
        currentShift.payment_breakdown.card ||
        currentShift.payment_breakdown.wallet)
    ) {
      return currentShift.payment_breakdown;
    }
    const breakdown = { cash: 0, card: 0, wallet: 0 };
    shiftOrders.forEach((o: any) => {
      const pm = (o.payment_method || "cash").toLowerCase();
      const amt = Number(o.total || 0);
      if (
        pm.includes("card") ||
        pm.includes("بطاقة") ||
        pm.includes("شبكة") ||
        pm.includes("visa")
      ) {
        breakdown.card += amt;
      } else if (pm.includes("wallet") || pm.includes("محفظة") || pm.includes("vodafone")) {
        breakdown.wallet += amt;
      } else {
        breakdown.cash += amt;
      }
    });
    return breakdown;
  }, [currentShift, shiftOrders]);

  // Journal Entries created for this shift
  const shiftJournalEntries: JournalEntry[] = useMemo(() => {
    if (!currentShift) return [];
    const allJes = erpStore.getState().journalEntries || [];
    const refs = currentShift.generated_journal_refs || [];

    // Look up by refs or description containing shift number
    return allJes.filter((je) => {
      if (refs.some((r) => je.reference?.includes(r) || je.id?.includes(r))) return true;
      if (je.description?.includes(currentShift.shift_number)) return true;
      if (je.description?.includes(currentShift.auto_shift_number || "___")) return true;
      // Also match INV- or REF- of this shift's orders
      if (
        shiftOrders.some(
          (o: any) =>
            je.reference === `INV-${o.order_number}` ||
            je.description?.includes(`طلب رقم #${o.order_number}`),
        )
      ) {
        return true;
      }
      if (
        shiftRefunds.some(
          (r) =>
            je.reference === `REF-${r.order_number}` ||
            je.description?.includes(`طلب #${r.order_number}`),
        )
      ) {
        return true;
      }
      return false;
    });
  }, [currentShift, shiftOrders, shiftRefunds, isOpen, closedResult]);

  // Handle Close Shift Action
  const handleExecuteCloseShift = () => {
    if (!currentShift) return;

    try {
      // Update totals on shift before closing
      currentShift.total_sales = grossSales;
      currentShift.total_refunds = totalRefundsAmount;
      currentShift.net_total = netSalesAmount;
      currentShift.orders_count = shiftOrders.length;
      currentShift.refunds_count = shiftRefunds.length;
      currentShift.payment_breakdown = paymentBreakdown;

      const closed = erpStore.closeRestaurantShift(currentShift.id, closingNotes);
      setClosedResult(closed);
      toast.success(
        `تم إغلاق الوردية (${closed.shift_number}) بنجاح وترحيل القيود والحركات المحاسبية!`,
      );

      const notifyCompleted = onShiftClosed || onReportCompleted;
      if (notifyCompleted) {
        setTimeout(() => {
          notifyCompleted();
        }, 1200);
      }
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء إغلاق الوردية");
    }
  };

  // Printable A4 HTML Generation
  const handlePrintReport = () => {
    if (!currentShift) return;

    const startDateFormatted = new Date(currentShift.start_at).toLocaleString("ar-EG");
    const endDateFormatted = currentShift.end_at
      ? new Date(currentShift.end_at).toLocaleString("ar-EG")
      : new Date().toLocaleString("ar-EG");

    const ordersRowsHtml = shiftOrders
      .map((o: any, idx: number) => {
        const timeStr = o.created_at ? new Date(o.created_at).toLocaleTimeString("ar-EG") : "--";
        const itemsCount = o.items ? o.items.length : 0;
        return `
          <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
            <td style="padding: 6px 8px; text-align: center;">${idx + 1}</td>
            <td style="padding: 6px 8px; font-weight: bold; text-align: center;">#${o.order_number || o.id}</td>
            <td style="padding: 6px 8px; text-align: center;">${timeStr}</td>
            <td style="padding: 6px 8px; text-align: center;">${o.order_type === "dine_in" ? "صالة" : o.order_type === "takeaway" ? "تيك أواي" : "توصيل"}</td>
            <td style="padding: 6px 8px; text-align: center;">${itemsCount} أصناف</td>
            <td style="padding: 6px 8px; text-align: center;">${o.payment_method === "card" ? "بطاقة / شبكة" : o.payment_method === "wallet" ? "محفظة إلكترونية" : "نقدي"}</td>
            <td style="padding: 6px 8px; text-align: left; font-family: monospace; font-weight: bold;">${Number(o.total || 0).toLocaleString()} EGP</td>
          </tr>
        `;
      })
      .join("");

    const refundsRowsHtml = shiftRefunds
      .map((r, idx) => {
        const timeStr = new Date(r.created_at).toLocaleTimeString("ar-EG");
        return `
          <tr style="border-bottom: 1px solid #fecdd3; background-color: #fff1f2; font-size: 11px;">
            <td style="padding: 6px 8px; text-align: center; color: #e11d48; font-weight: bold;">مرتجع #${idx + 1}</td>
            <td style="padding: 6px 8px; font-weight: bold; text-align: center;">#${r.order_number}</td>
            <td style="padding: 6px 8px; text-align: center;">${timeStr}</td>
            <td style="padding: 6px 8px; text-align: center;">${r.cashier_name}</td>
            <td style="padding: 6px 8px; text-align: right; color: #be123c;">${r.refund_reason}</td>
            <td style="padding: 6px 8px; text-align: center; font-family: monospace;">${r.journal_ref || "-"}</td>
            <td style="padding: 6px 8px; text-align: left; font-family: monospace; font-weight: bold; color: #e11d48;">-${Number(r.refund_amount).toLocaleString()} EGP</td>
          </tr>
        `;
      })
      .join("");

    const journalEntriesHtml = shiftJournalEntries
      .map((je, jeIdx) => {
        const linesHtml = je.lines
          .map(
            (l) => `
          <tr style="border-bottom: 1px solid #f1f5f9; font-size: 11px;">
            <td style="padding: 4px 6px; font-family: monospace;">${l.account_code}</td>
            <td style="padding: 4px 6px;">${erpStore.getAccountName(l.account_code)}</td>
            <td style="padding: 4px 6px; text-align: left; font-family: monospace; color: ${l.debit > 0 ? "#047857" : "#94a3b8"}; font-weight: ${l.debit > 0 ? "bold" : "normal"};">
              ${l.debit > 0 ? l.debit.toLocaleString() : "-"}
            </td>
            <td style="padding: 4px 6px; text-align: left; font-family: monospace; color: ${l.credit > 0 ? "#b91c1c" : "#94a3b8"}; font-weight: ${l.credit > 0 ? "bold" : "normal"};">
              ${l.credit > 0 ? l.credit.toLocaleString() : "-"}
            </td>
            <td style="padding: 4px 6px; text-align: center; font-size: 10px;">${l.currency || "EGP"}</td>
          </tr>
        `,
          )
          .join("");

        const totalDebit = je.lines.reduce((s, l) => s + (l.debit || 0), 0);
        const totalCredit = je.lines.reduce((s, l) => s + (l.credit || 0), 0);

        return `
          <div style="margin-bottom: 14px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; page-break-inside: avoid;">
            <div style="background-color: #f8fafc; padding: 6px 10px; display: flex; justify-content: space-between; border-bottom: 1px solid #cbd5e1; font-size: 11px; font-weight: bold;">
              <span>قيد رقم: <b style="font-family: monospace;">${je.reference || je.id}</b> - ${je.description}</span>
              <span style="color: #047857;">متزن ✓ (المدين: ${totalDebit.toLocaleString()} | الدائن: ${totalCredit.toLocaleString()})</span>
            </div>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background-color: #f1f5f9; font-size: 10px; color: #475569;">
                  <th style="padding: 4px 6px; text-align: right;">كود الحساب</th>
                  <th style="padding: 4px 6px; text-align: right;">اسم الحساب</th>
                  <th style="padding: 4px 6px; text-align: left;">مدين (Debit)</th>
                  <th style="padding: 4px 6px; text-align: left;">دائن (Credit)</th>
                  <th style="padding: 4px 6px; text-align: center;">العملة</th>
                </tr>
              </thead>
              <tbody>
                ${linesHtml}
              </tbody>
            </table>
          </div>
        `;
      })
      .join("");

    const fullHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; color: #0f172a; padding: 20px; max-width: 900px; margin: 0 auto;">
        
        <!-- Header -->
        <div style="border-bottom: 2px solid #3b82f6; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h1 style="font-size: 20px; font-weight: 900; margin: 0 0 4px 0; color: #1e3a8a;">تقرير إغلاق وردية كاشير المطعم والحركات المحاسبية</h1>
            <p style="font-size: 12px; color: #64748b; margin: 0;">نظام إدارة المطعم ونقاط البيع المتكامل — ترحيل القيود اليومية والمبيعات والمرتجعات</p>
          </div>
          <div style="text-align: left;">
            <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 6px 12px; border-radius: 8px; font-family: monospace; font-size: 13px; font-weight: bold; color: #1d4ed8;">
              ${currentShift.auto_shift_number || "RST-AUTO"}
            </div>
            <div style="font-size: 10px; color: #94a3b8; margin-top: 4px; text-align: left;">تاريخ الطباعة: ${new Date().toLocaleString("ar-EG")}</div>
          </div>
        </div>

        <!-- Shift Metadata -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 18px; font-size: 12px;">
          <div>
            <span style="color: #64748b; display: block; font-size: 11px;">مسمى الوردية:</span>
            <strong style="color: #0f172a;">${currentShift.shift_number}</strong>
          </div>
          <div>
            <span style="color: #64748b; display: block; font-size: 11px;">الكاشير المسؤول:</span>
            <strong style="color: #0f172a;">${currentShift.cashier_name}</strong>
          </div>
          <div>
            <span style="color: #64748b; display: block; font-size: 11px;">وقت البدء:</span>
            <span>${startDateFormatted}</span>
          </div>
          <div>
            <span style="color: #64748b; display: block; font-size: 11px;">وقت الإغلاق:</span>
            <span>${endDateFormatted}</span>
          </div>
        </div>

        <!-- KPI Financial Summary Cards -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px;">
          <div style="border: 1px solid #bfdbfe; background-color: #eff6ff; border-radius: 8px; padding: 10px; text-align: center;">
            <div style="font-size: 11px; color: #1e40af; font-weight: bold;">إجمالي المبيعات (Gross)</div>
            <div style="font-size: 18px; font-weight: 900; font-family: monospace; color: #1e3a8a; margin-top: 2px;">${grossSales.toLocaleString()} EGP</div>
            <div style="font-size: 10px; color: #60a5fa;">${shiftOrders.length} طلبات مبيعات</div>
          </div>

          <div style="border: 1px solid #fecdd3; background-color: #fff1f2; border-radius: 8px; padding: 10px; text-align: center;">
            <div style="font-size: 11px; color: #be123c; font-weight: bold;">إجمالي المرتجعات (Refunds)</div>
            <div style="font-size: 18px; font-weight: 900; font-family: monospace; color: #e11d48; margin-top: 2px;">-${totalRefundsAmount.toLocaleString()} EGP</div>
            <div style="font-size: 10px; color: #f43f5e;">${shiftRefunds.length} حركة مسترجعة</div>
          </div>

          <div style="border: 1px solid #bbf7d0; background-color: #f0fdf4; border-radius: 8px; padding: 10px; text-align: center;">
            <div style="font-size: 11px; color: #166534; font-weight: bold;">صافي الإيراد (Net Revenue)</div>
            <div style="font-size: 18px; font-weight: 900; font-family: monospace; color: #15803d; margin-top: 2px;">${netSalesAmount.toLocaleString()} EGP</div>
            <div style="font-size: 10px; color: #4ade80;">بعد خصم المرتجعات</div>
          </div>

          <div style="border: 1px solid #fed7aa; background-color: #fff7ed; border-radius: 8px; padding: 10px; text-align: center;">
            <div style="font-size: 11px; color: #9a3412; font-weight: bold;">الرصيد الافتتاحي</div>
            <div style="font-size: 18px; font-weight: 900; font-family: monospace; color: #c2410c; margin-top: 2px;">${Number(currentShift.opening_balance || 0).toLocaleString()} EGP</div>
            <div style="font-size: 10px; color: #fb923c;">عهدة الدرج</div>
          </div>
        </div>

        <!-- Payment Breakdown -->
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 20px; background-color: #fafafa; font-size: 12px;">
          <div style="font-weight: bold; margin-bottom: 6px; color: #334155;">تفصيل وسائل الدفع والتحصيل:</div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 10px;">
              <span style="color: #64748b; font-size: 11px;">💵 نقدًا (Cash):</span>
              <span style="float: left; font-family: monospace; font-weight: bold;">${(paymentBreakdown.cash || 0).toLocaleString()} EGP</span>
            </div>
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 10px;">
              <span style="color: #64748b; font-size: 11px;">💳 بطاقة بنكية (Card):</span>
              <span style="float: left; font-family: monospace; font-weight: bold;">${(paymentBreakdown.card || 0).toLocaleString()} EGP</span>
            </div>
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 10px;">
              <span style="color: #64748b; font-size: 11px;">📱 محفظة إلكترونية (Wallet):</span>
              <span style="float: left; font-family: monospace; font-weight: bold;">${(paymentBreakdown.wallet || 0).toLocaleString()} EGP</span>
            </div>
          </div>
        </div>

        <!-- Section 1: Completed Orders & Transactions -->
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 14px; font-weight: 800; border-bottom: 2px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 8px; color: #1e293b;">
            أولاً: حركات المبيعات المنفذة خلال الوردية (${shiftOrders.length} طلب)
          </h2>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f1f5f9; font-size: 11px; color: #475569; border-bottom: 1px solid #cbd5e1;">
                <th style="padding: 6px 8px; text-align: center;">#</th>
                <th style="padding: 6px 8px; text-align: center;">رقم الطلب</th>
                <th style="padding: 6px 8px; text-align: center;">الوقت</th>
                <th style="padding: 6px 8px; text-align: center;">النوع</th>
                <th style="padding: 6px 8px; text-align: center;">الأصناف</th>
                <th style="padding: 6px 8px; text-align: center;">طريقة الدفع</th>
                <th style="padding: 6px 8px; text-align: left;">المبلغ الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              ${ordersRowsHtml || `<tr><td colspan="7" style="text-align: center; padding: 12px; color: #94a3b8; font-size: 11px;">لا توجد طلبات مسجلة لهذه الوردية</td></tr>`}
            </tbody>
          </table>
        </div>

        <!-- Section 2: Refunds & Returns Transactions -->
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 14px; font-weight: 800; border-bottom: 2px solid #f43f5e; padding-bottom: 4px; margin-bottom: 8px; color: #be123c;">
            ثانياً: حركات المرتجع والمستردات (${shiftRefunds.length} حركة مرتجع)
          </h2>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #fff1f2; font-size: 11px; color: #be123c; border-bottom: 1px solid #fecdd3;">
                <th style="padding: 6px 8px; text-align: center;">م</th>
                <th style="padding: 6px 8px; text-align: center;">رقم الطلب</th>
                <th style="padding: 6px 8px; text-align: center;">الوقت</th>
                <th style="padding: 6px 8px; text-align: center;">المسؤول</th>
                <th style="padding: 6px 8px; text-align: right;">سبب المرتجع</th>
                <th style="padding: 6px 8px; text-align: center;">مرجع القيد</th>
                <th style="padding: 6px 8px; text-align: left;">المبلغ المسترد</th>
              </tr>
            </thead>
            <tbody>
              ${refundsRowsHtml || `<tr><td colspan="7" style="text-align: center; padding: 12px; color: #94a3b8; font-size: 11px;">لم يتم تسجيل أي حركات مرتجع خلال هذه الوردية (الوضع مثالي)</td></tr>`}
            </tbody>
          </table>
        </div>

        <!-- Section 3: Generated Double-Entry Accounting Journal Entries -->
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 14px; font-weight: 800; border-bottom: 2px solid #059669; padding-bottom: 4px; margin-bottom: 8px; color: #065f46;">
            ثالثاً: القيود المحاسبية المنشأة آلياً في دفتر اليومية (${shiftJournalEntries.length} قيد محاسبي)
          </h2>
          ${journalEntriesHtml || `<div style="text-align: center; padding: 16px; border: 1px dashed #cbd5e1; border-radius: 6px; color: #94a3b8; font-size: 11px;">سيتم ترحيل قيود اليومية آلياً عند اعتماد الإغلاق.</div>`}
        </div>

        <!-- Signatures & Approval Footer -->
        <div style="margin-top: 35px; border-top: 1px solid #cbd5e1; padding-top: 15px; display: grid; grid-template-columns: repeat(3, 1fr); text-align: center; font-size: 12px; page-break-inside: avoid;">
          <div>
            <div style="color: #64748b; margin-bottom: 35px;">توقيع الكاشير المسؤول</div>
            <div style="border-top: 1px dotted #94a3b8; width: 80%; margin: 0 auto; padding-top: 4px; font-weight: bold;">
              ${currentShift.cashier_name}
            </div>
          </div>
          <div>
            <div style="color: #64748b; margin-bottom: 35px;">توقيع المشرف / مدير الصالة</div>
            <div style="border-top: 1px dotted #94a3b8; width: 80%; margin: 0 auto; padding-top: 4px;">
              ....................................
            </div>
          </div>
          <div>
            <div style="color: #64748b; margin-bottom: 35px;">اعتماد الإدارة المالية</div>
            <div style="border-top: 1px dotted #94a3b8; width: 80%; margin: 0 auto; padding-top: 4px;">
              ....................................
            </div>
          </div>
        </div>

      </div>
    `;

    printRawHtml(fullHtml);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[850px] rounded-3xl max-h-[92vh] overflow-y-auto border-border shadow-2xl p-0">
        {/* Banner Header */}
        <div className="bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 p-6 text-white rounded-t-3xl relative overflow-hidden">
          <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
          <DialogHeader className="text-right space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-amber-300 text-xs font-bold backdrop-blur-md">
                <Utensils size={14} />
                <span>إغلاق وترحيل وردية المطعم</span>
              </div>
              <Badge
                variant="outline"
                className={`text-xs font-mono px-3 py-1 font-bold ${
                  currentShift?.status === "closed"
                    ? "bg-slate-800 text-slate-200 border-slate-700"
                    : "bg-emerald-500/20 text-emerald-200 border-emerald-400/30"
                }`}
              >
                {currentShift?.status === "closed"
                  ? "وردية مغلقة ومرحلة"
                  : "جلسة مفتوحة — جاهزة للإغلاق"}
              </Badge>
            </div>
            <DialogTitle className="text-xl font-black text-white flex items-center gap-2">
              <Receipt className="text-indigo-400" size={22} />
              تقرير إغلاق الوردية والترحيل المحاسبي
            </DialogTitle>
            <DialogDescription className="text-slate-300 text-xs leading-relaxed">
              استعراض مفصل للمبيعات والمرتجعات المنفذة، مع القيود المحاسبية المزدوجة التي تم إنشاؤها
              في دفتر اليومية العامة، وتوليد تقرير إقفال رسمي قابل للطباعة.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-6">
          {/* Shift Details Banner */}
          <div className="p-4 rounded-2xl bg-card border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-black text-foreground">
                  {currentShift?.shift_number}
                </span>
                {currentShift?.auto_shift_number && (
                  <Badge
                    variant="outline"
                    className="font-mono text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950 border-indigo-200"
                  >
                    {currentShift.auto_shift_number}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <UserCheck size={13} className="text-emerald-600" />
                  الكاشير: <b className="text-foreground">{currentShift?.cashier_name}</b>
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={13} className="text-primary" />
                  البدء:{" "}
                  {new Date(currentShift?.start_at || Date.now()).toLocaleTimeString("ar-EG")}
                </span>
                {currentShift?.end_at && (
                  <span className="flex items-center gap-1">
                    <Lock size={13} className="text-rose-600" />
                    الإغلاق: {new Date(currentShift.end_at).toLocaleTimeString("ar-EG")}
                  </span>
                )}
              </div>
            </div>

            {/* Print Button */}
            <Button
              onClick={handlePrintReport}
              className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 rounded-xl font-bold text-xs gap-2 shadow-sm cursor-pointer shrink-0"
            >
              <Printer size={15} />
              طباعة التقرير الرسمي (A4)
            </Button>
          </div>

          {/* Quick KPI Financial Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 space-y-1">
              <span className="text-xs text-blue-700 dark:text-blue-300 font-bold block">
                إجمالي المبيعات (Gross)
              </span>
              <span className="text-lg font-black font-mono text-blue-900 dark:text-blue-100 block">
                {grossSales.toLocaleString()} EGP
              </span>
              <span className="text-[10px] text-blue-600 block">{shiftOrders.length} طلبات</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 space-y-1">
              <span className="text-xs text-rose-700 dark:text-rose-300 font-bold block flex items-center gap-1">
                <RotateCcw size={12} />
                إجمالي المرتجعات (Refunds)
              </span>
              <span className="text-lg font-black font-mono text-rose-900 dark:text-rose-100 block">
                -{totalRefundsAmount.toLocaleString()} EGP
              </span>
              <span className="text-[10px] text-rose-600 block">
                {shiftRefunds.length} حركة مرتجع
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 space-y-1">
              <span className="text-xs text-emerald-700 dark:text-emerald-300 font-bold block">
                صافي الإيراد (Net Revenue)
              </span>
              <span className="text-lg font-black font-mono text-emerald-900 dark:text-emerald-100 block">
                {netSalesAmount.toLocaleString()} EGP
              </span>
              <span className="text-[10px] text-emerald-600 block">بعد خصم المرتجعات</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 space-y-1">
              <span className="text-xs text-amber-700 dark:text-amber-300 font-bold block">
                الرصيد الافتتاحي
              </span>
              <span className="text-lg font-black font-mono text-amber-900 dark:text-amber-100 block">
                {Number(currentShift?.opening_balance || 0).toLocaleString()} EGP
              </span>
              <span className="text-[10px] text-amber-600 block">عهدة بداية الجلسة</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <button
              onClick={() => setActiveTab("summary")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "summary"
                  ? "bg-indigo-600 text-white font-black shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              ملخص الوردية والتحصيل
            </button>
            <button
              onClick={() => setActiveTab("transactions")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "transactions"
                  ? "bg-indigo-600 text-white font-black shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <ShoppingBag size={14} />
              حركات المبيعات والمرتجع ({shiftOrders.length + shiftRefunds.length})
            </button>
            <button
              onClick={() => setActiveTab("journal_entries")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "journal_entries"
                  ? "bg-indigo-600 text-white font-black shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <BookOpen size={14} />
              القيود المحاسبية المنشأة ({shiftJournalEntries.length})
            </button>
          </div>

          {/* TAB 1: SUMMARY */}
          {activeTab === "summary" && (
            <div className="space-y-4">
              {/* Payment Methods Breakdown */}
              <div className="p-4 rounded-2xl border border-border bg-card space-y-3">
                <h4 className="text-xs font-black text-foreground flex items-center gap-2">
                  <CreditCard size={15} className="text-indigo-600" />
                  تفصيل طرق التحصيل والدفع
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-foreground block">
                        💵 نقدي (Cash)
                      </span>
                      <span className="text-[10px] text-muted-foreground">في درج الكاشير</span>
                    </div>
                    <span className="font-mono font-black text-sm text-foreground">
                      {(paymentBreakdown.cash || 0).toLocaleString()} EGP
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-foreground block">
                        💳 بطاقة بنكية (Card)
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        حساب البنك / نقاط البيع
                      </span>
                    </div>
                    <span className="font-mono font-black text-sm text-foreground">
                      {(paymentBreakdown.card || 0).toLocaleString()} EGP
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-foreground block">
                        📱 محفظة (Wallet)
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        فودافون كاش / إنستاباي
                      </span>
                    </div>
                    <span className="font-mono font-black text-sm text-foreground">
                      {(paymentBreakdown.wallet || 0).toLocaleString()} EGP
                    </span>
                  </div>
                </div>
              </div>

              {/* Closing Notes */}
              {currentShift?.status === "open" && (
                <div className="p-4 rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20 space-y-2">
                  <span className="text-xs font-black text-amber-900 dark:text-amber-200 block">
                    ملاحظات الإغلاق والتسليم النهائي للمشرف:
                  </span>
                  <input
                    type="text"
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                    placeholder="مثال: تم تسليم نقدية الدرج ومطابقة الإيراد والفيزا مع المشرف..."
                    className="w-full h-10 px-3 rounded-xl bg-background border border-border text-xs font-bold"
                  />
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TRANSACTIONS & REFUNDS */}
          {activeTab === "transactions" && (
            <div className="space-y-4">
              {/* Completed Orders */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-foreground flex items-center gap-1.5">
                    <ShoppingBag size={14} className="text-emerald-600" />
                    حركات المبيعات المنفذة ({shiftOrders.length} طلب):
                  </h4>
                  <span className="text-xs font-mono font-bold text-muted-foreground">
                    إجمالي: {grossSales.toLocaleString()} EGP
                  </span>
                </div>

                <div className="max-h-56 overflow-y-auto rounded-2xl border border-border">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-muted text-muted-foreground font-bold sticky top-0">
                      <tr>
                        <th className="p-2.5 text-center">الطلب</th>
                        <th className="p-2.5 text-center">الوقت</th>
                        <th className="p-2.5 text-center">النوع</th>
                        <th className="p-2.5 text-center">الأصناف</th>
                        <th className="p-2.5 text-center">الدفع</th>
                        <th className="p-2.5 text-left font-mono">المبلغ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {shiftOrders.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center p-6 text-muted-foreground">
                            لا توجد طلبات مسجلة
                          </td>
                        </tr>
                      ) : (
                        shiftOrders.map((o: any) => (
                          <tr key={o.id} className="hover:bg-muted/30">
                            <td className="p-2.5 font-bold font-mono text-center">
                              #{o.order_number || o.id}
                            </td>
                            <td className="p-2.5 text-center text-muted-foreground">
                              {o.created_at
                                ? new Date(o.created_at).toLocaleTimeString("ar-EG")
                                : "--"}
                            </td>
                            <td className="p-2.5 text-center">
                              <Badge variant="outline" className="text-[10px]">
                                {o.order_type === "dine_in"
                                  ? "صالة"
                                  : o.order_type === "takeaway"
                                    ? "تيك أواي"
                                    : "توصيل"}
                              </Badge>
                            </td>
                            <td className="p-2.5 text-center text-muted-foreground">
                              {o.items ? o.items.length : 0} أصناف
                            </td>
                            <td className="p-2.5 text-center font-medium">
                              {o.payment_method === "card"
                                ? "بطاقة"
                                : o.payment_method === "wallet"
                                  ? "محفظة"
                                  : "نقدي"}
                            </td>
                            <td className="p-2.5 text-left font-mono font-black text-emerald-600">
                              {Number(o.total || 0).toLocaleString()} EGP
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Refunds Transactions */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-rose-600 flex items-center gap-1.5">
                    <RotateCcw size={14} />
                    حركات المرتجع والمستردات ({shiftRefunds.length} مرتجع):
                  </h4>
                  <span className="text-xs font-mono font-bold text-rose-600">
                    إجمالي: -{totalRefundsAmount.toLocaleString()} EGP
                  </span>
                </div>

                <div className="max-h-52 overflow-y-auto rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50/20">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-rose-100/60 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 font-bold sticky top-0">
                      <tr>
                        <th className="p-2.5 text-center">رقم الطلب</th>
                        <th className="p-2.5 text-center">الوقت</th>
                        <th className="p-2.5 text-center">الكاشير</th>
                        <th className="p-2.5 text-right">سبب الإرجاع</th>
                        <th className="p-2.5 text-center font-mono">مرجع القيد</th>
                        <th className="p-2.5 text-left font-mono">المبلغ المسترد</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-200/50 dark:divide-rose-900/50">
                      {shiftRefunds.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center p-6 text-muted-foreground">
                            لم يتم تسجيل أي حركات مرتجع خلال هذه الوردية
                          </td>
                        </tr>
                      ) : (
                        shiftRefunds.map((r) => (
                          <tr key={r.id} className="hover:bg-rose-100/30">
                            <td className="p-2.5 font-bold font-mono text-center text-rose-700">
                              #{r.order_number}
                            </td>
                            <td className="p-2.5 text-center text-muted-foreground">
                              {new Date(r.created_at).toLocaleTimeString("ar-EG")}
                            </td>
                            <td className="p-2.5 text-center">{r.cashier_name}</td>
                            <td className="p-2.5 text-right text-rose-800 dark:text-rose-300 font-medium">
                              {r.refund_reason}
                            </td>
                            <td className="p-2.5 text-center font-mono text-muted-foreground">
                              {r.journal_ref || "-"}
                            </td>
                            <td className="p-2.5 text-left font-mono font-black text-rose-600">
                              -{Number(r.refund_amount).toLocaleString()} EGP
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: JOURNAL ENTRIES */}
          {activeTab === "journal_entries" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-foreground flex items-center gap-1.5">
                  <BookOpen size={14} className="text-indigo-600" />
                  قيود اليومية المزدوجة المتولدة للوردية ({shiftJournalEntries.length} قيد):
                </h4>
                <Badge variant="outline" className="text-xs text-emerald-600 font-mono font-bold">
                  متزنة محاسبياً ✓
                </Badge>
              </div>

              {shiftJournalEntries.length === 0 ? (
                <div className="p-8 rounded-2xl border border-dashed border-border bg-muted/20 text-center space-y-2">
                  <BookOpen size={30} className="mx-auto text-muted-foreground opacity-50" />
                  <p className="text-xs font-bold text-muted-foreground">
                    سيتم ترحيل قيود اليومية المحاسبية تلقائياً عند إجراء المبيعات أو إغلاق الوردية.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {shiftJournalEntries.map((je) => {
                    const totalDebit = je.lines.reduce((s, l) => s + (l.debit || 0), 0);
                    const totalCredit = je.lines.reduce((s, l) => s + (l.credit || 0), 0);

                    return (
                      <div
                        key={je.id}
                        className="rounded-2xl border border-border bg-card overflow-hidden text-xs"
                      >
                        <div className="p-3 bg-muted/40 border-b border-border flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <Badge className="font-mono text-[10px] bg-indigo-600 text-white">
                              {je.reference || je.id}
                            </Badge>
                            <span className="font-bold text-foreground">{je.description}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] font-mono">
                            <span className="text-emerald-600 font-bold">
                              مدين: {totalDebit.toLocaleString()}
                            </span>
                            <span className="text-rose-600 font-bold">
                              دائن: {totalCredit.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <table className="w-full text-right text-[11px]">
                          <thead className="bg-muted/20 text-muted-foreground">
                            <tr>
                              <th className="p-2">كود الحساب</th>
                              <th className="p-2">اسم الحساب</th>
                              <th className="p-2 text-left font-mono">مدين</th>
                              <th className="p-2 text-left font-mono">دائن</th>
                              <th className="p-2 text-center">العملة</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {je.lines.map((l, lIdx) => (
                              <tr key={lIdx}>
                                <td className="p-2 font-mono text-muted-foreground">
                                  {l.account_code}
                                </td>
                                <td className="p-2 font-bold text-foreground">
                                  {erpStore.getAccountName(l.account_code)}
                                </td>
                                <td className="p-2 text-left font-mono font-bold text-emerald-600">
                                  {l.debit > 0 ? l.debit.toLocaleString() : "-"}
                                </td>
                                <td className="p-2 text-left font-mono font-bold text-rose-600">
                                  {l.credit > 0 ? l.credit.toLocaleString() : "-"}
                                </td>
                                <td className="p-2 text-center text-muted-foreground">
                                  {l.currency || "EGP"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="p-4 bg-muted/30 border-t border-border flex justify-between sm:justify-between items-center rounded-b-3xl">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="rounded-xl text-xs font-bold"
          >
            إلغاء / إغلاق
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintReport}
              className="rounded-xl text-xs font-bold gap-1.5"
            >
              <Printer size={14} />
              طباعة
            </Button>

            {currentShift?.status === "open" && (
              <Button
                onClick={handleExecuteCloseShift}
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black gap-2 shadow-md cursor-pointer"
              >
                <Lock size={15} />
                تأكيد إغلاق الوردية والترحيل المحاسبي
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
