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
  Store,
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
  FileText,
} from "lucide-react";
import { erpStore, RestaurantShift, Employee } from "@/shared/services/erpStore";
import { shiftAuditService } from "@/features/shifts/services/shiftAuditService";
import { getCurrentUserIdentitySync } from "@/shared/services/userAuthorization";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

interface RestaurantShiftLauncherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPOS?: (shift: RestaurantShift) => void;
  onRequestCloseShift?: (shift: RestaurantShift) => void;
  onPreviewPOS?: () => void;
}

export function RestaurantShiftLauncherModal({
  isOpen,
  onClose,
  onOpenPOS,
  onRequestCloseShift,
}: RestaurantShiftLauncherModalProps) {
  const navigate = useNavigate();
  const [state, setState] = useState(erpStore.getState());
  const [isNewShiftFormOpen, setIsNewShiftFormOpen] = useState(false);

  const currentIdentity = useMemo(
    () => getCurrentUserIdentitySync(),
    [state.currentUser, state.users, isOpen],
  );
  const isCashier = currentIdentity.isCashier;
  const canCloseShifts = currentIdentity.canCloseShifts;

  // Unified New Shift Form State (Currency strictly locked to USD)
  const [autoShiftNumber, setAutoShiftNumber] = useState("");
  const [customShiftNumber, setCustomShiftNumber] = useState("");
  const [selectedCashierType, setSelectedCashierType] = useState<"hr" | "manual">("hr");
  const [selectedHrEmployeeId, setSelectedHrEmployeeId] = useState<string>("");
  const [manualCashierName, setManualCashierName] = useState<string>("");
  const [openingBalance, setOpeningBalance] = useState<string>("0");
  const [shiftNotes, setShiftNotes] = useState<string>("");

  // Edit Shift State
  const [editingShift, setEditingShift] = useState<RestaurantShift | null>(null);
  const [editShiftNumber, setEditShiftNumber] = useState("");
  const [editCashierName, setEditCashierName] = useState("");
  const [editOpeningBalance, setEditOpeningBalance] = useState("0");
  const [editNotes, setEditNotes] = useState("");

  // Delete Confirmation State
  const [deletingShift, setDeletingShift] = useState<RestaurantShift | null>(null);

  useEffect(() => {
    const unsub = erpStore.subscribe(() => {
      setState(erpStore.getState());
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (isOpen) {
      shiftAuditService.syncOpenShiftsFromSupabase(erpStore).catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const generated = erpStore.generateUniqueRestaurantShiftNumber();
      setAutoShiftNumber(generated);
      const shiftIndex = (state.restaurantShifts?.length || 0) + 1;
      setCustomShiftNumber(
        `وردية مطعم #${shiftIndex} - ${new Date().toLocaleDateString("ar-EG")}`,
      );
      setOpeningBalance("0");
      setShiftNotes("");

      if (isCashier) {
        setSelectedCashierType("manual");
        setManualCashierName(
          currentIdentity.fullName || currentIdentity.username || "كاشير المطعم",
        );
      } else {
        const cashiers = (state.employees || []).filter(
          (e) =>
            e.status === "active" &&
            (e.job_title?.includes("كاشير") ||
              e.job_title?.includes("مبيعات") ||
              e.job_title?.includes("صالة") ||
              e.job_title?.includes("كابتن") ||
              e.department?.includes("المطعم") ||
              e.department?.includes("الصالة") ||
              e.department?.includes("المبيعات")),
        );
        if (cashiers.length > 0) {
          setSelectedHrEmployeeId(cashiers[0].id);
        } else if (state.employees && state.employees.length > 0) {
          setSelectedHrEmployeeId(state.employees[0].id);
        } else {
          setSelectedCashierType("manual");
          setManualCashierName("كاشير المطعم");
        }
      }
    }
  }, [isOpen, state.restaurantShifts?.length, state.employees, isCashier, currentIdentity]);

  const hrEmployees: Employee[] = useMemo(() => {
    return (state.employees || []).filter((e) => e.status === "active");
  }, [state.employees]);

  const cashierActiveShift: RestaurantShift | null = useMemo(() => {
    if (!isCashier) return null;
    return erpStore.getCashierOpenRestaurantShift();
  }, [isCashier, state.restaurantShifts, state.currentUser, currentIdentity.userId]);

  const openShifts: RestaurantShift[] = useMemo(() => {
    if (isCashier) {
      return cashierActiveShift ? [cashierActiveShift] : [];
    }
    return (state.restaurantShifts || []).filter((s) => s.status === "open");
  }, [isCashier, cashierActiveShift, state.restaurantShifts]);

  useEffect(() => {
    if (isOpen) {
      if (isCashier && cashierActiveShift) {
        setIsNewShiftFormOpen(false);
      } else if (openShifts.length === 0) {
        setIsNewShiftFormOpen(true);
      }
    }
  }, [isOpen, isCashier, cashierActiveShift, openShifts.length]);

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
    let finalCashierId: string | undefined = undefined;
    let finalCashierType: "hr" | "manual" | "account" = "account";

    if (isCashier) {
      finalCashierName =
        currentIdentity.fullName || currentIdentity.username || "كاشير المطعم";
      finalCashierId = currentIdentity.userId;
      finalCashierType = "account";
    } else if (selectedCashierType === "hr") {
      const emp = hrEmployees.find((e) => e.id === selectedHrEmployeeId);
      finalCashierName = emp ? emp.name : "كاشير المطعم";
      finalCashierId = selectedHrEmployeeId || currentIdentity.userId;
      finalCashierType = "hr";
    } else {
      finalCashierName = manualCashierName.trim() || "كاشير المطعم";
      finalCashierId = currentIdentity.userId;
      finalCashierType = "manual";
    }

    const generatedAutoShiftId =
      autoShiftNumber || erpStore.generateUniqueRestaurantShiftNumber();

    try {
      const newShift = erpStore.startNewRestaurantShift({
        auto_shift_number: generatedAutoShiftId,
        shift_number: customShiftNumber.trim(),
        cashier_name: finalCashierName,
        cashier_id: finalCashierId,
        cashier_username: currentIdentity.username,
        cashier_type: finalCashierType,
        currency: "USD",
        exchange_rate: 1,
        opening_balance: Number(openingBalance) || 0,
        opening_notes: shiftNotes.trim() || undefined,
        notes: shiftNotes.trim() || undefined,
      });

      toast.success(`تم فتح ${newShift.shift_number}`);
      onClose();
      if (onOpenPOS) {
        onOpenPOS(newShift);
      } else {
        navigate({ to: "/pos" });
      }
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء فتح الوردية");
    }
  };

  const handleEnterShift = (shift: RestaurantShift) => {
    try {
      erpStore.setActiveRestaurantShift(shift.id);
      toast.info(`تم الدخول إلى ${shift.shift_number}`);
      onClose();
      if (onOpenPOS) {
        onOpenPOS(shift);
      } else {
        navigate({ to: "/pos" });
      }
    } catch (err: any) {
      toast.error(err.message || "تعذر تفعيل الوردية");
    }
  };

  const handleSaveEditShift = () => {
    if (!editingShift) return;
    if (!editShiftNumber.trim() || !editCashierName.trim()) {
      toast.error("يرجى إدخال اسم الوردية واسم الكاشير");
      return;
    }

    try {
      erpStore.updateRestaurantShift(editingShift.id, {
        shift_number: editShiftNumber.trim(),
        cashier_name: editCashierName.trim(),
        opening_balance: Number(editOpeningBalance) || 0,
        notes: editNotes.trim() || undefined,
      });
      toast.success("تم تحديث بيانات الوردية");
      setEditingShift(null);
    } catch (err: any) {
      toast.error(err.message || "فشل التحديث");
    }
  };

  const handleConfirmDelete = () => {
    if (!deletingShift) return;
    try {
      erpStore.deleteRestaurantShift(deletingShift.id);
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
                <Store size={20} className="text-primary" />
                <span>فتح وردية جديدة — المطعم</span>
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
                          data-testid="cashier-shift-name-input"
                          value={customShiftNumber}
                          onChange={(e) => setCustomShiftNumber(e.target.value)}
                          placeholder="وردية مطعم صباحية"
                          className="h-10 rounded-xl text-xs font-bold bg-background"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-black text-foreground">عملة الوردية</Label>
                        <Input
                          data-testid="cashier-shift-currency-select"
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
                          data-testid="cashier-shift-opening-balance-input"
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
                          data-testid="cashier-shift-opening-notes-input"
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
                  const activeRestaurantShift = erpStore.getActiveRestaurantShift();
                  const isCurrentlyActive = activeRestaurantShift?.id === shift.id;

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
                            {shift.orders_count || 0} طلب
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

                        {canCloseShifts && !isCashier && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingShift(shift);
                                setEditShiftNumber(shift.shift_number);
                                setEditCashierName(shift.cashier_name);
                                setEditOpeningBalance(String(shift.opening_balance || 0));
                                setEditNotes(shift.notes || "");
                              }}
                              className="rounded-xl text-xs font-bold gap-1 cursor-pointer h-8"
                            >
                              <Edit size={13} />
                              <span>تعديل</span>
                            </Button>

                            {onRequestCloseShift && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  onClose();
                                  onRequestCloseShift(shift);
                                }}
                                className="rounded-xl text-xs font-bold gap-1 text-rose-600 border-rose-200 cursor-pointer h-8"
                              >
                                <Lock size={13} />
                                <span>إغلاق</span>
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeletingShift(shift)}
                              className="rounded-xl text-xs font-bold text-rose-600 h-8 px-2 cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </>
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
                <Label className="font-bold mb-1 block">الرصيد الافتتاحي (USD $)</Label>
                <Input
                  type="number"
                  value={editOpeningBalance}
                  onChange={(e) => setEditOpeningBalance(e.target.value)}
                  className="rounded-xl h-9 font-mono font-bold"
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
                onClick={handleSaveEditShift}
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
                onClick={handleConfirmDelete}
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
