import { useSettings, Currency } from "@/hooks/use-settings";
import { Coins, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface CurrencySwitcherProps {
  pageKey?: string;
  className?: string;
  compact?: boolean;
}

const currencies: { code: Currency; labelAr: string; symbol: string; flag: string }[] = [
  { code: "EGP", labelAr: "جنيه مصري", symbol: "ج.م", flag: "🇪🇬" },
  { code: "USD", labelAr: "دولار أمريكي", symbol: "$", flag: "🇺🇸" },
  { code: "SSP", labelAr: "جنيه جنوب سوداني", symbol: "ج.س.ج", flag: "🇸🇸" },
];

export function CurrencySwitcher({
  pageKey,
  className = "",
  compact = false,
}: CurrencySwitcherProps) {
  const { currency, changeCurrency, exchangeRates, updateExchangeRate } = useSettings(pageKey);
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [rateTargetCurrency, setRateTargetCurrency] = useState<"EGP" | "SSP">("EGP");
  const [rateDraft, setRateDraft] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCurrencyButtonClick = (clickedCurrency: Currency) => {
    changeCurrency(clickedCurrency);
    const targetRateCurr: "EGP" | "SSP" =
      clickedCurrency === "SSP"
        ? "SSP"
        : clickedCurrency === "EGP"
          ? "EGP"
          : rateTargetCurrency || "EGP";
    setRateTargetCurrency(targetRateCurr);
    setRateDraft(String(exchangeRates[targetRateCurr] ?? ""));
    setIsEditingRate(true);
  };

  useEffect(() => {
    if (isEditingRate && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingRate, rateTargetCurrency]);

  useEffect(() => {
    if (!isEditingRate) return;
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsEditingRate(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isEditingRate]);

  const handleRateInputChange = (value: string) => {
    setRateDraft(value);
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed > 0) {
      updateExchangeRate(rateTargetCurrency, parsed);
    }
  };

  const finishEditingRate = () => {
    const parsed = parseFloat(rateDraft);
    if (!isNaN(parsed) && parsed > 0) {
      updateExchangeRate(rateTargetCurrency, parsed);
    }
    setIsEditingRate(false);
  };

  const handleContainerBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (containerRef.current && !containerRef.current.contains(e.relatedTarget as Node)) {
      finishEditingRate();
    }
  };

  if (compact) {
    return (
      <div
        ref={containerRef}
        onBlur={handleContainerBlur}
        data-studio-preserve="currency-switcher"
        className={`relative inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${className}`}
      >
        <div className="inline-flex items-center gap-0.5 bg-muted/70 border border-border/80 p-0.5 rounded-lg">
          {currencies.map((c) => {
            const isActive = currency === c.code;
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => handleCurrencyButtonClick(c.code)}
                title={`عرض هذه الصفحة بـ ${c.labelAr} وتعديل المعامل`}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                }`}
              >
                <span>{c.code}</span>
              </button>
            );
          })}
        </div>

        {isEditingRate && (
          <div
            className="inline-flex items-center gap-1 bg-card px-2 py-1 rounded-lg border border-primary/50 shadow-sm text-[11px] tabular-nums animate-fadeIn z-50"
            title="أدخل معامل التحويل مقابل الدولار ثم اضغط Enter أو خارج المربع للإغلاق"
          >
            <span className="text-muted-foreground font-bold shrink-0">المعامل (1$ =)</span>
            <input
              ref={inputRef}
              type="number"
              step="any"
              min="0.01"
              value={rateDraft}
              onChange={(e) => handleRateInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") {
                  e.preventDefault();
                  finishEditingRate();
                }
              }}
              className="w-16 h-6 px-1.5 text-center font-mono font-bold tabular-nums bg-background border border-primary/40 rounded text-[11px] text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
              placeholder="المعامل"
            />
            {currency === "USD" ? (
              <button
                type="button"
                onClick={() => {
                  const next = rateTargetCurrency === "EGP" ? "SSP" : "EGP";
                  setRateTargetCurrency(next);
                  setRateDraft(String(exchangeRates[next] ?? ""));
                }}
                className="font-bold text-primary hover:underline px-1 shrink-0 cursor-pointer"
                title="التبديل بين معامل الجنيه المصري والجنيه الجنوب سوداني"
              >
                {rateTargetCurrency === "EGP" ? "ج.م" : "ج.س.ج"}
              </button>
            ) : (
              <span className="font-bold text-primary shrink-0">
                {rateTargetCurrency === "EGP" ? "ج.م" : "ج.س.ج"}
              </span>
            )}
            <button
              type="button"
              onClick={finishEditingRate}
              className="inline-flex items-center justify-center h-5 w-5 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer shrink-0"
              title="حفظ وإخفاء مربع المعامل"
            >
              <Check size={11} />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onBlur={handleContainerBlur}
      data-studio-preserve="currency-switcher"
      className={`flex flex-wrap items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-2xl shadow-sm ${className}`}
    >
      <div className="flex items-center gap-1.5 text-xs font-black text-muted-foreground shrink-0">
        <Coins size={14} className="text-primary" />
        <span className="hidden sm:inline">عملة العرض:</span>
      </div>

      <div className="flex items-center gap-1">
        {currencies.map((c) => {
          const isActive = currency === c.code;
          return (
            <button
              key={c.code}
              type="button"
              onClick={() => handleCurrencyButtonClick(c.code)}
              className={`px-2.5 py-1 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm scale-105"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span>{c.flag}</span>
              <span>{c.symbol}</span>
            </button>
          );
        })}
      </div>

      {isEditingRate && (
        <div className="flex items-center gap-1.5 bg-muted/60 px-2.5 py-1 rounded-xl border border-primary/50 text-xs mr-1 animate-fadeIn">
          <span className="text-[11px] font-bold text-muted-foreground shrink-0">
            المعامل (1$ =)
          </span>
          <input
            ref={inputRef}
            type="number"
            step="any"
            min="0.01"
            value={rateDraft}
            onChange={(e) => handleRateInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") {
                e.preventDefault();
                finishEditingRate();
              }
            }}
            className="w-16 h-6 px-1.5 text-center font-mono font-bold bg-background border border-input rounded-md text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
            placeholder="السعر"
            title="أدخل سعر الصرف اليومي للتحويل مقابل الدولار"
          />
          <span className="text-[11px] font-bold text-primary shrink-0">
            {rateTargetCurrency === "EGP" ? "ج.م" : "ج.س.ج"}
          </span>
          <button
            type="button"
            onClick={finishEditingRate}
            className="inline-flex items-center justify-center h-5 w-5 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer shrink-0"
            title="حفظ وإخفاء مربع المعامل"
          >
            <Check size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
