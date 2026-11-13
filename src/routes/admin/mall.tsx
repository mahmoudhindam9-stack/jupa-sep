// @ts-nocheck
import { toast } from "sonner";
import { createFileRoute, useLocation, useNavigate, Link } from "@tanstack/react-router";
import { extractTabParam, useSyncedSubTab } from "@/components/navigation/navigationRegistry";
import { useState, useMemo, useEffect } from "react";
import { ViewModeToggle, useViewMode } from "@/components/ui/view-mode-toggle";
import { printRawHtml } from "@/shared/utils/printAccountingDocument";
import {
  Building2,
  Receipt,
  Store,
  DollarSign,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Trash2,
  Edit,
  Search,
  Layers,
  TrendingUp,
  TrendingDown,
  User,
  Phone,
  FileText,
  Trees,
  Wallet,
  CreditCard,
  Printer,
  Upload,
  Archive,
  Paperclip,
  MessageCircle,
  CalendarCheck,
  Ticket,
  RotateCcw,
  FileSpreadsheet,
  Lock,
  Settings,
  Users,
  Landmark,
  Eye,
  Clock,
  ShoppingCart,
  ArrowRight,
  History,
  Database,
} from "lucide-react";
import * as XLSX from "xlsx";
import { ShiftAuditLogViewerModal } from "@/components/admin/ShiftAuditLogViewerModal";
import { ShiftAuditLogViewer } from "@/components/admin/ShiftAuditLogViewer";
import {
  ParkTicketsPOSView,
  ParkRefundModal,
  ParkTransactionDetailsModal,
  ParkOperationalTreasuriesModal,
  ParkCustomersModal,
  ParkTicketPricesModal,
  ParkShiftClosingModal,
  ParkShiftLauncherModal,
  ParkShiftClosingReportModal,
} from "@/components/mall/ParkTicketsPOS";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  erpStore,
  MallShop,
  MallRentalPayment,
  MallGardenRevenue,
  MallGardenExpense,
  TerminatedContractRecord,
} from "@/shared/services/erpStore";
import { useSyncExternalStore } from "react";

import { MallReportAndArchiveDialogs } from "@/components/mall/MallReportAndArchiveDialogs";

export const Route = createFileRoute("/admin/mall")({
  head: () => ({ meta: [{ title: "إدارة المول - النظام الشامل" }] }),
  component: MallManagementPage,
});

const MONTHS_AR = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

