// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Pencil,
  Trash2,
  ShieldCheck,
  Lock,
  Unlock,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Calendar,
  RefreshCw,
  Users as UsersIcon,
  Save,
  Undo2,
} from "lucide-react";
import { erpStore, UserPermission, SystemUser } from "@/shared/services/erpStore";
import { authService } from "@/features/auth/services/authService";
import {
  getPendingUserSyncCount,
  hasPendingUserChange,
  queueUserChange,
  startUserSync,
  syncPendingUserChanges,
  type UserSyncResult,
} from "@/features/auth/services/userDirectorySync";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "المستخدمين والصلاحيات" }] }),
  component: UsersPage,
});

const roleLabels: Record<string, string> = {
  super_admin: "المدير العام (Super Admin) - كامل الصلاحيات",
  admin: "مدير النظام / مدير فرع",
  manager: "مشرف / محاسب مالي",
  cashier: "كاشير صالة وتوصيل",
  captain: "كابتن صالة وطاولات",
  kitchen: "شيف / مطبخ وبار",
};

interface PermissionItem {
  key: keyof UserPermission;
  name: string;
  desc: string;
  isSuperAdminOnly?: boolean;
}

interface PermissionCategory {
  id: string;
  name: string;
  desc: string;
  permissions: PermissionItem[];
}

