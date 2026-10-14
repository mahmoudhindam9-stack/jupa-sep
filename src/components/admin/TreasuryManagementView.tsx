// @ts-nocheck
import React, { useState, useEffect } from "react";
import { erpStore, Treasury, TreasuryContainer } from "@/shared/services/erpStore";
import { ORACLE_MIGRATION_ACCOUNTS as oracleAccounts } from "@/shared/data/oracleAccounts";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/hooks/use-settings";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Printer,
  Coins,
  CreditCard,
  Smartphone,
  Search,
  ArrowUpRight,
  User as UserIcon,
  ArrowLeftRight,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  X,
  History,
  FileSpreadsheet,
} from "lucide-react";
import { TreasuryReportModal } from "./TreasuryReportModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const getTreasuryDisplayCurrency = (t: { name_ar?: string; currency?: string }) => {
  if (t.name_ar?.includes("دولار")) return "USD";
  if (t.name_ar?.includes("سوداني")) return "SSP";
  if (t.name_ar?.includes("مصري")) return "EGP";
  if (t.currency && t.currency !== "MULTI") return t.currency;
  return "EGP";
};

export function TreasuryManagementView() {
  const { toast } = useToast();
  const { formatPrice } = useSettings();
  const [erpState, setErpState] = useState(erpStore.getState());
  const currentBranch = erpStore.getCurrentBranch();

  useEffect(() => {
    return erpStore.subscribe(() => {
      setErpState(erpStore.getState());
    });
  }, []);

  // Modals state
  const [isTreasuryReportModalOpen, setIsTreasuryReportModalOpen] = useState(false);
  const [reportInitialTreasuryId, setReportInitialTreasuryId] = useState("all");
  const [reportInitialType, setReportInitialType] = useState<"document" | "analysis" | "shifts">(
    "document",
  );
  const [selectedTreasuryForDetails, setSelectedTreasuryForDetails] = useState<Treasury | null>(
    null,
  );
  const [treasuryToggleStatusDialog, setTreasuryToggleStatusDialog] = useState<Treasury | null>(
    null,
  );
  const [treasuryToDelete, setTreasuryToDelete] = useState<Treasury | null>(null);
  const [editingTreasury, setEditingTreasury] = useState<Treasury | null>(null);

  // New Treasury form state
  const [newTreasuryForm, setNewTreasuryForm] = useState({
    name_ar: "",
    type: "cash" as "cash" | "bank",
    currency: "EGP",
    balance: 0,
    responsible_employee: "",
    account_code: "",
    linked_to_restaurant: false,
    containers: [] as TreasuryContainer[],
  });

  // Quick Action form state
  const [treasuryForm, setTreasuryForm] = useState({
    actionType: "deposit" as "deposit" | "withdrawal" | "transfer",
    treasury_id: "",
    target_treasury_id: "",
    amount: "",
    currency: "EGP",
    note: "",
  });

  const getTreasuryFullBreakdown = (tr: Treasury) => {
    let cashEGP = 0;
    let cashUSD = 0;
    let cashSSP = 0;
    const cardUSD = 0;
    const walletSSP = 0;

    if (tr.containers && tr.containers.length > 0) {
      tr.containers.forEach((cnt) => {
        if (cnt.currency === "EGP") cashEGP += cnt.balance || 0;
        else if (cnt.currency === "USD") cashUSD += cnt.balance || 0;
        else if (cnt.currency === "SSP") cashSSP += cnt.balance || 0;
      });
    } else {
      if (tr.currency === "USD") cashUSD = tr.balance || 0;
      else if (tr.currency === "SSP") cashSSP = tr.balance || 0;
      else cashEGP = tr.balance || 0;
    }

    return { cashEGP, cashUSD, cashSSP, cardUSD, walletSSP };
  };

  const handleAddTreasury = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTreasuryForm.name_ar) return;

    const newId = `tr-${Date.now()}`;
    const newTr: Treasury = {
      id: newId,
      branch_id: currentBranch.id,
      name_ar: newTreasuryForm.name_ar,
      type: newTreasuryForm.type,
      currency: newTreasuryForm.currency,
      balance: Number(newTreasuryForm.balance) || 0,
      responsible_employee: newTreasuryForm.responsible_employee || "المسؤول العام",
      is_open: true,
      account_code: newTreasuryForm.account_code || undefined,
      linked_to_restaurant: newTreasuryForm.linked_to_restaurant,
      containers: newTreasuryForm.containers,
      updated_at: new Date().toISOString(),
    };

    erpStore.addTreasury(newTr);
    setNewTreasuryForm({
      name_ar: "",
      type: "cash",
      currency: "EGP",
      balance: 0,
      responsible_employee: "",
      account_code: "",
      linked_to_restaurant: false,
      containers: [],
    });
    toast({ title: "تم التأسيس بنجاح", description: `تمت إضافة خزينة ${newTr.name_ar}` });
  };

  const handleTreasuryAction = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(treasuryForm.amount);
    if (!amount || isNaN(amount) || amount <= 0) {
      toast({ title: "خطأ", description: "يرجى إدخال مبلغ صحيح", variant: "destructive" });
      return;
    }

    const sourceTr = erpState.treasuries.find((t) => t.id === treasuryForm.treasury_id);
    if (!sourceTr) {
      toast({ title: "خطأ", description: "يرجى تحديد الخزينة", variant: "destructive" });
      return;
    }

    if (treasuryForm.actionType === "deposit") {
      erpStore.depositToTreasury(
        sourceTr.id,
        amount,
        treasuryForm.currency,
        treasuryForm.note || "إيداع نقدي مباشر",
        "المسؤول",
      );
      toast({
        title: "تم الإيداع",
        description: `تم إيداع ${amount} ${treasuryForm.currency} بنجاح`,
      });
    } else if (treasuryForm.actionType === "withdrawal") {
      if (sourceTr.balance < amount) {
        toast({
          title: "تحذير",
          description: "رصيد الخزينة غير كافٍ للسحب",
          variant: "destructive",
        });
        return;
      }
      erpStore.withdrawFromTreasury(
        sourceTr.id,
        amount,
        treasuryForm.currency,
        treasuryForm.note || "سحب نقدي مباشر",
        "المسؤول",
      );
      toast({ title: "تم السحب", description: `تم سحب ${amount} ${treasuryForm.currency} بنجاح` });
    } else if (treasuryForm.actionType === "transfer") {
      const targetTr = erpState.treasuries.find((t) => t.id === treasuryForm.target_treasury_id);
      if (!targetTr) {
        toast({ title: "خطأ", description: "يرجى تحديد الخزينة المستلمة", variant: "destructive" });
        return;
      }
      erpStore.transferBetweenTreasuries(
        sourceTr.id,
        targetTr.id,
        amount,
        treasuryForm.currency,
        treasuryForm.note || `تحويل مالي من ${sourceTr.name_ar} إلى ${targetTr.name_ar}`,
        "المسؤول",
      );
      toast({
        title: "تم التحويل",
        description: `تم تحويل ${amount} ${treasuryForm.currency} بنجاح`,
      });
    }

    setTreasuryForm({
      actionType: "deposit",
      treasury_id: "",
      target_treasury_id: "",
      amount: "",
      currency: "EGP",
      note: "",
    });
  };

  const handleToggleTreasuryStatus = (tr: Treasury) => {
    erpStore.updateTreasury(tr.id, { is_open: !tr.is_open });
    toast({
      title: tr.is_open ? "تم إغلاق الخزينة" : "تم فتح الخزينة",
      description: `${tr.name_ar} ${tr.is_open ? "مغلقة الآن" : "مفتوحة للاستلام والتسليم"}`,
    });
    setTreasuryToggleStatusDialog(null);
  };

  const handleDeleteTreasury = (tr: Treasury) => {
    erpStore.updateTreasury(tr.id, { deleted: true });
    toast({ title: "تم حذف الخزينة", description: `تم حذف ${tr.name_ar}` });
    setTreasuryToDelete(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Quick Print & Reports Shortcut Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 rounded-3xl border border-indigo-500/30 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-right">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0 shadow-inner">
            <Printer size={24} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-base text-white">
                مركز إدارة الخزائن والصناديق النقدية والبنكية
              </h3>
              <Badge className="bg-indigo-500/30 text-indigo-200 border-indigo-400/30 text-[10px] font-black">
                سندات رسمية & Excel
              </Badge>
            </div>
            <p className="text-xs text-slate-300 font-semibold">
              إدارة الخزائن المفتوحة والمغلقة، المناقلات بين الصناديق، وتقارير وسندات حركة الخزينة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto">
          <Button
            onClick={() => {
              setReportInitialTreasuryId("all");
              setReportInitialType("document");
              setIsTreasuryReportModalOpen(true);
            }}
            className="flex-1 md:flex-none bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white font-black text-xs h-10 px-5 rounded-2xl flex items-center justify-center gap-2 shadow-md hover:shadow-indigo-500/20 active:scale-95 transition"
          >
            <Printer size={16} />
            <span>طباعة وتقارير الخزائن</span>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">
              سندات & Excel
            </span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Active Treasuries List */}
          <Card className="border border-border shadow-sm rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base font-black">
                الحسابات النقدية والبنكية النشطة للفرع
              </CardTitle>
              <CardDescription>فتح وإغلاق الخزائن ومراقبة الأرصدة المتعددة العملات</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {erpState.treasuries
                  .filter((t) => t.branch_id === currentBranch.id && !t.deleted)
                  .map((tr) => {
                    const bd = getTreasuryFullBreakdown(tr);
                    return (
                      <div
                        key={tr.id}
                        onClick={() => setSelectedTreasuryForDetails(tr)}
                        className="border border-border/80 p-4 rounded-2xl flex flex-col justify-between bg-card hover:border-primary/80 hover:shadow-md transition gap-3 cursor-pointer group relative overflow-hidden"
                      >
                        <div className="flex items-start justify-between border-b border-border/50 pb-3">
                          <div className="space-y-1 text-right">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="bg-blue-600/10 text-blue-700 dark:text-blue-300 text-[10px] font-black px-2.5 py-0.5 rounded-md border border-blue-500/30">
                                رقم الحساب:{" "}
                                {tr.account_code || (tr.id === "tr-1" ? "13010130" : "غير محدد")}
                              </span>
                              <span className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[9px] font-black px-2 py-0.5 rounded-full">
                                {tr.type === "cash" ? "خزينة كاش" : "حساب بنكي آمن"}
                              </span>
                              <span className="bg-primary/10 text-primary text-[9px] font-black px-2 py-0.5 rounded-full border border-primary/20">
                                {tr.currency === "MULTI" ? "متعدد العملات (Multi)" : tr.currency}
                              </span>
                            </div>
                            <h4 className="font-black text-base text-slate-900 dark:text-slate-100 mt-1 flex items-center gap-1.5">
                              <span>{tr.name_ar}</span>
                              <ArrowUpRight
                                size={14}
                                className="text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                              />
                            </h4>
                            <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                              <UserIcon size={12} className="text-slate-400" />
                              <span>الأمين: {tr.responsible_employee || "غير محدد"}</span>
                            </p>
                          </div>
                          <div className="text-left shrink-0">
                            <span
                              className={`text-[10px] px-2.5 py-1 rounded-full font-black inline-block ${
                                tr.is_open
                                  ? "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                                  : "text-rose-700 bg-rose-50 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200 dark:border-rose-800"
                              }`}
                            >
                              {tr.is_open ? "● مفتوحة للاستلام" : "■ مغلقة"}
                            </span>
                          </div>
                        </div>

                        {/* Balances */}
                        <div className="bg-muted/30 border border-border/60 rounded-xl p-3 space-y-1.5 text-xs font-mono">
                          <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                            <span className="font-sans font-bold flex items-center gap-1.5 text-[11px]">
                              <Coins size={13} className="text-emerald-500" />
                              نقدي (EGP):
                            </span>
                            <span className="font-black text-emerald-600 dark:text-emerald-400">
                              {bd.cashEGP.toLocaleString()} EGP
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                            <span className="font-sans font-bold flex items-center gap-1.5 text-[11px]">
                              <Coins size={13} className="text-green-500" />
                              نقدي (USD):
                            </span>
                            <span className="font-black text-green-600 dark:text-green-400">
                              {bd.cashUSD.toLocaleString()} USD
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                            <span className="font-sans font-bold flex items-center gap-1.5 text-[11px]">
                              <Coins size={13} className="text-amber-500" />
                              نقدي (SSP):
                            </span>
                            <span className="font-black text-amber-600 dark:text-amber-400">
                              {bd.cashSSP.toLocaleString()} SSP
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTreasuryForDetails(tr);
                            }}
                            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs h-9 rounded-xl flex items-center justify-center gap-2 shadow-sm transition active:scale-95"
                          >
                            <Search size={15} />
                            <span>استعلام وتفاصيل</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReportInitialTreasuryId(tr.id);
                              setReportInitialType("document");
                              setIsTreasuryReportModalOpen(true);
                            }}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/80 dark:text-indigo-300 dark:border-indigo-800 text-xs h-9 font-bold rounded-xl flex items-center gap-1.5 shrink-0 transition active:scale-95"
                          >
                            <Printer size={15} className="text-indigo-600 dark:text-indigo-400" />
                            <span>طباعة</span>
                          </Button>
                        </div>

                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="border-t border-border/60 pt-2.5 flex items-center justify-between gap-2"
                        >
                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              variant={tr.is_open ? "destructive" : "default"}
                              onClick={() => setTreasuryToggleStatusDialog(tr)}
                              className="text-[11px] font-bold h-7 py-0 px-2.5 rounded-lg"
                            >
                              {tr.is_open ? "إغلاق" : "فتح"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setTreasuryToDelete(tr)}
                              className="text-[11px] font-bold h-7 py-0 px-2.5 rounded-lg text-destructive hover:bg-destructive/10"
                            >
                              حذف
                            </Button>
                          </div>
                          <span className="text-[11px] font-bold text-muted-foreground">
                            الرصيد الإجمالي: {tr.balance.toLocaleString()} {tr.currency}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Add New Treasury Form */}
              <div className="bg-muted/40 p-4 rounded-xl border border-border mt-4 text-right">
                <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 block mb-3 text-right">
                  تأسيس خزينة أو حساب بنكي جديد:
                </h4>
                <form
                  onSubmit={handleAddTreasury}
                  className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
                >
                  <div className="text-right">
                    <Label className="text-[10px] font-bold">اسم الحساب/الخزينة</Label>
                    <Input
                      className="mt-1 h-8 text-xs font-bold text-right"
                      value={newTreasuryForm.name_ar}
                      onChange={(e) =>
                        setNewTreasuryForm((s) => ({ ...s, name_ar: e.target.value }))
                      }
                      placeholder="مثال: خزينة المشروبات، دولار"
                      required
                    />
                  </div>
                  <div className="text-right">
                    <Label className="text-[10px] font-bold">أمين الخزينة / المسؤول</Label>
                    <Input
                      className="mt-1 h-8 text-xs font-bold text-right"
                      value={newTreasuryForm.responsible_employee}
                      onChange={(e) =>
                        setNewTreasuryForm((s) => ({ ...s, responsible_employee: e.target.value }))
                      }
                      placeholder="مثال: أحمد علي"
                    />
                  </div>
                  <div className="text-right">
                    <Label className="text-[10px] font-bold">نوع الحساب والعملة</Label>
                    <div className="grid grid-cols-2 gap-1 mt-1">
                      <select
                        className="h-8 rounded-md border border-input bg-background px-1.5 text-[10px] font-bold focus:outline-none text-right"
                        value={newTreasuryForm.type}
                        onChange={(e) =>
                          setNewTreasuryForm((s) => ({
                            ...s,
                            type: e.target.value as "cash" | "bank",
                          }))
                        }
                      >
                        <option value="cash">كاش</option>
                        <option value="bank">بنكي</option>
                      </select>
                      <select
                        className="h-8 rounded-md border border-input bg-background px-1.5 text-[10px] font-bold focus:outline-none text-right"
                        value={newTreasuryForm.currency}
                        onChange={(e) =>
                          setNewTreasuryForm((s) => ({ ...s, currency: e.target.value }))
                        }
                      >
                        <option value="EGP">EGP</option>
                        <option value="USD">USD</option>
                        <option value="SSP">SSP</option>
                        <option value="MULTI">MULTI</option>
                      </select>
                    </div>
                  </div>
                  <div className="text-right">
                    <Button type="submit" size="sm" className="w-full font-bold h-8 text-xs">
                      + تأكيد التأسيس
                    </Button>
                  </div>
                </form>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Transactions Form Panel */}
        <div className="bg-card border border-border p-5 rounded-2xl space-y-4">
          <h3 className="font-bold text-base text-primary flex items-center gap-1">
            <ArrowLeftRight size={18} />
            حركات ومناقلات نقدية سريعة
          </h3>
          <p className="text-xs text-muted-foreground font-semibold">
            تسجيل حركة إيداع أو سحب نقدي مباشر أو مناقلة نقدية داخلية بين صناديق الفروع.
          </p>

          <form onSubmit={handleTreasuryAction} className="space-y-4">
            <div>
              <Label className="text-xs font-bold">نوع الإجراء</Label>
              <select
                className="w-full mt-1.5 h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-right"
                value={treasuryForm.actionType}
                onChange={(e) =>
                  setTreasuryForm((s) => ({ ...s, actionType: e.target.value as any }))
                }
              >
                <option value="deposit">إيداع كاش مباشر (+)</option>
                <option value="withdrawal">سحب كاش مباشر (-)</option>
                <option value="transfer">تحويل مالي بين الخزائن</option>
              </select>
            </div>

            <div>
              <Label className="text-xs font-bold">الخزينة المستهدفة (المصدر)</Label>
              <select
                className="w-full mt-1.5 h-9 rounded-md border border-input bg-background px-3 text-sm text-right"
                value={treasuryForm.treasury_id}
                onChange={(e) => setTreasuryForm((s) => ({ ...s, treasury_id: e.target.value }))}
                required
              >
                <option value="">اختر خزينة</option>
                {erpState.treasuries
                  .filter((t) => t.branch_id === currentBranch.id && t.is_open && !t.deleted)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name_ar} (رصيد: {t.balance.toLocaleString()}{" "}
                      {getTreasuryDisplayCurrency(t)})
                    </option>
                  ))}
              </select>
            </div>

            {treasuryForm.actionType === "transfer" && (
              <div>
                <Label className="text-xs font-bold">الخزينة المستقبلة (إلى)</Label>
                <select
                  className="w-full mt-1.5 h-9 rounded-md border border-input bg-background px-3 text-sm text-right"
                  value={treasuryForm.target_treasury_id}
                  onChange={(e) =>
                    setTreasuryForm((s) => ({ ...s, target_treasury_id: e.target.value }))
                  }
                  required
                >
                  <option value="">اختر خزينة مستلمة</option>
                  {erpState.treasuries
                    .filter((t) => t.branch_id === currentBranch.id && !t.deleted)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name_ar}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Label className="text-xs font-bold">المبلغ النقدي</Label>
                <Input
                  className="mt-1.5"
                  type="number"
                  value={treasuryForm.amount}
                  onChange={(e) => setTreasuryForm((s) => ({ ...s, amount: e.target.value }))}
                  placeholder="مثال: 5000"
                  required
                />
              </div>
              <div>
                <Label className="text-xs font-bold">العملة</Label>
                <select
                  className="w-full mt-1.5 h-9 rounded-md border border-input bg-background px-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-primary font-bold"
                  value={treasuryForm.currency}
                  onChange={(e) => setTreasuryForm((s) => ({ ...s, currency: e.target.value }))}
                >
                  <option value="EGP">EGP</option>
                  <option value="USD">USD</option>
                  <option value="SSP">SSP</option>
                </select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold">البيان والسبب</Label>
              <Input
                className="mt-1.5"
                value={treasuryForm.note}
                onChange={(e) => setTreasuryForm((s) => ({ ...s, note: e.target.value }))}
                placeholder="إيداع مبيعات، عهدة عمال، إيداع رأسمال.."
              />
            </div>

            <Button type="submit" className="w-full font-bold">
              تأكيد الإجراء على الحساب
            </Button>
          </form>
        </div>
      </div>

      {/* Treasury Report Modal */}
      <TreasuryReportModal
        isOpen={isTreasuryReportModalOpen}
        onClose={() => setIsTreasuryReportModalOpen(false)}
        initialTreasuryId={reportInitialTreasuryId}
        initialType={reportInitialType}
      />

      {/* Treasury Toggle Status Confirmation */}
      <AlertDialog
        open={!!treasuryToggleStatusDialog}
        onOpenChange={(open) => !open && setTreasuryToggleStatusDialog(null)}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">
              {treasuryToggleStatusDialog?.is_open ? "إغلاق الخزينة" : "فتح الخزينة"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              هل أنت متأكد من تغيير حالة {treasuryToggleStatusDialog?.name_ar} إلى{" "}
              {treasuryToggleStatusDialog?.is_open ? "مغلقة" : "مفتوحة للاستلام"}؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-start">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                treasuryToggleStatusDialog && handleToggleTreasuryStatus(treasuryToggleStatusDialog)
              }
            >
              تأكيد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Treasury Delete Confirmation */}
      <AlertDialog
        open={!!treasuryToDelete}
        onOpenChange={(open) => !open && setTreasuryToDelete(null)}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right text-destructive">حذف الخزينة</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              هل أنت متأكد من حذف {treasuryToDelete?.name_ar}؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-start">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => treasuryToDelete && handleDeleteTreasury(treasuryToDelete)}
            >
              تأكيد الحذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
