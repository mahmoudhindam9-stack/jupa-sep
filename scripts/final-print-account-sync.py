from pathlib import Path
import re

ROOT = Path('.')

# Shared browser print helper. It prints only a dedicated A4 report window,
# which avoids the common failure mode where the whole SPA/sidebar is printed.
print_util = r'''export type PrintColumn = { key: string; label: string; align?: "left" | "center" | "right" };

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>\"]/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;",
}[c]));

export function printAccountingDocument(options: {
  title: string;
  subtitle?: string;
  columns: PrintColumn[];
  rows: Record<string, unknown>[];
  totals?: { label: string; value: string }[];
  documentNo?: string;
}) {
  if (typeof window === "undefined") return false;
  const w = window.open("", "_blank", "noopener,noreferrer,width=1100,height=800");
  if (!w) {
    window.alert("تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة لهذا الموقع ثم حاول مرة أخرى.");
    return false;
  }
  const head = options.columns.map((c) => `<th style="text-align:${c.align || "right"}">${escapeHtml(c.label)}</th>`).join("");
  const body = options.rows.map((row) => `<tr>${options.columns.map((c) => `<td style="text-align:${c.align || "right"}">${escapeHtml(row[c.key])}</td>`).join("")}</tr>`).join("");
  const totals = (options.totals || []).map((t) => `<div class="total"><span>${escapeHtml(t.label)}</span><strong>${escapeHtml(t.value)}</strong></div>`).join("");
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>${escapeHtml(options.title)}</title><style>
    @page{size:A4 landscape;margin:12mm}body{font-family:Tahoma,Arial,sans-serif;color:#0f172a;margin:0;background:#fff}h1{font-size:21px;margin:0 0 4px}.sub{color:#475569;font-size:11px;margin-bottom:16px}.meta{display:flex;justify-content:space-between;font-size:11px;margin-bottom:10px;border-bottom:1px solid #cbd5e1;padding-bottom:8px}.meta b{font-size:12px}table{width:100%;border-collapse:collapse;font-size:10px}th{background:#e2e8f0;font-weight:800}th,td{border:1px solid #cbd5e1;padding:6px;vertical-align:top}.totals{margin-top:12px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.total{border:1px solid #cbd5e1;border-radius:6px;padding:8px;display:flex;justify-content:space-between;font-size:11px}.footer{margin-top:16px;font-size:9px;color:#64748b;display:flex;justify-content:space-between}button{display:none}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>
    <div class="meta"><span>${escapeHtml(options.documentNo || "")}</span><span>${escapeHtml(new Date().toLocaleString("ar-EG"))}</span></div>
    <h1>${escapeHtml(options.title)}</h1><div class="sub">${escapeHtml(options.subtitle || "مستند صادر من النظام المحاسبي الموحد")}</div>
    <table><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${options.columns.length}" style="text-align:center">لا توجد بيانات</td></tr>`}</tbody></table>
    <div class="totals">${totals}</div>
    <div class="footer"><span>المستند محاسبي/تشغيلي صادر من النظام</span><span>يُرجى مراجعة البيانات قبل الاعتماد</span></div>
    </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); setTimeout(() => w.close(), 500); }, 250);
  return true;
}
'''
p = ROOT / 'src/shared/utils/printAccountingDocument.ts'
p.write_text(print_util, encoding='utf-8')

# -------- Cashier treasury --------
p = ROOT / 'src/routes/cashier-treasury.tsx'
s = p.read_text(encoding='utf-8')

if 'printAccountingDocument' not in s:
    anchor = 'import { inventoryService } from "@/features/inventory/services/inventoryService";\n'
    if anchor not in s: raise SystemExit('cashier import anchor missing')
    s = s.replace(anchor, anchor + 'import { printAccountingDocument } from "@/shared/utils/printAccountingDocument";\n', 1)

s = s.replace('  FileSpreadsheet,\n', '  FileSpreadsheet,\n  Printer,\n  FileText,\n', 1) if '  Printer,\n' not in s else s

