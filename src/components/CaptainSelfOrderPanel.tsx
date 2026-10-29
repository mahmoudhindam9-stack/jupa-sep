// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { tableOrdersStore } from "@/shared/services/tableOrdersStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  BellRing,
  CheckCircle2,
  ChefHat,
  Coins,
  MapPin,
  Send,
  Volume2,
  VolumeX,
  XCircle,
  UtensilsCrossed,
  Clock,
  Receipt,
  RefreshCw,
} from "lucide-react";

export interface TableAssistanceAlert {
  id: string;
  table_id: string;
  table_number: number | string;
  table_name?: string;
  zone?: string;
  request_type: "call_captain" | "request_bill";
  customer_name?: string;
  notes?: string;
  created_at: string;
}

const ASSISTANCE_STORAGE_KEY = "restocash_captain_assistance_alerts_v1";

function loadAssistanceAlerts(): TableAssistanceAlert[] {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(ASSISTANCE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAssistanceAlerts(alerts: TableAssistanceAlert[]) {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return;
    localStorage.setItem(ASSISTANCE_STORAGE_KEY, JSON.stringify(alerts.slice(0, 30)));
  } catch {
    // ignore storage errors
  }
}

export function playCaptainNotificationSound(isUrgent = false) {
  try {
    if (typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const frequencies = isUrgent ? [587.33, 880, 1174.66] : [523.25, 659.25, 783.99];
    frequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);

      gain.gain.setValueAtTime(0.001, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.22, now + idx * 0.14 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.3);
    });
  } catch {
    // Browser autoplay policy may block until user interacts with page
  }
}

export function parseSelfOrderMetadata(order: any) {
  const notesStr = String(order?.notes || "");
  const firstItemMeta = Array.isArray(order?.items) ? order.items[0]?.meta : null;

  const tableMatch = notesStr.match(/\[طاولة:\s*([^\]]+)\]/);
  const zoneMatch = notesStr.match(/\[المكان:\s*([^\]]+)\]/);
  const customerMatch = notesStr.match(/\[العميل:\s*([^\]]+)\]/);

  const rawTableId = String(order?.table_id || firstItemMeta?.table_id || "");
  const strippedNum = rawTableId.replace(/^tbl-/, "").replace(/^tbl_local_/, "");
  const tableNumber =
    order?.table_number ||
    firstItemMeta?.table_number ||
    (tableMatch ? tableMatch[1].trim() : "") ||
    (/^\d+$/.test(strippedNum) ? strippedNum : "");

  const tableName =
    order?.table_name ||
    firstItemMeta?.table_name ||
    (tableNumber && tableNumber !== "999" ? `طاولة ${tableNumber}` : "طلب عام / سفري");

  const zone =
    order?.zone ||
    firstItemMeta?.zone ||
    (zoneMatch ? zoneMatch[1].trim() : "");

  const customerName =
    order?.customer_name ||
    firstItemMeta?.customer_name ||
    (customerMatch ? customerMatch[1].trim() : "");

  const cleanNotes = notesStr
    .replace(/\[SELF_ORDER_PENDING_CAPTAIN\]/g, "")
    .replace(/\[SELF_ORDER_ACTIVE\]/g, "")
    .replace(/\[SENT_TO_KITCHEN\]/g, "")
    .replace(/\[SENT_TO_CASHIER\]/g, "")
    .replace(/\[CASHIER_PAID\]/g, "")
    .replace(/\[TABLE_ASSISTANCE_CALL\]/g, "")
    .replace(/\[طاولة:[^\]]+\]/g, "")
    .replace(/\[المكان:[^\]]+\]/g, "")
    .replace(/\[العميل:[^\]]+\]/g, "")
    .trim();

  const locationDisplay = [tableName, zone].filter(Boolean).join(" — ");

  const sentToKitchen =
    Boolean(order?.sentToKitchen) ||
    notesStr.includes("[SENT_TO_KITCHEN]") ||
    order?.status === "preparing";

  const sentToCashier =
    Boolean(order?.sentToCashier) ||
    notesStr.includes("[SENT_TO_CASHIER]") ||
    order?.status === "sent_to_cashier";

  return {
    tableId:
      rawTableId ||
      (tableNumber && tableNumber !== "سفري" ? `tbl-${tableNumber}` : "tbl-999"),
    tableNumber: Number(tableNumber) || 999,
    tableName,
    zone,
    customerName,
    cleanNotes: cleanNotes || "طلب ذاتي عبر باركود العميل",
    locationDisplay: locationDisplay || "طاولة عامة",
    sentToKitchen,
    sentToCashier,
  };
}

