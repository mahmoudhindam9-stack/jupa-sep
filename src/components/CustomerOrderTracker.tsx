// @ts-nocheck
import { useEffect, useState } from "react";
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
} from "lucide-react";

const STATUS_STEPS = [
  {
    key: "pending_captain",
    match: ["pending_captain", "STATUS_PENDING_CAPTAIN", "pending"],
    ar: "بانتظار تأكيد الكابتن",
    en: "Waiting for Captain",
    descAr: "تم إرسال طلبك للكابتن وسيتم اعتماده فوراً",
    descEn: "Your order was sent to the captain for confirmation",
    icon: Clock3,
  },
  {
    key: "sent_to_cashier",
    match: ["sent_to_cashier"],
    ar: "تم اعتماد الطلب",
    en: "Order Confirmed",
    descAr: "اعتمد الكابتن طلبك وتم تحويله للتجهيز",
    descEn: "Captain confirmed your order and sent it for preparation",
    icon: ReceiptText,
  },
  {
    key: "preparing",
    match: ["preparing"],
    ar: "جاري التحضير بالمطبخ",
    en: "Preparing in Kitchen",
    descAr: "يقوم الشيف بتجهيز طلبك الآن",
    descEn: "Our kitchen is freshly preparing your order",
    icon: ChefHat,
  },
  {
    key: "ready",
    match: ["ready", "served", "completed"],
    ar: "الطلب جاهز للتقديم",
    en: "Order Ready",
    descAr: "طلبك جاهز ويتم تقديمه لطاولتك الآن، بالهناء والشفاء!",
    descEn: "Your order is ready and being served to your table!",
    icon: CheckCircle2,
  },
];

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

  useEffect(() => {
    if (!token) return;
    let alive = true;

    const load = async () => {
      const localFallback = getLocalTrackedOrder(token);
      if (localFallback && alive) {
        setOrder((prev: any) => prev || localFallback);
        setLoading(false);
      }

      try {
        const { data, error: dbError } = await supabase
          .from("orders")
          .select(
            "id,order_number,status,total,pricing_currency,payment_currency,payment_exchange_rate,payment_amount,notes,items,created_at",
          )
          .eq("customer_tracking_token", token)
          .maybeSingle();

        if (!alive) return;
        setLoading(false);
        if (data) {
          setOrder({ ...(localFallback || {}), ...data });
          setError("");
        } else if (!localFallback && dbError) {
          setError(dbError.message);
        }
      } catch (err: any) {
        if (!alive) return;
        setLoading(false);
        if (!localFallback) {
          setError(err?.message || "Network error");
        }
      }
    };

    load();
    const pollTimer = setInterval(load, 4000);

    const channel = supabase
      .channel(`customer-order-tracker-${token}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `customer_tracking_token=eq.${token}`,
        },
        (payload) => {
          if (alive && payload.new) {
            setOrder((prev: any) => ({ ...(prev || {}), ...payload.new }));
          }
        },
      )
      .on("broadcast", { event: "ORDER_STATUS_UPDATED" }, (payload) => {
        const data = payload?.payload;
        if (alive && data && data.customer_tracking_token === token) {
          setOrder((prev: any) => ({ ...(prev || {}), ...data }));
        }
      })
      .subscribe();

    return () => {
      alive = false;
      clearInterval(pollTimer);
      supabase.removeChannel(channel);
    };
  }, [token]);

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

  const isCancelled = order.status === "cancelled";
  const currentStepIndex = Math.max(
    0,
    STATUS_STEPS.findIndex((s) => s.match.includes(order.status)),
  );
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
        className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                isCancelled
                  ? "bg-rose-100 text-rose-700"
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

        <div className="mt-5 rounded-2xl bg-slate-50 border border-slate-200 p-4 text-center">
          <div className="text-xs font-bold text-slate-500">
            {isAr ? "الحالة الحالية" : "Current Status"}
          </div>
          <div
            className={`mt-1 text-lg font-black ${
              isCancelled ? "text-rose-600" : "text-slate-900"
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
          <p className="text-xs text-slate-500 mt-1">
            {isCancelled
              ? isAr
                ? "يرجى التواصل مع الكابتن للمساعدة"
                : "Please contact the captain for assistance"
              : isAr
                ? activeStep.descAr
                : activeStep.descEn}
          </p>
          <div className="mt-3 text-lg font-black text-emerald-600 tabular-nums">
            {Number(order.payment_amount ?? order.total ?? 0).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            {paymentCurrency}
          </div>
        </div>

        {!isCancelled && (
          <div className="mt-5 space-y-2.5">
            {STATUS_STEPS.map((step, idx) => {
              const StepIcon = step.icon;
              const isDone = idx <= currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              return (
                <div
                  key={step.key}
                  className={`flex items-center gap-3 p-3 rounded-2xl border transition-colors ${
                    isCurrent
                      ? "bg-emerald-50/80 border-emerald-300 text-emerald-950"
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
                          ? "bg-emerald-100 text-emerald-700"
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
                  {isDone && (
                    <CheckCircle2
                      size={16}
                      className={isCurrent ? "text-emerald-600" : "text-emerald-500"}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

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
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs bg-slate-50 px-3 py-1.5 rounded-xl"
                  >
                    <span className="font-bold text-slate-800">
                      {qty} × {isAr ? nameAr : nameEn}
                    </span>
                    <span className="font-bold text-slate-600 tabular-nums">
                      {Number((line?.item?.price ?? line?.price ?? 0) * qty).toFixed(2)}{" "}
                      {order.pricing_currency || "EGP"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Button
          className="w-full mt-5 h-11 rounded-2xl font-bold bg-slate-900 hover:bg-slate-800 text-white"
          onClick={onClose}
        >
          {isAr ? "إغلاق ومتابعة التصفح" : "Close & Continue Browsing"}
        </Button>
      </div>
    </div>
  );
}
