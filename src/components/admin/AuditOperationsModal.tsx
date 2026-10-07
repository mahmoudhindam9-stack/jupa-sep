import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText, History, Printer, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { printRawHtml } from "@/shared/utils/printAccountingDocument";

type AuditLog = {
  id?: string;
  created_at?: string;
  user_email?: string;
  action?: string;
  action_type?: string;
  details?: string;
  description?: string;
  resource_type?: string;
  resource_id?: string;
  severity?: string;
  [key: string]: any;
};

function normalize(value: unknown) {
  return String(value ?? "")
    .toLocaleLowerCase("ar-EG")
    .normalize("NFKC")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .trim();
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("ar-EG");
}

function printableText(log: AuditLog) {
  const details = log.details ?? log.description ?? "";
  return `${formatDate(log.created_at)} | ${log.user_email ?? "غير محدد"} | ${
    log.action ?? log.action_type ?? "عملية"
  } | ${details}`;
}

export function AuditOperationsView({ logs = [] }: { logs?: AuditLog[] }) {
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("all");
  const [printMode, setPrintMode] = useState<"filtered" | "all" | "summary">("filtered");

  const prepared = useMemo(
    () =>
      (logs || []).map((log) => ({
        ...log,
        _search: normalize(
          [
            log.id,
            log.user_email,
            log.action,
            log.action_type,
            log.details,
            log.description,
            log.resource_type,
            log.resource_id,
            log.severity,
            log.created_at,
          ]
            .filter(Boolean)
            .join(" "),
        ),
      })),
    [logs],
  );

  const filtered = useMemo(() => {
    const q = normalize(search);
    return prepared
      .filter((log) => severity === "all" || normalize(log.severity || "info") === severity)
      .filter((log) => !q || log._search.includes(q))
      .sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
      );
  }, [prepared, search, severity]);

  const counts = useMemo(() => {
    const result = { all: prepared.length, critical: 0, warning: 0, info: 0 };
    prepared.forEach((log) => {
      const level = normalize(log.severity || "info");
      if (level === "critical" || level === "حرج") result.critical += 1;
      else if (level === "warning" || level === "تحذير") result.warning += 1;
      else result.info += 1;
    });
    return result;
  }, [prepared]);

  const printLogs = printMode === "all" ? prepared : filtered;

  const handlePrint = () => {
    const title =
      printMode === "summary"
        ? "ملخص سجل العمليات والرقابة العامة"
        : printMode === "all"
          ? "سجل العمليات والرقابة العامة الكامل"
          : "سجل العمليات والرقابة العامة - النتائج المصفاة";

    const rows =
      printMode === "summary"
        ? `<div class="summary">
            <div class="summary-card"><span>إجمالي العمليات:</span> <strong>${counts.all}</strong></div>
            <div class="summary-card"><span>العمليات الحرجة:</span> <strong style="color:#dc2626">${counts.critical}</strong></div>
            <div class="summary-card"><span>التحذيرات:</span> <strong style="color:#d97706">${counts.warning}</strong></div>
            <div class="summary-card"><span>المعلومات:</span> <strong style="color:#0284c7">${counts.info}</strong></div>
            <div class="summary-card"><span>النتائج المصفاة:</span> <strong>${filtered.length}</strong></div>
          </div>`
        : `<table>
            <thead>
              <tr>
                <th style="width:160px">التاريخ والوقت</th>
                <th style="width:180px">المستخدم</th>
                <th style="width:140px">الإجراء</th>
                <th>التفاصيل</th>
                <th style="width:90px">المستوى</th>
              </tr>
            </thead>
            <tbody>
              ${printLogs
                .map(
                  (log) =>
                    `<tr>
                      <td>${formatDate(log.created_at)}</td>
                      <td>${log.user_email ?? "—"}</td>
                      <td><strong>${log.action ?? log.action_type ?? "عملية"}</strong></td>
                      <td>${log.details ?? log.description ?? "—"}</td>
                      <td><span class="badge badge-${
                        log.severity === "critical" || log.severity === "حرج"
                          ? "critical"
                          : log.severity === "warning" || log.severity === "تحذير"
                            ? "warning"
                            : "info"
                      }">${log.severity ?? "info"}</span></td>
                    </tr>`,
                )
                .join("")}
            </tbody>
          </table>`;

    const fullHtml = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>${title}</title><style>
      @page { size: A4 landscape; margin: 12mm; }
      body { font-family: Tahoma, Arial, sans-serif; color: #0f172a; margin: 0; padding: 16px; background: #fff; direction: rtl; text-align: right; }
      h1 { font-size: 18px; margin: 0 0 6px; color: #1e293b; text-align: center; }
      .meta { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 12px; border-bottom: 2px solid #6366f1; padding-bottom: 6px; font-weight: bold; color: #475569; }
      .summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin: 16px 0; }
      .summary-card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; background: #f8fafc; font-size: 12px; text-align: center; }
      .summary-card strong { display: block; font-size: 16px; margin-top: 4px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
      th { background: #f1f5f9; color: #0f172a; font-weight: bold; padding: 8px; border: 1px solid #cbd5e1; }
      td { border: 1px solid #cbd5e1; padding: 7px 8px; vertical-align: top; }
      tr:nth-child(even) { background: #f8fafc; }
      .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; }
      .badge-critical { background: #fee2e2; color: #dc2626; }
      .badge-warning { background: #fef3c7; color: #d97706; }
      .badge-info { background: #e0f2fe; color: #0284c7; }
      .footer { margin-top: 24px; font-size: 10px; color: #64748b; display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 8px; }
      @media print {
        body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      }
    </style></head><body>
      <div class="meta">
        <span>مستند: سجل الرقابة والعمليات - نظام Restocash ERP</span>
        <span>تاريخ التقرير: ${new Date().toLocaleDateString("ar-EG")} ${new Date().toLocaleTimeString("ar-EG")}</span>
      </div>
      <h1>${title}</h1>
      ${rows}
      <div class="footer">
        <span>إجمالي العمليات: ${printLogs.length}</span>
        <span>نظام الإدارة والمحاسبة الموحد</span>
      </div>
    </body></html>`;

    printRawHtml(fullHtml);
  };

  const handleExportCSV = () => {
    const headers = ["التاريخ", "المستخدم", "الإجراء", "التفاصيل", "المستوى", "نوع المورد", "معرف المورد"];
    const rows = filtered.map((log) => [
      `"${formatDate(log.created_at)}"`,
      `"${(log.user_email || "غير محدد").replace(/"/g, '""')}"`,
      `"${(log.action || log.action_type || "عملية").replace(/"/g, '""')}"`,
      `"${(log.details || log.description || "—").replace(/"/g, '""')}"`,
      `"${(log.severity || "info").replace(/"/g, '""')}"`,
      `"${(log.resource_type || "—").replace(/"/g, '""')}"`,
      `"${(log.resource_id || "—").replace(/"/g, '""')}"`,
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-operations-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-card border border-border/80 rounded-2xl shadow-sm overflow-hidden flex flex-col">
      {/* Header bar with title and action buttons placed in the empty space */}
      <div className="px-6 py-5 border-b bg-muted/20 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2 text-foreground">
            <History className="text-primary" size={22} />
            سجل العمليات والرقابة العامة
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            متابعة شاملة لجميع الحركات والعمليات المنفذة في النظام مع البحث المتقدم والتصفية والتصدير.
          </p>
        </div>

        {/* Action controls moved to the header's empty space */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Badge variant="outline" className="px-3 py-1.5 font-bold text-xs gap-1 border-primary/30 text-primary bg-primary/5">
            <FileText size={13} /> {filtered.length} عملية مسجلة
          </Badge>
          <select
            value={printMode}
            onChange={(e) => setPrintMode(e.target.value as any)}
            className="h-9 rounded-xl border border-input bg-background px-3 text-xs font-bold"
          >
            <option value="filtered">طباعة النتائج الحالية</option>
            <option value="all">طباعة السجل الكامل</option>
            <option value="summary">طباعة ملخص</option>
          </select>
          <Button onClick={handlePrint} size="sm" className="gap-1.5 rounded-xl font-bold h-9">
            <Printer size={15} /> طباعة
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="gap-1.5 rounded-xl font-bold h-9"
          >
            <Download size={15} /> تصدير CSV
          </Button>
        </div>
      </div>

      <div className="px-6 py-4 border-b space-y-4 bg-background">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-2xl border bg-muted/20 p-3">
            <div className="text-[11px] text-muted-foreground font-bold">الإجمالي</div>
            <div className="text-xl font-black">{counts.all}</div>
          </div>
          <div className="rounded-2xl border bg-rose-50 dark:bg-rose-950/20 p-3">
            <div className="text-[11px] text-muted-foreground font-bold">حرجة</div>
            <div className="text-xl font-black text-rose-600">{counts.critical}</div>
          </div>
          <div className="rounded-2xl border bg-amber-50 dark:bg-amber-950/20 p-3">
            <div className="text-[11px] text-muted-foreground font-bold">تحذيرات</div>
            <div className="text-xl font-black text-amber-600">{counts.warning}</div>
          </div>
          <div className="rounded-2xl border bg-emerald-50 dark:bg-emerald-950/20 p-3">
            <div className="text-[11px] text-muted-foreground font-bold">النتائج</div>
            <div className="text-xl font-black text-emerald-600">{filtered.length}</div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={16}
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-9 h-11"
              placeholder="بحث باسم المستخدم، رقم العملية، الإجراء، التفاصيل، التاريخ..."
            />
          </div>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="h-11 rounded-xl border border-input bg-background px-3 text-sm font-bold"
          >
            <option value="all">كل المستويات</option>
            <option value="info">معلومات</option>
            <option value="warning">تحذير</option>
            <option value="critical">حرج</option>
          </select>
        </div>
      </div>

      <div className="p-6">
        <div className="rounded-2xl border overflow-hidden bg-background">
          <div className="grid grid-cols-[150px_1.1fr_1fr_2fr_90px] gap-0 bg-muted/40 text-xs font-black sticky top-0 z-10 border-b">
            <div className="p-3">التاريخ</div>
            <div className="p-3">المستخدم</div>
            <div className="p-3">الإجراء</div>
            <div className="p-3">التفاصيل</div>
            <div className="p-3">المستوى</div>
          </div>
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground font-bold">
              لا توجد عمليات مطابقة للبحث.
            </div>
          ) : (
            filtered.map((log, index) => (
              <div
                key={log.id || `${log.created_at}-${index}`}
                className="grid grid-cols-[150px_1.1fr_1fr_2fr_90px] border-b last:border-b-0 hover:bg-muted/20 text-xs"
              >
                <div className="p-3 text-muted-foreground">{formatDate(log.created_at)}</div>
                <div className="p-3 font-bold break-words">{log.user_email || "غير محدد"}</div>
                <div className="p-3 font-bold">{log.action || log.action_type || "عملية"}</div>
                <div className="p-3 text-muted-foreground break-words">
                  {log.details || log.description || "—"}
                </div>
                <div className="p-3">
                  <Badge variant="outline">{log.severity || "info"}</Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function AuditOperationsModal({
  open,
  onOpenChange,
  logs = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logs?: AuditLog[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[96vw] max-h-[90vh] p-0 overflow-y-auto">
        <div className="p-4">
          <AuditOperationsView logs={logs} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
