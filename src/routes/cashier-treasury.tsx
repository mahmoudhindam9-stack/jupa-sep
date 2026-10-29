// @ts-nocheck
import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { currentUserHasPermission, signOutCurrentUser } from "@/shared/services/userAuthorization";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { erpStore } from "@/shared/services/erpStore";
import { useSettings } from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";
import { AppMainNavbar } from "@/components/navigation/AppMainNavbar";
import { AppBreadcrumbBar } from "@/components/navigation/AppBreadcrumbBar";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { inventoryService } from "@/features/inventory/services/inventoryService";
import { printAccountingDocument } from "@/shared/utils/printAccountingDocument";
import { Order } from "@/shared/types";
import { menuService } from "@/features/menu/services/menuService";
import {
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  History,
  ArrowLeftRight,
  Wallet,
  ArrowLeft,
  Calendar,
  User,
  ShieldCheck,
  Building2,
  ShoppingBag,
  RotateCcw,
  XCircle,
  FileSpreadsheet,
  FileText,
  CreditCard,
  Smartphone,
  Clock,
  Loader2,
  Filter,
  Sparkles,
  CalendarDays,
  X,
  CheckCircle2,
  RefreshCw,
  Zap,
  Printer,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/cashier-treasury")({
  head: () => ({ meta: [{ title: "تفاصيل خزينة الكاشير - Cashier Treasury" }] }),
  component: CashierTreasuryPage,
});

import {
  CashierTreasuryModals,
  getOrderCurrency,
  getOrderOriginalAmount,
} from "@/components/treasury/CashierTreasuryModals";

