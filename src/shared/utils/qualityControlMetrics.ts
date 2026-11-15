export interface QualityControlStageMetric {
  key: "captain_confirm" | "kitchen_prep" | "ready_wait" | "total_delivery";
  labelAr: string;
  labelEn: string;
  avgSeconds: number | null;
  sampleCount: number;
}

export interface QualityControlFeedbackRow {
  orderId: string;
  orderNumber: string;
  customerName: string | null;
  customerPhone: string | null;
  rating: number | null;
  comment: string | null;
  orderDate: string;
  deliveryDurationSeconds: number | null;
  status: string;
  totalAmount: number;
  currency: string;
  itemsSummary: string;
  captainConfirmSeconds: number | null;
  kitchenPrepSeconds: number | null;
  deliveryWaitSeconds: number | null;
}

export interface QualityControlComplaintSummary {
  categoryAr: string;
  count: number;
  examples: string[];
}

export interface QualityControlSummary {
  totalQrOrders: number;
  deliveredCount: number;
  activeCount: number;
  cancelledCount: number;
  deliveryRatePercent: number;
  feedbackCount: number;
  averageRating: number | null;
  csatPercent: number | null;
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
  stageMetrics: QualityControlStageMetric[];
  bottleneckStage: QualityControlStageMetric | null;
  feedbackRows: QualityControlFeedbackRow[];
  complaintCategories: QualityControlComplaintSummary[];
  recommendations: string[];
}

export function formatDurationCompact(seconds: number | null | undefined, isAr = true): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
    return "—";
  }
  const rounded = Math.round(seconds);
  const hrs = Math.floor(rounded / 3600);
  const mins = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;
  if (hrs > 0) {
    return isAr ? `${hrs}س ${mins}د ${secs}ث` : `${hrs}h ${mins}m ${secs}s`;
  }
  if (mins > 0) {
    return isAr ? `${mins}د ${secs}ث` : `${mins}m ${secs}s`;
  }
  return isAr ? `${secs}ث` : `${secs}s`;
}

export function formatTimerClock(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
    return "00:00";
  }
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
}

function diffSeconds(startIso?: string | null, endIso?: string | null): number | null {
  if (!startIso || !endIso) return null;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const diff = (end - start) / 1000;
  if (diff < 0 || diff > 86400) return null; // Ignore corrupted / multi-day anomalies > 24h
  return diff;
}

export function isQrOrderRecord(order: any): boolean {
  if (!order) return false;
  if (Boolean(order.is_qr_order)) return true;
  if (typeof order.customer_tracking_token === "string" && order.customer_tracking_token.trim()) {
    return true;
  }
  const notes = String(order.notes || "");
  return (
    notes.includes("[SELF_ORDER_PENDING_CAPTAIN]") ||
    notes.includes("[SELF_ORDER_ACTIVE]") ||
    notes.includes("الطلب الذاتي") ||
    notes.includes("باركود العميل")
  );
}

export function isDeliveredStatus(status?: string | null): boolean {
  return status === "served" || status === "delivered" || status === "completed";
}

function classifyComplaint(comment: string): string {
  if (/بارد|حرارة|سخن|دافئ|cold/i.test(comment)) return "حرارة وجودة التقديم";
  if (/بطي|تأخير|تأخر|انتظار|وقت|طويل|slow|late|delay/i.test(comment)) return "بطء وتأخر الخدمة";
  if (/ملح|طعم|مالح|حراق|نضج|مذاق|taste/i.test(comment)) return "المذاق وجودة الطهي";
  if (/ناقص|غلط|خطأ|طلب آخر|نسيان|missing|wrong/i.test(comment)) return "دقة تجهيز الطلب";
  if (/نظافة|تغليف|hygiene|clean/i.test(comment)) return "النظافة والتغليف";
  if (/معاملة|كابتن|أسلوب|موظف|service|staff/i.test(comment)) return "تعامل طاقم الصالة";
  return "ملاحظات عامة";
}

