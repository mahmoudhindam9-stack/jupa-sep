import { useSettings, Currency } from "@/hooks/use-settings";
import { DollarSign, Coins, Globe, ArrowRightLeft, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";

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


function ExchangeRateField({
  code,
  label,
  value,
  onCommit,
  compact = false,
}: {
  code: Currency;
  label: string;
  value: number;
  onCommit: (code: Currency, rate: number) => void;
  compact?: boolean;
}) {
  const [draft, setDraft] = useState(String(value || ""));
  useEffect(() => setDraft(String(value || "")), [value]);

  const commit = () => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed) && parsed > 0) {
      onCommit(code, parsed);
      setDraft(String(parsed));
    } else {
      setDraft(String(value || ""));
    }
  };

  return (
    <label className={compact ? "flex min-w-0 items-center gap-1 text-[10px] font-bold" : "flex items-center gap-1.5 text-[11px] font-bold"}>
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step="any"
        min="0.01"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            commit();
            (event.currentTarget as HTMLInputElement).blur();
          }
        }}
        className={compact
          ? "min-w-0 w-14 h-5 px-1 text-center font-mono font-bold bg-background border border-border rounded text-[10px] focus:ring-1 focus:ring-primary focus:outline-none"
          : "min-w-0 w-16 h-6 px-1.5 text-center font-mono font-bold bg-background border border-input rounded-md text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"}
        aria-label={`معامل التحويل ${code}`}
        title={`معامل تحويل الدولار إلى ${label}`}
      />
    </label>
  );
}

export function CurrencySwitcher({
  pageKey,
  className = "",
  compact = false,
}: CurrencySwitcherProps) {
  const { currency, changeCurrency, exchangeRates, updateExchangeRate } = useSettings(pageKey);
  const [showRatesModal, setShowRatesModal] = useState(false);

  if (compact) {
    return (
      <div data-studio-preserve="currency-switcher" className={`space-y-1.5 ${className}`}>
        <div className="flex items-center gap-1 bg-muted/60 border border-border p-1 rounded-xl">
          {currencies.map((c) => {
            const isActive = currency === c.code;
            return (
              <button
                key={c.code}
                onClick={() => changeCurrency(c.code)}
                title={`عرض هذه الصفحة بـ ${c.labelAr}`}
                className={`px-2 py-1 rounded-lg text-[11px] font-black transition flex items-center gap-1 ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span>{c.flag}</span>
                <span>{c.code}</span>
              </button>
            );
          })}
        </div>
        <div data-studio-preserve="currency-switcher-tools" className="grid grid-cols-2 gap-1.5 bg-muted/40 px-2 py-1.5 rounded-lg border border-border/60">
          <ExchangeRateField code="EGP" label="ج.م" value={exchangeRates.EGP} onCommit={updateExchangeRate} compact />
          <ExchangeRateField code="SSP" label="ج.س.ج" value={exchangeRates.SSP} onCommit={updateExchangeRate} compact />
        </div>
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

      {/* Always-visible exchange-rate controls — protected from accidental visual edits. */}
      <div data-studio-preserve="currency-switcher-tools" className="flex flex-wrap items-center gap-2 bg-muted/60 px-2.5 py-1.5 rounded-xl border border-border/80 text-xs">
        <span className="text-[11px] font-black text-muted-foreground shrink-0">المعامل (1$ =)</span>
        <ExchangeRateField code="EGP" label="ج.م" value={exchangeRates.EGP} onCommit={updateExchangeRate} />
        <ExchangeRateField code="SSP" label="ج.س.ج" value={exchangeRates.SSP} onCommit={updateExchangeRate} />
        <button
          type="button"
          onClick={() => setShowRatesModal(true)}
          className="rounded-lg border border-border/70 px-2 py-1 text-[10px] font-bold text-muted-foreground hover:bg-background hover:text-primary"
          title="فتح نافذة إعدادات أسعار الصرف"
        >
          إعدادات المعامل
        </button>
      </div>

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