if 'const printCashierReport' not in s:
    anchor = '  const exportToExcel = () => {'
    if anchor not in s: raise SystemExit('cashier export anchor missing')
    block = r'''  const getCashierReportRows = (forStart: string = startDate, forEnd: string = endDate) => {
    const rows = transactions.filter((tx) => {
      const d = new Date(tx.date || tx.created_at || Date.now());
      if (forStart && d < new Date(`${forStart}T00:00:00`)) return false;
      if (forEnd && d > new Date(`${forEnd}T23:59:59`)) return false;
      return true;
    });
    return rows.map((tx) => ({
      number: tx.id,
      date: new Date(tx.date || tx.created_at || Date.now()).toLocaleString("ar-EG"),
      type: ({deposit:"إيداع نقدي",sales:"مبيعات POS",withdrawal:"مسحوبات / مصاريف",transfer_in:"تحويل وارد",transfer_out:"تحويل صادر"} as any)[tx.type] || tx.type,
      method: ({cash:"كاش",card:"بطاقة / فيزا",wallet:"محفظة"} as any)[tx.payment_method || "cash"] || tx.payment_method || "-",
      currency: tx.currency || "EGP",
      amount: Number(tx.amount || 0).toLocaleString("en-US", { maximumFractionDigits: 2 }),
      note: tx.note || "-",
      reference: tx.related_entity_id || "-",
    }));
  };

  const openCashierPrint = (mode: "shift" | "range" | "filtered" = "shift", accounting = false) => {
    let from = startDate;
    let to = endDate;
    const today = new Date();
    const todayText = today.toISOString().slice(0, 10);
    if (mode === "shift") { from = todayText; to = todayText; }
    if (mode === "filtered") { from = startDate; to = endDate; }
    const rows = getCashierReportRows(from, to);
    const title = accounting ? "مستند محاسبي — خزينة الكاشير" : mode === "shift" ? "تقرير شيفت خزينة الكاشير" : "تقرير حركات خزينة الكاشير";
    printAccountingDocument({
      title,
      subtitle: `${from || "بداية مفتوحة"} → ${to || "نهاية مفتوحة"} | الخزينة: ${cashierTreasury.name_ar} | الحساب 13010130`,
      documentNo: `CASHIER-${todayText.replaceAll("-", "")}`,
      columns: [
        { key:"number", label:"رقم الحركة" }, { key:"date", label:"التاريخ والوقت" }, { key:"type", label:"نوع الحركة" },
        { key:"method", label:"طريقة الدفع" }, { key:"currency", label:"العملة", align:"center" }, { key:"amount", label:"المبلغ", align:"left" },
        { key:"note", label:"البيان" }, { key:"reference", label:"المرجع" },
      ],
      rows,
      totals: [
        { label:"عدد الحركات", value:String(rows.length) },
        { label:"إجمالي المبيعات للشيفت", value:Number(shiftSalesAmount || 0).toLocaleString("en-US") },
        { label:"رصيد الخزينة الحالي", value:Number(cashierTreasury.balance || 0).toLocaleString("en-US") },
      ],
    });
  };

  const exportCashierRangeToExcel = (mode: "shift" | "range" | "filtered" = "shift") => {
    let from = startDate;
    let to = endDate;
    const todayText = new Date().toISOString().slice(0, 10);
    if (mode === "shift") from = to = todayText;
    const rows = getCashierReportRows(from, to).map((r) => ({"رقم الحركة":r.number,"التاريخ والوقت":r.date,"نوع الحركة":r.type,"طريقة الدفع":r.method,"العملة":r.currency,"المبلغ":r.amount,"البيان":r.note,"المرجع":r.reference}));
    if (!rows.length) { toast({ title:"لا توجد حركات", description:"لا توجد بيانات ضمن الفترة المختارة.", variant:"destructive" }); return; }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "خزينة الكاشير");
    XLSX.writeFile(wb, `خزينة_الكاشير_${from || "all"}_${to || "all"}.xlsx`);
  };

'''
    s = s.replace(anchor, block + anchor, 1)

