import { getActiveUserPermissionsSync } from "./userAuthorization";

/**
 * Maps known Arabic UI titles, card headings, and route paths to canonical UserPermission keys.
 * Any interactive card, button, tab, or link that does not match a canonical key
 * automatically receives a deterministic `ui_item:<normalizedLabel>` key so EVERY box, icon,
 * and link in the application can be individually toggled in the Visual Permissions Studio.
 */
const LABEL_TO_PERMISSION_KEY: Record<string, string> = {
  // Main 8 Departments
  "إدارة المطعم": "page_restaurant",
  "إدارة المول": "page_mall",
  "إدارة الحديقة": "page_park",
  "الإدارة المالية": "page_finance",
  "الموارد البشرية والمستخدمين": "page_hr",
  "إدارة المخزون والمستودعات": "page_inventory",
  "المخزون والمستودعات": "page_inventory",
  "تدقيق الورديات وسجل العمليات": "page_shift_audit",
  "خيارات المطور والنسخ الاحتياطي": "page_developer",

  // Restaurant Sub-pages & Action Boxes
  "نقطة البيع (POS) الكاشير": "pos",
  "شاشة الكاشير (POS)": "pos",
  "نقطة البيع": "pos",
  "الكابتن أوردر": "captain",
  "شاشة الكابتن أوردر للطاولات": "captain",
  "شاشة المطبخ والفرن الذكية": "kitchen",
  "شاشة المطبخ (KDS)": "kitchen",
  "متابعة الطلبات والفواتير": "orders",
  "سجل الطلبات والفواتير": "orders",
  "طلبات التوصيل (الديليفري)": "delivery",
  "إدارة الطاولات والصالات": "page_restaurant_tables",
  "إدارة الصالة والطاولات": "page_restaurant_tables",
  "قائمة الطعام والأصناف": "page_restaurant_menu",
  "قائمة الطعام والمنيو": "page_restaurant_menu",
  "الريسبي ومكونات الأصناف": "page_restaurant_inventory",
  "سندات إيراد ومصروف المطعم": "page_restaurant_vouchers",
  "الكاشير والخزينة": "page_restaurant_cashier_treasury",
  "تسليم وإغلاق وردية الكاشير": "page_restaurant_cashier_treasury",
  "فتح وردية جديدة": "restaurant_open_shift",
  "ورديات المطعم والكاشير": "restaurant_open_shift",
  "سجل وتقارير ورديات المطعم": "restaurant_open_shift",
  "تقرير مبيعات المطعم التفصيلي": "reports_view_sales",
  "تقرير الأصناف الأكثر مبيعاً": "reports_view_sales",
  "ملخص المبيعات اليومي": "reports_view_sales",

  // Mall Sub-pages & Action Boxes
  "دليل المحلات والوحدات": "page_mall_shops",
  "سجل المستأجرين": "page_mall_shops",
  "عقود الإيجار النشطة": "page_mall_shops",
  "قراءات العدادات والمرافق": "page_mall_payments",
  "تحصيل الإيجارات والمرافق": "page_mall_payments",
  "متابعة المتأخرات والمديونيات": "page_mall_payments",
  "تقرير إيرادات وتحصيلات المول": "page_mall_reports",
  "تقرير المتأخرات والمديونيات": "page_mall_reports",
  "تقرير نسب الإشغال والوحدات": "page_mall_reports",

  // Park Sub-pages & Action Boxes
  "نقطة بيع التذاكر والورديات": "page_park_pos",
  "شاشة الكاشير والخزينة": "page_park_treasury",
  "ربط خزينة وحسابات الحديقة": "page_park_treasury",
  "سجل تذاكر الدخول والمبيعات": "page_park_tickets_log",
  "سجل عملاء الحديقة": "page_park_customers",
  "تعريف الألعاب والأنشطة": "page_park_prices",
  "فئات وأسعار التذاكر": "page_park_prices",
  "تقارير ورديات الحديقة": "park_reports",
  "تقرير أداء الألعاب": "park_reports",

  // Finance Sub-pages & Action Boxes
  "شجرة ودليل الحسابات": "page_finance_accounts",
  "دليل وشجرة الحسابات": "page_finance_accounts",
  "تعريف الخزائن والبنوك": "page_finance_treasury",
  "إدارة الخزائن والحسابات": "page_finance_treasury",
  "إصدار سند مالي جديد": "page_finance_vouchers",
  "تفقد وسجل سندات القبض والصرف": "page_finance_vouchers",
  "التحويل بين الخزائن": "treasury_transfer_reconcile",
  "قيود اليومية المحاسبية": "page_finance_journal",
  "إضافة قيد يومية جديد": "accounting_post_journal",
  "دفتر الأستاذ العام": "page_finance_ledger",
  "النظام المحاسبي والتقارير المالية الشاملة": "page_finance_reports",
  "تقرير أرصدة وحركة الخزائن": "treasury_view",

  // HR Sub-pages & Action Boxes
  "سجل وبيانات الموظفين": "page_hr_employees",
  "حسابات المستخدمين والصلاحيات": "users_roles",
  "إضافة مستخدم جديد": "system_manage_users",
  "تسجيل الحضور والانصراف": "page_hr_attendance",
  "تقرير الحضور والغياب": "page_hr_attendance",
  "مسير الرواتب والأجور": "page_hr_payroll",
  "تقرير مسير الرواتب": "page_hr_payroll",
  "السلف والخصومات": "page_hr_loans",
  "تقرير السلف والخصومات": "page_hr_loans",

  // Inventory Sub-pages & Action Boxes
  "تعريف المستودعات والمخازن": "page_inventory_warehouses",
  "دليل الأصناف والمواد الخام": "page_inventory_items",
  "التحويلات المخزنية والصرف": "page_inventory_transfers",
  "فواتير المشتريات والتوريد": "page_inventory_purchases",
  "دليل الموردين والشركات": "page_inventory_suppliers",
  "سجل الحركات والأذون المخزنية": "page_inventory_transactions",
  "متابعة تواريخ الصلاحية": "page_inventory_expiry",
  "تسجيل الهالك والتسويات الجردية": "page_inventory_waste",
  "ربط الحسابات وسياسات المخزون": "page_inventory_settings",
  "تقرير أرصدة المخزون الحالية": "page_inventory_reports",
  "تقييم المخزون المالي": "page_inventory_reports",
  "تقرير حركة الأصناف والتوريد": "page_inventory_reports",
  "تقرير النواقص وحد الطلب": "page_inventory_reports",
  "تقرير الهالك والتالف": "page_inventory_reports",
  "تقرير تكلفة الأغذية (Food Cost)": "page_inventory_reports",

  // Shift Audit & Operations Log
  "لوحة تدقيق ومزامنة الورديات (الحديقة والمطعم)": "page_shift_audit_matching",
  "سجل العمليات والرقابة الشاملة": "page_audit_logs",

  // Developer & System
  "استوديو المطور Pro": "developer_options",
  "إعدادات الفروع وقواعد البيانات": "branch_mgmt",
  "حزمة وجداول قاعدة بيانات أكسس": "page_system_access_db",
  "إعدادات مستودع GitHub والربط السحابي": "page_system_github",
  "تحديث ومزامنة النظام و GitHub": "page_system_github",
  "النسخ الاحتياطي والتحديثات": "system_backup_update",
  "النسخ الاحتياطي واستعادة البيانات": "system_backup_update",
  "حالة النظام والفحص الذاتي": "page_system_status",
  "تقرير إحصائيات جداول النظام والسجلات": "page_system_status",
  "تقرير حالة الإصدارات والربط السحابي": "page_system_status",
};

