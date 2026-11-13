// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ViewModeToggle, useViewMode } from "@/components/ui/view-mode-toggle";
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
  inspectManagedUserConditions,
  normalizeManagedUsername,
  userValidationErrorMessage,
  validateManagedUserForm,
} from "@/features/auth/services/managedUserValidation";
import {
  GLOBAL_USERS_SYNC_SHIFT_ID,
  getPendingUserError,
  getPendingUserSyncCount,
  hasPendingUserChange,
  queueUserChange,
  startUserSync,
  syncPendingUserChanges,
  syncUsersDirectoryWithDatabase,
} from "@/features/auth/services/userDirectorySync";
import { supabase } from "@/integrations/supabase/client";
import { isHostedDeployment } from "@/shared/services/previewAccess";
import {
  notifyPermissionsUpdated,
  hydratePagePermissions,
  getDefaultPermissionsForRole,
} from "@/shared/services/userAuthorization";
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
  kind?: "main" | "page" | "action";
  isSuperAdminOnly?: boolean;
}

interface PermissionCategory {
  id: string;
  name: string;
  shortTitle: string;
  desc: string;
  mainPageKey: keyof UserPermission;
  headerGradient: string;
  accentBadge: string;
  permissions: PermissionItem[];
}

const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    id: "dept_restaurant",
    name: "1. مربع قسم: إدارة المطعم",
    shortTitle: "إدارة المطعم",
    desc: "نقطة البيع (POS)، الكابتن أوردر، شاشة المطبخ KDS، الطلبات، الديليفري، الطاولات، المنيو، السندات والورديات",
    mainPageKey: "page_restaurant",
    headerGradient: "from-orange-500/20 via-amber-500/10 to-transparent border-orange-500/30",
    accentBadge: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
    permissions: [
      {
        key: "page_restaurant",
        name: "الدخول إلى صفحة إدارة المطعم",
        desc: "إظهار مربع قسم إدارة المطعم في الشاشة الرئيسية والسماح بالدخول إليه (عند عدم اختياره يختفي القسم بالكامل)",
        kind: "main",
      },
      // Sub-section pages
      {
        key: "pos",
        name: "الدخول إلى صفحة نقطة البيع (POS) الكاشير",
        desc: "إظهار صفحة شاشة الكاشير السريعة وإصدار الفواتير الفورية",
        kind: "page",
      },
      {
        key: "captain",
        name: "الدخول إلى صفحة الكابتن أوردر للطاولات",
        desc: "إظهار صفحة خدمة الصالة وطلبات الطاولات وإرسالها للمطبخ",
        kind: "page",
      },
      {
        key: "kitchen",
        name: "الدخول إلى صفحة المطبخ والفرن الذكية (KDS)",
        desc: "إظهار صفحة تحضير الطلبات الحية وشاشة شيف المطبخ",
        kind: "page",
      },
      {
        key: "orders",
        name: "الدخول إلى صفحة متابعة الطلبات والفواتير",
        desc: "إظهار صفحة سجل جميع طلبات الصالة والتيك أواي والفواتير",
        kind: "page",
      },
      {
        key: "delivery",
        name: "الدخول إلى صفحة طلبات التوصيل الخارجي (الديليفري)",
        desc: "إظهار صفحة إدارة طلبات التوصيل الخارجي والسائقين",
        kind: "page",
      },
      {
        key: "page_restaurant_tables",
        name: "الدخول إلى صفحة إدارة الطاولات والباركود QR",
        desc: "إظهار صفحة تخطيط صالة المطعم وحالات الطاولات ورموز QR",
        kind: "page",
      },
      {
        key: "page_restaurant_menu",
        name: "الدخول إلى صفحة قائمة الطعام والوجبات (المنيو)",
        desc: "إظهار صفحة إدارة الأصناف والأسعار والأقسام والوصفات",
        kind: "page",
      },
      {
        key: "page_restaurant_inventory",
        name: "الدخول إلى صفحة مستودع وخامات المطعم",
        desc: "إظهار صفحة أرصدة المواد الغذائية والخامات وحركات الاستهلاك",
        kind: "page",
      },
      {
        key: "page_restaurant_vouchers",
        name: "الدخول إلى صفحة سندات الصرف والقبض للمطعم",
        desc: "إظهار صفحة تسجيل المصروفات اليومية والمقبوضات النقدية للمطعم",
        kind: "page",
      },
      {
        key: "page_restaurant_cashier_treasury",
        name: "الدخول إلى صفحة الكاشير والخزينة",
        desc: "إظهار صفحة متابعة عهدة الكاشير والرصيد النقدي وحركات الخزينة",
        kind: "page",
      },
      {
        key: "restaurant_open_shift",
        name: "الدخول إلى صفحة ورديات كاشير المطعم وإغلاقها",
        desc: "إظهار صفحة فتح وإغلاق وردية كاشير المطعم ومطابقة النقدية",
        kind: "page",
      },
      // Operational actions
      {
        key: "pos_access",
        name: "تسجيل فواتير الكاشير المباشرة وإتمام الدفع",
        desc: "إتمام عمليات البيع وإصدار إيصالات الدفع",
        kind: "action",
      },
      {
        key: "pos_create_custom_order",
        name: "إنشاء طلب مخصص / تعديل بنود فورية بالكاشير",
        desc: "إضافة أصناف حرة أو تعديل أسعار الأصناف يدوياً بالطلب",
        kind: "action",
      },
      {
        key: "pos_apply_discounts",
        name: "تطبيق الخصومات والكوبونات المالية",
        desc: "منح خصم مالي أو نسبة مئوية على إجمالي الفاتورة",
        kind: "action",
      },
      {
        key: "pos_void_items",
        name: "إلغاء وحذف عناصر من الفاتورة الحالية",
        desc: "حذف بند تم اختياره من الفاتورة قبل إتمام الدفع",
        kind: "action",
      },
      {
        key: "restaurant_returns",
        name: "إجراء المرتجعات واسترجاع الفواتير للمطعم",
        desc: "استرجاع الفواتير المكتملة وعكس المبيعات والمنتجات",
        kind: "action",
      },
      {
        key: "orders_view",
        name: "استعراض وتصفية سجل الطلبات والفواتير",
        desc: "البحث في الفواتير المكتملة والمعلقة وتفاصيلها",
        kind: "action",
      },
      {
        key: "orders_create_custom",
        name: "إنشاء طلب جديد / فاتورة مبيعات",
        desc: "إمكانية إنشاء فواتير جديدة وطلبات مخصصة",
        kind: "action",
      },
      {
        key: "orders_cancel_modify",
        name: "تعديل وإلغاء الطلبات بعد تسجيلها",
        desc: "إمكانية إلغاء أو تعديل الطلبات والفواتير بعد تسجيلها",
        kind: "action",
      },
      {
        key: "orders_manage_carts",
        name: "إدارة عربات وسلات الطلب المعلقة",
        desc: "التحكم في عربات التسوق المعلقة للزبائن وحفظها",
        kind: "action",
      },
      {
        key: "orders_generate_qr",
        name: "توليد وطباعة QR Code للطاولات",
        desc: "توليد باركود ورموز QR للطاولات والمنيو الرقمي",
        kind: "action",
      },
      {
        key: "captain_access",
        name: "فتح طلبات جديدة للطاولات",
        desc: "حجز الطاولة وإضافة طلب جديد للزبائن",
        kind: "action",
      },
      {
        key: "captain_create_order",
        name: "تأكيد وإرسال طلب الصالة للمطبخ",
        desc: "إرسال بنود الطلب مباشرة إلى شاشة المطبخ والبار",
        kind: "action",
      },
      {
        key: "captain_transfer_tables",
        name: "نقل وتبديل الطاولات ودمج الحسابات",
        desc: "نقل الزبائن من طاولة لأخرى أو دمج طاولتين",
        kind: "action",
      },
      {
        key: "captain_modify_items",
        name: "تعديل الأصناف والكميات بالكابتن أوردر",
        desc: "تعديل خيارات الطهي والكميات والملاحظات الخاصة للطلب",
        kind: "action",
      },
      {
        key: "kitchen_view",
        name: "متابعة تذاكر وزمن التحضير في المطبخ",
        desc: "مشاهدة تذاكر الطهي الحية ومؤقت التحضير لكل وجبة",
        kind: "action",
      },
      {
        key: "kitchen_change_status",
        name: "تغيير وتحديث حالة إعداد الطلبات بالمطبخ",
        desc: "تحويل حالة الطلب إلى (جاري التجهيز / جاهز للتسليم)",
        kind: "action",
      },
      {
        key: "kitchen_modify_order",
        name: "تعديل تفاصيل الطلب في المطبخ",
        desc: "تعديل مكونات خاصة أو استبعاد صنف غير متوفر بالمطبخ",
        kind: "action",
      },
      {
        key: "delivery_view",
        name: "استعراض طلبات الديليفري وعناوين الزبائن",
        desc: "مشاهدة بيانات الزبائن وعناوين وأوقات التوصيل",
        kind: "action",
      },
      {
        key: "delivery_update_status",
        name: "تعيين السائق وتحديث حالة التوصيل",
        desc: "إسناد الطلب لكابتن التوصيل وتأكيد تحصيل المبالغ",
        kind: "action",
      },
      {
        key: "production",
        name: "إدارة الوصفات والتصنيع للمطعم",
        desc: "إدارة بطاقات الوصفات وأوامر التشغيل",
        kind: "action",
      },
      {
        key: "production_view",
        name: "استعراض بطاقات الوصفات (Recipes) والتكاليف",
        desc: "مشاهدة نسب المكونات وتكلفة إنتاج كل طبق",
        kind: "action",
      },
      {
        key: "production_execute",
        name: "تشغيل وتأكيد أوامر التصنيع والخلطات",
        desc: "خصم الخامات المجمعة وإضافة المنتج التام للمخزن",
        kind: "action",
      },
    ],
  },
  {
    id: "dept_mall",
    name: "2. مربع قسم: إدارة المول",
    shortTitle: "إدارة المول",
    desc: "دليل المحلات والمستأجرين، العقود، متابعة الإيجارات، مصروفات المول، السندات والتقارير",
    mainPageKey: "page_mall",
    headerGradient: "from-violet-500/20 via-purple-500/10 to-transparent border-violet-500/30",
    accentBadge: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
    permissions: [
      {
        key: "page_mall",
        name: "الدخول إلى صفحة إدارة المول",
        desc: "إظهار مربع قسم إدارة المول في الشاشة الرئيسية والسماح بالدخول إليه",
        kind: "main",
      },
      {
        key: "page_mall_shops",
        name: "الدخول إلى صفحة دليل المحلات والمستأجرين والعقود",
        desc: "إظهار صفحة الوحدات التجارية وبيانات المستأجرين وحالة الإشغال",
        kind: "page",
      },
      {
        key: "page_mall_payments",
        name: "الدخول إلى صفحة متابعة الإيجارات والدفعات الشهرية",
        desc: "إظهار صفحة جدول تحصيل الإيجارات والأقساط والمتأخرات",
        kind: "page",
      },
      {
        key: "page_mall_expenses",
        name: "الدخول إلى صفحة مصروفات وتشغيل وصيانة المول",
        desc: "إظهار صفحة فواتير الكهرباء والمياه والنظافة والأمن والصيانة",
        kind: "page",
      },
      {
        key: "page_mall_vouchers",
        name: "الدخول إلى صفحة سندات الصرف والقبض للمول",
        desc: "إظهار صفحة إصدار واعتماد سندات تحصيل الإيجارات ومصروفات المول",
        kind: "page",
      },
      {
        key: "page_mall_reports",
        name: "الدخول إلى صفحة التقارير المالية ونسب الإشغال للمول",
        desc: "إظهار صفحة تقارير صافي عوائد المول والتحليلات المالية",
        kind: "page",
      },
      {
        key: "mall_manage_shops",
        name: "إضافة وتعديل المحلات وعقود الإيجار وتحصيل الدفعات",
        desc: "صلاحية تنفيذ عمليات الإضافة والتعديل والتحصيل داخل صفحات المول",
        kind: "action",
      },
    ],
  },
  {
    id: "dept_park",
    name: "3. مربع قسم: إدارة الحديقة",
    shortTitle: "إدارة الحديقة",
    desc: "نقطة بيع التذاكر والألعاب، ورديات الحديقة، الخزائن الـ 8، سجل التذاكر، العملاء، الأسعار، السندات والتقارير",
    mainPageKey: "page_park",
    headerGradient: "from-emerald-500/20 via-teal-500/10 to-transparent border-emerald-500/30",
    accentBadge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    permissions: [
      {
        key: "page_park",
        name: "الدخول إلى صفحة إدارة الحديقة",
        desc: "إظهار مربع قسم إدارة الحديقة في الشاشة الرئيسية والسماح بالدخول إليه",
        kind: "main",
      },
      {
        key: "page_park_pos",
        name: "الدخول إلى صفحة نقطة بيع تذاكر الدخول والألعاب (POS)",
        desc: "إظهار صفحة إصدار تذاكر البوابات والألعاب الترفيهية الفورية",
        kind: "page",
      },
      {
        key: "page_park_shifts",
        name: "الدخول إلى صفحة ورديات كاشير الحديقة والتشغيل",
        desc: "إظهار صفحة متابعة الورديات المفتوحة وإغلاقها ومطابقة النقدية",
        kind: "page",
      },
      {
        key: "page_park_treasury",
        name: "الدخول إلى صفحة الخزائن التشغيلية الثمانية (8)",
        desc: "إظهار صفحة أرصدة وحركات خزائن الألعاب والبوابات الثمانية",
        kind: "page",
      },
      {
        key: "page_park_tickets_log",
        name: "الدخول إلى صفحة سجل التذاكر واسترجاعها",
        desc: "إظهار صفحة البحث في التذاكر المصدرة وإلغاء أو استرجاع التذاكر",
        kind: "page",
      },
      {
        key: "page_park_customers",
        name: "الدخول إلى صفحة إدارة العملاء واشتراكات الزوار",
        desc: "إظهار صفحة سجل زوار الحديقة والعضويات والباقات العائلية",
        kind: "page",
      },
      {
        key: "page_park_prices",
        name: "الدخول إلى صفحة أسعار التذاكر وفئات الألعاب",
        desc: "إظهار صفحة ضبط أسعار تذاكر البوابات والألعاب والعروض",
        kind: "page",
      },
      {
        key: "page_park_vouchers",
        name: "الدخول إلى صفحة سندات الصرف والقبض للحديقة",
        desc: "إظهار صفحة سندات مصروفات التشغيل والصيانة وإيرادات الحديقة",
        kind: "page",
      },
      {
        key: "park_reports",
        name: "الدخول إلى صفحة تقارير إيرادات الحديقة والورديات",
        desc: "إظهار صفحة إحصائيات التذاكر المباعة وتقارير الإغلاق للحديقة",
        kind: "page",
      },
      // Operational actions
      {
        key: "manage_park_shifts",
        name: "إدارة وتعديل الورديات المفتوحة بالحديقة",
        desc: "صلاحية استعراض الورديات المعلقة للحديقة وتعديلها أو دخولها كمدير",
        kind: "action",
      },
      {
        key: "park_open_shift",
        name: "فتح وردية جديدة لتذاكر الحديقة",
        desc: "إطلاق وردية كاشير تذاكر الدخول والألعاب واستلام العهدة النقدية",
        kind: "action",
      },
      {
        key: "delete_park_shifts",
        name: "حذف وإلغاء ورديات الحديقة المعلقة",
        desc: "صلاحية الحذف النهائي لأي وردية معلقة في النظام",
        kind: "action",
      },
      {
        key: "park_returns",
        name: "إجراء مرتجعات واسترداد تذاكر الحديقة",
        desc: "استرجاع قيمة التذاكر الملغاة للزوار وتسجيل حركة الاسترداد المالي",
        kind: "action",
      },
      {
        key: "mall_garden_finance",
        name: "تسجيل واعتماد الحركات المالية للحديقة والمول",
        desc: "إثبات تذاكر وإيرادات الألعاب ومصروفات التشغيل",
        kind: "action",
      },
    ],
  },
  {
    id: "dept_finance",
    name: "4. مربع قسم: الإدارة المالية",
    shortTitle: "الإدارة المالية",
    desc: "المركز المالي، دفتر الأستاذ، قيود اليومية، السندات، شجرة الحسابات، الخزائن، ميزان المراجعة والقوائم المالية",
    mainPageKey: "page_finance",
    headerGradient: "from-blue-500/20 via-indigo-500/10 to-transparent border-blue-500/30",
    accentBadge: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    permissions: [
      {
        key: "page_finance",
        name: "الدخول إلى صفحة الإدارة المالية",
        desc: "إظهار مربع قسم الإدارة المالية في الشاشة الرئيسية والسماح بالدخول إليه",
        kind: "main",
      },
      {
        key: "page_finance_position",
        name: "الدخول إلى صفحة المركز المالي الشامل والميزانية",
        desc: "إظهار صفحة ملخص الأصول والخصوم والسيولة النقدية وصافي الأرباح",
        kind: "page",
      },
      {
        key: "page_finance_ledger",
        name: "الدخول إلى صفحة كشف حساب الأستاذ العام",
        desc: "إظهار صفحة كشف حساب تفصيلي لأي حساب مع الرصيد التراكمي",
        kind: "page",
      },
      {
        key: "page_finance_journal",
        name: "الدخول إلى صفحة دفتر اليومية العامة والقيود المزدوجة",
        desc: "إظهار صفحة استعراض وإدخال القيود المحاسبية المزدوجة",
        kind: "page",
      },
      {
        key: "page_finance_vouchers",
        name: "الدخول إلى صفحة سندات الصرف والقبض المرحّلة",
        desc: "إظهار صفحة إدارة السندات المالية واعتمادها وطباعتها",
        kind: "page",
      },
      {
        key: "page_finance_accounts",
        name: "الدخول إلى صفحة دليل وشجرة الحسابات",
        desc: "إظهار صفحة هيكلة شجرة الحسابات (الأصول، الالتزامات، الإيرادات، المصروفات)",
        kind: "page",
      },
      {
        key: "page_finance_treasury",
        name: "الدخول إلى صفحة إدارة الخزائن والحسابات البنكية",
        desc: "إظهار صفحة مراقبة أرصدة الخزائن والبنوك والتحويلات",
        kind: "page",
      },
      {
        key: "page_finance_reports",
        name: "الدخول إلى صفحة التقارير المالية والميزانية العمومية",
        desc: "إظهار صفحة التقارير المالية التحليلية ومراكز التكلفة",
        kind: "page",
      },
      {
        key: "page_finance_trial",
        name: "الدخول إلى صفحة ميزان المراجعة المحاسبي",
        desc: "إظهار صفحة مطابقة أرصدة ومجاميع الحسابات المدينة والدائنة",
        kind: "page",
      },
      {
        key: "page_finance_statements",
        name: "الدخول إلى صفحة القوائم المالية الختامية",
        desc: "إظهار صفحة قائمة الدخل والميزانية العمومية والتدفقات النقدية",
        kind: "page",
      },
      {
        key: "page_finance_receipts",
        name: "الدخول إلى صفحة تصميم وإدارة الإيصالات والسندات",
        desc: "إظهار صفحة تخصيص قوالب طباعة الفواتير وسندات القبض والصرف",
        kind: "page",
      },
      // Operational actions
      {
        key: "accounting",
        name: "تفعيل الصلاحيات المحاسبية العامة",
        desc: "التعامل مع الحسابات والقيود داخل الإدارة المالية",
        kind: "action",
      },
      {
        key: "accounting_view",
        name: "استعراض أرصدة الحسابات والتفاصيل المالية",
        desc: "الاطلاع على كشوف الحسابات وموازين المراجعة",
        kind: "action",
      },
      {
        key: "acc_create_account",
        name: "إضافة حسابات جديدة في شجرة الحسابات وتحديد مستوياتها",
        desc: "فتح حسابات جديدة (رئيسية، عامة، فرعية، تحليلية المستوى 1-4) وربطها بالحساب الأب",
        kind: "action",
      },
      {
        key: "acc_edit_account",
        name: "تعديل بيانات ومستويات وأكواد الحسابات في الدليل المحاسبي",
        desc: "تعديل اسم أو كود أو مستوى أو عملة أو ربط الحساب في شجرة الحسابات",
        kind: "action",
      },
      {
        key: "acc_delete_account",
        name: "حذف أو تعطيل الحسابات من شجرة الحسابات",
        desc: "حذف الحسابات غير المستخدمة أو تعطيل الحسابات في الدليل المحاسبي",
        kind: "action",
      },
      {
        key: "accounting_post_journal",
        name: "إنشاء وترحيل قيود اليومية المزدوجة اليدوية",
        desc: "إدخال القيود المزدوجة وترحيلها لدفتر اليومية",
        kind: "action",
      },
      {
        key: "accounting_lock_period",
        name: "قفل وفك قفل الفترات والسنة المالية",
        desc: "حماية القيود من التعديل وإغلاق السنة المالية",
        kind: "action",
      },
      {
        key: "treasury",
        name: "إدارة عمليات الخزائن والبنوك",
        desc: "التحكم في الخزائن النقدية والحسابات البنكية",
        kind: "action",
      },
      {
        key: "treasury_view",
        name: "استعراض الأرصدة وحركات الخزائن والبنوك",
        desc: "متابعة السيولة النقدية والرصيد الفعلي لكل عملة",
        kind: "action",
      },
      {
        key: "treasury_open_close",
        name: "فتح وإغلاق الفترات اليومية للخزينة",
        desc: "إتمام عمليات الإغلاق اليومي واستلام وتسليم العهد",
        kind: "action",
      },
      {
        key: "treasury_transfer_reconcile",
        name: "إجراء التسويات والتحويلات اليدوية بين الخزائن",
        desc: "تحويل أموال بين الخزائن أو تسجيل تسوية عجز/فائض",
        kind: "action",
      },
      {
        key: "journal_approval",
        name: "اعتماد وترحيل قيود اليومية",
        desc: "الموافقة على القيود التلقائية واليدوية وترحيلها النهائي",
        kind: "action",
      },
      {
        key: "expense_approval",
        name: "اعتماد سندات الصرف والمصروفات",
        desc: "مراجعة ودراسة مستندات الصرف واعتماد المصروفات",
        kind: "action",
      },
      {
        key: "revenue_approval",
        name: "اعتماد سندات القبض والإيرادات",
        desc: "اعتماد استلام الإيرادات المتنوعة",
        kind: "action",
      },
      {
        key: "cost_centers",
        name: "إدارة مراكز التكلفة وتحليل الربحية",
        desc: "توزيع السندات وتحليل ربحية القطاعات",
        kind: "action",
      },
      {
        key: "reports",
        name: "تصدير وطباعة التقارير المالية",
        desc: "طباعة وتصدير التقارير والتحليلات الإحصائية",
        kind: "action",
      },
      {
        key: "reports_view_sales",
        name: "استعراض تقارير المبيعات والأرباح والتشغيل",
        desc: "متابعة المبيعات اليومية والشهرية",
        kind: "action",
      },
      {
        key: "reports_view_financials",
        name: "استعراض القوائم المالية والميزانية وقائمة الدخل",
        desc: "الاطلاع على المركز المالي وقائمة الأرباح والخسائر",
        kind: "action",
      },
    ],
  },
  {
    id: "dept_hr",
    name: "5. مربع قسم: الموارد البشرية والمستخدمين",
    shortTitle: "الموارد البشرية والمستخدمين",
    desc: "سجل الموظفين، الحضور والانصراف، مسيرات الرواتب الشهرية، السلف والقروض، وإدارة مستخدمي النظام والصلاحيات",
    mainPageKey: "page_hr",
    headerGradient: "from-pink-500/20 via-rose-500/10 to-transparent border-pink-500/30",
    accentBadge: "bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/30",
    permissions: [
      {
        key: "page_hr",
        name: "الدخول إلى صفحة الموارد البشرية والمستخدمين",
        desc: "إظهار مربع قسم الموارد البشرية والمستخدمين في الشاشة الرئيسية والسماح بالدخول إليه",
        kind: "main",
      },
      {
        key: "page_hr_employees",
        name: "الدخول إلى صفحة سجل وبيانات الموظفين",
        desc: "إظهار صفحة دليل الكادر الوظيفي والأرقام الوظيفية والرواتب الأساسية",
        kind: "page",
      },
      {
        key: "page_hr_attendance",
        name: "الدخول إلى صفحة تسجيل الحضور والانصراف",
        desc: "إظهار صفحة متابعة دوام الموظفين اليومي والغياب والإجازات",
        kind: "page",
      },
      {
        key: "page_hr_payroll",
        name: "الدخول إلى صفحة مسيرات الرواتب الشهرية والبدلات",
        desc: "إظهار صفحة إعداد وصرف الرواتب والمكافآت والخصومات وتوليد قيود المرتبات",
        kind: "page",
      },
      {
        key: "page_hr_loans",
        name: "الدخول إلى صفحة السلف والخصومات والقروض المالية",
        desc: "إظهار صفحة إدارة سلف العاملين وجدولة الأقساط الشهرية",
        kind: "page",
      },
      {
        key: "users_roles",
        name: "الدخول إلى صفحة إدارة مستخدمي النظام والصلاحيات",
        desc: "إظهار صفحة حسابات الدخول وتعيين الأدوار وتخصيص الصلاحيات",
        kind: "page",
      },
      // Operational actions
      {
        key: "hr",
        name: "إضافة وتعديل بيانات الموظفين والملفات الوظيفية",
        desc: "صلاحية إضافة موظفين جدد وتحديث بياناتهم الوظيفية",
        kind: "action",
      },
      {
        key: "hr_view_attendance",
        name: "تسجيل وتعديل حركات الحضور والانصراف",
        desc: "إثبات الحضور والانصراف والغياب اليومي للموظفين",
        kind: "action",
      },
      {
        key: "hr_manage_payroll_loans",
        name: "اعتماد وصرف الرواتب والسلف وإرسال كشوف المرتبات",
        desc: "إصدار مسيرات الرواتب الشهرية وتوليد قيود الصرف وإرسال كشوف المرتبات",
        kind: "action",
      },
      {
        key: "system_manage_users",
        name: "إنشاء وتعديل حسابات المستخدمين وتخصيص جدول الصلاحيات",
        desc: "إنشاء المستخدمين الجدد وتعديل كلمات المرور والصلاحيات",
        kind: "action",
      },
      {
        key: "messenger_broadcast",
        name: "إرسال رسائل جماعية أو تحديد مستخدمين معينين (ماسنجر الزملاء)",
        desc: "صلاحية إرسال تعميم جماعي لجميع الموظفين أو اختيار موظفين محددين",
        kind: "action",
      },
    ],
  },
  {
    id: "dept_inventory",
    name: "6. مربع قسم: إدارة المخزون والمستودعات",
    shortTitle: "المخزون والمستودعات",
    desc: "المخازن والفروع، أصناف المخزون، التحويلات الداخلية، المشتريات، الموردين، حركات المخزن، الصلاحية، الهالك والتقارير",
    mainPageKey: "page_inventory",
    headerGradient: "from-cyan-500/20 via-sky-500/10 to-transparent border-cyan-500/30",
    accentBadge: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
    permissions: [
      {
        key: "page_inventory",
        name: "الدخول إلى صفحة إدارة المخزون والمستودعات",
        desc: "إظهار مربع قسم إدارة المخزون والمستودعات في الشاشة الرئيسية والسماح بالدخول إليه",
        kind: "main",
      },
      {
        key: "page_inventory_warehouses",
        name: "الدخول إلى صفحة إدارة المخازن والفروع",
        desc: "إظهار صفحة استعراض المستودعات الرئيسية والفرعية وقيمتها",
        kind: "page",
      },
      {
        key: "page_inventory_items",
        name: "الدخول إلى صفحة أصناف المخزون وجرد المستودع والباركود",
        desc: "إظهار صفحة دليل الأصناف والكميات الحالية وتنبيهات النواقص",
        kind: "page",
      },
      {
        key: "page_inventory_transfers",
        name: "الدخول إلى صفحة التحويلات الداخلية بين المستودعات",
        desc: "إظهار صفحة نقل البضائع والخامات من المستودع العام للمطابخ",
        kind: "page",
      },
      {
        key: "page_inventory_purchases",
        name: "الدخول إلى صفحة فواتير المشتريات وسندات الاستلام",
        desc: "إظهار صفحة تسجيل فواتير الشراء وتوريد البضائع للمخازن",
        kind: "page",
      },
      {
        key: "page_inventory_suppliers",
        name: "الدخول إلى صفحة إدارة الموردين والشركات",
        desc: "إظهار صفحة بيانات الموردين وكشوف حساباتهم ومستحقاتهم",
        kind: "page",
      },
      {
        key: "page_inventory_transactions",
        name: "الدخول إلى صفحة سجل حركات المخزن والتسويات",
        desc: "إظهار صفحة تتبع كافة حركات الوارد والمنصرف والتسويات الجردية",
        kind: "page",
      },
      {
        key: "page_inventory_expiry",
        name: "الدخول إلى صفحة صلاحية وتتبع الدفعات",
        desc: "إظهار صفحة مراقبة تواريخ انتهاء الصلاحية والتنبيه المبكر",
        kind: "page",
      },
      {
        key: "page_inventory_waste",
        name: "الدخول إلى صفحة تسويات الهالك والتوالف",
        desc: "إظهار صفحة إثبات الأصناف التالفة والمنتهية ومعالجتها محاسبياً",
        kind: "page",
      },
      {
        key: "page_inventory_reports",
        name: "الدخول إلى صفحة تقارير وتحليلات المخزون",
        desc: "إظهار صفحة تقارير تقييم المخزون ومعدلات الدوران والركود",
        kind: "page",
      },
      {
        key: "page_inventory_settings",
        name: "الدخول إلى صفحة إعدادات المخزن",
        desc: "إظهار صفحة وحدات القياس والفئات المخزنية وسياسات التسعير",
        kind: "page",
      },
      // Operational actions
      {
        key: "inventory",
        name: "إضافة وتعديل أصناف وبطاقات المخزون",
        desc: "تعريف أصناف جديدة وتحديث حدود الطلب والأسعار",
        kind: "action",
      },
      {
        key: "inventory_view",
        name: "استعراض كروت الأصناف والأرصدة الحالية",
        desc: "الاطلاع على مستويات المخزون وحد إعادة الطلب",
        kind: "action",
      },
      {
        key: "inventory_adjust_transfer",
        name: "تسجيل التحويلات المخزنية وتسوية الفوارق",
        desc: "تحويل الخامات بين المخزن الرئيسي والمطبخ/الفرع",
        kind: "action",
      },
      {
        key: "inventory_waste_dispose",
        name: "تسجيل واعتماد توالف وهوالك المخزن",
        desc: "إثبات الهدر وإتلاف الخامات المنتهية الصلاحية محاسبياً",
        kind: "action",
      },
      {
        key: "purchasing",
        name: "إدارة عمليات المشتريات والتوريد",
        desc: "التحكم في الموردين وفواتير الشراء الواردة",
        kind: "action",
      },
      {
        key: "purchasing_view",
        name: "استعراض فواتير وحسابات الموردين",
        desc: "مشاهدة كشوف حسابات الموردين والمستحقات",
        kind: "action",
      },
      {
        key: "purchasing_add_invoice",
        name: "إضافة واعتماد فواتير شراء جديدة",
        desc: "إدخال فواتير مشتريات وتحديث تكاليف وأرصدة المخزون",
        kind: "action",
      },
      {
        key: "purchasing_returns",
        name: "تسجيل المرتجعات والتسويات للموردين",
        desc: "إثبات مرتجع مشتريات وخصم قيمتها من رصيد المورد",
        kind: "action",
      },
      {
        key: "inv_manage_suppliers",
        name: "إضافة وتعديل وحذف الموردين وتوليد حساباتهم الشجرية تلقائياً",
        desc: "إنشاء بطاقات موردين جديدة وتوليد رقم حساب تلقائي (24010xxx) في شجرة الحسابات",
        kind: "action",
      },
      {
        key: "inv_manage_waste",
        name: "تسجيل وإدارة التوالف والهالك المخزني واعتماد قيود الإعدام",
        desc: "خصم الأصناف التالفة والمنتهية الصلاحية وترحيل قيد الهالك المحاسبي تلقائياً",
        kind: "action",
      },
      {
        key: "inv_print_smart_count",
        name: "طباعة قوائم وتقارير الجرد الذكي (العادي والأعمى) بمربعات الفحص ☐",
        desc: "طباعة كشوف الجرد الفعلي للمخازن المزودة بمربعات علامة الفحص وخانات العد الفعلي",
        kind: "action",
      },
    ],
  },
  {
    id: "dept_shift_audit",
    name: "7. مربع قسم: تدقيق الورديات وسجل العمليات",
    shortTitle: "تدقيق الورديات وسجل العمليات",
    desc: "مراجعة ومطابقة إغلاقات ورديات الكاشير في المطعم والحديقة وسجل الرقابة الأمنية وتتبع جميع العمليات بالنظام",
    mainPageKey: "page_shift_audit",
    headerGradient: "from-teal-500/20 via-emerald-500/10 to-transparent border-teal-500/30",
    accentBadge: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
    permissions: [
      {
        key: "page_shift_audit",
        name: "الدخول إلى قسم تدقيق الورديات وسجل العمليات",
        desc: "إظهار مربع قسم تدقيق الورديات وسجل العمليات في الشاشة الرئيسية والسماح بالدخول إليه",
        kind: "main",
      },
      {
        key: "page_shift_audit_matching",
        name: "الدخول إلى صفحة عرض ومطابقة الورديات المسجلة",
        desc: "إظهار صفحة مقارنة المبيعات المسجلة بالنقدية الفعلية المسلّمة",
        kind: "page",
      },
      {
        key: "page_shift_audit_variance",
        name: "الدخول إلى صفحة فحص العجز والزيادة النقدية",
        desc: "إظهار صفحة كشف فروقات الصندوق واعتماد تسوية الورديات",
        kind: "page",
      },
      {
        key: "page_audit_logs",
        name: "الدخول إلى تبويب سجل العمليات والرقابة المباشر",
        desc: "السماح باستعراض سجل العمليات والأحداث الرقابية داخل قسم تدقيق الورديات وسجل العمليات",
        kind: "page",
      },
      {
        key: "system_audit_logs",
        name: "تصفية وتصدير سجلات الرقابة الأمنية",
        desc: "إظهار أدوات البحث والتصفية في سجلات الأمان حسب المستخدم أو نوع العملية وتصديرها",
        kind: "page",
      },
      {
        key: "audit_logs",
        name: "استعراض تفاصيل العمليات قبل وبعد التعديل",
        desc: "الاطلاع على القيم السابقة والجديدة في سجل المراقبة الأمني",
        kind: "action",
      },
    ],
  },
  {
    id: "dept_developer",
    name: "8. مربع قسم: خيارات المطور والنسخ الاحتياطي",
    shortTitle: "خيارات المطور والنسخ الاحتياطي",
    desc: "استوديو المطور Pro، النسخ الاحتياطي واستعادة البيانات، تحديثات GitHub، قاعدة بيانات أكسس، وإعدادات الفروع",
    mainPageKey: "page_developer",
    headerGradient: "from-red-500/20 via-rose-500/10 to-transparent border-red-500/30",
    accentBadge: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
    permissions: [
      {
        key: "page_developer",
        name: "الدخول إلى صفحة خيارات المطور والنسخ الاحتياطي",
        desc: "إظهار مربع قسم خيارات المطور والنسخ الاحتياطي في الشاشة الرئيسية والسماح بالدخول إليه",
        kind: "main",
      },
      {
        key: "developer_options",
        name: "الدخول إلى صفحة استوديو المطور Pro (المحرر البصري)",
        desc: "إظهار صفحة تعديل نصوص وألوان وأحجام عناصر الواجهة بصرياً",
        kind: "page",
        isSuperAdminOnly: true,
      },
      {
        key: "system_backup_update",
        name: "الدخول إلى صفحة النسخ الاحتياطي واستعادة البيانات",
        desc: "إظهار صفحة تصدير واستيراد نسخة كاملة من بيانات النظام",
        kind: "page",
      },
      {
        key: "page_system_github",
        name: "الدخول إلى صفحة تحديثات النظام ومزامنة GitHub",
        desc: "إظهار صفحة فحص التحديثات البرمجية وسجل الإصدارات",
        kind: "page",
      },
      {
        key: "page_system_access_db",
        name: "الدخول إلى صفحة حزمة قاعدة بيانات أكسس (MS Access)",
        desc: "إظهار صفحة تحميل وتصدير جداول النظام بصيغة متوافقة مع أكسس",
        kind: "page",
      },
      {
        key: "page_system_status",
        name: "الدخول إلى صفحة فحص الاتصال وحالة الخادم",
        desc: "إظهار صفحة مراقبة اتصال السحابة ومزامنة البيانات الحية",
        kind: "page",
      },
      {
        key: "branch_mgmt",
        name: "الدخول إلى صفحة إعدادات الفروع والمؤسسة",
        desc: "إظهار صفحة إدارة بيانات الفروع والترخيص وإعدادات المؤسسة",
        kind: "page",
      },
      {
        key: "super_admin_full_access",
        name: "صلاحية المدير العام الكاملة (Super Admin Full Override)",
        desc: "تجاوز كامل لكافة القيود وإتاحة الدخول غير المقيد لجميع صفحات النظام",
        kind: "action",
        isSuperAdminOnly: true,
      },
    ],
  },
];

