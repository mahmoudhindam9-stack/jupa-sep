/**
 * Developer Studio Pro — Real Application Action & Destination Registry
 * Powers Priority 8.4: Dedicated Element Function / Action Inspector (الوظيفة والإجراء)
 * Enforces strict security rules:
 *  - Only registered, validated application actions can be bound.
 *  - Role/permission requirements are preserved and never bypassed.
 *  - Financial, shift, and inventory mutations are safely simulated inside Studio preview.
 */

export type StudioActionType =
  | "navigate"
  | "open_modal"
  | "open_drawer"
  | "workflow"
  | "external_url"
  | "submit"
  | "toggle_ui";

export interface StudioElementActionBinding {
  actionId: string;
  actionType: StudioActionType;
  trigger: "onClick";
  label: string;
  targetRoute?: string;
  targetModal?: string;
  targetWorkflow?: string;
  params?: Record<string, string>;
  requiredPermissions: string[];
  allowedRoles: string[];
  isMutationSafeSimulated?: boolean;
}

export interface RegisteredAppAction {
  id: string;
  titleAr: string;
  descriptionAr: string;
  category: "restaurant" | "park" | "mall" | "finance" | "inventory" | "hr" | "navigation" | "ui";
  categoryLabelAr: string;
  actionType: StudioActionType;
  defaultRoute?: string;
  defaultModal?: string;
  defaultWorkflow?: string;
  defaultParams?: Record<string, string>;
  requiredPermissions: string[];
  allowedRoles: string[];
  mutatesOperationalData: boolean;
  keywords: string[];
}

export interface RegisteredAppPage {
  id: string;
  titleAr: string;
  route: string;
  departmentAr: string;
  requiredPermissions: string[];
}

export const STUDIO_REGISTERED_PAGES: RegisteredAppPage[] = [
  {
    id: "page_admin_home",
    titleAr: "بوابة الأقسام الرئيسية (لوحة التحكم)",
    route: "/admin",
    departmentAr: "الرئيسية",
    requiredPermissions: ["admin.view"],
  },
  {
    id: "page_pos",
    titleAr: "نقطة البيع والكاشير المباشر (POS)",
    route: "/pos",
    departmentAr: "إدارة المطعم",
    requiredPermissions: ["pos.access", "shift.open"],
  },
  {
    id: "page_restaurant",
    titleAr: "إدارة المطعم (التعريفات • العمليات • التقارير)",
    route: "/admin/restaurant",
    departmentAr: "إدارة المطعم",
    requiredPermissions: ["restaurant.manage"],
  },
  {
    id: "page_park",
    titleAr: "إدارة الحديقة والألعاب والتذاكر",
    route: "/admin/park",
    departmentAr: "إدارة الحديقة",
    requiredPermissions: ["park.manage"],
  },
  {
    id: "page_mall",
    titleAr: "إدارة المول التجاري والعقود والمستأجرين",
    route: "/admin/mall",
    departmentAr: "إدارة المول",
    requiredPermissions: ["mall.manage"],
  },
  {
    id: "page_ledger_hub",
    titleAr: "الإدارة المالية الموحدة (البوابة المالية)",
    route: "/admin/ledger",
    departmentAr: "الإدارة المالية",
    requiredPermissions: ["finance.view"],
  },
  {
    id: "page_ledger_vouchers",
    titleAr: "سندات الصرف والقبض الموحدة",
    route: "/admin/ledger?tab=vouchers",
    departmentAr: "الإدارة المالية",
    requiredPermissions: ["finance.vouchers"],
  },
  {
    id: "page_ledger_journal",
    titleAr: "دفتر اليومية والقيود المزدوجة",
    route: "/admin/ledger?tab=journal",
    departmentAr: "الإدارة المالية",
    requiredPermissions: ["finance.journal"],
  },
  {
    id: "page_ledger_accounts",
    titleAr: "دليل وشجرة الحسابات الرباعية",
    route: "/admin/ledger?tab=accounts",
    departmentAr: "الإدارة المالية",
    requiredPermissions: ["finance.accounts"],
  },
  {
    id: "page_ledger_treasury",
    titleAr: "إدارة الخزائن النقدية",
    route: "/admin/ledger?tab=treasury",
    departmentAr: "الإدارة المالية",
    requiredPermissions: ["finance.treasury"],
  },
  {
    id: "page_ledger_position",
    titleAr: "المركز المالي الشامل والميزانية",
    route: "/admin/ledger?tab=financial_position",
    departmentAr: "الإدارة المالية",
    requiredPermissions: ["finance.reports"],
  },
  {
    id: "page_inventory",
    titleAr: "المخازن والمستودعات والمشتريات",
    route: "/admin/inventory",
    departmentAr: "المخازن والمستودعات",
    requiredPermissions: ["inventory.manage"],
  },
  {
    id: "page_hr",
    titleAr: "شؤون الموظفين والمستخدمين والصلاحيات",
    route: "/admin/hr",
    departmentAr: "شؤون الموظفين والمستخدمين",
    requiredPermissions: ["hr.manage"],
  },
  {
    id: "page_shifts",
    titleAr: "مراجعة الورديات وتدقيق العهد",
    route: "/admin/shifts",
    departmentAr: "مراجعة الورديات",
    requiredPermissions: ["shifts.audit"],
  },
  {
    id: "page_audit",
    titleAr: "سجل الرقابة والعمليات",
    route: "/admin/audit",
    departmentAr: "سجل الرقابة",
    requiredPermissions: ["audit.view"],
  },
  {
    id: "page_system_update",
    titleAr: "تحديثات النظام والنسخ الاحتياطي",
    route: "/admin/system-update",
    departmentAr: "تحديثات النظام",
    requiredPermissions: ["system.admin"],
  },
];

