// @ts-nocheck
import React, { useState, useMemo, useEffect, useSyncExternalStore } from "react";
import { createFileRoute, useLocation, Link } from "@tanstack/react-router";
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
  Printer,
  FileSpreadsheet,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Wallet,
  Calendar,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  Eye,
  Filter,
  ArrowRight,
} from "lucide-react";
import * as XLSX from "xlsx";
import { erpStore } from "@/shared/services/erpStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  head: () => ({ meta: [{ title: "إدارة الحديقة - تذاكر الدخول والورديات والخزائن" }] }),
  component: ParkManagementPage,
});

export function ParkManagementPage() {
  const state = useSyncExternalStore(
    (cb) => erpStore.subscribe(cb),
    () => erpStore.getState(),
    () => erpStore.getState(),
  );

  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const tabParam = searchParams.get("tab") || "grid";

  const [activeTab, setActiveTab] = useState(tabParam);
  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

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

  // Search & Filter
  const [txSearch, setTxSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("all");

  const transactions = state.parkTransactions || [];
  const shifts = state.parkShifts || [];
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
    return shifts.filter((s: any) => s.status === "open");
  }, [shifts]);

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
    <div className="space-y-6 max-w-7xl mx-auto w-full pb-12">
      {/* Top Bar */}
      {activeTab === "grid" ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
          <Link to="/admin">
            <Button variant="outline" size="sm" className="gap-2 font-bold rounded-xl text-xs">
              <ArrowRight size={16} />
              العودة إلى الأقسام الرئيسية
            </Button>
          </Link>
          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              onClick={() => setIsParkPosOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs h-9 px-4 rounded-xl gap-1.5 shadow-sm transition active:scale-95"
            >
              <Ticket size={16} />
              <span>نقطة بيع التذاكر (POS)</span>
            </Button>
            <Button
              onClick={() => setIsParkShiftLauncherOpen(true)}
              variant="outline"
              className="font-bold text-xs h-9 px-3.5 rounded-xl gap-1.5"
            >
              <Plus size={15} />
              <span>فتح وردية جديدة</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
          <Button
            variant="outline"
            onClick={() => setActiveTab("grid")}
            className="gap-2 font-black rounded-xl text-xs py-2 px-4 border-teal-500/30 text-teal-700 dark:text-teal-400 hover:bg-teal-500/10 w-fit cursor-pointer"
          >
            <ArrowRight size={16} />
            العودة إلى أقسام الحديقة
          </Button>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            <Button
              size="sm"
              variant={activeTab === "tickets" ? "default" : "outline"}
              onClick={() => setActiveTab("tickets")}
              className="rounded-xl font-bold text-xs h-8"
            >
              التذاكر ({transactions.length})
            </Button>
            <Button
              size="sm"
              variant={activeTab === "shifts" ? "default" : "outline"}
              onClick={() => setActiveTab("shifts")}
              className="rounded-xl font-bold text-xs h-8"
            >
              الورديات ({shifts.length})
            </Button>
            <Button
              size="sm"
              variant={activeTab === "treasury" ? "default" : "outline"}
              onClick={() => setActiveTab("treasury")}
              className="rounded-xl font-bold text-xs h-8"
            >
              الخزائن (8)
            </Button>
            <Button
              size="sm"
              variant={activeTab === "reports" ? "default" : "outline"}
              onClick={() => setActiveTab("reports")}
              className="rounded-xl font-bold text-xs h-8"
            >
              التقارير
            </Button>
          </div>
        </div>
      )}

      {/* Grid view containing open shifts and park modules cards */}
      {activeTab === "grid" && (
        <div className="space-y-6">
          {/* Prominent Active Shifts Banner */}
          {openShifts.length > 0 && (
            <div className="bg-gradient-to-r from-teal-500/10 via-emerald-500/5 to-teal-500/10 border-2 border-teal-500/30 dark:border-teal-500/40 rounded-3xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-teal-500/20 pb-2">
                <div className="flex items-center gap-2">
                  <Clock size={18} className="text-teal-600 animate-pulse" />
                  <h3 className="font-black text-sm text-foreground">الورديات المفتوحة حالياً</h3>
                </div>
                <Badge className="bg-teal-600 text-white text-[11px] font-bold">
                  {openShifts.length} وردية قيد التشغيل
                </Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {openShifts.map((shift: any) => (
                  <div
                    key={shift.id}
                    className="bg-card border border-border p-3.5 rounded-2xl flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div>
                      <h4 className="font-bold text-xs text-foreground">{shift.cashier_name}</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        الخزينة: {shift.treasury_name || "الخزينة الرئيسية"}
                      </p>
                      <p className="text-[10px] text-teal-600 font-semibold mt-0.5">
                        بدأت: {new Date(shift.opened_at).toLocaleTimeString("ar-EG")}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedShiftForReport(shift);
                          setIsShiftClosingReportOpen(true);
                        }}
                        className="text-[10px] h-7 px-2.5 font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-lg"
                      >
                        تقرير فوري
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsParkShiftCloseModalOpen(true)}
                        className="text-[10px] h-7 px-2.5 font-bold text-rose-600 hover:bg-rose-50 border-rose-200 rounded-lg"
                      >
                        إغلاق الوردية
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Park Modules Square Cards Grid (نظام المربعات مثل قسم المطعم) */}
          <section aria-labelledby="park-modules-heading" className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <h2
                id="park-modules-heading"
                className="flex items-center gap-2 text-base font-black text-foreground"
              >
                <Trees size={18} className="text-teal-600" aria-hidden="true" />
                أقسام ووظائف إدارة الحديقة
              </h2>
              <span className="text-xs font-bold text-muted-foreground">6 أقسام تشغيلية</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card
                onClick={() => setIsParkPosOpen(true)}
                className="group cursor-pointer rounded-2xl border border-border/80 bg-card hover:border-emerald-500/50 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/20 transition-all duration-200 hover:shadow-lg"
              >
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 p-4">
                  <div className="rounded-xl bg-gradient-to-br from-emerald-500/25 to-teal-500/25 text-emerald-600 dark:text-emerald-400 p-2.5 shadow-xs">
                    <Ticket size={22} />
                  </div>
                  <span className="rounded-full border border-border/60 bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                    شباك التذاكر
                  </span>
                </CardHeader>
                <CardContent className="space-y-1.5 p-4 pt-0">
                  <h3 className="font-black text-sm text-foreground group-hover:text-emerald-600 transition-colors">
                    نقطة بيع التذاكر (POS)
                  </h3>
                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                    قطع تذاكر الدخول، الألعاب، طباعة إيصالات الباركود، والدفع النقدي والفيزا
                  </p>
                  <div className="pt-2 flex items-center justify-between border-t border-border/50 text-[11px] font-bold">
                    <span className="text-emerald-700 dark:text-emerald-400">تشغيل فوري</span>
                    <span className="text-muted-foreground group-hover:text-emerald-600 text-xs transition-transform group-hover:translate-x-[-2px]">
                      فتح الشباك ←
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card
                onClick={() => setActiveTab("shifts")}
                className={`group cursor-pointer rounded-2xl border transition-all duration-200 hover:shadow-lg ${
                  activeTab === "shifts"
                    ? "border-teal-500 bg-teal-50/40 dark:bg-teal-950/20 shadow-sm ring-2 ring-teal-400/30"
                    : "border-border/80 bg-card hover:border-teal-500/40 hover:bg-accent/30"
                }`}
              >
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 p-4">
                  <div className="rounded-xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20 text-teal-600 dark:text-teal-400 p-2.5 shadow-xs">
                    <Clock size={22} />
                  </div>
                  <span className="rounded-full border border-border/60 bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                    الورديات
                  </span>
                </CardHeader>
                <CardContent className="space-y-1.5 p-4 pt-0">
                  <h3 className="font-black text-sm text-foreground group-hover:text-teal-600 transition-colors">
                    ورديات الكاشير والتشغيل
                  </h3>
                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                    فتح ورديات جديدة، تتبع حركات الكاشير، إغلاق الورديات وطباعة التقارير
                  </p>
                  <div className="pt-2 flex items-center justify-between border-t border-border/50 text-[11px] font-bold">
                    <span className="text-teal-700 dark:text-teal-400">
                      {openShifts.length} وردية مفتوحة
                    </span>
                    <span className="text-muted-foreground group-hover:text-teal-600 text-xs transition-transform group-hover:translate-x-[-2px]">
                      متابعة الورديات ←
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card
                onClick={() => {
                  setActiveTab("treasury");
                  setIsParkTreasuriesModalOpen(true);
                }}
                className={`group cursor-pointer rounded-2xl border transition-all duration-200 hover:shadow-lg ${
                  activeTab === "treasury"
                    ? "border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 shadow-sm ring-2 ring-blue-400/30"
                    : "border-border/80 bg-card hover:border-blue-500/40 hover:bg-accent/30"
                }`}
              >
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 p-4">
                  <div className="rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-blue-600 dark:text-blue-400 p-2.5 shadow-xs">
                    <Landmark size={22} />
                  </div>
                  <span className="rounded-full border border-border/60 bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                    الخزائن
                  </span>
                </CardHeader>
                <CardContent className="space-y-1.5 p-4 pt-0">
                  <h3 className="font-black text-sm text-foreground group-hover:text-blue-600 transition-colors">
                    الخزائن التشغيلية (8 خزائن)
                  </h3>
                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                    متابعة أرصدة خزائن الحديقة الثمانية، تحويل النقدية، والتسويات اليومية
                  </p>
                  <div className="pt-2 flex items-center justify-between border-t border-border/50 text-[11px] font-bold">
                    <span className="text-blue-700 dark:text-blue-400">
                      {operationalTreasuries.length} خزينة جاهزة
                    </span>
                    <span className="text-muted-foreground group-hover:text-blue-600 text-xs transition-transform group-hover:translate-x-[-2px]">
                      فتح الخزائن ←
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card
                onClick={() => setActiveTab("tickets")}
                className={`group cursor-pointer rounded-2xl border transition-all duration-200 hover:shadow-lg ${
                  activeTab === "tickets"
                    ? "border-amber-500 bg-amber-50/40 dark:bg-amber-950/20 shadow-sm ring-2 ring-amber-400/30"
                    : "border-border/80 bg-card hover:border-amber-500/40 hover:bg-accent/30"
                }`}
              >
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 p-4">
                  <div className="rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-400 p-2.5 shadow-xs">
                    <Ticket size={22} />
                  </div>
                  <span className="rounded-full border border-border/60 bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                    العمليات
                  </span>
                </CardHeader>
                <CardContent className="space-y-1.5 p-4 pt-0">
                  <h3 className="font-black text-sm text-foreground group-hover:text-amber-600 transition-colors">
                    سجل التذاكر واسترجاعها
                  </h3>
                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                    استعراض كافة تذاكر الدخول المباعة، البحث برقم التذكرة، وإجراء الاسترجاع
                  </p>
                  <div className="pt-2 flex items-center justify-between border-t border-border/50 text-[11px] font-bold">
                    <span className="text-amber-700 dark:text-amber-400">
                      {transactions.length} تذكرة مباعة
                    </span>
                    <span className="text-muted-foreground group-hover:text-amber-600 text-xs transition-transform group-hover:translate-x-[-2px]">
                      عرض السجل ←
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card
                onClick={() => setIsParkPricesModalOpen(true)}
                className="group cursor-pointer rounded-2xl border border-border/80 bg-card hover:border-purple-500/40 hover:bg-purple-50/20 dark:hover:bg-purple-950/20 transition-all duration-200 hover:shadow-lg"
              >
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 p-4">
                  <div className="rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 text-purple-600 dark:text-purple-400 p-2.5 shadow-xs">
                    <Settings size={22} />
                  </div>
                  <span className="rounded-full border border-border/60 bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                    الأسعار
                  </span>
                </CardHeader>
                <CardContent className="space-y-1.5 p-4 pt-0">
                  <h3 className="font-black text-sm text-foreground group-hover:text-purple-600 transition-colors">
                    أسعار وتصنيفات التذاكر
                  </h3>
                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                    تحديد أسعار التذاكر العادية، ألعاب الأطفال، الفعاليات والمواقف بالدولار
                  </p>
                  <div className="pt-2 flex items-center justify-between border-t border-border/50 text-[11px] font-bold">
                    <span className="text-purple-700 dark:text-purple-400">إعدادات سريعة</span>
                    <span className="text-muted-foreground group-hover:text-purple-600 text-xs transition-transform group-hover:translate-x-[-2px]">
                      تعديل الأسعار ←
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card
                onClick={() => setActiveTab("reports")}
                className={`group cursor-pointer rounded-2xl border transition-all duration-200 hover:shadow-lg ${
                  activeTab === "reports"
                    ? "border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-sm ring-2 ring-emerald-400/30"
                    : "border-border/80 bg-card hover:border-emerald-500/40 hover:bg-accent/30"
                }`}
              >
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 p-4">
                  <div className="rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400 p-2.5 shadow-xs">
                    <TrendingUp size={22} />
                  </div>
                  <span className="rounded-full border border-border/60 bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                    التقارير
                  </span>
                </CardHeader>
                <CardContent className="space-y-1.5 p-4 pt-0">
                  <h3 className="font-black text-sm text-foreground group-hover:text-emerald-600 transition-colors">
                    التقارير والمبيعات المالية
                  </h3>
                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                    إجمالي الإيرادات المحصلة، إحصائيات الإشغال والزوار، والمبيعات حسب طرق الدفع
                  </p>
                  <div className="pt-2 flex items-center justify-between border-t border-border/50 text-[11px] font-bold">
                    <span className="text-emerald-700 dark:text-emerald-400">
                      ${totalSalesAmount.toLocaleString()} إيراد كلي
                    </span>
                    <span className="text-muted-foreground group-hover:text-emerald-600 text-xs transition-transform group-hover:translate-x-[-2px]">
                      عرض التقارير ←
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Quick Action Buttons Bar */}
          <div className="flex items-center justify-between gap-3 flex-wrap bg-card border border-border p-3.5 rounded-2xl shadow-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsParkTreasuriesModalOpen(true)}
                className="rounded-xl text-xs font-bold gap-1.5"
              >
                <Landmark size={14} />
                الخزائن التشغيلية (8)
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsParkPricesModalOpen(true)}
                className="rounded-xl text-xs font-bold gap-1.5"
              >
                <Settings size={14} />
                أسعار وتصنيفات التذاكر
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsParkCustomersModalOpen(true)}
                className="rounded-xl text-xs font-bold gap-1.5"
              >
                <Users size={14} />
                دليل عملاء الحديقة
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsParkShiftCloseModalOpen(true)}
                className="rounded-xl text-xs font-bold gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400"
              >
                <History size={14} />
                سجل إغلاق الورديات
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="rounded-xl text-xs font-bold gap-1.5"
            >
              <FileSpreadsheet size={14} />
              تصدير التذاكر إلى Excel
            </Button>
          </div>
        </div>
      )}

      {/* Tabs */}
      {activeTab !== "grid" && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-muted p-1 rounded-xl flex flex-wrap gap-1 h-auto w-full md:w-auto">
            <TabsTrigger value="tickets" className="rounded-lg font-bold py-2.5 px-5">
              <Ticket size={16} className="ml-1.5 inline" />
              تذاكر وعمليات الحديقة ({transactions.length})
            </TabsTrigger>
            <TabsTrigger value="shifts" className="rounded-lg font-bold py-2.5 px-5">
              <Clock size={16} className="ml-1.5 inline" />
              ورديات الكاشير ({shifts.length})
            </TabsTrigger>
            <TabsTrigger value="treasury" className="rounded-lg font-bold py-2.5 px-5">
              <Landmark size={16} className="ml-1.5 inline" />
              الخزائن التشغيلية ({operationalTreasuries.length})
            </TabsTrigger>
            <TabsTrigger value="reports" className="rounded-lg font-bold py-2.5 px-5">
              <TrendingUp size={16} className="ml-1.5 inline" />
              التقارير والمبيعات
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: TICKETS & TRANSACTIONS */}
          <TabsContent value="tickets" className="space-y-4 mt-4">
            <Card className="border border-border shadow-xs rounded-2xl">
              <CardHeader className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60">
                <div>
                  <CardTitle className="text-base font-black">سجل تذاكر وعمليات الدخول</CardTitle>
                  <CardDescription className="text-xs">
                    كشف كامل بجميع الفواتير والتذاكر الصادرة مع إمكانية الطباعة والاسترجاع
                  </CardDescription>
                </div>
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
                        <td colSpan={8} className="text-center py-12 text-muted-foreground">
                          لا توجد حركات تذاكر مسجلة مطابقة للبحث
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
          </TabsContent>

          {/* TAB 2: SHIFTS */}
          <TabsContent value="shifts" className="space-y-4 mt-4">
            <Card className="border border-border shadow-xs rounded-2xl">
              <CardHeader className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60">
                <div>
                  <CardTitle className="text-base font-black">
                    ورديات وجلسات كاشير الحديقة
                  </CardTitle>
                  <CardDescription className="text-xs">
                    سجل الورديات المفتوحة والمغلقة، تقارير الإغلاق، ومطابقة الصناديق
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setIsParkShiftLauncherOpen(true)}
                  size="sm"
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs gap-1.5"
                >
                  <Plus size={14} />
                  فتح وردية جديدة
                </Button>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold">
                    <tr>
                      <th className="p-3">رقم الوردية</th>
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
                          <td className="p-3 font-mono font-bold">{s.id.slice(0, 8)}</td>
                          <td className="p-3 font-bold text-foreground">{s.cashier_name}</td>
                          <td className="p-3 text-muted-foreground font-mono">
                            {new Date(s.opened_at).toLocaleString("ar-EG")}
                          </td>
                          <td className="p-3 text-muted-foreground font-mono">
                            {s.closed_at
                              ? new Date(s.closed_at).toLocaleString("ar-EG")
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
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: OPERATIONAL TREASURIES */}
          <TabsContent value="treasury" className="space-y-4 mt-4">
            <Card className="border border-border shadow-xs rounded-2xl">
              <CardHeader className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60">
                <div>
                  <CardTitle className="text-base font-black">
                    الخزائن التشغيلية الثمانية للحديقة
                  </CardTitle>
                  <CardDescription className="text-xs">
                    مراقبة الأرصدة النقدية والعملات الأجنبية لكل كاشير ونقطة بيع
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setIsParkTreasuriesModalOpen(true)}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs gap-1.5"
                >
                  إدارة أوعية الخزائن
                </Button>
              </CardHeader>
              <CardContent className="p-5">
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: REPORTS */}
          <TabsContent value="reports" className="space-y-4 mt-4">
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
          </TabsContent>
        </Tabs>
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
        isOpen={isParkShiftCloseModalOpen}
        onClose={() => setIsParkShiftCloseModalOpen(false)}
      />
      <ParkShiftLauncherModal
        isOpen={isParkShiftLauncherOpen}
        onClose={() => setIsParkShiftLauncherOpen(false)}
      />
      <ParkShiftClosingReportModal
        isOpen={isShiftClosingReportOpen}
        onClose={() => setIsShiftClosingReportOpen(false)}
        shift={selectedShiftForReport}
      />
      <ShiftAuditLogViewerModal
        isOpen={isShiftAuditLogOpen}
        onClose={() => setIsShiftAuditLogOpen(false)}
        shiftId={selectedShiftForAudit?.id}
      />
    </div>
  );
}
export default ParkManagementPage;