export function computeQualityControlSummary(
  orders: any[],
  feedbackRowsInput: any[],
): QualityControlSummary {
  const feedbackByOrderId = new Map<string, any>();
  for (const fb of feedbackRowsInput || []) {
    if (fb?.order_id) {
      feedbackByOrderId.set(String(fb.order_id), fb);
    }
  }

  // Filter out pure table assistance / bill request rows
  const validOrders = (orders || []).filter((o) => {
    const notes = String(o?.notes || "");
    if (notes.includes("[TABLE_ASSISTANCE_CALL]") || notes.includes("[BILL_REQUEST]")) return false;
    const items = Array.isArray(o?.items) ? o.items : [];
    if (items.length > 0 && items.every((i: any) => Boolean(i?.is_assistance_call))) return false;
    return true;
  });

  const qrOrders = validOrders.filter(isQrOrderRecord);
  const deliveredQr = qrOrders.filter((o) => isDeliveredStatus(o.status));
  const cancelledQr = qrOrders.filter((o) => o.status === "cancelled");
  const activeQr = qrOrders.filter(
    (o) => !isDeliveredStatus(o.status) && o.status !== "cancelled",
  );

  const deliveryRatePercent =
    qrOrders.length > 0 ? Math.round((deliveredQr.length / qrOrders.length) * 100) : 0;

  const captainConfirmDurations: number[] = [];
  const kitchenPrepDurations: number[] = [];
  const deliveryWaitDurations: number[] = [];
  const totalDeliveryDurations: number[] = [];

  const rows: QualityControlFeedbackRow[] = [];

  const ratingDist: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const ratingsList: number[] = [];
  const complaintMap = new Map<string, string[]>();

  for (const o of qrOrders) {
    const submittedAt = o.submitted_at || o.created_at;
    const captainAt = o.captain_confirmed_at || null;
    const kitchenAt = o.kitchen_started_at || null;
    const readyAt = o.ready_at || null;
    const deliveredAt =
      o.delivered_at || (isDeliveredStatus(o.status) ? o.updated_at : null);

    const capSec = diffSeconds(submittedAt, captainAt);
    const prepSec = diffSeconds(kitchenAt, readyAt);
    const waitSec = diffSeconds(readyAt, deliveredAt);
    const totalSec = diffSeconds(submittedAt, deliveredAt);

    if (capSec !== null) captainConfirmDurations.push(capSec);
    if (prepSec !== null) kitchenPrepDurations.push(prepSec);
    if (waitSec !== null) deliveryWaitDurations.push(waitSec);
    if (totalSec !== null) totalDeliveryDurations.push(totalSec);

    const fb = feedbackByOrderId.get(String(o.id)) || o.feedback || null;
    const ratingVal =
      fb && Number.isFinite(Number(fb.rating)) && Number(fb.rating) >= 1 && Number(fb.rating) <= 5
        ? Number(fb.rating)
        : null;

    if (ratingVal !== null) {
      ratingsList.push(ratingVal);
      ratingDist[ratingVal as 1 | 2 | 3 | 4 | 5] += 1;
    }

    const commentText = fb?.comment ? String(fb.comment).trim() : null;
    if (commentText && ((ratingVal !== null && ratingVal <= 3) || commentText.length > 0)) {
      if (ratingVal !== null && ratingVal <= 3) {
        const cat = classifyComplaint(commentText);
        const list = complaintMap.get(cat) || [];
        list.push(commentText);
        complaintMap.set(cat, list);
      }
    }

    const rawItems = Array.isArray(o.items) ? o.items : [];
    const itemsSummary = rawItems
      .map((it: any) => `${it?.quantity || 1}× ${it?.name_ar || it?.item?.name_ar || "صنف"}`)
      .join("، ");

    // Extract customer name from structured note tag if not on column
    let resolvedCustomerName = fb?.customer_name || o.customer_name || null;
    if (!resolvedCustomerName) {
      const m = String(o.notes || "").match(/\[العميل:\s*([^\]]+)\]/);
      if (m) resolvedCustomerName = m[1].trim();
    }

    rows.push({
      orderId: String(o.id),
      orderNumber: String(o.order_number || String(o.id).slice(-6)),
      customerName: resolvedCustomerName,
      customerPhone: fb?.customer_phone || null,
      rating: ratingVal,
      comment: commentText,
      orderDate: submittedAt || o.created_at,
      deliveryDurationSeconds: totalSec,
      status: o.status,
      totalAmount: Number(o.payment_amount ?? o.total ?? 0),
      currency: o.payment_currency || o.pricing_currency || "EGP",
      itemsSummary: itemsSummary || "—",
      captainConfirmSeconds: capSec,
      kitchenPrepSeconds: prepSec,
      deliveryWaitSeconds: waitSec,
    });
  }

  // Also include orphan feedbacks whose order wasn't in the current subset
  for (const fb of feedbackRowsInput || []) {
    if (!fb?.order_id) continue;
    if (rows.some((r) => r.orderId === String(fb.order_id))) continue;
    const ratingVal = Number(fb.rating);
    if (ratingVal >= 1 && ratingVal <= 5) {
      ratingsList.push(ratingVal);
      ratingDist[ratingVal as 1 | 2 | 3 | 4 | 5] += 1;
      if (ratingVal <= 3 && fb.comment) {
        const cat = classifyComplaint(String(fb.comment));
        const list = complaintMap.get(cat) || [];
        list.push(String(fb.comment));
        complaintMap.set(cat, list);
      }
    }
    rows.push({
      orderId: String(fb.order_id),
      orderNumber: String(fb.order_number || fb.order_id.slice(-6)),
      customerName: fb.customer_name || null,
      customerPhone: fb.customer_phone || null,
      rating: ratingVal >= 1 && ratingVal <= 5 ? ratingVal : null,
      comment: fb.comment || null,
      orderDate: fb.created_at,
      deliveryDurationSeconds: null,
      status: "served",
      totalAmount: 0,
      currency: "EGP",
      itemsSummary: "—",
      captainConfirmSeconds: null,
      kitchenPrepSeconds: null,
      deliveryWaitSeconds: null,
    });
  }

  const avg = (arr: number[]) =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  const stageMetrics: QualityControlStageMetric[] = [
    {
      key: "captain_confirm",
      labelAr: "اعتماد الكابتن (تقديم -> اعتماد)",
      labelEn: "Captain Confirmation",
      avgSeconds: avg(captainConfirmDurations),
      sampleCount: captainConfirmDurations.length,
    },
    {
      key: "kitchen_prep",
      labelAr: "التحضير بالمطبخ (بدء -> جاهز)",
      labelEn: "Kitchen Preparation",
      avgSeconds: avg(kitchenPrepDurations),
      sampleCount: kitchenPrepDurations.length,
    },
    {
      key: "ready_wait",
      labelAr: "انتظار التسليم (جاهز -> مُسلّم)",
      labelEn: "Ready-to-Delivery Wait",
      avgSeconds: avg(deliveryWaitDurations),
      sampleCount: deliveryWaitDurations.length,
    },
    {
      key: "total_delivery",
      labelAr: "إجمالي دورة الطلب (تقديم -> تسليم)",
      labelEn: "Total Order Cycle",
      avgSeconds: avg(totalDeliveryDurations),
      sampleCount: totalDeliveryDurations.length,
    },
  ];

  const comparableStages = stageMetrics.filter(
    (s) => s.key !== "total_delivery" && s.avgSeconds !== null,
  );
  const bottleneckStage =
    comparableStages.length > 0
      ? comparableStages.reduce((max, cur) =>
          (cur.avgSeconds ?? 0) > (max.avgSeconds ?? 0) ? cur : max,
        )
      : null;

  const averageRating =
    ratingsList.length > 0
      ? Number((ratingsList.reduce((a, b) => a + b, 0) / ratingsList.length).toFixed(2))
      : null;

  const positiveRatings = ratingDist[4] + ratingDist[5];
  const csatPercent =
    ratingsList.length > 0 ? Math.round((positiveRatings / ratingsList.length) * 100) : null;

  const complaintCategories: QualityControlComplaintSummary[] = Array.from(complaintMap.entries())
    .map(([categoryAr, examples]) => ({
      categoryAr,
      count: examples.length,
      examples: examples.slice(0, 3),
    }))
    .sort((a, b) => b.count - a.count);

  // Strictly data-driven recommendations (no fabricated advice)
  const recommendations: string[] = [];
  if (qrOrders.length === 0) {
    recommendations.push("لا توجد طلبات QR مسجلة بعد لتوليد توصيات تشغيلية.");
  } else {
    if (bottleneckStage && bottleneckStage.avgSeconds !== null) {
      const mins = Math.round(bottleneckStage.avgSeconds / 60);
      if (bottleneckStage.key === "captain_confirm" && bottleneckStage.avgSeconds > 120) {
        recommendations.push(
          `أطول مرحلة هي اعتماد الكابتن (متوسط ${formatDurationCompact(bottleneckStage.avgSeconds)}) — يُنصح بتفعيل تنبيه أسرع على شاشة الكابتن عند ورود طلب QR جديد.`,
        );
      } else if (bottleneckStage.key === "kitchen_prep" && mins >= 12) {
        recommendations.push(
          `مرحلة التحضير بالمطبخ تسجل متوسط ${formatDurationCompact(bottleneckStage.avgSeconds)} — راجع تجهيز المكونات المسبق (Mise en place) للأصناف الأكثر طلباً.`,
        );
      } else if (bottleneckStage.key === "ready_wait" && bottleneckStage.avgSeconds > 180) {
        recommendations.push(
          `تأخير تسليم الأطباق بعد الجاهزية (متوسط ${formatDurationCompact(bottleneckStage.avgSeconds)}) — خصص منادياً أو تنبيهاً فورياً للكابتن بمجرد ضغط المطبخ على "الطلب جاهز" لضمان حرارة الطعام.`,
        );
      }
    }

    if (complaintCategories.length > 0) {
      const topComplaint = complaintCategories[0];
      recommendations.push(
        `أكثر سبب متكرر لانخفاض التقييم (${topComplaint.count} شكوى) يتعلق بـ "${topComplaint.categoryAr}" — يُوصى بمراجعته مباشرة مع المشرف.`,
      );
    }

    if (deliveredQr.length > 0 && ratingsList.length === 0) {
      recommendations.push(
        `تم تسليم ${deliveredQr.length} طلب QR دون تقييمات مسجلة حتى الآن — تأكد من ظهور نافذة التقييم للعميل فور تأكيد التسليم.`,
      );
    }

    if (averageRating !== null && averageRating >= 4.5 && recommendations.length === 0) {
      recommendations.push(
        `مؤشر رضا العملاء مرتفع (${averageRating}/5) ودورة الخدمة مستقرة — استمر في مراقبة أوقات التسليم في أوقات الذروة.`,
      );
    }
  }

  return {
    totalQrOrders: qrOrders.length,
    deliveredCount: deliveredQr.length,
    activeCount: activeQr.length,
    cancelledCount: cancelledQr.length,
    deliveryRatePercent,
    feedbackCount: ratingsList.length,
    averageRating,
    csatPercent,
    ratingDistribution: ratingDist,
    stageMetrics,
    bottleneckStage,
    feedbackRows: rows.sort(
      (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime(),
    ),
    complaintCategories,
    recommendations,
  };
}
