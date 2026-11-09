import React, { useState, useMemo, useEffect } from "react";
import { ORACLE_MIGRATION_ACCOUNTS } from "@/shared/data/oracleAccounts";
import { erpStore } from "@/shared/services/erpStore";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search,
  ChevronLeft,
  Layers,
  FolderTree,
  FileSpreadsheet,
  DollarSign,
  FolderOpen,
  FileText,
  TrendingUp,
  TrendingDown,
  Scale,
  Plus,
  Edit3,
  Trash2,
} from "lucide-react";

interface OracleAccountsViewerProps {
  onAddAccount?: (preset: { level: number; parent_code: string; type: string }) => void;
  onEditAccount?: (acc: any) => void;
  onDeleteAccount?: (acc: any) => void;
}

export function OracleAccountsViewer({
  onAddAccount,
  onEditAccount,
  onDeleteAccount,
}: OracleAccountsViewerProps = {}) {
  const [erpState, setErpState] = useState(() => erpStore.getState());
  const [selectedL1, setSelectedL1] = useState<string | null>("1");
  const [selectedL2, setSelectedL2] = useState<string | null>("130");
  const [selectedL3, setSelectedL3] = useState<string | null>("13010");
  const [selectedL4, setSelectedL4] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const unsubscribe = erpStore.subscribe(() => {
      setErpState({ ...erpStore.getState() });
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Merge live ERP accounts with Oracle baseline accounts so new/edited/deleted accounts and auto-created supplier accounts appear immediately
  const allAccounts = useMemo(() => {
    const liveAccounts = erpState.accounts || [];
    const liveMap = new Map<string, any>();
    liveAccounts.forEach((acc) => {
      if (acc && acc.code) {
        liveMap.set(String(acc.code).trim(), acc);
      }
    });

    const merged: any[] = [];
    const seenCodes = new Set<string>();

    // First include all live accounts from erpStore
    liveAccounts.forEach((acc) => {
      const code = String(acc.code || "").trim();
      if (!code || seenCodes.has(code)) return;
      seenCodes.add(code);
      const oracleFallback = ORACLE_MIGRATION_ACCOUNTS.find((o) => o.code === code);
      merged.push({
        ...oracleFallback,
        ...acc,
        code,
        name_ar: acc.name_ar || oracleFallback?.name_ar || code,
        name_en: acc.name_en || (oracleFallback as any)?.name_en || "",
        level:
          Number(acc.level) ||
          oracleFallback?.level ||
          (code.length <= 1 ? 1 : code.length <= 3 ? 2 : code.length <= 5 ? 3 : 4),
        parent_code:
          acc.parent_code ??
          oracleFallback?.parent_code ??
          (code.length > 5
            ? code.slice(0, 5)
            : code.length > 3
              ? code.slice(0, 3)
              : code.length > 1
                ? code.slice(0, 1)
                : undefined),
        initial_balance: Number(
          acc.balance ?? acc.initial_balance ?? (oracleFallback as any)?.initial_balance ?? 0,
        ),
        balance: Number(
          acc.balance ?? acc.initial_balance ?? (oracleFallback as any)?.initial_balance ?? 0,
        ),
      });
    });

    // Include any Oracle accounts that aren't in liveMap yet (unless deleted by user when liveAccounts has been initialized)
    ORACLE_MIGRATION_ACCOUNTS.forEach((oracleAcc) => {
      const code = String(oracleAcc.code || "").trim();
      if (!code || seenCodes.has(code)) return;
      // Only include static fallback if liveAccounts doesn't already have the full tree
      if (liveAccounts.length < 20) {
        seenCodes.add(code);
        merged.push({
          ...oracleAcc,
          balance: Number((oracleAcc as any).initial_balance || 0),
        });
      }
    });

    return merged.sort((a, b) => String(a.code).localeCompare(String(b.code)));
  }, [erpState.accounts]);

  // Filter accounts by level
  const level1Accounts = useMemo(() => allAccounts.filter((a) => Number(a.level) === 1), [allAccounts]);

  const level2Accounts = useMemo(() => {
    if (!selectedL1) return [];
    return allAccounts.filter(
      (a) =>
        Number(a.level) === 2 &&
        (a.parent_code === selectedL1 || (!a.parent_code && a.code.startsWith(selectedL1))),
    );
  }, [allAccounts, selectedL1]);

  const level3Accounts = useMemo(() => {
    if (!selectedL2) return [];
    return allAccounts.filter(
      (a) =>
        Number(a.level) === 3 &&
        (a.parent_code === selectedL2 || (!a.parent_code && a.code.startsWith(selectedL2))),
    );
  }, [allAccounts, selectedL2]);

  const level4Accounts = useMemo(() => {
    if (!selectedL3) return [];
    return allAccounts.filter(
      (a) =>
        Number(a.level) === 4 &&
        (a.parent_code === selectedL3 || (!a.parent_code && a.code.startsWith(selectedL3))),
    );
  }, [allAccounts, selectedL3]);

  // Global search across all levels
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allAccounts.filter(
      (a) =>
        a.code.toLowerCase().includes(q) ||
        a.name_ar.toLowerCase().includes(q) ||
        (a.name_en && a.name_en.toLowerCase().includes(q)),
    );
  }, [allAccounts, searchQuery]);

  // Selected Account Details
  const activeAccountDetails = useMemo(() => {
    const code = selectedL4 || selectedL3 || selectedL2 || selectedL1;
    if (!code) return null;
    return allAccounts.find((a) => a.code === code) || null;
  }, [allAccounts, selectedL1, selectedL2, selectedL3, selectedL4]);

  const getChildrenCount = (parentCode: string) => {
    return allAccounts.filter((a) => a.parent_code === parentCode).length;
  };

  const getSubtreeBalance = (rootCode: string) => {
    const directAcc = allAccounts.find((a) => a.code === rootCode);
    const leafAccounts = allAccounts.filter(
      (a) => Number(a.level) === 4 && (a.code === rootCode || a.code.startsWith(rootCode) || a.parent_code === rootCode),
    );
    if (leafAccounts.length > 0) {
      return leafAccounts.reduce(
        (sum, a) => sum + Number(a.balance ?? a.initial_balance ?? 0),
        0,
      );
    }
    return Number(directAcc?.balance ?? directAcc?.initial_balance ?? 0);
  };

  const handleSelectSearchResult = (acc: any) => {
    setSearchQuery("");
    if (acc.level === 1) {
      setSelectedL1(acc.code);
      setSelectedL2(null);
      setSelectedL3(null);
      setSelectedL4(null);
    } else if (acc.level === 2) {
      setSelectedL1(acc.parent_code || acc.code.slice(0, 1));
      setSelectedL2(acc.code);
      setSelectedL3(null);
      setSelectedL4(null);
    } else if (acc.level === 3) {
      const l2 = allAccounts.find((a) => a.code === acc.parent_code);
      setSelectedL1(l2?.parent_code || acc.code.slice(0, 1));
      setSelectedL2(acc.parent_code || acc.code.slice(0, 3));
      setSelectedL3(acc.code);
      setSelectedL4(null);
    } else if (acc.level === 4) {
      const l3 = allAccounts.find((a) => a.code === acc.parent_code);
      const l2 = allAccounts.find((a) => a.code === l3?.parent_code);
      setSelectedL1(l2?.parent_code || acc.code.slice(0, 1));
      setSelectedL2(l3?.parent_code || acc.code.slice(0, 3));
      setSelectedL3(acc.parent_code || acc.code.slice(0, 5));
      setSelectedL4(acc.code);
    }
  };

  const getTypeBadge = (type: string) => {
    const map: Record<string, { label: string; color: string }> = {
      asset: { label: "أصول (Assets)", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
      liability: { label: "خصوم / مطاليب", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
      equity: { label: "حقوق ملكية", color: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
      revenue: { label: "إيرادات", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
      expense: { label: "مصروفات", color: "bg-rose-500/10 text-rose-500 border-rose-500/20" },
    };
    const item = map[type] || { label: type, color: "bg-gray-500/10 text-gray-400" };
    return <Badge variant="outline" className={`${item.color} text-[10px]`}>{item.label}</Badge>;
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Clean Search Bar */}
      <div className="bg-card border border-border rounded-2xl p-3.5 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 absolute right-3.5 top-3 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث برقم الحساب أو الاسم (مثال: 24010، الموردون، خزينة، مبيعات...)"
            className="pr-10 h-10 rounded-xl text-xs"
          />
          {searchResults.length > 0 && (
            <div className="absolute z-50 w-full mt-2 bg-card border border-border rounded-xl shadow-2xl max-h-72 overflow-y-auto divide-y divide-border">
              {searchResults.map((acc) => (
                <div
                  key={acc.code}
                  onClick={() => handleSelectSearchResult(acc)}
                  className="w-full text-right px-4 py-2.5 hover:bg-primary/10 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {acc.code}
                    </Badge>
                    <div>
                      <div className="font-bold text-sm text-foreground">{acc.name_ar}</div>
                      {acc.name_en && <div className="text-[11px] text-muted-foreground">{acc.name_en}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      مستوى {acc.level}
                    </Badge>
                    {onEditAccount && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSearchQuery("");
                          onEditAccount(acc);
                        }}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 4 Columns Miller View */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* LEVEL 1 COLUMN */}
        <Card className="bg-slate-950/70 border-slate-800 flex flex-col h-[520px] overflow-hidden rounded-2xl">
          <div className="p-3.5 bg-indigo-950/50 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-black text-xs">
                1
              </span>
              <div>
                <h3 className="font-bold text-sm text-white">المستوى الأول (الرئيسي)</h3>
                <p className="text-[10px] text-slate-400">الأبواب المحاسبية الكبرى</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-indigo-400 border-indigo-500/30">
                {level1Accounts.length}
              </Badge>
              {onAddAccount && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px] bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg gap-1"
                  onClick={() => onAddAccount({ level: 1, parent_code: "", type: "asset" })}
                  title="إضافة حساب مستوى 1 رئيسي"
                >
                  <Plus className="w-3.5 h-3.5" />
                  إضافة
                </Button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {level1Accounts.map((acc) => {
              const isSelected = selectedL1 === acc.code;
              const childrenCount = getChildrenCount(acc.code);
              const totalBal = getSubtreeBalance(acc.code);
              return (
                <button
                  key={acc.code}
                  onClick={() => {
                    setSelectedL1(acc.code);
                    const firstL2 = allAccounts.find(
                      (a) => Number(a.level) === 2 && a.parent_code === acc.code,
                    );
                    setSelectedL2(firstL2 ? firstL2.code : null);
                    setSelectedL3(null);
                    setSelectedL4(null);
                  }}
                  className={`w-full text-right p-3 rounded-xl border transition-all flex flex-col gap-1.5 ${
                    isSelected
                      ? "bg-indigo-600/20 border-indigo-500 text-white shadow-lg"
                      : "bg-slate-900/50 border-slate-800/80 text-slate-300 hover:bg-slate-900 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                      {acc.code}
                    </span>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                      <span>{childrenCount} فرع</span>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="font-bold text-sm">{acc.name_ar}</div>
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/60 mt-1">
                    <span className="text-slate-400">{acc.name_en || ""}</span>
                    <span className="font-mono text-emerald-400 font-bold" dir="ltr">
                      {totalBal.toLocaleString()}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* LEVEL 2 COLUMN */}
        <Card className="bg-slate-950/70 border-slate-800 flex flex-col h-[520px] overflow-hidden rounded-2xl">
          <div className="p-3.5 bg-blue-950/50 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-black text-xs">
                2
              </span>
              <div>
                <h3 className="font-bold text-sm text-white">المستوى الثاني (العام)</h3>
                <p className="text-[10px] text-slate-400">
                  {selectedL1 ? `يتبع الكود الرئيسي (${selectedL1})` : "اختر من المستوى 1"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-blue-400 border-blue-500/30">
                {level2Accounts.length}
              </Badge>
              {onAddAccount && selectedL1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px] bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg gap-1"
                  onClick={() => {
                    const parentAcc = allAccounts.find((a) => a.code === selectedL1);
                    onAddAccount({
                      level: 2,
                      parent_code: selectedL1,
                      type: parentAcc?.type || "asset",
                    });
                  }}
                  title="إضافة حساب مستوى 2 تحت الحساب الرئيسي المختار"
                >
                  <Plus className="w-3.5 h-3.5" />
                  إضافة
                </Button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {level2Accounts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs text-center p-4 gap-2">
                <FolderOpen className="w-8 h-8 opacity-30" />
                <span>لا توجد حسابات مستوى 2 تحت هذا البند</span>
              </div>
            ) : (
              level2Accounts.map((acc) => {
                const isSelected = selectedL2 === acc.code;
                const childrenCount = getChildrenCount(acc.code);
                const totalBal = getSubtreeBalance(acc.code);
                return (
                  <button
                    key={acc.code}
                    onClick={() => {
                      setSelectedL2(acc.code);
                      const firstL3 = allAccounts.find(
                        (a) => Number(a.level) === 3 && a.parent_code === acc.code,
                      );
                      setSelectedL3(firstL3 ? firstL3.code : null);
                      setSelectedL4(null);
                    }}
                    className={`w-full text-right p-3 rounded-xl border transition-all flex flex-col gap-1.5 ${
                      isSelected
                        ? "bg-blue-600/20 border-blue-500 text-white shadow-lg"
                        : "bg-slate-900/50 border-slate-800/80 text-slate-300 hover:bg-slate-900 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                        {acc.code}
                      </span>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <span>{childrenCount} فرعي</span>
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="font-bold text-sm">{acc.name_ar}</div>
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/60 mt-1">
                      <span className="text-slate-400 truncate max-w-[110px]">{acc.name_en || ""}</span>
                      <span className="font-mono text-emerald-400 font-bold" dir="ltr">
                        {totalBal.toLocaleString()}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        {/* LEVEL 3 COLUMN */}
        <Card className="bg-slate-950/70 border-slate-800 flex flex-col h-[520px] overflow-hidden rounded-2xl">
          <div className="p-3.5 bg-emerald-950/50 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-xs">
                3
              </span>
              <div>
                <h3 className="font-bold text-sm text-white">المستوى الثالث (الفرعي)</h3>
                <p className="text-[10px] text-slate-400">
                  {selectedL2 ? `يتبع الكود العام (${selectedL2})` : "اختر من المستوى 2"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
                {level3Accounts.length}
              </Badge>
              {onAddAccount && selectedL2 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg gap-1"
                  onClick={() => {
                    const parentAcc = allAccounts.find((a) => a.code === selectedL2);
                    onAddAccount({
                      level: 3,
                      parent_code: selectedL2,
                      type: parentAcc?.type || "asset",
                    });
                  }}
                  title="إضافة حساب مستوى 3 تحت الحساب العام المختار"
                >
                  <Plus className="w-3.5 h-3.5" />
                  إضافة
                </Button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {level3Accounts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs text-center p-4 gap-2">
                <Layers className="w-8 h-8 opacity-30" />
                <span>اختر حساباً من المستوى 2 لعرض الحسابات الفرعية</span>
              </div>
            ) : (
              level3Accounts.map((acc) => {
                const isSelected = selectedL3 === acc.code;
                const childrenCount = getChildrenCount(acc.code);
                const totalBal = getSubtreeBalance(acc.code);
                return (
                  <button
                    key={acc.code}
                    onClick={() => {
                      setSelectedL3(acc.code);
                      setSelectedL4(null);
                    }}
                    className={`w-full text-right p-3 rounded-xl border transition-all flex flex-col gap-1.5 ${
                      isSelected
                        ? "bg-emerald-600/20 border-emerald-500 text-white shadow-lg"
                        : "bg-slate-900/50 border-slate-800/80 text-slate-300 hover:bg-slate-900 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                        {acc.code}
                      </span>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <span>{childrenCount} تحليلي</span>
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="font-bold text-sm">{acc.name_ar}</div>
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/60 mt-1">
                      <span className="text-slate-400 truncate max-w-[110px]">{acc.name_en || ""}</span>
                      <span className="font-mono text-emerald-400 font-bold" dir="ltr">
                        {totalBal.toLocaleString()}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        {/* LEVEL 4 COLUMN (ANALYTICAL LEAF ACCOUNTS) */}
        <Card className="bg-slate-950/70 border-slate-800 flex flex-col h-[520px] overflow-hidden rounded-2xl">
          <div className="p-3.5 bg-amber-950/50 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-black text-xs">
                4
              </span>
              <div>
                <h3 className="font-bold text-sm text-white">المستوى الرابع (التحليلي)</h3>
                <p className="text-[10px] text-slate-400">
                  {selectedL3 ? `الحسابات النهائية لـ (${selectedL3})` : "اختر من المستوى 3"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-amber-400 border-amber-500/30">
                {level4Accounts.length}
              </Badge>
              {onAddAccount && selectedL3 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg gap-1"
                  onClick={() => {
                    const parentAcc = allAccounts.find((a) => a.code === selectedL3);
                    onAddAccount({
                      level: 4,
                      parent_code: selectedL3,
                      type: parentAcc?.type || "asset",
                    });
                  }}
                  title="إضافة حساب تحليلي مستوى 4 تحت الحساب الفرعي المختار"
                >
                  <Plus className="w-3.5 h-3.5" />
                  إضافة
                </Button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {level4Accounts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs text-center p-4 gap-2">
                <FileText className="w-8 h-8 opacity-30" />
                <span>اختر حساباً من المستوى 3 لعرض الحسابات التحليلية (8 أرقام)</span>
              </div>
            ) : (
              level4Accounts.map((acc) => {
                const isSelected = selectedL4 === acc.code;
                const bal = Number(acc.balance ?? acc.initial_balance ?? 0);
                return (
                  <button
                    key={acc.code}
                    onClick={() => setSelectedL4(acc.code)}
                    className={`w-full text-right p-3 rounded-xl border transition-all flex flex-col gap-1.5 ${
                      isSelected
                        ? "bg-amber-600/20 border-amber-500 text-white shadow-lg"
                        : "bg-slate-900/50 border-slate-800/80 text-slate-300 hover:bg-slate-900 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                        {acc.code}
                      </span>
                      <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-300">
                        {acc.currency || "USD"}
                      </Badge>
                    </div>
                    <div className="font-bold text-sm">{acc.name_ar}</div>
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/60 mt-1">
                      <span className="text-slate-400">الرصيد الحالي:</span>
                      <span
                        className={`font-mono font-bold ${
                          bal > 0 ? "text-emerald-400" : bal < 0 ? "text-rose-400" : "text-slate-400"
                        }`}
                        dir="ltr"
                      >
                        {bal.toLocaleString()}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {/* Selected Account Details Card */}
      {activeAccountDetails && (
        <Card className="bg-slate-900/90 border-indigo-500/30 p-5 rounded-2xl shadow-xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-indigo-600 text-white font-mono text-sm px-3 py-0.5">
                  {activeAccountDetails.code}
                </Badge>
                <Badge variant="outline" className="border-indigo-400/40 text-indigo-300">
                  المستوى الشجري {activeAccountDetails.level}
                </Badge>
                {getTypeBadge(activeAccountDetails.type)}
                {activeAccountDetails.parent_code && (
                  <Badge variant="secondary" className="bg-slate-800 text-slate-300 font-mono text-xs">
                    الحساب الأب: {activeAccountDetails.parent_code}
                  </Badge>
                )}
              </div>
              <h3 className="text-xl font-black text-white">{activeAccountDetails.name_ar}</h3>
              {activeAccountDetails.name_en && (
                <p className="text-xs text-slate-400 font-mono">{activeAccountDetails.name_en}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {Number(activeAccountDetails.level) < 4 && onAddAccount && (
                <Button
                  size="sm"
                  onClick={() =>
                    onAddAccount({
                      level: Number(activeAccountDetails.level) + 1,
                      parent_code: activeAccountDetails.code,
                      type: activeAccountDetails.type || "asset",
                    })
                  }
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  إضافة حساب فرعي (مستوى {Number(activeAccountDetails.level) + 1}) تحت هذا الحساب
                </Button>
              )}
              {onEditAccount && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEditAccount(activeAccountDetails)}
                  className="border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 font-bold rounded-xl gap-1.5"
                >
                  <Edit3 className="w-4 h-4" />
                  تعديل الحساب
                </Button>
              )}
              {onDeleteAccount && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDeleteAccount(activeAccountDetails)}
                  className="border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-bold rounded-xl gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  حذف الحساب
                </Button>
              )}

              <div className="bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl text-left">
                <div className="text-[11px] text-slate-400">إجمالي رصيد الحساب / البند</div>
                <div className="text-xl font-black font-mono text-emerald-400" dir="ltr">
                  {getSubtreeBalance(activeAccountDetails.code).toLocaleString()}{" "}
                  <span className="text-xs text-slate-400">
                    {activeAccountDetails.currency || "USD"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
