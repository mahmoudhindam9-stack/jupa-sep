import { useEffect, useMemo, useState } from "react";
import { Check, ChefHat, Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MenuItem, MenuItemAddition, QuickOption } from "@/shared/types";
import {
  buildCartLineKey,
  getLineUnitPrice,
  resolveProductCustomizationConfig,
} from "@/shared/utils/productOptions";

export interface ConfiguredCartSelection {
  lineKey: string;
  item: MenuItem;
  quantity: number;
  selectedOptions: QuickOption[];
  selectedAdditions: MenuItemAddition[];
  notes: string;
}

interface ProductCustomizationModalProps {
  item: MenuItem | null;
  categoryNameAr?: string;
  isOpen: boolean;
  lang?: "ar" | "en";
  formatPrice: (amount: number) => string;
  initialQuantity?: number;
  initialOptions?: QuickOption[];
  initialAdditions?: MenuItemAddition[];
  initialNotes?: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: (selection: ConfiguredCartSelection) => void;
}

export function ProductCustomizationModal({
  item,
  categoryNameAr,
  isOpen,
  lang = "ar",
  formatPrice,
  initialQuantity = 1,
  initialOptions = [],
  initialAdditions = [],
  initialNotes = "",
  confirmLabel,
  onClose,
  onConfirm,
}: ProductCustomizationModalProps) {
  const [quantity, setQuantity] = useState<number>(Math.max(1, initialQuantity));
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [selectedAdditionIds, setSelectedAdditionIds] = useState<string[]>([]);
  const [notes, setNotes] = useState<string>(initialNotes || "");

  const config = useMemo(
    () => resolveProductCustomizationConfig(item, categoryNameAr),
    [item, categoryNameAr],
  );

  useEffect(() => {
    if (!isOpen || !item) return;
    setQuantity(Math.max(1, initialQuantity));
    setSelectedOptionIds(
      (initialOptions || [])
        .map((o) => (typeof o === "string" ? o : o.id || o.label_ar))
        .filter(Boolean),
    );
    setSelectedAdditionIds(
      (initialAdditions || [])
        .map((a) => (typeof a === "string" ? a : a.id || a.name_ar))
        .filter(Boolean),
    );
    setNotes(initialNotes || "");
  }, [isOpen, item, initialQuantity, initialOptions, initialAdditions, initialNotes]);

  if (!isOpen || !item) return null;

  const toggleOption = (opt: QuickOption) => {
    const optKey = opt.id || opt.label_ar;
    setSelectedOptionIds((prev) => {
      if (prev.includes(optKey)) {
        return prev.filter((id) => id !== optKey);
      }
      // If same mutually exclusive group (temp/ice/sugar), deselect other options from that group
      const exclusiveGroups = new Set(["temp", "ice", "sugar"]);
      if (opt.group && exclusiveGroups.has(opt.group)) {
        const sameGroupKeys = new Set(
          config.quickOptions
            .filter((o) => o.group === opt.group)
            .map((o) => o.id || o.label_ar),
        );
        return [...prev.filter((id) => !sameGroupKeys.has(id)), optKey];
      }
      return [...prev, optKey];
    });
  };

  const toggleAddition = (add: MenuItemAddition) => {
    const addKey = add.id || add.name_ar;
    setSelectedAdditionIds((prev) =>
      prev.includes(addKey) ? prev.filter((id) => id !== addKey) : [...prev, addKey],
    );
  };

  const chosenOptions = config.quickOptions.filter((o) =>
    selectedOptionIds.includes(o.id || o.label_ar),
  );
  const chosenAdditions = config.additions.filter((a) =>
    selectedAdditionIds.includes(a.id || a.name_ar),
  );
  const unitPrice = getLineUnitPrice(Number(item.price || 0), chosenAdditions);
  const totalLinePrice = unitPrice * quantity;

  const handleConfirm = () => {
    const lineKey = buildCartLineKey({
      itemId: item.id,
      selectedOptions: chosenOptions,
      selectedAdditions: chosenAdditions,
      notes,
    });
    onConfirm({
      lineKey,
      item,
      quantity,
      selectedOptions: chosenOptions,
      selectedAdditions: chosenAdditions,
      notes: notes.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[99995] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        dir={lang === "ar" ? "rtl" : "ltr"}
        className="bg-card text-foreground w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 bg-muted/30">
          <div className="flex items-center gap-3 min-w-0">
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.name_ar}
                className="w-12 h-12 rounded-xl object-cover shrink-0 border border-border"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <ChefHat size={20} />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="font-black text-base truncate">{item.name_ar}</h3>
              <p className="text-xs font-bold text-primary tabular-nums">
                {formatPrice(Number(item.price || 0))}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-foreground cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Quick Options specific to this product */}
          {config.quickOptions.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-black text-foreground">
                {lang === "ar" ? "خيارات التحضير السريعة" : "Quick Preparation Options"}
              </div>
              <div className="flex flex-wrap gap-2">
                {config.quickOptions.map((opt) => {
                  const optKey = opt.id || opt.label_ar;
                  const active = selectedOptionIds.includes(optKey);
                  return (
                    <button
                      key={optKey}
                      type="button"
                      onClick={() => toggleOption(opt)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                        active
                          ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                          : "bg-background text-foreground border-border hover:border-primary/40"
                      }`}
                    >
                      {active && <Check size={13} />}
                      <span>{lang === "ar" ? opt.label_ar : opt.label_en || opt.label_ar}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Product-specific additions */}
          {config.additions.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-black text-foreground">
                {lang === "ar" ? "إضافات الصنف المتاحة" : "Available Add-ons"}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {config.additions.map((add) => {
                  const addKey = add.id || add.name_ar;
                  const active = selectedAdditionIds.includes(addKey);
                  const addPrice = Number(add.price || 0);
                  return (
                    <button
                      key={addKey}
                      type="button"
                      onClick={() => toggleAddition(add)}
                      className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 transition cursor-pointer ${
                        active
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-500"
                          : "bg-background text-foreground border-border hover:border-primary/40"
                      }`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        {active && <Check size={13} className="text-emerald-600 shrink-0" />}
                        <span className="truncate">
                          {lang === "ar" ? add.name_ar : add.name_en || add.name_ar}
                        </span>
                      </span>
                      {addPrice > 0 && (
                        <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-300 shrink-0 tabular-nums">
                          +{formatPrice(addPrice)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-foreground block">
              {lang === "ar" ? "ملاحظات خاصة على هذا الطلب (اختياري)" : "Special Notes (Optional)"}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                lang === "ar"
                  ? "أضف أي تعليمات خاصة للتحضير..."
                  : "Any special preparation notes..."
              }
              className="w-full bg-background border border-input rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
          <div
            className="flex items-center gap-1.5 bg-background border border-border rounded-xl p-1"
            dir="ltr"
          >
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center cursor-pointer"
            >
              <Minus size={14} />
            </button>
            <span className="w-7 text-center text-sm font-black tabular-nums">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center cursor-pointer"
            >
              <Plus size={14} />
            </button>
          </div>

          <Button
            type="button"
            onClick={handleConfirm}
            className="flex-1 h-11 rounded-xl font-black text-sm gap-2 cursor-pointer tabular-nums"
          >
            <span>
              {confirmLabel || (lang === "ar" ? "إضافة للطلب" : "Add to Order")}
            </span>
            <span>•</span>
            <span>{formatPrice(totalLinePrice)}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
