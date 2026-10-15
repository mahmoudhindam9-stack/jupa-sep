/**
 * Developer Studio Pro — Complete Visual Editor Route (/admin/studio)
 * Production-ready visual editor with Draft/Publish workflows, Optimistic Concurrency,
 * Undo/Redo history, Responsive preview, Element tree, and Deep styling controls.
 */

import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  StudioDraft,
  ElementModel,
  PageModel,
  ElementType,
  CURRENT_SCHEMA_VERSION,
  validateDraftHierarchy,
  ConflictDetail,
} from "@/features/developer-studio/models/studio.types";
import { studioService } from "@/features/developer-studio/services/studioService";
import { supabase } from "@/integrations/supabase/client";
import { ElementTreePanel } from "@/features/developer-studio/components/ElementTreePanel";
import { VisualEditorCanvas } from "@/features/developer-studio/components/VisualEditorCanvas";
import { PropertiesPanel } from "@/features/developer-studio/components/PropertiesPanel";
import { PublishModal } from "@/features/developer-studio/components/PublishModal";
import { ConflictResolutionModal } from "@/features/developer-studio/components/ConflictResolutionModal";
import { HistoryRollbackModal } from "@/features/developer-studio/components/HistoryRollbackModal";
import { StudioElementRenderer } from "@/features/developer-studio/components/StudioElementRenderer";
import { LiveAppPreview } from "@/features/developer-studio/components/LiveAppPreview";
import { WorkflowEditorPanel } from "@/features/developer-studio/components/WorkflowEditorPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  Save,
  RotateCcw,
  Undo2,
  Redo2,
  Eye,
  EyeOff,
  UploadCloud,
  History,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Layers,
  GitBranch,
  Settings2,
  Maximize2,
  ArrowRight,
  ShieldAlert,
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

type SaveStatus = "saved" | "saving" | "unsaved" | "error";