function profileToSystemUser(profile: any): SystemUser {
  const email = String(profile.email || "")
    .trim()
    .toLowerCase();
  return {
    id: String(profile.id || ""),
    employee_code: profile.employee_code ? String(profile.employee_code).trim() : undefined,
    full_name: profile.full_name || profile.username || "",
    username: String(profile.username || email.split("@")[0] || "")
      .trim()
      .toLowerCase(),
    email,
    phone: profile.phone || "",
    role: profile.role || "cashier",
    permissions: (profile.permissions || {}) as UserPermission,
    created_at: profile.created_at || new Date().toISOString(),
  };
}

function localLoginUsers(): SystemUser[] {
  return erpStore
    .getUsers()
    .filter((user) => typeof user.username === "string" && user.username.trim().length > 0);
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
  const storedEmail = String(user.email || "")
    .trim()
    .toLowerCase();
  if (!active || (!storedUsername && !storedEmail)) return false;
  return (
    (!!storedEmail && active === storedEmail) ||
    (!!storedUsername && active === storedUsername) ||
    (!!storedUsername && active.split("@")[0] === storedUsername.split("@")[0])
  );
}

function isUserOnlineSession(
  user: SystemUser | null | undefined,
  activeAuthUser?: string,
  stateCurrentUser?: string,
): boolean {
  if (!user) return false;
  if (isActiveUserRecord(user, activeAuthUser)) return true;
  if (stateCurrentUser && isActiveUserRecord(user, stateCurrentUser)) return true;
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("restocash_online_sessions_v1");
      if (raw) {
        const map = JSON.parse(raw) || {};
        const uname = String(user.username || "")
          .trim()
          .toLowerCase();
        const uemail = String(user.email || "")
          .trim()
          .toLowerCase();
        const code = String(user.employee_code || "").trim();
        if ((uname && map[uname]) || (uemail && map[uemail]) || (code && map[`code:${code}`])) {
          return true;
        }
      }
    } catch {
      // ignore
    }
  }
  return false;
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

