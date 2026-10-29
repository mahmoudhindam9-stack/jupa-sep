import { useState, useEffect, useRef, useCallback } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { currentUserHasPermission, signOutCurrentUser } from "@/shared/services/userAuthorization";
import { useSettings } from "@/hooks/use-settings";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UtensilsCrossed, Plus, Settings2, Trash2, Save } from "lucide-react";
import { TableOrderModal } from "@/components/TableOrderModal";
import { AppMainNavbar } from "@/components/navigation/AppMainNavbar";
import { AppBreadcrumbBar } from "@/components/navigation/AppBreadcrumbBar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { tableOrdersStore } from "@/shared/services/tableOrdersStore";
import { OrderTimer } from "@/components/OrderTimer";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, Printer } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cleanTableId } from "@/shared/utils/inventoryUtils";

export const Route = createFileRoute("/captain")({
  head: () => ({ meta: [{ title: "Captain Order" }] }),
  component: CaptainAccessGate,
});

function CaptainAccessGate() {
  const navigate = useNavigate();
  const [accessState, setAccessState] = useState<"checking" | "allowed" | "denied">("checking");
  useEffect(() => {
    let active = true;
    currentUserHasPermission(["captain", "captain_access"])
      .then((allowed) => {
        if (active) setAccessState(allowed ? "allowed" : "denied");
      })
      .catch((error) => {
        console.error("Captain route authorization failed.", error);
        if (active) setAccessState("denied");
      });
    return () => {
      active = false;
    };
  }, []);

  if (accessState === "allowed") return <CaptainPage />;
  if (accessState === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm font-bold text-muted-foreground">
        جاري التحقق من صلاحيات حسابك…
      </div>
    );
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6" dir="rtl">
      <div
        role="alert"
        className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm space-y-4"
      >
        <h1 className="text-xl font-black text-foreground">ليس لديك صلاحية شاشة الكابتن</h1>
        <p className="text-sm text-muted-foreground">
          يجب تفعيل صلاحية الكابتن من صفحة المستخدمين قبل فتح هذه الشاشة.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => navigate({ to: "/admin" })}>العودة إلى لوحة الإدارة</Button>
          <Button
            variant="outline"
            onClick={async () => {
              await signOutCurrentUser();
              navigate({ to: "/login" });
            }}
          >
            تسجيل الخروج
          </Button>
        </div>
      </div>
    </div>
  );
}

type Table = {
  id: string;
  number: number;
  name: string | null;
  capacity: number;
  status: "available" | "occupied" | "reserved" | "cleaning";
  status_updated_at?: number;
};

const statusLabels: Record<string, string> = {
  available: "متاح",
  occupied: "مشغول",
  reserved: "محجوز",
  cleaning: "تنظيف",
};

const statusColors: Record<string, string> = {
  available: "bg-emerald-100 text-emerald-700 border-emerald-200",
  occupied: "bg-rose-100 text-rose-700 border-rose-200",
  reserved: "bg-amber-100 text-amber-700 border-amber-200",
  cleaning: "bg-sky-100 text-sky-700 border-sky-200",
};

const LOCAL_TABLES_KEY = "restocash_tables_v1";

