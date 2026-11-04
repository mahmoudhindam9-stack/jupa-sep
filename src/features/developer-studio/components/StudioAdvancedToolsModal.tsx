/**
 * Developer Studio Pro — Advanced Tools Suite Modal
 * Houses:
 * 1. Command Palette (`Ctrl+K`)
 * 2. Find & Replace (across text, labels, links, and colors)
 * 3. Audits Suite (Accessibility, Responsive, and Design Consistency with 1-click Auto-Fix)
 * 4. Change Comparison (Local Unsaved Draft vs Last Saved Cloud Draft vs Published Live Version)
 * 5. Project Export / Import (Versioned JSON with Schema Validation)
 * 6. Safe Code Inspector (Clean generated JSX/HTML & CSS tokens)
 * 7. AI Design Assistant (Draft-only layout, color, accessibility, and RTL suggestions)
 * 8. Keyboard Shortcuts Reference
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  StudioDraft,
  StudioPublishedConfig,
  StudioAuditIssue,
  runStudioAudits,
  compareStudioSnapshots,
  DEFAULT_STUDIO_DESIGN_SYSTEM,
  getElementDisplayName,
} from "../models/studio.types";
import { studioService } from "../services/studioService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  Search,
  Replace,
  ShieldCheck,
  GitCompare,
  Download,
  Upload,
  Code2,
  Sparkles,
  Keyboard,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Wand2,
  Copy,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export type StudioToolTab =
  | "command"
  | "find"
  | "audits"
  | "diff"
  | "export"
  | "code"
  | "ai"
  | "shortcuts";

interface StudioAdvancedToolsModalProps {
  isOpen: boolean;
  initialTab?: StudioToolTab;
  onClose: () => void;
  draft: StudioDraft;
  activePageId: string;
  selectedElementId: string | null;
  selectedDomSelector?: string | null;
  onUpdateDraft: (updatedDraft: StudioDraft, description?: string) => void;
  onSelectPage: (pageId: string) => void;
  onSelectElement: (elementId: string) => void;
  onTriggerSave: () => void;
  onTriggerPublish: () => void;
  onToggleXRay: () => void;
  onOpenDesignSystem: () => void;
  onOpenAssets: () => void;
}

export function StudioAdvancedToolsModal({
  isOpen,
  initialTab = "command",
  onClose,
  draft,
  activePageId,
  selectedElementId,
  selectedDomSelector,
  onUpdateDraft,
  onSelectPage,
  onSelectElement,
  onTriggerSave,
  onTriggerPublish,
  onToggleXRay,
  onOpenDesignSystem,
  onOpenAssets,
}: StudioAdvancedToolsModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<StudioToolTab>(initialTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // 1. Command Palette state
  const [commandQuery, setCommandQuery] = useState("");

  // 2. Find & Replace state
  const [findQuery, setFindQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [findScope, setFindScope] = useState<"all" | "text" | "color" | "url">("all");

  // 3. Audits state
  const [auditFilter, setAuditFilter] = useState<"all" | "accessibility" | "responsive" | "consistency">("all");
  const auditIssues = useMemo(() => runStudioAudits(draft), [draft]);
  const filteredAudits = useMemo(
    () =>
      auditIssues.filter((i) => auditFilter === "all" || i.category === auditFilter),
    [auditIssues, auditFilter],
  );

  // 4. Diff Comparison state
  const [diffMode, setDiffMode] = useState<"draft_vs_published" | "draft_vs_saved" | "saved_vs_published">("draft_vs_published");
  const [serverSavedDraft, setServerSavedDraft] = useState<StudioDraft | null>(null);
  const [publishedConfig, setPublishedConfig] = useState<StudioPublishedConfig | null>(null);

  useEffect(() => {
    if (isOpen && activeTab === "diff") {
      studioService.getPublishedConfig().then(setPublishedConfig).catch(() => {});
      studioService.getServerSavedDraft(draft.owner).then(setServerSavedDraft).catch(() => {});
    }
  }, [isOpen, activeTab, draft.owner]);

  const activeDiffs = useMemo(() => {
    if (diffMode === "draft_vs_published") {
      return compareStudioSnapshots(publishedConfig, draft);
    }
    if (diffMode === "draft_vs_saved") {
      return compareStudioSnapshots(serverSavedDraft || publishedConfig, draft);
    }
    return compareStudioSnapshots(publishedConfig, serverSavedDraft || draft);
  }, [diffMode, publishedConfig, serverSavedDraft, draft]);

  // 5. Export / Import state
  const [importJsonText, setImportJsonText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  // Command Palette Items
  const commandItems = useMemo(() => {
    const items: Array<{ id: string; title: string; category: string; action: () => void }> = [
      {
        id: "cmd_save",
        title: "حفظ ومزامنة المسودة على Supabase (Ctrl+S)",
        category: "الإجراءات الأساسية",
        action: () => {
          onClose();
          onTriggerSave();
        },
      },
      {
        id: "cmd_publish",
        title: "نشر التعديلات بعد التحقق السحابي (Publish)",
        category: "الإجراءات الأساسية",
        action: () => {
          onClose();
          onTriggerPublish();
        },
      },
      {
        id: "cmd_xray",
        title: "تبديل وضع الأشعة السينية لهيكل الصفحة (X-Ray Mode)",
        category: "أدوات العرض",
        action: () => {
          onToggleXRay();
          onClose();
        },
      },
      {
        id: "cmd_design_system",
        title: "فتح نظام التصميم الموحد والسمات (Design System)",
        category: "التصميم والأصول",
        action: () => {
          onClose();
          onOpenDesignSystem();
        },
      },
      {
        id: "cmd_assets",
        title: "فتح مدير الأصول والصور وملفات SVG",
        category: "التصميم والأصول",
        action: () => {
          onClose();
          onOpenAssets();
        },
      },
      {
        id: "cmd_audits",
        title: `فحص الوصول والتجاوب وتناسق التصميم (${auditIssues.length} ملاحظة)`,
        category: "الجودة والتدقيق",
        action: () => setActiveTab("audits"),
      },
      {
        id: "cmd_find",
        title: "البحث والاستبدال الشامل في النصوص والألوان والروابط",
        category: "التحرير المتقدم",
        action: () => setActiveTab("find"),
      },
      {
        id: "cmd_diff",
        title: "مقارنة المسودة المحلية مع المحفوظة والمنشورة (Diff Viewer)",
        category: "الجودة والتدقيق",
        action: () => setActiveTab("diff"),
      },
      {
        id: "cmd_ai",
        title: "المساعد الذكي لتحسين التصميم والوصول (AI Design Assistant)",
        category: "الذكاء الاصطناعي",
        action: () => setActiveTab("ai"),
      },
      {
        id: "cmd_export",
        title: "تصدير أو استيراد مشروع الاستوديو بصيغة JSON",
        category: "المشروع",
        action: () => setActiveTab("export"),
      },
    ];

    Object.values(draft.pages || {}).forEach((p) => {
      items.push({
        id: `page_${p.id}`,
        title: `الانتقال إلى صفحة: ${p.name} (${p.route})`,
        category: "الصفحات",
        action: () => {
          onSelectPage(p.id);
          onClose();
        },
      });
    });

    Object.values(draft.elements || {}).forEach((el) => {
      items.push({
        id: `elem_${el.id}`,
        title: `تحديد العنصر: ${getElementDisplayName(el)}`,
        category: "العناصر",
        action: () => {
          onSelectPage(el.pageId);
          onSelectElement(el.id);
          onClose();
        },
      });
    });

    const q = commandQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.title.toLowerCase().includes(q) || i.category.toLowerCase().includes(q),
    );
  }, [
    commandQuery,
    draft.pages,
    draft.elements,
    auditIssues.length,
    onClose,
    onTriggerSave,
    onTriggerPublish,
    onToggleXRay,
    onOpenDesignSystem,
    onOpenAssets,
    onSelectPage,
    onSelectElement,
  ]);

  // Find & Replace matching logic
  const findMatches = useMemo(() => {
    const q = findQuery.trim();
    if (!q) return [];
    const qLower = q.toLowerCase();
    const results: Array<{
      id: string;
      type: "element" | "domEdit";
      label: string;
      field: string;
      value: string;
    }> = [];

    for (const el of Object.values(draft.elements || {})) {
      const label = getElementDisplayName(el);
      const c = el.content || {};
      if (findScope === "all" || findScope === "text") {
        for (const key of ["text", "title", "subtitle", "description", "label", "placeholder"]) {
          if (typeof c[key] === "string" && c[key].toLowerCase().includes(qLower)) {
            results.push({ id: el.id, type: "element", label, field: `content.${key}`, value: c[key] });
          }
        }
      }
      if (findScope === "all" || findScope === "url") {
        for (const key of ["url", "src"]) {
          if (typeof c[key] === "string" && c[key].toLowerCase().includes(qLower)) {
            results.push({ id: el.id, type: "element", label, field: `content.${key}`, value: c[key] });
          }
        }
      }
      if (findScope === "all" || findScope === "color") {
        for (const key of ["textColor", "backgroundColor", "borderColor"] as const) {
          const val = el.styles?.[key];
          if (typeof val === "string" && val.toLowerCase().includes(qLower)) {
            results.push({ id: el.id, type: "element", label, field: `styles.${key}`, value: val });
          }
        }
      }
    }

    for (const [selector, edit] of Object.entries(draft.domEdits || {})) {
      if (selector.startsWith("__studio_")) continue;
      if ((findScope === "all" || findScope === "text") && typeof edit.text === "string" && edit.text.toLowerCase().includes(qLower)) {
        results.push({ id: selector, type: "domEdit", label: edit.label || selector, field: "text", value: edit.text });
      }
      if (findScope === "all" || findScope === "color") {
        for (const [sKey, sVal] of Object.entries(edit.styles || {})) {
          if (typeof sVal === "string" && sVal.toLowerCase().includes(qLower)) {
            results.push({ id: selector, type: "domEdit", label: edit.label || selector, field: `styles.${sKey}`, value: sVal });
          }
        }
      }
    }

    return results;
  }, [findQuery, findScope, draft.elements, draft.domEdits]);

  const handleReplaceAll = () => {
    const q = findQuery.trim();
    if (!q || findMatches.length === 0) return;
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");

    const nextElements = { ...draft.elements };
    for (const el of Object.values(nextElements)) {
      if (el.locked) continue;
      let changed = false;
      const c = { ...el.content };
      const s = { ...el.styles };

      if (findScope === "all" || findScope === "text") {
        for (const key of ["text", "title", "subtitle", "description", "label", "placeholder"]) {
          if (typeof c[key] === "string" && regex.test(c[key])) {
            c[key] = c[key].replace(regex, replaceQuery);
            changed = true;
          }
        }
      }
      if (findScope === "all" || findScope === "url") {
        for (const key of ["url", "src"]) {
          if (typeof c[key] === "string" && regex.test(c[key])) {
            c[key] = c[key].replace(regex, replaceQuery);
            changed = true;
          }
        }
      }
      if (findScope === "all" || findScope === "color") {
        for (const key of ["textColor", "backgroundColor", "borderColor"] as const) {
          if (typeof s[key] === "string" && regex.test(s[key]!)) {
            (s as any)[key] = s[key]!.replace(regex, replaceQuery);
            changed = true;
          }
        }
      }
      if (changed) {
        nextElements[el.id] = { ...el, content: c, styles: s, updatedAt: new Date().toISOString() };
      }
    }

    const nextDomEdits = { ...(draft.domEdits || {}) };
    for (const [selector, edit] of Object.entries(nextDomEdits)) {
      if (selector.startsWith("__studio_")) continue;
      let changed = false;
      const nextEdit = { ...edit, styles: { ...(edit.styles || {}) } };
      if ((findScope === "all" || findScope === "text") && typeof nextEdit.text === "string" && regex.test(nextEdit.text)) {
        nextEdit.text = nextEdit.text.replace(regex, replaceQuery);
        changed = true;
      }
      if (findScope === "all" || findScope === "color") {
        for (const [sKey, sVal] of Object.entries(nextEdit.styles || {})) {
          if (typeof sVal === "string" && regex.test(sVal)) {
            nextEdit.styles![sKey] = sVal.replace(regex, replaceQuery);
            changed = true;
          }
        }
      }
      if (changed) {
        nextDomEdits[selector] = nextEdit;
      }
    }

    onUpdateDraft(
      { ...draft, elements: nextElements, domEdits: nextDomEdits },
      `استبدال شامل (${findMatches.length} موضع)`,
    );
    toast({
      title: "تم الاستبدال الشامل في المسودة",
      description: `تم تحديث ${findMatches.length} تطابق في المسودة المحلية.`,
    });
  };

  // Auto-fix an audit issue in the draft
  const handleAutoFixIssue = (issue: StudioAuditIssue) => {
    if (!issue.targetId) return;
    const el = draft.elements[issue.targetId];
    if (!el || el.locked) return;

    const ds = draft.designSystem || DEFAULT_STUDIO_DESIGN_SYSTEM;
    const nextEl = JSON.parse(JSON.stringify(el));

    switch (issue.fixType) {
      case "add_alt":
        nextEl.content.alt = nextEl.content.caption || nextEl.name || "صورة توضيحية من النظام";
        break;
      case "add_button_label":
        nextEl.content.label = "زر إجراء";
        nextEl.attributes["aria-label"] = "زر إجراء";
        break;
      case "fix_heading_level":
        nextEl.content.level = "h2";
        break;
      case "fix_contrast":
        nextEl.styles.textColor = ds.colors.textPrimary || "#0f172a";
        nextEl.styles.backgroundColor = ds.colors.surface || "#ffffff";
        break;
      case "fix_mobile_width":
        nextEl.responsiveStyles = {
          ...(nextEl.responsiveStyles || {}),
          mobile: { ...(nextEl.responsiveStyles?.mobile || {}), width: "100%", maxWidth: "100%" },
        };
        break;
      case "fix_mobile_font":
        nextEl.styles.fontSize = "14px";
        break;
      case "align_color_token":
        nextEl.styles.textColor = ds.colors.textPrimary;
        break;
      default:
        break;
    }

    nextEl.updatedAt = new Date().toISOString();
    onUpdateDraft(
      { ...draft, elements: { ...draft.elements, [el.id]: nextEl } },
      `إصلاح تلقائي: ${issue.title}`,
    );
    toast({ title: "تم تطبيق الإصلاح على المسودة", description: issue.title });
  };

  // Export JSON download
  const handleDownloadJson = () => {
    const json = studioService.exportProjectJson(draft);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `restocash-studio-rev${draft.baseRevision}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "تم تصدير ملف مشروع الاستوديو بنجاح" });
  };

  const handleImportJson = () => {
    setImportError(null);
    const res = studioService.importProjectJson(importJsonText, draft);
    if (!res.success || !res.draft) {
      setImportError(res.error || "ملف غير صالح");
      return;
    }
    onUpdateDraft(res.draft, "استيراد ملف مشروع JSON");
    toast({
      title: "تم استيراد المشروع في المسودة بنجاح",
      description: "راجع المعاينة ثم اضغط «حفظ ومزامنة» لتأكيدها على Supabase.",
    });
    onClose();
  };

  // Safe Code Inspector output
  const generatedCode = useMemo(() => {
    const ds = draft.designSystem || DEFAULT_STUDIO_DESIGN_SYSTEM;
    const selElem = selectedElementId ? draft.elements[selectedElementId] : null;
    const selDom = selectedDomSelector ? draft.domEdits?.[selectedDomSelector] : null;

    const cssVars = `:root {\n  --studio-primary: ${ds.colors.primary};\n  --studio-secondary: ${ds.colors.secondary};\n  --studio-surface: ${ds.colors.surface};\n  --studio-text: ${ds.colors.textPrimary};\n  --studio-font: ${ds.typography.fontFamily};\n  --studio-radius-card: ${ds.radius.card};\n}`;

    if (selElem) {
      return `${cssVars}\n\n/* Selected Studio Element: ${selElem.id} (${selElem.type}) */\n<div\n  id="${selElem.id}"\n  data-type="${selElem.type}"\n  style={${JSON.stringify(selElem.styles, null, 2)}}\n>\n  ${JSON.stringify(selElem.content, null, 2)}\n</div>`;
    }

    if (selDom && selectedDomSelector) {
      return `${cssVars}\n\n/* Live DOM Selector Override */\n${selectedDomSelector} {\n${Object.entries(selDom.styles || {})
        .map(([k, v]) => `  ${k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}: ${v};`)
        .join("\n")}\n}`;
    }

    const activePage = draft.pages[activePageId];
    return `${cssVars}\n\n/* Page Configuration: ${activePage?.name || activePageId} (${activePage?.route || "/"}) */\n${JSON.stringify(activePage || {}, null, 2)}`;
  }, [draft, activePageId, selectedElementId, selectedDomSelector]);

  // AI Design Assistant suggestions (strictly applied to draft only upon user click)
  const aiSuggestions = useMemo(() => {
    const ds = draft.designSystem || DEFAULT_STUDIO_DESIGN_SYSTEM;
    return [
      {
        id: "ai_rtl_typography",
        title: "تحسين توازن الطباعة العربية (RTL Typography Polish)",
        description:
          "ضبط محاذاة النصوص إلى اليمين، وتحسين ارتفاع السطر إلى 1.65 والخط إلى Cairo لزيادة سهولة القراءة في واجهات المحاسبة.",
        apply: () => {
          const nextElements = { ...draft.elements };
          Object.keys(nextElements).forEach((id) => {
            if (nextElements[id].locked) return;
            nextElements[id] = {
              ...nextElements[id],
              styles: {
                ...nextElements[id].styles,
                textAlign: "right",
                lineHeight: "1.65",
                fontFamily: "Cairo, sans-serif",
              },
            };
          });
          onUpdateDraft(
            {
              ...draft,
              elements: nextElements,
              designSystem: {
                ...ds,
                typography: { ...ds.typography, fontFamily: "Cairo, sans-serif", lineHeight: "1.65" },
              },
            },
            "اقتراح الذكاء الاصطناعي: تحسين الطباعة العربية",
          );
          toast({ title: "تم تطبيق المقترح على المسودة للمعاينة" });
        },
      },
      {
        id: "ai_card_elevation",
        title: "توحيد البطاقات والحاويات بظلال ناعمة وحواف متناسقة",
        description:
          "منح جميع البطاقات استدارة حواف 16px، وحشو داخلي متوازن 20px، مع إطار هادئ يتوافق مع الهوية البصرية.",
        apply: () => {
          const nextElements = { ...draft.elements };
          Object.keys(nextElements).forEach((id) => {
            const el = nextElements[id];
            if (el.locked || el.type !== "card") return;
            nextElements[id] = {
              ...el,
              styles: {
                ...el.styles,
                borderRadius: "16px",
                paddingTop: "20px",
                paddingBottom: "20px",
                paddingRight: "24px",
                paddingLeft: "24px",
                boxShadow: "md",
                borderColor: ds.colors.border,
              },
            };
          });
          onUpdateDraft(
            { ...draft, elements: nextElements },
            "اقتراح الذكاء الاصطناعي: توحيد تصميم البطاقات",
          );
          toast({ title: "تم تطبيق المقترح على بطاقات المسودة" });
        },
      },
      {
        id: "ai_a11y_autofix",
        title: `إصلاح تلقائي لملاحظات الوصول والتباين (${auditIssues.filter((i) => i.autoFixable).length} عنصر قابل للإصلاح)`,
        description:
          "معالجة تباين الألوان المنخفض وإضافة النصوص البديلة المفقودة وضبط العرض المتجاوب للهواتف دفعة واحدة في المسودة.",
        apply: () => {
          let current = { ...draft, elements: { ...draft.elements } };
          for (const issue of auditIssues) {
            if (!issue.autoFixable || !issue.targetId) continue;
            const el = current.elements[issue.targetId];
            if (!el || el.locked) continue;
            const copy = JSON.parse(JSON.stringify(el));
            if (issue.fixType === "add_alt") copy.content.alt = copy.name || "صورة توضيحية";
            if (issue.fixType === "fix_contrast") {
              copy.styles.textColor = ds.colors.textPrimary;
              copy.styles.backgroundColor = ds.colors.surface;
            }
            if (issue.fixType === "fix_mobile_width") {
              copy.responsiveStyles = {
                ...(copy.responsiveStyles || {}),
                mobile: { width: "100%", maxWidth: "100%" },
              };
            }
            current.elements[el.id] = copy;
          }
          onUpdateDraft(current, "اقتراح الذكاء الاصطناعي: إصلاح شامل للوصول والتجاوب");
          toast({ title: "تم تطبيق إصلاحات الوصول والتجاوب على المسودة" });
        },
      },
    ];
  }, [draft, auditIssues, onUpdateDraft, toast]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl text-right font-cairo sm:rounded-2xl max-h-[88vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline" className="font-mono text-[10px]">
              Studio Pro Suite
            </Badge>
            <DialogTitle className="text-base font-black text-foreground">
              الأدوات المتقدمة والتدقيق والمقارنة
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            لوحة الأوامر السريعة، البحث والاستبدال، فحص الجودة والوصول، مقارنة النسخ، التصدير والاستيراد، والمساعد الذكي.
          </DialogDescription>
        </DialogHeader>

        {/* Navigation Strip */}
        <div className="flex flex-wrap items-center gap-1 bg-muted p-1 rounded-xl text-[11px] font-bold shrink-0">
          {(
            [
              ["command", "الأوامر (Ctrl+K)", Command],
              ["find", "بحث واستبدال", Replace],
              ["audits", `التدقيق (${auditIssues.length})`, ShieldCheck],
              ["diff", "مقارنة التغييرات", GitCompare],
              ["export", "تصدير / استيراد", Download],
              ["code", "فاحص الكود", Code2],
              ["ai", "المساعد الذكي", Sparkles],
              ["shortcuts", "الاختصارات", Keyboard],
            ] as const
          ).map(([tabKey, label, Icon]) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => setActiveTab(tabKey)}
              className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                activeTab === tabKey
                  ? "bg-card text-foreground shadow-2xs border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5 text-primary" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* 1. COMMAND PALETTE */}
        {activeTab === "command" && (
          <div className="flex-1 overflow-y-auto space-y-3 py-2 text-xs">
            <div className="relative">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                placeholder="ابحث عن أمر، صفحة، عنصر، أو أداة..."
                className="h-10 pr-9 text-xs"
              />
            </div>
            <div className="space-y-1 max-h-[50vh] overflow-y-auto">
              {commandItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.action}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-accent text-right transition cursor-pointer border border-transparent hover:border-border"
                >
                  <span className="font-bold text-foreground">{item.title}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {item.category}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 2. FIND & REPLACE */}
        {activeTab === "find" && (
          <div className="flex-1 overflow-y-auto space-y-3 py-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-muted/40 p-3 rounded-xl border">
              <div>
                <label className="font-bold block mb-1">النص أو اللون أو الرابط المطلوب البحث عنه</label>
                <Input
                  value={findQuery}
                  onChange={(e) => setFindQuery(e.target.value)}
                  placeholder="مثال: Restocash أو #4f46e5"
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">الاستبدال بـ</label>
                <Input
                  value={replaceQuery}
                  onChange={(e) => setReplaceQuery(e.target.value)}
                  placeholder="القيمة الجديدة..."
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">نطاق البحث</label>
                <div className="flex items-center gap-1.5">
                  <select
                    value={findScope}
                    onChange={(e) => setFindScope(e.target.value as any)}
                    className="h-8 flex-1 rounded-lg border bg-background px-2 text-xs"
                  >
                    <option value="all">الكل (نصوص + ألوان + روابط)</option>
                    <option value="text">النصوص والعناوين فقط</option>
                    <option value="color">الألوان فقط</option>
                    <option value="url">الروابط والصور فقط</option>
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleReplaceAll}
                    disabled={findMatches.length === 0}
                    className="h-8 font-bold text-xs shrink-0"
                  >
                    استبدال الكل ({findMatches.length})
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              {findMatches.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground border border-dashed rounded-xl">
                  {findQuery.trim() ? "لا توجد نتائج مطابقة." : "اكتب كلمة أو كود لون للبحث في جميع عناصر المسودة."}
                </div>
              ) : (
                findMatches.map((m, idx) => (
                  <div
                    key={`${m.id}_${m.field}_${idx}`}
                    className="p-2.5 rounded-xl border bg-card flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <span className="font-bold text-foreground">{m.label}</span>
                      <span className="mx-2 text-[10px] font-mono text-muted-foreground">({m.field})</span>
                      <p className="text-[11px] text-primary truncate mt-0.5">{m.value}</p>
                    </div>
                    {m.type === "element" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px]"
                        onClick={() => {
                          onSelectElement(m.id);
                          onClose();
                        }}
                      >
                        تحديد العنصر
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 3. AUDITS SUITE (Accessibility, Responsive, Design Consistency) */}
        {activeTab === "audits" && (
          <div className="flex-1 overflow-y-auto space-y-3 py-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                {(
                  [
                    ["all", `الكل (${auditIssues.length})`],
                    ["accessibility", "إمكانية الوصول (Accessibility)"],
                    ["responsive", "التجاوب والشاشات (Responsive)"],
                    ["consistency", "تناسق التصميم (Consistency)"],
                  ] as const
                ).map(([key, label]) => (
                  <Button
                    key={key}
                    type="button"
                    size="sm"
                    variant={auditFilter === key ? "default" : "outline"}
                    onClick={() => setAuditFilter(key)}
                    className="h-7 text-[11px]"
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {filteredAudits.length === 0 ? (
              <div className="py-12 text-center bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-1">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <p className="font-black text-emerald-700">لا توجد مشكلات مكتشفة في هذا القسم!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredAudits.map((issue) => (
                  <div
                    key={issue.id}
                    className="p-3 rounded-xl border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {issue.severity === "error" ? (
                          <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                        )}
                        <span className="font-bold text-foreground">{issue.title}</span>
                        <Badge variant="outline" className="text-[9px]">
                          {issue.category === "accessibility"
                            ? "وصول"
                            : issue.category === "responsive"
                              ? "تجاوب"
                              : "تناسق"}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{issue.description}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {issue.targetId && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px]"
                          onClick={() => {
                            onSelectElement(issue.targetId!);
                            onClose();
                          }}
                        >
                          تحديد
                        </Button>
                      )}
                      {issue.autoFixable && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleAutoFixIssue(issue)}
                          className="h-7 text-[11px] font-bold gap-1"
                        >
                          <Wand2 className="w-3 h-3" />
                          <span>إصلاح تلقائي</span>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. CHANGE COMPARISON (Draft vs Saved vs Published) */}
        {activeTab === "diff" && (
          <div className="flex-1 overflow-y-auto space-y-3 py-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/40 p-2.5 rounded-xl border">
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={diffMode === "draft_vs_published" ? "default" : "outline"}
                  onClick={() => setDiffMode("draft_vs_published")}
                  className="h-7 text-[11px]"
                >
                  المسودة الحالية ↔ النسخة المنشورة الحية
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={diffMode === "draft_vs_saved" ? "default" : "outline"}
                  onClick={() => setDiffMode("draft_vs_saved")}
                  className="h-7 text-[11px]"
                >
                  المسودة غير المحفوظة ↔ آخر مسودة محفوظة سحابياً
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={diffMode === "saved_vs_published" ? "default" : "outline"}
                  onClick={() => setDiffMode("saved_vs_published")}
                  className="h-7 text-[11px]"
                >
                  المسودة السحابية ↔ النسخة المنشورة
                </Button>
              </div>
              <Badge variant="outline">{activeDiffs.length} فرق</Badge>
            </div>

            {activeDiffs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground border border-dashed rounded-xl">
                النسختان متطابقتان تماماً بدون أي فروقات.
              </div>
            ) : (
              <div className="space-y-2">
                {activeDiffs.map((d) => (
                  <div key={d.id} className="p-3 rounded-xl border bg-card space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">{d.title}</span>
                      <Badge
                        variant="outline"
                        className={
                          d.changeType === "added"
                            ? "text-emerald-600 border-emerald-500/30"
                            : d.changeType === "deleted"
                              ? "text-rose-600 border-rose-500/30"
                              : "text-amber-600 border-amber-500/30"
                        }
                      >
                        {d.changeType === "added"
                          ? "إضافة"
                          : d.changeType === "deleted"
                            ? "حذف"
                            : "تعديل"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono">
                      <div className="p-2 rounded bg-rose-500/5 border border-rose-500/20 overflow-x-auto max-h-24">
                        <div className="font-bold text-rose-600 mb-1">قبل (المرجع):</div>
                        {JSON.stringify(d.beforeValue)}
                      </div>
                      <div className="p-2 rounded bg-emerald-500/5 border border-emerald-500/20 overflow-x-auto max-h-24">
                        <div className="font-bold text-emerald-600 mb-1">بعد (الحالي):</div>
                        {JSON.stringify(d.afterValue)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5. PROJECT EXPORT / IMPORT */}
        {activeTab === "export" && (
          <div className="flex-1 overflow-y-auto space-y-4 py-2 text-xs">
            <div className="p-4 rounded-xl border bg-card flex items-center justify-between gap-3">
              <div>
                <h4 className="font-black text-sm text-foreground">تصدير تكوين الاستوديو الكامل (JSON)</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  يشمل جميع الصفحات، العناصر، تعديلات DOM الحية، نظام التصميم، والأصول مع رقم إصدار المخطط.
                </p>
              </div>
              <Button type="button" onClick={handleDownloadJson} className="gap-1.5 font-bold text-xs">
                <Download className="w-4 h-4" />
                <span>تحميل ملف المشروع (.json)</span>
              </Button>
            </div>

            <div className="p-4 rounded-xl border bg-card space-y-3">
              <h4 className="font-black text-sm text-foreground flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-primary" />
                <span>استيراد ملف مشروع (مع التحقق من سلامة المخطط)</span>
              </h4>
              <Textarea
                rows={7}
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                placeholder='الصق محتوى ملف JSON هنا ({"pages": ..., "elements": ...})...'
                className="font-mono text-[11px] text-left"
              />
              {importError && (
                <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 text-xs">
                  {importError}
                </div>
              )}
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={handleImportJson}
                  disabled={!importJsonText.trim()}
                  className="gap-1.5 font-bold text-xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>التحقق واستيراد إلى المسودة</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 6. SAFE CODE INSPECTOR */}
        {activeTab === "code" && (
          <div className="flex-1 overflow-y-auto space-y-3 py-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-muted-foreground">
                معاينة آمنة للكود ورموز CSS المولّدة للعنصر أو الصفحة المحددة (للقراءة والنسخ)
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard?.writeText(generatedCode);
                  toast({ title: "تم نسخ الكود إلى الحافظة" });
                }}
                className="h-7 text-xs gap-1"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>نسخ الكود</span>
              </Button>
            </div>
            <pre className="p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-[11px] text-left overflow-auto max-h-[52vh] leading-relaxed">
              {generatedCode}
            </pre>
          </div>
        )}

        {/* 7. AI DESIGN ASSISTANT */}
        {activeTab === "ai" && (
          <div className="flex-1 overflow-y-auto space-y-3 py-2 text-xs">
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-[11px] text-muted-foreground">
              جميع اقتراحات المساعد الذكي تُطبّق <strong className="text-foreground">كمسودة محلية فقط</strong> عند الضغط على زر التطبيق، ولا تغير التطبيق الحي إلا بعد الحفظ والنشر المؤكد.
            </div>
            <div className="space-y-2.5">
              {aiSuggestions.map((s) => (
                <div
                  key={s.id}
                  className="p-3.5 rounded-xl border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="font-black text-foreground flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span>{s.title}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {s.description}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={s.apply}
                    className="h-8 text-xs font-bold gap-1.5 shrink-0"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>تطبيق المقترح على المسودة</span>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 8. KEYBOARD SHORTCUTS */}
        {activeTab === "shortcuts" && (
          <div className="flex-1 overflow-y-auto py-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                ["Ctrl + S", "حفظ ومزامنة المسودة على Supabase"],
                ["Ctrl + Z", "تراجع عن آخر تعديل في المسودة (Undo)"],
                ["Ctrl + Shift + Z / Ctrl + Y", "إعادة التعديل المتراجع عنه (Redo)"],
                ["Ctrl + K", "فتح لوحة الأوامر السريعة (Command Palette)"],
                ["Ctrl + D", "تكرار العنصر المحدد (Duplicate)"],
                ["Delete / Backspace", "حذف أو إخفاء العنصر المحدد"],
                ["Escape", "إلغاء تحديد العنصر الحالي أو إغلاق النوافذ"],
              ].map(([keys, desc]) => (
                <div
                  key={keys}
                  className="p-3 rounded-xl border bg-card flex items-center justify-between gap-2"
                >
                  <span className="font-medium text-foreground">{desc}</span>
                  <kbd className="px-2 py-1 rounded bg-muted border font-mono text-[11px] font-bold">
                    {keys}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="shrink-0 border-t pt-3 border-border/60">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
