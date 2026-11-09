import React, { useState, useEffect, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  History,
  Search,
  RefreshCw,
  Database,
  Calendar,
  User,
  Filter,
  Download,
  X,
  ChevronDown,
  ChevronUp,
  FileCode,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  TrendingUp,
  SlidersHorizontal,
  Table as TableIcon,
  ListTree,
  Trees,
  Utensils,
  ShieldCheck,
  Eye,
  Lock,
  Unlock,
  AlertTriangle,
} from "lucide-react";
import {
  shiftAuditService,
  ShiftAuditLogEntry,
  ShiftType,
  ShiftVisibilityAnalysis,
} from "@/features/shifts/services/shiftAuditService";
import { erpStore } from "@/shared/services/erpStore";
import { toast } from "sonner";

export interface ShiftAuditLogViewerProps {
  initialShiftType?: ShiftType | "ALL" | string;
  initialShiftId?: string;
  initialAction?: string;
  showHeaderTitle?: boolean;
  compact?: boolean;
}

export const ShiftAuditLogViewer: React.FC<ShiftAuditLogViewerProps> = ({
  initialShiftType = "ALL",
  initialShiftId,
  initialAction = "ALL",
  showHeaderTitle = true,
  compact = false,
}) => {
  const normalizedInitialType: ShiftType | "ALL" =
    initialShiftType && String(initialShiftType).toLowerCase() === "park"
      ? "park"
      : initialShiftType && String(initialShiftType).toLowerCase() === "restaurant"
        ? "restaurant"
        : "ALL";

  const [logs, setLogs] = useState<ShiftAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"supabase" | "local" | "hybrid">("local");
  const [viewMode, setViewMode] = useState<"table" | "timeline">("table");
  const [storeTick, setStoreTick] = useState(0);

  // Live Synchronized Shifts State
  const [liveShiftSectorFilter, setLiveShiftSectorFilter] = useState<"ALL" | "park" | "restaurant">(
    normalizedInitialType,
  );
  const [liveShiftStatusFilter, setLiveShiftStatusFilter] = useState<"ALL" | "open" | "closed">(
    "ALL",
  );
  const [inspectedShiftId, setInspectedShiftId] = useState<string | null>(initialShiftId || null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<ShiftType | "ALL">(normalizedInitialType);
  const [selectedAction, setSelectedAction] = useState<string>(initialAction);
  const [selectedUser, setSelectedUser] = useState<string>("ALL");
  const [datePreset, setDatePreset] = useState<"all" | "today" | "last7" | "thisMonth" | "custom">(
    "all",
  );
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedType(normalizedInitialType);
    setLiveShiftSectorFilter(normalizedInitialType);
  }, [normalizedInitialType]);

  useEffect(() => {
    if (initialShiftId) {
      setInspectedShiftId(initialShiftId);
    }
  }, [initialShiftId]);

  // Subscribe to erpStore and window events for real-time Park & Restaurant shift updates
  useEffect(() => {
    const bump = () => setStoreTick((t) => t + 1);
    const unsub = erpStore.subscribe(bump);
    window.addEventListener("shift_audit_updated", bump);
    window.addEventListener("storage", bump);
    window.addEventListener("focus", bump);
    return () => {
      unsub();
      window.removeEventListener("shift_audit_updated", bump);
      window.removeEventListener("storage", bump);
      window.removeEventListener("focus", bump);
    };
  }, []);

  // Load audit data from Supabase & synchronize with Park & Restaurant shifts
  const loadData = async () => {
    setLoading(true);
    try {
      await shiftAuditService.syncOpenShiftsFromSupabase(erpStore);
      shiftAuditService.syncShiftsWithAuditLogs(
        erpStore.getParkShifts(),
        erpStore.getRestaurantShifts(),
      );

      let finalStart = startDate;
      let finalEnd = endDate;

      if (datePreset === "today") {
        const today = new Date().toISOString().split("T")[0];
        finalStart = today;
        finalEnd = today;
      } else if (datePreset === "last7") {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        finalStart = d.toISOString().split("T")[0];
        finalEnd = new Date().toISOString().split("T")[0];
      } else if (datePreset === "thisMonth") {
        const now = new Date();
        finalStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
        finalEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
      }

      const res = await shiftAuditService.getShiftAuditLogs({
        shiftId: initialShiftId || undefined,
        shiftType: selectedType !== "ALL" ? selectedType : undefined,
        action: selectedAction !== "ALL" ? selectedAction : undefined,
        startDate: finalStart || undefined,
        endDate: finalEnd || undefined,
        userFilter: selectedUser !== "ALL" ? selectedUser : undefined,
        searchQuery: searchQuery.trim() || undefined,
        limit: 300,
      });

      setLogs(res.logs);
      setSource(res.source);
    } catch (err: any) {
      toast.error("فشل تحميل سجل التدقيق: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [
    selectedType,
    selectedAction,
    selectedUser,
    datePreset,
    startDate,
    endDate,
    searchQuery,
    initialShiftId,
    storeTick,
  ]);

  // Live Park & Restaurant shifts synchronized from erpStore
  const liveShiftsData = useMemo(() => {
    const parkShifts = erpStore.getParkShifts() || [];
    const restaurantShifts = erpStore.getRestaurantShifts() || [];
    const activeParkShift = erpStore.getActiveParkShift();
    const activeRestaurantShift = erpStore.getActiveRestaurantShift();
    const parkTxs = erpStore.getParkTicketTransactions() || [];
    let localRestOrders: any[] = [];
    if (typeof window !== "undefined") {
      try {
        localRestOrders = JSON.parse(localStorage.getItem("pos_local_orders") || "[]");
      } catch {
        localRestOrders = [];
      }
    }

    const combined = [
      ...parkShifts.map((s) => {
        const shiftTxs = parkTxs.filter(
          (t) => t.shift_id === s.id || t.shift_number === s.shift_number,
        );
        const salesUsd = shiftTxs
          .filter((t) => t.currency === "USD" && t.status !== "refunded")
          .reduce((sum, t) => sum + (t.total_usd || 0), 0);
        const salesSsp = shiftTxs
          .filter((t) => t.currency === "SSP" && t.status !== "refunded")
          .reduce((sum, t) => sum + (t.total_paid_in_currency || 0), 0);
        const refundsCount = shiftTxs.filter((t) => t.status === "refunded").length;
        return {
          ...s,
          sector: "park" as const,
          isActiveSession: activeParkShift?.id === s.id,
          txCount: shiftTxs.filter((t) => t.status !== "refunded").length,
          refundsCount,
          salesUsd,
          salesSsp,
          salesEgp: 0,
        };
      }),
      ...restaurantShifts.map((s) => {
        const startMs = new Date(s.start_at || 0).getTime();
        const endMs = s.end_at ? new Date(s.end_at).getTime() : Date.now();
        const matchingOrders = localRestOrders.filter((o: any) => {
          if (o.shift_id === s.id || o.shift_number === s.shift_number) return true;
          const oMs = new Date(o.created_at || 0).getTime();
          return oMs >= startMs - 60000 && oMs <= endMs + 60000;
        });
        const ordersCount = Math.max(Number(s.orders_count || 0), matchingOrders.length);
        const computedSales = matchingOrders.reduce(
          (sum: number, o: any) => sum + Number(o.total || 0),
          0,
        );
        const salesEgp =
          Number(s.total_sales || 0) > 0 ? Number(s.total_sales || 0) : computedSales;
        return {
          ...s,
          sector: "restaurant" as const,
          isActiveSession: activeRestaurantShift?.id === s.id,
          txCount: ordersCount,
          refundsCount: Number(s.refunds_count || 0),
          salesUsd: 0,
          salesSsp: 0,
          salesEgp,
        };
      }),
    ].sort(
      (a, b) => new Date(b.start_at || 0).getTime() - new Date(a.start_at || 0).getTime(),
    );

    const filtered = combined.filter((item) => {
      if (liveShiftSectorFilter !== "ALL" && item.sector !== liveShiftSectorFilter) return false;
      if (liveShiftStatusFilter !== "ALL" && item.status !== liveShiftStatusFilter) return false;
      return true;
    });

    return {
      parkShifts,
      restaurantShifts,
      activeParkShift,
      activeRestaurantShift,
      parkOpenCount: parkShifts.filter((s) => s.status === "open").length,
      parkClosedCount: parkShifts.filter((s) => s.status === "closed").length,
      restOpenCount: restaurantShifts.filter((s) => s.status === "open").length,
      restClosedCount: restaurantShifts.filter((s) => s.status === "closed").length,
      combined,
      filtered,
      parkTxs,
      localRestOrders,
    };
  }, [storeTick, logs, liveShiftSectorFilter, liveShiftStatusFilter]);

  const inspectedShiftAnalysis: ShiftVisibilityAnalysis | null = useMemo(() => {
    if (!inspectedShiftId) return null;
    const target = liveShiftsData.combined.find((s) => s.id === inspectedShiftId);
    if (!target) return null;
    const isPark = target.sector === "park";
    return shiftAuditService.analyzeShiftVisibility(
      target,
      liveShiftsData.combined,
      isPark ? liveShiftsData.activeParkShift : liveShiftsData.activeRestaurantShift,
      isPark ? liveShiftsData.parkTxs : liveShiftsData.localRestOrders,
    );
  }, [inspectedShiftId, liveShiftsData]);

  const handleRecoverShiftState = (
    shiftId: string,
    targetStatus: "open" | "closed",
    makeActive?: boolean,
  ) => {
    try {
      erpStore.recoverShiftState(shiftId, targetStatus, makeActive);
      toast.success(
        `تم تحديث حالة الوردية إلى "${targetStatus === "open" ? "مفتوحة" : "مغلقة"}" ومزامنتها فوراً!`,
      );
      loadData();
    } catch (err: any) {
      toast.error(err.message || "تعذر تحديث حالة الوردية");
    }
  };

  // Extract unique users/cashiers from logs and ERP state for the dropdown
  const uniqueUsers = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.performed_by) set.add(l.performed_by.trim());
      if (l.cashier_name) set.add(l.cashier_name.trim());
      if (l.user_email) set.add(l.user_email.trim());
    });
    // Add ERP employees as well
    const employees =
      typeof erpStore.getEmployees === "function"
        ? erpStore.getEmployees()
        : (erpStore as any).getState?.()?.employees || (erpStore as any).state?.employees || [];
    if (Array.isArray(employees)) {
      employees.forEach((e: any) => {
        if (e?.name) set.add(String(e.name).trim());
      });
    }
    return Array.from(set).filter(Boolean).sort();
  }, [logs]);

  // Metrics summary
  const metrics = useMemo(() => {
    const total = logs.length;
    const opens = logs.filter((l) => l.action === "OPEN" || l.action === "AUTO_CREATE").length;
    const closes = logs.filter((l) => l.action === "CLOSE").length;
    const updates = logs.filter(
      (l) =>
        l.action === "UPDATE" ||
        l.action === "RECOVER_STATE" ||
        l.action === "RESUME" ||
        l.action === "ACTIVATE",
    ).length;
    const deletes = logs.filter((l) => l.action === "DELETE").length;
    return { total, opens, closes, updates, deletes };
  }, [logs]);

  // Export handlers
  const handleExportJSON = () => {
    const dataStr =
      "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const a = document.createElement("a");
    a.href = dataStr;
    a.download = `supabase-shift-audit-logs-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success("تم تصدير سجل تدقيق Supabase بصيغة JSON بنجاح!");
  };

  const handleExportCSV = () => {
    const headers = [
      "التاريخ والوقت",
      "نوع الوردية",
      "رقم الوردية",
      "الإجراء",
      "الحالة السابقة",
      "الحالة اللاحقة",
      "اسم الكاشير",
      "المستخدم المنفذ",
      "التفاصيل",
    ];
    const rows = logs.map((l) => [
      `"${l.client_timestamp || l.created_at || ""}"`,
      `"${l.shift_type === "park" ? "تذاكر الحديقة" : "المطعم"}"`,
      `"${l.shift_number || ""}"`,
      `"${l.action || ""}"`,
      `"${l.status_before || ""}"`,
      `"${l.status_after || ""}"`,
      `"${l.cashier_name || ""}"`,
      `"${l.performed_by || ""}"`,
      `"${(l.details || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shift-audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success("تم تصدير سجل التدقيق بصيغة CSV بنجاح!");
  };

  const resetFilters = () => {
    setSelectedType("ALL");
    setSelectedAction("ALL");
    setSelectedUser("ALL");
    setDatePreset("all");
    setStartDate("");
    setEndDate("");
    setSearchQuery("");
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "OPEN":
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
            افتتاح OPEN
          </Badge>
        );
      case "CLOSE":
        return (
          <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-bold">إغلاق CLOSE</Badge>
        );
      case "RESUME":
        return (
          <Badge className="bg-teal-600 hover:bg-teal-700 text-white font-bold">
            استئناف RESUME
          </Badge>
        );
      case "ACTIVATE":
        return (
          <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
            تفعيل ACTIVATE
          </Badge>
        );
      case "AUTO_CREATE":
        return (
          <Badge className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold">
            إنشاء تلقائي AUTO
          </Badge>
        );
      case "UPDATE":
        return (
          <Badge className="bg-amber-600 hover:bg-amber-700 text-white font-bold">
            تعديل UPDATE
          </Badge>
        );
      case "DELETE":
        return (
          <Badge className="bg-rose-600 hover:bg-rose-700 text-white font-bold">حذف DELETE</Badge>
        );
      case "RECOVER_STATE":
        return (
          <Badge className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold">
            إصلاح حالة RECOVER
          </Badge>
        );
      case "FILTER_ANOMALY":
        return (
          <Badge className="bg-purple-600 hover:bg-purple-700 text-white font-bold">
            شذوذ تصفية ANOMALY
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="font-bold">
            {action}
          </Badge>
        );
    }
  };

  const hasActiveFilters =
    selectedType !== "ALL" ||
    selectedAction !== "ALL" ||
    selectedUser !== "ALL" ||
    datePreset !== "all" ||
    !!startDate ||
    !!endDate ||
    !!searchQuery.trim();

  return (
    <div className="space-y-5 text-right font-sans antialiased" dir="rtl">
      {/* Header Banner */}
      {showHeaderTitle && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-5 rounded-3xl border border-border shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-teal-500/10 text-teal-600 rounded-2xl">
              <ShieldCheck size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black text-foreground">
                  قسم تدقيق ومزامنة الورديات (الحديقة والمطعم)
                </h2>
                <Badge
                  variant="outline"
                  className="bg-teal-500/10 text-teal-600 border-teal-500/30 text-xs font-bold"
                >
                  {source === "supabase"
                    ? "متزامن مع Supabase"
                    : source === "hybrid"
                      ? "مزامنة مزدوجة (Supabase + محلي)"
                      : "متزامن حياً مع الحديقة والمطعم"}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
              className="gap-1.5 text-xs h-9 font-bold rounded-xl cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              مزامنة وتحديث
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="gap-1.5 text-xs h-9 font-bold rounded-xl cursor-pointer"
            >
              <FileSpreadsheet size={14} />
              تصدير CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportJSON}
              className="gap-1.5 text-xs h-9 font-bold rounded-xl cursor-pointer"
            >
              <FileCode size={14} />
              JSON
            </Button>
            <div className="flex bg-muted p-0.5 rounded-xl border border-border">
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === "table"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground"
                }`}
                title="عرض جدولي"
              >
                <TableIcon size={15} />
              </button>
              <button
                onClick={() => setViewMode("timeline")}
                className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === "timeline"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground"
                }`}
                title="عرض المخطط الزمني"
              >
                <ListTree size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIVE PARK & RESTAURANT SYNCHRONIZATION CARDS */}
      {!compact && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Park Shifts Live Card */}
          <div className="bg-card border-2 border-emerald-500/30 rounded-3xl p-4 shadow-xs flex flex-col justify-between gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
                  <Trees size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-base text-foreground">
                      مزامنة ورديات الحديقة (Park POS)
                    </h3>
                    {liveShiftsData.parkOpenCount > 0 ? (
                      <Badge className="bg-emerald-600 text-white text-[11px] font-black">
                        {liveShiftsData.parkOpenCount} وردية مفتوحة الآن
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[11px] font-bold">
                        لا توجد وردية مفتوحة
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    إجمالي الورديات: <b>{liveShiftsData.parkShifts.length}</b> (مفتوحة:{" "}
                    <b className="text-emerald-600">{liveShiftsData.parkOpenCount}</b> | مغلقة:{" "}
                    <b className="text-blue-600">{liveShiftsData.parkClosedCount}</b>)
                  </p>
                </div>
              </div>
              <Link to="/admin/park" search={{ tab: "operations" } as any}>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs font-bold h-8 rounded-xl border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 gap-1.5"
                >
                  <span>ورديات الحديقة</span>
                  <ArrowRight size={13} className="rotate-180" />
                </Button>
              </Link>
            </div>
            {liveShiftsData.activeParkShift ? (
              <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
                <div>
                  <span className="font-bold text-emerald-800 dark:text-emerald-300">
                    الوردية النشطة بالحديقة:{" "}
                  </span>
                  <span className="font-black text-foreground">
                    {liveShiftsData.activeParkShift.shift_number}
                  </span>
                  <span className="text-muted-foreground mr-2">
                    ({liveShiftsData.activeParkShift.cashier_name})
                  </span>
                </div>
                <Badge className="bg-emerald-600 text-white text-[10px]">نشطة بالجلسة</Badge>
              </div>
            ) : (
              <div className="bg-muted/50 border border-border rounded-2xl px-3.5 py-2 text-xs text-muted-foreground font-semibold">
                لا توجد وردية تذاكر نشطة في الجلسة الحالية
              </div>
            )}
          </div>

          {/* Restaurant Shifts Live Card */}
          <div className="bg-card border-2 border-orange-500/30 rounded-3xl p-4 shadow-xs flex flex-col justify-between gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-orange-500/15 text-orange-600 flex items-center justify-center shrink-0">
                  <Utensils size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-base text-foreground">
                      مزامنة ورديات المطعم (Restaurant POS)
                    </h3>
                    {liveShiftsData.restOpenCount > 0 ? (
                      <Badge className="bg-emerald-600 text-white text-[11px] font-black">
                        {liveShiftsData.restOpenCount} وردية مفتوحة الآن
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[11px] font-bold">
                        لا توجد وردية مفتوحة
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    إجمالي الورديات: <b>{liveShiftsData.restaurantShifts.length}</b> (مفتوحة:{" "}
                    <b className="text-emerald-600">{liveShiftsData.restOpenCount}</b> | مغلقة:{" "}
                    <b className="text-blue-600">{liveShiftsData.restClosedCount}</b>)
                  </p>
                </div>
              </div>
              <Link to="/admin/restaurant" search={{ tab: "operations" } as any}>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs font-bold h-8 rounded-xl border-orange-500/40 text-orange-700 dark:text-orange-300 hover:bg-orange-500/10 gap-1.5"
                >
                  <span>ورديات المطعم</span>
                  <ArrowRight size={13} className="rotate-180" />
                </Button>
              </Link>
            </div>
            {liveShiftsData.activeRestaurantShift ? (
              <div className="bg-orange-500/10 border border-orange-500/25 rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
                <div>
                  <span className="font-bold text-orange-800 dark:text-orange-300">
                    الوردية النشطة بالمطعم:{" "}
                  </span>
                  <span className="font-black text-foreground">
                    {liveShiftsData.activeRestaurantShift.shift_number}
                  </span>
                  <span className="text-muted-foreground mr-2">
                    ({liveShiftsData.activeRestaurantShift.cashier_name})
                  </span>
                </div>
                <Badge className="bg-orange-600 text-white text-[10px]">نشطة بالجلسة</Badge>
              </div>
            ) : (
              <div className="bg-muted/50 border border-border rounded-2xl px-3.5 py-2 text-xs text-muted-foreground font-semibold">
                لا توجد وردية مطعم نشطة في الجلسة الحالية
              </div>
            )}
          </div>
        </div>
      )}

      {/* LIVE SYNCHRONIZED SHIFTS TABLE (PARK & RESTAURANT) */}
      {!compact && (
        <Card className="rounded-3xl border-border bg-card shadow-xs overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Layers size={18} className="text-teal-600" />
              <CardTitle className="text-sm font-black">
                جدول الورديات المتزامنة حياً (الحديقة والمطعم)
              </CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: "ALL", label: `الكل (${liveShiftsData.combined.length})` },
                  { id: "park", label: `الحديقة (${liveShiftsData.parkShifts.length})` },
                  { id: "restaurant", label: `المطعم (${liveShiftsData.restaurantShifts.length})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setLiveShiftSectorFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    liveShiftSectorFilter === tab.id
                      ? "bg-teal-600 text-white"
                      : "bg-muted hover:bg-muted/80 text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              <span className="h-4 w-px bg-border mx-1" />
              {(
                [
                  { id: "ALL", label: "جميع الحالات" },
                  { id: "open", label: "مفتوحة 🟢" },
                  { id: "closed", label: "مغلقة 🔒" },
                ] as const
              ).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setLiveShiftStatusFilter(st.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    liveShiftStatusFilter === st.id
                      ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                      : "bg-muted hover:bg-muted/80 text-foreground"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {liveShiftsData.filtered.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground font-bold">
                لا توجد ورديات مسجلة مطابقة للفلتر المحدد حالياً
              </div>
            ) : (
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-right text-xs border-collapse">
                  <thead className="bg-muted/60 sticky top-0 z-10 text-muted-foreground font-black border-b border-border">
                    <tr>
                      <th className="p-3">القسم</th>
                      <th className="p-3">اسم ورقم الوردية</th>
                      <th className="p-3">الحالة</th>
                      <th className="p-3">الكاشير المسؤول</th>
                      <th className="p-3">وقت الفتح / الإغلاق</th>
                      <th className="p-3">إجمالي المبيعات والعمليات</th>
                      <th className="p-3 text-center">إجراءات التدقيق والمزامنة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {liveShiftsData.filtered.map((s) => (
                      <tr key={s.id} className="hover:bg-muted/30 transition">
                        <td className="p-3">
                          {s.sector === "park" ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-bold gap-1"
                            >
                              <Trees size={12} />
                              الحديقة
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30 font-bold gap-1"
                            >
                              <Utensils size={12} />
                              المطعم
                            </Badge>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="font-black text-foreground">{s.shift_number}</div>
                          {s.auto_shift_number && (
                            <div className="text-[10px] font-mono text-muted-foreground">
                              {s.auto_shift_number}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {s.status === "open" ? (
                              <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                                مفتوحة
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] font-bold">
                                مغلقة
                              </Badge>
                            )}
                            {s.isActiveSession && (
                              <Badge className="bg-teal-600 text-white text-[10px] font-bold">
                                نشطة بالجلسة
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-3 font-bold">{s.cashier_name || "-"}</td>
                        <td className="p-3 text-[11px] font-mono">
                          <div>فتح: {new Date(s.start_at).toLocaleString("ar-EG")}</div>
                          {s.end_at && (
                            <div className="text-muted-foreground">
                              إغلاق: {new Date(s.end_at).toLocaleString("ar-EG")}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          {s.sector === "park" ? (
                            <div className="space-y-0.5 text-[11px]">
                              <div className="font-black text-emerald-600">
                                {s.salesUsd.toLocaleString()} USD | {s.salesSsp.toLocaleString()}{" "}
                                SSP
                              </div>
                              <div className="text-muted-foreground">
                                {s.txCount} عملية بيع{" "}
                                {s.refundsCount > 0 ? `| ${s.refundsCount} مرتجع` : ""}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-0.5 text-[11px]">
                              <div className="font-black text-orange-600">
                                {s.salesEgp.toLocaleString()} EGP
                              </div>
                              <div className="text-muted-foreground">
                                {s.txCount} طلب{" "}
                                {s.refundsCount > 0 ? `| ${s.refundsCount} مرتجع` : ""}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setInspectedShiftId(inspectedShiftId === s.id ? null : s.id)
                              }
                              className="h-7 px-2.5 text-[11px] font-bold rounded-lg gap-1 cursor-pointer"
                            >
                              <Eye size={12} />
                              فحص وتشخيص
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSearchQuery(s.auto_shift_number || s.shift_number);
                                setSelectedType(s.sector);
                              }}
                              className="h-7 px-2.5 text-[11px] font-bold rounded-lg gap-1 text-teal-600 hover:bg-teal-500/10 cursor-pointer"
                            >
                              <History size={12} />
                              سجل الوردية
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Inline Diagnostic & State Recovery Drawer when a shift is inspected */}
            {inspectedShiftAnalysis && (
              <div className="p-4 bg-muted/40 border-t border-border space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={18} className="text-teal-600" />
                    <h4 className="font-black text-sm">
                      تشخيص حالة وظهور الوردية: {inspectedShiftAnalysis.shiftNumber} (
                      {inspectedShiftAnalysis.shiftType === "park" ? "الحديقة" : "المطعم"})
                    </h4>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      onClick={() =>
                        handleRecoverShiftState(inspectedShiftAnalysis.shiftId, "open", true)
                      }
                      className="h-7 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-1"
                    >
                      <Unlock size={12} />
                      تحويل لمفتوحة وتفعيلها بالجلسة
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleRecoverShiftState(inspectedShiftAnalysis.shiftId, "closed", false)
                      }
                      className="h-7 text-xs font-bold rounded-lg gap-1"
                    >
                      <Lock size={12} />
                      تحويل لمغلقة
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setInspectedShiftId(null)}
                      className="h-7 text-xs font-bold"
                    >
                      إغلاق الفحص
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {inspectedShiftAnalysis.diagnostics.map((d, i) => (
                    <div
                      key={i}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-start gap-2 ${
                        d.level === "error"
                          ? "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
                          : d.level === "warning"
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
                            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                      }`}
                    >
                      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                      <span>{d.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold mb-1">
            <span>إجمالي الحركات</span>
            <Database size={15} className="text-teal-600" />
          </div>
          <div className="text-2xl font-black text-foreground">{metrics.total}</div>
        </div>

        <div className="bg-card border border-border p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold mb-1">
            <span>افتتاح الورديات</span>
            <Clock size={15} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">{metrics.opens}</div>
        </div>

        <div className="bg-card border border-border p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold mb-1">
            <span>إغلاق الورديات</span>
            <CheckCircle2 size={15} className="text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-600">{metrics.closes}</div>
        </div>

        <div className="bg-card border border-border p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold mb-1">
            <span>تعديل واستئناف وإصلاح</span>
            <SlidersHorizontal size={15} className="text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-600">
            {metrics.updates + metrics.deletes}
          </div>
        </div>
      </div>

      {/* ADVANCED FILTER PANEL */}
      <Card className="rounded-3xl border-border bg-card shadow-xs">
        <CardHeader className="pb-3 border-b border-border/70 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-teal-600" />
            <CardTitle className="text-sm font-black">أدوات الفلترة والبحث المتقدم</CardTitle>
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-xs h-7 gap-1 font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            >
              <X size={13} />
              إعادة تعيين الفلاتر
            </Button>
          )}
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {/* Row 1: Search & Type & Action */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Search Input */}
            <div className="md:col-span-5 relative">
              <Search size={14} className="absolute right-3 top-3 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadData()}
                placeholder="بحث برقم الوردية، الكاشير، التفاصيل، الملاحظات..."
                className="pr-9 h-9 text-xs rounded-xl"
              />
            </div>

            {/* Shift Type Filter */}
            <div className="md:col-span-3">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as any)}
                className="w-full h-9 text-xs rounded-xl border border-input bg-background px-3 font-bold"
              >
                <option value="ALL">جميع قطاعات العمل (تذاكر + مطعم)</option>
                <option value="park">تذاكر الحديقة (Park / Mall)</option>
                <option value="restaurant">المطعم (Restaurant POS)</option>
              </select>
            </div>

            {/* Action Type Filter */}
            <div className="md:col-span-4">
              <select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
                className="w-full h-9 text-xs rounded-xl border border-input bg-background px-3 font-bold"
              >
                <option value="ALL">جميع أنواع الإجراءات (All Actions)</option>
                <option value="OPEN">افتتاح الوردية (OPEN)</option>
                <option value="CLOSE">إغلاق الوردية (CLOSE)</option>
                <option value="RESUME">استئناف الوردية (RESUME)</option>
                <option value="ACTIVATE">تفعيل الجلسة كنشطة (ACTIVATE)</option>
                <option value="AUTO_CREATE">إنشاء تلقائي للجلسة (AUTO_CREATE)</option>
                <option value="UPDATE">تعديل بيانات (UPDATE)</option>
                <option value="DELETE">حذف الوردية (DELETE)</option>
                <option value="RECOVER_STATE">إصلاح حالة يدوياً (RECOVER_STATE)</option>
                <option value="FILTER_ANOMALY">شذوذ تصفية وتنظيف (FILTER_ANOMALY)</option>
              </select>
            </div>
          </div>

          {/* Row 2: Date Filters & User/Cashier Filter */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1 border-t border-border/50 items-center">
            {/* User / Cashier Filter */}
            <div className="md:col-span-4 flex items-center gap-2">
              <User size={15} className="text-muted-foreground shrink-0" />
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full h-9 text-xs rounded-xl border border-input bg-background px-3 font-bold"
              >
                <option value="ALL">جميع المستخدمين والكاشيرات (All Users)</option>
                {uniqueUsers.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Preset Buttons */}
            <div className="md:col-span-4 flex items-center gap-1 overflow-x-auto">
              <Calendar size={15} className="text-muted-foreground shrink-0 ml-1" />
              <button
                type="button"
                onClick={() => {
                  setDatePreset("all");
                  setStartDate("");
                  setEndDate("");
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                  datePreset === "all"
                    ? "bg-teal-600 text-white"
                    : "bg-muted hover:bg-muted/80 text-foreground"
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => setDatePreset("today")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                  datePreset === "today"
                    ? "bg-teal-600 text-white"
                    : "bg-muted hover:bg-muted/80 text-foreground"
                }`}
              >
                اليوم
              </button>
              <button
                type="button"
                onClick={() => setDatePreset("last7")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                  datePreset === "last7"
                    ? "bg-teal-600 text-white"
                    : "bg-muted hover:bg-muted/80 text-foreground"
                }`}
              >
                آخر 7 أيام
              </button>
              <button
                type="button"
                onClick={() => setDatePreset("thisMonth")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                  datePreset === "thisMonth"
                    ? "bg-teal-600 text-white"
                    : "bg-muted hover:bg-muted/80 text-foreground"
                }`}
              >
                هذا الشهر
              </button>
              <button
                type="button"
                onClick={() => setDatePreset("custom")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                  datePreset === "custom"
                    ? "bg-teal-600 text-white"
                    : "bg-muted hover:bg-muted/80 text-foreground"
                }`}
              >
                مخصص
              </button>
            </div>

            {/* Custom Range Inputs */}
            <div className="md:col-span-4 flex items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset("custom");
                }}
                placeholder="من تاريخ"
                className="h-9 text-xs rounded-xl"
              />
              <span className="text-xs text-muted-foreground">إلى</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset("custom");
                }}
                placeholder="إلى تاريخ"
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DATA PRESENTATION */}
      {logs.length === 0 ? (
        <div className="bg-card border border-dashed rounded-3xl p-12 text-center">
          <History size={40} className="mx-auto text-muted-foreground/50 mb-3" />
          <h3 className="font-black text-base text-foreground">
            لا توجد حركات ورديات مطابقة للفلتر المحدد
          </h3>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="mt-4 text-xs font-bold rounded-xl cursor-pointer"
            >
              عرض جميع السجلات
            </Button>
          )}
        </div>
      ) : viewMode === "table" ? (
        /* TABLE VIEW */
        <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/50 font-black text-muted-foreground">
                  <th className="p-3.5">التاريخ والوقت</th>
                  <th className="p-3.5">القطاع والوردية</th>
                  <th className="p-3.5">نوع الإجراء</th>
                  <th className="p-3.5">الكاشير / المنفذ</th>
                  <th className="p-3.5">تحول الحالة</th>
                  <th className="p-3.5">البيان والتفاصيل</th>
                  <th className="p-3.5 text-center">البيانات الفنية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const dateStr = log.client_timestamp || log.created_at || "";
                  const formattedDate = dateStr
                    ? new Date(dateStr).toLocaleString("ar-EG", {
                        dateStyle: "short",
                        timeStyle: "medium",
                      })
                    : "—";

                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-muted/20 transition">
                        {/* Timestamp */}
                        <td
                          className="p-3.5 whitespace-nowrap font-mono text-[11px] text-muted-foreground"
                          dir="ltr"
                        >
                          {formattedDate}
                        </td>

                        {/* Shift Number & Sector */}
                        <td className="p-3.5">
                          <div className="flex flex-col gap-1">
                            <span className="font-black text-foreground">{log.shift_number}</span>
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-bold ${
                                  log.shift_type === "park"
                                    ? "bg-teal-500/10 text-teal-600 border-teal-500/30"
                                    : "bg-indigo-500/10 text-indigo-600 border-indigo-500/30"
                                }`}
                              >
                                {log.shift_type === "park" ? "تذاكر الحديقة" : "المطعم"}
                              </Badge>
                              {log.auto_shift_number && (
                                <span className="text-[10px] font-mono text-muted-foreground">
                                  {log.auto_shift_number}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Action Badge */}
                        <td className="p-3.5 whitespace-nowrap">{getActionBadge(log.action)}</td>

                        {/* User / Cashier */}
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                              <User size={12} />
                            </div>
                            <div>
                              <div className="font-bold text-foreground">
                                {log.cashier_name || log.performed_by || "—"}
                              </div>
                              {log.performed_by && log.performed_by !== log.cashier_name && (
                                <div className="text-[10px] text-muted-foreground">
                                  بواسطة: {log.performed_by}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Status Change */}
                        <td className="p-3.5 whitespace-nowrap">
                          {log.status_before || log.status_after ? (
                            <div className="inline-flex items-center gap-1 font-mono text-[10px] bg-muted/60 px-2 py-1 rounded-lg border border-border/70">
                              <span
                                className={
                                  log.status_before === "open" ? "text-emerald-600 font-bold" : ""
                                }
                              >
                                {log.status_before || "—"}
                              </span>
                              <span>←</span>
                              <span
                                className={
                                  log.status_after === "open"
                                    ? "text-emerald-600 font-bold"
                                    : log.status_after === "closed"
                                      ? "text-blue-600 font-bold"
                                      : "text-rose-600 font-bold"
                                }
                              >
                                {log.status_after || "—"}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Details */}
                        <td
                          className="p-3.5 text-xs text-foreground max-w-xs truncate"
                          title={log.details || ""}
                        >
                          {log.details || "—"}
                        </td>

                        {/* Technical Metadata Button */}
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            className="h-7 text-xs font-bold text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                          >
                            {isExpanded ? "إغلاق" : "JSON"}
                            {isExpanded ? (
                              <ChevronUp size={13} className="mr-1" />
                            ) : (
                              <ChevronDown size={13} className="mr-1" />
                            )}
                          </Button>
                        </td>
                      </tr>

                      {/* Expandable JSON details row */}
                      {isExpanded && (
                        <tr className="bg-muted/30">
                          <td colSpan={7} className="p-4 border-t border-border">
                            <div
                              className="bg-background border border-border rounded-2xl p-4 font-mono text-xs text-left"
                              dir="ltr"
                            >
                              <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60 text-muted-foreground text-[11px]">
                                <span>Record ID: {log.id}</span>
                                <span>Shift ID: {log.shift_id}</span>
                                <span>
                                  Storage:{" "}
                                  {log.synced_to_supabase
                                    ? "Supabase Cloud Database"
                                    : "Local Verified Storage"}
                                </span>
                              </div>
                              <pre className="overflow-x-auto text-[11px] max-h-56 text-emerald-800 dark:text-emerald-400">
                                {JSON.stringify(log, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* TIMELINE VIEW */
        <div className="space-y-4">
          {logs.map((log) => {
            const isExpanded = expandedLogId === log.id;
            const dateStr = log.client_timestamp || log.created_at || "";
            const formattedDate = dateStr
              ? new Date(dateStr).toLocaleString("ar-EG", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "—";

            return (
              <div
                key={log.id}
                className="bg-card border border-border rounded-3xl p-5 shadow-xs transition hover:border-teal-500/40 relative"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
                  <div className="flex items-center gap-2.5">
                    {getActionBadge(log.action)}
                    <h3 className="font-black text-base text-foreground">{log.shift_number}</h3>
                    {log.auto_shift_number && (
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {log.auto_shift_number}
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold ${
                        log.shift_type === "park"
                          ? "bg-teal-500/10 text-teal-600 border-teal-500/30"
                          : "bg-indigo-500/10 text-indigo-600 border-indigo-500/30"
                      }`}
                    >
                      {log.shift_type === "park" ? "تذاكر الحديقة" : "المطعم"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="font-mono text-[11px]" dir="ltr">
                      {formattedDate}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                      className="h-7 text-xs font-bold rounded-xl"
                    >
                      {isExpanded ? "إخفاء التفاصيل" : "عرض JSON"}
                    </Button>
                  </div>
                </div>

                <div className="pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground font-semibold">
                      الكاشير / المستخدم:{" "}
                    </span>
                    <span className="font-bold text-foreground">
                      {log.cashier_name || log.performed_by || "—"}
                    </span>
                  </div>

                  <div>
                    <span className="text-muted-foreground font-semibold">الحالة: </span>
                    <span className="font-mono font-bold text-teal-600">
                      {log.status_before || "—"} ← {log.status_after || "—"}
                    </span>
                  </div>

                  <div>
                    <span className="text-muted-foreground font-semibold">البيان: </span>
                    <span className="font-medium text-foreground">{log.details || "—"}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div
                    className="mt-4 pt-3 border-t border-border bg-muted/40 p-4 rounded-2xl font-mono text-xs text-left"
                    dir="ltr"
                  >
                    <pre className="overflow-x-auto text-[11px] max-h-56 text-emerald-800 dark:text-emerald-400">
                      {JSON.stringify(log, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
