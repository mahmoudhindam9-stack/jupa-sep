// @ts-nocheck
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { currentUserHasPermission, signOutCurrentUser } from "@/shared/services/userAuthorization";
import { RestocashLogo } from "@/components/RestocashLogo";
import {
  getReceiptDesignSettings,
  saveReceiptDesignSettings,
} from "@/shared/services/receiptSettings";
import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  Banknote,
  CreditCard,
  FileSpreadsheet,
  Loader2,
  Minus,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Smartphone,
  Trash2,
  UtensilsCrossed,
  X,
  Car,
  Package,
  Bell,
  Wallet,
  Sparkles,
  FileText,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { convertToInventoryUnit, cleanTableId } from "@/shared/utils/inventoryUtils";
import { erpStore } from "@/shared/services/erpStore";
import { printerService } from "@/shared/services/printerService";
import * as XLSX from "xlsx";
import { useSettings, translations } from "@/hooks/use-settings";
import { menuService } from "@/features/menu/services/menuService";
import { inventoryService } from "@/features/inventory/services/inventoryService";
import { useToast } from "@/hooks/use-toast";
import { useTableOrders } from "@/shared/hooks/useTableOrders";
import { tableOrdersStore, TableOrder } from "@/shared/services/tableOrdersStore";
import { MenuExportModal } from "@/components/MenuExportModal";
import { BackToRestaurantButton } from "@/components/admin/BackToRestaurantButton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/pos")({
  head: () => ({
    meta: [
      { title: "Restocash — نقطة البيع" },
      {
        name: "description",
        content: "نظام نقطة بيع Restocash لإدارة الأصناف والطلبات والفواتير.",
      },
    ],
  }),
  component: PosAccessGate,
});

type Category = { id: string; name_ar: string; sort_order: number };
type MenuItem = {
  id: string;
  name_ar: string;
  price: number;
  category_id: string;
  image_url: string | null;
  ingredients?: any;
  inventory_tracking?: string;
};
type Table = { id: string; number: number; name: string | null; status: string };
type CartLine = { item: MenuItem; quantity: number; notes?: string; selectedAdditions?: any[] };
type PaymentMethod = "cash" | "card" | "wallet";
type OrderType = "dine_in" | "takeaway" | "delivery";
type CompletedOrder = {
  order_number: number;
  subtotal: number;
  discount?: number;
  service_fee?: number;
  delivery_fee?: number;
  tax: number;
  tax_rate?: number;
  total: number;
  payment_method: PaymentMethod;
  order_type: OrderType;
  table_id: string | null;
  status: string;
  items: { name_ar: string; price: number; quantity: number }[];
  created_at: string;
};

const orderTypeOptions: { key: OrderType; label: string; icon: LucideIcon }[] = [
  { key: "dine_in", label: "داخل المطعم", icon: UtensilsCrossed },
  { key: "takeaway", label: "Takeaway", icon: Package },
  { key: "delivery", label: "توصيل", icon: Car },
];

const additionsList = [
  { id: "cheese", label_ar: "جبنة إضافية", label_en: "Extra Cheese", price: 15 },
  { id: "fries", label_ar: "بطاطس مقلية", label_en: "Fries", price: 25 },
  { id: "sauce", label_ar: "صوص حار", label_en: "Spicy Sauce", price: 5 },
  { id: "water", label_ar: "مياه معدنية", label_en: "Mineral Water", price: 10 },
];

function PosAccessGate() {
  const navigate = useNavigate();
  const [accessState, setAccessState] = useState<"checking" | "allowed" | "denied">("checking");
  useEffect(() => {
    let active = true;
    currentUserHasPermission(["pos", "pos_access"])
      .then((allowed) => { if (active) setAccessState(allowed ? "allowed" : "denied"); })
      .catch((error) => {
        console.error("POS route authorization failed.", error);
        if (active) setAccessState("denied");
      });
    return () => { active = false; };
  }, []);

  if (accessState === "allowed") return <Index />;
  if (accessState === "checking") {
    return <div className="min-h-screen flex items-center justify-center text-sm font-bold text-muted-foreground">جاري التحقق من صلاحيات حسابك…</div>;
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6" dir="rtl">
      <div role="alert" className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm space-y-4">
        <h1 className="text-xl font-black text-foreground">ليس لديك صلاحية نقطة البيع</h1>
        <p className="text-sm text-muted-foreground">يجب تفعيل صلاحية نقطة البيع من صفحة المستخدمين قبل فتح هذه الشاشة.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button className="rounded-lg bg-primary px-4 py-2 text-primary-foreground" onClick={() => navigate({ to: "/admin" })}>العودة إلى لوحة الإدارة</button>
          <button className="rounded-lg border px-4 py-2" onClick={async () => { await signOutCurrentUser(); navigate({ to: "/login" }); }}>تسجيل الخروج</button>
        </div>
      </div>
    </div>
  );
}

