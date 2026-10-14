import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, Copy, Eye, EyeOff, Monitor, RefreshCw, Smartphone, Tablet, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StudioDomEdit } from "../models/studio.types";

type SelectedDomElement = {
  selector: string; tag: string; text: string; color: string; backgroundColor: string;
  fontSize: string; fontWeight: string; width: string; height: string;
};
type Props = {
  route: string;
  initialEdits: Record<string, StudioDomEdit>;
  onEditsChange: (edits: Record<string, StudioDomEdit>) => void;
};
type PreviewSize = "desktop" | "tablet" | "mobile";

export function LiveAppPreview({ route, initialEdits, onEditsChange }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const editsRef = useRef<Record<string, StudioDomEdit>>(initialEdits || {});
  const changeCallbackRef = useRef(onEditsChange);
  const [selected, setSelected] = useState<SelectedDomElement | null>(null);
  const [textValue, setTextValue] = useState("");
  const [textColor, setTextColor] = useState("#111827");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [fontSize, setFontSize] = useState("16");
  const [fontWeight, setFontWeight] = useState("400");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [previewSize, setPreviewSize] = useState<PreviewSize>("desktop");
  const [editMode, setEditMode] = useState(true);
  const [frameKey, setFrameKey] = useState(0);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("جاري تحميل معاينة التطبيق…");
  const [edits, setEdits] = useState<Record<string, StudioDomEdit>>(initialEdits || {});
  editsRef.current = edits;
  changeCallbackRef.current = onEditsChange;

  const safeRoute = useMemo(() => {
    const value = (route || "/admin").trim();
    return value.startsWith("/") && !value.startsWith("//") ? value : "/admin";
  }, [route]);
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
    if (event.data.type === "STUDIO_SELECTED") {
      const item = event.data.element as SelectedDomElement;
      setSelected(item);
      setTextValue(item.text || "");
      setTextColor(item.color || "#111827");
      setBackgroundColor(item.backgroundColor || "#ffffff");
      setFontSize(String(parseInt(item.fontSize, 10) || 16));
      setFontWeight(item.fontWeight || "400");
      setWidth(item.width === "auto" ? "" : item.width || "");
      setHeight(item.height === "auto" ? "" : item.height || "");
      setStatus("تم تحديد العنصر: " + item.tag);
    } else if (event.data.type === "STUDIO_CHANGE") {
      commitEdits(String(event.data.selector), event.data.patch || {});
      setStatus("تم تعديل المعاينة — الحفظ التلقائي للمسودة جارٍ");
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
    setStatus("جاري تحميل الصفحة: " + safeRoute);
  }, [safeRoute, frameKey]);

  useEffect(() => {
    if (ready) send({ action: "setMode", enabled: editMode });
  }, [editMode, ready, send]);

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
      style.textContent = 'body[data-coding-studio="on"] *{cursor:crosshair!important}body[data-coding-studio="on"] *:hover{outline:1px dashed #6366f1!important;outline-offset:-1px}[data-coding-studio-selected="true"]{outline:2px solid #6366f1!important;outline-offset:1px!important}';
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
      const describe = (el) => {
        const css = getComputedStyle(el);
        return { selector: selectorFor(el), tag: el.tagName.toLowerCase(),
          text: (el.innerText || el.textContent || "").trim().slice(0, 1000),
          color: css.color, backgroundColor: css.backgroundColor, fontSize: css.fontSize,
          width: el.style.width || "auto", height: el.style.height || "auto", fontWeight: css.fontWeight };
      };
      const applyText = (el, value) => {
        const node = Array.from(el.childNodes).find((child) => child.nodeType === 3 && (child.textContent || "").trim());
        if (node) node.textContent = String(value);
        else if (!el.children.length) el.textContent = String(value);
        el.dataset.codingStudioTextApplied = String(value);
      };
      const applyEdit = (selector, edit) => {
        const el = find(selector);
        if (!el || !edit) return;
        if (edit.text !== undefined && el.dataset.codingStudioTextApplied !== String(edit.text)) applyText(el, edit.text);
        if (edit.styles && typeof edit.styles === "object") Object.entries(edit.styles).forEach(([key, value]) => {
          if (typeof value === "string" && key in el.style) el.style[key] = value;
        });
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
      };
      let selected = null;
      let enabled = true;
      document.body.dataset.codingStudio = "on";
      document.addEventListener("click", (event) => {
        if (!enabled || document.body.dataset.codingStudio !== "on") return;
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        const el = target.closest("button,a,input,textarea,select,label,h1,h2,h3,h4,h5,h6,p,span,div,section,article,li,td,th");
        if (!el || el === document.body || el === document.documentElement) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        if (selected) selected.removeAttribute("data-coding-studio-selected");
        selected = el;
        selected.setAttribute("data-coding-studio-selected", "true");
        send("STUDIO_SELECTED", { element: describe(selected) });
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
          Object.entries(data.edits || {}).forEach(([selector, edit]) => applyEdit(selector, edit));
          return;
        }
        const el = selected || (data.selector ? find(data.selector) : null);
        if (!el) return;
        const selector = selectorFor(el);
        const notify = (patch) => send("STUDIO_CHANGE", { selector, patch });
        if (data.action === "style") {
          Object.entries(data.styles || {}).forEach(([key, value]) => { if (typeof value === "string" && key in el.style) el.style[key] = value; });
          notify({ styles: data.styles || {} });
        } else if (data.action === "text") {
          applyText(el, data.text);
          notify({ text: data.text });
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
      send("STUDIO_BRIDGE_READY", {});
    })();`;
    doc.body.appendChild(script);
  }, [editMode, send]).toString();
    doc.body.appendChild(script);
  }, [editMode, send]);

  const applyStyle = (styles: Record<string, string>) => {
    if (!selected) return;
    send({ action: "style", selector: selected.selector, styles });
    commitEdits(selected.selector, { styles: { ...(editsRef.current[selected.selector]?.styles || {}), ...styles } });
  };
  const editText = (value: string) => {
    setTextValue(value);
    if (!selected) return;
    send({ action: "text", selector: selected.selector, text: value });
    commitEdits(selected.selector, { text: value });
  };
  const action = (name: string, patch?: StudioDomEdit) => {
    if (!selected) return;
    send({ action: name, selector: selected.selector });
    if (patch) commitEdits(selected.selector, patch);
  };
  const frameWidth = previewSize === "mobile" ? "390px" : previewSize === "tablet" ? "820px" : "100%";

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background" dir="rtl">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-card px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Monitor size={16} /></span>
          <div className="min-w-0">
            <p className="truncate text-sm font-black">معاينة التطبيق الحقيقية</p>
            <p className="truncate text-[10px] text-muted-foreground" title={safeRoute}>{safeRoute} · {status}</p>
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
          <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => setFrameKey(v => v + 1)}><RefreshCw size={14} /> تحديث</Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 items-stretch justify-center overflow-auto bg-slate-100 p-2 dark:bg-slate-950 sm:p-4">
          <div className="h-full min-h-[420px] max-w-full overflow-hidden rounded-xl border bg-background shadow-xl transition-[width] duration-200" style={{ width: frameWidth, flex: previewSize === "desktop" ? "1 1 auto" : "0 0 " + frameWidth }}>
            <iframe key={frameKey} ref={iframeRef} src={safeRoute} onLoad={installBridge} title="معاينة حية للتطبيق" className="h-full min-h-[420px] w-full border-0 bg-background" />
          </div>
        </div>
        <aside className="flex w-[270px] shrink-0 flex-col gap-3 overflow-y-auto border-r bg-card p-3 sm:w-[320px]">
          <div>
            <h3 className="text-sm font-black">خصائص عنصر التطبيق</h3>
            <p className="mt-1 break-all text-[10px] text-muted-foreground">{selected ? "<" + selected.tag + "> · " + selected.selector : "انقر على عنصر داخل المعاينة"}</p>
          </div>
          {selected ? (
            <>
              <label className="block text-xs font-bold">النص<textarea value={textValue} onChange={e => editText(e.target.value)} className="mt-1 min-h-20 w-full rounded-lg border bg-background p-2 font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">لون النص<input aria-label="لون النص" type="color" value={textColor} onChange={e => { setTextColor(e.target.value); applyStyle({ color: e.target.value }); }} className="mt-1 h-9 w-full rounded border bg-background p-1" /></label>
                <label className="text-xs">الخلفية<input aria-label="لون الخلفية" type="color" value={backgroundColor} onChange={e => { setBackgroundColor(e.target.value); applyStyle({ backgroundColor: e.target.value }); }} className="mt-1 h-9 w-full rounded border bg-background p-1" /></label>
              </div>
              <label className="block text-xs">حجم الخط (px)<input type="number" min="8" max="120" value={fontSize} onChange={e => { setFontSize(e.target.value); applyStyle({ fontSize: e.target.value + "px" }); }} className="mt-1 w-full rounded-lg border bg-background p-2" /></label>
              <label className="block text-xs">سُمك الخط<select value={fontWeight} onChange={e => { setFontWeight(e.target.value); applyStyle({ fontWeight: e.target.value }); }} className="mt-1 w-full rounded-lg border bg-background p-2"><option value="300">خفيف</option><option value="400">عادي</option><option value="500">متوسط</option><option value="600">شبه عريض</option><option value="700">عريض</option><option value="900">ثقيل</option></select></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">العرض<input value={width} placeholder="240px أو 100%" onChange={e => { setWidth(e.target.value); applyStyle({ width: e.target.value }); }} className="mt-1 w-full rounded-lg border bg-background p-2" /></label>
                <label className="text-xs">الارتفاع<input value={height} placeholder="80px أو auto" onChange={e => { setHeight(e.target.value); applyStyle({ height: e.target.value }); }} className="mt-1 w-full rounded-lg border bg-background p-2" /></label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => action("moveUp")}><ArrowUp size={14} /> نقل لأعلى</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => action("moveDown")}><ArrowDown size={14} /> نقل لأسفل</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => action("duplicate", { duplicateCount: Math.min(5, Number(edits[selected.selector]?.duplicateCount || 0) + 1) })}><Copy size={14} /> نسخ العنصر</Button>
                <Button type="button" size="sm" variant="destructive" onClick={() => action("delete", { deleted: true })}><Trash2 size={14} /> إخفاء العنصر</Button>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(null)}><Check size={14} /> إنهاء التحديد</Button>
            </>
          ) : (
            <div className="rounded-xl border border-dashed p-4 text-xs leading-6 text-muted-foreground">انقر على نص أو زر أو بطاقة من التطبيق نفسه. التعديلات تُحفظ داخل المسودة، ولا تصبح معتمدة لبقية المستخدمين إلا بعد تأكيد النشر من الخادم.</div>
          )}
          <div className="mt-auto rounded-lg bg-muted p-2 text-[10px] leading-5 text-muted-foreground">إذا ظهر خطأ مزامنة، تبقى النسخة المحلية موجودة لكن لا تعتبر محفوظة سحابيًا حتى نجاح التأكيد.</div>
        </aside>
      </div>
    </div>
  );
}