# Add visible verified print/export controls beside the existing export control.
marker = '<Button\n              onClick={() => setExportDialogOpen(true)}'
if 'تقرير الشيفت للطباعة' not in s:
    idx = s.find(marker)
    if idx == -1: raise SystemExit('cashier export button marker missing')
    button = '''<Button
              type="button"
              onClick={() => openCashierPrint("shift")}
              variant="outline"
              className="border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs h-9 px-4 rounded-xl flex items-center gap-2 shadow-sm transition active:scale-95"
              title="طباعة شيفت اليوم"
            >
              <Printer size={16} />
              <span>طباعة الشيفت</span>
            </Button>
            <Button
              type="button"
              onClick={() => openCashierPrint("filtered")}
              variant="outline"
              className="border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-xs h-9 px-4 rounded-xl flex items-center gap-2 shadow-sm transition active:scale-95"
              title="طباعة الفترة المحددة"
            >
              <Printer size={16} />
              <span>طباعة الفترة</span>
            </Button>
            <Button
              type="button"
              onClick={() => openCashierPrint("filtered", true)}
              variant="outline"
              className="border-violet-300 bg-violet-50 hover:bg-violet-100 text-violet-800 font-bold text-xs h-9 px-4 rounded-xl flex items-center gap-2 shadow-sm transition active:scale-95"
              title="طباعة مستند محاسبي"
            >
              <FileText size={16} />
              <span>مستند محاسبي</span>
            </Button>
            <Button
              type="button"
              onClick={() => exportCashierRangeToExcel("filtered")}
              variant="outline"
              className="border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs h-9 px-4 rounded-xl flex items-center gap-2 shadow-sm transition active:scale-95"
              title="تصدير الفترة المحددة إلى Excel"
            >
              <FileSpreadsheet size={16} />
              <span>Excel للفترة</span>
            </Button>
            '''
    s = s[:idx] + button + s[idx:]
p.write_text(s, encoding='utf-8')

# -------- Ledger --------
p = ROOT / 'src/routes/admin/ledger.tsx'
s = p.read_text(encoding='utf-8')
if 'printAccountingDocument' not in s:
    anchor = 'import { AccountSearchSelect } from "@/components/AccountSearchSelect";\n'
    if anchor not in s: raise SystemExit('ledger import anchor missing')
    s = s.replace(anchor, anchor + 'import { printAccountingDocument } from "@/shared/utils/printAccountingDocument";\n', 1)

if 'const getLedgerReportRows' not in s:
    # Place helpers just before the first tab rendering section, after handlers are defined.
    anchor = '  return (\n'
    idx = s.find(anchor)
    if idx == -1: raise SystemExit('ledger return anchor missing')
    block = r'''  const getLedgerReportRows = () => {
    const entries = (erpState?.journalEntries || []).slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return entries.map((entry) => {
      const debit = (entry.lines || []).reduce((n, l) => n + Number(l.debit || 0), 0);
      const credit = (entry.lines || []).reduce((n, l) => n + Number(l.credit || 0), 0);
      return {
        date: entry.date || "-",
        reference: entry.reference || "-",
        description: entry.description || "-",
        currency: entry.currency || "EGP",
        debit: debit.toLocaleString("en-US", { maximumFractionDigits: 2 }),
        credit: credit.toLocaleString("en-US", { maximumFractionDigits: 2 }),
        lines: (entry.lines || []).map((l) => `${l.account_code || ""} — ${l.account_name || erpStore.getState().accounts.find((a) => a.code === l.account_code)?.name_ar || "حساب غير معرف"}`).join(" | "),
      };
    });
  };

  const printLedger = (accounting = false) => {
    const rows = getLedgerReportRows();
    printAccountingDocument({
      title: accounting ? "مستند محاسبي — دفتر الأستاذ" : "تقرير القيود المحاسبية",
      subtitle: `عدد القيود: ${rows.length} | جميع القيود المعروضة من نفس دفتر الأستاذ المستخدم في صفحة الحسابات`,
      documentNo: `LEDGER-${new Date().toISOString().slice(0,10).replaceAll("-","")}`,
      columns: [
        { key:"date", label:"التاريخ" }, { key:"reference", label:"رقم القيد" }, { key:"description", label:"البيان" },
        { key:"currency", label:"العملة", align:"center" }, { key:"debit", label:"إجمالي المدين", align:"left" }, { key:"credit", label:"إجمالي الدائن", align:"left" }, { key:"lines", label:"الحسابات والبيانات" },
      ],
      rows,
      totals: [
        { label:"عدد القيود", value:String(rows.length) },
        { label:"إجمالي المدين", value:rows.reduce((n,r)=>n+Number(String(r.debit).replaceAll(",", "")),0).toLocaleString("en-US") },
        { label:"إجمالي الدائن", value:rows.reduce((n,r)=>n+Number(String(r.credit).replaceAll(",", "")),0).toLocaleString("en-US") },
      ],
    });
  };

  const exportLedgerToExcel = () => {
    const rows = getLedgerReportRows();
    if (!rows.length) { toast({ title:"لا توجد قيود", description:"لا توجد قيود لتصديرها.", variant:"destructive" }); return; }
    const flat = rows.map((r) => ({"التاريخ":r.date,"رقم القيد":r.reference,"البيان":r.description,"العملة":r.currency,"المدين":r.debit,"الدائن":r.credit,"الحسابات":r.lines}));
    const ws = XLSX.utils.json_to_sheet(flat); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "القيود");
    XLSX.writeFile(wb, `القيود_المحاسبية_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

'''
    s = s[:idx] + block + s[idx:]