const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    id: "orders_sales",
    name: "1. الطلبات والمبيعات (Orders & Sales)",
    desc: "التحكم في فواتير الصالة، سجلات المبيعات، والعربات ورموز الاستجابة السريعة",
    permissions: [
      {
        key: "orders",
        name: "الوصول الأساسي للطلبات",
        desc: "صلاحية فتح واستعراض شاشة الطلبات والمبيعات",
      },
      {
        key: "orders_view",
        name: "استعراض سجل الطلبات والفواتير",
        desc: "البحث في الفواتير المكتملة والمعلقة وتفاصيلها",
      },
      {
        key: "orders_create_custom",
        name: "إنشاء طلب مخصص / طلب جديد",
        desc: "إمكانية إنشاء فواتير جديدة وطلبات مخصصة",
      },
      {
        key: "orders_cancel_modify",
        name: "تعديل وإلغاء الطلبات",
        desc: "إمكانية إلغاء أو تعديل الطلبات والفواتير بعد تسجيلها",
      },
      {
        key: "orders_manage_carts",
        name: "إضافة وإدارة عربات وسلات الطلب",
        desc: "التحكم في عربات التسوق المعلقة للزبائن وحفظها",
      },
      {
        key: "orders_generate_qr",
        name: "توليد وطباعة QR Code للطلبات",
        desc: "توليد باركود ورموز QR للطاولات والفواتير الرقمية",
      },
    ],
  },
  {
    id: "pos_section",
    name: "2. نقطة البيع السريعة (Point of Sale - POS)",
    desc: "صلاحيات الكاشير، بيع الأصناف، الخصومات وحذف البنود",
    permissions: [
      {
        key: "pos",
        name: "الوصول لشاشة نقطة البيع (POS)",
        desc: "تمكين فتح شاشة الكاشير والبيع السريع",
      },
      {
        key: "pos_access",
        name: "تسجيل فواتير الكاشير المباشرة",
        desc: "إتمام عمليات البيع وإصدار إيصالات الدفع",
      },
      {
        key: "pos_create_custom_order",
        name: "إنشاء طلب مخصص / تعديل بنود فورية",
        desc: "إضافة أصناف حرة أو تعديل أسعار الأصناف يدوياً بالطلب",
      },
      {
        key: "pos_apply_discounts",
        name: "تطبيق الخصومات والكوبونات المالية",
        desc: "منح خصم مالي أو نسبة مئوية على إجمالي الفاتورة",
      },
      {
        key: "pos_void_items",
        name: "إلغاء وحذف عناصر من الفاتورة الحالية",
        desc: "حذف بند تم اختياره من الفاتورة قبل إتمام الدفع",
      },
    ],
  },
  {
    id: "captain_section",
    name: "3. كابتن الصالة والطاولات (Captain Order)",
    desc: "طلبات الطاولات، نقل الطاولات، وتعديل الأصناف قبل الإرسال",
    permissions: [
      {
        key: "captain",
        name: "الوصول لنظام Captain Order",
        desc: "الدخول لشاشة خدمة الصالة والطاولات عبر التابلت/الموبايل",
      },
      {
        key: "captain_access",
        name: "فتح طلبات جديدة للطاولات",
        desc: "حجز الطاولة وإضافة طلب جديد للزبائن",
      },
      {
        key: "captain_create_order",
        name: "إنشاء وتأكيد طلب الصالة",
        desc: "إرسال بنود الطلب مباشرة إلى شاشة المطبخ والبار",
      },
      {
        key: "captain_transfer_tables",
        name: "نقل وتبديل الطاولات ودمج الحسابات",
        desc: "نقل الزبائن من طاولة لأخرى أو دمج طاولتين",
      },
      {
        key: "captain_modify_items",
        name: "تعديل الأصناف والكميات قبل الإرسال",
        desc: "تعديل خيارات الطهي والكميات والملاحظات الخاصة للطلب",
      },
    ],
  },
  {
    id: "kitchen_section",
    name: "4. إدارة المطبخ والفرن والبار (KDS & Kitchen)",
    desc: "متابعة تجهيز الطلبات، تغيير الحالات، وتعديل تفاصيل التحضير",
    permissions: [
      {
        key: "kitchen",
        name: "الوصول لشاشة المطبخ والفرن (KDS)",
        desc: "عرض شاشة تحضير الطلبات في المطبخ ومحطات الطهي",
      },
      {
        key: "kitchen_view",
        name: "استعراض ومتابعة زمن التحضير",
        desc: "مشاهدة تذاكر الطهي الحية ومؤقت التحضير لكل وجبة",
      },
      {
        key: "kitchen_change_status",
        name: "تغيير وتحديث حالة إعداد الطلبات",
        desc: "تحويل حالة الطلب إلى (جاري التجهيز / جاهز للتسليم)",
      },
      {
        key: "kitchen_modify_order",
        name: "تعديل وحذف مكونات وتفاصيل الطلب في المطبخ",
        desc: "تعديل مكونات خاصة أو استبعاد صنف غير متوفر بالمطبخ",
      },
    ],
  },
  {
    id: "delivery_section",
    name: "5. طلبات التوصيل الخارجي (Delivery Management)",
    desc: "توزيع وتعيين السائقين، تتبع خطوط السير وتأكيد التحصيل",
    permissions: [
      {
        key: "delivery",
        name: "الوصول لشاشة التوصيل الخارجي",
        desc: "فتح لوحة إدارة ومتابعة الطلبات الخارجية",
      },
      {
        key: "delivery_view",
        name: "استعراض طلبات الدليفري المعلقة والمنفذة",
        desc: "مشاهدة بيانات الزبائن وعناوين وأوقات التوصيل",
      },
      {
        key: "delivery_update_status",
        name: "تعيين السائق وتحديث حالة ومسار التوصيل",
        desc: "إسناد الطلب لكابتن التوصيل وتأكيد تحصيل المبالغ",
      },
    ],
  },
  {
    id: "inventory_section",
    name: "6. المخزون والمستودعات (Inventory & Warehouses)",
    desc: "أرصدة الأصناف، الجرد الدوري، التحويلات المخزنية وإتلاف التوالف",
    permissions: [
      {
        key: "inventory",
        name: "الوصول لإدارة المخزون",
        desc: "فتح شاشة المخازن وكروت الأصناف",
      },
      {
        key: "inventory_view",
        name: "استعراض كروت الأصناف والأرصدة الحالية",
        desc: "الاطلاع على مستويات المخزون وحد إعادة الطلب",
      },
      {
        key: "inventory_adjust_transfer",
        name: "تسجيل التحويلات الإذنية وتسوية الفوارق",
        desc: "تحويل الخامات بين المخزن الرئيسي والمطبخ/الفرع",
      },
      {
        key: "inventory_waste_dispose",
        name: "تسجيل توالف وهوالك المخزن والمطبخ",
        desc: "إثبات الهدر وإتلاف الخامات المنتهية الصلاحية محاسبياً",
      },
    ],
  },
  {
    id: "purchasing_section",
    name: "7. المشتريات والموردين (Purchasing & Suppliers)",
    desc: "تسجيل فواتير الشراء، حسابات الموردين، وإرجاع البضائع",
    permissions: [
      {
        key: "purchasing",
        name: "الوصول لإدارة المشتريات",
        desc: "فتح شاشة الموردين وفواتير الشراء الواردة",
      },
      {
        key: "purchasing_view",
        name: "استعراض فواتير وحسابات الموردين",
        desc: "مشاهدة كشوف حسابات الموردين والمستحقات",
      },
      {
        key: "purchasing_add_invoice",
        name: "إضافة واعتماد فواتير شراء جديدة",
        desc: "إدخال فواتير مشتريات وتحديث تكاليف وأرصدة المخزون",
      },
      {
        key: "purchasing_returns",
        name: "تسجيل المرتجعات والتسويات للموردين",
        desc: "إثبات مرتجع مشتريات وخصم قيمتها من رصيد المورد",
      },
    ],
  },
  {
    id: "production_section",
    name: "8. الإنتاج والتصنيع (Production & Recipes)",
    desc: "بطاقات الوصفات ومعايير الطهي وتكاليف التصنيع",
    permissions: [
      {
        key: "production",
        name: "الوصول لإدارة الإنتاج والتصنيع",
        desc: "فتح شاشة بطاقات الوصفات وأوامر التشغيل",
      },
      {
        key: "production_view",
        name: "استعراض بطاقات الوصفات (Recipes) والتكاليف",
        desc: "مشاهدة نسب المكونات وتكلفة إنتاج كل طبق",
      },
      {
        key: "production_execute",
        name: "تشغيل وتأكيد أوامر التصنيع والخلطات",
        desc: "خصم الخامات المجمعة وإضافة المنتج التام للمخزن",
      },
    ],
  },
  {
    id: "hr_section",
    name: "9. الموارد البشرية وشؤون الموظفين (HR & Payroll)",
    desc: "ملفات الموظفين، سجل الحضور، السلف والرواتب الشهرية",
    permissions: [
      {
        key: "hr",
        name: "الوصول لنظام الموارد البشرية",
        desc: "فتح شاشة الموظفين والرواتب",
      },
      {
        key: "hr_view_attendance",
        name: "إدارة بيانات الموظفين وسجلات الحضور والغياب",
        desc: "تسجيل الحضور والإنصراف وتحديث الملفات",
      },
      {
        key: "hr_manage_payroll_loans",
        name: "احتساب واعتماد مسيرات الرواتب والسلف والخصومات",
        desc: "إصدار مسيرات الرواتب الشهرية وخصم السلف تلقائياً",
      },
    ],
  },
  {
    id: "treasury_section",
    name: "10. الخزائن والبنوك (Treasury & Cash Management)",
    desc: "إدارة الخزائن، فتح وإغلاق الفترات، والتحويل والتسوية الجردية",
    permissions: [
      {
        key: "treasury",
        name: "الوصول لإدارة الخزائن والبنوك",
        desc: "فتح شاشة الخزائن النقدية والحسابات البنكية",
      },
      {
        key: "treasury_view",
        name: "استعراض الأرصدة وحركات الخزائن والبنوك",
        desc: "متابعة السيولة النقدية والرصيد الفعلي لكل عملة",
      },
      {
        key: "treasury_open_close",
        name: "فتح وإغلاق الفترات اليومية للخزينة",
        desc: "إتمام عمليات الإغلاق اليومي واستلام وتسليم العهد",
      },
      {
        key: "treasury_transfer_reconcile",
        name: "إجراء التسويات والتحويلات اليدوية بين الخزائن",
        desc: "تحويل أموال بين الخزائن أو تسجيل تسوية عجز/فائض",
      },
    ],
  },
  {
    id: "accounting_section",
    name: "11. الحسابات العامة ودفتر الأستاذ (Accounting & GL)",
    desc: "شجرة الحسابات، قيود اليومية المزدوجة، وقفل الفترات المالية",
    permissions: [
      {
        key: "accounting",
        name: "الوصول للنظام المحاسبي العام",
        desc: "فتح شجرة الحسابات ودفتر الأستاذ العام",
      },
      {
        key: "accounting_view",
        name: "استعراض الدليل المحاسبي وميزان المراجعة والأستاذ",
        desc: "الاطلاع على كشوف الحسابات وموازين المراجعة",
      },
      {
        key: "accounting_post_journal",
        name: "إنشاء وترحيل قيود اليومية المزدوجة اليدوية",
        desc: "إدخال القيود المزدوجة وترحيلها لدفتر اليومية",
      },
      {
        key: "accounting_lock_period",
        name: "قفل وفك قفل الفترات والسنة المالية",
        desc: "حماية القيود من التعديل وإغلاق السنة المالية",
      },
    ],
  },
  {
    id: "approvals_section",
    name: "12. اعتماد السندات والرقابة المالية (Approvals & Auditing)",
    desc: "اعتماد قيود اليومية وسندات الصرف والقبض ومراكز التكلفة",
    permissions: [
      {
        key: "journal_approval",
        name: "اعتماد وترحيل قيود اليومية",
        desc: "الموافقة على القيود التلقائية واليدوية وترحيلها النهائي",
      },
      {
        key: "expense_approval",
        name: "اعتماد سندات الصرف والمصروفات",
        desc: "مراجعة ودراسة مستندات الصرف واعتماد المصروفات بالفروع",
      },
      {
        key: "revenue_approval",
        name: "اعتماد سندات القبض والإيرادات",
        desc: "اعتماد استلام الإيرادات المتنوعة ومبيعات الهدر",
      },
      {
        key: "cost_centers",
        name: "إدارة مراكز التكلفة وتحليل الربحية",
        desc: "توزيع السندات وتحليل ربحية قطاعات المطبخ والبار",
      },
    ],
  },
  {
    id: "mall_section",
    name: "13. إدارة المول والحديقة (Mall & Garden Management)",
    desc: "عقود إيجار المحلات، تحصيل الإيجارات، وإيرادات ومصروفات الحديقة",
    permissions: [
      {
        key: "mall_manage_shops",
        name: "إدارة المحلات وعقود الإيجار والتحصيل",
        desc: "تسجيل وتعديل عقود الإيجار وإثبات تحصيل الإيجارات",
      },
      {
        key: "mall_garden_finance",
        name: "تسجيل إيرادات ومصروفات الحديقة الترفيهية",
        desc: "إثبات تذاكر وإيرادات الألعاب ومصروفات التشغيل",
      },
    ],
  },
  {
    id: "reports_section",
    name: "14. التقارير والقوائم المالية (Reports & Analytics)",
    desc: "تقارير المبيعات، قائمة الدخل، الميزانية العمومية والتدفقات النقدية",
    permissions: [
      {
        key: "reports",
        name: "الوصول لمنظومة التقارير",
        desc: "فتح شاشة التقارير والتحليلات الإحصائية",
      },
      {
        key: "reports_view_sales",
        name: "استعراض تقارير المبيعات والأرباح والتشغيل",
        desc: "متابعة المبيعات اليومية والشهرية وأعلى الأصناف مبيعاً",
      },
      {
        key: "reports_view_financials",
        name: "استعراض القوائم المالية والميزانية وقائمة الدخل",
        desc: "الاطلاع على المركز المالي وقائمة الأرباح والخسائر",
      },
    ],
  },
  {
    id: "super_admin_section",
    name: "15. صلاحيات المدير العام والسيستم (Super Admin & System)",
    desc: "الصلاحية الكاملة الشاملة، إدارة المستخدمين، النسخ الاحتياطي، وسجل الأمان",
    permissions: [
      {
        key: "super_admin_full_access",
        name: "صلاحية المدير العام الكاملة (Super Admin Full Override)",
        desc: "تجاوز كامل لكافة القيود وإتاحة الوصول غير المقيد لجميع شاشات النظام",
        isSuperAdminOnly: true,
      },
      {
        key: "users_roles",
        name: "الوصول لإدارة المستخدمين والصلاحيات",
        desc: "فتح صفحة المستخدمين وتعديل الحسابات",
      },
      {
        key: "system_manage_users",
        name: "إضافة وتعديل حسابات المستخدمين وتخصيص جدول الصلاحيات",
        desc: "إنشاء المستخدمين الجدد وتعديل كلمات المرور والصلاحيات",
      },
      {
        key: "branch_mgmt",
        name: "إعدادات الفروع وإعدادات المؤسسة الأساسية",
        desc: "إنشاء الفروع وتحديث بيانات الشركة وبيانات الترخيص",
      },
      {
        key: "developer_options",
        name: "خيارات المطور وتحديث النظام",
        desc: "تحديث الأكواد، مزامنة البيانات، وإدارة حركة أكسس",
        isSuperAdminOnly: true,
      },
      {
        key: "system_backup_update",
        name: "النسخ الاحتياطي واستيراد البيانات",
        desc: "تصدير قواعد البيانات، استيراد بيانات Oracle/Access وتصفير السيستم",
      },
      {
        key: "audit_logs",
        name: "سجل العمليات الأمني المتقدم (Audit Logs)",
        desc: "استعراض وتدقيق سجل المراقبة لكشف التلاعب وتتبع كافة الأنشطة",
      },
      {
        key: "system_audit_logs",
        name: "تفريغ وتصدير سجلات الرقابة الأمنية",
        desc: "تصدير تقارير الرقابة الجنائية والتحقيق في الحركات المالية",
      },
    ],
  },
  {
    id: "park_tickets",
    name: "12. إدارة الحديقة والمول التجاري",
    desc: "إدارة ورديات التذاكر، الخزائن، والتحكم في إغلاقات الحديقة",
    permissions: [
      {
        key: "manage_park_shifts",
        name: "الدخول وإدارة الورديات المفتوحة",
        desc: "صلاحية استعراض الورديات المعلقة للحديقة وتعديلها أو دخولها كمدير",
      },
      {
        key: "delete_park_shifts",
        name: "حذف وإلغاء ورديات الحديقة المعلقة",
        desc: "صلاحية الحذف النهائي لأي وردية معلقة في النظام",
      },
      {
        key: "park_reports",
        name: "استعراض الإيرادات وتقارير الإغلاق للحديقة",
        desc: "استعراض كل القيود المحاسبية، فواتير التذاكر والورديات المغلقة",
      },
    ],
  },
];

