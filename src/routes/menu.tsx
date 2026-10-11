// @ts-nocheck
import { useState, useMemo } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { UtensilsCrossed, ShoppingCart, Plus, Minus, Trash2, Clock } from "lucide-react";
import { menuService } from "@/features/menu/services/menuService";
import { tableOrdersStore } from "@/shared/services/tableOrdersStore";
import { MenuItem } from "@/shared/types";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CustomerOrderTracker } from "@/components/CustomerOrderTracker";

export const Route = createFileRoute("/menu")({
  component: MenuPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      table: search.table as string | undefined,
      tableId: search.tableId as string | undefined,
      table_id: search.table_id as string | undefined,
      currency: search.currency as string | undefined,
    };
  },
});

function MenuPage() {
  const { table, table_id, tableId, currency } = Route.useSearch();
  const navigate = useNavigate();
  const { toast } = useToast();

  const selectedCurrency = currency || "EGP";
  const currencySymbol =
    selectedCurrency === "EGP" || selectedCurrency === "ج.م" ? "ج.م" : selectedCurrency;

  const [cart, setCart] = useState<any[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [trackingToken, setTrackingToken] = useState<string>("");

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
      title: "تم الإضافة",
      description: `تم إضافة ${customizingItem.name_ar} إلى الطلب`,
    });
    setCustomizingItem(null);
  };

  const updateQuantity = (cartIndex: number, delta: number) => {
    setCart((prev) =>
      prev.map((p, i) => {
        if (i === cartIndex) {
          const newQ = p.quantity + delta;
          return newQ > 0 ? { ...p, quantity: newQ } : p;
        }
        return p;
      }),
    );
  };

  const removeFromCart = (cartIndex: number) => {
    setCart((prev) => prev.filter((_, i) => i !== cartIndex));
  };

  const totalAmount = cart.reduce((sum, c) => {
    const itemTotal =
      c.item.price + (c.selectedAdditions?.reduce((s, a) => s + (a.price || 0), 0) || 0);
    return sum + itemTotal * c.quantity;
  }, 0);

  const submitOrder = async () => {
    if (cart.length === 0) return;

    const tableNum = table ? parseInt(table) : 999;
    const resolvedTableId = tableId || table_id || (table ? `tbl-${tableNum}` : "tbl-999");
    const trackingTokenForOrder =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `trk_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const orderPayload = {
      id: "ord_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      table_id: resolvedTableId,
      items: cart,
      order_type: "dine_in",
      notes: "تم الطلب عبر نظام الطلب الذاتي (العميل)",
      subtotal: totalAmount,
      tax: 0,
      total: totalAmount,
      status: "STATUS_PENDING_CAPTAIN",
      created_at: new Date().toISOString(),
      pricing_currency: "EGP",
      payment_currency: "EGP",
      payment_exchange_rate: 1,
      payment_amount: totalAmount,
      customer_tracking_token: trackingTokenForOrder,
    };

    // Persist the same order so Captain, Cashier and Oven share one durable identity.
    try {
      const { error } = await supabase.from("orders").upsert(
        {
          id: orderPayload.id,
          table_id: orderPayload.table_id,
          items: orderPayload.items,
          order_type: orderPayload.order_type,
          notes: orderPayload.notes,
          subtotal: Number(orderPayload.subtotal || 0),
          tax: Number(orderPayload.tax || 0),
          total: Number(orderPayload.total || 0),
          status: "pending_captain",
          created_at: orderPayload.created_at,
          pricing_currency: orderPayload.pricing_currency,
          payment_currency: orderPayload.payment_currency,
          payment_exchange_rate: orderPayload.payment_exchange_rate,
          payment_amount: orderPayload.payment_amount,
          customer_tracking_token: orderPayload.customer_tracking_token,
        },
        { onConflict: "id" },
      );
      if (error) throw error;
    } catch (error) {
      console.warn("Self-order database bridge warning:", error);
    }

    // Broadcast the order to the Captain via Supabase Realtime Channels
    const channel = supabase.channel("orders_channel");
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.send({
          type: "broadcast",
          event: "NEW_ORDER",
          payload: orderPayload,
        });

        supabase.removeChannel(channel);

        if (typeof localStorage !== "undefined") {
          localStorage.setItem(
            "last_customer_tracking_token",
            orderPayload.customer_tracking_token,
          );
        }
        setTrackingToken(orderPayload.customer_tracking_token);
        setCart([]);
        setIsCartOpen(false);
        toast({
          title: "تم إرسال الطلب!",
          description: "تم إرسال طلبك إلى الكابتن بنجاح. سيتم تحضيره قريباً.",
          variant: "default",
        });
      }
    });

    // Fallback if network is bad
    setTimeout(() => {
      if (cart.length > 0) {
        // If cart wasn't cleared, it means we didn't subscribe in time
        supabase.removeChannel(channel);
        toast({
          title: "تأخير في الاتصال",
          description: "جاري محاولة الإرسال...",
        });
        // Still try to clear cart so user doesn't double click forever
        setCart([]);
        setIsCartOpen(false);
      }
    }, 5000);
  };

  return (
    <div className="min-h-screen bg-slate-50 antialiased pb-24">
      {/* Header */}
      <header className="bg-white shadow-xs sticky top-0 z-40 border-b border-slate-100">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="text-emerald-600" />
            <h1 className="font-black text-lg text-slate-800">قائمة الطعام</h1>
          </div>
          {table && (
            <div className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold">
              طاولة {table}
            </div>
          )}
        </div>
      </header>

      {/* Sticky Category Tabs Bar for fast, mobile-friendly navigation */}
      <div className="sticky top-16 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 py-3 shadow-xs overflow-x-auto scrollbar-none">
        <div className="flex px-4 gap-2 min-w-max">
          {categories.map((cat) => {
            const hasItems = availableItems.some((i) => i.category_id === cat.id);
            if (!hasItems) return null;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  const el = document.getElementById(`cat-sec-${cat.id}`);
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }}
                className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition whitespace-nowrap cursor-pointer focus:ring-2 focus:ring-emerald-500"
              >
                {cat.name_ar}
              </button>
            );
          })}
        </div>
      </div>

      {/* Menu Categories */}
      <main className="max-w-md mx-auto">
        {categories.map((category) => {
          const catItems = availableItems.filter((i) => i.category_id === category.id);
          if (catItems.length === 0) return null;

          return (
            <div key={category.id} className="pt-6 scroll-mt-32" id={`cat-sec-${category.id}`}>
              <h2 className="px-4 text-lg font-black text-slate-800 mb-4">{category.name_ar}</h2>
              <div className="space-y-4 px-4">
                {catItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100 flex flex-col relative group"
                  >
                    <div className="h-40 w-full relative bg-slate-100 overflow-hidden">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name_ar}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
                          <UtensilsCrossed className="text-amber-200" size={32} />
                        </div>
                      )}
                      <div className="absolute top-3 left-3 bg-slate-950/90 backdrop-blur-md text-white px-2.5 py-1.5 rounded-lg text-xs font-black shadow-md border border-white/20">
                        {item.price} {currencySymbol}
                      </div>
                      {item.badge && (
                        <div className="absolute top-0 right-0 bg-slate-900/90 backdrop-blur-md text-white text-xs font-black px-3.5 py-1.5 rounded-bl-2xl shadow-md z-10">
                          {item.badge}
                        </div>
                      )}
                    </div>
                    <div className="p-4 flex items-center justify-between gap-2">
                      <h3 className="font-black text-slate-800 text-base">{item.name_ar}</h3>
                      <button
                        onClick={() => handleItemClick(item)}
                        className="h-10 px-4 rounded-2xl bg-emerald-600 text-white font-bold flex items-center gap-1.5 hover:bg-emerald-700 transition shadow-xs text-xs"
                      >
                        <Plus size={16} />
                        <span>إضافة</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </main>

      {customizingItem && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[60] flex items-end justify-center"
          onClick={() => setCustomizingItem(null)}
        >
          <div
            className="bg-white w-full max-w-md rounded-t-3xl p-6 space-y-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="font-black text-lg text-slate-900">{customizingItem.name_ar}</h2>
              <button
                onClick={() => setCustomizingItem(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                إلغاء
              </button>
            </div>

            {customizingItem.additions && customizingItem.additions.length > 0 && (
              <div className="space-y-2">
                <label className="font-bold text-sm text-slate-700">إضافات اختيارية:</label>
                <div className="grid grid-cols-2 gap-2">
                  {customizingItem.additions.map((add, idx) => {
                    const isSelected = selectedAdditions.some((a) => a.name_ar === add.name_ar);
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedAdditions((prev) =>
                              prev.filter((a) => a.name_ar !== add.name_ar),
                            );
                          } else {
                            setSelectedAdditions((prev) => [...prev, add]);
                          }
                        }}
                        className={`flex items-center justify-between p-3 rounded-xl border text-sm transition ${isSelected ? "bg-indigo-50 border-indigo-500 text-indigo-900 font-bold" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                      >
                        <div className="flex items-center gap-1.5">
                          {add.icon && <span>{add.icon}</span>}
                          <span>{add.name_ar}</span>
                        </div>
                        {add.price ? (
                          <span className="text-xs font-black text-emerald-600">+{add.price}</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="font-bold text-sm text-slate-700">ملاحظات إضافية:</label>
              <textarea
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="مثال: بدون شطة، بصل زيادة..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right"
              />
            </div>

            <button
              onClick={confirmAddToCart}
              className="w-full bg-indigo-600 text-white rounded-xl py-3.5 font-black text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition"
            >
              أضف للطلب
            </button>
          </div>
        </div>
      )}

      {/* Floating Cart Button */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto z-50">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-slate-900 text-white p-4 rounded-2xl shadow-xl flex items-center justify-between font-bold hover:bg-slate-800 transition"
          >
            <div className="flex items-center gap-3">
              <div className="bg-emerald-600 text-white px-3 py-1 rounded-xl text-xs font-black">
                {cart.reduce((s, c) => s + c.quantity, 0)} عناصر
              </div>
              <span>عرض السلة</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-black text-emerald-400">
                {totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} {currencySymbol}
              </span>
              <ShoppingCart size={20} />
            </div>
          </button>
        </div>
      )}

      {/* Cart Modal / Drawer */}
      {isCartOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end justify-center"
          onClick={() => setIsCartOpen(false)}
        >
          <div
            className="bg-white w-full max-w-md rounded-t-3xl p-6 space-y-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="font-black text-lg text-slate-900">سلة الطلبات</h2>
              <button
                onClick={() => setIsCartOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                إغلاق
              </button>
            </div>

            <div className="space-y-3 divide-y">
              {cart.map((c, idx) => (
                <div
                  key={c.item.id + "_" + idx}
                  className="pt-3 first:pt-0 flex items-center justify-between gap-3"
                >
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">{c.item.name_ar}</h4>
                    <span className="text-xs text-emerald-600 font-black">
                      {(c.item.price * c.quantity).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}{" "}
                      {currencySymbol}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(idx, -1)}
                      className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="font-bold text-sm w-6 text-center">{c.quantity}</span>
                    <button
                      onClick={() => updateQuantity(idx, 1)}
                      className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      onClick={() => removeFromCart(idx)}
                      className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 hover:bg-rose-100 ms-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t pt-4 space-y-3">
              <div className="flex justify-between items-center text-base font-black">
                <span>الإجمالي الكلي:</span>
                <span className="text-emerald-600">
                  {totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}{" "}
                  {currencySymbol}
                </span>
              </div>
              <button
                onClick={submitOrder}
                className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-emerald-700 transition"
              >
                إرسال الطلب الآن 🚀
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Floating Order Tracking Button (if active tracking token exists) */}
      {trackingToken && (
        <div className="fixed bottom-24 left-4 z-50">
          <button
            onClick={() => {
              const savedToken = localStorage.getItem("last_customer_tracking_token") || "";
              if (savedToken) {
                setTrackingToken(savedToken);
              }
            }}
            className="h-12 w-12 rounded-full bg-indigo-600 text-white shadow-xl flex items-center justify-center hover:bg-indigo-700 transition animate-pulse border border-white/20"
            title="تتبع الطلب الحالي"
          >
            <Clock size={20} />
          </button>
        </div>
      )}

      {trackingToken ? (
        <CustomerOrderTracker token={trackingToken} onClose={() => setTrackingToken("")} />
      ) : null}
    </div>
  );
}