function MallManagementPage() {
  const state = useSyncExternalStore(
    (cb) => erpStore.subscribe(cb),
    () => erpStore.getState(),
    () => erpStore.getState(),
  );

  // Permissions for this route are enforced by AdminLayout against the authenticated
  // Supabase profile. Do not infer a role from localStorage defaults.
  const shops: MallShop[] = state.mallShops || [];
  const payments: MallRentalPayment[] = state.mallPayments || [];
  const gardenRevenues: MallGardenRevenue[] = state.mallGardenRevenues || [];
  const gardenExpenses: MallGardenExpense[] = state.mallGardenExpenses || [];
  const treasuries = state.treasuries || [];

  useEffect(() => {
    if (shops.length === 0) {
      erpStore.resetMallData();
    }
  }, [shops.length]);

  const navigate = useNavigate();
  const location = useLocation();
  const tabParam = extractTabParam(location.search, (location as any).searchStr);
  const [viewMode, setViewMode] = useViewMode("mall", "grid");

  const openMallSubpage = (tabKey: string) => {
    navigate({
      to: "/admin/mall" as any,
      search: { tab: tabKey } as any,
    });
  };

  const resolveMallTab = (rawTab: string | undefined): "definitions" | "operations" | "reports" => {
    if (
      rawTab === "definitions" ||
      rawTab === "shops" ||
      rawTab === "units" ||
      rawTab === "tenants" ||
      rawTab === "readings"
    ) {
      return "definitions";
    }
    if (rawTab === "reports" || (rawTab && rawTab.startsWith("rep_"))) return "reports";
    return "operations";
  };

  const [activeTab, setActiveTab] = useState<"definitions" | "operations" | "reports">(() =>
    resolveMallTab(tabParam),
  );

  const isMallSubpageOpen = Boolean(
    tabParam &&
      tabParam !== "definitions" &&
      tabParam !== "operations" &&
      tabParam !== "reports" &&
      tabParam !== "overview" &&
      tabParam !== "grid",
  );

  useEffect(() => {
    if (tabParam === "payments" || tabParam === "expenses" || tabParam === "vouchers") {
      navigate({ to: "/admin/ledger", search: { tab: "vouchers", dept: "mall" } as any });
      return;
    }
    if (tabParam === "garden") {
      navigate({ to: "/admin/park" });
      return;
    }
    setActiveTab(resolveMallTab(tabParam));
  }, [tabParam, navigate]);

  useSyncedSubTab("/admin/mall", activeTab, setActiveTab as any, "operations");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Park Tickets & POS state
  const [isParkPosOpen, setIsParkPosOpen] = useState(false);
  const [isParkShiftLauncherOpen, setIsParkShiftLauncherOpen] = useState(false);
  const [isShiftAuditModalOpen, setIsShiftAuditModalOpen] = useState(false);
  const [selectedClosedShiftForReport, setSelectedClosedShiftForReport] = useState<any>(null);
  const [shiftToCloseFromLauncher, setShiftToCloseFromLauncher] = useState<any>(null);
  const [parkReportType, setParkReportType] = useState<
    "transactions" | "journal_entries" | "closed_shifts" | "open_shifts"
  >("transactions");
  const [parkSearchQuery, setParkSearchQuery] = useState("");
  const [parkDateFilter, setParkDateFilter] = useState("");
  const [selectedParkTxForPreview, setSelectedParkTxForPreview] = useState<any>(null);
  const [selectedParkTxForRefund, setSelectedParkTxForRefund] = useState<any>(null);
  const [isParkTreasuriesModalOpen, setIsParkTreasuriesModalOpen] = useState(false);
  const [isParkCustomersModalOpen, setIsParkCustomersModalOpen] = useState(false);
  const [isParkPricesModalOpen, setIsParkPricesModalOpen] = useState(false);
  const [isParkShiftCloseModalOpen, setIsParkShiftCloseModalOpen] = useState(false);

  // Open POS or launch shift
  const handleOpenTicketsPos = () => {
    setActiveTab("garden");
    const openShift = (state.parkShifts || []).find((s: any) => s.status === "open");
    if (openShift) {
      try {
        erpStore.resumeParkShift(openShift.id);
      } catch (e) {
        // ignore
      }
      setIsParkPosOpen(true);
    } else {
      setIsParkShiftLauncherOpen(true);
    }
  };

  const targetMonthStr = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
  const isAccrualGeneratedForMonth = (state.journalEntries || []).some(
    (je) =>
      je.reference === `MALL-RENT-ACCRUAL-${targetMonthStr}` ||
      je.reference?.startsWith(`MALL-RENT-ACCRUAL-${targetMonthStr}`) ||
      je.description?.includes(`قيد استحقاق إيجارات المحلات لشهر (${targetMonthStr})`) ||
      je.description?.includes(`قيد استحقاق إيجارات المحلات - شهر (${targetMonthStr})`) ||
      je.description?.includes(`MALL-RENT-ACCRUAL-${targetMonthStr}`),
  );

  const handleGenerateAccrual = () => {
    const monthStr = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
    const result = erpStore.postMallRentAccrualJournal(monthStr);

    if (result.alreadyGenerated) {
      toast.warning(result.message, {
        duration: 6000,
        description: "تم حظر العملية لتفادي تكرار وازدواجية القيود المحاسبية لنفس الشهر.",
      });
    } else if (!result.success) {
      toast.error(result.message);
    } else {
      toast.success(result.message, {
        duration: 6000,
        description: "تم إنشاء قيود الاستحقاق الشهرية في دفتر اليومية العامة بنجاح.",
      });
    }
  };

  // Modal states for Shop CRUD
  const [isShopModalOpen, setIsShopModalOpen] = useState(false);
  const [editingShop, setEditingShop] = useState<MallShop | null>(null);
  const [shopToDelete, setShopToDelete] = useState<MallShop | null>(null);
  const [shopForm, setShopForm] = useState({
    shop_number: "",
    name_ar: "",
    account_number: "",
    tenant_name: "",
    phone: "",
    monthly_rent: 1000,
    status: "rented" as "rented" | "vacant" | "maintenance",
    space_sqm: 50,
    notes: "",
    contract_image: "",
    id_image: "",
    treasury_account_id: "",
  });

  // Modal states for Contract & Print
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [isStatusReportModalOpen, setIsStatusReportModalOpen] = useState(false);
  const [reportShopId, setReportShopId] = useState("all");
  const [reportDate, setReportDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [viewingContractShop, setViewingContractShop] = useState<MallShop | null>(null);
  const [contractForm, setContractForm] = useState({
    shop_id: "",
    custom_shop_name: "",
    custom_activity: "",
    tenant_name: "",
    phone: "",
    nationality: "مصري / Egyptian",
    id_number: "",
    start_date: new Date().toISOString().split("T")[0],
    end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    monthly_rent: 1000,
    deposit_amount: 1000,
    advance_payment: 0,
    language: "ar" as "ar" | "en",
    treasury_account_id: "",
    terms: `1. يسري هذا العقد للمدة المحددة ويتجدد تلقائياً بموافقة الطرفين.
2. يلتزم المستأجر بسداد القيمة الإيجارية في موعد أقصاه الخامس من كل شهر.
3. يتحمل المستأجر كافة فواتير الكهرباء والمياه والخدمات الخاصة بالوحدة.
4. لا يحق للمستأجر التنازل عن الوحدة أو تأجيرها من الباطن كلياً أو جزئياً دون موافقة كتابية مسبقة.
5. في حال الإخلال بأي من شروط العقد، يحق للإدارة فسخ العقد واتخاذ الإجراءات القانونية اللازمة.`,
    new_clause: "",
    contract_image: "",
    id_image: "",
    // new fields
    authorized_representative: "",
    tenant_address: "",
    floor: "",
    area: "",
    lease_term: "",
    renewal_option: "",
    currency: "USD",
    payment_due_date: "",
    payment_method: "",
    service_charge: "",
    electricity_included: false,
    water_included: false,
    other_charges: "",
    annual_escalation: "",
    fit_out_period: "",
  });

  // Modal states for Termination & Archive
  const [isTerminationModalOpen, setIsTerminationModalOpen] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [terminationForm, setTerminationForm] = useState({
    shop_id: "",
    refund_amount: 0,
    termination_image: "",
    notes: "",
  });
  const terminatedArchive: TerminatedContractRecord[] = state.mallTerminatedContractsArchive || [];

  const selectedShopForTermination = shops.find((s) => s.id === terminationForm.shop_id);

  const printTerminationContent = () => {
    if (!selectedShopForTermination) return;
    const s = selectedShopForTermination;
    const contract = s.contract;
    const html = `
      <div class="print-container">
        <div class="border-b" style="text-align: center;">
          <h2>محضر تسليم محل وفسخ عقد إيجار</h2>
          <p style="font-size: 11px; color: #64748b;">مركز التسوق التجاري والحديقة الترفيهية - إدارة الأملاك</p>
        </div>
        <div class="grid" style="font-size: 12px; margin-top: 16px;">
          <div><strong>رقم المحل / الوحدة:</strong> #${s.shop_number} (${s.name_ar})</div>
          <div><strong>اسم المستأجر:</strong> ${s.tenant_name || "غير محدد"}</div>
          <div><strong>رقم الهاتف:</strong> ${s.phone || "غير محدد"}</div>
          <div><strong>تاريخ بداية العقد:</strong> ${contract?.start_date || "---"}</div>
          <div><strong>تاريخ نهاية العقد:</strong> ${contract?.end_date || "---"}</div>
          <div><strong>مبلغ التأمين الأصلي:</strong> $${contract?.deposit_amount || 0} USD</div>
        </div>
        <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; text-align: center; margin: 20px 0; border: 1px solid #e2e8f0;">
          <p style="font-size: 12px; margin-bottom: 4px;">صافي مبلغ التأمين المسترد للعميل:</p>
          <h3 style="color: #059669; font-size: 24px; margin: 0;">$${Number(terminationForm.refund_amount || 0).toLocaleString()} USD</h3>
        </div>
        <p style="font-size: 12px; line-height: 1.6; margin-top: 12px;">
          أقر أنا المذكور أعلاه باستلام المحل كاملاً وخاليا من أي التزامات مالية أو عينية، كما استلمت مبلغ التأمين المسترد كاملاً، وتم فسخ التعاقد وإبراء ذمة الطرفين.
        </p>
        ${terminationForm.notes ? `<p><strong>ملاحظات التسليم:</strong> ${terminationForm.notes}</p>` : ""}
        <div class="signatures">
          <div>
            <p>توقيع إدارة المول</p>
            <div class="sig-line"></div>
          </div>
          <div>
            <p>توقيع المستأجر (المسلم)</p>
            <div class="sig-line"></div>
          </div>
        </div>
      </div>
    `;
    handlePrintHTML("محضر فسخ عقد وتسليم المحل", html);
  };

  const handleSendWhatsApp = (shop: MallShop, type: string) => {
    if (!shop.phone || shop.phone === "-") {
      toast.error("لا يوجد رقم هاتف مسجل للمستأجر.");
      return;
    }

    let cleanPhone = shop.phone.replace(/\D/g, "");
    if (
      !cleanPhone.startsWith("211") &&
      !cleanPhone.startsWith("20") &&
      !cleanPhone.startsWith("249")
    ) {
      // Just a naive check, you might want to add country code prefix if not present, e.g. +211 for South Sudan
      // assuming standard numbers if no code is present. For now we will just use it as is if it has a code or append a default if needed.
      // If it starts with 0, remove 0 and add 211
      if (cleanPhone.startsWith("0")) {
        cleanPhone = "211" + cleanPhone.substring(1);
      }
    }

    let message = "";
    const tenantName = shop.tenant_name || "Valued Tenant";
    const shopNum = shop.shop_number || "";

    switch (type) {
      case "payment":
        message = `Dear ${tenantName}, \n\nThis is a gentle reminder from Mall Management regarding the rent payment for Shop #${shopNum}. Please ensure the payment is settled at your earliest convenience to avoid any late fees. \n\nThank you for your cooperation.`;
        break;
      case "renewal":
        message = `Dear ${tenantName}, \n\nWe hope this message finds you well. This is a reminder from Mall Management that your lease contract for Shop #${shopNum} is approaching its expiration date. Please contact the management office to discuss renewal options. \n\nBest regards.`;
        break;
      case "welcome":
        message = `Dear ${tenantName}, \n\nWelcome to the Mall! We are thrilled to have you as part of our business community at Shop #${shopNum}. If you need any assistance, please do not hesitate to contact the management office. \n\nBest of luck with your business!`;
        break;
      case "violation":
        message = `Dear ${tenantName}, \n\nThis is an official notice from Mall Management regarding Shop #${shopNum}. We have observed a violation of the mall's rules and regulations. Please rectify the issue immediately to avoid further action. \n\nFor more details, please visit the management office.`;
        break;
      default:
        message = `Dear ${tenantName}, \n\nMessage from Mall Management regarding Shop #${shopNum}.`;
    }

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    const anchor = document.createElement("a");
    anchor.href = whatsappUrl;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.click();
  };

  const handleSaveTermination = () => {
    if (
      !terminationForm.shop_id ||
      !terminationForm.termination_image ||
      !selectedShopForTermination
    )
      return;
    const s = selectedShopForTermination;
    erpStore.terminateMallContract({
      shop_id: s.id,
      shop_number: s.shop_number,
      shop_name: s.name_ar,
      tenant_name: s.tenant_name || "غير محدد",
      phone: s.phone || "",
      monthly_rent: s.monthly_rent,
      deposit_amount: s.contract?.deposit_amount || 0,
      refund_amount: Number(terminationForm.refund_amount) || 0,
      start_date: s.contract?.start_date || new Date().toISOString().split("T")[0],
      end_date: s.contract?.end_date || new Date().toISOString().split("T")[0],
      termination_date: new Date().toISOString().split("T")[0],
      contract_image: s.contract?.contract_image,
      termination_image: terminationForm.termination_image,
      notes: terminationForm.notes,
    });
    toast.success("تم فسخ العقد وأرشفته وتحديث حالة المحل إلى شاغر");
    setIsTerminationModalOpen(false);
    setTerminationForm({ shop_id: "", refund_amount: 0, termination_image: "", notes: "" });
  };

  const handleSelectShopForContract = (shopId: string) => {
    const s = shops.find((sh) => sh.id === shopId);
    if (s) {
      setContractForm({
        ...contractForm,
        shop_id: s.id,
        custom_shop_name: s.name_ar || "",
        custom_activity: s.activity_ar || "",
        tenant_name: s.tenant_name || "",
        phone: s.phone || "",
        monthly_rent: s.monthly_rent || 1000,
        deposit_amount: s.contract?.deposit_amount || s.monthly_rent || 1000,
        advance_payment: s.contract?.advance_payment || 0,
        nationality: s.contract?.nationality || "مصري / Egyptian",
        id_number: s.contract?.id_number || "",
        start_date: s.contract?.start_date || new Date().toISOString().split("T")[0],
        end_date:
          s.contract?.end_date ||
          new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        language: s.contract?.language || "ar",
        tenant_address: s.contract?.tenant_address || "",
        floor: s.contract?.floor || "",
        area: s.contract?.area || "",
        lease_term: s.contract?.lease_term || "",
        renewal_option: s.contract?.renewal_option || "",
        currency: s.contract?.currency || "USD",
        payment_due_date: s.contract?.payment_due_date || "",
        payment_method: s.contract?.payment_method || "",
        service_charge: s.contract?.service_charge || "",
        electricity_included: s.contract?.electricity_included || false,
        water_included: s.contract?.water_included || false,
        authorized_representative: s.contract?.authorized_representative || "",
      });
    } else {
      setContractForm({ ...contractForm, shop_id: shopId });
    }
  };

  const handleAddClause = () => {
    if (!contractForm.new_clause.trim()) return;
    const currentTerms = contractForm.terms.trim();
    const clausesCount = currentTerms ? currentTerms.split("\n").length + 1 : 1;
    const updatedTerms = currentTerms
      ? `${currentTerms}\n${clausesCount}. ${contractForm.new_clause.trim()}`
      : `1. ${contractForm.new_clause.trim()}`;
    setContractForm({ ...contractForm, terms: updatedTerms, new_clause: "" });
  };

  const handleLanguageChange = (lang: "ar" | "en") => {
    if (lang === "en") {
      setContractForm({
        ...contractForm,
        language: "en",
        nationality: "Egyptian",
        terms: `1. This contract is valid for the specified term and renews automatically upon mutual agreement.\n2. The tenant is committed to paying the rent no later than the 5th of each month.\n3. The tenant shall bear all electricity, water, and utility bills for the unit.\n4. The tenant has no right to assign or sublease the unit wholly or partially without prior written consent.\n5. In case of breach of any terms, management reserves the right to terminate and take legal action.`,
      });
    } else {
      setContractForm({
        ...contractForm,
        language: "ar",
        nationality: "مصري",
        terms: `1. يسري هذا العقد للمدة المحددة ويتجدد تلقائياً بموافقة الطرفين.\n2. يلتزم المستأجر بسداد القيمة الإيجارية في موعد أقصاه الخامس من كل شهر.\n3. يتحمل المستأجر كافة فواتير الكهرباء والمياه والخدمات الخاصة بالوحدة.\n4. لا يحق للمستأجر التنازل عن الوحدة أو تأجيرها من الباطن كلياً أو جزئياً دون موافقة كتابية مسبقةة.\n5. في حال الإخلال بأي من شروط العقد، يحق للإدارة فسخ العقد واتخاذ الإجراءات القانونية اللازمة.`,
      });
    }
  };

  const handleSaveContract = () => {
    if (!contractForm.shop_id || !contractForm.tenant_name) {
      return;
    }
    erpStore.createMallContract(contractForm.shop_id, {
      tenant_name: contractForm.tenant_name,
      phone: contractForm.phone,
      monthly_rent: contractForm.monthly_rent,
      status: "rented",
      contract: {
        start_date: contractForm.start_date,
        end_date: contractForm.end_date,
        deposit_amount: contractForm.deposit_amount,
        advance_payment: contractForm.advance_payment,
        nationality: contractForm.nationality,
        id_number: contractForm.id_number,
        terms: contractForm.terms,
        contract_image: contractForm.contract_image,
        id_image: contractForm.id_image,
        language: contractForm.language,
        created_at: new Date().toISOString(),

        authorized_representative: contractForm.authorized_representative,
        tenant_address: contractForm.tenant_address,
        floor: contractForm.floor,
        area: contractForm.area,
        lease_term: contractForm.lease_term,
        renewal_option: contractForm.renewal_option,
        currency: contractForm.currency,
        payment_due_date: contractForm.payment_due_date,
        payment_method: contractForm.payment_method,
        service_charge: contractForm.service_charge,
        electricity_included: contractForm.electricity_included,
        water_included: contractForm.water_included,
        other_charges: contractForm.other_charges,
        annual_escalation: contractForm.annual_escalation,
        fit_out_period: contractForm.fit_out_period,
        custom_shop_name: contractForm.custom_shop_name,
        custom_activity: contractForm.custom_activity,
      },
    });
    toast.success("تم حفظ العقد كسجل تعاقدي مستقل (تُسجل العمليات المالية من الإدارة المالية)");
    setIsContractModalOpen(false);
  };

  // Modal states for Payment
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    shop_id: "",
    year: 2026,
    month: new Date().getMonth() + 1,
    amount_due: 0,
    amount_paid: 0,
    status: "paid" as "paid" | "partial" | "unpaid",
    payment_date: new Date().toISOString().split("T")[0],
    payment_method: "bank_transfer",
    receipt_number: "",
    notes: "",
    treasury_account_id: "",
  });
  const [printingPaymentReceipt, setPrintingPaymentReceipt] = useState<{
    shop: MallShop;
    payment: {
      amount_paid: number;
      receipt_number: string;
      payment_date: string;
      payment_method: string;
      notes: string;
      month: number;
      year: number;
    };
  } | null>(null);

  // Modal states for Garden Revenue
  const [isRevenueModalOpen, setIsRevenueModalOpen] = useState(false);
  const [revenueForm, setRevenueForm] = useState({
    year: selectedYear,
    month: selectedMonth,
    category: "garden_ticket" as "garden_ticket" | "garden_event" | "parking" | "other",
    description: "",
    amount: 1000,
    date: new Date().toISOString().split("T")[0],
    receipt_number: `REC-G-${Math.floor(1000 + Math.random() * 9000)}`,
    notes: "",
    treasury_id: "",
  });
  const [revenueToDelete, setRevenueToDelete] = useState<MallGardenRevenue | null>(null);

  // Modal states for Garden/Mall Expense
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    year: selectedYear,
    month: selectedMonth,
    category: "maintenance" as
      "maintenance" | "electricity" | "water" | "security" | "cleaning" | "salary" | "other",
    title: "",
    amount: 500,
    date: new Date().toISOString().split("T")[0],
    paid_to: "",
    notes: "",
    treasury_id: "",
  });
  const [expenseToDelete, setExpenseToDelete] = useState<MallGardenExpense | null>(null);

  // KPI Calculations
  const totalShops = shops.length;
  const rentedShops = shops.filter((s) => s.status === "rented").length;
  const vacantShops = shops.filter((s) => s.status === "vacant").length;
  const maintenanceShops = shops.filter((s) => s.status === "maintenance").length;
  const totalMonthlyRentPotential = shops
    .filter((s) => s.status === "rented")
    .reduce((sum, s) => sum + s.monthly_rent, 0);

  // Current month payments statistics
  const currentMonthPayments = payments.filter(
    (p) => p.year === selectedYear && p.month === selectedMonth,
  );
  const totalCollectedThisMonth = currentMonthPayments.reduce((sum, p) => sum + p.amount_paid, 0);
  const totalDueThisMonth = shops
    .filter((s) => s.status === "rented")
    .reduce((sum, s) => sum + s.monthly_rent, 0);
  const collectionPercentage =
    totalDueThisMonth > 0 ? Math.round((totalCollectedThisMonth / totalDueThisMonth) * 100) : 0;

  // Mall Expenses month calculations
  const monthGardenExpenses = gardenExpenses.filter(
    (e) => e.year === selectedYear && e.month === selectedMonth,
  );
  const totalGardenExpenseMonth = monthGardenExpenses.reduce((sum, e) => sum + e.amount, 0);

  const netOperatingIncomeMonth = totalCollectedThisMonth - totalGardenExpenseMonth;

  const filteredShops = useMemo(() => {
    return shops.filter((s) => {
      const matchSearch =
        s.name_ar.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.shop_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.account_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.tenant_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = filterStatus === "all" || s.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [shops, searchQuery, filterStatus]);

  // Status Report Calculation
  const reportData = useMemo(() => {
    const reportYear = isNaN(new Date(reportDate).getTime())
      ? selectedYear
      : new Date(reportDate).getFullYear();
    const reportMonth = isNaN(new Date(reportDate).getTime())
      ? selectedMonth
      : new Date(reportDate).getMonth() + 1;

    const filteredReportShops =
      reportShopId === "all" ? shops : shops.filter((s) => s.id === reportShopId);

    const rows = filteredReportShops.map((shop) => {
      const isRented = shop.status === "rented";
      const tenant = isRented ? shop.tenant_name || "غير محدد" : "-";
      const contractDates =
        isRented && shop.contract
          ? `${shop.contract.start_date} إلى ${shop.contract.end_date}`
          : "-";

      const payment = payments.find(
        (p) => p.shop_id === shop.id && p.year === reportYear && p.month === reportMonth,
      );

      const monthlyRent = isRented ? shop.monthly_rent : 0;
      const amountPaid = payment ? payment.amount_paid : 0;
      const outstanding = isRented ? Math.max(0, monthlyRent - amountPaid) : 0;
      const statusText =
        shop.status === "rented" ? "مؤجر" : shop.status === "vacant" ? "فارغ" : "صيانة";

      let paymentDetails = "-";
      if (payment) {
        if (payment.status === "paid") {
          paymentDetails = `مسدد بالكامل (${payment.payment_method === "cash" ? "نقدي" : "تحويل"} - ${payment.payment_date || ""})`;
        } else if (payment.status === "partial") {
          paymentDetails = `مسدد جزئي $${payment.amount_paid} (${payment.payment_method === "cash" ? "نقدي" : "تحويل"})`;
        } else {
          paymentDetails = "غير مسدد";
        }
        if (payment.receipt_number) {
          paymentDetails += ` | إيصال: ${payment.receipt_number}`;
        }
      } else if (isRented) {
        paymentDetails = "لم يتم تسجيل دفعات لهذا الشهر";
      }

      const allShopPayments = payments.filter((p) => p.shop_id === shop.id);

      return {
        id: shop.id,
        shopNumber: shop.shop_number,
        shopName: shop.name_ar,
        accountNumber: shop.account_number,
        status: shop.status,
        statusText,
        tenant,
        contractDates,
        monthlyRent,
        amountPaid,
        outstanding,
        paymentDetails,
        allShopPayments,
        phone: shop.phone || "-",
        space: shop.space_sqm || 0,
        contractInfo: shop.contract,
      };
    });

    const totalRent = rows.reduce((acc, r) => acc + r.monthlyRent, 0);
    const totalPaid = rows.reduce((acc, r) => acc + r.amountPaid, 0);
    const totalOutstanding = rows.reduce((acc, r) => acc + r.outstanding, 0);

    return {
      rows,
      totalRent,
      totalPaid,
      totalOutstanding,
      reportYear,
      reportMonth,
    };
  }, [shops, payments, reportShopId, reportDate, selectedYear, selectedMonth]);

  const handlePrintStatusReport = () => {
    const isAll = reportShopId === "all";
    const shopSelected = reportShopId !== "all" ? shops.find((s) => s.id === reportShopId) : null;
    const shopNameSelected = shopSelected ? shopSelected.name_ar : "";
    const shopNumSelected = shopSelected ? shopSelected.shop_number : "";

    let contentHTML = "";

    if (isAll) {
      contentHTML = `
        <div style="direction: rtl; text-align: right; font-family: system-ui, -apple-system, sans-serif;">
          <div style="text-align: center; border-bottom: 2px solid #059669; padding-bottom: 15px; margin-bottom: 25px;">
            <h1 style="color: #047857; margin: 0; font-size: 24px; font-weight: 900;">تقرير حالة المول وعقود الإيجار العام</h1>
            <p style="color: #4b5563; margin: 5px 0 0 0; font-size: 14px; font-weight: bold;">لشهر: ${MONTHS_AR[reportData.reportMonth - 1]} ${reportData.reportYear} | تاريخ التقرير: ${new Date().toLocaleDateString("ar-EG")}</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 11px; text-align: right;">
            <thead>
              <tr style="background-color: #059669; color: white;">
                <th style="padding: 10px; border: 1px solid #ddd;">رقم المحل</th>
                <th style="padding: 10px; border: 1px solid #ddd;">النشاط والمستأجر</th>
                <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">الحالة</th>
                <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">الإيجار الشهري</th>
                <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">المدفوع للشهر</th>
                <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">المستحق/المتبقي</th>
                <th style="padding: 10px; border: 1px solid #ddd;">تفاصيل وتاريخ الدفع</th>
              </tr>
            </thead>
            <tbody>
              ${reportData.rows
                .map(
                  (row) => `
                <tr style="background-color: ${row.status !== "rented" ? "#f9fafb" : "white"}; border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; color: #111827;">#${row.shopNumber}</td>
                  <td style="padding: 10px; border: 1px solid #ddd;">
                    <div style="font-weight: bold; color: #111827;">${row.shopName}</div>
                    <div style="font-size: 11px; color: #6b7280;">${row.tenant}</div>
                  </td>
                  <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: bold; color: ${
                    row.status === "rented"
                      ? "#047857"
                      : row.status === "vacant"
                        ? "#b45309"
                        : "#b91c1c"
                  };">${row.statusText}</td>
                  <td style="padding: 10px; border: 1px solid #ddd; text-align: left; font-weight: bold; font-family: monospace;">$${row.monthlyRent.toLocaleString()}</td>
                  <td style="padding: 10px; border: 1px solid #ddd; text-align: left; color: #047857; font-weight: bold; font-family: monospace;">$${row.amountPaid.toLocaleString()}</td>
                  <td style="padding: 10px; border: 1px solid #ddd; text-align: left; color: ${row.outstanding > 0 ? "#b91c1c" : "#111827"}; font-weight: bold; font-family: monospace;">$${row.outstanding.toLocaleString()}</td>
                  <td style="padding: 10px; border: 1px solid #ddd; color: #4b5563; font-size: 11px;">${row.paymentDetails}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 20px; background-color: #f3f4f6; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; text-align: center; font-size: 13px;">
            <div>
              <span style="font-size: 12px; color: #4b5563; font-weight: bold;">إجمالي الإيجارات المطلوبة:</span>
              <h2 style="margin: 5px 0 0 0; color: #111827; font-family: monospace;">$${reportData.totalRent.toLocaleString()}</h2>
            </div>
            <div>
              <span style="font-size: 12px; color: #4b5563; font-weight: bold;">إجمالي المبالغ المحصلة:</span>
              <h2 style="margin: 5px 0 0 0; color: #047857; font-family: monospace;">$${reportData.totalPaid.toLocaleString()}</h2>
            </div>
            <div>
              <span style="font-size: 12px; color: #4b5563; font-weight: bold;">إجمالي المبالغ المتأخرة:</span>
              <h2 style="margin: 5px 0 0 0; color: #b91c1c; font-family: monospace;">$${reportData.totalOutstanding.toLocaleString()}</h2>
            </div>
          </div>

          <div style="margin-top: 50px; display: flex; justify-content: space-between; padding: 0 40px; font-size: 13px;">
            <div>
              <p>توقيع المسؤول المالي</p>
              <div style="border-bottom: 1px dotted #000; width: 150px; height: 30px;"></div>
            </div>
            <div>
              <p>توقيع مدير إدارة الأملاك</p>
              <div style="border-bottom: 1px dotted #000; width: 150px; height: 30px;"></div>
            </div>
          </div>
        </div>
      `;
    } else {
      const row = reportData.rows[0];
      if (!row) return;

      const contract = row.contractInfo;

      contentHTML = `
        <div style="direction: rtl; text-align: right; font-family: system-ui, -apple-system, sans-serif; padding: 10px;">
          <div style="text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 25px;">
            <h1 style="color: #0369a1; margin: 0; font-size: 22px; font-weight: 900;">تقرير حالة المحل ومتابعة الدفعات</h1>
            <p style="color: #4b5563; margin: 5px 0 0 0; font-size: 14px; font-weight: bold;">المحل رقم #${row.shopNumber} | النشاط: ${row.shopName}</p>
            <p style="color: #6b7280; margin: 2px 0 0 0; font-size: 11px;">تاريخ التقرير: ${new Date().toLocaleDateString("ar-EG")}</p>
          </div>

          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; font-size: 13px;">
            <div style="border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; background-color: #f8fafc;">
              <h3 style="margin-top: 0; color: #0369a1; border-bottom: 1px solid #ddd; padding-bottom: 5px; font-weight: bold;">البيانات العامة للوحدة</h3>
              <p><strong>رقم المحل:</strong> #${row.shopNumber}</p>
              <p><strong>اسم النشاط:</strong> ${row.shopName}</p>
              <p><strong>حساب الأستاذ العام:</strong> ${row.accountNumber}</p>
              <p><strong>مساحة المحل:</strong> ${row.space} م٢</p>
              <p><strong>الحالة الحالية:</strong> <span style="font-weight: bold; color: ${row.status === "rented" ? "#047857" : "#b91c1c"};">${row.statusText}</span></p>
            </div>

            <div style="border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; background-color: #f8fafc;">
              <h3 style="margin-top: 0; color: #0369a1; border-bottom: 1px solid #ddd; padding-bottom: 5px; font-weight: bold;">بيانات التعاقد والمستأجر</h3>
              <p><strong>اسم المستأجر:</strong> ${row.tenant}</p>
              <p><strong>هاتف المستأجر:</strong> ${row.phone}</p>
              <p><strong>فترة التعاقد:</strong> ${row.contractDates}</p>
              <p><strong>قيمة الإيجار الشهري:</strong> $${row.monthlyRent.toLocaleString()} USD</p>
              ${
                contract
                  ? `
                <p><strong>مبلغ التأمين:</strong> $${(contract.deposit_amount || 0).toLocaleString()} USD</p>
                <p><strong>شروط إضافية:</strong> ${contract.terms || "لا يوجد"}</p>
              `
                  : ""
              }
            </div>
          </div>

          <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 15px; margin-bottom: 30px; background-color: #f0f9ff; font-size: 13px;">
            <h3 style="margin-top: 0; color: #0369a1; font-weight: bold;">حالة السداد والالتزام للشهر المحدد (${MONTHS_AR[reportData.reportMonth - 1]} ${reportData.reportYear})</h3>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; text-align: center; margin-top: 10px;">
              <div>
                <span style="font-size: 12px; color: #4b5563;">الإيجار المستحق:</span>
                <h2 style="margin: 5px 0 0 0; color: #1e293b; font-family: monospace;">$${row.monthlyRent.toLocaleString()}</h2>
              </div>
              <div>
                <span style="font-size: 12px; color: #4b5563;">المبلغ المدفوع:</span>
                <h2 style="margin: 5px 0 0 0; color: #047857; font-family: monospace;">$${row.amountPaid.toLocaleString()}</h2>
              </div>
              <div>
                <span style="font-size: 12px; color: #4b5563;">القيمة المتبقية:</span>
                <h2 style="margin: 5px 0 0 0; color: ${row.outstanding > 0 ? "#b91c1c" : "#047857"}; font-family: monospace;">$${row.outstanding.toLocaleString()}</h2>
              </div>
            </div>
            <div style="margin-top: 12px; font-size: 12px; color: #4b5563; border-top: 1px solid #e2e8f0; padding-top: 8px;">
              <strong>تفاصيل السداد:</strong> ${row.paymentDetails}
            </div>
          </div>

          <h3 style="color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px; margin-top: 30px; font-weight: bold; font-size: 14px;">كشف الحساب التاريخي لجميع الدفعات المسجلة</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: right; margin-top: 10px;">
            <thead>
              <tr style="background-color: #0284c7; color: white;">
                <th style="padding: 8px; border: 1px solid #ddd;">السنة / الشهر</th>
                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">القيمة المستحقة</th>
                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">القيمة المسددة</th>
                <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">حالة السداد</th>
                <th style="padding: 8px; border: 1px solid #ddd;">رقم الإيصال</th>
                <th style="padding: 8px; border: 1px solid #ddd;">تاريخ الدفع</th>
                <th style="padding: 8px; border: 1px solid #ddd;">طريقة الدفع وملاحظات</th>
              </tr>
            </thead>
            <tbody>
              ${
                row.allShopPayments.length === 0
                  ? `
                <tr>
                  <td colspan="7" style="padding: 15px; border: 1px solid #ddd; text-align: center; color: #6b7280; font-style: italic;">لا توجد أي دفعات مسجلة مسبقاً لهذا المحل.</td>
                </tr>
              `
                  : row.allShopPayments
                      .map(
                        (p) => `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${p.year} / ${MONTHS_AR[p.month - 1]}</td>
                  <td style="padding: 8px; border: 1px solid #ddd; text-align: left; font-weight: bold; font-family: monospace;">$${(p.amount_due || row.monthlyRent).toLocaleString()}</td>
                  <td style="padding: 8px; border: 1px solid #ddd; text-align: left; color: #047857; font-weight: bold; font-family: monospace;">$${(p.amount_paid || 0).toLocaleString()}</td>
                  <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">
                    <span style="font-weight: bold; color: ${p.status === "paid" ? "#047857" : p.status === "partial" ? "#b45309" : "#b91c1c"};">
                      ${p.status === "paid" ? "مسدد بالكامل" : p.status === "partial" ? "جزئي" : "غير مسدد"}
                    </span>
                  </td>
                  <td style="padding: 8px; border: 1px solid #ddd; font-family: monospace;">${p.receipt_number || "-"}</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">${p.payment_date || "-"}</td>
                  <td style="padding: 8px; border: 1px solid #ddd; color: #4b5563; font-size: 11px;">${p.payment_method === "cash" ? "نقدي" : p.payment_method === "bank_transfer" ? "تحويل" : p.payment_method || "-"} ${p.notes ? `[${p.notes}]` : ""}</td>
                </tr>
              `,
                      )
                      .join("")
              }
            </tbody>
          </table>

          <div style="margin-top: 60px; display: flex; justify-content: space-between; padding: 0 40px; font-size: 13px;">
            <div>
              <p>توقيع المسؤول المالي</p>
              <div style="border-bottom: 1px dotted #000; width: 150px; height: 30px;"></div>
            </div>
            <div>
              <p>توقيع مدير إدارة الأملاك</p>
              <div style="border-bottom: 1px dotted #000; width: 150px; height: 30px;"></div>
            </div>
          </div>
        </div>
      `;
    }

    handlePrintHTML("تقرير حالة المول وعقود الإيجار", contentHTML);
  };

  const handleOpenAddShop = () => {
    setEditingShop(null);
    setShopForm({
      shop_number: `D${shops.length + 1}`,
      name_ar: "",
      account_number: `14030${shops.length + 100}`,
      tenant_name: "",
      phone: "-",
      monthly_rent: 500,
      status: "rented",
      space_sqm: 45,
      notes: "سنتر بوب",
      contract_image: "",
      id_image: "",
    });
    setIsShopModalOpen(true);
  };

  const handleOpenEditShop = (shop: MallShop) => {
    setEditingShop(shop);
    setShopForm({
      shop_number: shop.shop_number,
      name_ar: shop.name_ar,
      account_number: shop.account_number,
      tenant_name: shop.tenant_name,
      phone: shop.phone,
      monthly_rent: shop.monthly_rent,
      status: shop.status,
      space_sqm: shop.space_sqm || 40,
      notes: shop.notes || "",
      contract_image: shop.contract?.contract_image || "",
      id_image: shop.contract?.id_image || "",
      treasury_account_id: "",
    });
    setIsShopModalOpen(true);
  };

  const handleSaveShop = () => {
    if (!shopForm.name_ar || !shopForm.shop_number) return;
    const contractData =
      shopForm.contract_image || shopForm.id_image
        ? {
            start_date: editingShop?.contract?.start_date || new Date().toISOString().split("T")[0],
            end_date:
              editingShop?.contract?.end_date ||
              new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
            deposit_amount: editingShop?.contract?.deposit_amount || shopForm.monthly_rent,
            advance_payment: editingShop?.contract?.advance_payment || 0,
            nationality: editingShop?.contract?.nationality || "مصري",
            id_number: editingShop?.contract?.id_number || "",
            terms: editingShop?.contract?.terms || "",
            contract_image: shopForm.contract_image,
            id_image: shopForm.id_image,
            language: editingShop?.contract?.language || "ar",
            created_at: editingShop?.contract?.created_at || new Date().toISOString(),
          }
        : editingShop?.contract;

    const payload = {
      shop_number: shopForm.shop_number,
      name_ar: shopForm.name_ar,
      account_number: shopForm.account_number,
      tenant_name: shopForm.tenant_name,
      phone: shopForm.phone,
      monthly_rent: shopForm.monthly_rent,
      status: shopForm.status,
      space_sqm: shopForm.space_sqm,
      notes: shopForm.notes,
      contract: contractData,
      treasury_account_id: shopForm.treasury_account_id,
    };

    if (editingShop) {
      erpStore.updateMallShop(editingShop.id, payload);
    } else {
      erpStore.addMallShop(payload);
    }
    setIsShopModalOpen(false);
  };

  const handleOpenPayment = (shop: MallShop, monthNum?: number) => {
    const m = monthNum || selectedMonth;
    const existing = payments.find(
      (p) => p.shop_id === shop.id && p.year === selectedYear && p.month === m,
    );
    setPaymentForm({
      shop_id: shop.id,
      year: selectedYear,
      month: m,
      amount_due: shop.monthly_rent,
      amount_paid: existing ? existing.amount_paid : shop.monthly_rent,
      status: existing ? existing.status : "paid",
      payment_date: existing?.payment_date || new Date().toISOString().split("T")[0],
      payment_method: existing?.payment_method || "bank_transfer",
      receipt_number: existing?.receipt_number || `REC-${Math.floor(1000 + Math.random() * 9000)}`,
      notes: existing?.notes || "",
    });
    setIsPaymentModalOpen(true);
  };

  const handleSavePayment = () => {
    erpStore.recordMallPayment(paymentForm, paymentForm.treasury_account_id);
    setIsPaymentModalOpen(false);
  };

  const handleSaveAndPrintPayment = () => {
    erpStore.recordMallPayment(paymentForm, paymentForm.treasury_account_id);
    const shop = shops.find((s) => s.id === paymentForm.shop_id);
    if (shop) {
      setPrintingPaymentReceipt({
        shop,
        payment: { ...paymentForm },
      });
    }
    setIsPaymentModalOpen(false);
  };

  const handlePrintHTML = (title: string, contentHTML: string) => {
    const htmlDoc = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <style>
            @page { size: A4; margin: 12mm; }
            body {
              font-family: 'Cairo', 'Tajawal', system-ui, -apple-system, sans-serif;
              direction: rtl;
              text-align: right;
              padding: 24px;
              color: #111;
              background: #fff;
            }
            .print-container {
              max-width: 780px;
              margin: 0 auto;
              border: 1px solid #cbd5e1;
              padding: 24px;
              border-radius: 12px;
            }
            h2, h3, h4 { color: #0f172a; margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: right; }
            th { background: #f1f5f9; font-weight: bold; }
            .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 16px 0; }
            .font-bold { font-weight: bold; }
            .text-primary { color: #059669; }
            .border-b { border-bottom: 1px solid #cbd5e1; padding-bottom: 12px; }
            pre { white-space: pre-wrap; font-family: inherit; font-size: 11px; line-height: 1.6; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; }
            .signatures { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 32px; margin-top: 48px; text-align: center; }
            .sig-line { border-bottom: 1px dotted #64748b; margin-top: 48px; width: 160px; margin-left: auto; margin-right: auto; }
          </style>
        </head>
        <body>
          ${contentHTML}
        </body>
      </html>
    `;
    printRawHtml(htmlDoc);
  };

  const exportToExcel = (data: any[], fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "التقرير");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  const printPaymentReceipt = () => {
    if (!printingPaymentReceipt) return;
    const p = printingPaymentReceipt.payment;
    const s = printingPaymentReceipt.shop;
    const html = `
      <div class="print-container">
        <div class="border-b" style="text-align: center;">
          <h2>${p.amount_paid < 0 ? "سند صرف (رد دفعة / مقدم)" : "سند قبض إيجار ومستحقات"}</h2>
          <p style="font-size: 11px; color: #64748b;">مركز التسوق التجاري والحديقة الترفيهية - قسم الإدارة المالية</p>
        </div>
        <div class="grid" style="font-size: 12px; margin-top: 16px;">
          <div><strong>رقم السند:</strong> ${p.receipt_number}</div>
          <div><strong>التاريخ:</strong> ${p.payment_date}</div>
          <div><strong>اسم المستأجر:</strong> ${s.tenant_name || "غير محدد"}</div>
          <div><strong>المحل / الوحدة:</strong> #${s.shop_number} (${s.name_ar})</div>
          <div><strong>عن شهر:</strong> ${MONTHS_AR[p.month - 1]} ${p.year}</div>
          <div><strong>طريقة الدفع:</strong> ${p.payment_method === "cash" ? "نقدي بالخزينة" : p.payment_method === "bank_transfer" ? "تحويل بنكي" : "شيك بنكي"}</div>
        </div>
        <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; text-align: center; margin: 20px 0; border: 1px solid #e2e8f0;">
          <p style="font-size: 12px; margin-bottom: 4px;">${p.amount_paid < 0 ? "مبلغ وقدره (مرتجع):" : "مبلغ وقدره المحصل:"}</p>
          <h3 style="color: ${p.amount_paid < 0 ? "#dc2626" : "#059669"}; font-size: 24px; margin: 0;">$${Math.abs(p.amount_paid).toLocaleString()} USD</h3>
        </div>
        ${p.notes ? `<p><strong>ملاحظات:</strong> ${p.notes}</p>` : ""}
        <div class="signatures">
          <div>
            <p>توقيع المحصل / المسؤول</p>
            <div class="sig-line"></div>
          </div>
          <div>
            <p>توقيع المستلم / المستأجر</p>
            <div class="sig-line"></div>
          </div>
        </div>
      </div>
    `;
    handlePrintHTML(p.amount_paid < 0 ? "سند صرف" : "سند قبض", html);
  };

  const printContractContent = (form: any, shopNum: string) => {
    const isEn = form.language === "en";

    // Add page-footer CSS inside handlePrintHTML style
    const signatureHTML = isEn
      ? `
      <table style="width: 100%; text-align: left; font-size: 13px;">
        <tr>
          <td style="width: 50%; padding: 10px; vertical-align: top;">
            <strong>LANDLORD</strong><br><br>
            Name: Mall Management<br><br>
            Authorized Signatory: ........................<br><br>
            Signature: ...........................................<br><br>
            Date: ..................................................
          </td>
          <td style="width: 50%; padding: 10px; vertical-align: top;">
            <strong>TENANT</strong><br><br>
            Name: ${form.tenant_name || "........................"}<br><br>
            Authorized Signatory: ........................<br><br>
            Signature: ...........................................<br><br>
            Date: ..................................................
          </td>
        </tr>
      </table>
    `
      : `
      <table style="width: 100%; text-align: right; font-size: 13px;">
        <tr>
          <td style="width: 50%; padding: 10px; vertical-align: top;">
            <strong>المؤجر</strong><br><br>
            إدارة المول<br><br>
            الممثل المفوض: ........................<br><br>
            التوقيع: ...........................................<br><br>
            التاريخ: ..................................................
          </td>
          <td style="width: 50%; padding: 10px; vertical-align: top;">
            <strong>المستأجر</strong><br><br>
            الاسم: ${form.tenant_name || "........................"}<br><br>
            الممثل المفوض: ........................<br><br>
            التوقيع: ...........................................<br><br>
            التاريخ: ..................................................
          </td>
        </tr>
      </table>
    `;

    // To make signature appear on every page, we can use a repeating footer
    // with CSS page margins, or simply just output it normally in print.
    // CSS trick for repeating footer in print:
    // thead / tfoot inside a table will repeat on every page if it spans multiple pages.
    // So we wrap the entire content in a table.

    let html = `
      <style>
        .contract-table {
          width: 100%;
          border: none;
        }
        .contract-table thead, .contract-table tfoot {
          display: table-row-group;
        }
        @media print {
          .contract-table thead {
             display: table-header-group;
          }
          .contract-table tfoot {
             display: table-footer-group;
          }
        }
        .contract-doc p { margin-bottom: 6px; }
      </style>
      <table class="contract-table">
        <thead>
          <tr><td></td></tr> <!-- Empty header if needed -->
        </thead>
        <tbody>
          <tr>
            <td>
    `;

    if (isEn) {
      html += `
        <div class="print-container contract-doc" style="direction: ltr; text-align: left; font-size: 13px; line-height: 1.6; max-width: 800px; margin: 0 auto; color: #000;">
          <h2 style="text-align: center; font-size: 18px; margin-bottom: 5px; text-transform: uppercase;">COMMERCIAL SHOP LEASE AGREEMENT</h2>
          <h3 style="text-align: center; font-size: 14px; margin-top: 0; color: #444;">Mall Management, the Republic of South Sudan</h3>
          
          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">1. PARTIES</h4>
          <p><strong>Landlord:</strong> Mall Management, the Republic of South Sudan.</p>
          <p><strong>Authorized Representative:</strong> ${form.authorized_representative || "........................................................................"}</p>
          <p><strong>Tenant:</strong> ${form.tenant_name || "........................................................................"}</p>
          <p><strong>ID/Registration No.:</strong> ${form.id_number || "........................................................................"}</p>
          <p><strong>Address:</strong> ${form.tenant_address || "........................................................................"}</p>
          <p><strong>Telephone/Email:</strong> ${form.phone || "........................................................................"}</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">2. PREMISES</h4>
          <p><strong>Shop No.:</strong> ${shopNum} (${form.custom_shop_name}) &nbsp;&nbsp;&nbsp;&nbsp; <strong>Floor:</strong> ${form.floor || "........................"} &nbsp;&nbsp;&nbsp;&nbsp; <strong>Approximate Area:</strong> ${form.area || "........................"} square metres</p>
          <p><strong>Permitted Business:</strong> ${form.custom_activity || "........................................................................"}</p>
          <p>The Premises shall be used only for the commercial purpose stated in this Agreement. The Tenant shall not use the Premises for any other activity without the required prior written approval of Mall Management and in compliance with the laws and regulations of the Republic of South Sudan.</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">3. TERM</h4>
          <p><strong>Commencement Date:</strong> ${form.start_date || ".... / .... / ........"}</p>
          <p><strong>Expiry Date:</strong> ${form.end_date || ".... / .... / ........"}</p>
          <p><strong>Lease Term:</strong> ${form.lease_term || "........................................................"}</p>
          <p><strong>Renewal option, if any:</strong> ${form.renewal_option || "........................................................"}</p>
          <p>Any renewal shall be effective only under a written agreement signed by both Parties.</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">4. RENT, CURRENCY AND PAYMENT</h4>
          <p><strong>Monthly Rent:</strong> ${form.monthly_rent} ${form.currency}</p>
          <p><strong>Annual Rent:</strong> ${form.monthly_rent * 12} ${form.currency}</p>
          <p><strong>Agreed Currency:</strong> ${form.currency === "USD" ? "[ X ] United States Dollars (USD) &nbsp;&nbsp;&nbsp; [ ] South Sudanese Pounds (SSP)" : "[ ] United States Dollars (USD) &nbsp;&nbsp;&nbsp; [ X ] South Sudanese Pounds (SSP)"}</p>
          <p>If the Rent is denominated in USD and may be paid in SSP, the applicable exchange rate, source and date shall be:<br>................................................................................................................................................</p>
          <p><strong>Payment Due Date:</strong> ${form.payment_due_date || "........................................................"}</p>
          <p><strong>Payment Method:</strong> ${form.payment_method || "........................................................"}</p>
          <p>The currency or method of calculating the Rent shall not be changed except by written agreement between the Parties.</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">5. SECURITY DEPOSIT</h4>
          <p><strong>Security Deposit:</strong> ${form.deposit_amount} ${form.currency}</p>
          <p>The Security Deposit shall secure the Tenant’s performance of its obligations under this Agreement. To the extent permitted by law, the Landlord may apply the deposit toward unpaid Rent or charges, the cost of repairing damage for which the Tenant is responsible, or other amounts due under this Agreement, with an accounting of deductions.<br>Any remaining balance shall be returned after expiry or lawful termination, handover of the Premises, and settlement of all outstanding obligations.</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">6. SERVICE CHARGES AND UTILITIES</h4>
          <p><strong>Service Charge:</strong> ${form.service_charge || "........................................ [monthly / annually]"}</p>
          <p><strong>Electricity:</strong> ${form.electricity_included ? "[ X ] included in Rent &nbsp;&nbsp; [ ] separately metered/billed" : "[ ] included in Rent &nbsp;&nbsp; [ X ] separately metered/billed"}</p>
          <p><strong>Water:</strong> ${form.water_included ? "[ X ] included in Rent &nbsp;&nbsp; [ ] separately billed" : "[ ] included in Rent &nbsp;&nbsp; [ X ] separately billed"}</p>
          <p><strong>Other Charges:</strong> ${form.other_charges || "........................................................................................"}</p>
          <p>The Tenant shall pay all service charges and utility costs allocated to it under this Agreement when due.</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">7. FIT-OUT AND ALTERATIONS</h4>
          <p>The Tenant shall not carry out structural works, alterations, installations, signage, or fit-out works without the prior written approval of Mall Management and any governmental approvals required by law.<br>All works shall comply with applicable safety requirements, technical specifications, and Mall standards.</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">8. MAINTENANCE AND REPAIRS</h4>
          <p>The Tenant shall keep the Premises clean, safe, and in good condition and shall bear the cost of repairing damage caused by the Tenant or its employees, contractors, customers, or invitees.<br>Mall Management shall be responsible for common areas and matters expressly allocated to it under this Agreement.</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">9. MALL RULES</h4>
          <p>The Tenant shall comply with reasonable Mall rules concerning opening hours, security, safety, deliveries, storage, waste disposal, noise, signage, parking, fire safety, and use of common areas.<br>The Tenant shall be notified of material Mall rules and material amendments to them.</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">10. LICENCES AND LEGAL COMPLIANCE</h4>
          <p>The Tenant shall obtain and maintain all licences, registrations, permits, approvals, and tax registrations required for its business.<br>The Landlord shall reasonably cooperate where its documents or consent are legally required for such procedures.</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">11. INSURANCE AND LIABILITY</h4>
          <p>Where required by law or appropriate to the nature of the business, the Tenant shall maintain suitable commercial insurance for its business and property.<br>Each Party shall be responsible for loss or damage caused by its negligence, wilful misconduct, or breach of this Agreement, to the extent permitted by applicable law.</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">12. ASSIGNMENT AND SUBLETTING</h4>
          <p>The Tenant shall not assign this Agreement, transfer its rights or obligations, sublet the Premises, or permit a third party to occupy or use the Premises without the Landlord’s prior written consent, unless otherwise agreed in writing.</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">13. DEFAULT AND LATE PAYMENT</h4>
          <p>If the Tenant fails to pay Rent or other amounts when due, or materially breaches its obligations, the Landlord may issue written notice specifying the breach and, where required or appropriate under the Agreement or applicable law, provide a reasonable period to remedy it.<br>Termination or recovery of possession shall be carried out only in accordance with this Agreement and the laws of the Republic of South Sudan.</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">14. EXPIRY, TERMINATION AND HANDOVER</h4>
          <p>Upon expiry or lawful termination, the Tenant shall vacate and hand over the Premises to the Landlord, including keys and Landlord-owned fixtures, in the agreed condition, subject to fair wear and tear.<br>The Tenant shall also settle all amounts due up to the date of handover.</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">15. FORCE MAJEURE</h4>
          <p>Neither Party shall be liable for delay or failure caused by an event beyond its reasonable control, to the extent recognized by applicable law.<br>The affected Party shall notify the other Party as soon as reasonably practicable and take reasonable steps to mitigate the effects.</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">16. NOTICES</h4>
          <p>All notices under this Agreement shall be in writing and delivered by hand, courier, registered mail, or an electronic means agreed by the Parties to the addresses stated in this Agreement, unless a Party has notified the other in writing of a change of address or contact method.</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">17. GOVERNING LAW AND DISPUTE RESOLUTION</h4>
          <p>This Agreement shall be governed by the laws of the Republic of South Sudan.<br>The Parties shall first attempt in good faith to resolve any dispute arising out of or in connection with this Agreement amicably.<br>If an amicable settlement cannot be reached, the dispute shall be submitted to the competent court or another legally agreed dispute-resolution forum in the Republic of South Sudan.</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">18. ENTIRE AGREEMENT AND AMENDMENTS</h4>
          <p>This Agreement, the Commercial Schedule, and any signed annexes constitute the entire agreement between the Parties concerning the Premises.<br>No amendment, addition, or waiver shall be effective unless made in writing and signed by both Parties.</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">19. LANGUAGE</h4>
          <p>This Agreement is executed in Arabic and English, and both texts are intended to express the same agreement.<br>In the event of inconsistency, the controlling language shall be:<br>[ ] Arabic [ ] English [ X ] Both equally, subject to applicable law.</p>

          <div style="page-break-before: always; margin-top: 20px;"></div>

          <h3 style="text-align: center; font-size: 16px; margin-bottom: 20px; text-transform: uppercase;">COMMERCIAL SCHEDULE</h3>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px;">
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Shop No.:</strong> ${shopNum}</td>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Floor:</strong> ${form.floor || ".........."}</td>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Area:</strong> ${form.area || ".........."} m²</td>
            </tr>
            <tr>
              <td colspan="3" style="padding: 8px; border: 1px solid #ddd;"><strong>Business:</strong> ${form.custom_activity || "........................................................"}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;" colspan="2"><strong>Commencement:</strong> ${form.start_date || "..../..../........"}</td>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Expiry:</strong> ${form.end_date || "..../..../........"}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;" colspan="2"><strong>Rent:</strong> ${form.monthly_rent} ${form.currency}</td>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Security Deposit:</strong> ${form.deposit_amount} ${form.currency}</td>
            </tr>
            <tr>
              <td colspan="3" style="padding: 8px; border: 1px solid #ddd;"><strong>Exchange Rate:</strong> ........................................................................</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;" colspan="2"><strong>Service Charge:</strong> ${form.service_charge || ".........."} [USD / SSP]</td>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Annual Escalation:</strong> ${form.annual_escalation || ".........."} %</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;" colspan="2"><strong>Fit-out Period:</strong> ${form.fit_out_period || ".........."} days</td>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Payment Method:</strong> ${form.payment_method || "...................................."}</td>
            </tr>
            <tr>
              <td colspan="3" style="padding: 8px; border: 1px solid #ddd;">
                <strong>Special Conditions:</strong>
                <p style="white-space: pre-wrap; margin-top: 5px;">${form.terms}</p>
              </td>
            </tr>
          </table>

        </div>
      `;
    } else {
      html += `
        <div class="print-container contract-doc" style="direction: rtl; text-align: right; font-size: 13px; line-height: 1.6; max-width: 800px; margin: 0 auto; color: #000;">
          <h2 style="text-align: center; font-size: 18px; margin-bottom: 5px;">عقد إيجار محل تجاري</h2>
          <h3 style="text-align: center; font-size: 14px; margin-top: 0; color: #444;">إدارة المول – Mall Management</h3>
          
          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">1. أطراف العقد</h4>
          <p><strong>المؤجر:</strong> إدارة المول – Mall Management، جمهورية جنوب السودان.</p>
          <p><strong>العنوان:</strong> ........................................................................</p>
          <p><strong>الممثل المفوض:</strong> ${form.authorized_representative || "........................................................................"}</p>
          <p><strong>المستأجر:</strong> ${form.tenant_name || "........................................................................"}</p>
          <p><strong>رقم الهوية/التسجيل:</strong> ${form.id_number || "........................................................................"}</p>
          <p><strong>العنوان:</strong> ${form.tenant_address || "........................................................................"}</p>
          <p><strong>الهاتف/البريد الإلكتروني:</strong> ${form.phone || "........................................................................"}</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">2. العين المؤجرة</h4>
          <p><strong>رقم المحل:</strong> ${shopNum} (${form.custom_shop_name}) &nbsp;&nbsp;&nbsp;&nbsp; <strong>الطابق:</strong> ${form.floor || "........................"} &nbsp;&nbsp;&nbsp;&nbsp; <strong>المساحة التقريبية:</strong> ${form.area || "........................"} متر مربع</p>
          <p><strong>النشاط المصرح به:</strong> ${form.custom_activity || "........................................................................"}</p>
          <p>يُؤجر المحل للغرض التجاري المبين في هذا العقد، ولا يجوز استخدامه في أي نشاط آخر إلا بعد الحصول على الموافقة الكتابية اللازمة من إدارة المول، وبما لا يخالف القوانين واللوائح المعمول بها في جمهورية جنوب السودان.</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">3. مدة الإيجار</h4>
          <p><strong>تاريخ بدء الإيجار:</strong> ${form.start_date || ".... / .... / ........"}</p>
          <p><strong>تاريخ انتهاء الإيجار:</strong> ${form.end_date || ".... / .... / ........"}</p>
          <p><strong>مدة الإيجار:</strong> ${form.lease_term || "........................................................"}</p>
          <p><strong>خيار التجديد، إن وجد:</strong> ${form.renewal_option || "........................................................"}</p>
          <p>لا يكون أي تجديد نافذًا إلا بموجب اتفاق كتابي موقع من الطرفين.</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">4. الأجرة والعملة وطريقة السداد</h4>
          <p><strong>الأجرة الشهرية:</strong> ${form.monthly_rent} ${form.currency}</p>
          <p><strong>الأجرة السنوية:</strong> ${form.monthly_rent * 12} ${form.currency}</p>
          <p><strong>العملة المتفق عليها:</strong> ${form.currency === "USD" ? "[ X ] الدولار الأمريكي (USD) &nbsp;&nbsp;&nbsp; [ ] الجنيه الجنوب سوداني (SSP)" : "[ ] الدولار الأمريكي (USD) &nbsp;&nbsp;&nbsp; [ X ] الجنيه الجنوب سوداني (SSP)"}</p>
          <p>إذا كانت الأجرة محددة بالدولار الأمريكي ويُسمح بسدادها بالجنيه الجنوب سوداني، يكون سعر الصرف المعتمد ومصدره وتاريخ احتسابه كما يلي:<br>................................................................................................................................................</p>
          <p><strong>تاريخ استحقاق السداد:</strong> ${form.payment_due_date || "........................................................"}</p>
          <p><strong>طريقة السداد:</strong> ${form.payment_method || "........................................................"}</p>
          <p>لا يجوز تغيير العملة أو طريقة احتساب الأجرة إلا باتفاق كتابي بين الطرفين.</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">5. مبلغ التأمين</h4>
          <p><strong>مبلغ التأمين:</strong> ${form.deposit_amount} ${form.currency}</p>
          <p>يُدفع مبلغ التأمين ضمانًا لتنفيذ المستأجر لالتزاماته بموجب هذا العقد. ويجوز للمؤجر، في حدود ما يسمح به القانون، استخدام جزء من مبلغ التأمين لتغطية الإيجارات أو الرسوم غير المسددة أو تكاليف إصلاح الأضرار التي تقع على عاتق المستأجر أو أي مبالغ أخرى مستحقة بموجب العقد، مع تقديم بيان بالمبالغ المخصومة.<br>يُرد الرصيد المتبقي من مبلغ التأمين، إن وجد، بعد انتهاء العقد وتسليم المحل وتسوية جميع الالتزامات المستحقة.</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">6. رسوم الخدمات والمرافق</h4>
          <p><strong>رسوم الخدمات:</strong> ${form.service_charge || "........................................ [شهريًا / سنويًا]"}</p>
          <p><strong>الكهرباء:</strong> ${form.electricity_included ? "[ X ] مشمولة في الأجرة &nbsp;&nbsp; [ ] تُحسب وتُدفع بشكل منفصل" : "[ ] مشمولة في الأجرة &nbsp;&nbsp; [ X ] تُحسب وتُدفع بشكل منفصل"}</p>
          <p><strong>المياه:</strong> ${form.water_included ? "[ X ] مشمولة في الأجرة &nbsp;&nbsp; [ ] تُحسب وتُدفع بشكل منفصل" : "[ ] مشمولة في الأجرة &nbsp;&nbsp; [ X ] تُحسب وتُدفع بشكل منفصل"}</p>
          <p><strong>رسوم أخرى:</strong> ${form.other_charges || "........................................................................................"}</p>
          <p>يلتزم المستأجر بسداد جميع رسوم الخدمات والمرافق التي تقع على عاتقه وفقًا لهذا العقد وفي مواعيد استحقاقها.</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">7. أعمال التجهيز والتعديلات</h4>
          <p>لا يجوز للمستأجر تنفيذ أي أعمال إنشائية أو تغييرات أو تركيبات أو لافتات أو أعمال تشطيب وتجهيز داخل المحل إلا بعد الحصول على موافقة كتابية مسبقة من إدارة المول، وعلى أي موافقات حكومية تكون مطلوبة قانونًا.<br>ويجب تنفيذ جميع الأعمال وفق متطلبات السلامة والمواصفات الفنية واللوائح المعتمدة من إدارة المول.</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">8. الصيانة والإصلاحات</h4>
          <p>يلتزم المستأجر بالمحافظة على المحل نظيفًا وسليمًا وصالحًا للاستعمال، ويتحمل تكلفة إصلاح الأضرار الناتجة عن فعله أو إهماله أو فعل موظفيه أو مقاوليه أو عملائه أو زواره.<br>وتتولى إدارة المول مسؤولية المناطق المشتركة والأعمال التي يحددها هذا العقد صراحةً على أنها من مسؤوليتها.</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">9. لوائح المول</h4>
          <p>يلتزم المستأجر بجميع اللوائح المعقولة التي تضعها إدارة المول والمتعلقة بمواعيد العمل والأمن والسلامة والتوريد والتخزين والتخلص من النفايات والضوضاء واللافتات ومواقف السيارات والسلامة من الحريق واستخدام المناطق المشتركة.<br>ويشترط أن يتم إبلاغ المستأجر بأي لوائح أو تعديلات جوهرية عليها.</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">10. التراخيص والامتثال للقانون</h4>
          <p>يتحمل المستأجر مسؤولية الحصول على جميع التراخيص والتسجيلات والتصاريح والموافقات اللازمة لممارسة نشاطه والمحافظة على سريانها، بما في ذلك أي تسجيلات أو التزامات ضريبية مطلوبة قانونًا.<br>ويلتزم المؤجر، في حدود المعقول، بالتعاون مع المستأجر عندما تكون مستنداته أو موافقته مطلوبة بصورة قانونية لإتمام تلك الإجراءات.</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">11. التأمين والمسؤولية</h4>
          <p>يلتزم المستأجر، متى كان ذلك مطلوبًا قانونًا أو مناسبًا لطبيعة نشاطه، بالحصول على التأمينات التجارية المناسبة لممتلكاته ونشاطه.<br>ويتحمل كل طرف المسؤولية عن الخسائر أو الأضرار الناتجة عن إهماله أو سوء سلوكه العمدي أو إخلاله بهذا العقد، وذلك في حدود ما يسمح به القانون المعمول به.</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">12. التنازل والتأجير من الباطن</h4>
          <p>لا يجوز للمستأجر التنازل عن هذا العقد أو نقل حقوقه أو التزاماته أو تأجير المحل من الباطن أو تمكين الغير من الانتفاع به، إلا بعد الحصول على موافقة كتابية مسبقة من المؤجر، ما لم يتفق الطرفان كتابةً على خلاف ذلك.</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">13. الإخلال والتأخر في السداد</h4>
          <p>إذا تأخر المستأجر في سداد الأجرة أو أي مبالغ مستحقة، أو ارتكب إخلالًا جوهريًا بأي من التزاماته، يجوز للمؤجر توجيه إخطار كتابي يحدد طبيعة الإخلال، ومنح مهلة لمعالجة الإخلال متى كان ذلك مطلوبًا أو مناسبًا وفقًا للعقد والقانون.<br>ولا يجوز إنهاء العقد أو استرداد الحيازة إلا وفقًا لأحكام هذا العقد والقوانين المعمول بها في جمهورية جنوب السودان.</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">14. انتهاء العقد والتسليم</h4>
          <p>عند انتهاء مدة العقد أو إنهائه بصورة قانونية، يلتزم المستأجر بإخلاء المحل وتسليمه إلى المؤجر، مع تسليم المفاتيح والتجهيزات المملوكة للمؤجر، بالحالة المتفق عليها مع مراعاة الاستهلاك الطبيعي الناتج عن الاستعمال المعتاد.<br>كما يلتزم المستأجر بتسوية جميع المبالغ المستحقة عليه حتى تاريخ التسليم.</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">15. القوة القاهرة</h4>
          <p>لا يكون أي من الطرفين مسؤولًا عن التأخير أو عدم التنفيذ الناجم عن حدث خارج عن سيطرته المعقولة، بالقدر الذي يعترف به القانون المعمول به.<br>ويلتزم الطرف المتأثر بإخطار الطرف الآخر في أقرب وقت ممكن واتخاذ الإجراءات المعقولة للحد من آثار الحدث.</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">16. الإخطارات</h4>
          <p>تكون جميع الإخطارات المتعلقة بهذا العقد مكتوبة، وتسلم باليد أو بواسطة البريد السريع أو البريد المسجل أو وسيلة إلكترونية يتفق عليها الطرفان، إلى العناوين المبينة في هذا العقد، ما لم يُخطر أحد الطرفين الطرف الآخر كتابيًا بتغيير عنوانه أو وسيلة الاتصال المعتمدة.</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">17. القانون الواجب التطبيق وتسوية النزاعات</h4>
          <p>يخضع هذا العقد لقوانين جمهورية جنوب السودان.<br>يسعى الطرفان أولًا وبحسن نية إلى تسوية أي نزاع أو خلاف ينشأ عن هذا العقد أو يتعلق به تسوية ودية.<br>وفي حال تعذر التوصل إلى تسوية ودية، يُحال النزاع إلى المحكمة المختصة أو إلى وسيلة أخرى لتسوية النزاعات يتفق عليها الطرفان بصورة قانونية في جمهورية جنوب السودان.</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">18. كامل الاتفاق والتعديلات</h4>
          <p>يمثل هذا العقد وجدول البيانات التجارية وأي ملاحق موقعة من الطرفين كامل الاتفاق بينهما بشأن المحل.<br>ولا يكون أي تعديل أو إضافة أو تنازل عن أي حكم من أحكام العقد نافذًا إلا إذا كان مكتوبًا وموقعًا من الطرفين.</p>

          <h4 style="font-size: 14px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">19. اللغة</h4>
          <p>حُرر هذا العقد باللغتين العربية والإنجليزية، ويقصد بالنصين التعبير عن الاتفاق ذاته.<br>اللغة المعتمدة في حال وجود تعارض بين النصين:<br>[ ] العربية [ ] الإنجليزية [ X ] كلتاهما بالتساوي، وذلك مع مراعاة أحكام القانون المعمول به.</p>

          <div style="page-break-before: always; margin-top: 20px;"></div>

          <h3 style="text-align: center; font-size: 16px; margin-bottom: 20px;">جدول البيانات التجارية</h3>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px;">
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>رقم المحل:</strong> ${shopNum}</td>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>الطابق:</strong> ${form.floor || ".........."}</td>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>المساحة:</strong> ${form.area || ".........."} متر مربع</td>
            </tr>
            <tr>
              <td colspan="3" style="padding: 8px; border: 1px solid #ddd;"><strong>النشاط:</strong> ${form.custom_activity || "........................................................"}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;" colspan="2"><strong>تاريخ البداية:</strong> ${form.start_date || "..../..../........"}</td>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>تاريخ الانتهاء:</strong> ${form.end_date || "..../..../........"}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;" colspan="2"><strong>الإيجار:</strong> ${form.monthly_rent} ${form.currency}</td>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>مبلغ التأمين:</strong> ${form.deposit_amount} ${form.currency}</td>
            </tr>
            <tr>
              <td colspan="3" style="padding: 8px; border: 1px solid #ddd;"><strong>سعر الصرف:</strong> ........................................................................</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;" colspan="2"><strong>رسوم الخدمات:</strong> ${form.service_charge || ".........."} [USD / SSP]</td>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>الزيادة السنوية:</strong> ${form.annual_escalation || ".........."} %</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;" colspan="2"><strong>فترة التجهيز:</strong> ${form.fit_out_period || ".........."} يومًا</td>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>طريقة السداد:</strong> ${form.payment_method || "...................................."}</td>
            </tr>
            <tr>
              <td colspan="3" style="padding: 8px; border: 1px solid #ddd;">
                <strong>الشروط الخاصة:</strong>
                <p style="white-space: pre-wrap; margin-top: 5px;">${form.terms}</p>
              </td>
            </tr>
          </table>

        </div>
      `;
    }

    if (form.id_image) {
      html += `
        <div class="print-container" style="page-break-before: always; margin-top: 30px; text-align: center; direction: ${isEn ? "ltr" : "rtl"};">
          <h3 style="margin-bottom: 12px; font-size: 16px;">${isEn ? "Tenant ID / Passport" : "صورة الهوية / جواز السفر"}</h3>
          <img src="${form.id_image}" style="max-width: 100%; max-height: 700px; object-fit: contain; border: 1px solid #cbd5e1; border-radius: 8px;" />
        </div>
      `;
    }

    // Close the table and add the repeating tfoot
    html += `
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td>
              <div style="height: 20px;"></div> <!-- Spacer -->
              ${signatureHTML}
            </td>
          </tr>
        </tfoot>
      </table>
    `;

    handlePrintHTML(isEn ? "Lease Contract" : "عقد الإيجار", html);
  };

  const handleSaveRevenue = () => {
    if (!revenueForm.description || revenueForm.amount <= 0) return;
    erpStore.addMallGardenRevenue({
      ...revenueForm,
      year: selectedYear,
      month: selectedMonth,
    });
    setIsRevenueModalOpen(false);
  };

  const handleSaveExpense = () => {
    if (!expenseForm.title || expenseForm.amount <= 0) return;
    erpStore.addMallGardenExpense({
      ...expenseForm,
      year: selectedYear,
      month: selectedMonth,
    });
    setIsExpenseModalOpen(false);
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto pb-12" dir="rtl">
      {/* Compact Single-Row Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/12 text-blue-600 dark:text-blue-400 border border-blue-500/25">
              <Building2 size={18} />
            </div>
            <h1 className="text-lg sm:text-xl font-black text-foreground">إدارة المول</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <ViewModeToggle mode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {/* SECTION 1: DEFINITIONS (التعريفات - دليل المحلات والوحدات التجارية) */}
      {activeTab === "definitions" && !isMallSubpageOpen && (
        <div
          className={
            viewMode === "grid"
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-200"
              : "space-y-3 animate-in fade-in duration-200"
          }
        >
          <Card
            onClick={() => openMallSubpage("shops")}
            className="group cursor-pointer rounded-2xl border border-border/80 bg-card p-5 hover:border-primary/50 hover:shadow-md transition flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3.5">
              <div className="rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 p-3">
                <Building2 size={22} />
              </div>
              <h3 className="font-black text-base text-foreground group-hover:text-primary transition-colors">
                دليل المحلات والوحدات التجارية
              </h3>
            </div>
            <Badge variant="secondary" className="font-bold">
              {totalShops} وحدة
            </Badge>
          </Card>
        </div>
      )}

      {activeTab === "definitions" && isMallSubpageOpen && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4 bg-card p-4 rounded-2xl border border-border">
            <div className="relative w-full lg:w-80">
              <Search className="absolute right-3 top-2.5 text-muted-foreground" size={18} />
              <Input
                placeholder="بحث برقم المحل، اسم النشاط، أو المستأجر..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10 rounded-xl"
              />
            </div>
            <div className="flex items-center gap-3 w-full lg:w-auto justify-end flex-wrap">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px] rounded-xl font-bold">
                  <SelectValue placeholder="حالة المحل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات ({totalShops})</SelectItem>
                  <SelectItem value="rented">مؤجر ({rentedShops})</SelectItem>
                  <SelectItem value="vacant">فارغ ({vacantShops})</SelectItem>
                  <SelectItem value="maintenance">صيانة ({maintenanceShops})</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="save"
                onClick={handleOpenAddShop}
                className="font-bold gap-1.5 rounded-xl text-xs h-10 cursor-pointer"
              >
                <Plus size={15} />
                إضافة محل جديد
              </Button>
              <Button
                onClick={() => erpStore.resetMallData()}
                variant="edit"
                className="font-bold gap-2 rounded-xl text-xs h-10 cursor-pointer"
              >
                <Building2 size={15} />
                تحديث المحلات (51 محل)
              </Button>
            </div>
          </div>

          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredShops.map((shop) => (
                <Card
                  key={shop.id}
                  className="border border-border/80 bg-card rounded-2xl shadow-xs hover:shadow-md transition flex flex-col justify-between overflow-hidden"
                >
                  <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20">
                        محل #{shop.shop_number}
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                          shop.status === "rented"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : shop.status === "vacant"
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                              : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                        }`}
                      >
                        {shop.status === "rented"
                          ? "مؤجر"
                          : shop.status === "vacant"
                            ? "فارغ"
                            : "صيانة"}
                      </span>
                    </div>
                    <CardTitle className="text-base font-black text-foreground mt-2 line-clamp-1">
                      {shop.name_ar}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="py-4 space-y-2.5 flex-1 text-xs">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User size={14} /> المستأجر:
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setReportShopId(shop.id);
                          setIsStatusReportModalOpen(true);
                        }}
                        className="app-link underline font-black text-indigo-600 dark:text-indigo-400 cursor-pointer"
                        title="اضغط لعرض كشف حساب المستأجر والدفعات"
                      >
                        {shop.tenant_name || "غير محدد"} (#{shop.account_number})
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Phone size={14} /> الهاتف:
                      </span>
                      <span className="font-bold text-foreground" dir="ltr">
                        {shop.phone || "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Layers size={14} /> المساحة:
                      </span>
                      <span className="font-bold text-foreground">{shop.space_sqm || 0} م٢</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border/60">
                      <span className="text-muted-foreground font-bold">القيمة التعاقدية:</span>
                      <span className="font-black text-base text-primary">
                        ${shop.monthly_rent.toLocaleString()}
                      </span>
                    </div>
                  </CardContent>

                  <div className="p-3 bg-muted/20 border-t border-border/60 flex items-center justify-between gap-2 flex-wrap">
                    <Button
                      variant="edit"
                      size="sm"
                      className="flex-1 h-8 text-xs font-bold gap-1 rounded-xl cursor-pointer"
                      onClick={() => handleOpenEditShop(shop)}
                    >
                      <Edit size={14} />
                      تعديل البيانات
                    </Button>
                    <Button
                      size="sm"
                      variant="print"
                      className="h-8 text-xs font-bold gap-1 rounded-xl cursor-pointer"
                      onClick={() => setViewingContractShop(shop)}
                    >
                      <Paperclip size={14} />
                      العقد والمرفقات
                    </Button>
                    <Button
                      variant="delete"
                      size="icon"
                      className="h-8 w-8 rounded-xl cursor-pointer"
                      onClick={() => setShopToDelete(shop)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border border-border/80 bg-card rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold">
                    <tr>
                      <th className="p-3">رقم المحل</th>
                      <th className="p-3">النشاط التجاري</th>
                      <th className="p-3">المستأجر (اضغط لكشف الحساب)</th>
                      <th className="p-3">الهاتف</th>
                      <th className="p-3">المساحة</th>
                      <th className="p-3">القيمة التعاقدية</th>
                      <th className="p-3">الحالة</th>
                      <th className="p-3 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredShops.map((shop) => (
                      <tr key={shop.id} className="hover:bg-muted/30 transition">
                        <td className="p-3 font-black text-foreground">#{shop.shop_number}</td>
                        <td className="p-3 font-bold text-foreground">{shop.name_ar}</td>
                        <td className="p-3 font-bold text-foreground">
                          <button
                            type="button"
                            onClick={() => {
                              setReportShopId(shop.id);
                              setIsStatusReportModalOpen(true);
                            }}
                            className="app-link underline font-black text-indigo-600 dark:text-indigo-400 cursor-pointer"
                            title="اضغط لعرض كشف حساب المستأجر والدفعات"
                          >
                            {shop.tenant_name || "غير محدد"} (#{shop.account_number})
                          </button>
                        </td>
                        <td className="p-3 font-mono" dir="ltr">
                          {shop.phone || "-"}
                        </td>
                        <td className="p-3">{shop.space_sqm || 0} م٢</td>
                        <td className="p-3 font-mono font-black text-primary">
                          ${shop.monthly_rent.toLocaleString()}
                        </td>
                        <td className="p-3">
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                              shop.status === "rented"
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                : shop.status === "vacant"
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                  : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                            }`}
                          >
                            {shop.status === "rented"
                              ? "مؤجر"
                              : shop.status === "vacant"
                                ? "فارغ"
                                : "صيانة"}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              variant="edit"
                              size="sm"
                              className="h-7 px-2.5 text-xs font-bold rounded-lg cursor-pointer"
                              onClick={() => handleOpenEditShop(shop)}
                            >
                              تعديل
                            </Button>
                            <Button
                              variant="print"
                              size="sm"
                              className="h-7 px-2.5 text-xs font-bold rounded-lg cursor-pointer"
                              onClick={() => setViewingContractShop(shop)}
                            >
                              المرفقات
                            </Button>
                            <Button
                              variant="delete"
                              size="icon"
                              className="h-7 w-7 rounded-lg cursor-pointer"
                              onClick={() => setShopToDelete(shop)}
                            >
                              <Trash2 size={13} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* SECTION 2: OPERATIONS (العمليات - إبرام وتجديد وفسخ العقود ومتابعة الإشغال) */}
      {activeTab === "operations" && !isMallSubpageOpen && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Operational Actions */}
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
                : "space-y-3"
            }
          >
            <Card
              onClick={() => openMallSubpage("contracts")}
              className="group cursor-pointer rounded-2xl border border-border/80 bg-card p-5 hover:border-indigo-500/50 hover:shadow-md transition flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5">
                <div className="rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 p-3">
                  <Building2 size={22} />
                </div>
                <h3 className="font-black text-base text-foreground group-hover:text-indigo-600 transition-colors underline">
                  عقود الإيجار السارية والوحدات المشغولة
                </h3>
              </div>
              <Badge variant="outline" className="font-bold">
                {rentedShops} عقد
              </Badge>
            </Card>

            <Card
              onClick={() => setIsContractModalOpen(true)}
              className="group cursor-pointer rounded-2xl border border-border/80 bg-card p-5 hover:border-emerald-500/50 hover:shadow-md transition flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5">
                <div className="rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 p-3">
                  <FileText size={22} />
                </div>
                <h3 className="font-black text-base text-foreground group-hover:text-emerald-600 transition-colors underline">
                  عمل عقد إيجار جديد أو تجديد عقد
                </h3>
              </div>
              <Badge variant="outline" className="font-bold">
                إبرام عقد
              </Badge>
            </Card>

            <Card
              onClick={() => setIsTerminationModalOpen(true)}
              className="group cursor-pointer rounded-2xl border border-border/80 bg-card p-5 hover:border-rose-500/50 hover:shadow-md transition flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5">
                <div className="rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 p-3">
                  <XCircle size={22} />
                </div>
                <h3 className="font-black text-base text-foreground group-hover:text-rose-600 transition-colors underline">
                  فسخ تعاقد وإخلاء وحدة
                </h3>
              </div>
              <Badge variant="outline" className="font-bold">
                إخلاء
              </Badge>
            </Card>

            <Card
              onClick={() => setIsArchiveModalOpen(true)}
              className="group cursor-pointer rounded-2xl border border-border/80 bg-card p-5 hover:border-blue-500/50 hover:shadow-md transition flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5">
                <div className="rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 p-3">
                  <Archive size={22} />
                </div>
                <h3 className="font-black text-base text-foreground group-hover:text-blue-600 transition-colors underline">
                  أرشيف العقود المفسوخة ({terminatedArchive.length})
                </h3>
              </div>
              <Badge variant="outline" className="font-bold">
                الأرشيف
              </Badge>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "operations" && isMallSubpageOpen && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Active Contracts List */}
          <Card className="border border-border/80 bg-card rounded-2xl shadow-xs overflow-hidden">
            <CardHeader className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60">
              <CardTitle className="text-base font-black text-foreground">
                عقود الإيجار السارية والوحدات المشغولة ({rentedShops})
              </CardTitle>
              <div className="relative w-full sm:w-72">
                <Search size={15} className="absolute right-3 top-2.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث برقم المحل أو اسم المستأجر..."
                  className="pr-9 h-9 text-xs rounded-xl"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold">
                  <tr>
                    <th className="p-3">رقم المحل</th>
                    <th className="p-3">النشاط التجاري</th>
                    <th className="p-3">المستأجر (اضغط لكشف الحساب)</th>
                    <th className="p-3">بداية العقد</th>
                    <th className="p-3">نهاية العقد</th>
                    <th className="p-3">القيمة التعاقدية</th>
                    <th className="p-3 text-center">إدارة العقد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredShops.filter((s) => s.status === "rented").length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-muted-foreground">
                        لا توجد عقود مطابقة للبحث
                      </td>
                    </tr>
                  ) : (
                    filteredShops
                      .filter((s) => s.status === "rented")
                      .map((shop) => (
                        <tr key={shop.id} className="hover:bg-muted/30 transition">
                          <td className="p-3 font-black text-foreground">#{shop.shop_number}</td>
                          <td className="p-3 font-bold text-foreground">{shop.name_ar}</td>
                          <td className="p-3 font-bold text-foreground">
                            <button
                              type="button"
                              onClick={() => {
                                setReportShopId(shop.id);
                                setIsStatusReportModalOpen(true);
                              }}
                              className="app-link underline font-black text-indigo-600 dark:text-indigo-400 cursor-pointer"
                              title="اضغط لعرض كشف حساب المستأجر والدفعات"
                            >
                              {shop.tenant_name || "غير محدد"} (#{shop.account_number})
                            </button>
                          </td>
                          <td className="p-3 font-mono text-muted-foreground">
                            {shop.contract?.start_date || "-"}
                          </td>
                          <td className="p-3 font-mono text-muted-foreground">
                            {shop.contract?.end_date || "-"}
                          </td>
                          <td className="p-3 font-mono font-black text-primary">
                            ${shop.monthly_rent.toLocaleString()}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <Button
                                size="sm"
                                variant="edit"
                                className="h-7 px-2.5 text-xs font-bold rounded-lg cursor-pointer"
                                onClick={() => {
                                  handleSelectShopForContract(shop.id);
                                  setIsContractModalOpen(true);
                                }}
                              >
                                <Edit size={12} className="ml-1" />
                                تعديل / تجديد العقد
                              </Button>
                              <Button
                                size="sm"
                                variant="print"
                                className="h-7 px-2.5 text-xs font-bold rounded-lg cursor-pointer"
                                onClick={() => setViewingContractShop(shop)}
                              >
                                <Eye size={12} className="ml-1" />
                                عرض العقد
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="excel"
                                    className="h-7 px-2 text-xs font-bold rounded-lg cursor-pointer"
                                  >
                                    <MessageCircle size={12} className="ml-1" />
                                    واتساب
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-44 rounded-xl font-bold text-xs">
                                  <DropdownMenuItem
                                    className="cursor-pointer"
                                    onClick={() => handleSendWhatsApp(shop, "renewal")}
                                  >
                                    تجديد العقد
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="cursor-pointer"
                                    onClick={() => handleSendWhatsApp(shop, "welcome")}
                                  >
                                    رسالة ترحيب
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="cursor-pointer text-destructive"
                                    onClick={() => handleSendWhatsApp(shop, "violation")}
                                  >
                                    إنذار مخالفة
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              <Button
                                size="sm"
                                variant="delete"
                                className="h-7 px-2.5 text-xs font-bold rounded-lg cursor-pointer"
                                onClick={() => {
                                  setTerminationForm({
                                    shop_id: shop.id,
                                    refund_amount: shop.contract?.deposit_amount || 0,
                                    termination_image: "",
                                    notes: "",
                                  });
                                  setIsTerminationModalOpen(true);
                                }}
                              >
                                <XCircle size={12} className="ml-1" />
                                فسخ
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SECTION 3: REPORTS (التقارير - تقارير الإشغال وحالة المحلات والعقود) */}
      {activeTab === "reports" && !isMallSubpageOpen && (
        <div
          className={
            viewMode === "grid"
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-200"
              : "space-y-3 animate-in fade-in duration-200"
          }
        >
          <Card
            onClick={() => openMallSubpage("rep_occupancy")}
            className="group cursor-pointer rounded-2xl border border-border/80 bg-card p-5 hover:border-emerald-500/50 hover:shadow-md transition flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3.5">
              <div className="rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 p-3">
                <FileSpreadsheet size={22} />
              </div>
              <h3 className="font-black text-base text-foreground group-hover:text-emerald-600 transition-colors underline">
                تقرير حالة المول ونسب الإشغال والعقود
              </h3>
            </div>
            <Badge variant="outline" className="font-bold">
              {totalShops} وحدة
            </Badge>
          </Card>
        </div>
      )}

      {activeTab === "reports" && isMallSubpageOpen && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-base font-black text-foreground">
              تقارير حالة المول ونسب الإشغال والعقود
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="print"
                onClick={() => setIsStatusReportModalOpen(true)}
                className="font-bold gap-1.5 rounded-xl text-xs h-9 cursor-pointer"
              >
                <Printer size={15} />
                طباعة تقرير حالة المول
              </Button>
              <Button
                variant="excel"
                onClick={() =>
                  exportToExcel(
                    shops.map((s) => ({
                      "رقم المحل": s.shop_number,
                      "النشاط التجاري": s.name_ar,
                      المستأجر: s.tenant_name || "-",
                      الهاتف: s.phone || "-",
                      الحالة:
                        s.status === "rented" ? "مؤجر" : s.status === "vacant" ? "فارغ" : "صيانة",
                      "الإيجار التعاقدي ($)": s.monthly_rent,
                      "بداية العقد": s.contract?.start_date || "-",
                      "نهاية العقد": s.contract?.end_date || "-",
                    })),
                    `mall_shops_report_${new Date().toISOString().slice(0, 10)}`,
                  )
                }
                className="font-bold gap-1.5 rounded-xl text-xs h-9 cursor-pointer"
              >
                <FileSpreadsheet size={15} />
                تصدير إلى Excel
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border border-border/80 bg-card rounded-2xl p-5 shadow-xs">
              <span className="text-xs font-bold text-muted-foreground">إجمالي الوحدات</span>
              <h3 className="text-2xl font-black text-foreground mt-2 font-mono">{totalShops}</h3>
            </Card>
            <Card className="border border-border/80 bg-card rounded-2xl p-5 shadow-xs">
              <span className="text-xs font-bold text-muted-foreground">الوحدات المؤجرة</span>
              <h3 className="text-2xl font-black text-emerald-600 mt-2 font-mono">{rentedShops}</h3>
            </Card>
            <Card className="border border-border/80 bg-card rounded-2xl p-5 shadow-xs">
              <span className="text-xs font-bold text-muted-foreground">الوحدات الشاغرة</span>
              <h3 className="text-2xl font-black text-amber-600 mt-2 font-mono">{vacantShops}</h3>
            </Card>
            <Card className="border border-border/80 bg-card rounded-2xl p-5 shadow-xs">
              <span className="text-xs font-bold text-muted-foreground">
                العقود المفسوخة المؤرشفة
              </span>
              <h3 className="text-2xl font-black text-rose-600 mt-2 font-mono">
                {terminatedArchive.length}
              </h3>
            </Card>
          </div>

          <Card className="border border-border/80 bg-card rounded-2xl shadow-xs overflow-hidden">
            <CardHeader className="p-4 border-b border-border/60">
              <CardTitle className="text-base font-black text-foreground">
                البيان الشامل لوحدات وعقود المول ({shops.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold">
                  <tr>
                    <th className="p-3">رقم المحل</th>
                    <th className="p-3">النشاط التجاري</th>
                    <th className="p-3">المستأجر (اضغط لكشف الحساب)</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3">فترة العقد</th>
                    <th className="p-3">القيمة التعاقدية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {shops.map((shop) => (
                    <tr key={shop.id} className="hover:bg-muted/30 transition">
                      <td className="p-3 font-black text-foreground">#{shop.shop_number}</td>
                      <td className="p-3 font-bold text-foreground">{shop.name_ar}</td>
                      <td className="p-3 text-foreground">
                        <button
                          type="button"
                          onClick={() => {
                            setReportShopId(shop.id);
                            setIsStatusReportModalOpen(true);
                          }}
                          className="app-link underline font-black text-indigo-600 dark:text-indigo-400 cursor-pointer"
                          title="اضغط لعرض كشف حساب المستأجر والدفعات"
                        >
                          {shop.tenant_name || "-"} (#{shop.account_number})
                        </button>
                      </td>
                      <td className="p-3">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                            shop.status === "rented"
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                              : shop.status === "vacant"
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                          }`}
                        >
                          {shop.status === "rented"
                            ? "مؤجر"
                            : shop.status === "vacant"
                              ? "فارغ"
                              : "صيانة"}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">
                        {shop.contract
                          ? `${shop.contract.start_date} → ${shop.contract.end_date}`
                          : "-"}
                      </td>
                      <td className="p-3 font-mono font-black text-primary">
                        ${shop.monthly_rent.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SHOP ADD/EDIT MODAL */}
      <Dialog open={isShopModalOpen} onOpenChange={setIsShopModalOpen}>
        <DialogContent className="max-w-md text-right">
          <DialogHeader className="text-right">
            <DialogTitle className="text-lg font-black text-foreground">
              {editingShop ? "تعديل بيانات المحل التجاري" : "إضافة محل تجاري جديد"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">رقم المحل/الوحدة *</label>
                <Input
                  value={shopForm.shop_number}
                  onChange={(e) => setShopForm({ ...shopForm, shop_number: e.target.value })}
                  placeholder="مثال: D33"
                  className="rounded-xl font-bold"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">رقم الحساب *</label>
                <Input
                  value={shopForm.account_number}
                  onChange={(e) => setShopForm({ ...shopForm, account_number: e.target.value })}
                  placeholder="14030102"
                  className="rounded-xl font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">اسم النشاط التجاري *</label>
              <Input
                value={shopForm.name_ar}
                onChange={(e) => setShopForm({ ...shopForm, name_ar: e.target.value })}
                placeholder="مثال: صيدلية / مطعم / عطور"
                className="rounded-xl font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">اسم المستأجر</label>
                <Input
                  value={shopForm.tenant_name}
                  onChange={(e) => setShopForm({ ...shopForm, tenant_name: e.target.value })}
                  placeholder="اسم المستأجر"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">رقم الهاتف</label>
                <Input
                  value={shopForm.phone}
                  onChange={(e) => setShopForm({ ...shopForm, phone: e.target.value })}
                  placeholder="رقم الهاتف"
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">الإيجار الشهري ($) *</label>
                <Input
                  type="number"
                  value={shopForm.monthly_rent}
                  onChange={(e) =>
                    setShopForm({ ...shopForm, monthly_rent: Number(e.target.value) })
                  }
                  className="rounded-xl font-bold text-emerald-600"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">حالة المحل</label>
                <Select
                  value={shopForm.status}
                  onValueChange={(v: any) => setShopForm({ ...shopForm, status: v })}
                >
                  <SelectTrigger className="rounded-xl font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rented">مؤجر</SelectItem>
                    <SelectItem value="vacant">فارغ</SelectItem>
                    <SelectItem value="maintenance">صيانة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">ملاحظات</label>
              <Input
                value={shopForm.notes}
                onChange={(e) => setShopForm({ ...shopForm, notes: e.target.value })}
                placeholder="سنتر بوب / المول / ملاحظات أخرى"
                className="rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1">
                  <Upload size={14} className="text-emerald-600" />
                  صورة العقد المرفقة
                </label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const reader = new FileReader();
                      reader.onload = (ev) =>
                        setShopForm({
                          ...shopForm,
                          contract_image: ev.target?.result as string,
                        });
                      reader.readAsDataURL(f);
                    }
                  }}
                  className="rounded-xl text-xs bg-background cursor-pointer"
                />
                {shopForm.contract_image && (
                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-border mt-1">
                    <img
                      src={shopForm.contract_image}
                      alt="Contract"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1">
                  <Upload size={14} className="text-emerald-600" />
                  صورة الهوية / الجواز
                </label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const reader = new FileReader();
                      reader.onload = (ev) =>
                        setShopForm({
                          ...shopForm,
                          id_image: ev.target?.result as string,
                        });
                      reader.readAsDataURL(f);
                    }
                  }}
                  className="rounded-xl text-xs bg-background cursor-pointer"
                />
                {shopForm.id_image && (
                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-border mt-1">
                    <img src={shopForm.id_image} alt="ID" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 flex sm:justify-end">
            <div className="flex items-center gap-2">
              <Button
                variant="close"
                className="rounded-xl font-bold"
                onClick={() => setIsShopModalOpen(false)}
              >
                إلغاء
              </Button>
              {editingShop && (
                <Button
                  variant="print"
                  className="rounded-xl font-bold gap-2"
                  onClick={() => {
                    printContractContent(
                      {
                        ...contractForm,
                        shop_id: editingShop.id,
                        custom_shop_name: shopForm.name_ar || editingShop.name_ar,
                        tenant_name: shopForm.tenant_name || editingShop.tenant_name,
                        phone: shopForm.phone || editingShop.phone,
                        monthly_rent: Number(shopForm.monthly_rent) || editingShop.monthly_rent,
                      },
                      editingShop.shop_number,
                    );
                  }}
                >
                  <Printer className="w-4 h-4" />
                  طباعة العقد
                </Button>
              )}
              <Button
                variant="save"
                className="rounded-xl font-bold gap-2 cursor-pointer"
                onClick={handleSaveShop}
              >
                حفظ المحل
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE SHOP CONFIRMATION DIALOG */}
      <Dialog open={!!shopToDelete} onOpenChange={(open) => !open && setShopToDelete(null)}>
        <DialogContent className="max-w-md text-right">
          <DialogHeader className="text-right">
            <DialogTitle className="flex items-center gap-2 text-destructive text-lg font-black">
              <AlertCircle size={22} />
              تأكيد حذف المحل التجاري ({shopToDelete?.name_ar} #{shopToDelete?.shop_number})
            </DialogTitle>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="close"
              className="rounded-xl font-bold"
              onClick={() => setShopToDelete(null)}
            >
              إلغاء
            </Button>
            <Button
              variant="delete"
              className="rounded-xl font-bold gap-2 cursor-pointer"
              onClick={() => {
                if (shopToDelete) {
                  erpStore.deleteMallShop(shopToDelete.id);
                  setShopToDelete(null);
                }
              }}
            >
              <Trash2 size={16} />
              تأكيد الحذف نهائياً
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONTRACT CREATION & PRINTING MODAL */}
      <Dialog open={isContractModalOpen} onOpenChange={setIsContractModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto text-right">
          <DialogHeader className="text-right">
            <DialogTitle className="flex items-center gap-2 text-emerald-600 text-xl font-black">
              <FileText size={24} />
              إنشاء وطباعة وإدارة عقود إيجار المحلات والوحدات
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* 1. Shop Selection & Language */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/30 p-4 rounded-2xl border border-border">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-foreground">
                  اختر المحل أو الوحدة الإيجارية *
                </label>
                <Select value={contractForm.shop_id} onValueChange={handleSelectShopForContract}>
                  <SelectTrigger className="rounded-xl font-bold">
                    <SelectValue placeholder="اختر المحل من القائمة (51 محل)" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {shops.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="font-bold">
                        محل #{s.shop_number} - {s.name_ar} (الحساب: {s.account_number})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">لغة العقد</label>
                <Select
                  value={contractForm.language}
                  onValueChange={(val: "ar" | "en") => handleLanguageChange(val)}
                >
                  <SelectTrigger className="rounded-xl font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ar">اللغة العربية (Arabic)</SelectItem>
                    <SelectItem value="en">اللغة الإنجليزية (English)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 1.1 Shop Name & Activity Details */}
            <div className="space-y-3">
              <h3 className="text-sm font-black text-primary border-b border-border pb-1">
                {contractForm.language === "en"
                  ? "Shop & Business Activity Details"
                  : "بيانات اسم المحل ونوع النشاط"}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    {contractForm.language === "en"
                      ? "Shop Name / Title"
                      : "اسم المحل / المسمى التجاري"}
                  </label>
                  <Input
                    value={contractForm.custom_shop_name}
                    onChange={(e) =>
                      setContractForm({ ...contractForm, custom_shop_name: e.target.value })
                    }
                    placeholder={
                      contractForm.language === "en"
                        ? "e.g., Al-Amirat Boutique"
                        : "مثال: بوتيك الأميرات"
                    }
                    className="rounded-xl font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    {contractForm.language === "en" ? "Business Activity" : "نوع النشاط التجاري"}
                  </label>

                  <Input
                    value={contractForm.custom_activity}
                    onChange={(e) =>
                      setContractForm({ ...contractForm, custom_activity: e.target.value })
                    }
                    placeholder={
                      contractForm.language === "en"
                        ? "e.g., Clothing & Fashion"
                        : "مثال: ملابس وأزياء نسائية"
                    }
                    className="rounded-xl font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    {contractForm.language === "en" ? "Floor" : "الطابق"}
                  </label>
                  <Input
                    value={contractForm.floor}
                    onChange={(e) => setContractForm({ ...contractForm, floor: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    {contractForm.language === "en" ? "Area (sqm)" : "المساحة (متر مربع)"}
                  </label>
                  <Input
                    value={contractForm.area}
                    onChange={(e) => setContractForm({ ...contractForm, area: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
              </div>
            </div>

            {/* 2. Tenant Details */}
            <div className="space-y-3">
              <h3 className="text-sm font-black text-primary border-b border-border pb-1">
                {contractForm.language === "en" ? "Tenant Details" : "بيانات المستأجر والعميل"}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    {contractForm.language === "en"
                      ? "Full Tenant Name *"
                      : "اسم المستأجر الكامل *"}
                  </label>
                  <Input
                    value={contractForm.tenant_name}
                    onChange={(e) =>
                      setContractForm({ ...contractForm, tenant_name: e.target.value })
                    }
                    placeholder={
                      contractForm.language === "en"
                        ? "Tenant or Company Name"
                        : "اسم المستأجر أو الشركة"
                    }
                    className="rounded-xl font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    {contractForm.language === "en" ? "Phone Number *" : "رقم الهاتف *"}
                  </label>
                  <Input
                    value={contractForm.phone}
                    onChange={(e) => setContractForm({ ...contractForm, phone: e.target.value })}
                    placeholder="01xxxxxxxxx"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    {contractForm.language === "en" ? "Nationality" : "الجنسية"}
                  </label>
                  <Input
                    value={contractForm.nationality}
                    onChange={(e) =>
                      setContractForm({ ...contractForm, nationality: e.target.value })
                    }
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    {contractForm.language === "en"
                      ? "ID / Passport Number"
                      : "رقم الهوية / جواز السفر"}
                  </label>

                  <Input
                    value={contractForm.id_number}
                    onChange={(e) =>
                      setContractForm({ ...contractForm, id_number: e.target.value })
                    }
                    placeholder={
                      contractForm.language === "en"
                        ? "National ID / Passport"
                        : "رقم القومي / الهوية"
                    }
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    {contractForm.language === "en" ? "Authorized Rep." : "الممثل المفوض"}
                  </label>
                  <Input
                    value={contractForm.authorized_representative}
                    onChange={(e) =>
                      setContractForm({
                        ...contractForm,
                        authorized_representative: e.target.value,
                      })
                    }
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    {contractForm.language === "en" ? "Address" : "العنوان"}
                  </label>
                  <Input
                    value={contractForm.tenant_address}
                    onChange={(e) =>
                      setContractForm({ ...contractForm, tenant_address: e.target.value })
                    }
                    className="rounded-xl"
                  />
                </div>
              </div>
            </div>

            {/* 3. Lease Financials & Duration */}
            <div className="space-y-3">
              <h3 className="text-sm font-black text-primary border-b border-border pb-1">
                {contractForm.language === "en"
                  ? "Lease Term & Financials"
                  : "مدة العقد والقيم المالية"}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    {contractForm.language === "en" ? "Start Date" : "تاريخ بداية العقد"}
                  </label>
                  <Input
                    type="date"
                    value={contractForm.start_date}
                    onChange={(e) =>
                      setContractForm({ ...contractForm, start_date: e.target.value })
                    }
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    {contractForm.language === "en" ? "End Date" : "تاريخ نهاية العقد"}
                  </label>
                  <Input
                    type="date"
                    value={contractForm.end_date}
                    onChange={(e) => setContractForm({ ...contractForm, end_date: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    {contractForm.language === "en" ? "Monthly Rent ($) *" : "الإيجار الشهري ($) *"}
                  </label>
                  <Input
                    type="number"
                    value={contractForm.monthly_rent}
                    onChange={(e) =>
                      setContractForm({ ...contractForm, monthly_rent: Number(e.target.value) })
                    }
                    className="rounded-xl font-bold text-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    {contractForm.language === "en" ? "Security Deposit ($)" : "مبلغ التأمين ($)"}
                  </label>
                  <Input
                    type="number"
                    value={contractForm.deposit_amount}
                    onChange={(e) =>
                      setContractForm({ ...contractForm, deposit_amount: Number(e.target.value) })
                    }
                    className="rounded-xl font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    {contractForm.language === "en"
                      ? "Advance Payment ($)"
                      : "دفعة مقدمة (خصم من الإيجار) ($)"}
                  </label>

                  <Input
                    type="number"
                    value={contractForm.advance_payment}
                    onChange={(e) =>
                      setContractForm({ ...contractForm, advance_payment: Number(e.target.value) })
                    }
                    className="rounded-xl font-bold text-emerald-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    {contractForm.language === "en" ? "Currency" : "العملة"}
                  </label>
                  <Select
                    value={contractForm.currency}
                    onValueChange={(v: any) => setContractForm({ ...contractForm, currency: v })}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent dir={contractForm.language === "en" ? "ltr" : "rtl"}>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="SSP">SSP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    {contractForm.language === "en" ? "Payment Due Date" : "تاريخ الاستحقاق"}
                  </label>
                  <Input
                    value={contractForm.payment_due_date}
                    onChange={(e) =>
                      setContractForm({ ...contractForm, payment_due_date: e.target.value })
                    }
                    placeholder={
                      contractForm.language === "en" ? "e.g., 5th of month" : "مثال: 5 من كل شهر"
                    }
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    {contractForm.language === "en" ? "Payment Method" : "طريقة السداد"}
                  </label>
                  <Input
                    value={contractForm.payment_method}
                    onChange={(e) =>
                      setContractForm({ ...contractForm, payment_method: e.target.value })
                    }
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    {contractForm.language === "en" ? "Lease Term" : "مدة الإيجار"}
                  </label>
                  <Input
                    value={contractForm.lease_term}
                    onChange={(e) =>
                      setContractForm({ ...contractForm, lease_term: e.target.value })
                    }
                    placeholder={
                      contractForm.language === "en" ? "e.g., 1 Year" : "مثال: سنة واحدة"
                    }
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    {contractForm.language === "en" ? "Renewal Option" : "خيار التجديد"}
                  </label>
                  <Input
                    value={contractForm.renewal_option}
                    onChange={(e) =>
                      setContractForm({ ...contractForm, renewal_option: e.target.value })
                    }
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    {contractForm.language === "en" ? "Service Charge" : "رسوم الخدمات"}
                  </label>
                  <Input
                    value={contractForm.service_charge}
                    onChange={(e) =>
                      setContractForm({ ...contractForm, service_charge: e.target.value })
                    }
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    {contractForm.language === "en" ? "Annual Escalation" : "الزيادة السنوية"}
                  </label>
                  <Input
                    value={contractForm.annual_escalation}
                    onChange={(e) =>
                      setContractForm({ ...contractForm, annual_escalation: e.target.value })
                    }
                    placeholder="%"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    {contractForm.language === "en"
                      ? "Fit-out Period (Days)"
                      : "فترة التجهيز (أيام)"}
                  </label>
                  <Input
                    value={contractForm.fit_out_period}
                    onChange={(e) =>
                      setContractForm({ ...contractForm, fit_out_period: e.target.value })
                    }
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-bold text-foreground">
                    {contractForm.language === "en" ? "Utilities Included" : "المرافق المشمولة"}
                  </label>
                  <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={contractForm.electricity_included}
                        onChange={(e) =>
                          setContractForm({
                            ...contractForm,
                            electricity_included: e.target.checked,
                          })
                        }
                      />
                      {contractForm.language === "en" ? "Electricity" : "الكهرباء"}
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={contractForm.water_included}
                        onChange={(e) =>
                          setContractForm({ ...contractForm, water_included: e.target.checked })
                        }
                      />
                      {contractForm.language === "en" ? "Water" : "المياه"}
                    </label>
                  </div>
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-bold text-foreground">
                    {contractForm.language === "en" ? "Other Charges" : "رسوم أخرى"}
                  </label>
                  <Input
                    value={contractForm.other_charges}
                    onChange={(e) =>
                      setContractForm({ ...contractForm, other_charges: e.target.value })
                    }
                    className="rounded-xl"
                  />
                </div>
              </div>
            </div>

            {/* 4. Terms and Conditions & Add Clause */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground">
                  {contractForm.language === "en"
                    ? "Terms & Conditions"
                    : "الشروط والأحكام وبنود العقد"}
                </label>
              </div>
              <textarea
                value={contractForm.terms}
                onChange={(e) => setContractForm({ ...contractForm, terms: e.target.value })}
                rows={5}
                className="w-full rounded-2xl border border-border bg-background p-3 text-xs leading-relaxed font-medium focus:outline-none focus:ring-2 focus:ring-primary"
              />

              {/* Add Custom Clause Helper */}
              <div className="flex items-center gap-2 pt-1">
                <Input
                  value={contractForm.new_clause}
                  onChange={(e) => setContractForm({ ...contractForm, new_clause: e.target.value })}
                  placeholder={
                    contractForm.language === "en"
                      ? "Type a new contract clause to add..."
                      : "اكتب بنداً جديداً لإضافته للعقد..."
                  }
                  className="rounded-xl text-xs flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddClause}
                  className="rounded-xl text-xs font-bold bg-secondary text-secondary-foreground hover:bg-secondary/80 shrink-0 cursor-pointer"
                >
                  {contractForm.language === "en" ? "+ Add Clause" : "+ إضافة بند جديد"}
                </Button>
              </div>
            </div>

            {/* 5. Live Contract Print Preview Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-foreground">
                  {contractForm.language === "en"
                    ? "Live Contract Preview for Printing"
                    : "معاينة العقد للطباعة الفورية"}
                </h3>
                <Button
                  size="sm"
                  variant="print"
                  onClick={() =>
                    printContractContent(
                      contractForm,
                      shops.find((s) => s.id === contractForm.shop_id)?.shop_number || "---",
                    )
                  }
                  className="font-bold gap-2 rounded-xl cursor-pointer"
                >
                  <Printer size={16} />
                  {contractForm.language === "en"
                    ? "Print Official Contract"
                    : "طباعة العقد الرسمي"}
                </Button>
              </div>
              <div className="printable-area border-2 border-dashed border-border bg-card p-6 rounded-2xl space-y-4 text-xs text-foreground shadow-sm">
                <div className="text-center border-b border-border pb-4 space-y-1">
                  <h4 className="text-lg font-black tracking-wide text-primary">
                    {contractForm.language === "en"
                      ? "Commercial Unit / Shop Lease Contract"
                      : "عقد إيجار وحدة تجارية / محل"}
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    {contractForm.language === "en"
                      ? "Commercial Mall & Amusement Park - Property Management"
                      : "مركز التسوق التجاري والحديقة الترفيهية - إدارة الأملاك"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-muted-foreground font-bold">
                  <div>
                    {contractForm.language === "en" ? "Tenant Name: " : "اسم المستأجر: "}
                    <span className="text-foreground font-black">
                      {contractForm.tenant_name || "..................."}
                    </span>
                  </div>
                  <div>
                    {contractForm.language === "en" ? "Shop / Unit #: " : "رقم المحل / الوحدة: "}
                    <span className="text-foreground font-black">
                      #{shops.find((s) => s.id === contractForm.shop_id)?.shop_number || "---"} (
                      {contractForm.custom_shop_name ||
                        shops.find((s) => s.id === contractForm.shop_id)?.name_ar ||
                        "---"}
                      )
                    </span>
                  </div>
                  <div>
                    {contractForm.language === "en"
                      ? "Business Activity: "
                      : "نوع النشاط التجاري: "}
                    <span className="text-foreground font-black">
                      {contractForm.custom_activity || "..................."}
                    </span>
                  </div>
                  <div>
                    {contractForm.language === "en" ? "Phone: " : "رقم الهاتف: "}
                    <span className="text-foreground font-black" dir="ltr">
                      {contractForm.phone || "..................."}
                    </span>
                  </div>
                  <div>
                    {contractForm.language === "en"
                      ? "Monthly Rent: "
                      : "القيمة الإيجارية الشهرية: "}
                    <span className="text-primary font-black">
                      ${contractForm.monthly_rent} USD
                    </span>
                  </div>
                  <div>
                    {contractForm.language === "en" ? "Security Deposit: " : "مبلغ التأمين: "}
                    <span className="text-foreground font-black">
                      ${contractForm.deposit_amount} USD
                    </span>
                  </div>
                  <div>
                    {contractForm.language === "en"
                      ? "Advance Payment: "
                      : "دفعة مقدمة (تخصم من الإيجار): "}
                    <span className="text-emerald-600 font-black">
                      ${contractForm.advance_payment || 0} USD
                    </span>
                  </div>
                  <div>
                    {contractForm.language === "en" ? "Start Date: " : "تاريخ البداية: "}
                    <span className="text-foreground font-black">{contractForm.start_date}</span>
                  </div>
                  <div>
                    {contractForm.language === "en" ? "End Date: " : "تاريخ النهاية: "}
                    <span className="text-foreground font-black">{contractForm.end_date}</span>
                  </div>
                </div>
                <div className="space-y-1 pt-2 border-t border-border">
                  <p className="font-bold text-foreground">
                    {contractForm.language === "en" ? "Terms & Conditions:" : "بنود وشروط العقد:"}
                  </p>
                  <pre className="whitespace-pre-wrap font-sans text-[11px] text-muted-foreground leading-relaxed bg-muted/30 p-3 rounded-xl">
                    {contractForm.terms}
                  </pre>
                </div>
              </div>
            </div>

            {/* 6. Mandatory Document Uploads */}
            <div className="space-y-3 bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-black text-xs">
                <AlertCircle size={16} />
                <span>
                  شروط الحفظ الإجبارية: لا يمكن حفظ العقد بدون رفع صورة العقد المسحوظ ضوئياً وصورة
                  تحقيق الشخصية للمستأجر.
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <label className="text-xs font-black text-foreground flex items-center gap-1.5">
                    <Upload size={14} className="text-emerald-600" />
                    صورة العقد (مسح ضوئي / موقع) *{" "}
                    {contractForm.contract_image && (
                      <span className="text-emerald-600 font-bold">✓ تم الرفع</span>
                    )}
                  </label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        const reader = new FileReader();
                        reader.onload = (ev) =>
                          setContractForm({
                            ...contractForm,
                            contract_image: ev.target?.result as string,
                          });
                        reader.readAsDataURL(f);
                      }
                    }}
                    className="rounded-xl text-xs bg-background cursor-pointer"
                  />
                  {contractForm.contract_image && (
                    <div className="w-20 h-20 rounded-xl overflow-hidden border border-border mt-1">
                      <img
                        src={contractForm.contract_image}
                        alt="Contract"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-foreground flex items-center gap-1.5">
                    <Upload size={14} className="text-emerald-600" />
                    صورة تحقيق الشخصية (الهوية / الجواز) *{" "}
                    {contractForm.id_image && (
                      <span className="text-emerald-600 font-bold">✓ تم الرفع</span>
                    )}
                  </label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        const reader = new FileReader();
                        reader.onload = (ev) =>
                          setContractForm({
                            ...contractForm,
                            id_image: ev.target?.result as string,
                          });
                        reader.readAsDataURL(f);
                      }
                    }}
                    className="rounded-xl text-xs bg-background cursor-pointer"
                  />
                  {contractForm.id_image && (
                    <div className="w-20 h-20 rounded-xl overflow-hidden border border-border mt-1">
                      <img
                        src={contractForm.id_image}
                        alt="ID"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
            <Button
              variant="close"
              className="rounded-xl font-bold"
              onClick={() => setIsContractModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              variant="save"
              disabled={
                !contractForm.shop_id ||
                !contractForm.tenant_name ||
                !contractForm.contract_image ||
                !contractForm.id_image
              }
              onClick={handleSaveContract}
              className="rounded-xl font-bold cursor-pointer"
            >
              حفظ العقد وربطه بالمحل والاحتفاظ بالمرفقات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* VIEW SAVED CONTRACT & ATTACHMENTS MODAL */}
      <Dialog
        open={!!viewingContractShop}
        onOpenChange={(open) => !open && setViewingContractShop(null)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto text-right">
          <DialogHeader className="text-right">
            <DialogTitle className="flex items-center gap-2 text-primary text-lg font-black">
              <FileText size={20} />
              عقد الإيجار والمرفقات للمحل #{viewingContractShop?.shop_number} (
              {viewingContractShop?.name_ar})
            </DialogTitle>
          </DialogHeader>

          {viewingContractShop?.contract && (
            <div className="space-y-6 py-3 text-xs text-foreground">
              <div className="grid grid-cols-2 gap-3 bg-muted/30 p-3 rounded-xl">
                <div>
                  المستأجر:{" "}
                  <span className="font-black text-foreground">
                    {viewingContractShop.tenant_name}
                  </span>
                </div>
                <div>
                  رقم الهاتف:{" "}
                  <span className="font-bold text-foreground" dir="ltr">
                    {viewingContractShop.phone}
                  </span>
                </div>
                <div>
                  الإيجار الشهري:{" "}
                  <span className="font-black text-primary">
                    ${viewingContractShop.monthly_rent}
                  </span>
                </div>
                <div>
                  مبلغ التأمين:{" "}
                  <span className="font-bold">${viewingContractShop.contract.deposit_amount}</span>
                </div>
                <div>
                  دفعة مقدمة:{" "}
                  <span className="font-bold text-emerald-600">
                    ${viewingContractShop.contract.advance_payment || 0}
                  </span>
                </div>
                <div>
                  تاريخ البداية:{" "}
                  <span className="font-bold">{viewingContractShop.contract.start_date}</span>
                </div>
                <div>
                  تاريخ النهاية:{" "}
                  <span className="font-bold">{viewingContractShop.contract.end_date}</span>
                </div>
              </div>

              <div className="space-y-1">
                <p className="font-black">الشروط والأحكام:</p>
                <pre className="whitespace-pre-wrap font-sans text-xs bg-muted/40 p-3 rounded-xl leading-relaxed">
                  {viewingContractShop.contract.terms}
                </pre>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                <div className="space-y-2">
                  <p className="font-black text-xs">صورة العقد الموقّع:</p>
                  {viewingContractShop.contract.contract_image ? (
                    <div className="rounded-xl overflow-hidden border border-border max-h-48">
                      <img
                        src={viewingContractShop.contract.contract_image}
                        alt="Scanned Contract"
                        className="w-full h-full object-contain bg-black/5"
                      />
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic">لا توجد صورة مرفقة</p>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="font-black text-xs">صورة تحقيق الشخصية:</p>
                  {viewingContractShop.contract.id_image ? (
                    <div className="rounded-xl overflow-hidden border border-border max-h-48">
                      <img
                        src={viewingContractShop.contract.id_image}
                        alt="Tenant ID"
                        className="w-full h-full object-contain bg-black/5"
                      />
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic">لا توجد صورة مرفقة</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
            <Button
              variant="print"
              onClick={() => {
                if (viewingContractShop && viewingContractShop.contract) {
                  if (!viewingContractShop.contract.contract_image) {
                    toast.error("لا توجد صورة عقد مرفقة للطباعة");
                    return;
                  }
                  const lang = viewingContractShop.contract.language || "ar";
                  const isEn = lang === "en";

                  const html = `
                    <div class="print-container" style="text-align: center;">
                      <h3 style="margin-bottom: 12px; font-size: 16px;">${isEn ? "Attached Lease Contract" : "صورة العقد المرفقة"}</h3>
                      <img src="${viewingContractShop.contract.contract_image}" style="max-width: 100%; max-height: 950px; object-fit: contain; border: 1px solid #cbd5e1; border-radius: 8px;" />
                    </div>
                  `;
                  handlePrintHTML(isEn ? "Attached Contract" : "العقد المرفق", html);
                }
              }}
              className="rounded-xl font-bold gap-2 cursor-pointer"
            >
              <Printer size={16} />
              طباعة العقد
            </Button>
            {viewingContractShop?.contract?.id_image && (
              <Button
                variant="print"
                onClick={() => {
                  if (viewingContractShop && viewingContractShop.contract) {
                    if (!viewingContractShop.contract.contract_image) {
                      toast.error("لا توجد صورة عقد مرفقة للطباعة");
                      return;
                    }
                    const lang = viewingContractShop.contract.language || "ar";
                    const isEn = lang === "en";

                    const html = `
                      <div class="print-container" style="text-align: center;">
                        <h3 style="margin-bottom: 12px; font-size: 16px;">${isEn ? "Attached Lease Contract" : "صورة العقد المرفقة"}</h3>
                        <img src="${viewingContractShop.contract.contract_image}" style="max-width: 100%; max-height: 950px; object-fit: contain; border: 1px solid #cbd5e1; border-radius: 8px;" />
                      </div>
                      <div class="print-container" style="page-break-before: always; margin-top: 30px; text-align: center;">
                        <h3 style="margin-bottom: 12px; font-size: 16px;">${isEn ? "Tenant ID / Passport" : "صورة الهوية / جواز السفر"}</h3>
                        <img src="${viewingContractShop.contract.id_image}" style="max-width: 100%; max-height: 950px; object-fit: contain; border: 1px solid #cbd5e1; border-radius: 8px;" />
                      </div>
                    `;
                    handlePrintHTML(
                      isEn ? "Attached Contract with ID" : "العقد المرفق مع الهوية",
                      html,
                    );
                  }
                }}
                className="rounded-xl font-bold gap-2 cursor-pointer"
              >
                <Printer size={16} />
                طباعة العقد والهوية
              </Button>
            )}
            <Button
              variant="close"
              className="rounded-xl font-bold cursor-pointer"
              onClick={() => setViewingContractShop(null)}
            >
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MallReportAndArchiveDialogs
        shops={shops}
        treasuries={treasuries}
        isTerminationModalOpen={isTerminationModalOpen}
        setIsTerminationModalOpen={setIsTerminationModalOpen}
        terminationForm={terminationForm}
        setTerminationForm={setTerminationForm}
        selectedShopForTermination={selectedShopForTermination}
        printTerminationContent={printTerminationContent}
        handleSaveTermination={handleSaveTermination}
        isArchiveModalOpen={isArchiveModalOpen}
        setIsArchiveModalOpen={setIsArchiveModalOpen}
        terminatedArchive={terminatedArchive}
        isStatusReportModalOpen={isStatusReportModalOpen}
        setIsStatusReportModalOpen={setIsStatusReportModalOpen}
        reportShopId={reportShopId}
        setReportShopId={setReportShopId}
        reportDate={reportDate}
        setReportDate={setReportDate}
        reportData={reportData}
        handlePrintStatusReport={handlePrintStatusReport}
      />
    </div>
  );
}
