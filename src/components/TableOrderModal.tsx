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
  ChefHat,
  FileText,
  ShoppingCart,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChefDishIcon } from "@/components/icons/ChefDishIcon";

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
  const { lang, formatPrice, currency, exchangeRates } = useSettings();
  const { toast } = useToast();
  const t = translations[lang];

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [cart, setCart] = useState<TableCartLine[]>([]);
  const [selectedCardItemId, setSelectedCardItemId] = useState<string | null>(null);
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
      setIsQuickNoteBarOpen(false);
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
        setSelectedAdditions(existing.selectedAdditions || []);
      } else {
        setCart([]);
        setOrderNotes("");
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
              items: dbItems as any,
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
              items: dbItems as any,
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
    <div
      className="fixed inset-0 z-50 bg-background text-foreground flex flex-col overflow-hidden animate-in fade-in duration-150"
      dir={lang === "ar" ? "rtl" : "ltr"}
      style={{ fontFamily: '"Tajawal", "Cairo", system-ui, sans-serif' }}
    >
      {/* 1. Compact Header (No explanatory subtitle, no duplicate cart button) */}
      <header className="px-3 sm:px-6 py-2.5 bg-card border-b border-border flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-primary-foreground font-black text-sm shadow shrink-0"
            style={{ background: "var(--gradient-primary)" }}
          >
            #{table.number}
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-sm sm:text-base font-black tracking-tight truncate">
              {lang === "ar" ? `طاولة #${table.number}` : `Table #${table.number}`}
            </h2>
            {table.name && (
              <span className="text-xs text-muted-foreground font-bold truncate hidden sm:inline">
                ({table.name})
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onChangeTableStatus && (
            <div className="flex items-center gap-0.5 bg-muted p-1 rounded-xl border border-border">
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
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    table.status === st.key
                      ? st.cls
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsQuickNoteBarOpen(true)}
            className={`h-9 px-3 rounded-xl border text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
              orderNotes.trim() || selectedAdditions.length > 0
                ? "bg-amber-50 border-amber-300 text-amber-900"
                : "bg-muted border-border text-foreground hover:bg-muted/80"
            }`}
          >
            <FileText size={14} className="text-amber-600 shrink-0" />
            <span>{lang === "ar" ? "تفاصيل وإتمام الطلب" : "Order Details"}</span>
            {(orderNotes.trim() || selectedAdditions.length > 0) && (
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            )}
          </button>

          <button
            type="button"
            data-testid="captain-pos-cart-button"
            onClick={() => setIsCartOpen(true)}
            className="relative h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white border border-emerald-400/50 text-xs font-black flex items-center gap-2 shadow-sm transition cursor-pointer shrink-0"
            title={lang === "ar" ? "فتح سلة الطلبات" : "Open Cart"}
          >
            <ShoppingCart size={16} className="text-white shrink-0" />
            <span>{lang === "ar" ? "سلة الطلبات" : "Cart"}</span>
            {itemCount > 0 && (
              <span
                data-testid="captain-pos-cart-badge"
                className="bg-rose-600 text-white text-[11px] font-black min-w-[20px] h-[20px] rounded-full flex items-center justify-center px-1 border-2 border-white shadow-xs tabular-nums"
              >
                {itemCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-muted hover:bg-muted/80 flex items-center justify-center text-foreground transition cursor-pointer shrink-0"
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* 2. Search + Categories Bar (Matching Restaurant & Park POS) */}
      <div className="bg-card border-b border-border px-3 sm:px-6 py-2.5 space-y-2 shrink-0">
        <div className="relative">
          <Search
            className={`absolute ${lang === "ar" ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 text-muted-foreground`}
            size={16}
          />
          <input
            type="text"
            placeholder={lang === "ar" ? "ابحث عن صنف..." : "Search item..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full h-9 bg-muted/60 border border-border rounded-xl ${
              lang === "ar" ? "pr-9 pl-8" : "pl-9 pr-8"
            } text-xs sm:text-sm font-bold text-foreground outline-none focus:border-primary focus:bg-card transition`}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className={`absolute ${lang === "ar" ? "left-2.5" : "right-2.5"} top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1`}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition border cursor-pointer ${
              activeCategory === "all"
                ? "bg-primary text-primary-foreground border-primary shadow"
                : "bg-card text-foreground border-border hover:border-primary/40"
            }`}
          >
            {t.all}
          </button>
          {(categoriesQuery.data ?? []).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCategory(c.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition border cursor-pointer ${
                activeCategory === c.id
                  ? "bg-primary text-primary-foreground border-primary shadow"
                  : "bg-card text-foreground border-border hover:border-primary/40"
              }`}
            >
              {c.name_ar}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Menu Grid (Matching Restaurant & Park POS) */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 pb-24 min-h-0">
        {itemsQuery.isLoading ? (
          <div className="py-16 text-center text-muted-foreground text-sm font-bold">
            {lang === "ar" ? "جاري التحميل..." : "Loading..."}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm font-bold">
            {lang === "ar" ? "لا توجد أصناف مطابقة" : "No matching items"}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {filteredItems.map((item) => {
              const inCartLine = cart.find((c) => c.item.id === item.id);
              const isSelectedCard = selectedCardItemId === item.id;
              return (
                <div
                  key={item.id}
                  data-testid={`captain-item-card-${item.id}`}
                  onClick={() => setSelectedCardItemId(item.id)}
                  className={`group bg-card rounded-2xl sm:rounded-3xl overflow-hidden border transition-all flex flex-col justify-between select-none ${
                    lang === "ar" ? "text-right" : "text-left"
                  } ${
                    inCartLine
                      ? "border-primary ring-2 ring-primary/20"
                      : isSelectedCard
                        ? "border-amber-500 ring-2 ring-amber-400/35"
                        : "border-border hover:border-primary/40"
                  }`}
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name_ar}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <ChefDishIcon size={28} />
                      </div>
                    )}
                    <div className="absolute top-2.5 left-2.5 bg-primary text-primary-foreground text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow">
                      {formatPrice(item.price)}
                    </div>
                    {item.requires_oven && (
                      <span className="absolute top-2.5 right-2.5 bg-orange-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shadow">
                        <Flame size={10} />
                        فرن
                      </span>
                    )}
                    {inCartLine && (
                      <div className="absolute bottom-2 left-2 bg-slate-900 text-white min-w-6 h-6 px-1.5 rounded-full flex items-center justify-center gap-1 text-xs font-black shadow">
                        <ChefDishIcon size={13} />
                        {inCartLine.quantity}
                      </div>
                    )}
                  </div>
                  <div className="p-3 flex flex-col gap-2 flex-1 justify-between">
                    <div className="flex items-start justify-between gap-1.5">
                      <h4 className="font-bold text-xs sm:text-sm text-card-foreground line-clamp-2 leading-snug">
                        {item.name_ar}
                      </h4>
                      <span className="shrink-0 rounded-lg bg-primary/10 p-1 text-primary">
                        <ChefDishIcon size={15} />
                      </span>
                    </div>
                    <button
                      type="button"
                      data-testid={`captain-add-button-${item.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCardItemId(item.id);
                        addToCart(item);
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-primary hover:bg-primary/90 active:scale-[0.97] text-primary-foreground font-black text-xs flex items-center justify-center gap-1.5 shadow-sm hover:shadow transition-all cursor-pointer"
                    >
                      <Plus size={16} strokeWidth={3} />
                      <ChefDishIcon size={15} />
                      <span>{t.add_to_order}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Left Slide-Over Cart Drawer (Identical in position, shape, and size to Restaurant POS & Park POS) */}
      {isCartOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex animate-in fade-in"
          onClick={() => setIsCartOpen(false)}
        >
          <div
            dir={lang === "ar" ? "rtl" : "ltr"}
            className="w-full max-w-md bg-card h-full flex flex-col shadow-2xl animate-in slide-in-from-left duration-300 border-r border-border"
            style={{ marginLeft: 0, marginRight: "auto", boxShadow: "var(--shadow-elegant)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-card shrink-0">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-primary-foreground shadow"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  <ShoppingCart size={20} />
                </div>
                <div>
                  <h2 className="font-black text-base leading-none">{t.cart}</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    {itemCount} {lang === "ar" ? "صنف" : "items"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className="text-xs text-destructive hover:underline px-2 py-1 font-bold cursor-pointer"
                  >
                    {lang === "ar" ? "مسح الكل" : "Clear All"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsCartOpen(false)}
                  className="w-9 h-9 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-foreground transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Drawer Items List */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
              {cart.length === 0 ? (
                <div className="text-center py-14 px-4">
                  <div className="w-14 h-14 mx-auto rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
                    <ShoppingCart size={24} />
                  </div>
                  <p className="text-sm text-muted-foreground font-bold">{t.empty_cart}</p>
                </div>
              ) : (
                cart.map((c) => (
                  <div
                    key={c.item.id}
                    className="flex gap-3 p-3 rounded-2xl bg-muted/50 hover:bg-muted transition group"
                  >
                    {c.item.image_url && (
                      <img
                        src={c.item.image_url}
                        alt=""
                        className="w-12 h-12 rounded-xl object-cover shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h5 className="font-bold text-sm line-clamp-1">{c.item.name_ar}</h5>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setNoteEditingItem({
                                id: c.item.id,
                                name: c.item.name_ar,
                                notes: c.notes || "",
                              })
                            }
                            className={`p-1 rounded-md transition cursor-pointer ${
                              c.notes
                                ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                            title={lang === "ar" ? "ملاحظة للصنف" : "Item note"}
                          >
                            <FileText size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFromCart(c.item.id)}
                            className="text-muted-foreground hover:text-destructive transition p-1 cursor-pointer"
                            title={lang === "ar" ? "حذف الصنف" : "Remove item"}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {c.notes && (
                        <div className="mt-1 flex items-center justify-between gap-1.5 bg-amber-50 border border-amber-200 text-amber-950 rounded-lg px-2 py-0.5 text-[11px] font-bold">
                          <span className="truncate">{c.notes}</span>
                          <button
                            type="button"
                            onClick={() => updateItemNotes(c.item.id, "")}
                            className="text-amber-700 hover:text-rose-600 p-0.5 rounded transition shrink-0"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-sm font-black text-primary">
                          {formatPrice(c.item.price * c.quantity)}
                        </span>
                        <div
                          className="flex items-center gap-1.5 bg-card rounded-lg border border-border p-0.5"
                          dir="ltr"
                        >
                          <button
                            type="button"
                            onClick={() => updateQuantity(c.item.id, -1)}
                            className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center transition cursor-pointer"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="text-xs font-bold w-6 text-center">{c.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(c.item.id, 1)}
                            className="w-7 h-7 rounded-md bg-primary text-primary-foreground hover:opacity-90 flex items-center justify-center transition cursor-pointer"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Drawer Footer: Two Captain Options (Send to Kitchen / Send to Cashier) instead of single Place Order */}
            <div className="border-t border-border p-4 space-y-2.5 bg-card mt-auto shrink-0">
              <div className="flex justify-between items-baseline">
                <span className="font-bold text-sm">
                  {lang === "ar" ? "مجموع الطلبات" : t.subtotal}
                </span>
                <span className="text-xl font-black text-primary">{formatPrice(total)}</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsCartOpen(false);
                  setIsQuickNoteBarOpen(true);
                }}
                className="w-full py-2 rounded-xl border border-border bg-muted/60 hover:bg-muted text-foreground font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <FileText size={14} className="text-amber-600" />
                <span>
                  {lang === "ar"
                    ? "صفحة إتمام وتخصيص الطلب (إضافات / ملاحظات / مسودة)"
                    : "Order Completion & Notes"}
                </span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={cart.length === 0}
                  onClick={handleSendToKitchen}
                  className="py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs sm:text-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99] transition shadow flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ChefHat size={16} />
                  <span>{lang === "ar" ? "إرسال للمطبخ" : "Send Kitchen"}</span>
                </button>
                <button
                  type="button"
                  disabled={cart.length === 0}
                  onClick={handleSendToCashier}
                  className="py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99] transition shadow flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Send size={15} />
                  <span>{lang === "ar" ? "إرسال للكاشير" : "Send Cashier"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Compact Single-Screen Captain Order Completion Modal (صفحة إتمام الطلب في صفحة الكابتن أوردر) */}
      {isQuickNoteBarOpen && (
        <div
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in"
          onClick={() => setIsQuickNoteBarOpen(false)}
        >
          <div
            dir={lang === "ar" ? "rtl" : "ltr"}
            className="bg-card text-foreground rounded-3xl w-full max-w-3xl p-4 sm:p-5 shadow-2xl border border-border space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-border">
              <h3 className="text-base font-black flex items-center gap-2">
                <UtensilsCrossed size={18} className="text-primary" />
                <span>
                  {lang === "ar"
                    ? `إتمام وتفاصيل طلب طاولة #${table.number}`
                    : `Complete Table #${table.number} Order`}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setIsQuickNoteBarOpen(false)}
                className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-foreground cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-start">
              {/* Right Column: Additions & General Order Notes */}
              <div className="md:col-span-7 space-y-3">
                <div className="bg-muted/40 p-3 rounded-2xl border border-border space-y-2">
                  <label className="text-xs font-black text-foreground block">
                    {lang === "ar" ? "الإضافات" : "Additions"}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {additionsList.map((add) => {
                      const selected = selectedAdditions.includes(add.id);
                      return (
                        <button
                          key={add.id}
                          type="button"
                          onClick={() => toggleAddition(add.id)}
                          className={`px-2.5 py-2 rounded-xl border text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                            selected
                              ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                              : "bg-card text-foreground border-border hover:border-primary/40"
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

                <div className="bg-amber-50/60 p-3 rounded-2xl border border-amber-200 space-y-2">
                  <label className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                    <FileText size={14} className="text-amber-600" />
                    {lang === "ar" ? "ملاحظات الطلب" : "Order Notes"}
                  </label>
                  <textarea
                    rows={2}
                    placeholder={lang === "ar" ? "ملاحظات الطاولة أو المطبخ..." : "Order notes..."}
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    className="w-full bg-white border border-amber-300 rounded-xl p-2 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                  />
                  <div className="flex flex-wrap gap-1">
                    {QUICK_ORDER_NOTE_PRESETS.filter((preset) => {
                      const raw = String(orderNotes || "").trim();
                      const tokens = raw
                        .split(/[،,\n]+/)
                        .map((s) => s.trim())
                        .filter(Boolean);
                      return !tokens.includes(preset) && !raw.includes(preset);
                    }).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => appendOrderPresetNote(preset)}
                        className="px-2 py-0.5 rounded-lg bg-white hover:bg-amber-100 text-amber-950 border border-amber-200 text-[11px] font-bold transition cursor-pointer"
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Left Column: Totals & Actions */}
              <div className="md:col-span-5 space-y-3">
                <div className="bg-muted/40 p-3 rounded-2xl border border-border space-y-1.5 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>{lang === "ar" ? "عدد الأصناف" : "Items"}</span>
                    <span className="font-bold text-foreground tabular-nums">{itemCount}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{lang === "ar" ? "المجموع الفرعي" : "Subtotal"}</span>
                    <span className="font-bold text-foreground tabular-nums">
                      {formatPrice(subTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{lang === "ar" ? "الضريبة (14%)" : "Tax (14%)"}</span>
                    <span className="font-bold text-foreground tabular-nums">
                      {formatPrice(tax)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-foreground pt-1.5 border-t border-border">
                    <span>{lang === "ar" ? "الإجمالي الكلي" : "Grand Total"}</span>
                    <span className="text-primary text-base tabular-nums">
                      {formatPrice(total)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    onClick={handleSendToKitchen}
                    className="h-10 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs gap-1.5 shadow cursor-pointer"
                  >
                    <ChefHat size={15} />
                    <span>{lang === "ar" ? "إرسال للمطبخ" : "Send Kitchen"}</span>
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSendToCashier}
                    className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs gap-1.5 shadow cursor-pointer"
                  >
                    <Send size={14} />
                    <span>{lang === "ar" ? "إرسال للكاشير" : "Send Cashier"}</span>
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveDraft}
                    className="h-9 rounded-xl font-bold text-xs gap-1.5 cursor-pointer"
                  >
                    <Save size={14} className="text-indigo-600" />
                    <span>{lang === "ar" ? "حفظ مسودة" : "Save Draft"}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleCancelOrder}
                    className="h-9 rounded-xl font-bold text-xs gap-1.5 cursor-pointer"
                  >
                    <Trash2 size={14} />
                    <span>{lang === "ar" ? "إلغاء الطلب" : "Cancel Order"}</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Item Note Modal for Captain Order */}
      {noteEditingItem && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[99999] font-cairo"
          dir={lang === "ar" ? "rtl" : "ltr"}
        >
          <div className="bg-white rounded-3xl p-4 sm:p-5 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                  <FileText size={16} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">
                    {lang === "ar" ? "ملاحظة الصنف" : "Item Note"}
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
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <textarea
                rows={2}
                value={noteEditingItem.notes}
                onChange={(e) =>
                  setNoteEditingItem((prev) =>
                    prev ? { ...prev, notes: e.target.value } : null,
                  )
                }
                placeholder={lang === "ar" ? "تفاصيل تحضير الصنف..." : "Item prep note..."}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                autoFocus
              />

              {(() => {
                const rawNotes = String(noteEditingItem.notes || "").trim();
                const currentTokens = rawNotes
                  .split(/[،,\n]+/)
                  .map((s) => s.trim())
                  .filter(Boolean);
                const availablePresets = QUICK_ITEM_NOTE_PRESETS.filter(
                  (preset) => !currentTokens.includes(preset) && !rawNotes.includes(preset),
                );
                if (availablePresets.length === 0) return null;
                return (
                  <div className="flex flex-wrap gap-1.5">
                    {availablePresets.map((preset) => (
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
                        className="text-[11px] font-bold bg-slate-100 hover:bg-amber-100 hover:text-amber-900 border border-slate-200 px-2.5 py-1 rounded-xl transition active:scale-95 text-slate-700 cursor-pointer"
                      >
                        +{preset}
                      </button>
                    ))}
                  </div>
                );
              })()}

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                {noteEditingItem.notes ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="gap-1 text-xs font-bold rounded-xl h-8"
                    onClick={() => {
                      updateItemNotes(noteEditingItem.id, "");
                      setNoteEditingItem(null);
                      toast({ title: "تم حذف ملاحظة الصنف" });
                    }}
                  >
                    <Trash2 size={13} />
                    {lang === "ar" ? "حذف" : "Delete"}
                  </Button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs font-bold rounded-xl h-8"
                    onClick={() => setNoteEditingItem(null)}
                  >
                    {lang === "ar" ? "إلغاء" : "Cancel"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl h-8 gap-1 shadow-xs"
                    onClick={() => {
                      updateItemNotes(noteEditingItem.id, noteEditingItem.notes);
                      setNoteEditingItem(null);
                      toast({ title: "تم حفظ ملاحظة الصنف بنجاح" });
                    }}
                  >
                    <CheckCircle2 size={14} />
                    {lang === "ar" ? "حفظ" : "Save"}
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
