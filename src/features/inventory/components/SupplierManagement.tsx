// @ts-nocheck
import { useState, useMemo, useEffect } from "react";
import { erpStore, Supplier } from "@/shared/services/erpStore";
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
  AlertCircle,
  HelpCircle,
  Building2,
  Layers,
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
  const [erpState, setErpState] = useState(erpStore.getState());
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

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

      // Open celebration / alert modal showing account number created
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

  const handleDelete = (id: string) => {
    if (
      confirm(
        "هل أنت متأكد من حذف هذا المورد؟ سيبقى سجل القيود والمعاملات المحاسبية محفوظاً دائماً.",
      )
    ) {
      erpStore.deleteSupplier(id);
      toast({
        title: "تم الحذف",
        description: "تم نقل المورد إلى المحذوفات مع بقاء أرصدته في القيود العامة.",
        variant: "destructive",
      });
    }
  };

  const openTransactionDialog = (
    s: Supplier,
    type: "payment" | "invoice" | "adjustment" = "payment",
  ) => {
    const defaultTreasury = activeTreasuries[0]?.id || "";
    setTxModal({
      open: true,
      supplier: s,
      type,
      amount: "",
      currency: "USD",
      exchangeRate: "2800",
      treasuryId: defaultTreasury,
      note: "",
    });
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
          <p className="text-xs text-muted-foreground mt-1">
            عند إضافة أي مورد يتم إنشاء حساب محاسبي له تلقائياً في شجرة الحسابات (الموردون 24010) أو
            الربط مع حساب موجود، مع توليد القيود المزدوجة فوراً عند أي حركة.
          </p>
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
          <CardDescription className="text-xs">
            اختر إنشاء حساب جديد تلقائياً في شجرة الحسابات أو الربط مع حساب مورد مسجل مسبقاً.
          </CardDescription>
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
                  <label htmlFor="mode-auto" className="cursor-pointer text-xs space-y-1">
                    <span className="font-black block text-foreground">
                      إنشاء حساب محاسبي تلقائي جديد
                    </span>
                    <span className="text-muted-foreground block text-[11px]">
                      يقوم النظام بإنشاء كود حساب جديد فوراً تحت (24010 - الموردون) ويعرض لك رقم
                      الحساب المولد.
                    </span>
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
                    <span className="text-muted-foreground block text-[11px]">
                      اختر من قائمة حسابات الموردين المزامنة حالياً مع دليل الحسابات العام.
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
                  variant="outline"
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
              <Button type="submit" className="rounded-xl font-black h-10 px-6 gap-2 shadow-sm">
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
                قائمة الموردين والأرصدة المحاسبية
              </CardTitle>
              <CardDescription className="text-xs">
                انقر على زر "تسجيل حركة" لتسجيل سداد، استحقاق فاتورة، أو تسوية رصيد بالقيد المزدوج.
              </CardDescription>
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
                <th className="px-4 py-3">اسم المورد</th>
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
                        <div>{s.name_ar}</div>
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
                      <span className="inline-flex items-center gap-1 font-mono font-bold bg-muted/80 text-foreground px-2.5 py-1 rounded-lg border border-border text-xs">
                        <BookOpen size={12} className="text-primary" />
                        {s.account_code}
                      </span>
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
                        variant="default"
                        className="h-8 rounded-lg text-xs font-bold gap-1 bg-primary text-primary-foreground shadow-xs"
                        onClick={() => openTransactionDialog(s, "payment")}
                      >
                        <Receipt size={13} />
                        تسجيل حركة
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-lg text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => handleEdit(s)}
                        title="تعديل المورد"
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(s.id)}
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
                <DialogDescription className="text-xs">
                  تم ربط المورد تلقائياً بدليل الحسابات وإعداده لكافة العمليات المالية.
                </DialogDescription>
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
            <div className="flex justify-between items-center text-[11px] text-muted-foreground border-t border-border/50 pt-2">
              <span>المستوى في الشجرة:</span>
              <span>الموردون (24010) - خصوم متداولة</span>
            </div>
          </div>

          <DialogFooter className="sm:justify-start">
            <Button
              className="w-full rounded-xl font-black"
              onClick={() => setCreatedNotification((prev) => ({ ...prev, open: false }))}
            >
              تم، موافق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Record Supplier Transaction (Debit / Credit / Adjustment) */}
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
            {/* Transaction Type */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">نوع الحركة المحاسبية:</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={txModal.type === "payment" ? "default" : "outline"}
                  onClick={() => setTxModal((prev) => ({ ...prev, type: "payment" }))}
                  className="rounded-xl text-xs font-bold h-9"
                >
                  <ArrowDownLeft size={14} className="ml-1 text-emerald-400" />
                  سداد للمورد (مدين)
                </Button>
                <Button
                  type="button"
                  variant={txModal.type === "invoice" ? "default" : "outline"}
                  onClick={() => setTxModal((prev) => ({ ...prev, type: "invoice" }))}
                  className="rounded-xl text-xs font-bold h-9"
                >
                  <ArrowUpRight size={14} className="ml-1 text-rose-400" />
                  استحقاق بضاعة (دائن)
                </Button>
                <Button
                  type="button"
                  variant={txModal.type === "adjustment" ? "default" : "outline"}
                  onClick={() => setTxModal((prev) => ({ ...prev, type: "adjustment" }))}
                  className="rounded-xl text-xs font-bold h-9"
                >
                  <RefreshCw size={14} className="ml-1 text-blue-400" />
                  تسوية رصيد
                </Button>
              </div>
            </div>

            {/* Currency Selection & Exchange Rate */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-muted/40 rounded-xl border border-border/60">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">العملة الأساسية للحركة:</Label>
                <select
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-xs ring-offset-background focus:outline-none focus:ring-2 focus:ring-primary font-bold"
                  value={txModal.currency}
                  onChange={(e) =>
                    setTxModal((prev) => ({
                      ...prev,
                      currency: e.target.value as "USD" | "SSP",
                    }))
                  }
                >
                  <option value="USD">دولار أمريكي (USD $)</option>
                  <option value="SSP">جنيه سوداني (SSP)</option>
                </select>
              </div>

              {txModal.currency === "SSP" ? (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">سعر الصرف مقابل الدولار ($):</Label>
                  <Input
                    type="number"
                    value={txModal.exchangeRate}
                    onChange={(e) =>
                      setTxModal((prev) => ({ ...prev, exchangeRate: e.target.value }))
                    }
                    placeholder="مثال: 2800"
                    className="h-9 rounded-lg bg-background text-xs font-mono font-bold"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">
                    العملة المعتمدة للنظام:
                  </Label>
                  <div className="h-9 flex items-center px-3 rounded-lg bg-background/50 border border-border text-xs text-muted-foreground">
                    الدولار هو العملة الأساسية للمطعم
                  </div>
                </div>
              )}
            </div>

            {/* Amount and Treasury */}
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

              {txModal.type === "payment" ? (
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
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">
                    التوجيه المحاسبي:
                  </Label>
                  <div className="h-10 flex items-center px-3 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground">
                    {txModal.type === "invoice" ? "103000 (مخزون خامات)" : "17010100 (حساب تسويات)"}
                  </div>
                </div>
              )}
            </div>

            {/* Live Conversion Preview */}
            {txModal.currency === "SSP" && Number(txModal.amount) > 0 && (
              <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 text-xs flex justify-between items-center">
                <span className="text-muted-foreground font-bold">المعادل بالدولار الأساسي:</span>
                <span className="font-mono font-black text-primary text-sm">
                  $ {(Number(txModal.amount) / (Number(txModal.exchangeRate) || 1)).toFixed(2)} USD
                </span>
              </div>
            )}

            {/* Note / Statement */}
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
              variant="outline"
              onClick={() => setTxModal((prev) => ({ ...prev, open: false }))}
              className="rounded-xl font-bold"
            >
              إلغاء
            </Button>
            <Button
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
                <DialogDescription className="text-xs">
                  تم إدراج الحركة في دفتر اليومية العامة وحساب الأستاذ العام تلقائياً.
                </DialogDescription>
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
            {txSuccessResult.currency !== "USD" && (
              <div className="flex justify-between items-center text-[11px] text-muted-foreground border-t border-border/50 pt-2">
                <span>المعادل بالدولار الأساسي:</span>
                <span className="font-mono font-bold text-primary">
                  $ {txSuccessResult.baseUsd.toFixed(2)} USD
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="sm:justify-start">
            <Button
              className="w-full rounded-xl font-black"
              onClick={() => setTxSuccessResult((prev) => ({ ...prev, open: false }))}
            >
              تم، إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
