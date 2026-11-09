// @ts-nocheck
import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { erpStore } from "@/shared/services/erpStore";
import { canCurrentUserCloseShift } from "@/shared/services/userAuthorization";
import { printAccountingDocument } from "@/shared/utils/printAccountingDocument";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Wallet,
  ArrowLeft,
  Filter,
  Search,
  CalendarDays,
  X,
  Clock,
  ArrowLeftRight,
  Printer,
  FileSpreadsheet,
  User,
  ShoppingBag,
  Lock,
  Eye,
  RotateCcw,
  XCircle,
} from "lucide-react";

interface ParkCashierTreasuryManagerViewProps {
  shifts: any[];
  transactions: any[];
  onBack: () => void;
  onCloseShift: (shift: any) => void;
  onViewShiftReport: (shift: any) => void;
  onReviewTransaction: (tx: any) => void;
  onRefundTransaction: (tx: any) => void;
}

export function ParkCashierTreasuryManagerView({
  shifts = [],
  transactions = [],
  onBack,
  onCloseShift,
  onViewShiftReport,
  onReviewTransaction,
  onRefundTransaction,
}: ParkCashierTreasuryManagerViewProps) {
  const canCloseShifts = canCurrentUserCloseShift();
  const erpState = erpStore.getState();

  // Search & Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedShiftId, setSelectedShiftId] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [shiftStatusFilter, setShiftStatusFilter] = useState<"all" | "open" | "closed">("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [activePreset, setActivePreset] = useState<string>("all");

  // Transfer & Journal Entry Modal state
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferTargetTreasury, setTransferTargetTreasury] = useState("");
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [transferCurrency, setTransferCurrency] = useState<string>("USD");
  const [transferPaymentMethod, setTransferPaymentMethod] = useState<string>("cash");

  const applyQuickDate = (preset: string) => {
    setActivePreset(preset);
    const now = new Date();
    const format = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    if (preset === "today") {
      const todayStr = format(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "yesterday") {
      const yest = new Date(now);
      yest.setDate(now.getDate() - 1);
      const yestStr = format(yest);
      setStartDate(yestStr);
      setEndDate(yestStr);
    } else if (preset === "last7") {
      const last7 = new Date(now);
      last7.setDate(now.getDate() - 7);
      setStartDate(format(last7));
      setEndDate(format(now));
    } else if (preset === "thisMonth") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(format(firstDay));
      setEndDate(format(now));
    } else if (preset === "all") {
      setStartDate("");
      setEndDate("");
    }
  };

  const allShifts = useMemo(() => {
    return (shifts || []).slice().sort((a: any, b: any) => {
      return (
        new Date(b.opened_at || b.start_at || Date.now()).getTime() -
        new Date(a.opened_at || a.start_at || Date.now()).getTime()
      );
    });
  }, [shifts]);

  const resolveTxShift = (tx: any) => {
    if (!tx) return null;
    if (tx.shift_id) {
      const byId = allShifts.find((s: any) => s.id === tx.shift_id);
      if (byId) return byId;
    }
    if (tx.shift_number) {
      const byNum = allShifts.find((s: any) => s.shift_number === tx.shift_number);
      if (byNum) return byNum;
    }
    if (tx.created_at) {
      const txTime = new Date(tx.created_at).getTime();
      const matched = allShifts.find((s: any) => {
        const start = new Date(s.opened_at || s.start_at || Date.now()).getTime() - 60000;
        const end =
          s.closed_at || s.end_at
            ? new Date(s.closed_at || s.end_at).getTime() + 60000
            : Date.now() + 3600000;
        return txTime >= start && txTime <= end;
      });
      if (matched) return matched;
    }
    return null;
  };

  const distinctUsers = useMemo(() => {
    const set = new Set<string>();
    allShifts.forEach((s: any) => {
      if (s.cashier_name && String(s.cashier_name).trim()) {
        set.add(String(s.cashier_name).trim());
      }
    });
    (transactions || []).forEach((tx: any) => {
      const cname = tx.cashier_name || tx.created_by;
      if (cname && String(cname).trim()) {
        set.add(String(cname).trim());
      }
    });
    return Array.from(set);
  }, [allShifts, transactions]);

  const filteredShifts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return allShifts.filter((s: any) => {
      if (selectedShiftId !== "all" && s.id !== selectedShiftId) return false;
      if (
        selectedUser !== "all" &&
        String(s.cashier_name || "").trim().toLowerCase() !== selectedUser.toLowerCase()
      ) {
        return false;
      }
      if (shiftStatusFilter !== "all" && s.status !== shiftStatusFilter) return false;

      if (startDate || endDate) {
        const shiftDate = new Date(s.opened_at || s.start_at || Date.now());
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (shiftDate < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (shiftDate > end) return false;
        }
      }

      if (q) {
        const matchShift =
          String(s.shift_number || "").toLowerCase().includes(q) ||
          String(s.auto_shift_number || "").toLowerCase().includes(q) ||
          String(s.cashier_name || "").toLowerCase().includes(q) ||
          String(s.id || "").toLowerCase().includes(q);

        const hasMatchingTx = (transactions || []).some((tx: any) => {
          const tShift = resolveTxShift(tx);
          if (!tShift || tShift.id !== s.id) return false;
          return (
            String(tx.tx_number || tx.transaction_number || "").toLowerCase().includes(q) ||
            String(tx.customer_name || "").toLowerCase().includes(q)
          );
        });

        if (!matchShift && !hasMatchingTx) return false;
      }

      return true;
    });
  }, [
    allShifts,
    transactions,
    searchTerm,
    selectedShiftId,
    selectedUser,
    shiftStatusFilter,
    startDate,
    endDate,
  ]);

  const filteredTransactions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return (transactions || []).filter((tx: any) => {
      const txShift = resolveTxShift(tx);
      const txCashier = String(
        tx.cashier_name || tx.created_by || txShift?.cashier_name || "",
      ).trim();

      if (selectedShiftId !== "all") {
        if (!txShift || txShift.id !== selectedShiftId) return false;
      }

      if (selectedUser !== "all") {
        if (txCashier.toLowerCase() !== selectedUser.toLowerCase()) return false;
      }

      if (shiftStatusFilter !== "all" && txShift) {
        if (txShift.status !== shiftStatusFilter) return false;
      }

      if (paymentMethodFilter !== "all") {
        if (paymentMethodFilter === "refunded") {
          if (tx.status !== "refunded") return false;
        } else if (tx.payment_method !== paymentMethodFilter) {
          return false;
        }
      }

      if (startDate || endDate) {
        const txDate = new Date(tx.created_at || Date.now());
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (txDate < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (txDate > end) return false;
        }
      }

      if (q) {
        const matchTx =
          String(tx.tx_number || tx.transaction_number || "").toLowerCase().includes(q) ||
          String(tx.customer_name || "").toLowerCase().includes(q) ||
          txCashier.toLowerCase().includes(q) ||
          String(txShift?.shift_number || "").toLowerCase().includes(q) ||
          String(txShift?.auto_shift_number || "").toLowerCase().includes(q);
        if (!matchTx) return false;
      }

      return true;
    });
  }, [
    transactions,
    allShifts,
    searchTerm,
    selectedShiftId,
    selectedUser,
    shiftStatusFilter,
    paymentMethodFilter,
    startDate,
    endDate,
  ]);

  const parkTreasury =
    (erpState.treasuries || []).find(
      (t: any) => !t.deleted && (t.name_ar?.includes("الحديقة") || t.id === "tr-park"),
    ) ||
    (erpState.treasuries || [])[0];
  const parkTreasuryId = parkTreasury?.id || "tr-1";

  const shiftSalesUsdTotal = useMemo(() => {
    return filteredTransactions
      .filter((t: any) => t.status !== "refunded")
      .reduce(
        (acc: number, t: any) => acc + Number(t.total_usd || t.total_amount_usd || 0),
        0,
      );
  }, [filteredTransactions]);

  const handleTransferMoney = () => {
    if (!transferTargetTreasury) {
      toast.error("يرجى اختيار الخزينة المستهدفة للترحيل");
      return;
    }
    if (!transferAmount || transferAmount <= 0) {
      toast.error("يرجى إدخال مبلغ صحيح للترحيل");
      return;
    }

    try {
      const targetTr = (erpState.treasuries || []).find(
        (t: any) => t.id === transferTargetTreasury,
      );
      erpStore.transferBetweenTreasuries(
        parkTreasuryId,
        transferTargetTreasury,
        Number(transferAmount),
        `ترحيل نقدية مبيعات كاشير الحديقة وتوليد قيد محاسبي (${transferPaymentMethod})`,
        transferCurrency,
      );
      toast.success(
        `تم ترحيل ${Number(transferAmount).toLocaleString()} ${transferCurrency} وتوليد القيد المحاسبي إلى ${targetTr?.name_ar || "الخزينة الرئيسية"}`,
      );
      setTransferDialogOpen(false);
      setTransferAmount(0);
    } catch (err: any) {
      toast.error(err.message || "تعذر ترحيل النقدية");
    }
  };

  const handleExportExcel = () => {
    try {
      const rows = filteredTransactions.map((tx: any) => {
        const s = resolveTxShift(tx);
        return {
          "رقم الفاتورة": tx.tx_number || tx.transaction_number || tx.id,
          "رقم الوردية الفريد": s?.auto_shift_number || "-",
          "اسم الوردية": s?.shift_number || "-",
          "الكاشير": tx.cashier_name || tx.created_by || s?.cashier_name || "-",
          "العميل": tx.customer_name || "عميل نقدي",
          "التاريخ والوقت": tx.created_at ? new Date(tx.created_at).toLocaleString("ar-EG") : "-",
          "طريقة الدفع":
            tx.payment_method === "visa"
              ? "فيزا / بطاقة"
              : tx.payment_method === "bank_transfer"
                ? "تحويل / محفظة"
                : "نقدي",
          "المبلغ بالدولار": Number(tx.total_usd || tx.total_amount_usd || 0),
          "الحالة": tx.status === "refunded" ? "مرتجع" : "مكتمل",
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "فواتير وورديات الحديقة");
      XLSX.writeFile(wb, `park_shifts_invoices_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("تم تصدير ملف Excel");
    } catch {
      toast.error("حدث خطأ أثناء تصدير ملف Excel");
    }
  };

  const handlePrintReport = () => {
    printAccountingDocument({
      title: "تقرير ورديات وفواتير كاشير الحديقة",
      subtitle:
        startDate || endDate
          ? `الفترة: ${startDate || "البداية"} إلى ${endDate || "اليوم"}`
          : "جميع الأوقات",
      metadata: [
        { label: "عدد الورديات", value: String(filteredShifts.length) },
        { label: "إجمالي الفواتير", value: String(filteredTransactions.length) },
        {
          label: "صافي المبيعات (USD)",
          value: `$${shiftSalesUsdTotal.toLocaleString()}`,
        },
      ],
      columns: [
        { header: "رقم الفاتورة", key: "tx_number" },
        { header: "الوردية", key: "shift_name" },
        { header: "الكاشير", key: "cashier" },
        { header: "التاريخ", key: "date" },
        { header: "طريقة الدفع", key: "payment" },
        { header: "المبلغ (USD)", key: "amount" },
        { header: "الحالة", key: "status" },
      ],
      rows: filteredTransactions.map((tx: any) => {
        const s = resolveTxShift(tx);
        return {
          tx_number: tx.tx_number || tx.transaction_number || tx.id,
          shift_name: s?.shift_number || "-",
          cashier: tx.cashier_name || tx.created_by || s?.cashier_name || "-",
          date: tx.created_at ? new Date(tx.created_at).toLocaleString("ar-EG") : "-",
          payment:
            tx.payment_method === "visa"
              ? "فيزا / بطاقة"
              : tx.payment_method === "bank_transfer"
                ? "تحويل / محفظة"
                : "نقدي",
          amount: `$${Number(tx.total_usd || tx.total_amount_usd || 0).toLocaleString()}`,
          status: tx.status === "refunded" ? "مرتجع" : "مكتمل",
        };
      }),
    });
  };

  const selectedShiftObj =
    selectedShiftId !== "all" ? allShifts.find((s: any) => s.id === selectedShiftId) : null;

  return (
    <div className="space-y-3 animate-in fade-in duration-200" dir="rtl">
      {/* Compact Header + Search & Filter Toolbar */}
      <div className="bg-card border border-border rounded-2xl p-3 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap border-b border-border/60 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
              <Wallet size={16} />
            </div>
            <h2 className="text-sm sm:text-base font-black text-foreground">
              شاشة الكاشير والخزينة — إدارة الحديقة
            </h2>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {(searchTerm ||
              selectedShiftId !== "all" ||
              selectedUser !== "all" ||
              shiftStatusFilter !== "all" ||
              paymentMethodFilter !== "all" ||
              startDate ||
              endDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedShiftId("all");
                  setSelectedUser("all");
                  setShiftStatusFilter("all");
                  setPaymentMethodFilter("all");
                  applyQuickDate("all");
                }}
                className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold gap-1 h-8 rounded-xl cursor-pointer"
              >
                <X size={13} />
                <span>إلغاء التصفية</span>
              </Button>
            )}

            <Button
              size="sm"
              onClick={() => {
                setTransferCurrency("USD");
                setTransferPaymentMethod("cash");
                setTransferAmount(shiftSalesUsdTotal);
                setTransferDialogOpen(true);
              }}
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs h-8 px-3 rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeftRight size={13} />
              <span>ترحيل النقدية وتوليد قيد</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handlePrintReport}
              className="font-bold text-xs h-8 px-3 rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <Printer size={13} />
              <span>طباعة التقرير</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleExportExcel}
              className="font-bold text-xs h-8 px-3 rounded-xl flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 cursor-pointer"
            >
              <FileSpreadsheet size={13} />
              <span>Excel</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onBack}
              className="h-8 px-3 rounded-xl text-xs font-bold gap-1 cursor-pointer"
            >
              <ArrowLeft size={13} />
              <span>رجوع</span>
            </Button>
          </div>
        </div>

        {/* Search Inputs Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 items-center">
          <div className="relative lg:col-span-2">
            <Search size={14} className="absolute right-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="بحث برقم الفاتورة أو الوردية أو الكاشير..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-8 h-8 text-xs font-bold rounded-xl bg-background"
            />
          </div>

          <select
            value={selectedShiftId}
            onChange={(e) => setSelectedShiftId(e.target.value)}
            className="w-full h-8 rounded-xl border border-input bg-background px-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="all">كل الورديات ({allShifts.length})</option>
            {allShifts.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.shift_number} {s.auto_shift_number ? `(${s.auto_shift_number})` : ""} —{" "}
                {s.cashier_name} [{s.status === "open" ? "مفتوحة" : "مغلقة"}]
              </option>
            ))}
          </select>

          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="w-full h-8 rounded-xl border border-input bg-background px-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="all">كل المستخدمين ({distinctUsers.length})</option>
            {distinctUsers.map((u) => (
              <option key={u} value={u}>
                المستخدم: {u}
              </option>
            ))}
          </select>

          <select
            value={shiftStatusFilter}
            onChange={(e) => setShiftStatusFilter(e.target.value as any)}
            className="w-full h-8 rounded-xl border border-input bg-background px-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="all">حالة الوردية: الكل</option>
            <option value="open">المفتوحة فقط</option>
            <option value="closed">المغلقة فقط</option>
          </select>

          <div className="flex items-center gap-1">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setActivePreset("custom");
              }}
              className="h-8 text-[11px] rounded-xl bg-background px-2"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setActivePreset("custom");
              }}
              className="h-8 text-[11px] rounded-xl bg-background px-2"
            />
          </div>
        </div>
      </div>

      {/* Side-by-Side Single-Viewport Grid: Part 1 (Shifts) & Part 2 (Invoices) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        {/* PART 1: الورديات المطابقة للبحث (5 cols) */}
        <div className="lg:col-span-5 bg-card border border-border rounded-2xl p-3 shadow-xs flex flex-col max-h-[calc(100vh-235px)]">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2 mb-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <Clock size={15} className="text-teal-600" />
              <h3 className="text-xs sm:text-sm font-black text-foreground">
                الورديات المطابقة للبحث
              </h3>
              <Badge variant="outline" className="font-mono text-[10px]">
                {filteredShifts.length} وردية
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              {[
                { key: "today", label: "اليوم" },
                { key: "all", label: "الكل" },
              ].map((p) => (
                <Button
                  key={p.key}
                  size="sm"
                  variant={activePreset === p.key ? "default" : "outline"}
                  onClick={() => applyQuickDate(p.key)}
                  className={`text-[10px] h-6 px-2 font-bold rounded-lg cursor-pointer ${
                    activePreset === p.key ? "bg-teal-600 text-white" : ""
                  }`}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="overflow-y-auto flex-1 space-y-2 pr-0.5">
            {filteredShifts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground font-bold text-xs">
                لا توجد ورديات مطابقة لشروط البحث
              </div>
            ) : (
              filteredShifts.map((s: any) => {
                const sTxs = (transactions || []).filter((t: any) => {
                  const tShift = resolveTxShift(t);
                  return tShift?.id === s.id;
                });
                const isSelected = selectedShiftId === s.id;

                return (
                  <div
                    key={s.id}
                    className={`p-2.5 rounded-xl border transition text-xs space-y-2 ${
                      isSelected
                        ? "bg-teal-500/10 border-teal-500/40"
                        : "bg-background hover:bg-muted/30 border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-foreground">{s.shift_number}</span>
                        <span className="font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                          ({s.auto_shift_number || s.id.slice(0, 8)})
                        </span>
                        <span className="text-muted-foreground font-bold">
                          • {s.cashier_name}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.status === "open"
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {s.status === "open" ? "مفتوحة" : "مغلقة"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground font-mono">
                      <span>{new Date(s.opened_at || s.start_at).toLocaleString("ar-EG")}</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {sTxs.length} فاتورة
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-border/50">
                      <Button
                        size="sm"
                        variant={isSelected ? "default" : "outline"}
                        onClick={() => setSelectedShiftId(isSelected ? "all" : s.id)}
                        className={`h-7 px-2 rounded-lg text-[11px] font-bold gap-1 cursor-pointer ${
                          isSelected ? "bg-teal-600 text-white" : ""
                        }`}
                      >
                        <ShoppingBag size={11} />
                        <span>{isSelected ? "إلغاء التحديد" : "استخراج الفواتير"}</span>
                      </Button>

                      {s.status === "open" && canCloseShifts && (
                        <Button
                          size="sm"
                          onClick={() => onCloseShift(s)}
                          className="h-7 px-2 rounded-lg text-[11px] font-bold gap-1 bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
                        >
                          <Lock size={11} />
                          <span>غلق الوردية</span>
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onViewShiftReport(s)}
                        className="h-7 px-2 rounded-lg text-[11px] font-bold gap-1 cursor-pointer"
                      >
                        <Printer size={11} />
                        <span>التقرير والقيود</span>
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* PART 2: الفواتير والإيصالات المستخرجة (7 cols) */}
        <div className="lg:col-span-7 bg-card border border-border rounded-2xl p-3 shadow-xs flex flex-col max-h-[calc(100vh-235px)]">
          <div className="flex items-center justify-between gap-2 flex-wrap border-b border-border/60 pb-2 mb-2 shrink-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <ShoppingBag size={15} className="text-emerald-600" />
              <h3 className="text-xs sm:text-sm font-black text-foreground">
                الفواتير والإيصالات المستخرجة
              </h3>
              <Badge variant="outline" className="font-mono text-[10px]">
                {filteredTransactions.length} فاتورة
              </Badge>
              {selectedShiftObj && (
                <Badge className="bg-teal-600 text-white text-[10px] font-bold gap-1">
                  <span>{selectedShiftObj.shift_number}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedShiftId("all")}
                    className="hover:text-rose-200 cursor-pointer"
                  >
                    <X size={11} />
                  </button>
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1 flex-wrap">
              {[
                { key: "all", label: "الكل" },
                { key: "cash", label: "نقدي" },
                { key: "visa", label: "بطاقة" },
                { key: "bank_transfer", label: "تحويل" },
                { key: "refunded", label: "المرتجعات" },
              ].map((pm) => (
                <Button
                  key={pm.key}
                  size="sm"
                  variant={paymentMethodFilter === pm.key ? "default" : "outline"}
                  onClick={() => setPaymentMethodFilter(pm.key)}
                  className={`h-6 px-2 rounded-lg text-[10px] font-bold cursor-pointer ${
                    paymentMethodFilter === pm.key
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : ""
                  }`}
                >
                  {pm.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="overflow-y-auto flex-1 space-y-2 pr-0.5">
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border rounded-2xl">
                لا توجد فواتير مطابقة للبحث
              </div>
            ) : (
              filteredTransactions.map((tx: any) => {
                const isRefunded = tx.status === "refunded";
                const txShift = resolveTxShift(tx);
                const usdAmt = Number(tx.total_usd || tx.total_amount_usd || 0);
                const paidCurr = tx.currency || "USD";
                const paidAmt = Number(tx.total_paid_in_currency || usdAmt);

                return (
                  <div
                    key={tx.id}
                    className={`p-2.5 rounded-xl border transition-all ${
                      isRefunded
                        ? "bg-rose-500/5 border-rose-500/30"
                        : "bg-background hover:bg-muted/30 border-border"
                    } flex flex-col sm:flex-row sm:items-center justify-between gap-2.5`}
                  >
                    <div className="space-y-1 text-right flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-xs text-foreground font-mono">
                          فاتورة #{tx.tx_number || tx.transaction_number || tx.id}
                        </span>
                        {txShift && (
                          <Badge variant="outline" className="text-[10px] font-bold">
                            {txShift.shift_number}
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-[10px] font-bold">
                          {tx.cashier_name ||
                            tx.created_by ||
                            txShift?.cashier_name ||
                            "كاشير الحديقة"}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {tx.created_at ? new Date(tx.created_at).toLocaleString("ar-EG") : ""}
                        </span>
                      </div>

                      {Array.isArray(tx.items) && tx.items.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {tx.items.map((it: any, idx: number) => (
                            <span
                              key={idx}
                              className="inline-block bg-muted/60 px-1.5 py-0.5 rounded border border-border text-[10px] font-bold"
                            >
                              {it.ticket_name || it.name_ar || it.name || "تذكرة"}{" "}
                              <span className="text-emerald-600 font-mono">
                                x{it.quantity || 1}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                      <div className="text-left font-mono">
                        <span
                          className={`text-sm font-black ${
                            isRefunded
                              ? "line-through text-muted-foreground"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {paidAmt.toLocaleString("en-US", {
                            minimumFractionDigits: paidCurr === "USD" ? 2 : 0,
                            maximumFractionDigits: 2,
                          })}
                        </span>{" "}
                        <span className="bg-emerald-800 text-white text-[9px] font-black px-1.5 py-0.5 rounded">
                          {paidCurr}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onReviewTransaction(tx)}
                          className="h-7 px-2.5 rounded-lg text-[11px] font-bold gap-1 cursor-pointer"
                        >
                          <Eye size={12} />
                          <span>مراجعة</span>
                        </Button>

                        {isRefunded ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-500/10 text-rose-600 border border-rose-500/25 text-[11px] font-black rounded-lg">
                            <XCircle size={12} />
                            <span>مرتجع</span>
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => onRefundTransaction(tx)}
                            className="bg-rose-600 hover:bg-rose-700 text-white font-black text-[11px] h-7 px-2.5 rounded-lg flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw size={12} />
                            <span>مرتجع</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Transfer Cash & Generate Journal Entry Modal */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-black">
              ترحيل النقدية وتوليد قيد محاسبي — كاشير الحديقة
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div>
              <label className="font-bold block mb-1">الخزينة المستهدفة للترحيل</label>
              <select
                value={transferTargetTreasury}
                onChange={(e) => setTransferTargetTreasury(e.target.value)}
                className="w-full h-10 rounded-xl border border-input bg-background px-3 text-xs font-bold"
              >
                <option value="">-- اختر الخزينة الرئيسية --</option>
                {(erpState.treasuries || [])
                  .filter((t: any) => !t.deleted && t.id !== parkTreasuryId)
                  .map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name_ar}
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold block mb-1">العملة</label>
                <select
                  value={transferCurrency}
                  onChange={(e) => setTransferCurrency(e.target.value)}
                  className="w-full h-10 rounded-xl border border-input bg-background px-3 text-xs font-bold"
                >
                  <option value="USD">USD ($)</option>
                  <option value="SSP">SSP</option>
                  <option value="EGP">EGP</option>
                </select>
              </div>

              <div>
                <label className="font-bold block mb-1">المبلغ المراد ترحيله</label>
                <Input
                  type="number"
                  step="any"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(Number(e.target.value))}
                  className="h-10 text-xs font-mono font-bold rounded-xl"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              onClick={handleTransferMoney}
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs cursor-pointer"
            >
              تأكيد الترحيل وتوليد القيد
            </Button>
            <Button
              variant="outline"
              onClick={() => setTransferDialogOpen(false)}
              className="rounded-xl font-bold text-xs cursor-pointer"
            >
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
