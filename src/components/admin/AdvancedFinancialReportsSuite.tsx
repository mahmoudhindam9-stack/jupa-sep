import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { erpStore, type Account, type JournalEntry } from "@/shared/services/erpStore";
import {
  printAccountingDocument,
  printRawHtml,
} from "@/shared/utils/printAccountingDocument";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Printer,
  FileSpreadsheet,
  Search,
  Scale,
  Layers,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Eye,
  BarChart3,
  CheckSquare,
  Square,
  Landmark,
  Wallet,
  FileText,
  ArrowUpRight,
  ArrowDownLeft,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";

export type FinancialReportTabId =
  | "account_status"
  | "comparison"
  | "general_trial"
  | "summary_trial"
  | "statements"
  | "analytical";

interface AdvancedFinancialReportsSuiteProps {
  initialSection?: FinancialReportTabId;
  compactHeader?: boolean;
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: "الأصول والممتلكات",
  liability: "الالتزامات والخصوم",
  equity: "حقوق الملكية ورأس المال",
  revenue: "الإيرادات والمبيعات",
  expense: "المصروفات والتكاليف",
};

const ACCOUNT_NATURE_LABELS: Record<string, { label: string; isDebitNature: boolean }> = {
  asset: { label: "طبيعة مدينة (Dr)", isDebitNature: true },
  expense: { label: "طبيعة مدينة (Dr)", isDebitNature: true },
  liability: { label: "طبيعة دائنة (Cr)", isDebitNature: false },
  equity: { label: "طبيعة دائنة (Cr)", isDebitNature: false },
  revenue: { label: "طبيعة دائنة (Cr)", isDebitNature: false },
};

function inferAccountLevel(acc: Account): number {
  if (typeof acc.level === "number" && acc.level >= 1 && acc.level <= 4) {
    return acc.level;
  }
  const code = String(acc.code || "").trim();
  if (code.length <= 1) return 1;
  if (code.length === 2) return 2;
  if (code.length <= 4) return 3;
  return 4;
}

function getLineUsdEquivalent(
  amount: number,
  rate: number | undefined,
  currency: string | undefined,
  exchangeRates: { SSP: number; EGP: number },
): number {
  const num = Number(amount) || 0;
  if (num === 0) return 0;
  try {
    if (typeof erpStore.getLineBaseValue === "function") {
      return Number(erpStore.getLineBaseValue(num, rate || 1, currency || "USD")) || 0;
    }
  } catch {
    // fallback below
  }
  const curr = (currency || "USD").toUpperCase();
  if (curr === "USD") return num;
  const r = Number(rate) || 0;
  if (r > 0 && r !== 1) {
    return r > 1 ? num / r : num * r;
  }
  if (curr === "SSP" && exchangeRates.SSP > 0) return num / exchangeRates.SSP;
  if (curr === "EGP" && exchangeRates.EGP > 0) return num / exchangeRates.EGP;
  return num;
}

export interface ComputedAccountDiagnostic {
  account: Account;
  code: string;
  name: string;
  type: Account["type"];
  level: number;
  parentCode: string;
  currency: string;
  isDebitNature: boolean;
  natureLabel: string;
  openingBalance: number;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  cumulativeDebit: number;
  cumulativeCredit: number;
  netPeriodMovement: number;
  closingSigned: number;
  closingBalanceAbs: number;
  closingSide: "Dr" | "Cr" | "Zero";
  closingDebit: number;
  closingCredit: number;
  txCount: number;
  firstTxDate: string | null;
  lastTxDate: string | null;
  shareOfTypePct: number;
  movements: {
    id: string;
    date: string;
    reference: string;
    description: string;
    debit: number;
    credit: number;
    origDebit: number;
    origCredit: number;
    currency: string;
    runningBalance: number;
  }[];
}

