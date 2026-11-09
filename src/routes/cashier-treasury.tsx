// @ts-nocheck
import { useState, useEffect, useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  getCurrentUserIdentitySync,
  canCurrentUserCloseShift,
} from "@/shared/services/userAuthorization";
import { shiftAuditService } from "@/features/shifts/services/shiftAuditService";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { erpStore, RestaurantShift } from "@/shared/services/erpStore";
import { useSettings } from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AppMainNavbar } from "@/components/navigation/AppMainNavbar";
import { AppBreadcrumbBar } from "@/components/navigation/AppBreadcrumbBar";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { inventoryService } from "@/features/inventory/services/inventoryService";
import { printAccountingDocument, printRawHtml } from "@/shared/utils/printAccountingDocument";
import { Order } from "@/shared/types";
import { menuService } from "@/features/menu/services/menuService";
import { RestaurantShiftClosingReportModal } from "@/components/restaurant/RestaurantShiftClosingReportModal";
import {
  CashierTreasuryModals,
  getOrderCurrency,
  getOrderOriginalAmount,
} from "@/components/treasury/CashierTreasuryModals";
import {
  Search,
  ArrowLeftRight,
  Wallet,
  ArrowLeft,
  User,
  ShoppingBag,
  RotateCcw,
  XCircle,
  FileSpreadsheet,
  FileText,
  Clock,
  Loader2,
  Filter,
  CalendarDays,
  X,
  Printer,
  Lock,
  Eye,
  ShieldAlert,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/cashier-treasury")({
  head: () => ({ meta: [{ title: "شاشة الكاشير والخزينة — إدارة المطعم" }] }),
  component: CashierTreasuryPage,
});

