import { MenuItem } from "@/shared/types";
import { supabase } from "@/integrations/supabase/client";
import { getLineUnitPrice } from "@/shared/utils/productOptions";

export type TablePaymentNoticeStatus = "awaiting_payment" | "paid";

export interface TableCartLine {
  lineKey?: string;
  item: MenuItem;
  quantity: number;
  notes?: string;
  selectedOptions?: any[];
  selectedAdditions?: any[];
}

export interface TableOrder {
  id: string;
  table_id: string;
  table_number: number;
  table_name?: string | null;
  items: TableCartLine[];
  order_type: "dine_in" | "takeaway" | "delivery";
  notes: string;
  selectedAdditions: string[];
  subtotal: number;
  tax: number;
  total: number;
  pricing_currency?: string;
  payment_currency?: string;
  payment_exchange_rate?: number;
  payment_amount?: number;
  status: "draft" | "sent_to_cashier" | "in_checkout" | "completed" | "cancelled";
  sentToKitchen?: boolean;
  sentToCashier?: boolean;
  kitchenCompleted?: boolean;
  kitchenOrderId?: string;
  submitted_at?: string;
  captain_confirmed_at?: string;
  kitchen_started_at?: string;
  ready_at?: string;
  delivered_at?: string;
  is_self_order?: boolean;
  created_at: string;
  updated_at: string;
}

const STORAGE_KEY = "restocash_table_orders_v1";
const TABLE_PAYMENT_NOTICES_KEY = "restocash_table_payment_notifications_v1";
const CANCELLED_IDS_KEY = "restocash_cancelled_order_ids_v1";
const CLEARED_BEFORE_TS_KEY = "restocash_orders_cleared_before_ts_v1";
const ONE_TIME_WIPE_KEY = "restocash_clear_pending_v3_done";
const OVEN_CHANNEL = "oven_orders_channel";
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

class TableOrdersStore {
  private orders: TableOrder[] = [];
  private listeners = new Set<() => void>();
  private persistingKitchenIds = new Set<string>();

