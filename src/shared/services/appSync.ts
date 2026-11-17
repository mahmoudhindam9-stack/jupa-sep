import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { erpStore } from "./erpStore";
import {
  addDeletedUsername,
  pullUsersDirectorySnapshotFromSupabase,
  pushUsersDirectorySnapshotToSupabase,
  readDeletedUsernames,
  syncPendingUserChanges,
  syncUsersDirectoryWithDatabase,
} from "@/features/auth/services/userDirectorySync";
import { notifyPermissionsUpdated } from "./userAuthorization";

const SYNC_EVENT = "restocash-data-sync";
const SYNC_STORAGE_KEY = "restocash_sync_pulse";
const LIVE_SYNC_CHANNEL_NAME = "restocash-live-sync";
const GLOBAL_ERP_STATE_ROW_ID = "global_erp_state";

let activeQueryClient: QueryClient | null = null;
let liveChannel: ReturnType<typeof supabase.channel> | null = null;
let isApplyingRemoteState = false;
let isSyncingNow = false;
let lastSyncAtIso: string | null = null;
let isRealtimeSubscribed = false;
let hasCloudSession = false;

const CLIENT_INSTANCE_ID =
  typeof window !== "undefined"
    ? `rc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    : "server";

export interface AppSyncStatus {
  connected: boolean;
  hasCloudSession: boolean;
  isSyncing: boolean;
  lastSyncAt: string | null;
  mode: "cloud+realtime" | "realtime" | "local";
}

function emitSyncStatusChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("restocash-sync-status", {
      detail: getAppSyncStatus(),
    }),
  );
}

export function getAppSyncStatus(): AppSyncStatus {
  return {
    connected: isRealtimeSubscribed || hasCloudSession,
    hasCloudSession,
    isSyncing: isSyncingNow,
    lastSyncAt: lastSyncAtIso,
    mode: hasCloudSession
      ? "cloud+realtime"
      : isRealtimeSubscribed
        ? "realtime"
        : "local",
  };
}

function mergeById<T extends { id?: string }>(
  localList: T[] = [],
  remoteList: T[] = [],
  deletedIds: Set<string> = new Set(),
  timestampExtractor?: (item: T) => number,
): T[] {
  const map = new Map<string, T>();
  for (const item of localList) {
    if (!item || !item.id) continue;
    const id = String(item.id);
    if (deletedIds.has(id)) continue;
    map.set(id, item);
  }
  for (const item of remoteList) {
    if (!item || !item.id) continue;
    const id = String(item.id);
    if (deletedIds.has(id)) continue;
    const existing = map.get(id);
    if (!existing) {
      map.set(id, item);
    } else if (timestampExtractor) {
      const localTs = timestampExtractor(existing);
      const remoteTs = timestampExtractor(item);
      if (remoteTs >= localTs) {
        map.set(id, { ...existing, ...item });
      }
    } else {
      map.set(id, { ...existing, ...item });
    }
  }
  return Array.from(map.values());
}

function buildCompactErpPayload() {
  const state = erpStore.getState() as any;
  let localOrders: any[] = [];
  if (typeof window !== "undefined") {
    try {
      localOrders = JSON.parse(window.localStorage.getItem("pos_local_orders") || "[]");
    } catch {
      localOrders = [];
    }
  }

  return {
    _updatedAt: state._updatedAt || Date.now(),
    employees: state.employees || [],
    deletedEmployeeIds: state.deletedEmployeeIds || [],
    users: state.users || [],
    userPermissions: state.userPermissions || {},
    deletedUsernames: Array.from(readDeletedUsernames()),
    attendance: state.attendance || [],
    loans: state.loans || [],
    payrolls: state.payrolls || [],
    restaurantShifts: state.restaurantShifts || [],
    parkShifts: state.parkShifts || [],
    parkTicketTransactions: state.parkTicketTransactions || [],
    parkGames: state.parkGames || [],
    vouchers: state.vouchers || [],
    journalEntries: state.journalEntries || [],
    deletedJournalEntries: state.deletedJournalEntries || [],
    treasuries: state.treasuries || [],
    treasuryTransactions: state.treasuryTransactions || [],
    auditLogs: (state.auditLogs || []).slice(0, 300),
    salesInvoices: state.salesInvoices || [],
    purchaseInvoices: state.purchaseInvoices || [],
    inventoryItems: state.inventoryItems || [],
    menuRecipes: state.menuRecipes || [],
    localOrders: Array.isArray(localOrders) ? localOrders.slice(0, 200) : [],
  };
}

function applyIncomingErpPayload(
  incoming: Record<string, any> | null | undefined,
  options?: { persistToCloudIfAuthenticated?: boolean },
): boolean {
  if (!incoming || typeof incoming !== "object") return false;
  if (typeof window === "undefined") return false;

  isApplyingRemoteState = true;
  try {
    const current = erpStore.getState() as any;

    // 1. Deleted tombstones (Users & Employees & Journal Entries)
    const deletedUsernames = readDeletedUsernames();
    if (Array.isArray(incoming.deletedUsernames)) {
      for (const uname of incoming.deletedUsernames) {
        if (typeof uname === "string" && uname.trim()) {
          addDeletedUsername(uname);
          deletedUsernames.add(uname.trim().toLowerCase());
        }
      }
    }

    const deletedEmpIds = new Set<string>([
      ...(Array.isArray(current.deletedEmployeeIds) ? current.deletedEmployeeIds : []),
      ...(Array.isArray(incoming.deletedEmployeeIds) ? incoming.deletedEmployeeIds : []),
    ]);

    const deletedJournalIds = new Set<string>([
      ...(Array.isArray(current.deletedJournalEntries)
        ? current.deletedJournalEntries.map((e: any) => String(e.id))
        : []),
      ...(Array.isArray(incoming.deletedJournalEntries)
        ? incoming.deletedJournalEntries.map((e: any) => String(e.id))
        : []),
    ]);

    // 2. Merge Employees (HR)
    const mergedEmployees = Array.isArray(incoming.employees)
      ? mergeById(
          current.employees || [],
          incoming.employees,
          deletedEmpIds,
          (e: any) => new Date(e?.updated_at || e?.hire_date || 0).getTime() || 0,
        )
      : (current.employees || []).filter((e: any) => !deletedEmpIds.has(String(e.id)));

    // 3. Merge Users & Permissions
    let mergedUsers = Array.isArray(current.users) ? [...current.users] : [];
    if (Array.isArray(incoming.users)) {
      const byUsername = new Map<string, any>();
      for (const u of mergedUsers) {
        const uname = String(u?.username || "").trim().toLowerCase();
        if (!uname || deletedUsernames.has(uname)) continue;
        byUsername.set(uname, u);
      }
      for (const u of incoming.users) {
        const uname = String(u?.username || "").trim().toLowerCase();
        if (!uname || deletedUsernames.has(uname)) continue;
        const existing = byUsername.get(uname);
        byUsername.set(uname, existing ? { ...existing, ...u } : u);
      }
      mergedUsers = Array.from(byUsername.values());
    } else {
      mergedUsers = mergedUsers.filter(
        (u: any) => !deletedUsernames.has(String(u?.username || "").trim().toLowerCase()),
      );
    }

    const mergedUserPermissions: Record<string, any> = {
      ...(current.userPermissions || {}),
      ...(incoming.userPermissions || {}),
    };
    for (const uname of deletedUsernames) {
      delete mergedUserPermissions[uname];
    }

    // 4. Merge Shifts, Tickets, Vouchers, Journals, AuditLogs
    const mergedRestaurantShifts = Array.isArray(incoming.restaurantShifts)
      ? mergeById(current.restaurantShifts || [], incoming.restaurantShifts)
      : current.restaurantShifts || [];

    const mergedParkShifts = Array.isArray(incoming.parkShifts)
      ? mergeById(current.parkShifts || [], incoming.parkShifts)
      : current.parkShifts || [];

    // For parkTicketTransactions: if remote explicitly voided/removed a ticket (recorded in incoming auditLogs as VOID), respect removal
    const voidedTargetIds = new Set<string>();
    const combinedAuditLogs = mergeById(
      current.auditLogs || [],
      Array.isArray(incoming.auditLogs) ? incoming.auditLogs : [],
    ).sort(
      (a: any, b: any) =>
        new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime(),
    );

    for (const log of combinedAuditLogs) {
      if ((log as any)?.actionType === "VOID" && (log as any)?.targetId) {
        voidedTargetIds.add(String((log as any).targetId));
      }
    }

    const mergedParkTickets = Array.isArray(incoming.parkTicketTransactions)
      ? mergeById(
          current.parkTicketTransactions || [],
          incoming.parkTicketTransactions,
          voidedTargetIds,
        )
      : (current.parkTicketTransactions || []).filter(
          (tx: any) => !voidedTargetIds.has(String(tx.id)),
        );

    const mergedVouchers = Array.isArray(incoming.vouchers)
      ? mergeById(current.vouchers || [], incoming.vouchers)
      : current.vouchers || [];

    const mergedDeletedJournalEntries = Array.isArray(incoming.deletedJournalEntries)
      ? mergeById(current.deletedJournalEntries || [], incoming.deletedJournalEntries)
      : current.deletedJournalEntries || [];

    const mergedJournalEntries = Array.isArray(incoming.journalEntries)
      ? mergeById(
          current.journalEntries || [],
          incoming.journalEntries,
          deletedJournalIds,
        )
      : (current.journalEntries || []).filter(
          (j: any) => !deletedJournalIds.has(String(j.id)),
        );

    const mergedAttendance = Array.isArray(incoming.attendance)
      ? mergeById(current.attendance || [], incoming.attendance)
      : current.attendance || [];

    const mergedLoans = Array.isArray(incoming.loans)
      ? mergeById(current.loans || [], incoming.loans)
      : current.loans || [];

    const mergedPayrolls = Array.isArray(incoming.payrolls)
      ? mergeById(current.payrolls || [], incoming.payrolls)
      : current.payrolls || [];

    const mergedTreasuryTransactions = Array.isArray(incoming.treasuryTransactions)
      ? mergeById(current.treasuryTransactions || [], incoming.treasuryTransactions)
      : current.treasuryTransactions || [];

    const mergedTreasuries = Array.isArray(incoming.treasuries)
      ? mergeById(current.treasuries || [], incoming.treasuries)
      : current.treasuries || [];

    const mergedSalesInvoices = Array.isArray(incoming.salesInvoices)
      ? mergeById(
          current.salesInvoices || [],
          incoming.salesInvoices,
          voidedTargetIds,
        )
      : (current.salesInvoices || []).filter(
          (inv: any) => !voidedTargetIds.has(String(inv.id)),
        );

    // Merge pos_local_orders if provided
    if (Array.isArray(incoming.localOrders)) {
      try {
        const existingLocalOrders = JSON.parse(
          window.localStorage.getItem("pos_local_orders") || "[]",
        );
        const mergedOrders = mergeById(
          Array.isArray(existingLocalOrders) ? existingLocalOrders : [],
          incoming.localOrders,
          voidedTargetIds,
        );
        window.localStorage.setItem("pos_local_orders", JSON.stringify(mergedOrders));
      } catch {
        // ignore
      }
    }

    const nextState = {
      ...current,
      _updatedAt: Math.max(
        Number(current._updatedAt || 0),
        Number(incoming._updatedAt || Date.now()),
      ),
      employees: mergedEmployees,
      deletedEmployeeIds: Array.from(deletedEmpIds),
      users: mergedUsers,
      userPermissions: mergedUserPermissions,
      attendance: mergedAttendance,
      loans: mergedLoans,
      payrolls: mergedPayrolls,
      restaurantShifts: mergedRestaurantShifts,
      parkShifts: mergedParkShifts,
      parkTicketTransactions: mergedParkTickets,
      vouchers: mergedVouchers,
      journalEntries: mergedJournalEntries,
      deletedJournalEntries: mergedDeletedJournalEntries,
      treasuries: mergedTreasuries,
      treasuryTransactions: mergedTreasuryTransactions,
      auditLogs: combinedAuditLogs.slice(0, 500),
      salesInvoices: mergedSalesInvoices,
    };

    erpStore.state = nextState;
    if (typeof erpStore.recalculateAccountBalances === "function") {
      erpStore.recalculateAccountBalances();
    }
    window.localStorage.setItem("erp_store_state", JSON.stringify(erpStore.state));
    erpStore.notify();
    notifyPermissionsUpdated();
    window.dispatchEvent(new Event("erp-state-updated"));
    window.dispatchEvent(new Event("restocash-user-sync-updated"));
    if (activeQueryClient) {
      activeQueryClient.invalidateQueries();
    }

    if (options?.persistToCloudIfAuthenticated) {
      void pushGlobalErpStateToSupabase();
    }

    return true;
  } catch (err) {
    console.warn("[AppSync] Failed to apply incoming ERP payload:", err);
    return false;
  } finally {
    isApplyingRemoteState = false;
  }
}

async function pushGlobalErpStateToSupabase(): Promise<boolean> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    hasCloudSession = Boolean(session?.user?.id);
    if (!session?.user?.id) return false;

    const payload = buildCompactErpPayload();
    const { error } = await (supabase as any).from("erp_store_state").upsert(
      {
        id: GLOBAL_ERP_STATE_ROW_ID,
        state: payload,
        updated_at: new Date().toISOString(),
        updated_by: session.user.id,
      },
      { onConflict: "id" },
    );
    return !error;
  } catch {
    return false;
  }
}

async function pullGlobalErpStateFromSupabase(): Promise<boolean> {
  try {
    const { data, error } = await (supabase as any)
      .from("erp_store_state")
      .select("id, state, updated_at")
      .in("id", [GLOBAL_ERP_STATE_ROW_ID, "default", "users_directory_v1"]);

    if (error || !Array.isArray(data) || data.length === 0) {
      return false;
    }

    const globalRow =
      data.find((r: any) => r.id === GLOBAL_ERP_STATE_ROW_ID) ||
      data.find((r: any) => r.id === "default");
    const usersRow = data.find((r: any) => r.id === "users_directory_v1");

    let applied = false;
    if (globalRow?.state && typeof globalRow.state === "object") {
      applied = applyIncomingErpPayload(globalRow.state) || applied;
    }
    if (usersRow?.state && typeof usersRow.state === "object") {
      applied = applyIncomingErpPayload(usersRow.state) || applied;
    }
    return applied;
  } catch {
    return false;
  }
}

async function sendRealtimeBroadcast(
  event: "erp_sync" | "hr_users_sync" | "sync_request",
  payload: Record<string, any>,
): Promise<boolean> {
  if (!liveChannel || !isRealtimeSubscribed) return false;
  try {
    const resp = await liveChannel.send({
      type: "broadcast",
      event,
      payload: {
        ...payload,
        clientId: CLIENT_INSTANCE_ID,
        sentAt: new Date().toISOString(),
      },
    });
    return resp === "ok";
  } catch {
    return false;
  }
}

/**
 * Performs an immediate full bidirectional synchronization across:
 * 1. Pending user queue -> Supabase RPCs & profiles
 * 2. Users Directory & HR Employees -> Supabase `shift_audit_logs` & `erp_store_state`
 * 3. Full ERP Store State -> Supabase `erp_store_state`
 * 4. Instant Realtime Broadcast (`restocash-live-sync`) to all open Vercel / Preview tabs
 */
export async function syncNowWithCloud(options?: { manual?: boolean }) {
  if (isSyncingNow && !options?.manual) {
    return {
      ok: true,
      mode: getAppSyncStatus().mode,
      usersCount: erpStore.getUsers().length,
      employeesCount: (erpStore.getState().employees || []).length,
      syncedPendingUsers: 0,
      timestamp: lastSyncAtIso || new Date().toISOString(),
    };
  }

  isSyncingNow = true;
  emitSyncStatusChanged();

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    hasCloudSession = Boolean(session?.user?.id);

    // 1. Flush any pending user mutations
    const pendingSummary = await syncPendingUserChanges().catch(() => ({
      syncedCount: 0,
      remainingCount: 0,
    }));

    // 2. Sync Users Directory & HR Employees with Supabase
    await syncUsersDirectoryWithDatabase().catch(() => null);
    const remoteDirSnapshot = await pullUsersDirectorySnapshotFromSupabase().catch(() => null);
    if (remoteDirSnapshot) {
      applyIncomingErpPayload({
        users: remoteDirSnapshot.users,
        userPermissions: remoteDirSnapshot.userPermissions,
        employees: remoteDirSnapshot.employees,
        deletedUsernames: remoteDirSnapshot.deletedUsernames,
        deletedEmployeeIds: remoteDirSnapshot.deletedEmployeeIds,
      });
    }

    // 3. Pull & Push global ERP state on `public.erp_store_state`
    await pullGlobalErpStateFromSupabase();
    await pushGlobalErpStateToSupabase();
    await pushUsersDirectorySnapshotToSupabase(
      erpStore.getUsers(),
      erpStore.getState().userPermissions,
    ).catch(() => false);

    // 4. Broadcast full compact payload over Supabase Realtime so all connected Vercel/Preview clients sync in <100ms
    const compactPayload = buildCompactErpPayload();
    await sendRealtimeBroadcast("erp_sync", compactPayload);

    if (options?.manual) {
      await sendRealtimeBroadcast("sync_request", { reason: "manual_version_button" });
    }

    lastSyncAtIso = new Date().toISOString();
    broadcastAppSync();
    notifyPermissionsUpdated();

    if (activeQueryClient) {
      activeQueryClient.invalidateQueries();
    }

    return {
      ok: true,
      mode: getAppSyncStatus().mode,
      usersCount: erpStore.getUsers().length,
      employeesCount: (erpStore.getState().employees || []).length,
      syncedPendingUsers: pendingSummary.syncedCount,
      timestamp: lastSyncAtIso,
    };
  } finally {
    isSyncingNow = false;
    emitSyncStatusChanged();
  }
}

/**
 * One lightweight synchronization bridge for every screen in the ERP.
 * It keeps React Query, the local ERP store, Supabase PostgreSQL, and Realtime Broadcast in step.
 */
export function createAppSync(queryClient: QueryClient) {
  if (typeof window === "undefined") return () => {};

  activeQueryClient = queryClient;
  let lastPulse = "";
  let pushDebounceTimer: number | null = null;

  const reloadLocalErpState = () => {
    if (isApplyingRemoteState) return;
    try {
      const raw = window.localStorage.getItem("erp_store_state");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const memoryUpdated = (erpStore.state as any)?._updatedAt || 0;
        const parsedUpdated = parsed._updatedAt || 0;

        if (memoryUpdated > parsedUpdated) {
          return;
        }

        erpStore.state = {
          ...erpStore.getDefaultState(),
          ...parsed,
          auditLogs:
            (erpStore.state?.auditLogs?.length || 0) > (parsed.auditLogs?.length || 0)
              ? erpStore.state.auditLogs
              : parsed.auditLogs || [],
        };
        if (typeof erpStore.recalculateAccountBalances === "function") {
          erpStore.recalculateAccountBalances();
        }
        erpStore.notify();
      }
    } catch (error) {
      console.warn("[AppSync] ERP state refresh failed", error);
    }
  };

  const refresh = () => {
    reloadLocalErpState();
    queryClient.invalidateQueries();
    window.dispatchEvent(new Event("erp-state-updated"));
  };

  const scheduleCloudAndRealtimePush = () => {
    if (isApplyingRemoteState) return;
    if (pushDebounceTimer !== null) {
      window.clearTimeout(pushDebounceTimer);
    }
    pushDebounceTimer = window.setTimeout(() => {
      pushDebounceTimer = null;
      const payload = buildCompactErpPayload();
      void sendRealtimeBroadcast("erp_sync", payload);
      void pushGlobalErpStateToSupabase();
      void pushUsersDirectorySnapshotToSupabase(
        erpStore.getUsers(),
        erpStore.getState().userPermissions,
      );
      lastSyncAtIso = new Date().toISOString();
      emitSyncStatusChanged();
    }, 250);
  };

  const onUsersDirectoryBroadcast = (event: Event) => {
    if (isApplyingRemoteState) return;
    const customEvent = event as CustomEvent;
    const detail = customEvent?.detail;
    if (detail && typeof detail === "object") {
      void sendRealtimeBroadcast("hr_users_sync", detail);
    }
  };

  const onStorage = (event: StorageEvent) => {
    if (
      event.key === "erp_store_state" ||
      event.key === "restocash_sync_pulse" ||
      event.key === "pos_local_orders"
    ) {
      refresh();
    }
  };

  const onCustomSync = () => refresh();
  const onFocus = () => {
    refresh();
    void syncNowWithCloud();
  };
  const onVisibility = () => {
    if (document.visibilityState === "visible") {
      refresh();
      void syncNowWithCloud();
    }
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(SYNC_EVENT, onCustomSync);
  window.addEventListener("erp-store-saved", scheduleCloudAndRealtimePush);
  window.addEventListener("restocash-users-directory-broadcast", onUsersDirectoryBroadcast);
  window.addEventListener("focus", onFocus);
  window.addEventListener("visibilitychange", onVisibility);

  // Set up Supabase Realtime Broadcast + Postgres Changes channel
  if (liveChannel) {
    void supabase.removeChannel(liveChannel);
  }

  liveChannel = supabase
    .channel(LIVE_SYNC_CHANNEL_NAME, {
      config: {
        broadcast: { self: false },
      },
    })
    .on("broadcast", { event: "erp_sync" }, ({ payload }) => {
      if (!payload || payload.clientId === CLIENT_INSTANCE_ID) return;
      applyIncomingErpPayload(payload, { persistToCloudIfAuthenticated: true });
      lastSyncAtIso = new Date().toISOString();
      emitSyncStatusChanged();
    })
    .on("broadcast", { event: "hr_users_sync" }, ({ payload }) => {
      if (!payload || payload.clientId === CLIENT_INSTANCE_ID) return;
      applyIncomingErpPayload(payload, { persistToCloudIfAuthenticated: true });
      lastSyncAtIso = new Date().toISOString();
      emitSyncStatusChanged();
    })
    .on("broadcast", { event: "sync_request" }, ({ payload }) => {
      if (!payload || payload.clientId === CLIENT_INSTANCE_ID) return;
      const compact = buildCompactErpPayload();
      void sendRealtimeBroadcast("erp_sync", compact);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "erp_store_state" }, (chg) => {
      const nextRow = (chg as any)?.new;
      if (nextRow?.state && typeof nextRow.state === "object") {
        applyIncomingErpPayload(nextRow.state);
        lastSyncAtIso = new Date().toISOString();
        emitSyncStatusChanged();
      }
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
      void syncUsersDirectoryWithDatabase().then(() => {
        refresh();
      });
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "shift_audit_logs" }, () => {
      void pullUsersDirectorySnapshotFromSupabase().then((snap) => {
        if (snap) {
          applyIncomingErpPayload(snap);
        }
        refresh();
      });
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => refresh())
    .on("postgres_changes", { event: "*", schema: "public", table: "tables" }, () => refresh())
    .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, () => refresh())
    .subscribe((status) => {
      isRealtimeSubscribed = status === "SUBSCRIBED";
      emitSyncStatusChanged();
      if (isRealtimeSubscribed) {
        // Announce presence & request latest peer state + sync with cloud
        void sendRealtimeBroadcast("sync_request", { reason: "initial_subscribe" });
        void syncNowWithCloud();
      }
    });

  // Periodic background cloud sync + local pulse check
  const pulse = window.setInterval(() => {
    const current = window.localStorage.getItem(SYNC_STORAGE_KEY) || "";
    if (current && current !== lastPulse) {
      lastPulse = current;
      refresh();
    }
  }, 1500);

  const cloudInterval = window.setInterval(() => {
    if (document.visibilityState === "visible") {
      void syncNowWithCloud();
    }
  }, 20000);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SYNC_EVENT, onCustomSync);
    window.removeEventListener("erp-store-saved", scheduleCloudAndRealtimePush);
    window.removeEventListener("restocash-users-directory-broadcast", onUsersDirectoryBroadcast);
    window.removeEventListener("focus", onFocus);
    window.removeEventListener("visibilitychange", onVisibility);
    window.clearInterval(pulse);
    window.clearInterval(cloudInterval);
    if (pushDebounceTimer !== null) {
      window.clearTimeout(pushDebounceTimer);
    }
    if (liveChannel) {
      void supabase.removeChannel(liveChannel);
      liveChannel = null;
      isRealtimeSubscribed = false;
    }
  };
}

export function broadcastAppSync() {
  if (typeof window === "undefined") return;
  const pulse = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(SYNC_STORAGE_KEY, pulse);
  window.dispatchEvent(new Event(SYNC_EVENT));
}
