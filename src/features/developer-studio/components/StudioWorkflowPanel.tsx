import React, { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowRight, Plus, Route, Trash2, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { StudioActionConfig, StudioActionStep, StudioAddedButton, StudioDomEdit } from "../models/studio.types";

export interface WorkflowTreeNode {
  selector: string;
  tag: string;
  label: string;
  children: WorkflowTreeNode[];
}
export interface WorkflowPageLink {
  href: string;
  label: string;
}
export interface WorkflowSelectedElement {
  selector: string;
  tag: string;
  text: string;
  href?: string;
  containerSelector?: string;
}
interface Props {
  selected: WorkflowSelectedElement | null;
  treeNodes: WorkflowTreeNode[];
  pageLinks: WorkflowPageLink[];
  edits: Record<string, StudioDomEdit>;
  onUpdateEdit: (selector: string, patch: StudioDomEdit) => void;
}

const ACTION_OPTIONS: Array<{ value: StudioActionConfig["type"]; label: string }> = [
  { value: "none", label: "بدون إجراء إضافي" },
  { value: "navigate", label: "الانتقال إلى صفحة" },
  { value: "message", label: "عرض رسالة" },
  { value: "toggle", label: "إظهار أو إخفاء عنصر" },
  { value: "set_value", label: "تغيير قيمة عنصر" },
  { value: "calculate", label: "حساب معادلة وعرض النتيجة" },
  { value: "sequence", label: "مسار من عدة خطوات" },
];
const TAG_NAMES: Record<string, string> = {
  button: "زر", a: "رابط", input: "حقل إدخال", textarea: "مربع كتابة", select: "قائمة اختيار",
  label: "عنوان حقل", h1: "عنوان رئيسي", h2: "عنوان", h3: "عنوان فرعي", h4: "عنوان فرعي",
  p: "فقرة نصية", span: "نص", div: "منطقة", section: "قسم", article: "بطاقة محتوى",
  main: "المحتوى الرئيسي", nav: "شريط تنقل", aside: "لوحة جانبية", header: "رأس الصفحة",
  footer: "تذييل الصفحة", li: "عنصر قائمة", ul: "قائمة", ol: "قائمة مرقمة", table: "جدول",
  tr: "صف جدول", td: "خلية جدول", th: "عنوان جدول", img: "صورة", svg: "أيقونة",
  form: "نموذج", strong: "نص بارز", small: "نص صغير",
};
const friendlyTag = (tag: string) => TAG_NAMES[tag.toLowerCase()] || "عنصر";

function friendlyName(node: WorkflowTreeNode): string {
  const label = String(node.label || "").trim();
  const rawTag = node.tag.toLowerCase();
  if (label && label.toLowerCase() !== rawTag && !/^[A-Z][A-Z0-9-]*$/.test(label)) return label;
  return friendlyTag(node.tag);
}

function flatten(nodes: WorkflowTreeNode[]): Array<{ selector: string; tag: string; label: string }> {
  const result: Array<{ selector: string; tag: string; label: string }> = [];
  const visit = (items: WorkflowTreeNode[]) => items.forEach((item) => {
    result.push({ selector: item.selector, tag: item.tag, label: friendlyName(item) });
    visit(item.children || []);
  });
  visit(nodes || []);
  return result;
}

function friendlyRoute(path: string, label: string): string {
  const known: Record<string, string> = {
    "/admin": "لوحة الإدارة الرئيسية",
    "/admin/ledger": "الإدارة المالية",
    "/admin/hr": "الموارد البشرية",
    "/admin/inventory": "المخزون والمستودعات",
    "/admin/restaurant": "إدارة المطعم",
    "/admin/mall": "إدارة المول",
    "/admin/park": "إدارة الحديقة",
    "/admin/system-update": "خيارات المطوّر",
    "/admin/orders": "الطلبات",
    "/admin/menu": "قائمة الطعام",
    "/login": "تسجيل الدخول",
  };
  return known[path] || label || path.split("/").filter(Boolean).pop()?.replace(/[-_]/g, " ") || "صفحة";
}

function makeDefaultAction(): StudioActionConfig {
  return { type: "none" };
}

export function StudioWorkflowPanel({ selected, treeNodes, pageLinks, edits, onUpdateEdit }: Props) {
  const [selectedAddedButtonId, setSelectedAddedButtonId] = useState("");
  const [customHref, setCustomHref] = useState("");
  const nodes = useMemo(() => flatten(treeNodes), [treeNodes]);
  const hostSelector = selected?.containerSelector || selected?.selector || "";
  const hostEdit = hostSelector ? edits[hostSelector] || {} : {};
  const addedButtons = hostEdit.addedButtons || [];
  const addedButton = addedButtons.find((item) => item.id === selectedAddedButtonId) || null;
  const selectedEdit = selected ? edits[selected.selector] || {} : {};
  const action = (addedButton?.action || selectedEdit.action || makeDefaultAction()) as StudioActionConfig;
  const targetList = nodes.filter((node) => node.selector !== selected?.selector);
  const selectedLabel = selected ? (selected.text?.trim() || friendlyTag(selected.tag)) : "لم يتم اختيار عنصر";

  useEffect(() => {
    setSelectedAddedButtonId("");
    setCustomHref(selected?.href || selectedEdit.href || "");
  }, [selected?.selector]);

  const updateAction = (patch: Partial<StudioActionConfig>) => {
    const next = { ...action, ...patch };
    if (addedButton) {
      onUpdateEdit(hostSelector, {
        addedButtons: addedButtons.map((item) => item.id === addedButton.id ? { ...item, action: next } : item),
      });
    } else if (selected) {
      onUpdateEdit(selected.selector, { action: next });
    }
  };

  const updateStep = (stepId: string, patch: Partial<StudioActionStep>) => {
    updateAction({
      steps: (action.steps || []).map((step) => step.id === stepId ? { ...step, ...patch } : step),
    });
  };
  const addStep = () => {
    const next: StudioActionStep = {
      id: "studio_step_" + Date.now().toString(36),
      type: "message",
      message: "اكتب الرسالة هنا",
    };
    updateAction({ type: "sequence", steps: [...(action.steps || []), next] });
  };
  const removeStep = (stepId: string) => {
    updateAction({ steps: (action.steps || []).filter((step) => step.id !== stepId) });
  };

  const updateAddedButton = (patch: Partial<StudioAddedButton>) => {
    if (!addedButton) return;
    onUpdateEdit(hostSelector, {
      addedButtons: addedButtons.map((item) => item.id === addedButton.id ? { ...item, ...patch } : item),
    });
  };

  const addButton = () => {
    if (!hostSelector) return;
    const id = "studio_button_" + Date.now().toString(36);
    const next: StudioAddedButton = {
      id,
      label: "زر جديد",
      variant: "primary",
      action: makeDefaultAction(),
    };
    onUpdateEdit(hostSelector, { addedButtons: [...addedButtons, next] });
    setSelectedAddedButtonId(id);
  };

  const removeAddedButton = (id: string) => {
    if (!hostSelector) return;
    onUpdateEdit(hostSelector, { addedButtons: addedButtons.filter((item) => item.id !== id) });
    if (selectedAddedButtonId === id) setSelectedAddedButtonId("");
  };

  const activeActionLabel = ACTION_OPTIONS.find((item) => item.value === action.type)?.label || "بدون إجراء";
  const destinationLabel = action.type === "navigate"
    ? friendlyRoute(action.destination || "", pageLinks.find((page) => page.href === action.destination)?.label || action.destination || "اختر صفحة")
    : action.type === "message" ? "رسالة تظهر للمستخدم"
      : action.type === "toggle" ? (targetList.find((node) => node.selector === action.targetSelector)?.label || "العنصر المختار")
        : action.type === "set_value" ? (targetList.find((node) => node.selector === action.targetSelector)?.label || "العنصر المختار")
          : action.type === "calculate" ? (targetList.find((node) => node.selector === action.resultSelector)?.label || "مكان النتيجة")
            : action.type === "sequence" ? ((action.steps || []).length ? "مسار يحتوي على " + action.steps!.length + " خطوات" : "أضف الخطوة الأولى")
              : "لا توجد نتيجة محددة";

  const linkTarget = selected ? (selectedEdit.href ?? selected.href ?? "") : "";
  const saveLink = (href: string) => {
    setCustomHref(href);
    if (selected) onUpdateEdit(selected.selector, { href, action: href ? { type: "navigate", destination: href } : { type: "none" } });
  };

  return (
    <section className="space-y-3 rounded-xl border border-primary/20 bg-card p-3 text-right">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Workflow size={16} /></span>
        <div>
          <h3 className="text-sm font-black">الوظائف والربط والمسارات</h3>
          <p className="text-[10px] leading-5 text-muted-foreground">حدد ما الذي يحدث عند الضغط، ثم اتبع المسار إلى النتيجة.</p>
        </div>
      </div>

      <Button type="button" size="sm" onClick={addButton} disabled={!hostSelector} className="w-full gap-2">
        <Plus size={14} /> إضافة زر جديد إلى المنطقة المحددة
      </Button>

      {addedButtons.length > 0 && (
        <div className="space-y-1.5 rounded-lg bg-muted/40 p-2">
          <p className="text-[11px] font-bold">الأزرار المضافة</p>
          {addedButtons.map((item) => (
            <div key={item.id} className={"flex items-center gap-1 rounded-lg border p-1 " + (item.id === selectedAddedButtonId ? "border-primary bg-primary/5" : "border-border bg-background")}>
              <button type="button" onClick={() => setSelectedAddedButtonId(item.id)} className="min-w-0 flex-1 truncate px-2 py-1 text-right text-xs font-semibold">
                {item.label || "زر جديد"}
              </button>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="حذف الزر" onClick={() => removeAddedButton(item.id)}><Trash2 size={13} /></Button>
            </div>
          ))}
        </div>
      )}

      {!selected && !addedButton ? (
        <p className="rounded-lg border border-dashed p-3 text-xs leading-6 text-muted-foreground">اختر زرًا أو مربعًا من المعاينة أو من شجرة العناصر لبدء إعداد الوظيفة.</p>
      ) : (
        <>
          {addedButton ? (
            <div className="space-y-2 rounded-lg border p-2">
              <p className="text-xs font-black">إعداد الزر الجديد</p>
              <label className="block text-xs font-semibold">النص الظاهر على الزر
                <Input value={addedButton.label} onChange={(event) => updateAddedButton({ label: event.target.value })} className="mt-1 text-right" placeholder="مثال: عرض الإجمالي" />
              </label>
              <label className="block text-xs font-semibold">شكل الزر
                <select value={addedButton.variant || "primary"} onChange={(event) => updateAddedButton({ variant: event.target.value as StudioAddedButton["variant"] })} className="mt-1 w-full rounded-lg border bg-background p-2 text-xs">
                  <option value="primary">أساسي</option>
                  <option value="secondary">ثانوي</option>
                  <option value="outline">بإطار</option>
                  <option value="danger">تحذيري</option>
                </select>
              </label>
            </div>
          ) : (
            <div className="rounded-lg bg-muted/40 p-2">
              <p className="text-[10px] text-muted-foreground">العنصر المحدد</p>
              <p className="truncate text-xs font-bold">{selectedLabel}</p>
              <p className="text-[10px] text-muted-foreground">{friendlyTag(selected?.tag || "")}</p>
            </div>
          )}

          {!addedButton && selected && ["a", "button"].includes(selected.tag.toLowerCase()) && (
            <div className="space-y-2 rounded-lg border p-2">
              <p className="text-xs font-black">الرابط الحالي وإمكانية تغييره</p>
              <p className="break-words text-[10px] text-muted-foreground">{linkTarget ? "هذا العنصر مرتبط حاليًا بصفحة أو رابط." : "لم يتم العثور على رابط مباشر لهذا العنصر؛ يمكنك إضافة ربط جديد."}</p>
              {pageLinks.length > 0 && (
                <label className="block text-xs font-semibold">اختر صفحة
                  <select value={customHref} onChange={(event) => saveLink(event.target.value)} className="mt-1 w-full rounded-lg border bg-background p-2 text-xs">
                    <option value="">بدون رابط إضافي</option>
                    {pageLinks.map((page) => <option key={page.href} value={page.href}>{friendlyRoute(page.href, page.label)}</option>)}
                  </select>
                </label>
              )}
              <label className="block text-xs font-semibold">أو اكتب مسار صفحة داخل التطبيق
                <Input value={customHref} onChange={(event) => saveLink(event.target.value)} className="mt-1 text-left" placeholder="/admin/ledger" dir="ltr" />
              </label>
              <p className="text-[10px] leading-5 text-muted-foreground">يمكنك استخدام الصفحات الموجودة حاليًا أو تعديل الرابط. لن تُنفذ روابط خارجية عبر هذا الحقل.</p>
            </div>
          )}

          <div className="space-y-2 rounded-lg border p-2">
            <p className="text-xs font-black">ماذا يحدث عند الضغط؟</p>
            <label className="block text-xs font-semibold">وظيفة الزر أو العنصر
              <select value={action.type} onChange={(event) => updateAction({ type: event.target.value as StudioActionConfig["type"] })} className="mt-1 w-full rounded-lg border bg-background p-2 text-xs">
                {ACTION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            {action.type === "navigate" && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold">الصفحة التي سيتم فتحها
                  <select value={action.destination || ""} onChange={(event) => updateAction({ destination: event.target.value })} className="mt-1 w-full rounded-lg border bg-background p-2 text-xs">
                    <option value="">اختر صفحة</option>
                    {pageLinks.map((page) => <option key={page.href} value={page.href}>{friendlyRoute(page.href, page.label)}</option>)}
                  </select>
                </label>
                <Input value={action.destination || ""} onChange={(event) => updateAction({ destination: event.target.value })} placeholder="أو اكتب مسارًا مثل /admin/ledger" dir="ltr" className="text-left" />
              </div>
            )}

            {action.type === "message" && (
              <label className="block text-xs font-semibold">الرسالة التي ستظهر
                <Textarea value={action.message || ""} onChange={(event) => updateAction({ message: event.target.value })} className="mt-1 text-right" rows={3} placeholder="اكتب رسالة واضحة للمستخدم..." />
              </label>
            )}

            {action.type === "toggle" && (
              <label className="block text-xs font-semibold">العنصر المراد إظهاره أو إخفاؤه
                <select value={action.targetSelector || ""} onChange={(event) => updateAction({ targetSelector: event.target.value })} className="mt-1 w-full rounded-lg border bg-background p-2 text-xs">
                  <option value="">اختر عنصرًا من الشجرة</option>
                  {targetList.map((node) => <option key={node.selector} value={node.selector}>{node.label} — {friendlyTag(node.tag)}</option>)}
                </select>
              </label>
            )}

            {action.type === "set_value" && (
              <>
                <label className="block text-xs font-semibold">العنصر الذي سيتغير
                  <select value={action.targetSelector || ""} onChange={(event) => updateAction({ targetSelector: event.target.value })} className="mt-1 w-full rounded-lg border bg-background p-2 text-xs">
                    <option value="">اختر حقلًا أو نصًا</option>
                    {targetList.map((node) => <option key={node.selector} value={node.selector}>{node.label} — {friendlyTag(node.tag)}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-semibold">القيمة الجديدة
                  <Input value={action.value || ""} onChange={(event) => updateAction({ value: event.target.value })} className="mt-1 text-right" placeholder="القيمة التي ستظهر" />
                </label>
              </>
            )}

            {action.type === "calculate" && (
              <div className="space-y-2">
                <p className="text-[10px] leading-5 text-muted-foreground">اختر مصدرَي القيمتين. يمكنك استخدام المعادلة a + b أو a * 1.14، حيث a القيمة الأولى وb القيمة الثانية.</p>
                <label className="block text-xs font-semibold">القيمة الأولى (a)
                  <select value={action.leftSelector || ""} onChange={(event) => updateAction({ leftSelector: event.target.value })} className="mt-1 w-full rounded-lg border bg-background p-2 text-xs">
                    <option value="">استخدم صفرًا</option>
                    {targetList.map((node) => <option key={node.selector} value={node.selector}>{node.label} — {friendlyTag(node.tag)}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-semibold">القيمة الثانية (b)
                  <select value={action.rightSelector || ""} onChange={(event) => updateAction({ rightSelector: event.target.value })} className="mt-1 w-full rounded-lg border bg-background p-2 text-xs">
                    <option value="">استخدم صفرًا</option>
                    {targetList.map((node) => <option key={node.selector} value={node.selector}>{node.label} — {friendlyTag(node.tag)}</option>)}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-xs font-semibold">العملية الأساسية
                    <select value={action.operator || "+"} onChange={(event) => updateAction({ operator: event.target.value as StudioActionConfig["operator"], formula: "" })} className="mt-1 w-full rounded-lg border bg-background p-2 text-xs">
                      <option value="+">جمع (+)</option>
                      <option value="-">طرح (−)</option>
                      <option value="*">ضرب (×)</option>
                      <option value="/">قسمة (÷)</option>
                      <option value="%">باقي القسمة (%)</option>
                    </select>
                  </label>
                  <label className="block text-xs font-semibold">معادلة متقدمة (اختياري)
                    <Input value={action.formula || ""} onChange={(event) => updateAction({ formula: event.target.value })} placeholder="a * 1.14 + b" className="mt-1 text-left" dir="ltr" />
                  </label>
                </div>
                <label className="block text-xs font-semibold">أين تظهر النتيجة؟
                  <select value={action.resultSelector || ""} onChange={(event) => updateAction({ resultSelector: event.target.value })} className="mt-1 w-full rounded-lg border bg-background p-2 text-xs">
                    <option value="">اختر مكان النتيجة</option>
                    {targetList.map((node) => <option key={node.selector} value={node.selector}>{node.label} — {friendlyTag(node.tag)}</option>)}
                  </select>
                </label>
              </div>
            )}
            {action.type === "sequence" && (
              <div className="space-y-2">
                <p className="text-[10px] leading-5 text-muted-foreground">أضف الخطوات بالترتيب. سينفذ الزر كل خطوة من الأعلى إلى الأسفل، ويمكنك تعديلها أو حذفها في أي وقت.</p>
                <Button type="button" size="sm" variant="outline" className="w-full gap-1" onClick={addStep}><Plus size={13} /> إضافة خطوة تالية</Button>
                {(action.steps || []).map((step, index) => (
                  <div key={step.id} className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black">الخطوة {index + 1}</p>
                      <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => removeStep(step.id)}><Trash2 size={13} /> حذف</Button>
                    </div>
                    <label className="block text-xs font-semibold">ما الذي يحدث في هذه الخطوة؟
                      <select value={step.type} onChange={(event) => updateStep(step.id, { type: event.target.value as StudioActionStep["type"] })} className="mt-1 w-full rounded-lg border bg-background p-2 text-xs">
                        {ACTION_OPTIONS.filter((option) => option.value !== "none" && option.value !== "sequence").map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                    {step.type === "navigate" && (
                      <>
                        <label className="block text-xs font-semibold">الصفحة المقصودة
                          <select value={step.destination || ""} onChange={(event) => updateStep(step.id, { destination: event.target.value })} className="mt-1 w-full rounded-lg border bg-background p-2 text-xs">
                            <option value="">اختر صفحة</option>
                            {pageLinks.map((page) => <option key={page.href} value={page.href}>{friendlyRoute(page.href, page.label)}</option>)}
                          </select>
                        </label>
                        <Input value={step.destination || ""} onChange={(event) => updateStep(step.id, { destination: event.target.value })} placeholder="مسار داخلي مثل /admin/ledger" dir="ltr" className="text-left" />
                      </>
                    )}
                    {step.type === "message" && <Textarea rows={2} value={step.message || ""} onChange={(event) => updateStep(step.id, { message: event.target.value })} placeholder="اكتب الرسالة..." className="text-right" />}
                    {(step.type === "toggle" || step.type === "set_value") && (
                      <label className="block text-xs font-semibold">العنصر المرتبط
                        <select value={step.targetSelector || ""} onChange={(event) => updateStep(step.id, { targetSelector: event.target.value })} className="mt-1 w-full rounded-lg border bg-background p-2 text-xs">
                          <option value="">اختر عنصرًا</option>
                          {targetList.map((node) => <option key={node.selector} value={node.selector}>{node.label} — {friendlyTag(node.tag)}</option>)}
                        </select>
                      </label>
                    )}
                    {step.type === "set_value" && <Input value={step.value || ""} onChange={(event) => updateStep(step.id, { value: event.target.value })} placeholder="القيمة الجديدة" />}
                    {step.type === "calculate" && (
                      <>
                        <label className="block text-xs font-semibold">المعادلة
                          <Input value={step.formula || ""} onChange={(event) => updateStep(step.id, { formula: event.target.value })} placeholder="a + b أو a * 1.14" dir="ltr" className="mt-1 text-left" />
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="block text-xs">القيمة الأولى
                            <select value={step.leftSelector || ""} onChange={(event) => updateStep(step.id, { leftSelector: event.target.value })} className="mt-1 w-full rounded-lg border bg-background p-2 text-xs">
                              <option value="">صفر</option>{targetList.map((node) => <option key={node.selector} value={node.selector}>{node.label}</option>)}
                            </select>
                          </label>
                          <label className="block text-xs">القيمة الثانية
                            <select value={step.rightSelector || ""} onChange={(event) => updateStep(step.id, { rightSelector: event.target.value })} className="mt-1 w-full rounded-lg border bg-background p-2 text-xs">
                              <option value="">صفر</option>{targetList.map((node) => <option key={node.selector} value={node.selector}>{node.label}</option>)}
                            </select>
                          </label>
                        </div>
                        <label className="block text-xs font-semibold">مكان النتيجة
                          <select value={step.resultSelector || ""} onChange={(event) => updateStep(step.id, { resultSelector: event.target.value })} className="mt-1 w-full rounded-lg border bg-background p-2 text-xs">
                            <option value="">اختر عنصرًا</option>{targetList.map((node) => <option key={node.selector} value={node.selector}>{node.label}</option>)}
                          </select>
                        </label>
                      </>
                    )}
                  </div>
                ))}
                {!(action.steps || []).length && <p className="rounded-lg border border-dashed p-3 text-center text-[11px] text-muted-foreground">ابدأ بإضافة أول خطوة إلى المسار.</p>}
              </div>
            )}
          </div>

          <div className="space-y-1 rounded-lg border border-primary/20 bg-primary/5 p-2">
            <div className="flex items-center gap-2 text-[11px] font-black"><Route size={14} /> مسار الوظيفة</div>
            <div className="rounded-lg border bg-background p-2 text-center">
              <p className="text-[10px] text-muted-foreground">{addedButton ? "بداية المسار: الزر الجديد" : "بداية المسار: العنصر المحدد"}</p>
              <p className="text-xs font-bold">{addedButton?.label || selectedLabel}</p>
            </div>
            {action.type === "sequence" ? (
              (action.steps || []).map((step, index) => (
                <React.Fragment key={step.id}>
                  <div className="flex justify-center text-primary"><ArrowDown size={16} /></div>
                  <div className="rounded-lg border bg-background p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">الخطوة {index + 1}</p>
                    <p className="text-xs font-bold">{ACTION_OPTIONS.find((option) => option.value === step.type)?.label || "إجراء"}</p>
                  </div>
                </React.Fragment>
              ))
            ) : (
              <>
                <div className="flex justify-center text-primary"><ArrowDown size={16} /></div>
                <div className="rounded-lg border bg-background p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">الوظيفة</p>
                  <p className="text-xs font-bold">{activeActionLabel}</p>
                </div>
              </>
            )}
            <div className="flex justify-center text-primary"><ArrowDown size={16} /></div>
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2 text-center">
              <p className="text-[10px] text-muted-foreground">النتيجة النهائية</p>
              <p className="text-xs font-bold">{destinationLabel}</p>
            </div>
            <p className="text-[10px] leading-5 text-muted-foreground">يمكنك إضافة الخطوات أو تغيير ترتيبها أو تعديل كل ربط، ثم تجربة المسار قبل اعتماده.</p>
          </div>
        </>
      )}
    </section>
  );
}
