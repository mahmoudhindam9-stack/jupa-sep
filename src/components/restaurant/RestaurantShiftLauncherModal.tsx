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
  Store,
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
  RotateCcw,
  Utensils,
  Receipt,
  CheckCircle2,
  Database,
} from "lucide-react";
import { erpStore, RestaurantShift, Employee } from "@/shared/services/erpStore";
import { ShiftAuditLogViewerModal } from "@/components/admin/ShiftAuditLogViewerModal";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

interface RestaurantShiftLauncherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPOS?: (shift: RestaurantShift) => void;
  onRequestCloseShift?: (shift: RestaurantShift) => void;
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
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  // New Shift Form State
  const [autoShiftNumber, setAutoShiftNumber] = useState("");
  const [customShiftNumber, setCustomShiftNumber] = useState("");
  const [selectedCashierType, setSelectedCashierType] = useState<string>("hr"); // "hr" | "manual"
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
      const generated = erpStore.generateUniqueRestaurantShiftNumber();
      setAutoShiftNumber(generated);
      const shiftIndex = (state.restaurantShifts?.length || 0) + 1;
      setCustomShiftNumber(`وردية مطعم #${shiftIndex} - ${new Date().toLocaleDateString("ar-EG")}`);

      // Default to first cashier or active employee in HR
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
  }, [isOpen, state.restaurantShifts?.length]);

  // HR Employees list
  const hrEmployees: Employee[] = useMemo(() => {
    return (state.employees || []).filter((e) => e.status === "active");
  }, [state.employees]);

  // Open / Active Restaurant shifts
  const openShifts: RestaurantShift[] = useMemo(() => {
    return (state.restaurantShifts || []).filter((s) => s.status === "open");
  }, [state.restaurantShifts]);

  // Handle Starting a New Shift
  const handleStartShift = () => {
    let finalCashierName = "";
    if (selectedCashierType === "hr") {
      const emp = hrEmployees.find((e) => e.id === selectedHrEmployeeId);
      finalCashierName = emp ? emp.name : "كاشير المطعم";
    } else {
      finalCashierName = manualCashierName.trim() || "موظف مؤقت";
    }

    if (!customShiftNumber.trim()) {
      toast.error("يرجى إدخال اسم أو رقم الوردية");
      return;
    }

    try {
      const newShift = erpStore.startNewRestaurantShift({
        auto_shift_number: autoShiftNumber,
        shift_number: customShiftNumber.trim(),
        cashier_name: finalCashierName,
        cashier_id: selectedCashierType === "hr" ? selectedHrEmployeeId : undefined,
        cashier_type: selectedCashierType as "hr" | "manual",
        opening_balance: Number(openingBalance) || 0,
        opening_notes: shiftNotes.trim() || undefined,
        notes: shiftNotes.trim() || undefined,
      });

      toast.success(
        `تم بدء ${newShift.shift_number} بنجاح برقم آلي: ${newShift.auto_shift_number}`,
      );
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

  // Handle Enter Existing Shift
  const handleEnterShift = (shift: RestaurantShift) => {
    try {
      erpStore.setActiveRestaurantShift(shift.id);
      toast.info(`تم تفعيل الوردية: ${shift.shift_number} والدخول لنقطة البيع`);
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

  // Save Edit Shift
  const handleSaveEditShift = () => {
    if (!editingShift) return;
    if (!editShiftNumber.trim()) {
      toast.error("لا يمكن ترك رقم الوردية فارغاً");
      return;
    }
    if (!editCashierName.trim()) {
      toast.error("لا يمكن ترك اسم الكاشير فارغاً");
      return;
    }

    try {
      erpStore.updateRestaurantShift(editingShift.id, {
        shift_number: editShiftNumber.trim(),
        cashier_name: editCashierName.trim(),
        opening_balance: Number(editOpeningBalance) || 0,
        notes: editNotes.trim() || undefined,
      });
      toast.success("تم تحديث بيانات الوردية بنجاح");
      setEditingShift(null);
    } catch (err: any) {
      toast.error(err.message || "فشل التحديث");
    }
  };

  // Confirm Delete Shift
  const handleConfirmDelete = () => {
    if (!deletingShift) return;
    try {
      erpStore.deleteRestaurantShift(deletingShift.id);
      toast.success(`تم حذف ${deletingShift.shift_number} بنجاح`);
      setDeletingShift(null);
    } catch (err: any) {
      toast.error(err.message || "فشل حذف الوردية");
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[750px] rounded-3xl max-h-[90vh] overflow-y-auto border-border shadow-2xl p-0">
          {/* Header Banner */}
          <div className="bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 p-6 text-white rounded-t-3xl relative overflow-hidden">
            <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
            <DialogHeader className="text-right space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-amber-300 text-xs font-bold backdrop-blur-md">
                  <Utensils size={14} />
                  <span>نقطة بيع المطعم (Restaurant POS)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAuditModalOpen(true)}
                    className="text-xs h-7 gap-1 font-bold bg-white/10 hover:bg-white/20 text-white border-white/20 cursor-pointer"
                  >
                    <Database size={13} />
                    سجل التدقيق
                  </Button>
                  <Badge
                    variant="outline"
                    className="bg-indigo-500/20 text-indigo-200 border-indigo-400/30 text-xs font-mono"
                  >
                    {openShifts.length > 0
                      ? `${openShifts.length} وردية نشطة حالياً`
                      : "لا توجد ورديات مفتوحة"}
                  </Badge>
                </div>
              </div>
              <DialogTitle className="text-xl font-black text-white flex items-center gap-2">
                <Store className="text-indigo-400" size={22} />
                بدء وإدارة ورديات نقطة البيع (POS)
              </DialogTitle>
              <DialogDescription className="text-slate-300 text-xs leading-relaxed">
                اختر فتح وردية كاشير جديدة مع رقم آلي يمنع التكرار وربط الموارد البشرية، أو إدارة
                الورديات المفتوحة كمدير نظام لتعديلها أو إغلاقها أو متابعة المبيعات والمرتجعات.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-6">
            {/* SECTION 1: QUESTION BUTTON TO OPEN NEW SHIFT */}
            <div className="p-5 rounded-3xl border-2 border-indigo-500/20 bg-indigo-500/5 dark:bg-indigo-950/20 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                    <Sparkles className="text-amber-500" size={16} />
                    هل ترغب في فتح وردية جديدة؟
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    إنشاء جلسة كاشير جديدة برقم آلي ونظام مالي مستقل لحركات المبيعات والمرتجعات.
                  </p>
                </div>

                <Button
                  onClick={() => setIsNewShiftFormOpen(!isNewShiftFormOpen)}
                  className={`rounded-2xl font-black text-xs gap-2 px-5 py-2.5 shadow-md cursor-pointer transition-all ${
                    isNewShiftFormOpen
                      ? "bg-slate-700 hover:bg-slate-800 text-white"
                      : "bg-indigo-600 hover:bg-indigo-700 text-white"
                  }`}
                >
                  {isNewShiftFormOpen ? (
                    <>
                      <ChevronUp size={16} />
                      إخفاء خيارات الفتح
                    </>
                  ) : (
                    <>
                      <PlusCircle size={16} />+ فتح وردية جديدة الآن
                    </>
                  )}
                </Button>
              </div>

              {/* EXPANDABLE NEW SHIFT FORM */}
              {isNewShiftFormOpen && (
                <div className="pt-4 border-t border-indigo-500/20 space-y-4 animate-in fade-in-50 duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* AUTO SHIFT NUMBER (System generated, immutable reference) */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-black text-muted-foreground flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Hash size={13} className="text-indigo-600" />
                          الرقم التلقائي المحفوظ (يمنع التكرار):
                        </span>
                        <Badge
                          variant="secondary"
                          className="text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono"
                        >
                          ثابت في التقارير
                        </Badge>
                      </Label>
                      <Input
                        value={autoShiftNumber}
                        readOnly
                        disabled
                        className="bg-muted/70 font-mono font-black text-xs text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900 rounded-xl cursor-not-allowed"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        رقم مرجعي فريد يتم توليده برمجياً ولا يتكرر في السجلات المحاسبية.
                      </p>
                    </div>

                    {/* CUSTOMIZABLE SHIFT NUMBER / NAME */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-black text-foreground flex items-center gap-1">
                        <Store size={13} className="text-primary" />
                        رقم / اسم الوردية المعروض (قابل للتعديل):
                      </Label>
                      <Input
                        value={customShiftNumber}
                        onChange={(e) => setCustomShiftNumber(e.target.value)}
                        placeholder="مثال: وردية مطعم #1 - صباحية"
                        className="rounded-xl text-xs font-bold bg-background border-border focus:border-indigo-500"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        يمكنك تعديل الاسم أو الرقم بحرية ويظل الرقم التلقائي محفوظاً.
                      </p>
                    </div>
                  </div>

                  {/* CASHIER SELECTION */}
                  <div className="space-y-2 p-3.5 rounded-2xl bg-card border border-border">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-black text-foreground flex items-center gap-1.5">
                        <UserCheck size={14} className="text-emerald-600" />
                        اسم الكاشير المسؤول عن الوردية:
                      </Label>

                      {/* Toggle HR vs Manual */}
                      <div className="inline-flex rounded-xl bg-muted p-0.5 border border-border text-[11px] font-bold">
                        <button
                          type="button"
                          onClick={() => setSelectedCashierType("hr")}
                          className={`px-3 py-1 rounded-lg transition-all ${
                            selectedCashierType === "hr"
                              ? "bg-background text-foreground shadow-xs font-black"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          موظف من HR
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedCashierType("manual")}
                          className={`px-3 py-1 rounded-lg transition-all ${
                            selectedCashierType === "manual"
                              ? "bg-background text-foreground shadow-xs font-black"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          موظف مؤقت / إدخال يدوي
                        </button>
                      </div>
                    </div>

                    {selectedCashierType === "hr" ? (
                      <div className="space-y-1.5">
                        <select
                          value={selectedHrEmployeeId}
                          onChange={(e) => setSelectedHrEmployeeId(e.target.value)}
                          className="w-full h-10 px-3 rounded-xl bg-background border border-border text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {hrEmployees.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.name} — ({emp.job_title || "موظف"}) - قسم:{" "}
                              {emp.department || "المطعم"}
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-muted-foreground">
                          مربوط بقائمة موظفي الموارد البشرية (HR) لتسجيل الحركات والمسؤولية المالية
                          بدقة.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <Input
                          value={manualCashierName}
                          onChange={(e) => setManualCashierName(e.target.value)}
                          placeholder="اكتب اسم الكاشير أو الموظف المؤقت..."
                          className="rounded-xl text-xs font-bold bg-background border-border"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          استخدم هذا الخيار في حال تعيين كاشير مؤقت غير مسجل بالهيكل الوظيفي.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* OPENING BALANCE & NOTES */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                        <DollarSign size={13} />
                        الرصيد النقدي الافتتاحي (Opening Cash):
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={openingBalance}
                        onChange={(e) => setOpeningBalance(e.target.value)}
                        placeholder="0.00"
                        className="rounded-xl text-xs font-mono font-bold bg-background"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground">
                        ملاحظات استلام العهدة والوردية (اختياري):
                      </Label>
                      <Input
                        value={shiftNotes}
                        onChange={(e) => setShiftNotes(e.target.value)}
                        placeholder="مثال: استلام درج النقدية سليم وبداية وردية المساء..."
                        className="rounded-xl text-xs bg-background"
                      />
                    </div>
                  </div>

                  {/* ACTION: START SHIFT & OPEN POS */}
                  <div className="pt-2 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsNewShiftFormOpen(false)}
                      className="rounded-xl text-xs font-bold"
                    >
                      إلغاء
                    </Button>
                    <Button
                      type="button"
                      onClick={handleStartShift}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs gap-2 rounded-xl px-6 shadow-md"
                    >
                      <Play size={15} />
                      بدء الشيفت والانتقال لنقطة البيع (POS)
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 2: ACCESS CURRENT SHIFTS AS MANAGER */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                    <Lock className="text-indigo-600" size={16} />
                    الدخول على الشيفتات الموجودة حالياً كمدير
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    يمكن للمدير تعديل أو حذف بيانات الجلسة، أو الدخول على الشيفت لإجراء عمليات البيع
                    والمرتجع أو الإغلاق.
                  </p>
                </div>
                <Badge variant="outline" className="text-xs font-bold">
                  {openShifts.length} ورديات مفتوحة
                </Badge>
              </div>

              {openShifts.length === 0 ? (
                <div className="p-8 rounded-3xl border border-dashed border-border bg-muted/20 text-center space-y-2">
                  <Store size={32} className="mx-auto text-muted-foreground opacity-50" />
                  <p className="text-xs font-black text-muted-foreground">
                    لا توجد ورديات مطعم مفتوحة حالياً.
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    اضغط على زر "فتح وردية جديدة الآن" بالأعلى لبدء جلسة كاشير.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {openShifts.map((shift) => {
                    const activeRestaurantShift = erpStore.getActiveRestaurantShift();
                    const isCurrentlyActive = activeRestaurantShift?.id === shift.id;
                    const shiftRefunds = erpStore.getRestaurantRefundRecords(shift.id);

                    return (
                      <div
                        key={shift.id}
                        className={`p-4 rounded-2xl border transition-all space-y-3 ${
                          isCurrentlyActive
                            ? "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-300 dark:border-indigo-800 shadow-sm"
                            : "bg-card border-border hover:border-indigo-200"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-sm text-foreground">
                                {shift.shift_number}
                              </span>
                              {shift.auto_shift_number && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-mono text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50"
                                >
                                  {shift.auto_shift_number}
                                </Badge>
                              )}
                              {isCurrentlyActive ? (
                                <Badge className="bg-emerald-600 text-white text-[10px] font-black gap-1">
                                  <CheckCircle2 size={11} /> الوردية النشطة بالـ POS
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px] font-bold">
                                  مفتوحة
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap pt-0.5">
                              <span className="flex items-center gap-1 font-medium">
                                <UserCheck size={13} className="text-emerald-600" />
                                الكاشير: <b className="text-foreground">{shift.cashier_name}</b>
                              </span>
                              <span className="flex items-center gap-1 font-medium">
                                <Clock size={13} className="text-primary" />
                                البدء: {new Date(shift.start_at).toLocaleTimeString("ar-EG")}
                              </span>
                              {shift.opening_balance ? (
                                <span className="flex items-center gap-1 font-medium">
                                  <DollarSign size={13} className="text-amber-600" />
                                  الرصيد الافتتاحي:{" "}
                                  <b className="font-mono text-foreground">
                                    {shift.opening_balance.toLocaleString()} EGP
                                  </b>
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {/* Action Buttons for this shift */}
                          <div className="flex items-center gap-1.5 flex-wrap self-end sm:self-center">
                            {/* Enter Shift (POS) to perform Sales or Returns */}
                            <Button
                              size="sm"
                              onClick={() => handleEnterShift(shift)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black gap-1.5 shadow-xs cursor-pointer"
                            >
                              <Play size={13} />
                              الدخول للوردية (POS)
                            </Button>

                            {/* Edit Shift Data */}
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
                              className="rounded-xl text-xs font-bold gap-1 border-border cursor-pointer h-9 px-2.5"
                              title="تعديل بيانات الجلسة"
                            >
                              <Edit size={13} />
                              تعديل
                            </Button>

                            {/* Close Shift */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                onClose();
                                if (onRequestCloseShift) {
                                  onRequestCloseShift(shift);
                                }
                              }}
                              className="rounded-xl text-xs font-bold gap-1 text-rose-600 hover:bg-rose-50 border-rose-200 dark:border-rose-900 cursor-pointer h-9 px-2.5"
                              title="إغلاق الوردية والترحيل"
                            >
                              <Lock size={13} />
                              إغلاق
                            </Button>

                            {/* Delete Shift (Manager Action) */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDeletingShift(shift)}
                              className="rounded-xl text-xs font-bold gap-1 text-red-600 hover:bg-red-50 border-red-200 dark:border-red-900 cursor-pointer h-9 px-2.5"
                              title="حذف الوردية نهائياً كمدير"
                            >
                              <Trash2 size={13} />
                            </Button>
                          </div>
                        </div>

                        {/* Shift quick financial metrics */}
                        <div className="pt-2 border-t border-border/60 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                          <div className="bg-muted/40 p-2 rounded-xl">
                            <span className="text-muted-foreground block">إجمالي المبيعات:</span>
                            <span className="font-mono font-black text-foreground">
                              {Number(shift.total_sales || 0).toLocaleString()} EGP
                            </span>
                          </div>
                          <div className="bg-muted/40 p-2 rounded-xl">
                            <span className="text-muted-foreground block">حركات المرتجع:</span>
                            <span className="font-mono font-black text-rose-600">
                              {Number(shift.total_refunds || 0).toLocaleString()} EGP (
                              {shiftRefunds.length} مرتجع)
                            </span>
                          </div>
                          <div className="bg-muted/40 p-2 rounded-xl">
                            <span className="text-muted-foreground block">صافي الإيراد:</span>
                            <span className="font-mono font-black text-emerald-600">
                              {Number(shift.net_total || shift.total_sales || 0).toLocaleString()}{" "}
                              EGP
                            </span>
                          </div>
                          <div className="bg-muted/40 p-2 rounded-xl">
                            <span className="text-muted-foreground block">عدد الطلبات:</span>
                            <span className="font-mono font-black text-primary">
                              {shift.orders_count || 0} طلب
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="p-4 bg-muted/30 border-t border-border flex justify-between sm:justify-between items-center rounded-b-3xl">
            <span className="text-[11px] text-muted-foreground font-medium">
              نظام إدارة المطعم الشامل — تكامل القيود المحاسبية والمرتجعات والورديات
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="rounded-xl text-xs font-bold"
            >
              إغلاق النافذة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT SHIFT MODAL */}
      {editingShift && (
        <Dialog open={true} onOpenChange={() => setEditingShift(null)}>
          <DialogContent className="sm:max-w-[500px] rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-base font-black flex items-center gap-2 text-primary">
                <Edit size={18} />
                تعديل بيانات وردية المطعم
              </DialogTitle>
              <DialogDescription className="text-xs">
                يمكن لمدير النظام تعديل مسمى الوردية أو اسم الكاشير المسؤول أو الرصيد الافتتاحي.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">الرقم التلقائي المحفوظ:</Label>
                <Input
                  value={editingShift.auto_shift_number || editingShift.id}
                  readOnly
                  disabled
                  className="bg-muted font-mono text-xs font-black rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">اسم / رقم الوردية:</Label>
                <Input
                  value={editShiftNumber}
                  onChange={(e) => setEditShiftNumber(e.target.value)}
                  className="rounded-xl text-xs font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">اسم الكاشير المسؤول:</Label>
                <Input
                  value={editCashierName}
                  onChange={(e) => setEditCashierName(e.target.value)}
                  className="rounded-xl text-xs font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">الرصيد الافتتاحي:</Label>
                <Input
                  type="number"
                  value={editOpeningBalance}
                  onChange={(e) => setEditOpeningBalance(e.target.value)}
                  className="rounded-xl text-xs font-mono font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">ملاحظات الجلسة:</Label>
                <Input
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="rounded-xl text-xs"
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
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold"
              >
                حفظ التعديلات
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* CONFIRM DELETE DIALOG */}
      {deletingShift && (
        <Dialog open={true} onOpenChange={() => setDeletingShift(null)}>
          <DialogContent className="sm:max-w-[450px] rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-base font-black flex items-center gap-2 text-rose-600">
                <AlertTriangle size={18} />
                تأكيد حذف وردية المطعم
              </DialogTitle>
              <DialogDescription className="text-xs leading-relaxed text-foreground/80 pt-1">
                هل أنت متأكد من رغبتك في حذف الوردية{" "}
                <b className="text-rose-600">({deletingShift.shift_number})</b>؟ سيتم إزالة الجلسة
                من قائمة الورديات النشطة. هذا الإجراء مخصص للمدير ولا يمكن التراجع عنه.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="gap-2 sm:justify-between pt-4">
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
                onClick={handleConfirmDelete}
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black gap-1.5"
              >
                <Trash2 size={14} />
                تأكيد الحذف نهائياً
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <ShiftAuditLogViewerModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        initialShiftType="restaurant"
      />
    </>
  );
}
