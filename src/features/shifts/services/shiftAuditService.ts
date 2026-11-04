import { supabase } from "@/integrations/supabase/client";

export type ShiftType = "park" | "restaurant";
export type ShiftAuditAction =
  | "OPEN"
  | "CLOSE"
  | "RESUME"
  | "ACTIVATE"
  | "UPDATE"
  | "DELETE"
  | "AUTO_CREATE"
  | "HEALTH_CHECK"
  | "FILTER_ANOMALY"
  | "VISIBILITY_CHANGE"
  | "RECOVER_STATE";

export interface ShiftAuditLogEntry {
  id: string;
  shift_id: string;
  shift_type: ShiftType;
  shift_number: string;
  auto_shift_number?: string | null;
  action: ShiftAuditAction;
  status_before?: string | null;
  status_after?: string | null;
  cashier_name?: string | null;
  cashier_id?: string | null;
  performed_by?: string | null;
  user_id?: string | null;
  user_email?: string | null;
  details?: string | null;
  metadata?: Record<string, any>;
  client_timestamp: string;
  created_at?: string;
  synced_to_supabase?: boolean;
}

export interface LogShiftActionPayload {
  shift_id: string;
  shift_type: ShiftType;
  shift_number: string;
  auto_shift_number?: string | null;
  action: ShiftAuditAction;
  status_before?: string | null;
  status_after?: string | null;
  cashier_name?: string | null;
  cashier_id?: string | null;
  performed_by?: string | null;
  user_id?: string | null;
  user_email?: string | null;
  details?: string | null;
  metadata?: Record<string, any>;
}

export interface ShiftVisibilityAnalysis {
  shiftId: string;
  shiftNumber: string;
  shiftType: ShiftType;
  status: "open" | "closed" | "unknown";
  isActiveSession: boolean;
  isVisibleInOpenView: boolean;
  isVisibleInClosedView: boolean;
  hasTransactions: boolean;
  transactionsCount: number;
  grossSalesUsd?: number;
  grossSalesSsp?: number;
  totalSalesRest?: number;
  diagnostics: Array<{
    code: string;
    level: "info" | "warning" | "error" | "success";
    message: string;
  }>;
  possibleHiddenReasons: string[];
}

const LOCAL_STORAGE_AUDIT_KEY = "restocash_shift_audit_logs_v1";

class ShiftAuditService {
  private localLogs: ShiftAuditLogEntry[] = [];
  private isInitialized = false;

  constructor() {
    this.initLocalLogs();
  }

