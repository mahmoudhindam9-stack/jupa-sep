import React, { useEffect, useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewMode = "grid" | "list";

const STORAGE_PREFIX = "jupa_view_mode_";

export function useViewMode(
  pageKey: string,
  defaultMode: ViewMode = "grid",
): [ViewMode, (mode: ViewMode) => void] {
  const storageKey = `${STORAGE_PREFIX}${pageKey}`;
  const [mode, setModeState] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return defaultMode;
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved === "grid" || saved === "list") return saved;
    } catch {
      // ignore storage errors
    }
    return defaultMode;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved === "grid" || saved === "list") {
        setModeState(saved);
      }
    } catch {
      // ignore storage errors
    }
  }, [storageKey]);

  const setMode = (nextMode: ViewMode) => {
    setModeState(nextMode);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(storageKey, nextMode);
      } catch {
        // ignore storage errors
      }
    }
  };

  return [mode, setMode];
}

interface ViewModeToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}

export function ViewModeToggle({ mode, onChange, className }: ViewModeToggleProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-xl border border-border/80 bg-muted/40 p-0.5 shrink-0",
        className,
      )}
      role="group"
      aria-label="تبديل طريقة العرض"
    >
      <button
        type="button"
        onClick={() => onChange("grid")}
        data-testid="view-mode-grid"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer",
          mode === "grid"
            ? "bg-card text-primary shadow-xs border border-border/60"
            : "text-muted-foreground hover:text-foreground",
        )}
        title="عرض شبكي"
      >
        <LayoutGrid size={14} />
        <span>شبكي</span>
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        data-testid="view-mode-list"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer",
          mode === "list"
            ? "bg-card text-primary shadow-xs border border-border/60"
            : "text-muted-foreground hover:text-foreground",
        )}
        title="عرض قائمة"
      >
        <List size={14} />
        <span>قائمة</span>
      </button>
    </div>
  );
}