export function CaptainSelfOrderPanel({
  onOpenTableOrder,
}: {
  onOpenTableOrder?: (tableId: string, tableNumber: number, tableName: string) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [currency, setCurrency] = useState<Record<string, string>>({});
  const [rate, setRate] = useState<Record<string, any>>({});
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [assistanceAlerts, setAssistanceAlerts] = useState<TableAssistanceAlert[]>(() =>
    loadAssistanceAlerts(),
  );
  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const seenAlertIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef<boolean>(false);

  const ordersQuery = useQuery({
    queryKey: ["captain-self-orders"],
    queryFn: async () => {
      let dbOrders: any[] = [];
      let dbAlerts: TableAssistanceAlert[] = [];

      try {
        const { data, error } = await supabase
          .from("orders")
          .select(
            "id,order_number,table_id,total,subtotal,tax,status,items,notes,order_type,created_at,pricing_currency,payment_currency,payment_exchange_rate,customer_tracking_token",
          )
          .in("status", ["pending", "preparing", "ready", "pending_captain", "STATUS_PENDING_CAPTAIN"])
          .order("created_at", { ascending: false })
          .limit(50);

        if (!error && Array.isArray(data)) {
          for (const row of data) {
            const notesStr = String(row.notes || "");
            if (
              notesStr.includes("[CASHIER_PAID]") ||
              row.status === "served" ||
              row.status === "cancelled"
            ) {
              continue;
            }
            const firstItem = Array.isArray(row.items) ? row.items[0] : null;
            if (notesStr.includes("[TABLE_ASSISTANCE_CALL]") || firstItem?.is_assistance_call) {
              const meta = parseSelfOrderMetadata(row);
              dbAlerts.push({
                id: row.id,
                table_id: meta.tableId,
                table_number: meta.tableNumber === 999 ? "عام" : meta.tableNumber,
                table_name: meta.tableName,
                zone: meta.zone,
                request_type:
                  firstItem?.request_type ||
                  (notesStr.includes("الفاتورة") ? "request_bill" : "call_captain"),
                customer_name: meta.customerName,
                notes: meta.cleanNotes,
                created_at: row.created_at,
              });
            } else if (
              row.status === "pending_captain" ||
              row.status === "STATUS_PENDING_CAPTAIN" ||
              Boolean(row.customer_tracking_token) ||
              notesStr.includes("[SELF_ORDER_PENDING_CAPTAIN]") ||
              notesStr.includes("[SELF_ORDER_ACTIVE]")
            ) {
              dbOrders.push(row);
            }
          }
        }
      } catch (err) {
        console.warn("Could not query captain self-orders from Supabase:", err);
      }

      if (dbAlerts.length > 0) {
        setAssistanceAlerts((prev) => {
          const byId = new Map<string, TableAssistanceAlert>();
          for (const a of [...dbAlerts, ...prev]) {
            byId.set(a.id, a);
          }
          const merged = Array.from(byId.values());
          saveAssistanceAlerts(merged);
          return merged;
        });
      }

      // Merge any local self-orders that haven't been completed/paid at Cashier yet
      const allLocalOrders = tableOrdersStore.getAllOrders();
      const localById = new Map(allLocalOrders.map((lo) => [lo.id, lo]));
      const localSelfOrders = allLocalOrders.filter(
        (o) => o.is_self_order && o.status !== "completed" && o.status !== "cancelled",
      );

      const byId = new Map<string, any>();
      for (const ord of dbOrders) {
        const localMatch = localById.get(ord.id);
        byId.set(ord.id, {
          ...ord,
          sentToKitchen:
            Boolean(localMatch?.sentToKitchen) ||
            String(ord.notes || "").includes("[SENT_TO_KITCHEN]") ||
            ord.status === "preparing",
          sentToCashier:
            Boolean(localMatch?.sentToCashier) ||
            localMatch?.status === "sent_to_cashier" ||
            localMatch?.status === "in_checkout" ||
            String(ord.notes || "").includes("[SENT_TO_CASHIER]"),
        });
      }
      for (const localOrd of localSelfOrders) {
        if (!byId.has(localOrd.id)) {
          byId.set(localOrd.id, {
            ...localOrd,
            sentToKitchen: Boolean(localOrd.sentToKitchen),
            sentToCashier:
              Boolean(localOrd.sentToCashier) ||
              localOrd.status === "sent_to_cashier" ||
              localOrd.status === "in_checkout",
            pricing_currency: "EGP",
            payment_currency: "EGP",
            payment_exchange_rate: 1,
          });
        }
      }

      return Array.from(byId.values()).sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
      );
    },
    refetchInterval: 2500,
  });

  const orders = ordersQuery.data || [];

  // Notify Captain on newly arrived QR orders (only once per order ID, and only if not already processed)
  useEffect(() => {
    if (!ordersQuery.isSuccess) return;

    if (!initialLoadDoneRef.current) {
      orders.forEach((o) => seenOrderIdsRef.current.add(o.id));
      assistanceAlerts.forEach((a) => seenAlertIdsRef.current.add(a.id));
      initialLoadDoneRef.current = true;
      return;
    }

    const existingLocalOrders = tableOrdersStore.getAllOrders();

    for (const ord of orders) {
      if (!seenOrderIdsRef.current.has(ord.id)) {
        seenOrderIdsRef.current.add(ord.id);
        const meta = parseSelfOrderMetadata(ord);
        const alreadyInLocal = existingLocalOrders.find((lo) => lo.id === ord.id);

        if (!alreadyInLocal) {
          tableOrdersStore.saveOrder({
            id: ord.id,
            kitchenOrderId: ord.id,
            table_id: meta.tableId,
            table_number: meta.tableNumber,
            table_name: meta.locationDisplay,
            items: (ord.items || []).map((line: any, idx: number) => ({
              ...line,
              item: line?.item || {
                id: line?.menu_item_id || line?.id || `item-${idx}`,
                name_ar: line?.name_ar || line?.name || "صنف",
                price: Number(line?.price ?? 0),
                category_id: line?.category_id || "all",
                image_url: line?.image_url || null,
                requires_oven: Boolean(line?.requires_oven),
              },
              quantity: Number(line?.quantity ?? 1),
              notes: line?.notes || line?.note || "",
              selectedAdditions: line?.selectedAdditions || [],
            })),
            order_type: ord.order_type || "dine_in",
            notes: ord.notes || meta.cleanNotes,
            selectedAdditions: [],
            subtotal: Number(ord.subtotal ?? ord.total ?? 0),
            tax: Number(ord.tax ?? 0),
            total: Number(ord.total ?? 0),
            status: meta.sentToCashier ? "sent_to_cashier" : "draft",
            sentToKitchen: meta.sentToKitchen,
            sentToCashier: meta.sentToCashier,
            is_self_order: true,
          });
        }

        if (!meta.sentToKitchen && !meta.sentToCashier) {
          if (soundEnabled) {
            playCaptainNotificationSound(false);
          }

          toast({
            title: `🔔 طلب عميل جديد — ${meta.locationDisplay}`,
            description: `إجمالي الطلب: ${Number(ord.total || 0).toLocaleString()} ${ord.pricing_currency || "EGP"} (${Array.isArray(ord.items) ? ord.items.length : 0} أصناف)`,
          });
        }
      }
    }

    for (const alertItem of assistanceAlerts) {
      if (!seenAlertIdsRef.current.has(alertItem.id)) {
        seenAlertIdsRef.current.add(alertItem.id);
        if (soundEnabled) {
          playCaptainNotificationSound(true);
        }
        const loc = [
          alertItem.table_name || `طاولة ${alertItem.table_number}`,
          alertItem.zone,
        ]
          .filter(Boolean)
          .join(" — ");
        toast({
          title:
            alertItem.request_type === "request_bill"
              ? `🧾 طلب الفاتورة — ${loc}`
              : `🙋‍♂️ استدعاء الكابتن — ${loc}`,
          description: alertItem.notes || "العميل يطلب المساعدة على الطاولة الآن.",
        });
      }
    }
  }, [orders, assistanceAlerts, ordersQuery.isSuccess, soundEnabled, toast]);

  useEffect(() => {
    const ch = supabase
      .channel("captain-self-orders-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        queryClient.invalidateQueries({ queryKey: ["captain-self-orders"] });
      })
      .subscribe();

    const broadcastCh = supabase
      .channel("orders_channel")
      .on("broadcast", { event: "NEW_ORDER" }, () => {
        queryClient.invalidateQueries({ queryKey: ["captain-self-orders"] });
      })
      .on("broadcast", { event: "TABLE_ASSISTANCE_REQUEST" }, (payload) => {
        const alertData = payload?.payload as TableAssistanceAlert;
        if (!alertData) return;
        setAssistanceAlerts((prev) => {
          if (prev.some((a) => a.id === alertData.id)) return prev;
          const next = [alertData, ...prev];
          saveAssistanceAlerts(next);
          return next;
        });
      })
      .subscribe();

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      bc = new BroadcastChannel("restocash_self_orders_bc");
      bc.onmessage = (ev) => {
        const msg = ev.data;
        if (
          msg?.type === "NEW_ORDER" ||
          msg?.type === "ORDER_COMPLETED_BY_CASHIER" ||
          msg?.type === "ORDER_SENT_TO_CASHIER"
        ) {
          queryClient.invalidateQueries({ queryKey: ["captain-self-orders"] });
        } else if (msg?.type === "TABLE_ASSISTANCE_REQUEST" && msg.payload) {
          setAssistanceAlerts((prev) => {
            if (prev.some((a) => a.id === msg.payload.id)) return prev;
            const next = [msg.payload, ...prev];
            saveAssistanceAlerts(next);
            return next;
          });
        }
      };
    }

    const handleStorage = () => {
      setAssistanceAlerts(loadAssistanceAlerts());
      queryClient.invalidateQueries({ queryKey: ["captain-self-orders"] });
    };

    const unsubStore = tableOrdersStore.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ["captain-self-orders"] });
    });

    if (typeof window !== "undefined") {
      window.addEventListener("storage", handleStorage);
      window.addEventListener("captain-assistance-updated", handleStorage);
    }

    return () => {
      supabase.removeChannel(ch);
      supabase.removeChannel(broadcastCh);
      bc?.close();
      unsubStore();
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener("captain-assistance-updated", handleStorage);
      }
    };
  }, [queryClient]);

  const dismissAssistanceAlert = async (id: string) => {
    setAssistanceAlerts((prev) => {
      const next = prev.filter((a) => a.id !== id);
      saveAssistanceAlerts(next);
      return next;
    });
    try {
      await supabase.from("orders").delete().eq("id", id);
    } catch {
      // ignore if local-only alert
    }
    queryClient.invalidateQueries({ queryKey: ["captain-self-orders"] });
  };

  const buildUpdatedSelfOrderNotes = (
    order: any,
    flags: { sentToKitchen: boolean; sentToCashier: boolean },
  ) => {
    const meta = parseSelfOrderMetadata(order);
    const tags = ["[SELF_ORDER_ACTIVE]"];
    if (flags.sentToKitchen) tags.push("[SENT_TO_KITCHEN]");
    if (flags.sentToCashier) tags.push("[SENT_TO_CASHIER]");
    tags.push(`[طاولة: ${meta.tableNumber === 999 ? "سفري" : meta.tableNumber}]`);
    if (meta.zone) tags.push(`[المكان: ${meta.zone}]`);
    if (meta.customerName) tags.push(`[العميل: ${meta.customerName}]`);
    if (meta.cleanNotes) tags.push(meta.cleanNotes);
    return tags.join(" ");
  };

  const normalizeItemsForCart = (rawItems: any[]) => {
    return (Array.isArray(rawItems) ? rawItems : []).map((line: any, idx: number) => ({
      ...line,
      item: line?.item || {
        id: line?.menu_item_id || line?.id || `item-${idx}`,
        name_ar: line?.name_ar || line?.name || "صنف",
        price: Number(line?.price ?? 0),
        category_id: line?.category_id || "all",
        image_url: line?.image_url || null,
        requires_oven: Boolean(line?.requires_oven),
      },
      quantity: Number(line?.quantity ?? 1),
      notes: line?.notes || line?.note || "",
      selectedAdditions: line?.selectedAdditions || [],
    }));
  };

  // Button 1: Send ONLY to Kitchen (without sending to Cashier yet, and never creating a duplicate row)
  const sendOrderToKitchenOnly = async (order: any) => {
    const meta = parseSelfOrderMetadata(order);
    seenOrderIdsRef.current.add(order.id);

    const existingLocal = tableOrdersStore
      .getAllOrders()
      .find((o) => o.id === order.id || o.table_id === meta.tableId);
    const alreadySentToCashier =
      Boolean(order.sentToCashier) ||
      meta.sentToCashier ||
      existingLocal?.status === "sent_to_cashier" ||
      Boolean(existingLocal?.sentToCashier);

    const updatedNotes = buildUpdatedSelfOrderNotes(order, {
      sentToKitchen: true,
      sentToCashier: alreadySentToCashier,
    });

    try {
      await supabase
        .from("orders")
        .update({
          status: "preparing",
          notes: updatedNotes,
        })
        .eq("id", order.id);
    } catch (e) {
      console.warn("Supabase kitchen status update warning:", e);
    }

    tableOrdersStore.saveOrder({
      id: order.id,
      kitchenOrderId: order.id,
      table_id: meta.tableId,
      table_number: meta.tableNumber,
      table_name: meta.locationDisplay,
      items: normalizeItemsForCart(order.items),
      order_type: order.order_type || "dine_in",
      notes: updatedNotes,
      selectedAdditions: [],
      subtotal: Number(order.subtotal ?? order.total ?? 0),
      tax: Number(order.tax ?? 0),
      total: Number(order.total ?? 0),
      status: alreadySentToCashier ? "sent_to_cashier" : "draft",
      sentToKitchen: true,
      sentToCashier: alreadySentToCashier,
      kitchenCompleted: false,
      is_self_order: true,
    });

    queryClient.invalidateQueries({ queryKey: ["captain-self-orders"] });
    toast({
      title: "تم الإرسال إلى المطبخ 👨‍🍳",
      description: `تم إرسال طلب (${meta.locationDisplay}) إلى شاشة المطبخ والفرن للتجهيز.`,
    });
  };

  // Button 2: Send ONLY to Cashier (and keep visible until Cashier completes payment & receives cash)
  const sendOrderToCashierOnly = async (order: any) => {
    const meta = parseSelfOrderMetadata(order);
    seenOrderIdsRef.current.add(order.id);

    const existingLocal = tableOrdersStore
      .getAllOrders()
      .find((o) => o.id === order.id || o.table_id === meta.tableId);
    const alreadySentToKitchen =
      Boolean(order.sentToKitchen) ||
      meta.sentToKitchen ||
      Boolean(existingLocal?.sentToKitchen);

    const updatedNotes = buildUpdatedSelfOrderNotes(order, {
      sentToKitchen: alreadySentToKitchen,
      sentToCashier: true,
    });

    try {
      await supabase
        .from("orders")
        .update({
          notes: updatedNotes,
        })
        .eq("id", order.id);
    } catch (e) {
      console.warn("Supabase cashier status update warning:", e);
    }

    tableOrdersStore.saveOrder({
      id: order.id,
      kitchenOrderId: order.id,
      table_id: meta.tableId,
      table_number: meta.tableNumber,
      table_name: meta.locationDisplay,
      items: normalizeItemsForCart(order.items),
      order_type: order.order_type || "dine_in",
      notes: updatedNotes,
      selectedAdditions: [],
      subtotal: Number(order.subtotal ?? order.total ?? 0),
      tax: Number(order.tax ?? 0),
      total: Number(order.total ?? 0),
      status: "sent_to_cashier",
      sentToKitchen: alreadySentToKitchen,
      sentToCashier: true,
      kitchenCompleted: Boolean(existingLocal?.kitchenCompleted),
      is_self_order: true,
    });

    if (typeof BroadcastChannel !== "undefined") {
      try {
        const bc = new BroadcastChannel("restocash_self_orders_bc");
        bc.postMessage({ type: "ORDER_SENT_TO_CASHIER", payload: { id: order.id } });
        bc.close();
      } catch {
        // ignore BroadcastChannel error
      }
    }

    queryClient.invalidateQueries({ queryKey: ["captain-self-orders"] });
    toast({
      title: "تم الإرسال إلى الكاشير 💰",
      description: `تم تحويل طلب (${meta.locationDisplay}) إلى الكاشير، وسيختفي تلقائياً فور إنهاء الطلب واستلام النقدية.`,
    });
  };

  const rejectSelfOrder = async (order: any) => {
    try {
      await supabase.from("orders").update({ status: "cancelled" }).eq("id", order.id);
    } catch (e) {
      console.warn("Failed to cancel order in Supabase:", e);
    }
    tableOrdersStore.removeOrder(order.id);
    queryClient.invalidateQueries({ queryKey: ["captain-self-orders"] });
    toast({
      title: "تم إلغاء الطلب الذاتي",
      variant: "destructive",
    });
  };

  return (
    <section className="max-w-7xl mx-auto w-full px-4 mt-3 space-y-3" dir="rtl">
      {/* Compact Live Monitor Bar when no orders are waiting */}
      {orders.length === 0 && assistanceAlerts.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <BellRing size={15} className="text-indigo-600" />
            <span>مستقبل طلبات العملاء الذاتية (QR) وتنبيهات الطاولات نشط هنا في شاشة الكابتن</span>
            <span className="text-slate-400">·</span>
            <span className="text-emerald-700 font-semibold">لا توجد طلبات معلقة حالياً</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                playCaptainNotificationSound(false);
                toast({
                  title: "🔔 تجربة جرس إشعارات الكابتن",
                  description: "التنبيه الصوتي يعمل بنجاح وسيصدر تلقائياً فور وصول أي طلب من العميل.",
                });
              }}
              className="h-7 text-[11px] font-bold gap-1"
            >
              <Volume2 size={13} className="text-indigo-600" />
              تجربة الجرس
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["captain-self-orders"] })}
              className="h-7 text-[11px] font-bold gap-1"
            >
              <RefreshCw size={12} />
              تحديث
            </Button>
          </div>
        </div>
      )}

      {/* 1. Live Table Assistance Alerts (Call Captain / Request Bill) */}
      {assistanceAlerts.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <BellRing size={18} className="text-amber-700 animate-bounce" />
              <h2 className="font-black text-sm sm:text-base text-amber-950">
                تنبيهات الطاولات المباشرة ({assistanceAlerts.length})
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {assistanceAlerts.map((alert) => {
              const loc = [
                alert.table_name || `طاولة ${alert.table_number}`,
                alert.zone,
              ]
                .filter(Boolean)
                .join(" — ");
              return (
                <div
                  key={alert.id}
                  className="bg-white border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-slate-900">
                        {alert.request_type === "request_bill"
                          ? "🧾 طلب الحساب / الفاتورة"
                          : "🙋‍♂️ استدعاء الكابتن للطاولة"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                      <MapPin size={13} />
                      <span>المكان: {loc}</span>
                    </div>
                    {alert.notes && (
                      <div className="text-xs text-slate-600">{alert.notes}</div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => dismissAssistanceAlert(alert.id)}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold h-8 text-xs shrink-0 gap-1"
                  >
                    <CheckCircle2 size={14} />
                    تمت الاستجابة
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Incoming QR Self-Orders Panel */}
      {orders.length > 0 && (
        <div className="rounded-3xl border border-indigo-200 bg-indigo-50/70 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <BellRing size={18} className="text-indigo-700" />
                <h2 className="font-black text-lg text-indigo-950">
                  طلبات العملاء الذاتية عبر الباركود (QR)
                </h2>
                <span className="text-xs font-black text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-lg tabular-nums">
                  {orders.length} طلب نشط
                </span>
              </div>
              <p className="text-xs text-indigo-700 mt-1">
                يمكنك إرسال الطلب للمطبخ للتجهيز أو للكاشير للتحصيل بشكل منفصل، وسيختفي الطلب تلقائياً بعد إنهاء الكاشير للطلب واستلام النقدية.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSoundEnabled((s) => !s)}
              className="h-8 text-xs font-bold gap-1.5 bg-white"
            >
              {soundEnabled ? (
                <>
                  <Volume2 size={14} className="text-emerald-600" />
                  <span>التنبيه الصوتي مفعّل</span>
                </>
              ) : (
                <>
                  <VolumeX size={14} className="text-slate-400" />
                  <span>التنبيه الصوتي مكتوم</span>
                </>
              )}
            </Button>
          </div>

          <div className="space-y-3">
            {orders.map((order) => {
              const selected = currency[order.id] || order.payment_currency || "EGP";
              const meta = parseSelfOrderMetadata(order);
              const isSentToKitchen = Boolean(order.sentToKitchen) || meta.sentToKitchen;
              const isSentToCashier = Boolean(order.sentToCashier) || meta.sentToCashier;
              const shortNo =
                order.order_number || String(order.id || "").replace(/^ord_/, "").slice(0, 8);
              const createdTime = order.created_at
                ? new Date(order.created_at).toLocaleTimeString("ar-EG", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "";

              return (
                <div
                  key={order.id}
                  className="bg-white border border-indigo-100 rounded-2xl p-4 shadow-2xs space-y-3"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-base text-slate-900 tabular-nums">
                          طلب #{shortNo}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                          <MapPin size={13} className="text-emerald-600" />
                          المكان: {meta.locationDisplay}
                        </span>
                        {isSentToKitchen && (
                          <span className="inline-flex items-center gap-1 text-xs font-black text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                            <ChefHat size={13} className="text-amber-600" />
                            في المطبخ 👨‍🍳
                          </span>
                        )}
                        {isSentToCashier && (
                          <span className="inline-flex items-center gap-1 text-xs font-black text-indigo-800 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg">
                            <Send size={12} className="text-indigo-600" />
                            مرسل للكاشير (بانتظار استلام النقدية) 💰
                          </span>
                        )}
                        {createdTime && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 tabular-nums">
                              <Clock size={12} />
                              {createdTime}
                            </span>
                          </>
                        )}
                      </div>

                      {meta.customerName && (
                        <div className="text-xs font-bold text-slate-700">
                          العميل: {meta.customerName}
                        </div>
                      )}
                      {meta.cleanNotes && (
                        <div className="text-xs text-slate-600">{meta.cleanNotes}</div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                        <Coins size={13} className="text-slate-500" />
                        <select
                          value={selected}
                          onChange={(e) =>
                            setCurrency((s) => ({ ...s, [order.id]: e.target.value }))
                          }
                          className="h-7 bg-transparent text-xs font-bold focus:outline-none"
                        >
                          <option value="EGP">EGP</option>
                          <option value="USD">USD</option>
                          <option value="SAR">SAR</option>
                          <option value="AED">AED</option>
                          <option value="EUR">EUR</option>
                          <option value="SSP">SSP</option>
                        </select>
                        {selected !== "EGP" && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold text-slate-500">
                              1 {selected} =
                            </span>
                            <Input
                              type="number"
                              min="0.0001"
                              step="0.0001"
                              value={rate[order.id] ?? order.payment_exchange_rate ?? 1}
                              onChange={(e) =>
                                setRate((s) => ({ ...s, [order.id]: e.target.value }))
                              }
                              className="w-20 h-7 text-center text-xs font-bold"
                            />
                          </div>
                        )}
                      </div>

                      {/* Separate Button 1: Send to Kitchen */}
                      <Button
                        size="sm"
                        disabled={isSentToKitchen}
                        onClick={() => sendOrderToKitchenOnly(order)}
                        className={
                          isSentToKitchen
                            ? "h-9 bg-amber-100 text-amber-900 border border-amber-300 font-bold gap-1.5 text-xs opacity-95 cursor-default"
                            : "h-9 bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1.5 text-xs shadow-2xs"
                        }
                      >
                        <ChefHat size={14} />
                        {isSentToKitchen ? "تم الإرسال للمطبخ ✓" : "إرسال للمطبخ"}
                      </Button>

                      {/* Separate Button 2: Send to Cashier */}
                      <Button
                        size="sm"
                        disabled={isSentToCashier}
                        onClick={() => sendOrderToCashierOnly(order)}
                        className={
                          isSentToCashier
                            ? "h-9 bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold gap-1.5 text-xs opacity-95 cursor-default"
                            : "h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 text-xs shadow-2xs"
                        }
                      >
                        <Send size={13} />
                        {isSentToCashier ? "أُرسل للكاشير (بانتظار الدفع) ✓" : "إرسال للكاشير"}
                      </Button>

                      {onOpenTableOrder && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            onOpenTableOrder(meta.tableId, meta.tableNumber, meta.tableName)
                          }
                          className="h-9 font-bold gap-1 text-xs"
                        >
                          <Receipt size={13} />
                          فتح الطاولة
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => rejectSelfOrder(order)}
                        className="h-9 text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold gap-1 text-xs"
                      >
                        <XCircle size={14} />
                        رفض
                      </Button>
                    </div>
                  </div>

                  {/* Ordered Items Breakdown */}
                  {Array.isArray(order.items) && order.items.length > 0 && (
                    <div className="pt-2 border-t border-slate-100">
                      <div className="flex flex-wrap gap-2">
                        {order.items.map((line: any, idx: number) => {
                          const itemName =
                            line?.item?.name_ar || line?.name_ar || line?.name || "صنف";
                          const qty = Number(line?.quantity ?? 1);
                          const additions = Array.isArray(line?.selectedAdditions)
                            ? line.selectedAdditions
                                .map((a: any) => a?.name_ar || a?.name || "")
                                .filter(Boolean)
                                .join(" + ")
                            : "";
                          const lineNote = line?.notes || line?.note || "";
                          return (
                            <div
                              key={idx}
                              className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 text-xs flex items-center gap-2"
                            >
                              <UtensilsCrossed size={12} className="text-indigo-600 shrink-0" />
                              <span className="font-black text-slate-900">
                                {qty} × {itemName}
                              </span>
                              {additions && (
                                <span className="text-indigo-700 font-semibold">
                                  ({additions})
                                </span>
                              )}
                              {lineNote && (
                                <span className="text-amber-700 font-semibold">
                                  — ملاحظة: {lineNote}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-2 text-xs font-black text-slate-700 tabular-nums">
                        الإجمالي الأساسي: {Number(order.total || 0).toLocaleString()}{" "}
                        {order.pricing_currency || "EGP"}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