export function DeveloperStudioProPage() {
  const { toast } = useToast();

  // Core Draft State
  const [draft, setDraft] = useState<StudioDraft | null>(null);
  const draftRef = useRef<StudioDraft | null>(null);
  draftRef.current = draft;
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
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Manual Save & Status State
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [lastSavedAt, setLastSavedAt] = useState<string>("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveErrorRef = useRef<string | null>(null);
  const draftVersionRef = useRef(0);
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());

  // Undo / Redo History Stack
  const [historyStack, setHistoryStack] = useState<StudioDraft[]>([]);
  const [historyPointer, setHistoryPointer] = useState<number>(-1);

  // Open on the real application by default; the component builder is available separately.
  const [workspaceMode, setWorkspaceMode] = useState<"builder" | "live" | "workflow" | "app-editor">("live");

  // Modals
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [detectedConflicts, setDetectedConflicts] = useState<ConflictDetail[]>([]);
  const [conflictServerRevision, setConflictServerRevision] = useState<number>(1);

  // Initialize: Load Draft from service
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        setIsLoading(true);
        const loadedDraft = await studioService.getDraft("admin");
        if (mounted) {
          setDraft(loadedDraft);
          const firstPageId = Object.keys(loadedDraft.pages || {})[0] || "page_dashboard";
          setActivePageId(firstPageId);
          setHistoryStack([JSON.parse(JSON.stringify(loadedDraft))]);
          setHistoryPointer(0);
          setLastSavedAt(loadedDraft.hasUnsavedLocalChanges ? "" : loadedDraft.updatedAt);
          setSaveStatus(loadedDraft.hasUnsavedLocalChanges ? "unsaved" : "saved");
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
    return () => {
      mounted = false;
    };
  }, []);

  // Keep Studio connected to Supabase Realtime. Clean local state may accept remote drafts;
  // dirty local edits are never overwritten by another browser/session.
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
        const incoming: StudioDraft = {
          id: String(row.id || "draft_admin"),
          owner: String(row.owner || "admin"),
          baseRevision: Number(row.base_revision || 1),
          schemaVersion: Number(row.schema_version || CURRENT_SCHEMA_VERSION),
          pages: row.pages || {},
          elements: row.elements || {},
          domEdits: row.dom_edits || {},
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
        setLastSavedAt(incoming.updatedAt);
        setSaveStatus("saved");
        setSaveError(null);
        setHistoryStack([JSON.parse(JSON.stringify(incoming))]);
        setHistoryPointer(0);
        setRemoteChangesDetected(false);
        remoteConflictWarnedRef.current = false;
        const firstPageId = Object.keys(incoming.pages || {})[0] || "page_dashboard";
        setActivePageId(firstPageId);
        setSelectedElementId(null);
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
        const published = {
          id: String(row.id || "active"),
          revision: Number(row.revision || 1),
          schemaVersion: Number(row.schema_version || CURRENT_SCHEMA_VERSION),
          schema_version: Number(row.schema_version || CURRENT_SCHEMA_VERSION),
          publishedAt: String(row.published_at || new Date().toISOString()),
          publishedBy: String(row.published_by || "system"),
          summary: String(row.summary || "Published version"),
          pages: row.pages || {},
          elements: row.elements || {},
          domEdits: row.dom_edits || {},
        };
        latestRealtimePublishedRevisionRef.current = Math.max(
          latestRealtimePublishedRevisionRef.current,
          published.revision,
        );
        studioService.acceptRealtimePublishedConfig(published);
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

    const handleOnline = () => {
      // A channel may have reconnected after a network change; refresh its connection state.
      setIsRealtimeConnected(false);
    };
    window.addEventListener("offline", handleOnline);
    window.addEventListener("online", handleOnline);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("offline", handleOnline);
      window.removeEventListener("online", handleOnline);
      setIsRealtimeConnected(false);
    };
  }, [toast]);

  // This queue is invoked exclusively by the explicit Save Draft action (or Ctrl+S).
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
            setDraft((current) => current && versionAtSave === draftVersionRef.current
              ? {
                  ...current,
                  updatedAt: result.updatedAt,
                  serverUpdatedAt: result.updatedAt,
                  hasUnsavedLocalChanges: false,
                }
              : current);
            toast({ title: "تم حفظ المسودة على Supabase", description: "تم تأكيد حفظ التغييرات على الخادم." });
          } else {
            // The server has now confirmed the submitted snapshot. Advance the baseline
            // on the newer local edits so the next save compares against that confirmed row.
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
              description: "حفظ الخادم اللقطة السابقة فقط، واحتفظنا بالتعديلات الأحدث محليًا. يمكنك الضغط على «حفظ ومزامنة» مرة أخرى.",
            });
          }
        } else {
          const message = result.error || "لم يؤكد الخادم حفظ المسودة.";
          setSaveStatus("error");
          setSaveError(message);
          saveErrorRef.current = message;
          toast({
            title: "فشل حفظ التعديلات",
            description: message + " التعديلات المحلية ما زالت موجودة.",
            variant: "destructive",
          });
        }
        return result;
      } catch (error: any) {
        const message = error?.message || "تعذر الاتصال بخادم Supabase.";
        setSaveStatus("error");
        setSaveError(message);
        saveErrorRef.current = message;
        toast({ title: "فشل حفظ التعديلات", description: message, variant: "destructive" });
        return { success: false, error: message };
      }
    };
    const queued = saveQueueRef.current.catch(() => undefined).then(operation);
    saveQueueRef.current = queued.then(() => undefined, () => undefined);
    return queued;
  }, [toast]);

  // Keep edits isolated in the Studio draft and its history. They are not persisted
  // or applied to real application routes until the user explicitly saves/publishes.
  const commitDraftChange = useCallback(
    (changedDraft: StudioDraft) => {
      const changed: StudioDraft = {
        ...changedDraft,
        updatedAt: new Date().toISOString(),
        hasUnsavedLocalChanges: true,
      };
      draftVersionRef.current += 1;
      setDraft(changed);
      setSaveError(null);
      saveErrorRef.current = null;
      setSaveStatus(syncWorkflowInFlightRef.current ? "saving" : "unsaved");

      setHistoryStack((prev) => {
        const truncated = prev.slice(0, historyPointer + 1);
        return [...truncated, JSON.parse(JSON.stringify(changed))].slice(-25);
      });
      setHistoryPointer((prev) => Math.min(prev + 1, 24));
    },
    [historyPointer],
  );

  // Undo and redo restore the preview snapshot only. The live application and
  // the last server-confirmed draft remain untouched until Save & Sync / Publish.
  const handleUndo = useCallback(() => {
    if (historyPointer <= 0) return;
    const targetState: StudioDraft = {
      ...JSON.parse(JSON.stringify(historyStack[historyPointer - 1])),
      updatedAt: new Date().toISOString(),
      hasUnsavedLocalChanges: true,
    };
    draftVersionRef.current += 1;
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
    setHistoryPointer(historyPointer + 1);
    setDraft(targetState);
    setSaveStatus(syncWorkflowInFlightRef.current ? "saving" : "unsaved");
    setSaveError(null);
    saveErrorRef.current = null;
  }, [historyPointer, historyStack]);

  const handleSaveDraft = useCallback(async () => {
    if (!draft || !draft.hasUnsavedLocalChanges || syncWorkflowInFlightRef.current) return;
    const versionBeforeCheck = draftVersionRef.current;
    syncWorkflowInFlightRef.current = true;
    setIsSyncWorkflowInProgress(true);
    try {
      // Stage the exact current snapshot locally before compatibility checks.
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

      // Validate structural compatibility before the single explicit cloud sync.
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
        toast({ title: "تعذر التحقق من توافق Supabase", description: compatibility.error + " التعديلات محفوظة محليًا ويمكنك إعادة المحاولة.", variant: "destructive" });
        return;
      }
      if (compatibility.hasConflict) {
        setDetectedConflicts(compatibility.conflicts);
        setConflictServerRevision(compatibility.serverRevision);
        setShowConflictModal(true);
        setSaveStatus("unsaved");
        setSaveError("توجد نسخة منشورة أحدث؛ عالج التعارض قبل مزامنة المسودة.");
        setRemoteChangesDetected(true);
        toast({ title: "التعديلات محفوظة محليًا — توجد نسخة أحدث", description: "لم نكتب فوق المسودة البعيدة. افتح حل التعارض ثم احفظ مرة أخرى.", variant: "destructive" });
        return;
      }

      // Compare the timestamp of the shared draft row before upserting. Published
      // revision checks alone cannot detect another browser editing the same draft.
      const draftSyncCompatibility = await studioService.checkDraftSyncCompatibility(snapshot);
      if (!draftSyncCompatibility.compatible) {
        const message = draftSyncCompatibility.error || "تغيّرت المسودة السحابية من جلسة أخرى.";
        setSaveStatus("unsaved");
        setSaveError(message);
        setRemoteChangesDetected(true);
        toast({
          title: "تم الاحتفاظ بالتعديلات محليًا",
          description: message,
          variant: "destructive",
        });
        return;
      }

      // If this browser has a legacy local draft without a trustworthy server version,
      // merge server-side DOM edits first while local values win per selector/style.
      // The RPC returns this snapshot securely without requiring a direct table SELECT.
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
        toast({
          title: "تمت مواءمة المسودة المحلية",
          description: draftSyncCompatibility.message || "تم دمج تنسيقات المسودة السحابية مع تغييراتك المحلية قبل المزامنة.",
        });
      }

      // A UI edit made while compatibility was being checked must never be replaced
      // by the older snapshot captured when Save & Sync was clicked.
      if (draftVersionRef.current !== versionBeforeCheck) {
        setSaveStatus("unsaved");
        setSaveError("تم الاحتفاظ بأحدث تعديلاتك محليًا. اضغط «حفظ ومزامنة» مرة أخرى لإجراء فحص توافق جديد.");
        toast({ title: "ظهرت تعديلات أحدث أثناء الفحص", description: "لم تتم مزامنة لقطة قديمة. أعد الحفظ لمزامنة أحدث نسخة محلية.", variant: "destructive" });
        return;
      }

      // Realtime is also a guard against a publication that arrived after the server check.
      if (latestRealtimePublishedRevisionRef.current > snapshot.baseRevision) {
        const currentRevision = latestRealtimePublishedRevisionRef.current;
        setDetectedConflicts([{
          type: "revision_gap",
          targetId: "system",
          title: "تعارض في رقم الإصدار",
          localValue: snapshot.baseRevision,
          serverValue: currentRevision,
          description: `وصل إشعار Realtime بالإصدار المنشور #${currentRevision} أثناء فحص التوافق.`,
        }]);
        setConflictServerRevision(currentRevision);
        setShowConflictModal(true);
        setSaveStatus("unsaved");
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
          if (pendingRemote.__eventType === "DELETE" || (syncResult?.success && Number.isFinite(remoteTime) && remoteTime > savedTime)) {
            // A second browser changed the same row during our write. Do not silently
            // replace our current draft; keep it locally and require another compatibility check.
            const current = draftRef.current || snapshot;
            const preserved = { ...current, hasUnsavedLocalChanges: true };
            const localAgain = studioService.saveLocalDraft(preserved);
            setDraft({ ...preserved, updatedAt: localAgain.updatedAt });
            setSaveStatus(localAgain.success ? "unsaved" : "error");
            setSaveError("تغيّرت المسودة من جلسة أخرى أثناء المزامنة. احتفظنا بتعديلاتك محليًا؛ أعد فحص التوافق قبل المزامنة التالية.");
            setRemoteChangesDetected(true);
            remoteConflictWarnedRef.current = true;
            toast({
              title: "تعارض مزامنة متزامنة",
              description: "تم رصد كتابة أخرى أثناء الحفظ. لم نستبدل تعديلاتك المحلية؛ راجع التوافق ثم أعد المزامنة.",
              variant: "destructive",
            });
          } else if (syncResult?.success) {
            const newerPublishedExists = latestRealtimePublishedRevisionRef.current > snapshot.baseRevision;
            setRemoteChangesDetected(newerPublishedExists);
            if (!newerPublishedExists) remoteConflictWarnedRef.current = false;
          } else if (pendingRemote.__eventType !== "DELETE") {
            setRemoteChangesDetected(true);
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

  // Keyboard shortcut listener (Ctrl+Z, Ctrl+Y, Ctrl+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === "y") {
        e.preventDefault();
        handleRedo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void handleSaveDraft();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo, handleSaveDraft]);

  // Warn before browser-level navigation when manual edits have not been saved.
  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (!draft?.hasUnsavedLocalChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [draft?.hasUnsavedLocalChanges]);

  // Update specific element
  const handleUpdateElement = useCallback(
    (elementId: string, updates: Partial<ElementModel>) => {
      if (!draft) return;
      const currentEl = draft.elements[elementId];
      if (!currentEl) return;

      const updatedElement: ElementModel = {
        ...currentEl,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      const newDraft: StudioDraft = {
        ...draft,
        elements: {
          ...draft.elements,
          [elementId]: updatedElement,
        },
        hasUnpublishedChanges: true,
      };

      commitDraftChange(newDraft);
    },
    [draft, commitDraftChange],
  );

  // Add new element to active page
  const handleAddElement = useCallback(
    (type: ElementType, parentId: string | null = null) => {
      if (!draft) return;
      const newId = `elem_${type}_${Date.now().toString(36)}`;

      // Default content tailored by type
      let defaultContent: Record<string, any> = {};
      let defaultStyles: Record<string, any> = { marginBottom: "14px" };

      switch (type) {
        case "heading":
          defaultContent = { text: "عنوان جديد", level: "h2" };
          defaultStyles = { ...defaultStyles, fontSize: "20px", fontWeight: "700" };
          break;
        case "text":
          defaultContent = { text: "هنا نص توضيحي جديد يمكن تعديله عبر لوحة الخصائص.", format: "plain" };
          defaultStyles = { ...defaultStyles, fontSize: "14px", lineHeight: "1.6" };
          break;
        case "button":
          defaultContent = { label: "زر إجراء جديد", variant: "default", action: "none" };
          break;
        case "image":
          defaultContent = {
            src: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80",
            alt: "صورة جديدة",
            fit: "cover",
          };
          defaultStyles = { ...defaultStyles, width: "100%", height: "200px", borderRadius: "12px" };
          break;
        case "card":
          defaultContent = { title: "بطاقة محتوى جديدة", description: "أدخل تفاصيل البطاقة هنا.", showHeader: true };
          defaultStyles = {
            ...defaultStyles,
            backgroundColor: "#ffffff",
            borderColor: "#e2e8f0",
            borderWidth: "1px",
            borderRadius: "16px",
            paddingTop: "16px",
            paddingBottom: "16px",
            paddingLeft: "20px",
            paddingRight: "20px",
            boxShadow: "sm",
          };
          break;
        case "badge":
          defaultContent = { label: "شارة نشطة", variant: "default" };
          break;
        case "input":
          defaultContent = { label: "حقل إدخال جديد", placeholder: "أدخل البيانات هنا..." };
          break;
        case "container":
          defaultContent = { direction: "column", wrap: true };
          defaultStyles = {
            ...defaultStyles,
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            paddingTop: "12px",
            paddingBottom: "12px",
            paddingLeft: "12px",
            paddingRight: "12px",
            borderWidth: "1px",
            borderStyle: "dashed",
            borderColor: "#cbd5e1",
            borderRadius: "12px",
          };
          break;
        case "divider":
          defaultContent = { label: "" };
          break;
        default:
          defaultContent = {};
      }

      const newElement: ElementModel = {
        id: newId,
        pageId: activePageId,
        parentId,
        type,
        content: defaultContent,
        styles: defaultStyles,
        layout: { position: "static", order: (draft.pages[activePageId]?.elementIds?.length || 0) + 1, visibility: true },
        attributes: {},
        locked: false,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        revision: draft.baseRevision,
        updatedAt: new Date().toISOString(),
        updatedBy: "admin",
      };

      const activePage = draft.pages[activePageId];
      const updatedElementIds = [...(activePage?.elementIds || []), newId];

      const newDraft: StudioDraft = {
        ...draft,
        pages: {
          ...draft.pages,
          [activePageId]: {
            ...activePage,
            elementIds: updatedElementIds,
            updatedAt: new Date().toISOString(),
          },
        },
        elements: {
          ...draft.elements,
          [newId]: newElement,
        },
        hasUnpublishedChanges: true,
      };

      commitDraftChange(newDraft);
      setSelectedElementId(newId);
      toast({ title: `تمت إضافة عنصر (${type}) جديد` });
    },
    [draft, activePageId, commitDraftChange],
  );

  // Delete element safely
  const handleDeleteElement = useCallback(
    (elementId: string) => {
      if (!draft) return;
      const el = draft.elements[elementId];
      if (!el) return;

      if (el.locked) {
        toast({ title: "لا يمكن حذف عنصر مقفل", variant: "destructive" });
        return;
      }

      // Remove from page elementIds and elements map
      const activePage = draft.pages[el.pageId];
      const updatedElementIds = (activePage?.elementIds || []).filter((id) => id !== elementId);

      const updatedElements = { ...draft.elements };
      delete updatedElements[elementId];

      // Also clean up any children where parentId === elementId
      Object.keys(updatedElements).forEach((id) => {
        if (updatedElements[id].parentId === elementId) {
          updatedElements[id] = { ...updatedElements[id], parentId: null };
        }
      });

      const newDraft: StudioDraft = {
        ...draft,
        pages: {
          ...draft.pages,
          [el.pageId]: {
            ...activePage,
            elementIds: updatedElementIds,
            updatedAt: new Date().toISOString(),
          },
        },
        elements: updatedElements,
        hasUnpublishedChanges: true,
      };

      commitDraftChange(newDraft);
      if (selectedElementId === elementId) {
        setSelectedElementId(null);
      }
      toast({ title: "تم حذف العنصر بنجاح" });
    },
    [draft, selectedElementId, commitDraftChange],
  );

  // Duplicate element
  const handleDuplicateElement = useCallback(
    (elementId: string) => {
      if (!draft) return;
      const source = draft.elements[elementId];
      if (!source) return;

      const newId = `elem_${source.type}_${Date.now().toString(36)}`;
      const duplicated: ElementModel = {
        ...JSON.parse(JSON.stringify(source)),
        id: newId,
        locked: false,
        updatedAt: new Date().toISOString(),
      };

      const activePage = draft.pages[source.pageId];
      const sourceIndex = (activePage?.elementIds || []).indexOf(elementId);
      const updatedElementIds = [...(activePage?.elementIds || [])];
      updatedElementIds.splice(sourceIndex + 1, 0, newId);

      const newDraft: StudioDraft = {
        ...draft,
        pages: {
          ...draft.pages,
          [source.pageId]: {
            ...activePage,
            elementIds: updatedElementIds,
            updatedAt: new Date().toISOString(),
          },
        },
        elements: {
          ...draft.elements,
          [newId]: duplicated,
        },
        hasUnpublishedChanges: true,
      };

      commitDraftChange(newDraft);
      setSelectedElementId(newId);
      toast({ title: "تم تكرار العنصر بنجاح" });
    },
    [draft, commitDraftChange],
  );

  // Move element Up/Down in order
  const handleMoveElement = useCallback(
    (elementId: string, direction: "up" | "down") => {
      if (!draft) return;
      const el = draft.elements[elementId];
      if (!el) return;

      const activePage = draft.pages[el.pageId];
      if (!activePage) return;

      const list = [...activePage.elementIds];
      const index = list.indexOf(elementId);
      if (index === -1) return;

      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= list.length) return;

      // Swap
      const temp = list[index];
      list[index] = list[targetIndex];
      list[targetIndex] = temp;

      const newDraft: StudioDraft = {
        ...draft,
        pages: {
          ...draft.pages,
          [el.pageId]: {
            ...activePage,
            elementIds: list,
            updatedAt: new Date().toISOString(),
          },
        },
        hasUnpublishedChanges: true,
      };

      commitDraftChange(newDraft);
    },
    [draft, commitDraftChange],
  );

  // Add new page to draft
  const handleAddPage = useCallback(
    (name: string, route: string) => {
      if (!draft) return;
      const pageId = `page_${Date.now().toString(36)}`;
      const newPage: PageModel = {
        id: pageId,
        name,
        route,
        elementIds: [],
        styles: { padding: "16px" },
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
    [draft, commitDraftChange],
  );

  // Discard draft completely (reset to latest published)
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
      setLastSavedAt(fresh.updatedAt);
      toast({ title: "تم استرجاع آخر مسودة محفوظة", description: "التعديلات غير المحفوظة تم تجاهلها." });
    } catch (e: any) {
      toast({ title: "تعذر إلغاء التعديلات", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Pre-flight check before opening Publish Modal
  const handleTriggerPublish = async () => {
    if (!draft) return;
    if (draft.hasUnsavedLocalChanges) {
      toast({
        title: "احفظ المسودة أولًا",
        description: "اضغط «حفظ ومزامنة» وانتظر تأكيد Supabase قبل نشر التغييرات.",
        variant: "destructive",
      });
      return;
    }

    // Check conflict first
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
  const selectedElement = selectedElementId ? draft.elements[selectedElementId] : null;

  return (
    <div className="h-[calc(100dvh-88px)] min-h-[560px] flex flex-col overflow-hidden bg-background font-cairo text-right select-none">
      {/* ========================================================= */}
      {/* TOP WORKSPACE NAVIGATION & CONTROL BAR                    */}
      {/* ========================================================= */}
      <header className="shrink-0 z-30 bg-card border-b border-border px-3 sm:px-5 py-2.5 flex items-center justify-between gap-3 shadow-2xs">
        {/* Right side (RTL): Brand, Page Selector, Revision */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </span>
            <div className="hidden sm:block">
              <h1 className="text-sm font-black text-foreground leading-tight flex items-center gap-1.5">
                <span>استوديو المطور Pro</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  تصميم بصري
                </Badge>
              </h1>
              <p className="text-[10px] text-muted-foreground">
                الإصدار المرجعي #{draft.baseRevision}
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
              className="text-xs font-bold bg-muted/80 hover:bg-muted border border-border/80 rounded-lg px-2.5 py-1.5 cursor-pointer max-w-[160px] truncate"
            >
              {Object.values(draft.pages || {}).map((p) => (
                <option key={p.id} value={p.id}>
                  📄 {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Local-first save and Supabase synchronization status */}
          <div className="items-center gap-1.5 hidden md:flex">
            {saveStatus === "saving" && (
              <Badge variant="outline" className="gap-1 text-[11px] bg-amber-500/10 text-amber-700 border-amber-500/30">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>فحص التوافق ومزامنة المسودة...</span>
              </Badge>
            )}
            {saveStatus === "saved" && (
              <Badge variant="outline" className="gap-1 text-[11px] bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3" />
                <span>المسودة متزامنة مع Supabase</span>
              </Badge>
            )}
            {saveStatus === "unsaved" && (
              <Badge variant="outline" className="gap-1 text-[11px] bg-blue-500/10 text-blue-700 border-blue-500/30">
                <span>تعديلات غير محفوظة — في المعاينة</span>
              </Badge>
            )}
            {saveStatus === "error" && (
              <Badge variant="outline" className="gap-1 text-[11px] bg-destructive/10 text-destructive border-destructive/30">
                <AlertCircle className="w-3 h-3" />
                <span title={saveError || "تعذرت المزامنة السحابية؛ النسخة المحلية باقية"}>فشلت المزامنة — النسخة المحلية محفوظة</span>
              </Badge>
            )}
            <Badge
              variant="outline"
              className={"gap-1 text-[10px] " + (isRealtimeConnected
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                : "border-amber-500/30 bg-amber-500/10 text-amber-700")}
              title="اتصال Supabase Realtime لتلقي تغييرات المسودات والإصدارات من الجلسات الأخرى"
            >
              <span className={"h-1.5 w-1.5 rounded-full " + (isRealtimeConnected ? "bg-emerald-500" : "bg-amber-500")} />
              {isRealtimeConnected ? "Realtime متصل" : "Realtime غير متصل"}
            </Badge>
            {remoteChangesDetected && (
              <Badge variant="destructive" className="gap-1 text-[10px]" title="تم رصد تغيير بعيد؛ ستُعاد مراجعة التوافق قبل المزامنة">
                <AlertCircle className="h-3 w-3" /> تغييرات بعيدة
              </Badge>
            )}
          </div>
        </div>

        {/* Center: Undo / Redo & Preview Toggle */}
        <div className="flex items-center gap-1.5">
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
            <span className="hidden lg:inline">تراجع</span>
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
            <span className="hidden lg:inline">إعادة</span>
          </Button>

          <Button
            type="button"
            variant={workspaceMode === "builder" ? "default" : "outline"}
            size="sm"
            onClick={() => setWorkspaceMode("builder")}
            className="h-8 px-2.5 text-xs gap-1.5 cursor-pointer font-bold"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>مصمم العناصر</span>
          </Button>
          <Button
            type="button"
            variant={workspaceMode === "workflow" ? "default" : "outline"}
            size="sm"
            onClick={() => setWorkspaceMode("workflow")}
            className="h-8 px-2.5 text-xs gap-1.5 cursor-pointer font-bold"
            title="إضافة خطوات وربطها ومعاينة النتيجة"
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>مسارات العمل</span>
          </Button>
          <Button
            type="button"
            variant={workspaceMode === "app-editor" ? "default" : "outline"}
            size="sm"
            onClick={() => setWorkspaceMode("app-editor")}
            className="h-8 px-2.5 text-xs gap-1.5 cursor-pointer font-bold"
            title="تعديل عناصر الشاشة الحقيقية في معاينة معزولة"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>تعديل الواجهة</span>
          </Button>
          <Button
            type="button"
            variant={workspaceMode === "live" ? "default" : "outline"}
            size="sm"
            onClick={() => setWorkspaceMode("live")}
            className="h-8 px-2.5 text-xs gap-1.5 cursor-pointer font-bold"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>التطبيق الحقيقي</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleSaveDraft()}
            disabled={saveStatus === "saving" || isSyncWorkflowInProgress || !draft.hasUnsavedLocalChanges}
            className="h-8 px-2.5 text-xs gap-1.5 cursor-pointer font-bold"
            title={saveError || "حفظ محلي أولًا، فحص التوافق، ثم مزامنة Supabase (Ctrl+S)"}
          >
            {saveStatus === "saving" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{saveStatus === "saving" ? "جاري المزامنة" : "حفظ ومزامنة"}</span>
          </Button>
        </div>

        {/* Left side (RTL): History, Discard, Publish Action */}
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              if (draft.hasUnsavedLocalChanges) {
                toast({ title: "احفظ المسودة أولًا", description: "افتح سجل الإصدارات بعد حفظ التعديلات الحالية أو إلغائها.", variant: "destructive" });
                return;
              }
              setShowHistoryModal(true);
            }}
            className="h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
            title={draft.hasUnsavedLocalChanges ? "احفظ المسودة أولًا قبل فتح سجل الإصدارات" : "سجل الإصدارات والاسترجاع"}
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">السجل</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDiscardDraft}
            disabled={!draft.hasUnsavedLocalChanges}
            className="h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-destructive cursor-pointer disabled:opacity-40"
            title="إلغاء التعديلات غير المنشورة"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">إلغاء التعديلات</span>
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleTriggerPublish}
            className="h-8 px-3 text-xs font-black gap-1.5 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>نشر التغييرات</span>
            <span className="font-mono text-[10px] bg-primary-foreground/20 px-1 py-0.2 rounded">
              #{draft.baseRevision + 1}
            </span>
          </Button>
        </div>
      </header>

      {/* ========================================================= */}
      {/* MAIN WORKSPACE BODY                                       */}
      {/* ========================================================= */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {workspaceMode === "live" || workspaceMode === "app-editor" ? (
          <LiveAppPreview
            route={activePage?.route || "/admin"}
            designerMode={workspaceMode === "app-editor"}
            initialEdits={draft.domEdits || {}}
            onEditsChange={(domEdits) => {
              if (!draft) return;
              commitDraftChange({ ...draft, domEdits, hasUnpublishedChanges: true });
            }}
          />
        ) : workspaceMode === "builder" ? (
          <div className="h-full min-w-0 flex overflow-hidden">
            <ElementTreePanel
              pages={draft.pages}
              activePageId={activePageId}
              elements={draft.elements}
              selectedElementId={selectedElementId}
              onSelectPage={(pageId) => { setActivePageId(pageId); setSelectedElementId(null); }}
              onAddPage={handleAddPage}
              onSelectElement={setSelectedElementId}
              onAddElement={handleAddElement}
              onDeleteElement={handleDeleteElement}
              onDuplicateElement={handleDuplicateElement}
              onToggleVisibility={(elementId) => {
                const target = draft.elements[elementId];
                if (target) handleUpdateElement(elementId, { layout: { ...target.layout, visibility: !target.layout.visibility } });
              }}
              onToggleLock={(elementId) => {
                const target = draft.elements[elementId];
                if (target) handleUpdateElement(elementId, { locked: !target.locked });
              }}
            />
            {activePage ? (
              <VisualEditorCanvas
                page={activePage}
                elements={draft.elements}
                selectedElementId={selectedElementId}
                onSelectElement={setSelectedElementId}
                onUpdateElement={handleUpdateElement}
                onDeleteElement={handleDeleteElement}
                onDuplicateElement={handleDuplicateElement}
                onMoveElement={handleMoveElement}
                onAddElement={handleAddElement}
                className="min-w-0"
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">لا توجد صفحة محددة للتصميم.</div>
            )}
            <PropertiesPanel
              element={selectedElement}
              pages={draft.pages}
              elements={draft.elements}
              onUpdateElement={handleUpdateElement}
              onDeleteElement={handleDeleteElement}
              onDuplicateElement={handleDuplicateElement}
            />
          </div>
        ) : (
          <div className="h-full min-w-0 flex overflow-hidden">
            <ElementTreePanel
              pages={draft.pages}
              activePageId={activePageId}
              elements={draft.elements}
              selectedElementId={selectedElementId}
              onSelectPage={(pageId) => { setActivePageId(pageId); setSelectedElementId(null); }}
              onAddPage={handleAddPage}
              onSelectElement={setSelectedElementId}
              onAddElement={handleAddElement}
              onDeleteElement={handleDeleteElement}
              onDuplicateElement={handleDuplicateElement}
              onToggleVisibility={(elementId) => {
                const target = draft.elements[elementId];
                if (target) handleUpdateElement(elementId, { layout: { ...target.layout, visibility: !target.layout.visibility } });
              }}
              onToggleLock={(elementId) => {
                const target = draft.elements[elementId];
                if (target) handleUpdateElement(elementId, { locked: !target.locked });
              }}
            />
            <WorkflowEditorPanel
              element={selectedElement}
              elements={draft.elements}
              onUpdateElement={handleUpdateElement}
              onAddButton={() => handleAddElement("button")}
            />
            <PropertiesPanel
              element={selectedElement}
              pages={draft.pages}
              elements={draft.elements}
              onUpdateElement={handleUpdateElement}
              onDeleteElement={handleDeleteElement}
              onDuplicateElement={handleDuplicateElement}
            />
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* WORKFLOW MODALS                                           */}
      {/* ========================================================= */}

      {/* 1. Publish Modal */}
      {showPublishModal && (
        <PublishModal
          isOpen={showPublishModal}
          onClose={() => setShowPublishModal(false)}
          draft={draft}
          onPublishSuccess={(newRevision) => {
            const publishedDraft: StudioDraft = {
              ...draft,
              baseRevision: newRevision,
              hasUnpublishedChanges: false,
              hasUnsavedLocalChanges: false,
            };
            setDraft(publishedDraft);
            setHistoryStack([JSON.parse(JSON.stringify(publishedDraft))]);
            setHistoryPointer(0);
            setLastSavedAt(publishedDraft.updatedAt);
            setSaveStatus("saved");
            setSaveError(null);
            latestRealtimePublishedRevisionRef.current = Math.max(latestRealtimePublishedRevisionRef.current, newRevision);
            setRemoteChangesDetected(false);
            remoteConflictWarnedRef.current = false;
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
            // "Reload latest" returns a clean server-confirmed snapshot; don't mark it dirty.
            draftVersionRef.current += 1;
            studioService.acceptRealtimeDraft(updatedDraft);
            setDraft(updatedDraft);
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

      {/* 3. History & Rollback Modal */}
      {showHistoryModal && (
        <HistoryRollbackModal
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          currentRevision={draft.baseRevision}
          onRollbackSuccess={async (newRevision) => {
            const fresh = await studioService.getDraft("admin");
            setDraft(fresh);
            setHistoryStack([JSON.parse(JSON.stringify(fresh))]);
            setHistoryPointer(0);
            setSaveStatus("saved");
          }}
        />
      )}
    </div>
  );
}