function currentActorPermissions(
  state: any,
  authoritativeProfile?: { role?: string; permissions?: Record<string, any> } | null,
): Record<string, boolean> {
  const activeStored = (
    typeof window !== "undefined"
      ? localStorage.getItem("restocash_auth_user") ||
        sessionStorage.getItem("restocash_auth_user") ||
        ""
      : ""
  )
    .trim()
    .toLowerCase();
  const storedRole = (
    typeof window !== "undefined"
      ? localStorage.getItem("restocash_user_role") ||
        sessionStorage.getItem("restocash_user_role") ||
        ""
      : ""
  )
    .trim()
    .toLowerCase();
  const username = String(state?.currentUser || activeStored.split("@")[0] || "")
    .trim()
    .toLowerCase();

  const record = (state?.users || []).find((user: any) => {
    const candidateUsername = String(user.username || "")
      .trim()
      .toLowerCase();
    const candidateEmail = String(user.email || "")
      .trim()
      .toLowerCase();
    return candidateUsername === username || (!!activeStored && candidateEmail === activeStored);
  });

  const actorRole = String(authoritativeProfile?.role || record?.role || storedRole || "cashier")
    .trim()
    .toLowerCase();

  const isAdminActor =
    actorRole === "admin" ||
    actorRole === "super_admin" ||
    username === "admin" ||
    activeStored === "admin" ||
    activeStored.startsWith("admin@") ||
    storedRole === "admin" ||
    storedRole === "super_admin";

  const effectivePerms =
    (authoritativeProfile?.permissions && Object.keys(authoritativeProfile.permissions).length > 0
      ? authoritativeProfile.permissions
      : record?.permissions && Object.keys(record.permissions).length > 0
        ? record.permissions
        : state?.userPermissions?.[username]) || {};

  if (isAdminActor) {
    return {
      ...defaultPermissionsForRole("admin"),
      ...effectivePerms,
      super_admin_full_access: true,
      users_roles: true,
      system_manage_users: true,
    } as Record<string, boolean>;
  }

  if (effectivePerms && Object.keys(effectivePerms).length > 0) {
    return effectivePerms as Record<string, boolean>;
  }

  return defaultPermissionsForRole(actorRole) as unknown as Record<string, boolean>;
}