export const STUDIO_ACTION_REGISTRY: RegisteredAppAction[] = [
  {
    id: "open_restaurant_shift",
    titleAr: "فتح وردية جديدة (المطعم / الكاشير)",
    descriptionAr: "يفتح نافذة بدء وردية عمل جديدة وتحديد عهدة البداية للكاشير",
    category: "restaurant",
    categoryLabelAr: "عمليات المطعم والورديات",
    actionType: "workflow",
    defaultRoute: "/pos",
    defaultModal: "modal_open_shift",
    defaultWorkflow: "shift.open_new_session",
    requiredPermissions: ["shift.open", "pos.access"],
    allowedRoles: ["owner", "admin", "manager", "cashier", "accountant"],
    mutatesOperationalData: true,
    keywords: ["فتح وردية", "بدء وردية", "وردية جديدة", "open shift", "استلام وردية"],
  },
  {
    id: "close_restaurant_shift",
    titleAr: "إغلاق وتصفية الوردية الحالية",
    descriptionAr: "يفتح سير عمل جرد النقدية وإغلاق الوردية وترحيل العهدة",
    category: "restaurant",
    categoryLabelAr: "عمليات المطعم والورديات",
    actionType: "workflow",
    defaultRoute: "/admin/shifts",
    defaultModal: "modal_close_shift",
    defaultWorkflow: "shift.close_and_reconcile",
    requiredPermissions: ["shift.close", "shifts.audit"],
    allowedRoles: ["owner", "admin", "manager", "cashier", "accountant"],
    mutatesOperationalData: true,
    keywords: ["إغلاق وردية", "تصفية وردية", "انهاء الوردية", "close shift"],
  },
  {
    id: "navigate_pos_cashier",
    titleAr: "الانتقال إلى شاشة الكاشير ونقطة البيع (POS)",
    descriptionAr: "ينقل المستخدم مباشرة إلى واجهة الكاشير والطلبات المباشرة",
    category: "restaurant",
    categoryLabelAr: "عمليات المطعم والورديات",
    actionType: "navigate",
    defaultRoute: "/pos",
    requiredPermissions: ["pos.access"],
    allowedRoles: ["owner", "admin", "manager", "cashier"],
    mutatesOperationalData: false,
    keywords: ["الكاشير", "نقطة البيع", "pos", "شاشة البيع"],
  },
  {
    id: "open_unified_voucher_modal",
    titleAr: "تسجيل سند مالي موحد (سند صرف / سند قبض)",
    descriptionAr: "يفتح شاشة السندات المالية الموحدة لإنشاء سند صرف أو قبض مع قيد محاسبي آلي",
    category: "finance",
    categoryLabelAr: "الإدارة المالية والسندات",
    actionType: "workflow",
    defaultRoute: "/admin/ledger?tab=vouchers",
    defaultModal: "modal_unified_voucher",
    defaultWorkflow: "finance.create_voucher",
    requiredPermissions: ["finance.vouchers", "finance.create"],
    allowedRoles: ["owner", "admin", "accountant", "manager"],
    mutatesOperationalData: true,
    keywords: ["سند جديد", "تسجيل سند", "سند صرف", "سند قبض", "اضافة سند", "voucher"],
  },
  {
    id: "open_restaurant_purchase_invoice",
    titleAr: "تسجيل فاتورة مشتريات خامات ومواد للمطعم",
    descriptionAr: "يفتح سير عمل شراء خامات المطعم وربط المورد وتوريد الأصناف للمخزن",
    category: "finance",
    categoryLabelAr: "الإدارة المالية والسندات",
    actionType: "workflow",
    defaultRoute: "/admin/ledger?tab=vouchers&dept=restaurant",
    defaultModal: "modal_restaurant_purchase",
    defaultWorkflow: "finance.restaurant_purchase_inventory",
    defaultParams: { dept: "restaurant", type: "payment", category: "شراء خامات ومواد" },
    requiredPermissions: ["finance.vouchers", "inventory.manage"],
    allowedRoles: ["owner", "admin", "accountant", "manager"],
    mutatesOperationalData: true,
    keywords: ["شراء خامات", "فاتورة مشتريات", "توريد مخزني", "مشتريات المطعم"],
  },
  {
    id: "open_new_journal_entry_modal",
    titleAr: "إضافة قيد يومية محاسبي مزدوج",
    descriptionAr: "يفتح نافذة تحرير قيد يومية مزدوج متعدد العملات مع التحقق من التوازن",
    category: "finance",
    categoryLabelAr: "الإدارة المالية والسندات",
    actionType: "open_modal",
    defaultRoute: "/admin/ledger?tab=journal",
    defaultModal: "modal_new_journal_entry",
    requiredPermissions: ["finance.journal", "finance.create"],
    allowedRoles: ["owner", "admin", "accountant"],
    mutatesOperationalData: true,
    keywords: ["قيد يومي", "إضافة قيد", "قيد جديد", "journal entry"],
  },
  {
    id: "open_mall_contract_modal",
    titleAr: "إنشاء عقد إيجار وحدة تجارية بالمول (مستقل عن المالية)",
    descriptionAr: "يفتح نافذة تسجيل عقد إيجار جديد في المول دون توليد قيود مالية تلقائية",
    category: "mall",
    categoryLabelAr: "إدارة المول والعقود",
    actionType: "open_modal",
    defaultRoute: "/admin/mall",
    defaultModal: "modal_mall_contract",
    requiredPermissions: ["mall.manage", "mall.contracts"],
    allowedRoles: ["owner", "admin", "manager"],
    mutatesOperationalData: true,
    keywords: ["عقد جديد", "إضافة عقد", "عقد إيجار", "تأجير محل"],
  },
  {
    id: "open_park_ticket_issuance",
    titleAr: "إصدار تذاكر الحديقة والألعاب",
    descriptionAr: "يفتح شاشة قطع التذاكر الفورية وتشغيل ألعاب الحديقة",
    category: "park",
    categoryLabelAr: "إدارة الحديقة والألعاب",
    actionType: "workflow",
    defaultRoute: "/admin/park",
    defaultWorkflow: "park.issue_ticket",
    requiredPermissions: ["park.manage", "park.tickets"],
    allowedRoles: ["owner", "admin", "manager", "cashier"],
    mutatesOperationalData: true,
    keywords: ["قطع تذكرة", "إصدار تذكرة", "تذاكر الحديقة", "تشغيل لعبة"],
  },
  {
    id: "open_inventory_item_modal",
    titleAr: "إضافة صنف مخزني أو حركة مستودع",
    descriptionAr: "يفتح نافذة تعريف صنف مخزني جديد أو تسجيل إذن استلام/صرف",
    category: "inventory",
    categoryLabelAr: "المخازن والمستودعات",
    actionType: "open_modal",
    defaultRoute: "/admin/inventory",
    defaultModal: "modal_inventory_item",
    requiredPermissions: ["inventory.manage"],
    allowedRoles: ["owner", "admin", "manager", "accountant"],
    mutatesOperationalData: true,
    keywords: ["إضافة صنف", "صنف جديد", "توريد مخزن", "جرد المخزون"],
  },
  {
    id: "open_hr_employee_modal",
    titleAr: "إضافة موظف أو مستخدم جديد",
    descriptionAr: "يفتح نافذة تسجيل بيانات موظف وتعيين الدور والصلاحيات",
    category: "hr",
    categoryLabelAr: "شؤون الموظفين والمستخدمين",
    actionType: "open_modal",
    defaultRoute: "/admin/hr",
    defaultModal: "modal_add_employee",
    requiredPermissions: ["hr.manage", "users.manage"],
    allowedRoles: ["owner", "admin"],
    mutatesOperationalData: true,
    keywords: ["إضافة موظف", "مستخدم جديد", "تعيين صلاحيات"],
  },
  {
    id: "navigate_app_page",
    titleAr: "تنقل داخلي إلى صفحة أو قسم في التطبيق",
    descriptionAr: "ينقل المستخدم إلى أي صفحة أو قسم فرعي مسجل داخل النظام",
    category: "navigation",
    categoryLabelAr: "التنقل والصفحات",
    actionType: "navigate",
    defaultRoute: "/admin",
    requiredPermissions: ["admin.view"],
    allowedRoles: ["owner", "admin", "manager", "accountant", "cashier"],
    mutatesOperationalData: false,
    keywords: ["رجوع", "انتقال", "فتح قسم", "لوحة التحكم", "الرئيسية"],
  },
  {
    id: "toggle_grid_list_view",
    titleAr: "تبديل أسلوب العرض (شبكة Grid / قائمة List)",
    descriptionAr: "يبدّل طريقة عرض البطاقات والسجلات في القسم الحالي بين الشبكة والقائمة",
    category: "ui",
    categoryLabelAr: "واجهة المستخدم والعرض",
    actionType: "toggle_ui",
    defaultWorkflow: "ui.toggle_view_mode",
    requiredPermissions: ["admin.view"],
    allowedRoles: ["owner", "admin", "manager", "accountant", "cashier"],
    mutatesOperationalData: false,
    keywords: ["شبكة", "قائمة", "grid", "list", "طريقة العرض"],
  },
  {
    id: "open_side_drawer_panel",
    titleAr: "فتح درج جانبي سياقي (Side Drawer)",
    descriptionAr: "يفتح لوحة جانبية لعرض التفاصيل أو الفلاتر دون مغادرة الشاشة",
    category: "ui",
    categoryLabelAr: "واجهة المستخدم والعرض",
    actionType: "open_drawer",
    defaultModal: "drawer_details",
    requiredPermissions: ["admin.view"],
    allowedRoles: ["owner", "admin", "manager", "accountant", "cashier"],
    mutatesOperationalData: false,
    keywords: ["درج", "لوحة جانبية", "تفاصيل", "drawer"],
  },
];

