import { MenuItem, MenuItemAddition, QuickOption } from "@/shared/types";

export interface ProductQuickOptionsResult {
  quickOptions: QuickOption[];
  additions: MenuItemAddition[];
}

const WATER_QUICK_OPTIONS: QuickOption[] = [
  { id: "water_cold", label_ar: "بارد", label_en: "Cold", group: "temp" },
  { id: "water_room", label_ar: "درجة حرارة الغرفة", label_en: "Room Temperature", group: "temp" },
  { id: "water_warm", label_ar: "ساخن / دافئ", label_en: "Warm / Hot", group: "temp" },
  { id: "water_cup", label_ar: "مع كوب", label_en: "With Cup", group: "serving" },
  { id: "water_ice", label_ar: "مع ثلج", label_en: "With Ice", group: "ice" },
  { id: "water_no_ice", label_ar: "بدون ثلج", label_en: "No Ice", group: "ice" },
];

const COLD_DRINK_QUICK_OPTIONS: QuickOption[] = [
  { id: "drink_chilled", label_ar: "بارد جداً", label_en: "Chilled", group: "temp" },
  { id: "drink_ice", label_ar: "مع ثلج", label_en: "With Ice", group: "ice" },
  { id: "drink_no_ice", label_ar: "بدون ثلج", label_en: "No Ice", group: "ice" },
  { id: "drink_cup", label_ar: "مع كوب", label_en: "With Cup", group: "serving" },
];

const HOT_DRINK_QUICK_OPTIONS: QuickOption[] = [
  { id: "sugar_none", label_ar: "سادة (بدون سكر)", label_en: "No Sugar", group: "sugar" },
  { id: "sugar_medium", label_ar: "سكر مضبوط", label_en: "Medium Sugar", group: "sugar" },
  { id: "sugar_extra", label_ar: "سكر زيادة", label_en: "Extra Sugar", group: "sugar" },
  { id: "mint_extra", label_ar: "نعناع إضافي", label_en: "Extra Mint", group: "prep" },
];

const PIZZA_QUICK_OPTIONS: QuickOption[] = [
  { id: "no_onion", label_ar: "بدون بصل", label_en: "No Onion", group: "exclude" },
  { id: "no_pepper", label_ar: "بدون فلفل", label_en: "No Pepper", group: "exclude" },
  { id: "no_olives", label_ar: "بدون زيتون", label_en: "No Olives", group: "exclude" },
  { id: "thin_crust", label_ar: "عجينة رفيعة", label_en: "Thin Crust", group: "prep" },
  { id: "well_done", label_ar: "تحمير إضافي", label_en: "Well Done", group: "prep" },
];

const BURGER_QUICK_OPTIONS: QuickOption[] = [
  { id: "no_onion", label_ar: "بدون بصل", label_en: "No Onion", group: "exclude" },
  { id: "no_tomato", label_ar: "بدون طماطم", label_en: "No Tomato", group: "exclude" },
  { id: "no_pickles", label_ar: "بدون مخلل", label_en: "No Pickles", group: "exclude" },
  { id: "spicy", label_ar: "سبايسي (حار)", label_en: "Spicy", group: "spice" },
  { id: "well_done", label_ar: "سوى كامل", label_en: "Well Done", group: "prep" },
];

const GRILL_QUICK_OPTIONS: QuickOption[] = [
  { id: "medium_grill", label_ar: "سوى متوسط", label_en: "Medium", group: "prep" },
  { id: "well_done", label_ar: "سوى كامل", label_en: "Well Done", group: "prep" },
  { id: "no_onion", label_ar: "بدون بصل", label_en: "No Onion", group: "exclude" },
  { id: "extra_spicy", label_ar: "تتبيلة حارة", label_en: "Spicy Seasoning", group: "spice" },
];

const SALAD_QUICK_OPTIONS: QuickOption[] = [
  { id: "dressing_side", label_ar: "الصوص جانبي", label_en: "Dressing on Side", group: "prep" },
  { id: "no_onion", label_ar: "بدون بصل", label_en: "No Onion", group: "exclude" },
  { id: "extra_lemon", label_ar: "ليمون إضافي", label_en: "Extra Lemon", group: "prep" },
];

