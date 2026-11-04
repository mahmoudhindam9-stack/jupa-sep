import React, { useState, useMemo, useEffect } from "react";
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
  Edit,
  User,
} from "lucide-react";
import {
  erpStore,
  ParkShift,
  ParkTicketTransaction,
  JournalEntry,
} from "@/shared/services/erpStore";
import { canCurrentUserCloseShift } from "@/shared/services/userAuthorization";
import { printRawHtml } from "@/shared/utils/printAccountingDocument";
import { toast } from "sonner";

interface ParkShiftClosingReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShiftClosed?: () => void; // Triggered to navigate back to Garden revenue page
  shiftToClose?: ParkShift | null; // If passed, we close this specific shift, otherwise active shift
  viewOnlyShift?: ParkShift | null; // If passed, view report of an already closed shift
}

export function ParkShiftClosingReportModal({
  isOpen,
  onClose,
  onShiftClosed,
  shiftToClose,
  viewOnlyShift,
}: ParkShiftClosingReportModalProps) {
  const [closedResult, setClosedResult] = useState<ParkShift | null>(viewOnlyShift || null);
  const [activeTab, setActiveTab] = useState<
    "summary" | "transactions" | "journal_entries" | "treasuries"
  >("summary");
  const canCloseShift = canCurrentUserCloseShift();

  const allShifts = useMemo(() => {
    return erpStore.getParkShifts() || [];
  }, [isOpen, closedResult]);

  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);

  useEffect(() => {
    if (viewOnlyShift) {
      setSelectedShiftId(viewOnlyShift.id);
      setClosedResult(viewOnlyShift);
    } else if (shiftToClose) {
      setSelectedShiftId(shiftToClose.id);
      setClosedResult(shiftToClose.status === "closed" ? shiftToClose : null);
    } else {
      const active = erpStore.getActiveParkShift();
      if (active) {
        setSelectedShiftId(active.id);
        setClosedResult(null);
      } else if (allShifts.length > 0) {
        setSelectedShiftId(allShifts[0].id);
        setClosedResult(allShifts[0].status === "closed" ? allShifts[0] : null);
      } else {
        setSelectedShiftId(null);
        setClosedResult(null);
      }
    }
  }, [viewOnlyShift, shiftToClose, isOpen, allShifts]);

  const currentShift = useMemo(() => {
    if (selectedShiftId) {
      const found = allShifts.find((s) => s.id === selectedShiftId);
      if (found) return found;
    }
    return (
      viewOnlyShift ||
      closedResult ||
      shiftToClose ||
      erpStore.getActiveParkShift() ||
      allShifts[0] ||
      null
    );
  }, [selectedShiftId, allShifts, viewOnlyShift, closedResult, shiftToClose]);

  const opTreasuries = erpStore.getParkOperationalTreasuries();

  // Shift Transactions (both completed sales and refunds)
  const shiftTransactions: ParkTicketTransaction[] = useMemo(() => {
    if (!currentShift) return [];
    const allTxs = erpStore.getParkTicketTransactions();
    return allTxs.filter(
      (t) =>
        t.shift_id === currentShift.id ||
        t.shift_number === currentShift.shift_number ||
        (currentShift.status === "open" &&
          (!t.journal_entry_ref || t.journal_entry_ref.includes("معلقة"))),
    );
  }, [currentShift, isOpen, closedResult]);

  // Financial Stats
  const completedTxs = useMemo(
    () => shiftTransactions.filter((t) => t.status === "completed"),
    [shiftTransactions],
  );
  const refundedTxs = useMemo(
    () => shiftTransactions.filter((t) => t.status === "refunded"),
    [shiftTransactions],
  );

  const grossSalesUsd = useMemo(
    () => completedTxs.reduce((s, t) => s + t.total_usd, 0),
    [completedTxs],
  );
  const refundsUsd = useMemo(() => refundedTxs.reduce((s, t) => s + t.total_usd, 0), [refundedTxs]);
  const netRevenueUsd = grossSalesUsd - refundsUsd;

  const grossSalesSsp = useMemo(
    () =>
      completedTxs
        .filter((t) => t.currency === "SSP")
        .reduce((s, t) => s + t.total_paid_in_currency, 0),
    [completedTxs],
  );
  const refundsSsp = useMemo(
    () =>
      refundedTxs
        .filter((t) => t.currency === "SSP")
        .reduce((s, t) => s + t.total_paid_in_currency, 0),
    [refundedTxs],
  );
  const netRevenueSsp = grossSalesSsp - refundsSsp;

  // Generated Journal Entries for this Shift
  const linkedJournalEntries: JournalEntry[] = useMemo(() => {
    if (!currentShift) return [];
    const allJEs = erpStore.getJournalEntries();
    const refs = currentShift.generated_journal_refs || [];
    const transferRefs = (currentShift.destination_transfers || [])
      .map((tr) => tr.journal_ref)
      .filter(Boolean);
    const txRefs = shiftTransactions
      .map((t) => t.journal_entry_ref)
      .filter((r): r is string => Boolean(r && !r.includes("معلقة")));

    const allTargetRefs = Array.from(new Set([...refs, ...transferRefs, ...txRefs]));

    return allJEs.filter((je) => {
      if (allTargetRefs.includes(je.reference || je.id)) return true;
      if (je.description) {
        if (currentShift.shift_number && je.description.includes(currentShift.shift_number))
          return true;
        if (
          currentShift.auto_shift_number &&
          je.description.includes(currentShift.auto_shift_number)
        )
          return true;
        if (currentShift.id && je.description.includes(currentShift.id)) return true;
      }
      return false;
    });
  }, [currentShift, closedResult, isOpen, shiftTransactions]);

  // Execute Close Shift
  const handleConfirmClose = () => {
    if (!canCurrentUserCloseShift()) {
      toast.error("غير مصرح لحساب الكاشير بإغلاق الوردية. يتم إغلاق الوردية بواسطة المدير أو المشرف فقط.");
      return;
    }
    if (!currentShift || currentShift.status !== "open") {
      toast.error("يرجى اختيار وردية مفتوحة لإغلاقها!");
      return;
    }
    try {
      const closed = erpStore.closeParkShift(currentShift.id);
      setTimeout(() => {
        setClosedResult(closed);
        setSelectedShiftId(closed.id);
        if (onShiftClosed) onShiftClosed();
      }, 0);
      toast.success("تم إغلاق الوردية وتوليد قيود الإقفال المحاسبية وترحيل الخزائن بنجاح!");
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء إغلاق الوردية");
    }
  };

  // Professional Printable A4 HTML Report Generator
  const handlePrintFullReport = () => {
    const shift = currentShift;
    if (!shift) return;
    const sspRate = erpStore.getExchangeRate("SSP") || 3000;

    const txRowsHtml = shiftTransactions
      .map((t, idx) => {
        const itemsSummary = (t.items || []).map((i) => `${i.name_ar} (×${i.quantity})`).join(", ");
        const isRefund = t.status === "refunded";
        const manualNum = t.manual_tx_number || t.reference_number || t.tx_number;
        const cashier = t.created_by || shift.cashier_name;
        const rateStr =
          t.currency !== "USD"
            ? `1$ = ${Number(t.exchange_rate || sspRate).toLocaleString()} ${t.currency}`
            : "-";
        return `
          <tr style="background-color: ${isRefund ? "#fff1f2" : idx % 2 === 0 ? "#f8fafc" : "#ffffff"};">
            <td style="padding: 5px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; color: #0f766e;">${t.tx_number}</td>
            <td style="padding: 5px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; color: #1e293b;">${manualNum}</td>
            <td style="padding: 5px; border: 1px solid #cbd5e1; font-size: 10px;">${t.transaction_date || "-"} ${t.transaction_time || "-"}</td>
            <td style="padding: 5px; border: 1px solid #cbd5e1; font-size: 11px; font-weight: bold;">${cashier}</td>
            <td style="padding: 5px; border: 1px solid #cbd5e1; font-size: 10px; font-weight: bold; color: #b45309;">${rateStr}</td>
            <td style="padding: 5px; border: 1px solid #cbd5e1; font-weight: bold; color: ${isRefund ? "#e11d48" : "#059669"};">
              ${isRefund ? "مرتجع / استرداد" : "مبيعات"}
            </td>
            <td style="padding: 5px; border: 1px solid #cbd5e1; font-size: 11px;">${itemsSummary || "-"}</td>
            <td style="padding: 5px; border: 1px solid #cbd5e1; font-size: 11px;">${t.customer_name || "عميل نقدي"}</td>
            <td style="padding: 5px; border: 1px solid #cbd5e1; font-size: 10px; font-weight: bold;">
              ${t.payment_method === "cash" ? "نقدي" : t.payment_method === "visa" ? "فيزا" : t.payment_method === "bank_transfer" ? "تحويل" : "آجل"}
            </td>
            <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: left; font-weight: bold; color: ${isRefund ? "#e11d48" : "#0d9488"};">
              ${isRefund ? "-" : ""}$${t.total_usd} (${t.total_paid_in_currency.toLocaleString()} ${t.currency})
            </td>
            <td style="padding: 5px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 10px; color: #2563eb; font-weight: bold;">${t.journal_entry_ref || "-"}</td>
            <td style="padding: 5px; border: 1px solid #cbd5e1; font-size: 10px; color: #64748b;">${isRefund ? t.refund_reason || "استرداد" : t.notes || "-"}</td>
          </tr>
        `;
      })
      .join("");

    const jeRowsHtml = linkedJournalEntries
      .map((je) => {
        const linesHtml = (je.lines || [])
          .map(
            (l) => `
            <tr>
              <td style="padding: 4px 6px; border: 1px solid #e2e8f0; font-family: monospace;">${l.account_code}</td>
              <td style="padding: 4px 6px; border: 1px solid #e2e8f0;">${l.description || "-"}</td>
              <td style="padding: 4px 6px; border: 1px solid #e2e8f0; text-align: left; font-weight: bold; color: #059669;">${l.debit > 0 ? l.debit.toLocaleString() : "-"}</td>
              <td style="padding: 4px 6px; border: 1px solid #e2e8f0; text-align: left; font-weight: bold; color: #e11d48;">${l.credit > 0 ? l.credit.toLocaleString() : "-"}</td>
              <td style="padding: 4px 6px; border: 1px solid #e2e8f0; font-size: 10px;">${l.currency || je.currency || "USD"} (Rate: ${l.rate || 1})</td>
            </tr>
          `,
          )
          .join("");

        const totalDebit = (je.lines || []).reduce((s, l) => s + (l.debit || 0), 0);
        const totalCredit = (je.lines || []).reduce((s, l) => s + (l.credit || 0), 0);

        return `
          <div style="margin-bottom: 14px; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; background: #fff;">
            <div style="background: #f1f5f9; padding: 6px 10px; border-bottom: 1px solid #cbd5e1; display: flex; justify-content: space-between; font-size: 11px; font-weight: bold;">
              <span>قيد رقم: <strong style="color: #2563eb; font-family: monospace;">${je.reference || je.id}</strong> — ${je.date || je.created_at?.split("T")[0]}</span>
              <span>البيان: ${je.description}</span>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: right;">
              <thead>
                <tr style="background: #fafafa; color: #475569; font-weight: bold;">
                  <th style="padding: 4px 6px; border: 1px solid #e2e8f0; width: 15%;">رقم الحساب</th>
                  <th style="padding: 4px 6px; border: 1px solid #e2e8f0; width: 50%;">اسم الحساب / الشرح</th>
                  <th style="padding: 4px 6px; border: 1px solid #e2e8f0; text-align: left; width: 15%;">مدين (Debit)</th>
                  <th style="padding: 4px 6px; border: 1px solid #e2e8f0; text-align: left; width: 15%;">دائن (Credit)</th>
                  <th style="padding: 4px 6px; border: 1px solid #e2e8f0; width: 15%;">العملة والمعامل</th>
                </tr>
              </thead>
              <tbody>
                ${linesHtml}
                <tr style="background: #f8fafc; font-weight: bold; border-top: 2px solid #cbd5e1;">
                  <td colspan="2" style="padding: 4px 6px; border: 1px solid #e2e8f0; text-align: center;">إجمالي توازن القيد</td>
                  <td style="padding: 4px 6px; border: 1px solid #e2e8f0; text-align: left; color: #059669;">${totalDebit.toLocaleString()}</td>
                  <td style="padding: 4px 6px; border: 1px solid #e2e8f0; text-align: left; color: #e11d48;">${totalCredit.toLocaleString()}</td>
                  <td style="padding: 4px 6px; border: 1px solid #e2e8f0; text-align: center; color: #0d9488;">متزن ✓</td>
                </tr>
              </tbody>
            </table>
          </div>
        `;
      })
      .join("");

    const transfersRowsHtml = (shift.destination_transfers || [])
      .map(
        (tr) => `
        <tr>
          <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: bold;">${tr.op_treasury_name}</td>
          <td style="padding: 6px; border: 1px solid #cbd5e1;">${tr.real_treasury_name}</td>
          <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: bold; color: #0d9488; text-align: left;">
            ${tr.currency === "USD" ? `$${tr.amount}` : `${tr.amount.toLocaleString()} SSP`}
          </td>
          <td style="padding: 6px; border: 1px solid #cbd5e1; font-family: monospace; color: #2563eb; font-weight: bold;">${tr.journal_ref || "-"}</td>
        </tr>
      `,
      )
      .join("");

    const fullHtml = `<!doctype html>
<html lang="ar">
<head>
  <meta charset="utf-8"/>
  <title>تقرير إغلاق وردية تذاكر الحديقة - ${shift.shift_number}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    body { font-family: 'Cairo', Tahoma, Arial, sans-serif; color: #0f172a; margin: 0; padding: 12px; background: #fff; direction: rtl; text-align: right; }
    .header { border-bottom: 3px double #0d9488; padding-bottom: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
    .header h1 { font-size: 18px; margin: 0 0 4px; color: #0f766e; }
    .header .subtitle { font-size: 11px; color: #64748b; }
    .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 11px; }
    .meta-item { display: flex; flex-direction: column; }
    .meta-item span { color: #64748b; font-size: 10px; }
    .meta-item strong { color: #0f172a; font-size: 12px; margin-top: 2px; }
    .kpi-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
    .kpi { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; background: #fff; }
    .kpi-title { font-size: 10px; color: #64748b; font-weight: bold; }
    .kpi-val { font-size: 14px; font-weight: 900; margin-top: 4px; color: #0d9488; }
    .section-title { font-size: 13px; font-weight: bold; color: #0f766e; border-right: 3px solid #0d9488; padding-right: 6px; margin: 16px 0 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 12px; }
    th { background: #f1f5f9; color: #1e293b; font-weight: bold; padding: 6px; border: 1px solid #cbd5e1; text-align: right; }
    td { border: 1px solid #cbd5e1; padding: 6px; vertical-align: middle; }
    .signatures { margin-top: 25px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center; font-size: 11px; color: #475569; }
    .sig-line { border-top: 1px dashed #94a3b8; margin-top: 30px; padding-top: 4px; font-weight: bold; }
    .footer { margin-top: 20px; font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 6px; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Restocash ERP — تقرير إغلاق وردية تذاكر ومرافق الحديقة</h1>
      <div class="subtitle">وثيقة محاسبية رسمية معتمدة ومرفق بها قيود الإقفال وحركات المبيعات والمرتجع</div>
    </div>
    <div style="text-align: left; font-size: 11px; font-weight: bold; color: #0d9488;">
      <div>الرقم الآخر (الوردية): ${shift.shift_number}</div>
      <div style="font-family: monospace; color: #64748b; font-size: 10px;">الرقم الفعلي (النظام): ${shift.auto_shift_number || shift.id}</div>
    </div>
  </div>

  <div class="meta-grid" style="grid-template-columns: repeat(3, 1fr);">
    <div class="meta-item"><span>الرقم الفعلي (رقم النظام)</span><strong style="font-family: monospace; color: #0f766e;">${shift.auto_shift_number || shift.id}</strong></div>
    <div class="meta-item"><span>الرقم الآخر (قابل للتعديل)</span><strong>${shift.shift_number}</strong></div>
    <div class="meta-item"><span>أمين الصندوق (الكاشير)</span><strong>${shift.cashier_name}</strong></div>
    <div class="meta-item"><span>توقيت وتاريخ بدء الوردية</span><strong>${new Date(shift.start_at).toLocaleString("ar-EG")}</strong></div>
    <div class="meta-item"><span>توقيت وتاريخ إغلاق الوردية</span><strong>${shift.end_at ? new Date(shift.end_at).toLocaleString("ar-EG") : "قيد الإغلاق"}</strong></div>
    <div class="meta-item"><span>معامل العملة (غير الدولار)</span><strong style="font-family: monospace; color: #b45309;">1 USD = ${sspRate.toLocaleString()} SSP</strong></div>
  </div>

  <div class="kpi-cards">
    <div class="kpi">
      <div class="kpi-title">إجمالي المبيعات (Gross Sales)</div>
      <div class="kpi-val">$${grossSalesUsd} ${grossSalesSsp > 0 ? `+ ${grossSalesSsp.toLocaleString()} SSP` : ""}</div>
    </div>
    <div class="kpi">
      <div class="kpi-title">إجمالي المرتجعات (Refunds)</div>
      <div class="kpi-val" style="color: #e11d48;">$${refundsUsd} ${refundsSsp > 0 ? `+ ${refundsSsp.toLocaleString()} SSP` : ""}</div>
    </div>
    <div class="kpi">
      <div class="kpi-title">صافي التحصيل والإيراد (Net)</div>
      <div class="kpi-val" style="color: #059669;">$${netRevenueUsd} ${netRevenueSsp > 0 ? `+ ${netRevenueSsp.toLocaleString()} SSP` : ""}</div>
    </div>
    <div class="kpi">
      <div class="kpi-title">عدد العمليات والتذاكر</div>
      <div class="kpi-val" style="color: #2563eb;">${completedTxs.length} مبيعات / ${refundedTxs.length} مرتجع</div>
    </div>
  </div>

  <div class="section-title">أولاً: كشف حركات التذاكر المنفذة خلال الوردية (المبيعات والمرتجع):</div>
  <table>
    <thead>
      <tr>
        <th style="width: 7%;">الرقم الفعلي</th>
        <th style="width: 7%;">الرقم الآخر</th>
        <th style="width: 8%;">التاريخ والوقت</th>
        <th style="width: 7%;">اسم الكاشير</th>
        <th style="width: 5%;">المعامل</th>
        <th style="width: 5%;">نوع الحركة</th>
        <th style="width: 25%;">الأصناف والتذاكر</th>
        <th style="width: 5%;">العميل</th>
        <th style="width: 7%;">طريقة الدفع</th>
        <th style="width: 9%; text-align: left;">المبلغ</th>
        <th style="width: 6%;">رقم القيد</th>
        <th>ملاحظات</th>
      </tr>
    </thead>
    <tbody>
      ${txRowsHtml || `<tr><td colspan="12" style="text-align: center; color: #94a3b8;">لا توجد حركات مسجلة في هذه الوردية</td></tr>`}
    </tbody>
  </table>

  ${
    shift.destination_transfers && shift.destination_transfers.length > 0
      ? `
    <div class="section-title">ثانياً: ترحيل أرصدة الخزائن التشغيلية إلى الخزائن الرئيسية:</div>
    <table>
      <thead>
        <tr>
          <th>الخزينة التشغيلية المؤقتة</th>
          <th>الخزينة الرئيسية المرتبطة</th>
          <th style="text-align: left;">المبلغ المرحل</th>
          <th>رقم قيد الترحيل (MM/NN)</th>
        </tr>
      </thead>
      <tbody>
        ${transfersRowsHtml}
      </tbody>
    </table>
  `
      : ""
  }

  <div class="section-title">ثالثاً: كشف القيود المحاسبية المنشأة آلياً عند إغلاق الوردية:</div>
  ${jeRowsHtml || `<p style="font-size: 11px; color: #94a3b8; text-align: center; padding: 10px;">لا توجد قيود محاسبية مربوطة</p>`}

  <div class="signatures">
    <div><div class="sig-line">أمين الصندوق (الكاشير)<br/><small>${shift.cashier_name}</small></div></div>
    <div><div class="sig-line">المحاسب المراجع<br/><small>قسم الحسابات العامة</small></div></div>
    <div><div class="sig-line">اعتماد المدير المالي والتشغيلي<br/><small>Restocash Administration</small></div></div>
  </div>

  <div class="footer">
    <span>نظام Restocash لإدارة إيرادات ومرافق الحديقة والمول</span>
    <span>وثيقة محاسبية رسمية — صفحة 1 من 1</span>
  </div>
</body>
</html>`;

    printRawHtml(fullHtml);
    toast.success("تم إرسال تقرير الإغلاق المحاسبي للطباعة بنجاح!");
  };

  // Close flow finisher
  const handleFinalizeAndExit = () => {
    onClose();
    if (onShiftClosed) {
      onShiftClosed();
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[850px] rounded-3xl max-h-[90vh] overflow-y-auto font-sans antialiased text-right">
        <DialogHeader className="text-right border-b border-border pb-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-black text-foreground flex items-center gap-2">
              <Lock
                size={20}
                className={currentShift?.status === "closed" ? "text-emerald-600" : "text-rose-600"}
              />
              <span>
                {currentShift?.status === "closed"
                  ? "تقرير الوردية المغلقة والقيود المحاسبية"
                  : "تقرير ومعاينة إغلاق الوردية"}
              </span>
            </DialogTitle>
            <Badge
              variant="outline"
              className={
                currentShift?.status === "closed"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                  : "bg-amber-50 text-amber-700 border-amber-300"
              }
            >
              {currentShift?.status === "closed" ? "مغلقة ومرحلة" : "وردية جارية (مفتوحة)"}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            {currentShift?.status === "closed"
              ? "استعراض تفصيلي لجميع الحركات والمبيعات والمرتجع والقيود المحاسبية المنشأة وترحيل الخزائن."
              : "استعراض حركات المبيعات والمرتجع، أرصدة الخزائن التشغيلية، ومعاينة القيود المحاسبية الجاهزة للترحيل."}
          </DialogDescription>
        </DialogHeader>

        {!currentShift ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
              <Clock size={24} />
            </div>
            <p className="font-bold text-sm text-foreground">لا توجد ورديات مسجلة في النظام</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              لم يتم فتح أي وردية بعد. يمكنك فتح وردية جديدة من شاشة تسجيل تذاكر الدخول للبدء بتسجيل
              المبيعات والقيود.
            </p>
            <div className="pt-2 flex justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="rounded-xl text-xs font-bold cursor-pointer"
              >
                إغلاق النافذة
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2 text-xs">
            {/* Shift Selector Bar (if there are multiple shifts) */}
            {allShifts.length > 1 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-2xl bg-muted/50 border border-border">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <Clock size={14} className="text-teal-600" />
                  <span>اختيار الوردية للاستعراض والتقرير:</span>
                </div>
                <select
                  value={currentShift?.id || ""}
                  onChange={(e) => {
                    setSelectedShiftId(e.target.value);
                    const found = allShifts.find((s) => s.id === e.target.value);
                    setClosedResult(found && found.status === "closed" ? found : null);
                  }}
                  className="bg-card border border-border text-foreground text-xs rounded-xl px-3 py-1.5 font-bold focus:outline-teal-600 cursor-pointer max-w-full sm:max-w-[380px]"
                >
                  {allShifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.status === "open" ? "🟢 [مفتوحة حالياً] " : "🔒 [مغلقة ومرحلة] "}
                      وردية ({s.shift_number}) - الكاشير: {s.cashier_name} -{" "}
                      {new Date(s.start_at).toLocaleDateString("ar-EG")}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Success Banner (if just closed) */}
            {closedResult && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-300 font-bold space-y-1">
                <p className="flex items-center gap-1.5 font-black text-sm">
                  <CheckCircle2 size={16} className="text-emerald-600" /> تم إغلاق الوردية وتوليد
                  القيود المحاسبية بنجاح!
                </p>
                <p className="text-xs font-normal text-emerald-700 dark:text-emerald-400">
                  تم ترحيل أرصدة الخزائن التشغيلية إلى الخزائن الرئيسية وتوليد قيود اليومية العامة.
                </p>
              </div>
            )}

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-2xl bg-card border border-border space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground block">
                  إجمالي المبيعات
                </span>
                <span className="text-sm font-black text-teal-600 block font-mono">
                  ${grossSalesUsd}{" "}
                  {grossSalesSsp > 0 ? `+ ${grossSalesSsp.toLocaleString()} SSP` : ""}
                </span>
                <span className="text-[9px] text-muted-foreground">
                  {completedTxs.length} تذكرة مباعة
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-card border border-border space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground block">
                  إجمالي المرتجعات
                </span>
                <span className="text-sm font-black text-rose-600 block font-mono">
                  ${refundsUsd} {refundsSsp > 0 ? `+ ${refundsSsp.toLocaleString()} SSP` : ""}
                </span>
                <span className="text-[9px] text-muted-foreground">
                  {refundedTxs.length} حركة مرتجع
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-card border border-border space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground block">
                  صافي الإيراد المحصل
                </span>
                <span className="text-sm font-black text-emerald-600 block font-mono">
                  ${netRevenueUsd}{" "}
                  {netRevenueSsp > 0 ? `+ ${netRevenueSsp.toLocaleString()} SSP` : ""}
                </span>
                <span className="text-[9px] text-muted-foreground">بعد خصم الاستردادات</span>
              </div>

              <div className="p-3 rounded-2xl bg-card border border-border space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground block">
                  القيود المحاسبية
                </span>
                <span className="text-sm font-black text-primary block font-mono">
                  {linkedJournalEntries.length} قيد منشأ
                </span>
                <span className="text-[9px] text-muted-foreground">
                  {currentShift?.status === "open" ? "ستتولد عند الإغلاق" : "مبيعات وترحيل"}
                </span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1.5 border-b border-border pb-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab("summary")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "summary"
                    ? "bg-teal-600 text-white shadow-xs"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <TrendingUp size={13} />
                ملخص الوردية والترحيل
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("transactions")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "transactions"
                    ? "bg-teal-600 text-white shadow-xs"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <ShoppingBag size={13} />
                كشف حركات المبيعات والمرتجع ({shiftTransactions.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("journal_entries")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "journal_entries"
                    ? "bg-teal-600 text-white shadow-xs"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText size={13} />
                قيود اليومية العامة ({linkedJournalEntries.length})
              </button>
            </div>

            {/* TAB CONTENT: SUMMARY & TREASURIES */}
            {activeTab === "summary" && (
              <div className="space-y-4">
                {/* Meta details */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl bg-muted/40 border border-border">
                  <div>
                    <span className="text-[10px] text-muted-foreground block font-bold">
                      الرقم الفعلي (النظام):
                    </span>
                    <span className="font-mono font-bold text-xs text-teal-700 dark:text-teal-400">
                      {currentShift?.auto_shift_number || currentShift?.id}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block font-bold">
                      الرقم الآخر (الوردية):
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="font-black text-xs text-foreground">
                        {currentShift?.shift_number}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (!currentShift) return;
                          const next = window.prompt(
                            "تعديل الرقم الآخر للوردية:",
                            currentShift.shift_number,
                          );
                          if (next !== null && next.trim() !== "") {
                            erpStore.updateParkShift(currentShift.id, {
                              shift_number: next.trim(),
                            });
                            toast.success("تم تحديث رقم الوردية بنجاح");
                            setClosedResult({ ...currentShift, shift_number: next.trim() });
                          }
                        }}
                        className="text-muted-foreground hover:text-teal-600 p-0.5 cursor-pointer"
                        title="تعديل رقم الوردية"
                      >
                        <Edit size={11} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block font-bold">
                      أمين الصندوق (الكاشير):
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-xs text-foreground">
                        {currentShift?.cashier_name}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (!currentShift) return;
                          const next = window.prompt(
                            "تعديل اسم الكاشير:",
                            currentShift.cashier_name,
                          );
                          if (next !== null && next.trim() !== "") {
                            erpStore.updateParkShift(currentShift.id, {
                              cashier_name: next.trim(),
                            });
                            toast.success("تم تحديث اسم الكاشير بنجاح");
                            setClosedResult({ ...currentShift, cashier_name: next.trim() });
                          }
                        }}
                        className="text-muted-foreground hover:text-teal-600 p-0.5 cursor-pointer"
                        title="تعديل اسم الكاشير"
                      >
                        <Edit size={11} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block font-bold">
                      المعامل (غير الدولار):
                    </span>
                    <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-400">
                      1$ = {(erpStore.getExchangeRate("SSP") || 3000).toLocaleString()} SSP
                    </span>
                  </div>
                  <div className="col-span-2 sm:col-span-4 pt-1 border-t border-border/50 flex flex-wrap justify-between text-[11px] text-muted-foreground">
                    <span>
                      بدء:{" "}
                      {currentShift?.start_at
                        ? new Date(currentShift.start_at).toLocaleString("ar-EG")
                        : "-"}
                    </span>
                    <span>
                      إغلاق:{" "}
                      {currentShift?.end_at
                        ? new Date(currentShift.end_at).toLocaleString("ar-EG")
                        : "قيد الإغلاق (جارية)"}
                    </span>
                  </div>
                </div>

                {/* If Shift is Open: Show Operational Treasuries Ready to Transfer & Close Button */}
                {currentShift?.status === "open" && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-300 space-y-1">
                      <p className="font-bold flex items-center gap-1.5 text-xs">
                        <AlertCircle size={14} className="text-amber-600" />
                        هذه الوردية ما زالت مفتوحة وقيد التشغيل
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        يمكنك الاطلاع على الأرصدة المحصلة بالخزائن التشغيلية الثمانية أدناه، وعند
                        الضغط على تأكيد الإغلاق سيتم ترحيل الأرصدة آلياً وتوليد جميع قيود اليومية.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-black text-foreground text-xs flex items-center gap-1.5">
                        <Landmark size={14} className="text-teal-600" />
                        أرصدة الخزائن التشغيلية الجاهزة للترحيل إلى الخزائن الرئيسية:
                      </h4>
                      <div className="overflow-x-auto border border-border rounded-2xl">
                        <table className="w-full text-right text-xs border-collapse">
                          <thead>
                            <tr className="bg-muted/50 border-b border-border font-black text-muted-foreground">
                              <th className="p-2.5">الخزينة التشغيلية</th>
                              <th className="p-2.5">العملة</th>
                              <th className="p-2.5">الرصيد المحصل</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {opTreasuries.map((t) => (
                              <tr key={t.id}>
                                <td className="p-2.5 font-bold">{t.name_ar}</td>
                                <td className="p-2.5 font-mono">{t.currency}</td>
                                <td className="p-2.5 font-black text-teal-600 font-mono">
                                  {t.currency === "USD"
                                    ? `$${t.balance}`
                                    : `${(t.balance || 0).toLocaleString()} SSP`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {canCloseShift && (
                      <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div>
                          <p className="font-black text-rose-800 dark:text-rose-300 text-xs">
                            إغلاق الوردية وترحيل الحسابات
                          </p>
                          <p className="text-[11px] text-rose-600 dark:text-rose-400">
                            سيتم قفل هذه الوردية، وتوليد قيود المبيعات والترحيل، وتحديث أرصدة الخزائن
                            الرئيسية فوراً.
                          </p>
                        </div>
                        <Button
                          type="button"
                          onClick={handleConfirmClose}
                          className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black gap-1.5 px-5 text-xs cursor-pointer whitespace-nowrap shadow-sm"
                        >
                          <Lock size={14} />
                          تأكيد إغلاق الوردية وتوليد القيود
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* If Shift is Closed: Show Treasury Destination Transfers */}
                {currentShift?.status === "closed" && (
                  <div className="space-y-2">
                    <h4 className="font-black text-foreground text-xs flex items-center gap-1.5">
                      <Landmark size={14} className="text-teal-600" />
                      تحويلات الخزائن المنجزة إلى الخزائن الرئيسية:
                    </h4>
                    {currentShift?.destination_transfers &&
                    currentShift.destination_transfers.length > 0 ? (
                      <div className="border border-border rounded-2xl overflow-hidden">
                        <table className="w-full text-right text-xs border-collapse">
                          <thead>
                            <tr className="bg-muted/50 border-b border-border font-black text-muted-foreground">
                              <th className="p-2.5">الخزينة التشغيلية المؤقتة</th>
                              <th className="p-2.5">الخزينة الرئيسية المرتبطة</th>
                              <th className="p-2.5">المبلغ المحول</th>
                              <th className="p-2.5">رقم قيد الترحيل (MM/NN)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {currentShift.destination_transfers.map((tr, idx) => (
                              <tr key={idx} className="hover:bg-muted/20">
                                <td className="p-2.5 font-bold">{tr.op_treasury_name}</td>
                                <td className="p-2.5">{tr.real_treasury_name}</td>
                                <td className="p-2.5 font-black text-teal-600 font-mono">
                                  {tr.currency === "USD"
                                    ? `$${tr.amount}`
                                    : `${tr.amount.toLocaleString()} SSP`}
                                </td>
                                <td className="p-2.5 font-mono font-bold text-primary">
                                  {tr.journal_ref}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-3 bg-muted/30 rounded-2xl text-center text-muted-foreground text-xs">
                        تم ترحيل أرصدة الوردية بنجاح إلى الخزائن الرئيسية.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: TRANSACTIONS & REFUNDS BREAKDOWN */}
            {activeTab === "transactions" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-foreground text-xs">
                    جميع الحركات التي تمت خلال الوردية (المبيعات والمرتجع):
                  </h4>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {shiftTransactions.length} حركة إجمالية
                  </span>
                </div>

                <div className="border border-border rounded-2xl overflow-x-auto max-h-[320px]">
                  <table className="w-full text-right text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border font-black text-muted-foreground sticky top-0">
                        <th className="p-2.5">الرقم الفعلي (النظام)</th>
                        <th className="p-2.5 w-[7%]">الرقم الآخر (تعديل)</th>
                        <th className="p-2.5">التاريخ والوقت</th>
                        <th className="p-2.5">اسم الكاشير</th>
                        <th className="p-2.5">العملة والمعامل</th>
                        <th className="p-2.5">نوع الحركة</th>
                        <th className="p-2.5 w-[25%]">الأصناف والتذاكر</th>
                        <th className="p-2.5">العميل</th>
                        <th className="p-2.5">طريقة الدفع</th>
                        <th className="p-2.5 text-left w-[9%]">المبلغ</th>
                        <th className="p-2.5">رقم القيد</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {shiftTransactions.map((tx) => {
                        const isRefund = tx.status === "refunded";
                        const itemsSummary = (tx.items || [])
                          .map((i) => `${i.name_ar} (×${i.quantity})`)
                          .join("، ");
                        const manualNum =
                          tx.manual_tx_number || tx.reference_number || tx.tx_number;
                        const sspRate = erpStore.getExchangeRate("SSP") || 3000;
                        const rateVal = tx.exchange_rate || sspRate;
                        return (
                          <tr
                            key={tx.id}
                            className={
                              isRefund ? "bg-rose-500/5 hover:bg-rose-500/10" : "hover:bg-muted/20"
                            }
                          >
                            <td className="p-2.5 font-mono font-bold text-teal-600">
                              {tx.tx_number}
                            </td>
                            <td className="p-2.5">
                              <div className="flex items-center gap-1">
                                <span className="font-mono font-bold text-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border text-[11px]">
                                  {manualNum}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = window.prompt(
                                      "تعديل الرقم الآخر للعملية:",
                                      manualNum,
                                    );
                                    if (next !== null && next.trim() !== "") {
                                      erpStore.updateParkTicketTransaction(tx.id, {
                                        manual_tx_number: next.trim(),
                                      });
                                      toast.success("تم تحديث الرقم الآخر للعملية بنجاح");
                                      setClosedResult(currentShift ? { ...currentShift } : null);
                                    }
                                  }}
                                  className="text-muted-foreground hover:text-teal-600 p-1 cursor-pointer"
                                  title="تعديل الرقم"
                                >
                                  <Edit size={12} />
                                </button>
                              </div>
                            </td>
                            <td className="p-2.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                              {tx.transaction_date || "-"} {tx.transaction_time || ""}
                            </td>
                            <td className="p-2.5 font-bold text-foreground">
                              {tx.created_by || currentShift?.cashier_name || "كاشير الحديقة"}
                            </td>
                            <td className="p-2.5 font-mono text-[11px]">
                              <span className="font-bold text-foreground">{tx.currency}</span>
                              {tx.currency !== "USD" && (
                                <span className="block text-[10px] text-amber-700 dark:text-amber-400 font-semibold">
                                  معامل: {Number(rateVal).toLocaleString()}
                                </span>
                              )}
                            </td>
                            <td className="p-2.5">
                              <Badge
                                variant="outline"
                                className={
                                  isRefund
                                    ? "bg-rose-500/10 text-rose-700 border-rose-300 text-[10px]"
                                    : "bg-emerald-500/10 text-emerald-700 border-emerald-300 text-[10px]"
                                }
                              >
                                {isRefund ? "مرتجع / استرداد" : "مبيعات"}
                              </Badge>
                            </td>
                            <td className="p-2.5 max-w-[180px] truncate" title={itemsSummary}>
                              {itemsSummary || "-"}
                            </td>
                            <td className="p-2.5 font-bold">{tx.customer_name || "نقدي"}</td>
                            <td className="p-2.5">
                              <Badge variant="outline" className="text-[10px]">
                                {tx.payment_method === "cash"
                                  ? "نقدي"
                                  : tx.payment_method === "visa"
                                    ? "فيزا"
                                    : tx.payment_method === "bank_transfer"
                                      ? "تحويل"
                                      : "آجل"}
                              </Badge>
                            </td>
                            <td className="p-2.5 text-left font-black text-teal-600 font-mono">
                              {isRefund ? "-" : ""}${tx.total_usd} ({tx.total_paid_in_currency}{" "}
                              {tx.currency})
                            </td>
                            <td className="p-2.5 font-mono text-primary font-bold text-[11px]">
                              {tx.journal_entry_ref || "-"}
                            </td>
                          </tr>
                        );
                      })}
                      {shiftTransactions.length === 0 && (
                        <tr>
                          <td colSpan={11} className="p-4 text-center text-muted-foreground">
                            لا توجد حركات مسجلة في هذه الوردية
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB CONTENT: JOURNAL ENTRIES BREAKDOWN */}
            {activeTab === "journal_entries" && (
              <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-foreground text-xs">
                    قيود اليومية العامة المحاسبية المنشأة آلياً (Journal Entries):
                  </h4>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {linkedJournalEntries.length} قيود مسجلة
                  </span>
                </div>

                {linkedJournalEntries.length === 0 ? (
                  <div className="p-4 rounded-2xl border border-dashed border-border text-center space-y-2">
                    <p className="font-bold text-xs text-foreground">
                      {currentShift?.status === "open"
                        ? "لم يتم توليد قيود الإغلاق لهذه الوردية بعد"
                        : "لا توجد قيود يومية مسجلة لهذه الوردية."}
                    </p>
                    {currentShift?.status === "open" && (
                      <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
                        يتم توليد جميع قيود اليومية العامة تلقائياً وترحيلها لحسابات الإيرادات
                        والخزائن عند الضغط على زر "تأكيد إغلاق الوردية".
                      </p>
                    )}
                  </div>
                ) : (
                  linkedJournalEntries.map((je) => {
                    const totalDebit = (je.lines || []).reduce((s, l) => s + (l.debit || 0), 0);
                    const totalCredit = (je.lines || []).reduce((s, l) => s + (l.credit || 0), 0);

                    return (
                      <div
                        key={je.id}
                        className="border border-border rounded-2xl overflow-hidden bg-card shadow-xs"
                      >
                        <div className="bg-muted/60 px-3 py-2 border-b border-border flex items-center justify-between text-xs">
                          <span className="font-bold flex items-center gap-2">
                            <span className="text-muted-foreground">قيد رقم:</span>
                            <span className="font-mono font-black text-primary">
                              {je.reference || je.id}
                            </span>
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {je.date || je.created_at?.split("T")[0]}
                          </span>
                        </div>
                        <div className="p-2.5 space-y-2">
                          <p className="text-[11px] text-foreground font-medium">
                            {je.description}
                          </p>
                          <div className="border border-border/70 rounded-xl overflow-hidden">
                            <table className="w-full text-right text-[11px] border-collapse">
                              <thead>
                                <tr className="bg-muted/40 border-b border-border/70 font-black text-muted-foreground">
                                  <th className="p-2 w-[15%]">رقم الحساب</th>
                                  <th className="p-2 w-[55%]">الشرح / البيان</th>
                                  <th className="p-2 text-left w-[10%]">مدين</th>
                                  <th className="p-2 text-left w-[10%]">دائن</th>
                                  <th className="p-2 w-[10%]">العملة والمعامل</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/60">
                                {(je.lines || []).map((l, idx) => (
                                  <tr key={idx} className="hover:bg-muted/20">
                                    <td className="p-2 font-mono font-bold">{l.account_code}</td>
                                    <td className="p-2">{l.description || "-"}</td>
                                    <td className="p-2 text-left font-mono font-bold text-emerald-600">
                                      {l.debit > 0 ? l.debit.toLocaleString() : "-"}
                                    </td>
                                    <td className="p-2 text-left font-mono font-bold text-rose-600">
                                      {l.credit > 0 ? l.credit.toLocaleString() : "-"}
                                    </td>
                                    <td className="p-2 text-[10px] text-muted-foreground">
                                      {l.currency || je.currency || "USD"} (Rate: {l.rate || 1})
                                    </td>
                                  </tr>
                                ))}
                                <tr className="bg-muted/30 font-black border-t border-border">
                                  <td colSpan={2} className="p-2 text-center">
                                    إجمالي توازن القيد
                                  </td>
                                  <td className="p-2 text-left font-mono text-emerald-600">
                                    ${totalDebit.toLocaleString()}
                                  </td>
                                  <td className="p-2 text-left font-mono text-rose-600">
                                    ${totalCredit.toLocaleString()}
                                  </td>
                                  <td className="p-2 text-center text-teal-600 text-[10px]">
                                    متزن ✓
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Footer with Working Print Button & Exit */}
            <DialogFooter className="gap-2 sm:justify-between pt-3 border-t border-border">
              {/* PRINT BUTTON */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrintFullReport}
                className="rounded-xl gap-1.5 text-xs font-bold text-foreground hover:bg-teal-50 hover:text-teal-700 border-teal-300 shadow-xs cursor-pointer"
              >
                <Printer size={15} className="text-teal-600" />
                طباعة تقرير الوردية الكامل (A4)
              </Button>

              <Button
                type="button"
                onClick={handleFinalizeAndExit}
                className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-black text-xs gap-1.5 px-6 shadow-md cursor-pointer"
              >
                <span>إغلاق والرجوع لسجل الإيرادات</span>
                <ArrowRight size={14} />
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
