export type PrintColumn = { key: string; label: string; align?: "left" | "center" | "right" };

const escapeHtml = (value: unknown) => {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  };
  return String(value ?? "").replace(/[&<>"]/g, (char) => entities[char] || char);
};

export function printAccountingDocument(options: {
  title: string;
  subtitle?: string;
  columns: PrintColumn[];
  rows: Record<string, unknown>[];
  totals?: { label: string; value: string }[];
  documentNo?: string;
  summaryHtml?: string;
  metaItems?: { label: string; value: string }[];
  landscape?: boolean;
}) {
  if (typeof window === "undefined") return false;

  const head = options.columns
    .map(
      (column) =>
        `<th style="text-align:${column.align || "right"}">${escapeHtml(column.label)}</th>`,
    )
    .join("");

  const body = options.rows
    .map(
      (row) =>
        `<tr>${options.columns
          .map(
            (column) =>
              `<td style="text-align:${column.align || "right"}">${escapeHtml(row[column.key])}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");

  const totals = (options.totals || [])
    .map(
      (item) =>
        `<div class="total"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`,
    )
    .join("");

  const metaGrid = (options.metaItems || [])
    .map(
      (item) =>
        `<div class="meta-item"><span class="meta-label">${escapeHtml(item.label)}:</span> <strong>${escapeHtml(item.value)}</strong></div>`,
    )
    .join("");

  const pageOrientation = options.landscape ? "landscape" : "portrait";

  const htmlContent = `<!doctype html><html lang="ar"><head><meta charset="utf-8"/><title>${escapeHtml(options.title)}</title><style>
  @page{size:A4 ${pageOrientation};margin:12mm}
  body{font-family:Tahoma,Arial,sans-serif;color:#0f172a;margin:0;padding:16px;background:#fff;direction:rtl;text-align:right}
  h1{font-size:20px;margin:0 0 4px;color:#1e293b;text-align:center}
  .sub{color:#475569;font-size:12px;margin-bottom:14px;text-align:center}
  .meta{display:flex;justify-content:space-between;font-size:12px;margin-bottom:12px;border-bottom:2px solid #0284c7;padding-bottom:8px;font-weight:bold}
  .meta-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:10px;margin-bottom:12px;font-size:11px}
  .meta-item{display:flex;justify-content:space-between;gap:6px}
  .meta-label{color:#64748b}
  table{width:100%;border-collapse:collapse;font-size:11px;margin-top:10px}
  th{background:#f1f5f9;color:#0f172a;font-weight:bold;padding:8px;border:1px solid #cbd5e1}
  td{border:1px solid #cbd5e1;padding:8px;vertical-align:top}
  .totals{margin-top:16px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
  .total{border:1px solid #cbd5e1;border-radius:6px;padding:10px;background:#f8fafc;display:flex;justify-content:space-between;font-size:12px}
  .signatures{margin-top:40px;display:grid;grid-template-columns:repeat(3,1fr);gap:20px;text-align:center;font-size:12px;color:#475569}
  .sig-line{border-top:1px dashed #94a3b8;margin-top:35px;padding-top:6px;font-weight:bold}
  .footer{margin-top:30px;font-size:10px;color:#64748b;display:flex;justify-content:space-between;border-top:1px solid #e2e8f0;padding-top:10px}
  @media print{
    body{print-color-adjust:exact;-webkit-print-color-adjust:exact}
  }
  </style></head><body>
  <div class="meta">
    <span>مستند رقم: ${escapeHtml(options.documentNo || `DOC-${Date.now().toString().slice(-6)}`)}</span>
    <span>تاريخ الطباعة: ${escapeHtml(new Date().toLocaleDateString("ar-EG") + " " + new Date().toLocaleTimeString("ar-EG"))}</span>
  </div>
  <h1>${escapeHtml(options.title)}</h1>
  <div class="sub">${escapeHtml(options.subtitle || "سند وتقرير مالي رسمي - Restocash ERP")}</div>
  ${metaGrid ? `<div class="meta-grid">${metaGrid}</div>` : ""}
  <table><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${options.columns.length}" style="text-align:center">لا توجد بيانات</td></tr>`}</tbody></table>
  ${totals ? `<div class="totals">${totals}</div>` : ""}
  ${options.summaryHtml ? `<div class="summary-section" style="margin-top:16px; border:1px solid #cbd5e1; padding:10px; border-radius:6px; background-color:#f8fafc;">${options.summaryHtml}</div>` : ""}
  <div class="signatures">
    <div><div class="sig-line">إعداد المحاسب / المسؤول</div></div>
    <div><div class="sig-line">المراجعة والتدقيق</div></div>
    <div><div class="sig-line">اعتماد الإدارة المالية</div></div>
  </div>
  <div class="footer"><span>مستند محاسبي صادر من نظام Restocash ERP</span><span>صفحة 1 من 1</span></div>
  </body></html>`;

  return printRawHtml(htmlContent);
}

export function printRawHtml(htmlContent: string): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;

  try {
    // Remove any existing preview overlay
    const existingOverlay = document.getElementById("erp-print-preview-overlay");
    if (existingOverlay) {
      existingOverlay.remove();
    }

    // Extract title from HTML if available
    const titleMatch = htmlContent.match(/<title>(.*?)<\/title>/i);
    const docTitle = titleMatch?.[1] ? titleMatch[1].trim() : "معاينة وطباعة المستند المالي";

    const overlay = document.createElement("div");
    overlay.id = "erp-print-preview-overlay";
    overlay.dir = "rtl";
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,0.82);backdrop-filter:blur(4px);display:flex;flex-direction:column;font-family:'Cairo','Tajawal',system-ui,sans-serif;";

    // Top control bar
    const toolbar = document.createElement("div");
    toolbar.id = "erp-print-preview-toolbar";
    toolbar.style.cssText =
      "display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;padding:12px 20px;background:#0f172a;color:#f8fafc;border-bottom:1px solid #334155;box-shadow:0 4px 12px rgba(0,0,0,0.25);";

    const titleWrap = document.createElement("div");
    titleWrap.style.cssText = "display:flex;align-items:center;gap:10px;";
    titleWrap.innerHTML = `
      <span style="display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:10px;background:#10b981;color:#fff;font-size:18px;font-weight:900;">🖨️</span>
      <div>
        <div style="font-size:14px;font-weight:800;color:#fff;">${docTitle}</div>
        <div style="font-size:11px;color:#94a3b8;">معاينة حية للتقرير قبل الطباعة — جاهز للطباعة المباشرة أو الحفظ كملف PDF</div>
      </div>
    `;

    const actionsWrap = document.createElement("div");
    actionsWrap.style.cssText = "display:flex;align-items:center;gap:8px;flex-wrap:wrap;";

    const btnStyleBase =
      "display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;font-size:12px;font-weight:800;cursor:pointer;border:none;transition:all 0.15s ease;font-family:inherit;";

    const printBtn = document.createElement("button");
    printBtn.type = "button";
    printBtn.style.cssText = `${btnStyleBase}background:#10b981;color:#ffffff;box-shadow:0 2px 8px rgba(16,185,129,0.35);`;
    printBtn.innerHTML = "🖨️ طباعة التقرير الآن / حفظ PDF";

    const popupBtn = document.createElement("button");
    popupBtn.type = "button";
    popupBtn.style.cssText = `${btnStyleBase}background:#2563eb;color:#ffffff;`;
    popupBtn.innerHTML = "🗔 فتح في نافذة مستقلة";

    const downloadBtn = document.createElement("button");
    downloadBtn.type = "button";
    downloadBtn.style.cssText = `${btnStyleBase}background:#334155;color:#f8fafc;border:1px solid #475569;`;
    downloadBtn.innerHTML = "📥 تنزيل التقرير";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.style.cssText = `${btnStyleBase}background:#e11d48;color:#ffffff;`;
    closeBtn.innerHTML = "✕ إغلاق المعاينة";

    actionsWrap.appendChild(printBtn);
    actionsWrap.appendChild(popupBtn);
    actionsWrap.appendChild(downloadBtn);
    actionsWrap.appendChild(closeBtn);

    toolbar.appendChild(titleWrap);
    toolbar.appendChild(actionsWrap);

    // Preview container & iframe
    const previewContainer = document.createElement("div");
    previewContainer.style.cssText =
      "flex:1;overflow:auto;padding:20px;display:flex;justify-content:center;align-items:flex-start;";

    const iframe = document.createElement("iframe");
    iframe.id = "erp-print-preview-iframe";
    iframe.style.cssText =
      "width:100%;max-width:1050px;min-height:calc(100vh - 105px);background:#ffffff;border:none;border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,0.45);";

    previewContainer.appendChild(iframe);
    overlay.appendChild(toolbar);
    overlay.appendChild(previewContainer);
    document.body.appendChild(overlay);
    document.body.classList.add("erp-print-modal-open");

    const closeOverlay = () => {
      document.body.classList.remove("erp-print-modal-open");
      window.removeEventListener("keydown", onEscKey);
      overlay.remove();
    };

    const onEscKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeOverlay();
    };
    window.addEventListener("keydown", onEscKey);

    closeBtn.onclick = closeOverlay;
    overlay.onclick = (e) => {
      if (e.target === previewContainer) closeOverlay();
    };

    // Write HTML into the preview iframe
    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();
    }

    const triggerIframePrint = () => {
      try {
        if (iframe.contentWindow) {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
          return;
        }
      } catch (err) {
        console.warn("[Print Preview] iframe print fallback:", err);
      }
      // Fallback if iframe print is restricted
      const w = window.open("", "_blank", "width=1100,height=850");
      if (w) {
        w.document.write(htmlContent);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 300);
      }
    };

    printBtn.onclick = triggerIframePrint;

    popupBtn.onclick = () => {
      const w = window.open("", "_blank", "width=1100,height=850");
      if (w) {
        w.document.write(htmlContent);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 350);
      } else {
        triggerIframePrint();
      }
    };

    downloadBtn.onclick = () => {
      const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = docTitle.replace(/[^\u0600-\u06FFa-zA-Z0-9_-]+/g, "_");
      a.download = `${safeName || "financial_report"}_${new Date().toISOString().slice(0, 10)}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    };

    // Automatically trigger browser print dialog once the iframe finishes rendering
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        // User still sees the full interactive preview modal and can click Print/Download
      }
    }, 350);

    return true;
  } catch (err) {
    console.error("[Print Engine Error]", err);
    return false;
  }
}

export function printImportReportDocument(reportData: any) {
  if (!reportData || typeof window === "undefined") return false;

  const savedEntries = reportData.savedEntries || [];
  const newlyCreatedAccounts = reportData.newlyCreatedAccounts || [];

  const entriesRowsHtml = savedEntries
    .map((je: any, i: number) => {
      const totalDebit = (je.lines || []).reduce(
        (s: number, l: any) => s + (Number(l.debit) || 0),
        0,
      );
      const totalCredit = (je.lines || []).reduce(
        (s: number, l: any) => s + (Number(l.credit) || 0),
        0,
      );
      const isB = Math.abs(totalDebit - totalCredit) < 0.05;
      const currList = Array.from(
        new Set((je.lines || []).map((l: any) => l.currency || je.currency || "USD")),
      ).join(", ");

      const baseTotal = (je.lines || []).reduce((s: number, l: any) => {
        const debit = Number(l.debit || 0);
        const rate = Number(l.rate || 1);
        return s + (rate > 0 ? debit / rate : debit);
      }, 0);

      return `<tr>
      <td style="text-align:center">${i + 1}</td>
      <td style="font-weight:bold;color:#1e40af">${escapeHtml(je.reference || je.id || "-")}</td>
      <td>${escapeHtml(je.date || "-")}</td>
      <td>${escapeHtml(je.description || "-")}</td>
      <td style="text-align:center">${escapeHtml(currList)}</td>
      <td style="text-align:left;font-weight:bold">$${baseTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td style="text-align:center;font-weight:bold;color:${isB ? "#15803d" : "#b91c1c"}">${isB ? "متزن ✓" : "غير متزن ⚠️"}</td>
    </tr>`;
    })
    .join("");

  const accountsRowsHtml = newlyCreatedAccounts
    .map((acc: any) => {
      return `<tr>
      <td style="font-weight:bold;color:#1e40af">${escapeHtml(acc.code)}</td>
      <td>${escapeHtml(acc.name_ar || acc.name)}</td>
      <td>${escapeHtml(acc.type || "-")}</td>
      <td style="text-align:center">${escapeHtml(acc.currency || "USD")}</td>
    </tr>`;
    })
    .join("");

  const htmlContent = `<!doctype html><html lang="ar"><head><meta charset="utf-8"/><title>تقرير استيراد القيود المحاسبية</title><style>
  @page{size:A4 portrait;margin:12mm}
  body{font-family:Tahoma,Arial,sans-serif;color:#0f172a;margin:0;padding:16px;background:#fff;direction:rtl;text-align:right}
  h1{font-size:20px;margin:0 0 4px;color:#1e293b;text-align:center}
  .sub{color:#475569;font-size:12px;margin-bottom:18px;text-align:center}
  .summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
  .summary-card{border:1px solid #cbd5e1;border-radius:6px;padding:10px;background:#f8fafc;text-align:center}
  .summary-card .val{font-size:16px;font-weight:bold;color:#0284c7;margin-top:4px}
  .summary-card .lbl{font-size:11px;color:#64748b}
  .section-title{font-size:13px;font-weight:bold;margin-top:16px;margin-bottom:8px;color:#0f172a;border-bottom:2px solid #0284c7;padding-bottom:4px}
  table{width:100%;border-collapse:collapse;font-size:11px;margin-top:8px}
  th{background:#f1f5f9;color:#0f172a;font-weight:bold;padding:8px;border:1px solid #cbd5e1;text-align:right}
  td{border:1px solid #cbd5e1;padding:8px;vertical-align:top}
  .footer{margin-top:30px;font-size:10px;color:#64748b;display:flex;justify-content:space-between;border-top:1px solid #e2e8f0;padding-top:10px}
  @media print{
    body{print-color-adjust:exact;-webkit-print-color-adjust:exact}
  }
  </style></head><body>
  <h1>تقرير نتائج استيراد وحفظ القيود المحاسبية</h1>
  <div class="sub">نظام Restocash ERP — تاريخ الطباعة: ${new Date().toLocaleDateString("ar-EG")} ${new Date().toLocaleTimeString("ar-EG")}</div>
  
  <div class="summary-grid">
    <div class="summary-card"><div class="lbl">إجمالي القيود المحفوظة</div><div class="val">${reportData.savedEntriesCount || 0}</div></div>
    <div class="summary-card"><div class="lbl">القيود المتزنة</div><div class="val" style="color:#16a34a">${reportData.balancedEntriesCount || 0}</div></div>
    <div class="summary-card"><div class="lbl">الحسابات المضافة حديثاً</div><div class="val">${reportData.newAccountsCreated || 0}</div></div>
    <div class="summary-card"><div class="lbl">إجمالي القيمة المقومة (USD)</div><div class="val">$${(reportData.totalBaseUSD || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></div>
  </div>

  <div class="section-title">قائمة القيود المستوردة والمستقرة في اليومية (${savedEntries.length})</div>
  <table>
    <thead>
      <tr>
        <th style="text-align:center">#</th>
        <th>رقم القيد / المرجع</th>
        <th>التاريخ</th>
        <th>شرح القيد المحاسبي</th>
        <th style="text-align:center">العملات</th>
        <th style="text-align:left">الإجمالي (USD)</th>
        <th style="text-align:center">حالة الاتزان</th>
      </tr>
    </thead>
    <tbody>
      ${entriesRowsHtml || '<tr><td colspan="7" style="text-align:center">لا توجد قيود</td></tr>'}
    </tbody>
  </table>

  ${
    newlyCreatedAccounts.length > 0
      ? `
  <div class="section-title" style="margin-top:24px">الحسابات الجديدة المضافة تلقائياً لدليل الحسابات (${newlyCreatedAccounts.length})</div>
  <table>
    <thead>
      <tr>
        <th>كود الحساب</th>
        <th>اسم الحساب</th>
        <th>نوع وتصنيف الحساب</th>
        <th style="text-align:center">العملة</th>
      </tr>
    </thead>
    <tbody>
      ${accountsRowsHtml}
    </tbody>
  </table>
  `
      : ""
  }

  <div class="footer">
    <span>مستند ملخص استيراد صادر من نظام Restocash ERP</span>
    <span>صفحة 1 من 1</span>
  </div>
  </body></html>`;

  return printRawHtml(htmlContent);
}

export function printJournalEntryDocument(
  entry: any,
  accounts: any[] = [],
  formatCurrencyFn?: (val: number, curr?: string) => string,
) {
  if (!entry) return;
  const accountsMap = new Map((accounts || []).map((a: any) => [a.code, a.name_ar || a.name]));

  const rows = (entry.lines || []).map((line: any, idx: number) => {
    const accName = accountsMap.get(line.account_code) || line.account_name || "حساب محاسبي";
    const debit = Number(line.debit || 0);
    const credit = Number(line.credit || 0);
    const curr = line.currency || entry.currency || "USD";
    const fmt = formatCurrencyFn
      ? (v: number) => formatCurrencyFn(v, curr)
      : (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2 });

    return {
      index: idx + 1,
      account: `${line.account_code} - ${accName}`,
      description: line.description || entry.description || "-",
      currency: curr,
      debit: debit > 0 ? `${fmt(debit)} ${curr}` : "-",
      credit: credit > 0 ? `${fmt(credit)} ${curr}` : "-",
    };
  });

  const totalDebit = (entry.lines || []).reduce(
    (s: number, l: any) => s + (Number(l.debit) || 0),
    0,
  );
  const totalCredit = (entry.lines || []).reduce(
    (s: number, l: any) => s + (Number(l.credit) || 0),
    0,
  );
  const mainCurr = entry.currency || "USD";
  const fmt = formatCurrencyFn
    ? (v: number) => formatCurrencyFn(v, mainCurr)
    : (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2 });

  return printAccountingDocument({
    title: `سند قيد يومية عامة - رقم ${entry.reference || entry.id}`,
    subtitle: `التاريخ: ${entry.date || "-"} | البيان العام: ${entry.description || "بدون بيان"} | عملة القيد: ${mainCurr}`,
    documentNo: entry.reference || entry.id,
    columns: [
      { key: "index", label: "#", align: "center" },
      { key: "account", label: "الحساب / الدليل المحاسبي", align: "right" },
      { key: "description", label: "شرح الحركة / البيان الفرعي", align: "right" },
      { key: "currency", label: "العملة", align: "center" },
      { key: "debit", label: "جانب مدين", align: "left" },
      { key: "credit", label: "جانب دائن", align: "left" },
    ],
    rows,
    totals: [
      { label: "إجمالي الجانب المدين:", value: `${fmt(totalDebit)}` },
      { label: "إجمالي الجانب الدائن:", value: `${fmt(totalCredit)}` },
      {
        label: "حالة اتزان القيد:",
        value: Math.abs(totalDebit - totalCredit) < 0.05 ? "متزن ✓" : "غير متزن ⚠️",
      },
    ],
  });
}

export interface TreasuryMovementReportData {
  documentNo?: string;
  treasuryName: string;
  treasuryCode?: string;
  treasuryType?: string;
  treasuryCurrency?: string;
  responsibleEmployee?: string;
  branchName?: string;
  periodLabel?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  openingBalance?: number;
  totalInflow?: number;
  totalOutflow?: number;
  netMovement?: number;
  closingBalance?: number;
  currencyBreakdown?: {
    cashEGP: number;
    cashUSD: number;
    cashSSP: number;
    cardUSD: number;
    walletSSP: number;
  };
  transactions: {
    id: string;
    index: number;
    date: string;
    typeLabel: string;
    typeColor?: string;
    analyticalAccount: string;
    paymentMethodLabel: string;
    currency: string;
    inflow: number;
    outflow: number;
    runningBalance: number;
    note: string;
    reference: string;
    user: string;
  }[];
}

export function printTreasuryMovementDocument(data: TreasuryMovementReportData) {
  if (!data || typeof window === "undefined") return false;

  const docNo =
    data.documentNo ||
    `TR-DOC-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
  const printTime = new Date().toLocaleString("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const txRowsHtml = (data.transactions || [])
    .map((tx) => {
      return `<tr>
        <td style="text-align:center;font-weight:bold;color:#475569">${tx.index}</td>
        <td style="font-family:monospace;font-weight:bold;color:#1e40af">${escapeHtml(tx.id || "-")}</td>
        <td style="font-size:10px;white-space:nowrap">${escapeHtml(tx.date || "-")}</td>
        <td style="text-align:center"><span style="background:#f1f5f9;color:#0f172a;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:bold">${escapeHtml(tx.typeLabel)}</span></td>
        <td style="font-size:10px">${escapeHtml(tx.analyticalAccount || "-")}</td>
        <td style="text-align:center;font-size:10px">${escapeHtml(tx.paymentMethodLabel)} (${escapeHtml(tx.currency)})</td>
        <td style="text-align:left;font-family:monospace;font-weight:bold;color:#15803d">${tx.inflow > 0 ? `+${tx.inflow.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "-"}</td>
        <td style="text-align:left;font-family:monospace;font-weight:bold;color:#b91c1c">${tx.outflow > 0 ? `-${tx.outflow.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "-"}</td>
        <td style="text-align:left;font-family:monospace;font-weight:bold;color:#0f172a">${tx.runningBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
        <td style="font-size:10px">${escapeHtml(tx.note || "-")}</td>
        <td style="font-family:monospace;font-size:10px">${escapeHtml(tx.reference || "-")}</td>
        <td style="font-size:10px;text-align:center">${escapeHtml(tx.user || "-")}</td>
      </tr>`;
    })
    .join("");

  const bd = data.currencyBreakdown;

  const htmlContent = `<!doctype html><html lang="ar"><head><meta charset="utf-8"/><title>سند حركة ومقبوضات الخزينة - ${escapeHtml(data.treasuryName)}</title><style>
  @page{size:A4 landscape;margin:8mm}
  body{font-family:Tahoma,Arial,sans-serif;color:#0f172a;margin:0;padding:12px;background:#fff;direction:rtl;text-align:right}
  .header-box{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0284c7;padding-bottom:10px;margin-bottom:12px}
  .header-box .brand{font-size:18px;font-weight:black;color:#0284c7}
  .header-box .doc-title{font-size:16px;font-weight:bold;color:#1e293b;text-align:center}
  .header-box .meta-right{font-size:11px;color:#475569;text-align:left}
  .info-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:8px;margin-bottom:10px;font-size:11px}
  .info-item{display:flex;flex-direction:column}
  .info-item .lbl{color:#64748b;font-size:10px}
  .info-item .val{font-weight:bold;color:#0f172a}
  .kpi-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:10px}
  .kpi-card{border:1px solid #cbd5e1;border-radius:6px;padding:8px;background:#fff;text-align:center}
  .kpi-card .lbl{font-size:10px;color:#64748b;font-weight:bold}
  .kpi-card .val{font-size:14px;font-weight:bold;font-family:monospace;margin-top:2px}
  .currencies-bar{display:flex;gap:10px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;padding:6px 12px;font-size:11px;margin-bottom:10px;align-items:center;flex-wrap:wrap}
  .currencies-bar strong{color:#0284c7}
  table{width:100%;border-collapse:collapse;font-size:10.5px;margin-top:6px}
  th{background:#0f172a;color:#ffffff;font-weight:bold;padding:6px;border:1px solid #334155;text-align:right;font-size:10px}
  td{border:1px solid #cbd5e1;padding:5px;vertical-align:middle}
  tr:nth-child(even){background:#f8fafc}
  .totals-row{background:#e2e8f0;font-weight:bold;font-family:monospace}
  .signatures{margin-top:25px;display:grid;grid-template-columns:repeat(4,1fr);gap:15px;text-align:center;font-size:11px;color:#334155}
  .sig-line{border-top:1px dashed #94a3b8;margin-top:30px;padding-top:4px;font-weight:bold}
  .footer{margin-top:20px;font-size:9.5px;color:#64748b;display:flex;justify-content:space-between;border-top:1px solid #e2e8f0;padding-top:6px}
  @media print{
    body{print-color-adjust:exact;-webkit-print-color-adjust:exact}
    th{background:#0f172a !important;color:#fff !important}
  }
  </style></head><body>
  <div class="header-box">
    <div class="brand">
      Restocash ERP
      <div style="font-size:10px;color:#64748b;font-weight:normal">نظام إدارة المطاعم والخزائن المحاسبية</div>
    </div>
    <div>
      <div class="doc-title">سند كشف حركة ومقبوضات الخزينة</div>
      <div style="font-size:11px;color:#0284c7;font-weight:bold;text-align:center">${escapeHtml(data.treasuryName)} (${escapeHtml(data.treasuryCode || "حساب نقدي")})</div>
    </div>
    <div class="meta-right">
      <div><strong>رقم المستند:</strong> ${escapeHtml(docNo)}</div>
      <div><strong>تاريخ الطباعة:</strong> ${escapeHtml(printTime)}</div>
      <div><strong>الفرع:</strong> ${escapeHtml(data.branchName || "الفرع الرئيسي")}</div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-item"><span class="lbl">الخزينة / الحساب:</span><span class="val">${escapeHtml(data.treasuryName)} (${escapeHtml(data.treasuryCurrency || "MULTI")})</span></div>
    <div class="info-item"><span class="lbl">أمين الصندوق المسؤول:</span><span class="val">${escapeHtml(data.responsibleEmployee || "غير محدد")}</span></div>
    <div class="info-item"><span class="lbl">الفترة المحددة:</span><span class="val">${escapeHtml(data.periodLabel || "كامل السجل")}</span></div>
    <div class="info-item"><span class="lbl">النطاق الزمني:</span><span class="val">${data.startDate ? `${data.startDate} ${data.startTime || ""}` : "من البداية"} إلى ${data.endDate ? `${data.endDate} ${data.endTime || ""}` : "الآن"}</span></div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card"><div class="lbl">الرصيد الافتتاحي (بداية المدة)</div><div class="val" style="color:#475569">${(data.openingBalance || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</div></div>
    <div class="kpi-card"><div class="lbl">إجمالي المقبوضات / الوارد (+)</div><div class="val" style="color:#15803d">+${(data.totalInflow || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</div></div>
    <div class="kpi-card"><div class="lbl">إجمالي المدفوعات / الصادر (-)</div><div class="val" style="color:#b91c1c">-${(data.totalOutflow || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</div></div>
    <div class="kpi-card"><div class="lbl">صافي التغير المالي</div><div class="val" style="color:${(data.netMovement || 0) >= 0 ? "#15803d" : "#b91c1c"}">${(data.netMovement || 0) >= 0 ? "+" : ""}${(data.netMovement || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</div></div>
    <div class="kpi-card" style="background:#f0fdf4;border-color:#86efac"><div class="lbl" style="color:#166534">الرصيد الختامي الدفتري</div><div class="val" style="color:#15803d">${(data.closingBalance || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</div></div>
  </div>

  ${
    bd
      ? `<div class="currencies-bar">
      <span><strong>أرصدة العملات الحالية:</strong></span>
      <span>💵 نقدي (EGP): <strong>${(bd.cashEGP || 0).toLocaleString()} EGP</strong></span>
      <span>|</span>
      <span>💵 نقدي (USD): <strong>${(bd.cashUSD || 0).toLocaleString()} USD</strong></span>
      <span>|</span>
      <span>💵 نقدي (SSP): <strong>${(bd.cashSSP || 0).toLocaleString()} SSP</strong></span>
      <span>|</span>
      <span>💳 فيزا (USD): <strong>${(bd.cardUSD || 0).toLocaleString()} USD</strong></span>
      <span>|</span>
      <span>📱 محفظة (SSP): <strong>${(bd.walletSSP || 0).toLocaleString()} SSP</strong></span>
    </div>`
      : ""
  }

  <table>
    <thead>
      <tr>
        <th style="width:25px;text-align:center">#</th>
        <th style="width:75px">رقم الحركة</th>
        <th style="width:110px">التاريخ والتوقيت</th>
        <th style="width:75px;text-align:center">نوع الحركة</th>
        <th>الحساب التحليلي المقابل</th>
        <th style="width:90px;text-align:center">الدفع / العملة</th>
        <th style="width:80px;text-align:left">الوارد (+)</th>
        <th style="width:80px;text-align:left">الصادر (-)</th>
        <th style="width:85px;text-align:left">الرصيد التراكمي</th>
        <th>البيان والملاحظات</th>
        <th style="width:75px">المرجع</th>
        <th style="width:65px;text-align:center">المسؤول</th>
      </tr>
    </thead>
    <tbody>
      ${txRowsHtml || '<tr><td colspan="12" style="text-align:center;padding:20px;font-weight:bold;color:#64748b">لا توجد حركات مسجلة خلال الفترة المحددة</td></tr>'}
    </tbody>
    ${
      data.transactions && data.transactions.length > 0
        ? `<tfoot>
      <tr class="totals-row">
        <td colspan="6" style="text-align:left;font-family:Tahoma,sans-serif;padding:6px">الإجماليات الكلية للحركات (${data.transactions.length} حركة):</td>
        <td style="text-align:left;color:#15803d">+${(data.totalInflow || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
        <td style="text-align:left;color:#b91c1c">-${(data.totalOutflow || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
        <td style="text-align:left;color:#0f172a">${(data.closingBalance || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
        <td colspan="3" style="text-align:center;font-size:10px;font-family:Tahoma,sans-serif">صافي التدفق: ${(data.netMovement || 0) >= 0 ? "+" : ""}${(data.netMovement || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
      </tr>
    </tfoot>`
        : ""
    }
  </table>

  <div class="signatures">
    <div><div class="sig-line">أمين الصندوق / الكاشير</div></div>
    <div><div class="sig-line">إعداد المحاسب المسؤول</div></div>
    <div><div class="sig-line">المراجعة والتدقيق الداخلي</div></div>
    <div><div class="sig-line">اعتماد المدير المالي العام</div></div>
  </div>

  <div class="footer">
    <span>مستند وسند حركة محاسبي معتمد صادر آلياً من نظام Restocash ERP</span>
    <span>وثيقة رسمية مشفرة برقم مرجعي: ${escapeHtml(docNo)}</span>
    <span>صفحة 1 من 1</span>
  </div>
  </body></html>`;

  return printRawHtml(htmlContent);
}

export interface SmartStocktakingItemRow {
  code?: string;
  barcode?: string;
  name_ar: string;
  category?: string;
  unit: string;
  bookQuantity: number;
  minLevel?: number;
  unitCost?: number;
  warehouseName?: string;
}

export interface SmartStocktakingSheetOptions {
  warehouseName?: string;
  branchName?: string;
  blindCount?: boolean;
  reportTitle?: string;
  responsiblePerson?: string;
  items: SmartStocktakingItemRow[];
}

export function printSmartStocktakingSheet(options: SmartStocktakingSheetOptions): boolean {
  const printTime = new Date().toLocaleString("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const docNo = `STK-CNT-${Date.now().toString().slice(-6)}`;
  const blind = Boolean(options.blindCount);
  const items = options.items || [];
  const lowStockCount = items.filter((i) => i.bookQuantity <= (i.minLevel ?? 0)).length;
  const totalBookValue = items.reduce(
    (sum, i) => sum + Number(i.bookQuantity || 0) * Number(i.unitCost || 0),
    0,
  );

  const rowsHtml = items
    .map((item, idx) => {
      const isLow = item.bookQuantity <= (item.minLevel ?? 0);
      return `
      <tr>
        <td style="text-align:center;width:44px">
          <div class="check-box-main" title="مربع علامة الفحص"></div>
        </td>
        <td style="text-align:center;font-family:monospace;font-weight:bold;width:30px">${idx + 1}</td>
        <td style="font-family:monospace;font-size:10.5px;width:85px;font-weight:bold;color:#334155">
          ${escapeHtml(item.code || item.barcode || `ITM-${idx + 1}`)}
        </td>
        <td style="font-weight:bold;font-size:12px;color:#0f172a">
          ${escapeHtml(item.name_ar)}
          ${isLow && !blind ? '<span class="low-badge">نقص حد أدنى</span>' : ""}
        </td>
        <td style="font-size:10.5px;color:#475569;width:105px">
          ${escapeHtml(item.category || "خامات ومواد أولية")}
        </td>
        <td style="text-align:center;font-weight:bold;width:55px;background:#f8fafc">
          ${escapeHtml(item.unit || "وحدة")}
        </td>
        ${
          blind
            ? ""
            : `<td style="text-align:center;font-family:monospace;font-weight:bold;font-size:12px;width:78px;background:#f1f5f9;color:${isLow ? "#dc2626" : "#0f172a"}">
                ${Number(item.bookQuantity || 0).toFixed(2)}
              </td>`
        }
        <td style="width:110px;padding:4px 6px">
          <div class="write-field"></div>
        </td>
        <td style="width:95px;padding:4px 6px">
          <div class="write-field"></div>
        </td>
        <td style="width:165px;font-size:10px;color:#334155">
          <div class="cond-row">
            <span class="cond-item"><span class="mini-box"></span> سليم</span>
            <span class="cond-item"><span class="mini-box"></span> تالف</span>
            <span class="cond-item"><span class="mini-box"></span> منتهي</span>
          </div>
        </td>
      </tr>`;
    })
    .join("");

  const htmlContent = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <title>قائمة الجرد الذكي للمخزون - ${escapeHtml(docNo)}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      font-family: Tahoma, 'Segoe UI', Arial, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 8px;
      background: #ffffff;
      direction: rtl;
      text-align: right;
    }
    .header-box {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid #0f172a;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .brand { font-size: 19px; font-weight: 900; color: #0f172a; }
    .brand-sub { font-size: 10px; color: #475569; margin-top: 2px; }
    .doc-title { font-size: 17px; font-weight: 900; color: #0f172a; text-align: center; }
    .doc-subtitle {
      font-size: 11px;
      font-weight: bold;
      color: #0284c7;
      text-align: center;
      margin-top: 3px;
      background: #e0f2fe;
      padding: 2px 10px;
      border-radius: 999px;
      display: inline-block;
    }
    .meta-box { font-size: 10.5px; color: #334155; text-align: left; line-height: 1.5; }
    .info-bar {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      background: #f8fafc;
      border: 1.5px solid #cbd5e1;
      border-radius: 8px;
      padding: 8px 10px;
      margin-bottom: 10px;
      font-size: 11px;
    }
    .info-cell .lbl { font-size: 9.5px; color: #64748b; display: block; }
    .info-cell .val { font-weight: bold; color: #0f172a; font-size: 11.5px; }
    .instructions-banner {
      background: #fffbeb;
      border: 1px dashed #f59e0b;
      border-radius: 6px;
      padding: 6px 10px;
      margin-bottom: 10px;
      font-size: 10.5px;
      color: #92400e;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th {
      background: #0f172a;
      color: #ffffff;
      font-weight: bold;
      padding: 7px 5px;
      border: 1px solid #0f172a;
      font-size: 10.5px;
      text-align: right;
    }
    td {
      border: 1px solid #94a3b8;
      padding: 6px 5px;
      vertical-align: middle;
    }
    tr:nth-child(even) { background: #f8fafc; }
    tr { page-break-inside: avoid; }
    .check-box-main {
      width: 20px;
      height: 20px;
      border: 2.2px solid #0f172a;
      border-radius: 4px;
      margin: 0 auto;
      background: #ffffff;
    }
    .write-field {
      height: 24px;
      border: 1.5px dashed #64748b;
      border-radius: 4px;
      background: #ffffff;
    }
    .cond-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
    }
    .cond-item {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-weight: bold;
      font-size: 9.5px;
    }
    .mini-box {
      display: inline-block;
      width: 12px;
      height: 12px;
      border: 1.5px solid #334155;
      border-radius: 2px;
      background: #ffffff;
    }
    .low-badge {
      display: inline-block;
      margin-right: 6px;
      padding: 1px 5px;
      font-size: 9px;
      background: #fee2e2;
      color: #b91c1c;
      border: 1px solid #fca5a5;
      border-radius: 4px;
    }
    .summary-notes {
      margin-top: 12px;
      border: 1.5px solid #cbd5e1;
      border-radius: 8px;
      padding: 8px 12px;
      min-height: 58px;
      font-size: 10.5px;
      color: #475569;
    }
    .signatures {
      margin-top: 22px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      text-align: center;
      font-size: 11px;
      page-break-inside: avoid;
    }
    .sig-line {
      border-top: 1.5px dashed #475569;
      margin-top: 34px;
      padding-top: 5px;
      font-weight: bold;
      color: #0f172a;
    }
    .footer {
      margin-top: 16px;
      font-size: 9.5px;
      color: #64748b;
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #cbd5e1;
      padding-top: 6px;
    }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      th { background: #0f172a !important; color: #ffffff !important; }
    }
  </style>
</head>
<body>
  <div class="header-box">
    <div>
      <div class="brand">Restocash ERP</div>
      <div class="brand-sub">نظام إدارة المستودعات والرقابة المخزنية الذكية</div>
    </div>
    <div style="text-align:center">
      <div class="doc-title">${escapeHtml(options.reportTitle || "استمارة ومحضر الجرد الذكي للمخزون")}</div>
      <div class="doc-subtitle">${blind ? "نموذج جرد أعمى للمطابقة الميدانية (بدون إظهار الرصيد الدفتري)" : "نموذج جرد تفصيلي بالمقارنة مع الرصيد الدفتري"}</div>
    </div>
    <div class="meta-box">
      <div><strong>رقم محضر الجرد:</strong> ${escapeHtml(docNo)}</div>
      <div><strong>تاريخ وتوقيت الإصدار:</strong> ${escapeHtml(printTime)}</div>
      <div><strong>الفرع:</strong> ${escapeHtml(options.branchName || "الفرع الرئيسي")}</div>
    </div>
  </div>

  <div class="info-bar">
    <div class="info-cell">
      <span class="lbl">المستودع / المخزن المستهدف:</span>
      <span class="val">${escapeHtml(options.warehouseName || "جميع المخازن (جرد شامل)")}</span>
    </div>
    <div class="info-cell">
      <span class="lbl">إجمالي عدد الأصناف بالقائمة:</span>
      <span class="val">${items.length} صنف مخزني</span>
    </div>
    <div class="info-cell">
      <span class="lbl">أصناف دون الحد الأدنى:</span>
      <span class="val" style="color:${lowStockCount > 0 ? "#dc2626" : "#15803d"}">${lowStockCount} صنف</span>
    </div>
    <div class="info-cell">
      <span class="lbl">${blind ? "مسؤول الجرد الميداني:" : "إجمالي القيمة الدفترية:"}</span>
      <span class="val">${blind ? escapeHtml(options.responsiblePerson || "لجنة الجرد") : `${totalBookValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}</span>
    </div>
  </div>

  <div class="instructions-banner">
    <span><strong>تعليمات الجرد الذكي:</strong> ضع علامة (✓) في مربع الفحص <strong>[ ☐ ]</strong> بجانب كل صنف فور عده، واكتب الكمية الفعلية وحالة الصلاحية بدقة.</span>
    <span><strong>تاريخ الجرد الفعلي:</strong> ____ / ____ / 2026</span>
  </div>

  <table>
    <thead>
      <tr>
        <th style="text-align:center;width:44px">☐ فحص</th>
        <th style="text-align:center;width:30px">م</th>
        <th style="width:85px">كود الصنف</th>
        <th>اسم الصنف المخزني</th>
        <th style="width:105px">التصنيف</th>
        <th style="text-align:center;width:55px">الوحدة</th>
        ${blind ? "" : '<th style="text-align:center;width:78px">الرصيد الدفتري</th>'}
        <th style="text-align:center;width:110px">الكمية الفعلية المعدودة</th>
        <th style="text-align:center;width:95px">الفرق (عجز / +زيادة)</th>
        <th style="text-align:center;width:165px">حالة الصنف والصلاحية</th>
      </tr>
    </thead>
    <tbody>
      ${
        rowsHtml ||
        `<tr><td colspan="${blind ? 9 : 10}" style="text-align:center;padding:24px;font-weight:bold;color:#64748b">لا توجد أصناف مخزنية مسجلة في هذا النطاق</td></tr>`
      }
    </tbody>
  </table>

  <div class="summary-notes">
    <strong>ملاحظات لجنة الجرد والتسويات المقترحة (تلف / عجز / زيادة):</strong>
  </div>

  <div class="signatures">
    <div>
      <div class="sig-line">أمين المستودع المسؤول</div>
      <div style="font-size:9.5px;color:#64748b;margin-top:3px">الاسم والتوقيع</div>
    </div>
    <div>
      <div class="sig-line">عضو / رئيس لجنة الجرد الميداني</div>
      <div style="font-size:9.5px;color:#64748b;margin-top:3px">الاسم والتوقيع</div>
    </div>
    <div>
      <div class="sig-line">مراجعة واعتماد المدير المالي</div>
      <div style="font-size:9.5px;color:#64748b;margin-top:3px">الاسم والتوقيع والختم</div>
    </div>
  </div>

  <div class="footer">
    <span>استمارة جرد ذكية معتمدة صادرة من نظام Restocash ERP</span>
    <span>رقم المرجع: ${escapeHtml(docNo)}</span>
    <span>يرجى حفظ الأصل الموقّع في أرشيف الرقابة المخزنية</span>
  </div>
</body>
</html>`;

  return printRawHtml(htmlContent);
}

