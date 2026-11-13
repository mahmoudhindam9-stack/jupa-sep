import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Eye,
  EyeOff,
  Layers,
  Monitor,
  RefreshCw,
  Settings2,
  Smartphone,
  Tablet,
  Trash2,
  Maximize2,
  Minimize2,
  ExternalLink,
  Grid,
  ScanEye,
  Plus,
  Lock,
  Unlock,
  FolderPlus,
  Sparkles,
  ChevronLeft,
  ChevronDown,
  Search,
  FilePlus,
  BookmarkPlus,
  Wand2,
  Clipboard,
  ClipboardPaste,
  CheckSquare,
  Scissors,
  RotateCcw,
  Image as ImageIcon,
  Type,
  Palette,
  Layout,
  Sliders,
  Play,
  Move,
  Zap,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type {
  StudioDomEdit,
  StudioFreePositionConfig,
  StudioPastedNode,
  PageModel,
  ElementModel,
  ElementType,
  StudioDesignSystem,
  StudioReusableComponent,
  ViewportBreakpoint,
} from "../models/studio.types";
import { DEFAULT_STUDIO_DESIGN_SYSTEM, createStudioId } from "../models/studio.types";
import {
  STUDIO_ACTION_REGISTRY,
  STUDIO_REGISTERED_PAGES,
  detectElementAssignedAction,
  validateActionBindingSecurity,
  type StudioElementActionBinding,
  type StudioActionType,
} from "../services/studioActionRegistry";
import { StudioSectionSaveDiscardBar } from "./StudioSectionSaveDiscardBar";

export type SelectedDomElement = {
  selector: string;
  ancestors: Array<{ selector: string; tag: string; label: string }>;
  tag: string;
  text: string;
  originalText?: string;
  color: string;
  backgroundColor: string;
  fontSize: string;
  fontWeight: string;
  fontFamily: string;
  lineHeight: string;
  letterSpacing: string;
  width: string;
  height: string;
  minWidth: string;
  maxWidth: string;
  minHeight: string;
  maxHeight: string;
  paddingTop: string;
  paddingRight: string;
  paddingBottom: string;
  paddingLeft: string;
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;
  display: string;
  flexDirection: string;
  justifyContent: string;
  alignItems: string;
  gap: string;
  gridTemplateColumns?: string;
  position: string;
  zIndex: string;
  overflow: string;
  borderWidth: string;
  borderStyle: string;
  borderColor: string;
  fill: string;
  stroke: string;
  strokeWidth: string;
  opacity: string;
  borderRadius: string;
  rotate: string;
  textAlign: string;
  idAttr: string;
  classNameAttr: string;
  ariaLabel: string;
  roleAttr: string;
  hrefAttr: string;
  srcAttr: string;
  altAttr: string;
  rectWidth: number;
  rectHeight: number;
};