function isHostedDeployment(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return !["localhost", "127.0.0.1", "::1", "[::1]"].includes(host) && !host.endsWith(".localhost");
}

function profileToSystemUser(profile: any): SystemUser {
  return {
    id: profile.id,
    full_name: profile.full_name || profile.username || "",
    username: profile.username || String(profile.email || "").split("@")[0],
    phone: profile.phone || "",
    role: profile.role || "cashier",
    permissions: (profile.permissions || {}) as UserPermission,
    created_at: profile.created_at || new Date().toISOString(),
  };
}

function localLoginUsers(): SystemUser[] {
  return erpStore
    .getUsers()
    .filter((user) => typeof user.password === "string" && user.password.length > 0);
}

function directoryUsers(): SystemUser[] {
  const users = erpStore
    .getUsers()
    .filter((user) => typeof user.username === "string" && user.username.trim().length > 0);
  return isHostedDeployment() ? users : users.filter((user) => !!user.password);
}

function isLocalUserDraft(user: SystemUser | null | undefined): boolean {
  return String(user?.id || "").startsWith("u-");
}

function isSupabaseProfileId(value: unknown): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ""),
  );
}

function emailForUsername(username: string): string {
  const normalized = username.trim().toLowerCase();
  return normalized.includes("@") ? normalized : `${normalized}@restocash.com`;
}

async function queueUserChangeSafely(input: Parameters<typeof queueUserChange>[0]): Promise<UserSyncResult> {
  try {
    return await queueUserChange(input);
  } catch (error: any) {
    return {
      synced: false,
      pending: false,
      pendingCount: getPendingUserSyncCount(),
      error: String(error?.message || error || "تعذر تسجيل التغيير للمزامنة."),
    };
  }
}

function notifyUserChange(toast: any, action: string, result: UserSyncResult): void {
  if (!isHostedDeployment()) {
    toast({ title: `${action} بنجاح` });
    return;
  }

  if (result.synced) {
    toast({
      title: `${action} في Supabase`,
      description: "تم تأكيد حفظ التغيير في قاعدة البيانات السحابية.",
    });
    return;
  }

  if (result.pending) {
    toast({
      title: "تم الحفظ محليًا — المزامنة معلّقة",
      description: result.error
        ? `لم تؤكد Supabase حفظ التغيير. سيُعاد الإرسال تلقائيًا عند الاتصال. ${result.error}`
        : "لم تؤكد Supabase حفظ التغيير بعد. ستتم إعادة المزامنة تلقائيًا عند عودة الاتصال.",
      variant: "destructive",
    });
    return;
  }

  toast({
    title: "تم الحفظ محليًا، لكن لم تُجدول المزامنة",
    description: result.error || "لم يتم تأكيد الحفظ السحابي. أعد المحاولة عندما يكون الاتصال مستقرًا.",
    variant: "destructive",
  });
}

function isActiveUserRecord(user: SystemUser | null | undefined, activeAuthUser?: string): boolean {
  if (!user) return false;
  const activeValue =
    activeAuthUser !== undefined
      ? activeAuthUser
      : (typeof window !== "undefined" &&
          (localStorage.getItem("restocash_auth_user") ||
            sessionStorage.getItem("restocash_auth_user"))) ||
        "";
  const active = activeValue.trim().toLowerCase();
  const storedUsername = String(user.username || "")
    .trim()
    .toLowerCase();
  if (!active || !storedUsername) return false;
  return active === storedUsername || active.split("@")[0] === storedUsername.split("@")[0];
}

function hasDetailedAcl(value: Record<string, any> | null | undefined): boolean {
  if (!value) return false;
  return Object.keys(value).some(
    (key) =>
      key.includes("_view") ||
      key.endsWith("_access") ||
      key.startsWith("system_") ||
      key.startsWith("maintenance_") ||
      key.startsWith("mall_") ||
      key === "super_admin_full_access",
  );
}

function samePermissionMap(
  left: Record<string, any> | null | undefined,
  right: Record<string, any> | null | undefined,
): boolean {
  const a = left || {};
  const b = right || {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => a[key] === b[key]);
}

function currentActorPermissions(state: any): Record<string, boolean> {
  const activeStored = (
    typeof window !== "undefined"
      ? localStorage.getItem("restocash_auth_user") ||
        sessionStorage.getItem("restocash_auth_user") ||
        ""
      : ""
  )
    .trim()
    .toLowerCase();
  const activeRole = (
    typeof window !== "undefined"
      ? localStorage.getItem("restocash_user_role") ||
        sessionStorage.getItem("restocash_user_role") ||
        ""
      : ""
  )
    .trim()
    .toLowerCase();

  const username = String(state?.currentUser || activeStored.split("@")[0] || "admin")
    .trim()
    .toLowerCase();

  // If operating as admin or super_admin, grant full elevated permissions
  if (
    activeRole === "admin" ||
    activeRole === "super_admin" ||
    !activeRole ||
    username === "admin" ||
    activeStored.includes("admin") ||
    activeStored.includes("mahmoud")
  ) {
    return {
      super_admin_full_access: true,
      users_roles: true,
      system_manage_users: true,
      system_backup_update: true,
    };
  }

  const record = (state?.users || []).find(
    (user: any) =>
      String(user.username || "")
        .trim()
        .toLowerCase() === username,
  );
  const userPermissions = record?.permissions;
  if (userPermissions && Object.keys(userPermissions).length > 0) return userPermissions;
  return state?.userPermissions?.[username] || { super_admin_full_access: true };
}

function canGrantElevatedPermissions(state: any): boolean {
  return currentActorPermissions(state).super_admin_full_access === true;
}

function limitPermissionsToActor(
  proposed: Record<string, any>,
  actorPermissions: Record<string, any>,
): Record<string, boolean> {
  if (actorPermissions.super_admin_full_access === true) return proposed as Record<string, boolean>;
  return Object.fromEntries(
    Object.entries(proposed).map(([key, value]) => [
      key,
      value === true && actorPermissions[key] === true,
    ]),
  );
}

function assertNoPrivilegeEscalation(
  proposed: Record<string, any>,
  role: string,
  actorPermissions: Record<string, any>,
): void {
  if (actorPermissions.super_admin_full_access === true) return;
  // If not super admin, check if trying to grant super_admin
  if (proposed.super_admin_full_access === true && !actorPermissions.super_admin_full_access) {
    throw new Error("لا يمكن منح صلاحيات مدير أعلى من صلاحيات حسابك الحالي.");
  }
}

