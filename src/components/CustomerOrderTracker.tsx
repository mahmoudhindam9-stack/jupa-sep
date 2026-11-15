// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Clock3,
  CheckCircle2,
  ChefHat,
  ReceiptText,
  XCircle,
  RefreshCw,
  MapPin,
  UtensilsCrossed,
  Timer,
  Star,
  Send,
  Truck,
} from "lucide-react";
import {
  formatDurationCompact,
  formatTimerClock,
  isDeliveredStatus,
} from "@/shared/utils/qualityControlMetrics";
import { formatLineCustomizationSummary } from "@/shared/utils/productOptions";
import { tableOrdersStore } from "@/shared/services/tableOrdersStore";

const LOCAL_FEEDBACK_STORAGE_KEY = "restocash_order_feedback_v1";

const STATUS_STEPS = [
  {
    key: "pending_captain",
    ar: "بانتظار تأكيد الكابتن",
    en: "Waiting for Captain",
    descAr: "تم إرسال طلبك للكابتن وسيتم اعتماده فوراً",
    descEn: "Your order was sent to the captain for confirmation",
    icon: Clock3,
  },
  {
    key: "sent_to_cashier",
    ar: "تم اعتماد الطلب",
    en: "Order Confirmed",
    descAr: "اعتمد الكابتن طلبك وتم تحويله للتجهيز",
    descEn: "Captain confirmed your order and sent it for preparation",
    icon: ReceiptText,
  },
  {
    key: "preparing",
    ar: "جاري التحضير بالمطبخ",
    en: "Preparing in Kitchen",
    descAr: "يقوم الشيف بتجهيز طلبك الآن",
    descEn: "Our kitchen is freshly preparing your order",
    icon: ChefHat,
  },
  {
    key: "ready",
    ar: "الطلب جاهز للتقديم",
    en: "Order Ready",
    descAr: "طلبك جاهز في المطبخ وفي طريقه لطاولتك الآن",
    descEn: "Your order is ready and on its way to your table",
    icon: UtensilsCrossed,
  },
  {
    key: "delivered",
    ar: "تم التسليم للعميل",
    en: "Delivered",
    descAr: "تم تسليم طلبك بنجاح، بالهناء والشفاء! شاركنا تقييمك",
    descEn: "Your order has been delivered! Please rate your experience",
    icon: Truck,
  },
] as const;

function getLocalTrackedOrder(token: string) {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem("customer_self_orders_history_v1");
    if (!raw) return null;
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return null;
    return list.find((o) => o && o.customer_tracking_token === token) || null;
  } catch {
    return null;
  }
}

function getLocalFeedbackForOrder(orderId?: string | null, token?: string | null) {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(LOCAL_FEEDBACK_STORAGE_KEY);
    if (!raw) return null;
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return null;
    return (
      list.find(
        (f: any) =>
          (orderId && f?.order_id === orderId) ||
          (token && f?.customer_tracking_token === token),
      ) || null
    );
  } catch {
    return null;
  }
}

function saveLocalFeedbackForOrder(feedbackEntry: any) {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return;
    const raw = localStorage.getItem(LOCAL_FEEDBACK_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const filtered = (Array.isArray(list) ? list : []).filter(
      (f: any) =>
        !(
          (feedbackEntry.order_id && f?.order_id === feedbackEntry.order_id) ||
          (feedbackEntry.customer_tracking_token &&
            f?.customer_tracking_token === feedbackEntry.customer_tracking_token)
        ),
    );
    localStorage.setItem(
      LOCAL_FEEDBACK_STORAGE_KEY,
      JSON.stringify([feedbackEntry, ...filtered].slice(0, 200)),
    );

    const histRaw = localStorage.getItem("customer_self_orders_history_v1");
    if (histRaw) {
      const hist = JSON.parse(histRaw);
      if (Array.isArray(hist)) {
        const updatedHist = hist.map((entry: any) =>
          entry?.id === feedbackEntry.order_id ||
          entry?.customer_tracking_token === feedbackEntry.customer_tracking_token
            ? { ...entry, has_feedback: true, feedback: feedbackEntry }
            : entry,
        );
        localStorage.setItem("customer_self_orders_history_v1", JSON.stringify(updatedHist));
      }
    }
    window.dispatchEvent(new Event("customer_self_orders_updated"));
  } catch {
    // ignore storage errors
  }
}

