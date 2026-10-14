import { useState, useEffect, useCallback } from "react";
import { translator } from "@/shared/services/translationService";

export type Currency = "EGP" | "USD" | "SSP";
export type Language = "ar" | "en";

export function formatTreasuryCurrency(amount: number, currencyCode?: string) {
  const num = Number(amount || 0);
  const isNegative = num < 0;
  const absVal = Math.abs(num).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const val = isNegative ? `-${absVal}` : absVal;
  const code = (currencyCode || "EGP").toUpperCase().trim();

  if (code === "EGP" || code === "CASH_EGP" || code === "CARD_EGP" || code === "WALLET_EGP")
    return `${val} EGP`;
  if (code === "USD" || code === "CASH_USD" || code === "CARD_USD" || code === "WALLET_USD")
    return `${val} USD`;
  if (code === "EUR" || code === "CASH_EUR" || code === "CARD_EUR" || code === "WALLET_EUR")
    return `${val} EUR`;
  if (code === "SAR" || code === "CASH_SAR" || code === "CARD_SAR" || code === "WALLET_SAR")
    return `${val} SAR`;
  if (code === "SSP" || code === "CASH_SSP" || code === "CARD_SSP" || code === "WALLET_SSP")
    return `${val} SSP`;
  if (code === "MULTI") return `${val} (عملات متعددة)`;
  return `${val} ${code}`;
}

