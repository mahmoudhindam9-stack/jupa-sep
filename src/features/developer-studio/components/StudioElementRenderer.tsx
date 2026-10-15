/**
 * Developer Studio Pro — Element Renderer Component
 * Renders Studio elements in both visual editor mode and live runtime mode.
 */

import React, { CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { ElementModel, getElementDisplayName } from "../models/studio.types";
import { evaluateArithmeticExpression, formatArithmeticResult } from "../utils/arithmetic";
import { cn } from "@/lib/utils";
import {
  Lock, EyeOff, Home, FileText, Search, Settings, Plus, Download, CheckCircle2,
  Link2, Mail, Printer, Calculator, Bell, CalendarDays, Coffee, CreditCard,
  Package, Truck, UserRound, Users, Wallet, BarChart3, ClipboardList, ShieldCheck,
  CircleDollarSign,
} from "lucide-react";

type RuntimeFlowNode = {
  id: string;
  kind: "trigger" | "action" | "condition" | "formula" | "result";
  label?: string;
  action?: "message" | "navigate" | "external" | "formula" | "toggle" | "submit" | "none";
  formula?: string;
  condition?: string;
  url?: string;
  message?: string;
  targetElementId?: string;
};
type RuntimeFlowConnection = { id: string; from: string; to: string; label?: string };

function evaluateStudioCondition(source: string): boolean {
  const expression = String(source || "").trim();
  const comparison = expression.match(/^(.*?)\s*(>=|<=|===|!==|==|!=|>|<)\s*(.*?)$/);
  if (!comparison) return evaluateArithmeticExpression(expression) !== 0;
  const left = evaluateArithmeticExpression(comparison[1]);
  const right = evaluateArithmeticExpression(comparison[3]);
  switch (comparison[2]) {
    case ">": return left > right;
    case "<": return left < right;
    case ">=": return left >= right;
    case "<=": return left <= right;
    case "==":
    case "===": return left === right;
    case "!=":
    case "!==": return left !== right;
    default: throw new Error("شرط غير مدعوم.");
  }
}

function isSafeWorkflowUrl(value: string): boolean {
  const url = String(value || "").trim();
  if (url.startsWith("/") && !url.startsWith("//") && !url.includes("\\")) return true;
  try {
    const parsed = new URL(url);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && !!parsed.hostname;
  } catch {
    return false;
  }
}

/** Execute only the saved, data-driven graph. Never evaluates arbitrary JavaScript. */
function runStudioWorkflow(raw: unknown, event: React.MouseEvent<HTMLButtonElement>): boolean {
  if (!raw || typeof raw !== "object") return false;
  const candidate = raw as { nodes?: unknown; connections?: unknown };
  if (!Array.isArray(candidate.nodes) || !candidate.nodes.length || !Array.isArray(candidate.connections)) return false;

  const nodes = (candidate.nodes as RuntimeFlowNode[]).filter((node) =>
    node && typeof node.id === "string" &&
    ["trigger", "action", "condition", "formula", "result"].includes(node.kind),
  );
  const ids = new Set(nodes.map((node) => node.id));
  const connections = (candidate.connections as RuntimeFlowConnection[]).filter((link) =>
    link && typeof link.id === "string" && ids.has(link.from) && ids.has(link.to) && link.from !== link.to,
  );
  if (!nodes.length) return false;
  const nodeById = new Map<string, RuntimeFlowNode>();
  nodes.forEach((node) => nodeById.set(node.id, node));
  const incoming = new Set(connections.map((link) => link.to));
  const start = nodes.find((node) => node.kind === "trigger") || nodes.find((node) => !incoming.has(node.id)) || nodes[0];
  const queue = [start.id];
  const visitedEdges = new Set<string>();
  const outcomes: string[] = [];
  let lastResult: number | undefined;
  let steps = 0;

  const validDestination = (url: string, external: boolean) =>
    isSafeWorkflowUrl(url) && (external ? /^https?:\/\//i.test(url) : url.startsWith("/") && !url.startsWith("//"));

  try {
    while (queue.length && steps < 100) {
      const currentId = queue.shift();
      const node = currentId ? nodeById.get(currentId) : undefined;
      if (!node) continue;
      steps += 1;

      if (node.kind === "formula" || (node.kind === "action" && node.action === "formula")) {
        lastResult = evaluateArithmeticExpression(node.formula || "");
      } else if (node.kind === "condition") {
        // evaluated below while choosing its outgoing branch
      } else if (node.kind === "action") {
        const action = node.action || "none";
        if (action === "message") {
          window.alert(node.message || node.label || "تم تنفيذ الإجراء.");
        } else if (action === "navigate") {
          const url = String(node.url || "").trim();
          if (!validDestination(url, false)) throw new Error("وجهة الصفحة الداخلية غير صالحة.");
          window.location.assign(url);
          return true;
        } else if (action === "external") {
          const url = String(node.url || "").trim();
          if (!validDestination(url, true)) throw new Error("الرابط الخارجي غير صالح.");
          window.open(url, "_blank", "noopener,noreferrer");
        } else if (action === "toggle") {
          const targetId = String(node.targetElementId || "");
          const target = targetId ? document.getElementById("studio-elem-" + targetId) : null;
          if (!target) window.alert("لم يتم العثور على العنصر المطلوب إظهاره أو إخفاؤه.");
          else {
            const isHidden = target.style.display === "none";
            target.style.display = isHidden ? "contents" : "none";
            target.setAttribute("aria-hidden", isHidden ? "false" : "true");
          }
        } else if (action === "submit") {
          const form = event.currentTarget.closest("form");
          if (form) form.requestSubmit();
          else window.alert("ضع الزر داخل نموذج حتى يمكن إرسال البيانات.");
        }
      } else if (node.kind === "result") {
        outcomes.push(lastResult === undefined
          ? (node.label || "تم إكمال العملية")
          : (node.label || "النتيجة") + ": " + formatArithmeticResult(lastResult));
      }

      let outgoing = connections.filter((link) => link.from === node.id && !visitedEdges.has(link.id));
      if (node.kind === "condition" && outgoing.length > 1) {
        const conditionResult = evaluateStudioCondition(node.condition || "");
        const truthLabels = conditionResult
          ? /^(yes|true|1|نعم|صحيح|موافق)$/i
          : /^(no|false|0|لا|خطأ|غير صحيح)$/i;
        const chosen = outgoing.find((link) => truthLabels.test(String(link.label || "").trim()));
        if (!chosen) throw new Error("سمِّ مخارج الشرط «نعم» و«لا» لتمييز مساري النتيجة.");
        outgoing = [chosen];
      } else if (node.kind === "condition" && outgoing.length === 1) {
        const conditionResult = evaluateStudioCondition(node.condition || "");
        const label = String(outgoing[0].label || "").trim();
        const isFalseLabel = /^(no|false|0|لا|خطأ|غير صحيح)$/i.test(label);
        if (isFalseLabel === conditionResult) outgoing = [];
      }

      outgoing.forEach((link) => {
        visitedEdges.add(link.id);
        queue.push(link.to);
      });
    }

    if (queue.length) {
      window.alert("توقف مسار العمل لأنه تجاوز الحد الآمن البالغ 100 خطوة. راجع وجود حلقة متكررة في المسار.");
    } else if (outcomes.length) {
      window.alert(outcomes.join("\n"));
    } else if (lastResult !== undefined) {
      window.alert("نتيجة الحساب: " + formatArithmeticResult(lastResult));
    }
  } catch (error) {
    window.alert(error instanceof Error ? error.message : "تعذر تنفيذ مسار العمل.");
  }
  return true;
}

interface StudioElementRendererProps {
  element: ElementModel;
  allElements?: Record<string, ElementModel>;
  isEditorMode?: boolean;
  isSelected?: boolean;
  isHovered?: boolean;
  onSelect?: (elementId: string, event: React.MouseEvent) => void;
  onDoubleClick?: (elementId: string, event: React.MouseEvent) => void;
  className?: string;
}

export function StudioElementRenderer({
  element,
  allElements = {},
  isEditorMode = false,
  isSelected = false,
  isHovered = false,
  onSelect,
  onDoubleClick,
  className,
}: StudioElementRendererProps) {
  // If not visible and not in editor mode, don't render
  if (!element.layout.visibility && !isEditorMode) {
    return null;
  }

  // Convert ElementStyles to inline React CSSProperties
  const s = element.styles || {};
  const elementStyle: CSSProperties = {
    color: s.textColor,
    backgroundColor: s.backgroundColor,
    borderColor: s.borderColor,
    borderWidth: s.borderWidth,
    borderStyle: s.borderStyle || (s.borderWidth ? "solid" : undefined),
    borderRadius: s.borderRadius,
    opacity: s.opacity !== undefined ? s.opacity : undefined,

    // Typography
    fontSize: s.fontSize,
    fontWeight: s.fontWeight,
    fontFamily: s.fontFamily,
    textAlign: s.textAlign,
    lineHeight: s.lineHeight,
    letterSpacing: s.letterSpacing,
    textTransform: s.textTransform,

    // Dimensions
    width: s.width,
    height: s.height,
    minWidth: s.minWidth,
    maxWidth: s.maxWidth,
    minHeight: s.minHeight,
    maxHeight: s.maxHeight,

    // Spacing
    marginTop: s.marginTop,
    marginRight: s.marginRight,
    marginBottom: s.marginBottom,
    marginLeft: s.marginLeft,
    paddingTop: s.paddingTop,
    paddingRight: s.paddingRight,
    paddingBottom: s.paddingBottom,
    paddingLeft: s.paddingLeft,

    // Flex / Alignment
    display: s.display,
    flexDirection: s.flexDirection,
    justifyContent: s.justifyContent,
    alignItems: s.alignItems,
    gap: s.gap,
    flexWrap: s.flexWrap,
  };

  // Shadow class helper
  const shadowClass =
    s.boxShadow && s.boxShadow !== "none" ? `shadow-${s.boxShadow}` : "";

  // Editor selection outline
  const editorWrapperClass = isEditorMode
    ? cn(
        "relative transition-all duration-150 group/editor-elem",
        isSelected
          ? "ring-2 ring-primary ring-offset-2 z-10"
          : isHovered
            ? "ring-1 ring-primary/60 ring-offset-1"
            : "hover:ring-1 hover:ring-primary/40",
        !element.layout.visibility && "opacity-50 grayscale",
        element.locked && "cursor-not-allowed",
      )
    : "";

  const handleClick = (e: React.MouseEvent) => {
    if (isEditorMode) {
      e.stopPropagation();
      onSelect?.(element.id, e);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isEditorMode) {
      e.stopPropagation();
      onDoubleClick?.(element.id, e);
    }
  };

  // Find child elements if container or card
  const childElements = Object.values(allElements)
    .filter((el) => el.parentId === element.id)
    .sort((a, b) => (a.layout.order || 0) - (b.layout.order || 0));

  // Render element content based on its type
  const renderContent = () => {
    const c = element.content || {};

    switch (element.type) {
      case "heading": {
        const level = c.level || "h2";
        const text = c.text || "عنوان جديد";
        const Tag = (["h1", "h2", "h3", "h4", "h5", "h6"].includes(level) ? level : "h2") as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
        return (
          <Tag
            style={elementStyle}
            className={cn(
              "font-black tracking-tight",
              level === "h1" && "text-3xl sm:text-4xl",
              level === "h2" && "text-2xl sm:text-3xl",
              level === "h3" && "text-xl sm:text-2xl",
              level === "h4" && "text-lg font-bold",
              shadowClass,
              className,
            )}
          >
            {text}
          </Tag>
        );
      }

      case "text": {
        const text = c.text || "أدخل النص هنا...";
        return (
          <p
            style={elementStyle}
            className={cn("text-sm sm:text-base leading-relaxed", shadowClass, className)}
          >
            {text}
          </p>
        );
      }

      case "button": {
        const label = c.label || "زر إجراء";
        const variant = c.variant || "default";
        const iconName = String(element.attributes?.iconName || "");
        const ButtonIcon = iconName === "home" ? Home
          : iconName === "file" ? FileText
          : iconName === "search" ? Search
          : iconName === "settings" ? Settings
          : iconName === "plus" ? Plus
          : iconName === "download" ? Download
          : iconName === "check" ? CheckCircle2
          : iconName === "link" ? Link2
          : iconName === "mail" ? Mail
          : iconName === "print" ? Printer
          : iconName === "calculator" ? Calculator
          : iconName === "bell" ? Bell
          : iconName === "calendar" ? CalendarDays
          : iconName === "coffee" ? Coffee
          : iconName === "card" ? CreditCard
          : iconName === "package" ? Package
          : iconName === "truck" ? Truck
          : iconName === "user" ? UserRound
          : iconName === "users" ? Users
          : iconName === "wallet" ? Wallet
          : iconName === "chart" ? BarChart3
          : iconName === "clipboard" ? ClipboardList
          : iconName === "shield" ? ShieldCheck
          : iconName === "money" ? CircleDollarSign
          : null;
        const btnContent = (
          <button
            type="button"
            style={elementStyle}
            className={cn(
              "inline-flex items-center justify-center font-bold text-sm px-4 py-2 rounded-xl transition shadow-xs cursor-pointer",
              variant === "default" && "bg-primary text-primary-foreground hover:bg-primary/90",
              variant === "secondary" && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
              variant === "outline" && "border border-input bg-background hover:bg-accent",
              variant === "destructive" && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              shadowClass,
              className,
            )}
            onClick={(e) => {
              if (isEditorMode) {
                e.preventDefault();
                return;
              }
              const savedWorkflow = element.attributes?.studioWorkflow;
              if (savedWorkflow && runStudioWorkflow(savedWorkflow, e)) {
                e.preventDefault();
                return;
              }
              if (c.action === "alert") {
                window.alert(c.message || label);
              } else if (c.action === "formula") {
                try {
                  const result = evaluateArithmeticExpression(c.formula || "");
                  window.alert(`نتيجة المعادلة: ${formatArithmeticResult(result)}`);
                } catch (error) {
                  window.alert(error instanceof Error ? error.message : "تحقق من المعادلة الحسابية.");
                }
              } else if (c.action === "toggle") {
                const targetId = String(c.targetElementId || "");
                const target = targetId ? document.getElementById(`studio-elem-${targetId}`) : null;
                if (!target) {
                  window.alert("اختر العنصر المطلوب أولًا من إعدادات الزر.");
                } else {
                  const isHidden = target.style.display === "none";
                  target.style.display = isHidden ? "contents" : "none";
                  target.setAttribute("aria-hidden", isHidden ? "false" : "true");
                }
              } else if (c.action === "submit") {
                const form = (e.currentTarget as HTMLButtonElement).closest("form");
                if (form) form.requestSubmit();
                else window.alert("ضع الزر داخل نموذج حتى يتمكن من إرسال البيانات.");
              }
            }}
          >
            {ButtonIcon ? <><ButtonIcon size={16} aria-hidden="true" /><span>{label}</span></> : label}
          </button>
        );

        if (!isEditorMode && c.action === "link" && c.url) {
          return (
            <Link to={c.url} className="inline-block">
              {btnContent}
            </Link>
          );
        }
        if (!isEditorMode && c.action === "external" && c.url) {
          return (
            <a href={c.url} target="_blank" rel="noreferrer noopener" className="inline-block">
              {btnContent}
            </a>
          );
        }
        return btnContent;
      }

      case "image": {
        const src = c.src || "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop";
        const alt = c.alt || "صورة توضيحية";
        const fit = c.fit || "cover";
        return (
          <img
            src={src}
            alt={alt}
            style={elementStyle}
            className={cn("rounded-2xl max-w-full h-auto", `object-${fit}`, shadowClass, className)}
          />
        );
      }

      case "card": {
        return (
          <div
            style={elementStyle}
            className={cn(
              "rounded-2xl border border-border bg-card p-5 shadow-xs transition",
              shadowClass,
              className,
            )}
          >
            {(c.title || c.description) && (
              <div className="mb-3">
                {c.title && <h3 className="text-lg font-black text-foreground">{c.title}</h3>}
                {c.subtitle && <p className="text-xs font-semibold text-primary mt-0.5">{c.subtitle}</p>}
                {c.description && <p className="text-xs text-muted-foreground mt-1">{c.description}</p>}
              </div>
            )}
            {childElements.length > 0 ? (
              <div className="space-y-3">
                {childElements.map((child) => (
                  <StudioElementRenderer
                    key={child.id}
                    element={child}
                    allElements={allElements}
                    isEditorMode={isEditorMode}
                    isSelected={isSelected}
                    onSelect={onSelect}
                    onDoubleClick={onDoubleClick}
                  />
                ))}
              </div>
            ) : (
              isEditorMode && (
                <div className="border border-dashed border-border/80 rounded-xl p-4 text-center text-xs text-muted-foreground">
                  حاوية بطاقة فارغة (اسحب عناصر إلى هنا)
                </div>
              )
            )}
          </div>
        );
      }

      case "container": {
        return (
          <div
            style={elementStyle}
            className={cn("w-full transition", shadowClass, className)}
          >
            {childElements.length > 0 ? (
              childElements.map((child) => (
                <StudioElementRenderer
                  key={child.id}
                  element={child}
                  allElements={allElements}
                  isEditorMode={isEditorMode}
                  onSelect={onSelect}
                  onDoubleClick={onDoubleClick}
                />
              ))
            ) : (
              isEditorMode && (
                <div className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-6 text-center text-xs text-muted-foreground">
                  حاوية تخطيط فارغة (Container)
                </div>
              )
            )}
          </div>
        );
      }

      case "badge": {
        const label = c.label || "شارة مميزة";
        const variant = c.variant || "default";
        return (
          <span
            style={elementStyle}
            className={cn(
              "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black shadow-xs",
              variant === "default" && "bg-primary text-primary-foreground",
              variant === "secondary" && "bg-secondary text-secondary-foreground",
              variant === "outline" && "border border-border text-foreground",
              variant === "success" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20",
              variant === "destructive" && "bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/20",
              shadowClass,
              className,
            )}
          >
            {label}
          </span>
        );
      }

      case "divider": {
        return (
          <div
            style={elementStyle}
            className={cn(
              "relative my-4 flex items-center justify-center border-t border-border/80",
              shadowClass,
              className,
            )}
          >
            {c.label && (
              <span className="bg-background px-3 text-xs font-bold text-muted-foreground absolute -top-2.5">
                {c.label}
              </span>
            )}
          </div>
        );
      }

      case "input": {
        return (
          <div className="w-full space-y-1.5" style={elementStyle}>
            {c.label && <label className="text-xs font-bold text-foreground block">{c.label}</label>}
            <input
              type={c.inputType || "text"}
              placeholder={c.placeholder || "أدخل القيمة..."}
              defaultValue={c.defaultValue || ""}
              readOnly={isEditorMode}
              className="w-full px-3.5 py-2 text-sm bg-background border border-input rounded-xl shadow-xs outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        );
      }

      case "table": {
        const columns: Array<{ id: string; label: string }> = c.columns || [
          { id: "col1", label: "البند" },
          { id: "col2", label: "الحالة" },
          { id: "col3", label: "القيمة" },
        ];
        const rows: Array<Record<string, any>> = c.rows || [
          { col1: "المبيعات اليومية", col2: "مكتمل", col3: "$1,250" },
          { col1: "المشتريات", col2: "قيد المراجعة", col3: "$420" },
        ];

        return (
          <div style={elementStyle} className={cn("w-full overflow-x-auto rounded-xl border border-border", shadowClass, className)}>
            <table className="w-full text-right text-xs">
              <thead className="bg-muted text-muted-foreground font-bold border-b border-border">
                <tr>
                  {columns.map((col) => (
                    <th key={col.id} className="p-2.5 px-3">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-muted/50 transition">
                    {columns.map((col) => (
                      <td key={col.id} className="p-2.5 px-3 text-foreground font-medium">
                        {row[col.id] || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      default:
        return (
          <div style={elementStyle} className={cn("p-2 text-xs border rounded-lg", className)}>
            عنصر: {element.type}
          </div>
        );
    }
  };

  // If in editor mode, wrap with selection target and indicator badges
  if (isEditorMode) {
    return (
      <div
        id={`studio-elem-${element.id}`}
        data-studio-element-id={element.id}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        className={cn(editorWrapperClass, "cursor-pointer")}
      >
        {/* Editor badges (Type, Locked, Hidden) */}
        {isSelected && (
          <div className="absolute -top-3.5 right-2 z-20 flex items-center gap-1 bg-primary text-primary-foreground text-[10px] font-black px-2 py-0.5 rounded-full shadow-md select-none pointer-events-none">
            <span>{getElementDisplayName(element)}</span>
            {element.locked && <Lock size={10} className="text-amber-300" />}
            {!element.layout.visibility && <EyeOff size={10} className="text-rose-300" />}
          </div>
        )}

        {renderContent()}
      </div>
    );
  }

  // Live Runtime Mode — keep a stable target for show/hide workflow actions without
  // imposing an extra layout box on the actual rendered element.
  return (
    <div
      id={`studio-elem-${element.id}`}
      data-studio-element-id={element.id}
      style={{ display: element.layout.visibility ? "contents" : "none" }}
    >
      {renderContent()}
    </div>
  );
}
