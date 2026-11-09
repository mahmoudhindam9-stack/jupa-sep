import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Trees,
  PlusCircle,
  Play,
  Edit,
  Trash2,
  Lock,
  UserCheck,
  Clock,
  DollarSign,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  CheckCircle2,
} from "lucide-react";
import { erpStore, ParkShift, Employee } from "@/shared/services/erpStore";
import { getCurrentUserIdentitySync } from "@/shared/services/userAuthorization";
import { shiftAuditService } from "@/features/shifts/services/shiftAuditService";
import { toast } from "sonner";

interface ParkShiftLauncherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPOS?: (shift: ParkShift) => void;
  onRequestCloseShift?: (shift: ParkShift) => void;
}

export function ParkShiftLauncherModal({
  isOpen,
  onClose,
  onOpenPOS,
  onRequestCloseShift,
}: ParkShiftLauncherModalProps) {
  const [state, setState] = useState(erpStore.getState());
  const [isNewShiftFormOpen, setIsNewShiftFormOpen] = useState(false);

  const currentIdentity = useMemo(
    () => getCurrentUserIdentitySync(),
    [isOpen, state.currentUserEmail],
  );
  const isCashier = currentIdentity.isCashier;
  const canCloseShifts = currentIdentity.canCloseShifts;

  // Unified New Shift Form State (Currency strictly locked to USD)
  const [autoShiftNumber, setAutoShiftNumber] = useState("");
  const [customShiftNumber, setCustomShiftNumber] = useState("");
  const [openingBalance, setOpeningBalance] = useState<string>("0");
  const [selectedCashierType, setSelectedCashierType] = useState<"hr" | "manual">("hr");
  const [selectedHrEmployeeId, setSelectedHrEmployeeId] = useState<string>("");
  const [manualCashierName, setManualCashierName] = useState<string>("");
  const [shiftNotes, setShiftNotes] = useState<string>("");

  // Edit Shift State
  const [editingShift, setEditingShift] = useState<ParkShift | null>(null);
  const [editShiftNumber, setEditShiftNumber] = useState("");
  const [editCashierName, setEditCashierName] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Delete Confirmation State
  const [deletingShift, setDeletingShift] = useState<ParkShift | null>(null);

  useEffect(() => {
    const unsub = erpStore.subscribe(() => {
      setState(erpStore.getState());
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (isOpen) {
      void shiftAuditService.syncOpenShiftsFromSupabase(erpStore);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const generated = erpStore.generateUniqueParkShiftNumber();
      setAutoShiftNumber(generated);
      const shiftIndex = (state.parkShifts?.length || 0) + 1;
      setCustomShiftNumber(
        `وردية حديقة #${shiftIndex} - ${new Date().toLocaleDateString("ar-EG")}`,
      );
      setOpeningBalance("0");
      setShiftNotes("");

      if (isCashier) {
        setSelectedCashierType("manual");
        setManualCashierName(
          currentIdentity.fullName || currentIdentity.username || "كاشير الحديقة",
        );
      } else {
        const cashiers = (state.employees || []).filter(
          (e) =>
            e.status === "active" &&
            (e.job_title?.includes("كاشير") ||
              e.job_title?.includes("مبيعات") ||
              e.department?.includes("الصالة") ||
              e.department?.includes("المبيعات")),
        );
        if (cashiers.length > 0) {
          setSelectedHrEmployeeId(cashiers[0].id);
        } else if (state.employees && state.employees.length > 0) {
          setSelectedHrEmployeeId(state.employees[0].id);
        } else {
          setSelectedCashierType("manual");
          setManualCashierName("كاشير الحديقة");
        }
      }
    }
  }, [isOpen, state.parkShifts?.length, state.employees, isCashier, currentIdentity]);

  const hrEmployees: Employee[] = useMemo(() => {
    return (state.employees || []).filter((e) => e.status === "active");
  }, [state.employees]);

  const cashierActiveShift: ParkShift | null = useMemo(() => {
    if (!isCashier) return null;
    return erpStore.getCashierOpenParkShift();
  }, [isCashier, state.parkShifts, state.parkActiveShift, currentIdentity]);

  const openShifts: ParkShift[] = useMemo(() => {
    const allOpen = (state.parkShifts || []).filter((s) => s.status === "open");
    if (isCashier) {
      return cashierActiveShift ? [cashierActiveShift] : [];
    }
    return allOpen;
  }, [state.parkShifts, isCashier, cashierActiveShift]);

  useEffect(() => {
    if (isOpen) {
      if (isCashier && cashierActiveShift) {
        setIsNewShiftFormOpen(false);
      } else if (openShifts.length === 0) {
        setIsNewShiftFormOpen(true);
      }
    }
  }, [isOpen, openShifts.length, isCashier, cashierActiveShift]);

  const handleStartShift = () => {
    if (!customShiftNumber.trim()) {
      toast.error("يرجى إدخال اسم الوردية");
      return;
    }

    if (isCashier && cashierActiveShift) {
      toast.error("لديك وردية مفتوحة بالفعل");
      return;
    }

    let finalCashierName = "";
    let finalCashierId = currentIdentity.userId || undefined;
    const finalCashierUsername = currentIdentity.username || undefined;

    if (isCashier) {
      finalCashierName =
        currentIdentity.fullName ||
        currentIdentity.username ||
        manualCashierName.trim() ||
        "كاشير الحديقة";
    } else if (selectedCashierType === "hr") {
      const emp = hrEmployees.find((e) => e.id === selectedHrEmployeeId);
      finalCashierName = emp ? emp.name : "كاشير الحديقة";
      finalCashierId = emp?.id || currentIdentity.userId;
    } else {
      finalCashierName = manualCashierName.trim() || "كاشير الحديقة";
    }

    const parsedOpeningBalance = Math.max(0, Number(openingBalance) || 0);

    try {
      const newShift = erpStore.startNewParkShift({
        auto_shift_number: autoShiftNumber || erpStore.generateUniqueParkShiftNumber(),
        shift_number: customShiftNumber.trim(),
        cashier_name: finalCashierName,
        cashier_id: finalCashierId,
        cashier_username: finalCashierUsername,
        cashier_type: isCashier ? "account" : (selectedCashierType as "hr" | "manual"),
        currency: "USD",
        exchange_rate: 1,
        opening_balance: parsedOpeningBalance,
        opening_notes: shiftNotes.trim() || undefined,
        notes: shiftNotes.trim() || undefined,
      });

      toast.success(`تم فتح ${newShift.shift_number}`);
      onClose();
      if (onOpenPOS) onOpenPOS(newShift);
    } catch (err: any) {
      toast.error(err.message || "فشل فتح الوردية");
    }
  };

  const handleEnterShift = (shift: ParkShift) => {
    try {
      erpStore.setActiveParkShift(shift.id);
      toast.success(`تم الدخول إلى ${shift.shift_number}`);
      onClose();
      if (onOpenPOS) onOpenPOS(shift);
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء الدخول للوردية");
    }
  };

  const handleSaveShiftEdit = () => {
    if (!editingShift) return;
    if (!editShiftNumber.trim() || !editCashierName.trim()) {
      toast.error("يرجى إدخال اسم الوردية واسم الكاشير");
      return;
    }

    try {
      erpStore.updateParkShift(editingShift.id, {
        shift_number: editShiftNumber.trim(),
        cashier_name: editCashierName.trim(),
        notes: editNotes.trim() || undefined,
      });
      toast.success("تم تحديث بيانات الوردية");
      setEditingShift(null);
    } catch (err: any) {
      toast.error(err.message || "فشل تعديل بيانات الوردية");
    }
  };

  const handleConfirmDeleteShift = () => {
    if (!deletingShift) return;
    try {
      erpStore.deleteParkShift(deletingShift.id);
      toast.success(`تم حذف ${deletingShift.shift_number}`);
      setDeletingShift(null);
    } catch (err: any) {
      toast.error(err.message || "فشل حذف الوردية");
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[650px] rounded-3xl max-h-[90vh] overflow-y-auto font-sans antialiased text-right">
          <DialogHeader className="text-right border-b border-border pb-3">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-black text-foreground flex items-center gap-2">
                <Trees size={20} className="text-primary" />
                <span>فتح وردية جديدة — الحديقة</span>
              </DialogTitle>
              <Badge variant="outline" className="text-xs font-bold">
                {openShifts.length} نشطة
              </Badge>
            </div>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* OPEN NEW SHIFT FORM */}
            {(!isCashier || !cashierActiveShift) && (
              <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                    <PlusCircle size={16} className="text-primary" />
                    <span>بيانات فتح الوردية</span>
                  </h3>
                  {openShifts.length > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setIsNewShiftFormOpen(!isNewShiftFormOpen)}
                      className="rounded-xl font-bold text-xs gap-1.5 h-8"
                    >
                      {isNewShiftFormOpen ? (
                        <>
                          <ChevronUp size={14} /> إخفاء
                        </>
                      ) : (
                        <>
                          <ChevronDown size={14} /> فتح وردية جديدة
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {isNewShiftFormOpen && (
                  <div className="space-y-4 pt-2 border-t border-border/60">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-black text-foreground">اسم الوردية</Label>
                        <Input
                          value={customShiftNumber}
                          onChange={(e) => setCustomShiftNumber(e.target.value)}
                          placeholder="وردية حديقة صباحية"
                          className="h-10 rounded-xl text-xs font-bold bg-background"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-black text-foreground">عملة الوردية</Label>
                        <Input
                          value="دولار أمريكي (USD $)"
                          readOnly
                          disabled
                          className="h-10 rounded-xl text-xs font-black bg-muted/70 text-foreground cursor-not-allowed"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-black text-foreground">
                          الرصيد الافتتاحي (USD $)
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={openingBalance}
                          onChange={(e) => setOpeningBalance(e.target.value)}
                          placeholder="0.00"
                          className="h-10 rounded-xl text-xs font-mono font-bold bg-background"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-black text-foreground">ملاحظات الفتح</Label>
                        <Input
                          value={shiftNotes}
                          onChange={(e) => setShiftNotes(e.target.value)}
                          placeholder="ملاحظات اختيارية..."
                          className="h-10 rounded-xl text-xs bg-background"
                        />
                      </div>
                    </div>

                    {!isCashier && (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-black text-foreground flex items-center gap-1.5">
                            <UserCheck size={14} className="text-primary" />
                            <span>الكاشير المسؤول</span>
                          </Label>
                          <div className="inline-flex rounded-xl bg-muted p-0.5 border border-border text-[11px] font-bold">
                            <button
                              type="button"
                              onClick={() => setSelectedCashierType("hr")}
                              className={`px-3 py-1 rounded-lg transition ${
                                selectedCashierType === "hr"
                                  ? "bg-background text-foreground shadow-xs font-black"
                                  : "text-muted-foreground"
                              }`}
                            >
                              موظف HR
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedCashierType("manual")}
                              className={`px-3 py-1 rounded-lg transition ${
                                selectedCashierType === "manual"
                                  ? "bg-background text-foreground shadow-xs font-black"
                                  : "text-muted-foreground"
                              }`}
                            >
                              إدخال يدوي
                            </button>
                          </div>
                        </div>

                        {selectedCashierType === "hr" ? (
                          <select
                            value={selectedHrEmployeeId}
                            onChange={(e) => setSelectedHrEmployeeId(e.target.value)}
                            className="w-full h-10 px-3 rounded-xl bg-background border border-border text-xs font-bold focus:outline-none"
                          >
                            {hrEmployees.map((emp) => (
                              <option key={emp.id} value={emp.id}>
                                {emp.name} — {emp.job_title || "موظف"}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            value={manualCashierName}
                            onChange={(e) => setManualCashierName(e.target.value)}
                            placeholder="اسم الكاشير..."
                            className="h-10 rounded-xl text-xs font-bold bg-background"
                          />
                        )}
                      </div>
                    )}

                    <div className="pt-2 flex justify-end">
                      <Button
                        type="button"
                        onClick={handleStartShift}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs gap-2 rounded-xl px-6 h-10 shadow-sm cursor-pointer"
                      >
                        <Play size={15} />
                        <span>فتح الوردية ودخول الكاشير</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* EXISTING OPEN SHIFTS */}
            {openShifts.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                  <Clock size={16} className="text-primary" />
                  <span>الورديات المفتوحة ({openShifts.length})</span>
                </h3>

                {openShifts.map((shift) => {
                  const activeParkShift = erpStore.getActiveParkShift();
                  const isCurrentlyActive = activeParkShift?.id === shift.id;
                  const shiftTxs = (state.parkTicketTransactions || []).filter(
                    (t) => t.shift_id === shift.id || t.shift_number === shift.shift_number,
                  );
                  const completedTxs = shiftTxs.filter((t) => t.status === "completed");

                  return (
                    <div
                      key={shift.id}
                      className="p-3.5 rounded-2xl border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-xs text-foreground">
                            {shift.shift_number}
                          </span>
                          {isCurrentlyActive ? (
                            <Badge className="bg-emerald-600 text-white text-[10px] font-black gap-1">
                              <CheckCircle2 size={11} /> نشطة الآن
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] font-bold">
                              مفتوحة
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1 font-bold text-foreground">
                            <UserCheck size={12} className="text-emerald-600" />
                            {shift.cashier_name}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-mono">
                            <Clock size={12} />
                            {new Date(shift.start_at).toLocaleTimeString("ar-EG")}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-mono font-bold text-emerald-600">
                            <DollarSign size={12} />
                            {(shift.opening_balance || 0).toLocaleString()} USD
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-primary font-black">
                            <ShoppingBag size={12} />
                            {completedTxs.length} تذكرة
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Button
                          size="sm"
                          onClick={() => handleEnterShift(shift)}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-black gap-1 cursor-pointer h-8"
                        >
                          <Play size={13} />
                          <span>دخول الوردية</span>
                        </Button>

                        {!isCashier && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingShift(shift);
                              setEditShiftNumber(shift.shift_number);
                              setEditCashierName(shift.cashier_name);
                              setEditNotes(shift.notes || "");
                            }}
                            className="rounded-xl text-xs font-bold gap-1 cursor-pointer h-8"
                          >
                            <Edit size={13} />
                            <span>تعديل</span>
                          </Button>
                        )}

                        {canCloseShifts && onRequestCloseShift && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              erpStore.setActiveParkShift(shift.id);
                              onRequestCloseShift(shift);
                            }}
                            className="rounded-xl text-xs font-bold text-rose-600 border-rose-200 gap-1 cursor-pointer h-8"
                          >
                            <Lock size={13} />
                            <span>إغلاق</span>
                          </Button>
                        )}

                        {!isCashier && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeletingShift(shift)}
                            className="rounded-xl text-xs font-bold text-rose-600 h-8 px-2 cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-border pt-3 sm:justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="rounded-xl text-xs font-bold"
            >
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT SHIFT MODAL */}
      {editingShift && (
        <Dialog open={editingShift !== null} onOpenChange={() => setEditingShift(null)}>
          <DialogContent className="sm:max-w-[420px] rounded-3xl text-right">
            <DialogHeader className="text-right">
              <DialogTitle className="text-base font-black">تعديل بيانات الوردية</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs">
              <div>
                <Label className="font-bold mb-1 block">اسم الوردية</Label>
                <Input
                  value={editShiftNumber}
                  onChange={(e) => setEditShiftNumber(e.target.value)}
                  className="rounded-xl h-9 font-bold"
                />
              </div>
              <div>
                <Label className="font-bold mb-1 block">الكاشير المسؤول</Label>
                <Input
                  value={editCashierName}
                  onChange={(e) => setEditCashierName(e.target.value)}
                  className="rounded-xl h-9 font-bold"
                />
              </div>
              <div>
                <Label className="font-bold mb-1 block">ملاحظات</Label>
                <Input
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="rounded-xl h-9"
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingShift(null)}
                className="rounded-xl"
              >
                إلغاء
              </Button>
              <Button
                size="sm"
                onClick={handleSaveShiftEdit}
                className="bg-primary text-primary-foreground rounded-xl font-bold"
              >
                حفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* DELETE SHIFT CONFIRMATION MODAL */}
      {deletingShift && (
        <Dialog open={deletingShift !== null} onOpenChange={() => setDeletingShift(null)}>
          <DialogContent className="sm:max-w-[400px] rounded-3xl text-right">
            <DialogHeader className="text-right">
              <DialogTitle className="text-base font-black flex items-center gap-2 text-rose-600">
                <AlertTriangle size={18} />
                <span>تأكيد حذف الوردية ({deletingShift.shift_number})</span>
              </DialogTitle>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeletingShift(null)}
                className="rounded-xl"
              >
                تراجع
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleConfirmDeleteShift}
                className="rounded-xl font-bold"
              >
                تأكيد الحذف
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
