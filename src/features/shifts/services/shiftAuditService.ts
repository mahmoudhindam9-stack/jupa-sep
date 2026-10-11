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
      result = result.filter((l) => l.shift_type === options.shiftType);
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

    const relatedTxs = transactions.filter(
      (tx) => tx.shift_id === shiftId || tx.shift_number === shiftNumber,
    );

    const diagnostics: ShiftVisibilityAnalysis["diagnostics"] = [];
    const possibleHiddenReasons: string[] = [];

    // Check 1: Status verification
    if (status === "open") {
      diagnostics.push({
        code: "STATUS_OPEN",
        level: "info",
        message: "حالة الوردية مفتوحة (Open) - تظهر في تبويب الورديات المفتوحة ومودال المبيعات.",
      });
    } else if (status === "closed") {
      diagnostics.push({
        code: "STATUS_CLOSED",
        level: "info",
        message: "حالة الوردية مغلقة (Closed) - تظهر في تبويب الورديات المغلقة وفي تقارير الإقفال.",
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
    if (isPark) {
      grossSalesUsd = relatedTxs
        .filter((t) => t.currency === "USD" && t.status !== "refunded")
        .reduce((sum, t) => sum + (t.total_usd || 0), 0);
      grossSalesSsp = relatedTxs
        .filter((t) => t.currency === "SSP" && t.status !== "refunded")
        .reduce((sum, t) => sum + (t.total_paid_in_currency || 0), 0);
    }

    return {
      shiftId,
      shiftNumber,
      shiftType,
      status,
      isActiveSession,
      isVisibleInOpenView,
      isVisibleInClosedView,
      hasTransactions: relatedTxs.length > 0,
      transactionsCount: relatedTxs.length,
      grossSalesUsd,
      grossSalesSsp,
      totalSalesRest: shift.total_sales,
      diagnostics,
      possibleHiddenReasons,
    };
  }
}

export const shiftAuditService = new ShiftAuditService();
