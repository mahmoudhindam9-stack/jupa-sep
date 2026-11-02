// @ts-nocheck
import React, { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  Printer,
  FileSpreadsheet,
  BookOpen,
  Table as TableIcon,
  FileText,
  CalendarDays,
  Search,
  X,
  Coins,
  Building,
  Download,
  Layers,
  CheckSquare,
  Square,
  Scale,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  printTreasuryMovementDocument,
  printAccountingDocument,
  type TreasuryMovementReportData,
} from "@/shared/utils/printAccountingDocument";
import { erpStore, type TreasuryTransaction } from "@/shared/services/erpStore";

export type TreasuryReportTabType = "document" | "combined" | "journal" | "table" | "excel";

interface TreasuryReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTreasuryId?: string;
  initialReportType?: TreasuryReportTabType;
  initialType?: TreasuryReportTabType;
  treasuries?: any[];
  transactions?: TreasuryTransaction[];
  currentBranch?: { id: string; name_ar: string };
}

export function TreasuryReportModal({
  isOpen,
  onClose,
  initialTreasuryId = "all",
  initialReportType,
  initialType,
  treasuries: propTreasuries,
  transactions: propTransactions,
  currentBranch: propBranch,
}: TreasuryReportModalProps) {
  const [storeState, setStoreState] = useState(() => erpStore.getState());

  useEffect(() => {
    if (!isOpen) return;
    setStoreState(erpStore.getState());
    return erpStore.subscribe(() => {
      setStoreState(erpStore.getState());
    });
  }, [isOpen]);

  const currentBranch = useMemo(() => {
    if (propBranch && propBranch.id) return propBranch;
    const found = (storeState.branches || []).find((b) => b.id === storeState.currentBranchId);
    return found || storeState.branches?.[0] || { id: "branch-1", name_ar: "الفرع الرئيسي" };
  }, [propBranch, storeState.branches, storeState.currentBranchId]);

  const treasuries = useMemo(() => {
    if (Array.isArray(propTreasuries) && propTreasuries.length > 0) {
      return propTreasuries.filter((t) => !t.deleted);
    }
    return (storeState.treasuries || []).filter(
      (t) => (!t.branch_id || t.branch_id === currentBranch.id) && !t.deleted,
    );
  }, [propTreasuries, storeState.treasuries, currentBranch.id]);

  // Combine direct treasuryTransactions + manual GL journal entries that hit a treasury account_code
  const transactions = useMemo(() => {
    const baseTxs =
      Array.isArray(propTransactions) && propTransactions.length > 0
        ? propTransactions
        : storeState.treasuryTransactions || [];

    const existingRefs = new Set<string>();
    baseTxs.forEach((tx) => {
      if (tx.id) existingRefs.add(String(tx.id));
      if (tx.related_entity_id) existingRefs.add(String(tx.related_entity_id));
      if ((tx as any).journal_reference) existingRefs.add(String((tx as any).journal_reference));
    });

    const treasuryByAccountCode = new Map<string, any>();
    treasuries.forEach((tr) => {
      const code = String(tr.account_code || (tr.id === "tr-1" ? "13010130" : "")).trim();
      if (code) treasuryByAccountCode.set(code, tr);
    });

    const syntheticFromJournals: TreasuryTransaction[] = [];
    (storeState.journalEntries || []).forEach((entry) => {
      const ref = String(entry.reference || entry.id || "");
      if (ref && existingRefs.has(ref)) return;

      (entry.lines || []).forEach((line, lIdx) => {
        const accCode = String(line.account_code || "").trim();
        const matchedTr = treasuryByAccountCode.get(accCode);
        if (!matchedTr) return;

        const dr = Number(line.debit || 0);
        const cr = Number(line.credit || 0);
        if (dr <= 0 && cr <= 0) return;

        const synId = `gl-${entry.id || ref}-${lIdx}`;
        if (existingRefs.has(synId)) return;

        syntheticFromJournals.push({
          id: synId,
          branch_id: matchedTr.branch_id || currentBranch.id,
          treasury_id: matchedTr.id,
          type: dr > 0 ? "deposit" : "withdrawal",
          amount: dr > 0 ? dr : cr,
          currency: line.currency || entry.currency || matchedTr.currency || "EGP",
          payment_method: "cash",
          note: line.description || entry.description || "قيد يومية مباشر على حساب الخزينة",
          related_entity_id: ref || entry.id,
          created_at: entry.date ? `${entry.date}T12:00:00` : new Date().toISOString(),
          date: entry.date ? `${entry.date}T12:00:00` : undefined,
        } as any);
      });
    });

    return [...baseTxs, ...syntheticFromJournals];
  }, [propTransactions, storeState.treasuryTransactions, storeState.journalEntries, treasuries, currentBranch.id]);

  const resolvedInitType = initialReportType || initialType || "document";
  const [selectedTreasuryId, setSelectedTreasuryId] = useState<string>(initialTreasuryId || "all");
  const [reportType, setReportType] = useState<TreasuryReportTabType>(resolvedInitType);
  const [datePreset, setDatePreset] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [filterTxType, setFilterTxType] = useState<string>("all");
  const [filterCurrency, setFilterCurrency] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Multi-treasury subset selection when viewing combined reports ("all")
  const [includedTreasuryIds, setIncludedTreasuryIds] = useState<string[]>([]);

  // Specific movement / journal entry selection checkboxes
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);

  // Sync initial props when opened
  useEffect(() => {
    if (isOpen) {
      if (initialTreasuryId) {
        setSelectedTreasuryId(initialTreasuryId);
      }
      const nextType = initialReportType || initialType;
      if (nextType) {
        setReportType(nextType);
      }
      setSelectedRowIds([]);
    }
  }, [isOpen, initialTreasuryId, initialReportType, initialType]);

  // Keep includedTreasuryIds synced with available treasuries
  useEffect(() => {
    setIncludedTreasuryIds((prev) => {
      const validIds = treasuries.map((t) => t.id);
      if (prev.length === 0) return validIds;
      const kept = prev.filter((id) => validIds.includes(id));
      return kept.length > 0 ? kept : validIds;
    });
  }, [treasuries]);

  const toggleIncludedTreasury = (id: string) => {
    setIncludedTreasuryIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev;
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  };

  // Quick Date Presets Handler
  const applyDatePreset = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();
    const format = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    if (preset === "today") {
      const todayStr = format(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
      setStartTime("00:00");
      setEndTime("23:59");
    } else if (preset === "yesterday") {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yesterdayStr = format(y);
      setStartDate(yesterdayStr);
      setEndDate(yesterdayStr);
      setStartTime("00:00");
      setEndTime("23:59");
    } else if (preset === "shift") {
      const todayStr = format(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
      setStartTime("08:00");
      setEndTime("23:59");
    } else if (preset === "last7") {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      setStartDate(format(d));
      setEndDate(format(now));
      setStartTime("00:00");
      setEndTime("23:59");
    } else if (preset === "thisMonth") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(format(firstDay));
      setEndDate(format(now));
      setStartTime("00:00");
      setEndTime("23:59");
    } else if (preset === "lastMonth") {
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(format(firstDayLastMonth));
      setEndDate(format(lastDayLastMonth));
      setStartTime("00:00");
      setEndTime("23:59");
    } else {
      setStartDate("");
      setEndDate("");
      setStartTime("");
      setEndTime("");
    }
  };

  // Helper: Mapping transaction types to Arabic labels and styles
  const getTypeMeta = (type: string) => {
    switch (type) {
      case "sales":
        return {
          label: "مبيعات POS",
          isIncoming: true,
          color: "text-emerald-700 bg-emerald-50 border-emerald-200",
        };
      case "deposit":
        return {
          label: "إيداع نقدي",
          isIncoming: true,
          color: "text-blue-700 bg-blue-50 border-blue-200",
        };
      case "transfer_in":
        return {
          label: "تحويل وارد",
          isIncoming: true,
          color: "text-indigo-700 bg-indigo-50 border-indigo-200",
        };
      case "withdrawal":
        return {
          label: "سحب / مصروفات",
          isIncoming: false,
          color: "text-rose-700 bg-rose-50 border-rose-200",
        };
      case "transfer_out":
        return {
          label: "تحويل صادر",
          isIncoming: false,
          color: "text-amber-700 bg-amber-50 border-amber-200",
        };
      case "expense":
        return {
          label: "مصروفات عامة",
          isIncoming: false,
          color: "text-red-700 bg-red-50 border-red-200",
        };
      case "purchase":
        return {
          label: "مشتريات وموردين",
          isIncoming: false,
          color: "text-orange-700 bg-orange-50 border-orange-200",
        };
      case "reconciliation":
        return {
          label: "تسوية جرد",
          isIncoming: false,
          color: "text-purple-700 bg-purple-50 border-purple-200",
        };
      default:
        return {
          label: type || "حركة مالية",
          isIncoming: true,
          color: "text-slate-700 bg-slate-50 border-slate-200",
        };
    }
  };

  // Helper: Get analytical account
  const getAnalyticalAccount = (tx: TreasuryTransaction) => {
    const isInc = tx.type === "deposit" || tx.type === "sales" || tx.type === "transfer_in";
    if (isInc) {
      if (tx.type === "sales") return "410101 - إيراد مبيعات صالة ومطعم";
      if (tx.type === "transfer_in") return "110199 - وسيط تحويلات الخزائن";
      return "420101 - إيرادات وإيداعات متنوعة";
    } else {
      if (tx.type === "transfer_out") return "110199 - وسيط تحويلات الخزائن";
      if (tx.type === "reconciliation") return "520101 - تسويات فروق صناديق الجرد";
      if (tx.type === "purchase") return "24010 - الموردون ومشتريات المخزون";
      return "510101 - مصروفات عمومية وإدارية / عهد";
    }
  };

  // Selected Treasury object (or null for "all")
  const selectedTreasury = useMemo(() => {
    if (selectedTreasuryId === "all") return null;
    return treasuries.find((t) => t.id === selectedTreasuryId) || null;
  }, [selectedTreasuryId, treasuries]);

  // Active target treasuries (1 treasury when single, or includedTreasuries when "all")
  const activeTreasuries = useMemo(() => {
    if (selectedTreasury) return [selectedTreasury];
    const filtered = treasuries.filter((t) => includedTreasuryIds.includes(t.id));
    return filtered.length > 0 ? filtered : treasuries;
  }, [selectedTreasury, treasuries, includedTreasuryIds]);

  const startLimitMs = useMemo(() => {
    if (!startDate) return null;
    const ms = new Date(`${startDate}T${startTime || "00:00"}:00`).getTime();
    return isNaN(ms) ? null : ms;
  }, [startDate, startTime]);

  const endLimitMs = useMemo(() => {
    if (!endDate) return null;
    const ms = new Date(`${endDate}T${endTime || "23:59"}:59`).getTime();
    return isNaN(ms) ? null : ms;
  }, [endDate, endTime]);

  // Filtered Transactions with precise Date, Time, Treasury, Type, Currency and Search Query
  const filteredTransactions = useMemo(() => {
    const activeIds = new Set(activeTreasuries.map((t) => t.id));
    return transactions.filter((tx) => {
      // 1. Treasury Filter
      if (selectedTreasuryId !== "all") {
        if (tx.treasury_id !== selectedTreasuryId) return false;
      } else {
        if (!activeIds.has(tx.treasury_id)) return false;
      }

      // 2. Date & Time Range Filtering
      const rawDateStr = tx.date || tx.created_at || "";
      if (!rawDateStr) return false;

      const txTimeMs = new Date(rawDateStr).getTime();
      if (startLimitMs !== null && txTimeMs < startLimitMs) {
        return false;
      }
      if (endLimitMs !== null && txTimeMs > endLimitMs) {
        return false;
      }

      // 3. Movement Type Filter
      if (filterTxType !== "all" && tx.type !== filterTxType) {
        return false;
      }

      // 4. Currency / Payment Method Filter
      if (filterCurrency !== "all") {
        const pm = tx.payment_method || "cash";
        const curr = tx.currency || "EGP";
        const compKey = `${pm}_${curr}`;
        if (compKey !== filterCurrency) {
          return false;
        }
      }

      // 5. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const trObj = treasuries.find((t) => t.id === tx.treasury_id);
        const trName = (trObj?.name_ar || "").toLowerCase();
        const note = (tx.note || "").toLowerCase();
        const ref = (tx.related_entity_id || "").toLowerCase();
        const id = (tx.id || "").toLowerCase();
        const user = ((tx as any).created_by || "").toLowerCase();
        const amountStr = String(tx.amount || 0);

        const match =
          trName.includes(q) ||
          note.includes(q) ||
          ref.includes(q) ||
          id.includes(q) ||
          user.includes(q) ||
          amountStr.includes(q);

        if (!match) return false;
      }

      return true;
    });
  }, [
    transactions,
    selectedTreasuryId,
    activeTreasuries,
    startLimitMs,
    endLimitMs,
    filterTxType,
    filterCurrency,
    searchQuery,
    treasuries,
  ]);

  // Per-Treasury Period Summary (used for both Combined Report and accurate Period Opening/Closing Balance)
  const perTreasuryPeriodSummaries = useMemo(() => {
    return activeTreasuries.map((tr) => {
      const initialOp = Number(tr.opening_balance ?? 0);
      let priorNet = 0;
      let periodIn = 0;
      let periodOut = 0;
      let periodTxCount = 0;

      const trTxs = transactions.filter((tx) => tx.treasury_id === tr.id);
      trTxs.forEach((tx) => {
        const rawDateStr = tx.date || tx.created_at || "";
        const txMs = rawDateStr ? new Date(rawDateStr).getTime() : 0;
        const meta = getTypeMeta(tx.type);
        const amt = Number(tx.amount || 0);

        if (startLimitMs !== null && txMs > 0 && txMs < startLimitMs) {
          priorNet += meta.isIncoming ? amt : -amt;
          return;
        }
        if (endLimitMs !== null && txMs > 0 && txMs > endLimitMs) {
          return;
        }

        periodTxCount += 1;
        if (meta.isIncoming) periodIn += amt;
        else periodOut += amt;
      });

      const periodOpening = initialOp + priorNet;
      const periodNet = periodIn - periodOut;
      const periodClosing = periodOpening + periodNet;

      return {
        treasury: tr,
        id: tr.id,
        name_ar: tr.name_ar,
        account_code: tr.account_code || (tr.id === "tr-1" ? "13010130" : "13010100"),
        type: tr.type,
        typeLabel: tr.type === "bank" ? "حساب بنكي" : "خزينة نقدية",
        currency: tr.currency || "EGP",
        responsible_employee: tr.responsible_employee || "غير محدد",
        is_open: Boolean(tr.is_open),
        openingBalance: periodOpening,
        totalInflow: periodIn,
        totalOutflow: periodOut,
        netMovement: periodNet,
        closingBalance: periodClosing,
        currentLiveBalance: Number(tr.balance ?? periodClosing),
        txCount: periodTxCount,
      };
    });
  }, [activeTreasuries, transactions, startLimitMs, endLimitMs]);

  // Compute Financial Aggregates across current filtered view
  const { openingBalance, totalInflow, totalOutflow, netMovement, closingBalance, sortedTxRows } =
    useMemo(() => {
      // Accurate opening balance at the start of the period (including prior movements before startDate)
      const opBal = perTreasuryPeriodSummaries.reduce((sum, s) => sum + s.openingBalance, 0);

      // Sort transactions ascending by timestamp for accurate running balance
      const sorted = [...filteredTransactions].sort(
        (a, b) =>
          new Date(a.date || a.created_at || 0).getTime() -
          new Date(b.date || b.created_at || 0).getTime(),
      );

      let running = opBal;
      let inflowSum = 0;
      let outflowSum = 0;

      const rows = sorted.map((tx, idx) => {
        const meta = getTypeMeta(tx.type);
        const isInc = meta.isIncoming;
        const amt = Number(tx.amount || 0);

        if (isInc) {
          inflowSum += amt;
          running += amt;
        } else {
          outflowSum += amt;
          running -= amt;
        }

        const trObj = treasuries.find((t) => t.id === tx.treasury_id);
        const trName = trObj ? trObj.name_ar : "الخزينة";

        const pmLabels: Record<string, string> = {
          cash: "نقداً (كاش)",
          card: "فيزا / بطاقة",
          wallet: "محفظة إلكترونية",
        };

        const dt = new Date(tx.date || tx.created_at || Date.now());
        const formattedDate = dt.toLocaleString("ar-EG", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });

        return {
          id: tx.id || `TX-${idx + 1}`,
          index: idx + 1,
          rawDate: dt,
          date: formattedDate,
          type: tx.type,
          typeLabel: meta.label,
          typeColor: meta.color,
          isIncoming: isInc,
          treasuryId: tx.treasury_id,
          treasuryName: trName,
          treasuryCode: trObj?.account_code || (trObj?.id === "tr-1" ? "13010130" : "13010100"),
          analyticalAccount: getAnalyticalAccount(tx),
          paymentMethod: tx.payment_method || "cash",
          paymentMethodLabel: pmLabels[tx.payment_method || "cash"] || "كاش",
          currency: tx.currency || (trObj ? trObj.currency : "EGP") || "EGP",
          inflow: isInc ? amt : 0,
          outflow: !isInc ? amt : 0,
          amount: amt,
          runningBalance: running,
          note: tx.note || "بدون ملاحظات",
          reference: tx.related_entity_id || "-",
          user: (tx as any).created_by || trObj?.responsible_employee || "الكاشير",
        };
      });

      return {
        openingBalance: opBal,
        totalInflow: inflowSum,
        totalOutflow: outflowSum,
        netMovement: inflowSum - outflowSum,
        closingBalance: running,
        sortedTxRows: rows,
      };
    }, [filteredTransactions, perTreasuryPeriodSummaries, treasuries]);

  // Selected rows subset (when user checks specific entries/movements)
  const selectedRowsList = useMemo(() => {
    if (selectedRowIds.length === 0) return [];
    const idSet = new Set(selectedRowIds);
    return sortedTxRows.filter((r) => idSet.has(r.id));
  }, [sortedTxRows, selectedRowIds]);

  const selectedAggregates = useMemo(() => {
    const rowsToSum = selectedRowsList.length > 0 ? selectedRowsList : sortedTxRows;
    const inSum = rowsToSum.reduce((s, r) => s + r.inflow, 0);
    const outSum = rowsToSum.reduce((s, r) => s + r.outflow, 0);
    return {
      count: rowsToSum.length,
      inflow: inSum,
      outflow: outSum,
      net: inSum - outSum,
    };
  }, [selectedRowsList, sortedTxRows]);

  const toggleRowSelection = (id: string) => {
    setSelectedRowIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const selectAllRows = () => {
    setSelectedRowIds(sortedTxRows.map((r) => r.id));
  };

  const selectInflowRowsOnly = () => {
    setSelectedRowIds(sortedTxRows.filter((r) => r.isIncoming).map((r) => r.id));
  };

  const selectOutflowRowsOnly = () => {
    setSelectedRowIds(sortedTxRows.filter((r) => !r.isIncoming).map((r) => r.id));
  };

  const clearRowSelection = () => {
    setSelectedRowIds([]);
  };

  // Compute Currency Breakdown for the selected scope & period
  const currencyBreakdown = useMemo(() => {
    let cashEGP = 0;
    let cashUSD = 0;
    let cashSSP = 0;
    let cardUSD = 0;
    let walletSSP = 0;

    perTreasuryPeriodSummaries.forEach((s) => {
      const opBal = s.openingBalance;
      if (s.currency === "MULTI" || s.currency === "EGP") {
        cashEGP += opBal;
      } else if (s.currency === "USD") {
        cashUSD += opBal;
      } else if (s.currency === "SSP") {
        cashSSP += opBal;
      }
    });

    filteredTransactions.forEach((tx) => {
      const meta = getTypeMeta(tx.type);
      const amt = meta.isIncoming ? Number(tx.amount || 0) : -Number(tx.amount || 0);
      const pm = tx.payment_method || "cash";
      const curr = tx.currency || "EGP";

      if (pm === "card") {
        cardUSD += amt;
      } else if (pm === "wallet") {
        walletSSP += amt;
      } else {
        if (curr === "USD") cashUSD += amt;
        else if (curr === "SSP") cashSSP += amt;
        else cashEGP += amt;
      }
    });

    return { cashEGP, cashUSD, cashSSP, cardUSD, walletSSP };
  }, [filteredTransactions, perTreasuryPeriodSummaries]);

  // Journal Entry Generator for Double-Entry View
  const journalEntries = useMemo(() => {
    return sortedTxRows.map((row) => {
      const trObj = treasuries.find((t) => t.id === row.treasuryId) || selectedTreasury;
      const trCode = trObj?.account_code || (trObj?.id === "tr-1" ? "13010130" : "13010100");
      const trName = trObj?.name_ar || row.treasuryName || "الخزينة";

      let debitCode = "";
      let debitName = "";
      let creditCode = "";
      let creditName = "";

      if (row.isIncoming) {
        debitCode = trCode;
        debitName = `${trCode} - ${trName}`;

        if (row.type === "sales") {
          creditCode = "410101";
          creditName = "410101 - إيراد مبيعات صالة ومطعم (POS)";
        } else if (row.type === "transfer_in") {
          creditCode = "110199";
          creditName = "110199 - حساب وسيط تحويلات نقدية";
        } else {
          creditCode = "420101";
          creditName = "420101 - إيرادات وإيداعات نقدية متنوعة";
        }
      } else {
        creditCode = trCode;
        creditName = `${trCode} - ${trName}`;

        if (row.type === "transfer_out") {
          debitCode = "110199";
          debitName = "110199 - حساب وسيط تحويلات نقدية";
        } else if (row.type === "reconciliation") {
          debitCode = "520101";
          debitName = "520101 - تسويات فروق صناديق الجرد";
        } else if (row.type === "purchase") {
          debitCode = "24010";
          debitName = "24010 - الموردون ومشتريات المخزون";
        } else {
          debitCode = "510101";
          debitName = "510101 - مصروفات عمومية وإدارية / عهد";
        }
      }

      let voucherNum = row.reference;
      if (!voucherNum || voucherNum === "-" || voucherNum.startsWith("JV-")) {
        const d = row.rawDate;
        const month = d.getMonth() + 1;
        const rawNum = row.id ? row.id.replace(/\D/g, "") : "";
        const seq = parseInt(rawNum.slice(-3)) || row.index;
        voucherNum = `JV-${month}/${seq}`;
      }

      return {
        id: row.id,
        voucherNum,
        date: row.date,
        treasuryName: trName,
        description: row.note,
        reference: row.reference,
        currency: row.currency,
        createdBy: row.user,
        type: row.typeLabel,
        isIncoming: row.isIncoming,
        amount: row.amount,
        lines: [
          {
            type: "debit",
            accountCode: debitCode,
            accountName: debitName,
            debit: row.amount,
            credit: 0,
          },
          {
            type: "credit",
            accountCode: creditCode,
            accountName: creditName,
            debit: 0,
            credit: row.amount,
          },
        ],
      };
    });
  }, [sortedTxRows, treasuries, selectedTreasury]);

  const getPeriodLabel = () => {
    if (startDate || endDate) {
      return `من ${startDate || "البداية"} ${startTime || ""} إلى ${endDate || "الآن"} ${endTime || ""}`.trim();
    }
    switch (datePreset) {
      case "today":
        return "حركات اليوم";
      case "yesterday":
        return "حركات الأمس";
      case "shift":
        return "حركات الوردية الحالية";
      case "last7":
        return "آخر 7 أيام";
      case "thisMonth":
        return "حركات هذا الشهر";
      case "lastMonth":
        return "الشهر الماضي";
      default:
        return "كامل السجل التاريخي";
    }
  };

  // 1) Print Official Movement Accounting Document (either all filtered rows OR selected rows)
  const handlePrintMovementDocument = (onlySelected = false) => {
    const useSubset = onlySelected && selectedRowsList.length > 0;
    const rowsToPrint = useSubset ? selectedRowsList : sortedTxRows;
    const inSum = rowsToPrint.reduce((s, r) => s + r.inflow, 0);
    const outSum = rowsToPrint.reduce((s, r) => s + r.outflow, 0);
    const netSum = inSum - outSum;
    const closeBal = useSubset ? openingBalance + netSum : closingBalance;

    const periodStr = getPeriodLabel() + (useSubset ? ` (محدد: ${rowsToPrint.length} حركة)` : "");

    const reportData: TreasuryMovementReportData = {
      documentNo: `TR-DOC-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`,
      treasuryName: selectedTreasury
        ? selectedTreasury.name_ar
        : `تقرير مجمع (${activeTreasuries.length} خزائن)`,
      treasuryCode: selectedTreasury?.account_code || "13010100",
      treasuryType: selectedTreasury
        ? selectedTreasury.type === "cash"
          ? "خزينة نقدية (Cash Desk)"
          : "حساب بنكي (Bank Account)"
        : "تقرير خزائن وبنوك مجمع",
      treasuryCurrency: selectedTreasury?.currency || "MULTI",
      responsibleEmployee: selectedTreasury?.responsible_employee || "إدارة الحسابات والخزائن",
      branchName: currentBranch?.name_ar || "الفرع الرئيسي",
      periodLabel: periodStr,
      startDate: startDate,
      endDate: endDate,
      startTime: startTime,
      endTime: endTime,
      openingBalance: openingBalance,
      totalInflow: inSum,
      totalOutflow: outSum,
      netMovement: netSum,
      closingBalance: closeBal,
      currencyBreakdown: currencyBreakdown,
      transactions: rowsToPrint,
    };

    printTreasuryMovementDocument(reportData);
  };

  // 2) Print Period Balance Statement (طباعة الرصيد في فترة محددة أو من - إلى)
  const handlePrintPeriodBalanceReport = (targetTreasury?: any) => {
    const periodStr = getPeriodLabel();
    const targetSummaries = targetTreasury
      ? perTreasuryPeriodSummaries.filter((s) => s.id === targetTreasury.id)
      : perTreasuryPeriodSummaries;

    const sumOpen = targetSummaries.reduce((acc, s) => acc + s.openingBalance, 0);
    const sumIn = targetSummaries.reduce((acc, s) => acc + s.totalInflow, 0);
    const sumOut = targetSummaries.reduce((acc, s) => acc + s.totalOutflow, 0);
    const sumNet = sumIn - sumOut;
    const sumClose = targetSummaries.reduce((acc, s) => acc + s.closingBalance, 0);

    const scopeTitle = targetTreasury
      ? `بيان رصيد الخزينة عن فترة: ${targetTreasury.name_ar}`
      : selectedTreasury
        ? `بيان رصيد الخزينة عن فترة: ${selectedTreasury.name_ar}`
        : `بيان أرصدة الخزائن المجمع عن فترة (${targetSummaries.length} خزائن)`;

    printAccountingDocument({
      title: scopeTitle,
      subtitle: `الفرع: ${currentBranch?.name_ar || "الرئيسي"} | الفترة المحددة: ${periodStr}`,
      documentNo: `TR-BAL-${Date.now().toString().slice(-6)}`,
      landscape: true,
      metaItems: [
        {
          label: "نطاق التقرير",
          value: targetTreasury
            ? targetTreasury.name_ar
            : selectedTreasury
              ? selectedTreasury.name_ar
              : `تقرير مجمع (${targetSummaries.length} خزائن)`,
        },
        { label: "الفترة الزمنية (من - إلى)", value: periodStr },
        {
          label: "الرصيد الافتتاحي لبداية الفترة",
          value: sumOpen.toLocaleString("en-US", { minimumFractionDigits: 2 }),
        },
        {
          label: "الرصيد الختامي في نهاية الفترة",
          value: sumClose.toLocaleString("en-US", { minimumFractionDigits: 2 }),
        },
      ],
      columns: [
        { key: "code", label: "رقم الحساب الشجري", align: "center" },
        { key: "name", label: "اسم الخزينة / البنك", align: "right" },
        { key: "type", label: "النوع", align: "center" },
        { key: "currency", label: "العملة", align: "center" },
        { key: "opening", label: "الرصيد الافتتاحي (قبل الفترة)", align: "left" },
        { key: "inflow", label: "إجمالي الوارد (+) خلال الفترة", align: "left" },
        { key: "outflow", label: "إجمالي الصادر (-) خلال الفترة", align: "left" },
        { key: "net", label: "صافي حركة الفترة", align: "left" },
        { key: "closing", label: "الرصيد الختامي (نهاية الفترة)", align: "left" },
        { key: "txCount", label: "عدد الحركات", align: "center" },
      ],
      rows: targetSummaries.map((s) => ({
        code: s.account_code,
        name: s.name_ar,
        type: s.typeLabel,
        currency: s.currency,
        opening: `${s.openingBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${s.currency}`,
        inflow: `+${s.totalInflow.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${s.currency}`,
        outflow: `-${s.totalOutflow.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${s.currency}`,
        net: `${s.netMovement >= 0 ? "+" : ""}${s.netMovement.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${s.currency}`,
        closing: `${s.closingBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${s.currency}`,
        txCount: `${s.txCount} حركة`,
      })),
      totals: [
        {
          label: "إجمالي الرصيد الافتتاحي (بداية الفترة):",
          value: sumOpen.toLocaleString("en-US", { minimumFractionDigits: 2 }),
        },
        {
          label: "إجمالي المقبوضات / الوارد (+):",
          value: `+${sumIn.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
        },
        {
          label: "إجمالي المدفوعات / الصادر (-):",
          value: `-${sumOut.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
        },
        {
          label: "صافي التغير خلال الفترة:",
          value: `${sumNet >= 0 ? "+" : ""}${sumNet.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
        },
        {
          label: "الرصيد الختامي المعتمد لنهاية الفترة:",
          value: sumClose.toLocaleString("en-US", { minimumFractionDigits: 2 }),
        },
        {
          label: "إجمالي عدد الحركات بالفترة:",
          value: `${targetSummaries.reduce((acc, s) => acc + s.txCount, 0)} حركة`,
        },
      ],
      summaryHtml: `
        <div style="font-size:12px;line-height:1.8;">
          <strong>تفصيل الأرصدة النقدية والبنكية المباشرة حسب العملة وطريقة الدفع في نهاية الفترة:</strong>
          <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:8px;text-align:center;">
            <div style="background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:6px;">نقدي EGP: <strong>${currencyBreakdown.cashEGP.toLocaleString()}</strong></div>
            <div style="background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:6px;">نقدي USD: <strong>${currencyBreakdown.cashUSD.toLocaleString()}</strong></div>
            <div style="background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:6px;">نقدي SSP: <strong>${currencyBreakdown.cashSSP.toLocaleString()}</strong></div>
            <div style="background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:6px;">بطاقة / فيزا USD: <strong>${currencyBreakdown.cardUSD.toLocaleString()}</strong></div>
            <div style="background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:6px;">محفظة SSP: <strong>${currencyBreakdown.walletSSP.toLocaleString()}</strong></div>
          </div>
        </div>
      `,
    });
  };

  // 3) Print Single Treasury Report Immediately from Combined Table
  const handlePrintSingleTreasuryFromRow = (trSummary: any) => {
    const trObj = trSummary.treasury;
    const trRows = sortedTxRows.filter((r) => r.treasuryId === trObj.id);
    const reportData: TreasuryMovementReportData = {
      documentNo: `TR-SIN-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`,
      treasuryName: trObj.name_ar,
      treasuryCode: trSummary.account_code,
      treasuryType:
        trObj.type === "cash" ? "خزينة نقدية منفردة (Cash Desk)" : "حساب بنكي منفرد (Bank Account)",
      treasuryCurrency: trObj.currency || "EGP",
      responsibleEmployee: trObj.responsible_employee || "أمين الخزينة",
      branchName: currentBranch?.name_ar || "الفرع الرئيسي",
      periodLabel: getPeriodLabel(),
      startDate,
      endDate,
      startTime,
      endTime,
      openingBalance: trSummary.openingBalance,
      totalInflow: trSummary.totalInflow,
      totalOutflow: trSummary.totalOutflow,
      netMovement: trSummary.netMovement,
      closingBalance: trSummary.closingBalance,
      currencyBreakdown: {
        cashEGP: trObj.currency === "EGP" || trObj.currency === "MULTI" ? trSummary.closingBalance : 0,
        cashUSD: trObj.currency === "USD" ? trSummary.closingBalance : 0,
        cashSSP: trObj.currency === "SSP" ? trSummary.closingBalance : 0,
        cardUSD: 0,
        walletSSP: 0,
      },
      transactions: trRows,
    };
    printTreasuryMovementDocument(reportData);
  };

  // 4) Print Journal Entries Document (all or selected)
  const handlePrintJournalEntries = (onlySelected = false) => {
    const idSet = new Set(selectedRowIds);
    const entriesToPrint =
      onlySelected && selectedRowIds.length > 0
        ? journalEntries.filter((e) => idSet.has(e.id))
        : journalEntries;

    const periodStr =
      getPeriodLabel() +
      (onlySelected && selectedRowIds.length > 0 ? ` (قيود مختارة: ${entriesToPrint.length})` : "");

    const rows = entriesToPrint.flatMap((entry) => {
      return entry.lines.map((l) => ({
        voucher: entry.voucherNum,
        date: entry.date,
        treasury: entry.treasuryName,
        account: `${l.accountCode} - ${l.accountName}`,
        desc: entry.description,
        debit: l.debit > 0 ? `${l.debit.toLocaleString()} ${entry.currency}` : "-",
        credit: l.credit > 0 ? `${l.credit.toLocaleString()} ${entry.currency}` : "-",
        currency: entry.currency,
        user: entry.createdBy,
      }));
    });

    const totalDebit = entriesToPrint.reduce((s, e) => s + e.amount, 0);

    printAccountingDocument({
      title: `كشف القيود المحاسبية المزدوجة لحركات الخزائن (${entriesToPrint.length} قيد)`,
      subtitle: `النطاق: ${selectedTreasury ? selectedTreasury.name_ar : `كافة الخزائن (${activeTreasuries.length})`} | الفترة: ${periodStr}`,
      documentNo: `JV-REP-${Date.now().toString().slice(-6)}`,
      landscape: true,
      columns: [
        { key: "voucher", label: "رقم القيد", align: "center" },
        { key: "date", label: "التاريخ والتوقيت", align: "center" },
        { key: "treasury", label: "الخزينة", align: "right" },
        { key: "account", label: "كود واسم الحساب المحاسبي", align: "right" },
        { key: "desc", label: "البيان / الشرح", align: "right" },
        { key: "debit", label: "مدين (+)", align: "left" },
        { key: "credit", label: "دائن (-)", align: "left" },
        { key: "currency", label: "العملة", align: "center" },
        { key: "user", label: "المسؤول", align: "center" },
      ],
      rows,
      totals: [
        { label: "عدد القيود المطبوعة:", value: `${entriesToPrint.length} قيد يومية` },
        { label: "إجمالي الجانب المدين:", value: `${totalDebit.toLocaleString()} (مجمّع)` },
        { label: "إجمالي الجانب الدائن:", value: `${totalDebit.toLocaleString()} (مجمّع)` },
      ],
    });
  };

  // 5) Export Comprehensive Multi-Sheet Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const rowsToExport = selectedRowsList.length > 0 ? selectedRowsList : sortedTxRows;

    // Sheet 1: Combined Treasuries Period Summary
    const combinedSheetRows = perTreasuryPeriodSummaries.map((s, idx) => ({
      م: idx + 1,
      "كود الحساب": s.account_code,
      "اسم الخزينة / البنك": s.name_ar,
      النوع: s.typeLabel,
      العملة: s.currency,
      المسؤول: s.responsible_employee,
      "الرصيد الافتتاحي للفترة": s.openingBalance,
      "إجمالي الوارد (+)": s.totalInflow,
      "إجمالي الصادر (-)": s.totalOutflow,
      "صافي حركة الفترة": s.netMovement,
      "الرصيد الختامي للفترة": s.closingBalance,
      "عدد الحركات": s.txCount,
    }));
    const ws0 = XLSX.utils.json_to_sheet(combinedSheetRows);
    XLSX.utils.book_append_sheet(wb, ws0, "ملخص أرصدة الخزائن");

    // Sheet 2: Movements Table
    const moveRows = rowsToExport.map((r) => ({
      م: r.index,
      "رقم الحركة": r.id,
      الخزينة: r.treasuryName,
      "كود حساب الخزينة": r.treasuryCode,
      "التاريخ والوقت": r.date,
      "نوع الحركة": r.typeLabel,
      "الحساب التحليلي المقابل": r.analyticalAccount,
      "طريقة الدفع": r.paymentMethodLabel,
      العملة: r.currency,
      "الوارد (+)": r.inflow,
      "الصادر (-)": r.outflow,
      "الرصيد التراكمي": r.runningBalance,
      "البيان / الملاحظات": r.note,
      "المرجع / الفاتورة": r.reference,
      "المسؤول / الكاشير": r.user,
    }));
    const ws1 = XLSX.utils.json_to_sheet(moveRows);
    XLSX.utils.book_append_sheet(wb, ws1, "كشف حركات الخزينة");

    // Sheet 3: Journal Entries
    const jRows: any[] = [];
    journalEntries.forEach((entry) => {
      entry.lines.forEach((line) => {
        jRows.push({
          "رقم القيد": entry.voucherNum,
          "التاريخ والوقت": entry.date,
          الخزينة: entry.treasuryName,
          "البيان العام": entry.description,
          "نوع الطرف": line.type === "debit" ? "مدين" : "دائن",
          "كود الحساب": line.accountCode,
          "اسم الحساب": line.accountName,
          "مدين (+)": line.debit,
          "دائن (-)": line.credit,
          العملة: entry.currency,
          المرجع: entry.reference,
          المسؤول: entry.createdBy,
        });
      });
    });
    const ws2 = XLSX.utils.json_to_sheet(jRows);
    XLSX.utils.book_append_sheet(wb, ws2, "القيود المحاسبية");

    const fileName = `تقرير_الخزائن_${selectedTreasury ? selectedTreasury.name_ar.replace(/\s+/g, "_") : "مجمع"}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-7xl h-[94vh] rounded-3xl border border-border/80 shadow-2xl flex flex-col overflow-hidden text-right">
        {/* MODAL HEADER */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Printer size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-base tracking-tight">
                  مركز تقارير وسندات الخزائن (منفرد / مجمع / رصيد فترة / قيود مختارة)
                </h3>
                <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-400/30 text-[10px] font-bold">
                  {sortedTxRows.length} حركة بالفترة
                </Badge>
                {selectedRowIds.length > 0 && (
                  <Badge className="bg-amber-500/30 text-amber-200 border-amber-400/40 text-[10px] font-black">
                    تم تحديد {selectedRowIds.length} حركة/قيد للطباعة
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-300 font-semibold mt-0.5">
                طباعة تقرير لكل خزينة لوحدها أو تقرير مجمع، تحديد قيود أو حركات بعينها، وطباعة الرصيد من تاريخ إلى تاريخ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {selectedRowIds.length > 0 && (
              <Button
                size="sm"
                onClick={() =>
                  reportType === "journal"
                    ? handlePrintJournalEntries(true)
                    : handlePrintMovementDocument(true)
                }
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs h-9 px-3.5 rounded-xl flex items-center gap-1.5 shadow-md active:scale-95"
              >
                <Printer size={15} />
                <span>طباعة المحدد فقط ({selectedRowIds.length})</span>
              </Button>
            )}

            <Button
              size="sm"
              onClick={() => handlePrintPeriodBalanceReport()}
              className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs h-9 px-3.5 rounded-xl flex items-center gap-1.5 shadow-md active:scale-95"
              title="طباعة بيان الرصيد الافتتاحي والختامي وصافي التدفق عن الفترة المحددة"
            >
              <Scale size={15} />
              <span>طباعة الرصيد في الفترة</span>
            </Button>

            <Button
              size="sm"
              onClick={() => handlePrintMovementDocument(false)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-3.5 rounded-xl flex items-center gap-1.5 shadow-md active:scale-95"
            >
              <Printer size={15} />
              <span>
                {selectedTreasury ? "طباعة تقرير الخزينة" : "طباعة التقرير المجمع"}
              </span>
            </Button>

            <Button
              size="sm"
              onClick={handleExportExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-3.5 rounded-xl flex items-center gap-1.5 shadow-md active:scale-95"
            >
              <FileSpreadsheet size={15} />
              <span>Excel</span>
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="text-white/70 hover:text-white hover:bg-white/10 rounded-xl h-9 w-9 p-0"
            >
              <X size={18} />
            </Button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 bg-muted/10">
          {/* 1. TOP FILTER CONTROLS BAR */}
          <div className="bg-card border border-border/80 p-4 rounded-2xl shadow-sm space-y-3">
            {/* ROW 1: TREASURY SELECTOR & REPORT TYPE SWITCHER */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
              {/* Treasury Selector (5 cols) */}
              <div className="lg:col-span-5 space-y-1">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building size={13} className="text-indigo-600" />
                    <span>تحديد الخزينة (خزينة منفردة أو تقرير مجمع):</span>
                  </span>
                  {selectedTreasuryId !== "all" && (
                    <button
                      type="button"
                      onClick={() => setSelectedTreasuryId("all")}
                      className="text-[11px] text-indigo-600 hover:underline font-bold"
                    >
                      عرض التقرير المجمع للكل
                    </button>
                  )}
                </label>
                <select
                  value={selectedTreasuryId}
                  onChange={(e) => {
                    setSelectedTreasuryId(e.target.value);
                    setSelectedRowIds([]);
                  }}
                  className="w-full h-9 rounded-xl border border-input bg-background px-3 text-xs font-bold text-right"
                >
                  <option value="all">
                    ⚡ تقرير مجمع لجميع الخزائن والحسابات النشطة ({treasuries.length} خزائن)
                  </option>
                  {treasuries.map((tr) => (
                    <option key={tr.id} value={tr.id}>
                      🔹 تقرير خزينة منفردة: {tr.name_ar} (حساب:{" "}
                      {tr.account_code || (tr.id === "tr-1" ? "13010130" : "13010100")}) —{" "}
                      {tr.currency}
                    </option>
                  ))}
                </select>
              </div>

              {/* Report Type Selector Tabs (7 cols) */}
              <div className="lg:col-span-7 space-y-1">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Layers size={13} className="text-indigo-600" />
                  <span>نوع التقرير والمخرجات (Report Mode):</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 bg-muted/50 p-1 rounded-xl border border-border">
                  <button
                    type="button"
                    onClick={() => setReportType("document")}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-black transition ${
                      reportType === "document"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <FileText size={13} />
                    <span className="truncate">سند الحركة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReportType("combined")}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-black transition ${
                      reportType === "combined"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Wallet size={13} />
                    <span className="truncate">التقرير المجمع والأرصدة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReportType("journal")}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-black transition ${
                      reportType === "journal"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <BookOpen size={13} />
                    <span className="truncate">القيود المحاسبية</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReportType("table")}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-black transition ${
                      reportType === "table"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <TableIcon size={13} />
                    <span className="truncate">جدول الحركات</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReportType("excel")}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-black transition ${
                      reportType === "excel"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <FileSpreadsheet size={13} />
                    <span className="truncate">تصدير Excel</span>
                  </button>
                </div>
              </div>
            </div>

            {/* OPTIONAL MULTI-TREASURY FILTER CHIPS WHEN "ALL" IS SELECTED */}
            {selectedTreasuryId === "all" && treasuries.length > 1 && (
              <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border/50 text-xs">
                <span className="font-black text-muted-foreground">
                  الخزائن المشمولة في التقرير المجمع:
                </span>
                {treasuries.map((tr) => {
                  const isInc = includedTreasuryIds.includes(tr.id);
                  return (
                    <button
                      key={tr.id}
                      type="button"
                      onClick={() => toggleIncludedTreasury(tr.id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition ${
                        isInc
                          ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-700 dark:text-indigo-300"
                          : "bg-muted/40 border-border text-muted-foreground opacity-60"
                      }`}
                    >
                      {isInc ? <CheckSquare size={12} /> : <Square size={12} />}
                      <span>{tr.name_ar}</span>
                      <span className="font-mono text-[10px] opacity-80">
                        ({tr.account_code || "13010"})
                      </span>
                    </button>
                  );
                })}
                {includedTreasuryIds.length < treasuries.length && (
                  <button
                    type="button"
                    onClick={() => setIncludedTreasuryIds(treasuries.map((t) => t.id))}
                    className="text-[11px] text-indigo-600 font-bold hover:underline"
                  >
                    تحديد كل الخزائن
                  </button>
                )}
              </div>
            )}

            {/* ROW 2: QUICK DATE PRESETS & FROM-TO PERIOD INTERVALS */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-2 border-t border-border/50">
              {/* Presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-black text-muted-foreground flex items-center gap-1 ml-1">
                  <CalendarDays size={13} className="text-indigo-600" />
                  الفترة الزمنية:
                </span>
                {[
                  { id: "all", label: "الكل" },
                  { id: "today", label: "اليوم" },
                  { id: "yesterday", label: "الأمس" },
                  { id: "shift", label: "الوردية الحالية" },
                  { id: "last7", label: "آخر 7 أيام" },
                  { id: "thisMonth", label: "هذا الشهر" },
                  { id: "lastMonth", label: "الشهر الماضي" },
                ].map((p) => (
                  <Button
                    key={p.id}
                    size="sm"
                    variant={datePreset === p.id ? "default" : "outline"}
                    onClick={() => applyDatePreset(p.id)}
                    className="h-7 text-[11px] font-bold px-2.5 rounded-lg"
                  >
                    {p.label}
                  </Button>
                ))}
              </div>

              {/* Exact Date & Time Picker + Print Period Balance Button */}
              <div className="flex items-center gap-2 text-xs font-bold flex-wrap">
                <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/70">
                  <span className="text-muted-foreground text-[10px] px-1">من:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setDatePreset("custom");
                    }}
                    className="h-7 rounded-lg border border-input bg-background px-2 text-xs font-mono"
                  />
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => {
                      setStartTime(e.target.value);
                      setDatePreset("custom");
                    }}
                    placeholder="00:00"
                    className="h-7 w-20 rounded-lg border border-input bg-background px-1 text-xs font-mono text-center"
                  />
                </div>

                <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/70">
                  <span className="text-muted-foreground text-[10px] px-1">إلى:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setDatePreset("custom");
                    }}
                    className="h-7 rounded-lg border border-input bg-background px-2 text-xs font-mono"
                  />
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => {
                      setEndTime(e.target.value);
                      setDatePreset("custom");
                    }}
                    placeholder="23:59"
                    className="h-7 w-20 rounded-lg border border-input bg-background px-1 text-xs font-mono text-center"
                  />
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => handlePrintPeriodBalanceReport()}
                  className="h-8 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-[11px] px-3 rounded-xl gap-1.5"
                >
                  <Printer size={13} />
                  <span>طباعة الرصيد (من — إلى)</span>
                </Button>
              </div>
            </div>

            {/* ROW 3: SEARCH, TYPE/CURRENCY FILTERS & ENTRY SELECTION TOOLBAR */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 pt-2 border-t border-border/50">
              <div className="relative flex-1">
                <Search size={14} className="absolute right-3 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="بحث سريع برقم القيد/الحركة، البيان، رقم الفاتورة والمرجع، أو اسم الكاشير..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-8 h-8 text-xs text-right rounded-xl"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={filterTxType}
                  onChange={(e) => setFilterTxType(e.target.value)}
                  className="h-8 rounded-xl border border-input bg-background px-2.5 text-xs font-bold text-right"
                >
                  <option value="all">جميع أنواع الحركات</option>
                  <option value="sales">مبيعات POS</option>
                  <option value="deposit">إيداعات نقدية</option>
                  <option value="withdrawal">سحب ومصروفات</option>
                  <option value="purchase">مشتريات وموردين</option>
                  <option value="transfer_in">تحويلات واردة</option>
                  <option value="transfer_out">تحويلات صادرة</option>
                  <option value="reconciliation">تسويات جرد</option>
                </select>

                <select
                  value={filterCurrency}
                  onChange={(e) => setFilterCurrency(e.target.value)}
                  className="h-8 rounded-xl border border-input bg-background px-2.5 text-xs font-bold text-right"
                >
                  <option value="all">جميع العملات والدفع</option>
                  <option value="cash_EGP">كاش جنيه (EGP)</option>
                  <option value="cash_USD">كاش دولار (USD)</option>
                  <option value="cash_SSP">كاش جنوب سوداني (SSP)</option>
                  <option value="card_USD">فيزا / بطاقة (USD)</option>
                  <option value="wallet_SSP">محفظة إلكترونية (SSP)</option>
                </select>
              </div>
            </div>

            {/* ROW 4: SELECTION CONTROLS FOR SPECIFIC MOVEMENTS / JOURNAL ENTRIES */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50 bg-indigo-500/5 p-2.5 rounded-xl">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="font-black text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                  <CheckSquare size={14} className="text-indigo-600" />
                  اختيار قيود أو حركات محددة للطباعة:
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={selectAllRows}
                  className="h-7 text-[11px] font-bold px-2.5 rounded-lg"
                >
                  تحديد الكل ({sortedTxRows.length})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={selectInflowRowsOnly}
                  className="h-7 text-[11px] font-bold px-2.5 rounded-lg text-emerald-700 border-emerald-300"
                >
                  تحديد المقبوضات / الوارد (+)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={selectOutflowRowsOnly}
                  className="h-7 text-[11px] font-bold px-2.5 rounded-lg text-rose-700 border-rose-300"
                >
                  تحديد المدفوعات / الصادر (-)
                </Button>
                {selectedRowIds.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={clearRowSelection}
                    className="h-7 text-[11px] font-bold px-2.5 rounded-lg text-rose-600"
                  >
                    إلغاء التحديد ({selectedRowIds.length})
                  </Button>
                )}
              </div>

              {selectedRowIds.length > 0 ? (
                <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
                  <span className="bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-lg font-sans font-bold">
                    المحدد: {selectedAggregates.count} حركة | وارد: +
                    {selectedAggregates.inflow.toLocaleString()} | صادر: -
                    {selectedAggregates.outflow.toLocaleString()} | صافي:{" "}
                    {selectedAggregates.net.toLocaleString()}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handlePrintMovementDocument(true)}
                    className="h-7 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] px-3 rounded-lg gap-1"
                  >
                    <Printer size={12} />
                    طباعة الحركات المختارة
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handlePrintJournalEntries(true)}
                    className="h-7 font-bold text-[11px] px-3 rounded-lg gap-1"
                  >
                    <Printer size={12} />
                    طباعة القيود المختارة
                  </Button>
                </div>
              ) : (
                <span className="text-[11px] text-muted-foreground font-semibold">
                  💡 يمكنك وضع علامة (✓) بجانب أي قيد أو حركة في الجدول أدناه لطباعة حركات مختارة فقط
                </span>
              )}
            </div>
          </div>

          {/* 2. FINANCIAL SNAPSHOT KPI CARDS (FOR THE SELECTED PERIOD) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 font-mono">
            <div className="bg-card border border-border p-3 rounded-2xl shadow-sm text-right">
              <span className="text-[10px] text-muted-foreground font-sans font-bold block">
                الرصيد الافتتاحي (بداية الفترة)
              </span>
              <span className="text-base font-black text-slate-800 dark:text-slate-200 mt-1 block">
                {openingBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="bg-card border border-emerald-500/30 p-3 rounded-2xl shadow-sm text-right">
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans font-bold block">
                إجمالي الوارد خلال الفترة (+)
              </span>
              <span className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                +{totalInflow.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="bg-card border border-rose-500/30 p-3 rounded-2xl shadow-sm text-right">
              <span className="text-[10px] text-rose-600 dark:text-rose-400 font-sans font-bold block">
                إجمالي الصادر خلال الفترة (-)
              </span>
              <span className="text-base font-black text-rose-600 dark:text-rose-400 mt-1 block">
                -{totalOutflow.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="bg-card border border-indigo-500/30 p-3 rounded-2xl shadow-sm text-right">
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-sans font-bold block">
                صافي حركة الفترة
              </span>
              <span
                className={`text-base font-black mt-1 block ${netMovement >= 0 ? "text-indigo-600 dark:text-indigo-400" : "text-rose-600"}`}
              >
                {netMovement >= 0 ? "+" : ""}
                {netMovement.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/40 p-3 rounded-2xl shadow-sm text-right">
              <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-sans font-black block">
                الرصيد الختامي (نهاية الفترة)
              </span>
              <span className="text-base font-black text-emerald-700 dark:text-emerald-300 mt-1 block">
                {closingBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="bg-card border border-border p-3 rounded-2xl shadow-sm text-right">
              <span className="text-[10px] text-muted-foreground font-sans font-bold block">
                عدد الحركات (المحدد / الكل)
              </span>
              <span className="text-base font-black text-slate-700 dark:text-slate-300 mt-1 block">
                {selectedRowIds.length > 0
                  ? `${selectedRowIds.length} / ${sortedTxRows.length}`
                  : `${sortedTxRows.length} عملية`}
              </span>
            </div>
          </div>

          {/* 3. MULTI-CURRENCY BREAKDOWN STRIP */}
          <div className="bg-card border border-border/80 px-4 py-2.5 rounded-2xl flex items-center justify-between gap-3 text-xs font-mono flex-wrap">
            <span className="font-sans font-black text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Coins size={14} className="text-amber-500" />
              تفصيل أرصدة العملات المباشرة في نهاية الفترة:
            </span>
            <div className="flex items-center gap-4 flex-wrap text-[11px]">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                نقدي (EGP): {currencyBreakdown.cashEGP.toLocaleString()} EGP
              </span>
              <span>•</span>
              <span className="text-green-600 dark:text-green-400 font-bold">
                نقدي (USD): {currencyBreakdown.cashUSD.toLocaleString()} USD
              </span>
              <span>•</span>
              <span className="text-amber-600 dark:text-amber-400 font-bold">
                نقدي (SSP): {currencyBreakdown.cashSSP.toLocaleString()} SSP
              </span>
              <span>•</span>
              <span className="text-blue-600 dark:text-blue-400 font-bold">
                فيزا (USD): {currencyBreakdown.cardUSD.toLocaleString()} USD
              </span>
              <span>•</span>
              <span className="text-purple-600 dark:text-purple-400 font-bold">
                محفظة (SSP): {currencyBreakdown.walletSSP.toLocaleString()} SSP
              </span>
            </div>
          </div>

          {/* 4. ACTIVE REPORT PREVIEW AREA */}

          {/* TAB OPTION A: COMBINED / PER-TREASURY PERIOD BALANCES REPORT */}
          {reportType === "combined" && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-card p-3 rounded-2xl border border-border text-xs font-bold">
                <div className="flex items-center gap-2">
                  <Wallet size={16} className="text-indigo-600" />
                  <span>
                    كشف أرصدة وحركات الخزائن والبنوك (طباعة كل خزينة لوحدها أو تقرير مجمع للفترة:{" "}
                    {getPeriodLabel()})
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    onClick={() => handlePrintPeriodBalanceReport()}
                    className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs h-8 px-4 rounded-xl flex items-center gap-1.5 shadow-sm"
                  >
                    <Printer size={14} />
                    <span>طباعة التقرير المجمع للأرصدة</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handlePrintMovementDocument(false)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-8 px-4 rounded-xl flex items-center gap-1.5 shadow-sm"
                  >
                    <Printer size={14} />
                    <span>طباعة التقرير المجمع شاملاً الحركات</span>
                  </Button>
                </div>
              </div>

              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right">
                    <thead className="bg-slate-900 text-white font-bold">
                      <tr>
                        <th className="p-3">رقم الحساب الشجري</th>
                        <th className="p-3">اسم الخزينة / البنك</th>
                        <th className="p-3 text-center">النوع</th>
                        <th className="p-3 text-center">العملة</th>
                        <th className="p-3">الأمين / المسؤول</th>
                        <th className="p-3 text-left">الرصيد الافتتاحي (بداية الفترة)</th>
                        <th className="p-3 text-left text-emerald-300">إجمالي الوارد (+)</th>
                        <th className="p-3 text-left text-rose-300">إجمالي الصادر (-)</th>
                        <th className="p-3 text-left">صافي الحركة</th>
                        <th className="p-3 text-left text-amber-300">الرصيد الختامي (نهاية الفترة)</th>
                        <th className="p-3 text-center">الحركات</th>
                        <th className="p-3 text-center">طباعة منفردة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {perTreasuryPeriodSummaries.map((s) => (
                        <tr key={s.id} className="hover:bg-muted/30 transition">
                          <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {s.account_code}
                          </td>
                          <td className="p-3 font-black text-foreground">{s.name_ar}</td>
                          <td className="p-3 text-center">
                            <Badge variant="outline" className="text-[10px]">
                              {s.typeLabel}
                            </Badge>
                          </td>
                          <td className="p-3 text-center font-mono font-bold">{s.currency}</td>
                          <td className="p-3 text-muted-foreground font-semibold">
                            {s.responsible_employee}
                          </td>
                          <td className="p-3 text-left font-mono font-bold">
                            {s.openingBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-left font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            +{s.totalInflow.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-left font-mono font-bold text-rose-600 dark:text-rose-400">
                            -{s.totalOutflow.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-left font-mono font-bold">
                            {s.netMovement >= 0 ? "+" : ""}
                            {s.netMovement.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-left font-mono font-black text-emerald-700 dark:text-emerald-300">
                            {s.closingBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}{" "}
                            {s.currency}
                          </td>
                          <td className="p-3 text-center font-mono font-bold">{s.txCount}</td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handlePrintSingleTreasuryFromRow(s)}
                                className="h-7 px-2.5 text-[11px] font-bold rounded-lg gap-1 border-indigo-300 text-indigo-700 dark:text-indigo-300"
                                title="طباعة تقرير وسند حركة هذه الخزينة لوحدها"
                              >
                                <Printer size={12} />
                                <span>تقرير الخزينة</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handlePrintPeriodBalanceReport(s.treasury)}
                                className="h-7 px-2 text-[11px] font-bold rounded-lg text-cyan-700 dark:text-cyan-300"
                                title="طباعة شهادة رصيد هذه الخزينة عن الفترة"
                              >
                                <Scale size={12} />
                                <span>الرصيد</span>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/80 font-black border-t-2 font-mono text-xs">
                      <tr>
                        <td colSpan={5} className="p-3 font-sans">
                          الإجمالي المجمع للخزائن ({perTreasuryPeriodSummaries.length} خزائن)
                        </td>
                        <td className="p-3 text-left">
                          {openingBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-left text-emerald-600">
                          +{totalInflow.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-left text-rose-600">
                          -{totalOutflow.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-left">
                          {netMovement >= 0 ? "+" : ""}
                          {netMovement.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-left text-emerald-700 dark:text-emerald-300">
                          {closingBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-center">{sortedTxRows.length}</td>
                        <td className="p-3 text-center">-</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB OPTION 1: ACCOUNTING MOVEMENT DOCUMENT PREVIEW */}
          {reportType === "document" && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-card p-3 rounded-2xl border border-border text-xs font-bold">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-indigo-600" />
                  <span>
                    معاينة سند حركة الخزينة الرسمي قبل الطباعة — انقر على المربع بجانب أي حركة لتحديد حركات بعينها
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedRowIds.length > 0 && (
                    <Button
                      size="sm"
                      onClick={() => handlePrintMovementDocument(true)}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs h-8 px-4 rounded-xl flex items-center gap-1.5 shadow-sm"
                    >
                      <Printer size={14} />
                      <span>طباعة الحركات المختارة فقط ({selectedRowIds.length})</span>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => handlePrintMovementDocument(false)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-8 px-4 rounded-xl flex items-center gap-1.5 shadow-sm"
                  >
                    <Printer size={14} />
                    <span>طباعة كامل المستند ({sortedTxRows.length} حركة)</span>
                  </Button>
                </div>
              </div>

              {/* DOCUMENT PAPER MOCKUP */}
              <div className="bg-white text-slate-900 border border-slate-300 rounded-2xl p-6 shadow-md max-w-5xl mx-auto space-y-4 font-sans text-xs">
                {/* Header */}
                <div className="flex items-center justify-between border-b-2 border-indigo-600 pb-3">
                  <div>
                    <h2 className="text-base font-black text-indigo-700">Restocash ERP System</h2>
                    <span className="text-[11px] text-slate-500 font-semibold block">
                      إدارة الخزائن والمقبوضات — فرع: {currentBranch?.name_ar || "الرئيسي"}
                    </span>
                  </div>
                  <div className="text-center">
                    <h3 className="text-sm font-black text-slate-900">
                      {selectedTreasury
                        ? `تقرير وسند حركة خزينة منفردة: ${selectedTreasury.name_ar}`
                        : `تقرير وسند حركة الخزائن المجمع (${activeTreasuries.length} خزائن)`}
                    </h3>
                    <span className="text-xs text-indigo-600 font-bold">{getPeriodLabel()}</span>
                  </div>
                  <div className="text-left text-[11px] text-slate-600 space-y-0.5">
                    <div>
                      <strong>تاريخ الإصدار:</strong> {new Date().toLocaleDateString("ar-EG")}
                    </div>
                    <div>
                      <strong>رقم الحساب:</strong>{" "}
                      {selectedTreasury?.account_code || "13010100 (مجمع)"}
                    </div>
                  </div>
                </div>

                {/* Mini KPI */}
                <div className="grid grid-cols-5 gap-2 text-center text-xs font-mono font-bold">
                  <div className="p-2 border rounded bg-slate-50">
                    <div className="text-[10px] text-slate-500 font-sans">
                      رصيد بداية الفترة
                    </div>
                    <div>{openingBalance.toLocaleString()}</div>
                  </div>
                  <div className="p-2 border rounded bg-emerald-50 text-emerald-700">
                    <div className="text-[10px] text-emerald-600 font-sans">وارد الفترة (+)</div>
                    <div>+{totalInflow.toLocaleString()}</div>
                  </div>
                  <div className="p-2 border rounded bg-rose-50 text-rose-700">
                    <div className="text-[10px] text-rose-600 font-sans">صادر الفترة (-)</div>
                    <div>-{totalOutflow.toLocaleString()}</div>
                  </div>
                  <div className="p-2 border rounded bg-indigo-50 text-indigo-700">
                    <div className="text-[10px] text-indigo-600 font-sans">صافي حركة الفترة</div>
                    <div>
                      {netMovement >= 0 ? "+" : ""}
                      {netMovement.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-2 border rounded bg-emerald-100 text-emerald-800">
                    <div className="text-[10px] text-emerald-800 font-sans">
                      رصيد نهاية الفترة
                    </div>
                    <div>{closingBalance.toLocaleString()}</div>
                  </div>
                </div>

                {/* Table Preview with Selection Checkboxes */}
                <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[370px] overflow-y-auto">
                  <table className="w-full text-[11px] text-right">
                    <thead className="bg-slate-900 text-white font-bold sticky top-0">
                      <tr>
                        <th className="p-2 text-center w-8">
                          <input
                            type="checkbox"
                            checked={
                              sortedTxRows.length > 0 &&
                              selectedRowIds.length === sortedTxRows.length
                            }
                            onChange={(e) =>
                              e.target.checked ? selectAllRows() : clearRowSelection()
                            }
                            className="cursor-pointer accent-indigo-500"
                          />
                        </th>
                        <th className="p-2 text-center w-8">#</th>
                        <th className="p-2">الخزينة</th>
                        <th className="p-2">التاريخ والتوقيت</th>
                        <th className="p-2 text-center">نوع الحركة</th>
                        <th className="p-2">الحساب التحليلي</th>
                        <th className="p-2 text-center">الدفع / العملة</th>
                        <th className="p-2 text-left">الوارد (+)</th>
                        <th className="p-2 text-left">الصادر (-)</th>
                        <th className="p-2 text-left">الرصيد التراكمي</th>
                        <th className="p-2">البيان والملاحظات</th>
                        <th className="p-2 text-center">المسؤول</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {sortedTxRows.length === 0 ? (
                        <tr>
                          <td colSpan={12} className="text-center py-8 text-slate-400 font-bold">
                            لا توجد حركات مسجلة مطابقة للفلاتر أو الفترة المحددة
                          </td>
                        </tr>
                      ) : (
                        sortedTxRows.map((r) => {
                          const isChecked = selectedRowIds.includes(r.id);
                          return (
                            <tr
                              key={r.id}
                              onClick={() => toggleRowSelection(r.id)}
                              className={`cursor-pointer transition ${
                                isChecked ? "bg-indigo-50/90 font-semibold" : "hover:bg-slate-50"
                              }`}
                            >
                              <td
                                className="p-2 text-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleRowSelection(r.id)}
                                  className="cursor-pointer accent-indigo-600"
                                />
                              </td>
                              <td className="p-2 text-center font-bold text-slate-500">
                                {r.index}
                              </td>
                              <td className="p-2 font-bold text-slate-800">{r.treasuryName}</td>
                              <td className="p-2 whitespace-nowrap">{r.date}</td>
                              <td className="p-2 text-center">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 border border-slate-300">
                                  {r.typeLabel}
                                </span>
                              </td>
                              <td className="p-2 text-slate-700">{r.analyticalAccount}</td>
                              <td className="p-2 text-center text-slate-600">
                                {r.paymentMethodLabel} ({r.currency})
                              </td>
                              <td className="p-2 text-left font-mono font-bold text-emerald-700">
                                {r.inflow > 0 ? `+${r.inflow.toLocaleString()}` : "-"}
                              </td>
                              <td className="p-2 text-left font-mono font-bold text-rose-700">
                                {r.outflow > 0 ? `-${r.outflow.toLocaleString()}` : "-"}
                              </td>
                              <td className="p-2 text-left font-mono font-bold text-slate-900">
                                {r.runningBalance.toLocaleString()}
                              </td>
                              <td className="p-2 text-slate-700 truncate max-w-[180px]">
                                {r.note}
                              </td>
                              <td className="p-2 text-center text-slate-600">{r.user}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Signatures Section */}
                <div className="grid grid-cols-4 gap-4 pt-4 border-t border-slate-200 text-center text-[11px] text-slate-600">
                  <div>
                    <span className="font-bold">أمين الصندوق / الكاشير</span>
                    <div className="mt-6 border-t border-dashed border-slate-400 pt-1 text-[10px]">
                      التوقيع والاعتماد
                    </div>
                  </div>
                  <div>
                    <span className="font-bold">إعداد المحاسب المسؤول</span>
                    <div className="mt-6 border-t border-dashed border-slate-400 pt-1 text-[10px]">
                      التوقيع والاعتماد
                    </div>
                  </div>
                  <div>
                    <span className="font-bold">المراجعة والتدقيق</span>
                    <div className="mt-6 border-t border-dashed border-slate-400 pt-1 text-[10px]">
                      التوقيع والاعتماد
                    </div>
                  </div>
                  <div>
                    <span className="font-bold">اعتماد المدير المالي</span>
                    <div className="mt-6 border-t border-dashed border-slate-400 pt-1 text-[10px]">
                      التوقيع والاعتماد
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB OPTION 2: DOUBLE-ENTRY JOURNAL ENTRIES (WITH CHECKBOX SELECTION) */}
          {reportType === "journal" && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-card p-3 rounded-2xl border border-border text-xs font-bold">
                <div className="flex items-center gap-2">
                  <BookOpen size={16} className="text-indigo-600" />
                  <span>
                    دفتر القيود المحاسبية المزدوجة ({journalEntries.length} قيد متوازن دفترياً — يمكنك اختيار قيود محددة للطباعة)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {selectedRowIds.length > 0 && (
                    <Button
                      size="sm"
                      onClick={() => handlePrintJournalEntries(true)}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs h-8 px-4 rounded-xl flex items-center gap-1.5 shadow-sm"
                    >
                      <Printer size={14} />
                      <span>طباعة القيود المختارة ({selectedRowIds.length})</span>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => handlePrintJournalEntries(false)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-8 px-4 rounded-xl flex items-center gap-1.5 shadow-sm"
                  >
                    <Printer size={14} />
                    <span>طباعة كافة القيود ({journalEntries.length})</span>
                  </Button>
                </div>
              </div>

              {journalEntries.length === 0 ? (
                <div className="bg-card border border-border p-12 text-center rounded-2xl text-muted-foreground font-semibold">
                  لا توجد قيود محاسبية مسجلة مطابقة للشروط المحددة
                </div>
              ) : (
                <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                  {journalEntries.map((entry) => {
                    const isChecked = selectedRowIds.includes(entry.id);
                    return (
                      <div
                        key={entry.id}
                        onClick={() => toggleRowSelection(entry.id)}
                        className={`bg-card border rounded-2xl overflow-hidden shadow-sm transition cursor-pointer ${
                          isChecked
                            ? "border-indigo-600 ring-2 ring-indigo-500/20"
                            : "border-border hover:border-indigo-500/40"
                        }`}
                      >
                        <div className="p-3 bg-muted/40 border-b border-border flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleRowSelection(entry.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 cursor-pointer accent-indigo-600"
                            />
                            <span className="font-mono font-black bg-indigo-600 text-white px-2.5 py-0.5 rounded-lg">
                              {entry.voucherNum}
                            </span>
                            <Badge variant="outline" className="text-[10px] font-bold">
                              {entry.treasuryName}
                            </Badge>
                            <span className="font-mono text-muted-foreground">{entry.date}</span>
                            <span className="font-bold text-foreground">{entry.description}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
                              ● متوازن دفترياً
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              مرجع: {entry.reference}
                            </span>
                          </div>
                        </div>

                        <table className="w-full text-xs">
                          <thead className="bg-muted/20 text-muted-foreground border-b border-border/50">
                            <tr>
                              <th className="p-2 text-right font-bold w-16">الطرف</th>
                              <th className="p-2 text-right font-bold w-24">كود الحساب</th>
                              <th className="p-2 text-right font-bold">اسم الحساب المحاسبي</th>
                              <th className="p-2 text-right font-bold w-28">مدين (+)</th>
                              <th className="p-2 text-right font-bold w-28">دائن (-)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40 font-mono">
                            {entry.lines.map((line, lIdx) => (
                              <tr key={lIdx} className="hover:bg-muted/10">
                                <td className="p-2 font-bold">
                                  {line.type === "debit" ? (
                                    <span className="text-emerald-600 dark:text-emerald-400">
                                      مدين
                                    </span>
                                  ) : (
                                    <span className="text-rose-600 dark:text-rose-400">دائن</span>
                                  )}
                                </td>
                                <td className="p-2 font-semibold text-muted-foreground">
                                  {line.accountCode}
                                </td>
                                <td className="p-2 font-sans font-bold text-foreground">
                                  {line.accountName}
                                </td>
                                <td className="p-2 font-black text-emerald-600 dark:text-emerald-400">
                                  {line.debit > 0
                                    ? `${line.debit.toLocaleString()} ${entry.currency}`
                                    : "0.00"}
                                </td>
                                <td className="p-2 font-black text-rose-600 dark:text-rose-400">
                                  {line.credit > 0
                                    ? `${line.credit.toLocaleString()} ${entry.currency}`
                                    : "0.00"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB OPTION 3: MOVEMENTS & TRANSACTIONS TABLE (WITH CHECKBOX SELECTION) */}
          {reportType === "table" && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-card p-3 rounded-2xl border border-border text-xs font-bold">
                <div className="flex items-center gap-2">
                  <TableIcon size={16} className="text-emerald-600" />
                  <span>جدول التفريغ المحاسبي والرصيد التراكمي للحركات</span>
                </div>
                <div className="flex items-center gap-2">
                  {selectedRowIds.length > 0 && (
                    <Button
                      size="sm"
                      onClick={() => handlePrintMovementDocument(true)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-8 px-4 rounded-xl flex items-center gap-1.5 shadow-sm"
                    >
                      <Printer size={14} />
                      <span>طباعة المحدد ({selectedRowIds.length})</span>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={handleExportExcel}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 px-4 rounded-xl flex items-center gap-1.5 shadow-sm"
                  >
                    <FileSpreadsheet size={14} />
                    <span>تصدير إلى Excel</span>
                  </Button>
                </div>
              </div>

              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                <div className="max-h-[450px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0 z-10 text-muted-foreground border-b border-border">
                      <tr>
                        <th className="p-3 text-center w-10">
                          <input
                            type="checkbox"
                            checked={
                              sortedTxRows.length > 0 &&
                              selectedRowIds.length === sortedTxRows.length
                            }
                            onChange={(e) =>
                              e.target.checked ? selectAllRows() : clearRowSelection()
                            }
                            className="cursor-pointer accent-indigo-600"
                          />
                        </th>
                        <th className="p-3 text-right font-bold w-10">#</th>
                        <th className="p-3 text-right font-bold">الخزينة</th>
                        <th className="p-3 text-right font-bold">التاريخ والتوقيت</th>
                        <th className="p-3 text-right font-bold">نوع الحركة</th>
                        <th className="p-3 text-right font-bold">طريقة الدفع والعملة</th>
                        <th className="p-3 text-right font-bold">الحساب التحليلي</th>
                        <th className="p-3 text-right font-bold">الوارد (+)</th>
                        <th className="p-3 text-right font-bold">الصادر (-)</th>
                        <th className="p-3 text-right font-bold">الرصيد التراكمي</th>
                        <th className="p-3 text-right font-bold">البيان / الملاحظات</th>
                        <th className="p-3 text-right font-bold">المرجع</th>
                        <th className="p-3 text-right font-bold">المسؤول</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 font-sans">
                      {sortedTxRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={13}
                            className="text-center py-12 text-muted-foreground font-semibold"
                          >
                            لا توجد حركات مسجلة مطابقة للبحث أو الفترة المحددة
                          </td>
                        </tr>
                      ) : (
                        sortedTxRows.map((r) => {
                          const isChecked = selectedRowIds.includes(r.id);
                          return (
                            <tr
                              key={r.id}
                              onClick={() => toggleRowSelection(r.id)}
                              className={`cursor-pointer transition ${
                                isChecked ? "bg-indigo-500/10" : "hover:bg-muted/30"
                              }`}
                            >
                              <td
                                className="p-3 text-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleRowSelection(r.id)}
                                  className="cursor-pointer accent-indigo-600"
                                />
                              </td>
                              <td className="p-3 font-mono font-bold text-muted-foreground">
                                {r.index}
                              </td>
                              <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                                {r.treasuryName}
                              </td>
                              <td className="p-3 font-mono text-[11px] whitespace-nowrap text-muted-foreground">
                                {r.date}
                              </td>
                              <td className="p-3">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${r.typeColor}`}
                                >
                                  {r.typeLabel}
                                </span>
                              </td>
                              <td className="p-3 font-bold text-slate-700 dark:text-slate-300">
                                {r.paymentMethodLabel} ({r.currency})
                              </td>
                              <td className="p-3 text-muted-foreground font-medium text-[11px]">
                                {r.analyticalAccount}
                              </td>
                              <td className="p-3 font-mono font-black text-emerald-600 dark:text-emerald-400">
                                {r.inflow > 0 ? `+${r.inflow.toLocaleString()} ${r.currency}` : "-"}
                              </td>
                              <td className="p-3 font-mono font-black text-rose-600 dark:text-rose-400">
                                {r.outflow > 0
                                  ? `-${r.outflow.toLocaleString()} ${r.currency}`
                                  : "-"}
                              </td>
                              <td className="p-3 font-mono font-black text-foreground">
                                {r.runningBalance.toLocaleString()} {r.currency}
                              </td>
                              <td className="p-3 text-slate-600 dark:text-slate-300 font-semibold max-w-[180px] truncate">
                                {r.note}
                              </td>
                              <td className="p-3 font-mono text-muted-foreground text-[11px]">
                                {r.reference}
                              </td>
                              <td className="p-3 font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                                {r.user}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB OPTION 4: EXCEL EXPORT WORKBOOK */}
          {reportType === "excel" && (
            <div className="space-y-4 bg-card border border-emerald-500/30 p-8 rounded-2xl text-center max-w-2xl mx-auto shadow-sm animate-in fade-in duration-150">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center mx-auto">
                <FileSpreadsheet size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                  تصدير مصنف إكسل المحاسبي الشامل (Multi-Sheet Workbook)
                </h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  تنزيل ملف إكسل رسمي منسق يحتوي على أوراق العمل: ملخص أرصدة الخزائن المجمع، كشف حركات الخزينة، والقيود المحاسبية المزدوجة.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-muted/40 p-3 rounded-xl text-xs font-bold border border-border">
                <div>
                  <span className="text-muted-foreground text-[10px] block">الحركات المضمنة</span>
                  <span className="text-sm font-black text-emerald-600">
                    {selectedRowIds.length > 0 ? selectedRowIds.length : sortedTxRows.length} حركة
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px] block">القيود المحاسبية</span>
                  <span className="text-sm font-black text-indigo-600">
                    {journalEntries.length} قيد
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px] block">الرصيد الختامي</span>
                  <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                    {closingBalance.toLocaleString()}
                  </span>
                </div>
              </div>

              <Button
                size="lg"
                onClick={handleExportExcel}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm h-11 px-8 rounded-2xl gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 mx-auto"
              >
                <Download size={18} />
                <span>تنزيل ملف الإكسل الآن (.xlsx)</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
