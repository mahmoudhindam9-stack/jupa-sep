from pathlib import Path
import re

ROOT = Path('.')

# 1) Stable dedicated print helper. Avoids printing the SPA chrome and opens a
# clean A4 document so every new print control has one reliable implementation.
print_util = r'''export type PrintColumn = { key: string; label: string; align?: "left" | "center" | "right" };

const escapeHtml = (value: unknown) => {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
  };
  return String(value ?? "").replace(/[&<>\"]/g, (char) => entities[char] || char);
};

export function printAccountingDocument(options: {
  title: string;
  subtitle?: string;
  columns: PrintColumn[];
  rows: Record<string, unknown>[];
  totals?: { label: string; value: string }[];
  documentNo?: string;
}) {
  if (typeof window === "undefined") return false;
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1100,height=800");
  if (!printWindow) {
    window.alert("تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة.");
    return false;
  }
  const head = options.columns.map((column) => `<th style="text-align:${column.align || "right"}">${escapeHtml(column.label)}</th>`).join("");
  const body = options.rows.map((row) => `<tr>${options.columns.map((column) => `<td style="text-align:${column.align || "right"}">${escapeHtml(row[column.key])}</td>`).join("")}</tr>`).join("");
  const totals = (options.totals || []).map((item) => `<div class="total"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`).join("");
  printWindow.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>${escapeHtml(options.title)}</title><style>
  @page{size:A4 landscape;margin:12mm}body{font-family:Tahoma,Arial,sans-serif;color:#0f172a;margin:0;background:#fff}h1{font-size:21px;margin:0 0 4px}.sub{color:#475569;font-size:11px;margin-bottom:16px}.meta{display:flex;justify-content:space-between;font-size:11px;margin-bottom:10px;border-bottom:1px solid #cbd5e1;padding-bottom:8px}table{width:100%;border-collapse:collapse;font-size:10px}th{background:#e2e8f0;font-weight:800}th,td{border:1px solid #cbd5e1;padding:6px;vertical-align:top}.totals{margin-top:12px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.total{border:1px solid #cbd5e1;border-radius:6px;padding:8px;display:flex;justify-content:space-between;font-size:11px}.footer{margin-top:16px;font-size:9px;color:#64748b;display:flex;justify-content:space-between}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>
  <div class="meta"><span>${escapeHtml(options.documentNo || "")}</span><span>${escapeHtml(new Date().toLocaleString("ar-EG"))}</span></div>
  <h1>${escapeHtml(options.title)}</h1><div class="sub">${escapeHtml(options.subtitle || "مستند صادر من النظام المحاسبي الموحد")}</div>
  <table><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${options.columns.length}" style="text-align:center">لا توجد بيانات</td></tr>`}</tbody></table>
  <div class="totals">${totals}</div>
  <div class="footer"><span>المستند محاسبي/تشغيلي صادر من النظام</span><span>يُرجى مراجعة البيانات قبل الاعتماد</span></div>
  </body></html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => { printWindow.print(); setTimeout(() => printWindow.close(), 500); }, 250);
  return true;
}
'''
print_path = ROOT / 'src/shared/utils/printAccountingDocument.ts'
if not print_path.exists() or 'printAccountingDocument' not in print_path.read_text(encoding='utf-8'):
    print_path.write_text(print_util, encoding='utf-8')

# 2) Cashier treasury: reliable shift/date print + Excel + accounting document.
p = ROOT / 'src/routes/cashier-treasury.tsx'
s = p.read_text(encoding='utf-8')
if 'printAccountingDocument' not in s:
    anchor = 'import { inventoryService } from "@/features/inventory/services/inventoryService";\n'
    if anchor not in s: raise SystemExit('cashier import anchor missing')
    s = s.replace(anchor, anchor + 'import { printAccountingDocument } from "@/shared/utils/printAccountingDocument";\n', 1)