# Add controls immediately before first return's visible page header.
if 'طباعة القيود' not in s:
    marker = '  return (\n'
    idx = s.find(marker)
    if idx == -1: raise SystemExit('ledger return for controls missing')
    controls = '''  const verifiedPrintControls = (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <Button type="button" variant="outline" onClick={() => printLedger(false)} className="font-bold gap-2"><Printer size={15}/> طباعة القيود</Button>
      <Button type="button" variant="outline" onClick={() => printLedger(true)} className="font-bold gap-2"><FileText size={15}/> مستند محاسبي</Button>
      <Button type="button" variant="outline" onClick={exportLedgerToExcel} className="font-bold gap-2"><FileSpreadsheet size={15}/> Excel</Button>
    </div>
  );

'''
    s = s[:idx] + controls + s[idx:]
    # Render the controls directly after the main return opening element.
    s = s.replace(marker, marker + '    {verifiedPrintControls}\n', 1)
p.write_text(s, encoding='utf-8')

# -------- Canonical account synchronization --------
p = ROOT / 'src/shared/services/erpStore.ts'
s = p.read_text(encoding='utf-8')
if 'getCanonicalAccountDefinition(code' not in s:
    anchor = '  addJournalEntry(description, lines, reference, currency = "USD", date, customId) {'
    if anchor not in s: raise SystemExit('erpStore addJournalEntry anchor missing')
    helper = r'''  getCanonicalAccountDefinition(code: string, preferredName?: string) {
    const normalized = String(code || "").trim();
    const existing = (this.state.accounts || []).find((a) => String(a.code) === normalized && a.name_ar && !String(a.name_ar).includes("حساب محاسبي"));
    if (existing) return { code: normalized, name_ar: existing.name_ar, type: existing.type, level: existing.level || 4, currency: existing.currency || "EGP" };
    const oracle = ORACLE_MIGRATION_ACCOUNTS.find((a: any) => String(a.code) === normalized);
    if (oracle) return { code: normalized, name_ar: oracle.name_ar, type: oracle.type, level: oracle.level || 4, currency: oracle.currency || "EGP" };
    const common: Record<string, {name_ar:string,type:Account["type"]}> = {
      "101000": {name_ar:"الخزائن والنقدية الرئيسية",type:"asset"}, "101001": {name_ar:"خزائن ونقدية الفرع الثاني",type:"asset"},
      "102000": {name_ar:"البنوك والحسابات المصرفية",type:"asset"}, "103000": {name_ar:"المخزون",type:"asset"},
      "201000": {name_ar:"حسابات الموردين",type:"liability"}, "201100": {name_ar:"تأمينات مستأجري المحلات",type:"liability"},
      "201200": {name_ar:"دفعات مقدمة من المستأجرين",type:"liability"}, "202000": {name_ar:"ضرائب مستحقة",type:"liability"},
      "301000": {name_ar:"حساب التمويل ورأس المال",type:"equity"}, "401000": {name_ar:"إيرادات المبيعات",type:"revenue"},
      "502000": {name_ar:"رواتب وأجور الموظفين",type:"expense"}, "503000": {name_ar:"إيجارات الفروع",type:"expense"},
      "504000": {name_ar:"الكهرباء والمياه والطاقة",type:"expense"}, "505000": {name_ar:"التسويق والإعلانات",type:"expense"},
      "506000": {name_ar:"الهدر والمفقودات",type:"expense"}, "600000": {name_ar:"مصروفات تشغيلية متنوعة",type:"expense"},
    };
    const fallback = common[normalized] || { name_ar: preferredName || `حساب ${normalized}`, type: normalized.startsWith("4") ? "revenue" : normalized.startsWith("5") || normalized.startsWith("6") ? "expense" : normalized.startsWith("2") ? "liability" : normalized.startsWith("3") ? "equity" : "asset" };
    return { code: normalized, name_ar: fallback.name_ar, type: fallback.type, level: normalized.length >= 7 ? 4 : 3, currency: "EGP" };
  }

  ensureJournalAccounts(lines: any[], defaultCurrency = "EGP") {
    if (!Array.isArray(this.state.accounts)) this.state.accounts = [];
    (lines || []).forEach((line) => {
      const code = String(line?.account_code || "").trim();
      if (!code) return;
      const canonical = this.getCanonicalAccountDefinition(code, line?.account_name);
      let account = this.state.accounts.find((a) => String(a.code) === code);
      if (!account) {
        account = {
          code: canonical.code,
          name_ar: canonical.name_ar,
          type: canonical.type,
          level: canonical.level,
          balance: 0,
          initial_balance: 0,
          status: "active",
          currency: canonical.currency || defaultCurrency,
          system_binding: "none",
        };
        this.state.accounts.push(account);
      } else {
        const currentName = String(account.name_ar || "");
        if (!currentName || currentName.includes("حساب محاسبي")) account.name_ar = canonical.name_ar;
        account.type = account.type || canonical.type;
        account.level = account.level || canonical.level;
        account.currency = account.currency || canonical.currency || defaultCurrency;
      }
      line.account_code = canonical.code;
      line.account_name = account.name_ar;
    });
  }

'''
    s = s.replace(anchor, helper + anchor, 1)

