// @ts-nocheck
import { createFileRoute, useLocation, Link } from "@tanstack/react-router";
import {
  extractTabParam,
  useSyncedSubTab,
} from "@/components/navigation/navigationRegistry";
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
import {
  getActiveUserPermissionsSync,
  hasAnyRequestedPermission,
  PERMISSIONS_UPDATED_EVENT,
} from "@/shared/services/userAuthorization";
import { printRawHtml } from "@/shared/utils/printAccountingDocument";
import { UsersPage } from "@/components/admin/UsersPageView";
import { sendPrivateSalarySlipMessages } from "@/components/Chatbot";
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
  ArrowRight,
  Scissors,
  Send,
  Lock,
  Eye,
  ShieldCheck,
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
  const {
    currency,
    exchangeRates,
    formatPrice,
    convertPrice,
    formatConvertedPrice,
    formatTreasuryCurrency,
  } = useSettings();

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

  const [activePerms, setActivePerms] = useState<Record<string, boolean>>(() =>
    getActiveUserPermissionsSync(),
  );

  useEffect(() => {
    const refresh = () => setActivePerms(getActiveUserPermissionsSync());
    window.addEventListener(PERMISSIONS_UPDATED_EVENT, refresh);
    const unsub = erpStore.subscribe(refresh);
    return () => {
      window.removeEventListener(PERMISSIONS_UPDATED_EVENT, refresh);
      unsub();
    };
  }, []);

  const canViewEmployees = hasAnyRequestedPermission(activePerms, ["page_hr_employees", "hr"]);
  const canViewAttendance = hasAnyRequestedPermission(activePerms, ["page_hr_attendance", "hr_view_attendance"]);
  const canViewPayroll = hasAnyRequestedPermission(activePerms, ["page_hr_payroll", "hr_manage_payroll_loans"]);
  const canViewLoans = hasAnyRequestedPermission(activePerms, ["page_hr_loans", "hr_manage_payroll_loans"]);
  const canViewUsers = hasAnyRequestedPermission(activePerms, ["page_hr_users", "users_roles", "system_manage_users"]);

  // Active Tab state
  const location = useLocation();
  const tabParam = extractTabParam(location.search, (location as any).searchStr);
  const [activeTab, setActiveTab] = useState(tabParam || "grid");

  useEffect(() => {
    if (tabParam) {
      if (tabParam === "employees" && !canViewEmployees) setActiveTab("grid");
      else if (tabParam === "attendance" && !canViewAttendance) setActiveTab("grid");
      else if (tabParam === "payroll" && !canViewPayroll) setActiveTab("grid");
      else if (tabParam === "loans" && !canViewLoans) setActiveTab("grid");
      else if (tabParam === "users" && !canViewUsers) setActiveTab("grid");
      else setActiveTab(tabParam);
    } else {
      setActiveTab("grid");
    }
  }, [tabParam, canViewEmployees, canViewAttendance, canViewPayroll, canViewLoans, canViewUsers]);

  useSyncedSubTab("/admin/hr", activeTab, setActiveTab, "grid");

  // Search & Filter States
  const [empSearch, setEmpSearch] = useState("");
  const [empDeptFilter, setEmpDeptFilter] = useState("all");

  // Attendance Date
  const [attendanceDate, setAttendanceDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );

  // Payroll Month
  const [payrollMonth, setPayrollMonth] = useState<string>("2026-07");

  // Automatic Payroll Disbursement Preview & GM Approval States
  const [isDisbursementPreviewOpen, setIsDisbursementPreviewOpen] = useState(false);
  const [disbursementTreasuryId, setDisbursementTreasuryId] = useState<string>("");
  const [disbursementViewMode, setDisbursementViewMode] = useState<"journal" | "sheet">("journal");

  // Cuttable Rectangular Salary Receipts Modal State
  const [isCuttableSlipsOpen, setIsCuttableSlipsOpen] = useState(false);

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
    <h1>Restocash ERP</h1>
    <p>إدارة الموارد البشرية وشؤون الموظفين</p>
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
      employeeCode: emp?.employee_code ? `#${emp.employee_code}` : emp?.id,
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
      employeeCode: emp?.employee_code ? `#${emp.employee_code}` : emp?.id,
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
    employee_code: erpStore.getNextEmployeeCode(),
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
      employee_code: erpStore.getNextEmployeeCode(),
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

  const openAddEmployeeDialog = () => {
    resetEmpForm();
    setIsAddEmpOpen(true);
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

  // HR Executive Stats (Valued in active page currency & exchange rate)
  const activeEmployeesCount = employees.filter((e) => e.status === "active").length;
  const totalPayrollCost = useMemo(() => {
    return employees
      .filter((e) => e.status === "active")
      .reduce((sum, emp) => sum + convertPrice(Number(emp.salary) || 0, emp.currency || "EGP"), 0);
  }, [employees, convertPrice]);

  const activeLoansCount = loans.filter((l) => l.status === "active").length;
  const activeLoansAmount = useMemo(() => {
    return loans
      .filter((l) => l.status === "active")
      .reduce(
        (sum, l) =>
          sum + convertPrice(Math.max(0, Number(l.amount || 0) - Number(l.paid_amount || 0)), l.currency || "EGP"),
        0,
      );
  }, [loans, convertPrice]);

  // Filter Employees
  const filteredEmployees = useMemo(() => {
    const q = empSearch.trim().toLowerCase();
    return employees.filter((emp) => {
      const matchSearch =
        !q ||
        (emp.name || "").toLowerCase().includes(q) ||
        (emp.job_title || "").toLowerCase().includes(q) ||
        (emp.phone || "").includes(q) ||
        String(emp.employee_code || "").toLowerCase().includes(q);
      const matchDept = empDeptFilter === "all" || emp.department === empDeptFilter;
      return matchSearch && matchDept;
    });
  }, [employees, empSearch, empDeptFilter]);

  const filteredValuedSalariesTotal = useMemo(() => {
    return filteredEmployees.reduce(
      (sum, emp) => sum + convertPrice(Number(emp.salary) || 0, emp.currency || "EGP"),
      0,
    );
  }, [filteredEmployees, convertPrice]);

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
      employee_code: emp.employee_code || erpStore.getNextEmployeeCode(),
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

  // ============================================================================
  // 1. AUTOMATIC PAYROLL DISBURSEMENT PREVIEW, APPROVAL & GM PRINTOUT
  // ============================================================================
  const openDisbursementPreviewModal = () => {
    const monthRecords = (erpStore.getState().payrolls || []).filter(
      (p) => p.month === payrollMonth,
    );
    if (monthRecords.length === 0) {
      erpStore.generatePayroll(payrollMonth);
    }
    const activeTreasuries = (erpStore.getState().treasuries || []).filter((t) => !t.deleted);
    if (!disbursementTreasuryId && activeTreasuries.length > 0) {
      setDisbursementTreasuryId(activeTreasuries[0].id);
    }
    setIsDisbursementPreviewOpen(true);
  };

  const disbursementPreviewData = useMemo(() => {
    if (!isDisbursementPreviewOpen) return null;
    try {
      return erpStore.buildPayrollDisbursementPreview(payrollMonth, disbursementTreasuryId);
    } catch {
      return null;
    }
  }, [isDisbursementPreviewOpen, payrollMonth, disbursementTreasuryId, erpState]);

  const handleApproveAndPostDisbursement = () => {
    if (!disbursementTreasuryId) {
      toast({
        title: "اختر خزينة الصرف",
        description: "يرجى تحديد الخزينة أو البنك المراد صرف المرتبات منه أولاً.",
        variant: "destructive",
      });
      return;
    }
    try {
      const result = erpStore.approvePayrollDisbursementJournal(
        payrollMonth,
        disbursementTreasuryId,
      );
      toast({
        title: "تم اعتماد وترحيل قيود صرف المرتبات بنجاح ✅",
        description: `تم توليد واعتماد قيود الصرف لشهر ${payrollMonth} (${result.totalEmployees} موظف) من ${result.treasuryName}.`,
      });
      setErpState(erpStore.getState());
    } catch (err: any) {
      toast({
        title: "خطأ في الاعتماد",
        description: err?.message || "تعذر اعتماد قيود صرف المرتبات.",
        variant: "destructive",
      });
    }
  };

  const handlePrintGeneralManagerApproval = (formatMode: "sheet" | "journal") => {
    const preview = erpStore.buildPayrollDisbursementPreview(
      payrollMonth,
      disbursementTreasuryId,
    );
    const todayStr = new Date().toISOString().split("T")[0];
    const groups = Object.values(preview.groupsByCurrency || {});

    const sheetSectionsHtml = groups
      .map((group) => {
        const rowsHtml = group.records
          .map(
            ({ payroll, employee }, idx) => `
          <tr>
            <td style="text-align:center;">${idx + 1}</td>
            <td style="font-family:monospace;font-weight:900;text-align:center;color:#0284c7;">#${employee?.employee_code || "-"}</td>
            <td style="font-weight:bold;">${employee?.name || "موظف"}</td>
            <td>${employee?.job_title || "-"}</td>
            <td>${employee?.department || "-"}</td>
            <td style="font-family:monospace;font-weight:bold;">${Number(payroll.basic_salary || 0).toLocaleString()} ${group.currency}</td>
            <td style="font-family:monospace;color:#059669;">+${Number(payroll.bonuses || 0).toLocaleString()} ${group.currency}</td>
            <td style="font-family:monospace;color:#e11d48;">-${Number(payroll.deductions || 0).toLocaleString()} ${group.currency}</td>
            <td style="font-family:monospace;color:#d97706;">-${Number(payroll.loan_deduction || 0).toLocaleString()} ${group.currency}</td>
            <td style="font-family:monospace;font-weight:900;color:#0f172a;background:#f0fdf4;">${Number(payroll.net_salary || 0).toLocaleString()} ${group.currency}</td>
            <td style="text-align:center;">${payroll.status === "paid" ? "تم الصرف" : "بانتظار الاعتماد"}</td>
          </tr>`,
          )
          .join("");

        return `
        <div style="margin-bottom:24px;">
          <div style="font-weight:900;font-size:14px;margin-bottom:8px;color:#0f172a;background:#f1f5f9;padding:8px 12px;border-right:4px solid #0284c7;border-radius:6px;">
            كشف مرتبات الموظفين بعملة (${group.currency}) — خزينة الصرف: ${preview.treasuryAccName}
          </div>
          <table>
            <thead>
              <tr>
                <th style="width:36px;text-align:center;">م</th>
                <th style="width:85px;text-align:center;">الرقم الوظيفي</th>
                <th>اسم الموظف</th>
                <th>المسمى الوظيفي</th>
                <th>القسم</th>
                <th>الراتب الأساسي</th>
                <th>المكافآت</th>
                <th>خصم الغياب</th>
                <th>قسط السلفة</th>
                <th>صافي المستحق للصرف</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <tr style="background:#e0f2fe;font-weight:900;">
                <td colspan="5">الإجمالي الكلي (${group.records.length} موظف)</td>
                <td style="font-family:monospace;">${group.totalBasic.toLocaleString()} ${group.currency}</td>
                <td style="font-family:monospace;">+${group.totalBonuses.toLocaleString()} ${group.currency}</td>
                <td style="font-family:monospace;">-${group.totalDeductions.toLocaleString()} ${group.currency}</td>
                <td style="font-family:monospace;">-${group.totalLoans.toLocaleString()} ${group.currency}</td>
                <td style="font-family:monospace;font-size:14px;color:#047857;">${group.totalNet.toLocaleString()} ${group.currency}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>`;
      })
      .join("");

    const journalSectionsHtml = groups
      .map((group) => {
        const totalDebit = group.journalLines.reduce((s, l) => s + Number(l.debit || 0), 0);
        const totalCredit = group.journalLines.reduce((s, l) => s + Number(l.credit || 0), 0);

        const linesHtml = group.journalLines
          .map(
            (line, idx) => `
          <tr>
            <td style="text-align:center;">${idx + 1}</td>
            <td style="font-family:monospace;font-weight:bold;">${line.account_code}</td>
            <td style="font-weight:bold;">${line.account_name}</td>
            <td>${line.description}</td>
            <td style="font-family:monospace;font-weight:bold;color:#059669;text-align:left;">
              ${line.debit > 0 ? `${line.debit.toLocaleString()} ${line.currency}` : "-"}
            </td>
            <td style="font-family:monospace;font-weight:bold;color:#e11d48;text-align:left;">
              ${line.credit > 0 ? `${line.credit.toLocaleString()} ${line.currency}` : "-"}
            </td>
          </tr>`,
          )
          .join("");

        return `
        <div style="margin-bottom:24px;">
          <div style="font-weight:900;font-size:14px;margin-bottom:8px;color:#0f172a;background:#f1f5f9;padding:8px 12px;border-right:4px solid #7c3aed;border-radius:6px;">
            قيد صرف المرتبات والأجور التلقائي (${group.currency}) — حساب الخزينة/البنك: [${preview.treasuryAccCode}] ${preview.treasuryAccName}
          </div>
          <table>
            <thead>
              <tr>
                <th style="width:36px;text-align:center;">م</th>
                <th style="width:110px;">كود الحساب</th>
                <th>اسم الحساب المحاسبي</th>
                <th>البيان والتفاصيل</th>
                <th style="width:130px;text-align:left;">مدين (Debit)</th>
                <th style="width:130px;text-align:left;">دائن (Credit)</th>
              </tr>
            </thead>
            <tbody>
              ${linesHtml}
              <tr style="background:#f3e8ff;font-weight:900;">
                <td colspan="4">إجمالي القيد المحاسبي المزدوج (${group.currency}) — القيد متزن</td>
                <td style="font-family:monospace;text-align:left;color:#047857;">${totalDebit.toLocaleString()} ${group.currency}</td>
                <td style="font-family:monospace;text-align:left;color:#be123c;">${totalCredit.toLocaleString()} ${group.currency}</td>
              </tr>
            </tbody>
          </table>
        </div>`;
      })
      .join("");

    const docTitle =
      formatMode === "sheet"
        ? `كشف مسير رواتب ومستحقات الموظفين لشهر (${payrollMonth}) - للاعتماد من المدير العام`
        : `مذكرة قيود صرف المرتبات والأجور لشهر (${payrollMonth}) - للاعتماد من المدير العام`;

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${docTitle}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; color: #0f172a; background: #fff; margin: 0; padding: 12px; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px double #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
    .header-title h1 { margin: 0; font-size: 20px; font-weight: 900; color: #0f172a; }
    .header-title p { margin: 4px 0 0; font-size: 13px; color: #475569; font-weight: bold; }
    .gm-box { background: #fffbeb; border: 1.5px solid #f59e0b; border-radius: 8px; padding: 10px 16px; margin-bottom: 16px; font-size: 13px; font-weight: bold; color: #92400e; display: flex; justify-content: space-between; align-items: center; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 7px 9px; text-align: right; }
    th { background: #1e293b; color: #fff; font-weight: bold; }
    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 32px; page-break-inside: avoid; }
    .sig-card { border: 1px dashed #64748b; border-radius: 8px; padding: 14px; text-align: center; background: #f8fafc; }
    .sig-card h4 { margin: 0 0 36px; font-size: 13px; color: #0f172a; }
    .sig-card p { margin: 0; font-size: 11px; color: #64748b; border-top: 1px solid #cbd5e1; padding-top: 6px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-title">
      <h1>${docTitle}</h1>
      <p>إدارة الموارد البشرية والشؤون المالية — شهر المسير: ${payrollMonth}</p>
    </div>
    <div style="text-align:left;font-size:12px;font-weight:bold;">
      <div>تاريخ الإصدار: ${todayStr}</div>
      <div>عدد الموظفين: ${preview.totalEmployees} موظف</div>
      <div>خزينة الصرف: ${preview.treasuryAccName}</div>
    </div>
  </div>

  <div class="gm-box">
    <span>السيد / المدير العام المحترم ،، يرجى التكرم بالاطلاع واعتماد ${
      formatMode === "sheet" ? "كشف صرف المرتبات التفصيلي" : "قيود صرف المرتبات المحاسبية"
    } لشهر (${payrollMonth}).</span>
    <span>حالة المراجعة: جاهز للاعتماد النهائي</span>
  </div>

  ${formatMode === "sheet" ? sheetSectionsHtml : journalSectionsHtml}

  <div class="signatures">
    <div class="sig-card">
      <h4>إعداد / مسؤول الموارد البشرية</h4>
      <p>الاسم والتوقيع والتاريخ</p>
    </div>
    <div class="sig-card">
      <h4>مراجعة / المدير المالي والحسابات</h4>
      <p>الاسم والتوقيع والمطابقة المالية</p>
    </div>
    <div class="sig-card" style="border: 2px solid #0f172a; background: #f0fdf4;">
      <h4>اعتماد السيد / المدير العام (General Manager)</h4>
      <p>التوقيع والختم الرسمي بالاعتماد والصرف</p>
    </div>
  </div>
</body>
</html>`;

    printRawHtml(html, docTitle);
  };

  // ============================================================================
  // 2. CUTTABLE RECTANGULAR SALARY RECEIPTS FOR ALL EMPLOYEES (إيصالات مستطيلة للتقطيع)
  // ============================================================================
  const cuttableSalarySlipsList = useMemo(() => {
    const monthPayrolls = payrolls.filter((p) => p.month === payrollMonth);
    const activeEmployees = employees.filter((e) => e.status === "active");

    return activeEmployees.map((emp, index) => {
      const p = monthPayrolls.find((rec) => rec.employee_id === emp.id);
      const basic = p ? Number(p.basic_salary || 0) : Number(emp.salary || 0);
      const bonuses = p ? Number(p.bonuses || 0) : 0;
      const deductions = p ? Number(p.deductions || 0) : 0;
      const loanDed = p ? Number(p.loan_deduction || 0) : 0;
      const net = p ? Number(p.net_salary || 0) : Math.max(0, basic + bonuses - deductions - loanDed);
      const curr = p?.currency || emp.currency || "EGP";

      return {
        seq: index + 1,
        empId: emp.id,
        employeeCode: emp.employee_code || String(1001 + index),
        name: emp.name,
        jobTitle: emp.job_title,
        department: emp.department,
        month: payrollMonth,
        basic,
        bonuses,
        deductions,
        loanDed,
        net,
        currency: curr,
      };
    });
  }, [employees, payrolls, payrollMonth]);

  const handlePrintCuttableSalaryReceipts = () => {
    if (cuttableSalarySlipsList.length === 0) {
      toast({
        title: "لا يوجد موظفون نشطون",
        description: "يرجى التأكد من وجود موظفين نشطين لطباعة إيصالات تسليم الرواتب.",
        variant: "destructive",
      });
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    // Chunk into pages of 10 slips per A4 page (2 columns x 5 rows = 10 uniform rectangles per page)
    const slipsPerPage = 10;
    const pages: Array<typeof cuttableSalarySlipsList> = [];
    for (let i = 0; i < cuttableSalarySlipsList.length; i += slipsPerPage) {
      pages.push(cuttableSalarySlipsList.slice(i, i + slipsPerPage));
    }

    const pagesHtml = pages
      .map((pageSlips, pageIndex) => {
        const cardsHtml = pageSlips
          .map(
            (slip) => `
          <div class="slip-card">
            <div class="cut-badge">✂ إيصال استلام راتب #${slip.seq} • الرقم الوظيفي: #${slip.employeeCode}</div>
            <div class="slip-header">
              <span class="slip-month">مسير شهر: ${slip.month}</span>
              <span class="slip-date">${todayStr}</span>
            </div>

            <div class="slip-row name-row">
              <span class="lbl">العامل (#${slip.employeeCode}):</span>
              <span class="val-name">${slip.name} <small>(${slip.jobTitle})</small></span>
            </div>

            <div class="slip-row amount-row">
              <div>
                <span class="lbl">صافي المبلغ المستلم:</span>
                <div class="sub-breakdown">
                  أساسي: ${slip.basic.toLocaleString()} | خصم: ${slip.deductions.toLocaleString()} | سلفة: ${slip.loanDed.toLocaleString()}
                </div>
              </div>
              <span class="val-amount">${slip.net.toLocaleString()} ${slip.currency}</span>
            </div>

            <div class="slip-footer">
              <div class="ack-text">أقر أنا الموقع أدناه باستلام راتبي الصافي كاملاً نقداً:</div>
              <div class="sig-box">
                <span>توقيع المستلم: ........................................</span>
              </div>
            </div>
          </div>`,
          )
          .join("");

        return `
        <div class="a4-page ${pageIndex < pages.length - 1 ? "page-break" : ""}">
          <div class="page-top-note">
            <span>كشف إيصالات تسليم المرتبات القابلة للتقطيع — شهر (${payrollMonth})</span>
            <span>صفحة ${pageIndex + 1} من ${pages.length} (إجمالي ${cuttableSalarySlipsList.length} إيصال موحد المقاس)</span>
          </div>
          <div class="slips-grid">
            ${cardsHtml}
          </div>
        </div>`;
      })
      .join("");

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>إيصالات تسليم المرتبات المستطيلة للتقطيع - ${payrollMonth}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      direction: rtl;
      margin: 0;
      padding: 0;
      color: #0f172a;
      background: #fff;
    }
    .a4-page {
      width: 100%;
      padding: 2mm;
    }
    .page-break {
      page-break-after: always;
    }
    .page-top-note {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      font-weight: bold;
      color: #475569;
      margin-bottom: 3mm;
      padding-bottom: 1.5mm;
      border-bottom: 1px solid #cbd5e1;
    }
    .slips-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 4mm;
    }
    .slip-card {
      position: relative;
      height: 50mm;
      border: 1.8px dashed #334155;
      border-radius: 6px;
      padding: 3.5mm 4mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: #ffffff;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .cut-badge {
      position: absolute;
      top: -8px;
      right: 10px;
      background: #fff;
      padding: 0 6px;
      font-size: 9px;
      font-weight: 900;
      color: #475569;
    }
    .slip-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      font-weight: bold;
      color: #475569;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 1.5mm;
    }
    .slip-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .name-row {
      padding: 1.5mm 0;
    }
    .lbl {
      font-size: 11px;
      font-weight: bold;
      color: #334155;
    }
    .val-name {
      font-size: 13px;
      font-weight: 900;
      color: #0f172a;
    }
    .val-name small {
      font-size: 10px;
      font-weight: bold;
      color: #0284c7;
    }
    .amount-row {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      padding: 2mm 3mm;
    }
    .sub-breakdown {
      font-size: 9px;
      color: #64748b;
      font-family: monospace;
      margin-top: 1px;
    }
    .val-amount {
      font-size: 15px;
      font-weight: 900;
      font-family: monospace;
      color: #047857;
    }
    .slip-footer {
      padding-top: 1mm;
    }
    .ack-text {
      font-size: 9px;
      color: #475569;
      margin-bottom: 1.5mm;
    }
    .sig-box {
      font-size: 11px;
      font-weight: 900;
      color: #0f172a;
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>`;

    printRawHtml(html, `إيصالات تسليم الرواتب - ${payrollMonth}`);
  };

  // ============================================================================
  // 3. SEND CONFIDENTIAL SALARY DETAILS TO EACH EMPLOYEE PRIVATELY VIA MESSENGER
  // ============================================================================
  const handleSendSingleEmployeeSalarySlip = async (payrollRec: PayrollRecord) => {
    const emp = employees.find((e) => e.id === payrollRec.employee_id);
    if (!emp) {
      toast({
        title: "الموظف غير موجود",
        description: "تعذر العثور على بيانات الموظف لإرسال رسالة الراتب.",
        variant: "destructive",
      });
      return;
    }

    const sentCount = await sendPrivateSalarySlipMessages([
      { employee: emp, payroll: payrollRec },
    ]);

    if (sentCount > 0) {
      toast({
        title: `تم إرسال تفاصيل الراتب بسرية إلى ${emp.name} 🔒`,
        description: `وصلت تفاصيل راتب شهر ${payrollRec.month} في المحادثة الخاصة للموظف (${emp.name}) فقط ولا يمكن لأي موظف آخر الاطلاع عليها.`,
      });
    }
  };

  const handleSendAllEmployeesSalarySlipsPrivately = async () => {
    let monthRecords = payrolls.filter((p) => p.month === payrollMonth);
    if (monthRecords.length === 0) {
      erpStore.generatePayroll(payrollMonth);
      monthRecords = (erpStore.getState().payrolls || []).filter(
        (p) => p.month === payrollMonth,
      );
    }

    const pairs = monthRecords
      .map((p) => {
        const emp = employees.find((e) => e.id === p.employee_id);
        return emp ? { employee: emp, payroll: p } : null;
      })
      .filter(Boolean) as Array<{ employee: Employee; payroll: PayrollRecord }>;

    if (pairs.length === 0) {
      toast({
        title: "لا توجد مسيرات رواتب",
        description: "يرجى احتساب مسير الرواتب أولاً.",
        variant: "destructive",
      });
      return;
    }

    const sentCount = await sendPrivateSalarySlipMessages(pairs);
    toast({
      title: `تم إرسال بيانات الرواتب السرية لـ (${sentCount}) موظف بنجاح 🔒`,
      description:
        "تم إرسال تفاصيل الراتب لكل موظف على حدة في محادثته الخاصة فقط، مع منع اطلاع أي موظف على راتب زميله.",
    });
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
      {/* Top Bar - Frozen Sticky Header with Clear Department Name */}
      {activeTab === "grid" ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground">
              الموارد البشرية وشؤون الموظفين
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              إدارة الكادر الوظيفي، حسابات المستخدمين، الحضور والانصراف، والرواتب والسلف
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={openAddEmployeeDialog}
              className="gap-1.5 rounded-xl font-bold text-xs h-9 px-4"
            >
              <UserPlus size={16} />
              إضافة موظف جديد
            </Button>
            <Button
              variant="outline"
              onClick={openLoanDialog}
              className="gap-1.5 rounded-xl font-bold text-xs h-9 px-3.5"
            >
              <Coins size={16} />
              صرف سلفة
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 pb-2 border-b border-border/60">
          <Button
            variant="outline"
            onClick={() => setActiveTab("grid")}
            className="gap-2 font-black rounded-xl text-xs py-2 px-4 border-primary/30 text-primary hover:bg-primary/10 w-fit cursor-pointer"
          >
            <ArrowRight size={16} />
            العودة إلى أقسام الموارد البشرية
          </Button>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {canViewEmployees && (
              <Button
                size="sm"
                variant={activeTab === "employees" ? "default" : "outline"}
                onClick={() => setActiveTab("employees")}
                className="rounded-xl font-bold text-xs h-8"
              >
                الكادر ({employees.length})
              </Button>
            )}
            {canViewAttendance && (
              <Button
                size="sm"
                variant={activeTab === "attendance" ? "default" : "outline"}
                onClick={() => setActiveTab("attendance")}
                className="rounded-xl font-bold text-xs h-8"
              >
                الحضور والدوام
              </Button>
            )}
            {canViewPayroll && (
              <Button
                size="sm"
                variant={activeTab === "payroll" ? "default" : "outline"}
                onClick={() => setActiveTab("payroll")}
                className="rounded-xl font-bold text-xs h-8"
              >
                الرواتب
              </Button>
            )}
            {canViewLoans && (
              <Button
                size="sm"
                variant={activeTab === "loans" ? "default" : "outline"}
                onClick={() => setActiveTab("loans")}
                className="rounded-xl font-bold text-xs h-8"
              >
                السلف والقروض
              </Button>
            )}
            {canViewUsers && (
              <Button
                size="sm"
                variant={activeTab === "users" ? "default" : "outline"}
                onClick={() => setActiveTab("users")}
                className="rounded-xl font-bold text-xs h-8"
              >
                المستخدمين
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Grid view containing overview cards and HR modules cards */}
      {activeTab === "grid" && (
        <div className="space-y-6">
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
                <CardTitle className="text-xs font-bold text-muted-foreground flex items-center justify-between gap-1.5">
                  <span className="flex items-center gap-1.5">
                    <Building2 size={14} />
                    إجمالي الراتب المقوم الشهري
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                    {currency === "USD"
                      ? `1$ = ${exchangeRates.EGP} ج.م`
                      : `1$ = ${exchangeRates[currency]} ${currency === "EGP" ? "ج.م" : "ج.س.ج"}`}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-slate-800 dark:text-slate-100 tabular-nums">
                  {formatConvertedPrice(totalPayrollCost)}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  مجموع الراتب المقوم للموظفين النشطين بعملة الصفحة ({currency}) والمعامل الحالي
                </p>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-sm rounded-2xl bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                  <Coins size={14} />
                  القروض والسلف الجارية (المقومة)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
                  {formatConvertedPrice(activeLoansAmount)}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  موزعة على {activeLoansCount} سلف جاري سدادها بعملة الصفحة ({currency})
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

          {/* HR Modules Square Cards Grid (نظام المربعات مثل قسم المطعم) */}
          <section aria-labelledby="hr-modules-heading" className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <h2
                id="hr-modules-heading"
                className="flex items-center gap-2 text-base font-black text-foreground"
              >
                <Users size={18} className="text-primary" aria-hidden="true" />
                أقسام ووظائف الموارد البشرية وشؤون الموظفين
              </h2>
              <span className="text-xs font-bold text-muted-foreground">6 أقسام ومحاور</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {canViewEmployees && (
                <Card
                  onClick={() => setActiveTab("employees")}
                  className={`group cursor-pointer rounded-2xl border transition-all duration-200 hover:shadow-lg ${
                    activeTab === "employees"
                      ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/30"
                      : "border-border/80 bg-card hover:border-primary/40 hover:bg-accent/30"
                  }`}
                >
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 p-4">
                    <div className="rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-blue-600 dark:text-blue-400 p-2.5 shadow-xs">
                      <Users size={22} />
                    </div>
                    <span className="rounded-full border border-border/60 bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                      الكادر
                    </span>
                  </CardHeader>
                  <CardContent className="space-y-1.5 p-4 pt-0">
                    <h3 className="font-black text-sm text-foreground group-hover:text-primary transition-colors">
                      دليل الكادر الوظيفي
                    </h3>
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                      بيانات الموظفين، المسميات الوظيفية، الرواتب الأساسية وتواريخ التعيين
                    </p>
                    <div className="pt-2 flex items-center justify-between border-t border-border/50 text-[11px] font-bold">
                      <span className="text-primary">
                        {employees.length} موظف • {formatConvertedPrice(totalPayrollCost)}
                      </span>
                      <span className="text-muted-foreground group-hover:text-primary text-xs transition-transform group-hover:translate-x-[-2px]">
                        فتح الدليل ←
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {canViewAttendance && (
                <Card
                  onClick={() => setActiveTab("attendance")}
                  className={`group cursor-pointer rounded-2xl border transition-all duration-200 hover:shadow-lg ${
                    activeTab === "attendance"
                      ? "border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-sm ring-2 ring-emerald-400/30"
                      : "border-border/80 bg-card hover:border-emerald-500/40 hover:bg-accent/30"
                  }`}
                >
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 p-4">
                    <div className="rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400 p-2.5 shadow-xs">
                      <CalendarDays size={22} />
                    </div>
                    <span className="rounded-full border border-border/60 bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                      الحضور
                    </span>
                  </CardHeader>
                  <CardContent className="space-y-1.5 p-4 pt-0">
                    <h3 className="font-black text-sm text-foreground group-hover:text-emerald-600 transition-colors">
                      حضور وانصراف الدوام
                    </h3>
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                      تسجيل حضور اليوم، التأخيرات، الإجازات وحساب ساعات العمل الإضافية
                    </p>
                    <div className="pt-2 flex items-center justify-between border-t border-border/50 text-[11px] font-bold">
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {attendanceStatsForDate.present} حاضر اليوم
                      </span>
                      <span className="text-muted-foreground group-hover:text-emerald-600 text-xs transition-transform group-hover:translate-x-[-2px]">
                        تسجيل الحضور ←
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {canViewPayroll && (
                <Card
                  onClick={() => setActiveTab("payroll")}
                  className={`group cursor-pointer rounded-2xl border transition-all duration-200 hover:shadow-lg ${
                    activeTab === "payroll"
                      ? "border-amber-500 bg-amber-50/40 dark:bg-amber-950/20 shadow-sm ring-2 ring-amber-400/30"
                      : "border-border/80 bg-card hover:border-amber-500/40 hover:bg-accent/30"
                  }`}
                >
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 p-4">
                    <div className="rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-400 p-2.5 shadow-xs">
                      <FileSpreadsheet size={22} />
                    </div>
                    <span className="rounded-full border border-border/60 bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                      الرواتب
                    </span>
                  </CardHeader>
                  <CardContent className="space-y-1.5 p-4 pt-0">
                    <h3 className="font-black text-sm text-foreground group-hover:text-amber-600 transition-colors">
                      مسيرات الأجور والرواتب
                    </h3>
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                      احتساب الرواتب الشهرية، المكافآت، الخصومات وإصدار سندات الاستحقاق والصرف
                    </p>
                    <div className="pt-2 flex items-center justify-between border-t border-border/50 text-[11px] font-bold">
                      <span className="text-amber-600 dark:text-amber-400">مسيرات معتمدة</span>
                      <span className="text-muted-foreground group-hover:text-amber-600 text-xs transition-transform group-hover:translate-x-[-2px]">
                        عرض المسيرات ←
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {canViewLoans && (
                <Card
                  onClick={() => setActiveTab("loans")}
                  className={`group cursor-pointer rounded-2xl border transition-all duration-200 hover:shadow-lg ${
                    activeTab === "loans"
                      ? "border-teal-500 bg-teal-50/40 dark:bg-teal-950/20 shadow-sm ring-2 ring-teal-400/30"
                      : "border-border/80 bg-card hover:border-teal-500/40 hover:bg-accent/30"
                  }`}
                >
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 p-4">
                    <div className="rounded-xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20 text-teal-600 dark:text-teal-400 p-2.5 shadow-xs">
                      <Coins size={22} />
                    </div>
                    <span className="rounded-full border border-border/60 bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                      السلف
                    </span>
                  </CardHeader>
                  <CardContent className="space-y-1.5 p-4 pt-0">
                    <h3 className="font-black text-sm text-foreground group-hover:text-teal-600 transition-colors">
                      القروض والسلف المالية
                    </h3>
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                      صرف السلف النقدية، تتبع الأقساط الشهرية وخصمها آلياً من الراتب
                    </p>
                    <div className="pt-2 flex items-center justify-between border-t border-border/50 text-[11px] font-bold">
                      <span className="text-teal-600 dark:text-teal-400">سلف نشطة</span>
                      <span className="text-muted-foreground group-hover:text-teal-600 text-xs transition-transform group-hover:translate-x-[-2px]">
                        متابعة السلف ←
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {canViewUsers && (
                <Card
                  onClick={() => setActiveTab("users")}
                  className={`group cursor-pointer rounded-2xl border transition-all duration-200 hover:shadow-lg ${
                    activeTab === "users"
                      ? "border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-sm ring-2 ring-indigo-400/30"
                      : "border-border/80 bg-card hover:border-indigo-500/40 hover:bg-accent/30"
                  }`}
                >
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 p-4">
                    <div className="rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-600 dark:text-indigo-400 p-2.5 shadow-xs">
                      <UserCheck size={22} />
                    </div>
                    <span className="rounded-full border border-border/60 bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                      المستخدمين
                    </span>
                  </CardHeader>
                  <CardContent className="space-y-1.5 p-4 pt-0">
                    <h3 className="font-black text-sm text-foreground group-hover:text-indigo-600 transition-colors">
                      المستخدمين والصلاحيات
                    </h3>
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                      إدارة حسابات الدخول، تعيين الأدوار (مدير، كاشير، كابتن، مطبخ) وتخصيص الصلاحيات
                    </p>
                    <div className="pt-2 flex items-center justify-between border-t border-border/50 text-[11px] font-bold">
                      <span className="text-indigo-600 dark:text-indigo-400">أمان وتحكم</span>
                      <span className="text-muted-foreground group-hover:text-indigo-600 text-xs transition-transform group-hover:translate-x-[-2px]">
                        إدارة الصلاحيات ←
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {canViewEmployees && (
                <Card
                  onClick={openAddEmployeeDialog}
                  className="group cursor-pointer rounded-2xl border border-primary/30 bg-primary/5 hover:border-primary hover:bg-primary/10 transition-all duration-200 hover:shadow-lg"
                >
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 p-4">
                    <div className="rounded-xl bg-primary text-primary-foreground p-2.5 shadow-xs">
                      <UserPlus size={22} />
                    </div>
                    <span className="rounded-full border border-primary/30 bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                      موظف جديد
                    </span>
                  </CardHeader>
                  <CardContent className="space-y-1.5 p-4 pt-0">
                    <h3 className="font-black text-sm text-primary transition-colors">
                      إضافة موظف جديد
                    </h3>
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                      تسجيل موظف جديد في النظام مع الراتب، الفرع، القسم، وبيانات التواصل
                    </p>
                    <div className="pt-2 flex items-center justify-between border-t border-border/50 text-[11px] font-bold">
                      <span className="text-primary font-bold">إضافة فورية</span>
                      <span className="text-primary text-xs transition-transform group-hover:translate-x-[-2px]">
                        فتح النموذج +
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </section>
        </div>
      )}

      {/* Tabs */}
      {activeTab !== "grid" && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-muted p-1 rounded-xl flex flex-wrap gap-1 h-auto w-full md:w-auto">
            {canViewEmployees && (
              <TabsTrigger value="employees" className="rounded-lg font-bold py-2.5 px-5">
                <Users size={16} className="ml-1.5 inline" />
                دليل الكادر الوظيفي
              </TabsTrigger>
            )}
            {canViewAttendance && (
              <TabsTrigger value="attendance" className="rounded-lg font-bold py-2.5 px-5">
                <CalendarDays size={16} className="ml-1.5 inline" />
                حضور وانصراف اليوم
              </TabsTrigger>
            )}
            {canViewPayroll && (
              <TabsTrigger value="payroll" className="rounded-lg font-bold py-2.5 px-5">
                <FileSpreadsheet size={16} className="ml-1.5 inline" />
                مسيرات الأجور والرواتب
              </TabsTrigger>
            )}
            {canViewLoans && (
              <TabsTrigger value="loans" className="rounded-lg font-bold py-2.5 px-5">
                <Coins size={16} className="ml-1.5 inline" />
                القروض والسلف المالية
              </TabsTrigger>
            )}
            {canViewUsers && (
              <TabsTrigger
                value="users"
                className="rounded-lg font-bold py-2.5 px-5 text-indigo-700 dark:text-indigo-400"
              >
                <UserCheck size={16} className="ml-1.5 inline" />
                المستخدمين والصلاحيات
              </TabsTrigger>
            )}
          </TabsList>

          {/* TAB 1: EMPLOYEE DIRECTORY */}
          <TabsContent value="employees" className="mt-4 space-y-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-muted/40 p-4 rounded-xl">
              <div className="relative w-full md:w-80">
                <Search className="absolute right-3 top-3 text-muted-foreground" size={16} />
                <Input
                  placeholder="ابحث بالرقم الوظيفي أو اسم الموظف أو وظيفته أو هاتفه..."
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  className="pr-10 bg-card rounded-xl text-xs"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                <div className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-xl text-xs font-black">
                  <span>مجموع الراتب المقوم ({filteredEmployees.length}):</span>
                  <span className="font-mono tabular-nums">
                    {formatConvertedPrice(filteredValuedSalariesTotal)}
                  </span>
                </div>
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
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge className="bg-primary/15 text-primary border border-primary/30 font-mono font-black text-xs px-2 py-0.5">
                              الرقم الوظيفي: #{emp.employee_code || "1001"}
                            </Badge>
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
                            الراتب المقوم ({currency})
                          </span>
                          <span className="font-black text-xs text-primary tabular-nums">
                            {formatPrice(Number(emp.salary) || 0, (emp.currency || "EGP") as any)}
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
                      <th className="p-3.5 pr-6">الرقم الوظيفي</th>
                      <th className="p-3.5">اسم الموظف</th>
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
                            <td className="p-3.5 pr-6 font-mono font-black text-primary">
                              #{emp.employee_code || "-"}
                            </td>
                            <td className="p-3.5 font-bold text-slate-800">{emp.name}</td>
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
            <div className="flex flex-col gap-3 bg-muted/40 p-4 rounded-2xl border border-border/60">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
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
                    className="gap-2 rounded-xl font-bold px-4 text-xs"
                  >
                    <PlusCircle size={15} />
                    احتساب كشف الرواتب
                  </Button>
                  <Button
                    onClick={openDisbursementPreviewModal}
                    className="gap-2 rounded-xl font-black px-4 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                  >
                    <Eye size={15} />
                    توليد ومعاينة قيود صرف المرتبات (اعتماد المدير العام)
                  </Button>
                  <Button
                    onClick={() => setIsCuttableSlipsOpen(true)}
                    variant="outline"
                    className="gap-2 rounded-xl font-black px-4 text-xs border-amber-500/50 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                  >
                    <Scissors size={15} />
                    طباعة إيصالات تسليم الرواتب (مستطيلات للتقطيع ✂️)
                  </Button>
                  <Button
                    onClick={handleSendAllEmployeesSalarySlipsPrivately}
                    className="gap-2 rounded-xl font-black px-4 text-xs bg-[#006AFF] hover:bg-[#0055CC] text-white shadow-sm"
                  >
                    <Lock size={14} />
                    إرسال تفاصيل الراتب لكل موظف بسرية (Messenger)
                  </Button>
                  <Button
                    onClick={handlePostPayrollAccrual}
                    variant="outline"
                    className="gap-2 rounded-xl font-bold px-3.5 text-xs border-purple-500/40 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                  >
                    <CheckCircle2 size={15} />
                    قيد الاستحقاق (M/N)
                  </Button>
                  <Button
                    onClick={() => openAccrualVoucher(payrollMonth)}
                    variant="outline"
                    className="gap-1.5 rounded-xl font-bold px-3 text-xs border-purple-500/40 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                  >
                    <Printer size={14} />
                    طباعة الاستحقاق
                  </Button>
                </div>
              </div>
            </div>

            <Card className="border border-border shadow-sm rounded-2xl bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                  <thead className="bg-muted/70 text-muted-foreground text-xs border-b border-border font-bold">
                    <tr>
                      <th className="p-3.5 pr-6">الرقم الوظيفي</th>
                      <th className="p-3.5">اسم الموظف</th>
                      <th className="p-3.5">الراتب الأساسي</th>
                      <th className="p-3.5 text-rose-600">خصومات الحضور والغياب</th>
                      <th className="p-3.5 text-amber-600">خصم قسط السلفة</th>
                      <th className="p-3.5 text-emerald-600">صافي المستحق للقبض</th>
                      <th className="p-3.5 text-primary">الصافي المقوم ({currency})</th>
                      <th className="p-3.5">العملة الأساسية</th>
                      <th className="p-3.5">الحالة</th>
                      <th className="p-3.5 text-center pl-6">صرف النقدية والإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {payrolls.filter((p) => p.month === payrollMonth).length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-muted-foreground">
                          لم يتم توليد مسير رواتب لهذا الشهر بعد. يرجى الضغط على زر توليد مسير
                          الرواتب أعلاه.
                        </td>
                      </tr>
                    ) : (
                      <>
                        {payrolls
                          .filter((p) => p.month === payrollMonth)
                          .map((p) => {
                            const emp = employees.find((e) => e.id === p.employee_id);
                            return (
                              <tr key={p.id} className="hover:bg-muted/30 transition">
                                <td className="p-3.5 pr-6">
                                  <Badge className="bg-primary/15 text-primary border border-primary/30 font-mono font-black text-xs px-2.5 py-0.5">
                                    #{emp?.employee_code || "-"}
                                  </Badge>
                                </td>
                                <td className="p-3.5 font-bold text-slate-800 dark:text-slate-100">
                                  <div>{emp ? emp.name : "موظف محذوف"}</div>
                                  {emp && (
                                    <span className="text-[10px] font-semibold text-muted-foreground">
                                      {emp.job_title} • {emp.department}
                                    </span>
                                  )}
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
                                <td className="p-3.5 font-mono font-black text-primary tabular-nums">
                                  {formatPrice(Number(p.net_salary) || 0, (p.currency || "EGP") as any)}
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
                                  <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleSendSingleEmployeeSalarySlip(p)}
                                      className="h-7 text-[11px] rounded-lg font-bold px-2.5 gap-1 border-[#0084FF]/40 text-[#006AFF] hover:bg-[#0084FF]/10"
                                      title="إرسال تفاصيل الراتب في رسالة خاصة سرية لهذا الموظف فقط"
                                    >
                                      <Lock size={11} />
                                      إرسال تفاصيل الراتب (خاص)
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => viewPayrollVoucher(p)}
                                      className="h-7 text-xs rounded-lg font-bold px-2.5 gap-1"
                                    >
                                      <Printer size={12} />
                                      السند
                                    </Button>
                                    {p.status === "paid" ? (
                                      <div className="text-[11px] text-slate-400 font-bold font-mono">
                                        دُفع: {p.payment_date}
                                      </div>
                                    ) : (
                                      <Button
                                        size="sm"
                                        onClick={() => openPaySalaryDialog(p)}
                                        className="h-7 text-xs rounded-lg font-bold px-3 bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 gap-1"
                                      >
                                        <CreditCard size={12} />
                                        صرف نقداً
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        <tr className="bg-primary/5 font-black border-t-2 border-primary/20">
                          <td className="p-3.5 pr-6 text-primary" colSpan={6}>
                            إجمالي صافي مسير الرواتب المقوم حسب عملة الصفحة ({currency}) والمعامل الحالي
                          </td>
                          <td className="p-3.5 font-mono text-primary text-base tabular-nums" colSpan={4}>
                            {formatConvertedPrice(
                              payrolls
                                .filter((p) => p.month === payrollMonth)
                                .reduce(
                                  (sum, p) =>
                                    sum + convertPrice(Number(p.net_salary) || 0, p.currency || "EGP"),
                                  0,
                                ),
                            )}
                          </td>
                        </tr>
                      </>
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

          {/* TAB 5: USERS & PERMISSIONS EMBEDDED */}
          <TabsContent value="users" className="mt-4 space-y-4">
            <div className="bg-card border border-border rounded-2xl p-2 sm:p-4 shadow-xs">
              <UsersPage />
            </div>
          </TabsContent>
        </Tabs>
      )}

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
            <div className="grid grid-cols-3 gap-3 text-right">
              <div className="space-y-1.5 col-span-1">
                <Label className="font-bold text-xs text-primary">الرقم الوظيفي (تلقائي) *</Label>
                <Input
                  value={empForm.employee_code}
                  onChange={(e) =>
                    setEmpForm((prev) => ({ ...prev, employee_code: e.target.value }))
                  }
                  placeholder="1006"
                  className="rounded-xl font-mono font-black text-center bg-primary/5 border-primary/30 text-primary"
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="font-bold text-xs">الاسم بالكامل *</Label>
                <Input
                  value={empForm.name}
                  onChange={(e) => setEmpForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="أدخل الاسم الرباعي للموظف"
                  className="rounded-xl"
                />
              </div>
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
              تحديث المعلومات الأساسية والرقم الوظيفي والرواتب للموظف المحدد
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditEmployeeSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-right">
              <div className="space-y-1.5 col-span-1">
                <Label className="font-bold text-xs text-primary">الرقم الوظيفي *</Label>
                <Input
                  value={empForm.employee_code}
                  onChange={(e) =>
                    setEmpForm((prev) => ({ ...prev, employee_code: e.target.value }))
                  }
                  placeholder="1001"
                  className="rounded-xl font-mono font-black text-center bg-primary/5 border-primary/30 text-primary"
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="font-bold text-xs">الاسم بالكامل *</Label>
                <Input
                  value={empForm.name}
                  onChange={(e) => setEmpForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="أدخل الاسم الرباعي للموظف"
                  className="rounded-xl"
                />
              </div>
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

      {/* DIALOG 7: AUTOMATIC PAYROLL DISBURSEMENT PREVIEW, APPROVAL & GM PRINTOUT */}
      <Dialog open={isDisbursementPreviewOpen} onOpenChange={setIsDisbursementPreviewOpen}>
        <DialogContent className="max-w-4xl bg-card border border-border text-right max-h-[92vh] overflow-y-auto">
          <DialogHeader className="border-b border-border/60 pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-xs font-black px-3 py-1">
                توليد ومعاينة قيود صرف المرتبات أوتوماتيكياً
              </Badge>
              <DialogTitle className="font-black text-lg text-slate-900 dark:text-slate-100">
                معاينة واعتماد قيود وكشف صرف المرتبات — شهر ({payrollMonth})
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              يمكنك مراجعة ومعاينة القيود المحاسبية التلقائية وكشف المرتبات قبل اعتمادها، وطباعتها
              للسيد المدير العام في صيغة (كشف للمرتبات) أو (صيغة قيود محاسبية) للاعتماد.
            </DialogDescription>
          </DialogHeader>

          {disbursementPreviewData && (
            <div className="space-y-4 py-2">
              {/* Top Configuration Bar: Treasury Selector + Format Toggle */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-muted/40 p-3.5 rounded-2xl border border-border/60">
                <div className="space-y-1 text-right">
                  <Label className="font-black text-xs">
                    اختر خزينة / بنك صرف المرتبات (حساب الدائن):
                  </Label>
                  <select
                    value={disbursementTreasuryId}
                    onChange={(e) => setDisbursementTreasuryId(e.target.value)}
                    className="w-full bg-card border border-border text-xs rounded-xl h-10 px-3 font-bold outline-none"
                  >
                    {(erpState.treasuries || [])
                      .filter((t) => !t.deleted)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.account_code ? `[${t.account_code}] ` : ""}
                          {t.name_ar} — العملة: {t.currency} (الرصيد:{" "}
                          {formatTreasuryCurrency(t.balance, t.currency)})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-1 text-right">
                  <Label className="font-black text-xs">صيغة العرض والمعاينة قبل الاعتماد:</Label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-card border border-border rounded-xl h-10">
                    <button
                      type="button"
                      onClick={() => setDisbursementViewMode("journal")}
                      className={`rounded-lg text-xs font-black transition cursor-pointer ${
                        disbursementViewMode === "journal"
                          ? "bg-primary text-primary-foreground shadow-2xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      📘 صيغة قيود صرف المرتبات
                    </button>
                    <button
                      type="button"
                      onClick={() => setDisbursementViewMode("sheet")}
                      className={`rounded-lg text-xs font-black transition cursor-pointer ${
                        disbursementViewMode === "sheet"
                          ? "bg-primary text-primary-foreground shadow-2xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      📊 صيغة كشف للمرتبات
                    </button>
                  </div>
                </div>
              </div>

              {/* Preview Body: Journal Format vs Payroll Sheet Format */}
              {disbursementViewMode === "journal" ? (
                <div className="space-y-4">
                  {Object.values(disbursementPreviewData.groupsByCurrency || {}).map((group) => {
                    const totalDebit = group.journalLines.reduce(
                      (s, l) => s + Number(l.debit || 0),
                      0,
                    );
                    const totalCredit = group.journalLines.reduce(
                      (s, l) => s + Number(l.credit || 0),
                      0,
                    );
                    return (
                      <div
                        key={group.currency}
                        className="border border-border rounded-2xl overflow-hidden"
                      >
                        <div className="bg-muted/70 px-4 py-2.5 flex items-center justify-between text-xs font-black border-b border-border">
                          <span>
                            قيد صرف المرتبات التلقائي بعملة ({group.currency}) — خزينة الصرف:{" "}
                            {disbursementPreviewData.treasuryAccName}
                          </span>
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-0">
                            قيد مزدوج متزن (المدين = الدائن)
                          </Badge>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-right">
                            <thead className="bg-muted/40 text-muted-foreground font-bold border-b border-border">
                              <tr>
                                <th className="p-2.5 pr-4">كود الحساب</th>
                                <th className="p-2.5">اسم الحساب المحاسبي</th>
                                <th className="p-2.5">البيان والتفاصيل</th>
                                <th className="p-2.5 text-left">مدين (Debit)</th>
                                <th className="p-2.5 text-left pl-4">دائن (Credit)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60 font-mono">
                              {group.journalLines.map((line, idx) => (
                                <tr key={idx} className="hover:bg-muted/20">
                                  <td className="p-2.5 pr-4 font-bold text-slate-500">
                                    {line.account_code}
                                  </td>
                                  <td className="p-2.5 font-sans font-bold text-foreground">
                                    {line.account_name}
                                  </td>
                                  <td className="p-2.5 font-sans text-muted-foreground">
                                    {line.description}
                                  </td>
                                  <td className="p-2.5 text-left font-black text-emerald-600">
                                    {line.debit > 0
                                      ? `${line.debit.toLocaleString()} ${line.currency}`
                                      : "-"}
                                  </td>
                                  <td className="p-2.5 text-left pl-4 font-black text-rose-600">
                                    {line.credit > 0
                                      ? `${line.credit.toLocaleString()} ${line.currency}`
                                      : "-"}
                                  </td>
                                </tr>
                              ))}
                              <tr className="bg-primary/5 font-black text-sm">
                                <td colSpan={3} className="p-2.5 pr-4 font-sans text-primary">
                                  إجمالي القيد المحاسبي ({group.currency})
                                </td>
                                <td className="p-2.5 text-left text-emerald-700 dark:text-emerald-400">
                                  {totalDebit.toLocaleString()} {group.currency}
                                </td>
                                <td className="p-2.5 text-left pl-4 text-rose-700 dark:text-rose-400">
                                  {totalCredit.toLocaleString()} {group.currency}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.values(disbursementPreviewData.groupsByCurrency || {}).map((group) => (
                    <div
                      key={group.currency}
                      className="border border-border rounded-2xl overflow-hidden"
                    >
                      <div className="bg-muted/70 px-4 py-2.5 flex items-center justify-between text-xs font-black border-b border-border">
                        <span>
                          كشف مرتبات الموظفين التفصيلي ({group.currency}) — عدد الموظفين:{" "}
                          {group.records.length}
                        </span>
                        <span className="font-mono text-emerald-600">
                          إجمالي الصافي: {group.totalNet.toLocaleString()} {group.currency}
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-right">
                          <thead className="bg-muted/40 text-muted-foreground font-bold border-b border-border">
                            <tr>
                              <th className="p-2.5 pr-4">م</th>
                              <th className="p-2.5">الرقم الوظيفي</th>
                              <th className="p-2.5">اسم الموظف</th>
                              <th className="p-2.5">الوظيفة / القسم</th>
                              <th className="p-2.5">الأساسي</th>
                              <th className="p-2.5 text-rose-600">الخصومات</th>
                              <th className="p-2.5 text-amber-600">قسط السلفة</th>
                              <th className="p-2.5 text-emerald-600">صافي الراتب</th>
                              <th className="p-2.5 pl-4">الحالة</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {group.records.map(({ payroll, employee }, idx) => (
                              <tr key={payroll.id} className="hover:bg-muted/20">
                                <td className="p-2.5 pr-4 font-mono">{idx + 1}</td>
                                <td className="p-2.5 font-mono font-black text-primary">
                                  #{employee?.employee_code || "-"}
                                </td>
                                <td className="p-2.5 font-black">{employee?.name || "موظف"}</td>
                                <td className="p-2.5 text-muted-foreground">
                                  {employee?.job_title} ({employee?.department})
                                </td>
                                <td className="p-2.5 font-mono font-bold">
                                  {Number(payroll.basic_salary || 0).toLocaleString()}{" "}
                                  {group.currency}
                                </td>
                                <td className="p-2.5 font-mono font-bold text-rose-600">
                                  -{Number(payroll.deductions || 0).toLocaleString()}{" "}
                                  {group.currency}
                                </td>
                                <td className="p-2.5 font-mono font-bold text-amber-600">
                                  -{Number(payroll.loan_deduction || 0).toLocaleString()}{" "}
                                  {group.currency}
                                </td>
                                <td className="p-2.5 font-mono font-black text-emerald-600">
                                  {Number(payroll.net_salary || 0).toLocaleString()}{" "}
                                  {group.currency}
                                </td>
                                <td className="p-2.5 pl-4">
                                  {payroll.status === "paid" ? "تم الصرف ✅" : "جاهز للصرف"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-border/60">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handlePrintGeneralManagerApproval("sheet")}
                className="rounded-xl font-black text-xs gap-1.5 border-sky-500/40 text-sky-700 dark:text-sky-300"
              >
                <Printer size={15} />
                طباعة للمدير العام (صيغة كشف للمرتبات)
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handlePrintGeneralManagerApproval("journal")}
                className="rounded-xl font-black text-xs gap-1.5 border-purple-500/40 text-purple-700 dark:text-purple-300"
              >
                <Printer size={15} />
                طباعة للمدير العام (صيغة قيود صرف)
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDisbursementPreviewOpen(false)}
                className="rounded-xl font-bold text-xs"
              >
                إغلاق
              </Button>
              <Button
                type="button"
                onClick={handleApproveAndPostDisbursement}
                className="rounded-xl font-black text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-5"
              >
                <CheckCircle2 size={16} />
                اعتماد وترحيل قيود صرف المرتبات الآن
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 8: CUTTABLE RECTANGULAR SALARY RECEIPTS FOR ALL EMPLOYEES */}
      <Dialog open={isCuttableSlipsOpen} onOpenChange={setIsCuttableSlipsOpen}>
        <DialogContent className="max-w-4xl bg-card border border-border text-right max-h-[92vh] overflow-y-auto">
          <DialogHeader className="border-b border-border/60 pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-black px-3 py-1">
                توفير الورق • مقاس موحد قابل للتقطيع ✂️
              </Badge>
              <DialogTitle className="font-black text-lg text-slate-900 dark:text-slate-100">
                معاينة وطباعة إيصالات تسليم المرتبات المستطيلة — شهر ({payrollMonth})
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              مستطيلات موحدة المقاس (تحتوي على الاسم، المبلغ الصافي، وتوقيع المستلم) مصممة لتقطيعها
              إلى إيصالات صغيرة تسلم لكل عامل عند قبض الراتب، مع التوزيع التلقائي على عدة صفحات.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-3">
            {cuttableSalarySlipsList.map((slip) => (
              <div
                key={slip.empId}
                className="relative border-2 border-dashed border-slate-400 dark:border-slate-600 rounded-xl p-3.5 bg-white dark:bg-slate-900 flex flex-col justify-between gap-2.5 shadow-2xs"
              >
                <span className="absolute -top-2.5 right-3 bg-card px-2 text-[10px] font-black text-slate-500 flex items-center gap-1">
                  <Scissors size={11} /> إيصال راتب #{slip.seq} • الرقم الوظيفي: #{slip.employeeCode}
                </span>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground border-b border-border/60 pb-1.5">
                  <span className="font-bold">مسير شهر: {slip.month}</span>
                  <span>القسم: {slip.department}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground">
                    اسم العامل (#{slip.employeeCode}):
                  </span>
                  <div className="text-right">
                    <span className="text-sm font-black text-foreground">{slip.name}</span>
                    <span className="text-[10px] font-bold text-primary mr-1">
                      ({slip.jobTitle})
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-3 py-2">
                  <div>
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block">
                      المبلغ الصافي المستلم:
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      أساسي: {slip.basic.toLocaleString()} | خصم: {slip.deductions.toLocaleString()}{" "}
                      | سلفة: {slip.loanDed.toLocaleString()}
                    </span>
                  </div>
                  <span className="font-mono font-black text-base text-emerald-700 dark:text-emerald-400">
                    {slip.net.toLocaleString()} {slip.currency}
                  </span>
                </div>

                <div className="pt-1 border-t border-border/50 flex items-center justify-between text-xs font-black text-slate-700 dark:text-slate-300">
                  <span>توقيع المستلم بالاستلام:</span>
                  <span className="text-slate-400 font-normal">
                    ....................................
                  </span>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2 pt-4 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCuttableSlipsOpen(false)}
              className="rounded-xl font-bold text-xs"
            >
              إغلاق
            </Button>
            <Button
              type="button"
              onClick={handlePrintCuttableSalaryReceipts}
              className="rounded-xl font-black text-xs bg-amber-600 hover:bg-amber-700 text-white gap-2 px-5"
            >
              <Printer size={16} />
              طباعة جميع الإيصالات المستطيلة للتقطيع ({cuttableSalarySlipsList.length} إيصال)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
