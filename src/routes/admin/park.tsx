// @ts-nocheck
import React, { useState, useMemo, useEffect, useSyncExternalStore } from "react";
import { createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { extractTabParam, useSyncedSubTab } from "@/components/navigation/navigationRegistry";
import { toast } from "sonner";
import {
  Trees,
  Plus,
  Landmark,
  Users,
  Settings,
  History,
  Clock,
  Search,
  FileSpreadsheet,
  RotateCcw,
  Eye,
  Play,
  Edit,
  Trash2,
  ShoppingBag,
  UserCheck,
  Lock,
  ArrowUpRight,
  Wallet,
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
import { ParkCashierTreasuryManagerView } from "@/components/mall/ParkCashierTreasuryManagerView";
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
      navigate({ to: "/admin/ledger", search: { tab: "vouchers", dept: "park" } as any });
      return;
    }
    setActiveTab(resolveParkTab(tabParam));
  }, [tabParam, navigate]);

  useEffect(() => {
    const runShiftSync = () => {
      shiftAuditService.syncShiftsWithAuditLogs(
        erpStore.getParkShifts(),
        erpStore.getRestaurantShifts(),
      );
      void shiftAuditService.syncOpenShiftsFromSupabase(erpStore);
    };
    runShiftSync();
    window.addEventListener("storage", runShiftSync);
    window.addEventListener("focus", runShiftSync);
    return () => {
      window.removeEventListener("storage", runShiftSync);
      window.removeEventListener("focus", runShiftSync);
    };
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
  const activeParkShift = erpStore.getActiveParkShift();

  useSyncedSubTab("/admin/park", activeTab, setActiveTab as any, "operations");

  // POS full screen view & Cashier Treasury Manager view
  const [isParkPosOpen, setIsParkPosOpen] = useState(false);
  const [isParkCashierTreasuryOpen, setIsParkCashierTreasuryOpen] = useState(false);

  useEffect(() => {
    setIsParkCashierTreasuryOpen(false);
  }, [activeTab]);

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
  const [closingShift, setClosingShift] = useState<any>(null);
  const [viewingClosedShift, setViewingClosedShift] = useState<any>(null);
  const [isShiftAuditLogOpen, setIsShiftAuditLogOpen] = useState(false);
  const [selectedShiftForAudit, setSelectedShiftForAudit] = useState<any>(null);

  // Shift Edit & Delete state
  const [editingShift, setEditingShift] = useState<any>(null);
  const [editShiftNumber, setEditShiftNumber] = useState("");
  const [editCashierName, setEditCashierName] = useState("");
  const [editOpeningBalance, setEditOpeningBalance] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [deletingShift, setDeletingShift] = useState<any>(null);

  const handleSaveShiftEdit = () => {
    if (!editingShift) return;
    if (!editShiftNumber.trim() || !editCashierName.trim()) {
      toast.error("يرجى إدخال اسم الوردية واسم الكاشير");
      return;
    }
    try {
      erpStore.updateParkShift(editingShift.id, {
        shift_number: editShiftNumber.trim(),
        cashier_name: editCashierName.trim(),
        opening_balance: Number(editOpeningBalance) || 0,
        notes: editNotes.trim() || undefined,
      });
      toast.success("تم تحديث بيانات الوردية");
      setEditingShift(null);
    } catch (err: any) {
      toast.error(err.message || "فشل تعديل بيانات الوردية");
    }
  };

  const handleConfirmDeleteShift = () => {
    if (!deletingShift) return;
    try {
      erpStore.deleteParkShift(deletingShift.id);
      toast.success(`تم حذف ${deletingShift.shift_number || "الوردية"}`);
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
        String(tx.transaction_number || tx.tx_number || "").includes(txSearch) ||
        String(tx.customer_name || "").includes(txSearch) ||
        String(tx.cashier_name || tx.created_by || "").includes(txSearch);
      return matchSearch;
    });
  }, [transactions, txSearch]);

  const totalRevenue = useMemo(() => {
    return transactions.reduce(
      (acc: number, tx: any) => acc + (tx.total_usd || tx.total_amount_usd || 0),
      0,
    );
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

  const closedShifts = useMemo(() => {
    return shifts.filter((s: any) => s.status === "closed");
  }, [shifts]);

  const handleExportExcel = () => {
    try {
      const rows = filteredTransactions.map((tx: any) => ({
        "رقم الحركة": tx.transaction_number || tx.tx_number || tx.id,
        "التاريخ والوقت": new Date(tx.created_at).toLocaleString("ar-EG"),
        العميل: tx.customer_name || "عميل نقدي",
        الكاشير: tx.cashier_name || tx.created_by || "كاشير عام",
        "طريقة الدفع": tx.payment_method || "نقدي",
        "المبلغ بالدولار": tx.total_usd || tx.total_amount_usd || 0,
        الحالة: tx.status === "refunded" ? "مسترجع" : "مكتمل",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "عمليات الحديقة");
      XLSX.writeFile(wb, `park_transactions_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("تم تصدير ملف الإكسل");
    } catch {
      toast.error("حدث خطأ أثناء تصدير ملف الإكسل");
    }
  };

  type ActionCardItem = {
    title: string;
    icon: any;
    color: string;
    badge: string;
    onClick: () => void;
  };

  const definitionCards: ActionCardItem[] = [
    {
      title: "أسعار وتصنيفات التذاكر",
      icon: Settings,
      color: "from-purple-500/20 to-indigo-500/20 text-purple-600 dark:text-purple-400",
      badge: "التذاكر",
      onClick: () => setIsParkPricesModalOpen(true),
    },
    {
      title: "دليل عملاء الحديقة",
      icon: Users,
      color: "from-teal-500/20 to-emerald-500/20 text-teal-600 dark:text-teal-400",
      badge: "العملاء",
      onClick: () => setIsParkCustomersModalOpen(true),
    },
    {
      title: "إعدادات الخزائن التشغيلية",
      icon: Landmark,
      color: "from-blue-500/20 to-cyan-500/20 text-blue-600 dark:text-blue-400",
      badge: `${operationalTreasuries.length} خزينة`,
      onClick: () => setIsParkTreasuriesModalOpen(true),
    },
  ];

  const operationCards: ActionCardItem[] = [
    {
      title: "فتح وردية جديدة",
      icon: Plus,
      color: "from-teal-500/20 to-emerald-500/20 text-teal-600 dark:text-teal-400",
      badge: `${openShifts.length} نشطة`,
      onClick: () => setIsParkShiftLauncherOpen(true),
    },
    {
      title: "معاينة صفحة الكاشير",
      icon: Eye,
      color: "from-blue-500/20 to-indigo-500/20 text-blue-600 dark:text-blue-400",
      badge: "POS",
      onClick: () => setIsParkPosOpen(true),
    },
    ...(!isCashier || canCloseShifts
      ? [
          {
            title: "شاشة الكاشير والخزينة",
            icon: Wallet,
            color: "from-emerald-500/25 to-teal-500/25 text-emerald-600 dark:text-emerald-400",
            badge: "الخزينة",
            onClick: () => setIsParkCashierTreasuryOpen(true),
          },
        ]
      : []),
  ];

  const renderCards = (items: ActionCardItem[]) => {
    if (viewMode === "list") {
      return (
        <div className="space-y-2.5">
          {items.map((module) => {
            const Icon = module.icon;
            return (
              <Card
                key={module.title}
                onClick={module.onClick}
                className="group flex items-center justify-between gap-4 rounded-2xl border border-border/80 bg-card p-4 shadow-xs transition hover:border-primary/50 hover:shadow-md cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`rounded-xl bg-gradient-to-br p-2.5 ${module.color}`}>
                    <Icon size={20} />
                  </div>
                  <span className="text-base font-black text-foreground group-hover:text-primary transition truncate">
                    {module.title}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="rounded-full border border-border/60 bg-muted px-2.5 py-1 text-xs font-bold text-primary">
                    {module.badge}
                  </span>
                  <ArrowUpRight size={16} className="text-primary" />
                </div>
              </Card>
            );
          })}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((module) => {
          const Icon = module.icon;
          return (
            <Card
              key={module.title}
              onClick={module.onClick}
              className="group flex items-center justify-between gap-4 rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all duration-200 hover:border-primary/50 hover:shadow-md cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className={`rounded-2xl bg-gradient-to-br p-3 shadow-inner ${module.color}`}>
                  <Icon size={22} />
                </div>
                <h3 className="text-base font-black text-foreground group-hover:text-primary transition truncate">
                  {module.title}
                </h3>
              </div>
              <span className="rounded-full border border-border/60 bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground shrink-0">
                {module.badge}
              </span>
            </Card>
          );
        })}
      </div>
    );
  };

  if (isParkPosOpen) {
    return <ParkTicketsPOSView onClosePOS={() => setIsParkPosOpen(false)} />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12" dir="rtl">
      {/* Compact Single-Row Header */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
            <Trees size={18} />
          </div>
          <h1 className="text-lg sm:text-xl font-black text-foreground">إدارة الحديقة</h1>
        </div>

        <div className="flex items-center gap-2">
          <ViewModeToggle mode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {/* SECTION 1: DEFINITIONS (التعريفات) */}
      {activeTab === "definitions" && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {renderCards(definitionCards)}
        </div>
      )}

      {/* SECTION 2: OPERATIONS (العمليات) */}
      {activeTab === "operations" &&
        (isParkCashierTreasuryOpen ? (
          <ParkCashierTreasuryManagerView
            shifts={rawShifts}
            transactions={transactions}
            onBack={() => setIsParkCashierTreasuryOpen(false)}
            onCloseShift={(shift) => {
              erpStore.setActiveParkShift(shift.id);
              setClosingShift(shift);
            }}
            onViewShiftReport={(shift) => {
              setViewingClosedShift(shift);
            }}
            onReviewTransaction={(tx) => {
              setSelectedTxForDetails(tx);
              setIsParkTxDetailsModalOpen(true);
            }}
            onRefundTransaction={(tx) => {
              setSelectedTxForRefund(tx);
              setIsParkRefundModalOpen(true);
            }}
          />
        ) : (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Active Open Shifts */}
          {openShifts.length > 0 && (
            <div className="space-y-3">
              {openShifts.map((shift: any) => {
                const isSessionActive = activeParkShift?.id === shift.id;
                const shiftTxs = (transactions || []).filter(
                  (t: any) => t.shift_id === shift.id || t.shift_number === shift.shift_number,
                );
                const completedTxs = shiftTxs.filter((t: any) => t.status === "completed");

                return (
                  <div
                    key={shift.id}
                    className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:border-teal-500/40"
                  >
                    <div className="space-y-1.5 text-right flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-black text-sm text-foreground">
                          {shift.shift_number}
                        </h3>
                        <span className="inline-flex items-center bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700/60 text-xs font-bold px-2.5 py-0.5 rounded-full">
                          وردية مفتوحة
                        </span>
                        {isSessionActive && (
                          <span className="inline-flex items-center bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-700/60 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                            نشطة الآن
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1 font-bold text-foreground">
                          <UserCheck size={14} className="text-teal-600" />
                          {shift.cashier_name}
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
                          {completedTxs.length} مبيعات
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap shrink-0">
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

                      {canCloseShifts && !isCashier && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingShift(shift);
                              setEditShiftNumber(shift.shift_number);
                              setEditCashierName(shift.cashier_name);
                              setEditOpeningBalance(String(shift.opening_balance || 0));
                              setEditNotes(shift.notes || shift.opening_notes || "");
                            }}
                            className="rounded-full text-xs font-bold px-3 py-1 flex items-center gap-1 cursor-pointer h-8"
                          >
                            <Edit size={13} className="text-blue-600" />
                            <span>تعديل</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              erpStore.setActiveParkShift(shift.id);
                              setClosingShift(shift);
                            }}
                            className="text-rose-700 dark:text-rose-300 rounded-full text-xs font-bold px-3 py-1 flex items-center gap-1 cursor-pointer h-8"
                          >
                            <Lock size={12} className="text-rose-600" />
                            <span>إغلاق</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeletingShift(shift)}
                            className="text-rose-500 hover:text-rose-700 p-1.5 h-8 w-8 rounded-full cursor-pointer"
                          >
                            <Trash2 size={15} />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Operational Action Cards (Single Open Shift Box + Single Preview POS Box + Cashier Treasury) */}
          {renderCards(operationCards)}
        </div>
        ))}

      {/* SECTION 3: REPORTS (التقارير) */}
      {activeTab === "reports" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start animate-in fade-in duration-200">
          <Card className="border border-border shadow-xs rounded-2xl flex flex-col max-h-[calc(100vh-200px)]">
            <CardHeader className="p-3.5 flex flex-row items-center justify-between gap-2 border-b border-border/60 shrink-0">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm sm:text-base font-black">تقارير الورديات</CardTitle>
                <Badge variant="outline" className="font-mono text-xs">
                  {shifts.length} وردية
                </Badge>
              </div>
              {!isCashier && (
                <Button
                  onClick={() => {
                    setSelectedShiftForAudit(null);
                    setIsShiftAuditLogOpen(true);
                  }}
                  variant="outline"
                  size="sm"
                  className="font-bold rounded-xl text-xs gap-1.5 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 cursor-pointer h-8"
                >
                  <History size={13} />
                  سجل التدقيق
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0 overflow-auto flex-1">
              <table className="w-full text-right text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold sticky top-0">
                  <tr>
                    <th className="p-2.5">الوردية</th>
                    <th className="p-2.5">الكاشير</th>
                    <th className="p-2.5">المبيعات</th>
                    <th className="p-2.5">الحالة</th>
                    <th className="p-2.5 text-center">التقرير</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {shifts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-muted-foreground">
                        لا توجد تقارير ورديات مسجلة
                      </td>
                    </tr>
                  ) : (
                    shifts.map((s: any) => {
                      const shiftTxs = (transactions || []).filter(
                        (t: any) =>
                          (t.shift_id === s.id || t.shift_number === s.shift_number) &&
                          t.status !== "refunded",
                      );
                      const shiftUsdTotal = shiftTxs.reduce(
                        (acc: number, t: any) =>
                          acc + Number(t.total_usd || t.total_amount_usd || 0),
                        0,
                      );
                      return (
                        <tr key={s.id} className="hover:bg-muted/30 transition">
                          <td className="p-2.5">
                            <div className="font-black text-foreground">{s.shift_number}</div>
                            <div className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400">
                              {s.auto_shift_number || s.id.slice(0, 8)}
                            </div>
                          </td>
                          <td className="p-2.5 font-bold text-foreground">{s.cashier_name}</td>
                          <td className="p-2.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {shiftTxs.length} (${shiftUsdTotal.toLocaleString()})
                          </td>
                          <td className="p-2.5">
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
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setViewingClosedShift(s)}
                                className="h-7 px-2 text-[11px] font-bold cursor-pointer"
                              >
                                <FileSpreadsheet size={12} className="ml-1 text-emerald-600" />
                                التقرير
                              </Button>
                              {canCloseShifts && !isCashier && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedShiftForAudit(s);
                                    setIsShiftAuditLogOpen(true);
                                  }}
                                  className="h-7 px-2 text-[11px] font-bold text-indigo-600 cursor-pointer"
                                >
                                  تدقيق
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Tickets & Transactions Table */}
          <Card className="border border-border shadow-xs rounded-2xl flex flex-col max-h-[calc(100vh-200px)]">
            <CardHeader className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 shrink-0">
              <CardTitle className="text-sm sm:text-base font-black">
                سجل تذاكر الدخول ({filteredTransactions.length})
              </CardTitle>
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="relative w-44">
                  <Search size={14} className="absolute right-2.5 top-2 text-muted-foreground" />
                  <Input
                    value={txSearch}
                    onChange={(e) => setTxSearch(e.target.value)}
                    placeholder="بحث..."
                    className="pr-8 h-8 text-xs rounded-xl"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportExcel}
                  className="rounded-xl text-xs font-bold gap-1 h-8 px-2.5 cursor-pointer"
                >
                  <FileSpreadsheet size={13} />
                  Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-auto flex-1">
              <table className="w-full text-right text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold">
                  <tr>
                    <th className="p-3">رقم الحركة</th>
                    <th className="p-3">التاريخ</th>
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
                          {tx.transaction_number || tx.tx_number || tx.id.slice(0, 8)}
                        </td>
                        <td className="p-3 text-muted-foreground font-mono">
                          {new Date(tx.created_at).toLocaleString("ar-EG")}
                        </td>
                        <td className="p-3 font-semibold text-foreground">
                          {tx.customer_name || "عميل نقدي"}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {tx.cashier_name || tx.created_by || "كاشير عام"}
                        </td>
                        <td className="p-3 font-medium">
                          <Badge variant="outline" className="text-[10px] font-bold">
                            {tx.payment_method === "cash"
                              ? "كاش"
                              : tx.payment_method === "card" || tx.payment_method === "visa"
                                ? "بطاقة"
                                : tx.payment_method || "نقدي"}
                          </Badge>
                        </td>
                        <td className="p-3 font-mono font-black text-emerald-600 dark:text-emerald-400">
                          ${Number(tx.total_usd || tx.total_amount_usd || 0).toLocaleString()}
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
                setClosingShift(shift);
              }
            : undefined
        }
      />

      {closingShift && (
        <ParkShiftClosingReportModal
          isOpen={!!closingShift}
          onClose={() => setClosingShift(null)}
          shiftToClose={closingShift}
          onShiftClosed={() => setClosingShift(null)}
        />
      )}

      {viewingClosedShift && (
        <ParkShiftClosingReportModal
          isOpen={!!viewingClosedShift}
          onClose={() => setViewingClosedShift(null)}
          viewOnlyShift={viewingClosedShift}
        />
      )}

      <ShiftAuditLogViewerModal
        isOpen={isShiftAuditLogOpen}
        onClose={() => setIsShiftAuditLogOpen(false)}
        initialShiftId={selectedShiftForAudit?.id}
        initialShiftType="park"
      />

      {editingShift && (
        <Dialog open={editingShift !== null} onOpenChange={() => setEditingShift(null)}>
          <DialogContent className="sm:max-w-[420px] rounded-3xl text-right" dir="rtl">
            <DialogHeader className="text-right">
              <DialogTitle className="text-base font-black">تعديل بيانات الوردية</DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div>
                <Label className="font-bold mb-1 block">اسم الوردية</Label>
                <Input
                  value={editShiftNumber}
                  onChange={(e) => setEditShiftNumber(e.target.value)}
                  className="rounded-xl h-9 font-bold"
                />
              </div>

              <div>
                <Label className="font-bold mb-1 block">الكاشير المسؤول</Label>
                <Input
                  value={editCashierName}
                  onChange={(e) => setEditCashierName(e.target.value)}
                  className="rounded-xl h-9 font-bold"
                />
              </div>

              <div>
                <Label className="font-bold mb-1 block">الرصيد الافتتاحي (USD $)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={editOpeningBalance}
                  onChange={(e) => setEditOpeningBalance(e.target.value)}
                  className="rounded-xl h-9 font-mono font-bold"
                />
              </div>

              <div>
                <Label className="font-bold mb-1 block">ملاحظات</Label>
                <Input
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="rounded-xl h-9"
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
                className="bg-primary text-primary-foreground rounded-xl font-bold"
              >
                حفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {deletingShift && (
        <Dialog open={deletingShift !== null} onOpenChange={() => setDeletingShift(null)}>
          <DialogContent className="sm:max-w-[400px] rounded-3xl text-right">
            <DialogHeader className="text-right">
              <DialogTitle className="text-base font-black flex items-center gap-2 text-rose-600">
                <Trash2 size={18} />
                <span>تأكيد حذف الوردية ({deletingShift.shift_number})</span>
              </DialogTitle>
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
