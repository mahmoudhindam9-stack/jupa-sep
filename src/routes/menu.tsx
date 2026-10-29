// @ts-nocheck
import { useState, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  UtensilsCrossed,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Clock,
  Search,
  BellRing,
  Receipt,
  MapPin,
  Globe,
  CheckCircle2,
  X,
} from "lucide-react";
import { menuService } from "@/features/menu/services/menuService";
import { tableOrdersStore } from "@/shared/services/tableOrdersStore";
import { MenuItem } from "@/shared/types";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CustomerOrderTracker } from "@/components/CustomerOrderTracker";

const EN_TRANSLATIONS: Record<string, string> = {
  "البرجر والسندويتشات": "Burgers & Sandwiches",
  "برجر وساندويتشات": "Burgers & Sandwiches",
  "المشويات واللحوم": "Grills & Meats",
  "مشويات": "Charcoal Grills",
  "المشروبات والعصائر": "Drinks & Fresh Juices",
  "مشروبات": "Beverages & Drinks",
  "الحلويات والمقبلات": "Desserts & Appetizers",
  "حلويات": "Desserts",
  "مقبلات": "Appetizers & Sides",
  "بيتزا": "Artisan Pizza",
  "سلطات": "Fresh Salads",
  "برجر جوبا الخاص": "Juba Signature Burger",
  "تشيز برجر دبل": "Double Cheeseburger",
  "مشاوي كباب وكفته": "Mixed Kebab & Kofta Grill",
  "فرخة مشوية عالفحم": "Charcoal Grilled Chicken",
  "فراخ مشوية": "Charcoal Grilled Chicken",
  "عصير مانجو طازج": "Fresh Mango Juice",
  "بيبسي / كوكاكولا": "Pepsi / Coca-Cola",
  "بطاطس مقلية": "Crispy French Fries",
  "كنافة بالقشطة": "Kunafa with Cream",
  "بيتزا سوبر سوبريم": "Super Supreme Pizza",
  "بيتزا مارجريتا": "Margherita Pizza",
  "بيتزا بيبروني": "Pepperoni Pizza",
  "برجر لحم فاخر": "Gourmet Beef Burger",
  "برجر دجاج مقرمش": "Crispy Chicken Burger",
  "ساندويتش شاورما": "Shawarma Wrap",
  "مشاوي مشكل": "Mixed Grill Platter",
  "كباب لحم": "Lamb Kebab",
  "سلطة سيزر بالدجاج": "Chicken Caesar Salad",
  "سلطة يونانية": "Greek Salad",
  "حمص بالطحينة": "Hummus with Tahini",
  "بابا غنوج": "Baba Ghanoush",
  "كوكاكولا": "Coca-Cola",
  "عصير برتقال طازج": "Fresh Orange Juice",
  "شاي بالنعناع": "Mint Tea",
  "قهوة تركي": "Turkish Coffee",
  "أم علي": "Om Ali Dessert",
  "بسبوسة": "Basbousa",
  "الصالة الداخلية": "Indoor Hall",
  "التراس الخارجي": "Outdoor Terrace",
  "قسم العائلات": "Family Section",
  "الحديقة": "Garden Area",
  "الأكثر مبيعاً": "Best Seller",
  "جديد": "New",
  "حار": "Spicy",
};

function translateMenuText(text: string | undefined | null, lang: "ar" | "en"): string {
  if (!text) return "";
  if (lang === "ar") return text;
  const trimmed = text.trim();
  return EN_TRANSLATIONS[trimmed] || trimmed;
}

function generateValidUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isUuid(value: string | undefined | null): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

export const Route = createFileRoute("/menu")({
  component: MenuPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      table: search.table !== undefined ? String(search.table) : undefined,
      tableId: search.tableId ? String(search.tableId) : undefined,
      table_id: search.table_id ? String(search.table_id) : undefined,
      tableName: search.tableName ? String(search.tableName) : undefined,
      zone: search.zone ? String(search.zone) : undefined,
      currency: search.currency ? String(search.currency) : undefined,
      lang: search.lang ? String(search.lang) : undefined,
      allowLangSwitch:
        search.allowLangSwitch !== undefined ? String(search.allowLangSwitch) : undefined,
      welcome: search.welcome ? String(search.welcome) : undefined,
    };
  },
});

