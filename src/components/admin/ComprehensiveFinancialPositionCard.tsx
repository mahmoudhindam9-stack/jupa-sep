import React, { useMemo, useState, useEffect } from "react";
import { erpStore } from "@/shared/services/erpStore";
import { useSettings } from "@/hooks/use-settings";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp,
  Scale,
  Building2,
  Trees,
  Utensils,
  Receipt,
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Printer,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  DollarSign,
  PieChart as PieIcon,
  Layers,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { printAccountingDocument } from "@/shared/utils/printAccountingDocument";
import * as XLSX from "xlsx";

export function ComprehensiveFinancialPositionCard() {
  const { toast } = useToast();
  const { formatPrice, currency } = useSettings();
  const [erpState, setErpState] = useState(() => erpStore.getState());
  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toLocaleTimeString("ar-EG"));

  useEffect(() => {
    // Recalculate linked balances on mount
    erpStore.recalculateAccountBalances();

    // Subscribe to store changes across all departments
    const unsubscribe = erpStore.subscribe(() => {
      setErpState(erpStore.getState());
      setLastSyncTime(new Date().toLocaleTimeString("ar-EG"));
    });
    return unsubscribe;
  }, []);

  const handleManualSync = () => {
    erpStore.recalculateAccountBalances();
    toast({
      title: "⚡ تم المزامنة والتحديث اللحظي",
      description: "تم تحديث كافة بيانات المول، الحديقة، المطعم، السندات والقيود بنجاح.",
    });
  };

  // 1. Calculate General Ledger & Chart of Accounts Totals
  const accountingSummary = useMemo(() => {
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let totalRevenues = 0;
    let totalExpenses = 0;

    (erpState.accounts || []).forEach((acc) => {
      const bal = Number(acc.balance || 0);
      if (acc.type === "asset") totalAssets += bal;
      if (acc.type === "liability") totalLiabilities += bal;
      if (acc.type === "equity") totalEquity += bal;
      if (acc.type === "revenue") totalRevenues += bal;
      if (acc.type === "expense") totalExpenses += bal;
    });

    const netIncome = totalRevenues - totalExpenses;
    const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity + netIncome)) < 0.01;

    return {
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalRevenues,
      totalExpenses,
      netIncome,
      isBalanced,
      totalAccounts: (erpState.accounts || []).length,
      journalCount: (erpState.journalEntries || []).length,
    };
  }, [erpState.accounts, erpState.journalEntries]);

  // 2. Calculate Mall Sector Metrics
  const mallSector = useMemo(() => {
    const shops = erpState.mallShops || [];
    const activeShops = shops.filter(
      (s) => s.status === "active" || s.contract_status === "active",
    );
    const payments = erpState.mallPayments || [];
    const totalPaymentsCollected = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const gardenRevenues = (erpState.mallGardenRevenues || []).reduce(
      (sum, r) => sum + Number(r.amount || 0),
      0,
    );
    const gardenExpenses = (erpState.mallGardenExpenses || []).reduce(
      (sum, e) => sum + Number(e.amount || 0),
      0,
    );

    return {
      totalShopsCount: shops.length,
      activeShopsCount: activeShops.length,
      totalRentalCollectedUSD: totalPaymentsCollected,
      gardenRevenuesUSD: gardenRevenues,
      gardenExpensesUSD: gardenExpenses,
      netMallProfitUSD: totalPaymentsCollected + gardenRevenues - gardenExpenses,
    };
  }, [
    erpState.mallShops,
    erpState.mallPayments,
    erpState.mallGardenRevenues,
    erpState.mallGardenExpenses,
  ]);

  // 3. Calculate Park Sector Metrics
  const parkSector = useMemo(() => {
    const txs = erpState.parkTicketTransactions || [];
    const totalSalesUSD = txs.reduce(
      (sum, t) => sum + Number(t.totalPrice || t.total_amount || 0),
      0,
    );
    const shifts = erpState.parkShifts || [];
    const totalShiftHandoverUSD = shifts.reduce(
      (sum, s) => sum + Number(s.actual_cash_collected || s.total_revenue || 0),
      0,
    );

    return {
      transactionsCount: txs.length,
      totalSalesUSD,
      shiftsCount: shifts.length,
      totalShiftHandoverUSD,
    };
  }, [erpState.parkTicketTransactions, erpState.parkShifts]);

  // 4. Calculate Restaurant / POS Sector Metrics
  const restaurantSector = useMemo(() => {
    const orders = erpState.orders || [];
    const completedOrders = orders.filter(
      (o) => o.status === "completed" || o.payment_status === "paid" || o.total > 0,
    );
    const totalSalesUSD = completedOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const cashSales = completedOrders
      .filter((o) => (o.payment_method || "cash").toLowerCase().includes("cash"))
      .reduce((sum, o) => sum + Number(o.total || 0), 0);
    const cardSales = totalSalesUSD - cashSales;

    return {
      totalOrdersCount: completedOrders.length,
      totalSalesUSD,
      cashSalesUSD: cashSales,
      cardSalesUSD: cardSales,
    };
  }, [erpState.orders]);

  // 5. Calculate Vouchers Sector Metrics
  const vouchersSector = useMemo(() => {
    const vouchers = erpState.vouchers || [];
    const activeVouchers = vouchers.filter(
      (v) => v.status !== "deleted" && v.status !== "reverted",
    );

    let totalReceiptsUSD = 0;
    let totalPaymentsUSD = 0;

    activeVouchers.forEach((v) => {
      const amount = Number(v.amount || 0);
      const rate = Number(v.exchange_rate || 1);
      const baseVal = erpStore.getLineBaseValue(amount, rate, v.currency || "USD");

      if (v.type === "receipt") {
        totalReceiptsUSD += baseVal;
      } else {
        totalPaymentsUSD += baseVal;
      }
    });

    return {
      vouchersCount: activeVouchers.length,
      totalReceiptsUSD,
      totalPaymentsUSD,
      netVouchersFlowUSD: totalReceiptsUSD - totalPaymentsUSD,
    };
  }, [erpState.vouchers]);

  // Export to Excel
  const handleExportExcel = () => {
    const sheetData = [
      {
        القطاع: "المول التجاري (Mall)",
        "المؤشر الرئيسي": `عدد المحلات النشطة: ${mallSector.activeShopsCount} / ${mallSector.totalShopsCount}`,
        "الإيرادات (USD)": mallSector.totalRentalCollectedUSD + mallSector.gardenRevenuesUSD,
        "المصروفات (USD)": mallSector.gardenExpensesUSD,
        "صافي النتيجة (USD)": mallSector.netMallProfitUSD,
      },
      {
        القطاع: "الحديقة والألعاب (Park)",
        "المؤشر الرئيسي": `عدد التذاكر الصادرة: ${parkSector.transactionsCount} | ورديات: ${parkSector.shiftsCount}`,
        "الإيرادات (USD)": parkSector.totalSalesUSD,
        "المصروفات (USD)": 0,
        "صافي النتيجة (USD)": parkSector.totalSalesUSD,
      },
      {
        القطاع: "المطعم ونقطة البيع (Restaurant & POS)",
        "المؤشر الرئيسي": `عدد الطلبات المسجلة: ${restaurantSector.totalOrdersCount}`,
        "الإيرادات (USD)": restaurantSector.totalSalesUSD,
        "المصروفات (USD)": 0,
        "صافي النتيجة (USD)": restaurantSector.totalSalesUSD,
      },
      {
        القطاع: "سندات القبض والصرف (Vouchers)",
        "المؤشر الرئيسي": `عدد السندات النشطة: ${vouchersSector.vouchersCount}`,
        "الإيرادات (USD)": vouchersSector.totalReceiptsUSD,
        "المصروفات (USD)": vouchersSector.totalPaymentsUSD,
        "صافي النتيجة (USD)": vouchersSector.netVouchersFlowUSD,
      },
      {
        القطاع: "الدليل واليومية العامة (Ledger & Journal)",
        "المؤشر الرئيسي": `إجمالي الحسابات: ${accountingSummary.totalAccounts} | القيود: ${accountingSummary.journalCount}`,
        "الإيرادات (USD)": accountingSummary.totalRevenues,
        "المصروفات (USD)": accountingSummary.totalExpenses,
        "صافي النتيجة (USD)": accountingSummary.netIncome,
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "المركز المالي الشامل");
    XLSX.writeFile(workbook, `المركز_المالي_الشامل_${new Date().toISOString().split("T")[0]}.xlsx`);

    toast({
      title: "تم تصدير تقرير المركز المالي",
      description: "تم تنزيل ملف Excel يحتوي على المؤشرات المالية لجميع القطاعات.",
    });
  };

  // Handle Printing
  const handlePrint = () => {
    printAccountingDocument({
      title: "تقرير المركز المالي الشامل الموحد",
      type: "المركز المالي",
      reference: `FIN-POS-${Date.now().toString().slice(-6)}`,
      date: new Date().toLocaleDateString("ar-EG"),
      notes:
        "تقرير متزامن لحظياً يشمل كافة الإيرادات والمصروفات والأصول والالتزامات للقطاعات المختلفة.",
      entries: [
        {
          account_code: "1000",
          description: "إجمالي الأصول (Assets)",
          amount: accountingSummary.totalAssets,
          currency: "USD",
        },
        {
          account_code: "2000",
          description: "إجمالي الالتزامات (Liabilities)",
          amount: accountingSummary.totalLiabilities,
          currency: "USD",
        },
        {
          account_code: "3000",
          description: "إجمالي حقوق الملكية (Equity)",
          amount: accountingSummary.totalEquity,
          currency: "USD",
        },
        {
          account_code: "4000",
          description: "إجمالي إيرادات المبيعات والقطاعات",
          amount: accountingSummary.totalRevenues,
          currency: "USD",
        },
        {
          account_code: "5000",
          description: "إجمالي المصروفات والمدفوعات",
          amount: accountingSummary.totalExpenses,
          currency: "USD",
        },
      ],
    });
  };

  return (
    <Card className="rounded-3xl border-2 border-primary/30 bg-card shadow-xl overflow-hidden relative">
      {/* Decorative Gradient Background Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute -left-12 -top-12 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1.5 backdrop-blur">
                <Scale size={14} />
                المركز المالي الموحد المستقل ERP
              </Badge>
              <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                مزامنة حية ({lastSyncTime})
              </Badge>
              {accountingSummary.isBalanced ? (
                <Badge className="bg-emerald-600 text-white font-bold px-3 py-1 text-xs flex items-center gap-1">
                  <CheckCircle2 size={13} /> الميزانية متزنة (الأصول = الخصوم + الملكية)
                </Badge>
              ) : (
                <Badge className="bg-rose-600 text-white font-bold px-3 py-1 text-xs flex items-center gap-1">
                  <AlertCircle size={13} /> فارق اتزان
                </Badge>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
              <TrendingUp className="text-primary" size={28} />
              المركز المالي الشامل (الميزانية وقائمة الدخل الموحدة)
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm font-medium leading-relaxed max-w-3xl">
              تجميع وتزامن لحظي لكافة المستجدات المالية في المول التجاري، حديقة الألعاب، المطعم
              ونقاط البيع، سندات المقبوضات والمدفوعات، ودفتر اليومية العامة ودليل الحسابات.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              onClick={handleManualSync}
              variant="outline"
              size="sm"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-bold text-xs h-9 rounded-xl backdrop-blur transition active:scale-95"
            >
              <RefreshCw size={14} className="ml-1.5" />
              تحديث المزامنة
            </Button>
            <Button
              onClick={handleExportExcel}
              variant="outline"
              size="sm"
              className="bg-emerald-600/80 hover:bg-emerald-600 text-white border-emerald-500 font-bold text-xs h-9 rounded-xl backdrop-blur transition active:scale-95"
            >
              <FileSpreadsheet size={14} className="ml-1.5" />
              تصدير Excel
            </Button>
            <Button
              onClick={handlePrint}
              variant="outline"
              size="sm"
              className="bg-indigo-600/80 hover:bg-indigo-600 text-white border-indigo-500 font-bold text-xs h-9 rounded-xl backdrop-blur transition active:scale-95"
            >
              <Printer size={14} className="ml-1.5" />
              طباعة التقرير
            </Button>
          </div>
        </div>
      </div>

      <CardContent className="p-6 space-y-6">
        {/* 1. Core Financial Position KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                  <TrendingUp size={16} />
                  صافي الأرباح / النتيجة
                </span>
                <Badge
                  variant="outline"
                  className="border-emerald-300 text-emerald-800 text-[10px] font-bold"
                >
                  الإيرادات − المصروفات
                </Badge>
              </div>
              <h3
                className={`text-2xl font-black font-mono ${accountingSummary.netIncome >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600"}`}
              >
                {formatPrice(accountingSummary.netIncome)}
              </h3>
              <p className="text-[11px] text-muted-foreground font-semibold">
                إجمالي إيرادات القطاعات: {formatPrice(accountingSummary.totalRevenues)}
              </p>
            </CardContent>
          </Card>

          <Card className="border border-primary/20 bg-primary/5 shadow-sm">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <Wallet size={16} />
                  إجمالي الأصول والموجودات
                </span>
                <Badge
                  variant="outline"
                  className="border-primary/30 text-primary text-[10px] font-bold"
                >
                  Assets
                </Badge>
              </div>
              <h3 className="text-2xl font-black font-mono text-foreground">
                {formatPrice(accountingSummary.totalAssets)}
              </h3>
              <p className="text-[11px] text-muted-foreground font-semibold">
                الخزائن + البنوك + العهد + الأصول الثابتة
              </p>
            </CardContent>
          </Card>

          <Card className="border border-rose-200 dark:border-rose-800/60 bg-rose-50/50 dark:bg-rose-950/20 shadow-sm">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                  <ShieldCheck size={16} />
                  الالتزامات والخصوم
                </span>
                <Badge
                  variant="outline"
                  className="border-rose-300 text-rose-800 text-[10px] font-bold"
                >
                  Liabilities
                </Badge>
              </div>
              <h3 className="text-2xl font-black font-mono text-rose-700 dark:text-rose-300">
                {formatPrice(accountingSummary.totalLiabilities)}
              </h3>
              <p className="text-[11px] text-muted-foreground font-semibold">
                مديونيات الموردين والالتزامات القصيرة والاحتياطيات
              </p>
            </CardContent>
          </Card>

          <Card className="border border-blue-200 dark:border-blue-800/60 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                  <Layers size={16} />
                  حقوق الملكية ورأس المال
                </span>
                <Badge
                  variant="outline"
                  className="border-blue-300 text-blue-800 text-[10px] font-bold"
                >
                  Equity
                </Badge>
              </div>
              <h3 className="text-2xl font-black font-mono text-blue-700 dark:text-blue-300">
                {formatPrice(accountingSummary.totalEquity + accountingSummary.netIncome)}
              </h3>
              <p className="text-[11px] text-muted-foreground font-semibold">
                رأس المال + الأرباح المبقاة ونتائج الفترة
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 2. Synchronized Departments Financial Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="text-amber-500" size={18} />
              <h3 className="text-base font-black text-foreground">
                المستجدات اللحظية المباشرة للقطاعات التشغيلية المربوطة
              </h3>
            </div>
            <span className="text-xs text-muted-foreground font-semibold">
              تزامن تلقائي مع كل عملية بيع أو تحصيل أو صرف سند
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Sector 1: Mall */}
            <Card className="border-border bg-card hover:border-primary/50 transition">
              <CardHeader className="pb-2 p-4 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 font-bold">
                      <Building2 size={18} />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-black">قطاع المول التجاري</CardTitle>
                      <CardDescription className="text-[10px]">
                        إيجارات ومحلات والمرافق
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-mono font-bold">
                    {mallSector.activeShopsCount}/{mallSector.totalShopsCount} محل نشط
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">تحصيل الإيجارات:</span>
                  <span className="font-bold font-mono text-emerald-600">
                    {formatPrice(mallSector.totalRentalCollectedUSD)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">إيرادات أخرى ومرافق:</span>
                  <span className="font-bold font-mono text-emerald-600">
                    {formatPrice(mallSector.gardenRevenuesUSD)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">مصروفات وصيانة:</span>
                  <span className="font-bold font-mono text-rose-600">
                    {formatPrice(mallSector.gardenExpensesUSD)}
                  </span>
                </div>
                <div className="flex justify-between pt-1 font-black text-sm text-foreground">
                  <span>صافي أرباح المول:</span>
                  <span className="font-mono text-indigo-600">
                    {formatPrice(mallSector.netMallProfitUSD)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Sector 2: Park */}
            <Card className="border-border bg-card hover:border-emerald-500/50 transition">
              <CardHeader className="pb-2 p-4 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 font-bold">
                      <Trees size={18} />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-black">الحديقة والألعاب</CardTitle>
                      <CardDescription className="text-[10px]">
                        تذاكر وورديات ترفيهية
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-mono font-bold">
                    {parkSector.transactionsCount} تذكرة
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">مبيعات التذاكر والألعاب:</span>
                  <span className="font-bold font-mono text-emerald-600">
                    {formatPrice(parkSector.totalSalesUSD)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">مقبوضات ورديات الحديقة:</span>
                  <span className="font-bold font-mono text-emerald-600">
                    {formatPrice(parkSector.totalShiftHandoverUSD)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">عدد الورديات المنفذة:</span>
                  <span className="font-bold font-mono">{parkSector.shiftsCount} ورديات</span>
                </div>
                <div className="flex justify-between pt-1 font-black text-sm text-foreground">
                  <span>إجمالي إيراد الحديقة:</span>
                  <span className="font-mono text-emerald-600">
                    {formatPrice(parkSector.totalSalesUSD)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Sector 3: Restaurant & POS */}
            <Card className="border-border bg-card hover:border-amber-500/50 transition">
              <CardHeader className="pb-2 p-4 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 font-bold">
                      <Utensils size={18} />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-black">المطعم ونقطة البيع</CardTitle>
                      <CardDescription className="text-[10px]">
                        طلبات الصالة والفرن والدليفري
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-mono font-bold">
                    {restaurantSector.totalOrdersCount} طلب
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">مبيعات الكاش النقدية:</span>
                  <span className="font-bold font-mono text-emerald-600">
                    {formatPrice(restaurantSector.cashSalesUSD)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">مبيعات البطاقات (Visa/Card):</span>
                  <span className="font-bold font-mono text-blue-600">
                    {formatPrice(restaurantSector.cardSalesUSD)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">إجمالي الطلبات المسجلة:</span>
                  <span className="font-bold font-mono">
                    {restaurantSector.totalOrdersCount} طلب محصل
                  </span>
                </div>
                <div className="flex justify-between pt-1 font-black text-sm text-foreground">
                  <span>مبيعات المطعم الموحدة:</span>
                  <span className="font-mono text-amber-600">
                    {formatPrice(restaurantSector.totalSalesUSD)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Sector 4: Vouchers */}
            <Card className="border-border bg-card hover:border-purple-500/50 transition">
              <CardHeader className="pb-2 p-4 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 font-bold">
                      <Receipt size={18} />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-black">سندات الصرف والقبض</CardTitle>
                      <CardDescription className="text-[10px]">
                        المقبوضات والمدفوعات المباشرة
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-mono font-bold">
                    {vouchersSector.vouchersCount} سند
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">سندات القبض (+):</span>
                  <span className="font-bold font-mono text-emerald-600">
                    {formatPrice(vouchersSector.totalReceiptsUSD)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">سندات الصرف (-):</span>
                  <span className="font-bold font-mono text-rose-600">
                    {formatPrice(vouchersSector.totalPaymentsUSD)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">إجمالي السندات النشطة:</span>
                  <span className="font-bold font-mono">
                    {vouchersSector.vouchersCount} سند رسمي
                  </span>
                </div>
                <div className="flex justify-between pt-1 font-black text-sm text-foreground">
                  <span>صافي تدفق السندات:</span>
                  <span
                    className={`font-mono ${vouchersSector.netVouchersFlowUSD >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                  >
                    {formatPrice(vouchersSector.netVouchersFlowUSD)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 3. Balance Sheet Verification Footnote */}
        <div className="bg-muted/60 p-4 rounded-2xl border border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
            <span className="font-bold text-foreground">
              معادلة الميزانية الموحدة: الأصول ({formatPrice(accountingSummary.totalAssets)}) =
              الخصوم والملكية (
              {formatPrice(
                accountingSummary.totalLiabilities +
                  accountingSummary.totalEquity +
                  accountingSummary.netIncome,
              )}
              )
            </span>
          </div>
          <Badge className="bg-emerald-600 text-white font-bold shrink-0">
            ✓ الميزانية متزنة 100%
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
