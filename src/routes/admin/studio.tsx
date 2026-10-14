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
import { ElementTreePanel } from "@/features/developer-studio/components/ElementTreePanel";
import { VisualEditorCanvas } from "@/features/developer-studio/components/VisualEditorCanvas";
import { PropertiesPanel } from "@/features/developer-studio/components/PropertiesPanel";
import { PublishModal } from "@/features/developer-studio/components/PublishModal";
import { ConflictResolutionModal } from "@/features/developer-studio/components/ConflictResolutionModal";
import { HistoryRollbackModal } from "@/features/developer-studio/components/HistoryRollbackModal";
import { StudioElementRenderer } from "@/features/developer-studio/components/StudioElementRenderer";
import { LiveAppPreview } from "@/features/developer-studio/components/LiveAppPreview";
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

type AutoSaveStatus = "saved" | "saving" | "unsaved" | "error";

export function DeveloperStudioProPage() {
  const { toast } = useToast();

  // Core Draft State
  const [draft, setDraft] = useState<StudioDraft | null>(null);
  const [activePageId, setActivePageId] = useState<string>("page_dashboard");
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Auto-Save & Status State
  const [saveStatus, setSaveStatus] = useState<AutoSaveStatus>("saved");
  const [lastSavedAt, setLastSavedAt] = useState<string>("");
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Undo / Redo History Stack
  const [historyStack, setHistoryStack] = useState<StudioDraft[]>([]);
  const [historyPointer, setHistoryPointer] = useState<number>(-1);
  const isUndoRedoActionRef = useRef<boolean>(false);

  // Preview Mode
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState<"builder" | "live">("builder");

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
          setLastSavedAt(loadedDraft.updatedAt);
          setSaveStatus(loadedDraft.hasUnpublishedChanges ? "unsaved" : "saved");
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
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  // Push draft to undo stack & trigger autosave
  const commitDraftChange = useCallback(
    (newDraft: StudioDraft) => {
      setDraft(newDraft);
      setSaveStatus("unsaved");

      // Update undo stack if this wasn't an undo/redo
      if (!isUndoRedoActionRef.current) {
        setHistoryStack((prev) => {
          const truncated = prev.slice(0, historyPointer + 1);
          return [...truncated, JSON.parse(JSON.stringify(newDraft))].slice(-25); // cap at 25 steps
        });
        setHistoryPointer((prev) => Math.min(prev + 1, 24));
      }
      isUndoRedoActionRef.current = false;

      // Debounced Autosave (800ms)
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      setSaveStatus("saving");
      autoSaveTimerRef.current = setTimeout(async () => {
        try {
          const res = await studioService.saveDraft(newDraft);
          if (res.success) {
            setSaveStatus("saved");
            setLastSavedAt(res.updatedAt);
          } else {
            setSaveStatus("error");
          }
        } catch {
          setSaveStatus("error");
        }
      }, 800);
    },
    [historyPointer],
  );

  // Undo Handler
  const handleUndo = useCallback(() => {
    if (historyPointer > 0) {
      isUndoRedoActionRef.current = true;
      const targetState = historyStack[historyPointer - 1];
      setHistoryPointer(historyPointer - 1);
      setDraft(JSON.parse(JSON.stringify(targetState)));
      studioService.saveDraft(targetState);
    }
  }, [historyPointer, historyStack]);

  // Redo Handler
  const handleRedo = useCallback(() => {
    if (historyPointer < historyStack.length - 1) {
      isUndoRedoActionRef.current = true;
      const targetState = historyStack[historyPointer + 1];
      setHistoryPointer(historyPointer + 1);
      setDraft(JSON.parse(JSON.stringify(targetState)));
      studioService.saveDraft(targetState);
    }
  }, [historyPointer, historyStack]);

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
        if (draft) {
          studioService.saveDraft(draft).then((result) => {
            setSaveStatus(result.success ? "saved" : "error");
            toast(result.success
              ? { title: "تم حفظ المسودة على الخادم", description: "أكد Supabase حفظ التغييرات." }
              : { title: "لم يتم تأكيد الحفظ السحابي", description: result.error || "التعديلات محفوظة محليًا فقط.", variant: "destructive" });
          }).catch((error) => {
            setSaveStatus("error");
            toast({ title: "فشل حفظ المسودة", description: error?.message || "تعذر الاتصال بالخادم.", variant: "destructive" });
          });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo, draft]);

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
    if (!window.confirm("هل أنت متأكد من إلغاء كافة التعديلات غير المنشورة واستعادة آخر نسخة منشورة؟")) {
      return;
    }

    try {
      setIsLoading(true);
      const fresh = await studioService.discardDraft("admin");
      setDraft(fresh);
      setHistoryStack([JSON.parse(JSON.stringify(fresh))]);
      setHistoryPointer(0);
      setSaveStatus("saved");
      toast({ title: "تم التراجع عن جميع التعديلات غير المنشورة" });
    } catch (e: any) {
      toast({ title: "خطأ في التراجع", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Pre-flight check before opening Publish Modal
  const handleTriggerPublish = async () => {
    if (!draft) return;

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
    <div className="h-[calc(100vh-105px)] flex flex-col overflow-hidden bg-background font-cairo text-right select-none">
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
                <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                  Visual Editor
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
                  📄 {p.name} ({p.route})
                </option>
              ))}
            </select>
          </div>

          {/* Auto-save Status Indicator */}
          <div className="items-center gap-1.5 hidden md:flex">
            {saveStatus === "saving" && (
              <Badge variant="outline" className="gap-1 text-[11px] bg-amber-500/10 text-amber-700 border-amber-500/30">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>جاري الحفظ التلقائي...</span>
              </Badge>
            )}
            {saveStatus === "saved" && (
              <Badge variant="outline" className="gap-1 text-[11px] bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3" />
                <span>المسودة محفوظة</span>
              </Badge>
            )}
            {saveStatus === "unsaved" && (
              <Badge variant="outline" className="gap-1 text-[11px] bg-blue-500/10 text-blue-700 border-blue-500/30">
                <span>تعديلات غير منشورة</span>
              </Badge>
            )}
            {saveStatus === "error" && (
              <Badge variant="outline" className="gap-1 text-[11px] bg-destructive/10 text-destructive border-destructive/30">
                <AlertCircle className="w-3 h-3" />
                <span>فشل الحفظ التلقائي</span>
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
            onClick={() => { setWorkspaceMode("builder"); setIsPreviewMode(false); }}
            className="h-8 px-2.5 text-xs gap-1.5 cursor-pointer font-bold"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>مصمم العناصر</span>
          </Button>
          <Button
            type="button"
            variant={workspaceMode === "live" ? "default" : "outline"}
            size="sm"
            onClick={() => { setWorkspaceMode("live"); setIsPreviewMode(false); }}
            className="h-8 px-2.5 text-xs gap-1.5 cursor-pointer font-bold"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>التطبيق الحقيقي</span>
          </Button>
          <Button
            type="button"
            variant={isPreviewMode ? "default" : "outline"}
            size="sm"
            onClick={() => { setWorkspaceMode("builder"); setIsPreviewMode(!isPreviewMode); }}
            className="h-8 px-2.5 text-xs gap-1.5 cursor-pointer font-bold"
          >
            {isPreviewMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{isPreviewMode ? "إنهاء معاينة المسودة" : "معاينة المسودة"}</span>
          </Button>
        </div>

        {/* Left side (RTL): History, Discard, Publish Action */}
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowHistoryModal(true)}
            className="h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
            title="سجل الإصدارات والاسترجاع"
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">السجل</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDiscardDraft}
            disabled={!draft.hasUnpublishedChanges}
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
      {workspaceMode === "live" ? (
        <LiveAppPreview
          route={activePage.route}
          initialEdits={draft.domEdits || {}}
          onEditsChange={(domEdits) => {
            if (!draft) return;
            commitDraftChange({ ...draft, domEdits, hasUnpublishedChanges: true });
          }}
        />
      ) : isPreviewMode ? (
        /* Structured page preview mode */
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950/5 dark:bg-black/40">
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="bg-card border border-border p-4 rounded-2xl flex items-center justify-between">
              <div>
                <Badge variant="outline" className="mb-1 text-[10px]">
                  وضع المعاينة المباشرة (Draft Preview)
                </Badge>
                <h2 className="text-lg font-black text-foreground">{activePage.name}</h2>
                <p className="text-xs text-muted-foreground font-mono">{activePage.route}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPreviewMode(false)}
                className="text-xs font-bold gap-1 cursor-pointer"
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>العودة للمحرر</span>
              </Button>
            </div>

            {/* Render page root elements */}
            <div className="space-y-3">
              {(activePage.elementIds || [])
                .map((id) => draft.elements[id])
                .filter((el): el is ElementModel => !!el && el.parentId === null)
                .map((element) => (
                  <StudioElementRenderer
                    key={element.id}
                    element={element}
                    allElements={draft.elements}
                    isEditorMode={false}
                  />
                ))}
            </div>
          </div>
        </div>
      ) : (
        /* Standard 3-Panel Visual Workspace */
        <div className="flex-1 flex overflow-hidden">
          {/* Panel 1: Hierarchy Tree & Component Palette (Right side in RTL) */}
          <ElementTreePanel
            pages={draft.pages}
            activePageId={activePageId}
            elements={draft.elements}
            selectedElementId={selectedElementId}
            onSelectPage={(pageId) => {
              setActivePageId(pageId);
              setSelectedElementId(null);
            }}
            onAddPage={handleAddPage}
            onSelectElement={(elementId) => setSelectedElementId(elementId)}
            onAddElement={(type, parentId) => handleAddElement(type, parentId)}
            onDeleteElement={handleDeleteElement}
            onDuplicateElement={handleDuplicateElement}
            onToggleVisibility={(elementId) => {
              const el = draft.elements[elementId];
              if (el) {
                handleUpdateElement(elementId, {
                  layout: { ...el.layout, visibility: !el.layout.visibility },
                });
              }
            }}
            onToggleLock={(elementId) => {
              const el = draft.elements[elementId];
              if (el) {
                handleUpdateElement(elementId, { locked: !el.locked });
              }
            }}
          />

          {/* Panel 2: Interactive WYSIWYG Visual Canvas (Center) */}
          <VisualEditorCanvas
            page={activePage}
            elements={draft.elements}
            selectedElementId={selectedElementId}
            onSelectElement={(id) => setSelectedElementId(id)}
            onUpdateElement={handleUpdateElement}
            onDeleteElement={handleDeleteElement}
            onDuplicateElement={handleDuplicateElement}
            onMoveElement={handleMoveElement}
            onAddElement={(type, parentId) => handleAddElement(type, parentId)}
            className="flex-1"
          />

          {/* Panel 3: Element Properties & Styling Controls (Left side in RTL) */}
          <PropertiesPanel
            element={selectedElement}
            onUpdateElement={handleUpdateElement}
            onDeleteElement={handleDeleteElement}
            onDuplicateElement={handleDuplicateElement}
          />
        </div>
      )}

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
            setDraft((prev) =>
              prev
                ? {
                    ...prev,
                    baseRevision: newRevision,
                    hasUnpublishedChanges: false,
                  }
                : null,
            );
            setSaveStatus("saved");
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
            commitDraftChange(updatedDraft);
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
