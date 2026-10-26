import { useSettings, Currency } from "@/hooks/use-settings";
import { DollarSign, Coins, Globe, ArrowRightLeft, Settings2 } from "lucide-react";
import { useState } from "react";

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
  const [showRatesModal, setShowRatesModal] = useState(false);

  if (compact) {
    return (
      <div
        data-studio-preserve="currency-switcher"
        className={`inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${className}`}
      >
        <div className="inline-flex items-center gap-0.5 bg-muted/70 border border-border/80 p-0.5 rounded-lg">
          {currencies.map((c) => {
            const isActive = currency === c.code;
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => changeCurrency(c.code)}
                title={`عرض هذه الصفحة بـ ${c.labelAr}`}
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
        {currency !== "USD" && (
          <div
            className="hidden xl:inline-flex items-center gap-1 bg-muted/40 px-2 py-1 rounded-lg border border-border/60 text-[11px] tabular-nums"
            title="سعر الصرف اليومي للتحويل مقابل الدولار"
          >
            <span className="text-muted-foreground font-semibold shrink-0">1$ =</span>
            <input
              type="number"
              step="any"
              value={exchangeRates[currency] || ""}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val > 0) {
                  updateExchangeRate(currency, val);
                }
              }}
              className="w-14 h-5 px-1 text-center font-mono font-bold tabular-nums bg-background border border-border rounded text-[11px] focus:ring-1 focus:ring-primary focus:outline-none"
            />
            <span className="font-bold text-foreground shrink-0">
              {currency === "EGP" ? "ج.م" : "ج.س.ج"}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
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
              onClick={() => changeCurrency(c.code)}
              className={`px-2.5 py-1 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
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

      {/* Inline Exchange Rate Input */}
      {currency !== "USD" ? (
        <div className="flex items-center gap-1.5 bg-muted/60 px-2.5 py-1 rounded-xl border border-border/80 text-xs mr-1 animate-fadeIn">
          <span className="text-[11px] font-bold text-muted-foreground shrink-0">
            سعر الصرف اليومي (1$ =)
          </span>
          <input
            type="number"
            step="any"
            min="0.01"
            value={exchangeRates[currency] || ""}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val) && val > 0) {
                updateExchangeRate(currency, val);
              }
            }}
            className="w-16 h-6 px-1.5 text-center font-mono font-bold bg-background border border-input rounded-md text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
            placeholder="السعر"
            title="أدخل سعر الصرف اليومي للتحويل مقابل الدولار"
          />
          <span className="text-[11px] font-bold text-primary shrink-0">
            {currency === "EGP" ? "ج.م" : "ج.س.ج"}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowRatesModal(!showRatesModal)}
            className="text-[11px] font-bold text-muted-foreground hover:text-primary transition flex items-center gap-1 px-2 py-0.5 rounded-lg bg-muted/40 hover:bg-muted border border-transparent hover:border-border"
            title="تعديل أسعار الصرف اليومية للعملات الأخرى"
          >
            <ArrowRightLeft size={12} className="text-primary" />
            <span>
              أسعار الصرف: 1$ = {exchangeRates.EGP} ج.م | {exchangeRates.SSP} ج.س.ج
            </span>
          </button>
        </div>
      )}

      {showRatesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm space-y-4 shadow-xl text-right animate-scaleIn">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Coins size={16} className="text-primary" />
                تعديل أسعار الصرف اليومية (مقابل 1 دولار)
              </h3>
              <button
                onClick={() => setShowRatesModal(false)}
                className="text-xs text-muted-foreground hover:text-foreground font-bold p-1 rounded-md"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold">🇪🇬 سعر الدولار بالمصري (EGP):</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="any"
                    value={exchangeRates.EGP || ""}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val > 0) updateExchangeRate("EGP", val);
                    }}
                    className="w-20 h-8 px-2 text-center font-mono font-bold bg-background border border-input rounded-md"
                  />
                  <span className="font-bold text-muted-foreground">ج.م</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="font-bold">🇸🇸 سعر الدولار بالجنوب سوداني (SSP):</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="any"
                    value={exchangeRates.SSP || ""}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val > 0) updateExchangeRate("SSP", val);
                    }}
                    className="w-20 h-8 px-2 text-center font-mono font-bold bg-background border border-input rounded-md"
                  />
                  <span className="font-bold text-muted-foreground">ج.س.ج</span>
                </div>
              </div>
            </div>
            <div className="pt-2 border-t border-border flex justify-end">
              <button
                onClick={() => setShowRatesModal(false)}
                className="bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-xl"
              >
                حفظ وإغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
