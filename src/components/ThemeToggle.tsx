import React, { useEffect, useState } from "react";
import { Check, Moon, Palette, Sparkles, Sun, Eye, Crown, Gem } from "lucide-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useSettings } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";

export type AppThemeId =
  | "pearl-4k"
  | "eye-care"
  | "crystal-blue"
  | "obsidian-4k"
  | "midnight-pro"
  | "luxury-gold";

export interface ThemeOption {
  id: AppThemeId;
  isDark: boolean;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  bgPreview: string;
  cardPreview: string;
  accentPreview: string;
  icon: any;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "pearl-4k",
    isDark: false,
    nameAr: "لؤلؤي نقي 4K",
    nameEn: "Pure Pearl 4K",
    descAr: "نهاري واضح بتباين مريح للعين",
    descEn: "Crisp daylight with balanced contrast",
    bgPreview: "#f1f5f9",
    cardPreview: "#ffffff",
    accentPreview: "#047857",
    icon: Sun,
  },
  {
    id: "eye-care",
    isDark: false,
    nameAr: "راحة العين الدافئ 4K",
    nameEn: "Warm Eye-Care 4K",
    descAr: "فلتر دافئ بدون أشعة زرقاء للعمل الطويل",
    descEn: "Zero blue-light warm paper for long shifts",
    bgPreview: "#f2efe9",
    cardPreview: "#faf8f5",
    accentPreview: "#0f766e",
    icon: Eye,
  },
  {
    id: "crystal-blue",
    isDark: false,
    nameAr: "كريستال بنكي 4K",
    nameEn: "Crystal Sapphire 4K",
    descAr: "مظهر مصرفي أزرق فائق الوضوح",
    descEn: "High-precision financial sapphire look",
    bgPreview: "#eef3f9",
    cardPreview: "#ffffff",
    accentPreview: "#1d4ed8",
    icon: Gem,
  },
  {
    id: "obsidian-4k",
    isDark: true,
    nameAr: "ليلي أوبسيديان 4K",
    nameEn: "Obsidian OLED 4K",
    descAr: "وضع ليلي داكن مع زمردي مضيء",
    descEn: "Deep carbon dark with luminous emerald",
    bgPreview: "#0b0f17",
    cardPreview: "#131b28",
    accentPreview: "#10b981",
    icon: Moon,
  },
  {
    id: "midnight-pro",
    isDark: true,
    nameAr: "كحلي ملكي ليلي 4K",
    nameEn: "Midnight Royal 4K",
    descAr: "كحلي عميق مع إضاءة سماوية هادئة",
    descEn: "Abyssal navy with calm sky-blue glow",
    bgPreview: "#071122",
    cardPreview: "#0e1d36",
    accentPreview: "#38bdf8",
    icon: Sparkles,
  },
  {
    id: "luxury-gold",
    isDark: true,
    nameAr: "جرافيت ذهبي فاخر 4K",
    nameEn: "Graphite & Gold 4K",
    descAr: "تيتانيوم داكن مع لمسات ذهبية فاخرة",
    descEn: "VIP titanium carbon with imperial gold",
    bgPreview: "#101114",
    cardPreview: "#181a1f",
    accentPreview: "#f59e0b",
    icon: Crown,
  },
];

export function applyThemeToDom(themeId: AppThemeId) {
  if (typeof document === "undefined") return;
  const option = THEME_OPTIONS.find((t) => t.id === themeId) || THEME_OPTIONS[0];
  const root = document.documentElement;
  root.setAttribute("data-theme", option.id);
  if (option.isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  try {
    localStorage.setItem("restocash-theme", option.id);
  } catch {
    // ignore storage errors
  }
}

export function resolveInitialTheme(): AppThemeId {
  if (typeof window === "undefined") return "pearl-4k";
  try {
    const stored = localStorage.getItem("restocash-theme");
    if (stored === "dark") return "obsidian-4k";
    if (stored === "light") return "pearl-4k";
    if (stored && THEME_OPTIONS.some((t) => t.id === stored)) {
      return stored as AppThemeId;
    }
  } catch {
    // ignore
  }
  return document.documentElement.classList.contains("dark") ? "obsidian-4k" : "pearl-4k";
}

export function ThemeToggle({ className }: { className?: string }) {
  const { lang } = useSettings();
  const isEn = lang === "en";
  const [themeId, setThemeId] = useState<AppThemeId>("pearl-4k");

  useEffect(() => {
    const initial = resolveInitialTheme();
    setThemeId(initial);
    applyThemeToDom(initial);
  }, []);

  const selectTheme = (nextId: AppThemeId) => {
    setThemeId(nextId);
    applyThemeToDom(nextId);
  };

  const activeOption = THEME_OPTIONS.find((t) => t.id === themeId) || THEME_OPTIONS[0];
  const ActiveIcon = activeOption.icon || Palette;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "no-translate h-8 gap-1.5 px-2.5 rounded-xl border-border bg-muted/60 hover:bg-muted text-foreground font-bold text-xs cursor-pointer shadow-2xs",
            className,
          )}
          aria-label={isEn ? "Select 4K Display Theme (6 Modes)" : "اختيار نمط العرض 4K (6 أنماط)"}
          title={isEn ? "Select 4K Display Theme (6 Modes)" : "اختيار نمط العرض 4K (6 أنماط)"}
        >
          <ActiveIcon className="h-4 w-4 text-primary shrink-0" />
          <span className="hidden md:inline text-[11px] font-bold">
            {isEn ? activeOption.nameEn.replace(" 4K", "") : activeOption.nameAr.replace(" 4K", "")}
          </span>
          <span
            className="h-2.5 w-2.5 rounded-full border border-black/15 shrink-0"
            style={{ backgroundColor: activeOption.accentPreview }}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn(
          "no-translate w-72 p-2 rounded-2xl border-border bg-popover shadow-2xl z-[100]",
          isEn ? "text-left" : "text-right",
        )}
      >
        <DropdownMenuLabel className="px-2.5 py-1.5 flex items-center justify-between">
          <span className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
            <Palette size={14} className="text-primary" />
            {isEn ? "6 Ultra-HD 4K Themes" : "أنماط العرض الفائقة 4K (6 أنماط)"}
          </span>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary">
            4K HDR
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1" />

        <div className="space-y-1">
          {THEME_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = opt.id === themeId;
            return (
              <DropdownMenuItem
                key={opt.id}
                onClick={() => selectTheme(opt.id)}
                className={cn(
                  "flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer transition-all",
                  isSelected
                    ? "bg-primary/12 text-foreground ring-1 ring-primary/35"
                    : "hover:bg-muted/80 text-foreground",
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* 4K Swatch Preview */}
                  <div
                    className="relative h-8 w-8 rounded-lg border border-border/80 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden"
                    style={{ backgroundColor: opt.bgPreview }}
                  >
                    <div
                      className="h-5 w-5 rounded-md flex items-center justify-center border border-black/10"
                      style={{ backgroundColor: opt.cardPreview }}
                    >
                      <Icon size={12} style={{ color: opt.accentPreview }} />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold leading-tight truncate">
                        {isEn ? opt.nameEn : opt.nameAr}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-tight truncate mt-0.5">
                      {isEn ? opt.descEn : opt.descAr}
                    </p>
                  </div>
                </div>

                {isSelected ? (
                  <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                    <Check size={12} strokeWidth={3} />
                  </span>
                ) : (
                  <span
                    className="h-3 w-3 rounded-full shrink-0 border border-border"
                    style={{ backgroundColor: opt.accentPreview }}
                  />
                )}
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
