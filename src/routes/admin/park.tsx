// @ts-nocheck
import React, { useState, useMemo, useEffect, useSyncExternalStore } from "react";
import { createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { extractTabParam, useSyncedSubTab } from "@/components/navigation/navigationRegistry";
import { toast } from "sonner";
import {
  Trees,
  Ticket,
  Plus,
  Landmark,
  Users,
  Settings,
  History,
  Clock,
  Search,
  FileSpreadsheet,
  RotateCcw,
  FileBarChart,
  Eye,
  Play,
  Edit,
  Trash2,
  ShoppingBag,
  UserCheck,
  Store,
} from "lucide-react";
import * as XLSX from "xlsx";
import { erpStore } from "@/shared/services/erpStore";
import {
  getCurrentUserIdentitySync,
  canCurrentUserCloseShift,
} from "@/shared/services/userAuthorization";
import { shiftAuditService } from "@/features/shifts/services/shiftAuditService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ViewModeToggle, useViewMode } from "@/components/ui/view-mode-toggle";
import {
  ParkTicketsPOSView,
  ParkRefundModal,
  ParkTransactionDetailsModal,
  ParkOperationalTreasuriesModal,
  ParkCustomersModal,
  ParkTicketPricesModal,
  ParkShiftClosingModal,
  ParkShiftLauncherModal,
  ParkShiftClosingReportModal,
} from "@/components/mall/ParkTicketsPOS";
import { ShiftAuditLogViewerModal } from "@/components/admin/ShiftAuditLogViewerModal";

export const Route = createFileRoute("/admin/park")({
  head: () => ({ meta: [{ title: "إدارة الحديقة" }] }),
  component: ParkManagementPage,
});

type ParkSectionTab = "definitions" | "operations" | "reports";

function resolveParkTab(tabParam: string | undefined): ParkSectionTab {
  if (!tabParam) return "operations";
  if (
    tabParam === "definitions" ||
    tabParam === "prices" ||
    tabParam === "customers" ||
    tabParam === "treasury"
  ) {
    return "definitions";
  }
  if (tabParam === "reports") {
    return "reports";
  }
  return "operations";
}

function ParkManagementPage() {
  const state = useSyncExternalStore(
    (cb) => erpStore.subscribe(cb),
    () => erpStore.getState(),
    () => erpStore.getState(),
  );

  const navigate = useNavigate();
  const location = useLocation();
  const tabParam = extractTabParam(location.search, (location as any).searchStr);

  const [activeTab, setActiveTab] = useState<ParkSectionTab>(() => resolveParkTab(tabParam));
  const [viewMode, setViewMode] = useViewMode("park", "grid");

  useEffect(() => {
    if (tabParam === "vouchers" || tabParam === "expenses") {
      navigate({ to: "/admin/ledger", search: { tab: "vouchers" } as any });
      return;
    }
    setActiveTab(resolveParkTab(tabParam));
  }, [tabParam, navigate]);

  useEffect(() => {
    void shiftAuditService.syncOpenShiftsFromSupabase(erpStore);
  }, []);

  const currentIdentity = useMemo(
    () => getCurrentUserIdentitySync(),
    [state.currentUserEmail, state.parkShifts, state.parkActiveShift],
  );
  const isCashier = currentIdentity.isCashier;
  const canCloseShifts = canCurrentUserCloseShift();
  const cashierActiveShift = useMemo(
    () => (isCashier ? erpStore.getCashierOpenParkShift() : null),
    [isCashier, state.parkShifts, state.parkActiveShift, currentIdentity],
  );

  useSyncedSubTab("/admin/park", activeTab, setActiveTab as any, "operations");

  const handleTabChange = (newTab: ParkSectionTab) => {
    setActiveTab(newTab);
    navigate({ to: "/admin/park", search: { tab: newTab } as any });
  };

  // POS full screen view
  const [isParkPosOpen, setIsParkPosOpen] = useState(false);

  // Modals state
  const [isParkRefundModalOpen, setIsParkRefundModalOpen] = useState(false);
  const [selectedTxForRefund, setSelectedTxForRefund] = useState<any>(null);
  const [isParkTxDetailsModalOpen, setIsParkTxDetailsModalOpen] = useState(false);
  const [selectedTxForDetails, setSelectedTxForDetails] = useState<any>(null);
  const [isParkTreasuriesModalOpen, setIsParkTreasuriesModalOpen] = useState(false);
  const [isParkCustomersModalOpen, setIsParkCustomersModalOpen] = useState(false);
  const [isParkPricesModalOpen, setIsParkPricesModalOpen] = useState(false);
  const [isParkShiftCloseModalOpen, setIsParkShiftCloseModalOpen] = useState(false);
  const [isParkShiftLauncherOpen, setIsParkShiftLauncherOpen] = useState(false);
  const [isShiftClosingReportOpen, setIsShiftClosingReportOpen] = useState(false);
  const [selectedShiftForReport, setSelectedShiftForReport] = useState<any>(null);
  const [isShiftAuditLogOpen, setIsShiftAuditLogOpen] = useState(false);
  const [selectedShiftForAudit, setSelectedShiftForAudit] = useState<any>(null);

  // Shift Edit & Delete state
  const [editingShift, setEditingShift] = useState<any>(null);
  const [editShiftNumber, setEditShiftNumber] = useState("");
  const [editCashierName, setEditCashierName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [deletingShift, setDeletingShift] = useState<any>(null);

  const handleSaveShiftEdit = () => {
    if (!editingShift) return;
    if (!editShiftNumber.trim()) {
      toast.error("رقم أو اسم الوردية لا يمكن أن يكون فارغاً");
      return;
    }
    if (!editCashierName.trim()) {
      toast.error("اسم الكاشير المسؤول لا يمكن أن يكون فارغاً");
      return;
    }
    try {
      erpStore.updateParkShift(editingShift.id, {
        shift_number: editShiftNumber.trim(),
        cashier_name: editCashierName.trim(),
        notes: editNotes.trim() || undefined,
      });
      toast.success("تم تحديث بيانات الوردية بنجاح");
      setEditingShift(null);
    } catch (err: any) {
      toast.error(err.message || "فشل تعديل بيانات الوردية");
    }
  };

  const handleConfirmDeleteShift = () => {
    if (!deletingShift) return;
    try {
      erpStore.deleteParkShift(deletingShift.id);
      toast.success(`تم حذف ${deletingShift.shift_number || "الوردية"} من النظام`);
      setDeletingShift(null);
    } catch (err: any) {
      toast.error(err.message || "فشل حذف الوردية");
    }
  };

  const [txSearch, setTxSearch] = useState("");

  const transactions = state.parkTicketTransactions || state.parkTransactions || [];
  const rawShifts = state.parkShifts || [];
  const shifts = useMemo(() => {
    if (!isCashier) return rawShifts;
    return rawShifts.filter(
      (s: any) =>
        (cashierActiveShift && s.id === cashierActiveShift.id) ||
        (currentIdentity.userId && s.cashier_id === currentIdentity.userId) ||
        (currentIdentity.username &&
          s.cashier_username?.toLowerCase() === currentIdentity.username.toLowerCase()) ||
        (currentIdentity.fullName &&
          s.cashier_name?.toLowerCase() === currentIdentity.fullName.toLowerCase()),
    );
  }, [rawShifts, isCashier, cashierActiveShift, currentIdentity]);
  const operationalTreasuries = state.parkOperationalTreasuries || [];

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx: any) => {
      const matchSearch =
        !txSearch ||
        String(tx.transaction_number || "").includes(txSearch) ||
        String(tx.customer_name || "").includes(txSearch) ||
        String(tx.cashier_name || "").includes(txSearch);
      return matchSearch;
    });
  }, [transactions, txSearch]);

  const totalRevenue = useMemo(() => {
    return transactions.reduce((acc: number, tx: any) => acc + (tx.total_amount_usd || 0), 0);
  }, [transactions]);

  const totalTickets = useMemo(() => {
    return transactions.reduce((acc: number, tx: any) => acc + (tx.items_count || 1), 0);
  }, [transactions]);

  const openShifts = useMemo(() => {
    if (isCashier) {
      return cashierActiveShift ? [cashierActiveShift] : [];
    }
    return shifts.filter((s: any) => s.status === "open");
  }, [shifts, isCashier, cashierActiveShift]);

  const handleExportExcel = () => {
    try {
      const rows = filteredTransactions.map((tx: any) => ({
        "رقم الحركة": tx.transaction_number || tx.id,
        "التاريخ والوقت": new Date(tx.created_at).toLocaleString("ar-EG"),
        العميل: tx.customer_name || "عميل نقدي",
        الكاشير: tx.cashier_name || "كاشير عام",
        "طريقة الدفع": tx.payment_method || "نقدي",
        "المبلغ بالدولار": tx.total_amount_usd || 0,
        الحالة: tx.status === "refunded" ? "مسترجع" : "مكتمل",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "عمليات الحديقة");
      XLSX.writeFile(wb, `park_transactions_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("تم تصدير ملف الإكسل بنجاح");
    } catch {
      toast.error("حدث خطأ أثناء تصدير ملف الإكسل");
    }
  };

  if (isParkPosOpen) {
    return <ParkTicketsPOSView onClosePOS={() => setIsParkPosOpen(false)} />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full pb-12" dir="rtl">
      {/* Compact Single-Row Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
              <Trees size={18} />
            </div>
            <h1 className="text-lg sm:text-xl font-black text-foreground">إدارة الحديقة</h1>
          </div>

          <div className="inline-flex items-center gap-1 rounded-xl bg-muted/60 p-1 border border-border/70">
            <button
              type="button"
              data-testid="park-tab-definitions"
              onClick={() => handleTabChange("definitions")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-black text-xs transition cursor-pointer ${
                activeTab === "definitions"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Settings size={14} />
              <span>التعريفات</span>
            </button>
            <button
              type="button"
              data-testid="park-tab-operations"
              onClick={() => handleTabChange("operations")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-black text-xs transition cursor-pointer ${
                activeTab === "operations"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Store size={14} />
              <span>العمليات</span>
            </button>
            <button
              type="button"
              data-testid="park-tab-reports"
              onClick={() => handleTabChange("reports")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-black text-xs transition cursor-pointer ${
                activeTab === "reports"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileBarChart size={14} />
              <span>التقارير</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <ViewModeToggle mode={viewMode} onChange={setViewMode} />
          <Button
            onClick={() => setIsParkPosOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs h-8 px-3.5 rounded-xl gap-1.5 shadow-xs cursor-pointer"
          >
            <Ticket size={14} />
            <span>نقطة بيع التذاكر (POS)</span>
          </Button>
          {(!isCashier || !cashierActiveShift) && (
            <Button
              onClick={() => setIsParkShiftLauncherOpen(true)}
              variant="outline"
              className="font-bold text-xs h-8 px-3 rounded-xl gap-1.5 cursor-pointer"
            >
              <Plus size={14} />
              <span>فتح وردية</span>
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => navigate({ to: "/admin/ledger", search: { tab: "vouchers" } as any })}
            className="font-bold text-xs h-8 px-3 rounded-xl gap-1.5 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 cursor-pointer"
          >
            <Landmark size={14} />
            <span>الإدارة المالية</span>
          </Button>
        </div>
      </div>

      {/* SECTION 1: DEFINITIONS (التعريفات) */}
      {activeTab === "definitions" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Master Data Actions */}
          <div
            className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-3 gap-4" : "space-y-3"}
          >
            <Card
              onClick={() => setIsParkPricesModalOpen(true)}
              className="group cursor-pointer rounded-2xl border border-border/80 bg-card p-5 hover:border-purple-500/40 hover:shadow-md transition flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5">
                <div className="rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 p-3">
                  <Settings size={22} />
                </div>
                <h3 className="font-black text-base text-foreground group-hover:text-purple-600 transition-colors">
                  أسعار وتصنيفات التذاكر
                </h3>
              </div>
              <Badge variant="outline" className="font-bold">
                تعديل الأسعار
              </Badge>
            </Card>

            <Card
              onClick={() => setIsParkCustomersModalOpen(true)}
              className="group cursor-pointer rounded-2xl border border-border/80 bg-card p-5 hover:border-teal-500/40 hover:shadow-md transition flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5">
                <div className="rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400 p-3">
                  <Users size={22} />
                </div>
                <h3 className="font-black text-base text-foreground group-hover:text-teal-600 transition-colors">
                  دليل عملاء الحديقة
                </h3>
              </div>
              <Badge variant="outline" className="font-bold">
                إدارة العملاء
              </Badge>
            </Card>

            <Card
              onClick={() => setIsParkTreasuriesModalOpen(true)}
              className="group cursor-pointer rounded-2xl border border-border/80 bg-card p-5 hover:border-blue-500/40 hover:shadow-md transition flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5">
                <div className="rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 p-3">
                  <Landmark size={22} />
                </div>
                <h3 className="font-black text-base text-foreground group-hover:text-blue-600 transition-colors">
                  إعدادات الخزائن التشغيلية ({operationalTreasuries.length})
                </h3>
              </div>
              <Badge variant="outline" className="font-bold">
                إدارة الخزائن
              </Badge>
            </Card>
          </div>

          {/* Operational Treasuries List/Grid */}
          <Card className="border border-border shadow-xs rounded-2xl">
            <CardHeader className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60">
              <CardTitle className="text-base font-black">
                الخزائن التشغيلية للحديقة ({operationalTreasuries.length})
              </CardTitle>
              <Button
                onClick={() => setIsParkTreasuriesModalOpen(true)}
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs gap-1.5 cursor-pointer"
              >
                إدارة أوعية الخزائن
              </Button>
            </CardHeader>
            <CardContent className="p-5">
              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {operationalTreasuries.map((tr: any) => (
                    <div
                      key={tr.id}
                      className="bg-muted/40 border border-border p-4 rounded-2xl space-y-2 text-right"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-xs text-foreground">{tr.name_ar}</h4>
                        <Badge variant="outline" className="text-[10px]">
                          {tr.currency || "USD"}
                        </Badge>
                      </div>
                      <p className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                        {Number(tr.balance || 0).toLocaleString()} {tr.currency || "USD"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        المسؤول: {tr.responsible_cashier || "كاشير مناوب"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {operationalTreasuries.map((tr: any) => (
                    <div
                      key={tr.id}
                      className="flex items-center justify-between gap-4 bg-muted/40 border border-border p-3.5 rounded-xl text-right"
                    >
                      <div className="flex items-center gap-3">
                        <Landmark size={18} className="text-blue-600" />
                        <span className="font-bold text-sm text-foreground">{tr.name_ar}</span>
                        <span className="text-xs text-muted-foreground">
                          ({tr.responsible_cashier || "كاشير مناوب"})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-black font-mono text-emerald-600 dark:text-emerald-400">
                          {Number(tr.balance || 0).toLocaleString()} {tr.currency || "USD"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* SECTION 2: OPERATIONS (العمليات) */}
      {activeTab === "operations" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Open Shifts Section */}
          {openShifts.length > 0 ? (
            <div className="space-y-3">
              {openShifts.map((shift: any) => {
                const shiftTxs = (transactions || []).filter(
                  (t: any) => t.shift_id === shift.id || t.shift_number === shift.shift_number,
                );
                const completedTxs = shiftTxs.filter((t: any) => t.status === "completed");
                const refundedTxs = shiftTxs.filter((t: any) => t.status === "refunded");
                const shiftRevenueUsd = completedTxs.reduce(
                  (s: number, t: any) => s + (t.total_usd || t.total_amount_usd || 0),
                  0,
                );

                return (
                  <div
                    key={shift.id}
                    className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:border-teal-500/40"
                  >
                    <div className="space-y-1.5 text-right flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-black text-sm text-foreground">
                          {shift.shift_number || `وردية تذاكر #${shift.auto_shift_number || "1"}`}
                        </h3>
                        <span className="inline-flex items-center bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700/60 text-xs font-bold px-2.5 py-0.5 rounded-full">
                          وردية مفتوحة
                        </span>
                        {shift.currency && (
                          <span className="inline-flex items-center border border-border/80 bg-muted/40 text-muted-foreground text-[11px] font-mono px-2.5 py-0.5 rounded-full">
                            {shift.currency}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1 font-bold text-foreground">
                          <UserCheck size={14} className="text-teal-600" />
                          الكاشير: {shift.cashier_name}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-mono">
                          <Clock size={13} className="text-muted-foreground" />
                          {new Date(
                            shift.opened_at || shift.start_at || Date.now(),
                          ).toLocaleTimeString("ar-EG")}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-teal-600 dark:text-teal-400 font-black">
                          <ShoppingBag size={14} />
                          {completedTxs.length} مبيعات (${shiftRevenueUsd.toLocaleString()})
                          {refundedTxs.length > 0 && ` (${refundedTxs.length} مرتجع)`}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-start md:items-end gap-2.5 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => {
                          erpStore.setActiveParkShift(shift.id);
                          toast.success(`تم الدخول إلى ${shift.shift_number}`);
                          setIsParkPosOpen(true);
                        }}
                        className="bg-[#00897b] hover:bg-[#00796b] text-white rounded-full font-black text-xs px-5 py-2 shadow-xs flex items-center gap-1.5 cursor-pointer h-9"
                      >
                        <Play size={13} className="fill-white" />
                        <span>دخول الوردية</span>
                      </Button>

                      {!isCashier && (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingShift(shift);
                              setEditShiftNumber(shift.shift_number);
                              setEditCashierName(shift.cashier_name);
                              setEditNotes(shift.notes || "");
                            }}
                            className="rounded-full text-xs font-bold px-3 py-1 flex items-center gap-1 cursor-pointer h-7"
                          >
                            <Edit size={13} className="text-blue-600" />
                            <span>تعديل</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeletingShift(shift)}
                            className="text-rose-500 hover:text-rose-700 p-1.5 h-7 w-7 rounded-full cursor-pointer"
                            title="حذف الوردية"
                          >
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 sm:p-5 rounded-2xl border border-dashed border-teal-500/30 bg-card shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
              <h3 className="font-black text-sm text-foreground">لا توجد وردية مفتوحة حالياً</h3>
              <Button
                onClick={() => setIsParkShiftLauncherOpen(true)}
                className="bg-[#00897b] hover:bg-[#00796b] text-white rounded-full font-black text-xs px-5 py-2 shadow-xs flex items-center gap-1.5 cursor-pointer h-9 shrink-0"
              >
                <Plus size={15} />
                <span>فتح وردية جديدة</span>
              </Button>
            </div>
          )}

          {/* Operational Action Cards */}
          <div
            className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-3 gap-4" : "space-y-3"}
          >
            <Card
              onClick={() => setIsParkPosOpen(true)}
              className="group cursor-pointer rounded-2xl border border-border/80 bg-card p-5 hover:border-emerald-500/50 hover:shadow-md transition flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5">
                <div className="rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 p-3">
                  <Ticket size={22} />
                </div>
                <h3 className="font-black text-base text-foreground group-hover:text-emerald-600 transition-colors">
                  نقطة بيع التذاكر (POS)
                </h3>
              </div>
              <Badge variant="outline" className="font-bold">
                فتح الشباك
              </Badge>
            </Card>

            <Card
              onClick={() => setIsParkShiftLauncherOpen(true)}
              className="group cursor-pointer rounded-2xl border border-border/80 bg-card p-5 hover:border-teal-500/50 hover:shadow-md transition flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5">
                <div className="rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400 p-3">
                  <Plus size={22} />
                </div>
                <h3 className="font-black text-base text-foreground group-hover:text-teal-600 transition-colors">
                  فتح وردية كاشير جديدة
                </h3>
              </div>
              <Badge variant="outline" className="font-bold">
                {openShifts.length} نشطة
              </Badge>
            </Card>

            {canCloseShifts && (
              <Card
                onClick={() => setIsParkShiftCloseModalOpen(true)}
                className="group cursor-pointer rounded-2xl border border-border/80 bg-card p-5 hover:border-rose-500/50 hover:shadow-md transition flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5">
                  <div className="rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 p-3">
                    <History size={22} />
                  </div>
                  <h3 className="font-black text-base text-foreground group-hover:text-rose-600 transition-colors">
                    إغلاق وتسوية وردية الكاشير
                  </h3>
                </div>
                <Badge variant="outline" className="font-bold">
                  إغلاق وردية
                </Badge>
              </Card>
            )}
          </div>

          {/* Tickets & Transactions Table */}
          <Card className="border border-border shadow-xs rounded-2xl">
            <CardHeader className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60">
              <CardTitle className="text-base font-black">
                سجل تذاكر وعمليات الدخول ({filteredTransactions.length})
              </CardTitle>
              <div className="relative w-full sm:w-72">
                <Search size={15} className="absolute right-3 top-2.5 text-muted-foreground" />
                <Input
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  placeholder="ابحث برقم الحركة، الكاشير، العميل..."
                  className="pr-9 h-9 text-xs rounded-xl"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold">
                  <tr>
                    <th className="p-3">رقم الحركة</th>
                    <th className="p-3">التوقيت والتاريخ</th>
                    <th className="p-3">العميل</th>
                    <th className="p-3">الكاشير</th>
                    <th className="p-3">طريقة الدفع</th>
                    <th className="p-3">الإجمالي ($)</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-muted-foreground">
                        لا توجد حركات تذاكر مسجلة
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx: any) => (
                      <tr key={tx.id} className="hover:bg-muted/30 transition">
                        <td className="p-3 font-mono font-bold text-foreground">
                          {tx.transaction_number || tx.id.slice(0, 8)}
                        </td>
                        <td className="p-3 text-muted-foreground font-mono">
                          {new Date(tx.created_at).toLocaleString("ar-EG")}
                        </td>
                        <td className="p-3 font-semibold text-foreground">
                          {tx.customer_name || "عميل نقدي"}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {tx.cashier_name || "كاشير عام"}
                        </td>
                        <td className="p-3 font-medium">
                          <Badge variant="outline" className="text-[10px] font-bold">
                            {tx.payment_method === "cash"
                              ? "كاش"
                              : tx.payment_method === "card"
                                ? "بطاقة"
                                : tx.payment_method || "نقدي"}
                          </Badge>
                        </td>
                        <td className="p-3 font-mono font-black text-emerald-600 dark:text-emerald-400">
                          ${Number(tx.total_amount_usd || 0).toLocaleString()}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              tx.status === "refunded"
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                            }`}
                          >
                            {tx.status === "refunded" ? "مسترجع" : "مكتمل"}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedTxForDetails(tx);
                                setIsParkTxDetailsModalOpen(true);
                              }}
                              className="h-7 px-2 text-xs font-bold"
                            >
                              <Eye size={13} className="ml-1" />
                              عرض
                            </Button>
                            {tx.status !== "refunded" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedTxForRefund(tx);
                                  setIsParkRefundModalOpen(true);
                                }}
                                className="h-7 px-2 text-xs font-bold text-rose-600 hover:bg-rose-50"
                              >
                                <RotateCcw size={13} className="ml-1" />
                                استرجاع
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Shifts Table */}
          <Card className="border border-border shadow-xs rounded-2xl">
            <CardHeader className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60">
              <CardTitle className="text-base font-black">
                ورديات كاشير الحديقة ({shifts.length})
              </CardTitle>
              {(!isCashier || !cashierActiveShift) && (
                <Button
                  onClick={() => setIsParkShiftLauncherOpen(true)}
                  size="sm"
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs gap-1.5"
                >
                  <Plus size={14} />
                  فتح وردية جديدة
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold">
                  <tr>
                    <th className="p-3">{isCashier ? "اسم الوردية" : "رقم الوردية"}</th>
                    <th className="p-3">الكاشير المسؤول</th>
                    <th className="p-3">وقت الفتح</th>
                    <th className="p-3">وقت الإغلاق</th>
                    <th className="p-3">الخزينة التشغيلية</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {shifts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-muted-foreground">
                        لا توجد ورديات مسجلة بعد
                      </td>
                    </tr>
                  ) : (
                    shifts.map((s: any) => (
                      <tr key={s.id} className="hover:bg-muted/30 transition">
                        <td className="p-3 font-bold">
                          {isCashier ? s.shift_number : s.shift_number || s.id.slice(0, 8)}
                        </td>
                        <td className="p-3 font-bold text-foreground">{s.cashier_name}</td>
                        <td className="p-3 text-muted-foreground font-mono">
                          {new Date(s.opened_at || s.start_at).toLocaleString("ar-EG")}
                        </td>
                        <td className="p-3 text-muted-foreground font-mono">
                          {s.closed_at || s.end_at
                            ? new Date(s.closed_at || s.end_at).toLocaleString("ar-EG")
                            : "— نشطة حالياً —"}
                        </td>
                        <td className="p-3 font-medium">
                          {s.treasury_name || "الخزينة التشغيلية"}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              s.status === "open"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {s.status === "open" ? "مفتوحة" : "مغلقة"}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {s.status === "open" && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  erpStore.setActiveParkShift(s.id);
                                  toast.success(`تم الدخول إلى ${s.shift_number}`);
                                  setIsParkPosOpen(true);
                                }}
                                className="h-7 px-2.5 text-xs font-black bg-teal-600 hover:bg-teal-700 text-white rounded-lg gap-1"
                              >
                                <Play size={12} />
                                دخول الوردية
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedShiftForReport(s);
                                setIsShiftClosingReportOpen(true);
                              }}
                              className="h-7 px-2 text-xs font-bold"
                            >
                              تقرير الوردية
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SECTION 3: REPORTS (التقارير) */}
      {activeTab === "reports" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="rounded-xl text-xs font-bold gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet size={14} />
              تصدير التذاكر إلى Excel
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border border-border p-5 rounded-2xl">
              <p className="text-xs text-muted-foreground font-bold">إجمالي مبيعات التذاكر</p>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
                ${totalRevenue.toLocaleString()}
              </h3>
            </Card>
            <Card className="border border-border p-5 rounded-2xl">
              <p className="text-xs text-muted-foreground font-bold">إجمالي التذاكر الصادرة</p>
              <h3 className="text-2xl font-black text-foreground mt-2 font-mono">
                {totalTickets.toLocaleString()} تذكرة
              </h3>
            </Card>
            <Card className="border border-border p-5 rounded-2xl">
              <p className="text-xs text-muted-foreground font-bold">الورديات المنفذة</p>
              <h3 className="text-2xl font-black text-indigo-600 mt-2 font-mono">
                {shifts.length} وردية
              </h3>
            </Card>
          </div>

          <Card className="border border-border shadow-xs rounded-2xl">
            <CardHeader className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60">
              <CardTitle className="text-base font-black">
                تقارير ورديات الحديقة وسجل التدقيق
              </CardTitle>
              {!isCashier && (
                <Button
                  onClick={() => {
                    setSelectedShiftForAudit(null);
                    setIsShiftAuditLogOpen(true);
                  }}
                  variant="outline"
                  size="sm"
                  className="font-bold rounded-xl text-xs gap-1.5 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 cursor-pointer"
                >
                  <History size={14} />
                  سجل التدقيق الشامل
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold">
                  <tr>
                    <th className="p-3">رقم الوردية</th>
                    <th className="p-3">الكاشير المسؤول</th>
                    <th className="p-3">وقت الفتح</th>
                    <th className="p-3">وقت الإغلاق</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3 text-center">التقرير والتدقيق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {shifts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-muted-foreground">
                        لا توجد تقارير ورديات مسجلة بعد
                      </td>
                    </tr>
                  ) : (
                    shifts.map((s: any) => (
                      <tr key={s.id} className="hover:bg-muted/30 transition">
                        <td className="p-3 font-bold">{s.shift_number || s.id.slice(0, 8)}</td>
                        <td className="p-3 font-bold text-foreground">{s.cashier_name}</td>
                        <td className="p-3 text-muted-foreground font-mono">
                          {new Date(s.opened_at || s.start_at).toLocaleString("ar-EG")}
                        </td>
                        <td className="p-3 text-muted-foreground font-mono">
                          {s.closed_at || s.end_at
                            ? new Date(s.closed_at || s.end_at).toLocaleString("ar-EG")
                            : "— نشطة حالياً —"}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              s.status === "open"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {s.status === "open" ? "مفتوحة" : "مغلقة"}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedShiftForReport(s);
                                setIsShiftClosingReportOpen(true);
                              }}
                              className="h-7 px-2 text-xs font-bold"
                            >
                              تقرير الوردية
                            </Button>
                            {!isCashier && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedShiftForAudit(s);
                                  setIsShiftAuditLogOpen(true);
                                }}
                                className="h-7 px-2 text-xs font-bold text-indigo-600"
                              >
                                سجل التدقيق
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ALL PARK MODALS */}
      <ParkRefundModal
        isOpen={isParkRefundModalOpen}
        onClose={() => setIsParkRefundModalOpen(false)}
        transaction={selectedTxForRefund}
      />
      <ParkTransactionDetailsModal
        isOpen={isParkTxDetailsModalOpen}
        onClose={() => setIsParkTxDetailsModalOpen(false)}
        transaction={selectedTxForDetails}
      />
      <ParkOperationalTreasuriesModal
        isOpen={isParkTreasuriesModalOpen}
        onClose={() => setIsParkTreasuriesModalOpen(false)}
      />
      <ParkCustomersModal
        isOpen={isParkCustomersModalOpen}
        onClose={() => setIsParkCustomersModalOpen(false)}
      />
      <ParkTicketPricesModal
        isOpen={isParkPricesModalOpen}
        onClose={() => setIsParkPricesModalOpen(false)}
      />
      <ParkShiftClosingModal
        isOpen={isParkShiftCloseModalOpen && canCloseShifts}
        onClose={() => setIsParkShiftCloseModalOpen(false)}
        onShiftClosed={() => setIsParkShiftCloseModalOpen(false)}
      />
      <ParkShiftLauncherModal
        isOpen={isParkShiftLauncherOpen}
        onClose={() => setIsParkShiftLauncherOpen(false)}
        onOpenPOS={() => setIsParkPosOpen(true)}
        onRequestCloseShift={
          canCloseShifts
            ? (shift) => {
                setIsParkShiftLauncherOpen(false);
                setSelectedShiftForReport(shift);
                setIsShiftClosingReportOpen(true);
              }
            : undefined
        }
      />
      <ParkShiftClosingReportModal
        isOpen={isShiftClosingReportOpen}
        onClose={() => setIsShiftClosingReportOpen(false)}
        viewOnlyShift={selectedShiftForReport}
        shiftToClose={canCloseShifts ? selectedShiftForReport : undefined}
      />
      <ShiftAuditLogViewerModal
        isOpen={isShiftAuditLogOpen}
        onClose={() => setIsShiftAuditLogOpen(false)}
        initialShiftId={selectedShiftForAudit?.id}
        initialShiftType="PARK"
      />

      {/* Edit Shift Modal */}
      {editingShift && (
        <Dialog open={editingShift !== null} onOpenChange={() => setEditingShift(null)}>
          <DialogContent className="sm:max-w-[450px] rounded-3xl text-right">
            <DialogHeader className="text-right">
              <DialogTitle className="text-base font-black flex items-center gap-2 text-foreground">
                <Edit size={18} className="text-blue-600" />
                تعديل بيانات جلسة الوردية
              </DialogTitle>
              <DialogDescription className="text-xs">
                تعديل رقم ومسمى الوردية أو اسم الكاشير المسؤول
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div>
                <Label className="font-bold mb-1 block">رقم / مسمى الوردية:</Label>
                <Input
                  value={editShiftNumber}
                  onChange={(e) => setEditShiftNumber(e.target.value)}
                  className="rounded-xl h-9 font-bold"
                />
              </div>

              <div>
                <Label className="font-bold mb-1 block">اسم الكاشير المسؤول:</Label>
                <Input
                  value={editCashierName}
                  onChange={(e) => setEditCashierName(e.target.value)}
                  className="rounded-xl h-9 font-bold"
                />
              </div>

              <div>
                <Label className="font-bold mb-1 block">ملاحظات الوردية:</Label>
                <Input
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="rounded-xl h-9"
                  placeholder="ملاحظات..."
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingShift(null)}
                className="rounded-xl"
              >
                إلغاء
              </Button>
              <Button
                size="sm"
                onClick={handleSaveShiftEdit}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold"
              >
                حفظ التعديلات
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Shift Confirmation Modal */}
      {deletingShift && (
        <Dialog open={deletingShift !== null} onOpenChange={() => setDeletingShift(null)}>
          <DialogContent className="sm:max-w-[450px] rounded-3xl text-right">
            <DialogHeader className="text-right">
              <DialogTitle className="text-base font-black flex items-center gap-2 text-rose-600">
                <Trash2 size={18} />
                تأكيد حذف الوردية
              </DialogTitle>
              <DialogDescription className="text-xs text-rose-600/80">
                هل أنت متأكد من حذف الوردية ({deletingShift.shift_number})؟ لا يمكن التراجع عن هذا
                الإجراء.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="gap-2 sm:justify-between pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeletingShift(null)}
                className="rounded-xl"
              >
                إلغاء
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmDeleteShift}
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold"
              >
                تأكيد الحذف
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