function getLocalTables(): Table[] {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(LOCAL_TABLES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalTables(tables: Table[]) {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return;
    localStorage.setItem(LOCAL_TABLES_KEY, JSON.stringify(tables));
  } catch (e) {
    console.error("Failed to save local tables:", e);
  }
}

function playCaptainNotificationSound() {
  try {
    if (typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const playTone = (freq: number, startOffset: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffset);
      gain.gain.setValueAtTime(0.18, ctx.currentTime + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startOffset + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startOffset);
      osc.stop(ctx.currentTime + startOffset + duration);
    };
    playTone(587.33, 0, 0.16);
    playTone(880, 0.18, 0.28);
  } catch {
    // Ignore audio context autoplay restrictions
  }
}

function extractTableNumberFromOrder(order: any): number {
  if (order?.table_number && Number(order.table_number) > 0 && Number(order.table_number) !== 999) {
    return Number(order.table_number);
  }
  const firstMeta = Array.isArray(order?.items) ? order.items[0]?.meta : null;
  if (
    firstMeta?.table_number &&
    Number(firstMeta.table_number) > 0 &&
    Number(firstMeta.table_number) !== 999
  ) {
    return Number(firstMeta.table_number);
  }
  const notes = String(order?.notes || "");
  const matchBracket = notes.match(/\[طاولة:\s*(\d+)\]/);
  if (matchBracket && Number(matchBracket[1]) > 0) {
    return Number(matchBracket[1]);
  }
  const matchHash = notes.match(/طاولة\s*#?(\d+)/);
  if (matchHash && Number(matchHash[1]) > 0) {
    return Number(matchHash[1]);
  }
  const tblIdStr = String(order?.table_id || firstMeta?.table_id || "");
  const matchId = tblIdStr.match(/^tbl-(\d+)$/);
  if (matchId && Number(matchId[1]) > 0 && Number(matchId[1]) !== 999) {
    return Number(matchId[1]);
  }
  return 0;
}

const EMPTY_ORDERS: any[] = [];

function CaptainPage() {
  const { lang, currency } = useSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const notifiedOrderIdsRef = useRef<Set<string>>(new Set());

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const rawTableOrders = useSyncExternalStore(
    tableOrdersStore.subscribe.bind(tableOrdersStore),
    () => tableOrdersStore.getAllOrders(),
    () => EMPTY_ORDERS,
  );
  const tableOrders = isMounted ? rawTableOrders : EMPTY_ORDERS;

  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Manage Table State
  const [manageTableOpen, setManageTableOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrTableId, setQrTableId] = useState("");
  const [qrZone, setQrZone] = useState("الصالة الداخلية");
  const [qrMenuLang, setQrMenuLang] = useState<"ar" | "en">("ar");
  const [qrAllowLangSwitch, setQrAllowLangSwitch] = useState<boolean>(true);
  const [qrWelcomeMessage, setQrWelcomeMessage] = useState("أهلاً بك! يمكنك الطلب الآن.");
  const [qrCurrency, setQrCurrency] = useState("EGP");
  const [customBaseUrl, setCustomBaseUrl] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("restocash_qr_base_url_v1");
      if (saved && saved.trim()) return saved.trim().replace(/\/+$/, "");
      const orig = (window.location.origin || "").replace(/\/+$/, "");
      if (
        orig &&
        orig !== "null" &&
        !orig.includes("localhost") &&
        !orig.includes("127.0.0.1") &&
        !orig.includes("::1")
      ) {
        return orig;
      }
    }
    return "https://jupa-sep.vercel.app";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("restocash_qr_base_url_v1");
      const orig = (window.location.origin || "").replace(/\/+$/, "");
      if (orig && orig.includes(".vercel.app")) {
        setCustomBaseUrl(orig);
        window.localStorage.setItem("restocash_qr_base_url_v1", orig);
      } else if (saved && saved.trim()) {
        setCustomBaseUrl(saved.trim().replace(/\/+$/, ""));
      } else if (
        orig &&
        orig !== "null" &&
        !orig.includes("localhost") &&
        !orig.includes("127.0.0.1") &&
        !orig.includes("::1")
      ) {
        setCustomBaseUrl(orig);
      }
    }
  }, []);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [form, setForm] = useState({ number: "", name: "", capacity: "" });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<Table | null>(null);

  const tablesQuery = useQuery({
    queryKey: ["tables"],
    queryFn: async () => {
      let dbTables: Table[] = [];
      try {
        const { data, error } = await supabase.from("tables").select("*").order("number");
        if (!error && data) {
          dbTables = data as Table[];
        }
      } catch (err) {
        console.warn("Could not fetch tables from Supabase, using local fallback:", err);
      }

      const localTables = getLocalTables();
      const mergedMap = new Map<number, Table>();

      for (const dt of dbTables) {
        mergedMap.set(Number(dt.number), { ...dt });
      }

      for (const lt of localTables) {
        const existing = mergedMap.get(Number(lt.number));
        if (!existing) {
          mergedMap.set(Number(lt.number), { ...lt });
        } else if (lt.status_updated_at && Date.now() - lt.status_updated_at < 120000) {
          // Preserve recent local status override if DB hasn't caught up or ID is non-UUID
          mergedMap.set(Number(lt.number), {
            ...existing,
            status: lt.status,
            status_updated_at: lt.status_updated_at,
          });
        }
      }

      const merged = Array.from(mergedMap.values()).sort((a, b) => a.number - b.number);

      if (merged.length === 0) {
        const defaultTables: Table[] = [
          { id: "tbl-1", number: 1, name: "طاولة 1", capacity: 4, status: "available" },
          { id: "tbl-2", number: 2, name: "طاولة 2", capacity: 2, status: "available" },
          { id: "tbl-3", number: 3, name: "طاولة 3", capacity: 6, status: "available" },
          { id: "tbl-4", number: 4, name: "طاولة 4", capacity: 4, status: "available" },
        ];
        saveLocalTables(defaultTables);
        return defaultTables;
      }

      saveLocalTables(merged);
      return merged;
    },
    refetchInterval: 3000,
  });

  const tablesList = tablesQuery.data || getLocalTables() || [];

  // Default QR table selection to first table so customer QR codes always target a real table card
  useEffect(() => {
    if (!qrTableId && tablesList.length > 0) {
      setQrTableId(tablesList[0].id);
    }
  }, [qrTableId, tablesList]);

  const handleChangeTableStatus = useCallback(
    async (
      table: { id: string; number: number; name?: string | null; capacity?: number },
      newStatus: Table["status"],
      e?: React.MouseEvent,
    ) => {
      if (e) {
        e.stopPropagation();
      }

      // 1. Update local storage immediately
      const currentLocal = getLocalTables();
      const nowTs = Date.now();
      const idx = currentLocal.findIndex(
        (lt) => lt.id === table.id || Number(lt.number) === Number(table.number),
      );
      if (idx >= 0) {
        currentLocal[idx] = {
          ...currentLocal[idx],
          status: newStatus,
          status_updated_at: nowTs,
        };
      } else {
        currentLocal.push({
          id: table.id,
          number: table.number,
          name: table.name || `طاولة ${table.number}`,
          capacity: table.capacity || 4,
          status: newStatus,
          status_updated_at: nowTs,
        });
      }
      saveLocalTables(currentLocal);

      // Optimistically update React Query cache
      queryClient.setQueryData(["tables"], (old: Table[] | undefined) => {
        if (!Array.isArray(old)) return currentLocal;
        return old.map((t) =>
          t.id === table.id || Number(t.number) === Number(table.number)
            ? { ...t, status: newStatus, status_updated_at: nowTs }
            : t,
        );
      });

      // 2. Sync with Supabase tables (both by UUID if valid and by table number)
      try {
        const validUuid = cleanTableId(table.id);
        if (validUuid) {
          await supabase.from("tables").update({ status: newStatus }).eq("id", validUuid);
        }
        await supabase.from("tables").update({ status: newStatus }).eq("number", table.number);
      } catch (err) {
        console.warn("Supabase table status update warning:", err);
      }

      // 3. Broadcast across tabs
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        try {
          const bc = new BroadcastChannel("restocash_self_orders_bc");
          bc.postMessage({
            type: "TABLE_STATUS_CHANGED",
            tableId: table.id,
            tableNumber: table.number,
            status: newStatus,
          });
          bc.close();
        } catch {
          // ignore
        }
      }

      queryClient.invalidateQueries({ queryKey: ["tables"] });

      if (e) {
        toast({
          title: `طاولة #${table.number}: ${statusLabels[newStatus] || newStatus}`,
          description: "تم تحديث حالة الطاولة بنجاح.",
        });
      }
    },
    [queryClient, toast],
  );

  // Sync incoming customer QR self-orders & table status directly onto Table Cards
  useEffect(() => {
    const attachIncomingSelfOrderToTable = (order: any, shouldNotify = true) => {
      if (!order || order.is_table_call) return;
      const notesStr = String(order.notes || "");

      if (notesStr.includes("[TABLE_ASSISTANCE_CALL]")) {
        if (order.id && !notifiedOrderIdsRef.current.has(order.id)) {
          notifiedOrderIdsRef.current.add(order.id);
          const tblNum = extractTableNumberFromOrder(order) || 1;
          playCaptainNotificationSound();
          toast({
            title: `🔔 تنبيه من طاولة #${tblNum}`,
            description: notesStr.replace(/\[TABLE_ASSISTANCE_CALL\]/g, "").trim(),
          });
          supabase.from("orders").update({ status: "served" }).eq("id", order.id).then(() => {});
        }
        return;
      }

      if (notesStr.includes("[CASHIER_PAID]") || order.status === "served" || order.status === "cancelled") {
        const tblNum = extractTableNumberFromOrder(order);
        tableOrdersStore.completeCashierOrder({
          orderId: order.id,
          kitchenOrderId: order.id,
          tableId: order.table_id || null,
          tableNumber: tblNum || null,
        });
        return;
      }

      const extractedNum = extractTableNumberFromOrder(order);
      const rawId = order.table_id || order.items?.[0]?.meta?.table_id || "";
      const tblMatch =
        tablesList.find(
          (t) =>
            (rawId && t.id === rawId) ||
            (extractedNum > 0 && Number(t.number) === Number(extractedNum)),
        ) || tablesList[0];

      const finalTblId = tblMatch ? tblMatch.id : rawId || "tbl-1";
      const finalTblNum = tblMatch ? tblMatch.number : extractedNum > 0 ? extractedNum : 1;
      const finalTblName =
        tblMatch?.name || order.table_name || `طاولة ${finalTblNum}`;

      const normalizedItems = (Array.isArray(order.items) ? order.items : []).map((rawLine: any) => {
        const baseItem = rawLine?.item || {
          id: rawLine?.id || rawLine?.menu_item_id || `item-${Math.random()}`,
          name_ar: rawLine?.name_ar || rawLine?.name || "صنف",
          price: Number(rawLine?.price ?? 0),
          category_id: rawLine?.category_id || "all",
          image_url: rawLine?.image_url || null,
          requires_oven: Boolean(rawLine?.requires_oven ?? rawLine?.item?.requires_oven),
        };
        return {
          item: baseItem,
          quantity: Number(rawLine?.quantity ?? 1),
          notes: rawLine?.notes || rawLine?.note || "",
          selectedAdditions: rawLine?.selectedAdditions || [],
        };
      });

      const existingLocal = tableOrdersStore.getOrderByTableId(finalTblId, finalTblNum);
      const isAlreadyInStore = Boolean(
        existingLocal &&
          (existingLocal.id === order.id || existingLocal.kitchenOrderId === order.id),
      );

      const sentToKitchenFlag =
        Boolean(existingLocal?.sentToKitchen) ||
        notesStr.includes("[SENT_TO_KITCHEN]") ||
        order.status === "preparing" ||
        order.status === "in_kitchen" ||
        order.status === "ready";
      const kitchenCompletedFlag =
        Boolean(existingLocal?.kitchenCompleted) || order.status === "ready";
      const sentToCashierFlag =
        Boolean(existingLocal?.sentToCashier) ||
        existingLocal?.status === "sent_to_cashier" ||
        notesStr.includes("[SENT_TO_CASHIER]");

      tableOrdersStore.saveOrder({
        id: order.id,
        kitchenOrderId: order.id,
        table_id: finalTblId,
        table_number: finalTblNum,
        table_name: finalTblName,
        items: existingLocal?.items?.length ? existingLocal.items : normalizedItems,
        order_type: order.order_type || "dine_in",
        notes: order.notes || `طاولة #${finalTblNum}`,
        selectedAdditions: existingLocal?.selectedAdditions || [],
        subtotal: Number(order.subtotal ?? order.total ?? 0),
        tax: Number(order.tax ?? 0),
        total: Number(order.total ?? 0),
        status: sentToCashierFlag ? "sent_to_cashier" : "draft",
        sentToKitchen: sentToKitchenFlag,
        kitchenCompleted: kitchenCompletedFlag,
        sentToCashier: sentToCashierFlag,
        is_self_order:
          notesStr.includes("[SELF_ORDER") || Boolean(order.is_self_order || existingLocal?.is_self_order),
        created_at: order.created_at || existingLocal?.created_at || new Date().toISOString(),
      });

      if (!isAlreadyInStore && order.id && !notifiedOrderIdsRef.current.has(order.id)) {
        notifiedOrderIdsRef.current.add(order.id);
        handleChangeTableStatus({ id: finalTblId, number: finalTblNum, name: finalTblName }, "occupied");
        if (shouldNotify) {
          playCaptainNotificationSound();
          toast({
            title: `🔔 طلب جديد على طاولة #${finalTblNum}`,
            description: `وصل طلب (${normalizedItems.length} أصناف) على مربع طاولة #${finalTblNum}. اضغط على الطاولة لعرضه وإرساله للمطبخ أو الكاشير.`,
          });
        }
      }
    };

    const syncRecentSelfOrdersFromDb = async (isInitial = false) => {
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .in("status", ["pending", "preparing", "in_kitchen", "ready", "served"])
          .order("created_at", { ascending: false })
          .limit(25);

        if (error || !Array.isArray(data)) return;

        for (const row of data) {
          const notes = String(row.notes || "");
          const isSelfOrTableOrder =
            notes.includes("[SELF_ORDER_PENDING_CAPTAIN]") ||
            notes.includes("[SELF_ORDER_ACTIVE]") ||
            notes.includes("[SENT_TO_KITCHEN]") ||
            notes.includes("[SENT_TO_CASHIER]") ||
            notes.includes("[TABLE_ASSISTANCE_CALL]");
          if (!isSelfOrTableOrder) continue;
          attachIncomingSelfOrderToTable(row, !isInitial);
        }
      } catch {
        // Ignore transient network errors
      }
    };

    syncRecentSelfOrdersFromDb(true);
    const pollTimer = setInterval(() => syncRecentSelfOrdersFromDb(false), 2500);

    const channel = supabase
      .channel("orders_channel_captain_cards")
      .on("broadcast", { event: "NEW_ORDER" }, (payload) => {
        attachIncomingSelfOrderToTable(payload.payload, true);
      })
      .on("broadcast", { event: "TABLE_ASSISTANCE_REQUEST" }, (payload) => {
        attachIncomingSelfOrderToTable(payload.payload, true);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        if (payload.new) {
          attachIncomingSelfOrderToTable(payload.new, true);
        }
      })
      .subscribe();

    let bc: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        bc = new BroadcastChannel("restocash_self_orders_bc");
        bc.onmessage = (ev) => {
          if ((ev.data?.type === "NEW_SELF_ORDER" || ev.data?.type === "NEW_ORDER") && (ev.data?.order || ev.data?.payload)) {
            attachIncomingSelfOrderToTable(ev.data.order || ev.data.payload, true);
          } else if (ev.data?.type === "TABLE_ASSISTANCE_REQUEST" && ev.data?.payload) {
            attachIncomingSelfOrderToTable(ev.data.payload, true);
          } else if (
            ev.data?.type === "TABLE_STATUS_CHANGED" ||
            ev.data?.type === "TABLE_PAID_AND_CLEANING" ||
            ev.data?.type === "ORDER_COMPLETED_BY_CASHIER"
          ) {
            queryClient.invalidateQueries({ queryKey: ["tables"] });
          }
        };
      } catch {
        // Ignore BroadcastChannel errors
      }
    }

    return () => {
      clearInterval(pollTimer);
      supabase.removeChannel(channel);
      if (bc) {
        try {
          bc.close();
        } catch {
          // Ignore close error
        }
      }
    };
  }, [tablesList, queryClient, toast, handleChangeTableStatus]);

  useEffect(() => {
    const channel = supabase
      .channel("tables_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tables" }, () => {
        queryClient.invalidateQueries({ queryKey: ["tables"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const saveTable = useMutation({
    mutationFn: async (values: {
      id?: string;
      number: number;
      name: string | null;
      capacity: number;
    }) => {
      const tableId = values.id || `tbl_local_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const newTableObj: Table = {
        id: tableId,
        number: values.number,
        name: values.name,
        capacity: values.capacity,
        status: "available",
      };

      try {
        if (values.id) {
          const { error } = await supabase
            .from("tables")
            .update({
              number: values.number,
              name: values.name,
              capacity: values.capacity,
            })
            .eq("id", values.id);
          if (error) console.warn("Supabase update table warning:", error);
        } else {
          const { error } = await supabase.from("tables").insert({
            id: tableId,
            number: values.number,
            name: values.name,
            capacity: values.capacity,
            status: "available",
          });
          if (error) console.warn("Supabase insert table warning:", error);
        }
      } catch (dbErr) {
        console.warn("Supabase connection failed, relying on local table storage:", dbErr);
      }

      const currentLocal = getLocalTables();
      const existingIdx = currentLocal.findIndex(
        (t) => t.id === tableId || t.number === values.number,
      );
      if (existingIdx >= 0) {
        currentLocal[existingIdx] = { ...currentLocal[existingIdx], ...newTableObj };
      } else {
        currentLocal.push(newTableObj);
      }
      saveLocalTables(currentLocal);
      return newTableObj;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      setManageTableOpen(false);
      setEditingTable(null);
      toast({
        title: "تم حفظ الطاولة بنجاح",
      });
    },
    onError: (err: any) => {
      toast({
        title: "خطأ",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const deleteTable = useMutation({
    mutationFn: async (id: string) => {
      try {
        await supabase.from("tables").delete().eq("id", id);
      } catch (e) {
        console.warn("Supabase delete table failed:", e);
      }
      const currentLocal = getLocalTables().filter((t) => t.id !== id);
      saveLocalTables(currentLocal);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      setDeleteConfirmOpen(false);
      setTableToDelete(null);
      setManageTableOpen(false);
      toast({
        title: "تم الحذف بنجاح",
      });
    },
    onError: (err: any) => {
      toast({
        title: "خطأ",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleOpenManage = (t?: Table) => {
    if (t) {
      setEditingTable(t);
      setForm({
        number: String(t.number),
        name: t.name || "",
        capacity: String(t.capacity),
      });
    } else {
      setEditingTable(null);
      setForm({ number: "", name: "", capacity: "" });
    }
    setManageTableOpen(true);
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.number) return;
    saveTable.mutate({
      id: editingTable?.id,
      number: Number(form.number),
      name: form.name || null,
      capacity: Number(form.capacity) || 4,
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-cairo">
      {/* 1. Permanent Fixed Main Top Bar */}
      <AppMainNavbar />

      {/* 2. Contextual Breadcrumb Bar */}
      <AppBreadcrumbBar />

      {/* Contextual Captain Action Bar */}
      <div className="bg-card/95 backdrop-blur border-b border-border px-4 sm:px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <UtensilsCrossed size={18} className="text-amber-500 shrink-0" />
            <div>
              <h1 className="text-sm sm:text-base font-black text-foreground leading-tight">
                {lang === "ar" ? "إدارة الصالة وطلبات الكابتن" : "Captain & Dining Hall Orders"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={() => {
                if (!qrTableId && tablesList.length > 0) {
                  setQrTableId(tablesList[0].id);
                }
                setIsQrModalOpen(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5 h-8 text-xs shadow-2xs"
            >
              <QrCode size={14} />
              {lang === "ar" ? "باركود الطلب الذاتي" : "Self-Order QR"}
            </Button>
            <Button
              size="sm"
              onClick={() => handleOpenManage()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 h-8 text-xs shadow-2xs"
            >
              <Plus size={14} />
              {lang === "ar" ? "إضافة طاولة" : "Add Table"}
            </Button>
            <Button
              size="sm"
              variant={isEditMode ? "secondary" : "outline"}
              className={`gap-1.5 h-8 text-xs ${isEditMode ? "bg-amber-500 text-white hover:bg-amber-600 border-amber-500" : ""}`}
              onClick={() => setIsEditMode(!isEditMode)}
            >
              <Settings2 size={16} />
              {isEditMode
                ? lang === "ar"
                  ? "إنهاء التعديل"
                  : "Done Editing"
                : lang === "ar"
                  ? "تعديل الطاولات"
                  : "Edit Tables"}
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 overflow-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-4">
          {(tablesQuery.data ?? []).map((t) => {
            const activeOrder = tableOrders.find(
              (o) =>
                (o.table_id === t.id || Number(o.table_number) === Number(t.number)) &&
                (o.status === "draft" ||
                  o.status === "sent_to_cashier" ||
                  o.status === "in_checkout"),
            );
            const totalItemsCount = Array.isArray(activeOrder?.items)
              ? activeOrder.items.reduce(
                  (sum: number, line: any) => sum + Number(line?.quantity || 1),
                  0,
                )
              : 0;

            return (
              <div
                key={t.id}
                className={`bg-white border-2 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col h-full cursor-pointer relative overflow-hidden group ${
                  isEditMode
                    ? "border-amber-400 ring-2 ring-amber-400/20"
                    : activeOrder
                      ? "border-rose-400 ring-2 ring-rose-400/20 bg-rose-50/40"
                      : statusColors[t.status]
                }`}
                onClick={() => {
                  if (isEditMode) {
                    handleOpenManage(t);
                  } else {
                    setSelectedTable(t);
                  }
                }}
              >
                <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform pointer-events-none">
                  <UtensilsCrossed size={80} />
                </div>

                <div className="flex items-center justify-between mb-1.5 relative z-10">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-2xl text-slate-900">#{t.number}</span>
                    <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-white/80 border border-current">
                      {lang === "ar" ? statusLabels[t.status] : t.status}
                    </span>
                  </div>
                  {isEditMode ? (
                    <div className="bg-amber-100 text-amber-700 p-1.5 rounded-lg">
                      <Settings2 size={16} />
                    </div>
                  ) : (
                    <button
                      type="button"
                      title={lang === "ar" ? "باركود هذه الطاولة" : "QR for this table"}
                      onClick={(e) => {
                        e.stopPropagation();
                        setQrTableId(t.id);
                        setIsQrModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg bg-white/90 hover:bg-indigo-50 text-indigo-600 border border-indigo-200 transition-colors"
                    >
                      <QrCode size={15} />
                    </button>
                  )}
                </div>

                <div className="mb-2 relative z-10 flex items-center justify-between">
                  <div className="font-bold text-sm text-slate-800">
                    {t.name || (lang === "ar" ? `طاولة ${t.number}` : `Table ${t.number}`)}
                  </div>
                  <div className="text-[11px] font-bold text-slate-600">
                    {lang === "ar" ? "السعة:" : "Cap:"} {t.capacity} {lang === "ar" ? "أفراد" : "pax"}
                  </div>
                </div>

                {/* Active Order Summary & Live Oven Timer directly on Table Card */}
                {activeOrder ? (
                  <div className="relative z-10 my-1.5 p-2.5 rounded-xl bg-white/95 border border-slate-200 shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-[11px] font-black px-2 py-0.5 rounded-md ${
                          activeOrder.is_self_order
                            ? "bg-indigo-100 text-indigo-900"
                            : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {activeOrder.is_self_order ? "طلب عميل QR 🔔" : "طلب بالطاولة 🛒"}
                      </span>
                      <span className="font-black text-xs text-slate-900">
                        {Number(activeOrder.total ?? 0).toFixed(2)} {currency}
                      </span>
                    </div>

                    {Array.isArray(activeOrder.items) && activeOrder.items.length > 0 && (
                      <div className="text-[11px] font-bold text-slate-700 line-clamp-2 leading-snug">
                        {activeOrder.items
                          .map(
                            (line: any) =>
                              `${line?.item?.name_ar || line?.name_ar || "صنف"} ×${line?.quantity || 1}`,
                          )
                          .join("، ")}
                      </div>
                    )}

                    {/* Live Oven / Kitchen Timer on Table Card */}
                    {activeOrder.sentToKitchen && !activeOrder.kitchenCompleted && (
                      <div className="flex justify-between items-center bg-orange-100 border border-orange-300 px-2 py-1 rounded-lg">
                        <span className="text-[11px] font-black text-orange-900">
                          في الفرن/المطبخ 👨‍🍳
                        </span>
                        <OrderTimer
                          createdAt={activeOrder.updated_at || activeOrder.created_at}
                        />
                      </div>
                    )}

                    {activeOrder.kitchenCompleted && (
                      <div className="flex justify-between items-center bg-emerald-100 border border-emerald-300 px-2 py-1 rounded-lg">
                        <span className="text-[11px] font-black text-emerald-900">
                          جاهز من الفرن ✅
                        </span>
                        <span className="text-[10px] font-bold text-emerald-800">
                          {totalItemsCount} أصناف
                        </span>
                      </div>
                    )}

                    {(activeOrder.status === "sent_to_cashier" ||
                      activeOrder.status === "in_checkout" ||
                      activeOrder.sentToCashier) && (
                      <div className="flex justify-between items-center bg-emerald-50 border border-emerald-300 px-2 py-1 rounded-lg">
                        <span className="text-[11px] font-black text-emerald-800">
                          مرسل للكاشير (بانتظار الدفع) 💰
                        </span>
                      </div>
                    )}

                    <div className="text-[10px] font-extrabold text-indigo-700 text-center pt-0.5">
                      اضغط لفتح الطلب (للمطبخ / للكاشير)
                    </div>
                  </div>
                ) : (
                  <div className="relative z-10 my-2 py-3 text-center rounded-xl border border-dashed border-current/25 bg-white/40 text-[11px] font-bold text-slate-600">
                    لا يوجد طلب حالي — اضغط لإضافة طلب
                  </div>
                )}

                {/* Manual Table Status Control (متاح / مشغول / تنظيف) */}
                {!isEditMode && (
                  <div
                    className="mt-auto pt-2 border-t border-black/10 relative z-10 flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {(
                      [
                        { key: "available", label: "متاح", activeCls: "bg-emerald-600 text-white border-emerald-600" },
                        { key: "occupied", label: "مشغول", activeCls: "bg-rose-600 text-white border-rose-600" },
                        { key: "cleaning", label: "تنظيف", activeCls: "bg-sky-600 text-white border-sky-600" },
                      ] as const
                    ).map((st) => {
                      const isActive = t.status === st.key;
                      return (
                        <button
                          key={st.key}
                          type="button"
                          onClick={(e) => handleChangeTableStatus(t, st.key, e)}
                          className={`flex-1 py-1 px-1.5 rounded-lg text-[11px] font-black border transition-all cursor-pointer ${
                            isActive
                              ? `${st.activeCls} shadow-2xs`
                              : "bg-white/85 hover:bg-white text-slate-700 border-slate-300"
                          }`}
                        >
                          {st.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {isEditMode && (
            <div
              className="bg-slate-100 border-2 border-dashed border-slate-300 rounded-2xl p-4 shadow-sm hover:shadow-md hover:bg-slate-200 hover:border-slate-400 transition-all flex flex-col items-center justify-center h-full cursor-pointer min-h-[140px]"
              onClick={() => handleOpenManage()}
            >
              <div className="bg-white p-3 rounded-full shadow-sm mb-2 text-slate-600">
                <Plus size={24} />
              </div>
              <span className="font-bold text-slate-700">
                {lang === "ar" ? "إضافة طاولة" : "Add Table"}
              </span>
            </div>
          )}

          {tablesQuery.data?.length === 0 && !isEditMode && (
            <div className="col-span-full py-12 text-center text-slate-500 font-bold">
              {lang === "ar"
                ? "لا توجد طاولات مضافة في النظام حالياً"
                : "No tables added to the system"}
            </div>
          )}
        </div>
      </main>

      {selectedTable && (
        <TableOrderModal
          table={selectedTable}
          isOpen={true}
          onClose={() => setSelectedTable(null)}
          onOrderSent={() => setSelectedTable(null)}
          onChangeTableStatus={(status) => {
            handleChangeTableStatus(selectedTable, status);
            setSelectedTable((prev) => (prev ? { ...prev, status } : null));
          }}
        />
      )}

      {/* Manage Table Dialog */}
      <Dialog open={manageTableOpen} onOpenChange={setManageTableOpen}>
        <DialogContent className="sm:max-w-[425px]" dir={lang === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>
              {editingTable
                ? lang === "ar"
                  ? "تعديل الطاولة"
                  : "Edit Table"
                : lang === "ar"
                  ? "إضافة طاولة جديدة"
                  : "Add New Table"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveSubmit} className="space-y-4 py-4">
            <div className="space-y-2 text-right">
              <Label className="font-bold">
                {lang === "ar" ? "رقم الطاولة *" : "Table Number *"}
              </Label>
              <Input
                type="number"
                required
                value={form.number}
                onChange={(e) => setForm((s) => ({ ...s, number: e.target.value }))}
                className="text-right"
              />
            </div>

            <div className="space-y-2 text-right">
              <Label className="font-bold">
                {lang === "ar" ? "اسم الطاولة (اختياري)" : "Table Name (Optional)"}
              </Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                placeholder={lang === "ar" ? "مثال: طاولة العائلات 1" : "e.g. Family Table 1"}
                className="text-right"
              />
            </div>

            <div className="space-y-2 text-right">
              <Label className="font-bold">
                {lang === "ar" ? "السعة (أفراد) *" : "Capacity (Pax) *"}
              </Label>
              <Input
                type="number"
                required
                value={form.capacity}
                onChange={(e) => setForm((s) => ({ ...s, capacity: e.target.value }))}
                className="text-right"
              />
            </div>

            <DialogFooter className="pt-4 flex items-center justify-between sm:justify-between w-full">
              {editingTable ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setTableToDelete(editingTable);
                    setDeleteConfirmOpen(true);
                  }}
                  className="gap-2"
                >
                  <Trash2 size={16} />
                  {lang === "ar" ? "حذف" : "Delete"}
                </Button>
              ) : (
                <div></div>
              )}

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setManageTableOpen(false)}>
                  {lang === "ar" ? "إلغاء" : "Cancel"}
                </Button>
                <Button type="submit" disabled={saveTable.isPending} className="gap-2">
                  <Save size={16} />
                  {lang === "ar" ? "حفظ" : "Save"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent dir={lang === "ar" ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">
              {lang === "ar" ? "تأكيد الحذف" : "Confirm Deletion"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              {lang === "ar"
                ? `هل أنت متأكد من حذف الطاولة رقم ${tableToDelete?.number}؟ لا يمكن التراجع عن هذا الإجراء.`
                : `Are you sure you want to delete table #${tableToDelete?.number}? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse sm:justify-start">
            <AlertDialogCancel>{lang === "ar" ? "تراجع" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white mr-2"
              disabled={deleteTable.isPending}
              onClick={() => {
                if (tableToDelete) deleteTable.mutate(tableToDelete.id);
              }}
            >
              {lang === "ar" ? "نعم، احذف" : "Yes, Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Self-Ordering QR Code Generator */}
      <Dialog open={isQrModalOpen} onOpenChange={setIsQrModalOpen}>
        <DialogContent
          dir={lang === "ar" ? "rtl" : "ltr"}
          className="sm:max-w-lg bg-white p-4 sm:p-5 max-h-[92vh] overflow-y-auto"
        >
          <DialogHeader className={lang === "ar" ? "text-right" : "text-left"}>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <QrCode className="text-indigo-600" />
              {lang === "ar" ? "إصدار باركود الطلب الذاتي للعملاء" : "Self-Ordering QR Code"}
            </DialogTitle>
          </DialogHeader>

          {(() => {
            const selectedT = tablesList.find((t) => t.id === qrTableId);
            const displayedTableNumber = selectedT ? selectedT.number : "";
            const displayedTableName = selectedT?.name || "";
            const cleanBaseUrl = (customBaseUrl || "https://jupa-sep.vercel.app")
              .trim()
              .replace(/\/+$/, "")
              .replace(/\/menu$/i, "");

            const params = new URLSearchParams();
            params.set("page", "menu");
            if (qrTableId) params.set("tableId", qrTableId);
            if (displayedTableNumber) params.set("table", String(displayedTableNumber));
            if (displayedTableName) params.set("tableName", displayedTableName);
            if (qrZone.trim()) params.set("zone", qrZone.trim());
            if (qrCurrency) params.set("currency", qrCurrency);
            params.set("lang", qrMenuLang);
            params.set("allowLangSwitch", qrAllowLangSwitch ? "1" : "0");
            if (qrWelcomeMessage.trim()) params.set("welcome", qrWelcomeMessage.trim());

            const isLovableHost = cleanBaseUrl.includes(".lovable.app");
            // On Vercel (which has SPA rewrites in vercel.json), /menu?... opens the customer menu directly.
            // On Lovable static hosts, /?page=menu&... avoids 404 and routes straight to /menu.
            const qrUrl = isLovableHost
              ? `${cleanBaseUrl}/?${params.toString()}`
              : `${cleanBaseUrl}/menu?${params.toString()}`;
            const directPreviewPath = `/menu?${params.toString()}`;

            return (
              <>
                <div className="space-y-3 py-1 print:hidden">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label
                        className={
                          lang === "ar"
                            ? "text-right block text-xs font-bold text-slate-700"
                            : "text-left block text-xs font-bold text-slate-700"
                        }
                      >
                        {lang === "ar"
                          ? "رابط منصة Vercel (النطاق العام لصفحة طلبات العملاء)"
                          : "Vercel Domain (Public Customer Menu URL)"}
                      </Label>
                      {typeof window !== "undefined" &&
                        window.location.origin &&
                        !window.location.origin.includes("localhost") && (
                          <button
                            type="button"
                            onClick={() => {
                              const orig = window.location.origin.replace(/\/+$/, "");
                              setCustomBaseUrl(orig);
                              window.localStorage.setItem("restocash_qr_base_url_v1", orig);
                            }}
                            className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                          >
                            {lang === "ar" ? "استخدام الرابط الحالي" : "Use current domain"}
                          </button>
                        )}
                    </div>
                    <Input
                      value={customBaseUrl}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomBaseUrl(val);
                        if (typeof window !== "undefined") {
                          window.localStorage.setItem(
                            "restocash_qr_base_url_v1",
                            val.trim().replace(/\/+$/, ""),
                          );
                        }
                      }}
                      placeholder="https://your-project.vercel.app"
                      className={`h-10 text-xs font-mono ${lang === "ar" ? "text-right" : "text-left"}`}
                    />
                    <p className="text-[11px] text-slate-500 font-medium">
                      {lang === "ar"
                        ? `الرابط النهائي للباركود على Vercel: ${qrUrl}`
                        : `Final QR URL on Vercel: ${qrUrl}`}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label
                        className={
                          lang === "ar"
                            ? "text-right block text-xs font-bold text-slate-700"
                            : "text-left block text-xs font-bold text-slate-700"
                        }
                      >
                        {lang === "ar" ? "رقم الطاولة" : "Table Number"}
                      </Label>
                      <select
                        value={qrTableId}
                        onChange={(e) => setQrTableId(e.target.value)}
                        className={`w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 ${lang === "ar" ? "text-right" : "text-left"}`}
                      >
                        <option value="">
                          {lang === "ar"
                            ? "-- بدون طاولة محددة (سفري / عام) --"
                            : "-- No specific table (Takeaway / General) --"}
                        </option>
                        {tablesList.map((t) => (
                          <option key={t.id} value={t.id}>
                            #{t.number} — {t.name || `طاولة ${t.number}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        className={
                          lang === "ar"
                            ? "text-right block text-xs font-bold text-slate-700"
                            : "text-left block text-xs font-bold text-slate-700"
                        }
                      >
                        {lang === "ar"
                          ? "مكان الطاولة / القسم (يظهر للكابتن)"
                          : "Table Location / Zone"}
                      </Label>
                      <Input
                        list="captain-qr-zones"
                        value={qrZone}
                        onChange={(e) => setQrZone(e.target.value)}
                        placeholder={lang === "ar" ? "مثال: الصالة الداخلية، التراس..." : "e.g. Indoor Hall, Terrace"}
                        className={`h-10 text-xs font-semibold ${lang === "ar" ? "text-right" : "text-left"}`}
                      />
                      <datalist id="captain-qr-zones">
                        <option value="الصالة الداخلية" />
                        <option value="التراس الخارجي" />
                        <option value="قسم العائلات" />
                        <option value="الحديقة" />
                        <option value="VIP" />
                      </datalist>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label
                        className={
                          lang === "ar"
                            ? "text-right block text-xs font-bold text-slate-700"
                            : "text-left block text-xs font-bold text-slate-700"
                        }
                      >
                        {lang === "ar"
                          ? "لغة صفحة طلب العملاء عند المسح"
                          : "Customer Menu Language"}
                      </Label>
                      <select
                        value={qrMenuLang}
                        onChange={(e) => {
                          const nextLang = e.target.value as "ar" | "en";
                          setQrMenuLang(nextLang);
                          if (
                            nextLang === "en" &&
                            qrWelcomeMessage === "أهلاً بك! يمكنك الطلب الآن."
                          ) {
                            setQrWelcomeMessage("Welcome! Scan to order directly.");
                          } else if (
                            nextLang === "ar" &&
                            qrWelcomeMessage === "Welcome! Scan to order directly."
                          ) {
                            setQrWelcomeMessage("أهلاً بك! يمكنك الطلب الآن.");
                          }
                        }}
                        className={`w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 ${lang === "ar" ? "text-right" : "text-left"}`}
                      >
                        <option value="ar">العربية (Arabic - RTL)</option>
                        <option value="en">الإنجليزية (English - LTR)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        className={
                          lang === "ar"
                            ? "text-right block text-xs font-bold text-slate-700"
                            : "text-left block text-xs font-bold text-slate-700"
                        }
                      >
                        {lang === "ar" ? "العملة المفضلة في المنيو" : "Preferred Currency in Menu"}
                      </Label>
                      <select
                        value={qrCurrency}
                        onChange={(e) => setQrCurrency(e.target.value)}
                        className={`w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 ${lang === "ar" ? "text-right" : "text-left"}`}
                      >
                        <option value="EGP">جنيه مصري (EGP)</option>
                        <option value="USD">دولار أمريكي (USD)</option>
                        <option value="EUR">يورو (EUR)</option>
                        <option value="SAR">ريال سعودي (SAR)</option>
                        <option value="AED">درهم إماراتي (AED)</option>
                        <option value="SSP">جنيه جنوب السودان (SSP)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                    <span className="text-xs font-bold text-slate-700">
                      {lang === "ar"
                        ? "السماح للعميل بتبديل اللغة (عربي / EN) داخل صفحة الطلب"
                        : "Allow customer to switch language (AR / EN) inside menu"}
                    </span>
                    <input
                      type="checkbox"
                      checked={qrAllowLangSwitch}
                      onChange={(e) => setQrAllowLangSwitch(e.target.checked)}
                      className="h-4 w-4 accent-indigo-600 rounded cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      className={
                        lang === "ar"
                          ? "text-right block text-xs font-bold text-slate-700"
                          : "text-left block text-xs font-bold text-slate-700"
                      }
                    >
                      {lang === "ar" ? "رسالة الترحيب" : "Welcome Message"}
                    </Label>
                    <Input
                      value={qrWelcomeMessage}
                      onChange={(e) => setQrWelcomeMessage(e.target.value)}
                      className={`h-10 text-sm ${lang === "ar" ? "text-right" : "text-left"}`}
                    />
                  </div>
                </div>

                <div
                  className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-200 my-1"
                  id="print-qr-area"
                >
                  <h3 className="text-base font-black text-slate-800 mb-1 text-center">
                    {qrWelcomeMessage ||
                      (qrMenuLang === "en" ? "Welcome!" : "أهلاً بك!")}
                  </h3>
                  {(displayedTableNumber || qrZone) && (
                    <p className="text-sm font-bold text-indigo-700 mb-3" id="print-table-number">
                      {[
                        displayedTableNumber
                          ? qrMenuLang === "en"
                            ? `Table #${displayedTableNumber}`
                            : `طاولة رقم ${displayedTableNumber}`
                          : "",
                        qrZone,
                      ]
                        .filter(Boolean)
                        .join(" — ")}
                    </p>
                  )}
                  {!displayedTableNumber && !qrZone && <div className="mb-3" />}

                  <div
                    className="bg-white p-3 rounded-2xl shadow-xs border border-slate-200"
                    id="print-qr-svg"
                  >
                    <QRCodeSVG value={qrUrl} size={170} level={"M"} includeMargin={true} />
                  </div>
                  <p className="text-[11px] font-bold text-slate-500 mt-3 text-center">
                    {qrMenuLang === "en"
                      ? "Scan QR code with your phone camera to order directly"
                      : "قم بمسح الباركود بكاميرا الهاتف للطلب المباشر"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 print:hidden">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (typeof navigator !== "undefined" && navigator.clipboard) {
                        navigator.clipboard.writeText(qrUrl);
                        toast({
                          title: lang === "ar" ? "تم نسخ رابط الباركود" : "QR Link Copied",
                          description: qrUrl,
                        });
                      }
                    }}
                    className="flex-1 h-9 text-xs font-bold rounded-xl"
                  >
                    {lang === "ar" ? "نسخ رابط الباركود" : "Copy QR Link"}
                  </Button>
                  <Link
                    to={directPreviewPath as any}
                    className="flex-1 inline-flex items-center justify-center h-9 px-3 text-xs font-bold rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                  >
                    {lang === "ar" ? "معاينة صفحة العميل الآن" : "Preview Customer Page"}
                  </Link>
                </div>

                <DialogFooter className="sm:justify-between mt-2 pt-2 border-t border-slate-100 flex-row gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsQrModalOpen(false)}
                    className="print:hidden flex-1 sm:flex-none h-10 rounded-xl"
                  >
                    {lang === "ar" ? "إغلاق" : "Close"}
                  </Button>
                  <Button
                    className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 print:hidden flex-1 sm:flex-none h-10 rounded-xl"
                    onClick={() => {
                      window.print();
                    }}
                  >
                    <Printer size={16} />
                    {lang === "ar" ? "طباعة الباركود" : "Print QR Code"}
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
