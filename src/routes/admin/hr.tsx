// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/hooks/use-settings";
import {
  erpStore,
  type Employee,
  type AttendanceRecord,
  type EmployeeLoan,
  type PayrollRecord,
} from "@/shared/services/erpStore";
import { printRawHtml } from "@/shared/utils/printAccountingDocument";
import {
  Users,
  UserPlus,
  CalendarDays,
  Coins,
  FileSpreadsheet,
  PlusCircle,
  Briefcase,
  Phone,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2,
  Edit2,
  DollarSign,
  Filter,
  Check,
  UserCheck,
  HandCoins,
  CreditCard,
  Building2,
  Search,
  CheckSquare,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/hr")({
  head: () => ({ meta: [{ title: "إدارة الموارد البشرية وشؤون الموظفين" }] }),
  component: HRPage,
});

function HRPage() {
  const { toast } = useToast();
  const { formatPrice, formatTreasuryCurrency } = useSettings();

  // ERP Store subscription
  const [erpState, setErpState] = useState(erpStore.getState());
  useEffect(() => {
    return erpStore.subscribe(() => {
      setErpState(erpStore.getState());
    });
  }, []);

  const employees = useMemo(() => erpState.employees || [], [erpState.employees]);
  const attendance = useMemo(() => erpState.attendance || [], [erpState.attendance]);
  const loans = useMemo(() => erpState.loans || [], [erpState.loans]);
  const payrolls = useMemo(() => erpState.payrolls || [], [erpState.payrolls]);

  // Active Tab state
  const [activeTab, setActiveTab] = useState("employees");

  // Search & Filter States
  const [empSearch, setEmpSearch] = useState("");
  const [empDeptFilter, setEmpDeptFilter] = useState("all");

  // Attendance Date
  const [attendanceDate, setAttendanceDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );

  // Payroll Month
  const [payrollMonth, setPayrollMonth] = useState<string>("2026-07");

  // Dialog States
  const [isAddEmpOpen, setIsAddEmpOpen] = useState(false);
  const [isEditEmpOpen, setIsEditEmpOpen] = useState(false);
  const [isAddLoanOpen, setIsAddLoanOpen] = useState(false);
  const [isPaySalaryOpen, setIsPaySalaryOpen] = useState(false);
  const [isDeleteEmpOpen, setIsDeleteEmpOpen] = useState(false);
  const [isVoucherOpen, setIsVoucherOpen] = useState(false);
  const [voucherData, setVoucherData] = useState<{
    type: "loan" | "payroll_accrual" | "salary_payment";
    title: string;
    documentNo: string;
    date: string;
    employeeName?: string;
    employeeCode?: string;
    month?: string;
    amount?: number;
    currency?: string;
    treasuryName?: string;
    repaymentMonths?: number;
    notes?: string;
    journalEntries?: any[];
    breakdown?: {
      basic: number;
      bonuses: number;
      deductions: number;
      loans: number;
      net: number;
      employeeCount?: number;
    };
  } | null>(null);

  const handlePrintVoucher = (vData: typeof voucherData) => {
    if (!vData) return;
    const fullHtml = `<!DOCTYPE html>
<html lang="ar">
<head>
  <meta charset="utf-8" />
  <title>${vData.title}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; padding: 20px; color: #0f172a; background: #fff; text-align: right; }
    .header { text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; }
    .header h1 { margin: 0; font-size: 20px; color: #0f172a; font-weight: bold; }
    .header p { margin: 4px 0 0; font-size: 13px; color: #475569; }
    .doc-banner { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; }
    .doc-banner span { color: #0284c7; }
    .section-title { font-size: 14px; font-weight: bold; color: #1e293b; border-right: 4px solid #0284c7; padding-right: 8px; margin: 16px 0 10px; }
    .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; font-size: 12px; background: #fafafa; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 20px; }
    .info-item { display: flex; justify-content: space-between; padding: 6px 10px; border-bottom: 1px solid #f1f5f9; }
    .info-label { color: #64748b; font-weight: bold; }
    .info-val { font-weight: bold; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; margin-bottom: 20px; }
    th { background: #f1f5f9; color: #0f172a; font-weight: bold; padding: 10px; border: 1px solid #cbd5e1; text-align: right; }
    td { border: 1px solid #cbd5e1; padding: 8px; text-align: right; vertical-align: top; }
    .totals-box { margin-top: 16px; display: flex; justify-content: flex-end; gap: 20px; font-size: 14px; font-weight: bold; }
    .total-badge { background: #f0fdf4; border: 1px solid #86efac; color: #166534; padding: 8px 16px; border-radius: 8px; }
    .signatures { margin-top: 50px; display: flex; justify-content: space-between; text-align: center; font-size: 12px; color: #475569; }
    .sig-box { flex: 1; margin: 0 15px; }
    .sig-line { border-top: 1px dashed #94a3b8; margin-top: 45px; padding-top: 6px; font-weight: bold; }
    .footer { margin-top: 40px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>الشركة المصرية لادارة المشروعات السياحية والترفيهية (بهجت جروب)</h1>
    <p>Restocash ERP - الموارد البشرية والشؤون المالية</p>
    <h2 style="margin-top:10px; color:#0284c7; font-size:18px;">${vData.title}</h2>
  </div>

  <div class="doc-banner">
    <div>رقم المستند: <span>${vData.documentNo}</span></div>
    <div>تاريخ الإصدار: <span>${vData.date}</span></div>
    <div>الحالة: <span style="color:#16a34a;">معتمد ومسجل دفترياً</span></div>
  </div>

  ${
    vData.employeeName
      ? `<div class="info-grid">
          <div class="info-item"><span class="info-label">اسم الموظف:</span><span class="info-val">${vData.employeeName}</span></div>
          <div class="info-item"><span class="info-label">كود الموظف:</span><span class="info-val">${vData.employeeCode || "-"}</span></div>
          ${vData.month ? `<div class="info-item"><span class="info-label">عن شهر:</span><span class="info-val">${vData.month}</span></div>` : ""}
          ${vData.treasuryName ? `<div class="info-item"><span class="info-label">خزينة الصرف:</span><span class="info-val">${vData.treasuryName}</span></div>` : ""}
          ${vData.repaymentMonths ? `<div class="info-item"><span class="info-label">مدة السداد:</span><span class="info-val">${vData.repaymentMonths} أشهر</span></div>` : ""}
          ${vData.notes ? `<div class="info-item"><span class="info-label">ملاحظات:</span><span class="info-val">${vData.notes}</span></div>` : ""}
        </div>`
      : ""
  }

  ${
    vData.breakdown
      ? `<div class="section-title">تفاصيل ومكونات الاستحقاق والخصم</div>
        <table>
          <thead>
            <tr>
              <th>بيان العنصر</th>
              <th style="text-align:left;">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>الراتب الأساسي المستحق</td><td style="text-align:left; font-weight:bold;">${vData.breakdown.basic.toLocaleString()} ${vData.currency}</td></tr>
            ${vData.breakdown.bonuses ? `<tr><td>المكافآت والبدلات</td><td style="text-align:left; color:#16a34a; font-weight:bold;">+${vData.breakdown.bonuses.toLocaleString()} ${vData.currency}</td></tr>` : ""}
            ${vData.breakdown.deductions ? `<tr><td>خصومات الحضور والغياب</td><td style="text-align:left; color:#dc2626; font-weight:bold;">-${vData.breakdown.deductions.toLocaleString()} ${vData.currency}</td></tr>` : ""}
            ${vData.breakdown.loans ? `<tr><td>استقطاع اقساط السلف والقروض</td><td style="text-align:left; color:#dc2626; font-weight:bold;">-${vData.breakdown.loans.toLocaleString()} ${vData.currency}</td></tr>` : ""}
            <tr style="background:#f0fdf4; font-weight:bold; font-size:13px;">
              <td>صافي المستحق للصرف</td>
              <td style="text-align:left; color:#166534;">${vData.breakdown.net.toLocaleString()} ${vData.currency}</td>
            </tr>
          </tbody>
        </table>`
      : ""
  }

  ${
    vData.amount && !vData.breakdown
      ? `<div class="totals-box">
          <div class="total-badge">إجمالي المبلغ المصروف: ${vData.amount.toLocaleString()} ${vData.currency}</div>
        </div>`
      : ""
  }

  ${
    vData.journalEntries && vData.journalEntries.length > 0
      ? `<div class="section-title">القيد المحاسبي التلقائي المترتب (General Ledger Journal)</div>
        <table>
          <thead>
            <tr>
              <th>رقم الحساب</th>
              <th>اسم الحساب</th>
              <th style="text-align:left;">مدين (+)</th>
              <th style="text-align:left;">دائن (-)</th>
              <th>البيان والوصف</th>
            </tr>
          </thead>
          <tbody>
            ${vData.journalEntries
              .flatMap((je: any) => je.lines || [])
              .map(
                (line: any) => `
              <tr>
                <td style="font-family:monospace; font-weight:bold;">${line.account_code}</td>
                <td>${line.account_name || "حساب محاسبي"}</td>
                <td style="text-align:left; font-weight:bold; ${line.debit > 0 ? "color:#16a34a;" : ""}">${line.debit > 0 ? line.debit.toLocaleString() + " " + (line.currency || vData.currency) : "-"}</td>
                <td style="text-align:left; font-weight:bold; ${line.credit > 0 ? "color:#dc2626;" : ""}">${line.credit > 0 ? line.credit.toLocaleString() + " " + (line.currency || vData.currency) : "-"}</td>
                <td>${line.description || line.note || "-"}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>`
      : ""
  }

  <div class="signatures">
    <div class="sig-box"><div class="sig-line">${vData.employeeName ? `المستلم: ${vData.employeeName}` : "إعداد مسؤول HR"}</div></div>
    <div class="sig-box"><div class="sig-line">المراجعة والتدقيق المحاسبي</div></div>
    <div class="sig-box"><div class="sig-line">اعتماد المدير المالي / العام</div></div>
  </div>

  <div class="footer">
    مستند HR ومالي إلكتروني صادر من نظام Restocash ERP - تم إنشاؤه بتاريخ ${new Date().toLocaleDateString("ar-EG")} ${new Date().toLocaleTimeString("ar-EG")}
  </div>
</body>
</html>`;

    printRawHtml(fullHtml);
  };

  const viewLoanVoucher = (l: EmployeeLoan) => {
    const emp = employees.find((e) => e.id === l.employee_id);
    const tr = (erpState.treasuries || []).find((t) => t.id === l.treasury_id);
    const ref = `LOAN-${l.id.slice(-6).toUpperCase()}`;
    const je = (erpState.journalEntries || []).find(
      (j) =>
        j.reference === ref ||
        j.description?.includes(ref) ||
        j.description?.includes(emp?.name || ""),
    );
    setVoucherData({
      type: "loan",
      title: "سند صرف سلفة مالية للموظف",
      documentNo: ref,
      date: l.date,
      employeeName: emp?.name,
      employeeCode: emp?.id,
      amount: l.amount,
      currency: l.currency,
      treasuryName: tr?.name_ar || "الخزينة الرئيسية",
      repaymentMonths: l.repayment_months,
      notes: l.notes,
      journalEntries: je ? [je] : [],
    });
    setIsVoucherOpen(true);
  };

  const viewPayrollVoucher = (p: PayrollRecord) => {
    const emp = employees.find((e) => e.id === p.employee_id);
    const tr = (erpState.treasuries || []).find((t) => t.id === p.payment_treasury_id);
    const ref = `PAY-${p.id.substring(4, 9).toUpperCase()}`;
    const je = (erpState.journalEntries || []).find(
      (j) => j.reference === ref || j.description?.includes(p.month),
    );
    setVoucherData({
      type: "salary_payment",
      title: `إشعار وسند صرف راتب موظف - شهر ${p.month}`,
      documentNo: ref,
      date: p.payment_date || new Date().toISOString().split("T")[0],
      employeeName: emp?.name,
      employeeCode: emp?.id,
      month: p.month,
      amount: p.net_salary,
      currency: p.currency,
      treasuryName: tr?.name_ar || "خزينة الصرف",
      journalEntries: je ? [je] : [],
      breakdown: {
        basic: p.basic_salary,
        bonuses: p.bonuses,
        deductions: p.deductions,
        loans: p.loan_deduction,
        net: p.net_salary,
      },
    });
    setIsVoucherOpen(true);
  };

  const openAccrualVoucher = (month: string) => {
    const monthPayrolls = (erpState.payrolls || []).filter((p) => p.month === month);
    const accrualEntries = (erpState.journalEntries || []).filter(
      (j) =>
        j.id?.startsWith(`PAYROLL-ACCRUAL-${month}`) ||
        j.description?.includes(`استحقاق رواتب وأجور شهر ${month}`) ||
        j.reference?.includes(`ACCRUAL-${month}`),
    );
    setVoucherData({
      type: "payroll_accrual",
      title: `سند قيد استحقاق رواتب وأجور شهر ${month}`,
      documentNo: accrualEntries[0]?.reference || `ACCRUAL-${month}`,
      date: `${month}-28`,
      month,
      currency: accrualEntries[0]?.currency || monthPayrolls[0]?.currency || "EGP",
      journalEntries: accrualEntries,
      breakdown: {
        basic: monthPayrolls.reduce((s, p) => s + (p.basic_salary || 0), 0),
        bonuses: monthPayrolls.reduce((s, p) => s + (p.bonuses || 0), 0),
        deductions: monthPayrolls.reduce((s, p) => s + (p.deductions || 0), 0),
        loans: monthPayrolls.reduce((s, p) => s + (p.loan_deduction || 0), 0),
        net: monthPayrolls.reduce((s, p) => s + (p.net_salary || 0), 0),
        employeeCount: monthPayrolls.length,
      },
    });
    setIsVoucherOpen(true);
  };

  // Selected Elements for Edit/Pay/Delete
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [empToDelete, setEmpToDelete] = useState<Employee | null>(null);
  const [selectedPayroll, setSelectedPayroll] = useState<PayrollRecord | null>(null);
  const [paySalaryTreasuryId, setPaySalaryTreasuryId] = useState<string>("");

  // Employee Form State
  const [empForm, setEmpForm] = useState({
    name: "",
    job_title: "",
    department: "المطبخ",
    phone: "",
    email: "",
    hire_date: new Date().toISOString().split("T")[0],
    salary: 5000,
    currency: "EGP",
    status: "active" as Employee["status"],
  });

  // Loan Form State
  const [loanForm, setLoanForm] = useState({
    employee_id: "",
    amount: 1000,
    currency: "EGP",
    repayment_months: 2,
    treasury_id: "",
    notes: "",
  });

  // Reset forms helper
  const resetEmpForm = () => {
    setEmpForm({
      name: "",
      job_title: "",
      department: "المطبخ",
      phone: "",
      email: "",
      hire_date: new Date().toISOString().split("T")[0],
      salary: 5000,
      currency: "EGP",
      status: "active",
    });
  };

  const resetLoanForm = () => {
    const activeEmp = employees.find((e) => e.status === "active") || employees[0];
    const activeTreasury = erpState.treasuries?.find((t) => !t.deleted) || erpState.treasuries?.[0];
    setLoanForm({
      employee_id: activeEmp?.id || "",
      amount: 1000,
      currency: activeEmp?.currency || "EGP",
      repayment_months: 2,
      treasury_id: activeTreasury?.id || "",
      notes: "",
    });
  };

  const openLoanDialog = () => {
    resetLoanForm();
    setIsAddLoanOpen(true);
  };

  // HR Executive Stats
  const activeEmployeesCount = employees.filter((e) => e.status === "active").length;
  const totalPayrollCost = useMemo(() => {
    return employees
      .filter((e) => e.status === "active")
      .reduce((sum, emp) => sum + (Number(emp.salary) || 0), 0);
  }, [employees]);

  const activeLoansCount = loans.filter((l) => l.status === "active").length;
  const activeLoansAmount = loans
    .filter((l) => l.status === "active")
    .reduce((sum, l) => sum + (l.amount - l.paid_amount), 0);

  // Filter Employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchSearch =
        (emp.name || "").toLowerCase().includes(empSearch.toLowerCase()) ||
        (emp.job_title || "").toLowerCase().includes(empSearch.toLowerCase()) ||
        (emp.phone || "").includes(empSearch);
      const matchDept = empDeptFilter === "all" || emp.department === empDeptFilter;
      return matchSearch && matchDept;
    });
  }, [employees, empSearch, empDeptFilter]);

  // Handle Employee Actions
  const handleAddEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empForm.name.trim() || !empForm.job_title.trim() || !empForm.phone.trim()) {
      toast({
        title: "خطأ في الإدخال",
        description: "يرجى ملء جميع الحقول الإلزامية.",
        variant: "destructive",
      });
      return;
    }
    try {
      erpStore.addEmployee({
        ...empForm,
        salary: Number(empForm.salary) || 0,
      });
      toast({
        title: "تم الحفظ بنجاح",
        description: `تم تسجيل الموظف: ${empForm.name}`,
      });
      setIsAddEmpOpen(false);
      resetEmpForm();
    } catch (err: any) {
      toast({
        title: "خطأ في إضافة الموظف",
        description: err.message || "تعذر إضافة الموظف.",
        variant: "destructive",
      });
    }
  };

  const handleEditEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) return;
    if (!empForm.name.trim() || !empForm.job_title.trim() || !empForm.phone.trim()) {
      toast({
        title: "خطأ في الإدخال",
        description: "يرجى ملء جميع الحقول الإلزامية.",
        variant: "destructive",
      });
      return;
    }
    try {
      erpStore.updateEmployee(selectedEmp.id, {
        ...empForm,
        salary: Number(empForm.salary) || 0,
      });
      toast({
        title: "تم التحديث بنجاح",
        description: `تم حفظ تعديلات الموظف: ${empForm.name}`,
      });
      setIsEditEmpOpen(false);
      setSelectedEmp(null);
      resetEmpForm();
    } catch (err: any) {
      toast({
        title: "خطأ في التحديث",
        description: err.message || "تعذر تحديث بيانات الموظف.",
        variant: "destructive",
      });
    }
  };

  const openDeleteDialog = (emp: Employee) => {
    setEmpToDelete(emp);
    setIsDeleteEmpOpen(true);
  };

  const handleConfirmDeleteEmployee = () => {
    if (!empToDelete) return;
    try {
      erpStore.deleteEmployee(empToDelete.id);
      toast({
        title: "تم الحذف بنجاح",
        description: `تم إزالة الموظف ${empToDelete.name} من النظام.`,
      });
      setIsDeleteEmpOpen(false);
      setEmpToDelete(null);
    } catch (err: any) {
      toast({
        title: "خطأ في الحذف",
        description: err.message || "تعذر حذف الموظف.",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (emp: Employee) => {
    setSelectedEmp(emp);
    setEmpForm({
      name: emp.name || "",
      job_title: emp.job_title || "",
      department: emp.department || "المطبخ",
      phone: emp.phone || "",
      email: emp.email || "",
      hire_date: emp.hire_date || new Date().toISOString().split("T")[0],
      salary: emp.salary || 0,
      currency: emp.currency || "EGP",
      status: emp.status || "active",
    });
    setIsEditEmpOpen(true);
  };

  // Handle Attendance
  const getEmployeeAttendanceStatus = (empId: string) => {
    const record = attendance.find((r) => r.employee_id === empId && r.date === attendanceDate);
    return record ? record.status : "unrecorded";
  };

  const handleRecordAttendance = (empId: string, status: AttendanceRecord["status"]) => {
    erpStore.recordAttendance(empId, attendanceDate, status);
    toast({
      title: "تم تسجيل الحضور",
      description: "تم تحديث حالة الموظف بنجاح.",
    });
  };

  // Handle Loans
  const handleAddLoanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanForm.employee_id || !loanForm.amount || loanForm.amount <= 0) {
      toast({
        title: "خطأ في الإدخال",
        description: "يرجى اختيار الموظف وتحديد مبلغ السلفة الإيجابي.",
        variant: "destructive",
      });
      return;
    }
    if (!loanForm.treasury_id) {
      toast({
        title: "خطأ في الإدخال",
        description: "يرجى اختيار الخزينة أو البنك لصرف السلفة.",
        variant: "destructive",
      });
      return;
    }
    const emp = employees.find((e) => e.id === loanForm.employee_id);
    if (!emp) {
      toast({
        title: "خطأ",
        description: "الموظف المختار غير موجود في النظام.",
        variant: "destructive",
      });
      return;
    }

    try {
      const loan = erpStore.addLoan(
        loanForm.employee_id,
        loanForm.amount,
        loanForm.currency || emp.currency || "EGP",
        loanForm.repayment_months,
        loanForm.notes,
        loanForm.treasury_id,
      );

      const tr = (erpState.treasuries || []).find((t) => t.id === loanForm.treasury_id);
      const ref = `LOAN-${loan.id.slice(-6).toUpperCase()}`;
      const latestEntries = erpStore.getState().journalEntries || [];
      const je = latestEntries.find(
        (j) =>
          j.reference === ref || j.description?.includes(ref) || j.description?.includes(emp.name),
      );

      setVoucherData({
        type: "loan",
        title: "سند صرف سلفة مالية للموظف",
        documentNo: ref,
        date: loan.date,
        employeeName: emp.name,
        employeeCode: emp.id,
        amount: loan.amount,
        currency: loan.currency,
        treasuryName: tr?.name_ar || "الخزينة الرئيسية",
        repaymentMonths: loan.repayment_months,
        notes: loan.notes,
        journalEntries: je ? [je] : [],
      });

      toast({
        title: "تم قيد وصرف السلفة بنجاح",
        description: `تم قيد السلفة بقيمة ${loanForm.amount} ${loan.currency} وصرفها وتوليد المستند المالي التلقائي.`,
      });

      setIsAddLoanOpen(false);
      resetLoanForm();
      setIsVoucherOpen(true);
    } catch (err: any) {
      toast({
        title: "خطأ في صرف السلفة",
        description: err.message || "تعذر صرف السلفة وقيدها.",
        variant: "destructive",
      });
    }
  };

  // Handle Payroll
  const handleGeneratePayroll = () => {
    erpStore.generatePayroll(payrollMonth);
    toast({
      title: "توليد مسير الرواتب",
      description: `تم احتساب رواتب الموظفين لشهر ${payrollMonth} بنجاح.`,
    });
  };

  const handlePostPayrollAccrual = () => {
    try {
      const entries = erpStore.postPayrollAccrualJournal(payrollMonth);
      const refs = entries.map((e: any) => e.reference || e.id).join("، ");
      const monthPayrolls = (erpState.payrolls || []).filter((p) => p.month === payrollMonth);

      setVoucherData({
        type: "payroll_accrual",
        title: `سند قيد استحقاق رواتب وأجور شهر ${payrollMonth}`,
        documentNo: entries[0]?.reference || `ACCRUAL-${payrollMonth}`,
        date: `${payrollMonth}-28`,
        month: payrollMonth,
        currency: entries[0]?.currency || "EGP",
        journalEntries: entries,
        breakdown: {
          basic: monthPayrolls.reduce((s, p) => s + (p.basic_salary || 0), 0),
          bonuses: monthPayrolls.reduce((s, p) => s + (p.bonuses || 0), 0),
          deductions: monthPayrolls.reduce((s, p) => s + (p.deductions || 0), 0),
          loans: monthPayrolls.reduce((s, p) => s + (p.loan_deduction || 0), 0),
          net: monthPayrolls.reduce((s, p) => s + (p.net_salary || 0), 0),
          employeeCount: monthPayrolls.length,
        },
      });

      toast({
        title: "تم توليد قيود استحقاق المرتبات تلقائياً",
        description: `تم إدراج قيود استحقاق المرتبات لشهر ${payrollMonth} برقم القيد الموحد: (${refs})`,
      });

      setIsVoucherOpen(true);
    } catch (err: any) {
      toast({
        title: "خطأ في التوليد",
        description: err.message || "تعذر توليد قيود استحقاق المرتبات.",
        variant: "destructive",
      });
    }
  };

  const openPaySalaryDialog = (payroll: PayrollRecord) => {
    setSelectedPayroll(payroll);
    // Find active cash treasuries that match the salary currency
    const matchingTreasuries = (erpState.treasuries || []).filter(
      (t) => !t.deleted && (t.currency === "MULTI" || t.currency === payroll.currency),
    );
    if (matchingTreasuries.length > 0) {
      setPaySalaryTreasuryId(matchingTreasuries[0].id);
    } else {
      setPaySalaryTreasuryId("");
    }
    setIsPaySalaryOpen(true);
  };

  const handlePaySalarySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayroll || !paySalaryTreasuryId) return;

    const emp = employees.find((e) => e.id === selectedPayroll.employee_id);
    const tr = (erpState.treasuries || []).find((t) => t.id === paySalaryTreasuryId);
    const ref = `PAY-${selectedPayroll.id.substring(4, 9).toUpperCase()}`;

    erpStore.paySalary(selectedPayroll.id, paySalaryTreasuryId);

    const latestEntries = erpStore.getState().journalEntries || [];
    const je = latestEntries.find(
      (j) => j.reference === ref || j.description?.includes(selectedPayroll.month),
    );

    setVoucherData({
      type: "salary_payment",
      title: `إشعار وسند صرف راتب موظف - شهر ${selectedPayroll.month}`,
      documentNo: ref,
      date: new Date().toISOString().split("T")[0],
      employeeName: emp?.name,
      employeeCode: emp?.id,
      month: selectedPayroll.month,
      amount: selectedPayroll.net_salary,
      currency: selectedPayroll.currency,
      treasuryName: tr?.name_ar || "خزينة الصرف",
      journalEntries: je ? [je] : [],
      breakdown: {
        basic: selectedPayroll.basic_salary,
        bonuses: selectedPayroll.bonuses,
        deductions: selectedPayroll.deductions,
        loans: selectedPayroll.loan_deduction,
        net: selectedPayroll.net_salary,
      },
    });

    toast({
      title: "تم صرف الراتب",
      description: "تم صرف الراتب بنجاح، وخصم المبلغ من الخزينة وتسجيل الحركة والسند المالي.",
    });

    setIsPaySalaryOpen(false);
    setSelectedPayroll(null);
    setIsVoucherOpen(true);
  };

  // Statistics for Attendance Tab
  const attendanceStatsForDate = useMemo(() => {
    const records = attendance.filter((r) => r.date === attendanceDate);
    const present = records.filter((r) => r.status === "present").length;
    const absent = records.filter((r) => r.status === "absent").length;
    const late = records.filter((r) => r.status === "late").length;
    const leave = records.filter((r) => r.status === "leave").length;
    const total = employees.length;
    const unrecorded = total - records.length;

    return { present, absent, late, leave, total, unrecorded };
  }, [attendance, attendanceDate, employees]);

  return (
    <div className="space-y-6">
      {/* Visual Header */}
      <div className="bg-card border border-border p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1.5 text-right">
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users size={28} className="text-primary" />
            شؤون الموظفين والموارد البشرية (HR)
          </h2>
          <p className="text-sm text-muted-foreground font-medium">
            متابعة الحضور والانصراف، احتساب مسيرات الرواتب الشهرية وصرفها نقداً من الخزينة، وإدارة
            السلف والقروض
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setIsAddEmpOpen(true)}
            className="gap-2 rounded-xl font-bold px-5 py-6"
          >
            <UserPlus size={18} />
            إضافة موظف جديد
          </Button>
          <Button
            variant="outline"
            onClick={openLoanDialog}
            className="gap-2 rounded-xl font-bold px-5 py-6"
          >
            <Coins size={18} />
            صرف سلفة لموظف
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border border-border shadow-sm rounded-2xl bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Users size={14} />
              إجمالي الكادر الوظيفي
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-800 dark:text-slate-100">
              {employees.length} موظفين
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              منهم {activeEmployeesCount} نشطين حالياً في الفروع
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm rounded-2xl bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Building2 size={14} />
              الأجور الشهرية الأساسية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-800 dark:text-slate-100">
              {formatPrice(totalPayrollCost)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              مجموع الرواتب بعد التحويل لعملة العرض الحالية
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm rounded-2xl bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Coins size={14} />
              القروض والسلف الجارية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-amber-600 dark:text-amber-400">
              {formatPrice(activeLoansAmount)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              موزعة على {activeLoansCount} سلف جاري سدادها
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm rounded-2xl bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Clock size={14} />
              انضباط الحضور والدوام اليوم
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
              {attendanceStatsForDate.total > 0
                ? Math.round(
                    ((attendanceStatsForDate.present + attendanceStatsForDate.late) /
                      attendanceStatsForDate.total) *
                      100,
                  )
                : 0}
              %
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              معدل حضور الدوام والتواجد لليوم الحالي
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted p-1 rounded-xl flex flex-wrap gap-1 h-auto w-full md:w-auto">
          <TabsTrigger value="employees" className="rounded-lg font-bold py-2.5 px-5">
            <Users size={16} className="ml-1.5 inline" />
            دليل الكادر الوظيفي
          </TabsTrigger>
          <TabsTrigger value="attendance" className="rounded-lg font-bold py-2.5 px-5">
            <CalendarDays size={16} className="ml-1.5 inline" />
            حضور وانصراف اليوم
          </TabsTrigger>
          <TabsTrigger value="payroll" className="rounded-lg font-bold py-2.5 px-5">
            <FileSpreadsheet size={16} className="ml-1.5 inline" />
            مسيرات الأجور والرواتب
          </TabsTrigger>
          <TabsTrigger value="loans" className="rounded-lg font-bold py-2.5 px-5">
            <Coins size={16} className="ml-1.5 inline" />
            القروض والسلف المالية
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: EMPLOYEE DIRECTORY */}
        <TabsContent value="employees" className="mt-4 space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-muted/40 p-4 rounded-xl">
            <div className="relative w-full md:w-80">
              <Search className="absolute right-3 top-3 text-muted-foreground" size={16} />
              <Input
                placeholder="ابحث باسم الموظف أو وظيفته أو هاتفه..."
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
                className="pr-10 bg-card rounded-xl text-xs"
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <Badge variant="outline" className="text-[10px] py-1 px-3">
                تصفية القسم:
              </Badge>
              <select
                value={empDeptFilter}
                onChange={(e) => setEmpDeptFilter(e.target.value)}
                className="bg-card border border-border text-xs rounded-xl px-3 py-1.5 font-bold outline-none"
              >
                <option value="all">كل الأقسام والمطابخ</option>
                <option value="المطبخ">المطبخ (Kitchen)</option>
                <option value="الصالة والتوصيل">الصالة والتوصيل (Floor)</option>
                <option value="الإدارة">الإدارة (Administration)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredEmployees.length === 0 ? (
              <div className="col-span-1 md:col-span-3 text-center py-12 text-muted-foreground">
                لا يوجد موظفين يطابقون خيارات البحث حالياً.
              </div>
            ) : (
              filteredEmployees.map((emp) => (
                <Card key={emp.id} className="border border-border shadow-sm rounded-2xl bg-card">
                  <CardHeader className="pb-3 border-b border-border/50">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-black text-base text-slate-800 dark:text-slate-100">
                            {emp.name}
                          </h3>
                          <Badge
                            className={
                              emp.status === "active"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                            }
                            variant="outline"
                          >
                            {emp.status === "active"
                              ? "نشط"
                              : emp.status === "inactive"
                                ? "غير نشط"
                                : "موقوف"}
                          </Badge>
                        </div>
                        <p className="text-xs font-bold text-primary flex items-center gap-1">
                          <Briefcase size={12} />
                          {emp.job_title} • {emp.department}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3.5">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="space-y-1">
                        <span className="text-muted-foreground block font-bold text-[10px]">
                          الهاتف
                        </span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <Phone size={11} />
                          {emp.phone}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-muted-foreground block font-bold text-[10px]">
                          تاريخ التعيين
                        </span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <Calendar size={11} />
                          {emp.hire_date}
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-muted-foreground block font-bold text-[10px]">
                          الراتب الأساسي
                        </span>
                        <span className="font-black text-sm text-slate-800 dark:text-slate-200">
                          {formatTreasuryCurrency(emp.salary, emp.currency)}
                        </span>
                      </div>
                      <div className="text-left space-y-0.5">
                        <span className="text-muted-foreground block font-bold text-[10px]">
                          الراتب المقوم
                        </span>
                        <span className="font-bold text-xs text-slate-500">
                          {formatPrice(emp.salary, emp.currency as any)}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 border-t border-border/50 pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(emp)}
                        className="rounded-lg text-xs gap-1 h-8"
                      >
                        <Edit2 size={12} />
                        تعديل
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteDialog(emp)}
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg text-xs gap-1 h-8"
                      >
                        <Trash2 size={12} />
                        حذف
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* TAB 2: DAILY ATTENDANCE */}
        <TabsContent value="attendance" className="mt-4 space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-muted/40 p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <CalendarDays className="text-primary" size={20} />
              <div className="space-y-0.5 text-right">
                <span className="text-[10px] text-muted-foreground font-bold block">
                  تاريخ رصد الحضور
                </span>
                <Input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="bg-card border border-border text-xs rounded-xl px-3 h-9 py-1 font-bold outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 py-1.5 px-3">
                حاضر: {attendanceStatsForDate.present}
              </Badge>
              <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 py-1.5 px-3">
                متأخر: {attendanceStatsForDate.late}
              </Badge>
              <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 py-1.5 px-3">
                غائب: {attendanceStatsForDate.absent}
              </Badge>
              <Badge className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 py-1.5 px-3">
                إجازة: {attendanceStatsForDate.leave}
              </Badge>
              {attendanceStatsForDate.unrecorded > 0 && (
                <Badge className="bg-slate-100 text-slate-700 py-1.5 px-3">
                  غير مرصود: {attendanceStatsForDate.unrecorded}
                </Badge>
              )}
            </div>
          </div>

          <Card className="border border-border shadow-sm rounded-2xl bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-muted/70 text-muted-foreground text-xs border-b border-border font-bold">
                  <tr>
                    <th className="p-3.5 pr-6">اسم الموظف</th>
                    <th className="p-3.5">القسم</th>
                    <th className="p-3.5">المسمى الوظيفي</th>
                    <th className="p-3.5">حالة اليوم</th>
                    <th className="p-3.5 text-center pl-6">تسجيل وتعديل الدوام اليومي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {employees
                    .filter((e) => e.status === "active")
                    .map((emp) => {
                      const currentStatus = getEmployeeAttendanceStatus(emp.id);
                      return (
                        <tr key={emp.id} className="hover:bg-muted/30 transition">
                          <td className="p-3.5 pr-6 font-bold text-slate-800">{emp.name}</td>
                          <td className="p-3.5 text-xs text-muted-foreground font-bold">
                            {emp.department}
                          </td>
                          <td className="p-3.5 text-xs font-bold text-slate-700">
                            {emp.job_title}
                          </td>
                          <td className="p-3.5">
                            {currentStatus === "present" && (
                              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                حاضر
                              </Badge>
                            )}
                            {currentStatus === "late" && (
                              <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                متأخر
                              </Badge>
                            )}
                            {currentStatus === "absent" && (
                              <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                غائب
                              </Badge>
                            )}
                            {currentStatus === "leave" && (
                              <Badge className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                                إجازة
                              </Badge>
                            )}
                            {currentStatus === "unrecorded" && (
                              <Badge variant="outline" className="text-slate-400 border-dashed">
                                لم يسجل بعد
                              </Badge>
                            )}
                          </td>
                          <td className="p-3.5 text-center pl-6">
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                size="sm"
                                variant={currentStatus === "present" ? "default" : "outline"}
                                onClick={() => handleRecordAttendance(emp.id, "present")}
                                className="h-7 text-[10px] rounded-lg font-bold px-2.5"
                              >
                                <CheckCircle2 size={12} className="ml-1" /> حاضر
                              </Button>
                              <Button
                                size="sm"
                                variant={currentStatus === "late" ? "default" : "outline"}
                                onClick={() => handleRecordAttendance(emp.id, "late")}
                                className="h-7 text-[10px] rounded-lg font-bold px-2.5 bg-amber-500 hover:bg-amber-600 text-white border-amber-500"
                              >
                                <Clock size={12} className="ml-1" /> متأخر
                              </Button>
                              <Button
                                size="sm"
                                variant={currentStatus === "absent" ? "destructive" : "outline"}
                                onClick={() => handleRecordAttendance(emp.id, "absent")}
                                className="h-7 text-[10px] rounded-lg font-bold px-2.5"
                              >
                                <XCircle size={12} className="ml-1" /> غائب
                              </Button>
                              <Button
                                size="sm"
                                variant={currentStatus === "leave" ? "default" : "outline"}
                                onClick={() => handleRecordAttendance(emp.id, "leave")}
                                className="h-7 text-[10px] rounded-lg font-bold px-2.5 bg-sky-500 hover:bg-sky-600 text-white border-sky-500"
                              >
                                <Calendar size={12} className="ml-1" /> إجازة
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* TAB 3: PAYROLL SHEETS */}
        <TabsContent value="payroll" className="mt-4 space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-muted/40 p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="text-primary" size={20} />
              <div className="space-y-0.5 text-right">
                <span className="text-[10px] text-muted-foreground font-bold block">
                  شهر صرف الرواتب
                </span>
                <Input
                  type="month"
                  value={payrollMonth}
                  onChange={(e) => setPayrollMonth(e.target.value)}
                  className="bg-card border border-border text-xs rounded-xl px-3 h-9 py-1 font-bold outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={handleGeneratePayroll}
                variant="outline"
                className="gap-2 rounded-xl font-bold px-4"
              >
                <PlusCircle size={16} />
                احتساب كشف الرواتب
              </Button>
              <Button
                onClick={handlePostPayrollAccrual}
                className="gap-2 rounded-xl font-bold px-5 bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
              >
                <CheckCircle2 size={16} />
                توليد قيود استحقاق المرتبات اوتوماتيك (M/N)
              </Button>
              <Button
                onClick={() => openAccrualVoucher(payrollMonth)}
                variant="outline"
                className="gap-2 rounded-xl font-bold px-4 border-purple-500/40 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30"
              >
                <Printer size={16} />
                عرض/طباعة قيد الاستحقاق
              </Button>
            </div>
          </div>

          <Card className="border border-border shadow-sm rounded-2xl bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-muted/70 text-muted-foreground text-xs border-b border-border font-bold">
                  <tr>
                    <th className="p-3.5 pr-6">اسم الموظف</th>
                    <th className="p-3.5">الراتب الأساسي</th>
                    <th className="p-3.5 text-rose-600">خصومات الحضور والغياب</th>
                    <th className="p-3.5 text-amber-600">خصم قسط السلفة</th>
                    <th className="p-3.5 text-emerald-600">صافي المستحق للقبض</th>
                    <th className="p-3.5">العملة الأساسية</th>
                    <th className="p-3.5">الحالة</th>
                    <th className="p-3.5 text-center pl-6">صرف النقدية والإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {payrolls.filter((p) => p.month === payrollMonth).length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        لم يتم توليد مسير رواتب لهذا الشهر بعد. يرجى الضغط على زر توليد مسير الرواتب
                        أعلاه.
                      </td>
                    </tr>
                  ) : (
                    payrolls
                      .filter((p) => p.month === payrollMonth)
                      .map((p) => {
                        const emp = employees.find((e) => e.id === p.employee_id);
                        return (
                          <tr key={p.id} className="hover:bg-muted/30 transition">
                            <td className="p-3.5 pr-6 font-bold text-slate-800">
                              {emp ? emp.name : "موظف محذوف"}
                            </td>
                            <td className="p-3.5 font-mono font-bold">
                              {formatTreasuryCurrency(p.basic_salary, p.currency)}
                            </td>
                            <td className="p-3.5 font-mono font-bold text-rose-600">
                              -{formatTreasuryCurrency(p.deductions, p.currency)}
                            </td>
                            <td className="p-3.5 font-mono font-bold text-amber-600">
                              -{formatTreasuryCurrency(p.loan_deduction, p.currency)}
                            </td>
                            <td className="p-3.5 font-mono font-black text-emerald-600">
                              {formatTreasuryCurrency(p.net_salary, p.currency)}
                            </td>
                            <td className="p-3.5 text-xs text-muted-foreground font-black">
                              {p.currency}
                            </td>
                            <td className="p-3.5">
                              {p.status === "paid" ? (
                                <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                  تم الصرف
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-slate-400 border-dashed">
                                  بانتظار الصرف
                                </Badge>
                              )}
                            </td>
                            <td className="p-3.5 text-center pl-6">
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => viewPayrollVoucher(p)}
                                  className="h-7 text-xs rounded-lg font-bold px-3 gap-1"
                                >
                                  <Printer size={12} />
                                  عرض السند
                                </Button>
                                {p.status === "paid" ? (
                                  <div className="text-xs text-slate-400 font-bold font-mono">
                                    تاريخ الدفع: {p.payment_date}
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={() => openPaySalaryDialog(p)}
                                    className="h-7 text-xs rounded-lg font-bold px-4 bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 gap-1"
                                  >
                                    <CreditCard size={12} />
                                    صرف الراتب نقداً
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* TAB 4: EMPLOYEES LOANS AND ADVANCES */}
        <TabsContent value="loans" className="mt-4 space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-muted/40 p-4 rounded-xl">
            <h3 className="font-bold text-sm text-slate-700 flex items-center gap-1.5">
              <Coins className="text-primary" size={18} />
              متابعة تسديد السلف من رواتب الموظفين
            </h3>
            <Button onClick={openLoanDialog} className="gap-2 rounded-xl font-bold px-5">
              <PlusCircle size={16} />
              طلب سلفة نقدية جديدة لموظف
            </Button>
          </div>

          <Card className="border border-border shadow-sm rounded-2xl bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-muted/70 text-muted-foreground text-xs border-b border-border font-bold">
                  <tr>
                    <th className="p-3.5 pr-6">اسم الموظف</th>
                    <th className="p-3.5">تاريخ السلفة</th>
                    <th className="p-3.5">مبلغ السلفة الأصلي</th>
                    <th className="p-3.5">شهور السداد</th>
                    <th className="p-3.5">القسط الشهري</th>
                    <th className="p-3.5 text-emerald-600">المبلغ المسدد حتى الآن</th>
                    <th className="p-3.5 text-rose-600">المبلغ المتبقي للتحصيل</th>
                    <th className="p-3.5">الحالة العامة</th>
                    <th className="p-3.5 text-center pl-6">المستند والطباعة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {loans.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-muted-foreground">
                        لا يوجد سلف أو قروض مسجلة في هذا الحساب حالياً.
                      </td>
                    </tr>
                  ) : (
                    loans.map((l) => {
                      const emp = employees.find((e) => e.id === l.employee_id);
                      const monthlyInstallment = l.amount / l.repayment_months;
                      const remainingAmount = l.amount - l.paid_amount;
                      return (
                        <tr key={l.id} className="hover:bg-muted/30 transition">
                          <td className="p-3.5 pr-6 font-bold text-slate-800">
                            {emp ? emp.name : "موظف محذوف"}
                          </td>
                          <td className="p-3.5 font-mono text-xs">{l.date}</td>
                          <td className="p-3.5 font-mono font-bold">
                            {formatTreasuryCurrency(l.amount, l.currency)}
                          </td>
                          <td className="p-3.5 font-mono text-xs font-bold">
                            {l.repayment_months} أشهر
                          </td>
                          <td className="p-3.5 font-mono font-bold text-slate-600">
                            {formatTreasuryCurrency(Math.round(monthlyInstallment), l.currency)} /
                            شهر
                          </td>
                          <td className="p-3.5 font-mono font-bold text-emerald-600">
                            {formatTreasuryCurrency(l.paid_amount, l.currency)}
                          </td>
                          <td className="p-3.5 font-mono font-bold text-rose-600">
                            {formatTreasuryCurrency(remainingAmount, l.currency)}
                          </td>
                          <td className="p-3.5">
                            {l.status === "paid" ? (
                              <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                مسددة بالكامل
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                جاري التحصيل
                              </Badge>
                            )}
                          </td>
                          <td className="p-3.5 text-center pl-6">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => viewLoanVoucher(l)}
                              className="h-7 text-xs rounded-lg font-bold px-3 gap-1"
                            >
                              <Printer size={12} />
                              عرض السند
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOG 1: ADD EMPLOYEE */}
      <Dialog open={isAddEmpOpen} onOpenChange={setIsAddEmpOpen}>
        <DialogContent className="max-w-md bg-card border border-border">
          <DialogHeader>
            <DialogTitle className="font-black text-right">إضافة موظف جديد</DialogTitle>
            <DialogDescription className="text-right">
              أدخل البيانات الأساسية والمالية للموظف لتسجيله في الدليل
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddEmployeeSubmit} className="space-y-4">
            <div className="space-y-1.5 text-right">
              <Label className="font-bold text-xs">الاسم بالكامل *</Label>
              <Input
                value={empForm.name}
                onChange={(e) => setEmpForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="أدخل الاسم الرباعي للموظف"
                className="rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 text-right">
              <div className="space-y-1.5">
                <Label className="font-bold text-xs">المسمى الوظيفي *</Label>
                <Input
                  value={empForm.job_title}
                  onChange={(e) => setEmpForm((prev) => ({ ...prev, job_title: e.target.value }))}
                  placeholder="مثال: شيف معجنات، كاشير"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold text-xs">القسم الإداري *</Label>
                <select
                  value={empForm.department}
                  onChange={(e) => setEmpForm((prev) => ({ ...prev, department: e.target.value }))}
                  className="w-full bg-card border border-border text-xs rounded-xl h-10 px-3 font-bold outline-none"
                >
                  <option value="المطبخ">المطبخ (Kitchen)</option>
                  <option value="الصالة والتوصيل">الصالة والتوصيل (Floor)</option>
                  <option value="الإدارة">الإدارة (Administration)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-right">
              <div className="space-y-1.5">
                <Label className="font-bold text-xs">رقم الهاتف *</Label>
                <Input
                  value={empForm.phone}
                  onChange={(e) => setEmpForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="أدخل رقم الجوال"
                  className="rounded-xl font-mono text-left"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold text-xs">تاريخ التعيين *</Label>
                <Input
                  type="date"
                  value={empForm.hire_date}
                  onChange={(e) => setEmpForm((prev) => ({ ...prev, hire_date: e.target.value }))}
                  className="rounded-xl font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-right">
              <div className="space-y-1.5">
                <Label className="font-bold text-xs">الراتب الأساسي *</Label>
                <Input
                  type="number"
                  value={empForm.salary}
                  onChange={(e) =>
                    setEmpForm((prev) => ({ ...prev, salary: Number(e.target.value) }))
                  }
                  className="rounded-xl font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold text-xs">عملة الراتب وصرف الراتب *</Label>
                <select
                  value={empForm.currency}
                  onChange={(e) => setEmpForm((prev) => ({ ...prev, currency: e.target.value }))}
                  className="w-full bg-card border border-border text-xs rounded-xl h-10 px-3 font-bold outline-none"
                >
                  <option value="EGP">EGP - جنيه مصري</option>
                  <option value="USD">USD - دولار أمريكي</option>
                  <option value="SSP">SSP - جنيه جنوب سوداني</option>
                </select>
              </div>
            </div>

            <DialogFooter className="gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddEmpOpen(false)}
                className="rounded-xl font-bold"
              >
                إلغاء
              </Button>
              <Button type="submit" className="rounded-xl font-bold">
                تسجيل وحفظ
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: EDIT EMPLOYEE */}
      <Dialog open={isEditEmpOpen} onOpenChange={setIsEditEmpOpen}>
        <DialogContent className="max-w-md bg-card border border-border">
          <DialogHeader>
            <DialogTitle className="font-black text-right">تعديل بيانات الموظف</DialogTitle>
            <DialogDescription className="text-right">
              تحديث المعلومات الأساسية والرواتب للموظف المحدد
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditEmployeeSubmit} className="space-y-4">
            <div className="space-y-1.5 text-right">
              <Label className="font-bold text-xs">الاسم بالكامل *</Label>
              <Input
                value={empForm.name}
                onChange={(e) => setEmpForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="أدخل الاسم الرباعي للموظف"
                className="rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 text-right">
              <div className="space-y-1.5">
                <Label className="font-bold text-xs">المسمى الوظيفي *</Label>
                <Input
                  value={empForm.job_title}
                  onChange={(e) => setEmpForm((prev) => ({ ...prev, job_title: e.target.value }))}
                  placeholder="مثال: شيف معجنات، كاشير"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold text-xs">القسم الإداري *</Label>
                <select
                  value={empForm.department}
                  onChange={(e) => setEmpForm((prev) => ({ ...prev, department: e.target.value }))}
                  className="w-full bg-card border border-border text-xs rounded-xl h-10 px-3 font-bold outline-none"
                >
                  <option value="المطبخ">المطبخ (Kitchen)</option>
                  <option value="الصالة والتوصيل">الصالة والتوصيل (Floor)</option>
                  <option value="الإدارة">الإدارة (Administration)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-right">
              <div className="space-y-1.5">
                <Label className="font-bold text-xs">رقم الهاتف *</Label>
                <Input
                  value={empForm.phone}
                  onChange={(e) => setEmpForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="أدخل رقم الجوال"
                  className="rounded-xl font-mono text-left"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold text-xs">حالة الموظف *</Label>
                <select
                  value={empForm.status}
                  onChange={(e) =>
                    setEmpForm((prev) => ({
                      ...prev,
                      status: e.target.value as Employee["status"],
                    }))
                  }
                  className="w-full bg-card border border-border text-xs rounded-xl h-10 px-3 font-bold outline-none"
                >
                  <option value="active">نشط (Active)</option>
                  <option value="inactive">غير نشط (Inactive)</option>
                  <option value="suspended">موقوف مؤقتاً (Suspended)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-right">
              <div className="space-y-1.5">
                <Label className="font-bold text-xs">الراتب الأساسي *</Label>
                <Input
                  type="number"
                  value={empForm.salary}
                  onChange={(e) =>
                    setEmpForm((prev) => ({ ...prev, salary: Number(e.target.value) }))
                  }
                  className="rounded-xl font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold text-xs">عملة الراتب *</Label>
                <select
                  value={empForm.currency}
                  onChange={(e) => setEmpForm((prev) => ({ ...prev, currency: e.target.value }))}
                  className="w-full bg-card border border-border text-xs rounded-xl h-10 px-3 font-bold outline-none"
                >
                  <option value="EGP">EGP - جنيه مصري</option>
                  <option value="USD">USD - دولار أمريكي</option>
                  <option value="SSP">SSP - جنيه جنوب سوداني</option>
                </select>
              </div>
            </div>

            <DialogFooter className="gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditEmpOpen(false)}
                className="rounded-xl font-bold"
              >
                إلغاء
              </Button>
              <Button type="submit" className="rounded-xl font-bold">
                حفظ التعديلات
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: REQUEST LOAN / ADVANCE */}
      <Dialog open={isAddLoanOpen} onOpenChange={setIsAddLoanOpen}>
        <DialogContent className="max-w-md bg-card border border-border">
          <DialogHeader>
            <DialogTitle className="font-black text-right">صرف سلفة لموظف</DialogTitle>
            <DialogDescription className="text-right">
              تسجيل وصرف سلفة نقدية ويتم خصم قسطها تلقائياً من رواتب الموظف المبرمة
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddLoanSubmit} className="space-y-4">
            <div className="space-y-1.5 text-right">
              <Label className="font-bold text-xs">اختر الموظف المستفيد *</Label>
              <select
                value={loanForm.employee_id}
                onChange={(e) => {
                  const empId = e.target.value;
                  const emp = employees.find((item) => item.id === empId);
                  setLoanForm((prev) => ({
                    ...prev,
                    employee_id: empId,
                    currency: emp?.currency || prev.currency || "EGP",
                  }));
                }}
                className="w-full bg-card border border-border text-xs rounded-xl h-10 px-3 font-bold outline-none"
              >
                <option value="">-- اختر موظف من القائمة --</option>
                {employees
                  .filter((e) => e.status === "active")
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.job_title} - عملة الراتب: {e.currency})
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3 text-right">
              <div className="space-y-1.5">
                <Label className="font-bold text-xs">مبلغ السلفة الجملي *</Label>
                <Input
                  type="number"
                  value={loanForm.amount}
                  onChange={(e) =>
                    setLoanForm((prev) => ({ ...prev, amount: Number(e.target.value) }))
                  }
                  className="rounded-xl font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold text-xs">عملة السلفة *</Label>
                <select
                  value={loanForm.currency}
                  onChange={(e) => setLoanForm((prev) => ({ ...prev, currency: e.target.value }))}
                  className="w-full bg-card border border-border text-xs rounded-xl h-10 px-3 font-bold outline-none font-mono"
                >
                  <option value="EGP">EGP - جنيه مصري</option>
                  <option value="USD">USD - دولار أمريكي</option>
                  <option value="SSP">SSP - جنيه جنوب سوداني</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5 text-right">
              <Label className="font-bold text-xs">مدة السداد (بالأشهر) *</Label>
              <select
                value={loanForm.repayment_months}
                onChange={(e) =>
                  setLoanForm((prev) => ({ ...prev, repayment_months: Number(e.target.value) }))
                }
                className="w-full bg-card border border-border text-xs rounded-xl h-10 px-3 font-bold outline-none"
              >
                <option value={1}>شهر واحد</option>
                <option value={2}>شهرين</option>
                <option value={3}>3 أشهر</option>
                <option value={4}>4 أشهر</option>
                <option value={6}>6 أشهر</option>
                <option value={12}>12 شهر</option>
              </select>
            </div>

            <div className="space-y-1.5 text-right">
              <Label className="font-bold text-xs">خزينة / بنك صرف السلفة *</Label>
              <select
                value={loanForm.treasury_id}
                onChange={(e) => setLoanForm((prev) => ({ ...prev, treasury_id: e.target.value }))}
                className="w-full bg-card border border-border text-xs rounded-xl h-10 px-3 font-bold outline-none"
              >
                <option value="">-- اختر الخزينة أو البنك لصرف السلفة --</option>
                {(erpState.treasuries || [])
                  .filter((t) => !t.deleted)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name_ar} (الرصيد: {formatTreasuryCurrency(t.balance, t.currency)} - العملة:{" "}
                      {t.currency})
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1.5 text-right">
              <Label className="font-bold text-xs">ملاحظات إضافية</Label>
              <Input
                value={loanForm.notes}
                onChange={(e) => setLoanForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="أدخل مبررات السلفة أو تفاصيل الضامن"
                className="rounded-xl"
              />
            </div>

            <DialogFooter className="gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddLoanOpen(false)}
                className="rounded-xl font-bold"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={!loanForm.treasury_id}
                className="rounded-xl font-bold"
              >
                اعتماد وصرف السلفة
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 4: PAY SALARY */}
      <Dialog open={isPaySalaryOpen} onOpenChange={setIsPaySalaryOpen}>
        <DialogContent className="max-w-md bg-card border border-border">
          <DialogHeader>
            <DialogTitle className="font-black text-right">صرف رواتب ومستحقات الموظف</DialogTitle>
            <DialogDescription className="text-right">
              حدد الخزينة النقدية لإتمام صرف الراتب وصرف السند المالي المبرم
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePaySalarySubmit} className="space-y-4">
            {selectedPayroll && (
              <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl text-right space-y-2">
                <div className="text-xs text-muted-foreground font-bold">الموظف المستحق:</div>
                <div className="text-base font-black text-slate-800 dark:text-slate-200">
                  {employees.find((e) => e.id === selectedPayroll.employee_id)?.name}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border/40">
                  <div>
                    <span className="text-muted-foreground block">راتب الشهر:</span>
                    <span className="font-bold font-mono">{selectedPayroll.month}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-emerald-600">
                      صافي المستحق:
                    </span>
                    <span className="font-black font-mono text-emerald-600">
                      {formatTreasuryCurrency(selectedPayroll.net_salary, selectedPayroll.currency)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5 text-right">
              <Label className="font-bold text-xs">اختر خزينة الصرف *</Label>
              <select
                value={paySalaryTreasuryId}
                onChange={(e) => setPaySalaryTreasuryId(e.target.value)}
                className="w-full bg-card border border-border text-xs rounded-xl h-10 px-3 font-bold outline-none"
              >
                <option value="">-- اختر خزينة الصرف --</option>
                {(erpState.treasuries || [])
                  .filter(
                    (t) =>
                      !t.deleted &&
                      (t.currency === "MULTI" ||
                        (selectedPayroll && t.currency === selectedPayroll.currency)),
                  )
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.account_code ? `[رقم الحساب: ${t.account_code}] ` : ""}
                      {t.name_ar} (العملة: {t.currency} - المتاح:{" "}
                      {formatTreasuryCurrency(
                        t.balance,
                        t.currency === "MULTI" ? selectedPayroll?.currency : t.currency,
                      )}
                      )
                    </option>
                  ))}
              </select>
            </div>

            <DialogFooter className="gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPaySalaryOpen(false)}
                className="rounded-xl font-bold"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={!paySalaryTreasuryId}
                className="rounded-xl font-bold"
              >
                إتمام الصرف وتسجيل السند
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 5: CONFIRM DELETE EMPLOYEE */}
      <Dialog open={isDeleteEmpOpen} onOpenChange={setIsDeleteEmpOpen}>
        <DialogContent className="max-w-md bg-card border border-border text-right">
          <DialogHeader>
            <DialogTitle className="font-black text-rose-600 flex items-center gap-2">
              <AlertCircle size={20} />
              تأكيد حذف الموظف
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs pt-2">
              هل أنت متأكد من حذف الموظف{" "}
              <strong className="text-slate-900 dark:text-slate-100">{empToDelete?.name}</strong>؟
              لا يمكن التراجع عن هذه العملية بعد التأكيد.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsDeleteEmpOpen(false)}
              className="rounded-xl font-bold"
            >
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeleteEmployee}
              className="rounded-xl font-bold bg-rose-600 hover:bg-rose-700"
            >
              تأكيد الحذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 6: VOUCHER & DOCUMENT PREVIEW / PRINT */}
      <Dialog open={isVoucherOpen} onOpenChange={setIsVoucherOpen}>
        <DialogContent className="max-w-2xl bg-card border border-border text-right max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b border-border/60 pb-3">
            <div className="flex items-center justify-between">
              <Badge className="bg-primary/10 text-primary border border-primary/20 text-xs font-bold px-3 py-1">
                Restocash ERP Document
              </Badge>
              <DialogTitle className="font-black text-lg text-slate-900 dark:text-slate-100">
                {voucherData?.title || "سند ومستند مالي إلكتروني"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              معاينة السند المحاسبي الرسمي الصادر وإمكانية طباعته أو حفظه برقم قيد مالي موحد
            </DialogDescription>
          </DialogHeader>

          {voucherData && (
            <div className="space-y-4 py-2">
              {/* Top Banner */}
              <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-border/60 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">
                    رقم المستند / القيد:
                  </span>
                  <span className="font-mono font-black text-primary text-sm">
                    {voucherData.documentNo}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">تاريخ المستند:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {voucherData.date}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">حالة التوثيق:</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1 mt-0.5">
                    <CheckCircle2 size={13} /> معتمد ومسجل
                  </span>
                </div>
              </div>

              {/* Employee & Header info if applicable */}
              {voucherData.employeeName && (
                <div className="bg-muted/30 p-3.5 rounded-xl border border-border/50 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block">اسم الموظف:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {voucherData.employeeName}
                    </span>
                  </div>
                  {voucherData.month && (
                    <div>
                      <span className="text-muted-foreground block">عن شهر:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {voucherData.month}
                      </span>
                    </div>
                  )}
                  {voucherData.treasuryName && (
                    <div>
                      <span className="text-muted-foreground block">خزينة / بنك الصرف:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {voucherData.treasuryName}
                      </span>
                    </div>
                  )}
                  {voucherData.repaymentMonths && (
                    <div>
                      <span className="text-muted-foreground block">مدة السداد:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {voucherData.repaymentMonths} أشهر
                      </span>
                    </div>
                  )}
                  {voucherData.notes && (
                    <div className="col-span-2 border-t border-border/40 pt-2 mt-1">
                      <span className="text-muted-foreground block">ملاحظات ومبررات:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {voucherData.notes}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Breakdown Table if available */}
              {voucherData.breakdown && (
                <div className="space-y-2">
                  <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300">
                    تفاصيل ومكونات الاستحقاق والخصم:
                  </h4>
                  <div className="border border-border rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-right">
                      <thead className="bg-muted text-muted-foreground font-bold">
                        <tr>
                          <th className="p-2.5 pr-4">بيان العنصر</th>
                          <th className="p-2.5 text-left pl-4">المبلغ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        <tr>
                          <td className="p-2.5 pr-4">الراتب الأساسي المستحق</td>
                          <td className="p-2.5 text-left pl-4 font-mono font-bold">
                            {voucherData.breakdown.basic.toLocaleString()} {voucherData.currency}
                          </td>
                        </tr>
                        {!!voucherData.breakdown.bonuses && (
                          <tr>
                            <td className="p-2.5 pr-4">المكافآت والبدلات</td>
                            <td className="p-2.5 text-left pl-4 font-mono font-bold text-emerald-600">
                              +{voucherData.breakdown.bonuses.toLocaleString()}{" "}
                              {voucherData.currency}
                            </td>
                          </tr>
                        )}
                        {!!voucherData.breakdown.deductions && (
                          <tr>
                            <td className="p-2.5 pr-4">خصومات الحضور والغياب</td>
                            <td className="p-2.5 text-left pl-4 font-mono font-bold text-rose-600">
                              -{voucherData.breakdown.deductions.toLocaleString()}{" "}
                              {voucherData.currency}
                            </td>
                          </tr>
                        )}
                        {!!voucherData.breakdown.loans && (
                          <tr>
                            <td className="p-2.5 pr-4">استقطاع أقساط السلف وقروض الموظفين</td>
                            <td className="p-2.5 text-left pl-4 font-mono font-bold text-rose-600">
                              -{voucherData.breakdown.loans.toLocaleString()} {voucherData.currency}
                            </td>
                          </tr>
                        )}
                        <tr className="bg-emerald-500/10 font-black text-emerald-700 dark:text-emerald-400">
                          <td className="p-2.5 pr-4">صافي المستحق للصرف النقدي</td>
                          <td className="p-2.5 text-left pl-4 font-mono text-sm">
                            {voucherData.breakdown.net.toLocaleString()} {voucherData.currency}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Simple Amount Box if no breakdown */}
              {voucherData.amount && !voucherData.breakdown && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex items-center justify-between">
                  <span className="font-bold text-xs text-emerald-700 dark:text-emerald-400">
                    إجمالي قيمة السند / المبلغ المصروف:
                  </span>
                  <span className="font-mono font-black text-lg text-emerald-700 dark:text-emerald-400">
                    {voucherData.amount.toLocaleString()} {voucherData.currency}
                  </span>
                </div>
              )}

              {/* Journal Entries Table */}
              {voucherData.journalEntries && voucherData.journalEntries.length > 0 && (
                <div className="space-y-2 pt-1">
                  <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Briefcase size={14} className="text-primary" />
                    القيد المحاسبي التلقائي المترتب على الحركة (GL Journal):
                  </h4>
                  <div className="border border-border rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-right">
                      <thead className="bg-muted text-muted-foreground font-bold">
                        <tr>
                          <th className="p-2 pr-3">الكود</th>
                          <th className="p-2">اسم الحساب</th>
                          <th className="p-2 text-left">مدين (+)</th>
                          <th className="p-2 text-left">دائن (-)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 font-mono">
                        {voucherData.journalEntries
                          .flatMap((je: any) => je.lines || [])
                          .map((line: any, idx: number) => (
                            <tr key={idx} className="hover:bg-muted/20">
                              <td className="p-2 pr-3 font-bold text-slate-500">
                                {line.account_code}
                              </td>
                              <td className="p-2 font-sans font-bold text-slate-800 dark:text-slate-200">
                                {line.account_name || "حساب محاسبي"}
                              </td>
                              <td className="p-2 text-left font-bold text-emerald-600">
                                {line.debit > 0
                                  ? `${line.debit.toLocaleString()} ${line.currency || voucherData.currency}`
                                  : "-"}
                              </td>
                              <td className="p-2 text-left font-bold text-rose-600">
                                {line.credit > 0
                                  ? `${line.credit.toLocaleString()} ${line.currency || voucherData.currency}`
                                  : "-"}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 pt-4 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsVoucherOpen(false)}
              className="rounded-xl font-bold text-xs"
            >
              إلغاء وإغلاق
            </Button>
            <Button
              type="button"
              onClick={() => handlePrintVoucher(voucherData)}
              className="rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-2 py-5"
            >
              <Printer size={16} />
              طباعة وتصدير المستند الرسمي (Print Document)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