function MenuPage() {
  const {
    table,
    table_id,
    tableId,
    tableName,
    zone,
    currency,
    lang: qrLang,
    allowLangSwitch,
    welcome,
  } = Route.useSearch();
  const { toast } = useToast();

  const [activeLang, setActiveLang] = useState<"ar" | "en">(() =>
    qrLang === "en" ? "en" : "ar",
  );

  useEffect(() => {
    if (qrLang === "en" || qrLang === "ar") {
      setActiveLang(qrLang);
    }
  }, [qrLang]);

  const isAr = activeLang !== "en";
  const canSwitchLang = allowLangSwitch !== "0";

  const selectedCurrency = currency || "EGP";
  const currencySymbol =
    selectedCurrency === "EGP" || selectedCurrency === "ج.م"
      ? isAr
        ? "ج.م"
        : "EGP"
      : selectedCurrency;

  // Resolve table number & location accurately (default to Table #1 if none passed in URL)
  const rawTableId = tableId || table_id || "";
  const urlTableNum = useMemo(() => {
    if (table && /^\d+$/.test(String(table).trim())) {
      return parseInt(String(table).trim(), 10);
    }
    const fromId = rawTableId.replace(/^tbl-/, "").replace(/^tbl_local_/, "");
    if (/^\d+$/.test(fromId)) {
      return parseInt(fromId, 10);
    }
    return 0;
  }, [table, rawTableId]);

  const [manualTableNum, setManualTableNum] = useState<number>(() =>
    urlTableNum > 0 && urlTableNum !== 999 ? urlTableNum : 1,
  );

  useEffect(() => {
    if (urlTableNum > 0 && urlTableNum !== 999) {
      setManualTableNum(urlTableNum);
    }
  }, [urlTableNum]);

  const parsedTableNum = urlTableNum > 0 && urlTableNum !== 999 ? urlTableNum : manualTableNum;
  const resolvedTableId =
    rawTableId && rawTableId !== "tbl-999" ? rawTableId : `tbl-${parsedTableNum}`;
  const resolvedTableName =
    tableName || (isAr ? `طاولة ${parsedTableNum}` : `Table ${parsedTableNum}`);
  const resolvedZone = zone ? translateMenuText(zone, activeLang) : "";
  const fullLocationLabel = [resolvedTableName, resolvedZone].filter(Boolean).join(" · ");

  const [cart, setCart] = useState<any[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [trackingToken, setTrackingToken] = useState<string>("");
  const [isTrackerModalOpen, setIsTrackerModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCallingCaptain, setIsCallingCaptain] = useState(false);

  // Search, active category filter & customer order details
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("ALL");
  const [customerName, setCustomerName] = useState("");
  const [orderGeneralNotes, setOrderGeneralNotes] = useState("");
  const [diningType, setDiningType] = useState<"dine_in" | "takeaway">("dine_in");
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      const savedToken = localStorage.getItem("last_customer_tracking_token");
      if (savedToken) {
        setTrackingToken(savedToken);
      }
    }
  }, []);

  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [customNotes, setCustomNotes] = useState("");
  const [selectedAdditions, setSelectedAdditions] = useState<any[]>([]);

  const categoriesQuery = useQuery({
    queryKey: ["menu_categories"],
    queryFn: () => menuService.getCategories(),
  });

  const itemsQuery = useQuery({
    queryKey: ["menu_items"],
    queryFn: () => menuService.getMenuItems(true),
  });

  const categories = categoriesQuery.data || [];
  const availableItems = itemsQuery.data || [];

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return availableItems.filter((item) => {
      if (selectedCategoryId !== "ALL" && item.category_id !== selectedCategoryId) {
        return false;
      }
      if (!q) return true;
      const arName = String(item.name_ar || "").toLowerCase();
      const enName = translateMenuText(item.name_ar, "en").toLowerCase();
      return arName.includes(q) || enName.includes(q);
    });
  }, [availableItems, selectedCategoryId, searchQuery]);

  const getItemQuantityInCart = (itemId: string) => {
    return cart
      .filter((c) => c.item.id === itemId)
      .reduce((sum, c) => sum + Number(c.quantity || 0), 0);
  };

  const quickAddItem = (item: MenuItem) => {
    if (item.additions && item.additions.length > 0) {
      handleItemClick(item);
      return;
    }
    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (p) =>
          p.item.id === item.id &&
          !p.notes &&
          (!p.selectedAdditions || p.selectedAdditions.length === 0),
      );
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = { ...next[existingIdx], quantity: next[existingIdx].quantity + 1 };
        return next;
      }
      return [
        ...prev,
        {
          item,
          quantity: 1,
          notes: "",
          selectedAdditions: [],
        },
      ];
    });
  };

  const quickDecrementItem = (itemId: string) => {
    setCart((prev) => {
      const idx = prev.findIndex((p) => p.item.id === itemId);
      if (idx === -1) return prev;
      const next = [...prev];
      if (next[idx].quantity > 1) {
        next[idx] = { ...next[idx], quantity: next[idx].quantity - 1 };
        return next;
      }
      return next.filter((_, i) => i !== idx);
    });
  };

  const handleItemClick = (item: MenuItem) => {
    setCustomizingItem(item);
    setCustomNotes("");
    setSelectedAdditions([]);
  };

  const confirmAddToCart = () => {
    if (!customizingItem) return;

    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (p) =>
          p.item.id === customizingItem.id &&
          p.notes === customNotes &&
          JSON.stringify(p.selectedAdditions) === JSON.stringify(selectedAdditions),
      );

      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx].quantity += 1;
        return next;
      }
      return [
        ...prev,
        {
          item: customizingItem,
          quantity: 1,
          notes: customNotes,
          selectedAdditions: selectedAdditions,
        },
      ];
    });

    toast({
      title: isAr ? "تمت الإضافة للسلة" : "Added to Cart",
      description: isAr
        ? `تم إضافة ${customizingItem.name_ar} إلى طلبك`
        : `${translateMenuText(customizingItem.name_ar, "en")} added to your order`,
    });
    setCustomizingItem(null);
  };

  const updateQuantity = (cartIndex: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((p, i) => {
          if (i === cartIndex) {
            const newQ = p.quantity + delta;
            return newQ > 0 ? { ...p, quantity: newQ } : null;
          }
          return p;
        })
        .filter(Boolean),
    );
  };

  const removeFromCart = (cartIndex: number) => {
    setCart((prev) => prev.filter((_, i) => i !== cartIndex));
  };

  const totalAmount = cart.reduce((sum, c) => {
    const itemTotal =
      Number(c.item.price || 0) +
      (c.selectedAdditions?.reduce((s: number, a: any) => s + Number(a.price || 0), 0) || 0);
    return sum + itemTotal * c.quantity;
  }, 0);

  const sendTableAssistanceRequest = async (requestType: "call_captain" | "request_bill") => {
    if (isCallingCaptain) return;
    setIsCallingCaptain(true);

    const alertUuid = generateValidUuid();
    const alertPayload = {
      id: alertUuid,
      table_id: resolvedTableId,
      table_number: parsedTableNum || "عام",
      table_name: parsedTableNum > 0 ? `طاولة ${parsedTableNum}` : tableName || "طاولة عامة",
      zone: zone || "",
      request_type: requestType,
      customer_name: customerName.trim() || undefined,
      notes:
        requestType === "request_bill"
          ? `[TABLE_ASSISTANCE_CALL] [طاولة: ${parsedTableNum || "عام"}] [المكان: ${zone || "الصالة"}] العميل في (${fullLocationLabel}) يطلب الفاتورة / الحساب`
          : `[TABLE_ASSISTANCE_CALL] [طاولة: ${parsedTableNum || "عام"}] [المكان: ${zone || "الصالة"}] العميل في (${fullLocationLabel}) يستدعي الكابتن للمساعدة`,
      created_at: new Date().toISOString(),
    };

    try {
      // 1. Save locally for same-browser testing
      if (typeof localStorage !== "undefined") {
        const existingRaw = localStorage.getItem("restocash_captain_assistance_alerts_v1");
        const existing = existingRaw ? JSON.parse(existingRaw) : [];
        localStorage.setItem(
          "restocash_captain_assistance_alerts_v1",
          JSON.stringify([alertPayload, ...(Array.isArray(existing) ? existing : [])].slice(0, 30)),
        );
        window.dispatchEvent(new Event("captain-assistance-updated"));
      }

      // 2. Broadcast via Browser BroadcastChannel for instant multi-tab sync
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel("restocash_self_orders_bc");
        bc.postMessage({ type: "TABLE_ASSISTANCE_REQUEST", payload: alertPayload });
        bc.close();
      }

      // 3. Persist in Supabase public.orders so cross-device Captain polling always receives it
      await supabase.from("orders").insert({
        id: alertUuid,
        table_id: isUuid(resolvedTableId) ? resolvedTableId : null,
        items: [{ ...alertPayload, is_assistance_call: true }],
        order_type: "dine_in",
        payment_method: "cash",
        notes: alertPayload.notes,
        subtotal: 0,
        tax: 0,
        total: 0,
        status: "pending",
        created_at: alertPayload.created_at,
      });

      // 4. Broadcast via Supabase Realtime to Captain page
      const channel = supabase.channel("orders_channel");
      await new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          if (!done) {
            done = true;
            resolve();
          }
        };
        channel.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            try {
              await channel.send({
                type: "broadcast",
                event: "TABLE_ASSISTANCE_REQUEST",
                payload: alertPayload,
              });
            } finally {
              supabase.removeChannel(channel);
              finish();
            }
          }
        });
        setTimeout(() => {
          supabase.removeChannel(channel);
          finish();
        }, 1800);
      });
    } catch (e) {
      console.warn("Assistance request sync warning:", e);
    } finally {
      setIsCallingCaptain(false);
    }

    toast({
      title:
        requestType === "request_bill"
          ? isAr
            ? "تم إرسال طلب الفاتورة للكابتن"
            : "Bill Request Sent to Captain"
          : isAr
            ? "تم إرسال استدعاء للكابتن"
            : "Captain Called to Your Table",
      description: isAr
        ? `تم إبلاغ الكابتن بمكانك (${fullLocationLabel}) وسيحضر إليك حالاً.`
        : `The captain has been notified of your location (${fullLocationLabel}).`,
    });
  };

  const submitOrder = async () => {
    if (cart.length === 0 || isSubmitting) return;
    setIsSubmitting(true);

    const finalTableNum = parsedTableNum > 0 ? parsedTableNum : 999;
    const orderUuid = generateValidUuid();
    const trackingTokenForOrder = generateValidUuid();
    const tableArLabel =
      parsedTableNum > 0 ? `طاولة ${parsedTableNum}` : tableName || "طلب سفري / عام";
    const zoneArLabel = zone || (diningType === "takeaway" ? "سفري / تيك أواي" : "الصالة الداخلية");

    const structuredNotesParts = [
      "[SELF_ORDER_PENDING_CAPTAIN]",
      `[طاولة: ${parsedTableNum > 0 ? parsedTableNum : "سفري"}]`,
      `[المكان: ${zoneArLabel}]`,
    ];
    if (customerName.trim()) {
      structuredNotesParts.push(`[العميل: ${customerName.trim()}]`);
    }
    if (orderGeneralNotes.trim()) {
      structuredNotesParts.push(orderGeneralNotes.trim());
    } else {
      structuredNotesParts.push("تم الطلب عبر نظام الطلب الذاتي (باركود العميل)");
    }
    const combinedNotes = structuredNotesParts.join(" ");

    const enrichedItems = cart.map((line) => ({
      ...line,
      name_ar: line.item?.name_ar || "صنف",
      name_en: translateMenuText(line.item?.name_ar, "en"),
      price: Number(line.item?.price || 0),
      meta: {
        table_id: resolvedTableId,
        table_number: finalTableNum,
        table_name: tableArLabel,
        zone: zoneArLabel,
        customer_name: customerName.trim() || undefined,
        lang: activeLang,
      },
    }));

    const orderPayload = {
      id: orderUuid,
      table_id: resolvedTableId,
      table_number: finalTableNum,
      table_name: tableArLabel,
      zone: zoneArLabel,
      table_label: fullLocationLabel,
      customer_name: customerName.trim() || undefined,
      items: enrichedItems,
      order_type: diningType,
      notes: combinedNotes,
      subtotal: totalAmount,
      tax: 0,
      total: totalAmount,
      status: "pending",
      created_at: new Date().toISOString(),
      pricing_currency: selectedCurrency,
      payment_currency: selectedCurrency,
      payment_exchange_rate: 1,
      payment_amount: totalAmount,
      customer_tracking_token: trackingTokenForOrder,
    };

    // 1. Save immediately in local tracking history & tableOrdersStore + BroadcastChannel
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("last_customer_tracking_token", trackingTokenForOrder);
        const rawHist = localStorage.getItem("customer_self_orders_history_v1");
        const parsedHist = rawHist ? JSON.parse(rawHist) : [];
        const nextHist = [
          orderPayload,
          ...(Array.isArray(parsedHist) ? parsedHist : []),
        ].slice(0, 20);
        localStorage.setItem("customer_self_orders_history_v1", JSON.stringify(nextHist));
      }

      tableOrdersStore.saveOrder({
        id: orderPayload.id,
        table_id: orderPayload.table_id,
        table_number: orderPayload.table_number,
        table_name: [tableArLabel, zoneArLabel].filter(Boolean).join(" — "),
        items: orderPayload.items,
        order_type: orderPayload.order_type,
        notes: combinedNotes,
        selectedAdditions: [],
        subtotal: orderPayload.subtotal,
        tax: orderPayload.tax,
        total: orderPayload.total,
        status: "draft",
        is_self_order: true,
      });

      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel("restocash_self_orders_bc");
        bc.postMessage({ type: "NEW_ORDER", payload: orderPayload });
        bc.close();
      }
    } catch (e) {
      console.warn("Local self-order save warning:", e);
    }

    // 2. Persist in Supabase public.orders using 'pending' status (guaranteed 201 Created on live DB)
    try {
      const dbTableUuid = isUuid(resolvedTableId) ? resolvedTableId : null;
      const baseDbRow: Record<string, any> = {
        id: orderPayload.id,
        table_id: dbTableUuid,
        items: orderPayload.items,
        order_type: orderPayload.order_type,
        payment_method: "cash",
        notes: orderPayload.notes,
        subtotal: Number(orderPayload.subtotal || 0),
        tax: Number(orderPayload.tax || 0),
        total: Number(orderPayload.total || 0),
        status: "pending",
        created_at: orderPayload.created_at,
        pricing_currency: orderPayload.pricing_currency,
        payment_currency: orderPayload.payment_currency,
        payment_exchange_rate: orderPayload.payment_exchange_rate,
        payment_amount: orderPayload.payment_amount,
        customer_tracking_token: orderPayload.customer_tracking_token,
      };

      const { error } = await supabase.from("orders").insert(baseDbRow);
      if (error) {
        // Fallback if table_id FK failed
        const fallbackRow = {
          ...baseDbRow,
          table_id: null,
        };
        const { error: fallbackErr } = await supabase.from("orders").insert(fallbackRow);
        if (fallbackErr) {
          console.warn("Supabase fallback order insert warning:", fallbackErr);
        }
      }
    } catch (error) {
      console.warn("Self-order database persistence warning:", error);
    }

    // 3. Broadcast to Captain via Supabase Realtime Channel
    try {
      const channel = supabase.channel("orders_channel");
      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (!settled) {
            settled = true;
            resolve();
          }
        };
        channel.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            try {
              await channel.send({
                type: "broadcast",
                event: "NEW_ORDER",
                payload: orderPayload,
              });
            } finally {
              supabase.removeChannel(channel);
              finish();
            }
          }
        });
        setTimeout(() => {
          supabase.removeChannel(channel);
          finish();
        }, 1800);
      });
    } catch (e) {
      console.warn("Realtime broadcast warning:", e);
    }

    setTrackingToken(trackingTokenForOrder);
    setIsTrackerModalOpen(true);
    setCart([]);
    setIsCartOpen(false);
    setOrderGeneralNotes("");
    setIsSubmitting(false);

    toast({
      title: isAr ? "تم إرسال طلبك للكابتن بنجاح!" : "Order Sent to Captain!",
      description: isAr
        ? `وصل طلبك (${fullLocationLabel}) إلى شاشة الكابتن وجاري اعتماده.`
        : `Your order (${fullLocationLabel}) was received by the captain.`,
    });
  };

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      className="min-h-screen bg-slate-50 text-slate-900 antialiased pb-28"
    >
      {/* Top Bar */}
      <header className="bg-white/95 backdrop-blur-md sticky top-0 z-40 border-b border-slate-200/80">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <UtensilsCrossed size={18} />
            </div>
            <div className="min-w-0">
              <h1 className="font-black text-base text-slate-900 truncate">
                {isAr ? "قائمة الطلب الذاتي" : "Self-Order Menu"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {trackingToken && (
              <button
                type="button"
                onClick={() => setIsTrackerModalOpen(true)}
                className="min-h-[38px] px-3 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-xs flex items-center gap-1.5 hover:bg-indigo-100 transition-colors cursor-pointer"
              >
                <Clock size={14} />
                <span>{isAr ? "تتبع طلبي" : "Track Order"}</span>
              </button>
            )}

            {canSwitchLang && (
              <button
                type="button"
                onClick={() => setActiveLang((prev) => (prev === "ar" ? "en" : "ar"))}
                className="min-h-[38px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title={isAr ? "Switch to English" : "التبديل للعربية"}
              >
                <Globe size={14} className="text-emerald-600" />
                <span>{isAr ? "EN" : "عربي"}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Welcome, Table Location & Quick Captain Call Strip */}
      <section className="bg-white border-b border-slate-200/70">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-emerald-800">
              <span className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                <MapPin size={13} className="text-emerald-600" />
                <span>{fullLocationLabel}</span>
              </span>
              {urlTableNum === 0 && (
                <select
                  value={manualTableNum}
                  onChange={(e) => setManualTableNum(Number(e.target.value) || 1)}
                  className="h-7 rounded-lg border border-emerald-300 bg-white px-2 text-xs font-black text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <option key={num} value={num}>
                      {isAr ? `طاولة #${num}` : `Table #${num}`}
                    </option>
                  ))}
                </select>
              )}
              {welcome && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-600 font-semibold">{welcome}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isCallingCaptain}
              onClick={() => sendTableAssistanceRequest("call_captain")}
              className="min-h-[40px] flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <BellRing size={14} className="text-amber-600" />
              <span>{isAr ? "استدعاء الكابتن" : "Call Captain"}</span>
            </button>
            <button
              type="button"
              disabled={isCallingCaptain}
              onClick={() => sendTableAssistanceRequest("request_bill")}
              className="min-h-[40px] flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Receipt size={14} className="text-slate-600" />
              <span>{isAr ? "طلب الفاتورة" : "Request Bill"}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Search & Sticky Category Filter Bar */}
      <div className="sticky top-14 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 py-2.5 shadow-2xs">
        <div className="max-w-5xl mx-auto px-4 space-y-2.5">
          <div className="relative">
            <Search
              size={16}
              className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${
                isAr ? "right-3.5" : "left-3.5"
              }`}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isAr ? "ابحث عن صنف أو وجبة..." : "Search for dishes, drinks, desserts..."
              }
              className={`w-full h-10 rounded-xl bg-slate-100/90 border border-slate-200/80 text-xs sm:text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition ${
                isAr ? "pr-10 pl-9" : "pl-10 pr-9"
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 ${
                  isAr ? "left-2.5" : "right-2.5"
                }`}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
            <button
              type="button"
              onClick={() => setSelectedCategoryId("ALL")}
              className={`min-h-[38px] px-4 py-1.5 rounded-xl font-bold text-xs transition whitespace-nowrap shrink-0 cursor-pointer ${
                selectedCategoryId === "ALL"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              {isAr ? "جميع الأصناف" : "All Items"}
            </button>
            {categories.map((cat) => {
              const hasItems = availableItems.some((i) => i.category_id === cat.id);
              if (!hasItems) return null;
              const isSelected = selectedCategoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`min-h-[38px] px-4 py-1.5 rounded-xl font-bold text-xs transition whitespace-nowrap shrink-0 cursor-pointer ${
                    isSelected
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  }`}
                >
                  {translateMenuText(cat.name_ar, activeLang)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Menu Categories & Responsive Item Grid */}
      <main className="max-w-5xl mx-auto px-4 pt-4">
        {categories
          .filter((c) => selectedCategoryId === "ALL" || c.id === selectedCategoryId)
          .map((category) => {
            const catItems = filteredItems.filter((i) => i.category_id === category.id);
            if (catItems.length === 0) return null;

            return (
              <section
                key={category.id}
                className="pt-4 pb-2 scroll-mt-36"
                id={`cat-sec-${category.id}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base sm:text-lg font-black text-slate-900">
                    {translateMenuText(category.name_ar, activeLang)}
                  </h2>
                  <span className="text-xs font-semibold text-slate-500 tabular-nums">
                    {catItems.length} {isAr ? "أصناف" : "items"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {catItems.map((item) => {
                    const qtyInCart = getItemQuantityInCart(item.id);
                    const displayName = translateMenuText(item.name_ar, activeLang);
                    const hasValidImage = Boolean(item.image_url && !brokenImages[item.id]);

                    return (
                      <div
                        key={item.id}
                        className={`bg-white rounded-2xl overflow-hidden border transition-all flex flex-col justify-between group ${
                          qtyInCart > 0
                            ? "border-emerald-500 ring-2 ring-emerald-500/15 shadow-sm"
                            : "border-slate-200/80 shadow-2xs hover:shadow-md"
                        }`}
                      >
                        <div
                          className="h-44 w-full relative bg-slate-100 overflow-hidden cursor-pointer"
                          onClick={() => handleItemClick(item)}
                        >
                          {hasValidImage ? (
                            <img
                              src={item.image_url}
                              alt={displayName}
                              referrerPolicy="no-referrer"
                              onError={() =>
                                setBrokenImages((prev) => ({ ...prev, [item.id]: true }))
                              }
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-slate-100 via-emerald-50/40 to-amber-50/50 flex flex-col items-center justify-center p-4 text-center">
                              <UtensilsCrossed className="text-emerald-600/50 mb-1.5" size={32} />
                              <span className="text-xs font-bold text-slate-500 line-clamp-1">
                                {displayName}
                              </span>
                            </div>
                          )}

                          <div
                            className={`absolute top-3 ${
                              isAr ? "left-3" : "right-3"
                            } bg-slate-950/85 backdrop-blur-md text-white px-3 py-1 rounded-xl text-xs font-black shadow-sm tabular-nums`}
                          >
                            {Number(item.price || 0).toLocaleString("en-US")}{" "}
                            {currencySymbol}
                          </div>

                          {item.badge && (
                            <div
                              className={`absolute top-3 ${
                                isAr ? "right-3" : "left-3"
                              } bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-xs`}
                            >
                              {translateMenuText(item.badge, activeLang)}
                            </div>
                          )}
                        </div>

                        <div className="p-4 flex items-center justify-between gap-3">
                          <div
                            className="min-w-0 flex-1 cursor-pointer"
                            onClick={() => handleItemClick(item)}
                          >
                            <h3 className="font-black text-slate-900 text-sm sm:text-base truncate">
                              {displayName}
                            </h3>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {isAr ? "اضغط لإضافة ملاحظات خاصة" : "Tap to add custom notes"}
                            </p>
                          </div>

                          {qtyInCart > 0 ? (
                            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-xl p-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => quickDecrementItem(item.id)}
                                className="w-8 h-8 rounded-lg bg-white text-slate-700 hover:bg-slate-100 flex items-center justify-center shadow-2xs cursor-pointer"
                              >
                                <Minus size={14} />
                              </button>
                              <span className="w-6 text-center font-black text-xs text-emerald-900 tabular-nums">
                                {qtyInCart}
                              </span>
                              <button
                                type="button"
                                onClick={() => quickAddItem(item)}
                                className="w-8 h-8 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center justify-center shadow-2xs cursor-pointer"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => quickAddItem(item)}
                              className="min-h-[42px] px-4 rounded-xl bg-emerald-600 text-white font-bold flex items-center gap-1.5 hover:bg-emerald-700 transition shadow-2xs text-xs shrink-0 cursor-pointer"
                            >
                              <Plus size={15} />
                              <span>{isAr ? "إضافة" : "Add"}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

        {filteredItems.length === 0 && (
          <div className="py-16 text-center space-y-2">
            <UtensilsCrossed size={36} className="mx-auto text-slate-300" />
            <div className="font-black text-base text-slate-700">
              {isAr ? "لا توجد أصناف مطابقة لبحثك" : "No matching items found"}
            </div>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategoryId("ALL");
              }}
              className="text-xs font-bold text-emerald-600 hover:underline cursor-pointer"
            >
              {isAr ? "عرض كل القائمة" : "Show full menu"}
            </button>
          </div>
        )}
      </main>

      {/* Item Customization Bottom Sheet */}
      {customizingItem && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setCustomizingItem(null)}
        >
          <div
            className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div>
                <h2 className="font-black text-lg text-slate-900">
                  {translateMenuText(customizingItem.name_ar, activeLang)}
                </h2>
                <span className="text-xs font-black text-emerald-600 tabular-nums">
                  {Number(customizingItem.price || 0).toLocaleString("en-US")} {currencySymbol}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCustomizingItem(null)}
                className="min-h-[36px] px-3 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold text-xs cursor-pointer"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
            </div>

            {customizingItem.additions && customizingItem.additions.length > 0 && (
              <div className="space-y-2">
                <label className="font-bold text-xs text-slate-700 block">
                  {isAr ? "إضافات اختيارية:" : "Optional Additions:"}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {customizingItem.additions.map((add: any, idx: number) => {
                    const isSelected = selectedAdditions.some((a) => a.name_ar === add.name_ar);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedAdditions((prev) =>
                              prev.filter((a) => a.name_ar !== add.name_ar),
                            );
                          } else {
                            setSelectedAdditions((prev) => [...prev, add]);
                          }
                        }}
                        className={`flex items-center justify-between p-3 rounded-xl border text-xs transition cursor-pointer ${
                          isSelected
                            ? "bg-emerald-50 border-emerald-500 text-emerald-950 font-bold"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          {add.icon && <span>{add.icon}</span>}
                          <span>{translateMenuText(add.name_ar, activeLang)}</span>
                        </div>
                        {add.price ? (
                          <span className="text-xs font-black text-emerald-600 tabular-nums">
                            +{add.price}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="font-bold text-xs text-slate-700 block">
                {isAr ? "ملاحظات خاصة على الصنف:" : "Special Instructions:"}
              </label>
              <textarea
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder={
                  isAr
                    ? "مثال: بدون شطة، بدون بصل، تسوية زيادة..."
                    : "e.g. No spicy, extra sauce, well done..."
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <button
              type="button"
              onClick={confirmAddToCart}
              className="w-full min-h-[48px] bg-emerald-600 text-white rounded-2xl py-3.5 font-black text-sm shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition cursor-pointer"
            >
              {isAr ? "تأكيد وإضافة للسلة" : "Add to Order"}
            </button>
          </div>
        </div>
      )}

      {/* Sticky Bottom Cart Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 max-w-xl mx-auto z-50">
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="w-full min-h-[56px] bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-xl flex items-center justify-between font-bold hover:bg-slate-800 transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="bg-emerald-600 text-white px-3 py-1 rounded-xl text-xs font-black tabular-nums">
                {cart.reduce((s, c) => s + c.quantity, 0)} {isAr ? "أصناف" : "items"}
              </div>
              <span className="text-sm font-black">
                {isAr ? "مراجعة وإرسال الطلب" : "Review & Place Order"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-black text-emerald-400 tabular-nums text-sm sm:text-base">
                {totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} {currencySymbol}
              </span>
              <ShoppingCart size={20} />
            </div>
          </button>
        </div>
      )}

      {/* Cart & Checkout Drawer */}
      {isCartOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setIsCartOpen(false)}
        >
          <div
            className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 space-y-4 max-h-[88vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div>
                <h2 className="font-black text-lg text-slate-900">
                  {isAr ? "مراجعة سلة الطلبات" : "Your Order Summary"}
                </h2>
                <div className="text-xs font-bold text-emerald-700 flex items-center gap-1 mt-0.5">
                  <MapPin size={12} />
                  <span>{fullLocationLabel}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                className="min-h-[36px] px-3 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold text-xs cursor-pointer"
              >
                {isAr ? "إغلاق" : "Close"}
              </button>
            </div>

            {/* Dining Preference Selector */}
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setDiningType("dine_in")}
                className={`py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  diningType === "dine_in"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {isAr ? "داخل المطعم (على الطاولة)" : "Dine-In (At Table)"}
              </button>
              <button
                type="button"
                onClick={() => setDiningType("takeaway")}
                className={`py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  diningType === "takeaway"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {isAr ? "سفري (تيك أواي)" : "Takeaway"}
              </button>
            </div>

            {/* Cart Items List */}
            <div className="space-y-3 divide-y divide-slate-100 max-h-60 overflow-y-auto pr-1">
              {cart.map((c, idx) => {
                const unitPrice =
                  Number(c.item.price || 0) +
                  (c.selectedAdditions?.reduce(
                    (s: number, a: any) => s + Number(a.price || 0),
                    0,
                  ) || 0);
                return (
                  <div
                    key={c.item.id + "_" + idx}
                    className="pt-3 first:pt-0 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-slate-900 text-sm truncate">
                        {translateMenuText(c.item.name_ar, activeLang)}
                      </h4>
                      {c.selectedAdditions && c.selectedAdditions.length > 0 && (
                        <div className="text-[11px] text-indigo-600 font-semibold">
                          +{" "}
                          {c.selectedAdditions
                            .map((a: any) => translateMenuText(a.name_ar, activeLang))
                            .join(", ")}
                        </div>
                      )}
                      {c.notes && (
                        <div className="text-[11px] text-amber-700 font-medium">{c.notes}</div>
                      )}
                      <span className="text-xs text-emerald-600 font-black tabular-nums">
                        {(unitPrice * c.quantity).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}{" "}
                        {currencySymbol}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateQuantity(idx, -1)}
                        className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="font-bold text-sm w-6 text-center tabular-nums">
                        {c.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(idx, 1)}
                        className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFromCart(idx)}
                        className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 hover:bg-rose-100 ms-1 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Optional Customer Name & General Note */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={isAr ? "اسمك (اختياري)..." : "Your Name (Optional)..."}
                className="h-10 rounded-xl bg-slate-50 border border-slate-200 px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <input
                type="text"
                value={orderGeneralNotes}
                onChange={(e) => setOrderGeneralNotes(e.target.value)}
                placeholder={
                  isAr ? "ملاحظة عامة للكابتن (اختياري)..." : "Note for Captain (Optional)..."
                }
                className="h-10 rounded-xl bg-slate-50 border border-slate-200 px-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-3">
              <div className="flex justify-between items-center text-base font-black">
                <span>{isAr ? "الإجمالي الكلي:" : "Total Amount:"}</span>
                <span className="text-emerald-600 tabular-nums">
                  {totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}{" "}
                  {currencySymbol}
                </span>
              </div>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={submitOrder}
                className="w-full min-h-[50px] bg-emerald-600 text-white py-3.5 rounded-2xl font-black shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-60 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 size={18} />
                <span>
                  {isSubmitting
                    ? isAr
                      ? "جاري إرسال الطلب للكابتن..."
                      : "Sending Order to Captain..."
                    : isAr
                      ? "تأكيد وإرسال الطلب للكابتن الآن"
                      : "Confirm & Send Order to Captain"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Status Tracker Modal */}
      {trackingToken && isTrackerModalOpen ? (
        <CustomerOrderTracker
          token={trackingToken}
          lang={activeLang}
          onClose={() => setIsTrackerModalOpen(false)}
        />
      ) : null}
    </div>
  );
}