export function AdvancedFinancialReportsSuite({
  initialSection = "account_status",
  compactHeader = false,
}: AdvancedFinancialReportsSuiteProps) {
  const [activeTab, setActiveTab] = useState<FinancialReportTabId>(initialSection);
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "debit" | "credit" | "zero">(
    "all",
  );
  const [hideZeroBalances, setHideZeroBalances] = useState<boolean>(false);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [summaryMode, setSummaryMode] = useState<"groups" | "active_only" | "by_type">("groups");

  // Account Status Detail Modal state
  const [inspectedAccountCode, setInspectedAccountCode] = useState<string | null>(null);

  // Multi-account comparison state
  const [selectedComparisonCodes, setSelectedComparisonCodes] = useState<string[]>([]);
  const [comparisonSearch, setComparisonSearch] = useState("");
  const [showCombinedComparisonLedger, setShowCombinedComparisonLedger] = useState(false);

  const state = erpStore.getState();
  const accounts = state.accounts || [];
  const journalEntries = state.journalEntries || [];
  const treasuries = state.treasuries || [];
  const exchangeRates = useMemo(() => {
    try {
      const ssp =
        typeof erpStore.getExchangeRate === "function" ? Number(erpStore.getExchangeRate("SSP")) : 0;
      const egp =
        typeof erpStore.getExchangeRate === "function" ? Number(erpStore.getExchangeRate("EGP")) : 0;
      return {
        SSP: ssp > 0 ? ssp : 1500,
        EGP: egp > 0 ? egp : 50,
      };
    } catch {
      return { SSP: 1500, EGP: 50 };
    }
  }, [state]);

  // Compute full diagnostic metrics for every account
  const accountDiagnostics = useMemo<ComputedAccountDiagnostic[]>(() => {
    // Sort journal entries chronologically
    const sortedJournals = [...journalEntries].sort((a, b) =>
      (a.date || "").localeCompare(b.date || ""),
    );

    const mapByCode = new Map<
      string,
      {
        priorDebit: number;
        priorCredit: number;
        periodDebit: number;
        periodCredit: number;
        txCount: number;
        firstDate: string | null;
        lastDate: string | null;
        rawMovements: {
          id: string;
          date: string;
          reference: string;
          description: string;
          debit: number;
          credit: number;
          origDebit: number;
          origCredit: number;
          currency: string;
        }[];
      }
    >();

    for (const acc of accounts) {
      mapByCode.set(acc.code, {
        priorDebit: 0,
        priorCredit: 0,
        periodDebit: 0,
        periodCredit: 0,
        txCount: 0,
        firstDate: null,
        lastDate: null,
        rawMovements: [],
      });
    }

    for (const je of sortedJournals) {
      const jeDate = (je.date || "").slice(0, 10);
      const isBeforeFrom = Boolean(dateFrom && jeDate && jeDate < dateFrom);
      const isAfterTo = Boolean(dateTo && jeDate && jeDate > dateTo);
      if (isAfterTo) continue;

      for (let idx = 0; idx < (je.lines || []).length; idx++) {
        const line = je.lines[idx];
        const bucket = mapByCode.get(line.account_code);
        if (!bucket) continue;

        const curr = line.currency || je.currency || "USD";
        const drUsd = getLineUsdEquivalent(line.debit || 0, line.rate, curr, exchangeRates);
        const crUsd = getLineUsdEquivalent(line.credit || 0, line.rate, curr, exchangeRates);

        if (isBeforeFrom) {
          bucket.priorDebit += drUsd;
          bucket.priorCredit += crUsd;
        } else {
          bucket.periodDebit += drUsd;
          bucket.periodCredit += crUsd;
          if (drUsd > 0 || crUsd > 0) {
            bucket.txCount += 1;
            if (!bucket.firstDate || jeDate < bucket.firstDate) bucket.firstDate = jeDate;
            if (!bucket.lastDate || jeDate > bucket.lastDate) bucket.lastDate = jeDate;
            bucket.rawMovements.push({
              id: `${je.id}-${idx}`,
              date: jeDate,
              reference: je.reference || je.id.slice(0, 8),
              description: line.description || je.description || "قيد يومية",
              debit: drUsd,
              credit: crUsd,
              origDebit: Number(line.debit) || 0,
              origCredit: Number(line.credit) || 0,
              currency: curr,
            });
          }
        }
      }
    }

    // Build initial array
    const diagnostics: ComputedAccountDiagnostic[] = accounts.map((acc) => {
      const nature = ACCOUNT_NATURE_LABELS[acc.type] || {
        label: "طبيعة مدينة (Dr)",
        isDebitNature: true,
      };
      const isDebitNature = nature.isDebitNature;
      const bucket = mapByCode.get(acc.code)!;

      const initBal = Number(acc.initial_balance) || 0;
      const baseInitDr = isDebitNature
        ? Math.max(0, initBal)
        : initBal < 0
          ? Math.abs(initBal)
          : 0;
      const baseInitCr = !isDebitNature
        ? Math.max(0, initBal)
        : initBal < 0
          ? Math.abs(initBal)
          : 0;

      const rawOpenDr = baseInitDr + bucket.priorDebit;
      const rawOpenCr = baseInitCr + bucket.priorCredit;
      const netOpenDrCr = rawOpenDr - rawOpenCr;
      const openingDebit = netOpenDrCr > 0.001 ? netOpenDrCr : 0;
      const openingCredit = netOpenDrCr < -0.001 ? Math.abs(netOpenDrCr) : 0;
      const openingBalance = isDebitNature ? rawOpenDr - rawOpenCr : rawOpenCr - rawOpenDr;

      const periodDebit = bucket.periodDebit;
      const periodCredit = bucket.periodCredit;
      const cumulativeDebit = openingDebit + periodDebit;
      const cumulativeCredit = openingCredit + periodCredit;

      const netDrMinusCr = cumulativeDebit - cumulativeCredit;
      const closingDebit = netDrMinusCr > 0.001 ? netDrMinusCr : 0;
      const closingCredit = netDrMinusCr < -0.001 ? Math.abs(netDrMinusCr) : 0;
      const closingBalanceAbs = Math.max(closingDebit, closingCredit);
      const closingSide: "Dr" | "Cr" | "Zero" =
        closingDebit > 0.001 ? "Dr" : closingCredit > 0.001 ? "Cr" : "Zero";

      const closingSigned = isDebitNature
        ? cumulativeDebit - cumulativeCredit
        : cumulativeCredit - cumulativeDebit;
      const netPeriodMovement = isDebitNature
        ? periodDebit - periodCredit
        : periodCredit - periodDebit;

      let running = openingBalance;
      const movements = bucket.rawMovements.map((m) => {
        running += isDebitNature ? m.debit - m.credit : m.credit - m.debit;
        return {
          ...m,
          runningBalance: running,
        };
      });

      return {
        account: acc,
        code: acc.code,
        name: acc.name_ar || acc.name,
        type: acc.type,
        level: inferAccountLevel(acc),
        parentCode: acc.parent_code || "-",
        currency: acc.currency || "USD",
        isDebitNature,
        natureLabel: nature.label,
        openingBalance,
        openingDebit,
        openingCredit,
        periodDebit,
        periodCredit,
        cumulativeDebit,
        cumulativeCredit,
        netPeriodMovement,
        closingSigned,
        closingBalanceAbs,
        closingSide,
        closingDebit,
        closingCredit,
        txCount: bucket.txCount,
        firstTxDate: bucket.firstDate,
        lastTxDate: bucket.lastDate,
        shareOfTypePct: 0,
        movements,
      };
    });

    // Compute share of category %
    const totalByType: Record<string, number> = {};
    for (const d of diagnostics) {
      totalByType[d.type] = (totalByType[d.type] || 0) + d.closingBalanceAbs;
    }
    for (const d of diagnostics) {
      const denom = totalByType[d.type] || 0;
      d.shareOfTypePct = denom > 0 ? (d.closingBalanceAbs / denom) * 100 : 0;
    }

    return diagnostics.sort((a, b) => a.code.localeCompare(b.code));
  }, [accounts, journalEntries, dateFrom, dateTo, exchangeRates]);

  // Filtered list for Account Status & General Trial Balance
  const filteredDiagnostics = useMemo(() => {
    return accountDiagnostics.filter((d) => {
      if (levelFilter !== "all" && String(d.level) !== levelFilter) return false;
      if (typeFilter !== "all" && d.type !== typeFilter) return false;
      if (hideZeroBalances && d.closingBalanceAbs < 0.01 && d.periodDebit < 0.01 && d.periodCredit < 0.01) {
        return false;
      }
      if (statusFilter === "active" && d.txCount === 0 && d.closingBalanceAbs < 0.01) return false;
      if (statusFilter === "debit" && d.closingSide !== "Dr") return false;
      if (statusFilter === "credit" && d.closingSide !== "Cr") return false;
      if (statusFilter === "zero" && d.closingSide !== "Zero") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchCode = d.code.toLowerCase().includes(q);
        const matchName = d.name.toLowerCase().includes(q);
        if (!matchCode && !matchName) return false;
      }
      return true;
    });
  }, [accountDiagnostics, levelFilter, typeFilter, hideZeroBalances, statusFilter, searchQuery]);

  // Totals for General Trial Balance
  const generalTrialTotals = useMemo(() => {
    let openDr = 0;
    let openCr = 0;
    let periodDr = 0;
    let periodCr = 0;
    let cumDr = 0;
    let cumCr = 0;
    let closeDr = 0;
    let closeCr = 0;

    for (const d of filteredDiagnostics) {
      openDr += d.openingDebit;
      openCr += d.openingCredit;
      periodDr += d.periodDebit;
      periodCr += d.periodCredit;
      cumDr += d.cumulativeDebit;
      cumCr += d.cumulativeCredit;
      closeDr += d.closingDebit;
      closeCr += d.closingCredit;
    }

    return {
      openDr,
      openCr,
      periodDr,
      periodCr,
      cumDr,
      cumCr,
      closeDr,
      closeCr,
      isBalanced: Math.abs(closeDr - closeCr) < 0.05,
      diff: Math.abs(closeDr - closeCr),
    };
  }, [filteredDiagnostics]);

  // Summary Trial Balance rows based on summaryMode
  const summaryTrialRows = useMemo(() => {
    if (summaryMode === "active_only") {
      const rows = accountDiagnostics
        .filter((d) => d.closingBalanceAbs >= 0.01 || d.txCount > 0)
        .map((d) => ({
          code: d.code,
          name: d.name,
          typeLabel: ACCOUNT_TYPE_LABELS[d.type] || d.type,
          subCount: d.txCount,
          subLabel: `${d.txCount} حركة`,
          debit: d.closingDebit,
          credit: d.closingCredit,
        }));
      const totalDr = rows.reduce((s, r) => s + r.debit, 0);
      const totalCr = rows.reduce((s, r) => s + r.credit, 0);
      return { rows, totalDr, totalCr };
    }

    if (summaryMode === "by_type") {
      const typesOrder: Account["type"][] = ["asset", "liability", "equity", "revenue", "expense"];
      const rows = typesOrder.map((t, idx) => {
        const matching = accountDiagnostics.filter((d) => d.type === t);
        const dr = matching.reduce((s, d) => s + d.closingDebit, 0);
        const cr = matching.reduce((s, d) => s + d.closingCredit, 0);
        return {
          code: `${idx + 1}000`,
          name: ACCOUNT_TYPE_LABELS[t],
          typeLabel: "باب محاسبي رئيسي",
          subCount: matching.length,
          subLabel: `${matching.length} حساب`,
          debit: dr,
          credit: cr,
        };
      });
      const totalDr = rows.reduce((s, r) => s + r.debit, 0);
      const totalCr = rows.reduce((s, r) => s + r.credit, 0);
      return { rows, totalDr, totalCr };
    }

    // Default: "groups" — group by 2-digit prefix or Level 1/2 accounts
    const groupMap = new Map<
      string,
      {
        code: string;
        name: string;
        typeLabel: string;
        subCount: number;
        debit: number;
        credit: number;
      }
    >();

    for (const d of accountDiagnostics) {
      const prefix = d.code.slice(0, 2) || d.code.slice(0, 1) || "00";
      const parentAcc = accounts.find((a) => a.code === prefix || a.code === d.code.slice(0, 1));
      const existing = groupMap.get(prefix);
      if (!existing) {
        groupMap.set(prefix, {
          code: prefix,
          name:
            parentAcc?.name_ar ||
            parentAcc?.name ||
            `مجموعة ${ACCOUNT_TYPE_LABELS[d.type] || d.type} (${prefix})`,
          typeLabel: ACCOUNT_TYPE_LABELS[d.type] || d.type,
          subCount: 1,
          debit: d.closingDebit,
          credit: d.closingCredit,
        });
      } else {
        existing.subCount += 1;
        existing.debit += d.closingDebit;
        existing.credit += d.closingCredit;
      }
    }

    const rows = Array.from(groupMap.values())
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((g) => ({
        ...g,
        subLabel: `${g.subCount} حساب فرعي`,
      }));
    const totalDr = rows.reduce((s, r) => s + r.debit, 0);
    const totalCr = rows.reduce((s, r) => s + r.credit, 0);
    return { rows, totalDr, totalCr };
  }, [accountDiagnostics, summaryMode, accounts]);

  // Selected accounts for Comparison tab
  const selectedComparisonDiagnostics = useMemo(() => {
    if (selectedComparisonCodes.length === 0) return [];
    const codeSet = new Set(selectedComparisonCodes);
    return accountDiagnostics.filter((d) => codeSet.has(d.code));
  }, [accountDiagnostics, selectedComparisonCodes]);

  const comparisonTotals = useMemo(() => {
    const totalOpen = selectedComparisonDiagnostics.reduce((s, d) => s + d.openingBalance, 0);
    const totalDr = selectedComparisonDiagnostics.reduce((s, d) => s + d.periodDebit, 0);
    const totalCr = selectedComparisonDiagnostics.reduce((s, d) => s + d.periodCredit, 0);
    const totalCloseAbs = selectedComparisonDiagnostics.reduce(
      (s, d) => s + d.closingBalanceAbs,
      0,
    );
    const maxClose = selectedComparisonDiagnostics.reduce(
      (max, d) => Math.max(max, d.closingBalanceAbs),
      0,
    );
    const maxDrCr = selectedComparisonDiagnostics.reduce(
      (max, d) => Math.max(max, d.periodDebit, d.periodCredit),
      0,
    );
    return { totalOpen, totalDr, totalCr, totalCloseAbs, maxClose, maxDrCr };
  }, [selectedComparisonDiagnostics]);

  // Financial Statements data
  const statementsData = useMemo(() => {
    const assets = accountDiagnostics.filter((d) => d.type === "asset" && d.closingBalanceAbs > 0);
    const liabilities = accountDiagnostics.filter(
      (d) => d.type === "liability" && d.closingBalanceAbs > 0,
    );
    const equity = accountDiagnostics.filter((d) => d.type === "equity" && d.closingBalanceAbs > 0);
    const revenues = accountDiagnostics.filter(
      (d) => d.type === "revenue" && d.closingBalanceAbs > 0,
    );
    const expenses = accountDiagnostics.filter(
      (d) => d.type === "expense" && d.closingBalanceAbs > 0,
    );

    const totalAssets = assets.reduce(
      (s, d) => s + (d.closingSide === "Dr" ? d.closingBalanceAbs : -d.closingBalanceAbs),
      0,
    );
    const totalLiabilities = liabilities.reduce(
      (s, d) => s + (d.closingSide === "Cr" ? d.closingBalanceAbs : -d.closingBalanceAbs),
      0,
    );
    const totalEquityBase = equity.reduce(
      (s, d) => s + (d.closingSide === "Cr" ? d.closingBalanceAbs : -d.closingBalanceAbs),
      0,
    );
    const totalRevenue = revenues.reduce(
      (s, d) => s + (d.closingSide === "Cr" ? d.closingBalanceAbs : -d.closingBalanceAbs),
      0,
    );
    const totalExpense = expenses.reduce(
      (s, d) => s + (d.closingSide === "Dr" ? d.closingBalanceAbs : -d.closingBalanceAbs),
      0,
    );
    const netIncome = totalRevenue - totalExpense;
    const totalEquityWithIncome = totalEquityBase + netIncome;

    // Cash / Treasury accounts (codes starting with 1101, 1301, or linked to treasuries)
    const treasuryCodes = new Set(treasuries.map((t) => t.account_code).filter(Boolean));
    const cashAccounts = accountDiagnostics.filter(
      (d) =>
        treasuryCodes.has(d.code) ||
        d.code.startsWith("1101") ||
        d.code.startsWith("1301") ||
        d.name.includes("خزينة") ||
        d.name.includes("بنك") ||
        d.name.includes("صندوق"),
    );
    const totalCashIn = cashAccounts.reduce((s, d) => s + d.periodDebit, 0);
    const totalCashOut = cashAccounts.reduce((s, d) => s + d.periodCredit, 0);
    const netCashFlow = totalCashIn - totalCashOut;
    const endingCashBalance = cashAccounts.reduce((s, d) => s + d.closingSigned, 0);

    return {
      assets,
      liabilities,
      equity,
      revenues,
      expenses,
      totalAssets,
      totalLiabilities,
      totalEquityBase,
      totalRevenue,
      totalExpense,
      netIncome,
      totalEquityWithIncome,
      cashAccounts,
      totalCashIn,
      totalCashOut,
      netCashFlow,
      endingCashBalance,
    };
  }, [accountDiagnostics, treasuries]);

  // Multi-currency breakdown
  const currencyBreakdown = useMemo(() => {
    const map: Record<
      string,
      { currency: string; txCount: number; origDebit: number; origCredit: number; usdDebit: number; usdCredit: number }
    > = {
      USD: { currency: "USD", txCount: 0, origDebit: 0, origCredit: 0, usdDebit: 0, usdCredit: 0 },
      SSP: { currency: "SSP", txCount: 0, origDebit: 0, origCredit: 0, usdDebit: 0, usdCredit: 0 },
      EGP: { currency: "EGP", txCount: 0, origDebit: 0, origCredit: 0, usdDebit: 0, usdCredit: 0 },
    };

    for (const je of journalEntries) {
      for (const l of je.lines || []) {
        const c = (l.currency || je.currency || "USD").toUpperCase();
        if (!map[c]) {
          map[c] = { currency: c, txCount: 0, origDebit: 0, origCredit: 0, usdDebit: 0, usdCredit: 0 };
        }
        const dr = Number(l.debit) || 0;
        const cr = Number(l.credit) || 0;
        if (dr > 0 || cr > 0) {
          map[c].txCount += 1;
          map[c].origDebit += dr;
          map[c].origCredit += cr;
          map[c].usdDebit += getLineUsdEquivalent(dr, l.rate, c, exchangeRates);
          map[c].usdCredit += getLineUsdEquivalent(cr, l.rate, c, exchangeRates);
        }
      }
    }
    return Object.values(map);
  }, [journalEntries, exchangeRates]);

  const fmtNum = (val: number) =>
    (Number(val) || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const inspectedDiagnostic = useMemo(
    () => accountDiagnostics.find((d) => d.code === inspectedAccountCode) || null,
    [accountDiagnostics, inspectedAccountCode],
  );

  // Toggle selection for comparison
  const toggleComparisonAccount = (code: string) => {
    setSelectedComparisonCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  // Print Single Account Diagnostic Card + Statement
  const handlePrintSingleAccountStatus = (diag: ComputedAccountDiagnostic) => {
    printAccountingDocument({
      title: `تقرير تفصيل الحالة الحسابية وكشف الحساب — ${diag.name}`,
      subtitle: `كود الحساب: ${diag.code} | المستوى: ${diag.level} | التصنيف: ${ACCOUNT_TYPE_LABELS[diag.type]} | ${diag.natureLabel}`,
      metaItems: [
        { label: "الرصيد الافتتاحي", value: `$${fmtNum(diag.openingBalance)}` },
        { label: "إجمالي المدين (Dr)", value: `$${fmtNum(diag.periodDebit)}` },
        { label: "إجمالي الدائن (Cr)", value: `$${fmtNum(diag.periodCredit)}` },
        {
          label: "الرصيد الختامي",
          value: `$${fmtNum(diag.closingBalanceAbs)} (${diag.closingSide === "Dr" ? "مدين" : diag.closingSide === "Cr" ? "دائن" : "متزن"})`,
        },
      ],
      columns: [
        { key: "date", label: "التاريخ" },
        { key: "reference", label: "رقم المرجع" },
        { key: "description", label: "البيان والتفاصيل" },
        { key: "debit", label: "مدين (USD)" },
        { key: "credit", label: "دائن (USD)" },
        { key: "currency", label: "العملة الأصلية" },
        { key: "runningBalance", label: "الرصيد التراكمي" },
      ],
      rows:
        diag.movements.length > 0
          ? diag.movements.map((m) => ({
              date: m.date,
              reference: m.reference,
              description: m.description,
              debit: m.debit > 0 ? fmtNum(m.debit) : "-",
              credit: m.credit > 0 ? fmtNum(m.credit) : "-",
              currency: m.currency,
              runningBalance: fmtNum(m.runningBalance),
            }))
          : [
              {
                date: "-",
                reference: "-",
                description: "لا توجد حركات مسجلة خلال الفترة المحددة",
                debit: "0.00",
                credit: "0.00",
                currency: diag.currency,
                runningBalance: fmtNum(diag.closingSigned),
              },
            ],
      totals: [
        { label: "الرصيد الافتتاحي", value: `$${fmtNum(diag.openingBalance)}` },
        { label: "إجمالي المدين", value: `$${fmtNum(diag.periodDebit)}` },
        { label: "إجمالي الدائن", value: `$${fmtNum(diag.periodCredit)}` },
        { label: "صافي الحركة", value: `$${fmtNum(diag.netPeriodMovement)}` },
        {
          label: "الرصيد الختامي النهائي",
          value: `$${fmtNum(diag.closingBalanceAbs)} (${diag.closingSide === "Dr" ? "مدين" : diag.closingSide === "Cr" ? "دائن" : "متزن"})`,
        },
      ],
      summaryHtml: `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;font-size:11px;">
          <div><strong>عدد الحركات المسجلة:</strong> ${diag.txCount} حركة</div>
          <div><strong>تاريخ أول حركة:</strong> ${diag.firstTxDate || "—"}</div>
          <div><strong>تاريخ آخر حركة:</strong> ${diag.lastTxDate || "—"}</div>
          <div><strong>الوزن النسبي ضمن ${ACCOUNT_TYPE_LABELS[diag.type]}:</strong> ${diag.shareOfTypePct.toFixed(1)}%</div>
        </div>
      `,
    });
  };

  // Print All Filtered Account Status Diagnostic Report
  const handlePrintAllAccountStatus = () => {
    printAccountingDocument({
      title: "تقرير تفصيل الحالة الحسابية الشامل للحسابات",
      subtitle: `عدد الحسابات المشمولة بالتقرير: ${filteredDiagnostics.length} حساب | الفترة: ${dateFrom || "بداية النظام"} إلى ${dateTo || "تاريخ اليوم"}`,
      landscape: true,
      metaItems: [
        { label: "عدد الحسابات", value: `${filteredDiagnostics.length}` },
        { label: "إجمالي المدين للفترة", value: `$${fmtNum(generalTrialTotals.periodDr)}` },
        { label: "إجمالي الدائن للفترة", value: `$${fmtNum(generalTrialTotals.periodCr)}` },
        { label: "إجمالي الأرصدة الختامية", value: `$${fmtNum(generalTrialTotals.closeDr)}` },
      ],
      columns: [
        { key: "code", label: "كود الحساب" },
        { key: "name", label: "اسم الحساب" },
        { key: "level", label: "المستوى" },
        { key: "type", label: "التصنيف" },
        { key: "opening", label: "الرصيد الافتتاحي" },
        { key: "debit", label: "إجمالي المدين" },
        { key: "credit", label: "إجمالي الدائن" },
        { key: "netMove", label: "صافي الحركة" },
        { key: "closing", label: "الرصيد الختامي" },
        { key: "side", label: "حالة الرصيد" },
        { key: "txCount", label: "عدد الحركات" },
        { key: "lastDate", label: "آخر حركة" },
      ],
      rows: filteredDiagnostics.map((d) => ({
        code: d.code,
        name: d.name,
        level: `م${d.level}`,
        type: ACCOUNT_TYPE_LABELS[d.type],
        opening: fmtNum(d.openingBalance),
        debit: fmtNum(d.periodDebit),
        credit: fmtNum(d.periodCredit),
        netMove: fmtNum(d.netPeriodMovement),
        closing: fmtNum(d.closingBalanceAbs),
        side: d.closingSide === "Dr" ? "مدين (Dr)" : d.closingSide === "Cr" ? "دائن (Cr)" : "متزن (0)",
        txCount: d.txCount,
        lastDate: d.lastTxDate || "—",
      })),
      totals: [
        { label: "إجمالي المدين", value: `$${fmtNum(generalTrialTotals.periodDr)}` },
        { label: "إجمالي الدائن", value: `$${fmtNum(generalTrialTotals.periodCr)}` },
        { label: "إجمالي الأرصدة المدينة", value: `$${fmtNum(generalTrialTotals.closeDr)}` },
        { label: "إجمالي الأرصدة الدائنة", value: `$${fmtNum(generalTrialTotals.closeCr)}` },
      ],
    });
  };

  // Print Multi-Account Comparison Report
  const handlePrintComparisonReport = () => {
    if (selectedComparisonDiagnostics.length === 0) return;
    printAccountingDocument({
      title: "تقرير المقارنة المالية للحسابات المختارة",
      subtitle: `مقارنة تحليلية لعدد (${selectedComparisonDiagnostics.length}) حسابات محددة | الفترة: ${dateFrom || "بداية النظام"} إلى ${dateTo || "تاريخ اليوم"}`,
      landscape: true,
      metaItems: [
        { label: "عدد الحسابات المقارنة", value: `${selectedComparisonDiagnostics.length} حساب` },
        { label: "مجموع المدين للحسابات المختارة", value: `$${fmtNum(comparisonTotals.totalDr)}` },
        { label: "مجموع الدائن للحسابات المختارة", value: `$${fmtNum(comparisonTotals.totalCr)}` },
        {
          label: "مجموع الأرصدة الختامية المطلقة",
          value: `$${fmtNum(comparisonTotals.totalCloseAbs)}`,
        },
      ],
      columns: [
        { key: "code", label: "كود الحساب" },
        { key: "name", label: "اسم الحساب" },
        { key: "type", label: "التصنيف" },
        { key: "opening", label: "الرصيد الافتتاحي" },
        { key: "debit", label: "إجمالي المدين" },
        { key: "credit", label: "إجمالي الدائن" },
        { key: "netMove", label: "صافي حركة الفترة" },
        { key: "closing", label: "الرصيد الختامي" },
        { key: "side", label: "الجانب" },
        { key: "txCount", label: "عدد الحركات" },
        { key: "share", label: "النسبة من المجموعة المختارة" },
      ],
      rows: selectedComparisonDiagnostics.map((d) => {
        const pct =
          comparisonTotals.totalCloseAbs > 0
            ? ((d.closingBalanceAbs / comparisonTotals.totalCloseAbs) * 100).toFixed(1)
            : "0.0";
        return {
          code: d.code,
          name: d.name,
          type: ACCOUNT_TYPE_LABELS[d.type],
          opening: fmtNum(d.openingBalance),
          debit: fmtNum(d.periodDebit),
          credit: fmtNum(d.periodCredit),
          netMove: fmtNum(d.netPeriodMovement),
          closing: fmtNum(d.closingBalanceAbs),
          side: d.closingSide === "Dr" ? "مدين" : d.closingSide === "Cr" ? "دائن" : "متزن",
          txCount: d.txCount,
          share: `${pct}%`,
        };
      }),
      totals: [
        { label: "مجموع الافتتاحي", value: `$${fmtNum(comparisonTotals.totalOpen)}` },
        { label: "مجموع المدين", value: `$${fmtNum(comparisonTotals.totalDr)}` },
        { label: "مجموع الدائن", value: `$${fmtNum(comparisonTotals.totalCr)}` },
        { label: "إجمالي الأرصدة المختارة", value: `$${fmtNum(comparisonTotals.totalCloseAbs)}` },
      ],
    });
  };

  // Print Combined Statement for Selected Accounts
  const handlePrintSelectedAccountsMovements = () => {
    if (selectedComparisonDiagnostics.length === 0) return;
    const combinedMovements = selectedComparisonDiagnostics
      .flatMap((d) =>
        d.movements.map((m) => ({
          ...m,
          accountCode: d.code,
          accountName: d.name,
        })),
      )
      .sort((a, b) => a.date.localeCompare(b.date));

    printAccountingDocument({
      title: "كشف الحركات التفصيلي المجمّع للحسابات المختارة",
      subtitle: `يشمل حركات (${selectedComparisonDiagnostics.length}) حسابات مختارة (${combinedMovements.length} حركة)`,
      landscape: true,
      metaItems: [
        {
          label: "الحسابات المشمولة",
          value: selectedComparisonDiagnostics.map((d) => d.code).join(", "),
        },
        { label: "إجمالي عدد الحركات", value: `${combinedMovements.length}` },
        { label: "إجمالي المدين", value: `$${fmtNum(comparisonTotals.totalDr)}` },
        { label: "إجمالي الدائن", value: `$${fmtNum(comparisonTotals.totalCr)}` },
      ],
      columns: [
        { key: "date", label: "التاريخ" },
        { key: "reference", label: "المرجع" },
        { key: "accountCode", label: "كود الحساب" },
        { key: "accountName", label: "اسم الحساب" },
        { key: "description", label: "البيان" },
        { key: "debit", label: "مدين (USD)" },
        { key: "credit", label: "دائن (USD)" },
      ],
      rows:
        combinedMovements.length > 0
          ? combinedMovements.map((m) => ({
              date: m.date,
              reference: m.reference,
              accountCode: m.accountCode,
              accountName: m.accountName,
              description: m.description,
              debit: m.debit > 0 ? fmtNum(m.debit) : "-",
              credit: m.credit > 0 ? fmtNum(m.credit) : "-",
            }))
          : [
              {
                date: "-",
                reference: "-",
                accountCode: "-",
                accountName: "-",
                description: "لا توجد حركات مسجلة للحسابات المختارة",
                debit: "0.00",
                credit: "0.00",
              },
            ],
      totals: [
        { label: "إجمالي المدين", value: `$${fmtNum(comparisonTotals.totalDr)}` },
        { label: "إجمالي الدائن", value: `$${fmtNum(comparisonTotals.totalCr)}` },
      ],
    });
  };

  // Print General Trial Balance (8 columns)
  const handlePrintGeneralTrialBalance = () => {
    printAccountingDocument({
      title: "ميزان المراجعة العام الشامل (بالمجاميع والأرصدة)",
      subtitle: `عدد الحسابات: ${filteredDiagnostics.length} | المستوى: ${levelFilter === "all" ? "كافة المستويات" : `المستوى ${levelFilter}`} | الفترة: ${dateFrom || "بداية النظام"} إلى ${dateTo || "تاريخ اليوم"}`,
      landscape: true,
      metaItems: [
        { label: "إجمالي حركات المدين", value: `$${fmtNum(generalTrialTotals.periodDr)}` },
        { label: "إجمالي حركات الدائن", value: `$${fmtNum(generalTrialTotals.periodCr)}` },
        { label: "إجمالي الأرصدة المدينة", value: `$${fmtNum(generalTrialTotals.closeDr)}` },
        { label: "إجمالي الأرصدة الدائنة", value: `$${fmtNum(generalTrialTotals.closeCr)}` },
      ],
      columns: [
        { key: "code", label: "كود الحساب" },
        { key: "name", label: "اسم الحساب" },
        { key: "level", label: "المستوى" },
        { key: "openDr", label: "افتتاحي مدين" },
        { key: "openCr", label: "افتتاحي دائن" },
        { key: "periodDr", label: "حركة مدين" },
        { key: "periodCr", label: "حركة دائن" },
        { key: "cumDr", label: "مجموع مدين" },
        { key: "cumCr", label: "مجموع دائن" },
        { key: "closeDr", label: "رصيد مدين" },
        { key: "closeCr", label: "رصيد دائن" },
      ],
      rows: filteredDiagnostics.map((d) => ({
        code: d.code,
        name: d.name,
        level: `م${d.level}`,
        openDr: d.openingDebit > 0 ? fmtNum(d.openingDebit) : "-",
        openCr: d.openingCredit > 0 ? fmtNum(d.openingCredit) : "-",
        periodDr: d.periodDebit > 0 ? fmtNum(d.periodDebit) : "-",
        periodCr: d.periodCredit > 0 ? fmtNum(d.periodCredit) : "-",
        cumDr: d.cumulativeDebit > 0 ? fmtNum(d.cumulativeDebit) : "-",
        cumCr: d.cumulativeCredit > 0 ? fmtNum(d.cumulativeCredit) : "-",
        closeDr: d.closingDebit > 0 ? fmtNum(d.closingDebit) : "-",
        closeCr: d.closingCredit > 0 ? fmtNum(d.closingCredit) : "-",
      })),
      totals: [
        { label: "مجموع حركات الفترة (مدين)", value: `$${fmtNum(generalTrialTotals.periodDr)}` },
        { label: "مجموع حركات الفترة (دائن)", value: `$${fmtNum(generalTrialTotals.periodCr)}` },
        { label: "صافي الأرصدة المدينة", value: `$${fmtNum(generalTrialTotals.closeDr)}` },
        { label: "صافي الأرصدة الدائنة", value: `$${fmtNum(generalTrialTotals.closeCr)}` },
        {
          label: "حالة التوازن",
          value: generalTrialTotals.isBalanced
            ? "متوازن تماماً ✓"
            : `فارق: $${fmtNum(generalTrialTotals.diff)}`,
        },
      ],
    });
  };

  // Print Summary Trial Balance
  const handlePrintSummaryTrialBalance = () => {
    const modeLabel =
      summaryMode === "groups"
        ? "مجمّع حسب المجموعات الرئيسية"
        : summaryMode === "by_type"
          ? "مجمّع حسب الأبواب المحاسبية الخمسة"
          : "مختصر للحسابات التشغيلية النشطة فقط";

    printAccountingDocument({
      title: "ميزان المراجعة المختصر (بالأرصدة الصافية)",
      subtitle: `نمط التجميع: ${modeLabel} | عدد البنود: ${summaryTrialRows.rows.length}`,
      metaItems: [
        { label: "نمط التقرير", value: modeLabel },
        { label: "عدد البنود", value: `${summaryTrialRows.rows.length}` },
        { label: "إجمالي الأرصدة المدينة", value: `$${fmtNum(summaryTrialRows.totalDr)}` },
        { label: "إجمالي الأرصدة الدائنة", value: `$${fmtNum(summaryTrialRows.totalCr)}` },
      ],
      columns: [
        { key: "code", label: "الكود / المجموعة" },
        { key: "name", label: "اسم المجموعة / الحساب" },
        { key: "typeLabel", label: "التصنيف المحاسبي" },
        { key: "subLabel", label: "النطاق / النشاط" },
        { key: "debit", label: "صافي رصيد مدين (USD)" },
        { key: "credit", label: "صافي رصيد دائن (USD)" },
      ],
      rows: summaryTrialRows.rows.map((r) => ({
        code: r.code,
        name: r.name,
        typeLabel: r.typeLabel,
        subLabel: r.subLabel,
        debit: r.debit > 0 ? fmtNum(r.debit) : "-",
        credit: r.credit > 0 ? fmtNum(r.credit) : "-",
      })),
      totals: [
        { label: "إجمالي الأرصدة المدينة", value: `$${fmtNum(summaryTrialRows.totalDr)}` },
        { label: "إجمالي الأرصدة الدائنة", value: `$${fmtNum(summaryTrialRows.totalCr)}` },
        {
          label: "الفارق",
          value: `$${fmtNum(Math.abs(summaryTrialRows.totalDr - summaryTrialRows.totalCr))}`,
        },
      ],
    });
  };

  // Print Financial Statements (Income Statement + Balance Sheet + Cash Flow)
  const handlePrintFinancialStatements = (
    target: "all" | "income" | "balance_sheet" | "cash_flow",
  ) => {
    const nowStr = new Date().toLocaleString("ar-EG");

    const incomeHtml = `
      <div style="margin-bottom:24px;border:1px solid #cbd5e1;border-radius:10px;padding:16px;">
        <h2 style="margin:0 0 6px;font-size:16px;color:#0f172a;border-bottom:2px solid #10b981;padding-bottom:6px;">
          1. قائمة الدخل الشاملة (الأرباح والخسائر - Income Statement)
        </h2>
        <h3 style="font-size:13px;color:#047857;margin:10px 0 6px;">أولاً: الإيرادات والمبيعات التشغيلية</h3>
        <table>
          <thead><tr><th>كود الحساب</th><th>اسم حساب الإيراد</th><th>المبلغ (USD)</th></tr></thead>
          <tbody>
            ${
              statementsData.revenues
                .map(
                  (r) =>
                    `<tr><td>${r.code}</td><td>${r.name}</td><td style="font-weight:bold;color:#047857;">$${fmtNum(r.closingBalanceAbs)}</td></tr>`,
                )
                .join("") || `<tr><td colspan="3" style="text-align:center;">لا توجد إيرادات مسجلة</td></tr>`
            }
            <tr style="background:#ecfdf5;font-weight:800;"><td colspan="2">إجمالي الإيرادات</td><td style="color:#047857;">$${fmtNum(statementsData.totalRevenue)}</td></tr>
          </tbody>
        </table>

        <h3 style="font-size:13px;color:#be123c;margin:14px 0 6px;">ثانياً: المصروفات والتكاليف التشغيلية</h3>
        <table>
          <thead><tr><th>كود الحساب</th><th>اسم حساب المصروف</th><th>المبلغ (USD)</th></tr></thead>
          <tbody>
            ${
              statementsData.expenses
                .map(
                  (e) =>
                    `<tr><td>${e.code}</td><td>${e.name}</td><td style="font-weight:bold;color:#be123c;">$${fmtNum(e.closingBalanceAbs)}</td></tr>`,
                )
                .join("") || `<tr><td colspan="3" style="text-align:center;">لا توجد مصروفات مسجلة</td></tr>`
            }
            <tr style="background:#fff1f2;font-weight:800;"><td colspan="2">إجمالي المصروفات والتكاليف</td><td style="color:#be123c;">$${fmtNum(statementsData.totalExpense)}</td></tr>
          </tbody>
        </table>

        <div style="margin-top:12px;padding:12px;background:#0f172a;color:#fff;border-radius:8px;display:flex;justify-content:space-between;align-items:center;font-size:14px;font-weight:800;">
          <span>صافي الربح / (الخسارة) عن الفترة:</span>
          <span style="color:${statementsData.netIncome >= 0 ? "#34d399" : "#fb7185"};">$${fmtNum(statementsData.netIncome)} USD</span>
        </div>
      </div>
    `;

    const balanceSheetHtml = `
      <div style="margin-bottom:24px;border:1px solid #cbd5e1;border-radius:10px;padding:16px;">
        <h2 style="margin:0 0 6px;font-size:16px;color:#0f172a;border-bottom:2px solid #2563eb;padding-bottom:6px;">
          2. قائمة المركز المالي / الميزانية العمومية (Balance Sheet)
        </h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
          <div>
            <h3 style="font-size:13px;color:#1d4ed8;margin:8px 0;">جانب الأصول والممتلكات (Assets)</h3>
            <table>
              <thead><tr><th>الكود</th><th>الحساب</th><th>الرصيد (USD)</th></tr></thead>
              <tbody>
                ${
                  statementsData.assets
                    .map(
                      (a) =>
                        `<tr><td>${a.code}</td><td>${a.name}</td><td style="font-weight:bold;">$${fmtNum(a.closingBalanceAbs)}</td></tr>`,
                    )
                    .join("") || `<tr><td colspan="3">لا توجد أصول</td></tr>`
                }
                <tr style="background:#eff6ff;font-weight:800;"><td colspan="2">إجمالي الأصول</td><td>$${fmtNum(statementsData.totalAssets)}</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <h3 style="font-size:13px;color:#7c3aed;margin:8px 0;">جانب الالتزامات وحقوق الملكية</h3>
            <table>
              <thead><tr><th>الكود</th><th>الحساب</th><th>الرصيد (USD)</th></tr></thead>
              <tbody>
                ${statementsData.liabilities
                  .map(
                    (l) =>
                      `<tr><td>${l.code}</td><td>${l.name} (التزام)</td><td style="font-weight:bold;">$${fmtNum(l.closingBalanceAbs)}</td></tr>`,
                  )
                  .join("")}
                ${statementsData.equity
                  .map(
                    (eq) =>
                      `<tr><td>${eq.code}</td><td>${eq.name} (ملكية)</td><td style="font-weight:bold;">$${fmtNum(eq.closingBalanceAbs)}</td></tr>`,
                  )
                  .join("")}
                <tr><td>—</td><td>صافي أرباح / فائض الفترة الحالية</td><td style="font-weight:bold;color:#047857;">$${fmtNum(statementsData.netIncome)}</td></tr>
                <tr style="background:#f5f3ff;font-weight:800;"><td colspan="2">إجمالي الالتزامات وحقوق الملكية</td><td>$${fmtNum(statementsData.totalLiabilities + statementsData.totalEquityWithIncome)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    const cashFlowHtml = `
      <div style="margin-bottom:24px;border:1px solid #cbd5e1;border-radius:10px;padding:16px;">
        <h2 style="margin:0 0 6px;font-size:16px;color:#0f172a;border-bottom:2px solid #d97706;padding-bottom:6px;">
          3. قائمة التدفقات النقدية وحركة الخزائن والبنوك (Cash Flow Statement)
        </h2>
        <table>
          <thead><tr><th>كود الحساب</th><th>اسم الخزينة / البنك</th><th>الرصيد الافتتاحي</th><th>المقبوضات (الوارد)</th><th>المدفوعات (الصادر)</th><th>الرصيد الختامي</th></tr></thead>
          <tbody>
            ${
              statementsData.cashAccounts
                .map(
                  (c) =>
                    `<tr><td>${c.code}</td><td>${c.name}</td><td>$${fmtNum(c.openingBalance)}</td><td style="color:#047857;font-weight:bold;">+$${fmtNum(c.periodDebit)}</td><td style="color:#be123c;font-weight:bold;">-$${fmtNum(c.periodCredit)}</td><td style="font-weight:800;">$${fmtNum(c.closingSigned)}</td></tr>`,
                )
                .join("") || `<tr><td colspan="6" style="text-align:center;">لا توجد حسابات نقدية</td></tr>`
            }
            <tr style="background:#fef3c7;font-weight:800;">
              <td colspan="3">الإجمالي النقدي الموحد</td>
              <td style="color:#047857;">+$${fmtNum(statementsData.totalCashIn)}</td>
              <td style="color:#be123c;">-$${fmtNum(statementsData.totalCashOut)}</td>
              <td>$${fmtNum(statementsData.endingCashBalance)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    const bodySections =
      target === "income"
        ? incomeHtml
        : target === "balance_sheet"
          ? balanceSheetHtml
          : target === "cash_flow"
            ? cashFlowHtml
            : `${incomeHtml}${balanceSheetHtml}${cashFlowHtml}`;

    const docTitle =
      target === "income"
        ? "قائمة الدخل الشاملة (الأرباح والخسائر)"
        : target === "balance_sheet"
          ? "قائمة المركز المالي والميزانية العمومية"
          : target === "cash_flow"
            ? "قائمة التدفقات النقدية وحركة الخزائن"
            : "القوائم المالية الختامية الموحدة (الدخل + المركز المالي + التدفقات النقدية)";

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <title>${docTitle}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    body { font-family: 'Cairo', 'Tajawal', sans-serif; direction: rtl; color: #0f172a; background: #fff; margin: 0; padding: 16px; font-size: 12px; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px double #0f172a; padding-bottom: 12px; margin-bottom: 18px; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 900; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 11.5px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; }
    th { background: #f1f5f9; font-weight: 800; }
    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 32px; text-align: center; font-weight: bold; }
    .sig-line { border-top: 1px dashed #64748b; padding-top: 8px; margin-top: 36px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${docTitle}</h1>
      <div style="font-size:11px;color:#475569;margin-top:4px;">نظام الإدارة المالية والمحاسبية الشامل — Restocash ERP</div>
    </div>
    <div style="font-size:11px;color:#475569;text-align:left;">
      <div>تاريخ الإصدار: ${nowStr}</div>
      <div>عملة التقرير: الدولار الأمريكي (USD)</div>
    </div>
  </div>
  ${bodySections}
  <div class="signatures">
    <div><div class="sig-line">إعداد المحاسب المالي</div></div>
    <div><div class="sig-line">مراجعة رئيس الحسابات</div></div>
    <div><div class="sig-line">اعتماد المدير المالي والعام</div></div>
  </div>
</body>
</html>`;

    printRawHtml(html);
  };

  // Excel Export Helper
  const exportRowsToExcel = (rows: Record<string, any>[], sheetName: string, fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Suite Action Toolbar */}
      {!compactHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-xs print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Scale size={18} />
            </div>
            <h2 className="text-base sm:text-lg font-black text-foreground">
              القوائم المالية وميزان المراجعة والتحليلات
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={handlePrintGeneralTrialBalance}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl gap-1.5 h-8"
            >
              <Printer size={14} />
              طباعة ميزان مراجعة عام
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrintSummaryTrialBalance}
              className="font-bold text-xs rounded-xl gap-1.5 h-8"
            >
              <Printer size={14} />
              طباعة ميزان مختصر
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handlePrintFinancialStatements("all")}
              className="font-bold text-xs rounded-xl gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 h-8"
            >
              <Printer size={14} />
              طباعة القوائم الختامية
            </Button>
          </div>
        </div>
      )}

      {/* Report Type Selector Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 print:hidden">
        {[
          {
            id: "account_status" as FinancialReportTabId,
            label: "تفصيل الحالة الحسابية",
            sub: "تشخيص شامل لكل حساب",
            icon: FileText,
          },
          {
            id: "comparison" as FinancialReportTabId,
            label: "مقارنة واختيار حسابات",
            sub: "مقارنات لحسابات بعينها",
            icon: BarChart3,
          },
          {
            id: "general_trial" as FinancialReportTabId,
            label: "ميزان المراجعة العام",
            sub: "بالمجاميع والأرصدة (8 أعمدة)",
            icon: Scale,
          },
          {
            id: "summary_trial" as FinancialReportTabId,
            label: "ميزان المراجعة المختصر",
            sub: "بالأرصدة الصافية والمجموعات",
            icon: Layers,
          },
          {
            id: "statements" as FinancialReportTabId,
            label: "القوائم المالية الختامية",
            sub: "الدخل والمركز المالي والنقدية",
            icon: Landmark,
          },
          {
            id: "analytical" as FinancialReportTabId,
            label: "التقارير التحليلية والعملات",
            sub: "تحليل المصروفات والعملات والذمم",
            icon: TrendingUp,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-start p-3 rounded-2xl border text-right transition-all cursor-pointer ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-md"
                  : "bg-card hover:bg-muted/60 border-border text-foreground"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <Icon size={17} className={isActive ? "text-primary-foreground" : "text-primary"} />
                {tab.id === "comparison" && selectedComparisonCodes.length > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-black rounded-md bg-amber-500 text-white">
                    {selectedComparisonCodes.length}
                  </span>
                )}
              </div>
              <span className="font-black text-xs leading-snug">{tab.label}</span>
              <span
                className={`text-[10px] mt-0.5 line-clamp-1 ${
                  isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                }`}
              >
                {tab.sub}
              </span>
            </button>
          );
        })}
      </div>

      {/* Common Date & Account Filter Bar */}
      <Card className="rounded-2xl border-border/80 print:hidden">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
            <div className="lg:col-span-2 space-y-1">
              <Label className="text-xs font-bold">بحث برقم أو اسم الحساب</Label>
              <div className="relative">
                <Search className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث بكود الحساب (مثل 1101) أو الاسم..."
                  className="pr-9 h-9 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">المستوى الشجري</Label>
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="w-full h-9 rounded-xl border border-input bg-background px-2.5 text-xs font-bold"
              >
                <option value="all">جميع المستويات (1 - 4)</option>
                <option value="1">المستوى الأول (الأبواب)</option>
                <option value="2">المستوى الثاني (المجموعات)</option>
                <option value="3">المستوى الثالث (العامة)</option>
                <option value="4">المستوى الرابع (التشغيلية)</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">نوع الحساب</Label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full h-9 rounded-xl border border-input bg-background px-2.5 text-xs font-bold"
              >
                <option value="all">كل التصنيفات المحاسبية</option>
                <option value="asset">الأصول والممتلكات</option>
                <option value="liability">الالتزامات والخصوم</option>
                <option value="equity">حقوق الملكية</option>
                <option value="revenue">الإيرادات والمبيعات</option>
                <option value="expense">المصروفات والتكاليف</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">من تاريخ</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 text-xs rounded-xl font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">إلى تاريخ</Label>
              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-9 text-xs rounded-xl font-mono"
                />
                {(dateFrom || dateTo || searchQuery || levelFilter !== "all" || typeFilter !== "all") && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDateFrom("");
                      setDateTo("");
                      setSearchQuery("");
                      setLevelFilter("all");
                      setTypeFilter("all");
                      setStatusFilter("all");
                    }}
                    className="h-9 px-2 text-xs text-rose-600 font-bold shrink-0"
                    title="إعادة ضبط الفلاتر"
                  >
                    مسح
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-border/60 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-muted-foreground flex items-center gap-1">
                <SlidersHorizontal size={13} /> فلتر حالة الحساب:
              </span>
              {[
                { id: "all", label: "الكل" },
                { id: "active", label: "حسابات نشطة بحركات" },
                { id: "debit", label: "أرصدة مدينة (Dr)" },
                { id: "credit", label: "أرصدة دائنة (Cr)" },
                { id: "zero", label: "أرصدة صفرية" },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatusFilter(st.id as any)}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border transition ${
                    statusFilter === st.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/40 text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 cursor-pointer font-bold text-xs select-none">
              <input
                type="checkbox"
                checked={hideZeroBalances}
                onChange={(e) => setHideZeroBalances(e.target.checked)}
                className="rounded border-border"
              />
              <span>إخفاء الحسابات الصفرية التي لا توجد عليها حركة</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* =====================================================================
          SECTION 1: DETAILED ACCOUNT STATUS REPORT (تفصيل الحالة الحسابية لكل حساب)
         ===================================================================== */}
      {activeTab === "account_status" && (
        <div className="space-y-4">
          {/* Quick Diagnostic Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="rounded-2xl border-border/80">
              <CardContent className="p-4">
                <span className="text-xs text-muted-foreground font-bold block">
                  إجمالي الحسابات المعروضة
                </span>
                <div className="text-2xl font-black font-mono text-foreground mt-1">
                  {filteredDiagnostics.length}{" "}
                  <span className="text-xs font-bold text-muted-foreground">
                    / {accountDiagnostics.length} حساب
                  </span>
                </div>
                <span className="text-[11px] text-emerald-600 font-bold">
                  {filteredDiagnostics.filter((d) => d.txCount > 0).length} حساب شهد حركات مالية
                </span>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="p-4">
                <span className="text-xs text-emerald-700 dark:text-emerald-300 font-bold block">
                  مجموع الحركات المدينة (Dr)
                </span>
                <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                  ${fmtNum(generalTrialTotals.periodDr)}
                </div>
                <span className="text-[11px] text-muted-foreground">
                  أرصدة ختامية مدينة: ${fmtNum(generalTrialTotals.closeDr)}
                </span>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-rose-500/30 bg-rose-500/5">
              <CardContent className="p-4">
                <span className="text-xs text-rose-700 dark:text-rose-300 font-bold block">
                  مجموع الحركات الدائنة (Cr)
                </span>
                <div className="text-xl font-black font-mono text-rose-600 dark:text-rose-400 mt-1">
                  ${fmtNum(generalTrialTotals.periodCr)}
                </div>
                <span className="text-[11px] text-muted-foreground">
                  أرصدة ختامية دائنة: ${fmtNum(generalTrialTotals.closeCr)}
                </span>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-primary/30 bg-primary/5">
              <CardContent className="p-4">
                <span className="text-xs text-primary font-bold block">
                  حالة الاتزان المحاسبي العام
                </span>
                <div className="text-base font-black text-foreground mt-1 flex items-center gap-1.5">
                  {generalTrialTotals.isBalanced ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <span className="text-emerald-600">متوازن ومطابق 100%</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                      <span className="text-amber-600">
                        فارق: ${fmtNum(generalTrialTotals.diff)}
                      </span>
                    </>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground">
                  اضغط على أي حساب لعرض وطباعة بطاقته التفصيلية
                </span>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-2xl">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b">
              <div>
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  تقرير تفصيل الحالة الحسابية لكل حساب (Detailed Account Status)
                </CardTitle>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="print"
                  onClick={handlePrintAllAccountStatus}
                  className="font-bold text-xs rounded-xl gap-1.5"
                >
                  <Printer size={14} />
                  طباعة تقرير الحالة الحسابية الشامل
                </Button>
                <Button
                  size="sm"
                  variant="excel"
                  onClick={() =>
                    exportRowsToExcel(
                      filteredDiagnostics.map((d) => ({
                        "كود الحساب": d.code,
                        "اسم الحساب": d.name,
                        "المستوى": d.level,
                        "التصنيف": ACCOUNT_TYPE_LABELS[d.type],
                        "طبيعة الحساب": d.natureLabel,
                        "الرصيد الافتتاحي": d.openingBalance,
                        "إجمالي المدين": d.periodDebit,
                        "إجمالي الدائن": d.periodCredit,
                        "صافي الحركة": d.netPeriodMovement,
                        "الرصيد الختامي": d.closingBalanceAbs,
                        "حالة الرصيد":
                          d.closingSide === "Dr" ? "مدين" : d.closingSide === "Cr" ? "دائن" : "متزن",
                        "عدد الحركات": d.txCount,
                        "آخر حركة": d.lastTxDate || "-",
                        "النسبة من المجموعة %": Number(d.shareOfTypePct.toFixed(2)),
                      })),
                      "الحالة الحسابية",
                      "Account_Status_Detailed_Report",
                    )
                  }
                  className="font-bold text-xs rounded-xl gap-1.5"
                >
                  <FileSpreadsheet size={14} />
                  تصدير Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[620px]">
                <table className="w-full text-xs text-right border-collapse">
                  <thead className="bg-muted/70 text-muted-foreground font-bold border-b sticky top-0 z-10">
                    <tr>
                      <th className="p-3">كود الحساب</th>
                      <th className="p-3">اسم الحساب المحاسبي</th>
                      <th className="p-3 text-center">المستوى</th>
                      <th className="p-3">التصنيف والطبيعة</th>
                      <th className="p-3 font-mono">الرصيد الافتتاحي</th>
                      <th className="p-3 font-mono text-emerald-700 dark:text-emerald-400">
                        إجمالي المدين (Dr)
                      </th>
                      <th className="p-3 font-mono text-rose-700 dark:text-rose-400">
                        إجمالي الدائن (Cr)
                      </th>
                      <th className="p-3 font-mono">صافي الحركة</th>
                      <th className="p-3 font-mono text-primary">الرصيد الختامي</th>
                      <th className="p-3 text-center">حالة الحساب</th>
                      <th className="p-3 text-center">الحركات</th>
                      <th className="p-3 text-center">إجراءات التقرير</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredDiagnostics.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="p-8 text-center text-muted-foreground font-bold">
                          لا توجد حسابات مطابقة لمعايير البحث أو الفلترة الحالية
                        </td>
                      </tr>
                    ) : (
                      filteredDiagnostics.map((d) => (
                        <tr key={d.code} className="hover:bg-muted/30 transition">
                          <td className="p-3 font-mono font-bold text-primary">{d.code}</td>
                          <td className="p-3 font-bold text-foreground">
                            <button
                              type="button"
                              onClick={() => setInspectedAccountCode(d.code)}
                              className="app-link text-right font-bold cursor-pointer"
                            >
                              {d.name}
                            </button>
                            {d.lastTxDate && (
                              <span className="block text-[10px] text-muted-foreground font-normal">
                                آخر حركة: {d.lastTxDate} ({d.shareOfTypePct.toFixed(1)}% من مجموعته)
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant="outline" className="font-mono text-[10px]">
                              م{d.level}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-[11px]">
                              {ACCOUNT_TYPE_LABELS[d.type]}
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {d.natureLabel}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-semibold">
                            ${fmtNum(d.openingBalance)}
                          </td>
                          <td className="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {d.periodDebit > 0 ? `$${fmtNum(d.periodDebit)}` : "-"}
                          </td>
                          <td className="p-3 font-mono font-bold text-rose-600 dark:text-rose-400">
                            {d.periodCredit > 0 ? `$${fmtNum(d.periodCredit)}` : "-"}
                          </td>
                          <td className="p-3 font-mono font-semibold">
                            <span
                              className={
                                d.netPeriodMovement > 0
                                  ? "text-emerald-600"
                                  : d.netPeriodMovement < 0
                                    ? "text-rose-600"
                                    : "text-muted-foreground"
                              }
                            >
                              {d.netPeriodMovement > 0 ? "+" : ""}
                              {fmtNum(d.netPeriodMovement)}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-black text-foreground">
                            ${fmtNum(d.closingBalanceAbs)}
                          </td>
                          <td className="p-3 text-center">
                            {d.closingSide === "Dr" ? (
                              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 text-[10px]">
                                مدين (Dr)
                              </Badge>
                            ) : d.closingSide === "Cr" ? (
                              <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 text-[10px]">
                                دائن (Cr)
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">
                                متزن (0)
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 text-center font-mono font-bold">{d.txCount}</td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="edit"
                                onClick={() => setInspectedAccountCode(d.code)}
                                className="h-7 px-2 text-[11px] font-bold rounded-lg gap-1"
                                title="عرض تفصيل الحالة الحسابية والحركات"
                              >
                                <Eye size={12} />
                                تفصيل
                              </Button>
                              <Button
                                size="sm"
                                variant="print"
                                onClick={() => handlePrintSingleAccountStatus(d)}
                                className="h-7 px-2 text-[11px] font-bold rounded-lg"
                                title="طباعة بطاقة الحالة الحسابية وكشف الحساب"
                              >
                                <Printer size={13} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* =====================================================================
          SECTION 2: MULTI-ACCOUNT COMPARISON & CUSTOM SELECTION (مقارنات واختيار حسابات بعينها)
         ===================================================================== */}
      {activeTab === "comparison" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left/Right Column: Account Picker */}
          <Card className="lg:col-span-4 rounded-2xl border-border">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-black flex items-center justify-between">
                <span>1. اختيار حسابات بعينها للمقارنة</span>
                <Badge variant="default" className="font-mono">
                  {selectedComparisonCodes.length} مختار
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-3">
              {/* Quick Preset Selection Buttons */}
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const codes = accountDiagnostics
                      .filter(
                        (d) =>
                          d.code.startsWith("1101") ||
                          d.code.startsWith("1301") ||
                          d.name.includes("خزينة") ||
                          d.name.includes("بنك"),
                      )
                      .map((d) => d.code);
                    setSelectedComparisonCodes(codes);
                  }}
                  className="h-7 text-[11px] font-bold rounded-lg"
                >
                  🏦 الخزائن والبنوك
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const codes = accountDiagnostics
                      .filter((d) => d.type === "revenue" && d.closingBalanceAbs > 0)
                      .map((d) => d.code);
                    setSelectedComparisonCodes(codes);
                  }}
                  className="h-7 text-[11px] font-bold rounded-lg"
                >
                  📈 حسابات الإيرادات
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const codes = accountDiagnostics
                      .filter((d) => d.type === "expense" && d.closingBalanceAbs > 0)
                      .map((d) => d.code);
                    setSelectedComparisonCodes(codes);
                  }}
                  className="h-7 text-[11px] font-bold rounded-lg"
                >
                  💸 حسابات المصروفات
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const codes = [...accountDiagnostics]
                      .sort((a, b) => b.closingBalanceAbs - a.closingBalanceAbs)
                      .slice(0, 6)
                      .map((d) => d.code);
                    setSelectedComparisonCodes(codes);
                  }}
                  className="h-7 text-[11px] font-bold rounded-lg"
                >
                  ⭐ أعلى 6 حسابات رصيداً
                </Button>
                {selectedComparisonCodes.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedComparisonCodes([])}
                    className="h-7 text-[11px] font-bold text-rose-600 rounded-lg"
                  >
                    مسح التحديد
                  </Button>
                )}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute right-3 top-2.5 text-muted-foreground" />
                <Input
                  value={comparisonSearch}
                  onChange={(e) => setComparisonSearch(e.target.value)}
                  placeholder="ابحث لتحديد حساب بعينه..."
                  className="pr-8 h-8 text-xs rounded-xl"
                />
              </div>

              <div className="max-h-[430px] overflow-y-auto divide-y border rounded-xl">
                {accountDiagnostics
                  .filter((d) => {
                    if (!comparisonSearch.trim()) return true;
                    const q = comparisonSearch.trim().toLowerCase();
                    return (
                      d.code.toLowerCase().includes(q) || d.name.toLowerCase().includes(q)
                    );
                  })
                  .map((d) => {
                    const isChecked = selectedComparisonCodes.includes(d.code);
                    return (
                      <button
                        key={d.code}
                        type="button"
                        onClick={() => toggleComparisonAccount(d.code)}
                        className={`w-full flex items-center justify-between p-2.5 text-right text-xs transition cursor-pointer ${
                          isChecked ? "bg-primary/10 font-bold" : "hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isChecked ? (
                            <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <span className="font-mono text-[11px] text-primary font-bold shrink-0">
                            {d.code}
                          </span>
                          <span className="truncate">{d.name}</span>
                        </div>
                        <span className="font-mono text-[11px] font-semibold shrink-0 mr-2">
                          ${fmtNum(d.closingBalanceAbs)}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </CardContent>
          </Card>

          {/* Comparison Results & Visual Analytics */}
          <div className="lg:col-span-8 space-y-4">
            {selectedComparisonDiagnostics.length === 0 ? (
              <Card className="rounded-2xl border-dashed p-10 text-center">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <h3 className="text-base font-black text-foreground">
                  لم يتم اختيار حسابات للمقارنة بعد
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  اختر حسابين أو أكثر من القائمة الجانبية أو اضغط على أحد أزرار التحديد السريع
                  (الخزائن، الإيرادات، المصروفات، أو أعلى الحسابات) لعرض جدول المقارنة والرسوم
                  التحليلية وطباعة التقرير المخصص.
                </p>
              </Card>
            ) : (
              <>
                {/* Top Action & Summary Bar */}
                <Card className="rounded-2xl border-primary/25 bg-primary/5">
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-black text-foreground">
                        نتائج المقارنة المالية لعدد ({selectedComparisonDiagnostics.length}) حسابات
                        مختارة
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        إجمالي الأرصدة الختامية للحسابات المختارة:{" "}
                        <strong className="font-mono text-primary">
                          ${fmtNum(comparisonTotals.totalCloseAbs)} USD
                        </strong>{" "}
                        | مجموع المدين:{" "}
                        <strong className="font-mono text-emerald-600">
                          ${fmtNum(comparisonTotals.totalDr)}
                        </strong>{" "}
                        | مجموع الدائن:{" "}
                        <strong className="font-mono text-rose-600">
                          ${fmtNum(comparisonTotals.totalCr)}
                        </strong>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        onClick={handlePrintComparisonReport}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl gap-1.5"
                      >
                        <Printer size={14} />
                        طباعة تقرير المقارنة
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handlePrintSelectedAccountsMovements}
                        className="font-bold text-xs rounded-xl gap-1.5"
                      >
                        <Printer size={14} />
                        طباعة حركات الحسابات المختارة
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          exportRowsToExcel(
                            selectedComparisonDiagnostics.map((d) => ({
                              "كود الحساب": d.code,
                              "اسم الحساب": d.name,
                              "التصنيف": ACCOUNT_TYPE_LABELS[d.type],
                              "الرصيد الافتتاحي": d.openingBalance,
                              "إجمالي المدين": d.periodDebit,
                              "إجمالي الدائن": d.periodCredit,
                              "صافي الحركة": d.netPeriodMovement,
                              "الرصيد الختامي": d.closingBalanceAbs,
                              "حالة الرصيد": d.closingSide,
                              "عدد الحركات": d.txCount,
                            })),
                            "مقارنة الحسابات",
                            "Selected_Accounts_Comparison",
                          )
                        }
                        className="font-bold text-xs rounded-xl gap-1.5"
                      >
                        <FileSpreadsheet size={14} />
                        Excel
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Visual Bar Comparison */}
                <Card className="rounded-2xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-black">
                      المقارنة البصرية للأرصدة وحجم التدفقات (مدين / دائن / الرصيد الختامي)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedComparisonDiagnostics.map((d) => {
                      const pctOfTotal =
                        comparisonTotals.totalCloseAbs > 0
                          ? (d.closingBalanceAbs / comparisonTotals.totalCloseAbs) * 100
                          : 0;
                      const drWidth =
                        comparisonTotals.maxDrCr > 0
                          ? Math.min(100, (d.periodDebit / comparisonTotals.maxDrCr) * 100)
                          : 0;
                      const crWidth =
                        comparisonTotals.maxDrCr > 0
                          ? Math.min(100, (d.periodCredit / comparisonTotals.maxDrCr) * 100)
                          : 0;

                      return (
                        <div
                          key={d.code}
                          className="p-3 rounded-xl border bg-muted/20 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono font-bold">
                                {d.code}
                              </Badge>
                              <span className="font-black text-foreground">{d.name}</span>
                              <span className="text-[11px] text-muted-foreground">
                                ({ACCOUNT_TYPE_LABELS[d.type]})
                              </span>
                            </div>
                            <div className="flex items-center gap-3 font-mono">
                              <span className="text-emerald-600 font-bold">
                                مدين: ${fmtNum(d.periodDebit)}
                              </span>
                              <span className="text-rose-600 font-bold">
                                دائن: ${fmtNum(d.periodCredit)}
                              </span>
                              <span className="font-black text-primary">
                                الرصيد: ${fmtNum(d.closingBalanceAbs)} ({pctOfTotal.toFixed(1)}%)
                              </span>
                            </div>
                          </div>

                          {/* Bars */}
                          <div className="space-y-1">
                            <div className="w-full h-2 rounded-full bg-muted overflow-hidden flex">
                              <div
                                className="bg-primary h-full transition-all"
                                style={{ width: `${Math.max(pctOfTotal, 2)}%` }}
                                title={`الوزن النسبي للرصيد: ${pctOfTotal.toFixed(1)}%`}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-emerald-700 w-10 shrink-0">
                                  مدين
                                </span>
                                <div className="flex-1 h-1.5 bg-emerald-100 dark:bg-emerald-950 rounded-full overflow-hidden">
                                  <div
                                    className="bg-emerald-500 h-full"
                                    style={{ width: `${drWidth}%` }}
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-rose-700 w-10 shrink-0">دائن</span>
                                <div className="flex-1 h-1.5 bg-rose-100 dark:bg-rose-950 rounded-full overflow-hidden">
                                  <div
                                    className="bg-rose-500 h-full"
                                    style={{ width: `${crWidth}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                {/* Side-by-Side Comparison Table */}
                <Card className="rounded-2xl">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
                    <CardTitle className="text-sm font-black">
                      جدول المقارنة التفصيلي للحسابات المختارة
                    </CardTitle>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowCombinedComparisonLedger((v) => !v)}
                      className="text-xs font-bold text-primary"
                    >
                      {showCombinedComparisonLedger
                        ? "إخفاء سجل الحركات المجمّع"
                        : "عرض سجل الحركات المجمّع للحسابات المختارة"}
                    </Button>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-right">
                        <thead className="bg-muted/60 text-muted-foreground font-bold border-b">
                          <tr>
                            <th className="p-3">الكود</th>
                            <th className="p-3">اسم الحساب</th>
                            <th className="p-3">التصنيف</th>
                            <th className="p-3">الافتتاحي</th>
                            <th className="p-3 text-emerald-600">المدين (Dr)</th>
                            <th className="p-3 text-rose-600">الدائن (Cr)</th>
                            <th className="p-3">صافي الحركة</th>
                            <th className="p-3 text-primary">الرصيد الختامي</th>
                            <th className="p-3 text-center">الحركات</th>
                            <th className="p-3 text-center">النسبة %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {selectedComparisonDiagnostics.map((d) => {
                            const pct =
                              comparisonTotals.totalCloseAbs > 0
                                ? (d.closingBalanceAbs / comparisonTotals.totalCloseAbs) * 100
                                : 0;
                            return (
                              <tr key={d.code} className="hover:bg-muted/20">
                                <td className="p-3 font-mono font-bold text-primary">{d.code}</td>
                                <td className="p-3 font-bold">{d.name}</td>
                                <td className="p-3 text-[11px] text-muted-foreground">
                                  {ACCOUNT_TYPE_LABELS[d.type]}
                                </td>
                                <td className="p-3 font-mono">${fmtNum(d.openingBalance)}</td>
                                <td className="p-3 font-mono font-bold text-emerald-600">
                                  ${fmtNum(d.periodDebit)}
                                </td>
                                <td className="p-3 font-mono font-bold text-rose-600">
                                  ${fmtNum(d.periodCredit)}
                                </td>
                                <td className="p-3 font-mono font-semibold">
                                  ${fmtNum(d.netPeriodMovement)}
                                </td>
                                <td className="p-3 font-mono font-black text-foreground">
                                  ${fmtNum(d.closingBalanceAbs)}{" "}
                                  <span className="text-[10px] text-muted-foreground">
                                    ({d.closingSide === "Dr" ? "مدين" : d.closingSide === "Cr" ? "دائن" : "0"})
                                  </span>
                                </td>
                                <td className="p-3 text-center font-mono">{d.txCount}</td>
                                <td className="p-3 text-center font-mono font-bold text-primary">
                                  {pct.toFixed(1)}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-muted/50 font-black border-t">
                          <tr>
                            <td colSpan={3} className="p-3">
                              إجمالي الحسابات المختارة ({selectedComparisonDiagnostics.length})
                            </td>
                            <td className="p-3 font-mono">${fmtNum(comparisonTotals.totalOpen)}</td>
                            <td className="p-3 font-mono text-emerald-600">
                              ${fmtNum(comparisonTotals.totalDr)}
                            </td>
                            <td className="p-3 font-mono text-rose-600">
                              ${fmtNum(comparisonTotals.totalCr)}
                            </td>
                            <td className="p-3 font-mono">
                              ${fmtNum(comparisonTotals.totalDr - comparisonTotals.totalCr)}
                            </td>
                            <td className="p-3 font-mono text-primary">
                              ${fmtNum(comparisonTotals.totalCloseAbs)}
                            </td>
                            <td className="p-3 text-center font-mono">
                              {selectedComparisonDiagnostics.reduce((s, d) => s + d.txCount, 0)}
                            </td>
                            <td className="p-3 text-center font-mono">100%</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Optional Combined Movements Table for Selected Accounts */}
                {showCombinedComparisonLedger && (
                  <Card className="rounded-2xl border-primary/30">
                    <CardHeader className="pb-2 border-b flex flex-row items-center justify-between">
                      <CardTitle className="text-sm font-black">
                        كشف الحركات التفصيلي المجمّع للحسابات المختارة فقط
                      </CardTitle>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handlePrintSelectedAccountsMovements}
                        className="h-8 text-xs font-bold gap-1.5 rounded-xl"
                      >
                        <Printer size={13} />
                        طباعة هذا الكشف
                      </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto max-h-96">
                        <table className="w-full text-xs text-right">
                          <thead className="bg-muted/60 font-bold border-b sticky top-0">
                            <tr>
                              <th className="p-2.5">التاريخ</th>
                              <th className="p-2.5">المرجع</th>
                              <th className="p-2.5">الحساب</th>
                              <th className="p-2.5">البيان</th>
                              <th className="p-2.5 text-emerald-600">مدين (USD)</th>
                              <th className="p-2.5 text-rose-600">دائن (USD)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {selectedComparisonDiagnostics
                              .flatMap((d) =>
                                d.movements.map((m) => ({
                                  ...m,
                                  accCode: d.code,
                                  accName: d.name,
                                })),
                              )
                              .sort((a, b) => a.date.localeCompare(b.date))
                              .map((m) => (
                                <tr key={m.id} className="hover:bg-muted/20">
                                  <td className="p-2.5 font-mono">{m.date}</td>
                                  <td className="p-2.5 font-mono font-bold">{m.reference}</td>
                                  <td className="p-2.5 font-bold">
                                    {m.accName}{" "}
                                    <span className="font-mono text-muted-foreground">
                                      ({m.accCode})
                                    </span>
                                  </td>
                                  <td className="p-2.5">{m.description}</td>
                                  <td className="p-2.5 font-mono font-bold text-emerald-600">
                                    {m.debit > 0 ? `$${fmtNum(m.debit)}` : "-"}
                                  </td>
                                  <td className="p-2.5 font-mono font-bold text-rose-600">
                                    {m.credit > 0 ? `$${fmtNum(m.credit)}` : "-"}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          SECTION 3: GENERAL TRIAL BALANCE (ميزان المراجعة العام بالمجاميع والأرصدة)
         ===================================================================== */}
      {activeTab === "general_trial" && (
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b">
            <div>
              <CardTitle className="text-base font-black flex items-center gap-2">
                <Scale className="h-5 w-5 text-primary" />
                ميزان المراجعة العام الشامل — بالمجاميع والأرصدة (General Trial Balance)
              </CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="print"
                onClick={handlePrintGeneralTrialBalance}
                className="font-bold text-xs rounded-xl gap-1.5"
              >
                <Printer size={14} />
                طباعة ميزان المراجعة العام
              </Button>
              <Button
                size="sm"
                variant="excel"
                onClick={() =>
                  exportRowsToExcel(
                    filteredDiagnostics.map((d) => ({
                      "كود الحساب": d.code,
                      "اسم الحساب": d.name,
                      "المستوى": d.level,
                      "النوع": ACCOUNT_TYPE_LABELS[d.type],
                      "افتتاحي مدين": d.openingDebit,
                      "افتتاحي دائن": d.openingCredit,
                      "حركة الفترة مدين": d.periodDebit,
                      "حركة الفترة دائن": d.periodCredit,
                      "إجمالي المجاميع مدين": d.cumulativeDebit,
                      "إجمالي المجاميع دائن": d.cumulativeCredit,
                      "الرصيد الختامي مدين": d.closingDebit,
                      "الرصيد الختامي دائن": d.closingCredit,
                    })),
                    "ميزان المراجعة العام",
                    "General_Trial_Balance",
                  )
                }
                className="font-bold text-xs rounded-xl gap-1.5"
              >
                <FileSpreadsheet size={14} />
                تصدير Excel
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[620px]">
              <table className="w-full text-xs text-right border-collapse">
                <thead className="bg-muted/80 text-foreground font-black border-b sticky top-0 z-10">
                  <tr>
                    <th rowSpan={2} className="p-3 border-l">
                      كود الحساب
                    </th>
                    <th rowSpan={2} className="p-3 border-l">
                      اسم الحساب
                    </th>
                    <th rowSpan={2} className="p-3 border-l text-center">
                      المستوى
                    </th>
                    <th colSpan={2} className="p-2 text-center border-b border-l bg-slate-500/10">
                      الرصيد الافتتاحي
                    </th>
                    <th colSpan={2} className="p-2 text-center border-b border-l bg-blue-500/10">
                      حركة الفترة المالية
                    </th>
                    <th colSpan={2} className="p-2 text-center border-b border-l bg-indigo-500/10">
                      ميزان المجاميع التراكمية
                    </th>
                    <th colSpan={2} className="p-2 text-center border-b bg-emerald-500/10">
                      ميزان الأرصدة الختامية
                    </th>
                  </tr>
                  <tr className="text-[11px]">
                    <th className="p-2 text-center bg-slate-500/5 text-emerald-700 dark:text-emerald-400">
                      مدين
                    </th>
                    <th className="p-2 text-center border-l bg-slate-500/5 text-rose-700 dark:text-rose-400">
                      دائن
                    </th>
                    <th className="p-2 text-center bg-blue-500/5 text-emerald-700 dark:text-emerald-400">
                      مدين
                    </th>
                    <th className="p-2 text-center border-l bg-blue-500/5 text-rose-700 dark:text-rose-400">
                      دائن
                    </th>
                    <th className="p-2 text-center bg-indigo-500/5 text-emerald-700 dark:text-emerald-400">
                      مجموع مدين
                    </th>
                    <th className="p-2 text-center border-l bg-indigo-500/5 text-rose-700 dark:text-rose-400">
                      مجموع دائن
                    </th>
                    <th className="p-2 text-center bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                      رصيد مدين
                    </th>
                    <th className="p-2 text-center bg-emerald-500/10 text-rose-700 dark:text-rose-400">
                      رصيد دائن
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredDiagnostics.map((d) => (
                    <tr key={d.code} className="hover:bg-muted/30 transition font-mono">
                      <td className="p-2.5 font-bold text-primary border-l">{d.code}</td>
                      <td className="p-2.5 font-sans font-bold text-foreground border-l">
                        {d.name}
                      </td>
                      <td className="p-2.5 text-center border-l">م{d.level}</td>
                      <td className="p-2.5 text-center text-emerald-700 dark:text-emerald-400">
                        {d.openingDebit > 0 ? fmtNum(d.openingDebit) : "-"}
                      </td>
                      <td className="p-2.5 text-center border-l text-rose-700 dark:text-rose-400">
                        {d.openingCredit > 0 ? fmtNum(d.openingCredit) : "-"}
                      </td>
                      <td className="p-2.5 text-center text-emerald-700 dark:text-emerald-400">
                        {d.periodDebit > 0 ? fmtNum(d.periodDebit) : "-"}
                      </td>
                      <td className="p-2.5 text-center border-l text-rose-700 dark:text-rose-400">
                        {d.periodCredit > 0 ? fmtNum(d.periodCredit) : "-"}
                      </td>
                      <td className="p-2.5 text-center font-semibold">
                        {d.cumulativeDebit > 0 ? fmtNum(d.cumulativeDebit) : "-"}
                      </td>
                      <td className="p-2.5 text-center border-l font-semibold">
                        {d.cumulativeCredit > 0 ? fmtNum(d.cumulativeCredit) : "-"}
                      </td>
                      <td className="p-2.5 text-center font-black bg-emerald-500/5 text-emerald-700 dark:text-emerald-400">
                        {d.closingDebit > 0 ? fmtNum(d.closingDebit) : "-"}
                      </td>
                      <td className="p-2.5 text-center font-black bg-rose-500/5 text-rose-700 dark:text-rose-400">
                        {d.closingCredit > 0 ? fmtNum(d.closingCredit) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted font-black border-t-2 border-primary/40 font-mono text-xs">
                  <tr>
                    <td colSpan={3} className="p-3 font-sans text-right border-l">
                      الإجمالي العام لميزان المراجعة ({filteredDiagnostics.length} حساب)
                    </td>
                    <td className="p-3 text-center text-emerald-700 dark:text-emerald-400">
                      ${fmtNum(generalTrialTotals.openDr)}
                    </td>
                    <td className="p-3 text-center border-l text-rose-700 dark:text-rose-400">
                      ${fmtNum(generalTrialTotals.openCr)}
                    </td>
                    <td className="p-3 text-center text-emerald-700 dark:text-emerald-400">
                      ${fmtNum(generalTrialTotals.periodDr)}
                    </td>
                    <td className="p-3 text-center border-l text-rose-700 dark:text-rose-400">
                      ${fmtNum(generalTrialTotals.periodCr)}
                    </td>
                    <td className="p-3 text-center">${fmtNum(generalTrialTotals.cumDr)}</td>
                    <td className="p-3 text-center border-l">
                      ${fmtNum(generalTrialTotals.cumCr)}
                    </td>
                    <td className="p-3 text-center text-emerald-700 dark:text-emerald-400 bg-emerald-500/15">
                      ${fmtNum(generalTrialTotals.closeDr)}
                    </td>
                    <td className="p-3 text-center text-rose-700 dark:text-rose-400 bg-rose-500/15">
                      ${fmtNum(generalTrialTotals.closeCr)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* =====================================================================
          SECTION 4: SUMMARY TRIAL BALANCE (ميزان المراجعة المختصر)
         ===================================================================== */}
      {activeTab === "summary_trial" && (
        <Card className="rounded-2xl">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b">
            <div>
              <CardTitle className="text-base font-black flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                ميزان المراجعة المختصر بالأرصدة الصافية (Summary Trial Balance)
              </CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-xl border p-1 bg-muted/40">
                {[
                  { id: "groups", label: "حسب المجموعات الرئيسية" },
                  { id: "by_type", label: "حسب الأبواب الخمسة" },
                  { id: "active_only", label: "الحسابات النشطة فقط" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSummaryMode(m.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                      summaryMode === m.id
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <Button
                size="sm"
                variant="print"
                onClick={handlePrintSummaryTrialBalance}
                className="font-bold text-xs rounded-xl gap-1.5"
              >
                <Printer size={14} />
                طباعة الميزان المختصر
              </Button>
              <Button
                size="sm"
                variant="excel"
                onClick={() =>
                  exportRowsToExcel(
                    summaryTrialRows.rows.map((r) => ({
                      "الكود": r.code,
                      "اسم المجموعة / الحساب": r.name,
                      "التصنيف": r.typeLabel,
                      "النطاق": r.subLabel,
                      "صافي رصيد مدين": r.debit,
                      "صافي رصيد دائن": r.credit,
                    })),
                    "ميزان مراجعة مختصر",
                    "Summary_Trial_Balance",
                  )
                }
                className="font-bold text-xs rounded-xl gap-1.5"
              >
                <FileSpreadsheet size={14} />
                تصدير Excel
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-muted/60 text-muted-foreground text-xs font-bold border-b">
                  <tr>
                    <th className="p-3.5">كود المجموعة / الحساب</th>
                    <th className="p-3.5">اسم المجموعة / الحساب</th>
                    <th className="p-3.5">الباب المحاسبي</th>
                    <th className="p-3.5 text-center">النطاق / النشاط</th>
                    <th className="p-3.5 text-emerald-700 dark:text-emerald-400">
                      صافي رصيد مدين (USD)
                    </th>
                    <th className="p-3.5 text-rose-700 dark:text-rose-400">
                      صافي رصيد دائن (USD)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {summaryTrialRows.rows.map((row) => (
                    <tr key={row.code} className="hover:bg-muted/20 transition">
                      <td className="p-3.5 font-mono font-bold text-primary">{row.code}</td>
                      <td className="p-3.5 font-bold text-foreground">{row.name}</td>
                      <td className="p-3.5 text-xs text-muted-foreground">{row.typeLabel}</td>
                      <td className="p-3.5 text-center">
                        <Badge variant="outline" className="text-xs font-mono">
                          {row.subLabel}
                        </Badge>
                      </td>
                      <td className="p-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {row.debit > 0 ? `$${fmtNum(row.debit)}` : "-"}
                      </td>
                      <td className="p-3.5 font-mono font-bold text-rose-600 dark:text-rose-400">
                        {row.credit > 0 ? `$${fmtNum(row.credit)}` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/70 font-black border-t-2">
                  <tr>
                    <td colSpan={4} className="p-4">
                      إجمالي ميزان المراجعة المختصر ({summaryTrialRows.rows.length} بند)
                    </td>
                    <td className="p-4 font-mono text-emerald-600 dark:text-emerald-400 text-base">
                      ${fmtNum(summaryTrialRows.totalDr)}
                    </td>
                    <td className="p-4 font-mono text-rose-600 dark:text-rose-400 text-base">
                      ${fmtNum(summaryTrialRows.totalCr)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* =====================================================================
          SECTION 5: COMPLETE FINANCIAL STATEMENTS (القوائم المالية الختامية الشاملة)
         ===================================================================== */}
      {activeTab === "statements" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-4 rounded-2xl border">
            <div>
              <h3 className="text-base font-black text-foreground">
                القوائم المالية الختامية الموحدة (قائمة الدخل • المركز المالي • التدفقات النقدية)
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="print"
                onClick={() => handlePrintFinancialStatements("all")}
                className="font-bold text-xs rounded-xl gap-1.5"
              >
                <Printer size={14} />
                طباعة كافة القوائم المالية معاً
              </Button>
              <Button
                size="sm"
                variant="print"
                onClick={() => handlePrintFinancialStatements("income")}
                className="font-bold text-xs rounded-xl gap-1.5"
              >
                <Printer size={14} />
                طباعة قائمة الدخل
              </Button>
              <Button
                size="sm"
                variant="print"
                onClick={() => handlePrintFinancialStatements("balance_sheet")}
                className="font-bold text-xs rounded-xl gap-1.5"
              >
                <Printer size={14} />
                طباعة الميزانية العمومية
              </Button>
              <Button
                size="sm"
                variant="print"
                onClick={() => handlePrintFinancialStatements("cash_flow")}
                className="font-bold text-xs rounded-xl gap-1.5"
              >
                <Printer size={14} />
                طباعة التدفقات النقدية
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Income Statement Card */}
            <Card className="rounded-2xl">
              <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-black flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                    قائمة الدخل الشاملة (Income Statement)
                  </CardTitle>
                </div>
                <Button
                  size="sm"
                  variant="print"
                  onClick={() => handlePrintFinancialStatements("income")}
                  className="h-8 gap-1 text-xs font-bold"
                >
                  <Printer size={14} /> طباعة
                </Button>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-black text-emerald-700 dark:text-emerald-400">
                    <span>1. الإيرادات التشغيلية والمبيعات</span>
                    <span className="font-mono">${fmtNum(statementsData.totalRevenue)}</span>
                  </div>
                  <div className="rounded-xl border divide-y max-h-52 overflow-y-auto text-xs">
                    {statementsData.revenues.map((r) => (
                      <div key={r.code} className="p-2.5 flex items-center justify-between">
                        <span>
                          <strong className="font-mono text-primary ml-1.5">{r.code}</strong>
                          {r.name}
                        </span>
                        <span className="font-mono font-bold text-emerald-600">
                          ${fmtNum(r.closingBalanceAbs)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-black text-rose-700 dark:text-rose-400">
                    <span>2. المصروفات والتكاليف التشغيلية</span>
                    <span className="font-mono">${fmtNum(statementsData.totalExpense)}</span>
                  </div>
                  <div className="rounded-xl border divide-y max-h-52 overflow-y-auto text-xs">
                    {statementsData.expenses.map((e) => (
                      <div key={e.code} className="p-2.5 flex items-center justify-between">
                        <span>
                          <strong className="font-mono text-primary ml-1.5">{e.code}</strong>
                          {e.name}
                        </span>
                        <span className="font-mono font-bold text-rose-600">
                          ${fmtNum(e.closingBalanceAbs)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between">
                  <div>
                    <span className="font-black text-sm block">
                      صافي الربح / (الخسارة) النهائي
                    </span>
                    <span className="text-[11px] text-slate-300">
                      هامش صافي الربح:{" "}
                      {statementsData.totalRevenue > 0
                        ? ((statementsData.netIncome / statementsData.totalRevenue) * 100).toFixed(
                            1,
                          )
                        : "0.0"}
                      %
                    </span>
                  </div>
                  <span
                    className={`font-mono text-xl font-black ${
                      statementsData.netIncome >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    ${fmtNum(statementsData.netIncome)} USD
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Balance Sheet Card */}
            <Card className="rounded-2xl">
              <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-black flex items-center gap-2">
                    <Landmark className="h-5 w-5 text-blue-600" />
                    قائمة المركز المالي / الميزانية العمومية
                  </CardTitle>
                </div>
                <Button
                  size="sm"
                  variant="print"
                  onClick={() => handlePrintFinancialStatements("balance_sheet")}
                  className="h-8 gap-1 text-xs font-bold"
                >
                  <Printer size={14} /> طباعة
                </Button>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-black text-blue-700 dark:text-blue-400">
                    <span>1. إجمالي الأصول والموجودات (Assets)</span>
                    <span className="font-mono">${fmtNum(statementsData.totalAssets)}</span>
                  </div>
                  <div className="rounded-xl border divide-y max-h-44 overflow-y-auto text-xs">
                    {statementsData.assets.map((a) => (
                      <div key={a.code} className="p-2.5 flex items-center justify-between">
                        <span>
                          <strong className="font-mono text-primary ml-1.5">{a.code}</strong>
                          {a.name}
                        </span>
                        <span className="font-mono font-bold">${fmtNum(a.closingBalanceAbs)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-rose-700 dark:text-rose-400">
                      <span>2. الالتزامات (الخصوم)</span>
                      <span className="font-mono">${fmtNum(statementsData.totalLiabilities)}</span>
                    </div>
                    <div className="rounded-xl border divide-y max-h-36 overflow-y-auto text-xs">
                      {statementsData.liabilities.map((l) => (
                        <div key={l.code} className="p-2 flex items-center justify-between">
                          <span className="truncate">{l.name}</span>
                          <span className="font-mono font-semibold">
                            ${fmtNum(l.closingBalanceAbs)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-indigo-700 dark:text-indigo-400">
                      <span>3. حقوق الملكية + الأرباح</span>
                      <span className="font-mono">
                        ${fmtNum(statementsData.totalEquityWithIncome)}
                      </span>
                    </div>
                    <div className="rounded-xl border divide-y max-h-36 overflow-y-auto text-xs">
                      {statementsData.equity.map((eq) => (
                        <div key={eq.code} className="p-2 flex items-center justify-between">
                          <span className="truncate">{eq.name}</span>
                          <span className="font-mono font-semibold">
                            ${fmtNum(eq.closingBalanceAbs)}
                          </span>
                        </div>
                      ))}
                      <div className="p-2 flex items-center justify-between bg-emerald-500/5 text-emerald-700 dark:text-emerald-300 font-bold">
                        <span>صافي أرباح الفترة</span>
                        <span className="font-mono">${fmtNum(statementsData.netIncome)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between text-xs font-bold">
                  <span>إجمالي الالتزامات وحقوق الملكية:</span>
                  <span className="font-mono text-base font-black text-blue-700 dark:text-blue-300">
                    ${fmtNum(statementsData.totalLiabilities + statementsData.totalEquityWithIncome)}{" "}
                    USD
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cash Flow Statement Card */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-amber-600" />
                  قائمة التدفقات النقدية وحركة الخزائن والبنوك (Cash Flow & Treasury)
                </CardTitle>
              </div>
              <Button
                size="sm"
                variant="print"
                onClick={() => handlePrintFinancialStatements("cash_flow")}
                className="h-8 gap-1.5 text-xs font-bold rounded-xl"
              >
                <Printer size={14} /> طباعة التدفقات النقدية
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead className="bg-muted/60 font-bold border-b">
                    <tr>
                      <th className="p-3">كود الحساب</th>
                      <th className="p-3">اسم الخزينة / البنك</th>
                      <th className="p-3">الرصيد الافتتاحي</th>
                      <th className="p-3 text-emerald-600">التدفقات الداخلة (مقبوضات)</th>
                      <th className="p-3 text-rose-600">التدفقات الخارجة (مدفوعات)</th>
                      <th className="p-3">صافي التدفق النقدي</th>
                      <th className="p-3 text-primary">الرصيد النقدي الختامي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-mono">
                    {statementsData.cashAccounts.map((c) => (
                      <tr key={c.code} className="hover:bg-muted/20">
                        <td className="p-3 font-bold text-primary">{c.code}</td>
                        <td className="p-3 font-sans font-bold">{c.name}</td>
                        <td className="p-3">${fmtNum(c.openingBalance)}</td>
                        <td className="p-3 font-bold text-emerald-600">
                          +${fmtNum(c.periodDebit)}
                        </td>
                        <td className="p-3 font-bold text-rose-600">-${fmtNum(c.periodCredit)}</td>
                        <td className="p-3 font-semibold">${fmtNum(c.netPeriodMovement)}</td>
                        <td className="p-3 font-black text-foreground">${fmtNum(c.closingSigned)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/60 font-black border-t font-mono">
                    <tr>
                      <td colSpan={3} className="p-3 font-sans">
                        الإجمالي النقدي الموحد للخزائن والبنوك
                      </td>
                      <td className="p-3 text-emerald-600">
                        +${fmtNum(statementsData.totalCashIn)}
                      </td>
                      <td className="p-3 text-rose-600">-${fmtNum(statementsData.totalCashOut)}</td>
                      <td className="p-3">${fmtNum(statementsData.netCashFlow)}</td>
                      <td className="p-3 text-primary">${fmtNum(statementsData.endingCashBalance)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* =====================================================================
          SECTION 6: ANALYTICAL & MULTI-CURRENCY REPORTS (التقارير التحليلية والعملات)
         ===================================================================== */}
      {activeTab === "analytical" && (
        <div className="space-y-6">
          {/* Multi-Currency Summary */}
          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
              <div>
                <CardTitle className="text-base font-black">
                  تقرير حركة العملات والمعادل بالدولار (Multi-Currency Financial Summary)
                </CardTitle>
              </div>
              <Button
                size="sm"
                variant="print"
                onClick={() =>
                  printAccountingDocument({
                    title: "تقرير حركة العملات والمعادل بالدولار الأمريكي",
                    subtitle: "ملخص الحركات المالية حسب عملة القيد",
                    columns: [
                      { key: "currency", label: "العملة" },
                      { key: "txCount", label: "عدد الحركات" },
                      { key: "origDebit", label: "إجمالي المدين (بالعملة)" },
                      { key: "origCredit", label: "إجمالي الدائن (بالعملة)" },
                      { key: "usdDebit", label: "المعادل مدين (USD)" },
                      { key: "usdCredit", label: "المعادل دائن (USD)" },
                    ],
                    rows: currencyBreakdown.map((c) => ({
                      currency: c.currency,
                      txCount: c.txCount,
                      origDebit: fmtNum(c.origDebit),
                      origCredit: fmtNum(c.origCredit),
                      usdDebit: `$${fmtNum(c.usdDebit)}`,
                      usdCredit: `$${fmtNum(c.usdCredit)}`,
                    })),
                  })
                }
                className="font-bold text-xs rounded-xl gap-1.5"
              >
                <Printer size={14} /> طباعة تقرير العملات
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead className="bg-muted/60 font-bold border-b">
                    <tr>
                      <th className="p-3">رمز العملة</th>
                      <th className="p-3 text-center">عدد الحركات</th>
                      <th className="p-3">إجمالي المدين (بالعملة الأصلية)</th>
                      <th className="p-3">إجمالي الدائن (بالعملة الأصلية)</th>
                      <th className="p-3 text-emerald-600">المعادل مدين (USD)</th>
                      <th className="p-3 text-rose-600">المعادل دائن (USD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-mono">
                    {currencyBreakdown.map((c) => (
                      <tr key={c.currency} className="hover:bg-muted/20">
                        <td className="p-3 font-bold text-primary">{c.currency}</td>
                        <td className="p-3 text-center font-bold">{c.txCount}</td>
                        <td className="p-3">
                          {fmtNum(c.origDebit)} {c.currency}
                        </td>
                        <td className="p-3">
                          {fmtNum(c.origCredit)} {c.currency}
                        </td>
                        <td className="p-3 font-bold text-emerald-600">${fmtNum(c.usdDebit)}</td>
                        <td className="p-3 font-bold text-rose-600">${fmtNum(c.usdCredit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Suppliers & Payables / Receivables Diagnostic */}
          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
              <div>
                <CardTitle className="text-base font-black">
                  تقرير مواقف حسابات الموردين والذمم والالتزامات
                </CardTitle>
              </div>
              <Button
                size="sm"
                variant="print"
                onClick={() => {
                  const list = accountDiagnostics.filter(
                    (d) =>
                      d.type === "liability" ||
                      d.code.startsWith("2401") ||
                      d.name.includes("مورد") ||
                      d.name.includes("ذمم"),
                  );
                  printAccountingDocument({
                    title: "تقرير أرصدة ومواقف الموردين والذمم",
                    subtitle: `عدد الحسابات: ${list.length}`,
                    columns: [
                      { key: "code", label: "كود الحساب" },
                      { key: "name", label: "اسم المورد / الحساب" },
                      { key: "debit", label: "إجمالي المسدد (مدين)" },
                      { key: "credit", label: "إجمالي المستحق (دائن)" },
                      { key: "closing", label: "الرصيد القائم" },
                      { key: "side", label: "الحالة" },
                    ],
                    rows: list.map((d) => ({
                      code: d.code,
                      name: d.name,
                      debit: `$${fmtNum(d.periodDebit)}`,
                      credit: `$${fmtNum(d.periodCredit)}`,
                      closing: `$${fmtNum(d.closingBalanceAbs)}`,
                      side: d.closingSide === "Cr" ? "له (دائن)" : d.closingSide === "Dr" ? "عليه (مدين)" : "خالص",
                    })),
                  });
                }}
                className="font-bold text-xs rounded-xl gap-1.5"
              >
                <Printer size={14} /> طباعة كشف الموردين والذمم
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-xs text-right">
                  <thead className="bg-muted/60 font-bold border-b">
                    <tr>
                      <th className="p-3">كود الحساب</th>
                      <th className="p-3">اسم المورد / الذمة</th>
                      <th className="p-3 text-emerald-600">إجمالي المدين (مسدد)</th>
                      <th className="p-3 text-rose-600">إجمالي الدائن (مستحق)</th>
                      <th className="p-3 text-primary">الرصيد الحالي</th>
                      <th className="p-3 text-center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {accountDiagnostics
                      .filter(
                        (d) =>
                          d.type === "liability" ||
                          d.code.startsWith("2401") ||
                          d.name.includes("مورد") ||
                          d.name.includes("ذمم"),
                      )
                      .map((d) => (
                        <tr key={d.code} className="hover:bg-muted/20">
                          <td className="p-3 font-mono font-bold text-primary">{d.code}</td>
                          <td className="p-3 font-bold">
                            <button
                              type="button"
                              onClick={() => setInspectedAccountCode(d.code)}
                              className="app-link font-bold text-right cursor-pointer"
                            >
                              {d.name}
                            </button>
                          </td>
                          <td className="p-3 font-mono text-emerald-600">
                            ${fmtNum(d.periodDebit)}
                          </td>
                          <td className="p-3 font-mono text-rose-600">${fmtNum(d.periodCredit)}</td>
                          <td className="p-3 font-mono font-black">
                            ${fmtNum(d.closingBalanceAbs)}
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant="outline" className="text-[10px]">
                              {d.closingSide === "Cr"
                                ? "مستحق له (دائن)"
                                : d.closingSide === "Dr"
                                  ? "مدين"
                                  : "متزن"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* =====================================================================
          MODAL: SINGLE ACCOUNT STATUS CARD & DETAILED STATEMENT
         ===================================================================== */}
      <Dialog
        open={Boolean(inspectedDiagnostic)}
        onOpenChange={(open) => !open && setInspectedAccountCode(null)}
      >
        <DialogContent className="sm:max-w-4xl text-right" dir="rtl">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-base sm:text-lg font-black flex items-center justify-between gap-2 flex-wrap">
              <span>
                بطاقة تفصيل الحالة الحسابية — {inspectedDiagnostic?.name} (
                <span className="font-mono text-primary">{inspectedDiagnostic?.code}</span>)
              </span>
              <Badge variant="outline" className="font-mono text-xs">
                {inspectedDiagnostic ? ACCOUNT_TYPE_LABELS[inspectedDiagnostic.type] : ""} | م
                {inspectedDiagnostic?.level}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {inspectedDiagnostic && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                <div className="p-3 rounded-xl border bg-muted/30">
                  <span className="text-muted-foreground block">الرصيد الافتتاحي</span>
                  <strong className="font-mono text-sm mt-0.5 block">
                    ${fmtNum(inspectedDiagnostic.openingBalance)}
                  </strong>
                </div>
                <div className="p-3 rounded-xl border bg-emerald-500/5 border-emerald-500/30">
                  <span className="text-emerald-700 dark:text-emerald-300 block">
                    إجمالي المدين (Dr)
                  </span>
                  <strong className="font-mono text-sm text-emerald-600 mt-0.5 block">
                    ${fmtNum(inspectedDiagnostic.periodDebit)}
                  </strong>
                </div>
                <div className="p-3 rounded-xl border bg-rose-500/5 border-rose-500/30">
                  <span className="text-rose-700 dark:text-rose-300 block">إجمالي الدائن (Cr)</span>
                  <strong className="font-mono text-sm text-rose-600 mt-0.5 block">
                    ${fmtNum(inspectedDiagnostic.periodCredit)}
                  </strong>
                </div>
                <div className="p-3 rounded-xl border bg-muted/30">
                  <span className="text-muted-foreground block">صافي حركة الفترة</span>
                  <strong className="font-mono text-sm mt-0.5 block">
                    ${fmtNum(inspectedDiagnostic.netPeriodMovement)}
                  </strong>
                </div>
                <div className="p-3 rounded-xl border bg-primary/10 border-primary/30">
                  <span className="text-primary font-bold block">الرصيد الختامي</span>
                  <strong className="font-mono text-sm text-primary mt-0.5 block">
                    ${fmtNum(inspectedDiagnostic.closingBalanceAbs)} (
                    {inspectedDiagnostic.closingSide === "Dr"
                      ? "مدين"
                      : inspectedDiagnostic.closingSide === "Cr"
                        ? "دائن"
                        : "0"}
                    )
                  </strong>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-muted/40 p-2.5 rounded-xl border">
                <span>
                  طبيعة الحساب: <strong>{inspectedDiagnostic.natureLabel}</strong>
                </span>
                <span>
                  عدد الحركات: <strong>{inspectedDiagnostic.txCount} حركة</strong>
                </span>
                <span>
                  أول حركة: <strong>{inspectedDiagnostic.firstTxDate || "—"}</strong>
                </span>
                <span>
                  آخر حركة: <strong>{inspectedDiagnostic.lastTxDate || "—"}</strong>
                </span>
                <span>
                  الوزن النسبي بالمجموعة:{" "}
                  <strong>{inspectedDiagnostic.shareOfTypePct.toFixed(1)}%</strong>
                </span>
              </div>

              <div className="border rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-xs text-right">
                  <thead className="bg-muted font-bold border-b sticky top-0">
                    <tr>
                      <th className="p-2.5">التاريخ</th>
                      <th className="p-2.5">المرجع</th>
                      <th className="p-2.5">البيان المحاسبي</th>
                      <th className="p-2.5 text-emerald-600">مدين (USD)</th>
                      <th className="p-2.5 text-rose-600">دائن (USD)</th>
                      <th className="p-2.5">الرصيد التراكمي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-mono">
                    {inspectedDiagnostic.movements.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="p-6 text-center font-sans text-muted-foreground font-bold"
                        >
                          لا توجد حركات مسجلة على هذا الحساب خلال الفترة المحددة
                        </td>
                      </tr>
                    ) : (
                      inspectedDiagnostic.movements.map((m) => (
                        <tr key={m.id} className="hover:bg-muted/20">
                          <td className="p-2.5">{m.date}</td>
                          <td className="p-2.5 font-bold text-primary">{m.reference}</td>
                          <td className="p-2.5 font-sans font-medium">{m.description}</td>
                          <td className="p-2.5 text-emerald-600 font-bold">
                            {m.debit > 0 ? `$${fmtNum(m.debit)}` : "-"}
                          </td>
                          <td className="p-2.5 text-rose-600 font-bold">
                            {m.credit > 0 ? `$${fmtNum(m.credit)}` : "-"}
                          </td>
                          <td className="p-2.5 font-black">${fmtNum(m.runningBalance)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2 border-t">
            {inspectedDiagnostic && (
              <>
                <Button
                  size="sm"
                  variant="print"
                  onClick={() => handlePrintSingleAccountStatus(inspectedDiagnostic)}
                  className="font-bold text-xs rounded-xl gap-1.5"
                >
                  <Printer size={14} />
                  طباعة بطاقة الحالة الحسابية وكشف الحركات
                </Button>
                <Button
                  size="sm"
                  variant="excel"
                  onClick={() =>
                    exportRowsToExcel(
                      inspectedDiagnostic.movements.map((m) => ({
                        "التاريخ": m.date,
                        "المرجع": m.reference,
                        "البيان المحاسبي": m.description,
                        "مدين (USD)": m.debit,
                        "دائن (USD)": m.credit,
                        "الرصيد التراكمي": m.runningBalance,
                      })),
                      `كشف_${inspectedDiagnostic.code}`,
                      `Account_Statement_${inspectedDiagnostic.code}`,
                    )
                  }
                  className="font-bold text-xs rounded-xl gap-1.5"
                >
                  <FileSpreadsheet size={14} />
                  طباعة إكسيل (Excel)
                </Button>
                <Button
                  size="sm"
                  variant="edit"
                  onClick={() => {
                    if (!selectedComparisonCodes.includes(inspectedDiagnostic.code)) {
                      setSelectedComparisonCodes((prev) => [...prev, inspectedDiagnostic.code]);
                    }
                    setInspectedAccountCode(null);
                    setActiveTab("comparison");
                  }}
                  className="font-bold text-xs rounded-xl gap-1.5"
                >
                  <BarChart3 size={14} />
                  إضافة للمقارنة بين الحسابات
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="close"
              onClick={() => setInspectedAccountCode(null)}
              className="font-bold text-xs rounded-xl"
            >
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
