import { printRawHtml } from "./printAccountingDocument";

export function printCurrentPage(customTitle?: string) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  // Locate the most specific printable area currently visible on screen
  const targetEl =
    (document.querySelector('[role="dialog"] .printable-area') as HTMLElement) ||
    (document.querySelector(".printable-area") as HTMLElement) ||
    (document.getElementById("invoice") as HTMLElement) ||
    (document.getElementById("print-qr-area") as HTMLElement) ||
    (document.querySelector('[role="dialog"]') as HTMLElement) ||
    (document.querySelector("main") as HTMLElement) ||
    document.body;

  const clone = targetEl.cloneNode(true) as HTMLElement;
  // Remove scripts, overlays, non-printable buttons, and hidden elements
  clone
    .querySelectorAll(
      "script, #erp-print-preview-overlay, .no-print, .print\\:hidden, nav, aside, input[type='file']",
    )
    .forEach((el) => el.remove());

  // Also remove action buttons unless they are explicitly marked print-visible
  clone.querySelectorAll("button:not(.print-visible)").forEach((el) => el.remove());

  const headStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((el) => el.outerHTML)
    .join("\n");

  const docTitle = customTitle || document.title || "طباعة مستند النظام";
  const nowStr = new Date().toLocaleString("ar-EG");

  const htmlContent = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <title>${docTitle}</title>
  ${headStyles}
  <style>
    @page { size: A4; margin: 12mm; }
    html, body {
      background: #ffffff !important;
      color: #0f172a !important;
      font-family: 'Cairo', 'Tajawal', 'Segoe UI', Tahoma, sans-serif !important;
      direction: rtl;
      margin: 0 !important;
      padding: 16px !important;
      height: auto !important;
      overflow: visible !important;
    }
    .erp-auto-print-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 10px;
      margin-bottom: 16px;
    }
    .erp-auto-print-header h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
    }
    .no-print, .print\\:hidden { display: none !important; }
    table { width: 100% !important; border-collapse: collapse !important; }
    th, td { border: 1px solid #cbd5e1 !important; padding: 6px 8px !important; color: #0f172a !important; }
    th { background: #f1f5f9 !important; font-weight: 800 !important; }
  </style>
</head>
<body>
  <div class="erp-auto-print-header">
    <div>
      <h1>${docTitle}</h1>
      <div style="font-size:11px;color:#475569;">نظام الإدارة المالية والتشغيلية الشامل — Restocash ERP</div>
    </div>
    <div style="font-size:11px;color:#475569;text-align:left;">
      <div>تاريخ الطباعة: ${nowStr}</div>
    </div>
  </div>
  <div class="erp-printed-body">${clone.innerHTML}</div>
</body>
</html>`;

  printRawHtml(htmlContent);
}