function toHexColor(raw: string | undefined | null, fallback = "#111827"): string {
  if (!raw || typeof raw !== "string") return fallback;
  const val = raw.trim();
  if (/^#[0-9a-f]{6}$/i.test(val)) return val.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(val)) {
    return (
      "#" +
      val[1] +
      val[1] +
      val[2] +
      val[2] +
      val[3] +
      val[3]
    ).toLowerCase();
  }
  const rgbMatch = val.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (rgbMatch) {
    const alpha = rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1;
    if (alpha === 0) return fallback;
    const r = Math.max(0, Math.min(255, parseInt(rgbMatch[1], 10)));
    const g = Math.max(0, Math.min(255, parseInt(rgbMatch[2], 10)));
    const b = Math.max(0, Math.min(255, parseInt(rgbMatch[3], 10)));
    return (
      "#" +
      [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")
    ).toLowerCase();
  }
  return fallback;
}

type LiveTreeNode = {
  selector: string;
  tag: string;
  label: string;
  children: LiveTreeNode[];
};

type LiveRoute = { href: string; label: string };

type ContextMenuState = {
  x: number;
  y: number;
  selector: string;
  tag: string;
} | null;

type Props = {
  route: string;
  initialEdits: Record<string, StudioDomEdit>;
  publishedEdits?: Record<string, StudioDomEdit>;
  publishedRevision?: number;
  designSystem?: StudioDesignSystem;
  pages?: Record<string, PageModel>;
  activePageId?: string;
  elements?: Record<string, ElementModel>;
  reusableComponents?: StudioReusableComponent[];
  onEditsChange: (edits: Record<string, StudioDomEdit>) => void;
  onSelectPage?: (pageId: string) => void;
  onAddPage?: (name: string, route: string) => void;
  onDuplicatePage?: (pageId: string) => void;
  onDeletePage?: (pageId: string) => void;
  onUpdatePageMeta?: (pageId: string, updates: Partial<PageModel>) => void;
  onAddElement?: (type: ElementType, parentId?: string | null) => void;
  onSaveReusableComponent?: (comp: Omit<StudioReusableComponent, "id" | "createdAt">) => void;
  onOpenAssetPicker?: (onPicked: (url: string) => void) => void;
  onSelectedDomChange?: (selector: string | null) => void;
  onOpenDrawer?: () => void;
  closeDrawersSignal?: number;
  externalXRayMode?: boolean;
  designerMode?: boolean;
  hasUnsavedChanges?: boolean;
  isSaving?: boolean;
  onSaveChanges?: () => void;
  onDiscardChanges?: () => void;
};

export type PreviewSize = "desktop" | "tablet" | "mobile";

const BUILTIN_COMPONENT_LIBRARY: Array<{
  type: ElementType;
  label: string;
  category: string;
  description: string;
  defaultStyles: Record<string, string>;
}> = [
  {
    type: "card",
    label: "بطاقة مؤشر أداء (KPI Card)",
    category: "البطاقات",
    description: "بطاقة إحصائية مع عنوان ووصف وتنسيق احترافي",
    defaultStyles: {
      backgroundColor: "#ffffff",
      borderRadius: "16px",
      paddingTop: "16px",
      paddingBottom: "16px",
      paddingRight: "20px",
      paddingLeft: "20px",
      borderWidth: "1px",
      borderColor: "#e2e8f0",
    },
  },
  {
    type: "button",
    label: "زر إجراء أساسي (Primary CTA)",
    category: "الأزرار",
    description: "زر تفاعلي قابل للربط بصفحة أو معادلة أو رسالة",
    defaultStyles: {
      backgroundColor: "#4f46e5",
      color: "#ffffff",
      borderRadius: "10px",
      paddingTop: "10px",
      paddingBottom: "10px",
      paddingRight: "18px",
      paddingLeft: "18px",
      fontWeight: "700",
    },
  },
  {
    type: "heading",
    label: "عنوان قسم رئيسي (Section Heading)",
    category: "النصوص",
    description: "عنوان عريض متوافق مع التدرج الهرمي H1-H6",
    defaultStyles: { fontSize: "22px", fontWeight: "800", color: "#0f172a" },
  },
  {
    type: "text",
    label: "فقرة نصية توضيحية",
    category: "النصوص",
    description: "نص وصفي متجاوب بارتفاع سطر مريح للقراءة",
    defaultStyles: { fontSize: "14px", lineHeight: "1.65", color: "#475569" },
  },
  {
    type: "container",
    label: "حاوية تخطيط مرنة (Flex Container)",
    category: "التخطيط",
    description: "حاوية لترتيب وتجميع العناصر أفقياً أو عمودياً",
    defaultStyles: { display: "flex", gap: "12px", paddingTop: "12px", paddingBottom: "12px" },
  },
  {
    type: "table",
    label: "جدول بيانات مالي (Data Table)",
    category: "الجداول",
    description: "جدول منسق لعرض التقارير والقيود",
    defaultStyles: { width: "100%", borderRadius: "12px" },
  },
  {
    type: "input",
    label: "حقل إدخال بيانات (Form Input)",
    category: "النماذج",
    description: "حقل إدخال مع تسمية توضيحية ونص مساعد",
    defaultStyles: { width: "100%", borderRadius: "10px" },
  },
  {
    type: "image",
    label: "صورة أو شعار (Media / SVG)",
    category: "الوسائط",
    description: "صورة متجاوبة مرتبطة بمدير الأصول",
    defaultStyles: { width: "100%", borderRadius: "12px" },
  },
  {
    type: "badge",
    label: "شارة حالة (Status Badge)",
    category: "العناصر الدقيقة",
    description: "شارة ملونة لإبراز الحالة أو التصنيف",
    defaultStyles: { borderRadius: "9999px" },
  },
  {
    type: "divider",
    label: "فاصل أفقي مع عنوان",
    category: "التخطيط",
    description: "خط فاصل بين الأقسام",
    defaultStyles: { marginTop: "16px", marginBottom: "16px" },
  },
];

export function LiveAppPreview({
  route,
  initialEdits,
  publishedEdits = {},
  publishedRevision = 1,
  designSystem = DEFAULT_STUDIO_DESIGN_SYSTEM,
  pages = {},
  activePageId = "page_dashboard",
  elements = {},
  reusableComponents = [],
  onEditsChange,
  onSelectPage,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
  onUpdatePageMeta,
  onAddElement,
  onSaveReusableComponent,
  onOpenAssetPicker,
  onSelectedDomChange,
  onOpenDrawer,
  closeDrawersSignal = 0,
  externalXRayMode = false,
  designerMode = true,
  hasUnsavedChanges,
  isSaving = false,
  onSaveChanges,
  onDiscardChanges,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const editsRef = useRef<Record<string, StudioDomEdit>>(initialEdits || {});
  const lastCommittedEditsRef = useRef<Record<string, StudioDomEdit> | null>(null);
  const selfCommittedSetRef = useRef<WeakSet<object>>(new WeakSet());
  const readyRef = useRef(false);
  const changeCallbackRef = useRef(onEditsChange);
  const [hasLocalEditSinceSave, setHasLocalEditSinceSave] = useState(false);

  // Selection & Multi-selection
  const [selected, setSelected] = useState<SelectedDomElement | null>(null);
  const [multiSelectedSelectors, setMultiSelectedSelectors] = useState<string[]>([]);
  const [copiedStyleClipboard, setCopiedStyleClipboard] = useState<Record<string, string> | null>(null);
  const [elementClipboard, setElementClipboard] = useState<{
    mode: "copy" | "cut";
    items: Array<{
      selector: string;
      tag: string;
      text: string;
      styles: Record<string, string>;
      attributes: Record<string, string>;
      animation?: StudioDomEdit["animation"];
      actionBinding?: StudioElementActionBinding;
      freePosition?: StudioFreePositionConfig;
    }>;
    sourcePageRoute: string;
    copiedAt: string;
  } | null>(null);
  const [pastePlacement, setPastePlacement] = useState<"after" | "inside" | "before">("after");
  const [pendingDeleteConfirm, setPendingDeleteConfirm] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);

  // Workspace Panels & Modes (Hidden by default; only shown when explicitly opened)
  const [showLeftPanel, setShowLeftPanel] = useState(false);
  const [leftTab, setLeftTab] = useState<"pages" | "layers" | "components">("layers");
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [rightTab, setRightTab] = useState<"content" | "action" | "style" | "layout" | "responsive" | "advanced">("style");
  const [layoutTargetMode, setLayoutTargetMode] = useState<"self" | "parent">("self");
  const [gridColumnsCount, setGridColumnsCount] = useState<string>("3");

  // Free Positioning & Action Inspector States
  const [gridSizePx, setGridSizePx] = useState<number>(8);
  const [freePosEnabled, setFreePosEnabled] = useState<boolean>(false);
  const [freePosMode, setFreePosMode] = useState<"relative" | "absolute">("relative");
  const [freePosX, setFreePosX] = useState<number>(0);
  const [freePosY, setFreePosY] = useState<number>(0);
  const [actionSearchQuery, setActionSearchQuery] = useState<string>("");
  const [pageDestSearchQuery, setPageDestSearchQuery] = useState<string>("");

  // Preview Controls
  const [previewSize, setPreviewSize] = useState<PreviewSize>("desktop");
  const [customViewportWidth, setCustomViewportWidth] = useState<number>(1280);
  const [zoom, setZoom] = useState<number>(100);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [previewSource, setPreviewSource] = useState<"draft" | "published">("draft");
  const [editMode, setEditMode] = useState(designerMode);
  const [showGrid, setShowGrid] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [xRayMode, setXRayMode] = useState(externalXRayMode);
  const [responsiveEditTarget, setResponsiveEditTarget] = useState<ViewportBreakpoint>("desktop");

  // Bridge & Frame State
  const [frameKey, setFrameKey] = useState(0);
  const [ready, setReady] = useState(false);
  const [bridgeTimedOut, setBridgeTimedOut] = useState(false);
  const [status, setStatus] = useState("جاري تحميل معاينة التطبيق الحقيقية…");
  const [currentRoute, setCurrentRoute] = useState(route);
  const [treeNodes, setTreeNodes] = useState<LiveTreeNode[]>([]);
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});
  const [pageLinks, setPageLinks] = useState<LiveRoute[]>([]);
  const [treeFilter, setTreeFilter] = useState("");
  const [pageSearch, setPageSearch] = useState("");
  const [newPageName, setNewPageName] = useState("");
  const [newPageRoute, setNewPageRoute] = useState("");
  const [showAddPageForm, setShowAddPageForm] = useState(false);

  // Inspector Controlled States
  const [textValue, setTextValue] = useState("");
  const [layerLabel, setLayerLabel] = useState("");
  const [textColor, setTextColor] = useState("#111827");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [backgroundGradient, setBackgroundGradient] = useState("");
  const [fontSize, setFontSize] = useState("16");
  const [fontWeight, setFontWeight] = useState("400");
  const [fontFamily, setFontFamily] = useState("Cairo, sans-serif");
  const [lineHeight, setLineHeight] = useState("1.6");
  const [letterSpacing, setLetterSpacing] = useState("0px");
  const [textAlign, setTextAlign] = useState("right");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [minWidth, setMinWidth] = useState("");
  const [maxWidth, setMaxWidth] = useState("");
  const [minHeight, setMinHeight] = useState("");
  const [maxHeight, setMaxHeight] = useState("");
  const [paddingTop, setPaddingTop] = useState("");
  const [paddingRight, setPaddingRight] = useState("");
  const [paddingBottom, setPaddingBottom] = useState("");
  const [paddingLeft, setPaddingLeft] = useState("");
  const [marginTop, setMarginTop] = useState("");
  const [marginRight, setMarginRight] = useState("");
  const [marginBottom, setMarginBottom] = useState("");
  const [marginLeft, setMarginLeft] = useState("");
  const [displayMode, setDisplayMode] = useState("block");
  const [flexDirection, setFlexDirection] = useState("row");
  const [justifyContent, setJustifyContent] = useState("flex-start");
  const [alignItems, setAlignItems] = useState("stretch");
  const [gapValue, setGapValue] = useState("");
  const [positionMode, setPositionMode] = useState("static");
  const [zIndexValue, setZIndexValue] = useState("");
  const [overflowMode, setOverflowMode] = useState("visible");
  const [borderWidth, setBorderWidth] = useState("0px");
  const [borderStyle, setBorderStyle] = useState("solid");
  const [borderColor, setBorderColor] = useState("#e2e8f0");
  const [borderRadius, setBorderRadius] = useState("8px");
  const [shadowStyle, setShadowStyle] = useState("none");
  const [opacity, setOpacity] = useState("1");
  const [fillColor, setFillColor] = useState("#6366f1");
  const [strokeColor, setStrokeColor] = useState("#334155");
  const [strokeWidth, setStrokeWidth] = useState("2");
  const [iconRotation, setIconRotation] = useState("0deg");
  const [hoverBgColor, setHoverBgColor] = useState("");
  const [hoverEffect, setHoverEffect] = useState<"none" | "lift" | "scale" | "glow">("none");
  const [animType, setAnimType] = useState<"none" | "fade-in" | "slide-up" | "slide-right" | "zoom-in">("none");
  const [animDuration, setAnimDuration] = useState("300");
  const [animDelay, setAnimDelay] = useState("0");
  const [customId, setCustomId] = useState("");
  const [classNameVal, setClassNameVal] = useState("");
  const [ariaLabelVal, setAriaLabelVal] = useState("");
  const [roleVal, setRoleVal] = useState("");
  const [hrefVal, setHrefVal] = useState("");
  const [srcVal, setSrcVal] = useState("");
  const [altVal, setAltVal] = useState("");

  const [edits, setEdits] = useState<Record<string, StudioDomEdit>>(initialEdits || {});
  editsRef.current = edits;
  changeCallbackRef.current = onEditsChange;

  useEffect(() => {
    setXRayMode(externalXRayMode);
  }, [externalXRayMode]);

  useEffect(() => {
    if (closeDrawersSignal > 0) {
      setShowLeftPanel(false);
      setShowRightPanel(false);
    }
  }, [closeDrawersSignal]);

  useEffect(() => {
    setCurrentRoute(route);
  }, [route]);

  const safeRoute = useMemo(() => {
    const value = (currentRoute || "/admin").trim();
    return value.startsWith("/") && !value.startsWith("//") ? value : "/admin";
  }, [currentRoute]);

  const previewRoute = useMemo(() => {
    const [pathAndSearch, hash = ""] = safeRoute.split("#", 2);
    const separator = pathAndSearch.includes("?") ? "&" : "?";
    return pathAndSearch + separator + "__studio_preview=1" + (hash ? "#" + hash : "");
  }, [safeRoute]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const send = useCallback(
    (data: Record<string, unknown>) => {
      iframeRef.current?.contentWindow?.postMessage({ type: "STUDIO_COMMAND", ...data }, origin);
    },
    [origin],
  );

  // Active edits map depending on whether user is viewing Draft or Published preview
  const activeDisplayedEdits = useMemo(
    () => (previewSource === "published" ? publishedEdits : edits),
    [previewSource, publishedEdits, edits],
  );
  const activeDisplayedEditsRef = useRef(activeDisplayedEdits);
  activeDisplayedEditsRef.current = activeDisplayedEdits;
  const designSystemRef = useRef(designSystem);
  designSystemRef.current = designSystem;

  useEffect(() => {
    if (hasUnsavedChanges === false) {
      setHasLocalEditSinceSave(false);
    }
  }, [hasUnsavedChanges]);

  const showContextualSaveDiscard = Boolean(hasUnsavedChanges || hasLocalEditSinceSave);

  const commitEdits = useCallback((selector: string, patch: StudioDomEdit) => {
    if (!selector || selector.startsWith("__studio_")) return;
    const previous = editsRef.current[selector] || {};
    const activePageRoute = (safeRoute.split("?")[0] || "/admin").replace(/\/+$/, "") || "/";
    const mergedEdit: StudioDomEdit = {
      ...previous,
      ...patch,
      pageRoute: patch.pageRoute || previous.pageRoute || activePageRoute,
      ...(patch.styles ? { styles: { ...(previous.styles || {}), ...patch.styles } } : {}),
      ...(patch.responsiveStyles
        ? {
            responsiveStyles: {
              ...(previous.responsiveStyles || {}),
              ...patch.responsiveStyles,
              desktop: {
                ...(previous.responsiveStyles?.desktop || {}),
                ...(patch.responsiveStyles.desktop || {}),
              },
              tablet: {
                ...(previous.responsiveStyles?.tablet || {}),
                ...(patch.responsiveStyles.tablet || {}),
              },
              mobile: {
                ...(previous.responsiveStyles?.mobile || {}),
                ...(patch.responsiveStyles.mobile || {}),
              },
            },
          }
        : {}),
      ...(patch.attributes
        ? { attributes: { ...(previous.attributes || {}), ...patch.attributes } }
        : {}),
      ...(patch.hiddenOn
        ? { hiddenOn: { ...(previous.hiddenOn || {}), ...patch.hiddenOn } }
        : {}),
    };
    const next = { ...editsRef.current, [selector]: mergedEdit };
    editsRef.current = next;
    lastCommittedEditsRef.current = next;
    selfCommittedSetRef.current.add(next);
    setHasLocalEditSinceSave(true);
    setEdits(next);
    changeCallbackRef.current(next);
  }, [safeRoute]);

  const populateInspectorFromElement = useCallback((item: SelectedDomElement) => {
    setSelected(item);
    setLayoutTargetMode("self");
    onSelectedDomChange?.(item.selector);
    const existingEdit = editsRef.current[item.selector] || {};
    setLayerLabel(existingEdit.label || "");
    setTextValue(item.text || "");
    setTextColor(toHexColor(item.color, "#111827"));
    setBackgroundColor(toHexColor(item.backgroundColor, "#ffffff"));
    setBackgroundGradient(existingEdit.styles?.backgroundImage || "");
    setFontSize(String(parseInt(item.fontSize, 10) || 16));
    setFontWeight(item.fontWeight || "400");
    setFontFamily(item.fontFamily || "Cairo, sans-serif");
    setLineHeight(item.lineHeight || "1.6");
    setLetterSpacing(item.letterSpacing || "0px");
    setTextAlign(item.textAlign || "right");
    setWidth(item.width === "auto" ? "" : item.width || "");
    setHeight(item.height === "auto" ? "" : item.height || "");
    setMinWidth(item.minWidth === "0px" || item.minWidth === "auto" ? "" : item.minWidth || "");
    setMaxWidth(item.maxWidth === "none" ? "" : item.maxWidth || "");
    setMinHeight(item.minHeight === "0px" || item.minHeight === "auto" ? "" : item.minHeight || "");
    setMaxHeight(item.maxHeight === "none" ? "" : item.maxHeight || "");
    setPaddingTop(item.paddingTop || "");
    setPaddingRight(item.paddingRight || "");
    setPaddingBottom(item.paddingBottom || "");
    setPaddingLeft(item.paddingLeft || "");
    setMarginTop(item.marginTop || "");
    setMarginRight(item.marginRight || "");
    setMarginBottom(item.marginBottom || "");
    setMarginLeft(item.marginLeft || "");
    setDisplayMode(existingEdit.styles?.display || item.display || "block");
    setFlexDirection(existingEdit.styles?.flexDirection || item.flexDirection || "row");
    setJustifyContent(existingEdit.styles?.justifyContent || item.justifyContent || "flex-start");
    setAlignItems(existingEdit.styles?.alignItems || item.alignItems || "stretch");
    setGapValue(item.gap === "normal" ? "" : existingEdit.styles?.gap || item.gap || "");
    const existingCols = existingEdit.styles?.gridTemplateColumns || item.gridTemplateColumns || "";
    if (existingCols.includes("repeat(2")) setGridColumnsCount("2");
    else if (existingCols.includes("repeat(4")) setGridColumnsCount("4");
    else if (existingCols.includes("auto-fill") || existingCols.includes("auto-fit")) setGridColumnsCount("auto");
    else setGridColumnsCount("3");
    setPositionMode(item.position || "static");
    setZIndexValue(item.zIndex === "auto" ? "" : item.zIndex || "");
    setOverflowMode(item.overflow || "visible");
    setBorderWidth(item.borderWidth || "0px");
    setBorderStyle(item.borderStyle || "solid");
    setBorderColor(toHexColor(item.borderColor, "#e2e8f0"));
    setBorderRadius(item.borderRadius || "8px");
    setOpacity(String(Math.max(0, Math.min(1, parseFloat(item.opacity) || 1))));
    setFillColor(toHexColor(item.fill, "#6366f1"));
    setStrokeColor(toHexColor(item.stroke, toHexColor(item.color, "#334155")));
    setStrokeWidth(String(parseFloat(item.strokeWidth) || 2));
    setIconRotation(item.rotate || "0deg");
    setHoverBgColor(existingEdit.hoverStyles?.backgroundColor || "");
    setHoverEffect((existingEdit.animation?.hoverEffect as any) || "none");
    setAnimType((existingEdit.animation?.type as any) || "none");
    setAnimDuration(String(existingEdit.animation?.durationMs || 300));
    setAnimDelay(String(existingEdit.animation?.delayMs || 0));
    setCustomId(existingEdit.customId || item.idAttr || "");
    setClassNameVal(existingEdit.className || item.classNameAttr || "");
    setAriaLabelVal(existingEdit.ariaLabel || item.ariaLabel || "");
    setRoleVal(existingEdit.role || item.roleAttr || "");
    setHrefVal(existingEdit.attributes?.href || item.hrefAttr || "");
    setSrcVal(existingEdit.attributes?.src || item.srcAttr || "");
    setAltVal(existingEdit.attributes?.alt || item.altAttr || "");
    setFreePosEnabled(Boolean(existingEdit.freePosition?.enabled));
    setFreePosMode(existingEdit.freePosition?.mode || "relative");
    setFreePosX(Number(existingEdit.freePosition?.x || 0));
    setFreePosY(Number(existingEdit.freePosition?.y || 0));
    setPendingDeleteConfirm(false);
  }, [onSelectedDomChange]);

  const commitBatchEdits = useCallback(
    (patchesBySelector: Record<string, StudioDomEdit>) => {
      const activePageRoute = (safeRoute.split("?")[0] || "/admin").replace(/\/+$/, "") || "/";
      const next = { ...editsRef.current };
      for (const [selector, patch] of Object.entries(patchesBySelector)) {
        if (!selector || selector.startsWith("__studio_")) continue;
        const previous = next[selector] || {};
        next[selector] = {
          ...previous,
          ...patch,
          pageRoute: patch.pageRoute || previous.pageRoute || activePageRoute,
          ...(patch.styles ? { styles: { ...(previous.styles || {}), ...patch.styles } } : {}),
          ...(patch.attributes
            ? { attributes: { ...(previous.attributes || {}), ...patch.attributes } }
            : {}),
        };
      }
      editsRef.current = next;
      lastCommittedEditsRef.current = next;
      selfCommittedSetRef.current.add(next);
      setHasLocalEditSinceSave(true);
      setEdits(next);
      changeCallbackRef.current(next);
    },
    [safeRoute],
  );

  const clearSelection = useCallback(() => {
    setSelected(null);
    setMultiSelectedSelectors([]);
    setContextMenu(null);
    setPendingDeleteConfirm(false);
    onSelectedDomChange?.(null);
    send({ action: "clearSelection" });
  }, [onSelectedDomChange, send]);

  const onMessage = useCallback(
    (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== iframeRef.current?.contentWindow ||
        !event.data
      ) {
        return;
      }
      if (event.data.type === "STUDIO_TREE") {
        setTreeNodes(Array.isArray(event.data.nodes) ? (event.data.nodes as LiveTreeNode[]) : []);
      } else if (event.data.type === "STUDIO_ROUTES") {
        const routes = Array.isArray(event.data.routes)
          ? event.data.routes
              .filter(
                (item: any) =>
                  item &&
                  typeof item.href === "string" &&
                  item.href.startsWith("/") &&
                  !item.href.startsWith("//"),
              )
              .map((item: any) => ({
                href: String(item.href),
                label: String(item.label || item.href),
              }))
          : [];
        setPageLinks(routes);
      } else if (event.data.type === "STUDIO_CLEAR_SELECTION") {
        clearSelection();
        setStatus("تم إلغاء تحديد العناصر.");
      } else if (event.data.type === "STUDIO_SELECTED") {
        const item = event.data.element as SelectedDomElement;
        populateInspectorFromElement(item);
        const isToggle = Boolean(event.data.ctrlKey || event.data.metaKey);
        const isAdditive = Boolean(event.data.shiftKey);
        setMultiSelectedSelectors((prev) => {
          let nextList: string[];
          if (isToggle) {
            if (prev.includes(item.selector)) {
              nextList = prev.length > 1 ? prev.filter((s) => s !== item.selector) : [];
            } else {
              nextList = [...prev, item.selector];
            }
          } else if (isAdditive) {
            nextList = prev.includes(item.selector) ? prev : [...prev, item.selector];
          } else {
            nextList = [item.selector];
          }
          send({ action: "setMultiSelection", selectors: nextList });
          return nextList;
        });
        setContextMenu(null);
        setStatus(
          isToggle || isAdditive
            ? `تحديد متعدد النشط: <${item.tag}>`
            : `تم تحديد العنصر: <${item.tag}>`,
        );
      } else if (event.data.type === "STUDIO_CONTEXT_MENU") {
        const item = event.data.element as SelectedDomElement;
        populateInspectorFromElement(item);
        setMultiSelectedSelectors((prev) =>
          prev.includes(item.selector) ? prev : [item.selector],
        );
        setContextMenu({
          x: Number(event.data.x || 120),
          y: Number(event.data.y || 120),
          selector: item.selector,
          tag: item.tag,
        });
      } else if (event.data.type === "STUDIO_FREE_POSITION_COMMIT") {
        if (previewSource === "published") return;
        const items = Array.isArray(event.data.items) ? event.data.items : [];
        if (items.length > 0) {
          const patches: Record<string, StudioDomEdit> = {};
          for (const moved of items) {
            const sel = String(moved.selector || "");
            if (!sel || editsRef.current[sel]?.locked) continue;
            const prevFp = editsRef.current[sel]?.freePosition;
            const nextX = Number(moved.x || 0);
            const nextY = Number(moved.y || 0);
            const nextW = moved.width ? Number(moved.width) : prevFp?.width;
            const nextH = moved.height ? Number(moved.height) : prevFp?.height;
            const mode = prevFp?.mode || "relative";
            patches[sel] = {
              freePosition: {
                enabled: true,
                mode,
                x: nextX,
                y: nextY,
                width: nextW,
                height: nextH,
                zIndex: prevFp?.zIndex ?? 20,
                gridSize: gridSizePx,
              },
              styles: {
                position: mode,
                left: `${nextX}px`,
                top: `${nextY}px`,
                ...(nextW ? { width: `${nextW}px` } : {}),
                ...(nextH ? { height: `${nextH}px` } : {}),
                zIndex: String(prevFp?.zIndex ?? 20),
              },
            };
            if (selected && sel === selected.selector) {
              setFreePosEnabled(true);
              setFreePosMode(mode);
              setFreePosX(nextX);
              setFreePosY(nextY);
              if (nextW) setWidth(`${nextW}px`);
              if (nextH) setHeight(`${nextH}px`);
            }
          }
          commitBatchEdits(patches);
          setStatus(
            items.length > 1
              ? `تم تحريك المجموعة (${items.length} عناصر) وحفظ الإحداثيات الحرة.`
              : `تم تحديث موضع العنصر الحر (X: ${items[0].x}px, Y: ${items[0].y}px).`,
          );
        }
      } else if (event.data.type === "STUDIO_CHANGE") {
        if (previewSource === "published") {
          setStatus("أنت في وضع عرض النسخة المنشورة؛ انتقل إلى وضع المسودة للتعديل.");
          return;
        }
        commitEdits(String(event.data.selector), event.data.patch || {});
        setStatus("تم تحديث المسودة محليًا — اضغط «حفظ ومزامنة» للتأكيد السحابي.");
      } else if (event.data.type === "STUDIO_PROTECTED_ELEMENT") {
        setStatus(
          String(
            event.data.message || "هذا العنصر الوظيفي محمي لضمان سلامة العمليات المحاسبية.",
          ),
        );
      } else if (event.data.type === "STUDIO_BRIDGE_READY") {
        readyRef.current = true;
        setReady(true);
        setBridgeTimedOut(false);
        setStatus("المعاينة الحقيقية متصلة وجاهزة");
        send({
          action: "setMode",
          enabled: editMode && previewSource === "draft",
          xRay: xRayMode,
          snapToGrid,
          gridSize: gridSizePx,
        });
        send({
          action: "restore",
          edits: activeDisplayedEditsRef.current,
          designSystem: designSystemRef.current,
        });
      }
    },
    [
      populateInspectorFromElement,
      previewSource,
      commitEdits,
      commitBatchEdits,
      clearSelection,
      editMode,
      xRayMode,
      snapToGrid,
      gridSizePx,
      selected,
      send,
    ],
  );

  useEffect(() => {
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onMessage]);

  // Bridge health timeout recovery detector
  useEffect(() => {
    readyRef.current = false;
    setReady(false);
    setBridgeTimedOut(false);
    setSelected(null);
    setContextMenu(null);
    setTreeNodes([]);
    setPageLinks([]);
    setStatus("جاري تحميل الصفحة الفعلية: " + safeRoute);
    const timer = window.setTimeout(() => {
      if (!readyRef.current) {
        setBridgeTimedOut(true);
      }
    }, 6500);
    return () => window.clearTimeout(timer);
  }, [safeRoute, frameKey]);

  useEffect(() => {
    if (ready) {
      send({
        action: "setMode",
        enabled: editMode && previewSource === "draft",
        xRay: xRayMode,
        snapToGrid,
      });
    }
  }, [editMode, previewSource, xRayMode, snapToGrid, ready, send]);

  // Keep iframe synchronized with undo/redo, Draft vs Published toggle, and Design System tokens
  // Skip full restore echo when the change originated from this LiveAppPreview instance itself
  useEffect(() => {
    const snapshot = initialEdits || {};
    const isSelfCommit =
      previewSource === "draft" &&
      (snapshot === lastCommittedEditsRef.current || selfCommittedSetRef.current.has(snapshot));
    editsRef.current = snapshot;
    setEdits(snapshot);
    if (ready && !isSelfCommit) {
      send({
        action: "restore",
        edits: previewSource === "published" ? publishedEdits : snapshot,
        designSystem,
      });
    }
  }, [initialEdits, publishedEdits, previewSource, designSystem, ready, send]);

  const installBridge = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    const win = iframeRef.current?.contentWindow;
    if (!doc?.body || !win) {
      setStatus("تعذر الوصول إلى المعاينة؛ اضغط تحديث لإعادة الاتصال.");
      return;
    }
    if (win.location.origin !== window.location.origin) {
      setStatus("المعاينة على نطاق مختلف.");
      return;
    }
    if (!doc.getElementById("coding-studio-overlay")) {
      const style = doc.createElement("style");
      style.id = "coding-studio-overlay";
      style.textContent = `
        body[data-coding-studio="on"] * { cursor: default !important; user-select: none !important; }
        body[data-coding-studio="on"] *:hover { outline: 1px dashed #6366f1 !important; outline-offset: -1px; }
        body[data-coding-studio-xray="on"] div,
        body[data-coding-studio-xray="on"] section,
        body[data-coding-studio-xray="on"] header,
        body[data-coding-studio-xray="on"] nav,
        body[data-coding-studio-xray="on"] main,
        body[data-coding-studio-xray="on"] article,
        body[data-coding-studio-xray="on"] button {
          outline: 1px dotted rgba(14, 165, 233, 0.55) !important;
        }
        [data-coding-studio-dragging="true"] { cursor: grabbing !important; z-index: 9999 !important; }
        [data-coding-studio-selected="true"] {
          outline: 2px solid #4f46e5 !important;
          outline-offset: 2px !important;
          box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.16) !important;
        }
        [data-coding-studio-multi-selected="true"] {
          outline: 2px dashed #0ea5e9 !important;
          outline-offset: 2px !important;
          box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.18) !important;
        }
        #coding-studio-handles-box {
          position: fixed;
          pointer-events: none;
          z-index: 99998;
          border: 1.5px solid #4f46e5;
          display: none;
        }
        #coding-studio-handles-box .studio-resize-handle {
          position: absolute;
          width: 9px;
          height: 9px;
          background: #ffffff;
          border: 2px solid #4f46e5;
          border-radius: 2px;
          pointer-events: auto;
        }
        #coding-studio-handles-box .studio-drag-badge {
          position: absolute;
          top: -22px;
          right: 0;
          background: #4f46e5;
          color: #ffffff;
          font-size: 10px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 4px;
          cursor: grab;
          pointer-events: auto;
          white-space: nowrap;
        }
        #coding-studio-align-guide-x, #coding-studio-align-guide-y {
          position: fixed;
          pointer-events: none;
          z-index: 99997;
          display: none;
          background: #ec4899;
        }
        #coding-studio-align-guide-x { height: 1px; left: 0; right: 0; }
        #coding-studio-align-guide-y { width: 1px; top: 0; bottom: 0; }
        @keyframes studioFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes studioSlideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes studioSlideRight { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes studioZoomIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
      `;
      doc.head.appendChild(style);
    }
    if (doc.getElementById("coding-studio-bridge")) {
      readyRef.current = true;
      setReady(true);
      setBridgeTimedOut(false);
      send({
        action: "setMode",
        enabled: editMode && previewSource === "draft",
        xRay: xRayMode,
        snapToGrid,
        gridSize: gridSizePx,
      });
      send({
        action: "restore",
        edits: activeDisplayedEdits,
        designSystem,
      });
      return;
    }
    const script = doc.createElement("script");
    script.id = "coding-studio-bridge";
    script.textContent = String.raw`(() => {
      const parentOrigin = location.origin;
      const anchorFor = (node) => {
        if (!node || node.nodeType !== 1) return null;
        const sid = node.getAttribute("data-studio-id");
        if (sid) return '[data-studio-id="' + CSS.escape(sid) + '"]';
        const pid = node.getAttribute("data-studio-pasted-id");
        if (pid) return '[data-studio-pasted-id="' + CSS.escape(pid) + '"]';
        if (node.id && !node.id.startsWith("radix-")) return "#" + CSS.escape(node.id);
        const tid = node.getAttribute("data-testid");
        if (tid) return '[data-testid="' + CSS.escape(tid) + '"]';
        return null;
      };
      const selectorFor = (el) => {
        const directAnchor = anchorFor(el);
        if (directAnchor) return directAnchor;
        const path = [];
        let node = el;
        while (node && node.nodeType === 1 && node !== document.body) {
          const nodeAnchor = anchorFor(node);
          if (nodeAnchor) {
            path.unshift(nodeAnchor);
            return path.join(" > ");
          }
          let part = node.tagName.toLowerCase();
          const parent = node.parentElement;
          if (!parent) break;
          const same = Array.from(parent.children).filter((item) => item.tagName === node.tagName);
          if (same.length > 1) part += ":nth-of-type(" + (same.indexOf(node) + 1) + ")";
          path.unshift(part);
          node = parent;
        }
        return "body > " + path.join(" > ");
      };
      const send = (type, data) => window.parent.postMessage({ type, ...data }, parentOrigin);
      const find = (selector) => { try { return document.querySelector(selector); } catch (_) { return null; } };
      const preservedSelector = '[data-studio-preserve], [data-studio-ui-root="true"]';
      const isProtected = (el) => !!(el && el.closest(preservedSelector));
      const containsProtected = (el) => !!(el && el.querySelector(preservedSelector));
      const hidesProtected = (edit) => {
        if (edit?.deleted) return true;
        const styles = edit?.styles || {};
        return styles.display === "none" ||
          styles.visibility === "hidden" ||
          Number(styles.opacity) === 0 ||
          ["0", "0px"].includes(String(styles.height || "")) ||
          ["0", "0px"].includes(String(styles.width || "")) ||
          ["0", "0px"].includes(String(styles.maxHeight || "")) ||
          ["0", "0px"].includes(String(styles.maxWidth || ""));
      };
      const originalStates = new Map();
      const rememberOriginal = (selector, el) => {
        const existing = originalStates.get(selector);
        if (existing?.el === el) return;
        if (!el.dataset.studioOrigText) {
          el.dataset.studioOrigText = (el.innerText || el.textContent || "").trim().slice(0, 500);
        }
        originalStates.set(selector, {
          el,
          styleAttribute: el.getAttribute("style"),
          className: el.getAttribute("class"),
          idAttr: el.getAttribute("id"),
          ariaLabel: el.getAttribute("aria-label"),
          roleAttr: el.getAttribute("role"),
          directTextNodes: Array.from(el.childNodes)
            .filter((node) => node.nodeType === Node.TEXT_NODE)
            .map((node) => ({ node, text: node.nodeValue })),
          parent: el.parentNode,
          nextSibling: el.nextSibling,
          wasReordered: false,
        });
      };
      const resetPreviewEdits = () => {
        document.querySelectorAll("[data-coding-studio-clone-of], [data-studio-clone-of], [data-studio-pasted-id]").forEach((el) => el.remove());
        const respStyle = document.getElementById("coding-studio-responsive-css");
        if (respStyle) respStyle.textContent = "";
        for (const state of Array.from(originalStates.values()).reverse()) {
          const el = state.el;
          if (!el || !el.isConnected) continue;
          if (Array.isArray(state.directTextNodes)) {
            for (const item of state.directTextNodes) {
              if (item.node && item.node.parentNode === el) {
                item.node.nodeValue = item.text;
              }
            }
          }
          delete el.dataset.codingStudioTextApplied;
          if (state.styleAttribute === null) el.removeAttribute("style");
          else el.setAttribute("style", state.styleAttribute);
          if (state.wasReordered && state.parent && el.parentNode === state.parent) {
            if (state.nextSibling && state.nextSibling.parentNode === state.parent) state.parent.insertBefore(el, state.nextSibling);
            else state.parent.appendChild(el);
          }
        }
        originalStates.clear();
      };
      const buildAncestors = (el) => {
        const list = [];
        let cur = el;
        while (cur && cur.nodeType === 1 && cur !== document.documentElement) {
          const tag = cur.tagName.toLowerCase();
          const sel = cur === document.body ? "body" : selectorFor(cur);
          const lbl = cur.id ? (tag + "#" + cur.id) : tag;
          list.unshift({ selector: sel, tag, label: lbl });
          if (cur === document.body) break;
          cur = cur.parentElement;
        }
        return list.slice(-7);
      };
      const describe = (el) => {
        const css = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          selector: selectorFor(el),
          ancestors: buildAncestors(el),
          tag: el.tagName.toLowerCase(),
          text: (el.innerText || el.textContent || "").trim().slice(0, 1000),
          originalText: el.dataset.studioOrigText || (el.innerText || el.textContent || "").trim().slice(0, 500),
          color: css.color,
          backgroundColor: css.backgroundColor,
          fontSize: css.fontSize,
          fontWeight: css.fontWeight,
          fontFamily: css.fontFamily,
          lineHeight: css.lineHeight,
          letterSpacing: css.letterSpacing,
          width: el.style.width || "auto",
          height: el.style.height || "auto",
          minWidth: el.style.minWidth || css.minWidth || "auto",
          maxWidth: el.style.maxWidth || css.maxWidth || "none",
          minHeight: el.style.minHeight || css.minHeight || "auto",
          maxHeight: el.style.maxHeight || css.maxHeight || "none",
          paddingTop: el.style.paddingTop || css.paddingTop || "0px",
          paddingRight: el.style.paddingRight || css.paddingRight || "0px",
          paddingBottom: el.style.paddingBottom || css.paddingBottom || "0px",
          paddingLeft: el.style.paddingLeft || css.paddingLeft || "0px",
          marginTop: el.style.marginTop || css.marginTop || "0px",
          marginRight: el.style.marginRight || css.marginRight || "0px",
          marginBottom: el.style.marginBottom || css.marginBottom || "0px",
          marginLeft: el.style.marginLeft || css.marginLeft || "0px",
          display: el.style.display || css.display || "block",
          flexDirection: el.style.flexDirection || css.flexDirection || "row",
          justifyContent: el.style.justifyContent || css.justifyContent || "flex-start",
          alignItems: el.style.alignItems || css.alignItems || "stretch",
          gap: el.style.gap || css.gap || "",
          gridTemplateColumns: el.style.gridTemplateColumns || css.gridTemplateColumns || "",
          position: el.style.position || css.position || "static",
          zIndex: el.style.zIndex || css.zIndex || "auto",
          overflow: el.style.overflow || css.overflow || "visible",
          borderWidth: el.style.borderWidth || css.borderWidth || "0px",
          borderStyle: el.style.borderStyle || css.borderStyle || "solid",
          borderColor: el.style.borderColor || css.borderColor || "#e2e8f0",
          fill: css.fill || el.getAttribute("fill") || "",
          stroke: css.stroke || el.getAttribute("stroke") || "",
          strokeWidth: css.strokeWidth || el.getAttribute("stroke-width") || "2",
          opacity: css.opacity || "1",
          borderRadius: css.borderRadius || "0px",
          rotate: css.rotate || "0deg",
          textAlign: css.textAlign || "right",
          idAttr: el.getAttribute("id") || "",
          classNameAttr: typeof el.className === "string" ? el.className : "",
          ariaLabel: el.getAttribute("aria-label") || "",
          roleAttr: el.getAttribute("role") || "",
          hrefAttr: el.getAttribute("href") || "",
          srcAttr: el.getAttribute("src") || "",
          altAttr: el.getAttribute("alt") || "",
          rectWidth: Math.round(rect.width),
          rectHeight: Math.round(rect.height),
        };
      };
      const applyStyles = (el, styles) => {
        const applyTo = [el];
        const isSvgRoot = el.tagName?.toLowerCase() === "svg";
        if (isSvgRoot) applyTo.push(...el.querySelectorAll("path,circle,rect,line,polyline,polygon,ellipse"));
        const inheritableVectorStyles = new Set(["fill", "stroke", "strokeWidth", "color"]);
        Object.entries(styles || {}).forEach(([key, value]) => {
          if (typeof value !== "string") return;
          const cssKey = key.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
          if (value.trim() === "") {
            el.style.removeProperty(cssKey);
          } else {
            el.style.setProperty(cssKey, value, "important");
          }
          if (isSvgRoot && inheritableVectorStyles.has(key)) {
            applyTo.slice(1).forEach((node) => {
              if (value.trim() === "") node.style.removeProperty(cssKey);
              else node.style.setProperty(cssKey, value, "important");
            });
          }
        });
      };
      const applyText = (el, value, origHint) => {
        const origTxt = (origHint || el.dataset.studioOrigText || "").trim();
        const prevTxt = (el.dataset.codingStudioTextApplied || origTxt || "").trim();
        const textNodes = Array.from(el.childNodes).filter((child) => child.nodeType === 3);
        const nonEmpty = textNodes.find((child) => (child.nodeValue || "").trim());
        if (nonEmpty) nonEmpty.nodeValue = String(value);
        else if (textNodes[0]) textNodes[0].nodeValue = String(value);
        else if (!el.children.length) el.textContent = String(value);
        el.dataset.codingStudioTextApplied = String(value);
        const newTrimmed = String(value || "").trim();
        if (origTxt.length >= 2 && newTrimmed.length > 0 && origTxt !== newTrimmed) {
          document.querySelectorAll("h1, h2, h3, h4, h5, h6, a, button, span, [role='menuitem']").forEach((node) => {
            if (node === el) return;
            Array.from(node.childNodes).forEach((child) => {
              if (child.nodeType === 3 && child.nodeValue) {
                const t = child.nodeValue.trim();
                if (t === origTxt || (prevTxt.length >= 2 && t === prevTxt)) {
                  child.nodeValue = newTrimmed;
                }
              }
            });
          });
        }
      };
      const applyAnimation = (el, anim) => {
        if (!anim || !anim.type || anim.type === "none") return;
        const map = {
          "fade-in": "studioFadeIn",
          "slide-up": "studioSlideUp",
          "slide-right": "studioSlideRight",
          "zoom-in": "studioZoomIn",
        };
        const kf = map[anim.type];
        if (kf) {
          const dur = Number(anim.durationMs || 300);
          const delay = Number(anim.delayMs || 0);
          el.style.animation = kf + " " + dur + "ms ease-out " + delay + "ms both";
        }
      };
      const rebuildResponsiveSheet = (editsMap, ds) => {
        let styleEl = document.getElementById("coding-studio-responsive-css");
        if (!styleEl) {
          styleEl = document.createElement("style");
          styleEl.id = "coding-studio-responsive-css";
          document.head.appendChild(styleEl);
        }
        const rules = [];
        if (ds && ds.colors) {
          rules.push(":root { --studio-primary: " + ds.colors.primary + "; --studio-surface: " + ds.colors.surface + "; --studio-text: " + ds.colors.textPrimary + "; }");
        }
        const toCssDecls = (obj) => Object.entries(obj || {})
          .filter(([, v]) => typeof v === "string" && v.trim() !== "")
          .map(([k, v]) => k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase()) + ": " + v + " !important;")
          .join(" ");
        for (const [sel, edit] of Object.entries(editsMap || {})) {
          if (!edit || sel.startsWith("__studio_")) continue;
          if (edit.deleted || edit.hiddenOn?.desktop || edit.styles?.display === "none") {
            rules.push(sel + " { display: none !important; }");
          }
          if (edit.hoverStyles && Object.keys(edit.hoverStyles).length) {
            rules.push(sel + ":hover { " + toCssDecls(edit.hoverStyles) + " }");
          }
          if (edit.animation?.hoverEffect === "lift") {
            rules.push(sel + ":hover { transform: translateY(-3px) !important; transition: transform 180ms ease !important; }");
          } else if (edit.animation?.hoverEffect === "scale") {
            rules.push(sel + ":hover { transform: scale(1.03) !important; transition: transform 180ms ease !important; }");
          } else if (edit.animation?.hoverEffect === "glow") {
            rules.push(sel + ":hover { box-shadow: 0 0 18px rgba(79,70,229,0.4) !important; transition: box-shadow 180ms ease !important; }");
          }
          if (edit.responsiveStyles?.tablet || edit.hiddenOn?.tablet) {
            const decls = toCssDecls(edit.responsiveStyles?.tablet) + (edit.hiddenOn?.tablet ? " display: none !important;" : "");
            if (decls.trim()) rules.push("@media (max-width: 1024px) { " + sel + " { " + decls + " } }");
          }
          if (edit.responsiveStyles?.mobile || edit.hiddenOn?.mobile) {
            const decls = toCssDecls(edit.responsiveStyles?.mobile) + (edit.hiddenOn?.mobile ? " display: none !important;" : "");
            if (decls.trim()) rules.push("@media (max-width: 640px) { " + sel + " { " + decls + " } }");
          }
        }
        styleEl.textContent = rules.join("\n");
      };
      const applyEdit = (selector, edit) => {
        if (!selector || selector.startsWith("__studio_")) return;
        if (edit?.pageRoute) {
          const currentPath = location.pathname.replace(/\/+$/, "") || "/";
          const targetRoute = String(edit.pageRoute).split("?")[0].replace(/\/+$/, "") || "/";
          if (targetRoute !== currentPath) return;
        }
        const el = find(selector);
        if (!el || !edit || isProtected(el)) return;
        if (
          el.hasAttribute("hidden") ||
          el.getAttribute("data-state") === "inactive" ||
          el.getAttribute("role") === "tabpanel"
        ) {
          return;
        }
        if (containsProtected(el) && hidesProtected(edit)) return;
        rememberOriginal(selector, el);
        if (edit.text !== undefined && el.dataset.codingStudioTextApplied !== String(edit.text)) applyText(el, edit.text);
        if (edit.styles && typeof edit.styles === "object") applyStyles(el, edit.styles);
        if (edit.freePosition?.enabled) {
          const posMode = edit.freePosition.mode || "relative";
          el.style.setProperty("position", posMode, "important");
          el.style.setProperty("left", (Number(edit.freePosition.x) || 0) + "px", "important");
          el.style.setProperty("top", (Number(edit.freePosition.y) || 0) + "px", "important");
          if (edit.freePosition.width) el.style.setProperty("width", Number(edit.freePosition.width) + "px", "important");
          if (edit.freePosition.height) el.style.setProperty("height", Number(edit.freePosition.height) + "px", "important");
          if (edit.freePosition.zIndex !== undefined) el.style.setProperty("z-index", String(edit.freePosition.zIndex), "important");
        }
        if (edit.actionBinding?.actionId) {
          el.dataset.studioActionId = edit.actionBinding.actionId;
          el.dataset.studioActionType = edit.actionBinding.actionType;
          if (edit.actionBinding.targetRoute) el.dataset.studioTargetRoute = edit.actionBinding.targetRoute;
        }
        if (edit.animation) applyAnimation(el, edit.animation);
        if (edit.ariaLabel) {
          try { el.setAttribute("aria-label", edit.ariaLabel); } catch (_) {}
        }
        if (edit.role) {
          try { el.setAttribute("role", edit.role); } catch (_) {}
        }
        if (edit.attributes && typeof edit.attributes === "object") {
          Object.entries(edit.attributes).forEach(([k, v]) => {
            if (typeof v === "string" && v) {
              try { el.setAttribute(k, v); } catch (_) {}
            }
          });
        }
        if (edit.deleted || edit.hiddenOn?.desktop) el.style.setProperty("display", "none", "important");
        if (typeof edit.order === "number" && el.parentElement) {
          const orig = originalStates.get(selector);
          if (orig) orig.wasReordered = true;
          const siblings = Array.from(el.parentElement.children).filter((item) =>
            item !== el && item.getAttribute("data-coding-studio-clone-of") !== selector &&
            item.getAttribute("data-studio-clone-of") !== selector);
          const current = Array.from(el.parentElement.children).indexOf(el);
          const target = Math.max(0, Math.min(edit.order, siblings.length));
          if (target < current && siblings[target]) el.parentElement.insertBefore(el, siblings[target]);
          else if (target > current && siblings[target]) el.parentElement.insertBefore(el, siblings[target].nextSibling);
          else if (target > current && !siblings[target]) el.parentElement.appendChild(el);
        }
        const parent = el.parentElement;
        if (parent) {
          const wanted = Math.min(5, Math.max(0, Number(edit.duplicateCount) || 0));
          const count = Array.from(parent.children).filter((item) =>
            item.getAttribute("data-coding-studio-clone-of") === selector ||
            item.getAttribute("data-studio-clone-of") === selector).length;
          for (let i = count; i < wanted; i++) {
            const clone = el.cloneNode(true);
            clone.removeAttribute("id");
            clone.removeAttribute("data-coding-studio-selected");
            clone.removeAttribute("data-coding-studio-multi-selected");
            clone.setAttribute("data-coding-studio-clone-of", selector);
            parent.insertBefore(clone, el.nextSibling);
          }
          if (Array.isArray(edit.pastedNodes) && edit.pastedNodes.length > 0) {
            for (const pasted of edit.pastedNodes) {
              if (!pasted?.id) continue;
              if (document.querySelector('[data-studio-pasted-id="' + CSS.escape(pasted.id) + '"]')) continue;
              const created = document.createElement(pasted.tag || "div");
              created.setAttribute("data-studio-pasted-id", pasted.id);
              created.setAttribute("data-coding-studio-clone-of", selector);
              if (pasted.text) created.textContent = pasted.text;
              if (pasted.attributes && typeof pasted.attributes === "object") {
                Object.entries(pasted.attributes).forEach(([ak, av]) => {
                  if (typeof av === "string" && av && ak !== "id") {
                    try { created.setAttribute(ak, av); } catch (_) {}
                  }
                });
              }
              if (pasted.styles && typeof pasted.styles === "object") applyStyles(created, pasted.styles);
              if (pasted.placement === "inside") el.appendChild(created);
              else if (pasted.placement === "before") parent.insertBefore(created, el);
              else parent.insertBefore(created, el.nextSibling);
            }
          }
        }
      };

      let selected = null;
      let multiSelectedSet = new Set();
      let enabled = true;
      let snapGrid = true;
      let gridStep = 8;
      let dragState = null;
      let justDragged = false;
      let activeEditsCache = {};
      const svgShapeTags = new Set(["path", "circle", "rect", "line", "polyline", "polygon", "ellipse"]);
      const editableSelector = "button,a,input,textarea,select,label,h1,h2,h3,h4,h5,h6,p,span,div,section,article,li,td,th,img,svg,path,circle,rect,line,polyline,polygon";

      // Create interactive resize & drag handles overlay box + alignment guides
      let handlesBox = document.getElementById("coding-studio-handles-box");
      if (!handlesBox) {
        handlesBox = document.createElement("div");
        handlesBox.id = "coding-studio-handles-box";
        handlesBox.setAttribute("data-studio-preserve", "true");
        handlesBox.innerHTML =
          '<div class="studio-drag-badge" data-studio-handle="move">✥ اسحب للتحريك</div>' +
          '<div class="studio-resize-handle" data-studio-handle="se" style="bottom:-5px;right:-5px;cursor:nwse-resize"></div>' +
          '<div class="studio-resize-handle" data-studio-handle="sw" style="bottom:-5px;left:-5px;cursor:nesw-resize"></div>' +
          '<div class="studio-resize-handle" data-studio-handle="e" style="top:calc(50% - 4px);right:-5px;cursor:ew-resize"></div>' +
          '<div class="studio-resize-handle" data-studio-handle="s" style="bottom:-5px;left:calc(50% - 4px);cursor:ns-resize"></div>';
        document.body.appendChild(handlesBox);
      }
      let guideX = document.getElementById("coding-studio-align-guide-x");
      if (!guideX) {
        guideX = document.createElement("div");
        guideX.id = "coding-studio-align-guide-x";
        guideX.setAttribute("data-studio-preserve", "true");
        document.body.appendChild(guideX);
      }
      let guideY = document.getElementById("coding-studio-align-guide-y");
      if (!guideY) {
        guideY = document.createElement("div");
        guideY.id = "coding-studio-align-guide-y";
        guideY.setAttribute("data-studio-preserve", "true");
        document.body.appendChild(guideY);
      }

      const syncHandlesOverlay = () => {
        if (!enabled || !selected || !selected.isConnected) {
          if (handlesBox) handlesBox.style.display = "none";
          return;
        }
        const r = selected.getBoundingClientRect();
        if (r.width <= 0 && r.height <= 0) {
          handlesBox.style.display = "none";
          return;
        }
        handlesBox.style.display = "block";
        handlesBox.style.top = r.top + "px";
        handlesBox.style.left = r.left + "px";
        handlesBox.style.width = r.width + "px";
        handlesBox.style.height = r.height + "px";
      };

      window.addEventListener("scroll", syncHandlesOverlay, true);
      window.addEventListener("resize", syncHandlesOverlay);

      const syncMultiSelectionAttributes = () => {
        document.querySelectorAll("[data-coding-studio-multi-selected]").forEach((node) => {
          node.removeAttribute("data-coding-studio-multi-selected");
        });
        multiSelectedSet.forEach((sel) => {
          const node = find(sel);
          if (node) node.setAttribute("data-coding-studio-multi-selected", "true");
        });
      };

      const selectElement = (el, shiftKey = false, ctrlKey = false) => {
        if (!shiftKey && !ctrlKey && selected) {
          selected.removeAttribute("data-coding-studio-selected");
        }
        if (isProtected(el)) {
          send("STUDIO_PROTECTED_ELEMENT", { message: "البار العلوي وأدوات النظام محمية للحفاظ على وظائفها الأصلية." });
          return;
        }
        selected = el;
        selected.setAttribute("data-coding-studio-selected", "true");
        syncHandlesOverlay();
        send("STUDIO_SELECTED", {
          element: describe(selected),
          shiftKey: !!shiftKey,
          ctrlKey: !!ctrlKey,
        });
      };

      // Pointer down on Move badge, Resize handles, or Alt+Drag on selected element
      document.addEventListener("pointerdown", (event) => {
        if (!enabled || document.body.dataset.codingStudio !== "on" || !selected) return;
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        const handleEl = target.closest("[data-studio-handle]");
        const handleType = handleEl ? handleEl.getAttribute("data-studio-handle") : (event.altKey && selected.contains(target) ? "move" : null);
        if (!handleType) return;

        event.preventDefault();
        event.stopPropagation();

        const targetSelectors = multiSelectedSet.size > 1 && handleType === "move"
          ? Array.from(multiSelectedSet)
          : [selectorFor(selected)];

        const items = targetSelectors.map((sel) => {
          const node = find(sel);
          if (!node) return null;
          rememberOriginal(sel, node);
          const rect = node.getBoundingClientRect();
          const startX = parseFloat(node.style.left) || 0;
          const startY = parseFloat(node.style.top) || 0;
          node.setAttribute("data-coding-studio-dragging", "true");
          return {
            selector: sel,
            node,
            startX,
            startY,
            startW: Math.round(rect.width),
            startH: Math.round(rect.height),
            x: startX,
            y: startY,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        }).filter(Boolean);

        if (!items.length) return;
        dragState = {
          handleType,
          clientX0: event.clientX,
          clientY0: event.clientY,
          items,
          moved: false,
        };
      }, true);

      document.addEventListener("pointermove", (event) => {
        if (!dragState) return;
        const rawDx = event.clientX - dragState.clientX0;
        const rawDy = event.clientY - dragState.clientY0;
        if (Math.abs(rawDx) > 2 || Math.abs(rawDy) > 2) dragState.moved = true;
        const step = snapGrid ? Math.max(1, gridStep) : 1;
        const dx = Math.round(rawDx / step) * step;
        const dy = Math.round(rawDy / step) * step;

        for (const item of dragState.items) {
          if (dragState.handleType === "move") {
            item.x = item.startX + dx;
            item.y = item.startY + dy;
            const currentPos = getComputedStyle(item.node).position;
            if (currentPos === "static") item.node.style.setProperty("position", "relative", "important");
            item.node.style.setProperty("left", item.x + "px", "important");
            item.node.style.setProperty("top", item.y + "px", "important");
          } else {
            if (dragState.handleType.includes("e")) {
              item.width = Math.max(24, item.startW + dx);
              item.node.style.setProperty("width", item.width + "px", "important");
            }
            if (dragState.handleType.includes("s")) {
              item.height = Math.max(20, item.startH + dy);
              item.node.style.setProperty("height", item.height + "px", "important");
            }
          }
        }

        // Alignment guides against parent center
        if (selected && selected.parentElement) {
          const pr = selected.parentElement.getBoundingClientRect();
          const sr = selected.getBoundingClientRect();
          const cxDiff = Math.abs((sr.left + sr.width / 2) - (pr.left + pr.width / 2));
          const cyDiff = Math.abs((sr.top + sr.height / 2) - (pr.top + pr.height / 2));
          if (cxDiff < 6 && guideY) {
            guideY.style.display = "block";
            guideY.style.left = Math.round(pr.left + pr.width / 2) + "px";
          } else if (guideY) {
            guideY.style.display = "none";
          }
          if (cyDiff < 6 && guideX) {
            guideX.style.display = "block";
            guideX.style.top = Math.round(pr.top + pr.height / 2) + "px";
          } else if (guideX) {
            guideX.style.display = "none";
          }
        }
        syncHandlesOverlay();
      }, true);

      document.addEventListener("pointerup", () => {
        if (!dragState) return;
        const finished = dragState;
        dragState = null;
        if (guideX) guideX.style.display = "none";
        if (guideY) guideY.style.display = "none";
        finished.items.forEach((it) => it.node.removeAttribute("data-coding-studio-dragging"));
        if (finished.moved) {
          justDragged = true;
          setTimeout(() => { justDragged = false; }, 120);
          send("STUDIO_FREE_POSITION_COMMIT", {
            items: finished.items.map((it) => ({
              selector: it.selector,
              x: it.x,
              y: it.y,
              width: finished.handleType !== "move" ? it.width : undefined,
              height: finished.handleType !== "move" ? it.height : undefined,
            })),
          });
        }
        syncHandlesOverlay();
      }, true);

      document.body.dataset.codingStudio = "on";
      document.addEventListener("click", (event) => {
        if (!enabled || document.body.dataset.codingStudio !== "on") return;
        if (justDragged) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        const target = event.target instanceof Element ? event.target : null;
        if (!target || target.closest("#coding-studio-handles-box")) return;
        if (target === document.body || target === document.documentElement || target.tagName.toLowerCase() === "main") {
          if (selected) selected.removeAttribute("data-coding-studio-selected");
          selected = null;
          multiSelectedSet.clear();
          syncMultiSelectionAttributes();
          syncHandlesOverlay();
          send("STUDIO_CLEAR_SELECTION", {});
          return;
        }
        let el = target.closest(editableSelector);
        if (!el || el === document.body || el === document.documentElement) return;
        if (svgShapeTags.has(el.tagName.toLowerCase())) el = el.closest("svg") || el;
        if (isProtected(el)) {
          send("STUDIO_PROTECTED_ELEMENT", { message: "البار العلوي وأدوات النظام محمية للحفاظ على وظائفها وتنسيقها الأصلي." });
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        selectElement(el, event.shiftKey, event.ctrlKey || event.metaKey);
      }, true);
      document.addEventListener("contextmenu", (event) => {
        if (!enabled || document.body.dataset.codingStudio !== "on") return;
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        let el = target.closest(editableSelector);
        if (!el || el === document.body || el === document.documentElement || isProtected(el)) return;
        if (svgShapeTags.has(el.tagName.toLowerCase())) el = el.closest("svg") || el;
        event.preventDefault();
        event.stopPropagation();
        selectElement(el, false, false);
        send("STUDIO_CONTEXT_MENU", {
          element: describe(el),
          x: event.clientX,
          y: event.clientY,
        });
      }, true);
      window.addEventListener("message", (event) => {
        if (event.origin !== parentOrigin || event.source !== window.parent || event.data?.type !== "STUDIO_COMMAND") return;
        const data = event.data;
        if (data.action === "setMode") {
          enabled = !!data.enabled;
          snapGrid = data.snapToGrid !== false;
          if (data.gridSize) gridStep = Number(data.gridSize) || 8;
          document.body.dataset.codingStudio = enabled ? "on" : "off";
          document.body.dataset.codingStudioXray = data.xRay ? "on" : "off";
          if (!enabled && selected) selected.removeAttribute("data-coding-studio-selected");
          syncHandlesOverlay();
          return;
        }
        if (data.action === "clearSelection") {
          if (selected) selected.removeAttribute("data-coding-studio-selected");
          selected = null;
          multiSelectedSet.clear();
          syncMultiSelectionAttributes();
          syncHandlesOverlay();
          return;
        }
        if (data.action === "setMultiSelection") {
          multiSelectedSet = new Set(Array.isArray(data.selectors) ? data.selectors : []);
          syncMultiSelectionAttributes();
          return;
        }
        if (data.action === "restore") {
          activeEditsCache = data.edits || {};
          resetPreviewEdits();
          rebuildResponsiveSheet(activeEditsCache, data.designSystem);
          Object.entries(activeEditsCache).forEach(([selector, edit]) => applyEdit(selector, edit));
          syncMultiSelectionAttributes();
          syncHandlesOverlay();
          return;
        }
        const el = data.selector
          ? find(data.selector)
          : selected;
        if (!el) return;
        if (data.action === "select") {
          selectElement(el, !!data.shiftKey, !!data.ctrlKey);
          el.scrollIntoView({ block: "nearest", behavior: "smooth" });
          return;
        }
        if (isProtected(el) || (containsProtected(el) && (
          data.action === "delete" ||
          (data.action === "style" && hidesProtected({ styles: data.styles || {} }))
        ))) {
          send("STUDIO_PROTECTED_ELEMENT", { message: "البار العلوي وأدوات النظام محمية للحفاظ على وظائفها الأصلية." });
          return;
        }
        const selector = selectorFor(el);
        rememberOriginal(selector, el);
        const notify = (patch) => {
          if (!data.silent) {
            send("STUDIO_CHANGE", { selector, patch });
          }
        };
        if (data.action === "style") {
          applyStyles(el, data.styles || {});
          syncHandlesOverlay();
          notify({ styles: data.styles || {} });
        } else if (data.action === "text") {
          applyText(el, data.text);
          syncHandlesOverlay();
          notify({ text: data.text });
        } else if (data.action === "attributes") {
          Object.entries(data.attributes || {}).forEach(([k, v]) => {
            if (typeof v === "string") {
              try { el.setAttribute(k, v); } catch (_) {}
            }
          });
          notify({ attributes: data.attributes || {} });
        } else if (data.action === "animation") {
          applyAnimation(el, data.animation);
          notify({ animation: data.animation });
        } else if (data.action === "delete") {
          el.style.setProperty("display", "none", "important");
          syncHandlesOverlay();
          notify({ deleted: true });
        } else if (data.action === "show") {
          el.style.removeProperty("display");
          syncHandlesOverlay();
          notify({ deleted: false });
        } else if (data.action === "duplicate") {
          const parent = el.parentElement;
          if (parent) {
            const clone = el.cloneNode(true);
            clone.removeAttribute("id");
            clone.removeAttribute("data-coding-studio-selected");
            clone.removeAttribute("data-coding-studio-multi-selected");
            clone.setAttribute("data-coding-studio-clone-of", selector);
            el.after(clone);
            const count = Array.from(parent.children).filter((item) =>
              item.getAttribute("data-coding-studio-clone-of") === selector).length;
            notify({ duplicateCount: count });
          }
        } else if ((data.action === "moveUp" || data.action === "moveDown") && el.parentElement) {
          const orig = originalStates.get(selector);
          if (orig) orig.wasReordered = true;
          const siblings = Array.from(el.parentElement.children).filter((item) =>
            item.getAttribute("data-coding-studio-clone-of") !== selector &&
            item.getAttribute("data-studio-clone-of") !== selector);
          const index = siblings.indexOf(el);
          const next = data.action === "moveUp" ? index - 1 : index + 1;
          if (next >= 0 && next < siblings.length) {
            if (data.action === "moveUp") el.parentElement.insertBefore(el, siblings[next]);
            else el.parentElement.insertBefore(siblings[next], el);
            const order = Array.from(el.parentElement.children).filter((item) =>
              item.getAttribute("data-coding-studio-clone-of") !== selector &&
              item.getAttribute("data-studio-clone-of") !== selector).indexOf(el);
            syncHandlesOverlay();
            notify({ order });
          }
        }
      });
      const meaningfulTags = new Set(["main", "header", "nav", "aside", "footer", "section", "article", "form", "button", "a", "input", "select", "textarea", "table", "thead", "tbody", "tr", "td", "th", "h1", "h2", "h3", "h4", "h5", "h6", "p", "img", "svg", "ul", "ol", "li", "label", "details", "summary"]);
      let scanTimer = null;
      const collectTreeAndRoutes = () => {
        let count = 0;
        const buildNode = (element, depth) => {
          if (!(element instanceof Element) || count >= 220 || depth > 6) return null;
          if (element.id?.startsWith("coding-studio-")) return null;
          const tag = element.tagName.toLowerCase();
          if (["script", "style", "link", "meta", "noscript", "iframe"].includes(tag)) return null;
          count += 1;
          const childElements = Array.from(element.children).filter((child) =>
            !child.id?.startsWith("coding-studio-") &&
            !["script", "style", "link", "meta", "noscript", "iframe"].includes(child.tagName.toLowerCase()));
          const children = [];
          for (const child of childElements) {
            if (count >= 220) break;
            const node = buildNode(child, depth + 1);
            if (node) children.push(node);
          }
          const directText = Array.from(element.childNodes)
            .filter((node) => node.nodeType === Node.TEXT_NODE)
            .map((node) => node.textContent || "").join(" ").trim();
          const accessible = element.getAttribute("aria-label") || element.getAttribute("title") || element.getAttribute("alt") || "";
          const interactiveText = ["button", "a", "label", "h1", "h2", "h3", "h4", "h5", "h6", "p", "li"].includes(tag)
            ? (element.innerText || "") : "";
          const rawText = directText || accessible || interactiveText;
          const label = String(rawText || (element.hasAttribute("data-testid") ? element.getAttribute("data-testid") : tag.toUpperCase()))
            .replace(/\s+/g, " ").trim().slice(0, 84);
          const meaningful = depth < 2 || meaningfulTags.has(tag) || element.hasAttribute("role") ||
            element.hasAttribute("data-testid") || children.length > 0 || rawText.length > 0;
          if (!meaningful) return null;
          return { selector: selectorFor(element), tag, label: label || tag.toUpperCase(), children };
        };
        const nodes = Array.from(document.body.children).map((element) => buildNode(element, 0)).filter(Boolean);
        send("STUDIO_TREE", { nodes: nodes.slice(0, 90) });

        const routeMap = new Map();
        const currentHref = location.pathname + location.search;
        routeMap.set(currentHref, document.title || currentHref || "الصفحة الحالية");
        document.querySelectorAll("a[href]").forEach((anchor) => {
          try {
            const url = new URL(anchor.href, location.href);
            if (url.origin !== location.origin || !url.pathname.startsWith("/") || url.pathname.startsWith("//")) return;
            const href = url.pathname + url.search;
            const labelText = String(anchor.innerText || anchor.getAttribute("aria-label") || anchor.getAttribute("title") || href)
              .replace(/\s+/g, " ").trim().slice(0, 72);
            if (!routeMap.has(href) || routeMap.get(href) === href) routeMap.set(href, labelText || href);
          } catch (_) {}
        });
        send("STUDIO_ROUTES", { routes: Array.from(routeMap.entries()).map(([href, label]) => ({ href, label })).slice(0, 100) });
      };
      const scheduleCollect = () => {
        if (scanTimer) clearTimeout(scanTimer);
        scanTimer = setTimeout(collectTreeAndRoutes, 180);
      };
      const liveObserver = new MutationObserver(scheduleCollect);
      liveObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
      scheduleCollect();
      window.addEventListener("load", scheduleCollect, { once: true });
      send("STUDIO_BRIDGE_READY", {});
    })();`;
    doc.body.appendChild(script);
  }, [editMode, previewSource, xRayMode, snapToGrid, gridSizePx, activeDisplayedEdits, designSystem, send]);

  const applyStyle = (styles: Record<string, string>) => {
    if (!selected || previewSource === "published") return;
    const targetSelectors =
      multiSelectedSelectors.length > 1 ? multiSelectedSelectors : [selected.selector];
    for (const sel of targetSelectors) {
      if (editsRef.current[sel]?.locked) continue;
      if (responsiveEditTarget === "desktop") {
        commitEdits(sel, { styles });
        send({ action: "style", selector: sel, styles, silent: true });
      } else {
        commitEdits(sel, {
          responsiveStyles: {
            [responsiveEditTarget]: styles,
          },
        });
      }
    }
    if (responsiveEditTarget !== "desktop") {
      send({ action: "restore", edits: editsRef.current, designSystem });
    }
  };

  const editText = (value: string) => {
    setTextValue(value);
    if (!selected || previewSource === "published") return;
    if (editsRef.current[selected.selector]?.locked) return;
    const prevEdit = editsRef.current[selected.selector];
    const origText = prevEdit?.originalText || selected.originalText || selected.text;
    commitEdits(selected.selector, {
      text: value,
      ...(origText ? { originalText: origText } : {}),
    });
    send({ action: "text", selector: selected.selector, text: value, originalText: origText, silent: true });
  };

  const action = (name: string, patch?: StudioDomEdit) => {
    if (!selected || previewSource === "published") return;
    if (editsRef.current[selected.selector]?.locked && name !== "unlock") return;
    if (patch) commitEdits(selected.selector, patch);
    send({ action: name, selector: selected.selector, silent: Boolean(patch) });
  };

  const resetSelectedElementEdits = () => {
    if (!selected || previewSource === "published") return;
    const next = { ...editsRef.current };
    delete next[selected.selector];
    editsRef.current = next;
    lastCommittedEditsRef.current = next;
    selfCommittedSetRef.current.add(next);
    setEdits(next);
    changeCallbackRef.current(next);
    send({ action: "restore", edits: next, designSystem });
  };

  const parentAncestor = useMemo(() => {
    if (!selected?.ancestors || selected.ancestors.length < 2) return null;
    const parent = selected.ancestors[selected.ancestors.length - 2];
    if (!parent || parent.selector === "body") return null;
    return parent;
  }, [selected]);

  const applyContentLayoutPreset = (
    preset: "grid" | "list" | "row" | "block",
    colsOverride?: string,
  ) => {
    if (!selected || previewSource === "published") return;
    const targetSelector =
      layoutTargetMode === "parent" && parentAncestor
        ? parentAncestor.selector
        : selected.selector;
    if (editsRef.current[targetSelector]?.locked) return;

    const cols = colsOverride || gridColumnsCount || "3";
    const activeGap = gapValue || "16px";
    let styles: Record<string, string> = {};

    if (preset === "grid") {
      const template =
        cols === "auto"
          ? "repeat(auto-fill, minmax(220px, 1fr))"
          : `repeat(${cols}, minmax(0, 1fr))`;
      styles = {
        display: "grid",
        gridTemplateColumns: template,
        flexDirection: "",
        flexWrap: "",
        gap: activeGap,
      };
      if (targetSelector === selected.selector) {
        setDisplayMode("grid");
        setGapValue(activeGap);
      }
      setGridColumnsCount(cols);
    } else if (preset === "list") {
      styles = {
        display: "flex",
        flexDirection: "column",
        flexWrap: "nowrap",
        gridTemplateColumns: "none",
        alignItems: "stretch",
        gap: gapValue || "12px",
      };
      if (targetSelector === selected.selector) {
        setDisplayMode("flex");
        setFlexDirection("column");
        setAlignItems("stretch");
        setGapValue(gapValue || "12px");
      }
    } else if (preset === "row") {
      styles = {
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        gridTemplateColumns: "none",
        alignItems: "center",
        gap: activeGap,
      };
      if (targetSelector === selected.selector) {
        setDisplayMode("flex");
        setFlexDirection("row");
        setGapValue(activeGap);
      }
    } else {
      styles = {
        display: "block",
        gridTemplateColumns: "none",
        flexDirection: "",
        flexWrap: "",
      };
      if (targetSelector === selected.selector) {
        setDisplayMode("block");
      }
    }

    if (responsiveEditTarget === "desktop") {
      commitEdits(targetSelector, { styles });
      send({ action: "style", selector: targetSelector, styles, silent: true });
    } else {
      commitEdits(targetSelector, {
        responsiveStyles: {
          [responsiveEditTarget]: styles,
        },
      });
      send({ action: "restore", edits: editsRef.current, designSystem });
    }
    setStatus(
      `تم تغيير أسلوب العرض إلى (${
        preset === "grid"
          ? `شبكة Grid — ${cols === "auto" ? "تلقائي" : cols + " أعمدة"}`
          : preset === "list"
            ? "قائمة رأسية List"
            : preset === "row"
              ? "صف أفقي مرن Row"
              : "كتلة عادية Block"
      })`,
    );
  };

  const deleteOrRestoreSelectedElement = useCallback(() => {
    if (!selected || previewSource === "published") return;
    const targets =
      multiSelectedSelectors.length > 1 ? multiSelectedSelectors : [selected.selector];
    const nextDeleted = !Boolean(editsRef.current[selected.selector]?.deleted);
    const patches: Record<string, StudioDomEdit> = {};
    for (const sel of targets) {
      if (editsRef.current[sel]?.locked) continue;
      patches[sel] = { deleted: nextDeleted };
      send({
        action: nextDeleted ? "delete" : "show",
        selector: sel,
        silent: true,
      });
    }
    commitBatchEdits(patches);
    setPendingDeleteConfirm(false);
    setStatus(
      nextDeleted
        ? `تم حذف/إخفاء (${targets.length}) عنصر من الصفحة — يمكنك التراجع (Ctrl+Z) أو استعادته في أي وقت.`
        : `تمت استعادة (${targets.length}) عنصر بنجاح.`,
    );
  }, [selected, previewSource, multiSelectedSelectors, commitBatchEdits, send]);

  // 8.2 Copy, Cut, Paste, and Duplicate Handlers
  const handleCopyElements = useCallback(() => {
    if (!selected) return;
    const targets =
      multiSelectedSelectors.length > 1 ? multiSelectedSelectors : [selected.selector];
    const activePageRoute = (safeRoute.split("?")[0] || "/admin").replace(/\/+$/, "") || "/";
    const items = targets.map((sel) => {
      const ed = editsRef.current[sel] || {};
      const isPrimary = sel === selected.selector;
      return {
        selector: sel,
        tag: isPrimary ? selected.tag : "div",
        text: ed.text ?? (isPrimary ? selected.text : ""),
        styles: {
          ...(isPrimary
            ? {
                color: textColor,
                backgroundColor,
                fontSize: fontSize + "px",
                fontWeight,
                borderRadius,
              }
            : {}),
          ...(ed.styles || {}),
        },
        attributes: { ...(ed.attributes || {}) },
        animation: ed.animation,
        actionBinding: ed.actionBinding,
        freePosition: ed.freePosition,
      };
    });
    setElementClipboard({
      mode: "copy",
      items,
      sourcePageRoute: activePageRoute,
      copiedAt: new Date().toISOString(),
    });
    setStatus(`تم نسخ (${items.length}) عنصر إلى حافظة الاستوديو (Ctrl+V للصق).`);
  }, [
    selected,
    multiSelectedSelectors,
    safeRoute,
    textColor,
    backgroundColor,
    fontSize,
    fontWeight,
    borderRadius,
  ]);

  const handleCutElements = useCallback(() => {
    if (!selected || previewSource === "published") return;
    const targets =
      multiSelectedSelectors.length > 1 ? multiSelectedSelectors : [selected.selector];
    if (targets.some((s) => editsRef.current[s]?.locked)) {
      setStatus("لا يمكن قص عنصر مقفل. قم بفك القفل أولاً.");
      return;
    }
    const activePageRoute = (safeRoute.split("?")[0] || "/admin").replace(/\/+$/, "") || "/";
    const items = targets.map((sel) => {
      const ed = editsRef.current[sel] || {};
      const isPrimary = sel === selected.selector;
      return {
        selector: sel,
        tag: isPrimary ? selected.tag : "div",
        text: ed.text ?? (isPrimary ? selected.text : ""),
        styles: {
          ...(isPrimary
            ? {
                color: textColor,
                backgroundColor,
                fontSize: fontSize + "px",
                fontWeight,
                borderRadius,
              }
            : {}),
          ...(ed.styles || {}),
        },
        attributes: { ...(ed.attributes || {}) },
        animation: ed.animation,
        actionBinding: ed.actionBinding,
        freePosition: ed.freePosition,
      };
    });
    // Safe Cut rule: retain original until paste succeeds as one undoable operation
    setElementClipboard({
      mode: "cut",
      items,
      sourcePageRoute: activePageRoute,
      copiedAt: new Date().toISOString(),
    });
    setStatus(
      `تم تجهيز (${items.length}) عنصر للقص الآمن — سيُنقل العنصر الأصلي فور نجاح اللصق (Ctrl+V) كعملية واحدة قابلة للتراجع.`,
    );
  }, [
    selected,
    previewSource,
    multiSelectedSelectors,
    safeRoute,
    textColor,
    backgroundColor,
    fontSize,
    fontWeight,
    borderRadius,
  ]);

  const handlePasteElements = useCallback(
    (placementOverride?: "after" | "inside" | "before") => {
      if (!elementClipboard || elementClipboard.items.length === 0 || previewSource === "published") {
        return;
      }
      const targetSelector =
        selected?.selector || treeNodes[0]?.selector || "main";
      if (editsRef.current[targetSelector]?.locked) {
        setStatus("الحاوية الهدف مقفلة؛ فك القفل أولاً قبل اللصق.");
        return;
      }
      const targetPlacement = placementOverride || pastePlacement;
      const existingPasted = editsRef.current[targetSelector]?.pastedNodes || [];
      const reservedIds = existingPasted.map((n) => n.id);
      const newNodes: StudioPastedNode[] = elementClipboard.items.map((clipItem) => {
        const cleanAttrs = { ...(clipItem.attributes || {}) };
        delete cleanAttrs.id;
        const uniqueId = createStudioId("pasted", reservedIds);
        reservedIds.push(uniqueId);
        return {
          id: uniqueId,
          sourceSelector: clipItem.selector,
          tag: clipItem.tag || "div",
          text: clipItem.text,
          styles: { ...(clipItem.styles || {}) },
          attributes: cleanAttrs,
          animation: clipItem.animation,
          actionBinding: clipItem.actionBinding,
          freePosition: clipItem.freePosition,
          placement: targetPlacement,
          createdAt: new Date().toISOString(),
        };
      });

      const patches: Record<string, StudioDomEdit> = {
        [targetSelector]: {
          pastedNodes: [...existingPasted, ...newNodes],
        },
      };

      // If Cut mode, mark original elements as moved/deleted atomically in the same undo step
      if (elementClipboard.mode === "cut") {
        for (const clipItem of elementClipboard.items) {
          if (clipItem.selector && clipItem.selector !== targetSelector) {
            patches[clipItem.selector] = {
              deleted: true,
              pageRoute: elementClipboard.sourcePageRoute,
            };
          }
        }
        setElementClipboard({ ...elementClipboard, mode: "copy" });
      }

      commitBatchEdits(patches);
      send({ action: "restore", edits: editsRef.current, designSystem });
      setStatus(
        elementClipboard.mode === "cut"
          ? `تم نقل ولصق (${newNodes.length}) عنصر بنجاح مع توليد معرفات فريدة.`
          : `تم لصق (${newNodes.length}) عنصر (${targetPlacement === "inside" ? "داخل الحاوية" : targetPlacement === "before" ? "قبل العنصر" : "بعد العنصر"}) بمعرفات فريدة.`,
      );
    },
    [elementClipboard, previewSource, selected, treeNodes, pastePlacement, commitBatchEdits, send, designSystem],
  );

  const handleDuplicateElements = useCallback(() => {
    if (!selected || previewSource === "published") return;
    const targets =
      multiSelectedSelectors.length > 1 ? multiSelectedSelectors : [selected.selector];
    const patches: Record<string, StudioDomEdit> = {};
    for (const sel of targets) {
      if (editsRef.current[sel]?.locked) continue;
      const nextCount = Math.min(5, Number(editsRef.current[sel]?.duplicateCount || 0) + 1);
      patches[sel] = { duplicateCount: nextCount };
      send({ action: "duplicate", selector: sel, silent: true });
    }
    commitBatchEdits(patches);
    setStatus(`تم تكرار (${targets.length}) عنصر بنجاح.`);
  }, [selected, previewSource, multiSelectedSelectors, commitBatchEdits, send]);

  // 8.3 Free Positioning & Keyboard Nudge Helpers
  const applyFreePositionCoordinates = useCallback(
    (nextX: number, nextY: number, modeOverride?: "relative" | "absolute") => {
      if (!selected || previewSource === "published") return;
      const mode = modeOverride || freePosMode || "relative";
      const targets =
        multiSelectedSelectors.length > 1 ? multiSelectedSelectors : [selected.selector];
      const deltaX = nextX - freePosX;
      const deltaY = nextY - freePosY;
      const patches: Record<string, StudioDomEdit> = {};

      for (const sel of targets) {
        if (editsRef.current[sel]?.locked) continue;
        const prevFp = editsRef.current[sel]?.freePosition;
        const itemX = sel === selected.selector ? nextX : (prevFp?.x ?? 0) + deltaX;
        const itemY = sel === selected.selector ? nextY : (prevFp?.y ?? 0) + deltaY;
        const zVal = prevFp?.zIndex ?? (Number(zIndexValue) || 20);
        patches[sel] = {
          freePosition: {
            enabled: true,
            mode,
            x: itemX,
            y: itemY,
            width: prevFp?.width,
            height: prevFp?.height,
            zIndex: zVal,
            gridSize: gridSizePx,
          },
          styles: {
            position: mode,
            left: `${itemX}px`,
            top: `${itemY}px`,
            zIndex: String(zVal),
          },
        };
        send({
          action: "style",
          selector: sel,
          styles: {
            position: mode,
            left: `${itemX}px`,
            top: `${itemY}px`,
            zIndex: String(zVal),
          },
          silent: true,
        });
      }
      setFreePosEnabled(true);
      setFreePosMode(mode);
      setFreePosX(nextX);
      setFreePosY(nextY);
      setPositionMode(mode);
      commitBatchEdits(patches);
    },
    [
      selected,
      previewSource,
      freePosMode,
      multiSelectedSelectors,
      freePosX,
      freePosY,
      zIndexValue,
      gridSizePx,
      commitBatchEdits,
      send,
    ],
  );

  const restoreNormalLayoutForSelection = useCallback(() => {
    if (!selected || previewSource === "published") return;
    const targets =
      multiSelectedSelectors.length > 1 ? multiSelectedSelectors : [selected.selector];
    const patches: Record<string, StudioDomEdit> = {};
    for (const sel of targets) {
      if (editsRef.current[sel]?.locked) continue;
      patches[sel] = {
        freePosition: {
          enabled: false,
          x: 0,
          y: 0,
        },
        styles: {
          position: "",
          left: "",
          top: "",
          zIndex: "",
        },
      };
      send({
        action: "style",
        selector: sel,
        styles: { position: "", left: "", top: "", zIndex: "" },
        silent: true,
      });
    }
    setFreePosEnabled(false);
    setFreePosX(0);
    setFreePosY(0);
    setPositionMode("static");
    commitBatchEdits(patches);
    setStatus("تمت استعادة التخطيط الطبيعي (Normal Flow) وإلغاء الإحداثيات الحرة.");
  }, [selected, previewSource, multiSelectedSelectors, commitBatchEdits, send]);

  // Keyboard shortcuts for Multi-Select, Copy, Cut, Paste, Duplicate, Delete, and Arrow Nudging
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!editMode || previewSource === "published" || !selected) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        clearSelection();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        e.preventDefault();
        handleCopyElements();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x") {
        e.preventDefault();
        handleCutElements();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        e.preventDefault();
        handlePasteElements();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        handleDuplicateElements();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteOrRestoreSelectedElement();
        return;
      }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : snapToGrid ? Math.max(1, gridSizePx) : 1;
        const dx = e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0;
        const dy = e.key === "ArrowDown" ? step : e.key === "ArrowUp" ? -step : 0;
        applyFreePositionCoordinates(freePosX + dx, freePosY + dy);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    editMode,
    previewSource,
    selected,
    snapToGrid,
    gridSizePx,
    freePosX,
    freePosY,
    clearSelection,
    handleCopyElements,
    handleCutElements,
    handlePasteElements,
    handleDuplicateElements,
    deleteOrRestoreSelectedElement,
    applyFreePositionCoordinates,
  ]);

  const frameWidth =
    previewSize === "mobile"
      ? "390px"
      : previewSize === "tablet"
        ? "820px"
        : customViewportWidth < 1280
          ? `${customViewportWidth}px`
          : "100%";

  const selectedIsVector =
    !!selected &&
    ["svg", "path", "circle", "rect", "line", "polyline", "polygon"].includes(selected.tag);

  const selectedEdit = selected ? edits[selected.selector] || {} : {};
  const isSelectedLocked = Boolean(selectedEdit.locked);
  const isSelectedHidden = Boolean(selectedEdit.deleted);

  // 8.4 Resolve Assigned Element Function / Action for the currently selected element
  const resolvedElementAction = useMemo(() => {
    if (!selected) return null;
    return detectElementAssignedAction({
      tag: selected.tag,
      text: textValue || selected.text,
      selector: selected.selector,
      href: hrefVal || selected.hrefAttr,
      attributes: {
        role: roleVal || selected.roleAttr,
        "aria-label": ariaLabelVal || selected.ariaLabel,
        ...(selectedEdit.attributes || {}),
      },
      existingBinding: selectedEdit.actionBinding,
    });
  }, [
    selected,
    textValue,
    hrefVal,
    roleVal,
    ariaLabelVal,
    selectedEdit.attributes,
    selectedEdit.actionBinding,
  ]);

  const visibleTreeNodes = useMemo(() => {
    const query = treeFilter.trim().toLocaleLowerCase();
    if (!query) return treeNodes;
    const filterNodes = (nodes: LiveTreeNode[]): LiveTreeNode[] =>
      nodes
        .map((node) => ({ ...node, children: filterNodes(node.children || []) }))
        .filter(
          (node) =>
            node.label.toLocaleLowerCase().includes(query) ||
            node.tag.toLocaleLowerCase().includes(query) ||
            (edits[node.selector]?.label || "").toLocaleLowerCase().includes(query) ||
            node.children.length > 0,
        );
    return filterNodes(treeNodes);
  }, [treeNodes, treeFilter, edits]);

  const toggleCollapseNode = (selector: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedNodes((prev) => ({ ...prev, [selector]: !prev[selector] }));
  };

  const renderTreeNodes = (nodes: LiveTreeNode[], depth = 0): React.ReactNode =>
    nodes.map((node) => {
      const nodeEdit = edits[node.selector] || {};
      const hasChildren = node.children && node.children.length > 0;
      const isCollapsed = Boolean(collapsedNodes[node.selector]);
      const isNodeSelected =
        selected?.selector === node.selector || multiSelectedSelectors.includes(node.selector);
      const customLabel = nodeEdit.label || node.label;

      return (
        <div key={node.selector} className="min-w-0">
          <div
            className={
              "group flex min-h-7 w-full items-center justify-between gap-1 rounded-lg px-1.5 py-1 text-right text-[11px] transition " +
              (isNodeSelected
                ? "bg-primary text-primary-foreground font-black shadow-2xs"
                : "text-foreground hover:bg-accent")
            }
            style={{ paddingRight: Math.min(20, depth * 7 + 4) + "px" }}
          >
            <button
              type="button"
              title={`${node.selector} (Shift+Click أو Ctrl+Click للتحديد المتعدد)`}
              onClick={(e) =>
                send({
                  action: "select",
                  selector: node.selector,
                  shiftKey: e.shiftKey,
                  ctrlKey: e.ctrlKey || e.metaKey,
                })
              }
              className="flex min-w-0 flex-1 items-center gap-1.5 text-right cursor-pointer"
            >
              {hasChildren ? (
                <span
                  onClick={(e) => toggleCollapseNode(node.selector, e)}
                  className="p-0.5 rounded hover:bg-black/10"
                >
                  {isCollapsed ? <ChevronLeft size={11} /> : <ChevronDown size={11} />}
                </span>
              ) : (
                <span className="w-3" />
              )}
              <input
                type="checkbox"
                checked={isNodeSelected}
                onChange={() => {}}
                onClick={(e) => {
                  e.stopPropagation();
                  send({
                    action: "select",
                    selector: node.selector,
                    shiftKey: false,
                    ctrlKey: true,
                  });
                }}
                title="إضافة أو إزالة من التحديد المتعدد"
                className="h-3 w-3 rounded accent-primary cursor-pointer shrink-0"
              />
              <span
                className={
                  "shrink-0 rounded px-1 font-mono text-[9px] " +
                  (isNodeSelected
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground")
                }
              >
                {node.tag}
              </span>
              <span className="min-w-0 flex-1 truncate">{customLabel}</span>
            </button>

            {/* Layer Quick Actions: Lock, Visibility, Duplicate */}
            <div className="flex items-center gap-0.5 opacity-70 group-hover:opacity-100 shrink-0">
              <button
                type="button"
                title={nodeEdit.locked ? "إلغاء القفل" : "قفل الطبقة"}
                onClick={(e) => {
                  e.stopPropagation();
                  commitEdits(node.selector, { locked: !nodeEdit.locked });
                }}
                className="p-0.5 rounded hover:bg-black/10 cursor-pointer"
              >
                {nodeEdit.locked ? (
                  <Lock size={11} className="text-amber-400" />
                ) : (
                  <Unlock size={11} />
                )}
              </button>
              <button
                type="button"
                title={nodeEdit.deleted ? "إظهار العنصر" : "إخفاء العنصر"}
                onClick={(e) => {
                  e.stopPropagation();
                  const nextDeleted = !nodeEdit.deleted;
                  commitEdits(node.selector, { deleted: nextDeleted });
                  send({
                    action: nextDeleted ? "delete" : "show",
                    selector: node.selector,
                  });
                }}
                className="p-0.5 rounded hover:bg-black/10 cursor-pointer"
              >
                {nodeEdit.deleted ? (
                  <EyeOff size={11} className="text-rose-400" />
                ) : (
                  <Eye size={11} />
                )}
              </button>
            </div>
          </div>
          {hasChildren && !isCollapsed && (
            <div className="mr-2 border-r border-border/70 pr-1">
              {renderTreeNodes(node.children, depth + 1)}
            </div>
          )}
        </div>
      );
    });

  const navigatePreview = (href: string) => {
    if (!href.startsWith("/") || href.startsWith("//")) return;
    setCurrentRoute(href);
    setSelected(null);
    setFrameKey((value) => value + 1);
  };

  const filteredPagesList = useMemo(() => {
    const q = pageSearch.trim().toLowerCase();
    return Object.values(pages).filter(
      (p) =>
        !q || p.name.toLowerCase().includes(q) || p.route.toLowerCase().includes(q),
    );
  }, [pages, pageSearch]);

  return (
    <div
      className={
        "flex h-full min-h-0 w-full flex-col overflow-hidden bg-background " +
        (isFullScreen ? "fixed inset-0 z-50" : "")
      }
      dir="rtl"
      onClick={() => contextMenu && setContextMenu(null)}
    >
      {/* ========================================================= */}
      {/* COMPACT CANVAS BAR (1 CANONICAL TOGGLE PER DRAWER/TOOL)   */}
      {/* ========================================================= */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b bg-card px-2.5 py-1 overflow-x-auto no-scrollbar">
        {/* Right side: Canonical Structure Drawer Toggle + Canonical Inspector Toggle */}
        <div className="flex min-w-0 items-center gap-1.5 shrink-0">
          <Button
            type="button"
            size="sm"
            variant={showLeftPanel ? "default" : "outline"}
            className="h-7 gap-1 px-2 text-[11px] cursor-pointer"
            onClick={() => {
              const next = !showLeftPanel;
              if (next) onOpenDrawer?.();
              setShowLeftPanel(next);
            }}
            title="فتح أو إغلاق درج الصفحات وشجرة الطبقات ومكتبة المكونات"
          >
            <Layers size={13} />
            <span>الصفحات والطبقات والمكونات</span>
            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 font-mono">
              {pages[activePageId]?.name || safeRoute}
            </Badge>
          </Button>

          <Button
            type="button"
            size="sm"
            variant={showRightPanel ? "default" : "outline"}
            className="h-7 gap-1 px-2 text-[11px] cursor-pointer"
            onClick={() => {
              const next = !showRightPanel;
              if (next) onOpenDrawer?.();
              setShowRightPanel(next);
            }}
            title="فتح أو إغلاق مفتش الخصائص والتنسيقات المتقدم"
          >
            <Settings2 size={13} />
            <span>مفتش الخصائص</span>
            {selected && (
              <Badge
                variant={showRightPanel ? "secondary" : "default"}
                className="text-[9px] px-1 py-0 h-4 font-mono"
              >
                &lt;{selected.tag}&gt;
              </Badge>
            )}
          </Button>
        </div>

        {/* Center: Draft/Published Source, Edit/Interactive Mode, Viewport Breakpoints & Zoom */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Draft vs Published Preview Toggle */}
          <div className="flex items-center rounded-lg border bg-muted/60 p-0.5 text-[10px]">
            <button
              type="button"
              onClick={() => setPreviewSource("draft")}
              className={
                "px-2 py-0.5 rounded-md font-bold transition cursor-pointer flex items-center gap-1 " +
                (previewSource === "draft"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground")
              }
              title="عرض المسودة الحية قيد التحرير"
            >
              <Sparkles size={11} />
              <span>المسودة</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewSource("published")}
              className={
                "px-2 py-0.5 rounded-md font-bold transition cursor-pointer flex items-center gap-1 " +
                (previewSource === "published"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "text-muted-foreground hover:text-foreground")
              }
              title="عرض النسخة المنشورة المعتمدة على الخادم حالياً"
            >
              <Check size={11} />
              <span>المنشور #{publishedRevision}</span>
            </button>
          </div>

          {/* Edit vs Interactive Mode */}
          <Button
            type="button"
            size="sm"
            variant={editMode && previewSource === "draft" ? "default" : "outline"}
            className="h-7 gap-1 px-2 text-[11px] cursor-pointer"
            onClick={() => setEditMode((v) => !v)}
            disabled={previewSource === "published"}
            title="التبديل بين وضع تحديد وتحرير العناصر ووضع التفاعل الحي مع التطبيق"
          >
            {editMode ? <EyeOff size={12} /> : <Eye size={12} />}
            <span>{editMode ? "وضع التحرير" : "تفاعل حي"}</span>
          </Button>

          {/* Viewport Breakpoints */}
          <div className="flex rounded-lg border bg-background p-0.5">
            <Button
              type="button"
              size="sm"
              variant={previewSize === "desktop" ? "default" : "ghost"}
              className="h-6 px-1.5 text-[10px] gap-1"
              onClick={() => {
                setPreviewSize("desktop");
                setResponsiveEditTarget("desktop");
                setCustomViewportWidth(1280);
              }}
              title="سطح المكتب (ملء المساحة)"
            >
              <Monitor size={12} />
            </Button>
            <Button
              type="button"
              size="sm"
              variant={previewSize === "tablet" ? "default" : "ghost"}
              className="h-6 px-1.5 text-[10px] gap-1"
              onClick={() => {
                setPreviewSize("tablet");
                setResponsiveEditTarget("tablet");
              }}
              title="جهاز لوحي (Tablet 820px)"
            >
              <Tablet size={12} />
            </Button>
            <Button
              type="button"
              size="sm"
              variant={previewSize === "mobile" ? "default" : "ghost"}
              className="h-6 px-1.5 text-[10px] gap-1"
              onClick={() => {
                setPreviewSize("mobile");
                setResponsiveEditTarget("mobile");
              }}
              title="هاتف (Mobile 390px)"
            >
              <Smartphone size={12} />
            </Button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-0.5 rounded-lg border bg-background px-1.5 py-0.5 text-[10px] font-mono">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(50, z - 10))}
              className="px-1 hover:text-primary font-bold cursor-pointer"
              title="تصغير المعاينة"
            >
              -
            </button>
            <button
              type="button"
              onClick={() => setZoom(100)}
              className="px-1 font-bold cursor-pointer"
              title="إعادة التكبير إلى 100%"
            >
              {zoom}%
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(150, z + 10))}
              className="px-1 hover:text-primary font-bold cursor-pointer"
              title="تكبير المعاينة"
            >
              +
            </button>
          </div>
        </div>

        {/* Left side: Grid, X-Ray, Refresh, External Tab, Fullscreen */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            size="sm"
            variant={showGrid ? "default" : "ghost"}
            className="h-7 w-7 p-0 text-xs cursor-pointer"
            onClick={() => setShowGrid((v) => !v)}
            title="شبكة المحاذاة الهندسية (Grid)"
          >
            <Grid size={13} />
          </Button>

          <Button
            type="button"
            size="sm"
            variant={xRayMode ? "default" : "ghost"}
            className="h-7 w-7 p-0 text-xs cursor-pointer"
            onClick={() => setXRayMode((v) => !v)}
            title="إظهار حدود الحاويات (X-Ray Mode)"
          >
            <ScanEye size={13} />
          </Button>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-xs cursor-pointer"
            onClick={() => setFrameKey((v) => v + 1)}
            title="تحديث إطار المعاينة"
          >
            <RefreshCw size={13} />
          </Button>

          <a
            href={safeRoute}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-xs hover:bg-accent"
            title="فتح الصفحة في تبويب مستقل"
          >
            <ExternalLink size={13} />
          </a>

          <Button
            type="button"
            size="sm"
            variant={isFullScreen ? "default" : "ghost"}
            className="h-7 w-7 p-0 text-xs cursor-pointer"
            onClick={() => setIsFullScreen((v) => !v)}
            title={isFullScreen ? "إنهاء ملء الشاشة" : "تكبير المعاينة لملء الشاشة بالكامل"}
          >
            {isFullScreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </Button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* FULL-BLEED PREVIEW WORKSPACE WITH OVERLAY DRAWERS         */}
      {/* ========================================================= */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* --------------------------------------------------------- */}
        {/* 1. LEFT OVERLAY DRAWER (RTL Right): Pages, Layers, Comps  */}
        {/*    Hidden by default; overlays without shrinking preview   */}
        {/* --------------------------------------------------------- */}
        {showLeftPanel && (
          <aside className="absolute top-0 right-0 bottom-0 flex w-[285px] flex-col border-l bg-card/98 backdrop-blur-md shadow-2xl overflow-hidden z-30">
            <div className="flex items-center justify-between border-b bg-muted/40 px-2.5 py-1.5 shrink-0">
              <span className="text-[11px] font-black text-foreground flex items-center gap-1.5">
                <Layers size={13} className="text-primary" />
                <span>الصفحات والطبقات والمكونات</span>
              </span>
              <button
                type="button"
                onClick={() => setShowLeftPanel(false)}
                className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                title="إخفاء اللوحة"
              >
                <X size={14} />
              </button>
            </div>
            {/* Sub-tabs: Pages | Layers | Components */}
            <div className="grid grid-cols-3 gap-1 border-b bg-muted/30 p-1 text-[11px] font-bold shrink-0">
              <button
                type="button"
                onClick={() => setLeftTab("pages")}
                className={
                  "py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1 " +
                  (leftTab === "pages"
                    ? "bg-card text-foreground shadow-2xs border"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                <FilePlus size={12} />
                <span>الصفحات</span>
              </button>
              <button
                type="button"
                onClick={() => setLeftTab("layers")}
                className={
                  "py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1 " +
                  (leftTab === "layers"
                    ? "bg-card text-foreground shadow-2xs border"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                <Layers size={12} />
                <span>الطبقات</span>
              </button>
              <button
                type="button"
                onClick={() => setLeftTab("components")}
                className={
                  "py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1 " +
                  (leftTab === "components"
                    ? "bg-card text-foreground shadow-2xs border"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                <Plus size={12} />
                <span>المكونات</span>
              </button>
            </div>

            {/* LEFT TAB 1: PAGES */}
            {leftTab === "pages" && (
              <div className="flex-1 overflow-y-auto p-2.5 space-y-3 text-xs">
                <StudioSectionSaveDiscardBar
                  hasChanges={showContextualSaveDiscard}
                  onSave={onSaveChanges}
                  onDiscard={onDiscardChanges}
                  isSaving={isSaving}
                  sectionLabel="قسم الصفحات"
                />
                <div className="flex items-center justify-between gap-1">
                  <span className="font-black text-foreground">صفحات الاستوديو والتطبيق</span>
                  {onAddPage && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setShowAddPageForm((v) => !v)}
                      className="h-6 px-2 text-[10px] font-bold gap-1"
                    >
                      <Plus size={11} /> صفحة جديدة
                    </Button>
                  )}
                </div>

                <div className="relative">
                  <Search
                    size={12}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    value={pageSearch}
                    onChange={(e) => setPageSearch(e.target.value)}
                    placeholder="ابحث في الصفحات والمسارات..."
                    className="h-7 pr-7 text-[11px]"
                  />
                </div>

                {showAddPageForm && onAddPage && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newPageName.trim() || !newPageRoute.trim()) return;
                      onAddPage(newPageName.trim(), newPageRoute.trim());
                      setNewPageName("");
                      setNewPageRoute("");
                      setShowAddPageForm(false);
                    }}
                    className="p-2.5 rounded-xl border bg-muted/40 space-y-2"
                  >
                    <Input
                      value={newPageName}
                      onChange={(e) => setNewPageName(e.target.value)}
                      placeholder="اسم الصفحة (مثال: العروض اليومية)"
                      className="h-7 text-xs"
                      required
                    />
                    <Input
                      value={newPageRoute}
                      onChange={(e) => setNewPageRoute(e.target.value)}
                      placeholder="/admin/promotions"
                      className="h-7 text-xs font-mono text-left"
                      required
                    />
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[10px]"
                        onClick={() => setShowAddPageForm(false)}
                      >
                        إلغاء
                      </Button>
                      <Button type="submit" size="sm" className="h-6 text-[10px] font-bold">
                        إنشاء الصفحة
                      </Button>
                    </div>
                  </form>
                )}

                {/* Managed Studio Pages */}
                <div className="space-y-1.5">
                  {filteredPagesList.map((p) => {
                    const isCurrent = p.id === activePageId || p.route === safeRoute;
                    return (
                      <div
                        key={p.id}
                        className={
                          "p-2 rounded-xl border transition space-y-1.5 " +
                          (isCurrent
                            ? "border-primary bg-primary/5"
                            : "border-border bg-background hover:bg-muted/40")
                        }
                      >
                        <div className="flex items-center justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              onSelectPage?.(p.id);
                              navigatePreview(p.route);
                            }}
                            className="min-w-0 flex-1 text-right cursor-pointer"
                          >
                            <div className="font-black text-foreground truncate">{p.name}</div>
                            <div className="text-[10px] font-mono text-muted-foreground truncate">
                              {p.route}
                            </div>
                          </button>
                          <div className="flex items-center gap-0.5 shrink-0">
                            {onDuplicatePage && (
                              <button
                                type="button"
                                onClick={() => onDuplicatePage(p.id)}
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                title="تكرار الصفحة"
                              >
                                <Copy size={11} />
                              </button>
                            )}
                            {onDeletePage && Object.keys(pages).length > 1 && (
                              <button
                                type="button"
                                onClick={() => onDeletePage(p.id)}
                                className="p-1 rounded hover:bg-rose-500/10 text-rose-500"
                                title="حذف الصفحة"
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        </div>

                        {isCurrent && onUpdatePageMeta && (
                          <div className="pt-1 border-t border-border/60 space-y-1">
                            <Input
                              value={p.name}
                              onChange={(e) => onUpdatePageMeta(p.id, { name: e.target.value })}
                              placeholder="عنوان الصفحة"
                              className="h-6 text-[10px]"
                            />
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground px-0.5">
                              <span>إظهار في القائمة</span>
                              <input
                                type="checkbox"
                                checked={p.visibleInNav !== false}
                                onChange={(e) =>
                                  onUpdatePageMeta(p.id, { visibleInNav: e.target.checked })
                                }
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Discovered Real App Routes */}
                <div className="pt-2 border-t space-y-1.5">
                  <h4 className="text-[11px] font-black text-muted-foreground">
                    مسارات التطبيق الفعلية المكتشفة ({pageLinks.length})
                  </h4>
                  <div className="space-y-1">
                    {(pageLinks.length
                      ? pageLinks
                      : [
                          { href: "/admin", label: "لوحة الإدارة الرئيسية" },
                          { href: "/pos", label: "نقطة البيع والكاشير" },
                          { href: "/admin/orders", label: "الطلبات" },
                          { href: "/admin/menu", label: "قائمة الطعام" },
                          { href: "/admin/inventory", label: "المخزون" },
                          { href: "/admin/reports", label: "التقارير" },
                          { href: "/admin/users", label: "المستخدمين والصلاحيات" },
                        ]
                    ).map((page) => (
                      <button
                        key={page.href}
                        type="button"
                        onClick={() => navigatePreview(page.href)}
                        className={
                          "flex min-h-7 w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-right text-[11px] cursor-pointer " +
                          (page.href === safeRoute
                            ? "bg-primary/10 font-black text-primary"
                            : "hover:bg-accent")
                        }
                      >
                        <span className="truncate">{page.label}</span>
                        <span className="font-mono text-[9px] text-muted-foreground truncate max-w-[90px]">
                          {page.href}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* LEFT TAB 2: LAYERS (DOM Tree + Studio Elements) */}
            {leftTab === "layers" && (
              <div className="flex flex-1 flex-col min-h-0 overflow-hidden p-2">
                <StudioSectionSaveDiscardBar
                  hasChanges={showContextualSaveDiscard}
                  onSave={onSaveChanges}
                  onDiscard={onDiscardChanges}
                  isSaving={isSaving}
                  sectionLabel="قسم الطبقات"
                />
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-black">شجرة الطبقات والعناصر الحية</span>
                  <Badge variant="secondary" className="text-[9px]">
                    {treeNodes.length} جذر
                  </Badge>
                </div>
                <div className="relative mb-2 shrink-0">
                  <Search
                    size={12}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    aria-label="بحث في شجرة الطبقات"
                    value={treeFilter}
                    onChange={(event) => setTreeFilter(event.target.value)}
                    placeholder="ابحث عن طبقة أو وسم..."
                    className="h-7 w-full rounded-lg border bg-background pr-7 pl-2 text-[11px] outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto space-y-0.5">
                  {visibleTreeNodes.length ? (
                    renderTreeNodes(visibleTreeNodes)
                  ) : (
                    <p className="p-3 text-[11px] text-muted-foreground text-center">
                      جاري قراءة شجرة عناصر الصفحة…
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* LEFT TAB 3: REUSABLE COMPONENTS & LIBRARY */}
            {leftTab === "components" && (
              <div className="flex-1 overflow-y-auto p-2.5 space-y-3 text-xs">
                <StudioSectionSaveDiscardBar
                  hasChanges={showContextualSaveDiscard}
                  onSave={onSaveChanges}
                  onDiscard={onDiscardChanges}
                  isSaving={isSaving}
                  sectionLabel="قسم المكونات"
                />
                {selected && onSaveReusableComponent && (
                  <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                    <div className="font-bold text-[11px] text-foreground flex items-center gap-1">
                      <BookmarkPlus size={13} className="text-primary" />
                      <span>حفظ العنصر المحدد كمكون قابل لإعادة الاستخدام</span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        onSaveReusableComponent({
                          name: layerLabel || `${selected.tag}: ${textValue.slice(0, 18) || "مكون مخصص"}`,
                          category: "custom",
                          description: `مكون مستخرج من ${selected.selector}`,
                          variant: "primary",
                          rootType: "card",
                          content: { title: textValue || "عنوان المكون", description: "" },
                          styles: {
                            backgroundColor,
                            textColor,
                            borderRadius,
                            fontSize: fontSize + "px",
                            fontWeight,
                          },
                        });
                      }}
                      className="w-full h-7 text-[11px] font-bold gap-1"
                    >
                      <BookmarkPlus size={12} />
                      <span>حفظ في مكتبة المكونات</span>
                    </Button>
                  </div>
                )}

                {reusableComponents.length > 0 && (
                  <div className="space-y-1.5">
                    <h4 className="text-[11px] font-black text-primary">
                      مكوناتك المحفوظة ({reusableComponents.length})
                    </h4>
                    {reusableComponents.map((comp) => (
                      <div
                        key={comp.id}
                        className="p-2 rounded-xl border bg-background hover:border-primary/40 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-bold truncate">{comp.name}</div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {comp.description}
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => {
                            if (selected) {
                              applyStyle(comp.styles as Record<string, string>);
                            } else {
                              onAddElement?.(comp.rootType);
                            }
                          }}
                        >
                          إدراج / تطبيق
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-1.5">
                  <h4 className="text-[11px] font-black text-muted-foreground">
                    مكتبة المكونات القياسية (اسحب أو انقر للإضافة)
                  </h4>
                  {BUILTIN_COMPONENT_LIBRARY.map((item) => (
                    <div
                      key={item.type + item.label}
                      draggable
                      onDragEnd={() => {
                        if (selected) {
                          applyStyle(item.defaultStyles);
                        } else {
                          onAddElement?.(item.type);
                        }
                      }}
                      onClick={() => {
                        if (selected) {
                          applyStyle(item.defaultStyles);
                          setStatus(`تم تطبيق تنسيق «${item.label}» على العنصر المحدد`);
                        } else {
                          onAddElement?.(item.type);
                        }
                      }}
                      className="p-2.5 rounded-xl border bg-background hover:bg-primary/5 hover:border-primary/40 transition cursor-pointer flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-foreground">{item.label}</div>
                        <div className="text-[10px] text-muted-foreground">{item.description}</div>
                      </div>
                      <Plus size={14} className="text-primary shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        )}

        {/* --------------------------------------------------------- */}
        {/* 2. CENTER: REAL APPLICATION PREVIEW CANVAS                */}
        {/* --------------------------------------------------------- */}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-100 dark:bg-slate-950">
          {/* Status Banner if Published Mode or Bridge Timeout */}
          {previewSource === "published" && (
            <div className="bg-emerald-600 text-white px-3 py-1 text-[11px] font-bold flex items-center justify-between shrink-0">
              <span>
                تعرض المعاينة الآن النسخة المنشورة المعتمدة على الخادم (الإصدار #{publishedRevision}).
              </span>
              <button
                type="button"
                onClick={() => setPreviewSource("draft")}
                className="underline font-black cursor-pointer"
              >
                العودة إلى تحرير المسودة
              </button>
            </div>
          )}

          {bridgeTimedOut && !ready && (
            <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-800 dark:text-amber-200 px-3 py-1.5 text-xs flex items-center justify-between shrink-0">
              <span>تأخر اتصال جسر المعاينة الحية. يمكنك إعادة تنشيط الجسر أو تحديث الإطار.</span>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px]"
                  onClick={installBridge}
                >
                  إعادة ربط الجسر
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-6 text-[10px]"
                  onClick={() => setFrameKey((v) => v + 1)}
                >
                  إعادة تحميل المعاينة
                </Button>
              </div>
            </div>
          )}

          {/* Iframe Container — Edge-to-Edge in Desktop 100%, Framed in Tablet/Mobile */}
          <div
            className={
              "relative flex min-h-0 flex-1 items-stretch justify-center overflow-auto " +
              (previewSize === "desktop" && customViewportWidth >= 1280 && zoom === 100
                ? "p-0"
                : "p-2 sm:p-3")
            }
            style={
              showGrid
                ? {
                    backgroundImage:
                      "linear-gradient(to right, rgba(99,102,241,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,0.12) 1px, transparent 1px)",
                    backgroundSize: "16px 16px",
                  }
                : undefined
            }
          >
            <div
              className={
                "relative h-full min-h-0 overflow-hidden bg-background transition-all duration-200 " +
                (previewSize === "desktop" && customViewportWidth >= 1280 && zoom === 100
                  ? "w-full border-0 rounded-none"
                  : "rounded-xl border shadow-xl")
              }
              style={{
                width: frameWidth,
                minWidth: previewSize === "desktop" && customViewportWidth >= 1280 ? 0 : frameWidth,
                flex:
                  previewSize === "desktop" && customViewportWidth >= 1280
                    ? "1 1 auto"
                    : "0 0 " + frameWidth,
                transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
                transformOrigin: "top center",
              }}
            >
              <iframe
                key={frameKey}
                ref={iframeRef}
                src={previewRoute}
                onLoad={installBridge}
                title="معاينة حية للتطبيق"
                className="h-full min-h-0 w-full border-0 bg-background"
              />
            </div>

            {/* Right-Click Context Menu */}
            {contextMenu && selected && (
              <div
                className="fixed z-50 w-56 rounded-xl border border-border bg-card p-1.5 shadow-2xl text-xs font-bold space-y-0.5"
                style={{
                  top: Math.min(window.innerHeight - 310, Math.max(60, contextMenu.y)),
                  left: Math.min(window.innerWidth - 235, Math.max(20, contextMenu.x)),
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-2 py-1 text-[10px] font-mono text-muted-foreground border-b mb-1 truncate">
                  &lt;{contextMenu.tag}&gt; {contextMenu.selector}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowRightPanel(true);
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-right cursor-pointer"
                >
                  <Settings2 size={13} /> فحص وتعديل الخصائص (المفتش)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleCopyElements();
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-accent text-right cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Copy size={13} /> نسخ العنصر (Copy)
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground">Ctrl+C</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleCutElements();
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-accent text-right cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Scissors size={13} /> قص العنصر (Cut)
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground">Ctrl+X</span>
                </button>
                {elementClipboard && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        handlePasteElements("after");
                        setContextMenu(null);
                      }}
                      className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 text-right cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <ClipboardPaste size={13} /> لصق بعد العنصر (Paste)
                      </span>
                      <span className="font-mono text-[9px]">Ctrl+V</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handlePasteElements("inside");
                        setContextMenu(null);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-accent text-right cursor-pointer"
                    >
                      <ClipboardPaste size={13} /> لصق داخل الحاوية (Paste Inside)
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    handleDuplicateElements();
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-accent text-right cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Copy size={13} /> تكرار فوري (Duplicate)
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground">Ctrl+D</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCopiedStyleClipboard({
                      color: textColor,
                      backgroundColor,
                      fontSize: fontSize + "px",
                      fontWeight,
                      borderRadius,
                    });
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-accent text-right cursor-pointer"
                >
                  <Clipboard size={13} /> نسخ التنسيقات (Copy Styles)
                </button>
                {copiedStyleClipboard && (
                  <button
                    type="button"
                    onClick={() => {
                      applyStyle(copiedStyleClipboard);
                      setContextMenu(null);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-accent text-right text-primary cursor-pointer"
                  >
                    <Wand2 size={13} /> لصق التنسيقات (Paste Styles)
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    action("moveUp");
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-accent text-right cursor-pointer"
                >
                  <ArrowUp size={13} /> تقديم لأعلى
                </button>
                <button
                  type="button"
                  onClick={() => {
                    action("moveDown");
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-accent text-right cursor-pointer"
                >
                  <ArrowDown size={13} /> إرسال لأسفل
                </button>
                <button
                  type="button"
                  onClick={() => {
                    commitEdits(selected.selector, { locked: !isSelectedLocked });
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-accent text-right cursor-pointer"
                >
                  {isSelectedLocked ? <Unlock size={13} /> : <Lock size={13} />}
                  <span>{isSelectedLocked ? "فك قفل العنصر" : "قفل العنصر"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    action("delete", { deleted: true });
                    setContextMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-destructive/10 text-destructive text-right cursor-pointer"
                >
                  <Trash2 size={13} /> إخفاء / حذف العنصر
                </button>
              </div>
            )}
          </div>

          {/* Contextual Selection Breadcrumb Bar (Hidden when no element is selected to maximize preview) */}
          {selected && (
            <div className="flex shrink-0 items-center justify-between gap-2 border-t bg-card px-2.5 py-1 text-[10px]">
              <div className="flex items-center gap-1 overflow-x-auto min-w-0">
                <span className="text-muted-foreground font-bold shrink-0">المسار:</span>
                {selected.ancestors?.map((anc, i) => (
                  <React.Fragment key={anc.selector + i}>
                    {i > 0 && <ChevronLeft size={10} className="text-muted-foreground shrink-0" />}
                    <button
                      type="button"
                      onClick={() => send({ action: "select", selector: anc.selector })}
                      className={
                        "px-1.5 py-0.5 rounded font-mono text-[10px] cursor-pointer " +
                        (anc.selector === selected.selector
                          ? "bg-primary text-primary-foreground font-bold"
                          : "hover:bg-muted text-muted-foreground")
                      }
                    >
                      {anc.label}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {multiSelectedSelectors.length > 1 && (
                  <Badge variant="secondary" className="text-[9px] h-4 px-1">
                    {multiSelectedSelectors.length} عناصر
                  </Badge>
                )}
                {!showRightPanel && (
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    onClick={() => {
                      onOpenDrawer?.();
                      setShowRightPanel(true);
                    }}
                    className="h-5 px-2 text-[10px] gap-1 cursor-pointer"
                  >
                    <Settings2 size={11} />
                    <span>تعديل الخصائص</span>
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={deleteOrRestoreSelectedElement}
                  disabled={isSelectedLocked || previewSource === "published"}
                  className={
                    "h-5 px-2 text-[10px] gap-1 cursor-pointer " +
                    (isSelectedHidden
                      ? "border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
                      : "border-destructive/40 text-destructive hover:bg-destructive/10")
                  }
                  title={isSelectedHidden ? "استعادة العنصر المحذوف" : "حذف هذا العنصر من الصفحة"}
                >
                  <Trash2 size={10} />
                  <span>{isSelectedHidden ? "استعادة العنصر" : "حذف العنصر"}</span>
                </Button>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                  title="إلغاء التحديد"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* --------------------------------------------------------- */}
        {/* 3. RIGHT OVERLAY DRAWER (RTL Left): 5-Tab Inspector       */}
        {/*    Hidden by default; overlays without shrinking preview   */}
        {/* --------------------------------------------------------- */}
        {showRightPanel && (
          <aside className="absolute top-0 left-0 bottom-0 flex w-[320px] 2xl:w-[355px] flex-col border-r bg-card/98 backdrop-blur-md shadow-2xl overflow-hidden z-30">
            {/* Inspector Header */}
            <div className="shrink-0 border-b px-2.5 py-2 bg-muted/30 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-xs font-black text-foreground flex items-center gap-1.5">
                  <Sliders size={13} className="text-primary" />
                  <span>مفتش الخصائص الاحترافي</span>
                </h3>
                <p className="truncate text-[10px] font-mono text-muted-foreground mt-0.5">
                  {selected
                    ? `<${selected.tag}> · ${selected.rectWidth}×${selected.rectHeight}px`
                    : "لم يتم تحديد عنصر بعد"}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {selected && (
                  <>
                    <button
                      type="button"
                      onClick={() => commitEdits(selected.selector, { locked: !isSelectedLocked })}
                      className={
                        "p-1 rounded border cursor-pointer " +
                        (isSelectedLocked
                          ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
                          : "text-muted-foreground")
                      }
                      title={isSelectedLocked ? "فك القفل" : "قفل العنصر"}
                    >
                      {isSelectedLocked ? <Lock size={12} /> : <Unlock size={12} />}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        action("duplicate", {
                          duplicateCount: Math.min(
                            5,
                            Number(edits[selected.selector]?.duplicateCount || 0) + 1,
                          ),
                        })
                      }
                      className="p-1 rounded border text-muted-foreground hover:text-foreground cursor-pointer"
                      title="تكرار العنصر"
                    >
                      <Copy size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={deleteOrRestoreSelectedElement}
                      disabled={isSelectedLocked}
                      className={
                        "p-1 rounded border cursor-pointer transition " +
                        (isSelectedHidden
                          ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/25"
                          : "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20")
                      }
                      title={isSelectedHidden ? "استعادة العنصر المحذوف" : "حذف العنصر المحدد"}
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setShowRightPanel(false)}
                  className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                  title="إخفاء مفتش الخصائص"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* 6 Inspector Tabs: Content | Action | Style | Layout | Responsive | Advanced */}
            <div className="grid grid-cols-6 gap-0.5 border-b bg-muted/50 p-1 text-[10px] font-bold shrink-0">
              {(
                [
                  ["content", "المحتوى"],
                  ["action", "الوظيفة"],
                  ["style", "التنسيق"],
                  ["layout", "التخطيط"],
                  ["responsive", "التجاوب"],
                  ["advanced", "متقدم"],
                ] as const
              ).map(([tabKey, label]) => (
                <button
                  key={tabKey}
                  type="button"
                  onClick={() => setRightTab(tabKey)}
                  className={
                    "py-1.5 rounded-md transition cursor-pointer text-center " +
                    (rightTab === tabKey
                      ? "bg-card text-primary shadow-2xs border font-black"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            {!selected ? (
              <div className="flex-1 p-5 flex flex-col items-center justify-center text-center text-xs text-muted-foreground gap-3">
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                  <Settings2 className="w-6 h-6 text-muted-foreground/60" />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-foreground">انقر على أي عنصر داخل معاينة التطبيق</p>
                  <p className="text-[11px] leading-relaxed">
                    يمكنك تحديد أي زر، بطاقة، عنوان، جدول، أو أيقونة SVG في التطبيق الحقيقي لتعديل محتواها، وظيفتها، إحداثياتها الحرة، وألوانها وتجاوبها.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-3 space-y-3.5 text-xs">
                {/* Multi-Selection Active Banner */}
                {multiSelectedSelectors.length > 1 && (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1.5 text-[11px]">
                    <div className="flex items-center gap-1.5 font-black text-indigo-700 dark:text-indigo-300">
                      <CheckSquare size={13} />
                      <span>تحديد متعدد نشط ({multiSelectedSelectors.length} عناصر)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMultiSelectedSelectors(selected ? [selected.selector] : [])}
                      className="text-[10px] underline font-bold text-indigo-700 dark:text-indigo-300 cursor-pointer"
                    >
                      إبقاء الرئيسي فقط
                    </button>
                  </div>
                )}

                {/* Quick Element Actions & Clipboard Bar (Copy / Cut / Paste / Duplicate / Delete / Reset) */}
                <div className="space-y-1.5 rounded-xl border bg-muted/30 p-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isSelectedLocked || previewSource === "published"}
                      onClick={handleCopyElements}
                      className="h-6 flex-1 px-1.5 gap-1 text-[10px] cursor-pointer"
                      title="نسخ العنصر (Ctrl+C)"
                    >
                      <Copy size={10} />
                      <span>نسخ</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isSelectedLocked || previewSource === "published"}
                      onClick={handleCutElements}
                      className="h-6 flex-1 px-1.5 gap-1 text-[10px] cursor-pointer"
                      title="قص العنصر بأمان (Ctrl+X)"
                    >
                      <Scissors size={10} />
                      <span>قص</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={elementClipboard ? "default" : "outline"}
                      disabled={!elementClipboard || isSelectedLocked || previewSource === "published"}
                      onClick={() => handlePasteElements("after")}
                      className="h-6 flex-1 px-1.5 gap-1 text-[10px] cursor-pointer"
                      title="لصق بعد العنصر (Ctrl+V)"
                    >
                      <ClipboardPaste size={10} />
                      <span>لصق</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isSelectedLocked || previewSource === "published"}
                      onClick={handleDuplicateElements}
                      className="h-6 flex-1 px-1.5 gap-1 text-[10px] cursor-pointer"
                      title="تكرار العنصر (Ctrl+D)"
                    >
                      <Copy size={10} />
                      <span>تكرار</span>
                    </Button>
                  </div>

                  <div className="flex items-center justify-between gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant={isSelectedHidden ? "outline" : "destructive"}
                      disabled={isSelectedLocked || previewSource === "published"}
                      onClick={deleteOrRestoreSelectedElement}
                      className="h-7 flex-1 gap-1 text-[11px] font-bold cursor-pointer"
                    >
                      <Trash2 size={12} />
                      <span>{isSelectedHidden ? "استعادة العنصر المحذوف" : "حذف العنصر"}</span>
                    </Button>
                    {elementClipboard && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isSelectedLocked || previewSource === "published"}
                        onClick={() => handlePasteElements("inside")}
                        className="h-7 px-2 gap-1 text-[10px] cursor-pointer"
                        title="لصق داخل الحاوية المحددة"
                      >
                        <ClipboardPaste size={11} />
                        <span>لصق بالداخل</span>
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={isSelectedLocked || previewSource === "published"}
                      onClick={() => {
                        const next = { ...editsRef.current };
                        delete next[selected.selector];
                        editsRef.current = next;
                        lastCommittedEditsRef.current = next;
                        setEdits(next);
                        changeCallbackRef.current(next);
                        send({ action: "restore", edits: next, designSystem });
                      }}
                      className="h-7 px-2 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                      title="إعادة ضبط تعديلات هذا العنصر"
                    >
                      <RotateCcw size={11} />
                    </Button>
                  </div>
                </div>

                {isSelectedLocked && (
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 text-[11px] flex items-center justify-between">
                    <span>هذه الطبقة مقفلة ضد التعديل</span>
                    <button
                      type="button"
                      onClick={() => commitEdits(selected.selector, { locked: false })}
                      className="underline font-bold cursor-pointer"
                    >
                      فك القفل
                    </button>
                  </div>
                )}

                {/* TAB 1: CONTENT */}
                {rightTab === "content" && (
                  <div className="space-y-3">
                    <StudioSectionSaveDiscardBar
                      hasChanges={showContextualSaveDiscard}
                      onSave={onSaveChanges}
                      onDiscard={onDiscardChanges}
                      onResetElement={edits[selected.selector] ? resetSelectedElementEdits : undefined}
                      isSaving={isSaving}
                      sectionLabel="المحتوى"
                    />
                    <div>
                      <label className="block font-bold mb-1">اسم الطبقة المخصص (Layer Name)</label>
                      <Input
                        value={layerLabel}
                        onChange={(e) => {
                          setLayerLabel(e.target.value);
                          commitEdits(selected.selector, { label: e.target.value });
                        }}
                        placeholder="تسمية توضيحية في شجرة الطبقات..."
                        className="h-8 text-xs"
                      />
                    </div>

                    {!selectedIsVector && (
                      <div>
                        <label className="block font-bold mb-1">المحتوى النصي / التسمية</label>
                        <textarea
                          disabled={isSelectedLocked}
                          value={textValue}
                          onChange={(e) => editText(e.target.value)}
                          className="min-h-20 w-full rounded-lg border bg-background p-2 text-xs outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    )}

                    {(selected.tag === "img" || srcVal) && (
                      <div className="space-y-2 p-2.5 rounded-xl border bg-muted/20">
                        <div className="flex items-center justify-between">
                          <label className="font-bold">مصدر الصورة (Image URL)</label>
                          {onOpenAssetPicker && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-6 text-[10px] gap-1"
                              onClick={() =>
                                onOpenAssetPicker((url) => {
                                  setSrcVal(url);
                                  commitEdits(selected.selector, { attributes: { src: url } });
                                  send({
                                    action: "attributes",
                                    selector: selected.selector,
                                    attributes: { src: url },
                                    silent: true,
                                  });
                                })
                              }
                            >
                              <ImageIcon size={11} /> اختر من الأصول
                            </Button>
                          )}
                        </div>
                        <Input
                          value={srcVal}
                          onChange={(e) => {
                            setSrcVal(e.target.value);
                            commitEdits(selected.selector, { attributes: { src: e.target.value } });
                            send({
                              action: "attributes",
                              selector: selected.selector,
                              attributes: { src: e.target.value },
                              silent: true,
                            });
                          }}
                          placeholder="https://..."
                          className="h-8 text-xs font-mono text-left"
                        />
                        <Input
                          value={altVal}
                          onChange={(e) => {
                            setAltVal(e.target.value);
                            commitEdits(selected.selector, { attributes: { alt: e.target.value } });
                            send({
                              action: "attributes",
                              selector: selected.selector,
                              attributes: { alt: e.target.value },
                              silent: true,
                            });
                          }}
                          placeholder="النص البديل للصورة (alt)..."
                          className="h-8 text-xs"
                        />
                      </div>
                    )}

                    {(selected.tag === "a" || selected.tag === "button" || hrefVal) && (
                      <div>
                        <label className="block font-bold mb-1">الرابط / الوجهة (Link URL)</label>
                        <Input
                          value={hrefVal}
                          onChange={(e) => {
                            setHrefVal(e.target.value);
                            commitEdits(selected.selector, { attributes: { href: e.target.value } });
                            send({
                              action: "attributes",
                              selector: selected.selector,
                              attributes: { href: e.target.value },
                              silent: true,
                            });
                          }}
                          placeholder="/admin/reports أو https://..."
                          className="h-8 text-xs font-mono text-left"
                        />
                      </div>
                    )}

                    {/* Quick Shortcut to Dedicated Element Function Inspector */}
                    {resolvedElementAction && (
                      <div className="rounded-xl border border-primary/25 bg-primary/5 p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black text-[11px] text-foreground flex items-center gap-1.5">
                            <Zap size={12} className="text-primary" />
                            <span>الوظيفة والإجراء (Element Function)</span>
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setRightTab("action")}
                            className="h-6 px-2 text-[10px] font-bold cursor-pointer"
                          >
                            تحرير الوظيفة
                          </Button>
                        </div>
                        <div className="text-[11px] text-muted-foreground space-y-0.5">
                          <div>
                            <span className="font-bold text-foreground">الوظيفة المسندة: </span>
                            <span>{resolvedElementAction.detectedAction.titleAr}</span>
                          </div>
                          <div>
                            <span className="font-bold text-foreground">الوجهة / المسار: </span>
                            <span className="font-mono text-[10px]">
                              {resolvedElementAction.binding.targetRoute ||
                                resolvedElementAction.binding.targetModal ||
                                resolvedElementAction.binding.targetWorkflow ||
                                "/admin"}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 1.5: DEDICATED ELEMENT FUNCTION / ACTION INSPECTOR (الوظيفة والإجراء) */}
                {rightTab === "action" && resolvedElementAction && (
                  <div className="space-y-3">
                    <StudioSectionSaveDiscardBar
                      hasChanges={showContextualSaveDiscard}
                      onSave={onSaveChanges}
                      onDiscard={onDiscardChanges}
                      onResetElement={edits[selected.selector] ? resetSelectedElementEdits : undefined}
                      isSaving={isSaving}
                      sectionLabel="الوظيفة والإجراء"
                    />

                    {/* Current Assigned Function Summary Card */}
                    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2 border-b border-primary/15 pb-2">
                        <div className="flex items-center gap-1.5 font-black text-xs text-primary">
                          <Zap size={14} />
                          <span>الوظيفة والإجراء (Element Function)</span>
                        </div>
                        <Badge variant="outline" className="text-[9px] font-mono">
                          {resolvedElementAction.elementTypeLabel}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 gap-1.5 text-[11px]">
                        <div className="flex items-center justify-between gap-2 bg-background/80 rounded-lg px-2 py-1 border">
                          <span className="text-muted-foreground font-bold">التسمية الظاهرة:</span>
                          <span className="font-black text-foreground truncate max-w-[175px]">
                            {resolvedElementAction.displayLabel}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 bg-background/80 rounded-lg px-2 py-1 border">
                          <span className="text-muted-foreground font-bold">الوظيفة المسندة فعليًا:</span>
                          <span className="font-black text-primary truncate max-w-[175px]">
                            {resolvedElementAction.detectedAction.titleAr}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 bg-background/80 rounded-lg px-2 py-1 border">
                          <span className="text-muted-foreground font-bold">المشغّل (Trigger):</span>
                          <span className="font-mono text-[10px] font-bold">
                            عند النقر (On Click)
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 bg-background/80 rounded-lg px-2 py-1 border">
                          <span className="text-muted-foreground font-bold">نوع الإجراء:</span>
                          <span className="font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                            {resolvedElementAction.binding.actionType}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 bg-background/80 rounded-lg px-2 py-1 border">
                          <span className="text-muted-foreground font-bold">المسار / النافذة الهدف:</span>
                          <span className="font-mono text-[10px] truncate max-w-[175px]">
                            {resolvedElementAction.binding.targetRoute ||
                              resolvedElementAction.binding.targetModal ||
                              resolvedElementAction.binding.targetWorkflow ||
                              "—"}
                          </span>
                        </div>
                      </div>

                      {/* Required Permissions & Roles */}
                      <div className="pt-1 space-y-1">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                          <ShieldCheck size={11} className="text-emerald-600" />
                          <span>الصلاحيات والأدوار المطلوبة للتنفيذ:</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {resolvedElementAction.binding.requiredPermissions.length > 0 ? (
                            resolvedElementAction.binding.requiredPermissions.map((perm) => (
                              <Badge key={perm} variant="secondary" className="text-[9px] font-mono">
                                {perm}
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="outline" className="text-[9px]">
                              متاح حسب صلاحية الصفحة
                            </Badge>
                          )}
                          {resolvedElementAction.binding.allowedRoles.map((role) => (
                            <Badge
                              key={role}
                              className="text-[9px] font-mono bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                            >
                              دور: {role}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Editable Action Assignment (Registered Application Actions) */}
                    <div className="rounded-xl border p-2.5 space-y-2.5 bg-background">
                      <span className="font-black text-[11px] block">
                        تعديل الوظيفة أو ربط إجراء مسجّل في النظام
                      </span>

                      <div>
                        <label className="block text-[10px] font-bold text-muted-foreground mb-1">
                          بحث في سجل إجراءات النظام المعتمدة ({STUDIO_ACTION_REGISTRY.length} إجراء)
                        </label>
                        <Input
                          value={actionSearchQuery}
                          onChange={(e) => setActionSearchQuery(e.target.value)}
                          placeholder="ابحث (مثال: فتح وردية، سند، مخزون، كاشير)..."
                          className="h-7 text-xs mb-1.5"
                        />
                        <select
                          aria-label="إسناد إجراء مسجل"
                          value={resolvedElementAction.binding.actionId}
                          onChange={(e) => {
                            const chosen = STUDIO_ACTION_REGISTRY.find((a) => a.id === e.target.value);
                            if (!chosen) return;
                            const nextBinding = {
                              actionId: chosen.id,
                              actionType: chosen.actionType,
                              trigger: "onClick" as const,
                              label: chosen.titleAr,
                              targetRoute: chosen.defaultRoute,
                              targetModal: chosen.defaultModal,
                              targetWorkflow: chosen.defaultWorkflow,
                              params: chosen.defaultParams,
                              requiredPermissions: chosen.requiredPermissions,
                              allowedRoles: chosen.allowedRoles,
                              isMutationSafeSimulated: chosen.mutatesOperationalData,
                            };
                            const validation = validateActionBindingSecurity(nextBinding);
                            if (!validation.valid) {
                              setStatus(validation.reason || "إجراء غير صالح");
                              return;
                            }
                            commitEdits(selected.selector, { actionBinding: nextBinding });
                            send({
                              action: "restore",
                              edits: editsRef.current,
                              designSystem,
                            });
                            setStatus(`تم ربط العنصر بالوظيفة «${chosen.titleAr}»`);
                          }}
                          className="h-8 w-full rounded-lg border bg-background px-2 text-xs font-bold"
                        >
                          <option value={resolvedElementAction.binding.actionId}>
                            -- {resolvedElementAction.detectedAction.titleAr} --
                          </option>
                          {STUDIO_ACTION_REGISTRY.filter((item) => {
                            const q = actionSearchQuery.trim().toLowerCase();
                            if (!q) return true;
                            return (
                              item.titleAr.toLowerCase().includes(q) ||
                              item.descriptionAr.toLowerCase().includes(q) ||
                              item.id.toLowerCase().includes(q) ||
                              (item.defaultRoute || "").toLowerCase().includes(q)
                            );
                          }).map((item) => (
                            <option key={item.id} value={item.id}>
                              [{item.categoryLabelAr}] {item.titleAr} ({item.defaultRoute || item.defaultWorkflow || item.id})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Action Type Selector */}
                      <div>
                        <label className="text-[10px] font-bold block">
                          نوع الإجراء
                          <select
                            value={
                              selectedEdit.actionBinding?.actionType ||
                              resolvedElementAction.binding.actionType
                            }
                            onChange={(e) => {
                              const nextType = e.target.value as StudioActionType;
                              const nextBinding = {
                                ...resolvedElementAction.binding,
                                ...(selectedEdit.actionBinding || {}),
                                actionType: nextType,
                                trigger: "onClick" as const,
                              };
                              commitEdits(selected.selector, { actionBinding: nextBinding });
                              send({ action: "restore", edits: editsRef.current, designSystem });
                            }}
                            className="mt-1 h-7 w-full rounded border bg-background px-1.5 text-[11px]"
                          >
                            <option value="navigate">انتقال لصفحة (Navigate)</option>
                            <option value="open_modal">فتح نافذة منبثقة (Modal)</option>
                            <option value="open_drawer">فتح درج جانبي (Drawer)</option>
                            <option value="workflow">تشغيل سير عمل مسجّل (Workflow)</option>
                            <option value="external_url">رابط خارجي (External URL)</option>
                            <option value="submit">إرسال نموذج (Submit)</option>
                            <option value="toggle_ui">تبديل حالة واجهة (Toggle UI)</option>
                          </select>
                        </label>
                      </div>

                      {/* Searchable Destination Page Selector */}
                      <div>
                        <label className="block text-[10px] font-bold text-muted-foreground mb-1">
                          اختيار صفحة مسجّلة في التطبيق أو مسار مخصص
                        </label>
                        <select
                          aria-label="صفحة الهدف المسجلة"
                          value={
                            selectedEdit.actionBinding?.targetRoute ||
                            resolvedElementAction.binding.targetRoute ||
                            "/admin"
                          }
                          onChange={(e) => {
                            const dest = e.target.value;
                            const nextBinding = {
                              ...resolvedElementAction.binding,
                              ...(selectedEdit.actionBinding || {}),
                              targetRoute: dest,
                              trigger: "onClick" as const,
                            };
                            const validation = validateActionBindingSecurity(nextBinding);
                            if (!validation.valid) {
                              setStatus(validation.reason || "وجهة غير صالحة");
                              return;
                            }
                            commitEdits(selected.selector, { actionBinding: nextBinding });
                            send({ action: "restore", edits: editsRef.current, designSystem });
                          }}
                          className="h-7 w-full rounded border bg-background px-2 text-[11px] mb-1.5"
                        >
                          <option
                            value={
                              resolvedElementAction.binding.targetRoute || "/admin"
                            }
                          >
                            المسار الحالي: {resolvedElementAction.binding.targetRoute || "/admin"}
                          </option>
                          {STUDIO_REGISTERED_PAGES.map((pg) => (
                            <option key={pg.route} value={pg.route}>
                              {pg.titleAr} — {pg.route}
                            </option>
                          ))}
                        </select>

                        <Input
                          value={
                            selectedEdit.actionBinding?.targetRoute ??
                            resolvedElementAction.binding.targetRoute ??
                            ""
                          }
                          onChange={(e) => {
                            const dest = e.target.value;
                            const nextBinding = {
                              ...resolvedElementAction.binding,
                              ...(selectedEdit.actionBinding || {}),
                              targetRoute: dest,
                              trigger: "onClick" as const,
                            };
                            const validation = validateActionBindingSecurity(nextBinding);
                            if (!validation.valid) {
                              setStatus(validation.reason || "وجهة غير صالحة");
                              return;
                            }
                            commitEdits(selected.selector, { actionBinding: nextBinding });
                          }}
                          placeholder="/admin/ledger?tab=vouchers أو /pos"
                          className="h-7 text-xs font-mono text-left"
                        />
                      </div>

                      {/* Safe Preview Action Test Button */}
                      <div className="pt-1 flex items-center justify-between gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const binding =
                              selectedEdit.actionBinding || resolvedElementAction.binding;
                            const check = validateActionBindingSecurity(binding);
                            if (!check.valid) {
                              setStatus(check.reason || "إجراء غير مسموح");
                              return;
                            }
                            if (check.simulateOnlyInPreview) {
                              setStatus(
                                `معاينة آمنة: الإجراء «${resolvedElementAction.detectedAction.titleAr}» مرتبط بعملية تشغيلية/مالية؛ يتم محاكاته بأمان دون تنفيذ قيود فعلية أثناء وضع التحرير.`,
                              );
                              return;
                            }
                            if (binding.targetRoute && binding.targetRoute.startsWith("/")) {
                              navigatePreview(binding.targetRoute);
                              setStatus(`تم اختبار الانتقال إلى ${binding.targetRoute}`);
                            } else {
                              setStatus(
                                `معاينة الإجراء: ${resolvedElementAction.detectedAction.titleAr} → ${binding.targetRoute || binding.targetModal || binding.targetWorkflow || ""}`,
                              );
                            }
                          }}
                          className="h-7 flex-1 text-[10px] font-bold gap-1 cursor-pointer"
                        >
                          <ExternalLink size={11} />
                          <span>اختبار الإجراء بأمان في المعاينة</span>
                        </Button>
                        {selectedEdit.actionBinding && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              commitEdits(selected.selector, { actionBinding: undefined });
                              send({ action: "restore", edits: editsRef.current, designSystem });
                              setStatus("تم استعادة الوظيفة الأصلية للعنصر");
                            }}
                            className="h-7 px-2 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            استعادة الأصلي
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: STYLE (Colors, Gradients, Typography, Borders, SVG, Hover, Animations) */}
                {rightTab === "style" && (
                  <div className="space-y-3.5">
                    <StudioSectionSaveDiscardBar
                      hasChanges={showContextualSaveDiscard}
                      onSave={onSaveChanges}
                      onDiscard={onDiscardChanges}
                      onResetElement={edits[selected.selector] ? resetSelectedElementEdits : undefined}
                      isSaving={isSaving}
                      sectionLabel="التنسيق"
                    />
                    {/* Quick Content Display Mode Switcher (Grid / List / Row / Block) */}
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-2.5 space-y-2">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-black text-[11px] text-foreground flex items-center gap-1">
                          <Layout size={12} className="text-primary" />
                          <span>أسلوب عرض المحتوى (Grid / List)</span>
                        </span>
                        {parentAncestor && (
                          <div className="flex rounded-md border bg-background p-0.5 text-[9px] font-bold">
                            <button
                              type="button"
                              onClick={() => setLayoutTargetMode("self")}
                              className={
                                "px-1.5 py-0.5 rounded cursor-pointer " +
                                (layoutTargetMode === "self"
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground")
                              }
                              title={`تطبيق على العنصر المحدد <${selected.tag}>`}
                            >
                              العنصر
                            </button>
                            <button
                              type="button"
                              onClick={() => setLayoutTargetMode("parent")}
                              className={
                                "px-1.5 py-0.5 rounded cursor-pointer " +
                                (layoutTargetMode === "parent"
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground")
                              }
                              title={`تطبيق على الحاوية الأب <${parentAncestor.tag}>`}
                            >
                              الحاوية الأب
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-4 gap-1">
                        {(
                          [
                            ["grid", "شبكة Grid"],
                            ["list", "قائمة List"],
                            ["row", "صف أفقي"],
                            ["block", "كتلة Block"],
                          ] as const
                        ).map(([modeKey, modeLabel]) => {
                          const isActive =
                            (modeKey === "grid" && displayMode === "grid") ||
                            (modeKey === "list" &&
                              displayMode === "flex" &&
                              flexDirection === "column") ||
                            (modeKey === "row" &&
                              displayMode === "flex" &&
                              flexDirection !== "column") ||
                            (modeKey === "block" && displayMode === "block");
                          return (
                            <button
                              key={modeKey}
                              type="button"
                              onClick={() => applyContentLayoutPreset(modeKey)}
                              className={
                                "py-1.5 px-1 rounded-lg border text-[10px] font-bold transition cursor-pointer text-center " +
                                (isActive
                                  ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                                  : "bg-background text-foreground hover:bg-accent")
                              }
                            >
                              {modeLabel}
                            </button>
                          );
                        })}
                      </div>

                      {displayMode === "grid" && (
                        <div className="grid grid-cols-4 gap-1 pt-0.5">
                          {(
                            [
                              ["2", "عمودان (2)"],
                              ["3", "3 أعمدة"],
                              ["4", "4 أعمدة"],
                              ["auto", "تلقائي"],
                            ] as const
                          ).map(([colVal, colLbl]) => (
                            <button
                              key={colVal}
                              type="button"
                              onClick={() => applyContentLayoutPreset("grid", colVal)}
                              className={
                                "py-1 rounded border text-[9px] font-bold cursor-pointer " +
                                (gridColumnsCount === colVal
                                  ? "bg-primary/15 text-primary border-primary/40"
                                  : "bg-background text-muted-foreground hover:text-foreground")
                              }
                            >
                              {colLbl}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Colors */}
                    <div className="grid grid-cols-2 gap-2">
                      {!selectedIsVector && (
                        <label className="text-[11px] font-bold">
                          لون النص
                          <input
                            aria-label="لون النص"
                            type="color"
                            value={/^#[0-9a-f]{6}$/i.test(textColor) ? textColor : "#111827"}
                            onChange={(e) => {
                              setTextColor(e.target.value);
                              applyStyle({ color: e.target.value });
                            }}
                            className="mt-1 h-8 w-full rounded border bg-background p-0.5 cursor-pointer"
                          />
                        </label>
                      )}
                      <label className="text-[11px] font-bold">
                        {selectedIsVector ? "خلفية الأيقونة" : "لون الخلفية"}
                        <input
                          aria-label="لون الخلفية"
                          type="color"
                          value={
                            /^#[0-9a-f]{6}$/i.test(backgroundColor) ? backgroundColor : "#ffffff"
                          }
                          onChange={(e) => {
                            setBackgroundColor(e.target.value);
                            applyStyle({ backgroundColor: e.target.value });
                          }}
                          className="mt-1 h-8 w-full rounded border bg-background p-0.5 cursor-pointer"
                        />
                      </label>
                    </div>

                    {/* Gradients */}
                    <div>
                      <label className="block text-[11px] font-bold mb-1">
                        تدرج لوني للخلفية (Gradient)
                      </label>
                      <select
                        value={backgroundGradient}
                        onChange={(e) => {
                          setBackgroundGradient(e.target.value);
                          applyStyle({ backgroundImage: e.target.value || "none" });
                        }}
                        className="w-full h-8 rounded-lg border bg-background px-2 text-xs"
                      >
                        <option value="">بدون تدرج</option>
                        <option value="linear-gradient(135deg, #4f46e5 0%, #0ea5e9 100%)">
                          نيلي إلى سماوي احترافي
                        </option>
                        <option value="linear-gradient(135deg, #059669 0%, #10b981 100%)">
                          زمردي متدرج
                        </option>
                        <option value="linear-gradient(135deg, #d97706 0%, #fbbf24 100%)">
                          ذهبي دافئ
                        </option>
                        <option value="linear-gradient(135deg, #0f172a 0%, #1e293b 100%)">
                          داكن فاخر
                        </option>
                      </select>
                    </div>

                    {/* SVG & Icon Editor */}
                    {selectedIsVector && (
                      <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 space-y-2.5">
                        <h4 className="text-xs font-black text-primary">محرر الأيقونات و SVG المتقدم</h4>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-[11px] font-bold">
                            لون التعبئة (Fill)
                            <input
                              aria-label="لون تعبئة الأيقونة"
                              type="color"
                              value={fillColor}
                              onChange={(e) => {
                                setFillColor(e.target.value);
                                applyStyle({ fill: e.target.value });
                              }}
                              className="mt-1 h-8 w-full rounded border bg-background p-0.5"
                            />
                          </label>
                          <label className="text-[11px] font-bold">
                            لون الحد (Stroke)
                            <input
                              aria-label="لون حد الأيقونة"
                              type="color"
                              value={strokeColor}
                              onChange={(e) => {
                                setStrokeColor(e.target.value);
                                applyStyle({ stroke: e.target.value });
                              }}
                              className="mt-1 h-8 w-full rounded border bg-background p-0.5"
                            />
                          </label>
                        </div>
                        <label className="block text-[11px] font-bold">
                          سُمك رسم الخط ({strokeWidth}px)
                          <input
                            type="range"
                            min="0.5"
                            max="5"
                            step="0.5"
                            value={strokeWidth}
                            onChange={(e) => {
                              setStrokeWidth(e.target.value);
                              applyStyle({ strokeWidth: e.target.value });
                            }}
                            className="mt-1 w-full"
                          />
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="block text-[11px] font-bold">
                            الدوران
                            <select
                              value={iconRotation}
                              onChange={(e) => {
                                setIconRotation(e.target.value);
                                applyStyle({ rotate: e.target.value });
                              }}
                              className="mt-1 h-8 w-full rounded-lg border bg-background px-2"
                            >
                              <option value="0deg">0°</option>
                              <option value="45deg">45°</option>
                              <option value="90deg">90°</option>
                              <option value="180deg">180°</option>
                              <option value="270deg">270°</option>
                            </select>
                          </label>
                          <label className="block text-[11px] font-bold">
                            شكل الخلفية
                            <select
                              onChange={(e) => {
                                const shape = e.target.value;
                                if (shape === "none")
                                  applyStyle({
                                    backgroundColor: "transparent",
                                    borderRadius: "0px",
                                    padding: "0px",
                                  });
                                else if (shape === "circle")
                                  applyStyle({
                                    backgroundColor: backgroundColor || "#ffffff",
                                    borderRadius: "50%",
                                    padding: "8px",
                                    display: "inline-block",
                                  });
                                else if (shape === "rounded")
                                  applyStyle({
                                    backgroundColor: backgroundColor || "#ffffff",
                                    borderRadius: "12px",
                                    padding: "8px",
                                    display: "inline-block",
                                  });
                              }}
                              className="mt-1 h-8 w-full rounded-lg border bg-background px-2"
                            >
                              <option value="none">بدون</option>
                              <option value="circle">دائري</option>
                              <option value="rounded">مربع مستدير</option>
                            </select>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Typography */}
                    {!selectedIsVector && (
                      <div className="space-y-2 border-t pt-2.5">
                        <h4 className="font-black text-[11px] text-foreground">الخطوط والطباعة</h4>
                        <div>
                          <label className="text-[11px] text-muted-foreground block mb-1">
                            عائلة الخط
                          </label>
                          <select
                            value={fontFamily}
                            onChange={(e) => {
                              setFontFamily(e.target.value);
                              applyStyle({ fontFamily: e.target.value });
                            }}
                            className="w-full h-8 rounded-lg border bg-background px-2 text-xs"
                          >
                            <option value="Cairo, sans-serif">Cairo (القاهرة)</option>
                            <option value="'IBM Plex Sans Arabic', sans-serif">
                              IBM Plex Sans Arabic
                            </option>
                            <option value="'Readex Pro', sans-serif">Readex Pro</option>
                            <option value="'Plus Jakarta Sans', sans-serif">
                              Plus Jakarta Sans
                            </option>
                            <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-[11px]">
                            حجم الخط (px)
                            <input
                              type="number"
                              min="8"
                              max="120"
                              value={fontSize}
                              onChange={(e) => {
                                setFontSize(e.target.value);
                                applyStyle({ fontSize: e.target.value + "px" });
                              }}
                              className="mt-1 h-8 w-full rounded-lg border bg-background px-2"
                            />
                          </label>
                          <label className="text-[11px]">
                            سُمك الخط
                            <select
                              value={fontWeight}
                              onChange={(e) => {
                                setFontWeight(e.target.value);
                                applyStyle({ fontWeight: e.target.value });
                              }}
                              className="mt-1 h-8 w-full rounded-lg border bg-background px-2"
                            >
                              <option value="300">خفيف (300)</option>
                              <option value="400">عادي (400)</option>
                              <option value="500">متوسط (500)</option>
                              <option value="600">شبه عريض (600)</option>
                              <option value="700">عريض (700)</option>
                              <option value="900">ثقيل (900)</option>
                            </select>
                          </label>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-[11px]">
                            ارتفاع السطر
                            <Input
                              value={lineHeight}
                              onChange={(e) => {
                                setLineHeight(e.target.value);
                                applyStyle({ lineHeight: e.target.value });
                              }}
                              className="mt-1 h-8 text-xs font-mono"
                            />
                          </label>
                          <label className="text-[11px]">
                            محاذاة النص
                            <select
                              value={textAlign}
                              onChange={(e) => {
                                setTextAlign(e.target.value);
                                applyStyle({ textAlign: e.target.value });
                              }}
                              className="mt-1 h-8 w-full rounded-lg border bg-background px-2"
                            >
                              <option value="right">يمين</option>
                              <option value="center">توسيط</option>
                              <option value="left">يسار</option>
                              <option value="justify">ضبط</option>
                            </select>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Borders, Radius, Shadows & Opacity */}
                    <div className="space-y-2 border-t pt-2.5">
                      <h4 className="font-black text-[11px] text-foreground">الحدود والظلال والشفافية</h4>
                      <div className="grid grid-cols-3 gap-1.5">
                        <label className="text-[10px]">
                          سُمك الإطار
                          <Input
                            value={borderWidth}
                            onChange={(e) => {
                              setBorderWidth(e.target.value);
                              applyStyle({ borderWidth: e.target.value });
                            }}
                            placeholder="1px"
                            className="mt-1 h-7 text-xs font-mono"
                          />
                        </label>
                        <label className="text-[10px]">
                          نمط الإطار
                          <select
                            value={borderStyle}
                            onChange={(e) => {
                              setBorderStyle(e.target.value);
                              applyStyle({ borderStyle: e.target.value });
                            }}
                            className="mt-1 h-7 w-full rounded border bg-background px-1 text-[11px]"
                          >
                            <option value="solid">متصل</option>
                            <option value="dashed">متقطع</option>
                            <option value="dotted">منقط</option>
                            <option value="none">بدون</option>
                          </select>
                        </label>
                        <label className="text-[10px]">
                          لون الإطار
                          <input
                            type="color"
                            value={/^#[0-9a-f]{6}$/i.test(borderColor) ? borderColor : "#e2e8f0"}
                            onChange={(e) => {
                              setBorderColor(e.target.value);
                              applyStyle({ borderColor: e.target.value });
                            }}
                            className="mt-1 h-7 w-full rounded border bg-background p-0.5"
                          />
                        </label>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-[11px]">
                          استدارة الحواف
                          <Input
                            value={borderRadius}
                            onChange={(e) => {
                              setBorderRadius(e.target.value);
                              applyStyle({ borderRadius: e.target.value });
                            }}
                            placeholder="12px"
                            className="mt-1 h-8 text-xs font-mono"
                          />
                        </label>
                        <label className="text-[11px]">
                          الظل
                          <select
                            value={shadowStyle}
                            onChange={(e) => {
                              setShadowStyle(e.target.value);
                              applyStyle({ boxShadow: e.target.value });
                            }}
                            className="mt-1 h-8 w-full rounded-lg border bg-background px-2"
                          >
                            <option value="none">بدون</option>
                            <option value="0 1px 3px rgba(0,0,0,.12)">خفيف</option>
                            <option value="0 4px 12px rgba(0,0,0,.16)">متوسط</option>
                            <option value="0 12px 32px rgba(0,0,0,.22)">قوي</option>
                            <option value="0 0 0 2px rgba(99,102,241,.35)">إطار مضيء</option>
                          </select>
                        </label>
                      </div>

                      <label className="block text-[11px]">
                        الشفافية ({Math.round(Number(opacity) * 100)}%)
                        <input
                          type="range"
                          min="0.1"
                          max="1"
                          step="0.05"
                          value={opacity}
                          onChange={(e) => {
                            setOpacity(e.target.value);
                            applyStyle({ opacity: e.target.value });
                          }}
                          className="mt-1 w-full"
                        />
                      </label>
                    </div>

                    {/* Animation & Hover Interaction Panel */}
                    <div className="space-y-2 border-t pt-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="font-black text-[11px] text-foreground">
                          الحركة والتفاعل (Animations & Hover)
                        </h4>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[10px] gap-1"
                          onClick={() => {
                            const anim = {
                              type: animType,
                              durationMs: Number(animDuration) || 300,
                              delayMs: Number(animDelay) || 0,
                              hoverEffect,
                            };
                            send({
                              action: "animation",
                              selector: selected.selector,
                              animation: anim,
                            });
                          }}
                        >
                          <Play size={10} /> معاينة الحركة
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-[10px]">
                          حركة الدخول
                          <select
                            value={animType}
                            onChange={(e) => {
                              const nextType = e.target.value as any;
                              setAnimType(nextType);
                              const anim = {
                                type: nextType,
                                durationMs: Number(animDuration) || 300,
                                delayMs: Number(animDelay) || 0,
                                hoverEffect,
                              };
                              send({
                                action: "animation",
                                selector: selected.selector,
                                animation: anim,
                              });
                            }}
                            className="mt-1 h-7 w-full rounded border bg-background px-1 text-[11px]"
                          >
                            <option value="none">بدون حركة</option>
                            <option value="fade-in">ظهور تدريجي (Fade)</option>
                            <option value="slide-up">انزلاق للأعلى</option>
                            <option value="slide-right">انزلاق جانبي</option>
                            <option value="zoom-in">تكبير ناعم (Zoom)</option>
                          </select>
                        </label>
                        <label className="text-[10px]">
                          تأثير المرور (Hover)
                          <select
                            value={hoverEffect}
                            onChange={(e) => {
                              const nextHover = e.target.value as any;
                              setHoverEffect(nextHover);
                              commitEdits(selected.selector, {
                                animation: {
                                  type: animType,
                                  durationMs: Number(animDuration) || 300,
                                  delayMs: Number(animDelay) || 0,
                                  hoverEffect: nextHover,
                                },
                              });
                              send({
                                action: "restore",
                                edits: editsRef.current,
                                designSystem,
                              });
                            }}
                            className="mt-1 h-7 w-full rounded border bg-background px-1 text-[11px]"
                          >
                            <option value="none">افتراضي</option>
                            <option value="lift">ارتفاع للأعلى (Lift)</option>
                            <option value="scale">تكبير طفيف (Scale)</option>
                            <option value="glow">توهج مضيء (Glow)</option>
                          </select>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: LAYOUT (Free Positioning, Dimensions, Min/Max, Padding, Margin, Flex/Grid, Position) */}
                {rightTab === "layout" && (
                  <div className="space-y-3">
                    <StudioSectionSaveDiscardBar
                      hasChanges={showContextualSaveDiscard}
                      onSave={onSaveChanges}
                      onDiscard={onDiscardChanges}
                      onResetElement={edits[selected.selector] ? resetSelectedElementEdits : undefined}
                      isSaving={isSaving}
                      sectionLabel="التخطيط"
                    />

                    {/* Free Positioning & Drag-and-Drop Controls (Priority 8.3) */}
                    <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-2.5 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black text-[11px] text-foreground flex items-center gap-1.5">
                          <Move size={13} className="text-indigo-600 dark:text-indigo-400" />
                          <span>التحريك الحر والإحداثيات (Free Position)</span>
                        </span>
                        <div className="flex items-center gap-1">
                          {freePosEnabled && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={restoreNormalLayoutForSelection}
                              className="h-6 px-2 text-[10px] font-bold text-amber-700 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/10 cursor-pointer"
                              title="إلغاء الإحداثيات الحرة واستعادة التخطيط الطبيعي المتدفق"
                            >
                              استعادة التخطيط الطبيعي
                            </Button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (freePosEnabled) {
                                restoreNormalLayoutForSelection();
                              } else {
                                applyFreePositionCoordinates(freePosX, freePosY, "relative");
                                setStatus(
                                  "تم تفعيل التحريك الحر — يمكنك سحب العنصر بالماوس أو تحريكه بالأسهم",
                                );
                              }
                            }}
                            className={
                              "px-2 py-0.5 rounded-md text-[10px] font-black border cursor-pointer transition " +
                              (freePosEnabled
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-background text-muted-foreground hover:text-foreground")
                            }
                          >
                            {freePosEnabled ? "مفعّل" : "تفعيل"}
                          </button>
                        </div>
                      </div>

                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        اسحب العنصر مباشرة من مقبض التحريك العلوي داخل المعاينة، أو استخدم أسهم لوحة المفاتيح (<span className="font-mono">Arrows</span> / <span className="font-mono">Shift+Arrows</span>) والإحداثيات الرقمية الدقيقة.
                      </p>

                      {/* Exact X / Y Coordinate Inputs & Grid Size */}
                      <div className="grid grid-cols-3 gap-1.5">
                        <label className="text-[10px] font-bold">
                          إحداثي أفقي (X px)
                          <Input
                            type="number"
                            value={freePosX}
                            onChange={(e) => {
                              const nextX = Number(e.target.value) || 0;
                              applyFreePositionCoordinates(nextX, freePosY);
                            }}
                            className="mt-1 h-7 text-xs font-mono text-center"
                          />
                        </label>
                        <label className="text-[10px] font-bold">
                          إحداثي رأسي (Y px)
                          <Input
                            type="number"
                            value={freePosY}
                            onChange={(e) => {
                              const nextY = Number(e.target.value) || 0;
                              applyFreePositionCoordinates(freePosX, nextY);
                            }}
                            className="mt-1 h-7 text-xs font-mono text-center"
                          />
                        </label>
                        <label className="text-[10px] font-bold">
                          شبكة المحاذاة (Snap)
                          <select
                            value={gridSizePx}
                            onChange={(e) => setGridSizePx(Number(e.target.value) || 8)}
                            className="mt-1 h-7 w-full rounded border bg-background px-1 text-[11px] font-mono"
                          >
                            <option value={1}>1px (حر)</option>
                            <option value={4}>4px</option>
                            <option value={8}>8px</option>
                            <option value={16}>16px</option>
                          </select>
                        </label>
                      </div>

                      {/* Directional Nudge Pad */}
                      <div className="flex items-center justify-between gap-1 pt-0.5">
                        <span className="text-[10px] text-muted-foreground font-bold">
                          تحريك دقيق ({gridSizePx}px):
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              applyFreePositionCoordinates(freePosX - gridSizePx, freePosY)
                            }
                            className="h-6 px-2 text-[10px] font-mono cursor-pointer"
                            title="تحريك لليسار"
                          >
                            ← X-
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              applyFreePositionCoordinates(freePosX + gridSizePx, freePosY)
                            }
                            className="h-6 px-2 text-[10px] font-mono cursor-pointer"
                            title="تحريك لليمين"
                          >
                            X+ →
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              applyFreePositionCoordinates(freePosX, freePosY - gridSizePx)
                            }
                            className="h-6 px-2 text-[10px] font-mono cursor-pointer"
                            title="تحريك للأعلى"
                          >
                            ↑ Y-
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              applyFreePositionCoordinates(freePosX, freePosY + gridSizePx)
                            }
                            className="h-6 px-2 text-[10px] font-mono cursor-pointer"
                            title="تحريك للأسفل"
                          >
                            Y+ ↓
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Prominent Content Display Mode Switcher (Grid / List / Row / Block) */}
                    <div className="rounded-xl border border-primary/25 bg-primary/5 p-2.5 space-y-2">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-black text-[11px] text-foreground flex items-center gap-1">
                          <Grid size={12} className="text-primary" />
                          <span>أسلوب عرض المحتوى (Grid / List / Row)</span>
                        </span>
                        {parentAncestor && (
                          <div className="flex rounded-md border bg-background p-0.5 text-[9px] font-bold">
                            <button
                              type="button"
                              onClick={() => setLayoutTargetMode("self")}
                              className={
                                "px-1.5 py-0.5 rounded cursor-pointer " +
                                (layoutTargetMode === "self"
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground")
                              }
                            >
                              العنصر ({selected.tag})
                            </button>
                            <button
                              type="button"
                              onClick={() => setLayoutTargetMode("parent")}
                              className={
                                "px-1.5 py-0.5 rounded cursor-pointer " +
                                (layoutTargetMode === "parent"
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground")
                              }
                            >
                              الحاوية الأب ({parentAncestor.tag})
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => applyContentLayoutPreset("grid")}
                          className={
                            "py-1.5 px-2 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition " +
                            (displayMode === "grid"
                              ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                              : "bg-background hover:bg-accent")
                          }
                        >
                          <Grid size={12} />
                          <span>شبكة بطاقات (Grid)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => applyContentLayoutPreset("list")}
                          className={
                            "py-1.5 px-2 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition " +
                            (displayMode === "flex" && flexDirection === "column"
                              ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                              : "bg-background hover:bg-accent")
                          }
                        >
                          <Layers size={12} />
                          <span>قائمة رأسية (List)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => applyContentLayoutPreset("row")}
                          className={
                            "py-1.5 px-2 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition " +
                            (displayMode === "flex" && flexDirection !== "column"
                              ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                              : "bg-background hover:bg-accent")
                          }
                        >
                          <Layout size={12} />
                          <span>صف أفقي مرن (Row)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => applyContentLayoutPreset("block")}
                          className={
                            "py-1.5 px-2 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition " +
                            (displayMode === "block"
                              ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                              : "bg-background hover:bg-accent")
                          }
                        >
                          <span>كتلة عادية (Block)</span>
                        </button>
                      </div>

                      {/* Grid Columns Selector */}
                      <div className="space-y-1 pt-0.5">
                        <span className="text-[10px] text-muted-foreground font-bold block">
                          عدد الأعمدة عند العرض كشبكة (Grid Columns):
                        </span>
                        <div className="grid grid-cols-4 gap-1">
                          {(
                            [
                              ["2", "عمودان (2)"],
                              ["3", "3 أعمدة"],
                              ["4", "4 أعمدة"],
                              ["auto", "تلقائي متجاوب"],
                            ] as const
                          ).map(([colVal, colLbl]) => (
                            <button
                              key={colVal}
                              type="button"
                              onClick={() => applyContentLayoutPreset("grid", colVal)}
                              className={
                                "py-1 rounded border text-[10px] font-bold cursor-pointer " +
                                (displayMode === "grid" && gridColumnsCount === colVal
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background text-muted-foreground hover:text-foreground")
                              }
                            >
                              {colLbl}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Quick Gap Presets */}
                      <div className="flex items-center justify-between gap-1 pt-0.5">
                        <span className="text-[10px] text-muted-foreground font-bold">
                          المسافة بين العناصر (Gap):
                        </span>
                        <div className="flex items-center gap-1">
                          {["8px", "12px", "16px", "24px"].map((g) => (
                            <button
                              key={g}
                              type="button"
                              onClick={() => {
                                setGapValue(g);
                                const targetSel =
                                  layoutTargetMode === "parent" && parentAncestor
                                    ? parentAncestor.selector
                                    : selected.selector;
                                send({ action: "style", selector: targetSel, styles: { gap: g } });
                              }}
                              className={
                                "px-1.5 py-0.5 rounded border text-[9px] font-mono cursor-pointer " +
                                (gapValue === g
                                  ? "bg-primary text-primary-foreground border-primary font-bold"
                                  : "bg-background text-muted-foreground")
                              }
                            >
                              {g}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[11px] font-bold">
                        العرض (Width)
                        <Input
                          value={width}
                          placeholder="auto أو 100%"
                          onChange={(e) => {
                            setWidth(e.target.value);
                            applyStyle({ width: e.target.value });
                          }}
                          className="mt-1 h-8 text-xs font-mono"
                        />
                      </label>
                      <label className="text-[11px] font-bold">
                        الارتفاع (Height)
                        <Input
                          value={height}
                          placeholder="auto أو 80px"
                          onChange={(e) => {
                            setHeight(e.target.value);
                            applyStyle({ height: e.target.value });
                          }}
                          className="mt-1 h-8 text-xs font-mono"
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[10px]">
                        أدنى عرض (Min-W)
                        <Input
                          value={minWidth}
                          onChange={(e) => {
                            setMinWidth(e.target.value);
                            applyStyle({ minWidth: e.target.value });
                          }}
                          placeholder="0px"
                          className="mt-1 h-7 text-xs font-mono"
                        />
                      </label>
                      <label className="text-[10px]">
                        أقصى عرض (Max-W)
                        <Input
                          value={maxWidth}
                          onChange={(e) => {
                            setMaxWidth(e.target.value);
                            applyStyle({ maxWidth: e.target.value });
                          }}
                          placeholder="100%"
                          className="mt-1 h-7 text-xs font-mono"
                        />
                      </label>
                    </div>

                    {/* 4-Side Padding */}
                    <div className="border-t pt-2.5 space-y-1.5">
                      <span className="font-black text-[11px] block">الحشو الداخلي (Padding)</span>
                      <div className="grid grid-cols-4 gap-1">
                        {(
                          [
                            ["أعلى", paddingTop, setPaddingTop, "paddingTop"],
                            ["يمين", paddingRight, setPaddingRight, "paddingRight"],
                            ["أسفل", paddingBottom, setPaddingBottom, "paddingBottom"],
                            ["يسار", paddingLeft, setPaddingLeft, "paddingLeft"],
                          ] as const
                        ).map(([lbl, val, setter, styleKey]) => (
                          <div key={styleKey} className="text-center">
                            <span className="text-[9px] text-muted-foreground">{lbl}</span>
                            <Input
                              value={val}
                              onChange={(e) => {
                                setter(e.target.value);
                                applyStyle({ [styleKey]: e.target.value });
                              }}
                              className="h-7 text-[10px] font-mono text-center px-1"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 4-Side Margin */}
                    <div className="border-t pt-2.5 space-y-1.5">
                      <span className="font-black text-[11px] block">الهامش الخارجي (Margin)</span>
                      <div className="grid grid-cols-4 gap-1">
                        {(
                          [
                            ["أعلى", marginTop, setMarginTop, "marginTop"],
                            ["يمين", marginRight, setMarginRight, "marginRight"],
                            ["أسفل", marginBottom, setMarginBottom, "marginBottom"],
                            ["يسار", marginLeft, setMarginLeft, "marginLeft"],
                          ] as const
                        ).map(([lbl, val, setter, styleKey]) => (
                          <div key={styleKey} className="text-center">
                            <span className="text-[9px] text-muted-foreground">{lbl}</span>
                            <Input
                              value={val}
                              onChange={(e) => {
                                setter(e.target.value);
                                applyStyle({ [styleKey]: e.target.value });
                              }}
                              className="h-7 text-[10px] font-mono text-center px-1"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Flexbox & Grid Controls */}
                    <div className="border-t pt-2.5 space-y-2">
                      <span className="font-black text-[11px] block">نظام العرض والمحاذاة (Flex & Grid)</span>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-[10px]">
                          طريقة العرض (Display)
                          <select
                            value={displayMode}
                            onChange={(e) => {
                              setDisplayMode(e.target.value);
                              applyStyle({ display: e.target.value });
                            }}
                            className="mt-1 h-7 w-full rounded border bg-background px-1"
                          >
                            <option value="block">Block</option>
                            <option value="flex">Flex</option>
                            <option value="inline-flex">Inline-Flex</option>
                            <option value="grid">Grid</option>
                            <option value="none">مخفي (None)</option>
                          </select>
                        </label>
                        <label className="text-[10px]">
                          المسافة البينية (Gap)
                          <Input
                            value={gapValue}
                            onChange={(e) => {
                              setGapValue(e.target.value);
                              applyStyle({ gap: e.target.value });
                            }}
                            placeholder="12px"
                            className="mt-1 h-7 text-xs font-mono"
                          />
                        </label>
                      </div>

                      {(displayMode === "flex" || displayMode === "inline-flex") && (
                        <div className="grid grid-cols-3 gap-1.5">
                          <label className="text-[10px]">
                            الاتجاه
                            <select
                              value={flexDirection}
                              onChange={(e) => {
                                setFlexDirection(e.target.value);
                                applyStyle({ flexDirection: e.target.value });
                              }}
                              className="mt-1 h-7 w-full rounded border bg-background px-1"
                            >
                              <option value="row">أفقي</option>
                              <option value="column">عمودي</option>
                              <option value="row-reverse">أفقي عكسي</option>
                            </select>
                          </label>
                          <label className="text-[10px]">
                            توزيع (Justify)
                            <select
                              value={justifyContent}
                              onChange={(e) => {
                                setJustifyContent(e.target.value);
                                applyStyle({ justifyContent: e.target.value });
                              }}
                              className="mt-1 h-7 w-full rounded border bg-background px-1"
                            >
                              <option value="flex-start">بداية</option>
                              <option value="center">وسط</option>
                              <option value="flex-end">نهاية</option>
                              <option value="space-between">توزيع متباعد</option>
                            </select>
                          </label>
                          <label className="text-[10px]">
                            محاذاة (Align)
                            <select
                              value={alignItems}
                              onChange={(e) => {
                                setAlignItems(e.target.value);
                                applyStyle({ alignItems: e.target.value });
                              }}
                              className="mt-1 h-7 w-full rounded border bg-background px-1"
                            >
                              <option value="stretch">تمدد</option>
                              <option value="center">وسط</option>
                              <option value="flex-start">أعلى</option>
                              <option value="flex-end">أسفل</option>
                            </select>
                          </label>
                        </div>
                      )}
                    </div>

                    {/* Positioning, Layer Order & Overflow */}
                    <div className="border-t pt-2.5 space-y-2">
                      <div className="grid grid-cols-3 gap-1.5">
                        <label className="text-[10px]">
                          التموضع
                          <select
                            value={positionMode}
                            onChange={(e) => {
                              setPositionMode(e.target.value);
                              applyStyle({ position: e.target.value });
                            }}
                            className="mt-1 h-7 w-full rounded border bg-background px-1"
                          >
                            <option value="static">Static</option>
                            <option value="relative">Relative</option>
                            <option value="absolute">Absolute</option>
                            <option value="sticky">Sticky</option>
                          </select>
                        </label>
                        <label className="text-[10px]">
                          طبقة (Z-Index)
                          <Input
                            value={zIndexValue}
                            onChange={(e) => {
                              setZIndexValue(e.target.value);
                              applyStyle({ zIndex: e.target.value });
                            }}
                            placeholder="auto"
                            className="mt-1 h-7 text-xs font-mono"
                          />
                        </label>
                        <label className="text-[10px]">
                          الفيض (Overflow)
                          <select
                            value={overflowMode}
                            onChange={(e) => {
                              setOverflowMode(e.target.value);
                              applyStyle({ overflow: e.target.value });
                            }}
                            className="mt-1 h-7 w-full rounded border bg-background px-1"
                          >
                            <option value="visible">Visible</option>
                            <option value="hidden">Hidden</option>
                            <option value="auto">Auto</option>
                            <option value="scroll">Scroll</option>
                          </select>
                        </label>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => action("moveUp")}
                          className="h-7 text-[11px] gap-1"
                        >
                          <ArrowUp size={12} /> ترتيب لأعلى
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => action("moveDown")}
                          className="h-7 text-[11px] gap-1"
                        >
                          <ArrowDown size={12} /> ترتيب لأسفل
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 4: RESPONSIVE OVERRIDES (Desktop, Tablet, Mobile) */}
                {rightTab === "responsive" && (
                  <div className="space-y-3">
                    <StudioSectionSaveDiscardBar
                      hasChanges={showContextualSaveDiscard}
                      onSave={onSaveChanges}
                      onDiscard={onDiscardChanges}
                      onResetElement={edits[selected.selector] ? resetSelectedElementEdits : undefined}
                      isSaving={isSaving}
                      sectionLabel="التجاوب"
                    />
                    <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                      <span className="font-black text-[11px] block">
                        نقطة التوقف النشطة للتخصيص (Breakpoint Target)
                      </span>
                      <div className="grid grid-cols-3 gap-1">
                        {(
                          [
                            ["desktop", "سطح المكتب", Monitor],
                            ["tablet", "التابلت", Tablet],
                            ["mobile", "الهاتف", Smartphone],
                          ] as const
                        ).map(([bp, lbl, Icon]) => (
                          <button
                            key={bp}
                            type="button"
                            onClick={() => {
                              setResponsiveEditTarget(bp);
                              setPreviewSize(bp);
                            }}
                            className={
                              "py-1.5 px-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer border " +
                              (responsiveEditTarget === bp
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background text-muted-foreground")
                            }
                          >
                            <Icon size={12} />
                            <span>{lbl}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Device Visibility Controls */}
                    <div className="p-2.5 rounded-xl border space-y-2">
                      <span className="font-bold text-[11px] block">إظهار / إخفاء حسب الجهاز</span>
                      {(
                        [
                          ["desktop", "إخفاء على سطح المكتب"],
                          ["tablet", "إخفاء على التابلت (≤ 1024px)"],
                          ["mobile", "إخفاء على الهاتف (≤ 640px)"],
                        ] as const
                      ).map(([bp, label]) => {
                        const isHiddenOnBp = Boolean(selectedEdit.hiddenOn?.[bp]);
                        return (
                          <label
                            key={bp}
                            className="flex items-center justify-between text-[11px] cursor-pointer py-0.5"
                          >
                            <span>{label}</span>
                            <input
                              type="checkbox"
                              checked={isHiddenOnBp}
                              onChange={(e) => {
                                commitEdits(selected.selector, {
                                  hiddenOn: {
                                    ...(selectedEdit.hiddenOn || {}),
                                    [bp]: e.target.checked,
                                  },
                                });
                                send({
                                  action: "restore",
                                  edits: editsRef.current,
                                  designSystem,
                                });
                              }}
                            />
                          </label>
                        );
                      })}
                    </div>

                    {/* Breakpoint-Specific Overrides */}
                    <div className="p-2.5 rounded-xl border space-y-2">
                      <span className="font-bold text-[11px] block">
                        تخصيص الحجم والأبعاد لـ ({responsiveEditTarget.toUpperCase()})
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-[10px]">
                          العرض على {responsiveEditTarget}
                          <Input
                            value={
                              selectedEdit.responsiveStyles?.[responsiveEditTarget]?.width || ""
                            }
                            onChange={(e) => applyStyle({ width: e.target.value })}
                            placeholder="100%"
                            className="mt-1 h-7 text-xs font-mono"
                          />
                        </label>
                        <label className="text-[10px]">
                          حجم الخط على {responsiveEditTarget}
                          <Input
                            value={
                              selectedEdit.responsiveStyles?.[responsiveEditTarget]?.fontSize || ""
                            }
                            onChange={(e) => applyStyle({ fontSize: e.target.value })}
                            placeholder="14px"
                            className="mt-1 h-7 text-xs font-mono"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 5: ADVANCED (Element ID, Classes, ARIA, Safe Attributes, Reset) */}
                {rightTab === "advanced" && (
                  <div className="space-y-3">
                    <StudioSectionSaveDiscardBar
                      hasChanges={showContextualSaveDiscard}
                      onSave={onSaveChanges}
                      onDiscard={onDiscardChanges}
                      onResetElement={edits[selected.selector] ? resetSelectedElementEdits : undefined}
                      isSaving={isSaving}
                      sectionLabel="متقدم"
                    />
                    <div>
                      <label className="block font-bold mb-1">معرّف العنصر (Element ID)</label>
                      <Input
                        value={customId}
                        onChange={(e) => {
                          setCustomId(e.target.value);
                          commitEdits(selected.selector, { customId: e.target.value });
                          send({
                            action: "attributes",
                            selector: selected.selector,
                            attributes: { id: e.target.value },
                            silent: true,
                          });
                        }}
                        placeholder="custom-section-id"
                        className="h-8 text-xs font-mono text-left"
                      />
                    </div>

                    <div>
                      <label className="block font-bold mb-1">فئات CSS (Classes)</label>
                      <Input
                        value={classNameVal}
                        onChange={(e) => {
                          setClassNameVal(e.target.value);
                          commitEdits(selected.selector, { className: e.target.value });
                        }}
                        placeholder="rounded-xl shadow-md..."
                        className="h-8 text-xs font-mono text-left"
                      />
                    </div>

                    <div className="p-2.5 rounded-xl border space-y-2">
                      <span className="font-bold text-[11px] block">
                        خصائص إمكانية الوصول (Accessibility / ARIA)
                      </span>
                      <Input
                        value={ariaLabelVal}
                        onChange={(e) => {
                          setAriaLabelVal(e.target.value);
                          commitEdits(selected.selector, { ariaLabel: e.target.value });
                          send({
                            action: "attributes",
                            selector: selected.selector,
                            attributes: { "aria-label": e.target.value },
                          });
                        }}
                        placeholder="aria-label لقارئات الشاشة..."
                        className="h-7 text-xs"
                      />
                      <Input
                        value={roleVal}
                        onChange={(e) => {
                          setRoleVal(e.target.value);
                          commitEdits(selected.selector, { role: e.target.value });
                          send({
                            action: "attributes",
                            selector: selected.selector,
                            attributes: { role: e.target.value },
                          });
                        }}
                        placeholder="role (مثال: button, region, navigation)"
                        className="h-7 text-xs font-mono text-left"
                      />
                    </div>

                    {/* Read-only DOM Selector Info */}
                    <div className="p-2.5 rounded-xl bg-muted/50 border space-y-1 text-[10px] font-mono">
                      <div className="font-bold text-foreground font-cairo">معلومات العنصر (Read-Only):</div>
                      <div className="break-all">Tag: &lt;{selected.tag}&gt;</div>
                      <div className="break-all">Selector: {selected.selector}</div>
                      <div>
                        Bounding Box: {selected.rectWidth}px × {selected.rectHeight}px
                      </div>
                    </div>

                    <div className="space-y-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={isSelectedHidden ? "outline" : "destructive"}
                        disabled={isSelectedLocked || previewSource === "published"}
                        onClick={deleteOrRestoreSelectedElement}
                        className="w-full h-8 text-xs gap-1.5 font-bold cursor-pointer"
                      >
                        <Trash2 size={13} />
                        <span>
                          {isSelectedHidden
                            ? "استعادة العنصر المحذوف إلى الصفحة"
                            : "حذف هذا العنصر من الصفحة"}
                        </span>
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const next = { ...editsRef.current };
                          delete next[selected.selector];
                          editsRef.current = next;
                          lastCommittedEditsRef.current = next;
                          setEdits(next);
                          changeCallbackRef.current(next);
                          send({ action: "restore", edits: next, designSystem });
                        }}
                        className="w-full h-8 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10 cursor-pointer"
                      >
                        <RotateCcw size={13} />
                        <span>إعادة ضبط تعديلات هذا العنصر</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}