import React, { useState, useRef, useEffect } from "react";
import { Search, X, Check, Landmark, ChevronDown } from "lucide-react";
import { Account, isLevel4Account } from "@/shared/services/erpStore";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const ACCOUNT_TYPE_LABELS: Record<Account["type"], string> = {
  asset: "أصول",
  liability: "التزامات",
  equity: "حقوق ملكية",
  revenue: "إيرادات",
  expense: "مصروفات",
};

const ACCOUNT_TYPE_COLORS: Record<Account["type"], string> = {
  asset: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  liability: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
  equity: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
  revenue: "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300",
  expense: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
};

interface AccountSearchSelectProps {
  value: string;
  onChange: (accountCode: string, account?: Account) => void;
  accounts: Account[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  level4Only?: boolean;
}

export function AccountSearchSelect({
  value,
  onChange,
  accounts,
  placeholder = "اختر الحساب المحاسبي...",
  className = "",
  disabled = false,
  level4Only = false,
}: AccountSearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Base accounts filter: restrict to Level 4 accounts if level4Only is true
  const baseAccounts = React.useMemo(() => {
    if (!level4Only) return accounts;
    return accounts.filter((a) => isLevel4Account(a));
  }, [accounts, level4Only]);

  // Find currently selected account
  const selectedAccount = accounts.find((a) => a.code === value);
  const isSelectedLevel4 = selectedAccount ? isLevel4Account(selectedAccount) : false;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Filter accounts by code, name, type, or level query
  const filteredAccounts = baseAccounts.filter((acc) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const matchCode = acc.code.toLowerCase().includes(q);
    const matchName = acc.name_ar.toLowerCase().includes(q);
    const matchType = (ACCOUNT_TYPE_LABELS[acc.type] || "").toLowerCase().includes(q);
    const matchLevel = (q === "4" || q.includes("رابع")) && isLevel4Account(acc);
    return matchCode || matchName || matchType || matchLevel;
  });

  const handleSelect = (acc: Account) => {
    onChange(acc.code, acc);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setSearchQuery("");
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs md:text-sm rounded-lg border bg-background text-right transition shadow-xs hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        } ${isOpen ? "border-primary ring-2 ring-primary/20" : "border-input"}`}
      >
        {selectedAccount ? (
          <div className="flex items-center gap-2 overflow-hidden text-right flex-1 min-w-0 flex-wrap sm:flex-nowrap">
            <Badge variant="outline" className="font-mono font-bold shrink-0 text-[11px] bg-muted">
              {selectedAccount.code}
            </Badge>
            <span className="font-semibold text-foreground truncate">
              {selectedAccount.name_ar}
            </span>
            <Badge
              className={`shrink-0 text-[10px] px-1.5 py-0 border-0 ${
                ACCOUNT_TYPE_COLORS[selectedAccount.type]
              }`}
            >
              {ACCOUNT_TYPE_LABELS[selectedAccount.type]}
            </Badge>
            {isSelectedLevel4 && (
              <Badge
                variant="outline"
                className="shrink-0 text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800"
              >
                درجة 4 (تشغيلي)
              </Badge>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}

        <div className="flex items-center gap-1 shrink-0">
          {selectedAccount && !disabled && (
            <span
              onClick={handleClear}
              className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition"
              title="مسح الاختيار"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* Floating Dropdown */}
      {isOpen && (
        <div className="absolute z-50 right-0 left-0 mt-1.5 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl overflow-hidden max-h-84 flex flex-col animate-in fade-in-50 zoom-in-95">
          {/* Level 4 Banner if restricted */}
          {level4Only && (
            <div className="bg-primary/10 border-b border-primary/20 px-3 py-1.5 flex items-center justify-between text-[11px] text-primary font-bold">
              <span className="flex items-center gap-1.5">
                <Landmark className="h-3.5 w-3.5" />
                <span>حسابات الدرجة الرابعة فقط (المسموح بالتعامل والقيود عليها)</span>
              </span>
              <Badge variant="outline" className="text-[10px] bg-background border-primary/30">
                حساب فرعي / تشغيلي
              </Badge>
            </div>
          )}

          {/* Search Box */}
          <div className="p-2 border-b bg-muted/40 relative flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0 absolute right-4" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder={
                level4Only
                  ? "ابحث في حسابات الدرجة الرابعة برقم أو اسم الحساب (مثال: 31010110 أجور)..."
                  : "ابحث بالاسم أو برقم الحساب (مثال: 150101)..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-9 pl-8 h-9 text-xs bg-background border-input font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute left-4 p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Account List */}
          <div className="overflow-y-auto p-1 divide-y divide-border/40 max-h-60">
            {filteredAccounts.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                {level4Only
                  ? `لا يوجد حساب من الدرجة الرابعة مطابق للبحث "${searchQuery}"`
                  : `لا يوجد حساب مطابق للبحث "${searchQuery}"`}
              </div>
            ) : (
              filteredAccounts.map((acc) => {
                const isSelected = acc.code === value;
                const currency = acc.name_ar.includes("دولار") ? "USD" : acc.currency || "EGP";
                const isAccLevel4 = isLevel4Account(acc);
                return (
                  <div
                    key={acc.code}
                    onClick={() => handleSelect(acc)}
                    className={`flex items-center justify-between gap-2 p-2.5 rounded-lg cursor-pointer text-xs transition ${
                      isSelected
                        ? "bg-primary/10 text-primary font-bold"
                        : "hover:bg-muted/70 text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <Badge variant="outline" className="font-mono font-bold text-[11px] shrink-0">
                        {acc.code}
                      </Badge>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-semibold text-sm truncate">{acc.name_ar}</span>
                          {isAccLevel4 && (
                            <Badge
                              variant="secondary"
                              className="text-[9px] px-1 py-0 shrink-0 bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-0"
                            >
                              درجة 4
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                          <span className={`px-1 rounded ${ACCOUNT_TYPE_COLORS[acc.type]}`}>
                            {ACCOUNT_TYPE_LABELS[acc.type]}
                          </span>
                          {acc.balance !== undefined && (
                            <span className="font-mono font-medium">
                              الرصيد: {acc.balance.toLocaleString()} {currency}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer stats */}
          <div className="p-2 border-t bg-muted/20 text-[10px] text-muted-foreground flex justify-between items-center px-3">
            <span>
              {level4Only
                ? `حسابات الدرجة الرابعة المتاحة: ${filteredAccounts.length}`
                : `عدد الحسابات المتاحة: ${filteredAccounts.length}`}
            </span>
            <span>البحث الذكي بالرقم أو الاسم</span>
          </div>
        </div>
      )}
    </div>
  );
}
