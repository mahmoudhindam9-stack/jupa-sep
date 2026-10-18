import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Copy, Save, Check, Trash2, ArrowUp, ArrowDown, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/developer-studio")({
  head: () => ({ meta: [{ title: "استوديو تعديل الواجهة" }] }),
  component: DeveloperStudioPage,
});

type Selection = {
  selector: string; tag: string; text: string; color: string; backgroundColor: string;
  fontSize: string; width: string; height: string; fontWeight: string;
};
type Edit = { text?: string; styles?: Record<string, string>; deleted?: boolean; duplicateCount?: number; moveBy?: number };

function DeveloperStudioPage() {
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [textValue, setTextValue] = useState("");
  const [color, setColor] = useState("#111827");
  const [background, setBackground] = useState("#ffffff");
  const [fontSize, setFontSize] = useState("16");
  const [fontWeight, setFontWeight] = useState("400");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [status, setStatus] = useState("اختر عنصرًا من المعاينة لبدء التعديل");

  const command = (data: Record<string, unknown>) => iframeRef.current?.contentWindow?.postMessage({ type: "STUDIO_COMMAND", ...data }, window.location.origin);
  const onMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin || !event.data) return;
    if (event.data.type === "STUDIO_SELECTED") {
      const item: Selection = event.data.element;
      setSelected(item); setTextValue(item.text || ""); setColor(item.color || "#111827");
      setBackground(item.backgroundColor || "#ffffff"); setFontSize(String(parseInt(item.fontSize, 10) || 16));
      setFontWeight(item.fontWeight || "400"); setWidth(item.width === "auto" ? "" : item.width || "");
      setHeight(item.height === "auto" ? "" : item.height || "");
    }
    if (event.data.type === "STUDIO_CHANGE") {
      const selector = String(event.data.selector || "");
      const patch = event.data.patch || {};
      setEdits((prev) => {
        const previous = prev[selector] || {};
        return {
          ...prev,
          [selector]: {
            ...previous,
            ...patch,
            ...(patch.styles
              ? { styles: { ...(previous.styles || {}), ...patch.styles } }
              : {}),
          },
        };
      });
    }
  };
  useEffect(() => {
    window.addEventListener("message", onMessage);
    try {
      const saved = JSON.parse(localStorage.getItem("custom_text_map") || "{}");
      setEdits(Object.fromEntries(Object.entries(saved).filter(([, value]) => value && typeof value === "object")) as Record<string, Edit>);
    } catch { /* Ignore invalid legacy preferences; saving below validates data. */ }
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const applyStyles = (styles: Record<string, string>) => {
    if (!selected) return;
    command({ action: "style", selector: selected.selector, styles });
    setEdits((prev) => ({
      ...prev,
      [selected.selector]: {
        ...(prev[selected.selector] || {}),
        styles: { ...(prev[selected.selector]?.styles || {}), ...styles },
      },
    }));
  };
  const applyText = (value: string) => {
    if (!selected) return;
    setTextValue(value); command({ action: "text", selector: selected.selector, text: value });
    setEdits((prev) => ({ ...prev, [selected.selector]: { ...(prev[selected.selector] || {}), text: value } }));
  };
  const save = (apply: boolean) => {
    try {
      const old = JSON.parse(localStorage.getItem("custom_text_map") || "{}");
      const merged = { ...old, ...edits };
      localStorage.setItem("custom_text_map", JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent("studio_legacy_edits_updated"));
      const check = JSON.parse(localStorage.getItem("custom_text_map") || "{}");
      if (Object.keys(edits).some((key) => JSON.stringify(check[key]) !== JSON.stringify(merged[key]))) throw new Error("تعذر التحقق من حفظ الإعدادات");
      setStatus(apply ? "تم الحفظ والتحقق — يجري تحديث المعاينة" : "تم الحفظ والتحقق محليًا");
      if (apply) iframeRef.current?.contentWindow?.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? "فشل الحفظ: " + error.message : "فشل حفظ التعديلات");
    }
  };
  const action = (name: string, patch?: Edit) => {
    if (!selected) return;
    command({ action: name, selector: selected.selector });
    if (patch) setEdits((prev) => ({ ...prev, [selected.selector]: { ...(prev[selected.selector] || {}), ...patch } }));
  };
  const handlePreviewLoad = () => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body || doc.getElementById("restocash-studio-bridge")) return;
    const css = doc.createElement("style");
    css.id = "restocash-studio-overlay";
    css.textContent = 'body[data-studio="on"] *{cursor:crosshair!important}body[data-studio="on"] *:hover{outline:1px dashed #6366f1!important;outline-offset:-1px}[data-studio-selected="true"]{outline:2px solid #6366f1!important;outline-offset:1px!important}';
    doc.head.appendChild(css); doc.body.dataset.studio = "on";
    const script = doc.createElement("script");
    script.id = "restocash-studio-bridge";
    script.textContent = `
      (()=>{const path=e=>{if(e.id&&!e.id.startsWith("radix-"))return "#"+CSS.escape(e.id);const a=[];let n=e;while(n&&n.nodeType===1&&n!==document.body){let p=n.tagName.toLowerCase(),r=n.parentElement;if(!r)break;const s=Array.from(r.children).filter(x=>x.tagName===n.tagName);if(s.length>1)p+=":nth-of-type("+(s.indexOf(n)+1)+")";a.unshift(p);n=r}return "body > "+a.join(" > ")};
      const describe=e=>{const c=getComputedStyle(e);return{selector:path(e),tag:e.tagName.toLowerCase(),text:(e.innerText||e.textContent||"").trim().slice(0,1000),color:c.color,backgroundColor:c.backgroundColor,fontSize:c.fontSize,width:e.style.width||"auto",height:e.style.height||"auto",fontWeight:c.fontWeight}};
      let selected=null;document.addEventListener("click",e=>{if(document.body.dataset.studio!=="on")return;const t=e.target instanceof Element?e.target:null;if(!t)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();if(selected)selected.removeAttribute("data-studio-selected");selected=t.closest("button,a,input,textarea,select,label,h1,h2,h3,h4,p,span,div,section,article,li,td,th")||t;selected.setAttribute("data-studio-selected","true");window.parent.postMessage({type:"STUDIO_SELECTED",element:describe(selected)},location.origin)},true);
      window.addEventListener("message",e=>{if(e.origin!==location.origin||e.data?.type!=="STUDIO_COMMAND")return;const d=e.data,x=selected||(d.selector?document.querySelector(d.selector):null);if(!x)return;const notify=p=>window.parent.postMessage({type:"STUDIO_CHANGE",selector:path(x),patch:p},location.origin);
      if(d.action==="style"){Object.entries(d.styles||{}).forEach(([k,v])=>x.style[k]=v);notify({styles:d.styles})}
      else if(d.action==="text"){const n=Array.from(x.childNodes).find(n=>n.nodeType===3&&n.textContent.trim());if(n)n.textContent=d.text;else if(!x.children.length)x.textContent=d.text;notify({text:d.text})}
      else if(d.action==="delete"){x.style.display="none";notify({deleted:true})}
      else if(d.action==="duplicate"){const c=x.cloneNode(true);c.removeAttribute("id");c.removeAttribute("data-studio-selected");c.dataset.studioCloneOf=path(x);x.after(c);notify({duplicateCount:1})}
      else if(d.action==="moveUp"&&x.previousElementSibling){x.parentElement.insertBefore(x,x.previousElementSibling);notify({moveBy:-1})}
      else if(d.action==="moveDown"&&x.nextElementSibling){x.parentElement.insertBefore(x.nextElementSibling,x);notify({moveBy:1})}
      });
      })();
    `;
    doc.body.appendChild(script);
  };

  return <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden" dir="rtl">
    <header className="h-14 shrink-0 border-b flex items-center justify-between px-3 sm:px-5 gap-3">
      <div className="min-w-0"><h1 className="font-black text-base">استوديو تعديل الواجهة</h1><p className="text-[11px] text-muted-foreground truncate">{status}</p></div>
      <div className="flex gap-2 shrink-0"><Button variant="outline" size="sm" onClick={()=>navigate({to:"/admin/system-update"})}><ArrowLeft size={14}/> رجوع</Button><Button variant="secondary" size="sm" onClick={()=>save(false)}><Save size={14}/> حفظ</Button><Button size="sm" onClick={()=>save(true)}><Check size={14}/> حفظ وتطبيق</Button></div>
    </header>
    <div className="flex flex-1 min-h-0">
      <aside className="w-[260px] sm:w-[320px] shrink-0 border-l p-3 overflow-y-auto space-y-3">
        <div><b className="text-sm">خصائص العنصر</b><p className="text-[11px] text-muted-foreground break-all mt-1">{selected ? `<${selected.tag}> · ${selected.selector}` : "اختر عنصرًا من المعاينة"}</p></div>
        {selected ? <>
          <label className="block text-xs font-bold">النص<textarea value={textValue} onChange={e=>applyText(e.target.value)} className="mt-1 w-full min-h-20 rounded-lg border bg-background p-2 font-normal"/></label>
          <div className="grid grid-cols-2 gap-2"><label className="text-xs">لون النص<input type="color" value={color} onChange={e=>{setColor(e.target.value);applyStyles({color:e.target.value})}} className="block w-full h-9"/></label><label className="text-xs">لون الخلفية<input type="color" value={background} onChange={e=>{setBackground(e.target.value);applyStyles({backgroundColor:e.target.value})}} className="block w-full h-9"/></label></div>
          <label className="block text-xs">حجم الخط (px)<input type="number" min="8" max="120" value={fontSize} onChange={e=>{setFontSize(e.target.value);applyStyles({fontSize:e.target.value+"px"})}} className="mt-1 w-full rounded border bg-background p-2"/></label>
          <label className="block text-xs">سُمك الخط<select value={fontWeight} onChange={e=>{setFontWeight(e.target.value);applyStyles({fontWeight:e.target.value})}} className="mt-1 w-full rounded border bg-background p-2"><option value="300">خفيف</option><option value="400">عادي</option><option value="500">متوسط</option><option value="600">شبه عريض</option><option value="700">عريض</option><option value="900">ثقيل</option></select></label>
          <div className="grid grid-cols-2 gap-2"><label className="text-xs">العرض<input value={width} placeholder="240px" onChange={e=>{setWidth(e.target.value);applyStyles({width:e.target.value})}} className="mt-1 w-full rounded border bg-background p-2"/></label><label className="text-xs">الارتفاع<input value={height} placeholder="80px" onChange={e=>{setHeight(e.target.value);applyStyles({height:e.target.value})}} className="mt-1 w-full rounded border bg-background p-2"/></label></div>
          <div className="grid grid-cols-2 gap-2"><Button variant="outline" size="sm" onClick={()=>action("moveUp",{moveBy:-1})}><ArrowUp size={14}/> نقل لأعلى</Button><Button variant="outline" size="sm" onClick={()=>action("moveDown",{moveBy:1})}><ArrowDown size={14}/> نقل لأسفل</Button><Button variant="outline" size="sm" onClick={()=>action("duplicate",{duplicateCount:1})}><Copy size={14}/> نسخ العنصر</Button><Button variant="destructive" size="sm" onClick={()=>action("delete",{deleted:true})}><Trash2 size={14}/> إخفاء العنصر</Button></div>
          <p className="text-[11px] text-muted-foreground leading-5">تظهر التغييرات مباشرة في المعاينة. الحفظ يخزن إعدادات الاستوديو في هذا المتصفح؛ لا يغيّر ملفات المصدر أو بقية الأجهزة.</p>
        </> : <p className="text-xs leading-6 text-muted-foreground">انقر على عنوان أو زر أو نص أو بطاقة داخل المعاينة. ستظهر هنا أدوات تغيير النص والألوان والأبعاد والنسخ والنقل والإخفاء.</p>}
      </aside>
      <main className="flex-1 min-w-0 bg-muted"><iframe ref={iframeRef} src="/admin" onLoad={handlePreviewLoad} title="معاينة التطبيق" className="w-full h-full border-0 bg-background"/></main>
    </div>
  </div>;
}
