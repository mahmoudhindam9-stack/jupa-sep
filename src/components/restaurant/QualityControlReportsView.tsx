import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { tableOrdersStore } from "@/shared/services/tableOrdersStore";
import {
  computeQualityControlSummary,
  formatDurationCompact,
  isDeliveredStatus,
} from "@/shared/utils/qualityControlMetrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  MessageSquareWarning,
  Printer,
  RefreshCw,
  Search,
  Sparkles,
  Star,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as XLSX from "xlsx";
import { toast } from "sonner";

function readLocalJsonArray(key: string): any[] {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function QualityControlReportsView({
  onBack,
  initialFrom = "",
  initialTo = "",
}: {
  onBack?: () => void;
  initialFrom?: string;
  initialTo?: string;
}) {
  const [fromDate, setFromDate] = useState(initialFrom);
  const [toDate, setToDate] = useState(initialTo);
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const qcQuery = useQuery({
    queryKey: ["quality-control-report-data"],
    queryFn: async () => {
      let dbOrders: any[] = [];
      let dbFeedback: any[] = [];

      try {
        const { data } = await (supabase as any)
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500);
        if (Array.isArray(data)) dbOrders = data;
      } catch {
        // Fallback to local records
      }

      try {
        const { data } = await (supabase as any)
          .from("order_feedback")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500);
        if (Array.isArray(data)) dbFeedback = data;
      } catch {
        // Table may not exist yet prior to migration push
      }

      const localHistory = readLocalJsonArray("customer_self_orders_history_v1");
      const localPosOrders = readLocalJsonArray("pos_local_orders");
      const localTableOrders = tableOrdersStore.getAllOrders();
      const localFeedback = readLocalJsonArray("restocash_order_feedback_v1");

      // Deduplicate orders by ID while preserving non-null local timestamps when remote DB lacks migration columns
      const ordersById = new Map<string, any>();
      const mergeOrder = (raw: any) => {
        if (!raw || !raw.id) return;
        const id = String(raw.id);
        const existing = ordersById.get(id) || {};
        ordersById.set(id, {
          ...existing,
          ...raw,
          submitted_at: raw.submitted_at || existing.submitted_at || raw.created_at || existing.created_at,
          captain_confirmed_at: raw.captain_confirmed_at || existing.captain_confirmed_at || null,
          kitchen_started_at: raw.kitchen_started_at || existing.kitchen_started_at || null,
          ready_at: raw.ready_at || existing.ready_at || null,
          delivered_at: raw.delivered_at || existing.delivered_at || null,
          is_qr_order:
            Boolean(raw.is_qr_order) ||
            Boolean(existing.is_qr_order) ||
            Boolean(raw.is_self_order) ||
            Boolean(existing.is_self_order),
        });
      };

      for (const o of localTableOrders) mergeOrder(o);
      for (const o of localPosOrders) mergeOrder(o);
      for (const o of localHistory) mergeOrder(o);
      for (const o of dbOrders) mergeOrder(o);

      // Deduplicate feedbacks by order_id (prefer Supabase row when available)
      const fbByOrderId = new Map<string, any>();
      for (const fb of [...localFeedback, ...dbFeedback]) {
        if (!fb?.order_id) continue;
        fbByOrderId.set(String(fb.order_id), fb);
      }

      return {
        orders: Array.from(ordersById.values()),
        feedbacks: Array.from(fbByOrderId.values()),
      };
    },
    refetchInterval: 10000,
  });

  const dateFilteredOrders = useMemo(() => {
    const orders = qcQuery.data?.orders || [];
    const fromMs = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const toMs = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : null;

    return orders.filter((o) => {
      const ts = new Date(o.submitted_at || o.created_at || Date.now()).getTime();
      if (fromMs !== null && Number.isFinite(fromMs) && ts < fromMs) return false;
      if (toMs !== null && Number.isFinite(toMs) && ts > toMs) return false;
      return true;
    });
  }, [qcQuery.data?.orders, fromDate, toDate]);

  const dateFilteredFeedbacks = useMemo(() => {
    const allowedOrderIds = new Set(dateFilteredOrders.map((o) => String(o.id)));
    const allOrders = qcQuery.data?.orders || [];
    const allOrderIds = new Set(allOrders.map((o) => String(o.id)));
    const fromMs = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const toMs = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : null;

    return (qcQuery.data?.feedbacks || []).filter((fb) => {
      if (fb?.order_id && allOrderIds.has(String(fb.order_id))) {
        return allowedOrderIds.has(String(fb.order_id));
      }
      const ts = new Date(fb.created_at || Date.now()).getTime();
      if (fromMs !== null && Number.isFinite(fromMs) && ts < fromMs) return false;
      if (toMs !== null && Number.isFinite(toMs) && ts > toMs) return false;
      return true;
    });
  }, [qcQuery.data, dateFilteredOrders, fromDate, toDate]);

  const summary = useMemo(
    () => computeQualityControlSummary(dateFilteredOrders, dateFilteredFeedbacks),
    [dateFilteredOrders, dateFilteredFeedbacks],
  );

  const displayedRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return summary.feedbackRows.filter((row) => {
      if (ratingFilter === "unrated" && row.rating !== null) return false;
      if (
        ratingFilter !== "all" &&
        ratingFilter !== "unrated" &&
        Number(row.rating) !== Number(ratingFilter)
      ) {
        return false;
      }
      if (!q) return true;
      return (
        String(row.orderNumber || "").toLowerCase().includes(q) ||
        String(row.customerName || "").toLowerCase().includes(q) ||
        String(row.customerPhone || "").toLowerCase().includes(q) ||
        String(row.comment || "").toLowerCase().includes(q) ||
        String(row.itemsSummary || "").toLowerCase().includes(q)
      );
    });
  }, [summary.feedbackRows, ratingFilter, searchQuery]);

  const ratingChartData = useMemo(
    () => [
      { label: "5 ★", count: summary.ratingDistribution[5], fill: "#10b981" },
      { label: "4 ★", count: summary.ratingDistribution[4], fill: "#22c55e" },
      { label: "3 ★", count: summary.ratingDistribution[3], fill: "#f59e0b" },
      { label: "2 ★", count: summary.ratingDistribution[2], fill: "#f97316" },
      { label: "1 ★", count: summary.ratingDistribution[1], fill: "#ef4444" },
    ],
    [summary.ratingDistribution],
  );

  const exportToExcel = () => {
    try {
      const rows = displayedRows.map((row) => ({
        "رقم الطلب": `#${row.orderNumber}`,
        "اسم العميل": row.customerName || "-",
        "رقم الهاتف": row.customerPhone || "-",
        "التقييم (من 5)": row.rating ?? "لم يُقيّم",
        "التعليق": row.comment || "-",
        "اعتماد الكابتن": formatDurationCompact(row.captainConfirmSeconds, true),
        "تحضير المطبخ": formatDurationCompact(row.kitchenPrepSeconds, true),
        "انتظار التسليم": formatDurationCompact(row.deliveryWaitSeconds, true),
        "مدة التوصيل الإجمالية": formatDurationCompact(row.deliveryDurationSeconds, true),
        "الحالة": isDeliveredStatus(row.status)
          ? "تم التسليم"
          : row.status === "cancelled"
            ? "ملغي"
            : row.status === "ready"
              ? "جاهز"
              : row.status === "preparing"
                ? "قيد التحضير"
                : "بانتظار الكابتن",
        "تاريخ الطلب": row.orderDate ? new Date(row.orderDate).toLocaleString("ar-EG") : "-",
        "الأصناف": row.itemsSummary,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "تقارير الرقابة والجودة");
      XLSX.writeFile(wb, `quality_control_report_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("تم تصدير تقرير الرقابة والجودة إلى Excel");
    } catch {
      toast.error("تعذر تصدير ملف Excel");
    }
  };

  return (
    <div className="space-y-5 text-right font-cairo" dir="rtl">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs print:hidden">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button
              variant="outline"
              size="sm"
              onClick={onBack}
              className="h-9 rounded-xl font-bold gap-1.5 cursor-pointer"
            >
              <ArrowRight size={15} />
              <span>رجوع</span>
            </Button>
          )}
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/12 text-amber-600 border border-amber-500/25">
            <Award size={20} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-foreground">
              تقارير الرقابة والجودة — Quality Control Reports
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => qcQuery.refetch()}
            className="h-9 rounded-xl font-bold gap-1.5 cursor-pointer"
          >
            <RefreshCw size={14} className={qcQuery.isFetching ? "animate-spin" : ""} />
            <span>تحديث</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="h-9 rounded-xl font-bold gap-1.5 cursor-pointer"
          >
            <Printer size={14} />
            <span>طباعة</span>
          </Button>
          <Button
            size="sm"
            onClick={exportToExcel}
            className="h-9 rounded-xl font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
          >
            <FileSpreadsheet size={14} />
            <span>تصدير Excel</span>
          </Button>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs print:hidden">
        <div className="space-y-1">
          <Label className="text-xs font-bold">من تاريخ</Label>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-9 w-40 rounded-xl text-xs font-bold"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-bold">إلى تاريخ</Label>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-9 w-40 rounded-xl text-xs font-bold"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-bold">فلتر التقييم</Label>
          <select
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value)}
            className="h-9 rounded-xl border border-input bg-background px-3 text-xs font-bold"
          >
            <option value="all">جميع التقييمات</option>
            <option value="5">5 نجوم</option>
            <option value="4">4 نجوم</option>
            <option value="3">3 نجوم</option>
            <option value="2">2 نجوم</option>
            <option value="1">1 نجمة</option>
            <option value="unrated">بدون تقييم</option>
          </select>
        </div>
        <div className="space-y-1 flex-1 min-w-[200px]">
          <Label className="text-xs font-bold">بحث</Label>
          <div className="relative">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="رقم الطلب، اسم العميل، الهاتف، التعليق..."
              className="h-9 pr-9 rounded-xl text-xs font-semibold"
            />
          </div>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="rounded-2xl border-border/80 shadow-xs">
          <CardContent className="p-4 space-y-1">
            <div className="text-xs font-bold text-muted-foreground">إجمالي طلبات QR</div>
            <div className="text-2xl font-black text-foreground tabular-nums">
              {summary.totalQrOrders}
            </div>
            <div className="text-[11px] font-semibold text-muted-foreground tabular-nums">
              نشطة: {summary.activeCount} | ملغية: {summary.cancelledCount}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 shadow-xs">
          <CardContent className="p-4 space-y-1">
            <div className="text-xs font-bold text-muted-foreground">الطلبات المُسلّمة</div>
            <div className="text-2xl font-black text-teal-600 tabular-nums">
              {summary.deliveredCount}
            </div>
            <div className="text-[11px] font-bold text-teal-700 tabular-nums">
              معدل الإنجاز: {summary.deliveryRatePercent}%
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 shadow-xs">
          <CardContent className="p-4 space-y-1">
            <div className="text-xs font-bold text-muted-foreground">متوسط التقييم العام</div>
            <div className="flex items-center gap-1.5 text-2xl font-black text-amber-500 tabular-nums">
              <span>{summary.averageRating !== null ? summary.averageRating : "—"}</span>
              <Star size={18} className="fill-amber-400 text-amber-500" />
            </div>
            <div className="text-[11px] font-semibold text-muted-foreground">من أصل 5 نجوم</div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 shadow-xs">
          <CardContent className="p-4 space-y-1">
            <div className="text-xs font-bold text-muted-foreground">رضا العملاء (CSAT)</div>
            <div className="text-2xl font-black text-emerald-600 tabular-nums">
              {summary.csatPercent !== null ? `${summary.csatPercent}%` : "—"}
            </div>
            <div className="text-[11px] font-semibold text-muted-foreground">تقييمات 4 و 5 نجوم</div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 shadow-xs">
          <CardContent className="p-4 space-y-1">
            <div className="text-xs font-bold text-muted-foreground">إجمالي التقييمات</div>
            <div className="text-2xl font-black text-indigo-600 tabular-nums">
              {summary.feedbackCount}
            </div>
            <div className="text-[11px] font-semibold text-muted-foreground">تقييم عملاء موثق</div>
          </CardContent>
        </Card>
      </div>

      {/* Stage-by-Stage Timing & Bottleneck Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {summary.stageMetrics.map((m) => {
          const isBottleneck = summary.bottleneckStage?.key === m.key;
          return (
            <Card
              key={m.key}
              className={`rounded-2xl shadow-xs ${
                isBottleneck ? "border-amber-400 bg-amber-50/40" : "border-border/80"
              }`}
            >
              <CardContent className="p-4 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Clock
                    size={15}
                    className={isBottleneck ? "text-amber-600" : "text-muted-foreground"}
                  />
                  {isBottleneck && (
                    <Badge className="bg-amber-500 text-white text-[10px] font-black">
                      أطول مرحلة
                    </Badge>
                  )}
                </div>
                <div className="text-xs font-bold text-muted-foreground">{m.labelAr}</div>
                <div className="text-xl font-black text-foreground tabular-nums">
                  {formatDurationCompact(m.avgSeconds, true)}
                </div>
                <div className="text-[11px] text-muted-foreground tabular-nums">
                  العينة: {m.sampleCount} طلب
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Rating Distribution & Actionable Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="rounded-2xl border-border/80 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black flex items-center gap-2">
              <Star size={16} className="text-amber-500 fill-amber-400" />
              توزيع تقييمات العملاء
            </CardTitle>
          </CardHeader>
          <CardContent className="h-56 pt-2">
            {summary.feedbackCount > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ratingChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <XAxis type="number" allowDecimals={false} fontSize={11} />
                  <YAxis type="category" dataKey="label" width={45} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                    {ratingChartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                لا توجد تقييمات مسجلة في الفترة المحددة بعد
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-600" />
              تحليل الشكاوى والتوصيات التشغيلية (مبنية على البيانات الفعلية)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            {summary.complaintCategories.length > 0 && (
              <div className="space-y-1.5">
                <div className="font-black text-rose-700 flex items-center gap-1.5">
                  <MessageSquareWarning size={14} />
                  تصنيف الملاحظات السلبية (3 نجوم فأقل):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {summary.complaintCategories.map((cat) => (
                    <span
                      key={cat.categoryAr}
                      className="inline-flex items-center gap-1 rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1 font-bold text-rose-800"
                    >
                      <span>{cat.categoryAr}</span>
                      <span className="tabular-nums font-black">({cat.count})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="font-black text-slate-800 flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-amber-600" />
                التوصيات المستخلصة:
              </div>
              <ul className="space-y-1.5">
                {summary.recommendations.map((rec, idx) => (
                  <li
                    key={idx}
                    className="rounded-xl bg-muted/60 border border-border/70 p-2.5 font-semibold text-foreground leading-relaxed"
                  >
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Full Feedback & Order Timing Table */}
      <Card className="rounded-2xl border-border/80 shadow-xs overflow-hidden">
        <CardHeader className="p-4 border-b border-border/60 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-black">
            سجل طلبات QR والتقييمات وتفصيل أزمنة المراحل
          </CardTitle>
          <Badge variant="outline" className="font-mono text-xs font-bold tabular-nums">
            {displayedRows.length} سجل
          </Badge>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold">
              <tr>
                <th className="p-3">رقم الطلب</th>
                <th className="p-3">العميل</th>
                <th className="p-3">الهاتف</th>
                <th className="p-3">التقييم</th>
                <th className="p-3">التعليق</th>
                <th className="p-3">مدة التوصيل</th>
                <th className="p-3">تفاصيل المراحل</th>
                <th className="p-3">التاريخ</th>
                <th className="p-3">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {displayedRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground font-bold">
                    لا توجد سجلات مطابقة للمعايير الحالية.
                  </td>
                </tr>
              ) : (
                displayedRows.map((row) => (
                  <tr key={row.orderId} className="hover:bg-muted/30 transition">
                    <td className="p-3 font-mono font-black text-foreground tabular-nums">
                      #{row.orderNumber}
                    </td>
                    <td className="p-3 font-bold text-foreground">{row.customerName || "—"}</td>
                    <td className="p-3 font-mono text-muted-foreground tabular-nums" dir="ltr">
                      {row.customerPhone || "—"}
                    </td>
                    <td className="p-3">
                      {row.rating !== null ? (
                        <span className="inline-flex items-center gap-1 font-black text-amber-600 tabular-nums">
                          <span>{row.rating}/5</span>
                          <Star size={13} className="fill-amber-400 text-amber-500" />
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3 max-w-[220px] truncate" title={row.comment || ""}>
                      {row.comment || "—"}
                    </td>
                    <td className="p-3 font-mono font-black text-teal-700 tabular-nums">
                      {formatDurationCompact(row.deliveryDurationSeconds, true)}
                    </td>
                    <td className="p-3 text-[11px] text-muted-foreground tabular-nums">
                      <div>اعتماد: {formatDurationCompact(row.captainConfirmSeconds, true)}</div>
                      <div>مطبخ: {formatDurationCompact(row.kitchenPrepSeconds, true)}</div>
                      <div>تسليم: {formatDurationCompact(row.deliveryWaitSeconds, true)}</div>
                    </td>
                    <td className="p-3 text-muted-foreground font-mono tabular-nums">
                      {row.orderDate ? new Date(row.orderDate).toLocaleString("ar-EG") : "—"}
                    </td>
                    <td className="p-3">
                      {isDeliveredStatus(row.status) ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-black">
                          <CheckCircle2 size={11} />
                          تم التسليم
                        </span>
                      ) : row.status === "cancelled" ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black">
                          ملغي
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">
                          قيد التنفيذ
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