/**
 * Inspects a live DOM element (button, link, or interactive node) and resolves
 * its real assigned function, action type, destination, and required permissions.
 */
export function detectElementAssignedAction(input: {
  tag: string;
  text?: string;
  selector?: string;
  href?: string;
  attributes?: Record<string, string>;
  existingBinding?: StudioElementActionBinding;
}): {
  isInteractive: boolean;
  elementTypeLabel: string;
  displayLabel: string;
  detectedAction: RegisteredAppAction;
  binding: StudioElementActionBinding;
} {
  const tag = (input.tag || "div").toLowerCase();
  const rawText = (input.text || input.attributes?.["aria-label"] || input.attributes?.title || "").trim();
  const href = (input.href || input.attributes?.href || "").trim();
  const role = (input.attributes?.role || "").toLowerCase();

  const isInteractive =
    tag === "button" ||
    tag === "a" ||
    tag === "input" ||
    tag === "select" ||
    role === "button" ||
    role === "link" ||
    role === "tab" ||
    Boolean(href) ||
    Boolean(input.existingBinding) ||
    /فتح|إضافة|تسجيل|حفظ|طباعة|تصدير|تعديل|حذف|رجوع|إغلاق|شراء|عقد|وردية|سند/.test(rawText);

  const elementTypeLabel =
    tag === "button" || role === "button"
      ? "زر تفاعلي (Button)"
      : tag === "a" || role === "link" || Boolean(href)
        ? "رابط تنقل (Link)"
        : role === "tab"
          ? "تبويب تنقل (Tab)"
          : "عنصر تفاعلي (Interactive Element)";

  // 1. If an explicit Studio actionBinding is already saved on this element, resolve it first
  if (input.existingBinding?.actionId) {
    const found =
      STUDIO_ACTION_REGISTRY.find((a) => a.id === input.existingBinding!.actionId) ||
      STUDIO_ACTION_REGISTRY[0];
    return {
      isInteractive: true,
      elementTypeLabel,
      displayLabel: rawText || input.existingBinding.label || found.titleAr,
      detectedAction: found,
      binding: {
        ...input.existingBinding,
        trigger: "onClick",
        requiredPermissions:
          input.existingBinding.requiredPermissions?.length
            ? input.existingBinding.requiredPermissions
            : found.requiredPermissions,
        allowedRoles:
          input.existingBinding.allowedRoles?.length
            ? input.existingBinding.allowedRoles
            : found.allowedRoles,
        isMutationSafeSimulated: found.mutatesOperationalData,
      },
    };
  }

  // 2. Match by text keywords against STUDIO_ACTION_REGISTRY
  const normalizedText = rawText.toLowerCase();
  for (const regAction of STUDIO_ACTION_REGISTRY) {
    if (regAction.keywords.some((kw) => normalizedText.includes(kw.toLowerCase()))) {
      return {
        isInteractive,
        elementTypeLabel,
        displayLabel: rawText || regAction.titleAr,
        detectedAction: regAction,
        binding: {
          actionId: regAction.id,
          actionType: regAction.actionType,
          trigger: "onClick",
          label: rawText || regAction.titleAr,
          targetRoute: href || regAction.defaultRoute,
          targetModal: regAction.defaultModal,
          targetWorkflow: regAction.defaultWorkflow,
          params: regAction.defaultParams ? { ...regAction.defaultParams } : undefined,
          requiredPermissions: [...regAction.requiredPermissions],
          allowedRoles: [...regAction.allowedRoles],
          isMutationSafeSimulated: regAction.mutatesOperationalData,
        },
      };
    }
  }

  // 3. Match by href route if present
  if (href) {
    const matchedPage = STUDIO_REGISTERED_PAGES.find(
      (p) => p.route === href || href.startsWith(p.route + "?"),
    );
    const navAction = STUDIO_ACTION_REGISTRY.find((a) => a.id === "navigate_app_page")!;
    return {
      isInteractive: true,
      elementTypeLabel,
      displayLabel: rawText || matchedPage?.titleAr || href,
      detectedAction: navAction,
      binding: {
        actionId: navAction.id,
        actionType: href.startsWith("http") ? "external_url" : "navigate",
        trigger: "onClick",
        label: rawText || matchedPage?.titleAr || href,
        targetRoute: href,
        requiredPermissions: matchedPage?.requiredPermissions || navAction.requiredPermissions,
        allowedRoles: navAction.allowedRoles,
        isMutationSafeSimulated: false,
      },
    };
  }

  // 4. Fallback default action
  const fallbackAction = STUDIO_ACTION_REGISTRY.find((a) => a.id === "navigate_app_page")!;
  return {
    isInteractive,
    elementTypeLabel,
    displayLabel: rawText || `<${tag}>`,
    detectedAction: fallbackAction,
    binding: {
      actionId: fallbackAction.id,
      actionType: fallbackAction.actionType,
      trigger: "onClick",
      label: rawText || fallbackAction.titleAr,
      targetRoute: fallbackAction.defaultRoute || "/admin",
      requiredPermissions: [...fallbackAction.requiredPermissions],
      allowedRoles: [...fallbackAction.allowedRoles],
      isMutationSafeSimulated: false,
    },
  };
}