function canGrantElevatedPermissions(
  state: any,
  authoritativeProfile?: { role?: string; permissions?: Record<string, any> } | null,
): boolean {
  return currentActorPermissions(state, authoritativeProfile).super_admin_full_access === true;
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

  if (role === "admin" || role === "super_admin") {
    throw new Error("لا يمكن إلا للمدير العام منح دور المدير أو المدير العام.");
  }

  for (const [key, value] of Object.entries(proposed)) {
    if (value === true && actorPermissions[key] !== true) {
      throw new Error(`لا يمكنك منح صلاحية لا يمتلكها حسابك: ${key}`);
    }
  }
}

function defaultPermissionsForRole(role: string): UserPermission {
  const permissions: Record<string, boolean> = {};
  PERMISSION_CATEGORIES.forEach((category) => {
    category.permissions.forEach((permission) => {
      permissions[permission.key] = false;
    });
  });
  const roleDefaults = getDefaultPermissionsForRole(role);
  for (const [k, v] of Object.entries(roleDefaults)) {
    permissions[k] = !!v;
  }
  if (role === "admin" || role === "super_admin") {
    permissions.super_admin_full_access = true;
  }
  return permissions as UserPermission;
}

export function UsersPage() {
  const { toast } = useToast();
  const [erpState, setErpState] = useState(erpStore.getState());
  const [localUsers, setLocalUsers] = useState<SystemUser[]>(() => localLoginUsers());
  const [activeAuthUser, setActiveAuthUser] = useState("");
  const [actorProfile, setActorProfile] = useState<any>(null);
  const [isCloudSyncActive, setIsCloudSyncActive] = useState<boolean>(false);
  const [userDirectoryStatus, setUserDirectoryStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [userDirectoryError, setUserDirectoryError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const active =
        localStorage.getItem("restocash_auth_user") ||
        sessionStorage.getItem("restocash_auth_user") ||
        "";
      setActiveAuthUser(active);
      setLocalUsers(localLoginUsers());
    }
  }, []);

  // Delete User State
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  // Form State
  const [form, setForm] = useState(() => ({
    employee_code: erpStore.getNextEmployeeCode(),
    full_name: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "cashier",
  }));
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

  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isSyncingDirectory, setIsSyncingDirectory] = useState<boolean>(false);

  const hasPasswordInputInForm = Boolean(form.password.trim() || form.confirmPassword.trim());
  const effectiveFormEmail =
    form.email.trim() ||
    (editing?.email
      ? editing.email
      : form.username.trim()
        ? `${normalizeManagedUsername(form.username)}@restocash.com`
        : "");

  const formInspection = inspectManagedUserConditions({
    fullName: form.full_name,
    username: form.username,
    email: effectiveFormEmail,
    phone: form.phone,
    password: form.password,
    passwordConfirmation: form.confirmPassword,
    role: form.role,
    hosted: true,
    requireEmail: true,
    requirePassword: !editing || hasPasswordInputInForm,
    requirePasswordConfirmation: !editing || hasPasswordInputInForm,
    existingUsers: localUsers,
    editingUserId: editing?.id || null,
  });

  const pruneDuplicateAdminAccounts = async (
    usersList: SystemUser[],
    currentAuthUserId?: string,
  ): Promise<SystemUser[]> => {
    const admins = usersList.filter((u) => u.role === "admin" || u.role === "super_admin");
    if (admins.length <= 1) return usersList;

    const activeStored =
      typeof window !== "undefined"
        ? (
            localStorage.getItem("restocash_auth_user") ||
            sessionStorage.getItem("restocash_auth_user") ||
            ""
          )
            .trim()
            .toLowerCase()
        : "";

    const keptAdmin =
      admins.find((u) => currentAuthUserId && u.id === currentAuthUserId) ||
      admins.find(
        (u) =>
          activeStored &&
          (String(u.email || "").toLowerCase() === activeStored ||
            String(u.username || "").toLowerCase() === activeStored ||
            String(u.username || "").toLowerCase() === activeStored.split("@")[0]),
      ) ||
      admins.find(
        (u) =>
          u.username !== "admin" && String(u.email || "").toLowerCase() !== "admin@restocash.com",
      ) ||
      admins[0];

    const duplicateAdmins = admins.filter((u) => u.id !== keptAdmin.id);
    for (const dup of duplicateAdmins) {
      erpStore.deleteUser(dup.id);
      if (currentAuthUserId && dup.id !== currentAuthUserId && !String(dup.id).startsWith("u-")) {
        await authService.deleteUser(dup.id).catch(() => undefined);
      }
    }

    return usersList.filter(
      (u) => (u.role !== "admin" && u.role !== "super_admin") || u.id === keptAdmin.id,
    );
  };

  const handleManualCloudSync = async () => {
    setIsSyncingDirectory(true);
    try {
      const summary = await syncPendingUserChanges();
      const result = await syncUsersDirectoryWithDatabase();
      if (result.authUser?.id) {
        const actor = await authService.getProfile(result.authUser.id).catch(() => null);
        if (actor?.id) setActorProfile(actor);
      }
      setIsCloudSyncActive(result.connected);
      setLocalUsers(localLoginUsers());
      setErpState(erpStore.getState());
      setPendingSyncCount(getPendingUserSyncCount());
      notifyPermissionsUpdated();
      toast({
        title: "تمت مزامنة المستخدمين مع قاعدة البيانات ✓",
        description:
          summary.syncedCount > 0
            ? `تمت مزامنة ${summary.syncedCount} حساب/تعديل مع قاعدة البيانات بنجاح.`
            : `جميع المستخدمين (${localLoginUsers().length}) وجداول الصلاحيات متطابقون مع قاعدة البيانات (Supabase).`,
      });
    } catch (err: any) {
      toast({
        title: "تنبيه المزامنة",
        description: userValidationErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setIsSyncingDirectory(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    let hasLoadedDirectory = false;

    const stopSyncWorker = startUserSync();

    const syncLocalState = () => {
      if (!mounted) return;
      setErpState(erpStore.getState());
      setLocalUsers(localLoginUsers());
      setPendingSyncCount(getPendingUserSyncCount());
    };

    const unsubscribe = erpStore.subscribe(syncLocalState);
    if (typeof window !== "undefined") {
      window.addEventListener("restocash-user-sync-updated", syncLocalState);
    }

    const loadUsersDirectory = async () => {
      if (!hasLoadedDirectory) setUserDirectoryStatus("loading");
      setUserDirectoryError("");
      try {
        const result = await syncUsersDirectoryWithDatabase();
        if (!mounted) return;

        if (result.authUser?.id) {
          const actor = await authService.getProfile(result.authUser.id).catch(() => null);
          if (mounted && actor?.id) {
            setActorProfile(actor);
          }
        }

        const cleanedUsers = await pruneDuplicateAdminAccounts(
          localLoginUsers(),
          result.authUser?.id,
        );
        if (!mounted) return;

        if (cleanedUsers.length !== localLoginUsers().length) {
          erpStore.replaceManagedUsers(cleanedUsers);
        }

        setIsCloudSyncActive(result.connected);
        setLocalUsers(localLoginUsers());
        setErpState(erpStore.getState());
        setPendingSyncCount(getPendingUserSyncCount());
        setUserDirectoryStatus("ready");
        setUserDirectoryError("");
        hasLoadedDirectory = true;
        notifyPermissionsUpdated();
      } catch (err: any) {
        if (!mounted) return;
        const fallbackUsers = localLoginUsers();
        if (fallbackUsers.length > 0) {
          setIsCloudSyncActive(false);
          setLocalUsers(fallbackUsers);
          setPendingSyncCount(getPendingUserSyncCount());
          setUserDirectoryStatus("ready");
          setUserDirectoryError("");
          hasLoadedDirectory = true;
          return;
        }
        const rawMessage = String(err?.message || "");
        const message = rawMessage.toLowerCase().includes("auth session missing")
          ? "انتهت جلسة الدخول السحابية؛ يرجى تسجيل الدخول مرة أخرى."
          : rawMessage || "تعذر تحميل دليل المستخدمين من Supabase.";
        setUserDirectoryError(message);
        setUserDirectoryStatus("error");
        console.error("Users directory load failed:", err);
      }
    };

    void loadUsersDirectory();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadUsersDirectory();
      }
    }, 15000);

    const channel = supabase
      .channel("managed-users-directory")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        void loadUsersDirectory();
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shift_audit_logs",
          filter: `shift_id=eq.${GLOBAL_USERS_SYNC_SHIFT_ID}`,
        },
        () => {
          void loadUsersDirectory();
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
      unsubscribe();
      stopSyncWorker();
      if (typeof window !== "undefined") {
        window.removeEventListener("restocash-user-sync-updated", syncLocalState);
      }
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  const upsert = async () => {
    const actorPermissions = currentActorPermissions(erpState, actorProfile);

    if (userDirectoryStatus !== "ready") {
      toast({
        title: "دليل المستخدمين غير جاهز",
        description: userDirectoryError || "انتظر تحميل بيانات المستخدمين ثم أعد المحاولة.",
        variant: "destructive",
      });
      return;
    }

    if (
      !canGrantElevatedPermissions(erpState, actorProfile) &&
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
      const hasPasswordInput = Boolean(form.password.trim() || form.confirmPassword.trim());
      const validatedForm = validateManagedUserForm({
        fullName: form.full_name,
        username: form.username,
        email: effectiveFormEmail,
        phone: form.phone,
        password: form.password,
        passwordConfirmation: form.confirmPassword,
        role: form.role,
        hosted: true,
        requireEmail: true,
        requirePassword: !editing || hasPasswordInput,
        requirePasswordConfirmation: !editing || hasPasswordInput,
        existingUsers: localUsers,
        editingUserId: editing?.id || null,
      });

      const requestedCode =
        String(form.employee_code || "").trim() || erpStore.getNextEmployeeCode();
      const duplicateCodeUser = localUsers.find(
        (u) =>
          u.id !== (editing?.id || "") &&
          String(u.employee_code || "").trim() === requestedCode &&
          u.full_name.trim() !== validatedForm.fullName.trim(),
      );
      if (duplicateCodeUser) {
        toast({
          title: "الرقم الوظيفي مستخدم بالفعل",
          description: `الرقم الوظيفي (#${requestedCode}) مسجل للمستخدم (${duplicateCodeUser.full_name}). يرجى اختيار رقم وظيفي فريد.`,
          variant: "destructive",
        });
        return;
      }

      if (editing) {
        const permissions =
          validatedForm.role !== editing.role
            ? limitPermissionsToActor(
                defaultPermissionsForRole(validatedForm.role),
                actorPermissions,
              )
            : editing.permissions ||
              erpState.userPermissions[editing.username] ||
              defaultPermissionsForRole(form.role);
        assertNoPrivilegeEscalation(permissions as any, validatedForm.role, actorPermissions);

        // 1. Save locally first (Local-First)
        const updatedLocalUser: SystemUser = {
          ...editing,
          employee_code: requestedCode,
          full_name: validatedForm.fullName,
          username: validatedForm.username,
          email: validatedForm.email || editing.email || `${validatedForm.username}@restocash.com`,
          phone: validatedForm.phone,
          role: validatedForm.role as any,
          permissions,
          ...(hasPasswordInput ? { password: validatedForm.password } : {}),
        };

        erpStore.upsertUser(updatedLocalUser);
        erpStore.updateUserPermission(updatedLocalUser.username, permissions);
        setLocalUsers(localLoginUsers());
        setErpState(erpStore.getState());
        notifyPermissionsUpdated();

        // 2. Synchronize with Supabase Database
        const syncResult = await queueUserChange({
          kind: "upsert",
          userId: updatedLocalUser.id,
          username: updatedLocalUser.username,
          password: hasPasswordInput ? validatedForm.password : undefined,
          profile: {
            id: updatedLocalUser.id,
            username: updatedLocalUser.username,
            email: updatedLocalUser.email,
            full_name: updatedLocalUser.full_name,
            phone: updatedLocalUser.phone,
            role: updatedLocalUser.role,
            permissions,
          },
        });

        setLocalUsers(localLoginUsers());
        setErpState(erpStore.getState());
        setPendingSyncCount(getPendingUserSyncCount());
        notifyPermissionsUpdated();

        setEditing(null);
        setForm({
          employee_code: erpStore.getNextEmployeeCode(),
          full_name: "",
          username: "",
          email: "",
          phone: "",
          password: "",
          confirmPassword: "",
          role: "cashier",
        });
        setIsConfirmUpsertOpen(false);
        setUserSubView("list");
        toast({
          title: syncResult.synced
            ? "تم حفظ التعديلات محلياً ومزامنتها مع قاعدة البيانات ✓"
            : "تم حفظ التعديلات محلياً وجارٍ المزامنة مع قاعدة البيانات",
          description: syncResult.synced
            ? `تم تحديث حساب (${updatedLocalUser.username}) برقم وظيفي (#${updatedLocalUser.employee_code}) وصلاحياته بنجاح.`
            : `تم حفظ حساب (${updatedLocalUser.username}) محلياً وسيتم إكمال المزامنة السحابية تلقائياً.`,
        });
        return;
      }

      const permissions = limitPermissionsToActor(
        defaultPermissionsForRole(validatedForm.role),
        actorPermissions,
      );
      assertNoPrivilegeEscalation(permissions as any, validatedForm.role, actorPermissions);

      const emailToUse = validatedForm.email || `${validatedForm.username}@restocash.com`;

      // 1. Save new user locally first (Local-First)
      const localUser: SystemUser = {
        id: `u-${Date.now()}`,
        employee_code: requestedCode,
        full_name: validatedForm.fullName,
        username: validatedForm.username,
        email: emailToUse,
        phone: validatedForm.phone,
        role: validatedForm.role as any,
        password: validatedForm.password,
        permissions,
        created_at: new Date().toISOString(),
      };

      erpStore.upsertUser(localUser);
      erpStore.updateUserPermission(localUser.username, permissions);
      setLocalUsers(localLoginUsers());
      setErpState(erpStore.getState());
      notifyPermissionsUpdated();

      // 2. Synchronize with Supabase Database
      const syncResult = await queueUserChange({
        kind: "create",
        localUserId: localUser.id,
        username: localUser.username,
        email: emailToUse,
        password: validatedForm.password,
        profile: {
          username: localUser.username,
          email: emailToUse,
          full_name: localUser.full_name,
          phone: localUser.phone,
          role: localUser.role,
          permissions,
        },
      });

      setLocalUsers(localLoginUsers());
      setErpState(erpStore.getState());
      setPendingSyncCount(getPendingUserSyncCount());
      notifyPermissionsUpdated();

      setForm({
        employee_code: erpStore.getNextEmployeeCode(),
        full_name: "",
        username: "",
        email: "",
        phone: "",
        password: "",
        confirmPassword: "",
        role: "cashier",
      });
      setIsConfirmUpsertOpen(false);
      setUserSubView("list");
      toast({
        title: syncResult.synced
          ? "تم حفظ المستخدم محلياً ومزامنته مع قاعدة البيانات ✓"
          : "تم حفظ المستخدم محلياً وتفعيل صلاحياته بنجاح ✓",
        description: syncResult.synced
          ? `تم إنشاء الحساب (${validatedForm.username}) محلياً ومزامنته مع قاعدة البيانات (Supabase) بصلاحياته المحددة.`
          : `تم حفظ الحساب (${validatedForm.username}) محلياً وتفعيل جدول صلاحياته فوراً، وجدولة مزامنته مع قاعدة البيانات.`,
      });
    } catch (error: any) {
      toast({
        title: editing ? "تعذر تحديث المستخدم" : "تعذر إنشاء المستخدم",
        description: userValidationErrorMessage(error),
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

    try {
      // 1. Delete locally first
      erpStore.deleteUser(userToDelete);
      setLocalUsers(localLoginUsers());
      setErpState(erpStore.getState());
      notifyPermissionsUpdated();

      // 2. Sync deletion with database
      if (target) {
        await queueUserChange({
          kind: "delete",
          userId: target.id,
          username: target.username,
        });
      }
      setLocalUsers(localLoginUsers());
      setPendingSyncCount(getPendingUserSyncCount());

      toast({
        title: "تم حذف المستخدم ومزامنة الحذف",
        description: "تم حذف الحساب والصلاحيات من النظام ومزامنة التغيير مع قاعدة البيانات.",
      });
    } catch (error: any) {
      toast({
        title: "تعذر حذف المستخدم",
        description: userValidationErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setUserToDelete(null);
      setIsConfirmDeleteOpen(false);
    }
  };

  const [userSubView, setUserSubView] = useState<"list" | "create" | "edit" | "permissions">("list");
  const [permStudioMode, setPermStudioMode] = useState<"live" | "cards">("live");
  const [permStudioUrl, setPermStudioUrl] = useState<string>("/admin?__perm_studio=1");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [permSearch, setPermSearch] = useState<string>("");

  const startCreateNewUser = () => {
    setEditing(null);
    setForm({
      employee_code: erpStore.getNextEmployeeCode(),
      full_name: "",
      username: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      role: "cashier",
    });
    setUserSubView("create");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startEdit = (p: SystemUser) => {
    setEditing(p);
    setForm({
      employee_code: p.employee_code || erpStore.getNextEmployeeCode(),
      full_name: p.full_name ?? "",
      username: p.username ?? "",
      email: p.email || (p.username ? `${p.username}@restocash.com` : ""),
      phone: p.phone ?? "",
      password: "",
      confirmPassword: "",
      role: p.role,
    });
    setUserSubView("edit");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openPermissionsForUser = (user: SystemUser) => {
    setPermissionsUser(user);
    const statePermissions = erpState.userPermissions[user.username];
    const profilePermissions =
      user.permissions && Object.keys(user.permissions).length > 0 ? user.permissions : null;
    const rawCurrent =
      profilePermissions || statePermissions || defaultPermissionsForRole(user.role);
    const hydrated = hydratePagePermissions(rawCurrent as any);
    const explicitPermissions: Record<string, boolean> = {};
    PERMISSION_CATEGORIES.forEach((cat) => {
      cat.permissions.forEach((p) => {
        explicitPermissions[p.key] = !!hydrated[p.key];
      });
    });
    // Preserve any granular UI element checkboxes (`ui_item:...`)
    if (rawCurrent && typeof rawCurrent === "object") {
      Object.entries(rawCurrent).forEach(([k, v]) => {
        if (k.startsWith("ui_item:") && typeof v === "boolean") {
          explicitPermissions[k] = v;
        }
      });
    }
    setEditedPermissions(explicitPermissions as UserPermission);
    setPermStudioUrl("/admin?__perm_studio=1");
    setUserSubView("permissions");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Synchronize editedPermissions with the Live App Permissions Studio iframe
  useEffect(() => {
    if (userSubView !== "permissions" || !editedPermissions) return;
    const iframe = document.getElementById("live-perm-studio-iframe") as HTMLIFrameElement | null;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        {
          type: "PERM_STUDIO_SYNC",
          permissions: editedPermissions,
        },
        window.location.origin,
      );
    }
  }, [userSubView, editedPermissions, permStudioUrl]);

  useEffect(() => {
    if (userSubView !== "permissions") return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || !event.data) return;
      if (event.data.type === "PERM_STUDIO_TOGGLE" && event.data.permKey) {
        const key = String(event.data.permKey);
        setEditedPermissions((prev) => {
          if (!prev) return prev;
          const isCurrentlyChecked =
            key.startsWith("ui_item:") ? (prev as any)[key] !== false : Boolean((prev as any)[key]);
          const nextValue = !isCurrentlyChecked;
          const updated: any = { ...prev, [key]: nextValue };
          if (key !== "super_admin_full_access") {
            updated.super_admin_full_access = false;
          }
          const parentCat = PERMISSION_CATEGORIES.find((cat) =>
            cat.permissions.some((p) => p.key === key),
          );
          if (parentCat) {
            if (key === parentCat.mainPageKey) {
              if (!nextValue) {
                parentCat.permissions.forEach((p) => {
                  updated[p.key] = false;
                });
              } else {
                const anySub = parentCat.permissions.some(
                  (p) => p.key !== parentCat.mainPageKey && !!updated[p.key],
                );
                if (!anySub) {
                  parentCat.permissions.forEach((p) => {
                    if (!p.isSuperAdminOnly) updated[p.key] = true;
                  });
                }
              }
            } else if (nextValue) {
              updated[parentCat.mainPageKey] = true;
            }
          }
          return updated;
        });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [userSubView]);

  const handleSavePermissions = async () => {
    if (!permissionsUser || !editedPermissions) return;
    try {
      if (userDirectoryStatus !== "ready") {
        throw new Error(userDirectoryError || "دليل المستخدمين غير جاهز.");
      }

      assertNoPrivilegeEscalation(
        editedPermissions as any,
        permissionsUser.role,
        currentActorPermissions(erpStore.getState(), actorProfile),
      );

      // Ensure all keys across all main section boxes + granular UI items are explicitly boolean
      const normalizedToSave: Record<string, boolean> = {};
      PERMISSION_CATEGORIES.forEach((cat) => {
        cat.permissions.forEach((p) => {
          normalizedToSave[p.key] = !!editedPermissions[p.key];
        });
      });
      Object.entries(editedPermissions).forEach(([k, v]) => {
        if (k.startsWith("ui_item:") && typeof v === "boolean") {
          normalizedToSave[k] = v;
        }
      });

      // 1. Save permissions locally first
      const updatedUser: SystemUser = {
        ...permissionsUser,
        permissions: normalizedToSave as UserPermission,
      };
      erpStore.upsertUser(updatedUser);
      erpStore.updateUserPermission(updatedUser.username, normalizedToSave);
      setLocalUsers(localLoginUsers());
      setErpState(erpStore.getState());
      notifyPermissionsUpdated();

      // 2. Synchronize permissions with Supabase database
      const syncResult = await queueUserChange({
        kind: "upsert",
        userId: updatedUser.id,
        username: updatedUser.username,
        profile: {
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email || `${updatedUser.username}@restocash.com`,
          full_name: updatedUser.full_name,
          phone: updatedUser.phone,
          role: updatedUser.role,
          permissions: normalizedToSave,
        },
      });

      setLocalUsers(localLoginUsers());
      setErpState(erpStore.getState());
      setPendingSyncCount(getPendingUserSyncCount());
      notifyPermissionsUpdated();
      setIsConfirmSavePermsOpen(false);
      setPermissionsUser(null);
      setEditedPermissions(null);
      setUserSubView("list");
      toast({
        title: syncResult.synced
          ? "تم حفظ الصلاحيات محلياً ومزامنتها مع قاعدة البيانات ✓"
          : "تم حفظ الصلاحيات محلياً وتفعيلها بنجاح ✓",
        description:
          "تم تطبيق الصلاحيات الجديدة فوراً وإخفاء كافة العناصر والصفحات غير المحددة عن هذا المستخدم.",
      });
    } catch (error: any) {
      toast({
        title: "تعذر حفظ الصلاحيات",
        description: userValidationErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const togglePermission = (key: keyof UserPermission, category?: PermissionCategory) => {
    if (!editedPermissions) return;
    const nextValue = !editedPermissions[key];
    const updated: any = { ...editedPermissions, [key]: nextValue };
    if (key !== "super_admin_full_access") {
      updated.super_admin_full_access = false;
    }

    const parentCat =
      category || PERMISSION_CATEGORIES.find((cat) => cat.permissions.some((p) => p.key === key));

    if (parentCat) {
      if (key === parentCat.mainPageKey) {
        if (!nextValue) {
          parentCat.permissions.forEach((p) => {
            updated[p.key] = false;
          });
        } else {
          const anySubEnabled = parentCat.permissions.some(
            (p) => p.key !== parentCat.mainPageKey && !!updated[p.key],
          );
          if (!anySubEnabled) {
            parentCat.permissions.forEach((p) => {
              if (!p.isSuperAdminOnly) {
                updated[p.key] = true;
              }
            });
          }
        }
      } else {
        if (nextValue) {
          updated[parentCat.mainPageKey] = true;
        } else {
          const pageItems = parentCat.permissions.filter((p) => p.kind === "page");
          if (pageItems.length > 0 && pageItems.every((p) => !updated[p.key])) {
            updated[parentCat.mainPageKey] = false;
          }
        }
      }
    }

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
    const presetPerms = defaultPermissionsForRole(preset);
    setEditedPermissions({ ...presetPerms });
  };

  const navigatePermStudioIframe = (targetPath: string) => {
    const nextUrl = targetPath.includes("?")
      ? `${targetPath}&__perm_studio=1`
      : `${targetPath}?__perm_studio=1`;
    setPermStudioUrl(nextUrl);
    const iframe = document.getElementById("live-perm-studio-iframe") as HTMLIFrameElement | null;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        {
          type: "PERM_STUDIO_NAVIGATE",
          url: nextUrl,
        },
        window.location.origin,
      );
    }
  };

  const [viewMode, setViewMode] = useViewMode("users-directory", "list");

  return (
    <div className="space-y-6 p-1 sm:p-2">
      {/* ===================================================================== */}
      {/* STANDALONE SUB-VIEW 1 & 2: CREATE NEW USER OR EDIT EXISTING USER      */}
      {/* ===================================================================== */}
      {(userSubView === "create" || userSubView === "edit") && (
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-foreground">
                  {userSubView === "edit" && editing
                    ? `تعديل بيانات المستخدم (${editing.full_name || editing.username})`
                    : "إضافة مستخدم جديد"}
                </h1>
              </div>
            </div>
            <Button
              variant="close"
              className="h-9 px-4 rounded-xl font-bold gap-2"
              onClick={() => {
                setEditing(null);
                setUserSubView("list");
              }}
            >
              <Undo2 size={15} />
              رجوع إلى المستخدمين والصلاحيات
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 bg-card border border-border p-5 rounded-2xl shadow-sm">
            <div className="md:col-span-2 lg:col-span-1">
              <Label className="text-xs font-bold">الرقم الوظيفي *</Label>
              <div className="flex items-center gap-1 mt-1">
                <Input
                  className="h-9 rounded-xl border-primary/40 bg-primary/5 px-3 text-xs font-mono font-black text-primary"
                  placeholder="1006"
                  maxLength={20}
                  value={form.employee_code}
                  onChange={(e) => setForm((s) => ({ ...s, employee_code: e.target.value }))}
                  dir="ltr"
                />
              </div>
            </div>
            <div className="md:col-span-2 lg:col-span-1">
              <Label className="text-xs font-bold">ربط بموظف من الموارد البشرية</Label>
              <select
                className="w-full h-9 rounded-xl border border-input bg-background px-2.5 text-xs font-bold mt-1"
                value=""
                onChange={(e) => {
                  const empId = e.target.value;
                  if (!empId) return;
                  const emp = (erpState.employees || []).find((item) => item.id === empId);
                  if (emp) {
                    setForm((s) => ({
                      ...s,
                      employee_code: emp.employee_code || s.employee_code,
                      full_name: emp.name || s.full_name,
                      phone: emp.phone || s.phone,
                    }));
                  }
                }}
              >
                <option value="">-- اختر موظف --</option>
                {(erpState.employees || []).map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    #{emp.employee_code} - {emp.name} ({emp.job_title})
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 lg:col-span-1">
              <Label className="text-xs font-bold">الاسم الكامل *</Label>
              <Input
                className="h-9 rounded-xl border-input bg-background px-3 text-xs mt-1"
                placeholder="مثال: أحمد محمد"
                maxLength={120}
                value={form.full_name}
                onChange={(e) => setForm((s) => ({ ...s, full_name: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2 lg:col-span-1">
              <Label className="text-xs font-bold">اسم المستخدم (Username) *</Label>
              <Input
                className="h-9 rounded-xl border-input bg-background px-3 text-xs mt-1 font-mono"
                placeholder="مثال: ahmed.cashier"
                minLength={3}
                maxLength={32}
                autoComplete="username"
                value={form.username}
                onChange={(e) => {
                  const nextUsername = e.target.value;
                  setForm((s) => {
                    const prevAutoEmail = s.username
                      ? `${normalizeManagedUsername(s.username)}@restocash.com`
                      : "";
                    const shouldAutoFillEmail = !editing && (!s.email || s.email === prevAutoEmail);
                    return {
                      ...s,
                      username: nextUsername,
                      email:
                        shouldAutoFillEmail && nextUsername.trim()
                          ? `${normalizeManagedUsername(nextUsername)}@restocash.com`
                          : s.email,
                    };
                  });
                }}
                dir="ltr"
              />
            </div>
            <div className="md:col-span-2 lg:col-span-1">
              <Label className="text-xs font-bold">البريد الإلكتروني *</Label>
              <Input
                type="email"
                className="h-9 rounded-xl border-input bg-background px-3 text-xs mt-1 font-mono"
                placeholder="user@restocash.com"
                autoComplete="email"
                required
                value={form.email}
                onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                dir="ltr"
              />
            </div>
            <div className="md:col-span-2 lg:col-span-1">
              <Label className="text-xs font-bold">رقم الهاتف</Label>
              <Input
                className="h-9 rounded-xl border-input bg-background px-3 text-xs mt-1"
                placeholder="01xxxxxxxxx"
                maxLength={40}
                value={form.phone}
                onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2 lg:col-span-2">
              <Label className="text-xs font-bold">
                {editing ? "الرقم السري الجديد (اختياري)" : "الرقم السري الجديد *"}
              </Label>
              <Input
                type="password"
                className="h-9 rounded-xl border-input bg-background px-3 text-xs mt-1"
                placeholder={editing ? "اتركه فارغاً لعدم التغيير" : "8 خانات (حروف + أرقام)"}
                value={form.password}
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2 lg:col-span-2">
              <Label className="text-xs font-bold">تأكيد الرقم السري *</Label>
              <Input
                type="password"
                className="h-9 rounded-xl border-input bg-background px-3 text-xs mt-1"
                placeholder={editing ? "اتركه فارغًا دون تغيير" : "أعد كتابة الرقم السري"}
                required={!editing || Boolean(form.password)}
                minLength={8}
                maxLength={128}
                value={form.confirmPassword}
                onChange={(e) => setForm((s) => ({ ...s, confirmPassword: e.target.value }))}
                autoComplete="new-password"
              />
            </div>
            <div className="md:col-span-2 lg:col-span-2">
              <Label className="text-xs font-bold">الدور الوظيفي الأساسي *</Label>
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

            {/* Live Database Requirements Indicator */}
            <div className="md:col-span-6 grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-border/60">
              <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-foreground">
                    شروط الاسم واسم المستخدم والبريد:
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-bold ${
                      formInspection.isFullNameValid &&
                      formInspection.isUsernameValid &&
                      formInspection.isEmailValid
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                    }`}
                  >
                    {formInspection.isFullNameValid &&
                    formInspection.isUsernameValid &&
                    formInspection.isEmailValid
                      ? "مستوفاة ✓"
                      : "غير مستوفى"}
                  </Badge>
                </div>
                <ul className="space-y-1 text-[11px]">
                  {[
                    ...formInspection.fullNameChecks,
                    ...formInspection.usernameChecks,
                    ...formInspection.emailChecks,
                  ].map((rule) => (
                    <li
                      key={rule.id}
                      className={`flex items-center gap-1.5 font-semibold ${
                        rule.met ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                      }`}
                    >
                      {rule.met ? (
                        <CheckCircle2 size={13} className="shrink-0" />
                      ) : (
                        <AlertCircle size={13} className="shrink-0" />
                      )}
                      <span>{rule.label}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-foreground">
                    شروط الرقم السري:
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-bold ${
                      formInspection.passwordChecks.length === 0
                        ? "bg-muted text-muted-foreground"
                        : formInspection.isPasswordValid
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                    }`}
                  >
                    {formInspection.passwordChecks.length === 0
                      ? "بدون تغيير"
                      : formInspection.isPasswordValid
                        ? "مستوفاة ✓"
                        : "غير مستوفى"}
                  </Badge>
                </div>
                {formInspection.passwordChecks.length > 0 && (
                  <ul className="space-y-1 text-[11px]">
                    {formInspection.passwordChecks.map((rule) => (
                      <li
                        key={rule.id}
                        className={`flex items-center gap-1.5 font-semibold ${
                          rule.met ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                        }`}
                      >
                        {rule.met ? (
                          <CheckCircle2 size={13} className="shrink-0" />
                        ) : (
                          <AlertCircle size={13} className="shrink-0" />
                        )}
                        <span>{rule.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="md:col-span-6 flex justify-end items-center flex-wrap gap-2 mt-2">
              <Button
                variant="close"
                className="h-9 px-6 rounded-xl font-bold"
                onClick={() => {
                  setEditing(null);
                  setUserSubView("list");
                }}
              >
                إلغاء
              </Button>
              <Button
                variant="save"
                className="h-9 px-6 rounded-xl font-bold gap-2"
                onClick={() => setIsConfirmUpsertOpen(true)}
                disabled={!formInspection.isValid || userDirectoryStatus !== "ready"}
              >
                <Save size={16} />
                {editing ? "حفظ التعديلات" : "حفظ المستخدم الجديد"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* STANDALONE SUB-VIEW 3: LIVE INTERACTIVE PERMISSIONS STUDIO            */}
      {/* ===================================================================== */}
      {userSubView === "permissions" && permissionsUser && (
        <div className="space-y-4">
          {/* Top Studio Header Bar (Zero explanatory descriptions) */}
          <div className="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5 flex-wrap">
                <ShieldCheck className="text-primary h-6 w-6 shrink-0" />
                <h1 className="text-lg sm:text-xl font-black text-foreground">
                  صلاحيات المستخدم: {permissionsUser.full_name} ({permissionsUser.username})
                </h1>
                <span className="bg-primary/10 text-primary border border-primary/20 px-3 py-0.5 rounded-full font-bold text-xs">
                  {roleLabels[permissionsUser.role || "cashier"] || permissionsUser.role}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="save"
                  className="h-9 px-5 rounded-xl font-bold gap-2"
                  onClick={() => setIsConfirmSavePermsOpen(true)}
                >
                  <Save size={16} />
                  حفظ الصلاحيات
                </Button>
                <Button
                  variant="close"
                  className="h-9 px-4 rounded-xl font-bold gap-1.5"
                  onClick={() => {
                    setPermissionsUser(null);
                    setEditedPermissions(null);
                    setUserSubView("list");
                  }}
                >
                  <Undo2 size={15} />
                  رجوع
                </Button>
              </div>
            </div>

            {/* Role Presets + Bulk Check/Uncheck + Studio View Switcher */}
            <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-border/60">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  variant="save"
                  size="sm"
                  className="h-8 text-xs font-bold rounded-lg"
                  onClick={() => selectAllPerms(true)}
                >
                  تحديد الكل ☑
                </Button>
                <Button
                  variant="delete"
                  size="sm"
                  className="h-8 text-xs font-bold rounded-lg"
                  onClick={() => selectAllPerms(false)}
                >
                  إلغاء تحديد الكل ☐
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-bold rounded-lg"
                  onClick={() => applyRolePreset("super_admin")}
                >
                  المدير العام
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-bold rounded-lg"
                  onClick={() => applyRolePreset("manager")}
                >
                  المشرف / المحاسب
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-bold rounded-lg"
                  onClick={() => applyRolePreset("cashier")}
                >
                  الكاشير
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-bold rounded-lg"
                  onClick={() => applyRolePreset("captain")}
                >
                  كابتن الصالة
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-bold rounded-lg"
                  onClick={() => applyRolePreset("kitchen")}
                >
                  المطبخ
                </Button>
              </div>

              <div className="inline-flex items-center gap-1 rounded-xl bg-muted/60 p-1 border border-border">
                <button
                  type="button"
                  onClick={() => setPermStudioMode("live")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                    permStudioMode === "live"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  البرنامج التفاعلي الحي ☑️
                </button>
                <button
                  type="button"
                  onClick={() => setPermStudioMode("cards")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                    permStudioMode === "cards"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  جميع مربعات الأقسام والصفحات ☑️
                </button>
              </div>
            </div>
          </div>

          {permStudioMode === "live" ? (
            <div className="space-y-3">
              {/* Quick Department Navigator Bar with Direct Checkboxes */}
              <div className="bg-card border border-border rounded-2xl p-2.5 flex items-center gap-1.5 flex-wrap shadow-2xs">
                <button
                  type="button"
                  onClick={() => navigatePermStudioIframe("/admin")}
                  className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary border border-primary/25 text-xs font-black hover:bg-primary/20 transition cursor-pointer"
                >
                  🏠 الشاشة الرئيسية للأقسام
                </button>
                {[
                  { label: "إدارة المطعم", to: "/admin/restaurant", key: "page_restaurant" as const },
                  { label: "إدارة المول", to: "/admin/mall", key: "page_mall" as const },
                  { label: "إدارة الحديقة", to: "/admin/park", key: "page_park" as const },
                  { label: "الإدارة المالية", to: "/admin/ledger", key: "page_finance" as const },
                  { label: "الموارد البشرية", to: "/admin/hr", key: "page_hr" as const },
                  { label: "المخزون والمستودعات", to: "/admin/inventory", key: "page_inventory" as const },
                  {
                    label: "تدقيق الورديات وسجل العمليات",
                    to: "/admin?tab=shift_audit",
                    key: "page_shift_audit" as const,
                  },
                  {
                    label: "خيارات المطور والنسخ الاحتياطي",
                    to: "/admin/system-update",
                    key: "page_developer" as const,
                  },
                ].map((deptNav) => {
                  const isDeptChecked = editedPermissions
                    ? !!editedPermissions[deptNav.key]
                    : false;
                  const catObj = PERMISSION_CATEGORIES.find(
                    (c) => c.mainPageKey === deptNav.key,
                  );
                  return (
                    <div
                      key={deptNav.key}
                      className={`inline-flex items-center rounded-xl border overflow-hidden text-xs font-bold transition ${
                        isDeptChecked
                          ? "bg-emerald-500/10 border-emerald-500/40 text-foreground"
                          : "bg-muted/40 border-border text-muted-foreground opacity-65"
                      }`}
                    >
                      <label className="inline-flex items-center px-2 py-1.5 cursor-pointer hover:bg-muted/50 border-l border-border/50">
                        <input
                          type="checkbox"
                          checked={isDeptChecked}
                          onChange={() => togglePermission(deptNav.key, catObj)}
                          className="h-4 w-4 rounded border-input text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => navigatePermStudioIframe(deptNav.to)}
                        className="px-2.5 py-1.5 hover:bg-muted/60 transition cursor-pointer font-black"
                      >
                        {deptNav.label}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Live Interactive Application Canvas (Just like Developer Studio) */}
              <div className="bg-card border-2 border-primary/30 rounded-2xl overflow-hidden shadow-md">
                <iframe
                  id="live-perm-studio-iframe"
                  title="استوديو تحديد الصلاحيات المباشر"
                  src={permStudioUrl}
                  onLoad={(e) => {
                    const win = e.currentTarget.contentWindow;
                    if (win && editedPermissions) {
                      win.postMessage(
                        {
                          type: "PERM_STUDIO_SYNC",
                          permissions: editedPermissions,
                        },
                        window.location.origin,
                      );
                    }
                  }}
                  className="w-full h-[76vh] border-0 bg-background"
                />
              </div>
            </div>
          ) : (
            /* Clean Checkboxes Grid Mode (All explanatory texts removed!) */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative w-full sm:flex-1">
                  <Input
                    placeholder="ابحث باسم القسم أو الصفحة أو الزر..."
                    value={permSearch}
                    onChange={(e) => setPermSearch(e.target.value)}
                    className="h-9 text-xs pr-3 rounded-xl border-border"
                  />
                </div>
                <div className="w-full sm:w-72">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full h-9 rounded-xl border border-input bg-background px-3 text-xs font-bold"
                  >
                    <option value="ALL">جميع الأقسام الرئيسية</option>
                    {PERMISSION_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.shortTitle}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                {PERMISSION_CATEGORIES.filter(
                  (cat) => categoryFilter === "ALL" || categoryFilter === cat.id,
                ).map((cat) => {
                  const filteredPerms = cat.permissions.filter((p) => {
                    if (!permSearch.trim()) return true;
                    const query = permSearch.toLowerCase();
                    return (
                      p.name.toLowerCase().includes(query) ||
                      String(p.key).toLowerCase().includes(query)
                    );
                  });

                  if (filteredPerms.length === 0) return null;

                  const subPageItems = filteredPerms.filter((p) => p.kind === "page");
                  const actionItems = filteredPerms.filter((p) => p.kind === "action");
                  const isMainEnabled = editedPermissions
                    ? !!editedPermissions[cat.mainPageKey]
                    : false;

                  const enabledCount = cat.permissions.filter(
                    (p) => editedPermissions && !!editedPermissions[p.key],
                  ).length;
                  const isAllCategoryChecked = enabledCount === cat.permissions.length;

                  return (
                    <div
                      key={cat.id}
                      className={`bg-card border-2 rounded-2xl overflow-hidden shadow-xs transition ${
                        isMainEnabled ? "border-border" : "border-dashed border-muted-foreground/30 opacity-65"
                      }`}
                    >
                      {/* Department Header with Direct Checkbox (Zero descriptive text) */}
                      <div
                        className={`bg-gradient-to-l ${cat.headerGradient} p-3.5 border-b border-border/60 flex items-center justify-between flex-wrap gap-3`}
                      >
                        <label
                          onClick={() => togglePermission(cat.mainPageKey, cat)}
                          className="flex items-center gap-3 cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={isMainEnabled}
                            onChange={() => {}}
                            className="h-5 w-5 rounded border-input text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                          />
                          <span className="font-black text-base text-foreground">
                            {cat.shortTitle}
                          </span>
                        </label>

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-3 text-xs font-bold rounded-xl"
                          onClick={() => toggleCategoryPerms(cat, !isAllCategoryChecked)}
                        >
                          {isAllCategoryChecked ? "إلغاء تحديد القسم ☐" : "تحديد كامل القسم ☑"}
                        </Button>
                      </div>

                      <div className="p-3.5 space-y-3 bg-background/50">
                        {subPageItems.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {subPageItems.map((perm) => {
                              const isChecked = editedPermissions
                                ? !!editedPermissions[perm.key]
                                : false;
                              return (
                                <div
                                  key={perm.key}
                                  onClick={() => togglePermission(perm.key, cat)}
                                  className={`flex items-center gap-2.5 p-3 rounded-xl border transition cursor-pointer select-none ${
                                    isChecked
                                      ? "bg-primary/5 border-primary/40 shadow-xs ring-1 ring-primary/20"
                                      : "bg-card border-border/70 hover:bg-muted/20 opacity-65"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {}}
                                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary cursor-pointer shrink-0"
                                  />
                                  <span className="font-bold text-xs text-foreground leading-snug flex-1">
                                    {perm.name}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {actionItems.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-2 border-t border-border/50">
                            {actionItems.map((perm) => {
                              const isChecked = editedPermissions
                                ? !!editedPermissions[perm.key]
                                : false;
                              return (
                                <div
                                  key={perm.key}
                                  onClick={() => togglePermission(perm.key, cat)}
                                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition cursor-pointer select-none ${
                                    isChecked
                                      ? "bg-emerald-500/5 border-emerald-500/30"
                                      : "bg-card border-border/60 hover:bg-muted/20 opacity-65"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {}}
                                    className="h-4 w-4 rounded border-input text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                                  />
                                  <span className="font-bold text-xs text-foreground leading-snug flex-1">
                                    {perm.name}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* DEFAULT SUB-VIEW ("list"): ACTION CARD BOX + USERS DIRECTORY          */}
      {/* ===================================================================== */}
      {userSubView === "list" && (
        <>
          {/* Page Header */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              المستخدمين والصلاحيات
            </h1>
            <div className="flex items-center gap-2">
              <ViewModeToggle mode={viewMode} onChange={setViewMode} />
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-bold gap-1.5 rounded-xl"
                onClick={handleManualCloudSync}
                disabled={isSyncingDirectory}
              >
                <RefreshCw size={14} className={isSyncingDirectory ? "animate-spin" : ""} />
                {isSyncingDirectory
                  ? "جارٍ المزامنة..."
                  : `مزامنة قاعدة البيانات${pendingSyncCount > 0 ? ` (${pendingSyncCount})` : ""}`}
              </Button>
            </div>
          </div>

          {/* Action Card Box (Matching Restaurant Management cards like "فتح وردية جديدة") */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <button
              type="button"
              data-perm-key="system_manage_users"
              onClick={startCreateNewUser}
              className="group text-right bg-card hover:bg-primary/5 border-2 border-primary/25 hover:border-primary rounded-2xl p-5 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 group-hover:bg-primary group-hover:text-primary-foreground text-primary flex items-center justify-center transition-colors shrink-0">
                  <UsersIcon size={24} />
                </div>
                <div>
                  <h3 className="font-black text-base text-foreground group-hover:text-primary transition-colors">
                    إضافة مستخدم جديد
                  </h3>
                </div>
              </div>
              <span className="text-xs font-black text-primary underline underline-offset-4">
                فتح ←
              </span>
            </button>
          </div>

          {/* Registered Users Directory */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-foreground">
                دليل المستخدمين المسجلين ({localUsers.length})
              </h3>
              <ViewModeToggle mode={viewMode} onChange={setViewMode} />
            </div>

            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {localUsers.map((u) => {
                  const matchedEmp = (erpState.employees || []).find(
                    (emp) =>
                      (u.employee_code && emp.employee_code === u.employee_code) ||
                      (u.full_name && emp.name.trim() === u.full_name.trim()),
                  );
                  const displayCode = u.employee_code || matchedEmp?.employee_code || "-";
                  return (
                    <div
                      key={u.id}
                      className="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-3 flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/25 font-mono font-black text-xs">
                          #{displayCode}
                        </span>
                        <span className="bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded-full font-black text-[10px]">
                          {roleLabels[u.role] ?? u.role}
                        </span>
                      </div>
                      <div>
                        <div className="font-bold text-sm text-foreground">{u.full_name || "-"}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {u.username || "-"}
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-border/60">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2.5 rounded-lg gap-1.5 text-primary border-primary/30 hover:bg-primary/10 font-bold text-xs"
                          onClick={() => openPermissionsForUser(u)}
                          disabled={userDirectoryStatus !== "ready"}
                        >
                          <ShieldCheck size={13} />
                          الصلاحيات
                        </Button>
                        <Button
                          size="sm"
                          variant="edit"
                          className="h-8 px-2.5 rounded-lg gap-1 font-bold text-xs"
                          onClick={() => startEdit(u)}
                          disabled={userDirectoryStatus !== "ready"}
                        >
                          <Pencil size={13} />
                          تعديل
                        </Button>
                        <Button
                          size="icon"
                          variant="delete"
                          className="h-8 w-8 rounded-lg"
                          onClick={() => {
                            setUserToDelete(u.id);
                            setIsConfirmDeleteOpen(true);
                          }}
                          disabled={
                            isActiveUserRecord(u, activeAuthUser) || userDirectoryStatus !== "ready"
                          }
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-xs">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="text-right p-3 font-bold">الرقم الوظيفي</th>
                      <th className="text-right p-3 font-bold">الاسم الكامل</th>
                      <th className="text-right p-3 font-bold">اسم المستخدم / البريد الإلكتروني</th>
                      <th className="text-right p-3 font-bold">حالة الاتصال</th>
                      <th className="text-right p-3 font-bold">رقم الهاتف</th>
                      <th className="text-right p-3 font-bold">الدور الوظيفي</th>
                      <th className="text-right p-3 font-bold">حالة المزامنة</th>
                      <th className="text-center p-3 font-bold w-48">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-semibold">
                    {localUsers.map((u) => {
                      const isCloudUuid =
                        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                          String(u.id || ""),
                        );
                      const isPending = hasPendingUserChange(u.id, u.username);
                      const syncError = getPendingUserError(u.id, u.username);
                      const isOnlineNow = isUserOnlineSession(u, activeAuthUser, erpState.currentUser);
                      const matchedEmp = (erpState.employees || []).find(
                        (emp) =>
                          (u.employee_code && emp.employee_code === u.employee_code) ||
                          (u.full_name && emp.name.trim() === u.full_name.trim()),
                      );
                      const displayCode = u.employee_code || matchedEmp?.employee_code || "-";
                      return (
                        <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/25 font-mono font-black text-xs">
                              #{displayCode}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-foreground">{u.full_name || "-"}</td>
                          <td className="p-3">
                            <div className="font-mono font-bold">{u.username || "-"}</div>
                            {u.email && (
                              <div
                                className="font-mono text-[10px] text-muted-foreground mt-1"
                                dir="ltr"
                              >
                                {u.email}
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            {isOnlineNow ? (
                              <span className="inline-flex items-center gap-1.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-black">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                أونلاين
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-400/30 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                                <span className="h-2 w-2 rounded-full bg-slate-400" />
                                أوفلاين
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-mono">{u.phone || "-"}</td>
                          <td className="p-3">
                            <span className="bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded-full font-black text-[10px]">
                              {roleLabels[u.role] ?? u.role}
                            </span>
                          </td>
                          <td className="p-3">
                            {isPending ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                  قيد المزامنة
                                </span>
                                {syncError && (
                                  <div
                                    className="text-[10px] text-destructive max-w-[200px] truncate"
                                    title={syncError}
                                  >
                                    {syncError}
                                  </div>
                                )}
                              </div>
                            ) : isCloudUuid || isCloudSyncActive ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                متزامن ✓
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                محفوظ محلياً ✓
                              </span>
                            )}
                          </td>
                          <td className="p-3 flex items-center justify-center gap-1.5 flex-wrap">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2.5 rounded-lg gap-1.5 text-primary border-primary/30 hover:bg-primary/10 font-bold"
                              onClick={() => openPermissionsForUser(u)}
                              disabled={userDirectoryStatus !== "ready"}
                            >
                              <ShieldCheck size={14} />
                              الصلاحيات
                            </Button>
                            <Button
                              size="sm"
                              variant="edit"
                              className="h-8 px-2.5 rounded-lg gap-1 font-bold"
                              onClick={() => startEdit(u)}
                              disabled={userDirectoryStatus !== "ready"}
                            >
                              <Pencil size={14} />
                              تعديل
                            </Button>
                            <Button
                              size="icon"
                              variant="delete"
                              className="h-8 w-8 rounded-lg"
                              onClick={() => {
                                setUserToDelete(u.id);
                                setIsConfirmDeleteOpen(true);
                              }}
                              disabled={
                                isActiveUserRecord(u, activeAuthUser) ||
                                userDirectoryStatus !== "ready"
                              }
                            >
                              <Trash2 size={14} />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Lock accounting periods & fiscal year status */}
          <div className="bg-card border border-border p-5 rounded-2xl space-y-4 shadow-sm">
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <Lock size={18} className="text-amber-500" />
              <span>قفل الفترات والسنة المالية</span>
            </h3>
            <div className="space-y-4 pt-1">
              <div className="border border-border p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
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

              <div className="border border-border p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
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
        </>
      )}

      {/* Confirmation Dialogs */}
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
            <AlertDialogDescription className="text-right text-xs leading-relaxed">
              {erpState.isAccountingPeriodLocked
                ? "هل أنت متأكد من فتح قفل قيود السنوات السابقة؟"
                : "هل أنت متأكد من قفل قيود السنوات السابقة؟"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2 flex-row justify-start">
            <AlertDialogAction
              onClick={handleConfirmPeriodLock}
              disabled={isRefreshing}
              className="rounded-xl font-bold px-5 text-white bg-emerald-600 hover:bg-emerald-700"
            >
              تأكيد
            </AlertDialogAction>
            <AlertDialogCancel disabled={isRefreshing} className="rounded-xl">
              إلغاء
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isConfirmFiscalYearOpen} onOpenChange={setIsConfirmFiscalYearOpen}>
        <AlertDialogContent className="text-right max-w-lg rounded-2xl">
          <AlertDialogHeader className="text-right space-y-2">
            <AlertDialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Calendar className="text-primary shrink-0" size={20} />
              {erpState.fiscalYearStatus === "open"
                ? "تأكيد إغلاق السنة المالية 2026"
                : "تأكيد فتح السنة المالية 2026"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right text-xs leading-relaxed">
              {erpState.fiscalYearStatus === "open"
                ? "هل أنت متأكد من إغلاق السنة المالية الحالية (2026)؟"
                : "هل أنت متأكد من إعادة فتح السنة المالية الحالية (2026)؟"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2 flex-row justify-start">
            <AlertDialogAction
              onClick={handleConfirmFiscalYear}
              disabled={isRefreshing}
              className="rounded-xl font-bold px-5 text-white bg-emerald-600 hover:bg-emerald-700"
            >
              تأكيد
            </AlertDialogAction>
            <AlertDialogCancel disabled={isRefreshing} className="rounded-xl">
              إلغاء
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            <AlertDialogAction onClick={upsert} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              تأكيد الحفظ
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
              هل أنت متأكد من حذف هذا الحساب نهائياً؟
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
              هل أنت متأكد من حفظ التعديلات الجديدة على صلاحيات المستخدم؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-2">
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSavePermissions}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              تأكيد الحفظ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