function Index() {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ email?: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    const storedUser =
      localStorage.getItem("restocash_auth_user") ||
      sessionStorage.getItem("restocash_auth_user");
    if (storedUser) setUser({ email: storedUser });
    supabase.auth.getSession().then(({ data }) => {
      if (mounted && data.session?.user?.email) setUser({ email: data.session.user.email });
    }).catch((error) => console.error("Could not load active POS identity.", error));
    return () => { mounted = false; };
  }, []);

  const {
    lang,
    currency,
    exchangeRates,
    changeLang,
    changeCurrency,
    updateExchangeRate,
    formatPrice,
  } = useSettings();
  const { toast } = useToast();
  const t = translations[lang];

  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [erpState, setErpState] = useState(erpStore.getState());
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    return erpStore.subscribe(() => {
      setErpState(erpStore.getState());
    });
  }, []);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [isMenuExportOpen, setIsMenuExportOpen] = useState(false);
  const [invoice, setInvoice] = useState<CompletedOrder | null>(null);
  const [payment, setPayment] = useState<PaymentMethod>("cash");

  const initialTreasury =
    erpStore.getState().treasuries.find((t) => t.linked_to_restaurant)?.id || "tr-1";
  const [selectedTreasury, setSelectedTreasury] = useState<string>(initialTreasury);
  const [authNumber, setAuthNumber] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [selectedContainer, setSelectedContainer] = useState<string>("");

  useEffect(() => {
    const treasury = erpStore.getState().treasuries.find((t) => t.id === selectedTreasury);
    if (treasury && treasury.containers) {
      if (payment === "cash" && currency === "SSP") setSelectedContainer("cnt-cash-ssp");
      else if (payment === "wallet" && currency === "SSP") setSelectedContainer("cnt-wallet-ssp");
      else if (payment === "card" && currency === "SSP") setSelectedContainer("cnt-card-ssp");
      else if (payment === "cash" && currency === "USD") setSelectedContainer("cnt-cash-usd");
      else if (payment === "card" && currency === "USD") setSelectedContainer("cnt-card-usd");
      else if (payment === "wallet" && currency === "USD") setSelectedContainer("cnt-wallet-usd");
      else if (payment === "cash" && currency === "EGP") setSelectedContainer("cnt-cash-egp");
      else if (payment === "card" && currency === "EGP") setSelectedContainer("cnt-card-egp");
      else if (payment === "wallet" && currency === "EGP") setSelectedContainer("cnt-wallet-egp");
      else setSelectedContainer("");
    }
  }, [payment, currency, selectedTreasury]);

  const [orderType, setOrderType] = useState<OrderType>("dine_in");
  const { pendingCashierOrders, updateStatus, removeOrder } = useTableOrders();
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [orderNotes, setOrderNotes] = useState("");
  const [selectedAdditions, setSelectedAdditions] = useState<string[]>([]);
  const [noteEditingItem, setNoteEditingItem] = useState<{
    id: string;
    name: string;
    notes: string;
  } | null>(null);
  const [activeTableOrderSentToKitchen, setActiveTableOrderSentToKitchen] =
    useState<boolean>(false);
  const [activeTableKitchenOrderId, setActiveTableKitchenOrderId] = useState<string | null>(null);

  const handleLoadTableOrderToCart = (tableOrder: TableOrder) => {
    setCart(tableOrder.items || []);
    setSelectedTable(tableOrder.table_id || "");
    setOrderType("dine_in");
    setOrderNotes(tableOrder.notes || "");
    setSelectedAdditions(tableOrder.selectedAdditions || []);
    setActiveTableOrderSentToKitchen(!!tableOrder.sentToKitchen);
    setActiveTableKitchenOrderId(tableOrder.kitchenOrderId || null);

    updateStatus(tableOrder.id, "in_checkout");

    toast({
      title: lang === "ar" ? "تم تحويل الطلب إلى السلة 🛒" : "Order Loaded to Cart 🛒",
      description:
        lang === "ar"
          ? tableOrder.sentToKitchen
            ? `تم نقل طلب طاولة #${tableOrder.table_number} للسلة. (الطلب مرسل للمطبخ سابقاً ولن يتكرر بالمطبخ عند الدفع)`
            : `تم نقل تفاصيل طلب طاولة #${tableOrder.table_number} إلى السلة بنجاح. يمكنك استكمال الدفع والتسديد الآن.`
          : `Order for table #${tableOrder.table_number} loaded into cart successfully.`,
    });
  };

  const categoriesQuery = useQuery({
    queryKey: ["menu_categories"],
    queryFn: () => menuService.getCategories(),
  });

  const itemsQuery = useQuery({
    queryKey: ["menu_items"],
    queryFn: () => menuService.getMenuItems(true),
  });

  const LOCAL_TABLES_KEY = "restocash_tables_v1";

  const getLocalTables = (): Table[] => {
    try {
      if (typeof window === "undefined" || typeof localStorage === "undefined") return [];
      const raw = localStorage.getItem(LOCAL_TABLES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const tablesQuery = useQuery({
    queryKey: ["tables"],
    queryFn: async () => {
      let dbTables: Table[] = [];
      try {
        const { data, error } = await supabase.from("tables").select("*").order("number");
        if (!error && data) {
          dbTables = data as Table[];
        }
      } catch (err) {
        console.warn("Could not fetch tables from Supabase, using local fallback:", err);
      }

      const localTables = getLocalTables();
      const dbIds = new Set(dbTables.map((t) => t.id));
      const uniqueLocal = localTables.filter((lt) => !dbIds.has(lt.id));
      const merged = [...dbTables, ...uniqueLocal].sort((a, b) => a.number - b.number);

      if (merged.length === 0) {
        const defaultTables: Table[] = [
          { id: "tbl-1", number: 1, name: "طاولة 1", status: "available" },
          { id: "tbl-2", number: 2, name: "طاولة 2", status: "available" },
          { id: "tbl-3", number: 3, name: "طاولة 3", status: "available" },
          { id: "tbl-4", number: 4, name: "طاولة 4", status: "available" },
        ];
        return defaultTables;
      }

      return merged;
    },
    refetchInterval: 3000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("tables_realtime_pos")
      .on("postgres_changes", { event: "*", schema: "public", table: "tables" }, () => {
        queryClient.invalidateQueries({ queryKey: ["tables"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const addToCart = (item: MenuItem) => {
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
        .filter((c): c is CartLine => c !== null),
    );
  };

  const removeFromCart = (id: string) => setCart((prev) => prev.filter((c) => c.item.id !== id));

  const updateItemNotes = (id: string, notes: string) => {
    setCart((prev) => prev.map((c) => (c.item.id === id ? { ...c, notes } : c)));
  };
  const [receiptSettings, setReceiptSettings] = useState(() => getReceiptDesignSettings());

  useEffect(() => {
    const refreshSettings = () => {
      setReceiptSettings(getReceiptDesignSettings());
    };
    refreshSettings();

    const handleSettingsUpdate = (e: any) => {
      if (e?.detail) setReceiptSettings(e.detail);
      else refreshSettings();
    };

    window.addEventListener("receipt_settings_updated", handleSettingsUpdate);
    window.addEventListener("storage", refreshSettings);
    window.addEventListener("focus", refreshSettings);

    return () => {
      window.removeEventListener("receipt_settings_updated", handleSettingsUpdate);
      window.removeEventListener("storage", refreshSettings);
      window.removeEventListener("focus", refreshSettings);
    };
  }, []);

  // Financial rates & fees linked directly to receiptSettings
  const taxRatePercent = receiptSettings.defaultTaxRate ?? 14;
  const enableTax = receiptSettings.enableTax ?? true;

  const [discountType, setDiscountType] = useState<"percent" | "fixed">(
    () => receiptSettings.defaultDiscountType ?? "percent",
  );
  const [discountValue, setDiscountValue] = useState<number>(
    () => receiptSettings.defaultDiscountValue ?? 0,
  );

  const dineInServiceRate = receiptSettings.dineInServiceRate ?? 12;
  const enableDineInService = receiptSettings.enableDineInService ?? true;

  const deliveryFeeValue = receiptSettings.deliveryFee ?? 20;
  const enableDeliveryFee = receiptSettings.enableDeliveryFee ?? true;

  const handleDineInServiceRateChange = (newRate: number) => {
    const rate = Math.max(0, isNaN(newRate) ? 0 : newRate);
    const updated = { ...getReceiptDesignSettings(), dineInServiceRate: rate };
    saveReceiptDesignSettings(updated);
  };

  const handleEnableDineInServiceChange = (enabled: boolean) => {
    const updated = { ...getReceiptDesignSettings(), enableDineInService: enabled };
    saveReceiptDesignSettings(updated);
  };

  const handleDeliveryFeeChange = (val: number) => {
    const fee = Math.max(0, isNaN(val) ? 0 : val);
    const updated = { ...getReceiptDesignSettings(), deliveryFee: fee };
    saveReceiptDesignSettings(updated);
  };

  const handleEnableDeliveryFeeChange = (enabled: boolean) => {
    const updated = { ...getReceiptDesignSettings(), enableDeliveryFee: enabled };
    saveReceiptDesignSettings(updated);
  };

  const additionsTotal = selectedAdditions.reduce((acc, addId) => {
    const add = additionsList.find((a) => a.id === addId);
    return acc + (add ? add.price : 0);
  }, 0);

  const itemsSubtotal =
    cart.reduce((acc, c) => acc + c.item.price * c.quantity, 0) + additionsTotal;

  // Discount calculation
  let discountAmount = 0;
  if (discountValue > 0) {
    if (discountType === "percent") {
      discountAmount = (itemsSubtotal * discountValue) / 100;
    } else {
      discountAmount = discountValue;
    }
  }
  discountAmount = Math.min(discountAmount, itemsSubtotal);
  const subtotalAfterDiscount = itemsSubtotal - discountAmount;

  // Service Charges
  let dineInServiceAmount = 0;
  if (orderType === "dine_in" && enableDineInService && dineInServiceRate > 0) {
    dineInServiceAmount = (subtotalAfterDiscount * dineInServiceRate) / 100;
  }

  let deliveryServiceAmount = 0;
  if (orderType === "delivery" && enableDeliveryFee && deliveryFeeValue > 0) {
    deliveryServiceAmount = deliveryFeeValue;
  }

  const taxableAmount = subtotalAfterDiscount + dineInServiceAmount + deliveryServiceAmount;

  // Tax Calculation
  let tax = 0;
  if (enableTax && taxRatePercent > 0) {
    tax = (taxableAmount * taxRatePercent) / 100;
  }

  const subTotal = itemsSubtotal;
  const total = taxableAmount + tax;
  const itemCount = cart.reduce((a, c) => a + c.quantity, 0);

  const filteredItems = useMemo(() => {
    const items = itemsQuery.data ?? [];
    return items.filter((i) => {
      const matchCat = activeCategory === "all" || i.category_id === activeCategory;
      const matchSearch = !search.trim() || i.name_ar.includes(search.trim());
      return matchCat && matchSearch;
    });
  }, [itemsQuery.data, activeCategory, search]);

  const placeOrder = useMutation({
    mutationFn: async () => {
      // 1. Fetch SUB-STORE (Oven & Kitchen) and MAIN-STORE inventory levels for validation
      const OPERATIONAL_WH = await inventoryService.getOperationalWarehouseId();
      const kitchenInv = await inventoryService.getWarehouseInventory(OPERATIONAL_WH);
      const mainStoreInv = await inventoryService.getWarehouseInventory("wh-main-default");

      const kitchenInvMap = Object.fromEntries((kitchenInv ?? []).map((i) => [i.inventory_id, i]));
      const mainInvMap = Object.fromEntries((mainStoreInv ?? []).map((i) => [i.inventory_id, i]));

      // Get names and units from general inventory list
      const allInv = await inventoryService.getInventory();
      const allInvMap = Object.fromEntries((allInv ?? []).map((i) => [i.id, i]));

      // 2. Load recipes/ingredients for all cart items
      let localRecipes: Record<string, any[]> = {};
      try {
        localRecipes = JSON.parse(localStorage.getItem("local_menu_ingredients") || "{}");
      } catch (e) {
        console.error("Error reading local recipes:", e);
      }

      const menuItems = await menuService.getMenuItems();
      const menuMap = Object.fromEntries((menuItems ?? []).map((m) => [m.id, m]));

      // 3. Aggregate required ingredient quantities and costs for this order
      // We track requirements for the operational warehouse: Oven & Kitchen
      const requiredByWarehouse: Record<
        string,
        {
          warehouseId: string;
          invId: string;
          name: string;
          required: number;
          subAvailable: number;
          mainAvailable: number;
          unit: string;
          costPerUnit: number;
        }
      > = {};

      for (const cartItem of cart) {
        const menuItem = menuMap[cartItem.item.id];

        let ingredients =
          Array.isArray(menuItem?.ingredients) && menuItem.ingredients.length > 0
            ? (menuItem.ingredients as any[])
            : localRecipes[cartItem.item.id] || [];

        // If no ingredients, check if it's a tracked product directly
        if (
          ingredients.length === 0 &&
          menuItem?.inventory_tracking &&
          menuItem.inventory_tracking !== "not_tracked"
        ) {
          ingredients = [
            {
              inventory_id: menuItem.inventory_tracking,
              weight: 1,
              unit: "unit",
            },
          ];
        }

        for (const ing of ingredients) {
          const subInvItem = kitchenInvMap[ing.inventory_id];
          const mainInvItem = mainInvMap[ing.inventory_id];
          const masterInvItem = allInvMap[ing.inventory_id];

          if (masterInvItem) {
            // Convert to inventory unit
            const convertedWeight = convertToInventoryUnit(
              Number(ing.weight),
              ing.unit,
              masterInvItem.unit,
            );
            const totalNeeded = convertedWeight * cartItem.quantity;

            const key = `${OPERATIONAL_WH}:${ing.inventory_id}`;
            if (!requiredByWarehouse[key]) {
              requiredByWarehouse[key] = {
                warehouseId: OPERATIONAL_WH,
                invId: ing.inventory_id,
                name: masterInvItem.name_ar,
                required: 0,
                subAvailable: Number(subInvItem?.quantity ?? 0),
                mainAvailable: Number(mainInvItem?.quantity ?? 0),
                unit: masterInvItem.unit,
                costPerUnit: masterInvItem.cost || 0,
              };
            }
            requiredByWarehouse[key].required += totalNeeded;
          }
        }
      }

      // 4. Validate and check if any ingredient is insufficient in OPERATIONAL_WH
      const insufficient: { name: string; required: number; available: number; unit: string }[] =
        [];

      for (const [key, detail] of Object.entries(requiredByWarehouse)) {
        if (detail.required > detail.subAvailable) {
          insufficient.push({
            name: detail.name,
            required: detail.required,
            available: detail.subAvailable,
            unit: detail.unit,
          });
        }
      }

      const erpState = erpStore.getState();
      const allowNegative = erpState.inventorySettings?.allowNegativeStock ?? true;

      if (insufficient.length > 0) {
        const warnings = insufficient
          .map(
            (item) =>
              `• ${item.name}: المطلوب ${item.required.toFixed(2)}، المتاح في مخزن الفرن والمطبخ ${item.available.toFixed(2)} ${item.unit}`,
          )
          .join("\n");

        if (!allowNegative) {
          throw new Error(
            lang === "ar"
              ? `عذراً، المخزون في مخزن الفرن والمطبخ غير كافٍ للمكونات التالية:\n${warnings}`
              : `Sorry, insufficient stock in Kitchen Warehouse for the following ingredients:\n${warnings}`,
          );
        } else {
          // Just show a warning toast if allowed to go negative
          setTimeout(() => {
            toast({
              title: lang === "ar" ? "تنبيه نقص مخزون" : "Stock Shortage Warning",
              description:
                lang === "ar"
                  ? "بعض المكونات غير متوفرة في مخزن الفرن والمطبخ. سيتم الخصم بالسالب."
                  : "Some ingredients are low in Kitchen Warehouse. Stocks will go negative.",
              variant: "destructive",
            });
          }, 100);
        }
      }

      const additionsText = selectedAdditions
        .map((id) => {
          const add = additionsList.find((a) => a.id === id);
          return lang === "ar" ? add?.label_ar : add?.label_en;
        })
        .join("، ");

      const combinedNotes = [
        orderNotes
          ? `${lang === "ar" ? "الطلبات الخاصة: " : "Special Requests: "}${orderNotes}`
          : "",
        additionsText ? `${lang === "ar" ? "الإضافات: " : "Additions: "}${additionsText}` : "",
      ]
        .filter(Boolean)
        .join(" | ");

      let finalNotes = combinedNotes || "";
      if (payment === "card" && authNumber)
        finalNotes += (finalNotes ? " | " : "") + "AUTH#: " + authNumber;
      if (payment === "wallet" && mobileNumber)
        finalNotes += (finalNotes ? " | " : "") + "رقم الموبايل: " + mobileNumber;

      if (currency && currency !== "EGP")
        finalNotes += (finalNotes ? " | " : "") + "العملة: " + currency;

      const rate = exchangeRates[currency] || 1;
      const finalSubtotal = currency === "EGP" ? subTotal : subTotal / rate;
      const finalDiscount = currency === "EGP" ? discountAmount : discountAmount / rate;
      const finalServiceFee = currency === "EGP" ? dineInServiceAmount : dineInServiceAmount / rate;
      const finalDeliveryFee =
        currency === "EGP" ? deliveryServiceAmount : deliveryServiceAmount / rate;
      const finalTax = currency === "EGP" ? tax : tax / rate;
      const finalTotal = currency === "EGP" ? total : total / rate;

      if (finalDiscount > 0)
        finalNotes += (finalNotes ? " | " : "") + "الخصم: " + finalDiscount.toFixed(2);
      if (finalServiceFee > 0)
        finalNotes += (finalNotes ? " | " : "") + "خدمة صالة: " + finalServiceFee.toFixed(2);
      if (finalDeliveryFee > 0)
        finalNotes += (finalNotes ? " | " : "") + "رسوم توصيل: " + finalDeliveryFee.toFixed(2);

      const payload = {
        subtotal: Number(finalSubtotal.toFixed(2)),
        tax: Number(finalTax.toFixed(2)),
        total: Number(finalTotal.toFixed(2)),
        payment_method: payment,
        order_type: orderType,
        table_id: orderType === "dine_in" ? cleanTableId(selectedTable) : null,
        status: activeTableOrderSentToKitchen ? "served" : "pending",
        notes: finalNotes || null,

        items: cart.map((c) => {
          // Calculate individual item cost for reports
          const menuItem = menuMap[c.item.id];
          let ingredients =
            Array.isArray(menuItem?.ingredients) && menuItem.ingredients.length > 0
              ? (menuItem.ingredients as any[])
              : localRecipes[c.item.id] || [];

          // If no ingredients, check if it's a tracked product directly
          if (
            ingredients.length === 0 &&
            menuItem?.inventory_tracking &&
            menuItem.inventory_tracking !== "not_tracked"
          ) {
            ingredients = [
              {
                inventory_id: menuItem.inventory_tracking,
                weight: 1,
                unit: "unit",
              },
            ];
          }

          let singleItemCost = 0;
          for (const ing of ingredients) {
            const masterInvItem = allInvMap[ing.inventory_id];
            if (masterInvItem) {
              const convertedWeight = convertToInventoryUnit(
                Number(ing.weight),
                ing.unit,
                masterInvItem.unit,
              );
              singleItemCost += convertedWeight * (masterInvItem.cost || 0);
            }
          }

          return {
            id: c.item.id,
            menu_item_id: c.item.id,
            name_ar: c.item.name_ar,
            price: c.item.price,
            quantity: c.quantity,
            notes: c.notes || "",
            requires_oven: (c.item as any).requires_oven || false,
            cost_price: Number(singleItemCost.toFixed(2)),
          };
        }),
      };
      let data: any = null;
      try {
        const res = await supabase
          .from("orders")
          .insert(payload)
          .select(
            "id,order_number,subtotal,tax,total,payment_method,order_type,table_id,status,items,created_at",
          )
          .single();
        if (res.error) throw res.error;
        data = res.data;
      } catch (sbErr) {
        console.warn("Supabase order insert failed, using local fallback:", sbErr);
        const localId = "local-" + Date.now();
        const localOrderNumber = 1000 + Math.floor(Math.random() * 9000);
        data = {
          id: localId,
          order_number: localOrderNumber,
          ...payload,
          created_at: new Date().toISOString(),
        };
        try {
          const existing = JSON.parse(localStorage.getItem("pos_local_orders") || "[]");
          localStorage.setItem("pos_local_orders", JSON.stringify([data, ...existing]));
        } catch (lErr) {
          console.warn("Local storage save error:", lErr);
        }
      }

      // Post to ERP automated journal entries and update treasury balances (Cashier / Bank)
      try {
        erpStore.postSalesInvoiceJournal(
          data.order_number,
          Number(data.total),
          Number(data.subtotal),
          Number(data.tax),
          data.payment_method,
          erpStore.getState().currentBranchId,
          currency,
          selectedTreasury,
          selectedContainer,
        );
      } catch (erpErr) {
        console.error("Error posting sales to ERP system from POS:", erpErr);
      }

      // 5. Deduct ingredients from the operational warehouse
      const deductionResult = await inventoryService.deductOrderIngredients(
        data.id,
        data.items || payload.items,
        data.order_number,
        allowNegative,
      );

      if (!deductionResult.success) {
        // If deduction failed (e.g. strict stock and run out), we should ideally roll back or inform
        console.error("Inventory deduction failed during order placement:", deductionResult.error);
      }

      if (activeTableKitchenOrderId) {
        try {
          await supabase
            .from("orders")
            .update({ status: "served" })
            .eq("id", activeTableKitchenOrderId);
        } catch (err) {
          console.error("Failed to update active kitchen order status:", err);
        }
      }

      return {
        ...data,
        discount: finalDiscount,
        service_fee: finalServiceFee,
        delivery_fee: finalDeliveryFee,
        tax_rate: taxRatePercent,
      } as unknown as CompletedOrder;
    },
    onSuccess: (order) => {
      if (selectedTable) {
        tableOrdersStore.clearTableOrder(selectedTable);
      }
      setActiveTableOrderSentToKitchen(false);
      setActiveTableKitchenOrderId(null);
      setInvoice(order);
      setCart([]);
      setSelectedTable("");
      setOrderNotes("");
      setSelectedAdditions([]);
      setAuthNumber("");
      setMobileNumber("");
      setCheckoutOpen(false);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "tables"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "reports", "orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory_transactions"] });
    },
  });

  const handleResetSalesAndPendingOrders = async () => {
    try {
      // 1. Hard delete pending & served orders from Supabase orders table
      const { error } = await supabase
        .from("orders")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) console.warn("Supabase orders delete warning:", error);

      // 2. Clear local table orders store
      tableOrdersStore.clearAll();

      // 3. Clear sales counters in localStorage
      localStorage.removeItem("restocash_sales_v1");
      localStorage.removeItem("pos_sales_counter");
      localStorage.removeItem("completed_orders_v1");
      localStorage.removeItem("daily_sales_v1");

      // 4. Reset ERP store sales invoices and sales income transactions

      toast({
        title: "تم تصفير المبيعات وحذف كافة الطلبات المعلقة 🧹",
        description: "تم حذف جميع الطلبات المعلقة والسابقة وتصفير عداد المبيعات بنجاح.",
      });

      setCart([]);
      setSelectedTable("");

      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    } catch (err: any) {
      toast({
        title: "خطأ",
        description: err.message || "حدث خطأ أثناء التصفير",
        variant: "destructive",
      });
    }
  };

  const exportOrdersToExcel = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("order_number,subtotal,tax,total,payment_method,order_type,status,items,created_at")
      .order("created_at", { ascending: false });
    if (error) {
      alert("تعذر تحميل الطلبات: " + error.message);
      return;
    }
    const orders = (data ?? []) as CompletedOrder[];
    if (orders.length === 0) {
      alert("لا توجد طلبات لتصديرها");
      return;
    }
    const payLabelMap: Record<PaymentMethod, string> = {
      cash: "نقدي",
      card: "بطاقة",
      wallet: "محفظة",
    };
    const typeLabelMap: Record<OrderType, string> = {
      dine_in: "داخل المطعم",
      takeaway: "Takeaway",
      delivery: "توصيل",
    };
    const parseItems = (raw: any): any[] => {
      if (Array.isArray(raw)) return raw;
      if (typeof raw === "string") {
        try {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }
      return [];
    };

    const summary = orders.map((o) => {
      const itemsList = parseItems(o.items);
      return {
        "رقم الطلب": o.order_number,
        التاريخ: new Date(o.created_at).toLocaleString("ar-EG"),
        "نوع الطلب": typeLabelMap[o.order_type],
        "عدد الأصناف": itemsList.reduce((a, it) => a + (it.quantity || 1), 0),
        "المجموع الفرعي": Number(o.subtotal),
        الضريبة: Number(o.tax),
        الإجمالي: Number(o.total),
        "طريقة الدفع": payLabelMap[o.payment_method],
        الحالة: o.status,
      };
    });
    const details = orders.flatMap((o) => {
      const itemsList = parseItems(o.items);
      return itemsList.map((it) => ({
        "رقم الطلب": o.order_number,
        التاريخ: new Date(o.created_at).toLocaleString("ar-EG"),
        الصنف: it.name_ar || it.name || "صنف",
        السعر: Number(it.price || 0),
        الكمية: it.quantity || 1,
        الإجمالي: Number(it.price || 0) * (it.quantity || 1),
      }));
    });
    const totals = {
      "إجمالي الطلبات": orders.length,
      "إجمالي المبيعات": orders.reduce((a, o) => a + Number(o.total), 0),
      "إجمالي الضريبة": orders.reduce((a, o) => a + Number(o.tax), 0),
      نقدي: orders
        .filter((o) => o.payment_method === "cash")
        .reduce((a, o) => a + Number(o.total), 0),
      بطاقة: orders
        .filter((o) => o.payment_method === "card")
        .reduce((a, o) => a + Number(o.total), 0),
      محفظة: orders
        .filter((o) => o.payment_method === "wallet")
        .reduce((a, o) => a + Number(o.total), 0),
    };
    const wb = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.json_to_sheet(summary);
    wsSummary["!views"] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "الطلبات");
    const wsDetails = XLSX.utils.json_to_sheet(details);
    wsDetails["!views"] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, wsDetails, "تفاصيل الأصناف");
    const wsTotals = XLSX.utils.json_to_sheet([totals]);
    wsTotals["!views"] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, wsTotals, "الملخص");
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `restocash-orders-${stamp}.xlsx`);
  };

  const allTables = tablesQuery.data ?? [];

  if (!user) return null;

  return (
    <div
      className="min-h-screen flex bg-background text-foreground animate-fade-in"
      dir={lang === "ar" ? "rtl" : "ltr"}
      style={{ fontFamily: '"Tajawal", "Cairo", system-ui, sans-serif' }}
    >
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-6 pt-4">
          <BackToRestaurantButton />
        </div>
        <header
          className="px-8 py-5 border-b border-border flex items-center justify-between gap-6"
          style={{ background: "var(--gradient-primary)" }}
        >
          <div className="flex items-center gap-3 text-primary-foreground">
            <RestocashLogo size={32} variant="white" />
            <div className="mr-2">
              <h1 className="text-xl font-black tracking-tight leading-none">{t.title}</h1>
              <p className="text-xs opacity-80 mt-1" suppressHydrationWarning>
                {t.pos} • {new Date().toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US")}
              </p>
            </div>
          </div>
          <div className="flex-1 max-w-md relative">
            <Search
              className={`absolute ${lang === "ar" ? "right-4" : "left-4"} top-1/2 -translate-y-1/2 text-primary-foreground/70`}
              size={18}
            />
            <input
              type="text"
              placeholder={t.search}
              className={`w-full bg-primary-foreground/15 backdrop-blur border border-primary-foreground/20 rounded-2xl py-3 ${lang === "ar" ? "pr-11 pl-4" : "pl-11 pr-4"} text-sm text-primary-foreground placeholder:text-primary-foreground/60 outline-none focus:border-primary-foreground/60 transition`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </header>

        {/* Separated Interfaces & Quick Settings Bar */}
        <div className="px-8 py-3 bg-slate-900 border-b border-border flex flex-wrap items-center justify-between gap-4 text-white">
          {/* 4 Separated Interfaces */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              {lang === "ar" ? "الواجهات:" : "Interfaces:"}
            </span>
            <Link
              to="/"
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold shadow-sm"
            >
              {lang === "ar" ? "الكاشير (نقطة البيع)" : "Cashier (POS)"}
            </Link>
            <Link
              to="/oven"
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700"
            >
              {lang === "ar" ? "الفرن" : "Oven"}
            </Link>
            <Link
              to="/captain"
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700"
            >
              Captain Order
            </Link>
            <Link
              to="/admin"
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700"
            >
              {lang === "ar" ? "لوحة الإدارة" : "Admin Panel"}
            </Link>
          </div>

          {/* Quick Settings (Treasury Interface, Lang & Currency) */}
          <Link
            to="/cashier-treasury"
            className="flex items-center gap-2 bg-slate-800/90 hover:bg-slate-800 border border-emerald-500/30 rounded-xl px-3 py-1.5 transition shadow-sm text-xs font-bold text-emerald-300"
          >
            <Wallet size={14} className="text-emerald-400" />
            <span>{lang === "ar" ? "خزينة الكاشير" : "Cashier Treasury"}</span>
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Currency Select & Rates */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-semibold">
                  {lang === "ar" ? "العملة:" : "Currency:"}
                </span>
                <select
                  value={currency}
                  onChange={(e) => changeCurrency(e.target.value as any)}
                  className="bg-slate-800 border border-slate-700 text-white text-xs font-bold px-2.5 py-1 rounded-lg focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="EGP">{lang === "ar" ? "جنيه مصري (EGP)" : "EGP"}</option>
                  <option value="USD">{lang === "ar" ? "دولار أمريكي (USD)" : "USD"}</option>
                  <option value="SSP">{lang === "ar" ? "جنيه ج.س (SSP)" : "SSP"}</option>
                </select>
              </div>

              {currency !== "EGP" && (
                <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1 rounded-lg border border-slate-700/50 animate-in fade-in slide-in-from-right-2">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
                    {lang === "ar" ? "سعر الصرف:" : "Rate:"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400">1 {currency} =</span>
                    <input
                      type="number"
                      step="0.01"
                      className="bg-slate-700/50 border-none text-[11px] font-black w-16 text-center rounded px-1 focus:ring-1 focus:ring-primary outline-none"
                      value={exchangeRates[currency]}
                      onChange={(e) => updateExchangeRate(currency, Number(e.target.value))}
                    />
                    <span className="text-[10px] text-slate-400">EGP</span>
                  </div>
                </div>
              )}
            </div>

            {/* Language Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold">
                {lang === "ar" ? "اللغة:" : "Language:"}
              </span>
              <button
                onClick={() => changeLang(lang === "ar" ? "en" : "ar")}
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-3 py-1 rounded-lg border border-slate-700 transition cursor-pointer"
              >
                {lang === "ar" ? "English" : "العربية"}
              </button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    className="bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800/80 text-xs font-bold px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 ml-2"
                    title={
                      lang === "ar" ? "تصفير عداد المبيعات وحذف الطلبات المعلقة" : "Reset Sales"
                    }
                  >
                    <Trash2 size={13} className="text-rose-400" />
                    <span>{lang === "ar" ? "تصفير المبيعات" : "Reset Sales"}</span>
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-right">
                      {lang === "ar" ? "تأكيد تصفير المبيعات والطلبات" : "Confirm Sales Reset"}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-right">
                      {lang === "ar"
                        ? "هل أنت متأكد من رغبتك في تصفير عداد المبيعات وحذف كافة الطلبات المعلقة في الكاشير والفرن نهائياً؟ (سيتم حذفها بالكامل من النظام ولن يمكن استرجاعها)."
                        : "Are you sure you want to reset sales counters and delete all pending cashier and oven orders permanently?"}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-row-reverse sm:justify-start">
                    <AlertDialogCancel>{lang === "ar" ? "تراجع" : "Cancel"}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleResetSalesAndPendingOrders}
                      className="bg-rose-600 hover:bg-rose-700 text-white mr-2 font-bold"
                    >
                      {lang === "ar" ? "نعم، قم بالحذف والتصفير" : "Yes, Reset & Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>

        {/* Pending Table Orders Notification Bar */}
        {pendingCashierOrders.length > 0 && (
          <div className="px-8 py-3.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-md animate-in slide-in-from-top-2 border-b border-orange-600/30">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center font-black shrink-0">
                  <Bell size={20} className="animate-bounce" />
                </div>
                <div>
                  <h3 className="font-black text-sm flex items-center gap-2">
                    <span>
                      {lang === "ar"
                        ? `تنبيه: يوجد (${pendingCashierOrders.length}) طلبات جديدة قادمة من الكابتن!`
                        : `Alert: (${pendingCashierOrders.length}) new order(s) sent from Captain tables!`}
                    </span>
                  </h3>
                  <p className="text-xs text-amber-100 mt-0.5">
                    {lang === "ar"
                      ? "اضغط على 'دفع الأوردر' لنقل الطلب تلقائياً لسلة الكاشير وإتمام عملية التسديد."
                      : "Click 'Pay Order' to transfer order into cashier cart for payment."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {pendingCashierOrders.map((pOrder) => (
                  <div
                    key={pOrder.id}
                    className="bg-white/20 backdrop-blur border border-white/30 rounded-2xl px-4 py-2 flex items-center gap-3 text-xs font-bold shadow-sm"
                  >
                    <div className="flex flex-col">
                      <span className="font-black text-white text-sm flex items-center gap-1.5">
                        <span>
                          {lang === "ar"
                            ? `طاولة #${pOrder.table_number}`
                            : `Table #${pOrder.table_number}`}
                        </span>
                        {pOrder.sentToKitchen && (
                          <span className="text-[10px] bg-amber-950/70 text-amber-200 px-1.5 py-0.5 rounded-md font-black border border-amber-400/40">
                            👨‍🍳 مرسل للمطبخ
                          </span>
                        )}
                      </span>
                      <span className="text-[11px] text-amber-100">
                        {pOrder.items.length} {lang === "ar" ? "أصناف" : "items"} •{" "}
                        {formatPrice(pOrder.total)}
                      </span>
                    </div>

                    <button
                      onClick={() => handleLoadTableOrderToCart(pOrder)}
                      className="bg-white hover:bg-amber-50 text-orange-600 font-black text-xs px-3.5 py-1.5 rounded-xl shadow transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                      <ShoppingCart size={14} />
                      <span>{lang === "ar" ? "دفع الأوردر" : "Pay Order"}</span>
                    </button>

                    <button
                      onClick={() => removeOrder(pOrder.id)}
                      className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
                      title={lang === "ar" ? "تجاهل التنبيه" : "Dismiss"}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="px-8 py-4 border-b border-border bg-card">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <CategoryPill
              label={t.all}
              active={activeCategory === "all"}
              onClick={() => setActiveCategory("all")}
            />
            {(categoriesQuery.data ?? []).map((c) => (
              <CategoryPill
                key={c.id}
                label={c.name_ar}
                active={activeCategory === c.id}
                onClick={() => setActiveCategory(c.id)}
              />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          {itemsQuery.isLoading ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <Loader2 className="animate-spin" />
            </div>
          ) : (itemsQuery.data ?? []).length === 0 ? (
            <div className="max-w-2xl mx-auto text-center py-16 px-6 bg-card border border-border rounded-3xl shadow-sm space-y-6">
              <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <UtensilsCrossed size={36} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-center mb-4">
                  <RestocashLogo size={40} />
                </div>
                <h3 className="text-2xl font-black">مرحباً بك في نظام نقاط البيع</h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  المنيو فارغ حالياً. للبدء في استخدام نظام الكاشير ونقاط البيع، يرجى التوجه إلى
                  لوحة الإدارة لإضافة فئات وأصناف جديدة للمنيو.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Link
                  to="/admin"
                  className="w-full sm:w-auto px-6 py-3 bg-primary text-primary-foreground font-bold rounded-2xl shadow hover:opacity-95 transition"
                >
                  الذهاب للوحة الإدارة ⚙️
                </Link>
                <Link
                  to="/setup"
                  className="w-full sm:w-auto px-6 py-3 bg-muted text-muted-foreground font-semibold rounded-2xl hover:bg-muted/80 transition"
                >
                  إعداد حساب المدير الأول 👤
                </Link>
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center text-muted-foreground py-20">{t.no_items}</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className={`group bg-card rounded-3xl overflow-hidden border border-border transition-all hover:-translate-y-1 active:scale-[0.98] ${lang === "ar" ? "text-right" : "text-left"}`}
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                    {item.image_url && (
                      <img
                        src={item.image_url}
                        alt={item.name_ar}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="absolute top-3 left-3 bg-primary text-primary-foreground text-xs font-bold px-2.5 py-1 rounded-full shadow">
                      {formatPrice(item.price)}
                    </div>
                    {item.badge && (
                      <div className="absolute top-0 right-0 bg-slate-900/90 backdrop-blur-md text-white text-xs font-black px-3.5 py-1.5 rounded-bl-2xl shadow-md z-10">
                        {item.badge}
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h4 className="font-bold text-sm text-card-foreground line-clamp-1">
                      {item.name_ar}
                    </h4>
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-primary font-semibold">
                      <Plus size={14} />
                      <span>{t.add_to_order}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <aside
        className="hidden lg:flex lg:w-[380px] bg-card border-r border-border flex-col shrink-0 sticky top-0 h-screen self-start overflow-hidden"
        style={{ boxShadow: "var(--shadow-elegant)" }}
      >
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-primary-foreground"
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
          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              className="text-xs text-destructive hover:underline"
            >
              {lang === "ar" ? "مسح الكل" : "Clear All"}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          {cart.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
                <ShoppingCart size={26} />
              </div>
              <p className="text-sm text-muted-foreground">
                {t.empty_cart}
                <br />
                <span className="text-xs">
                  {lang === "ar" ? "اضغط على الأصناف لإضافتها" : "Click on items to add them"}
                </span>
              </p>
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
                    className="w-14 h-14 rounded-xl object-cover shrink-0"
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
                        className={`p-1 rounded-md transition ${
                          c.notes
                            ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                        title={lang === "ar" ? "ملاحظة للصنف" : "Item note"}
                      >
                        <FileText size={14} />
                      </button>
                      <button
                        onClick={() => removeFromCart(c.item.id)}
                        className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition p-1"
                        title={lang === "ar" ? "حذف الصنف" : "Remove item"}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {c.notes ? (
                    <div className="mt-1.5 flex items-center justify-between gap-1.5 bg-amber-50 border border-amber-200 text-amber-950 rounded-lg px-2 py-1 text-[11px] font-bold">
                      <div
                        className="flex-1 min-w-0 truncate cursor-pointer hover:underline flex items-center gap-1"
                        onClick={() =>
                          setNoteEditingItem({
                            id: c.item.id,
                            name: c.item.name_ar,
                            notes: c.notes || "",
                          })
                        }
                      >
                        <span className="text-amber-700 font-extrabold shrink-0">ملاحظة:</span>
                        <span className="truncate">{c.notes}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateItemNotes(c.item.id, "")}
                        className="text-amber-700 hover:text-rose-600 p-0.5 rounded transition shrink-0"
                        title="حذف الملاحظة"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setNoteEditingItem({
                          id: c.item.id,
                          name: c.item.name_ar,
                          notes: "",
                        })
                      }
                      className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground hover:text-primary transition"
                    >
                      <Plus size={11} />
                      <span>{lang === "ar" ? "إضافة ملاحظة..." : "Add note..."}</span>
                    </button>
                  )}

                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-black text-primary">
                      {formatPrice(c.item.price * c.quantity)}
                    </span>
                    <div
                      className="flex items-center gap-1.5 bg-card rounded-lg border border-border p-0.5"
                      dir="ltr"
                    >
                      <button
                        onClick={() => updateQuantity(c.item.id, -1)}
                        className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center transition"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="text-xs font-bold w-5 text-center">{c.quantity}</span>
                      <button
                        onClick={() => updateQuantity(c.item.id, 1)}
                        className="w-6 h-6 rounded-md bg-primary text-primary-foreground hover:opacity-90 flex items-center justify-center transition"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-border p-5 space-y-3 bg-card">
          <div className="flex justify-between items-baseline">
            <span className="font-bold text-sm">
              {lang === "ar" ? "مجموع الطلبات" : t.subtotal}
            </span>
            <span className="text-2xl font-black text-primary">{formatPrice(subTotal)}</span>
          </div>
          <p className="text-[11px] text-muted-foreground text-center">
            {lang === "ar"
              ? "يتم احتساب الضريبة والخدمات بعد الضغط على إتمام الطلب"
              : "Tax & fees calculated at checkout"}
          </p>
          <button
            disabled={cart.length === 0}
            onClick={() => setCheckoutOpen(true)}
            className="w-full py-4 rounded-2xl text-primary-foreground font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-95 active:scale-[0.99] transition shadow"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-elegant)" }}
          >
            {lang === "ar" ? "إتمام الطلب" : "Place Order"} • {formatPrice(subTotal)}
          </button>
        </div>
      </aside>

      <MenuExportModal isOpen={isMenuExportOpen} onClose={() => setIsMenuExportOpen(false)} />

      {checkoutOpen && (
        <Modal onClose={() => setCheckoutOpen(false)}>
          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black">
                {lang === "ar" ? "تفاصيل إتمام الطلب" : "Checkout Details"}
              </h3>
              <button
                onClick={() => setCheckoutOpen(false)}
                className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            {/* Order Type */}
            <div className="mb-4">
              <Label className="text-sm font-bold block mb-1.5">{t.order_type}</Label>
              <div className="grid grid-cols-3 gap-2">
                {orderTypeOptions.map((ot) => {
                  const Icon = ot.icon;
                  const label =
                    ot.key === "dine_in"
                      ? t.dine_in
                      : ot.key === "takeaway"
                        ? t.takeaway
                        : t.delivery;
                  return (
                    <button
                      key={ot.key}
                      onClick={() => setOrderType(ot.key)}
                      className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-xs font-bold transition ${
                        orderType === ot.key
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <Icon size={16} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Payment Method */}
            <div className="mb-4">
              <Label className="text-sm font-bold block mb-1.5">{t.payment_method}</Label>
              <div className="grid grid-cols-3 gap-3">
                <PayOption
                  icon={<Banknote size={22} />}
                  label={t.cash}
                  active={payment === "cash"}
                  onClick={() => setPayment("cash")}
                />
                <PayOption
                  icon={<CreditCard size={22} />}
                  label={t.card}
                  active={payment === "card"}
                  onClick={() => setPayment("card")}
                />
                <PayOption
                  icon={<Smartphone size={22} />}
                  label={t.wallet}
                  active={payment === "wallet"}
                  onClick={() => setPayment("wallet")}
                />
              </div>
            </div>

            {/* Currency & Extra Details */}
            <div className="mb-4 space-y-3">
              <div>
                <Label className="text-sm font-bold block mb-1.5">
                  {lang === "ar" ? "عملة الدفع" : "Payment Currency"}
                </Label>
                <select
                  value={currency}
                  onChange={(e) => changeCurrency(e.target.value as any)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-bold focus:outline-none"
                >
                  <option value="EGP">{lang === "ar" ? "جنيه مصري (EGP)" : "EGP"}</option>
                  <option value="USD">{lang === "ar" ? "دولار أمريكي (USD)" : "USD"}</option>
                  <option value="SSP">{lang === "ar" ? "جنيه ج.س (SSP)" : "SSP"}</option>
                </select>
              </div>

              {payment === "card" && (
                <div>
                  <Label className="text-sm font-bold block mb-1.5">AUTH#</Label>
                  <input
                    type="text"
                    value={authNumber}
                    onChange={(e) => setAuthNumber(e.target.value)}
                    placeholder="Enter AUTH Number"
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              )}

              {payment === "wallet" && (
                <div>
                  <Label className="text-sm font-bold block mb-1.5">رقم الموبايل</Label>
                  <input
                    type="text"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    placeholder="Enter Mobile Number"
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              )}
            </div>
            {/* Table Selection */}
            {orderType === "dine_in" && (
              <div className="mb-4">
                <Label className="text-sm font-bold">{t.table}</Label>
                <select
                  className="w-full mt-1 h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:border-primary cursor-pointer"
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                >
                  <option value="">{t.choose_table}</option>
                  {allTables.map((tItem) => (
                    <option key={tItem.id} value={tItem.id}>
                      {tItem.name ||
                        (lang === "ar" ? `طاولة ${tItem.number}` : `Table ${tItem.number}`)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Additions Section */}
            <div className="mb-4">
              <Label className="text-sm font-bold block mb-1.5">{t.additions}</Label>
              <div className="grid grid-cols-2 gap-2">
                {additionsList.map((add) => {
                  const label = lang === "ar" ? add.label_ar : add.label_en;
                  const checked = selectedAdditions.includes(add.id);
                  return (
                    <button
                      key={add.id}
                      onClick={() => {
                        setSelectedAdditions((prev) =>
                          checked ? prev.filter((id) => id !== add.id) : [...prev, add.id],
                        );
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition ${
                        checked
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:border-primary/40 bg-card text-muted-foreground"
                      } ${lang === "ar" ? "text-right" : "text-left"}`}
                    >
                      <span>{label}</span>
                      <span className="text-[10px] opacity-85">+{formatPrice(add.price)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Special Notes Section */}
            <div className="mb-4">
              <Label className="text-sm font-bold">{t.order_notes}</Label>
              <textarea
                className="w-full mt-1 rounded-xl border border-input bg-background p-3 text-sm focus:outline-none focus:border-primary"
                rows={2}
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder={t.notes_placeholder}
              />
            </div>

            {/* Discount, Tax & Service Charges Section */}
            <div className="mb-4 space-y-3 p-3.5 rounded-2xl bg-muted/40 border border-border/70">
              <span className="text-xs font-bold text-muted-foreground block mb-1">
                {lang === "ar" ? "تعديل الخصم والضريبة والخدمات" : "Discounts, Taxes & Services"}
              </span>

              {/* Discount Controls */}
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-bold shrink-0">
                  {lang === "ar" ? "الخصم المباشر:" : "Discount:"}
                </Label>
                <div className="flex items-center gap-1.5 flex-1 justify-end">
                  <div className="flex rounded-lg border border-input p-0.5 bg-background text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setDiscountType("percent")}
                      className={`px-2 py-0.5 rounded-md transition ${discountType === "percent" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground"}`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType("fixed")}
                      className={`px-2 py-0.5 rounded-md transition ${discountType === "fixed" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground"}`}
                    >
                      {currency}
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-20 h-8 rounded-lg border border-input bg-background px-2 text-xs font-mono font-bold text-center"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Dine-in Service Charge Control */}
              {orderType === "dine_in" && (
                <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="enable-dinein-service"
                      checked={enableDineInService}
                      onChange={(e) => handleEnableDineInServiceChange(e.target.checked)}
                      className="rounded border-input text-primary focus:ring-primary w-3.5 h-3.5"
                    />
                    <Label
                      htmlFor="enable-dinein-service"
                      className="text-xs font-bold cursor-pointer"
                    >
                      {lang === "ar" ? "خدمة الصالة (%):" : "Dine-in Service (%):"}
                    </Label>
                  </div>
                  {enableDineInService && (
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={dineInServiceRate}
                      onChange={(e) =>
                        handleDineInServiceRateChange(parseFloat(e.target.value) || 0)
                      }
                      className="w-20 h-8 rounded-lg border border-input bg-background px-2 text-xs font-mono font-bold text-center"
                      placeholder="12"
                    />
                  )}
                </div>
              )}

              {/* Delivery Fee Control */}
              {orderType === "delivery" && (
                <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="enable-delivery-fee"
                      checked={enableDeliveryFee}
                      onChange={(e) => handleEnableDeliveryFeeChange(e.target.checked)}
                      className="rounded border-input text-primary focus:ring-primary w-3.5 h-3.5"
                    />
                    <Label
                      htmlFor="enable-delivery-fee"
                      className="text-xs font-bold cursor-pointer"
                    >
                      {lang === "ar"
                        ? `رسوم التوصيل (${currency}):`
                        : `Delivery Fee (${currency}):`}
                    </Label>
                  </div>
                  {enableDeliveryFee && (
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={deliveryFeeValue}
                      onChange={(e) => handleDeliveryFeeChange(parseFloat(e.target.value) || 0)}
                      className="w-20 h-8 rounded-lg border border-input bg-background px-2 text-xs font-mono font-bold text-center"
                      placeholder="20"
                    />
                  )}
                </div>
              )}

              {/* Tax Rate Info */}
              <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2 text-xs text-muted-foreground">
                <span>
                  {lang === "ar" ? "ضريبة القيمة المضافة المسجلة:" : "Registered VAT Rate:"}
                </span>
                <span className="font-mono font-bold text-foreground">
                  {enableTax ? `${taxRatePercent}%` : lang === "ar" ? "معطلة" : "Disabled"}
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-muted p-4 space-y-2 mb-6 font-mono">
              <Row label={t.subtotal} value={formatPrice(subTotal)} />
              {discountAmount > 0 && (
                <div className="flex justify-between text-xs font-bold text-emerald-600">
                  <span>
                    {lang === "ar" ? "الخصم" : "Discount"} (
                    {discountType === "percent" ? `${discountValue}%` : currency}):
                  </span>
                  <span>-{formatPrice(discountAmount)}</span>
                </div>
              )}
              {dineInServiceAmount > 0 && (
                <Row
                  label={
                    lang === "ar"
                      ? `خدمة الصالة (${dineInServiceRate}%)`
                      : `Dine-in Service (${dineInServiceRate}%)`
                  }
                  value={`+${formatPrice(dineInServiceAmount)}`}
                />
              )}
              {deliveryServiceAmount > 0 && (
                <Row
                  label={lang === "ar" ? "خدمة التوصيل" : "Delivery Fee"}
                  value={`+${formatPrice(deliveryServiceAmount)}`}
                />
              )}
              {enableTax && (
                <Row label={`${t.tax} (${taxRatePercent}%)`} value={formatPrice(tax)} />
              )}
              <div className="h-px border-t border-dashed border-border my-1" />
              <div className="flex justify-between items-baseline font-sans">
                <span className="font-bold">{t.total}</span>
                <span className="text-xl font-black text-primary">{formatPrice(total)}</span>
              </div>
            </div>

            {placeOrder.isError && (
              <p className="text-sm text-destructive mb-3">
                {lang === "ar" ? "تعذر حفظ الطلب:" : "Could not place order:"}{" "}
                {(placeOrder.error as Error).message}
              </p>
            )}
            <button
              disabled={
                placeOrder.isPending ||
                (orderType === "dine_in" && !selectedTable) ||
                (payment === "card" && !authNumber) ||
                (payment === "wallet" && !mobileNumber)
              }
              onClick={() => placeOrder.mutate()}
              className="w-full py-4 rounded-2xl text-primary-foreground font-bold disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg"
              style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-elegant)" }}
            >
              {placeOrder.isPending ? <Loader2 size={18} className="animate-spin" /> : null}
              {t.confirm_order}
            </button>
          </div>
        </Modal>
      )}

      {invoice && (
        <Modal onClose={() => setInvoice(null)}>
          <InvoiceView invoice={invoice} onClose={() => setInvoice(null)} />
        </Modal>
      )}

      {noteEditingItem && (
        <Modal onClose={() => setNoteEditingItem(null)}>
          <div
            className="p-6 font-cairo max-w-md w-full mx-auto"
            dir={lang === "ar" ? "rtl" : "ltr"}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="font-black text-base text-foreground">
                    {lang === "ar" ? "ملاحظة خاصة بالصنف" : "Item Note"}
                  </h3>
                  <p className="text-xs text-muted-foreground font-bold line-clamp-1">
                    {noteEditingItem.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setNoteEditingItem(null)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  {lang === "ar" ? "نص الملاحظة للطلب والمطبخ:" : "Note for Order & Kitchen:"}
                </label>
                <textarea
                  rows={3}
                  value={noteEditingItem.notes}
                  onChange={(e) =>
                    setNoteEditingItem((prev) => (prev ? { ...prev, notes: e.target.value } : null))
                  }
                  placeholder={
                    lang === "ar"
                      ? "مثال: بدون بصل، صوص إضافي، بدون ملح، مستوي زيادة..."
                      : "e.g. No onion, extra sauce, well done..."
                  }
                  className="w-full bg-background border border-input rounded-xl p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none leading-relaxed"
                  autoFocus
                />
              </div>

              <div>
                <span className="text-[11px] font-bold text-muted-foreground block mb-2">
                  {lang === "ar" ? "اختيارات سريعة شائعة:" : "Quick Preset Options:"}
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
                    "تغليف سفري",
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
                      className="text-[11px] font-bold bg-muted hover:bg-amber-100 hover:text-amber-900 border border-border px-2.5 py-1 rounded-lg transition active:scale-95"
                    >
                      +{preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
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
                    className="bg-primary text-primary-foreground text-xs font-bold rounded-xl h-9 gap-1 shadow-sm"
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
        </Modal>
      )}

      {/* Mobile Floating Cart Trigger Button */}
      <div className="lg:hidden fixed bottom-6 left-6 z-40">
        <button
          onClick={() => setIsMobileCartOpen(true)}
          className="flex items-center gap-3 bg-primary text-primary-foreground font-black text-sm px-5 py-3.5 rounded-full shadow-2xl hover:opacity-95 active:scale-95 transition-all border-2 border-primary-foreground/20 cursor-pointer"
        >
          <div className="relative">
            <ShoppingCart size={22} />
            {itemCount > 0 && (
              <span className="absolute -top-2.5 -right-2.5 bg-amber-400 text-slate-900 text-[11px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow">
                {itemCount}
              </span>
            )}
          </div>
          <div className="flex flex-col items-start leading-none">
            <span className="text-[10px] opacity-80 uppercase tracking-wider">
              {lang === "ar" ? "سلة الشراء" : "Cart"}
            </span>
            <span className="text-sm font-black">{formatPrice(subTotal)}</span>
          </div>
        </button>
      </div>

      {/* Mobile Cart Drawer / Slide-Over */}
      {isMobileCartOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden flex justify-end animate-in fade-in"
          onClick={() => setIsMobileCartOpen(false)}
        >
          <div
            className="w-full max-w-md bg-card h-full flex flex-col shadow-2xl animate-in slide-in-from-bottom sm:slide-in-from-left duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-card">
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
                    onClick={() => setCart([])}
                    className="text-xs text-destructive hover:underline px-2 py-1 font-bold"
                  >
                    {lang === "ar" ? "مسح الكل" : "Clear All"}
                  </button>
                )}
                <button
                  onClick={() => setIsMobileCartOpen(false)}
                  className="w-9 h-9 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-foreground transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
              {cart.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
                    <ShoppingCart size={26} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t.empty_cart}
                    <br />
                    <span className="text-xs">
                      {lang === "ar" ? "اضغط على الأصناف لإضافتها" : "Click on items to add them"}
                    </span>
                  </p>
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
                        className="w-14 h-14 rounded-xl object-cover shrink-0"
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
                            className={`p-1 rounded-md transition ${
                              c.notes
                                ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                            title={lang === "ar" ? "ملاحظة للصنف" : "Item note"}
                          >
                            <FileText size={14} />
                          </button>
                          <button
                            onClick={() => removeFromCart(c.item.id)}
                            className="text-muted-foreground hover:text-destructive transition p-1"
                            title={lang === "ar" ? "حذف الصنف" : "Remove item"}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {c.notes ? (
                        <div className="mt-1.5 flex items-center justify-between gap-1.5 bg-amber-50 border border-amber-200 text-amber-950 rounded-lg px-2 py-1 text-[11px] font-bold">
                          <div
                            className="flex-1 min-w-0 truncate cursor-pointer hover:underline flex items-center gap-1"
                            onClick={() =>
                              setNoteEditingItem({
                                id: c.item.id,
                                name: c.item.name_ar,
                                notes: c.notes || "",
                              })
                            }
                          >
                            <span className="text-amber-700 font-extrabold shrink-0">ملاحظة:</span>
                            <span className="truncate">{c.notes}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => updateItemNotes(c.item.id, "")}
                            className="text-amber-700 hover:text-rose-600 p-0.5 rounded transition shrink-0"
                            title="حذف الملاحظة"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setNoteEditingItem({
                              id: c.item.id,
                              name: c.item.name_ar,
                              notes: "",
                            })
                          }
                          className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground hover:text-primary transition"
                        >
                          <Plus size={11} />
                          <span>{lang === "ar" ? "إضافة ملاحظة..." : "Add note..."}</span>
                        </button>
                      )}

                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm font-black text-primary">
                          {formatPrice(c.item.price * c.quantity)}
                        </span>
                        <div
                          className="flex items-center gap-1.5 bg-card rounded-lg border border-border p-0.5"
                          dir="ltr"
                        >
                          <button
                            onClick={() => updateQuantity(c.item.id, -1)}
                            className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center transition"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="text-xs font-bold w-6 text-center">{c.quantity}</span>
                          <button
                            onClick={() => updateQuantity(c.item.id, 1)}
                            className="w-7 h-7 rounded-md bg-primary text-primary-foreground hover:opacity-90 flex items-center justify-center transition"
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

            <div className="border-t border-border p-5 space-y-3 bg-card mt-auto pb-8">
              <div className="flex justify-between items-baseline">
                <span className="font-bold text-sm">
                  {lang === "ar" ? "مجموع الطلبات" : t.subtotal}
                </span>
                <span className="text-2xl font-black text-primary">{formatPrice(subTotal)}</span>
              </div>
              <button
                disabled={cart.length === 0}
                onClick={() => {
                  setIsMobileCartOpen(false);
                  setCheckoutOpen(true);
                }}
                className="w-full py-4 rounded-2xl text-primary-foreground font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-95 active:scale-[0.99] transition shadow"
                style={{
                  background: "var(--gradient-primary)",
                  boxShadow: "var(--shadow-elegant)",
                }}
              >
                {lang === "ar" ? "إتمام الطلب" : "Place Order"} • {formatPrice(subTotal)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm text-muted-foreground">
      <span>{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

function CategoryPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition border " +
        (active
          ? "bg-primary text-primary-foreground border-primary shadow"
          : "bg-card text-foreground border-border hover:border-primary/40")
      }
    >
      {label}
    </button>
  );
}

function PayOption({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition " +
        (active
          ? "border-primary bg-primary/5 text-primary"
          : "border-border bg-card text-muted-foreground hover:border-primary/40")
      }
    >
      {icon}
      <span className="text-sm font-bold">{label}</span>
    </button>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        style={{ boxShadow: "var(--shadow-elegant)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function InvoiceView({ invoice, onClose }: { invoice: CompletedOrder; onClose: () => void }) {
  const { lang, formatPrice } = useSettings();
  const { toast } = useToast();
  const t = translations[lang];
  const receiptSettings = getReceiptDesignSettings();

  const rawItems = invoice?.items;
  const itemsList: any[] = Array.isArray(rawItems)
    ? rawItems
    : typeof rawItems === "string"
      ? (() => {
          try {
            return JSON.parse(rawItems);
          } catch {
            return [];
          }
        })()
      : [];

  const payLabel: Record<PaymentMethod, string> = {
    cash: t.cash,
    card: t.card,
    wallet: t.wallet,
  };
  const typeLabel: Record<OrderType, string> = {
    dine_in: t.dine_in,
    takeaway: t.takeaway,
    delivery: t.delivery,
  };
  const statusLabel: Record<string, string> = {
    pending: t.status_pending,
    preparing: t.status_preparing,
    ready: t.status_ready,
    served: t.status_served,
    cancelled: t.status_cancelled,
  };

  const calculatedItemsSubtotal = itemsList.reduce(
    (sum, it) => sum + Number(it?.price || 0) * Number(it?.quantity || 0),
    0,
  );
  const displaySubtotal =
    Number(invoice.subtotal) > 0 ? Number(invoice.subtotal) : calculatedItemsSubtotal;
  const displayDiscount = Number(invoice.discount) || 0;
  const displayServiceFee = Number(invoice.service_fee) || 0;
  const displayDeliveryFee = Number(invoice.delivery_fee) || 0;
  const taxRateForDisplay = Number(invoice.tax_rate ?? receiptSettings.defaultTaxRate ?? 14);
  const displayTax =
    Number(invoice.tax) > 0
      ? Number(invoice.tax)
      : Number(((displaySubtotal * taxRateForDisplay) / 100).toFixed(2));
  const displayTotal =
    Number(invoice.total) > 0
      ? Number(invoice.total)
      : Math.max(
          0,
          displaySubtotal - displayDiscount + displayServiceFee + displayDeliveryFee + displayTax,
        );

  const handlePrint = () => {
    const isConnected = printerService.isPrinterConnected();
    const receiptData = {
      storeName: receiptSettings.storeName || t.title,
      storeSubtitle: receiptSettings.storeSubtitle || t.invoice_title,
      taxNumber: receiptSettings.taxNumber,
      orderNumber: invoice.order_number,
      orderType: typeLabel[invoice.order_type],
      paymentMethod: payLabel[invoice.payment_method],
      date: new Date(invoice.created_at).toLocaleString(lang === "ar" ? "ar-EG" : "en-US"),
      items: itemsList.map((it) => ({
        name: it.name_ar || it.name,
        quantity: it.quantity,
        price: it.price,
      })),
      subtotal: printableSubtotal,
      discount: printableDiscount || undefined,
      serviceFee: printableServiceFee || undefined,
      deliveryFee: printableDeliveryFee || undefined,
      tax: printableTax,
      taxRate: invoice.tax_rate ?? receiptSettings.defaultTaxRate,
      total: printableTotal,
      currency,
      thankYouMessage: receiptSettings.thankYouMessage,
      footerNotes: receiptSettings.footerNotesText,
    };

    if (isConnected) {
      toast({
        title: "طباعة مباشرة",
        description: "تم إرسال الإيصال مباشرة إلى الطابعة الحرارية المتصلة 🖨️",
      });
      printerService.printReceipt(receiptData);
    } else {
      toast({
        title: "جاري إرسال أمر الطباعة",
        description: "جاري فتح نافذة طباعة الإيصال 🖨️",
      });

      // Execute window.print() synchronously immediately
      try {
        window.print();
      } catch (err) {
        console.warn("window.print failed, opening print popup window:", err);
      }

      // Also open popup fallback if iframe blocks window.print
      setTimeout(() => {
        printerService.printHtmlWindow(receiptData);
      }, 100);
    }
  };

  return (
    <div className="p-8" id="invoice" dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className="text-center mb-6">
        {receiptSettings.showLogo && (
          <div
            className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-white mb-3 font-bold"
            style={{ backgroundColor: receiptSettings.accentColor || "#10b981" }}
          >
            <UtensilsCrossed size={24} />
          </div>
        )}
        <h3 className="text-2xl font-black">{receiptSettings.storeName || t.title}</h3>
        <p className="text-xs text-muted-foreground mt-1">
          {receiptSettings.storeSubtitle || t.invoice_title}
        </p>
        {receiptSettings.showTaxNumber && (
          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
            الرقم الضريبي: {receiptSettings.taxNumber} | سجل تجاري:{" "}
            {receiptSettings.commercialRegister}
          </p>
        )}
      </div>

      <div className="border-y border-dashed border-border py-3 mb-4 flex justify-between text-sm">
        <div>
          <div className="text-muted-foreground text-xs">{t.invoice_order}</div>
          <div className="font-black text-lg text-primary">#{invoice.order_number}</div>
        </div>
        <div className={lang === "ar" ? "text-left" : "text-right"}>
          <div className="text-muted-foreground text-xs">{t.invoice_date}</div>
          <div className="font-semibold">
            {new Date(invoice.created_at).toLocaleString(lang === "ar" ? "ar-EG" : "en-US", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </div>
        </div>
      </div>

      <div className="space-y-1 text-sm mb-4 text-muted-foreground">
        {receiptSettings.showOrderType && (
          <div className="flex justify-between">
            <span>{t.order_type}</span>
            <span className="font-semibold text-foreground">{typeLabel[invoice.order_type]}</span>
          </div>
        )}
        {receiptSettings.showPaymentMethod && (
          <div className="flex justify-between">
            <span>{t.payment_method}</span>
            <span className="font-semibold text-foreground">
              {payLabel[invoice.payment_method]}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span>{t.invoice_status}</span>
          <span className="font-semibold text-foreground">
            {statusLabel[invoice.status] || invoice.status}
          </span>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {itemsList.map((it, i) => (
          <div key={i} className="space-y-0.5">
            <div className="flex justify-between text-sm">
              <span className="flex-1">
                <span className="text-muted-foreground mx-1">×{it.quantity}</span>
                {it.name_ar || it.name}
              </span>
              <span className="font-bold">{formatPrice(it.price * it.quantity)}</span>
            </div>
            {Boolean(it.notes || it.note) && (
              <div className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 font-bold mr-3 inline-block">
                ملاحظة: {it.notes || it.note}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-dashed border-border pt-3 space-y-2 font-mono">
        <Row label={t.subtotal} value={formatPrice(displaySubtotal)} />
        {Boolean(invoice.discount && invoice.discount > 0) && (
          <Row label="الخصم" value={`-${formatPrice(Number(invoice.discount))}`} />
        )}
        {Boolean(invoice.service_fee && invoice.service_fee > 0) && (
          <Row label="خدمة الصالة" value={`+${formatPrice(Number(invoice.service_fee))}`} />
        )}
        {Boolean(invoice.delivery_fee && invoice.delivery_fee > 0) && (
          <Row label="رسوم التوصيل" value={`+${formatPrice(Number(invoice.delivery_fee))}`} />
        )}
        {receiptSettings.showTaxBreakdown && (
          <Row
            label={`${t.tax} (${invoice.tax_rate ?? receiptSettings.defaultTaxRate ?? 14}%)`}
            value={formatPrice(displayTax)}
          />
        )}
        <div className="flex justify-between items-baseline pt-2 border-t border-border font-sans">
          <span className="font-bold">{t.total}</span>
          <span className="text-2xl font-black text-primary">{formatPrice(displayTotal)}</span>
        </div>
      </div>

      <div className="text-center text-xs text-muted-foreground mt-6 px-4 space-y-1">
        {receiptSettings.showThankYouMsg && (
          <p className="font-semibold text-foreground">
            {receiptSettings.thankYouMessage || t.thank_you}
          </p>
        )}
        {receiptSettings.showFooterNotes && (
          <p className="text-[11px] text-muted-foreground">{receiptSettings.footerNotesText}</p>
        )}
        {receiptSettings.showWifiPass && (
          <p className="text-[10px] text-muted-foreground font-mono">
            {receiptSettings.wifiPasswordText}
          </p>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 print:hidden">
        <button
          onClick={handlePrint}
          className="py-3 rounded-2xl border border-border font-bold text-sm flex items-center justify-center gap-2 hover:bg-muted"
        >
          <Printer size={16} />
          {t.print}
        </button>
        <button
          onClick={onClose}
          className="py-3 rounded-2xl text-primary-foreground font-bold text-sm"
          style={{ background: "var(--gradient-primary)" }}
        >
          {t.new_order}
        </button>
      </div>
    </div>
  );
}
