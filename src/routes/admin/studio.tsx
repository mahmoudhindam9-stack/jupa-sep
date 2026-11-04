/**
 * Developer Studio Pro — Complete Visual Editor Route (/admin/studio)
 * Production-grade visual application editor with Server-Confirmed Draft/Publish workflows,
 * Optimistic Concurrency, Bounded Undo/Redo history, Named Checkpoints, Design System Manager,
 * Asset Manager, Audits Suite, Command Palette, Diff Comparison, and Real App Central Canvas.
 */

import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  StudioDraft,
  StudioPublishedConfig,
  StudioSaveState,
  ElementModel,
  PageModel,
  ElementType,
  StudioReusableComponent,
  StudioDesignSystem,
  StudioAssetItem,
  DEFAULT_STUDIO_DESIGN_SYSTEM,
  CURRENT_SCHEMA_VERSION,
  validateDraftHierarchy,
  ConflictDetail,
  createStudioId,
  normalizeStudioDraftPageReferences,
  uniquePageElementIds,
  unpackDomEditsAndMeta,
} from "@/features/developer-studio/models/studio.types";
import { studioService, DEFAULT_STUDIO_PUBLISHED_CONFIG } from "@/features/developer-studio/services/studioService";
import { supabase } from "@/integrations/supabase/client";
import { PublishModal } from "@/features/developer-studio/components/PublishModal";
import { ConflictResolutionModal } from "@/features/developer-studio/components/ConflictResolutionModal";
import { HistoryRollbackModal } from "@/features/developer-studio/components/HistoryRollbackModal";
import { LiveAppPreview } from "@/features/developer-studio/components/LiveAppPreview";
import { StudioDesignAndAssetsModal } from "@/features/developer-studio/components/StudioDesignAndAssetsModal";
import { StudioAdvancedToolsModal, StudioToolTab } from "@/features/developer-studio/components/StudioAdvancedToolsModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  Save,
  RotateCcw,
  Undo2,
  Redo2,
  UploadCloud,
  History,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Palette,
  Image as ImageIcon,
  Command,
  ShieldCheck,
  GitCompare,
  Download,
  Keyboard,
  WifiOff,
  RefreshCw,
  BookmarkPlus,
} from "lucide-react";

export const Route = createFileRoute("/admin/studio")({
  head: () => ({
    meta: [
      { title: "استوديو المطور Pro | Restocash" },
      { name: "description", content: "محرر بصري متقدم لتصميم وإدارة الواجهات والمسودات والنشر الآمن" },
    ],
  }),
  component: DeveloperStudioProPage,
});