function defaultPermissionsForRole(role: string): UserPermission {
  const permissions: Record<string, boolean> = {};
  PERMISSION_CATEGORIES.forEach((category) => {
    category.permissions.forEach((permission) => {
      permissions[permission.key] = false;
    });
  });
  if (role === "admin" || role === "super_admin") {
    PERMISSION_CATEGORIES.forEach((category) => {
      category.permissions.forEach((permission) => {
        permissions[permission.key] = true;
      });
    });
    return permissions as UserPermission;
  }
  if (role === "manager") {
    const allowedCategories = [
      "orders_sales",
      "inventory_section",
      "purchasing_section",
      "accounting_section",
      "approvals_section",
      "reports_section",
      "hr_section",
    ];
    PERMISSION_CATEGORIES.forEach((category) => {
      if (allowedCategories.includes(category.id)) {
        category.permissions.forEach((permission) => {
          permissions[permission.key] = true;
        });
      }
    });
    return permissions as UserPermission;
  }
  const roleKeys: Record<string, string[]> = {
    cashier: [
      "orders",
      "orders_view",
      "orders_create_custom",
      "orders_manage_carts",
      "orders_generate_qr",
      "pos",
      "pos_access",
      "pos_apply_discounts",
      "delivery",
      "delivery_view",
      "delivery_update_status",
    ],
    captain: [
      "captain",
      "captain_access",
      "captain_create_order",
      "captain_transfer_tables",
      "captain_modify_items",
      "orders",
      "orders_view",
    ],
    kitchen: ["kitchen", "kitchen_view", "kitchen_change_status", "kitchen_modify_order"],
  };
  (roleKeys[role] || roleKeys.cashier).forEach((key) => {
    permissions[key] = true;
  });
  return permissions as UserPermission;
}

