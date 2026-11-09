// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { erpStore, Treasury, TreasuryContainer } from "@/shared/services/erpStore";
import { ORACLE_MIGRATION_ACCOUNTS as oracleAccounts } from "@/shared/data/oracleAccounts";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Printer,
  Coins,
  Search,
  ArrowUpRight,
  User as UserIcon,
  ArrowLeftRight,
  Plus,
  Scale,
  Wallet,
  Sparkles,
  Link2,
} from "lucide-react";
import { TreasuryReportModal, type TreasuryReportTabType } from "./TreasuryReportModal";
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
  const [reportInitialType, setReportInitialType] = useState<TreasuryReportTabType>("document");
  const [treasuryToggleStatusDialog, setTreasuryToggleStatusDialog] = useState<Treasury | null>(
    null,
  );
  const [treasuryToDelete, setTreasuryToDelete] = useState<Treasury | null>(null);

  // New Treasury form state with automatic account creation option
  const [newTreasuryForm, setNewTreasuryForm] = useState({
    name_ar: "",
    type: "cash" as "cash" | "bank",
    currency: "EGP",
    balance: "0",
    responsible_employee: "",
    accountMode: "auto" as "auto" | "existing",
    account_code: "",
    linked_to_restaurant: false,
    containers: [] as TreasuryContainer[],
  });

  // Compute next suggested account code whenever type or accounts change
  const suggestedAccountCode = useMemo(() => {
    return erpStore.getNextTreasuryAccountCode(newTreasuryForm.type);
  }, [newTreasuryForm.type, erpState.accounts, erpState.treasuries]);

  const availableAccountsToLink = useMemo(() => {
    const map = new Map<string, { code: string; name_ar: string; type: string }>();
    (erpState.accounts || []).forEach((a) => {
      if (a.code && (a.type === "asset" || a.code.startsWith("1"))) {
        map.set(String(a.code), { code: String(a.code), name_ar: a.name_ar, type: a.type });
      }
    });
    (oracleAccounts || []).forEach((a: any) => {
      if (a.code && (a.type === "asset" || String(a.code).startsWith("1")) && !map.has(String(a.code))) {
        map.set(String(a.code), { code: String(a.code), name_ar: a.name_ar, type: a.type });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [erpState.accounts]);

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
    if (!newTreasuryForm.name_ar.trim()) {
      toast({
        title: "يرجى إدخال اسم الخزينة",
        description: "اسم الخزينة أو الحساب البنكي حقل إلزامي.",
        variant: "destructive",
      });
      return;
    }

    const openingBal = Number(newTreasuryForm.balance) || 0;
    const targetCode =
      newTreasuryForm.accountMode === "auto"
        ? newTreasuryForm.account_code.trim() || suggestedAccountCode
        : newTreasuryForm.account_code.trim();

    const createdTr = erpStore.addTreasury({
      branch_id: currentBranch.id,
      name_ar: newTreasuryForm.name_ar.trim(),
      type: newTreasuryForm.type,
      currency: newTreasuryForm.currency,
      balance: openingBal,
      opening_balance: openingBal,
      responsible_employee: newTreasuryForm.responsible_employee.trim() || "المسؤول العام",
      account_code: targetCode || undefined,
      auto_create_account: newTreasuryForm.accountMode === "auto",
      linked_to_restaurant: newTreasuryForm.linked_to_restaurant,
      containers: newTreasuryForm.containers,
    });

    setNewTreasuryForm({
      name_ar: "",
      type: "cash",
      currency: "EGP",
      balance: "0",
      responsible_employee: "",
      accountMode: "auto",
      account_code: "",
      linked_to_restaurant: false,
      containers: [],
    });

    toast({
      title: "✅ تم تأسيس الخزينة وإنشاء حسابها المحاسبي",
      description: `تم إضافة "${createdTr.name_ar}" وربطها بالحساب الشجري رقم (${createdTr.account_code || targetCode}) في شجرة الحسابات تلقائياً.`,
    });
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
        description: `تم إيداع ${amount.toLocaleString()} ${treasuryForm.currency} بنجاح`,
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
      toast({
        title: "تم السحب",
        description: `تم سحب ${amount.toLocaleString()} ${treasuryForm.currency} بنجاح`,
      });
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
        description: `تم تحويل ${amount.toLocaleString()} ${treasuryForm.currency} بنجاح`,
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

  const branchTreasuries = useMemo(
    () => erpState.treasuries.filter((t) => t.branch_id === currentBranch.id && !t.deleted),
    [erpState.treasuries, currentBranch.id],
  );

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        {/* Active Treasuries List */}
        <Card className="border border-border shadow-sm rounded-2xl">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-black">
                الحسابات النقدية والبنكية النشطة للفرع ({branchTreasuries.length})
              </CardTitle>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setReportInitialTreasuryId("all");
                setReportInitialType("combined");
                setIsTreasuryReportModalOpen(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl gap-1.5 cursor-pointer"
            >
              <Printer size={14} />
              <span>تقرير وحركات الخزائن</span>
            </Button>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {branchTreasuries.map((tr) => {
                const bd = getTreasuryFullBreakdown(tr);
                return (
                  <div
                    key={tr.id}
                    onClick={() => {
                      setReportInitialTreasuryId(tr.id);
                      setReportInitialType("document");
                      setIsTreasuryReportModalOpen(true);
                    }}
                    className="border border-border/80 p-4 rounded-2xl flex flex-col justify-between bg-card hover:border-primary/80 hover:shadow-md transition gap-3 cursor-pointer group relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between border-b border-border/50 pb-3">
                      <div className="space-y-1 text-right">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="bg-blue-600/10 text-blue-700 dark:text-blue-300 text-[10px] font-black px-2.5 py-0.5 rounded-md border border-blue-500/30 font-mono">
                            حساب شجري:{" "}
                            {tr.account_code || (tr.id === "tr-1" ? "13010130" : "13010100")}
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

                    {/* Individual Treasury Print & Period Balance Actions */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReportInitialTreasuryId(tr.id);
                          setReportInitialType("document");
                          setIsTreasuryReportModalOpen(true);
                        }}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs h-9 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95"
                      >
                        <Printer size={14} />
                        <span>تقرير الخزينة منفردة</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReportInitialTreasuryId(tr.id);
                          setReportInitialType("combined");
                          setIsTreasuryReportModalOpen(true);
                        }}
                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/80 dark:text-indigo-300 dark:border-indigo-800 text-xs h-9 font-bold rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95"
                      >
                        <Scale size={14} className="text-indigo-600 dark:text-indigo-400" />
                        <span>الرصيد في فترة</span>
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

            {/* Add New Treasury Form with Automatic Chart of Accounts Creation */}
            <div className="bg-muted/40 p-4 rounded-2xl border border-indigo-500/30 mt-4 text-right space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-black text-sm text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Plus size={16} className="text-indigo-600" />
                  <span>تأسيس خزينة أو حساب بنكي جديد (مع إنشاء الحساب المحاسبي تلقائياً):</span>
                </h4>
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
                  يدعم التوليد التلقائي في شجرة الحسابات
                </Badge>
              </div>

              <form onSubmit={handleAddTreasury} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="text-right">
                    <Label className="text-[11px] font-bold">اسم الخزينة / الحساب البنكي *</Label>
                    <Input
                      className="mt-1 h-9 text-xs font-bold text-right"
                      value={newTreasuryForm.name_ar}
                      onChange={(e) =>
                        setNewTreasuryForm((s) => ({ ...s, name_ar: e.target.value }))
                      }
                      placeholder="مثال: خزينة المبيعات المسائية USD"
                      required
                    />
                  </div>

                  <div className="text-right">
                    <Label className="text-[11px] font-bold">أمين الخزينة / المسؤول</Label>
                    <Input
                      className="mt-1 h-9 text-xs font-bold text-right"
                      value={newTreasuryForm.responsible_employee}
                      onChange={(e) =>
                        setNewTreasuryForm((s) => ({
                          ...s,
                          responsible_employee: e.target.value,
                        }))
                      }
                      placeholder="مثال: أحمد علي"
                    />
                  </div>

                  <div className="text-right">
                    <Label className="text-[11px] font-bold">نوع الخزينة والعملة</Label>
                    <div className="grid grid-cols-2 gap-1.5 mt-1">
                      <select
                        className="h-9 rounded-md border border-input bg-background px-2 text-xs font-bold focus:outline-none text-right"
                        value={newTreasuryForm.type}
                        onChange={(e) =>
                          setNewTreasuryForm((s) => ({
                            ...s,
                            type: e.target.value as "cash" | "bank",
                            account_code: "",
                          }))
                        }
                      >
                        <option value="cash">خزينة كاش</option>
                        <option value="bank">حساب بنكي</option>
                      </select>
                      <select
                        className="h-9 rounded-md border border-input bg-background px-2 text-xs font-bold focus:outline-none text-right"
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
                    <Label className="text-[11px] font-bold">الرصيد الافتتاحي</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      className="mt-1 h-9 text-xs font-mono font-bold text-right"
                      value={newTreasuryForm.balance}
                      onChange={(e) =>
                        setNewTreasuryForm((s) => ({ ...s, balance: e.target.value }))
                      }
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Account Creation / Linking Bar */}
                <div className="bg-background/90 border border-border rounded-xl p-3 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                  <div className="lg:col-span-6 flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-foreground">
                      أسلوب ربط شجرة الحسابات:
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setNewTreasuryForm((s) => ({
                          ...s,
                          accountMode: "auto",
                          account_code: "",
                        }))
                      }
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                        newTreasuryForm.accountMode === "auto"
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                          : "bg-muted/40 text-muted-foreground border-border"
                      }`}
                    >
                      <Sparkles size={13} />
                      <span>إنشاء حساب جديد تلقائياً ({suggestedAccountCode})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setNewTreasuryForm((s) => ({
                          ...s,
                          accountMode: "existing",
                          account_code: "",
                        }))
                      }
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                        newTreasuryForm.accountMode === "existing"
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                          : "bg-muted/40 text-muted-foreground border-border"
                      }`}
                    >
                      <Link2 size={13} />
                      <span>ربط بحساب موجود</span>
                    </button>
                  </div>

                  <div className="lg:col-span-4">
                    {newTreasuryForm.accountMode === "auto" ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-muted-foreground shrink-0">
                          رقم الحساب الجديد:
                        </span>
                        <Input
                          className="h-8 text-xs font-mono font-bold text-center"
                          value={newTreasuryForm.account_code || suggestedAccountCode}
                          onChange={(e) =>
                            setNewTreasuryForm((s) => ({ ...s, account_code: e.target.value }))
                          }
                          placeholder={suggestedAccountCode}
                        />
                      </div>
                    ) : (
                      <select
                        className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs font-bold text-right"
                        value={newTreasuryForm.account_code}
                        onChange={(e) =>
                          setNewTreasuryForm((s) => ({ ...s, account_code: e.target.value }))
                        }
                        required={newTreasuryForm.accountMode === "existing"}
                      >
                        <option value="">-- اختر الحساب من الدليل المحاسبي --</option>
                        {availableAccountsToLink.map((acc) => (
                          <option key={acc.code} value={acc.code}>
                            {acc.code} - {acc.name_ar}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="lg:col-span-2">
                    <Button
                      type="submit"
                      size="sm"
                      className="w-full font-black h-9 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
                    >
                      + تأسيس الخزينة والحساب
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Treasury Report Modal */}
      <TreasuryReportModal
        isOpen={isTreasuryReportModalOpen}
        onClose={() => setIsTreasuryReportModalOpen(false)}
        initialTreasuryId={reportInitialTreasuryId}
        initialReportType={reportInitialType}
        treasuries={branchTreasuries}
        transactions={erpState.treasuryTransactions}
        currentBranch={currentBranch}
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