function extractPrimaryLabel(el: HTMLElement): string {
  const explicitAttr = el.getAttribute("data-perm-label") || el.getAttribute("title");
  if (explicitAttr && explicitAttr.trim().length >= 2) {
    return explicitAttr.trim();
  }
  const heading = el.querySelector(
    "h1, h2, h3, h4, h5, [class*='font-black'], [class*='font-bold']",
  );
  if (heading && heading.textContent) {
    const hText = heading.textContent.replace(/(?:✓|✕|☑️|☑|☐)/g, "").trim();
    if (hText.length >= 2 && hText.length <= 90) {
      return hText;
    }
  }
  // Clone without injected perm studio badges
  const rawText = Array.from(el.childNodes)
    .filter((n) => !(n instanceof HTMLElement && n.hasAttribute("data-perm-studio-badge")))
    .map((n) => n.textContent || "")
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/(?:✓|✕|☑️|☑|☐)/g, "")
    .trim();

  const firstLine = rawText.split("\n")[0]?.trim() || rawText;
  return firstLine.slice(0, 80).trim();
}

export function resolveElementPermissionBinding(
  el: HTMLElement,
): { key: string; label: string } | null {
  if (el.closest("[data-perm-studio-ignore='true']") || el.hasAttribute("data-perm-studio-badge")) {
    return null;
  }

  const explicitKey = el.getAttribute("data-perm-key");
  const label = extractPrimaryLabel(el);
  if (explicitKey) {
    return { key: explicitKey, label: label || explicitKey };
  }

  if (!label || label.length < 2) return null;

  // Ignore generic system chrome or tiny counters
  if (
    /^[0-9#.,\s+-]+$/.test(label) ||
    label === "Restocash" ||
    label === "العربية" ||
    label === "English" ||
    label.startsWith("v1.") ||
    label.startsWith("v2.")
  ) {
    return null;
  }

  // Exact match in canonical dictionary
  if (LABEL_TO_PERMISSION_KEY[label]) {
    return { key: LABEL_TO_PERMISSION_KEY[label], label };
  }

  // Substring match for main headings inside cards
  for (const [knownTitle, permKey] of Object.entries(LABEL_TO_PERMISSION_KEY)) {
    if (
      label === knownTitle ||
      (label.startsWith(knownTitle) && label.length <= knownTitle.length + 18)
    ) {
      return { key: permKey, label: knownTitle };
    }
  }

  const pathname =
    typeof window !== "undefined"
      ? window.location.pathname.replace(/\/+$/, "") || "/admin"
      : "/admin";

  const normalizedLabel = label.replace(/\s+/g, "_").slice(0, 60);
  return {
    key: `ui_item:${pathname}:${normalizedLabel}`,
    label,
  };
}

function collectTargetableElements(): HTMLElement[] {
  if (typeof document === "undefined") return [];
  const results: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();

  // 1. Explicit data-perm-key elements
  document.querySelectorAll<HTMLElement>("[data-perm-key]").forEach((el) => {
    if (!seen.has(el)) {
      seen.add(el);
      results.push(el);
    }
  });

  // 2. Interactive cards/boxes in main content grids, plus links & action buttons
  const candidates = document.querySelectorAll<HTMLElement>(
    "main a, main button, nav a, nav button, main [role='button'], main div.cursor-pointer",
  );

  candidates.forEach((el) => {
    if (seen.has(el)) return;
    if (el.hasAttribute("data-perm-studio-badge")) return;
    if (el.closest("[data-perm-studio-badge]")) return;
    if (el.closest("[role='dialog'], [data-radix-popper-content-wrapper]")) return;

    const parentTarget = el.parentElement?.closest(
      "a, button, [role='button'], div.cursor-pointer",
    ) as HTMLElement | null;
    if (parentTarget && seen.has(parentTarget) && el.tagName !== "BUTTON") {
      return;
    }

    const rect = el.getBoundingClientRect();
    if (rect.width < 36 || rect.height < 24) return;

    const binding = resolveElementPermissionBinding(el);
    if (!binding) return;

    seen.add(el);
    results.push(el);
  });

  return results;
}

export function isPermissionKeyEnabled(
  perms: Record<string, boolean | undefined> | null | undefined,
  key: string,
): boolean {
  if (!perms || typeof perms !== "object") return true;
  const val = perms[key];
  if (val === false) return false;
  if (key.startsWith("ui_item:")) {
    return true;
  }
  if (perms.super_admin_full_access === true) {
    return true;
  }
  if (typeof val === "boolean") {
    return val;
  }
  return true;
}

export function setupVisualPermissionsRuntime(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  const isPermStudioIframe = () =>
    new URLSearchParams(window.location.search).get("__perm_studio") === "1";

  let studioPermissions: Record<string, boolean> = {};

  // Ensure internal links inside __perm_studio=1 preserve __perm_studio=1
  const clickInterceptor = (event: MouseEvent) => {
    if (!isPermStudioIframe()) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const badge = target.closest("[data-perm-studio-badge='true']") as HTMLElement | null;
    if (badge) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const permKey = badge.getAttribute("data-perm-target-key");
      const permLabel = badge.getAttribute("data-perm-target-label") || "";
      if (permKey && window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            type: "PERM_STUDIO_TOGGLE",
            permKey,
            label: permLabel,
          },
          window.location.origin,
        );
      }
      return;
    }
  };

  const syncPermStudioOverlays = () => {
    if (!isPermStudioIframe()) return;

    // Keep __perm_studio=1 in URL so route transitions inside the studio stay in studio mode
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("__perm_studio") !== "1") {
        url.searchParams.set("__perm_studio", "1");
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
      }
    } catch {
      // ignore
    }

    // Notify parent of current route inside studio
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: "PERM_STUDIO_ROUTE_CHANGED",
          pathname: window.location.pathname,
          search: window.location.search,
        },
        window.location.origin,
      );
    }

    const elements = collectTargetableElements();
    elements.forEach((el) => {
      const binding = resolveElementPermissionBinding(el);
      if (!binding) return;

      const enabled = isPermissionKeyEnabled(studioPermissions, binding.key);

      // Ensure relative positioning so checkbox badge sits cleanly on the element
      const computedPos = window.getComputedStyle(el).position;
      if (computedPos === "static") {
        el.style.position = "relative";
      }

      if (enabled) {
        el.style.opacity = "1";
        el.style.filter = "none";
        el.style.outline = "2px solid rgba(16, 185, 129, 0.45)";
        el.style.outlineOffset = "-2px";
      } else {
        el.style.opacity = "0.45";
        el.style.filter = "grayscale(0.75)";
        el.style.outline = "2px dashed rgba(239, 68, 68, 0.65)";
        el.style.outlineOffset = "-2px";
      }

      let badge = el.querySelector<HTMLElement>(":scope > [data-perm-studio-badge='true']");
      if (!badge) {
        badge = document.createElement("span");
        badge.setAttribute("data-perm-studio-badge", "true");
        badge.style.cssText =
          "position:absolute;top:6px;left:6px;z-index:35;display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:7px;font-size:11px;font-weight:900;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.18);user-select:none;line-height:1.3;transition:all 150ms ease;";
        el.appendChild(badge);
      }

      badge.setAttribute("data-perm-target-key", binding.key);
      badge.setAttribute("data-perm-target-label", binding.label);
      if (enabled) {
        badge.style.backgroundColor = "#059669";
        badge.style.color = "#ffffff";
        badge.style.border = "1px solid #10b981";
        badge.textContent = "☑ ظاهر";
      } else {
        badge.style.backgroundColor = "#dc2626";
        badge.style.color = "#ffffff";
        badge.style.border = "1px solid #f87171";
        badge.textContent = "☐ مخفي";
      }
    });
  };

  const enforceRuntimeUserPermissions = () => {
    if (isPermStudioIframe()) return;
    const path = window.location.pathname;
    if (path.startsWith("/admin/studio") || path.startsWith("/login")) return;

    const perms = getActiveUserPermissionsSync();
    if (!perms || Object.keys(perms).length === 0) return;

    const elements = collectTargetableElements();
    elements.forEach((el) => {
      const binding = resolveElementPermissionBinding(el);
      if (!binding) return;
      const allowed = isPermissionKeyEnabled(perms, binding.key);
      if (!allowed) {
        el.setAttribute("data-perm-hidden", "1");
        el.style.setProperty("display", "none", "important");
      } else if (el.getAttribute("data-perm-hidden") === "1") {
        el.removeAttribute("data-perm-hidden");
        el.style.removeProperty("display");
      }
    });
  };

  const onMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin || !event.data) return;
    if (event.data.type === "PERM_STUDIO_SYNC") {
      studioPermissions = event.data.permissions || {};
      try {
        sessionStorage.setItem("__perm_studio_active", "1");
        sessionStorage.setItem("__perm_studio_perms", JSON.stringify(studioPermissions));
      } catch {
        // ignore
      }
      syncPermStudioOverlays();
    } else if (event.data.type === "PERM_STUDIO_NAVIGATE" && event.data.url) {
      window.location.href = event.data.url;
    }
  };

  // Restore studio state across internal route navigations inside the iframe
  if (
    new URLSearchParams(window.location.search).get("__perm_studio") === "1" ||
    sessionStorage.getItem("__perm_studio_active") === "1"
  ) {
    if (window.parent && window.parent !== window) {
      try {
        const cached = sessionStorage.getItem("__perm_studio_perms");
        if (cached) studioPermissions = JSON.parse(cached);
      } catch {
        // ignore
      }
      const url = new URL(window.location.href);
      if (url.searchParams.get("__perm_studio") !== "1") {
        url.searchParams.set("__perm_studio", "1");
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
      }
    } else {
      sessionStorage.removeItem("__perm_studio_active");
      sessionStorage.removeItem("__perm_studio_perms");
    }
  }

  let debounceTimer: number | null = null;
  const scheduleSync = () => {
    if (debounceTimer) window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      if (isPermStudioIframe()) {
        syncPermStudioOverlays();
      } else {
        enforceRuntimeUserPermissions();
      }
    }, 60);
  };

  window.addEventListener("message", onMessage);
  document.addEventListener("click", clickInterceptor, true);
  window.addEventListener("popstate", scheduleSync);
  window.addEventListener("permissions_updated", scheduleSync);

  const observer = new MutationObserver(() => {
    scheduleSync();
  });
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }

  scheduleSync();

  return () => {
    if (debounceTimer) window.clearTimeout(debounceTimer);
    observer.disconnect();
    window.removeEventListener("message", onMessage);
    document.removeEventListener("click", clickInterceptor, true);
    window.removeEventListener("popstate", scheduleSync);
    window.removeEventListener("permissions_updated", scheduleSync);
  };
}