const APPETIZER_QUICK_OPTIONS: QuickOption[] = [
  { id: "crispy", label_ar: "مقرمش", label_en: "Extra Crispy", group: "prep" },
  { id: "less_oil", label_ar: "زيت أقل", label_en: "Light Oil", group: "prep" },
  { id: "no_spices", label_ar: "بدون شطة", label_en: "No Chili", group: "spice" },
];

const DESSERT_QUICK_OPTIONS: QuickOption[] = [
  { id: "light_syrup", label_ar: "شربات خفيف", label_en: "Light Syrup", group: "sweetness" },
  { id: "extra_syrup", label_ar: "شربات زيادة", label_en: "Extra Syrup", group: "sweetness" },
  { id: "warm_serve", label_ar: "تقديم دافئ", label_en: "Serve Warm", group: "temp" },
];

const PIZZA_ADDITIONS: MenuItemAddition[] = [
  { id: "extra_mozzarella", name_ar: "جبنة موزاريلا إضافية", name_en: "Extra Mozzarella", price: 1.5, deduct_qty: 50, deduct_unit: "g", materialKey: "mozzarella" },
  { id: "extra_onion", name_ar: "بصل إضافي", name_en: "Extra Onion", price: 0.4, deduct_qty: 25, deduct_unit: "g", materialKey: "onion" },
  { id: "extra_pepper", name_ar: "فلفل إضافي", name_en: "Extra Pepper", price: 0.5, deduct_qty: 25, deduct_unit: "g", materialKey: "bell_pepper" },
  { id: "extra_olives", name_ar: "زيتون إضافي", name_en: "Extra Olives", price: 0.6, deduct_qty: 25, deduct_unit: "g", materialKey: "olives" },
  { id: "extra_pepperoni", name_ar: "بيبروني إضافي", name_en: "Extra Pepperoni", price: 2.0, deduct_qty: 35, deduct_unit: "g", materialKey: "pepperoni" },
];

const BURGER_ADDITIONS: MenuItemAddition[] = [
  { id: "extra_cheddar", name_ar: "شريحة جبنة شيدر إضافية", name_en: "Extra Cheddar", price: 1.0, deduct_qty: 30, deduct_unit: "g", materialKey: "cheddar" },
  { id: "side_fries", name_ar: "بطاطس مقلية جانبية", name_en: "Side Fries", price: 1.5, deduct_qty: 120, deduct_unit: "g", materialKey: "potatoes" },
  { id: "extra_onion_burger", name_ar: "بصل إضافي", name_en: "Extra Onion", price: 0.3, deduct_qty: 20, deduct_unit: "g", materialKey: "onion" },
];

const GRILL_ADDITIONS: MenuItemAddition[] = [
  { id: "extra_tahini", name_ar: "طحينة إضافية", name_en: "Extra Tahini", price: 0.75, deduct_qty: 40, deduct_unit: "g", materialKey: "tahini" },
  { id: "extra_bread", name_ar: "خبز إضافي", name_en: "Extra Bread", price: 0.4, deduct_qty: 1, deduct_unit: "pcs", materialKey: "saj_bread" },
  { id: "side_fries_grill", name_ar: "بطاطس مقلية جانبية", name_en: "Side Fries", price: 1.5, deduct_qty: 120, deduct_unit: "g", materialKey: "potatoes" },
];

const SALAD_ADDITIONS: MenuItemAddition[] = [
  { id: "extra_dressing", name_ar: "صوص سيزر إضافي", name_en: "Extra Dressing", price: 0.6, deduct_qty: 30, deduct_unit: "g", materialKey: "caesar_dressing" },
  { id: "extra_feta", name_ar: "جبنة فيتا إضافية", name_en: "Extra Feta", price: 1.2, deduct_qty: 40, deduct_unit: "g", materialKey: "feta_cheese" },
];

const DESSERT_ADDITIONS: MenuItemAddition[] = [
  { id: "extra_cream", name_ar: "قشطة إضافية", name_en: "Extra Cream", price: 1.2, deduct_qty: 40, deduct_unit: "g", materialKey: "cream" },
];

