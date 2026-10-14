/**
 * Developer Studio Pro — Publish Workflow Modal
 * Performs pre-flight schema validation, change summary, confirmation gate,
 * atomic publish with revision increment, and rollback snapshot recording.
 */

import React, { useState } from "react";
import {
  StudioDraft,
  validateDraftHierarchy,
} from "../models/studio.types";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  Layers,
  FileCode,
  ShieldAlert,
  Loader2,
  ArrowRight,
  GitCommit,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  draft: StudioDraft;
  onPublishSuccess: (newRevision: number) => void;
  onConflictDetected: (conflictInfo: any) => void;
}

export function PublishModal({
  isOpen,
  onClose,
  draft,
  onPublishSuccess,
  onConflictDetected,
}: PublishModalProps) {
  const { toast } = useToast();
  const [summary, setSummary] = useState("تحديث ونشر تصاميم الواجهات وتخطيط العناصر");
  const [author, setAuthor] = useState("admin");
  const [confirmed, setConfirmed] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{
    success: boolean;
    revision?: number;
    error?: string;
  } | null>(null);

  // Pre-flight hierarchy & schema validation
  const validation = validateDraftHierarchy(draft);
  const pageCount = Object.keys(draft.pages || {}).length;
  const elementCount = Object.keys(draft.elements || {}).length;
  const targetRevision = (draft.baseRevision || 1) + 1;

  const handlePublish = async () => {
    if (!validation.valid) {
      toast({
        title: "تعذر النشر",
        description: "يوجد أخطاء في التحقق من بنية المخطط يجب إصلاحها أولاً.",
        variant: "destructive",
      });
      return;
    }

    setIsPublishing(true);
    setPublishResult(null);

    try {
      const res = await studioService.publishDraft(draft, summary, author);

      if (res.success) {
        setPublishResult({ success: true, revision: res.newRevision });
        toast({
          title: "تم النشر بنجاح! 🚀",
          description: `تم نشر الإصدار رقم #${res.newRevision} بنجاح وأصبح متاحاً فوراً للمستخدمين.`,
        });
        setTimeout(() => {
          onPublishSuccess(res.newRevision);
          onClose();
        }, 1200);
      } else {
        if (res.error?.includes("CONCURRENCY_CONFLICT")) {
          // Conflict detected! Pass to parent to open conflict resolution workflow
          onClose();
          onConflictDetected({ error: res.error, serverRevision: res.newRevision });
        } else {
          setPublishResult({ success: false, error: res.error });
          toast({
            title: "فشل النشر",
            description: res.error || "حدث خطأ غير متوقع أثناء نشر التعديلات.",
            variant: "destructive",
          });
        }
      }
    } catch (e: any) {
      setPublishResult({ success: false, error: e.message });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isPublishing && onClose()}>
      <DialogContent className="max-w-xl text-right font-cairo sm:rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 justify-end mb-1">
            <Badge variant="outline" className="font-mono text-xs">
              Rev #{draft.baseRevision} → #{targetRevision}
            </Badge>
            <DialogTitle className="text-lg font-black text-foreground">
              تأكيد ونشر التعديلات (Atomic Publish)
            </DialogTitle>
            <UploadCloud className="w-5 h-5 text-primary shrink-0" />
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            سيتم التحقق من تكامل المخطط الهرمي وحفظ لقطة استعادة سابقة ثم اعتماد الإصدار الجديد ذرّياً على النظام.
          </DialogDescription>
        </DialogHeader>

        {/* Validation Status Box */}
        <div className="space-y-3 py-2">
          {validation.valid ? (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 p-3 rounded-xl text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-bold">المخطط سليم وجاهز للنشر (100% Validated)</span>
              </div>
              <Badge variant="secondary" className="text-[10px]">
                {pageCount} صفحات • {elementCount} عناصر
              </Badge>
            </div>
          ) : (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-xl text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>فشل فحص سلامة المخطط ({validation.errors.length} خطأ):</span>
              </div>
              <ul className="list-disc list-inside text-[11px] space-y-0.5 max-h-24 overflow-y-auto">
                {validation.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {validation.warnings.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 p-2.5 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>تنبيه: {validation.warnings[0]}</span>
            </div>
          )}

          {/* Publish Metadata Form */}
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                ملخص التحديث (Commit Note)
              </label>
              <Input
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="اكتب وصفاً موجزاً للتعديلات المنشورة..."
                className="text-xs text-right"
                disabled={isPublishing}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                اسم الناشر / المطور
              </label>
              <Input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="admin"
                className="text-xs text-right font-mono"
                disabled={isPublishing}
              />
            </div>

            {/* Explicit Confirmation Check */}
            <div className="flex items-center gap-2 bg-muted/40 p-3 rounded-xl border border-border/80">
              <input
                type="checkbox"
                id="confirmPublish"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="rounded cursor-pointer w-4 h-4"
                disabled={isPublishing || !validation.valid}
              />
              <label
                htmlFor="confirmPublish"
                className="text-xs text-foreground cursor-pointer select-none font-medium"
              >
                أؤكد اعتماد ونشر هذا المخطط للعموم، مع حفظ النسخة السابقة للاسترجاع (Rollback Safe).
              </label>
            </div>
          </div>

          {/* Publishing Result Notice */}
          {publishResult && !publishResult.success && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-xl text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{publishResult.error}</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 border-t pt-3 border-border/60">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isPublishing}
            className="text-xs cursor-pointer"
          >
            إلغاء
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handlePublish}
            disabled={!confirmed || !validation.valid || isPublishing}
            className="text-xs font-bold gap-1.5 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isPublishing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>جاري النشر الذرّي...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-3.5 h-3.5" />
                <span>نشر الإصدار #{targetRevision} الآن</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
