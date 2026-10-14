/**
 * Developer Studio Pro — History & Safe Rollback Modal
 * Displays immutable audit trail of past published revisions with snapshots,
 * and allows 1-click safe atomic rollback to any past revision.
 */

import React, { useState, useEffect } from "react";
import { StudioHistoryRecord } from "../models/studio.types";
import { studioService } from "../services/studioService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  History,
  RotateCcw,
  Clock,
  User,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Calendar,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface HistoryRollbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRevision: number;
  onRollbackSuccess: (newRevision: number) => void;
}

export function HistoryRollbackModal({
  isOpen,
  onClose,
  currentRevision,
  onRollbackSuccess,
}: HistoryRollbackModalProps) {
  const { toast } = useToast();
  const [history, setHistory] = useState<StudioHistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [targetRecord, setTargetRecord] = useState<StudioHistoryRecord | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const records = await studioService.getHistory();
      setHistory(records);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const handleRollback = async (record: StudioHistoryRecord) => {
    setIsRollingBack(true);
    try {
      const res = await studioService.rollbackRevision(record.revision, "admin");
      if (res.success) {
        toast({
          title: "تم استرجاع الإصدار بنجاح! ⏪",
          description: `تم استرجاع لقطة الإصدار #${record.revision} ونشرها كإصدار جديد برقم #${res.newRevision}.`,
        });
        onRollbackSuccess(res.newRevision);
        onClose();
      } else {
        toast({
          title: "فشل الاسترجاع",
          description: res.error || "تعذر استرجاع لقطة الإصدار المحدد.",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({
        title: "خطأ في عملية الاسترجاع",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setIsRollingBack(false);
      setTargetRecord(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isRollingBack && onClose()}>
      <DialogContent className="max-w-2xl text-right font-cairo sm:rounded-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-2 justify-end mb-1">
            <Badge variant="outline" className="font-mono text-xs">
              الإصدار النشط: #{currentRevision}
            </Badge>
            <DialogTitle className="text-lg font-black text-foreground">
              سجل الإصدارات والاسترجاع الآمن (Rollback Audit)
            </DialogTitle>
            <History className="w-5 h-5 text-primary shrink-0" />
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            استعراض لقطات الإصدارات المنشورة سابقاً مع إمكانية استعادة أي إصدار سابق بنقرة واحدة بأمان تام.
          </DialogDescription>
        </DialogHeader>

        {/* History List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 py-2">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs">جاري تحميل سجل التعديلات...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              لا توجد إصدارات سابقة مسجلة بعد في الأرشيف.
            </div>
          ) : (
            history.map((item, index) => {
              const isCurrent = item.revision === currentRevision;
              const pageCount = Object.keys(item.snapshot?.pages || {}).length;
              const elemCount = Object.keys(item.snapshot?.elements || {}).length;

              return (
                <div
                  key={item.id || item.revision || index}
                  className={`p-3.5 rounded-xl border transition-all text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isCurrent
                      ? "bg-primary/5 border-primary/40 ring-1 ring-primary/20"
                      : "bg-card hover:bg-muted/30 border-border"
                  }`}
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-sm text-foreground">
                        الإصدار #{item.revision}
                      </span>
                      {isCurrent && (
                        <Badge variant="default" className="text-[10px] bg-primary text-primary-foreground">
                          النشط حالياً
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(item.publishedAt).toLocaleString("ar-EG")}
                      </span>
                    </div>

                    <p className="text-foreground font-medium text-xs line-clamp-1">
                      {item.summary || "بدون ملخص"}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {item.publishedBy || "admin"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        {pageCount} صفحات • {elemCount} عناصر
                      </span>
                    </div>
                  </div>

                  {/* Rollback Trigger */}
                  {!isCurrent && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isRollingBack}
                      onClick={() => setTargetRecord(item)}
                      className="shrink-0 text-xs font-bold gap-1.5 hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/40 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>استعادة هذا الإصدار</span>
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Confirmation Modal if Rollback target is selected */}
        {targetRecord && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs space-y-2">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>هل أنت متأكد من استعادة الإصدار رقم #{targetRecord.revision}؟</span>
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              سيتم إنشاء إصدار منشور جديد يحمل محتويات وتنسيقات اللقطة رقم #{targetRecord.revision} وتطبيقها فوراً في النظام، مع الاحتفاظ بجميع الإصدارات السابقة في السجل.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setTargetRecord(null)}
                disabled={isRollingBack}
                className="text-xs h-7 cursor-pointer"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => handleRollback(targetRecord)}
                disabled={isRollingBack}
                className="text-xs h-7 font-bold gap-1 cursor-pointer"
              >
                {isRollingBack ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                <span>تأكيد الاستعادة</span>
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="shrink-0 border-t pt-3 border-border/60">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs cursor-pointer"
          >
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