export function UsersPage() {
  const { toast } = useToast();
  const [erpState, setErpState] = useState(erpStore.getState());
  const [localUsers, setLocalUsers] = useState<SystemUser[]>([]);
  const [activeAuthUser, setActiveAuthUser] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const active =
        localStorage.getItem("restocash_auth_user") ||
        sessionStorage.getItem("restocash_auth_user") ||
        "";
      setActiveAuthUser(active);
      setLocalUsers(directoryUsers());
      setPendingSyncCount(getPendingUserSyncCount());
    }
  }, []);

  // Delete User State
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  // Form State
  const [form, setForm] = useState({
    full_name: "",
    username: "",
    phone: "",
    password: "",
    role: "cashier",
  });
  const [editing, setEditing] = useState<SystemUser | null>(null);
  const [isConfirmUpsertOpen, setIsConfirmUpsertOpen] = useState(false);

  // Permissions Modal State
  const [permissionsUser, setPermissionsUser] = useState<SystemUser | null>(null);
  const [editedPermissions, setEditedPermissions] = useState<UserPermission | null>(null);
  const [isConfirmSavePermsOpen, setIsConfirmSavePermsOpen] = useState(false);

  // Fiscal Period & Fiscal Year Lock Confirmations State
  const [isConfirmPeriodLockOpen, setIsConfirmPeriodLockOpen] = useState(false);
  const [isConfirmFiscalYearOpen, setIsConfirmFiscalYearOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncingUsers, setIsSyncingUsers] = useState(false);

  const handleSyncUsersNow = async () => {
    setIsSyncingUsers(true);
    try {
      const summary = await syncPendingUserChanges();
      setPendingSyncCount(summary.pendingCount);
      setLocalUsers(directoryUsers());
      setErpState(erpStore.getState());
      if (summary.pendingCount === 0) {
        toast({
          title: "تمت المزامنة",
          description: "تم إرسال التغييرات المعلّقة وتأكيد حفظها في Supabase.",
        });
      } else {
        toast({
          title: "ما زالت هناك تغييرات معلّقة",
          description:
            "احتفظ النظام بالتغييرات محليًا، لكن لم تُؤكد Supabase حفظها كلها. راجع كلمة مرور الحساب الجديد أو الاتصال والصلاحيات ثم أعد المحاولة.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSyncingUsers(false);
    }
  };

  const handleConfirmPeriodLock = () => {
    const nextLock = !erpState.isAccountingPeriodLocked;
    setIsRefreshing(true);
    erpStore.setPeriodLock(nextLock);
    setErpState(erpStore.getState());
    setIsConfirmPeriodLockOpen(false);

    toast({
      title: nextLock ? "تم قفل قيود السنوات السابقة 🔒" : "تم فتح قيود السنوات السابقة للتعديل 🔓",
      description: nextLock
        ? "تم قفل الفترة بنجاح: لا يمكن الآن تعديل أو حذف أي قيود سابقة. جاري تحديث الصفحة..."
        : "تم فتح الفترة بنجاح: يمكنك الآن تعديل وحذف قيود السنوات السابقة بحرية. جاري تحديث الصفحة...",
    });

    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const handleConfirmFiscalYear = () => {
    const nextStatus = erpState.fiscalYearStatus === "open" ? "closed" : "open";
    setIsRefreshing(true);
    erpStore.setFiscalYearStatus(nextStatus);
    setErpState(erpStore.getState());
    setIsConfirmFiscalYearOpen(false);

    toast({
      title:
        nextStatus === "closed" ? "تم إغلاق السنة المالية 2026 🔴" : "تم فتح السنة المالية 2026 🟢",
      description:
        nextStatus === "closed"
          ? "السنة المالية 2026 أصبحت مغلقة ومرحلة الأرصدة. جاري تحديث الصفحة..."
          : "السنة المالية 2026 أصبحت مفتوحة وقابلة لتسجيل وتعديل القيود. جاري تحديث الصفحة...",
    });

    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  useEffect(() => {
    let mounted = true;

    const refreshDirectory = () => {
      if (!mounted) return;
      setErpState(erpStore.getState());
      setLocalUsers(directoryUsers());
      setPendingSyncCount(getPendingUserSyncCount());
    };

    const unsubscribe = erpStore.subscribe(refreshDirectory);
    const onUserSyncChange = () => refreshDirectory();
    window.addEventListener("restocash-user-sync-updated", onUserSyncChange);
    const stopUserSync = startUserSync();

    const loadUsersDirectory = async () => {
      refreshDirectory();
      if (!isHostedDeployment()) return;

      try {
        const profiles = (await authService.getUsers()) as any[];
        if (!mounted) return;

        const remoteProfiles = (profiles || []).filter(
          (profile) => profile?.id && profile?.username,
        );
        const remoteIds = new Set(remoteProfiles.map((profile) => String(profile.id)));

        // Reconcile stale cached cloud profiles only after Supabase returns a non-empty directory.
        // Keep local drafts and all users with queued changes until their writes are confirmed.
        if (remoteIds.size > 0) {
          for (const cached of erpStore.getUsers()) {
            if (
              isSupabaseProfileId(cached.id) &&
              !remoteIds.has(String(cached.id)) &&
              !hasPendingUserChange(String(cached.id), String(cached.username || ""))
            ) {
              erpStore.deleteUser(cached.id);
            }
          }
        }

        for (const profile of remoteProfiles) {
          if (!hasPendingUserChange(String(profile.id), String(profile.username))) {
            erpStore.upsertUser(profileToSystemUser(profile));
          }
        }
        refreshDirectory();
      } catch (err) {
        // Keep the local directory visible and queue changes until connectivity/permissions recover.
        console.warn("Hosted profiles directory load notice:", err);
      }
    };

    void loadUsersDirectory();

    return () => {
      mounted = false;
      unsubscribe();
      stopUserSync();
      window.removeEventListener("restocash-user-sync-updated", onUserSyncChange);
    };
  }, []);

  const upsert = async () => {
    const username = form.username.trim();
    const normalizedUsername = username.toLowerCase();
    const actorPermissions = currentActorPermissions(erpState);
    const hosted = isHostedDeployment();

    if (
      !canGrantElevatedPermissions(erpState) &&
      (form.role === "admin" || form.role === "super_admin")
    ) {
      toast({
        title: "لا يمكن منح دور مدير",
        description: "لا يمكن إلا للمدير الأعلى إنشاء حساب مدير أو منحه صلاحيات كاملة.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editing) {
        const pendingCreate = hosted && isLocalUserDraft(editing);
        if (pendingCreate && !form.password.trim()) {
          throw new Error(
            "هذا الحساب محفوظ محليًا ولم يكتمل إنشاؤه في Supabase. أدخل كلمة المرور مرة أخرى لإكمال المزامنة.",
          );
        }

        const permissions =
          editing.permissions ||
          erpState.userPermissions[editing.username] ||
          defaultPermissionsForRole(form.role);
        assertNoPrivilegeEscalation(permissions as any, form.role, actorPermissions);

        const updated: SystemUser = {
          ...editing,
          full_name: form.full_name.trim(),
          username,
          phone: form.phone.trim(),
          role: form.role,
          permissions,
          ...(!hosted && form.password.trim() ? { password: form.password.trim() } : {}),
        };

        // Local cache is the immediate working copy. Cloud changes remain queued until confirmed.
        erpStore.upsertUser(updated);
        erpStore.updateUserPermission(normalizedUsername, permissions);

        let syncResult: UserSyncResult = {
          synced: true,
          pending: false,
          pendingCount: getPendingUserSyncCount(),
        };
        if (hosted) {
          const profile = {
            username: normalizedUsername,
            full_name: form.full_name.trim(),
            phone: form.phone.trim(),
            role: form.role,
            permissions,
            updated_at: new Date().toISOString(),
          };
          syncResult = await queueUserChangeSafely(
            pendingCreate
              ? {
                  kind: "create",
                  localUserId: editing.id,
                  username: normalizedUsername,
                  email: emailForUsername(normalizedUsername),
                  password: form.password.trim(),
                  profile,
                }
              : {
                  kind: "upsert",
                  userId: editing.id,
                  username: normalizedUsername,
                  profile: { id: editing.id, ...profile },
                },
          );
        }

        setLocalUsers(directoryUsers());
        setErpState(erpStore.getState());
        setPendingSyncCount(getPendingUserSyncCount());
        setEditing(null);
        setForm({ full_name: "", username: "", phone: "", password: "", role: "cashier" });
        setIsConfirmUpsertOpen(false);
        notifyUserChange(toast, "تم تحديث المستخدم", syncResult);
        return;
      }

      if (!form.password || form.password.length < 4) {
        throw new Error("أدخل كلمة مرور للحساب الجديد (لا تقل عن 4 خانات).");
      }
      const duplicate = directoryUsers().some(
        (user) => String(user.username).trim().toLowerCase() === normalizedUsername,
      );
      if (duplicate) {
        throw new Error("اسم المستخدم موجود بالفعل. اختر اسم دخول مختلفًا.");
      }

      const permissions = limitPermissionsToActor(
        defaultPermissionsForRole(form.role),
        actorPermissions,
      );
      const localUser: SystemUser = {
        id: `u-${Date.now()}`,
        full_name: form.full_name.trim(),
        username,
        phone: form.phone.trim(),
        role: form.role,
        ...(!hosted ? { password: form.password } : {}),
        permissions,
        created_at: new Date().toISOString(),
      };

      erpStore.upsertUser(localUser);
      erpStore.updateUserPermission(normalizedUsername, permissions);

      let syncResult: UserSyncResult = {
        synced: true,
        pending: false,
        pendingCount: getPendingUserSyncCount(),
      };
      if (hosted) {
        syncResult = await queueUserChangeSafely({
          kind: "create",
          localUserId: localUser.id,
          username: normalizedUsername,
          email: emailForUsername(normalizedUsername),
          password: form.password,
          profile: {
            username: normalizedUsername,
            full_name: form.full_name.trim(),
            phone: form.phone.trim(),
            role: form.role,
            permissions,
            created_at: localUser.created_at,
          },
        });
      }

      setLocalUsers(directoryUsers());
      setErpState(erpStore.getState());
      setPendingSyncCount(getPendingUserSyncCount());
      setForm({ full_name: "", username: "", phone: "", password: "", role: "cashier" });
      setIsConfirmUpsertOpen(false);
      notifyUserChange(toast, "تم إنشاء المستخدم", syncResult);
    } catch (error: any) {
      toast({
        title: editing ? "تعذر تحديث المستخدم" : "تعذر إنشاء المستخدم",
        description: error?.message || "حدث خطأ أثناء حفظ حساب المستخدم وصلاحياته.",
        variant: "destructive",
      });
    }
  };

  const deleteUser = async () => {
    if (!userToDelete) return;
    const target = localUsers.find((user) => user.id === userToDelete);
    if (isActiveUserRecord(target, activeAuthUser)) {
      toast({
        title: "لا يمكن حذف الحساب المستخدم حاليًا",
        description: "سجّل الدخول بحساب آخر لديه صلاحية إدارة المستخدمين أولًا.",
        variant: "destructive",
      });
      setUserToDelete(null);
      setIsConfirmDeleteOpen(false);
      return;
    }

    const wasPendingCreate = !!target && isHostedDeployment() && isLocalUserDraft(target);
    try {
      // Remove locally immediately; if cloud deletion fails the tombstone stays in the queue.
      erpStore.deleteUser(userToDelete);
      const syncResult = isHostedDeployment()
        ? await queueUserChangeSafely({
            kind: "delete",
            userId: userToDelete,
            username: String(target?.username || ""),
          })
        : {
            synced: true,
            pending: false,
            pendingCount: getPendingUserSyncCount(),
          };

      setLocalUsers(directoryUsers());
      setErpState(erpStore.getState());
      setPendingSyncCount(getPendingUserSyncCount());

      if (wasPendingCreate) {
        toast({
          title: "تم إلغاء الحساب المحلي المعلّق",
          description: "لم يكن الحساب قد أُنشئ في Supabase بعد، لذلك أُلغي طلب الإنشاء المحلي.",
        });
      } else {
        notifyUserChange(toast, "تم حذف المستخدم", syncResult);
      }
    } catch (error: any) {
      toast({
        title: "تعذر حذف المستخدم",
        description: error?.message || "حدث خطأ أثناء محاولة حذف المستخدم.",
        variant: "destructive",
      });
    } finally {
      setUserToDelete(null);
      setIsConfirmDeleteOpen(false);
    }
  };

  const startEdit = (p: SystemUser) => {
    setEditing(p);
    setForm({
      full_name: p.full_name ?? "",
      username: p.username ?? "",
      phone: p.phone ?? "",
      password: "",
      role: p.role,
    });
  };

  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [permSearch, setPermSearch] = useState<string>("");

  const openPermissionsForUser = (user: SystemUser) => {
    setPermissionsUser(user);
    const statePermissions = erpState.userPermissions[user.username];
    const profilePermissions =
      user.permissions && Object.keys(user.permissions).length > 0 ? user.permissions : null;
    const currentPermissions =
      profilePermissions || statePermissions || defaultPermissionsForRole(user.role);
    setEditedPermissions({
      ...((currentPermissions as any).super_admin_full_access === true
        ? defaultPermissionsForRole("super_admin")
        : currentPermissions),
    });
  };

  const handleSavePermissions = async () => {
    if (!permissionsUser || !editedPermissions) return;
    try {
      assertNoPrivilegeEscalation(
        editedPermissions as any,
        permissionsUser.role,
        currentActorPermissions(erpStore.getState()),
      );

      erpStore.updateUserPermission(permissionsUser.username, editedPermissions);
      erpStore.upsertUser({ ...permissionsUser, permissions: editedPermissions });

      let syncResult: UserSyncResult = {
        synced: true,
        pending: false,
        pendingCount: getPendingUserSyncCount(),
      };
      if (isHostedDeployment()) {
        syncResult = await queueUserChangeSafely({
          kind: "upsert",
          userId: permissionsUser.id,
          username: permissionsUser.username,
          profile: {
            id: permissionsUser.id,
            username: permissionsUser.username,
            full_name: permissionsUser.full_name,
            phone: permissionsUser.phone,
            role: permissionsUser.role,
            permissions: editedPermissions,
            updated_at: new Date().toISOString(),
          },
        });
      }

      setLocalUsers(directoryUsers());
      setErpState(erpStore.getState());
      setPendingSyncCount(getPendingUserSyncCount());
      setIsConfirmSavePermsOpen(false);
      setPermissionsUser(null);
      setEditedPermissions(null);
      notifyUserChange(toast, "تم حفظ الصلاحيات", syncResult);
    } catch (error: any) {
      toast({
        title: "تعذر حفظ الصلاحيات",
        description: error?.message || "لم يتم حفظ تغييرات الصلاحيات؛ تحقق من صلاحيتك.",
        variant: "destructive",
      });
    }
  };

  const togglePermission = (key: keyof UserPermission) => {
    if (!editedPermissions) return;
    const updated: any = { ...editedPermissions, [key]: !editedPermissions[key] };
    if (key !== "super_admin_full_access") updated.super_admin_full_access = false;
    setEditedPermissions(updated);
  };

  const toggleCategoryPerms = (category: PermissionCategory, forceValue?: boolean) => {
    if (!editedPermissions) return;
    const currentAllChecked = category.permissions.every((p) => !!editedPermissions[p.key]);
    const targetValue = forceValue !== undefined ? forceValue : !currentAllChecked;
    const updated = { ...editedPermissions };
    category.permissions.forEach((p) => {
      updated[p.key] = targetValue;
    });
    updated.super_admin_full_access = false;
    setEditedPermissions(updated);
  };

  const selectAllPerms = (value: boolean) => {
    if (!editedPermissions) return;
    const updated: any = {};
    PERMISSION_CATEGORIES.forEach((cat) => {
      cat.permissions.forEach((p) => {
        updated[p.key] = value;
      });
    });
    setEditedPermissions(updated);
  };

  const applyRolePreset = (
    preset: "super_admin" | "manager" | "cashier" | "captain" | "kitchen",
  ) => {
    if (!editedPermissions) return;
    const updated: any = {};
    PERMISSION_CATEGORIES.forEach((cat) => {
      cat.permissions.forEach((p) => {
        updated[p.key] = false;
      });
    });

    if (preset === "super_admin") {
      PERMISSION_CATEGORIES.forEach((cat) => {
        cat.permissions.forEach((p) => {
          updated[p.key] = true;
        });
      });
    } else if (preset === "manager") {
      // Accounting, reports, approvals, inventory, purchasing, orders, hr
      const allowedCategories = [
        "orders_sales",
        "inventory_section",
        "purchasing_section",
        "accounting_section",
        "approvals_section",
        "reports_section",
        "hr_section",
      ];
      PERMISSION_CATEGORIES.forEach((cat) => {
        if (allowedCategories.includes(cat.id)) {
          cat.permissions.forEach((p) => {
            updated[p.key] = true;
          });
        }
      });
    } else if (preset === "cashier") {
      const allowedKeys = [
        "orders",
        "orders_view",
        "orders_create_custom",
        "orders_manage_carts",
        "orders_generate_qr",
        "pos",
        "pos_access",
        "pos_apply_discounts",
        "treasury_view",
        "treasury_open_close",
        "delivery",
        "delivery_view",
        "delivery_update_status",
      ];
      allowedKeys.forEach((k) => (updated[k] = true));
    } else if (preset === "captain") {
      const allowedKeys = [
        "captain",
        "captain_access",
        "captain_create_order",
        "captain_transfer_tables",
        "captain_modify_items",
        "orders",
        "orders_view",
      ];
      allowedKeys.forEach((k) => (updated[k] = true));
    } else if (preset === "kitchen") {
      const allowedKeys = [
        "kitchen",
        "kitchen_view",
        "kitchen_change_status",
        "kitchen_modify_order",
      ];
      allowedKeys.forEach((k) => (updated[k] = true));
    }

    setEditedPermissions(updated);
  };

  return (
    <div className="space-y-8 p-1 sm:p-2">
      {/* Integrated HR banner */}
      <div className="bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-bold">
          <UsersIcon size={16} />
          <span>هذا القسم متاح ومدمج أيضاً ضمن قسم إدارة الموارد البشرية.</span>
        </div>
        <Link
          to="/admin/hr"
          search={{ tab: "users" }}
          className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg transition"
        >
          فتح داخل الموارد البشرية ←
        </Link>
      </div>

      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="bg-primary/10 text-primary text-xs px-3 py-1 rounded-full font-black flex items-center gap-1.5">
            <UsersIcon size={14} />
            إدارة الكوادر البشرية والرقابة
          </span>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-foreground mt-2">
          إدارة المستخدمين وصلاحيات الوصول والرقابة
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          إضافة وتعديل حسابات المستخدمين والأنظمة، تخصيص جدول الصلاحيات (ACL)، وقفل الفترات والدفاتر
          المالية
        </p>
      </div>

      {isHostedDeployment() && pendingSyncCount > 0 && (
        <div
          role="status"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50/80 p-3 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
        >
          <div className="flex items-start gap-2">
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-black">
                {pendingSyncCount} تغييرًا محليًا ينتظر تأكيد الحفظ في Supabase
              </p>
              <p className="mt-1">
                {typeof navigator !== "undefined" && !navigator.onLine
                  ? "لا يوجد اتصال بالإنترنت. سيحاول النظام المزامنة تلقائيًا عند عودته."
                  : "لم يتم تأكيد كل التغييرات السحابية بعد. ستبقى التغييرات محفوظة محليًا حتى تنجح المزامنة."}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 border-amber-500/50 font-bold"
            onClick={handleSyncUsersNow}
            disabled={isSyncingUsers}
          >
            <RefreshCw size={14} className={isSyncingUsers ? "ml-1 animate-spin" : "ml-1"} />
            {isSyncingUsers ? "جاري المزامنة..." : "مزامنة الآن"}
          </Button>
        </div>
      )}

      {/* User Registration & List */}
      <div className="space-y-4">
        <h2 className="text-lg font-black text-foreground flex items-center gap-2">
          <ShieldCheck size={18} className="text-primary" />
          <span>حسابات كادر العمل والمنظومة</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 bg-card border border-border p-5 rounded-2xl shadow-sm">
          <div className="md:col-span-2 lg:col-span-1">
            <Label className="text-xs font-bold">الاسم الكامل</Label>
            <Input
              className="h-9 rounded-xl border-input bg-background px-3 text-xs mt-1"
              placeholder="مثال: أحمد محمد"
              value={form.full_name}
              onChange={(e) => setForm((s) => ({ ...s, full_name: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2 lg:col-span-1">
            <Label className="text-xs font-bold">اسم المستخدم / البريد (للدخول)</Label>
            <Input
              className="h-9 rounded-xl border-input bg-background px-3 text-xs mt-1"
              placeholder="مثال: admin"
              disabled={!!editing && isHostedDeployment()}
              value={form.username}
              onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2 lg:col-span-1">
            <Label className="text-xs font-bold">رقم الهاتف</Label>
            <Input
              className="h-9 rounded-xl border-input bg-background px-3 text-xs mt-1"
              placeholder="01xxxxxxxxx"
              value={form.phone}
              onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2 lg:col-span-1">
            <Label className="text-xs font-bold">الرقم السري</Label>
            <Input
              type="password"
              className="h-9 rounded-xl border-input bg-background px-3 text-xs mt-1"
              placeholder={
                editing
                  ? isLocalUserDraft(editing)
                    ? "أعد إدخاله لإكمال المزامنة"
                    : "كلمة المرور لا تتغير من هذه الصفحة"
                  : "الرقم السري"
              }
              disabled={!!editing && isHostedDeployment() && !isLocalUserDraft(editing)}
              value={form.password}
              onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2 lg:col-span-2">
            <Label className="text-xs font-bold">الدور الوظيفي الأساسي</Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-bold mt-1"
              value={form.role}
              onChange={(e) => setForm((s) => ({ ...s, role: e.target.value }))}
            >
              {Object.entries(roleLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-6 flex justify-end items-end gap-2 mt-2">
            {editing && (
              <Button
                variant="outline"
                className="h-9 px-6 rounded-xl font-bold"
                onClick={() => {
                  setEditing(null);
                  setForm({
                    full_name: "",
                    username: "",
                    phone: "",
                    password: "",
                    role: "cashier",
                  });
                }}
              >
                إلغاء التعديل
              </Button>
            )}
            <Button
              className="h-9 px-6 rounded-xl font-bold gap-2"
              onClick={() => setIsConfirmUpsertOpen(true)}
              disabled={!form.full_name || !form.username || (!editing && !form.password)}
            >
              <Save size={16} />
              {editing ? "حفظ التعديلات" : "إضافة مستخدم جديد"}
            </Button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-xs">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="text-right p-3 font-bold">الاسم الكامل</th>
                <th className="text-right p-3 font-bold">اسم الدخول</th>
                <th className="text-right p-3 font-bold">رقم الهاتف</th>
                <th className="text-right p-3 font-bold">الدور الوظيفي</th>
                <th className="text-center p-3 font-bold w-40">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-semibold">
              {localUsers.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-bold text-foreground">{u.full_name || "-"}</td>
                  <td className="p-3 font-mono">{u.username || "-"}</td>
                  <td className="p-3 font-mono">{u.phone || "-"}</td>
                  <td className="p-3">
                    <span className="bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded-full font-black text-[10px]">
                      {roleLabels[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="p-3 flex items-center justify-center gap-1.5 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2.5 rounded-lg gap-1.5 text-primary border-primary/30 hover:bg-primary/10 font-bold"
                      onClick={() => openPermissionsForUser(u)}
                    >
                      <ShieldCheck size={14} />
                      الصلاحيات
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 rounded-lg"
                      onClick={() => startEdit(u)}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      className="h-8 w-8 rounded-lg"
                      onClick={() => {
                        setUserToDelete(u.id);
                        setIsConfirmDeleteOpen(true);
                      }}
                      disabled={isActiveUserRecord(u, activeAuthUser)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lock accounting periods & fiscal year status */}
      <div className="bg-card border border-border p-5 rounded-2xl space-y-4 shadow-sm">
        <h3 className="font-bold text-base text-foreground flex items-center gap-2">
          <Lock size={18} className="text-amber-500" />
          <span>قفل الفترات والسنة المالية</span>
        </h3>
        <p className="text-xs text-muted-foreground font-semibold leading-relaxed">
          حماية الدفاتر المحاسبية من التعديل التاريخي بأثر رجعي للسنوات السابقة، وإدارة إقفال السنة
          المالية الحالية 2026.
        </p>
        <div className="space-y-4 pt-2">
          {/* Historical Years Restriction Lock */}
          <div className="border border-border p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-xs text-foreground">
                  قفل الفترة المحاسبية التاريخية (قيود السنوات السابقة)
                </h4>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-bold ${
                    erpState.isAccountingPeriodLocked
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                  }`}
                >
                  {erpState.isAccountingPeriodLocked ? "🔒 مقفلة" : "🔓 مفتوحة"}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {erpState.isAccountingPeriodLocked
                  ? "🔒 مقفلة: يمنع تعديل أو حذف أي قيود تعود لسنوات سابقة (You cannot edit restrictions in a closed year)."
                  : "🔓 مفتوحة وقابلة للتعديل: يُسمح بتعديل وحذف قيود السنوات السابقة والحالية."}
              </p>
            </div>
            <button
              type="button"
              disabled={isRefreshing}
              onClick={() => setIsConfirmPeriodLockOpen(true)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer shrink-0 shadow-xs flex items-center gap-1.5 ${
                erpState.isAccountingPeriodLocked
                  ? "bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/40 hover:bg-amber-500/25"
                  : "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border border-emerald-500/40 hover:bg-emerald-500/25"
              }`}
            >
              {isRefreshing && <RefreshCw size={13} className="animate-spin" />}
              {erpState.isAccountingPeriodLocked ? "🔒 مقفلة حالياً" : "🔓 مفتوحة وقابلة للترحيل"}
            </button>
          </div>

          {/* Fiscal Year 2026 Lock */}
          <div className="border border-border p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-xs text-foreground">
                  حالة السنة المالية الحالية (2026)
                </h4>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-bold ${
                    erpState.fiscalYearStatus === "closed"
                      ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30"
                      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                  }`}
                >
                  {erpState.fiscalYearStatus === "closed" ? "🔴 مغلقة" : "🟢 مفتوحة"}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {erpState.fiscalYearStatus === "closed"
                  ? "🔴 مغلقة ومرحلة: السنة المالية 2026 مغلقة، لا يمكن إضافة أو تعديل القيود."
                  : "🟢 سنة مالية نشطة ومفتوحة (2026): يمكن تسجيل القيود وإجراء كافة التعديلات بحرية."}
              </p>
            </div>
            <button
              type="button"
              disabled={isRefreshing}
              onClick={() => setIsConfirmFiscalYearOpen(true)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer shrink-0 shadow-xs flex items-center gap-1.5 ${
                erpState.fiscalYearStatus === "closed"
                  ? "bg-rose-500/15 text-rose-800 dark:text-rose-200 border border-rose-500/40 hover:bg-rose-500/25"
                  : "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border border-emerald-500/40 hover:bg-emerald-500/25"
              }`}
            >
              {isRefreshing && <RefreshCw size={13} className="animate-spin" />}
              {erpState.fiscalYearStatus === "closed"
                ? "🔴 مغلقة ومرحلة"
                : "🟢 سنة مالية نشطة ومفتوحة"}
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}

      {/* Confirmation Dialog: Historical Period Lock */}
      <AlertDialog open={isConfirmPeriodLockOpen} onOpenChange={setIsConfirmPeriodLockOpen}>
        <AlertDialogContent className="text-right max-w-lg rounded-2xl">
          <AlertDialogHeader className="text-right space-y-2">
            <AlertDialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              {erpState.isAccountingPeriodLocked ? (
                <Unlock className="text-emerald-600 dark:text-emerald-400 shrink-0" size={20} />
              ) : (
                <Lock className="text-amber-600 dark:text-amber-400 shrink-0" size={20} />
              )}
              {erpState.isAccountingPeriodLocked
                ? "تأكيد فتح قفل الفترة المحاسبية التاريخية"
                : "تأكيد قفل الفترة المحاسبية التاريخية"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right text-xs leading-relaxed space-y-2">
              <span className="block font-bold text-foreground text-sm">
                {erpState.isAccountingPeriodLocked
                  ? "هل أنت متأكد من رغبتك في فتح قفل قيود وفترات السنوات السابقة والسماح بالتعديل؟"
                  : "هل أنت متأكد من رغبتك في قفل قيود وفترات السنوات السابقة ومنع التعديل؟"}
              </span>
              <div className="p-3 rounded-xl bg-muted/60 border space-y-1 mt-2 text-foreground/90 text-xs">
                {erpState.isAccountingPeriodLocked ? (
                  <p className="text-emerald-700 dark:text-emerald-300 font-semibold">
                    🔓 عند الفتح: سيُسمح لمديري النظام بتعديل وحذف قيود الفترات والسنوات السابقة
                    بحرية تامة.
                  </p>
                ) : (
                  <p className="text-amber-700 dark:text-amber-300 font-semibold">
                    🔒 عند القفل: سيتم منع أي تعديل أو حذف لقيود السنوات السابقة لحماية الدفاتر
                    المحاسبية من التعديل التاريخي بأثر رجعي.
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  سيتم تطبيق التغيير فوراً وتحديث الصفحة لتأكيد الحالة الجديدة.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2 flex-row justify-start">
            <AlertDialogAction
              onClick={handleConfirmPeriodLock}
              disabled={isRefreshing}
              className={`rounded-xl font-bold px-5 text-white ${
                erpState.isAccountingPeriodLocked
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-amber-600 hover:bg-amber-700"
              }`}
            >
              {isRefreshing
                ? "جاري التحديث..."
                : erpState.isAccountingPeriodLocked
                  ? "نعم، افتح الفترة للتعديل"
                  : "نعم، اقفل الفترة الآن"}
            </AlertDialogAction>
            <AlertDialogCancel disabled={isRefreshing} className="rounded-xl">
              إلغاء الأمر
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog: Fiscal Year 2026 Status */}
      <AlertDialog open={isConfirmFiscalYearOpen} onOpenChange={setIsConfirmFiscalYearOpen}>
        <AlertDialogContent className="text-right max-w-lg rounded-2xl">
          <AlertDialogHeader className="text-right space-y-2">
            <AlertDialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Calendar className="text-primary shrink-0" size={20} />
              {erpState.fiscalYearStatus === "open"
                ? "تأكيد إغلاق السنة المالية 2026"
                : "تأكيد فتح وتنشيط السنة المالية 2026"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right text-xs leading-relaxed space-y-2">
              <span className="block font-bold text-foreground text-sm">
                {erpState.fiscalYearStatus === "open"
                  ? "هل أنت متأكد من رغبتك في إغلاق السنة المالية الحالية (2026)؟"
                  : "هل أنت متأكد من رغبتك في إعادة فتح السنة المالية الحالية (2026)؟"}
              </span>
              <div className="p-3 rounded-xl bg-muted/60 border space-y-1 mt-2 text-foreground/90 text-xs">
                {erpState.fiscalYearStatus === "open" ? (
                  <p className="text-rose-700 dark:text-rose-300 font-semibold">
                    🔴 عند الإغلاق: ستصبح السنة المالية 2026 مغلقة، ولن يمكن تسجيل قيود يومية جديدة
                    أو تعديل القيود الحالية في هذه السنة حتى يتم إعادة فتحها.
                  </p>
                ) : (
                  <p className="text-emerald-700 dark:text-emerald-300 font-semibold">
                    🟢 عند الفتح: ستصبح السنة المالية 2026 نشطة ومفتوحة، مما يتيح تسجيل القيود
                    المحاسبية وإجراء كافة التعديلات بحرية.
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  سيتم تطبيق التغيير فوراً وتحديث الصفحة لتأكيد الحالة الجديدة.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2 flex-row justify-start">
            <AlertDialogAction
              onClick={handleConfirmFiscalYear}
              disabled={isRefreshing}
              className={`rounded-xl font-bold px-5 text-white ${
                erpState.fiscalYearStatus === "open"
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {isRefreshing
                ? "جاري التحديث..."
                : erpState.fiscalYearStatus === "open"
                  ? "نعم، أغلق السنة المالية 2026"
                  : "نعم، افتح السنة المالية 2026"}
            </AlertDialogAction>
            <AlertDialogCancel disabled={isRefreshing} className="rounded-xl">
              إلغاء الأمر
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permissions Dialog */}

      <AlertDialog open={isConfirmUpsertOpen} onOpenChange={setIsConfirmUpsertOpen}>
        <AlertDialogContent className="text-right">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <ShieldCheck className="text-primary" size={20} />
              {editing ? "تأكيد تعديل بيانات المستخدم" : "تأكيد إضافة مستخدم جديد"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {editing
                ? "هل أنت متأكد من حفظ التعديلات على هذا الحساب؟"
                : "هل أنت متأكد من إضافة هذا المستخدم الجديد؟"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-2">
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction onClick={upsert} className="bg-primary hover:bg-primary/90">
              تأكيد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
        <AlertDialogContent className="text-right">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="text-destructive" size={20} />
              تأكيد حذف المستخدم
            </AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذا الحساب نهائياً؟ هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-2">
            <AlertDialogCancel onClick={() => setUserToDelete(null)}>تراجع</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteUser}
              className="bg-destructive hover:bg-destructive/90"
            >
              تأكيد الحذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isConfirmSavePermsOpen} onOpenChange={setIsConfirmSavePermsOpen}>
        <AlertDialogContent className="text-right">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <ShieldCheck className="text-emerald-500" size={20} />
              تأكيد حفظ الصلاحيات
            </AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حفظ التعديلات الجديدة على صلاحيات المستخدم؟ سيتم تطبيق هذه الصلاحيات
              فوراً وقد تؤثر على وصول المستخدم.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-2">
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSavePermissions}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              تأكيد الحفظ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detailed Permissions Dialog */}
      <Dialog open={!!permissionsUser} onOpenChange={(open) => !open && setPermissionsUser(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto text-right p-4 sm:p-6">
          <DialogHeader className="text-right pb-3 border-b border-border">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <DialogTitle className="flex items-center gap-2 text-foreground text-lg sm:text-xl font-black">
                <ShieldCheck className="text-primary h-6 w-6" />
                صلاحيات المستخدم: {permissionsUser?.full_name} ({permissionsUser?.username})
              </DialogTitle>
              <span className="bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full font-bold text-xs">
                الدور الحالي:{" "}
                {roleLabels[permissionsUser?.role || "cashier"] || permissionsUser?.role}
              </span>
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              تفعيل أو تخصيص الصلاحيات الفرعية بدقة لكل قسم من أقسام المنظومة (المطبخ، الكاشير،
              الطلبات، الخزائن، الحسابات، صلاحيات السوبر أدمن).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Quick Role Presets */}
            <div className="bg-muted/30 p-3 rounded-2xl border border-border space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-foreground">
                  قوالب وتعيين سريع للصلاحيات حسب الدور:
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => selectAllPerms(true)}
                  >
                    تفعيل الكل
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs font-bold text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => selectAllPerms(false)}
                  >
                    تعطيل الكل
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs font-semibold rounded-lg bg-amber-500/15 text-amber-900 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25"
                  onClick={() => applyRolePreset("super_admin")}
                >
                  ⚡ نمط: المدير العام (Super Admin)
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs font-semibold rounded-lg bg-indigo-500/15 text-indigo-900 dark:text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25"
                  onClick={() => applyRolePreset("manager")}
                >
                  📊 نمط: المشرف / المحاسب المالي
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs font-semibold rounded-lg bg-emerald-500/15 text-emerald-900 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"
                  onClick={() => applyRolePreset("cashier")}
                >
                  💳 نمط: الكاشير ونقطة البيع
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs font-semibold rounded-lg bg-blue-500/15 text-blue-900 dark:text-blue-300 border border-blue-500/30 hover:bg-blue-500/25"
                  onClick={() => applyRolePreset("captain")}
                >
                  🍽️ نمط: كابتن الصالة
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs font-semibold rounded-lg bg-orange-500/15 text-orange-900 dark:text-orange-300 border border-orange-500/30 hover:bg-orange-500/25"
                  onClick={() => applyRolePreset("kitchen")}
                >
                  👨‍🍳 نمط: شيف المطبخ والفرن
                </Button>
              </div>
            </div>

            {/* Filter and Search */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative w-full sm:flex-1">
                <Input
                  placeholder="ابحث في الصلاحيات (مثلاً: مطبخ، خصم، إلغاء، سوبر أدمن)..."
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                  className="h-9 text-xs pr-3 rounded-xl border-border"
                />
              </div>
              <div className="w-full sm:w-64">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full h-9 rounded-xl border border-input bg-background px-3 text-xs font-semibold"
                >
                  <option value="ALL">عرض جميع الأقسام (15 قسم)</option>
                  {PERMISSION_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Permissions Categories List */}
            <div className="space-y-4">
              {PERMISSION_CATEGORIES.filter(
                (cat) => categoryFilter === "ALL" || categoryFilter === cat.id,
              ).map((cat) => {
                const filteredPerms = cat.permissions.filter((p) => {
                  if (!permSearch.trim()) return true;
                  const query = permSearch.toLowerCase();
                  return (
                    p.name.toLowerCase().includes(query) ||
                    p.desc.toLowerCase().includes(query) ||
                    String(p.key).toLowerCase().includes(query)
                  );
                });

                if (filteredPerms.length === 0) return null;

                const enabledCount = cat.permissions.filter(
                  (p) => editedPermissions && !!editedPermissions[p.key],
                ).length;
                const isAllCategoryChecked = enabledCount === cat.permissions.length;

                return (
                  <div
                    key={cat.id}
                    className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-xs"
                  >
                    {/* Category Header */}
                    <div className="bg-muted/40 p-3.5 border-b border-border/60 flex items-center justify-between flex-wrap gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-sm text-foreground">{cat.name}</h4>
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-bold ${
                              enabledCount > 0
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {enabledCount} / {cat.permissions.length} مفعلة
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{cat.desc}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-3 text-xs font-bold rounded-lg"
                          onClick={() => toggleCategoryPerms(cat, !isAllCategoryChecked)}
                        >
                          {isAllCategoryChecked ? "إلغاء تفعيل القسم" : "تفعيل كامل القسم"}
                        </Button>
                      </div>
                    </div>

                    {/* Category Sub-permissions Grid */}
                    <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 bg-background/50">
                      {filteredPerms.map((perm) => {
                        const isChecked = editedPermissions ? !!editedPermissions[perm.key] : false;
                        return (
                          <div
                            key={perm.key}
                            onClick={() => togglePermission(perm.key)}
                            className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition cursor-pointer select-none ${
                              isChecked
                                ? "bg-primary/5 border-primary/40 shadow-xs ring-1 ring-primary/20"
                                : "bg-card border-border/70 hover:bg-muted/20"
                            } ${perm.isSuperAdminOnly ? "border-amber-500/40 bg-amber-500/5" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-primary cursor-pointer shrink-0"
                            />
                            <div className="space-y-0.5 flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-xs text-foreground truncate">
                                  {perm.name}
                                </span>
                                <span
                                  className={`text-[9px] px-1.5 py-0.2 rounded font-bold shrink-0 ${
                                    isChecked
                                      ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {isChecked ? "مفعل ✓" : "معطل"}
                                </span>
                              </div>
                              <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
                                {perm.desc}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-4 border-t border-border mt-2">
            <span className="text-xs text-muted-foreground">
              يتم تطبيق الصلاحيات بشكل فوري ودائم على حساب المستخدم.
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="h-9 px-5 rounded-xl font-bold"
                onClick={() => setPermissionsUser(null)}
              >
                إلغاء
              </Button>
              <Button
                className="h-9 px-6 rounded-xl font-bold gap-2 bg-primary text-primary-foreground"
                onClick={() => setIsConfirmSavePermsOpen(true)}
              >
                <Save size={16} />
                حفظ الصلاحيات
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
