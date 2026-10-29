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
  Clock,
  Package,
  ChefHat,
  FileText,
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
  const [noteEditingItem, setNoteEditingItem] = useState<{
    id: string;
    name: string;
    notes: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen && table) {
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

  const handleSaveDraft = () => {
    if (cart.length === 0) {
      toast({
        title: lang === "ar" ? "السلة فارغة" : "Cart Empty",
        description:
          lang === "ar" ? "برجاء اختيار صنف واحد على الأقل" : "Please select at least one item",
        variant: "destructive",
      });
      return;
    }

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
      sentToKitchen: Boolean(existingOrder?.sentToKitchen),
      kitchenCompleted: Boolean(existingOrder?.kitchenCompleted),
      sentToCashier: Boolean(existingOrder?.sentToCashier),
      is_self_order: Boolean(existingOrder?.is_self_order),
    });

    onChangeTableStatus?.("occupied");

    toast({
      title: lang === "ar" ? "تم حفظ الطلب على الطاولة" : "Order Saved",
      description:
        lang === "ar"
          ? `تم حفظ طلب طاولة #${table.number} بنجاح`
          : `Order for table #${table.number} saved`,
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
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    const existingDbOrderId =
      existingOrder?.kitchenOrderId ||
      (existingOrder?.id && uuidRegex.test(existingOrder.id) ? existingOrder.id : undefined);

    try {
      let kitchenOrderId: string | undefined = existingDbOrderId;
      const cleanOrderNotes = String(orderNotes || "")
        .replace(/\[SELF_ORDER_PENDING_CAPTAIN\]/g, "")
        .replace(/\[SELF_ORDER_ACTIVE\]/g, "")
        .replace(/\[SENT_TO_KITCHEN\]/g, "")
        .trim();

      const alreadySentToCashier =
        existingOrder?.status === "sent_to_cashier" || Boolean(existingOrder?.sentToCashier);

      const formattedNotes = [
        existingOrder?.is_self_order ? "[SELF_ORDER_ACTIVE]" : "",
        "[SENT_TO_KITCHEN]",
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
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
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

    // Keep table status as "occupied" until Cashier completes payment (after which it automatically switches to "cleaning")
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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div
        className="bg-background text-foreground w-full max-w-6xl h-[92vh] rounded-3xl border border-border shadow-2xl flex flex-col overflow-hidden"
        dir={lang === "ar" ? "rtl" : "ltr"}
        style={{ fontFamily: '"Tajawal", "Cairo", system-ui, sans-serif' }}
      >
        <div className="px-4 sm:px-6 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black shadow">
              #{table.number}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  {lang === "ar"
                    ? `طلب طاولة #${table.number}`
                    : `Table #${table.number} Order`}
                </h2>
                {table.name && <span className="text-xs text-slate-400">({table.name})</span>}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {lang === "ar"
                  ? "أرسل الطلب للمطبخ أو الكاشير، أو تحكم في حالة الطاولة"
                  : "Send order to kitchen or cashier, or change table status"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onChangeTableStatus && (
              <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
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
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
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
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          <div className="flex-1 flex flex-col border-b md:border-b-0 md:border-l border-border bg-slate-50/50 min-w-0 overflow-hidden min-h-0">
            <div className="p-3 bg-white border-b border-border space-y-2 shrink-0">
              <div className="relative">
                <Search
                  className={`absolute ${lang === "ar" ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 text-muted-foreground`}
                  size={15}
                />
                <input
                  type="text"
                  placeholder={lang === "ar" ? "بحث عن صنف..." : "Search menu item..."}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={`w-full bg-slate-100 border border-slate-200 rounded-xl py-1.5 ${
                    lang === "ar" ? "pr-9 pl-3" : "pl-9 pr-3"
                  } text-xs font-bold outline-none focus:border-indigo-500 transition`}
                />
              </div>

              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setActiveCategory("all")}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition shrink-0 ${
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
                    onClick={() => setActiveCategory(c.id)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition shrink-0 ${
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

            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 min-h-0">
              {itemsQuery.isLoading ? (
                <div className="col-span-full py-8 text-center text-slate-400 text-xs font-bold">
                  {lang === "ar" ? "جاري تحميل المنيو..." : "Loading menu..."}
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="col-span-full py-8 text-center text-slate-400 text-xs font-bold">
                  {lang === "ar" ? "لا توجد أصناف مطابقة" : "No matching items found"}
                </div>
              ) : (
                filteredItems.map((item) => {
                  const inCartLine = cart.find((c) => c.item.id === item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => addToCart(item)}
                      className={`group bg-white rounded-2xl border p-2.5 flex flex-col justify-between cursor-pointer hover:shadow-md transition relative ${
                        inCartLine
                          ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {inCartLine && (
                        <div className="absolute top-2 left-2 bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shadow z-10">
                          {inCartLine.quantity}
                        </div>
                      )}

                      <div className="space-y-1.5">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name_ar}
                            className="w-full h-16 object-cover rounded-xl"
                          />
                        ) : (
                          <div className="w-full h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                            <UtensilsCrossed size={18} />
                          </div>
                        )}
                        <h4 className="font-bold text-xs text-slate-800 line-clamp-2 leading-tight">
                          {item.name_ar}
                        </h4>
                      </div>

                      <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs font-black text-indigo-600">
                          {formatPrice(item.price)}
                        </span>
                        <div className="w-5 h-5 rounded-md bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center transition">
                          <Plus size={12} />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="w-full md:w-96 lg:w-[400px] flex flex-col bg-white border-t md:border-t-0 border-border shrink-0 min-h-0 overflow-hidden">
            <div className="p-3 border-b border-border bg-slate-50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <UtensilsCrossed size={16} className="text-indigo-600" />
                <h3 className="font-black text-xs sm:text-sm text-slate-800">
                  {lang === "ar" ? "سلة الطلب للطاولة" : "Table Order Cart"}
                </h3>
              </div>
              <Badge
                variant="outline"
                className="bg-indigo-50 text-indigo-700 border-indigo-200 font-bold text-xs"
              >
                {itemCount} {lang === "ar" ? "أصناف" : "items"}
              </Badge>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
              {cart.length === 0 ? (
                <div className="h-full min-h-[120px] flex flex-col items-center justify-center text-center p-4 text-slate-400 space-y-1.5">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-300">
                    <Package size={20} />
                  </div>
                  <p className="text-xs font-bold">
                    {lang === "ar" ? "السلة فارغة حالياً" : "Cart is currently empty"}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {lang === "ar"
                      ? "اضغط على أي صنف لإضافته إلى الطلب"
                      : "Click any item to add it to the order"}
                  </p>
                </div>
              ) : (
                cart.map((line) => (
                  <div
                    key={line.item.id}
                    className="p-2.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-2xs space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h5 className="font-bold text-xs text-slate-800 line-clamp-1 flex-1">
                        {line.item.name_ar}
                      </h5>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setNoteEditingItem({
                              id: line.item.id,
                              name: line.item.name_ar,
                              notes: line.notes || "",
                            })
                          }
                          className={`p-1 rounded-md transition ${
                            line.notes
                              ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                              : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                          }`}
                          title={lang === "ar" ? "ملاحظة للصنف" : "Item note"}
                        >
                          <FileText size={13} />
                        </button>
                        <button
                          onClick={() => removeFromCart(line.item.id)}
                          className="w-5 h-5 rounded flex items-center justify-center text-rose-500 hover:bg-rose-50 transition"
                          title={lang === "ar" ? "حذف" : "Remove"}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {line.notes ? (
                      <div className="flex items-center justify-between gap-1.5 bg-amber-50 border border-amber-200 text-amber-950 rounded-lg px-2 py-1 text-[10px] font-bold">
                        <div
                          className="flex-1 min-w-0 truncate cursor-pointer hover:underline flex items-center gap-1"
                          onClick={() =>
                            setNoteEditingItem({
                              id: line.item.id,
                              name: line.item.name_ar,
                              notes: line.notes || "",
                            })
                          }
                        >
                          <span className="text-amber-700 font-extrabold shrink-0">ملاحظة:</span>
                          <span className="truncate">{line.notes}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => updateItemNotes(line.item.id, "")}
                          className="text-amber-700 hover:text-rose-600 p-0.5 rounded transition shrink-0"
                          title="حذف الملاحظة"
                        >
                          <X size={11} />
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
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-indigo-600 transition"
                      >
                        <Plus size={10} />
                        <span>{lang === "ar" ? "إضافة ملاحظة..." : "Add note..."}</span>
                      </button>
                    )}

                    {line.selectedAdditions && line.selectedAdditions.length > 0 && (
                      <div className="text-[10px] text-slate-500 font-semibold flex flex-wrap gap-1">
                        {line.selectedAdditions.map((a: any, aIdx: number) => (
                          <span
                            key={aIdx}
                            className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-[9px]"
                          >
                            +{a.icon || ""} {a.name_ar}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <span className="text-[11px] font-black text-indigo-600">
                        {formatPrice(
                          (line.item.price +
                            (line.selectedAdditions?.reduce((s, a) => s + (a.price || 0), 0) ||
                              0)) *
                            line.quantity,
                        )}
                      </span>
                      <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg p-0.5">
                        <button
                          onClick={() => updateQuantity(line.item.id, -1)}
                          className="w-5 h-5 rounded flex items-center justify-center text-slate-600 hover:bg-white"
                        >
                          <Minus size={11} />
                        </button>
                        <span className="text-xs font-black w-4 text-center">{line.quantity}</span>
                        <button
                          onClick={() => updateQuantity(line.item.id, 1)}
                          className="w-5 h-5 rounded flex items-center justify-center text-slate-600 hover:bg-white"
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-border bg-slate-50/50 space-y-2.5 shrink-0">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  {lang === "ar" ? "إضافات سريعة:" : "Quick Additions:"}
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {additionsList.map((add) => {
                    const selected = selectedAdditions.includes(add.id);
                    return (
                      <button
                        key={add.id}
                        onClick={() => toggleAddition(add.id)}
                        className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center justify-between transition ${
                          selected
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <span className="truncate">
                          {lang === "ar" ? add.label_ar : add.label_en}
                        </span>
                        <span className="text-[9px] opacity-80 mr-1">+{add.price}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-0.5">
                  {lang === "ar" ? "ملاحظات وتخصيص الطلب:" : "Order Notes & Requests:"}
                </label>
                <textarea
                  rows={2}
                  placeholder={
                    lang === "ar"
                      ? "مثال: بدون بصل، صوص إضافي..."
                      : "e.g. No onions, extra sauce..."
                  }
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-1.5 text-xs font-semibold outline-none focus:border-indigo-500 transition resize-none"
                />
              </div>

              <div className="space-y-0.5 text-[11px] pt-1.5 border-t border-slate-200/80">
                <div className="flex justify-between text-slate-500">
                  <span>{lang === "ar" ? "المجموع الفرعي:" : "Subtotal:"}</span>
                  <span className="font-bold">{formatPrice(subTotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>{lang === "ar" ? "الضريبة (14%):" : "Tax (14%):"}</span>
                  <span className="font-bold">{formatPrice(tax)}</span>
                </div>
                <div className="flex justify-between text-xs font-black text-slate-900 pt-1 border-t border-slate-200">
                  <span>{lang === "ar" ? "الإجمالي الكلي:" : "Grand Total:"}</span>
                  <span className="text-indigo-600">{formatPrice(total)}</span>
                </div>
              </div>
            </div>

            <div className="p-2.5 sm:p-3 border-t border-border bg-white grid grid-cols-3 gap-1.5 shrink-0">
              <Button
                variant="outline"
                onClick={handleSaveDraft}
                className="w-full font-bold text-[11px] sm:text-xs h-10 rounded-xl flex items-center justify-center gap-1 border-slate-300 hover:bg-slate-100 text-slate-700 px-1.5"
              >
                <Save size={14} className="shrink-0" />
                <span className="truncate">{lang === "ar" ? "حفظ مسودة" : "Save Draft"}</span>
              </Button>

              <Button
                onClick={handleSendToKitchen}
                className="w-full font-bold text-[11px] sm:text-xs h-10 rounded-xl flex items-center justify-center gap-1 bg-amber-600 hover:bg-amber-700 text-white shadow-md active:scale-95 transition px-1.5"
              >
                <ChefHat size={15} className="shrink-0" />
                <span className="truncate">{lang === "ar" ? "إرسال للمطبخ" : "Send Kitchen"}</span>
              </Button>

              <Button
                onClick={handleSendToCashier}
                className="w-full font-bold text-[11px] sm:text-xs h-10 rounded-xl flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md active:scale-95 transition px-1.5"
              >
                <Send size={14} className="shrink-0" />
                <span className="truncate">{lang === "ar" ? "إرسال للكاشير" : "Send Cashier"}</span>
              </Button>
            </div>
          </div>
        </div>
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
                    setNoteEditingItem((prev) => (prev ? { ...prev, notes: e.target.value } : null))
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
                  {[
                    "بدون بصل",
                    "بدون ملح",
                    "بدون شطة",
                    "صوص إضافي",
                    "حار جداً 🌶️",
                    "مستوي زيادة",
                    "سُكر خفيف",
                    "سفري",
                  ].map((preset) => (
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
                      className="text-[11px] font-bold bg-slate-100 hover:bg-amber-100 hover:text-amber-900 border border-slate-200 px-2.5 py-1 rounded-lg transition active:scale-95 text-slate-700"
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
                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl h-9 gap-1 shadow-sm"
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