function CashierTreasuryPage() {
  const navigate = useNavigate();
  const { lang, exchangeRates } = useSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [erpState, setErpState] = useState(erpStore.getState());
  const [isMounted, setIsMounted] = useState(false);

  // Unified Search & Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedShiftId, setSelectedShiftId] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [shiftStatusFilter, setShiftStatusFilter] = useState<"all" | "open" | "closed">("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [activePreset, setActivePreset] = useState<string>("all");

  // Modals State
  const [closingShiftModal, setClosingShiftModal] = useState<RestaurantShift | null>(null);
  const [viewingShiftReport, setViewingShiftReport] = useState<RestaurantShift | null>(null);
  const [reviewOrderDialog, setReviewOrderDialog] = useState<any | null>(null);

  // Refund & Transfer Modals State
  const [refundOrderDialog, setRefundOrderDialog] = useState<Order | null>(null);
  const [refundReason, setRefundReason] = useState<string>("طلب العميل إلغاء الوجبة");
  const [refundTreasury, setRefundTreasury] = useState<string>(
    erpStore.getState().treasuries.find((t) => t.linked_to_restaurant)?.id || "tr-1",
  );
  const [refundContainer, setRefundContainer] = useState<string>("");
  const [customRefundAmount, setCustomRefundAmount] = useState<number>(0);
  const [customRefundCurrency, setCustomRefundCurrency] = useState<string>("USD");
  const [customRefundPaymentMethod, setCustomRefundPaymentMethod] = useState<string>("cash");

  const [exportDialogOpen, setExportDialogOpen] = useState<boolean>(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState<boolean>(false);
  const [transferTargetTreasury, setTransferTargetTreasury] = useState<string>("");
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [transferCurrency, setTransferCurrency] = useState<string>("USD");
  const [transferPaymentMethod, setTransferPaymentMethod] = useState<string>("cash");
  const [showReportPreview, setShowReportPreview] = useState<boolean>(false);

  const currentIdentity = getCurrentUserIdentitySync();
  const isCashier = currentIdentity.isCashier;
  const canCloseShifts = canCurrentUserCloseShift();

  useEffect(() => {
    setIsMounted(true);
    void shiftAuditService.syncOpenShiftsFromSupabase(erpStore);
    return erpStore.subscribe(() => {
      setErpState({ ...erpStore.getState() });
    });
  }, []);

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
      const yest = new Date(now);
      yest.setDate(now.getDate() - 1);
      const yestStr = format(yest);
      setStartDate(yestStr);
      setEndDate(yestStr);
    } else if (preset === "last7") {
      const last7 = new Date(now);
      last7.setDate(now.getDate() - 7);
      setStartDate(format(last7));
      setEndDate(format(now));
    } else if (preset === "thisMonth") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(format(firstDay));
      setEndDate(format(now));
    } else if (preset === "all") {
      setStartDate("");
      setEndDate("");
    }
  };

  // Fetch Restaurant Orders (Supabase + Local Storage)
  const ordersQuery = useQuery({
    queryKey: ["cashier-orders"],
    queryFn: async () => {
      let dbOrders: Order[] = [];
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(300);
        if (!error && data) {
          dbOrders = data as Order[];
        }
      } catch {
        // Fallback to local
      }

      let localOrders: Order[] = [];
      try {
        localOrders = JSON.parse(localStorage.getItem("pos_local_orders") || "[]");
      } catch {
        localOrders = [];
      }

      const combinedMap = new Map<string, Order>();
      localOrders.forEach((o) => {
        if (o && o.id) combinedMap.set(o.id, o);
      });
      dbOrders.forEach((o) => {
        if (o && o.id) combinedMap.set(o.id, o);
      });

      return Array.from(combinedMap.values()).sort(
        (a, b) =>
          new Date(b.created_at || Date.now()).getTime() -
          new Date(a.created_at || Date.now()).getTime(),
      );
    },
    refetchInterval: 8000,
  });

  const allShifts: RestaurantShift[] = useMemo(() => {
    return (erpState.restaurantShifts || []).slice().sort((a, b) => {
      return (
        new Date(b.start_at || Date.now()).getTime() -
        new Date(a.start_at || Date.now()).getTime()
      );
    });
  }, [erpState.restaurantShifts]);

  const allOrders: any[] = ordersQuery.data || [];

  // Map each order to its shift (by shift_id, shift_number, or time range)
  const resolveOrderShift = (order: any): RestaurantShift | null => {
    if (!order) return null;
    if (order.shift_id) {
      const byId = allShifts.find((s) => s.id === order.shift_id);
      if (byId) return byId;
    }
    if (order.shift_number) {
      const byNum = allShifts.find((s) => s.shift_number === order.shift_number);
      if (byNum) return byNum;
    }
    if (order.created_at) {
      const orderTime = new Date(order.created_at).getTime();
      const matched = allShifts.find((s) => {
        const start = new Date(s.start_at).getTime() - 60000;
        const end = s.end_at ? new Date(s.end_at).getTime() + 60000 : Date.now() + 3600000;
        return orderTime >= start && orderTime <= end;
      });
      if (matched) return matched;
    }
    return null;
  };

  // Distinct users/cashiers from shifts and orders
  const distinctUsers = useMemo(() => {
    const set = new Set<string>();
    allShifts.forEach((s) => {
      if (s.cashier_name && s.cashier_name.trim()) set.add(s.cashier_name.trim());
    });
    allOrders.forEach((o: any) => {
      const cname = o.cashier_name || o.created_by;
      if (cname && String(cname).trim()) set.add(String(cname).trim());
    });
    return Array.from(set);
  }, [allShifts, allOrders]);

  // Filtered Shifts based on Search, Selected Shift, Selected User, Status, and Date Range
  const filteredShifts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return allShifts.filter((s) => {
      if (selectedShiftId !== "all" && s.id !== selectedShiftId) return false;
      if (
        selectedUser !== "all" &&
        String(s.cashier_name || "").trim().toLowerCase() !== selectedUser.toLowerCase()
      ) {
        return false;
      }
      if (shiftStatusFilter !== "all" && s.status !== shiftStatusFilter) return false;

      if (startDate || endDate) {
        const shiftDate = new Date(s.start_at || Date.now());
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (shiftDate < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (shiftDate > end) return false;
        }
      }

      if (q) {
        const matchShift =
          String(s.shift_number || "").toLowerCase().includes(q) ||
          String(s.auto_shift_number || "").toLowerCase().includes(q) ||
          String(s.cashier_name || "").toLowerCase().includes(q) ||
          String(s.id || "").toLowerCase().includes(q);

        // Also check if any order in this shift matches the searched invoice number
        const hasMatchingOrder = allOrders.some((o) => {
          const oShift = resolveOrderShift(o);
          if (!oShift || oShift.id !== s.id) return false;
          return (
            String(o.order_number || "").toLowerCase().includes(q) ||
            String(o.id || "").toLowerCase().includes(q)
          );
        });

        if (!matchShift && !hasMatchingOrder) return false;
      }

      return true;
    });
  }, [
    allShifts,
    allOrders,
    searchTerm,
    selectedShiftId,
    selectedUser,
    shiftStatusFilter,
    startDate,
    endDate,
  ]);

  // Filtered Orders / Invoices based on Search, Selected Shift, Selected User, Payment Method, Date Range
  const filteredOrders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return allOrders.filter((order: any) => {
      const orderShift = resolveOrderShift(order);
      const orderCashier = String(
        order.cashier_name || orderShift?.cashier_name || "",
      ).trim();

      if (selectedShiftId !== "all") {
        if (!orderShift || orderShift.id !== selectedShiftId) return false;
      }

      if (selectedUser !== "all") {
        if (orderCashier.toLowerCase() !== selectedUser.toLowerCase()) return false;
      }

      if (shiftStatusFilter !== "all" && orderShift) {
        if (orderShift.status !== shiftStatusFilter) return false;
      }

      if (paymentMethodFilter !== "all") {
        if (paymentMethodFilter === "cancelled") {
          if (order.status !== "cancelled") return false;
        } else if (order.payment_method !== paymentMethodFilter) {
          return false;
        }
      }

      if (startDate || endDate) {
        const orderDate = new Date(order.created_at || Date.now());
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (orderDate < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (orderDate > end) return false;
        }
      }

      if (q) {
        const matchesOrder =
          String(order.order_number || "").toLowerCase().includes(q) ||
          String(order.id || "").toLowerCase().includes(q) ||
          String(order.payment_method || "").toLowerCase().includes(q) ||
          orderCashier.toLowerCase().includes(q) ||
          String(orderShift?.shift_number || "").toLowerCase().includes(q) ||
          String(orderShift?.auto_shift_number || "").toLowerCase().includes(q);
        if (!matchesOrder) return false;
      }

      return true;
    });
  }, [
    allOrders,
    allShifts,
    searchTerm,
    selectedShiftId,
    selectedUser,
    shiftStatusFilter,
    paymentMethodFilter,
    startDate,
    endDate,
  ]);

  // Identify Restaurant Cashier Treasury
  const cashierTreasury =
    erpState.treasuries.find((t) => !t.deleted && t.linked_to_restaurant) ||
    erpState.treasuries.find(
      (t) =>
        !t.deleted &&
        (t.id === "tr-1" || t.name_ar.includes("الكاشير") || t.name_ar.includes("المطعم")),
    ) ||
    erpState.treasuries[0];

  const cashierTreasuryId = cashierTreasury?.id || "tr-1";

  const filteredTransactions = useMemo(() => {
    return (erpState.treasuryTransactions || []).filter((tx) => {
      if (tx.treasury_id !== cashierTreasuryId) return false;
      if (startDate || endDate) {
        const txDate = new Date(tx.date || tx.created_at || Date.now());
        if (startDate) {
          const s = new Date(startDate);
          s.setHours(0, 0, 0, 0);
          if (txDate < s) return false;
        }
        if (endDate) {
          const e = new Date(endDate);
          e.setHours(23, 59, 59, 999);
          if (txDate > e) return false;
        }
      }
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        return (
          String(tx.note || "").toLowerCase().includes(q) ||
          String(tx.related_entity_id || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [erpState.treasuryTransactions, cashierTreasuryId, startDate, endDate, searchTerm]);

  const shiftSalesAmount = useMemo(() => {
    return filteredOrders
      .filter((o) => o.status !== "cancelled")
      .reduce((acc, o) => {
        const curr = getOrderCurrency(o, erpState.treasuryTransactions);
        if (curr === transferCurrency) {
          return acc + getOrderOriginalAmount(o, exchangeRates, erpState.treasuryTransactions);
        }
        return acc;
      }, 0);
  }, [filteredOrders, transferCurrency, erpState.treasuryTransactions, exchangeRates]);

  // Refund Mutation
  const refundMutation = useMutation({
    mutationFn: async ({
      order,
      reason,
      targetTreasuryId,
      targetContainerId,
      refundAmount,
      refundCurrency,
      refundPaymentMethod,
    }: {
      order: Order;
      reason: string;
      targetTreasuryId: string;
      targetContainerId?: string;
      refundAmount: number;
      refundCurrency: string;
      refundPaymentMethod: string;
    }) => {
      if (order.status === "cancelled") {
        throw new Error("هذا الطلب تم استرجاعه وإلغاؤه مسبقاً");
      }

      try {
        await supabase.from("orders").update({ status: "cancelled" }).eq("id", order.id);
      } catch {
        // Local fallback
      }

      try {
        const localOrders = JSON.parse(localStorage.getItem("pos_local_orders") || "[]");
        const updated = localOrders.map((o: any) =>
          o.id === order.id ? { ...o, status: "cancelled" } : o,
        );
        localStorage.setItem("pos_local_orders", JSON.stringify(updated));
      } catch {
        // Ignore
      }

      const finalAmount =
        refundAmount > 0
          ? refundAmount
          : getOrderOriginalAmount(order, exchangeRates, erpState.treasuryTransactions);

      const finalCurrency =
        refundCurrency || getOrderCurrency(order, erpState.treasuryTransactions) || "USD";

      erpStore.recordRestaurantRefund({
        order_id: order.id,
        order_number: order.order_number,
        amount: finalAmount,
        currency: finalCurrency,
        payment_method: refundPaymentMethod || order.payment_method || "cash",
        reason,
        treasury_id: targetTreasuryId || cashierTreasuryId,
        container_id: targetContainerId || undefined,
      });

      // Restore inventory ingredients if tracked
      try {
        const allMenuItems = await menuService.getMenuItems();
        const rawItems = order.items;
        const itemsList = Array.isArray(rawItems)
          ? rawItems
          : typeof rawItems === "string"
            ? JSON.parse(rawItems)
            : [];
        for (const item of itemsList) {
          const matchedMenu = allMenuItems.find(
            (m: any) => m.id === item.id || m.name_ar === (item.name_ar || item.name),
          );
          if (matchedMenu && Array.isArray(matchedMenu.ingredients)) {
            for (const ing of matchedMenu.ingredients) {
              if (ing.inventory_item_id && Number(ing.quantity) > 0) {
                await inventoryService.adjustStock(
                  ing.inventory_item_id,
                  Number(ing.quantity) * Number(item.quantity || 1),
                  `مرتجع طلب رقم #${order.order_number}`,
                );
              }
            }
          }
        }
      } catch {
        // Ignore inventory restore error
      }

      return order;
    },
    onSuccess: (order) => {
      setRefundOrderDialog(null);
      queryClient.invalidateQueries({ queryKey: ["cashier-orders"] });
      toast({
        title: "تم إجراء المرتجع وعكس القيد المالي",
        description: `تم إلغاء الطلب #${order.order_number} واسترداد المبلغ من الخزينة.`,
      });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "تعذر إجراء المرتجع",
        description: err.message || "حدث خطأ أثناء معالجة المرتجع",
      });
    },
  });

  // Transfer Cash & Generate Accounting Journal Entry
  const handleTransferMoney = () => {
    if (!transferTargetTreasury) {
      toast({
        variant: "destructive",
        title: "يرجى اختيار الخزينة المستهدفة للترحيل",
      });
      return;
    }
    if (!transferAmount || transferAmount <= 0) {
      toast({
        variant: "destructive",
        title: "يرجى إدخال مبلغ صحيح للترحيل",
      });
      return;
    }

    try {
      const targetTr = erpState.treasuries.find((t) => t.id === transferTargetTreasury);
      erpStore.transferBetweenTreasuries(
        cashierTreasuryId,
        transferTargetTreasury,
        Number(transferAmount),
        `ترحيل نقدية مبيعات كاشير المطعم وتوليد قيد محاسبي (${transferPaymentMethod})`,
        transferCurrency,
      );

      toast({
        title: "تم ترحيل النقدية وتوليد القيد المحاسبي بنجاح",
        description: `تم تحويل ${Number(transferAmount).toLocaleString()} ${transferCurrency} إلى ${targetTr?.name_ar || "الخزينة الرئيسية"}`,
      });
      setTransferDialogOpen(false);
      setTransferAmount(0);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "فشل ترحيل النقدية",
        description: err.message || "تأكد من توافر الرصيد الكافي بالخزينة",
      });
    }
  };

  const exportToExcel = () => {
    try {
      const rows = filteredOrders.map((order: any) => {
        const orderShift = resolveOrderShift(order);
        const curr = getOrderCurrency(order, erpState.treasuryTransactions);
        const amt = getOrderOriginalAmount(order, exchangeRates, erpState.treasuryTransactions);
        return {
          "رقم الفاتورة": `#${order.order_number}`,
          "رقم الوردية الفريد": orderShift?.auto_shift_number || "-",
          "اسم الوردية": orderShift?.shift_number || "-",
          "الكاشير": order.cashier_name || orderShift?.cashier_name || "-",
          "التاريخ والوقت": order.created_at
            ? new Date(order.created_at).toLocaleString("ar-EG")
            : "-",
          "طريقة الدفع":
            order.payment_method === "card"
              ? "بطاقة بنكية"
              : order.payment_method === "wallet"
                ? "محفظة إلكترونية"
                : "نقدي",
          "المبلغ": amt,
          "العملة": curr,
          "الحالة": order.status === "cancelled" ? "مرتجع" : "مكتمل",
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "فواتير وورديات المطعم");
      XLSX.writeFile(
        wb,
        `restaurant_shifts_orders_${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
      toast({ title: "تم تصدير التقرير إلى Excel" });
    } catch {
      toast({ variant: "destructive", title: "تعذر تصدير ملف Excel" });
    }
  };

  // Report Data for Print Preview
  const reportData = useMemo(() => {
    const activeOrders = filteredOrders.filter((o) => o.status !== "cancelled");
    const cancelledOrders = filteredOrders.filter((o) => o.status === "cancelled");

    const salesByCurrency: Record<string, number> = {};
    const refundsByCurrency: Record<string, number> = {};

    activeOrders.forEach((o) => {
      const c = getOrderCurrency(o, erpState.treasuryTransactions);
      const a = getOrderOriginalAmount(o, exchangeRates, erpState.treasuryTransactions);
      salesByCurrency[c] = (salesByCurrency[c] || 0) + a;
    });

    cancelledOrders.forEach((o) => {
      const c = getOrderCurrency(o, erpState.treasuryTransactions);
      const a = getOrderOriginalAmount(o, exchangeRates, erpState.treasuryTransactions);
      refundsByCurrency[c] = (refundsByCurrency[c] || 0) + a;
    });

    return {
      periodLabel:
        startDate || endDate
          ? `${startDate || "البداية"} إلى ${endDate || "اليوم"}`
          : "جميع الأوقات",
      totalOrdersCount: filteredOrders.length,
      completedOrdersCount: activeOrders.length,
      refundedOrdersCount: cancelledOrders.length,
      salesByCurrency,
      refundsByCurrency,
      orders: filteredOrders,
    };
  }, [filteredOrders, startDate, endDate, erpState.treasuryTransactions, exchangeRates]);

  const handleConfirmPrint = () => {
    printAccountingDocument({
      title: "تقرير ورديات وفواتير كاشير المطعم",
      subtitle: `الفترة: ${reportData.periodLabel}`,
      metadata: [
        { label: "إجمالي الفواتير", value: String(reportData.totalOrdersCount) },
        { label: "الفواتير المكتملة", value: String(reportData.completedOrdersCount) },
        { label: "المرتجعات", value: String(reportData.refundedOrdersCount) },
      ],
      columns: [
        { header: "رقم الفاتورة", key: "order_number" },
        { header: "الوردية", key: "shift_name" },
        { header: "الكاشير", key: "cashier" },
        { header: "التاريخ", key: "date" },
        { header: "طريقة الدفع", key: "payment" },
        { header: "المبلغ", key: "amount" },
        { header: "الحالة", key: "status" },
      ],
      rows: filteredOrders.map((o: any) => {
        const s = resolveOrderShift(o);
        const curr = getOrderCurrency(o, erpState.treasuryTransactions);
        const amt = getOrderOriginalAmount(o, exchangeRates, erpState.treasuryTransactions);
        return {
          order_number: `#${o.order_number}`,
          shift_name: s?.shift_number || "-",
          cashier: o.cashier_name || s?.cashier_name || "-",
          date: o.created_at ? new Date(o.created_at).toLocaleString("ar-EG") : "-",
          payment:
            o.payment_method === "card"
              ? "بطاقة بنكية"
              : o.payment_method === "wallet"
                ? "محفظة"
                : "نقدي",
          amount: `${amt.toLocaleString()} ${curr}`,
          status: o.status === "cancelled" ? "مرتجع" : "مكتمل",
        };
      }),
    });
    setShowReportPreview(false);
  };

  const handlePrintSingleOrder = (order: any) => {
    const orderShift = resolveOrderShift(order);
    const curr = getOrderCurrency(order, erpState.treasuryTransactions);
    const amt = getOrderOriginalAmount(order, exchangeRates, erpState.treasuryTransactions);
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

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8" />
        <title>فاتورة رقم #${order.order_number}</title>
        <style>
          body { font-family: 'Cairo', 'Tajawal', sans-serif; padding: 20px; color: #0f172a; max-width: 420px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px dashed #0f172a; padding-bottom: 10px; margin-bottom: 12px; }
          .meta { font-size: 12px; margin-bottom: 12px; line-height: 1.6; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 12px; }
          th, td { border-bottom: 1px solid #cbd5e1; padding: 6px 4px; text-align: right; }
          th { background: #f8fafc; }
          .total { font-size: 16px; font-weight: bold; text-align: left; border-top: 2px solid #0f172a; padding-top: 8px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h3>إيصال مبيعات المطعم #${order.order_number}</h3>
        </div>
        <div class="meta">
          <div><strong>الوردية:</strong> ${orderShift?.shift_number || "-"} (${orderShift?.auto_shift_number || "-"})</div>
          <div><strong>الكاشير:</strong> ${order.cashier_name || orderShift?.cashier_name || "-"}</div>
          <div><strong>التاريخ:</strong> ${order.created_at ? new Date(order.created_at).toLocaleString("ar-EG") : "-"}</div>
          <div><strong>طريقة الدفع:</strong> ${order.payment_method === "card" ? "بطاقة بنكية" : order.payment_method === "wallet" ? "محفظة إلكترونية" : "نقدي"}</div>
          <div><strong>الحالة:</strong> ${order.status === "cancelled" ? "مرتجع ومُلغى" : "مكتمل"}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>الصنف</th>
              <th>الكمية</th>
              <th>السعر</th>
            </tr>
          </thead>
          <tbody>
            ${itemsList
              .map(
                (it: any) => `
              <tr>
                <td>${it.name_ar || it.name || "صنف"}</td>
                <td>x${it.quantity || 1}</td>
                <td>${Number(it.price || 0).toLocaleString()}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
        <div class="total">الإجمالي: ${amt.toLocaleString()} ${curr}</div>
      </body>
      </html>
    `;
    printRawHtml(html, `فاتورة #${order.order_number}`);
  };

  if (!isMounted) return null;

  // Restrict full manager treasury & shift audit page to managers with permissions
  if (isCashier && !canCloseShifts) {
    return (
      <div className="min-h-screen bg-background text-foreground font-cairo" dir="rtl">
        <AppMainNavbar />
        <AppBreadcrumbBar />
        <main className="max-w-xl mx-auto p-8 mt-12 text-center bg-card border border-border rounded-3xl shadow-sm space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600">
            <ShieldAlert size={28} />
          </div>
          <h2 className="text-lg font-black">هذه الصفحة مخصصة للمديرين فقط</h2>
          <div className="flex justify-center gap-3 pt-2">
            <Button
              onClick={() => navigate({ to: "/pos" })}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
            >
              العودة لشاشة الكاشير (POS)
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const selectedShiftObj =
    selectedShiftId !== "all" ? allShifts.find((s) => s.id === selectedShiftId) : null;

  return (
    <div
      className="min-h-screen bg-slate-50/70 dark:bg-background text-foreground font-cairo"
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <AppMainNavbar />
      <AppBreadcrumbBar />

      <main className="max-w-7xl mx-auto p-3 md:p-4 space-y-3">
        {/* Compact Header + Search & Filter Toolbar */}
        <div className="bg-card border border-border rounded-2xl p-3 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap border-b border-border/60 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                <Wallet size={16} />
              </div>
              <h1 className="text-sm sm:text-base font-black text-foreground">
                شاشة الكاشير والخزينة — إدارة المطعم
              </h1>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {(searchTerm ||
                selectedShiftId !== "all" ||
                selectedUser !== "all" ||
                shiftStatusFilter !== "all" ||
                paymentMethodFilter !== "all" ||
                startDate ||
                endDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedShiftId("all");
                    setSelectedUser("all");
                    setShiftStatusFilter("all");
                    setPaymentMethodFilter("all");
                    applyQuickDate("all");
                  }}
                  className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold gap-1 h-8 rounded-xl cursor-pointer"
                >
                  <X size={13} />
                  <span>إلغاء التصفية</span>
                </Button>
              )}

              <Button
                size="sm"
                onClick={() => {
                  setTransferCurrency("USD");
                  setTransferPaymentMethod("cash");
                  setTransferAmount(shiftSalesAmount);
                  setTransferDialogOpen(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-8 px-3 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeftRight size={13} />
                <span>ترحيل النقدية وتوليد قيد</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowReportPreview(true)}
                className="font-bold text-xs h-8 px-3 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Printer size={13} />
                <span>طباعة التقرير</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={exportToExcel}
                className="font-bold text-xs h-8 px-3 rounded-xl flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 cursor-pointer"
              >
                <FileSpreadsheet size={13} />
                <span>Excel</span>
              </Button>

              <Link to="/admin/restaurant" search={{ tab: "operations" }}>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 rounded-xl text-xs font-bold gap-1 cursor-pointer"
                >
                  <ArrowLeft size={13} />
                  <span>رجوع</span>
                </Button>
              </Link>
            </div>
          </div>

          {/* Search Inputs Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 items-center">
            <div className="relative lg:col-span-2">
              <Search size={14} className="absolute right-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="بحث برقم الفاتورة أو الوردية أو الكاشير..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-8 h-8 text-xs font-bold rounded-xl bg-background"
              />
            </div>

            <select
              value={selectedShiftId}
              onChange={(e) => setSelectedShiftId(e.target.value)}
              className="w-full h-8 rounded-xl border border-input bg-background px-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">كل الورديات ({allShifts.length})</option>
              {allShifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shift_number} {s.auto_shift_number ? `(${s.auto_shift_number})` : ""} —{" "}
                  {s.cashier_name} [{s.status === "open" ? "مفتوحة" : "مغلقة"}]
                </option>
              ))}
            </select>

            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full h-8 rounded-xl border border-input bg-background px-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">كل المستخدمين ({distinctUsers.length})</option>
              {distinctUsers.map((u) => (
                <option key={u} value={u}>
                  المستخدم: {u}
                </option>
              ))}
            </select>

            <select
              value={shiftStatusFilter}
              onChange={(e) => setShiftStatusFilter(e.target.value as any)}
              className="w-full h-8 rounded-xl border border-input bg-background px-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">حالة الوردية: الكل</option>
              <option value="open">المفتوحة فقط</option>
              <option value="closed">المغلقة فقط</option>
            </select>

            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setActivePreset("custom");
                }}
                className="h-8 text-[11px] rounded-xl bg-background px-2"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setActivePreset("custom");
                }}
                className="h-8 text-[11px] rounded-xl bg-background px-2"
              />
            </div>
          </div>
        </div>

        {/* Side-by-Side Single-Viewport Grid: Part 1 (Shifts) & Part 2 (Invoices) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
          {/* PART 1: الورديات المطابقة للبحث (5 cols) */}
          <div className="lg:col-span-5 bg-card border border-border rounded-2xl p-3 shadow-xs flex flex-col max-h-[calc(100vh-235px)]">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2 mb-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <Clock size={15} className="text-teal-600" />
                <h3 className="text-xs sm:text-sm font-black text-foreground">
                  الورديات المطابقة للبحث
                </h3>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {filteredShifts.length} وردية
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                {[
                  { key: "today", label: "اليوم" },
                  { key: "all", label: "الكل" },
                ].map((p) => (
                  <Button
                    key={p.key}
                    size="sm"
                    variant={activePreset === p.key ? "default" : "outline"}
                    onClick={() => applyQuickDate(p.key)}
                    className={`text-[10px] h-6 px-2 font-bold rounded-lg cursor-pointer ${
                      activePreset === p.key ? "bg-indigo-600 text-white" : ""
                    }`}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="overflow-y-auto flex-1 space-y-2 pr-0.5">
              {filteredShifts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground font-bold text-xs">
                  لا توجد ورديات مطابقة لشروط البحث
                </div>
              ) : (
                filteredShifts.map((s) => {
                  const sOrders = allOrders.filter((o) => {
                    const oShift = resolveOrderShift(o);
                    return oShift?.id === s.id;
                  });
                  const isSelected = selectedShiftId === s.id;

                  return (
                    <div
                      key={s.id}
                      className={`p-2.5 rounded-xl border transition text-xs space-y-2 ${
                        isSelected
                          ? "bg-indigo-500/10 border-indigo-500/40"
                          : "bg-background hover:bg-muted/30 border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-black text-foreground">{s.shift_number}</span>
                          <span className="font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                            ({s.auto_shift_number || s.id.slice(0, 8)})
                          </span>
                          <span className="text-muted-foreground font-bold">
                            • {s.cashier_name}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.status === "open"
                              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {s.status === "open" ? "مفتوحة" : "مغلقة"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground font-mono">
                        <span>{new Date(s.start_at).toLocaleString("ar-EG")}</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {sOrders.length} فاتورة
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-border/50">
                        <Button
                          size="sm"
                          variant={isSelected ? "default" : "outline"}
                          onClick={() => setSelectedShiftId(isSelected ? "all" : s.id)}
                          className={`h-7 px-2 rounded-lg text-[11px] font-bold gap-1 cursor-pointer ${
                            isSelected ? "bg-indigo-600 text-white" : ""
                          }`}
                        >
                          <ShoppingBag size={11} />
                          <span>{isSelected ? "إلغاء التحديد" : "استخراج الفواتير"}</span>
                        </Button>

                        {s.status === "open" && canCloseShifts && (
                          <Button
                            size="sm"
                            onClick={() => setClosingShiftModal(s)}
                            className="h-7 px-2 rounded-lg text-[11px] font-bold gap-1 bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
                          >
                            <Lock size={11} />
                            <span>غلق الوردية</span>
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setViewingShiftReport(s)}
                          className="h-7 px-2 rounded-lg text-[11px] font-bold gap-1 cursor-pointer"
                        >
                          <Printer size={11} />
                          <span>التقرير والقيود</span>
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* PART 2: الفواتير والإيصالات المستخرجة (7 cols) */}
          <div className="lg:col-span-7 bg-card border border-border rounded-2xl p-3 shadow-xs flex flex-col max-h-[calc(100vh-235px)]">
            <div className="flex items-center justify-between gap-2 flex-wrap border-b border-border/60 pb-2 mb-2 shrink-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <ShoppingBag size={15} className="text-emerald-600" />
                <h3 className="text-xs sm:text-sm font-black text-foreground">
                  الفواتير والإيصالات المستخرجة
                </h3>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {ordersQuery.isLoading ? "..." : filteredOrders.length} فاتورة
                </Badge>
                {selectedShiftObj && (
                  <Badge className="bg-indigo-600 text-white text-[10px] font-bold gap-1">
                    <span>{selectedShiftObj.shift_number}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedShiftId("all")}
                      className="hover:text-rose-200 cursor-pointer"
                    >
                      <X size={11} />
                    </button>
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-1 flex-wrap">
                {[
                  { key: "all", label: "الكل" },
                  { key: "cash", label: "نقدي" },
                  { key: "card", label: "بطاقة" },
                  { key: "wallet", label: "محفظة" },
                  { key: "cancelled", label: "المرتجعات" },
                ].map((pm) => (
                  <Button
                    key={pm.key}
                    size="sm"
                    variant={paymentMethodFilter === pm.key ? "default" : "outline"}
                    onClick={() => setPaymentMethodFilter(pm.key)}
                    className={`h-6 px-2 rounded-lg text-[10px] font-bold cursor-pointer ${
                      paymentMethodFilter === pm.key
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : ""
                    }`}
                  >
                    {pm.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="overflow-y-auto flex-1 space-y-2 pr-0.5">
              {ordersQuery.isLoading ? (
                <div className="text-center py-8 text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                  <Loader2 className="animate-spin text-emerald-600" size={20} />
                  <span>جاري جلب الفواتير...</span>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border rounded-2xl">
                  لا توجد فواتير مطابقة للبحث
                </div>
              ) : (
                filteredOrders.map((order: any) => {
                  const isCancelled = order.status === "cancelled";
                  const isRefunding =
                    refundMutation.isPending && refundMutation.variables?.order.id === order.id;
                  const orderCurr = getOrderCurrency(order, erpState.treasuryTransactions);
                  const orderAmt = getOrderOriginalAmount(
                    order,
                    exchangeRates,
                    erpState.treasuryTransactions,
                  );
                  const orderShift = resolveOrderShift(order);

                  return (
                    <div
                      key={order.id}
                      className={`p-2.5 rounded-xl border transition-all ${
                        isCancelled
                          ? "bg-rose-500/5 border-rose-500/30"
                          : "bg-background hover:bg-muted/30 border-border"
                      } flex flex-col sm:flex-row sm:items-center justify-between gap-2.5`}
                    >
                      <div className="space-y-1 text-right flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-black text-xs text-foreground font-mono">
                            فاتورة #{order.order_number}
                          </span>
                          {orderShift && (
                            <Badge variant="outline" className="text-[10px] font-bold">
                              {orderShift.shift_number}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-[10px] font-bold">
                            {order.cashier_name || orderShift?.cashier_name || "كاشير المطعم"}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {order.created_at
                              ? new Date(order.created_at).toLocaleString("ar-EG")
                              : ""}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1">
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
                                className="inline-block bg-muted/60 px-1.5 py-0.5 rounded border border-border text-[10px] font-bold"
                              >
                                {it.name_ar || it.name || "صنف"}{" "}
                                <span className="text-emerald-600 font-mono">
                                  x{it.quantity || 1}
                                </span>
                              </span>
                            ));
                          })()}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                        <div className="text-left font-mono">
                          <span
                            className={`text-sm font-black ${
                              isCancelled
                                ? "line-through text-muted-foreground"
                                : "text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {orderAmt.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>{" "}
                          <span className="bg-emerald-800 text-white text-[9px] font-black px-1.5 py-0.5 rounded">
                            {orderCurr}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setReviewOrderDialog(order)}
                            className="h-7 px-2.5 rounded-lg text-[11px] font-bold gap-1 cursor-pointer"
                          >
                            <Eye size={12} />
                            <span>مراجعة</span>
                          </Button>

                          {isCancelled ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-500/10 text-rose-600 border border-rose-500/25 text-[11px] font-black rounded-lg">
                              <XCircle size={12} />
                              <span>مرتجع</span>
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={isRefunding}
                              onClick={() => {
                                setRefundOrderDialog(order);
                                setCustomRefundAmount(orderAmt);
                                setCustomRefundCurrency(orderCurr);
                                setCustomRefundPaymentMethod(order.payment_method || "cash");
                              }}
                              className="bg-rose-600 hover:bg-rose-700 text-white font-black text-[11px] h-7 px-2.5 rounded-lg flex items-center gap-1 cursor-pointer"
                            >
                              {isRefunding ? (
                                <Loader2 className="animate-spin" size={12} />
                              ) : (
                                <RotateCcw size={12} />
                              )}
                              <span>مرتجع</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Invoice Review & Print Modal */}
      <Dialog
        open={Boolean(reviewOrderDialog)}
        onOpenChange={(open) => !open && setReviewOrderDialog(null)}
      >
        <DialogContent className="sm:max-w-lg rounded-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center justify-between">
              <span>مراجعة الفاتورة #{reviewOrderDialog?.order_number}</span>
              {reviewOrderDialog && (
                <Badge
                  variant={reviewOrderDialog.status === "cancelled" ? "destructive" : "outline"}
                >
                  {reviewOrderDialog.status === "cancelled" ? "مرتجع ومُلغى" : "مكتمل"}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {reviewOrderDialog && (
            <div className="space-y-4 text-xs">
              {(() => {
                const s = resolveOrderShift(reviewOrderDialog);
                const curr = getOrderCurrency(reviewOrderDialog, erpState.treasuryTransactions);
                const amt = getOrderOriginalAmount(
                  reviewOrderDialog,
                  exchangeRates,
                  erpState.treasuryTransactions,
                );
                const rawItems = reviewOrderDialog.items;
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

                return (
                  <>
                    <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-muted/50 border border-border">
                      <div>
                        <span className="text-muted-foreground block">الوردية:</span>
                        <span className="font-black">
                          {s?.shift_number || "-"}{" "}
                          {s?.auto_shift_number ? `(${s.auto_shift_number})` : ""}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">الكاشير:</span>
                        <span className="font-black">
                          {reviewOrderDialog.cashier_name || s?.cashier_name || "-"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">التاريخ والوقت:</span>
                        <span className="font-mono font-bold">
                          {reviewOrderDialog.created_at
                            ? new Date(reviewOrderDialog.created_at).toLocaleString("ar-EG")
                            : "-"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">طريقة الدفع:</span>
                        <span className="font-black">
                          {reviewOrderDialog.payment_method === "card"
                            ? "بطاقة بنكية"
                            : reviewOrderDialog.payment_method === "wallet"
                              ? "محفظة إلكترونية"
                              : "نقدي"}
                        </span>
                      </div>
                    </div>

                    <div className="border border-border rounded-2xl overflow-hidden">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-muted/50 border-b border-border font-bold">
                          <tr>
                            <th className="p-2.5">الصنف</th>
                            <th className="p-2.5">الكمية</th>
                            <th className="p-2.5">السعر</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {itemsList.map((it: any, i: number) => (
                            <tr key={i}>
                              <td className="p-2.5 font-bold">{it.name_ar || it.name || "صنف"}</td>
                              <td className="p-2.5 font-mono">x{it.quantity || 1}</td>
                              <td className="p-2.5 font-mono">
                                {Number(it.price || 0).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25">
                      <span className="font-black text-sm">الإجمالي</span>
                      <span className="font-mono font-black text-base text-emerald-700 dark:text-emerald-400">
                        {amt.toLocaleString()} {curr}
                      </span>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePrintSingleOrder(reviewOrderDialog)}
                        className="rounded-xl font-bold gap-1.5 cursor-pointer"
                      >
                        <Printer size={14} />
                        <span>طباعة الفاتورة</span>
                      </Button>

                      {reviewOrderDialog.status !== "cancelled" && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            const ord = reviewOrderDialog;
                            setReviewOrderDialog(null);
                            setRefundOrderDialog(ord);
                            setCustomRefundAmount(amt);
                            setCustomRefundCurrency(curr);
                            setCustomRefundPaymentMethod(ord.payment_method || "cash");
                          }}
                          className="rounded-xl font-bold gap-1.5 bg-rose-600 hover:bg-rose-700 cursor-pointer"
                        >
                          <RotateCcw size={14} />
                          <span>إجراء مرتجع</span>
                        </Button>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Close Shift / View Shift Report & Journal Entries Modal */}
      {(closingShiftModal || viewingShiftReport) && (
        <RestaurantShiftClosingReportModal
          isOpen={Boolean(closingShiftModal || viewingShiftReport)}
          onClose={() => {
            setClosingShiftModal(null);
            setViewingShiftReport(null);
          }}
          shiftToClose={closingShiftModal}
          viewOnlyShift={viewingShiftReport}
          orders={allOrders}
          onShiftClosed={() => {
            setClosingShiftModal(null);
            setViewingShiftReport(null);
            setErpState({ ...erpStore.getState() });
          }}
        />
      )}

      {/* Refund, Cash Transfer & Journal Entry, and Period Report Modals */}
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
