// @ts-nocheck
import React, { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Loader2, Sparkles, Trash2, Upload } from "lucide-react";
import { InventoryItem, Warehouse } from "@/shared/types";
import { inventoryService } from "@/features/inventory/services/inventoryService";
import { postAiEndpoint, chunkArray } from "@/shared/services/aiClient";
import {
  fileToBase64Payload,
  isSpreadsheetFile,
  matchInventoryItemByName,
  normalizeUnit,
  parseSpreadsheetFile,
} from "@/shared/services/aiImportUtils";

interface DraftInventoryRow {
  tempId: string;
  matchedId?: string;
  name_ar: string;
  unit: string;
  quantity: number;
  min_level: number;
  cost: number;
}

interface BulkInventoryAiModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouses: Warehouse[];
  defaultWarehouseId: string;
  existingInventory: InventoryItem[];
  onSaved: () => void;
  toast: any;
}

export function BulkInventoryAiModal({
  open,
  onOpenChange,
  warehouses,
  defaultWarehouseId,
  existingInventory,
  onSaved,
  toast,
}: BulkInventoryAiModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inputMode, setInputMode] = useState<"file" | "text">("file");
  const [rawText, setRawText] = useState("");
  const [targetWarehouseId, setTargetWarehouseId] = useState(
    defaultWarehouseId && defaultWarehouseId !== "all" ? defaultWarehouseId : "wh-main-default",
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [rows, setRows] = useState<DraftInventoryRow[]>([]);

  useEffect(() => {
    if (defaultWarehouseId && defaultWarehouseId !== "all") {
      setTargetWarehouseId(defaultWarehouseId);
    }
  }, [defaultWarehouseId]);

  const mapParsedRows = (items: any[]): DraftInventoryRow[] => {
    return (items || [])
      .filter((it) => String(it?.name_ar || "").trim())
      .map((it, idx) => {
        const matched = matchInventoryItemByName(it.name_ar, existingInventory);
        return {
          tempId: `inv-ai-${Date.now()}-${idx}`,
          matchedId: matched?.id,
          name_ar: String(it.name_ar || "").trim(),
          unit: normalizeUnit(it.unit || matched?.unit),
          quantity: Math.max(0, Number(it.quantity) || 0),
          min_level: Math.max(0, Number(it.min_level) || 5),
          cost: Math.max(0, Number(it.cost) || 0),
        };
      });
  };

  const handleAnalyzeFile = async (file: File) => {
    setIsAnalyzing(true);
    try {
      if (isSpreadsheetFile(file)) {
        const { rows: sheetRows, text } = await parseSpreadsheetFile(file);
        if (sheetRows.length > 0) {
          const chunks = chunkArray(sheetRows, 45);
          const allItems: any[] = [];
          for (const chunk of chunks) {
            const res = await postAiEndpoint<{ items: any[] }>("/api/ai/parse-inventory", {
              textData: JSON.stringify(chunk),
            });
            allItems.push(...(res.items || []));
          }
          setRows(mapParsedRows(allItems));
        } else {
          const res = await postAiEndpoint<{ items: any[] }>("/api/ai/parse-inventory", {
            textData: text,
          });
          setRows(mapParsedRows(res.items || []));
        }
      } else {
        const { base64, mimeType } = await fileToBase64Payload(file);
        const res = await postAiEndpoint<{ items: any[] }>("/api/ai/parse-inventory", {
          base64,
          mimeType,
        });
        setRows(mapParsedRows(res.items || []));
      }
    } catch (err: any) {
      toast({
        title: "تعذر قراءة أصناف المخزن",
        description: err?.message,
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
      const lines = rawText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const chunks = chunkArray(lines, 45);
      const allItems: any[] = [];
      for (const chunk of chunks) {
        const res = await postAiEndpoint<{ items: any[] }>("/api/ai/parse-inventory", {
          textData: chunk.join("\n"),
        });
        allItems.push(...(res.items || []));
      }
      setRows(mapParsedRows(allItems));
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

  const handleSaveAll = async () => {
    const validRows = rows.filter((r) => r.name_ar.trim());
    if (validRows.length === 0) return;

    setIsSaving(true);
    try {
      for (const row of validRows) {
        await inventoryService.upsertInventoryItem(
          {
            name_ar: row.name_ar.trim(),
            unit: row.unit.trim() || "كجم",
            quantity: Number(row.quantity) || 0,
            min_level: Number(row.min_level) || 5,
            cost: Number(row.cost) || 0,
          },
          row.matchedId,
          targetWarehouseId || "wh-main-default",
        );
      }

      toast({
        title: `تم إدخال ${validRows.length} صنف للمخزن بنجاح`,
      });
      setRows([]);
      setRawText("");
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "تعذر حفظ الأصناف",
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
            <span>رفع أصناف المخزن بالـ AI</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-3">
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
                رفع ملف Excel / صورة جرد
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

            <select
              value={targetWarehouseId}
              onChange={(e) => setTargetWarehouseId(e.target.value)}
              className="h-9 rounded-xl border border-input bg-background px-3 text-xs font-bold"
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
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
                  const f = e.target.files?.[0];
                  if (f) handleAnalyzeFile(f);
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
                  <span>اختر ملف Excel أو CSV أو صورة كشف المخزن</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={4}
                placeholder="لحم مفروم - 50 كجم - تكلفة 320&#10;دقيق فاخر - 100 كجم - تكلفة 28"
                className="w-full rounded-xl border border-input bg-background p-3 text-xs font-bold resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <Button
                type="button"
                disabled={isAnalyzing || !rawText.trim()}
                onClick={handleAnalyzeText}
                className="rounded-xl font-bold text-xs gap-1.5"
              >
                {isAnalyzing ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                <span>تجهيز الأصناف</span>
              </Button>
            </div>
          )}

          {rows.length > 0 && (
            <div className="rounded-xl border border-border overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-muted text-muted-foreground font-black">
                  <tr className="border-b border-border">
                    <th className="p-2.5">اسم الصنف</th>
                    <th className="p-2.5">الوحدة</th>
                    <th className="p-2.5">الكمية الحالية</th>
                    <th className="p-2.5">حد الطلب</th>
                    <th className="p-2.5">التكلفة</th>
                    <th className="p-2.5 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => (
                    <tr key={row.tempId} className="hover:bg-muted/20">
                      <td className="p-2 min-w-[180px]">
                        <Input
                          value={row.name_ar}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((r) =>
                                r.tempId === row.tempId
                                  ? { ...r, name_ar: e.target.value, matchedId: undefined }
                                  : r,
                              ),
                            )
                          }
                          className="h-8 text-xs font-bold rounded-lg"
                        />
                      </td>
                      <td className="p-2 w-24">
                        <Input
                          value={row.unit}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((r) =>
                                r.tempId === row.tempId ? { ...r, unit: e.target.value } : r,
                              ),
                            )
                          }
                          className="h-8 text-xs font-bold text-center rounded-lg"
                        />
                      </td>
                      <td className="p-2 w-28">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.quantity}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((r) =>
                                r.tempId === row.tempId
                                  ? { ...r, quantity: Number(e.target.value) || 0 }
                                  : r,
                              ),
                            )
                          }
                          className="h-8 text-xs font-mono font-bold text-center rounded-lg tabular-nums"
                        />
                      </td>
                      <td className="p-2 w-24">
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          value={row.min_level}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((r) =>
                                r.tempId === row.tempId
                                  ? { ...r, min_level: Number(e.target.value) || 0 }
                                  : r,
                              ),
                            )
                          }
                          className="h-8 text-xs font-mono font-bold text-center rounded-lg tabular-nums"
                        />
                      </td>
                      <td className="p-2 w-28">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.cost}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((r) =>
                                r.tempId === row.tempId
                                  ? { ...r, cost: Number(e.target.value) || 0 }
                                  : r,
                              ),
                            )
                          }
                          className="h-8 text-xs font-mono font-bold text-center rounded-lg tabular-nums"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setRows((prev) => prev.filter((r) => r.tempId !== row.tempId))
                          }
                          className="btn-uniform-delete p-1.5 rounded-lg cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {rows.length > 0 && (
          <div className="border-t border-border pt-3 flex items-center justify-between gap-2">
            <span className="text-xs font-black text-foreground tabular-nums">
              {rows.length} صنف
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
                <span>حفظ وإدخال للمخزن</span>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
