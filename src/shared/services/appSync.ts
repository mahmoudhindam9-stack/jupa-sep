import type { QueryClient } from "@tanstack/react-query";
import { erpStore } from "./erpStore";

const SYNC_EVENT = "restocash-data-sync";
const SYNC_STORAGE_KEY = "restocash_sync_pulse";

/**
 * One lightweight synchronization bridge for every screen in the ERP.
 * It keeps React Query, the local ERP store and multiple browser tabs in step.
 */
export function createAppSync(queryClient: QueryClient) {
  if (typeof window === "undefined") return () => {};

  let lastPulse = "";

  const reloadLocalErpState = () => {
    try {
      const raw = window.localStorage.getItem("erp_store_state");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const memoryEntriesCount = erpStore.state?.journalEntries?.length || 0;
        const memoryUpdated = (erpStore.state as any)?._updatedAt || 0;

        const parsedEntriesCount = parsed.journalEntries?.length || 0;
        const parsedUpdated = parsed._updatedAt || 0;

        // Never overwrite in-memory state if in-memory has more entries or newer timestamp
        if (
          memoryEntriesCount > parsedEntriesCount ||
          (memoryEntriesCount === parsedEntriesCount && memoryUpdated > parsedUpdated)
        ) {
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

  const onStorage = (event: StorageEvent) => {
    if (event.key === "erp_store_state" || event.key === "restocash_sync_pulse") refresh();
  };

  const onCustomSync = () => refresh();
  const onFocus = () => refresh();
  const onVisibility = () => {
    if (document.visibilityState === "visible") refresh();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(SYNC_EVENT, onCustomSync);
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVisibility);

  const pulse = window.setInterval(() => {
    const current = window.localStorage.getItem(SYNC_STORAGE_KEY) || "";
    if (current && current !== lastPulse) {
      lastPulse = current;
      refresh();
    }
  }, 1500);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SYNC_EVENT, onCustomSync);
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onVisibility);
    window.clearInterval(pulse);
  };
}

export function broadcastAppSync() {
  if (typeof window === "undefined") return;
  const pulse = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(SYNC_STORAGE_KEY, pulse);
  window.dispatchEvent(new Event(SYNC_EVENT));
}