  constructor() {
    this.loadState();
    this.runOneTimePendingWipeIfNeeded();
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (e) => {
        if (e.key === STORAGE_KEY || e.key === TABLE_PAYMENT_NOTICES_KEY) {
          this.loadState();
          this.notify();
        }
      });
      window.addEventListener("table-orders-updated", () => {
        this.loadState();
        this.notify();
      });
      window.addEventListener("force_oven_refresh", () => {
        this.loadState();
        this.notify();
      });
    }
  }

  private runOneTimePendingWipeIfNeeded() {
    try {
      if (typeof window === "undefined" || typeof localStorage === "undefined") return;
      if (localStorage.getItem(ONE_TIME_WIPE_KEY) === "1") return;
      localStorage.setItem(ONE_TIME_WIPE_KEY, "1");
      void this.clearAllPendingOrders();
    } catch {
      // ignore storage errors
    }
  }

  public getCancelledIds(): Set<string> {
    try {
      if (typeof window === "undefined" || typeof localStorage === "undefined") return new Set();
      const raw = localStorage.getItem(CANCELLED_IDS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  }

  public markIdsCancelled(ids: (string | undefined | null)[]) {
    try {
      if (typeof window === "undefined" || typeof localStorage === "undefined") return;
      const validIds = ids.filter((id): id is string => Boolean(id && String(id).trim()));
      if (validIds.length === 0) return;
      const current = Array.from(this.getCancelledIds());
      const merged = Array.from(new Set([...validIds, ...current])).slice(0, 200);
      localStorage.setItem(CANCELLED_IDS_KEY, JSON.stringify(merged));
    } catch {
      // ignore
    }
  }

  public shouldIgnoreRemoteOrder(orderId?: string | null, createdAt?: string | null): boolean {
    try {
      if (typeof window === "undefined" || typeof localStorage === "undefined") return false;
      if (orderId && this.getCancelledIds().has(orderId)) return true;
      const clearedBeforeStr = localStorage.getItem(CLEARED_BEFORE_TS_KEY);
      if (clearedBeforeStr && createdAt) {
        const clearedBeforeTs = Number(clearedBeforeStr);
        const orderTs = new Date(createdAt).getTime();
        if (!isNaN(clearedBeforeTs) && !isNaN(orderTs) && orderTs <= clearedBeforeTs) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  private loadState() {
    try {
      if (typeof window === "undefined" || typeof localStorage === "undefined") {
        this.orders = [];
        return;
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      this.orders = Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("Failed to load table orders:", e);
      this.orders = [];
    }
  }

  private saveState() {
    try {
      if (typeof window === "undefined" || typeof localStorage === "undefined") return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.orders));
      window.dispatchEvent(new Event("table-orders-updated"));
      window.dispatchEvent(new Event("force_oven_refresh"));
    } catch (e) {
      console.error("Failed to save table orders:", e);
    }
  }

  private broadcastKitchenOrder(order: TableOrder) {
    void (async () => {
      try {
        const channel = supabase.channel(OVEN_CHANNEL);
        await new Promise<void>((resolve) => {
          let settled = false;
          const finish = () => {
            if (!settled) {
              settled = true;
              resolve();
            }
          };
          channel.subscribe(async (status) => {
            if (status === "SUBSCRIBED") {
              try {
                await channel.send({
                  type: "broadcast",
                  event: "NEW_OVEN_ORDER",
                  payload: {
                    order_id: order.kitchenOrderId || order.id,
                    table_id: order.table_id,
                    table_number: order.table_number,
                    order_type: order.order_type,
                    notes: order.notes,
                    items: order.items,
                    subtotal: Number(order.subtotal || 0),
                    tax: Number(order.tax || 0),
                    total: Number(order.total || 0),
                    created_at: order.created_at,
                  },
                });
              } finally {
                supabase.removeChannel(channel);
                finish();
              }
            }
          });
          setTimeout(() => {
            supabase.removeChannel(channel);
            finish();
          }, 5000);
        });
      } catch (error) {
        console.warn("Kitchen broadcast failed; database/local bridge remains active:", error);
      }
    })();
  }

  private persistKitchenOrderToDatabase(order: TableOrder) {
    if (!order.sentToKitchen) return;

    // If the order already exists in Supabase (e.g. a QR Self-Order with a UUID or already has kitchenOrderId),
    // never insert a second row into public.orders!
    if (order.kitchenOrderId || order.is_self_order || UUID_REGEX.test(String(order.id || ""))) {
      if (!order.kitchenOrderId && UUID_REGEX.test(String(order.id || ""))) {
        const idx = this.orders.findIndex((o) => o.id === order.id);
        if (idx >= 0) {
          this.orders[idx] = {
            ...this.orders[idx],
            kitchenOrderId: order.id,
          };
          this.saveState();
        }
      }
      return;
    }

    if (this.persistingKitchenIds.has(order.id)) return;
    this.persistingKitchenIds.add(order.id);

    void (async () => {
      try {
        const cleanNotes = String(order.notes || "")
          .replace(/\[SELF_ORDER_PENDING_CAPTAIN\]/g, "")
          .trim();

        const { data, error } = await (supabase as any)
          .from("orders")
          .insert({
            subtotal: Number(order.subtotal || 0),
            tax: Number(order.tax || 0),
            total: Number(order.total || 0),
            ...(order.pricing_currency ? { pricing_currency: order.pricing_currency } : {}),
            ...(order.payment_currency ? { payment_currency: order.payment_currency } : {}),
            ...(order.payment_exchange_rate !== undefined
              ? { payment_exchange_rate: Number(order.payment_exchange_rate) }
              : {}),
            ...(order.payment_amount !== undefined
              ? { payment_amount: Number(order.payment_amount) }
              : {}),
            payment_method: "cash",
            order_type: order.order_type,
            table_id:
              order.table_id && UUID_REGEX.test(order.table_id) ? order.table_id : null,
            status: "preparing",
            notes: cleanNotes ? `[SENT_TO_KITCHEN] ${cleanNotes}` : `[SENT_TO_KITCHEN] طاولة #${order.table_number}`,
            items: (order.items || []).map((line: any) => ({
              id: line?.item?.id || line?.id,
              menu_item_id: line?.item?.id || line?.menu_item_id || line?.id,
              lineKey: line?.lineKey,
              name_ar: line?.item?.name_ar || line?.name_ar || line?.name || "صنف",
              price: Number(
                getLineUnitPrice(
                  Number(line?.item?.price ?? line?.price ?? 0),
                  line?.selectedAdditions,
                ).toFixed(2),
              ),
              quantity: Number(line?.quantity ?? 1),
              notes: line?.notes || "",
              selectedOptions: line?.selectedOptions || [],
              selectedAdditions: line?.selectedAdditions || [],
              requires_oven: Boolean(line?.item?.requires_oven ?? line?.requires_oven),
            })),
          })
          .select("id")
          .single();

        if (error || !data?.id) {
          console.warn("Could not persist kitchen order to Supabase:", error);
          this.broadcastKitchenOrder(order);
          return;
        }

        const index = this.orders.findIndex((o) => o.id === order.id);
        if (index >= 0) {
          this.orders[index] = {
            ...this.orders[index],
            kitchenOrderId: data.id,
            updated_at: new Date().toISOString(),
          };
          this.saveState();
          this.broadcastKitchenOrder(this.orders[index]);
        }
      } catch (error) {
        console.warn("Kitchen DB bridge failed; keeping local order:", error);
        this.broadcastKitchenOrder(order);
      } finally {
        this.persistingKitchenIds.delete(order.id);
      }
    })();
  }

  public subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  public getAllOrders() {
    return this.orders;
  }

  public getOrderByTableId(tableId: string, tableNumber?: number) {
    return this.orders.find(
      (o) =>
        (o.table_id === tableId ||
          (tableNumber !== undefined &&
            Number(tableNumber) > 0 &&
            Number(tableNumber) !== 999 &&
            Number(o.table_number) === Number(tableNumber))) &&
        ["draft", "sent_to_cashier", "in_checkout"].includes(o.status),
    );
  }

  public getPendingCashierOrders() {
    return this.orders.filter((o) => o.status === "sent_to_cashier");
  }

  public saveOrder(orderData: Partial<TableOrder>): TableOrder {
    const now = new Date().toISOString();
    const existingIndex = this.orders.findIndex(
      (o) =>
        (orderData.id && o.id === orderData.id) ||
        (orderData.kitchenOrderId &&
          (o.kitchenOrderId === orderData.kitchenOrderId || o.id === orderData.kitchenOrderId)) ||
        ((!!orderData.table_id && o.table_id === orderData.table_id) ||
          (orderData.table_number !== undefined &&
            Number(orderData.table_number) > 0 &&
            Number(orderData.table_number) !== 999 &&
            Number(o.table_number) === Number(orderData.table_number))) &&
          ["draft", "sent_to_cashier", "in_checkout"].includes(o.status),
    );

    if (existingIndex >= 0) {
      const prev = this.orders[existingIndex];
      const nextSentToKitchen = Boolean(orderData.sentToKitchen ?? prev.sentToKitchen);
      const resolvedKitchenStartedAt = nextSentToKitchen
        ? prev.kitchen_started_at || orderData.kitchen_started_at || now
        : undefined;

      const updated = {
        ...prev,
        ...orderData,
        submitted_at: prev.submitted_at || orderData.submitted_at || prev.created_at || now,
        captain_confirmed_at:
          orderData.captain_confirmed_at ||
          prev.captain_confirmed_at ||
          (orderData.status === "sent_to_cashier" ? now : undefined),
        kitchen_started_at: resolvedKitchenStartedAt,
        ready_at: orderData.ready_at || prev.ready_at,
        delivered_at: orderData.delivered_at || prev.delivered_at,
        subtotal: Number(orderData.subtotal ?? prev.subtotal ?? 0),
        tax: Number(orderData.tax ?? prev.tax ?? 0),
        total: Number(orderData.total ?? prev.total ?? 0),
        pricing_currency: orderData.pricing_currency || prev.pricing_currency || "USD",
        payment_currency: orderData.payment_currency || prev.payment_currency,
        payment_exchange_rate:
          orderData.payment_exchange_rate ?? prev.payment_exchange_rate,
        payment_amount: orderData.payment_amount ?? prev.payment_amount,
        updated_at: now,
      } as TableOrder;
      this.orders[existingIndex] = updated;
      if (updated.status === "sent_to_cashier" || updated.sentToCashier) {
        this.writeTablePaymentStatus(
          { tableId: updated.table_id, tableNumber: updated.table_number },
          "awaiting_payment",
          false,
        );
      }
      this.saveState();
      this.syncCustomerHistoryTimestamps(updated);
      this.notify();
      if (updated.sentToKitchen && !prev.sentToKitchen) {
        this.persistKitchenOrderToDatabase(updated);
        this.broadcastKitchenOrder(updated);
      }
      return updated;
    }

    const isSentToKitchen = Boolean(orderData.sentToKitchen);
    const newOrder: TableOrder = {
      id: orderData.id || `tbl-ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      table_id: orderData.table_id || "",
      table_number: Number(orderData.table_number ?? 0),
      table_name: orderData.table_name ?? "",
      items: orderData.items || [],
      order_type: orderData.order_type || "dine_in",
      notes: orderData.notes || "",
      selectedAdditions: orderData.selectedAdditions || [],
      subtotal: Number(orderData.subtotal ?? 0),
      tax: Number(orderData.tax ?? 0),
      total: Number(orderData.total ?? 0),
      pricing_currency: orderData.pricing_currency || "USD",
      payment_currency: orderData.payment_currency,
      payment_exchange_rate: orderData.payment_exchange_rate,
      payment_amount: orderData.payment_amount,
      status: orderData.status || "draft",
      sentToKitchen: isSentToKitchen,
      sentToCashier: Boolean(orderData.sentToCashier || orderData.status === "sent_to_cashier"),
      kitchenCompleted: Boolean(orderData.kitchenCompleted),
      kitchenOrderId: orderData.kitchenOrderId,
      submitted_at: orderData.submitted_at || orderData.created_at || now,
      captain_confirmed_at:
        orderData.captain_confirmed_at ||
        (orderData.status === "sent_to_cashier" ? now : undefined),
      kitchen_started_at: isSentToKitchen ? orderData.kitchen_started_at || now : undefined,
      ready_at: orderData.ready_at,
      delivered_at: orderData.delivered_at,
      is_self_order: Boolean(orderData.is_self_order),
      created_at: orderData.created_at || now,
      updated_at: now,
    };

    this.orders.push(newOrder);
    if (newOrder.status === "sent_to_cashier" || newOrder.sentToCashier) {
      this.writeTablePaymentStatus(
        { tableId: newOrder.table_id, tableNumber: newOrder.table_number },
        "awaiting_payment",
        false,
      );
    }
    this.saveState();
    this.syncCustomerHistoryTimestamps(newOrder);
    this.notify();

    if (newOrder.sentToKitchen) {
      this.persistKitchenOrderToDatabase(newOrder);
      this.broadcastKitchenOrder(newOrder);
    }

    return newOrder;
  }

  public sendOrderToKitchen(orderId: string) {
    const target = this.orders.find((o) => o.id === orderId);
    if (!target) return;
    const now = new Date().toISOString();
    target.sentToKitchen = true;
    target.kitchenCompleted = false;
    target.captain_confirmed_at = target.captain_confirmed_at || now;
    target.kitchen_started_at = target.kitchen_started_at || now;
    target.kitchenOrderId = target.kitchenOrderId || undefined;
    target.updated_at = now;
    this.saveState();
    this.syncCustomerHistoryTimestamps(target);
    this.notify();
    this.persistKitchenOrderToDatabase(target);
    this.broadcastKitchenOrder(target);
  }

  public completeKitchenOrder(orderId: string) {
    const target = this.orders.find((o) => o.id === orderId);
    if (!target) return;
    const now = new Date().toISOString();
    target.kitchenCompleted = true;
    target.ready_at = target.ready_at || now;
    target.updated_at = now;
    this.saveState();
    this.syncCustomerHistoryTimestamps(target);
    this.notify();
  }

  public updateStatus(orderId: string, status: TableOrder["status"]) {
    const target = this.orders.find((o) => o.id === orderId);
    if (!target) return;
    const now = new Date().toISOString();
    target.status = status;
    if (status === "sent_to_cashier") {
      target.captain_confirmed_at = target.captain_confirmed_at || now;
      target.sentToCashier = true;
      this.writeTablePaymentStatus(
        { tableId: target.table_id, tableNumber: target.table_number },
        "awaiting_payment",
        false,
      );
    } else if (status === "completed") {
      target.delivered_at = target.delivered_at || now;
    }
    target.updated_at = now;
    this.saveState();
    this.syncCustomerHistoryTimestamps(target);
    this.notify();
  }

  private readPaymentStatusMap(): Record<string, TablePaymentNoticeStatus> {
    try {
      if (typeof window === "undefined" || typeof localStorage === "undefined") return {};
      const raw = localStorage.getItem(TABLE_PAYMENT_NOTICES_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  private writeTablePaymentStatus(
    params: { tableId?: string | null; tableNumber?: number | null },
    status: TablePaymentNoticeStatus | null,
    shouldNotify = true,
  ) {
    try {
      if (typeof window === "undefined" || typeof localStorage === "undefined") return;
      const map = this.readPaymentStatusMap();
      const keys: string[] = [];
      if (params.tableId && String(params.tableId).trim()) {
        keys.push(`id:${String(params.tableId).trim()}`);
      }
      if (
        params.tableNumber !== undefined &&
        params.tableNumber !== null &&
        Number(params.tableNumber) > 0 &&
        Number(params.tableNumber) !== 999
      ) {
        keys.push(`num:${Number(params.tableNumber)}`);
      }
      if (keys.length === 0) return;

      for (const k of keys) {
        if (status === null) {
          delete map[k];
        } else {
          map[k] = status;
        }
      }
      localStorage.setItem(TABLE_PAYMENT_NOTICES_KEY, JSON.stringify(map));
      if (shouldNotify) {
        window.dispatchEvent(new Event("table-orders-updated"));
        this.notify();
      }
    } catch {
      // ignore storage errors
    }
  }

  public getAllTablePaymentStatuses(): Record<string, TablePaymentNoticeStatus> {
    return this.readPaymentStatusMap();
  }

  public getTablePaymentStatus(
    tableId?: string | null,
    tableNumber?: number | null,
  ): TablePaymentNoticeStatus | null {
    const map = this.readPaymentStatusMap();
    if (tableId && map[`id:${tableId}`]) return map[`id:${tableId}`];
    if (
      tableNumber !== undefined &&
      tableNumber !== null &&
      Number(tableNumber) > 0 &&
      Number(tableNumber) !== 999 &&
      map[`num:${Number(tableNumber)}`]
    ) {
      return map[`num:${Number(tableNumber)}`];
    }
    return null;
  }

  public setTablePaymentStatus(params: {
    tableId?: string | null;
    tableNumber?: number | null;
    status: TablePaymentNoticeStatus | null;
  }) {
    this.writeTablePaymentStatus(params, params.status, true);
  }

  public clearTablePaymentStatus(params: {
    tableId?: string | null;
    tableNumber?: number | null;
  }) {
    this.writeTablePaymentStatus(params, null, true);
  }

  public removeOrder(orderId: string) {
    this.markIdsCancelled([orderId]);
    this.orders = this.orders.filter((o) => o.id !== orderId);
    this.saveState();
    this.notify();
  }

  public clearOrder(tableId: string, tableNumber?: number) {
    this.clearTableOrder(tableId, tableNumber);
  }

  public clearTableOrder(tableId: string, tableNumber?: number) {
    const removedIds: string[] = [];
    this.orders = this.orders.filter((o) => {
      if (tableId && o.table_id === tableId) {
        if (o.id) removedIds.push(o.id);
        if (o.kitchenOrderId) removedIds.push(o.kitchenOrderId);
        return false;
      }
      if (
        tableNumber !== undefined &&
        Number(tableNumber) > 0 &&
        Number(tableNumber) !== 999 &&
        Number(o.table_number) === Number(tableNumber)
      ) {
        if (o.id) removedIds.push(o.id);
        if (o.kitchenOrderId) removedIds.push(o.kitchenOrderId);
        return false;
      }
      return true;
    });
    this.markIdsCancelled(removedIds);
    this.saveState();
    this.notify();
  }

  public async cancelTableOrder(params: {
    orderId?: string | null;
    kitchenOrderId?: string | null;
    tableId?: string | null;
    tableNumber?: number | null;
  }) {
    const { orderId, kitchenOrderId, tableId, tableNumber } = params;
    const matchedIds = new Set<string>();
    if (orderId) matchedIds.add(orderId);
    if (kitchenOrderId) matchedIds.add(kitchenOrderId);

    this.orders = this.orders.filter((o) => {
      const match =
        (orderId && (o.id === orderId || o.kitchenOrderId === orderId)) ||
        (kitchenOrderId && (o.id === kitchenOrderId || o.kitchenOrderId === kitchenOrderId)) ||
        (tableId && o.table_id === tableId) ||
        (tableNumber &&
          Number(tableNumber) > 0 &&
          Number(tableNumber) !== 999 &&
          Number(o.table_number) === Number(tableNumber));
      if (match) {
        if (o.id) matchedIds.add(o.id);
        if (o.kitchenOrderId) matchedIds.add(o.kitchenOrderId);
        return false;
      }
      return true;
    });

    this.markIdsCancelled(Array.from(matchedIds));
    this.writeTablePaymentStatus({ tableId, tableNumber }, null, false);
    this.saveState();
    this.notify();

    // Sync cancellation/deletion to Supabase so polling never resurrects the cancelled order
    const uuidList = Array.from(matchedIds).filter((id) => UUID_REGEX.test(id));
    for (const uid of uuidList) {
      try {
        const { error } = await supabase.from("orders").delete().eq("id", uid);
        if (error) {
          await supabase
            .from("orders")
            .update({ status: "cancelled", notes: "[CANCELLED_BY_CAPTAIN] [CASHIER_PAID]" })
            .eq("id", uid);
        }
      } catch {
        // ignore network error
      }
    }

    if (tableNumber && Number(tableNumber) > 0) {
      try {
        const { data: pendingRows } = await supabase
          .from("orders")
          .select("id, notes")
          .in("status", ["pending", "preparing", "in_kitchen", "ready"])
          .limit(30);
        if (Array.isArray(pendingRows)) {
          for (const r of pendingRows) {
            const n = String(r.notes || "");
            if (
              n.includes(`[طاولة: ${tableNumber}]`) ||
              new RegExp(`طاولة\\s*#?${tableNumber}(?!\\d)`).test(n)
            ) {
              this.markIdsCancelled([r.id]);
              const { error } = await supabase.from("orders").delete().eq("id", r.id);
              if (error) {
                await supabase
                  .from("orders")
                  .update({ status: "cancelled", notes: "[CANCELLED_BY_CAPTAIN] [CASHIER_PAID]" })
                  .eq("id", r.id);
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }

    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        const bc = new BroadcastChannel("restocash_self_orders_bc");
        bc.postMessage({
          type: "ORDER_COMPLETED_BY_CASHIER",
          payload: params,
        });
        bc.close();
      } catch {
        // ignore
      }
    }
  }

  public async clearAllPendingOrders() {
    const existingIds: string[] = [];
    this.orders.forEach((o) => {
      if (o.id) existingIds.push(o.id);
      if (o.kitchenOrderId) existingIds.push(o.kitchenOrderId);
    });
    this.markIdsCancelled(existingIds);
    try {
      if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
        localStorage.setItem(CLEARED_BEFORE_TS_KEY, String(Date.now()));
      }
    } catch {
      // ignore
    }
    this.orders = [];
    try {
      if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
        localStorage.removeItem(TABLE_PAYMENT_NOTICES_KEY);
      }
    } catch {
      // ignore
    }
    this.saveState();
    this.notify();

    try {
      const { data: pendingRows } = await supabase
        .from("orders")
        .select("id")
        .in("status", ["pending", "preparing", "in_kitchen", "ready"]);
      if (Array.isArray(pendingRows) && pendingRows.length > 0) {
        const ids = pendingRows.map((r) => r.id).filter(Boolean);
        this.markIdsCancelled(ids);
        for (const uid of ids) {
          const { error } = await supabase.from("orders").delete().eq("id", uid);
          if (error) {
            await supabase
              .from("orders")
              .update({ status: "cancelled", notes: "[CANCELLED_BY_CAPTAIN] [CASHIER_PAID]" })
              .eq("id", uid);
          }
        }
      }
    } catch {
      // ignore network error
    }

    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        const bc = new BroadcastChannel("restocash_self_orders_bc");
        bc.postMessage({ type: "ORDER_COMPLETED_BY_CASHIER", payload: {} });
        bc.close();
      } catch {
        // ignore
      }
    }
  }

  public completeCashierOrder(params: {
    orderId?: string | null;
    kitchenOrderId?: string | null;
    tableId?: string | null;
    tableNumber?: number | null;
  }) {
    const { orderId, kitchenOrderId, tableId, tableNumber } = params;
    const removedIds: string[] = [];
    if (orderId) removedIds.push(orderId);
    if (kitchenOrderId) removedIds.push(kitchenOrderId);

    let resolvedTableId = tableId || null;
    let resolvedTableNumber = tableNumber ?? null;

    this.orders = this.orders.filter((o) => {
      const match =
        (orderId && (o.id === orderId || o.kitchenOrderId === orderId)) ||
        (kitchenOrderId && (o.id === kitchenOrderId || o.kitchenOrderId === kitchenOrderId)) ||
        (tableId && o.table_id === tableId) ||
        (tableNumber &&
          Number(tableNumber) > 0 &&
          Number(tableNumber) !== 999 &&
          Number(o.table_number) === Number(tableNumber));
      if (match) {
        if (o.id) removedIds.push(o.id);
        if (o.kitchenOrderId) removedIds.push(o.kitchenOrderId);
        if (!resolvedTableId && o.table_id) resolvedTableId = o.table_id;
        if ((!resolvedTableNumber || resolvedTableNumber === 999) && o.table_number) {
          resolvedTableNumber = o.table_number;
        }
        return false;
      }
      return true;
    });
    this.markIdsCancelled(removedIds);
    this.writeTablePaymentStatus(
      { tableId: resolvedTableId, tableNumber: resolvedTableNumber },
      "paid",
      false,
    );
    this.saveState();
    this.notify();

    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        const bc = new BroadcastChannel("restocash_self_orders_bc");
        bc.postMessage({
          type: "ORDER_COMPLETED_BY_CASHIER",
          payload: params,
        });
        bc.close();
      } catch {
        // ignore BroadcastChannel error
      }
    }
  }

  public clearAll() {
    void this.clearAllPendingOrders();
  }

  private syncCustomerHistoryTimestamps(order: TableOrder) {
    try {
      if (typeof window === "undefined" || typeof localStorage === "undefined") return;
      const raw = localStorage.getItem("customer_self_orders_history_v1");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      let dirty = false;
      const updated = parsed.map((entry: any) => {
        if (
          entry?.id === order.id ||
          (order.kitchenOrderId && entry?.id === order.kitchenOrderId)
        ) {
          dirty = true;
          const nextStatus = order.delivered_at
            ? "served"
            : order.ready_at || order.kitchenCompleted
              ? "ready"
              : order.sentToKitchen
                ? "preparing"
                : entry.status;
          return {
            ...entry,
            status: nextStatus,
            submitted_at: entry.submitted_at || order.submitted_at || entry.created_at,
            captain_confirmed_at: entry.captain_confirmed_at || order.captain_confirmed_at || null,
            kitchen_started_at: entry.kitchen_started_at || order.kitchen_started_at || null,
            ready_at: entry.ready_at || order.ready_at || null,
            delivered_at: entry.delivered_at || order.delivered_at || null,
          };
        }
        return entry;
      });
      if (dirty) {
        localStorage.setItem("customer_self_orders_history_v1", JSON.stringify(updated));
        window.dispatchEvent(new Event("customer_self_orders_updated"));
      }
    } catch {
      // ignore localStorage error
    }
  }

  public markKitchenCompletedByTableId(
    tableId?: string | null,
    tableNumber?: number | null,
    orderId?: string | null,
  ) {
    let changed = false;
    const now = new Date().toISOString();
    this.orders.forEach((o) => {
      const matched =
        (tableId && o.table_id === tableId) ||
        (tableNumber &&
          Number(tableNumber) > 0 &&
          Number(tableNumber) !== 999 &&
          Number(o.table_number) === Number(tableNumber)) ||
        (orderId && (o.id === orderId || o.kitchenOrderId === orderId));
      if (matched && o.sentToKitchen && !o.kitchenCompleted) {
        o.kitchenCompleted = true;
        o.ready_at = o.ready_at || now;
        o.updated_at = now;
        this.syncCustomerHistoryTimestamps(o);
        changed = true;
      }
    });
    if (changed) {
      this.saveState();
      this.notify();
    }
  }

  public markDeliveredByOrderOrTable(params: {
    orderId?: string | null;
    tableId?: string | null;
    tableNumber?: number | null;
  }) {
    const now = new Date().toISOString();
    let changed = false;
    this.orders.forEach((o) => {
      const matched =
        (params.orderId && (o.id === params.orderId || o.kitchenOrderId === params.orderId)) ||
        (params.tableId && o.table_id === params.tableId) ||
        (params.tableNumber &&
          Number(params.tableNumber) > 0 &&
          Number(params.tableNumber) !== 999 &&
          Number(o.table_number) === Number(params.tableNumber));
      if (matched) {
        o.delivered_at = o.delivered_at || now;
        o.ready_at = o.ready_at || now;
        o.kitchenCompleted = true;
        o.updated_at = now;
        this.syncCustomerHistoryTimestamps(o);
        changed = true;
      }
    });
    if (changed) {
      this.saveState();
      this.notify();
    }
  }
}

export const tableOrdersStore = new TableOrdersStore();