export function resolveProductCustomizationConfig(
  item: Partial<MenuItem> | null | undefined,
  categoryNameAr?: string,
): ProductQuickOptionsResult {
  if (!item) return { quickOptions: [], additions: [] };

  const customOpts = Array.isArray(item.quick_options) && item.quick_options.length > 0
    ? item.quick_options
    : null;
  const customAdds = Array.isArray(item.additions) && item.additions.length > 0
    ? item.additions
    : null;

  const name = String(item.name_ar || "").toLowerCase();
  const cat = String(categoryNameAr || "").toLowerCase();

  let fallbackOptions: QuickOption[] = [];
  let fallbackAdditions: MenuItemAddition[] = [];

  if (/ماء|مياه|water/i.test(name)) {
    fallbackOptions = WATER_QUICK_OPTIONS;
    fallbackAdditions = [];
  } else if (/قهوة|شاي|نسكافيه|كابتشينو|espresso|coffee|tea/i.test(name)) {
    fallbackOptions = HOT_DRINK_QUICK_OPTIONS;
    fallbackAdditions = [];
  } else if (/كولا|كوكاكولا|بيبسي|عصير|soda|cola|juice|مشروب/i.test(name) || /مشروبات/.test(cat)) {
    fallbackOptions = COLD_DRINK_QUICK_OPTIONS;
    fallbackAdditions = [];
  } else if (/بيتزا|pizza/i.test(name) || /بيتزا/.test(cat)) {
    fallbackOptions = PIZZA_QUICK_OPTIONS;
    fallbackAdditions = PIZZA_ADDITIONS;
  } else if (/برجر|ساندويتش|شاورما|burger|sandwich/i.test(name) || /برجر/.test(cat)) {
    fallbackOptions = BURGER_QUICK_OPTIONS;
    fallbackAdditions = BURGER_ADDITIONS;
  } else if (/مشاوي|كباب|فراخ|كفتة|grill|kebab/i.test(name) || /مشويات/.test(cat)) {
    fallbackOptions = GRILL_QUICK_OPTIONS;
    fallbackAdditions = GRILL_ADDITIONS;
  } else if (/سلطة|salad/i.test(name) || /سلطات/.test(cat)) {
    fallbackOptions = SALAD_QUICK_OPTIONS;
    fallbackAdditions = SALAD_ADDITIONS;
  } else if (/بطاطس|حمص|بابا غنوج|مقبلات/i.test(name) || /مقبلات/.test(cat)) {
    fallbackOptions = APPETIZER_QUICK_OPTIONS;
    fallbackAdditions = [];
  } else if (/كنافة|أم علي|ام علي|بسبوسة|حلو/i.test(name) || /حلويات/.test(cat)) {
    fallbackOptions = DESSERT_QUICK_OPTIONS;
    fallbackAdditions = DESSERT_ADDITIONS;
  } else {
    fallbackOptions = [
      { id: "no_onion", label_ar: "بدون بصل", label_en: "No Onion", group: "exclude" },
      { id: "well_done", label_ar: "سوى كامل", label_en: "Well Done", group: "prep" },
    ];
    fallbackAdditions = [];
  }

  return {
    quickOptions: customOpts || fallbackOptions,
    additions: customAdds || fallbackAdditions,
  };
}

export function normalizeOptionList(options?: Array<QuickOption | string>): string[] {
  if (!Array.isArray(options)) return [];
  return Array.from(
    new Set(
      options
        .map((opt) => (typeof opt === "string" ? opt.trim() : (opt?.label_ar || opt?.id || "").trim()))
        .filter(Boolean),
    ),
  ).sort();
}

export function normalizeAdditionsList(additions?: Array<MenuItemAddition | any>): string[] {
  if (!Array.isArray(additions)) return [];
  return Array.from(
    new Set(
      additions
        .map((a) => String(a?.id || a?.name_ar || a || "").trim())
        .filter(Boolean),
    ),
  ).sort();
}

export function buildCartLineKey(params: {
  itemId: string;
  selectedOptions?: Array<QuickOption | string>;
  selectedAdditions?: Array<MenuItemAddition | any>;
  notes?: string;
}): string {
  const opts = normalizeOptionList(params.selectedOptions).join(",");
  const adds = normalizeAdditionsList(params.selectedAdditions).join(",");
  const cleanNote = String(params.notes || "").trim().toLowerCase();
  return `${params.itemId}::opts[${opts}]::adds[${adds}]::note[${cleanNote}]`;
}

