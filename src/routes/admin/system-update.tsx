import { createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { useRef, useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { erpStore } from "@/shared/services/erpStore";
import { tableOrdersStore } from "@/shared/services/tableOrdersStore";
import { supabase } from "@/integrations/supabase/client";
import {
  downloadAccessPackageZip,
  importAccessPackageFile,
  downloadAccessSingleTableCsv,
  downloadAccessSqlSchemaFile,
  generateAccessSqlSchema,
} from "@/lib/accessPackage";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Database,
  Save,
  Download,
  Upload,
  RefreshCw,
  Code,
  Settings,
  X,
  Check,
  FileSpreadsheet,
  Activity,
  Layers,
  Smartphone,
  Table,
  FileCode,
  CheckCircle2,
  Zap,
  ArrowDownToLine,
  FileText,
  Copy,
  Archive,
  Server,
  BookOpen,
  AlertTriangle,
  Github,
  Sparkles,
  ExternalLink,
  ArrowUpCircle,
  GitBranch,
  UploadCloud,
  Terminal,
  Key,
  EyeOff,
  Eye,
  AlertCircle,
  Rocket,
  Tag,
  Globe,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  CURRENT_VERSION,
  APP_RELEASE_NAME,
  BUILD_DATE,
  DEFAULT_GITHUB_REPO,
  DEFAULT_GITHUB_REPO_URL,
  parseGitHubRepo,
} from "@/shared/config/version";
import {
  githubUpdateService,
  GitHubUpdateInfo,
  UpdateSettings,
} from "@/shared/services/githubUpdateService";

export const Route = createFileRoute("/admin/system-update")({
  head: () => ({ meta: [{ title: "تحديث السيستم وحزمة أكسس" }] }),
  component: SystemUpdatePage,
});

function SystemUpdatePage() {
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const accessPackageInputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [devModeOpen, setDevModeOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState("system");
  const [editedStrings, setEditedStrings] = useState<Record<string, string>>({});
  const [isLiveSynced, setIsLiveSynced] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toLocaleTimeString("ar-EG"));
  const [isDownloadingAccess, setIsDownloadingAccess] = useState(false);
  const [isUploadingAccess, setIsUploadingAccess] = useState(false);
  const [isUpdatingSystem, setIsUpdatingSystem] = useState(false);
  const [showConfirmDownloadAccess, setShowConfirmDownloadAccess] = useState(false);
  const [showConfirmSystemUpdate, setShowConfirmSystemUpdate] = useState(false);
  const [showSchemaDialog, setShowSchemaDialog] = useState(false);

  // GitHub update state
  const [updateInfo, setUpdateInfo] = useState<GitHubUpdateInfo>(() =>
    githubUpdateService.getStatus(),
  );
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
  const [updateSettings, setUpdateSettings] = useState<UpdateSettings>(() =>
    githubUpdateService.getSettings(),
  );
  const [repoInput, setRepoInput] = useState(updateSettings.repo);

  // GitHub Push State
  const [githubToken, setGithubToken] = useState<string>(() => {
    try {
      return localStorage.getItem("restocash_github_pat_token") || "";
    } catch {
      return "";
    }
  });
  const [showToken, setShowToken] = useState(false);
  const [pushCommitMsg, setPushCommitMsg] = useState(
    "Update Restocash: System sync & improvements",
  );
  const [isPushing, setIsPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{
    success?: boolean;
    message?: string;
    output?: string;
    error?: string;
  } | null>(null);

  // GitHub Release State
  const [releaseTagName, setReleaseTagName] = useState(`v${CURRENT_VERSION}`);
  const [releaseTitle, setReleaseTitle] = useState(`Restocash ERP v${CURRENT_VERSION}`);
  const [releaseNotes, setReleaseNotes] = useState(
    `## 🚀 ما الجديد في الإصدار ${CURRENT_VERSION}:\n- إضافة واجهة تدقيق ومراجعة الورديات (Supabase Shift Audit Logs Viewer) وتتبع فتح وإغلاق الورديات.\n- معالجة وإلغاء فلترة الورديات السابقة وإصلاح مشاكل الورديات المخفية.\n- تحسين مسار الكاشير ونقاط البيع وإفراغ السلة تلقائياً بعد إتمام الدفع بنجاح.\n- إضافة واسترجاع بيانات الموظفين (erpStore.getEmployees) وتحديث واجهات النظام.\n- جاهزية كاملة للنشر التلقائي على Vercel والمزامنة مع GitHub.`,
  );
  const [isCreatingRelease, setIsCreatingRelease] = useState(false);
  const [releaseResult, setReleaseResult] = useState<{
    success?: boolean;
    message?: string;
    releaseUrl?: string;
    error?: string;
  } | null>(null);

  const handlePushToGitHub = async () => {
    if (!githubToken.trim()) {
      toast({
        title: "رمز GitHub Token مطلوب",
        description: "يرجى إدخال GitHub Personal Access Token (PAT) للمصادقة وتخويل الرفع.",
        variant: "destructive",
      });
      return;
    }

    try {
      localStorage.setItem("restocash_github_pat_token", githubToken.trim());
    } catch {}

    setIsPushing(true);
    setPushResult(null);
    toast({
      title: "جاري رفع التحديثات إلى GitHub...",
      description: `يتم تجهيز الملفات ومزامنتها مع ${updateSettings.repo} على الفرع main...`,
    });

    try {
      const res = await fetch("/api/github/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: githubToken.trim(),
          repo: updateSettings.repo,
          commitMessage: pushCommitMsg.trim() || `Update Restocash v${CURRENT_VERSION}`,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setPushResult({ success: true, message: data.message, output: data.output });
        toast({
          title: "تم الرفع إلى GitHub بنجاح! 🚀",
          description: data.message,
        });
        githubUpdateService.checkForUpdates(true).catch(() => {});
      } else {
        setPushResult({ error: data.error || "فشلت عملية الرفع", output: data.details });
        toast({
          title: "فشل الرفع إلى GitHub",
          description: data.error || "حدث خطأ أثناء الاتصال بمستودع GitHub",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      setPushResult({ error: err.message || "تعذر إرسال طلب الرفع" });
      toast({
        title: "خطأ في الاتصال",
        description: err.message || "تعذر الاتصال بالخادم",
        variant: "destructive",
      });
    } finally {
      setIsPushing(false);
    }
  };

  const handleCreateGitHubRelease = async () => {
    if (!githubToken.trim()) {
      toast({
        title: "رمز GitHub Token مطلوب",
        description: "يرجى إدخال GitHub Personal Access Token (PAT) للمصادقة وتخويل إنشاء الإصدار.",
        variant: "destructive",
      });
      return;
    }

    try {
      localStorage.setItem("restocash_github_pat_token", githubToken.trim());
    } catch {}

    setIsCreatingRelease(true);
    setReleaseResult(null);
    toast({
      title: "جاري إنشاء ونشر الإصدار على GitHub...",
      description: `يتم تجهيز الإصدار ${releaseTagName} ونشره على مستودع ${updateSettings.repo}...`,
    });

    try {
      const res = await fetch("/api/github/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: githubToken.trim(),
          repo: updateSettings.repo,
          tagName: releaseTagName.trim(),
          releaseName: releaseTitle.trim(),
          releaseNotes: releaseNotes.trim(),
          targetCommitish: "main",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setReleaseResult({
          success: true,
          message: data.message,
          releaseUrl: data.release?.html_url,
        });
        toast({
          title: "🎉 تم إنشاء الإصدار على GitHub بنجاح!",
          description: `الإصدار ${releaseTagName} متاح الآن رسميًا على GitHub.`,
        });
        githubUpdateService.checkForUpdates(true).catch(() => {});
      } else {
        setReleaseResult({ error: data.error || "فشل إنشاء الإصدار" });
        toast({
          title: "فشل إنشاء الإصدار",
          description: data.error || "حدث خطأ أثناء الاتصال بمستودع GitHub",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      setReleaseResult({ error: err.message || "تعذر إرسال طلب إنشاء الإصدار" });
      toast({
        title: "خطأ في الاتصال",
        description: err.message || "تعذر الاتصال بالخادم",
        variant: "destructive",
      });
    } finally {
      setIsCreatingRelease(false);
    }
  };

  useEffect(() => {
    const unsub = githubUpdateService.subscribe((info) => {
      setUpdateInfo(info);
      setIsCheckingUpdate(githubUpdateService.getIsChecking());
    });
    return unsub;
  }, []);

  const handleCheckGitHubUpdates = async () => {
    setIsCheckingUpdate(true);
    toast({
      title: "جاري فحص التحديثات من GitHub...",
      description: `الاتصال بالمستودع ${updateSettings.repo} للتحقق من وجود إصدار أعلى...`,
    });
    try {
      const res = await githubUpdateService.checkForUpdates(true);
      if (res.hasUpdate) {
        toast({
          title: "🎉 يوجد تحديث جديد متاح!",
          description: `النسخة الجديدة: v${res.latestVersion} (النسخة المثبتة حالياً: v${res.currentVersion})`,
        });
      } else if (res.error) {
        toast({
          title: "تنبيه أثناء فحص GitHub",
          description: res.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "النظام محدث بالكامل 🟢",
          description: `أنت تستخدم أحدث إصدار متوفر (${CURRENT_VERSION}) ولا توجد تحديثات معلقة.`,
        });
      }
    } catch (e: any) {
      toast({
        title: "خطأ في الاتصال بـ GitHub",
        description: e.message || "تعذر فحص التحديثات",
        variant: "destructive",
      });
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleApplyGitHubUpdate = async () => {
    setIsApplyingUpdate(true);
    toast({
      title: "جاري تثبيت وتطبيق التحديث...",
      description: "مسح الذاكرة المؤقتة وإعادة مزامنة النظام وتحديث الأكواد...",
    });
    const res = await githubUpdateService.performUpdate();
    if (res.success) {
      toast({
        title: "تم التحديث بنجاح! 🟢",
        description: res.message,
      });
    } else {
      setIsApplyingUpdate(false);
      toast({
        title: "فشل التحديث",
        description: res.message,
        variant: "destructive",
      });
    }
  };

  const handleSaveRepoSettings = () => {
    const trimmed = repoInput.trim();
    if (!trimmed) return;
    const parsed = parseGitHubRepo(trimmed);
    const updated = githubUpdateService.saveSettings({ repo: parsed });
    setUpdateSettings(updated);
    setRepoInput(parsed);
    toast({
      title: "تم ربط مستودع GitHub بنجاح 🟢",
      description: `المستودع المستهدف المربوط: ${parsed}`,
    });
  };

  const handleToggleAutoCheck = (enabled: boolean) => {
    const updated = githubUpdateService.saveSettings({ autoCheck: enabled });
    setUpdateSettings(updated);
    toast({
      title: enabled ? "تم تفعيل التحديث التلقائي" : "تم تعطيل التحديث التلقائي",
      description: enabled
        ? "سيقوم النظام بفحص التحديثات من GitHub تلقائياً عند فتح النظام في الخلفية"
        : "يمكنك دائماً البحث عن التحديثات يدوياً بالضغط على زر البحث عن التحديثات",
    });
  };

  // Store state snapshot for stats
  const [erpState, setErpState] = useState(erpStore.getState());

  useEffect(() => {
    return erpStore.subscribe(() => {
      setErpState(erpStore.getState());
    });
  }, []);

  // Manual & Realtime Sync Handler
  const syncSystemData = useCallback(
    async (notifyUser = false) => {
      try {
        // 1. Load latest erp_state from Supabase app_settings
        const { data, error } = await supabase
          .from("app_settings" as any)
          .select("data")
          .eq("id", "erp_state")
          .maybeSingle();

        if (!error && (data as any)?.data) {
          localStorage.setItem("erp_store_state", JSON.stringify((data as any).data));
          erpStore.state = erpStore.loadState();
          erpStore.notify();
          setErpState(erpStore.getState());
        }

        setLastSyncTime(new Date().toLocaleTimeString("ar-EG"));
        setIsLiveSynced(true);

        if (notifyUser) {
          toast({
            title: "تم تحديث النظام المباشر",
            description: "تم تحديث النظام والأكواد بنجاح ومزامنة البيانات في الوقت الفعلي 🟢",
            variant: "default",
          });
        }
      } catch (err: any) {
        console.error("Sync error:", err);
        setIsLiveSynced(false);
        if (notifyUser) {
          toast({
            title: "خطأ في التحديث",
            description: err.message || "تعذر الاتصال بخادم المزامنة",
            variant: "destructive",
          });
        }
      }
    },
    [toast],
  );

  // Real-time synchronization subscription
  useEffect(() => {
    syncSystemData(false);

    const channel = supabase
      .channel("system_realtime_sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, () => {
        syncSystemData(false);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        syncSystemData(false);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsLiveSynced(true);
        }
      });

    const handleStorageChange = () => {
      setLastSyncTime(new Date().toLocaleTimeString("ar-EG"));
      setIsLiveSynced(true);
      setErpState(erpStore.getState());
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [syncSystemData]);

  // Dev mode message handler
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "TEXT_EDITED") {
        setEditedStrings((prev) => ({
          ...prev,
          [event.data.original]: event.data.newText,
        }));
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleIframeLoad = () => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow || !iframe.contentDocument) return;

    const style = iframe.contentDocument.createElement("style");
    style.textContent = `
      * { cursor: crosshair !important; }
      *:hover { outline: 1px dashed #ef4444 !important; outline-offset: -1px; }
    `;
    iframe.contentDocument.head.appendChild(style);

    const script = iframe.contentDocument.createElement("script");
    script.textContent = `
      window.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        let targetNode = null;
        if (document.caretPositionFromPoint) {
          const range = document.caretPositionFromPoint(e.clientX, e.clientY);
          if (range) targetNode = range.offsetNode;
        } else if (document.caretRangeFromPoint) {
          const range = document.caretRangeFromPoint(e.clientX, e.clientY);
          if (range) targetNode = range.startContainer;
        }
        
        if (targetNode && targetNode.nodeType === Node.TEXT_NODE) {
          const originalText = targetNode.nodeValue.trim();
          if (!originalText) return;
          
          const newText = prompt('تعديل النص:', originalText);
          if (newText !== null && newText !== originalText) {
            targetNode.nodeValue = targetNode.nodeValue.replace(originalText, newText);
            window.parent.postMessage({ type: 'TEXT_EDITED', original: originalText, newText: newText }, '*');
          }
        }
      }, true);
    `;
    iframe.contentDocument.body.appendChild(script);
  };

  const applyDevChanges = () => {
    if (Object.keys(editedStrings).length > 0) {
      const existing = JSON.parse(localStorage.getItem("custom_text_map") || "{}");
      localStorage.setItem("custom_text_map", JSON.stringify({ ...existing, ...editedStrings }));
      toast({ title: "تم التطبيق", description: "تم تطبيق التعديلات بنجاح", variant: "default" });
      setTimeout(() => window.location.reload(), 500);
    } else {
      toast({ title: "لا توجد تعديلات", description: "لم تقم بأي تعديلات", variant: "default" });
      setDevModeOpen(false);
    }
  };

  const saveDevChangesOnly = () => {
    if (Object.keys(editedStrings).length > 0) {
      const existing = JSON.parse(localStorage.getItem("custom_text_map") || "{}");
      localStorage.setItem("custom_text_map", JSON.stringify({ ...existing, ...editedStrings }));
      toast({ title: "تم الحفظ", description: "تم حفظ التعديلات", variant: "default" });
      setEditedStrings({});
    } else {
      toast({
        title: "لا توجد تعديلات",
        description: "لم تقم بأي تعديلات لحفظها",
        variant: "default",
      });
    }
  };

  const saveDataToDatabase = async () => {
    try {
      const stateToSave = erpStore.getState();
      const { error } = await supabase
        .from("app_settings" as any)
        .upsert({ id: "erp_state", data: stateToSave });
      if (error) throw error;
      setLastSyncTime(new Date().toLocaleTimeString("ar-EG"));
      toast({
        title: "تم الحفظ",
        description: "تم حفظ بيانات البرنامج على قاعدة البيانات بنجاح",
        variant: "default",
      });
    } catch (err: any) {
      toast({
        title: "خطأ في الحفظ",
        description: err.message || "يرجى التأكد من اتصال قاعدة البيانات",
        variant: "destructive",
      });
    }
  };

  const downloadBackup = () => {
    const dataStr =
      "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(erpStore.getState()));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "erp_backup_" + Date.now() + ".json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const restoreBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (json && (json.branches || json.accounts || json.menuItems)) {
          localStorage.setItem("erp_store_state", JSON.stringify(json));
          toast({
            title: "تم الاستعادة",
            description: "تم استعادة البيانات بنجاح",
            variant: "default",
          });
          setTimeout(() => window.location.reload(), 1000);
        } else {
          toast({
            title: "ملف غير صالح",
            description: "الرجاء رفع ملف نسخة احتياطية صحيح",
            variant: "destructive",
          });
        }
      } catch (err) {
        toast({ title: "خطأ", description: "حدث خطأ أثناء قراءة الملف", variant: "destructive" });
      }
    };
    reader.readAsText(file);
  };

  // Access Package Actions
  const handleDownloadAccessPackage = async () => {
    try {
      setIsDownloadingAccess(true);
      await downloadAccessPackageZip();
      toast({
        title: "تم التنزيل بنجاح 📦",
        description: "تم تنزيل حزمة أكسس الشاملة لقاعدة البيانات في ملف مضغوط باسم Juba.zip",
        variant: "default",
      });
    } catch (err: any) {
      toast({
        title: "خطأ في التنزيل",
        description: err.message || "تعذر إنشاء حزمة أكسس المضغوطة",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingAccess(false);
    }
  };

  const handleUploadAccessPackage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingAccess(true);
      const result = await importAccessPackageFile(file);
      if (result.success) {
        toast({
          title: "تم رفع الحزمة بنجاح 🎉",
          description: result.message,
          variant: "default",
        });
        setTimeout(() => window.location.reload(), 1200);
      } else {
        toast({
          title: "فشل استيراد الحزمة",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "خطأ في رفع الحزمة",
        description: err.message || "حدث خطأ غير متوقع أثناء معالجة ملف أكسس",
        variant: "destructive",
      });
    } finally {
      setIsUploadingAccess(false);
      if (event.target) event.target.value = "";
    }
  };

  const handleSystemUpdateAction = async () => {
    try {
      setIsUpdatingSystem(true);
      await syncSystemData(true);
    } finally {
      setIsUpdatingSystem(false);
    }
  };

  // Tables metadata for MS Access Tab
  const accessTablesList = [
    {
      id: "Accounts",
      name: "tblAccounts",
      label: "دليل الحسابات وشجرة الحسابات",
      csvName: "Accounts.csv",
      count: erpState.accounts?.length || 0,
      description: "الأكواد، المسميات، الفئات، والأرصدة الافتتاحية لكل حساب",
      primaryKey: "id",
      fields: ["id", "code", "name_ar", "type", "category", "balance"],
    },
    {
      id: "Inventory",
      name: "tblInventory",
      label: "أصناف المخزون والخامات",
      csvName: "Inventory.csv",
      count: (erpState as any).inventoryItems?.length || 0,
      description: "أكواد الأصناف، الباركرود، التكلفة، الوحدات والكميات الحالية",
      primaryKey: "id",
      fields: ["id", "item_code", "barcode", "name_ar", "cost", "quantity"],
    },
    {
      id: "Menu",
      name: "tblMenu",
      label: "قائمة الطعام والوجبات",
      csvName: "Menu.csv",
      count: (erpState as any).menu?.length || 0,
      description: "أسعار الأصناف، المطبخ المسند، التوفر، والأقسام",
      primaryKey: "id",
      fields: ["id", "name_ar", "price", "category_id", "available"],
    },
    {
      id: "Orders",
      name: "tblOrders",
      label: "المبيعات والطلبات التشغيلية",
      csvName: "Orders.csv",
      count: tableOrdersStore.getAllOrders()?.length || 0,
      description: "أرقام الصالات، المبالغ، الضرائب، الصافي والحالة",
      primaryKey: "id",
      fields: ["id", "order_type", "table_number", "total", "status"],
    },
    {
      id: "Employees",
      name: "tblEmployees",
      label: "شؤون الموظفين والرواتب",
      csvName: "Employees.csv",
      count: erpState.employees?.length || 0,
      description: "أسماء الكادر، الوظائف، الهواتف، المرتبات، والحالة",
      primaryKey: "id",
      fields: ["id", "name_ar", "role", "salary", "phone", "status"],
    },
    {
      id: "Treasuries",
      name: "tblTreasuries",
      label: "الخزائن والبنوك والصناديق",
      csvName: "Treasuries.csv",
      count: (erpState as any).treasuryAccounts?.length || 0,
      description: "الخزائن الفرعية، أرصدة العملات، وحسابات الكاشير",
      primaryKey: "id",
      fields: ["id", "name_ar", "type", "currency", "balance"],
    },
    {
      id: "Suppliers",
      name: "tblSuppliers",
      label: "دليل الموردين والشركات",
      csvName: "Suppliers.csv",
      count: erpState.suppliers?.length || 0,
      description: "بيانات الموردين، الأرقام الضريبية، والأرصدة المستحقة",
      primaryKey: "id",
      fields: ["id", "name_ar", "phone", "tax_number", "balance"],
    },
    {
      id: "JournalEntries",
      name: "tblJournalEntries",
      label: "قيود اليومية والعمليات المحاسبية",
      csvName: "JournalEntries.csv",
      count: erpState.journalEntries?.length || 0,
      description: "قيود المبيعات، المشتريات، وتسويات الأستاذ العام",
      primaryKey: "id",
      fields: ["id", "entry_number", "date", "description", "total"],
    },
  ];

  return (
    <div className="space-y-6 pb-12 text-right font-cairo px-2 sm:px-4 md:px-6">
      {/* Page Navigation Tabs */}
      <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full space-y-6">
        <TabsList>
          <TabsTrigger value="system">تحديث النظام</TabsTrigger>
          <TabsTrigger value="access">حزمة أكسس</TabsTrigger>
        </TabsList>

        {/* Top Header & Tab Controls */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b pb-4 border-border/60">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                {currentTab === "access"
                  ? "حزمة قاعدة بيانات أكسس (MS Access Package)"
                  : "تحديث السيستم والنظام المباشر"}
              </h1>
              <Badge
                variant="outline"
                className={`gap-1.5 px-3 py-1 font-bold text-xs rounded-full ${
                  isLiveSynced
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                    : "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isLiveSynced ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                  }`}
                />
                {isLiveSynced ? "متزامن لحظياً 🟢" : "إعادة المزامنة..."}
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 flex items-center gap-2 flex-wrap">
              <span>
                {currentTab === "access"
                  ? "تصدير واستيراد قاعدة بيانات أكسس الشاملة Juba.zip مع دعم جداول CSV ومخطط SQL"
                  : "إدارة وتحديث النظام في الوقت الفعلي مع النسخ الاحتياطي السحابي والمحلي"}
              </span>
              <span className="text-slate-400 hidden sm:inline">|</span>
              <span className="text-xs font-bold text-primary flex items-center gap-1">
                <Activity size={13} /> آخر مزامنة: {lastSyncTime}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 rounded-xl text-xs font-bold">
              <span className="text-muted-foreground">رقم النسخة:</span>
              <Badge
                variant="secondary"
                className="font-mono text-purple-700 dark:text-purple-300 bg-white dark:bg-purple-900 font-black text-xs px-2 py-0.5"
              >
                v{CURRENT_VERSION}
              </Badge>
            </div>

            <Button
              onClick={handleCheckGitHubUpdates}
              disabled={isCheckingUpdate}
              variant="outline"
              className="gap-2 font-bold text-xs sm:text-sm border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400 bg-purple-50/50 hover:bg-purple-100 dark:bg-purple-950/20 dark:hover:bg-purple-900/40 h-11 rounded-xl shrink-0"
            >
              <RefreshCw size={16} className={isCheckingUpdate ? "animate-spin" : ""} />
              {isCheckingUpdate ? "جاري الفحص..." : "البحث عن تحديثات"}
            </Button>

            <Button
              onClick={() => setDevModeOpen(true)}
              variant="outline"
              className="gap-2 font-bold text-xs sm:text-sm border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 bg-indigo-50/50 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-900/40 h-11 rounded-xl shrink-0"
            >
              <Settings size={18} />
              خيارات المطور
            </Button>
          </div>
        </div>

        {/* TAB 1: SYSTEM UPDATE & BACKUP */}
        <TabsContent value="system" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 0: System Version & GitHub Automatic Update (إصدار النظام والتحديث التلقائي من GitHub) */}
            <Card className="col-span-1 md:col-span-2 border-border/80 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow bg-card">
              <CardHeader className="bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-transparent border-b border-border/40 pb-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg sm:text-xl font-black text-foreground flex items-center gap-2">
                      <Github size={24} className="text-purple-600 dark:text-purple-400" />
                      إصدار النظام والتحديث التلقائي من GitHub
                    </CardTitle>
                    <CardDescription className="font-bold text-xs sm:text-sm text-muted-foreground mt-1">
                      متابعة رقم النسخة الحالية وفحص التحديثات والمزامنة المباشرة مع مستودع GitHub
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="px-3 py-1 text-xs font-bold gap-1.5 border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40"
                    >
                      <Sparkles size={13} className="text-purple-600" />
                      النسخة المثبتة: v{CURRENT_VERSION}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-6">
                {/* Metrics Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-900/40 p-4 rounded-xl space-y-1">
                    <div className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                      <GitBranch size={14} className="text-purple-600" />
                      رقم النسخة الحالية
                    </div>
                    <div className="text-2xl font-black text-foreground font-mono">
                      v{CURRENT_VERSION}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-medium">
                      تاريخ الإصدار: {BUILD_DATE}
                    </div>
                  </div>

                  <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/40 p-4 rounded-xl space-y-1">
                    <div className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                      <Github size={14} className="text-blue-600" />
                      أحدث نسخة في GitHub
                    </div>
                    <div className="text-2xl font-black text-foreground font-mono">
                      v{updateInfo.latestVersion || CURRENT_VERSION}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-medium">
                      {updateInfo.checkedAt
                        ? `آخر فحص: ${new Date(updateInfo.checkedAt).toLocaleTimeString("ar-EG")}`
                        : "لم يتم الفحص بعد"}
                    </div>
                  </div>

                  <div
                    className={`p-4 rounded-xl border space-y-1 ${
                      updateInfo.hasUpdate
                        ? "bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800"
                        : "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800"
                    }`}
                  >
                    <div className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                      <Activity
                        size={14}
                        className={updateInfo.hasUpdate ? "text-amber-600" : "text-emerald-600"}
                      />
                      حالة التحديث
                    </div>
                    <div
                      className={`text-base font-black flex items-center gap-1.5 ${
                        updateInfo.hasUpdate
                          ? "text-amber-700 dark:text-amber-400"
                          : "text-emerald-700 dark:text-emerald-400"
                      }`}
                    >
                      {updateInfo.hasUpdate ? (
                        <>
                          <ArrowUpCircle size={18} />
                          يوجد إصدار أحدث متاح!
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={18} />
                          النظام محدث بالكامل 🟢
                        </>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-medium">
                      {updateInfo.hasUpdate
                        ? `الإصدار الجديد: v${updateInfo.latestVersion}`
                        : "لا توجد تحديثات معلقة"}
                    </div>
                  </div>
                </div>

                {/* If Update Available Banner */}
                {updateInfo.hasUpdate && (
                  <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border-2 border-amber-500/40 rounded-2xl p-4 sm:p-5 space-y-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="font-black text-sm sm:text-base text-amber-900 dark:text-amber-200 flex items-center gap-2">
                          <Sparkles size={18} className="text-amber-600" />
                          إصدار جديد متاح على GitHub: v{updateInfo.latestVersion} (الإصدار الحالي: v
                          {CURRENT_VERSION})
                        </h4>
                        <p className="text-xs text-amber-800 dark:text-amber-300 font-medium mt-1">
                          {updateInfo.releaseNotes ||
                            "يتضمن هذا التحديث أحدث التحسينات ومزامنة الأكواد وقواعد البيانات."}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        {updateInfo.releaseUrl && (
                          <a
                            href={updateInfo.releaseUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-bold px-2 py-1"
                          >
                            <ExternalLink size={13} />
                            عرض المستودع
                          </a>
                        )}
                        <Button
                          onClick={handleApplyGitHubUpdate}
                          disabled={isApplyingUpdate}
                          className="font-black text-xs sm:text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-md gap-2"
                        >
                          <RefreshCw size={15} className={isApplyingUpdate ? "animate-spin" : ""} />
                          {isApplyingUpdate
                            ? "جاري تثبيت التحديث..."
                            : `تحديث النظام الآن إلى v${updateInfo.latestVersion}`}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Primary Button to Search for Updates in Developer Options */}
                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="font-black text-sm text-foreground flex items-center gap-2">
                      <RefreshCw size={16} className="text-purple-600" />
                      البحث عن التحديثات المباشرة من GitHub
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      يقوم بالاتصال المباشر بمستودع GitHub للتحقق مما إذا كان هناك إصدار أحدث جاهز
                      للترقية.
                    </p>
                  </div>
                  <Button
                    onClick={handleCheckGitHubUpdates}
                    disabled={isCheckingUpdate}
                    className="w-full sm:w-auto gap-2 font-black shadow-md bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm h-11 px-6 rounded-xl touch-manipulation shrink-0"
                  >
                    <RefreshCw size={16} className={isCheckingUpdate ? "animate-spin" : ""} />
                    {isCheckingUpdate ? "جاري فحص GitHub..." : "البحث عن التحديثات الآن"}
                  </Button>
                </div>

                {/* Settings & Configurations */}
                <div className="border-t border-border/60 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-right">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground block">
                      مستودع GitHub المستهدف (رابط Clone أو مالك/مستودع):
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={repoInput}
                        onChange={(e) => setRepoInput(e.target.value)}
                        placeholder="https://github.com/mahmoudhindam9-stack/jupa-se.git"
                        className="font-mono text-xs h-10 rounded-xl"
                        dir="ltr"
                      />
                      <Button
                        onClick={handleSaveRepoSettings}
                        variant="secondary"
                        size="sm"
                        className="h-10 text-xs font-bold shrink-0 rounded-xl"
                      >
                        <Save size={14} className="ml-1" />
                        حفظ
                      </Button>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                      <span>
                        المستودع النشط:{" "}
                        <strong className="font-mono text-purple-700 dark:text-purple-300 font-bold">
                          {updateSettings.repo}
                        </strong>
                      </span>
                      <a
                        href={`https://github.com/${updateSettings.repo}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1 font-bold text-[11px]"
                      >
                        <ExternalLink size={12} />
                        زيارة المستودع
                      </a>
                    </div>
                  </div>

                  <div className="space-y-3 bg-muted/30 p-3 rounded-xl border">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-xs text-foreground">
                          التحديث التلقائي عند فتح النظام
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          التحقق من وجود إصدار أعلى تلقائياً في الخلفية عند فتح التطبيق
                        </div>
                      </div>
                      <Switch
                        checked={updateSettings.autoCheck}
                        onCheckedChange={handleToggleAutoCheck}
                      />
                    </div>
                  </div>
                </div>

                {/* Section: Push to GitHub */}
                <div className="border-t border-border/60 pt-5 space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-black text-sm text-foreground flex items-center gap-2">
                        <UploadCloud size={18} className="text-emerald-600" />
                        رفع ومزامنة التحديثات إلى GitHub (Git Push)
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        قم برفع التعديلات والأكواد فورياً إلى مستودع{" "}
                        <strong className="font-mono text-foreground font-bold">
                          {updateSettings.repo}
                        </strong>{" "}
                        (الفرع main)
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="font-mono text-xs border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40"
                    >
                      Branch: main
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 p-4 sm:p-5 rounded-2xl">
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Key size={14} className="text-emerald-600" />
                          رمز الوصول الشخصي (GitHub Personal Access Token):
                        </label>
                        <div className="relative">
                          <Input
                            type={showToken ? "text" : "password"}
                            value={githubToken}
                            onChange={(e) => setGithubToken(e.target.value)}
                            placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                            className="font-mono text-xs h-10 rounded-xl pr-9"
                            dir="ltr"
                          />
                          <button
                            type="button"
                            onClick={() => setShowToken(!showToken)}
                            className="absolute left-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                            title={showToken ? "إخفاء" : "إظهار"}
                          >
                            {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        <span className="text-[10px] text-muted-foreground block">
                          يتطلب صلاحية{" "}
                          <strong className="text-emerald-700 dark:text-emerald-400 font-mono">
                            repo
                          </strong>{" "}
                          للرفع. لا يتم إرسال الرمز لأي طرف ثالث ويحفظ محلياً في متصفحك.
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-foreground block">
                          رسالة التحديث (Commit Message):
                        </label>
                        <Input
                          value={pushCommitMsg}
                          onChange={(e) => setPushCommitMsg(e.target.value)}
                          placeholder="تحديثات النظام وإصلاح الأكواد"
                          className="text-xs h-10 rounded-xl"
                        />
                      </div>

                      <Button
                        onClick={handlePushToGitHub}
                        disabled={isPushing}
                        className="w-full gap-2 font-black shadow-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm h-11 rounded-xl touch-manipulation"
                      >
                        <UploadCloud size={17} className={isPushing ? "animate-bounce" : ""} />
                        {isPushing
                          ? "جاري رفع التحديثات إلى GitHub..."
                          : `رفع التحديثات إلى ${updateSettings.repo} الآن`}
                      </Button>

                      {pushResult?.success && (
                        <div className="p-3 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                          <span>{pushResult.message}</span>
                        </div>
                      )}

                      {pushResult?.error && (
                        <div className="p-3 bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 rounded-xl text-xs font-bold space-y-1">
                          <div className="flex items-center gap-2">
                            <AlertCircle size={16} className="text-rose-600 shrink-0" />
                            <span>{pushResult.error}</span>
                          </div>
                          {pushResult.output && (
                            <pre className="font-mono text-[10px] text-rose-700 dark:text-rose-300 overflow-x-auto whitespace-pre-wrap p-1.5 bg-black/10 rounded">
                              {pushResult.output}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="bg-slate-950 text-slate-200 p-4 rounded-xl font-mono text-xs space-y-2.5 border border-slate-800 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="text-[11px] text-emerald-400 font-bold flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Terminal size={14} />
                            أوامر الرفع عبر الطرفية (Terminal / Git Bash):
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const cmds = `git remote set-url origin https://github.com/${updateSettings.repo}.git\ngit pull origin main --rebase\ngit add -A\ngit commit -m "Update from Restocash v${CURRENT_VERSION}"\ngit push origin main`;
                              navigator.clipboard.writeText(cmds);
                              toast({
                                title: "تم نسخ الأوامر",
                                description: "تم نسخ أوامر الطرفية إلى الحافظة",
                              });
                            }}
                            className="text-[10px] text-slate-400 hover:text-white underline font-normal"
                          >
                            نسخ الكل
                          </button>
                        </div>
                        <pre
                          className="text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed select-all"
                          dir="ltr"
                        >
                          {`git remote set-url origin https://github.com/${updateSettings.repo}.git
git pull origin main --rebase
git add -A
git commit -m "Update from Restocash v${CURRENT_VERSION}"
git push origin main`}
                        </pre>
                      </div>

                      <div className="text-[10px] text-slate-400 border-t border-slate-800 pt-2 leading-relaxed">
                        💡 <strong className="text-amber-300">ملاحظة هامة:</strong> إذا ظهرت رسالة
                        خطأ <code className="text-amber-200">Authentication failed</code> عند
                        استخدام الطرفية، فإن GitHub يتطلب استخدام Token ككلمة مرور وليس كلمة مرور
                        الحساب العادية.
                      </div>
                    </div>
                  </div>

                  {/* Create New Official GitHub Release */}
                  <div className="border border-purple-200 dark:border-purple-900/50 bg-gradient-to-br from-purple-50/50 via-indigo-50/20 to-purple-50/30 dark:from-purple-950/20 dark:via-indigo-950/10 dark:to-purple-950/20 rounded-2xl p-4 sm:p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-purple-200/60 dark:border-purple-900/40 pb-3">
                      <div className="flex items-center gap-2">
                        <Rocket className="text-purple-600 dark:text-purple-400" size={20} />
                        <div>
                          <h4 className="font-black text-sm sm:text-base text-foreground">
                            إنشاء ونشر إصدار رسمي جديد (New GitHub Release)
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            نشر علامة الإصدار (Tag) والملاحظات الرسمية في مستودع GitHub ليتمكن الجميع من معرفة التحديثات
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="font-mono text-xs border-purple-300 text-purple-700 bg-purple-50 dark:bg-purple-950/40 shrink-0"
                      >
                        <Tag size={12} className="ml-1 inline" />
                        Tag: {releaseTagName}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                              <Tag size={13} className="text-purple-600" />
                              رقم الإصدار (Tag Name):
                            </label>
                            <Input
                              value={releaseTagName}
                              onChange={(e) => setReleaseTagName(e.target.value)}
                              placeholder="v1.3.0"
                              className="font-mono text-xs h-10 rounded-xl"
                              dir="ltr"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-foreground block">
                              عنوان الإصدار (Release Title):
                            </label>
                            <Input
                              value={releaseTitle}
                              onChange={(e) => setReleaseTitle(e.target.value)}
                              placeholder={`Restocash ERP v${CURRENT_VERSION}`}
                              className="text-xs h-10 rounded-xl"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-foreground flex items-center justify-between">
                            <span>ملاحظات الإصدار وسجل التغييرات (Release Notes):</span>
                            <span className="text-[10px] text-muted-foreground font-normal">يدعم تنسيق Markdown</span>
                          </label>
                          <Textarea
                            value={releaseNotes}
                            onChange={(e) => setReleaseNotes(e.target.value)}
                            rows={5}
                            placeholder="اكتب التغييرات والمميزات المضمنة في هذا الإصدار..."
                            className="text-xs rounded-xl font-mono leading-relaxed"
                          />
                        </div>

                        <Button
                          onClick={handleCreateGitHubRelease}
                          disabled={isCreatingRelease || !githubToken.trim()}
                          className="w-full gap-2 font-black shadow-md bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm h-11 rounded-xl touch-manipulation"
                        >
                          <Rocket size={17} className={isCreatingRelease ? "animate-bounce" : ""} />
                          {isCreatingRelease
                            ? "جاري رفع ونشر الإصدار على GitHub..."
                            : `نشر الإصدار ${releaseTagName} على GitHub الآن`}
                        </Button>

                        {releaseResult?.success && (
                          <div className="p-3 bg-purple-100 dark:bg-purple-900/40 text-purple-900 dark:text-purple-200 rounded-xl text-xs font-bold space-y-2">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 size={16} className="text-purple-600 shrink-0" />
                              <span>{releaseResult.message}</span>
                            </div>
                            {releaseResult.releaseUrl && (
                              <a
                                href={releaseResult.releaseUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-purple-700 transition-colors shadow-sm"
                              >
                                <ExternalLink size={13} />
                                عرض صفحة الإصدار على GitHub
                              </a>
                            )}
                          </div>
                        )}

                        {releaseResult?.error && (
                          <div className="p-3 bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 rounded-xl text-xs font-bold flex items-center gap-2">
                            <AlertCircle size={16} className="text-rose-600 shrink-0" />
                            <span>{releaseResult.error}</span>
                          </div>
                        )}
                      </div>

                      <div className="bg-slate-950 text-slate-200 p-4 rounded-xl font-mono text-xs space-y-3 border border-slate-800 flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="text-[11px] text-purple-400 font-bold flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <Terminal size={14} />
                              أوامر إنشاء الإصدار عبر الطرفية (Git CLI / GitHub CLI):
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const cmds = `git tag -a ${releaseTagName} -m "${releaseTitle}"\ngit push origin ${releaseTagName}\n# أو باستخدام GitHub CLI:\ngh release create ${releaseTagName} --title "${releaseTitle}" --notes "${releaseNotes.replace(/\n/g, " ")}"`;
                                navigator.clipboard.writeText(cmds);
                                toast({
                                  title: "تم نسخ الأوامر",
                                  description: "تم نسخ أوامر إنشاء الإصدار إلى الحافظة",
                                });
                              }}
                              className="text-[10px] text-slate-400 hover:text-white underline font-normal"
                            >
                              نسخ الكل
                            </button>
                          </div>
                          <pre
                            className="text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed select-all"
                            dir="ltr"
                          >
                            {`git tag -a ${releaseTagName} -m "${releaseTitle}"
git push origin ${releaseTagName}

# أو عبر GitHub CLI:
gh release create ${releaseTagName} --title "${releaseTitle}" --generate-notes`}
                          </pre>
                        </div>

                        <div className="text-[10px] text-slate-400 border-t border-slate-800 pt-2 leading-relaxed">
                          💡 <strong className="text-purple-300">نصيحة:</strong> يتم ربط الإصدار تلقائياً بآخر التحديثات على الفرع <code className="text-purple-200 font-mono">main</code> ويظهر في صفحة Releases الرسمية لمستودعك.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Deploy on Vercel */}
                  <div className="border border-sky-200 dark:border-sky-900/50 bg-gradient-to-br from-sky-50/60 via-blue-50/20 to-sky-50/30 dark:from-sky-950/20 dark:via-blue-950/10 dark:to-sky-950/20 rounded-2xl p-4 sm:p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-sky-200/60 dark:border-sky-900/40 pb-3">
                      <div className="flex items-center gap-2">
                        <Globe className="text-sky-600 dark:text-sky-400" size={20} />
                        <div>
                          <h4 className="font-black text-sm sm:text-base text-foreground">
                            النشر والتشغيل على منصة Vercel (Vercel Deployment)
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            نظام نشر سحابي فوري مرتبط بمستودع GitHub مع دعم التحديث التلقائي (Continuous Deployment)
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="font-mono text-xs border-sky-300 text-sky-700 bg-sky-50 dark:bg-sky-950/40 shrink-0"
                      >
                        Vercel Ready: vercel.json ✓
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div className="p-3.5 bg-white dark:bg-slate-900/80 rounded-xl border border-sky-100 dark:border-sky-900/40 space-y-2 text-xs">
                          <div className="font-bold text-foreground flex items-center gap-1.5">
                            <CheckCircle2 size={15} className="text-sky-600" />
                            حالة تكوين ملف النشر vercel.json:
                          </div>
                          <ul className="space-y-1 text-muted-foreground list-disc list-inside text-[11px] leading-relaxed">
                            <li><strong>Framework:</strong> Vite SPA</li>
                            <li><strong>Build Command:</strong> <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">npm run build</code></li>
                            <li><strong>Output Directory:</strong> <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">dist</code></li>
                            <li><strong>Routing:</strong> إعادة توجيه لكافة المسارات إلى <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">/index.html</code></li>
                          </ul>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold text-foreground block">
                            طرق النشر المتاحة:
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <a
                              href={`https://vercel.com/new/clone?repository-url=${encodeURIComponent(
                                `https://github.com/${updateSettings.repo}`,
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center gap-2 font-black shadow-md bg-black hover:bg-neutral-800 text-white text-xs h-10 px-3 rounded-xl transition-all"
                            >
                              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 116 100">
                                <path fillRule="evenodd" clipRule="evenodd" d="M57.5 0L115 100H0L57.5 0z" />
                              </svg>
                              ربط ونشر في Vercel (1-Click)
                            </a>

                            <Button
                              variant="outline"
                              onClick={() => {
                                const envVars = `VITE_SUPABASE_URL=https://myqtvbfibvgxkqwxvuru.supabase.co\nVITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15cXR2YmZpYnZneGtxd3h2dXJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MjY0NjgsImV4cCI6MjEwMDQwMjQ2OH0.LDFW826N2GRzG9WnLHgYxoeOcTkDOeLjTiFK6aQ-BSE\nVITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_srgqLn2ZvysGKh47yCQ0Kg_IW02yjDf`;
                                navigator.clipboard.writeText(envVars);
                                toast({
                                  title: "تم نسخ متغيرات البيئة",
                                  description: "تم نسخ متغيرات Vercel Environment Variables إلى الحافظة",
                                });
                              }}
                              className="text-xs h-10 rounded-xl gap-1.5 border-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950 font-bold"
                            >
                              <Copy size={13} />
                              نسخ متغيرات البيئة (.env) لـ Vercel
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-950 text-slate-200 p-4 rounded-xl font-mono text-xs space-y-3 border border-slate-800 flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="text-[11px] text-sky-400 font-bold flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <Terminal size={14} />
                              أوامر النشر المباشر عبر Vercel CLI:
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const cmds = `npm install -g vercel\nvercel login\nvercel --prod`;
                                navigator.clipboard.writeText(cmds);
                                toast({
                                  title: "تم نسخ أوامر Vercel CLI",
                                  description: "تم نسخ الأوامر إلى الحافظة",
                                });
                              }}
                              className="text-[10px] text-slate-400 hover:text-white underline font-normal"
                            >
                              نسخ الكل
                            </button>
                          </div>
                          <pre
                            className="text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed select-all"
                            dir="ltr"
                          >
                            {`# تثبيت أداة Vercel عالمياً
npm install -g vercel

# تسجيل الدخول والنشر للإنتاج
vercel login
vercel --prod`}
                          </pre>
                        </div>

                        <div className="text-[10px] text-slate-400 border-t border-slate-800 pt-2 leading-relaxed">
                          ⚡ <strong className="text-sky-300">النشر التلقائي:</strong> بمجرد ربط المستودع في Vercel، أي عملية <code className="text-sky-200 font-mono">git push</code> أو إنشاء Release على الفرع <code className="text-sky-200 font-mono">main</code> ستقوم Vercel ببنائها ونشرها فورياً تلقائياً!
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 1: System and Code Updates */}
            <Card className="border-border/70 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
              <CardHeader className="bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent border-b border-border/40 pb-4">
                <CardTitle className="text-lg sm:text-xl font-black text-foreground flex items-center gap-2">
                  <RefreshCw size={22} className="text-amber-600 dark:text-amber-400" />
                  تحديثات النظام والأكواد
                </CardTitle>
                <CardDescription className="font-bold text-xs sm:text-sm text-muted-foreground">
                  تحديث وتزامن النظام فورياً لإعادة جلب آخر الأكواد والبيانات
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 p-5 rounded-2xl space-y-4 text-center flex flex-col justify-between">
                  <div className="mx-auto w-16 h-16 bg-amber-100 dark:bg-amber-900/50 rounded-2xl flex items-center justify-center">
                    <Code size={30} className="text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h4 className="font-black text-base text-amber-900 dark:text-amber-300">
                      مزامنة وتحديث النظام المباشر
                    </h4>
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mt-1 leading-relaxed max-w-sm mx-auto">
                      إعادة تنشيط الروابط والتأكد من مطابقة جميع متطلبات التشغيل والأكواد البرمجية
                      مع قاعدة البيانات في الوقت الفعلي.
                    </p>
                  </div>

                  <div className="pt-2">
                    <Button
                      onClick={() => setShowConfirmSystemUpdate(true)}
                      disabled={isUpdatingSystem}
                      className="w-full gap-2 font-black shadow-md bg-amber-600 hover:bg-amber-700 text-white text-sm h-11 rounded-xl touch-manipulation"
                    >
                      <RefreshCw size={18} className={isUpdatingSystem ? "animate-spin" : ""} />
                      {isUpdatingSystem ? "جاري تحديث النظام..." : "تحديث النظام والربط المباشر"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Cloud & Local Backup Management */}
            <Card className="border-border/70 shadow-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
              <CardHeader className="bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent border-b border-border/40 pb-4">
                <CardTitle className="text-lg sm:text-xl font-black text-foreground flex items-center gap-2">
                  <Database size={22} className="text-blue-600 dark:text-blue-400" />
                  النسخ الاحتياطي السحابي والمحلي
                </CardTitle>
                <CardDescription className="font-bold text-xs sm:text-sm text-muted-foreground">
                  حفظ النسخ الاحتياطية سحابياً أو استيراد وتصدير النسخ المحلية
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="space-y-4">
                  <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/40 p-4 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-black text-xs sm:text-sm text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                        <Layers size={16} /> الحفظ السحابي (Supabase)
                      </h4>
                    </div>
                    <Button
                      onClick={saveDataToDatabase}
                      className="w-full gap-2 font-bold shadow-sm bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm h-11 rounded-xl touch-manipulation"
                    >
                      <Save size={18} />
                      حفظ البيانات سحابياً الآن
                    </Button>
                  </div>

                  <div className="bg-slate-50/80 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 p-4 rounded-xl">
                    <h4 className="font-black text-xs sm:text-sm text-slate-800 dark:text-slate-200 mb-2">
                      النسخة المحلية (JSON)
                    </h4>
                    <div className="flex gap-2">
                      <Button
                        onClick={downloadBackup}
                        variant="outline"
                        className="flex-1 gap-1.5 font-bold text-xs h-11 rounded-xl touch-manipulation"
                      >
                        <Download size={16} />
                        تنزيل JSON
                      </Button>
                      <input
                        type="file"
                        accept=".json"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={restoreBackup}
                      />
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        variant="outline"
                        className="flex-1 gap-1.5 font-bold text-xs h-11 rounded-xl touch-manipulation"
                      >
                        <Upload size={16} />
                        استعادة JSON
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mobile & Tablet Optimization Indicator */}
          <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm font-bold">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-slate-800 rounded-xl text-amber-400 shrink-0">
                <Smartphone size={22} />
              </div>
              <div>
                <div>وضع الموبايل والتابلت نشط ومدعوم بالكامل 📱</div>
                <p className="text-xs text-slate-400 font-normal mt-0.5">
                  تم تحسين واجهات التطبيق وأزرار التحكم للعمل بسلاسة على كافة الشاشات والأجهزة
                  اللوحية.
                </p>
              </div>
            </div>
            <Badge
              variant="secondary"
              className="bg-slate-800 text-slate-200 shrink-0 font-mono text-[11px] px-3 py-1"
            >
              RWD Mode: Ready
            </Badge>
          </div>

          {/* Danger Zone */}
          <Card className="border-red-300 dark:border-red-900 shadow-sm rounded-2xl overflow-hidden mt-6">
            <CardHeader className="bg-red-50 dark:bg-red-950/20 border-b border-red-200 dark:border-red-900/40 pb-4">
              <CardTitle className="text-lg font-black text-red-700 flex items-center gap-2">
                <AlertTriangle size={22} />
                منطقة الخطر (مسح جميع البيانات)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-4">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                سيتم مسح جميع الحركات المالية، والقيود، وأوامر الشراء، وحركات الخزينة (بما في ذلك
                البيانات القديمة)، وسيتم تصفير جميع الأرصدة. هذه العملية لا رجعة فيها.
              </p>
              <Button
                variant="destructive"
                className="w-full sm:w-auto font-black"
                onClick={() => {
                  if (
                    confirm(
                      "هل أنت متأكد من رغبتك في مسح جميع الحركات وتصفير جميع الأرصدة؟ لا يمكن التراجع عن هذه الخطوة!",
                    )
                  ) {
                    erpStore.deleteAllSystemData();
                    toast({
                      title: "تم",
                      description: "تم مسح جميع البيانات وتصفير النظام بنجاح.",
                    });
                  }
                }}
              >
                مسح جميع البيانات وتصفير النظام
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: MS ACCESS COMPREHENSIVE PACKAGE TAB */}
        <TabsContent value="access" className="space-y-6 mt-4">
          {/* Main Hero Card for Access Package */}
          <Card className="border-emerald-300/80 dark:border-emerald-800/80 shadow-md rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 text-white relative">
            <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <CardContent className="p-6 sm:p-8 relative z-10 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-emerald-800/60 pb-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 shrink-0">
                      <FileSpreadsheet size={28} />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-white">
                        حزمة قاعدة بيانات أكسس الشاملة (Juba Package)
                      </h2>
                      <p className="text-xs sm:text-sm text-emerald-200/80 font-medium mt-0.5">
                        استخراج وتجهيز كافة جداول النظام بصيغة CSV عالية التوافق مع Microsoft Access
                        مع ترميز UTF-8 BOM
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-mono text-xs px-3 py-1">
                    Juba.zip
                  </Badge>
                  <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 font-mono text-xs px-3 py-1">
                    UTF-8 BOM CSV
                  </Badge>
                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 font-mono text-xs px-3 py-1">
                    MS Access Ready
                  </Badge>
                </div>
              </div>

              {/* Main Action Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Button
                  onClick={() => setShowConfirmDownloadAccess(true)}
                  disabled={isDownloadingAccess}
                  className="w-full gap-2 font-black bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-lg text-sm h-12 rounded-xl touch-manipulation transition active:scale-95"
                >
                  {isDownloadingAccess ? (
                    <RefreshCw size={20} className="animate-spin" />
                  ) : (
                    <Archive size={20} />
                  )}
                  تنزيل حزمة Juba.zip الشاملة
                </Button>

                <Button
                  onClick={downloadAccessSqlSchemaFile}
                  variant="outline"
                  className="w-full gap-2 font-black border-emerald-500/50 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 text-sm h-12 rounded-xl touch-manipulation transition active:scale-95"
                >
                  <FileCode size={20} />
                  تحميل مخطط SQL (Schema)
                </Button>

                <input
                  type="file"
                  accept=".zip,.csv"
                  ref={accessPackageInputRef}
                  className="hidden"
                  onChange={handleUploadAccessPackage}
                />
                <Button
                  onClick={() => accessPackageInputRef.current?.click()}
                  disabled={isUploadingAccess}
                  variant="outline"
                  className="w-full gap-2 font-black border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-sm h-12 rounded-xl touch-manipulation transition active:scale-95"
                >
                  {isUploadingAccess ? (
                    <RefreshCw size={20} className="animate-spin" />
                  ) : (
                    <Upload size={20} />
                  )}
                  رفع حزمة Access (ZIP/CSV)
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Database Live Stats Grid */}
          <div className="space-y-3">
            <h3 className="text-base font-black text-foreground flex items-center gap-2">
              <Server size={18} className="text-emerald-600 dark:text-emerald-400" />
              إحصائيات جداول الحزمة الجاهزة للتصدير لأكسس
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {accessTablesList.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="bg-card border border-border/80 rounded-xl p-3.5 shadow-sm space-y-1 hover:border-emerald-500/50 transition"
                >
                  <span className="text-[11px] font-bold text-muted-foreground block truncate">
                    {item.name}
                  </span>
                  <div className="text-xl font-black text-foreground">{item.count}</div>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block truncate">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Individual Tables Exporter Section */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
                  <Table size={20} className="text-emerald-600 dark:text-emerald-400" />
                  تنزيل الجداول الفردية بصيغة CSV لأكسس
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  يمكنك استخراج أي جدول منفصلاً لاستيراده المباشر في Microsoft Access
                </p>
              </div>

              <Button
                onClick={() => setShowSchemaDialog(true)}
                variant="outline"
                size="sm"
                className="gap-2 font-bold text-xs border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400"
              >
                <FileCode size={15} />
                معاينة أكواد SQL Schema
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {accessTablesList.map((tbl) => (
                <Card
                  key={tbl.id}
                  className="border-border/70 shadow-sm rounded-xl hover:shadow-md transition flex flex-col justify-between"
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-sm font-black text-foreground flex items-center gap-1.5">
                          <Table size={16} className="text-emerald-600 dark:text-emerald-400" />
                          {tbl.name}
                        </CardTitle>
                        <CardDescription className="text-xs font-bold text-muted-foreground mt-0.5">
                          {tbl.label}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary" className="font-mono text-[10px] shrink-0">
                        {tbl.count} سجل
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 pt-2 space-y-3">
                    <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                      {tbl.description}
                    </p>

                    <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono text-slate-400">
                        PK: [{tbl.primaryKey}]
                      </span>
                      <Button
                        onClick={() => downloadAccessSingleTableCsv(tbl.id)}
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs font-bold gap-1.5 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                      >
                        <ArrowDownToLine size={14} />
                        تنزيل CSV
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Import Drag & Drop Zone */}
          <Card className="border-dashed border-2 border-emerald-300 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/10 rounded-2xl p-6 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 rounded-2xl text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <Upload size={24} />
            </div>
            <div>
              <h4 className="font-black text-sm text-foreground">
                استيراد حزمة أكسس مجمعة أو جداول مفردة
              </h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                قم بسحب وإسقاط ملف Juba.zip أو ملفات CSV المخصصة هنا للرفع والمزامنة التلقائية مع
                السيستم
              </p>
            </div>
            <Button
              onClick={() => accessPackageInputRef.current?.click()}
              disabled={isUploadingAccess}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 px-6 rounded-xl shadow-sm"
            >
              {isUploadingAccess ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Upload size={16} />
              )}
              اختر ملف Juba.zip أو CSV
            </Button>
          </Card>

          {/* Microsoft Access Import Guide */}
          <Card className="border-border/70 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b border-border/40 p-4 sm:p-5">
              <CardTitle className="text-base font-black text-foreground flex items-center gap-2">
                <BookOpen size={18} className="text-emerald-600 dark:text-emerald-400" />
                دليل طريقة الاستيراد والفتح في Microsoft Access
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-bold">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-border/60 space-y-1">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black mb-2">
                    1
                  </span>
                  <div className="text-foreground">تنزيل حزمة Juba.zip</div>
                  <p className="text-muted-foreground font-normal text-[11px]">
                    اضغط زر تنزيل حزمة Juba.zip الشاملة وقم بفك الضغط في مجلد خاص.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-border/60 space-y-1">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black mb-2">
                    2
                  </span>
                  <div className="text-foreground">إنشاء قاعدة البيانات</div>
                  <p className="text-muted-foreground font-normal text-[11px]">
                    افتح برنامج Microsoft Access وانشئ قاعدة بيانات خالية باسم Juba.accdb.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-border/60 space-y-1">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black mb-2">
                    3
                  </span>
                  <div className="text-foreground">استيراد مخطط SQL (اختياري)</div>
                  <p className="text-muted-foreground font-normal text-[11px]">
                    قم بتشغيل ملف Juba_Access_Schema.sql لتحديد الهياكل والمفاتيح تلقائياً.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-border/60 space-y-1">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black mb-2">
                    4
                  </span>
                  <div className="text-foreground">استيراد CSV في Access</div>
                  <p className="text-muted-foreground font-normal text-[11px]">
                    من تبويب (External Data) حدد Text File واختر ملفات CSV مع ترميز UTF-8.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* SQL Schema Preview Dialog */}
      <Dialog open={showSchemaDialog} onOpenChange={setShowSchemaDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-foreground flex items-center gap-2">
              <FileCode className="text-emerald-600 dark:text-emerald-400" size={22} />
              مخطط الهيكل البرمجي لأكسس (MS Access SQL Schema)
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 bg-slate-950 text-emerald-400 p-4 rounded-xl font-mono text-xs overflow-auto border border-slate-800 dir-ltr text-left my-2 space-y-1">
            <pre className="whitespace-pre-wrap leading-relaxed">{generateAccessSqlSchema()}</pre>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t">
            <Button
              onClick={() => {
                navigator.clipboard.writeText(generateAccessSqlSchema());
                toast({ title: "تم النسخ", description: "تم نسخ كود SQL Schema إلى الحافظة" });
              }}
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs font-bold"
            >
              <Copy size={15} />
              نسخ الكود
            </Button>
            <Button
              onClick={downloadAccessSqlSchemaFile}
              size="sm"
              className="gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Download size={15} />
              تحميل ملف .sql
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dev Mode Dialog */}
      <Dialog open={devModeOpen} onOpenChange={setDevModeOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[90vw] w-full h-[90vh] flex flex-col p-0 gap-0 rounded-2xl overflow-hidden">
          <DialogHeader className="p-4 border-b shrink-0 flex flex-row items-center justify-between bg-background">
            <div>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Settings className="text-indigo-500" />
                خيارات المطور - تعديل النصوص المباشر
              </DialogTitle>
              <CardDescription className="text-xs mt-1">
                اضغط على أي نص في الشاشة لتعديله فورياً. التعديلات المعلقة:{" "}
                {Object.keys(editedStrings).length}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className="font-mono text-xs font-bold border-purple-300 text-purple-700 bg-purple-50 dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300"
              >
                v{CURRENT_VERSION}
              </Badge>
              <Button
                onClick={handleCheckGitHubUpdates}
                disabled={isCheckingUpdate}
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs font-bold border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300"
              >
                <RefreshCw size={13} className={isCheckingUpdate ? "animate-spin" : ""} />
                {isCheckingUpdate ? "جاري الفحص..." : "البحث عن تحديثات"}
              </Button>
              <Button
                onClick={() => setDevModeOpen(false)}
                variant="outline"
                size="sm"
                className="gap-1 text-xs"
              >
                <X size={15} />
                تجاهل
              </Button>
              <Button
                onClick={saveDevChangesOnly}
                variant="secondary"
                size="sm"
                className="gap-1 text-xs bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300"
              >
                <Save size={15} />
                حفظ
              </Button>
              <Button onClick={applyDevChanges} size="sm" className="gap-1 text-xs">
                <Check size={15} />
                تطبيق
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 bg-muted relative overflow-hidden">
            {devModeOpen && (
              <iframe
                ref={iframeRef}
                src="/admin"
                className="w-full h-full bg-background border-0"
                onLoad={handleIframeLoad}
                title="Admin Preview"
              />
            )}
            <div className="absolute top-2 right-2 bg-background/90 backdrop-blur text-xs font-bold px-3 py-1.5 rounded-full border shadow-sm pointer-events-none text-foreground">
              وضع التعديل مفعل
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog 1: Download Access Package */}
      <AlertDialog open={showConfirmDownloadAccess} onOpenChange={setShowConfirmDownloadAccess}>
        <AlertDialogContent className="font-cairo max-w-md">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle className="text-lg font-black text-foreground flex items-center gap-2">
              <FileSpreadsheet className="text-emerald-600 dark:text-emerald-400" size={22} />
              تأكيد تنزيل حزمة أكسس الشاملة (Juba.zip)
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed">
              هل أنت أصلًا برغبة في تنزيل كافة بيانات وجداول النظام (الحسابات، المخزون، قائمة
              الطعام، المبيعات، الموظفين والخزائن) في ملف مضغوط بحزمة أكسس Juba.zip؟
              <br />
              <span className="font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
                سيتم إنشاء وتجميع كافة ملفات CSV ومخطط SQL الجاهز للفتح المباشر في برنامج Microsoft
                Access.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-row gap-2 justify-end mt-4">
            <AlertDialogCancel
              onClick={() => setShowConfirmDownloadAccess(false)}
              className="font-bold text-xs"
            >
              إلغاء
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowConfirmDownloadAccess(false);
                handleDownloadAccessPackage();
              }}
              className="font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              تأكيد التنزيل والإنشاء
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog 2: System Update */}
      <AlertDialog open={showConfirmSystemUpdate} onOpenChange={setShowConfirmSystemUpdate}>
        <AlertDialogContent className="font-cairo max-w-md">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle className="text-lg font-black text-foreground flex items-center gap-2">
              <RefreshCw className="text-amber-600 dark:text-amber-400" size={22} />
              تأكيد تحديث السيستم والأكواد البرمجية
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed">
              هل تريد المتابعة لتحديث النظام وإعادة مزامنة البيانات والأكواد فورياً مع قاعدة
              البيانات والروابط المباشرة؟
              <br />
              <span className="font-bold text-amber-600 dark:text-amber-400 mt-1 block">
                سيتم جلب أحدث الحالات وإعادة تنشيط الاتصال في الوقت الفعلي.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-row gap-2 justify-end mt-4">
            <AlertDialogCancel
              onClick={() => setShowConfirmSystemUpdate(false)}
              className="font-bold text-xs"
            >
              إلغاء
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowConfirmSystemUpdate(false);
                handleSystemUpdateAction();
              }}
              className="font-bold text-xs bg-amber-600 hover:bg-amber-700 text-white"
            >
              تأكيد التحديث المباشر
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