function DeveloperStudioProPage() {
  const { toast } = useToast();

  // Core Draft & Published State
  const [draft, setDraft] = useState<StudioDraft | null>(null);
  const draftRef = useRef<StudioDraft | null>(null);
  draftRef.current = draft;

  const [publishedConfig, setPublishedConfig] = useState<StudioPublishedConfig>(DEFAULT_STUDIO_PUBLISHED_CONFIG);
  const [serverSavedDraft, setServerSavedDraft] = useState<StudioDraft | null>(null);

  const savingToCloudRef = useRef(false);
  const syncWorkflowInFlightRef = useRef(false);
  const [isSyncWorkflowInProgress, setIsSyncWorkflowInProgress] = useState(false);
  const pendingRealtimeDraftRef = useRef<Record<string, any> | null>(null);
  const remoteConflictWarnedRef = useRef(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [remoteChangesDetected, setRemoteChangesDetected] = useState(false);
  const latestRealtimePublishedRevisionRef = useRef(0);
  const [activePageId, setActivePageId] = useState<string>("page_dashboard");
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedSelector, setSelectedSelector] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  // Recovery banner when browser holds a newer local draft than server
  const [hasNewerLocalDraftBanner, setHasNewerLocalDraftBanner] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Save & Sync Status State (saved | saving | unsaved | offline | conflict | error)
  const [saveStatus, setSaveStatus] = useState<StudioSaveState>("saved");
  const [lastSavedAt, setLastSavedAt] = useState<string>("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveErrorRef = useRef<string | null>(null);
  const draftVersionRef = useRef(0);
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());

  // Undo / Redo Bounded History Stack (max 35 snapshots)
  const [historyStack, setHistoryStack] = useState<StudioDraft[]>([]);
  const [historyPointer, setHistoryPointer] = useState<number>(-1);

  // Modals
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showDesignAndAssetsModal, setShowDesignAndAssetsModal] = useState(false);
  const [designAndAssetsTab, setDesignAndAssetsTab] = useState<"design" | "assets">("design");
  const [assetPickerCallback, setAssetPickerCallback] = useState<((url: string) => void) | undefined>(undefined);
  const [showAdvancedToolsModal, setShowAdvancedToolsModal] = useState(false);
  const [advancedToolsTab, setAdvancedToolsTab] = useState<StudioToolTab>("command");

  const [detectedConflicts, setDetectedConflicts] = useState<ConflictDetail[]>([]);
  const [conflictServerRevision, setConflictServerRevision] = useState<number>(1);

  // Initialize: Load Draft & Published Config from service
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        setIsLoading(true);
        const [serverOrLocalDraft, pubCfg, remoteDraft] = await Promise.all([
          studioService.getDraft("admin"),
          studioService.getPublishedConfig(),
          studioService.getServerSavedDraft("admin"),
        ]);

        const normalized = normalizeStudioDraftPageReferences(serverOrLocalDraft);
        const loadedDraft: StudioDraft = normalized.changed
          ? {
              ...normalized.draft,
              updatedAt: new Date().toISOString(),
              hasUnpublishedChanges: true,
              hasUnsavedLocalChanges: true,
            }
          : normalized.draft;

        if (normalized.changed) {
          studioService.saveLocalDraft(loadedDraft);
        }

        if (mounted) {
          setPublishedConfig(pubCfg);
          setServerSavedDraft(remoteDraft);
          setDraft(loadedDraft);
          const firstPageId = Object.keys(loadedDraft.pages || {})[0] || "page_dashboard";
          setActivePageId(firstPageId);
          setHistoryStack([JSON.parse(JSON.stringify(loadedDraft))]);
          setHistoryPointer(0);
          setLastSavedAt(loadedDraft.hasUnsavedLocalChanges ? "" : loadedDraft.updatedAt);

          if (!navigator.onLine && loadedDraft.hasUnsavedLocalChanges) {
            setSaveStatus("offline");
          } else {
            setSaveStatus(loadedDraft.hasUnsavedLocalChanges ? "unsaved" : "saved");
          }

          if (loadedDraft.hasUnsavedLocalChanges) {
            setHasNewerLocalDraftBanner(true);
          }

          if (normalized.changed) {
            toast({
              title: "تم تنظيف مراجع العناصر المكررة",
              description: "أزلنا التكرار في قوائم العناصر دون حذف أي عنصر مستقل. اضغط «حفظ المسودة» لتأكيد الإصلاح على الخادم.",
            });
          }
        }
      } catch (err: any) {
        toast({
          title: "خطأ في تحميل المسودة",
          description: err.message,
          variant: "destructive",
        });
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    init();

    const handlePubUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) setPublishedConfig(detail);
    };
    window.addEventListener("studio_published_updated", handlePubUpdate);

    return () => {
      mounted = false;
      window.removeEventListener("studio_published_updated", handlePubUpdate);
    };
  }, [toast]);

  // Monitor browser online/offline state for accurate save status
  useEffect(() => {
    const onOffline = () => {
      if (draftRef.current?.hasUnsavedLocalChanges) {
        setSaveStatus("offline");
      }
    };
    const onOnline = () => {
      if (draftRef.current?.hasUnsavedLocalChanges) {
        setSaveStatus((prev) => (prev === "offline" ? "unsaved" : prev));
      }
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  // Keep Studio connected to Supabase Realtime
  useEffect(() => {
    const channel = supabase
      .channel("developer_studio_realtime_sync")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "studio_drafts",
        filter: "owner=eq.admin",
      }, (payload) => {
        if (savingToCloudRef.current) {
          pendingRealtimeDraftRef.current = {
            ...(payload.eventType === "DELETE" ? (payload.old as Record<string, any> || {}) : (payload.new as Record<string, any> || {})),
            __eventType: payload.eventType,
          };
          return;
        }
        const current = draftRef.current;
        if (payload.eventType === "DELETE") {
          if (current?.hasUnsavedLocalChanges) {
            setRemoteChangesDetected(true);
            return;
          }
          return;
        }

        const row = payload.new as Record<string, any>;
        if (!row?.pages || !row?.elements) return;
        const unpacked = unpackDomEditsAndMeta(row.dom_edits || {});
        const incoming: StudioDraft = {
          id: String(row.id || "draft_admin"),
          owner: String(row.owner || "admin"),
          baseRevision: Number(row.base_revision || 1),
          schemaVersion: Number(row.schema_version || CURRENT_SCHEMA_VERSION),
          pages: row.pages || {},
          elements: row.elements || {},
          domEdits: unpacked.domEdits,
          designSystem: unpacked.designSystem || current?.designSystem || DEFAULT_STUDIO_DESIGN_SYSTEM,
          assets: unpacked.assets || current?.assets || [],
          reusableComponents: unpacked.reusableComponents || current?.reusableComponents || [],
          namedSnapshots: unpacked.namedSnapshots || current?.namedSnapshots || [],
          updatedAt: String(row.updated_at || new Date().toISOString()),
          createdAt: String(row.created_at || row.updated_at || new Date().toISOString()),
          serverUpdatedAt: String(row.updated_at || ""),
          hasUnpublishedChanges: true,
          hasUnsavedLocalChanges: false,
        };

        if (current?.hasUnsavedLocalChanges) {
          setRemoteChangesDetected(true);
          if (!remoteConflictWarnedRef.current) {
            remoteConflictWarnedRef.current = true;
            toast({
              title: "وصل تحديث آخر للمسودة",
              description: "احتفظنا بتعديلاتك المحلية. قبل المزامنة، احفظ محليًا ثم عالج تعارض الإصدار إذا لزم.",
              variant: "destructive",
            });
          }
          return;
        }
        if (current?.updatedAt && Date.parse(current.updatedAt) >= Date.parse(incoming.updatedAt)) return;

        studioService.acceptRealtimeDraft(incoming);
        setDraft(incoming);
        setServerSavedDraft(incoming);
        setLastSavedAt(incoming.updatedAt);
        setSaveStatus("saved");
        setSaveError(null);
        setHistoryStack([JSON.parse(JSON.stringify(incoming))]);
        setHistoryPointer(0);
        setRemoteChangesDetected(false);
        remoteConflictWarnedRef.current = false;
      })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "studio_published_configs",
        filter: "id=eq.active",
      }, (payload) => {
        if (payload.eventType === "DELETE") return;
        const row = payload.new as Record<string, any>;
        if (!row?.pages) return;
        const unpacked = unpackDomEditsAndMeta(row.dom_edits || {});
        const published: StudioPublishedConfig = {
          id: String(row.id || "active"),
          revision: Number(row.revision || 1),
          schemaVersion: Number(row.schema_version || CURRENT_SCHEMA_VERSION),
          schema_version: Number(row.schema_version || CURRENT_SCHEMA_VERSION),
          publishedAt: String(row.published_at || new Date().toISOString()),
          publishedBy: String(row.published_by || "system"),
          summary: String(row.summary || "Published version"),
          pages: row.pages || {},
          elements: row.elements || {},
          domEdits: unpacked.domEdits,
          designSystem: unpacked.designSystem,
          assets: unpacked.assets,
          reusableComponents: unpacked.reusableComponents,
        };
        latestRealtimePublishedRevisionRef.current = Math.max(
          latestRealtimePublishedRevisionRef.current,
          published.revision,
        );
        studioService.acceptRealtimePublishedConfig(published);
        setPublishedConfig(published);
        const current = draftRef.current;
        if (current && published.revision > current.baseRevision) {
          setRemoteChangesDetected(true);
          if (!remoteConflictWarnedRef.current) {
            remoteConflictWarnedRef.current = true;
            toast({
              title: "تم نشر إصدار أحدث",
              description: `الإصدار المنشور الآن #${published.revision}. ستُفحص التوافقات قبل مزامنة مسودتك؛ لم نستبدل تعديلاتك المحلية.`,
              variant: "destructive",
            });
          }
        }
      })
      .subscribe((status) => {
        setIsRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
      setIsRealtimeConnected(false);
    };
  }, [toast]);

  // Confirmed Cloud Draft Persistence Queue
  const persistDraft = useCallback((snapshot: StudioDraft) => {
    const versionAtSave = draftVersionRef.current;
    const operation = async () => {
      setSaveStatus("saving");
      try {
        const result = await studioService.saveDraft(snapshot);
        if (result.success) {
          if (versionAtSave === draftVersionRef.current) {
            setSaveStatus("saved");
            setLastSavedAt(result.updatedAt);
            setSaveError(null);
            saveErrorRef.current = null;
            setHasNewerLocalDraftBanner(false);
            const confirmedDraft: StudioDraft = {
              ...snapshot,
              updatedAt: result.updatedAt,
              serverUpdatedAt: result.updatedAt,
              hasUnsavedLocalChanges: false,
            };
            setServerSavedDraft(confirmedDraft);
            setDraft((current) =>
              current && versionAtSave === draftVersionRef.current
                ? {
                    ...current,
                    updatedAt: result.updatedAt,
                    serverUpdatedAt: result.updatedAt,
                    hasUnsavedLocalChanges: false,
                  }
                : current,
            );
            toast({ title: "تم حفظ المسودة على Supabase", description: "تم تأكيد حفظ التغييرات على الخادم بنجاح." });
          } else {
            const current = draftRef.current;
            if (current?.hasUnsavedLocalChanges) {
              const rebasedNewer = {
                ...current,
                serverUpdatedAt: result.updatedAt,
                hasUnsavedLocalChanges: true,
              };
              const savedLocal = studioService.saveLocalDraft(rebasedNewer);
              const latestLocal = { ...rebasedNewer, updatedAt: savedLocal.updatedAt };
              setDraft(latestLocal);
              if (!savedLocal.success) {
                setSaveError(savedLocal.error || "تعذر الاحتفاظ بالتعديلات الأحدث محليًا.");
              }
            }
            setSaveStatus("unsaved");
            toast({
              title: "تمت مزامنة النسخة السابقة",
              description: "حفظ الخادم اللقطة السابقة فقط، واحتفظنا بالتعديلات الأحدث محليًا. يمكنك الضغط على «حفظ المسودة» مرة أخرى.",
            });
          }
        } else {
          const message = result.error || "لم يؤكد الخادم حفظ المسودة.";
          setSaveStatus(result.offline ? "offline" : result.conflict ? "conflict" : "error");
          setSaveError(message);
          saveErrorRef.current = message;
          toast({
            title: "فشل حفظ المسودة على الخادم",
            description: message + " التعديلات المحلية محفوظة ويمكنك إعادة المحاولة.",
            variant: "destructive",
          });
        }
        return result;
      } catch (error: any) {
        const message = error?.message || "تعذر الاتصال بخادم Supabase.";
        setSaveStatus(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error");
        setSaveError(message);
        saveErrorRef.current = message;
        toast({ title: "فشل حفظ المسودة", description: message, variant: "destructive" });
        return { success: false, error: message };
      }
    };
    const queued = saveQueueRef.current.catch(() => undefined).then(operation);
    saveQueueRef.current = queued.then(() => undefined, () => undefined);
    return queued;
  }, [toast]);

  // Immediate local-first draft recovery on every edit
  const commitDraftChange = useCallback(
    (changedDraft: StudioDraft) => {
      const changed: StudioDraft = {
        ...changedDraft,
        updatedAt: new Date().toISOString(),
        hasUnsavedLocalChanges: true,
        hasUnpublishedChanges: true,
      };
      draftVersionRef.current += 1;
      studioService.saveLocalDraft(changed);
      setDraft(changed);
      setSaveError(null);
      saveErrorRef.current = null;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setSaveStatus("offline");
      } else {
        setSaveStatus(syncWorkflowInFlightRef.current ? "saving" : "unsaved");
      }

      setHistoryStack((prev) => {
        const truncated = prev.slice(0, historyPointer + 1);
        return [...truncated, JSON.parse(JSON.stringify(changed))].slice(-35);
      });
      setHistoryPointer((prev) => Math.min(prev + 1, 34));
    },
    [historyPointer],
  );

  // Undo / Redo
  const handleUndo = useCallback(() => {
    if (historyPointer <= 0) return;
    const targetState: StudioDraft = {
      ...JSON.parse(JSON.stringify(historyStack[historyPointer - 1])),
      updatedAt: new Date().toISOString(),
      hasUnsavedLocalChanges: true,
    };
    draftVersionRef.current += 1;
    studioService.saveLocalDraft(targetState);
    setHistoryPointer(historyPointer - 1);
    setDraft(targetState);
    setSaveStatus(syncWorkflowInFlightRef.current ? "saving" : "unsaved");
    setSaveError(null);
    saveErrorRef.current = null;
  }, [historyPointer, historyStack]);

  const handleRedo = useCallback(() => {
    if (historyPointer >= historyStack.length - 1) return;
    const targetState: StudioDraft = {
      ...JSON.parse(JSON.stringify(historyStack[historyPointer + 1])),
      updatedAt: new Date().toISOString(),
      hasUnsavedLocalChanges: true,
    };
    draftVersionRef.current += 1;
    studioService.saveLocalDraft(targetState);
    setHistoryPointer(historyPointer + 1);
    setDraft(targetState);
    setSaveStatus(syncWorkflowInFlightRef.current ? "saving" : "unsaved");
    setSaveError(null);
    saveErrorRef.current = null;
  }, [historyPointer, historyStack]);

  // Explicit Save Draft to Supabase
  const handleSaveDraft = useCallback(async () => {
    if (!draft || syncWorkflowInFlightRef.current) return;
    const versionBeforeCheck = draftVersionRef.current;
    syncWorkflowInFlightRef.current = true;
    setIsSyncWorkflowInProgress(true);
    try {
      const local = studioService.saveLocalDraft({ ...draft, hasUnsavedLocalChanges: true });
      if (!local.success) {
        setSaveStatus("error");
        setSaveError(local.error || "تعذر حفظ النسخة المحلية.");
        toast({ title: "فشل الحفظ المحلي", description: local.error, variant: "destructive" });
        return;
      }
      let snapshot: StudioDraft = { ...draft, updatedAt: local.updatedAt, hasUnsavedLocalChanges: true };
      setDraft(snapshot);
      setSaveStatus("saving");

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const msg = "لا يوجد اتصال بالإنترنت حاليًا. تم حفظ تعديلاتك محليًا ويمكنك إعادة المحاولة فور عودة الاتصال.";
        setSaveStatus("offline");
        setSaveError(msg);
        toast({ title: "وضع عدم الاتصال (Offline)", description: msg, variant: "destructive" });
        return;
      }

      const validation = validateDraftHierarchy(snapshot);
      if (!validation.valid) {
        const message = "تم الاحتفاظ بالتعديلات محليًا، لكن لم تتم المزامنة لوجود مشكلات توافق: " + validation.errors.slice(0, 5).join(" • ");
        setSaveStatus("error");
        setSaveError(message);
        toast({ title: "المسودة تحتاج إلى تصحيح", description: message, variant: "destructive" });
        return;
      }

      const compatibility = await studioService.checkConflicts(snapshot);
      if (compatibility.error) {
        setSaveStatus("error");
        setSaveError(compatibility.error);
        toast({
          title: "تعذر التحقق من توافق Supabase",
          description: compatibility.error + " التعديلات محفوظة محليًا ويمكنك إعادة المحاولة.",
          variant: "destructive",
        });
        return;
      }
      if (compatibility.hasConflict) {
        setDetectedConflicts(compatibility.conflicts);
        setConflictServerRevision(compatibility.serverRevision);
        setShowConflictModal(true);
        setSaveStatus("conflict");
        setSaveError("توجد نسخة منشورة أحدث؛ عالج التعارض قبل مزامنة المسودة.");
        setRemoteChangesDetected(true);
        toast({
          title: "التعديلات محفوظة محليًا — توجد نسخة أحدث",
          description: "لم نكتب فوق المسودة البعيدة. افتح حل التعارض ثم احفظ مرة أخرى.",
          variant: "destructive",
        });
        return;
      }

      const draftSyncCompatibility = await studioService.checkDraftSyncCompatibility(snapshot);
      if (!draftSyncCompatibility.compatible) {
        const message = draftSyncCompatibility.error || "تغيّرت المسودة السحابية من جلسة أخرى.";
        setSaveStatus(draftSyncCompatibility.serverDraft ? "conflict" : "error");
        setSaveError(message);
        setRemoteChangesDetected(true);
        toast({
          title: "تم الاحتفاظ بالتعديلات محليًا",
          description: message,
          variant: "destructive",
        });
        return;
      }

      if (draftSyncCompatibility.needsRebase && draftSyncCompatibility.serverDraft) {
        const serverDraft = draftSyncCompatibility.serverDraft;
        const serverEdits = serverDraft.domEdits || {};
        const localEdits = snapshot.domEdits || {};
        const mergedEdits: Record<string, any> = { ...serverEdits };
        for (const [selector, localEdit] of Object.entries(localEdits) as Array<[string, any]>) {
          const serverEdit = mergedEdits[selector] || {};
          mergedEdits[selector] = {
            ...serverEdit,
            ...localEdit,
            ...(serverEdit.styles || localEdit.styles
              ? { styles: { ...(serverEdit.styles || {}), ...(localEdit.styles || {}) } }
              : {}),
          };
        }
        snapshot = {
          ...snapshot,
          id: serverDraft.id || snapshot.id,
          serverUpdatedAt: draftSyncCompatibility.serverUpdatedAt || serverDraft.updatedAt,
          domEdits: mergedEdits,
          hasUnsavedLocalChanges: true,
        };
        const rebasedLocal = studioService.saveLocalDraft(snapshot);
        if (!rebasedLocal.success) {
          setSaveStatus("error");
          setSaveError(rebasedLocal.error || "تعذر حفظ المسودة المدمجة محليًا.");
          toast({ title: "فشل حفظ النسخة المدمجة محليًا", description: rebasedLocal.error, variant: "destructive" });
          return;
        }
        snapshot = { ...snapshot, updatedAt: rebasedLocal.updatedAt };
        setDraft(snapshot);
      }

      if (draftVersionRef.current !== versionBeforeCheck) {
        setSaveStatus("unsaved");
        setSaveError("تم الاحتفاظ بأحدث تعديلاتك محليًا. اضغط «حفظ المسودة» مرة أخرى لإجراء فحص توافق جديد.");
        toast({
          title: "ظهرت تعديلات أحدث أثناء الفحص",
          description: "لم تتم مزامنة لقطة قديمة. أعد الحفظ لمزامنة أحدث نسخة محلية.",
          variant: "destructive",
        });
        return;
      }

      if (latestRealtimePublishedRevisionRef.current > snapshot.baseRevision) {
        const currentRevision = latestRealtimePublishedRevisionRef.current;
        setDetectedConflicts([
          {
            type: "revision_gap",
            targetId: "system",
            title: "تعارض في رقم الإصدار",
            localValue: snapshot.baseRevision,
            serverValue: currentRevision,
            description: `وصل إشعار Realtime بالإصدار المنشور #${currentRevision} أثناء فحص التوافق.`,
          },
        ]);
        setConflictServerRevision(currentRevision);
        setShowConflictModal(true);
        setSaveStatus("conflict");
        setSaveError("وصل إصدار أحدث أثناء الفحص؛ لم تتم المزامنة.");
        setRemoteChangesDetected(true);
        return;
      }

      savingToCloudRef.current = true;
      try {
        const syncResult = await persistDraft(snapshot);
        const pendingRemote = pendingRealtimeDraftRef.current;
        pendingRealtimeDraftRef.current = null;
        if (pendingRemote) {
          const remoteTime = Date.parse(String(pendingRemote.updated_at || ""));
          const savedTime = Date.parse(String((syncResult as any)?.updatedAt || ""));
          if (
            pendingRemote.__eventType === "DELETE" ||
            (syncResult?.success && Number.isFinite(remoteTime) && remoteTime > savedTime)
          ) {
            const current = draftRef.current || snapshot;
            const preserved = { ...current, hasUnsavedLocalChanges: true };
            const localAgain = studioService.saveLocalDraft(preserved);
            setDraft({ ...preserved, updatedAt: localAgain.updatedAt });
            setSaveStatus(localAgain.success ? "conflict" : "error");
            setSaveError("تغيّرت المسودة من جلسة أخرى أثناء المزامنة. احتفظنا بتعديلاتك محليًا؛ أعد فحص التوافق قبل المزامنة التالية.");
            setRemoteChangesDetected(true);
            remoteConflictWarnedRef.current = true;
          } else if (syncResult?.success) {
            const newerPublishedExists = latestRealtimePublishedRevisionRef.current > snapshot.baseRevision;
            setRemoteChangesDetected(newerPublishedExists);
            if (!newerPublishedExists) remoteConflictWarnedRef.current = false;
          }
        } else if (syncResult?.success) {
          const newerPublishedExists = latestRealtimePublishedRevisionRef.current > snapshot.baseRevision;
          setRemoteChangesDetected(newerPublishedExists);
          if (!newerPublishedExists) remoteConflictWarnedRef.current = false;
        }
      } finally {
        savingToCloudRef.current = false;
      }
    } finally {
      syncWorkflowInFlightRef.current = false;
      setIsSyncWorkflowInProgress(false);
    }
  }, [draft, persistDraft, toast]);

  // Global Keyboard Shortcuts (Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y, Ctrl+S, Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void handleSaveDraft();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAdvancedToolsTab("command");
        setShowAdvancedToolsModal(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo, handleSaveDraft]);

  // Warn before browser navigation when unsaved local edits exist
  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (!draft?.hasUnsavedLocalChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [draft?.hasUnsavedLocalChanges]);

  // Page Operations
  const handleAddPage = useCallback(
    (name: string, route: string) => {
      if (!draft) return;
      const normalizedRoute = (route.trim().startsWith("/") ? route.trim() : `/${route.trim()}`).replace(/\/+$/, "") || "/";
      const duplicateRoute = Object.values(draft.pages).find(
        (page) => ((page.route || "").trim().replace(/\/+$/, "") || "/").toLocaleLowerCase() === normalizedRoute.toLocaleLowerCase(),
      );
      if (duplicateRoute) {
        toast({
          title: "مسار الصفحة مستخدم بالفعل",
          description: `المسار ${duplicateRoute.route} مرتبط بالصفحة «${duplicateRoute.name}». اختر مسارًا مختلفًا لمنع تكرار الصفحات.`,
          variant: "destructive",
        });
        return;
      }
      const pageId = createStudioId("page", Object.keys(draft.pages));
      const newPage: PageModel = {
        id: pageId,
        name,
        route: normalizedRoute,
        elementIds: [],
        styles: { padding: "16px" },
        visibleInNav: true,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        revision: draft.baseRevision,
        updatedAt: new Date().toISOString(),
        updatedBy: "admin",
      };

      const newDraft: StudioDraft = {
        ...draft,
        pages: {
          ...draft.pages,
          [pageId]: newPage,
        },
        hasUnpublishedChanges: true,
      };

      commitDraftChange(newDraft);
      setActivePageId(pageId);
      toast({ title: `تم إنشاء صفحة "${name}" بنجاح` });
    },
    [draft, commitDraftChange, toast],
  );

  const handleDuplicatePage = useCallback(
    (pageId: string) => {
      if (!draft || !draft.pages[pageId]) return;
      const source = draft.pages[pageId];
      const newPageId = createStudioId("page", Object.keys(draft.pages));
      const baseRoute = source.route === "/" ? "/home-copy" : `${source.route}-copy`;
      let candidateRoute = baseRoute;
      let counter = 2;
      const existingRoutes = new Set(Object.values(draft.pages).map((p) => p.route.toLowerCase()));
      while (existingRoutes.has(candidateRoute.toLowerCase())) {
        candidateRoute = `${baseRoute}-${counter++}`;
      }

      const duplicatedPage: PageModel = {
        ...JSON.parse(JSON.stringify(source)),
        id: newPageId,
        name: `${source.name} (نسخة)`,
        route: candidateRoute,
        elementIds: [],
        updatedAt: new Date().toISOString(),
      };

      commitDraftChange({
        ...draft,
        pages: {
          ...draft.pages,
          [newPageId]: duplicatedPage,
        },
      });
      setActivePageId(newPageId);
      toast({ title: "تم تكرار الصفحة", description: `تم إنشاء "${duplicatedPage.name}" بالمسار ${candidateRoute}` });
    },
    [draft, commitDraftChange, toast],
  );

  const handleDeletePage = useCallback(
    (pageId: string) => {
      if (!draft || !draft.pages[pageId]) return;
      if (Object.keys(draft.pages).length <= 1) {
        toast({ title: "لا يمكن حذف الصفحة الوحيدة", variant: "destructive" });
        return;
      }
      const nextPages = { ...draft.pages };
      const deletedName = nextPages[pageId].name;
      delete nextPages[pageId];

      const nextElements = { ...draft.elements };
      Object.keys(nextElements).forEach((elId) => {
        if (nextElements[elId].pageId === pageId) {
          delete nextElements[elId];
        }
      });

      commitDraftChange({
        ...draft,
        pages: nextPages,
        elements: nextElements,
      });
      if (activePageId === pageId) {
        setActivePageId(Object.keys(nextPages)[0] || "page_dashboard");
      }
      toast({ title: `تم حذف الصفحة "${deletedName}"` });
    },
    [draft, activePageId, commitDraftChange, toast],
  );

  const handleUpdatePageMeta = useCallback(
    (pageId: string, updates: Partial<PageModel>) => {
      if (!draft || !draft.pages[pageId]) return;
      const current = draft.pages[pageId];
      if (updates.route) {
        const normalizedRoute = (updates.route.trim().startsWith("/") ? updates.route.trim() : `/${updates.route.trim()}`).replace(/\/+$/, "") || "/";
        const duplicate = Object.values(draft.pages).find(
          (p) => p.id !== pageId && ((p.route || "").trim().replace(/\/+$/, "") || "/").toLowerCase() === normalizedRoute.toLowerCase(),
        );
        if (duplicate) {
          toast({
            title: "المسار مستخدم بالفعل",
            description: `المسار ${normalizedRoute} مستخدم في صفحة "${duplicate.name}".`,
            variant: "destructive",
          });
          return;
        }
        updates.route = normalizedRoute;
      }
      commitDraftChange({
        ...draft,
        pages: {
          ...draft.pages,
          [pageId]: {
            ...current,
            ...updates,
            updatedAt: new Date().toISOString(),
          },
        },
      });
      toast({ title: "تم تحديث إعدادات الصفحة" });
    },
    [draft, commitDraftChange, toast],
  );

  const handleSaveReusableComponent = useCallback(
    (comp: Omit<StudioReusableComponent, "id" | "createdAt">) => {
      if (!draft) return;
      const existingIds = (draft.reusableComponents || []).map((c) => c.id);
      const fullComp: StudioReusableComponent = {
        ...comp,
        id: createStudioId("comp", existingIds),
        createdAt: new Date().toISOString(),
      };
      const list = [...(draft.reusableComponents || []), fullComp];
      commitDraftChange({
        ...draft,
        reusableComponents: list,
      });
      toast({ title: "تم حفظ المكون القابل لإعادة الاستخدام", description: `أضيف "${fullComp.name}" إلى مكتبة المكونات.` });
    },
    [draft, commitDraftChange, toast],
  );

  const handleCreateQuickCheckpoint = useCallback(() => {
    if (!draft) return;
    const label = `نقطة استرجاع سريعة #${(draft.namedSnapshots?.length || 0) + 1}`;
    const { draft: updated } = studioService.createNamedSnapshot(draft, label);
    commitDraftChange(updated);
    toast({ title: "تم حفظ نقطة استرجاع (Checkpoint)", description: label });
  }, [draft, commitDraftChange, toast]);

  // Discard unsaved local draft changes (restore last server-confirmed draft)
  const handleDiscardDraft = async () => {
    if (!draft?.hasUnsavedLocalChanges) return;
    if (!window.confirm("سيتم تجاهل التعديلات التي لم تحفظها يدويًا واسترجاع آخر مسودة أكد Supabase حفظها. هل تريد المتابعة؟")) {
      return;
    }

    try {
      setIsLoading(true);
      const fresh = await studioService.discardDraft("admin");
      draftVersionRef.current += 1;
      setDraft(fresh);
      setActivePageId(Object.keys(fresh.pages || {})[0] || "page_dashboard");
      setSelectedElementId(null);
      setHistoryStack([JSON.parse(JSON.stringify(fresh))]);
      setHistoryPointer(0);
      setSaveStatus("saved");
      setSaveError(null);
      saveErrorRef.current = null;
      setHasNewerLocalDraftBanner(false);
      setLastSavedAt(fresh.updatedAt);
      toast({ title: "تم استرجاع آخر مسودة محفوظة", description: "التعديلات غير المحفوظة تم تجاهلها." });
    } catch (e: any) {
      toast({ title: "تعذر إلغاء التعديلات", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger Publish Modal (PublishModal itself also saves & verifies dirty drafts before publishing)
  const handleTriggerPublish = async () => {
    if (!draft) return;
    const conflictCheck = await studioService.checkConflicts(draft);
    if (conflictCheck.error) {
      toast({ title: "تعذر التحقق من الإصدار الحالي", description: conflictCheck.error, variant: "destructive" });
      return;
    }
    if (conflictCheck.hasConflict) {
      setDetectedConflicts(conflictCheck.conflicts);
      setConflictServerRevision(conflictCheck.serverRevision);
      setShowConflictModal(true);
      return;
    }

    setShowPublishModal(true);
  };

  if (!isMounted || isLoading || !draft) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center gap-3 text-muted-foreground font-cairo">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm font-bold">جاري تحميل استوديو المطور Pro والمسودات...</span>
      </div>
    );
  }

  const activePage = draft.pages[activePageId] || Object.values(draft.pages)[0];

  return (
    <div className="h-[calc(100dvh-88px)] min-h-[560px] flex flex-col overflow-hidden bg-background font-cairo text-right select-none">
      {/* ========================================================= */}
      {/* RECOVERY BANNER WHEN BROWSER HAS NEWER LOCAL DRAFT        */}
      {/* ========================================================= */}
      {hasNewerLocalDraftBanner && draft.hasUnsavedLocalChanges && (
        <div className="shrink-0 bg-amber-500/15 border-b border-amber-500/30 px-4 py-1.5 flex items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span className="font-bold">
              يحتوي المتصفح على مسودة محلية أحدث من الخادم (تمت استعادتها تلقائيًا). يمكنك مزامنتها الآن مع Supabase أو استرجاع نسخة الخادم.
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={() => void handleSaveDraft()}
              disabled={saveStatus === "saving"}
              className="h-6 px-2.5 text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
            >
              حفظ ومزامنة مع الخادم
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void handleDiscardDraft()}
              className="h-6 px-2 text-[11px] cursor-pointer"
            >
              استرجاع نسخة الخادم
            </Button>
            <button
              type="button"
              onClick={() => setHasNewerLocalDraftBanner(false)}
              className="text-[11px] underline px-1 hover:opacity-80 cursor-pointer"
            >
              إخفاء
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TOP WORKSPACE NAVIGATION & CONTROL BAR                    */}
      {/* ========================================================= */}
      <header className="shrink-0 z-30 bg-card border-b border-border px-3 sm:px-4 py-2 flex items-center justify-between gap-2 shadow-2xs flex-wrap">
        {/* Right side (RTL): Brand, Page Selector, Save Status */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </span>
            <div className="hidden sm:block">
              <h1 className="text-xs font-black text-foreground leading-tight flex items-center gap-1.5">
                <span>استوديو المطور Pro</span>
                <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0">
                  v{draft.baseRevision}
                </Badge>
              </h1>
              <p className="text-[10px] text-muted-foreground">
                المنشور الحي #{publishedConfig.revision}
              </p>
            </div>
          </div>

          <div className="h-5 w-px bg-border/80 hidden sm:block" />

          {/* Page Selector dropdown */}
          <div className="flex items-center gap-1.5">
            <select
              value={activePageId}
              onChange={(e) => {
                setActivePageId(e.target.value);
                setSelectedElementId(null);
              }}
              aria-label="اختيار الصفحة الحالية"
              className="text-xs font-bold bg-muted/80 hover:bg-muted border border-border/80 rounded-lg px-2.5 py-1.5 cursor-pointer max-w-[165px] truncate"
            >
              {Object.values(draft.pages || {}).map((p) => (
                <option key={p.id} value={p.id}>
                  📄 {p.name} ({p.route})
                </option>
              ))}
            </select>
          </div>

          {/* Explicit Save States: Saved, Saving, Unsaved, Offline, Conflict, Save Failed + Retry */}
          <div className="items-center gap-1.5 hidden md:flex">
            {saveStatus === "saving" && (
              <Badge variant="outline" className="gap-1 text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/30">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>جاري الحفظ (Saving)...</span>
              </Badge>
            )}
            {saveStatus === "saved" && (
              <Badge variant="outline" className="gap-1 text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3" />
                <span>محفوظ على السحابة (Saved)</span>
              </Badge>
            )}
            {saveStatus === "unsaved" && (
              <Badge variant="outline" className="gap-1 text-[10px] bg-blue-500/10 text-blue-700 border-blue-500/30">
                <span>غير محفوظ سحابيًا (Unsaved)</span>
              </Badge>
            )}
            {saveStatus === "offline" && (
              <Badge variant="outline" className="gap-1 text-[10px] bg-amber-500/15 text-amber-800 border-amber-500/40">
                <WifiOff className="w-3 h-3" />
                <span>وضع عدم الاتصال (Offline — محفوظ محليًا)</span>
              </Badge>
            )}
            {saveStatus === "conflict" && (
              <Badge
                variant="outline"
                onClick={() => setShowConflictModal(true)}
                className="gap-1 text-[10px] bg-amber-500/15 text-amber-800 border-amber-500/40 cursor-pointer hover:bg-amber-500/25"
              >
                <AlertCircle className="w-3 h-3" />
                <span>تعارض إصدارات (Conflict) — اضغط للحل</span>
              </Badge>
            )}
            {saveStatus === "error" && (
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="gap-1 text-[10px] bg-destructive/10 text-destructive border-destructive/30">
                  <AlertCircle className="w-3 h-3" />
                  <span title={saveError || "فشل الحفظ السحابي؛ النسخة المحلية محفوظة"}>فشل الحفظ (Save Failed)</span>
                </Badge>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void handleSaveDraft()}
                  className="h-6 px-2 text-[10px] gap-1 border-destructive/40 text-destructive hover:bg-destructive/10 cursor-pointer"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  إعادة المحاولة
                </Button>
              </div>
            )}

            <Badge
              variant="outline"
              className={
                "gap-1 text-[10px] " +
                (isRealtimeConnected
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-700")
              }
              title="اتصال Supabase Realtime"
            >
              <span className={"h-1.5 w-1.5 rounded-full " + (isRealtimeConnected ? "bg-emerald-500" : "bg-amber-500")} />
              {isRealtimeConnected ? "متصل" : "محلي"}
            </Badge>
          </div>
        </div>

        {/* Center: Design System, Assets, Command Palette, Audits, Undo/Redo, Save Draft */}
        <div className="flex items-center gap-1 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setDesignAndAssetsTab("design");
              setAssetPickerCallback(undefined);
              setShowDesignAndAssetsModal(true);
            }}
            className="h-8 px-2 text-xs gap-1 cursor-pointer"
            title="نظام التصميم والألوان والخطوط (Design System)"
          >
            <Palette className="w-3.5 h-3.5 text-primary" />
            <span className="hidden xl:inline">نظام التصميم</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setDesignAndAssetsTab("assets");
              setAssetPickerCallback(undefined);
              setShowDesignAndAssetsModal(true);
            }}
            className="h-8 px-2 text-xs gap-1 cursor-pointer"
            title="مدير الوسائط والصور والأيقونات (Asset Manager)"
          >
            <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden xl:inline">الوسائط</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setAdvancedToolsTab("audits");
              setShowAdvancedToolsModal(true);
            }}
            className="h-8 px-2 text-xs gap-1 cursor-pointer"
            title="فحص الوصول والتجاوب وتناسق التصميم (Audits)"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden xl:inline">الفحص الذكي</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setAdvancedToolsTab("diff");
              setShowAdvancedToolsModal(true);
            }}
            className="h-8 px-2 text-xs gap-1 cursor-pointer"
            title="مقارنة التغييرات (Draft vs Saved vs Published)"
          >
            <GitCompare className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden 2xl:inline">المقارنة</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setAdvancedToolsTab("command");
              setShowAdvancedToolsModal(true);
            }}
            className="h-8 px-2 text-xs gap-1 cursor-pointer"
            title="لوحة الأوامر السريعة والبحث والاستبدال (Ctrl+K)"
          >
            <Command className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">الأوامر</span>
            <kbd className="hidden sm:inline text-[9px] font-mono bg-muted px-1 rounded">Ctrl+K</kbd>
          </Button>

          <div className="h-4 w-px bg-border mx-0.5" />

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={historyPointer <= 0}
            className="h-8 px-2 text-xs gap-1 cursor-pointer"
            title="تراجع (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRedo}
            disabled={historyPointer >= historyStack.length - 1}
            className="h-8 px-2 text-xs gap-1 cursor-pointer"
            title="إعادة (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCreateQuickCheckpoint}
            className="h-8 px-2 text-xs gap-1 cursor-pointer"
            title="حفظ نقطة استرجاع مسماة (Checkpoint)"
          >
            <BookmarkPlus className="w-3.5 h-3.5 text-primary" />
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleSaveDraft()}
            disabled={saveStatus === "saving" || isSyncWorkflowInProgress || !draft.hasUnsavedLocalChanges}
            className="h-8 px-2.5 text-xs gap-1.5 cursor-pointer font-bold border-primary/30 hover:bg-primary/5"
            title={saveError || "حفظ المسودة على Supabase دون تغيير النسخة المنشورة الحية (Ctrl+S)"}
          >
            {saveStatus === "saving" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{saveStatus === "saving" ? "جاري الحفظ..." : "حفظ المسودة"}</span>
          </Button>
        </div>

        {/* Left side (RTL): History, Shortcuts, Discard, Publish Action */}
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowHistoryModal(true)}
            className="h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
            title="سجل الإصدارات ونقاط الاسترجاع والمقارنة"
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">السجل</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setAdvancedToolsTab("export");
              setShowAdvancedToolsModal(true);
            }}
            className="h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
            title="تصدير واستيراد المشروع (JSON)"
          >
            <Download className="w-3.5 h-3.5" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setAdvancedToolsTab("shortcuts");
              setShowAdvancedToolsModal(true);
            }}
            className="h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
            title="اختصارات لوحة المفاتيح"
          >
            <Keyboard className="w-3.5 h-3.5" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDiscardDraft}
            disabled={!draft.hasUnsavedLocalChanges}
            className="h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-destructive cursor-pointer disabled:opacity-40"
            title="إلغاء التعديلات غير المحفوظة"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleTriggerPublish}
            className="h-8 px-3 text-xs font-black gap-1.5 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            title="حفظ وتأكيد المسودة ثم نشرها للتطبيق الفعلي"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>نشر التغييرات</span>
            <span className="font-mono text-[10px] bg-primary-foreground/20 px-1 py-0.2 rounded">
              #{publishedConfig.revision + 1}
            </span>
          </Button>
        </div>
      </header>

      {/* ========================================================= */}
      {/* MAIN 3-PANEL STUDIO WORKSPACE                             */}
      {/* ========================================================= */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <LiveAppPreview
          route={activePage?.route || "/admin"}
          initialEdits={draft.domEdits || {}}
          publishedEdits={publishedConfig.domEdits || {}}
          publishedRevision={publishedConfig.revision}
          pages={draft.pages}
          activePageId={activePageId}
          reusableComponents={draft.reusableComponents || []}
          designSystem={draft.designSystem || DEFAULT_STUDIO_DESIGN_SYSTEM}
          onSelectPage={(pageId) => {
            setActivePageId(pageId);
            setSelectedElementId(null);
          }}
          onAddPage={handleAddPage}
          onDuplicatePage={handleDuplicatePage}
          onDeletePage={handleDeletePage}
          onUpdatePageMeta={handleUpdatePageMeta}
          onSaveReusableComponent={handleSaveReusableComponent}
          onOpenAssetPicker={(cb) => {
            setAssetPickerCallback(() => cb);
            setDesignAndAssetsTab("assets");
            setShowDesignAndAssetsModal(true);
          }}
          onSelectedDomChange={(sel) => {
            setSelectedSelector(sel);
          }}
          onEditsChange={(domEdits) => {
            if (!draft) return;
            commitDraftChange({ ...draft, domEdits, hasUnpublishedChanges: true });
          }}
        />
      </div>

      {/* ========================================================= */}
      {/* WORKFLOW & PROFESSIONAL TOOL MODALS                       */}
      {/* ========================================================= */}

      {/* 1. Strict Server-Confirmed Publish Modal */}
      {showPublishModal && (
        <PublishModal
          isOpen={showPublishModal}
          onClose={() => setShowPublishModal(false)}
          draft={draft}
          onPublishSuccess={(newRevision) => {
            const now = new Date().toISOString();
            const publishedDraft: StudioDraft = {
              ...draft,
              baseRevision: newRevision,
              updatedAt: now,
              serverUpdatedAt: now,
              hasUnpublishedChanges: false,
              hasUnsavedLocalChanges: false,
            };
            setDraft(publishedDraft);
            setServerSavedDraft(publishedDraft);
            setHistoryStack([JSON.parse(JSON.stringify(publishedDraft))]);
            setHistoryPointer(0);
            setLastSavedAt(now);
            setSaveStatus("saved");
            setSaveError(null);
            setHasNewerLocalDraftBanner(false);
            latestRealtimePublishedRevisionRef.current = Math.max(latestRealtimePublishedRevisionRef.current, newRevision);
            setRemoteChangesDetected(false);
            remoteConflictWarnedRef.current = false;
            studioService.getPublishedConfig().then(setPublishedConfig);
          }}
          onConflictDetected={({ serverRevision }) => {
            studioService.checkConflicts(draft).then((res) => {
              setDetectedConflicts(res.conflicts);
              setConflictServerRevision(serverRevision);
              setShowConflictModal(true);
            });
          }}
        />
      )}

      {/* 2. Concurrency Conflict Modal */}
      {showConflictModal && (
        <ConflictResolutionModal
          isOpen={showConflictModal}
          onClose={() => setShowConflictModal(false)}
          draft={draft}
          conflicts={detectedConflicts}
          serverRevision={conflictServerRevision}
          onResolved={(updatedDraft) => {
            if (updatedDraft.hasUnsavedLocalChanges) {
              commitDraftChange(updatedDraft);
              return;
            }
            draftVersionRef.current += 1;
            studioService.acceptRealtimeDraft(updatedDraft);
            setDraft(updatedDraft);
            setServerSavedDraft(updatedDraft);
            setActivePageId(Object.keys(updatedDraft.pages || {})[0] || "page_dashboard");
            setSelectedElementId(null);
            setHistoryStack([JSON.parse(JSON.stringify(updatedDraft))]);
            setHistoryPointer(0);
            setSaveStatus("saved");
            setSaveError(null);
            setRemoteChangesDetected(false);
            remoteConflictWarnedRef.current = false;
          }}
        />
      )}

      {/* 3. History, Checkpoints & Version Comparison Modal */}
      {showHistoryModal && (
        <HistoryRollbackModal
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          currentRevision={publishedConfig.revision || draft.baseRevision}
          draft={draft}
          onCreateCheckpoint={(name, note) => {
            const { draft: updated } = studioService.createNamedSnapshot(draft, name, note);
            commitDraftChange(updated);
          }}
          onRestoreToDraft={(restoredDraft) => {
            commitDraftChange(restoredDraft);
          }}
          onRollbackSuccess={async (newRevision) => {
            const [fresh, pubCfg] = await Promise.all([
              studioService.getDraft("admin"),
              studioService.getPublishedConfig(),
            ]);
            setDraft(fresh);
            setServerSavedDraft(fresh);
            setPublishedConfig(pubCfg);
            setHistoryStack([JSON.parse(JSON.stringify(fresh))]);
            setHistoryPointer(0);
            setSaveStatus("saved");
            latestRealtimePublishedRevisionRef.current = Math.max(latestRealtimePublishedRevisionRef.current, newRevision);
          }}
        />
      )}

      {/* 4. Design System & Asset Manager Modal */}
      {showDesignAndAssetsModal && (
        <StudioDesignAndAssetsModal
          isOpen={showDesignAndAssetsModal}
          onClose={() => {
            setShowDesignAndAssetsModal(false);
            setAssetPickerCallback(undefined);
          }}
          initialTab={designAndAssetsTab}
          draft={draft}
          onUpdateDraft={(updatedDraft) => {
            commitDraftChange(updatedDraft);
          }}
          onApplyAssetToSelection={(asset) => {
            if (assetPickerCallback) {
              assetPickerCallback(asset.url);
              setAssetPickerCallback(undefined);
              setShowDesignAndAssetsModal(false);
            }
          }}
        />
      )}

      {/* 5. Advanced Tools Suite Modal (Command Palette, Find & Replace, Audits, Diff, Export/Import, Code, AI, Shortcuts) */}
      {showAdvancedToolsModal && (
        <StudioAdvancedToolsModal
          isOpen={showAdvancedToolsModal}
          onClose={() => setShowAdvancedToolsModal(false)}
          initialTab={advancedToolsTab}
          draft={draft}
          activePageId={activePageId}
          selectedElementId={selectedElementId}
          selectedDomSelector={selectedSelector}
          onUpdateDraft={(updatedDraft) => {
            commitDraftChange(updatedDraft);
          }}
          onSelectPage={(pageId) => {
            setActivePageId(pageId);
            setSelectedElementId(null);
          }}
          onSelectElement={(elementId) => {
            setSelectedElementId(elementId);
          }}
          onTriggerSave={() => void handleSaveDraft()}
          onTriggerPublish={() => void handleTriggerPublish()}
          onToggleXRay={() => {
            toast({ title: "وضع الأشعة (X-Ray)", description: "يمكنك تبديل وضع X-Ray مباشرة من شريط المعاينة." });
          }}
          onOpenDesignSystem={() => {
            setShowAdvancedToolsModal(false);
            setDesignAndAssetsTab("design");
            setShowDesignAndAssetsModal(true);
          }}
          onOpenAssets={() => {
            setShowAdvancedToolsModal(false);
            setDesignAndAssetsTab("assets");
            setShowDesignAndAssetsModal(true);
          }}
        />
      )}
    </div>
  );
}