if 'const getCashierReportRows' not in s:
    anchor = '  const exportToExcel = () => {'
    if anchor not in s: raise SystemExit('cashier export anchor missing')
    helper = r'''  const getCashierReportRows = (fromDate = startDate, toDate = endDate) => {
    return transactions.filter((tx) => {
      const date = new Date(tx.date || tx.created_at || Date.now());
      if (fromDate && date < new Date(`${fromDate}T00:00:00`)) return false;
      if (toDate && date > new Date(`${toDate}T23:59:59`)) return false;
      return true;
    }).map((tx) => ({
      number: tx.id,
      date: new Date(tx.date || tx.created_at || Date.now()).toLocaleString("ar-EG"),
      type: ({deposit:"إيداع نقدي",sales:"مبيعات POS",withdrawal:"مسحوبات / مصاريف",transfer_in:"تحويل وارد",transfer_out:"تحويل صادر"} as any)[tx.type] || tx.type,
      method: ({cash:"كاش",card:"بطاقة / فيزا",wallet:"محفظة"} as any)[tx.payment_method || "cash"] || tx.payment_method || "-",
      currency: tx.currency || "EGP",
      amount: Number(tx.amount || 0),
      note: tx.note || "-",
      reference: tx.related_entity_id || "-",
    }));
  };

  const printCashierReport = (mode: "shift" | "range") => {
    const today = new Date().toISOString().slice(0, 10);
    const from = mode === "shift" ? today : startDate;
    const to = mode === "shift" ? today : endDate;
    const rows = getCashierReportRows(from, to);
    printAccountingDocument({
      title: mode === "shift" ? "تقرير شيفت خزينة الكاشير" : "تقرير حركات خزينة الكاشير",
      subtitle: `${from || "بداية مفتوحة"} → ${to || "نهاية مفتوحة"} | ${cashierTreasury.name_ar} | الحساب 13010130`,
      documentNo: `CASHIER-${today.replaceAll("-", "")}`,
      columns: [
        {key:"number",label:"رقم الحركة"},{key:"date",label:"التاريخ والوقت"},{key:"type",label:"نوع الحركة"},{key:"method",label:"طريقة الدفع"},
        {key:"currency",label:"العملة",align:"center"},{key:"amount",label:"المبلغ",align:"left"},{key:"note",label:"البيان"},{key:"reference",label:"المرجع"}
      ],
      rows,
      totals: [
        {label:"عدد الحركات",value:String(rows.length)},
        {label:"إجمالي مبيعات الشيفت",value:Number(shiftSalesAmount || 0).toLocaleString("en-US")},
        {label:"رصيد الخزينة الحالي",value:Number(cashierTreasury.balance || 0).toLocaleString("en-US")}
      ]
    });
  };

  const exportCashierReportToExcel = (mode: "shift" | "range") => {
    const today = new Date().toISOString().slice(0, 10);
    const from = mode === "shift" ? today : startDate;
    const to = mode === "shift" ? today : endDate;
    const rows = getCashierReportRows(from, to);
    if (!rows.length) { toast({title:"لا توجد حركات",description:"لا توجد بيانات ضمن الفترة المختارة.",variant:"destructive"}); return; }
    const ws = XLSX.utils.json_to_sheet(rows.map((r) => ({"رقم الحركة":r.number,"التاريخ والوقت":r.date,"نوع الحركة":r.type,"طريقة الدفع":r.method,"العملة":r.currency,"المبلغ":r.amount,"البيان":r.note,"المرجع":r.reference})));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "خزينة الكاشير");
    XLSX.writeFile(wb, `خزينة_الكاشير_${from || "all"}_${to || "all"}.xlsx`);
  };

'''
    s = s.replace(anchor, helper + anchor, 1)
if 'title="طباعة شيفت اليوم"' not in s:
    marker = '<Button\n              onClick={() => setExportDialogOpen(true)}'
    idx = s.find(marker)
    if idx == -1: raise SystemExit('cashier export button marker missing')
    buttons = '''<Button type="button" onClick={() => printCashierReport("shift")} variant="outline" className="border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs h-9 px-4 rounded-xl flex items-center gap-2 shadow-sm" title="طباعة شيفت اليوم"><Printer size={16}/><span>طباعة الشيفت</span></Button>
            <Button type="button" onClick={() => printCashierReport("range")} variant="outline" className="border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-xs h-9 px-4 rounded-xl flex items-center gap-2 shadow-sm" title="طباعة التاريخ المحدد"><Printer size={16}/><span>طباعة الفترة</span></Button>
            <Button type="button" onClick={() => printCashierReport("range")} variant="outline" className="border-violet-300 bg-violet-50 hover:bg-violet-100 text-violet-800 font-bold text-xs h-9 px-4 rounded-xl flex items-center gap-2 shadow-sm" title="طباعة مستند محاسبي"><FileText size={16}/><span>مستند محاسبي</span></Button>
            <Button type="button" onClick={() => exportCashierReportToExcel("range")} variant="outline" className="border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs h-9 px-4 rounded-xl flex items-center gap-2 shadow-sm" title="تصدير الفترة إلى Excel"><FileSpreadsheet size={16}/><span>Excel للفترة</span></Button>
            '''
    s = s[:idx] + buttons + s[idx:]
p.write_text(s, encoding='utf-8')

# 3) Ledger: use external helper functions so no JSX/function-scope ambiguity can arise.
p = ROOT / 'src/routes/admin/ledger.tsx'
s = p.read_text(encoding='utf-8')
if 'printAccountingDocument' not in s:
    anchor = 'import { AccountSearchSelect } from "@/components/AccountSearchSelect";\n'
    if anchor not in s: raise SystemExit('ledger import anchor missing')
    s = s.replace(anchor, anchor + 'import { printAccountingDocument } from "@/shared/utils/printAccountingDocument";\n', 1)
