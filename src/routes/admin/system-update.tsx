import { createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import {
  extractTabParam,
  useSyncedSubTab,
} from "@/components/navigation/navigationRegistry";
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
import { ViewModeToggle, useViewMode } from "@/components/ui/view-mode-toggle";
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

  const tabParam = extractTabParam(location.search, (location as any).searchStr);

  const normalizeSystemTab = (raw?: string | null) => {
    if (!raw || raw === "operations" || raw === "system") return "system";
    if (raw === "definitions" || raw === "access") return "access";
    if (raw === "reports") return "reports";
    return "system";
  };

  const [currentTab, setCurrentTab] = useState(() => normalizeSystemTab(tabParam));

  useEffect(() => {
    setCurrentTab(normalizeSystemTab(tabParam));
  }, [tabParam]);

  useSyncedSubTab("/admin/system-update", currentTab, setCurrentTab, "system");
  const [devDefTool, setDevDefTool] = useState<"access_package" | "github_vercel_config">(
    "access_package",
  );
  const [devOpsTool, setDevOpsTool] = useState<"github_sync" | "backup_restore">("github_sync");
  const [devReportTool, setDevReportTool] = useState<"tables_report" | "release_status">(
    "tables_report",
  );
  const [viewMode, setViewMode] = useViewMode("developer-options", "grid");

  const renderCards = (
    items: Array<{
      id: string;
      title: string;
      icon: any;
      colorClass: string;
      bgClass: string;
      badge?: string;
      active?: boolean;
      onClick: () => void;
    }>,
  ) => (
    <div
      className={
        viewMode === "grid"
          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          : "flex flex-col gap-3"
      }
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card
            key={item.id}
            onClick={item.onClick}
            className={`cursor-pointer transition-all hover:shadow-md border-2 group ${
              item.active
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border/70 hover:border-primary/40 bg-card"
            }`}
          >
            <CardContent
              className={
                viewMode === "grid"
                  ? "p-5 flex flex-col justify-between gap-4 h-full"
                  : "p-4 flex items-center justify-between gap-4"
              }
            >
              <div className="flex items-start gap-3.5">
                <div className={`p-3 rounded-2xl shrink-0 ${item.bgClass} ${item.colorClass}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="space-y-1 text-right">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-base text-foreground group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    {item.badge && (
                      <Badge variant="secondary" className="text-[10px] font-bold">
                        {item.badge}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className={viewMode === "grid" ? "flex justify-end pt-1" : "shrink-0"}>
                <Button
                  size="sm"
                  variant={item.active ? "default" : "outline"}
                  className="font-bold text-xs gap-1.5 rounded-xl"
                >
                  <span>فتح</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  const handleTabChange = (newTab: string) => {
    const normalized = normalizeSystemTab(newTab);
    setCurrentTab(normalized);
    navigate({
      to: "/admin/system-update",
      search: normalized === "system" ? {} : { tab: normalized },
    });
  };
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
  const [githubToken, setGithubToken] = useState<string>("");

  useEffect(() => {
    try {
      const token = localStorage.getItem("restocash_github_pat_token");
      if (token) setGithubToken(token);
    } catch {
      // Ignore storage error
    }
  }, []);
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
    } catch {
      // Ignore storage error
    }

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
    } catch {
      // Ignore storage error
    }

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
        description: "تم تنزيل حزمة أكسس الشاملة لقاعدة البيانات في ملف مضغوط باسم Restocash.zip",
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
      {/* Page Content (Controlled by AppBreadcrumbBar: التعريفات / العمليات / التقارير) */}
      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full space-y-6">
        {/* Clean Section Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-4 rounded-2xl border shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600">
              <Code className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-foreground">
                خيارات المطور والنسخ الاحتياطي
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={`gap-1.5 px-2.5 py-1 font-bold text-xs rounded-xl ${
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
              {isLiveSynced ? "متزامن لحظياً" : "إعادة المزامنة..."}
            </Badge>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 border border-border rounded-xl text-xs font-bold">
              <span className="text-muted-foreground">الإصدار:</span>
              <span className="font-mono text-primary font-black">v{CURRENT_VERSION}</span>
            </div>
            <ViewModeToggle mode={viewMode} onChange={setViewMode} />
          </div>
        </div>

        {/* SECTION 1: OPERATIONS (العمليات: تحديث النظام والنسخ الاحتياطي) */}
        <TabsContent value="system" className="space-y-6 mt-4">
          {renderCards([
            {
              id: "github_sync",
              title: "تحديث ومزامنة النظام و GitHub",
              icon: Github,
              colorClass: "text-purple-600",
              bgClass: "bg-purple-500/10",
              badge: `v${CURRENT_VERSION}`,
              active: devOpsTool === "github_sync",
              onClick: () => setDevOpsTool("github_sync"),
            },
            {
              id: "backup_restore",
              title: "النسخ الاحتياطي واستعادة وتصفير البيانات",
              icon: Database,
              colorClass: "text-blue-600",
              bgClass: "bg-blue-500/10",
              badge: "نسخ احتياطي",
              active: devOpsTool === "backup_restore",
              onClick: () => setDevOpsTool("backup_restore"),
            },
            {
              id: "developer_studio",
              title: "استوديو المطور Pro",
              icon: Sparkles,
              colorClass: "text-indigo-600",
              bgClass: "bg-indigo-500/10",
              badge: "متقدم",
              active: false,
              onClick: () => navigate({ to: "/admin/studio" }),
            },
          ])}

          {devOpsTool === "github_sync" && (
            <div className="space-y-6">
              {/* System Version & GitHub Automatic Update */}
              <Card className="border-border/80 shadow-sm rounded-2xl overflow-hidden bg-card">
                <CardHeader className="border-b border-border/40 pb-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
                        <Github size={20} className="text-purple-600 dark:text-purple-400" />
                        فحص التحديثات والمزامنة المباشرة مع GitHub
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={handleCheckGitHubUpdates}
                        disabled={isCheckingUpdate}
                        size="sm"
                        className="gap-1.5 font-black bg-purple-600 hover:bg-purple-700 text-white text-xs rounded-xl cursor-pointer"
                      >
                        <RefreshCw size={14} className={isCheckingUpdate ? "animate-spin" : ""} />
                        {isCheckingUpdate ? "جاري فحص GitHub..." : "البحث عن التحديثات الآن"}
                      </Button>
                      <Button
                        onClick={() => setShowConfirmSystemUpdate(true)}
                        disabled={isUpdatingSystem}
                        variant="outline"
                        size="sm"
                        className="gap-1.5 font-black text-xs rounded-xl border-amber-300 text-amber-700 dark:text-amber-400 cursor-pointer"
                      >
                        <RefreshCw size={14} className={isUpdatingSystem ? "animate-spin" : ""} />
                        {isUpdatingSystem ? "جاري التحديث..." : "مزامنة النظام المباشر"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 space-y-6">
                  {/* Metrics Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-muted/30 border border-border/80 p-4 rounded-xl space-y-1">
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

                    <div className="bg-muted/30 border border-border/80 p-4 rounded-xl space-y-1">
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
                            النظام محدث بالكامل
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
                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-400/50 rounded-2xl p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div>
                          <h4 className="font-black text-sm text-amber-900 dark:text-amber-200 flex items-center gap-2">
                            <Sparkles size={16} className="text-amber-600" />
                            إصدار جديد متاح على GitHub: v{updateInfo.latestVersion}
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
                            className="font-black text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-xl gap-2"
                          >
                            <RefreshCw
                              size={14}
                              className={isApplyingUpdate ? "animate-spin" : ""}
                            />
                            {isApplyingUpdate
                              ? "جاري تثبيت التحديث..."
                              : `تحديث النظام الآن إلى v${updateInfo.latestVersion}`}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Section: Push to GitHub */}
                  <div className="border-t border-border/60 pt-5 space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="font-black text-sm text-foreground flex items-center gap-2">
                          <UploadCloud size={18} className="text-emerald-600" />
                          رفع ومزامنة التحديثات إلى GitHub (Git Push)
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          رفع التعديلات والأكواد فورياً إلى مستودع{" "}
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/20 border border-border/80 p-4 sm:p-5 rounded-2xl">
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
                          className="w-full gap-2 font-black bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm h-10 rounded-xl cursor-pointer"
                        >
                          <UploadCloud size={16} className={isPushing ? "animate-bounce" : ""} />
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
                      </div>
                    </div>

                    {/* Create New Official GitHub Release */}
                    <div className="border border-border/80 bg-muted/20 rounded-2xl p-4 sm:p-5 space-y-4">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                        <div className="flex items-center gap-2">
                          <Rocket className="text-purple-600 dark:text-purple-400" size={18} />
                          <div>
                            <h4 className="font-black text-sm text-foreground">
                              إنشاء ونشر إصدار رسمي جديد (New GitHub Release)
                            </h4>
                          </div>
                        </div>
                        <Badge variant="outline" className="font-mono text-xs shrink-0">
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
                            <label className="text-xs font-bold text-foreground block">
                              ملاحظات الإصدار وسجل التغييرات (Release Notes):
                            </label>
                            <Textarea
                              value={releaseNotes}
                              onChange={(e) => setReleaseNotes(e.target.value)}
                              rows={4}
                              placeholder="اكتب التغييرات والمميزات المضمنة في هذا الإصدار..."
                              className="text-xs rounded-xl font-mono leading-relaxed"
                            />
                          </div>

                          <Button
                            onClick={handleCreateGitHubRelease}
                            disabled={isCreatingRelease || !githubToken.trim()}
                            className="w-full gap-2 font-black bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm h-10 rounded-xl cursor-pointer"
                          >
                            <Rocket
                              size={16}
                              className={isCreatingRelease ? "animate-bounce" : ""}
                            />
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
                                  className="inline-flex items-center gap-1.5 bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-purple-700 transition-colors"
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
                                أوامر إنشاء الإصدار عبر الطرفية:
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const cmds = `git tag -a ${releaseTagName} -m "${releaseTitle}"\ngit push origin ${releaseTagName}`;
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
git push origin ${releaseTagName}`}
                            </pre>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {devOpsTool === "backup_restore" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Cloud & Local Backup Management */}
              <Card className="border-border/70 shadow-sm rounded-2xl overflow-hidden bg-card">
                <CardHeader className="border-b border-border/40 pb-4">
                  <CardTitle className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
                    <Database size={20} className="text-blue-600 dark:text-blue-400" />
                    النسخ الاحتياطي السحابي والمحلي
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 space-y-4">
                  <div className="bg-muted/30 border border-border/80 p-4 rounded-xl space-y-2">
                    <h4 className="font-black text-xs sm:text-sm text-foreground flex items-center gap-1.5">
                      <Layers size={16} className="text-blue-600" /> الحفظ السحابي (Supabase)
                    </h4>
                    <Button
                      onClick={saveDataToDatabase}
                      className="w-full gap-2 font-bold bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm h-10 rounded-xl cursor-pointer"
                    >
                      <Save size={16} />
                      حفظ البيانات سحابياً الآن
                    </Button>
                  </div>

                  <div className="bg-muted/30 border border-border/80 p-4 rounded-xl space-y-2">
                    <h4 className="font-black text-xs sm:text-sm text-foreground">
                      النسخة الاحتياطية المحلية (JSON)
                    </h4>
                    <div className="flex gap-2">
                      <Button
                        onClick={downloadBackup}
                        variant="outline"
                        className="flex-1 gap-1.5 font-bold text-xs h-10 rounded-xl cursor-pointer"
                      >
                        <Download size={15} />
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
                        className="flex-1 gap-1.5 font-bold text-xs h-10 rounded-xl cursor-pointer"
                      >
                        <Upload size={15} />
                        استعادة JSON
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Danger Zone */}
              <Card className="border-red-300 dark:border-red-900 shadow-sm rounded-2xl overflow-hidden bg-card">
                <CardHeader className="bg-red-50 dark:bg-red-950/20 border-b border-red-200 dark:border-red-900/40 pb-4">
                  <CardTitle className="text-base sm:text-lg font-black text-red-700 flex items-center gap-2">
                    <AlertTriangle size={20} />
                    منطقة الخطر (مسح جميع البيانات وتصفير النظام)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 space-y-4">
                  <p className="text-xs sm:text-sm font-bold text-muted-foreground leading-relaxed">
                    سيتم مسح جميع الحركات المالية، والقيود، وأوامر الشراء، وحركات الخزينة، وتصفير
                    جميع الأرصدة. هذه العملية لا رجعة فيها.
                  </p>
                  <Button
                    variant="destructive"
                    className="w-full font-black rounded-xl h-10 cursor-pointer"
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
            </div>
          )}
        </TabsContent>

        {/* SECTION 2: DEFINITIONS (التعريفات: حزمة أكسس وإعدادات الربط السحابي) */}
        <TabsContent value="access" className="space-y-6 mt-4">
          {renderCards([
            {
              id: "access_package",
              title: "حزمة وجداول قاعدة بيانات أكسس (MS Access & SQL Schema)",
              icon: FileSpreadsheet,
              colorClass: "text-emerald-600",
              bgClass: "bg-emerald-500/10",
              badge: `${accessTablesList.length} جداول`,
              active: devDefTool === "access_package",
              onClick: () => setDevDefTool("access_package"),
            },
            {
              id: "github_vercel_config",
              title: "إعدادات مستودع GitHub والربط السحابي (Vercel)",
              icon: Globe,
              colorClass: "text-sky-600",
              bgClass: "bg-sky-500/10",
              badge: "ربط سحابي",
              active: devDefTool === "github_vercel_config",
              onClick: () => setDevDefTool("github_vercel_config"),
            },
          ])}

          {devDefTool === "access_package" && (
            <div className="space-y-6">
              {/* Compact Action Bar for Access Package (replaces giant dark hero card) */}
              <div className="bg-card border border-border/80 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-xl shrink-0">
                    <FileSpreadsheet size={22} />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-black text-foreground">
                      حزمة قاعدة بيانات أكسس الشاملة (Restocash.zip — UTF-8 BOM CSV)
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      تصدير واستيراد جداول النظام بصيغة CSV ومخطط SQL متوافق مع Microsoft Access
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() => setShowConfirmDownloadAccess(true)}
                    disabled={isDownloadingAccess}
                    size="sm"
                    className="gap-1.5 font-black bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 rounded-xl cursor-pointer"
                  >
                    {isDownloadingAccess ? (
                      <RefreshCw size={15} className="animate-spin" />
                    ) : (
                      <Archive size={15} />
                    )}
                    تنزيل حزمة Restocash.zip
                  </Button>

                  <Button
                    onClick={downloadAccessSqlSchemaFile}
                    variant="outline"
                    size="sm"
                    className="gap-1.5 font-bold text-xs h-9 rounded-xl cursor-pointer"
                  >
                    <FileCode size={15} />
                    تحميل مخطط SQL
                  </Button>

                  <Button
                    onClick={() => setShowSchemaDialog(true)}
                    variant="outline"
                    size="sm"
                    className="gap-1.5 font-bold text-xs h-9 rounded-xl cursor-pointer"
                  >
                    <Eye size={15} />
                    معاينة SQL Schema
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
                    size="sm"
                    className="gap-1.5 font-bold text-xs h-9 rounded-xl cursor-pointer"
                  >
                    {isUploadingAccess ? (
                      <RefreshCw size={15} className="animate-spin" />
                    ) : (
                      <Upload size={15} />
                    )}
                    رفع حزمة Access (ZIP/CSV)
                  </Button>
                </div>
              </div>

              {/* Individual Tables Exporter Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {accessTablesList.map((tbl) => (
                  <Card
                    key={tbl.id}
                    className="border-border/70 shadow-sm rounded-xl hover:shadow-md transition flex flex-col justify-between bg-card"
                  >
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-sm font-black text-foreground flex items-center gap-1.5">
                            <Table size={15} className="text-emerald-600 dark:text-emerald-400" />
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
                          className="h-8 text-xs font-bold gap-1.5 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
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
          )}

          {devDefTool === "github_vercel_config" && (
            <div className="space-y-6">
              {/* GitHub Target Repo & Auto-Check Config */}
              <Card className="border-border/80 shadow-sm rounded-2xl bg-card p-5 space-y-4">
                <h3 className="text-base font-black text-foreground flex items-center gap-2">
                  <Github size={18} className="text-purple-600" />
                  إعدادات مستودع GitHub والتحديث التلقائي
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-right">
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
                        className="h-10 text-xs font-bold shrink-0 rounded-xl cursor-pointer"
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

                  <div className="space-y-3 bg-muted/30 p-3.5 rounded-xl border border-border/80 flex items-center justify-between">
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
              </Card>

              {/* Deploy on Vercel Config */}
              <Card className="border-border/80 shadow-sm rounded-2xl bg-card p-5 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <Globe className="text-sky-600 dark:text-sky-400" size={20} />
                    <div>
                      <h4 className="font-black text-sm sm:text-base text-foreground">
                        إعدادات النشر والتشغيل على منصة Vercel (Vercel Deployment)
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        نشر سحابي فوري مرتبط بمستودع GitHub مع دعم التحديث التلقائي (Continuous
                        Deployment)
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
                    <div className="p-3.5 bg-muted/30 rounded-xl border border-border/80 space-y-2 text-xs">
                      <div className="font-bold text-foreground flex items-center gap-1.5">
                        <CheckCircle2 size={15} className="text-sky-600" />
                        حالة تكوين ملف النشر vercel.json:
                      </div>
                      <ul className="space-y-1 text-muted-foreground list-disc list-inside text-[11px] leading-relaxed">
                        <li>
                          <strong>Framework:</strong> Vite SPA
                        </li>
                        <li>
                          <strong>Build Command:</strong>{" "}
                          <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">
                            npm run build
                          </code>
                        </li>
                        <li>
                          <strong>Output Directory:</strong>{" "}
                          <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">
                            dist
                          </code>
                        </li>
                      </ul>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <a
                        href={`https://vercel.com/new/clone?repository-url=${encodeURIComponent(
                          `https://github.com/${updateSettings.repo}`,
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 font-black bg-black hover:bg-neutral-800 text-white text-xs h-10 px-3 rounded-xl transition-all"
                      >
                        ربط ونشر في Vercel (1-Click)
                      </a>

                      <Button
                        variant="outline"
                        onClick={() => {
                          const envVars = `VITE_SUPABASE_URL=https://myqtvbfibvgxkqwxvuru.supabase.co\nVITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15cXR2YmZpYnZneGtxd3h2dXJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MjY0NjgsImV4cCI6MjEwMDQwMjQ2OH0.LDFW826N2GRzG9WnLHgYxoeOcTkDOeLjTiFK6aQ-BSE\nVITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_srgqLn2ZvysGKh47yCQ0Kg_IW02yjDf`;
                          navigator.clipboard.writeText(envVars);
                          toast({
                            title: "تم نسخ متغيرات البيئة",
                            description:
                              "تم نسخ متغيرات Vercel Environment Variables إلى الحافظة",
                          });
                        }}
                        className="text-xs h-10 rounded-xl gap-1.5 font-bold cursor-pointer"
                      >
                        <Copy size={13} />
                        نسخ متغيرات البيئة (.env)
                      </Button>
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
                        {`npm install -g vercel
vercel login
vercel --prod`}
                      </pre>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* SECTION 3: REPORTS (التقارير: حالة الجداول وسجل الإصدارات والمزامنة) */}
        <TabsContent value="reports" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-border/80 rounded-2xl bg-card p-5">
              <div className="text-xs font-bold text-muted-foreground">إصدار النظام الحالي</div>
              <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1 font-mono">
                v{CURRENT_VERSION}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                مستودع: {updateSettings.repo} (main)
              </div>
            </Card>
            <Card className="border-border/80 rounded-2xl bg-card p-5">
              <div className="text-xs font-bold text-muted-foreground">إجمالي جداول النظام</div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {accessTablesList.length} جداول رئيسية
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                إجمالي السجلات:{" "}
                {accessTablesList.reduce((sum, tbl) => sum + (tbl.count || 0), 0)} سجل
              </div>
            </Card>
            <Card className="border-border/80 rounded-2xl bg-card p-5">
              <div className="text-xs font-bold text-muted-foreground">حالة المزامنة الحية</div>
              <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
                {isLiveSynced ? "متصل ومتزامن" : "جاري المزامنة"}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                آخر مزامنة: {lastSyncTime}
              </div>
            </Card>
          </div>

          {renderCards([
            {
              id: "tables_report",
              title: "تقرير إحصائيات جداول النظام والسجلات",
              icon: Table,
              colorClass: "text-emerald-600",
              bgClass: "bg-emerald-500/10",
              badge: `${accessTablesList.length} جداول`,
              active: devReportTool === "tables_report",
              onClick: () => setDevReportTool("tables_report"),
            },
            {
              id: "release_status",
              title: "تقرير حالة الإصدارات والربط السحابي",
              icon: GitBranch,
              colorClass: "text-purple-600",
              bgClass: "bg-purple-500/10",
              badge: `v${CURRENT_VERSION}`,
              active: devReportTool === "release_status",
              onClick: () => setDevReportTool("release_status"),
            },
            {
              id: "sql_schema_preview",
              title: "معاينة مخطط SQL",
              icon: FileCode,
              colorClass: "text-blue-600",
              bgClass: "bg-blue-500/10",
              badge: "SQL",
              active: false,
              onClick: () => setShowSchemaDialog(true),
            },
          ])}

          {devReportTool === "tables_report" ? (
            <Card className="border-border/80 rounded-2xl bg-card overflow-hidden">
              <CardHeader className="border-b border-border/50 p-4 sm:p-5">
                <CardTitle className="text-base font-black text-foreground">
                  بيان إحصائيات جداول النظام والسجلات المحاسبية والتشغيلية
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/60">
                  {accessTablesList.map((tbl) => (
                    <div
                      key={tbl.id}
                      className="p-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition"
                    >
                      <div className="space-y-0.5">
                        <div className="font-black text-sm text-foreground flex items-center gap-2">
                          <span>{tbl.label}</span>
                          <span className="text-[11px] font-mono text-muted-foreground">
                            ({tbl.name})
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{tbl.description}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge variant="outline" className="font-mono font-bold">
                          {tbl.count} سجل
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadAccessSingleTableCsv(tbl.id)}
                          className="h-8 text-xs font-bold gap-1 rounded-xl cursor-pointer"
                        >
                          <ArrowDownToLine size={13} />
                          CSV
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/80 rounded-2xl bg-card p-5 space-y-4">
              <h3 className="text-base font-black text-foreground">
                ملخص الإصدار البرمجي وحالة الربط السحابي (GitHub & Vercel)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-2">
                  <div className="font-black text-foreground">بيانات الإصدار والمستودع</div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الإصدار المثبت:</span>
                    <span className="font-mono font-bold">v{CURRENT_VERSION}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">تاريخ البناء:</span>
                    <span className="font-mono font-bold">{BUILD_DATE}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">المستودع المرتبط:</span>
                    <span className="font-mono font-bold">{updateSettings.repo}</span>
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-2">
                  <div className="font-black text-foreground">بيانات النشر والمزامنة</div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">منصة النشر السحابي:</span>
                    <span className="font-bold text-emerald-600">Vercel SPA Ready ✓</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">التحقق التلقائي من التحديثات:</span>
                    <span className="font-bold">
                      {updateSettings.autoCheck ? "مفعل" : "غير مفعل"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">آخر مزامنة للبيانات:</span>
                    <span className="font-mono font-bold">{lastSyncTime}</span>
                  </div>
                </div>
              </div>
            </Card>
          )}
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



      {/* Confirmation Dialog 1: Download Access Package */}
      <AlertDialog open={showConfirmDownloadAccess} onOpenChange={setShowConfirmDownloadAccess}>
        <AlertDialogContent className="font-cairo max-w-md">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle className="text-lg font-black text-foreground flex items-center gap-2">
              <FileSpreadsheet className="text-emerald-600 dark:text-emerald-400" size={22} />
              تأكيد تنزيل حزمة أكسس الشاملة (Restocash.zip)
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed">
              هل أنت أصلًا برغبة في تنزيل كافة بيانات وجداول النظام (الحسابات، المخزون، قائمة
              الطعام، المبيعات، الموظفين والخزائن) في ملف مضغوط بحزمة أكسس Restocash.zip؟
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