function CashierTreasuryPage() {
  const { lang, exchangeRates } = useSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [erpState, setErpState] = useState(erpStore.getState());
  const [searchTerm, setSearchTerm] = useState("");
  const [orderSearchTerm, setOrderSearchTerm] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"logs" | "orders">("orders");
  const [confirmRefundId, setConfirmRefundId] = useState<string | null>(null);
  const [refundOrderDialog, setRefundOrderDialog] = useState<Order | null>(null);
  const [refundReason, setRefundReason] = useState<string>("طلب العميل إلغاء الوجبة");
  const [refundTreasury, setRefundTreasury] = useState<string>(
    erpStore.getState().treasuries.find((t) => t.linked_to_restaurant)?.id || "tr-1",
  );
  const [refundContainer, setRefundContainer] = useState<string>("");
  const [customRefundAmount, setCustomRefundAmount] = useState<number>(0);
  const [customRefundCurrency, setCustomRefundCurrency] = useState<string>("USD");
  const [customRefundPaymentMethod, setCustomRefundPaymentMethod] = useState<string>("cash");

  // Date Filtering & Export State
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [activePreset, setActivePreset] = useState<string>("all");
  const [exportDialogOpen, setExportDialogOpen] = useState<boolean>(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState<boolean>(false);
  const [transferTargetTreasury, setTransferTargetTreasury] = useState<string>("");
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [transferCurrency, setTransferCurrency] = useState<string>("USD");
  const [transferPaymentMethod, setTransferPaymentMethod] = useState<string>("cash");

  // Quick Date Preset Handler
  const applyQuickDate = (preset: string) => {
    setActivePreset(preset);
    const now = new Date();
    const format = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    if (preset === "today") {
      const todayStr = format(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "yesterday") {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yesterdayStr = format(y);
      setStartDate(yesterdayStr);
      setEndDate(yesterdayStr);
    } else if (preset === "last7") {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      setStartDate(format(d));
      setEndDate(format(now));
    } else if (preset === "thisWeek") {
      const d = new Date(now);
      const day = d.getDay();
      // Assume Saturday is start of week in region (day 6)
      const diff = d.getDate() - (day === 6 ? 0 : day + 1);
      const startOfWeek = new Date(d.setDate(diff));
      setStartDate(format(startOfWeek));
      setEndDate(format(now));
    } else if (preset === "thisMonth") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(format(firstDay));
      setEndDate(format(now));
    } else if (preset === "lastMonth") {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(format(firstDay));
      setEndDate(format(lastDay));
    } else {
      setStartDate("");
      setEndDate("");
    }
  };

  useEffect(() => {
    if (refundOrderDialog) {
      const payment = refundOrderDialog.payment_method;
      const currency = getOrderCurrency(refundOrderDialog);
      const targetTreasury = erpState.treasuries.find((t) => t.id === refundTreasury);

      if (targetTreasury?.containers && targetTreasury.containers.length > 0) {
        const match =
          targetTreasury.containers.find((c) => {
            if (c.currency !== currency) return false;
            if (payment === "cash" && c.type === "cash") return true;
            if (payment === "card" && (c.type === "card" || c.type === "bank")) return true;
            if (payment === "wallet" && c.type === "wallet") return true;
            return true;
          }) ||
          targetTreasury.containers.find((c) => c.currency === currency) ||
          targetTreasury.containers[0];

        if (match) {
          setRefundContainer(match.id);
        } else {
          setRefundContainer("");
        }
      } else {
        setRefundContainer("");
      }
    }
  }, [refundOrderDialog, refundTreasury, erpState.treasuries]);

  // Hydration safeguard & real-time store subscription
  useEffect(() => {
    erpStore.deduplicateSalesTreasuryTransactions(true);
    setErpState(erpStore.getState());
    setIsMounted(true);
    return erpStore.subscribe(() => {
      setErpState(erpStore.getState());
    });
  }, []);

  const cashierTreasuryId = erpState.treasuries.find((t) => t.linked_to_restaurant)?.id || "tr-1";
  const cashierTreasury = erpState.treasuries.find((t) => t.id === cashierTreasuryId) || {
    id: cashierTreasuryId,
    branch_id: "branch-1",
    name_ar: "خزينة الكاشير",
    type: "cash" as const,
    currency: "EGP",
    balance: 0,
    is_open: true,
    opening_balance: 0,
    responsible_employee: "غير محدد",
    status: "active" as const,
  };

  const transactions = erpState.treasuryTransactions.filter(
    (tx) => tx.treasury_id === cashierTreasuryId,
  );

  // Calculate Cashier Treasury Breakdown for currencies
  const cashierBreakdown = (() => {
    const opBal = cashierTreasury.opening_balance ?? 0;

    let cashEGP = opBal;
    let cashUSD = 0;
    let cashSSP = 0;
    let cardUSD = 0;
    let walletSSP = 0;
    let cardEGP = 0;
    let walletEGP = 0;
    let cardSSP = 0;
    let walletUSD = 0;

    const txs = erpState.treasuryTransactions.filter((tx) => tx.treasury_id === cashierTreasury.id);
    txs.forEach((tx) => {
      const isIncoming = tx.type === "deposit" || tx.type === "sales" || tx.type === "transfer_in";
      const amt = isIncoming ? tx.amount : -tx.amount;
      const pm = tx.payment_method || "cash";
      const curr = tx.currency || "EGP";

      if (curr === "EGP" && pm === "cash") cashEGP += amt;
      else if (curr === "EGP" && pm === "card") cardEGP += amt;
      else if (curr === "EGP" && pm === "wallet") walletEGP += amt;
      else if (curr === "USD" && pm === "cash") cashUSD += amt;
      else if (curr === "USD" && pm === "card") cardUSD += amt;
      else if (curr === "USD" && pm === "wallet") walletUSD += amt;
      else if (curr === "SSP" && pm === "cash") cashSSP += amt;
      else if (curr === "SSP" && pm === "card") cardSSP += amt;
      else if (curr === "SSP" && pm === "wallet") walletSSP += amt;
    });
    return {
      cashEGP,
      cashUSD,
      cashSSP,
      cardUSD,
      walletSSP,
      cardEGP,
      walletEGP,
      cardSSP,
      walletUSD,
    };
  })();

  // Keep track of transaction count & latest ID for live notifications (excluding initial page-load sync)
  const [prevTxSnapshot, setPrevTxSnapshot] = useState<{
    count: number;
    latestId: string | null;
  } | null>(null);

  useEffect(() => {
    if (isMounted) {
      const currentCount = transactions.length;
      const currentLatestId = transactions[0]?.id || null;
      if (
        prevTxSnapshot !== null &&
        currentCount > prevTxSnapshot.count &&
        currentLatestId !== prevTxSnapshot.latestId
      ) {
        const latestTx = transactions[0];
        if (latestTx) {
          toast({
            title: lang === "ar" ? "🔔 حركة مالية جديدة بالخزينة" : "🔔 New Cashier Treasury Entry",
            description: `${latestTx.note} | بقيمة ${latestTx.amount.toLocaleString()} ${latestTx.currency}`,
            variant: "default",
          });
        }
      }
      if (
        prevTxSnapshot === null ||
        prevTxSnapshot.count !== currentCount ||
        prevTxSnapshot.latestId !== currentLatestId
      ) {
        setPrevTxSnapshot({ count: currentCount, latestId: currentLatestId });
      }
    }
  }, [transactions, isMounted, prevTxSnapshot, lang, toast]);

  // Helper to read locally cached POS orders
  const getLocalOrders = (): Order[] => {
    try {
      return JSON.parse(localStorage.getItem("pos_local_orders") || "[]");
    } catch (e) {
      return [];
    }
  };

  // Query restaurant orders from Supabase with graceful fallback
  const ordersQuery = useQuery({
    queryKey: ["cashier-treasury", "orders"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false });

        const localOrders = getLocalOrders();
        if (error) {
          console.warn("Supabase fetch order error, returning local orders:", error);
          return localOrders;
        }
        const supabaseOrders = (data ?? []) as unknown as Order[];
        const mergedMap = new Map<string, Order>();
        supabaseOrders.forEach((o) => mergedMap.set(String(o.id), o));
        localOrders.forEach((o) => {
          if (!mergedMap.has(String(o.id))) {
            mergedMap.set(String(o.id), o);
          }
        });
        return Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
      } catch (err) {
        console.warn("Error querying orders from Supabase:", err);
        return getLocalOrders();
      }
    },
    enabled: isMounted,
  });

  const menuCategoriesQuery = useQuery({
    queryKey: ["menu_categories"],
    queryFn: () => menuService.getCategories(),
    enabled: isMounted,
  });

  const menuItemsQuery = useQuery({
    queryKey: ["menu_items"],
    queryFn: () => menuService.getMenuItems(),
    enabled: isMounted,
  });

  useEffect(() => {
    if (!isMounted) return;
    const channel = supabase
      .channel("cashier_orders_bridge")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        queryClient.invalidateQueries({ queryKey: ["cashier-treasury", "orders"] });
      })
      .subscribe();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "pos_local_orders" || e.key === "restocash_erp_state") {
        queryClient.invalidateQueries({ queryKey: ["cashier-treasury", "orders"] });
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("storage", handleStorage);
    };
  }, [isMounted, queryClient]);

  const [isSyncing, setIsSyncing] = useState(false);

  // Sync operational sales with cashier treasury
  const handleSyncSales = async (showToastIfSynced = true) => {
    setIsSyncing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["cashier-treasury", "orders"] });

      const orders =
        (queryClient.getQueryData(["cashier-treasury", "orders"]) as Order[]) || getLocalOrders();
      const res = erpStore.syncOperationalSalesWithTreasury(orders, cashierTreasuryId);

      // Update UI state with new store values directly
      setErpState(erpStore.getState());

      if (res.syncedCount > 0) {
        toast({
          title: lang === "ar" ? "⚡ تمت المزامنة بنجاح" : "⚡ Sales Synced Successfully",
          description:
            lang === "ar"
              ? `تمت مزامنة ${res.syncedCount} طلب مبيعات بقيمة إجمالية ${res.totalAmountSynced.toLocaleString()} ج.م مع خزينة الكاشير.`
              : `Synced ${res.syncedCount} sales orders totaling ${res.totalAmountSynced.toLocaleString()} to cashier treasury.`,
          variant: "default",
        });
        queryClient.invalidateQueries({ queryKey: ["cashier-treasury"] });
      } else if (showToastIfSynced) {
        toast({
          title: lang === "ar" ? "🟢 المزامنة مكتملة" : "🟢 Fully Synced",
          description:
            lang === "ar"
              ? `جميع مبيعات اليوم التشغيلية (${res.alreadySyncedCount} طلب) متزامنة بالفعل مع خزينة الكاشير.`
              : `All today sales (${res.alreadySyncedCount} orders) are already synced with cashier treasury.`,
          variant: "default",
        });
      }
    } catch (err) {
      console.error("Sync error:", err);
      toast({
        title: lang === "ar" ? "خطأ في المزامنة" : "Sync Error",
        description:
          lang === "ar"
            ? "حدث خطأ أثناء مزامنة المبيعات مع الخزينة"
            : "An error occurred during sales sync",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTransferMoney = () => {
    if (!transferTargetTreasury || transferAmount <= 0) {
      toast({
        title: lang === "ar" ? "خطأ" : "Error",
        description:
          lang === "ar"
            ? "يرجى تحديد الخزينة المستهدفة وإدخال مبلغ صحيح"
            : "Select target treasury and enter valid amount",
        variant: "destructive",
      });
      return;
    }

    const targetName =
      erpState.treasuries.find((t) => t.id === transferTargetTreasury)?.name_ar || "";

    erpStore.addTreasuryTransaction(
      cashierTreasuryId,
      "transfer_out",
      transferAmount,
      transferCurrency,
      `تحويل نقدية إلى ${targetName}`,
      undefined,
      transferPaymentMethod,
      undefined,
    );

    erpStore.addTreasuryTransaction(
      transferTargetTreasury,
      "transfer_in",
      transferAmount,
      transferCurrency,
      `استلام نقدية من ${cashierTreasury.name_ar}`,
      undefined,
      transferPaymentMethod,
      undefined,
    );

    erpStore.addJournalEntry(
      `إقفال شيفت / تحويل نقدية من ${cashierTreasury.name_ar} إلى ${targetName}`,
      [
        { account_code: "101000", debit: transferAmount, credit: 0 },
        { account_code: "101000", debit: 0, credit: transferAmount },
      ],
      "SHIFT-" + Date.now().toString().slice(-6),
    );

    toast({
      title: lang === "ar" ? "تم التحويل بنجاح" : "Transferred Successfully",
      description:
        lang === "ar"
          ? `تم تحويل مبلغ ${transferAmount} ${transferCurrency}`
          : `Transferred ${transferAmount} ${transferCurrency}`,
      variant: "default",
    });
    setTransferDialogOpen(false);
    setTransferAmount(0);
  };

  // Auto-sync whenever orders data finishes loading
  useEffect(() => {
    if (ordersQuery.data && ordersQuery.data.length > 0) {
      erpStore.syncOperationalSalesWithTreasury(ordersQuery.data, cashierTreasuryId);
    }
  }, [ordersQuery.data, cashierTreasuryId]);

  // Operational Sales Synchronization Stats
  const operationalSalesStats = (() => {
    const orders = ordersQuery.data || [];
    const validOrders = orders.filter(
      (o) =>
        o &&
        o.order_number &&
        (o.status === "completed" || o.payment_status === "paid") &&
        o.status !== "cancelled" &&
        o.status !== "refunded" &&
        o.status !== "pending" &&
        Number(o.total || 0) > 0,
    );
    const totalOrdersCount = validOrders.length;
    let unsyncedCount = 0;
    let totalSalesAmount = 0;

    validOrders.forEach((o) => {
      const orderRef = `INV-${o.order_number}`;
      const isSynced = erpState.treasuryTransactions.some(
        (tx) =>
          tx.treasury_id === cashierTreasuryId &&
          (tx.related_entity_id === orderRef ||
            (typeof tx.note === "string" && tx.note.includes(`طلب رقم #${o.order_number}`))),
      );
      if (!isSynced) unsyncedCount++;
      totalSalesAmount += Number(o.total || 0);
    });

    return { totalOrdersCount, unsyncedCount, totalSalesAmount };
  })();

  const shiftSalesAmount = (() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return (ordersQuery.data || [])
      .filter((o) => o && o.status !== "cancelled" && new Date(o.created_at || now) >= start)
      .reduce((sum, o) => sum + Number(o.total || 0), 0);
  })();

  // Refund mutation linked directly to order and its original currency
  const refundMutation = useMutation({
    mutationFn: async ({
      order,
      treasuryId,
      containerId,
      reason,
      amount,
      currency,
      paymentMethod,
    }: {
      order: Order;
      treasuryId: string;
      containerId: string;
      reason?: string;
      amount: number;
      currency: string;
      paymentMethod: string;
    }) => {
      const orderCurrency = currency;
      const refundAmount = amount;

      // 1. Post Sales Return Journal Entry & Treasury Withdrawal in Order's Exact Currency
      erpStore.postSalesReturnJournal(
        order.order_number,
        refundAmount,
        paymentMethod,
        erpState.currentBranchId || "BR-001",
        orderCurrency,
        treasuryId,
        containerId,
      );

      // 2. Restore Raw Ingredients in Warehouse Inventory
      try {
        const result = await inventoryService.restoreOrderIngredients(
          order.id,
          order.items,
          order.order_number,
        );
        if (!result.success) {
          console.warn("Inventory restoration warning:", result.error);
        }
      } catch (err) {
        console.error("Error in restoreOrderIngredients:", err);
      }

      // 3. Update Order Status to Cancelled in Supabase
      try {
        await supabase
          .from("orders")
          .update({
            status: "cancelled",
            notes:
              (order.notes ? order.notes + " | " : "") + `مرتجع مالي: ${reason || "طلب العميل"}`,
          })
          .eq("id", order.id);
      } catch (err) {
        console.warn("Could not update order status in Supabase:", err);
      }

      // 4. Update Order Status in Local Storage
      try {
        const stored = getLocalOrders();
        const updated = stored.map((o: any) =>
          o.id === order.id
            ? {
                ...o,
                status: "cancelled",
                notes: (o.notes ? o.notes + " | " : "") + `مرتجع مالي: ${reason || "طلب العميل"}`,
              }
            : o,
        );
        localStorage.setItem("pos_local_orders", JSON.stringify(updated));
      } catch (err) {
        console.error("Error updating local order status:", err);
      }

      // 5. Log Action in ERP Audit
      erpStore.logAction(
        "CASHIER",
        "ارتجاع طلب وتفريغ قيد",
        `تم إجراء مرتجع للطلب #${order.order_number} بمبلغ ${refundAmount.toLocaleString()} ${orderCurrency} - السبب: ${reason || "إلغاء طلب"}`,
        "DELETE",
      );

      return { success: true };
    },
    onSuccess: (_, { order, amount, currency }) => {
      const orderCurrency = currency;
      const refundAmount = amount;
      queryClient.invalidateQueries({ queryKey: ["cashier-treasury", "orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "warehouse_inventory"] });
      setConfirmRefundId(null);
      setRefundOrderDialog(null);
      toast({
        title: lang === "ar" ? "✅ تم استرجاع الطلب بنجاح" : "✅ Order Refunded Successfully",
        description:
          lang === "ar"
            ? `تم إلغاء الطلب #${order.order_number} وإعادة مبلغ ${refundAmount.toLocaleString()} ${orderCurrency} للخزينة وإرجاع المكونات للمخزن`
            : `Order #${order.order_number} cancelled and ${refundAmount.toLocaleString()} ${orderCurrency} refunded to treasury.`,
        variant: "default",
      });
    },
    onError: (err: any) => {
      toast({
        title: lang === "ar" ? "❌ خطأ في عملية الارتجاع" : "❌ Refund Process Failed",
        description: err.message || String(err),
        variant: "destructive",
      });
    },
  });

  // Daily Cashflow Calculations
  const dailyIncomeByCurrency = transactions
    .filter((tx) => tx.type === "sales" || tx.type === "deposit" || tx.type === "transfer_in")
    .reduce(
      (acc, tx) => {
        const curr = tx.currency || "EGP";
        acc[curr] = (acc[curr] || 0) + tx.amount;
        return acc;
      },
      {} as Record<string, number>,
    );

  const dailyExpensesByCurrency = transactions
    .filter((tx) => tx.type === "withdrawal" || tx.type === "transfer_out")
    .reduce(
      (acc, tx) => {
        const curr = tx.currency || "EGP";
        acc[curr] = (acc[curr] || 0) + tx.amount;
        return acc;
      },
      {} as Record<string, number>,
    );

  // Filtered Transactions with Search AND Date Range Filtering
  const filteredTransactions = transactions.filter((tx) => {
    // Search Term Filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const noteMatch = tx.note?.toLowerCase().includes(term);
      const typeMatch = tx.type?.toLowerCase().includes(term);
      const relatedIdMatch = tx.related_entity_id?.toLowerCase().includes(term);
      if (!(noteMatch || typeMatch || relatedIdMatch)) return false;
    }

    // Date Range Filter
    const txDateStr = tx.date || tx.created_at;
    if (txDateStr) {
      const txDate = new Date(txDateStr);
      if (startDate) {
        const start = new Date(`${startDate}T00:00:00`);
        if (txDate < start) return false;
      }
      if (endDate) {
        const end = new Date(`${endDate}T23:59:59`);
        if (txDate > end) return false;
      }
    }

    return true;
  });

  // Filtered Orders with Search AND Date Range Filtering
  const filteredOrders = (ordersQuery.data ?? []).filter((order) => {
    if (orderSearchTerm.trim()) {
      const term = orderSearchTerm.toLowerCase();
      const orderNumMatch = String(order.order_number).includes(term);
      const paymentMatch = order.payment_method?.toLowerCase().includes(term);
      const statusMatch = order.status?.toLowerCase().includes(term);
      if (!(orderNumMatch || paymentMatch || statusMatch)) return false;
    }

    const orderDateStr = order.created_at;
    if (orderDateStr) {
      const orderDate = new Date(orderDateStr);
      if (startDate) {
        const start = new Date(`${startDate}T00:00:00`);
        if (orderDate < start) return false;
      }
      if (endDate) {
        const end = new Date(`${endDate}T23:59:59`);
        if (orderDate > end) return false;
      }
    }

    return true;
  });

  // Export Excel Function with Date Range
  const getCashierReportRows = (fromDate = startDate, toDate = endDate) => {
    return transactions
      .filter((tx) => {
        const date = new Date(tx.date || tx.created_at || Date.now());
        if (fromDate && date < new Date(`${fromDate}T00:00:00`)) return false;
        if (toDate && date > new Date(`${toDate}T23:59:59`)) return false;
        return true;
      })
      .map((tx) => ({
        number: tx.id,
        date: new Date(tx.date || tx.created_at || Date.now()).toLocaleString("ar-EG"),
        type:
          (
            {
              deposit: "إيداع نقدي",
              sales: "مبيعات POS",
              withdrawal: "مسحوبات / مصاريف",
              transfer_in: "تحويل وارد",
              transfer_out: "تحويل صادر",
            } as any
          )[tx.type] || tx.type,
        method:
          ({ cash: "كاش", card: "بطاقة / فيزا", wallet: "محفظة" } as any)[
            tx.payment_method || "cash"
          ] ||
          tx.payment_method ||
          "-",
        currency: tx.currency || "EGP",
        amount: Number(tx.amount || 0),
        note: tx.note || "-",
        reference: tx.related_entity_id || "-",
      }));
  };

  const [showReportPreview, setShowReportPreview] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  const getCategorizedSales = (orders: any[]) => {
    const categorized: Record<string, { total: number; qty: number }> = {};
    const menuItems = menuItemsQuery.data || [];
    const menuCategories = menuCategoriesQuery.data || [];

    const extendedInventoryData = erpStore.getState().extendedInventoryData || {};
    orders.forEach((order) => {
      let items = order.items;
      if (typeof items === "string") {
        try {
          items = JSON.parse(items);
        } catch (e) {
          items = [];
        }
      }
      if (!Array.isArray(items)) items = [];
      items.forEach((item: any) => {
        let categoryName = "غير مصنف";
        const menuItem = menuItems.find((m: any) => m.id === (item.menu_item_id || item.id));

        let foundInvCategory = null;
        if (menuItem) {
          if (menuItem.inventory_tracking && menuItem.inventory_tracking !== "not_tracked") {
            const ext = extendedInventoryData[menuItem.inventory_tracking];
            if (ext && ext.category) foundInvCategory = ext.category;
          } else if (menuItem.ingredients && menuItem.ingredients.length > 0) {
            const ext = extendedInventoryData[menuItem.ingredients[0].inventory_id];
            if (ext && ext.category) foundInvCategory = ext.category;
          }
        }

        if (foundInvCategory) {
          categoryName = foundInvCategory;
        } else if (menuItem && menuItem.category_id) {
          const category = menuCategories.find((c: any) => c.id === menuItem.category_id);
          if (category) categoryName = category.name_ar || category.name_en || categoryName;
        } else if (item.category) {
          categoryName = item.category;
        }

        if (!categorized[categoryName]) categorized[categoryName] = { total: 0, qty: 0 };
        categorized[categoryName].total += (item.price || 0) * (item.quantity || 0);
        categorized[categoryName].qty += item.quantity || 0;
      });
    });
    return categorized;
  };

  const printCashierReport = (mode: "shift" | "range") => {
    const today = new Date().toISOString().slice(0, 10);
    const from = mode === "shift" ? today : startDate;
    const to = mode === "shift" ? today : endDate;

    // Filter orders for the period
    const allOrders = ordersQuery.data || [];
    const filteredOrders = allOrders.filter((order: any) => {
      const date = new Date(order.created_at);
      if (from && date < new Date(`${from}T00:00:00`)) return false;
      if (to && date > new Date(`${to}T23:59:59`)) return false;
      if (order.status === "cancelled") return false;
      return true;
    });

    const rows = filteredOrders.map((order: any) => ({
      number: order.order_number,
      date: new Date(order.created_at).toLocaleString("ar-EG"),
      type:
        order.order_type === "dine_in"
          ? "صالة"
          : order.order_type === "takeaway"
            ? "تيك أواي"
            : order.order_type === "delivery"
              ? "دليفري"
              : "أخرى",
      method:
        order.payment_method === "cash"
          ? "نقدي"
          : order.payment_method === "card"
            ? "بطاقة"
            : order.payment_method,
      currency: getOrderCurrency(order, erpState.treasuryTransactions),
      amount: Number(order.total || 0).toLocaleString("en-US"),
      notes: order.notes || "-",
    }));

    const categorizedSales = getCategorizedSales(filteredOrders);

    const totalSalesAmount = filteredOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

    setReportData({
      title: mode === "shift" ? "تقرير مبيعات المطعم (شيفت)" : "تقرير مبيعات المطعم (فترة)",
      subtitle: `${from || "بداية مفتوحة"} → ${to || "نهاية مفتوحة"}`,
      documentNo: `SALES-${today.replaceAll("-", "")}`,
      columns: [
        { key: "number", label: "رقم الطلب", align: "center" },
        { key: "date", label: "التاريخ والوقت" },
        { key: "type", label: "نوع الطلب", align: "center" },
        { key: "method", label: "طريقة الدفع", align: "center" },
        { key: "currency", label: "العملة", align: "center" },
        { key: "amount", label: "الإجمالي", align: "left" },
        { key: "notes", label: "ملاحظات" },
      ],
      rows,
      totals: [
        { label: "عدد الطلبات", value: String(rows.length) },
        {
          label: "إجمالي المبيعات",
          value: totalSalesAmount.toLocaleString("en-US"),
        },
      ],
      categorizedSales,
    });
    setShowReportPreview(true);
  };

  const handleConfirmPrint = () => {
    const summaryHtml = `
      <h3 style="font-size:14px; margin-top:0; margin-bottom:8px;">المبيعات حسب الفئة</h3>
      ${Object.entries(reportData.categorizedSales)
        .map(
          ([cat, data]: [string, any]) => `
        <div style="display:flex; justify-content:space-between; font-size:12px; border-bottom:1px solid #e2e8f0; padding:4px 0;">
          <span>${cat}</span>
          <span>${data.qty} قطعة | ${data.total.toFixed(2)} EGP</span>
        </div>
      `,
        )
        .join("")}
    `;
    printAccountingDocument({ ...reportData, summaryHtml });
    setShowReportPreview(false);
  };

  const exportCashierReportToExcel = (mode: "shift" | "range") => {
    const today = new Date().toISOString().slice(0, 10);
    const from = mode === "shift" ? today : startDate;
    const to = mode === "shift" ? today : endDate;
    const rows = getCashierReportRows(from, to);
    if (!rows.length) {
      toast({
        title: "لا توجد حركات",
        description: "لا توجد بيانات ضمن الفترة المختارة.",
        variant: "destructive",
      });
      return;
    }
    const ws = XLSX.utils.json_to_sheet(
      rows.map((r) => ({
        "رقم الحركة": r.number,
        "التاريخ والوقت": r.date,
        "نوع الحركة": r.type,
        "طريقة الدفع": r.method,
        العملة: r.currency,
        المبلغ: r.amount,
        البيان: r.note,
        المرجع: r.reference,
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "خزينة الكاشير");
    XLSX.writeFile(wb, `خزينة_الكاشير_${from || "all"}_${to || "all"}.xlsx`);
  };

  const exportToExcel = () => {
    const typeMap: Record<string, string> = {
      deposit: "إيداع نقدي",
      sales: "مبيعات POS",
      withdrawal: "مسحوبات / مصاريف",
      transfer_in: "تحويل وارد",
      transfer_out: "تحويل صادر",
    };
    const pmMap: Record<string, string> = {
      cash: "كاش",
      card: "بطاقة بنكية / فيزا",
      wallet: "محفظة إلكترونية",
    };
    const rows = filteredTransactions.map((tx) => ({
      "رقم الحركة": tx.id,
      "التاريخ والوقت": new Date(tx.date || tx.created_at || Date.now()).toLocaleString("ar-EG"),
      "نوع الحركة": typeMap[tx.type] || tx.type,
      "طريقة الدفع": pmMap[tx.payment_method || "cash"] || tx.payment_method,
      العملة: tx.currency || "EGP",
      المبلغ: tx.amount,
      البيان: tx.note || "-",
      "الرقم المرجعي": tx.related_entity_id || "-",
    }));

    if (rows.length === 0) {
      toast({
        title: lang === "ar" ? "لا توجد حركات" : "No Records",
        description: lang === "ar" ? "لا توجد بيانات مطابقة لتصديرها" : "No data matching filter",
        variant: "destructive",
      });
      return;
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "حركات الخزينة");

    let filenameDatePart = new Date().toISOString().slice(0, 10);
    if (startDate && endDate) {
      filenameDatePart = `من_${startDate}_إلى_${endDate}`;
    } else if (startDate) {
      filenameDatePart = `من_${startDate}`;
    } else if (endDate) {
      filenameDatePart = `إلى_${endDate}`;
    }

    XLSX.writeFile(wb, `تقرير_حركات_خزينة_الكاشير_${filenameDatePart}.xlsx`);
    toast({
      title: lang === "ar" ? "✅ تم تصدير التقرير" : "✅ Report Exported",
      description:
        lang === "ar"
          ? `تم تصدير ${rows.length} حركة مالية إلى ملف Excel بنجاح.`
          : `${rows.length} transactions exported successfully.`,
      variant: "default",
    });
  };

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
        <header className="px-6 py-5 bg-white border-b border-slate-200/80 sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100/80 border border-emerald-300 flex items-center justify-center text-emerald-700">
                <Wallet size={22} />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                  <span>{lang === "ar" ? "تفاصيل خزينة الكاشير" : "Cashier Treasury Details"}</span>
                </h1>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 p-6 max-w-7xl mx-auto w-full flex items-center justify-center">
          <div className="text-slate-500 font-bold flex items-center gap-2">
            <Loader2 className="animate-spin text-emerald-600" size={18} />
            <span>{lang === "ar" ? "جاري التحميل..." : "Loading..."}</span>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background text-slate-800 dark:text-foreground flex flex-col font-sans">
      {/* 1. Permanent Fixed Main Top Bar */}
      <AppMainNavbar />

      {/* 2. Contextual Breadcrumb Bar */}
      <AppBreadcrumbBar />

      {/* Contextual Cashier Treasury Action Bar */}
      <div className="px-4 sm:px-6 py-3 bg-card/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Wallet size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap text-xs sm:text-sm">
                <h1 className="font-black tracking-tight text-foreground">
                  {lang === "ar" ? "تفاصيل خزينة الكاشير" : "Cashier Treasury Details"}
                </h1>
                <span className="text-muted-foreground">·</span>
                <span className="text-xs font-mono tabular-nums font-bold text-muted-foreground">
                  {lang === "ar" ? "حساب 13010130" : "Acct 13010130"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">
                {lang === "ar"
                  ? "مراقبة الرصيد الفعلي وحركات المبيعات والتحصيلات والمسحوبات والمرتجع الفوري"
                  : "Monitor actual balance, sales entries, collections, and instant refunds"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
            <Button
              onClick={() => {
                setTransferAmount(shiftSalesAmount);
                setTransferDialogOpen(true);
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs h-8 px-3 rounded-lg flex items-center gap-1.5 shadow-2xs transition active:scale-95"
            >
              <ArrowLeftRight size={14} />
              <span>{lang === "ar" ? "تحويل نقدية / إنهاء الشيفت" : "Transfer / End Shift"}</span>
            </Button>

            <Button
              onClick={() => handleSyncSales(true)}
              disabled={isSyncing}
              className={`font-black text-xs h-8 px-3 rounded-lg flex items-center gap-1.5 shadow-2xs transition active:scale-95 ${
                operationalSalesStats.unsyncedCount > 0
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white"
              }`}
            >
              <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
              <span>
                {isSyncing
                  ? lang === "ar"
                    ? "جاري المزامنة..."
                    : "Syncing..."
                  : lang === "ar"
                    ? `مزامنة مبيعات اليوم ${
                        operationalSalesStats.unsyncedCount > 0
                          ? `(${operationalSalesStats.unsyncedCount} معلق)`
                          : ""
                      }`
                    : "Sync Today Sales"}
              </span>
            </Button>

            <Button
              type="button"
              onClick={() => printCashierReport("shift")}
              variant="outline"
              className="font-bold text-xs h-8 px-3 rounded-lg flex items-center gap-1.5"
              title="طباعة شيفت اليوم"
            >
              <Printer size={14} />
              <span>طباعة الشيفت</span>
            </Button>
            <Button
              type="button"
              onClick={() => printCashierReport("range")}
              variant="outline"
              className="font-bold text-xs h-8 px-3 rounded-lg flex items-center gap-1.5"
              title="طباعة التاريخ المحدد"
            >
              <Printer size={14} />
              <span>طباعة الفترة</span>
            </Button>
            <Button
              type="button"
              onClick={() => exportCashierReportToExcel("range")}
              variant="outline"
              className="font-bold text-xs h-8 px-3 rounded-lg flex items-center gap-1.5"
              title="تصدير الفترة إلى Excel"
            >
              <FileSpreadsheet size={14} />
              <span>Excel للفترة</span>
            </Button>
            <Button
              onClick={() => setExportDialogOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 px-3 rounded-lg flex items-center gap-1.5 shadow-2xs transition active:scale-95"
            >
              <FileSpreadsheet size={14} />
              <span>{lang === "ar" ? "تصفية وتصدير Excel" : "Export Custom Excel"}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Dashboard Container */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Core Financial Cards Grid - 5 Cards with Light Colorful Themes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1: Cash EGP */}
          <div className="bg-emerald-50/70 hover:bg-emerald-50 border border-emerald-200/80 rounded-2xl p-5 flex flex-col justify-between shadow-xs transition-all relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-emerald-800 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                <Coins size={15} className="text-emerald-600" />
                {lang === "ar" ? "نقدي (جنيه)" : "Cash (EGP)"}
              </span>
              <span className="text-[10px] bg-white text-emerald-700 border border-emerald-300 px-2 py-0.5 rounded-full font-black shadow-2xs">
                EGP
              </span>
            </div>
            <div className="mt-3">
              <h2 className="text-2xl font-black text-emerald-800 font-mono tracking-tight">
                {cashierBreakdown.cashEGP.toLocaleString()}{" "}
                <span className="text-xs font-bold text-emerald-600">EGP</span>
              </h2>
              <p className="text-[11px] text-emerald-700/80 mt-1 font-semibold">
                {lang === "ar" ? "الرصيد النقدي بالجنيه المصري" : "Cash balance in EGP"}
              </p>
            </div>
          </div>

          {/* Card 2: Cash USD */}
          <div className="bg-green-50/70 hover:bg-green-50 border border-green-200/80 rounded-2xl p-5 flex flex-col justify-between shadow-xs transition-all relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-green-800 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                <Coins size={15} className="text-green-600" />
                {lang === "ar" ? "نقدي (دولار)" : "Cash (USD)"}
              </span>
              <span className="text-[10px] bg-white text-green-700 border border-green-300 px-2 py-0.5 rounded-full font-black shadow-2xs">
                USD
              </span>
            </div>
            <div className="mt-3">
              <h2 className="text-2xl font-black text-green-800 font-mono tracking-tight">
                {cashierBreakdown.cashUSD.toLocaleString()}{" "}
                <span className="text-xs font-bold text-green-600">USD</span>
              </h2>
              <p className="text-[11px] text-green-700/80 mt-1 font-semibold">
                {lang === "ar" ? "الرصيد النقدي بالدولار" : "Cash balance in USD"}
              </p>
            </div>
          </div>

          {/* Card 3: Cash SSP */}
          <div className="bg-amber-50/70 hover:bg-amber-50 border border-amber-200/80 rounded-2xl p-5 flex flex-col justify-between shadow-xs transition-all relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-amber-800 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                <Coins size={15} className="text-amber-600" />
                {lang === "ar" ? "كاش (جنوب سوداني)" : "Cash (SSP)"}
              </span>
              <span className="text-[10px] bg-white text-amber-700 border border-amber-300 px-2 py-0.5 rounded-full font-black shadow-2xs">
                SSP
              </span>
            </div>
            <div className="mt-3">
              <h2 className="text-2xl font-black text-amber-800 font-mono tracking-tight">
                {cashierBreakdown.cashSSP.toLocaleString()}{" "}
                <span className="text-xs font-bold text-amber-600">SSP</span>
              </h2>
              <p className="text-[11px] text-amber-700/80 mt-1 font-semibold">
                {lang === "ar" ? "المبيعات النقدية كاش بـ SSP" : "Cash Sales in SSP"}
              </p>
            </div>
          </div>

          {/* Card 4: Mobile Wallet (SSP) */}
          <div className="bg-purple-50/70 hover:bg-purple-50 border border-purple-200/80 rounded-2xl p-5 flex flex-col justify-between shadow-xs transition-all relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-purple-800 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                <Smartphone size={15} className="text-purple-600" />
                {lang === "ar" ? "محفظة (جنوب سوداني)" : "Wallet (SSP)"}
              </span>
              <span className="text-[10px] bg-white text-purple-700 border border-purple-300 px-2 py-0.5 rounded-full font-black shadow-2xs">
                SSP
              </span>
            </div>
            <div className="mt-3">
              <h2 className="text-2xl font-black text-purple-800 font-mono tracking-tight">
                {cashierBreakdown.walletSSP.toLocaleString()}{" "}
                <span className="text-xs font-bold text-purple-600">SSP</span>
              </h2>
              <p className="text-[11px] text-purple-700/80 mt-1 font-semibold">
                {lang === "ar"
                  ? "المبيعات عبر المحافظ الرقمية بـ SSP"
                  : "Digital Wallet Sales in SSP"}
              </p>
            </div>
          </div>

          {/* Card 5: Bank Card / Visa (USD) */}
          <div className="bg-blue-50/70 hover:bg-blue-50 border border-blue-200/80 rounded-2xl p-5 flex flex-col justify-between shadow-xs transition-all relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-blue-800 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard size={15} className="text-blue-600" />
                {lang === "ar" ? "بطاقة بنكية / فيزا" : "Bank Card / Visa"}
              </span>
              <span className="text-[10px] bg-white text-blue-700 border border-blue-300 px-2 py-0.5 rounded-full font-black shadow-2xs">
                USD
              </span>
            </div>
            <div className="mt-3">
              <h2 className="text-2xl font-black text-blue-800 font-mono tracking-tight">
                {cashierBreakdown.cardUSD.toLocaleString()}{" "}
                <span className="text-xs font-bold text-blue-600">USD</span>
              </h2>
              <p className="text-[11px] text-blue-700/80 mt-1 font-semibold">
                {lang === "ar"
                  ? "مبيعات الفيزا والبطاقات البنكية (بالدولار)"
                  : "Card sales & network receipts (USD)"}
              </p>
            </div>
          </div>
        </div>

        {/* Operational Sales Sync Status Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-indigo-900/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <div
              className={`p-2.5 rounded-xl border ${
                operationalSalesStats.unsyncedCount > 0
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
              }`}
            >
              <Zap
                size={22}
                className={operationalSalesStats.unsyncedCount > 0 ? "animate-bounce" : ""}
              />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-black text-white block">
                  {lang === "ar"
                    ? "حالة مزامنة مبيعات اليوم التشغيلية مع خزينة الكاشير"
                    : "Today Operational Sales Sync Status"}
                </span>
                <span
                  className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                    operationalSalesStats.unsyncedCount > 0
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  }`}
                >
                  {operationalSalesStats.unsyncedCount > 0
                    ? lang === "ar"
                      ? `⚠️ توجد ${operationalSalesStats.unsyncedCount} طلبات بحاجة للمزامنة`
                      : `⚠️ ${operationalSalesStats.unsyncedCount} Unsynced Orders`
                    : lang === "ar"
                      ? "100% متزامن بالكامل مع الخزينة 🟢"
                      : "100% Fully Synced 🟢"}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 font-medium">
                {lang === "ar"
                  ? `إجمالي الطلبات التشغيلية اليوم: ${operationalSalesStats.totalOrdersCount} طلب بقيمة ${operationalSalesStats.totalSalesAmount.toLocaleString()} ج.م | المسجل بالخزينة: ${
                      operationalSalesStats.totalOrdersCount - operationalSalesStats.unsyncedCount
                    } طلب`
                  : `Total Operational Orders: ${
                      operationalSalesStats.totalOrdersCount
                    } (${operationalSalesStats.totalSalesAmount.toLocaleString()}) | Treasury Synced: ${
                      operationalSalesStats.totalOrdersCount - operationalSalesStats.unsyncedCount
                    }`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 relative z-10 self-end sm:self-center shrink-0">
            <Button
              onClick={() => handleSyncSales(true)}
              disabled={isSyncing}
              size="sm"
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs h-9 px-4 rounded-xl flex items-center gap-2 shadow-sm transition active:scale-95"
            >
              <RefreshCw size={15} className={isSyncing ? "animate-spin" : ""} />
              <span>{lang === "ar" ? "إعادة المزامنة والتحديث الآن" : "Sync & Refresh Now"}</span>
            </Button>
          </div>
        </div>

        {/* Daily Cashflow Summary Strip */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100/80 text-amber-800 border border-amber-200 rounded-xl">
              <Coins size={20} />
            </div>
            <div>
              <span className="text-xs font-black text-slate-900 block">
                {lang === "ar" ? "ملخص حركة السيولة اليومية للخزينة" : "Today Cashflow Summary"}
              </span>
              <span className="text-[11px] text-slate-500 block font-medium">
                {lang === "ar"
                  ? "إجمالي الحركة المالية المسجلة بجميع العملات ووسائل الدفع اليوم"
                  : "Total registered cashflow for all currencies and payment methods today"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
            <div className="bg-emerald-50 border border-emerald-200/80 px-3.5 py-2 rounded-xl text-emerald-800 font-bold flex flex-col gap-0.5 shadow-2xs">
              <span className="text-[11px] font-sans text-emerald-700 font-extrabold">
                {lang === "ar" ? "الوارد اليوم (+)" : "In Today (+)"}
              </span>
              {Object.entries(dailyIncomeByCurrency).length > 0 ? (
                Object.entries(dailyIncomeByCurrency).map(([curr, amt]) => (
                  <span key={curr} className="text-sm font-black text-emerald-800">
                    {amt.toLocaleString()} {curr}
                  </span>
                ))
              ) : (
                <span className="text-sm font-black text-emerald-800">0 EGP</span>
              )}
            </div>

            <div className="bg-rose-50 border border-rose-200/80 px-3.5 py-2 rounded-xl text-rose-800 font-bold flex flex-col gap-0.5 shadow-2xs">
              <span className="text-[11px] font-sans text-rose-700 font-extrabold">
                {lang === "ar" ? "الصادر اليوم (-)" : "Out Today (-)"}
              </span>
              {Object.entries(dailyExpensesByCurrency).length > 0 ? (
                Object.entries(dailyExpensesByCurrency).map(([curr, amt]) => (
                  <span key={curr} className="text-sm font-black text-rose-800">
                    {amt.toLocaleString()} {curr}
                  </span>
                ))
              ) : (
                <span className="text-sm font-black text-rose-800">0 EGP</span>
              )}
            </div>
          </div>
        </div>

        {/* Info Deck Section */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 grid grid-cols-2 md:grid-cols-4 gap-6 text-xs shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
              <User size={18} />
            </div>
            <div>
              <span className="text-slate-500 block font-medium">
                {lang === "ar" ? "أمين العهدة المسؤول" : "Custodian"}
              </span>
              <span className="font-bold text-slate-800 mt-0.5 block">
                {cashierTreasury.responsible_employee}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
              <Building2 size={18} />
            </div>
            <div>
              <span className="text-slate-500 block font-medium">
                {lang === "ar" ? "الفرع المالي" : "Branch"}
              </span>
              <span className="font-bold text-slate-800 mt-0.5 block">
                {lang === "ar" ? "الفرع الرئيسي" : "Main Branch"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <ShieldCheck size={18} />
            </div>
            <div>
              <span className="text-slate-500 block font-medium">
                {lang === "ar" ? "الحالة التشغيلية" : "Operational Status"}
              </span>
              <span className="font-bold text-emerald-700 mt-0.5 block flex items-center gap-1">
                <CheckCircle2 size={12} />
                {lang === "ar" ? "مفتوحة للاستلام" : "Open for entries"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
              <Calendar size={18} />
            </div>
            <div>
              <span className="text-slate-500 block font-medium">
                {lang === "ar" ? "تاريخ آخر تحديث" : "Last synchronized"}
              </span>
              <span className="font-bold text-slate-800 mt-0.5 block">
                {new Date().toLocaleDateString("ar-EG", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Date Filter & Smart Quick Fill Control Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-200">
                <Filter size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <span>
                    {lang === "ar"
                      ? "تصفية الحركات والتقرير حسب التاريخ"
                      : "Filter Logs & Export by Date"}
                  </span>
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-extrabold flex items-center gap-1">
                    <Sparkles size={11} />
                    {lang === "ar" ? "ملئ ذكي وسريع" : "Smart Quick Fill"}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  {lang === "ar"
                    ? "اختر الفترات الزمانية الجاهزة أو حدد التاريخ يدوياً لتحديث الجدول وتصدير التقارير"
                    : "Select quick time presets or custom date range to filter view & report export"}
                </p>
              </div>
            </div>

            {(startDate || endDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => applyQuickDate("all")}
                className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 text-xs font-bold gap-1 self-start md:self-center"
              >
                <X size={14} />
                <span>{lang === "ar" ? "إلغاء التصفية" : "Reset Date Filter"}</span>
              </Button>
            )}
          </div>

          {/* Quick Smart Fill Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-500 ml-1 flex items-center gap-1">
              <CalendarDays size={13} />
              {lang === "ar" ? "اختيار سريع:" : "Quick Select:"}
            </span>

            <Button
              size="sm"
              variant={activePreset === "today" ? "default" : "outline"}
              onClick={() => applyQuickDate("today")}
              className={`text-xs h-8 px-3 font-bold rounded-lg ${
                activePreset === "today"
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                  : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
              }`}
            >
              📅 {lang === "ar" ? "اليوم" : "Today"}
            </Button>

            <Button
              size="sm"
              variant={activePreset === "yesterday" ? "default" : "outline"}
              onClick={() => applyQuickDate("yesterday")}
              className={`text-xs h-8 px-3 font-bold rounded-lg ${
                activePreset === "yesterday"
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                  : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
              }`}
            >
              ⏪ {lang === "ar" ? "الأمس" : "Yesterday"}
            </Button>

            <Button
              size="sm"
              variant={activePreset === "last7" ? "default" : "outline"}
              onClick={() => applyQuickDate("last7")}
              className={`text-xs h-8 px-3 font-bold rounded-lg ${
                activePreset === "last7"
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                  : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
              }`}
            >
              🗓️ {lang === "ar" ? "آخر 7 أيام" : "Last 7 Days"}
            </Button>

            <Button
              size="sm"
              variant={activePreset === "thisWeek" ? "default" : "outline"}
              onClick={() => applyQuickDate("thisWeek")}
              className={`text-xs h-8 px-3 font-bold rounded-lg ${
                activePreset === "thisWeek"
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                  : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
              }`}
            >
              📅 {lang === "ar" ? "هذا الأسبوع" : "This Week"}
            </Button>

            <Button
              size="sm"
              variant={activePreset === "thisMonth" ? "default" : "outline"}
              onClick={() => applyQuickDate("thisMonth")}
              className={`text-xs h-8 px-3 font-bold rounded-lg ${
                activePreset === "thisMonth"
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                  : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
              }`}
            >
              📊 {lang === "ar" ? "هذا الشهر" : "This Month"}
            </Button>

            <Button
              size="sm"
              variant={activePreset === "lastMonth" ? "default" : "outline"}
              onClick={() => applyQuickDate("lastMonth")}
              className={`text-xs h-8 px-3 font-bold rounded-lg ${
                activePreset === "lastMonth"
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                  : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
              }`}
            >
              📆 {lang === "ar" ? "الشهر السابق" : "Last Month"}
            </Button>

            <Button
              size="sm"
              variant={activePreset === "all" ? "default" : "outline"}
              onClick={() => applyQuickDate("all")}
              className={`text-xs h-8 px-3 font-bold rounded-lg ${
                activePreset === "all"
                  ? "bg-slate-800 text-white"
                  : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
              }`}
            >
              🔄 {lang === "ar" ? "جميع الأوقات" : "All Time"}
            </Button>
          </div>

          {/* Date Picker Custom Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                {lang === "ar" ? "من تاريخ:" : "From Date:"}
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setActivePreset("custom");
                }}
                className="bg-slate-50 border-slate-200 text-slate-800 text-xs h-9 rounded-xl focus-visible:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                {lang === "ar" ? "إلى تاريخ:" : "To Date:"}
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setActivePreset("custom");
                }}
                className="bg-slate-50 border-slate-200 text-slate-800 text-xs h-9 rounded-xl focus-visible:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Tabs navigation - Bright Theme */}
        <div className="flex border-b border-slate-200 gap-2">
          <button
            onClick={() => setActiveTab("logs")}
            className={`px-5 py-3 text-sm font-black transition-all relative ${
              activeTab === "logs"
                ? "text-emerald-700 border-b-2 border-emerald-600"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <span className="flex items-center gap-2">
              <History size={16} />
              {lang === "ar" ? "سجل الحركات المالية بالخزينة" : "Treasury Entries Log"}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("orders")}
            className={`px-5 py-3 text-sm font-black transition-all relative ${
              activeTab === "orders"
                ? "text-emerald-700 border-b-2 border-emerald-600"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <span className="flex items-center gap-2">
              <ShoppingBag size={16} />
              {lang === "ar" ? "مبيعات اليوم وإجراء المرتجعات" : "Today Sales & Refunds"}
            </span>
          </button>
        </div>

        {/* Tab 1: Financial Logs */}
        {activeTab === "logs" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <History size={18} className="text-emerald-600" />
                  <span>
                    {lang === "ar"
                      ? "سجل الحركات المالية المباشرة"
                      : "Direct Financial Transactions log"}
                  </span>
                  <span className="text-xs bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full font-mono font-bold">
                    {filteredTransactions.length} {lang === "ar" ? "حركة" : "tx"}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  {lang === "ar"
                    ? "تنبيهات فورية تصدر تلقائياً عند تسجيل أي حركة جديدة بالخزينة."
                    : "Live notifications trigger automatically on any new entries."}
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  size="sm"
                  onClick={exportToExcel}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-3.5 rounded-xl flex items-center gap-2 shrink-0 shadow-xs active:scale-95"
                >
                  <FileSpreadsheet size={16} />
                  <span>{lang === "ar" ? "تصدير للاكسيل" : "Export Excel"}</span>
                </Button>

                <div className="relative w-full sm:w-80">
                  <Search size={16} className="absolute right-3 top-2.5 text-slate-400" />
                  <Input
                    placeholder={
                      lang === "ar"
                        ? "البحث في الحركات المالية (رقم الفاتورة، البيان، النوع)..."
                        : "Search transactions..."
                    }
                    className="bg-slate-50 border-slate-200 text-right pr-9 text-xs h-9 rounded-xl focus-visible:ring-emerald-500 text-slate-900 placeholder:text-slate-400"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Transactions List */}
            <div className="space-y-2.5">
              {filteredTransactions.length === 0 ? (
                <div className="text-center py-16 text-xs text-slate-500 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  {lang === "ar"
                    ? "لا توجد حركات مالية مطابقة للبحث أو التصفية الزمانية"
                    : "No financial transactions matching search or date filter"}
                </div>
              ) : (
                filteredTransactions.map((tx) => {
                  const isIncoming =
                    tx.type === "deposit" || tx.type === "sales" || tx.type === "transfer_in";
                  return (
                    <div
                      key={tx.id}
                      className="p-4 bg-slate-50/70 hover:bg-slate-100/80 border border-slate-200 rounded-xl flex items-center justify-between gap-4 text-sm transition-colors shadow-2xs"
                    >
                      {/* Amount & Time */}
                      <div className="text-left font-mono shrink-0">
                        <span
                          className={`font-black text-base block ${
                            isIncoming ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          {isIncoming ? "+" : "-"}
                          {tx.amount.toLocaleString()} {tx.currency || "EGP"}
                        </span>
                        <span className="text-xs text-slate-500 block mt-1 font-medium">
                          {new Date(tx.date || tx.created_at || Date.now()).toLocaleTimeString(
                            "ar-EG",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            },
                          )}
                        </span>
                      </div>

                      {/* Statement / Description */}
                      <div className="flex-1 text-right space-y-1">
                        <span className="font-bold text-slate-900 block">{tx.note}</span>
                        <div className="flex items-center gap-2 justify-end text-xs text-slate-500">
                          {tx.related_entity_id && (
                            <span className="bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded-md font-mono text-[11px] font-extrabold">
                              {tx.related_entity_id}
                            </span>
                          )}
                          <span className="text-[11px] bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600 font-bold">
                            {tx.type === "sales"
                              ? lang === "ar"
                                ? "مبيعات POS"
                                : "POS Sales"
                              : tx.type === "deposit"
                                ? lang === "ar"
                                  ? "إيداع"
                                  : "Deposit"
                                : tx.type === "withdrawal"
                                  ? lang === "ar"
                                    ? "سحب / مرتجع"
                                    : "Withdrawal / Refund"
                                  : tx.type === "transfer_in"
                                    ? lang === "ar"
                                      ? "تحويل وارد"
                                      : "Transfer In"
                                    : lang === "ar"
                                      ? "تحويل صادر"
                                      : "Transfer Out"}
                          </span>
                        </div>
                      </div>

                      {/* Icon indicator */}
                      <div
                        className={`p-3 rounded-xl shrink-0 ${
                          isIncoming
                            ? "bg-emerald-100/80 text-emerald-700 border border-emerald-200"
                            : "bg-rose-100/80 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {tx.type === "sales" ? (
                          <Coins size={18} />
                        ) : tx.type === "transfer_in" || tx.type === "transfer_out" ? (
                          <ArrowLeftRight size={18} />
                        ) : isIncoming ? (
                          <ArrowDownLeft size={18} />
                        ) : (
                          <ArrowUpRight size={18} />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Orders & Refunds */}
        {activeTab === "orders" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <ShoppingBag size={18} className="text-emerald-600" />
                  <span>
                    {lang === "ar"
                      ? "طلبات ومبيعات ممر الكاشير اليوم"
                      : "Today Cashier POS Orders Log"}
                  </span>
                  <span className="text-xs bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full font-mono font-bold">
                    {ordersQuery.isLoading ? "..." : filteredOrders.length}{" "}
                    {lang === "ar" ? "طلب" : "orders"}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  {lang === "ar"
                    ? "اختر أي طلب مدفوع مكتمل للبدء في إجراء المرتجع الفوري وعكس القيد في الحساب المالي."
                    : "Select any completed order to initiate instant refund and restore warehouse ingredients."}
                </p>
              </div>

              <div className="relative w-full sm:w-80">
                <Search size={16} className="absolute right-3 top-2.5 text-slate-400" />
                <Input
                  placeholder={
                    lang === "ar"
                      ? "بحث برقم الطلب أو وسيلة الدفع..."
                      : "Search by order number or payment..."
                  }
                  className="bg-slate-50 border-slate-200 text-right pr-9 text-xs h-9 rounded-xl focus-visible:ring-emerald-500 text-slate-900 placeholder:text-slate-400"
                  value={orderSearchTerm}
                  onChange={(e) => setOrderSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Orders list container */}
            {ordersQuery.isLoading ? (
              <div className="text-center py-16 text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
                <Loader2 className="animate-spin text-emerald-600" size={24} />
                <span>
                  {lang === "ar" ? "جاري جلب سجل الطلبات..." : "Fetching order records..."}
                </span>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-16 text-xs text-slate-500 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                {lang === "ar"
                  ? "لا توجد أي طلبات متطابقة مع شروط البحث والتصفية."
                  : "No orders found matching search criteria."}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((order) => {
                  const isCancelled = order.status === "cancelled";
                  const isRefunding =
                    refundMutation.isPending && refundMutation.variables?.order.id === order.id;
                  const orderCurr = getOrderCurrency(order, erpState.treasuryTransactions);
                  const orderAmt = getOrderOriginalAmount(
                    order,
                    exchangeRates,
                    erpState.treasuryTransactions,
                  );

                  return (
                    <div
                      key={order.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isCancelled
                          ? "bg-rose-50/60 border-rose-200 text-rose-800"
                          : "bg-white hover:bg-slate-50/90 border-slate-200 text-slate-900 shadow-xs"
                      } flex flex-col md:flex-row md:items-center justify-between gap-4`}
                    >
                      {/* Left: Action Button / Status */}
                      <div className="flex items-center gap-3 self-start md:self-center shrink-0">
                        {isCancelled ? (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 text-rose-800 border border-rose-300 text-xs font-black rounded-lg">
                            <XCircle size={14} />
                            <span>{lang === "ar" ? "مرتجع ومُلغى" : "Refunded & Cancelled"}</span>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={isRefunding}
                            onClick={() => {
                              setRefundOrderDialog(order);
                              setCustomRefundAmount(
                                getOrderOriginalAmount(
                                  order,
                                  exchangeRates,
                                  erpState.treasuryTransactions,
                                ),
                              );
                              setCustomRefundCurrency(
                                getOrderCurrency(order, erpState.treasuryTransactions),
                              );
                              setCustomRefundPaymentMethod(order.payment_method || "cash");
                            }}
                            className="bg-rose-600 hover:bg-rose-700 text-white hover:scale-[1.02] active:scale-[0.98] transition font-black text-xs h-9 px-4 rounded-xl flex items-center gap-1.5 shadow-2xs"
                          >
                            {isRefunding ? (
                              <Loader2 className="animate-spin" size={14} />
                            ) : (
                              <RotateCcw size={14} />
                            )}
                            <span>
                              {lang === "ar" ? "إجراء مرتجع مالي" : "Issue Return Refund"}
                            </span>
                          </Button>
                        )}
                      </div>

                      {/* Middle: Items detail */}
                      <div className="flex-1 text-right">
                        <div className="flex items-center gap-2 justify-end flex-wrap text-xs text-slate-500 mb-1.5">
                          <span className="font-mono bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg text-slate-700 font-bold">
                            {lang === "ar" ? "طريقة الدفع: " : "Paid via: "}
                            {order.payment_method === "cash"
                              ? lang === "ar"
                                ? "نقداً"
                                : "Cash"
                              : order.payment_method === "card"
                                ? lang === "ar"
                                  ? "بطاقة بنكية"
                                  : "Card"
                                : order.payment_method === "wallet"
                                  ? lang === "ar"
                                    ? "محفظة إلكترونية"
                                    : "Wallet"
                                  : lang === "ar"
                                    ? "توصيل / أخرى"
                                    : "Other"}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-slate-500 font-bold">
                            <Clock size={12} />
                            {order.created_at
                              ? new Date(order.created_at).toLocaleDateString("ar-EG") +
                                " - " +
                                new Date(order.created_at).toLocaleTimeString("ar-EG", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </span>
                        </div>
                        <div className="text-xs text-slate-700">
                          {(() => {
                            const rawItems = order.items;
                            const itemsList = Array.isArray(rawItems)
                              ? rawItems
                              : typeof rawItems === "string"
                                ? (() => {
                                    try {
                                      return JSON.parse(rawItems);
                                    } catch {
                                      return [];
                                    }
                                  })()
                                : [];
                            return itemsList.map((it: any, idx: number) => (
                              <span
                                key={idx}
                                className="inline-block bg-slate-50 px-2 py-1 rounded border border-slate-200 mr-1 mb-1 font-bold text-slate-800 shadow-2xs text-[11px]"
                              >
                                {it.name_ar || it.name || "صنف"}{" "}
                                <span className="text-emerald-700 font-mono">
                                  x{it.quantity || 1}
                                </span>
                              </span>
                            ));
                          })()}
                        </div>
                      </div>

                      {/* Right: Order Number & Locked Order Price with Currency Tag */}
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-slate-500 text-xs font-mono font-bold">
                            #{order.order_number}
                          </span>
                          <h4 className="font-black text-slate-900 text-sm">
                            {lang === "ar"
                              ? `طلب رقم #${order.order_number}`
                              : `Order #${order.order_number}`}
                          </h4>
                        </div>
                        <div className="mt-1 flex items-center justify-end gap-1.5">
                          <span
                            className={`text-base font-black font-mono ${
                              isCancelled ? "line-through text-slate-400" : "text-emerald-700"
                            }`}
                          >
                            {orderAmt.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                          <span className="bg-emerald-800 text-white text-[10px] font-black px-2 py-0.5 rounded-md font-mono">
                            {orderCurr}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      <CashierTreasuryModals
        lang={lang}
        exchangeRates={exchangeRates}
        erpState={erpState}
        cashierTreasuryId={cashierTreasuryId}
        refundOrderDialog={refundOrderDialog}
        setRefundOrderDialog={setRefundOrderDialog}
        refundReason={refundReason}
        setRefundReason={setRefundReason}
        refundTreasury={refundTreasury}
        setRefundTreasury={setRefundTreasury}
        refundContainer={refundContainer}
        setRefundContainer={setRefundContainer}
        customRefundAmount={customRefundAmount}
        customRefundCurrency={customRefundCurrency}
        customRefundPaymentMethod={customRefundPaymentMethod}
        refundMutation={refundMutation}
        transferDialogOpen={transferDialogOpen}
        setTransferDialogOpen={setTransferDialogOpen}
        transferTargetTreasury={transferTargetTreasury}
        setTransferTargetTreasury={setTransferTargetTreasury}
        transferAmount={transferAmount}
        setTransferAmount={setTransferAmount}
        shiftSalesAmount={shiftSalesAmount}
        transferCurrency={transferCurrency}
        setTransferCurrency={setTransferCurrency}
        transferPaymentMethod={transferPaymentMethod}
        setTransferPaymentMethod={setTransferPaymentMethod}
        handleTransferMoney={handleTransferMoney}
        exportDialogOpen={exportDialogOpen}
        setExportDialogOpen={setExportDialogOpen}
        activePreset={activePreset}
        setActivePreset={setActivePreset}
        applyQuickDate={applyQuickDate}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        filteredTransactionsCount={filteredTransactions.length}
        exportToExcel={exportToExcel}
        showReportPreview={showReportPreview}
        setShowReportPreview={setShowReportPreview}
        reportData={reportData}
        handleConfirmPrint={handleConfirmPrint}
      />
    </div>
  );
}