if 'function buildLedgerPrintRows' not in s:
    anchor = 'function LedgerPage() {'
    if anchor not in s: raise SystemExit('ledger component anchor missing')
    helper = r'''function buildLedgerPrintRows(entries: any[], accounts: any[]) {
  return (entries || []).map((entry) => ({
    date: entry.date || "-",
    reference: entry.reference || "-",
    description: entry.description || "-",
    currency: entry.currency || "EGP",
    debit: (entry.lines || []).reduce((n: number, l: any) => n + Number(l.debit || 0), 0),
    credit: (entry.lines || []).reduce((n: number, l: any) => n + Number(l.credit || 0), 0),
    accounts: (entry.lines || []).map((line: any) => `${line.account_code || ""} — ${line.account_name || accounts.find((a: any) => a.code === line.account_code)?.name_ar || "حساب غير معرف"}`).join(" | "),
  }));
}

function printLedgerDocument(rows: any[], accounting = false) {
  printAccountingDocument({
    title: accounting ? "مستند محاسبي — دفتر الأستاذ العام" : "تقرير القيود المحاسبية",
    subtitle: `عدد القيود: ${rows.length} | المصدر: دفتر الأستاذ العام الموحد`,
    documentNo: `LEDGER-${new Date().toISOString().slice(0,10).replaceAll("-","")}`,
    columns: [
      {key:"date",label:"التاريخ"},{key:"reference",label:"رقم القيد"},{key:"description",label:"البيان"},{key:"currency",label:"العملة",align:"center"},
      {key:"debit",label:"المدين",align:"left"},{key:"credit",label:"الدائن",align:"left"},{key:"accounts",label:"الحسابات وأكوادها"}
    ],
    rows,
    totals: [
      {label:"عدد القيود",value:String(rows.length)},
      {label:"إجمالي المدين",value:rows.reduce((n,r)=>n+Number(r.debit||0),0).toLocaleString("en-US")},
      {label:"إجمالي الدائن",value:rows.reduce((n,r)=>n+Number(r.credit||0),0).toLocaleString("en-US")}
    ]
  });
}

function exportLedgerDocumentToExcel(rows: any[]) {
  const flat = rows.map((r) => ({"التاريخ":r.date,"رقم القيد":r.reference,"البيان":r.description,"العملة":r.currency,"المدين":r.debit,"الدائن":r.credit,"الحسابات وأكوادها":r.accounts}));
  if (!flat.length) { window.alert("لا توجد قيود لتصديرها."); return; }
  const ws = XLSX.utils.json_to_sheet(flat); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "القيود");
  XLSX.writeFile(wb, `القيود_المحاسبية_${new Date().toISOString().slice(0,10)}.xlsx`);
}

'''
    s = s.replace(anchor, helper + anchor, 1)
# Inject only a simple JSX component immediately before the first Tabs in the render.
if 'title="طباعة القيود"' not in s:
    tabs_marker = '\n      <Tabs'
    idx = s.find(tabs_marker)
    if idx == -1: raise SystemExit('ledger Tabs render marker missing')
    controls = '''
      <div className="flex flex-wrap items-center gap-2 mb-4 print:hidden">
        <Button type="button" variant="outline" onClick={() => printLedgerDocument(buildLedgerPrintRows(erpState?.journalEntries || [], erpState?.accounts || []), false)} className="font-bold gap-2" title="طباعة القيود"><Printer size={15}/> طباعة القيود</Button>
        <Button type="button" variant="outline" onClick={() => printLedgerDocument(buildLedgerPrintRows(erpState?.journalEntries || [], erpState?.accounts || []), true)} className="font-bold gap-2" title="طباعة مستند محاسبي"><FileText size={15}/> مستند محاسبي</Button>
        <Button type="button" variant="outline" onClick={() => exportLedgerDocumentToExcel(buildLedgerPrintRows(erpState?.journalEntries || [], erpState?.accounts || []))} className="font-bold gap-2" title="تصدير القيود إلى Excel"><FileSpreadsheet size={15}/> Excel</Button>
      </div>
'''
    s = s[:idx] + controls + s[idx:]
p.write_text(s, encoding='utf-8')

