import { useState, useEffect } from "react";
import { githubUpdateService, GitHubUpdateInfo } from "@/shared/services/githubUpdateService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ArrowUpCircle, ExternalLink, RefreshCw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

export function GitHubUpdateBanner() {
  const [updateInfo, setUpdateInfo] = useState<GitHubUpdateInfo>(() =>
    githubUpdateService.getStatus(),
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Subscribe to updates
    const unsubscribe = githubUpdateService.subscribe((info) => {
      setUpdateInfo(info);
    });

    // Auto-check if enabled and not checked recently
    const settings = githubUpdateService.getSettings();
    if (settings.autoCheck) {
      githubUpdateService.checkForUpdates(false).catch(() => {});
    }

    return () => {
      unsubscribe();
    };
  }, []);

  if (!updateInfo.hasUpdate || dismissed) {
    return null;
  }

  const handleApplyUpdate = async () => {
    setIsUpdating(true);
    toast.loading("جاري تطبيق التحديث وتحديث ملفات النظام...", { id: "applying-update" });
    const res = await githubUpdateService.performUpdate();
    if (res.success) {
      toast.success(res.message, { id: "applying-update" });
    } else {
      setIsUpdating(false);
      toast.error(res.message, { id: "applying-update" });
    }
  };

  return (
    <>
      <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 text-white px-4 py-2.5 shadow-md flex items-center justify-between gap-3 text-xs sm:text-sm animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="flex items-center gap-2.5 font-bold flex-1">
          <span className="p-1 rounded-full bg-white/20">
            <Sparkles size={16} className="text-amber-200" />
          </span>
          <span>
            يوجد تحديث جديد متاح من النظام على GitHub:{" "}
            <span className="underline font-black text-amber-200">v{updateInfo.latestVersion}</span>{" "}
            (الإصدار الحالي: v{updateInfo.currentVersion})
          </span>
          {updateInfo.releaseName && (
            <Badge
              variant="secondary"
              className="bg-white/20 hover:bg-white/30 text-white text-[10px] hidden md:inline-flex border-0"
            >
              {updateInfo.releaseName}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setShowModal(true)}
            variant="ghost"
            className="h-8 px-2.5 text-xs text-white hover:bg-white/20"
          >
            ما الجديد؟
          </Button>
          <Button
            size="sm"
            disabled={isUpdating}
            onClick={handleApplyUpdate}
            className="h-8 px-3 text-xs font-black bg-white text-orange-700 hover:bg-amber-50 shadow-sm"
          >
            <RefreshCw size={13} className={isUpdating ? "animate-spin ml-1.5" : "ml-1.5"} />
            {isUpdating ? "جاري التحديث..." : "تحديث الآن"}
          </Button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-white/80 hover:text-white rounded-md hover:bg-white/10"
            title="تجاهل الآن"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Release Notes Dialog */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="font-cairo max-w-lg">
          <DialogHeader className="text-right">
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <ArrowUpCircle className="text-amber-600" size={22} />
              تفاصيل التحديث الجديد (v{updateInfo.latestVersion})
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              الإصدار المثبت حالياً:{" "}
              <span className="font-bold text-foreground">v{updateInfo.currentVersion}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-right">
            <div className="p-3 bg-muted/60 rounded-xl border space-y-1">
              <div className="font-bold text-xs text-muted-foreground">عنوان الإصدار:</div>
              <div className="font-bold text-sm text-foreground">
                {updateInfo.releaseName || `Restocash v${updateInfo.latestVersion}`}
              </div>
            </div>

            <div className="p-3 bg-muted/30 rounded-xl border space-y-1 max-h-48 overflow-y-auto">
              <div className="font-bold text-xs text-muted-foreground">
                ملاحظات الإصدار والتغييرات:
              </div>
              <p className="text-xs whitespace-pre-wrap leading-relaxed text-foreground">
                {updateInfo.releaseNotes || "تمت إضافة تحسينات وإصلاحات جديدة للأداء والتزامن."}
              </p>
            </div>

            {updateInfo.releaseUrl && (
              <a
                href={updateInfo.releaseUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-bold"
              >
                <ExternalLink size={13} />
                عرض الإصدار على GitHub
              </a>
            )}
          </div>

          <DialogFooter className="flex flex-row justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowModal(false)}
              className="text-xs"
            >
              إغلاق
            </Button>
            <Button
              size="sm"
              disabled={isUpdating}
              onClick={() => {
                setShowModal(false);
                handleApplyUpdate();
              }}
              className="text-xs font-black bg-amber-600 hover:bg-amber-700 text-white"
            >
              <RefreshCw size={14} className={isUpdating ? "animate-spin ml-1.5" : "ml-1.5"} />
              تأكيد التحديث المباشر
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