export function getAdditionsUnitPrice(selectedAdditions?: Array<MenuItemAddition | any>): number {
  if (!Array.isArray(selectedAdditions)) return 0;
  return selectedAdditions.reduce((sum, add) => sum + Number(add?.price || 0), 0);
}

export function getLineUnitPrice(itemPrice: number, selectedAdditions?: Array<MenuItemAddition | any>): number {
  return Number(itemPrice || 0) + getAdditionsUnitPrice(selectedAdditions);
}

export function formatLineCustomizationSummary(line: {
  selectedOptions?: Array<QuickOption | string>;
  selectedAdditions?: Array<MenuItemAddition | any>;
  notes?: string;
}): string {
  const parts: string[] = [];
  if (Array.isArray(line.selectedOptions) && line.selectedOptions.length > 0) {
    const optNames = line.selectedOptions
      .map((o) => (typeof o === "string" ? o : o.label_ar || o.label_en || ""))
      .filter(Boolean);
    if (optNames.length > 0) parts.push(optNames.join(" • "));
  }
  if (Array.isArray(line.selectedAdditions) && line.selectedAdditions.length > 0) {
    const addNames = line.selectedAdditions
      .map((a) => `+${typeof a === "string" ? a : a.name_ar || a.name || ""}`)
      .filter(Boolean);
    if (addNames.length > 0) parts.push(addNames.join("، "));
  }
  if (line.notes && line.notes.trim()) {
    parts.push(line.notes.trim());
  }
  return parts.join(" | ");
}

/**
 * Strips ALL financial, exchange rate, currency, payment authorization, and internal workflow tags
 * from notes displayed on kitchen / oven KDS cards.
 */
export function sanitizeKitchenNotes(rawNotes: string | null | undefined): string {
  if (!rawNotes) return "";
  const withoutTags = String(rawNotes)
    .replace(/\[SELF_ORDER_PENDING_CAPTAIN\]/g, "")
    .replace(/\[SELF_ORDER_ACTIVE\]/g, "")
    .replace(/\[SENT_TO_KITCHEN\]/g, "")
    .replace(/\[KITCHEN_START:[^\]]+\]/g, "")
    .replace(/\[SENT_TO_CASHIER\]/g, "")
    .replace(/\[CASHIER_PAID\]/g, "")
    .replace(/\[TABLE_ASSISTANCE_CALL\]/g, "")
    .replace(/\[BILL_REQUEST\]/g, "")
    .replace(/\[CANCELLED_BY_CAPTAIN\]/g, "")
    .trim();

  const cleaned = withoutTags
    .split("|")
    .map((part) => part.trim())
    .filter((part) => {
      if (!part) return false;
      if (/^(العملة|currency)\s*:/i.test(part)) return false;
      if (/^(المعامل|سعر\s*الصرف|exchange\s*rate|factor)\s*:/i.test(part)) return false;
      if (/^(رسوم\s*(ال)?توصيل|delivery\s*fee)\s*:/i.test(part)) return false;
      if (/^(الخصم|discount)\s*:/i.test(part)) return false;
      if (/^(خدمة\s*صالة|رسوم\s*الخدمة|service\s*fee)\s*:/i.test(part)) return false;
      if (/^(الإجمالي|المجموع|الضريبة|total|subtotal|tax)\s*:/i.test(part)) return false;
      if (/^AUTH#\s*:/i.test(part)) return false;
      if (/^رقم\s*الموبايل\s*:/i.test(part)) return false;
      return true;
    })
    .join(" | ")
    .trim();

  return cleaned;
}

/**
 * Returns true for pure Captain alerts / bill requests that MUST NOT appear on Oven / KDS.
 */