function computePageKey(overridePageKey?: string): string {
  if (overridePageKey) return overridePageKey;
  if (typeof window !== "undefined" && window.location) {
    const pathname = window.location.pathname;
    if (pathname === "/" || pathname === "/pos") return "pos";
    const cleaned = pathname.replace(/^\//, "").replace(/[^a-zA-Z0-9]/g, "_");
    return cleaned || "home";
  }
  return "global";
}

export function useSettings(overridePageKey?: string) {
  const [lang, setLang] = useState<Language>("ar");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [mounted, setMounted] = useState(false);

  const [exchangeRates, setExchangeRates] = useState<Record<Currency, number>>({
    USD: 1,
    EGP: 50,
    SSP: 100,
  });

  const currentPageKey = computePageKey(overridePageKey);
  const storageKey = `app_currency_${currentPageKey}`;

  const loadSettings = useCallback(() => {
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      const storedLang = localStorage.getItem("app_lang") as Language;
      if (storedLang) setLang(storedLang);

      const pageCurrencyKey = `app_currency_${computePageKey(overridePageKey)}`;
      const storedCurrency = localStorage.getItem(pageCurrencyKey) as Currency;
      if (storedCurrency) {
        setCurrency(storedCurrency);
      } else {
        // Fallback to legacy app_currency or USD default
        const legacyCurrency = localStorage.getItem("app_currency") as Currency;
        setCurrency(legacyCurrency || "USD");
      }

      const storedRates = localStorage.getItem("app_exchange_rates");
      if (storedRates) {
        try {
          setExchangeRates(JSON.parse(storedRates));
        } catch (e) {
          console.error("Failed to parse exchange rates", e);
        }
      }
    }
  }, [overridePageKey]);

  useEffect(() => {
    setMounted(true);
    loadSettings();

    const handleCustomEvent = (e: any) => {
      const targetKey = e?.detail?.pageKey;
      const thisKey = computePageKey(overridePageKey);
      if (!targetKey || targetKey === thisKey) {
        loadSettings();
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key?.startsWith("app_currency") ||
        e.key === "app_exchange_rates" ||
        e.key === "app_lang"
      ) {
        loadSettings();
      }
    };

    const handleLangChange = (e: any) => {
      const newLang = e?.detail?.lang;
      if (newLang) {
        setLang(newLang);
      } else {
        loadSettings();
      }
    };

    window.addEventListener("app_currency_changed" as any, handleCustomEvent);
    window.addEventListener("app_lang_changed" as any, handleLangChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("app_currency_changed" as any, handleCustomEvent);
      window.removeEventListener("app_lang_changed" as any, handleLangChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [loadSettings, overridePageKey]);

  const changeLang = (newLang: Language) => {
    setLang(newLang);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("app_lang", newLang);
      document.documentElement.lang = newLang;
      document.documentElement.dir = newLang === "ar" ? "rtl" : "ltr";
      translator.setLanguage(newLang);
      window.dispatchEvent(new CustomEvent("app_lang_changed", { detail: { lang: newLang } }));
    }
  };

  const changeCurrency = (newCurrency: Currency) => {
    setCurrency(newCurrency);
    if (typeof localStorage !== "undefined") {
      const key = `app_currency_${computePageKey(overridePageKey)}`;
      localStorage.setItem(key, newCurrency);
      window.dispatchEvent(
        new CustomEvent("app_currency_changed", {
          detail: { pageKey: computePageKey(overridePageKey), newCurrency },
        }),
      );
    }
  };

  const updateExchangeRate = (curr: Currency, rate: number) => {
    const newRates = { ...exchangeRates, [curr]: rate };
    setExchangeRates(newRates);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("app_exchange_rates", JSON.stringify(newRates));
      window.dispatchEvent(
        new CustomEvent("app_currency_changed", {
          detail: { pageKey: "rates_updated" },
        }),
      );
    }
  };

  const formatPrice = (amount: number, baseCurrency: Currency = "USD") => {
    const targetRate = exchangeRates[currency] || 1;
    const baseRate = exchangeRates[baseCurrency] || 1;

    // Convert base price (USD) to target currency using exchange rate (معامل التحويل)
    // If base is USD and target is EGP, amount * exchangeRates['EGP']
    let convertedAmount = amount;
    if (baseCurrency === "USD") {
      if (currency === "USD") convertedAmount = amount;
      else convertedAmount = amount * (exchangeRates[currency] || 1);
    } else {
      // if base is another currency
      const inUSD = amount / baseRate;
      convertedAmount = currency === "USD" ? inUSD : inUSD * (exchangeRates[currency] || 1);
    }

    const value = Number(convertedAmount || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    if (!mounted) {
      return `${value} $`;
    }

    if (lang === "ar") {
      if (currency === "EGP") return `${value} ج.م`;
      if (currency === "USD") return `${value} $`;
      if (currency === "SSP") return `${value} ج.ج.س`;
    } else {
      if (currency === "EGP") return `${value} EGP`;
      if (currency === "USD") return `$${value}`;
      if (currency === "SSP") return `${value} SSP`;
    }
    return `${value} ${currency}`;
  };

  return {
    lang,
    currency,
    exchangeRates,
    changeLang,
    changeCurrency,
    updateExchangeRate,
    formatPrice,
    formatTreasuryCurrency,
  };
}

export const translations = {
  ar: {
    title: "Juba Restaurant",
    subtitle: "نظام إدارة المطعم",
    pos: "نقطة البيع",
    admin: "الإدارة",
    search: "ابحث عن صنف...",
    all: "الكل",
    no_items: "لا توجد أصناف مطابقة",
    cart: "السلة والطلب",
    dine_in: "داخل المطعم",
    takeaway: "Takeaway",
    delivery: "توصيل",
    add_to_order: "إضافة للطلب",
    subtotal: "المجموع الفرعي",
    tax: "الضريبة (14%)",
    total: "الإجمالي",
    confirm_order: "تأكيد وإرسال الطلب",
    empty_cart: "سلة المشتريات فارغة",
    cash: "نقدي",
    card: "بطاقة",
    wallet: "محفظة",
    order_notes: "ملاحظات الطلب والطلبات الخاصة",
    notes_placeholder: "مثال: بدون بصل، زيادة كاتشب...",
    additions: "الإضافات المتوفرة",
    additions_placeholder: "اختر الإضافات...",
    table: "رقم الطاولة",
    choose_table: "اختر طاولة",
    order_type: "نوع الطلب",
    payment_method: "طريقة الدفع",
    export_excel: "تصدير Excel",
    logout: "تسجيل الخروج",
    back_to_pos: "العودة لنقطة البيع",
    home: "الرئيسية",
    menu: "المنيو",
    tables: "الطاولات",
    orders: "الطلبات",
    inventory: "المخزن",
    reports: "التقارير",
    users: "المستخدمين",
    employees: "الموظفين وحساباتهم",
    low_stock: "تنبيهات المخزن",
    quick_links: "روابط سريعة",
    invoice_title: "فاتورة ضريبية مبسطة",
    invoice_date: "التاريخ",
    invoice_order: "رقم الطلب",
    invoice_status: "الحالة",
    new_order: "طلب جديد",
    print: "طباعة",
    save: "حفظ",
    add: "إضافة",
    cancel: "إلغاء",
    edit: "تعديل",
    delete: "حذف",
    price: "السعر",
    name: "الاسم",
    actions: "الإجراءات",
    status_pending: "معلق",
    status_preparing: "تحضير",
    status_ready: "جاهز",
    status_served: "تم التقديم",
    status_cancelled: "ملغي",
    thank_you: "شكراً لزيارتكم — نتشرّف بخدمتكم دائماً",
    orders_page_title: "متابعة الطلبات",
    order_date: "التاريخ",
    order_type_header: "النوع",
    order_table: "الطاولة",
    order_total: "الإجمالي",
    order_status: "الحالة",
    order_payment: "الدفع",
    order_actions: "الإجراءات",
    details: "التفاصيل",
    notes: "ملاحظات",
    items: "الأصناف",
  },
  en: {
    title: "Juba Restaurant",
    subtitle: "Restaurant Management System",
    pos: "Point of Sale",
    admin: "Admin Panel",
    search: "Search for item...",
    all: "All",
    no_items: "No matching items found",
    cart: "Cart & Order",
    dine_in: "Dine-in",
    takeaway: "Takeaway",
    delivery: "Delivery",
    add_to_order: "Add to Order",
    subtotal: "Subtotal",
    tax: "Tax (14%)",
    total: "Total",
    confirm_order: "Confirm & Submit Order",
    empty_cart: "Your cart is empty",
    cash: "Cash",
    card: "Card",
    wallet: "Digital Wallet",
    order_notes: "Order Notes & Special Requests",
    notes_placeholder: "e.g., No onions, extra ketchup...",
    additions: "Available Additions",
    additions_placeholder: "Select additions...",
    table: "Table Number",
    choose_table: "Choose table",
    order_type: "Order Type",
    payment_method: "Payment Method",
    export_excel: "Export Excel",
    logout: "Sign Out",
    back_to_pos: "Back to POS",
    home: "Dashboard",
    menu: "Menu",
    tables: "Tables",
    orders: "Orders",
    inventory: "Inventory",
    reports: "Reports",
    users: "Users",
    employees: "Employees & Logins",
    low_stock: "Low Stock Alerts",
    quick_links: "Quick Links",
    invoice_title: "Simplified Tax Invoice",
    invoice_date: "Date",
    invoice_order: "Order #",
    invoice_status: "Status",
    new_order: "New Order",
    print: "Print",
    save: "Save",
    add: "Add",
    cancel: "Cancel",
    edit: "Edit",
    delete: "Delete",
    price: "Price",
    name: "Name",
    actions: "Actions",
    status_pending: "Pending",
    status_preparing: "Preparing",
    status_ready: "Ready",
    status_served: "Served",
    status_cancelled: "Cancelled",
    thank_you: "Thank you for your visit — Always at your service",
    orders_page_title: "Orders Tracking",
    order_date: "Date",
    order_type_header: "Type",
    order_table: "Table",
    order_total: "Total",
    order_status: "Status",
    order_payment: "Payment",
    order_actions: "Actions",
    details: "Details",
    notes: "Notes",
    items: "Items",
  },
};