# Normalize journal account names before validation and persistence.
old = '    if (!Array.isArray(lines) || lines.length < 2) {\n      throw new Error("A journal entry requires at least two lines");\n    }'
new = '    if (!Array.isArray(lines) || lines.length < 2) {\n      throw new Error("A journal entry requires at least two lines");\n    }\n    this.ensureJournalAccounts(lines, currency || "EGP");'
if old in s and 'this.ensureJournalAccounts(lines, currency || "EGP");' not in s:
    s = s.replace(old, new, 1)

# Clean generic imported account names when the canonical code exists.
if 'canonical = this.getCanonicalAccountDefinition(code' not in s:
    needle = '        if (!existingAccountCodes.has(code)) {\n          let type = "asset";'
    repl = '        const canonical = this.getCanonicalAccountDefinition(code, line.account_name || line.description);\n        if (!existingAccountCodes.has(code)) {\n          let type = canonical.type || "asset";'
    if needle in s: s = s.replace(needle, repl, 1)
    s = s.replace('            name_ar: accDisplayName,\n            type,', '            name_ar: canonical.name_ar || accDisplayName,\n            type,', 1)

# Ensure the accounts page always sees the exact same canonical records after recalc.
if 'syncCanonicalJournalAccounts()' not in s:
    anchor = '  recalculateAccountBalances() {'
    if anchor not in s: raise SystemExit('erpStore recalc anchor missing')
    helper2 = r'''  syncCanonicalJournalAccounts() {
    const lines: any[] = [];
    (this.state.journalEntries || []).forEach((entry) => (entry.lines || []).forEach((line: any) => lines.push(line)));
    this.ensureJournalAccounts(lines, "EGP");
    this.saveState();
    return this.state.accounts;
  }

'''
    s = s.replace(anchor, helper2 + anchor, 1)

p.write_text(s, encoding='utf-8')

print('final print/account sync patch prepared')