export function isNonKitchenNotificationOrder(order: any): boolean {
  if (!order) return true;
  const notesStr = String(order.notes || "");
  if (
    notesStr.includes("[TABLE_ASSISTANCE_CALL]") ||
    notesStr.includes("[BILL_REQUEST]") ||
    notesStr.includes("[SELF_ORDER_PENDING_CAPTAIN]") ||
    notesStr.includes("[CASHIER_PAID]") ||
    notesStr.includes("[CANCELLED_BY_CAPTAIN]")
  ) {
    return true;
  }

  if (order.request_type === "call_captain" || order.request_type === "request_bill") {
    return true;
  }

  let itemsArr: any[] = [];
  if (Array.isArray(order.items)) {
    itemsArr = order.items;
  } else if (typeof order.items === "string") {
    try {
      const parsed = JSON.parse(order.items);
      if (Array.isArray(parsed)) itemsArr = parsed;
    } catch {
      itemsArr = [];
    }
  }

  if (itemsArr.length > 0 && itemsArr.every((it) => Boolean(it?.is_assistance_call))) {
    return true;
  }

  if (
    itemsArr.length > 0 &&
    itemsArr.every(
      (it) => it?.request_type === "call_captain" || it?.request_type === "request_bill",
    )
  ) {
    return true;
  }

  return false;
}

export function shouldOpenCustomizationOnAdd(
  item: any,
  categoryNameAr?: string,
): boolean {
  const cfg = resolveProductCustomizationConfig(item, categoryNameAr);
  return cfg.quickOptions.length > 0 || cfg.additions.length > 0;
}

export interface OrderCurrencySnapshot {
  pricingCurrency: string;
  paymentCurrency: string;
  paymentExchangeRate: number;
  paymentAmount: number;
}

export function resolveOrderCurrencySnapshot(
  order: any,
  fallbackCurrency: string = "USD",
  fallbackRates?: Record<string, number>,
): OrderCurrencySnapshot {
  const pricingCurrency = String(order?.pricing_currency || "USD")
    .trim()
    .toUpperCase();
  const noteCurrencyMatch = String(order?.notes || "").match(/العملة:\s*([A-Za-z]+)/);
  const rawCurrency =
    order?.payment_currency ||
    order?.currency ||
    (noteCurrencyMatch ? noteCurrencyMatch[1] : null) ||
    fallbackCurrency ||
    "USD";
  const paymentCurrency = String(rawCurrency).trim().toUpperCase();

  const noteRateMatch = String(order?.notes || "").match(/المعامل:\s*([0-9]+(?:\.[0-9]+)?)/);
  const explicitRate = Number(order?.payment_exchange_rate);
  const parsedNoteRate = noteRateMatch ? Number(noteRateMatch[1]) : 0;
  const fallbackRate = Number(fallbackRates?.[paymentCurrency]);

  const paymentExchangeRate =
    paymentCurrency === "USD"
      ? 1
      : Number.isFinite(explicitRate) && explicitRate > 0
        ? explicitRate
        : Number.isFinite(parsedNoteRate) && parsedNoteRate > 0
          ? parsedNoteRate
          : Number.isFinite(fallbackRate) && fallbackRate > 0
            ? fallbackRate
            : 1;

  const baseUsdTotal = Number(order?.total ?? 0);
  const explicitPayAmt = Number(order?.payment_amount);
  const paymentAmount =
    Number.isFinite(explicitPayAmt) && explicitPayAmt > 0
      ? explicitPayAmt
      : Number((baseUsdTotal * paymentExchangeRate).toFixed(2));

  return {
    pricingCurrency,
    paymentCurrency,
    paymentExchangeRate,
    paymentAmount,
  };
}

export function formatOrderAmount(
  amountUsd: number,
  paymentCurrency: string = "USD",
  paymentExchangeRate: number = 1,
  lang: "ar" | "en" = "ar",
): string {
  const curr = String(paymentCurrency || "USD")
    .trim()
    .toUpperCase();
  const rate =
    curr === "USD"
      ? 1
      : Number.isFinite(Number(paymentExchangeRate)) && Number(paymentExchangeRate) > 0
        ? Number(paymentExchangeRate)
        : 1;
  const converted = Number(amountUsd || 0) * rate;
  const formatted = converted.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (lang === "ar") {
    if (curr === "EGP") return `${formatted} ج.م`;
    if (curr === "USD") return `${formatted} $`;
    if (curr === "SSP") return `${formatted} ج.ج.س`;
  } else {
    if (curr === "EGP") return `${formatted} EGP`;
    if (curr === "USD") return `$${formatted}`;
    if (curr === "SSP") return `${formatted} SSP`;
  }
  return `${formatted} ${curr}`;
}

