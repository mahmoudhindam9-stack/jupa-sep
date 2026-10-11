import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  Hash,
  Clock,
  DollarSign,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ShoppingBag,
  Database,
} from "lucide-react";
import { erpStore, ParkShift, Employee } from "@/shared/services/erpStore";
import { ShiftAuditLogViewerModal } from "@/components/admin/ShiftAuditLogViewerModal";
import { toast } from "sonner";

interface ParkShiftLauncherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPOS: (shift: ParkShift) => void;
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
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  // New Shift Form State
  const [autoShiftNumber, setAutoShiftNumber] = useState("");
  const [customShiftNumber, setCustomShiftNumber] = useState("");
  const [selectedCashierType, setSelectedCashierType] = useState<string>("hr"); // "hr" | "manual"
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

  // Subscribe to store updates
  useEffect(() => {
    const unsub = erpStore.subscribe(() => {
      setState(erpStore.getState());
    });
    return unsub;
  }, []);

  // Initialize auto shift number & default fields when opening
  useEffect(() => {
    if (isOpen) {
      const generated = erpStore.generateUniqueParkShiftNumber();
      setAutoShiftNumber(generated);
      const shiftIndex = (state.parkShifts?.length || 0) + 1;
      setCustomShiftNumber(
        `وردية تذاكر #${shiftIndex} - ${new Date().toLocaleDateString("ar-EG")}`,
      );

      // Default to first cashier or active employee in HR
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
        setManualCashierName("أمين الصندوق");
      }
    }
  }, [isOpen, state.parkShifts?.length, state.employees]);

  // HR Employees list
  const hrEmployees: Employee[] = useMemo(() => {
    return state.employees || [];
  }, [state.employees]);

  // Open / Active shifts
  const openShifts: ParkShift[] = useMemo(() => {
    return (state.parkShifts || []).filter((s) => s.status === "open");
  }, [state.parkShifts]);

  // Auto-expand open new shift form if there are no open shifts
  useEffect(() => {
    if (isOpen && openShifts.length === 0) {
      setIsNewShiftFormOpen(true);
    }
  }, [isOpen, openShifts.length]);

  // Handle Start Shift
  const handleStartShift = () => {
    let finalCashierName = "";
    if (selectedCashierType === "hr") {
      const emp = hrEmployees.find((e) => e.id === selectedHrEmployeeId);
      if (!emp) {
        toast.error("يرجى اختيار موظف الكاشير المسؤول من القائمة");
        return;
      }
      finalCashierName = emp.name;
    } else {
      if (!manualCashierName.trim()) {
        toast.error("يرجى إدخال اسم الكاشير المسؤول يدوياً");
        return;
      }
      finalCashierName = manualCashierName.trim();
    }

    try {
      const newShift = erpStore.startNewParkShift({
        auto_shift_number: autoShiftNumber,
        shift_number: customShiftNumber.trim() || `وردية #${autoShiftNumber}`,
        cashier_name: finalCashierName,
        notes: shiftNotes.trim() || undefined,
      });

      toast.success(`تم فتح ${newShift.shift_number} بنجاح!`);
      onClose();
      onOpenPOS(newShift);
    } catch (err: any) {
      toast.error(err.message || "فشل فتح الوردية الجديدة");
    }
  };

  // Handle Resume / Enter Existing Shift
  const handleEnterShift = (shift: ParkShift) => {
    try {
      erpStore.setActiveParkShift(shift.id);
      toast.success(`تم الدخول إلى ${shift.shift_number}`);
      onClose();
      onOpenPOS(shift);
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء الدخول للوردية");
    }
  };

  // Handle Edit Shift Submit
  const handleSaveShiftEdit = () => {
    if (!editingShift) return;
    if (!editShiftNumber.trim()) {
      toast.error("رقم أو اسم الوردية لا يمكن أن يكون فارغاً");
      return;
    }
    if (!editCashierName.trim()) {
      toast.error("اسم الكاشير المسؤول لا يمكن أن يكون فارغاً");
      return;
    }

    try {
      erpStore.updateParkShift(editingShift.id, {
        shift_number: editShiftNumber.trim(),
        cashier_name: editCashierName.trim(),
        notes: editNotes.trim() || undefined,
      });
      toast.success("تم تحديث بيانات الوردية بنجاح");
      setEditingShift(null);
    } catch (err: any) {
      toast.error(err.message || "فشل تعديل بيانات الوردية");
    }
  };

  // Handle Delete Shift Confirm
  const handleConfirmDeleteShift = () => {
    if (!deletingShift) return;
    try {
      erpStore.deleteParkShift(deletingShift.id);
      toast.success(`تم حذف ${deletingShift.shift_number} من النظام`);
      setDeletingShift(null);
    } catch (err: any) {
      toast.error(err.message || "فشل حذف الوردية");
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[700px] rounded-3xl max-h-[90vh] overflow-y-auto font-sans antialiased text-right">
          <DialogHeader className="text-right border-b border-border pb-3">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-black text-foreground flex items-center gap-2">
                <Trees size={22} className="text-teal-600" />
                <span>إدارة وجلسات نقطة بيع تذاكر الحديقة</span>
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAuditModalOpen(true)}
                  className="text-xs h-7 gap-1 font-bold text-teal-600 border-teal-500/40 hover:bg-teal-500/10 cursor-pointer"
                >
                  <Database size={13} />
                  سجل التدقيق
                </Button>
                <Badge
                  variant="outline"
                  className="bg-teal-50 text-teal-700 border-teal-300 text-xs"
                >
                  Restocash Park POS
                </Badge>
              </div>
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              قم باختيار الوردية النشطة للمتابعة وعمليات البيع/المرتجع، أو افتح وردية جديدة بكاشير
              ورقم مخصص.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-3">
            {/* SECTION 1: QUESTION / OPEN NEW SHIFT */}
            <div className="p-4 rounded-2xl bg-teal-500/5 border border-teal-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-teal-600 text-white shadow-xs">
                    <PlusCircle size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-foreground">
                      هل ترغب في فتح وردية جديدة؟
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      بدء وردية جديدة برقم نظام تسلسلي فريد وتعيين كاشير المبيعات.
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsNewShiftFormOpen(!isNewShiftFormOpen)}
                  className={`rounded-xl font-black gap-1.5 transition-all ${
                    isNewShiftFormOpen
                      ? "bg-teal-700 text-white shadow-sm"
                      : "bg-teal-600 hover:bg-teal-700 text-white"
                  }`}
                >
                  {isNewShiftFormOpen ? (
                    <>
                      <ChevronUp size={15} /> إخفاء الخيارات
                    </>
                  ) : (
                    <>
                      <PlusCircle size={15} /> نعم، فتح وردية جديدة
                    </>
                  )}
                </Button>
              </div>

              {/* EXPANDABLE NEW SHIFT FORM */}
              {isNewShiftFormOpen && (
                <div className="mt-3 pt-3 border-t border-teal-500/20 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* System Auto Shift Number (Immutable/Stored) & Custom Shift Number */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-black flex items-center justify-between text-muted-foreground mb-1">
                        <span className="flex items-center gap-1">
                          <Hash size={13} className="text-teal-600" />
                          رقم الوردية التلقائي (النظام)
                        </span>
                        <Badge variant="outline" className="bg-muted text-[10px] font-mono">
                          فريد لا يتكرر
                        </Badge>
                      </Label>
                      <Input
                        value={autoShiftNumber}
                        readOnly
                        className="bg-muted/70 font-mono font-black text-xs h-9 rounded-xl border-dashed cursor-not-allowed text-teal-700 dark:text-teal-400"
                      />
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        رقم محفوظ في سجل الوردية للعرض في التقارير المحاسبية.
                      </p>
                    </div>

                    <div>
                      <Label className="text-xs font-black flex items-center gap-1 text-foreground mb-1">
                        <Sparkles size={13} className="text-amber-600" />
                        رقم ومسمى الوردية (قابل للتعديل)
                      </Label>
                      <Input
                        placeholder="مثال: وردية تذاكر #1 - صباحي"
                        value={customShiftNumber}
                        onChange={(e) => setCustomShiftNumber(e.target.value)}
                        className="h-9 rounded-xl text-xs font-bold bg-background"
                      />
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        يمكنك كتابة اسم أو رقم خاص أو تركه كما هو.
                      </p>
                    </div>
                  </div>

                  {/* Cashier Selection */}
                  <div className="space-y-2">
                    <Label className="text-xs font-black flex items-center gap-1 text-foreground">
                      <UserCheck size={14} className="text-teal-600" />
                      اسم أمين الصندوق / الكاشير المسؤول:
                    </Label>

                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => setSelectedCashierType("hr")}
                        className={`p-2 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                          selectedCashierType === "hr"
                            ? "bg-teal-600 text-white border-teal-600 shadow-xs"
                            : "bg-background text-foreground border-border hover:bg-muted"
                        }`}
                      >
                        اختيار من موظفي الموارد البشرية ({hrEmployees.length})
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedCashierType("manual")}
                        className={`p-2 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                          selectedCashierType === "manual"
                            ? "bg-teal-600 text-white border-teal-600 shadow-xs"
                            : "bg-background text-foreground border-border hover:bg-muted"
                        }`}
                      >
                        إدخال اسم كاشير يدوي آخر
                      </button>
                    </div>

                    {selectedCashierType === "hr" ? (
                      <div>
                        <select
                          value={selectedHrEmployeeId}
                          onChange={(e) => setSelectedHrEmployeeId(e.target.value)}
                          className="w-full h-9 rounded-xl border border-input bg-background px-3 py-1 text-xs font-bold shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          {hrEmployees.length === 0 ? (
                            <option value="">لا يوجد موظفين مسجلين بالموارد البشرية</option>
                          ) : (
                            hrEmployees.map((emp) => {
                              const isCashier =
                                emp.job_title?.includes("كاشير") ||
                                emp.job_title?.includes("مبيعات") ||
                                emp.department?.includes("الصالة");
                              return (
                                <option key={emp.id} value={emp.id}>
                                  {emp.name} — {emp.job_title} ({emp.department}){" "}
                                  {isCashier ? "★ [كاشير]" : ""}
                                </option>
                              );
                            })
                          )}
                        </select>
                      </div>
                    ) : (
                      <div>
                        <Input
                          placeholder="اكتب اسم الكاشير المسؤول..."
                          value={manualCashierName}
                          onChange={(e) => setManualCashierName(e.target.value)}
                          className="h-9 rounded-xl text-xs font-bold bg-background"
                        />
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <Label className="text-xs font-bold text-muted-foreground mb-1 block">
                      ملاحظات افتتاح الوردية (اختياري):
                    </Label>
                    <Input
                      placeholder="أي تعليمات أو ملاحظات خاصة بهذه الجلسة..."
                      value={shiftNotes}
                      onChange={(e) => setShiftNotes(e.target.value)}
                      className="h-8 rounded-xl text-xs bg-background"
                    />
                  </div>

                  {/* Start Shift Submit Button */}
                  <div className="pt-2 flex justify-end">
                    <Button
                      type="button"
                      onClick={handleStartShift}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs gap-2 rounded-xl px-6 py-2 shadow-md cursor-pointer active:scale-95 transition-all"
                    >
                      <Play size={15} />
                      بدء الوردية ودخول نقطة البيع (POS)
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 2: EXISTING OPEN SHIFTS LIST FOR MANAGERS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                  <Clock size={16} className="text-amber-600" />
                  <span>الورديات المفتوحة والنشطة حالياً ({openShifts.length})</span>
                </h3>
                <span className="text-xs text-muted-foreground">
                  إمكانية الدخول على الجلسة للبيع والمرتجع، التعديل، أو الحذف
                </span>
              </div>

              {openShifts.length === 0 ? (
                <div className="p-6 rounded-2xl border border-dashed border-border text-center space-y-2 bg-muted/20">
                  <AlertTriangle className="mx-auto text-amber-500" size={28} />
                  <p className="text-xs font-bold text-foreground">
                    لا توجد أي ورديات مفتوحة حالياً في النظام
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    يمكنك فتح وردية جديدة بسهولة عبر النموذج أعلاه لبدء إصدار تذاكر الحديقة.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {openShifts.map((shift) => {
                    const shiftTxs = (state.parkTicketTransactions || []).filter(
                      (t) => t.shift_id === shift.id || t.shift_number === shift.shift_number,
                    );
                    const completedTxs = shiftTxs.filter((t) => t.status === "completed");
                    const refundedTxs = shiftTxs.filter((t) => t.status === "refunded");
                    const totalRevenueUsd = completedTxs.reduce((s, t) => s + t.total_usd, 0);

                    return (
                      <div
                        key={shift.id}
                        className="p-3.5 rounded-2xl border border-border/80 bg-card hover:border-teal-500/40 transition shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3"
                      >
                        {/* Info */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-xs text-foreground">
                              {shift.shift_number}
                            </span>
                            {shift.auto_shift_number && (
                              <Badge
                                variant="outline"
                                className="text-[10px] font-mono text-muted-foreground"
                              >
                                رقم النظام: {shift.auto_shift_number}
                              </Badge>
                            )}
                            <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-300 text-[10px]">
                              وردية مفتوحة
                            </Badge>
                          </div>

                          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1 font-bold text-foreground">
                              <UserCheck size={12} className="text-teal-600" />
                              الكاشير: {shift.cashier_name}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1 font-mono">
                              <Clock size={12} />
                              بدأت: {new Date(shift.start_at).toLocaleTimeString("ar-EG")}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-teal-600 font-black">
                              <ShoppingBag size={12} />
                              {completedTxs.length} مبيعات (${totalRevenueUsd})
                            </span>
                            {refundedTxs.length > 0 && (
                              <span className="text-rose-600 font-bold">
                                ({refundedTxs.length} مرتجع)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Enter Shift (Sell / Refund) */}
                          <Button
                            size="sm"
                            onClick={() => handleEnterShift(shift)}
                            className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black gap-1 cursor-pointer h-8"
                          >
                            <Play size={13} />
                            دخول الوردية (بيع / مرتجع)
                          </Button>

                          {/* Edit Shift Info */}
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
                            title="تعديل بيانات الجلسة"
                          >
                            <Edit size={13} className="text-blue-600" />
                            تعديل
                          </Button>

                          {/* Close Shift */}
                          {onRequestCloseShift && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                erpStore.setActiveParkShift(shift.id);
                                onRequestCloseShift(shift);
                              }}
                              className="rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border-rose-200 gap-1 cursor-pointer h-8"
                              title="إغلاق الوردية وترحيل الأرصدة"
                            >
                              <Lock size={13} />
                              إغلاق
                            </Button>
                          )}

                          {/* Delete Shift with Confirmation */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeletingShift(shift)}
                            className="rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-100 hover:text-rose-700 h-8 px-2 cursor-pointer"
                            title="حذف الجلسة من النظام"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="border-t border-border pt-3 sm:justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="rounded-xl text-xs font-bold"
            >
              إلغاء وإغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT SHIFT MODAL */}
      {editingShift && (
        <Dialog open={editingShift !== null} onOpenChange={() => setEditingShift(null)}>
          <DialogContent className="sm:max-w-[450px] rounded-3xl text-right">
            <DialogHeader className="text-right">
              <DialogTitle className="text-base font-black flex items-center gap-2 text-foreground">
                <Edit size={18} className="text-blue-600" />
                تعديل بيانات جلسة الوردية
              </DialogTitle>
              <DialogDescription className="text-xs">
                تعديل رقم ومسمى الوردية أو اسم الكاشير المسؤول
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div>
                <Label className="font-bold mb-1 block">رقم / مسمى الوردية:</Label>
                <Input
                  value={editShiftNumber}
                  onChange={(e) => setEditShiftNumber(e.target.value)}
                  className="rounded-xl h-9 font-bold"
                />
              </div>

              <div>
                <Label className="font-bold mb-1 block">اسم الكاشير المسؤول:</Label>
                <Input
                  value={editCashierName}
                  onChange={(e) => setEditCashierName(e.target.value)}
                  className="rounded-xl h-9 font-bold"
                />
              </div>

              <div>
                <Label className="font-bold mb-1 block">ملاحظات الوردية:</Label>
                <Input
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="rounded-xl h-9"
                  placeholder="ملاحظات..."
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
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold"
              >
                حفظ التعديلات
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* DELETE SHIFT CONFIRMATION MODAL */}
      {deletingShift && (
        <Dialog open={deletingShift !== null} onOpenChange={() => setDeletingShift(null)}>
          <DialogContent className="sm:max-w-[450px] rounded-3xl text-right">
            <DialogHeader className="text-right">
              <DialogTitle className="text-base font-black flex items-center gap-2 text-rose-600">
                <AlertTriangle size={18} />
                تأكيد حذف جلسة الوردية
              </DialogTitle>
              <DialogDescription className="text-xs">
                هل أنت متأكد من رغبتك في حذف جلسة الوردية ({deletingShift.shift_number}) من النظام؟
              </DialogDescription>
            </DialogHeader>

            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 text-xs space-y-1">
              <p className="font-bold">تحذير أمني للمدير:</p>
              <p className="text-[11px]">
                سيتم حذف سجل الجلسة من قائمة الورديات النشطة، ولن تتمكن من استرجاعها بعد الحذف.
              </p>
            </div>

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
                className="rounded-xl font-black gap-1.5"
              >
                <Trash2 size={14} />
                نعم، تأكيد الحذف
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <ShiftAuditLogViewerModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        initialShiftType="park"
      />
    </>
  );
}
