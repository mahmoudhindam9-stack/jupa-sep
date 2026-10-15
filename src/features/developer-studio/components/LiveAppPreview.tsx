import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, Copy, Eye, EyeOff, Layers, Monitor, Plus, RefreshCw, Settings2, Smartphone, Tablet, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StudioDomAddedItem, StudioDomEdit } from "../models/studio.types";

type SelectedDomElement = {
  selector: string; tag: string; text: string; color: string; backgroundColor: string;
  fontSize: string; fontWeight: string; width: string; height: string;
  fill: string; stroke: string; strokeWidth: string; opacity: string;
  borderRadius: string; rotate: string; textAlign: string; href: string; isLink: boolean;
};
type LiveTreeNode = { selector: string; tag: string; label: string; children: LiveTreeNode[] };
type LiveRoute = { href: string; label: string };
type Props = {
  route: string;
  initialEdits: Record<string, StudioDomEdit>;
  onEditsChange: (edits: Record<string, StudioDomEdit>) => void;
  /** Enable direct DOM editing only while the Element Designer workspace is active. */
  designerMode?: boolean;
};
type PreviewSize = "desktop" | "tablet" | "mobile";

export function LiveAppPreview({ route, initialEdits, onEditsChange, designerMode = false }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const editsRef = useRef<Record<string, StudioDomEdit>>(initialEdits || {});
  const changeCallbackRef = useRef(onEditsChange);
  const [selected, setSelected] = useState<SelectedDomElement | null>(null);
  const [linkValue, setLinkValue] = useState("");
  const [showAddItem, setShowAddItem] = useState(false);
  const [addedType, setAddedType] = useState<StudioDomAddedItem["type"]>("button");
  const [addedName, setAddedName] = useState("عنصر جديد");
  const [addedText, setAddedText] = useState("عنصر جديد");
  const [addedPlacement, setAddedPlacement] = useState<StudioDomAddedItem["placement"]>("after");
  const [addedAction, setAddedAction] = useState<NonNullable<StudioDomAddedItem["action"]>>("none");
  const [addedUrl, setAddedUrl] = useState("");
  const [addedMessage, setAddedMessage] = useState("تم تنفيذ الإجراء.");
  const [textValue, setTextValue] = useState("");
  const [textColor, setTextColor] = useState("#111827");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [fontSize, setFontSize] = useState("16");
  const [fontWeight, setFontWeight] = useState("400");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [fillColor, setFillColor] = useState("#6366f1");
  const [strokeColor, setStrokeColor] = useState("#334155");
  const [strokeWidth, setStrokeWidth] = useState("2");
  const [opacity, setOpacity] = useState("1");
  const [borderRadius, setBorderRadius] = useState("8px");
  const [iconRotation, setIconRotation] = useState("0deg");
  const [textAlign, setTextAlign] = useState("right");
  const [shadowStyle, setShadowStyle] = useState("none");
  const [previewSize, setPreviewSize] = useState<PreviewSize>("desktop");
  const [editMode, setEditMode] = useState(designerMode);
  const [frameKey, setFrameKey] = useState(0);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("جاري تحميل معاينة التطبيق…");
  const [currentRoute, setCurrentRoute] = useState(route);
  const [treeNodes, setTreeNodes] = useState<LiveTreeNode[]>([]);
  const [pageLinks, setPageLinks] = useState<LiveRoute[]>([]);
  // Keep the real app at its natural width by default; side panels are optional overlays.
  const [showExplorer, setShowExplorer] = useState(false);
  const [showProperties, setShowProperties] = useState(false);
  const [treeFilter, setTreeFilter] = useState("");
  const [edits, setEdits] = useState<Record<string, StudioDomEdit>>(initialEdits || {});
  editsRef.current = edits;
  changeCallbackRef.current = onEditsChange;

  useEffect(() => {
    setCurrentRoute(route);
  }, [route]);

  const safeRoute = useMemo(() => {
    const value = (currentRoute || "/admin").trim();
    return value.startsWith("/") && !value.startsWith("//") ? value : "/admin";
  }, [currentRoute]);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const send = useCallback((data: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage({ type: "STUDIO_COMMAND", ...data }, origin);
  }, [origin]);

  const commitEdits = useCallback((selector: string, patch: StudioDomEdit) => {
    const next = {
      ...editsRef.current,
      [selector]: { ...(editsRef.current[selector] || {}), ...patch },
    };
    editsRef.current = next;
    setEdits(next);
    changeCallbackRef.current(next);
  }, []);

  const onMessage = useCallback((event: MessageEvent) => {
    if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow || !event.data) return;
    if (event.data.type === "STUDIO_TREE") {
      setTreeNodes(Array.isArray(event.data.nodes) ? event.data.nodes as LiveTreeNode[] : []);
    } else if (event.data.type === "STUDIO_ROUTES") {
      const routes = Array.isArray(event.data.routes)
        ? event.data.routes.filter((item: any) => item && typeof item.href === "string" && item.href.startsWith("/") && !item.href.startsWith("//"))
            .map((item: any) => ({ href: String(item.href), label: String(item.label || item.href) }))
        : [];
      setPageLinks(routes);
    } else if (event.data.type === "STUDIO_SELECTED") {
      const item = event.data.element as SelectedDomElement;
      setSelected(item);
      setLinkValue(item.href || "");
      if (editMode) setShowProperties(true);
      setTextValue(item.text || "");
      setTextColor(item.color || "#111827");
      setBackgroundColor(item.backgroundColor || "#ffffff");
      setFontSize(String(parseInt(item.fontSize, 10) || 16));
      setFontWeight(item.fontWeight || "400");
      setWidth(item.width === "auto" ? "" : item.width || "");
      setHeight(item.height === "auto" ? "" : item.height || "");
      setFillColor(/^#[0-9a-f]{6}$/i.test(item.fill) ? item.fill : "#6366f1");
      setStrokeColor(/^#[0-9a-f]{6}$/i.test(item.stroke) ? item.stroke : (item.color && /^#[0-9a-f]{6}$/i.test(item.color) ? item.color : "#334155"));
      setStrokeWidth(String(parseFloat(item.strokeWidth) || 2));
      setOpacity(String(Math.max(0, Math.min(1, parseFloat(item.opacity) || 1))));
      setBorderRadius(item.borderRadius || "8px");
      setIconRotation(item.rotate || "0deg");
      setTextAlign(item.textAlign || "right");
      setStatus("تم تحديد العنصر: " + item.tag);
    } else if (event.data.type === "STUDIO_CHANGE") {
      commitEdits(String(event.data.selector), event.data.patch || {});
      setStatus("تم تعديل المعاينة فقط — اضغط «حفظ ومزامنة» لاعتماد المسودة على الخادم.");
    } else if (event.data.type === "STUDIO_LINK_UNAVAILABLE") {
      setStatus(String(event.data.message || "تعذر تحديث الرابط."));
    } else if (event.data.type === "STUDIO_PROTECTED_ELEMENT") {
      setStatus(String(event.data.message || "هذا العنصر محمي من التعديل لضمان بقاء وظائفه الأصلية."));
    } else if (event.data.type === "STUDIO_BRIDGE_READY") {
      setReady(true);
      setStatus("المعاينة الحقيقية جاهزة");
      send({ action: "setMode", enabled: editMode });
      send({ action: "restore", edits: editsRef.current });
    }
  }, [commitEdits, editMode, send]);

  useEffect(() => {
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onMessage]);

  useEffect(() => {
    setReady(false);
    setSelected(null);
    setTreeNodes([]);
    setPageLinks([]);
    setStatus("جاري تحميل الصفحة الفعلية: " + safeRoute);
  }, [safeRoute, frameKey]);

  useEffect(() => {
    setEditMode(designerMode);
    setShowExplorer(designerMode);
    if (!designerMode) {
      setShowProperties(false);
      setShowAddItem(false);
    }
  }, [designerMode]);

  useEffect(() => {
    if (ready) send({ action: "setMode", enabled: editMode });
  }, [editMode, ready, send]);

  // Keep the real iframe in sync with undo/redo and any restored draft snapshot.
  useEffect(() => {
    const snapshot = initialEdits || {};
    editsRef.current = snapshot;
    setEdits(snapshot);
    if (ready) send({ action: "restore", edits: snapshot });
  }, [initialEdits, ready, send]);

  const installBridge = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    const win = iframeRef.current?.contentWindow;
    if (!doc?.body || !win) {
      setStatus("تعذر الوصول إلى المعاينة؛ تأكد من أن صفحة التطبيق تعمل.");
      return;
    }
    if (win.location.origin !== window.location.origin) {
      setStatus("المعاينة على نطاق مختلف. ثبّت Coding Studio Bridge داخل المشروع المستهدف.");
      return;
    }
    if (!doc.getElementById("coding-studio-overlay")) {
      const style = doc.createElement("style");
      style.id = "coding-studio-overlay";
      style.textContent = 'body[data-coding-studio="on"] *{cursor:grab!important;user-select:none!important}body[data-coding-studio="on"] *:hover{outline:1px dashed #6366f1!important;outline-offset:-1px}[data-coding-studio-dragging="true"]{cursor:grabbing!important;z-index:9999!important}[data-coding-studio-selected="true"]{outline:2px solid #6366f1!important;outline-offset:1px!important}';
      doc.head.appendChild(style);
    }
    if (doc.getElementById("coding-studio-bridge")) {
      setReady(true);
      send({ action: "setMode", enabled: editMode });
      send({ action: "restore", edits: editsRef.current });
      return;
    }
    const script = doc.createElement("script");
    script.id = "coding-studio-bridge";
    script.textContent = String.raw`(() => {
      const parentOrigin = location.origin;
      const selectorFor = (el) => {
        if (el.id && !el.id.startsWith("radix-")) return "#" + CSS.escape(el.id);
        const tid = el.getAttribute("data-testid");
        if (tid) return '[data-testid="' + CSS.escape(tid) + '"]';
        const path = [];
        let node = el;
        while (node && node.nodeType === 1 && node !== document.body) {
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
      const preservedSelector = '[data-studio-preserve="currency-switcher-tools"], [data-studio-preserve="currency-switcher"]';
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
        originalStates.set(selector, {
          el,
          styleAttribute: el.getAttribute("style"),
          leafText: el.children.length === 0 ? (el.textContent || "") : null,
          directTextNodes: el.children.length === 0 ? [] : Array.from(el.childNodes)
            .filter((node) => node.nodeType === Node.TEXT_NODE)
            .map((node) => ({ node, text: node.textContent })),
          parent: el.parentNode,
          nextSibling: el.nextSibling,
          linkEl: el.matches("a[href]") ? el : el.closest("a[href]"),
          hrefAttribute: (el.matches("a") ? el : el.closest("a"))?.getAttribute("href") ?? null,
        });
      };
      const resetPreviewEdits = () => {
        document.querySelectorAll("[data-coding-studio-clone-of]").forEach((el) => el.remove());
        document.querySelectorAll("[data-coding-studio-added-for]").forEach((el) => el.remove());
        for (const state of Array.from(originalStates.values()).reverse()) {
          const el = state.el;
          if (!el.isConnected) continue;
          if (state.leafText !== null) {
            el.textContent = state.leafText;
          } else {
            for (const item of state.directTextNodes) {
              if (item.node.parentNode === el) item.node.textContent = item.text;
            }
          }
          delete el.dataset.codingStudioTextApplied;
          if (state.styleAttribute === null) el.removeAttribute("style");
          else el.setAttribute("style", state.styleAttribute);
          if (state.linkEl?.isConnected) {
            if (state.hrefAttribute === null) state.linkEl.removeAttribute("href");
            else state.linkEl.setAttribute("href", state.hrefAttribute);
          }
          if (state.parent && el.parentNode === state.parent) {
            if (state.nextSibling && state.nextSibling.parentNode === state.parent) state.parent.insertBefore(el, state.nextSibling);
            else state.parent.appendChild(el);
          }
        }
        originalStates.clear();
      };
      const describe = (el) => {
        const css = getComputedStyle(el);
        return { selector: selectorFor(el), tag: el.tagName.toLowerCase(),
          text: (el.innerText || el.textContent || "").trim().slice(0, 1000),
          color: css.color, backgroundColor: css.backgroundColor, fontSize: css.fontSize,
          width: el.style.width || "auto", height: el.style.height || "auto", fontWeight: css.fontWeight,
          fill: css.fill || el.getAttribute("fill") || "", stroke: css.stroke || el.getAttribute("stroke") || "",
          strokeWidth: css.strokeWidth || el.getAttribute("stroke-width") || "2", opacity: css.opacity || "1",
          borderRadius: css.borderRadius || "0px", rotate: css.rotate || "0deg", textAlign: css.textAlign || "right",
          href: (el.matches("a[href]") ? el : el.closest("a[href]"))?.getAttribute("href") || "",
          isLink: !!(el.matches("a") || el.closest("a")) };
      };
      const applyStyles = (el, styles) => {
        const applyTo = [el];
        const isSvgRoot = el.tagName?.toLowerCase() === "svg";
        if (isSvgRoot) applyTo.push(...el.querySelectorAll("path,circle,rect,line,polyline,polygon,ellipse"));
        const inheritableVectorStyles = new Set(["fill", "stroke", "strokeWidth", "color"]);
        Object.entries(styles || {}).forEach(([key, value]) => {
          if (typeof value !== "string") return;
          if (key in el.style) el.style[key] = value;
          if (isSvgRoot && inheritableVectorStyles.has(key)) {
            applyTo.slice(1).forEach((node) => { if (key in node.style) node.style[key] = value; });
          }
        });
      };
      const applyText = (el, value) => {
        const node = Array.from(el.childNodes).find((child) => child.nodeType === 3 && (child.textContent || "").trim());
        if (node) node.textContent = String(value);
        else if (!el.children.length) el.textContent = String(value);
        el.dataset.codingStudioTextApplied = String(value);
      };
      const safeLinkUrl = (value) => {
        const url = String(value || "").trim();
        return (url.startsWith("/") && !url.startsWith("//")) || /^https?:\/\//i.test(url) ? url : "";
      };
      const renderAddedItem = (item, selector) => {
        const types = { text: "p", button: "button", input: "input", card: "div", divider: "hr", link: "a" };
        const node = document.createElement(types[item?.type] || "p");
        node.dataset.codingStudioAddedFor = selector;
        node.id = String(item?.id || "");
        node.dataset.studioAddedName = String(item?.name || "عنصر جديد");
        node.setAttribute("aria-label", node.dataset.studioAddedName);
        if (item?.type === "input") {
          node.setAttribute("placeholder", String(item?.text || ""));
          node.setAttribute("type", "text");
          node.style.cssText = "display:block;max-width:100%;padding:8px 10px;margin:6px 0;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#111827";
        } else if (item?.type === "divider") {
          node.style.cssText = "display:block;width:100%;margin:10px 0;border:0;border-top:1px solid #cbd5e1";
        } else {
          node.textContent = String(item?.text || item?.name || "عنصر جديد");
          node.style.cssText = item?.type === "button"
            ? "display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px 12px;margin:6px 4px;border:1px solid #cbd5e1;border-radius:8px;background:#4f46e5;color:#fff;font-weight:700;cursor:pointer"
            : item?.type === "card"
              ? "display:block;padding:12px;margin:8px 0;border:1px solid #cbd5e1;border-radius:12px;background:#fff;color:#111827"
              : item?.type === "link"
                ? "display:inline-block;margin:6px 4px;color:#2563eb;text-decoration:underline;cursor:pointer"
                : "display:block;margin:6px 0;color:inherit";
        }
        if (item?.type === "link") {
          const safe = safeLinkUrl(item.url);
          if (safe) node.setAttribute("href", safe);
        }
        if (item?.type === "button" || item?.type === "link") {
          node.addEventListener("click", (event) => {
            const action = item?.action || "none";
            const safe = safeLinkUrl(item?.url);
            if (action !== "none") event.preventDefault();
            if (action === "message") window.alert(String(item?.message || "تم تنفيذ الإجراء."));
            else if (action === "navigate" && safe.startsWith("/") && !safe.startsWith("//")) location.assign(safe);
            else if (action === "external" && /^https?:\/\//i.test(safe)) window.open(safe, "_blank", "noopener,noreferrer");
          });
        }
        return node;
      };
      const applyEdit = (selector, edit) => {
        const el = find(selector);
        if (!el || !edit || isProtected(el)) return;
        if (containsProtected(el) && hidesProtected(edit)) return;
        rememberOriginal(selector, el);
        if (edit.text !== undefined && el.dataset.codingStudioTextApplied !== String(edit.text)) applyText(el, edit.text);
        if (edit.styles && typeof edit.styles === "object") applyStyles(el, edit.styles);
        if (typeof edit.href === "string") {
          const anchor = el.matches("a") ? el : el.closest("a");
          if (anchor) {
            const safeHref = safeLinkUrl(edit.href);
            if (safeHref) anchor.setAttribute("href", safeHref);
            else if (!edit.href.trim()) anchor.removeAttribute("href");
          }
        }
        if (edit.deleted) el.style.display = "none";
        if (typeof edit.order === "number" && el.parentElement) {
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
            clone.setAttribute("data-coding-studio-clone-of", selector);
            parent.insertBefore(clone, el.nextSibling);
          }
        }
        if (!edit.deleted && Array.isArray(edit.additions)) {
          edit.additions.slice(0, 100).forEach((item) => {
            if (!item || !item.id || !["text", "button", "input", "card", "divider", "link"].includes(item.type)) return;
            const added = renderAddedItem(item, selector);
            if (item.placement === "inside") el.appendChild(added);
            else if (el.parentElement) el.parentElement.insertBefore(added, el.nextSibling);
          });
        }
      };
      let selected = null;
      let enabled = true;
      let dragState = null;
      const editableSelector = "button,a,input,textarea,select,label,h1,h2,h3,h4,h5,h6,p,span,div,section,article,li,td,th,svg,path,circle,rect,line,polyline,polygon";
      const selectElement = (el) => {
        if (selected) selected.removeAttribute("data-coding-studio-selected");
        selected = null;
        if (isProtected(el)) {
          send("STUDIO_PROTECTED_ELEMENT", { message: "مربع تغيير العملات محمي للحفاظ على وظائفه الأصلية." });
          return;
        }
        selected = el;
        selected.setAttribute("data-coding-studio-selected", "true");
        send("STUDIO_SELECTED", { element: describe(selected) });
      };
      document.body.dataset.codingStudio = "on";
      document.addEventListener("pointerdown", (event) => {
        if (!enabled || document.body.dataset.codingStudio !== "on" || event.button !== 0) return;
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        let el = target.closest(editableSelector);
        if (!el || el === document.body || el === document.documentElement) return;
        if (["PATH", "CIRCLE", "RECT", "LINE", "POLYLINE", "POLYGON"].includes(el.tagName)) el = el.closest("svg") || el;
        if (isProtected(el)) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        selectElement(el);
        rememberOriginal(selectorFor(el), el);
        const existingTranslate = getComputedStyle(el).translate || "none";
        const values = existingTranslate === "none" ? [] : existingTranslate.match(/-?\d+(?:\.\d+)?/g) || [];
        const baseX = Number(values[0] || 0);
        const baseY = Number(values[1] || 0);
        dragState = { el, selector: selectorFor(el), pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, baseX, baseY, x: baseX, y: baseY, moved: false };
        try { el.setPointerCapture(event.pointerId); } catch { /* pointer capture is optional */ }
      }, true);
      document.addEventListener("pointermove", (event) => {
        if (!enabled || !dragState) return;
        const dx = event.clientX - dragState.startX;
        const dy = event.clientY - dragState.startY;
        if (!dragState.moved && Math.abs(dx) + Math.abs(dy) < 3) return;
        dragState.moved = true;
        dragState.x = Math.round(dragState.baseX + dx);
        dragState.y = Math.round(dragState.baseY + dy);
        dragState.el.style.translate = dragState.x + "px " + dragState.y + "px";
        dragState.el.dataset.codingStudioDragging = "true";
        event.preventDefault();
      }, true);
      document.addEventListener("pointerup", () => {
        if (!dragState) return;
        const finished = dragState;
        dragState = null;
        delete finished.el.dataset.codingStudioDragging;
        if (finished.moved) {
          finished.el.style.zIndex = String(Math.max(10, parseInt(getComputedStyle(finished.el).zIndex, 10) || 0));
          send("STUDIO_CHANGE", {
            selector: finished.selector,
            patch: { styles: { translate: finished.x + "px " + finished.y + "px", zIndex: finished.el.style.zIndex } }
          });
          send("STUDIO_SELECTED", { element: describe(finished.el) });
        }
      }, true);
      document.addEventListener("click", (event) => {
        if (!enabled || document.body.dataset.codingStudio !== "on") return;
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        let el = target.closest(editableSelector);
        if (!el || el === document.body || el === document.documentElement) return;
        if (["PATH", "CIRCLE", "RECT", "LINE", "POLYLINE", "POLYGON"].includes(el.tagName)) el = el.closest("svg") || el;
        if (isProtected(el)) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        selectElement(el);
      }, true);
      window.addEventListener("message", (event) => {
        if (event.origin !== parentOrigin || event.source !== window.parent || event.data?.type !== "STUDIO_COMMAND") return;
        const data = event.data;
        if (data.action === "setMode") {
          enabled = !!data.enabled;
          document.body.dataset.codingStudio = enabled ? "on" : "off";
          if (!enabled && selected) selected.removeAttribute("data-coding-studio-selected");
          return;
        }
        if (data.action === "restore") {
          resetPreviewEdits();
          Object.entries(data.edits || {}).forEach(([selector, edit]) => applyEdit(selector, edit));
          // Refresh the selected element's property controls after undo/redo restores styles or text.
          if (selected && selected.isConnected) send("STUDIO_SELECTED", { element: describe(selected) });
          return;
        }
        const el = data.action === "select" && data.selector
          ? find(data.selector)
          : (selected || (data.selector ? find(data.selector) : null));
        if (!el) return;
        if (data.action === "select") {
          selectElement(el);
          return;
        }
        if (isProtected(el) || (containsProtected(el) && (
          data.action === "delete" ||
          (data.action === "style" && hidesProtected({ styles: data.styles || {} }))
        ))) {
          send("STUDIO_PROTECTED_ELEMENT", { message: "مربع تغيير العملات محمي للحفاظ على وظائفه الأصلية." });
          return;
        }
        const selector = selectorFor(el);
        rememberOriginal(selector, el);
        const notify = (patch) => send("STUDIO_CHANGE", { selector, patch });
        if (data.action === "style") {
          applyStyles(el, data.styles || {});
          notify({ styles: data.styles || {} });
        } else if (data.action === "text") {
          applyText(el, data.text);
          notify({ text: data.text });
        } else if (data.action === "href") {
          const anchor = el.matches("a") ? el : el.closest("a");
          if (!anchor) {
            send("STUDIO_LINK_UNAVAILABLE", { message: "العنصر المحدد لا يحتوي على رابط قابل للتعديل." });
            return;
          }
          const requested = String(data.url || "").trim();
          const safe = safeLinkUrl(requested);
          if (requested && !safe) {
            send("STUDIO_LINK_UNAVAILABLE", { message: "الرابط يجب أن يكون مسارًا داخليًا أو HTTP/HTTPS." });
            return;
          }
          if (safe) anchor.setAttribute("href", safe);
          else anchor.removeAttribute("href");
          notify({ href: requested });
          send("STUDIO_SELECTED", { element: describe(el) });
        } else if (data.action === "delete") {
          el.style.display = "none";
          notify({ deleted: true });
        } else if (data.action === "duplicate") {
          const parent = el.parentElement;
          if (parent) {
            const clone = el.cloneNode(true);
            clone.removeAttribute("id");
            clone.removeAttribute("data-coding-studio-selected");
            clone.setAttribute("data-coding-studio-clone-of", selector);
            el.after(clone);
            const count = Array.from(parent.children).filter((item) =>
              item.getAttribute("data-coding-studio-clone-of") === selector).length;
            notify({ duplicateCount: count });
          }
        } else if ((data.action === "moveUp" || data.action === "moveDown") && el.parentElement) {
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
            notify({ order });
          }
        }
      });
      const meaningfulTags = new Set(["main", "header", "nav", "aside", "footer", "section", "article", "form", "button", "a", "input", "select", "textarea", "table", "thead", "tbody", "tr", "td", "th", "h1", "h2", "h3", "h4", "h5", "h6", "p", "img", "svg", "ul", "ol", "li", "label", "details", "summary"]);
      let scanTimer = null;
      const collectTreeAndRoutes = () => {
        let count = 0;
        const buildNode = (element, depth) => {
          if (!(element instanceof Element) || count >= 180 || depth > 5) return null;
          const tag = element.tagName.toLowerCase();
          if (["script", "style", "link", "meta", "noscript", "iframe"].includes(tag)) return null;
          count += 1;
          const childElements = Array.from(element.children).filter((child) =>
            !["script", "style", "link", "meta", "noscript", "iframe"].includes(child.tagName.toLowerCase()));
          const children = [];
          for (const child of childElements) {
            if (count >= 180) break;
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
        send("STUDIO_TREE", { nodes: nodes.slice(0, 80) });

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
          } catch (_) { /* ignore malformed links */ }
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
  }, [editMode, send]);

  const applyStyle = (styles: Record<string, string>) => {
    if (!selected) return;
    send({ action: "style", selector: selected.selector, styles });
  };
  const editText = (value: string) => {
    setTextValue(value);
    if (!selected) return;
    send({ action: "text", selector: selected.selector, text: value });
  };
  const action = (name: string, _patch?: StudioDomEdit) => {
    if (!selected) return;
    send({ action: name, selector: selected.selector });
  };
  const frameWidth = previewSize === "mobile" ? "390px" : previewSize === "tablet" ? "820px" : "100%";
  const selectedIsVector = !!selected && ["svg", "path", "circle", "rect", "line", "polyline", "polygon"].includes(selected.tag);
  const visibleTreeNodes = useMemo(() => {
    const query = treeFilter.trim().toLocaleLowerCase();
    if (!query) return treeNodes;
    const filterNodes = (nodes: LiveTreeNode[]): LiveTreeNode[] => nodes
      .map((node) => ({ ...node, children: filterNodes(node.children || []) }))
      .filter((node) => node.label.toLocaleLowerCase().includes(query) || node.tag.toLocaleLowerCase().includes(query) || node.children.length > 0);
    return filterNodes(treeNodes);
  }, [treeNodes, treeFilter]);
  const renderTreeNodes = (nodes: LiveTreeNode[], depth = 0): React.ReactNode => nodes.map((node) => (
    <div key={node.selector} className="min-w-0">
      <button
        type="button"
        title={node.selector}
        onClick={() => send({ action: "select", selector: node.selector })}
        className={"flex min-h-7 w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-right text-[11px] hover:bg-accent " + (selected?.selector === node.selector ? "bg-primary/10 font-black text-primary" : "text-foreground")}
        style={{ paddingRight: Math.min(18, depth * 7 + 6) + "px" }}
      >
        <span className="shrink-0 rounded bg-muted px-1 font-mono text-[9px] text-muted-foreground">{node.tag}</span>
        <span className="min-w-0 flex-1 truncate">{node.label}</span>
      </button>
      {node.children.length > 0 && <div className="mr-2 border-r border-border/70 pr-1">{renderTreeNodes(node.children, depth + 1)}</div>}
    </div>
  ));

  const navigatePreview = (href: string) => {
    if (!href.startsWith("/") || href.startsWith("//")) return;
    setCurrentRoute(href);
    setSelected(null);
    setFrameKey((value) => value + 1);
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background" dir="rtl">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-card px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Monitor size={16} /></span>
          <div className="min-w-0">
            <p className="truncate text-sm font-black">{designerMode ? "مصمم العناصر — معاينة التطبيق الفعلية" : "معاينة التطبيق الحقيقية"}</p>
            <p className="truncate text-[10px] text-muted-foreground" title={safeRoute}>{safeRoute} · {designerMode ? "تعديلات محلية — الحفظ يدوي" : "وضع العرض الفعلي"} · {status}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex rounded-lg border bg-background p-0.5">
            <Button type="button" size="sm" variant={previewSize === "desktop" ? "default" : "ghost"} className="h-7 px-2" onClick={() => setPreviewSize("desktop")} title="سطح المكتب"><Monitor size={14} /></Button>
            <Button type="button" size="sm" variant={previewSize === "tablet" ? "default" : "ghost"} className="h-7 px-2" onClick={() => setPreviewSize("tablet")} title="جهاز لوحي"><Tablet size={14} /></Button>
            <Button type="button" size="sm" variant={previewSize === "mobile" ? "default" : "ghost"} className="h-7 px-2" onClick={() => setPreviewSize("mobile")} title="هاتف"><Smartphone size={14} /></Button>
          </div>
          <Button type="button" size="sm" variant={editMode ? "default" : "outline"} className="h-7 gap-1 px-2 text-xs" onClick={() => setEditMode(v => !v)}>
            {editMode ? <EyeOff size={14} /> : <Eye size={14} />}{editMode ? "وضع التحرير" : "وضع التفاعل"}
          </Button>
          {designerMode && (
            <Button type="button" size="sm" variant={showAddItem ? "default" : "outline"} className="h-7 gap-1 px-2 text-xs" disabled={!selected} onClick={() => setShowAddItem(v => !v)} title={selected ? "إضافة عنصر في الموضع المحدد داخل الصفحة الفعلية" : "حدد الموضع أولًا داخل المعاينة"}>
              <Plus size={14} /> إضافة عنصر
            </Button>
          )}
          <Button type="button" size="sm" variant={showExplorer ? "default" : "outline"} className="h-7 gap-1 px-2 text-xs" onClick={() => setShowExplorer(v => !v)}><Layers size={14} /> {showExplorer ? "إخفاء الشجرة" : "الصفحات والشجرة"}</Button>
          <Button type="button" size="sm" variant={showProperties ? "default" : "outline"} className="h-7 gap-1 px-2 text-xs" onClick={() => setShowProperties(v => !v)}><Settings2 size={14} /> {showProperties ? "إخفاء الخصائص" : "الخصائص"}</Button>
          <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => setFrameKey(v => v + 1)}><RefreshCw size={14} /> تحديث</Button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {showAddItem && designerMode && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!selected) {
                setStatus("حدد موضعًا في الصفحة الفعلية أولًا.");
                return;
              }
              const cleanUrl = addedUrl.trim();
              const validUrl = !cleanUrl || (cleanUrl.startsWith("/") && !cleanUrl.startsWith("//")) || /^https?:\/\//i.test(cleanUrl);
              if (!validUrl) {
                setStatus("استخدم مسارًا داخليًا يبدأ بشرطة واحدة أو رابط HTTP/HTTPS.");
                return;
              }
              const item: StudioDomAddedItem = {
                id: "studio-added-" + Date.now().toString(36),
                type: addedType,
                name: addedName.trim() || "عنصر جديد",
                text: addedText.trim() || addedName.trim() || "عنصر جديد",
                placement: addedPlacement,
                action: addedAction,
                url: cleanUrl,
                message: addedMessage.trim(),
              };
              const previous = editsRef.current[selected.selector]?.additions || [];
              commitEdits(selected.selector, { additions: [...previous, item] });
              setShowAddItem(false);
              setStatus("تمت إضافة العنصر إلى معاينة المسودة. احفظ المسودة ثم انشرها عند اكتمال الاختبار.");
            }}
            className="absolute right-1/2 top-3 z-40 w-[min(440px,92%)] translate-x-1/2 space-y-3 rounded-2xl border bg-card/95 p-4 text-right shadow-2xl backdrop-blur"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-black">إضافة عنصر إلى الصفحة</h3>
                <p className="mt-1 text-[10px] text-muted-foreground">{selected ? "الموضع محدد من معاينة التطبيق الفعلية." : "انقر على موضع في الصفحة أولًا."}</p>
              </div>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => setShowAddItem(false)}>إغلاق</Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-bold">نوع العنصر
                <select value={addedType} onChange={(event) => setAddedType(event.target.value as StudioDomAddedItem["type"])} className="mt-1 h-9 w-full rounded-lg border bg-background px-2 font-normal">
                  <option value="text">نص</option><option value="button">زر</option><option value="input">حقل إدخال</option><option value="card">بطاقة</option><option value="divider">فاصل</option><option value="link">رابط</option>
                </select>
              </label>
              <label className="text-xs font-bold">مكان الإضافة
                <select value={addedPlacement} onChange={(event) => setAddedPlacement(event.target.value as StudioDomAddedItem["placement"])} className="mt-1 h-9 w-full rounded-lg border bg-background px-2 font-normal">
                  <option value="after">بعد العنصر المحدد</option><option value="inside">داخل العنصر المحدد</option>
                </select>
              </label>
            </div>
            <label className="block text-xs font-bold">اسم العنصر
              <input value={addedName} onChange={(event) => setAddedName(event.target.value)} className="mt-1 h-9 w-full rounded-lg border bg-background px-3 font-normal" placeholder="مثال: زر فتح التقارير" />
            </label>
            {addedType !== "divider" && <label className="block text-xs font-bold">النص أو التسمية
              <input value={addedText} onChange={(event) => setAddedText(event.target.value)} className="mt-1 h-9 w-full rounded-lg border bg-background px-3 font-normal" placeholder="النص الظاهر للمستخدم" />
            </label>}
            {(addedType === "button" || addedType === "link") && (
              <>
                <label className="block text-xs font-bold">وظيفة العنصر
                  <select value={addedAction} onChange={(event) => setAddedAction(event.target.value as NonNullable<StudioDomAddedItem["action"]>)} className="mt-1 h-9 w-full rounded-lg border bg-background px-2 font-normal">
                    <option value="none">دون ربط حتى الآن</option><option value="message">إظهار رسالة</option><option value="navigate">فتح صفحة داخل التطبيق</option><option value="external">فتح موقع خارجي</option>
                  </select>
                </label>
                {(addedAction === "navigate" || addedAction === "external") && <label className="block text-xs font-bold">المسار أو رابط الوجهة
                  <input value={addedUrl} onChange={(event) => setAddedUrl(event.target.value)} className="mt-1 h-9 w-full rounded-lg border bg-background px-3 font-normal" placeholder={addedAction === "navigate" ? "/admin/reports" : "https://example.com"} />
                </label>}
                {addedAction === "message" && <label className="block text-xs font-bold">الرسالة
                  <input value={addedMessage} onChange={(event) => setAddedMessage(event.target.value)} className="mt-1 h-9 w-full rounded-lg border bg-background px-3 font-normal" />
                </label>}
              </>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setShowAddItem(false)}>إلغاء</Button>
              <Button type="submit" size="sm" disabled={!selected}>إضافة للمعاينة</Button>
            </div>
          </form>
        )}
        {showExplorer && (
          <aside className="absolute right-0 top-[112px] bottom-0 z-20 flex w-[230px] max-w-[28vw] min-w-[190px] flex-col overflow-hidden rounded-tl-xl border-l border-t bg-card/95 shadow-2xl backdrop-blur">
            <div className="shrink-0 border-b p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-black">صفحات ومكونات التطبيق</h3>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{treeNodes.length}</span>
              </div>
              <p className="mt-1 text-[10px] leading-5 text-muted-foreground">الصفحات من روابط التطبيق الحقيقي، والشجرة من عناصر الصفحة المفتوحة.</p>
            </div>
            <section className="max-h-[34%] shrink-0 overflow-y-auto border-b p-2">
              <h4 className="mb-1.5 text-[11px] font-black">الصفحات المكتشفة</h4>
              <div className="space-y-1">
                {(pageLinks.length ? pageLinks : [{ href: safeRoute, label: "الصفحة الحالية" }]).map((page) => (
                  <button
                    key={page.href}
                    type="button"
                    title={page.href}
                    onClick={() => navigatePreview(page.href)}
                    className={"flex min-h-8 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-right text-[11px] " + (page.href === safeRoute ? "bg-primary/10 font-black text-primary" : "hover:bg-accent")}
                  >
                    <span className="min-w-0 flex-1 truncate">{page.label || page.href}</span>
                    <span className="max-w-[92px] truncate font-mono text-[9px] text-muted-foreground">{page.href}</span>
                  </button>
                ))}
              </div>
            </section>
            <section className="flex min-h-0 flex-1 flex-col p-2">
              <h4 className="mb-1.5 shrink-0 text-[11px] font-black">شجرة المكونات الفعلية</h4>
              <input aria-label="بحث في شجرة المكونات" value={treeFilter} onChange={(event) => setTreeFilter(event.target.value)} placeholder="ابحث عن عنصر أو وسم..." className="mb-2 h-8 shrink-0 rounded-lg border bg-background px-2 text-[11px] outline-none focus:ring-2 focus:ring-primary" />
              <div className="min-h-0 flex-1 overflow-auto">
                {visibleTreeNodes.length ? renderTreeNodes(visibleTreeNodes) : <p className="p-2 text-[11px] leading-5 text-muted-foreground">جاري استخراج شجرة عناصر الصفحة…</p>}
              </div>
            </section>
          </aside>
        )}
        <div className="absolute inset-0 flex min-h-0 min-w-0 items-stretch justify-center overflow-auto bg-slate-100 p-2 dark:bg-slate-950 sm:p-4">
          <div className="h-full min-h-0 overflow-hidden rounded-xl border bg-background shadow-xl transition-[width] duration-200" style={{ width: frameWidth, minWidth: previewSize === "desktop" ? 0 : frameWidth, flex: previewSize === "desktop" ? "1 1 auto" : "0 0 " + frameWidth }}>
            <iframe key={frameKey} ref={iframeRef} src={safeRoute} onLoad={installBridge} title="معاينة حية للتطبيق" className="h-full min-h-0 w-full border-0 bg-background" />
          </div>
        </div>
        {showProperties && (
        <aside className="absolute left-0 top-[112px] bottom-0 z-20 flex w-[280px] max-w-[32vw] min-w-[230px] flex-col gap-3 overflow-y-auto rounded-tr-xl border-r border-t bg-card/95 p-3 shadow-2xl backdrop-blur 2xl:w-[320px]">
          <div>
            <h3 className="text-sm font-black">خصائص عنصر التطبيق</h3>
            <p className="mt-1 text-[10px] text-muted-foreground">{selected ? "نوع العنصر: " + ({a: "رابط", button: "زر", input: "حقل إدخال", textarea: "حقل نصي", select: "قائمة اختيار", img: "صورة", h1: "عنوان", h2: "عنوان", h3: "عنوان", p: "نص", div: "حاوية", section: "قسم"}[selected.tag] || "عنصر") : "انقر على عنصر داخل المعاينة"}</p>
          </div>
          {selected ? (
            <>
              <div className="space-y-2 rounded-xl border p-3">
                <h4 className="text-xs font-black">الرابط الحالي والوجهة</h4>
                {selected.isLink ? (
                  <>
                    <input value={linkValue} onChange={(event) => setLinkValue(event.target.value)} placeholder="/مسار-داخلي أو https://..." className="h-9 w-full rounded-lg border bg-background px-2 text-xs font-normal" aria-label="الرابط الحالي" />
                    <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => {
                      const value = linkValue.trim();
                      if (value && !(value.startsWith("/") && !value.startsWith("//")) && !/^https?:\/\//i.test(value)) {
                        setStatus("الرابط يجب أن يكون مسارًا داخليًا أو HTTP/HTTPS.");
                        return;
                      }
                      send({ action: "href", url: value });
                      setStatus("تم تحديث الرابط في المعاينة المحلية.");
                    }}>تحديث الرابط الحالي</Button>
                  </>
                ) : <p className="text-[10px] leading-5 text-muted-foreground">العنصر المحدد لا يحتوي على رابط مباشر. لعرض روابط عنصر آخر، حدده من الصفحة. يمكن إضافة زر جديد مرتبط من «إضافة عنصر».</p>}
              </div>
              {!selectedIsVector && <label className="block text-xs font-bold">النص<textarea value={textValue} onChange={e => editText(e.target.value)} className="mt-1 min-h-16 w-full rounded-lg border bg-background p-2 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>}
              <div className="grid grid-cols-2 gap-2">
                {!selectedIsVector && <label className="text-xs">لون النص<input aria-label="لون النص" type="color" value={/^#[0-9a-f]{6}$/i.test(textColor) ? textColor : "#111827"} onChange={e => { setTextColor(e.target.value); applyStyle({ color: e.target.value }); }} className="mt-1 h-9 w-full rounded border bg-background p-1" /></label>}
                <label className="text-xs">{selectedIsVector ? "خلفية الأيقونة" : "لون الخلفية"}<input aria-label="لون الخلفية" type="color" value={/^#[0-9a-f]{6}$/i.test(backgroundColor) ? backgroundColor : "#ffffff"} onChange={e => { setBackgroundColor(e.target.value); applyStyle({ backgroundColor: e.target.value }); }} className="mt-1 h-9 w-full rounded border bg-background p-1" /></label>
              </div>

              {selectedIsVector && (
                <div className="rounded-xl border p-3 space-y-3">
                  <h4 className="text-xs font-black">تصميم الأيقونة / SVG</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs">لون التعبئة<input aria-label="لون تعبئة الأيقونة" type="color" value={fillColor} onChange={e => { setFillColor(e.target.value); applyStyle({ fill: e.target.value }); }} className="mt-1 h-9 w-full rounded border bg-background p-1" /></label>
                    <label className="text-xs">لون الخط<input aria-label="لون حد الأيقونة" type="color" value={strokeColor} onChange={e => { setStrokeColor(e.target.value); applyStyle({ stroke: e.target.value }); }} className="mt-1 h-9 w-full rounded border bg-background p-1" /></label>
                  </div>
                  <label className="block text-xs">سُمك رسم الأيقونة<input type="range" min="0.5" max="5" step="0.5" value={strokeWidth} onChange={e => { setStrokeWidth(e.target.value); applyStyle({ strokeWidth: e.target.value }); }} className="mt-2 w-full" /><span className="text-muted-foreground">{strokeWidth}px</span></label>
                  <label className="block text-xs">دوران الأيقونة<select value={iconRotation} onChange={e => { setIconRotation(e.target.value); applyStyle({ rotate: e.target.value }); }} className="mt-1 w-full rounded-lg border bg-background p-2"><option value="0deg">0°</option><option value="45deg">45°</option><option value="90deg">90°</option><option value="135deg">135°</option><option value="180deg">180°</option><option value="270deg">270°</option></select></label>
                  <label className="block text-xs">شكل خلفية الأيقونة<select onChange={e => {
                    const shape = e.target.value;
                    if (shape === "none") applyStyle({ backgroundColor: "transparent", borderRadius: "0px", padding: "0px" });
                    else if (shape === "circle") applyStyle({ backgroundColor: backgroundColor || "#ffffff", borderRadius: "50%", padding: "8px", display: "inline-block" });
                    else if (shape === "rounded") applyStyle({ backgroundColor: backgroundColor || "#ffffff", borderRadius: "12px", padding: "8px", display: "inline-block" });
                    else if (shape === "square") applyStyle({ backgroundColor: backgroundColor || "#ffffff", borderRadius: "0px", padding: "8px", display: "inline-block" });
                  }} className="mt-1 w-full rounded-lg border bg-background p-2"><option value="none">بدون خلفية</option><option value="circle">دائرة</option><option value="rounded">مربع مستدير</option><option value="square">مربع</option></select></label>
                </div>
              )}

              {!selectedIsVector && <>
                <label className="block text-xs">حجم الخط (px)<input type="number" min="8" max="120" value={fontSize} onChange={e => { setFontSize(e.target.value); applyStyle({ fontSize: e.target.value + "px" }); }} className="mt-1 w-full rounded-lg border bg-background p-2" /></label>
                <label className="block text-xs">سُمك الخط<select value={fontWeight} onChange={e => { setFontWeight(e.target.value); applyStyle({ fontWeight: e.target.value }); }} className="mt-1 w-full rounded-lg border bg-background p-2"><option value="300">خفيف</option><option value="400">عادي</option><option value="500">متوسط</option><option value="600">شبه عريض</option><option value="700">عريض</option><option value="900">ثقيل</option></select></label>
                <label className="block text-xs">محاذاة النص<select value={textAlign} onChange={e => { setTextAlign(e.target.value); applyStyle({ textAlign: e.target.value }); }} className="mt-1 w-full rounded-lg border bg-background p-2"><option value="right">يمين</option><option value="center">توسيط</option><option value="left">يسار</option><option value="justify">ضبط</option></select></label>
              </>}

              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">العرض<input value={width} placeholder="240px أو 100%" onChange={e => { setWidth(e.target.value); applyStyle({ width: e.target.value }); }} className="mt-1 w-full rounded-lg border bg-background p-2" /></label>
                <label className="text-xs">الارتفاع<input value={height} placeholder="80px أو auto" onChange={e => { setHeight(e.target.value); applyStyle({ height: e.target.value }); }} className="mt-1 w-full rounded-lg border bg-background p-2" /></label>
              </div>
              <label className="block text-xs">الشفافية<input type="range" min="0.1" max="1" step="0.05" value={opacity} onChange={e => { setOpacity(e.target.value); applyStyle({ opacity: e.target.value }); }} className="mt-2 w-full" /><span className="text-muted-foreground">{Math.round(Number(opacity) * 100)}%</span></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">استدارة الحواف<input value={borderRadius} placeholder="12px أو 50%" onChange={e => { setBorderRadius(e.target.value); applyStyle({ borderRadius: e.target.value }); }} className="mt-1 w-full rounded-lg border bg-background p-2" /></label>
                <label className="text-xs">الظل<select value={shadowStyle} onChange={e => { setShadowStyle(e.target.value); applyStyle({ boxShadow: e.target.value }); }} className="mt-1 w-full rounded-lg border bg-background p-2"><option value="none">بدون</option><option value="0 1px 3px rgba(0,0,0,.12)">خفيف</option><option value="0 4px 12px rgba(0,0,0,.16)">متوسط</option><option value="0 12px 32px rgba(0,0,0,.22)">قوي</option><option value="0 0 0 2px rgba(99,102,241,.35)">إطار مضيء</option></select></label>
              </div>
              <div className="rounded-lg bg-muted/60 p-2 text-[10px] leading-5 text-muted-foreground">حرّك العنصر بالسحب المباشر داخل المعاينة. تُحفظ التغييرات محليًا فورًا وتُزامن مع Supabase عند الضغط على «حفظ ومزامنة».</div>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => action("moveUp")}><ArrowUp size={14} /> ترتيب لأعلى</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => action("moveDown")}><ArrowDown size={14} /> ترتيب لأسفل</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => action("duplicate", { duplicateCount: Math.min(5, Number(edits[selected.selector]?.duplicateCount || 0) + 1) })}><Copy size={14} /> نسخ العنصر</Button>
                <Button type="button" size="sm" variant="destructive" onClick={() => action("delete", { deleted: true })}><Trash2 size={14} /> إخفاء العنصر</Button>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(null)}><Check size={14} /> إنهاء التحديد</Button>
            </>
          ) : (
            <div className="rounded-xl border border-dashed p-4 text-xs leading-6 text-muted-foreground">انقر على نص أو زر أو بطاقة من التطبيق نفسه. التعديلات تُحفظ محليًا وتظهر على صفحات هذا المتصفح؛ مزامنة Supabase من «حفظ ومزامنة»، والنشر لبقية المستخدمين خطوة منفصلة.</div>
          )}
          <div className="mt-auto rounded-lg bg-muted p-2 text-[10px] leading-5 text-muted-foreground">إذا ظهر خطأ مزامنة، تبقى النسخة المحلية موجودة لكن لا تعتبر محفوظة سحابيًا حتى نجاح التأكيد.</div>
        </aside>
        )}
      </div>
    </div>
  );
}