// @ts-nocheck
import React from "react";
import { Sparkles, X } from "lucide-react";

export interface SmartInsightCard {
  title: string;
  value: string;
  tone: "positive" | "warning" | "info";
}

interface SmartInsightsPanelProps {
  insights: SmartInsightCard[];
  onClose: () => void;
}

export function SmartInsightsPanel({ insights, onClose }: SmartInsightsPanelProps) {
  if (!insights || insights.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3 print:hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-black text-sm text-foreground">
          <Sparkles className="text-primary" size={16} />
          <span>تحليل الذكاء الاصطناعي</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground p-1 rounded-lg cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {insights.map((ins, i) => {
          const toneClasses =
            ins.tone === "warning"
              ? "border-amber-500/30 bg-amber-500/[0.04]"
              : ins.tone === "positive"
                ? "border-emerald-500/30 bg-emerald-500/[0.04]"
                : "border-primary/25 bg-primary/[0.04]";
          return (
            <div key={i} className={`rounded-xl border p-3 ${toneClasses}`}>
              <div className="text-xs font-bold text-muted-foreground">{ins.title}</div>
              <div className="text-sm font-black text-foreground mt-1">{ins.value}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
