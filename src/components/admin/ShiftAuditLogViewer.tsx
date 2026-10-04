import React, { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import {
  shiftAuditService,
  ShiftAuditLogEntry,
  ShiftType,
} from "@/features/shifts/services/shiftAuditService";
import { erpStore } from "@/shared/services/erpStore";
import { toast } from "sonner";

export interface ShiftAuditLogViewerProps {
  initialShiftType?: ShiftType | "ALL";
  initialAction?: string;
  showHeaderTitle?: boolean;
  compact?: boolean;
}

export const ShiftAuditLogViewer: React.FC<ShiftAuditLogViewerProps> = ({
  initialShiftType = "ALL",
  initialAction = "ALL",
  showHeaderTitle = true,
  compact = false,
}) => {
  const [logs, setLogs] = useState<ShiftAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"supabase" | "local" | "hybrid">("local");
  const [viewMode, setViewMode] = useState<"table" | "timeline">("table");

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<ShiftType | "ALL">(initialShiftType);
  const [selectedAction, setSelectedAction] = useState<string>(initialAction);
  const [selectedUser, setSelectedUser] = useState<string>("ALL");
  const [datePreset, setDatePreset] = useState<"all" | "today" | "last7" | "thisMonth" | "custom">("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Load audit data from Supabase
  const loadData = async () => {
    setLoading(true);
    try {
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
      toast.error("فشل تحميل سجل التدقيق من Supabase: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedType, selectedAction, selectedUser, datePreset, startDate, endDate]);

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
        : ((erpStore as any).getState?.()?.employees || (erpStore as any).state?.employees || []);
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
      (l) => l.action === "UPDATE" || l.action === "RECOVER_STATE" || l.action === "RESUME" || l.action === "ACTIVATE",
    ).length;
    const deletes = logs.filter((l) => l.action === "DELETE").length;
    return { total, opens, closes, updates, deletes };
  }, [logs]);

  // Export handlers
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
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
        return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">افتتاح OPEN</Badge>;
      case "CLOSE":
        return <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-bold">إغلاق CLOSE</Badge>;
      case "RESUME":
        return <Badge className="bg-teal-600 hover:bg-teal-700 text-white font-bold">استئناف RESUME</Badge>;
      case "ACTIVATE":
        return <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">تفعيل ACTIVATE</Badge>;
      case "AUTO_CREATE":
        return <Badge className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold">إنشاء تلقائي AUTO</Badge>;
      case "UPDATE":
        return <Badge className="bg-amber-600 hover:bg-amber-700 text-white font-bold">تعديل UPDATE</Badge>;
      case "DELETE":
        return <Badge className="bg-rose-600 hover:bg-rose-700 text-white font-bold">حذف DELETE</Badge>;
      case "RECOVER_STATE":
        return <Badge className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold">إصلاح حالة RECOVER</Badge>;
      case "FILTER_ANOMALY":
        return <Badge className="bg-purple-600 hover:bg-purple-700 text-white font-bold">شذوذ تصفية ANOMALY</Badge>;
      default:
        return <Badge variant="outline" className="font-bold">{action}</Badge>;
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
              <Database size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-foreground">سجل تدقيق الورديات (Supabase Audit Log)</h2>
                <Badge
                  variant="outline"
                  className="bg-teal-500/10 text-teal-600 border-teal-500/30 text-xs font-bold"
                >
                  {source === "supabase" ? "Supabase Live" : source === "hybrid" ? "Supabase + Local" : "مخزن محلي"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                تتبع تفصيلي لجميع عمليات الورديات وحالات فتح وإغلاق وتعديل الورديات مع فلترة متقدمة حسب التاريخ والمستخدم ونوع الإجراء
              </p>
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
              تحديث
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
                  viewMode === "table" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                }`}
                title="عرض جدولي"
              >
                <TableIcon size={15} />
              </button>
              <button
                onClick={() => setViewMode("timeline")}
                className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === "timeline" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                }`}
                title="عرض المخطط الزمني"
              >
                <ListTree size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold mb-1">
            <span>إجمالي الحركات</span>
            <Database size={15} className="text-teal-600" />
          </div>
          <div className="text-2xl font-black text-foreground">{metrics.total}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">عملية مسجلة في السجل</p>
        </div>

        <div className="bg-card border border-border p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold mb-1">
            <span>افتتاح الورديات</span>
            <Clock size={15} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">{metrics.opens}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">جلسة تم فتحها</p>
        </div>

        <div className="bg-card border border-border p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold mb-1">
            <span>إغلاق الورديات</span>
            <CheckCircle2 size={15} className="text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-600">{metrics.closes}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">جلسة تم إغلاقها وترحيلها</p>
        </div>

        <div className="bg-card border border-border p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold mb-1">
            <span>تعديل واستئناف وإصلاح</span>
            <SlidersHorizontal size={15} className="text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-600">{metrics.updates + metrics.deletes}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">{metrics.deletes} حذف | {metrics.updates} تعديل وإصلاح</p>
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
                  datePreset === "all" ? "bg-teal-600 text-white" : "bg-muted hover:bg-muted/80 text-foreground"
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => setDatePreset("today")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                  datePreset === "today" ? "bg-teal-600 text-white" : "bg-muted hover:bg-muted/80 text-foreground"
                }`}
              >
                اليوم
              </button>
              <button
                type="button"
                onClick={() => setDatePreset("last7")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                  datePreset === "last7" ? "bg-teal-600 text-white" : "bg-muted hover:bg-muted/80 text-foreground"
                }`}
              >
                آخر 7 أيام
              </button>
              <button
                type="button"
                onClick={() => setDatePreset("thisMonth")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                  datePreset === "thisMonth" ? "bg-teal-600 text-white" : "bg-muted hover:bg-muted/80 text-foreground"
                }`}
              >
                هذا الشهر
              </button>
              <button
                type="button"
                onClick={() => setDatePreset("custom")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                  datePreset === "custom" ? "bg-teal-600 text-white" : "bg-muted hover:bg-muted/80 text-foreground"
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
          <h3 className="font-black text-base text-foreground">لا توجد حركات ورديات مطابقة للفلتر المحدد</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            تأكد من اختيار نطاق تاريخ صحيح أو إلغاء فلاتر المستخدمين لعرض المزيد من البيانات المسجلة
          </p>
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
                        <td className="p-3.5 whitespace-nowrap font-mono text-[11px] text-muted-foreground" dir="ltr">
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
                              <div className="font-bold text-foreground">{log.cashier_name || log.performed_by || "—"}</div>
                              {log.performed_by && log.performed_by !== log.cashier_name && (
                                <div className="text-[10px] text-muted-foreground">بواسطة: {log.performed_by}</div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Status Change */}
                        <td className="p-3.5 whitespace-nowrap">
                          {(log.status_before || log.status_after) ? (
                            <div className="inline-flex items-center gap-1 font-mono text-[10px] bg-muted/60 px-2 py-1 rounded-lg border border-border/70">
                              <span className={log.status_before === "open" ? "text-emerald-600 font-bold" : ""}>
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
                        <td className="p-3.5 text-xs text-foreground max-w-xs truncate" title={log.details || ""}>
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
                            {isExpanded ? <ChevronUp size={13} className="mr-1" /> : <ChevronDown size={13} className="mr-1" />}
                          </Button>
                        </td>
                      </tr>

                      {/* Expandable JSON details row */}
                      {isExpanded && (
                        <tr className="bg-muted/30">
                          <td colSpan={7} className="p-4 border-t border-border">
                            <div className="bg-background border border-border rounded-2xl p-4 font-mono text-xs text-left" dir="ltr">
                              <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60 text-muted-foreground text-[11px]">
                                <span>Record ID: {log.id}</span>
                                <span>Shift ID: {log.shift_id}</span>
                                <span>
                                  Storage: {log.synced_to_supabase ? "Supabase Cloud Database" : "Local Verified Storage"}
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
                    <span className="text-muted-foreground font-semibold">الكاشير / المستخدم: </span>
                    <span className="font-bold text-foreground">{log.cashier_name || log.performed_by || "—"}</span>
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
                  <div className="mt-4 pt-3 border-t border-border bg-muted/40 p-4 rounded-2xl font-mono text-xs text-left" dir="ltr">
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