  private initLocalLogs() {
    if (this.isInitialized) return;
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_AUDIT_KEY);
        if (stored) {
          this.localLogs = JSON.parse(stored);
        }
      } catch (err) {
        console.warn("Failed to load local shift audit logs:", err);
      }
    }
    this.isInitialized = true;
  }

  private saveLocalLogs() {
    if (typeof window !== "undefined") {
      try {
        // Keep latest 500 records locally to prevent unbounded growth
        const trimmed = this.localLogs.slice(0, 500);
        localStorage.setItem(LOCAL_STORAGE_AUDIT_KEY, JSON.stringify(trimmed));
      } catch (err) {
        console.warn("Failed to save local shift audit logs:", err);
      }
    }
  }

  /**
   * Log a shift action to Supabase and persistent local storage
   */
  async logShiftAction(payload: LogShiftActionPayload): Promise<ShiftAuditLogEntry> {
    this.initLocalLogs();

    const now = new Date();
    const nowIso = now.toISOString();
    const entryId = `sal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const logEntry: ShiftAuditLogEntry = {
      id: entryId,
      shift_id: payload.shift_id,
      shift_type: payload.shift_type,
      shift_number: payload.shift_number,
      auto_shift_number: payload.auto_shift_number || null,
      action: payload.action,
      status_before: payload.status_before || null,
      status_after: payload.status_after || null,
      cashier_name: payload.cashier_name || null,
      cashier_id: payload.cashier_id || null,
      performed_by: payload.performed_by || payload.cashier_name || "المستخدم الحالي",
      user_id: payload.user_id || null,
      user_email: payload.user_email || null,
      details: payload.details || null,
      metadata: payload.metadata || {},
      client_timestamp: nowIso,
      created_at: nowIso,
      synced_to_supabase: false,
    };

    // Prepend to local memory and persistent storage immediately
    this.localLogs.unshift(logEntry);
    this.saveLocalLogs();

    // Asynchronously sync to Supabase shift_audit_logs table
    try {
      const { data, error } = await supabase.from("shift_audit_logs").insert([
        {
          shift_id: logEntry.shift_id,
          shift_type: logEntry.shift_type,
          shift_number: logEntry.shift_number,
          auto_shift_number: logEntry.auto_shift_number,
          action: logEntry.action,
          status_before: logEntry.status_before,
          status_after: logEntry.status_after,
          cashier_name: logEntry.cashier_name,
          cashier_id: logEntry.cashier_id,
          performed_by: logEntry.performed_by,
          user_id: logEntry.user_id,
          user_email: logEntry.user_email,
          details: logEntry.details,
          metadata: logEntry.metadata as any,
          client_timestamp: logEntry.client_timestamp,
        },
      ]);

      if (error) {
        // Table might not be migrated yet or permissions require authenticated user
        console.info(
          `[ShiftAuditLog] Supabase insert note: ${error.message} (preserved in persistent local ledger)`,
        );
      } else {
        logEntry.synced_to_supabase = true;
        this.saveLocalLogs();
      }
    } catch (err: any) {
      console.warn("[ShiftAuditLog] Supabase network notice:", err?.message || err);
    }

    return logEntry;
  }

  /**
   * Fetch shift audit logs from Supabase with local fallback
   */
  async getShiftAuditLogs(options?: {
    shiftId?: string;
    shiftType?: ShiftType;
    action?: string;
    searchQuery?: string;
    startDate?: string;
    endDate?: string;
    userFilter?: string;
    limit?: number;
  }): Promise<{ logs: ShiftAuditLogEntry[]; source: "supabase" | "local" | "hybrid" }> {
    this.initLocalLogs();
    const limit = options?.limit || 200;

    let supabaseLogs: ShiftAuditLogEntry[] = [];
    let fetchSucceeded = false;

    try {
      let query = supabase
        .from("shift_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (options?.shiftId) {
        query = query.eq("shift_id", options.shiftId);
      }
      if (options?.shiftType) {
        query = query.eq("shift_type", options.shiftType);
      }
      if (options?.action && options.action !== "ALL") {
        query = query.eq("action", options.action);
      }
      if (options?.startDate) {
        query = query.gte("client_timestamp", `${options.startDate}T00:00:00.000Z`);
      }
      if (options?.endDate) {
        query = query.lte("client_timestamp", `${options.endDate}T23:59:59.999Z`);
      }

      const { data, error } = await query;

      if (!error && Array.isArray(data)) {
        supabaseLogs = data.map((item: any) => ({
          ...item,
          synced_to_supabase: true,
        }));
        fetchSucceeded = true;
      }
    } catch {
      fetchSucceeded = false;
    }

    // Merge Supabase logs with any local logs not yet in Supabase
    const mergedMap = new Map<string, ShiftAuditLogEntry>();

    // Add Supabase logs first
    supabaseLogs.forEach((l) => {
      const key = `${l.shift_id}-${l.action}-${l.client_timestamp || l.created_at}`;
      mergedMap.set(key, l);
    });

    // Add local logs that might be pending or offline
    this.localLogs.forEach((l) => {
      const key = `${l.shift_id}-${l.action}-${l.client_timestamp || l.created_at}`;
      if (!mergedMap.has(key)) {
        mergedMap.set(key, l);
      }
    });

    let result = Array.from(mergedMap.values());

    // Apply client filters if requested
    if (options?.shiftId) {
      result = result.filter((l) => l.shift_id === options.shiftId);
    }
    if (options?.shiftType) {
      const targetType = String(options.shiftType).toLowerCase();
      result = result.filter((l) => String(l.shift_type || "").toLowerCase() === targetType);
    }
    if (options?.action && options.action !== "ALL") {
      result = result.filter((l) => l.action === options.action);
    }
    if (options?.startDate) {
      result = result.filter((l) => {
        const d = (l.client_timestamp || l.created_at || "").slice(0, 10);
        return d >= options.startDate!;
      });
    }
    if (options?.endDate) {
      result = result.filter((l) => {
        const d = (l.client_timestamp || l.created_at || "").slice(0, 10);
        return d <= options.endDate!;
      });
    }
    if (options?.userFilter && options.userFilter !== "ALL") {
      const u = options.userFilter.toLowerCase();
      result = result.filter((l) => {
        return (
          l.cashier_name?.toLowerCase().includes(u) ||
          l.performed_by?.toLowerCase().includes(u) ||
          l.user_email?.toLowerCase().includes(u)
        );
      });
    }
    if (options?.searchQuery && options.searchQuery.trim()) {
      const q = options.searchQuery.trim().toLowerCase();
      result = result.filter(
        (l) =>
          l.shift_number?.toLowerCase().includes(q) ||
          l.auto_shift_number?.toLowerCase().includes(q) ||
          l.cashier_name?.toLowerCase().includes(q) ||
          l.performed_by?.toLowerCase().includes(q) ||
          l.details?.toLowerCase().includes(q) ||
          l.shift_id?.toLowerCase().includes(q),
      );
    }

    // Sort newest first
    result.sort((a, b) => {
      const timeA = new Date(a.created_at || a.client_timestamp).getTime();
      const timeB = new Date(b.created_at || b.client_timestamp).getTime();
      return timeB - timeA;
    });

    return {
      logs: result.slice(0, limit),
      source: fetchSucceeded ? (supabaseLogs.length > 0 ? "hybrid" : "local") : "local",
    };
  }

  /**
   * Synchronize live Park & Restaurant shifts with local audit logs so no shift is missing from audit history
   */
  syncShiftsWithAuditLogs(parkShifts: any[] = [], restaurantShifts: any[] = []): number {
    this.initLocalLogs();
    const localLogs = this.localLogs;
    let addedCount = 0;

    const ensureShiftLogs = (shift: any, shiftType: ShiftType) => {
      if (!shift || !shift.id) return;
      const hasOpenLog = localLogs.some(
        (l) =>
          l.shift_id === shift.id &&
          (l.action === "OPEN" || l.action === "AUTO_CREATE"),
      );
      if (!hasOpenLog) {
        const openTime = shift.start_at || new Date().toISOString();
        localLogs.push({
          id: `sync-open-${shift.id}`,
          shift_id: shift.id,
          shift_type: shiftType,
          shift_number: shift.shift_number || shift.auto_shift_number || shift.id,
          auto_shift_number: shift.auto_shift_number || null,
          action: "OPEN",
          status_before: null,
          status_after: "open",
          cashier_name: shift.cashier_name || (shiftType === "park" ? "كاشير الحديقة" : "كاشير المطعم"),
          cashier_id: shift.cashier_id || null,
          performed_by: shift.cashier_name || "مزامنة النظام",
          user_email: null,
          details:
            shiftType === "park"
              ? `تم افتتاح وردية تذاكر الحديقة (${shift.shift_number})`
              : `تم افتتاح وردية كاشير المطعم (${shift.shift_number})`,
          metadata: {
            start_at: openTime,
            opening_balance: shift.opening_balance ?? 0,
            notes: shift.notes || shift.opening_notes || "",
            synced_from_store: true,
          },
          client_timestamp: openTime,
          created_at: openTime,
        });
        addedCount++;
      }

      if (shift.status === "closed") {
        const hasCloseLog = localLogs.some(
          (l) => l.shift_id === shift.id && l.action === "CLOSE",
        );
        if (!hasCloseLog) {
          const closeTime = shift.end_at || new Date().toISOString();
          localLogs.push({
            id: `sync-close-${shift.id}`,
            shift_id: shift.id,
            shift_type: shiftType,
            shift_number: shift.shift_number || shift.auto_shift_number || shift.id,
            auto_shift_number: shift.auto_shift_number || null,
            action: "CLOSE",
            status_before: "open",
            status_after: "closed",
            cashier_name: shift.cashier_name || (shiftType === "park" ? "كاشير الحديقة" : "كاشير المطعم"),
            cashier_id: shift.cashier_id || null,
            performed_by: shift.cashier_name || "مزامنة النظام",
            user_email: null,
            details:
              shiftType === "park"
                ? `تم إغلاق وردية تذاكر الحديقة (${shift.shift_number})`
                : `تم إغلاق وردية كاشير المطعم (${shift.shift_number})`,
            metadata: {
              end_at: closeTime,
              orders_count: shift.orders_count,
              total_sales: shift.total_sales,
              total_refunds: shift.total_refunds,
              net_total: shift.net_total,
              synced_from_store: true,
            },
            client_timestamp: closeTime,
            created_at: closeTime,
          });
          addedCount++;
        }
      }
    };

    parkShifts.forEach((s) => ensureShiftLogs(s, "park"));
    restaurantShifts.forEach((s) => ensureShiftLogs(s, "restaurant"));

    if (addedCount > 0) {
      localLogs.sort((a, b) => {
        const timeA = new Date(a.created_at || a.client_timestamp).getTime();
        const timeB = new Date(b.created_at || b.client_timestamp).getTime();
        return timeB - timeA;
      });
      this.saveLocalLogs();
    }

    return addedCount;
  }

  /**
   * Get full state change history for a single shift
   */
  async getShiftHistory(shiftId: string): Promise<ShiftAuditLogEntry[]> {
    const { logs } = await this.getShiftAuditLogs({ shiftId, limit: 100 });
    return logs;
  }

  /**
   * Diagnostic helper: Inspect why a shift might be appearing or hidden
   */
  analyzeShiftVisibility(
    shift: any,
    allShifts: any[],
    activeShift: any | null,
    transactions: any[] = [],
  ): ShiftVisibilityAnalysis {
    const shiftId = shift.id || "";
    const shiftNumber = shift.shift_number || shift.auto_shift_number || shiftId;
    const isPark =
      shiftId.startsWith("shift-park-") || !!shift.auto_shift_number?.startsWith("PSH");
    const shiftType: ShiftType = isPark ? "park" : "restaurant";

    const status: "open" | "closed" | "unknown" =
      shift.status === "open" ? "open" : shift.status === "closed" ? "closed" : "unknown";

    const isActiveSession = activeShift?.id === shiftId;

    const isVisibleInOpenView = status === "open";
    const isVisibleInClosedView = status === "closed";

    const relatedTxs = isPark
      ? transactions.filter(
          (tx) => tx.shift_id === shiftId || tx.shift_number === shiftNumber,
        )
      : transactions.filter((tx) => {
          if (tx.shift_id === shiftId || tx.shift_number === shiftNumber) return true;
          const startMs = new Date(shift.start_at || 0).getTime();
          const endMs = shift.end_at ? new Date(shift.end_at).getTime() : Date.now();
          const txMs = new Date(tx.created_at || 0).getTime();
          return txMs >= startMs - 60000 && txMs <= endMs + 60000;
        });

    const diagnostics: ShiftVisibilityAnalysis["diagnostics"] = [];
    const possibleHiddenReasons: string[] = [];

    // Check 1: Status verification
    if (status === "open") {
      diagnostics.push({
        code: "STATUS_OPEN",
        level: "info",
        message: isPark
          ? "حالة وردية الحديقة مفتوحة (Open) - تظهر في بطاقة الورديات المفتوحة ومودال نقطة بيع التذاكر."
          : "حالة وردية المطعم مفتوحة (Open) - تظهر في بطاقة الورديات المفتوحة بصفحة المطعم وشاشة الكاشير.",
      });
    } else if (status === "closed") {
      diagnostics.push({
        code: "STATUS_CLOSED",
        level: "info",
        message: isPark
          ? "حالة وردية الحديقة مغلقة (Closed) - تظهر في سجل الورديات المغلقة وتقارير الإقفال."
          : "حالة وردية المطعم مغلقة (Closed) - تظهر في سجل ورديات المطعم المغلقة وتقارير الإقفال.",
      });
    } else {
      diagnostics.push({
        code: "STATUS_INVALID",
        level: "error",
        message: `حالة الوردية غير اعتيادية: "${shift.status}". يجب أن تكون إما "open" أو "closed".`,
      });
      possibleHiddenReasons.push("قيمة حالة الوردية غير صالحة مما يمنعها من الظهور في أي تبويب");
    }

    // Check 2: Active session pointer consistency
    if (status === "open" && !isActiveSession) {
      diagnostics.push({
        code: "ACTIVE_POINTER_INACTIVE",
        level: "warning",
        message:
          "الوردية مفتوحة ولكنها ليست الوردية النشطة حالياً في الجلسة. (يمكن الدخول إليها بالضغط على زر الدخول للوردية)",
      });
    }

    if (isActiveSession && status === "closed") {
      diagnostics.push({
        code: "ACTIVE_POINTER_MISMATCH",
        level: "error",
        message:
          "تناقض: الوردية معينة كنشطة في الجلسة ولكن حالتها مغلقة! هذا سبب رئيسي لظهور الورديات المغلقة بشكل خاطئ في واجهة نقطة البيع.",
      });
      possibleHiddenReasons.push("الوردية مغلقة ولكن مؤشر الجلسة النشطة ما زال يشير إليها");
    }

    // Check 3: Legacy hardcoded suppression detection ('5' or '7')
    const hasFiveOrSeven =
      String(shiftNumber).includes("5") ||
      String(shiftNumber).includes("7") ||
      String(shift.auto_shift_number || "").includes("5") ||
      String(shift.auto_shift_number || "").includes("7") ||
      String(shiftId).includes("5") ||
      String(shiftId).includes("7");

    if (hasFiveOrSeven) {
      diagnostics.push({
        code: "LEGACY_FILTER_RISK",
        level: "warning",
        message:
          "تحتوي الوردية على الرقم 5 أو 7. في الإصدارات القديمة كان هناك فلتر خاطئ يستبعد أي وردية تحتوي على هذه الأرقام وتم إصلاحه الآن بالكامل.",
      });
    }

    // Check 4: Duplicate numbers
    const duplicates = allShifts.filter(
      (s) =>
        s.id !== shiftId &&
        (s.shift_number === shiftNumber ||
          (s.auto_shift_number && s.auto_shift_number === shift.auto_shift_number)),
    );
    if (duplicates.length > 0) {
      diagnostics.push({
        code: "DUPLICATE_NUMBER",
        level: "warning",
        message: `يوجد ${duplicates.length} وردية أخرى بنفس رقم الوردية! قد يؤدي ذلك إلى اختفاء أو تداخل البيانات.`,
      });
      possibleHiddenReasons.push("تطابق أرقام الورديات مع وردية أخرى سابقة");
    }

    // Check 5: Financial integrity
    let grossSalesUsd = 0;
    let grossSalesSsp = 0;
    let totalSalesRest = Number(shift.total_sales || 0);
    let transactionsCount = relatedTxs.length;

    if (isPark) {
      grossSalesUsd = relatedTxs
        .filter((t) => t.currency === "USD" && t.status !== "refunded")
        .reduce((sum, t) => sum + (t.total_usd || 0), 0);
      grossSalesSsp = relatedTxs
        .filter((t) => t.currency === "SSP" && t.status !== "refunded")
        .reduce((sum, t) => sum + (t.total_paid_in_currency || 0), 0);
    } else {
      const computedOrdersTotal = relatedTxs.reduce(
        (sum, o) => sum + Number(o.total || 0),
        0,
      );
      if (totalSalesRest <= 0 && computedOrdersTotal > 0) {
        totalSalesRest = computedOrdersTotal;
      }
      if ((shift.orders_count || 0) > transactionsCount) {
        transactionsCount = Number(shift.orders_count || 0);
      }
    }

    return {
      shiftId,
      shiftNumber,
      shiftType,
      status,
      isActiveSession,
      isVisibleInOpenView,
      isVisibleInClosedView,
      hasTransactions: transactionsCount > 0,
      transactionsCount,
      grossSalesUsd,
      grossSalesSsp,
      totalSalesRest,
      diagnostics,
      possibleHiddenReasons,
    };
  }

  /**
   * Synchronizes open shifts from Supabase shift_audit_logs into erpStore
   * so that if a cashier opens a shift, logs out, or switches browsers,
   * their open shift is automatically detected and restored.
   */
  async syncOpenShiftsFromSupabase(erpStoreInstance: any): Promise<boolean> {
    if (!erpStoreInstance || !erpStoreInstance.state) return false;
    try {
      const { logs } = await this.getShiftAuditLogs({ limit: 300 });
      if (!logs || logs.length === 0) return false;

      // Group logs by shift_id in chronological order (oldest to newest)
      const byShiftId = new Map<string, ShiftAuditLogEntry[]>();
      const chronological = [...logs].sort(
        (a, b) =>
          new Date(a.client_timestamp || a.created_at || 0).getTime() -
          new Date(b.client_timestamp || b.created_at || 0).getTime(),
      );

      for (const entry of chronological) {
        if (!entry.shift_id || entry.shift_id === "all-park-reset") continue;
        const arr = byShiftId.get(entry.shift_id) || [];
        arr.push(entry);
        byShiftId.set(entry.shift_id, arr);
      }

      let changed = false;
      const existingRestIds = new Set(
        (erpStoreInstance.state.restaurantShifts || []).map((s: any) => s.id),
      );
      const existingParkIds = new Set(
        (erpStoreInstance.state.parkShifts || []).map((s: any) => s.id),
      );

      for (const [shiftId, history] of byShiftId.entries()) {
        const latest = history[history.length - 1];
        const openLog = history.find((h) => h.action === "OPEN" || h.action === "AUTO_CREATE") || latest;
        const isClosedOrDeleted =
          latest.action === "CLOSE" ||
          latest.action === "DELETE" ||
          latest.status_after === "closed" ||
          latest.status_after === "deleted";

        if (isClosedOrDeleted) {
          // If local state still thinks it's open, mark it closed
          if (latest.shift_type === "restaurant") {
            const localShift = (erpStoreInstance.state.restaurantShifts || []).find(
              (s: any) => s.id === shiftId,
            );
            if (localShift && localShift.status === "open" && latest.action === "CLOSE") {
              localShift.status = "closed";
              localShift.end_at =
                (latest.metadata as any)?.end_at ||
                latest.client_timestamp ||
                latest.created_at ||
                new Date().toISOString();
              if (erpStoreInstance.state.restaurantActiveShift?.id === shiftId) {
                erpStoreInstance.state.restaurantActiveShift = null;
              }
              changed = true;
            }
          } else if (latest.shift_type === "park") {
            const localShift = (erpStoreInstance.state.parkShifts || []).find(
              (s: any) => s.id === shiftId,
            );
            if (localShift && localShift.status === "open" && latest.action === "CLOSE") {
              localShift.status = "closed";
              localShift.end_at =
                (latest.metadata as any)?.end_at ||
                latest.client_timestamp ||
                latest.created_at ||
                new Date().toISOString();
              if (erpStoreInstance.state.parkActiveShift?.id === shiftId) {
                erpStoreInstance.state.parkActiveShift = null;
              }
              changed = true;
            }
          }
          continue;
        }

        const meta = (openLog.metadata || {}) as Record<string, any>;
        if (openLog.shift_type === "restaurant" && !existingRestIds.has(shiftId)) {
          const reconstructedRestShift = {
            id: shiftId,
            auto_shift_number: openLog.auto_shift_number || undefined,
            shift_number: openLog.shift_number,
            start_at:
              meta.start_at ||
              openLog.client_timestamp ||
              openLog.created_at ||
              new Date().toISOString(),
            status: "open" as const,
            cashier_name: openLog.cashier_name || "كاشير المطعم",
            cashier_id: openLog.cashier_id || meta.cashier_id || openLog.user_id || undefined,
            cashier_username: meta.cashier_username || openLog.performed_by || undefined,
            cashier_type: meta.cashier_type || "account",
            currency: meta.currency || "EGP",
            exchange_rate: Number(meta.exchange_rate || 1),
            opening_balance: Number(meta.opening_balance || 0),
            opening_notes: meta.opening_notes || meta.notes || undefined,
            notes: meta.notes || meta.opening_notes || undefined,
            generated_journal_refs: [],
            orders_count: 0,
            total_sales: 0,
            total_tax: 0,
            total_discount: 0,
            total_service_fee: 0,
            total_delivery_fee: 0,
            total_refunds: 0,
            net_total: 0,
            payment_breakdown: { cash: 0, card: 0, wallet: 0 },
          };
          erpStoreInstance.state.restaurantShifts = [
            reconstructedRestShift,
            ...(erpStoreInstance.state.restaurantShifts || []),
          ];
          existingRestIds.add(shiftId);
          changed = true;
        } else if (openLog.shift_type === "park" && !existingParkIds.has(shiftId)) {
          const reconstructedParkShift = {
            id: shiftId,
            auto_shift_number: openLog.auto_shift_number || undefined,
            shift_number: openLog.shift_number,
            start_at:
              meta.start_at ||
              openLog.client_timestamp ||
              openLog.created_at ||
              new Date().toISOString(),
            status: "open" as const,
            cashier_name: openLog.cashier_name || "أمين الصندوق",
            cashier_id: openLog.cashier_id || meta.cashier_id || openLog.user_id || undefined,
            cashier_username: meta.cashier_username || openLog.performed_by || undefined,
            cashier_type: meta.cashier_type || "account",
            currency: meta.currency || "USD",
            exchange_rate: Number(meta.exchange_rate || 1),
            opening_balance: Number(meta.opening_balance || 0),
            opening_notes: meta.opening_notes || meta.notes || undefined,
            notes: meta.notes || meta.opening_notes || undefined,
          };
          erpStoreInstance.state.parkShifts = [
            reconstructedParkShift,
            ...(erpStoreInstance.state.parkShifts || []),
          ];
          existingParkIds.add(shiftId);
          changed = true;
        }
      }

      if (changed) {
        const identity = erpStoreInstance.resolveCurrentActorIdentity?.();
        if (identity?.isCashier) {
          erpStoreInstance.state.restaurantActiveShift =
            erpStoreInstance.getCashierOpenRestaurantShift();
          erpStoreInstance.state.parkActiveShift = erpStoreInstance.getCashierOpenParkShift();
        }
        erpStoreInstance.saveState?.();
        erpStoreInstance.notify?.();
      }
      return changed;
    } catch {
      return false;
    }
  }
}

export const shiftAuditService = new ShiftAuditService();

