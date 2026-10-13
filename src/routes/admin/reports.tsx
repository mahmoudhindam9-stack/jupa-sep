// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { erpStore } from "@/shared/services/erpStore";
import { inventoryService } from "@/features/inventory/services/inventoryService";
import { useSettings } from "@/hooks/use-settings";
import { printRawHtml } from "@/shared/utils/printAccountingDocument";
import * as XLSX from "xlsx";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import {
  FileBarChart,
  Calendar,
  TrendingUp,
  DollarSign,
  Package,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Printer,
  ShieldAlert,
  Sliders,
  Filter,
} from "lucide-react";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({ meta: [{ title: "التقارير المالية والتحليلات" }] }),
  component: ReportsPage,
});

type OrderItem = { name_ar: string; price: number; quantity: number; cost_price?: number };
type Order = {
  order_number: number;
  created_at: string;
  payment_method: string;
  order_type: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  items: OrderItem[] | null;
};
type Inventory = { cost: number; quantity: number };

function ReportsPage() {
  const { formatPrice, lang, formatTreasuryCurrency } = useSettings();
  const [activeTab, setActiveTab] = useState("sales");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [currencyFilter, setCurrencyFilter] = useState<string>("USD");

  // Sync state with erpStore
  const [erpState, setErpState] = useState(erpStore.getState());

  useEffect(() => {
    setErpState(erpStore.getState());
    return erpStore.subscribe(() => {
      setErpState({ ...erpStore.getState() });
    });
  }, []);

  const ordersQuery = useQuery({
    queryKey: ["admin", "reports", "orders", from, to],
    queryFn: async () => {
      let q = supabase.from("orders").select("*").order("created_at", { ascending: false });
      if (from) q = q.gte("created_at", new Date(from).toISOString());
      if (to) q = q.lte("created_at", new Date(to + "T23:59:59").toISOString());
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Order[];
    },
  });

  const inventoryQuery = useQuery({
    queryKey: ["admin", "reports", "inventory"],
    queryFn: async () => {
      try {
        const inv = await inventoryService.getInventory();
        return (inv ?? []) as unknown as Inventory[];
      } catch (err) {
        const { data, error } = await supabase.from("inventory").select("*");
        if (error) throw error;
        return (data ?? []) as unknown as Inventory[];
      }
    },
  });

  // Calculate stats based on filters
  const summary = useMemo(() => {
    const orders = ordersQuery.data ?? [];
    const total = orders.reduce((a, o) => a + Number(o.total), 0);
    const subtotal = orders.reduce((a, o) => a + Number(o.subtotal), 0);
    const tax = orders.reduce((a, o) => a + Number(o.tax), 0);
    let totalCost = 0;
    const byMethod: Record<string, number> = { cash: 0, card: 0, wallet: 0 };
    const byCurrency: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const itemsCount: Record<string, number> = {};
    let itemTotal = 0;

    orders.forEach((o) => {
      const curr = (o as any).currency || "EGP";
      byCurrency[curr] = (byCurrency[curr] ?? 0) + Number(o.total);

      byMethod[o.payment_method] = (byMethod[o.payment_method] ?? 0) + Number(o.total);
      byStatus[o.status] = (byStatus[o.status] ?? 0) + Number(o.total);
      const orderItems = Array.isArray(o.items)
        ? o.items
        : typeof o.items === "string"
          ? (() => {
              try {
                return JSON.parse(o.items);
              } catch {
                return [];
              }
            })()
          : [];

      (orderItems as OrderItem[]).forEach((it) => {
        itemsCount[it.name_ar] = (itemsCount[it.name_ar] ?? 0) + (it.quantity ?? 0);
        itemTotal += it.quantity ?? 0;
        totalCost += (it.cost_price || 0) * (it.quantity || 1);
      });
    });

    const topItems = Object.entries(itemsCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const profit = total - totalCost;

    return {
      total,
      subtotal,
      tax,
      totalCost,
      profit,
      count: orders.length,
      byMethod,
      byCurrency,
      byStatus,
      topItems,
      itemTotal,
    };
  }, [ordersQuery.data]);

  // Aggregate daily trend for selected date range
  const dailyTrend = useMemo(() => {
    const orders = ordersQuery.data ?? [];
    const grouped: Record<string, { EGP: number; USD: number; SSP: number }> = {};

    const sortedOrders = [...orders].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    sortedOrders.forEach((o) => {
      const dateStr = new Date(o.created_at).toLocaleDateString("ar-EG", {
        month: "numeric",
        day: "numeric",
      });
      if (!grouped[dateStr]) grouped[dateStr] = { EGP: 0, USD: 0, SSP: 0 };
      const curr = (o as any).currency || "EGP";
      if (curr === "USD") {
        grouped[dateStr].USD += Number(o.total);
      } else if (curr === "SSP") {
        grouped[dateStr].SSP += Number(o.total);
      } else {
        grouped[dateStr].EGP += Number(o.total);
      }
    });

    return Object.entries(grouped).map(([date, amounts]) => ({
      date,
      EGP: amounts.EGP,
      USD: amounts.USD,
      SSP: amounts.SSP,
    }));
  }, [ordersQuery.data]);

  const paymentChartData = useMemo(() => {
    const byMethod = summary.byMethod;
    const colors = { cash: "#800020", card: "#D4AF37", wallet: "#2E5B88" };
    return [
      { name: "نقدي", value: byMethod.cash || 0, color: colors.cash },
      { name: "بطاقة", value: byMethod.card || 0, color: colors.card },
      { name: "محفظة", value: byMethod.wallet || 0, color: colors.wallet },
    ].filter((item) => item.value > 0);
  }, [summary.byMethod]);

  const topItemsChartData = useMemo(() => {
    return summary.topItems.map(([name, qty]) => ({
      name,
      "الكمية المبيعة": qty,
    }));
  }, [summary.topItems]);

  const exportReport = () => {
    const orders = ordersQuery.data ?? [];
    if (orders.length === 0) {
      alert("لا توجد مبيعات للتصدير حالياً");
      return;
    }
    const rows = orders.map((o) => ({
      "رقم الطلب": o.order_number,
      التاريخ: new Date(o.created_at).toLocaleString("ar-EG"),
      "نوع الطلب":
        o.order_type === "dine_in"
          ? "داخل المطعم"
          : o.order_type === "takeaway"
            ? "تيك أواي"
            : "توصيل",
      "طريقة الدفع":
        o.payment_method === "cash" ? "نقدي" : o.payment_method === "card" ? "بطاقة" : "محفظة",
      العملة: (o as any).currency || "EGP",
      الحالة: o.status,
      "المجموع الفرعي": Number(o.subtotal),
      الضريبة: Number(o.tax),
      الإجمالي: Number(o.total),
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!views"] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, ws, "المبيعات");
    XLSX.writeFile(wb, `financial-report-${from || "all"}-${to || "all"}.xlsx`);
  };

  const inventoryValue = (inventoryQuery.data ?? []).reduce(
    (a, i) => a + Number(i.cost) * Number(i.quantity),
    0,
  );

  // 1. Filtered Journal Entries
  const filteredEntries = useMemo(() => {
    let entries = erpState.journalEntries || [];
    if (from) {
      entries = entries.filter((e) => new Date(e.date) >= new Date(from));
    }
    if (to) {
      entries = entries.filter((e) => new Date(e.date) <= new Date(to + "T23:59:59"));
    }
    if (branchFilter !== "all") {
      entries = entries.filter((e) => e.branch_id === branchFilter || !e.branch_id);
    }
    return entries;
  }, [erpState.journalEntries, from, to, branchFilter]);

  // 2. Real General Ledger / Accounts Calculations synchronized with journalEntries
  const accountsData = useMemo(() => {
    const accounts = erpState.accounts || [];

    // Map of account code -> current calculated balance
    const balancesMap: Record<string, number> = {};
    accounts.forEach((acc) => {
      balancesMap[acc.code] = 0;
    });

    if (!from && !to && branchFilter === "all") {
      // Use live accumulated account balances directly
      accounts.forEach((acc) => {
        balancesMap[acc.code] = Number(acc.balance) || 0;
      });
    } else {
      // Calculate balances from filtered journal entries
      filteredEntries.forEach((entry) => {
        (entry.lines || []).forEach((line) => {
          const code = line.account_code;
          if (balancesMap[code] === undefined) balancesMap[code] = 0;
          const debitBase = erpStore.getLineBaseValue(
            line.debit || 0,
            line.rate || 1,
            line.currency || "EGP",
          );
          const creditBase = erpStore.getLineBaseValue(
            line.credit || 0,
            line.rate || 1,
            line.currency || "EGP",
          );
          const acc = accounts.find((a) => a.code === code);
          const isDebitNature = acc?.type === "asset" || acc?.type === "expense";
          if (isDebitNature) {
            balancesMap[code] += debitBase - creditBase;
          } else {
            balancesMap[code] += creditBase - debitBase;
          }
        });
      });
    }

    // Revenue Accounts
    const revenueAccounts = accounts
      .filter((a) => a.type === "revenue")
      .map((a) => ({ ...a, calculatedBalance: balancesMap[a.code] || 0 }));
    const totalRevenue = revenueAccounts.reduce((sum, a) => sum + a.calculatedBalance, 0);

    // Expense Accounts
    const expenseAccounts = accounts
      .filter((a) => a.type === "expense")
      .map((a) => ({ ...a, calculatedBalance: balancesMap[a.code] || 0 }));
    const totalExpense = expenseAccounts.reduce((sum, a) => sum + a.calculatedBalance, 0);

    // COGS vs Operating Expenses
    const cogsAccounts = expenseAccounts.filter(
      (a) =>
        a.code.startsWith("51") ||
        a.code.startsWith("501") ||
        a.name_ar.includes("تكلفة") ||
        a.name_ar.includes("مشتريات") ||
        a.name_ar.includes("خامات") ||
        a.name_ar.includes("مخزون"),
    );
    const operatingExpenseAccounts = expenseAccounts.filter(
      (a) => !cogsAccounts.some((c) => c.code === a.code),
    );

    const totalCogs = cogsAccounts.reduce((sum, a) => sum + a.calculatedBalance, 0);
    const totalOperatingExpenses = operatingExpenseAccounts.reduce(
      (sum, a) => sum + a.calculatedBalance,
      0,
    );

    const grossProfit = totalRevenue - totalCogs;
    const netProfit = totalRevenue - totalExpense;

    // Asset Accounts
    const assetAccounts = accounts
      .filter((a) => a.type === "asset")
      .map((a) => ({ ...a, calculatedBalance: balancesMap[a.code] || 0 }));
    const totalAssets = assetAccounts.reduce((sum, a) => sum + a.calculatedBalance, 0);

    const cashAndBankAccounts = assetAccounts.filter(
      (a) =>
        a.code.startsWith("101") ||
        a.code.startsWith("102") ||
        a.name_ar.includes("خزينة") ||
        a.name_ar.includes("صندوق") ||
        a.name_ar.includes("بنك") ||
        a.name_ar.includes("CIB"),
    );
    const inventoryAccounts = assetAccounts.filter(
      (a) => a.code.startsWith("103") || a.name_ar.includes("مخزون") || a.name_ar.includes("بضاعة"),
    );
    const otherAssetAccounts = assetAccounts.filter(
      (a) =>
        !cashAndBankAccounts.some((c) => c.code === a.code) &&
        !inventoryAccounts.some((i) => i.code === a.code),
    );

    // Liability Accounts
    const liabilityAccounts = accounts
      .filter((a) => a.type === "liability")
      .map((a) => ({ ...a, calculatedBalance: balancesMap[a.code] || 0 }));
    const totalLiabilities = liabilityAccounts.reduce((sum, a) => sum + a.calculatedBalance, 0);

    // Equity Accounts
    const equityAccounts = accounts
      .filter((a) => a.type === "equity")
      .map((a) => ({ ...a, calculatedBalance: balancesMap[a.code] || 0 }));
    const totalEquityWithoutProfit = equityAccounts.reduce(
      (sum, a) => sum + a.calculatedBalance,
      0,
    );
    const totalEquity = totalEquityWithoutProfit + netProfit;

    return {
      revenueAccounts,
      totalRevenue,
      cogsAccounts,
      totalCogs,
      operatingExpenseAccounts,
      totalOperatingExpenses,
      totalExpense,
      grossProfit,
      netProfit,

      assetAccounts,
      cashAndBankAccounts,
      inventoryAccounts,
      otherAssetAccounts,
      totalAssets,

      liabilityAccounts,
      totalLiabilities,

      equityAccounts,
      totalEquityWithoutProfit,
      totalEquity,
    };
  }, [erpState.accounts, filteredEntries, from, to, branchFilter]);

  // Cash Flow calculations from real treasury transactions
  const cashFlowData = useMemo(() => {
    let txs = erpState.treasuryTransactions || [];
    if (from) {
      txs = txs.filter((t) => new Date(t.date || t.created_at || "") >= new Date(from));
    }
    if (to) {
      txs = txs.filter((t) => new Date(t.date || t.created_at || "") <= new Date(to + "T23:59:59"));
    }
    if (branchFilter !== "all") {
      txs = txs.filter((t) => t.branch_id === branchFilter || !t.branch_id);
    }

    const operatingInflows = txs
      .filter(
        (t) =>
          t.type === "sales" || t.type === "deposit" || t.type === "income" || t.type === "receipt",
      )
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const operatingOutflows = txs
      .filter(
        (t) =>
          t.type === "withdrawal" ||
          t.type === "expense" ||
          t.type === "purchase" ||
          t.type === "loan" ||
          t.type === "payment",
      )
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const netOperatingCashFlow = operatingInflows - operatingOutflows;

    const totalTreasuryBalances = (erpState.treasuries || []).reduce(
      (sum, tr) => sum + (Number(tr.balance) || 0),
      0,
    );

    return {
      operatingInflows,
      operatingOutflows,
      netOperatingCashFlow,
      totalTreasuryBalances,
      txs,
    };
  }, [erpState.treasuryTransactions, erpState.treasuries, from, to, branchFilter]);

  // Vouchers filters
  const filteredVouchers = useMemo(() => {
    return (erpState.vouchers || []).filter((v: any) => {
      if (from && new Date(v.created_at) < new Date(from)) return false;
      if (to && new Date(v.created_at) > new Date(to + "T23:59:59")) return false;
      if (branchFilter !== "all" && v.branch_id !== branchFilter) return false;
      return true;
    });
  }, [erpState.vouchers, branchFilter, from, to]);

  const handlePrint = () => {
    let title = "التقرير المالي العام";
    let contentHtml = "";

    const dateStr = `من ${from || "تاريخ التأسيس"} إلى ${to || new Date().toLocaleDateString("ar-EG")}`;
    const branchName =
      branchFilter === "all"
        ? "جميع الفروع"
        : erpState.branches.find((b) => b.id === branchFilter)?.name_ar || branchFilter;

    if (activeTab === "sales") {
      title = "تقرير المبيعات والتحليلات";
      contentHtml = `
        <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:12px; margin-top:15px;">
          <div style="border:1px solid #ccc; padding:12px; border-radius:8px;">
            <div style="font-size:12px; color:#666;">إجمالي طلبات الصالة والدليفري</div>
            <div style="font-size:18px; font-weight:bold; color:#0284c7;">${summary.count} طلب</div>
          </div>
          <div style="border:1px solid #ccc; padding:12px; border-radius:8px;">
            <div style="font-size:12px; color:#666;">المبيعات التشغيلية المحصلة</div>
            <div style="font-size:18px; font-weight:bold; color:#16a34a;">${formatPrice(summary.total)}</div>
          </div>
          <div style="border:1px solid #ccc; padding:12px; border-radius:8px;">
            <div style="font-size:12px; color:#666;">إجمالي الضريبة المضافة</div>
            <div style="font-size:18px; font-weight:bold;">${formatPrice(summary.tax)}</div>
          </div>
          <div style="border:1px solid #ccc; padding:12px; border-radius:8px;">
            <div style="font-size:12px; color:#666;">أصول المواد بالمخازن</div>
            <div style="font-size:18px; font-weight:bold;">${formatPrice(inventoryValue)}</div>
          </div>
        </div>
      `;
    } else if (activeTab === "pl") {
      title = "قائمة الأرباح والخسائر الدورية (P&L Statement)";
      contentHtml = `
        <table style="width:100%; border-collapse:collapse; margin-top:15px; font-size:13px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="padding:10px; border:1px solid #cbd5e1; text-align:right;">اسم الحساب / البند</th>
              <th style="padding:10px; border:1px solid #cbd5e1; text-align:left;">كود الحساب</th>
              <th style="padding:10px; border:1px solid #cbd5e1; text-align:left;">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            <tr style="font-weight:bold; background:#e2e8f0;">
              <td colSpan="2" style="padding:10px; border:1px solid #cbd5e1;">أولاً: الإيرادات التشغيلية (Revenues)</td>
              <td style="padding:10px; border:1px solid #cbd5e1; text-align:left; color:#16a34a;">${formatPrice(accountsData.totalRevenue)}</td>
            </tr>
            ${accountsData.revenueAccounts
              .map(
                (a) => `
              <tr>
                <td style="padding:8px 20px; border:1px solid #cbd5e1;">${a.name_ar}</td>
                <td style="padding:8px; border:1px solid #cbd5e1; text-align:left; font-family:monospace;">${a.code}</td>
                <td style="padding:8px; border:1px solid #cbd5e1; text-align:left;">${formatPrice(a.calculatedBalance)}</td>
              </tr>
            `,
              )
              .join("")}

            <tr style="font-weight:bold; background:#e2e8f0;">
              <td colSpan="2" style="padding:10px; border:1px solid #cbd5e1;">ثانياً: تكلفة البضاعة المباعة (Cost of Goods Sold - COGS)</td>
              <td style="padding:10px; border:1px solid #cbd5e1; text-align:left; color:#dc2626;">-${formatPrice(accountsData.totalCogs)}</td>
            </tr>
            ${accountsData.cogsAccounts
              .map(
                (a) => `
              <tr>
                <td style="padding:8px 20px; border:1px solid #cbd5e1;">${a.name_ar}</td>
                <td style="padding:8px; border:1px solid #cbd5e1; text-align:left; font-family:monospace;">${a.code}</td>
                <td style="padding:8px; border:1px solid #cbd5e1; text-align:left;">${formatPrice(a.calculatedBalance)}</td>
              </tr>
            `,
              )
              .join("")}

            <tr style="font-weight:bold; background:#fef08a;">
              <td colSpan="2" style="padding:10px; border:1px solid #cbd5e1;">إجمالي الربح التشغيلي (Gross Profit)</td>
              <td style="padding:10px; border:1px solid #cbd5e1; text-align:left; color:#16a34a;">${formatPrice(accountsData.grossProfit)}</td>
            </tr>

            <tr style="font-weight:bold; background:#e2e8f0;">
              <td colSpan="2" style="padding:10px; border:1px solid #cbd5e1;">ثالثاً: المصروفات العمومية والتشغيلية (Operating Expenses)</td>
              <td style="padding:10px; border:1px solid #cbd5e1; text-align:left; color:#dc2626;">-${formatPrice(accountsData.totalOperatingExpenses)}</td>
            </tr>
            ${accountsData.operatingExpenseAccounts
              .map(
                (a) => `
              <tr>
                <td style="padding:8px 20px; border:1px solid #cbd5e1;">${a.name_ar}</td>
                <td style="padding:8px; border:1px solid #cbd5e1; text-align:left; font-family:monospace;">${a.code}</td>
                <td style="padding:8px; border:1px solid #cbd5e1; text-align:left;">${formatPrice(a.calculatedBalance)}</td>
              </tr>
            `,
              )
              .join("")}

            <tr style="font-weight:bold; background:#bbf7d0; font-size:15px;">
              <td colSpan="2" style="padding:12px; border:1px solid #cbd5e1;">صافي الأرباح / الخسائر الدورية (Net Profit)</td>
              <td style="padding:12px; border:1px solid #cbd5e1; text-align:left;">${formatPrice(accountsData.netProfit)}</td>
            </tr>
          </tbody>
        </table>
      `;
    } else if (activeTab === "balance_sheet") {
      title = "الميزانية العمومية للفرع (Balance Sheet)";
      contentHtml = `
        <div style="display:flex; gap:20px; margin-top:15px;">
          <div style="flex:1;">
            <h4 style="border-bottom:2px solid #16a34a; padding-bottom:5px; margin-bottom:8px;">الأصول (Assets) - الإجمالي: ${formatPrice(accountsData.totalAssets)}</h4>
            <table style="width:100%; border-collapse:collapse; font-size:12px;">
              <thead>
                <tr style="background:#f1f5f9;">
                  <th style="padding:6px; border:1px solid #cbd5e1; text-align:right;">الحساب</th>
                  <th style="padding:6px; border:1px solid #cbd5e1; text-align:left;">الرصيد</th>
                </tr>
              </thead>
              <tbody>
                ${accountsData.assetAccounts
                  .map(
                    (a) => `
                  <tr>
                    <td style="padding:6px; border:1px solid #cbd5e1;">${a.name_ar} (${a.code})</td>
                    <td style="padding:6px; border:1px solid #cbd5e1; text-align:left;">${formatPrice(a.calculatedBalance)}</td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
          <div style="flex:1;">
            <h4 style="border-bottom:2px solid #dc2626; padding-bottom:5px; margin-bottom:8px;">الالتزامات وحقوق الملكية - الإجمالي: ${formatPrice(accountsData.totalLiabilities + accountsData.totalEquity)}</h4>
            <h5 style="margin:5px 0; color:#dc2626;">الالتزامات (${formatPrice(accountsData.totalLiabilities)})</h5>
            <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:12px;">
              <tbody>
                ${accountsData.liabilityAccounts
                  .map(
                    (a) => `
                  <tr>
                    <td style="padding:6px; border:1px solid #cbd5e1;">${a.name_ar} (${a.code})</td>
                    <td style="padding:6px; border:1px solid #cbd5e1; text-align:left;">${formatPrice(a.calculatedBalance)}</td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>
            <h5 style="margin:5px 0; color:#2563eb;">حقوق الملكية (${formatPrice(accountsData.totalEquity)})</h5>
            <table style="width:100%; border-collapse:collapse; font-size:12px;">
              <tbody>
                ${accountsData.equityAccounts
                  .map(
                    (a) => `
                  <tr>
                    <td style="padding:6px; border:1px solid #cbd5e1;">${a.name_ar} (${a.code})</td>
                    <td style="padding:6px; border:1px solid #cbd5e1; text-align:left;">${formatPrice(a.calculatedBalance)}</td>
                  </tr>
                `,
                  )
                  .join("")}
                <tr style="font-weight:bold; background:#f0fdf4;">
                  <td style="padding:6px; border:1px solid #cbd5e1;">أرباح / خسائر الفترة الحالية</td>
                  <td style="padding:6px; border:1px solid #cbd5e1; text-align:left;">${formatPrice(accountsData.netProfit)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else if (activeTab === "cashflow") {
      title = "قائمة التدفقات النقدية (Cash Flow Statement)";
      contentHtml = `
        <table style="width:100%; border-collapse:collapse; margin-top:15px; font-size:13px;">
          <tbody>
            <tr>
              <td style="padding:10px; border:1px solid #cbd5e1; font-weight:bold;">1. المقبوضات والنقد المحصل (Operating Inflows)</td>
              <td style="padding:10px; border:1px solid #cbd5e1; text-align:left; color:#16a34a; font-weight:bold;">+${formatPrice(cashFlowData.operatingInflows)}</td>
            </tr>
            <tr>
              <td style="padding:10px; border:1px solid #cbd5e1; font-weight:bold;">2. المدفوعات والمصروفات النقدية (Operating Outflows)</td>
              <td style="padding:10px; border:1px solid #cbd5e1; text-align:left; color:#dc2626; font-weight:bold;">-${formatPrice(cashFlowData.operatingOutflows)}</td>
            </tr>
            <tr style="font-weight:bold; background:#f1f5f9; font-size:14px;">
              <td style="padding:12px; border:1px solid #cbd5e1;">صافي التدفق النقدي التشغيلي (Net Operating Cash Flow)</td>
              <td style="padding:12px; border:1px solid #cbd5e1; text-align:left;">${formatPrice(cashFlowData.netOperatingCashFlow)}</td>
            </tr>
            <tr style="font-weight:bold; background:#e2e8f0; font-size:14px;">
              <td style="padding:12px; border:1px solid #cbd5e1;">إجمالي رصيد الخزائن والحسابات النقدية الفعلي</td>
              <td style="padding:12px; border:1px solid #cbd5e1; text-align:left; color:#0284c7;">${formatPrice(cashFlowData.totalTreasuryBalances)}</td>
            </tr>
          </tbody>
        </table>
      `;
    } else if (activeTab === "vouchers") {
      title = "سندات القبض والصرف والتسويات المالية";
      contentHtml = `
        <table style="width:100%; border-collapse:collapse; margin-top:15px; font-size:12px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="padding:8px; border:1px solid #cbd5e1; text-align:right;">رقم السند</th>
              <th style="padding:8px; border:1px solid #cbd5e1; text-align:right;">التاريخ</th>
              <th style="padding:8px; border:1px solid #cbd5e1; text-align:right;">نوع السند</th>
              <th style="padding:8px; border:1px solid #cbd5e1; text-align:right;">الفئة</th>
              <th style="padding:8px; border:1px solid #cbd5e1; text-align:left;">المبلغ</th>
              <th style="padding:8px; border:1px solid #cbd5e1; text-align:right;">البيان / الوصف</th>
            </tr>
          </thead>
          <tbody>
            ${filteredVouchers
              .map(
                (v) => `
              <tr>
                <td style="padding:6px; border:1px solid #cbd5e1; font-family:monospace; font-weight:bold;">${v.id.substring(4, 9).toUpperCase()}</td>
                <td style="padding:6px; border:1px solid #cbd5e1;">${new Date(v.created_at).toLocaleDateString("ar-EG")}</td>
                <td style="padding:6px; border:1px solid #cbd5e1;">${v.type === "receipt" ? "سند قبض (+)" : "سند صرف (-)"}</td>
                <td style="padding:6px; border:1px solid #cbd5e1;">${v.category || "-"}</td>
                <td style="padding:6px; border:1px solid #cbd5e1; text-align:left; font-weight:bold;">${Number(v.amount).toFixed(2)} ${v.currency || "EGP"}</td>
                <td style="padding:6px; border:1px solid #cbd5e1;">${v.description || "-"}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      `;
    } else {
      title = "شجرة الحسابات والدليل المحاسبي للفرع";
      contentHtml = `
        <table style="width:100%; border-collapse:collapse; margin-top:15px; font-size:12px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="padding:8px; border:1px solid #cbd5e1; text-align:right;">كود الحساب</th>
              <th style="padding:8px; border:1px solid #cbd5e1; text-align:right;">اسم الحساب</th>
              <th style="padding:8px; border:1px solid #cbd5e1; text-align:right;">نوع الحساب</th>
              <th style="padding:8px; border:1px solid #cbd5e1; text-align:center;">العملة</th>
              <th style="padding:8px; border:1px solid #cbd5e1; text-align:left;">الرصيد الدفتري الحالي</th>
            </tr>
          </thead>
          <tbody>
            ${(erpState.accounts || [])
              .map(
                (a) => `
              <tr>
                <td style="padding:6px; border:1px solid #cbd5e1; font-family:monospace; font-weight:bold;">${a.code}</td>
                <td style="padding:6px; border:1px solid #cbd5e1; font-weight:bold;">${a.name_ar}</td>
                <td style="padding:6px; border:1px solid #cbd5e1;">${a.type.toUpperCase()}</td>
                <td style="padding:6px; border:1px solid #cbd5e1; text-align:center; font-weight:bold;">${a.currency || "EGP"}</td>
                <td style="padding:6px; border:1px solid #cbd5e1; text-align:left; font-weight:bold; direction:ltr;">${formatTreasuryCurrency(a.balance, a.currency)}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      `;
    }

    const fullHtml = `<!DOCTYPE html>
<html lang="ar">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; padding: 20px; color: #0f172a; background: #fff; }
    .header { text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; }
    .header h1 { margin: 0; font-size: 20px; color: #0f172a; }
    .header p { margin: 4px 0 0; font-size: 13px; color: #475569; }
    .meta { display: flex; justify-content: space-between; font-size: 12px; color: #334155; margin-bottom: 15px; font-weight: bold; background: #f8fafc; padding: 10px 14px; border-radius: 8px; border: 1px solid #cbd5e1; }
    .signatures { margin-top: 40px; display: flex; justify-content: space-between; text-align: center; font-size: 12px; color: #475569; }
    .sig-box { flex: 1; margin: 0 10px; }
    .sig-line { border-top: 1px dashed #94a3b8; margin-top: 40px; padding-top: 6px; font-weight: bold; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>الشركة المصرية لادارة المشروعات السياحية والترفيهية (بهجت جروب)</h1>
    <p>نظام إداري متكامل Restocash ERP - ${title}</p>
  </div>
  <div class="meta">
    <span>الفترة: ${dateStr}</span>
    <span>الفرع: ${branchName}</span>
    <span>تاريخ الطباعة: ${new Date().toLocaleDateString("ar-EG")} ${new Date().toLocaleTimeString("ar-EG")}</span>
  </div>
  ${contentHtml}
  <div class="signatures">
    <div class="sig-box"><div class="sig-line">إعداد المحاسب</div></div>
    <div class="sig-box"><div class="sig-line">المراجعة والتدقيق</div></div>
    <div class="sig-box"><div class="sig-line">اعتماد المدير المالي</div></div>
  </div>
</body>
</html>`;

    printRawHtml(fullHtml);
  };

  return (
    <div className="space-y-6 pb-12 text-right print:p-0">
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5 print:hidden">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <FileBarChart className="text-primary" size={28} />
            المركز المالي والحسابات العامة
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            ميزانية موحدة، قوائم الأرباح والخسائر، التدفقات النقدية، الحسابات والقيود اليومية
            التلقائية
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handlePrint}
            variant="outline"
            className="gap-2 rounded-xl text-xs font-bold py-5"
          >
            <Printer size={16} /> طباعة القائمة الحالية
          </Button>
          <Button
            onClick={exportReport}
            disabled={(ordersQuery.data ?? []).length === 0}
            className="gap-2 rounded-xl text-xs font-bold py-5 bg-primary hover:bg-primary/90"
          >
            تصدير التقرير الحالي إلى Excel
          </Button>
        </div>
      </div>

      {/* Interactive Global Filters Bar */}
      <div className="flex flex-wrap items-center gap-4 bg-card border border-border/60 p-4 rounded-2xl shadow-sm print:hidden">
        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
          <Filter size={16} className="text-primary" />
          <span>محددات البحث والفرز المالي:</span>
        </div>
        {erpState.branches.length > 1 && (
          <div className="flex items-center gap-2">
            <Label className="text-xs font-bold">الفرع</Label>
            <select
              className="h-9 rounded-xl border border-input bg-background px-3 text-xs font-bold cursor-pointer"
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
            >
              <option value="all">
                الشركة المصرية لادارة المشروعات السياحية والترفيهية (بهجت جروب) (مجمع)
              </option>
              {erpState.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name_ar}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Label className="text-xs font-bold">العملة ميزان</Label>
          <select
            className="h-9 rounded-xl border border-input bg-background px-3 text-xs font-bold cursor-pointer"
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
          >
            <option value="EGP">الجنيه المصري (EGP)</option>
            <option value="USD">الدولار الأمريكي (USD)</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs font-bold">من</Label>
          <input
            type="date"
            className="h-9 rounded-xl border border-input bg-background px-3 text-xs font-bold cursor-pointer"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs font-bold">إلى</Label>
          <input
            type="date"
            className="h-9 rounded-xl border border-input bg-background px-3 text-xs font-bold cursor-pointer"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted p-1 rounded-xl flex flex-wrap gap-1 h-auto print:hidden">
          <TabsTrigger value="sales" className="rounded-lg font-bold py-2 px-4">
            تحليل المبيعات والطلب
          </TabsTrigger>
          <TabsTrigger value="pl" className="rounded-lg font-bold py-2 px-4">
            الأرباح والخسائر (P&L)
          </TabsTrigger>
          <TabsTrigger value="balance_sheet" className="rounded-lg font-bold py-2 px-4">
            الميزانية العمومية
          </TabsTrigger>
          <TabsTrigger value="cashflow" className="rounded-lg font-bold py-2 px-4">
            التدفقات النقدية
          </TabsTrigger>
          <TabsTrigger value="vouchers" className="rounded-lg font-bold py-2 px-4">
            سندات الصرف والقبض
          </TabsTrigger>
          <TabsTrigger value="ledger" className="rounded-lg font-bold py-2 px-4">
            شجرة الحسابات والقيود
          </TabsTrigger>
        </TabsList>

        {/* 1. SALES ANALYTICS TAB */}
        <TabsContent value="sales" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <ReportCard title="إجمالي طلبات الصالة والدليفري" value={summary.count} />
            <ReportCard
              title="مبيعات تشغيلية محصلة"
              value={
                Object.entries(summary.byCurrency).length > 0
                  ? Object.entries(summary.byCurrency)
                      .map(([c, v]) => `${v.toLocaleString()} ${c}`)
                      .join(" | ")
                  : formatPrice(0)
              }
            />
            <ReportCard title="الضريبة المضافة المجمعة" value={formatPrice(summary.tax)} />
            <ReportCard title="أصول المواد بالمخازن" value={formatPrice(inventoryValue)} />
          </div>

          <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-black flex items-center gap-2">
                <TrendingUp className="text-primary" size={18} />
                حركة الإيرادات للفترة المحددة
              </CardTitle>
              <CardDescription className="text-xs">
                تطور المبيعات التشغيلية لليوم والأسابيع السابقة
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-6">
              <div className="h-64">
                {dailyTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyTrend}>
                      <defs>
                        <linearGradient id="colorEGP" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="colorUSD" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="colorSSP" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="date"
                        stroke="#888888"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--color-card)",
                          borderColor: "var(--color-border)",
                          borderRadius: "12px",
                          fontSize: "12px",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="EGP"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorEGP)"
                      />
                      <Area
                        type="monotone"
                        dataKey="USD"
                        stroke="#22c55e"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorUSD)"
                      />
                      <Area
                        type="monotone"
                        dataKey="SSP"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorSSP)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                    <p className="text-xs font-semibold">لا توجد بيانات مبيعات لعرض المخطط</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader>
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <DollarSign className="text-accent" size={18} />
                  توزيع الإيرادات حسب وسيلة التحصيل
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row items-center justify-around p-6 gap-6">
                {paymentChartData.length > 0 ? (
                  <>
                    <div className="w-40 h-40 shrink-0 relative flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={paymentChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {paymentChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute text-center">
                        <span className="text-[10px] text-muted-foreground block leading-none">
                          مبيعات
                        </span>
                        <p className="text-xs font-black mt-0.5 text-foreground">
                          {formatPrice(summary.total)}
                        </p>
                      </div>
                    </div>
                    <div className="flex-1 space-y-3.5 w-full">
                      {paymentChartData.map((item, idx) => {
                        const pct = ((item.value / summary.total) * 100).toFixed(1);
                        return (
                          <div key={idx} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2.5">
                              <span
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: item.color }}
                              />
                              <span className="font-bold text-foreground">{item.name}</span>
                            </div>
                            <div className="text-left font-black">
                              <span>{formatPrice(item.value)}</span>
                              <Badge className="mr-2 font-bold text-[10px] bg-muted text-muted-foreground">
                                {pct}%
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-muted-foreground w-full">
                    لا توجد مبيعات مسجلة حالياً
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader>
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <Package className="text-primary" size={18} />
                  تحليل مبيعات الأصناف الخمسة الأولى
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-6">
                <div className="h-56">
                  {topItemsChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topItemsChartData} layout="vertical">
                        <XAxis
                          type="number"
                          stroke="#888888"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          dataKey="name"
                          type="category"
                          stroke="#888888"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          width={110}
                        />
                        <Tooltip
                          formatter={(value: any) => [`${value} وحدة`, "الكمية المبيعة"]}
                          contentStyle={{
                            backgroundColor: "var(--color-card)",
                            borderColor: "var(--color-border)",
                            borderRadius: "12px",
                            fontSize: "11px",
                          }}
                        />
                        <Bar
                          dataKey="الكمية المبيعة"
                          fill="oklch(0.42 0.14 25)"
                          radius={[0, 8, 8, 0]}
                          barSize={16}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                      <p className="text-xs font-semibold">لا توجد أطباق مسجلة كمبيعات</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 2. PROFIT & LOSS TAB */}
        <TabsContent value="pl" className="space-y-4 mt-4">
          <Card className="border-border">
            <CardHeader className="text-center border-b border-border">
              <CardTitle className="text-lg font-black">
                قائمة الأرباح والخسائر الدورية (P&L Statement)
              </CardTitle>
              <CardDescription>
                للفترة من {from || "تاريخ التأسيس"} إلى {to || "اليوم"}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Revenue */}
              <div className="space-y-2">
                <h4 className="font-bold text-emerald-600 text-sm border-b border-border pb-1.5 flex justify-between">
                  <span>أولاً: الإيرادات التشغيلية (Revenues)</span>
                  <span>{formatPrice(accountsData.totalRevenue)}</span>
                </h4>
                <div className="space-y-1 pl-4 text-xs">
                  {accountsData.revenueAccounts.length === 0 ? (
                    <div className="text-muted-foreground py-1">لا توجد حسابات إيرادات مسجلة</div>
                  ) : (
                    accountsData.revenueAccounts.map((acc) => (
                      <div
                        key={acc.id || acc.code}
                        className="flex justify-between text-muted-foreground"
                      >
                        <span>
                          {acc.name_ar} ({acc.code})
                        </span>
                        <span className="font-bold text-foreground">
                          {formatPrice(acc.calculatedBalance)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* COGS */}
              <div className="space-y-2">
                <h4 className="font-bold text-rose-600 text-sm border-b border-border pb-1.5 flex justify-between">
                  <span>ثانياً: تكلفة البضاعة المباعة (Cost of Goods Sold - COGS)</span>
                  <span>{formatPrice(-accountsData.totalCogs)}</span>
                </h4>
                <div className="space-y-1 pl-4 text-xs">
                  {accountsData.cogsAccounts.length === 0 ? (
                    <div className="text-muted-foreground py-1">
                      لا توجد تكاليف بضاعة مباشرة مسجلة
                    </div>
                  ) : (
                    accountsData.cogsAccounts.map((acc) => (
                      <div
                        key={acc.id || acc.code}
                        className="flex justify-between text-muted-foreground"
                      >
                        <span>
                          {acc.name_ar} ({acc.code})
                        </span>
                        <span className="font-bold text-foreground">
                          {formatPrice(acc.calculatedBalance)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Gross Profit */}
              <div className="bg-muted p-3.5 rounded-xl flex justify-between font-bold text-sm border border-border">
                <span>إجمالي الربح التشغيلي (Gross Profit)</span>
                <span
                  className={accountsData.grossProfit >= 0 ? "text-emerald-600" : "text-rose-600"}
                >
                  {formatPrice(accountsData.grossProfit)}
                </span>
              </div>

              {/* Operating Expenses */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm border-b border-border pb-1.5 flex justify-between">
                  <span>ثالثاً: المصروفات العمومية والتشغيلية (Expenses)</span>
                  <span>{formatPrice(-accountsData.totalOperatingExpenses)}</span>
                </h4>
                <div className="space-y-1 pl-4 text-xs">
                  {accountsData.operatingExpenseAccounts.length === 0 ? (
                    <div className="text-muted-foreground py-1">لا توجد مصروفات عمومية مسجلة</div>
                  ) : (
                    accountsData.operatingExpenseAccounts.map((acc) => (
                      <div
                        key={acc.id || acc.code}
                        className="flex justify-between text-muted-foreground"
                      >
                        <span>
                          {acc.name_ar} ({acc.code})
                        </span>
                        <span className="font-bold text-foreground">
                          {formatPrice(acc.calculatedBalance)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Net Profit */}
              <div className="bg-primary text-primary-foreground p-4 rounded-xl flex justify-between font-black text-base shadow-xs">
                <span>صافي الأرباح / الخسائر الدورية (Net Profit)</span>
                <span>{formatPrice(accountsData.netProfit)}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. BALANCE SHEET */}
        <TabsContent value="balance_sheet" className="space-y-4 mt-4">
          <Card className="border-border">
            <CardHeader className="text-center border-b border-border">
              <CardTitle className="text-lg font-black">
                الميزانية العمومية للفرع (Balance Sheet)
              </CardTitle>
              <CardDescription suppressHydrationWarning>
                كما في تاريخ اليوم {new Date().toLocaleDateString("ar-EG")}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Assets */}
              <div className="space-y-4 md:border-l border-border md:pl-6">
                <h3 className="font-black text-emerald-600 text-base border-b border-border pb-2 flex justify-between">
                  <span>الأصول (Assets)</span>
                  <span>{formatPrice(accountsData.totalAssets)}</span>
                </h3>
                <div className="space-y-3 text-xs">
                  {accountsData.assetAccounts.length === 0 ? (
                    <div className="text-muted-foreground py-2">
                      لا توجد أصول مسجلة في شجرة الحسابات
                    </div>
                  ) : (
                    accountsData.assetAccounts.map((acc) => (
                      <div
                        key={acc.id || acc.code}
                        className="flex justify-between text-muted-foreground border-b border-border/40 pb-1"
                      >
                        <span className="font-medium text-foreground">
                          {acc.name_ar} ({acc.code})
                        </span>
                        <span className="font-bold text-foreground">
                          {formatPrice(acc.calculatedBalance)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Liabilities & Equity */}
              <div className="space-y-4">
                <h3 className="font-black text-rose-600 text-base border-b border-border pb-2 flex justify-between">
                  <span>الالتزامات وحقوق الملكية</span>
                  <span>
                    {formatPrice(accountsData.totalLiabilities + accountsData.totalEquity)}
                  </span>
                </h3>
                <div className="space-y-4 text-xs">
                  {/* Liabilities */}
                  <div className="space-y-2">
                    <div className="flex justify-between font-bold text-rose-600 border-b border-border pb-1">
                      <span>الالتزامات المطلوبة (Liabilities)</span>
                      <span>{formatPrice(accountsData.totalLiabilities)}</span>
                    </div>
                    {accountsData.liabilityAccounts.length === 0 ? (
                      <div className="text-muted-foreground py-1">لا توجد التزامات مسجلة</div>
                    ) : (
                      accountsData.liabilityAccounts.map((acc) => (
                        <div
                          key={acc.id || acc.code}
                          className="flex justify-between text-muted-foreground pl-3"
                        >
                          <span>
                            {acc.name_ar} ({acc.code})
                          </span>
                          <span className="font-bold text-foreground">
                            {formatPrice(acc.calculatedBalance)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Equity */}
                  <div className="space-y-2 pt-2">
                    <div className="flex justify-between font-bold text-blue-600 border-b border-border pb-1">
                      <span>حقوق الملكية (Equity)</span>
                      <span>{formatPrice(accountsData.totalEquity)}</span>
                    </div>
                    {accountsData.equityAccounts.map((acc) => (
                      <div
                        key={acc.id || acc.code}
                        className="flex justify-between text-muted-foreground pl-3"
                      >
                        <span>
                          {acc.name_ar} ({acc.code})
                        </span>
                        <span className="font-bold text-foreground">
                          {formatPrice(acc.calculatedBalance)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-muted-foreground pl-3 font-bold bg-muted/50 p-2 rounded-lg">
                      <span>أرباح / خسائر الفترة الحالية (Net Income)</span>
                      <span
                        className={
                          accountsData.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"
                        }
                      >
                        {formatPrice(accountsData.netProfit)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. CASH FLOW TAB */}
        <TabsContent value="cashflow" className="space-y-4 mt-4">
          <Card className="border-border">
            <CardHeader className="text-center border-b border-border">
              <CardTitle className="text-lg font-black">
                قائمة التدفقات النقدية (Cash Flow Statement)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4 text-sm">
              <div className="space-y-2">
                <p className="font-bold text-emerald-600 border-b border-border pb-1">
                  1. المقبوضات والنقد المحصل (Operating Inflows)
                </p>
                <div className="space-y-1 pl-4 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>إجمالي النقدية والمقبوضات المحصلة من حركات الخزينة</span>
                    <span className="text-emerald-600 font-bold">
                      +{formatPrice(cashFlowData.operatingInflows)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <p className="font-bold text-rose-600 border-b border-border pb-1">
                  2. المدفوعات والمصروفات النقدية (Operating Outflows)
                </p>
                <div className="space-y-1 pl-4 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>إجمالي المصروفات والمدفوعات الصادرة من الخزائن</span>
                    <span className="text-rose-600 font-bold">
                      -{formatPrice(cashFlowData.operatingOutflows)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-primary/10 text-primary p-3.5 rounded-xl flex justify-between font-black text-sm">
                <span>صافي التدفق النقدي التشغيلي</span>
                <span>{formatPrice(cashFlowData.netOperatingCashFlow)}</span>
              </div>

              <div className="bg-muted p-3.5 rounded-xl flex justify-between font-black text-sm border border-border">
                <span>إجمالي أرصدة الخزائن والحسابات البنكية الفعلية</span>
                <span className="text-emerald-600">
                  {formatPrice(cashFlowData.totalTreasuryBalances)}
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. VOUCHERS TAB */}
        <TabsContent value="vouchers" className="space-y-4 mt-4">
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-black">
                  سندات القبض والصرف والتسوية المالية
                </CardTitle>
                <CardDescription>دليل المستندات المالية الرسمية المسجلة في النظام</CardDescription>
              </div>
              {/* Approval notice */}
              <span className="bg-emerald-500/10 text-emerald-600 text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                <Printer size={12} />
                مستندات معتمدة ومرحّلة تلقائياً لدفتر الأستاذ
              </span>
            </CardHeader>
            <CardContent className="p-4">
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="text-right p-3.5 font-bold">رقم السند</th>
                      <th className="text-right p-3.5 font-bold">التاريخ والتوقيت</th>
                      <th className="text-right p-3.5 font-bold">نوع السند</th>
                      <th className="text-right p-3.5 font-bold">الفئة</th>
                      <th className="text-right p-3.5 font-bold">المبلغ</th>
                      <th className="text-right p-3.5 font-bold">طريقة الدفع الخزينة</th>
                      <th className="text-right p-3.5 font-bold">الوصف / البيان</th>
                      <th className="text-center p-3.5 font-bold">حالة الاعتماد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredVouchers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-10 text-muted-foreground">
                          لم يتم تسجيل سندات صرف أو قبض مخصصة للفرع اليوم
                        </td>
                      </tr>
                    ) : (
                      filteredVouchers.map((v) => (
                        <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3.5 font-mono text-xs font-bold text-primary">
                            {v.id.substring(4, 9).toUpperCase()}
                          </td>
                          <td className="p-3.5 text-muted-foreground">
                            {new Date(v.created_at).toLocaleString("ar-EG", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${v.type === "receipt" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}
                            >
                              {v.type === "receipt" ? "سند قبض (+)" : "سند صرف (-)"}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-700 font-bold">{v.category}</td>
                          <td className="p-3.5 font-black">
                            {Number(v?.amount ?? 0).toFixed(2)} {v.currency}
                          </td>
                          <td className="p-3.5 text-muted-foreground">
                            {v.payment_method === "cash" ? "خزينة الكاش" : "الحساب البنكي"}
                          </td>
                          <td className="p-3.5 text-muted-foreground">{v.description}</td>
                          <td className="p-3.5 text-center">
                            <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              مكتمل ومعتمد
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 6. CHART OF ACCOUNTS & COA TAB */}
        <TabsContent value="ledger" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left side: COA */}
            <div className="lg:col-span-2 bg-card border border-border p-5 rounded-2xl space-y-4">
              <h3 className="font-bold text-base text-foreground">
                شجرة الحسابات والدليل المحاسبي للفرع (Chart of Accounts)
              </h3>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="text-right p-3 font-bold">كود الحساب</th>
                      <th className="text-right p-3 font-bold">اسم الحساب (أستاذ عام)</th>
                      <th className="text-right p-3 font-bold">تصنيف الحساب</th>
                      <th className="text-center p-3 font-bold">العملة</th>
                      <th className="text-left p-3 font-bold">الرصيد الدفتري الحالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {erpState.accounts.map((acc) => {
                      let typeBadge = "bg-slate-100 text-slate-800";
                      if (acc.type === "asset") typeBadge = "bg-blue-100 text-blue-800";
                      else if (acc.type === "liability") typeBadge = "bg-rose-100 text-rose-800";
                      else if (acc.type === "revenue")
                        typeBadge = "bg-emerald-100 text-emerald-800";
                      else if (acc.type === "expense") typeBadge = "bg-amber-100 text-amber-800";

                      return (
                        <tr key={acc.code} className="hover:bg-muted/30">
                          <td className="p-3 font-mono text-xs font-bold text-slate-500">
                            {acc.code}
                          </td>
                          <td className="p-3 font-bold text-slate-800">{acc.name_ar}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${typeBadge}`}
                            >
                              {acc.type.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-mono text-[11px] font-bold px-2 py-0.5 rounded">
                              {acc.currency || "EGP"}
                            </span>
                          </td>
                          <td className="p-3 font-black text-slate-700 text-left font-mono dir-ltr">
                            {formatTreasuryCurrency(acc.balance, acc.currency)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right side: Accounting Lock Period & Activity */}
            <div className="bg-card border border-border p-5 rounded-2xl flex flex-col justify-between">
              <div className="space-y-4">
                <h3 className="font-bold text-base text-primary flex items-center gap-2">
                  <ShieldAlert className="text-amber-500" size={18} />
                  رقابة الفترات والقيود المالية
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  بصفتك مديراً عاماً للحسابات، يمكنك تفعيل قفل الفترة المحاسبية لمنع التلاعب في
                  فواتير المبيعات أو المشتريات السابقة.
                </p>

                <div className="bg-muted p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">قفل الفترة الحالية</span>
                    <Badge
                      variant={erpState.isAccountingPeriodLocked ? "destructive" : "secondary"}
                      className="font-bold"
                    >
                      {erpState.isAccountingPeriodLocked ? "مغلقة ومؤمنة" : "مفتوحة للتسجيل"}
                    </Badge>
                  </div>
                  <Button
                    onClick={() => {
                      erpStore.setPeriodLock(!erpState.isAccountingPeriodLocked);
                      setErpState(erpStore.getState());
                    }}
                    variant={erpState.isAccountingPeriodLocked ? "outline" : "destructive"}
                    className="w-full text-xs font-bold"
                  >
                    {erpState.isAccountingPeriodLocked
                      ? "فتح ترحيل القيود اليوم"
                      : "قفل الفترة المحاسبية نهائياً 🔒"}
                  </Button>
                </div>
              </div>

              <div className="text-xs text-slate-400 mt-6 border-t border-border pt-4">
                الشركة المصرية لادارة المشروعات السياحية والترفيهية (بهجت جروب) تضمن تشفير وتوثيق
                القيود اليومية تماشياً مع المعايير الدولية لإعداد التقارير المالية IFRS.
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReportCard({ title, value }: { title: string; value: string | number }) {
  return (
    <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden bg-card transition-all duration-200 hover:scale-[1.01]">
      <CardContent className="p-5">
        <p className="text-xs font-bold text-muted-foreground">{title}</p>
        <p className="text-xl font-black mt-1 text-primary tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}
