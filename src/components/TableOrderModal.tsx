import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { menuService } from "@/features/menu/services/menuService";
import { tableOrdersStore, TableCartLine } from "@/shared/services/tableOrdersStore";
import { supabase } from "@/integrations/supabase/client";
import { useSettings, translations } from "@/hooks/use-settings";
import { useToast } from "@/hooks/use-toast";
import { cleanTableId } from "@/shared/utils/inventoryUtils";
import {
  X,
  Search,
  Plus,
  Minus,
  Trash2,
  Send,
  Save,
  UtensilsCrossed,
  CheckCircle2,
  Package,
  ChefHat,
  FileText,
  ShoppingCart,
  ChevronUp,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Table = {
  id: string;
  number: number;
  name: string | null;
  capacity: number;
  status: string;
};

const TAX_RATE = 0.14;

const additionsList = [
  { id: "cheese", label_ar: "جبنة إضافية", label_en: "Extra Cheese", price: 15 },
  { id: "fries", label_ar: "بطاطس مقلية", label_en: "Fries", price: 25 },
  { id: "sauce", label_ar: "صوص حار", label_en: "Spicy Sauce", price: 5 },
  { id: "water", label_ar: "مياه معدنية", label_en: "Mineral Water", price: 10 },
];

const QUICK_ITEM_NOTE_PRESETS = [
  "بدون بصل",
  "بدون ملح",
  "بدون شطة",
  "صوص إضافي",
  "حار جداً 🌶️",
  "مستوي زيادة",
  "سُكر خفيف",
  "سفري",
];

const QUICK_ORDER_NOTE_PRESETS = [
  "طلب مستعجل ⚡",
  "بدون بصل في الطلب",
  "بدون شطة",
  "صوصات خارجية",
  "تقديم المشروبات أولاً",
  "تغليف سفري",
];

export function TableOrderModal({
  table,
  isOpen,
  onClose,
  onOrderSent,
  onChangeTableStatus,
}: {
  table: Table;
  isOpen: boolean;
  onClose: () => void;
  onOrderSent?: () => void;
  onChangeTableStatus?: (status: "available" | "occupied" | "cleaning") => void;
}) {
  const { lang, currency, formatPrice, exchangeRates } = useSettings();
  const { toast } = useToast();
  const t = translations[lang];

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [cart, setCart] = useState<TableCartLine[]>([]);
  const [orderNotes, setOrderNotes] = useState("");
  const [selectedAdditions, setSelectedAdditions] = useState<string[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isQuickNoteBarOpen, setIsQuickNoteBarOpen] = useState(false);
  const [noteEditingItem, setNoteEditingItem] = useState<{
    id: string;
    name: string;
    notes: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen && table) {
      setIsCartOpen(false);
      const existing = tableOrdersStore.getOrderByTableId(table.id, table.number);
      if (existing) {
        const normalizedLines: TableCartLine[] = (existing.items || []).map((raw: any) => {
          const itemObj = raw?.item || {
            id: raw?.id || raw?.menu_item_id || `item-${Math.random()}`,
            name_ar: raw?.name_ar || raw?.name || "صنف",
            price: Number(raw?.price ?? 0),
            category_id: raw?.category_id || "all",
            image_url: raw?.image_url || null,
            requires_oven: Boolean(raw?.requires_oven ?? raw?.item?.requires_oven),
          };
          return {
            item: itemObj,
            quantity: Number(raw?.quantity ?? 1),
            notes: raw?.notes || raw?.note || "",
            selectedAdditions: raw?.selectedAdditions || [],
          };
        });
        setCart(normalizedLines);
        const cleanedNotes = String(existing.notes || "")
          .replace(/\[SELF_ORDER_PENDING_CAPTAIN\]/g, "")
          .replace(/\[SELF_ORDER_ACTIVE\]/g, "")
          .replace(/\[SENT_TO_KITCHEN\]/g, "")
          .replace(/\[SENT_TO_CASHIER\]/g, "")
          .replace(/\[CASHIER_PAID\]/g, "")
          .replace(/\[CANCELLED_BY_CAPTAIN\]/g, "")
          .replace(/\[KITCHEN_START:[^\]]+\]/g, "")
          .replace(/\[طاولة:\s*[^\]]+\]/g, "")
          .replace(/\[المكان:\s*[^\]]+\]/g, "")
          .trim();
        setOrderNotes(cleanedNotes);
        setIsQuickNoteBarOpen(Boolean(cleanedNotes));
        setSelectedAdditions(existing.selectedAdditions || []);
      } else {
        setCart([]);
        setOrderNotes("");
        setIsQuickNoteBarOpen(false);
        setSelectedAdditions([]);
      }
    }
  }, [isOpen, table]);

  const categoriesQuery = useQuery({
    queryKey: ["menu_categories"],
    queryFn: () => menuService.getCategories(),
    enabled: isOpen,
  });

  const itemsQuery = useQuery({
    queryKey: ["menu_items"],
    queryFn: () => menuService.getMenuItems(true),
    enabled: isOpen,
  });

  const filteredItems = useMemo(() => {
    const items = itemsQuery.data ?? [];
    return items.filter((i) => {
      const matchCat = activeCategory === "all" || i.category_id === activeCategory;
      const matchSearch = !search.trim() || i.name_ar.includes(search.trim());
      return matchCat && matchSearch;
    });
  }, [itemsQuery.data, activeCategory, search]);

  const addToCart = (item: any) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === item.id);
      if (existing) {
        return prev.map((c) => (c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.item.id === id) {
            const newQty = c.quantity + delta;
            return newQty > 0 ? { ...c, quantity: newQty } : null;
          }
          return c;
        })
        .filter((c): c is TableCartLine => c !== null),
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((c) => c.item.id !== id));
  };

  const updateItemNotes = (id: string, notes: string) => {
    setCart((prev) => prev.map((c) => (c.item.id === id ? { ...c, notes } : c)));
  };

  const toggleAddition = (id: string) => {
    setSelectedAdditions((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  };

  const appendOrderPresetNote = (preset: string) => {
    setOrderNotes((prev) => {
      const trimmed = prev.trim();
      if (trimmed.includes(preset)) return trimmed;
      return trimmed ? `${trimmed}، ${preset}` : preset;
    });
  };

  const additionsTotal = selectedAdditions.reduce((acc, addId) => {
    const add = additionsList.find((a) => a.id === addId);
    return acc + (add ? add.price : 0);
  }, 0);

  const subTotal =
    cart.reduce(
      (acc, c) =>
        acc +
        (Number(c.item.price || 0) +
          (c.selectedAdditions?.reduce((s, a) => s + Number(a.price || 0), 0) || 0)) *
          c.quantity,
      0,
    ) + additionsTotal;
  const tax = subTotal * TAX_RATE;
  const total = subTotal + tax;
  const itemCount = cart.reduce((a, c) => a + c.quantity, 0);

  const handleCancelOrder = async () => {
    const existingOrder = tableOrdersStore.getOrderByTableId(table.id, table.number);
    await tableOrdersStore.cancelTableOrder({
      orderId: existingOrder?.id,
      kitchenOrderId: existingOrder?.kitchenOrderId,
      tableId: table.id,
      tableNumber: table.number,
    });
    setCart([]);
    setOrderNotes("");
    setSelectedAdditions([]);
    onChangeTableStatus?.("available");
    toast({
      title: lang === "ar" ? "تم إلغاء ومسح الطلب" : "Order Cancelled",
      description:
        lang === "ar"
          ? `تم مسح طلب طاولة #${table.number} وإلغاؤه نهائياً.`
          : `Order for table #${table.number} has been cancelled and cleared.`,
    });
    onOrderSent?.();
    onClose();
  };

  const handleSaveDraft = () => {
    const existingOrder = tableOrdersStore.getOrderByTableId(table.id, table.number);

    tableOrdersStore.saveOrder({
      id: existingOrder?.id,
      kitchenOrderId: existingOrder?.kitchenOrderId,
      table_id: table.id,
      table_number: table.number,
      table_name: table.name,
      items: cart,
      order_type: "dine_in",
      notes: orderNotes,
      selectedAdditions,
      subtotal: Number(subTotal.toFixed(2)),
      tax: Number(tax.toFixed(2)),
      total: Number(total.toFixed(2)),
      status: existingOrder?.status === "sent_to_cashier" ? "sent_to_cashier" : "draft",
      sentToKitchen: cart.length > 0 ? Boolean(existingOrder?.sentToKitchen) : false,
      kitchenCompleted: cart.length > 0 ? Boolean(existingOrder?.kitchenCompleted) : false,
      sentToCashier: cart.length > 0 ? Boolean(existingOrder?.sentToCashier) : false,
      is_self_order: Boolean(existingOrder?.is_self_order),
    });

    if (cart.length > 0 || orderNotes.trim() || selectedAdditions.length > 0) {
      onChangeTableStatus?.("occupied");
    }

    toast({
      title: lang === "ar" ? "تم حفظ المسودة 💾" : "Draft Saved",
      description:
        lang === "ar"
          ? `تم حفظ مسودة طاولة #${table.number} بنجاح`
          : `Draft for table #${table.number} saved`,
    });

    onClose();
  };

  const handleSendToKitchen = async () => {
    if (cart.length === 0) {
      toast({
        title: lang === "ar" ? "السلة فارغة" : "Cart Empty",
        description:
          lang === "ar"
            ? "برجاء اختيار صنف واحد على الأقل قبل الإرسال للمطبخ"
            : "Please select at least one item before sending to kitchen",
        variant: "destructive",
      });
      return;
    }

    const rate = (exchangeRates && exchangeRates[currency]) || 1;
    const finalSubtotal = currency === "EGP" ? subTotal : subTotal / rate;
    const finalTax = currency === "EGP" ? tax : tax / rate;
    const finalTotal = currency === "EGP" ? total : total / rate;

    const existingOrder = tableOrdersStore.getOrderByTableId(table.id, table.number);
    const uuidRegex =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    const existingDbOrderId =
      existingOrder?.kitchenOrderId ||
      (existingOrder?.id && uuidRegex.test(existingOrder.id) ? existingOrder.id : undefined);

    try {
      let kitchenOrderId: string | undefined = existingDbOrderId;
      const kitchenStartTs = existingOrder?.kitchen_started_at || new Date().toISOString();
      const cleanOrderNotes = String(orderNotes || "")
        .replace(/\[SELF_ORDER_PENDING_CAPTAIN\]/g, "")
        .replace(/\[SELF_ORDER_ACTIVE\]/g, "")
        .replace(/\[SENT_TO_KITCHEN\]/g, "")
        .replace(/\[KITCHEN_START:[^\]]+\]/g, "")
        .trim();

      const alreadySentToCashier =
        existingOrder?.status === "sent_to_cashier" || Boolean(existingOrder?.sentToCashier);

      const formattedNotes = [
        existingOrder?.is_self_order ? "[SELF_ORDER_ACTIVE]" : "",
        "[SENT_TO_KITCHEN]",
        `[KITCHEN_START:${kitchenStartTs}]`,
        alreadySentToCashier ? "[SENT_TO_CASHIER]" : "",
        `[طاولة: ${table.number}]`,
        cleanOrderNotes
          ? `${cleanOrderNotes}${currency && currency !== "EGP" ? ` | العملة: ${currency}` : ""}`
          : `طاولة #${table.number}${currency && currency !== "EGP" ? ` | العملة: ${currency}` : ""}`,
      ]
        .filter(Boolean)
        .join(" ");

      const dbItems = cart.map((c) => ({
        id: c.item.id,
        menu_item_id: c.item.id,
        name_ar: c.item.name_ar,
        price: c.item.price,
        quantity: c.quantity,
        notes: c.notes || "",
        selectedAdditions: c.selectedAdditions || [],
        requires_oven: c.item.requires_oven || false,
        item: c.item,
        meta: {
          table_id: table.id,
          table_number: table.number,
          table_name: table.name || `طاولة ${table.number}`,
        },
      }));

      try {
        if (existingDbOrderId) {
          await supabase
            .from("orders")
            .update({
              subtotal: Number(finalSubtotal.toFixed(2)),
              tax: Number(finalTax.toFixed(2)),
              total: Number(finalTotal.toFixed(2)),
              status: "preparing",
              notes: formattedNotes,
              items: dbItems,
            })
            .eq("id", existingDbOrderId);
        } else {
          const { data, error } = await supabase
            .from("orders")
            .insert({
              subtotal: Number(finalSubtotal.toFixed(2)),
              tax: Number(finalTax.toFixed(2)),
              total: Number(finalTotal.toFixed(2)),
              payment_method: "cash",
              order_type: "dine_in",
              table_id: cleanTableId(table.id),
              status: "preparing",
              notes: formattedNotes,
              items: dbItems,
            })
            .select("id, order_number")
            .single();

          if (!error && data) {
            kitchenOrderId = data.id;
          }
        }
      } catch (sbErr) {
        console.warn("Supabase kitchen order sync fallback to local store:", sbErr);
      }

      tableOrdersStore.saveOrder({
        id: existingOrder?.id || kitchenOrderId,
        table_id: table.id,
        table_number: table.number,
        table_name: table.name,
        items: cart,
        order_type: "dine_in",
        notes: formattedNotes,
        selectedAdditions,
        subtotal: Number(subTotal.toFixed(2)),
        tax: Number(tax.toFixed(2)),
        total: Number(total.toFixed(2)),
        status: alreadySentToCashier ? "sent_to_cashier" : "draft",
        sentToKitchen: true,
        kitchenCompleted: false,
        sentToCashier: alreadySentToCashier,
        kitchenOrderId,
        kitchen_started_at: kitchenStartTs,
        is_self_order: Boolean(existingOrder?.is_self_order),
      });

      onChangeTableStatus?.("occupied");

      toast({
        title: lang === "ar" ? "تم الإرسال إلى المطبخ والفرن 👨‍🍳" : "Sent to Kitchen 👨‍🍳",
        description:
          lang === "ar"
            ? `تم إرسال طلب طاولة #${table.number} للمطبخ وبدأ المؤقت على مربع الطاولة وفي شاشة الفرن.`
            : `Table #${table.number} order sent to kitchen.`,
      });

      onOrderSent?.();
      onClose();
    } catch (e: any) {
      console.error("Failed to send order to kitchen:", e);
      toast({
        variant: "destructive",
        title: lang === "ar" ? "خطأ في إرسال الطلب" : "Send Error",
        description:
          e.message ||
          (lang === "ar" ? "تعذر إرسال الطلب للمطبخ" : "Failed to send order to kitchen"),
      });
    }
  };

  const handleSendToCashier = async () => {
    if (cart.length === 0) {
      toast({
        title: lang === "ar" ? "السلة فارغة" : "Cart Empty",
        description:
          lang === "ar"
            ? "برجاء اختيار صنف واحد على الأقل قبل الإرسال"
            : "Please select at least one item before sending",
        variant: "destructive",
      });
      return;
    }

    const existingOrder = tableOrdersStore.getOrderByTableId(table.id, table.number);
    const uuidRegex =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    const existingDbOrderId =
      existingOrder?.kitchenOrderId ||
      (existingOrder?.id && uuidRegex.test(existingOrder.id) ? existingOrder.id : undefined);

    const cleanOrderNotes = String(orderNotes || "")
      .replace(/\[SELF_ORDER_PENDING_CAPTAIN\]/g, "")
      .replace(/\[SELF_ORDER_ACTIVE\]/g, "")
      .replace(/\[SENT_TO_CASHIER\]/g, "")
      .trim();

    const updatedNotes = [
      existingOrder?.is_self_order ? "[SELF_ORDER_ACTIVE]" : "",
      existingOrder?.sentToKitchen ? "[SENT_TO_KITCHEN]" : "",
      "[SENT_TO_CASHIER]",
      `[طاولة: ${table.number}]`,
      cleanOrderNotes,
    ]
      .filter(Boolean)
      .join(" ");

    if (existingDbOrderId) {
      try {
        await supabase
          .from("orders")
          .update({
            notes: updatedNotes,
            subtotal: Number(subTotal.toFixed(2)),
            tax: Number(tax.toFixed(2)),
            total: Number(total.toFixed(2)),
          })
          .eq("id", existingDbOrderId);
      } catch (e) {
        console.warn("Supabase cashier order update warning:", e);
      }
    }

    tableOrdersStore.saveOrder({
      id: existingOrder?.id,
      table_id: table.id,
      table_number: table.number,
      table_name: table.name,
      items: cart,
      order_type: "dine_in",
      notes: updatedNotes,
      selectedAdditions,
      subtotal: Number(subTotal.toFixed(2)),
      tax: Number(tax.toFixed(2)),
      total: Number(total.toFixed(2)),
      status: "sent_to_cashier",
      sentToKitchen: existingOrder?.sentToKitchen || false,
      kitchenCompleted: existingOrder?.kitchenCompleted || false,
      sentToCashier: true,
      kitchenOrderId: existingOrder?.kitchenOrderId || existingDbOrderId,
      is_self_order: Boolean(existingOrder?.is_self_order),
    });

    onChangeTableStatus?.("occupied");

    toast({
      title: lang === "ar" ? "تم الإرسال للكاشير 🚀" : "Sent to Cashier 🚀",
      description:
        lang === "ar"
          ? `تم إرسال طلب طاولة #${table.number} إلى الكاشير، وعند إتمام الدفع سيمسح الطلب وتتحول الطاولة للتنظيف تلقائياً.`
          : `Table #${table.number} order sent to Cashier.`,
    });

    onOrderSent?.();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-3 md:p-5 animate-in fade-in duration-150">
      <div
        className="bg-slate-50 text-slate-900 w-full max-w-6xl h-[100dvh] sm:h-[92vh] rounded-none sm:rounded-3xl border-0 sm:border border-slate-200 shadow-2xl flex flex-col overflow-hidden relative"
        dir={lang === "ar" ? "rtl" : "ltr"}
        style={{ fontFamily: '"Tajawal", "Cairo", system-ui, sans-serif' }}
      >
        {/* 1. Compact Mobile-First Header */}
        <header className="px-3 sm:px-5 py-2.5 bg-slate-900 text-white flex items-center justify-between gap-2 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm sm:text-base shadow shrink-0">
              #{table.number}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm sm:text-base font-black tracking-tight truncate">
                  {lang === "ar" ? `طاولة #${table.number}` : `Table #${table.number}`}
                </h2>
                {table.name && (
                  <span className="text-[11px] text-slate-400 truncate hidden xs:inline">
                    ({table.name})
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                {lang === "ar"
                  ? "اضغط على الأصناف للإضافة السريعة أو افتح السلة للاعتماد"
                  : "Tap items to add quickly or open cart to submit"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {onChangeTableStatus && (
              <div className="flex items-center gap-0.5 bg-slate-800 p-0.5 sm:p-1 rounded-xl border border-slate-700">
                {(
                  [
                    { key: "available", label: "متاح", cls: "bg-emerald-600 text-white" },
                    { key: "occupied", label: "مشغول", cls: "bg-rose-600 text-white" },
                    { key: "cleaning", label: "تنظيف", cls: "bg-sky-600 text-white" },
                  ] as const
                ).map((st) => (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => onChangeTableStatus(st.key)}
                    className={`px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                      table.status === st.key
                        ? st.cls
                        : "text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="relative h-9 px-2.5 sm:px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 text-xs font-black transition cursor-pointer shadow"
              title={lang === "ar" ? "فتح سلة الطلب" : "Open Cart"}
            >
              <ShoppingCart size={15} />
              <span className="hidden md:inline">{lang === "ar" ? "السلة" : "Cart"}</span>
              <span className="min-w-5 h-5 px-1 rounded-full bg-amber-400 text-slate-950 text-[11px] font-black flex items-center justify-center tabular-nums">
                {itemCount}
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition cursor-pointer shrink-0"
              aria-label="إغلاق"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* 2. Search + Categories + Quick Order Notes Toggle Bar */}
        <div className="bg-white border-b border-slate-200 px-3 sm:px-5 py-2.5 space-y-2 shrink-0 shadow-2xs">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                className={`absolute ${lang === "ar" ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 text-slate-400`}
                size={16}
              />
              <input
                type="text"
                placeholder={
                  lang === "ar" ? "ابحث عن صنف بسرعة..." : "Quick search menu item..."
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`w-full h-10 bg-slate-100 border border-slate-200 rounded-xl ${
                  lang === "ar" ? "pr-9 pl-8" : "pl-9 pr-8"
                } text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition`}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className={`absolute ${lang === "ar" ? "left-2.5" : "right-2.5"} top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1`}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsQuickNoteBarOpen((v) => !v)}
              className={`h-10 px-3 rounded-xl border text-xs font-black flex items-center gap-1.5 shrink-0 transition cursor-pointer ${
                orderNotes.trim() || selectedAdditions.length > 0 || isQuickNoteBarOpen
                  ? "bg-amber-50 border-amber-300 text-amber-900"
                  : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <FileText size={15} className="text-amber-600 shrink-0" />
              <span>{lang === "ar" ? "ملاحظات الطلب" : "Order Notes"}</span>
              {(orderNotes.trim() || selectedAdditions.length > 0) && (
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              )}
            </button>
          </div>

          {/* Collapsible Quick Order Note & Additions Box right above the Menu */}
          {isQuickNoteBarOpen && (
            <div className="p-2.5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                  <FileText size={14} className="text-amber-600" />
                  {lang === "ar"
                    ? "ملاحظات عامة للطلب بالكامل (تظهر للمطبخ والكاشير):"
                    : "General Order Notes:"}
                </span>
                <button
                  type="button"
                  onClick={() => setIsQuickNoteBarOpen(false)}
                  className="text-[11px] font-bold text-amber-800 hover:underline"
                >
                  {lang === "ar" ? "إخفاء" : "Hide"}
                </button>
              </div>

              <textarea
                rows={2}
                placeholder={
                  lang === "ar"
                    ? "اكتب ملاحظات الطاولة أو الطلب هنا (مثال: بدون بصل، طلب مستعجل، صوص إضافي...)"
                    : "Write general table or order notes here..."
                }
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                className="w-full bg-white border border-amber-300 rounded-xl p-2 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              />

              <div className="flex flex-wrap gap-1.5">
                {QUICK_ORDER_NOTE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => appendOrderPresetNote(preset)}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 text-amber-950 border border-amber-200 text-[11px] font-bold transition active:scale-95 cursor-pointer"
                  >
                    + {preset}
                  </button>
                ))}
              </div>

              <div className="pt-1 border-t border-amber-200/70 flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-black text-amber-900 ml-1">
                  {lang === "ar" ? "إضافات سريعة:" : "Additions:"}
                </span>
                {additionsList.map((add) => {
                  const selected = selectedAdditions.includes(add.id);
                  return (
                    <button
                      key={add.id}
                      type="button"
                      onClick={() => toggleAddition(add.id)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                        selected
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                          : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {lang === "ar" ? add.label_ar : add.label_en} (+{add.price})
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Horizontal Category Pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition shrink-0 cursor-pointer ${
                activeCategory === "all"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              {t.all}
            </button>
            {(categoriesQuery.data ?? []).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCategory(c.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition shrink-0 cursor-pointer whitespace-nowrap ${
                  activeCategory === c.id
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                {c.name_ar}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Expansive Full-Width Menu Grid (Takes 100% of available body space) */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 min-h-0">
          {itemsQuery.isLoading ? (
            <div className="py-16 text-center text-slate-400 text-sm font-bold">
              {lang === "ar" ? "جاري تحميل أصناف المنيو..." : "Loading menu items..."}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm font-bold">
              {lang === "ar" ? "لا توجد أصناف مطابقة للبحث" : "No matching items found"}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
              {filteredItems.map((item) => {
                const inCartLine = cart.find((c) => c.item.id === item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className={`group bg-white rounded-2xl border-2 p-2.5 sm:p-3 flex flex-col justify-between cursor-pointer transition-all relative select-none ${
                      inCartLine
                        ? "border-indigo-600 ring-2 ring-indigo-500/15 bg-indigo-50/20 shadow-sm"
                        : "border-slate-200/90 hover:border-indigo-300 hover:shadow-sm"
                    }`}
                  >
                    {/* Top Image / Icon Area */}
                    <div>
                      <div className="relative w-full h-20 sm:h-24 rounded-xl overflow-hidden bg-slate-100 mb-2">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name_ar}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <UtensilsCrossed size={24} />
                          </div>
                        )}

                        {/* Price Badge */}
                        <span className="absolute bottom-1.5 right-1.5 bg-slate-900/90 backdrop-blur-xs text-white text-[11px] font-black px-2 py-0.5 rounded-lg tabular-nums shadow">
                          {formatPrice(item.price)}
                        </span>

                        {/* Oven Indicator */}
                        {item.requires_oven && (
                          <span
                            className="absolute top-1.5 right-1.5 bg-orange-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shadow"
                            title="يتطلب فرن"
                          >
                            <Flame size={10} />
                            فرن
                          </span>
                        )}

                        {/* Quantity Badge */}
                        {inCartLine && (
                          <div className="absolute top-1.5 left-1.5 bg-indigo-600 text-white min-w-6 h-6 px-1.5 rounded-full flex items-center justify-center text-xs font-black shadow-md tabular-nums">
                            {inCartLine.quantity}
                          </div>
                        )}
                      </div>

                      <h4 className="font-black text-xs sm:text-sm text-slate-900 line-clamp-2 leading-snug">
                        {item.name_ar}
                      </h4>

                      {/* Show active item note directly on the menu card if present */}
                      {inCartLine?.notes && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setNoteEditingItem({
                              id: item.id,
                              name: item.name_ar,
                              notes: inCartLine.notes || "",
                            });
                          }}
                          className="mt-1.5 bg-amber-100 border border-amber-300 text-amber-950 rounded-lg px-2 py-1 text-[10px] font-bold truncate flex items-center gap-1"
                        >
                          <FileText size={11} className="text-amber-700 shrink-0" />
                          <span className="truncate">{inCartLine.notes}</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Controls on Card: Either "+ Add" OR Inline Stepper + Quick Item Note Button */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100">
                      {inCartLine ? (
                        <div
                          className="flex items-center justify-between gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-xl p-0.5">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, -1)}
                              className="w-7 h-7 rounded-lg bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-600 flex items-center justify-center shadow-2xs transition cursor-pointer"
                            >
                              <Minus size={13} />
                            </button>
                            <span className="text-xs font-black w-5 text-center tabular-nums">
                              {inCartLine.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, 1)}
                              className="w-7 h-7 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-2xs transition cursor-pointer"
                            >
                              <Plus size={13} />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setNoteEditingItem({
                                id: item.id,
                                name: item.name_ar,
                                notes: inCartLine.notes || "",
                              })
                            }
                            className={`h-8 px-2 rounded-xl border text-[11px] font-black flex items-center gap-1 transition cursor-pointer ${
                              inCartLine.notes
                                ? "bg-amber-500 text-white border-amber-600"
                                : "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200"
                            }`}
                            title={lang === "ar" ? "إضافة ملاحظة لهذا الصنف" : "Add item note"}
                          >
                            <FileText size={12} />
                            <span>{lang === "ar" ? "ملاحظة" : "Note"}</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-xs font-bold text-indigo-600 group-hover:text-indigo-700">
                          <span>{lang === "ar" ? "إضافة للطلب" : "Add to order"}</span>
                          <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center transition">
                            <Plus size={14} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. Sticky Bottom Thumb-Zone Bar (Cart Trigger + Quick Actions) */}
        <footer className="bg-white border-t border-slate-200 px-3 sm:px-5 py-2.5 shrink-0 shadow-[0_-8px_25px_rgba(15,23,42,0.08)]">
          <div className="flex items-center gap-2">
            {/* Primary Button to Open Cart Drawer */}
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="flex-1 h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white px-3.5 sm:px-5 flex items-center justify-between gap-2 shadow-md active:scale-[0.99] transition cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-600 text-white shrink-0">
                  <ShoppingCart size={16} />
                  {itemCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black flex items-center justify-center">
                      {itemCount}
                    </span>
                  )}
                </div>
                <div className="text-right min-w-0">
                  <div className="text-xs sm:text-sm font-black flex items-center gap-1 truncate">
                    <span>
                      {lang === "ar" ? "عرض السلة والاعتماد" : "View Cart & Submit"}
                    </span>
                    <ChevronUp size={15} className="text-slate-400 shrink-0" />
                  </div>
                  <div className="text-[10px] text-slate-300 truncate">
                    {itemCount > 0
                      ? `${itemCount} ${lang === "ar" ? "أصناف في السلة" : "items in cart"}`
                      : lang === "ar"
                        ? "السلة فارغة — اضغط للمراجعة أو الحفظ"
                        : "Cart is empty"}
                  </div>
                </div>
              </div>

              <div className="text-left shrink-0">
                <span className="text-xs sm:text-base font-black text-amber-400 tabular-nums">
                  {formatPrice(total)}
                </span>
              </div>
            </button>

            {/* Direct 1-Tap Save Draft Button (Works even when cart is empty!) */}
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              className="h-12 px-3 sm:px-4 rounded-2xl border-slate-300 hover:bg-slate-100 text-slate-800 font-black text-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
              title={lang === "ar" ? "حفظ المسودة حتى لو السلة فارغة" : "Save Draft"}
            >
              <Save size={16} className="text-indigo-600 shrink-0" />
              <span>{lang === "ar" ? "حفظ مسودة" : "Save Draft"}</span>
            </Button>

            {/* Direct 1-Tap Send to Kitchen when items exist */}
            {cart.length > 0 && (
              <Button
                type="button"
                onClick={handleSendToKitchen}
                className="hidden sm:inline-flex h-12 px-4 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs items-center gap-1.5 shadow shrink-0 cursor-pointer"
              >
                <ChefHat size={16} className="shrink-0" />
                <span>{lang === "ar" ? "إرسال للمطبخ" : "Send Kitchen"}</span>
              </Button>
            )}
          </div>
        </footer>

        {/* 5. Slide-Up / Drawer Cart & Order Submission Sheet (Hidden until clicked!) */}
        {isCartOpen && (
          <div
            className="absolute inset-0 z-40 bg-slate-950/60 backdrop-blur-xs flex flex-col justify-end sm:justify-center sm:items-center animate-in fade-in duration-150"
            onClick={() => setIsCartOpen(false)}
          >
            <div
              className="w-full sm:max-w-2xl bg-white h-[88dvh] sm:h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Mobile grab handle */}
              <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

              {/* Drawer Header */}
              <div className="px-4 sm:px-6 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                    <ShoppingCart size={18} />
                  </div>
                  <div>
                    <h3 className="font-black text-sm sm:text-base text-slate-900">
                      {lang === "ar"
                        ? `سلة طلب طاولة #${table.number}`
                        : `Table #${table.number} Cart`}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-bold">
                      {itemCount} {lang === "ar" ? "أصناف مضافة" : "items added"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {cart.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCart([])}
                      className="text-xs font-bold text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-xl transition cursor-pointer"
                    >
                      {lang === "ar" ? "تفريغ السلة" : "Empty Cart"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsCartOpen(false)}
                    className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-black flex items-center gap-1 transition cursor-pointer"
                  >
                    <span>{lang === "ar" ? "العودة للمنيو" : "Back to Menu"}</span>
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Drawer Scrollable Content: Cart Lines + Additions + General Notes + Totals */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 min-h-0">
                {cart.length === 0 ? (
                  <div className="py-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6 space-y-2">
                    <div className="w-12 h-12 rounded-full bg-slate-100 mx-auto flex items-center justify-center text-slate-400">
                      <Package size={24} />
                    </div>
                    <p className="text-sm font-black text-slate-700">
                      {lang === "ar" ? "السلة فارغة حالياً" : "Cart is currently empty"}
                    </p>
                    <p className="text-xs text-slate-500 font-semibold">
                      {lang === "ar"
                        ? "يمكنك حفظ المسودة كما هي حتى لو السلة فارغة، أو العودة للمنيو لإضافة أصناف."
                        : "You can save draft even if empty, or return to menu to add items."}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsCartOpen(false)}
                      className="mt-2 rounded-xl font-bold text-xs"
                    >
                      {lang === "ar" ? "إضافة أصناف من المنيو" : "Add items from menu"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {cart.map((line) => (
                      <div
                        key={line.item.id}
                        className="p-3 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h5 className="font-black text-xs sm:text-sm text-slate-900">
                              {line.item.name_ar}
                            </h5>
                            <span className="text-xs font-black text-indigo-600 tabular-nums">
                              {formatPrice(
                                (line.item.price +
                                  (line.selectedAdditions?.reduce(
                                    (s, a) => s + (a.price || 0),
                                    0,
                                  ) || 0)) *
                                  line.quantity,
                              )}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-xl p-0.5">
                              <button
                                type="button"
                                onClick={() => updateQuantity(line.item.id, -1)}
                                className="w-8 h-8 rounded-lg bg-white hover:bg-slate-50 flex items-center justify-center text-slate-700 shadow-2xs cursor-pointer"
                              >
                                <Minus size={14} />
                              </button>
                              <span className="text-xs sm:text-sm font-black w-6 text-center tabular-nums">
                                {line.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(line.item.id, 1)}
                                className="w-8 h-8 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center justify-center shadow-2xs cursor-pointer"
                              >
                                <Plus size={14} />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeFromCart(line.item.id)}
                              className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition cursor-pointer"
                              title={lang === "ar" ? "حذف الصنف" : "Remove"}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>

                        {/* Item Note Row inside Cart */}
                        {line.notes ? (
                          <div className="flex items-center justify-between gap-2 bg-amber-50 border border-amber-200 text-amber-950 rounded-xl px-3 py-1.5 text-xs font-bold">
                            <div
                              className="flex-1 min-w-0 cursor-pointer flex items-center gap-1.5"
                              onClick={() =>
                                setNoteEditingItem({
                                  id: line.item.id,
                                  name: line.item.name_ar,
                                  notes: line.notes || "",
                                })
                              }
                            >
                              <FileText size={13} className="text-amber-700 shrink-0" />
                              <span className="text-amber-800 font-black shrink-0">ملاحظة:</span>
                              <span className="truncate">{line.notes}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => updateItemNotes(line.item.id, "")}
                              className="text-amber-700 hover:text-rose-600 p-1 rounded transition shrink-0"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setNoteEditingItem({
                                id: line.item.id,
                                name: line.item.name_ar,
                                notes: "",
                              })
                            }
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-50/80 hover:bg-amber-100 border border-amber-200/80 px-2.5 py-1 rounded-xl transition cursor-pointer"
                          >
                            <FileText size={12} />
                            <span>
                              {lang === "ar"
                                ? "إضافة ملاحظة خاصة لهذا الصنف..."
                                : "Add note for this item..."}
                            </span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick Additions */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                  <label className="text-xs font-black text-slate-800 block">
                    {lang === "ar" ? "إضافات سريعة على الطلب:" : "Quick Additions:"}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {additionsList.map((add) => {
                      const selected = selectedAdditions.includes(add.id);
                      return (
                        <button
                          key={add.id}
                          type="button"
                          onClick={() => toggleAddition(add.id)}
                          className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                            selected
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                              : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <span className="truncate">
                            {lang === "ar" ? add.label_ar : add.label_en}
                          </span>
                          <span className="text-[10px] opacity-85 mr-1 tabular-nums">
                            +{add.price}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* General Order Notes with 1-Tap Presets */}
                <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200 space-y-2">
                  <label className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                    <FileText size={14} className="text-amber-600" />
                    {lang === "ar"
                      ? "ملاحظات وتخصيص الطلب بالكامل:"
                      : "Order Notes & Special Instructions:"}
                  </label>
                  <textarea
                    rows={2}
                    placeholder={
                      lang === "ar"
                        ? "اكتب أي ملاحظات للطاولة أو للمطبخ (مثال: بدون بصل، صوص إضافي، طلب مستعجل...)"
                        : "e.g. No onions, extra sauce, urgent..."
                    }
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    className="w-full bg-white border border-amber-300 rounded-xl p-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500 transition resize-none"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_ORDER_NOTE_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => appendOrderPresetNote(preset)}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 text-amber-950 border border-amber-200 text-[11px] font-bold transition active:scale-95 cursor-pointer"
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Totals Summary */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>{lang === "ar" ? "المجموع الفرعي:" : "Subtotal:"}</span>
                    <span className="font-bold tabular-nums">{formatPrice(subTotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>{lang === "ar" ? "الضريبة (14%):" : "Tax (14%):"}</span>
                    <span className="font-bold tabular-nums">{formatPrice(tax)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-slate-900 pt-1.5 border-t border-slate-200">
                    <span>{lang === "ar" ? "الإجمالي الكلي:" : "Grand Total:"}</span>
                    <span className="text-indigo-600 tabular-nums">{formatPrice(total)}</span>
                  </div>
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-3 sm:p-4 border-t border-slate-200 bg-white space-y-2 shrink-0">
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveDraft}
                    className="w-full font-black text-xs h-11 rounded-xl flex items-center justify-center gap-1.5 border-slate-300 hover:bg-slate-100 text-slate-800 px-2 cursor-pointer"
                  >
                    <Save size={15} className="text-indigo-600 shrink-0" />
                    <span className="truncate">
                      {lang === "ar" ? "حفظ مسودة" : "Save Draft"}
                    </span>
                  </Button>

                  <Button
                    type="button"
                    onClick={handleSendToKitchen}
                    className="w-full font-black text-xs h-11 rounded-xl flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white shadow-md active:scale-95 transition px-2 cursor-pointer"
                  >
                    <ChefHat size={16} className="shrink-0" />
                    <span className="truncate">
                      {lang === "ar" ? "إرسال للمطبخ" : "Send Kitchen"}
                    </span>
                  </Button>

                  <Button
                    type="button"
                    onClick={handleSendToCashier}
                    className="w-full font-black text-xs h-11 rounded-xl flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md active:scale-95 transition px-2 cursor-pointer"
                  >
                    <Send size={15} className="shrink-0" />
                    <span className="truncate">
                      {lang === "ar" ? "إرسال للكاشير" : "Send Cashier"}
                    </span>
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleCancelOrder}
                  className="w-full font-bold text-xs h-10 rounded-xl flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white shadow-2xs cursor-pointer"
                >
                  <Trash2 size={14} className="shrink-0" />
                  <span>
                    {lang === "ar"
                      ? "إلغاء ومسح الطلب من الطاولة"
                      : "Cancel & Clear Table Order"}
                  </span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Item Note Modal for Captain Order */}
      {noteEditingItem && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[99999] font-cairo"
          dir={lang === "ar" ? "rtl" : "ltr"}
        >
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900">
                    {lang === "ar" ? "ملاحظة خاصة بالصنف" : "Item Note"}
                  </h3>
                  <p className="text-xs text-slate-500 font-bold line-clamp-1">
                    {noteEditingItem.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNoteEditingItem(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  {lang === "ar" ? "الملاحظة (بدون بصل، صوص إضافي...):" : "Note description:"}
                </label>
                <textarea
                  rows={3}
                  value={noteEditingItem.notes}
                  onChange={(e) =>
                    setNoteEditingItem((prev) =>
                      prev ? { ...prev, notes: e.target.value } : null,
                    )
                  }
                  placeholder={
                    lang === "ar"
                      ? "اكتب تفاصيل تحضير الصنف المطلوبة..."
                      : "Type specific item prep instructions..."
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none leading-relaxed"
                  autoFocus
                />
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-500 block mb-2">
                  {lang === "ar" ? "خيارات سريعة شائعة:" : "Quick Preset Options:"}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_ITEM_NOTE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setNoteEditingItem((prev) => {
                          if (!prev) return null;
                          const existing = prev.notes.trim();
                          const newNotes = existing ? `${existing}، ${preset}` : preset;
                          return { ...prev, notes: newNotes };
                        });
                      }}
                      className="text-[11px] font-bold bg-slate-100 hover:bg-amber-100 hover:text-amber-900 border border-slate-200 px-2.5 py-1.5 rounded-xl transition active:scale-95 text-slate-700 cursor-pointer"
                    >
                      +{preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                {noteEditingItem.notes ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="gap-1 text-xs font-bold rounded-xl h-9"
                    onClick={() => {
                      updateItemNotes(noteEditingItem.id, "");
                      setNoteEditingItem(null);
                      toast({ title: "تم حذف ملاحظة الصنف" });
                    }}
                  >
                    <Trash2 size={13} />
                    {lang === "ar" ? "حذف الملاحظة" : "Delete Note"}
                  </Button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs font-bold rounded-xl h-9"
                    onClick={() => setNoteEditingItem(null)}
                  >
                    {lang === "ar" ? "إلغاء" : "Cancel"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl h-9 gap-1 shadow-xs"
                    onClick={() => {
                      updateItemNotes(noteEditingItem.id, noteEditingItem.notes);
                      setNoteEditingItem(null);
                      toast({ title: "تم حفظ ملاحظة الصنف بنجاح" });
                    }}
                  >
                    <CheckCircle2 size={14} />
                    {lang === "ar" ? "حفظ الملاحظة" : "Save Note"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
