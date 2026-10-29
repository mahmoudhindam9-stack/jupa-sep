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
  inspectManagedUserConditions,
  normalizeManagedUsername,
  userValidationErrorMessage,
  validateManagedUserForm,
} from "@/features/auth/services/managedUserValidation";
import {
  getPendingUserError,
   getPendingUserSyncCount,
  hasPendingUserChange,
  queueUserChange,
  startUserSync,
  syncPendingUserChanges,
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
    ],
  },
  {
    id: "dept_shift_audit",
    name: "7. مربع قسم: تدقيق الورديات",
    shortTitle: "تدقيق الورديات",
    desc: "مراجعة ومطابقة إغلاقات ورديات الكاشير في المطعم والحديقة مع أرصدة الخزائن الفعلية",
    mainPageKey: "page_shift_audit",
    headerGradient: "from-amber-500/20 via-yellow-500/10 to-transparent border-amber-500/30",
    accentBadge: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    permissions: [
      {
        key: "page_shift_audit",
        name: "الدخول إلى صفحة تدقيق الورديات",
        desc: "إظهار مربع قسم تدقيق الورديات في الشاشة الرئيسية والسماح بالدخول إليه",
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
    ],
  },
  {
    id: "dept_audit_logs",
    name: "8. مربع قسم: سجل العمليات",
    shortTitle: "سجل العمليات",
    desc: "الرقابة الأمنية الشاملة وسجل تتبع جميع الحركات والتعديلات والعمليات الحساسة بالنظام",
    mainPageKey: "page_audit_logs",
    headerGradient: "from-slate-500/20 via-zinc-500/10 to-transparent border-slate-500/30",
    accentBadge: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
    permissions: [
      {
        key: "page_audit_logs",
        name: "الدخول إلى صفحة سجل العمليات",
        desc: "إظهار مربع قسم سجل العمليات في الشاشة الرئيسية والسماح بالدخول إليه",
        kind: "main",
      },
      {
        key: "system_audit_logs",
        name: "الدخول إلى صفحة تصفية وتصدير سجلات الرقابة الأمنية",
        desc: "إظهار صفحة البحث في سجلات الأمان حسب المستخدم أو نوع العملية وتصديرها",
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
    name: "9. مربع قسم: خيارات المطور والنسخ الاحتياطي",
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
  const email = String(profile.email || "").trim().toLowerCase();
  return {
    id: String(profile.id || ""),
    employee_code: profile.employee_code ? String(profile.employee_code).trim() : undefined,
    full_name: profile.full_name || profile.username || "",
    username: String(profile.username || email.split("@")[0] || "").trim().toLowerCase(),
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
  const storedUsername = String(user.username || "").trim().toLowerCase();
  const storedEmail = String(user.email || "").trim().toLowerCase();
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
        const uname = String(user.username || "").trim().toLowerCase();
        const uemail = String(user.email || "").trim().toLowerCase();
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
  authoritativeProfile?: { permissions?: Record<string, any> } | null,
): Record<string, boolean> {
  if (authoritativeProfile?.permissions && Object.keys(authoritativeProfile.permissions).length > 0) {
    return authoritativeProfile.permissions as Record<string, boolean>;
  }

  const activeStored = (
    typeof window !== "undefined"
      ? localStorage.getItem("restocash_auth_user") ||
        sessionStorage.getItem("restocash_auth_user") ||
        ""
      : ""
  ).trim().toLowerCase();
  const username = String(state?.currentUser || activeStored.split("@")[0] || "")
    .trim()
    .toLowerCase();

  const record = (state?.users || []).find((user: any) => {
    const candidateUsername = String(user.username || "").trim().toLowerCase();
    const candidateEmail = String(user.email || "").trim().toLowerCase();
    return candidateUsername === username || (!!activeStored && candidateEmail === activeStored);
  });
  const permissions = record?.permissions;
  if (permissions && Object.keys(permissions).length > 0) {
    return permissions as Record<string, boolean>;
  }
  if (record?.role === "admin" || record?.role === "super_admin") {
    return { super_admin_full_access: true };
  }
  return (state?.userPermissions?.[username] || { super_admin_full_access: true }) as Record<
    string,
    boolean
  >;
}

function canGrantElevatedPermissions(
  state: any,
  authoritativeProfile?: { permissions?: Record<string, any> } | null,
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
    throw new Error("لا يمكن إلا للمدير الأعلى منح دور المدير أو المدير العام.");
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
  if (role === "admin") {
    permissions.super_admin_full_access = false;
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

  const handleManualCloudSync = async () => {
    setIsSyncingDirectory(true);
    try {
      const summary = await syncPendingUserChanges();
      const authUser = await authService.getCurrentUser();
      if (authUser?.id) {
        const profiles = (await authService.getUsers()) as any[];
        const cloudUsers = (profiles || [])
          .filter((profile) => Boolean(profile?.id && profile?.username))
          .map(profileToSystemUser)
          .sort((a, b) => a.username.localeCompare(b.username));
        erpStore.replaceManagedUsers(cloudUsers);
      }
      setLocalUsers(localLoginUsers());
      setPendingSyncCount(getPendingUserSyncCount());
      notifyPermissionsUpdated();
      toast({
        title: "تمت مزامنة المستخدمين مع قاعدة البيانات",
        description:
          summary.syncedCount > 0
            ? `تمت مزامنة ${summary.syncedCount} حساب/تعديل مع قاعدة البيانات بنجاح.`
            : "جميع المستخدمين والصلاحيات متطابقون مع سجل النظام.",
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
        // Always check if there is an active Supabase Auth session on ANY host
        const authUser = await authService.getCurrentUser();
        if (authUser?.id) {
          await syncPendingUserChanges();
          const actor = await authService.getProfile(authUser.id);
          if (actor?.id) {
            const profiles = (await authService.getUsers()) as any[];
            if (!mounted) return;

            setActorProfile(actor);
            setIsCloudSyncActive(true);
            const cloudUsers = (profiles || [])
              .filter((profile) => Boolean(profile?.id && profile?.username))
              .map(profileToSystemUser)
              .sort((a, b) => a.username.localeCompare(b.username));

            erpStore.replaceManagedUsers(cloudUsers);
            setLocalUsers(localLoginUsers());
            setPendingSyncCount(getPendingUserSyncCount());
            setUserDirectoryStatus("ready");
            hasLoadedDirectory = true;
            notifyPermissionsUpdated();
            return;
          }
        }

        // If no Supabase Auth session is active, seamlessly use local ERP directory
        const fallbackUsers = localLoginUsers();
        if (mounted) {
          setIsCloudSyncActive(false);
          setLocalUsers(fallbackUsers);
          setPendingSyncCount(getPendingUserSyncCount());
          setUserDirectoryStatus("ready");
          setUserDirectoryError("");
          hasLoadedDirectory = true;
        }
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
        const message =
          rawMessage.toLowerCase().includes("auth session missing")
            ? "انتهت جلسة الدخول السحابية؛ يرجى تسجيل الدخول مرة أخرى."
            : rawMessage || "تعذر تحميل دليل المستخدمين من Supabase.";
        setUserDirectoryError(message);
        setUserDirectoryStatus("error");
        console.error("Users directory load failed:", err);
      }
    };

    void loadUsersDirectory();

    const channel = supabase
      .channel("managed-users-directory")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          void loadUsersDirectory();
        },
      )
      .subscribe();

    return () => {
      mounted = false;
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

      const requestedCode = String(form.employee_code || "").trim() || erpStore.getNextEmployeeCode();
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
            ? limitPermissionsToActor(defaultPermissionsForRole(validatedForm.role), actorPermissions)
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

      const emailToUse =
        validatedForm.email || `${validatedForm.username}@restocash.com`;

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
  };

  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [permSearch, setPermSearch] = useState<string>("");

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
    setEditedPermissions(explicitPermissions as UserPermission);
  };

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

      // Ensure all keys across all 9 main section boxes are explicitly boolean (true or false)
      const normalizedToSave: Record<string, boolean> = {};
      PERMISSION_CATEGORIES.forEach((cat) => {
        cat.permissions.forEach((p) => {
          normalizedToSave[p.key] = !!editedPermissions[p.key];
        });
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
      toast({
        title: syncResult.synced
          ? "تم حفظ الصلاحيات محلياً ومزامنتها مع قاعدة البيانات ✓"
          : "تم حفظ الصلاحيات محلياً وتفعيلها بنجاح ✓",
        description:
          "تم تطبيق جدول الصلاحيات الجديد فوراً وإخفاء كافة الصفحات والأقسام غير المختارة لهذا المستخدم.",
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
          // Unchecking the Main Section entry hides the entire section and unchecks all its sub-pages/actions
          parentCat.permissions.forEach((p) => {
            updated[p.key] = false;
          });
        } else {
          // Checking the Main Section entry enables all sub-section pages in that box if none were enabled
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
          // Checking any sub-section page or action inside a Main Section box automatically enables the Main Section entry
          updated[parentCat.mainPageKey] = true;
        } else {
          // If all sub-section pages in this Main Section box are now unchecked, also uncheck the Main Section entry
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

  return (
    <div className="space-y-8 p-1 sm:p-2">
      {/* Integrated HR banner */}
      <div className="bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-bold">
          <UsersIcon size={16} />
          <span>هذه الصفحة هي المرجع الوحيد والموحد لجميع مستخدمي النظام وصلاحياتهم.</span>
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
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="bg-primary/10 text-primary text-xs px-3 py-1 rounded-full font-black flex items-center gap-1.5">
            <UsersIcon size={14} />
            المرجع الموحد للمستخدمين والصلاحيات
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-bold gap-1.5 rounded-xl"
            onClick={handleManualCloudSync}
            disabled={isSyncingDirectory}
          >
            <RefreshCw size={14} className={isSyncingDirectory ? "animate-spin" : ""} />
            {isSyncingDirectory
              ? "جارٍ المزامنة مع قاعدة البيانات..."
              : `مزامنة مع قاعدة البيانات${pendingSyncCount > 0 ? ` (${pendingSyncCount} بالانتظار)` : ""}`}
          </Button>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-foreground mt-2">
          إدارة المستخدمين وصلاحيات الوصول والرقابة
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          يتم حفظ المستخدمين الجدد محلياً أولاً ثم مزامنتهم تلقائياً مع قاعدة البيانات (Supabase) بنفس الشروط والقيود، مع إخفاء أي قسم غير مصرح به لكل مستخدم
        </p>
        <div
          className={`mt-3 rounded-xl border px-3 py-2 text-xs font-semibold ${
            userDirectoryStatus === "error"
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : userDirectoryStatus === "ready"
                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
                : "border-border bg-muted/40 text-muted-foreground"
          }`}
          role="status"
        >
          {userDirectoryStatus === "loading"
            ? "جارٍ تحميل المستخدمين والصلاحيات ومزامنتها…"
            : userDirectoryStatus === "error"
              ? `تعذر تحميل دليل المستخدمين: ${userDirectoryError}`
              : isCloudSyncActive
                ? `المرجع الموحد نشط ومتصل بقاعدة البيانات (Supabase public.profiles & auth.users). إجمالي المستخدمين: ${localUsers.length}.`
                : `المرجع الموحد نشط (حفظ محلي فوري + مزامنة تلقائية مع قاعدة البيانات). إجمالي المستخدمين المسجلين: ${localUsers.length}.`}
        </div>
      </div>

      {/* User Registration & List */}
      <div className="space-y-4">
        <h2 className="text-lg font-black text-foreground flex items-center gap-2">
          <ShieldCheck size={18} className="text-primary" />
          <span>{editing ? `تعديل بيانات المستخدم (${editing.username})` : "إضافة مستخدم جديد (موحد مع شروط قاعدة البيانات)"}</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 bg-card border border-border p-5 rounded-2xl shadow-sm">
          <div className="md:col-span-2 lg:col-span-1">
            <Label className="text-xs font-bold">الرقم الوظيفي (فريد وتلقائي) *</Label>
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
              <option value="">-- اختر موظف لمزامنة رقمه واسمه --</option>
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
                  const shouldAutoFillEmail =
                    !editing && (!s.email || s.email === prevAutoEmail);
                  return {
                    ...s,
                    username: nextUsername,
                    email: shouldAutoFillEmail && nextUsername.trim()
                      ? `${normalizeManagedUsername(nextUsername)}@restocash.com`
                      : s.email,
                  };
                });
              }}
              dir="ltr"
            />
          </div>
          <div className="md:col-span-2 lg:col-span-1">
            <Label className="text-xs font-bold">البريد الإلكتروني لقاعدة البيانات *</Label>
            <Input
              type="email"
              className="h-9 rounded-xl border-input bg-background px-3 text-xs mt-1 font-mono"
              placeholder="user@restocash.com"
              autoComplete="email"
              required
              disabled={!!editing && isCloudSyncActive}
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

          {/* Live Database Requirements & Unmet Conditions Indicator */}
          <div className="md:col-span-6 grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-border/60">
            <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-foreground">
                  شروط الاسم واسم المستخدم والبريد في قاعدة البيانات:
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
                    ? "جميع شروط الاسم مستوفاة ✓"
                    : "يوجد شرط غير مستوفى"}
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
                      rule.met
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-destructive"
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
                  شروط الرقم السري الجديد في قاعدة البيانات:
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
                    ? "بدون تغيير للرقم السري"
                    : formInspection.isPasswordValid
                      ? "جميع شروط الرقم السري مستوفاة ✓"
                      : "يوجد شرط غير مستوفى"}
                </Badge>
              </div>
              {formInspection.passwordChecks.length === 0 ? (
                <p className="text-[11px] text-muted-foreground font-semibold">
                  أثناء التعديل، اترك خانة الرقم السري فارغة للاحتفاظ بالرقم السري الحالي، أو أدخل رقماً سرياً جديداً لمطابقة الشروط.
                </p>
              ) : (
                <ul className="space-y-1 text-[11px]">
                  {formInspection.passwordChecks.map((rule) => (
                    <li
                      key={rule.id}
                      className={`flex items-center gap-1.5 font-semibold ${
                        rule.met
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-destructive"
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

          <div className="md:col-span-6 flex justify-between items-center flex-wrap gap-2 mt-1">
            <div className="text-[11px] font-bold">
              {!formInspection.isValid ? (
                <span className="text-destructive flex items-center gap-1.5">
                  <AlertTriangle size={14} />
                  يرجى استيفاء الشروط الموضحة باللون الأحمر أعلاه لتفعيل الحفظ والمزامنة مع قاعدة البيانات.
                </span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 size={14} />
                  جميع البيانات والشروط مطابقة لمتطلبات قاعدة البيانات وجاهزة للحفظ.
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {editing && (
                <Button
                  variant="outline"
                  className="h-9 px-6 rounded-xl font-bold"
                  onClick={() => {
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
                  }}
                >
                  إلغاء التعديل
                </Button>
              )}
              <Button
                className="h-9 px-6 rounded-xl font-bold gap-2"
                onClick={() => setIsConfirmUpsertOpen(true)}
                disabled={!formInspection.isValid || userDirectoryStatus !== "ready"}
              >
                <Save size={16} />
                {editing ? "حفظ التعديلات ومزامنتها" : "حفظ محلياً ومزامنة المستخدم الجديد"}
              </Button>
            </div>
          </div>
        </div>

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
                <th className="text-center p-3 font-bold w-40">الإجراءات</th>
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
                        <div className="font-mono text-[10px] text-muted-foreground mt-1" dir="ltr">
                          {u.email}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      {isOnlineNow ? (
                        <span className="inline-flex items-center gap-1.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-black">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          أونلاين (متصل الآن)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-400/30 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                          <span className="h-2 w-2 rounded-full bg-slate-400" />
                          أوفلاين (غير متصل)
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
                            محفوظ محلياً • قيد المزامنة
                          </span>
                          {syncError && (
                            <div className="text-[10px] text-destructive max-w-[200px] truncate" title={syncError}>
                              {syncError}
                            </div>
                          )}
                        </div>
                      ) : isCloudUuid ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          متزامن مع قاعدة البيانات ✓
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          محفوظ محلياً وجاهز للمزامنة ✓
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
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 rounded-lg"
                        onClick={() => startEdit(u)}
                        disabled={userDirectoryStatus !== "ready"}
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
                        disabled={
                          isActiveUserRecord(u, activeAuthUser) || userDirectoryStatus !== "ready"
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
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto text-right p-4 sm:p-6">
          <DialogHeader className="text-right pb-3 border-b border-border">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <DialogTitle className="flex items-center gap-2 text-foreground text-lg sm:text-xl font-black">
                <ShieldCheck className="text-primary h-6 w-6" />
                صلاحيات الأقسام والصفحات للمستخدم: {permissionsUser?.full_name} (
                {permissionsUser?.username})
              </DialogTitle>
              <span className="bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full font-bold text-xs">
                الدور الحالي:{" "}
                {roleLabels[permissionsUser?.role || "cashier"] || permissionsUser?.role}
              </span>
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              مربعات الصلاحيات مطابقة تماماً لمربعات الأقسام الرئيسية والفرعية في التطبيق؛ عند عدم
              اختيار أي قسم رئيسي أو صفحة فرعية يتم إخفاؤها تماماً عن هذا المستخدم.
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
                    تفعيل كل الأقسام والصفحات
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs font-bold text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => selectAllPerms(false)}
                  >
                    إخفاء وتعطيل الكل
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

            {/* Quick Interactive Overview of the 9 Main Department Boxes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-black text-foreground">
                  مربعات الأقسام الرئيسية الحالية في التطبيق (اضغط على المربع للانتقال إليه أو
                  لتفعيل/إخفاء القسم):
                </span>
                {categoryFilter !== "ALL" && (
                  <button
                    type="button"
                    onClick={() => setCategoryFilter("ALL")}
                    className="text-xs font-bold text-primary hover:underline cursor-pointer"
                  >
                    عرض جميع مربعات الأقسام (9 أقسام) ←
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {PERMISSION_CATEGORIES.map((cat) => {
                  const isMainChecked = editedPermissions
                    ? !!editedPermissions[cat.mainPageKey]
                    : false;
                  const pagePerms = cat.permissions.filter((p) => p.kind === "page");
                  const enabledPagesCount = pagePerms.filter(
                    (p) => editedPermissions && !!editedPermissions[p.key],
                  ).length;
                  const isSelectedFilter = categoryFilter === cat.id;

                  return (
                    <div
                      key={cat.id}
                      onClick={() =>
                        setCategoryFilter((prev) => (prev === cat.id ? "ALL" : cat.id))
                      }
                      className={`p-3 rounded-2xl border transition cursor-pointer select-none flex flex-col justify-between gap-2 bg-gradient-to-br ${
                        cat.headerGradient
                      } ${
                        isSelectedFilter ? "ring-2 ring-primary shadow-md" : "hover:shadow-sm"
                      } ${!isMainChecked ? "opacity-65 bg-muted/30" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5 min-w-0">
                          <h5 className="font-black text-xs sm:text-sm text-foreground truncate">
                            {cat.shortTitle}
                          </h5>
                          <p className="text-[10px] text-muted-foreground line-clamp-1">
                            {cat.desc}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePermission(cat.mainPageKey, cat);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black border shrink-0 transition cursor-pointer ${
                            isMainChecked
                              ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border-emerald-500/40"
                              : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
                          }`}
                        >
                          {isMainChecked ? "القسم ظاهر ✓" : "القسم مخفي ✕"}
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-[10px] pt-1 border-t border-border/50">
                        <span className="font-bold text-muted-foreground">
                          الصفحات الفرعية الظاهرة: {enabledPagesCount} / {pagePerms.length}
                        </span>
                        <span className="font-bold text-primary">
                          {isSelectedFilter ? "معروض بالأسفل ↓" : "تخصيص الصفحات ←"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Filter and Search */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative w-full sm:flex-1">
                <Input
                  placeholder="ابحث في صفحات الأقسام أو الصلاحيات (مثلاً: الدخول إلى صفحة الموارد البشرية، الكاشير، الرواتب)..."
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                  className="h-9 text-xs pr-3 rounded-xl border-border"
                />
              </div>
              <div className="w-full sm:w-72">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full h-9 rounded-xl border border-input bg-background px-3 text-xs font-semibold"
                >
                  <option value="ALL">عرض جميع مربعات الأقسام الرئيسية (9 أقسام)</option>
                  {PERMISSION_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Detailed Main Section Boxes */}
            <div className="space-y-5">
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

                const mainPermItem = cat.permissions.find((p) => p.key === cat.mainPageKey);
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
                      isMainEnabled ? "border-border" : "border-dashed border-muted-foreground/30"
                    }`}
                  >
                    {/* Main Department Box Header */}
                    <div
                      className={`bg-gradient-to-l ${cat.headerGradient} p-4 border-b border-border/60 flex flex-col gap-3`}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-black text-sm sm:text-base text-foreground">
                              {cat.name}
                            </h4>
                            <span
                              className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${
                                isMainEnabled
                                  ? cat.accentBadge
                                  : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20"
                              }`}
                            >
                              {isMainEnabled
                                ? `القسم ظاهر للمستخدم (${enabledCount}/${cat.permissions.length})`
                                : "القسم مخفي تماماً عن المستخدم"}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">{cat.desc}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 text-xs font-bold rounded-xl"
                            onClick={() => toggleCategoryPerms(cat, !isAllCategoryChecked)}
                          >
                            {isAllCategoryChecked
                              ? "إخفاء وإلغاء كامل القسم"
                              : "تفعيل كامل صفحات وصلاحيات القسم"}
                          </Button>
                        </div>
                      </div>

                      {/* Main Page Entry Toggle Banner */}
                      {mainPermItem && (
                        <div
                          onClick={() => togglePermission(mainPermItem.key, cat)}
                          className={`flex items-center justify-between gap-3 p-3 rounded-xl border-2 transition cursor-pointer select-none ${
                            isMainEnabled
                              ? "bg-emerald-500/10 border-emerald-500/40 shadow-xs"
                              : "bg-background/80 border-border hover:bg-muted/30"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isMainEnabled}
                              onChange={() => {}}
                              className="h-5 w-5 rounded border-input text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                            />
                            <div className="space-y-0.5 min-w-0">
                              <div className="font-black text-xs sm:text-sm text-foreground">
                                {mainPermItem.name}
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                {mainPermItem.desc}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`text-[11px] px-2.5 py-1 rounded-lg font-black shrink-0 ${
                              isMainEnabled
                                ? "bg-emerald-600 text-white"
                                : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                            }`}
                          >
                            {isMainEnabled ? "مسموح بالدخول ✓" : "مخفي عن المستخدم"}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="p-3.5 space-y-4 bg-background/50">
                      {/* Sub-section Pages Grid */}
                      {subPageItems.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h5 className="text-xs font-black text-foreground flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                              صفحات الأقسام الفرعية داخل {cat.shortTitle} (تختفي الصفحة عند عدم
                              اختيارها):
                            </h5>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {subPageItems.map((perm) => {
                              const isChecked = editedPermissions
                                ? !!editedPermissions[perm.key]
                                : false;
                              return (
                                <div
                                  key={perm.key}
                                  onClick={() => togglePermission(perm.key, cat)}
                                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition cursor-pointer select-none ${
                                    isChecked
                                      ? "bg-primary/5 border-primary/40 shadow-xs ring-1 ring-primary/20"
                                      : "bg-card border-border/70 hover:bg-muted/20 opacity-75"
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
                                      <span className="font-bold text-xs text-foreground leading-snug">
                                        {perm.name}
                                      </span>
                                      <span
                                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                                          isChecked
                                            ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                            : "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                                        }`}
                                      >
                                        {isChecked ? "ظاهر ✓" : "مخفي"}
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
                      )}

                      {/* Operational Actions Grid */}
                      {actionItems.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-border/50">
                          <h5 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground inline-block" />
                            صلاحيات العمليات والإجراءات داخل {cat.shortTitle}:
                          </h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {actionItems.map((perm) => {
                              const isChecked = editedPermissions
                                ? !!editedPermissions[perm.key]
                                : false;
                              return (
                                <div
                                  key={perm.key}
                                  onClick={() => togglePermission(perm.key, cat)}
                                  className={`flex items-start gap-2.5 p-2 rounded-xl border transition cursor-pointer select-none ${
                                    isChecked
                                      ? "bg-emerald-500/5 border-emerald-500/30"
                                      : "bg-card border-border/60 hover:bg-muted/20 opacity-75"
                                  } ${perm.isSuperAdminOnly ? "border-amber-500/40 bg-amber-500/5" : ""}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {}}
                                    className="mt-1 h-4 w-4 rounded border-input text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                                  />
                                  <div className="space-y-0.5 flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="font-bold text-[11px] text-foreground leading-snug">
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
                      )}
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