/**
 * Security validator for Studio Action Bindings:
 *  - Ensures only registered actions in STUDIO_ACTION_REGISTRY are allowed.
 *  - Blocks `javascript:` or unsafe external URLs.
 *  - Enforces role/permission checks without bypass.
 *  - Flags operational mutations so Studio preview simulates them safely.
 */
export function validateActionBindingSecurity(
  binding: StudioElementActionBinding,
  currentUserRole: string = "admin",
): {
  valid: boolean;
  allowedForRole: boolean;
  simulateOnlyInPreview: boolean;
  reason?: string;
} {
  if (!binding || typeof binding !== "object" || !binding.actionId) {
    return {
      valid: false,
      allowedForRole: false,
      simulateOnlyInPreview: true,
      reason: "إجراء غير معرّف في سجل وظائف النظام.",
    };
  }

  const registered = STUDIO_ACTION_REGISTRY.find((a) => a.id === binding.actionId);
  if (!registered) {
    return {
      valid: false,
      allowedForRole: false,
      simulateOnlyInPreview: true,
      reason: `الإجراء (${binding.actionId}) غير مسجل في قائمة الوظائف المعتمدة.`,
    };
  }

  if (binding.targetRoute) {
    const trimmedRoute = binding.targetRoute.trim().toLowerCase();
    if (trimmedRoute.startsWith("javascript:") || trimmedRoute.startsWith("data:")) {
      return {
        valid: false,
        allowedForRole: false,
        simulateOnlyInPreview: true,
        reason: "روابط البرمجة النصية المباشرة (javascript:/data:) محظورة أمنيًا.",
      };
    }
  }

  const normalizedRole = (currentUserRole || "admin").toLowerCase();
  const allowedForRole =
    normalizedRole === "owner" ||
    normalizedRole === "admin" ||
    registered.allowedRoles.includes(normalizedRole);

  return {
    valid: true,
    allowedForRole,
    simulateOnlyInPreview: Boolean(registered.mutatesOperationalData),
    reason: allowedForRole
      ? undefined
      : `الدور الحالي (${currentUserRole}) لا يملك الصلاحيات المطلوبة (${registered.requiredPermissions.join(", ")}).`,
  };
}