# 4) Canonical account metadata: the journal and account screens share one state.
p = ROOT / 'src/shared/services/erpStore.ts'
s = p.read_text(encoding='utf-8')
if 'getCanonicalAccountDefinition(code: string' not in s:
    anchor = '  addJournalEntry(description, lines, reference, currency = "USD", date, customId) {'
    if anchor not in s: raise SystemExit('erpStore addJournalEntry anchor missing')
    helper = r'''  getCanonicalAccountDefinition(code: string, preferredName?: string) {
    const normalized = String(code || "").trim();
    const current = (this.state.accounts || []).find((account) => String(account.code) === normalized && account.name_ar && !String(account.name_ar).includes("حساب محاسبي"));
    if (current) return { code: normalized, name_ar: current.name_ar, type: current.type, level: current.level || 4, currency: current.currency || "EGP" };
    const oracle = ORACLE_MIGRATION_ACCOUNTS.find((account: any) => String(account.code) === normalized);
    if (oracle) return { code: normalized, name_ar: oracle.name_ar, type: oracle.type, level: oracle.level || 4, currency: oracle.currency || "EGP" };
    const known: Record<string, {name_ar:string,type:Account["type"]}> = {
      "101000": {name_ar:"الخزائن والنقدية الرئيسية",type:"asset"}, "101001": {name_ar:"خزائن ونقدية الفرع الثاني",type:"asset"},
      "102000": {name_ar:"البنوك والحسابات المصرفية",type:"asset"}, "103000": {name_ar:"المخزون",type:"asset"},
      "201000": {name_ar:"حسابات الموردين",type:"liability"}, "201100": {name_ar:"تأمينات مستأجري المحلات",type:"liability"},
      "201200": {name_ar:"دفعات مقدمة من المستأجرين",type:"liability"}, "202000": {name_ar:"ضرائب مستحقة",type:"liability"},
      "301000": {name_ar:"حساب التمويل ورأس المال",type:"equity"}, "401000": {name_ar:"إيرادات المبيعات",type:"revenue"},
      "502000": {name_ar:"رواتب وأجور الموظفين",type:"expense"}, "503000": {name_ar:"إيجارات الفروع",type:"expense"},
      "504000": {name_ar:"الكهرباء والمياه والطاقة",type:"expense"}, "505000": {name_ar:"التسويق والإعلانات",type:"expense"},
      "506000": {name_ar:"الهدر والمفقودات",type:"expense"}, "600000": {name_ar:"مصروفات تشغيلية متنوعة",type:"expense"},
    };
    const fallback = known[normalized] || {name_ar: preferredName || `حساب ${normalized}`, type: normalized.startsWith("4") ? "revenue" : normalized.startsWith("5") || normalized.startsWith("6") ? "expense" : normalized.startsWith("2") ? "liability" : normalized.startsWith("3") ? "equity" : "asset"};
    return { code: normalized, name_ar: fallback.name_ar, type: fallback.type, level: normalized.length >= 7 ? 4 : 3, currency: "EGP" };
  }

  ensureJournalAccounts(lines: any[], defaultCurrency = "EGP") {
    if (!Array.isArray(this.state.accounts)) this.state.accounts = [];
    (lines || []).forEach((line: any) => {
      const code = String(line?.account_code || "").trim();
      if (!code) return;
      const canonical = this.getCanonicalAccountDefinition(code, line?.account_name || line?.description);
      let account = this.state.accounts.find((item: any) => String(item.code) === code);
      if (!account) {
        account = {code:canonical.code,name_ar:canonical.name_ar,type:canonical.type,level:canonical.level,balance:0,initial_balance:0,status:"active",currency:canonical.currency || defaultCurrency,system_binding:"none"};
        this.state.accounts.push(account);
      } else if (!account.name_ar || String(account.name_ar).includes("حساب محاسبي")) {
        account.name_ar = canonical.name_ar;
      }
      account.type = account.type || canonical.type;
      account.level = account.level || canonical.level;
      account.currency = account.currency || canonical.currency || defaultCurrency;
      line.account_code = canonical.code;
      line.account_name = account.name_ar;
    });
  }

'''
    s = s.replace(anchor, helper + anchor, 1)
needle = '    if (!Array.isArray(lines) || lines.length < 2) {\n      throw new Error("A journal entry requires at least two lines");\n    }'
if 'this.ensureJournalAccounts(lines, currency || "EGP");' not in s:
    if needle not in s: raise SystemExit('journal validation block missing')
    s = s.replace(needle, needle + '\n    this.ensureJournalAccounts(lines, currency || "EGP");', 1)
# Normalize existing journal lines whenever balances are recalculated, so old generic labels also become canonical.
if 'this.ensureJournalAccounts(allJournalLines, "EGP");' not in s:
    anchor = '  recalculateAccountBalances() {\n'
    if anchor not in s: raise SystemExit('recalculate method anchor missing')
    inject = '''  recalculateAccountBalances() {\n    const allJournalLines: any[] = [];\n    (this.state.journalEntries || []).forEach((entry) => (entry.lines || []).forEach((line) => allJournalLines.push(line)));\n    this.ensureJournalAccounts(allJournalLines, "EGP");\n'''
    s = s.replace(anchor, inject, 1)
p.write_text(s, encoding='utf-8')

print('final v2 application patch complete')
