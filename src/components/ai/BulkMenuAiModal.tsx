// @ts-nocheck
import React, { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Camera,
  Check,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { Category, InventoryItem } from "@/shared/types";
import { menuService } from "@/features/menu/services/menuService";
import { inventoryService } from "@/features/inventory/services/inventoryService";
import { erpStore } from "@/shared/services/erpStore";
import { postAiEndpoint, chunkArray } from "@/shared/services/aiClient";
import {
  DISH_IMAGE_PRESETS,
  DishImagePreset,
  fileToBase64Payload,
  isSpreadsheetFile,
  matchInventoryItemByName,
  normalizeUnit,
  parseSpreadsheetFile,
  resolveDishImageUrl,
} from "@/shared/services/aiImportUtils";

interface DraftIngredient {
  name_ar: string;
  weight: number;
  unit: string;
  inventory_id?: string;
}

interface DraftMenuItem {
  tempId: string;
  name_ar: string;
  category_name: string;
  price: number;
  requires_oven: boolean;
  image_url: string;
  ingredients: DraftIngredient[];
}

interface BulkMenuAiModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingCategories: Category[];
  inventoryItems: InventoryItem[];
  onSaved: () => void;
  toast: any;
}

export function BulkMenuAiModal({
  open,
  onOpenChange,
  existingCategories,
  inventoryItems,
  onSaved,
  toast,
}: BulkMenuAiModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inputMode, setInputMode] = useState<"file" | "text">("file");
  const [rawText, setRawText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [createMissingIngredients, setCreateMissingIngredients] = useState(true);
  const [draftItems, setDraftItems] = useState<DraftMenuItem[]>([]);

  const mapParsedItems = (items: any[]): DraftMenuItem[] => {
    return (items || []).map((it, idx) => {
      const resolvedUrl = resolveDishImageUrl(
        it.image_preset || it.name_ar,
        it.category_name,
      );
      const mappedIngredients: DraftIngredient[] = (it.ingredients || []).map((ing: any) => {
        const matched = matchInventoryItemByName(ing.name_ar, inventoryItems);
        return {
          name_ar: matched?.name_ar || String(ing.name_ar || "").trim(),
          weight: Number(ing.weight) || 0.1,
          unit: normalizeUnit(matched?.unit || ing.unit),
          inventory_id: matched?.id,
        };
      });
      return {
        tempId: `menu-ai-${Date.now()}-${idx}`,
        name_ar: String(it.name_ar || "").trim(),
        category_name: String(it.category_name || "عام").trim(),
        price: Math.max(0, Number(it.price) || 0),
        requires_oven: Boolean(it.requires_oven),
        image_url: resolvedUrl,
        ingredients: mappedIngredients,
      };
    });
  };

  const handleAnalyzeFile = async (file: File) => {
    setIsAnalyzing(true);
    try {
      const catNames = existingCategories.map((c) => c.name_ar);
      const invHints = inventoryItems.map((i) => ({ name_ar: i.name_ar, unit: i.unit }));

      if (isSpreadsheetFile(file)) {
        const { rows, text } = await parseSpreadsheetFile(file);
        if (rows.length > 0) {
          const chunks = chunkArray(rows, 35);
          const allDrafts: DraftMenuItem[] = [];
          for (const chunk of chunks) {
            const res = await postAiEndpoint<{ items: any[] }>("/api/ai/parse-menu", {
              textData: JSON.stringify(chunk),
              existingCategories: catNames,
              existingInventory: invHints,
            });
            allDrafts.push(...mapParsedItems(res.items || []));
          }
          setDraftItems(allDrafts);
        } else {
          const res = await postAiEndpoint<{ items: any[] }>("/api/ai/parse-menu", {
            textData: text,
            existingCategories: catNames,
            existingInventory: invHints,
          });
          setDraftItems(mapParsedItems(res.items || []));
        }
      } else {
        const { base64, mimeType } = await fileToBase64Payload(file);
        const res = await postAiEndpoint<{ items: any[] }>("/api/ai/parse-menu", {
          base64,
          mimeType,
          existingCategories: catNames,
          existingInventory: invHints,
        });
        setDraftItems(mapParsedItems(res.items || []));
      }
    } catch (err: any) {
      toast({
        title: "تعذر قراءة المنيو",
        description: err?.message || "تأكد من وضوح الملف وحاول مجدداً",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyzeText = async () => {
    if (!rawText.trim()) return;
    setIsAnalyzing(true);
    try {
      const catNames = existingCategories.map((c) => c.name_ar);
      const invHints = inventoryItems.map((i) => ({ name_ar: i.name_ar, unit: i.unit }));
      const lines = rawText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const chunks = chunkArray(lines, 40);
      const allDrafts: DraftMenuItem[] = [];
      for (const chunk of chunks) {
        const res = await postAiEndpoint<{ items: any[] }>("/api/ai/parse-menu", {
          textData: chunk.join("\n"),
          existingCategories: catNames,
          existingInventory: invHints,
        });
        allDrafts.push(...mapParsedItems(res.items || []));
      }
      setDraftItems(allDrafts);
    } catch (err: any) {
      toast({
        title: "تعذر تحليل القائمة",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDishImageUpload = async (tempId: string, file: File) => {
    try {
      const { base64, mimeType } = await fileToBase64Payload(file, 640);
      const dataUrl = `data:${mimeType};base64,${base64}`;
      setDraftItems((prev) =>
        prev.map((d) => (d.tempId === tempId ? { ...d, image_url: dataUrl } : d)),
      );
    } catch {
      // Ignore
    }
  };

  const handleSaveAll = async () => {
    const validItems = draftItems.filter((i) => i.name_ar.trim());
    if (validItems.length === 0) return;

    setIsSaving(true);
    try {
      const categoryMap = new Map<string, string>();
      existingCategories.forEach((c) => {
        categoryMap.set(c.name_ar.trim().toLowerCase(), c.id);
      });

      let nextSort = existingCategories.length + 1;
      for (const item of validItems) {
        const catKey = item.category_name.trim().toLowerCase();
        if (catKey && !categoryMap.has(catKey)) {
          const createdCat = await menuService.upsertCategory({
            name_ar: item.category_name.trim(),
            sort_order: nextSort++,
          });
          categoryMap.set(catKey, createdCat.id);
        }
      }

      const workingInventory = [...inventoryItems];
      const resolveOrCreateInventoryId = async (ing: DraftIngredient): Promise<string | null> => {
        if (ing.inventory_id) return ing.inventory_id;
        const matched = matchInventoryItemByName(ing.name_ar, workingInventory);
        if (matched) return matched.id;
        if (!createMissingIngredients || !ing.name_ar.trim()) return null;

        const createdInv = await inventoryService.upsertInventoryItem(
          {
            name_ar: ing.name_ar.trim(),
            unit: ing.unit || "كجم",
            quantity: 0,
            min_level: 5,
            cost: 0,
          },
          undefined,
          "wh-main-default",
        );
        workingInventory.push(createdInv);
        return createdInv.id;
      };

      for (const item of validItems) {
        const categoryId =
          categoryMap.get(item.category_name.trim().toLowerCase()) || null;
        const resolvedIngredients: any[] = [];
        for (const ing of item.ingredients) {
          const invId = await resolveOrCreateInventoryId(ing);
          if (invId) {
            resolvedIngredients.push({
              inventory_id: invId,
              weight: Number(ing.weight) || 0.1,
              unit: ing.unit || "كجم",
            });
          }
        }

        const savedItem = await menuService.upsertMenuItem({
          name_ar: item.name_ar.trim(),
          price: Number(item.price) || 0,
          category_id: categoryId,
          image_url: item.image_url || resolveDishImageUrl(item.name_ar, item.category_name),
          is_available: true,
          requires_oven: item.requires_oven,
          ingredients: resolvedIngredients,
          inventory_tracking:
            resolvedIngredients.length > 0 ? "recipe_required" : "not_tracked",
        });

        if (savedItem?.id) {
          erpStore.saveMenuItemQualitySpecs(savedItem.id, {
            menu_item_id: savedItem.id,
            shelf_life_hours: 24,
            storage_condition_label: "4°م ثلاجة",
            allergens: [],
            quality_checklist: ["فحص الجودة والطزاجة"],
          });
        }
      }

      toast({
        title: `تم حفظ ${validItems.length} صنف بالوصفات بنجاح`,
      });
      setDraftItems([]);
      setRawText("");
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "تعذر حفظ المنيو",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col font-['Tajawal']" dir="rtl">
        <DialogHeader className="border-b border-border pb-3">
          <DialogTitle className="flex items-center gap-2 text-lg font-black">
            <Sparkles className="text-primary" size={20} />
            <span>إضافة المنيو والوصفات بالـ AI</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-3">
          {/* Source Selector */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={inputMode === "file" ? "default" : "outline"}
                size="sm"
                onClick={() => setInputMode("file")}
                className="rounded-xl font-bold text-xs"
              >
                <Upload size={14} className="ml-1.5" />
                رفع ملف / صورة منيو
              </Button>
              <Button
                type="button"
                variant={inputMode === "text" ? "default" : "outline"}
                size="sm"
                onClick={() => setInputMode("text")}
                className="rounded-xl font-bold text-xs"
              >
                لصق قائمة نصية
              </Button>
            </div>

            {draftItems.length > 0 && (
              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={createMissingIngredients}
                  onChange={(e) => setCreateMissingIngredients(e.target.checked)}
                  className="rounded border-input accent-primary w-4 h-4"
                />
                <span>إنشاء الخامات الجديدة بالمخزن</span>
              </label>
            )}
          </div>

          {inputMode === "file" ? (
            <div
              onClick={() => !isAnalyzing && fileInputRef.current?.click()}
              className="border-2 border-dashed border-primary/30 hover:border-primary/60 bg-muted/20 rounded-2xl p-6 text-center cursor-pointer transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.txt,image/*,.pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAnalyzeFile(file);
                  e.target.value = "";
                }}
              />
              {isAnalyzing ? (
                <div className="flex items-center justify-center gap-2 text-primary font-bold text-sm">
                  <Loader2 className="animate-spin" size={20} />
                  <span>جاري التحليل...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-foreground font-bold text-sm">
                  <Upload size={20} className="text-primary" />
                  <span>اختر ملف Excel أو CSV أو صورة المنيو</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={4}
                placeholder="برجر دبل - 180&#10;بيتزا مارجريتا - 150&#10;عصير مانجو - 50"
                className="w-full rounded-xl border border-input bg-background p-3 text-xs font-bold resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <Button
                type="button"
                disabled={isAnalyzing || !rawText.trim()}
                onClick={handleAnalyzeText}
                className="rounded-xl font-bold text-xs gap-1.5"
              >
                {isAnalyzing ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                <span>تحليل وتجهيز الأصناف والوصفات</span>
              </Button>
            </div>
          )}

          {/* Parsed Editable List */}
          {draftItems.length > 0 && (
            <div className="space-y-2.5">
              {draftItems.map((item) => (
                <div
                  key={item.tempId}
                  className="bg-card border border-border rounded-xl p-3 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Dish Thumbnail + Upload */}
                    <div className="relative w-14 h-12 rounded-lg overflow-hidden border border-border shrink-0 group bg-muted">
                      <img
                        src={item.image_url}
                        alt={item.name_ar}
                        className="w-full h-full object-cover"
                      />
                      <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                        <Camera size={14} className="text-white" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleDishImageUpload(item.tempId, f);
                          }}
                        />
                      </label>
                    </div>

                    <select
                      value={
                        (Object.keys(DISH_IMAGE_PRESETS) as DishImagePreset[]).find(
                          (k) => DISH_IMAGE_PRESETS[k].url === item.image_url,
                        ) || ""
                      }
                      onChange={(e) => {
                        const key = e.target.value as DishImagePreset;
                        if (DISH_IMAGE_PRESETS[key]) {
                          setDraftItems((prev) =>
                            prev.map((d) =>
                              d.tempId === item.tempId
                                ? { ...d, image_url: DISH_IMAGE_PRESETS[key].url }
                                : d,
                            ),
                          );
                        }
                      }}
                      className="h-9 rounded-lg border border-input bg-background px-2 text-xs font-bold"
                    >
                      <option value="">صورة مخصصة</option>
                      {(Object.keys(DISH_IMAGE_PRESETS) as DishImagePreset[]).map((k) => (
                        <option key={k} value={k}>
                          {DISH_IMAGE_PRESETS[k].label}
                        </option>
                      ))}
                    </select>

                    <Input
                      value={item.name_ar}
                      onChange={(e) =>
                        setDraftItems((prev) =>
                          prev.map((d) =>
                            d.tempId === item.tempId ? { ...d, name_ar: e.target.value } : d,
                          ),
                        )
                      }
                      placeholder="اسم الصنف"
                      className="flex-1 min-w-[140px] h-9 rounded-lg text-xs font-bold"
                    />

                    <Input
                      value={item.category_name}
                      onChange={(e) =>
                        setDraftItems((prev) =>
                          prev.map((d) =>
                            d.tempId === item.tempId ? { ...d, category_name: e.target.value } : d,
                          ),
                        )
                      }
                      placeholder="الفئة"
                      className="w-32 h-9 rounded-lg text-xs font-bold"
                    />

                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      value={item.price}
                      onChange={(e) =>
                        setDraftItems((prev) =>
                          prev.map((d) =>
                            d.tempId === item.tempId
                              ? { ...d, price: Number(e.target.value) || 0 }
                              : d,
                          ),
                        )
                      }
                      className="w-24 h-9 rounded-lg text-xs font-mono font-bold text-center tabular-nums"
                    />

                    <label className="flex items-center gap-1.5 text-xs font-bold px-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.requires_oven}
                        onChange={(e) =>
                          setDraftItems((prev) =>
                            prev.map((d) =>
                              d.tempId === item.tempId
                                ? { ...d, requires_oven: e.target.checked }
                                : d,
                            ),
                          )
                        }
                        className="accent-primary w-4 h-4"
                      />
                      <span>فرن</span>
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        setDraftItems((prev) => prev.filter((d) => d.tempId !== item.tempId))
                      }
                      className="btn-uniform-delete p-2 rounded-lg cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Recipe Ingredients */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/50">
                    {item.ingredients.map((ing, ingIdx) => (
                      <div
                        key={ingIdx}
                        className="flex items-center gap-1 bg-muted/50 border border-border rounded-lg px-2 py-1 text-xs"
                      >
                        <input
                          value={ing.name_ar}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDraftItems((prev) =>
                              prev.map((d) =>
                                d.tempId === item.tempId
                                  ? {
                                      ...d,
                                      ingredients: d.ingredients.map((x, j) =>
                                        j === ingIdx
                                          ? { ...x, name_ar: val, inventory_id: undefined }
                                          : x,
                                      ),
                                    }
                                  : d,
                              ),
                            );
                          }}
                          className="w-24 bg-transparent font-bold focus:outline-none"
                        />
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={ing.weight}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setDraftItems((prev) =>
                              prev.map((d) =>
                                d.tempId === item.tempId
                                  ? {
                                      ...d,
                                      ingredients: d.ingredients.map((x, j) =>
                                        j === ingIdx ? { ...x, weight: val } : x,
                                      ),
                                    }
                                  : d,
                              ),
                            );
                          }}
                          className="w-14 bg-background rounded px-1 font-mono text-center tabular-nums"
                        />
                        <input
                          value={ing.unit}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDraftItems((prev) =>
                              prev.map((d) =>
                                d.tempId === item.tempId
                                  ? {
                                      ...d,
                                      ingredients: d.ingredients.map((x, j) =>
                                        j === ingIdx ? { ...x, unit: val } : x,
                                      ),
                                    }
                                  : d,
                              ),
                            );
                          }}
                          className="w-10 bg-transparent text-center font-bold focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setDraftItems((prev) =>
                              prev.map((d) =>
                                d.tempId === item.tempId
                                  ? {
                                      ...d,
                                      ingredients: d.ingredients.filter((_, j) => j !== ingIdx),
                                    }
                                  : d,
                              ),
                            )
                          }
                          className="text-destructive hover:opacity-80 px-0.5 cursor-pointer"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setDraftItems((prev) =>
                          prev.map((d) =>
                            d.tempId === item.tempId
                              ? {
                                  ...d,
                                  ingredients: [
                                    ...d.ingredients,
                                    { name_ar: "مكون جديد", weight: 0.1, unit: "كجم" },
                                  ],
                                }
                              : d,
                          ),
                        )
                      }
                      className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5 px-2 py-1 cursor-pointer"
                    >
                      <Plus size={12} />
                      <span>مكون</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {draftItems.length > 0 && (
          <div className="border-t border-border pt-3 flex items-center justify-between gap-2">
            <span className="text-xs font-black text-foreground tabular-nums">
              {draftItems.length} صنف
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="rounded-xl font-bold text-xs"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                disabled={isSaving}
                onClick={handleSaveAll}
                className="btn-uniform-save rounded-xl font-black text-xs px-5 gap-1.5"
              >
                {isSaving ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                <span>حفظ المنيو والوصفات</span>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
