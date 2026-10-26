import { useSettings, Language } from "@/hooks/use-settings";
import { Globe, Check } from "lucide-react";
import { translator } from "@/shared/services/translationService";
import { useEffect, useState } from "react";

interface LanguageSwitcherProps {
  className?: string;
  compact?: boolean;
}

export function LanguageSwitcher({ className = "", compact = false }: LanguageSwitcherProps) {
  const { lang, changeLang } = useSettings();
  const [currentLang, setCurrentLang] = useState<Language>(lang || "ar");

  useEffect(() => {
    setCurrentLang(lang || "ar");
  }, [lang]);

  const handleSwitch = (newLang: Language) => {
    setCurrentLang(newLang);
    changeLang(newLang);
    translator.setLanguage(newLang);
  };

  if (compact) {
    return (
      <div className={`inline-flex items-center whitespace-nowrap shrink-0 ${className}`}>
        <div className="inline-flex items-center gap-0.5 bg-muted/70 border border-border/80 p-0.5 rounded-lg">
          <button
            type="button"
            onClick={() => handleSwitch("ar")}
            title="اللغة العربية (Arabic)"
            className={`py-1 px-2 rounded-md text-[11px] font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
              currentLang === "ar"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
            }`}
          >
            <span>عربي</span>
          </button>
          <button
            type="button"
            onClick={() => handleSwitch("en")}
            title="English Language"
            className={`py-1 px-2 rounded-md text-[11px] font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
              currentLang === "en"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
            }`}
          >
            <span>EN</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-1.5 bg-card border border-border px-2.5 py-1 rounded-2xl shadow-xs ${className}`}
    >
      <Globe size={14} className="text-primary shrink-0" />
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => handleSwitch("ar")}
          className={`px-2 py-0.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer ${
            currentLang === "ar"
              ? "bg-primary text-primary-foreground shadow-xs scale-105"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
          title="التحويل إلى اللغة العربية"
        >
          <span>🇸🇦</span>
          <span>العربية</span>
          {currentLang === "ar" && <Check size={11} className="mr-0.5" />}
        </button>
        <button
          type="button"
          onClick={() => handleSwitch("en")}
          className={`px-2 py-0.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer ${
            currentLang === "en"
              ? "bg-primary text-primary-foreground shadow-xs scale-105"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
          title="Switch to English"
        >
          <span>🇬🇧</span>
          <span>English</span>
          {currentLang === "en" && <Check size={11} className="mr-0.5" />}
        </button>
      </div>
    </div>
  );
}
