// @ts-nocheck
import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import * as XLSX from "xlsx";
import { erpStore, Supplier } from "@/shared/services/erpStore";
import { printAccountingDocument } from "@/shared/utils/printAccountingDocument";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Search,
  Trash2,
  UserPlus,
  Phone,
  DollarSign,
  Pencil,
  Truck,
  BookOpen,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  CheckCircle2,
  Receipt,
  FileSpreadsheet,
  Printer,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export function SupplierManagement() {
  const navigate = useNavigate();
  const [erpState, setErpState] = useState(erpStore.getState());
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTargetSupplier, setDeleteTargetSupplier] = useState<Supplier | null>(null);
  const [statementSupplier, setStatementSupplier] = useState<Supplier | null>(null);

  // Subscribe to store updates
  useEffect(() => {
    return erpStore.subscribe(() => {
      setErpState(erpStore.getState());
    });
  }, []);

  // Form State
  const [form, setForm] = useState({
    name_ar: "",
    phone: "",
    opening_balance: "0",
    accountMode: "auto", // "auto" | "existing"
    selected_account_code: "",
    currency: "USD",
  });

  // Success dialog after creating a supplier or recording a tx
  const [createdNotification, setCreatedNotification] = useState<{
    open: boolean;
    supplierName: string;
    accountCode: string;
    isNewAccount: boolean;
  }>({
    open: false,
    supplierName: "",
    accountCode: "",
    isNewAccount: false,
  });

  // Transaction Modal State
  const [txModal, setTxModal] = useState<{
    open: boolean;
    supplier: Supplier | null;
    type: "payment" | "invoice" | "adjustment";
    amount: string;
    currency: "USD" | "SSP";
    exchangeRate: string;
    treasuryId: string;
    note: string;
  }>({
    open: false,
    supplier: null,
    type: "payment",
    amount: "",
    currency: "USD",
    exchangeRate: "2800",
    treasuryId: "",
    note: "",
  });

  // Transaction confirmation dialog
  const [txSuccessResult, setTxSuccessResult] = useState<{
    open: boolean;
    reference: string;
    accountCode: string;
    supplierName: string;
    amount: number;
    currency: string;
    type: string;
    baseUsd: number;
  }>({
    open: false,
    reference: "",
    accountCode: "",
    supplierName: "",
    amount: 0,
    currency: "USD",
    type: "",
    baseUsd: 0,
  });

  // Synced accounts from Chart of Accounts under liability / suppliers (24010, 240, 201000)
  const availableSupplierAccounts = useMemo(() => {
    return erpState.accounts.filter(
      (acc) =>
        acc.code.startsWith("240") ||
        acc.code.startsWith("201000") ||
        acc.parent_code === "24010" ||
        acc.name_ar.includes("مورد"),
    );
  }, [erpState.accounts]);

  const activeTreasuries = useMemo(() => {
    return erpState.treasuries.filter((t) => !t.deleted && t.status !== "closed");
  }, [erpState.treasuries]);

  const suppliers = useMemo(() => {
    return erpState.suppliers.filter(
      (s) =>
        !s.deleted &&
        (s.name_ar.includes(search) ||
          (s.phone || "").includes(search) ||
          (s.account_code || "").includes(search)),
    );
  }, [erpState.suppliers, search]);

  // Statement rows for selected supplier
  const supplierStatementData = useMemo(() => {
    if (!statementSupplier) return null;
    const accCode = statementSupplier.account_code || "24010";
    const rows: Array<{
      id: string;
      date: string;
      reference: string;
      description: string;
      debit: number;
      credit: number;
      currency: string;
      runningBalance: number;
    }> = [];

    let running = 0;
    const sortedJournals = [...(erpState.journalEntries || [])].sort((a, b) =>
      String(a.date || "").localeCompare(String(b.date || "")),
    );

    sortedJournals.forEach((entry) => {
      (entry.lines || []).forEach((line, idx) => {
        const matchesAccount = line.account_code === accCode;
        const matchesName =
          statementSupplier.name_ar &&
          (entry.description?.includes(statementSupplier.name_ar) ||
            line.description?.includes(statementSupplier.name_ar)) &&
          line.account_code?.startsWith("240");
        if (matchesAccount || matchesName) {
          const debit = Number(line.debit) || 0;
          const credit = Number(line.credit) || 0;
          // Liability account: credit increases supplier balance, debit decreases it
          running += credit - debit;
          rows.push({
            id: `${entry.id}-${idx}`,
            date: entry.date,
            reference: entry.reference,
            description: line.description || entry.description || "حركة محاسبية",
            debit,
            credit,
            currency: line.currency || entry.currency || "USD",
            runningBalance: running,
          });
        }
      });
    });

    const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
    const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
    return {
      accCode,
      rows,
      totalDebit,
      totalCredit,
      closingBalance: running,
    };
  }, [statementSupplier, erpState.journalEntries]);

  const handleExportSupplierStatementExcel = () => {
    if (!statementSupplier || !supplierStatementData) return;
    const exportRows = supplierStatementData.rows.map((r, i) => ({
      م: i + 1,
      التاريخ: r.date,
      المرجع: r.reference,
      البيان: r.description,
      "مدين (سداد للمورد)": r.debit,
      "دائن (مشتريات / استحقاق)": r.credit,
      العملة: r.currency,
      "الرصيد التراكمي": r.runningBalance,
    }));
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "كشف حساب مورد");
    XLSX.writeFile(
      wb,
      `statement_${statementSupplier.account_code || statementSupplier.id}.xlsx`,
    );
  };

  const handlePrintSupplierStatement = () => {
    if (!statementSupplier || !supplierStatementData) return;
    printAccountingDocument({
      title: `كشف حساب مورد تفصيلي — ${statementSupplier.name_ar}`,
      subtitle: `رقم الحساب المحاسبي: ${supplierStatementData.accCode} | الهاتف: ${statementSupplier.phone || "---"}`,
      metaItems: [
        { label: "اسم المورد", value: statementSupplier.name_ar },
        { label: "رقم الحساب", value: supplierStatementData.accCode },
        { label: "إجمالي السداد (مدين)", value: `${supplierStatementData.totalDebit.toLocaleString()} $` },
        { label: "إجمالي الاستحقاق (دائن)", value: `${supplierStatementData.totalCredit.toLocaleString()} $` },
      ],
      columns: [
        { key: "date", label: "التاريخ" },
        { key: "reference", label: "المرجع" },
        { key: "description", label: "البيان وتفاصيل الحركة" },
        { key: "debit", label: "مدين (سداد)" },
        { key: "credit", label: "دائن (استحقاق)" },
        { key: "runningBalance", label: "الرصيد التراكمي" },
      ],
      rows: supplierStatementData.rows.map((r) => ({
        date: r.date,
        reference: r.reference,
        description: r.description,
        debit: r.debit > 0 ? `${r.debit.toLocaleString()} ${r.currency}` : "-",
        credit: r.credit > 0 ? `${r.credit.toLocaleString()} ${r.currency}` : "-",
        runningBalance: `${r.runningBalance.toLocaleString()} ${r.currency}`,
      })),
      totals: [
        {
          label: "إجمالي المدين (المسدد)",
          value: `${supplierStatementData.totalDebit.toLocaleString()} $`,
        },
        {
          label: "إجمالي الدائن (المستحق)",
          value: `${supplierStatementData.totalCredit.toLocaleString()} $`,
        },
        {
          label: "صافي رصيد المورد",
          value: `${supplierStatementData.closingBalance.toLocaleString()} $`,
        },
      ],
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name_ar.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى كتابة اسم المورد بشكل صحيح.",
        variant: "destructive",
      });
      return;
    }

    if (editingId) {
      erpStore.updateSupplier(editingId, {
        name_ar: form.name_ar,
        phone: form.phone,
        account_code: form.accountMode === "existing" ? form.selected_account_code : undefined,
      });
      toast({
        title: "تم تعديل المورد بنجاح",
        description: `تم تحديث بيانات المورد (${form.name_ar})`,
      });
    } else {
      const result = erpStore.addSupplier(
        form.name_ar,
        form.phone,
        Number(form.opening_balance) || 0,
        form.accountMode === "existing" ? form.selected_account_code : undefined,
        form.currency,
      );

      setCreatedNotification({
        open: true,
        supplierName: form.name_ar,
        accountCode: result.account_code,
        isNewAccount: result.isNewAccount,
      });
    }

    setForm({
      name_ar: "",
      phone: "",
      opening_balance: "0",
      accountMode: "auto",
      selected_account_code: "",
      currency: "USD",
    });
    setEditingId(null);
  };

  const handleEdit = (s: Supplier) => {
    setEditingId(s.id);
    setForm({
      name_ar: s.name_ar,
      phone: s.phone || "",
      opening_balance: String(s.balance),
      accountMode: s.account_code ? "existing" : "auto",
      selected_account_code: s.account_code || "",
      currency: s.currency || "USD",
    });
  };

  const confirmDeleteSupplier = () => {
    if (!deleteTargetSupplier) return;
    erpStore.deleteSupplier(deleteTargetSupplier.id);
    toast({
      title: "تم الحذف",
      description: "تم نقل المورد إلى المحذوفات مع بقاء أرصدته في القيود العامة.",
      variant: "destructive",
    });
    setDeleteTargetSupplier(null);
  };

  const handleExecuteTransaction = () => {
    if (!txModal.supplier) return;
    const amountNum = Number(txModal.amount);
    if (!amountNum || amountNum <= 0) {
      toast({
        title: "خطأ في المبلغ",
        description: "يرجى إدخال مبلغ صحيح أكبر من الصفر.",
        variant: "destructive",
      });
      return;
    }

    try {
      const res = erpStore.recordSupplierTransaction({
        supplier_id: txModal.supplier.id,
        type: txModal.type,
        amount: amountNum,
        currency: txModal.currency,
        exchange_rate: Number(txModal.exchangeRate) || 1,
        treasury_id: txModal.type === "payment" ? txModal.treasuryId : undefined,
        note: txModal.note,
      });

      setTxModal((prev) => ({ ...prev, open: false }));
      setTxSuccessResult({
        open: true,
        reference: res.reference,
        accountCode: res.account_code,
        supplierName: res.supplier_name,
        amount: res.amount,
        currency: res.currency,
        type: txModal.type,
        baseUsd: res.base_usd_amount,
      });
    } catch (err: any) {
      toast({
        title: "فشل تسجيل الحركة",
        description: err.message || "حدث خطأ أثناء ترحيل قيد المورد.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6 text-right">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/20 p-5 rounded-2xl border border-border/50">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <Truck className="text-primary" size={24} />
            إدارة الموردين والربط المحاسبي التلقائي
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-background px-3 py-1.5 rounded-xl border border-border shadow-xs flex items-center gap-2 text-xs font-bold">
            <span className="text-muted-foreground">إجمالي الموردين:</span>
            <span className="text-primary font-black">{suppliers.length}</span>
          </div>
        </div>
      </div>

      {/* Supplier Creation/Edit Form Card */}
      <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-muted/30 pb-3">
          <CardTitle className="text-base font-black flex items-center gap-2">
            <UserPlus className="text-primary" size={18} />
            <span>{editingId ? "تعديل بيانات المورد" : "إضافة مورد جديد مع الربط المحاسبي"}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold flex items-center gap-1">
                  <Truck size={14} className="text-primary" />
                  اسم المورد أو الشركة *
                </Label>
                <Input
                  value={form.name_ar}
                  onChange={(e) => setForm((s) => ({ ...s, name_ar: e.target.value }))}
                  placeholder="مثال: شركة النيل للتوريدات الغذائية"
                  className="rounded-xl bg-background"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold flex items-center gap-1">
                  <Phone size={14} className="text-primary" />
                  رقم الهاتف / للتواصل
                </Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                  placeholder="09xxxxxxxx / 01xxxxxxxxx"
                  className="rounded-xl bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold flex items-center gap-1">
                  <DollarSign size={14} className="text-primary" />
                  الرصيد الافتتاحي (دولار أمريكي $)
                </Label>
                <Input
                  type="number"
                  disabled={!!editingId}
                  value={form.opening_balance}
                  onChange={(e) => setForm((s) => ({ ...s, opening_balance: e.target.value }))}
                  className="rounded-xl bg-background"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Account Linkage Options */}
            <div className="p-4 rounded-xl bg-muted/40 border border-border/70 space-y-3">
              <Label className="text-xs font-black flex items-center gap-1.5 text-foreground">
                <BookOpen size={16} className="text-primary" />
                طريقة التوجيه والربط مع دليل الحسابات (شجرة 24010 - الموردون):
              </Label>

              <RadioGroup
                value={form.accountMode}
                onValueChange={(val) => setForm((s) => ({ ...s, accountMode: val }))}
                className="grid grid-cols-1 md:grid-cols-2 gap-3"
              >
                <div
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    form.accountMode === "auto"
                      ? "bg-primary/5 border-primary shadow-xs"
                      : "bg-background border-border hover:border-primary/50"
                  }`}
                  onClick={() => setForm((s) => ({ ...s, accountMode: "auto" }))}
                >
                  <RadioGroupItem value="auto" id="mode-auto" className="mt-1" />
                  <label htmlFor="mode-auto" className="cursor-pointer text-xs space-y-1.5 flex-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-black block text-foreground">
                        إنشاء حساب محاسبي تلقائي جديد بالشجرة (المستوى الرابع)
                      </span>
                      <span className="font-mono font-black text-[11px] px-2 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/30">
                        رقم الحساب القادم: {erpStore.getNextSupplierAccountCode()}
                      </span>
                    </div>
                  </label>
                </div>

                <div
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    form.accountMode === "existing"
                      ? "bg-primary/5 border-primary shadow-xs"
                      : "bg-background border-border hover:border-primary/50"
                  }`}
                  onClick={() => setForm((s) => ({ ...s, accountMode: "existing" }))}
                >
                  <RadioGroupItem value="existing" id="mode-existing" className="mt-1" />
                  <label htmlFor="mode-existing" className="cursor-pointer text-xs space-y-1">
                    <span className="font-black block text-foreground">
                      ربط مع حساب مورد موجود مسبقاً في الدليل
                    </span>
                  </label>
                </div>
              </RadioGroup>

              {form.accountMode === "existing" && (
                <div className="pt-2">
                  <Label className="text-xs font-bold mb-1.5 block">
                    اختر الحساب المحاسبي من الدليل:
                  </Label>
                  <select
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-primary"
                    value={form.selected_account_code}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, selected_account_code: e.target.value }))
                    }
                  >
                    <option value="">-- اختر حساب المورد من الدليل المحاسبي --</option>
                    {availableSupplierAccounts.map((acc) => (
                      <option key={acc.code} value={acc.code}>
                        {acc.code} - {acc.name_ar} (رصيده: {acc.balance.toLocaleString()} $)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-1">
              {editingId && (
                <Button
                  type="button"
                  variant="close"
                  onClick={() => {
                    setEditingId(null);
                    setForm({
                      name_ar: "",
                      phone: "",
                      opening_balance: "0",
                      accountMode: "auto",
                      selected_account_code: "",
                      currency: "USD",
                    });
                  }}
                  className="rounded-xl font-bold h-10 px-4"
                >
                  إلغاء التعديل
                </Button>
              )}
              <Button
                type="submit"
                variant={editingId ? "edit" : "save"}
                className="rounded-xl font-black h-10 px-6 gap-2 shadow-sm"
              >
                {editingId ? <Pencil size={16} /> : <Plus size={16} />}
                {editingId ? "تحديث بيانات المورد" : "حفظ المورد وإنشاء الحساب المحاسبي"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Active Suppliers List Card */}
      <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-muted/30 pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-black">
                قائمة الموردين والأرصدة المحاسبية (اضغط على اسم المورد لفتح كشف حسابه)
              </CardTitle>
            </div>
            <div className="relative w-full md:w-72">
              <Search
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={16}
              />
              <Input
                placeholder="بحث بالاسم، الهاتف، أو رقم الحساب..."
                className="pr-9 h-9 rounded-xl text-xs bg-background"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead className="bg-muted/50 text-muted-foreground font-bold border-b border-border/50">
              <tr>
                <th className="px-4 py-3">اسم المورد (رابط كشف الحساب)</th>
                <th className="px-4 py-3 text-center">رقم الحساب المحاسبي</th>
                <th className="px-4 py-3 text-center">الهاتف</th>
                <th className="px-4 py-3 text-center">الرصيد المالي الحالي</th>
                <th className="px-4 py-3 text-left">الإجراءات والعمليات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {suppliers.map((s) => (
                <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-bold text-foreground">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                        {s.name_ar.substring(0, 1)}
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => setStatementSupplier(s)}
                          className="app-link text-right font-black text-primary hover:text-primary/80"
                          title="اضغط لفتح كشف حساب المورد التفصيلي"
                        >
                          {s.name_ar}
                        </button>
                        {s.currency && (
                          <div className="text-[10px] text-muted-foreground">
                            العملة:{" "}
                            {s.currency === "SSP" ? "جنيه سوداني (SSP)" : "دولار أمريكي (USD $)"}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {s.account_code ? (
                      <button
                        type="button"
                        onClick={() => setStatementSupplier(s)}
                        className="app-link inline-flex items-center gap-1 font-mono font-bold bg-muted/80 text-primary px-2.5 py-1 rounded-lg border border-border text-xs"
                        title="فتح كشف حساب المورد"
                      >
                        <BookOpen size={12} className="text-primary" />
                        {s.account_code}
                      </button>
                    ) : (
                      <span className="text-muted-foreground italic text-[11px]">24010 (عام)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-muted-foreground font-mono">
                    {s.phone || "---"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block font-black px-2.5 py-0.5 rounded-full text-xs ${
                        s.balance > 0
                          ? "bg-rose-500/10 text-rose-600"
                          : s.balance < 0
                            ? "bg-blue-500/10 text-blue-600"
                            : "bg-emerald-500/10 text-emerald-600"
                      }`}
                    >
                      {Math.abs(s.balance).toLocaleString()} $
                      {s.balance > 0
                        ? " (دائن - له)"
                        : s.balance < 0
                          ? " (مدين - عليه)"
                          : " (خالص 0)"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-left">
                    <div className="flex justify-end items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="print"
                        className="h-8 rounded-lg text-xs font-bold gap-1"
                        onClick={() => setStatementSupplier(s)}
                      >
                        <BookOpen size={13} />
                        <span>كشف الحساب</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="save"
                        className="h-8 rounded-lg text-xs font-bold gap-1"
                        onClick={() =>
                          navigate({
                            to: "/admin/ledger",
                            search: { tab: "vouchers", dept: "restaurant" } as any,
                          })
                        }
                      >
                        <Receipt size={13} />
                        <span>سند صرف / فاتورة</span>
                      </Button>
                      <Button
                        size="icon"
                        variant="edit"
                        className="h-8 w-8 rounded-lg"
                        onClick={() => handleEdit(s)}
                        title="تعديل المورد"
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        size="icon"
                        variant="delete"
                        className="h-8 w-8 rounded-lg"
                        onClick={() => setDeleteTargetSupplier(s)}
                        title="حذف المورد"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {suppliers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    <Truck size={32} className="mx-auto mb-2 opacity-40" />
                    لا يوجد موردين مطابقين للبحث حالياً. يمكنك إضافة مورد جديد أعلاه.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Dialog: Supplier Detailed Account Statement (كشف حساب المورد التفصيلي) */}
      <Dialog
        open={Boolean(statementSupplier)}
        onOpenChange={(open) => !open && setStatementSupplier(null)}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto text-right rounded-2xl">
          <DialogHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <DialogTitle className="text-lg font-black flex items-center gap-2">
                  <BookOpen className="text-primary" size={20} />
                  كشف حساب المورد: {statementSupplier?.name_ar}
                </DialogTitle>
                <DialogDescription className="text-xs font-bold mt-1">
                  رقم الحساب المحاسبي:{" "}
                  <span className="font-mono text-primary">
                    #{supplierStatementData?.accCode}
                  </span>{" "}
                  | الهاتف: {statementSupplier?.phone || "---"}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="print"
                  size="sm"
                  onClick={handlePrintSupplierStatement}
                  className="gap-1.5 rounded-xl text-xs font-bold"
                >
                  <Printer size={14} />
                  طباعة كشف الحساب
                </Button>
                <Button
                  type="button"
                  variant="excel"
                  size="sm"
                  onClick={handleExportSupplierStatementExcel}
                  className="gap-1.5 rounded-xl text-xs font-bold"
                >
                  <FileSpreadsheet size={14} />
                  طباعة إكسيل (Excel)
                </Button>
                <Button
                  type="button"
                  variant="close"
                  size="sm"
                  onClick={() => setStatementSupplier(null)}
                  className="gap-1 rounded-xl text-xs font-bold"
                >
                  <X size={14} />
                  إغلاق
                </Button>
              </div>
            </div>
          </DialogHeader>

          {supplierStatementData && (
            <div className="space-y-4 my-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-xs text-muted-foreground block">
                    إجمالي المسدد للمورد (مدين)
                  </span>
                  <span className="text-base font-black font-mono text-emerald-700 dark:text-emerald-400">
                    {supplierStatementData.totalDebit.toLocaleString()} $
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <span className="text-xs text-muted-foreground block">
                    إجمالي المشتريات الآجلة / الفواتير (دائن)
                  </span>
                  <span className="text-base font-black font-mono text-rose-700 dark:text-rose-400">
                    {supplierStatementData.totalCredit.toLocaleString()} $
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                  <span className="text-xs text-muted-foreground block">
                    صافي الرصيد الحالي للمورد
                  </span>
                  <span className="text-base font-black font-mono text-primary">
                    {supplierStatementData.closingBalance.toLocaleString()} $
                  </span>
                </div>
              </div>

              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-xs text-right">
                  <thead className="bg-muted/60 text-muted-foreground font-bold border-b">
                    <tr>
                      <th className="p-3">التاريخ</th>
                      <th className="p-3">المرجع</th>
                      <th className="p-3">البيان وتفاصيل العملية</th>
                      <th className="p-3 text-center text-emerald-700">مدين (سداد)</th>
                      <th className="p-3 text-center text-rose-700">دائن (شراء آجل / فاتورة)</th>
                      <th className="p-3 text-center">الرصيد التراكمي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {supplierStatementData.rows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
                          لا توجد حركات مسجلة لهذا المورد حتى الآن.
                        </td>
                      </tr>
                    ) : (
                      supplierStatementData.rows.map((row) => (
                        <tr key={row.id} className="hover:bg-muted/20">
                          <td className="p-3 font-mono">{row.date}</td>
                          <td className="p-3 font-mono font-bold">{row.reference}</td>
                          <td className="p-3 font-medium">{row.description}</td>
                          <td className="p-3 text-center font-mono font-bold text-emerald-700">
                            {row.debit > 0 ? `${row.debit.toLocaleString()} ${row.currency}` : "-"}
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-rose-700">
                            {row.credit > 0
                              ? `${row.credit.toLocaleString()} ${row.currency}`
                              : "-"}
                          </td>
                          <td className="p-3 text-center font-mono font-black text-foreground">
                            {row.runningBalance.toLocaleString()} {row.currency}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Delete Supplier Confirmation */}
      <Dialog
        open={Boolean(deleteTargetSupplier)}
        onOpenChange={(open) => !open && setDeleteTargetSupplier(null)}
      >
        <DialogContent className="max-w-md text-right rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black">
              تأكيد حذف المورد ({deleteTargetSupplier?.name_ar})
            </DialogTitle>
            <DialogDescription className="text-xs">
              سيتم نقل المورد إلى المحذوفات مع الاحتفاظ بكافة قيوده وسنداته في دفتر اليومية العام.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-start">
            <Button
              type="button"
              variant="delete"
              onClick={confirmDeleteSupplier}
              className="rounded-xl font-bold"
            >
              تأكيد الحذف
            </Button>
            <Button
              type="button"
              variant="close"
              onClick={() => setDeleteTargetSupplier(null)}
              className="rounded-xl font-bold"
            >
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Celebration Notification on Supplier Creation with Account Number */}
      <Dialog
        open={createdNotification.open}
        onOpenChange={(open) => setCreatedNotification((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="max-w-md text-right rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-foreground">
                  تم تسجيل المورد وإنشاء الحساب بنجاح!
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>

          <div className="p-4 rounded-xl bg-muted/40 border border-border/80 space-y-2.5 my-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground font-bold">اسم المورد:</span>
              <span className="font-black text-foreground text-sm">
                {createdNotification.supplierName}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs border-t border-border/50 pt-2">
              <span className="text-muted-foreground font-bold">رقم الحساب المحاسبي المنشأ:</span>
              <span className="font-mono font-black text-primary text-base bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20">
                {createdNotification.accountCode}
              </span>
            </div>
          </div>

          <DialogFooter className="sm:justify-start">
            <Button
              variant="close"
              className="w-full rounded-xl font-black"
              onClick={() => setCreatedNotification((prev) => ({ ...prev, open: false }))}
            >
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Record Supplier Transaction */}
      <Dialog
        open={txModal.open}
        onOpenChange={(open) => setTxModal((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="max-w-lg text-right rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <Receipt className="text-primary" size={20} />
              تسجيل حركة مورد (مدين / دائن / سند سداد)
            </DialogTitle>
            <DialogDescription className="text-xs">
              المورد: <span className="font-bold text-foreground">{txModal.supplier?.name_ar}</span>{" "}
              | الحساب المحاسبي:{" "}
              <span className="font-mono font-bold text-primary">
                {txModal.supplier?.account_code || "24010"}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">نوع الحركة المحاسبية:</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={txModal.type === "payment" ? "save" : "outline"}
                  onClick={() => setTxModal((prev) => ({ ...prev, type: "payment" }))}
                  className="rounded-xl text-xs font-bold h-9"
                >
                  <ArrowDownLeft size={14} className="ml-1" />
                  سداد للمورد (مدين)
                </Button>
                <Button
                  type="button"
                  variant={txModal.type === "invoice" ? "draft" : "outline"}
                  onClick={() => setTxModal((prev) => ({ ...prev, type: "invoice" }))}
                  className="rounded-xl text-xs font-bold h-9"
                >
                  <ArrowUpRight size={14} className="ml-1" />
                  استحقاق بضاعة (دائن)
                </Button>
                <Button
                  type="button"
                  variant={txModal.type === "adjustment" ? "edit" : "outline"}
                  onClick={() => setTxModal((prev) => ({ ...prev, type: "adjustment" }))}
                  className="rounded-xl text-xs font-bold h-9"
                >
                  <RefreshCw size={14} className="ml-1" />
                  تسوية رصيد
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">
                  المبلغ ({txModal.currency === "SSP" ? "SSP" : "$"}): *
                </Label>
                <Input
                  type="number"
                  value={txModal.amount}
                  onChange={(e) => setTxModal((prev) => ({ ...prev, amount: e.target.value }))}
                  placeholder="0.00"
                  className="h-10 rounded-xl bg-background font-mono text-sm font-bold"
                />
              </div>

              {txModal.type === "payment" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">الخزينة المسدد منها: *</Label>
                  <select
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs ring-offset-background focus:outline-none focus:ring-2 focus:ring-primary"
                    value={txModal.treasuryId}
                    onChange={(e) =>
                      setTxModal((prev) => ({ ...prev, treasuryId: e.target.value }))
                    }
                  >
                    {activeTreasuries.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name_ar} ({t.currency}) - رصيدها: {t.balance.toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">البيان / ملاحظات القيد:</Label>
              <Input
                value={txModal.note}
                onChange={(e) => setTxModal((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="مثال: سداد دفعة نقدية تحت حساب توريد خامات اللحوم..."
                className="rounded-xl bg-background text-xs"
              />
            </div>
          </div>

          <DialogFooter className="sm:justify-start gap-2">
            <Button
              variant="close"
              onClick={() => setTxModal((prev) => ({ ...prev, open: false }))}
              className="rounded-xl font-bold"
            >
              إلغاء
            </Button>
            <Button
              variant="save"
              onClick={handleExecuteTransaction}
              className="rounded-xl font-black gap-2 flex-1 shadow-sm"
            >
              <CheckCircle2 size={16} />
              ترحيل الحركة وتوليد القيد المحاسبي
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Transaction Result Confirmation */}
      <Dialog
        open={txSuccessResult.open}
        onOpenChange={(open) => setTxSuccessResult((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="max-w-md text-right rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-foreground">
                  تم ترحيل قيد المورد وتحديث الخزينة!
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>

          <div className="p-4 rounded-xl bg-muted/40 border border-border/80 space-y-2.5 my-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-bold">رقم القيد / السند المرجعي:</span>
              <span className="font-mono font-black text-foreground bg-background px-2 py-0.5 rounded border border-border">
                {txSuccessResult.reference}
              </span>
            </div>
            <div className="flex justify-between items-center border-t border-border/50 pt-2">
              <span className="text-muted-foreground font-bold">المورد:</span>
              <span className="font-black text-foreground">{txSuccessResult.supplierName}</span>
            </div>
            <div className="flex justify-between items-center border-t border-border/50 pt-2">
              <span className="text-muted-foreground font-bold">رقم الحساب المحاسبي:</span>
              <span className="font-mono font-black text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                {txSuccessResult.accountCode}
              </span>
            </div>
            <div className="flex justify-between items-center border-t border-border/50 pt-2">
              <span className="text-muted-foreground font-bold">المبلغ المسجل:</span>
              <span className="font-mono font-black text-foreground text-sm">
                {txSuccessResult.amount.toLocaleString()} {txSuccessResult.currency}
              </span>
            </div>
          </div>

          <DialogFooter className="sm:justify-start">
            <Button
              variant="close"
              className="w-full rounded-xl font-black"
              onClick={() => setTxSuccessResult((prev) => ({ ...prev, open: false }))}
            >
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