function resolveStageIndex(order: any): number {
  if (!order) return 0;
  const notesStr = String(order.notes || "");
  if (order.delivered_at || isDeliveredStatus(order.status)) {
    return 4;
  }
  if (order.ready_at || order.status === "ready") {
    return 3;
  }
  if (
    order.kitchen_started_at ||
    order.status === "preparing" ||
    order.status === "in_kitchen" ||
    notesStr.includes("[SENT_TO_KITCHEN]")
  ) {
    return 2;
  }
  if (
    order.captain_confirmed_at ||
    order.status === "sent_to_cashier" ||
    notesStr.includes("[SENT_TO_CASHIER]")
  ) {
    return 1;
  }
  return 0;
}

function calcElapsedSeconds(
  startIso?: string | null,
  endIso?: string | null,
  nowMs?: number,
): number | null {
  if (!startIso) return null;
  const start = new Date(startIso).getTime();
  if (!Number.isFinite(start)) return null;
  const end = endIso ? new Date(endIso).getTime() : (nowMs ?? Date.now());
  if (!Number.isFinite(end)) return null;
  return Math.max(0, Math.floor((end - start) / 1000));
}

export function CustomerOrderTracker({
  token,
  onClose,
  lang = "ar",
}: {
  token: string;
  onClose: () => void;
  lang?: "ar" | "en";
}) {
  const isAr = lang !== "en";
  const [order, setOrder] = useState<any>(() => getLocalTrackedOrder(token));
  const [loading, setLoading] = useState(!getLocalTrackedOrder(token));
  const [error, setError] = useState("");
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Post-delivery mandatory feedback state
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>("");
  const [fbName, setFbName] = useState<string>("");
  const [fbPhone, setFbPhone] = useState<string>("");
  const [submittingFb, setSubmittingFb] = useState<boolean>(false);
  const [fbError, setFbError] = useState<string>("");
  const [submittedFeedback, setSubmittedFeedback] = useState<any>(() =>
    getLocalFeedbackForOrder(getLocalTrackedOrder(token)?.id, token),
  );

  const mergeWithStoreAndLocal = useCallback(
    (incoming: any) => {
      const localFallback = getLocalTrackedOrder(token);
      const storeOrders = tableOrdersStore.getAllOrders();
      const targetId = incoming?.id || localFallback?.id;
      const storeMatch = targetId
        ? storeOrders.find((o) => o.id === targetId || o.kitchenOrderId === targetId)
        : null;

      const merged = {
        ...(localFallback || {}),
        ...(storeMatch
          ? {
              submitted_at: storeMatch.submitted_at || localFallback?.submitted_at,
              captain_confirmed_at:
                storeMatch.captain_confirmed_at || localFallback?.captain_confirmed_at,
              kitchen_started_at:
                storeMatch.kitchen_started_at || localFallback?.kitchen_started_at,
              ready_at: storeMatch.ready_at || localFallback?.ready_at,
              delivered_at: storeMatch.delivered_at || localFallback?.delivered_at,
              status: storeMatch.delivered_at
                ? "delivered"
                : storeMatch.ready_at || storeMatch.kitchenCompleted
                  ? "ready"
                  : storeMatch.sentToKitchen
                    ? "preparing"
                    : localFallback?.status || "pending",
            }
          : {}),
        ...(incoming || {}),
      };

      // Preserve non-null local/store timestamps if remote DB hasn't run migration columns yet
      merged.submitted_at =
        incoming?.submitted_at ||
        storeMatch?.submitted_at ||
        localFallback?.submitted_at ||
        merged.created_at;
      merged.captain_confirmed_at =
        incoming?.captain_confirmed_at ||
        storeMatch?.captain_confirmed_at ||
        localFallback?.captain_confirmed_at ||
        null;
      merged.kitchen_started_at =
        incoming?.kitchen_started_at ||
        storeMatch?.kitchen_started_at ||
        localFallback?.kitchen_started_at ||
        null;
      merged.ready_at =
        incoming?.ready_at || storeMatch?.ready_at || localFallback?.ready_at || null;
      merged.delivered_at =
        incoming?.delivered_at ||
        storeMatch?.delivered_at ||
        localFallback?.delivered_at ||
        null;

      return merged;
    },
    [token],
  );

  const loadOrder = useCallback(async () => {
    const localFallback = getLocalTrackedOrder(token);
    if (localFallback) {
      setOrder((prev: any) => mergeWithStoreAndLocal(prev || localFallback));
      setLoading(false);
    }

    try {
      const { data, error: dbError } = await supabase.rpc("get_customer_order_status", {
        p_tracking_token: token,
      });

      setLoading(false);
      if (data) {
        const nextOrder = mergeWithStoreAndLocal(data);
        setOrder(nextOrder);
        setError("");
        const existingFb =
          data.feedback ||
          (data.has_feedback
            ? getLocalFeedbackForOrder(data.id, token) || { rating: 5, submitted: true }
            : getLocalFeedbackForOrder(data.id, token));
        if (existingFb) setSubmittedFeedback(existingFb);
      } else if (!localFallback) {
        setError(dbError?.message || "Order not found");
      }
    } catch (err: any) {
      setLoading(false);
      if (!localFallback) {
        setError(err?.message || "Network error");
      }
    }
  }, [mergeWithStoreAndLocal, token]);

  useEffect(() => {
    if (!token) return;
    loadOrder();
    const pollTimer = setInterval(loadOrder, 3000);

    const onLocalUpdate = () => {
      const localFallback = getLocalTrackedOrder(token);
      if (localFallback) {
        setOrder((prev: any) => mergeWithStoreAndLocal({ ...(prev || {}), ...localFallback }));
      }
    };
    window.addEventListener("customer_self_orders_updated", onLocalUpdate);
    window.addEventListener("table-orders-updated", onLocalUpdate);

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      try {
        bc = new BroadcastChannel("restocash_self_orders_bc");
        bc.onmessage = (ev) => {
          if (ev.data?.type === "ORDER_DELIVERED") {
            const payload = ev.data?.payload || {};
            setOrder((prev: any) => {
              if (!prev) return prev;
              if (
                payload.orderId === prev.id ||
                payload.tableId === prev.table_id ||
                Number(payload.tableNumber) === Number(prev.table_number)
              ) {
                return {
                  ...prev,
                  status: "delivered",
                  delivered_at: payload.delivered_at || prev.delivered_at || new Date().toISOString(),
                };
              }
              return prev;
            });
            loadOrder();
          } else if (ev.data?.type === "ORDER_COMPLETED_BY_CASHIER") {
            loadOrder();
          }
        };
      } catch {
        // ignore BroadcastChannel error
      }
    }

    return () => {
      clearInterval(pollTimer);
      window.removeEventListener("customer_self_orders_updated", onLocalUpdate);
      window.removeEventListener("table-orders-updated", onLocalUpdate);
      if (bc) {
        try {
          bc.close();
        } catch {
          // ignore
        }
      }
    };
  }, [token, loadOrder, mergeWithStoreAndLocal]);

  useEffect(() => {
    if (order?.customer_name && !fbName) {
      setFbName(String(order.customer_name));
    }
    const existingFb = getLocalFeedbackForOrder(order?.id, token);
    if (existingFb && !submittedFeedback) {
      setSubmittedFeedback(existingFb);
    }
  }, [order?.id, order?.customer_name, token, fbName, submittedFeedback]);

  const isCancelled = order?.status === "cancelled";
  const isDelivered = Boolean(order && (order.delivered_at || isDeliveredStatus(order.status)));

  // Live 1-second ascending ticker: stops ONLY when order is actually delivered or cancelled (NEVER at 'ready')
  useEffect(() => {
    if (!order || isCancelled || isDelivered) return;
    setNowMs(Date.now());
    const ticker = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(ticker);
  }, [order, isCancelled, isDelivered]);

  const currentStepIndex = useMemo(() => resolveStageIndex(order), [order]);

  const stageTimings = useMemo(() => {
    if (!order) return [];
    const submittedAt = order.submitted_at || order.created_at;
    const captainAt = order.captain_confirmed_at || null;
    const kitchenAt = order.kitchen_started_at || null;
    const readyAt = order.ready_at || null;
    const deliveredAt =
      order.delivered_at || (isDelivered ? order.updated_at || new Date().toISOString() : null);

    // Infer earliest milestone fallback when later milestones already passed
    const effectiveCaptainAt = captainAt || kitchenAt || readyAt || deliveredAt;
    const effectiveKitchenAt = kitchenAt || readyAt || deliveredAt;
    const effectiveReadyAt = readyAt || deliveredAt;

    return [
      {
        start: submittedAt,
        end: currentStepIndex > 0 ? effectiveCaptainAt : null,
      },
      {
        start: captainAt || (currentStepIndex >= 1 ? submittedAt : null),
        end: currentStepIndex > 1 ? effectiveKitchenAt : null,
      },
      {
        start: kitchenAt || (currentStepIndex >= 2 ? effectiveCaptainAt || submittedAt : null),
        end: currentStepIndex > 2 ? effectiveReadyAt : null,
      },
      {
        start: readyAt || (currentStepIndex >= 3 ? effectiveKitchenAt || submittedAt : null),
        end: currentStepIndex > 3 ? deliveredAt : null,
      },
      {
        start: deliveredAt,
        end: deliveredAt,
      },
    ];
  }, [order, currentStepIndex, isDelivered]);

  const overallStartIso = order?.submitted_at || order?.created_at;
  const overallEndIso = isDelivered
    ? order?.delivered_at || order?.updated_at || null
    : isCancelled
      ? order?.updated_at || null
      : null;
  const overallSeconds = calcElapsedSeconds(overallStartIso, overallEndIso, nowMs);

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1 || rating > 5 || submittingFb || submittedFeedback) return;
    setSubmittingFb(true);
    setFbError("");

    const fbPayload = {
      order_id: order.id,
      customer_tracking_token: token,
      rating,
      comment: comment.trim() || null,
      customer_name: fbName.trim() || order.customer_name || null,
      customer_phone: fbPhone.trim() || null,
      created_at: new Date().toISOString(),
    };

    try {
      const { data, error: rpcErr } = await (supabase.rpc as any)(
        "submit_customer_order_feedback",
        {
          p_tracking_token: token,
          p_rating: rating,
          p_comment: fbPayload.comment,
          p_customer_name: fbPayload.customer_name,
          p_customer_phone: fbPayload.customer_phone,
        },
      );

      if (rpcErr || (data && data.success === false)) {
        // Attempt direct table insert fallback if RPC is not deployed yet
        await (supabase as any).from("order_feedback").insert({
          order_id: order.id,
          rating: fbPayload.rating,
          comment: fbPayload.comment,
          customer_name: fbPayload.customer_name,
          customer_phone: fbPayload.customer_phone,
        });
      }
    } catch {
      // Offline / unmigrated fallback handled seamlessly by localStorage below
    } finally {
      saveLocalFeedbackForOrder(fbPayload);
      setSubmittedFeedback(fbPayload);
      setOrder((prev: any) => (prev ? { ...prev, has_feedback: true, feedback: fbPayload } : prev));
      setSubmittingFb(false);
    }
  };

  if (loading) {
    return (
      <div
        dir={isAr ? "rtl" : "ltr"}
        className="fixed inset-0 z-[90] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <div className="bg-white rounded-3xl p-7 font-bold text-slate-800 flex items-center gap-3 shadow-xl">
          <RefreshCw className="animate-spin text-emerald-600" size={20} />
          <span>{isAr ? "جاري متابعة حالة الطلب..." : "Checking order status..."}</span>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div
        dir={isAr ? "rtl" : "ltr"}
        className="fixed inset-0 z-[90] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <div className="bg-white rounded-3xl p-7 max-w-sm w-full text-center shadow-xl">
          <div className="font-black text-lg text-slate-900">
            {isAr ? "تعذر العثور على الطلب" : "Order Not Found"}
          </div>
          <div className="text-sm text-slate-500 mt-2">
            {isAr
              ? "تحقق من حالة الاتصال أو أعد إرسال الطلب."
              : "Please check your connection or place a new order."}
          </div>
          <Button className="w-full mt-5 rounded-xl font-bold" onClick={onClose}>
            {isAr ? "إغلاق" : "Close"}
          </Button>
        </div>
      </div>
    );
  }

  const activeStep = STATUS_STEPS[currentStepIndex] || STATUS_STEPS[0];
  const Icon = isCancelled ? XCircle : activeStep.icon;
  const paymentCurrency = order.payment_currency || order.pricing_currency || "EGP";
  const shortOrderNo =
    order.order_number || String(order.id || "").replace(/^ord_/, "").slice(0, 8);

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      className="fixed inset-0 z-[90] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                isCancelled
                  ? "bg-rose-100 text-rose-700"
                  : isDelivered
                    ? "bg-teal-100 text-teal-700"
                    : "bg-emerald-100 text-emerald-700"
              }`}
            >
              <Icon size={24} />
            </div>
            <div>
              <div className="font-black text-lg text-slate-900">
                {isAr ? "متابعة حالة طلبي" : "Track My Order"}
              </div>
              <div className="text-xs text-slate-500 font-semibold tabular-nums">
                {isAr ? `رقم الطلب: #${shortOrderNo}` : `Order #${shortOrderNo}`}
              </div>
            </div>
          </div>
          {order.table_label && (
            <div className="flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl">
              <MapPin size={14} className="text-emerald-600" />
              <span>{order.table_label}</span>
            </div>
          )}
        </div>

        {/* Overall Order Timer + Status Card */}
        <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-200 p-4 text-center space-y-2">
          <div className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <Timer
                size={15}
                className={isDelivered ? "text-teal-600" : "text-emerald-600 animate-pulse"}
              />
              <span>
                {isDelivered
                  ? isAr
                    ? "الوقت الإجمالي للتوصيل:"
                    : "Total Delivery Time:"
                  : isAr
                    ? "الوقت الكلي منذ تقديم الطلب:"
                    : "Total Elapsed Time:"}
              </span>
            </div>
            <span
              className={`font-mono font-black text-base tabular-nums ${
                isDelivered ? "text-teal-700" : "text-emerald-700"
              }`}
            >
              {formatTimerClock(overallSeconds)}
            </span>
          </div>

          <div className="text-xs font-bold text-slate-500 pt-1">
            {isAr ? "الحالة الحالية" : "Current Status"}
          </div>
          <div
            className={`text-lg font-black ${
              isCancelled
                ? "text-rose-600"
                : isDelivered
                  ? "text-teal-700"
                  : "text-slate-900"
            }`}
          >
            {isCancelled
              ? isAr
                ? "تم إلغاء الطلب"
                : "Order Cancelled"
              : isAr
                ? activeStep.ar
                : activeStep.en}
          </div>
          <p className="text-xs text-slate-500">
            {isCancelled
              ? isAr
                ? "يرجى التواصل مع الكابتن للمساعدة"
                : "Please contact the captain for assistance"
              : isAr
                ? activeStep.descAr
                : activeStep.descEn}
          </p>
          <div className="pt-1 text-lg font-black text-emerald-600 tabular-nums">
            {Number(order.payment_amount ?? order.total ?? 0).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            {paymentCurrency}
          </div>
        </div>

        {/* 5-Stage Progress Timeline with Per-Stage Ascending Timers */}
        {!isCancelled && (
          <div className="mt-4 space-y-2">
            {STATUS_STEPS.map((step, idx) => {
              const StepIcon = step.icon;
              const isDone = idx < currentStepIndex || (idx === 4 && isDelivered);
              const isCurrent = idx === currentStepIndex && !(idx === 4 && isDelivered);
              const timing = stageTimings[idx];
              const stageSec = timing?.start
                ? idx === 4 && isDelivered
                  ? 0
                  : calcElapsedSeconds(
                      timing.start,
                      timing.end,
                      isCurrent ? nowMs : undefined,
                    )
                : null;

              return (
                <div
                  key={step.key}
                  className={`flex items-center gap-3 p-3 rounded-2xl border transition-colors ${
                    isCurrent
                      ? "bg-emerald-50/85 border-emerald-300 text-emerald-950"
                      : isDone
                        ? "bg-slate-50 border-slate-200 text-slate-800"
                        : "bg-white border-slate-100 text-slate-400"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isCurrent
                        ? "bg-emerald-600 text-white"
                        : isDone
                          ? "bg-teal-100 text-teal-700"
                          : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    <StepIcon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-black">{isAr ? step.ar : step.en}</div>
                    <div className="text-[11px] opacity-80 truncate">
                      {isAr ? step.descAr : step.descEn}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {idx < 4 && stageSec !== null && (isCurrent || isDone) && (
                      <span
                        className={`px-2 py-0.5 rounded-lg font-mono text-[11px] font-black tabular-nums ${
                          isCurrent
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-200/80 text-slate-700"
                        }`}
                      >
                        {isCurrent
                          ? formatTimerClock(stageSec)
                          : formatDurationCompact(stageSec, isAr)}
                      </span>
                    )}
                    {isDone && (
                      <CheckCircle2
                        size={16}
                        className={isCurrent ? "text-emerald-600" : "text-teal-600"}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Mandatory Post-Delivery Customer Feedback */}
        {isDelivered && !isCancelled && (
          <div className="mt-4 rounded-2xl border-2 border-amber-300 bg-amber-50/70 p-4 space-y-3">
            {submittedFeedback ? (
              <div className="space-y-2 text-center">
                <div className="inline-flex items-center gap-1.5 text-emerald-700 font-black text-sm">
                  <CheckCircle2 size={18} />
                  <span>
                    {isAr
                      ? "شكراً لك! تم استلام تقييمك بنجاح"
                      : "Thank you! Your feedback has been submitted"}
                  </span>
                </div>
                <div className="flex items-center justify-center gap-1 text-amber-500">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={18}
                      className={
                        star <= Number(submittedFeedback.rating || 5)
                          ? "fill-amber-400 text-amber-500"
                          : "text-slate-300"
                      }
                    />
                  ))}
                </div>
                {submittedFeedback.comment && (
                  <p className="text-xs text-slate-700 bg-white rounded-xl p-2 border border-amber-200">
                    “{submittedFeedback.comment}”
                  </p>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmitFeedback} className="space-y-3">
                <div className="text-center space-y-1">
                  <div className="text-sm font-black text-slate-900">
                    {isAr
                      ? "تقييمك يهمنا! قيّم جودة الطلب والخدمة *"
                      : "Rate Your Experience (Required) *"}
                  </div>
                  <p className="text-[11px] text-slate-600">
                    {isAr
                      ? "يرجى اختيار عدد النجوم لإرسال التقييم لقسم الجودة"
                      : "Select a star rating to submit your review"}
                  </p>
                </div>

                {/* 1-5 Star Selector */}
                <div className="flex items-center justify-center gap-2 py-1">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = star <= (hoverRating || rating);
                    return (
                      <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setRating(star)}
                        className="p-1 transition-transform hover:scale-110 cursor-pointer"
                        aria-label={`Rate ${star} stars`}
                      >
                        <Star
                          size={28}
                          className={
                            active
                              ? "fill-amber-400 text-amber-500 drop-shadow-xs"
                              : "text-slate-300"
                          }
                        />
                      </button>
                    );
                  })}
                </div>

                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  placeholder={
                    isAr
                      ? "أضف تعليقك أو ملاحظاتك حول جودة الطعام وسرعة التقديم..."
                      : "Share comments on food quality or service speed..."
                  }
                  className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={fbName}
                    onChange={(e) => setFbName(e.target.value)}
                    placeholder={isAr ? "الاسم (اختياري)" : "Name (Optional)"}
                    className="h-9 rounded-xl border border-amber-200 bg-white px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <input
                    type="tel"
                    value={fbPhone}
                    onChange={(e) => setFbPhone(e.target.value)}
                    placeholder={isAr ? "رقم الهاتف (اختياري)" : "Phone (Optional)"}
                    className="h-9 rounded-xl border border-amber-200 bg-white px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                {fbError && <div className="text-xs font-bold text-rose-600">{fbError}</div>}

                <Button
                  type="submit"
                  disabled={rating < 1 || submittingFb}
                  className="w-full h-10 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs gap-1.5 disabled:opacity-50"
                >
                  <Send size={14} />
                  <span>
                    {submittingFb
                      ? isAr
                        ? "جاري إرسال التقييم..."
                        : "Submitting..."
                      : isAr
                        ? "إرسال التقييم الآن"
                        : "Submit Rating"}
                  </span>
                </Button>
              </form>
            )}
          </div>
        )}

        {/* Ordered Items Summary */}
        {Array.isArray(order.items) && order.items.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <div className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1.5">
              <UtensilsCrossed size={13} />
              <span>{isAr ? "ملخص الأصناف المطلوبة" : "Ordered Items Summary"}</span>
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {order.items.map((line: any, i: number) => {
                const nameAr = line?.item?.name_ar || line?.name_ar || "صنف";
                const nameEn = line?.item?.name_en || line?.name_en || nameAr;
                const qty = Number(line?.quantity ?? 1);
                const customSummary = formatLineCustomizationSummary({
                  selectedOptions: line?.selectedOptions,
                  selectedAdditions: line?.selectedAdditions,
                  notes: line?.notes,
                });
                return (
                  <div
                    key={line?.lineKey || i}
                    className="flex items-start justify-between gap-2 text-xs bg-slate-50 px-3 py-1.5 rounded-xl"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800">
                        {qty} × {isAr ? nameAr : nameEn}
                      </div>
                      {customSummary && (
                        <div className="text-[10px] text-slate-500 truncate">{customSummary}</div>
                      )}
                    </div>
                    <span className="font-bold text-slate-600 tabular-nums shrink-0">
                      {Number((line?.price ?? line?.item?.price ?? 0) * qty).toFixed(2)}{" "}
                      {order.pricing_currency || "USD"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Button
          className="w-full mt-4 h-11 rounded-2xl font-bold bg-slate-900 hover:bg-slate-800 text-white"
          onClick={onClose}
        >
          {isAr ? "إغلاق ومتابعة التصفح" : "Close & Continue Browsing"}
        </Button>
      </div>
    </div>
  );
}
